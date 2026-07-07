---
title: "[Unreal Engine] Delegate란?"
date: 2026-04-26
category: unreal
---

언리얼 엔진에서 Delegate란 **"특정 이벤트가 발생했을 때, 미리 등록해둔 함수를 호출하는 콜백 시스템"** 이라고 요약할 수 있다.

Delegate는 SingleCast / MultiCast / Dynamic 3개로 구분할 수 있다.

- Singlecast Delegate : 함수 1개만 바인딩. 반환값을 사용할 수 있음.
- Multicast Delegate : 함수 여러 개 바인딩 가능. 반환값 없음.
- Dynamic Delegate : 리플렉션 기반으로 UObject/블루프린트 연동 가능. 대신 일반 Delegate보다 무겁다.

## Delegate는 왜 필요할까?

게임을 하다보면 특정 이벤트에 파생적으로 일어나는 이벤트들이 생기게 된다.

예를 들면 인벤토리에 아이템이 추가될 때

1. UI는 화면을 갱신한다.
2. 사운드 시스템은 효과음을 재생한다.
3. 서버에 아이템 데이터를 추가한다.

이 때 인벤토리 시스템이 UI, 사운드, 서버 통신 등을 모두 다 알고 직접 호출하면 클래스의 결합도가 자연스럽게 커지게 된다.

하지만 Delegate를 쓰면 인벤토리 쪽은 "아이템이 추가됐다" 라는 사실만 알리고, 필요한 쪽이 각자 등록해 반응하면 된다.

즉, **이벤트 발생 주체와 반응 주체를 분리**할 수 있다.

클래스 설계 시 Delegate는 객체 간 결합도를 낮추고, 이벤트 중심 구조를 만들 때 필요하다.

## Single-Cast Delegate

하나의 함수만 바인딩할 수 있는 Delegate인 SingleCast Delegate.

가장 기본적이 형태이고, **반환값을 가질 수 있다는 것이 핵심**.

### 매크로 원형

```cpp
DECLARE_DELEGATE(DelegateName)
DECLARE_DELEGATE_OneParam(DelegateName, ParamType)
DECLARE_DELEGATE_RetVal(ReturnType, DelegateName)
DECLARE_DELEGATE_RetVal_OneParam(ReturnType, DelegateName, ParamType)
```

여러 개의 파라미터는 TwoParm, ThreeParam 등으로 변경해서 사용하면 된다.

### 사용 예시

반환값이 없는 기본형

```cpp
DECLARE_DELEGATE_OneParam(FOnCraftFinished, int32);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class UCraftingComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    FOnCraftFinished OnCraftFinished;

    void FinishCraft(int32 CraftedItemId)
    {
        // 제작 완료 처리
        OnCraftFinished.ExecuteIfBound(CraftedItemId);
    }
};

UCLASS()
class UCraftingWidget : public UUserWidget
{
    GENERATED_BODY()

public:
    void BindCraftingComponent(UCraftingComponent* CraftingComp)
    {
        if (CraftingComp)
        {
            CraftingComp->OnCraftFinished.BindUObject(this, &UCraftingWidget::HandleCraftFinished);
        }
    }

    void HandleCraftFinished(int32 CraftedItemId)
    {
        // UI 갱신
    }
};
```

ReturnValue 사용 예시

```cpp
DECLARE_DELEGATE_RetVal_OneParam(bool, FCanCraftItem, int32);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class UCraftingComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    FCanCraftItem CanCraftItemDelegate;

    bool TryCraft(int32 RecipeId)
    {
        if (CanCraftItemDelegate.IsBound() && CanCraftItemDelegate.Execute(RecipeId))
        {
            // 제작 진행
            return true;
        }

        return false;
    }

   void BindInventory(UInventoryComponent* InventoryComp)
    {
        if (InventoryComp)
        {
            CanCraftItemDelegate.BindUObject(InventoryComp, &UInventoryComponent::CanCraft);
        }
    }
};

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class UInventoryComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    bool CanCraft(int32 RecipeId) const
    {
        // 재료 보유 여부 확인
        return true;
    }
};
```

SingleCast의 가장 중요한 결과를 받아오는 경우이다.

