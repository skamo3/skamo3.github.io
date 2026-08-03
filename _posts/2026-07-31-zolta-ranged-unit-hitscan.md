---
title: "[Zolta] 원거리 유닛 공격: 히트스캔 판정과 GAS 연결"
date: 2026-07-31 00:00:00 +0900
category: game-dev
---

Zolta의 일반 원거리 미니언은 발사체 Actor를 날리지 않는다. 공격 애니메이션의 발사 프레임에 서버가 한 번 판정하고, 화면에는 그 결과를 Beam과 Impact FX로 보여주는 히트스캔 방식으로 만들었다.

<video class="post-video" controls preload="metadata">
  <source src="{{ '/assets/video/zolta-ranged-unit-hitscan/result.mp4' | relative_url }}" type="video/mp4">
  브라우저가 동영상 재생을 지원하지 않습니다.
</video>

PIE에서 원거리 유닛의 발사와 히트스캔 연출을 확인한 장면이다. 이 글에서는 이 공격이 AI에서 시작해 GAS 판정과 GameplayCue 연출까지 어떻게 이어지는지 정리한다.

## 근접·원거리 공통 진입점

근접과 원거리는 공격 방식이 다르지만, 캐릭터가 기본 공격을 시작하는 입구는 같다. AI의 `Attack Target` Task가 Blackboard의 현재 Target을 읽어 `TryStartBasicAttack(Target)`을 호출한다. 캐릭터는 Target을 잠시 보관하고, AbilitySet의 Primary Attack 슬롯에 지정된 Ability를 활성화한다.

```cpp
// Attack Target Task 호출
OwnerCharacter->TryStartBasicAttack(Target);

// Target 보관 후 슬롯 Ability 활성화
PendingBasicAttackTarget = TargetActor;
CharacterAbilityComponent->TryActivateAbilityInSlot(
    ZoltaGameplayTags::Input_Attack_Primary);
```

`UZoltaCharacterAbilitySet`의 `PrimaryAttackAbility` 타입을 특정 근접 GA가 아닌 `TSubclassOf<UGameplayAbility>`로 열어뒀다. 그래서 근접 미니언에는 `GA_MeleeAttack`, 원거리 미니언에는 `GA_RangedAttack` 파생 Blueprint를 넣어도 AI와 캐릭터의 기본 공격 호출 경로는 바뀌지 않는다.

## 발사 판정 시점: Montage Notify

`UGA_RangedAttack`은 활성화되면 캐릭터가 보관한 Target과 공격 Montage를 확인하고, Montage 재생과 `Event.Attack.Fire` Gameplay Event 대기를 같이 시작한다. 이 이벤트는 원거리 공격 Montage의 실제 발사 프레임에 넣은 Notify에서 보낸다.

그래서 공격을 시작했다고 바로 피해가 들어가지는 않는다. 발사 프레임까지 Montage가 정상적으로 진행돼야 `HandleFire()`가 호출되고, 중간에 취소되면 발사 판정 없이 Ability가 끝난다.

```cpp
// Attack.Fire 수신 후 서버 전용 판정
if (Character->HasAuthority() &&
    IsTargetWithinAttackRange(Character, Target, MuzzleLocation) &&
    !IsTargetDodging(Target) &&
    UZoltaCombatEffectLibrary::TraceRangedAttackPath(
        Character, Target, MuzzleLocation, TraceEndLocation))
{
    bHit = UZoltaCombatEffectLibrary::ApplyDamage(
        Character, Target,
        Character->GetAttackDamage() * DamageMultiplier,
        DamageTypeTag);
}
```

판정의 출발점은 Skeletal Mesh의 `Muzzle_Front` Socket이고, Socket이 없는 에셋은 캐릭터 전방의 fallback 위치를 쓴다. Target까지 사거리 안인지, Target이 `State.Dodging` 상태가 아닌지, 발사 경로가 지형이나 구조물에 막히지 않았는지를 확인한 뒤에만 GAS 피해를 적용한다.

발사 성공 여부와 Montage 종료는 따로 관리해서, 발사 후 Montage가 끝나면 `AttackRecoveryTime`으로 기본 공격 쿨다운을 적용하고 Ability를 종료한다. 이 값은 `AttackSpeed`와 분리되어 있어 병종별 공격 간격을 Ability Blueprint 데이터로 조절할 수 있다.

## 판정은 GA, 화면 연출은 GameplayCue

