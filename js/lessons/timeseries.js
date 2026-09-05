/* ─────────────────────────────────────────────────────────────────────────────
   timeseries.js — when the order of the rows is the data.

   Every other lesson on this site quietly assumed the observations were
   independent. Time series is the case where they are not, and the
   consequences are not subtle: a nominal 95% interval can cover 20% of the
   time, and two entirely unrelated series can be "significantly" correlated in
   three quarters of all attempts.

   Both of those are simulated live rather than asserted.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import {
  acf, pacf, acfBand, diff, decompose, arSeries, randomWalk, coverage, spurious,
} from '../core/tseries.js';
import { frame, points, label, numLabel, path, rect, fnPath, arrowDefs } from '../core/plot.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sqrt, sub, sup, hat, paren, eq, minus, plus, times, approx, op } from '../core/fx.js';

const N = 160;

/* ── the series on offer ──────────────────────────────────────────────────── */

const SERIES = (() => {
  const r = st.rng(2024);
  const noise = arSeries(N, 0, r).map(v => 50 + 6 * v);
  const memory = arSeries(N, 0.85, r).map(v => 50 + 6 * v);
  const walk = randomWalk(N, r, 1.4, 50);
  const rev = arSeries(N, -0.7, r).map(v => 50 + 6 * v);
  const seasonal = range(N).map(i =>
    50 + 0.09 * i + 7 * Math.sin((Math.PI * 2 * i) / 12 - 0.9)
    + 2.4 * Math.sin((Math.PI * 4 * i) / 12) + st.randNorm(r, 0, 1.6));
  return { noise, memory, walk, rev, seasonal };
})();
const SHAPES = [
  { k: 'noise', label: 'no memory' }, { k: 'memory', label: 'strong memory' },
  { k: 'walk', label: 'random walk' }, { k: 'rev', label: 'mean-reverting' },
  { k: 'seasonal', label: 'seasonal' },
];
const Y = s => SERIES[s.shape] || SERIES.memory;

/* the shuffled version, computed once so it does not flicker */
const SHUFFLED = Object.fromEntries(Object.entries(SERIES).map(([k, v]) => {
  const r = st.rng(9), a = v.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return [k, a];
}));

/* ── precomputed simulations ──────────────────────────────────────────────── */

const PHIS = [0, 0.2, 0.4, 0.6, 0.75, 0.85, 0.92, 0.96];
const COVER = PHIS.map(p => coverage(p, { n: 120, reps: 300 }));
const SPUR = { walk: spurious({ kind: 'walk', reps: 300 }), noise: spurious({ kind: 'noise', reps: 300 }) };

/* two specific unrelated walks, for the demonstration */
const PAIR = (() => {
  const r = st.rng(613);
  const a = randomWalk(N, r, 1), b = randomWalk(N, r, 1);
  const f = st.linreg(a, b);
  const rr = st.pearson(a, b);
  const tt = (rr * Math.sqrt(N - 2)) / Math.sqrt(1 - rr * rr);
  return { a, b, r: rr, p: st.tTest2(tt, N - 2), fit: f, da: diff(a), db: diff(b), dr: st.pearson(diff(a), diff(b)) };
})();

/* the forecast demonstration */
const FC = (() => {
  const r = st.rng(31);
  const y = randomWalk(N, r, 1.2, 50);
  const cut = 120;
  const train = y.slice(0, cut), future = y.slice(cut);
  const sdStep = st.sd(diff(train));
  return { y, cut, train, future, sdStep, last: train[cut - 1], mean: st.mean(train) };
})();

/* ── formula pieces ───────────────────────────────────────────────────────── */

const fRho = t('ρ' + sub('', 'k'), { explain: 'The autocorrelation at lag k: the correlation between the series and a copy of itself shifted k steps.', tone: 'gold', link: 'acf' });
const fPhi = t('φ', { explain: 'How much of the last value carries into this one. At exactly 1 the series has no mean to return to and everything downstream breaks.', tone: 'warm', link: 'phi' });

