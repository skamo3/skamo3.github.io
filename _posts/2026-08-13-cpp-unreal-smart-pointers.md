---
title: "[C++] 표준 스마트 포인터와 언리얼 스마트 포인터"
date: 2026-08-13
category: unreal
mermaid: true
---

스마트 포인터는 RAII를 기반으로 한 사용자의 메모리 관리 실수를 줄여주기 위한 말 그대로 스마트한 포인터이다.

## RAII

RAII는 객체를 생성할 때 자원을 초기화하고, 객체가 삭제되는 것에 맞춰 자원도 반납하는 메커니즘으로 자칫 개발자가 실수로 자원을 해제하지 못하는 경우를 방지하고자 객체의 생성 소멸에 자원의 생명주기를 맞춘 것이다. 대표적인 예로는 스마트 포인터, `fstream`, STL 컨테이너, 뮤텍스를 잠그는 `lock_guard` 등이 있다.

## 기존 C++의 스마트 포인터

`unique_ptr`, `shared_ptr`, `weak_ptr` 세 종류이고, 상황에 따라 다르게 설계해 사용한다.

### unique_ptr

포인터에 대한 소유권을 하나만 유지한다. 여러 곳에서 참조하거나 저장해둘 수 없고 단 한 곳에서만 소유할 수 있게 설계되어있다. 다른 곳에서 소유할 수 없고, 소유권의 이전만 가능하다.

```cpp
std::unique_ptr<Data> A = std::make_unique<Data>();

// std::unique_ptr<Data> B = A;       // 복사 불가, 컴파일 에러
std::unique_ptr<Data> B = std::move(A);  // 소유권 이전, A는 빈 상태가 된다
```

### shared_ptr

포인터를 여러 객체가 공유해서 소유할 수 있다. 내부적으로 참조 카운트를 이용해 소유에 대한 관리를 진행한다. `shared_ptr`이 복사될 때마다 참조 카운트를 올리고, 소멸할 때마다 참조 카운트를 내린다. 참조 카운트가 0이 될 때 자체적으로 자원은 사용되지 않는다고 판단하여 객체가 파괴된다.

수명을 마지막 소유자가 결정하고, 파괴 시점이 명확하게 정해져 있다는 장점이 있다. 하지만 두 객체가 서로를 `shared_ptr`로 참조하고 있게 되면 서로에 대한 카운트가 올라가고 순환 참조가 발생하게 된다.

### 순환 참조

두 객체가 서로를 참조하고 있는 모양이다.

```cpp
class B;

class A
{
    std::shared_ptr<B> Ref;
};

class B
{
    std::shared_ptr<A> Ref;
};
```
{: .no-collapse}

<pre class="mermaid">
flowchart LR
    A["A 객체<br/>참조 카운트 1"] -->|B를 소유| B["B 객체<br/>참조 카운트 1"]
    B -->|A를 소유| A
</pre>

바깥에서 A와 B를 가리키던 `shared_ptr`이 전부 사라져도, 서로가 서로를 들고 있어 참조 카운트가 1로 남는다. 0이 되지 않으니 둘 다 파괴되지 않고 메모리에 그대로 남는다. 접근할 방법도 없으니 해제할 수단이 사라진다.

### weak_ptr

`shared_ptr`과 비슷하게 공유되는 포인터이지만 소유권 카운트가 올라가지 않는다. 순환 참조를 방지하거나 포인터 캐싱 등 참조는 하되 그 소유권이 강하게 남으면 안될 때 사용한다.

그렇기에 `weak_ptr`을 사용할 때는 `lock()`을 이용해 유효성 검사와 접근 권한을 얻어오게 된다.

```cpp
std::weak_ptr<Data> Weak = Shared;
if (auto Locked = Weak.lock())
{
    Locked->Use();  // 이 블록 안에서는 살아 있다
}
```

### 약참조 카운트

