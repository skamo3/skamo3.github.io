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

구조 자체는 잘 짜여져서 이후 주차에서는 다른 조에서도 그대로 가져다 쓸 수 있을 정도로 유지되었지만, 정작 1주차 미션 중 Math 파트를 기한 내에 끝내지 못하는 문제가 발생

- **원인**: 구조 설계에 시간을 들이는 사이 Math 파트 테스트가 뒤로 밀렸기 때문
- **회고**: 구조 설계보다도 주어진 기한 내에 기능을 제대로 구현하는 것이 더 중요하다는 것을 깨달음

# W02 - Billboard & Texture Atlas, WireFrame

Billboard Texture와 Texture Atlas를 구현하고, 렌더링 파이프라인을 클래스 단위로 분리해 이후 주차에서 기능을 얹기 쉬운 구조로 정리

- 1주차부터 이어진 Math 로직 문제 해결: UE의 행렬 연산은 행 우선(Row-Major) 기준인데, 사용하던 수학 라이브러리의 기본값은 열 우선(Column-Major)이라 행렬 변환 연산이 꼬였던 것이 원인. 행렬 곱셈 시 Major를 행 우선으로 명시적으로 지정해 해결
- DirectXTex, DirectXTK 라이브러리를 활용해 Texture Atlas 기능 추가
- Billboard Texture 기능을 추가하며 그 김에 난잡해져 있던 렌더링 MVP 변환 파트 코드도 함께 정리

<video controls preload="none" width="100%" style="max-width:100%; border-radius:12px;">
  <source src="/assets/video/engine-siu/week02-demo.mp4" type="video/mp4">
</video>

# W03 - Static mesh, Multi-Viewport

담당: StaticMesh 구현 및 Obj Parser 제작(Obj 파일을 읽어들이는 로직). AssetManager를 도입해 Parser 클래스를 별도로 분리하고, obj 파일을 읽으면 파일 분석 결과를 DirectX 그래픽 파이프라인 코드와 연결해 렌더링

텍스처가 렌더링되지 않는 버그를 겪었는데, 원인을 하나씩 찾아가며 3가지를 모두 고쳐야 했음

- **Slot 번호 불일치**: `VSSetConstantBuffer` 호출 시 넘긴 슬롯 번호와 셰이더의 `register(b3)` 선언이 어긋나 있었음
- **바인딩 함수 실수**: Pixel Shader(`mainPS`)에서 쓰는 데이터인데 바인딩 시 셰이더 스테이지를 잘못 지정
- **16바이트 정렬 안 함**: `cbuffer` 안의 `float3`+`float` 필드들이 HLSL의 16바이트 패킹 규칙에 맞지 않게 선언되어 있어 값이 밀리는 현상 → 필드 순서를 재배열해 해결

<div class="video-embed"><iframe src="https://www.youtube.com/embed/YNk0EkvNAmE" title="W03 시연 영상" allowfullscreen></iframe></div>

# W04 - Brute Force Competition, PIE

이 주차는 두 가지 활동으로 진행됨: ① 누가 최적화를 잘하는지 겨루는 챌린지 ② PIE(Play In Editor) 모드 구현

- 팀 전체가 Frustum Culling / Octree / Z-Prepass / SIMD / SphereBounding을 구현, 본인은 **Frustum Culling 메인 담당, Z-Prepass 서브 담당**
- Frustum Culling으로 7fps → 40fps 개선
- Z-Prepass로 5만 개 StaticMesh 기준 DrawCall 약 88% 감소

PIE는 엔진이 관리하는 World를 EditorWorld/GameWorld 2개로 분할 관리하는 방식으로 구현 — 기존 EditorWorld에 있던 데이터를 복사해 PIE용 GameWorld로 가져가는 구조로, UE의 설계를 그대로 참고

![PIE 아키텍처 — FEngineLoop가 GEngine을 통해 Editor/Game으로 분기하고, WorldContexts→World→Levels→Components, GameInstance, GameViewportClient→Draw로 이어지는 구조](/assets/images/engine-siu/pie-architecture.png)

