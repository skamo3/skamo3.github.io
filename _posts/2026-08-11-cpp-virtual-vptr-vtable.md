---
title: "[C++] virtual 키워드와 vptr, vtable의 동작 원리"
date: 2026-08-11
category: unreal
mermaid: true
---

면접에서 "vtable은 어떤 정보를 담고 있나요"라는 질문을 받고 함수 주소 표라고만 답했다. 틀린 답은 아닌데, 그 뒤에 이어진 "vtable과 vptr은 각각 언제 생기나요"에서 막혔다. 객체가 만들어질 때 같이 생긴다고 얼버무렸는데 반은 맞고 반은 틀렸다.

정리하면서 직접 찍어봤다. 아래 출력값은 전부 실제로 컴파일해서 나온 결과다.

- MinGW g++ 6.3.0 (32비트, Itanium ABI)
- MSVC 19.x (x64, Microsoft ABI)

두 컴파일러를 같이 돌린 이유는 vtable 레이아웃이 표준이 아니라 ABI가 정하는 영역이라서다. 표준에는 vtable이라는 단어조차 없다.

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

`character`의 정적 타입은 `Character*`이고 동적 타입은 `Warrior*`다. `Attack()`에 `virtual`이 붙어 있어서 `Character::Attack()` 대신 `Warrior::Attack()`이 실행된다.

`virtual`을 떼면 "기본 공격"이 나온다. 컴파일러가 포인터의 정적 타입만 보고 호출 대상을 컴파일 시점에 확정하기 때문이다. 이걸 정적 바인딩이라고 하고, `virtual`이 붙어 실행 중에 결정되는 쪽을 동적 바인딩이라고 한다.

부모 포인터에 자식 객체를 담는 구조를 쓰면서 자식 구현이 불리길 원할 때 `virtual`이 필요해진다.

## vtable과 vptr의 관계

동적 바인딩을 위해 컴파일러가 만드는 것이 vtable이다. 클래스별 가상 함수 주소를 모아둔 표다.

여기서 오해하기 쉬운 부분이 있다. vtable은 객체마다 생기지 않는다. **클래스당 하나**씩 생기고, 객체는 그 표를 가리키는 포인터 하나만 들고 있다. 이 포인터가 vptr이다.

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

객체 맨 앞에 놓인 포인터를 읽으면 그게 vptr이다.

```cpp
void* vptr_of(const void* obj) { return *(void* const*)obj; }

Warrior w1, w2, w3;
Archer  a1, a2;
Character c1;

printf("sizeof(void*)     = %d\n", (int)sizeof(void*));
printf("sizeof(PlainData) = %d\n", (int)sizeof(PlainData));  // 가상 함수 없는 구조체
printf("sizeof(Character) = %d\n", (int)sizeof(Character));
printf("w1 vptr = %p\n", vptr_of(&w1));
// ... 나머지도 동일하게 출력
```

MSVC x64 결과다.

```
sizeof(void*)     = 8
sizeof(PlainData) = 4
sizeof(Character) = 16

w1 vptr = 00007FF62EB18410
w2 vptr = 00007FF62EB18410
w3 vptr = 00007FF62EB18410
a1 vptr = 00007FF62EB18440
a2 vptr = 00007FF62EB18440
c1 vptr = 00007FF62EB183E8
```

Warrior 세 개의 vptr이 전부 같은 주소다. Archer 두 개도 자기들끼리 같고, Character는 또 다르다. 객체를 몇 개 만들든 표는 클래스당 하나라는 게 그대로 보인다.

크기도 눈에 띈다. `int` 하나짜리 `PlainData`는 4바이트인데, `int` 하나에 가상 함수만 추가한 `Character`는 16바이트다. vptr 8바이트가 붙고 정렬 때문에 4바이트가 패딩으로 들어갔다. 32비트 g++에서는 포인터가 4바이트라 같은 코드가 8바이트로 나온다.

## vtable의 실제 구성

vptr은 vtable의 시작이 아니라 **함수 포인터 배열의 시작**을 가리킨다. 메타데이터는 그 앞쪽, 음수 인덱스에 놓인다. Itanium ABI 기준 배치다.

