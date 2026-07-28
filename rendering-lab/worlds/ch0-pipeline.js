// Ch0 · 프레임이 그려지는 원리
// 커스텀 셰이더로 큐브 하나를 그린다. 반복 세팅(씬·카메라·컨트롤·GUI)은 채워져 있고,
// 핵심 로직만 빈칸(TODO)으로 남겨 직접 채운다. 이론·정답: chapters/ch0-pipeline.lesson.md
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'three/addons/libs/lil-gui.module.min.js';

// [Vertex Shader] 정점마다 1번 실행 — "정점을 화면 어디에 둘지" 결정
const vertexShader = /* glsl */`
uniform float uWobble;   // 정점 흔들기 세기 (GUI 슬라이더로 조절)
uniform float uTime;     // 매 프레임 증가 (애니메이션용)
varying vec3 vNormal;

void main() {
  vNormal = normalize(normal);   // 오브젝트 공간 법선 → 면마다 고정색 (회전 무관)

  vec3 p = position;

  // === TODO (Material 실습 1: 정점 흔들기) =========================
  // p 를 법선(normal) 방향으로 uWobble 만큼 밀어 큐브를 꿈틀거리게 해보자.
  // uTime 을 sin() 안에 넣으면 시간에 따라 움직인다.
  // 지금은 원본 그대로라 uWobble 슬라이더를 움직여도 반응이 없다.
  // 아래에 p 를 수정하는 코드를 직접 작성. (정답: lesson.md)

  // ==============================================================

  // MVP 변환 (Ch0 핵심 — 이미 채운 부분)
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

// [Fragment Shader] 픽셀마다 1번 실행 — "무슨 색으로 칠할지" 결정
const fragmentShader = /* glsl */`
uniform vec3 uColor;     // 단색 (GUI 컬러 피커로 조절)
uniform float uMix;      // 0이면 법선색, 1이면 단색 (GUI 슬라이더)
varying vec3 vNormal;

void main() {
  vec3 normalColor = vNormal * 0.5 + 0.5;  // 보간된 법선을 [0,1] 색으로

  // === TODO (Material 실습 2: 색 조정) ===========================
  // normalColor(법선색)와 uColor(단색)를 uMix 비율로 섞어보자.
  // uMix = 0 → 법선색, uMix = 1 → 단색이 되도록.
  // 힌트: GLSL 내장 함수 mix(a, b, t)
  // 지금은 법선색 고정이라 uMix / uColor 를 바꿔도 반응이 없다.
  vec3 color = normalColor;   // ← 이 줄을 uMix 로 섞도록 고치세요
  // ==============================================================

  gl_FragColor = vec4(color, 1.0);
}`;

export default {
  async create({ renderer, canvas }) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05060a);

    // Projection 행렬의 출처
    const aspect = (canvas.clientWidth / canvas.clientHeight) || 1;
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
    camera.position.set(2.4, 1.9, 3.3);

    // View 행렬을 마우스로 바꾸는 도구 (카메라를 큐브 주위로 회전)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // 큐브 하나 = draw call 하나. geometry가 정점 버퍼, ShaderMaterial이 셰이더 짝.
    // uniforms = 이 셰이더에 넘기는 "파라미터" — Material이 셰이더 + 파라미터임을 보여주는 지점.
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uColor:  { value: new THREE.Color(0x22d3ee) },
        uMix:    { value: 0.0 },
        uWobble: { value: 0.0 },
        uTime:   { value: 0.0 },
      },
    });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // 정점 위치가 보이도록 하는 관찰용 와이어프레임 (기본 꺼짐)
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: 0x22d3ee })
    );
    wire.visible = false;
    scene.add(wire);

    // GUI (배선은 완료 — TODO를 채우면 슬라이더가 살아난다)
    const params = { rotate: false };
    const colorProxy = { color: '#22d3ee' };
    const gui = new GUI({ title: 'Ch0' });
    gui.add(params, 'rotate').name('자동 회전');
    gui.add(wire, 'visible').name('와이어프레임');
    const mat = gui.addFolder('Material 파라미터');
    mat.add(material.uniforms.uMix, 'value', 0, 1, 0.01).name('단색 섞기 (uMix)');
    mat.addColor(colorProxy, 'color').name('단색 (uColor)')
      .onChange(v => material.uniforms.uColor.value.set(v));
    mat.add(material.uniforms.uWobble, 'value', 0, 0.5, 0.005).name('정점 흔들기 (uWobble)');

    return {
      scene,
      camera,
      update(dt) {
        material.uniforms.uTime.value += dt;   // 애니메이션용 시간 누적
        if (params.rotate) {
          cube.rotation.y += dt * 0.6;
          wire.rotation.copy(cube.rotation);
        }
        controls.update();
      },
      dispose() {
        geometry.dispose();
        material.dispose();
        wire.geometry.dispose();
        wire.material.dispose();
        controls.dispose();
        gui.destroy();
      },
    };
  },
};
