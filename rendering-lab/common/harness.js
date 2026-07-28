// 공통 하네스: 렌더러 · 리사이즈 · 렌더 루프 · 월드 교체 라이프사이클.
// 각 챕터 월드는 이 하네스 위에 얹히기만 하면 된다 (반복 세팅을 여기서 흡수).
import * as THREE from 'three';

// 월드 모듈 계약:
//   export default { async create({ renderer, canvas }) => ({ scene, camera, update(dt), dispose() }) }
export function createHarness(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  let current = null;              // 현재 마운트된 월드 인스턴스
  const clock = new THREE.Clock();

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false); // false = CSS 크기는 건드리지 않음
    const cam = current && current.camera;
    if (cam && cam.isPerspectiveCamera) {
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    }
  }
  window.addEventListener('resize', resize);

  async function mount(worldModule) {
    unmount();
    current = await worldModule.create({ renderer, canvas });
    resize();
    return current;
  }

  function unmount() {
    if (current && current.dispose) current.dispose();
    current = null;
  }

  function loop() {
    requestAnimationFrame(loop);
    const dt = clock.getDelta();
    if (!current) return;
    if (current.update) current.update(dt);
    if (current.scene && current.camera) renderer.render(current.scene, current.camera);
  }
  loop();

  return { renderer, mount, unmount, resize };
}
