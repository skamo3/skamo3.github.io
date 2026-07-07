---
title: "[Unreal] 언리얼 엔진에서 구조체를 사용할 때"
date: 2023-02-22
category: unreal
---

언리얼엔진에서 USTRUCT를 사용하다 독특한 에러를 만났다.

C++ 파일을 사용할 때 컴파일 의존성을 최소화 시키기 위해서 헤더파일에서는 class 또는 struct 키워드를 사용하거나 전방선언을 사용하는데 컴파일 에러를 만났다.

```cpp
UFUNCTION()
void SpawnPiece(const TSubclassOf<class AChessPiece> piece, const struct FChessDataRow* Row);
```

다음과 같은 모양으로 함수를 선언했는데 컴파일러가 뒤쪽의 struct 부분에서 아래와 같은 에러를 날렸다.

![컴파일 에러 메시지](/assets/images/blog/unreal-struct-forward-decl/compile-error.png)

원래 구조체가 포인터를 이용한 방식이 안되나 싶어서 직접 테스트를 해보았다.

```cpp
//actor.h
#pragma once


class actor
{

private:

public:
	actor();


	void do_with_struct(const struct t_test* t);
	void do_with_class(const class c_test* c);
};
```

당연하게도 너무 컴파일이 잘 되었다.

찾아보니 언리얼 엔진의 고유 문제였다. 언리얼 엔진에서는 구조체를 사용할 때 위와 같은 방식을 제한하고 있다.

더 자세한 내용이 궁금해서 Chat GPT에게 질문해 언리얼 엔진이 어떤 식으로 처리를 하는지 알 수 있었다.

![ChatGPT 설명 1](/assets/images/blog/unreal-struct-forward-decl/gpt-explanation-1.png)

![ChatGPT 설명 2](/assets/images/blog/unreal-struct-forward-decl/gpt-explanation-2.png)

결론만 보면 언리얼 엔진에서 내부적으로 구조체를 값 형식으로 처리하기 때문에 포인터의 형태로 사용이 불가능 한 거였다.

컴파일 의존성이 늘어나는 것은 어쩔 수 없지만 폴더를 쪼개거나 아니면 한정되는 구조체는 클래스와 함께 놔두는 것이 더 나을 것 같다
