---
title: "[UEChess] 언리얼, 블렌더를 이용한 3D체스 만들기 3. 데이터 테이블을 이용해 체스피스 스폰 장소 및 정보 특정하기"
date: 2023-02-21
category: game-dev
---

> ⊙ 이 글은 튜토리얼이나 완벽한 작업물을 기록하는 글이 아닌 스스로의 작업 진행을 기록하기 위한 글이므로 더 나은 방법 더 효율적인 방법이 있을 수 있습니다.

체스피스를 스폰하기 위해 많은 방법을 고민해봤다. 처음에는 만들어 낸 StaticMesh 위에 소켓을 생성한 후에 Chessboard의 BeginPlay() 에서 소켓에 Attach하는 방식으로 각 체스 피스들을 만들었다.

처음에는 각 Piece 들의 위치를 특정하고 소켓을 만들었다 Black_Pawn_1 Black_Rook_2 같은 방식으로 말이다. 이렇게 만들고 Spawn을 하고 나니 몇 가지 문제가 생겼다.

1. 위치가 약간 바뀔 때마다 모든 소켓을 조정해주어야 하는데, 일괄적인 조정이 힘들어 아주 귀찮다.
2. 이게 중요했는데 Spawn한 후에 각 Piece들이 보드 위의 어떤 위치(File, Rank)인지 특정지어 주어야 하는데 너무 하드코딩이 되어버리는 문제가 생겼다.

그래서 다시 생각한 방식은 보드 위에 A1 ~ H8 까지 소켓을 만든 후에 Spawn하는 방식이었는데 이러니 어떤 Piece의 특징을 가질지 특정하는 부분이 또 다른 하드코딩이었다.

