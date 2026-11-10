// Ocean Wave · 3인칭 캐릭터 + 카메라 (P5)
// 설계: chapters/ocean-wave.design.md 14장
//
// 물리 엔진 없이 움직인다. 지형이 해석적 높이 함수(terrainHeight)라서
//   - 발 높이 = terrainHeight(x, z)
//   - 경사·수심 판정 = 다음 위치의 높이를 미리 읽어 보고 갈지 말지 정한다
// 물에 대한 정보는 GPU 수면에서 1~2프레임 늦게 받아 온 값(water = { h, gx, gz })만 쓴다.
//   h  = 발밑 수면 높이, (gx, gz) = 수면 기울기. 파도가 밀려와 물이 높아지는 쪽 반대로 밀린다
//
// 캐릭터는 아직 캡슐 인형이다. 이동·카메라·물 상호작용을 먼저 완성하고 리깅 캐릭터는 나중에 바꾼다.
import * as THREE from 'three/webgpu';
import { terrainHeight, smoothstepJS } from './ocean-wave-coast.js';

export const MOVE = {
  walk: 2.4, run: 5.5,                      // m/s
  accel: 10,                                // 속도가 목표 속도로 따라붙는 빠르기 (1/s)
  turn: 12,                                 // 몸이 이동 방향으로 도는 빠르기 (1/s)
  maxSlope: Math.tan(38 * Math.PI / 180),   // 이보다 가파른 오르막은 못 올라간다
  maxDepth: 1.2,                            // 잔잔한 수면 기준 이보다 깊은 곳은 진입 거부
  push: 5, pushMax: 2.2,                    // 수면 기울기 → 밀리는 속도 (m/s), 상한
  bounds: { x0: -380, x1: 380, z0: -150, z1: 250 },
};

// 물 깊이 → 속도 배율. 발목(0.2 m) 0.9 · 무릎(0.5 m) 0.6 · 허리(1.0 m) 0.35
const WADE = [[0, 1], [0.2, 0.9], [0.5, 0.6], [1.0, 0.35], [1.6, 0.3]];
export function wadeFactor(d) {
  if (d <= 0) return 1;
  for (let i = 1; i < WADE.length; i++) {
    const [d1, f1] = WADE[i];
    if (d <= d1) { const [d0, f0] = WADE[i - 1]; return f0 + (f1 - f0) * (d - d0) / (d1 - d0); }
  }
  return WADE[WADE.length - 1][1];
}

// ── 캡슐 인형: 발이 원점, 앞이 +z (로컬) ──
function buildFigure() {
  const mat = c => new THREE.MeshStandardNodeMaterial({ color: c, roughness: 0.75 });
  const skin = mat(0xe8b48a), shirt = mat(0xe0572e), pants = mat(0x2c3e5a), cap = mat(0xf2efe6);
  const root = new THREE.Group();
  const body = new THREE.Group();            // 걸을 때 위아래로 흔들리는 부분
  root.add(body);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.42, 4, 14), shirt);
  torso.position.y = 1.16;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 12), skin);
  head.position.y = 1.62;
  // 모자 챙이 앞을 가리켜서 어느 쪽을 보는지 멀리서도 보인다
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.155, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), cap);
  crown.position.y = 1.65;
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.14), cap);
  brim.position.set(0, 1.66, 0.17);
  body.add(torso, head, crown, brim);

  // 팔다리: 관절(그룹)을 회전시키면 그 아래 캡슐이 흔들린다
  const limb = (r, len, m, x, y) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), m);
    mesh.position.y = -(len / 2 + r);
    pivot.add(mesh);
    return pivot;
  };
  const legs = [limb(0.085, 0.62, pants, -0.11, 0.84), limb(0.085, 0.62, pants, 0.11, 0.84)];
  const arms = [limb(0.06, 0.42, shirt, -0.29, 1.38), limb(0.06, 0.42, shirt, 0.29, 1.38)];
  body.add(...arms);
  root.add(...legs);
  root.traverse(o => { if (o.isMesh) o.castShadow = false; });
  return { root, body, legs, arms };
}

