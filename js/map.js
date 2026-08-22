/* ─────────────────────────────────────────────────────────────────────────────
   map.js — the dependency map. Which lessons stand on which, drawn as a tiered
   graph. Hovering a node lights the whole chain it belongs to, so you can see
   what you need before a topic and what it unlocks after.
   ───────────────────────────────────────────────────────────────────────────── */

import { h, S, clear, qsa } from './core/dom.js';
import { LESSONS, GROUPS, STATUS, byId, depth, ancestry, descendants } from './registry.js';
import { curvePath } from './core/dom.js';

const NODE_W = 158, NODE_H = 42, GAP_X = 58, GAP_Y = 30, PAD = 30;

export function renderMap(root, onNav) {
  clear(root);

  const memo = new Map();
  const tiers = [];
  LESSONS.forEach(l => {
    const d = depth(l.id, memo);
    (tiers[d] ||= []).push(l);
  });

  const cols = tiers.length;
  const maxRows = Math.max(...tiers.map(t => t.length));
  const W = PAD * 2 + cols * NODE_W + (cols - 1) * GAP_X;
  const H = PAD * 2 + maxRows * NODE_H + (maxRows - 1) * GAP_Y + 30;

  const pos = new Map();
  tiers.forEach((tier, ci) => {
    const colH = tier.length * NODE_H + (tier.length - 1) * GAP_Y;
    const y0 = PAD + 22 + (H - PAD * 2 - 22 - colH) / 2;
    tier.forEach((l, ri) => {
      pos.set(l.id, { x: PAD + ci * (NODE_W + GAP_X), y: y0 + ri * (NODE_H + GAP_Y) });
    });
  });

  const svg = S('svg', {
    class: 'cs-map', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMinYMin meet',
    role: 'img', 'aria-label': 'Dependency map of every lesson',
  });

  // tier captions
  tiers.forEach((tier, ci) => {
    if (!tier.length) return;
    svg.appendChild(S('text', {
      x: PAD + ci * (NODE_W + GAP_X) + NODE_W / 2, y: PAD + 4,
      class: 'map-tier', 'text-anchor': 'middle',
      style: { fontFamily: 'var(--cs-font-mono)', fontSize: '9px', fill: 'var(--cs-dim)', letterSpacing: '.14em', textTransform: 'uppercase' },
    }, document.createTextNode(ci === 0 ? 'no prerequisites' : `tier ${ci + 1}`)));
  });

  // edges first so nodes sit on top
  const edges = [];
  LESSONS.forEach(l => l.deps.forEach(dep => {
    const a = pos.get(dep), b = pos.get(l.id);
    if (!a || !b) return;
    const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2;
    const x2 = b.x, y2 = b.y + NODE_H / 2;
    const mid = (x1 + x2) / 2;
    const p = S('path', {
      class: 'map-edge', 'data-from': dep, 'data-to': l.id,
      d: curvePath([[x1, y1], [mid, y1], [mid, y2], [x2, y2]]),
    });
    edges.push(p);
    svg.appendChild(p);
  }));

  LESSONS.forEach(l => {
    const p = pos.get(l.id);
    const accent = `var(--cs-accent-${GROUPS[l.group].accent})`;
    const g = S('g', { class: 'map-node', 'data-id': l.id, tabindex: '0', role: 'link' });
    g.appendChild(S('rect', {
      x: p.x, y: p.y, width: NODE_W, height: NODE_H, rx: 5,
      fill: 'var(--cs-bg-card)', stroke: l.status === 'live' ? accent : 'var(--cs-border-data)',
      'stroke-width': 1.2, 'stroke-dasharray': l.status === 'live' ? '' : '4 3',
    }));
    g.appendChild(S('text', {
      x: p.x + 11, y: p.y + 18, style: { fontSize: '11px', fill: 'var(--cs-text-bright)' },
    }, document.createTextNode(l.title)));
    g.appendChild(S('text', {
      x: p.x + 11, y: p.y + 32,
      style: { fontSize: '8px', fill: 'var(--cs-muted)', letterSpacing: '.1em' },
    }, document.createTextNode(GROUPS[l.group].label.toUpperCase())));
    g.appendChild(S('circle', {
      cx: p.x + NODE_W - 12, cy: p.y + 12, r: 3.5,
      fill: l.status === 'live' ? 'var(--cs-data-green)' : l.status === 'wip' ? 'var(--cs-amber)' : 'var(--cs-dim)',
    }));

    const light = on => {
      if (!on) {
        qsa('.map-node', svg).forEach(n => n.classList.remove('dim'));
        qsa('.map-edge', svg).forEach(n => n.classList.remove('dim', 'hot'));
        return;
      }
      const chain = new Set([l.id, ...ancestry(l.id), ...descendants(l.id)]);
      qsa('.map-node', svg).forEach(n => n.classList.toggle('dim', !chain.has(n.dataset.id)));
      qsa('.map-edge', svg).forEach(e => {
        const hot = chain.has(e.dataset.from) && chain.has(e.dataset.to);
        e.classList.toggle('hot', hot);
        e.classList.toggle('dim', !hot);
      });
    };
    g.addEventListener('pointerenter', () => light(true));
    g.addEventListener('pointerleave', () => light(false));
    g.addEventListener('focus', () => light(true));
    g.addEventListener('blur', () => light(false));
    g.addEventListener('click', () => onNav(l.id));
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNav(l.id); } });
    svg.appendChild(g);
  });

  const counts = LESSONS.reduce((a, l) => (a[l.status] = (a[l.status] || 0) + 1, a), {});

  root.appendChild(h('div', { class: 'cs-page' },
    h('h2', {}, 'the dependency map'),
    h('p', { class: 'cs-page-lede' },
      'Nothing in statistics arrives from nowhere. Every method on this site is assembled out of the ones to its left. ' +
      'Hover a box to light up its whole chain — everything you need before it, and everything it goes on to make possible.'),
    h('div', { class: 'cs-legend' },
      h('span', {}, h('i', { style: { background: 'var(--cs-data-green)' } }), `${counts.live || 0} built`),
      h('span', {}, h('i', { style: { background: 'var(--cs-amber)' } }), `${counts.wip || 0} in progress`),
      h('span', {}, h('i', { style: { background: 'var(--cs-dim)' } }), `${counts.planned || 0} not started`),
      ...Object.entries(GROUPS).map(([k, g]) =>
        h('span', {}, h('i', { style: { background: `var(--cs-accent-${g.accent})` } }), g.label)),
    ),
    h('div', { class: 'cs-map-wrap' }, svg),
    h('h2', { style: { marginTop: 'var(--cs-space-12)' } }, 'read it in order'),
    h('p', { class: 'cs-page-lede' },
      'If you want a path rather than a map: this is the order that never asks you to use something you have not built yet.'),
    h('div', { class: 'cs-grid' },
      ...[...LESSONS].sort((a, b) => depth(a.id, memo) - depth(b.id, memo) || a.title.localeCompare(b.title))
        .map((l, i) => lessonCard(l, i, onNav))),
  ));
}

