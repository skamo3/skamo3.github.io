---
title: Project ¡Hola!
type: personal
category: game-graphics
period: "2022.02 - 2022.04"
order: 3
thumbnail: /assets/images/project-hola/thumbnail.png
summary: "Smilegate Challenge Season 3 · UE4.27 기반 퍼즐 어드벤처 팀 프로젝트"
team: "4인 1팀 (프로그래머 3, 기획자 1) · 팀장"
stack: ["Unreal Engine 4.27", "C++", "Visual Studio", "Github", "Github LFS"]
link_cards:
  - name: "Github"
    url: "https://github.com/Good-Hola/Hola"
toc:
  - label: "프로젝트 소개"
    anchor: "#프로젝트-소개"
  - label: "캐릭터 상호작용 시스템"
    anchor: "#캐릭터-상호작용-시스템"
  - label: "무기 시스템"
    anchor: "#무기-시스템"
  - label: "파괴 가능한 오브젝트"
    anchor: "#파괴-가능한-오브젝트"
  - label: "레벨 디자인 & 퍼즐"
    anchor: "#레벨-디자인--퍼즐"
  - label: "팀 리딩 & 협업"
    anchor: "#팀-리딩--협업"
  - label: "시연"
    anchor: "#시연"
---

# 프로젝트 소개

스마일게이트 챌린지 시즌3 참가작. '챌린지'라는 시즌 주제에 맞춰 4인 1팀이 두 달간 언리얼 엔진을 학습하는 동시에 게임을 완성해야 했던 프로젝트. 방사능과 바이러스로 오염된 아포칼립스를 배경으로, 어둡고 음침한 폐허를 3인칭 시점으로 탐험하며 몬스터를 처치하고 맵 곳곳에 숨겨진 오브젝트로 퍼즐을 풀어 스테이지를 클리어하는 3D 퍼즐 어드벤처

팀원 중 유일하게 언리얼 엔진을 다뤄본 경험이 있어 팀장을 맡음. 프로그래밍 약 80%, 전체 기획 약 30%를 담당하며 캐릭터 이동/애니메이션, 상호작용 오브젝트, 근거리·원거리 무기, 파괴 가능 오브젝트, 맵 퍼즐 로직을 구현

<a class="btn btn-primary" href="#시연">시연 영상 보기</a>

# 캐릭터 상호작용 시스템

상호작용 가능한 오브젝트마다 "가까운 오브젝트 감지 → F키 유도 UI 표시 → Interact 실행"이라는 공통 로직이 필요했는데, 이를 오브젝트 클래스마다 개별로 구현하면 같은 코드를 계속 반복해야 하는 문제가 있었음

CapsuleComponent의 Overlap 이벤트 델리게이트를 캐릭터에 바인딩해서 해결. 이벤트가 발생하면 `DetectObject()`를 호출해 겹쳐진 오브젝트들 중 가장 가까운 것을 찾아 변수로 저장하고, 여기에 F키 입력이 들어오면 `OnInteract()`가 저장된 오브젝트의 `Interact()`를 호출하는 구조

![상호작용 오브젝트 감지 코드 — CapsuleComponent Overlap 이벤트로 DetectObject()를 호출해 겹친 액터 중 가장 가까운 오브젝트를 찾아 focusedActor로 저장하는 코드](/assets/images/project-hola/interact-detect.png)

이 감지 로직 위에서, 실제 동작은 `AInteractObject`라는 베이스 클래스를 상속받은 하위 클래스들이 각자 오버라이드하도록 설계 — 오브젝트 종류가 늘어나도 감지·UI 로직을 다시 짤 필요 없이 하위 클래스만 추가하면 되는 구조

![AInteractObject 베이스 클래스 — Interact()와 TurnOn/TurnOff 함수를 가진 상위 클래스를 하위 클래스가 상속받아 구현하는 구조, 콜리전 진입 시 위젯을 켜고 F키 유도 문구를 띄우는 블루프린트](/assets/images/project-hola/interact-base.png)

- 캐릭터 콜리전에 들어가면 위젯을 On 상태로 바꿔 Description 문구와 F키 유도 UI 출력
- `TurnOn`, `TurnOff` 함수를 오버라이딩해 오브젝트별로 다른 로직 구현(문 열기, 스위치 조작 등)

# 무기 시스템

캐릭터가 장착할 수 있는 근거리·원거리 무기를 구현해 몬스터와 싸우고 파괴 가능한 오브젝트를 부술 수 있도록 함

![무기 시스템 — 월드 배치용 AInteractWeapon과 장착용 Weapon 클래스가 한 쌍으로 동작하는 구조, enum class로 근거리/원거리 타입을 구분하는 코드](/assets/images/project-hola/weapon-system.png)

- 2개의 클래스를 한 쌍으로 묶어 월드 배치와 캐릭터 장착을 분리 — `AInteractObject`를 상속하는 `AInteractWeapon`으로 월드에 무기를 배치하고, `Weapon` 클래스로 캐릭터가 장착할 무기를 정의
- `enum class`로 근거리·원거리 무기 타입을 구분하고, `MAX_COUNT`로 디폴트 상태와 무기 타입 최대 개수를 함께 관리

## 장착 애니메이션과 소켓

무기 종류마다 스켈레탈에서 쥐는 위치와 각도가 다르고, 장착 중인지 등에 매고 있는지 상태에 따라서도 붙는 위치가 달라야 했음

