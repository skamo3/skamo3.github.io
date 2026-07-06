---
title: Engine-SIU (자체 게임엔진)
type: personal
category: game-graphics
period: "2025.03 - 2025.06"
order: 2
summary: "DirectX11/C++ 기반 자체 게임엔진, 매주 새 팀으로 총 31명이 협업"
team: "4인 1팀 로테이션 (13주간 총 31명 협업)"
stack: ["DirectX11", "C++", "HLSL", "Lua", "Github Organization"]
toc:
  - label: "프로젝트 소개"
    anchor: "#프로젝트-소개"
  - label: "주요 담당 업무"
    anchor: "#주요-담당-업무"
  - label: "W01 - 2D에서 3D로"
    anchor: "#w01---2d에서-3d로"
  - label: "W02 - Billboard & Texture Atlas, WireFrame"
    anchor: "#w02---billboard--texture-atlas-wireframe"
  - label: "W03 - Static mesh, Multi-Viewport"
    anchor: "#w03---static-mesh-multi-viewport"
  - label: "W04 - Brute Force Competition, PIE"
    anchor: "#w04---brute-force-competition-pie"
  - label: "W05 - Fog, Post Process Render pass"
    anchor: "#w05---fog-post-process-render-pass"
  - label: "W06 - Light, Uber Shader, Normal"
    anchor: "#w06---light-uber-shader-normal"
  - label: "W07 - Shadow"
    anchor: "#w07---shadow"
  - label: "W08 - Lua, Camera"
    anchor: "#w08---lua-camera"
  - label: "W09 - SkeletalMesh, FBX"
    anchor: "#w09---skeletalmesh-fbx"
  - label: "W10 - Animation"
    anchor: "#w10---animation"
  - label: "W11 - Particle"
    anchor: "#w11---particle"
  - label: "W12 - Physics & DOF PostProcess"
    anchor: "#w12---physics--dof-postprocess"
  - label: "W13 - Final Game Jam"
    anchor: "#w13---final-game-jam"
  - label: "회고"
    anchor: "#회고"
---

# 프로젝트 소개

크래프톤 정글 게임테크랩에서 진행한 게임 엔진 개발 프로젝트. DirectX11로 Unreal Engine의 구조(UObject, AActor, Component, Naming Convention)를 모방하면서도 학습용으로 단순화한 자체 3D 게임엔진을 설계·제작

- 매주 4인 1조로 새로운 팀을 구성해 13주간 총 31명이 로테이션하며 협업
- Github Organization + fork/PR 워크플로우로 코드 리뷰와 버전을 통합

# 주요 담당 업무

- 아키텍처 및 UObject 시스템 설계 (Week 1)
- Billboard Texture, Texture Atlas 구현 및 렌더링 파이프라인 클래스화 (Week 2)
- StaticMesh 렌더링 구조 / Frustum Culling 설계 (Week 3~4)
- Light · Shadow · Shader Hot Reload 구조 구축 (Week 6~7)
- Lua Script 시스템 및 Camera 매니저 구현 (Week 8)
- UE Cascade 구조를 따른 Particle 시스템 구현 (Week 11)
- PhysX 물리 시스템을 UE 계층 구조로 재현 (Week 12)

# W01 - 2D에서 3D로

언리얼 엔진 4.24를 사용해 온 경험을 토대로 UE를 모방한 클래스 구조를 설계. 매 주차마다 새로운 요구사항이 추가되는 구조라, 유연하게 변경할 수 있는 구조 설계가 관건이었음

![Engine-SIU 아키텍처 다이어그램 — Engine 코어에서 DirectX/Input/UI/Resource/Object/Gizmo/Log/FName으로 뻗어나가는 구조](/assets/images/engine-siu/architecture-diagram.png)

