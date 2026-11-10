// Ocean Wave · 물 셰이딩 (P4)
// 조명 계산을 three의 라이트 시스템에 맡기지 않고 여기서 직접 한다. 무엇이 어디서 오는지 한 파일에서 보이게.
//
// 물 한 픽셀의 색 = 두 빛의 섞임
//   1. 반사: 수면에 비친 하늘 + 태양 하이라이트
//   2. 굴절: 물속으로 들어갔다 흩어져 나온 빛 (수심이 깊을수록 짙은 남색, 얕을수록 청록)
//   섞는 비율 = Fresnel. 수면을 비스듬히 볼수록 반사가 늘어난다 (정면 2% → 수평 100%)
// 여기에 얇게 솟은 물(마루·lip)을 태양 쪽에서 볼 때 빛이 비쳐 나오는 투과광과, 거품을 얹는다.
import {
  vec3, float, mix, smoothstep, clamp, max, pow, exp, dot, normalize, reflect, saturate,
  select, sin, cos, length, positionWorld, cameraPosition, time, mx_fractal_noise_float,
} from 'three/tsl';

// 태양 방향 (바다 쪽 위에서 비친다: 해변에서 바다를 보면 역광이라 파도 마루가 비쳐 보인다)
export const SUN = { x: -60, y: 80, z: -120 };
const sl = Math.hypot(SUN.x, SUN.y, SUN.z);
export const SUN_DIR = [SUN.x / sl, SUN.y / sl, SUN.z / sl];
const L = vec3(...SUN_DIR);
const SUN_COL = vec3(1.0, 0.93, 0.8);

const ZENITH = vec3(0.17, 0.42, 0.78);
const HORIZON = vec3(0.68, 0.82, 0.92);
export const HORIZON_HEX = 0xadd1eb;   // 안개색 = 지평선색 (먼 곳이 하늘로 자연스럽게 녹게)

// ── 하늘: 배경과 물 반사가 같은 함수를 쓴다. 그래야 비친 하늘이 실제 하늘과 맞는다 ──
export function skyColor(dirIn) {
  const d = normalize(dirIn);
  const up = saturate(d.y);
  const above = mix(HORIZON, ZENITH, pow(up, 0.45));
  const below = mix(HORIZON, HORIZON.mul(0.75), smoothstep(0.0, 0.3, d.y.negate()));
  const base = select(d.y.greaterThanEqual(0), above, below);
  const s = max(dot(d, L), 0);
  const glow = pow(s, 6).mul(0.18).add(pow(s, 90).mul(0.5));           // 태양 주변 번짐
  const disk = smoothstep(0.9993, 0.9997, s).mul(6);                     // 태양 원반
  return base.add(SUN_COL.mul(glow.add(disk)));
}

// ── 잔물결 노멀: 정점 격자로 표현 못 하는 작은 물결. 반사가 거울처럼 매끈해 보이지 않게 ──
// 방향이 다른 사인파 몇 개의 기울기를 노멀에 더한다. 멀리서는 깜빡임(에일리어싱)이 생기니 거리에 따라 줄인다.
// 기울기(진폭 × 파수)를 0.01~0.02로 작게 둔다. 크면 물결 면마다 밝은 지평선이 비쳐 흰 줄무늬가 된다.
// 방향·파장을 서로 어긋나게 골라 규칙적인 무늬가 덜 보이게 했다.
const RIPPLES = [  // (방향 x, z, 파수 k, 진폭, 각속도)
  [0.20, 1.00, 0.83, 0.016, 1.5],
  [-0.63, 0.78, 1.37, 0.011, 2.1],
  [0.91, 0.42, 2.21, 0.007, 2.8],
  [-0.27, -0.96, 3.47, 0.004, 3.6],
  [0.71, -0.70, 5.13, 0.0028, 4.4],
  [-0.95, 0.30, 7.9, 0.0018, 5.5],
];
export function rippleNormal(N, P, strength = float(1)) {
  const dist = length(cameraPosition.sub(P));
  const fade = float(1).sub(smoothstep(25.0, 160.0, dist)).mul(strength);
  let gx = float(0), gz = float(0);
  for (const [dx, dz, k, a, w] of RIPPLES) {
    const n = Math.hypot(dx, dz);
    const phase = P.x.mul(dx / n).add(P.z.mul(dz / n)).mul(k).sub(time.mul(w));
    const c = cos(phase).mul(a * k);               // 높이 a·sin(phase)의 기울기
    gx = gx.add(c.mul(dx / n));
    gz = gz.add(c.mul(dz / n));
  }
  return normalize(N.sub(vec3(gx, 0, gz).mul(fade)));
}

