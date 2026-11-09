// Ocean Wave · 단면 변형 텍스처 생성기 (논문 2-1의 "손애니 단면 곡선"을 절차적으로)
// three 의존성 없음: Node에서도 돌려서 모양을 검증할 수 있다.
//
// 아이디어: 단면 곡선을 "호 길이 s에 따른 접선 각도 φ(s)"로 정의한다.
//   (x, y) = ∫ (cos φ, sin φ) ds
//   - φ 가 + 로 갔다 0 으로 돌아오면: 뒷면 오르막 → 마루
//   - φ 가 0 → -π 까지 시계 방향으로 돌면: 마루 끝(lip)이 앞으로 나갔다가 아래·뒤로 말림
//   - 다시 -π → -0.75 로 반시계 방향으로 돌면: lip 안쪽 → 튜브 안 → 앞면을 타고 내려옴 (inner loop)
// 각도로 정의하면 고리가 생겨도 곡선이 항상 매끄럽고, 애니메이션 중간 상태가 자연스럽게 보간된다.
// 무너질 때는 모든 각도에 e(v) → 0 을 곱한다: 고리가 풀리며 평평한 면으로 돌아간다.
//
// 텍스처 매핑 (논문과 같음):
//   U = 파도를 가로지르는 위치 (0 = 뒤/먼바다 쪽, 1 = 앞/해안 쪽), 평평한 상태에서 x = (U - 0.5)·W
//   V = 애니메이션 파라미터
//   값 = 평평한 점 → 곡선 위 점의 오프셋 (가로 dA, 세로 dU)
// 정점을 x가 아니라 "호 길이"로 고르게 배치한다: U 위치의 정점 = 곡선의 호 길이 U·L 지점.
// 그래서 고리 부분에도 정점이 고르게 간다 (논문 2-2 UV 보정과 같은 목적).

export const SECTION_W = 30;     // 단면 폭 (m). 양 끝 오프셋은 항상 0
export const CREST_U = 0.62;     // 평평할 때 마루가 놓이는 U 근처 (쿼드 배치용)

const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

// V → 모양 파라미터 (설계 8장의 V 구간 규칙)
export function sectionParams(v) {
  const grow  = smooth(0.0, 0.3, v);          // 0 ~ 0.3   솟기
  const steep = smooth(0.3, 0.5, v);          // 0.3 ~ 0.5 앞면 가팔라짐
  const curl  = smooth(0.48, 0.64, v);        // 0.5 ~ 0.65 말림 + 안쪽 고리
  const fade  = 1 - smooth(0.64, 1.0, v);     // 0.65 ~ 1  무너지며 평평해짐
  const e = grow * fade;

  const a  = mix(0.42, 0.62, steep);                       // 뒷면 오르막 최대 각도
  const m0 = mix(-a, -1.15, steep);                        // 말리기 전 앞면 각도
  return {
    e,
    riseLen: mix(9, 7, steep),                             // 뒷면 길이
    a,
    lipLen: mix(mix(5, 3.0, steep), 4.2, curl),            // 마루 → lip 바깥면 (시계 방향으로 넘어감)
    m: mix(m0, -1.9, curl),                                // lip 바깥면 끝 각도 (아래를 향함)
    tipLen: 0.7 * curl,                                    // lip 끝에서 급하게 돌아섬 (lip 두께)
    tip: mix(m0, -4.45, curl),                             // 돌아선 뒤 각도 (위·뒤를 향함 = lip 아랫면)
    backLen: 5.0 * curl,                                   // 튜브 천장 → 튜브 뒷벽 (반시계 방향)
    q: mix(m0, -1.05, curl),                               // 앞면 각도
    toeLen: mix(4, 2.5, steep),                            // 앞면 → 평평한 바닥으로 이어지는 구간
    lipFoam: smooth(0.52, 0.6, v) * (1 - smooth(0.85, 1.0, v)),     // lip 끝에만 얇게
    whiteWater: smooth(0.62, 0.72, v) * (1 - smooth(0.88, 1.0, v)),  // 떨어진 뒤 앞면 전체가 흰 물
  };
}

// φ(s) 구간 목록 → 점 목록 (호 길이 간격 ds)
function integrate(segs, ds) {
  const pts = [[0, 0, 0, 0]];  // x, y, φ, 구간 id
  let x = 0, y = 0;
  segs.forEach((g, id) => {
    const n = Math.max(1, Math.ceil(g.len / ds));
    const h = g.len / n;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const phi = g.phi(t);
      x += Math.cos(phi) * h; y += Math.sin(phi) * h;
      pts.push([x, y, phi, id]);
    }
  });
  return pts;
}

