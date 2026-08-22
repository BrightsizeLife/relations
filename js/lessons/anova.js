/* ─────────────────────────────────────────────────────────────────────────────
   anova.js — one-way ANOVA. Chop the total spread into two piles and compare
   their sizes. Same squares as everywhere else; a different bookkeeping.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, hLine, label, numLabel, path, rect, fnPath, fnArea, strip, arrowDefs } from '../core/plot.js';
import { range } from '../core/dom.js';
import { formula, t, frac, sqrt, sub, sup, bar, sumOver, paren, eq, minus, op } from '../core/fx.js';

/* R's PlantGrowth: dried weight of plants under a control and two treatments. */
const RAW = {
  control: [4.17, 5.58, 5.18, 6.11, 4.50, 4.61, 5.17, 4.53, 5.33, 5.14],
  treat1: [4.81, 4.17, 4.41, 3.59, 5.87, 3.83, 6.03, 4.89, 4.32, 4.69],
  treat2: [6.31, 5.12, 5.54, 5.50, 5.37, 5.29, 4.92, 6.15, 5.80, 5.26],
};
const NAMES = ['control', 'treatment 1', 'treatment 2'];
const XS = [200, 360, 520];

const F = () => frame({ w: 720, h: 540, l: 66, r: 28, t: 34, b: 62 });

function G(s) {
  const base = [RAW.control, RAW.treat1, RAW.treat2].map(g => g.slice(0, s.n));
  const shifted = base.map((g, i) => g.map(v => v + (i === 2 ? s.shift : 0)));
  return { groups: shifted, a: st.anova(shifted) };
}

function gframe(g) {
  const f = F();
  const all = g.groups.flat();
  f.setY(Math.min(...all) - 0.5, Math.max(...all) + 0.5);
  f.setX(0, 720);
  return f;
}

const dotsFor = (f, g, o = {}) => g.groups.flatMap((grp, i) =>
  strip(f, grp, XS[i], {
    key: `g${i}`, cls: `pt ${['pt-cold', 'pt-warm', 'pt-green'][i]}`, r: 6, seed: 3 + i * 7,
    stagger: o.stagger || 0, opacity: o.opacity ?? 1,
    tip: v => `${NAMES[i]}<br><b>${v.toFixed(2)}</b> g`,
  }));

const labelsFor = f => NAMES.map((n, i) => label(`ln-${i}`, XS[i], f.y0 + 24, n, { cls: 'ax-label lab-mid' }));