```
        ┌────────────────────────────┐
 vt[-2] │ offset-to-top              │
 vt[-1] │ typeinfo*  (RTTI)          │
        ├────────────────────────────┤
 vt[ 0] │ &Warrior::Attack           │  ← vptr이 가리키는 위치
 vt[ 1] │ &Warrior::~Warrior         │
        └────────────────────────────┘
```

`vt[-1]`이 RTTI다. `std::type_info` 객체를 가리키고, `typeid`와 `dynamic_cast`가 이 값을 읽어 실제 타입을 판별한다.

포인터 연산으로 직접 꺼내볼 수 있다.

```cpp
void** vtable_of(const void* obj) { return *(void** const*)obj; }

void** vt = vtable_of(&w);
std::ptrdiff_t offset_to_top = *(std::ptrdiff_t*)(vt - 2);
const std::type_info* ti = *(const std::type_info**)(vt - 1);
```

g++ 결과다.

```
Character  vtable             = 0040b68c
           [-2] offset-to-top = 0
           [-1] typeinfo      = 9Character
           [ 0] 첫 가상 함수  = 004095dc

Warrior    vtable             = 0040b678
           [-2] offset-to-top = 0
           [-1] typeinfo      = 7Warrior
           [ 0] 첫 가상 함수  = 00409590

typeid(*p).name() = 7Warrior
```

`9Character`의 앞 숫자는 이름 길이다. GCC의 이름 맹글링 규칙이라 그렇게 나온다. 직접 읽은 `vt[-1]`의 이름과 `typeid(*p).name()`의 결과가 같다. `typeid`가 vtable의 이 자리를 읽는다는 뜻이다.

`dynamic_cast`도 마찬가지다. 그래서 RTTI를 끄면(`-fno-rtti`, `/GR-`) 두 기능을 쓸 수 없다.

MSVC는 배치가 다르다.

| | Itanium ABI (GCC/Clang) | MSVC |
|---|---|---|
| 타입 정보 | `vt[-1]`에 `type_info*` | `vt[-1]`에 Complete Object Locator 포인터 |
| 오프셋 | `vt[-2]`에 offset-to-top | COL 구조체 안에 포함 |
| 슬롯 소비 | 2칸 | 1칸 |

MSVC는 타입 정보와 오프셋을 COL이라는 구조체 하나로 묶어 슬롯 한 칸만 쓴다. 위의 `vt - 2` 코드가 MSVC에서 그대로 통하지 않는 이유다.

언리얼은 기본적으로 RTTI를 끄고 빌드한다. 대신 `UCLASS` 리플렉션으로 자체 타입 정보를 만들어 `Cast<T>`를 제공한다. 언리얼에서 `dynamic_cast` 대신 `Cast`를 쓰는 이유가 여기 있는데, 이 이야기는 UCLASS와 GC를 다루는 글에서 따로 정리한다.

## 다중 상속에서의 offset-to-top

단일 상속에서 offset-to-top은 항상 0이라 위 출력에서도 존재감이 없었다. 다중 상속에서 의미가 생긴다.

```cpp
struct A { virtual void f() {} int a; };
struct B { virtual void g() {} int b; };
struct C : A, B {};
```

`C` 객체는 A 파트와 B 파트를 이어붙인 모양이 된다. 각 파트가 자기 vptr을 갖기 때문에 vptr이 두 개다.

```
C 객체 (MSVC x64, 총 32바이트)
        ┌──────────────┐
 +0     │ vptr_A       │  ← &c, (A*)&c
 +8     │ a            │
        ├──────────────┤
 +16    │ vptr_B       │  ← (B*)&c
 +24    │ b            │
        └──────────────┘
```

`B*`로 받으면 포인터가 객체 시작이 아니라 중간을 가리키게 된다. B 인터페이스로 보이려면 B 파트의 시작으로 옮겨야 하기 때문이다.

```
sizeof(A)=16 sizeof(B)=16 sizeof(C)=32
&c     = 00000031265DF788
(A*)&c = 00000031265DF788  diff=0
(B*)&c = 00000031265DF798  diff=16
dynamic_cast<void*>(pb) = 00000031265DF788
```

`(B*)&c`가 16바이트 뒤를 가리킨다. 캐스팅 한 번에 포인터 값이 바뀐 것이다.

