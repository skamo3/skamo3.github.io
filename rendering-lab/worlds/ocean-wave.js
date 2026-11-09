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
//
// 주의: 이 월드는 three/webgpu 빌드만 쓴다. 'three'(WebGL 빌드)와 섞지 않는다.
import * as THREE from 'three/webgpu';
import {
  Fn, instanceIndex, vertexIndex, instancedArray, attribute, texture, varying,
  float, int, uint, vec2, vec3, mix, smoothstep, clamp, max, select, cross, normalize, dot,
  Loop, If, transformNormalToView, directionToFaceDirection,
} from 'three/tsl';
import { bakeSection, SECTION_W, CREST_U } from './ocean-wave-section.js';

// ── 월드 좌표 규칙 ──
// 단위 m, 수면 y = 0. 해안선은 x축을 따라 놓이고 바다는 -z 쪽, 육지는 +z 쪽.
// 파도는 -z → +z 로 밀려온다.
const TERRAIN = { x0: -400, x1: 400, z0: -160, z1: 260, segX: 560, segZ: 420 };

// 수면 격자: x는 0.5 m 균일. z는 먼바다 쪽 1 m, 파도가 말리는 구간부터 0.125 m.
// 말린 lip의 반지름이 1 m 안팎이라 파도를 가로지르는 방향(z)으로 촘촘해야 고리가 보인다.
// (파면 근처만 촘촘하게 = 논문 4장의 테셀레이션 문제. 지금은 직선 파면이라 z 방향만 나눈다. E3에서 일반화)
const WATER = {
  x0: -170, x1: 170, dx: 0.5,
  z0: -160, zFine: -75, z1: 25, dzCoarse: 1, dzFine: 0.125,
};

// 파면 쿼드: x ∈ [-QX, QX]를 S개로 나눈다
const QX = 130, S = 52;
const WAVE_H = 2.7;              // 단면의 대표 파고 (H/d로 부서짐 판정)

// 만(bay) 모양 해안선: 가운데가 육지 쪽으로 들어가고, 양옆(|x| > 110)은 곶이 바다 쪽으로 길게 나온다.
export function shoreZ(x) {
  return 14 * Math.exp(-((x / 60) ** 2)) - 4 - 125 * smoothstepJS(105, 175, Math.abs(x));
}

// 지형 높이 (해석적). 캐릭터 이동(P5)과 시뮬 바닥(P6~)도 이 함수를 공유한다.
export function terrainHeight(x, z) {
  const d = z - shoreZ(x);                 // + 육지 쪽 / - 바다 쪽, 해안선에서의 거리
  const cape = smoothstepJS(105, 175, Math.abs(x));
  if (d >= 0) {
    // 완만한 모래사장 → 15~40 m 지점부터 사구로 솟음. 곶은 바위 언덕
    const dune = 3.5 * smoothstepJS(15, 40, d);
    const bumps = 0.35 * Math.sin(x * 0.13) * Math.sin(z * 0.21) * smoothstepJS(8, 25, d);
    const hill = cape * (6 * smoothstepJS(0, 25, d) + 2.5 * Math.sin(x * 0.05 + z * 0.03));
    return d * 0.05 + dune + bumps + hill;
  }
  // 바다 쪽: 해안 근처는 1/25 경사, 30 m 밖부터 더 빨리 깊어지다 14 m에서 평평
  const s = -d;
  const depth = 0.04 * s + 0.07 * softplus(s - 30, 6);
  return -Math.min(depth, 14);
}

function smoothstepJS(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}
function softplus(x, k) { return Math.log1p(Math.exp(x / k)) * k; }

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

