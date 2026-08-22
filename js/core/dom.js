/* ─────────────────────────────────────────────────────────────────────────────
   dom.js — element helpers, a tiny tween engine, and a keyed SVG scene renderer.

   The scene renderer is the whole trick behind this site. A lesson step doesn't
   "draw"; it *declares* what should exist right now as a list of keyed items.
   The renderer diffs against what's on screen and tweens the difference. So a
   point that exists in step 4 and step 5 slides between them for free, and
   every lesson gets continuity animation without writing a single transition.
   ───────────────────────────────────────────────────────────────────────────── */

const NS = 'http://www.w3.org/2000/svg';

/* ── element construction ─────────────────────────────────────────────────── */

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  applyProps(el, attrs);
  append(el, kids);
  return el;
}

export function S(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(NS, tag);
  applyProps(el, attrs, true);
  append(el, kids);
  return el;
}

function applyProps(el, attrs, isSvg) {
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style' && typeof v === 'object') setStyle(el, v);
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (!isSvg && (k === 'value' || k === 'checked' || k === 'disabled')) el[k] = v;
    else el.setAttribute(k, v);
  }
}

/**
 * Custom properties are invisible to Object.assign(el.style, …) — the assignment
 * silently does nothing — so they have to go through setProperty. This was
 * quietly collapsing every --accent override to its default.
 */
export function setStyle(el, obj) {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (k.startsWith('--')) el.style.setProperty(k, String(v));
    else el.style[k] = v;
  }
}

