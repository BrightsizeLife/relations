/* ─────────────────────────────────────────────────────────────────────────────
   bench.js — the workbench.

   The point of this module is continuity. A deviation is drawn as a rectangle
   from the moment it appears in the plot: a bar two pixels tall whose width is
   the deviation. Because it is always the same element with the same key, it
   can fly out of the plot, line up on a bench, and then grow its height until
   it is a square — and every one of those is a pure attribute tween rather
   than a cut to a new picture.

   That is what makes "a length becomes an area" something you watch happen
   instead of something you are told.
   ───────────────────────────────────────────────────────────────────────────── */

import { label, rect, path } from './plot.js';

/** where the bench sits on a 720×540 canvas */
export const BENCH = { y: 480, x0: 64, x1: 688, mid: 376, rows: [320, 480] };

/**
 * Slots for n items. Twelve squares side by side across 620 pixels would be
 * 47 pixels each, which is too small to feel like anything; two rows of six
 * makes them 120, which fills the canvas and reads as a real pile.
 */
export function slots(n, { x0 = BENCH.x0, x1 = BENCH.x1, gap = 6, rows = 2, rowY = BENCH.rows } = {}) {
  const per = Math.ceil(n / rows);
  const width = Math.max(6, (x1 - x0 - gap * (per - 1)) / per);
  return {
    width, per, rows,
    x: i => x0 + (i % per) * (width + gap),
    centre: i => x0 + (i % per) * (width + gap) + width / 2,
    baseY: i => rowY[Math.min(Math.floor(i / per), rowY.length - 1)],
    /** the scale that makes the largest deviation exactly fill a slot */
    scaleFor: maxAbs => (maxAbs > 0 ? width / maxAbs : 1),
  };
}

/** bench order: biggest first, purely so the pile is legible */
export function byMagnitude(values) {
  const order = values.map((v, i) => i).sort((a, b) => Math.abs(values[b]) - Math.abs(values[a]));
  const rank = new Array(values.length);
  order.forEach((idx, r) => { rank[idx] = r; });
  return rank;
}

/** the bench surface: a rule plus a caption */
export function surface({ y = BENCH.y, x0 = BENCH.x0, x1 = BENCH.x1, text, key = 'bench', tone = '' } = {}) {
  return [
    { key: key + '-rule', tag: 'line', cls: 'rule-faint', attrs: { x1: x0 - 6, y1: y + 3, x2: x1 + 6, y2: y + 3 } },
    text ? label(key + '-cap', (x0 + x1) / 2, y + 24, text, { cls: 'lab-sm lab-mid ' + tone }) : null,
  ].filter(Boolean);
}

/**
 * One deviation, in whatever state it is currently in.
 *
 * mode:
 *   'plot'   — lying in the scatter, anchored on the mean line
 *   'slot'   — extracted to its slot on the bench, still a thin bar
 *   'square' — grown upward until height equals width
 *   'chain'  — laid end to end with the others, to show the signed sum
 *   'merged' — collapsed onto the single average square
 */
export function devBar(i, v, opts) {
  const {
    key = 'dev', mode, k, sl, cls = '', slot,
    plotFrom, plotTo, plotY,          // pixel coords when mode === 'plot'
    chainX, mergeTo, thickness = 3, dur, delay, tip, opacity = 1,
  } = opts;
  const j = slot ?? i;
  const baseY = opts.baseY ?? (sl && sl.baseY ? sl.baseY(j) : BENCH.y);

  const len = Math.abs(v) * k;
  const warm = v >= 0;
  const tone = warm ? 'sq-pos' : 'sq-neg';

  let box;
  if (mode === 'plot') {
    box = {
      x: Math.min(plotFrom, plotTo), y: plotY - thickness / 2,
      width: Math.abs(plotTo - plotFrom), height: thickness,
    };
  } else if (mode === 'chain') {
    box = { x: Math.min(chainX, chainX + v * k), y: baseY - 13, width: len, height: 26 };
  } else if (mode === 'merged') {
    box = { x: mergeTo.x - mergeTo.side / 2, y: baseY - mergeTo.side, width: mergeTo.side, height: mergeTo.side };
  } else if (mode === 'square') {
    box = { x: sl.x(j), y: baseY - len, width: len, height: len };
  } else { // 'slot'
    box = { x: sl.x(j), y: baseY - thickness, width: len, height: thickness };
  }

  return {
    key: `${key}-${i}`, tag: 'rect', cls: `sq ${tone} ${cls}`.trim(),
    attrs: box, dur, delay, opacity, tip,
    enter: { attrs: { width: 0, height: thickness } },
  };
}

/** cumulative x positions for laying signed bars end to end */
export function chain(values, k, startX) {
  let x = startX;
  return values.map(v => { const at = x; x += v * k; return { at, end: x }; });
}

/**
 * A small badge naming which of the four repeated moves is happening.
 * Used to say "you have seen this one" without a paragraph.
 */
export const MOVES = [
  { n: 1, name: 'SUBTRACT', gloss: 'distance from the middle' },
  { n: 2, name: 'SQUARE', gloss: 'length becomes area' },
  { n: 3, name: 'ADD UP', gloss: 'total the pile' },
  { n: 4, name: 'DIVIDE', gloss: 'per free piece of information' },
];

export function moveBadge(n, { x = 64, y = 44, key = 'move', reused = false, dur } = {}) {
  const m = MOVES[n - 1];
  return [
    rect(`${key}-bg`, x, y - 15, 216, 22, { cls: 'cell', dur, opacity: reused ? 0.55 : 1 }),
    label(`${key}-n`, x + 10, y, `MOVE ${m.n}`, { cls: 'lab-sm lab-gold', dur }),
    label(`${key}-t`, x + 74, y, m.name, { cls: 'lab-sm lab-cyan', dur }),
    label(`${key}-r`, x + 226, y, reused ? 'again' : 'new', {
      cls: `lab-sm ${reused ? 'lab-muted' : 'lab-green'}`, dur,
    }),
  ];
}
