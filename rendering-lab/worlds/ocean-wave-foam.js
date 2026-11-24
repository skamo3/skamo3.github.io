// Ocean Wave · 거품 디테일 (Q1)
// 정점 거품값(x 0.5 m · z 0.125 m 간격 보간)보다 가는 무늬는 여기서 프래그먼트마다 만든다.
//
// 거품 세 종류 (compute C가 따로 써 준다)
//   lip  : 말리는 lip과 파도 면. 파면 좌표(s 파면 방향, u 가로지르는 방향)로 찍어서 파도와 같이 움직인다.
//          u 방향으로 늘인 셀이라 lip에서 면을 타고 흘러내리는 줄무늬가 된다
//   bore : 무너진 뒤의 흰 물 띠. 가장 빽빽하고, 두 겹의 셀이 서로 다른 방향으로 흘러 끓는 것처럼 보인다
//   잔여 : 지나간 자리에 남는 거품. 월드 좌표에 고정(실제 거품도 제자리에 남는다)
//
// 나이에 따른 레이스: 셀 노이즈(Worley)의 "셀 경계까지 거리" b(경계 0, 셀 가운데 1)를 침식 문턱으로 자른다.
//   b < 밀도 × k 인 곳만 거품. 새 거품(밀도 1)은 거의 다 덮고, 밀도가 줄수록 셀 가운데부터 구멍이 나서
//   경계만 그물처럼 남는다. 감쇠하는 잔여 거품 버퍼가 그대로 나이 역할을 한다
import {
  Fn, vec2, vec3, float, floor, fract, sin, dot, min, max, sqrt, select, smoothstep, saturate, mix,
  length, normalize, cross, dFdx, dFdy, sign, abs, time, cameraPosition, uniform,
} from 'three/tsl';

// 디버그: 0 = 전부, 1 = lip만, 2 = bore만, 3 = 잔여만 (콘솔에서 FOAM_DEBUG.value = 1)
export const FOAM_DEBUG = uniform(0);

const hash2 = p => fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))).mul(43758.5453));

// 2D Worley: (F1, F2) = 가장 가까운 점, 두 번째로 가까운 점까지 거리. 3 × 3 셀만 본다
export const worley2 = Fn(([p]) => {
  const ip = floor(p).toVar(), fp = fract(p).toVar();
  const f1 = float(8).toVar(), f2 = float(8).toVar();
  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) {
      const o = vec2(x, y);
      const r = o.add(hash2(ip.add(o))).sub(fp);
      const d = dot(r, r);
      f2.assign(select(d.lessThan(f1), f1, min(f2, d)));
      f1.assign(min(f1, d));
    }
  }
  return vec2(sqrt(f1), sqrt(f2));
}).setLayout({ name: 'foamWorley2', type: 'vec2', inputs: [{ name: 'p', type: 'vec2' }] });
// setLayout: WGSL 함수 하나로 내보낸다. 없으면 호출할 때마다 9칸 루프가 통째로 펼쳐져 셰이더가 커지고 컴파일이 10초 넘게 걸린다

// 셀 경계까지 거리 → 0(경계) ~ 1(셀 가운데). 이걸로 깎으면 경계가 남는 그물(레이스)
const cellB = p => { const w = worley2(p); return saturate(w.y.sub(w.x).mul(1.7)); };
// 셀 가운데에서의 거리 → 1(가운데) ~ 0. 이걸로 깎으면 가운데가 남는 덩어리 (lip·bore 가장자리의 거품 뭉치)
const cellC = p => saturate(float(1).sub(worley2(p).x.mul(1.25)));

// 침식: 밀도 d, 셀 값 b → 덮임 0 ~ 1. e = 가장자리 부드러움
const erode = (d, b, k = 1.25, e = 0.07) => smoothstep(b.sub(e), b.add(e), d.mul(k).sub(0.04));

// P: 월드 위치, uvW: 파면 좌표 (m), f: vec4 (잔여, lip, bore, -), shore: 물가 얇은 물 거품 0 ~ 1
// 반환: { cover, b(셀 값, 범프·AO용), density }
export function foamDetail(P, uvW, f, shore) {
  const t = time;
  const dist = length(cameraPosition.sub(P));
  const near = float(1).sub(smoothstep(60, 180, dist));          // 멀면 무늬를 끄고 부드러운 덮임만

  // lip: u 방향(면을 따라)으로 약 3배 늘인 셀 + 잔 셀. 파면 좌표라 파도와 같이 이동한다
  const bL = mix(cellC(vec2(uvW.x.mul(2.4), uvW.y.mul(1.3))), cellC(uvW.mul(vec2(5.2, 3.6))), 0.5);
  // lip 두께가 파면을 따라 들쭉날쭉하게: 큰 셀로 밀도를 0.55 ~ 1.1배
  const thickL = cellB(vec2(uvW.x.mul(0.28), uvW.y.mul(0.06))).mul(0.55).add(0.55);
  // bore: 두 겹이 서로 다른 방향으로 흘러 끓는 느낌
  const bB = mix(cellC(uvW.mul(1.8).add(vec2(0, t.mul(0.7)))), cellC(uvW.mul(3.9).add(vec2(t.mul(0.35), t.mul(-0.5)))), 0.45);
  // 잔여·물가: 월드 좌표, 아주 천천히 흐름
  const pw = P.xz.add(vec2(t.mul(0.03), t.mul(0.02)));
  const bR = mix(cellB(pw.mul(1.6)), cellB(pw.mul(4.1)), 0.4);

  const dL = f.y, dB = f.z;
  const dR = max(f.x, shore);
  // 덩어리: 1 - 셀 값으로 깎는다 (밀도가 낮아지면 셀 가운데만 뭉치로 남음)
  const cL = erode(dL.mul(thickL), float(1).sub(bL), 1.1, 0.06);
  const cB = erode(dB.mul(1.5), float(1).sub(bB), 1.2, 0.05);
  const cR = erode(dR, bR, 1.15, 0.06);
  const dbg = FOAM_DEBUG;
  const detail = select(dbg.equal(1), cL, select(dbg.equal(2), cB, select(dbg.equal(3), cR, max(max(cL, cB), cR))));
  // 먼 곳: 밀도를 그대로 쓰되 조금 깎아서 가까운 쪽과 평균 덮임이 비슷하게
  const smooth = saturate(max(max(dL, dB), dR).mul(1.3).sub(0.15));
  const cover = mix(smooth, detail, near);

  // 범프·AO에 쓸 셀 값: 덮임이 큰 쪽 위주로 섞는다
  const wL = cL.add(1e-4), wB = cB.mul(1.5), wR = cR.mul(0.8);
  const b = bL.mul(wL).add(bB.mul(wB)).add(bR.mul(wR)).div(wL.add(wB).add(wR));
  const density = max(max(dL, dB.mul(1.2)), dR);
  return { cover, b: mix(float(0.7), b, near), density: saturate(density), near };
}

// 화면 공간 범프 (Mikkelsen): 높이 h의 화면 미분으로 노멀을 기울인다. UV가 필요 없다
export function bumpNormal(N, P, h, scale) {
  const dpdx = dFdx(P), dpdy = dFdy(P);
  const dhdx = dFdx(h), dhdy = dFdy(h);
  const r1 = cross(dpdy, N), r2 = cross(N, dpdx);
  const det = dot(dpdx, r1);
  const grad = r1.mul(dhdx).add(r2.mul(dhdy)).mul(sign(det));
  return normalize(N.mul(abs(det)).sub(grad.mul(scale)));
}