offset-to-top은 이 상황을 되돌리기 위한 값이다. B 파트가 가리키는 vtable에 "여기서 몇 바이트 앞으로 가면 완전한 객체의 시작인지"가 음수로 적혀 있다. g++ 32비트에서 확인한 결과다.

```
&c     = 0061ff00
(A*)&c = 0061ff00   (차이 0)
(B*)&c = 0061ff08   (차이 8)

A 파트 offset-to-top = 0
B 파트 offset-to-top = -8

dynamic_cast<void*>(pb) = 0061ff00
pb + offset-to-top      = 0061ff00
```

`dynamic_cast<void*>`로 얻은 완전한 객체 주소와, `pb`에 offset-to-top을 더한 값이 정확히 일치한다. 32비트라 포인터가 4바이트여서 오프셋이 8로 나왔고, 64비트에서는 16이 된다.

`B*`로 받은 포인터로 `C`가 오버라이드한 함수를 호출할 때도 보정이 필요하다. 함수는 `C*`를 기대하는데 넘어온 건 16바이트 밀린 주소라서다. 이 보정은 thunk라는 작은 어댑터 코드가 처리하고, vtable 슬롯에는 실제 함수 대신 thunk 주소가 들어간다.

## 생성자 진행에 따른 vptr 갱신

vtable은 컴파일과 링크 시점에 만들어져 읽기 전용 영역에 상수로 박힌다. 런타임에 생기는 게 아니다. 반면 vptr은 객체가 만들어질 때 설정된다.

그런데 한 번에 설정되지 않는다. 컴파일러는 생성자를 이렇게 확장한다.

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

<pre class="mermaid">
flowchart TD
    A["Character 생성자<br/>vptr = Character vtable"] --> B["Warrior 생성자<br/>vptr = Warrior vtable"]
    B --> C["Paladin 생성자<br/>vptr = Paladin vtable"]
    C --> D["객체 완성"]
    D --> E["Paladin 소멸자<br/>vptr = Paladin vtable"]
    E --> F["Warrior 소멸자<br/>vptr = Warrior vtable"]
    F --> G["Character 소멸자<br/>vptr = Character vtable"]
</pre>

각 생성자와 소멸자에서 vptr 값을 찍고, 같은 자리에서 가상 함수도 불러봤다.

```cpp
struct Character {
    Character() { printf("Character 생성자  vptr = %p  ", vptr_of(this)); Attack(); }
    virtual ~Character() { printf("Character 소멸자  vptr = %p  ", vptr_of(this)); Attack(); }
    virtual void Attack() { printf("-> Character::Attack\n"); }
};
// Warrior, Paladin도 같은 형태로 상속
```

MSVC x64 결과다.

```
[생성]
  Character 생성자  vptr = 00007FF6D9849398  -> Character::Attack
  Warrior   생성자  vptr = 00007FF6D9849418  -> Warrior::Attack
  Paladin   생성자  vptr = 00007FF6D9849498  -> Paladin::Attack

[완성된 객체]
  외부에서 호출     vptr = 00007FF6D9849498  -> Paladin::Attack

[소멸]
  Paladin   소멸자  vptr = 00007FF6D9849498  -> Paladin::Attack
  Warrior   소멸자  vptr = 00007FF6D9849418  -> Warrior::Attack
  Character 소멸자  vptr = 00007FF6D9849398  -> Character::Attack
```

vptr이 `...398` → `...418` → `...498`로 올라갔다가 소멸 때 그대로 되돌아온다. g++에서도 주소만 다를 뿐 같은 패턴이 나왔다.

## 생성자에서 가상 함수 호출

위 출력의 오른쪽을 보면 문제가 그대로 드러난다. `Paladin` 객체를 만들고 있는데도 `Character` 생성자에서는 `Character::Attack`이 불렸다.

컴파일 에러가 아니다. 정상적으로 빌드되고 실행된다. 의도한 파생 구현이 안 불리는 게 문제다.