// ── 물 셰이딩 ──
// N: 월드 노멀 (뒷면이면 이미 뒤집혀 있어야 함), P: 월드 위치
// thickness: 이 점에서 바닥까지 물 두께 (m), foam: 0~1, lift: 솟아오른 정도 0~1
// 반환: { col: 색 노드, alpha: 불투명도 노드 } (노드 그래프를 만드는 보통 JS 함수)
export function shadeWater(N, P, thickness, foam, lift) {
  const V = normalize(cameraPosition.sub(P));
  const NdV = saturate(dot(N, V));

  // Fresnel (Schlick 근사, 물의 F0 ≈ 0.02)
  const F = float(0.02).add(float(0.98).mul(pow(float(1).sub(NdV), 5)));

  // 반사: 반사 벡터로 하늘을 읽는다. 지평선 아래를 향하면 지평선색으로 막는다
  const R = reflect(V.negate(), N);
  const refl = skyColor(vec3(R.x, max(R.y, 0.01), R.z));

  // 굴절(물속 산란): 두께에 따라 빛이 흡수돼 얕으면 청록, 깊으면 남색
  const shallow = vec3(0.10, 0.48, 0.50), deep = vec3(0.01, 0.10, 0.20);
  const absorb = exp(thickness.mul(-0.28));
  const ambient = float(0.55).add(float(0.45).mul(saturate(L.y)));
  const body = mix(deep, shallow, absorb).mul(ambient);

  // 투과광: 태양을 마주 보고 얇은 물을 볼 때 빛이 비쳐 나온다. 노멀로 살짝 휘어서 마루 윤곽을 따라 퍼지게
  const Hs = normalize(L.add(N.mul(0.45)));
  const sss = pow(saturate(dot(V, Hs.negate())), 3).mul(lift).mul(1.4);
  const sssCol = vec3(0.12, 0.75, 0.62);
  // 솟은 물은 정면에서 봐도 얇아서 조금 밝다
  const liftGlow = sssCol.mul(lift.mul(0.35));

  // 태양 하이라이트 (Blinn-Phong, 아주 좁게)
  const H = normalize(L.add(V));
  const spec = pow(saturate(dot(N, H)), 700).mul(5).add(pow(saturate(dot(N, H)), 120).mul(0.12));

  const water = mix(body.add(sssCol.mul(sss)).add(liftGlow), refl, F).add(SUN_COL.mul(spec).mul(F.mul(4).add(0.4)));

  // 거품: 노이즈로 얼룩지게 덮는다. 거품량이 많을수록 노이즈 문턱이 내려가 빈틈이 줄어든다
  const nz = mx_fractal_noise_float(vec3(P.x.mul(0.45), P.z.mul(0.45), time.mul(0.12)), 3).mul(0.5).add(0.5);
  const cover = saturate(foam.mul(1.5).sub(float(1).sub(nz)).mul(3.0));
  const foamLit = vec3(0.9, 0.93, 0.95).mul(float(0.55).add(float(0.45).mul(saturate(dot(N, L)))))
    .add(refl.mul(0.12));
  const col = mix(water, foamLit, cover);

  // 불투명도: 물이 얇으면 바닥(모래)이 비친다. 반사가 강하거나 거품이 있으면 불투명
  const alpha = saturate(max(max(float(1).sub(exp(thickness.mul(-1.1))), F), max(cover, lift)));
  return { col, alpha };
}
