/* ─────────────────────────────────────────────────────────────────────────────
   correlation.js — the flagship. Pearson's r, drawn from an empty pair of axes
   all the way to a p-value and a confidence interval, one micro-step at a time.

   Everything downstream (regression, t-tests, the whole GLM family) reuses the
   pieces built here: deviations, squares, sums of products.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, fnArea, arrowDefs, dragger, COLORS } from '../core/plot.js';
import { BENCH, slots, byMagnitude, surface, devBar, chain, moveBadge } from '../core/bench.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sqrt, sub, sup, bar, sumOver, paren, devX, devY, nMinus1, eq, minus, times, inline, op } from '../core/fx.js';

/* ── the data ─────────────────────────────────────────────────────────────── */

/* First 12 rows of R's `faithful`: eruption length and the wait that followed. */
const FAITHFUL = [
  [3.600, 79], [1.800, 54], [3.333, 74], [2.283, 62], [4.533, 85], [2.883, 55],
  [4.700, 88], [3.600, 85], [1.950, 51], [4.350, 85], [1.833, 54], [3.917, 84],
];

/* A monotone-but-bent relationship, for the ordinal step. */
const CURVED = (() => {
  const r = st.rng(11);
  return range(12).map(i => {
    const x = 1.6 + (i * 3.3) / 11;
    return [+x.toFixed(3), +(38 + 52 * Math.pow((x - 1.6) / 3.3, 3.1) + st.randNorm(r, 0, 1.6)).toFixed(1)];
  });
})();

/* Same clean relationship plus one point that fell off a cliff. */
const OUTLIER = [...FAITHFUL.slice(0, 11), [4.6, 44]];

const DATASETS = { faithful: FAITHFUL, curved: CURVED, outlier: OUTLIER };

const XLAB = { faithful: 'eruption length', curved: 'dose', outlier: 'eruption length' };

function D(s) {
  const k = s.yUnit === 'sec' ? 60 : 1;
  const x = s.pts.map(p => p[0]);
  const y = s.pts.map(p => p[1] * k);
  return {
    x, y, n: x.length,
    mx: st.mean(x), my: st.mean(y),
    sx: st.sd(x), sy: st.sd(y),
    cov: st.covariance(x, y), r: st.pearson(x, y),
    unit: s.yUnit === 'sec' ? 'sec' : 'min',
  };
}

const F = () => frame({ w: 720, h: 540, l: 66, r: 28, t: 34, b: 58 });

function fitted(s) {
  const d = D(s);
  const f = F();
  f.fit(d.x, d.y, 0.12);
  return { f, d };
}

/* ── shared marks ─────────────────────────────────────────────────────────── */

function scatter(s, f, d, ctx, { cls = 'pt pt-drag', opacity = 1, stagger = 0, delay = 0, upTo = 99, r = 6.5 } = {}) {
  return points(f, s.pts.slice(0, upTo), {
    key: 'p', r, cls, delay, stagger, opacity,
    x: p => p[0], y: p => p[1] * (s.yUnit === 'sec' ? 60 : 1),
    tip: (p, i) => `<b>#${i + 1}</b><br>x = ${p[0].toFixed(3)} min<br>y = ${(p[1] * (s.yUnit === 'sec' ? 60 : 1)).toFixed(0)} ${d.unit}` +
      `<br><span class="warm">x − x̄ = ${(p[0] - d.mx).toFixed(3)}</span>` +
      `<br><span class="cold">y − ȳ = ${(p[1] * (s.yUnit === 'sec' ? 60 : 1) - d.my).toFixed(2)}</span>`,
    on: dragger(ctx.svg, f, (nx, ny) => {
      const i = s.__drag;
      if (i == null) return;
      s.pts[i] = [clamp(nx, f.dx[0], f.dx[1]), clamp(ny, f.dy[0], f.dy[1]) / (s.yUnit === 'sec' ? 60 : 1)];
      ctx.refresh();
    }),
    idOf: (p, i) => i,
  }).map((it, i) => ({
    ...it,
    on: {
      ...it.on,
      pointerdown: e => { s.__drag = i; it.on.pointerdown(e); },
    },
  }));
}


/* ── the deviation bench ──────────────────────────────────────────────────────
   A deviation is a rectangle from the moment it appears: a bar three pixels
   tall lying in the plot. The same element, same key, then flies to the bench
   and grows its height until it is a square. Nothing is ever redrawn, so the
   reader watches one object change rather than one picture replace another. */

/** the plot, squeezed into the top half so the bench has somewhere to stand */
function topFrame(s) {
  const d = D(s);
  const f = frame({ w: 720, h: 540, l: 66, r: 28, t: 30, b: 306 });
  f.fit(d.x, d.y, 0.12);
  return { f, d };
}

const yOf = (s, i) => s.pts[i][1] * (s.yUnit === 'sec' ? 60 : 1);
const xraw = s => D(s).x;
const xdev = s => { const d = D(s); return d.x.map(v => v - d.mx); };
const ydev = s => { const d = D(s); return d.y.map(v => v - d.my); };

const devBarX = (i, v, o) => devBar(i, v, { key: 'dx', cls: 'link-devx', ...o });
const devBarY = (i, v, o) => devBar(i, v, { key: 'dy', cls: 'link-devy', ...o });

/** everything a bench beat needs: slots, the common scale, and the sort order */
function benchFor(devs, opts = {}) {
  const sl = slots(devs.length, opts);
  return { sl, k: sl.scaleFor(Math.max(...devs.map(Math.abs))), rank: byMagnitude(devs) };
}

/** the x deviations while they are still lying in the scatter */
function devsX(s, f, d, { only = null, stagger = 0 } = {}) {
  const devs = xdev(s);
  const sl = slots(devs.length);
  return devs.map((v, i) => (only != null && i !== only ? null : devBarX(i, v, {
    mode: 'plot', k: 1, sl, delay: i * stagger,
    plotFrom: f.sx(d.mx), plotTo: f.sx(s.pts[i][0]), plotY: f.sy(yOf(s, i)),
    tip: `x − x̄ = <b>${v.toFixed(3)}</b>`,
  }))).filter(Boolean);
}

/** the same thing for y — vertical in the plot, identical on the bench */
function devsY(s, f, d, { only = null, stagger = 0 } = {}) {
  const devs = ydev(s);
  const sl = slots(devs.length);
  return devs.map((v, i) => (only != null && i !== only ? null : {
    ...devBarY(i, v, { mode: 'slot', k: 1, sl }),
    attrs: {
      x: f.sx(s.pts[i][0]) - 1.5, y: Math.min(f.sy(d.my), f.sy(yOf(s, i))),
      width: 3, height: Math.abs(f.sy(yOf(s, i)) - f.sy(d.my)),
    },
    delay: i * stagger,
    tip: `y − ȳ = <b>${v.toFixed(2)}</b>`,
  })).filter(Boolean);
}

const axesFor = (f, s, d, o = {}) => axes(f, {
  xLabel: `${XLAB[s.dataset]} — minutes`,
  yLabel: `wait to next — ${d.unit}`,
  ...o,
});

/**
 * Nudge labels apart when their anchor points nearly coincide. The geyser data
 * has two eruptions at almost the same coordinates, and without this their
 * numbers print on top of each other.
 */
function declutter(anchors, { dx = 46, dy = 13, step = 12 } = {}) {
  const placed = [];
  return anchors.map(a => {
    let y = a.y, tries = 0;
    while (tries < 6 && placed.some(p => Math.abs(p.x - a.x) < dx && Math.abs(p.y - y) < dy)) {
      y = a.y + (tries % 2 ? 1 : -1) * step * Math.ceil((tries + 1) / 2);
      tries++;
    }
    placed.push({ x: a.x, y });
    return y;
  });
}

/** a row of squares sitting on a baseline, areas drawn to one common scale */
function squareRow(devs, { key, cls, baseY, x0, x1, mergeTo = null, k, labelEach = false, dur }) {
  const sides = devs.map(v => Math.abs(v) * k);
  const gap = 4;
  const total = sides.reduce((a, b) => a + b, 0) + gap * (devs.length - 1);
  let cx = x0 + Math.max(0, ((x1 - x0) - total) / 2);
  const out = [];
  devs.forEach((v, i) => {
    const side = sides[i];
    const x = mergeTo ? mergeTo.x - mergeTo.side / 2 : cx;
    const sd = mergeTo ? mergeTo.side : side;
    out.push({
      key: `${key}-${i}`, tag: 'rect', cls, dur,
      attrs: { x, y: baseY - sd, width: sd, height: sd },
      opacity: mergeTo ? (i === 0 ? 1 : 0.16) : 1,
      tip: `(${v >= 0 ? '' : '−'}${Math.abs(v).toFixed(3)})² = <b>${(v * v).toFixed(4)}</b>`,
      enter: { attrs: { y: baseY, width: 0, height: 0 } },
    });
    if (labelEach && side > 22) out.push(label(`${key}-l-${i}`, cx + side / 2, baseY - side / 2 + 3,
      (v * v).toFixed(2), { cls: 'lab-sm lab-mid', dur }));
    cx += side + gap;
  });
  return out;
}

/* ── steps ────────────────────────────────────────────────────────────────── */

const RO = {
  n: { key: 'n', label: 'n', get: s => D(s).n, d: 0 },
  mx: { key: 'mx', label: 'x̄', tone: 'cyan', get: s => D(s).mx, d: 3, link: 'meanx' },
  my: { key: 'my', label: 'ȳ', tone: 'purple', get: s => D(s).my, d: 2, link: 'meany' },
  sx: { key: 'sx', label: 's<sub>x</sub>', tone: 'cyan', get: s => D(s).sx, d: 3 },
  sy: { key: 'sy', label: 's<sub>y</sub>', tone: 'purple', get: s => D(s).sy, d: 2 },
  cov: { key: 'cov', label: 'cov(x,y)', tone: 'gold', get: s => D(s).cov, d: 3, wide: true },
  r: { key: 'r', label: 'r', tone: 'green', get: s => D(s).r, d: 3, fmt: v => st.fmtR(v, 3) },
  r2: { key: 'r2', label: 'r²', tone: 'green', get: s => D(s).r ** 2, d: 3, fmt: v => st.fmtR(v, 3) },
};

