/* ─────────────────────────────────────────────────────────────────────────────
   app.js — shell and router. Hash routing, one lesson mounted at a time.

   The tab bar has two rows: five categories on top, and underneath them the
   lessons inside whichever category you are currently in. Thirty-three lessons
   will not fit on one line legibly, and pretending otherwise just produces a
   horizontal scrollbar nobody finds.
   ───────────────────────────────────────────────────────────────────────────── */

import { h, clear, qs, qsa } from './core/dom.js';
import { LESSONS, GROUPS, GROUP_ORDER, byId } from './registry.js';
import { mountLesson } from './core/stage.js';
import { renderMap, renderIndex, renderGroup } from './map.js';
import { init as initTheme, themeSwitch, announce } from './core/theme.js';

const app = qs('#app');
const tabbar = qs('#tabbar');

initTheme();
qs('.cs-masthead').appendChild(themeSwitch());

const topRow = h('div', { class: 'cs-tabrow cs-tabrow-top' });
const subRow = h('div', { class: 'cs-tabrow cs-tabrow-sub' });
tabbar.append(topRow, subRow);

let mounted = null;

/* ── tab bar ──────────────────────────────────────────────────────────────── */

function buildTop() {
  clear(topRow);
  topRow.append(
    tab('index', 'index', 0),
    tab('map', 'the map', 2),
    h('span', { class: 'cs-tab-sep' }, '/'),
    ...GROUP_ORDER.map(g => tab('g/' + g, GROUPS[g].label, GROUPS[g].accent)),
  );
}

/** the lessons of one category, with their sub-section labels inline */
function buildSub(group) {
  clear(subRow);
  subRow.classList.toggle('empty', !group);
  if (!group) return;
  const g = GROUPS[group];
  const inGroup = LESSONS.filter(l => l.group === group);
  (g.subs || ['']).forEach(sub => {
    const items = inGroup.filter(l => (l.sub || '') === sub);
    if (!items.length) return;
    if (sub) subRow.appendChild(h('span', { class: 'cs-tab-glabel' }, sub));
    items.forEach(l => subRow.appendChild(tab(l.id, l.short || l.title, g.accent, l.status)));
  });
}

function tab(id, label, accent, status) {
  const wip = status && status !== 'live';
  return h('button', {
    class: 'cs-tab' + (wip ? ' wip' : ''),
    'data-tab': id,
    'aria-label': wip ? `${label} (work in progress)` : null,
    style: { '--tab-accent': `var(--cs-accent-${accent})` },
    onclick: () => go(id),
  }, label);
}

function markActive(id, group) {
  qsa('.cs-tab', tabbar).forEach(t => {
    const key = t.dataset.tab;
    const on = key === id || (group && key === 'g/' + group);
    t.classList.toggle('active', on);
    if (key === id) t.setAttribute('aria-current', on ? 'page' : 'false');
    if (key === id && on) t.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
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

  if (id.startsWith('g/')) {
    const gk = id.slice(2);
    if (!GROUPS[gk]) { notFound(id); return; }
    buildSub(gk); markActive(id, gk);
    renderGroup(app, gk, go);
    document.title = `${GROUPS[gk].label} · show your work`;
    return;
  }

  if (id === 'index') {
    buildSub(null); markActive(id, null);
    renderIndex(app, go); document.title = 'show your work'; return;
  }
  if (id === 'map') {
    buildSub(null); markActive(id, null);
    renderMap(app, go); document.title = 'the map · show your work'; return;
  }

  const entry = byId(id);
  if (!entry) { notFound(id); return; }
  buildSub(entry.group);
  markActive(id, entry.group);

  document.title = `${entry.title} · show your work`;
  announce(`${entry.title}. ${entry.blurb || ''}`);
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
  buildSub(null);
  app.appendChild(h('div', { class: 'cs-page' },
    h('div', { class: 'cs-wip-panel' },
      h('h3', {}, '[nothing here]'),
      h('p', {}, `There is no lesson called \u201c${id}\u201d.`),
      h('button', { class: 'cs-data-cta', style: { marginTop: '1.5rem' }, onclick: () => go('index') }, '[back to the index]'),
    )));
}

window.addEventListener('hashchange', route);
buildTop();
route();