// 곡선 하나 만들기. 양 끝이 (-W/2, 0), (W/2, 0)에 오게 맞춘다.
export function buildCurve(v, ds = 0.02) {
  const p = sectionParams(v);
  const e = p.e;
  const ease = t => t * t * (3 - 2 * t);
  const bump = t => Math.sin(Math.PI * t);

  const core = (faceLen) => [
    { len: p.riseLen, phi: t => e * p.a * bump(t) },                       // 0 뒷면 (오르고 마루에서 수평)
    { len: p.lipLen,  phi: t => e * p.m * ease(t) },                       // 1 마루 → lip 바깥면
    { len: p.tipLen,  phi: t => e * mix(p.m, p.tip, t) },                  // 2 lip 끝 (급회전)
    { len: p.backLen, phi: t => e * mix(p.tip, p.q, ease(t)) },            // 3 lip 아랫면 → 튜브 → 뒷벽 (고리)
    { len: faceLen,   phi: () => e * p.q },                                // 4 앞면 (길이로 높이를 맞춤)
    { len: p.toeLen,  phi: t => e * p.q * (1 - ease(t)) },                 // 5 앞면 → 바닥
  ];

  // 앞면 길이는 "끝 높이 = 0"이 되도록 닫힌 식으로 정한다 (앞면은 각도가 일정해서 높이가 길이에 비례)
  const probe = integrate(core(0), ds);
  const yEnd0 = probe[probe.length - 1][1];
  const sq = Math.sin(e * p.q);
  const faceLen = (sq < -1e-4 && yEnd0 > 0) ? yEnd0 / -sq : 0;
  let pts = integrate(core(faceLen), ds);

  // 남는 오차(작음)는 호 길이에 비례해 y를 빼서 없앤다
  const yEnd = pts[pts.length - 1][1];
  const n = pts.length - 1;
  pts.forEach((q, i) => { q[1] -= yEnd * (i / n); });

  // 양 옆을 평평하게 채워 가로 폭을 W에 맞춘다: 뒤쪽 여백 = 마루 위치 기준, 앞쪽은 나머지
  const span = pts[n][0];
  const W = SECTION_W;
  const crestX = (pts.find(q => q[3] === 1) || pts[n])[0];          // 마루 근처 x
  let backPad = W * CREST_U - crestX;
  let frontPad = W - backPad - span;
  if (frontPad < 0.5) { backPad += frontPad - 0.5; frontPad = 0.5; }
  backPad = Math.max(backPad, 0.5);
  const out = [];
  const steps = s => Math.max(1, Math.ceil(s / ds));
  const nb = steps(backPad);
  for (let i = 0; i <= nb; i++) out.push([-W / 2 + backPad * i / nb, 0, 0, -1]);
  const x0 = -W / 2 + backPad;
  for (let i = 1; i <= n; i++) out.push([x0 + pts[i][0], pts[i][1], pts[i][2], pts[i][3]]);
  const xa = out[out.length - 1][0];
  const nf = steps(W / 2 - xa);
  for (let i = 1; i <= nf; i++) out.push([mix(xa, W / 2, i / nf), 0, 0, 6]);
  return { pts: out, params: p };
}

// 텍스처 데이터 굽기. 반환: Float32Array 두 장 (RGBA)
//   deform: (dA, dU, foam, 0)          dA = 가로 오프셋, dU = 세로 오프셋 (m)
//   deriv : (∂dA/∂U, ∂dU/∂U, 0, 0)     탄젠트(노멀) 계산용 (m / U)
export function bakeSection(NU = 256, NV = 128) {
  const deform = new Float32Array(NU * NV * 4);
  const deriv = new Float32Array(NU * NV * 4);
  const W = SECTION_W;
  for (let j = 0; j < NV; j++) {
    const v = j / (NV - 1);
    const { pts, params } = buildCurve(v);
    // 누적 호 길이
    const S = new Float64Array(pts.length);
    for (let i = 1; i < pts.length; i++) S[i] = S[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const L = S[S.length - 1];
    let k = 0;
    for (let i = 0; i < NU; i++) {
      const u = i / (NU - 1);
      const s = u * L;
      while (k < pts.length - 2 && S[k + 1] < s) k++;
      const t = (s - S[k]) / Math.max(S[k + 1] - S[k], 1e-9);
      const px = mix(pts[k][0], pts[k + 1][0], t), py = mix(pts[k][1], pts[k + 1][1], t);
      const phi = mix(pts[k][2], pts[k + 1][2], t);
      const seg = pts[k + 1][3];
      const flatX = (u - 0.5) * W;
      // 거품: 말린 lip ~ 앞면 ~ 바닥 구간에서만
      // 거품: 말리는 중에는 lip 끝(구간 2)과 그 아랫면 시작만, 떨어진 뒤에는 lip~앞면~바닥 전체
      const lip = seg === 2 ? 1 : (seg === 3 ? 0.5 : 0);
      const front = (seg >= 1 && seg <= 5) ? 1 : (seg === 6 ? 0.4 : 0);
      const foamVal = Math.max(params.lipFoam * lip, params.whiteWater * front);
      const o = (j * NU + i) * 4;
      deform[o] = px - flatX;
      deform[o + 1] = py;
      deform[o + 2] = foamVal;
      deriv[o] = L * Math.cos(phi) - W;
      deriv[o + 1] = L * Math.sin(phi);
    }
  }
  return { deform, deriv, NU, NV };
}