피해 판정 뒤에는 `GameplayCue.Attack.Ranged.Fire`를 실행한다. 이때 Cue에는 발사자, Hitscan 종점, 그리고 실제 피해 적용 성공 여부만 넘긴다. `UZoltaRangedAttackGameplayCue`를 상속한 Blueprint는 그 데이터를 받아 Muzzle에서 종점까지 Beam을 그리고, 명중한 경우에만 Impact FX를 재생한다.

이렇게 나누면 FX가 늦게 재생되거나 교체되어도 피해 시점은 바뀌지 않는다. 기본 Ranged Minion에는 Muzzle Flash, Beam, Impact FX를 연결해뒀지만, 이들은 모두 이미 끝난 판정 결과를 표현하는 Cosmetic이다.

```text
Blackboard Target
  -> TryStartBasicAttack(Target)
  -> PrimaryAttackAbility
  -> UGA_RangedAttack + Attack Montage
  -> Event.Attack.Fire Notify
  -> Server Trace / GAS Damage
  -> GameplayCue Beam / Impact
```

## Beam 이펙트가 두 번 발사되는 것처럼 보이던 문제

기본 Ranged Minion의 Beam이 한 번 쏠 때마다 두 번 반짝이는 것처럼 보이는 문제를 겪었다.

<video class="post-video" controls preload="metadata">
  <source src="{{ '/assets/video/zolta-ranged-unit-hitscan/double-shot-error.mp4' | relative_url }}" type="video/mp4">
  브라우저가 동영상 재생을 지원하지 않습니다.
</video>

처음엔 Beam Material의 Panner Time이나 마스크가 흘러가는 방식이 원인이라고 보고 Material 입력을 고쳤다. TexCoord → Panner → Texture Sample 체인 세 겹이 각자 다른 Speed로 마스크를 흘려보내는 구조인데, Panner의 Time을 게임 전체 시간이 아니라 파티클 자신의 수명에 맞추면 나아지지 않을까 싶어서 Particle Relative Time을 연결해봤다.

![기존 Beam Material — TexCoord/Panner/Texture Sample 세 겹을 Add와 Lerp로 합치는 구조](/assets/images/zolta/beam-panner-material-before.png)

![Panner의 Time 입력에 Particle Relative Time을 연결해본 구조](/assets/images/zolta/beam-panner-material-relative-time.png)

이걸로 증상이 조금 누그러지긴 했지만 완전히 없어지지는 않았고, 별도의 이동형 GameplayCue까지 검토하다가 원인을 잘못 짚고 있다는 걸 깨달았다. 실제 원인은 Material이 아니라 파티클 Emitter의 생성 주기였다. Emitter가 의도한 것보다 짧은 주기로 반복 생성되면서, 한 번의 공격이 여러 발처럼 보이고 있었다.

Emitter 생성 주기를 한 번의 공격 연출 길이에 맞게 조정하니 바로 해결됐다. Material과 GameplayCue 구조는 원래부터 문제가 없었고, 시각 효과가 반복 생성되는 주기만 잘못 잡혀 있던 것이었다.

보이는 증상만 보고 Material부터 의심하다 보니 불필요한 수정이 늘었다. 다음에 이펙트 문제가 생기면 Material을 고치기 전에 Emitter의 생성 횟수·주기·수명부터 먼저 확인하기로 했다.

## 유닛 종류 별 확장 계층 구조

원거리 기본 공격의 공통 C++ 기반은 `UGA_RangedAttack`이다. Montage, 발사 Socket, 피해 배율, 회복 시간, Damage Tag는 모두 `EditDefaultsOnly` 값으로 두고, 각 병종 Blueprint가 자기 에셋에 맞게 채운다. 코드에서 병종 이름을 분기하지 않고, 같은 기반을 다른 데이터로 재사용하는 구조다.

연출도 `UZoltaRangedAttackGameplayCue`를 추상 기반으로 뒀다. Beam과 Impact ParticleSystem은 파생 Blueprint에서 바꾸므로, 같은 히트스캔 판정을 유지하면서 마법탄이나 다른 진영의 시각 효과를 별도로 만들 수 있다.

실제 비행체가 필요한 공격은 다른 계층에 둔다. `AZoltaProjectileBase`는 충돌, 이동, 피해 원본을 관리하는 별도 기반 Actor이며, 일반 원거리 미니언에는 쓰지 않는다. 곡사포, 대포, Siege처럼 탄도와 도착 시간이 게임 규칙인 유닛을 추가할 때 이 기반을 사용한다.