// ── 파면 상태 (CPU): 쿼드 S개, 꼭짓점(쿼드 경계) S+1개 ──
// 직선 파면 하나가 해안으로 다가오고, 쿼드 경계마다 V를 따로 키운다.
// P3에서 이 부분이 GPU의 compute A(waveLUT 샘플)로 옮겨간다.
function createWaveFront() {
  const edgeX = Array.from({ length: S + 1 }, (_, j) => -QX + (2 * QX * j) / S);
  const v = new Float32Array(S + 1);
  const strength = edgeX.map(x => 1 - smoothstepJS(QX - 35, QX, Math.abs(x)));   // 양 끝은 약하게 (gap 흉내)
  const st = { zCrest: -150, v, edgeX, strength, wait: 0 };

  // H/d → V. 깊은 물에서는 천천히 솟고, H/d ≈ 0.78 부근에서 말리기 시작(V = 0.5)
  const target = r => {
    const P = [[0.08, 0], [0.3, 0.3], [0.6, 0.45], [0.78, 0.5]];
    if (r <= P[0][0]) return 0;
    for (let i = 1; i < P.length; i++) {
      if (r <= P[i][0]) { const t = (r - P[i - 1][0]) / (P[i][0] - P[i - 1][0]); return P[i - 1][1] + t * (P[i][1] - P[i - 1][1]); }
    }
    return 0.5;
  };

  st.step = (dt) => {
    if (st.wait > 0) { st.wait -= dt; return; }
    // 파면 속도 = √(g·d) (얕은 물 근사). 직선 파면이라 가운데 수심으로 대표
    const d0 = Math.max(-terrainHeight(0, st.zCrest), 0.6);
    st.zCrest += Math.min(Math.sqrt(9.81 * d0), 9) * dt;
    let done = true;
    for (let j = 0; j <= S; j++) {
      const d = -terrainHeight(edgeX[j], st.zCrest);
      if (v[j] < 0.5) {
        const r = d > 0.05 ? WAVE_H / d : 99;
        v[j] = Math.max(v[j], target(r));
      }
      // 말리기 시작한 뒤에는 수심과 상관없이 시간으로 진행 (0.5 → 1 약 4초)
      if (v[j] >= 0.5) v[j] = Math.min(1, v[j] + 0.125 * dt);
      if (v[j] < 1) done = false;
    }
    if (done || st.zCrest > 40) {         // 다음 파도
      st.zCrest = -150; v.fill(0); st.wait = 1.5;
    }
  };
  return st;
}

