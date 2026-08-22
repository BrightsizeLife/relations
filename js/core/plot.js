/* ─────────────────────────────────────────────────────────────────────────────
   plot.js — scales, axes and reusable marks, all emitted as scene items so the
   renderer in dom.js can tween them. Rescale an axis and the ticks slide.
   ───────────────────────────────────────────────────────────────────────────── */

import { ticks, tickLabel, clamp, S } from './dom.js';

/* ── shared <defs> ────────────────────────────────────────────────────────── */

const marker = (id, fill) => S('marker', {
  id, viewBox: '0 0 10 10', refX: 8, refY: 5,
  markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse',
}, S('path', { d: 'M0,0 L10,5 L0,10 z', fill }));

export const arrowDefs = () => [
  marker('arrowhead', 'var(--cs-muted)'),
  marker('arrowhead-warm', 'var(--cs-data-warm)'),
  marker('arrowhead-cyan', 'var(--cs-cyan)'),
  marker('arrowhead-green', 'var(--cs-data-green)'),
];

/** convert a pointer event into user-space SVG coordinates */
export function svgPoint(svg, evt) {
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX; pt.y = evt.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  return pt.matrixTransform(ctm.inverse());
}

/**
 * Make a scene item draggable. Give it to `on:` in a point spec.
 * `onMove(dataX, dataY)` receives coordinates already inverted through the frame.
 */
export function dragger(svg, f, onMove, { onEnd } = {}) {
  return {
    pointerdown(e) {
      e.preventDefault();
      e.target.setPointerCapture(e.pointerId);
      const move = ev => {
        const p = svgPoint(svg, ev);
        onMove(f.ix(p.x), f.iy(p.y));
      };
      const up = ev => {
        e.target.releasePointerCapture?.(ev.pointerId);
        svg.removeEventListener('pointermove', move);
        svg.removeEventListener('pointerup', up);
        svg.removeEventListener('pointercancel', up);
        onEnd && onEnd();
      };
      svg.addEventListener('pointermove', move);
      svg.addEventListener('pointerup', up);
      svg.addEventListener('pointercancel', up);
    },
  };
}

/** A plot frame: pixel box + linear scales in both directions. */
export function frame({ w = 640, h = 460, l = 62, r = 22, t = 26, b = 52 } = {}) {
  const f = {
    w, h, pad: { l, r, t, b },
    x0: l, x1: w - r, y0: h - b, y1: t,
    dx: [0, 1], dy: [0, 1],
    setX(lo, hi, padFrac = 0) {
      const s = (hi - lo) * padFrac;
      f.dx = [lo - s, hi + s];
      return f;
    },
    setY(lo, hi, padFrac = 0) {
      const s = (hi - lo) * padFrac;
      f.dy = [lo - s, hi + s];
      return f;
    },
    /** fit both domains to data with a margin */
    fit(xs, ys, padFrac = 0.08) {
      f.setX(Math.min(...xs), Math.max(...xs), padFrac);
      f.setY(Math.min(...ys), Math.max(...ys), padFrac);
      return f;
    },
    sx: v => f.x0 + ((v - f.dx[0]) / (f.dx[1] - f.dx[0])) * (f.x1 - f.x0),
    sy: v => f.y0 + ((v - f.dy[0]) / (f.dy[1] - f.dy[0])) * (f.y1 - f.y0),
    ix: px => f.dx[0] + ((px - f.x0) / (f.x1 - f.x0)) * (f.dx[1] - f.dx[0]),
    iy: py => f.dy[0] + ((py - f.y0) / (f.y1 - f.y0)) * (f.dy[1] - f.dy[0]),
    get midX() { return (f.x0 + f.x1) / 2; },
    get midY() { return (f.y0 + f.y1) / 2; },
  };
  return f;
}

/* ── axes ─────────────────────────────────────────────────────────────────── */

