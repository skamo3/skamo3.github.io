---
title: "[Unreal Engine] UCLASS 리플렉션과 UObject 수명 관리"
date: 2026-08-11
category: unreal
mermaid: true
---

## UClass와 리플렉션

### UClass가 담는 정보

`UClass`는 클래스 하나당 하나씩 존재하는 런타임 타입 객체다. 그 자체가 UObject이기도 하다.

담고 있는 것은 이렇다.

- 프로퍼티 목록
- 함수 목록
- 부모 클래스와 인터페이스
- 클래스 플래그
- CDO

**CDO(Class Default Object)**는 각 `UClass`가 들고 있는 기본값 인스턴스다. `GetDefault<T>()`로 접근할 수 있고, 새 객체를 만들 때 이 CDO를 복사해 시작한다. 언리얼 생성자가 게임을 시작하지 않아도 한 번 도는 이유가 CDO 생성이다. 에디터를 켜는 것만으로 실행된다는 뜻이라, 생성자에서 월드를 찾으면 `GetWorld()`가 null을 반환한다.

프로퍼티 목록은 링크드 리스트로 들고 있다.

```cpp
// CoreUObject/Public/UObject/Class.h
/** In memory only: Linked list of properties from most-derived to base */
FProperty* PropertyLink;
/** In memory only: Linked list of object reference properties from most-derived to base */
FProperty* RefLink;
```

`PropertyLink`가 전체 프로퍼티 체인이고, `RefLink`는 그중 **다른 UObject를 가리키는 프로퍼티만** 따로 모아둔 체인이다. GC는 `RefLink`를 참고해 오브젝트를 관리한다.

### UCLASS 매크로가 하는 일

UHT(Unreal Header Tool)가 빌드 전에 소스를 훑으면서 `UCLASS()` 매크로를 확인한다. 그리고 그 클래스를 리플렉션 시스템에 등록할 코드를 생성해 `.generated.h`에 넣는다. 런타임에는 그 코드가 `UClass` 객체를 만든다.

```cpp
UCLASS()
class UInventoryComponent : public UActorComponent
{
    GENERATED_BODY()
public:
    UPROPERTY(EditDefaultsOnly, Category = "Inventory")
    int32 SlotCount = 30;
};
```

필요한 조건은 세 가지다. UObject를 상속할 것, 헤더에 `.generated.h`를 포함할 것, 클래스 안에 `GENERATED_BODY()`를 넣을 것.

리플렉션이 생기면 얻는 것은 에디터 노출, 직렬화, 블루프린트 상속, 네트워크 복제, `Cast<T>`, 그리고 GC 참조 추적이다. 이 글에서 다루는 것은 마지막 하나다.

## 가비지 컬렉션이 참조를 추적하는 방법

### Mark and Sweep을 쓰는 이유

참조 카운팅은 순환 참조를 회수하지 못한다. 액터가 컴포넌트를 들고 컴포넌트가 다시 액터를 가리키면 양쪽 카운트가 0이 되지 않아 둘 다 영영 남는다. 게임 객체는 이런 상호 참조가 일상이다.

참조를 주고받을 때마다 카운터를 고쳐야 해서 비용이 계속 붙는 것도 부담이다.

도달성으로 판정하면 순환 참조가 저절로 풀린다. 서로를 가리키고 있어도 바깥에서 아무도 닿을 수 없으면 둘 다 회수 대상이다. 대가는 마킹이 도는 동안 생기는 순간 정지다.

### UObject가 이어지는 구조

Mark and Sweep이 성립하려면 객체들이 사슬로 이어져 있어야 한다. 루트에서 출발해 따라갈 길이 있어야 도달 가능한지 판정할 수 있다.

언리얼은 이 사슬이 소유 관계로 명확하게 잡혀 있다.

<pre class="mermaid">
flowchart TD
    R["루트 집합"] --> W["UWorld"]
    W --> L["ULevel"]
    L --> A["AActor"]
    A --> C["UActorComponent"]
    C --> P["UPROPERTY로 선언된<br/>UObject"]
    X["아무도 가리키지<br/>않는 UObject"]
</pre>

월드가 레벨을 갖고, 레벨이 액터를 갖고, 액터가 컴포넌트를 갖는다. 이 소유 사슬이 그대로 GC의 탐색 경로가 된다. 사슬에 닿지 못한 객체가 회수 대상이다.

각 단계는 실제 멤버 변수다.

| 소유 관계 | 선언 | 파일 |
|---|---|---|
| 월드가 레벨을 | `UPROPERTY(Transient) TObjectPtr<ULevel> PersistentLevel` | `Engine/World.h` |
| 레벨이 액터를 | `TArray<TObjectPtr<AActor>> Actors` | `Engine/Level.h` |
| 액터가 컴포넌트를 | `TSet<TObjectPtr<UActorComponent>> OwnedComponents` | `GameFramework/Actor.h` |

