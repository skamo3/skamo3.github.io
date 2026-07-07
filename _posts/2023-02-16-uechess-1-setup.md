---
title: "[UEChess] 언리얼, 블렌더를 이용한 3D체스 만들기 1. 시작 - 프로젝트 세팅 및 기본 구조 잡기"
date: 2023-02-16
category: game-dev
---

다시 언리얼엔진 개발을 시작하면서 개인 프로젝트로 어떤 게임을 만들어 볼까 하다가 체스를 만들어 보기로 결정했다.

다양한 방식으로 개발한 체스 코드 예시가 있기에 참고하기 용이해 정한 것도 있고 로직과 동시에 언리얼 엔진에서 제공하는 다양한 기능들을 활용해 볼 수 있을 듯하여 체스를 만들어보기로 결정했다.

가장 첫 번째로 생각한 부분은 에셋에 대한 부분이었는데 무료로 된 에셋은 없어 이 기회에 3D 아트도 배워볼까 하고 알아봤다. 다행히 **블렌더**라는 무료 모델링 툴이 있었고 블렌더로 에셋의 기초를 제작하고 애니메이션이나 디테일은 언리얼 엔진에서 챙기기로 결정했다.

> ⊙ 이 글은 튜토리얼이나 완벽한 작업물을 기록하는 글이 아닌 스스로의 작업 진행을 기록하기 위한 글이므로 더 나은 방법 더 효율적인 방법이 있을 수 있습니다.

가장 먼저 한 것은 당연히 프로젝트 생성.

엔진은 **언리얼엔진 5.0**으로 진행, **블렌더 3.3.0** 버전으로 진행.