InventoryComponent에서 직접 Crafting에 연결되지 않고 Crafting에서 딜리게이트를 받아 사용하는 것이다.

### 그럼 직접 호출이랑 뭐가 다른데?

이런 의문이 들 수 있다.

```cpp
// 일반적인 형태의 호출
if (InventoryComp && InventoryComp->CanCraft(RecipeId))
{
    // 제작 진행
}


// Delegate
if (CanCraftItemDelegate.IsBound() && CanCraftItemDelegate.Execute(RecipeId))
{
    // 제작 진행
}
```

이런 코드랑 다를게 뭔데? 할 수 있다.

가장 많이 쓰이고 단순하고 읽기 쉬운 형태이다.

일반적인 형태의 경우 UCraftingComponent는 UInventoryComponent를 알아야 하고, CanCraft()라는 구체 함수도 알아야 한다. 관계가 고정된 1:1 구조에서는 이 방식이 가장 자연스럽다.

반면 Delegate의 경우에는 "누가 답하느냐"를 몰라도 된다. InventoryComponent::CanCraft가 답할 수도 있고, UEquipmentRuleComponent::CanCraft가 답할 수도 있고, 테스트 코드에서는 람다를 바인딩할 수도 있다. 즉 **호출 대상 교체 가능성**이 생긴다.

차이점을 더 자세히 알아보자.

1. 직접 호출은 "상대 클래스를 안다"

직접 호출은 호출자가 UInventoryComponent라는 타입을 알고, 그 객체를 들고 있고, 그 안의 CanCraft()를 안다.
즉 **구현 상대가 고정**되어 있다.

2. Delegate는 "상대 클래스 대신 함수 시그니처만 안다"

Delegate는 bool(int32) 같은 형태의 함수 하나만 기대한다.
누가 그 함수 역할을 하느냐는 나중에 바뀔 수 있다. UObject 멤버 함수든, 람다든, 다른 객체 함수든 바인딩 방식만 같으면 연결할 수 있다. 문서도 Delegate가 다양한 바인딩 방식을 지원한다고 설명한다.

3. Delegate는 "없어도 될 수 있다"

직접 호출은 보통 반드시 상대 객체가 있어야 한다.
반면 Delegate는 아예 안 묶여 있을 수도 있어서 IsBound() 확인이 필요하다. 이건 "핸들러가 없으면 그냥 아무 일도 안 한다"는 선택지를 주는 셈이다. 공식 문서도 실행 전에 바운드 여부를 확인하라고 설명한다.

4. Delegate는 런타임에 갈아끼울 수 있다

지금은 인벤토리 규칙을 쓰다가, 다른 모드에서는 별도 규칙 객체를 연결할 수 있다.
이런 점에서 Delegate는 **확장 포인트**를 만들 때 강하다. 이건 Delegate가 arbitrary object의 member function에 동적으로 바인딩될 수 있다는 공식 설명과 맞닿아 있다.

#### 수명 관리

BindUObject로 바인딩한 Delegate는 공식 문서상 **객체를 weak reference로 유지**한다. 즉 UObject Delegate는 객체 수명과 관련해 직접 참조와는 다른 성격을 가진다. 그래서 바인딩된 대상이 더 이상 유효하지 않을 수 있다는 전제를 가지고 IsBound()나 안전한 호출 패턴을 쓴다.

반면 직접 멤버 포인터 호출은 들고 있는 InventoryComp 포인터 자체의 유효성을 직접 관리해야 한다. 물론 UObject 포인터도 언리얼 방식으로 관리되지만, Delegate는 "호출 대상 함수"까지 함께 감싼 약한 바인딩이라는 점에서 직접 참조와 결이 조금 다르다.

## MultiCast Delegate

MultiCast Delegate는 **여러 개의 함수를 동시에 바인딩할 수 있는 Delegate**이다.

한 번 Broadcast() 를 호출해주면 연결된 모든 함수들이 호출된다. SingleCast와는 다르게 여러 함수를 바인딩하고 모두 실행하는 구조이며, 반환값은 지원하지 않는다.

### 매크로 원형

