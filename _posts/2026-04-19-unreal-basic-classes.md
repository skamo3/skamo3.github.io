---
title: "[Unreal Engine] 언리얼 기본으로 알면 좋은 클래스"
date: 2026-04-19
category: unreal
mermaid: true
---

언리얼에서 클래스를 만들 때 무엇을 상속할지부터 정해야 한다. UObject, AActor, 컴포넌트, Pawn, Character가 각각 무엇을 해주고 무엇을 안 해주는지 정리한다.

## 클래스 계층

<pre class="mermaid">
flowchart TD
    O["UObject"] --> A["AActor"]
    O --> AC["UActorComponent"]
    A --> P["APawn"]
    P --> C["ACharacter"]
    AC --> SC["USceneComponent"]
    SC --> PC["UPrimitiveComponent"]
</pre>

크게 두 갈래다. 월드에 배치되는 `AActor` 쪽과, 액터에 붙어 기능을 담당하는 컴포넌트 쪽이다. 둘 다 `UObject`에서 출발한다.

## UObject

언리얼 객체 시스템의 출발점이다. 엔진의 리플렉션 시스템과 연동되는 기반 클래스이고, 언리얼은 UObject 기반 객체를 추적하면서 여러 기능을 제공한다.

- 가비지 컬렉션. 참조되지 않는 객체를 엔진이 회수한다
- 직렬화. 애셋이나 세이브 데이터로 저장하고 불러올 수 있다
- 에디터 노출. `UPROPERTY`를 붙인 변수가 디테일 패널에 나타난다
- 블루프린트 접근. `UFUNCTION`을 붙인 함수를 블루프린트에서 호출할 수 있다
- 네트워크 복제

일반 C++ 클래스로 만들면 이 중 어느 것도 받지 못한다. 엔진이 그 객체의 존재조차 모르기 때문이다.

생성은 `new`가 아니라 `NewObject<T>()`로 한다. 접두사는 `U`를 쓴다.

```cpp
UCLASS()
class UMyDataObject : public UObject
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere)
    int32 Value = 0;
};
```

다만 UObject 자체만으로는 월드에 배치되거나 위치·회전·스케일을 가지는 객체가 될 수 없다. Transform이 없고 레벨에 놓이지도 않는다. 그래서 데이터 애셋, 세이브 게임, 서브시스템처럼 **월드에 존재할 필요는 없지만 엔진 기능은 필요한 것들**에 쓴다.

[UObject 공식 문서](https://dev.epicgames.com/documentation/unreal-engine/objects-in-unreal-engine?application_version=5.6)

## AActor

월드에 배치되는 기본 클래스다. 런타임에 Spawn과 Destroy가 가능하고, `RootComponent`를 기준으로 위치·회전·스케일을 다룬다.

```cpp
// Engine/Classes/GameFramework/Actor.h
TObjectPtr<USceneComponent> RootComponent;
```

Transform을 액터가 직접 들고 있지 않다는 점이 눈에 띈다. 루트 컴포넌트가 들고 있고 액터는 그것을 통해 위치를 다룬다.

AActor는 모든 기능을 혼자 담당하기보다 여러 컴포넌트를 조합하는 컨테이너에 가깝다. 언리얼도 기능을 컴포넌트로 분리하는 구조를 권장한다. 접두사는 `A`다.

[Components 공식 문서](https://dev.epicgames.com/documentation/unreal-engine/components-in-unreal-engine)

## UActorComponent

`UObject`에서 바로 파생되는 컴포넌트의 최상위 클래스다. **액터에 붙어 재사용 가능한 기능을 제공하는 것**이 목적이다.

Transform이 없다. 월드 안에 배치되어 동작하는 쪽이 아니라 **어떤 기능을 수행하는 쪽**에 초점이 맞춰져 있다.

인벤토리, 스탯, 쿨타임, 상호작용 판정처럼 위치와 무관한 기능이 여기 해당한다.

## USceneComponent

`UActorComponent`를 상속하면서 **Transform과 Attachment**를 추가로 갖는다. UActorComponent가 기능만 정의했다면 USceneComponent는 월드에서의 기준점을 가진다. 화면에 보이지 않아도 부모·자식 관계를 맺고 위치 기준 역할을 할 수 있다.

렌더링과 충돌은 여기서도 아직 없다. 그 기능은 이를 상속하는 `UPrimitiveComponent`부터 담당한다.

카메라 피벗, 총구 위치, 아이템 부착점, 앵커, 스폰 포인트처럼 **화면에 보일 필요는 없지만 위치 정보가 필요한 경우**에 주로 쓴다.

## APawn

조작 가능한 액터다. 플레이어나 AI가 조작할 수 있는 Actor의 베이스 클래스이고, 월드에 존재하는 액터의 성질에 더해 **Controller가 Possess해서 제어할 수 있는 몸체**라는 의미를 가진다.

AActor가 단순 월드 객체라면 APawn은 그중 플레이어나 AI가 직접 조작 대상으로 삼을 수 있는 객체다. 다만 이동 기능 자체는 들어 있지 않아서 직접 구현하거나 별도 컴포넌트를 붙여야 한다.

[Pawn 공식 문서](https://dev.epicgames.com/documentation/unreal-engine/pawn-in-unreal-engine)

## ACharacter

보행형 캐릭터에 특화된 `APawn`이다. 세 가지 컴포넌트를 기본으로 들고 시작한다.

```cpp
// Engine/Classes/GameFramework/Character.h
TObjectPtr<USkeletalMeshComponent> Mesh;
TObjectPtr<UCharacterMovementComponent> CharacterMovement;
TObjectPtr<UCapsuleComponent> CapsuleComponent;
```

캡슐로 충돌을 잡고, 스켈레탈 메시로 외형을 그리고, `CharacterMovementComponent`가 이동을 처리한다. 이 덕분에 걷기, 뛰기, 점프, 낙하 같은 3D 캐릭터의 일반적인 움직임을 빠르게 구성할 수 있다.

APawn과의 차이는 용도에 있다. 보행형 이동체라면 ACharacter가 유리하고, 차량이나 우주선, 드론처럼 이동 방식과 조작 구조가 완전히 다르면 APawn을 기반으로 커스텀하는 편이 적합하다. CharacterMovementComponent가 가볍지 않아서, 대량으로 스폰되는 단순한 유닛에도 APawn이 낫다.

[Character 공식 문서](https://dev.epicgames.com/documentation/unreal-engine/characters-in-unreal-engine)

## 정리

| 클래스 | 월드 배치 | Transform | 쓰는 곳 |
|---|---|---|---|
| `UObject` | 불가 | 없음 | 데이터 애셋, 세이브 게임, 서브시스템 |
| `AActor` | 가능 | 루트 컴포넌트 기준 | 월드에 놓이는 모든 것 |
| `UActorComponent` | 액터에 부착 | 없음 | 인벤토리, 스탯 같은 기능 모듈 |
| `USceneComponent` | 액터에 부착 | 있음 | 위치 기준점, 부착 계층 |
| `UPrimitiveComponent` | 액터에 부착 | 있음 | 렌더링과 충돌 |
| `APawn` | 가능 | 있음 | Controller가 조작하는 몸체 |
| `ACharacter` | 가능 | 있음 | 보행형 캐릭터 |

무엇을 상속할지 정할 때는 두 가지만 확인하면 된다. **월드에 놓여야 하는가**, 그리고 **위치가 필요한가**다.
