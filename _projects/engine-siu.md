---
title: Engine-SIU (자체 게임엔진)
type: personal
category: game-graphics
period: "2025.03 - 2025.06"
order: 2
summary: "DirectX11/C++ 기반 자체 게임엔진, 4인 팀 · 렌더링/물리/파티클/스크립팅 구현"
---

DirectX11과 C++로 처음부터 만든 자체 게임엔진 프로젝트입니다. 4인 팀으로 Github Organization + fork/PR 워크플로우로 협업했습니다.

- UObject/UActor/Component 아키텍처, Billboard/Texture Atlas, StaticMesh, Frustum Culling
- Light/Shadow/Shader Hot Reload, Blinn-Phong, Normal Mapping, PCF Shadow Map (성능 50%↑)
- Lua Script 기반 카메라 시스템
- Cascade 스타일 Particle System (Emitter-Module-Instance 구조)
- PhysX 기반 물리 통합 (Constraint, Ragdoll)

(Github 레포 링크는 실제 저장소 링크로 교체 예정)
