# AGENTS.md

## 프로젝트 개요
김주찬(Game Client Developer)의 **포트폴리오 + 기술 블로그** 사이트.
- 배포: GitHub Pages (User Page) — `https://skamo3.github.io`
- 스택: Jekyll (아직 스캐폴딩 전, 다음 단계에서 진행)
- 목적: 이직/취업 지원 시 이력서·Notion 포트폴리오를 대체/보완하는 전용 웹사이트

## 콘텐츠 소스 오브 트루스
프로젝트/커리어 콘텐츠를 작성할 때는 원본 PDF를 매번 다시 파싱하지 말고 아래를 우선 참고한다:
- [`docs/profile-source.md`](docs/profile-source.md) — 이력서/포트폴리오/Notion에서 추출한 구조화 요약 (1차 소스)
- 원본: `C:\workspace\취업준비\김주찬_이력서.pdf`, `C:\workspace\취업준비\김주찬_포트폴리오.pdf`
- Notion: https://free-grin-2e0.notion.site/portfolio (카드 레이아웃, 썸네일 등 디자인 레퍼런스)

## 디렉토리 구조
Jekyll 스캐폴딩 전이므로 현재는 다음만 존재:
- `AGENTS.md` — 이 문서
- `docs/` — 하네스 지식 저장소 (아래 참고)

Jekyll 스캐폴딩 이후 `_config.yml`, `_layouts`, `_includes`, `_projects`, `_posts`, `assets` 등이 추가되면 이 섹션을 갱신한다.

## 빌드/검증 명령
TBD — Jekyll 스캐폴딩 시 채움 (`bundle exec jekyll serve`, `bundle exec jekyll build` 등)

## 컨벤션
- 새 프로젝트 카드 추가: `docs/profile-source.md`의 프로젝트 목록에 먼저 반영 후 사이트 콘텐츠에 반영
- 이미지 자산: `assets/images/<project-slug>/` 하위에 저장 (스캐폴딩 시 확정)
- 커밋 메시지: 한글/영문 무관, 무엇을 왜 바꿨는지 간결하게

## 참고 문서
- [`docs/site-architecture.md`](docs/site-architecture.md) — 기술 결정 기록
- [`docs/harness-engineering-notes.md`](docs/harness-engineering-notes.md) — 하네스 엔지니어링 개념 정리

## 피드백 루프 (실수 기록)
에이전트가 같은 실수를 반복하지 않도록, 작업 중 발견된 함정/실수는 아래에 기록한다.

- (아직 없음)
