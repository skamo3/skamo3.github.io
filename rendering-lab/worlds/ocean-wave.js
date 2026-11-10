// Ocean Wave · 해안가 부서지는 파도 (커리큘럼 밖 독립 실험, WebGPU 컴퓨트)
// 설계: chapters/ocean-wave.design.md
//
// P1: WebGPU 하네스 위에서 해변 + 수면 격자. 수면 정점 위치는 storage 버퍼에만 있고
//     컴퓨트가 매 프레임 써넣는다. 렌더 패스는 그 버퍼를 vertexIndex로 바로 읽는다.
// P2: 단면 변형 텍스처(deformTex/derivTex) + 직선 파면 1개 + compute C(쿼드 전체 순회).
//     - 단면 곡선은 ocean-wave-section.js에서 init 때 굽는다 (논문의 "오프라인 베이크" 역할)
//     - 파면은 x를 따라 S개의 쿼드로 쪼개고, 쿼드 양 끝마다 애니메이션 파라미터 V를 따로 둔다.
//       수심이 얕은 곳부터 V가 먼저 올라가서 부서지는 위치가 파면을 따라 퍼진다
//     - 정점마다 모든 쿼드를 순회해 자기를 포함한 쿼드를 찾는다 (E2의 기준선. 비닝은 나중에)
// P3: 파면을 Coons 패치 + 경로 추적으로 굽고(waveLUT), compute A가 매 프레임 그 표에서 쿼드를 만든다.
//     - 파면 K개가 같은 표를 서로 다른 시간으로 읽는다 (연속으로 밀려오는 파도)
//     - 파도마다 변주 표의 한 줄을 골라 강도로 곱한다. 0인 구간은 안 부서진다(gap)
//     - 쿼드는 이제 평행사변형이 아니라 일반 사각형(이웃 쿼드와 모서리 공유). compute C는 쌍선형 역변환으로 (a, u)를 구한다
// P4: 셰이딩은 ocean-wave-shading.js에서 직접 계산한다 (하늘 반사 + Fresnel + 물속 산란 + 투과광 + 거품).
//     거품은 프레임 사이에 남는다: compute C가 이전 거품을 조금씩 줄여 가며 새 거품과 max를 취한다
// P5: 3인칭 캐릭터(ocean-wave-player.js). 지형은 해석적 함수로, 수면은 GPU 탐침(3 × 3 정점)을 비동기로 읽어 판정한다.
//     V = 캐릭터 ↔ 관찰 카메라 전환
// P6: 플레이어 주변 로컬 시뮬(ocean-wave-sim.js). 수면 정점 버퍼는 베이크만 담고, 시뮬은 렌더(정점 높이 + 프래그먼트 노멀)와
//     탐침에서 같은 합성 함수로 더한다. N = 시뮬 합성 켜기/끄기
// P7: 얕은 물 방정식(SWE) 모델 추가, 기본값. 베이크 수면을 깊은 쪽 셀의 목표로 넘겨받아 물이 모래 위로 올라왔다 빠진다. M = 모델 전환
// P8: 측정 패널(오른쪽 위). 컴퓨트 호출마다 GPU 타임스탬프를 라벨별로 모으고, 실험 E2·E4·E6~E9·E11을 버튼으로 바꾼다
//
// 주의: 이 월드는 three/webgpu 빌드만 쓴다. 'three'(WebGL 빌드)와 섞지 않는다.
import * as THREE from 'three/webgpu';
import {
  Fn, instanceIndex, vertexIndex, instancedArray, attribute, texture, varying,
  float, int, uint, vec2, vec3, vec4, mix, smoothstep, clamp, min, max, floor, sqrt, length, select,
  cross, normalize, dot, Loop, If, uniform, frontFacing, positionWorld, positionWorldDirection,
  ivec2, atomicAdd, atomicLoad, atomicStore,
} from 'three/tsl';
import { bakeSection, SECTION_W, CREST_U } from './ocean-wave-section.js';
import {
  shoreZ, terrainHeight, smoothstepJS, bakeWaveLUT, sampleLUT, bakeVariation, FRONT,
} from './ocean-wave-coast.js';
import { SUN, HORIZON_HEX, skyColor, rippleNormal, shadeWater } from './ocean-wave-shading.js';
import { createPlayer, createThirdPerson } from './ocean-wave-player.js';
import { createSim, SIM } from './ocean-wave-sim.js';

// ── 월드 좌표 규칙 ──
// 단위 m, 수면 y = 0. 해안선은 x축을 따라 놓이고 바다는 -z 쪽, 육지는 +z 쪽.
// 파도는 -z → +z 로 밀려온다.
const TERRAIN = { x0: -400, x1: 400, z0: -160, z1: 260, segX: 560, segZ: 420 };

// 수면 격자: x는 0.5 m 균일. z는 먼바다 쪽 1 m, 파도가 말리는 구간부터 0.125 m.
// 말린 lip의 반지름이 1 m 안팎이라 파도를 가로지르는 방향(z)으로 촘촘해야 고리가 보인다.
// (파면 근처만 촘촘하게 = 논문 4장의 테셀레이션 문제. 지금은 직선 파면이라 z 방향만 나눈다. E3에서 일반화)
const WATER = {
  x0: -170, x1: 170, dx: 0.5,
  z0: -160, zFine: -90, z1: 25, dzCoarse: 1, dzFine: 0.125,
};

// 해안선·지형·파면 베이크는 ocean-wave-coast.js (three 없이 Node에서 검증 가능)
export { shoreZ, terrainHeight };

// ── 지형 메시 (CPU에서 높이·색 계산, 한 번만) ──
function buildTerrain() {
  const { x0, x1, z0, z1, segX, segZ } = TERRAIN;
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);

  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const dry = new THREE.Color(0xd9c49a), wet = new THREE.Color(0x9c8460);
  const sea = new THREE.Color(0x6f6a55), grass = new THREE.Color(0x8a9a5b), rock = new THREE.Color(0x7d776c);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = terrainHeight(x, z);
    pos.setY(i, y);
    // 물에 젖는 띠 → 마른 모래 → 사구 위 풀, 곶은 바위색
    c.copy(sea).lerp(wet, smoothstepJS(-3, -0.2, y));
    c.lerp(dry, smoothstepJS(0.3, 1.2, y));
    c.lerp(grass, smoothstepJS(3.0, 4.5, y));
    c.lerp(rock, 0.8 * smoothstepJS(120, 165, Math.abs(x)) * smoothstepJS(0.5, 2.0, y));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.95 });
  return new THREE.Mesh(geo, mat);
}

// ── 단면 텍스처 (init 때 CPU에서 굽기) ──
function buildSectionTextures() {
  const { deform, deriv, NU, NV } = bakeSection(256, 128);
  // rgba16float: 선형 필터링이 기본 지원되는 포맷 (rgba32float 필터링은 float32-filterable 필요)
  const toTex = (f32) => {
    const half = new Uint16Array(f32.length);
    for (let i = 0; i < f32.length; i++) half[i] = THREE.DataUtils.toHalfFloat(f32[i]);
    const t = new THREE.DataTexture(half, NU, NV, THREE.RGBAFormat, THREE.HalfFloatType);
    t.magFilter = t.minFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  };
  return { deformTex: toTex(deform), derivTex: toTex(deriv), NU, NV };
}

// ── 수면 격자 geometry (정점 순서 = 컴퓨트의 (ix, iz) 순서) ──
function waterLayout() {
  const { x0, x1, dx, z0, zFine, z1, dzCoarse, dzFine } = WATER;
  const GX = Math.round((x1 - x0) / dx) + 1;
  const NC = Math.round((zFine - z0) / dzCoarse);           // 거친 줄 수 (z0 ~ zFine 직전)
  const NF = Math.round((z1 - zFine) / dzFine) + 1;         // 촘촘한 줄 수 (zFine ~ z1)
  const GZ = NC + NF;
  const zOf = iz => (iz < NC ? z0 + iz * dzCoarse : zFine + (iz - NC) * dzFine);
  return { GX, GZ, NC, COUNT: GX * GZ, zOf };
}

