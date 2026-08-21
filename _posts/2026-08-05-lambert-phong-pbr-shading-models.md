---
title: "[Graphics] Light Shader 모델의 발전과 PBR"
date: 2026-08-05
category: graphics
---

Lambert, Phong, PBR 세 쉐이딩 모델이 뭘 다르게 계산하는지, 왜 그 순서로 나왔는지 정리한다.

<a class="demo-card" href="/rendering-lab/#ch2-pbr">
  <img class="demo-thumb" src="/assets/images/blog/lambert-phong-pbr-shading-models/pbr-edge.png" alt="쉐이딩 모델 비교 데모 미리보기">
  <span class="demo-body">
    <span class="demo-label">인터랙티브 데모</span>
    <span class="demo-title">쉐이딩 모델 비교 — Lambert · Phong · PBR</span>
    <span class="demo-desc">드롭다운으로 세 모델을 바로 바꿔가며 비교하고, metallic·roughness를 직접 조절해볼 수 있다.</span>
    <span class="demo-go">데모 열기 →</span>
  </span>
</a>

## 라이팅 모델의 역할

라이팅 모델은 빛을 어떻게 표현하는지를 계산하는 방법이다.

- Lambert: 표면에 닿은 빛의 산란만 계산. 빛이 사방으로 고르게 퍼지는 가장 단순한 모델
- Phong: Lambert의 산란에 더해 반사(specular)가 추가된 모델
- PBR: 물리 법칙에 맞춰 빛의 반사를 재정의한 모델

## Phong 모델의 특징과 한계

Phong이 Lambert에 반사(specular)를 처음 추가했지만, 물리적 근거 없이 그럴듯해 보이도록 만든 근사치일 뿐이다.

Lambert는 diffuse만 있어서 반사라는 개념 자체가 없다. 그래서 유리든 고무든 다 무광으로 보인다. Phong은 빛이 표면에서 거울처럼 튕겨나가는 방향(R)을 구하고, 카메라가 보는 방향(V)이 그 방향에 가까울수록 밝은 점을 그리는 방식으로 여기에 반사를 넣었다. `shininess`라는 값으로 그 밝은 점이 얼마나 좁고 강하게 나올지 조절한다.

<div style="display:flex; gap:8px; flex-wrap:wrap; margin:1rem 0;">
  <figure style="flex:1; min-width:280px; max-width:100%; margin:0;">
    <img src="/assets/images/blog/lambert-phong-pbr-shading-models/lambert-flat.png" alt="Lambert로 렌더링한 구슬 - 반사 없이 무광으로만 보인다" style="width:100%; aspect-ratio:3/2; object-fit:cover; display:block; border-radius:6px;">
    <figcaption style="text-align:center; font-size:0.85em; color:var(--muted, #888); margin-top:4px;">Lambert</figcaption>
  </figure>
  <figure style="flex:1; min-width:280px; max-width:100%; margin:0;">
    <img src="/assets/images/blog/lambert-phong-pbr-shading-models/phong-highlight.png" alt="Phong으로 렌더링한 구슬 - 뚜렷한 반사 하이라이트가 생긴다" style="width:100%; aspect-ratio:3/2; object-fit:cover; display:block; border-radius:6px;">
    <figcaption style="text-align:center; font-size:0.85em; color:var(--muted, #888); margin-top:4px;">Phong</figcaption>
  </figure>
</div>

왼쪽 Lambert는 어느 각도로 봐도 하이라이트가 없다. 오른쪽 Phong은 반사 방향에 밝은 점이 뚜렷하게 생긴다.

이 shininess는 실제 재질과 연결된 값이 아니라, 눈으로 보고 그럴듯하게 맞춘 숫자다. `specularColor`도 재질과 무관하게 임의로 정한 값이라, 금속이든 플라스틱이든 같은 흰 하이라이트를 넣을 수 있다.

더 큰 문제는 두 가지다.

- 시야각에 따른 반사 변화(Fresnel)가 없다. 정면에서 보든 가장자리에서 보든 똑같은 공식이 적용된다
- 에너지 보존이 없다. diffuse와 specular를 따로 계산해서 더하기 때문에, 표면에 닿은 빛보다 더 밝은 색이 나올 수 있다

## 물리 법칙을 바탕으로 구현한 PBR