export default {
  meta: {
    id: 'timeseries', title: 'time series', short: 'time series',
    kicker: 'WHEN THE ORDER IS THE DATA', status: 'live',
    deck: 'Every other lesson here assumed your rows were independent. This is the case where they are not — and the damage is specific and severe. A nominal 95% interval can cover a fifth of the time, and two series with nothing whatsoever to do with each other come out significantly correlated in three attempts out of four. Both are simulated live below.',
    dataNote: 'Simulated series with known properties, so that when a method fails you can see exactly what it failed to notice. The two headline failures are run three hundred times each in your browser.',
    deps: ['processes', 'periodic', 'linreg'], unlocks: [],
    next: 'dags', nextLabel: 'causal diagrams',
    outro: 'the first question is never which model. it is whether the series is stationary, and if it is not, nothing you compute on it means what you think.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { shape: 'memory', lag: 1, phi: 0.85, d: 0, kind: 'walk', h: 24, fold: 'rolling' },

  steps: [

    /* ── 1 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'shuffle the rows and see what breaks',
      prose: `<p>A hundred and sixty numbers, in order.</p>
        <p>Now shuffle them. Every summary statistic you know is untouched — same mean, same variance, same minimum, same quantiles, same histogram, exactly. Nothing in a standard summary can tell the two apart.</p>
        <p>And yet something has obviously been destroyed. Whatever that something is, it lives in the <em>order</em>, and no method in the rest of this site would have noticed it was there.</p>`,
      controls: [
        { type: 'segment', key: 'shape', label: 'series', options: SHAPES.map(x => ({ value: x.k, label: x.label })) },
      ],
      readouts: [
        { key: 'm', label: 'mean', tone: 'muted', get: s => st.mean(Y(s)), d: 3 },
        { key: 'sd', label: 'sd', tone: 'muted', get: s => st.sd(Y(s)), d: 3 },
        { key: 'md', label: 'median', tone: 'muted', get: s => st.median(Y(s)), d: 3 },
        { key: 'diff', label: 'difference after shuffling', tone: 'green', get: () => 'none at all', wide: true },
      ],
      beats: [
        { label: 'in order', hold: 1500, note: 'The series as recorded.', scene: s => shuffle(s, 0) },
        { label: 'shuffled', hold: 1700, note: 'The same 160 numbers, in a different order. Every statistic above is identical to the decimal.', scene: s => shuffle(s, 1) },
        { label: 'both at once', hold: 1800, note: 'One of these carries information the other does not, and no histogram will ever say so.', scene: s => shuffle(s, 2) },
        { label: 'try the others', note: 'Switch series. On <b>no memory</b> the shuffle changes nothing meaningful — there was nothing in the order to begin with.', scene: s => shuffle(s, 2) },
      ],
    },

    /* ── 2 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'correlate the series with itself',
      prose: `<p>Here is the measurement that catches it, and you already own the tool.</p>
        <p>Take the series. Take a copy of it shifted one step back. Line them up and correlate them — an ordinary Pearson r, on two ordinary columns.</p>
        <p>If today tends to resemble yesterday, that correlation is positive and the scatter tilts. That number is the <strong>autocorrelation at lag 1</strong>, and it is the only genuinely new idea in this lesson.</p>
        <p>Drag the lag to shift further back.</p>`,
      formula: formula(
        fRho + eq + 'cor' + paren('y' + sub('', 't') + ', y' + sub('', 't−k')) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('the same r, on the series and a shifted copy of itself', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'nothing new — a correlation between two columns, one of which you made' }),
      dep: { note: 'this is exactly', lesson: 'correlation', label: "pearson's r" },
      controls: [
        { type: 'slider', key: 'lag', label: 'lag k', min: 1, max: 24, step: 1, fast: true },
        { type: 'segment', key: 'shape', label: 'series', options: SHAPES.map(x => ({ value: x.k, label: x.label })) },
      ],
      readouts: [
        { key: 'k', label: 'lag', tone: 'gold', get: s => +s.lag, d: 0 },
        { key: 'r', label: 'correlation at this lag', tone: 'cyan', get: s => acf(Y(s), 24)[+s.lag], d: 4, wide: true },
        { key: 'n', label: 'pairs available', tone: 'muted', get: s => N - +s.lag, d: 0, wide: true },
      ],
      beats: [
        { label: 'the series', hold: 1300, note: 'One column of numbers, in order.', scene: s => lagScene(s, 0) },
        { label: 'and a shifted copy', hold: 1600, note: 'The same series, moved one step. Now every point has a partner: today, and yesterday.', scene: s => lagScene(s, 1) },
        { label: 'plot the pairs', hold: 1800, note: 'Yesterday across, today up. A tilt means the series remembers.', scene: s => lagScene(s, 2) },
        { label: 'your turn', note: 'Push the lag out. On a series with memory the tilt fades gradually; on a random walk it barely fades at all.', scene: s => lagScene(s, 2) },
      ],
    },

    /* ── 3 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'every lag at once: the acf',
      prose: `<p>Do that at every lag and plot the answers. That is the <strong>autocorrelation function</strong>, and its <em>shape</em> is diagnostic in a way that no single number is.</p>
        <p><strong>Fast decay</strong> — the series remembers a little and then forgets. <strong>Barely decaying</strong> — a random walk, and it has no mean to return to. <strong>Alternating</strong> — mean reversion, overcorrecting each step. <strong>A spike at 12</strong> — seasonality, and the spike tells you the period without your having to guess it.</p>
        <p>The dashed band is where an autocorrelation is indistinguishable from zero. Bars inside it are nothing.</p>`,
      controls: [
        { type: 'segment', key: 'shape', label: 'series', options: SHAPES.map(x => ({ value: x.k, label: x.label })) },
      ],
      readouts: [
        { key: 'r1', label: 'lag 1', tone: 'gold', get: s => acf(Y(s), 24)[1], d: 3, wide: true },
        { key: 'r12', label: 'lag 12', tone: 'purple', get: s => acf(Y(s), 24)[12], d: 3, wide: true },
        { key: 'sig', label: 'lags outside the band', tone: 'cyan', get: s => acf(Y(s), 24).slice(1).filter(v => Math.abs(v) > acfBand(N)).length, d: 0, wide: true },
        { key: 'v', label: 'what that shape means', get: s => ({ noise: 'no memory at all', memory: 'short memory, decaying', walk: 'a random walk — no mean to return to', rev: 'mean reversion, overshooting', seasonal: 'a cycle, at whatever lag spikes' }[s.shape]), wide: true },
      ],
      beats: [
        { label: 'the acf', hold: 1600, note: 'One bar per lag. Lag 0 is always 1 and is not drawn.', scene: s => acfScene(s, 1) },
        { label: 'the significance band', hold: 1600, note: '±2/√n. Anything inside it could be nothing.', scene: s => acfScene(s, 2) },
        { label: 'the partial acf', hold: 1900, note: 'The correlation at lag k with all the shorter lags already accounted for. A series with one step of memory has one spike here and nothing after — however slowly its plain ACF decays.', scene: s => acfScene(s, 3) },
        { label: 'cycle the shapes', note: 'Switch between the five and learn the four signatures. This is most of what reading an ACF is.', scene: s => acfScene(s, 3) },
      ],
    },

    /* ── 4 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'independence was holding the whole building up',
      prose: `<p>Now the damage, and it is worse than most people expect.</p>
        <p>The standard error of a mean is σ⁄√n. That formula counts every observation as a fresh piece of information — which is exactly what autocorrelation means you do not have. Two neighbouring observations that are 85% alike are not two facts. They are about one and a bit.</p>
        <p>So here is the experiment. Simulate a series with known memory, compute an ordinary 95% interval for its mean the ordinary way, and check whether it actually contains the truth. Three hundred times, at each setting.</p>
        <p>At φ = 0 it works: 95% of the intervals contain the answer. At φ = 0.85 <strong>fewer than half of them do</strong>. The interval did not get wider to warn you. It just started being wrong.</p>`,
      formula: formula(
        'n' + sub('', 'eff') + approx + 'n' + times + frac('1' + minus + fPhi, '1' + plus + fPhi) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('at φ = 0.85, 120 observations are worth about 10', { tone: 'warm', cls: 'fx-tiny' }),
        { caption: 'the standard error you computed was for a sample you did not have' }),
      controls: [
        { type: 'slider', key: 'phi', label: 'how much it remembers  (φ)', min: 0, max: 0.96, step: 0.02, fast: true, fmt: v => (+v).toFixed(2) },
      ],
      readouts: [
        { key: 'p', label: 'φ', tone: 'gold', get: s => +s.phi, d: 2 },
        { key: 'c', label: 'a "95%" interval actually covers', tone: 'warm', get: s => coverAt(+s.phi) * 100, d: 1, suf: '%', wide: true },
        { key: 'ne', label: 'effective sample size', tone: 'cyan', get: s => (120 * (1 - +s.phi)) / (1 + +s.phi), d: 1, suf: ' of 120', wide: true },
        { key: 'f', label: 'so the se is too small by', tone: 'cold', get: s => Math.sqrt((1 + +s.phi) / (1 - +s.phi)), d: 2, suf: '×', wide: true },
      ],
      beats: [
        { label: 'independent data', hold: 1600, note: 'φ = 0. Three hundred intervals; about fifteen of them miss. Exactly as advertised.', scene: s => cover(s, 0) },
        { label: 'a little memory', hold: 1700, note: 'φ = 0.4. Already down to about two thirds. Nothing in the output of your software says so.', scene: s => cover(s, 0.4) },
        { label: 'a lot', hold: 1900, note: 'φ = 0.85. Under half. You would be reporting a 95% interval that is wrong more often than a coin.', scene: s => cover(s, 0.85) },
        { label: 'the whole curve', hold: 1800, note: 'Coverage against memory. It does not degrade gently — it falls off a cliff somewhere around 0.5.', scene: s => cover(s, +s.phi, true) },
        { label: 'your turn', note: 'Drag φ and watch the effective sample size collapse. This is the single most under-appreciated fact in applied statistics.', scene: s => cover(s, +s.phi, true) },
      ],
    },

    /* ── 5 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'two things with nothing to do with each other',
      prose: `<p>The famous failure, and it is worth being shocked by.</p>
        <p>Two random walks. Generated independently, in separate function calls, with no shared input of any kind. Regress one on the other.</p>
        <p>r = ${'{r}'}. p ${'{p}'}. Both series are pure noise accumulated, and there is no relationship between them because there is no mechanism by which there could be.</p>
        <p>Do it three hundred times and <strong>76% of the pairs come out significant at p &lt; 0.05</strong>. The test is supposed to do that 5% of the time.</p>`,
      readouts: [
        { key: 'r', label: 'r between the two', tone: 'warm', get: () => PAIR.r, d: 3, wide: true },
        { key: 'p', label: 'p-value', tone: 'warm', get: () => PAIR.p, d: 6, fmt: v => st.fmtP(v), wide: true },
        { key: 'tr', label: 'true relationship', tone: 'green', get: () => 'none whatsoever', wide: true },
      ],
      beats: [
        { label: 'the first walk', hold: 1300, note: 'A cumulative sum of random steps. Nothing else.', scene: s => pair(s, 1) },
        { label: 'the second', hold: 1400, note: 'Another one, generated separately. They share nothing but a random number generator.', scene: s => pair(s, 2) },
        { label: 'plot one against the other', hold: 1700, note: 'A convincing straight line, a large r, and a p-value most people would publish.', scene: s => pair(s, 3) },
        { label: 'three hundred pairs', hold: 1900, note: 'The distribution of r across three hundred independent attempts. If the test were working, this would be a narrow spike at zero — the grey one is what independent noise actually gives.', scene: s => pair(s, 4) },
        { label: 'how often it "works"', note: 'Seventy-six percent significant, at a threshold designed to be wrong five percent of the time.', scene: s => pair(s, 5) },
      ],
      aside: `<p><strong>Why it happens.</strong> Both series wander. A series that wanders spends long stretches above its own average and long stretches below it, and so does the other one. Any two series that each drift will spend most of their time drifting <em>somewhere</em> together, and a correlation cannot tell that apart from a relationship. The problem is not that the walks are similar. It is that the test assumes each observation is a fresh draw, and in a walk none of them are.</p>`,
    },

    /* ── 6 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'difference it: model the change, not the level',
      prose: `<p>The fix is one line, and it is the reason forecasting textbooks talk about differencing before they talk about anything else.</p>
        <p>Stop modelling where the series <em>is</em> and model how much it <strong>moved</strong>. Subtract each value from the one before it.</p>
        <p>A random walk's changes are exactly the independent noise it was built from — so a walk differenced once is white noise, its ACF collapses, and the spurious correlation with the other walk evaporates. Do it and the significance rate drops from 76% to about 5%, which is where it was always supposed to be.</p>
        <p>Toggle the differencing and watch all four panels change together.</p>`,
      formula: formula(
        '∇y' + sub('', 't') + eq + 'y' + sub('', 't') + minus + 'y' + sub('', 't−1') +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') +
        t('one difference removes a trend; two removes a bending one', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'and each one costs you an observation, which is the entire price' }),
      controls: [
        { type: 'slider', key: 'd', label: 'times differenced', min: 0, max: 2, step: 1, fast: true },
      ],
      readouts: [
        { key: 'd', label: 'differenced', tone: 'gold', get: s => +s.d, d: 0, suf: '×' },
        { key: 'r', label: 'r between the two series', tone: 'warm', get: s => corrAt(+s.d), d: 3, wide: true },
        { key: 'a', label: 'lag-1 autocorrelation', tone: 'cyan', get: s => acf(diff(PAIR.a, +s.d), 4)[1], d: 3, wide: true },
        { key: 'sg', label: 'significant, over 300 pairs', tone: 'green', get: s => (+s.d === 0 ? SPUR.walk.sig : SPUR.noise.sig) * 100, d: 1, suf: '%', wide: true },
      ],
      beats: [
        { label: 'the levels', hold: 1600, note: 'Two walks, correlated at 0.8 for no reason.', scene: s => diffScene(s, 0) },
        { label: 'the changes', hold: 1900, note: 'The same data, differenced once. The series are now flat noise and the correlation between them has collapsed.', scene: s => diffScene(s, 1) },
        { label: 'the acf agrees', hold: 1800, note: 'Before: barely decaying. After: nothing outside the band. That is what "stationary" looks like.', scene: s => diffScene(s, +s.d, true) },
        { label: 'your turn', note: 'Toggle between 0 and 1. Differencing twice is usually too much — the ACF develops a negative spike at lag 1, which is the signature of over-differencing.', scene: s => diffScene(s, +s.d, true) },
      ],
    },

    /* ── 7 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'stationarity, and the cliff at φ = 1',
      prose: `<p>The word underneath everything so far. A series is <strong>stationary</strong> if its mean, its variance and its autocorrelations do not depend on <em>when</em> you look.</p>
        <p>Turn φ up. At 0.5 the series is stationary and tethered: it wanders, and it comes back. At 0.9 it is still stationary but the tether is long, and over a short sample you cannot tell.</p>
        <p>At exactly 1 something qualitative happens. The tether breaks. There is no mean to return to, the variance grows without limit, and every formula in the previous six lessons stops applying. That is a <strong>unit root</strong>, and it is not a matter of degree — 0.999 and 1.000 are different kinds of object.</p>`,
      formula: formula(
        'y' + sub('', 't') + eq + fPhi + 'y' + sub('', 't−1') + plus + t('shock', { tone: 'cyan' }) + '<br>' +
        t('|φ| < 1', { tone: 'green' }) + op('&nbsp;stationary&nbsp;·&nbsp;') +
        t('φ = 1', { tone: 'warm' }) + op('&nbsp;random walk, variance grows forever') +
        '<br>' + t('var(y', { tone: 'muted', cls: 'fx-tiny' }) + t('ₜ) = σ²/(1−φ²) — and look what happens at 1', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'a denominator going to zero, which is exactly as dramatic as it sounds' }),
      controls: [
        { type: 'slider', key: 'phi', label: 'φ', min: 0, max: 1, step: 0.01, fast: true, fmt: v => (+v).toFixed(2) },
      ],
      readouts: [
        { key: 'p', label: 'φ', tone: 'gold', get: s => +s.phi, d: 2 },
        { key: 'v', label: 'long-run variance', tone: 'warm', get: s => (+s.phi >= 1 ? Infinity : 1 / (1 - (+s.phi) ** 2)), d: 2, fmt: v => (isFinite(v) ? v.toFixed(2) : 'unbounded'), wide: true },
        { key: 'hl', label: 'time to forget half a shock', tone: 'cyan', get: s => (+s.phi <= 0 ? 0 : +s.phi >= 1 ? Infinity : Math.log(0.5) / Math.log(+s.phi)), d: 1, fmt: v => (isFinite(v) ? v.toFixed(1) + ' steps' : 'never'), wide: true },
        { key: 'st', label: 'stationary?', tone: 'green', get: s => (+s.phi < 1 ? 'yes' : 'no — unit root'), wide: true },
      ],
      beats: [
        { label: 'no memory', hold: 1500, note: 'φ = 0. Every value independent. Tethered hard to the mean.', scene: s => station(s, 0) },
        { label: 'tethered loosely', hold: 1600, note: 'φ = 0.7. Long excursions, and it always comes back.', scene: s => station(s, 0.7) },
        { label: 'almost free', hold: 1700, note: 'φ = 0.97. Still technically stationary. Over 160 observations you could not prove it.', scene: s => station(s, 0.97) },
        { label: 'the tether breaks', hold: 1900, note: 'φ = 1. No mean, no bound, and the variance grows with t forever. Everything upstream of here assumed this could not happen.', scene: s => station(s, 1) },
        { label: 'your turn', note: 'Creep φ from 0.9 to 1.0 and watch the long-run variance run away. The difference between 0.99 and 1.00 is not small — it is categorical.', scene: s => station(s, +s.phi) },
      ],
    },

    /* ── 8 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'peel it apart: trend, season, and what is left',
      prose: `<p>A series with an obvious trend and an obvious annual cycle. Take them off one at a time.</p>
        <p>The <strong>trend</strong> comes from a moving average wide enough to average one full cycle away. The <strong>season</strong> is what remains, averaged by position in the cycle. The <strong>remainder</strong> is everything neither of those explained.</p>
        <p>The remainder is the panel that matters. If it still has structure, your decomposition missed something — and its ACF will tell you what.</p>`,
      readouts: [
        { key: 'sd', label: 'sd of the series', tone: 'muted', get: () => st.sd(SERIES.seasonal), d: 2 },
        { key: 'sr', label: 'sd of the remainder', tone: 'green', get: () => st.sd(decompose(SERIES.seasonal, 12).remainder.filter(isFinite)), d: 2, wide: true },
        { key: 'ex', label: 'variance accounted for', tone: 'cyan', get: () => { const d = decompose(SERIES.seasonal, 12); const r = d.remainder.filter(isFinite); return (1 - st.variance(r) / st.variance(SERIES.seasonal)) * 100; }, d: 1, suf: '%', wide: true },
        { key: 'ac', label: 'structure left in the remainder', tone: 'warm', get: () => { const r = decompose(SERIES.seasonal, 12).remainder.filter(isFinite); return acf(r, 4)[1]; }, d: 3, wide: true },
      ],
      beats: [
        { label: 'the series', hold: 1300, note: 'Twelve years, monthly.', scene: () => decomp(1) },
        { label: 'the trend', hold: 1500, note: 'A twelve-month centred moving average, which averages exactly one cycle away and leaves the drift.', scene: () => decomp(2) },
        { label: 'the season', hold: 1600, note: 'Subtract the trend, then average by month. Twelve numbers, repeated.', scene: () => decomp(3) },
        { label: 'the remainder', hold: 1800, note: 'What neither explained. This should look like noise — and if it does not, you are not finished.', scene: () => decomp(4) },
      ],
    },

    /* ── 9 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'the forecast you have to beat',
      prose: `<p>Before any model, the baseline. For a random walk the best possible forecast of every future value is <strong>the last value you saw</strong>. Not the mean, not a trend line — the last value.</p>
        <p>That sounds like giving up. It is not: it is provably optimal for that process, and a very large number of published forecasting models do not beat it.</p>
        <p>What changes with horizon is not the forecast but the <em>uncertainty around it</em>. Each step forward adds one more independent shock, so the variance grows linearly and the interval widens as √h. Not linearly — as a square root, which is the same √n from the central limit theorem seen from the other end.</p>`,
      formula: formula(
        hat('y') + sub('', 't+h') + eq + 'y' + sub('', 't') +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') +
        'se' + paren('h') + eq + t('σ', { tone: 'warm' }) + sqrt('h') +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('flat forecast, widening fan', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'the interval is the only part that knows how far ahead you are looking' }),
      controls: [
        { type: 'slider', key: 'h', label: 'how far ahead', min: 1, max: 40, step: 1, fast: true },
      ],
      readouts: [
        { key: 'h', label: 'horizon', tone: 'gold', get: s => +s.h, d: 0 },
        { key: 'f', label: 'the forecast', tone: 'cyan', get: () => FC.last, d: 2, wide: true },
        { key: 'w', label: 'interval half-width', tone: 'warm', get: s => 1.96 * FC.sdStep * Math.sqrt(+s.h), d: 2, wide: true },
        { key: 'g', label: 'four times as far ahead costs', tone: 'muted', get: () => 2, d: 0, suf: '× the width', wide: true, explain: 'Because the width goes as the square root of the horizon. Doubling the width means looking four times as far ahead.' },
      ],
      beats: [
        { label: 'what you have', hold: 1400, note: 'A hundred and twenty observations. The rest is held out.', scene: s => forecast(s, 1) },
        { label: 'the naive forecast', hold: 1600, note: 'A flat line at the last value. That is the whole model.', scene: s => forecast(s, 2) },
        { label: 'the fan', hold: 1800, note: 'The interval widening as √h. Wide, and honestly wide — which is more than most forecasts manage.', scene: s => forecast(s, 3) },
        { label: 'what actually happened', hold: 1900, note: 'The held-out future. It stays inside the fan, and a trend line fitted to the training data would have been badly and confidently wrong.', scene: s => forecast(s, 4) },
        { label: 'your turn', note: 'Drag the horizon. Notice that the forecast never moves and only the fan does.', scene: s => forecast(s, 4) },
      ],
    },

    /* ── 10 ────────────────────────────────────────────────────────────────── */
    {
      title: 'your cross-validation is cheating',
      prose: `<p>One last thing, and it invalidates more published results than any other item on this page.</p>
        <p>Ordinary k-fold cross-validation shuffles the rows into folds. On a time series that means training on Wednesday and Friday to predict Thursday — using the future to predict the past. The model does not need to be clever to score well at that; it only needs to interpolate.</p>
        <p>The honest version is a <strong>rolling origin</strong>: train on everything up to a point, test on what comes next, move the point forward, repeat. Every test observation is genuinely in the future of everything the model saw.</p>
        <p>The scores are not close, and the gap is entirely leakage.</p>`,
      controls: [
        { type: 'segment', key: 'fold', label: 'validation', options: [
          { value: 'rolling', label: 'rolling origin', explain: 'Train on the past, test on the future, move forward. The honest one.' },
          { value: 'random', label: 'random k-fold', explain: 'Shuffle into folds. On a time series this lets the model see the future.' },
        ] },
      ],
      readouts: [
        { key: 'v', label: 'scheme', get: s => (s.fold === 'random' ? 'random k-fold' : 'rolling origin'), wide: true },
        { key: 'l', label: 'test points with future data in training', tone: 'warm', get: s => (s.fold === 'random' ? 'most of them' : 'none'), wide: true },
        { key: 'e', label: 'error it will report', tone: 'cyan', get: s => (s.fold === 'random' ? 'flatteringly low' : 'what you will actually get'), wide: true },
      ],
      beats: [
        { label: 'random folds', hold: 1800, note: 'Five folds, assigned at random. Look at any red test point and notice that blue training points sit on <em>both</em> sides of it.', scene: s => cv({ ...s, fold: 'random' }) },
        { label: 'rolling origin', hold: 1800, note: 'Five folds, in time order. Every red point is strictly after every blue point in its own fold.', scene: s => cv({ ...s, fold: 'rolling' }) },
        { label: 'your turn', hold: 1600, note: 'Switch between them and watch where the training data sits relative to the test data.', scene: s => cv(s) },
        {
          label: 'the checklist',
          note: 'In order. Most time-series mistakes are a failure at step one.',
          scene: () => [
            label('h', 360, 68, 'before you model anything', { cls: 'lab-big lab-mid lab-gold' }),
            [
              ['plot it', 'the trend, the season and the break are usually visible, and nothing else in your workflow will find them'],
              ['is it stationary?', 'if not, difference it. every formula downstream assumes it is, and none of them will warn you'],
              ['look at the acf of what is left', 'structure in the residuals means the model has not finished'],
              ['beat the naive forecast', 'last-value-carried-forward. if you cannot beat it, report it and stop'],
              ['validate in time order', 'a random fold on a time series is a way of scoring your model on data it has already seen'],
            ].map(([a, b], i) => [
              rect('cr' + i, 54, 104 + i * 78, 612, 66, { cls: 'cell', delay: i * 130 }),
              label('cn' + i, 74, 132 + i * 78, `${i + 1}. ${a}`, { cls: 'lab-big lab-cyan', delay: i * 130 }),
              label('cb' + i, 74, 154 + i * 78, b, { cls: 'lab-sm', delay: i * 130 }),
            ]),
          ],
        },
      ],
    },
  ],
};

/* ── helpers ──────────────────────────────────────────────────────────────── */

function coverAt(phi) {
  const i = PHIS.findIndex(v => v >= phi);
  if (i <= 0) return COVER[0].coverage;
  const a = COVER[i - 1], b = COVER[i];
  const w = (phi - a.phi) / (b.phi - a.phi);
  return a.coverage + w * (b.coverage - a.coverage);
}
const corrAt = d => (d <= 0 ? PAIR.r : st.pearson(diff(PAIR.a, d), diff(PAIR.b, d)));

function TF(y, { l = 66, r = 40, t = 60, b = 300 } = {}) {
  const f = frame({ w: 720, h: 540, l, r, t, b });
  f.setX(0, y.length - 1);
  const lo = Math.min(...y), hi = Math.max(...y), pad = (hi - lo) * 0.1 || 1;
  f.setY(lo - pad, hi + pad);
  return f;
}
const axesOf = (f, key, { xl = 'time', yl } = {}) => [
  { key: key + 'x', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x1, y2: f.y0 } },
  { key: key + 'y', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x0, y2: f.y1 } },
  xl ? label(key + 'xl', (f.x0 + f.x1) / 2, f.y0 + 28, xl, { cls: 'ax-label' }) : null,
  yl ? label(key + 'yl', f.x0 + 4, f.y1 - 8, yl, { cls: 'lab-sm' }) : null,
].filter(Boolean);