스켈레탈 소켓을 이용해 무기별로 `SocketName`을 받도록 구현하고, 손에 쥐었을 때의 소켓과 보관 상태(기본적으로 등)의 소켓을 상태별로 구분. 장착·해제 시에는 Anim Montage를 저장해뒀다가 그에 맞는 애니메이션을 재생

![장착 애니메이션과 무기 소켓 — 무기별 Hold Socket/Back Socket 이름과 장착 Montage를 지정하는 데이터, 장착 상태에 따라 소켓을 교체하는 코드](/assets/images/project-hola/weapon-socket.png)

## 근접 무기 콤보 공격

하나의 공격 시퀀스가 담긴 Anim Montage를 Section 단위로 나눠 저장하고, Anim Notify로 무기의 Hit 판정과 다음 공격 입력 타이밍을 감지. 다음 공격이 콤보 타이밍 안에 들어오면 이어지는 Section의 애니메이션을 재생해 3단 콤보를 구현

![근접 무기 콤보 공격 — Attack Montage를 Attack_1/2/3 Section으로 나누고, AnimNotify로 AttackHitCheck/NextAttackCheck 타이밍을 감지하는 몽타주 편집 화면](/assets/images/project-hola/melee-combo.png)

## 원거리 무기와 발사체

원거리 무기(`ARangedWeapon`)에 발사체 클래스(`AProjectile`)를 기본 변수로 선언하고, `UProjectileMovementComponent`로 포물선을 그리며 날아가도록 구현. 충돌 시에는 `OnHit` 델리게이트로 반응하는데, 발사체를 바로 제거하면 충돌 이펙트가 재생되기 전에 사라져 보이므로 먼저 visibility를 끄고 콜리전을 NoCollision으로 바꿔 충돌/폭발 이펙트를 재생한 뒤, 약간의 지연을 두고 액터를 제거해 프레임 부하도 함께 줄임

![원거리 무기와 발사체 — ARangedWeapon에 AProjectile을 스폰하고 UProjectileMovementComponent로 포물선 이동을 구현한 코드, OnHit 처리 결과인 폭발 이펙트 스크린샷](/assets/images/project-hola/ranged-projectile.png)

# 파괴 가능한 오브젝트

캐릭터가 무기를 이용하거나 특정 로직을 실행하면 길을 막고 있던 오브젝트가 부서지도록 구현. 언리얼 엔진 4.27의 Destructible Mesh를 활용해, 파괴 가능한 벽이나 장애물을 배치하고 이를 통해 전투와 퍼즐 진행에 변주를 줌

# 레벨 디자인 & 퍼즐

맵이 어두운 환경이다 보니 플레이어가 옳은 길을 찾기 어려운 문제가 있었음. 옳은 길은 더 밝고 특수 이펙트를 넣어 유도하고 틀린 길은 더 어둡게 처리했는데, 이후 맵 전체가 너무 어두워지는 부작용이 생겨 전체 밝기와 상호작용 오브젝트 발광을 다시 조정

난이도 곡선 설계도 필요했음 — 1-1 → 1-2 구간은 이동과 몬스터 회피 위주로, 1-3 → 1-2로 되돌아오는 구간은 이미 무기를 획득한 상태에서 지나온 길의 몬스터와 전투하도록 배치해 난이도와 플레이 스타일에 변화를 줌

스테이지는 시작 지점에서 1-1 → 1-2를 거쳐 1-3·1-4로 갈라지는 구조로 설계, 몬스터를 처치하며 퍼즐을 풀고 최종 목표에 도달하면 스테이지 클리어

# 팀 리딩 & 협업

코로나로 대면 미팅이 제한적이라 Discord로 정기 회의와 코어 타임 상시 접속 체계를 만들어 지연 없이 피드백을 주고받음. `random-chatting`/`팀-규칙`/`archive`/`회의기록-남기기` 채널을 나눠, 회의뿐 아니라 각자 찾은 유용한 정보를 공유하는 채널도 따로 만들어 기록을 남김. "내 시간 10분이면 다른 사람 시간 40분이다", "솔직하게 말하지 않으면 남들은 몰라요" 같은 팀 자체 규칙을 만들어 서로 눈치보지 않고 솔직하게 피드백할 수 있는 문화를 조성

Github Issue 탭으로 버그·작업 목록·문서를 기록하고, Commit message로 작업을 단위별로 나눠 문제가 생겼을 때 이전으로 돌아가기 쉽게 관리

매주 리뷰 세션을 운영해 팀원별 기능 구현 진척도를 공유했고, 특정 기능에서 병목이 생기면 역할을 교대해 해결하는 방식으로 개발 속도를 약 20% 개선. 팀원 중 유일하게 언리얼 엔진 경험이 있어 팀장을 맡았는데, 나머지 팀원들은 모두 언리얼 엔진이 처음이라 첫 1주 동안은 함께 엔진 사용법을 익히고 이후 필요할 때마다 정보를 찾아가며 핵심 로직부터 빠르게 구현해나감

# 시연

<div class="video-embed"><iframe src="https://www.youtube.com/embed/FKvPCVWzjUg" title="Project Hola 플레이 영상" allowfullscreen></iframe></div>

{% assign hola_gh = page.link_cards | where: "name", "Github" | first %}
{% include link-card.html name=hola_gh.name url=hola_gh.url desc=hola_gh.desc logo=hola_gh.logo og_image=hola_gh.og_image %}
