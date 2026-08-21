---
title: "[Graphics] 법선 벡터가 조명 계산에 왜 필요한가"
date: 2026-08-03
category: graphics
---

조명 계산에서 법선 벡터가 왜 중요한지 정리한다.

<a class="demo-card" href="/rendering-lab/#ch2">
  <img class="demo-thumb" src="/assets/images/blog/normal-vector-lighting/normal-correct.png" alt="법선 보정 데모 미리보기">
  <span class="demo-body">
    <span class="demo-label">인터랙티브 데모</span>
    <span class="demo-title">기본 조명 + 법선 보정</span>
    <span class="demo-desc">"재계산된 법선 사용" 토글로, 법선을 고치기 전과 후의 음영 차이를 바로 비교할 수 있다.</span>
    <span class="demo-go">데모 열기 →</span>
  </span>
</a>

## 법선이 왜 필요한가

법선은 그 지점의 표면에 수직인 벡터다. 표면이 어느 쪽을 향해 있는지, 즉 얼마나 기울어져 있는지를 나타낸다.

```glsl
float diffuse = max(dot(N, L), 0.0);
```

N은 법선, L은 표면에서 광원으로 가는 방향이다. 내적하면 두 벡터가 얼마나 같은 쪽을 향하는지 나온다. 양수면 빛이 그 면에 닿는다는 뜻이고 그 크기가 반사 정도를 나타낸다. 음수면 `max`로 0으로 잘라낸다.

여기서 법선이 구하는 건 "빛을 어디로 반사시킬지"가 아니라 "이 면이 빛을 얼마나 정면으로 받고 있는지(입사각)"다. Lambert는 입사각까지만 구하고, 빛을 받은 표면은 사방으로 고르게 흩어져 나간다고 가정하기 때문에 반사 방향은 계산하지 않는다. 그래서 하이라이트도 없다. 표면마다 이 입사각이 달라서 밝기가 달라지고, 그게 눈에 보이는 음영이 된다.

albedo와 ambient를 더하면 최종 색이 나온다.

```glsl
vec3 color = albedo * (ambient + diffuse * lightColor);
```

## 법선을 안 고치면 생기는 문제

Ch1의 지형은 평면 정점을 heightmap 높이로 밀어서 만들었는데, 평면 원본의 법선은 전부 위쪽을 향한 채 고정돼 있다. 정점을 밀어도 법선을 다시 계산하지 않으면 경사면도 평평한 곳처럼 조명 계산을 해서, 지형의 굴곡과 음영이 어긋난다.

변위 전 법선(aFlatNormal)과 변위 후 재계산한 법선(normal)을 토글로 바꿔 끼워서 확인했다.

```glsl
vec3 n = mix(aFlatNormal, normal, uUseCorrectNormal);
vNormal = normalize(mat3(modelMatrix) * n);
```

법선 재계산(`computeVertexNormals()`)은 한 정점 주변 삼각형들의 두 변을 외적해서 각 삼각형의 면 법선을 구하고, 그걸 평균 내는 방식으로 이뤄진다.

두 벡터를 외적하면 왜 그 둘에 수직인 벡터가 나올까.

```
a × b = (a2*b3 - a3*b2, a3*b1 - a1*b3, a1*b2 - a2*b1)
```

외적의 결과는 항상 두 벡터가 만드는 평면에 수직이다. 방향은 오른손 법칙으로 정해진다. 오른손 네 손가락을 a에서 b로 감아쥐면 엄지가 가리키는 쪽이다. 크기는 두 벡터가 이루는 평행사변형의 넓이와 같다. 삼각형의 두 변을 외적하면 크기가 그 삼각형 넓이의 2배가 된다.

<img src="/assets/images/blog/normal-vector-lighting/cross-product-diagram.svg" alt="벡터 a, b와 그 둘이 이루는 평면, 평면에 수직인 법선 n" style="max-width:100%; border-radius:6px; margin:0.5rem 0;">

<div style="display:flex; gap:8px; flex-wrap:wrap; margin:1rem 0;">
  <img src="/assets/images/blog/normal-vector-lighting/normal-wrong.png" alt="법선을 재계산하지 않은 경우 - 지형 굴곡과 무관하게 뭉개진 음영" style="flex:1; min-width:280px; max-width:100%; border-radius:6px;">
  <img src="/assets/images/blog/normal-vector-lighting/normal-correct.png" alt="법선을 재계산한 경우 - 능선과 골짜기를 따라 정확한 음영" style="flex:1; min-width:280px; max-width:100%; border-radius:6px;">
</div>

왼쪽은 법선이 안 고쳐진 경우다. 지형이 울퉁불퉁한데도 법선은 전부 같은 방향이라, 빛 정보가 사실상 없는 것과 같다. 굴곡과 무관하게 뭉개진 하이라이트만 보인다. 오른쪽은 법선을 재계산한 경우다. 능선과 골짜기를 따라 실제 반사가 생기고, 위치마다 다른 음영이 나온다.

## 실제 엔진에서는 이 재계산이 어떻게 일어날까

`computeVertexNormals()`는 three.js API 이름일 뿐, 알고리즘 자체는 엔진마다 공통이다. UE의 Recompute Normals나 Unity의 `Mesh.RecalculateNormals()`도 같은 계산을 한다. three.js는 정규화 전 외적 값을 그대로 더하기 때문에, 큰 삼각형일수록 자연스럽게 더 큰 영향을 주는 면적 가중 방식이 된다. DCC 툴은 여기서 한 단계 더 나가 정점에서의 삼각형 내각으로 가중치를 주는 각도 가중 평균을 쓰기도 한다.

다만 이 재계산은 보통 임포트나 로드 시점에 CPU에서 한 번 일어난다. 런타임에 GPU 정점 셰이더에서 메시를 변형하면(스키닝, WPO, 지금 한 지형 변위처럼) 엔진이 매 프레임 알아서 법선을 다시 계산해주지 않는다. 그래서 실시간으로 형태가 바뀌는 지형(UE Landscape, Unity Terrain)은 하이트맵의 이웃 텍셀 높이 차이로 접선 벡터 두 개를 만들고 외적해서 셰이더에서 법선을 구한다. Ch1에서 풀을 지형 경사에 맞춰 기울일 때 이웃 지점의 높이 차이로 법선을 구했던 것과 같은 방식이다.

## 앰비언트가 필요한 이유

diffuse만 있으면 빛의 반대편은 완전히 검게 죽는다. ambient는 그런 곳에도 최소한의 밝기를 깔아줘서 형태가 보이게 한다. 0으로 내리면 빛 반대편이 순수한 검은색이 되는 걸 확인할 수 있다.

## 정리

법선은 표면이 향한 방향이고, 정점을 옮기면 법선도 같이 다시 계산해야 한다. 지금 쓴 diffuse(Lambert)는 빛의 반사 정보만 가질 뿐 물질 자체의 특징(매끈함, 금속 여부)은 갖지 않는다. 다음 글에서는 여기에 반사(specular)를 순서대로 더해가며 Lambert에서 Phong을 거쳐 PBR까지 다룬다.