function shuffle(s, phase) {
  const y = Y(s), sh = SHUFFLED[s.shape];
  const one = (data, top, bot, key, cls, cap) => {
    const f = TF(data, { t: top, b: bot });
    return [
      ...axesOf(f, key, { xl: null }),
      path(key + 'p', data.map((v, i) => [f.sx(i), f.sy(v)]), { cls }),
      label(key + 'l', f.x0 + 6, f.y1 - 8, cap, { cls: 'lab lab-' + (cls.includes('warm') ? 'warm' : 'cyan') }),
    ];
  };
  if (phase === 0) return one(y, 150, 180, 'a', 'curve curve-cyan', 'as recorded');
  if (phase === 1) return one(sh, 150, 180, 'a', 'curve curve-warm', 'the same numbers, shuffled');
  return [
    ...one(y, 74, 336, 'a', 'curve curve-cyan', 'as recorded'),
    ...one(sh, 300, 110, 'b', 'curve curve-warm', 'the same numbers, shuffled'),
    label('n', 360, 500, 'identical mean, sd, median, histogram — and one of them is data', { cls: 'lab lab-mid lab-green' }),
  ];
}

function lagScene(s, phase) {
  const y = Y(s), k = clamp(+s.lag, 1, 24);
  const f = TF(y, { t: 60, b: phase >= 2 ? 330 : 200, r: phase >= 2 ? 300 : 40 });
  const out = [
    ...axesOf(f, 'a', { xl: null }),
    path('p', y.map((v, i) => [f.sx(i), f.sy(v)]), { cls: 'curve curve-cyan' }),
    label('pl', f.x0 + 6, f.y1 - 8, 'the series', { cls: 'lab-sm lab-cyan' }),
  ];
  if (phase >= 1) out.push(
    path('ps', y.slice(0, y.length - k).map((v, i) => [f.sx(i + k), f.sy(v)]), {
      cls: 'curve', set: { stroke: 'var(--cs-data-gold)', 'stroke-width': 1.6 }, opacity: 0.85,
    }),
    label('psl', f.x1 - 4, f.y1 - 8, `shifted ${k} step${k > 1 ? 's' : ''}`, { cls: 'lab-sm lab-end lab-gold' }));
  if (phase >= 2) {
    const a = y.slice(k), b = y.slice(0, y.length - k);
    const g = frame({ w: 720, h: 540, l: 430, r: 34, t: 118, b: 168 });
    const lo = Math.min(...y), hi = Math.max(...y), pd = (hi - lo) * 0.08;
    g.setX(lo - pd, hi + pd); g.setY(lo - pd, hi + pd);
    const rr = acf(y, 24)[k];
    out.push(
      ...axesOf(g, 'g', { xl: null }),
      label('gx', (g.x0 + g.x1) / 2, g.y0 + 24, `value ${k} step${k > 1 ? 's' : ''} ago`, { cls: 'ax-label' }),
      label('gy', g.x0 + 4, g.y1 - 8, 'value now', { cls: 'lab-sm' }),
      path('dg', [[g.sx(g.dx[0]), g.sy(g.dx[0])], [g.sx(g.dx[1]), g.sy(g.dx[1])]], { cls: 'curve curve-ghost curve-dash' }),
      ...b.map((v, i) => ({
        key: 'sp' + i, tag: 'circle', cls: 'pt pt-cyan',
        attrs: { cx: g.sx(v), cy: g.sy(a[i]), r: 2.8 }, opacity: 0.55,
      })),
      numLabel('rv', 430, 418, rr, { cls: 'lab-big lab-gold', d: 4, pre: 'r = ' }),
      label('rl', 430, 440, `the autocorrelation at lag ${k}`, { cls: 'lab-sm' }),
      numLabel('nv', 430, 470, y.length - k, { cls: 'lab lab-muted', d: 0, pre: 'from ', suf: ' pairs' }));
  }
  return out;
}

