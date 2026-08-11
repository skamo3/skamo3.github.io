---
title: "[C++] virtual 키워드와 vptr, vtable의 동작 원리"
date: 2026-08-11
category: unreal
mermaid: true
---

## 정적 바인딩과 동적 바인딩

```cpp
class Character
{
public:
    virtual void Attack() { std::cout << "기본 공격\n"; }
    virtual ~Character() = default;
};

class Warrior : public Character
{
public:
    void Attack() override { std::cout << "검으로 공격\n"; }
};

int main()
{
    Character* character = new Warrior();
    character->Attack();   // "검으로 공격"
    delete character;
}
```

`character`의 정적 타입은 `Character*`다. 실제로 가리키는 객체의 타입인 동적 타입은 `Warrior`다. `Attack()`에 `virtual`이 붙어 있어서 `Character::Attack()` 대신 `Warrior::Attack()`이 실행된다.

`virtual`을 떼면 "기본 공격"이 나온다. 컴파일러가 정적 타입만 보고 호출 대상을 컴파일 시점에 확정하기 때문이다. 이 방식을 정적 바인딩, `virtual`이 붙어 동적 타입 기준으로 실행 중에 정해지는 방식을 동적 바인딩이라고 한다. 런타임 다형성은 동적 바인딩으로 구현된다.

## vtable과 vptr의 관계

동적 바인딩을 위해 컴파일러가 만드는 것이 vtable이다. 클래스별 가상 함수 주소를 모아둔 표다.

vtable은 객체마다 생기지 않는다. **클래스당 하나**씩 생기고, 객체는 그 표를 가리키는 포인터 하나만 들고 있다. 이 포인터가 vptr이다.

`Character`를 `Warrior`와 `Archer`가 상속하는 구조라면 vtable은 세 개다.

| 슬롯 | Character vtable | Warrior vtable | Archer vtable |
|---|---|---|---|
| 0 | `&Character::Attack` | `&Warrior::Attack` | `&Archer::Attack` |
| 1 | `&Character::~Character` | `&Warrior::~Warrior` | `&Archer::~Archer` |

같은 함수가 항상 같은 슬롯 번호에 놓인다. 파생 클래스가 오버라이드하면 그 슬롯의 주소만 자기 구현으로 바뀌고, 새로 추가한 가상 함수는 뒤에 붙는다.

이 규칙 덕분에 컴파일러는 `character->Attack()`을 "vptr이 가리키는 표의 0번을 호출"로 번역할 수 있다. 실제 클래스가 무엇인지 몰라도 되고 0번이라는 것만 알면 된다.

<pre class="mermaid">
flowchart LR
    P["Character* character"] --> O["Warrior 객체"]
    O --> VP["vptr<br/>객체 맨 앞 포인터"]
    VP --> VT["Warrior vtable<br/>함수 주소 표"]
    VT --> F["Warrior::Attack()"]
</pre>

### 직접 확인

vptr은 객체 메모리의 맨 앞에 놓인다. 객체 주소를 포인터로 한 번 역참조하면 그 값을 읽을 수 있다.

```cpp
#include <cstdio>

// 멤버는 int 하나로 같고, 가상 함수 유무만 다르다
class PlainData
{
public:
    int hp;
};

class Character
{
public:
    int hp;
    virtual void Attack() {}
    virtual ~Character() {}
};

class Warrior : public Character
{
public:
    void Attack() override {}
};

class Archer : public Character
{
public:
    void Attack() override {}
};

// 객체 맨 앞에 놓인 포인터가 vptr이다
void* vptr_of(const void* obj) { return *(void* const*)obj; }

int main()
{
    printf("sizeof(void*)     = %d\n", (int)sizeof(void*));
    printf("sizeof(PlainData) = %d\n", (int)sizeof(PlainData));
    printf("sizeof(Character) = %d\n", (int)sizeof(Character));

    Warrior w1, w2, w3;
    Archer  a1, a2;
    Character c1;

    printf("w1 vptr = %p\n", vptr_of(&w1));
    printf("w2 vptr = %p\n", vptr_of(&w2));
    printf("w3 vptr = %p\n", vptr_of(&w3));
    printf("a1 vptr = %p\n", vptr_of(&a1));
    printf("a2 vptr = %p\n", vptr_of(&a2));
    printf("c1 vptr = %p\n", vptr_of(&c1));
}
```

