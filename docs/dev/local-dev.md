# 로컬 개발/테스트 방법 (GitHub에 올리지 않고 확인)

## 준비물 (이미 설치됨)
- Ruby 3.2 (`C:\Ruby32-x64`), Jekyll 4.4, Bundler — 이 프로젝트 세팅 중 winget/gem으로 설치 완료

## 방법 1: Claude Code Preview 도구로 실행 (추천)
`C:\workspace\Web\.claude\launch.json`에 `jekyll-skamo3` 설정이 이미 등록되어 있음.
Claude Code 세션에서 `preview_start`(name: `jekyll-skamo3`)를 호출하면 자동으로 아래 방법 2와 동일하게 서버가 뜨고, 화면 확인/스크린샷/콘솔로그 확인까지 가능.

## 방법 2: 터미널에서 직접 실행
```
C:\workspace\Web\serve-skamo3.cmd
```
더블클릭하거나 명령 프롬프트에서 실행하면 `http://127.0.0.1:4000` 에서 로컬 서버가 뜬다. `--watch`가 기본 활성화되어 있어 파일을 수정하면 자동으로 다시 빌드된다 (`Ctrl+C`로 종료).

수동으로 옵션을 조정하고 싶으면:
```
cd C:\workspace\Web\skamo3
set PATH=C:\Ruby32-x64\bin;%PATH%
bundle exec jekyll serve
```

## 방법 3: 빌드만 (배포 전 최종 확인용)
```
cd C:\workspace\Web\skamo3
set PATH=C:\Ruby32-x64\bin;%PATH%
bundle exec jekyll build
```
`_site/` 폴더에 실제 배포될 정적 파일이 생성된다 (`.gitignore`에 포함되어 있어 커밋되지 않음). GitHub Actions(`​.github/workflows/pages.yml`)도 내부적으로 동일한 `jekyll build`를 실행한다.

## 주의
- `serve-skamo3.cmd`는 이 로컬 머신(Windows, Ruby 경로 `C:\Ruby32-x64`)에 맞춰진 스크립트라 저장소 밖(`C:\workspace\Web\`)에 둠 — 커밋 대상 아님
- 로컬 서버는 `git push` 없이도 실시간으로 화면 확인 가능. 실제 `skamo3.github.io`에 반영하려면 커밋 후 push 필요 (GitHub Actions가 자동 빌드/배포)