`shared_ptr`은 내부적으로 두 개의 카운트를 관리한다. 소유권을 세는 강참조 카운트와, `weak_ptr`의 개수를 세는 약참조 카운트가 따로 있다.

강참조가 0이 되어서 객체가 파괴되면 `weak_ptr`이 유효성 검사를 위해 접근했을 때 이미 해제된 자리에 접근하게 될 수 있다. `shared_ptr`의 참조가 전부 사라진 후에도 `weak_ptr`은 객체의 유효성 검사를 해야 하고, 이를 약참조 카운팅으로 유지하는 것이다.

그래서 해제가 두 단계로 나뉜다.

- 강참조 카운트가 0이 되면 객체를 파괴한다
- 약참조 카운트까지 0이 되면 카운트 정보를 해제한다

## 언리얼 스마트 포인터

언리얼 엔진에서 제공되는 스마트 포인터는 일반 C++ 객체와 UObject 어떤 것을 담을 수 있냐에 따라 용도가 나뉜다.

| 대상 | 언리얼 |
|---|---|
| 일반 C++ 객체 | `TSharedPtr` `TSharedRef` `TWeakPtr` `TUniquePtr` |
| UObject | `TObjectPtr` `TWeakObjectPtr` `TSoftObjectPtr` `TStrongObjectPtr` |

### 일반 C++ 객체용

여기서 다루는 포인터들은 표준과 마찬가지로 참조 카운트로 수명을 관리한다. 그렇다면 기존 스마트 포인터와 완전히 같은 방식인지, 다른 점은 없는지 확인해볼 필요가 있다.

기본 구조는 같다. `TSharedPtr`도 객체 포인터와 카운트 정보를 가리키는 포인터를 함께 들고, 강참조·약참조 카운트를 똑같이 관리한다. 언리얼이 표준 라이브러리보다 먼저 자체 구현을 갖고 있었기 때문에 남아 있는 쪽에 가깝다.

다른 점은 두 가지다.

### 스레드 안전성 선택

표준 `shared_ptr`은 여러 스레드가 동시에 참조 카운트를 올리고 내려도 값이 어긋나지 않도록 보호한다. 그 보호에는 비용이 따르는데, 단일 스레드에서만 쓰는 것이 확실해도 끌 방법이 없다.

언리얼은 이걸 템플릿 인자로 고른다.

```cpp
// 기본값
TSharedPtr<FMyData> A = MakeShared<FMyData>();

// 단일 스레드 전용, 보호 비용이 빠진다
TSharedPtr<FMyData, ESPMode::NotThreadSafe> B;
```

컴파일 타임에 결정되므로 런타임 분기는 생기지 않는다.

### TSharedRef

표준에 대응물이 없는 타입이다. **널이 될 수 없는 공유 참조**로, 생성할 때부터 유효한 객체를 요구한다.

```cpp
TSharedPtr<FMyData> MaybeNull;                      // 널일 수 있다
TSharedRef<FMyData> Never = MakeShared<FMyData>();  // 널이 될 수 없다
```

널 검사가 필요 없는 자리에 `TSharedRef`를 쓰면 그 사실이 타입에 드러난다. Slate 위젯 트리가 이 타입을 적극적으로 쓴다.

## UObject 포인터

언리얼 엔진의 리플렉션 시스템과 GC를 위해 새롭게 설계된 스마트 포인터다. 표준과 대응이 잘 맞지 않는데, GC가 수명을 정한다는 전제 위에 설계된 것들이라 애초에 목적이 다르기 때문이다.

### TObjectPtr

UObject를 가리키는 기본 포인터다. 이름이 `Ptr`로 끝나서 `shared_ptr` 같은 소유 포인터로 보이지만 **소유하지 않는다.** 참조 카운트도 없다.

```cpp
UPROPERTY()
TObjectPtr<AWeapon> EquippedWeapon;
```