export function axes(f, {
  xLabel = '', yLabel = '', xN = 5, yN = 5, grid = true, prefix = 'ax',
  xFmt, yFmt, showX = true, showY = true, xTickVals, yTickVals, dur,
} = {}) {
  const out = [];
  const xt = xTickVals || ticks(f.dx[0], f.dx[1], xN);
  const yt = yTickVals || ticks(f.dy[0], f.dy[1], yN);
  const xStep = xt.length > 1 ? xt[1] - xt[0] : 1;
  const yStep = yt.length > 1 ? yt[1] - yt[0] : 1;

  out.push({
    key: prefix + '-xline', tag: 'line', cls: 'ax-line', dur,
    attrs: { x1: f.x0, y1: f.y0, x2: f.x1, y2: f.y0 },
  });
  out.push({
    key: prefix + '-yline', tag: 'line', cls: 'ax-line', dur,
    attrs: { x1: f.x0, y1: f.y0, x2: f.x0, y2: f.y1 },
  });

  if (showX) xt.forEach((v, i) => {
    const px = f.sx(v);
    if (px < f.x0 - 1 || px > f.x1 + 1) return;
    if (grid) out.push({
      key: `${prefix}-xg${i}`, tag: 'line', cls: 'ax-grid', dur,
      attrs: { x1: px, y1: f.y0, x2: px, y2: f.y1 },
    });
    out.push({
      key: `${prefix}-xt${i}`, tag: 'text', cls: 'ax-tick', dur,
      attrs: { x: px, y: f.y0 + 18 }, text: xFmt ? xFmt(v) : tickLabel(v, xStep),
    });
  });

  if (showY) yt.forEach((v, i) => {
    const py = f.sy(v);
    if (py > f.y0 + 1 || py < f.y1 - 1) return;
    if (grid) out.push({
      key: `${prefix}-yg${i}`, tag: 'line', cls: 'ax-grid', dur,
      attrs: { x1: f.x0, y1: py, x2: f.x1, y2: py },
    });
    out.push({
      key: `${prefix}-yt${i}`, tag: 'text', cls: 'ax-tick ax-tick-y', dur,
      attrs: { x: f.x0 - 10, y: py + 4 }, text: yFmt ? yFmt(v) : tickLabel(v, yStep),
    });
  });

  if (xLabel) out.push({
    key: prefix + '-xlab', tag: 'text', cls: 'ax-label', dur,
    attrs: { x: (f.x0 + f.x1) / 2, y: f.h - 10 }, text: xLabel,
  });
  if (yLabel) out.push({
    key: prefix + '-ylab', tag: 'text', cls: 'ax-label', dur,
    attrs: { x: 0, y: 0 },
    set: { transform: `translate(14 ${(f.y0 + f.y1) / 2}) rotate(-90)` },
    text: yLabel,
  });
  return out;
}

/* ── marks ────────────────────────────────────────────────────────────────── */

export function points(f, data, {
  key = 'p', r = 6, cls = 'pt', x = d => d.x, y = d => d.y, tip, fill, delay = 0,
  stagger = 0, dur, on, opacity = 1, idOf = (d, i) => i,
} = {}) {
  return data.map((d, i) => ({
    key: `${key}-${idOf(d, i)}`, tag: 'circle', dur,
    cls: typeof cls === 'function' ? cls(d, i) : cls,
    attrs: { cx: f.sx(x(d, i)), cy: f.sy(y(d, i)), r: typeof r === 'function' ? r(d, i) : r },
    set: fill ? { fill: typeof fill === 'function' ? fill(d, i) : fill } : undefined,
    tip: tip ? tip(d, i) : undefined,
    opacity: typeof opacity === 'function' ? opacity(d, i) : opacity,
    delay: delay + i * stagger,
    enter: { attrs: { r: 0 }, opacity: 0 },
    on,
  }));
}

export function hLine(f, v, { key = 'h', cls = 'rule', x0, x1, dur, tip, opacity = 1, delay = 0 } = {}) {
  return {
    key, tag: 'line', cls, dur, tip, opacity, delay,
    attrs: { x1: x0 ?? f.x0, y1: f.sy(v), x2: x1 ?? f.x1, y2: f.sy(v) },
    enter: { opacity: 0 },
  };
}

