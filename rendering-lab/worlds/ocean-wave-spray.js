// Ocean Wave · lip 물보라 입자 (Q1-5)
// 말리는 lip과 bore 앞쪽에서 작은 물방울을 뿜는다. 찢어진 lip 가장자리에 부피를 주는 용도.
//
// 상태: 입자마다 pos = (x, y, z, 남은 수명), vel = (vx, vy, vz, 크기). 컴퓨트 하나가 매 프레임
//   - 살아 있으면: 중력 + 공기 저항으로 움직이고 수명을 줄인다
//   - 죽어 있으면: 쿼드 하나를 무작위로 골라, 그 자리 lip(또는 bore)이 거셀수록 높은 확률로 다시 태어난다
// 그래서 따로 "생성 목록"이 없다. 죽은 입자가 스스로 빈자리를 채우는 구조라 원자 연산도 필요 없다.
// 렌더는 Sprite 하나를 count개 인스턴스로 그린다(정점 셰이더가 버퍼를 직접 읽음)
import * as THREE from 'three/webgpu';
import {
  Fn, instanceIndex, instancedArray, uniform, float, int, vec2, vec3, vec4, fract, sin, mix, min, max,
  smoothstep, select, If, length, normalize, texture, exp, uv, saturate, dot,
} from 'three/tsl';
import { SUN_DIR } from './ocean-wave-shading.js';

export const SPRAY = {
  COUNT: 24000,
  EMIT: 0.012,            // 죽은 입자가 이번 프레임 다시 태어날 기본 확률 (lip 세기를 곱한다)
  DRAG: 1.4,              // 공기 저항 (1/s)
};

