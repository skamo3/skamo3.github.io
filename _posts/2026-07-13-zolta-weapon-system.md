---
title: "[Zolta] 무기 시스템, 상속에서 데이터 기반으로"
date: 2026-07-13
category: game-dev
---

Zolta의 무기 시스템은 몇 달 동안 구조를 통째로 바꾼 게 두어 번은 된다. 처음엔 캐릭터에 무기가 아예 붙어있는 에셋(Paragon 라이브러리의 Greystone)으로 시작했는데, 주무기와 보조무기1·2를 서로 바꿔 낄 수 있어야 했기 때문에 무기를 소켓에 장착하는 방식으로 분리하는 것부터 시작했다.

## InteractionActor, 그리고 3단 상속

월드에 떨어진 무기를 캐릭터가 주워서 장착하는 흐름을 잡으면서, 상호작용 가능한 물체의 기반이 되는 `InteractionActor`를 만들었다. SceneRoot 아래에 StaticMeshComponent를 두고, SphereCollision으로 상호작용 판정 범위(InteractionArea)를 잡았다. 캐릭터가 별도로 상호작용 범위를 갖는 대신, `InteractionActor`가 스스로 캐릭터에 자신을 등록·해제하는 방향으로 정리했다.

여기서 욕심을 더 냈다. `ItemData`라는 이름으로 WeaponData의 상위 클래스를 만들고, `InteractionActor → ItemActor → WeaponActor`로 이어지는 3단 상속 구조를 잡으려고 한 것이다. InteractionWidget도 WorldItemWidget이라는 더 범용적인 이름으로 바꿔서 역할을 분리하려고 했다.

## 과했다고 판단해서 되돌린 순간

상속 구조가 꼬이기 시작한 건 WeaponActor가 특정 아이템에만 있어야 할 정보(GrantedWeapon)를 InteractionActor가 알아야 하는 상황이 생기면서였다. InteractionActor는 원래 범용적인 액터로 설계했는데, Weapon에 종속된 정보를 들고 있게 되니 역할이 뒤섞였다.

이 시점에 "필요하면 표시용 함수를 추가로 만들자"는 제안이 나왔는데, 여기서 지시받은 것 이상으로 기능을 미리 만들지 않는다는 원칙을 세웠다. 이 원칙은 그대로 `AGENTS.md`에 "지시 이외의 코드 작성 금지", "필요한 것만 만들고 끝낸다"는 규칙으로 남았다. 결국 InteractionActor 자체를 지우고, WeaponActor가 상호작용 인터페이스와 위젯까지 직접 갖는 단순한 구조로 되돌렸다.

## 지금 구조: WeaponActor + DataAsset + GAS

지금은 무기 하나를 DataAsset(`DA_Weapon_*`)으로 정의한다. 처음엔 DA가 BP를 참조하면서 동시에 Mesh 정보까지 들고 있어 의존 방향이 꼬여 있었는데, DA는 WeaponActor 클래스만 가리키고 실제 Mesh는 BP 쪽에서 지정하도록 단방향 의존성으로 정리했다.

![DA_Weapon_Sword 데이터 애셋 — 무기의 장착 소켓, Weapon Actor Class, Attack Damage/Range, Attack/Skill Ability Class를 데이터로 정의하는 디테일 패널](/assets/images/zolta/weapon-data-asset.png)

공격은 GAS(GameplayAbility System) 이벤트 방식으로 처리한다. 무기 하나는 Attack용 GA 하나, Skill용 GA 하나만 가지도록 제한했고, 콤보 공격은 `GA_ComboMeleeAttack`처럼 별도 GA로 분리해서 콤보 구간(Attack_A/B/C)별로 데미지 배율을 갖는 `ComboSection` 구조체를 데이터로 관리한다.

![콤보 GameplayAbility 설정 — Attack_A/B/C 구간별 Damage Multiplier, Hit Shape Type, Sphere Radius, Trail/Impact FX, Hit Sound를 데이터로 정의](/assets/images/zolta/weapon-combo-ability.png)

## 히트 판정은 무기 쪽으로

초반엔 캐릭터 쪽에서 매 프레임 히트 판정을 검사했다(`PerformMeleeHitCheck`). 그런데 "무기가 그리는 궤적대로 이펙트를 만들고 싶다", "핵앤슬래시 느낌을 살리고 싶다"는 방향을 잡으면서, 무기 모양을 기준으로 한 Hit 판정이 더 맞다고 판단해 캐릭터 쪽 판정 함수를 지우고 무기 자체가 OnOverlap으로 판정하는 방식으로 옮겼다. 맨손 공격처럼 무기가 없는 경우는 빈 Shape을 특정 스켈레탈 소켓에 붙여서 같은 로직으로 처리할 수 있도록 설계했다.

실제 타이밍은 애니메이션 몽타주의 노티파이가 트리거한다. MeleeHitStart/End 노티파이로 무기의 히트 콜리전을 켜고 끄고, 콤보 구간 사이의 전환은 ComboWindowEnd 노티파이로 넘어간다. 처음엔 이 노티파이가 섹션 끝부분에서 실행이 안 되는 문제가 있었는데, 노티파이 위치를 섹션 끝보다 조금 앞으로 당겨서 해결했다.

![OneHandSwordCombo_UE 몽타주 — Attack_A/B/C 콤보 구간과 Attack.Hit, Attack.ComboWindowStart, AttackEnd 노티파이가 배치된 타임라인](/assets/images/zolta/attack-montage-notify.png)

이 구조는 캐릭터뿐 아니라 AI 유닛도 그대로 공유해서 쓴다. 플레이어와 AI가 서로 다른 무기 로직을 갖지 않도록, 처음부터 같은 WeaponActor를 함께 쓰는 방향으로 잡아뒀다.