의미가 생기는 것은 `UPROPERTY`와 함께 쓰였을 때다. 리플렉션 시스템이 이 멤버를 UObject 참조로 인식하고, GC가 도달 가능성을 계산할 때 이 참조를 따라간다. 소유권이 아니라 **GC 그래프의 간선**을 만드는 것이 역할이다.

`shared_ptr`과의 차이가 여기서 갈린다. 마지막 `shared_ptr`이 사라지면 객체는 그 자리에서 파괴된다. `TObjectPtr`은 마지막 참조가 끊겨도 아무 일도 일어나지 않는다. 다음 GC가 돌 때 도달 불가능으로 판정되어 회수될 뿐이다. 파괴 시점이 즉시가 아니다.

`UPROPERTY` 없이 `TObjectPtr`을 선언하면 GC가 그 참조를 모른다. 다른 참조가 없으면 회수되고 포인터는 댕글링이 된다.

### TWeakObjectPtr

`weak_ptr`과 이름도 목적도 같다. 대상을 살려두지 않고, 쓰기 전에 유효성을 확인해야 한다. 그런데 구현은 전혀 다르다.

`weak_ptr`은 카운트 정보를 가리키는 포인터를 들고 있다. `TWeakObjectPtr`은 포인터를 아예 들고 있지 않다. **전역 객체 배열의 인덱스와 세대 번호**, 정수 두 개가 전부다.

<pre class="mermaid">
flowchart TD
    subgraph STD["std::weak_ptr"]
        W["weak_ptr<br/>카운트 정보 포인터"] --> CB["카운트 정보<br/>강참조 / 약참조 카운트"]
        CB -.-> OBJ["객체"]
    end
    subgraph UE["TWeakObjectPtr"]
        TW["TWeakObjectPtr<br/>인덱스 + 세대 번호"] --> ARR["전역 UObject 배열"]
        ARR -.-> UO["UObject"]
    end
    STD ~~~ UE
</pre>

이렇게 할 수 있는 이유는 UObject가 이미 GC를 위해 전역 배열로 관리되고 있기 때문이다. 인덱스만 있으면 조회가 되니 별도 카운트 정보를 만들 필요가 없다. 문제는 객체가 파괴되면 그 슬롯이 다른 객체에 재사용된다는 점인데, 이걸 세대 번호로 구분한다. 슬롯이 재사용될 때마다 번호가 올라가므로, 저장해둔 번호와 현재 번호가 다르면 내가 알던 객체가 아니라고 판단한다.

이 방식으로 얻는 것이 두 가지다.

- 크기가 정수 두 개, 8바이트다. 64비트에서 `weak_ptr`은 포인터 두 개라 16바이트다
- 대상이 죽은 뒤 남는 메모리가 없다. `weak_ptr`은 약참조가 살아 있는 동안 카운트 정보가 계속 남는다

사용법도 다르다. `weak_ptr`은 `lock()`으로 승격해야 접근할 수 있지만, `TWeakObjectPtr`에는 이런 승격이 없다. 유효한지 확인하고 바로 원시 포인터를 꺼내 쓴다.

```cpp
TWeakObjectPtr<AActor> Weak = SomeActor;
if (AActor* Actor = Weak.Get())
{
    Actor->Use();
}
```

승격이 없어도 되는 이유는 GC가 도는 시점이 정해져 있기 때문이다. 게임 스레드 실행 도중에 갑자기 객체가 회수되지 않는다. 한 함수 안에서 확인하고 쓰는 정도는 안전하다. 대신 프레임을 넘겨 캐싱해두면 그 사이에 회수될 수 있으니 쓸 때마다 다시 확인해야 한다.

### TSoftObjectPtr

표준에는 대응물이 아예 없다. 약참조에 **애셋 경로**를 함께 들고 있는 포인터다.

```cpp
UPROPERTY(EditAnywhere)
TSoftObjectPtr<UStaticMesh> WeaponMesh;

// 필요한 시점에 로드
UStaticMesh* Mesh = WeaponMesh.LoadSynchronous();
```