Visual Studio 2022, x64 결과다. 주소값 자체는 빌드와 실행마다 바뀌니 값이 같은지 다른지만 보면 된다.

```
sizeof(void*)     = 8
sizeof(PlainData) = 4
sizeof(Character) = 16

w1 vptr = 00007FF776BE2438
w2 vptr = 00007FF776BE2438
w3 vptr = 00007FF776BE2438
a1 vptr = 00007FF776BE2450
a2 vptr = 00007FF776BE2450
c1 vptr = 00007FF776BE2420
```

Warrior 세 개의 vptr이 전부 같은 주소다. Archer 두 개도 자기들끼리 같고, Character는 또 다르다. 객체 수와 무관하게 표는 클래스당 하나다.

`int` 하나짜리 `PlainData`는 4바이트, 같은 멤버에 가상 함수만 추가한 `Character`는 16바이트다. vptr 8바이트가 붙고 정렬 때문에 4바이트가 패딩으로 들어갔다. 32비트로 빌드하면 포인터가 4바이트라 8바이트로 나온다.

## vtable에 함께 들어가는 타입 정보

vtable에는 가상 함수 주소만 있는 게 아니다. 그 클래스가 무엇인지 알려주는 타입 정보도 함께 들어간다. `typeid`와 `dynamic_cast`가 실제 타입을 판별할 때 읽는 값이 이것이다.

```
Warrior 객체                  Warrior vtable
┌──────────────┐             ┌──────────────────────┐
│ vptr         │ ─────────▶  │ 타입 정보 (RTTI)      │
├──────────────┤             ├──────────────────────┤
│ hp           │             │ &Warrior::Attack     │
└──────────────┘             │ &Warrior::~Warrior   │
                             └──────────────────────┘
```

앞의 코드 끝에 두 줄만 추가하면 확인할 수 있다.

```cpp
#include <typeinfo>

Character* p = &w1;
printf("typeid(p).name()  = %s\n", typeid(p).name());
printf("typeid(*p).name() = %s\n", typeid(*p).name());
```

```
typeid(p).name()  = class Character * __ptr64
typeid(*p).name() = class Warrior
```

포인터 자체인 `p`와 포인터가 담고있는 객체인 `*p`를 비교해보면 `typeid(p)`는 `Character*`의 포인터 정보를 알려준다. 하지만 `typeid(*p)`는 실제 포인터가 담고있는 객체에 접근하고, 이 때 vptr을 따라가 vtable의 타입 정보를 읽어오게 되면서 실제 타입인 `Warrior`이 출력으로 나타난다.

`dynamic_cast`도 비슷한 개념으로 실행된다. 빌드 시 RTTI를 끄는 옵션을 주면 `typeid`와 `dynamic_cast`도 사용이 불가능해진다.

언리얼에서는 `UCLASS`를 이용한 리플렉션으로 자체 타입정보를 만들고, `Cast<T>`를 제공해 타입을 알 수 있게 해준다. 언리얼에서는 기본적으로 RTTI를 끄기 때문에 `dynamic_cast` 대신 `Cast<T>`를 써야한다.

vtable은 컴파일러마다 구현 방식이 다르고 vtable이라는 용어도 추상적인 단어이지 공식 단어가 아니다. 그렇기에 virtual을 쓰게되면 타입 정보와 함수 주소를 이용해 실제 객체를 판별한다는 정도로 이해하면 될 거 같다.

## vtable의 생성과 vptr 갱신

둘은 만들어지는 시점이 다르다.

- **vtable**: 컴파일과 링크 시점에 만들어져 실행 파일 안에 상수로 들어간다. 런타임에 생기지 않는다
- **vptr**: 런타임에 객체가 생성될 때 값이 지정된다

### 객체마다 하나씩

앞에서 `w1`, `w2`, `w3`의 vptr 값이 전부 같았다. 같은 표를 가리킨다는 뜻이지 vptr 하나를 공유한다는 뜻은 아니다. vptr은 객체마다 따로 존재한다.

