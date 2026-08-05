// 월드 레지스트리: 사이드바 항목 + 각 월드 모듈 로더.
// 새 개념을 완성할 때마다 여기 항목을 ready로 바꾸고 load를 연결한다.
export const registry = [
  {
    id: 'ch0',
    chapter: 'Ch0 · 프레임이 그려지는 원리',
    title: '삼각형 → 큐브',
    status: 'ready',
    file: 'worlds/ch0-pipeline.js',
    lesson: 'chapters/ch0-pipeline.lesson.md',
    posts: [{ title: '렌더링 파이프라인 기초', url: '/blog/2026/07/27/rendering-pipeline-basics/' }],
    load: () => import('./ch0-pipeline.js'),
  },

  {
    id: 'ch1',
    chapter: 'Ch1 · 지형과 표면',
    title: '지형 + 풀 (누적)',
    status: 'ready',
    file: 'worlds/ch1-terrain.js',
    lesson: 'chapters/ch1-terrain.lesson.md',
    posts: [
      { title: '지형 + 풀 만들기', url: '/blog/2026/07/30/terrain-grass-instancing/' },
      { title: '바람 (정점 셰이더)', url: '/blog/2026/07/30/vertex-shader-wind/' },
    ],
    load: () => import('./ch1-terrain.js'),
  },

  {
    id: 'ch2',
    chapter: 'Ch2 · 빛과 재질',
    title: '개념1 · 기본 조명 + 법선 보정',
    status: 'ready',
    file: 'worlds/ch2-lighting.js',
    lesson: 'chapters/ch2-lighting.lesson.md',
    posts: [{ title: '법선 벡터가 조명 계산에 왜 필요한가', url: '/blog/2026/08/03/normal-vector-lighting/' }],
    load: () => import('./ch2-lighting.js'),
  },

  {
    id: 'ch2-pbr',
    chapter: 'Ch2 · 빛과 재질',
    title: '개념2 · 쉐이딩 모델 비교(Lambert·Phong·PBR)',
    status: 'ready',
    file: 'worlds/ch2-pbr.js',
    lesson: 'chapters/ch2-pbr.lesson.md',
    posts: [{ title: 'Light Shader 모델의 발전과 PBR', url: '/blog/2026/08/05/lambert-phong-pbr-shading-models/' }],
    load: () => import('./ch2-pbr.js'),
  },

  // 아래는 커리큘럼 예고 (완성 시 status:'ready' + load 연결)
  { id: 'ch3', chapter: 'Ch3 · 렌더링 아키텍처',  title: 'Deferred · G-buffer',   status: 'soon' },
  { id: 'ch4', chapter: 'Ch4 · 환경과 반사',      title: '물 · 반사 · 파티클',     status: 'soon' },
  { id: 'ch5', chapter: 'Ch5 · 후처리',          title: 'Tonemap · Bloom · AA',  status: 'soon' },
];