function acfScene(s, phase) {
  const y = Y(s);
  const A = acf(y, 24), P = pacf(y, 24), band = acfBand(N);
  const bars = (arr, top, bot, key, tone, cap) => {
    const f = frame({ w: 720, h: 540, l: 68, r: 40, t: top, b: bot });
    f.setX(0.4, 24.6); f.setY(-1.05, 1.05);
    return [
      { key: key + 'z', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.sy(0), x2: f.x1, y2: f.sy(0) } },
      { key: key + 'y', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x0, y2: f.y1 } },
      ...arr.slice(1).map((v, i) => rect(key + 'b' + i, f.sx(i + 1) - 5, Math.min(f.sy(0), f.sy(v)), 10, Math.abs(f.sy(v) - f.sy(0)), {
        cls: 'sq ' + (Math.abs(v) > band ? (tone === 'gold' ? 'sq-gold' : 'sq-x') : 'sq-dim'), dur: 300,
        tip: `lag ${i + 1}<br>${v.toFixed(3)}`,
      })),
      ...[1, 6, 12, 18, 24].map(v => label(key + 't' + v, f.sx(v), f.y0 + 15, String(v), { cls: 'ax-tick' })),
      phase >= 2 ? [
        path(key + 'ba', [[f.x0, f.sy(band)], [f.x1, f.sy(band)]], { cls: 'rule rule-faint rule-dash' }),
        path(key + 'bb', [[f.x0, f.sy(-band)], [f.x1, f.sy(-band)]], { cls: 'rule rule-faint rule-dash' }),
      ] : null,
      label(key + 'l', f.x0 + 4, f.y1 - 6, cap, { cls: 'lab lab-' + tone }),
    ].flat().filter(Boolean);
  };
  const f0 = TF(y, { t: 56, b: phase >= 3 ? 400 : 300 });
  const out = [
    ...axesOf(f0, 'a', { xl: null }),
    path('p', y.map((v, i) => [f0.sx(i), f0.sy(v)]), { cls: 'curve curve-cyan' }),
    label('pl', f0.x0 + 6, f0.y1 - 6, SHAPES.find(x => x.k === s.shape).label, { cls: 'lab lab-cyan' }),
  ];
  if (phase < 3) out.push(...bars(A, 300, 66, 'g', 'cyan', 'autocorrelation, lag 1 to 24'));
  else out.push(
    ...bars(A, 218, 218, 'g', 'cyan', 'acf'),
    ...bars(P, 360, 76, 'h', 'gold', 'partial acf — one spike means one step of memory'));
  return out;
}

