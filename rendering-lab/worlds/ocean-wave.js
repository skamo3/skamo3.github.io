// Ocean Wave · 해안가 부서지는 파도 (커리큘럼 밖 독립 실험, WebGPU 컴퓨트)
// 설계: chapters/ocean-wave.design.md
//
// P1: WebGPU 하네스 위에서 해변 + 평평한 수면 격자.
//   - 수면 정점 위치는 geometry가 아니라 storage 버퍼에 있고, 컴퓨트가 매 프레임 써넣는다.
//     지금은 평평하게만 쓰지만, P2부터 이 패스가 "compute C(수면 변형)"가 된다.
//   - 렌더 패스는 그 버퍼를 vertexIndex로 바로 읽는다 (CPU 왕복 없음).
//
// 주의: 이 월드는 three/webgpu 빌드만 쓴다. 'three'(WebGL 빌드)와 섞지 않는다.
import * as THREE from 'three/webgpu';
import {
  Fn, instanceIndex, vertexIndex, instancedArray, attribute,
  float, uint, vec3, mix, smoothstep, clamp,
} from 'three/tsl';

// ── 월드 좌표 규칙 ──
// 단위 m, 수면 y = 0. 해안선은 x축을 따라 놓이고 바다는 -z 쪽, 육지는 +z 쪽.
// 파도는 -z → +z 로 밀려온다.
const TERRAIN = { x0: -200, x1: 200, z0: -160, z1: 80, segX: 400, segZ: 240 };
const WATER   = { x0: -200, x1: 200, z0: -160, z1: 25, segX: 400, segZ: 185 }; // 정점 간격 1 m

// 만(bay) 모양 해안선: 가운데가 육지 쪽으로 들어가고 양옆은 곶처럼 바다로 나온다.
export function shoreZ(x) {
  return 14 * Math.exp(-((x / 60) ** 2)) - 4;
}

// 지형 높이 (해석적). 캐릭터 이동(P5)과 시뮬 바닥(P6~)도 이 함수를 공유한다.
export function terrainHeight(x, z) {
  const d = z - shoreZ(x);                 // + 육지 쪽 / - 바다 쪽, 해안선에서의 거리
  if (d >= 0) {
    // 완만한 모래사장 → 15~40 m 지점부터 사구로 솟음
    const dune = 3.5 * smoothstepJS(15, 40, d);
    const bumps = 0.35 * Math.sin(x * 0.13) * Math.sin(z * 0.21) * smoothstepJS(8, 25, d);
    return d * 0.05 + dune + bumps;
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
  const sea = new THREE.Color(0x6f6a55), grass = new THREE.Color(0x8a9a5b);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = terrainHeight(x, z);
    pos.setY(i, y);
    // 물에 젖는 띠(해안선 ±1.5 m) → 마른 모래 → 사구 위 풀
    c.copy(sea).lerp(wet, smoothstepJS(-3, -0.2, y));
    c.lerp(dry, smoothstepJS(0.3, 1.2, y));
    c.lerp(grass, smoothstepJS(3.0, 4.5, y));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.95 });
  return new THREE.Mesh(geo, mat);
}

// ── 수면: storage 버퍼 + 컴퓨트 ──
function buildWater() {
  const { x0, x1, z0, z1, segX, segZ } = WATER;
  const GX = segX + 1, GZ = segZ + 1, COUNT = GX * GZ;
  const DX = (x1 - x0) / segX, DZ = (z1 - z0) / segZ;

  // 인덱스(삼각형 연결)만 쓰려고 PlaneGeometry를 빌린다. 정점 순서가 컴퓨트의 (ix, iz)와 같아야 한다:
  // PlaneGeometry는 행 우선(iy → ix)이고 rotateX(-90°) 후 z = iy·DZ - halfZ 가 된다.
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);

  // 정점마다 바닥 높이 (수심 색용). 시뮬 단계에서는 bed 버퍼로 옮긴다.
  const pos = geo.attributes.position;
  const bed = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) bed[i] = terrainHeight(pos.getX(i), pos.getZ(i));
  geo.setAttribute('aBed', new THREE.BufferAttribute(bed, 1));

  // 정점 위치 버퍼: GPU 메모리에만 있다
  const posBuf = instancedArray(COUNT, 'vec3');

  // compute C (P1판): 정점 하나 = 스레드 하나. 격자 좌표 → 월드 위치, 높이 0
  const computeSurface = Fn(() => {
    const i = instanceIndex;
    const ix = i.mod(uint(GX));
    const iz = i.div(uint(GX));
    const x = float(ix).mul(DX).add(x0);
    const z = float(iz).mul(DZ).add(z0);
    posBuf.element(i).assign(vec3(x, 0.0, z));
  })().compute(COUNT);

  const mat = new THREE.MeshStandardNodeMaterial({ transparent: true, roughness: 0.08, metalness: 0.0 });
  mat.positionNode = posBuf.element(vertexIndex);   // 렌더 패스가 컴퓨트 결과를 그대로 읽음

  // P4 전까지 임시 셰이딩: 수심으로 색·불투명도만
  const depth = clamp(attribute('aBed', 'float').negate(), 0.0, 20.0);
  const shallow = vec3(0.18, 0.62, 0.62), deep = vec3(0.02, 0.16, 0.30);
  mat.colorNode = mix(shallow, deep, smoothstep(0.0, 8.0, depth));
  mat.opacityNode = mix(float(0.35), float(0.95), smoothstep(0.0, 4.0, depth));

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;  // 실제 위치는 버퍼에 있어서 geometry의 경계구를 믿을 수 없다 (P2~)
  return { mesh, computeSurface, vertexCount: COUNT };
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
  strip(-R, x0, z0, z1);     // 왼쪽
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
  return () => {
    dom.removeEventListener('pointerdown', down);
    dom.removeEventListener('pointermove', move);
    dom.removeEventListener('pointerup', up);
    dom.removeEventListener('wheel', wheel);
  };
}

function createHud(canvas, lines) {
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;left:16px;top:56px;z-index:5;font:12px/1.6 ui-monospace,Consolas,monospace;'
    + 'color:#cfd6e6;background:rgba(10,12,20,0.6);border:1px solid rgba(34,211,238,0.18);'
    + 'border-radius:8px;padding:7px 12px;pointer-events:none;white-space:pre';
  el.textContent = lines.join('\n');
  canvas.parentElement.appendChild(el);
  return el;
}

export default {
  async create({ renderer, canvas }) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9cc7e4);
    scene.fog = new THREE.Fog(0x9cc7e4, 120, 700);

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 3000);
    camera.position.set(-18, 14, 46);
    const target = new THREE.Vector3(0, 0, -6);

    scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x8a7a5a, 1.1));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    sun.position.set(-60, 80, -120);   // 바다 쪽에서 비치는 역광 (파도 투과광 보기 좋은 방향)
    scene.add(sun);

    const terrain = buildTerrain();
    const water = buildWater();
    const farSea = buildFarSea();
    scene.add(terrain, water.mesh, farSea);

    const disposeOrbit = createOrbit(camera, canvas, target);

    const backend = renderer.backend && renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2 (WebGPU 미지원 폴백)';
    const hud = createHud(canvas, [
      `backend   ${backend}`,
      `수면 정점  ${water.vertexCount.toLocaleString()} (1 m 격자)`,
      `compute   surface 1패스 / 프레임`,
    ]);

    return {
      scene, camera,
      update() {
        renderer.compute(water.computeSurface);
      },
      dispose() {
        disposeOrbit();
        hud.remove();
        scene.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose();
        });
      },
    };
  },
};