이건 컴파일러 구현 편의가 아니라 표준이 요구하는 동작이다. `Character` 생성자가 도는 시점에 `Paladin`의 멤버는 아직 초기화되지 않았다. 이때 `Paladin::Attack`이 불려서 초기화 안 된 멤버를 읽으면 미정의 동작이 된다. vptr을 단계적으로 올려서 지금까지 완성된 부분까지만 다형성이 동작하도록 막아둔 것이다.

소멸자도 같은 논리다. `Warrior` 소멸자에 진입한 시점에는 `Paladin` 파트가 이미 파괴됐으니 `Paladin::Attack`이 불리면 안 된다.

호출한 함수가 순수 가상이면 상황이 더 나쁘다. 대응할 구현이 아예 없어서 런타임에 `pure virtual function call`로 죽는다.

## 2단계 초기화와 언리얼의 BeginPlay

해결책은 생성자에서 다형적 초기화를 하지 않는 것이다. 생성자는 멤버 초기화까지만 맡고, 객체가 완성된 뒤 별도 함수를 호출한다. 2단계 초기화라고 부른다.

언리얼이 이 패턴을 엔진 차원에서 강제한다.

| 단계 | 시점 | 여기서 할 일 |
|---|---|---|
| 생성자 | CDO 생성 시점에도 호출됨 | 컴포넌트 생성(`CreateDefaultSubobject`), 기본값 설정 |
| `PostInitializeComponents` | 컴포넌트 등록 완료 후 | 컴포넌트 간 연결, 컴포넌트 의존 초기화 |
| `BeginPlay` | 실제 플레이 시작 시 | 월드 조회, 다른 액터 참조, 게임 로직 시작 |

언리얼 생성자를 조심해야 하는 이유가 하나 더 있다. 생성자는 게임이 시작되기 전 CDO(Class Default Object)를 만들 때도 호출된다. 에디터를 켜는 것만으로 한 번 돌아간다는 뜻이다. 여기서 월드를 찾거나 다른 액터를 참조하면 `GetWorld()`가 null을 반환한다.

C++의 vptr 문제와 언리얼의 CDO 문제는 원인이 다르지만 결론은 같다. 생성자에서는 자기 멤버만 챙기고, 나머지는 객체가 완성된 뒤로 미룬다.

## 가상 소멸자가 필요한 이유

```cpp
Character* character = new Warrior();
delete character;
```

`Character`의 소멸자에 `virtual`이 없으면 `Warrior`의 소멸자가 호출되지 않는다. 컴파일러가 정적 타입인 `Character`만 보고 `Character::~Character`를 직접 부르기 때문이다. `Warrior`가 들고 있던 자원은 그대로 누수된다. 표준상으로는 미정의 동작이다.

`virtual`을 붙이면 소멸자도 vtable 슬롯에 들어간다. 그러면 다른 가상 함수와 똑같이 vptr을 거쳐 실제 타입의 소멸자를 찾아 호출하고, 이어서 부모 소멸자까지 자동으로 연결된다.

그렇다고 모든 클래스에 붙이면 안 된다. vptr이 생겨서 객체 크기가 포인터 하나만큼 늘고, 앞에서 본 것처럼 정렬 패딩까지 붙으면 `int` 하나짜리 구조체가 4바이트에서 16바이트가 된다. POD 성질도 잃는다. 부모 포인터로 삭제될 수 있는 클래스에만 붙이고, 상속시킬 생각이 없으면 `final`을 붙이는 편이 낫다.

## 정리

처음 막혔던 질문으로 돌아가면 답은 이렇게 갈린다.

- vtable은 클래스당 하나, 컴파일과 링크 시점에 만들어져 읽기 전용 영역에 상수로 존재한다
- vptr은 객체당 하나, 생성자가 진행되면서 베이스부터 파생까지 단계적으로 갱신된다
- vtable에는 가상 함수 주소 외에 타입 정보(RTTI)와 오프셋 보정값이 함께 들어간다

"객체가 만들어질 때 같이 생긴다"고 뭉뚱그렸던 게 왜 반만 맞는지도 정리됐다. vptr은 맞고 vtable은 틀리다.

생성자에서 가상 함수를 부르면 안 되는 이유와 소멸자에 `virtual`이 필요한 이유도 같은 구조에서 나온다. vptr이 지금 어떤 표를 가리키고 있는지만 따라가면 둘 다 설명된다.
