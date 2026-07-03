# 향후 계획: Three.js 고급 버전

콘텐츠(프로젝트 상세/썸네일 등)가 다 채워진 뒤, "고급 버전"으로 Three.js를 활용해 더 있어 보이게 만드는 것을 고려 중. 이 문서는 그 방향을 염두에 뒀을 때 지금의 Jekyll 베이스를 어떻게 잡아야 하는지 정리한다.

## 결론: 지금 베이스를 바꿀 필요 없음
Three.js는 순수 JS 라이브러리(WebGL 래퍼)라서 **Jekyll이 만든 정적 HTML 위에 그대로 얹을 수 있다.** React/Next로 미리 전환해둘 필요가 없다 — [`tech-stack-alternatives.md`](tech-stack-alternatives.md)에서 정리했듯 Jekyll 산출물은 순수 HTML이고, 그 안에 `<canvas>` + `<script type="module">`로 Three.js 씬을 추가하는 데 아무 제약이 없다.

## 적용 방식 (나중에 실제로 붙일 때)
1. **CDN 로드**: `<script type="module" src="https://cdn.jsdelivr.net/npm/three@.../build/three.module.js">` 형태로 별도 빌드 도구 없이 바로 시작 가능
2. **또는 자체 번들**: 씬이 복잡해지면(여러 모듈, 셰이더 파일 등) `assets/js/`에 소스를 두고 esbuild/Vite로 **JS 파일만** 번들링 → 결과물을 Jekyll이 그대로 서빙. Jekyll 템플릿/빌드 파이프라인은 안 건드림
3. **범위를 좁게**: 사이트 전체를 Three.js로 다시 만드는 게 아니라, Hero 섹션 배경이나 프로젝트 상세 페이지의 특정 데모(예: Ray Tracing/렌더링 결과물을 인터랙티브 3D로 보여주기) 등 **일부 섹션에만 적용**하는 progressive enhancement 방식 추천 — badarang.netlify.app도 이런 식으로 Hero/Contact 섹션에만 3D 일러스트를 넣었음([`design-reference-badarang.md`](../design/design-reference-badarang.md) 참고)

## 언제 프레임워크 전환을 고려할 만한가
- Three.js 씬이 여러 개고 상태 관리(카메라 전환, UI 연동 등)가 복잡해질 때 → React Three Fiber 같은 조합이 편해짐. 이때는 해당 페이지만 별도 React 앱으로 빌드해서 iframe/개별 정적 페이지로 넣는 것도 가능(사이트 전체를 마이그레이션할 필요 없음)
- 지금 단계에서는 오버엔지니어링이므로 보류

## 액션 아이템 (지금은 하지 않음)
- [ ] 프로젝트 콘텐츠(본문/썸네일) 완성
- [ ] Hero 섹션에 넣을 3D 컨셉 정하기 (예: 엔진 렌더링 결과물을 회전시키는 모델 뷰어, 파티클 효과 등)
- [ ] Three.js CDN 버전으로 프로토타입 → 성능/모바일 확인 후 정식 적용