`UWorld::PersistentLevel`에는 `UPROPERTY`가 붙어 있다. 반면 `ULevel::Actors`와 `AActor::OwnedComponents`에는 붙어 있지 않다. 그렇다고 GC가 못 보는 것은 아니고, 두 클래스 모두 `AddReferencedObjects`를 직접 구현해 참조를 넘긴다.

사슬의 최상단도 마찬가지다. 월드를 잡고 있는 것은 `UEngine::AddReferencedObjects`이고, 여기서 `WorldList`를 순회하며 각 월드를 GC에 등록한다.

### UPROPERTY가 하는 일

GC가 객체를 마킹하려면 **그 객체의 어느 멤버가 UObject 포인터이고 메모리의 어디에 있는지** 알아야 한다. 일반 C++에는 이 정보가 없다. 클래스 안에 포인터가 몇 개 있고 어느 위치에 있는지는 컴파일이 끝나면 사라진다.

`UPROPERTY`가 그 정보를 남기는 마커다. 매크로 자체는 컴파일러에게 아무 의미가 없다.

```cpp
// CoreUObject/Public/UObject/ObjectMacros.h
#define UPROPERTY(...)
```

정의가 비어 있다. 읽는 쪽은 UHT다. 빌드 전에 소스를 훑다가 `UPROPERTY`가 붙은 멤버를 만나면 그 타입과 **메모리 오프셋**을 `UClass`에 등록하는 코드를 생성한다. 엔진은 그 정보로 클래스마다 참조 위치 목록을 미리 조립해 둔다.

```cpp
// CoreUObject/Public/UObject/Class.h
/** GC schema, finalized in AssembleReferenceTokenStream */
UE::GC::FSchemaOwner ReferenceSchema;
```

GC는 마킹할 때 리플렉션 정보를 매번 뒤지는 대신 이 목록을 순서대로 실행한다. "이 오프셋에 UObject 포인터가 있다, 여기에는 배열이 있다" 같은 명령의 나열이다.

`UPROPERTY`를 빼먹으면 이 목록에 등록되지 않는다.

| | `UPROPERTY` 있음 | `UPROPERTY` 없음 |
|---|---|---|
| 리플렉션 등록 | 됨 | 안 됨 |
| GC가 참조를 인식 | 인식함 | 못 함 |
| 결과 | 참조하는 동안 유지 | 회수되고 포인터는 dangling |

```cpp
UPROPERTY()
TObjectPtr<UInventoryComponent> Inventory;  // GC가 추적한다

UInventoryComponent* Cached;                // GC가 모른다
```

두 번째 포인터는 대상이 회수돼도 값이 그대로 남아 있어서 겉보기에는 멀쩡하다. 접근하는 순간 크래시하고, GC가 언제 도느냐에 따라 증상이 나타나는 시점이 달라져 재현이 불규칙하다.

리플렉션으로 잡히지 않는 참조는 직접 알려줄 수 있다.

| 방법 | 쓰는 상황 |
|---|---|
| `UPROPERTY()` | UObject의 멤버. 대부분 이걸로 해결된다 |
| `AddReferencedObjects` | 리플렉션으로 못 잡는 참조. `ULevel`, `AActor`, `UEngine`이 직접 구현하고 있다 |
| `FGCObject` 상속 | UObject가 아닌 일반 C++ 클래스가 UObject를 들고 있을 때 |
| `AddToRoot()` | 어디서도 참조되지 않지만 살려둬야 할 때 |

## Outer와 Owner

모든 UObject는 생성될 때 Outer를 지정받는다. `NewObject<T>(Outer)`의 첫 인자가 그것이다.

Outer가 하는 일은 네 가지다.

- 이름 충돌 방지. 같은 Outer 아래에서는 이름이 겹칠 수 없다
- 패키지 결정. Outer 체인을 끝까지 타고 올라가면 최상위 `UPackage`가 나오고 이게 저장 단위가 된다
- `GetWorld()` 조회 경로
- 소유자 조회

`GetPathName()`이 이 체인을 타고 만들어진다.

```
/Game/Maps/MyMap.MyMap:PersistentLevel.MyActor_1.InventoryComp
```

### NewObject 시 참조가 어떻게 되는가

Outer를 지정하는 것은 객체 안의 필드에 값을 대입하는 일이다. **Outer 쪽에서 자식을 참조로 등록하지 않는다.** 참조 방향이 자식에서 Outer로 향한다.

```cpp
// this를 Outer로 등록한다. GC 방지가 되는 것은 아니다
UMyObject* Obj = NewObject<UMyObject>(this);
```

`NewObject`는 객체를 전역 객체 배열에 등록할 뿐 GC를 막지 않는다. 루트에서 도달 가능해야 살아남는다. 위 코드는 `this` 쪽에 `UPROPERTY` 멤버로 잡아두지 않으면 다음 GC에 회수된다.

Outer는 소유 관계를 표현하는 것이지 수명 보장 장치가 아니다.

### Owner와의 차이