function cover(s, phi, curve) {
  if (!curve) {
    const r = st.rng(4242);
    const n = 120, reps = 40;
    const f = frame({ w: 720, h: 540, l: 78, r: 214, t: 84, b: 92 });
    f.setX(-0.5, reps - 0.5); f.setY(-1.4, 1.4);
    const items = range(reps).map(() => {
      const y = arSeries(n, phi, r);
      const m = st.mean(y), se = st.sd(y) / Math.sqrt(n);
      return { m, se, hit: Math.abs(m) < 1.96 * se };
    });
    const hits = items.filter(i => i.hit).length;
    return [
      path('zero', [[f.x0, f.sy(0)], [f.x1, f.sy(0)]], { cls: 'rule rule-gold' }),
      label('zl', f.x1 - 4, f.sy(0) - 8, 'the truth', { cls: 'lab-sm lab-end lab-gold' }),
      ...items.map((it, i) => path('ci' + i, [
        [f.sx(i), f.sy(clamp(it.m - 1.96 * it.se, -1.4, 1.4))],
        [f.sx(i), f.sy(clamp(it.m + 1.96 * it.se, -1.4, 1.4))],
      ], {
        cls: 'stick', set: { stroke: it.hit ? 'var(--cs-data-green)' : 'var(--cs-data-warm)', 'stroke-width': 3 },
        delay: i * 22, tip: `interval ${i + 1}<br>${it.hit ? 'contains' : 'misses'} the truth`,
      })),
      numLabel('ph', 500, 132, phi, { cls: 'lab-big lab-gold', d: 2, pre: 'φ = ' }),
      numLabel('hv', 500, 176, (hits / reps) * 100, { cls: 'lab-big lab-' + (hits / reps > 0.9 ? 'green' : 'warm'), d: 0, suf: '% contain it' }),
      label('hl', 500, 198, `${reps} intervals shown`, { cls: 'lab-sm' }),
      label('hl2', 500, 212, 'of 300 simulated', { cls: 'lab-sm' }),
      numLabel('nv', 500, 254, (120 * (1 - phi)) / (1 + phi), { cls: 'lab lab-cyan', d: 1, pre: 'worth ', suf: ' observations' }),
      label('nl', 500, 274, 'not 120', { cls: 'lab-sm lab-cyan' }),
      label('cap', 360, 486, 'green: the interval contains the truth · red: it does not', { cls: 'lab-sm lab-mid' }),
    ];
  }
  const f = frame({ w: 720, h: 540, l: 82, r: 208, t: 84, b: 92 });
  f.setX(0, 1); f.setY(0, 1);
  return [
    ...axesOf(f, 'c', { xl: 'how much the series remembers  (φ)' }),
    ...[0, 0.25, 0.5, 0.75, 1].map(v => label('yt' + v, f.x0 - 9, f.sy(v) + 4, (v * 100).toFixed(0) + '%', { cls: 'ax-tick ax-tick-y' })),
    ...[0, 0.25, 0.5, 0.75, 1].map(v => label('xt' + v, f.sx(v), f.y0 + 15, v.toFixed(2), { cls: 'ax-tick' })),
    path('nom', [[f.x0, f.sy(0.95)], [f.x1, f.sy(0.95)]], { cls: 'rule rule-gold rule-dash' }),
    label('noml', f.x1 - 4, f.sy(0.95) - 8, 'what it claims: 95%', { cls: 'lab-sm lab-end lab-gold' }),
    path('cv', COVER.map(c => [f.sx(c.phi), f.sy(c.coverage)]), { cls: 'curve curve-warm' }),
    ...COVER.map((c, i) => ({
      key: 'cp' + i, tag: 'circle', cls: 'pt pt-warm',
      attrs: { cx: f.sx(c.phi), cy: f.sy(c.coverage), r: 4.4 },
      tip: `φ = ${c.phi}<br>covers ${(c.coverage * 100).toFixed(1)}%`,
    })),
    path('you', [[f.sx(clamp(+s.phi, 0, 1)), f.y0], [f.sx(clamp(+s.phi, 0, 1)), f.y1]], { cls: 'rule rule-faint rule-dash' }),
    { key: 'yp', tag: 'circle', cls: 'pt pt-green', attrs: { cx: f.sx(clamp(+s.phi, 0, 1)), cy: f.sy(coverAt(+s.phi)), r: 7 } },
    numLabel('cvv', 498, 140, coverAt(+s.phi) * 100, { cls: 'lab-big lab-warm', d: 1, suf: '% actual' }),
    numLabel('ne', 498, 184, (120 * (1 - +s.phi)) / (1 + +s.phi), { cls: 'lab-big lab-cyan', d: 1, suf: ' of 120' }),
    label('nel', 498, 206, 'effective sample size', { cls: 'lab-sm' }),
    label('w1', 498, 250, 'the interval never got', { cls: 'lab-sm lab-warm' }),
    label('w2', 498, 264, 'wider to warn you.', { cls: 'lab-sm lab-warm' }),
    label('w3', 498, 286, 'it just started being', { cls: 'lab-sm' }),
    label('w4', 498, 300, 'wrong.', { cls: 'lab-sm' }),
  ];
}