export function vLine(f, v, { key = 'v', cls = 'rule', y0, y1, dur, tip, opacity = 1, delay = 0 } = {}) {
  return {
    key, tag: 'line', cls, dur, tip, opacity, delay,
    attrs: { x1: f.sx(v), y1: y0 ?? f.y0, x2: f.sx(v), y2: y1 ?? f.y1 },
    enter: { opacity: 0 },
  };
}

export function label(key, x, y, text, { cls = 'lab', dur, anchor, delay = 0, opacity = 1, tip } = {}) {
  return {
    key, tag: 'text', cls, dur, delay, opacity, tip,
    attrs: { x, y }, text,
    set: anchor ? { 'text-anchor': anchor } : undefined,
    enter: { opacity: 0 },
  };
}

/** a value that animates in place, e.g. a running sum drawn on the canvas */
export function numLabel(key, x, y, v, { cls = 'lab', d = 2, pre = '', suf = '', dur, anchor, opacity = 1, delay = 0, fmt } = {}) {
  return {
    key, tag: 'text', cls, dur, opacity, delay,
    attrs: { x, y }, num: { v, d, pre, suf, fmt },
    set: anchor ? { 'text-anchor': anchor } : undefined,
    enter: { opacity: 0 },
  };
}

export function path(key, pts, { cls = 'curve', curve = false, close = false, dur, opacity = 1, delay = 0, tip, set } = {}) {
  return { key, tag: 'path', cls, pts, curve, close, dur, opacity, delay, tip, set, enter: { opacity: 0 } };
}

export function rect(key, x, y, w, hgt, { cls = 'bar', dur, opacity = 1, delay = 0, tip, set, on } = {}) {
  return {
    key, tag: 'rect', cls, dur, opacity, delay, tip, set, on,
    attrs: { x, y: Math.min(y, y + hgt), width: Math.max(0, w), height: Math.abs(hgt) },
    enter: { attrs: { height: 0, y: y }, opacity: 0 },
  };
}

/** sample a function across the frame's x-domain and return a smooth path */
export function fnPath(f, fn, { key = 'fn', cls = 'curve', n = 160, dur, opacity = 1, from, to, delay = 0, clip = true } = {}) {
  const a = from ?? f.dx[0], b = to ?? f.dx[1];
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const xv = a + ((b - a) * i) / n;
    const yv = fn(xv);
    if (!isFinite(yv)) continue;
    const py = f.sy(yv);
    if (clip && (py < f.y1 - 400 || py > f.y0 + 400)) continue;
    pts.push([f.sx(xv), clip ? clamp(py, f.y1 - 200, f.y0 + 200) : py]);
  }
  return path(key, pts, { cls, dur, opacity, delay });
}

/** filled area between a function and a baseline — used for every tail shading */
export function fnArea(f, fn, a, b, { key = 'area', cls = 'area', n = 90, base, dur, opacity = 1, delay = 0 } = {}) {
  const y0 = f.sy(base ?? f.dy[0]);
  const pts = [[f.sx(a), y0]];
  for (let i = 0; i <= n; i++) {
    const xv = a + ((b - a) * i) / n;
    pts.push([f.sx(xv), f.sy(fn(xv))]);
  }
  pts.push([f.sx(b), y0]);
  return path(key, pts, { cls, close: true, dur, opacity, delay });
}

/** histogram bars from stats.histogram() output */
export function histBars(f, bins, { key = 'hist', cls = 'bar', dur, useDensity = false, stagger = 0, tip, opacity = 1 } = {}) {
  return bins.map((b, i) => {
    const v = useDensity ? b.density : b.n;
    const y = f.sy(v), y0 = f.sy(0);
    const x = f.sx(b.x0), x1 = f.sx(b.x1);
    return {
      key: `${key}-${i}`, tag: 'rect', cls, dur, delay: i * stagger, opacity,
      tip: tip ? tip(b, i) : undefined,
      attrs: { x: x + 0.5, y, width: Math.max(0.5, x1 - x - 1), height: Math.max(0, y0 - y) },
      enter: { attrs: { y: y0, height: 0 }, opacity: 0 },
    };
  });
}