```cpp
DECLARE_MULTICAST_DELEGATE(DelegateName)
DECLARE_MULTICAST_DELEGATE_OneParam(DelegateName, ParamType)
DECLARE_MULTICAST_DELEGATE_TwoParams(DelegateName, ParamType1, ParamType2)
```

### 사용 예시

```cpp
// 선언부와 주체 클래스
DECLARE_MULTICAST_DELEGATE_OneParam(FOnInventoryChanged, int32);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class UInventoryComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    FOnInventoryChanged OnInventoryChanged;

    void AddItem(int32 NewCount)
    {
        // 아이템 추가 처리
        OnInventoryChanged.Broadcast(NewCount);
    }
};

// 사용처 1
UCLASS()
class UInventoryWidget : public UUserWidget
{
    GENERATED_BODY()

public:
    void BindInventory(UInventoryComponent* InventoryComp)
    {
        if (InventoryComp)
        {
            InventoryComp->OnInventoryChanged.AddUObject(this, &UInventoryWidget::Refresh);
        }
    }

    void Refresh(int32 NewCount)
    {
        // UI 갱신
    }
};

// 사용처2
UCLASS()
class UInventorySoundHandler : public UObject
{
    GENERATED_BODY()

public:
    void BindInventory(UInventoryComponent* InventoryComp)
    {
        if (InventoryComp)
        {
            InventoryComp->OnInventoryChanged.AddUObject(this, &UInventorySoundHandler::PlaySound);
        }
    }

    void PlaySound(int32 NewCount)
    {
        // 효과음 재생
    }
};
```

이렇게하면 Broadcast() 한 번으로

- UI 갱신
- 사운드 재생
- 로그 기록

같은 여러 동작을 동시에 실행할 수 있다.

핵심은 **"하나의 이벤트를 여러 시스템이 구독한다"** 것

인벤토리 변경, 체력 변경, 보스 사망, 게임 상태 변경 등 알림형 이벤트에 잘 맞는다.

다만 여러 함수가 묶이는 구조이기 때문에 반환값은 사용할 수 없다.

## Dynamic Delegate

Dynamic Delegate는 리플렉션 기반 Delegate이다.

직렬화가 가능하고 함수 이름으로 찾을수 있지만, 리플렉션 시스템을 거치기 때문에 일반 Delegate보다 느리다는 특징이 있다.

그래서 주로 UObject / UFUNCTION / 블루프린트 연동이 필요할 때 사용된다.

여기서 다시 둘로 나뉜다.

- Dynamic Delegate: 함수 1개 바인딩
- Dynamic Multicast Delegate: 함수 여러 개 바인딩 가능, 블루프린트 Event Dispatcher 스타일에 가깝다.

Dynamic Delegate 계열의 공통 특징은 다음과 같다.

1. 리플렉션 기반으로 동작한다.
2. UObject 및 UFUNCTION() 과 함께 사용하기 좋다.
3. 블루프린트와 연동하기 좋다.
4. 직렬화가 가능하다.
5. 일반 Delegate보다 무겁고 느리다.

여기서 Dynamic Multicast Delegate는 위 특징에 더해

- 하나의 이벤트에 여러 함수를 바인딩할 수 있고
- Broadcast()를 통해 한 번에 호출할 수 있으며
- BlueprintAssignable과 함께 사용하면 블루프린트의 Event Dispatcher처럼 활용할 수 있다.

즉 정리하면

- Dynamic Delegate : 리플렉션 기반의 단일 콜백
- Dynamic Multicast Delegate : 리플렉션 기반의 이벤트 Broadcast

### 매크로 원형

```cpp
// Dynamic Delegate
DECLARE_DYNAMIC_DELEGATE(DelegateName)
DECLARE_DYNAMIC_DELEGATE_OneParam(DelegateName, ParamType, ParamName)
DECLARE_DYNAMIC_DELEGATE_TwoParams(DelegateName, ParamType1, ParamName1, ParamType2, ParamName2)
DECLARE_DYNAMIC_DELEGATE_RetVal(ReturnType, DelegateName)

// Dynamic Multicast Delegate
DECLARE_DYNAMIC_MULTICAST_DELEGATE(DelegateName)
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(DelegateName, ParamType, ParamName)
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(DelegateName, ParamType1, ParamName1, ParamType2, ParamName2)
```

