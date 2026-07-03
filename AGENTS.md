# AGENTS.md

## 목적
- 작업용 최소 규칙만 둔다.
- 문서는 짧게 유지하고, 중복은 합친다.

## 프로젝트 개요
김주찬(Game Client Developer)의 **포트폴리오 + 기술 블로그** 사이트.
- 배포: GitHub Pages (User Page) — `https://skamo3.github.io`
- 스택: Jekyll 4.4 (Ruby 3.2), 순수 HTML/CSS 커스텀 (외부 테마 미사용)
- 목적: 이직/취업 지원 시 이력서·Notion 포트폴리오를 대체/보완하는 전용 웹사이트

## 콘텐츠 소스 오브 트루스
프로젝트/커리어 콘텐츠를 작성할 때는 원본 PDF를 매번 다시 파싱하지 말고 아래를 우선 참고한다:
- [`docs/content/profile-source.md`](docs/content/profile-source.md) — 이력서/포트폴리오/Notion에서 추출한 구조화 요약 (1차 소스)
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
Jekyll 커뮤니티 스타일 가이드([ben.balter.com/jekyll-style-guide](https://ben.balter.com/jekyll-style-guide/)) 기준. 이미 지키고 있는 것도 명시해 흔들리지 않게 고정한다.
- **include/layout 파일명**: lower-case-hyphenated.html (kebab-case) — 예 `project-card.html`. front matter 키는 snake_case (`type`, `category`, `period`, `order` 등)
- **permalink**: 트레일링 슬래시 스타일 유지 (`/projects/:path/`, `/blog/:year/:month/:day/:title/`). 단독 페이지를 새로 만들 때도 `foo/index.html` 대신 `foo.md` + `permalink: /foo/` 패턴을 우선한다
- **날짜**: `_posts` 파일명·front matter의 `date`는 ISO 8601(`YYYY-MM-DD`) 유지. `_projects`/`_data/timeline.yml`의 `period`는 이력서 표기(`2025.10 - 2026.01`)를 그대로 쓰는 자유 텍스트라 예외
- **`_config.yml`의 `defaults:`**로 collection별 공통 front matter(`layout` 등) 중복 지정을 피한다 — 이미 적용됨
- boolean 성격의 include 파라미터가 필요해지면 기본값이 true면 `no_*`, false면 `show_*`로 네이밍 (Jekyll 스타일 가이드 컨벤션)
- 새 include/layout/데이터 파일은 꼭 필요할 때만 만든다 — 기존 파일 확장으로 해결되면 그렇게 한다.
- 지시받은 범위 밖 파일은 건드리지 않는다.
- CSS는 새 색상을 하드코딩하지 않고 `assets/css/style.css`의 `:root` 변수(`--bg`, `--accent`, `--amber` 등)를 우선 재사용한다.
- 새 프로젝트 추가: `docs/content/profile-source.md`에 먼저 반영 → `_projects/<slug>.md`에 front matter(type/category/period/order/summary)와 본문 작성
- `type: company`(회사 재직 중 프로젝트) vs `type: personal`(개인/교육 프로그램 프로젝트)로 홈 화면에서 섹션이 분리되어 렌더링됨
- 카테고리는 반드시 `_data/categories.yml`에 정의된 키(`game-graphics`/`ai`/`embedded-cpp`/`web`) 중 하나 사용
- 이미지 자산: `assets/images/<project-slug>/` 하위에 저장, front matter `thumbnail`에 경로 지정 (현재 대부분 프로젝트는 썸네일 미정 상태 — "이미지 준비 중" 플레이스홀더로 표시됨)
- 실제로 존재하지 않는 외부 링크(Github repo, Youtube 영상 등)는 URL을 지어내지 말고 "(추후 교체 예정)" 같은 플레이스홀더 문구로 남긴다
- 커밋 메시지: 한글/영문 무관, 무엇을 왜 바꿨는지 간결하게

## 작업 방식
- 관련 파일만 읽는다. 필요한 부분만 읽고, 전체 덤프는 피한다.
- 변경 전 범위(어떤 파일을 왜 건드리는지)를 짧게 적는다.
- 애매하면 멈추고 사용자에게 확인한다.

### 커밋/푸시 정책
매 작업마다 `git push`하면 권한 확인·네트워크 왕복·토큰 사용 측면에서 오버헤드가 누적된다. 아래 방식을 기본으로 한다:
- **로컬 커밋은 자유롭게, 자주.** 의미 있는 작업 단위(파일 몇 개 완성 등)마다 `git commit`으로 체크포인트를 남긴다 — 로컬 커밋은 비용이 거의 없다.
- **`git push`는 사용자가 명시적으로 요청할 때만.** 여러 커밋을 모아뒀다가 한 번에 push한다. (Claude Code 자체 안전 정책상으로도 push처럼 외부에 반영되는 작업은 매번 확인받는 게 원칙이라, 이 방식이 정책과도 맞는다.)
- 세션이 끝나거나 눈에 보이는 결과물이 필요한 시점에 "지금까지 커밋 push해줘" 같은 요청이 오면, 쌓인 로컬 커밋을 한 번에 push한다.
- `git log`로 push 안 된 로컬 커밋이 몇 개 쌓여있는지 언제든 확인 가능 (`git log origin/main..HEAD`).

## 토큰 절감
- 짧게 쓴다. 결론부터 쓴다. 같은 정보를 두 번 적지 않는다.
- 불필요한 wrapper include, 중간 layout, 우회 단계를 만들지 않는다.
- 반복 설명 대신 문서 링크(`## 참고 문서`)로 대체한다.

## 참고 문서
문서는 `docs/` 하위에 카테고리별 폴더로 분리되어 있다. 전체 구조는 [`docs/README.md`](docs/README.md) 참고. **`docs/`는 로컬 전용이며 `.gitignore`로 원격(GitHub)에는 올라가지 않는다** — 새로 clone한 환경에는 없을 수 있음.
- [`docs/architecture/site-architecture.md`](docs/architecture/site-architecture.md) — 기술 결정 기록
- [`docs/architecture/tech-stack-alternatives.md`](docs/architecture/tech-stack-alternatives.md) — Jekyll vs React/Next.js/Astro 검토 및 결론(Jekyll 유지)
- [`docs/architecture/future-threejs.md`](docs/architecture/future-threejs.md) — 향후 Three.js 고급 버전 도입 시 방향
- [`docs/harness/harness-engineering-notes.md`](docs/harness/harness-engineering-notes.md) — 하네스 엔지니어링 개념 정리
- [`docs/design/design-reference-badarang.md`](docs/design/design-reference-badarang.md) — 커스텀 디자인 레퍼런스(badarang.netlify.app 실측 분석)
- [`docs/design/color-palette.md`](docs/design/color-palette.md) — 확정 컬러 팔레트(Neon Circuit, 다크/라이트) 및 결정 과정
- [`docs/dev/local-dev.md`](docs/dev/local-dev.md) — GitHub에 올리지 않고 로컬에서 확인하는 방법

## 피드백 루프 (실수 기록)
에이전트가 같은 실수를 반복하지 않도록, 작업 중 발견된 함정/실수는 아래에 기록한다.

- `preview_start`로 Jekyll을 띄울 때 `runtimeExecutable`이 `bundle.bat`를 직접 가리키면 Gemfile을 못 찾거나(cwd 문제) PATH에 Ruby bin이 없어 `jekyll: command not found`가 난다. `C:\workspace\Web\serve-skamo3.cmd`처럼 `cd /d`로 작업 디렉토리를 고정하고 `set PATH`로 Ruby bin을 명시적으로 주입하는 래퍼 스크립트를 거쳐야 한다.
- winget/gem으로 새 도구를 설치한 직후에는 같은 세션의 PATH 환경변수가 갱신되지 않을 수 있음 — `[System.Environment]::GetEnvironmentVariable("Path","Machine")`로 새로 읽어와야 인식된다.
- `git push`가 이유 없이 계속 타임아웃되면 credential.helper가 `manager`(GCM)로 설정돼 있어 GUI 팝업을 띄우며 멈춘 것일 수 있다. `gh auth setup-git`으로 gh CLI를 credential helper로 등록하면 해결됨 (이 세션에서 재현/해결함).
