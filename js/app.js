/* ─────────────────────────────────────────────────────────────────────────────
   app.js — shell and router. Hash routing, one lesson mounted at a time.
   ───────────────────────────────────────────────────────────────────────────── */

import { h, clear, qs, qsa } from './core/dom.js';
import { LESSONS, GROUPS, GROUP_ORDER, byId } from './registry.js';
import { mountLesson } from './core/stage.js';
import { renderMap, renderIndex } from './map.js';

const app = qs('#app');
const tabbar = qs('#tabbar');

let mounted = null;

/* ── tab bar ──────────────────────────────────────────────────────────────── */

function buildTabs() {
  clear(tabbar);
  tabbar.appendChild(tab('index', 'index', 0));
  tabbar.appendChild(tab('map', 'the map', 2));
  GROUP_ORDER.forEach(g => {
    const inGroup = LESSONS.filter(l => l.group === g);
    if (!inGroup.length) return;
    tabbar.appendChild(h('span', { class: 'cs-tab-group' },
      h('span', { class: 'cs-tab-sep' }, '/'),
      h('span', {
        class: 'cs-tab-glabel',
        style: { color: `var(--cs-accent-${GROUPS[g].accent})` },
      }, GROUPS[g].label)));
    inGroup.forEach(l => tabbar.appendChild(
      tab(l.id, l.short || l.title, GROUPS[g].accent, l.status)));
  });
}

function tab(id, label, accent, status) {
  return h('button', {
    class: 'cs-tab' + (status && status !== 'live' ? ' wip' : ''),
    'data-tab': id,
    style: { '--tab-accent': `var(--cs-accent-${accent})` },
    onclick: () => go(id),
  }, label);
}

function markActive(id) {
  qsa('.cs-tab', tabbar).forEach(t => {
    const on = t.dataset.tab === id;
    t.classList.toggle('active', on);
    if (on) t.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  });
}

/* ── routing ──────────────────────────────────────────────────────────────── */

function go(id) {
  if (location.hash === '#/' + id) route();
  else location.hash = '#/' + id;
}

async function route() {
  const id = (location.hash.replace(/^#\/?/, '') || 'index').trim();
  if (mounted) { mounted.destroy?.(); mounted = null; }
  clear(app);
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  markActive(id);

  if (id === 'index') { renderIndex(app, go); document.title = 'show your work'; return; }
  if (id === 'map') { renderMap(app, go); document.title = 'the map · show your work'; return; }

  const entry = byId(id);
  if (!entry) { notFound(id); return; }

  document.title = `${entry.title} · show your work`;
  const view = h('div', { class: 'cs-view' });
  app.appendChild(view);
  view.appendChild(h('div', { class: 'cs-loading' }, 'building the drawing…'));

  try {
    const mod = await entry.load();
    clear(view);
    mounted = mountLesson(view, mod.default, { onNav: go });
  } catch (err) {
    console.error(err);
    clear(view);
    view.appendChild(h('div', { class: 'cs-wip-panel' },
      h('h3', {}, '[this one broke]'),
      h('p', {}, `The lesson "${entry.title}" failed to load. That is a bug, not a lesson design choice.`),
      h('pre', { class: 'cs-code', style: { textAlign: 'left', marginTop: '1rem', fontSize: '.7rem' } }, String(err && err.message || err)),
    ));
  }
}

function notFound(id) {
  app.appendChild(h('div', { class: 'cs-page' },
    h('div', { class: 'cs-wip-panel' },
      h('h3', {}, '[nothing here]'),
      h('p', {}, `There is no lesson called “${id}”.`),
      h('button', { class: 'cs-data-cta', style: { marginTop: '1.5rem' }, onclick: () => go('index') }, '[back to the index]'),
    )));
}

window.addEventListener('hashchange', route);
buildTabs();
route();
