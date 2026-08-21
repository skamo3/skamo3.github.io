---
title: "[Graphics] 바람 불어서 풀에 흔들림 적용하기"
date: 2026-07-30
category: graphics
---

[지난 글](/blog/2026/07/30/terrain-grass-instancing/)에서 heightmap 지형 위에 Mesh 인스턴싱으로 풀을 심었다. 생성한 풀에 Vertex Shader Animation을 이용해 바람에 흔들리는 효과를 구현한다.

<a class="demo-card" href="/rendering-lab/#ch1">
  <img class="demo-thumb" src="/assets/images/blog/vertex-shader-wind/grass-phase-minus.gif" alt="바람에 흔들리는 풀 데모 미리보기">
  <span class="demo-body">
    <span class="demo-label">인터랙티브 데모</span>
    <span class="demo-title">바람에 흔들리는 풀</span>
    <span class="demo-desc">바람 토글로 켜고 끄면서, 정점 셰이더가 풀을 어떻게 휘게 만드는지 비교해볼 수 있다.</span>
    <span class="demo-go">데모 열기 →</span>
  </span>
</a>

![바람에 흔들리는 풀](/assets/images/blog/vertex-shader-wind/grass-wind.gif)

바람은 시간에 따라 움직인다. 시간에 따라 풀이 흔들리면 바람이 부는 듯한 효과를 줄 수 있다. CPU에서 수천 개의 풀에 대한 연산을 적용하면 오버헤드가 발생한다. 풀 Mesh의 정점 Transform을 변경해주는 것은 단순 계산에 고반복 작업이기에 정점 Shader에서 연산을 해주면 오버헤드를 줄일 수 있다. 매 프레임 uTime 값으로 시간 값만 변화를 주어서 변화를 준다.

```glsl
uniform float uTime;
uniform float uWind;
void main() {
  vec3 instPos = instanceMatrix[3].xyz;   // 이 풀의 월드 위치
  float wave = sin(uTime * 1.5 + instPos.x * 0.4 + instPos.z * 0.4);
  vec3 p = position;
  p.x += wave * uWind * position.y;        // 윗부분일수록 많이 휨
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
}
```

땅에 박힌 밑동은 고정시키고 위로 갈수록 흔들림이 더 크게 작용하도록 하여 실제 풀과 비슷한 흔들림을 주었다.

인스턴스 별 월드 상 위치에 sin 값을 더해주어서 모든 풀이 군무를 추는 현상을 방지하고 각기 다르게 움직이도록 해주었다.

## 실제 풀처럼 보이도록 휘어짐 적용하기

여기까지 하면 풀이 흔들리긴 하는데 직선 형태로 기울어지기만 한다. 실제 풀은 위쪽이 살짝 휘어 있고, 바람이 불면 곡선을 그리며 흔들린다. 그래서 세 가지를 바꿨다.

먼저 풀 모양부터 바꿨다. 원뿔(Cone) 모양은 통통한 스파이크처럼 보여서, 위로 갈수록 좁아지는 납작한 잎 형태로 교체했다. 납작한 면이라 뒤에서 보면 사라지기 때문에 재질에 DoubleSide를 줘서 양면이 다 보이게 했다.

다음은 휘어짐이다. 처음에 곡선 코드를 넣었는데도 풀이 휘지 않고 기울기만 했다. 원인은 정점 밀도였다. 블레이드 정점이 밑동과 끝 두 곳에만 있으면 끝점 하나만 밀리기 때문에 옆면은 직선을 유지한다. 높이 세그먼트를 8로 늘려 중간 정점을 만들어주니 각 높이의 정점이 서로 다르게 밀리면서 곡선이 나왔다. 정점을 변형하는 디테일은 결국 정점 밀도가 결정한다.

휘어지는 정도는 높이의 제곱에 비례시켰다.

```glsl
float h = position.y / 2.0;          // 높이 0~1로 정규화
float bend = h * h;                  // 제곱 → 위로 갈수록 급격히 휨
float wave = sin(phase - h * 1.5);   // 위로 갈수록 위상 지연
p.x += (uCurve + wave * uWind) * bend;
```

높이에 선형 비례시키면 직선으로 기울기만 하고, 제곱으로 주면 밑동은 곧게 서 있다가 끝으로 갈수록 급격히 휘는 곡선이 된다. uCurve는 바람과 별개로 더해지는 정지 곡률로, 바람이 없어도 끝이 살짝 휘어 있게 해준다.

마지막은 파동의 방향이다. 처음에 sin(phase + h)로 했더니 끝이 먼저 움직이고 밑동이 따라오는, 뱀이 기어가는 듯한 모양이 됐다. 실제 바람은 밑동이 먼저 밀리고 위쪽이 관성으로 늦게 따라온다. sin 안의 부호를 -로 바꾸면 위로 갈수록 위상이 지연되어 밑동이 먼저 움직이는 자연스러운 흔들림이 된다.

<div style="display:flex; gap:8px; flex-wrap:wrap; margin:1rem 0;">
  <img src="/assets/images/blog/vertex-shader-wind/grass-phase-plus.gif" alt="phase + h, 끝이 먼저 움직여 뱀처럼 보이는 흔들림" style="flex:1; min-width:280px; max-width:100%; border-radius:6px;">
  <img src="/assets/images/blog/vertex-shader-wind/grass-phase-minus.gif" alt="phase - h, 밑동이 먼저 움직이는 실제 풀 같은 흔들림" style="flex:1; min-width:280px; max-width:100%; border-radius:6px;">
</div>

참고로 제곱 대신 로그 함수로 휘어짐을 표현하는 것도 생각해봤는데 두 가지 이유로 접었다. 로그는 아래쪽에서 급격히 꺾이고 위로 갈수록 완만해지는 오목한 곡선이라 풀보다는 꺾인 줄기 모양이 되고, 연산 비용도 h * h는 곱셈 1개인 반면 log는 GPU에서 별도 유닛을 타는 초월함수라 오히려 더 비싸다. 셰이더에서 x * x 같은 단순 곱셈은 가장 싼 연산에 속하고, log, exp, pow, sin 같은 초월함수가 비싼 쪽이다.

## 정적인 지형, 동적인 바람

지형은 프레임이 바뀌어도 정적이다. 그래서 로드할 때 1번만 계산하고 같은 데이터로 draw만 해준다. 하지만 바람은 동적으로 매 프레임 변화한다. 그래서 GPU 정점 셰이더에서 매 프레임 계산하도록 했다. CPU에서 매 프레임 계산해 올리게 되면 병목이 발생하게 된다.

같은 정점의 변화인데 정적이냐 동적이냐에 따라 CPU/GPU 연산 위치가 바뀐다. 이번 개념의 핵심 내용이다.

## 실제 UE 폴리지에서는 어떻게 적용될까?

UE에서도 같은 방식을 쓴다. UE에서는 Material의 WPO(World Position Offset)을 이용해 정점에 Position Offset을 주는데 이게 GPU 정점 셰이더 방식과 같은 역할을 한다. 다만 UE에서는 높이값 대신 vertex color를 이용해 아티스트 편의성이 더 제공되어있고, 바람의 방향과 세기 등은 전역 wind 액터로 관리된다. 나무의 경우에는 줄기 → 가지 → 잎으로 이어지는 계층적인 구조로 적용해 표현한다. 이번 글에서 한 실습은 바람 적용의 가장 근본적인 원리라고 할 수 있다.
