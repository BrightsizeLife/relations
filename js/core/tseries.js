/* ─────────────────────────────────────────────────────────────────────────────
   tseries.js — the machinery for data where the order matters.

   Autocorrelation, differencing, a moving-average decomposition, and the two
   simulations that make the case: how badly a confidence interval fails under
   dependence, and how often two entirely unrelated random walks come out
   "significantly" correlated.
   ───────────────────────────────────────────────────────────────────────────── */

import { mean, sum, sd, pearson, rng, randNorm, linreg, tTest2 } from './stats.js';

/** correlation of a series with itself, k steps back */
export function acf(y, maxLag = 24) {
  const n = y.length, m = mean(y);
  const c0 = sum(y.map(v => (v - m) ** 2)) / n;
  const out = [1];
  for (let k = 1; k <= maxLag; k++) {
    let c = 0;
    for (let t = k; t < n; t++) c += (y[t] - m) * (y[t - k] - m);
    out.push(c0 > 0 ? c / n / c0 : 0);
  }
  return out;
}

/**
 * Partial autocorrelation by the Durbin–Levinson recursion: the correlation at
 * lag k with everything in between already accounted for. An AR(1) has one
 * spike and nothing after it, however slowly its plain ACF decays.
 */
export function pacf(y, maxLag = 24) {
  const r = acf(y, maxLag);
  const phi = [[]];
  const out = [1];
  let prev = [];
  for (let k = 1; k <= maxLag; k++) {
    let num = r[k], den = 1;
    for (let j = 1; j < k; j++) { num -= prev[j - 1] * r[k - j]; den -= prev[j - 1] * r[j]; }
    const pk = den !== 0 ? num / den : 0;
    const cur = [];
    for (let j = 1; j < k; j++) cur.push(prev[j - 1] - pk * prev[k - j - 1]);
    cur.push(pk);
    prev = cur;
    out.push(pk);
  }
  return out;
}

/** the ±2/√n band inside which an autocorrelation is indistinguishable from zero */
export const acfBand = n => 1.96 / Math.sqrt(n);

/** first differences: what changed, rather than where it is */
export const diff = (y, d = 1) => (d <= 0 ? y.slice()
  : diff(y.slice(1).map((v, i) => v - y[i]), d - 1));

/**
 * Classical decomposition: a centred moving average for the trend, the average
 * detrended value at each position in the cycle for the season, and whatever
 * is left over. Crude, transparent, and enough to see the idea.
 */
export function decompose(y, period = 12) {
  const n = y.length;
  const half = Math.floor(period / 2);
  const trend = y.map((_, t) => {
    if (t < half || t >= n - half) return NaN;
    let s = 0, w = 0;
    for (let k = -half; k <= half; k++) {
      const wt = (period % 2 === 0 && Math.abs(k) === half) ? 0.5 : 1;
      s += wt * y[t + k]; w += wt;
    }
    return s / w;
  });
  const detr = y.map((v, t) => v - trend[t]);
  const seasonAvg = Array.from({ length: period }, (_, p) => {
    const vals = detr.filter((v, t) => t % period === p && isFinite(v));
    return vals.length ? mean(vals) : 0;
  });
  const c = mean(seasonAvg);
  const season = y.map((_, t) => seasonAvg[t % period] - c);
  const remainder = y.map((v, t) => v - trend[t] - season[t]);
  return { trend, season, remainder, seasonAvg: seasonAvg.map(v => v - c), period };
}

/* ── simulations ──────────────────────────────────────────────────────────── */

/** an AR(1) with unit marginal variance, so φ changes the memory and not the spread */
export function arSeries(n, phi, r, sd0 = 1) {
  const out = [randNorm(r, 0, sd0)];
  const s = sd0 * Math.sqrt(Math.max(1e-9, 1 - phi * phi));
  for (let t = 1; t < n; t++) out.push(phi * out[t - 1] + randNorm(r, 0, s));
  return out;
}

export function randomWalk(n, r, step = 1, start = 0) {
  const out = [start];
  for (let t = 1; t < n; t++) out.push(out[t - 1] + randNorm(r, 0, step));
  return out;
}

/**
 * How often does a nominal 95% interval for the mean actually contain zero,
 * when the data is autocorrelated? The interval is computed the ordinary way —
 * that is the point.
 */
export function coverage(phi, { n = 120, reps = 400, seed = 5 } = {}) {
  const r = rng(seed);
  let hit = 0;
  for (let i = 0; i < reps; i++) {
    const y = arSeries(n, phi, r);
    const m = mean(y), se = sd(y) / Math.sqrt(n);
    if (Math.abs(m) < 1.96 * se) hit++;
  }
  return {
    phi, coverage: hit / reps,
    /** independent observations worth: n(1−φ)/(1+φ) */
    nEff: (n * (1 - phi)) / (1 + phi),
    n,
  };
}

/**
 * Two entirely unrelated series, regressed on each other, several hundred
 * times. With independent noise you get the null distribution you expect.
 * With random walks you get something else entirely.
 */
export function spurious({ n = 120, reps = 400, seed = 11, kind = 'walk' } = {}) {
  const r = rng(seed);
  const rs = [], ps = [];
  for (let i = 0; i < reps; i++) {
    const a = kind === 'walk' ? randomWalk(n, r) : arSeries(n, 0, r);
    const b = kind === 'walk' ? randomWalk(n, r) : arSeries(n, 0, r);
    const f = linreg(a, b);
    const rr = pearson(a, b);
    rs.push(rr);
    ps.push(tTest2((rr * Math.sqrt(n - 2)) / Math.sqrt(Math.max(1e-12, 1 - rr * rr)), n - 2));
  }
  return {
    rs, ps, kind,
    sig: ps.filter(p => p < 0.05).length / reps,
    medAbs: [...rs.map(Math.abs)].sort((x, y2) => x - y2)[Math.floor(reps / 2)],
  };
}
