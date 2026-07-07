---
title: "[Unreal Engine] 언리얼 기본으로 알면 좋은 클래스"
date: 2026-04-19
category: unreal
---

언리얼 엔진의 기초가 되는 클래스 UObject.

UObject는 언리얼 객체 시스템의 출발점이 되는 클래스로, 엔진의 리플렉션 시스템과 연동되는 핵심 기반 클래스이다.
언리얼 엔진은 UObject 기반 객체를 추적하며, 이를 바탕으로 가비지 컬렉션과 직렬화, 에디터 노출 등의 기능을 제공한다.

[UE UObject 공식문서](https://dev.epicgames.com/documentation/unreal-engine/objects-in-unreal-engine?application_version=5.6)

다만 UObject 자체만으로는 월드에 배치되거나 위치/회전/스케일을 가지는 객체가 될 수는 없다.

월드에 배치되는 기본 클래스는 UObject를 상속받는 AActor이다.
AActor는 월드 내 객체 단위이며, 런타임 중 Spawn/Destroy가 가능하다. 또한 보통 RootComponent를 기준으로 위치/회전/스케일 정보를 다룬다.

하지만 AActor는 모든 기능을 혼자 담당하기보다는, 여러 Component를 조합하는 컨테이너에 가깝다.
언리얼 엔진 역시 기능을 컴포넌트로 분리하는 구조를 권장하고 있다. [UE Components](https://dev.epicgames.com/documentation/unreal-engine/components-in-unreal-engine)

가장 자주 쓰이는 컴포넌트는 UActorComponent와 USceneComponent이다.

UActorComponent는 UObject에서 바로 파생되는 상위 클래스로 **AActor에 붙어 재사용 가능한 기능을 제공하는 것**이 목적이다.

하지만 추상적인 동작을 제공하는 것에 초점이 맞춰져 있기에 Transform을 제공하진 않는다. 즉, "월드 내에 배치되어 동작"보다는 **"어떤 기능을 수행"**에 초점이 맞춰진 클래스이다.

인벤토리, 스탯, 쿨타임, 상호작용 판정 등이 해당될 수 있다.

USceneComponent는 UActorComponent를 상속받는 클래스로 Transform과 Attachment 개념을 추가로 가진다. UActorComponent가 기능만 정의하는 컴포넌트였다면, USceneComponent는 **"월드에서 기준점"**을 가진다. 즉, USceneComponent는 화면에 보이지 않더라도 부모-자식 관계를 가지며 위치 기준점 역할을 할 수 있다.

다만 USceneComponent 자체는 렌더링이나 충돌 기능까지 제공하지 않으며, 이러한 기능은 이를 상속하는 UPrimitiveComponent부터 담당한다.

그래서 USceneComponent는 카메라 피벗, 총구 위치, 아이템 부착점, 앵커, 스폰 포인트처럼 화면에 직접 보일 필요는 없지만 위치 정보가 필요한 경우에 주로 사용된다.

다음은 가장 많이 쓰이는 Actor클래스인 APawn과 ACharacter에 대한 내용이다.

[APawn](https://dev.epicgames.com/documentation/unreal-engine/pawn-in-unreal-engine)은 쉽게 말하면 **"조작 가능한 Actor"**이다.

**Pawn은 플레이어나 AI가 조작할 수 있는 Actor의 베이스 클래스**로, 월드에 존재하는 Actor의 성질에 더해 **Controller가 Possess해서 제어할 수 있는 몸체**라는 의미를 가진다.
즉, AActor가 단순 월드 객체라면, APawn은 그중 플레이어나 AI가 직접 조작 대상으로 삼을 수 있는 객체이다.

[ACharacter](https://dev.epicgames.com/documentation/unreal-engine/characters-in-unreal-engine)는 **보행형 캐릭터에 특화된 APawn**이다.

ACharacter는 APawn을 상속하며, 일반적으로 CapsuleComponent, SkeletalMeshComponent, CharacterMovementComponent를 기반으로 동작한다.
이 덕분에 걷기, 뛰기, 점프, 낙하 같은 일반적인 3D 캐릭터의 움직임을 빠르게 구성할 수 있다.

결국 APawn과 ACharacter의 가장 큰 차이는 용도에 있다.
ACharacter는 일반적인 3D 플레이어 캐릭터나 NPC처럼 보행형 이동체를 만들 때 유리하고,
반대로 차량, 우주선, 드론처럼 이동 방식이나 조작 구조가 완전히 다른 경우에는 APawn을 기반으로 커스텀하는 것이 더 적합하다.
