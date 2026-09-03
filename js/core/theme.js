/* ─────────────────────────────────────────────────────────────────────────────
   theme.js — three grounds to read this on.

   Dark is the brand and the default. Light exists because reading light text on
   a dark ground is genuinely harder for some people — astigmatism smears it.
   High contrast exists because "enough contrast for most" is not a standard.

   The choice is resolved in script and stamped on <html> as data-theme, so the
   stylesheet never has to duplicate a palette inside a media query. A tiny
   inline copy of resolve() runs in <head> to stamp it before first paint;
   without it the page flashes dark before turning light.
   ───────────────────────────────────────────────────────────────────────────── */

import { h, qsa } from './dom.js';

const KEY = 'syw-theme';

export const THEMES = [
  { id: 'light', label: 'light', hint: 'dark text on paper' },
  { id: 'dark',  label: 'dark',  hint: 'the default' },
  { id: 'hc',    label: 'contrast', hint: 'maximum contrast, heavier lines' },
];

const META = { light: '#faf8f4', dark: '#0a0b10', hc: '#000000' };

const stored = () => {
  try { return localStorage.getItem(KEY); } catch { return null; }
};

/** what to use when nobody has chosen: the system's contrast preference, else dark */
export const preferred = () =>
  (matchMedia('(prefers-contrast: more)').matches ? 'hc' : 'dark');

export const current = () => {
  const s = stored();
  return THEMES.some(t => t.id === s) ? s : preferred();
};

export function apply(id) {
  const t = THEMES.some(x => x.id === id) ? id : preferred();
  document.documentElement.setAttribute('data-theme', t);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', META[t]);
  qsa('[data-theme-btn]').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.themeBtn === t)));
  return t;
}

export function set(id) {
  try { localStorage.setItem(KEY, id); } catch { /* private browsing; the choice just won't stick */ }
  apply(id);
}

/** the switcher itself — a real radio group, so a screen reader says what it is */
export function themeSwitch() {
  const now = current();
  const wrap = h('div', {
    class: 'cs-theme', role: 'group', 'aria-label': 'colour theme',
  },
    ...THEMES.map(t => h('button', {
      class: 'cs-theme-btn',
      'data-theme-btn': t.id,
      'aria-pressed': String(t.id === now),
      title: t.hint,
      onclick: () => { set(t.id); announce(`${t.label} theme`); },
    }, t.label)),
  );
  return wrap;
}

let liveRegion = null;
export function announce(msg) {
  if (!liveRegion) {
    liveRegion = h('div', { class: 'cs-sr', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(liveRegion);
  }
  liveRegion.textContent = '';
  // a repeat of the same string is not re-announced unless the node changes
  setTimeout(() => { liveRegion.textContent = msg; }, 30);
}

export function init() {
  apply(current());
  // if the reader has no explicit choice and their system contrast setting
  // changes underneath them, follow it
  matchMedia('(prefers-contrast: more)').addEventListener?.('change', () => {
    if (!stored()) apply(preferred());
  });
}
