// 앱 진입점: 레지스트리로 사이드바를 그리고, URL 해시에 따라 월드를 교체한다.
// 페이지 리로드·리다이렉트 없이 화면(월드)만 갈아끼운다.
import { registry } from '../worlds/registry.js';
import { createHarness } from './harness.js';

const canvas   = document.getElementById('gl');
const navEl    = document.getElementById('nav');
const titleEl  = document.getElementById('world-title');
const errEl    = document.getElementById('error');
const fWorld   = document.getElementById('f-world');
const fLesson  = document.getElementById('f-lesson');
const postCards = document.getElementById('post-cards');
const harness  = createHarness(canvas);

// ── 사이드바 구성 (챕터별 그룹) ──
const groups = new Map();
for (const w of registry) {
  if (!groups.has(w.chapter)) groups.set(w.chapter, []);
  groups.get(w.chapter).push(w);
}
for (const [chapter, worlds] of groups) {
  const h = document.createElement('div');
  h.className = 'nav-chapter';
  h.textContent = chapter;
  navEl.appendChild(h);
  for (const w of worlds) {
    const a = document.createElement('a');
    a.className = 'nav-item' + (w.status === 'ready' ? '' : ' disabled');
    a.dataset.id = w.id;
    const label = document.createElement('span');
    label.textContent = w.title;
    a.appendChild(label);
    if (w.status === 'ready') {
      a.href = '#' + w.id;
    } else {
      const s = document.createElement('span');
      s.className = 'soon';
      s.textContent = '준비 중';
      a.appendChild(s);
    }
    navEl.appendChild(a);
  }
}

// ── 라우팅 ──
// 현재 월드의 관련 블로그 글을 우측 하단 배너 카드로 렌더 (여러 개면 세로로 쌓임)
function renderPostCards(world) {
  if (!postCards) return;
  postCards.innerHTML = '';
  const posts = (world && world.posts) || [];
  for (const p of posts) {
    const a = document.createElement('a');
    a.className = 'post-card';
    a.href = p.url;
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = '관련 글';
    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = p.title + ' →';
    a.append(label, title);
    postCards.appendChild(a);
  }
}

async function route() {
  const firstReady = registry.find(w => w.status === 'ready');
  const id = location.hash.replace(/^#/, '') || (firstReady && firstReady.id);
  const world = registry.find(w => w.id === id && w.status === 'ready');

  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.id === id));

  if (!world) { titleEl.textContent = '준비 중인 월드입니다'; renderPostCards(null); return; }

  titleEl.textContent = `${world.chapter} — ${world.title}`;
  if (fWorld)  fWorld.textContent  = world.file || `worlds/${world.id}-*.js`;
  if (fLesson) fLesson.textContent = world.lesson || `chapters/${world.id}-*.lesson.md`;
  renderPostCards(world);
  errEl.style.display = 'none';

  try {
    const mod = await world.load();
    await harness.mount(mod.default);
  } catch (e) {
    errEl.style.display = 'block';
    errEl.textContent = '월드 로드 실패: ' + (e && e.message ? e.message : e);
    console.error(e);
  }
}

window.addEventListener('hashchange', route);
route();
