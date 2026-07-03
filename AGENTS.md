# AGENTS.md

## 프로젝트 개요
김주찬(Game Client Developer)의 **포트폴리오 + 기술 블로그** 사이트.
- 배포: GitHub Pages (User Page) — `https://skamo3.github.io`
- 스택: Jekyll 4.4 (Ruby 3.2), 순수 HTML/CSS 커스텀 (외부 테마 미사용)
- 목적: 이직/취업 지원 시 이력서·Notion 포트폴리오를 대체/보완하는 전용 웹사이트

## 콘텐츠 소스 오브 트루스
프로젝트/커리어 콘텐츠를 작성할 때는 원본 PDF를 매번 다시 파싱하지 말고 아래를 우선 참고한다:
- [`docs/profile-source.md`](docs/profile-source.md) — 이력서/포트폴리오/Notion에서 추출한 구조화 요약 (1차 소스)
- 원본: `C:\workspace\취업준비\김주찬_이력서.pdf`, `C:\workspace\취업준비\김주찬_포트폴리오.pdf`
- Notion: https://free-grin-2e0.notion.site/portfolio (카드 레이아웃, 썸네일 등 디자인 레퍼런스)

## 디렉토리 구조
- `_config.yml` — Jekyll 설정, `projects` collection 정의
- `_data/categories.yml` — 프로젝트 카테고리(게임&그래픽/인공지능/임베디드&CPP/웹프로그래밍) 라벨+색상
- `_data/skills.yml`, `_data/skills_text.yml` — 기술 스택(아이콘 있는 것/텍스트 뱃지)
- `_data/timeline.yml` — 홈 커리어 타임라인 항목
- `_layouts/` — `default.html`(공통), `post.html`(블로그 글), `project.html`(프로젝트 상세)
- `_includes/` — `head.html`, `nav.html`, `footer.html`, `project-card.html`(프로젝트 카드 컴포넌트)
- `_projects/` — 프로젝트 collection. front matter로 `type: company|personal`, `category: <categories.yml 키>`, `period`, `order`, `summary`, `thumbnail`(선택) 관리
- `_posts/` — 블로그 글 (Jekyll 표준 `YYYY-MM-DD-title.md`)
- `assets/css/style.css` — 전체 스타일 (다크 네이비 + 시안/앰버 포인트, Poppins/Noto Sans KR)
- `index.html` — 홈(Hero → About → Skillset → Timeline → Projects(회사/개인·교육 분리) → Blog 미리보기 → Contact)
- `blog/index.html` — 블로그 목록

## 빌드/검증 명령
로컬 Ruby(3.2, `C:\Ruby32-x64`)에 Jekyll 설치되어 있음.
```
bundle install          # 최초 1회 / Gemfile 변경 시
bundle exec jekyll build   # 정적 빌드 (_site/ 생성)
bundle exec jekyll serve   # 로컬 서버 (http://127.0.0.1:4000)
```
Claude Code에서 미리보기 시: `C:\workspace\Web\.claude\launch.json`의 `jekyll-skamo3` 설정으로 `preview_start` 사용 (내부적으로 `C:\workspace\Web\serve-skamo3.cmd` 실행, PATH에 Ruby bin 경로 주입).

## 컨벤션
- 새 프로젝트 추가: `docs/profile-source.md`에 먼저 반영 → `_projects/<slug>.md`에 front matter(type/category/period/order/summary)와 본문 작성
- `type: company`(회사 재직 중 프로젝트) vs `type: personal`(개인/교육 프로그램 프로젝트)로 홈 화면에서 섹션이 분리되어 렌더링됨
- 카테고리는 반드시 `_data/categories.yml`에 정의된 키(`game-graphics`/`ai`/`embedded-cpp`/`web`) 중 하나 사용
- 이미지 자산: `assets/images/<project-slug>/` 하위에 저장, front matter `thumbnail`에 경로 지정 (현재 대부분 프로젝트는 썸네일 미정 상태 — "이미지 준비 중" 플레이스홀더로 표시됨)
- 실제로 존재하지 않는 외부 링크(Github repo, Youtube 영상 등)는 URL을 지어내지 말고 "(추후 교체 예정)" 같은 플레이스홀더 문구로 남긴다
- 커밋 메시지: 한글/영문 무관, 무엇을 왜 바꿨는지 간결하게

## 참고 문서
- [`docs/site-architecture.md`](docs/site-architecture.md) — 기술 결정 기록
- [`docs/harness-engineering-notes.md`](docs/harness-engineering-notes.md) — 하네스 엔지니어링 개념 정리
- [`docs/design-reference-badarang.md`](docs/design-reference-badarang.md) — 커스텀 디자인 레퍼런스(badarang.netlify.app 실측 분석)
- [`docs/local-dev.md`](docs/local-dev.md) — GitHub에 올리지 않고 로컬에서 확인하는 방법
- [`docs/tech-stack-alternatives.md`](docs/tech-stack-alternatives.md) — Jekyll vs React/Next.js/Astro 검토 및 결론(Jekyll 유지)

## 피드백 루프 (실수 기록)
에이전트가 같은 실수를 반복하지 않도록, 작업 중 발견된 함정/실수는 아래에 기록한다.

- `preview_start`로 Jekyll을 띄울 때 `runtimeExecutable`이 `bundle.bat`를 직접 가리키면 Gemfile을 못 찾거나(cwd 문제) PATH에 Ruby bin이 없어 `jekyll: command not found`가 난다. `C:\workspace\Web\serve-skamo3.cmd`처럼 `cd /d`로 작업 디렉토리를 고정하고 `set PATH`로 Ruby bin을 명시적으로 주입하는 래퍼 스크립트를 거쳐야 한다.
- winget/gem으로 새 도구를 설치한 직후에는 같은 세션의 PATH 환경변수가 갱신되지 않을 수 있음 — `[System.Environment]::GetEnvironmentVariable("Path","Machine")`로 새로 읽어와야 인식된다.