// quadBuf: compute A 결과 (쿼드마다 vec4 4개), deformTex: 단면 변형, W: 단면 폭
export function createSpray({ quadBuf, KS, deformTex, NU, NV, W, CREST_U, UB }) {
  const N = SPRAY.COUNT;
  const pos = instancedArray(N, 'vec4');
  const vel = instancedArray(N, 'vec4');
  const dtU = uniform(0);
  const seed = uniform(0);
  const on = uniform(1);

  const rnd = (a, b) => fract(sin(a.mul(12.9898).add(float(b).mul(78.233)).add(seed.mul(0.6180339))).mul(43758.5453));

  const step = Fn(() => {
    const i = int(instanceIndex);
    const fi = float(i);
    const p = pos.element(i), v = vel.element(i);
    If(p.w.greaterThan(0), () => {
      // (WGSL은 .xyz 같은 여러 성분 대입을 못 해서 vec4 통째로 쓴다)
      const nv = v.xyz.add(vec3(0, -9.81, 0).mul(dtU)).mul(exp(dtU.mul(-SPRAY.DRAG))).toVar();
      const np = p.xyz.add(nv.mul(dtU)).toVar();
      // 수면(대략 y = 0) 아래로 떨어지면 일찍 죽인다
      const life = select(np.y.lessThan(-0.3), float(0), p.w.sub(dtU));
      v.assign(vec4(nv, v.w));
      p.assign(vec4(np, life));
    }).Else(() => {
      If(on.greaterThan(0.5), () => {
        // 쿼드 하나, 파면 방향 위치 a 하나를 고른다
        const q = int(rnd(fi, 1.3).mul(KS));
        const o = q.mul(4);
        const q2 = quadBuf.element(o.add(2)), q3 = quadBuf.element(o.add(3));
        const a = rnd(fi, 2.7);
        const V = mix(q2.x, q2.y, a), str = mix(q2.z, q2.w, a);
        // lip: 말려 떨어지는 동안(V 0.5 ~ 0.85) 가장 거세다. bore: 앞쪽에서 약하게
        const lipR = smoothstep(0.48, 0.56, V).mul(float(1).sub(smoothstep(0.78, 0.92, V)));
        const boreR = smoothstep(0.95, 1.05, V).mul(float(1).sub(smoothstep(1.4, 1.8, V))).mul(0.35);
        const rate = lipR.add(boreR).mul(str).mul(select(q3.w.greaterThan(0.5), float(1), float(0)));
        If(rnd(fi, 4.1).lessThan(rate.mul(SPRAY.EMIT)), () => {
          const isLip = lipR.greaterThan(boreR);
          // 쿼드 안 위치 (a, u). lip은 마루 근처, bore는 앞 가장자리
          const u = select(isLip, rnd(fi, 5.9).mul(0.08).add(CREST_U - 0.02), float(UB).sub(rnd(fi, 6.3).mul(0.04)));
          const q0 = quadBuf.element(o), q1 = quadBuf.element(o.add(1));
          const A = q0.xy, B = q0.zw, D = q1.xy, C = q1.zw;
          const e = B.sub(A), f = D.sub(A), g = A.sub(B).add(C).sub(D);
          const base = A.add(e.mul(a)).add(f.mul(u)).add(g.mul(a.mul(u)));
          const fa = f.add(g.mul(a));
          const nh = normalize(fa);                       // 해안 쪽 (파도 진행 방향)
          const th = normalize(e.add(g.mul(u)));          // 파면 방향
          const def = texture(deformTex, vec2(u.mul((NU - 1) / NU).add(0.5 / NU), min(V, 1).mul((NV - 1) / NV).add(0.5 / NV))).level(0);
          const h = select(isLip, def.y.mul(str), str.mul(float(2).sub(V)).mul(0.6));
          const ph = base.add(nh.mul(select(isLip, def.x.mul(str), float(0))));
          p.assign(vec4(ph.x, h.add(0.05), ph.y, rnd(fi, 7.7).mul(0.8).add(0.5)));
          // 앞으로 3 ~ 6.5 m/s, 위로 1 ~ 4 m/s, 옆으로 조금. bore는 더 낮고 느리게
          const fwd = rnd(fi, 8.3).mul(3.5).add(3).mul(select(isLip, float(1), float(0.6)));
          const upv = rnd(fi, 9.1).mul(3).add(1).mul(select(isLip, float(1), float(0.5)));
          const side = rnd(fi, 10.7).sub(0.5).mul(1.6);
          const hv = nh.mul(fwd).add(th.mul(side));
          v.assign(vec4(hv.x, upv, hv.y, rnd(fi, 11.9).mul(0.12).add(0.05)));
        });
      });
    });
  })().compute(N);

  // ── 렌더: 부드러운 원 스프라이트 ──
  const mat = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false });
  const P = pos.element(instanceIndex), Vv = vel.element(instanceIndex);
  mat.positionNode = P.xyz;
  const alive = select(P.w.greaterThan(0), float(1), float(0));
  mat.scaleNode = Vv.w.mul(alive).mul(smoothstep(0.0, 0.25, P.w).mul(0.5).add(0.5));
  const L = vec3(...SUN_DIR);
  // 물방울은 해를 등지고 보면 밝게 빛난다. 바탕은 거품과 같은 흰색
  const lit = float(0.75).add(saturate(L.y).mul(0.25));
  mat.colorNode = vec3(0.93, 0.96, 0.98).mul(lit);
  const d = length(uv().sub(0.5));
  mat.opacityNode = smoothstep(0.5, 0.15, d).mul(smoothstep(0.0, 0.3, P.w)).mul(0.85);
  const mesh = new THREE.Sprite(mat);
  mesh.count = N;
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;

  let frame = 0;
  return {
    mesh, step, N,
    get on() { return on.value > 0.5; },
    set on(v) { on.value = v ? 1 : 0; },
    update(dt) { dtU.value = dt; seed.value = (frame++ % 9973) + 1; },
    // 살아 있는 입자 수 (디버그)
    pos,
    dispose() { mat.dispose(); },
  };
}