function pair(s, phase) {
  if (phase <= 2) {
    const f = TF(PAIR.a.concat(PAIR.b), { t: 90, b: 130 });
    return [
      ...axesOf(f, 'p'),
      path('a', PAIR.a.map((v, i) => [f.sx(i), f.sy(v)]), { cls: 'curve curve-cyan' }),
      label('al', f.x1 - 4, f.sy(PAIR.a[N - 1]) - 10, 'series A', { cls: 'lab lab-end lab-cyan' }),
      phase >= 2 ? path('b', PAIR.b.map((v, i) => [f.sx(i), f.sy(v)]), { cls: 'curve curve-purple' }) : null,
      phase >= 2 ? label('bl', f.x1 - 4, f.sy(PAIR.b[N - 1]) + 16, 'series B', { cls: 'lab lab-end lab-purple' }) : null,
      label('n', 360, 486, phase >= 2 ? 'generated independently. no shared input of any kind.' : 'a cumulative sum of random steps', { cls: 'lab lab-mid lab-muted' }),
    ].filter(Boolean);
  }
  if (phase === 3) {
    const f = frame({ w: 720, h: 540, l: 90, r: 250, t: 76, b: 96 });
    f.fit(PAIR.a, PAIR.b, 0.08);
    return [
      ...axesOf(f, 'q', { xl: 'series A' }),
      label('yl', f.x0 + 4, f.y1 - 8, 'series B', { cls: 'lab-sm' }),
      ...PAIR.a.map((v, i) => ({
        key: 'p' + i, tag: 'circle', cls: 'pt pt-cyan',
        attrs: { cx: f.sx(v), cy: f.sy(PAIR.b[i]), r: 3 }, opacity: 0.6,
      })),
      fnPath(f, x => PAIR.fit.b0 + PAIR.fit.b1 * x, { key: 'fit', cls: 'curve curve-fit' }),
      numLabel('rv', 494, 150, PAIR.r, { cls: 'lab-big lab-warm', d: 3, pre: 'r = ' }),
      numLabel('pv', 494, 190, PAIR.p, { cls: 'lab-big lab-warm', d: 6, fmt: v => 'p ' + st.fmtP(v) }),
      label('tl', 494, 240, 'true relationship:', { cls: 'lab-sm' }),
      label('tl2', 494, 262, 'none', { cls: 'lab-big lab-green' }),
      label('tl3', 494, 300, 'two cumulative sums of', { cls: 'lab-sm' }),
      label('tl4', 494, 314, 'independent random numbers,', { cls: 'lab-sm' }),
      label('tl5', 494, 328, 'and nothing else.', { cls: 'lab-sm' }),
    ];
  }
  const f = frame({ w: 720, h: 540, l: 76, r: 214, t: 92, b: 96 });
  f.setX(-1, 1);
  const bins = 24;
  const hist = arr => {
    const h = new Array(bins).fill(0);
    arr.forEach(v => { h[clamp(Math.floor(((v + 1) / 2) * bins), 0, bins - 1)]++; });
    return h.map(v => v / arr.length);
  };
  const hw = hist(SPUR.walk.rs), hn = hist(SPUR.noise.rs);
  f.setY(0, Math.max(...hn, ...hw) * 1.15);
  const bw = (f.x1 - f.x0) / bins;
  return [
    ...axesOf(f, 'h', { xl: 'correlation between two unrelated series' }),
    ...hn.map((v, i) => rect('n' + i, f.x0 + i * bw, f.sy(v), bw - 1, f.y0 - f.sy(v), { cls: 'sq sq-dim' })),
    ...hw.map((v, i) => rect('w' + i, f.x0 + i * bw + bw * 0.2, f.sy(v), bw * 0.6, f.y0 - f.sy(v), { cls: 'sq sq-resid' })),
    label('l1', f.x0 + 6, f.y1 - 6, 'red: two random walks', { cls: 'lab-sm lab-warm' }),
    label('l2', f.x0 + 6, f.y1 + 10, 'grey: two independent noise series — the null you expected', { cls: 'lab-sm' }),
    numLabel('s1', 496, 148, SPUR.walk.sig * 100, { cls: 'lab-big lab-warm', d: 1, suf: '%' }),
    label('s1l', 496, 170, 'of walk pairs come out', { cls: 'lab-sm' }),
    label('s1m', 496, 184, 'significant at p < .05', { cls: 'lab-sm' }),
    numLabel('s2', 496, 226, SPUR.noise.sig * 100, { cls: 'lab-big lab-green', d: 1, suf: '%' }),
    label('s2l', 496, 248, 'of noise pairs do —', { cls: 'lab-sm' }),
    label('s2m', 496, 262, 'which is the design', { cls: 'lab-sm' }),
    phase >= 5 ? [
      label('w1', 496, 310, 'the test is not broken.', { cls: 'lab-sm lab-gold' }),
      label('w2', 496, 324, 'its assumption is.', { cls: 'lab-sm lab-gold' }),
      label('w3', 496, 350, 'it counts 120 observations', { cls: 'lab-sm' }),
      label('w4', 496, 364, 'as 120 facts. in a walk,', { cls: 'lab-sm' }),
      label('w5', 496, 378, 'they are barely one.', { cls: 'lab-sm' }),
    ] : null,
  ].flat().filter(Boolean);
}