/** a dot-strip / jitter column, for group comparisons */
export function strip(f, values, xPos, { key = 's', r = 5, cls = 'pt', jitter = 14, seed = 1, dur, stagger = 0, tip, opacity = 1 } = {}) {
  let s = seed;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 - 0.5; };
  return values.map((v, i) => ({
    key: `${key}-${i}`, tag: 'circle', cls, dur, delay: i * stagger, opacity,
    attrs: { cx: xPos + rand() * jitter * 2, cy: f.sy(v), r },
    tip: tip ? tip(v, i) : undefined,
    enter: { attrs: { r: 0 }, opacity: 0 },
  }));
}

/** brace / bracket connecting two y positions — used to annotate spreads */
export function bracket(key, x, ya, yb, { cls = 'brace', width = 8, dur, opacity = 1, delay = 0 } = {}) {
  const pts = [[x - width, ya], [x, ya], [x, yb], [x - width, yb]];
  return path(key, pts, { cls, dur, opacity, delay });
}

/**
 * A decision surface: a grid of cells shaded by a function of (x, y).
 * `fn` returns a probability in [0,1]; 0 reads cold, 1 reads warm.
 */
export function surface(f, fn, { key = 'srf', n = 30, dur, opacity = 0.55, cold = [74, 144, 217], warm = [232, 89, 79] } = {}) {
  const items = [];
  const w = (f.x1 - f.x0) / n, h = (f.y0 - f.y1) / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const px = f.x0 + i * w, py = f.y1 + j * h;
      const p = clamp(fn(f.ix(px + w / 2), f.iy(py + h / 2)), 0, 1);
      const c = cold.map((v, k) => Math.round(v + (warm[k] - v) * p));
      items.push({
        key: `${key}-${i}-${j}`, tag: 'rect', dur: dur ?? 200,
        attrs: { x: px, y: py, width: w + 0.7, height: h + 0.7 },
        set: { fill: `rgb(${c[0]},${c[1]},${c[2]})`, stroke: 'none' },
        opacity: 0.12 + opacity * Math.abs(p - 0.5) * 2,
      });
    }
  }
  return items;
}

/** the p = ½ contour of a surface, traced by marching along each column */
export function boundary(f, fn, { key = 'bnd', n = 90, cls = 'curve curve-fit', dur } = {}) {
  const segs = [];
  for (let i = 0; i <= n; i++) {
    const xv = f.dx[0] + ((f.dx[1] - f.dx[0]) * i) / n;
    let prev = null;
    for (let j = 0; j <= n; j++) {
      const yv = f.dy[0] + ((f.dy[1] - f.dy[0]) * j) / n;
      const p = fn(xv, yv);
      if (prev !== null && (prev - 0.5) * (p - 0.5) < 0) {
        segs.push([f.sx(xv), f.sy(yv)]);
      }
      prev = p;
    }
  }
  return segs.map((pt, i) => ({
    key: `${key}-${i}`, tag: 'circle', cls, dur: dur ?? 200,
    attrs: { cx: pt[0], cy: pt[1], r: 1.6 },
    set: { fill: 'var(--cs-text-bright)', stroke: 'none' },
    opacity: 0.85,
  }));
}

export const COLORS = {
  warm: 'var(--cs-data-warm)',
  cold: 'var(--cs-data-cold)',
  gold: 'var(--cs-data-gold)',
  green: 'var(--cs-data-green)',
  cyan: 'var(--cs-cyan)',
  coral: 'var(--cs-coral)',
  amber: 'var(--cs-amber)',
  purple: 'var(--cs-purple)',
  lime: 'var(--cs-lime)',
  muted: 'var(--cs-muted)',
  dim: 'var(--cs-dim)',
  text: 'var(--cs-text)',
};

export const accentOf = i => `var(--cs-accent-${i % 5})`;
