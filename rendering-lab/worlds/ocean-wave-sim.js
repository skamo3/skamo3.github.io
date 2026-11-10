// Ocean Wave · 플레이어 주변 로컬 시뮬레이션 (P6 선형 파동, P7 얕은 물 방정식)
// 설계: chapters/ocean-wave.design.md 13장
//
// 창: N × N 셀(기본 128², 셀 0.25 m → 32 m 사방)이 플레이어를 따라 움직인다.
//   - 창 원점은 셀 크기로 스냅한다. 스냅 안 하면 매 프레임 재샘플링이 생겨 파동이 번진다
//   - 토로이달 주소: 셀 (cx, cz)는 버퍼의 (cx mod N, cz mod N) 칸에 산다. 창이 움직여도 복사가 없다.
//     칸마다 "지금 담고 있는 월드 셀 좌표"를 같이 저장해 두고, 다르면 그 칸은 새로 들어온 셀이라 초기화한다
//   - 가장자리 흡수층(sponge)에서 감쇠를 올려 창 경계 반사를 없앤다
// 출력: 한 프레임의 마지막에 storage 텍스처(rgba16float)에 (δ, ∂δ/∂x, ∂δ/∂z, 물 깊이)를 쓴다.
//   δ = 베이크 수면 위에 더할 높이. 텍스처도 같은 토로이달 배치라 RepeatWrapping + 선형 필터로 바로 샘플한다
//   정점 셰이더(높이), 프래그먼트(노멀), 탐침(캐릭터 수면)이 모두 같은 합성 함수를 쓴다
//
// 모델 (E7):
//   linear: ∂²η/∂t² = c²∇²η − k∂η/∂t, c = min(√(g·d), C_MAX). 속도 v와 높이 η를 따로 두는 심플렉틱 오일러.
//           커널 두 개(v 갱신 → η 갱신)라 핑퐁 버퍼 없이 제자리에서 갱신된다
//   swe:    virtual pipe 모델. 셀마다 물 깊이 h + 4방향 유량. 마른 셀(h = 0)이 자연스럽게 다뤄져 물이 해변을 타고 오른다.
//           베이크 수면을 목표로 깊은 쪽 셀을 끌어당겨(nudging) 베이크 파도의 물을 시뮬로 넘겨받는다
import * as THREE from 'three/webgpu';
import {
  Fn, instanceIndex, instancedArray, uniform, float, int, vec2, vec4, uvec2,
  select, If, max, min, clamp, abs, sqrt, exp, log, sin, smoothstep, floor, length, textureStore, texture,
} from 'three/tsl';

export const SIM = {
  N: 128, DX: 0.25,
  STEP: 1 / 120,           // 고정 dt (E9: 누적기)
  MAX_STEPS: 6,            // 한 프레임 최대 서브스텝 (프레임이 크게 떨어지면 시간을 버린다)
  G: 9.81,
  C_MAX: 1.5,              // 선형 모델 파속 상한 (발 물결은 깊은 물 분산이라 √(g·d)보다 느리다)
  DAMP: 0.35,              // 선형 모델 전체 감쇠 (1/s)
  SPONGE: 10, SPONGE_W: 10,  // 흡수층: 가장자리에서 감쇠율 (1/s), 두께 (셀)
  FADE0: 3, FADE1: 14,     // 합성 가중치: 가장자리 셀 수 → 0 ~ 1
  GAIN: 1,                 // 몸이 밀어낸 부피 → 수면 변화 배율 (1 = 부피 보존)
  FRICTION: 0.15,          // SWE 유량 감쇠 (1/s)
  NUDGE: 4,                // SWE: 베이크 수면으로 끌어당기는 빠르기 (1/s)
  NUDGE_D: [0.08, 0.3],     // SWE: 이 잔잔한 수심 사이에서 끌어당김이 0 → 1 (얕은 쪽은 시뮬이 자유롭게)
  DRY: 0.004,              // SWE: 이보다 얕으면 마른 셀
};

