# Ch2 개념2 · 쉐이딩 모델 비교 — Lambert → Phong → PBR

> PBR을 처음 배운다는 전제로 쓴다. 세 모델을 **역사 순서 그대로** 하나씩 쌓아가며, 각 단계가 이전 단계의 어떤 한계를 메우는지 확인한다.
>
> 지형·법선 보정([개념1](ch2-lighting.lesson.md))과는 별도 월드다. 랜드스케이프를 멀리서 보는 것과 재질을 가까이서 비교하는 것은 카메라 언어가 달라, 한 화면에 있으면 스케일 감각이 어긋나서 분리했다.

## 왜 이 순서로 배우나

셋 다 "표면이 얼마나 밝게 보이는가"를 계산하는 모델이지만, 다루는 항이 다르다.

| | 다루는 것 |
|---|---|
| **Lambert** (1760년대) | 산란(diffuse)만 |
| **Phong** (1975년) | 산란 + 반사(specular)를 처음 추가 |
| **PBR / Cook-Torrance** (1980년대 이론, 2013년 전후 게임업계 표준화) | 반사를 물리 법칙(에너지 보존, 시야각 효과)에 맞게 다시 정의 |

즉 Phong은 "반사를 처음 넣어본 것"이고, PBR은 "그 반사를 물리적으로 옳게 고친 것"이다.

## 1. Lambert — 산란만 있는 가장 단순한 모델 (복습)

Ch2 개념1에서 이미 구현했다. 공식과 각 항의 의미를 다시 짚으면:

```
diffuse = max(N · L, 0)
최종색 = baseColor * (ambient + diffuse * lightColor)
```

| 기호 | 의미 |
|---|---|
| `N` | 법선 — 표면이 향한 방향 |
| `L` | 표면 → 광원 방향 |
| `N · L` | 두 방향이 얼마나 같은 쪽을 향하는지(코사인 값). 정면일수록 1에 가깝고, 비스듬할수록 0에 가까워진다 |
| `ambient` | 빛이 안 닿는 곳도 완전히 검게 죽지 않도록 하는 최소 밝기 |

**한계**: 표면이 매끈한지 거친지에 대한 정보가 전혀 없다. 유리든 고무든 다 무광으로 보인다. 반사(specular)가 아예 없다.

## 2. Phong — 반사(specular)를 처음 추가한 모델

1975년 Bui Tuong Phong이 제안했다. 아이디어: 빛이 표면에서 **거울처럼 정반사되는 방향(R)**을 구하고, 카메라가 그 방향에 가까이서 볼수록 밝은 점(하이라이트)을 그린다.

```
R = reflect(-L, N)                        // 정반사 방향
specular = max(dot(R, V), 0) ^ shininess  // 하이라이트 세기
최종색 = baseColor * (ambient + diffuse * lightColor) + specular * specularColor * lightColor
```

| 기호 | 의미 |
|---|---|
| `R` | 빛이 표면에서 거울처럼 튕겨나가는 방향. GLSL `reflect(I, N) = I - 2·(N·I)·N`이고, 여기선 입사 방향 `I = -L`을 넣어 반사 방향을 얻는다 |
| `V` | 표면 → 카메라 방향 (시야 방향) |
| `dot(R, V)` | 카메라가 정확히 반사 방향에 있을수록 1, 벗어날수록 0에 가까워진다 |
| `shininess` | 그 값을 몇 제곱할지. 크게 제곱할수록 1 근처의 좁은 영역만 남고 나머지는 급격히 0으로 꺼져서, 하이라이트가 좁고 날카로워진다 |
| `specularColor` | 하이라이트의 색. 재질과 무관하게 **임의로** 정한다 (보통 흰색) |

**한계 (PBR이 등장한 이유)**

- `shininess`는 물리적 단위가 없는 임의의 숫자다. "30이면 어느 정도 재질인가"를 감으로 맞춰야 한다
- `specularColor`가 재질과 무관하게 따로 설정된다. 금속이든 플라스틱이든 같은 흰 하이라이트를 넣을 수 있어, 물리적으로 말이 안 되는 조합도 만들어진다
- 시야각에 따른 반사 변화(Fresnel)가 없다 — 정면이든 가장자리든 같은 공식이 적용된다
- 에너지 보존이 없다 — diffuse와 specular를 각각 마음대로 더해서, 이론상 원래 빛보다 밝은 표면도 나올 수 있다

