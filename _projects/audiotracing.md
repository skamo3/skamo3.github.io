---
title: AudioTracing
type: personal
category: game-graphics
period: "2025.06 - 2025.08"
order: 1
summary: "UE5.5 오디오 플러그인 · RTCore 기반 실시간 공간 음향, 55ms → 9ms 최적화"
result: "AudioComponent 30개 기준 55ms → 9ms (83% 지연 개선), UE Fab 마켓플레이스 출시"
team: "4인 1팀 (프로그래머 4인)"
stack: ["Unreal Engine 5.5", "UE C++", "UE Shader (usf)", "Perforce"]
link_cards:
  - name: "UE Fab 페이지"
    url: "https://www.fab.com/listings/8334fed3-f232-4b2f-a250-25f3b150f65c"
    desc: "Hardware-accelerated Real-Time Ray Traced Audio Plugin for Unreal Engine."
  - name: "주요 기술 포스터"
    url: "https://drive.google.com/file/d/1PffxuxWd7B5OQZmcsytJrBGNyQg3ZBgA/view"
    desc: "AudioTracing 프로젝트 주요 기술 요약 포스터"
    inline: true
toc:
  - label: "프로젝트 소개"
    anchor: "#프로젝트-소개"
  - label: "플러그인의 시작"
    anchor: "#플러그인의-시작"
  - label: "Architecture"
    anchor: "#architecture"
  - label: "SoundMaterial"
    anchor: "#soundmaterial"
  - label: "Editor Additive Function"
    anchor: "#editor-additive-function"
  - label: "Plugin Test Sequence"
    anchor: "#plugin-test-sequence"
  - label: "시연"
    anchor: "#시연"
---

# 프로젝트 소개

크래프톤 정글 게임테크랩에서 개발해 UE Fab 마켓플레이스에 출시한 UE5.5 오디오 플러그인입니다. 언리얼 엔진의 Lumen 하드웨어 레이트레이싱을 그대로 활용해, 복잡한 3D 환경에서 소리의 반사·차폐·지연 효과를 실시간으로 계산하는 공간 음향 시뮬레이션을 제공합니다.

- **기존 워크플로우 호환**: Sound Cue·MetaSound를 그대로 사용할 수 있고, UE의 Sound Attenuation 에셋에 플러그인 옵션(Spatialization/Reverb/Occlusion/Source Data Override)만 지정하면 바로 적용됩니다.
- **Iteration 비용 감소**: 다른 공간음향 솔루션들과 달리 사전 연산(Baking) 과정이 없어, 레벨에서 사운드 배치나 설정을 바꾸면 즉시 결과를 확인할 수 있습니다.
- **동적 환경 대응**: 레이트레이싱을 실시간으로 돌리기 때문에 벽이 열리거나 구조물이 움직이는 등 환경이 바뀌어도 반사·차폐가 그 즉시 반영됩니다. (단, Lumen 하드웨어 레이트레이싱을 지원하는 GPU가 필요합니다.)

# 플러그인의 시작

기존 UE 오디오 시스템은 설정은 복잡한데 반사·차폐 계산은 단순하다는 한계가 있었습니다. 조사해보니 이미 나와 있는 대안들도 각자 아쉬운 지점이 있었습니다.

- **Project Acoustics**(Microsoft): 사전 연산(Baking)이 필요하고 외부 시스템에 의존
- **THE FINALS류의 방식**: 미리 정의된 사운드를 쓰기 때문에 실시간 환경 변화 반영에 제한적

