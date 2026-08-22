/* ─────────────────────────────────────────────────────────────────────────────
   correlation.js — the flagship. Pearson's r, drawn from an empty pair of axes
   all the way to a p-value and a confidence interval, one micro-step at a time.

   Everything downstream (regression, t-tests, the whole GLM family) reuses the
   pieces built here: deviations, squares, sums of products.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, fnArea, arrowDefs, dragger, COLORS } from '../core/plot.js';
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

function scatter(s, f, d, ctx, { cls = 'pt pt-drag', opacity = 1, stagger = 0, delay = 0, upTo = 99 } = {}) {
  return points(f, s.pts.slice(0, upTo), {
    key: 'p', r: 6.5, cls, delay, stagger, opacity,
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

const axesFor = (f, s, d, o = {}) => axes(f, {
  xLabel: `${XLAB[s.dataset]} — minutes`,
  yLabel: `wait to next — ${d.unit}`,
  ...o,
});

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
  sx: { key: 'sx', label: 's_x', tone: 'cyan', get: s => D(s).sx, d: 3 },
  sy: { key: 'sy', label: 's_y', tone: 'purple', get: s => D(s).sy, d: 2 },
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
      prose: `<p>Here is the move that the rest of statistics is built on. For each point, measure the <strong>distance from the mean</strong>. That distance is called a <em>deviation</em>.</p>
        <p>Then a problem: the deviations always add up to exactly zero. That is what "balance point" means, so the raw distances can't measure spread — they cancel.</p>
        <p>The fix is to <strong>square</strong> them. Squaring kills the minus signs, and — this is the part worth feeling — it turns a length into an <em>area</em>. Spread stops being a distance and becomes a pile of squares.</p>`,
      formula: formula(
        `${t(sup('s', '2') + sub('', 'x'), { explain: 'The sample variance of x: the average squared deviation.', tone: 'cyan' })} ${eq} ` +
        frac(sumOver(paren(devX()) + sup('', '2')), nMinus1()) +
        `${op('&nbsp;&nbsp;→&nbsp;&nbsp;')} ${t(sub('s', 'x'), { explain: 'The standard deviation: the square root of the variance, back in the original units (minutes).', tone: 'cyan' })} ${eq} ${sqrt(sup('s', '2'))}`,
        { caption: 'hover any piece of the formula — the drawing will answer' }),
      aside: `<b>Why n − 1 and not n?</b> You already spent one piece of your data working out x̄. Once you know the mean and eleven of the deviations, the twelfth is forced — it has no freedom left. So you have n − 1 independent pieces of information, and dividing by n − 1 is what keeps the estimate honest rather than slightly too small.`,
      readouts: [RO.n, RO.mx, { key: 'ss', label: 'Σ(x−x̄)²', tone: 'gold', get: s => { const d = D(s); return st.sum(d.x.map(v => (v - d.mx) ** 2)); }, d: 3, wide: true }, { key: 'vx', label: 's²ₓ', tone: 'cyan', get: s => st.variance(D(s).x), d: 4 }, RO.sx],
      beats: [
        {
          label: 'the deviations',
          note: 'One horizontal stick per point, from the point to the <b>x̄</b> line. Warm sticks reach right (above average), cold sticks reach left.',
          scene: (s, ctx) => {
            const { f, d } = fitted(s);
            return [
              ...axesFor(f, s, d), vLine(f, d.mx, { key: 'mx', cls: 'rule-x link-meanx' }),
              ...s.pts.map((p, i) => {
                const yv = p[1] * (s.yUnit === 'sec' ? 60 : 1);
                const dev = p[0] - d.mx;
                return {
                  key: `sx-${i}`, tag: 'line', delay: i * 60,
                  cls: `stick link-devx ${dev >= 0 ? 'stick-pos' : 'stick-neg'}`,
                  attrs: { x1: f.sx(d.mx), y1: f.sy(yv), x2: f.sx(p[0]), y2: f.sy(yv) },
                  tip: `x − x̄ = <b>${dev.toFixed(3)}</b>`,
                };
              }),
              ...scatter(s, f, d, ctx),
            ];
          },
        },
        {
          label: 'put numbers on them',
          note: 'Each stick has a length with a sign. <b>Hover the sticks.</b>',
          scene: (s, ctx) => {
            const { f, d } = fitted(s);
            return [
              ...axesFor(f, s, d), vLine(f, d.mx, { key: 'mx', cls: 'rule-x link-meanx' }),
              ...s.pts.map((p, i) => {
                const yv = p[1] * (s.yUnit === 'sec' ? 60 : 1);
                const dev = p[0] - d.mx;
                return [{
                  key: `sx-${i}`, tag: 'line',
                  cls: `stick link-devx ${dev >= 0 ? 'stick-pos' : 'stick-neg'}`,
                  attrs: { x1: f.sx(d.mx), y1: f.sy(yv), x2: f.sx(p[0]), y2: f.sy(yv) },
                  tip: `x − x̄ = <b>${dev.toFixed(3)}</b>`,
                },
                // hang the number off the point end, so points at similar
                // heights don't stack their labels on top of each other
                label(`sxl-${i}`, f.sx(p[0]) + (dev >= 0 ? 11 : -11), f.sy(yv) + 4,
                  (dev >= 0 ? '+' : '−') + Math.abs(dev).toFixed(2),
                  { cls: `lab-sm link-devx ${dev >= 0 ? 'lab-warm' : 'lab-cold'}${dev >= 0 ? '' : ' lab-end'}`, delay: i * 40 })];
              }),
              ...scatter(s, f, d, ctx, { opacity: 0.5 }),
            ];
          },
        },
        {
          label: 'they cancel to zero',
          hold: 1700,
          note: 'Stack the signed lengths end to end and you land exactly back where you started. <b>Σ(xᵢ − x̄) = 0, always.</b> Raw deviations cannot measure spread.',
          scene: s => {
            const { f, d } = fitted(s);
            const devs = d.x.map(v => v - d.mx);
            const k = (f.x1 - f.x0) / (Math.max(...devs.map(Math.abs)) * 12);
            let cx = f.midX - 120;
            const baseY = f.midY;
            const items = [];
            devs.forEach((v, i) => {
              const w = v * k * 3;
              items.push({
                key: `stack-${i}`, tag: 'line', delay: i * 110,
                cls: `stick link-devx ${v >= 0 ? 'stick-pos' : 'stick-neg'}`,
                attrs: { x1: cx, y1: baseY, x2: cx + w, y2: baseY },
                tip: `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(3)}`,
              });
              cx += w;
            });
            items.push(vLine(f, d.mx, { key: 'mx', cls: 'rule-x link-meanx' }));
            items.push({ key: 'startm', tag: 'line', cls: 'rule-faint rule-dash', attrs: { x1: f.midX - 120, y1: baseY - 40, x2: f.midX - 120, y2: baseY + 40 } });
            items.push(label('endl', f.midX - 120, baseY + 62, 'start = finish → sum is 0', { cls: 'lab-sm lab-mid' }));
            items.push(label('zero', f.midX, f.y1 + 10, 'Σ (xᵢ − x̄) = 0', { cls: 'lab-big lab-mid' }));
            return [...axesFor(f, s, d, { grid: false }), ...items];
          },
        },
        {
          label: 'square them',
          hold: 1800,
          note: 'Each stick becomes a square with that stick as its side. A length turns into an <b>area</b>, and the minus signs disappear — a negative side still makes a positive square.',
          scene: s => {
            const { f, d } = fitted(s);
            const devs = d.x.map(v => v - d.mx);
            const maxDev = Math.max(...devs.map(Math.abs));
            const k = 96 / maxDev;
            const baseY = f.y0 - 40;
            return [
              ...axesFor(f, s, d, { grid: false, showY: false }),
              ...squareRow(devs, { key: 'sqx', cls: 'sq sq-x link-devx', baseY, x0: f.x0, x1: f.x1, k, labelEach: true }),
              label('sst', f.midX, baseY - 96 - 34, 'Σ (xᵢ − x̄)²  =  ' + st.sum(devs.map(v => v * v)).toFixed(3),
                { cls: 'lab-big lab-mid lab-gold' }),
              label('sqnote', f.midX, baseY - 96 - 14, 'twelve squares, drawn to one common scale', { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
        {
          label: 'average them',
          hold: 1800,
          note: 'Collapse the pile into <b>one square of the same average area</b>. That average area is the <b>variance</b>. Divide by n − 1, not n.',
          scene: s => {
            const { f, d } = fitted(s);
            const devs = d.x.map(v => v - d.mx);
            const k = 96 / Math.max(...devs.map(Math.abs));
            const v = st.variance(d.x);
            const side = Math.sqrt(v) * k;
            const baseY = f.y0 - 40;
            return [
              ...axesFor(f, s, d, { grid: false, showY: false }),
              ...squareRow(devs, {
                key: 'sqx', cls: 'sq sq-x link-devx', baseY, x0: f.x0, x1: f.x1, k,
                mergeTo: { x: f.midX, side },
              }),
              label('varl', f.midX, baseY - side - 16, `s²ₓ = ${v.toFixed(4)}`, { cls: 'lab-big lab-mid lab-cyan' }),
              label('varl2', f.midX, baseY - side - 38, 'one square, of the average area', { cls: 'lab-sm lab-mid' }),
              label('varl3', f.midX, baseY + 24, 'the average squared deviation — the variance', { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
        {
          label: 'take the root',
          note: 'Variance is in <b>minutes squared</b>, which nobody can picture. Take the square root — the <b>side</b> of that average square — and you are back in minutes. That is the standard deviation.',
          scene: (s, ctx) => {
            const { f, d } = fitted(s);
            return [
              ...axesFor(f, s, d),
              rect('band', f.sx(d.mx - d.sx), f.y1, f.sx(d.mx + d.sx) - f.sx(d.mx - d.sx), f.y0 - f.y1,
                { cls: 'sq sq-x' }),
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
      prose: `<p>Identical machinery, rotated. Deviations from ȳ, squared, averaged, rooted.</p>
        <p>This is worth noticing: you have now learned the <em>only</em> spread calculation in this entire site. ANOVA, regression, t-tests — they all do exactly this, and then argue about what to divide by.</p>`,
      formula: formula(
        `${t(sup('s', '2') + sub('', 'y'), { tone: 'purple', explain: 'The sample variance of y.' })} ${eq} ` +
        frac(sumOver(paren(devY()) + sup('', '2')), nMinus1()),
        { caption: 'same four moves: subtract, square, sum, divide' }),
      readouts: [RO.my, { key: 'vy', label: 's²_y', tone: 'purple', get: s => st.variance(D(s).y), d: 3 }, RO.sy],
      dep: { note: 'This is the same calculation the <b>t-test</b> uses to decide whether two group means differ.', lesson: 'ttest', label: 't-tests' },
      beats: [
        {
          label: 'deviations in y',
          note: 'Vertical sticks now, from each point to the <b>ȳ</b> line.',
          scene: (s, ctx) => {
            const { f, d } = fitted(s);
            return [
              ...axesFor(f, s, d), hLine(f, d.my, { key: 'my', cls: 'rule-y link-meany' }),
              ...s.pts.map((p, i) => {
                const yv = p[1] * (s.yUnit === 'sec' ? 60 : 1);
                const dev = yv - d.my;
                return {
                  key: `sy-${i}`, tag: 'line', delay: i * 55,
                  cls: `stick link-devy ${dev >= 0 ? 'stick-pos' : 'stick-neg'}`,
                  attrs: { x1: f.sx(p[0]), y1: f.sy(d.my), x2: f.sx(p[0]), y2: f.sy(yv) },
                  tip: `y − ȳ = <b>${dev.toFixed(2)}</b>`,
                };
              }),
              ...scatter(s, f, d, ctx),
            ];
          },
        },
        {
          label: 'square and pile',
          hold: 1700,
          note: 'Twelve squares again, then one average square.',
          scene: s => {
            const { f, d } = fitted(s);
            const devs = d.y.map(v => v - d.my);
            const k = 58 / Math.max(...devs.map(Math.abs));
            return [
              ...axesFor(f, s, d, { grid: false, showY: false }),
              ...squareRow(devs, { key: 'sqy', cls: 'sq sq-y link-devy', baseY: f.y0 - 12, x0: f.x0, x1: f.x1, k }),
              label('ssty', f.midX, f.y1 + 14, 'Σ (yᵢ − ȳ)²  =  ' + st.sum(devs.map(v => v * v)).toFixed(1),
                { cls: 'lab-big lab-mid lab-gold' }),
            ];
          },
        },
        {
          label: 'the spread of y',
          note: 'The waiting times scatter by about <b>s_y</b> minutes around their mean.',
          scene: (s, ctx) => {
            const { f, d } = fitted(s);
            return [
              ...axesFor(f, s, d),
              rect('bandy', f.x0, f.sy(d.my + d.sy), f.x1 - f.x0, f.sy(d.my - d.sy) - f.sy(d.my + d.sy), { cls: 'sq sq-y' }),
              ...scatter(s, f, d, ctx),
              hLine(f, d.my, { key: 'my', cls: 'rule-y link-meany' }),
              label('sdly', f.x1 - 6, f.sy(d.my + d.sy) - 8, `ȳ ± s_y = ${d.my.toFixed(1)} ± ${d.sy.toFixed(1)}`,
                { cls: 'lab lab-purple lab-end' }),
            ];
          },
        },
      ],
    },

    /* ── 8 ─────────────────────────────────────────────────────────────── */
    {
      title: 'multiply the two deviations together',
      prose: `<p>Now the actual idea. For each point, take its x-deviation and its y-deviation and <strong>multiply them</strong>.</p>
        <p>Watch the signs do the work. Above average on both → positive times positive → <span class="cs-datum-warm">positive</span>. Below average on both → negative times negative → <span class="cs-datum-warm">still positive</span>. But one up and one down → <span class="cs-datum-cold">negative</span>.</p>
        <p>So the product asks each point a yes-or-no question: <em>do you agree that these two things move together?</em> Add up the answers, divide by n − 1, and you have the <strong>covariance</strong>.</p>`,
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
          label: 'one point, one rectangle',
          note: 'Take the first eruption. Its x-deviation is the width, its y-deviation is the height. The <b>area of that rectangle is the product</b>.',
          scene: (s, ctx) => {
            const { f, d } = fitted(s);
            const p = s.pts[0], yv = p[1] * (s.yUnit === 'sec' ? 60 : 1);
            const dx = p[0] - d.mx, dy = yv - d.my;
            return [
              ...axesFor(f, s, d),
              rect('r0', f.sx(d.mx), f.sy(d.my), f.sx(p[0]) - f.sx(d.mx), f.sy(yv) - f.sy(d.my),
                { cls: `sq ${dx * dy >= 0 ? 'sq-pos' : 'sq-neg'}` }),
              vLine(f, d.mx, { key: 'mx', cls: 'rule-x link-meanx' }),
              hLine(f, d.my, { key: 'my', cls: 'rule-y link-meany' }),
              ...scatter(s, f, d, ctx, { opacity: 0.4 }),
              { key: 'p0', tag: 'circle', cls: 'pt', attrs: { cx: f.sx(p[0]), cy: f.sy(yv), r: 7 } },
              label('w', (f.sx(d.mx) + f.sx(p[0])) / 2, f.sy(d.my) + 16, `width = ${dx.toFixed(2)}`, { cls: 'lab-sm lab-mid lab-cyan' }),
              label('hgt', f.sx(p[0]) + 8, (f.sy(d.my) + f.sy(yv)) / 2, `height = ${dy.toFixed(1)}`, { cls: 'lab-sm lab-purple' }),
              label('prod', f.midX, f.y1 + 12, `product = ${(dx * dy).toFixed(2)}`, { cls: 'lab-big lab-mid lab-warm' }),
            ];
          },
        },
        {
          label: 'all twelve rectangles',
          hold: 1600,
          note: 'Warm rectangles are points that <b>agree</b> with the trend. Cold rectangles <b>disagree</b>. Hover any of them.',
          scene: (s, ctx) => {
            const { f, d } = fitted(s);
            return [
              ...axesFor(f, s, d),
              ...s.pts.map((p, i) => {
                const yv = p[1] * (s.yUnit === 'sec' ? 60 : 1);
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
          hold: 1800,
          note: 'Lay the signed areas end to end: warm to the right, cold to the left. Where you finish is the <b>sum of products</b>.',
          scene: s => {
            const { f, d } = fitted(s);
            const prods = d.x.map((v, i) => (v - d.mx) * (d.y[i] - d.my));
            const total = st.sum(prods);
            const k = (f.x1 - f.x0 - 90) / Math.max(Math.abs(total), ...prods.map(Math.abs)) / 1.35;
            let cx = f.x0 + 30;
            const baseY = f.midY + 30;
            const items = [];
            prods.forEach((v, i) => {
              const w = v * k;
              items.push(rect(`led-${i}`, Math.min(cx, cx + w), baseY - 15, Math.abs(w), 30, {
                cls: `sq link-prod ${v >= 0 ? 'sq-pos' : 'sq-neg'}`, delay: i * 130,
                tip: `#${i + 1}: <b>${v.toFixed(2)}</b>`,
              }));
              cx += w;
            });
            items.push({ key: 'startl', tag: 'line', cls: 'rule-faint rule-dash', attrs: { x1: f.x0 + 30, y1: baseY - 46, x2: f.x0 + 30, y2: baseY + 46 } });
            items.push({ key: 'endl', tag: 'line', cls: 'rule-gold', attrs: { x1: cx, y1: baseY - 46, x2: cx, y2: baseY + 46 } });
            items.push(label('tot', cx, baseY + 66, `Σ = ${total.toFixed(2)}`, { cls: 'lab-big lab-mid lab-gold' }));
            items.push(label('lz', f.x0 + 30, baseY - 58, 'zero', { cls: 'lab-sm lab-mid' }));
            items.push(label('cap', f.midX, baseY - 100, 'sum of products of deviations', { cls: 'lab-big lab-mid' }));
            items.push(label('cap2', f.midX, baseY - 78, 'warm reaches right, cold reaches left', { cls: 'lab-sm lab-mid' }));
            return items;
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
                const yv = p[1] * (s.yUnit === 'sec' ? 60 : 1);
                const dx = p[0] - d.mx, dy = yv - d.my;
                return rect(`rc-${i}`, f.sx(d.mx), f.sy(d.my), f.sx(p[0]) - f.sx(d.mx), f.sy(yv) - f.sy(d.my), {
                  cls: `sq link-prod ${dx * dy >= 0 ? 'sq-pos' : 'sq-neg'}`, opacity: 0.35,
                });
              }),
              vLine(f, d.mx, { key: 'mx', cls: 'rule-x link-meanx' }),
              hLine(f, d.my, { key: 'my', cls: 'rule-y link-meany' }),
              ...scatter(s, f, d, ctx),
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
