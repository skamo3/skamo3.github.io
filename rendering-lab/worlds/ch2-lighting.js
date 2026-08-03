// Ch2 개념1 · 기본 조명 — Directional Light + 법선 보정
// Ch1에서 예고한 문제("정점을 옮기면 법선이 어긋난다")를 여기서 갚는다.
// 변위 전 평면 법선(aFlatNormal)과 변위 후 재계산한 법선(normal)을 토글로 바꿔 끼워
// 법선이 왜 필요한지, 안 고치면 무슨 일이 생기는지를 직접 비교한다.
// (쉐이딩 모델 비교·PBR은 별도 월드 ch2-pbr.js로 분리 — 랜드스케이프와 스튜디오 비교는
//  카메라 언어가 달라 한 화면에 있으면 스케일 감각이 어긋난다)
// 이론·정답: chapters/ch2-lighting.lesson.md
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'three/addons/libs/lil-gui.module.min.js';

const SEG = 120;
const SIZE = 20;

// [Vertex Shader] 법선을 월드 공간으로 넘긴다. 두 법선(변위 전/후) 중 하나를 골라 쓴다.
const terrainVertex = /* glsl */`
attribute float aH;          // 정규화 높이 0~1 (색용, CPU에서 넣어줌)
attribute vec3 aFlatNormal;  // 변위 "전" 평면의 법선 — 전부 로컬 (0,0,1), 안 고친 경우를 재현
uniform float uUseCorrectNormal;   // 1 = 재계산된 법선(normal) 사용, 0 = 변위 전 법선(aFlatNormal)
varying vec3 vNormal;   // 월드 공간 법선
varying float vH;

void main() {
  vec3 n = mix(aFlatNormal, normal, uUseCorrectNormal);
  // 조명은 월드 공간에서 계산한다. mat3(modelMatrix)로 로컬 법선을 월드로 회전시킨다.
  vNormal = normalize(mat3(modelMatrix) * n);
  vH = aH;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// [Fragment Shader] Lambert diffuse — 법선(N)과 빛 방향(L)의 내적으로 밝기를 정한다.
const terrainFragment = /* glsl */`
uniform vec3 uLightDir;    // 표면 → 광원 방향 (이미 정규화된 L)
uniform vec3 uLightColor;
uniform float uAmbient;    // 빛이 안 닿는 곳도 완전히 검게 죽지 않도록 하는 최소 밝기
varying vec3 vNormal;
varying float vH;

void main() {
  vec3 grass = vec3(0.10, 0.35, 0.15);
  vec3 dirt  = vec3(0.45, 0.38, 0.28);
  vec3 rock  = vec3(0.85, 0.86, 0.90);
  vec3 albedo = mix(grass, dirt, smoothstep(0.25, 0.50, vH));
  albedo = mix(albedo, rock, smoothstep(0.60, 0.85, vH));

  vec3 N = normalize(vNormal);
  float diffuse = max(dot(N, uLightDir), 0.0);

  vec3 color = albedo * (uAmbient + diffuse * uLightColor);
  gl_FragColor = vec4(color, 1.0);
}`;

// --- 높이 함수 (CPU, float64) — Ch1과 동일한 방식: 한 곳에서만 계산해 지형과 공유 ---
const fract = x => x - Math.floor(x);
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
  const lerp = (p, q, t) => p + (q - p) * t;
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
    scene.fog = new THREE.FogExp2(0x0a0d16, 0.025);

    const aspect = (canvas.clientWidth / canvas.clientHeight) || 1;
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 200);
    camera.position.set(0, 9, 16);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 1, 0);

    const params = {
      uAmp: 2.0, uFreq: 0.25,
      useCorrectNormal: true,
      elevation: 35, azimuth: 40,
      ambient: 0.12,
    };

    const uLightDir = { value: new THREE.Vector3(0, 1, 0) };
    const uLightColor = { value: new THREE.Color(0xfff2d9) };
    const uAmbient = { value: params.ambient };

    // ── 지형 (CPU 변위, Ch1과 동일한 방식) ──
    const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geometry.setAttribute('aH', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count), 1));
    // 변위 "전" 평면 법선을 따로 보관 — 전부 로컬 (0,0,1). 법선을 안 고치면 이 값이 끝까지 쓰인다.
    geometry.setAttribute('aFlatNormal', new THREE.BufferAttribute(geometry.attributes.normal.array.slice(), 3));

    const terrainMat = new THREE.ShaderMaterial({
      vertexShader: terrainVertex,
      fragmentShader: terrainFragment,
      uniforms: {
        uUseCorrectNormal: { value: params.useCorrectNormal ? 1 : 0 },
        uLightDir, uLightColor, uAmbient,
      },
    });
    const terrain = new THREE.Mesh(geometry, terrainMat);
    terrain.rotation.x = -Math.PI / 2;
    scene.add(terrain);

    function buildTerrain() {
      const amp = params.uAmp, freq = params.uFreq;
      const pos = geometry.attributes.position;
      const aH = geometry.attributes.aH;
      for (let i = 0; i < pos.count; i++) {
        const h = jFbm(pos.getX(i) * freq, pos.getY(i) * freq);
        pos.setZ(i, h * amp);   // 로컬 +Z로 변위 (회전 후 월드 +Y)
        aH.setX(i, h);
      }
      pos.needsUpdate = true;
      aH.needsUpdate = true;
      // 변위 후 삼각형 기울기로 법선을 다시 계산한다 — Ch1에서 예고했던 그 보정.
      geometry.computeVertexNormals();
    }
    buildTerrain();

    // 태양 방향: 고도(elevation)·방위각(azimuth) → 표면에서 광원으로 가는 단위벡터(L)
    function updateLightDir() {
      const el = params.elevation * Math.PI / 180;
      const az = params.azimuth * Math.PI / 180;
      uLightDir.value.set(
        Math.cos(el) * Math.sin(az),
        Math.sin(el),
        Math.cos(el) * Math.cos(az)
      ).normalize();
    }
    updateLightDir();

    // ── GUI ──
    const gui = new GUI({ title: 'Ch2 · 기본 조명' });
    gui.add(params, 'useCorrectNormal').name('재계산된 법선 사용')
      .onChange(v => { terrainMat.uniforms.uUseCorrectNormal.value = v ? 1 : 0; });
    gui.add(params, 'elevation', 5, 85, 1).name('태양 고도').onChange(updateLightDir);
    gui.add(params, 'azimuth', 0, 360, 1).name('태양 방위각').onChange(updateLightDir);
    gui.add(params, 'ambient', 0, 0.6, 0.01).name('환경광 세기')
      .onChange(v => { uAmbient.value = v; });
    gui.add(params, 'uAmp', 0, 5, 0.05).name('높이 (uAmp)').onChange(buildTerrain);
    gui.add(params, 'uFreq', 0.05, 0.6, 0.01).name('굴곡 (uFreq)').onChange(buildTerrain);
    gui.add(terrainMat, 'wireframe').name('지형 와이어프레임');
    gui.add(controls, 'autoRotate').name('자동 회전');

    return {
      scene,
      camera,
      update() {
        controls.update();
      },
      dispose() {
        geometry.dispose();
        terrainMat.dispose();
        controls.dispose();
        gui.destroy();
      },
    };
  },
};
