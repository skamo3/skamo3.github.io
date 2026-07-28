---
title: "[Graphics] three.js로 이해하는 렌더링 파이프라인 — MVP 변환·셰이더·Material"
date: 2026-07-27
category: graphics
---

렌더링을 이론으로만 알던 개념들을 직접 코드로 짚어보기 위해, three.js에서 커스텀 셰이더로 큐브 하나를 그려봤다.
three.js의 기본 재질을 쓰면 대부분을 엔진이 대신 처리해 흐름이 가려지는데, 셰이더를 직접 쓰면 정점이 화면 픽셀이 되기까지의 과정이 그대로 드러난다.

> 직접 만져볼 수 있는 데모: [/rendering-lab/#ch0](/rendering-lab/#ch0)

![MVP 변환을 정상적으로 거쳐 그려진 큐브. 면마다 법선 방향에 따라 다른 색을 낸다](/assets/images/blog/rendering-pipeline-basics/cube-correct.png)

## 렌더링 파이프라인의 세 단계

하나의 draw call이 실행되면 GPU는 크게 세 단계를 거쳐 픽셀을 만든다.

- **Vertex Shader** — 정점마다 1번 실행되며, 정점의 위치를 결정한다
- **Rasterizer** — 정점 3개로 이루어진 삼각형을 픽셀(프래그먼트)로 쪼개고, 정점 사이 값을 보간한다
- **Fragment Shader** — 픽셀마다 1번 실행되며, 그 픽셀의 색을 결정한다

핵심은 **정점 단계가 "어디에", 프래그먼트 단계가 "무슨 색으로"**를 담당한다는 분업이다. 이후의 모든 셰이딩 기법이 이 구조 위에 올라간다.

## Vertex와 Fragment 셰이더의 실행 횟수

두 셰이더는 실행 횟수가 다르다. 래스터라이저가 정점 3개짜리 삼각형 하나를 수많은 픽셀로 쪼개기 때문이다.
큐브 정점은 많아야 수십 개지만, 그 큐브가 화면에서 덮는 픽셀은 수천 개가 될 수 있다. 그래서 **보통은 프래그먼트 셰이더가 훨씬 많이 실행된다**.

다만 이게 항상 참은 아니다. 어느 쪽이 더 많은지는 **지오메트리 밀도와 화면 커버리지의 비율**에 달려 있다.
정점이 빽빽한 메시가 화면에 작게 나와 **삼각형이 픽셀보다 작아지면(sub-pixel triangle)**, 정점 실행이 프래그먼트를 앞지를 수 있다.
또한 GPU는 프래그먼트를 **2×2 쿼드 단위**로 처리해서, 1픽셀짜리 삼각형도 최소 4개의 프래그먼트를 깨운다.
잘게 쪼개진 메시가 성능에 불리하고 LOD가 필요한 이유가 여기에 있다.

## MVP 변환과 곱셈 순서

정점의 로컬 좌표를 화면에 올리려면 좌표계를 세 번 바꾼다.

- **Model** — 로컬 좌표를 월드 좌표로 옮긴다. 오브젝트 기준 (0,0,0)이라도 월드에서는 (2,4,1) 같은 위치를 가진다
- **View** — 월드 좌표를 카메라 기준 좌표로 옮긴다. 카메라가 물체를 바라보는 시점으로 변환한다
- **Projection** — 카메라 좌표에 FOV·화면비를 적용해 클립 좌표로 만든다. 이른바 원근 투영이다

three.js의 `ShaderMaterial`에서는 다음 한 줄이 이 변환을 담당한다.

```glsl
gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
```

변환을 아예 빼고 `gl_Position = vec4(position, 1.0)`으로 두면 어떻게 될까.
정점 좌표가 곧바로 클립 좌표가 되어, 카메라와 무관하게 화면 정중앙에 납작하게 붙는다.
View·Projection이 빠졌으니 마우스로 카메라를 돌려도 큐브는 꿈쩍하지 않는다.

![변환을 빼면 큐브가 원근 없이 납작한 사각형으로만 보인다](/assets/images/blog/rendering-pipeline-basics/cube-no-transform.png)

변환을 넣더라도 순서가 틀리면 결과가 깨진다. 행렬은 벡터에 **오른쪽에서 왼쪽으로** 적용된다.
맨 오른쪽 `position`에 `modelViewMatrix`(월드→카메라)가 먼저 적용되고, 그 결과에 `projectionMatrix`가 나중에 적용되어야 한다.
순서를 `modelViewMatrix * projectionMatrix`로 뒤집으면, 아직 카메라 공간으로 옮기지도 않은 좌표를 투영하는 셈이라 결과가 뭉개진다.

![곱셈 순서를 뒤집으면 큐브가 화면 밖으로 뭉개져 깨진다](/assets/images/blog/rendering-pipeline-basics/cube-mvp-swapped.png)

좌표계 변환은 정해진 공간 순서대로 밟아야 하고, 그 순서를 행렬곱이 강제한다.

## Material은 셰이더를 담은 객체

큐브 하나가 그려지기까지 네 조각이 각자 역할을 한다.

- **Geometry** — 정점·인덱스 버퍼, 즉 형태
- **Material** — 이 표면을 어떻게 그릴지 정의하는 셰이더와 파라미터, 즉 재질
- **Mesh** — geometry와 material을 묶은 하나의 오브젝트
- **Renderer** — 실제로 draw call을 내서 그리는 주체

```js
const geometry = new THREE.BoxGeometry(1, 1, 1);        // 형태
const material = new THREE.ShaderMaterial({ ... });      // 재질(셰이더가 담김)
const cube = new THREE.Mesh(geometry, material);         // 형태 + 재질
scene.add(cube);
renderer.render(scene, camera);                          // 실제로 그리는 지점
```

처음에는 `Material`이라는 이름 때문에 재질 정보만 담긴 줄 알았는데, 그 안에 셰이더가 들어 있다.
셰이더가 곧 "이 표면을 어떻게 칠할지"의 정의이므로, 셰이더가 재질 안에 있는 것이 자연스럽다.
그리는 행위 자체는 renderer가 맡고, material은 레시피일 뿐이다.

이 구조는 언리얼의 Material과도 그대로 대응된다.
언리얼 Material도 컴파일되면 셰이더가 되고, 정점을 움직이는 World Position Offset도 Material 안에 있다.
three.js의 `vertexShader`가 언리얼의 정점 단계, `fragmentShader`가 픽셀 단계에 해당한다.

## 면 색과 법선의 공간

프래그먼트 셰이더는 픽셀 색을 법선으로 정한다. 처음에는 법선을 뷰 공간(카메라 기준 좌표)으로 변환해 썼는데, 그러면 큐브를 회전시킬 때마다 면 색이 바뀐다.
색이 "면 고유의 값"이 아니라 "카메라에서 본 법선 방향"을 나타내기 때문이다.

각 면에 고정된 색을 주려면 변환하지 않은 오브젝트 공간 법선을 그대로 쓰면 된다. 큐브의 로컬 법선은 ±X·±Y·±Z로 회전과 무관하게 고정이라, 면마다 일정한 색이 나온다.

```glsl
// 뷰 공간 법선 — 회전에 따라 색이 변한다
vNormal = normalize(normalMatrix * normal);

// 오브젝트 공간 법선 — 면마다 색이 고정된다
vNormal = normalize(normal);
```

둘 중 뭐가 맞다기보다 용도가 다르다. 면을 구분해 보여주는 데는 고정색이 깔끔하지만, Fresnel이나 rim light 같은 시점 의존 효과에는 뷰 공간 법선이 필요하다.
조명 계산은 법선과 빛 방향을 같은 공간에 두고 내적해야 하므로, "법선을 어느 공간에서 쓰는가"가 다음 단계에서 중요해진다.

## CPU와 GPU의 역할 분담

three.js가 대신 처리하는 부분은 전부 CPU에서 일어난다. 정확히는 **행렬 준비까지가 CPU의 몫**이다.

- **CPU (three.js)** — 카메라·메시 정보로 행렬을 계산하고, uniform으로 셰이더에 넘기고, draw call을 제출한다
- **GPU (셰이더)** — 넘겨받은 행렬로 정점에 MVP 곱셈을 적용하고, 래스터화하고, 픽셀을 칠한다

즉 MVP 변환의 곱셈 자체는 GPU의 vertex shader에서 일어난다. three.js는 행렬을 준비해 넘길 뿐이다.

한 가지 흥미로운 지점은 three.js가 행렬을 **어중간하게 합쳐서** 넘긴다는 것이다.
`modelViewMatrix`(View·Model)는 CPU에서 미리 곱해 주지만, `projectionMatrix`는 따로 넘긴다.
예전에 자체 엔진을 만들 때는 CPU에서 P·V·M을 한 번에 곱해 하나의 MVP 행렬로 넘겼다. 정점마다 곱셈을 줄여 더 효율적이기 때문이다.
three.js가 Projection을 분리해 두는 이유는 유연성이다. 조명이나 안개 같은 효과는 **투영 전 카메라 공간 좌표**가 필요한데, MVP를 하나로 뭉치면 그 중간 좌표를 꺼낼 수 없다.
효율(전부 융합)과 유연성(중간 좌표 확보) 사이의 트레이드오프다.

## Draw call이 병목이 되는 이유

draw call은 CPU가 GPU에게 "이 정점 버퍼와 이 셰이더로 이만큼 그려라"라고 보내는 명령 한 번이다.
콜이 많아지면 문제가 되는데, 그 원인은 GPU가 받는 데이터 양이 아니라 **콜 하나마다 드는 CPU 쪽 고정 비용(draw call overhead)**이다.
콜마다 CPU가 상태를 세팅하고 드라이버에 명령을 제출하는데, 이 오버헤드가 콜 개수만큼 쌓이면 CPU가 GPU를 못 따라 먹여 GPU가 노는 상황이 된다.
그래서 최적화는 데이터를 줄이는 게 아니라 **콜 개수를 줄이는** 방향으로 간다. 같은 데이터를 한 번의 콜로 묶는 인스턴싱, 콜 제출을 여러 스레드로 나누는 멀티스레드 렌더링이 그 예다.

## 정리

이번 실습으로 렌더링의 토대가 되는 흐름을 짚었다. 정점이 MVP 변환을 거쳐 화면에 놓이고, 래스터라이저가 픽셀로 쪼개고, 프래그먼트 셰이더가 색을 칠한다.
Material은 그 셰이더를 담은 재질이고, 실제로 그리는 주체는 renderer이며, 콜 개수가 CPU 병목을 만든다.
다음 단계에서는 이 파이프라인 위에 정점을 변형하는 지형과 빛을 받는 재질을 쌓아 나간다.

## 전체 코드

글에서 다룬 큐브를 그리는 전체 코드다. 아래 내용을 `.html` 파일로 저장해 브라우저에서 열면 바로 돌아간다.

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <style> body { margin: 0; overflow: hidden; } </style>
</head>
<body>
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"
  }
}
</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// [Vertex Shader] 정점마다 실행 — 정점을 화면 클립 좌표로 옮긴다
const vertexShader = `
varying vec3 vNormal;
void main() {
  vNormal = normalize(normal); // 오브젝트 공간 법선 → 면마다 고정색
  // MVP 변환: 오른쪽→왼쪽으로 modelView(월드→카메라) → projection(투영) 순서로 적용
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// [Fragment Shader] 픽셀마다 실행 — 그 픽셀의 색을 정한다
const fragmentShader = `
varying vec3 vNormal;
void main() {
  vec3 color = vNormal * 0.5 + 0.5; // 보간된 법선을 [0,1] 색으로 매핑
  gl_FragColor = vec4(color, 1.0);
}`;

// Renderer — 실제로 draw call을 내는 주체
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);

// Projection 행렬의 출처
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(2.4, 1.9, 3.3);

// View 행렬을 마우스로 바꾸는 도구 (카메라를 큐브 주위로 회전)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Geometry(형태) + Material(재질=셰이더) = Mesh(오브젝트)
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// 매 프레임: 카메라 갱신 후 renderer가 그린다
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
</script>
</body>
</html>
```