function append(el, kids) {
  for (const k of kids.flat(4)) {
    if (k == null || k === false) continue;
    el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];
export const clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

/* ── tween engine ─────────────────────────────────────────────────────────── */

const running = new Set();
let ticking = false;

export const ease = {
  out: t => 1 - (1 - t) ** 3,
  inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  linear: t => t,
  back: t => { const c = 1.70158 + 1; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
  elastic: t => (t === 0 || t === 1) ? t
    : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
};

function tick(now) {
  for (const tw of [...running]) {
    if (now < tw.start) continue;
    const t = tw.dur <= 0 ? 1 : Math.min(1, (now - tw.start) / tw.dur);
    tw.step(tw.easing(t), t);
    if (t >= 1) { running.delete(tw); tw.done && tw.done(); }
  }
  if (running.size) requestAnimationFrame(tick);
  else ticking = false;
}

export function tween({ dur = 600, delay = 0, easing = ease.out, step, done }) {
  const tw = { start: performance.now() + delay, dur, easing, step, done };
  running.add(tw);
  if (!ticking) { ticking = true; requestAnimationFrame(tick); }
  return () => running.delete(tw);
}

/** stop everything — used when a lesson unmounts mid-animation */
export function stopAllTweens() { running.clear(); }

const lerp = (a, b, t) => a + (b - a) * t;

/* ── number readouts ──────────────────────────────────────────────────────── */

const numState = new WeakMap();

/**
 * Animate a DOM element's text from its current number to a new one, and flash
 * it if it actually moved. This is the "call out where things change" rule.
 */
export function setNum(el, value, { d = 2, pre = '', suf = '', dur = 450, flash = true, fmt } = {}) {
  if (!el) return;
  const prev = numState.get(el);
  const from = prev == null ? value : prev;
  numState.set(el, value);
  const render = v => {
    el.textContent = pre + (fmt ? fmt(v) : (isFinite(v) ? v.toFixed(d) : '—')) + suf;
  };
  if (!isFinite(value) || !isFinite(from) || Math.abs(value - from) < 1e-12) { render(value); return; }
  if (flash) {
    el.classList.remove('cs-flash');
    void el.offsetWidth;
    el.classList.add('cs-flash', value > from ? 'cs-flash-up' : 'cs-flash-down');
    setTimeout(() => el.classList.remove('cs-flash', 'cs-flash-up', 'cs-flash-down'), 700);
  }
  tween({ dur, step: t => render(lerp(from, value, t)) });
}

/* ── path builders ────────────────────────────────────────────────────────── */

export function polyPath(pts, close = false) {
  if (!pts.length) return '';
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) d += `L${pts[i][0].toFixed(2)},${pts[i][1].toFixed(2)}`;
  return close ? d + 'Z' : d;
}

/** Catmull–Rom → cubic bezier. Smooth curves without a dependency. */
export function curvePath(pts, close = false) {
  if (pts.length < 3) return polyPath(pts, close);
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return close ? d + 'Z' : d;
}

/* ── the scene renderer ───────────────────────────────────────────────────── */

const NUMERIC_ATTRS = new Set([
  'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'width', 'height', 'stroke-width', 'font-size', 'stroke-dashoffset', 'fill-opacity',
  'stroke-opacity', 'opacity',
]);

/**
 * Create a scene bound to an SVG <g>. Call `update(items)` with the full list
 * of what should be on screen. Anything missing fades out, anything new fades
 * in, anything shared tweens.
 */
export function makeScene(parent) {
  const nodes = new Map();

  function create(item) {
    const el = document.createElementNS(NS, item.tag);
    if (item.cls) el.setAttribute('class', item.cls);
    const rec = { el, tag: item.tag, cur: {}, pts: null, num: null, tweens: [] };
    nodes.set(item.key, rec);
    parent.appendChild(el);
    return rec;
  }

  function writeAttrs(rec, vals) {
    for (const [k, v] of Object.entries(vals)) {
      rec.el.setAttribute(k, typeof v === 'number' ? +v.toFixed(3) : v);
    }
  }

  function writePts(rec, flat, item) {
    const pts = [];
    for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
    const d = item.curve ? curvePath(pts, item.close) : polyPath(pts, item.close);
    rec.el.setAttribute('d', d);
  }

  function stop(rec) { rec.tweens.forEach(k => k()); rec.tweens = []; }

  return {
    /** items: array of scene specs. Returns nothing; call every render. */
    update(items, opts = {}) {
      const dur = opts.dur ?? 620;
      const seen = new Set();

      items.forEach(item => {
        if (!item) return;
        seen.add(item.key);
        let rec = nodes.get(item.key);
        const isNew = !rec || rec.tag !== item.tag;
        if (rec && rec.tag !== item.tag) { rec.el.remove(); nodes.delete(item.key); rec = null; }
        if (!rec) rec = create(item);
        else stop(rec);

        const d = item.dur ?? dur;
        const delay = item.delay ?? 0;

        if (item.cls != null && rec.el.getAttribute('class') !== item.cls) rec.el.setAttribute('class', item.cls);
        if (item.set) for (const [k, v] of Object.entries(item.set)) {
          if (v == null) rec.el.removeAttribute(k); else rec.el.setAttribute(k, v);
        }
        if (item.style) setStyle(rec.el, item.style);
        if (item.tip != null) rec.el.setAttribute('data-tip', item.tip); else rec.el.removeAttribute('data-tip');
        if (item.on) for (const [ev, fn] of Object.entries(item.on)) {
          const key = '__on' + ev;
          if (rec[key]) rec.el.removeEventListener(ev, rec[key]);
          rec[key] = fn;
          rec.el.addEventListener(ev, fn);
        }
        if (item.text != null && item.num == null) rec.el.textContent = item.text;

        const attrs = item.attrs || {};
        const from = isNew ? { ...attrs, ...(item.enter?.attrs || {}) } : { ...rec.cur };
        const numKeys = Object.keys(attrs).filter(k => NUMERIC_ATTRS.has(k) && typeof attrs[k] === 'number');
        const staticAttrs = Object.fromEntries(Object.entries(attrs).filter(([k]) => !numKeys.includes(k)));
        writeAttrs(rec, staticAttrs);

        // opacity: fade in from enter value, otherwise track target
        const targetOp = item.opacity ?? 1;
        const fromOp = isNew ? (item.enter?.opacity ?? 0) : (rec.cur.__op ?? targetOp);

        const startVals = {};
        numKeys.forEach(k => { startVals[k] = from[k] ?? attrs[k]; });

        const flatTo = item.pts ? item.pts.flat() : null;
        const flatFrom = item.pts
          ? (isNew ? (item.enter?.pts ? item.enter.pts.flat() : flatTo) : (rec.pts || flatTo))
          : null;
        const numFrom = item.num ? (isNew ? (item.num.from ?? item.num.v) : (rec.num ?? item.num.v)) : null;

        const paint = t => {
          const vals = {};
          numKeys.forEach(k => { vals[k] = lerp(startVals[k], attrs[k], t); });
          vals.opacity = lerp(fromOp, targetOp, t);
          writeAttrs(rec, vals);
          if (flatTo) {
            const cur = flatTo.map((v, i) => lerp(flatFrom[i] ?? v, v, t));
            writePts(rec, cur, item);
          }
          if (item.num) {
            const v = lerp(numFrom, item.num.v, t);
            rec.el.textContent = (item.num.pre || '') +
              (item.num.fmt ? item.num.fmt(v) : v.toFixed(item.num.d ?? 2)) + (item.num.suf || '');
          }
        };

        if (d <= 0 && delay <= 0) { paint(1); }
        else {
          paint(0);
          rec.tweens.push(tween({
            dur: d, delay, easing: item.easing || ease.out, step: paint,
          }));
        }

        rec.cur = { ...attrs, __op: targetOp };
        if (flatTo) rec.pts = flatTo;
        if (item.num) rec.num = item.num.v;
      });

      // exit
      for (const [key, rec] of [...nodes]) {
        if (seen.has(key)) continue;
        stop(rec);
        nodes.delete(key);
        const start = parseFloat(rec.el.getAttribute('opacity') ?? 1);
        tween({
          dur: 260, step: t => rec.el.setAttribute('opacity', (start * (1 - t)).toFixed(3)),
          done: () => rec.el.remove(),
        });
      }
    },
    clear() {
      nodes.forEach(rec => { stop(rec); rec.el.remove(); });
      nodes.clear();
    },
    node: key => nodes.get(key)?.el,
  };
}

/* ── misc ─────────────────────────────────────────────────────────────────── */

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const range = n => Array.from({ length: n }, (_, i) => i);
export const nice = (v, step) => Math.round(v / step) * step;

/** turn "1.2e-7" style output into something a person can read on an axis */
export function tickLabel(v, step) {
  const dec = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)));
  return v.toFixed(dec);
}

/** pick ~n round tick values covering [lo,hi] */
export function ticks(lo, hi, n = 5) {
  const span = hi - lo;
  if (!isFinite(span) || span <= 0) return [lo];
  const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const stepN = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  const step = stepN * mag;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toFixed(10));
  return out.length ? out : [lo, hi];
}
