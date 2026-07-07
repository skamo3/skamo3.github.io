---
title: "[Unity] Tilemap과 Tilepalette 만들기"
date: 2022-02-05
category: unity
---

Unity에 익숙해지기 위해
https://learn.unity.com/project/rubiyi-moheom-2d-cogeubjayong?uv=2020.3
이 강의를 따라가던 중 2D공간의 Tilemap을 만드는 파트가 나왔다.

해당 강의는 Unity 2018 버전으로 되어있어 그에 따른 차이점을 기록하기 위해 쓰는 글.

Tilemap은 Scene에서 각종 sprite들을 Tile의 형태로 변형시켜 배치할 수 있는 하나의 지도이다.

sprite의 종류에 따라 다양한 배경, 벽, 지형을 만들 수 있다.

2D 화면 상에서 사용되는 일종의 Tile 전용 도화지로 생각하면 편하다.

### Tilemap 생성하기

![2D Object 메뉴](/assets/images/blog/unity-tilemap-tilepalette/2d-object-menu.png)

본문에서는 **2D Object > Tilemap** 을 선택하라고 되어있지만

2020.03 버전에서는 조금 다르게 나온다.

![Tilemap 서브메뉴](/assets/images/blog/unity-tilemap-tilepalette/tilemap-submenu.png)

위 그림과 같이 Tilemap이 하나의 폴더형태가 되어있고 그 안의 Rectangular를 눌러주어야 한다.

Tilemap을 생성하려면 **2D Object > Tilemap > Rectangular** 순서로 클릭해주면 된다 그러면 아래와 같은 결과로 Tilemap이 생성된다

![생성된 Tilemap](/assets/images/blog/unity-tilemap-tilepalette/tilemap-created.png)

### Tile 생성하기

Tilemap이 만들어 졌다면 Tilemap을 채우기위한 Tile들을 만들어 줘야 한다.

튜토리얼에서는 **Create > Tile** 의 순서로 만들라고 되어있지만 2020버전에서는 나오지 않는다.

우선 해당 튜토리얼에서 제공하는 Ruby.png 파일을 Sprite 디렉토리에 저장하자. 또는 사용할 파일 아무거나 끌어다가 넣으면 된다.

Tile을 편하게 만들기 위해 Tile Palette 먼저 생성하자

**Window > 2D > TilePalette** 로 이동하면 Tile Palette 창이 열린다.

![Tile Palette 창](/assets/images/blog/unity-tilemap-tilepalette/tile-palette-window.png)

이 전에 새로운 팔레트를 만든 것이 아니라면 빈 창이 나올것이다.

**Create New Palette**를 찾아 눌러주자 Name에 원하는 이름을 넣어준 후 Create를 클릭해준다.

폴더를 선택하라는 창이 뜨는데 나는 **Assets > Art > Tiles** 라는 폴더를 만들어 넣어줬다.

생성된 TilePalette에 아까 임포트 해둔 Tile.png 파일을 끌어다 넣어주자.

그럼 에셋을 저장하라는 창이 뜨고 이를 저장하면 성공적으로 TilePalette에 Tile이 등록되고 Tiles 폴더에는 Tile이라는 이름으로 하나의 tile이 저장됐다.

![Tile Palette에 Tile 등록하는 과정](/assets/images/blog/unity-tilemap-tilepalette/tilepalette-demo.gif)

### Tilemap에 Tile 배치하기

Tile Palette에서 Tile을 선택한 후 Tilemap에 배치해보자.

![이상하게 배치된 타일](/assets/images/blog/unity-tilemap-tilepalette/tile-placed-odd.png)

뭔가 이상하게 나온다...

Hierarchy 창에서 Grid를 선택해보면 Inspector에서 Cell Size의 x,y가 1로 되어있다.

![Grid Cell Size 설정](/assets/images/blog/unity-tilemap-tilepalette/grid-cell-size.png)

이에 따라 Tile Sprite도 바꿔줘야 한다.

Tile Sprite를 클릭해보면 아래와 같을 것이다.

![Tile Sprite 설정](/assets/images/blog/unity-tilemap-tilepalette/tile-sprite-settings.png)

**Pixels Per Unit**을 보면 100으로 되어있는데 이는 유니티에서 1유닛당 픽셀을 얼마나 넣을지 정의해 스프라이트의 크기를 가늠하도록 해주는 변수이다. 이 경우 유닛당 100픽셀을 차지하는 것이다.

현재 Sprite는 64 x 64의 크기이기에 100 x 100에 맞추다 보니 빈 공간이 생기는 것이다.

![스프라이트 빈 공간](/assets/images/blog/unity-tilemap-tilepalette/sprite-gap.png)

**Pixels Per Unit**을 64로 변경하면 각 픽셀에 맞도록 Sprite가 조정된다

![Pixels Per Unit 수정 후](/assets/images/blog/unity-tilemap-tilepalette/pixels-per-unit-fixed.png)

유니티 버전에 따라 생성하는 방법이 조금씩 달라지니 잘 참고해서 만들자