그러던 중 [액션 RPG의 플레이어 어빌리티 시스템 강의](https://youtu.be/vknzNVYJjr4)를 보았다. 해당 강의에서 데이터 테이블을 사용하는 부분을 보았고 데이터 테이블을 이용해 정보를 저장한 후 Spawn 시에 해당 정보를 이용해 위치와 Piece의 종류를 특정하는 방식으로 구현해보고자 생각했다.

가장 큰 장점은 Unreal Engine의 Data Table은 엑셀 문서로 작업해 Import하거나 에디터에서 작업한 후 Export 할 수 있다는 점이었고, 정보가 바뀔 때마다 복잡하게 여러 블루프린트를 바꿀 필요 없이 하나의 데이터 테이블 값만 바꾸어 주면 된다.

구현을 위해서 두 링크를 참고했다

[공식 문서](https://docs.unrealengine.com/4.27/ko/InteractiveExperiences/DataDriven/)

[베르의 프로그래밍 노트](https://wergia.tistory.com/154)(언리얼에 대한 정보를 많이 정리해두어 참고를 자주 한다)

우선 가장 먼저 데이터 테이블에 사용할 Row를 만들어 주었다.

```cpp
// ChessTypes.h

USTRUCT(Atomic, BlueprintType)
struct FChessDataRow : public FTableRowBase
{

	GENERATED_BODY()

public:
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Init")
		FVector Location;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Init")
		EChessType Type;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Init")
		EChessTeam Team;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Init")
		EChessRank Rank;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Init")
		EChessFile File;


};
```

- 실제 Spawn후 배치할 위치 정보를 저장할 Location
- 보드의 배열에 들어갈 Rank, File 변수
- Piece 타입과 어떤 팀인지 구분 할 Type, Team

그 다음 Chessboard의 BeginPlay에 데이터를 읽고 Spawn하는 함수를 만들어주었다.

```cpp
// Chessboard.h
// 이 전 내용에 해당 내용 추가
#include "ChessTypes.h"

UCLASS()
class CHESSPROJECT_API AChessboard : public AActor
{
	GENERATED_BODY()

	

protected:

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Board")
		TArray<class AChessPiece*> Pieces;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Location")
		class UDataTable* ChessPieceData;

	UFUNCTION()
		void SpawnPiece(const TSubclassOf<class AChessPiece> piece, const FChessDataRow& Row);


public:	
	void LocatingPiece(AChessPiece* TargetPiece, EChessFile FileDest, EChessRank RankDest);
};
```

- Pieces 들을 저장하고 이동 시에 편하게 관리할 TArray 변수
- DataTable을 연결해 줄 UDataTable 변수

EditDefaults Property를 넣어주면서 블루프린트에서 편집 가능하도록 했다.

![LocatingPiece 함수 시그니처](/assets/images/blog/uechess-3-datatable/locatingpiece-signature.png)

LocatingPiece() 함수는 추후 SpawnPiece 함수 내부에서 액터 생성 후 Array내부에 위치시키기 위한 함수이다.

```cpp
// Chessboard.cpp

void AChessboard::BeginPlay()
{
	Super::BeginPlay();

	// 데이터 테이블 객체가 있는지 확인
	if (ChessPieceData != nullptr) 
	{
    	// 데이터 테이블의 모든 Row들을 받아온 후
		FString ContextString;
		TArray<FChessDataRow*> Rows;
		ChessPieceData->GetAllRows<FChessDataRow>(ContextString, Rows);
		for (FChessDataRow* Row : Rows)
		{
        	// 각 Row의 Type에 따라 Spawn 해준다
			switch (Row->Type)
			{
			case EChessType::Pawn:
				SpawnPiece(ChessPawn, *Row);
				break;
			case EChessType::Rook:
				SpawnPiece(ChessRook, *Row);
				break;
			case EChessType::Knight:
				SpawnPiece(ChessKnight, *Row);
				break;
			case EChessType::Bishop:
				SpawnPiece(ChessBishop, *Row);
				break;
			case EChessType::Queen:
				SpawnPiece(ChessQueen, *Row);
				break;
			case EChessType::King:
				SpawnPiece(ChessKing, *Row);
				break;
			default:
				break;
			}
		}
	}
    
    void AChessboard::SpawnPiece(const TSubclassOf<class AChessPiece> piece, const FChessDataRow& Row)
{
	// piece가 유효한지 확인
	check(piece);

	AChessPiece* newPiece;
	// Piece 스폰 후 위치조정 및 변수 초기화를 해줌
	newPiece = GetWorld()->SpawnActor<AChessPiece>(piece, GetActorLocation() + Row.Location,
		FRotator::ZeroRotator);
	newPiece->SetOwner(this);
	newPiece->SetTeam(Row.Team);
	newPiece->SetType(Row.Type);

	// Array에 저장까지
	LocatingPiece(newPiece, Row.File, Row.Rank);
}
```

AChessPiece의 생성자를 따로 추가한 후에 SpawnActor 시에 Team과 Type을 정해주려 했는데 어째서인지 생성자가 제대로 작동하지 않는 상황을 겪었고 결국 Setter를 사용하는 쪽으로 방향을 바꾸었다.

각 체스피스들의 객체를 지정하기 위해 TSubClassOf 템플릿을 이용해 블루프린트에서 객체를 받아오도록 만들었다.

```cpp
// Chessboard.h


protected:
	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Object")
		TSubclassOf<class AChessPawn> ChessPawn;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Object")
		TSubclassOf<class AChessRook> ChessRook;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Object")
		TSubclassOf<class AChessKnight> ChessKnight;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Object")
		TSubclassOf<class AChessBishop> ChessBishop;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Object")
		TSubclassOf<class AChessQueen> ChessQueen;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Object")
		TSubclassOf<class AChessKing> ChessKing;
```

위와 같이 변수들은 잡아둔 다음 블루프린트에서 매칭시켜주었다.

![블루프린트에서 클래스 매칭](/assets/images/blog/uechess-3-datatable/bp-class-matching.png)

Array에 저장하는 LocatingPiece 함수의 경우 1차원 배열을 사용하고 있기 때문에 Rank값에 8을 곱해주는 방식을 사용했다.

```cpp
// Chessboard.cpp

void AChessboard::LocatingPiece(AChessPiece* TargetPiece, EChessFile FileDest, EChessRank RankDest)
{

	int targetLocation = static_cast<int>(FileDest)+ (static_cast<int>(RankDest) * 8);
	if (Pieces[targetLocation] != nullptr)
		Pieces[targetLocation]->Destroy();
	Pieces[targetLocation] = TargetPiece;
}
```

체스 흑팀과 백팀의 구분은 원래는 그에 맞는 BP를 모두 만들려 했는데 내부적으로 Team에 따라 머티리얼을 바꿔주는 것이 더 낫다고 판단해 Piece가 2개의 머티리얼을 갖도록 하여 구현할 예정이다.

어떤 방법이 더 나을지는 직접 해봐야 알 것 같다.
