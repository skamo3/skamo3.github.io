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
    load: () => import('./ch0-pipeline.js'),
  },

  // 아래는 커리큘럼 예고 (완성 시 status:'ready' + load 연결)
  { id: 'ch1', chapter: 'Ch1 · 지형과 표면',     title: '지형·풀·바람 (누적)',    status: 'soon' },
  { id: 'ch2', chapter: 'Ch2 · 빛과 재질',       title: 'PBR · 조명',            status: 'soon' },
  { id: 'ch3', chapter: 'Ch3 · 렌더링 아키텍처',  title: 'Deferred · G-buffer',   status: 'soon' },
  { id: 'ch4', chapter: 'Ch4 · 환경과 반사',      title: '물 · 반사 · 파티클',     status: 'soon' },
  { id: 'ch5', chapter: 'Ch5 · 후처리',          title: 'Tonemap · Bloom · AA',  status: 'soon' },
];