// ── 수면: storage 버퍼 + compute C ──
function buildWater(section) {
  const L = waterLayout();
  const geo = buildWaterGeometry(L);
  const { GX, NC, COUNT } = L;

  const posBuf = instancedArray(COUNT, 'vec3');     // 정점 위치
  const nrmBuf = instancedArray(COUNT, 'vec3');     // 정점 노멀
  const foamBuf = instancedArray(COUNT, 'float');   // 거품량

  // 쿼드 버퍼: 쿼드마다 vec4 두 개
  //   q0 = (원점 x, 원점 z, 파면 방향 벡터 x, z)     원점 = 뒤(먼바다)·왼쪽 모서리
  //   q1 = (가로지르는 벡터 x, z, V왼, V오른)        가로지르는 벡터 길이 = 단면 폭 W
  //   q2 = (강도왼, 강도오른, 0, 0)
  const quadBuf = instancedArray(S * 3, 'vec4');
  const quadArr = quadBuf.value.array;

  const { deformTex, derivTex, NU, NV } = section;

  const computeSurface = Fn(() => {
    const i = instanceIndex;
    const ix = i.mod(uint(GX));
    const iz = i.div(uint(GX));
    const x = float(ix).mul(WATER.dx).add(WATER.x0);
    const zc = float(iz).mul(WATER.dzCoarse).add(WATER.z0);
    const zf = float(iz.sub(uint(NC))).mul(WATER.dzFine).add(WATER.zFine);
    const z = select(iz.lessThan(uint(NC)), zc, zf);
    const p = vec2(x, z);

    const disp = vec3(0).toVar();
    const tu = vec3(0, 0, 1).toVar();      // 가로지르는 방향 탄젠트 (쿼드 밖이면 +z)
    const tf = vec3(1, 0, 0).toVar();      // 파면 방향 탄젠트
    const foam = float(0).toVar();

    // 전체 순회: 정점 하나가 쿼드 S개를 전부 검사한다 (O(V·Q), E2 기준선)
    Loop(S, ({ i: q }) => {
      const q0 = quadBuf.element(q.mul(3));
      const q1 = quadBuf.element(q.mul(3).add(1));
      const q2 = quadBuf.element(q.mul(3).add(2));
      const o = q0.xy, t = q0.zw, n = q1.xy;
      const d = p.sub(o);
      // 평행사변형 안 좌표 (a = 파면 방향 0~1, u = 가로지르는 방향 0~1): 2x2 역행렬
      const det = t.x.mul(n.y).sub(t.y.mul(n.x));
      const a = d.x.mul(n.y).sub(d.y.mul(n.x)).div(det);
      const u = t.x.mul(d.y).sub(t.y.mul(d.x)).div(det);
      If(a.greaterThanEqual(0).and(a.lessThan(1)).and(u.greaterThanEqual(0)).and(u.lessThanEqual(1)), () => {
        const v = mix(q1.z, q1.w, a);
        const str = mix(q2.x, q2.y, a);
        // 텍셀 중심 보정: U=0, U=1이 정확히 첫/끝 텍셀 중심에 오게
        const uv = vec2(u.mul((NU - 1) / NU).add(0.5 / NU), v.mul((NV - 1) / NV).add(0.5 / NV));
        const def = texture(deformTex, uv).level(0);
        const der = texture(derivTex, uv).level(0);
        const W = n.length();
        const nh = vec3(n.x, 0, n.y).div(W);                  // 가로지르는 단위벡터 (해안 쪽)
        const th = normalize(vec3(t.x, 0, t.y));
        disp.assign(nh.mul(def.x).add(vec3(0, def.y, 0)).mul(str));
        // ∂P/∂u = 평평한 면의 W·n̂ + 오프셋 미분
        tu.assign(nh.mul(W.add(der.x.mul(str))).add(vec3(0, der.y.mul(str), 0)));
        tf.assign(th);
        foam.assign(def.z.mul(str));
      });
    });

    posBuf.element(i).assign(vec3(x, 0, z).add(disp));
    nrmBuf.element(i).assign(normalize(cross(tu, tf)));   // (+z) × (+x) = +y : 평평하면 위를 향함
    foamBuf.element(i).assign(foam);
  })().compute(COUNT);

  const mat = new THREE.MeshStandardNodeMaterial({
    transparent: true, side: THREE.DoubleSide, roughness: 0.3, metalness: 0.0,
  });
  mat.positionNode = posBuf.element(vertexIndex);   // 렌더 패스가 컴퓨트 결과를 그대로 읽음
  const nLocal = varying(nrmBuf.element(vertexIndex));
  mat.normalNode = directionToFaceDirection(transformNormalToView(normalize(nLocal)));  // 튜브 안쪽(뒷면)은 노멀 반전
  const vFoam = varying(foamBuf.element(vertexIndex));
  const vHeight = varying(posBuf.element(vertexIndex).y);

  // P4 전까지 임시 셰이딩: 수심 색 + 거품 + 솟은 물은 불투명하게
  const depth = clamp(attribute('aBed', 'float').negate(), 0.0, 20.0);
  const shallow = vec3(0.18, 0.62, 0.62), deep = vec3(0.02, 0.16, 0.30);
  const water = mix(shallow, deep, smoothstep(0.0, 8.0, depth));
  // 솟아오른 물(마루·lip)은 얇아서 빛이 비쳐 밝은 청록으로 (투과광 흉내, P4에서 제대로)
  const lifted = mix(water, vec3(0.16, 0.66, 0.62), smoothstep(0.8, 3.2, vHeight).mul(0.75));
  mat.colorNode = mix(lifted, vec3(0.92, 0.95, 0.97), clamp(vFoam, 0, 1));
  mat.opacityNode = max(mix(float(0.35), float(0.95), smoothstep(0.0, 4.0, depth)), smoothstep(0.1, 0.8, vHeight));

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;  // 실제 위치는 버퍼에 있어서 geometry의 경계구를 믿을 수 없다

  // CPU 파면 상태 → 쿼드 버퍼
  const front = createWaveFront();
  const W = SECTION_W;
  const segLen = (2 * QX) / S;
  function uploadQuads() {
    const zBack = front.zCrest - CREST_U * W;
    for (let q = 0; q < S; q++) {
      const o = q * 12;
      quadArr[o] = front.edgeX[q]; quadArr[o + 1] = zBack; quadArr[o + 2] = segLen; quadArr[o + 3] = 0;
      quadArr[o + 4] = 0; quadArr[o + 5] = W; quadArr[o + 6] = front.v[q]; quadArr[o + 7] = front.v[q + 1];
      quadArr[o + 8] = front.strength[q]; quadArr[o + 9] = front.strength[q + 1]; quadArr[o + 10] = 0; quadArr[o + 11] = 0;
    }
    quadBuf.value.needsUpdate = true;
  }

  return {
    mesh, computeSurface, front, uploadQuads, layout: L, posBuf,
    triCount: (L.GX - 1) * (L.GZ - 1) * 2,
    dispose() { deformTex.dispose(); derivTex.dispose(); },
  };
}

// 수면 격자 밖 먼 바다: 격자를 ㄷ자로 둘러싼 불투명 띠 (격자와 겹치지 않게)
function buildFarSea() {
  const mat = new THREE.MeshStandardNodeMaterial({ color: 0x0b3a58, roughness: 0.08 });
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
  const apply = () => {
    sph.phi = Math.min(Math.max(sph.phi, 0.15), Math.PI / 2 - 0.02);
    sph.radius = Math.min(Math.max(sph.radius, 4), 250);
    camera.position.setFromSpherical(sph).add(target);
    // 지형(사구) 속으로 들어가지 않게: 카메라 높이를 지면 + 1.5 m 이상으로
    const p = camera.position;
    p.y = Math.max(p.y, terrainHeight(p.x, p.z) + 1.5, 0.5);
    camera.lookAt(target);
  };
  const down = e => { dragging = true; lx = e.clientX; ly = e.clientY; dom.setPointerCapture(e.pointerId); };
  const move = e => {
    if (!dragging) return;
    sph.theta -= (e.clientX - lx) * 0.005;
    sph.phi   -= (e.clientY - ly) * 0.005;
    lx = e.clientX; ly = e.clientY; apply();
  };
  const up = () => { dragging = false; };
  const wheel = e => { e.preventDefault(); sph.radius *= Math.exp(e.deltaY * 0.001); apply(); };
  dom.addEventListener('pointerdown', down);
  dom.addEventListener('pointermove', move);
  dom.addEventListener('pointerup', up);
  dom.addEventListener('wheel', wheel, { passive: false });
  apply();
  return {
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
  };
}