`weak_ptr`은 한 번이라도 존재했던 객체만 가리킬 수 있다. `TSoftObjectPtr`은 경로를 들고 있으니 **아직 메모리에 올라오지도 않은 애셋**을 가리킬 수 있고, 필요한 순간에 그 경로로 로드한다.

무기 100종의 메시를 전부 로드해두는 대신 경로만 들고 있다가 장착할 때 로드하는 식이다. 참조를 걸어두면 그 애셋까지 함께 로드되는 하드 레퍼런스와 대비된다.

### TStrongObjectPtr

UObject를 **강제로 살려두는** 포인터다. 넷 중에서는 `shared_ptr`에 가장 가깝다.

쓰는 자리는 정해져 있다. `UPROPERTY`를 붙일 수 없는 곳, 그러니까 UObject가 아닌 일반 C++ 클래스나 구조체가 UObject를 붙들어야 할 때다. `UPROPERTY`가 없으면 GC가 그 참조를 모르기 때문에 다른 수단이 필요하다.

```cpp
class FMyNonUObjectClass
{
    TStrongObjectPtr<UMyObject> Held;  // GC가 회수하지 않는다
};
```

동작 방식은 UObject 자체의 참조 카운트를 올리는 것이다. GC는 탐색 시작점인 루트 집합을 정할 때 루트 플래그뿐 아니라 이 참조 카운트도 함께 본다. 카운트가 0이 아니면 그 객체를 루트로 취급한다. 루트가 되면 도달 가능성 판정에서 항상 살아남는다.

`shared_ptr`과 다른 점은 마지막이다. 카운트가 0이 되어도 그 자리에서 파괴되지 않는다. 루트 집합에서 빠질 뿐이고, 다른 참조가 없다면 다음 GC 때 회수된다.

## 정리 표

| 포인터 | 대상 | 소유 여부 | 표준 대응 |
|---|---|---|---|
| `TSharedPtr` | 비UObject | 공유 소유 | `shared_ptr` |
| `TSharedRef` | 비UObject | 공유 소유, 널 불가 | 없음 |
| `TWeakPtr` | 비UObject | 없음 | `weak_ptr` |
| `TUniquePtr` | 비UObject | 단독 소유 | `unique_ptr` |
| `TObjectPtr` | UObject | 소유 없음, GC 참조 | 없음 |
| `TWeakObjectPtr` | UObject | 없음 | `weak_ptr`과 목적은 같고 구현이 다름 |
| `TSoftObjectPtr` | UObject | 없음, 경로 보관 | 없음 |
| `TStrongObjectPtr` | UObject | GC 루트로 고정 | `shared_ptr`과 유사 |

## 선택 기준

- 대상이 UObject가 아니면 `TSharedPtr` 계열
- UObject이고 UObject 클래스의 멤버라면 `UPROPERTY` + `TObjectPtr`
- 대상이 죽어도 되고 죽었는지만 알면 되면 `TWeakObjectPtr`
- 아직 로드하지 않을 애셋이면 `TSoftObjectPtr`
- `UPROPERTY`를 못 쓰는 자리에서 UObject를 붙들어야 하면 `TStrongObjectPtr`

## 정리

- 언리얼 스마트 포인터는 대상이 UObject인지에 따라 두 계열로 갈린다. 수명을 참조 카운트가 정하느냐 GC가 정하느냐의 차이다
- 일반 객체용은 표준과 구조가 같고, 스레드 안전성을 컴파일 타임에 고를 수 있다는 점과 널이 될 수 없는 `TSharedRef`가 다르다
- `TWeakObjectPtr`은 `weak_ptr`과 목적만 같다. 카운트 정보 대신 전역 배열 인덱스와 세대 번호를 들고 있어 더 작고 남는 메모리가 없다
- `TObjectPtr`은 소유 포인터가 아니라 GC가 따라갈 참조를 만드는 표시에 가깝다
