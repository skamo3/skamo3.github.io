---
title: "[Graphics] three.js로 지형 위에 풀숲 만들기 — heightmap · Mesh 인스턴싱"
date: 2026-07-30
category: graphics
---

[지난 글](/blog/2026/07/27/rendering-pipeline-basics/)에서는 렌더링 파이프라인의 기초를 정리했다. 이번에 만들어 볼 것은 heightmap을 이용해 평면을 지형으로 만드는 것과, 그 위에 풀을 배치하고 바람에 흔들리게 하는 것이다. 하나의 풀숲을 만들어보겠다.

<a class="demo-card" href="/rendering-lab/#ch1">
  <img class="demo-thumb" src="/assets/images/blog/terrain-grass-instancing/grass-fixed.png" alt="지형 + 풀숲 데모 미리보기">
  <span class="demo-body">
    <span class="demo-label">인터랙티브 데모</span>
    <span class="demo-title">지형 + 풀숲</span>
    <span class="demo-desc">heightmap의 높이·굴곡을 슬라이더로 바꿔가며 지형이 만들어지는 과정을 직접 볼 수 있다.</span>
    <span class="demo-go">데모 열기 →</span>
  </span>
</a>

## Noise 기반 HeightMap을 이용한 지형 만들기

지형은 평면에서 각 점들의 높낮이가 바뀔 때 생긴다. 수많은 정점을 기반으로 만들어진 평면에 각 정점의 높이를 변경시켜주면 언덕이 생기게 된다.

```
height = f(x, z)
정점을 height 만큼 위로
```

`f`가 heightmap. 실제 엔진에서는 텍스처 파일을 이용한 샘플링을 하지만, 여기선 텍스처 없이 절차적 노이즈(fbm)를 활용해 난수 값을 만들어내고, 이 값을 높이값으로 이용한다.

fbm(fractional Brownian motion)은 주파수가 다른 여러 노이즈를 겹쳐, 큰 지형 형태부터 미세한 디테일까지 한꺼번에 만드는 절차적 함수다.

fbm으로 구한 높이를 각 정점의 높이로 적용시키면 지형이 만들어진다. 여기에 더해 높이 별로 색을 칠해 봉우리, 흙바닥, 풀을 표현했다.

## Mesh 인스턴싱으로 최적화된 풀 표현하기

Mesh Instance를 하나하나 draw call 하게 되면 CPU가 처리하는 데에 한계가 생겨 병목이 생기게 된다. Instancing은 지오메트리 하나 + Shader 하나 + 인스턴스 별 변환 배열을 GPU에 한 번에 넘기는 기법으로, 한 번의 draw call로 수백 수천 개의 Mesh를 그려내는 방법이다.

```js
const grass = new THREE.InstancedMesh(bladeGeo, bladeMat, 4000);
const dummy = new THREE.Object3D();
for (let i = 0; i < 4000; i++) {
  dummy.position.set(x, height, z);       // 지형 표면 위치
  dummy.rotation.y = Math.random() * Math.PI * 2;
  dummy.scale.setScalar(0.25 + Math.random() * 0.25);
  dummy.updateMatrix();
  grass.setMatrixAt(i, dummy.matrix);      // 인스턴스별 변환 등록
}
```

인스턴스 별 변환 행렬 하나만 다르게 넣어주면 되기 때문에 반복되는 데이터를 줄이고 CPU → GPU call을 줄일 수 있다. GPU는 여전히 Instance 수 만큼 그려야 하지만, 병목을 줄인다는 점에 이점이 생긴다.

## 풀이 지형에 붙지 않고 뜨는 문제

지형의 기울기에 따라 풀도 기울기를 함께 잡으려 했는데, 기존에 지형 생성 시에 fbm 계산을 GPU에서 실행하고 있었다. 이러니 CPU에서 만들어진 값과 다를 수밖에 없고, 풀이 제대로 된 지형에 딱 붙지 않는 형태로 붕 뜨게 되었다.

<div style="display:flex; gap:8px; flex-wrap:wrap; margin:1rem 0;">
  <img src="/assets/images/blog/terrain-grass-instancing/float-1.png" alt="풀이 지형 위에 떠 있는 모습 1" style="flex:1; min-width:280px; max-width:100%; border-radius:6px;">
  <img src="/assets/images/blog/terrain-grass-instancing/float-2.png" alt="풀이 지형 위에 떠 있는 모습 2" style="flex:1; min-width:280px; max-width:100%; border-radius:6px;">
</div>

Claude에 처음 원인 분석을 시도했을 땐 지형 메시가 각졌거나 법선 벡터 계산의 문제라고 추론했지만, 위치 값을 잘못 찾는 것이라 생각해 다시 찾게 했고, 결과적으로 지형 높이 난수는 GPU에서 계산하고 풀 높이 난수는 CPU에서 계산해서 생긴 문제였다.

fbm은 좌표값에 따라 항상 같은 값이 나오는데, 계산의 정밀도가 CPU와 GPU에서 다르게 나온다. GLSL은 float32로, CPU 즉 JavaScript에서는 float64의 형태로 계산된다. 이 노이즈의 해시는 fract에 넣는 수가 0~8500 정도로 커지는데, float32로는 이렇게 큰 수의 소수부를 정확히 담지 못한다. 그래서 같은 좌표라도 CPU와 GPU가 서로 다른 값을 내게 되고, 지형과 풀이 각각 다른 표면 위에 놓여 풀이 떠버렸다.

같은 내용이 두 군데에서 따로 계산되어 적용된다면, 특히 난수의 경우 값이 틀어질 수 있다. 그래서 계산을 한 곳(CPU)에서만 하도록 바꿨다.

```js
// 노이즈를 CPU에서 한 번만 계산
const h = jFbm(x * freq, y * freq);
pos.setZ(i, h * amp);     // 지형: CPU가 정점을 직접 변위
heightGrid[i] = h * amp;  // 풀: 같은 값을 저장해두고 샘플
```

GPU 셰이더에서 fbm 계산을 빼고, CPU에서 만든 높이를 지형과 풀이 같이 쓰도록 하니 값이 어긋날 일이 없어졌다.

![풀이 지형 표면에 제대로 붙어 경사를 따라 심어진 모습](/assets/images/blog/terrain-grass-instancing/grass-fixed.png)

추가로 최적화도 됐다. 정적인 지형을 GPU에서 매 프레임 다시 계산하던 것을, CPU에서 한 번만 계산하도록 바꾼 셈이다. 다만 이건 지형이 움직이지 않을 때의 이야기다. 다음 글의 바람처럼 매 프레임 값이 바뀌는 경우라면 반대로 GPU에서 계산하는 게 맞다.

## 정리

이번에는 heightmap으로 평면을 지형으로 만들고, Mesh 인스턴싱으로 풀 수천 포기를 draw call 한 번에 심었다. 중간에 GPU와 CPU가 같은 노이즈를 따로 계산해서 표면이 어긋나는 문제를 겪었고, 계산을 한 곳에서만 하도록 바꿔서 해결했다.
다음 글에서는 이 풀에 정점 셰이더로 바람을 넣어볼 것이다. 매 프레임 값이 바뀌기 때문에 이번과 반대로 GPU에서 계산하게 된다.
