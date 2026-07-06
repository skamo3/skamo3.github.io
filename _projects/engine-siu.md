---
title: Engine-SIU (자체 게임엔진)
type: personal
category: game-graphics
period: "2025.03 - 2025.06"
order: 2
summary: "DirectX11/C++ 기반 자체 게임엔진, 매주 새 팀으로 총 31명이 협업"
team: "4인 1팀 로테이션 (14주간 총 31명 협업)"
stack: ["DirectX11", "C++", "HLSL", "Github Organization"]
---

크래프톤 정글 게임테크랩에서 진행한 게임 엔진 개발 프로젝트입니다. DirectX11로 Unreal Engine의 구조(UObject, AActor, Component, Naming Convention)를 모방하면서도 학습용으로 단순화한 자체 3D 게임엔진을 설계·제작했습니다. 매주 4인 1조로 새로운 팀을 구성해 14주간 총 31명이 로테이션하며 협업했고, Github Organization + fork/PR 워크플로우로 코드 리뷰와 버전을 통합했습니다.

# 주차별 진행

- Week 1: 아키텍처 및 UObject 시스템 설계
- Week 2: Billboard Texture, Texture Atlas 구현 및 렌더링 파이프라인 클래스화
- Week 3~4: StaticMesh 렌더링 구조 / Frustum Culling 설계
- Week 6~7: Light · Shadow · Shader Hot Reload 구조 구축 (Blinn-Phong, Normal Mapping, PCF Shadow Map — Shader 파일(hlsl) Hot Reload로 런타임 중 셰이더 교체 테스트 지원, 작업 속도 50% 이상 향상)
- Week 8: Lua Script 시스템 및 Camera 매니저 구현
- Week 11: UE Cascade 구조를 따른 Particle 시스템 구현 (Emitter-Module-Instance, Dynamic Vertex Buffer 기반 대량 파티클 렌더링)
- Week 12: PhysX 물리 시스템을 UE 계층 구조(UBodySetup, FBodyInstance, PxActor)로 재현 (Constraint, Ragdoll)

# 회고

매 주차마다 새로운 요구사항에 맞춰 구조를 유연하게 바꿔야 했습니다. 어떤 때는 미리 잡아둔 설계 덕분에 작업 효율이 크게 올랐지만, 어떤 때는 그 설계 자체가 오버 엔지니어링이 되어 오히려 작업 속도를 늦추기도 했습니다. 이 경험을 통해 상황에 맞는 적절한 설계가 곧 완벽한 설계라는 것을 배웠습니다.

(Github 레포 링크는 실제 저장소 링크로 교체 예정)