function diffScene(s, d, withAcf) {
  const dd = clamp(d, 0, 2);
  const a = diff(PAIR.a, dd), b = diff(PAIR.b, dd);
  const f = TF(a.concat(b), { t: 60, b: withAcf ? 330 : 250, r: 240 });
  const rr = st.pearson(a, b);
  const out = [
    ...axesOf(f, 'p', { xl: null }),
    path('a', a.map((v, i) => [f.sx(i), f.sy(v)]), { cls: 'curve curve-cyan' }),
    path('b', b.map((v, i) => [f.sx(i), f.sy(v)]), { cls: 'curve curve-purple' }),
    label('l', f.x0 + 6, f.y1 - 8, dd === 0 ? 'the levels' : dd === 1 ? 'the changes' : 'the changes in the changes', { cls: 'lab lab-cyan' }),
    numLabel('rv', 494, 118, rr, { cls: 'lab-big lab-' + (Math.abs(rr) > 0.3 ? 'warm' : 'green'), d: 3, pre: 'r = ' }),
    label('rl', 494, 140, 'between the two series', { cls: 'lab-sm' }),
    numLabel('sv', 494, 180, (dd === 0 ? SPUR.walk.sig : SPUR.noise.sig) * 100, {
      cls: 'lab-big lab-' + (dd === 0 ? 'warm' : 'green'), d: 1, suf: '% significant',
    }),
    label('sl', 494, 202, 'over 300 pairs', { cls: 'lab-sm' }),
    label('sl2', 494, 216, dd === 0 ? 'should be 5' : 'which is the design', { cls: 'lab-sm' }),
  ];
  if (withAcf) {
    const g = frame({ w: 720, h: 540, l: 68, r: 240, t: 336, b: 76 });
    g.setX(0.4, 24.6); g.setY(-1.05, 1.05);
    const A = acf(a, 24), band = acfBand(a.length);
    out.push(
      { key: 'gz', tag: 'line', cls: 'ax-line', attrs: { x1: g.x0, y1: g.sy(0), x2: g.x1, y2: g.sy(0) } },
      ...A.slice(1).map((v, i) => rect('gb' + i, g.sx(i + 1) - 5, Math.min(g.sy(0), g.sy(v)), 10, Math.abs(g.sy(v) - g.sy(0)), {
        cls: 'sq ' + (Math.abs(v) > band ? 'sq-x' : 'sq-dim'), dur: 300,
      })),
      path('gba', [[g.x0, g.sy(band)], [g.x1, g.sy(band)]], { cls: 'rule rule-faint rule-dash' }),
      path('gbb', [[g.x0, g.sy(-band)], [g.x1, g.sy(-band)]], { cls: 'rule rule-faint rule-dash' }),
      label('gl', g.x0 + 4, g.y1 - 6, 'acf of series A', { cls: 'lab-sm lab-cyan' }),
      label('gv', 494, 300, dd === 0 ? 'barely decaying —' : 'nothing outside the band —', { cls: 'lab-sm' }),
      label('gv2', 494, 314, dd === 0 ? 'not stationary' : 'this is stationary', {
        cls: 'lab lab-' + (dd === 0 ? 'warm' : 'green'),
      }));
  }
  return out;
}

const STAT_CACHE = new Map();
function statSeries(phi) {
  const k = phi.toFixed(2);
  if (!STAT_CACHE.has(k)) {
    const r = st.rng(1717);
    STAT_CACHE.set(k, phi >= 1 ? randomWalk(N, r, 1) : arSeries(N, phi, r));
  }
  return STAT_CACHE.get(k);
}

function station(s, phi) {
  const p = clamp(phi, 0, 1);
  const y = statSeries(p);
  const f = frame({ w: 720, h: 540, l: 76, r: 220, t: 78, b: 96 });
  f.setX(0, N - 1); f.setY(-9, 9);
  const lim = p >= 1 ? null : 1.96 / Math.sqrt(1 - p * p);
  return [
    ...axesOf(f, 'a'),
    path('mean', [[f.x0, f.sy(0)], [f.x1, f.sy(0)]], { cls: 'rule rule-gold rule-dash' }),
    lim ? rect('band', f.x0, f.sy(Math.min(lim, 9)), f.x1 - f.x0, f.sy(-Math.min(lim, 9)) - f.sy(Math.min(lim, 9)), {
      cls: 'sq sq-dim', opacity: 0.5,
    }) : null,
    path('p', y.map((v, i) => [f.sx(i), f.sy(clamp(v, -9, 9))]), {
      cls: 'curve', set: { stroke: p >= 1 ? 'var(--cs-data-warm)' : 'var(--cs-cyan)', 'stroke-width': 1.8 },
    }),
    lim ? label('bl', f.x1 - 4, f.sy(Math.min(lim, 9)) - 6, 'where it lives, long run', { cls: 'lab-sm lab-end' }) : null,
    numLabel('pv', 508, 128, p, { cls: 'lab-big lab-gold', d: 2, pre: 'φ = ' }),
    label('sv', 508, 168, p < 1 ? 'stationary' : 'unit root', { cls: 'lab-big lab-' + (p < 1 ? 'green' : 'warm') }),
    numLabel('vv', 508, 210, p >= 1 ? Infinity : 1 / (1 - p * p), {
      cls: 'lab lab-cyan', d: 2, pre: 'long-run var ', fmt: v => (isFinite(v) ? v.toFixed(2) : 'unbounded'),
    }),
    numLabel('hv', 508, 232, p <= 0 ? 0 : p >= 1 ? Infinity : Math.log(0.5) / Math.log(p), {
      cls: 'lab lab-cyan', d: 1, pre: 'half-life ', fmt: v => (isFinite(v) ? v.toFixed(1) + ' steps' : 'never'),
    }),
    p >= 1 ? [
      label('w1', 508, 282, 'no mean to return to.', { cls: 'lab-sm lab-warm' }),
      label('w2', 508, 296, 'variance grows with t,', { cls: 'lab-sm lab-warm' }),
      label('w3', 508, 310, 'forever.', { cls: 'lab-sm lab-warm' }),
      label('w4', 508, 336, 'every formula in the', { cls: 'lab-sm' }),
      label('w5', 508, 350, 'previous six lessons', { cls: 'lab-sm' }),
      label('w6', 508, 364, 'assumed this could not', { cls: 'lab-sm' }),
      label('w7', 508, 378, 'happen.', { cls: 'lab-sm' }),
    ] : [
      label('g1', 508, 282, 'a shock decays away.', { cls: 'lab-sm lab-green' }),
      label('g2', 508, 296, 'the series is tethered.', { cls: 'lab-sm lab-green' }),
    ],
  ].flat().filter(Boolean);
}