function buildWaterGeometry(L) {
  const { GX, GZ, COUNT, zOf } = L;
  const pos = new Float32Array(COUNT * 3);
  const bed = new Float32Array(COUNT);
  for (let iz = 0; iz < GZ; iz++) {
    const z = zOf(iz);
    for (let ix = 0; ix < GX; ix++) {
      const i = iz * GX + ix, x = WATER.x0 + ix * WATER.dx;
      pos[i * 3] = x; pos[i * 3 + 2] = z;
      bed[i] = terrainHeight(x, z);
    }
  }
  const idx = new Uint32Array((GX - 1) * (GZ - 1) * 6);
  let k = 0;
  for (let iz = 0; iz < GZ - 1; iz++) {
    for (let ix = 0; ix < GX - 1; ix++) {
      const a = iz * GX + ix, b = a + 1, c = a + GX, d = c + 1;
      idx[k++] = a; idx[k++] = c; idx[k++] = b;     // 위(+y)에서 봤을 때 반시계
      idx[k++] = b; idx[k++] = c; idx[k++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));   // 경계구 계산용. 실제 위치는 버퍼
  geo.setAttribute('aBed', new THREE.BufferAttribute(bed, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

// ── 파도 스케줄러 (CPU): 활성 파면 K개의 시간 t_k만 관리한다. 모양은 전부 GPU가 waveLUT에서 읽는다 ──
const PERIOD = [6, 8];                       // 파도 간격 (s, 이 범위에서 무작위)
function createWaves(lutInfo, variationRows) {
  const K = Math.ceil(lutInfo.T / PERIOD[0]) + 1;     // 동시에 살아 있을 수 있는 최대 파면 수
  const slots = Array.from({ length: K }, () => ({ t: 0, row: 0, active: false }));
  let seed = 7;                          // 첫 파도들에 gap이 보이게 고른 시드
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const st = { K, slots, timer: 0 };
  st.spawn = (t0 = 0) => {
    const s = slots.find(x => !x.active);
    if (!s) return;
    s.t = t0; s.row = Math.floor(rnd() * variationRows); s.active = true;
  };
  st.step = (dt) => {
    for (const s of slots) if (s.active) { s.t += dt; if (s.t > lutInfo.T) s.active = false; }
    st.timer -= dt;
    if (st.timer <= 0) { st.spawn(); st.timer = PERIOD[0] + (PERIOD[1] - PERIOD[0]) * rnd(); }
  };
  // 시작하자마자 볼 게 있게: 곧 부서질 파도 하나 + 막 출발한 파도 하나
  st.spawn(8); st.spawn(1); st.timer = 5;
  return st;
}

// ── 수면: storage 버퍼 + compute A(쿼드 생성) + compute C(수면 변형) ──
function buildWater(section) {
  const L = waterLayout();
  const geo = buildWaterGeometry(L);
  const { GX, NC, COUNT } = L;
  const { deformTex, derivTex, NU, NV } = section;
  const W = SECTION_W;

  const posBuf = instancedArray(COUNT, 'vec3');     // 정점 위치
  const nrmBuf = instancedArray(COUNT, 'vec3');     // 정점 노멀
  const foamBuf = instancedArray(COUNT, 'float');   // 거품량

  // waveLUT: 행 = 시간, 열 = 파면 위 위치 s. 값 = (x, z, V, 등장 페이드). init 때 한 번 올린다
  const lutInfo = bakeWaveLUT();
  const { NT, NS, dtRow } = lutInfo;
  const S = NS - 1;
  const lutBuf = instancedArray(NT * NS, 'vec4');
  lutBuf.value.array.set(lutInfo.lut);
  lutBuf.value.needsUpdate = true;

  // 변주 표: 행 = 변주 하나, 열 = s. 값 = 변형 강도
  const vari = bakeVariation(16);
  const varBuf = instancedArray(vari.rows * NS, 'float');
  varBuf.value.array.set(vari.data);
  varBuf.value.needsUpdate = true;

  const waves = createWaves(lutInfo, vari.rows);
  const K = waves.K, KS = K * S;
  // 파면 상태: 파면마다 vec4 (t 초, 변주 행, 활성, 0). CPU가 매 프레임 올리는 유일한 데이터
  const waveBuf = instancedArray(K, 'vec4');
  const waveArr = waveBuf.value.array;

  // 쿼드 버퍼: 쿼드마다 vec4 네 개
  //   q0 = (뒤 왼쪽 xz, 뒤 오른쪽 xz)       뒤 = 먼바다 쪽 가장자리
  //   q1 = (앞 왼쪽 xz, 앞 오른쪽 xz)       앞 = 해안 쪽 가장자리
  //   q2 = (V 왼, V 오른, 강도 왼, 강도 오른)
  //   q3 = (중심 xz, 반지름², 활성)         정점이 멀면 역변환 없이 바로 건너뛰는 용도
  const quadBuf = instancedArray(KS * 4, 'vec4');

  // ── compute A: 스레드 하나 = 쿼드 하나 (K × S) ──
  // waveLUT에서 t_k 시각의 열 j-1 ~ j+2 마루 위치를 읽어 열마다 진행 방향(파면에 수직)을 구하고,
  // 마루를 앞뒤로 늘려 사각형을 만든다. 이웃 쿼드와 같은 열 데이터를 쓰니 모서리가 정확히 맞물린다.
  const back = CREST_U * W, fwd = (1 - CREST_U) * W;
  const computeQuads = Fn(() => {
    const i = int(instanceIndex);
    const k = i.div(int(S)), j = i.mod(int(S));
    const w = waveBuf.element(k);
    const tr = clamp(w.x.div(dtRow), 0, NT - 1);
    const i0 = int(floor(tr)), i1 = min(i0.add(1), int(NT - 1)), fr = tr.sub(float(i0));
    const col = c => min(max(c, int(0)), int(NS - 1));
    const lut = c => mix(lutBuf.element(i0.mul(NS).add(col(c))), lutBuf.element(i1.mul(NS).add(col(c))), fr);
    const sm = lut(j.sub(1)).toVar(), s0 = lut(j).toVar(), s1 = lut(j.add(1)).toVar(), s2 = lut(j.add(2)).toVar();
    // 파면 접선 (x, z) → 수직 = 진행 방향. 접선이 +x 쪽이면 (-tz, tx) = +z 쪽 (해안 쪽)
    const perp = v => normalize(vec2(v.y.negate(), v.x));
    const n0 = perp(s1.xy.sub(sm.xy)).toVar(), n1 = perp(s2.xy.sub(s0.xy)).toVar();
    const b0 = s0.xy.sub(n0.mul(back)), b1 = s1.xy.sub(n1.mul(back));
    const f0 = s0.xy.add(n0.mul(fwd)), f1 = s1.xy.add(n1.mul(fwd));
    const row = int(w.y).mul(NS);
    const str0 = varBuf.element(row.add(j)).mul(s0.w), str1 = varBuf.element(row.add(j).add(1)).mul(s1.w);
    const cen = b0.add(b1).add(f0).add(f1).mul(0.25).toVar();
    const d2 = v => dot(v.sub(cen), v.sub(cen));
    const r2 = max(max(d2(b0), d2(b1)), max(d2(f0), d2(f1))).add(1);
    const active = w.z.greaterThan(0.5).and(max(str0, str1).greaterThan(0.001)).and(min(s0.z, s1.z).lessThan(1.999));   // V = 2 → bore까지 다 사라짐
    const o = i.mul(4);
    quadBuf.element(o).assign(vec4(b0, b1));
    quadBuf.element(o.add(1)).assign(vec4(f0, f1));
    quadBuf.element(o.add(2)).assign(vec4(s0.z, s1.z, str0, str1));
    quadBuf.element(o.add(3)).assign(vec4(cen, r2, select(active, float(1), float(0))));
  })().compute(KS);

  // ── compute C: 스레드 하나 = 수면 정점 하나 ──
  // P8: 실험 토글 조합마다 커널을 따로 만든다 (처음 쓸 때 한 번 컴파일하고 캐시).
  //   bin  (E2): 쿼드 찾기 = 전체 순회 O(V·Q) / 타일 비닝 (정점은 자기 타일 목록만 본다)
  //   bary (E6): 쿼드 안 (a, u) = 쌍선형 역변환 / 두 삼각형의 무게중심 좌표
  //   diff (E4): 노멀 = derivTex로 해석적 계산 / 정점 위치를 다 만든 뒤 이웃 정점 차분 (커널 하나 더)
  const cr = (a, b) => a.x.mul(b.y).sub(a.y.mul(b.x));
  const UP = vec3(0, 1, 0);
  // bore 단면 모양 (u 단위): 앞 가장자리 UB, 뒤 오르막 길이 B_BACK, 앞 낙차 반폭 B_RISE
  const BORE_H = FRONT.BORE_H, UB = CREST_U + 0.04, B_BACK = 0.35, B_RISE = 0.04;
  const foamDecay = uniform(1);          // 프레임마다 exp(-dt / 거품 수명)

  // ── 타일 비닝 (E2, compute B): 수면 격자를 TILE m 칸으로 나누고, 쿼드마다 자기 AABB가 겹치는 타일 목록에 번호를 넣는다 ──
  const TILE = 8, TCAP = 64;
  const TX = Math.ceil((WATER.x1 - WATER.x0) / TILE), TZ = Math.ceil((WATER.z1 - WATER.z0) / TILE), NTILE = TX * TZ;
  const tileCnt = instancedArray(NTILE, 'uint').toAtomic();
  const tileList = instancedArray(NTILE * TCAP, 'uint');
  const tileOf = p => clamp(ivec2(floor(p.sub(vec2(WATER.x0, WATER.z0)).div(TILE))), ivec2(0, 0), ivec2(TX - 1, TZ - 1));
  const clearTiles = Fn(() => { atomicStore(tileCnt.element(instanceIndex), uint(0)); })().compute(NTILE);
  const binQuads = Fn(() => {
    const q = int(instanceIndex);
    const q3 = quadBuf.element(q.mul(4).add(3));
    If(q3.w.greaterThan(0.5), () => {
      const q0 = quadBuf.element(q.mul(4)), q1 = quadBuf.element(q.mul(4).add(1));
      const t0 = tileOf(min(min(q0.xy, q0.zw), min(q1.xy, q1.zw))).toVar();
      const t1 = tileOf(max(max(q0.xy, q0.zw), max(q1.xy, q1.zw))).toVar();
      Loop({ start: t0.y, end: t1.y, type: 'int', condition: '<=', name: 'tz' }, { start: t0.x, end: t1.x, type: 'int', condition: '<=', name: 'tx' }, ({ tz, tx }) => {
        const tid = tz.mul(TX).add(tx);
        const slot = atomicAdd(tileCnt.element(tid), uint(1));
        If(slot.lessThan(uint(TCAP)), () => { tileList.element(tid.mul(TCAP).add(int(slot))).assign(uint(q)); });
      });
    });
  })().compute(KS);
  // 타일마다 정점 수 (CPU, "정점당 검사 쿼드 수" 통계용)
  const vertsPerTile = new Float32Array(NTILE);
  for (let iz = 0; iz < L.GZ; iz++) {
    const tz = Math.min(Math.floor((L.zOf(iz) - WATER.z0) / TILE), TZ - 1);
    for (let tx = 0; tx < TX; tx++) {
      const x0 = WATER.x0 + tx * TILE, x1 = Math.min(x0 + TILE, WATER.x1 + 1e-6);
      vertsPerTile[tz * TX + tx] += Math.round((x1 - x0) / WATER.dx);
    }
  }

  const surfaceKernels = new Map();
  function makeSurface({ bin, bary, diff }) {
    return Fn(() => {
      const i = instanceIndex;
      const ix = i.mod(uint(GX));
      const iz = i.div(uint(GX));
      const x = float(ix).mul(WATER.dx).add(WATER.x0);
      const zc = float(iz).mul(WATER.dzCoarse).add(WATER.z0);
      const zf = float(iz.sub(uint(NC))).mul(WATER.dzFine).add(WATER.zFine);
      const z = select(iz.lessThan(uint(NC)), zc, zf);
      const p = vec2(x, z);

      const disp = vec3(0).toVar();
      const nAcc = vec3(0).toVar();          // 쿼드별 노멀의 "평평함에서 벗어난 양"을 더한다
      const foam = float(0).toVar();
      // 한 파면 안에서는 쿼드 하나만 쓴다. 이웃 쿼드가 공유하는 모서리 위 정점은 부동소수 오차로
      // 양쪽 모두에 들어갈 수 있는데, 그러면 변위가 두 번 더해져 가시처럼 튄다
      const hitWave = int(-1).toVar();

      const visit = q => {
        const q3 = quadBuf.element(q.mul(4).add(3));
        const dc = p.sub(q3.xy);
        const wq = q.div(int(S));
        If(q3.w.greaterThan(0.5).and(wq.notEqual(hitWave)).and(dot(dc, dc).lessThan(q3.z)), () => {
          const q0 = quadBuf.element(q.mul(4));
          const q1 = quadBuf.element(q.mul(4).add(1));
          const q2 = quadBuf.element(q.mul(4).add(2));
          const A = q0.xy, B = q0.zw, D = q1.xy, C = q1.zw;
          let u, a, ea, fa;
          if (!bary) {
            // 쌍선형 역변환: p = A + e·a + f·u + g·a·u 를 (a, u)에 대해 푼다 (u에 대한 2차식)
            const e = B.sub(A), f = D.sub(A), g = A.sub(B).add(C).sub(D), h = p.sub(A);
            const k2 = cr(g, f), k1 = cr(e, f).add(cr(h, g)), k0 = cr(h, e);
            const sq = sqrt(max(k1.mul(k1).sub(k0.mul(k2).mul(4)), 0));
            // 수치적으로 안정한 근 공식: k2 → 0(평행사변형)이어도 uA는 유한하다
            const qq = k1.add(select(k1.greaterThanEqual(0), sq, sq.negate())).mul(-0.5);
            const uA = k0.div(qq), uB = qq.div(k2);
            u = select(uA.greaterThanEqual(0).and(uA.lessThanEqual(1)), uA, uB).toVar();
            ea = e.add(g.mul(u)).toVar();                 // 파면 방향 (∂p/∂a)
            a = dot(h.sub(f.mul(u)), ea).div(dot(ea, ea)).toVar();
            fa = f.add(g.mul(a));                         // 가로지르는 방향 (∂p/∂u), 길이 ≈ W
          } else {
            // 두 삼각형 ABD, CDB. 삼각형 안에서는 (a, u)가 선형이라 2 × 2 연립만 풀면 된다 (2차식 없음)
            const h1 = p.sub(A), e1 = B.sub(A), e2 = D.sub(A);
            const d1 = cr(e1, e2);
            const a1 = cr(h1, e2).div(d1), u1 = cr(e1, h1).div(d1);
            const h2 = p.sub(C), e3 = D.sub(C), e4 = B.sub(C);   // p = C + s·(D − C) + r·(B − C), a = 1 − s, u = 1 − r
            const d2 = cr(e3, e4);
            const s2 = cr(h2, e4).div(d2), r2 = cr(e3, h2).div(d2);
            const in1 = a1.add(u1).lessThanEqual(1);
            a = select(in1, a1, float(1).sub(s2)).toVar();
            u = select(in1, u1, float(1).sub(r2)).toVar();
            ea = select(in1, e1, C.sub(D)).toVar();
            fa = select(in1, e2, C.sub(B)).toVar();
          }
          If(a.greaterThanEqual(0).and(a.lessThan(1)).and(u.greaterThanEqual(0)).and(u.lessThanEqual(1)), () => {
            const v = mix(q2.x, q2.y, a).toVar();
            const str = mix(q2.z, q2.w, a);
            // 텍셀 중심 보정: U=0, U=1이 정확히 첫/끝 텍셀 중심에 오게. V > 1(bore)은 단면이 평평한 마지막 줄
            const uv = vec2(u.mul((NU - 1) / NU).add(0.5 / NU), min(v, 1).mul((NV - 1) / NV).add(0.5 / NV));
            const def = texture(deformTex, uv).level(0);
            const Wl = length(fa);
            const nh = vec3(fa.x, 0, fa.y).div(Wl);

            // 무너진 뒤의 흰 물 띠(bore): 뒤에서 완만히 올라와 앞에서 급하게 떨어지는 계단
            // V 0.7 ~ 1에서 생기고, V > 1에서는 진폭 비율 = 2 - V (해안에 가까울수록 낮아짐)
            const isB = v.greaterThan(1);
            const bw = select(isB, float(1), smoothstep(0.7, 1.0, v));
            const bAmp = select(isB, float(2).sub(v), float(1)).mul(bw).mul(str).mul(BORE_H);
            const tb = clamp(u.sub(UB - B_BACK).div(B_BACK), 0, 1);           // 뒤쪽 오르막
            const tf = clamp(u.sub(UB - B_RISE).div(2 * B_RISE), 0, 1);       // 앞쪽 낙차
            const sb = tb.mul(tb).mul(tb.mul(-2).add(3)), sf = float(1).sub(tf.mul(tf).mul(tf.mul(-2).add(3)));
            const bH = bAmp.mul(sb.mul(sf));
            const bFoam = bw.mul(str).mul(sf).mul(smoothstep(UB - 0.25, UB - 0.03, u));

            disp.addAssign(nh.mul(def.x).add(vec3(0, def.y, 0)).mul(str).add(vec3(0, bH, 0)));
            if (!diff) {
              const der = texture(derivTex, uv).level(0);
              const dsb = tb.mul(float(1).sub(tb)).mul(6 / B_BACK), dsf = tf.mul(float(1).sub(tf)).mul(-6 / (2 * B_RISE));
              const bD = bAmp.mul(dsb.mul(sf).add(sb.mul(dsf)));                 // ∂높이/∂u (노멀용)
              const th = normalize(vec3(ea.x, 0, ea.y));
              const tu = nh.mul(Wl.add(der.x.mul(str))).add(vec3(0, der.y.mul(str).add(bD), 0));
              nAcc.addAssign(normalize(cross(tu, th)).sub(UP));  // (해안 쪽) × (+s 쪽) = 위
            }
            foam.assign(max(foam, max(def.z.mul(str), bFoam)));
            hitWave.assign(wq);
          });
        });
      };

      if (bin) {
        // 내 타일의 쿼드 목록만 본다
        const tt = tileOf(p);
        const tid = tt.y.mul(TX).add(tt.x).toVar();
        // toVar 필수: Loop의 end는 노드가 아닌 객체 안이라 three 분석이 atomicLoad의 사용처를 못 보고
        // 값 없는 문장으로 내보낸다 (end가 0u가 되어 루프가 한 번도 안 돈다)
        const n = min(atomicLoad(tileCnt.element(tid)), uint(TCAP)).toVar();
        Loop({ start: int(0), end: int(n), type: 'int', condition: '<' }, ({ i: k }) => {
          visit(int(tileList.element(tid.mul(TCAP).add(k))));
        });
      } else {
        // 전체 순회: 정점 하나가 쿼드 K×S개를 전부 검사한다 (O(V·Q), E2 기준선). 먼 쿼드는 원 검사로 바로 건너뜀
        Loop(KS, ({ i: q }) => visit(q));
      }

      posBuf.element(i).assign(vec3(x, 0, z).add(disp));
      if (!diff) nrmBuf.element(i).assign(normalize(UP.add(nAcc)));
      // 거품 잔상: 파도가 지나간 자리에 거품이 몇 초 남았다가 사라진다 (격자점이 xz에 고정이라 그 자리에 남는다)
      foamBuf.element(i).assign(max(foam, foamBuf.element(i).mul(foamDecay)));
    })().compute(COUNT);
  }
  function surface(cfg) {
    const key = `${+cfg.bin}${+cfg.bary}${+cfg.diff}`;
    if (!surfaceKernels.has(key)) surfaceKernels.set(key, makeSurface(cfg));
    return surfaceKernels.get(key);
  }
  // E4 이웃 차분 노멀: 정점 위치가 다 나온 뒤 격자 이웃 4개로 접선 두 개를 만들어 외적
  const computeNormalsDiff = Fn(() => {
    const i = int(instanceIndex);
    const ix = i.mod(GX), iz = i.div(GX);
    const at = (x, z) => posBuf.element(z.mul(GX).add(x));
    const tx = at(min(ix.add(1), GX - 1), iz).sub(at(max(ix.sub(1), 0), iz));
    const tz = at(ix, min(iz.add(1), L.GZ - 1)).sub(at(ix, max(iz.sub(1), 0)));
    nrmBuf.element(i).assign(normalize(cross(tz, tx)));   // (+z) × (+x) = 위
  })().compute(COUNT);

  // ── 로컬 시뮬 (P6~) + 합성 ──
  // 최종 높이 = 베이크 + 창 가중치 × 보호 × δ. 보호: 말린 부분(높이 솟음, 옆으로 크게 밀린 정점)에는 시뮬을 얹지 않는다.
  // 수직 오프셋을 overhang 위에 그대로 더하면 lip이 찢어진다
  // 시뮬 해상도(E8)를 바꾸면 시뮬 텍스처가 바뀌므로 재질과 탐침 커널을 새 시뮬로 다시 만든다
  const meshInfo = { GX, GZ: L.GZ, NC, x0: WATER.x0, x1: WATER.x1, dx: WATER.dx, zFine: WATER.zFine, z1: WATER.z1, dzFine: WATER.dzFine };
  const simOn = uniform(1);
  let sim = null, computeProbe = null;
  const makeComposite = s => (base, grid) => {
    const prot = float(1).sub(smoothstep(1.2, 2.0, base.y)).mul(float(1).sub(smoothstep(0.15, 0.5, length(base.xz.sub(grid)))));
    const w = s.weight(base.xz).mul(prot).mul(simOn);
    return { y: base.y.add(s.sample(base.xz).x.mul(w)), w };
  };

  // 조명은 shadeWater가 직접 계산하므로 라이트를 쓰지 않는 Basic 재질에 색만 꽂는다
  function makeMaterial(s) {
    const composite = makeComposite(s);
    const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, side: THREE.DoubleSide });
    const base = posBuf.element(vertexIndex);         // 렌더 패스가 컴퓨트 결과를 그대로 읽음
    const cmp = composite(base, attribute('position', 'vec3').xz);
    mat.positionNode = vec3(base.x, cmp.y, base.z);
    // 시뮬 물결은 정점 간격(0.5 m)보다 작을 수 있어서 노멀은 프래그먼트에서 시뮬 기울기로 직접 기울인다
    const vW = varying(cmp.w);
    const gS = s.sample(positionWorld.xz).yz.mul(vW);
    const nW = normalize(normalize(varying(nrmBuf.element(vertexIndex))).sub(vec3(gS.x, 0, gS.y)));
    const vFoam = varying(foamBuf.element(vertexIndex));
    const vHeight = varying(cmp.y);
    const bed = attribute('aBed', 'float');

    const nFace = select(frontFacing, nW, nW.negate());            // 튜브 안쪽(뒷면)은 노멀 반전
    const lift = smoothstep(0.3, 2.5, vHeight);                      // 솟아오른 정도 (마루·lip)
    const N = rippleNormal(nFace, positionWorld, float(1).sub(lift.mul(0.7)));
    const thickness = max(positionWorld.y.sub(bed), 0);
    // 물가 거품: 물이 얇아지는 해안선 근처에 늘 조금 있다
    const shoreFoam = float(1).sub(smoothstep(0.05, 0.6, thickness)).mul(0.7);
    const shade = shadeWater(N, positionWorld, thickness, max(vFoam, shoreFoam), lift);
    mat.colorNode = shade.col;
    mat.opacityNode = shade.alpha;
    return mat;
  }

  const mesh = new THREE.Mesh(geo);
  mesh.frustumCulled = false;  // 실제 위치는 버퍼에 있어서 geometry의 경계구를 믿을 수 없다

  function uploadWaves() {
    waves.slots.forEach((s, k) => {
      waveArr[k * 4] = s.t; waveArr[k * 4 + 1] = s.row; waveArr[k * 4 + 2] = s.active ? 1 : 0; waveArr[k * 4 + 3] = 0;
    });
    waveBuf.value.needsUpdate = true;
  }

  // 카메라가 따라갈 파도: 아직 다 무너지지 않은 것 중 가장 오래된 파도의 가운데 마루
  const mid = S / 2;
  function focus() {
    let best = null;
    for (const s of waves.slots) {
      if (!s.active) continue;
      const c = sampleLUT(lutInfo, s.t, mid);
      if (c[2] < 0.97 && (!best || s.t > best.t)) best = { t: s.t, x: c[0], z: c[1], v: c[2] };
    }
    return best;
  }

  // ── 수면 높이 탐침 (P5): 캐릭터 주변 3 × 3 정점 높이를 작은 버퍼에 모아 CPU가 비동기로 읽는다 ──
  // 정점 버퍼 전체(수 MB)가 아니라 9개만 복사해서 읽는다. 1~2프레임 늦은 값이지만 걷는 속도와 밀림에는 충분하다
  // 간격 1 m: x는 0.5 m × 2칸, z는 촘촘한 구간 0.125 m × 8칸
  const PX = 2, PZ = 8;
  const probeCenter = uniform(new THREE.Vector2(0, 0));    // 가운데 정점의 (ix, iz)
  const probeBuf = instancedArray(10, 'float');   // 0~8: 합성 수면 3 × 3, 9: 가운데 베이크만
  function makeProbe(s) {
    const composite = makeComposite(s);
    return Fn(() => {
      const t = int(instanceIndex);
      const ox = t.mod(3).sub(1).mul(PX), oz = t.div(3).sub(1).mul(PZ);
      const pix = int(probeCenter.x).add(ox), piz = int(probeCenter.y).add(oz);
      const idx = piz.mul(GX).add(pix);
      const grid = vec2(float(pix).mul(WATER.dx).add(WATER.x0), float(piz.sub(NC)).mul(WATER.dzFine).add(WATER.zFine));
      If(t.lessThan(9), () => {
        probeBuf.element(t).assign(composite(posBuf.element(idx), grid).y);   // 캐릭터도 렌더와 같은 수면을 느낀다
      }).Else(() => {
        // 시뮬을 뺀 수면: 몸이 잠긴 부피는 이걸로 잰다. 시뮬이 들어간 수면으로 재면 "물이 솟음 → 더 잠김 → 더 솟음" 되먹임으로 터진다
        const c0 = int(probeCenter.y).mul(GX).add(int(probeCenter.x));
        probeBuf.element(t).assign(posBuf.element(c0).y);
      });
    })().compute(10);
  }
  // (x, z)에 탐침을 놓는다. 촘촘한 구간 밖이면 false (그때는 잔잔한 수면 0을 쓴다)
  function probeAt(x, z) {
    const ix = Math.round((x - WATER.x0) / WATER.dx);
    const iz = NC + Math.round((z - WATER.zFine) / WATER.dzFine);
    if (ix < PX || ix > GX - 1 - PX || iz < NC + PZ || iz > L.GZ - 1 - PZ) return false;
    probeCenter.value.set(ix, iz);
    return true;
  }

  // 시뮬 (재)생성: 해상도 프리셋(E8)이 바뀔 때마다. 모델·실행 옵션은 이어받는다
  function setSim({ N, DX }) {
    const old = sim;
    sim = createSim({ posBuf, mesh: meshInfo, N, DX });
    if (old) { sim.model = old.model; sim.dtMode = old.dtMode; sim.skipCalm = old.skipCalm; }
    const oldMat = mesh.material;
    mesh.material = makeMaterial(sim);
    if (oldMat && oldMat.dispose) oldMat.dispose();
    computeProbe = makeProbe(sim);
    if (old) old.dispose();
  }
  setSim({ N: SIM.N, DX: SIM.DX });

  return {
    mesh, computeQuads, waves, uploadWaves, focus, layout: L, posBuf, lutInfo, foamDecay,
    clearTiles, binQuads, surface, computeNormalsDiff, tileCnt, tileList, quadBuf, vertsPerTile, NTILE, TILE, TX, TZ,
    probeBuf, probeAt, simOn, setSim,
    get sim() { return sim; },
    get computeProbe() { return computeProbe; },
    S, K, KS,
    triCount: (L.GX - 1) * (L.GZ - 1) * 2,
    dispose() { deformTex.dispose(); derivTex.dispose(); sim.dispose(); },
  };
}

// 수면 격자 밖 먼 바다: 격자를 ㄷ자로 둘러싼 불투명 띠 (격자와 겹치지 않게)
function buildFarSea() {
  // 격자 수면과 같은 셰이딩 (평평하고 깊은 물): 이음매에서 색이 튀지 않게
  const mat = new THREE.MeshBasicNodeMaterial();
  const sh = shadeWater(rippleNormal(vec3(0, 1, 0), positionWorld), positionWorld, float(14), float(0), float(0));
  mat.colorNode = sh.col;
  const g = new THREE.Group();
  const R = 2000, { x0, x1, z0, z1 } = WATER;
  const strip = (ax, bx, az, bz) => {
    const geo = new THREE.PlaneGeometry(bx - ax, bz - az);
    geo.rotateX(-Math.PI / 2);
    geo.translate((ax + bx) / 2, 0, (az + bz) / 2);
    g.add(new THREE.Mesh(geo, mat));
  };
  strip(-R, R, -R, z0);      // 앞바다
  strip(-R, x0, z0, z1);     // 왼쪽 (곶 지형이 위를 덮는다)
  strip(x1, R, z0, z1);      // 오른쪽
  return g;
}

// ── 간단한 궤도 카메라 (OrbitControls는 'three' 빌드에 묶여 있어서 직접 만든다) ──
function createOrbit(camera, dom, target) {
  const sph = new THREE.Spherical().setFromVector3(camera.position.clone().sub(target));
  let dragging = false, lx = 0, ly = 0;
  const ctl = { enabled: true };
  const apply = () => {
    sph.phi = Math.min(Math.max(sph.phi, 0.15), Math.PI / 2 - 0.02);
    sph.radius = Math.min(Math.max(sph.radius, 4), 250);
    camera.position.setFromSpherical(sph).add(target);
    // 지형(사구) 속으로 들어가지 않게: 카메라 높이를 지면 + 1.5 m 이상으로
    const p = camera.position;
    p.y = Math.max(p.y, terrainHeight(p.x, p.z) + 1.5, 0.5);
    camera.lookAt(target);
  };
  const down = e => { if (!ctl.enabled) return; dragging = true; lx = e.clientX; ly = e.clientY; dom.setPointerCapture(e.pointerId); };
  const move = e => {
    if (!dragging || !ctl.enabled) return;
    sph.theta -= (e.clientX - lx) * 0.005;
    sph.phi   -= (e.clientY - ly) * 0.005;
    lx = e.clientX; ly = e.clientY; apply();
  };
  const up = () => { dragging = false; };
  const wheel = e => { if (!ctl.enabled) return; e.preventDefault(); sph.radius *= Math.exp(e.deltaY * 0.001); apply(); };
  dom.addEventListener('pointerdown', down);
  dom.addEventListener('pointermove', move);
  dom.addEventListener('pointerup', up);
  dom.addEventListener('wheel', wheel, { passive: false });
  apply();
  return Object.assign(ctl, {
    refresh: apply,
    // 회전 중심을 옮긴다 (각도·거리는 유지). 파도 따라가기에 쓴다
    setTarget(x, y, z) { target.set(x, y, z); apply(); },
    // 시점 프리셋: theta = 수평 방위(0 = +z 쪽에서 봄), phi = 천정각, radius = 거리
    setView(theta, phi, radius) { sph.theta = theta; sph.phi = phi; sph.radius = radius; apply(); },
    dispose() {
      dom.removeEventListener('pointerdown', down);
      dom.removeEventListener('pointermove', move);
      dom.removeEventListener('pointerup', up);
      dom.removeEventListener('wheel', wheel);
    },
  });
}

function createHud(canvas) {
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;left:16px;top:56px;z-index:5;font:12px/1.6 ui-monospace,Consolas,monospace;'
    + 'color:#cfd6e6;background:rgba(10,12,20,0.6);border:1px solid rgba(34,211,238,0.18);'
    + 'border-radius:8px;padding:7px 12px;pointer-events:none;white-space:pre';
  canvas.parentElement.appendChild(el);
  return el;
}

// ── GPU 시간 측정 (P8): 컴퓨트 호출마다 타임스탬프 쿼리 uid를 라벨과 같이 기록해 두고,
// 다음 프레임에 resolveTimestampsAsync로 풀어서 라벨별 ms를 지수 평균한다 ──
function createProfiler(renderer) {
  const backend = renderer.backend;
  const prof = { on: !!(backend && backend.isWebGPUBackend && backend.trackTimestamp), ema: {}, render: 0 };
  let frame = [], queue = [], busy = false;
  const A = 0.05;    // 지수 평균 가중치 (약 20프레임)
  prof.run = (node, label) => {
    renderer.compute(node);
    if (!prof.on) return;
    const d = backend.get(node);
    if (d && d.timestampUID) frame.push([d.timestampUID, label]);
  };
  // 프레임 시작에 호출: 지난 프레임까지 기록한 쿼리를 푼다 (한 번에 하나만)
  prof.tick = () => {
    if (!prof.on) return;
    queue.push(frame); frame = [];
    if (busy) return;
    busy = true;
    const batch = queue; queue = [];
    Promise.all([renderer.resolveTimestampsAsync('compute'), renderer.resolveTimestampsAsync('render')]).then(([, r]) => {
      const pool = backend.timestampQueryPool.compute;
      for (const fr of batch) {
        if (!fr.length) continue;
        const per = {};
        for (const [uid, label] of fr) if (pool.timestamps.has(uid)) per[label] = (per[label] || 0) + pool.timestamps.get(uid);
        for (const k of new Set([...Object.keys(prof.ema), ...Object.keys(per)])) prof.ema[k] = (prof.ema[k] || 0) * (1 - A) + (per[k] || 0) * A;
      }
      pool.timestamps.clear();                   // three는 uid마다 쌓아 두기만 해서 직접 비운다
      const rp = backend.timestampQueryPool.render;
      if (rp) rp.timestamps.clear();
      if (typeof r === 'number' && isFinite(r)) prof.render = prof.render * (1 - A) + r * A;
    }).catch(() => {}).finally(() => { busy = false; });
  };
  return prof;
}

// 측정 패널 (P8): 패스별 GPU ms + 실험 토글 버튼
const SIM_PRESETS = [
  { N: 64, DX: 0.25, label: '64² × 0.25 m (16 m)' },
  { N: 128, DX: 0.25, label: '128² × 0.25 m (32 m)' },
  { N: 256, DX: 0.25, label: '256² × 0.25 m (64 m)' },
  { N: 256, DX: 0.125, label: '256² × 0.125 m (32 m)' },
];
function createPanel(canvas, onClick) {
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;right:16px;top:56px;z-index:5;font:12px/1.55 ui-monospace,Consolas,monospace;'
    + 'color:#cfd6e6;background:rgba(10,12,20,0.72);border:1px solid rgba(34,211,238,0.18);border-radius:8px;padding:7px 12px;width:330px';
  el.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center"><b style="color:#22d3ee">측정 (P8)</b>'
    + '<button data-x="fold" style="font:inherit;background:none;border:0;color:#8aa;cursor:pointer">접기</button></div>'
    + '<pre data-x="times" style="margin:4px 0;white-space:pre"></pre><div data-x="exps"></div>';
  el.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.x === 'fold') {
      const body = [el.querySelector('[data-x=times]'), el.querySelector('[data-x=exps]')];
      const hide = body[0].style.display !== 'none';
      body.forEach(n => { n.style.display = hide ? 'none' : ''; });
      b.textContent = hide ? '펼치기' : '접기';
    } else if (b.dataset.e) onClick(b.dataset.e);
    canvas.focus();     // 버튼을 눌러도 키 입력은 계속 캔버스로
  });
  canvas.parentElement.appendChild(el);
  // 화면이 좁으면 왼쪽 HUD와 겹치니 접은 채로 시작한다
  if (canvas.parentElement.clientWidth < 1000) el.querySelector('[data-x=fold]').click();
  return {
    el,
    times: el.querySelector('[data-x=times]'),
    setExps(rows) {
      el.querySelector('[data-x=exps]').innerHTML = rows.map(([id, name, val, on]) => on === null
        ? `<div style="color:#667">${id} ${name}: ${val}</div>`
        : `<div style="display:flex;justify-content:space-between;gap:8px"><span>${id} ${name}</span>`
          + `<button data-e="${id}" style="font:inherit;cursor:pointer;border-radius:4px;border:1px solid rgba(34,211,238,0.35);`
          + `background:${on ? 'rgba(34,211,238,0.18)' : 'transparent'};color:#e6edf6;padding:0 6px">${val}</button></div>`).join('');
    },
  };
}