- **DirectX**: Device+Context/SwapChain/Rasterizer 등 렌더 파이프라인 리소스를 관리하고, Vertex·Pixel Shader/RTV/Constant Buffer로 연결
- **Resource**: Mesh/Material/Texture 등 에셋 데이터를 Scene Loader와 Obj&Vertex Data 기반으로 관리
- **Object**: Actor/World/Component/UClass로 이어지는 UE 스타일 객체 계층
- **Input/UI/Gizmo**: 각각 Keyboard·Mouse 입력, UIManager·UIObject, Picking(오브젝트 선택) 담당

어떤 때는 미리 잡아둔 설계 덕분에 작업 효율이 크게 올랐지만, 어떤 때는 그 설계 자체가 오버 엔지니어링이 되어 오히려 작업 속도를 늦추기도 하는 경험을 통해 상황에 맞는 적절한 설계가 곧 완벽한 설계임을 터득

# W02 - Billboard & Texture Atlas, WireFrame

Billboard Texture와 Texture Atlas를 구현하고, 렌더링 파이프라인을 클래스 단위로 분리해 이후 주차에서 기능을 얹기 쉬운 구조로 정리

# W03 - Static mesh, Multi-Viewport

StaticMesh/Material/ShaderManager를 모듈화해 렌더링 구조를 설계하고, Frustum Culling으로 비가시 오브젝트를 제거해 렌더링 효율을 향상

# W04 - Brute Force Competition, PIE

팀별로 구현한 렌더링 최적화 기법을 브루트포스 방식으로 성능 비교하는 대회 진행, PIE(Play In Editor) 기능 구현

# W05 - Fog, Post Process Render pass

Fog 효과와 Post Process 렌더 패스를 파이프라인에 추가

# W06 - Light, Uber Shader, Normal

Blinn-Phong 기반 조명과 Normal Mapping을 구현. 여러 조명 조합을 하나의 Uber Shader로 처리할 수 있도록 셰이더 구조를 정리

# W07 - Shadow

ShadowMap을 구현하며 마주한 아티팩트들을 하나씩 해결

- Peter Panning, Shadow Acne 문제를 Bias 적용으로 해결
- Shadow PCF(Percentage Closer Filtering)와 Shadow Map Resolution 조정으로 그림자 경계의 계단 현상 해결
- Shader 파일(hlsl) Hot Reload 기능을 구현해 런타임 중에도 Shader를 바꿔가며 테스트할 수 있게 되어 작업 속도 50% 이상 향상

![그림자 경계 비교 스크린샷 — 동일 지점에서 Shadow Map 설정을 달리해 렌더링한 두 결과](/assets/images/engine-siu/shadow-comparison.png)

# W08 - Lua, Camera

게임 로직을 스크립트로 분리하기 위해 Lua를 엔진에 통합하고, 카메라 갱신 로직을 별도 매니저로 정리

![Lua Script 구조 — FLuaScriptManager가 sol::state와 스크립트 로드·Hot Reload를 관리하고, ULuaScriptComponent가 Actor별 table을 관리해 Lua Script를 실행하는 구조](/assets/images/engine-siu/lua-script-structure.png)

- `FLuaScriptManager`: `sol::state` 관리, ScriptLoad, Hot Reload 담당
- `ULuaScriptComponent`: Actor별 table 관리 및 Manager와의 연결 로직, 사용할 ScriptName 관리
- 에디터에서 Create/Edit/Delete Script 버튼으로 Actor에 붙일 Lua 스크립트 파일을 바로 관리 가능하도록 지원

카메라 갱신은 매 틱마다 `PlayerCameraManager::UpdateCamera`가 Fade 계산·Transition·ModifierList 실행으로 분기하는 구조로 구현

![Camera Update 로직 — World Tick에서 PlayerCameraManager::UpdateCamera가 Fade 계산/Transition/ModifierList 실행으로 분기하는 구조](/assets/images/engine-siu/camera-update-logic.png)

# W09 - SkeletalMesh, FBX