그러던 중 [vercidium의 "A First Look At Raytraced Audio"](https://www.youtube.com/watch?v=k8iX0vLIHMw)를 보고, "언리얼 엔진에 이런 기능이 있다면 유용하게 쓰일 것"이라고 생각한 게 이 프로젝트의 시작이었습니다. 이미 그래픽스 파이프라인에서 쓰고 있는 Lumen 하드웨어 레이트레이싱을, 소리의 경로를 추적하는 데도 그대로 활용할 수 있겠다고 판단했습니다.

# Architecture

초기 설계는 Component + Submix 조합이었습니다. 사운드가 나는 지점마다 Component를 붙이고, 반사·차폐 값은 Submix 단계에서 실시간으로 수정하려 했습니다. 그런데 Submix는 믹싱 이후 버스 단위로 처리되는 구조라 소스별로 다른 반사·지연 값을 실어 나르기 어려웠고, 런타임 중 수정도 불안정했습니다. 이 구조로는 한계가 명확했습니다.

관련 논문과 사례를 찾아보다가 Project Acoustics의 구조를 참고하게 됐고, 여기서 UE의 **Audio Plugin Interface**라는 개념을 제대로 알게 되었습니다. 이걸 적용하면서 아키텍처를 다음과 같이 견고화했습니다:

![오디오 출력 흐름 — World Subsystem에서 Active Sound를 수집하고, Audio Tracing이 GPU에서 Ray Tracing, CPU에서 Sound Parameter로 변환한 뒤, Audio Plugin Interface가 Delay/Reverb를 적용해 Spatializer와 Source Data Override로 내보냄](/assets/images/audiotracing/audio-output-flow.svg)

- **World Subsystem**: 사운드 계산은 특정 액터에 종속된 로직이 아니라 씬 전체를 참조하는 전역 로직이라, Component 대신 레벨 단위로 한 번만 관리하는 WorldSubsystem으로 옮겼습니다. 현재 재생 중인 Active Sound를 여기서 수집합니다.
- **Audio Tracing (GPU→CPU)**: GPU에서 레이트레이싱을 수행하고, 그 결과인 Ray Data를 CPU에서 Sound Parameter(Delay, RT60, Gain 등)로 변환합니다.
- **Audio Plugin Interface**: 변환된 파라미터를 UE 사운드 시스템에 후처리로 적용합니다. Delay & Reverb는 Spatializer와 Source Data Override 쪽으로 전달됩니다.

레이트레이싱 자체는 GPU 안에서 다음과 같은 흐름으로 처리됩니다:

![레이 트레이싱 흐름 — TLAS/Lumen H/W Hit Group Data/RayTracing Scene Metadata/Uniform Buffer를 입력으로 GPU의 TraceRayInline(Compute Shader)이 실행되고, 결과가 CPU의 Readback Buffer로 전달됨](/assets/images/audiotracing/ray-tracing-flow.svg)

Top-Level Acceleration Structure(TLAS), Lumen H/W Hit Group Data, RayTracing Scene Metadata, 그리고 View/Scene을 담은 Uniform Buffer를 입력으로 `TraceRayInline`을 Compute Shader에서 호출해 GPU에서 레이를 쏘고, 결과를 Readback Buffer로 CPU에 넘깁니다.

GPU에서 만들어진 Ray Data를 Sound Parameter로 변환하는 과정도 처음엔 병목이었습니다. 수천 개의 Ray 결과를 한 번에 처리하다 보니 Game Thread가 막혔는데, 이 파라미터화 연산을 Worker Thread로 분리하는 멀티스레드 구조로 리팩토링해서 <span class="stat">55ms → 9ms</span>(AudioComponent 30개 기준, 83% 개선)까지 줄였습니다.

# SoundMaterial

기존 방식은 소리가 반사되는 지점의 Material과 Scale 값만으로 반사량을 결정했습니다. 이러다 보니 맵을 만들고 표현하는 데 한계가 있었습니다 — 재질이 같아도 실제로는 다르게 들려야 하는 경우가 많은데, 그걸 세밀하게 조절할 방법이 없었습니다.

이를 해결하기 위해 `SoundMaterialComponent`라는 형태로, 소리가 부딪히는 Mesh에 난반사율·반사율·흡음 계수를 직접 부여할 수 있게 만들었습니다. 맵 디자이너가 레벨을 만들면서 공간마다 다른 음향 특성을 직접 조절할 수 있고, 에디터 안에서 실시간으로 시각화까지 지원합니다.

![SoundMaterial 에디터 — 풍차 메시에 난반사(녹색)와 반사(붉은색) 영역이 시각화되고, Details 패널에서 Scattering Factor/Reflection Factor/Absorption Coefficient를 직접 조절하는 모습](/assets/images/audiotracing/soundmaterial-editor.png)

## 물리 모델: Russian Roulette

레이 하나하나가 표면에 부딪힐 때마다 반사/흡수를 어떻게 계산할지가 관건이었습니다. 단순하게 흡수율만큼 에너지를 깎아나가는 방식은 레이가 많아질수록 연산량이 커집니다. 대신 **Russian Roulette** 기법을 적용해, 확률적으로 레이를 아예 소멸시키거나(연산 종료) 살아남은 레이에는 잃어버린 에너지를 확률로 보정해 실어주는 방식을 택했습니다 — 기댓값은 보존하면서 평균 연산량만 줄이는 몬테카를로 분산 감소 기법입니다.

![Russian Roulette 개념도 — 입사 에너지 1이 흡수율 1/3로 소멸하거나, 2/3 확률로 생존해 에너지를 1÷(2/3)=1.5로 보정받는 두 갈래](/assets/images/audiotracing/russian-roulette.svg)

이 방식이 실제로 정확한지 검증하기 위해 레이 개수(256/512/1024/2048개)별로 평균 에너지 값의 분산을 비교하는 실험도 진행했습니다. 오차² 값이 레이 개수(N)에 반비례(오차² ∝ 1/N)한다는 몬테카를로 이론대로, 레이 개수를 늘릴수록 결과가 더 안정적으로 수렴하는 것을 직접 확인했습니다.

# Editor Additive Function

SoundMaterial을 맵 전체에 적용하려면 오브젝트를 하나씩 선택해서 컴포넌트를 붙여야 하는 번거로움이 있었습니다. 이를 줄이기 위해 Outliner에서 여러 오브젝트를 일괄 선택한 뒤, 우클릭 메뉴에서 SoundMaterialComponent를 한 번에 추가·제거할 수 있는 기능을 만들었습니다.

![우클릭 메뉴에 추가된 Add/Remove Audio Tracing Sound Material Components 항목](/assets/images/audiotracing/editor-context-menu.png)

`UToolMenus` API로 `LevelEditor.ActorContextMenu`를 확장해서 만들었습니다:

![UToolMenus로 우클릭 메뉴에 AddSoundMaterial/RemoveSoundMaterial 항목을 등록하는 코드](/assets/images/audiotracing/editor-code-snippet.png)

UE Menu Tools를 직접 다뤄보면서, 실제 플러그인 사용자 입장에서 이런 편의 기능이 있어야 부가 기능까지 써보게 된다는 걸 체감했습니다.

# Plugin Test Sequence

플러그인을 만드는 중간중간, 그리고 완성된 뒤에 직접 테스트해볼 수 있는 데모 맵도 함께 만들었습니다. 좁은 복도, 큰 홀, 장애물이 있는 공간 등 상황별로 소리의 울림이 어떻게 달라지는지 확인할 수 있는 공간을 구성해, 제작 중에는 빠르게 결과를 검증하는 용도로, 완성 후에는 사용자가 플러그인으로 무엇을 할 수 있는지 직접 보여주는 용도로 활용했습니다.

# 시연

<div class="video-embed"><iframe src="https://www.youtube.com/embed/k8iX0vLIHMw" title="프로젝트 데모 영상" allowfullscreen></iframe></div>

<div class="video-embed"><iframe src="https://www.youtube.com/embed/WMZCPuDnvGU" title="시연 발표 영상" allowfullscreen></iframe></div>
