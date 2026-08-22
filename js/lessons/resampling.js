/* ─────────────────────────────────────────────────────────────────────────────
   resampling.js — permutation and bootstrap. When you cannot write down the
   sampling distribution, build it by brute force instead.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, fnArea, strip, histBars, arrowDefs } from '../core/plot.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sqrt, sub, sup, bar, paren, eq, minus, op } from '../core/fx.js';

const F = () => frame({ w: 720, h: 540, l: 66, r: 28, t: 34, b: 58 });

const CTRL = [4.17, 5.58, 5.18, 6.11, 4.50, 4.61, 5.17, 4.53, 5.33, 5.14];
const TRT = [6.31, 5.12, 5.54, 5.50, 5.37, 5.29, 4.92, 6.15, 5.80, 5.26];

const STATS = {
  meandiff: { label: 'difference in means', fn: (a, b) => st.mean(a) - st.mean(b) },
  meddiff: { label: 'difference in medians', fn: (a, b) => st.median(a) - st.median(b) },
  trimmed: { label: 'difference in 20% trimmed means', fn: (a, b) => trim(a) - trim(b) },
  sdratio: { label: 'ratio of spreads', fn: (a, b) => st.sd(a) / st.sd(b) },
};
function trim(a) {
  const s = [...a].sort((u, v) => u - v);
  const k = Math.floor(s.length * 0.2);
  return st.mean(s.slice(k, s.length - k));
}

const permCache = new Map();
function perm(s) {
  const key = `${s.stat}|${s.iters}|${s.seed}`;
  if (!permCache.has(key)) {
    permCache.set(key, st.permutationTest(TRT, CTRL, {
      iters: +s.iters, seed: 5 + +s.seed, stat: STATS[s.stat].fn,
    }));
  }
  return permCache.get(key);
}

const bootCache = new Map();
function boot(s) {
  const key = `${s.bstat}|${s.iters}|${s.seed}`;
  if (!bootCache.has(key)) {
    const fn = s.bstat === 'median' ? st.median
      : s.bstat === 'sd' ? st.sd
        : s.bstat === 'max' ? (a => Math.max(...a))
          : st.mean;
    bootCache.set(key, st.bootstrap(CTRL, fn, { iters: +s.iters, seed: 9 + +s.seed }));
  }
  return bootCache.get(key);
}

export default {
  meta: {
    id: 'resampling', title: 'permutation & bootstrap', kicker: 'BUILD THE NULL BY HAND',
    status: 'live',
    deck: 'Every test so far compared a statistic against a distribution somebody derived with algebra — a t, an F, a chi-square. Resampling skips the algebra. Shuffle the data a few thousand times and <em>watch</em> what the null world produces. It works for statistics nobody ever derived a formula for.',
    dataNote: 'Data: R\'s <code>PlantGrowth</code>, control versus treatment 2. The shuffling and resampling happen live in your browser from a fixed seed, so you can change the number of iterations and watch the answer stabilise.',
    deps: ['nonparametric', 'clt'], unlocks: [],
    next: 'decisiontheory', nextLabel: 'decision theory',
    outro: 'if you can compute it, you can get a standard error for it.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { stat: 'meandiff', bstat: 'mean', iters: 2000, seed: 0, shown: 1 },

  steps: [
    {
      title: 'if the label meant nothing, shuffling would not matter',
      prose: `<p>Here is the whole idea of a permutation test, and it is close to being obvious once you see it.</p>
        <p>Twenty plants. Ten got labelled "control", ten "treatment". <strong>If the treatment does nothing</strong>, then those labels are arbitrary stickers — the plant would have weighed exactly what it weighs regardless of which pile it landed in.</p>
        <p>So peel the labels off, shuffle them, stick them back on, and recompute the difference in means. Do it again. Do it a few thousand times. What you build is the distribution of differences that a world with no treatment effect actually produces.</p>`,
      formula: formula(
        t('H₀', { tone: 'muted' }) + ': the labels are exchangeable' +
        op('&nbsp;&nbsp;→&nbsp;&nbsp;') +
        t('every reshuffle is as likely as the one you saw', { tone: 'green' }),
        { size: 'sm', caption: 'no formula, no distribution to look up' }),
      readouts: [
        { key: 'obs', label: 'observed difference', tone: 'gold', get: s => STATS[s.stat].fn(TRT, CTRL), d: 3, wide: true },
        { key: 'sh', label: 'this shuffle gives', tone: 'warm', get: s => perm(s).dist[Math.min(+s.shown - 1, perm(s).dist.length - 1)], d: 3, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'shown', label: 'shuffle number', min: 1, max: 60, step: 1, fast: true },
      ],
      beats: [
        {
          label: 'the real labelling',
          hold: 1700,
          note: 'Twenty weights, split as they actually were. The gap between the two means is what we are trying to explain.',
          scene: s => {
            const f = F();
            f.setY(3.2, 6.8); f.setX(0, 720);
            const mc = st.mean(CTRL), mt = st.mean(TRT);
            return [
              ...axes(f, { yLabel: 'dried weight (g)', showX: false, xN: 0 }),
              ...strip(f, CTRL, 250, { key: 'c', cls: 'pt pt-cold', r: 7, seed: 3, stagger: 35 }),
              ...strip(f, TRT, 470, { key: 't', cls: 'pt pt-warm', r: 7, seed: 9, stagger: 35 }),
              { key: 'mc', tag: 'line', cls: 'rule-y', attrs: { x1: 190, y1: f.sy(mc), x2: 310, y2: f.sy(mc) } },
              { key: 'mt', tag: 'line', cls: 'rule-x', attrs: { x1: 410, y1: f.sy(mt), x2: 530, y2: f.sy(mt) } },
              label('lc', 250, f.y0 + 22, 'control', { cls: 'ax-label lab-mid' }),
              label('lt', 470, f.y0 + 22, 'treatment', { cls: 'ax-label lab-mid' }),
              numLabel('gap', 600, (f.sy(mc) + f.sy(mt)) / 2, mt - mc, {
                cls: 'lab-big lab-gold', d: 3, pre: 'gap = ',
              }),
            ];
          },
        },
        {
          label: 'shuffle the stickers',
          note: 'Same twenty weights, reassigned at random. <b>Step through the shuffles</b> — sometimes the fake gap is bigger than the real one, sometimes it points the other way.',
          scene: s => {
            const f = F();
            f.setY(3.2, 6.8); f.setX(0, 720);
            const pool = [...TRT, ...CTRL];
            const r = st.rng(5 + +s.shown);
            const p = [...pool];
            for (let i = p.length - 1; i > 0; i--) {
              const j = Math.floor(r() * (i + 1));
              [p[i], p[j]] = [p[j], p[i]];
            }
            const fa = p.slice(0, 10), fb = p.slice(10);
            const gap = st.mean(fa) - st.mean(fb);
            const real = st.mean(TRT) - st.mean(CTRL);
            return [
              ...axes(f, { yLabel: 'dried weight (g)', showX: false, xN: 0 }),
              ...strip(f, fb, 250, { key: 'c', cls: 'pt pt-cold', r: 7, seed: 3, dur: 300 }),
              ...strip(f, fa, 470, { key: 't', cls: 'pt pt-warm', r: 7, seed: 9, dur: 300 }),
              { key: 'mc', tag: 'line', cls: 'rule-y', dur: 300, attrs: { x1: 190, y1: f.sy(st.mean(fb)), x2: 310, y2: f.sy(st.mean(fb)) } },
              { key: 'mt', tag: 'line', cls: 'rule-x', dur: 300, attrs: { x1: 410, y1: f.sy(st.mean(fa)), x2: 530, y2: f.sy(st.mean(fa)) } },
              label('lc', 250, f.y0 + 22, 'labelled "control"', { cls: 'ax-label lab-mid' }),
              label('lt', 470, f.y0 + 22, 'labelled "treatment"', { cls: 'ax-label lab-mid' }),
              numLabel('gap', 600, f.midY, gap, { cls: 'lab-big lab-warm', d: 3, pre: 'fake gap = ', dur: 300 }),
              label('cmp', 376, f.y1 + 6,
                Math.abs(gap) >= Math.abs(real) ? 'this shuffle beat the real gap' : 'smaller than the real gap',
                { cls: `lab lab-mid ${Math.abs(gap) >= Math.abs(real) ? 'lab-warm' : ''}`, dur: 300 }),
            ];
          },
        },
      ],
    },

    {
      title: 'the p-value becomes a count',
      prose: `<p>Collect every shuffled gap into a histogram and you have built the null distribution with your bare hands. No t, no df, no lookup.</p>
        <p>Then the p-value is literally a proportion: <strong>how many of the fake worlds produced a gap at least as extreme as the real one?</strong> That is the definition of a p-value, stated without any of the machinery that usually obscures it.</p>
        <p>And because nothing was derived, you can swap the statistic. <strong>Change it below</strong> — medians, trimmed means, a ratio of spreads. The procedure does not care; there is no formula to break.</p>`,
      formula: formula(
        'p ' + eq + frac('#' + paren('|shuffled| ≥ |observed|') + ' + 1', 'shuffles + 1') +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('the +1 counts the real labelling, which is itself one arrangement', { cls: 'fx-muted' }),
        { size: 'sm', caption: 'a p-value with the algebra removed' }),
      readouts: [
        { key: 'obs', label: 'observed', tone: 'gold', get: s => perm(s).obs, d: 3, wide: true },
        { key: 'n', label: 'shuffles', get: s => +s.iters, d: 0 },
        { key: 'p', label: 'permutation p', tone: 'warm', get: s => perm(s).p, fmt: st.fmtP, wide: true },
        { key: 'pt', label: 'Welch t p', tone: 'cold', get: () => st.tTestTwoSample(TRT, CTRL).p, fmt: st.fmtP, wide: true },
      ],
      controls: [
        { type: 'segment', key: 'stat', label: 'statistic', options: Object.entries(STATS).map(([k, v]) => ({ value: k, label: v.label.replace('difference in ', '').replace('ratio of ', '') })) },
        { type: 'slider', key: 'iters', label: 'shuffles', min: 100, max: 5000, step: 100, fast: true },
        { type: 'slider', key: 'seed', label: 'reroll', min: 0, max: 8, step: 1, fast: true, fmt: () => 'reroll' },
      ],
      beats: [
        {
          label: 'the null, built by hand',
          note: 'Every bar is thousands of parallel universes in which the treatment did nothing. The gold line is ours.',
          scene: s => {
            const P = perm(s);
            const f = F();
            const lim = Math.max(Math.abs(P.obs) * 1.3, ...P.dist.map(Math.abs)) * 1.05;
            const centre = s.stat === 'sdratio' ? 1 : 0;
            f.setX(centre - lim + (s.stat === 'sdratio' ? 1 : 0), centre + lim);
            const bins = st.histogram(P.dist, 44, [f.dx[0], f.dx[1]]);
            f.setY(0, Math.max(...bins.map(b => b.density)) * 1.15);
            return [
              ...axes(f, { xLabel: STATS[s.stat].label + ', under random relabelling', yLabel: 'density', yN: 4 }),
              ...histBars(f, bins, {
                key: 'h', cls: 'bar bar-dim', useDensity: true, dur: 240,
                tip: b => `${b.n} shuffles landed here`,
              }),
              ...bins.filter(b => Math.abs(b.x0 - centre) >= Math.abs(P.obs - centre) - 1e-9)
                .map((b, i) => rect(`x-${i}`, f.sx(b.x0) + 0.5, f.sy(b.density),
                  Math.max(0.5, f.sx(b.x1) - f.sx(b.x0) - 1), f.y0 - f.sy(b.density), { cls: 'bar bar-warm', dur: 240 })),
              vLine(f, P.obs, { key: 'obs', cls: 'rule-gold', dur: 240 }),
              label('ol', f.sx(P.obs), f.y1 + 8, `observed ${P.obs.toFixed(3)}`, { cls: 'lab lab-mid lab-gold', dur: 240 }),
              label('pl', 376, f.y0 - 14,
                `${Math.round(P.p * (P.iters + 1) - 1)} of ${P.iters} shuffles were at least this extreme → p = ${st.fmtP(P.p)}`,
                { cls: 'lab-big lab-mid lab-warm', dur: 240 }),
            ];
          },
        },
        {
          label: 'more shuffles, steadier answer',
          note: 'The p-value itself is estimated, so it has its own noise. A thousand shuffles pins it to about ±1%; ten thousand to ±0.3%.',
          scene: s => {
            const f = F();
            f.setX(100, 5000); f.setY(0, 0.15);
            const ns = [100, 250, 500, 1000, 2000, 3000, 4000, 5000];
            const ps = ns.map(n => st.permutationTest(TRT, CTRL, { iters: n, seed: 5 + +s.seed, stat: STATS[s.stat].fn }).p);
            return [
              ...axes(f, { xLabel: 'number of shuffles', yLabel: 'estimated p', yN: 5 }),
              hLine(f, 0.05, { key: 'a', cls: 'rule-gold rule-dash' }),
              path('c', ns.map((n, i) => [f.sx(n), f.sy(Math.min(ps[i], 0.15))]), { cls: 'curve curve-warm', dur: 260 }),
              ...ns.map((n, i) => ({
                key: `d-${i}`, tag: 'circle', cls: 'pt pt-warm', delay: i * 70, dur: 260,
                attrs: { cx: f.sx(n), cy: f.sy(Math.min(ps[i], 0.15)), r: 5 },
                tip: `${n} shuffles → p = ${st.fmtP(ps[i])}`,
              })),
              label('n', 376, f.y1 + 6, 'the Monte Carlo error is yours to choose — just run more', { cls: 'lab lab-mid' }),
            ];
          },
        },
      ],
    },

    {
      title: 'the bootstrap: resample your own data',
      prose: `<p>The permutation test answers "is there an effect?". The bootstrap answers the other question: <strong>how precisely do I know this number?</strong></p>
        <p>The move is audacious. You do not have the population, so you use your sample <em>as</em> the population — draw a new sample of the same size from it, with replacement, and recompute. Some observations appear twice, some not at all. That is exactly the sampling variation you cannot otherwise observe.</p>
        <p>The spread of those recomputed values estimates the standard error. Directly. For any statistic you can write code for.</p>`,
      formula: formula(
        t('resample', { tone: 'cyan' }) + ' n values, with replacement' +
        op('&nbsp;→&nbsp;') + t('recompute the statistic', { tone: 'gold' }) +
        op('&nbsp;→&nbsp;') + t('repeat', { tone: 'green' }) +
        `<br>` +
        'SE ' + eq + ' the standard deviation of what comes back',
        { size: 'sm', caption: 'the sampling distribution, faked from one sample' }),
      dep: { note: 'This is the sampling distribution from the CLT lesson, built instead of assumed.', lesson: 'clt', label: 'the clt' },
      readouts: [
        { key: 'obs', label: 'from the real sample', tone: 'gold', get: s => boot(s).obs, d: 4, wide: true },
        { key: 'se', label: 'bootstrap SE', tone: 'warm', get: s => boot(s).se, d: 4, wide: true },
        { key: 'form', label: 'formula SE (mean only)', tone: 'cold', get: () => st.sd(CTRL) / Math.sqrt(CTRL.length), d: 4, wide: true },
        { key: 'ci', label: '95% percentile CI', tone: 'green', wide: true, get: s => {
          const b = boot(s);
          return `${b.ci[0].toFixed(3)} – ${b.ci[1].toFixed(3)}`;
        } },
      ],
      controls: [
        { type: 'segment', key: 'bstat', label: 'statistic', options: [
          { value: 'mean', label: 'mean' }, { value: 'median', label: 'median' },
          { value: 'sd', label: 'sd' }, { value: 'max', label: 'maximum' },
        ] },
        { type: 'slider', key: 'iters', label: 'resamples', min: 200, max: 5000, step: 100, fast: true },
      ],
      beats: [
        {
          label: 'one resample',
          hold: 1800,
          note: 'Ten draws from the ten you have. Note the repeats — that is the point, not a bug.',
          scene: s => {
            const r = st.rng(31 + +s.seed);
            const picks = range(10).map(() => Math.floor(r() * 10));
            const counts = new Array(10).fill(0);
            picks.forEach(i => counts[i]++);
            const f = F();
            f.setX(-0.6, 9.6); f.setY(3.5, 6.5);
            return [
              ...axes(f, { xLabel: 'the ten control plants', yLabel: 'dried weight (g)', xN: 5 }),
              ...CTRL.map((v, i) => ({
                key: `o-${i}`, tag: 'circle', cls: counts[i] ? 'pt pt-cold' : 'pt-ghost', dur: 300,
                attrs: { cx: f.sx(i), cy: f.sy(v), r: counts[i] ? 5 + counts[i] * 3 : 6 },
                tip: counts[i] ? `drawn <b>${counts[i]}×</b>` : 'not drawn this time',
              })),
              ...CTRL.map((v, i) => label(`c-${i}`, f.sx(i), f.sy(v) - 18,
                counts[i] ? `×${counts[i]}` : '', { cls: 'lab-sm lab-mid lab-gold', dur: 300 })),
              hLine(f, st.mean(picks.map(i => CTRL[i])), { key: 'bm', cls: 'rule-gold', dur: 300 }),
              hLine(f, st.mean(CTRL), { key: 'om', cls: 'rule-faint rule-dash' }),
              label('l', 376, f.y1 + 6,
                `this resample's mean: ${st.mean(picks.map(i => CTRL[i])).toFixed(3)} · the real one: ${st.mean(CTRL).toFixed(3)}`,
                { cls: 'lab lab-mid', dur: 300 }),
              label('l2', 376, f.y1 + 28, 'hollow points were not drawn at all this time', { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
        {
          label: 'two thousand resamples',
          note: 'The spread of this histogram <b>is</b> the standard error. Switch the statistic to the median or the maximum — there is no formula for those, and the bootstrap does not notice.',
          scene: s => {
            const b = boot(s);
            const f = F();
            const lo = st.quantile(b.dist, 0.002), hi = st.quantile(b.dist, 0.998);
            f.setX(lo - (hi - lo) * 0.1, hi + (hi - lo) * 0.1);
            const bins = st.histogram(b.dist, 40, [f.dx[0], f.dx[1]]);
            f.setY(0, Math.max(...bins.map(x => x.density)) * 1.15);
            return [
              ...axes(f, { xLabel: `bootstrapped ${s.bstat}`, yLabel: 'density', yN: 4 }),
              ...histBars(f, bins, { key: 'h', cls: 'bar bar-cold', useDensity: true, dur: 240 }),
              rect('ci', f.sx(b.ci[0]), f.y0 - 12, f.sx(b.ci[1]) - f.sx(b.ci[0]), 12, { cls: 'sq sq-pos', dur: 240 }),
              vLine(f, b.obs, { key: 'obs', cls: 'rule-gold', dur: 240 }),
              label('l', 376, f.y1 + 6,
                `SE = ${b.se.toFixed(4)} · 95% interval ${b.ci[0].toFixed(3)} to ${b.ci[1].toFixed(3)}`,
                { cls: 'lab-big lab-mid lab-warm', dur: 240 }),
              ...(s.bstat === 'max' ? [label('w', 376, f.y0 - 26,
                'look at the shape — the bootstrap fails badly for a maximum', { cls: 'lab lab-mid lab-warm' })] : []),
            ];
          },
        },
      ],
    },

    {
      title: 'where the bootstrap breaks',
      prose: `<p>It is not magic, and the failure mode is worth being able to recognise.</p>
        <p>The bootstrap assumes your sample looks like the population. That is fine for a mean, tolerable for a median, and <strong>flatly false for anything that depends on the extremes</strong>. Set the statistic to the maximum: the bootstrapped distribution is a jagged staircase, because a resample can never contain a value larger than the largest one you happened to observe. The true sampling distribution of a maximum is nothing like that.</p>
        <p>Same problem, less visibly, with small samples, heavy tails, dependent observations, and anything near a boundary. The percentile interval also has no skew correction — BCa exists for that reason.</p>`,
      aside: `<b>The one-line rule.</b> The bootstrap works when your statistic is a smooth function of the data — means, differences, regression coefficients, correlations. It fails when the statistic hinges on a few particular observations. If you can move your statistic a lot by deleting one point, be suspicious.`,
      readouts: [
        { key: 'uniq', label: 'distinct values possible', tone: 'warm', get: s => new Set(boot(s).dist.map(v => v.toFixed(6))).size, d: 0, wide: true },
        { key: 'n', label: 'resamples', get: s => +s.iters, d: 0 },
        { key: 'bias', label: 'bootstrap bias', tone: 'cold', get: s => boot(s).bias, d: 4, wide: true },
      ],
      controls: [
        { type: 'segment', key: 'bstat', label: 'statistic', options: [
          { value: 'mean', label: 'mean' }, { value: 'median', label: 'median' },
          { value: 'sd', label: 'sd' }, { value: 'max', label: 'maximum' },
        ] },
      ],
      beats: [
        {
          label: 'smooth against jagged',
          note: 'The mean takes thousands of distinct values across resamples. The maximum takes <b>ten</b> — one for each observation that could be the biggest. That is the model failing, not the sampling.',
          scene: s => {
            const b = boot(s);
            const f = F();
            const lo = Math.min(...b.dist), hi = Math.max(...b.dist);
            const pad = (hi - lo) * 0.12 || 0.1;
            f.setX(lo - pad, hi + pad);
            const bins = st.histogram(b.dist, 60, [f.dx[0], f.dx[1]]);
            f.setY(0, Math.max(...bins.map(x => x.density)) * 1.15);
            const uniq = new Set(b.dist.map(v => v.toFixed(6))).size;
            return [
              ...axes(f, { xLabel: `bootstrapped ${s.bstat}`, yLabel: 'density', yN: 4 }),
              ...histBars(f, bins, { key: 'h', cls: uniq < 30 ? 'bar bar-warm' : 'bar bar-green', useDensity: true, dur: 240 }),
              label('l', 376, f.y1 + 6,
                `${uniq} distinct values across ${b.iters} resamples`,
                { cls: `lab-big lab-mid ${uniq < 30 ? 'lab-warm' : 'lab-green'}`, dur: 240 }),
              label('l2', 376, f.y1 + 28,
                uniq < 30 ? 'a staircase — the bootstrap cannot invent values it never saw'
                  : 'smooth — the statistic depends on all the data, not a few points',
                { cls: 'lab lab-mid', dur: 240 }),
            ];
          },
        },
      ],
    },

    {
      title: 'which one, when',
      prose: `<p>They answer different questions and are constantly confused with each other.</p>
        <p><strong>Permutation</strong> is for testing. It builds the distribution of a statistic <em>under a null hypothesis</em> by exploiting a symmetry — usually that group labels are exchangeable. It gives you a p-value and nothing else.</p>
        <p><strong>Bootstrap</strong> is for estimating uncertainty. It builds the sampling distribution of a statistic <em>as it actually is</em>, with no null hypothesis anywhere. It gives you a standard error and an interval.</p>
        <p>If you want both, you need both. And note what they share: neither one needed the central limit theorem, which is why they work for statistics whose sampling distribution nobody has ever written down.</p>`,
      readouts: [],
      beats: [
        {
          label: 'the two procedures',
          note: 'Same data, opposite purposes. The left column destroys the signal on purpose; the right column preserves it and shakes the sample instead.',
          scene: () => {
            const rows = [
              ['what it shuffles', 'the group labels', 'the observations themselves'],
              ['what it assumes', 'labels are exchangeable under H₀', 'the sample resembles the population'],
              ['what it gives you', 'a p-value', 'a standard error and an interval'],
              ['is there a null?', 'yes — it is the whole point', 'no — it never mentions one'],
              ['fails when', 'the exchangeability story is wrong', 'the statistic hinges on a few points'],
            ];
            const items = [
              label('h1', 200, 110, 'PERMUTATION', { cls: 'lab-big lab-mid lab-warm' }),
              label('h2', 540, 110, 'BOOTSTRAP', { cls: 'lab-big lab-mid lab-cyan' }),
            ];
            rows.forEach((r, i) => {
              const y = 170 + i * 66;
              items.push(rect(`bg-${i}`, 20, y - 26, 680, 56, { cls: 'cell', delay: i * 110, opacity: i % 2 ? 0.9 : 0.5 }));
              items.push(label(`n-${i}`, 34, y, r[0], { cls: 'lab-sm lab-gold', delay: i * 110 }));
              items.push(label(`a-${i}`, 200, y + 16, r[1], { cls: 'lab-sm lab-mid lab-warm', delay: i * 110 }));
              items.push(label(`b-${i}`, 540, y + 16, r[2], { cls: 'lab-sm lab-mid lab-cyan', delay: i * 110 }));
            });
            items.push(label('c', 376, 516, 'neither one needs the central limit theorem', { cls: 'lab lab-mid lab-green' }));
            return items;
          },
        },
      ],
    },
  ],
};