// ── 지형 높이의 TSL 판 (ocean-wave-coast.js terrainHeight와 같은 식) ──
const shoreZT = x => float(14).mul(exp(x.div(60).mul(x.div(60)).negate())).sub(4).sub(smoothstep(105, 175, abs(x)).mul(125));
export const terrainT = (x, z) => {
  const d = z.sub(shoreZT(x));
  const cape = smoothstep(105, 175, abs(x));
  const dune = smoothstep(15, 40, d).mul(3.5);
  const bumps = sin(x.mul(0.13)).mul(sin(z.mul(0.21))).mul(smoothstep(8, 25, d)).mul(0.35);
  const hill = cape.mul(smoothstep(0, 25, d).mul(6).add(sin(x.mul(0.05).add(z.mul(0.03))).mul(2.5)));
  const land = d.mul(0.05).add(dune).add(bumps).add(hill);
  const s = min(d.negate(), 400);
  const sp = log(exp(s.sub(30).div(6)).add(1)).mul(6);
  const sea = min(s.mul(0.04).add(sp.mul(0.07)), 14).negate();
  return select(d.greaterThanEqual(0), land, sea);
};

// posBuf: 베이크 수면 정점 버퍼, mesh: { GX, GZ, NC, x0, x1, dx, zFine, z1, dzFine } (촘촘한 구간에서 베이크 높이를 읽는다)
export function createSim({ posBuf, mesh, N = SIM.N, DX = SIM.DX }) {
  const NN = N * N;
  const st = instancedArray(NN, 'float');     // linear: η / swe: h
  const fl = instancedArray(NN, 'vec4');      // linear: (v, 0, 0, 0) / swe: 유량 (−x, +x, −z, +z)
  const tag = instancedArray(NN, 'vec4');     // (담고 있는 셀 cx, cz, 지형 높이 b, 0)
  { const a = tag.value.array; for (let i = 0; i < NN; i++) a[i * 4] = 1e6; tag.value.needsUpdate = true; }

  const tex = new THREE.StorageTexture(N, N);
  tex.type = THREE.HalfFloatType;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;

  const org = uniform(new THREE.Vector2(1e5, 1e5));   // 창 왼쪽 위(로컬 0, 0)의 월드 셀 좌표
  const orgM = uniform(new THREE.Vector2(0, 0));      // org mod N
  const dtU = uniform(SIM.STEP);
  const frameDt = uniform(0);
  // 몸 근사: 원기둥 3개(두 다리 + 몸통). 지금(cur)과 지난 프레임(prev): (x, z, 반지름, 잠긴 높이)
  const NSRC = 3;
  const cur = Array.from({ length: NSRC }, () => uniform(new THREE.Vector4(0, 0, 0.1, 0)));
  const prev = Array.from({ length: NSRC }, () => uniform(new THREE.Vector4(0, 0, 0.1, 0)));

  // ── 공통: 스레드 → 칸, 로컬 좌표, 월드 셀 ──
  const cellOf = () => {
    const t = int(instanceIndex);
    const tx = t.mod(N), tz = t.div(N);
    const lx = tx.sub(int(orgM.x)).add(N).mod(N), lz = tz.sub(int(orgM.y)).add(N).mod(N);
    const cx = int(org.x).add(lx), cz = int(org.y).add(lz);
    const e = min(min(lx, int(N - 1).sub(lx)), min(lz, int(N - 1).sub(lz)));   // 가장자리까지 셀 수
    const at = (ax, az) => tz.add(az + N).mod(N).mul(N).add(tx.add(ax + N).mod(N));
    return { t, tx, tz, lx, lz, cx, cz, e, at, x: float(cx).mul(DX), z: float(cz).mul(DX) };
  };
  // 베이크 수면 높이: 수면 격자 촘촘한 구간의 가장 가까운 정점 y (밖이면 잔잔한 수면 0)
  const bakeAt = (x, z) => {
    const ix = int(floor(x.sub(mesh.x0).div(mesh.dx).add(0.5)));
    const iz = int(floor(z.sub(mesh.zFine).div(mesh.dzFine).add(0.5))).add(mesh.NC);
    const inside = x.greaterThan(mesh.x0).and(x.lessThan(mesh.x1)).and(z.greaterThan(mesh.zFine)).and(z.lessThan(mesh.z1));
    const idx = clamp(iz, 0, mesh.GZ - 1).mul(mesh.GX).add(clamp(ix, 0, mesh.GX - 1));
    return select(inside, posBuf.element(idx).y, float(0));
  };
  // 몸이 셀을 차지한 정도 (원기둥 단면 × 잠긴 높이). 경계를 셀 하나만큼 부드럽게 퍼뜨리고,
  // 퍼뜨린 만큼 줄여서 전체 합이 실제 잠긴 부피(πr² × 잠긴 높이)와 같게 한다. 안 줄이면 다리(r 0.1 m)가 5배 굵게 물을 민다
  const occ = (src, x, z) => {
    let o = float(0);
    for (const s of src) {
      const d = length(vec2(x, z).sub(s.xy));
      const norm = s.z.mul(s.z).div(s.z.add(DX / 2).mul(s.z.add(DX / 2)));
      o = o.add(float(1).sub(smoothstep(s.z, s.z.add(DX), d)).mul(s.w).mul(norm));
    }
    return o;
  };
  // 다리 장애물 (P7): 다리가 잠긴 셀은 물이 통과하지 못한다. 반지름은 다리 굵기 + 셀 1/4 (셀 0~1개)
  // 더 크게 잡으면 다리 주변에 물이 멈춘 구멍이 보인다
  const obstacle = (x, z) => {
    let o = float(0);
    for (let k = 0; k < 2; k++) {
      const s = cur[k];
      o = max(o, select(length(vec2(x, z).sub(s.xy)).lessThan(s.z.add(DX * 0.25)).and(s.w.greaterThan(0.05)), float(1), float(0)));
    }
    return o.greaterThan(0.5);
  };
  // 새로 들어온 셀인지 확인하고 초기화 (true면 이번 스텝은 건너뜀)
  const claim = (c, init) => {
    const tg = tag.element(c.t);
    const fresh = tg.x.notEqual(float(c.cx)).or(tg.y.notEqual(float(c.cz)));
    If(fresh, () => {
      const b = terrainT(c.x, c.z);
      tg.assign(vec4(float(c.cx), float(c.cz), b, 0));
      st.element(c.t).assign(init(b));
      fl.element(c.t).assign(vec4(0));
    });
    return fresh;
  };
  const sponge = c => float(1).sub(smoothstep(0, SIM.SPONGE_W, float(c.e))).pow(2).mul(SIM.SPONGE);

  // ── linear ──
  const linVel = Fn(() => {
    const c = cellOf();
    const fresh = claim(c, () => float(0));
    If(fresh.not(), () => {
      const b = tag.element(c.t).z;
      const d = b.negate();
      const eta = st.element(c.t);
      const lap = st.element(c.at(-1, 0)).add(st.element(c.at(1, 0))).add(st.element(c.at(0, -1))).add(st.element(c.at(0, 1)))
        .sub(eta.mul(4)).div(DX * DX);
      const cc = min(sqrt(max(d, 0).mul(SIM.G)), SIM.C_MAX);
      const v = fl.element(c.t).x;
      const vn = v.add(dtU.mul(cc).mul(cc).mul(lap)).mul(exp(dtU.mul(sponge(c).add(SIM.DAMP)).negate()));
      // (다리 장애물은 선형 모델에 넣지 않는다: 고정된 셀에 몸이 밀어낸 물이 갇혀 빠지지 않는다)
      const wall = d.lessThan(0.02).or(c.e.equal(0));
      fl.element(c.t).x.assign(select(wall, float(0), vn));
    });
  })().compute(NN);
  const linPos = Fn(() => {
    const c = cellOf();
    const d = tag.element(c.t).z.negate();
    const eta = st.element(c.t);
    const en = eta.add(dtU.mul(fl.element(c.t).x)).mul(exp(dtU.mul(sponge(c)).negate()));
    eta.assign(select(d.lessThan(0.02).or(c.e.equal(0)), float(0), en));
  })().compute(NN);
  const linInject = Fn(() => {
    const c = cellOf();
    const dOcc = occ(cur, c.x, c.z).sub(occ(prev, c.x, c.z));
    const d = tag.element(c.t).z.negate();
    If(d.greaterThan(0.02), () => { st.element(c.t).addAssign(dOcc.mul(SIM.GAIN)); });
  })().compute(NN);
  const linOut = Fn(() => {
    const c = cellOf();
    const eta = st.element(c.t);
    const gx = st.element(c.at(1, 0)).sub(st.element(c.at(-1, 0))).div(2 * DX);
    const gz = st.element(c.at(0, 1)).sub(st.element(c.at(0, -1))).div(2 * DX);
    const edge = c.e.equal(0);
    textureStore(tex, uvec2(c.tx, c.tz), vec4(eta, select(edge, float(0), gx), select(edge, float(0), gz), 1)).toWriteOnly();
  })().compute(NN);

  // ── swe (virtual pipe) ──
  // 단위: 유량 m³/s. 관 단면적 A = DX², 길이 l = DX → 가속 = g · A / l · ΔH = g · DX · ΔH
  const surf = i => tag.element(i).z.add(st.element(i));
  const sweFlux = Fn(() => {
    const c = cellOf();
    const fresh = claim(c, b => max(bakeAt(c.x, c.z).sub(b), 0));
    If(fresh.not(), () => {
      const H = surf(c.t);
      const h = st.element(c.t);
      const f = fl.element(c.t);
      const blockedSelf = obstacle(c.x, c.z).or(c.e.equal(0));
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      const keep = exp(dtU.mul(SIM.FRICTION).negate());
      const nf = dirs.map(([ax, az], k) => {
        const n = c.at(ax, az);
        const blocked = blockedSelf.or(obstacle(c.x.add(ax * DX), c.z.add(az * DX)));
        const old = [f.x, f.y, f.z, f.w][k];
        const v = max(old.mul(keep).add(dtU.mul(SIM.G * DX).mul(H.sub(surf(n)))), 0);
        return select(blocked, float(0), v);
      });
      const out = nf[0].add(nf[1]).add(nf[2]).add(nf[3]);
      // 가진 물보다 많이 내보내지 않게 (음수 깊이 방지)
      const K = min(float(1), h.mul(DX * DX).div(max(out.mul(dtU), 1e-9)));
      f.assign(vec4(nf[0], nf[1], nf[2], nf[3]).mul(K));
    });
  })().compute(NN);
  const sweDepth = Fn(() => {
    const c = cellOf();
    const h = st.element(c.t);
    const f = fl.element(c.t);
    const fin = fl.element(c.at(-1, 0)).y.add(fl.element(c.at(1, 0)).x).add(fl.element(c.at(0, -1)).w).add(fl.element(c.at(0, 1)).z);
    const fout = f.x.add(f.y).add(f.z).add(f.w);
    const b = tag.element(c.t).z;
    const hn = max(h.add(dtU.mul(fin.sub(fout)).div(DX * DX)), 0);
    // 베이크 파도 넘겨받기: 잔잔한 수심이 깊은 셀과 흡수층은 베이크 수면 쪽으로 끌어당긴다
    const target = max(bakeAt(c.x, c.z).sub(b), 0);
    const rate = smoothstep(SIM.NUDGE_D[0], SIM.NUDGE_D[1], b.negate()).mul(SIM.NUDGE).add(sponge(c));
    h.assign(mix0(hn, target, float(1).sub(exp(dtU.mul(rate).negate()))));
  })().compute(NN);
  const sweInject = Fn(() => {
    const c = cellOf();
    const dOcc = occ(cur, c.x, c.z).sub(occ(prev, c.x, c.z));
    const h = st.element(c.t);
    // 다리 칸(장애물)에 넣으면 유량이 막혀 갇힌다. 그 바깥 고리에만 넣는다
    If(h.greaterThan(SIM.DRY).and(obstacle(c.x, c.z).not()), () => { h.assign(max(h.add(dOcc.mul(SIM.GAIN)), 0)); });
  })().compute(NN);
  // δ = 시뮬 수면 − 베이크 수면. 마른 셀은 베이크가 모래 위로 나오면 모래 아래로 눌러 둔다
  const delta = i => {
    const tg = tag.element(i);
    const bk = bakeAt(tg.x.mul(DX), tg.y.mul(DX));
    const wet = st.element(i).greaterThan(SIM.DRY);
    return select(wet, tg.z.add(st.element(i)).sub(bk), min(tg.z.sub(0.05).sub(bk), 0));
  };
  const sweOut = Fn(() => {
    const c = cellOf();
    const gx = delta(c.at(1, 0)).sub(delta(c.at(-1, 0))).div(2 * DX);
    const gz = delta(c.at(0, 1)).sub(delta(c.at(0, -1))).div(2 * DX);
    const edge = c.e.equal(0);
    textureStore(tex, uvec2(c.tx, c.tz), vec4(delta(c.t), select(edge, float(0), gx), select(edge, float(0), gz), st.element(c.t))).toWriteOnly();
  })().compute(NN);

  const MODELS = {
    linear: { inject: linInject, steps: [linVel, linPos], out: linOut },
    swe: { inject: sweInject, steps: [sweFlux, sweDepth], out: sweOut },
  };

  // ── 합성 (TSL): 월드 xz → (δ, ∂δ/∂x, ∂δ/∂z, h)와 창 가중치 ──
  const sample = xz => texture(tex, xz.div(DX).add(0.5).div(N)).level(0);
  const weight = xz => {
    const l = xz.div(DX).sub(org);
    const e = min(min(l.x, float(N - 1).sub(l.x)), min(l.y, float(N - 1).sub(l.y)));
    return smoothstep(SIM.FADE0, SIM.FADE1, e);
  };

  const sim = {
    N, DX, tex, model: 'swe', acc: 0, steps: 0, cells: NN,
    bufs: { st, fl, tag },                 // 디버그 읽기용
    sample, weight,
    // 창 위치 + 몸 소스 갱신 (프레임마다). sources: [{ x, z, r, sub }] × 3
    setFrame(px, pz, sources) {
      const ox = Math.round(px / DX) - N / 2, oz = Math.round(pz / DX) - N / 2;
      org.value.set(ox, oz);
      orgM.value.set(((ox % N) + N) % N, ((oz % N) + N) % N);
      for (let k = 0; k < NSRC; k++) {
        prev[k].value.copy(cur[k].value);
        const s = sources[k];
        cur[k].value.set(s.x, s.z, s.r, s.sub);
      }
    },
    // 고정 dt 누적기로 서브스텝을 돌린다. 반환: 이번 프레임 스텝 수
    run(renderer, dt) {
      const m = MODELS[sim.model];
      renderer.compute(m.inject);
      sim.acc += dt;
      let n = 0;
      while (sim.acc >= SIM.STEP && n < SIM.MAX_STEPS) { sim.acc -= SIM.STEP; n++; }
      if (n === SIM.MAX_STEPS) sim.acc = 0;
      dtU.value = SIM.STEP;
      for (let i = 0; i < n; i++) for (const k of m.steps) renderer.compute(k);
      renderer.compute(m.out);
      sim.steps = n;
      frameDt.value = dt;
      return n;
    },
    setModel(name) {
      if (name === sim.model) return;
      sim.model = name;
      // 상태 뜻이 바뀌므로 전부 새 셀로 취급 (다음 스텝에서 모델에 맞게 초기화된다)
      const a = tag.value.array; for (let i = 0; i < NN; i++) a[i * 4] = 1e6; tag.value.needsUpdate = true;
    },
    dispose() { tex.dispose(); },
  };
  return sim;
}

// a + (b − a)·t (TSL mix와 같지만 인자 순서를 명시적으로)
function mix0(a, b, t) { return a.add(b.sub(a).mul(t)); }