객체 주소와 vptr 값을 같이 찍어보면 구분된다.

```cpp
Warrior w1, w2;

printf("w1  객체 주소 = %p   vptr 값 = %p\n", (void*)&w1, vptr_of(&w1));
printf("w2  객체 주소 = %p   vptr 값 = %p\n", (void*)&w2, vptr_of(&w2));
```

```
w1  객체 주소 = 000000936B1FFC28   vptr 값 = 00007FF6514883A0
w2  객체 주소 = 000000936B1FFC18   vptr 값 = 00007FF6514883A0
```

객체 주소는 다르고 vptr 값은 같다. `w1`과 `w2`가 각자 자기 메모리에 vptr을 하나씩 갖고 있고, 거기 담긴 값이 같은 Warrior vtable 주소다. Warrior 객체를 1,000개 만들면 vptr도 1,000개 생기지만 vtable은 여전히 하나다.

### 생성자가 진행되면서 갱신된다

vptr은 객체 생성 시점에 한 번에 정해지지 않는다. 컴파일러는 생성자를 이렇게 확장한다.

```
Warrior::Warrior()
{
    Character::Character();      // ① 베이스 생성자 (그 안에서 vptr = Character vtable)
    vptr = &Warrior_vtable;      // ② 베이스가 끝난 직후, 멤버 초기화 리스트보다 앞
    /* 멤버 초기화 리스트 */      // ③
    /* 생성자 본문 */             // ④
}
```

갱신 시점은 베이스 생성자가 전부 끝난 직후, 자기 멤버 초기화가 시작되기 전이다. 상속이 3단이면 vptr이 세 번 바뀌고, 소멸자는 역순으로 되돌린다.

각 생성자와 소멸자에서 vptr 값을 찍고, 같은 자리에서 가상 함수를 불러봤다.

```cpp
#include <cstdio>

void* vptr_of(const void* obj) { return *(void* const*)obj; }

class Character
{
public:
    Character()          { Show("Character 생성자"); }
    virtual ~Character() { Show("Character 소멸자"); }
    virtual void Attack() { printf("Character::Attack\n"); }

protected:
    void Show(const char* at) { printf("%s   vptr = %p   -> ", at, vptr_of(this)); Attack(); }
};

class Warrior : public Character
{
public:
    Warrior()           { Show("Warrior   생성자"); }
    ~Warrior() override { Show("Warrior   소멸자"); }
    void Attack() override { printf("Warrior::Attack\n"); }
};

class Paladin : public Warrior
{
public:
    Paladin()           { Show("Paladin   생성자"); }
    ~Paladin() override { Show("Paladin   소멸자"); }
    void Attack() override { printf("Paladin::Attack\n"); }
};

int main()
{
    Character* p = new Paladin();
    printf("%s       vptr = %p   -> ", "객체 완성", vptr_of(p));
    p->Attack();
    delete p;
}
```

```
Character 생성자   vptr = 00007FF7E01A9368   -> Character::Attack
Warrior   생성자   vptr = 00007FF7E01A93E0   -> Warrior::Attack
Paladin   생성자   vptr = 00007FF7E01A9440   -> Paladin::Attack
객체 완성       vptr = 00007FF7E01A9440   -> Paladin::Attack
Paladin   소멸자   vptr = 00007FF7E01A9440   -> Paladin::Attack
Warrior   소멸자   vptr = 00007FF7E01A93E0   -> Warrior::Attack
Character 소멸자   vptr = 00007FF7E01A9368   -> Character::Attack
```

vptr이 `...368` → `...3E0` → `...440`으로 올라갔다가 소멸 때 그대로 되돌아온다. 오른쪽 열을 같이 보면 그 시점에 어느 구현이 불리는지가 vptr을 따라간다.

| 실행 시점 | vptr이 가리키는 vtable | `Attack()` 호출 결과 |
|---|---|---|
| Character 생성자 | Character | `Character::Attack` |
| Warrior 생성자 | Warrior | `Warrior::Attack` |
| Paladin 생성자 | Paladin | `Paladin::Attack` |
| 객체 완성 | Paladin | `Paladin::Attack` |
| Paladin 소멸자 | Paladin | `Paladin::Attack` |
| Warrior 소멸자 | Warrior | `Warrior::Attack` |
| Character 소멸자 | Character | `Character::Attack` |