export default {
  meta: {
    id: 'correlation',
    title: 'correlation',
    kicker: 'PEARSON r · START HERE',
    order: 1,
    status: 'live',
    blurb: 'Two columns of numbers, one number out. Every piece of machinery on this site is bolted together here first.',
    deck: 'Everything else on this site is assembled out of the parts we build in this lesson: a mean, a deviation, a squared deviation, and a sum of products. Learn those four moves and you have already done most of the work for regression, t-tests, ANOVA and the rest.',
    dataNote: 'Data: the first 12 eruptions of the <em>faithful</em> dataset (Old Faithful geyser, Yellowstone) as shipped with R — eruption length in minutes, and the wait until the next eruption. Every number on this page is computed in your browser from these 12 rows. Drag a point and watch all of them move.',
    deps: [],
    unlocks: ['linreg', 'ttest'],
    next: 'ttest',
    nextLabel: 't-tests',
    outro: 'r, r², t, p and a confidence interval — all of it out of twelve pairs of numbers and four repeated moves.',
  },

  canvas: { w: 720, h: 540 },
  defs: arrowDefs,

  state: {
    dataset: 'faithful',
    pts: FAITHFUL.map(p => [...p]),
    yUnit: 'min',
    showQuad: false,
    morph: false,
    rTarget: 0.8,
    nHypo: 12,
    conf: 95,
    ranked: false,
  },

  steps: [

    /* ── 1 ─────────────────────────────────────────────────────────────── */
    {
      title: 'two axes and nothing on them',
      prose: `<p>Start with the emptiest thing in statistics: a plane. One direction for one measurement, another direction for a second measurement.</p>
        <p>That's the whole setup. A correlation is a claim about whether knowing where you are along the bottom tells you anything about how high up you'll be.</p>`,
      readouts: [],
      beats: [
        {
          label: 'the horizontal',
          note: 'One axis. A number line. Nothing has happened yet.',
          scene: () => {
            const f = F();
            return [
              { key: 'xl', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x1, y2: f.y0 } },
              label('xlab', f.midX, f.y0 + 30, 'x', { cls: 'ax-label' }),
            ];
          },
        },
        {
          label: 'the vertical',
          note: 'A second axis, at a right angle. Now a pair of numbers has somewhere to sit.',
          scene: () => {
            const f = F();
            return [
              { key: 'xl', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x1, y2: f.y0 } },
              { key: 'yl', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x0, y2: f.y1 } },
              label('xlab', f.midX, f.y0 + 30, 'x', { cls: 'ax-label' }),
              label('ylab', f.x0 - 40, f.midY, 'y', { cls: 'ax-label' }),
            ];
          },
        },
        {
          label: 'one point',
          note: 'Any pair of numbers is one dot. Twelve pairs will be twelve dots.',
          scene: () => {
            const f = F();
            return [
              { key: 'xl', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x1, y2: f.y0 } },
              { key: 'yl', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x0, y2: f.y1 } },
              label('xlab', f.midX, f.y0 + 30, 'x', { cls: 'ax-label' }),
              label('ylab', f.x0 - 40, f.midY, 'y', { cls: 'ax-label' }),
              { key: 'demo', tag: 'circle', cls: 'pt', attrs: { cx: f.midX, cy: f.midY, r: 7 } },
              { key: 'dx', tag: 'line', cls: 'rule-faint rule-dash', attrs: { x1: f.midX, y1: f.midY, x2: f.midX, y2: f.y0 } },
              { key: 'dy', tag: 'line', cls: 'rule-faint rule-dash', attrs: { x1: f.midX, y1: f.midY, x2: f.x0, y2: f.midY } },
              label('demol', f.midX + 14, f.midY - 10, '(x, y)', { cls: 'lab' }),
            ];
          },
        },
      ],
    },

    /* ── 2 ─────────────────────────────────────────────────────────────── */
    {
      title: 'give the axes real names',
      prose: `<p><em>x</em> and <em>y</em> are placeholders, and placeholders make it easy to fool yourself. So let's use something real and physical: <strong>Old Faithful</strong>.</p>
        <p>Along the bottom: how long an eruption lasted. Up the side: how long you then had to wait for the next one.</p>
        <p>There's a mechanism here — a bigger eruption drains more of the underground reservoir, so it takes longer to refill. That's what makes this a good first correlation: there is something real underneath it, and we can check whether the arithmetic agrees.</p>`,
      aside: `<b>Why this matters.</b> A correlation coefficient does not know what your variables are. It will happily report r = .81 for ice cream sales and drowning deaths. Naming the axes is not decoration; it's the step where you take responsibility for what the number means.`,
      readouts: [],
      beats: [
        {
          label: 'name x',
          note: 'The horizontal axis is now <b>eruption length</b>, in minutes.',
          scene: s => {
            const { f } = fitted(s);
            return [
              ...axes(f, { xLabel: 'eruption length — minutes', yLabel: 'y', grid: false, showY: false }),
            ];
          },
        },
        {
          label: 'name y',
          note: 'The vertical axis is the <b>wait until the next eruption</b>, also in minutes.',
          scene: s => {
            const { f, d } = fitted(s);
            return [...axesFor(f, s, d, { grid: false })];
          },
        },
        {
          label: 'a scale to stand on',
          note: 'Ticks and gridlines. Now the plane has units, and a dot means something.',
          scene: s => {
            const { f, d } = fitted(s);
            return [
              ...axesFor(f, s, d),
              label('note', f.midX, f.y1 + 6, 'Old Faithful · Yellowstone · 12 eruptions', { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
      ],
    },

    /* ── 3 ─────────────────────────────────────────────────────────────── */
    {
      title: 'drop in the data',
      prose: `<p>Twelve eruptions. Each dot is one visit to the geyser: how long it went, and how long until it went again.</p>
        <p><strong>Hover any dot</strong> to see its numbers. And from here on you can <strong>drag the dots</strong> — every quantity on this page recomputes live, so if you want to know what a statistic is <em>sensitive to</em>, grab a point and find out.</p>`,
      readouts: [RO.n, RO.mx, RO.my],
      controls: [
        { type: 'button', key: 'reset', label: '[reset the data]', action: s => { s.pts = DATASETS[s.dataset].map(p => [...p]); } },
      ],
      beats: [
        {
          label: 'one eruption',
          note: 'The first row of the table: a <b>3.6-minute</b> eruption, followed by a <b>79-minute</b> wait.',
          scene: (s, ctx) => {
            const { f, d } = fitted(s);
            return [
              ...axesFor(f, s, d),
              ...scatter(s, f, d, ctx, { upTo: 1 }),
              { key: 'g1', tag: 'line', cls: 'rule-faint rule-dash', attrs: { x1: f.sx(s.pts[0][0]), y1: f.sy(s.pts[0][1]), x2: f.sx(s.pts[0][0]), y2: f.y0 } },
              { key: 'g2', tag: 'line', cls: 'rule-faint rule-dash', attrs: { x1: f.sx(s.pts[0][0]), y1: f.sy(s.pts[0][1]), x2: f.x0, y2: f.sy(s.pts[0][1]) } },
              label('l1', f.sx(s.pts[0][0]) + 12, f.sy(s.pts[0][1]) - 10, '(3.6, 79)', { cls: 'lab' }),
            ];
          },
        },
        {
          label: 'four more',
          note: 'A pattern is already suggesting itself. Resist it for one more beat.',
          scene: (s, ctx) => {
            const { f, d } = fitted(s);
            return [...axesFor(f, s, d), ...scatter(s, f, d, ctx, { upTo: 5, stagger: 90 })];
          },
        },
        {
          label: 'all twelve',
          hold: 1500,
          note: 'Long eruptions sit up and to the right; short ones down and to the left. <b>That upward drift is the entire thing we are about to measure.</b>',
          scene: (s, ctx) => {
            const { f, d } = fitted(s);
            return [...axesFor(f, s, d), ...scatter(s, f, d, ctx, { stagger: 70 })];
          },
        },
      ],
    },

    /* ── 4 ─────────────────────────────────────────────────────────────── */
    {
      title: 'find the middle of x',
      prose: `<p>Before you can say a point is <em>high</em> or <em>low</em>, you need a place to measure from. That place is the mean.</p>
        <p>Add the twelve eruption lengths up, divide by twelve. That's it — the mean is the balance point of the numbers. Push a dot to the right and the balance point follows it.</p>`,
      formula: formula(
        `${t(bar('x'), { explain: 'x-bar: the mean of the x values.', link: 'meanx', tone: 'cyan' })} ${eq} ` +
        frac(sumOver(t(sub('x', 'i'), { explain: 'The i-th x value — one eruption length.', link: 'ptsx' }), { from: 'i=1', to: 'n' }),
          t('n', { explain: 'How many observations. Here, 12.', link: 'ptsx', tone: 'gold' })),
        { caption: 'add them all up, divide by how many' }),
      readouts: [RO.n, RO.mx],
      beats: [
        {
          label: 'drop to the axis',
          note: 'Ignore <b>y</b> completely for a moment. Slide every point straight down. Now it is just twelve numbers on a line.',
          scene: (s, ctx) => {
            const { f, d } = fitted(s);
            return [
              ...axesFor(f, s, d),
              ...scatter(s, f, d, ctx, { opacity: 0.22 }),
              ...s.pts.map((p, i) => ({
                key: `drop-${i}`, tag: 'line', cls: 'rule-faint rule-dash',
                attrs: { x1: f.sx(p[0]), y1: f.sy(p[1] * (s.yUnit === 'sec' ? 60 : 1)), x2: f.sx(p[0]), y2: f.y0 - 14 },
                delay: i * 45,
              })),
              ...s.pts.map((p, i) => ({
                key: `mark-${i}`, tag: 'circle', cls: 'pt pt-cyan link-ptsx',
                attrs: { cx: f.sx(p[0]), cy: f.y0 - 14, r: 5 }, delay: i * 45,
                tip: `x = <b>${p[0].toFixed(3)}</b>`,
              })),
            ];
          },
        },
        {
          label: 'balance them',
          note: 'Treat each number as a weight on a beam. The mean is the one place you can put the fulcrum and have it sit level.',
          scene: (s, ctx) => {
            const { f, d } = fitted(s);
            const mxp = f.sx(d.mx);
            return [
              ...axesFor(f, s, d),
              ...scatter(s, f, d, ctx, { opacity: 0.16 }),
              ...s.pts.map((p, i) => ({
                key: `mark-${i}`, tag: 'circle', cls: 'pt pt-cyan link-ptsx',
                attrs: { cx: f.sx(p[0]), cy: f.y0 - 14, r: 5 },
                tip: `x = <b>${p[0].toFixed(3)}</b>`,
              })),
              { key: 'beam', tag: 'line', cls: 'rule', attrs: { x1: f.x0, y1: f.y0 - 6, x2: f.x1, y2: f.y0 - 6 } },
              path('fulcrum', [[mxp - 11, f.y0 + 12], [mxp, f.y0 - 4], [mxp + 11, f.y0 + 12]],
                { cls: 'sq sq-x link-meanx', close: true }),
              numLabel('mxv', mxp, f.y0 + 34, d.mx, { cls: 'lab lab-cyan lab-mid link-meanx', d: 3, pre: 'x̄ = ' }),
            ];
          },
        },
        {
          label: 'draw the line',
          note: 'Stand that balance point up as a vertical line. Everything to its right is “above average”; everything to its left is “below”.',
          scene: (s, ctx) => {
            const { f, d } = fitted(s);
            return [
              ...axesFor(f, s, d),
              ...scatter(s, f, d, ctx),
              vLine(f, d.mx, { key: 'mx', cls: 'rule-x link-meanx', tip: `x̄ = <b>${d.mx.toFixed(3)}</b> min` }),
              numLabel('mxv', f.sx(d.mx), f.y1 - 8, d.mx, { cls: 'lab lab-cyan lab-mid link-meanx', d: 3, pre: 'x̄ = ' }),
            ];
          },
        },
      ],
    },

    /* ── 5 ─────────────────────────────────────────────────────────────── */
    {
      title: 'find the middle of y',
      prose: `<p>Exactly the same move, turned ninety degrees. Add the twelve waiting times, divide by twelve, draw the line.</p>
        <p>Now look at what the two lines did to the picture: they cut it into <strong>four quadrants</strong>. Upper right — longer eruption than average, longer wait than average. Lower left — shorter and shorter. Those two boxes are where a positive correlation lives.</p>`,
      formula: formula(
        `${t(bar('y'), { explain: 'y-bar: the mean of the y values.', link: 'meany', tone: 'purple' })} ${eq} ` +
        frac(sumOver(t(sub('y', 'i'), { explain: 'The i-th y value — one waiting time.', link: 'ptsy' })), 'n'),
        { caption: 'same recipe, different column' }),
      readouts: [RO.mx, RO.my],
      controls: [
        { type: 'toggle', key: 'showQuad', label: 'tint the quadrants', explain: 'Colour the four regions by what they say about the relationship.' },
      ],
      beats: [
        {
          label: 'the second mean',
          note: 'The horizontal line sits at <b>ȳ</b> — the balance point of the waiting times.',
          scene: (s, ctx) => {
            const { f, d } = fitted(s);
            return [
              ...axesFor(f, s, d), ...scatter(s, f, d, ctx),
              vLine(f, d.mx, { key: 'mx', cls: 'rule-x link-meanx' }),
              hLine(f, d.my, { key: 'my', cls: 'rule-y link-meany', tip: `ȳ = <b>${d.my.toFixed(2)}</b>` }),
              numLabel('myv', f.x0 + 6, f.sy(d.my) - 9, d.my, { cls: 'lab lab-purple link-meany', d: 2, pre: 'ȳ = ' }),
            ];
          },
        },
        {
          label: 'four rooms',
          hold: 1500,
          note: 'The crossing point <b>(x̄, ȳ)</b> is the centre of gravity of the whole cloud. Every calculation from here on is measured from that crossing.',
          scene: (s, ctx) => {
            const { f, d } = fitted(s);
            const mxp = f.sx(d.mx), myp = f.sy(d.my);
            const quad = s.showQuad ? [
              rect('q1', mxp, f.y1, f.x1 - mxp, myp - f.y1, { cls: 'sq sq-pos', opacity: 0.5 }),
              rect('q3', f.x0, myp, mxp - f.x0, f.y0 - myp, { cls: 'sq sq-pos', opacity: 0.5 }),
              rect('q2', f.x0, f.y1, mxp - f.x0, myp - f.y1, { cls: 'sq sq-neg', opacity: 0.5 }),
              rect('q4', mxp, myp, f.x1 - mxp, f.y0 - myp, { cls: 'sq sq-neg', opacity: 0.5 }),
              label('q1l', f.x1 - 8, f.y1 + 16, '+ +', { cls: 'lab-sm lab-warm lab-end' }),
              label('q3l', f.x0 + 8, f.y0 - 8, '− −', { cls: 'lab-sm lab-warm' }),
              label('q2l', f.x0 + 8, f.y1 + 16, '− +', { cls: 'lab-sm lab-cold' }),
              label('q4l', f.x1 - 8, f.y0 - 8, '+ −', { cls: 'lab-sm lab-cold lab-end' }),
            ] : [];
            return [
              ...axesFor(f, s, d), ...quad, ...scatter(s, f, d, ctx),
              vLine(f, d.mx, { key: 'mx', cls: 'rule-x link-meanx' }),
              hLine(f, d.my, { key: 'my', cls: 'rule-y link-meany' }),
              { key: 'ctr', tag: 'circle', cls: 'pt pt-green', attrs: { cx: mxp, cy: myp, r: 5.5 }, tip: `centre of the cloud<br>(<b>${d.mx.toFixed(2)}</b>, <b>${d.my.toFixed(1)}</b>)` },
              label('ctrl', mxp + 10, myp - 10, '(x̄, ȳ)', { cls: 'lab lab-green' }),
            ];
          },
        },
      ],
    },

    /* ── 6 ─────────────────────────────────────────────────────────────── */
    {
      title: 'how spread out is x?',
      prose: `<p>Here is the move the rest of statistics is built on, and it is worth going slowly.</p>
        <p>For one point, measure the <strong>distance from the mean</strong>. That distance is a <em>deviation</em>. Then lift it out of the picture and put it on a bench, because we are going to do arithmetic to it.</p>
        <p>The first thing that arithmetic reveals is a problem: the deviations always add up to exactly zero. That is what "balance point" means. So the raw distances cannot measure spread — they cancel.</p>
        <p>The fix is to <strong>square</strong> each one. Watch what squaring actually does: the bar keeps its length and grows a second dimension, so a <em>length</em> turns into an <em>area</em>. That is not a metaphor on this page. It is the same rectangle the whole way through.</p>`,
      aside: `<b>Why n − 1 and not n?</b> You already spent one piece of your data working out x̄. Once you know the mean and eleven of the deviations, the twelfth is forced — it has no freedom left. So you have n − 1 independent pieces of information, and dividing by n − 1 is what keeps the estimate honest rather than slightly too small.`,
      formula: formula(
        `${t(sup('s', '2') + sub('', 'x'), { explain: 'The sample variance of x: the average squared deviation.', tone: 'cyan' })} ${eq} ` +
        frac(sumOver(paren(devX()) + sup('', '2')), nMinus1()) +
        `${op('&nbsp;&nbsp;→&nbsp;&nbsp;')} ${t(sub('s', 'x'), { explain: 'The standard deviation: the square root of the variance, back in the original units (minutes).', tone: 'cyan' })} ${eq} ${sqrt(sup('s', '2'))}`,
        { caption: 'hover any piece of the formula — the drawing will answer' }),
      readouts: [RO.n, RO.mx, { key: 'ss', label: 'Σ(x−x̄)²', tone: 'gold', get: s => { const d = D(s); return st.sum(d.x.map(v => (v - d.mx) ** 2)); }, d: 3, wide: true }, { key: 'vx', label: 's²ₓ', tone: 'cyan', get: s => st.variance(D(s).x), d: 4 }, RO.sx],
      beats: [
        {
          label: 'one point',
          hold: 1400,
          note: 'Start with a single eruption. How far is it from <b>x̄</b>? Nothing else on the plot matters yet.',
          scene: (s, ctx) => {
            const { f, d } = fitted(s);
            const i = 0;
            return [
              ...axesFor(f, s, d),
              vLine(f, d.mx, { key: 'mx', cls: 'rule-x link-meanx' }),
              ...scatter(s, f, d, ctx, { opacity: (p, k) => (k === i ? 1 : 0.16) }),
              devsX(s, f, d, { mode: 'plot', only: i }),
              label('one', f.sx(s.pts[i][0]) + 12, f.sy(yOf(s, i)) - 14, 'this one', { cls: 'lab lab-gold' }),
            ];
          },
        },
        {
          label: 'measure it',
          hold: 1500,
          note: 'The bar reaches from the mean line out to the point. Its <b>length</b> is the deviation, and its direction is the sign.',
          scene: (s, ctx) => {
            const { f, d } = fitted(s);
            const i = 0, dev = s.pts[i][0] - d.mx;
            return [
              ...axesFor(f, s, d),
              vLine(f, d.mx, { key: 'mx', cls: 'rule-x link-meanx' }),
              ...scatter(s, f, d, ctx, { opacity: (p, k) => (k === i ? 1 : 0.16) }),
              devsX(s, f, d, { mode: 'plot', only: i }),
              label('num', (f.sx(d.mx) + f.sx(s.pts[i][0])) / 2, f.sy(yOf(s, i)) - 12,
                (dev >= 0 ? '+' : '−') + Math.abs(dev).toFixed(3), { cls: 'lab-big lab-mid lab-warm' }),
              label('expl', f.midX, f.y1 + 8, `${s.pts[i][0].toFixed(3)} − ${d.mx.toFixed(3)} = ${dev.toFixed(3)}`,
                { cls: 'lab lab-mid' }),
            ];
          },
        },
        {
          label: 'do it for all twelve',
          hold: 1600,
          note: 'The same measurement, eleven more times. <b>Hover any bar.</b>',
          scene: (s, ctx) => {
            const { f, d } = fitted(s);
            return [
              ...axesFor(f, s, d),
              vLine(f, d.mx, { key: 'mx', cls: 'rule-x link-meanx' }),
              ...scatter(s, f, d, ctx, { opacity: 0.55 }),
              devsX(s, f, d, { mode: 'plot', stagger: 55 }),
            ];
          },
        },
        {
          label: 'lift them out',
          hold: 2000,
          note: 'Take the twelve bars off the plot and stand them on a bench, longest to shortest is not needed — just side by side. <b>Nothing has been changed, only moved.</b>',
          scene: (s, ctx) => {
            const { f, d } = topFrame(s);
            const devs = xdev(s);
            const { sl, k, rank } = benchFor(devs);
            return [
              ...axesFor(f, s, d, { grid: false, xLabel: '' }),
              vLine(f, d.mx, { key: 'mx', cls: 'rule-x link-meanx' }),
              ...scatter(s, f, d, ctx, { opacity: 0.4, r: 4 }),
              ...moveBadge(1, { reused: false }),
              ...devs.map((v, i) => devBarX(i, v, { mode: 'slot', k, sl, slot: rank[i], delay: i * 70 })),
              ...devs.map((v, i) => label(`n-${i}`, sl.centre(rank[i]), sl.baseY(rank[i]) + 15,
                v.toFixed(2), { cls: `lab-sm lab-mid ${v >= 0 ? 'lab-warm' : 'lab-cold'}`, delay: i * 70 })),
              label('cap', 376, 528, 'sorted biggest first, purely so the pile is easy to read',
                { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
        {
          label: 'they cancel',
          hold: 2200,
          note: 'Lay the signed bars end to end. Warm reaches right, cold reaches left, and you finish exactly where you started. <b>Σ(xᵢ − x̄) = 0, always.</b>',
          scene: s => {
            const devs = xdev(s);
            // scale so the wandering chain fits the canvas, not so one bar does
            let run = 0, lo = 0, hi = 0;
            devs.forEach(v => { run += v; lo = Math.min(lo, run); hi = Math.max(hi, run); });
            const k = 540 / Math.max(hi - lo, 1e-6);
            const start = 90 - lo * k;
            const { sl } = benchFor(devs);
            const links = chain(devs, k, start);
            return [
              ...moveBadge(1, { reused: true }),
              ...surface({ y: 300, text: '' }),
              ...devs.map((v, i) => devBarX(i, v, {
                mode: 'chain', k, sl, baseY: 300, chainX: links[i].at, delay: i * 150,
              })),
              { key: 'start', tag: 'line', cls: 'rule-faint rule-dash', attrs: { x1: start, y1: 240, x2: start, y2: 360 } },
              { key: 'finish', tag: 'line', cls: 'rule-gold', attrs: { x1: links.at(-1).end, y1: 240, x2: links.at(-1).end, y2: 360 } },
              label('sl', start, 226, 'start', { cls: 'lab-sm lab-mid' }),
              label('fl', links.at(-1).end, 226, 'finish', { cls: 'lab-sm lab-mid lab-gold' }),
              label('zero', 376, 400, 'Σ (xᵢ − x̄) = 0', { cls: 'lab-big lab-mid' }),
              label('zero2', 376, 424, 'raw deviations cannot measure spread — they undo each other', { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
        {
          label: 'square the first one',
          hold: 2000,
          note: 'So square them. Watch the first bar: it keeps its width and <b>grows upward until its height matches</b>. A length has become an area, and the minus sign is gone.',
          scene: s => {
            const devs = xdev(s);
            const { sl, k, rank } = benchFor(devs);
            const first = rank.indexOf(0);   // whichever bar is longest
            return [
              ...moveBadge(2, { reused: false }),
              ...devs.map((v, i) => devBarX(i, v, { mode: i === first ? 'square' : 'slot', k, sl, slot: rank[i] })),
              label('lbl', sl.centre(0), sl.baseY(0) - Math.abs(devs[first]) * k - 14,
                `(${devs[first].toFixed(2)})² = ${(devs[first] ** 2).toFixed(3)}`, { cls: 'lab lab-big lab-mid lab-cyan' }),
              label('note', 376, 120, 'the side is the deviation · the area is the deviation squared', { cls: 'lab lab-mid' }),
              label('note2', 376, 528, 'take the longest bar first, so you can watch it happen', { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
        {
          label: 'square the rest',
          hold: 2000,
          note: 'Every bar grows into its own square. Big deviations become <b>very</b> big squares — that is squaring doing its job of punishing distance.',
          scene: s => {
            const devs = xdev(s);
            const { sl, k, rank } = benchFor(devs);
            return [
              ...moveBadge(2, { reused: true }),
              ...devs.map((v, i) => devBarX(i, v, { mode: 'square', k, sl, slot: rank[i], delay: rank[i] * 90 })),
              ...devs.map((v, i) => (Math.abs(v) * k > 30
                ? label(`a-${i}`, sl.centre(rank[i]), sl.baseY(rank[i]) - (Math.abs(v) * k) / 2 + 4,
                  (v * v).toFixed(2), { cls: 'lab-sm lab-mid', delay: rank[i] * 90 })
                : null)),
              label('cap', 376, 528, 'twelve squares · big deviations become very big squares', { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
        {
          label: 'add the areas',
          hold: 2200,
          note: 'Total the pile. The number counts up as each square joins it.',
          scene: s => {
            const devs = xdev(s);
            const { sl, k, rank } = benchFor(devs);
            const total = st.sum(devs.map(v => v * v));
            return [
              ...moveBadge(3, { reused: false }),
              ...devs.map((v, i) => devBarX(i, v, { mode: 'square', k, sl, slot: rank[i], delay: rank[i] * 110 })),
              numLabel('tot', 376, 130, total, {
                cls: 'lab-big lab-mid lab-gold', d: 3, pre: 'Σ (xᵢ − x̄)² = ',
                dur: devs.length * 110 + 400, from: 0,
              }),
              label('cap', 376, 156, 'the sum of squares — the raw material of every spread on this site',
                { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
        {
          label: 'take the average',
          hold: 2200,
          note: 'Collapse the pile into <b>one square of the same average area</b>. Divide by n − 1, not n. That average area is the <b>variance</b>.',
          scene: s => {
            const devs = xdev(s);
            const { sl, k, rank } = benchFor(devs);
            const v = st.variance(xraw(s));
            const side = Math.sqrt(v) * k;
            return [
              ...moveBadge(4, { reused: false }),
              ...devs.map((val, i) => devBarX(i, val, {
                mode: 'merged', k, sl, baseY: 470, mergeTo: { x: 376, side },
                opacity: rank[i] === 0 ? 1 : 0.13, delay: rank[i] * 40,
              })),
              numLabel('var', 376, 470 - side - 16, v, { cls: 'lab-big lab-mid lab-cyan', d: 4, pre: 's²ₓ = ' }),
              label('cap', 376, 470 - side - 38, 'one square, of the average area', { cls: 'lab-sm lab-mid' }),
              label('div', 376, 130, `${st.sum(devs.map(x => x * x)).toFixed(3)} ÷ ${devs.length - 1} = ${v.toFixed(4)}`,
                { cls: 'lab-big lab-mid lab-gold' }),
              label('div2', 376, 156, 'total area, shared out over the free pieces of information', { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
        {
          label: 'take the root',
          hold: 2000,
          note: 'Variance is in <b>minutes squared</b>, which nobody can picture. Take the square root — the <b>side</b> of that average square — and you are back in minutes.',
          scene: s => {
            const devs = xdev(s);
            const { sl, k, rank } = benchFor(devs);
            const v = st.variance(xraw(s));
            const side = Math.sqrt(v) * k;
            return [
              ...devs.map((val, i) => devBarX(i, val, {
                mode: 'merged', k, sl, baseY: 470, mergeTo: { x: 376, side }, opacity: rank[i] === 0 ? 1 : 0,
              })),
              { key: 'sideline', tag: 'line', cls: 'stick stick-x', attrs: { x1: 376 - side / 2, y1: 484, x2: 376 + side / 2, y2: 484 } },
              numLabel('sd', 376, 506, Math.sqrt(v), { cls: 'lab-big lab-mid lab-cyan', d: 3, pre: 'sₓ = ', suf: ' min' }),
              label('cap', 376, 470 - side - 16, 'area = variance', { cls: 'lab-sm lab-mid lab-muted' }),
              label('cap2', 376, 130, 'the side of the average square is the standard deviation', { cls: 'lab-big lab-mid' }),
            ];
          },
        },
        {
          label: 'carry it back',
          note: 'Put that length back on the plot as a band either side of x̄. Most eruptions live inside it. <b>Drag a point and every step you just watched re-runs.</b>',
          scene: (s, ctx) => {
            const { f, d } = fitted(s);
            return [
              ...axesFor(f, s, d),
              rect('band', f.sx(d.mx - d.sx), f.y1, f.sx(d.mx + d.sx) - f.sx(d.mx - d.sx), f.y0 - f.y1, { cls: 'sq sq-x' }),
              ...scatter(s, f, d, ctx),
              vLine(f, d.mx, { key: 'mx', cls: 'rule-x link-meanx' }),
              label('sdl', f.sx(d.mx), f.y1 - 8, `x̄ ± sₓ  =  ${d.mx.toFixed(2)} ± ${d.sx.toFixed(2)} min`,
                { cls: 'lab lab-cyan lab-mid' }),
            ];
          },
        },
      ],
    },

    /* ── 7 ─────────────────────────────────────────────────────────────── */
    {
      title: 'and how spread out is y?',
      prose: `<p>Nothing new happens in this step, and that is the whole point of it.</p>
        <p>The bench you just built does not care which column you feed it. Subtract, square, add up, divide — the same four moves, turned ninety degrees. Watch the apparatus stay identical while only the input changes.</p>
        <p>This is worth noticing because it is the last time we will build a spread from scratch. ANOVA, regression, t-tests: when they compute a variance, <em>this</em> is what they are doing.</p>`,
      formula: formula(
        `${t(sup('s', '2') + sub('', 'y'), { tone: 'purple', explain: 'The sample variance of y.' })} ${eq} ` +
        frac(sumOver(paren(devY()) + sup('', '2')), nMinus1()),
        { caption: 'same recipe, different column' }),
      readouts: [RO.my, { key: 'vy', label: 's²<sub>y</sub>', tone: 'purple', get: s => st.variance(D(s).y), d: 3 }, RO.sy],
      dep: { note: 'This is the same calculation the <b>t-test</b> uses to decide whether two group means differ.', lesson: 'ttest', label: 't-tests' },
      beats: [
        {
          label: 'turn the bars ninety degrees',
          hold: 1800,
          note: 'The bars now run from each point to the <b>ȳ</b> line instead. That is the only difference.',
          scene: (s, ctx) => {
            const { f, d } = fitted(s);
            return [
              ...axesFor(f, s, d),
              hLine(f, d.my, { key: 'my', cls: 'rule-y link-meany' }),
              ...scatter(s, f, d, ctx, { opacity: 0.55 }),
              devsY(s, f, d, { mode: 'plot', stagger: 55 }),
              ...moveBadge(1, { reused: true }),
            ];
          },
        },
        {
          label: 'the same bench',
          hold: 1900,
          note: 'Lifted out and stood side by side — <b>the identical bench</b>. If you did not know which column these came from, you could not tell.',
          scene: (s, ctx) => {
            const { f, d } = topFrame(s);
            const devs = ydev(s);
            const { sl, k, rank } = benchFor(devs);
            return [
              ...axesFor(f, s, d, { grid: false, xLabel: '' }),
              hLine(f, d.my, { key: 'my', cls: 'rule-y link-meany' }),
              ...scatter(s, f, d, ctx, { opacity: 0.4, r: 4 }),
              ...moveBadge(1, { reused: true }),
              ...devs.map((v, i) => devBarY(i, v, { mode: 'slot', k, sl, slot: rank[i], delay: i * 70 })),
              ...devs.map((v, i) => label(`n-${i}`, sl.centre(rank[i]), sl.baseY(rank[i]) + 15,
                v.toFixed(1), { cls: `lab-sm lab-mid ${v >= 0 ? 'lab-warm' : 'lab-cold'}`, delay: i * 70 })),
              label('cap', 376, 528, 'the identical bench, fed the other column', { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
        {
          label: 'square, add, divide',
          hold: 2100,
          note: 'All three remaining moves at once, because you have already watched each of them once. <b>Reuse is the reward for paying attention the first time.</b>',
          scene: s => {
            const devs = ydev(s);
            const { sl, k, rank } = benchFor(devs);
            const total = st.sum(devs.map(v => v * v));
            return [
              ...moveBadge(2, { reused: true }),
              ...devs.map((v, i) => devBarY(i, v, { mode: 'square', k, sl, slot: rank[i], delay: rank[i] * 80 })),
              numLabel('tot', 376, 130, total, {
                cls: 'lab-big lab-mid lab-gold', d: 1, pre: 'Σ (yᵢ − ȳ)² = ', dur: 1300, from: 0,
              }),
              label('cap', 376, 156, 'then ÷ 11, then square-rooted — exactly as before', { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
        {
          label: 'the two benches together',
          hold: 2000,
          note: 'Left: the spread of eruption lengths. Right: the spread of waiting times. <b>Same apparatus, two different columns.</b> They are not comparable yet — one is in minutes of eruption, the other in minutes of waiting — and fixing that is what the next few steps are about.',
          scene: s => {
            const dx = xdev(s), dy = ydev(s);
            const bx = benchFor(dx, { x0: 56, x1: 348, rows: 2, rowY: [300, 440] });
            const by = benchFor(dy, { x0: 388, x1: 684, rows: 2, rowY: [300, 440] });
            return [
              label('t1', 202, 110, 'x — eruption length', { cls: 'lab-big lab-mid lab-cyan' }),
              label('t2', 536, 110, 'y — waiting time', { cls: 'lab-big lab-mid lab-purple' }),
              ...dx.map((v, i) => devBarX(i, v, { mode: 'square', k: bx.k, sl: bx.sl, slot: bx.rank[i], delay: i * 45 })),
              ...dy.map((v, i) => devBarY(i, v, { mode: 'square', k: by.k, sl: by.sl, slot: by.rank[i], delay: i * 45 })),
              label('s1', 202, 476, `sₓ = ${D(s).sx.toFixed(3)} min`, { cls: 'lab lab-mid lab-cyan' }),
              label('s2', 536, 476, `s_y = ${D(s).sy.toFixed(2)} min`, { cls: 'lab lab-mid lab-purple' }),
              { key: 'divider', tag: 'line', cls: 'rule-faint', attrs: { x1: 368, y1: 100, x2: 368, y2: 480 } },
              label('note', 376, 512, 'identical machine · different input · different units', { cls: 'lab lab-mid' }),
            ];
          },
        },
      ],
    },

    /* ── 8 ─────────────────────────────────────────────────────────────── */
    {
      title: 'multiply the two deviations together',
      prose: `<p>Now the actual idea, and it uses both benches at once.</p>
        <p>Each point has an x-bar and a y-bar sitting on the bench. Stand them at right angles and they close into a <strong>rectangle</strong>. The area of that rectangle is the product of the two deviations.</p>
        <p>Watch the signs do the work. Above average on both → positive times positive → <span class="cs-datum-warm">positive</span>. Below average on both → negative times negative → <span class="cs-datum-warm">still positive</span>. One up and one down → <span class="cs-datum-cold">negative</span>.</p>
        <p>So each point casts a vote on one question: <em>do these two things move together?</em> Add up the votes, divide by n − 1, and you have the <strong>covariance</strong>.</p>`,
      formula: formula(
        `${t('cov(x, y)', { explain: 'Covariance: the average product of the two deviations.', tone: 'gold' })} ${eq} ` +
        frac(sumOver(paren(devX()) + times + paren(devY())), nMinus1()),
        { caption: 'each point votes; the votes are areas with a sign' }),
      readouts: [RO.mx, RO.my, RO.cov],
      controls: [
        { type: 'toggle', key: 'showQuad', label: 'tint the quadrants' },
      ],
      beats: [
        {
          label: 'one point, two bars',
          hold: 1800,
          note: 'Point #1 already has both of its deviations measured. They are sitting on the bench from the last two steps.',
          scene: s => {
            const dx = xdev(s), dy = ydev(s);
            const k = 150 / Math.max(...dx.map(Math.abs));
            const ky = 150 / Math.max(...dy.map(Math.abs));
            return [
              label('t', 376, 110, 'the two deviations of eruption #1', { cls: 'lab-big lab-mid' }),
              rect('bx', 250, 300, Math.abs(dx[0]) * k, 5, { cls: `sq ${dx[0] >= 0 ? 'sq-pos' : 'sq-neg'}` }),
              label('lx', 250, 288, `x − x̄ = ${dx[0].toFixed(2)}`, { cls: 'lab lab-cyan' }),
              rect('by', 250, 340, Math.abs(dy[0]) * ky, 5, { cls: `sq ${dy[0] >= 0 ? 'sq-pos' : 'sq-neg'}` }),
              label('ly', 250, 372, `y − ȳ = ${dy[0].toFixed(2)}`, { cls: 'lab lab-purple' }),
              label('n', 376, 430, 'two lengths, lying flat', { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
        {
          label: 'stand one of them up',
          hold: 1800,
          note: 'Rotate the y-bar ninety degrees so the two meet at a corner. Nothing about either length has changed.',
          scene: s => {
            const dx = xdev(s), dy = ydev(s);
            const k = 150 / Math.max(...dx.map(Math.abs));
            const ky = 150 / Math.max(...dy.map(Math.abs));
            const w = Math.abs(dx[0]) * k, h = Math.abs(dy[0]) * ky;
            return [
              label('t', 376, 110, 'stand the second one up', { cls: 'lab-big lab-mid' }),
              rect('bx', 250, 400, w, 5, { cls: `sq ${dx[0] >= 0 ? 'sq-pos' : 'sq-neg'}` }),
              label('lx', 250 + w / 2, 424, `${dx[0].toFixed(2)}`, { cls: 'lab lab-mid lab-cyan' }),
              rect('by', 250, 400 - h, 5, h, { cls: `sq ${dy[0] >= 0 ? 'sq-pos' : 'sq-neg'}` }),
              label('ly', 236, 400 - h / 2, `${dy[0].toFixed(2)}`, { cls: 'lab lab-end lab-purple' }),
              label('n', 376, 190, 'a corner — one length across, one length up', { cls: 'lab lab-mid' }),
            ];
          },
        },
        {
          label: 'close the rectangle',
          hold: 2000,
          note: 'Fill in the corner. <b>The area is the product.</b> Same trick as squaring, except the two sides come from different columns.',
          scene: s => {
            const dx = xdev(s), dy = ydev(s);
            const k = 150 / Math.max(...dx.map(Math.abs));
            const ky = 150 / Math.max(...dy.map(Math.abs));
            const w = Math.abs(dx[0]) * k, h = Math.abs(dy[0]) * ky;
            const prod = dx[0] * dy[0];
            return [
              label('t', 376, 110, 'width × height = the product', { cls: 'lab-big lab-mid' }),
              rect('fill', 250, 400 - h, w, h, { cls: `sq ${prod >= 0 ? 'sq-pos' : 'sq-neg'}`, dur: 700 }),
              rect('bx', 250, 400, w, 5, { cls: `sq ${dx[0] >= 0 ? 'sq-pos' : 'sq-neg'}` }),
              rect('by', 250, 400 - h, 5, h, { cls: `sq ${dy[0] >= 0 ? 'sq-pos' : 'sq-neg'}` }),
              label('lx', 250 + w / 2, 424, `${dx[0].toFixed(2)}`, { cls: 'lab lab-mid lab-cyan' }),
              label('ly', 236, 400 - h / 2, `${dy[0].toFixed(2)}`, { cls: 'lab lab-end lab-purple' }),
              label('p', 250 + w + 20, 400 - h / 2,
                `${dx[0].toFixed(2)} × ${dy[0].toFixed(2)} = ${prod.toFixed(2)}`, { cls: 'lab-big lab-warm' }),
            ];
          },
        },
        {
          label: 'the sign rule',
          hold: 2200,
          note: 'Four possibilities, and only the diagonal pairs agree. <b>Agreeing points make warm rectangles; disagreeing points make cold ones.</b>',
          scene: () => {
            const cases = [
              ['above x̄, above ȳ', 1, 1], ['below x̄, below ȳ', -1, -1],
              ['above x̄, below ȳ', 1, -1], ['below x̄, above ȳ', -1, 1],
            ];
            const items = [label('t', 376, 100, 'what the two signs do', { cls: 'lab-big lab-mid' })];
            cases.forEach(([name, sx_, sy_], i) => {
              const cx = 150 + (i % 2) * 300, cy = 200 + Math.floor(i / 2) * 160;
              const pos = sx_ * sy_ > 0;
              items.push(rect(`r-${i}`, cx - 45, cy - 34, 90, 68, {
                cls: `sq ${pos ? 'sq-pos' : 'sq-neg'}`, delay: i * 200,
              }));
              items.push(label(`n-${i}`, cx, cy + 56, name, { cls: 'lab-sm lab-mid', delay: i * 200 }));
              items.push(label(`s-${i}`, cx, cy + 4,
                `${sx_ > 0 ? '+' : '−'} × ${sy_ > 0 ? '+' : '−'} = ${pos ? '+' : '−'}`,
                { cls: `lab-big lab-mid ${pos ? 'lab-warm' : 'lab-cold'}`, delay: i * 200 }));
            });
            items.push(label('cap', 376, 500, 'the product is the question "do you agree?", answered numerically',
              { cls: 'lab lab-mid' }));
            return items;
          },
        },
        {
          label: 'all twelve rectangles',
          hold: 2000,
          note: 'One rectangle per point, drawn from the crossing of the two mean lines. Hover any of them.',
          scene: (s, ctx) => {
            const { f, d } = fitted(s);
            return [
              ...axesFor(f, s, d),
              ...s.pts.map((p, i) => {
                const yv = yOf(s, i);
                const dx = p[0] - d.mx, dy = yv - d.my;
                return rect(`rc-${i}`, f.sx(d.mx), f.sy(d.my), f.sx(p[0]) - f.sx(d.mx), f.sy(yv) - f.sy(d.my), {
                  cls: `sq link-prod ${dx * dy >= 0 ? 'sq-pos' : 'sq-neg'}`, delay: i * 80, opacity: 0.75,
                  tip: `#${i + 1}<br>(${dx.toFixed(2)}) × (${dy.toFixed(1)}) = <b>${(dx * dy).toFixed(2)}</b>`,
                });
              }),
              vLine(f, d.mx, { key: 'mx', cls: 'rule-x link-meanx' }),
              hLine(f, d.my, { key: 'my', cls: 'rule-y link-meany' }),
              ...scatter(s, f, d, ctx),
            ];
          },
        },
        {
          label: 'count the votes',
          hold: 2400,
          note: 'Lay the signed areas end to end, exactly as we did with the raw deviations. This time they do <b>not</b> cancel — and where you finish is the sum of products.',
          scene: s => {
            const d = D(s);
            const prods = d.x.map((v, i) => (v - d.mx) * (d.y[i] - d.my));
            const total = st.sum(prods);
            const k = 380 / Math.max(Math.abs(total), ...prods.map(Math.abs));
            const start = 150;
            const links = chain(prods, k, start);
            return [
              ...moveBadge(3, { reused: true }),
              ...surface({ y: 300, text: '' }),
              ...prods.map((v, i) => ({
                key: `led-${i}`, tag: 'rect', cls: `sq link-prod ${v >= 0 ? 'sq-pos' : 'sq-neg'}`,
                attrs: { x: Math.min(links[i].at, links[i].end), y: 300 - 16, width: Math.abs(v * k), height: 32 },
                delay: i * 150, tip: `#${i + 1}: <b>${v.toFixed(2)}</b>`,
                enter: { attrs: { width: 0, height: 32 } },
              })),
              { key: 'z', tag: 'line', cls: 'rule-faint rule-dash', attrs: { x1: start, y1: 244, x2: start, y2: 356 } },
              { key: 'e', tag: 'line', cls: 'rule-gold', attrs: { x1: links.at(-1).end, y1: 244, x2: links.at(-1).end, y2: 356 } },
              label('zl', start, 230, 'zero', { cls: 'lab-sm lab-mid' }),
              numLabel('tot', links.at(-1).end, 380, total, { cls: 'lab-big lab-mid lab-gold', d: 2, pre: 'Σ = ' }),
              label('cap', 376, 150, 'sum of the products of the deviations', { cls: 'lab-big lab-mid' }),
              label('cap2', 376, 172, 'warm reaches right, cold reaches left', { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
        {
          label: 'divide by n − 1',
          note: 'Average the votes and you have the <b>covariance</b>. Positive means they rise together. But look at the readout — what are its <i>units</i>?',
          scene: (s, ctx) => {
            const { f, d } = fitted(s);
            return [
              ...axesFor(f, s, d),
              ...s.pts.map((p, i) => {
                const yv = yOf(s, i);
                const dx = p[0] - d.mx, dy = yv - d.my;
                return rect(`rc-${i}`, f.sx(d.mx), f.sy(d.my), f.sx(p[0]) - f.sx(d.mx), f.sy(yv) - f.sy(d.my), {
                  cls: `sq link-prod ${dx * dy >= 0 ? 'sq-pos' : 'sq-neg'}`, opacity: 0.35,
                });
              }),
              vLine(f, d.mx, { key: 'mx', cls: 'rule-x link-meanx' }),
              hLine(f, d.my, { key: 'my', cls: 'rule-y link-meany' }),
              ...scatter(s, f, d, ctx),
              ...moveBadge(4, { reused: true }),
              numLabel('covl', f.midX, f.y1 + 12, d.cov, {
                cls: 'lab-big lab-mid lab-gold', d: 2, pre: 'cov = ',
                suf: s.yUnit === 'sec' ? ' min·sec' : ' min·min',
              }),
            ];
          },
        },
      ],
    },

    /* ── 9 ─────────────────────────────────────────────────────────────── */
    {
      title: 'the units problem',
      prose: `<p>Covariance has a fatal flaw as a summary: it is measured in <em>minutes × minutes</em>. Change the waiting time to seconds and the covariance multiplies by sixty — without a single geyser behaving differently.</p>
        <p><strong>Flip the units below and watch.</strong> The covariance jumps. The correlation does not move at all.</p>
        <p>That is the whole reason r exists. We need a version of covariance that has had the units divided out of it.</p>`,
      readouts: [RO.sx, RO.sy, RO.cov, RO.r],
      controls: [
        { type: 'segment', key: 'yUnit', label: 'wait measured in', options: [{ value: 'min', label: 'minutes' }, { value: 'sec', label: 'seconds' }] },
      ],
      beats: [
        {
          label: 'switch the units',
          note: 'The picture is <b>identical</b> — same shape, same story. Only the number attached to it changed.',
          scene: (s, ctx) => {
            const { f, d } = fitted(s);
            return [
              ...axesFor(f, s, d), ...scatter(s, f, d, ctx),
              vLine(f, d.mx, { key: 'mx', cls: 'rule-x' }), hLine(f, d.my, { key: 'my', cls: 'rule-y' }),
              numLabel('cov', f.midX, f.y1 + 4, d.cov, { cls: 'lab-big lab-mid lab-gold', d: 2, pre: 'cov = ' }),
              numLabel('rr', f.midX, f.y1 + 26, d.r, { cls: 'lab-big lab-mid lab-green', d: 3, pre: 'r = ', fmt: v => st.fmtR(v, 3) }),
            ];
          },
        },
      ],
    },

    /* ── 10 ────────────────────────────────────────────────────────────── */
    {
      title: 'strip the units off: z-scores',
      prose: `<p>The trick is to stop measuring in minutes and start measuring in <strong>standard deviations</strong>.</p>
        <p>Take each deviation and divide it by the spread of its own variable. A point that sits one s above the mean gets a score of 1 — whether that s was a minute, a second, or a dollar.</p>
        <p>The cloud doesn't change shape. It just gets re-labelled in a universal unit.</p>`,
      formula: formula(
        `${t(sub('z', 'i'), { explain: 'A z-score: how many standard deviations this point sits from the mean.', tone: 'green' })} ${eq} ` +
        frac(devX(), t(sub('s', 'x'), { explain: 'The standard deviation we built two steps ago.', tone: 'cyan' })),
        { caption: 'a deviation, measured in units of spread' }),
      readouts: [RO.sx, RO.sy, { key: 'zmean', label: 'mean of z', get: s => st.mean(st.zscores(D(s).x)), d: 3 }, { key: 'zsd', label: 'sd of z', get: s => st.sd(st.zscores(D(s).x)), d: 3 }],
      beats: [
        {
          label: 'rescale both axes',
          hold: 1600,
          note: 'Same twelve points. New rulers. The z-scores always have mean <b>0</b> and standard deviation <b>1</b> — check the readouts.',
          scene: (s, ctx) => {
            const d = D(s);
            const zx = st.zscores(d.x), zy = st.zscores(d.y);
            const f = F();
            const m = Math.max(2.2, ...zx.map(Math.abs), ...zy.map(Math.abs)) * 1.08;
            f.setX(-m, m); f.setY(-m, m);
            return [
              ...axes(f, { xLabel: 'eruption length — standard deviations', yLabel: 'wait — standard deviations' }),
              vLine(f, 0, { key: 'mx', cls: 'rule-x' }), hLine(f, 0, { key: 'my', cls: 'rule-y' }),
              ...zx.map((v, i) => ({
                key: `p-${i}`, tag: 'circle', cls: 'pt', delay: i * 45,
                attrs: { cx: f.sx(v), cy: f.sy(zy[i]), r: 6.5 },
                tip: `#${i + 1}<br>z_x = <b>${v.toFixed(2)}</b><br>z_y = <b>${zy[i].toFixed(2)}</b>`,
              })),
            ];
          },
        },
        {
          label: 'a unit square',
          note: 'One standard deviation in each direction. Most points land inside two. This box is the same box for every dataset in the world — that is what makes r comparable.',
          scene: s => {
            const d = D(s);
            const zx = st.zscores(d.x), zy = st.zscores(d.y);
            const f = F();
            const m = Math.max(2.2, ...zx.map(Math.abs), ...zy.map(Math.abs)) * 1.08;
            f.setX(-m, m); f.setY(-m, m);
            return [
              ...axes(f, { xLabel: 'z of eruption length', yLabel: 'z of wait' }),
              rect('unit', f.sx(-1), f.sy(1), f.sx(1) - f.sx(-1), f.sy(-1) - f.sy(1), { cls: 'sq sq-x', opacity: 0.7 }),
              rect('unit2', f.sx(-2), f.sy(2), f.sx(2) - f.sx(-2), f.sy(-2) - f.sy(2), { cls: 'bar-out' }),
              vLine(f, 0, { key: 'mx', cls: 'rule-x' }), hLine(f, 0, { key: 'my', cls: 'rule-y' }),
              ...zx.map((v, i) => ({
                key: `p-${i}`, tag: 'circle', cls: 'pt',
                attrs: { cx: f.sx(v), cy: f.sy(zy[i]), r: 6.5 },
                tip: `z_x = <b>${v.toFixed(2)}</b>, z_y = <b>${zy[i].toFixed(2)}</b>`,
              })),
              label('u1', f.sx(1) + 5, f.sy(1) - 5, '±1 s', { cls: 'lab-sm lab-cyan' }),
              label('u2', f.sx(2) + 5, f.sy(2) - 5, '±2 s', { cls: 'lab-sm' }),
            ];
          },
        },
      ],
    },

    /* ── 11 ────────────────────────────────────────────────────────────── */
    {
      title: 'r is the average of those products',
      prose: `<p>Do the covariance calculation again, but on the z-scores. Multiply each point's z<sub>x</sub> by its z<sub>y</sub>, add them up, divide by n − 1.</p>
        <p>That number is <strong>r</strong>. It can't leave the range −1 to +1, because the most a point can agree with itself is 1.</p>
        <p>Three formulas, one quantity. They are the same arithmetic written from three angles — pick whichever you find easiest to hold in your head.</p>`,
      formula: formula(
        `${t('r', { tone: 'green', explain: 'Pearson\'s correlation coefficient.' })} ${eq} ` +
        frac('cov(x, y)', t(sub('s', 'x'), { tone: 'cyan' }) + t(sub('s', 'y'), { tone: 'purple' })) +
        `${op('&nbsp;=&nbsp;')}` +
        frac(sumOver(t(sub('z', 'x')) + times + t(sub('z', 'y'))), nMinus1()) +
        `${op('&nbsp;=&nbsp;')}` +
        frac(sumOver(paren(devX()) + paren(devY())),
          sqrt(sumOver(paren(devX()) + sup('', '2')) + times + sumOver(paren(devY()) + sup('', '2')))),
        { caption: 'covariance ÷ the two spreads · the average z-product · the raw sums version' }),
      aside: `<b>Why it can't exceed 1.</b> The last form is a ratio of a sum of products to the square root of the product of the sums of squares. The Cauchy–Schwarz inequality says that ratio is at most 1, with equality only when every point sits exactly on one straight line. Perfect agreement is the ceiling.`,
      readouts: [RO.cov, RO.sx, RO.sy, RO.r],
      controls: [
        { type: 'toggle', key: 'morph', label: 'show a made-up cloud instead', explain: 'Swap the geyser data for a synthetic cloud you can dial to any r.' },
        { type: 'slider', key: 'rTarget', label: 'dial r to', min: -0.99, max: 0.99, step: 0.01, fast: true, fmt: v => st.fmtR(+v, 2) },
      ],
      beats: [
        {
          label: 'the z-products',
          note: 'Each point contributes <b>z<sub>x</sub> · z<sub>y</sub></b>. Points near the middle barely vote at all; points far out in a corner dominate.',
          scene: s => {
            const cloud = s.morph ? morphCloud(s.rTarget) : null;
            const d = cloud || D(s);
            const zx = st.zscores(d.x), zy = st.zscores(d.y);
            const f = F();
            const m = Math.max(2.4, ...zx.map(Math.abs), ...zy.map(Math.abs)) * 1.06;
            f.setX(-m, m); f.setY(-m, m);
            const r = st.pearson(d.x, d.y);
            return [
              ...axes(f, { xLabel: 'z of x', yLabel: 'z of y' }),
              ...zx.map((v, i) => rect(`z-${i}`, f.sx(0), f.sy(0), f.sx(v) - f.sx(0), f.sy(zy[i]) - f.sy(0), {
                cls: `sq link-prod ${v * zy[i] >= 0 ? 'sq-pos' : 'sq-neg'}`, delay: i * 60, opacity: 0.6,
                tip: `${v.toFixed(2)} × ${zy[i].toFixed(2)} = <b>${(v * zy[i]).toFixed(2)}</b>`,
              })),
              vLine(f, 0, { key: 'mx', cls: 'rule-x' }), hLine(f, 0, { key: 'my', cls: 'rule-y' }),
              ...zx.map((v, i) => ({
                key: `p-${i}`, tag: 'circle', cls: 'pt', attrs: { cx: f.sx(v), cy: f.sy(zy[i]), r: 6 },
                tip: `z-product = <b>${(v * zy[i]).toFixed(2)}</b>`,
              })),
              numLabel('rl', f.midX, f.y1 + 6, r, { cls: 'lab-big lab-mid lab-green', d: 3, pre: 'r = ', fmt: v => st.fmtR(v, 3) }),
            ];
          },
        },
        {
          label: 'calibrate your eye',
          note: 'Turn on the made-up cloud and drag the <b>r</b> slider. Learning what r = .3 actually looks like is worth more than any interpretation table.',
          scene: s => {
            const cloud = s.morph ? morphCloud(s.rTarget) : null;
            const d = cloud || D(s);
            const zx = st.zscores(d.x), zy = st.zscores(d.y);
            const f = F();
            const m = Math.max(2.6, ...zx.map(Math.abs), ...zy.map(Math.abs)) * 1.06;
            f.setX(-m, m); f.setY(-m, m);
            const r = st.pearson(d.x, d.y);
            const b = r; // in z units the least-squares slope IS r
            return [
              ...axes(f, { xLabel: 'z of x', yLabel: 'z of y' }),
              vLine(f, 0, { key: 'mx', cls: 'rule-x' }), hLine(f, 0, { key: 'my', cls: 'rule-y' }),
              path('diag', [[f.sx(-m), f.sy(-m)], [f.sx(m), f.sy(m)]], { cls: 'curve-ghost curve-dash' }),
              path('fit', [[f.sx(-m), f.sy(-m * b)], [f.sx(m), f.sy(m * b)]], { cls: 'curve curve-fit', dur: 260 }),
              ...zx.map((v, i) => ({
                key: `p-${i}`, tag: 'circle', cls: 'pt', dur: 260,
                attrs: { cx: f.sx(v), cy: f.sy(zy[i]), r: 6 },
              })),
              numLabel('rl', f.midX, f.y1 + 6, r, { cls: 'lab-big lab-mid lab-green', d: 3, pre: 'r = ', fmt: v => st.fmtR(v, 3), dur: 220 }),
              label('slopel', f.x1 - 6, f.y1 + 6, 'in z units, the best-fit slope is exactly r', { cls: 'lab-sm lab-end' }),
            ];
          },
        },
      ],
    },

    /* ── 12 ────────────────────────────────────────────────────────────── */
    {
      title: 'square it: how much did we explain?',
      prose: `<p>r on its own is a slightly slippery thing to interpret. r² is not.</p>
        <p>Take all that variance in waiting time we computed back in step 7 — the whole pile of squares. Draw the best-fit line through the cloud. Now measure the leftover spread <em>around the line</em> instead of around ȳ.</p>
        <p><strong>r² is the fraction of the pile you got rid of.</strong> It's a proportion of variance, which is why it's the number you should quote when someone asks how good the relationship is.</p>`,
      formula: formula(
        `${t(sup('r', '2'), { tone: 'green', explain: 'The proportion of variance in y accounted for by x.' })} ${eq} ` +
        `1 ${minus} ` + frac(
          t('SS' + sub('', 'residual'), { explain: 'Squared distances from the fitted line — what is left over.', link: 'resid', tone: 'warm' }),
          t('SS' + sub('', 'total'), { explain: 'Squared distances from ȳ — the spread you started with.', link: 'total', tone: 'purple' })),
        { caption: 'the share of the squares the line managed to remove' }),
      readouts: [RO.r, RO.r2, { key: 'sst', label: 'SS total', tone: 'purple', get: s => { const d = D(s); return st.sum(d.y.map(v => (v - d.my) ** 2)); }, d: 1, wide: true }, { key: 'sse', label: 'SS resid', tone: 'warm', get: s => st.linreg(D(s).x, D(s).y).sse, d: 1, wide: true }],
      dep: { note: 'The line being drawn here is exactly what <b>simple linear regression</b> fits — same sums, different question.', lesson: 'linreg', label: 'linear regression' },
      beats: [
        {
          label: 'spread around ȳ',
          note: 'Ignore x. All you have is the vertical scatter around the mean wait: <b>SS total</b>.',
          scene: (s, ctx) => {
            const { f, d } = fitted(s);
            return [
              ...axesFor(f, s, d), hLine(f, d.my, { key: 'my', cls: 'rule-y link-total' }),
              ...s.pts.map((p, i) => {
                const yv = p[1] * (s.yUnit === 'sec' ? 60 : 1);
                return {
                  key: `t-${i}`, tag: 'line', cls: 'stick stick-y link-total', delay: i * 45,
                  attrs: { x1: f.sx(p[0]), y1: f.sy(d.my), x2: f.sx(p[0]), y2: f.sy(yv) },
                };
              }),
              ...scatter(s, f, d, ctx),
            ];
          },
        },
        {
          label: 'spread around the line',
          note: 'Now use x. The residual sticks are much shorter — the line soaked up most of the scatter.',
          scene: (s, ctx) => {
            const { f, d } = fitted(s);
            const m = st.linreg(d.x, d.y);
            return [
              ...axesFor(f, s, d),
              path('fit', [[f.sx(f.dx[0]), f.sy(m.b0 + m.b1 * f.dx[0])], [f.sx(f.dx[1]), f.sy(m.b0 + m.b1 * f.dx[1])]], { cls: 'curve curve-fit' }),
              ...s.pts.map((p, i) => {
                const yv = p[1] * (s.yUnit === 'sec' ? 60 : 1);
                return {
                  key: `t-${i}`, tag: 'line', cls: 'stick stick-resid link-resid', delay: i * 45,
                  attrs: { x1: f.sx(p[0]), y1: f.sy(m.fit[i]), x2: f.sx(p[0]), y2: f.sy(yv) },
                  tip: `residual = <b>${m.resid[i].toFixed(2)}</b>`,
                };
              }),
              ...scatter(s, f, d, ctx),
            ];
          },
        },
        {
          label: 'the bar of variance',
          hold: 1900,
          note: 'Stack the two piles side by side. The green share is <b>r²</b> — the part of the spread that the eruption length accounts for.',
          scene: s => {
            const d = D(s);
            const m = st.linreg(d.x, d.y);
            const f = F();
            const barW = 150, x0 = f.midX - barW / 2;
            const top = f.y1 + 60, bot = f.y0 - 50, H = bot - top;
            const expl = (m.sst - m.sse) / m.sst;
            return [
              label('ttl', f.midX, top - 30, 'variance in waiting time', { cls: 'lab-big lab-mid' }),
              rect('total', x0 - 100, top, 62, H, { cls: 'bar bar-dim' }),
              label('totl', x0 - 69, bot + 18, 'SS total', { cls: 'lab-sm lab-mid' }),
              label('totv', x0 - 69, top - 8, m.sst.toFixed(0), { cls: 'lab-sm lab-mid lab-purple' }),
              rect('expl', x0, top, barW, H * expl, { cls: 'bar bar-green', dur: 900 }),
              rect('unex', x0, top + H * expl, barW, H * (1 - expl), { cls: 'bar bar-warm', dur: 900 }),
              label('el', f.midX, top + (H * expl) / 2 + 4, `explained · ${(expl * 100).toFixed(1)}%`, { cls: 'lab lab-mid', dur: 900 }),
              label('ul', f.midX, top + H * expl + (H * (1 - expl)) / 2 + 4, `left over · ${((1 - expl) * 100).toFixed(1)}%`, { cls: 'lab lab-mid', dur: 900 }),
              numLabel('r2l', f.midX, bot + 34, m.r2, { cls: 'lab-big lab-mid lab-green', d: 3, pre: 'r² = ', fmt: v => st.fmtR(v, 3) }),
              path('arr', [[x0 - 32, top + H / 2], [x0 - 8, top + H / 2]], { cls: 'arrow' }),
            ];
          },
        },
      ],
    },

    /* ── 13 ────────────────────────────────────────────────────────────── */
    {
      title: 'could this have been luck?',
      prose: `<p>Twelve points is not many. If eruption length had <em>nothing</em> to do with waiting time, you would still not get r = 0 exactly — you'd get some wobble around zero, just from which twelve eruptions happened to be in your notebook.</p>
        <p>So: imagine a world where the true correlation is zero. How often would that world hand you an r as extreme as the one you actually got? That is the p-value, and the standard route to it converts r into a <strong>t</strong>.</p>
        <p><strong>Drag the sample size.</strong> The same r becomes more or less surprising depending on how much data stands behind it — which is the single most useful thing to understand about significance testing.</p>`,
      formula: formula(
        `${t('t', { tone: 'warm', explain: 'The test statistic: how many standard errors r sits from zero.' })} ${eq} ` +
        frac(t('r', { tone: 'green' }) + sqrt(t('n', { tone: 'gold' }) + minus + '2'), sqrt('1' + minus + t(sup('r', '2'), { tone: 'green' }))) +
        `${op('&nbsp;&nbsp;with&nbsp;&nbsp;')} ${t('df ' + '=' + ' n − 2', { explain: 'Two degrees of freedom are spent: one on each mean.', tone: 'gold' })}`,
        { caption: 'a correlation, rewritten as a signal-to-noise ratio' }),
      aside: `<b>What the p-value is not.</b> It is not the probability that the correlation is real, and it is not the probability that you are wrong. It is one number: how often a world with no relationship at all would produce data at least this lopsided. Small p means the no-relationship story fits badly. It says nothing about how <i>big</i> the effect is — that's what r and the interval in the next step are for.`,
      readouts: [
        RO.r,
        { key: 'nh', label: 'n', get: s => s.nHypo, d: 0 },
        { key: 't', label: 't', tone: 'warm', get: s => st.rToT(D(s).r, s.nHypo), d: 3 },
        { key: 'df', label: 'df', get: s => s.nHypo - 2, d: 0 },
        { key: 'p', label: 'p', tone: 'gold', wide: true, get: s => st.tTest2(st.rToT(D(s).r, s.nHypo), s.nHypo - 2), fmt: st.fmtP },
      ],
      controls: [
        { type: 'slider', key: 'nHypo', label: 'if we had n =', min: 4, max: 200, step: 1, fast: true },
      ],
      beats: [
        {
          label: 'the null world',
          note: 'If the true correlation were zero, this is the distribution of t you would expect from sampling noise alone.',
          scene: s => {
            const df = Math.max(1, s.nHypo - 2);
            const f = F();
            f.setX(-5.2, 5.2); f.setY(0, st.tPdf(0, df) * 1.22);
            return [
              ...axes(f, { xLabel: 't', yLabel: 'density', yN: 4 }),
              fnPath(f, x => st.tPdf(x, df), { key: 'tc', cls: 'curve', n: 220 }),
              label('nl', f.midX, f.y1 + 14, `the t distribution with df = ${df}`, { cls: 'lab lab-mid' }),
            ];
          },
        },
        {
          label: 'where our data landed',
          note: 'Convert the observed r into a t. That is the vertical line.',
          scene: s => {
            const d = D(s), df = Math.max(1, s.nHypo - 2);
            const tv = st.rToT(d.r, s.nHypo);
            const f = F();
            const lim = Math.max(5.2, Math.abs(tv) * 1.2);
            f.setX(-lim, lim); f.setY(0, st.tPdf(0, df) * 1.22);
            return [
              ...axes(f, { xLabel: 't', yLabel: 'density', yN: 4 }),
              fnPath(f, x => st.tPdf(x, df), { key: 'tc', cls: 'curve', n: 220 }),
              vLine(f, tv, { key: 'tobs', cls: 'rule-gold' }),
              numLabel('tl', f.sx(tv), f.y1 + 8, tv, { cls: 'lab-big lab-mid lab-gold', d: 2, pre: 't = ' }),
            ];
          },
        },
        {
          label: 'shade both tails',
          hold: 1700,
          note: 'The shaded area is <b>p</b>: how much of the null world is at least this extreme, counting both directions.',
          scene: s => {
            const d = D(s), df = Math.max(1, s.nHypo - 2);
            const tv = st.rToT(d.r, s.nHypo);
            const p = st.tTest2(tv, df);
            const f = F();
            const lim = Math.max(5.2, Math.abs(tv) * 1.2);
            f.setX(-lim, lim); f.setY(0, st.tPdf(0, df) * 1.22);
            const at = Math.abs(tv);
            return [
              ...axes(f, { xLabel: 't', yLabel: 'density', yN: 4 }),
              fnArea(f, x => st.tPdf(x, df), at, lim, { key: 'ru', cls: 'area area-warm', base: 0 }),
              fnArea(f, x => st.tPdf(x, df), -lim, -at, { key: 'rl', cls: 'area area-warm', base: 0 }),
              fnPath(f, x => st.tPdf(x, df), { key: 'tc', cls: 'curve', n: 220 }),
              vLine(f, tv, { key: 'tobs', cls: 'rule-gold' }),
              vLine(f, -tv, { key: 'tobs2', cls: 'rule-gold rule-dash', opacity: 0.5 }),
              label('pl', f.midX, f.y1 + 8, `p = ${st.fmtP(p)}`, { cls: 'lab-big lab-mid lab-warm' }),
              label('pl2', f.midX, f.y1 + 28,
                p < 0.05 ? 'a no-relationship world would rarely produce this' : 'a no-relationship world would produce this fairly often',
                { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
        {
          label: 'what n buys you',
          note: 'Hold r fixed and slide n. Same strength of relationship, wildly different p. <b>Significance is a statement about evidence, not about size.</b>',
          scene: s => {
            const d = D(s);
            const f = F();
            f.setX(4, 200); f.setY(0, 1);
            const pts = [];
            for (let n = 4; n <= 200; n += 2) pts.push([f.sx(n), f.sy(st.tTest2(st.rToT(d.r, n), n - 2))]);
            const pnow = st.tTest2(st.rToT(d.r, s.nHypo), s.nHypo - 2);
            return [
              ...axes(f, { xLabel: 'sample size n', yLabel: 'p-value', yN: 5 }),
              rect('sig', f.x0, f.sy(0.05), f.x1 - f.x0, f.y0 - f.sy(0.05), { cls: 'sq sq-pos', opacity: 0.35 }),
              hLine(f, 0.05, { key: 'a', cls: 'rule-gold rule-dash' }),
              label('al', f.x1 - 4, f.sy(0.05) - 7, 'p = .05', { cls: 'lab-sm lab-gold lab-end' }),
              path('pc', pts, { cls: 'curve curve-warm' }),
              { key: 'now', tag: 'circle', cls: 'pt pt-green', dur: 220, attrs: { cx: f.sx(s.nHypo), cy: f.sy(Math.min(1, pnow)), r: 7 } },
              label('nowl', f.midX, f.y1 + 8, `r stays at ${st.fmtR(d.r, 2)} the whole time`, { cls: 'lab lab-mid' }),
            ];
          },
        },
      ],
    },

    /* ── 14 ────────────────────────────────────────────────────────────── */
    {
      title: 'how wrong could we be?',
      prose: `<p>A p-value answers a yes/no question badly. A confidence interval answers a better question: given this data, which values of the true correlation are compatible with what we saw?</p>
        <p>There's one wrinkle. r is squashed against its ceiling of 1, so its sampling distribution is lopsided. <strong>Fisher's z-transformation</strong> stretches r onto a scale where the distribution is roughly normal, does the ± there, and then squashes the endpoints back.</p>
        <p>Notice the interval is <em>not</em> symmetric around r once it comes back. That asymmetry is the geometry of the ceiling, not a mistake.</p>`,
      formula: formula(
        `${t('z', { tone: 'cyan', explain: 'Fisher\'s z — the stretched scale where the sampling distribution behaves.' })} ${eq} ` +
        frac('1', '2') + ' ln' + paren(frac('1 + r', '1 − r')) +
        `${op('&nbsp;&nbsp;·&nbsp;&nbsp;')} SE ${eq} ` + frac('1', sqrt('n − 3')) +
        `${op('&nbsp;&nbsp;·&nbsp;&nbsp;')} CI ${eq} tanh' + ` + paren('z ± ' + t('z*', { tone: 'gold', explain: 'The critical value: 1.96 for a 95% interval.' }) + ' · SE'),
        { caption: 'stretch → add the margin → squash back' }),
      readouts: [
        RO.r,
        { key: 'nh', label: 'n', get: s => s.nHypo, d: 0 },
        { key: 'lo', label: 'lower', tone: 'cold', get: s => st.rCI(D(s).r, s.nHypo, s.conf / 100)[0], d: 3, fmt: v => st.fmtR(v, 3) },
        { key: 'hi', label: 'upper', tone: 'warm', get: s => st.rCI(D(s).r, s.nHypo, s.conf / 100)[1], d: 3, fmt: v => st.fmtR(v, 3) },
      ],
      controls: [
        { type: 'slider', key: 'nHypo', label: 'if we had n =', min: 5, max: 200, step: 1, fast: true },
        { type: 'segment', key: 'conf', label: 'confidence', options: [{ value: 80, label: '80%' }, { value: 90, label: '90%' }, { value: 95, label: '95%' }, { value: 99, label: '99%' }] },
      ],
      beats: [
        {
          label: 'the interval',
          note: 'The bar is the range of true correlations that this data does not rule out.',
          scene: s => {
            const d = D(s);
            const [lo, hi] = st.rCI(d.r, s.nHypo, s.conf / 100);
            const f = F();
            f.setX(-1, 1); f.setY(0, 1);
            const y = f.midY;
            return [
              ...axes(f, { xLabel: 'true correlation ρ', showY: false, grid: false, xN: 8 }),
              { key: 'axl', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: y, x2: f.x1, y2: y } },
              rect('ci', f.sx(lo), y - 16, f.sx(hi) - f.sx(lo), 32, { cls: 'sq sq-pos', dur: 400 }),
              { key: 'lo', tag: 'line', cls: 'rule-gold', dur: 400, attrs: { x1: f.sx(lo), y1: y - 26, x2: f.sx(lo), y2: y + 26 } },
              { key: 'hi', tag: 'line', cls: 'rule-gold', dur: 400, attrs: { x1: f.sx(hi), y1: y - 26, x2: f.sx(hi), y2: y + 26 } },
              { key: 'pt', tag: 'circle', cls: 'pt pt-green', dur: 400, attrs: { cx: f.sx(d.r), cy: y, r: 8 } },
              vLine(f, 0, { key: 'z', cls: 'rule-faint rule-dash' }),
              label('z0', f.sx(0), y + 52, 'no relationship', { cls: 'lab-sm lab-mid' }),
              numLabel('lol', f.sx(lo), y - 36, lo, { cls: 'lab lab-mid lab-cold', d: 3, dur: 400, fmt: v => st.fmtR(v, 3) }),
              numLabel('hil', f.sx(hi), y - 36, hi, { cls: 'lab lab-mid lab-warm', d: 3, dur: 400, fmt: v => st.fmtR(v, 3) }),
              numLabel('rl', f.sx(d.r), y + 34, d.r, { cls: 'lab-big lab-mid lab-green', d: 3, pre: 'r = ', dur: 400, fmt: v => st.fmtR(v, 3) }),
              label('cap', f.midX, f.y1 + 20, `${s.conf}% interval · n = ${s.nHypo}`, { cls: 'lab lab-mid' }),
            ];
          },
        },
        {
          label: 'the stretched scale',
          hold: 1700,
          note: 'On the z scale the interval is a plain symmetric ±. All the asymmetry appears when you squash it back onto r.',
          scene: s => {
            const d = D(s);
            const z = 0.5 * Math.log((1 + d.r) / (1 - d.r));
            const se = 1 / Math.sqrt(Math.max(1, s.nHypo - 3));
            const crit = st.normInv(1 - (1 - s.conf / 100) / 2);
            const [lo, hi] = st.rCI(d.r, s.nHypo, s.conf / 100);
            const f = F();
            f.setX(-1, 1);
            const zf = frame({ w: 720, h: 540, l: 66, r: 28, t: 34, b: 58 });
            const zlim = Math.max(2.2, Math.abs(z) + crit * se + 0.4);
            zf.setX(-zlim, zlim);
            const yTop = f.y1 + 90, yBot = f.y0 - 90;
            return [
              label('t1', f.midX, yTop - 34, 'Fisher z scale — symmetric', { cls: 'lab lab-mid lab-cyan' }),
              { key: 'ax1', tag: 'line', cls: 'ax-line', attrs: { x1: zf.x0, y1: yTop, x2: zf.x1, y2: yTop } },
              rect('zci', zf.sx(z - crit * se), yTop - 12, zf.sx(z + crit * se) - zf.sx(z - crit * se), 24, { cls: 'sq sq-x' }),
              { key: 'zpt', tag: 'circle', cls: 'pt pt-cyan', attrs: { cx: zf.sx(z), cy: yTop, r: 7 } },
              label('zl', zf.sx(z), yTop - 22, `z = ${z.toFixed(3)}`, { cls: 'lab lab-mid lab-cyan' }),
              label('zse', zf.sx(z), yTop + 32, `± ${crit.toFixed(2)} × ${se.toFixed(3)}`, { cls: 'lab-sm lab-mid' }),

              path('a1', [[f.sx(lo), yTop + 46], [f.sx(lo), yBot - 20]], { cls: 'arrow' }),
              path('a2', [[f.sx(hi), yTop + 46], [f.sx(hi), yBot - 20]], { cls: 'arrow' }),
              label('tanh', f.midX, (yTop + yBot) / 2, 'tanh( )', { cls: 'lab lab-mid lab-gold' }),

              label('t2', f.midX, yBot - 40, 'back on the r scale — squashed', { cls: 'lab lab-mid lab-green' }),
              { key: 'ax2', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: yBot, x2: f.x1, y2: yBot } },
              rect('rci', f.sx(lo), yBot - 12, f.sx(hi) - f.sx(lo), 24, { cls: 'sq sq-pos' }),
              { key: 'rpt', tag: 'circle', cls: 'pt pt-green', attrs: { cx: f.sx(d.r), cy: yBot, r: 7 } },
              label('rlo', f.sx(lo), yBot + 26, st.fmtR(lo, 3), { cls: 'lab-sm lab-mid lab-cold' }),
              label('rhi', f.sx(hi), yBot + 26, st.fmtR(hi, 3), { cls: 'lab-sm lab-mid lab-warm' }),
              label('rmid', f.sx(d.r), yBot - 22, st.fmtR(d.r, 3), { cls: 'lab lab-mid lab-green' }),
              label('xr', f.midX, f.y0 + 20, 'r', { cls: 'ax-label' }),
            ];
          },
        },
      ],
    },

    /* ── 15 ────────────────────────────────────────────────────────────── */
    {
      title: 'what if the data is ordinal?',
      prose: `<p>Pearson's r measures how well the points sit on a <em>straight line</em>. That assumption is doing a lot of work, and it breaks in two common situations: when the relationship is curved but still consistently upward, and when one wild point drags the line.</p>
        <p>The fix is almost insultingly simple. Throw away the values and keep only the <strong>order</strong>: 1st, 2nd, 3rd. Then run the exact same Pearson calculation on the ranks. That's <strong>Spearman's ρ</strong> — no new machinery, just different input.</p>
        <p>This is also what you do when your data was never really numeric: Likert items, rankings, medals, severity grades.</p>`,
      formula: formula(
        `${t('ρ', { tone: 'cyan', explain: 'Spearman\'s rho — Pearson\'s r computed on ranks.' })} ${eq} r` +
        paren(t('rank(x)', { link: 'rk', tone: 'cyan' }) + ', ' + t('rank(y)', { link: 'rk', tone: 'purple' })),
        { caption: 'same formula. ranked input.' }),
      aside: `<b>Read the two numbers together.</b> If r and ρ agree, a straight line was a fair summary. If ρ is much larger, the relationship is real but bent. If r is much larger, one or two extreme points are probably carrying it. Switch datasets below and watch the pair move.`,
      readouts: [
        { key: 'r', label: 'Pearson r', tone: 'green', get: s => st.pearson(D(s).x, D(s).y), d: 3, wide: true, fmt: v => st.fmtR(v, 3) },
        { key: 'rho', label: 'Spearman ρ', tone: 'cyan', get: s => st.spearman(D(s).x, D(s).y), d: 3, wide: true, fmt: v => st.fmtR(v, 3) },
        { key: 'gap', label: 'difference', tone: 'gold', get: s => st.spearman(D(s).x, D(s).y) - st.pearson(D(s).x, D(s).y), d: 3, fmt: v => st.fmtR(v, 3) },
      ],
      controls: [
        {
          type: 'segment', key: 'dataset', label: 'data', options: [
            { value: 'faithful', label: 'geyser' }, { value: 'curved', label: 'bent but monotone' }, { value: 'outlier', label: 'one wild point' },
          ],
          onChange: s => { s.pts = DATASETS[s.dataset].map(p => [...p]); },
        },
        { type: 'toggle', key: 'ranked', label: 'show the ranks' },
      ],
      beats: [
        {
          label: 'the raw values',
          note: 'Try each dataset. Watch how differently the two coefficients behave.',
          scene: (s, ctx) => {
            const { f, d } = fitted(s);
            const m = st.linreg(d.x, d.y);
            return [
              ...axesFor(f, s, d),
              path('fit', [[f.sx(f.dx[0]), f.sy(m.b0 + m.b1 * f.dx[0])], [f.sx(f.dx[1]), f.sy(m.b0 + m.b1 * f.dx[1])]], { cls: 'curve curve-fit curve-dash' }),
              ...scatter(s, f, d, ctx),
              label('cap', f.midX, f.y1 + 6, 'raw values · Pearson fits a straight line to these', { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
        {
          label: 'snap to ranks',
          hold: 1900,
          note: 'Every point moves to its <b>position in the queue</b>. Distances vanish; only order survives. Then: Pearson again, unchanged.',
          scene: s => {
            const d = D(s);
            const rx = st.ranks(d.x), ry = st.ranks(d.y);
            const f = F();
            f.setX(0.4, d.n + 0.6); f.setY(0.4, d.n + 0.6);
            const rho = st.pearson(rx, ry);
            return [
              ...axes(f, { xLabel: 'rank of x', yLabel: 'rank of y', xN: 6, yN: 6 }),
              path('diag', [[f.sx(1), f.sy(1)], [f.sx(d.n), f.sy(d.n)]], { cls: 'curve-ghost curve-dash' }),
              ...rx.map((v, i) => ({
                key: `p-${i}`, tag: 'circle', cls: 'pt pt-cyan link-rk', delay: i * 55,
                attrs: { cx: f.sx(v), cy: f.sy(ry[i]), r: 6.5 },
                tip: `#${i + 1}<br>x is <b>${ordinal(v)}</b> longest<br>y is <b>${ordinal(ry[i])}</b> longest`,
              })),
              numLabel('rho', f.midX, f.y1 + 6, rho, { cls: 'lab-big lab-mid lab-cyan', d: 3, pre: 'ρ = ', fmt: v => st.fmtR(v, 3) }),
            ];
          },
        },
        {
          label: 'both at once',
          note: 'Left: the values. Right: the ranks. Same twelve eruptions, two different questions about them.',
          scene: s => {
            const d = D(s);
            const rx = st.ranks(d.x), ry = st.ranks(d.y);
            const fa = frame({ w: 720, h: 540, l: 52, r: 380, t: 40, b: 70 });
            fa.fit(d.x, d.y, 0.12);
            const fb = frame({ w: 720, h: 540, l: 404, r: 28, t: 40, b: 70 });
            fb.setX(0.4, d.n + 0.6); fb.setY(0.4, d.n + 0.6);
            const r = st.pearson(d.x, d.y), rho = st.pearson(rx, ry);
            return [
              ...axes(fa, { xLabel: 'value of x', yLabel: 'value of y', prefix: 'a', xN: 3, yN: 4 }),
              ...d.x.map((v, i) => ({
                key: `a-${i}`, tag: 'circle', cls: 'pt', attrs: { cx: fa.sx(v), cy: fa.sy(d.y[i]), r: 5.5 },
              })),
              label('al', fa.midX, fa.y1 - 12, `r = ${st.fmtR(r, 3)}`, { cls: 'lab-big lab-mid lab-green' }),
              ...axes(fb, { xLabel: 'rank of x', yLabel: 'rank of y', prefix: 'b', xN: 3, yN: 4 }),
              ...rx.map((v, i) => ({
                key: `b-${i}`, tag: 'circle', cls: 'pt pt-cyan', attrs: { cx: fb.sx(v), cy: fb.sy(ry[i]), r: 5.5 },
              })),
              label('bl', fb.midX, fb.y1 - 12, `ρ = ${st.fmtR(rho, 3)}`, { cls: 'lab-big lab-mid lab-cyan' }),
              label('verdict', 360, 512, verdict(r, rho), { cls: 'lab lab-mid lab-gold' }),
            ];
          },
        },
      ],
    },
  ],
};

/* ── helpers ──────────────────────────────────────────────────────────────── */

function ordinal(v) {
  if (v % 1) return v.toFixed(1) + 'th (tied)';
  const n = Math.round(v), s = ['th', 'st', 'nd', 'rd'], k = n % 100;
  return n + (s[(k - 20) % 10] || s[k] || s[0]);
}

function verdict(r, rho) {
  const gap = rho - r;
  if (Math.abs(gap) < 0.04) return 'they agree — a straight line was a fair summary';
  if (gap > 0) return 'ρ is higher — the relationship is real but bent';
  return 'r is higher — a few extreme values are carrying it';
}

/** a synthetic cloud with a requested correlation, for eye calibration */
function morphCloud(target) {
  const rr = st.rng(2024);
  const n = 40;
  const x = [], y = [];
  const base = range(n).map(() => st.randNorm(rr));
  const noise = range(n).map(() => st.randNorm(rr));
  const rt = clamp(+target, -0.999, 0.999);
  for (let i = 0; i < n; i++) {
    x.push(base[i]);
    y.push(rt * base[i] + Math.sqrt(1 - rt * rt) * noise[i]);
  }
  return {
    x, y, n,
    mx: st.mean(x), my: st.mean(y), sx: st.sd(x), sy: st.sd(y),
    cov: st.covariance(x, y), r: st.pearson(x, y), unit: 'z',
  };
}