export default {
  meta: {
    id: 'anova', title: 'one-way anova', kicker: 'VARIANCE, SPLIT',
    status: 'live',
    deck: 'Three groups instead of two. Rather than testing every pair, ANOVA asks a single question: is the spread <em>between</em> the group means bigger than the spread <em>within</em> them? Two piles of squares, one ratio.',
    dataNote: 'Data: R\'s <code>PlantGrowth</code> — dried weight in grams of plants grown under a control condition and two treatments, 10 plants each.',
    deps: ['ttest'], unlocks: [],
    next: 'linreg', nextLabel: 'linear regression',
    outro: 'one ratio of two variances, and a good reason not to run three t-tests.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { n: 10, shift: 0, showTotal: true, kSim: 3 },

  steps: [
    {
      title: 'three groups, one grand mean',
      prose: `<p>Thirty plants, three growing conditions, one measurement each: dried weight.</p>
        <p>Start by ignoring the groups entirely. Pool all thirty numbers, take their mean, and measure the total spread around it — the same sum of squares from the correlation lesson, computed on everything at once.</p>
        <p>That total is a fixed budget. The whole of ANOVA is deciding how to divide it.</p>`,
      readouts: [
        { key: 'N', label: 'N', get: s => G(s).a.N, d: 0 },
        { key: 'k', label: 'groups', get: s => 3, d: 0 },
        { key: 'grand', label: 'grand mean', tone: 'gold', get: s => G(s).a.grand, d: 3, wide: true },
        { key: 'sst', label: 'SS total', tone: 'gold', get: s => G(s).a.sst, d: 2, wide: true },
      ],
      beats: [
        {
          label: 'thirty plants',
          note: 'Three columns of numbers. Your eye is already doing an ANOVA — we are just making it explicit.',
          scene: s => {
            const g = G(s), f = gframe(g);
            return [...axes(f, { yLabel: 'dried weight (g)', showX: false, xN: 0 }), ...dotsFor(f, g, { stagger: 25 }), ...labelsFor(f)];
          },
        },
        {
          label: 'forget the groups',
          note: 'Pretend the labels do not exist. This is the spread you have to explain.',
          scene: s => {
            const g = G(s), f = gframe(g);
            return [
              ...axes(f, { yLabel: 'dried weight (g)', showX: false, xN: 0 }),
              hLine(f, g.a.grand, { key: 'gm', cls: 'rule-gold' }),
              ...g.groups.flatMap((grp, i) => grp.map((v, j) => ({
                key: `t-${i}-${j}`, tag: 'line', cls: 'stick stick-y', delay: (i * 10 + j) * 22,
                attrs: { x1: XS[i] + ((j % 5) - 2) * 12, y1: f.sy(g.a.grand), x2: XS[i] + ((j % 5) - 2) * 12, y2: f.sy(v) },
              }))),
              ...dotsFor(f, g),
              ...labelsFor(f),
              numLabel('gml', 600, f.sy(g.a.grand) - 8, g.a.grand, { cls: 'lab lab-gold', d: 2, pre: 'grand mean = ' }),
            ];
          },
        },
      ],
    },

    {
      title: 'split the budget in two',
      prose: `<p>Every plant's distance from the grand mean can be written as two hops:</p>
        <p><strong>Hop one</strong> — from the grand mean out to that plant's own group mean. That's the part explained by which treatment it got.<br>
        <strong>Hop two</strong> — from the group mean to the plant itself. That's the part nothing in the experiment explains.</p>
        <p>Square everything and — this is the algebraic miracle that makes ANOVA work — the two piles add up <em>exactly</em> to the total. No remainder. The cross terms cancel.</p>`,
      formula: formula(
        t('SS' + sub('', 'total'), { tone: 'gold', link: 'tot' }) + eq +
        t('SS' + sub('', 'between'), { tone: 'warm', link: 'btw', explain: 'How far the group means sit from the grand mean, weighted by group size.' }) +
        ' + ' + t('SS' + sub('', 'within'), { tone: 'cold', link: 'wth', explain: 'How far each point sits from its own group mean.' }) +
        `<br>` + sumOver(paren(sub('y', 'ij') + minus + bar('y')) + sup('', '2')) + eq +
        sumOver(sub('n', 'j') + paren(bar('y') + sub('', 'j') + minus + bar('y')) + sup('', '2')) + ' + ' +
        sumOver(paren(sub('y', 'ij') + minus + bar('y') + sub('', 'j')) + sup('', '2')),
        { size: 'sm', caption: 'the total spread, cut cleanly into explained and unexplained' }),
      readouts: [
        { key: 'ssb', label: 'SS between', tone: 'warm', get: s => G(s).a.ssb, d: 2, wide: true },
        { key: 'ssw', label: 'SS within', tone: 'cold', get: s => G(s).a.ssw, d: 2, wide: true },
        { key: 'sst', label: 'SS total', tone: 'gold', get: s => G(s).a.sst, d: 2, wide: true },
        { key: 'chk', label: 'between + within', get: s => G(s).a.ssb + G(s).a.ssw, d: 2, wide: true, explain: 'Compare with SS total. They are identical, always.' },
      ],
      controls: [
        { type: 'slider', key: 'shift', label: 'push treatment 2 up/down', min: -1.5, max: 2, step: 0.05, fast: true, fmt: v => (+v >= 0 ? '+' : '') + (+v).toFixed(2) + ' g' },
      ],
      beats: [
        {
          label: 'hop one: between',
          note: 'The group means, compared with the grand mean. <b>Push treatment 2 with the slider</b> and watch this pile grow.',
          scene: s => {
            const g = G(s), f = gframe(g);
            const means = g.groups.map(st.mean);
            return [
              ...axes(f, { yLabel: 'dried weight (g)', showX: false, xN: 0 }),
              hLine(f, g.a.grand, { key: 'gm', cls: 'rule-gold rule-dash' }),
              ...dotsFor(f, g, { opacity: 0.25 }),
              ...means.map((m, i) => ({
                key: `mn-${i}`, tag: 'line', cls: 'rule', dur: 250,
                attrs: { x1: XS[i] - 52, y1: f.sy(m), x2: XS[i] + 52, y2: f.sy(m) },
              })),
              ...means.map((m, i) => ({
                key: `bt-${i}`, tag: 'line', cls: 'stick stick-pos link-btw', dur: 250, delay: i * 130,
                attrs: { x1: XS[i], y1: f.sy(g.a.grand), x2: XS[i], y2: f.sy(m) },
                tip: `${NAMES[i]}<br>mean ${m.toFixed(2)}, off the grand mean by <b>${(m - g.a.grand).toFixed(2)}</b>`,
              })),
              ...labelsFor(f),
              numLabel('ssb', f.midX, f.y1 + 6, g.a.ssb, { cls: 'lab-big lab-mid lab-warm', d: 2, pre: 'SS between = ', dur: 250 }),
            ];
          },
        },
        {
          label: 'hop two: within',
          note: 'Each plant against its <b>own</b> group mean. This pile is the natural variation between plants — the noise.',
          scene: s => {
            const g = G(s), f = gframe(g);
            const means = g.groups.map(st.mean);
            return [
              ...axes(f, { yLabel: 'dried weight (g)', showX: false, xN: 0 }),
              ...means.map((m, i) => ({
                key: `mn-${i}`, tag: 'line', cls: 'rule', dur: 250,
                attrs: { x1: XS[i] - 52, y1: f.sy(m), x2: XS[i] + 52, y2: f.sy(m) },
              })),
              ...g.groups.flatMap((grp, i) => grp.map((v, j) => ({
                key: `wt-${i}-${j}`, tag: 'line', cls: 'stick stick-neg link-wth', delay: (i * 10 + j) * 20, dur: 250,
                attrs: { x1: XS[i] + ((j % 5) - 2) * 12, y1: f.sy(means[i]), x2: XS[i] + ((j % 5) - 2) * 12, y2: f.sy(v) },
              }))),
              ...dotsFor(f, g),
              ...labelsFor(f),
              numLabel('ssw', f.midX, f.y1 + 6, g.a.ssw, { cls: 'lab-big lab-mid lab-cold', d: 2, pre: 'SS within = ', dur: 250 }),
            ];
          },
        },
        {
          label: 'the two piles',
          hold: 1800,
          note: 'Stacked side by side. The bar on the left is the whole budget; the bar on the right is how it was divided.',
          scene: s => {
            const g = G(s), a = g.a;
            const f = F();
            const top = 120, bot = 440, H = bot - top;
            const fr = a.ssb / a.sst;
            return [
              label('t1', 240, top - 26, 'total spread', { cls: 'lab lab-mid lab-gold' }),
              rect('tot', 190, top, 100, H, { cls: 'bar bar-dim', dur: 400 }),
              numLabel('totv', 240, bot + 22, a.sst, { cls: 'lab lab-mid lab-gold', d: 2, dur: 400 }),
              label('t2', 470, top - 26, 'split into', { cls: 'lab lab-mid' }),
              rect('btw', 420, top, 100, H * fr, { cls: 'bar bar-warm', dur: 700 }),
              rect('wth', 420, top + H * fr, 100, H * (1 - fr), { cls: 'bar bar-cold', dur: 700 }),
              label('bl', 540, top + (H * fr) / 2 + 4, `between · ${a.ssb.toFixed(2)}`, { cls: 'lab lab-warm', dur: 700 }),
              label('wl', 540, top + H * fr + (H * (1 - fr)) / 2 + 4, `within · ${a.ssw.toFixed(2)}`, { cls: 'lab lab-cold', dur: 700 }),
              path('ar', [[300, top + H / 2], [408, top + H / 2]], { cls: 'arrow' }),
              numLabel('eta', f.midX, 490, a.eta2, { cls: 'lab-big lab-mid lab-green', d: 3, pre: 'η² = ', suf: '  (the share explained by treatment)', fmt: v => st.fmtR(v, 3) }),
            ];
          },
        },
      ],
    },

    {
      title: 'turn the piles into a ratio',
      prose: `<p>You can't compare the two piles directly — "between" is built from 3 numbers and "within" from 30. So divide each by its degrees of freedom to get an <strong>average square per free piece of information</strong>. That's a mean square.</p>
        <p>Then take the ratio. If treatment does nothing, both mean squares are estimating the same background variance and F lands near 1. If treatment does something, the top swells and F climbs.</p>`,
      formula: formula(
        t('F', { tone: 'gold', explain: 'The ratio of two variance estimates.' }) + eq +
        frac(t('MS' + sub('', 'between'), { tone: 'warm' }), t('MS' + sub('', 'within'), { tone: 'cold' })) +
        op('&nbsp;=&nbsp;') +
        frac('SS' + sub('', 'b') + ' / ' + t('(k − 1)', { tone: 'muted', explain: 'k groups, minus one for the grand mean.' }),
          'SS' + sub('', 'w') + ' / ' + t('(N − k)', { tone: 'muted', explain: 'N observations, minus one mean per group.' })),
        { caption: 'signal variance ÷ noise variance' }),
      aside: `<b>F and t are the same test when k = 2.</b> Run an ANOVA on two groups and you get F exactly equal to the square of the pooled t. ANOVA is what a t-test becomes when it has to handle more than two things at once.`,
      readouts: [
        { key: 'msb', label: 'MS between', tone: 'warm', get: s => G(s).a.msb, d: 3, wide: true },
        { key: 'msw', label: 'MS within', tone: 'cold', get: s => G(s).a.msw, d: 3, wide: true },
        { key: 'F', label: 'F', tone: 'gold', get: s => G(s).a.F, d: 3 },
        { key: 'df', label: 'df', get: s => `${G(s).a.dfb}, ${G(s).a.dfw}` },
        { key: 'p', label: 'p', tone: 'gold', get: s => G(s).a.p, fmt: st.fmtP, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'shift', label: 'push treatment 2 up/down', min: -1.5, max: 2, step: 0.05, fast: true, fmt: v => (+v >= 0 ? '+' : '') + (+v).toFixed(2) + ' g' },
        { type: 'slider', key: 'n', label: 'plants per group', min: 3, max: 10, step: 1, fast: true },
      ],
      beats: [
        {
          label: 'the F distribution',
          note: 'The curve is what F looks like when every treatment is secretly identical. Move the slider and watch our F walk into the tail.',
          scene: s => {
            const a = G(s).a;
            const f = F();
            const lim = Math.max(6, a.F * 1.35);
            f.setX(0, lim);
            f.setY(0, 0.95);
            return [
              ...axes(f, { xLabel: 'F', yLabel: 'density', yN: 4 }),
              fnArea(f, x => st.fPdf(x, a.dfb, a.dfw), a.F, lim, { key: 'tail', cls: 'area area-warm', base: 0, dur: 260 }),
              fnPath(f, x => st.fPdf(x, a.dfb, a.dfw), { key: 'c', cls: 'curve', n: 240, dur: 260 }),
              { key: 'fv', tag: 'line', cls: 'rule-gold', dur: 260, attrs: { x1: f.sx(a.F), y1: f.y0, x2: f.sx(a.F), y2: f.y1 } },
              numLabel('fl', f.sx(a.F), f.y1 + 6, a.F, { cls: 'lab-big lab-gold lab-mid', d: 2, pre: 'F = ', dur: 260 }),
              label('pl', f.midX, f.y1 + 26, `p = ${st.fmtP(a.p)}`, { cls: 'lab lab-mid lab-gold', dur: 260 }),
              label('one', f.sx(1), f.y0 + 22, 'F = 1 · what pure noise gives you', { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
      ],
    },

    {
      title: 'why not just run three t-tests?',
      prose: `<p>With three groups there are three pairwise comparisons. With five groups there are ten. Each one gets its own 5% chance of a false alarm, and those chances stack up.</p>
        <p>Run enough tests and finding "something significant" stops being evidence of anything. <strong>Slide the number of groups</strong> and watch the probability of at least one false positive climb — with 10 groups and 45 comparisons, you are more likely than not to find a difference that isn't there.</p>
        <p>ANOVA sidesteps this by asking one question instead of many. If it comes back significant, <em>then</em> you go looking for which pairs differ — with a correction.</p>`,
      formula: formula(
        'P(at least one false alarm) ' + eq + ' 1 ' + minus + ' ' + paren('1 ' + minus + ' α') + sup('', 'm') +
        op('&nbsp;&nbsp;where&nbsp;&nbsp;') + 'm ' + eq + ' ' + frac('k(k − 1)', '2'),
        { caption: 'every extra group adds comparisons faster than you would guess' }),
      readouts: [
        { key: 'k', label: 'groups', get: s => s.kSim, d: 0 },
        { key: 'm', label: 'comparisons', tone: 'gold', get: s => (s.kSim * (s.kSim - 1)) / 2, d: 0, wide: true },
        { key: 'fw', label: 'chance of ≥1 false alarm', tone: 'warm', wide: true, get: s => (1 - 0.95 ** ((s.kSim * (s.kSim - 1)) / 2)) * 100, d: 1, suf: '%' },
      ],
      controls: [
        { type: 'slider', key: 'kSim', label: 'number of groups', min: 2, max: 12, step: 1, fast: true },
      ],
      beats: [
        {
          label: 'the inflation curve',
          note: 'Each dot is one extra group. The line is the chance that <b>at least one</b> of your comparisons lies to you.',
          scene: s => {
            const f = F();
            f.setX(2, 12); f.setY(0, 1);
            const pts = range(11).map(i => {
              const k = i + 2, m = (k * (k - 1)) / 2;
              return [f.sx(k), f.sy(1 - 0.95 ** m)];
            });
            const kk = s.kSim, mm = (kk * (kk - 1)) / 2;
            return [
              ...axes(f, { xLabel: 'number of groups', yLabel: 'P(at least one false positive)', xN: 5, yN: 5 }),
              rect('ok', f.x0, f.sy(0.05), f.x1 - f.x0, f.y0 - f.sy(0.05), { cls: 'sq sq-pos', opacity: 0.3 }),
              hLine(f, 0.05, { key: 'a', cls: 'rule-gold rule-dash' }),
              label('al', f.x0 + 6, f.sy(0.05) - 8, 'the 5% you thought you were getting', { cls: 'lab-sm lab-gold' }),
              path('c', pts, { cls: 'curve curve-warm' }),
              ...pts.map((p, i) => ({ key: `d-${i}`, tag: 'circle', cls: 'pt pt-warm', attrs: { cx: p[0], cy: p[1], r: 4 } })),
              { key: 'now', tag: 'circle', cls: 'pt pt-green', dur: 200, attrs: { cx: f.sx(kk), cy: f.sy(1 - 0.95 ** mm), r: 8 } },
              label('nl', f.sx(kk), f.sy(1 - 0.95 ** mm) - 16,
                `${mm} comparison${mm === 1 ? '' : 's'} → ${((1 - 0.95 ** mm) * 100).toFixed(0)}%`,
                { cls: 'lab lab-mid lab-green', dur: 200 }),
            ];
          },
        },
      ],
    },

    {
      title: 'anova is regression wearing a costume',
      prose: `<p>One last thing worth seeing, because it collapses two topics into one.</p>
        <p>Code the groups as dummy variables — a column that's 1 if the plant was in treatment 1 and 0 otherwise, another for treatment 2 — and run a plain multiple regression. You get exactly the same F, the same p, and the same η², which regression calls R².</p>
        <p>There is no separate "ANOVA machine". There is a linear model, and ANOVA is a way of laying out its output when the predictors happen to be categories.</p>`,
      dep: { note: 'The dummy-variable version is ordinary least squares with two predictors.', lesson: 'multiple', label: 'multiple regression' },
      readouts: [
        { key: 'F', label: 'F from ANOVA', tone: 'gold', get: s => G(s).a.F, d: 4, wide: true },
        { key: 'Fr', label: 'F from regression', tone: 'green', get: s => dummyFit(G(s).groups).F, d: 4, wide: true },
        { key: 'e', label: 'η²', tone: 'gold', get: s => G(s).a.eta2, d: 4, fmt: v => st.fmtR(v, 4) },
        { key: 'r2', label: 'R²', tone: 'green', get: s => dummyFit(G(s).groups).r2, d: 4, fmt: v => st.fmtR(v, 4) },
      ],
      beats: [
        {
          label: 'the design matrix',
          note: 'Two columns of zeros and ones. The regression coefficients turn out to be the <b>differences from the control group</b>.',
          scene: s => {
            const g = G(s);
            const fit = dummyFit(g.groups);
            const rows = [];
            const y0 = 120, rh = 22;
            const showRows = Math.min(9, g.groups[0].length * 3);
            let idx = 0;
            const items = [
              label('h0', 240, y0 - 16, 'intercept', { cls: 'lab-sm lab-mid' }),
              label('h1', 320, y0 - 16, 'trt1', { cls: 'lab-sm lab-mid' }),
              label('h2', 400, y0 - 16, 'trt2', { cls: 'lab-sm lab-mid' }),
              label('h3', 490, y0 - 16, 'weight', { cls: 'lab-sm lab-mid' }),
            ];
            for (let gi = 0; gi < 3; gi++) {
              for (let j = 0; j < 3; j++) {
                const y = y0 + idx * rh;
                items.push(label(`r${idx}n`, 190, y, NAMES[gi], { cls: 'lab-sm lab-end' }));
                items.push(label(`r${idx}a`, 240, y, '1', { cls: 'lab-sm lab-mid lab-gold' }));
                items.push(label(`r${idx}b`, 320, y, gi === 1 ? '1' : '0', { cls: `lab-sm lab-mid ${gi === 1 ? 'lab-warm' : ''}` }));
                items.push(label(`r${idx}c`, 400, y, gi === 2 ? '1' : '0', { cls: `lab-sm lab-mid ${gi === 2 ? 'lab-green' : ''}` }));
                items.push(label(`r${idx}d`, 490, y, g.groups[gi][j].toFixed(2), { cls: 'lab-sm lab-mid' }));
                idx++;
              }
              if (gi < 2) items.push(label(`dots${gi}`, 360, y0 + idx * rh - 4, '⋯', { cls: 'lab-sm lab-mid' }));
            }
            items.push(label('res', 360, y0 + idx * rh + 34,
              `b₀ = ${fit.beta[0].toFixed(2)}   b_trt1 = ${fit.beta[1].toFixed(2)}   b_trt2 = ${fit.beta[2].toFixed(2)}`,
              { cls: 'lab-big lab-mid lab-green' }));
            items.push(label('res2', 360, y0 + idx * rh + 56,
              'the intercept is the control mean; each slope is a gap from it', { cls: 'lab-sm lab-mid' }));
            return items;
          },
        },
      ],
    },
  ],
};

function dummyFit(groups) {
  const X = [], y = [];
  groups.forEach((g, i) => g.forEach(v => { X.push([i === 1 ? 1 : 0, i === 2 ? 1 : 0]); y.push(v); }));
  return st.mlr(X, y);
}