// 각도 a → b 최단 방향 보간
function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function createPlayer(x0, z0) {
  const fig = buildFigure();
  const pos = new THREE.Vector3(x0, terrainHeight(x0, z0), z0);
  const vel = new THREE.Vector2(0, 0);       // 수평 속도 (x, z)
  let facing = Math.PI;                      // 바다(-z) 쪽을 보고 시작
  let phase = 0, swing = 0;
  const st = { pos, vel, depth: 0, wade: 1, blocked: '' };

  // 한 칸 이동이 가능한지: 범위 · 수심 · 경사
  function allowed(px, pz, nx, nz) {
    const B = MOVE.bounds;
    if (nx < B.x0 || nx > B.x1 || nz < B.z0 || nz > B.z1) return 'bounds';
    const h0 = terrainHeight(px, pz), h1 = terrainHeight(nx, nz);
    // 잔잔한 수면(y = 0) 기준 깊이. 이미 깊은 곳에 있으면(파도에 밀려 들어갔을 때) 얕아지는 쪽만 허용
    if (-h1 > MOVE.maxDepth && h1 <= h0) return 'deep';
    const len = Math.hypot(nx - px, nz - pz);
    if (len > 1e-6 && (h1 - h0) / len > MOVE.maxSlope) return 'slope';
    return '';
  }

  // 막히면 축 하나씩만 움직여 본다 (벽을 따라 미끄러지게)
  function tryMove(sx, sz) {
    const { x, z } = pos;
    let why = allowed(x, z, x + sx, z + sz);
    if (!why) { pos.x += sx; pos.z += sz; return ''; }
    if (Math.abs(sx) > 1e-6 && !allowed(x, z, x + sx, z)) { pos.x += sx; vel.y = 0; return why; }
    if (Math.abs(sz) > 1e-6 && !allowed(x, z, x, z + sz)) { pos.z += sz; vel.x = 0; return why; }
    vel.set(0, 0);
    return why;
  }

  // input: { f, r, run } (앞/옆 -1~1), yaw: 카메라 방위, water: { h, gx, gz }
  st.update = (dt, input, yaw, water) => {
    const ground = terrainHeight(pos.x, pos.z);
    const depth = Math.max(water.h - ground, 0);         // 실제 수심 (파도 포함)
    const wade = wadeFactor(depth);
    st.depth = depth; st.wade = wade;

    // 카메라 기준 방향: 앞 = 카메라가 보는 쪽을 수평면에 눕힌 것
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    let mx = fx * input.f + rx * input.r, mz = fz * input.f + rz * input.r;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    const speed = (input.run ? MOVE.run : MOVE.walk) * wade;

    // 가속·감속: 목표 속도로 지수 보간 (프레임레이트와 무관하게 같은 느낌)
    const k = 1 - Math.exp(-MOVE.accel * dt);
    vel.x += (mx * speed - vel.x) * k;
    vel.y += (mz * speed - vel.y) * k;

    // 파도에 밀림: 물이 높은 쪽에서 낮은 쪽으로. 물에 잠긴 만큼만
    const sub = smoothstepJS(0.05, 0.6, depth);
    let px = -water.gx * MOVE.push * sub, pz = -water.gz * MOVE.push * sub;
    const pl = Math.hypot(px, pz);
    if (pl > MOVE.pushMax) { px *= MOVE.pushMax / pl; pz *= MOVE.pushMax / pl; }
    st.push = pl > MOVE.pushMax ? MOVE.pushMax : pl;

    st.blocked = tryMove((vel.x + px) * dt, (vel.y + pz) * dt);
    pos.y = terrainHeight(pos.x, pos.z);

    // 몸 방향: 움직이는 쪽으로 부드럽게 돈다
    const hs = vel.length();
    if (hs > 0.15) facing = lerpAngle(facing, Math.atan2(vel.x, vel.y), 1 - Math.exp(-MOVE.turn * dt));

    // 걷는 동작: 이동 거리만큼 위상이 돈다 (보폭 약 0.7 m). 멈추면 팔다리가 제자리로
    phase += hs * dt * (Math.PI / 0.7);
    swing += (Math.min(hs / MOVE.walk, 1.4) * 0.55 - swing) * (1 - Math.exp(-8 * dt));
    const s = Math.sin(phase) * swing;
    fig.legs[0].rotation.x = s; fig.legs[1].rotation.x = -s;
    fig.arms[0].rotation.x = -s * 0.8; fig.arms[1].rotation.x = s * 0.8;
    fig.body.position.y = Math.abs(Math.cos(phase)) * swing * 0.06;
    fig.body.rotation.x = Math.min(hs / MOVE.run, 1) * 0.12;   // 빨리 갈수록 앞으로 숙임

    fig.root.position.copy(pos);
    fig.root.rotation.y = facing;
  };

  st.object = fig.root;
  st.dispose = () => fig.root.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  return st;
}

// ── 3인칭 카메라 + 입력 ──
// 마우스: 캔버스 클릭 → 포인터 잠금(Pointer Lock). Esc로 풀린다. 잠금이 안 되는 환경에서는 드래그로 돌린다
// 키: 포인터가 잠겼거나 캔버스에 포커스가 있을 때만 받는다 (사이드바 입력과 섞이지 않게)
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight']);