function decomp(phase) {
  const y = SERIES.seasonal;
  const D = decompose(y, 12);
  const panels = [
    { d: y, cap: 'the series', cls: 'curve curve-cyan', at: 1 },
    { d: D.trend, cap: 'trend — a 12-month moving average', cls: 'curve curve-fit', at: 2 },
    { d: D.season, cap: 'season — the average by month, repeated', cls: 'curve curve-purple', at: 3 },
    { d: D.remainder, cap: 'remainder — everything else', cls: 'curve curve-warm', at: 4 },
  ];
  const H = 108;
  const out = [];
  panels.forEach((p, i) => {
    if (phase < p.at) return;
    const top = 46 + i * H;
    const f = frame({ w: 720, h: 540, l: 70, r: 40, t: top, b: 540 - top - (H - 24) });
    const vals = p.d.filter(isFinite);
    f.setX(0, y.length - 1);
    const lo = Math.min(...vals), hi = Math.max(...vals), pd = (hi - lo) * 0.14 || 1;
    f.setY(lo - pd, hi + pd);
    out.push(
      { key: 'ax' + i, tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x1, y2: f.y0 } },
      path('p' + i, p.d.map((v, k) => (isFinite(v) ? [f.sx(k), f.sy(v)] : null)).filter(Boolean), { cls: p.cls }),
      label('l' + i, f.x0 + 4, f.y1 - 4, p.cap, { cls: 'lab-sm lab-' + (i === 0 ? 'cyan' : i === 1 ? 'green' : i === 2 ? 'purple' : 'warm') }),
      numLabel('s' + i, f.x1 - 4, f.y1 - 4, st.sd(vals), { cls: 'lab-sm lab-end', d: 2, pre: 'sd ' }),
    );
  });
  if (phase >= 4) out.push(label('f', 360, 522,
    'the remainder still has some structure — its lag-1 acf is not zero. the decomposition is crude, and honest about it.',
    { cls: 'lab-sm lab-mid lab-warm' }));
  return out;
}

function forecast(s, phase) {
  const h = clamp(+s.h, 1, 40);
  const f = frame({ w: 720, h: 540, l: 74, r: 200, t: 82, b: 96 });
  f.setX(0, N - 1);
  const all = FC.y.concat([FC.last + 3 * FC.sdStep * Math.sqrt(40), FC.last - 3 * FC.sdStep * Math.sqrt(40)]);
  const lo = Math.min(...all), hi = Math.max(...all), pd = (hi - lo) * 0.06;
  f.setY(lo - pd, hi + pd);
  const end = Math.min(FC.cut - 1 + h, N - 1);

  const out = [
    ...axesOf(f, 'a'),
    path('tr', FC.train.map((v, i) => [f.sx(i), f.sy(v)]), { cls: 'curve curve-cyan' }),
    path('cut', [[f.sx(FC.cut - 1), f.y0], [f.sx(FC.cut - 1), f.y1]], { cls: 'rule rule-gold rule-dash' }),
    label('cl', f.sx(FC.cut - 1), f.y1 - 8, 'today', { cls: 'lab-sm lab-mid lab-gold' }),
  ];
  if (phase >= 3) {
    const up = [], dn = [];
    for (let k = 0; k <= h; k++) {
      const x = f.sx(FC.cut - 1 + k), w = 1.96 * FC.sdStep * Math.sqrt(k);
      up.push([x, f.sy(FC.last + w)]); dn.push([x, f.sy(FC.last - w)]);
    }
    out.push(path('fan', up.concat(dn.reverse()), { cls: 'area', close: true, opacity: 0.5 }));
  }
  if (phase >= 2) out.push(
    path('fc', [[f.sx(FC.cut - 1), f.sy(FC.last)], [f.sx(end), f.sy(FC.last)]], { cls: 'curve curve-fit' }),
    label('fl', f.sx(end) + 4, f.sy(FC.last) + 16, 'the forecast', { cls: 'lab-sm lab-green' }));
  if (phase >= 4) out.push(
    path('fu', FC.future.map((v, i) => [f.sx(FC.cut + i), f.sy(v)]), {
      cls: 'curve', set: { stroke: 'var(--cs-data-warm)', 'stroke-width': 1.6 },
    }),
    label('ful', f.x1 - 4, f.y1 - 22, 'what actually happened', { cls: 'lab-sm lab-end lab-warm' }));

  const px = 534;
  out.push(
    numLabel('hv', px, 138, h, { cls: 'lab-big lab-gold', d: 0, pre: 'h = ' }),
    numLabel('fv', px, 178, FC.last, { cls: 'lab-big lab-green', d: 2, pre: 'forecast ' }),
    label('fv2', px, 198, 'the same at every h', { cls: 'lab-sm' }),
    numLabel('wv', px, 236, 1.96 * FC.sdStep * Math.sqrt(h), { cls: 'lab-big lab-warm', d: 2, pre: '± ' }),
    label('wv2', px, 256, 'widening as √h', { cls: 'lab-sm lab-warm' }),
    phase >= 4 ? [
      label('n1', px, 302, 'a trend line fitted to', { cls: 'lab-sm' }),
      label('n2', px, 316, 'the training data would', { cls: 'lab-sm' }),
      label('n3', px, 330, 'have been confidently', { cls: 'lab-sm' }),
      label('n4', px, 344, 'and badly wrong.', { cls: 'lab-sm lab-warm' }),
    ] : null,
  );
  return out.flat().filter(Boolean);
}

function cv(s) {
  const n = 60, folds = 5;
  const random = (() => { const r = st.rng(5); return range(n).map(() => Math.floor(r() * folds)); })();
  const rolling = range(n).map(i => Math.min(folds - 1, Math.max(0, Math.floor((i - 20) / 8))));
  const isTest = (i, k) => (s.fold === 'random' ? random[i] === k : (rolling[i] === k && i >= 20));
  const isTrain = (i, k) => (s.fold === 'random' ? random[i] !== k : i < 20 + k * 8);

  const RH = 62, X0 = 88, W = 520;
  const out = [
    label('h', 360, 66, s.fold === 'random' ? 'random k-fold — five folds, assigned by coin' : 'rolling origin — train on the past, test on what comes next',
      { cls: 'lab-big lab-mid lab-' + (s.fold === 'random' ? 'warm' : 'green') }),
    label('h2', 360, 88, 'blue: training  ·  red: testing  ·  grey: not used in this fold', { cls: 'lab-sm lab-mid' }),
  ];
  range(folds).forEach(k => {
    const y = 118 + k * RH;
    out.push(label('fk' + k, X0 - 12, y + 16, `fold ${k + 1}`, { cls: 'lab-sm lab-end' }));
    range(n).forEach(i => {
      const w = W / n;
      const test = isTest(i, k), train = isTrain(i, k);
      out.push(rect(`c-${k}-${i}`, X0 + i * w, y, w - 1, 24, {
        cls: 'sq', dur: 300,
        set: {
          fill: test ? 'var(--cs-data-warm)' : train ? 'var(--cs-cyan)' : 'rgba(255,255,255,.05)',
          stroke: 'none',
        },
        opacity: test || train ? 0.85 : 1,
      }));
    });
  });
  out.push(
    label('tl', X0, 118 + folds * RH + 6, 'time  →', { cls: 'lab-sm' }),
    label('v', 360, 118 + folds * RH + 44, s.fold === 'random'
      ? 'every red cell has blue cells on both sides of it. the model is interpolating, not forecasting.'
      : 'every red cell is strictly to the right of every blue cell in its own row. no leakage.',
      { cls: 'lab lab-mid lab-' + (s.fold === 'random' ? 'warm' : 'green') }),
  );
  return out;
}
