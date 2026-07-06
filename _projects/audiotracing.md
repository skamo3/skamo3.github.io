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
links:
  - label: "UE Fab"
    url: ""
  - label: "시연 영상"
    url: ""
  - label: "최종 발표 영상"
    url: ""
---

# 왜 만들었는가

기존 UE 오디오 시스템은 설정이 복잡한 데 비해 반사·차폐 계산은 단순했습니다. 복잡한 3D 환경에서 소리가 벽에 막히고(차폐), 벽에 부딪혀 되돌아오고(반사), 공간에 남아 울리는(잔향) 과정을 실제 지오메트리 기준으로 반영하려면 매번 사운드 디자이너가 손으로 파라미터를 맞춰야 했습니다. 하드웨어 가속 레이트레이싱을 이미 그래픽스 파이프라인(UE Lumen)에서 쓰고 있다면, 같은 자원을 공간 음향 계산에도 활용할 수 있지 않을까 하는 질문에서 이 프로젝트가 시작됐습니다.

# 프로젝트 소개

크래프톤 정글 게임테크랩에서 개발해 UE Fab 마켓플레이스에 출시한 UE5.5 플러그인입니다. 하드웨어 레이트레이싱(RTCore)으로 3D 환경의 반사·차폐·지연 효과를 실시간으로 계산해, 복잡한 공간 사운드를 손쉽게 적용할 수 있도록 만들었습니다. 기존 UE 사운드 시스템(MetaSound, SoundCue)과 완전히 통합되어, Sound Attenuation에 설정만 추가하면 바로 적용됩니다.

# 구조 개선

플러그인을 설계하면서 세 번의 방향 전환이 있었고, 각각은 "왜 처음 접근이 한계에 부딪혔는가"에서 출발했습니다.

**초기 설계는 Component 단위였습니다.**
{: .problem}

소리 계산은 특정 액터에 종속된 로직이 아니라 씬 전체의 지오메트리를 참조하는 전역 로직에 가까웠습니다. Component에 붙이면 액터마다 중복 계산이 생기고 씬 데이터 접근 경로도 꼬였습니다. 그래서 **WorldSubsystem** 구조로 전환해, 레벨 단위로 한 번만 공간 데이터를 관리하도록 바꿨습니다.
{: .solution}

**Submix를 실시간으로 수정해 반사/차폐 값을 반영하려 했습니다.**
{: .problem}

Submix는 믹싱 이후 버스 단위로 오디오를 처리하는 구조라, 소스별로 다른 반사·지연·방향성 데이터를 실어 나르기엔 한계가 있었고 런타임 수정도 불안정했습니다. 대신 **UE Audio Plugin Interface**(SourceDataOverride / Reverb / Spatialization)를 직접 구현해, 소스 단위로 파라미터를 주입하는 구조로 대체했습니다.
{: .solution}

**레이 하나하나의 결과를 그대로 오디오 파라미터로 쓰려 하니 연산량이 감당이 안 됐습니다.**
{: .problem}

씬당 수천 개의 Ray 결과를 GPU에서 CPU로 가져와 Delay/TapDelay/RT60/Gain/ILD 같은 파라미터로 압축하는 과정이 Game Thread를 막고 있었습니다. 이 파라미터화 연산을 Worker Thread로 분리하는 멀티스레드 구조로 리팩토링해, AudioComponent 30개 기준 <span class="stat">55ms → 9ms</span>로 지연을 줄였습니다.
{: .solution}

엔진 플러그인을 만들면서 얻은 가장 큰 배움은, 기능을 먼저 붙이는 것보다 **데이터가 어디서 생성되고, 어디서 유지되고, 어디서 소비되는지**를 먼저 찾는 게 구조를 좌우한다는 점이었습니다.

# Sound Material Utils

사운드 머티리얼 설정을 실제 에디터에서 쓰기 편하게 만드는 부가 기능도 함께 만들었습니다.

- 다수의 PrimitiveComponent(Mesh, SkeletalMesh)에 반사·흡음 계수를 일괄 적용하는 자동화 기능
- 수작업 대비 세팅 시간을 크게 단축
- 우클릭 메뉴 기반 인터페이스로 에디터 사용자가 별도 학습 없이 바로 적용 가능

UE Menu Tools를 직접 다뤄보면서, 실제 플러그인 사용자 입장에서 편의 기능이 있어야 부가 기능까지 써보게 된다는 걸 체감했습니다.

# 시연

(시연 영상 링크는 추후 교체 예정)