|  | Outer | Owner |
|---|---|---|
| 대상 | 모든 UObject | `AActor`만 |
| 성격 | UObject 계층과 직렬화 개념 | 게임플레이와 네트워크 개념 |
| 용도 | 이름 관리, 패키지, `GetWorld()` 경로 | 리플리케이션 relevancy, RPC 라우팅, 가시성 |
| 변경 | 생성 시 결정 | `SetOwner()`로 런타임 변경 |

```cpp
// GameFramework/Actor.h
// "used primarily for replication ... and visibility ..."
UPROPERTY(ReplicatedUsing=OnRep_Owner)
TObjectPtr<AActor> Owner;
```

Owner는 액터의 네트워크 소유자다. 서버가 이 액터를 어떤 클라이언트에 복제할지 정하는 relevancy 계산에 쓰이고, 클라이언트가 서버로 보내는 RPC도 소유권이 있어야 통과한다. `bOwnerNoSee`와 `bOnlyOwnerSee` 같은 가시성 옵션도 Owner를 기준으로 동작한다. 1인칭 무기 메시를 본인에게만 보이게 하는 처리가 이걸 쓴다.

액터의 Outer는 `ULevel`이고 Owner는 스폰시킨 액터다. 투사체라면 Outer는 레벨, Owner는 발사한 캐릭터가 된다. 컴포넌트는 Outer와 Owner가 사실상 같아서 둘을 같은 것으로 착각하기 쉽다.

## SpawnActor한 액터의 수명

`SpawnActor`로 만든 액터는 어떤 변수에도 담아두지 않아도 파괴되지 않는다.

앞에서 본 대로 `ULevel::Actors`가 그 액터를 담고 있고, 레벨은 월드가, 월드는 루트가 잡고 있다. 아무도 참조하지 않는 상태가 아니라 **월드가 참조하고 있는** 상태다.

제거하려면 `Destroy()`를 명시적으로 호출해야 한다.

```cpp
AProjectile* P = GetWorld()->SpawnActor<AProjectile>(Class, Loc, Rot);
// 변수 P를 버려도 액터는 레벨에 남는다

P->Destroy();   // 이걸 불러야 제거 절차가 시작된다
```

두 생성 함수는 소속부터 다르다. `NewObject`는 `UObjectGlobals.h`에 선언된 전역 템플릿 함수이고, `SpawnActor`는 `UWorld`의 멤버 함수다. 월드를 거쳐야 만들어진다는 점이 수명 차이로 이어진다.

| | 소속 | 방치하면 |
|---|---|---|
| `NewObject` | 전역 함수 | `UPROPERTY`로 안 잡으면 회수된다 |
| `SpawnActor` | `UWorld`의 멤버 함수 | 월드가 잡고 있어서 계속 남는다 |

그래서 액터는 GC 누수가 아니라 방치 누수가 문제가 된다. 투사체나 이펙트를 Destroy 없이 계속 스폰하면 월드에 쌓여 Tick 비용과 메모리를 먹는다.

## USTRUCT

`USTRUCT`도 리플렉션을 갖지만 UObject가 아니기 때문에 UCLASS와 차이가 생긴다.

| | UCLASS | USTRUCT |
|---|---|---|
| 기반 | UObject 상속 필수 | 일반 C++ 구조체 |
| 런타임 타입 객체 | `UClass` | `UScriptStruct` |
| GC | 추적하고 회수한다 | 대상이 아니다 |
| 생성 | `NewObject`, `SpawnActor` | 일반 변수처럼 |
| 수명 | GC가 결정 | 스코프나 소유 객체를 따름 |
| 복사 | 포인터로 참조 공유 | 값 복사 |
| 접두사 | `U`, `A` | `F` |

선택 기준은 고유한 정체성이 필요한가다. 데이터 묶음이고 값으로 다루는 게 자연스러우면 USTRUCT, 고유한 수명과 동작을 갖고 여러 곳에서 참조로 공유되어야 하면 UCLASS다.

아이템 데이터 1,000개를 `TArray`에 담을 때 USTRUCT면 연속 메모리에 값으로 들어가 GC가 신경 쓸 것이 없다. UObject로 만들면 포인터 배열이 되고 GC가 매 사이클마다 1,000개를 추적해야 한다. DataTable의 행 타입이 USTRUCT인 이유가 여기 있다.

## 정리

- `UCLASS`는 UHT를 거쳐 `UClass` 객체를 만든다. `UClass`는 프로퍼티 목록과 CDO를 들고 있는 런타임 타입 객체다
- GC는 루트에서 월드, 레벨, 액터, 컴포넌트로 이어지는 소유 사슬을 따라가며 도달 가능한 객체를 마킹한다
- 사슬을 따라갈 수 있는 이유는 `UPROPERTY`가 참조의 메모리 위치를 리플렉션에 남기기 때문이다. 빠뜨리면 GC가 그 참조를 보지 못한다
- Outer는 소유와 이름 체계를 표현할 뿐 수명을 보장하지 않는다. 반대로 SpawnActor한 액터는 월드가 잡고 있어 `Destroy()` 없이는 사라지지 않는다