- DECLARE_DYNAMIC_DELEGATE_* 계열은 SingleCast
- DECLARE_DYNAMIC_MULTICAST_DELEGATE_* 계열은 Multicast
- 반환값은 Dynamic Delegate만 가능
- Dynamic Multicast Delegate는 반환값을 지원하지 않음

### 사용 예시

#### Dynamic Delegate

Dynamic Delegate는 하나의 객체에만 콜백을 전달하는 경우 사용된다.

예를 들어 제작 완료 결과를 하나의 UI 위젯에만 전달하는 상황이다.

```cpp
DECLARE_DYNAMIC_DELEGATE_OneParam(FOnCraftFinishedDynamic, bool, bSuccess);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class UCraftingComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    FOnCraftFinishedDynamic OnCraftFinished;

    void FinishCraft(bool bSuccess)
    {
        // 제작 완료 처리
        OnCraftFinished.ExecuteIfBound(bSuccess);
    }
};

UCLASS()
class UCraftingWidget : public UUserWidget
{
    GENERATED_BODY()

public:
    void BindCraftingComponent(UCraftingComponent* CraftingComp)
    {
        if (CraftingComp)
        {
            CraftingComp->OnCraftFinished.BindDynamic(this, &UCraftingWidget::HandleCraftFinished);
        }
    }

    UFUNCTION()
    void HandleCraftFinished(bool bSuccess)
    {
        // 제작 결과 UI 갱신
    }
};
```

이 예시의 핵심은 다음과 같다.

- BindDynamic()을 사용한다.
- 바인딩 대상 함수는 UFUNCTION()이어야 한다.
- 하나의 함수만 연결된다.
- 호출은 ExecuteIfBound()로 한다.

즉 Dynamic Delegate는
**"리플렉션 기반의 SingleCast Delegate"** 라고 생각하면 된다.

#### Dynamic Multicast Delegate

Dynamic Multicast Delegate는 **하나의 이벤트를 여러 객체가 동시에 구독해야 하는 경우**에 적합하다.

예를 들어 체력이 변경될 때

- UI는 체력바를 갱신하고
- 이펙트 시스템은 피격 연출을 실행하고
- 블루프린트에서는 Event Dispatcher처럼 추가 반응을 연결할 수 있다.

```cpp
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnHealthChanged, float, NewHealth);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class UHealthComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UPROPERTY(BlueprintAssignable)
    FOnHealthChanged OnHealthChanged;

    void SetHealth(float NewHealthValue)
    {
        // 체력 변경
        OnHealthChanged.Broadcast(NewHealthValue);
    }
};

UCLASS()
class UHealthBarWidget : public UUserWidget
{
    GENERATED_BODY()

public:
    void BindHealthComponent(UHealthComponent* HealthComp)
    {
        if (HealthComp)
        {
            HealthComp->OnHealthChanged.AddDynamic(this, &UHealthBarWidget::UpdateHealthBar);
        }
    }

    UFUNCTION()
    void UpdateHealthBar(float NewHealthValue)
    {
        // HP 바 갱신
    }
};

UCLASS()
class UDamageEffectHandler : public UObject
{
    GENERATED_BODY()

public:
    void BindHealthComponent(UHealthComponent* HealthComp)
    {
        if (HealthComp)
        {
            HealthComp->OnHealthChanged.AddDynamic(this, &UDamageEffectHandler::PlayHitEffect);
        }
    }

    UFUNCTION()
    void PlayHitEffect(float NewHealthValue)
    {
        // 피격 이펙트 재생
    }
};
```

이 예시의 핵심은 다음과 같다.

- AddDynamic()으로 여러 리스너를 연결할 수 있다.
- 호출은 Broadcast()로 한다.
- 하나의 이벤트에 여러 시스템이 동시에 반응할 수 있다.
- BlueprintAssignable을 사용하면 블루프린트에서도 바인딩할 수 있다.

즉 Dynamic Multicast Delegate는
**"리플렉션 기반의 이벤트 전달 시스템"** 에 가깝다.
