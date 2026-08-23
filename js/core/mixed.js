/* ─────────────────────────────────────────────────────────────────────────────
   mixed.js — partial pooling.

   A random-intercept model fitted by EM, which is the transparent way to do it:
   two variance components, one weight per group derived from them, and an
   iteration that stops moving. Everything a lesson needs to draw is exposed —
   the raw group means, the weight each one earned, and where the estimate
   ended up.

   The weight is worth staring at. λⱼ = τ² / (τ² + σ²/nⱼ) is the reliability
   formula: signal variance over signal plus noise variance, where the "noise"
   is the standard error of that group's own mean. A group mean built from more
   data is a more reliable measurement of that group, so it is trusted more.
   ───────────────────────────────────────────────────────────────────────────── */

import { mean, sum, variance, linreg, rng, randNorm } from './stats.js';

/**
 * y ~ 1 + (1 | group), fitted by EM.
 *
 * @param groups array of arrays — one array of observations per group
 * @returns everything needed to draw the shrinkage happening
 */
export function randomIntercept(groups, { iters = 200, tol = 1e-10 } = {}) {
  const k = groups.length;
  const n = groups.map(g => g.length);
  const raw = groups.map(g => (g.length ? mean(g) : NaN));
  const N = sum(n);

  /* within-group variance, pooled — this one does not need iterating */
  const ss = sum(groups.map((g, j) => sum(g.map(v => (v - raw[j]) ** 2))));
  const df = Math.max(1, N - k);
  const sigma2 = ss / df;

  /* start from the spread of the raw means, minus what noise alone explains */
  let tau2 = Math.max(1e-8, variance(raw.filter(isFinite)) - sigma2 / (N / k));
  let mu = sum(raw.map((v, j) => v * n[j])) / N;
  let lambda = raw.map(() => 0.5);
  let hist = [];

  for (let it = 0; it < iters; it++) {
    lambda = n.map(nj => tau2 / (tau2 + sigma2 / nj));
    /* the grand mean, weighted by how much each group is trusted */
    const w = lambda.map((l, j) => nj_weight(n[j], sigma2, tau2));
    mu = sum(raw.map((v, j) => v * w[j])) / sum(w);

    const b = raw.map((v, j) => lambda[j] * (v - mu));
    const post = lambda.map((l, j) => l * sigma2 / n[j]);   /* posterior variance of bⱼ */
    const next = mean(b.map((v, j) => v * v + post[j]));
    hist.push({ tau2, mu, lambda: lambda.slice() });
    if (Math.abs(next - tau2) < tol) { tau2 = next; break; }
    tau2 = Math.max(1e-10, next);
  }

  lambda = n.map(nj => tau2 / (tau2 + sigma2 / nj));
  const shrunk = raw.map((v, j) => mu + lambda[j] * (v - mu));

  return {
    mu, tau2, sigma2, tau: Math.sqrt(tau2), sigma: Math.sqrt(sigma2),
    n, raw, lambda, shrunk, hist,
    /** what the model would say about a group it has never seen */
    newGroup: mu,
    icc: tau2 / (tau2 + sigma2),
  };
}

/* precision weight for the grand mean: 1 / (τ² + σ²/n) */
const nj_weight = (nj, sigma2, tau2) => 1 / (tau2 + sigma2 / nj);

/**
 * Shrink a set of per-group slopes toward their average, by the same logic:
 * each slope is trusted in proportion to how precisely it was estimated.
 *
 * Not a full random-slope fit — a full one estimates the intercept/slope
 * covariance too — but the shrinkage it produces is the same shape, and the
 * point of the picture is the shrinkage.
 */
export function shrinkSlopes(groups) {
  const fits = groups.map(g => {
    if (g.length < 3) return { b1: NaN, se: Infinity, n: g.length };
    const x = g.map(p => p[0]), y = g.map(p => p[1]);
    const f = linreg(x, y);
    return { b1: f.b1, b0: f.b0, se: f.seB1, n: g.length };
  });
  const ok = fits.filter(f => isFinite(f.b1) && isFinite(f.se) && f.se > 0);
  const grand = ok.length ? sum(ok.map(f => f.b1 / (f.se * f.se))) / sum(ok.map(f => 1 / (f.se * f.se))) : 0;
  const meanSe2 = ok.length ? mean(ok.map(f => f.se * f.se)) : 1;
  const tau2 = Math.max(1e-8, variance(ok.map(f => f.b1)) - meanSe2);

  return {
    grand, tau2, tau: Math.sqrt(tau2),
    slopes: fits.map(f => {
      if (!isFinite(f.b1)) return { ...f, lambda: 0, shrunk: grand };
      const l = tau2 / (tau2 + f.se * f.se);
      return { ...f, lambda: l, shrunk: grand + l * (f.b1 - grand) };
    }),
  };
}

/**
 * Eight schools with wildly unequal enrolments, from a world where the true
 * school effects are known — so a lesson can score each method against the
 * truth instead of against itself.
 */
export function schools({ tau = 5, sigma = 10, seed = 33, sizes = [3, 4, 6, 8, 12, 18, 25, 40] } = {}) {
  const r = rng(seed);
  const z = sizes.map(() => randNorm(r, 0, 1));
  const zc = (() => { const m = mean(z); const s = Math.sqrt(variance(z)); return z.map(v => (v - m) / s); })();
  const truth = zc.map(v => 500 + tau * v);
  const noise = sizes.map(nj => Array.from({ length: nj }, () => randNorm(r, 0, 1)));
  return {
    sizes, truth,
    /** regenerating with a different sigma rescales the same noise */
    at: (t = tau, sg = sigma) => zc.map((v, j) =>
      noise[j].map(e => 500 + t * v + sg * e)),
    names: ['Ash', 'Birch', 'Cedar', 'Dale', 'Elm', 'Fern', 'Grove', 'Hollow'],
  };
}
