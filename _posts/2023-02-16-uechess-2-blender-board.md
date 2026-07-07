---
title: "[UEChess] 언리얼, 블렌더를 이용한 3D체스 만들기 2. 블렌더를 이용해 체스 보드 만들기"
date: 2023-02-16
category: game-dev
---

> ⊙ 이 글은 튜토리얼이나 완벽한 작업물을 기록하는 글이 아닌 스스로의 작업 진행을 기록하기 위한 글이므로 더 나은 방법 더 효율적인 방법이 있을 수 있습니다.

다른 작업을 시작하기 전에 에디터에서 기준을 잡아줄 체스보드를 제작하기로 했다.

각 체스 말들을 스폰하기에 앞서 스폰한 후에 어디에 위치 시킬지, 각 말들은 어느 정도의 크기로 얼마 만큼의 간격을 가질 것인지 알기 위해 만들었다.

## 블렌더에서 체스보드 만들기

우선 블렌더 중앙을 기준으로 Plane을 하나 만들어주고 크기를 잡아준다.

![Plane 크기 설정](/assets/images/blog/uechess-2-blender-board/plane-sizing.png)

각 타일의 크기는 위와 같게 맞추었다. 1m로 하면 너무 작아질까 하여 한 칸당 1.5m로 잡아주었다. 일반적인 체스 말들을 사용한다면 1m도 충분하겠지만 나중에 애니메이션이 들어간 캐릭터를 사용한다면 다양한 액션을 취하기에 적당할 것으로 판단했다.

Editor 모드에서 Extrude Region을 이용해 Plane을 박스로 만들어주고 Inset Faces를 이용해 안쪽으로 각을 좁혀주었다. 그 다음 Knife모드를 이용해 스냅 기능을 켠 채로 절반씩 나누어 총 8칸을 구분지어 주었다.

![8x8 체스판](/assets/images/blog/uechess-2-blender-board/board-8x8.png)

그러면 위와 같이 8 * 8의 체스판이 만들어진다.

그 다음 UV Editing에서 각 모서리들을 모두 선택 후 Mark Seam을 선택해 모두 마킹해주었다. 그리고 UV를 펼쳐 아래와 같이 UV 맵을 생성.

![UV 맵](/assets/images/blog/uechess-2-blender-board/uv-map.png)

모두 나눈 이유는 상황에 따라 각 면마다 다른 머티리얼을 적용하고 싶어질 수도 있을 것 같아 미리 나누어 버렸다.

그 다음 색을 구분짓기 위해 Shading 탭에서 아래와 같이 3개의 머티리얼 구조로 나누어 주었다

![블렌더 머티리얼 슬롯 3개](/assets/images/blog/uechess-2-blender-board/material-slots-blender.png)

그런 다음 언리얼엔진에 임포트 해주기 위해 fbx 파일로 export 해주었다.

## 블렌더에서 추출한 파일 언리얼 엔진으로 적용 하고 퀵셀콘텐츠로 머티리얼 적용하기

언리얼 엔진에서 Import를 누른 후 생성한 fbx 파일을 가져오면 아래와 같은 창이 뜬다.

![FBX Import 옵션 창](/assets/images/blog/uechess-2-blender-board/import-dialog.png)

메시 고급 옵션에서 **메시 결합을 true**로 해주고

![메시 결합 옵션](/assets/images/blog/uechess-2-blender-board/combine-mesh-option.png)

머티리얼도 블렌더에서 가져온 것이 아닌 언리얼 엔진의 퀵셀콘텐츠에서 다운받아 사용할 것이므로 Do Not Create Material로 옵션을 변경해준다

![Do Not Create Material 옵션](/assets/images/blog/uechess-2-blender-board/do-not-create-material.png)

그 다음 임포트 해주면 끝.

스태틱 메시를 켜주고 디테일 창을 확인해보면 아래와 같이 머티리얼 슬롯이 생성된 것을 확인할 수 있다.

![디테일 창의 머티리얼 슬롯](/assets/images/blog/uechess-2-blender-board/material-slots-detail.png)

나는 클래식한 보드판을 연출하고 싶어서 나무 모양으로 겉 부분을 칠한 후 안쪽은 나무 재질의 하얀색과 까만색 머티리얼을 찾아 칠해주었다.

![완성된 체스보드](/assets/images/blog/uechess-2-blender-board/final-board.png)

그 후 각 머티리얼들의 속성을 만져 이런 식으로 간단한 체스보드 만들기를 완성했다.

블렌더에서 모델링 후 언리얼 퀵셀콘텐츠로 적용하는 방법은 [해당 유튜브](https://www.youtube.com/@blacktailz6522)를 참고하였다. 퀵셀콘텐츠를 진짜 잘 활용하는 영상들이 많아 참고하기도 좋고 분위기도 잔잔해 보기도 좋다!
