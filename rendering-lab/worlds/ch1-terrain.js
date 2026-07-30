// Ch1 · 지형과 표면 (누적 월드)
//   개념1: 지형 — 정점 변위 (CPU에서 계산)
//   개념2: Mesh 인스턴싱 — 풀 표현 (인스턴싱의 응용)
//
// 중요: 지형 높이는 CPU에서 한 번만 계산한다(single source of truth).
// GPU 셰이더에서 노이즈를 따로 계산하면 float32(GPU) vs float64(CPU) 차이로
// 표면이 최대 ~1 유닛까지 어긋나 풀이 뜬다. 그래서 CPU에서 지오메트리를 변위하고
// GPU는 그리기만 하며, 풀도 같은 CPU 높이를 샘플한다.
// 이론·정답: chapters/ch1-terrain.lesson.md
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'three/addons/libs/lil-gui.module.min.js';

const SEG = 120;
const SIZE = 20;
const GW = SEG + 1;

// [Vertex Shader] 변위는 이미 CPU에서 됨 → 그냥 그린다. 색은 정규화 높이(aH)로.
const vertexShader = /* glsl */`
attribute float aH;   // 정규화 높이 0~1 (CPU에서 넣어줌)
varying float vH;
void main() {
  vH = aH;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragmentShader = /* glsl */`
varying float vH;
void main() {
  vec3 grass = vec3(0.10, 0.35, 0.15);
  vec3 dirt  = vec3(0.45, 0.38, 0.28);
  vec3 rock  = vec3(0.85, 0.86, 0.90);
  vec3 color = mix(grass, dirt, smoothstep(0.25, 0.50, vH));
  color = mix(color, rock, smoothstep(0.60, 0.85, vH));
  gl_FragColor = vec4(color, 1.0);
}`;

// --- 높이 함수 (CPU, float64) — 이제 이게 유일한 소스 ---
const fract = x => x - Math.floor(x);
const lerp = (a, b, t) => a + (b - a) * t;
function jHash(x, y){
  let px = fract(x * 123.34), py = fract(y * 456.21);
  const d = px * (px + 45.32) + py * (py + 45.32);
  px += d; py += d;
  return fract(px * py);
}
function jNoise(x, y){
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const a = jHash(ix, iy), b = jHash(ix + 1, iy);
  const c = jHash(ix, iy + 1), d = jHash(ix + 1, iy + 1);
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}
function jFbm(x, y){
  let v = 0, a = 0.5;
  for (let i = 0; i < 5; i++) { v += a * jNoise(x, y); x *= 2; y *= 2; a *= 0.5; }
  return v;
}

export default {
  async create({ renderer, canvas }) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d16);
    scene.fog = new THREE.FogExp2(0x0a0d16, 0.03);

    const aspect = (canvas.clientWidth / canvas.clientHeight) || 1;
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 200);
    camera.position.set(0, 9, 16);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.6;
    controls.target.set(0, 1, 0);

    const params = { uAmp: 2.0, uFreq: 0.25 };

    // ── 개념1: 지형 (CPU 변위) ──
    const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geometry.setAttribute('aH', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count), 1));
    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader });
    const terrain = new THREE.Mesh(geometry, material);
    terrain.rotation.x = -Math.PI / 2;
    scene.add(terrain);

    // 높이 격자 = 렌더되는 지형 그 자체 (풀도 이걸 샘플)
    const heightGrid = new Float32Array(GW * GW);
    function buildTerrain() {
      const amp = params.uAmp, freq = params.uFreq;
      const pos = geometry.attributes.position;
      const aH = geometry.attributes.aH;
      for (let i = 0; i < pos.count; i++) {
        const h = jFbm(pos.getX(i) * freq, pos.getY(i) * freq);
        pos.setZ(i, h * amp);   // 로컬 +Z로 변위 (회전 후 월드 +Y)
        aH.setX(i, h);          // 색용 정규화 높이
        heightGrid[i] = h * amp;
      }
      pos.needsUpdate = true;
      aH.needsUpdate = true;
      geometry.computeVertexNormals();  // Ch2 조명 대비
    }

    // 로컬 (lx, ly)의 지형 높이를 격자에서 bilinear 샘플
    function sampleHeight(lx, ly) {
      let gx = (lx + SIZE / 2) / (SIZE / SEG);
      let gy = (SIZE / 2 - ly) / (SIZE / SEG);
      gx = Math.min(Math.max(gx, 0), SEG - 1e-4);
      gy = Math.min(Math.max(gy, 0), SEG - 1e-4);
      const ix = Math.floor(gx), iy = Math.floor(gy);
      const fx = gx - ix, fy = gy - iy;
      const h00 = heightGrid[iy * GW + ix],       h10 = heightGrid[iy * GW + ix + 1];
      const h01 = heightGrid[(iy + 1) * GW + ix], h11 = heightGrid[(iy + 1) * GW + ix + 1];
      return lerp(lerp(h00, h10, fx), lerp(h01, h11, fx), fy);
    }

    // ── 개념2: Mesh 인스턴싱 (풀 표현) ──
    const COUNT = 4000;
    const bladeGeo = new THREE.ConeGeometry(0.05, 0.5, 4);
    bladeGeo.translate(0, 0.25, 0);
    const bladeMat = new THREE.MeshBasicMaterial({ color: 0x4a9d4a });
    const grass = new THREE.InstancedMesh(bladeGeo, bladeMat, COUNT);
    grass.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    grass.frustumCulled = false;
    scene.add(grass);

    const dummy = new THREE.Object3D();
    const up = new THREE.Vector3(0, 1, 0);
    const cell = SIZE / SEG;
    function scatter() {
      for (let i = 0; i < COUNT; i++) {
        const lx = (Math.random() * 2 - 1) * (SIZE / 2);
        const ly = (Math.random() * 2 - 1) * (SIZE / 2);
        const height = sampleHeight(lx, ly);
        const Hx = (sampleHeight(lx + cell, ly) - sampleHeight(lx - cell, ly)) / (2 * cell);
        const Hy = (sampleHeight(lx, ly + cell) - sampleHeight(lx, ly - cell)) / (2 * cell);
        const normal = new THREE.Vector3(-Hx, 1, Hy).normalize();

        dummy.position.set(lx, height, -ly);
        dummy.quaternion.setFromUnitVectors(up, normal);
        dummy.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(up, Math.random() * Math.PI * 2));
        dummy.scale.setScalar(0.25 + Math.random() * 0.25);
        dummy.updateMatrix();
        grass.setMatrixAt(i, dummy.matrix);
      }
      grass.instanceMatrix.needsUpdate = true;
    }

    function rebuild() { buildTerrain(); scatter(); }
    rebuild();

    // ── GUI ──
    const gui = new GUI({ title: 'Ch1 · 지형 + 풀' });
    gui.add(params, 'uAmp', 0, 5, 0.05).name('높이 (uAmp)').onChange(rebuild);
    gui.add(params, 'uFreq', 0.05, 0.6, 0.01).name('굴곡 (uFreq)').onChange(rebuild);
    gui.add(material, 'wireframe').name('지형 와이어프레임');
    gui.add(grass, 'visible').name('풀 표시');
    gui.add(controls, 'autoRotate').name('자동 회전');

    return {
      scene,
      camera,
      update() {
        controls.update();
      },
      dispose() {
        geometry.dispose();
        material.dispose();
        bladeGeo.dispose();
        bladeMat.dispose();
        grass.dispose();
        controls.dispose();
        gui.destroy();
      },
    };
  },
};
