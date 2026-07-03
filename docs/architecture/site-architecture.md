# 사이트 아키텍처 결정 기록

## 확정 사항
- **호스팅**: GitHub Pages, User Page 방식 → 원격 저장소 이름은 `skamo3.github.io` 고정, `https://skamo3.github.io`로 서비스
- **생성기**: Jekyll (GitHub Pages 네이티브 지원, 별도 빌드 파이프라인 불필요)
- **사이트 성격**: 포트폴리오 전용이 아닌 **포트폴리오 + 기술 블로그 병행**
  - 포트폴리오: 프로젝트 쇼케이스 중심, Notion 포트폴리오의 카드형 레이아웃/카테고리 구조를 참고
  - 블로그: 엔진 개발기, 렌더링 최적화 등 기술 글 정기 게시 (Jekyll의 `_posts` 활용)

## 콘텐츠 구조 방향성
Notion의 4개 카테고리를 Jekyll collection으로 매핑 예정:
- `_projects` collection 하위에 category front matter(게임&그래픽 / 인공지능 / 임베디드&CPP / 웹프로그래밍)로 구분
- 프로젝트 상세 데이터는 [`profile-source.md`](../content/profile-source.md) 를 소스로 사용

## 디자인 레퍼런스
커스텀 디자인 진행 시 [`design-reference-badarang.md`](../design/design-reference-badarang.md) (badarang.netlify.app 실측 분석: 구조/폰트/색상) 를 우선 참고한다. Three.js 도입을 고려할 경우 [`future-threejs.md`](future-threejs.md) 참고.

## 미확정 사항 (다음 단계에서 결정)
- Jekyll 테마 (후보: Minimal Mistakes / Chirpy / So Simple·TeXt / 커스텀) — AGENTS.md 및 다음 단계 대화에서 데모 비교 후 확정
- 홈페이지 레이아웃 (Notion 카드 UI를 얼마나 재현할지)
- 이미지/영상 자산 처리 방식 (프로젝트 썸네일, 유튜브 임베드 등)
- 커스텀 도메인 사용 여부