## 3. PBR (Cook-Torrance) — 반사를 물리적으로 다시 정의

PBR은 Phong의 반사 항을 통째로 갈아엎는다. 표면에 닿은 빛은 **반사(specular)**와 **산란(diffuse)** 두 갈래로 나뉘고, 그 합이 원래 빛의 양을 넘지 못한다(에너지 보존)는 물리 법칙을 지킨다.

반사 항은 세 개의 하위 항으로 쪼갠다.

```
specular = D · G · F / (4 · (N·V) · (N·L))
```

**D — 분포 함수 (Trowbridge-Reitz GGX)**

```
α = roughness²
D(H) = α² / (π · ((N·H)²·(α²−1) + 1)²)
```

표면은 현미경으로 보면 미세한 거울 조각(microfacet)들의 집합이다. `D`는 그중 몇 개가 "지금 정확히 반사가 일어나는 방향(H, 시야와 광원의 중간 방향)"을 향하는가를 나타낸다. `roughness`가 작으면(`α`가 작으면) `N·H`가 1에 가까운 아주 좁은 범위에서만 `D`가 크고 나머지는 0에 가까워 **뾰족한 하이라이트**가 된다. `roughness`가 크면 여러 방향으로 퍼져 **흐릿한 광택**이 된다. Phong의 `shininess` 제곱과 역할이 비슷하지만, `D`는 미세면 통계에서 유도된 물리적 근거가 있고 `roughness` 0~1이 직관적이다.

**G — 기하 함수 (Smith-Schlick-GGX)**

```
k = (roughness + 1)² / 8
G1(X) = (N·X) / ((N·X)·(1−k) + k)
G = G1(V) · G1(L)
```

미세면 조각들이 서로 빛을 가리는(self-shadowing, masking) 정도를 보정한다. 표면이 거칠수록 조각들이 삐죽삐죽해서 서로를 가리는 일이 많아지고, 그만큼 실제로 눈에 도달하는 반사광이 줄어든다. `G`가 이 손실을 반영해 반사를 깎아준다.

**F — Fresnel-Schlick**

```
F0 = mix(0.04, baseColor, metallic)
F = F0 + (1 − F0) · (1 − max(dot(H, V), 0))^5
```

같은 표면도 정면보다 가장자리(grazing angle)에서 더 많이 반사된다 — 물웅덩이를 위에서 보면 바닥이 보이지만 멀리서 비스듬히 보면 하늘만 비치는 것과 같은 현상이다. `F0`는 정면에서의 기본 반사율로, 비금속은 대략 4%(대부분의 유리·플라스틱이 이 근처), 금속은 자기 고유색을 그대로 쓴다 — **금속만 유색 반사를 갖는 이유**가 여기서 나온다.

**최종 합성 — 에너지 보존**

```
kS = F                          // 반사로 나가는 에너지 비율
kD = (1 − kS) · (1 − metallic)  // 나머지 중 비금속인 부분만 diffuse로
diffuse = kD · baseColor / π    // π로 나누는 이유: Lambertian BRDF가 반구 전체에 고르게 퍼지도록 정규화하는 상수
최종색 = (diffuse + specular) · lightColor · (N·L) + ambient · baseColor
```

`kS + kD`가 1을 넘지 않도록 설계되어 있다 — 반사로 나간 만큼 산란은 줄어든다. 이게 Phong에는 없던 **에너지 보존**이다.

## 렌더링 방정식 — 지금까지 만든 공식은 다 여기서 나온다

Lambert, Phong, PBR이 각자 다른 공식을 썼지만, 사실 셋 다 하나의 방정식을 서로 다르게 근사한 것이다. 이 방정식을 렌더링 방정식(Rendering Equation)이라고 부른다.

```
Lo(p, ωo) = Le(p, ωo) + ∫Ω fr(p, ωi, ωo) · Li(p, ωi) · (n·ωi) dωi
```

