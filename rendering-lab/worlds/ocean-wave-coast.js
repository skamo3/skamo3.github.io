// Ocean Wave · 해안 지형 + 파면 베이크 (논문 3장: Coons 패치 → 경로 추적 → waveLUT)
// three 의존성 없음: Node에서도 돌려서 파면 모양·시간표를 검증할 수 있다.
//
// 흐름 (init 때 한 번, 논문의 "오프라인 베이크" 역할)
//   1. shape curve 2개(먼바다 직선 c0, 해안선을 따르는 c1)와 guide curve 2개(양 끝 경로 d0, d1)로
//      Coons 패치 P(s, τ)를 만든다. s = 파면을 따라 0~1, τ = 먼바다 → 해안 0~1
//   2. s를 고정하고 τ를 따라가면 파면 위 한 점이 해안으로 가는 경로(path)가 된다.
//      경로를 잘게 나눠 걸으면서 그 자리 수심으로 속도 √(g·d)와 애니메이션 파라미터 V를 적분한다
//   3. 그 결과를 "실제 시간 t" 기준으로 다시 샘플링해 표(waveLUT)로 저장한다: (t, s) → (x, z, V, 등장 페이드)
// 수심에 따라 경로마다 걸리는 시간이 달라서, 같은 t에서 모은 파면은 c0·c1 사이의 단순 보간보다 더 휜다.
// 이게 굴절처럼 보이는 효과다. 런타임은 이 표를 읽기만 한다 (E1: 매 프레임 계산 vs 베이크).

// ── 지형 ──
// 단위 m, 수면 y = 0. 해안선은 x축을 따라 놓이고 바다는 -z 쪽, 육지는 +z 쪽.
const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
const softplus = (x, k) => Math.log1p(Math.exp(x / k)) * k;
const lerp = (a, b, t) => a + (b - a) * t;
export { smooth as smoothstepJS };

// 만(bay) 모양 해안선: 가운데가 육지 쪽으로 들어가고, 양옆(|x| > 110)은 곶이 바다 쪽으로 길게 나온다.
export function shoreZ(x) {
  return 14 * Math.exp(-((x / 60) ** 2)) - 4 - 125 * smooth(105, 175, Math.abs(x));
}

// 지형 높이 (해석적). 캐릭터 이동(P5)과 시뮬 바닥(P6~)도 이 함수를 공유한다.
export function terrainHeight(x, z) {
  const d = z - shoreZ(x);                 // + 육지 쪽 / - 바다 쪽, 해안선에서의 거리
  const cape = smooth(105, 175, Math.abs(x));
  if (d >= 0) {
    // 완만한 모래사장 → 15~40 m 지점부터 사구로 솟음. 곶은 바위 언덕
    const dune = 3.5 * smooth(15, 40, d);
    const bumps = 0.35 * Math.sin(x * 0.13) * Math.sin(z * 0.21) * smooth(8, 25, d);
    const hill = cape * (6 * smooth(0, 25, d) + 2.5 * Math.sin(x * 0.05 + z * 0.03));
    return d * 0.05 + dune + bumps + hill;
  }
  // 바다 쪽: 해안 근처는 1/25 경사, 30 m 밖부터 더 빨리 깊어지다 14 m에서 평평
  const s = -d;
  const depth = 0.04 * s + 0.07 * softplus(s - 30, 6);
  return -Math.min(depth, 14);
}

// ── 파면 ──
export const FRONT = {
  S: 48,                 // 파면 하나의 쿼드 수 (열 = S + 1)
  X0: 125, Z0: -150,     // c0: 먼바다 직선 파면 x ∈ [-X0, X0], z = Z0
  X1: 112,               // c1: 해안선을 따르는 파면 x ∈ [-X1, X1]
  WAVE_H: 2.7,           // 대표 파고 (H/d로 부서짐 판정)
  NT: 160,               // waveLUT 시간 행 수
  FADE_IN: 4,            // 생성 직후 진폭 페이드 (s)
};

// H/d → V. 깊은 물에서는 천천히 솟고, H/d ≈ 0.78 부근에서 말리기 시작(V = 0.5)
function targetV(r) {
  const P = [[0.08, 0], [0.3, 0.3], [0.6, 0.45], [0.78, 0.5]];
  if (r <= P[0][0]) return 0;
  for (let i = 1; i < P.length; i++) {
    if (r <= P[i][0]) { const t = (r - P[i - 1][0]) / (P[i][0] - P[i - 1][0]); return P[i - 1][1] + t * (P[i][1] - P[i - 1][1]); }
  }
  return 0.5;
}