export function lessonCard(l, i, onNav) {
  const st = STATUS[l.status];
  return h('button', {
    class: 'cs-card', style: { '--card-accent': `var(--cs-accent-${GROUPS[l.group].accent})` },
    onclick: () => onNav(l.id),
  },
    h('span', { class: 'cs-card-kicker' }, l.kicker),
    h('span', { class: 'cs-card-title' }, l.title),
    h('span', { class: 'cs-card-desc' }, l.blurb),
    h('span', { class: 'cs-card-foot' },
      h('span', { class: `cs-badge cs-badge-${st.cls}` }, st.label),
      ...(l.deps.length
        ? [h('span', { class: 'cs-card-steps' }, 'needs: ' + l.deps.join(', '))]
        : [h('span', { class: 'cs-card-steps' }, 'no prerequisites')]),
    ),
  );
}

export function renderIndex(root, onNav) {
  clear(root);
  const groups = {};
  LESSONS.forEach(l => (groups[l.group] ||= []).push(l));
  root.appendChild(h('div', { class: 'cs-page' },
    h('p', { class: 'cs-page-lede' },
      'Statistics is usually taught as a list of formulas to recognise. It is actually a very small number of physical moves — ' +
      'measure from the middle, square it, add it up, divide by something — reused in different arrangements. ' +
      'Every lesson here draws those moves happening, one micro-step at a time, on real data you can drag around.'),
    h('p', { class: 'cs-page-lede' },
      h('strong', { style: { color: 'var(--cs-text-bright)' } }, 'New here? '),
      'Start with ', h('a', { class: 'cs-link', href: '#/correlation', style: { cursor: 'pointer' } }, 'correlation'),
      ' — it builds the parts the rest of the site bolts together.'),
    ...Object.entries(GROUPS).map(([k, g]) => !groups[k] ? null : h('section', { style: { marginTop: 'var(--cs-space-10, 2.5rem)' } },
      h('h2', { style: { color: `var(--cs-accent-${g.accent})`, marginTop: 'var(--cs-space-8)' } }, g.label),
      h('div', { class: 'cs-grid' }, ...groups[k].map((l, i) => lessonCard(l, i, onNav))),
    )),
  ));
}