export default {
  async create({ renderer, canvas }) {
    const scene = new THREE.Scene();
    scene.backgroundNode = skyColor(positionWorldDirection);   // 물 반사와 같은 하늘 함수
    scene.fog = new THREE.Fog(HORIZON_HEX, 220, 900);

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 3000);
    // 시작 시점: 파도 마루를 따라가며 옆·앞에서 낮게 (말린 안쪽이 보이는 각도). F로 끄고 켠다
    const target = new THREE.Vector3(0, 1.5, -150);
    camera.position.set(-16, 4.5, -140);

    scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x8a7a5a, 1.1));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    sun.position.set(SUN.x, SUN.y, SUN.z);   // 바다 쪽에서 비치는 역광 (물 셰이딩과 같은 방향)
    scene.add(sun);

    const section = buildSectionTextures();
    const terrain = buildTerrain();
    const water = buildWater(section);
    const farSea = buildFarSea();
    scene.add(terrain, water.mesh, farSea);

    const orbit = createOrbit(camera, canvas, target);
    orbit.setView(-1.25, 1.42, 26);

    // P5: 3인칭 캐릭터. 만 가운데 마른 모래 위에서 바다를 보고 시작한다
    const player = createPlayer(0, 16);
    scene.add(player.object);
    const tps = createThirdPerson(camera, canvas);
    // V로 전환: 'char' = 캐릭터 + 3인칭 카메라, 'orbit' = 관찰용 궤도 카메라 (P1~P4 시점)
    let mode = 'char';
    const setMode = m => {
      mode = m;
      tps.enabled = m === 'char';
      orbit.enabled = m === 'orbit';
      if (m === 'orbit') { tps.release(); orbit.refresh(); } else tps.snap();
    };
    setMode('char');
    // 캐릭터 발밑 수면 (GPU 탐침에서 비동기로 받아 옴): 높이 h, 기울기 (gx, gz)
    const water0 = { h: 0, gx: 0, gz: 0, bake: 0 };
    let wl = water0, probePending = false, probeOn = false, disposed = false;

    const backend = renderer.backend && renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2 (WebGPU 미지원 폴백)';
    const hud = createHud(canvas);
    const prof = createProfiler(renderer);
    // 실험 상태 (P8). 비닝은 결과가 전체 순회와 정점 단위로 같고 C가 약 6배 빨라서 기본으로 켠다. 나머지는 원래 방식
    const cfg = { bin: true, bary: false, diff: false, preset: 1 };
    let tileAvg = null, tileMax = 0, tileT = 0, tilePending = false;
    const panel = createPanel(canvas, id => {
      const sim = water.sim;
      if (id === 'E2') cfg.bin = !cfg.bin;
      else if (id === 'E4') cfg.diff = !cfg.diff;
      else if (id === 'E6') cfg.bary = !cfg.bary;
      else if (id === 'E7') sim.setModel(sim.model === 'swe' ? 'linear' : 'swe');
      else if (id === 'E8') { cfg.preset = (cfg.preset + 1) % SIM_PRESETS.length; water.setSim(SIM_PRESETS[cfg.preset]); }
      else if (id === 'E9') sim.dtMode = sim.dtMode === 'fixed' ? 'variable' : 'fixed';
      else if (id === 'E11') { sim.skipCalm = !sim.skipCalm; sim.energy = 1e9; }
      prof.ema = {};     // 설정이 바뀌면 평균을 새로 잰다
      tileAvg = null;
      refreshExps();
    });
    function refreshExps() {
      const sim = water.sim;
      panel.setExps([
        ['E1', 'Coons 매 프레임', '미구현 (경로 추적이 CPU 적분)', null],
        ['E2', '쿼드 찾기', cfg.bin ? '타일 비닝' : '전체 순회', cfg.bin],
        ['E3', '파면 근처 LOD', '미구현', null],
        ['E4', '노멀', cfg.diff ? '이웃 차분' : '해석적', cfg.diff],
        ['E5', '정점 셰이더 변위', '미구현', null],
        ['E6', '쿼드 안 좌표', cfg.bary ? '삼각형 무게중심' : '쌍선형 역변환', cfg.bary],
        ['E7', '시뮬 모델', sim.model === 'swe' ? 'SWE' : '선형 파동', sim.model === 'linear'],
        ['E8', '시뮬 창', SIM_PRESETS[cfg.preset].label, cfg.preset !== 1],
        ['E9', '서브스텝', sim.dtMode === 'fixed' ? '고정 dt 누적기' : '가변 dt', sim.dtMode !== 'fixed'],
        ['E10', '공유 메모리 타일', '미구현', null],
        ['E11', '잔잔하면 건너뜀', sim.skipCalm ? '켬 (선형만)' : '끔', sim.skipCalm],
      ]);
    }
    refreshExps();
    let hudT = 0, frames = 0, fpsT = 0, fps = 0;
    let foc = water.focus();
    const camT = new THREE.Vector3(foc ? foc.x : 0, 1.5, foc ? foc.z : -150);

    // 관찰용 시간 조절: Space = 일시정지, 1/2/3 = 0.25x/1x/2x
    let paused = false, timeScale = 1, follow = true;
    // C로 돌아가는 시점: 앞·옆 비스듬히 / 옆에서 단면 / 높은 곳에서 비스듬히 / 먼바다 위에서 만 전체 (파면이 휘는 모양과 gap)
    const VIEWS = [[-1.25, 1.42, 26], [-Math.PI / 2, 1.5, 22], [-0.5, 0.95, 150], [Math.PI, 0.7, 210]];
    let view = 0;
    const onKey = e => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.code === 'Space') { paused = !paused; e.preventDefault(); }
      else if (e.key === '1') timeScale = 0.25;
      else if (e.key === '2') timeScale = 1;
      else if (e.key === '3') timeScale = 2;
      else if (e.code === 'KeyV') setMode(mode === 'char' ? 'orbit' : 'char');
      else if (e.code === 'KeyN') water.simOn.value = water.simOn.value > 0.5 ? 0 : 1;
      else if (e.code === 'KeyM') { water.sim.setModel(water.sim.model === 'swe' ? 'linear' : 'swe'); refreshExps(); }
      else if (mode !== 'orbit') return;
      else if (e.code === 'KeyF') follow = !follow;
      else if (e.code === 'KeyC') { view = (view + 1) % VIEWS.length; orbit.setView(...VIEWS[view]); }
    };
    window.addEventListener('keydown', onKey);

    // ?debug 일 때만: P 키 = GPU 정점 버퍼를 읽어 x = 0 단면을 <pre id="ocean-debug">에 JSON으로 쓴다
    const debug = /[?&]debug/.test(location.search);
    const onDebugKey = async e => {
      if (!debug || e.code !== 'KeyP') return;
      const a = new Float32Array(await renderer.getArrayBufferAsync(water.posBuf.value));
      const Lw = water.layout, stride = a.length / Lw.COUNT, ix = Math.round(-WATER.x0 / WATER.dx);
      const pts = [];
      for (let iz = 0; iz < Lw.GZ; iz++) { const k = (iz * Lw.GX + ix) * stride; pts.push([+a[k + 2].toFixed(3), +a[k + 1].toFixed(3)]); }
      let el = document.getElementById('ocean-debug');
      if (!el) { el = document.createElement('pre'); el.id = 'ocean-debug'; el.style.display = 'none'; document.body.appendChild(el); }
      el.textContent = JSON.stringify({ v: foc && foc.v, zCrest: foc && foc.z, stride, pts });
    };
    window.addEventListener('keydown', onDebugKey);
    // ?debug: 콘솔·자동 검증용 핸들 (시뮬 버퍼 읽기 등)
    if (debug) window.__ocean = { renderer, water, player, tps, get wl() { return wl; }, setMode, cfg, prof, refreshExps };

    return {
      scene, camera,
      update(dt) {
        dt = Math.min(dt, 0.1);
        const simDt = paused ? 0 : dt * timeScale;

        // 입력 → 캐릭터 이동 (직전에 받아 둔 수면 사용) → 카메라
        if (!probeOn) wl = water0;
        if (mode === 'char') {
          player.update(dt, tps.input(), tps.yaw, wl);
          tps.update(dt, player.pos, wl.h);
        } else {
          player.update(dt, { f: 0, r: 0, run: false }, tps.yaw, wl);   // 관찰 중에도 파도에 밀리긴 한다
        }
        prof.tick();
        water.waves.step(simDt);
        water.uploadWaves();
        water.foamDecay.value = Math.exp(-simDt / 3.5);   // 거품 수명 약 3.5초
        prof.run(water.computeQuads, 'A');                // A: waveLUT → 쿼드
        if (cfg.bin) { prof.run(water.clearTiles, 'B'); prof.run(water.binQuads, 'B'); }   // B: 타일 비닝 (E2)
        prof.run(water.surface(cfg), 'C');                // C: 쿼드 → 수면 정점
        if (cfg.diff) prof.run(water.computeNormalsDiff, 'C');   // E4: 이웃 차분 노멀도 C에 넣어 잰다
        // S: 로컬 시뮬. 창 = 캐릭터 주변, 몸 소스 = 다리·몸통이 잠긴 부피 (직전 수면 기준)
        water.sim.setFrame(player.pos.x, player.pos.z, player.sources(probeOn ? wl.bake : 0));
        water.sim.run(renderer, simDt, prof.run);
        // E2 통계: 정점 하나가 검사하는 쿼드 수 평균 (타일 목록 길이를 타일 안 정점 수로 가중 평균)
        tileT += dt;
        if (cfg.bin && tileT > 0.5 && !tilePending) {
          tileT = 0; tilePending = true;
          renderer.getArrayBufferAsync(water.tileCnt.value).then(b => {
            tilePending = false;
            const c = new Uint32Array(b);
            let sum = 0, mx = 0;
            for (let i = 0; i < water.NTILE; i++) { sum += Math.min(c[i], 64) * water.vertsPerTile[i]; mx = Math.max(mx, c[i]); }
            tileAvg = sum / water.layout.COUNT; tileMax = mx;
          }).catch(() => { tilePending = false; });
        }

        // 캐릭터 발밑 수면 탐침: 한 번에 하나만 읽기 요청을 걸어 둔다 (GPU를 기다리지 않음)
        probeOn = water.probeAt(player.pos.x, player.pos.z);
        if (probeOn && !probePending) {
          prof.run(water.computeProbe, 'P');
          probePending = true;
          renderer.getArrayBufferAsync(water.probeBuf.value).then(buf => {
            probePending = false;
            if (disposed) return;
            const a = new Float32Array(buf);
            // 3 × 3, 행 = z(-1, 0, +1), 열 = x(-1, 0, +1), 간격 1 m → 중앙 차분
            // 높이는 바깥 8점 평균 (가운데 칸은 다리 장애물이라 물이 멈춰 있을 수 있다. 기울기가 고르면 가운데 값과 같다)
            const ring = (a[0] + a[1] + a[2] + a[3] + a[5] + a[6] + a[7] + a[8]) / 8;
            wl = { h: ring, gx: (a[5] - a[3]) / 2, gz: (a[7] - a[1]) / 2, bake: a[9] };
            // 시뮬이 터지면(E9 가변 dt에서 CFL 초과) NaN이 캐릭터 위치까지 번진다. 유한하지 않은 값은 버린다
            if (![wl.h, wl.gx, wl.gz, wl.bake].every(Number.isFinite)) wl = water0;
          }).catch(() => { probePending = false; });
        }

        foc = water.focus();
        if (mode === 'orbit' && follow && foc) {
          // 따라가던 파도가 다 무너지면 다음 파도로 넘어가는데, 그때 카메라가 튀지 않게 부드럽게 옮긴다
          camT.lerp(new THREE.Vector3(foc.x, 1.5, foc.z), 1 - Math.exp(-dt * 3));
          orbit.setTarget(camT.x, camT.y, camT.z);
        }

        frames++; fpsT += dt; hudT += dt;
        if (fpsT >= 0.5) { fps = frames / fpsT; frames = 0; fpsT = 0; }
        if (hudT >= 0.2) {
          hudT = 0;
          const alive = water.waves.slots.filter(s => s.active).length;
          hud.textContent = [
            `backend   ${backend}   ${fps.toFixed(0)} fps`,
            `수면      정점 ${water.layout.COUNT.toLocaleString()} · 삼각형 ${water.triCount.toLocaleString()}`,
            `파면      ${alive}/${water.K}개 · 쿼드 ${water.KS} (${water.K} × ${water.S})`,
            `따라가는 파도  t ${foc ? foc.t.toFixed(1) : '-'} / ${water.lutInfo.T.toFixed(1)} s   crest z ${foc ? foc.z.toFixed(1) : '-'} m   V 가운데 ${foc ? foc.v.toFixed(2) : '-'}`,
            `시간      ${paused ? '일시정지' : timeScale + 'x'}   (Space 정지 · 1/2/3 = 0.25x/1x/2x)`,
            mode === 'char'
              ? `카메라    3인칭 ${tps.locked() ? '(마우스 잠김 · Esc 해제)' : tps.focused() ? '(드래그 회전)' : '(화면 클릭하면 조작 시작)'}   V 관찰 모드`
              : `카메라    관찰 · ${follow ? '파도 따라가기' : '자유'}   (F 따라가기 · C 시점 · 드래그 회전 · 휠 줌 · V 캐릭터)`,
            `캐릭터    (${player.pos.x.toFixed(1)}, ${player.pos.z.toFixed(1)})  지면 ${player.pos.y.toFixed(2)} m · 수면 ${probeOn ? wl.h.toFixed(2) : '0.00'} m`
              + ` · 수심 ${player.depth.toFixed(2)} m · 속도 ×${player.wade.toFixed(2)} · ${player.vel.length().toFixed(1)} m/s`
              + (player.push > 0.05 ? ` · 밀림 ${player.push.toFixed(1)} m/s` : '')
              + (player.blocked ? ` · 막힘(${{ deep: '깊음', slope: '경사', bounds: '경계' }[player.blocked]})` : ''),
            `          WASD 이동 · Shift 달리기 · 휠 거리`,
            `시뮬      ${water.simOn.value > 0.5 ? water.sim.model : '끔'} · ${water.sim.N}² 셀 × ${water.sim.DX} m (창 ${water.sim.N * water.sim.DX} m) · 서브스텝 ${water.sim.steps} (dt ${(SIM.STEP * 1000).toFixed(1)} ms)   N 켜기/끄기 · M 모델`,
          ].join('\n');
          const e = prof.ema, ms = k => (e[k] || 0).toFixed(3).padStart(6);
          const sim = water.sim;
          const tot = ['A', 'B', 'C', 'S', 'P'].reduce((a, k) => a + (e[k] || 0), 0);
          panel.times.textContent = (prof.on ? [
            `GPU ms    A ${ms('A')}   B ${ms('B')}`,
            `          C ${ms('C')}   S ${ms('S')}`,
            `          탐침 ${ms('P')}   렌더 ${prof.render.toFixed(3).padStart(6)}`,
            `          컴퓨트 합 ${tot.toFixed(3)} · 전체 ${(tot + prof.render).toFixed(3)}`,
          ] : ['GPU 타임스탬프 없음 (timestamp-query 미지원)']).concat([
            `FPS       ${fps.toFixed(0)}`,
            `정점당 검사 쿼드  ${cfg.bin ? (tileAvg === null ? '…' : tileAvg.toFixed(1) + ` (타일 최대 ${tileMax})`) : water.KS + ' (전체)'}`,
            `시뮬      ${sim.N}² × 서브스텝 ${sim.steps} = ${(sim.N * sim.N * sim.steps).toLocaleString()} 셀 갱신`
              + (sim.skipCalm && sim.model === 'linear' ? `\n          에너지 ${sim.energy > 1e8 ? '-' : sim.energy.toFixed(2)} ${sim.skipped ? '· 건너뜀' : ''}` : ''),
          ]).join('\n');
        }
      },
      dispose() {
        disposed = true;
        orbit.dispose();
        tps.dispose();
        player.dispose();
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('keydown', onDebugKey);
        document.getElementById('ocean-debug')?.remove();
        if (window.__ocean) delete window.__ocean;
        hud.remove();
        panel.el.remove();
        water.dispose();
        scene.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose();
        });
      },
    };
  },
};