자세한 내용은 [발표자료](https://docs.google.com/presentation/d/1L83a7QiGs7V8RnVlWoXHbeZVbbcJx6vcV73QJpO5fp4/edit)에서 확인 가능

# W05 - Fog, Post Process Render pass

주요 추가 기능: FColor/FLinearColor, SceneDepthRender, Height Fog, FireBall Actor, ProjectileMovementComponent, AddComponent 함수(팀 전체 작업)

본인은 이 주차에는 핵심 기능보다 **엔진 전체 리팩토링**을 담당. 매주 팀원이 바뀌는 환경이라 엔진이 여러 사람을 거치며 점점 잘 다듬어지긴 했지만, 그만큼 주차마다 레거시 코드도 쌓일 수밖에 없었음. 마침 초기부터 엔진 아키텍처를 설계하던 팀원들이 다시 모이게 된 주차라 전체 리팩토링을 하기로 의견을 모았고, 이때 정리된 구조가 마지막 주차까지 이어져 엔진이 계속 업그레이드될 수 있는 기반이 됨

# W06 - Light, Uber Shader, Normal

Lighting을 위한 액터 클래스와 렌더링 파이프라인을 추가하고 Blinn-Phong 조명 모델을 구현. 각 팀원이 각자 Blinn/Phong/Gouraud 모델을 나눠 구현해보며 셰이더 모델별로 빛이 어떻게 달라지는지 비교

Shader Hot Reload 기능도 이때 추가 — 에디터가 실행 중인 상태에서 셰이더 파일을 수정·저장하기만 하면 바로 반영되도록 해서, 테스트할 때마다 리빌드하는 시간을 효과적으로 단축

참고: [개발문서](https://docs.google.com/document/d/1GZkuHxOZEDFDLVdhBNQCbTAbAUM8eEPgTppjuWLbpt8/edit) · [발표자료](https://docs.google.com/presentation/d/1J9PdGgyETiJ26j8wCi8LzaZzMmvx3I2_MGR9pRM7tnc/edit)

# W07 - Shadow

이전 주차에서 구현한 조명을 바탕으로 그림자 구현. 다중 광원(Directional/Point/Spot Light)에 그림자가 제대로 적용되도록 계산 로직을 추가하고, 기존 조명 계산 파이프라인을 그대로 재사용해 그림자 처리도 함께 해결

- PCF(Percentage Closer Filtering) 적용으로 해상도별 그림자 계단 현상 완화
- 리팩토링: 월드 상에서 Component/Actor 선택-삭제 로직이 겹칠 때 충돌하던 문제를 상황별 우선순위 처리로 해결해 에디터 작업 편의성 향상

**겪은 실수**: PCF 필터링 적용 중, 그림자맵 배열 인덱싱을 Shader 안에서 `switch` 분기문으로 처리했음

![Shader 내부의 switch 분기문 — Level 값에 따라 DirectionalShadowMap[0~7]의 GetDimensions를 호출하는 코드](/assets/images/engine-siu/shadow-switch-mistake.png)

Shader 안에서 분기문을 쓰면 GPU 부하가 커지기 때문에 원래는 지양해야 하는 선택. 해상도별 처리를 셰이더 밖에서 미리 끝내고 결과만 넘겨줬어야 했는데, "편리함 + 병목을 줄여보겠다"는 생각으로 셰이더 안에 넣은 게 오히려 최악의 선택이 되어버림

![ConstantBuffer register 선언 — DirectionalShadowMap/PointShadowMap/SpotShadowMap을 각각 Texture2DArray/TextureCubeArray로 t70/t80/t90 슬롯에 선언한 코드](/assets/images/engine-siu/shadow-register-buffers.png)

참고: [개발문서](https://docs.google.com/document/d/1SGA18H5Rwlg1nku6Q3b0WfCwKT0ziHLUSGz6QgkhXHM/edit) · [발표자료](https://docs.google.com/presentation/d/1_uP_B6oCN9BIS2_U-Q6Pn8s2_Om20xMu3QtjRw3PVNY/edit)

# W08 - Lua, Camera

**Lua Script**: UE의 블루프린트 역할을 대신할 Lua Script 시스템 추가. UE 블루프린트 액터처럼 Lua도 액터별로 관리되는 게 맞다고 판단해 매니저 클래스를 설계하고, 컴포넌트를 통해 액터별로 스크립트를 적용해 게임에서 개별로 동작하도록 구현. Hot Reload와 자동 수명 관리 로직을 넣어 스크립트 파일만 만들면 바로 사용할 수 있도록 함 (콜리전 부분은 팀원이 담당)

![Lua Script 구조 — FLuaScriptManager가 sol::state와 스크립트 로드·Hot Reload를 관리하고, ULuaScriptComponent가 Actor별 table을 관리해 Lua Script를 실행하는, 직접 설계한 아키텍처](/assets/images/engine-siu/lua-script-structure.png)

- `FLuaScriptManager`: `sol::state` 관리, ScriptLoad, Hot Reload 담당
- `ULuaScriptComponent`: Actor별 table 관리 및 Manager와의 연결 로직, 사용할 ScriptName 관리
- 에디터에서 Create/Edit/Delete Script 버튼으로 Actor에 붙일 Lua 스크립트 파일을 템플릿 기반으로 바로 관리 가능하도록 지원 — BeginPlay/Tick/EndPlay 함수가 미리 채워진 템플릿을 제공해 바로 로직을 채워 넣을 수 있음

![Create Lua Script By Template — 에디터의 Create/Edit/Delete Script 버튼과, BeginPlay/Tick/EndPlay가 미리 구성된 Lua 스크립트 템플릿 코드](/assets/images/engine-siu/lua-script-template.png)

콜리전과 LuaScript를 조합해 광고로 유명한 모바일 게임 "라스트워"를 모작하는 팀 프로젝트도 함께 진행. 참고: [발표자료](https://docs.google.com/presentation/d/1Vn1O7KydS9-A4DuKbtwjl58HIzrrm0mIOpPL9uZ8Dlc/edit) · [개발문서](https://docs.google.com/document/d/1Da9DeBxkz5BFp-mWX0Iaa8VjMV--vf-7bhxA1YS2bRs/edit)

**Camera**: 카메라 매니저와 모디파이어 추가. UE 로직을 분석해, 월드 생성에 맞춰 함께 만들어지는 PlayerCameraManager를 구현하고 Fade·Transition·Modifier를 탑재해 렌더러에 연결. UE는 이 연결을 위한 별도의 RHI 레이어가 있지만 자체 엔진에서 거기까지 구현할 수는 없었기에, 렌더링 파이프라인을 직접 연결해 기존 MVP 업데이트 로직에 포함되도록 설계. 이 카메라 로직을 기반으로 Camera Fade, SpringArmComponent 등을 제작

카메라 갱신은 매 틱마다 `PlayerCameraManager::UpdateCamera`가 Fade 계산·Transition·ModifierList 실행으로 분기하는 구조로 구현

![Camera Update 로직 — World Tick에서 PlayerCameraManager::UpdateCamera가 Fade 계산/Transition/ModifierList 실행으로 분기하는 구조](/assets/images/engine-siu/camera-update-logic.png)

참고: [발표자료](https://docs.google.com/presentation/d/1PPkRkv_x9-XYz8-MKpJvYJIq8xzO5CFz7sFmQcmodYc/edit) · [개발문서](https://docs.google.com/document/d/1dHprsjf2ymkuPs7h-kGDcVva4uS4PGJhWaVHdPVDtHA/edit)

# W09 - SkeletalMesh, FBX

본인 역할: 기본 SKMesh 정보를 수집·공유하고 전체 구조를 설계, FBX 파일 Import 담당. 핵심 코어 로직 구현은 팀원들이 진행했고, 본인은 옆에서 방향을 보조하는 역할

참고: [개발문서](https://drive.google.com/file/d/1yaedUscedfU9C1M3z677Nm-pgUH66iEK/view) · [발표자료](https://drive.google.com/file/d/1q_b_tpWBeuug6pCIJ5aDsIf5FsMDaFPG/view)

# W10 - Animation

DeepbrainAI에서 근무하며 독학으로 익힌 UE 애니메이션 시스템에 대한 이해를 바탕으로 애니메이션 시스템의 전체 로직을 설계하고 팀원들에게 역할을 분배, 팀원이 막힐 때 방향을 짚어주고 이론적인 부분을 함께 채움

- 8주차에 만든 LuaScript를 기반으로 Animation StateMachine을 제작. Script Hot Reload 기능이 있어 에디터에서 Lua Script를 실시간으로 바꿔가며 확인 가능
- UPROPERTY와 HeaderTool 구현을 시도 — 언리얼에서 쓰는 매크로 키워드를 직접 구현해 엔진 클래스 타입을 관리하고자, 컴파일 시 모든 헤더 파일을 순회하며 `generated.h`를 생성하고 클래스 정보를 저장하는 방식을 시도했으나, 다른 클래스에 대한 타입 추론 문제에 막혀 구현에는 실패

# W11 - Particle

UE Cascade 구조를 모방해 Emitter-Module-Instance 형태의 파티클 시스템을 설계·구현

![Particle 시스템 — 파티클 이펙트 실행 화면과 Emitter 에디터 UI](/assets/images/engine-siu/particle-editor.png)

- `ParticleEmitter` → `ParticleInstance` → `Payload` 구조로 데이터 관리
- Dynamic Vertex Buffer를 사용해 GPU에서 대량 파티클을 실시간 렌더링
- Particle Viewer 전용 월드를 만들어 파티클 Save & Load 기능 지원

Init Flow(`SetTemplate` → `InitializeSystem` → `InitParticles`, `BuildEmitters` → `CodeModuleInfo` → 모듈별 데이터 오프셋 계산)와 Tick Flow(`TickComponent` → `ComputeTickCurrent` → 모든 Emitter Inst Init, `EmitterInstance::Tick`에서 `Tick_EmitterTimeSetup`/`Tick_ModuleUpdate`/`Tick_SpawnParticles`로 분기)로 나눠 구조를 설계

![Particle Init Flow / Tick Flow 다이어그램](/assets/images/engine-siu/particle-flow.png)

관련 클래스가 많아 상당히 복잡했던 구조를 정리해서, Data 전송부/월드 에디터/실제 렌더링 파이프라인 구현으로 나눠 팀원들과 한 파트씩 분배해 작업. 학습 기록은 [Notion 페이지](https://azure-orchid-5bf.notion.site/W11-Particles-Team-Note-1f5c921f266a803a9576eaf0d6895c1e)에서 확인 가능

# W12 - Physics & DOF PostProcess

담당: Physics 쪽 전체 코드 분석 및 구현. 언리얼에서 `UBodySetup`과 SkeletalMesh, `UPhysicsAsset`을 연동하는 과정을 분석해 자체 엔진에 적용, EditorMode·PlayMode 실행 로직까지 재현

![Physics 시스템 — 본 계층 래그돌 시뮬레이션과 Physics Hierarchy 에디터, BodySetup/BodyInstance/Constraint 구조 다이어그램](/assets/images/engine-siu/physics-ragdoll.png)

- BeginPlay 시 `PxActor`를 생성해 `PxScene`에 등록하고 시뮬레이션을 실행, 에디터에서 시뮬레이션 옵션도 조절 가능하도록 구현
- Constraint 시스템을 활용해 BodyInstance 간 제약을 설정
- Physics Editor Level을 구현해 Constraint 수정 및 Save & Load 지원

물리 충돌 자체는 정상 작동했지만, Constraint 연결 로직이 꼬여 SkeletalMesh 관절 부위 연결이 불안정했고 결과적으로 RagDoll 시뮬레이션에는 실패 — 각 부위가 충돌하면 제약 없이 자유분방하게 흩어지는 문제를 겪음. 원인은 `UBodyInstance` 쪽으로 추정되나 이번 프로젝트 기간 안에는 해결하지 못함

참고: [발표자료](https://docs.google.com/presentation/d/1Jap78EGQ5XG_K_w9ms06-1lEaEYMsx95wQsujvxZNng/edit) · [개발문서](https://docs.google.com/document/d/1to0TM-hbGRZVzRsR2DM7RGsTO6lZvxQqveApDtdorhk/edit)

DOF(Depth of Field) Post Process는 기존 Post Process 렌더 패스 구조(W05) 위에 피사계 심도 효과를 추가하는 형태로 구현

# W13 - Final Game Jam

13주 동안 만든 엔진을 실제 게임 제작으로 검증하는 최종 팀 프로젝트. 제작기간 3일, 4인 멀티플레이 게임

- Lua Script, Animation, SkeletalMesh, Input, Physics, Light, PIE 등 그동안 만든 기반 시스템을 모두 사용
- 게임의 전체 로직은 Lua Script로 개발
- 컨트롤러를 이용한 다중 Input 지원 기능도 추가 개발(타 팀원 담당)
- 본인 역할: 주차가 지나며 여기저기 고장나 있던 LuaScript를 되살리는 작업 + 게임 로직 구현

<a class="btn btn-primary" href="https://www.youtube.com/watch?v=7ToGVm7_6Ic" target="_blank" rel="noopener">시연 영상 보기</a>

<div class="video-embed"><iframe src="https://www.youtube.com/embed/7ToGVm7_6Ic" title="Engine-SIU Final Game Jam 시연 영상" allowfullscreen></iframe></div>

# 회고

매 주차마다 새로운 요구사항에 맞춰 구조를 유연하게 바꿔야 했음. 어떤 때는 미리 잡아둔 설계 덕분에 작업 효율이 크게 올랐지만, 어떤 때는 그 설계 자체가 오버 엔지니어링이 되어 오히려 작업 속도를 늦추기도 했음. 이 경험을 통해 상황에 맞는 적절한 설계가 곧 완벽한 설계라는 것을 배움

(Github 레포 링크는 실제 저장소 링크로 교체 예정)