## 생성자에서 가상 함수 호출

`Paladin` 객체를 만드는 중인데 `Character` 생성자에서는 `Character::Attack`이 불렸다.

컴파일 에러가 아니다. 정상적으로 빌드되고 실행된다. 의도한 파생 구현이 안 불리는 게 문제다.

이건 컴파일러 구현 편의가 아니라 표준이 요구하는 동작이다. `Character` 생성자가 도는 시점에 `Paladin`의 멤버는 아직 초기화되지 않았다. 이때 `Paladin::Attack`이 불려서 초기화 안 된 멤버를 읽으면 미정의 동작이 된다. vptr을 단계적으로 올려서 지금까지 완성된 부분까지만 다형성이 동작하도록 막아둔 것이다.

소멸자도 같은 논리다. `Warrior` 소멸자에 진입한 시점에는 `Paladin` 파트가 이미 파괴됐으니 `Paladin::Attack`이 불리면 안 된다.

순수 가상 함수를 호출하면 대응할 구현이 없어 런타임에 `pure virtual function call`로 죽는다.

## 2단계 초기화와 언리얼의 BeginPlay

해결책은 생성자에서 다형적 초기화를 하지 않는 것이다. 생성자는 멤버 초기화까지만 맡고, 객체가 완성된 뒤 별도 함수를 호출한다. 2단계 초기화라고 부른다.

언리얼이 이 패턴을 엔진 차원에서 강제한다.

| 단계 | 시점 | 여기서 할 일 |
|---|---|---|
| 생성자 | CDO 생성 시점에도 호출됨 | 컴포넌트 생성(`CreateDefaultSubobject`), 기본값 설정 |
| `PostInitializeComponents` | 컴포넌트 등록 완료 후 | 컴포넌트 간 연결, 컴포넌트 의존 초기화 |
| `BeginPlay` | 실제 플레이 시작 시 | 월드 조회, 다른 액터 참조, 게임 로직 시작 |

언리얼 생성자는 게임이 시작되기 전 CDO(Class Default Object)를 만들 때도 호출된다. 에디터를 켜는 것만으로 한 번 돌아간다. 여기서 월드를 찾거나 다른 액터를 참조하면 `GetWorld()`가 null을 반환한다.

생성자에서는 자기 멤버만 초기화하고 나머지는 객체가 완성된 뒤로 미룬다.

## 가상 소멸자가 필요한 이유

```cpp
Character* character = new Warrior();
delete character;
```

`Character`의 소멸자에 `virtual`이 없으면 `Warrior`의 소멸자가 호출되지 않는다. 컴파일러가 정적 타입인 `Character`만 보고 `Character::~Character`를 직접 부르기 때문이다. `Warrior`가 들고 있던 자원은 그대로 누수된다. 표준상으로는 미정의 동작이다.

`virtual`을 붙이면 소멸자도 vtable 슬롯에 들어간다. 그러면 다른 가상 함수와 똑같이 vptr을 거쳐 실제 타입의 소멸자를 찾아 호출하고, 이어서 부모 소멸자까지 자동으로 연결된다.

그렇다고 모든 클래스에 붙이면 안 된다. vptr이 생겨서 객체 크기가 포인터 하나만큼 늘고, 정렬 패딩까지 붙으면 `int` 하나짜리 클래스가 4바이트에서 16바이트가 된다. 부모 포인터로 삭제될 수 있는 클래스에만 붙이고, 상속시킬 생각이 없으면 `final`을 붙이는 편이 낫다.

## 정리

- vtable은 클래스당 하나, 컴파일과 링크 시점에 생성되어 읽기 전용 영역에 상수로 존재한다
- vptr은 객체당 하나, 생성자가 진행되면서 베이스부터 파생까지 단계적으로 갱신된다
- vtable에는 가상 함수 주소와 함께 타입 정보(RTTI)가 들어가고, `typeid`와 `dynamic_cast`가 이를 읽는다
