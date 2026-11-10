// 공통 하네스: 렌더러 · 리사이즈 · 렌더 루프 · 월드 교체 라이프사이클.
// 각 챕터 월드는 이 하네스 위에 얹히기만 하면 된다 (반복 세팅을 여기서 흡수).
import * as THREE from 'three';

// 월드 모듈 계약:
//   export default { async create({ renderer, canvas }) => ({ scene, camera, update(dt), dispose() }) }
//
// 렌더러 종류: mount(module, { renderer: 'webgl' | 'webgpu' }). 기본은 'webgl'.
// 캔버스 하나는 webgl2 컨텍스트를 한 번 잡으면 webgpu로 바꿀 수 없다(반대도 마찬가지).
// 그래서 종류가 바뀔 때마다 <canvas>를 새로 만들어 교체하고 이전 렌더러는 버린다.
// 'webgpu' 월드는 three/webgpu 빌드(코어 자체 포함)를 쓰므로 필요할 때만 동적으로 불러온다.
export function createHarness(initialCanvas) {
  let canvas = initialCanvas;
  let renderer = null;
  let kind = null;                 // 현재 렌더러 종류
  let canvasUsed = false;          // 이 캔버스에 컨텍스트가 이미 잡혔는지
  let current = null;              // 현재 마운트된 월드 인스턴스
  let mountGen = 0;                // 늦게 끝난 이전 mount가 새 월드를 덮어쓰지 않게
  let queue = Promise.resolve();   // mount를 순서대로 처리 (렌더러 교체가 겹치지 않게)
  const clock = new THREE.Clock();

  function resize() {
    if (!renderer) return;
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

  function disposeRenderer() {
    if (!renderer) return;
    renderer.dispose();
    if (renderer.isWebGLRenderer) renderer.forceContextLoss();
    renderer = null;
    kind = null;
  }

  async function ensureRenderer(want) {
    if (renderer && kind === want) return;
    disposeRenderer();
    if (canvasUsed) {
      // 같은 id/class를 가진 빈 캔버스로 갈아끼운다 (CSS #gl 그대로 적용)
      const fresh = canvas.cloneNode(false);
      canvas.replaceWith(fresh);
      canvas = fresh;
    }
    canvasUsed = true;

    let r;
    if (want === 'webgpu') {
      const { WebGPURenderer } = await import('three/webgpu');
      // trackTimestamp: GPU 타임스탬프 쿼리로 패스별 ms를 잰다 (지원 안 하는 기기에서는 three가 알아서 끈다).
      // 켜 두면 월드가 renderer.resolveTimestampsAsync()로 매 프레임 비워 줘야 쿼리 풀이 넘치지 않는다
      r = new WebGPURenderer({ canvas, antialias: true, trackTimestamp: true });
      await r.init();              // 어댑터/디바이스 획득. WebGPU가 없으면 WebGL2 백엔드로 폴백
    } else {
      r = new THREE.WebGLRenderer({ canvas, antialias: true });
    }
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer = r;
    kind = want;
  }

  async function doMount(worldModule, opts, gen) {
    if (gen !== mountGen) return null;           // 이미 다른 월드로 넘어감
    await ensureRenderer((opts && opts.renderer) || 'webgl');
    if (gen !== mountGen) return null;
    const world = await worldModule.create({ renderer, canvas });
    if (gen !== mountGen) { if (world && world.dispose) world.dispose(); return null; }
    current = world;
    resize();
    return current;
  }

  function mount(worldModule, opts) {
    const gen = ++mountGen;
    unmount();
    const p = queue.then(() => doMount(worldModule, opts, gen));
    queue = p.catch(() => {});
    return p;
  }

  function unmount() {
    if (current && current.dispose) current.dispose();
    current = null;
  }

  function loop() {
    requestAnimationFrame(loop);
    const dt = clock.getDelta();
    if (!current || !renderer) return;
    if (current.update) current.update(dt);
    if (current.scene && current.camera) renderer.render(current.scene, current.camera);
  }
  loop();

  return {
    get renderer() { return renderer; },
    get canvas() { return canvas; },
    mount, unmount, resize,
  };
}