> 참고: [물리 기반 렌더링(PBR)의 핵심 이론과 BRDF](https://mstone8370.tistory.com/60) — 이 글을 참고해서 학습했다

PBR을 관통하는 물리 법칙은 에너지 보존이다. 표면이 반사하는 빛의 총량은 원래 들어온 빛보다 많을 수 없다.

이 원칙 위에서 빛은 표면에 닿으면 세 갈래로 갈린다. 표면에서 바로 튕겨나가는 정반사, 안으로 파고들었다가 흩어져서 나오는 확산, 안에서 다시 나오지 못하고 사라지는 흡수. 이 셋을 더하면 정확히 100%다.

<img src="/assets/images/blog/lambert-phong-pbr-shading-models/light-surface-split.svg" alt="빛이 표면에서 정반사, 확산, 흡수로 갈라지는 경로를 보여주는 다이어그램" style="max-width:100%; border-radius:6px; margin:1rem 0;">

이렇게 갈라진 빛 중 정반사나 확산 방향이 카메라(눈) 쪽으로 향하면, 그 빛이 우리 눈에 들어와서 색으로 인식된다.

### 렌더링 방정식의 이해

렌더링 방정식은 표면의 한 점에서 카메라 쪽으로 나가는 빛의 양을 계산하는 식이다.

```
Lo(p, ωo) = Le(p, ωo) + ∫Ω fr(p, ωi, ωo) · Li(p, ωi) · (n·ωi) dωi
```

- Lo: 카메라 쪽(ωo)으로 최종적으로 나가는 빛의 양
- Le: 표면이 스스로 내뿜는 빛(발광). 대부분 0이다
- ∫Ω: 그 점 위 반구(Ω) 전체에서, 들어오는 모든 방향(ωi)의 빛을 다 더한다는 뜻
- fr: 들어온 빛(ωi)이 나가는 방향(ωo)으로 얼마나 반사되는지 정하는 함수
- Li: ωi 방향에서 들어오는 빛의 양
- (n·ωi): 표면이 그 방향을 얼마나 정면으로 향하는지 — Lambert의 코사인 법칙과 같은 항이다

이 중 fr이 BRDF(Bidirectional Reflectance Distribution Function, 양방향 반사율 분포 함수)다. 지금까지 말로 설명한 "이렇게 갈라진다"를 컴퓨터가 실제로 계산할 숫자로 바꿔주는 게 이 함수다.

재질마다 이 함수의 생김새가 다르다. 무광 표면은 어느 방향으로 봐도 비슷한 값을 주는 함수고, 유광 표면은 반사 방향에서만 크게 튀는 함수다. Lambert의 diffuse도, PBR의 specular(D·G·F)도 전부 이 fr 자리에 들어가는 서로 다른 구현일 뿐이다.

진짜 BRDF이려면 지켜야 하는 조건이 있다. 반사된 빛의 총량이 들어온 빛을 못 넘어야 하고(에너지 보존), 빛이 들어온 방향과 나가는 방향을 서로 바꿔도 같은 값이 나와야 한다(상호성). PBR은 이 조건을 지키게 설계됐다. Phong의 specular는 이 중 에너지 보존을 어긴다 — 그래서 Phong은 BRDF 자리에 들어가긴 해도 엄밀한 의미의 BRDF는 아니다.

### 미세면 이론(Microfacet Theory)

표면은 눈에는 매끈해 보여도, 확대해서 보면 수많은 미세한 굴곡(microfacet)들로 덮여 있다는 게 이 이론의 핵심 전제다. 이 미세면 하나하나는 완벽한 거울처럼 행동해서, 자기가 향한 방향에 맞게 빛을 정확히 반사한다.

roughness는 이 미세면들이 얼마나 들쭉날쭉하게 흩어져 있는지를 나타내는 값이다. roughness가 낮으면 미세면들이 거의 같은 방향으로 가지런히 정렬돼 있고, 높으면 사방으로 제각각 기울어져 있다.

표면 전체의 반사는 이 수많은 미세면을 하나하나 계산하는 게 아니라, "이런 미세면들이 이렇게 분포해 있다면 평균적으로 어떤 반사가 나올까"를 통계적으로 미리 풀어둔 공식으로 계산한다. Cook-Torrance가 이 통계를 구체적인 수식(D, G, F)으로 만든 모델이다.

### Cook-Torrance

Cook-Torrance는 1982년 Robert Cook과 Kenneth Torrance가 제안한 모델. 물체의 표면을 미세면(microfacet)들의 집합으로 보고 통계적 분포 반사로 계산하는 것이 핵심 아이디어이다. 최신 그래픽스에서 사용되는 PBR Specular 모델은 대부분 Cook-Torrance이거나 약간 변형된 버전이다.

미세면이 어떤 각도로 모여있고, 각 조각들이 서로 가려서 생기는 손실은 얼마인지, 각도에 따른 반사율은 어떻게 표현되는지를 수식으로 표현한 것이 Cook-Torrance 모델이다.

```
specular = D · G · F / (4 · (N·V) · (N·L))
```

여기 나오는 N, V, L은 각각 이런 방향이다.

- N (Normal): 표면이 향한 방향. 그 지점에 수직인 벡터
- V (View): 표면에서 카메라(눈) 쪽으로 향하는 방향
- L (Light): 표면에서 광원 쪽으로 향하는 방향

N·L은 표면과 광원의 관계다. Lambert의 diffuse가 이 값 하나로 계산됐다 — 카메라 위치와는 무관하다. N·V는 표면과 카메라의 관계다. 가장자리로 갈수록 N과 V 사이 각도가 90도에 가까워지고, N·V는 반대로 0에 가까워진다. G(기하 함수)가 이 두 값으로 가장자리에서 반사 손실이 커지는 걸 계산한다.

**D — 미세면 중 빛을 반사시키는 면을 구하는 식 (GGX)**

```
α = roughness²
D(H) = α² / (π · ((N·H)²·(α²−1) + 1)²)
```

노멀 방향이 H와 일치(정렬)하는 미세면이 얼마나 분포되어 있는지 계산하는 식이다. 표면을 확대해서 보면 미세한 거울 조각(microfacet)들의 집합인데, D는 그중 몇 개가 지금 정확히 반사가 일어나는 방향(H, 시야와 광원의 중간 방향)을 향하는지 구한다. 이 분포 함수를 GGX(Trowbridge-Reitz)라고 부른다.

roughness가 작으면(α가 작으면) N·H가 1에 가까운 아주 좁은 범위에서만 D가 크고 나머지는 0에 가까워 뾰족한 하이라이트가 된다. roughness가 크면 여러 방향으로 퍼져 흐릿한 광택이 된다. Phong의 shininess 제곱과 같은 역할을 하지만, D는 미세면 통계에서 유도된 물리적 근거가 있다는 차이가 있다.

**G — 미세면끼리 서로 가려서 생기는 손실**

```
k = (roughness + 1)² / 8
G1(X) = (N·X) / ((N·X)·(1−k) + k)
G = G1(V) · G1(L)
```

미세면이 H와 정렬되어 있어도 다른 미세면에 가려질 수 있다. 광원 쪽에서 가려지는 걸 Shadowing, 카메라 쪽에서 가려지는 걸 Masking이라 부르고, G는 이 둘을 실제로 얼마나 보이는지로 환산한 값이다. `G1(L)`이 Shadowing, `G1(V)`가 Masking을 계산해서 곱한다.

**F — 각도에 따른 반사율**

```
F0 = mix(0.04, baseColor, metallic)
F = F0 + (1 − F0) · (1 − max(dot(H, V), 0))^5
```

미세면이 빛을 얼마나 반사하는지 계산하는 식이다. F0은 정면에서 봤을 때 기본으로 반사되는 비율로, 비금속은 4% 근처, 금속은 baseColor를 그대로 쓴다. 여기에 시야각 보정이 붙어서, 가장자리로 갈수록 재질과 무관하게 반사율이 100%에 가까워진다.

## 정리

Lambert, Phong, PBR은 서로 대체 관계가 아니라 같은 문제를 점점 더 정확하게 푸는 계보다. Lambert는 산란만 계산해서 반사가 아예 없고, Phong은 반사를 처음 넣었지만 물리적 근거 없이 그럴듯해 보이는 근사치였다. PBR은 표면을 미세한 굴곡의 통계적 분포로 보고, 그 분포가 반사에 미치는 영향을 물리 법칙(에너지 보존, 상호성)에 맞게 계산해서 조립한 결과다.