function createHud(canvas) {
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;left:16px;top:56px;z-index:5;font:12px/1.6 ui-monospace,Consolas,monospace;'
    + 'color:#cfd6e6;background:rgba(10,12,20,0.6);border:1px solid rgba(34,211,238,0.18);'
    + 'border-radius:8px;padding:7px 12px;pointer-events:none;white-space:pre';
  canvas.parentElement.appendChild(el);
  return el;
}

export default {
  async create({ renderer, canvas }) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9cc7e4);
    scene.fog = new THREE.Fog(0x9cc7e4, 120, 700);

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 3000);
    // 시작 시점: 파도 마루를 따라가며 옆·앞에서 낮게 (말린 안쪽이 보이는 각도). F로 끄고 켠다
    const target = new THREE.Vector3(0, 1.5, -150);
    camera.position.set(-16, 4.5, -140);

    scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x8a7a5a, 1.1));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    sun.position.set(-60, 80, -120);   // 바다 쪽에서 비치는 역광
    scene.add(sun);

    const section = buildSectionTextures();
    const terrain = buildTerrain();
    const water = buildWater(section);
    const farSea = buildFarSea();
    scene.add(terrain, water.mesh, farSea);

    const orbit = createOrbit(camera, canvas, target);
    orbit.setView(-1.25, 1.42, 26);

    const backend = renderer.backend && renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2 (WebGPU 미지원 폴백)';
    const hud = createHud(canvas);
    let hudT = 0, frames = 0, fpsT = 0, fps = 0;
    const vCenter = () => water.front.v[S / 2];

    // 관찰용 시간 조절: Space = 일시정지, 1/2/3 = 0.25x/1x/2x
    let paused = false, timeScale = 1, follow = true;
    // C로 돌아가는 시점: 옆에서 단면 보기 / 앞·옆 비스듬히 / 높은 곳에서 해변 전체
    const VIEWS = [[-1.25, 1.42, 26], [-Math.PI / 2, 1.5, 22], [-0.5, 0.95, 150]];
    let view = 0;
    const onKey = e => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.code === 'Space') { paused = !paused; e.preventDefault(); }
      else if (e.key === '1') timeScale = 0.25;
      else if (e.key === '2') timeScale = 1;
      else if (e.key === '3') timeScale = 2;
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
      el.textContent = JSON.stringify({ v: water.front.v[S / 2], zCrest: water.front.zCrest, stride, pts });
    };
    window.addEventListener('keydown', onDebugKey);

    return {
      scene, camera,
      update(dt) {
        dt = Math.min(dt, 0.1);
        const simDt = paused ? 0 : dt * timeScale;
        water.front.step(simDt);
        water.uploadQuads();
        renderer.compute(water.computeSurface);
        if (follow) orbit.setTarget(0, 1.5, water.front.zCrest);

        frames++; fpsT += dt; hudT += dt;
        if (fpsT >= 0.5) { fps = frames / fpsT; frames = 0; fpsT = 0; }
        if (hudT >= 0.2) {
          hudT = 0;
          const vs = water.front.v;
          let vmax = 0; for (const x of vs) vmax = Math.max(vmax, x);
          hud.textContent = [
            `backend   ${backend}   ${fps.toFixed(0)} fps`,
            `수면      정점 ${water.layout.COUNT.toLocaleString()} · 삼각형 ${water.triCount.toLocaleString()}`,
            `파면      쿼드 ${S} · 정점당 검사 ${S} (전체 순회)`,
            `crest z   ${water.front.zCrest.toFixed(1)} m   V 가운데 ${vCenter().toFixed(2)} / 최대 ${vmax.toFixed(2)}`,
            `시간      ${paused ? '일시정지' : timeScale + 'x'}   (Space 정지 · 1/2/3 = 0.25x/1x/2x)
카메라    ${follow ? '파도 따라가기' : '자유'}   (F 따라가기 · C 시점 · 드래그 회전 · 휠 줌)`,
          ].join('\n');
        }
      },
      dispose() {
        orbit.dispose();
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('keydown', onDebugKey);
        document.getElementById('ocean-debug')?.remove();
        hud.remove();
        water.dispose();
        scene.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose();
        });
      },
    };
  },
};
