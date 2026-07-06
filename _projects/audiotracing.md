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

<div class="video-embed"><iframe src="https://www.youtube.com/embed/k8iX0vLIHMw" title="프로젝트 데모 영상" allowfullscreen></iframe></div>


설정이 복잡하고 반사, 차폐 계산이 단순한 기존 UE 오디오 시스템을 개선해,  
UE Lumen 레이트레이싱을 활용해 실시간 공간 음향 시스템을 만들자는 아이디어에서 출발한 프로젝트

# 플러그인의 시작

기존 UE 오디오 시스템은 설정은 복잡한데 반사·차폐 계산은 단순하다는 한계

 Vercidium의 ["A First Look At Raytraced Audio"](https://www.youtube.com/watch?v=u6EuAUjq92k)를 보고, "언리얼 엔진에 이런 기능이 있다면 유용하게 쓰일 것"이라고 생각
 이미 그래픽스 파이프라인에서 쓰고 있는 Lumen 하드웨어 레이트레이싱을, 소리의 경로를 추적하는 데에도 이용할 수 있을것이라 생각하여 프로젝트 시작
 

# 주요 담당 업무
- Audio Tracing 데이터 수집/처리 전체 구조 설계
- Sound Material, 에디터 부가 기능 구현
- 테스트 환경 구축 및 데모 제작
- 플러그인 Docs, Fab 페이지 문서 제작

# Architecture
- 초기 설계는 AudioTracingComponent + Submix 조합으로 구성
- PlayerController가 붙을 위치에 AudioTracingComponent를 붙이고 World 상의 Sound를 실시간으로 수집하고 Submix를 이용해 후처리에 이용
  
  -> 문제점 : Submix는 Sound Mixing 이후 나온 Bus 단위의 처리라 World 상에서 수집된 FActiveSound 소스 별 처리가 어려웠고, 런타임 중 값을 수정하는 것도 불안정하고 권장되지 않는 작업

- 관련 논문과 사례를 찾아보다 Microsoft의 Project Acoustics 를 발견했고, UE의 **Audio Plugin Interface** 에 대해 알게 되어 이를 바탕으로 구조 재설계
- 오디오 처리 흐름을 알기 위해 Unreal Engine의 SoundSystem을 전체적으로 분석했고, FActiveSound 로 수집되는 객체가 핵심임을 알아내어 이를 기반으로 데이터 플로우를 설계할 수 있었음

![Architecture — Subsystem에서 Active Sound를 수집하고, GPU의 Compute Shader에서 TraceRayInline으로 Ray Tracing을 수행한 뒤, Worker Thread에서 Sound Parameterization을 거쳐 Audio Plugin Interface가 Spatializer(TapDelay)와 Source Data Override(RT60 기반 Reverb Submix)로 후처리를 분기하는 최종 구조](/assets/images/audiotracing/architecture-diagram.png)

- **Subsystem**: Audio Device에서 현재 재생 중인 Active Sound를 필터링·수집
- **GPU**: Compute Shader에서 `TraceRayInline`으로 Ray Tracing 수행. 이 부분은 UE `SceneViewExtension`을 상속하는 구조로 제가 직접 설계해서 Lumen 데이터를 Hook-up하는 지점까지 만들었고, 실제 Compute Shader 코드는 팀원이 작성했습니다.
- **Worker Thread**: GPU가 만든 Ray Data를 받아 Sound Parameterization(파라미터화) 진행
- **Audio Plugin Interface**: 파라미터화된 값을 UE Sound 시스템에 후처리로 적용, 이후 Spatializer(TapDelay 생성·적용)와 Source Data Override(RT60 기반 Reverb Submix 적용)로 분기

레이트레이싱 자체는 GPU 안에서 다음과 같은 흐름으로 처리됩니다:

![레이 트레이싱 흐름 — TLAS/Lumen H/W Hit Group Data/RayTracing Scene Metadata/Uniform Buffer를 입력으로 GPU의 TraceRayInline(Compute Shader)이 실행되고, 결과가 CPU의 Readback Buffer로 전달됨](/assets/images/audiotracing/ray-tracing-flow.svg)

## Ray Data를 소리로: TapDelay / RT60 / Reverb

Ray 하나하나가 어디서 얼마나 반사됐는지는 그 자체로는 소리가 아닙니다. 이 수천~수만 개의 Ray 결과를 실제로 "어떻게 들리게 할지"로 바꾸는 파라미터화 단계가 필요했는데, 관련 논문들을 찾아보니 다음 세 가지 파라미터로 변환하는 방식이 가장 일반적으로 쓰이고 있었습니다.

- **TapDelay**: 초기 반사음(Early Reflection)을 표현하는 방식. Ray가 표면에 부딪히고 리스너까지 돌아오는 데 걸린 시간과 세기를 각각 하나의 지연(delay) 탭으로 만들어, 소리가 벽이나 구조물에 부딪혀 시간차를 두고 겹쳐 들리는 느낌을 구현
- **RT60**: 소리가 60dB만큼 감쇠하는 데 걸리는 시간으로, 공간이 얼마나 오래 울리는지(잔향의 길이)를 나타내는 지표. Ray가 얼마나 오래·많이 반사되며 살아남는지를 통계적으로 집계해서 계산
- **Reverb**: 계산된 RT60 값을 UE의 Reverb Submix 파라미터에 매핑해 후반 잔향(Late Reverberation)을 표현. 좁은 방과 넓은 홀이 서로 다르게 울리는 차이를 이 값 하나로 구현

## 파라미터화 병목과 스레드 분리

이렇게 만든 파라미터화 로직을 붙이고 실제 성능을 재보니, 병목은 GPU 레이트레이싱이 아니라 Ray Data를 Sound Parameter로 바꾸는 이 파라미터화 연산 쪽에 있었습니다. 수천 개의 Ray 결과를 Game Thread에서 한 번에 처리하다 보니 프레임이 막히는 문제였는데, 이 연산을 Worker Thread로 분리하는 멀티스레드 구조로 리팩토링해서 해결했습니다.

**스레드 분리 전** — `Parameterizing` 항목이 Cycle Counter 상위권을 차지하며 병목을 일으키는 모습
![스레드 분리 전 프로파일러 — AudioTracing StatGroup에서 Parameterizing 항목의 Cycle Counter가 높게 나타남](/assets/images/audiotracing/thread-before.png)

**스레드 분리 후** — Worker Thread 분리 이후 `Parameterizing` 비용이 크게 줄어든 모습
![스레드 분리 후 프로파일러 — Worker Thread 분리 후 Parameterizing 항목의 Cycle Counter가 크게 감소](/assets/images/audiotracing/thread-after.png)

그 결과 AudioComponent 30개 기준 <span class="stat">55ms → 9ms</span>(83% 개선)까지 지연을 줄일 수 있었습니다.

# SoundMaterial

기존 방식은 소리가 반사되는 지점의 Material과 Scale 값만으로 반사량을 결정했습니다. 이러다 보니 맵을 만들고 표현하는 데 한계가 있었습니다 — 재질이 같아도 실제로는 다르게 들려야 하는 경우가 많은데, 그걸 세밀하게 조절할 방법이 없었습니다.

이를 해결하기 위해 `SoundMaterialComponent`라는 형태로, 소리가 부딪히는 Mesh에 난반사율·반사율·흡음 계수를 직접 부여할 수 있게 만들었습니다. 맵 디자이너가 레벨을 만들면서 공간마다 다른 음향 특성을 직접 조절할 수 있고, 에디터 안에서 실시간으로 시각화까지 지원합니다.

![SoundMaterial 에디터 — 풍차 메시에 난반사(녹색)와 반사(붉은색) 영역이 시각화되고, Details 패널에서 Scattering Factor/Reflection Factor/Absorption Coefficient를 직접 조절하는 모습](/assets/images/audiotracing/soundmaterial-editor.png)

# Editor Additive Function

SoundMaterial을 맵 전체에 적용하려면 오브젝트를 하나씩 선택해서 컴포넌트를 붙여야 하는 번거로움이 있었습니다. 이를 줄이기 위해 Outliner에서 여러 오브젝트를 일괄 선택한 뒤, 우클릭 메뉴에서 SoundMaterialComponent를 한 번에 추가·제거할 수 있는 기능을 만들었습니다.

![우클릭 메뉴에 추가된 Add/Remove Audio Tracing Sound Material Components 항목](/assets/images/audiotracing/editor-context-menu.png)

`UToolMenus` API로 `LevelEditor.ActorContextMenu`를 확장해서 만들었습니다:

![UToolMenus로 우클릭 메뉴에 AddSoundMaterial/RemoveSoundMaterial 항목을 등록하는 코드](/assets/images/audiotracing/editor-code-snippet.png)

UE Menu Tools를 직접 다뤄보면서, 실제 플러그인 사용자 입장에서 이런 편의 기능이 있어야 부가 기능까지 써보게 된다는 걸 체감했습니다.

# Plugin Test Sequence

플러그인을 만드는 중간중간, 그리고 완성된 뒤에 직접 테스트해볼 수 있는 데모 맵도 함께 만들었습니다. 좁은 복도, 큰 홀, 장애물이 있는 공간 등 상황별로 소리의 울림이 어떻게 달라지는지 확인할 수 있는 공간을 구성해, 제작 중에는 빠르게 결과를 검증하는 용도로, 완성 후에는 사용자가 플러그인으로 무엇을 할 수 있는지 직접 보여주는 용도로 활용했습니다.

# 시연

<div class="video-embed"><iframe src="https://www.youtube.com/embed/WMZCPuDnvGU" title="시연 발표 영상" allowfullscreen></iframe></div>