| 기호 | 의미 |
|---|---|
| `Lo(p, ωo)` | 점 p에서 ωo 방향(카메라 쪽)으로 나가는 빛의 양 |
| `Le(p, ωo)` | 그 점 자체가 스스로 내뿜는 빛(발광, emissive). 대부분의 표면은 0 |
| `∫Ω ... dωi` | 그 점 위 반구(Ω) 전체에서, 들어오는 모든 방향(ωi)의 빛을 다 더한다는 뜻 |
| `fr(p, ωi, ωo)` | BRDF(양방향 반사율 분포 함수). 들어온 빛(ωi)이 나가는 방향(ωo)으로 얼마나 반사되는지 비율을 정하는 함수 |
| `Li(p, ωi)` | ωi 방향에서 들어오는 빛의 양 |
| `(n·ωi)` | 그 방향이 법선과 얼마나 정렬돼 있는지 — Lambert의 diffuse에서 이미 썼던 그 코사인 항과 같다 |

`fr()` 자리에 지금까지 만든 게 그대로 들어간다.

```
Lambertian diffuse BRDF:     fr = baseColor / π
Cook-Torrance specular BRDF: fr = D · G · F / (4 · (N·V) · (N·L))
```

Lambert·Phong·PBR의 차이는 결국 "이 `fr()` 함수를 얼마나 정교하게 만들었는가"의 차이였던 셈이다.

**그런데 왜 지금 코드엔 적분(`∫`)이 없을까.** 적분은 "반구 전체에서 들어오는 빛을 다 더한다"는 뜻인데, 실제로는 하늘 전체·주변 물체 전체에서 빛이 들어온다. 근데 지금 씬의 광원은 `DirectionalLight` 딱 하나뿐이다. 방향이 정확히 하나로 고정된 빛은 반구 위 무수히 많은 방향 중 딱 한 점에서만 빛이 있고 나머지는 전부 0인 것과 같다. 그래서 적분이 "그 한 방향에서의 값 하나"로 줄어들고, 아래 코드 한 줄이 곧 그 적분을 계산한 결과다.

```glsl
// 렌더링 방정식의 적분을, 광원이 하나뿐이라 한 줄로 압축한 것
vec3 color = (diffuse + specular) * uLightColor * NdotL + uAmbient * uBaseColor;
```

빛이 여러 개면 이 계산을 광원 수만큼 더하면 되고, 하늘 전체가 빛나는 환경광(IBL)까지 반영하려면 이 적분을 진짜로(또는 근사해서) 계산해야 한다. 지금 만든 구슬의 실시간 환경 반사(주변을 큐브맵으로 찍어서 비추는 것)도 이 적분을 아주 거칠게 근사한 버전이다.

## Phong의 specular와 PBR의 D — 사실 같은 자리에 있는 항이다

Phong의 `pow(dot(R,V), shininess)`와 PBR의 `D(H)`는 둘 다 "하이라이트가 얼마나 좁고 날카로운가"를 정하는 항으로, 같은 역할을 한다. 차이는 **유도 방식**이다.

- Phong(1975): R·V 코사인을 그냥 임의의 지수로 제곱 — 근거 없는 어림수
- Blinn-Phong(1977): R 대신 계산이 더 싼 반각벡터 H를 사용 — 여전히 어림수지만 성능 개선
- PBR의 GGX(1980~2010년대 정착): 미세면 통계 분포에서 수학적으로 유도 — `roughness`가 실제 표면 거칠기와 대응됨

즉 셋은 대체 관계가 아니라 **같은 문제를 점점 더 정확하게 푸는 계보**다.

## 세 모델 비교

| | Lambert | Phong | PBR (Cook-Torrance) |
|---|---|---|---|
| Diffuse | O | O | O (금속이면 감소) |
| Specular | 없음 | 있음 (임의의 흰 하이라이트) | 있음 (재질에서 유도, 색까지 결정) |
| 재질 파라미터 | 없음 | shininess (물리적 의미 없음) | roughness/metallic (직관적) |
| 시야각 반사 변화(Fresnel) | 없음 | 없음 | 있음 |
| 에너지 보존 | 해당 없음(반사가 없어 자명) | 없음 | 있음 |
| 나온 시기 | 1760년대 (요한 하인리히 램버트) | 1975년 (Bui Tuong Phong) | 1980년대 이론, 2013년 전후 게임업계 표준화 |

## 이론 → 코드 매핑