// 경계 곡선 4개
const c0 = s => [lerp(-FRONT.X0, FRONT.X0, s), FRONT.Z0];
const c1 = s => { const x = lerp(-FRONT.X1, FRONT.X1, s); return [x, shoreZ(x) + 0.5]; };
// guide: 양 끝 경로. 처음엔 곧장 해안 쪽으로 오다가, 끝에서 곶 쪽(바깥)으로 살짝 벌어지며 해안에 닿는 2차 베지어
function guide(side) {             // side = 0 왼쪽, 1 오른쪽
  const a = c0(side), b = c1(side), sg = side ? 1 : -1;
  const m = [a[0] + sg * 8, lerp(a[1], b[1], 0.55)];
  return t => [
    (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * m[0] + t * t * b[0],
    (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * m[1] + t * t * b[1],
  ];
}
const d0 = guide(0), d1 = guide(1);

// Coons 패치: P = Lc + Ld - B  (네 경계 곡선과 정확히 일치)
export function coons(s, t) {
  const A = c0(s), Bc = c1(s), L = d0(t), R = d1(t);
  const p00 = c0(0), p10 = c0(1), p01 = c1(0), p11 = c1(1);
  const out = [0, 0];
  for (let k = 0; k < 2; k++) {
    const Lc = (1 - t) * A[k] + t * Bc[k];
    const Ld = (1 - s) * L[k] + s * R[k];
    const B = p00[k] * (1 - s) * (1 - t) + p10[k] * s * (1 - t) + p01[k] * (1 - s) * t + p11[k] * s * t;
    out[k] = Lc + Ld - B;
  }
  return out;
}

// 경로 하나 추적: τ를 잘게 나눠 걸으며 시간·V 적분. 반환 = 시간순 샘플 [t, x, z, V]
function tracePath(s, steps = 3000) {
  const out = [];
  let t = 0, v = 0, [x, z] = coons(s, 0);
  const push = () => out.push([t, x, z, v]);
  const advanceV = (dt) => {
    const d = -terrainHeight(x, z);
    if (v < 0.5) v = Math.max(v, targetV(d > 0.05 ? FRONT.WAVE_H / d : 99));
    if (v >= 0.5) v = Math.min(1, v + 0.125 * dt);   // 말리기 시작한 뒤에는 시간으로 진행 (0.5 → 1 약 4초)
  };
  advanceV(0); push();
  for (let i = 1; i <= steps; i++) {
    const [nx, nz] = coons(s, i / steps);
    const dist = Math.hypot(nx - x, nz - z);
    const d = Math.max(-terrainHeight((x + nx) / 2, (z + nz) / 2), 0.6);
    const dt = dist / Math.min(Math.sqrt(9.81 * d), 9);          // 얕은 물 파속 √(g·d)
    x = nx; z = nz; t += dt;
    advanceV(dt); push();
    if (v >= 1) break;               // 다 무너졌으면 더 갈 필요 없음 (이후로는 평평)
  }
  // 해안에 닿은 뒤에도 V가 1이 될 때까지 제자리에서 시간 진행
  while (v < 1) { const dt = 0.1; t += dt; v = Math.min(1, v + 0.125 * dt); push(); }
  return out;
}

function sampleAt(path, t) {
  if (t <= path[0][0]) return path[0];
  const last = path[path.length - 1];
  if (t >= last[0]) return last;
  let lo = 0, hi = path.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (path[m][0] <= t) lo = m; else hi = m; }
  const a = path[lo], b = path[hi], f = (t - a[0]) / (b[0] - a[0]);
  return [t, lerp(a[1], b[1], f), lerp(a[2], b[2], f), lerp(a[3], b[3], f)];
}

// waveLUT 굽기. 반환: Float32Array (NT × NS × 4) = (x, z, V, 등장 페이드), 행 = 시간, 열 = s
export function bakeWaveLUT() {
  const { S, NT, FADE_IN } = FRONT;
  const NS = S + 1;
  const paths = Array.from({ length: NS }, (_, j) => tracePath(j / S));
  const T = Math.max(...paths.map(p => p[p.length - 1][0])) + 0.5;   // 파도 하나의 수명
  const dtRow = T / (NT - 1);
  const lut = new Float32Array(NT * NS * 4);
  for (let i = 0; i < NT; i++) {
    const t = i * dtRow;
    const fade = smooth(0, FADE_IN, t);
    for (let j = 0; j < NS; j++) {
      const [, x, z, v] = sampleAt(paths[j], t);
      const o = (i * NS + j) * 4;
      lut[o] = x; lut[o + 1] = z; lut[o + 2] = v; lut[o + 3] = fade;
    }
  }
  return { lut, NT, NS, T, dtRow };
}

// CPU에서 표 읽기 (카메라 따라가기용). GPU의 compute A와 같은 보간
export function sampleLUT(L, t, j) {
  const r = Math.min(Math.max(t / L.dtRow, 0), L.NT - 1);
  const i0 = Math.floor(r), i1 = Math.min(i0 + 1, L.NT - 1), f = r - i0;
  const a = (i0 * L.NS + j) * 4, b = (i1 * L.NS + j) * 4;
  return [0, 1, 2, 3].map(k => lerp(L.lut[a + k], L.lut[b + k], f));
}

// 변주 표: 행 = 변주 하나(파도마다 하나씩 골라 씀), 값 = 열마다 변형 강도. 0이면 그 구간은 안 부서진다(gap)
// gap은 V가 아니라 강도로 만든다: V로 만들면 0과 1 사이 중간 모양이 전부 늘어서 보인다 (논문 3-4)
export function bakeVariation(rows = 16, seed = 7) {
  const { S } = FRONT, NS = S + 1;
  let st = seed >>> 0;
  const rnd = () => { st = (st * 1664525 + 1013904223) >>> 0; return st / 4294967296; };
  const out = new Float32Array(rows * NS);
  for (let r = 0; r < rows; r++) {
    const base = 0.8 + 0.2 * rnd();
    const ph = [rnd() * 6.28, rnd() * 6.28];
    const gaps = [];
    const nGap = rnd() < 0.75 ? (rnd() < 0.35 ? 2 : 1) : 0;
    for (let g = 0; g < nGap; g++) gaps.push([0.15 + 0.7 * rnd(), 0.015 + 0.035 * rnd()]);   // 가운데, 반폭 (s 단위)
    for (let j = 0; j < NS; j++) {
      const s = j / S;
      let v = base * (0.85 + 0.15 * Math.sin(s * 9 + ph[0]) * Math.sin(s * 23 + ph[1]));
      for (const [c, w] of gaps) v *= smooth(w, w + 0.05, Math.abs(s - c));
      v *= 1 - smooth(0.8, 1.0, Math.abs(2 * s - 1));                   // 양 끝은 사라지게
      out[r * NS + j] = v;
    }
  }
  return { data: out, rows, NS };
}