FBX 파일을 파싱해 SkeletalMesh와 본 계층 구조를 엔진에 로드하는 기능 구현

# W10 - Animation

로드한 SkeletalMesh를 기반으로 애니메이션 재생 기능 구현

# W11 - Particle

UE Cascade 구조를 모방해 Emitter-Module-Instance 형태의 파티클 시스템을 설계·구현

![Particle 시스템 — 파티클 이펙트 실행 화면과 Emitter 에디터 UI](/assets/images/engine-siu/particle-editor.png)

- `ParticleEmitter` → `ParticleInstance` → `Payload` 구조로 데이터 관리
- Dynamic Vertex Buffer를 사용해 GPU에서 대량 파티클을 실시간 렌더링
- Particle Viewer 전용 월드를 만들어 파티클 Save & Load 기능 지원

Init Flow(`SetTemplate` → `InitializeSystem` → `InitParticles`, `BuildEmitters` → `CodeModuleInfo` → 모듈별 데이터 오프셋 계산)와 Tick Flow(`TickComponent` → `ComputeTickCurrent` → 모든 Emitter Inst Init, `EmitterInstance::Tick`에서 `Tick_EmitterTimeSetup`/`Tick_ModuleUpdate`/`Tick_SpawnParticles`로 분기)로 나눠 구조를 설계

![Particle Init Flow / Tick Flow 다이어그램](/assets/images/engine-siu/particle-flow.png)

# W12 - Physics & DOF PostProcess

UE의 물리 구조(`UBodySetup`, `FBodyInstance`, `PxActor`)를 EditorMode·PlayMode 실행 로직까지 동일하게 재현해 PhysX를 적용

![Physics 시스템 — 본 계층 래그돌 시뮬레이션과 Physics Hierarchy 에디터, BodySetup/BodyInstance/Constraint 구조 다이어그램](/assets/images/engine-siu/physics-ragdoll.png)

- BeginPlay 시 `PxActor`를 생성해 `PxScene`에 등록하고 시뮬레이션을 실행, 에디터에서 시뮬레이션 옵션도 조절 가능하도록 구현
- Constraint 시스템을 활용해 BodyInstance 간 제약을 설정
- Physics Editor Level을 구현해 Constraint 수정 및 Save & Load 지원
- 실제 플레이로 본 계층 간 물리 시뮬레이션과 RagDoll 모드 확인 가능

DOF(Depth of Field) Post Process는 기존 Post Process 렌더 패스 구조(W05) 위에 피사계 심도 효과를 추가하는 형태로 구현

# W13 - Final Game Jam

13주 동안 만든 엔진을 실제 게임 제작으로 검증하는 최종 팀 프로젝트. 제작기간 3일, 4인 멀티플레이 게임

- Lua Script, Animation, SkeletalMesh, Input, Physics, Light, PIE 등 그동안 만든 기반 시스템을 모두 사용
- 게임의 전체 로직은 Lua Script로 개발
- 컨트롤러를 이용한 다중 Input 지원 기능도 추가 개발(타 팀원 담당)

<a class="btn btn-primary" href="https://www.youtube.com/watch?v=7ToGVm7_6Ic" target="_blank" rel="noopener">시연 영상 보기</a>

<div class="video-embed"><iframe src="https://www.youtube.com/embed/7ToGVm7_6Ic" title="Engine-SIU Final Game Jam 시연 영상" allowfullscreen></iframe></div>

# 회고

매 주차마다 새로운 요구사항에 맞춰 구조를 유연하게 바꿔야 했음. 어떤 때는 미리 잡아둔 설계 덕분에 작업 효율이 크게 올랐지만, 어떤 때는 그 설계 자체가 오버 엔지니어링이 되어 오히려 작업 속도를 늦추기도 했음. 이 경험을 통해 상황에 맞는 적절한 설계가 곧 완벽한 설계라는 것을 배움

(Github 레포 링크는 실제 저장소 링크로 교체 예정)