구슬(SphereGeometry) 하나에 재질 세 개(Lambert/Phong/PBR ShaderMaterial)를 만들어두고, GUI 드롭다운으로 `sphere.material`을 바꿔 끼운다.

`worlds/ch2-pbr.js`에서

- `uLightDir`, `uLightColor`, `uAmbient`, `uCameraPos`, `uBaseColor` = 세 재질이 공유하는 uniform (하나만 바꾸면 셋 다 갱신된다)
- Phong 전용: `uShininess`, `uSpecularColor`
- PBR 전용: `uMetallic`, `uRoughness`, 그리고 제공된 `D_GGX()` / `G_Smith()` 함수
- GUI의 "쉐이딩 모델" 드롭다운(맨 위)을 바꾸면 `sphere.material`을 교체하고, 그 모델에 해당하는 옵션 폴더만 보이게 한다

## 실습 (직접 채우기)

**Lambert** — 개념1에서 이미 채운 공식을 그대로 재사용한다 (별도 TODO 없음).

**TODO A — Phong specular**

```glsl
// 정답
float specular = pow(max(dot(R, V), 0.0), uShininess);
```

**TODO B — Fresnel-Schlick (PBR)**

```glsl
// 정답
vec3 F = F0 + (1.0 - F0) * pow(1.0 - max(dot(H, V), 0.0), 5.0);
```

**TODO C — 에너지 보존 합성 (PBR)**

```glsl
// 정답
vec3 kS = F;
vec3 kD = (1.0 - kS) * (1.0 - uMetallic);
vec3 diffuse = kD * uBaseColor / PI;
vec3 color = (diffuse + specular) * uLightColor * NdotL + uAmbient * uBaseColor;
```

## 관찰 포인트

- 드롭다운을 Lambert → Phong → PBR 순서로 바꿔가며 같은 베이스 컬러·같은 조명에서 얼마나 다르게 보이는지 비교한다
- Phong에서 `shininess`를 낮췄다 높였다 하며 하이라이트가 퍼졌다 좁아지는 걸 본다. `specularColor`를 바꿔 흰 하이라이트가 아닌 색 있는 하이라이트도 만들어본다 (물리적으로 이상한 조합도 가능하다는 걸 직접 확인하는 것)
- PBR에서 metallic=1일 때와 Phong의 흰 하이라이트를 비교한다 — PBR은 금속색이 반사에 묻어나지만 Phong은 specularColor를 직접 바꾸지 않는 한 항상 같은 색이다
- 구슬을 비스듬히(가장자리) 봤을 때 PBR만 반사가 밝아지는 것(Fresnel)을 Lambert·Phong과 비교한다

## 엔진 매핑

- **UE**: 지금은 Lit(PBR) 모델이 기본이고, Phong/Blinn-Phong은 UE3 시절 유산이거나 커스텀 Shading Model로만 남아있다
- **Unity**: 레거시 Built-in RP의 `Specular` 셰이더가 Blinn-Phong 계열, URP/HDRP Lit은 PBR(Metallic-Roughness 또는 Specular-Glossiness 워크플로)
- **D3D**: 고정 파이프라인 시절 `D3DLIGHT` 구조체가 Phong 계열 파라미터(ambient/diffuse/specular/power)를 그대로 노출했던 API, 지금은 프로그래머블 셰이더에서 직접 구현한다

## 글감 질문

1. Phong과 PBR은 둘 다 specular가 있는데, 근본적인 차이는 뭘까?
2. Phong의 `shininess`와 PBR의 `D` 항은 같은 역할을 하는데, 왜 유도 방식이 다르다고 하는 걸까?
3. Fresnel 효과가 없는 모델(Lambert, Phong)은 실제로 뭐가 어색하게 보이나?
4. 에너지 보존이 없다는 게 Phong에서 구체적으로 어떤 문제로 이어지나?
5. 금속성이 1일 때 PBR과 Phong의 결과가 어떻게 다르게 보이나?
6. 렌더링 방정식의 적분(`∫`)이 우리 코드에서는 왜 곱셈 한 줄로 끝나나?
7. 광원이 여러 개거나 환경광(IBL)까지 있으면, 지금 코드의 어느 부분을 어떻게 바꿔야 할까?