기초적인 체스 로직은 [C++ 콘솔 체스 만들기를](https://m.blog.naver.com/PostView.naver?isHttpsRedirect=true&blogId=wkdghcjf1234&logNo=220462650202) 메인으로 참고한다.

프로젝트는 진행 상황 기록을 위해 [깃허브](https://github.com/skamo3/ChessProject)로 소스코드를 관리한다.

게임의 기본 틀을 이끌어 줄 Chessboard 클래스와 각 Piece들의 기본 구현을 담당할 ChessPiece 클래스를 생성.
ChessPiece 클래스를 상속받아 각 체스 말들을 만들어준다

**ChessPiece**
**└ ChessPawn**
**└ ChessKnight**
**└ ChessBishop**
**└ ChessRook**
**└ ChessQueen**
**└ ChessKing**

위와 같은 모양으로 상속 구조가 이루어짐.

그다음 월드 상에서 위치 정보를 담당할 SceneComponent와 각각 메시를 넣을 수 있도록 StaticMeshComponent를 추가해 주었다. 추후에는 단순한 체스피스가 아닌 애니메이션을 가진 특수한 체스피스를 디자인해 넣어볼 예정이라 SkeletalMesh로 바꿀 수도 있지만 한참 나중의 이야기가 될 테니 일단 StaticMesh로 기초 틀만 잡는다.

SceneComponent의 경우 체스보드에서 SpawnActor로 객체를 생성할 경우 없어서는 안 된다는 Warning을 띄워 추가해 주었다.

![SceneComponent 관련 경고](/assets/images/blog/uechess-1-setup/scenecomponent-warning.png)

생성자에서 바인딩해 주는 것도 잊지 않기.

![생성자에서 컴포넌트 바인딩](/assets/images/blog/uechess-1-setup/constructor-binding.png)

Chessboard 에도 위와 같게 StaticMesh를 추가해 주었다. Chessboard의 경우 월드에 배치된 상태로 시작할 예정이기에 SceneComponent는 따로 추가하지 않았다.

중요한 건 UPROPERTY()에 EditDefaultsOnly를 넣어줘야지만 블루프린트로 생성했을 때 수정이 가능하다.

대부분 튜토리얼에서 사용하는 FObjectFinder() 함수나 FClassFinder() 함수로 하드 레퍼런스 경로를 받아오는 방법도 있긴 하지만 블루프린트 내에서 추적이 되지 않아 런타임에러에 취약하고 다른 에셋으로 바꾸어 보고 싶을 때마다 C++코드를 리컴파일 해야 하는 번거로움이 있기 때문에 C++로는 기본 모양만 잡은 후 블루프린트에서 다양한 변경을 줄 수 있도록 설계.

![디렉토리 구조](/assets/images/blog/uechess-1-setup/directory-structure.png)
![레벨 세팅](/assets/images/blog/uechess-1-setup/level-setup.png)

시작 전에 간단하게 지속해서 사용할 수 있도록 Chess 디렉토리를 만들어주고 필요한 디렉토리들을 배치해 준다. 기본 맵으로 쓰일 Chess 레벨도 생성해 주었다.

체스는 이미 룰이 정해져 있는 만큼 초기에 필요한 변수들을 생성해 둘 수 있다는 장점이 있다.

체스에서 쓰일 기본타입들로는 행과 열을 나타낼 Rank와 File 각 피스들의 종류를 구분해 줄 Type, 그리고 하얀 말인지 검정말인지 구분할 때 사용할 Team. 총 4개의 Enum class를 만들어 주었다. 각 enum의 개수를 구할 수 있도록 끝에는 max 값도 넣어줬다.

```cpp
#pragma once

#include "CoreMinimal.h"
#include "ChessTypes.generated.h"

UENUM()
enum class EChessRank
{
	Rank1	UMETA(DisplayName = "Rank1"),
	Rank2	UMETA(DisplayName = "Rank2"),
	Rank3	UMETA(DisplayName = "Rank3"),
	Rank4	UMETA(DisplayName = "Rank4"),
	Rank5	UMETA(DisplayName = "Rank5"),
	Rank6	UMETA(DisplayName = "Rank6"),
	Rank7	UMETA(DisplayName = "Rank7"),
	Rank8	UMETA(DisplayName = "Rank8"),
	MaxNum	UMETA(DisplayName = "MaxRank"),
};

UENUM()
enum class EChessFile
{
	FileA	UMETA(DisplayName = "FileA"),
	FileB	UMETA(DisplayName = "FileB"),
	FileC	UMETA(DisplayName = "FileC"),
	FileD	UMETA(DisplayName = "FileD"),
	FileE	UMETA(DisplayName = "FileE"),
	FileF	UMETA(DisplayName = "FileF"),
	FileG	UMETA(DisplayName = "FileG"),
	FileH	UMETA(DisplayName = "FileH"),
	MaxNum	UMETA(DisplayName = "MaxFile"),
};

UENUM()
enum class EChessTeam
{
	Black	UMETA(DisplayName = "Black"),
	White	UMETA(DisplayName = "White"),
	MaxNum	UMETA(DisplayName = "MaxNum"),
};

UENUM()
enum class EChessType
{
	Pawn	UMETA(DisplayName = "Pawn"),
	Rook	UMETA(DisplayName = "Rook"),
	Knight	UMETA(DisplayName = "Knight"),
	Bishop	UMETA(DisplayName = "Bishop"),
	Queen	UMETA(DisplayName = "Queen"),
	King	UMETA(DisplayName = "King"),
	MaxNum	UMETA(DisplayName = "MaxNum"),
};
```

![ChessPiece 타입 마킹](/assets/images/blog/uechess-1-setup/piece-type-marking.png)

잊지 않고 ChessPiece에 마킹해 줄 타입들을 넣어준다.

이제 기본 함수들을 구현해 보자. 함수 구조는 위에서 언급한 [C++ 콘솔 체스 만들기를](https://m.blog.naver.com/PostView.naver?isHttpsRedirect=true&blogId=wkdghcjf1234&logNo=220462650202) 따라 만들었다.

우선 ChessPiece들의 기본 행동인 Move와 Attack를 선언.

```cpp
virtual bool Move(enum class EChessRank RankDest, enum class EChessFile FileDest,
	enum class EChessRank RankOrigin, enum class EChessFile FileOrigin) const;

virtual bool Attack(enum class EChessRank RankDest, enum class EChessFile FileDest,
	enum class EChessRank RankOrigin, enum class EChessFile FileOrigin) const;
```

참고 글에서는 x, y로 간단하게 했지만 나는 enum을 이용해 위치를 잡을 예정이니 enum class로 잡아주었다. 우선 선언만 해두고 기능 구현은 추후에 하기 위해 return false;만 넣어둔 채로 스킵.

Chessboard에도 기본 동작인 GetPiece()와 MovePiece()를 선언한다.

```cpp
class ChessPiece* GetPiece(enum class EChessRank Rank, enum class EChessFile File);
bool MovePiece(enum class EChessRank RankDest, enum class EChessFile FileDest,
	enum class EChessRank RankOrigin, enum class EChessFile FileOrigin);
```

그리고 월드의 기본 세팅을 자유롭게 바꾸기 위해 ChessGameMode와 Input 세팅을 자유롭게 바꾸기 위한 ChessPlayerController, 그리고 나중에 플레이 시 카메라를 자유롭게 이동하면서 뷰 세팅을 할 수 있게 하기 위해 ChessPlayerChracter 클래스도 미리 만들어 주었다.

오늘은 여기까지.
