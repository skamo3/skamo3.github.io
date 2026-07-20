import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const TIERS = [
  { base: '#d0a455', light: '#f0d68a', dark: '#a87f3d', rim: '#8a6a34', rimHi: '#f7e6ab', engrave: '5a4426', emboss: 'f5e8c0', glint: [1.0, 0.96, 0.82] },
  { base: '#b8bec7', light: '#e6ebf0', dark: '#8d949e', rim: '#767d87', rimHi: '#f0f4f8', engrave: '43484f', emboss: 'eef2f6', glint: [0.95, 0.98, 1.0] },
  { base: '#b0703c', light: '#d99a66', dark: '#8a5628', rim: '#74491f', rimHi: '#e8b184', engrave: '46290f', emboss: 'ecc9a3', glint: [1.0, 0.87, 0.72] },
];
const SPACING = 2.3;
const Y_BASE = 0.45;
const FLOOR_Y = -0.62; // 반사를 코인에 조금 더 붙여 리본이 들어갈 여백을 남김

async function logoImage(slug, color) {
  const res = await fetch(`https://cdn.simpleicons.org/${slug}/${color}`);
  let svg = await res.text();
  if (!/\swidth=/.test(svg)) svg = svg.replace('<svg ', '<svg width="512" height="512" ');
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const img = new Image();
  await new Promise((ok, err) => { img.onload = ok; img.onerror = err; img.src = url; });
  URL.revokeObjectURL(url);
  return img;
}

function starTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,243,205,1)');
  grad.addColorStop(0.3, 'rgba(255,225,160,0.55)');
  grad.addColorStop(1, 'rgba(255,225,160,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(255,248,225,0.95)';
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(32, 6); g.lineTo(32, 58);
  g.moveTo(6, 32); g.lineTo(58, 32);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function ribbonTexture(text, borderColor) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(13, 17, 23, 0.88)';
  g.strokeStyle = borderColor;
  g.lineWidth = 5;
  g.beginPath();
  g.roundRect(6, 14, 500, 100, 18);
  g.fill(); g.stroke();
  g.fillStyle = '#f0f4f8';
  g.font = '600 42px Poppins, "Noto Sans KR", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function reedingTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 32;
  const g = c.getContext('2d');
  for (let x = 0; x < 512; x += 4) {
    g.fillStyle = (x / 4) % 2 ? '#ffffff' : '#555555';
    g.fillRect(x, 0, 4, 32);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

// content = {type:'image', darkImg, lightImg} 또는 {type:'text', abbr}
function coinFaceTexture(tier, content) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(256, 236, 40, 256, 256, 260);
  grad.addColorStop(0, tier.light);
  grad.addColorStop(0.72, tier.base);
  grad.addColorStop(1, tier.dark);
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  g.lineWidth = 16;
  g.strokeStyle = tier.rim;
  g.beginPath(); g.arc(256, 256, 234, 0, 7); g.stroke();
  g.lineWidth = 3;
  g.strokeStyle = tier.rimHi;
  g.beginPath(); g.arc(256, 256, 218, 0, 7); g.stroke();
  if (content.type === 'image') {
    const s = 268, o = (512 - s) / 2;
    g.globalAlpha = 0.6; g.drawImage(content.lightImg, o + 4, o + 5, s, s);
    g.globalAlpha = 0.95; g.drawImage(content.darkImg, o, o, s, s);
    g.globalAlpha = 1;
  } else {
    const size = content.abbr.length > 4 ? 68 : 88;
    g.font = `700 ${size}px Poppins, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#' + tier.emboss;
    g.fillText(content.abbr, 256 + 4, 256 + 5);
    g.fillStyle = '#' + tier.engrave;
    g.fillText(content.abbr, 256, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeScene(canvasId) {
  const canvas = document.getElementById(canvasId);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 50);
  camera.position.set(0, -0.25, 7); // 리본을 올린 만큼 코인+반사가 프레임 중앙에 오도록 재조정
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  addEventListener('resize', resize);
  return { canvas, renderer, scene, camera };
}

const updaters = [];
let now = 0;
const X_AXIS = new THREE.Vector3(1, 0, 0), Y_AXIS = new THREE.Vector3(0, 1, 0);
const qTmp = new THREE.Quaternion(), qWind = new THREE.Quaternion(), qAuto = new THREE.Quaternion(), eAuto = new THREE.Euler();
const DRAG_K = 0.015;
const vert = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const glintFrag = `
  uniform float uTime; uniform vec3 uTint; varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    if (length(p) > 0.485) discard;
    float pos = fract(uTime * 0.28) * 2.6 - 1.3;
    float band = smoothstep(0.16, 0.0, abs(dot(p, vec2(0.7071)) - pos));
    gl_FragColor = vec4(uTint * band, band * 0.6);
  }`;

async function buildCoinRow(canvasId, tierIdx, items) {
  if (!items.length) return;
  const tier = TIERS[tierIdx];
  const { canvas, renderer, scene, camera } = makeScene(canvasId);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.DirectionalLight(0xfff2d8, 1.6).translateX(2).translateY(3).translateZ(4));
  scene.add(new THREE.AmbientLight(0x9a8f7a, 0.5));

  const n = items.length;
  const xs = items.map((_, i) => (i - (n - 1) / 2) * SPACING);

  const geo = new THREE.CylinderGeometry(1, 1, 0.17, 64);
  geo.rotateY(Math.PI / 2); // 캡 UV가 로컬 z축 기준이라 로고가 90° 누워 보이는 것 보정
  const circleGeo = new THREE.CircleGeometry(0.97, 48);
  const reedTex = reedingTexture();

  const coins = [];
  for (let i = 0; i < n; i++) {
    const item = items[i];
    let content;
    if (item.type === 'logo') {
      const [darkImg, lightImg] = await Promise.all([logoImage(item.icon, tier.engrave), logoImage(item.icon, tier.emboss)]);
      content = { type: 'image', darkImg, lightImg };
    } else {
      content = { type: 'text', abbr: item.abbr };
    }
    const faceTex = coinFaceTexture(tier, content);
    // 뒷면 캡은 UV가 180° 뒤집혀 있어서 텍스처를 180° 돌린 사본 사용
    const backTex = faceTex.clone();
    backTex.center.set(0.5, 0.5);
    backTex.rotation = Math.PI;
    backTex.needsUpdate = true;
    const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, metalness: 0.9, roughness: 0.28, envMapIntensity: 1.3 });
    const backMat = new THREE.MeshStandardMaterial({ map: backTex, metalness: 0.9, roughness: 0.28, envMapIntensity: 1.3 });
    const sideMat = new THREE.MeshStandardMaterial({
      color: tier.base, metalness: 0.95, roughness: 0.32, envMapIntensity: 1.3,
      bumpMap: reedTex, bumpScale: 1.6,
    });
    const coin = new THREE.Mesh(geo, [sideMat, faceMat, backMat]);
    coin.rotation.x = Math.PI / 2;
    const group = new THREE.Group();
    group.add(coin);

    const glintMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uTint: { value: new THREE.Vector3(...tier.glint) } },
      vertexShader: vert, fragmentShader: glintFrag,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const front = new THREE.Mesh(circleGeo, glintMat);
    front.position.z = 0.088;
    const back = new THREE.Mesh(circleGeo, glintMat);
    back.position.z = -0.088;
    back.rotation.y = Math.PI;
    group.add(front, back);
    group.position.set(xs[i], Y_BASE, 0);
    scene.add(group);

    // 바닥 반사: 반전 복제본
    const mirrorCoin = new THREE.Mesh(geo, [sideMat, faceMat, backMat].map(m => {
      const mm = m.clone();
      mm.transparent = true;
      mm.opacity = 0.22;
      mm.depthWrite = false;
      return mm;
    }));
    mirrorCoin.rotation.x = Math.PI / 2;
    const mirror = new THREE.Group();
    mirror.add(mirrorCoin);
    mirror.scale.y = -0.85;
    scene.add(mirror);

    // 이름 리본 (hover 시 표시)
    const ribbon = new THREE.Sprite(new THREE.SpriteMaterial({ map: ribbonTexture(item.name, tier.rimHi), transparent: true, opacity: 0, depthWrite: false, depthTest: false }));
    ribbon.scale.set(1.7, 0.42, 1);
    ribbon.position.set(xs[i], -1.05, 0);
    ribbon.renderOrder = 10;
    ribbon.raycast = () => {};
    scene.add(ribbon);

    // 스파클 파티클
    const N = 16;
    const base = [];
    for (let k = 0; k < N; k++) {
      const a = Math.random() * Math.PI * 2, r = 1.1 + Math.random() * 0.5;
      base.push([Math.cos(a) * r, Math.random() * 2.4 - 1.2, Math.sin(a) * r * 0.5]);
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    const sparkMat = new THREE.PointsMaterial({ map: starTexture(), size: 0.16, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    sparks.position.set(xs[i], Y_BASE, 0);
    sparks.raycast = () => {};
    scene.add(sparks);

    coins.push({
      group, mirror, ribbon, glintMat,
      sparks: { geo: sparkGeo, mat: sparkMat, base, N },
      wind: new THREE.Vector2(), windVel: new THREE.Vector2(), hovered: false,
      flip: { active: false, start: -10 },
    });
  }

  // 인터랙션: hover 리본 / 클릭 플립 / 드래그 고무줄 회전
  const ray = new THREE.Raycaster();
  const drag = { active: false, idx: -1, lastX: 0, lastY: 0, moved: 0, downT: 0 };
  const pick = e => {
    const r = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    for (let i = 0; i < coins.length; i++) {
      if (ray.intersectObject(coins[i].group, true).length) return i;
    }
    return -1;
  };
  canvas.addEventListener('pointermove', e => {
    const idx = pick(e);
    coins.forEach((c, i) => c.hovered = i === idx);
    canvas.style.cursor = drag.active ? 'grabbing' : (idx >= 0 ? 'grab' : 'default');
    if (drag.active && drag.idx >= 0) {
      const dx = e.clientX - drag.lastX;
      const dy = e.clientY - drag.lastY;
      const c = coins[drag.idx];
      c.wind.x += dy * DRAG_K;
      c.wind.y += dx * DRAG_K;
      c.windVel.set(0, 0);
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
    }
  });
  canvas.addEventListener('pointerdown', e => {
    const idx = pick(e);
    if (idx < 0) return;
    drag.active = true;
    drag.idx = idx;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    drag.downT = performance.now();
    drag.moved = 0;
    canvas.style.cursor = 'grabbing';
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointerup', () => {
    if (drag.active && drag.idx >= 0 && drag.moved < 6 && performance.now() - drag.downT < 400) {
      const c = coins[drag.idx];
      c.flip.active = true;
      c.flip.start = now;
    }
    drag.active = false;
    drag.idx = -1;
    canvas.style.cursor = 'default';
  });
  canvas.addEventListener('pointerleave', () => {
    coins.forEach(c => c.hovered = false);
  });

  let lastT = 0;
  updaters.push(t => {
    now = t;
    const dt = Math.min(t - lastT, 0.1);
    lastT = t;
    for (let i = 0; i < coins.length; i++) {
      const c = coins[i], phase = i * 1.3;
      if (!(drag.active && drag.idx === i)) {
        const K = 50, D = 7;
        c.windVel.x += (-K * c.wind.x - D * c.windVel.x) * dt;
        c.windVel.y += (-K * c.wind.y - D * c.windVel.y) * dt;
        c.wind.x += c.windVel.x * dt;
        c.wind.y += c.windVel.y * dt;
        if (c.wind.lengthSq() < 1e-6 && c.windVel.lengthSq() < 1e-5) {
          c.wind.set(0, 0);
          c.windVel.set(0, 0);
        }
      }
      let y = Y_BASE + Math.sin(t * 1.4 + phase) * 0.08;
      let rotX = 0;
      let rotY = t * 0.9 + phase;
      if (c.flip.active) {
        const p = (t - c.flip.start) / 0.95;
        if (p >= 1) c.flip.active = false;
        else {
          y += 4 * p * (1 - p) * 1.2;
          rotX = (1 - Math.pow(1 - p, 2)) * Math.PI * 6;
        }
      }
      c.group.position.y = y;
      qAuto.setFromEuler(eAuto.set(rotX, rotY, 0));
      qWind.setFromAxisAngle(Y_AXIS, c.wind.y);
      qTmp.setFromAxisAngle(X_AXIS, c.wind.x);
      qWind.premultiply(qTmp);
      c.group.quaternion.multiplyQuaternions(qWind, qAuto);
      const gq = c.group.quaternion;
      c.mirror.position.set(xs[i], 2 * FLOOR_Y - y, 0);
      c.mirror.quaternion.set(-gq.x, gq.y, -gq.z, gq.w);
      c.ribbon.material.opacity += ((c.hovered ? 0.95 : 0) - c.ribbon.material.opacity) * Math.min(dt * 8, 1);
      c.glintMat.uniforms.uTime.value = t + i * 1.15;
      const s = c.sparks;
      const pos = s.geo.attributes.position.array;
      for (let k = 0; k < s.N; k++) {
        pos[k * 3] = s.base[k][0];
        pos[k * 3 + 1] = ((s.base[k][1] + t * 0.35 + 1.2) % 2.4) - 1.2;
        pos[k * 3 + 2] = s.base[k][2];
      }
      s.geo.attributes.position.needsUpdate = true;
      s.mat.opacity = 0.6 + 0.3 * Math.sin(t * 5.0 + i * 2);
    }
    renderer.render(scene, camera);
  });
}

const data = JSON.parse(document.getElementById('skills-data').textContent);
const rows = { advanced: [], intermediate: [], beginner: [] };
data.forEach(s => rows[s.tier] && rows[s.tier].push(s));

await Promise.all([
  buildCoinRow('skills-coin-advanced', 0, rows.advanced),
  buildCoinRow('skills-coin-intermediate', 1, rows.intermediate),
  buildCoinRow('skills-coin-beginner', 2, rows.beginner),
]);

window.__labTick = t => updaters.forEach(u => u(t)); // 백그라운드 탭 등 rAF가 멈춘 환경에서 수동 렌더용
const clock = new THREE.Clock();
(function loop() {
  requestAnimationFrame(loop);
  window.__labTick(clock.getElapsedTime());
})();
