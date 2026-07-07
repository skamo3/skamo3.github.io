---
title: "[Unreal Engine] 데이터와 에셋 관리하기"
date: 2026-06-26
category: unreal
---

### 데이터 에셋

UDataAsset은 **특정 시스템과 관련된 데이터를 담아두는 단순한 에셋 클래스.**

UDataAsset의 가장 큰 목적은 **필요한 데이터를 에셋 형태로 저장하는 것.** 아이템 정보, 스킬 설정, 몬스터 파라미터와 같은 데이터가 핵심이 되는 정보를 분리할 때 유용하다.

UPrimaryDataAsset은 UDataAsset을 상속한 클래스. **Asset Manager를 통해 수동으로 로드/언로드할 수 있는** Data Asset이다. 즉 일반 UDataAsset보다 "에셋 관리 체계"에 더 잘 올라가는 형태라고 보면 된다.

![데이터 에셋 실전 예시](/assets/images/blog/unreal-data-asset-management/data-asset-example.png)

### 에셋 매니저

Asset Manager 는 사용할 에셋을 언제 찾고, 로드하고, 어떤 단위로 관리할 지 제어하기 위한 전역 매니저 클래스.

언리얼은 기본적으로 에셋 로딩을 자동 처리해주지만, 더 정밀한 제어를 요할 때 Asset Manager를 이용한다.

```cpp
#pragma once

#include "CoreMinimal.h"
#include "Engine/PrimaryDataAsset.h"
#include "ItemDataAsset.generated.h"

class UTexture2D;
class UStaticMesh;
class AActor;

UCLASS(BlueprintType)
class UItemDataAsset : public UPrimaryDataAsset
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Item")
    FName ItemId;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Item")
    FText DisplayName;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Item")
    FText Description;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Item")
    int32 Price = 0;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Item")
    TSoftObjectPtr<UTexture2D> Icon;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Item")
    TSoftObjectPtr<UStaticMesh> WorldMesh;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Item")
    TSoftClassPtr<AActor> PickupActorClass;
};
```

DataAsset 예시이다. 아이템의 정의는 가볍게 유지하면서 실제 리소스는 TSoftObjectPtr 을 이용해 필요할 때만 로드할 수 있다는 장점이 있다.

### 강참조(Hard Referencing)와 약참조(Soft Referencing)

강참조, 약참조는 참조 대상을 **언제 메모리에 올리고 얼마나 강하게 의존하냐?** 를 결정하는 것이다.

강참조는 **오브젝트 A가 오브젝트 B를 직접 참조하고 있어 오브젝트 A를 로드할 때 오브젝트B도 함께 로드**되는 형태이다.

약참조는 **경로를 기반으로 대상을 참조하고 있다가 실제 필요해지는 시점에 로드하는 방식**이다.

강참조는 접근이 편하지만 의존성이 커지고, 약참조는 로드 시점을 직접 제어할 수 있다는 차이가 있다. 특정 오브젝트를 띄울 때 함께 뜰 필요가 있는 경우라면 Hard Referencing을 특정 오브젝트가 뜰 때 같이 뜰 필요가 없다면 Soft Referencing을 사용한다고 보면 된다.

### 포인터의 종류와 역할

**TObjectPtr, TSoftObjectPtr, TWeakObjectPtr** 은 서로 역할이 다른 포인터이다.

TObjectPtr 는 UObject 멤버를 가리킬 떄 쓰는 기본 포인터. UPROPERTY와 함께 사용하면 GC가 추적할 수 있는 일반 오브젝터 참조로 동작하고, DataAsset 에서 TObjectPtr로 들고있으면 Hard Referencing 으로 작동한다. 사용이 가장 단순하지만 텍스쳐나 메시 등을 많이 연결하면 참조가 많아지고 그만큼 로딩 참조가 무거워질 수 있다.

TSoftObjectPtr 는 에셋을 경로 기반으로 들고 있는 Soft Referencing이다. 대상이 메모리에 올라와있지 않아도 참조를 유지할 수 있도, 필요할 떄 LoadSynchronous() 함수를 이용하거나 비동기 로드를 이용해 실제 에셋을 로드해올 수 있다.

같은 약참조로 불리는 TWeakObjectPtr 는 에셋 지연 로드용 포인터가 아닌 이미 런타임에 존재하는 UObject 인스턴스를 임시로 저장해두는 용도의 포인터이다. 데이터 에셋을 이용할 때 약참조라고해서 TWeakObjectPtr을 쓰지 않도록 조심해야 한다.

### 지연 로드

지연 로드, Lazy Loding 이란. **중요도가 떨어지거나 당장 사용되지 않아도 되는 에셋을 필요한 순간까지 메모리에 올리지 않는 방식**으로 로딩 퍼포먼스 최적화에 사용되는 기법이다. 예를 들어 인벤토리에 아이템 데이터 에셋이 수백 개라고 할 때 각 아이템이 아이콘, 메시, 드롭 액터 클래스 등을 모두 강참조하고 있으면 단순 데이터만 확인하고 싶을 때에도 관련 리소스들이 엮여 로드되고 인벤토리 오픈에 긴 시간이 걸릴 수 있다. 이런 데이터들을 TSoftObjectPtr을 이용해 저장해두면 아이템의 이름, 설명, 가격 등의 가벼운 정보만 먼저 확인하고 실제 아이콘이나 메시 등은 UI에서 필요한 순간에 표시할 수 있고 이를 통해 필요한 시점에만 불러오도록 제어할 수 있어진다.

아래와 같은 방식을 이용해 지연 로드를 할 수 있다.

```cpp
UTexture2D* UMyInventorySlotWidget::GetItemIcon(UItemDataAsset* ItemData)
{
    if (!ItemData || ItemData->Icon.IsNull())
    {
        return nullptr;
    }

    return ItemData->Icon.LoadSynchronous();
}
```

추후 최적화를 위해서라면 반드시 써야할 기법이다.