// 임계 감쇠 스프링 한 스텝 (암시적 오일러: dt가 커도 튀지 않는다)
function spring(x, v, target, omega, dt) {
  const f = 1 + 2 * dt * omega, oo = omega * omega, hoo = dt * oo, hhoo = dt * hoo;
  const inv = 1 / (f + hhoo);
  return [(f * x + dt * v + hhoo * target) * inv, (v + hoo * (target - x)) * inv];
}

export function createThirdPerson(camera, canvas) {
  const st = {
    enabled: true,
    yaw: 0, pitch: 0.3, dist: 5.5,        // yaw 0 = 바다(-z)를 본다
    shoulder: 0.45,                        // 어깨 너머: 캐릭터를 화면 왼쪽으로 살짝
  };
  const keys = new Set();
  const pivot = new THREE.Vector3(), pivotV = new THREE.Vector3();
  let started = false, dragging = false, lx = 0, ly = 0;

  // 캔버스가 포커스를 받을 수 있게 (원래 없던 속성이면 dispose에서 되돌린다)
  const hadTab = canvas.hasAttribute('tabindex');
  if (!hadTab) canvas.tabIndex = 0;
  const oldOutline = canvas.style.outline;
  canvas.style.outline = 'none';

  const locked = () => document.pointerLockElement === canvas;
  const active = () => st.enabled && (locked() || document.activeElement === canvas);

  const look = (dx, dy) => {
    st.yaw -= dx * 0.0032;
    st.pitch = Math.min(Math.max(st.pitch + dy * 0.0032, -0.35), 1.25);
  };
  const down = e => {
    if (!st.enabled) return;
    canvas.focus();
    if (!locked() && canvas.requestPointerLock) {
      try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* 잠금 불가 환경 */ }
    }
    dragging = true; lx = e.clientX; ly = e.clientY;
  };
  const move = e => {
    if (!st.enabled) return;
    if (locked()) look(e.movementX || 0, e.movementY || 0);
    else if (dragging) { look(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY; }
  };
  const up = () => { dragging = false; };
  const wheel = e => {
    if (!st.enabled) return;
    e.preventDefault();
    st.dist = Math.min(Math.max(st.dist * Math.exp(e.deltaY * 0.001), 2.5), 14);
  };
  const keydown = e => {
    if (!active() || !MOVE_KEYS.has(e.code)) return;
    keys.add(e.code); e.preventDefault();
  };
  const keyup = e => { keys.delete(e.code); };
  const blur = () => keys.clear();          // 창을 벗어나면 눌린 키가 남지 않게

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  canvas.addEventListener('wheel', wheel, { passive: false });
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', blur);
  canvas.addEventListener('blur', blur);

  st.input = () => {
    const on = c => (keys.has(c) ? 1 : 0);
    return {
      f: on('KeyW') - on('KeyS'),
      r: on('KeyD') - on('KeyA'),
      run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    };
  };
  st.locked = locked;
  st.focused = active;

  // feet: 캐릭터 발 위치, waterH: 캐릭터 근처 수면 높이
  const tmp = new THREE.Vector3();
  st.update = (dt, feet, waterH) => {
    const goal = tmp.set(feet.x, feet.y + 1.55, feet.z);
    if (!started) { pivot.copy(goal); pivotV.set(0, 0, 0); started = true; }
    // 따라가기: 임계 감쇠 스프링. 지형 높이가 갑자기 바뀌어도 카메라가 덜컹거리지 않는다
    for (const c of ['x', 'y', 'z']) [pivot[c], pivotV[c]] = spring(pivot[c], pivotV[c], goal[c], c === 'y' ? 8 : 14, dt);

    const cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
    const rx = Math.cos(st.yaw), rz = -Math.sin(st.yaw);
    const lookAt = new THREE.Vector3(pivot.x + rx * st.shoulder, pivot.y, pivot.z + rz * st.shoulder);
    const p = camera.position.set(
      lookAt.x + Math.sin(st.yaw) * cp * st.dist,
      lookAt.y + sp * st.dist,
      lookAt.z + Math.cos(st.yaw) * cp * st.dist,
    );
    // 지형 속이나 수면 아래로 들어가면 위로 밀어 올린다 (수중 표현은 범위 밖)
    p.y = Math.max(p.y, terrainHeight(p.x, p.z) + 0.4, Math.max(waterH, 0) + 0.45);
    camera.lookAt(lookAt);
  };
  st.snap = () => { started = false; };
  st.dispose = () => {
    if (locked()) document.exitPointerLock();
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    canvas.removeEventListener('wheel', wheel);
    window.removeEventListener('keydown', keydown);
    window.removeEventListener('keyup', keyup);
    window.removeEventListener('blur', blur);
    canvas.removeEventListener('blur', blur);
    if (!hadTab) canvas.removeAttribute('tabindex');
    canvas.style.outline = oldOutline;
  };
  st.release = () => { keys.clear(); dragging = false; if (locked()) document.exitPointerLock(); };
  return st;
}
