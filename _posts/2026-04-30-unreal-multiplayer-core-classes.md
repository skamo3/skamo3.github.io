---
title: "[Unreal Engine] 멀티 플레이의 핵심 클래스"
date: 2026-04-30
category: unreal
---

GameMode, GameState, PlayerController, PlayerState 는 언리얼 멀티플레이에서 핵심이 되는 클래스이다.

우선 사진 한장으로 파악하고 시작하자.

![언리얼 멀티플레이 핵심 클래스 관계도](/assets/images/blog/unreal-multiplayer-core-classes/multiplayer-classes.jpg)

### GameMode

**게임의 규칙을 정의하는 클래스**

게임의 규칙, 점수, 어떤 액터가 존재할 수 있는지, 누가 게임에 들어올 수 있는지 등을 관리하는 클래스이다.

그렇기에 **서버에만 존재하고 클라이언트에는 절대 생기지 않는 클래스**이다. ([공식문서](https://dev.epicgames.com/documentation/unreal-engine/game-mode-and-game-state-in-unreal-engine))

GameMode에는 아래와 같은 것들이 들어간다.

- 게임 시작 가능 여부
- 승리/패배 판정
- 플레이어 스폰 규칙
- 라운드 진행 규칙
- 매치 시작/종료 조건
- 제작 가능 여부 같은 최종 판정 로직

"아이템 조합 재료는 충분한지", "점수는 몇 점 올릴건지", "누가 승리했는지" 등 클라이언트 측에서 무언가 실행하려 할 때 클라이언트 측에서 임의로 결정하면 안되는 로직들이 위치한다. 클라이언트가 임의로 결정하면 안되는 로직은 서버에서 판정하고, 그 결과를 GameState, PlayerState, 또는 복제된 데이터를 통해 클라이언트 객체로 전달된다.

### GameState

**게임의 현재 상태를 모든 클라이언트가 볼 수 있게 유지하는 클래스.**

게임의 전역 상태는 GameState가 관리하고, GameMode에 의해 생성된다. 또 GameState는 **클라이언트와 서버 양쪽에 존재하고 완전히 복제**된다. ([공식문서](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/AGameStateBase))

GameState에서는 주로 이런 데이터를 다룬다.

- 남은 시간
- 현재 라운드
- 현재 경기 상태
- 전체 점수
- 접속 중인 플레이어 관련 공용 정보
- 모든 플레이어가 공통으로 봐야 하는 월드 상태

GameMode가 "판정과 결정"을 담당하는 곳이었다면, GameState는 **모두가 볼 수 있게** 하는 역할을 담당한다.

"경기가 시작되었는가?", "현재 라운드는?", "남은 시간은?" 같은 클라이언트 모두가 같은 값을 가지는 데이터를 관리한다.

### PlayerController

**플레이어의 입력과 의도를 대표하는 클래스.**

Pawn과 플레이어 사이의 인터페이스 역할을 하는 클래스로 플레이어의 의지를 Pawn에 전달한다. ([공식문서](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/APlayerController))

주 역할은

- 키보드/마우스/패드 등의 플레이어 입력 처리해 Pawn/Character에 전달
- 카메라, 마우스 커서, UI 입력 등의 처리
- 서버 요청을 위한 Server RPC 처리

위와 같이 플레이어 입력에 따른 처리와 서버와의 통신을 담당하는 클래스로 게임을 진행할 때 중간 다리 역할을 해준다.

반대로 모든 유저가 공유해야 할 정보는 PlayerController에 들어가면 안된다. PlayerController는 클라이언트 별로 하나씩만 존재하기 때문에 다른 클라이언트의 PlayerController는 모르기 때문이다.

### PlayerState

GameState가 게임의 전역적인 상태를 공유하는 클래스였다면 PlayerState는 **플레이어의 공유해야 하는 상태 정보**를 담는 클래스이다.

게임을 진행하면 각 클라이언트 별로 다른 클라이언트와 공유해야하는 정보들이 생기기 마련이고 이런 정보들은 PlayerState에서 관리된다.

PlayerState는 **서버에서 각 플레이어마다 생성되고, 모든 클라이언트로 복제**된다. ([공식문서](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/APlayerState))

주로

- 플레이어 이름
- 팀 정보
- 킬/데스
- 점수
- 준비 완료 여부

같이 개인의 특성이되 다른 클라이언트들과 공유되는 정보들이 들어가게 된다.

PlayerState는 GameState에서 player_array로 관리된다.

### 네트워크 흐름 예시

4 개의 클래스는 네트워크 상에서 유기적으로 연결되어 동작한다.

1. 클라이언트 입력 또는 UI 입력 시 로컬 PlayerController가 플레이어의 입력을 받음
2. PlayerController는 ServerRPC를 통해 서버에 요청을 보냄
3. 서버는 요청을 받아 GameMode 또는 서버 권한 로직에서 판정 실행
4. 판정 결과 반영
   - 게임 전체가 공유하는 경우라면 GameState
   - 특정 플레이어의 공유 상태라면 PlayerState
   - 실제 액터 상태라면 Actor 또는 Component의 복제 데이터에 반영
5. 서버에서 변경된 값들은 Replication을 통해 각 클라이언트로 전달
6. 클라이언트는 전달받은 GameState / PlayerState / 복제 데이터를 바탕으로 Player의 UI나 그 외 사항들을 변경 및 적용

PlayerController 에서 요청이 시작되고

GameMode 에서 서버 최종 판정 및 결과 적용

PlayerState 는 플레이어 별 공유 상태

GameState 는 게임 전체 공유 상태

이런 상태로 관리된다.
