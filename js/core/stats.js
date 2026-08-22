/* ─────────────────────────────────────────────────────────────────────────────
   stats.js — the math. Every number on this site is computed here at runtime.
   No hardcoded results anywhere; if you drag a point, the p-value moves.
   ───────────────────────────────────────────────────────────────────────────── */

/* ── basics ───────────────────────────────────────────────────────────────── */

export const sum = a => a.reduce((s, v) => s + v, 0);
export const mean = a => sum(a) / a.length;

/** sample variance, n−1 in the denominator */
export function variance(a) {
  const m = mean(a);
  return sum(a.map(v => (v - m) ** 2)) / (a.length - 1);
}
export const sd = a => Math.sqrt(variance(a));

/** population variance, n in the denominator */
export function varianceP(a) {
  const m = mean(a);
  return sum(a.map(v => (v - m) ** 2)) / a.length;
}

export function covariance(x, y) {
  const mx = mean(x), my = mean(y);
  return sum(x.map((v, i) => (v - mx) * (y[i] - my))) / (x.length - 1);
}

export function pearson(x, y) {
  const c = covariance(x, y);
  const d = sd(x) * sd(y);
  return d === 0 ? 0 : c / d;
}

export const zscores = a => {
  const m = mean(a), s = sd(a);
  return a.map(v => (s === 0 ? 0 : (v - m) / s));
};

/** average ranks, ties share the mean of the ranks they span */
export function ranks(a) {
  const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
  const out = new Array(a.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const r = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[idx[k][1]] = r;
    i = j + 1;
  }
  return out;
}

export const spearman = (x, y) => pearson(ranks(x), ranks(y));

export const quantile = (a, p) => {
  const s = [...a].sort((u, v) => u - v);
  const h = (s.length - 1) * p;
  const lo = Math.floor(h);
  return s[lo] + (h - lo) * ((s[Math.min(lo + 1, s.length - 1)]) - s[lo]);
};
export const median = a => quantile(a, 0.5);
export const extent = a => [Math.min(...a), Math.max(...a)];

/* ── special functions ────────────────────────────────────────────────────── */

const G_COF = [
  76.18009172947146, -86.50532032941677, 24.01409824083091,
  -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
];

/** log Γ(x), Lanczos */
export function gammaln(x) {
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += G_COF[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

export const gammafn = x => Math.exp(gammaln(x));

/** regularized lower incomplete gamma P(a,x) */
export function gammap(a, x) {
  if (x < 0 || a <= 0) return NaN;
  if (x === 0) return 0;
  if (x < a + 1) {
    // series
    let ap = a, del = 1 / a, s = del;
    for (let n = 0; n < 300; n++) {
      ap++; del *= x / ap; s += del;
      if (Math.abs(del) < Math.abs(s) * 1e-14) break;
    }
    return s * Math.exp(-x + a * Math.log(x) - gammaln(a));
  }
  // continued fraction for Q, then complement
  const FPMIN = 1e-300;
  let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
  for (let i = 1; i <= 300; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;  if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - gammaln(a)) * h;
}

/** regularized incomplete beta I_x(a,b), Lentz continued fraction */
export function ibeta(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta = gammaln(a + b) - gammaln(a) - gammaln(b) + a * Math.log(x) + b * Math.log(1 - x);
  const front = Math.exp(lbeta);
  const cf = (aa, bb, xx) => {
    const FPMIN = 1e-300;
    const qab = aa + bb, qap = aa + 1, qam = aa - 1;
    let c = 1, d = 1 - (qab * xx) / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 300; m++) {
      const m2 = 2 * m;
      let aaa = (m * (bb - m) * xx) / ((qam + m2) * (aa + m2));
      d = 1 + aaa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aaa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aaa = (-(aa + m) * (qab + m) * xx) / ((aa + m2) * (qap + m2));
      d = 1 + aaa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aaa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-14) break;
    }
    return h;
  };
  return x < (a + 1) / (a + b + 2)
    ? (front * cf(a, b, x)) / a
    : 1 - (Math.exp(gammaln(a + b) - gammaln(a) - gammaln(b) + b * Math.log(1 - x) + a * Math.log(x)) * cf(b, a, 1 - x)) / b;
}

/* ── distributions ────────────────────────────────────────────────────────── */

export const normPdf = (x, mu = 0, s = 1) =>
  Math.exp(-((x - mu) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI));

export function normCdf(x, mu = 0, s = 1) {
  const z = (x - mu) / (s * Math.SQRT2);
  return 0.5 * (1 + (z >= 0 ? gammap(0.5, z * z) : -gammap(0.5, z * z)));
}

/** inverse normal CDF — Acklam's rational approximation + one Halley refinement */
export function normInv(p, mu = 0, s = 1) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
             1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
             6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
             -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
             3.754408661907416e+00];
  const pl = 0.02425;
  let q, r, x;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (p <= 1 - pl) {
    q = p - 0.5; r = q * q;
    x = (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
        (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  const e = normCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  x = x - u / (1 + (x * u) / 2);
  return mu + s * x;
}

export const tPdf = (t, df) =>
  Math.exp(gammaln((df + 1) / 2) - gammaln(df / 2)) /
  Math.sqrt(df * Math.PI) * (1 + (t * t) / df) ** (-(df + 1) / 2);

export function tCdf(t, df) {
  const x = df / (df + t * t);
  const p = 0.5 * ibeta(df / 2, 0.5, x);
  return t > 0 ? 1 - p : p;
}

/** two-sided p-value from a t statistic */
export const tTest2 = (t, df) => 2 * (1 - tCdf(Math.abs(t), df));

/** inverse t CDF by bisection — plenty fast, and exact enough for a CI */
export function tInv(p, df) {
  let lo = -300, hi = 300;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (tCdf(mid, df) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export const chi2Cdf = (x, k) => (x <= 0 ? 0 : gammap(k / 2, x / 2));
export const chi2P = (x, k) => 1 - chi2Cdf(x, k);
export const chi2Pdf = (x, k) =>
  x <= 0 ? 0 : Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - gammaln(k / 2) - (k / 2) * Math.LN2);

export const fCdf = (f, d1, d2) => (f <= 0 ? 0 : ibeta(d1 / 2, d2 / 2, (d1 * f) / (d1 * f + d2)));
export const fP = (f, d1, d2) => 1 - fCdf(f, d1, d2);
export function fPdf(x, d1, d2) {
  if (x <= 0) return 0;
  const lg = gammaln((d1 + d2) / 2) - gammaln(d1 / 2) - gammaln(d2 / 2);
  return Math.exp(lg + (d1 / 2) * Math.log(d1 / d2) + (d1 / 2 - 1) * Math.log(x)
    - ((d1 + d2) / 2) * Math.log(1 + (d1 * x) / d2));
}

export const betaPdf = (x, a, b) =>
  x <= 0 || x >= 1 ? 0
    : Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x)
      + gammaln(a + b) - gammaln(a) - gammaln(b));

export const poissonPmf = (k, lam) =>
  Math.exp(-lam + k * Math.log(lam) - gammaln(k + 1));

export const binomPmf = (k, n, p) =>
  Math.exp(gammaln(n + 1) - gammaln(k + 1) - gammaln(n - k + 1)
    + k * Math.log(p) + (n - k) * Math.log(1 - p));

/** negative binomial in the (mean, theta) parameterization used by MASS::glm.nb */
export const nbinomPmf = (k, mu, theta) =>
  Math.exp(gammaln(k + theta) - gammaln(theta) - gammaln(k + 1)
    + theta * Math.log(theta / (theta + mu)) + k * Math.log(mu / (theta + mu)));

/* ── correlation inference ────────────────────────────────────────────────── */

/** t for H0: rho = 0 */
export const rToT = (r, n) => (r * Math.sqrt(n - 2)) / Math.sqrt(1 - r * r);

/** Fisher z-transform confidence interval for rho */
export function rCI(r, n, conf = 0.95) {
  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const se = 1 / Math.sqrt(n - 3);
  const crit = normInv(1 - (1 - conf) / 2);
  const lo = z - crit * se, hi = z + crit * se;
  return [Math.tanh(lo), Math.tanh(hi)];
}

/* ── t-tests ──────────────────────────────────────────────────────────────── */

export function tTestTwoSample(a, b, { welch = true } = {}) {
  const na = a.length, nb = b.length;
  const ma = mean(a), mb = mean(b);
  const va = variance(a), vb = variance(b);
  let se, df;
  if (welch) {
    se = Math.sqrt(va / na + vb / nb);
    df = (va / na + vb / nb) ** 2 /
         ((va / na) ** 2 / (na - 1) + (vb / nb) ** 2 / (nb - 1));
  } else {
    const sp2 = ((na - 1) * va + (nb - 1) * vb) / (na + nb - 2);
    se = Math.sqrt(sp2 * (1 / na + 1 / nb));
    df = na + nb - 2;
  }
  const t = (ma - mb) / se;
  const crit = tInv(0.975, df);
  return {
    ma, mb, va, vb, na, nb, diff: ma - mb, se, df, t,
    p: tTest2(t, df),
    ci: [ma - mb - crit * se, ma - mb + crit * se],
    d: (ma - mb) / Math.sqrt(((na - 1) * va + (nb - 1) * vb) / (na + nb - 2)),
  };
}

export function tTestPaired(a, b) {
  const d = a.map((v, i) => v - b[i]);
  const n = d.length, md = mean(d), se = sd(d) / Math.sqrt(n);
  const t = md / se, df = n - 1, crit = tInv(0.975, df);
  return { d, n, md, se, t, df, p: tTest2(t, df), ci: [md - crit * se, md + crit * se] };
}

export function tTestOneSample(a, mu0 = 0) {
  const n = a.length, m = mean(a), se = sd(a) / Math.sqrt(n);
  const t = (m - mu0) / se, df = n - 1, crit = tInv(0.975, df);
  return { n, m, se, t, df, p: tTest2(t, df), ci: [m - crit * se, m + crit * se] };
}

/* ── one-way ANOVA ────────────────────────────────────────────────────────── */

export function anova(groups) {
  const all = groups.flat();
  const grand = mean(all);
  const k = groups.length, N = all.length;
  const ssb = sum(groups.map(g => g.length * (mean(g) - grand) ** 2));
  const ssw = sum(groups.map(g => { const m = mean(g); return sum(g.map(v => (v - m) ** 2)); }));
  const sst = sum(all.map(v => (v - grand) ** 2));
  const dfb = k - 1, dfw = N - k;
  const msb = ssb / dfb, msw = ssw / dfw;
  const F = msb / msw;
  return { grand, k, N, ssb, ssw, sst, dfb, dfw, msb, msw, F, p: fP(F, dfb, dfw), eta2: ssb / sst };
}

/* ── chi-square ───────────────────────────────────────────────────────────── */

export function chi2Independence(obs) {
  const rows = obs.length, cols = obs[0].length;
  const rowT = obs.map(sum);
  const colT = Array.from({ length: cols }, (_, j) => sum(obs.map(r => r[j])));
  const N = sum(rowT);
  const exp = obs.map((r, i) => r.map((_, j) => (rowT[i] * colT[j]) / N));
  const cells = obs.map((r, i) => r.map((o, j) => ((o - exp[i][j]) ** 2) / exp[i][j]));
  const X2 = sum(cells.map(sum));
  const df = (rows - 1) * (cols - 1);
  return {
    obs, exp, cells, rowT, colT, N, X2, df, p: chi2P(X2, df),
    resid: obs.map((r, i) => r.map((o, j) => (o - exp[i][j]) / Math.sqrt(exp[i][j]))),
    cramersV: Math.sqrt(X2 / (N * Math.min(rows - 1, cols - 1))),
  };
}

export function chi2GoodnessOfFit(obs, expProbs) {
  const N = sum(obs);
  const exp = expProbs.map(p => p * N);
  const cells = obs.map((o, i) => ((o - exp[i]) ** 2) / exp[i]);
  const X2 = sum(cells);
  const df = obs.length - 1;
  return { obs, exp, cells, X2, df, N, p: chi2P(X2, df) };
}

/* ── linear algebra ───────────────────────────────────────────────────────── */

export const matT = A => A[0].map((_, j) => A.map(r => r[j]));

export function matMul(A, B) {
  const n = A.length, m = B[0].length, K = B.length;
  const C = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < n; i++)
    for (let k = 0; k < K; k++) {
      const a = A[i][k];
      if (a === 0) continue;
      for (let j = 0; j < m; j++) C[i][j] += a * B[k][j];
    }
  return C;
}

export const matVec = (A, v) => A.map(r => sum(r.map((a, j) => a * v[j])));

export function det2(m) { return m[0][0] * m[1][1] - m[0][1] * m[1][0]; }

export function inv2(m) {
  const d = det2(m);
  if (Math.abs(d) < 1e-12) return null;
  return [[m[1][1] / d, -m[0][1] / d], [-m[1][0] / d, m[0][0] / d]];
}

/** Gauss–Jordan with partial pivoting. Returns null if singular. */
export function solve(A, b) {
  const n = A.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-12) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c];
    for (let j = c; j <= n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      if (f === 0) continue;
      for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j];
    }
  }
  return M.map(r => r[n]);
}

export function matInv(A) {
  const n = A.length;
  const cols = [];
  for (let j = 0; j < n; j++) {
    const e = new Array(n).fill(0); e[j] = 1;
    const c = solve(A, e);
    if (!c) return null;
    cols.push(c);
  }
  return matT(cols);
}

/* ── regression ───────────────────────────────────────────────────────────── */

/** simple OLS: y = b0 + b1·x, with full inference */
export function linreg(x, y) {
  const n = x.length;
  const mx = mean(x), my = mean(y);
  const sxx = sum(x.map(v => (v - mx) ** 2));
  const sxy = sum(x.map((v, i) => (v - mx) * (y[i] - my)));
  const b1 = sxy / sxx;
  const b0 = my - b1 * mx;
  const fit = x.map(v => b0 + b1 * v);
  const resid = y.map((v, i) => v - fit[i]);
  const sse = sum(resid.map(r => r * r));
  const sst = sum(y.map(v => (v - my) ** 2));
  const df = n - 2;
  const mse = sse / df;
  const seB1 = Math.sqrt(mse / sxx);
  const seB0 = Math.sqrt(mse * (1 / n + (mx * mx) / sxx));
  const t = b1 / seB1;
  const crit = tInv(0.975, df);
  return {
    n, b0, b1, fit, resid, sse, sst, ssr: sst - sse, mse, df,
    rmse: Math.sqrt(mse), seB1, seB0, t, p: tTest2(t, df),
    r2: 1 - sse / sst, r: pearson(x, y), mx, my, sxx, sxy,
    ciB1: [b1 - crit * seB1, b1 + crit * seB1],
    /** standard error of the mean response at x — the band that gets fat at the edges */
    seFit: v => Math.sqrt(mse * (1 / n + ((v - mx) ** 2) / sxx)),
    sePred: v => Math.sqrt(mse * (1 + 1 / n + ((v - mx) ** 2) / sxx)),
    crit,
  };
}

/** multiple OLS via normal equations. X has NO intercept column; we add it. */
export function mlr(X, y) {
  const n = y.length, p = X[0].length;
  const Xd = X.map(r => [1, ...r]);
  const Xt = matT(Xd);
  const XtX = matMul(Xt, Xd);
  const XtY = matVec(Xt, y);
  const beta = solve(XtX, XtY);
  if (!beta) return null;
  const XtXinv = matInv(XtX);
  const fit = Xd.map(r => sum(r.map((v, j) => v * beta[j])));
  const resid = y.map((v, i) => v - fit[i]);
  const sse = sum(resid.map(r => r * r));
  const my = mean(y);
  const sst = sum(y.map(v => (v - my) ** 2));
  const df = n - p - 1;
  const mse = sse / df;
  const se = beta.map((_, j) => Math.sqrt(mse * XtXinv[j][j]));
  const t = beta.map((b, j) => b / se[j]);
  return {
    beta, se, t, df, fit, resid, sse, sst, mse, n, p,
    p_: t.map(v => tTest2(v, df)),
    r2: 1 - sse / sst,
    adjR2: 1 - (sse / df) / (sst / (n - 1)),
    F: ((sst - sse) / p) / mse,
    fp: fP(((sst - sse) / p) / mse, p, df),
    XtX, XtXinv, vif: null,
  };
}

/** residualize y on X (used for partial-effect / Frisch–Waugh plots) */
export function residualize(y, X) {
  const m = mlr(X, y);
  return m ? m.resid : y.slice();
}

/* ── GLM: one engine, three families ──────────────────────────────────────── */

const FAMILIES = {
  logistic: {
    link: mu => Math.log(mu / (1 - mu)),
    inv: eta => 1 / (1 + Math.exp(-eta)),
    variance: mu => mu * (1 - mu),
    start: y => y.map(v => (v + 0.5) / 2),
    dev: (y, mu) => 2 * sum(y.map((v, i) =>
      (v ? v * Math.log(v / mu[i]) : 0) + (v < 1 ? (1 - v) * Math.log((1 - v) / (1 - mu[i])) : 0))),
  },
  poisson: {
    link: mu => Math.log(mu),
    inv: eta => Math.exp(Math.min(eta, 700)),
    variance: mu => mu,
    start: y => y.map(v => v + 0.1),
    dev: (y, mu) => 2 * sum(y.map((v, i) => (v > 0 ? v * Math.log(v / mu[i]) : 0) - (v - mu[i]))),
  },
};

/**
 * Iteratively reweighted least squares. Same loop for logistic and Poisson —
 * only the link, the variance function and the deviance change.
 * `theta` (optional) switches Poisson into negative-binomial weighting.
 */
export function glm(X, y, family = 'logistic', { theta = null, iters = 60 } = {}) {
  const fam = FAMILIES[family];
  if (!fam) throw new Error('unknown family ' + family);
  const Xd = X.map(r => [1, ...r]);
  const p = Xd[0].length;
  let beta = new Array(p).fill(0);
  let mu = fam.start(y);
  let eta = mu.map(fam.link);
  const trace = [];
  for (let it = 0; it < iters; it++) {
    const V = mu.map(m => (theta ? m + (m * m) / theta : fam.variance(m)));
    const dmu = mu.map((m, i) => (family === 'logistic' ? m * (1 - m) : m)); // dμ/dη
    const w = dmu.map((d, i) => (d * d) / Math.max(V[i], 1e-10));
    const z = eta.map((e, i) => e + (y[i] - mu[i]) / Math.max(dmu[i], 1e-10));
    // weighted normal equations
    const XtWX = Array.from({ length: p }, () => new Array(p).fill(0));
    const XtWz = new Array(p).fill(0);
    for (let i = 0; i < Xd.length; i++) {
      for (let a = 0; a < p; a++) {
        XtWz[a] += w[i] * Xd[i][a] * z[i];
        for (let b = 0; b < p; b++) XtWX[a][b] += w[i] * Xd[i][a] * Xd[i][b];
      }
    }
    const nb = solve(XtWX, XtWz);
    if (!nb) break;
    const delta = Math.max(...nb.map((v, i) => Math.abs(v - beta[i])));
    beta = nb;
    eta = Xd.map(r => sum(r.map((v, j) => v * beta[j])));
    mu = eta.map(fam.inv).map(m => (family === 'logistic' ? Math.min(Math.max(m, 1e-9), 1 - 1e-9) : Math.max(m, 1e-9)));
    trace.push({ it, beta: [...beta], dev: fam.dev(y, mu) });
    if (delta < 1e-10) break;
  }
  // covariance from the final weight matrix
  const V = mu.map(m => (theta ? m + (m * m) / theta : fam.variance(m)));
  const dmu = mu.map(m => (family === 'logistic' ? m * (1 - m) : m));
  const w = dmu.map((d, i) => (d * d) / Math.max(V[i], 1e-10));
  const XtWX = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let i = 0; i < Xd.length; i++)
    for (let a = 0; a < p; a++)
      for (let b = 0; b < p; b++) XtWX[a][b] += w[i] * Xd[i][a] * Xd[i][b];
  const cov = matInv(XtWX);
  const se = cov ? beta.map((_, j) => Math.sqrt(Math.abs(cov[j][j]))) : beta.map(() => NaN);
  const zst = beta.map((b, j) => b / se[j]);
  const dev = fam.dev(y, mu);
  const nullMu = (() => {
    const m0 = mean(y);
    return y.map(() => (family === 'logistic' ? Math.min(Math.max(m0, 1e-9), 1 - 1e-9) : Math.max(m0, 1e-9)));
  })();
  return {
    beta, se, z: zst, mu, eta, trace, dev, family, theta,
    p: zst.map(v => 2 * (1 - normCdf(Math.abs(v)))),
    nullDev: fam.dev(y, nullMu),
    pseudoR2: 1 - dev / fam.dev(y, nullMu),
    aic: dev + 2 * p,
    /** Pearson dispersion — the number that tells you Poisson is lying */
    dispersion: sum(y.map((v, i) => ((v - mu[i]) ** 2) / Math.max(V[i], 1e-10))) / (y.length - p),
    predict: xs => fam.inv(beta[0] + sum(xs.map((v, j) => v * beta[j + 1]))),
    linpred: xs => beta[0] + sum(xs.map((v, j) => v * beta[j + 1])),
  };
}

/** grid-search theta for a negative binomial (profile likelihood, good enough to teach) */
export function glmNB(X, y) {
  let best = null;
  for (let lt = -3; lt <= 6; lt += 0.02) {
    const theta = Math.exp(lt);
    const m = glm(X, y, 'poisson', { theta });
    const ll = sum(y.map((v, i) => Math.log(Math.max(nbinomPmf(v, m.mu[i], theta), 1e-300))));
    if (!best || ll > best.ll) best = { ll, theta, m };
  }
  return { ...best.m, theta: best.theta, logLik: best.ll, aic: -2 * best.ll + 2 * (X[0].length + 2) };
}

/* ── splines ──────────────────────────────────────────────────────────────── */

/** truncated power basis for a cubic spline: [x, x², x³, (x−k)³₊ …] */
export function splineBasis(x, knots, degree = 3) {
  const row = [];
  for (let d = 1; d <= degree; d++) row.push(x ** d);
  for (const k of knots) row.push(x > k ? (x - k) ** degree : 0);
  return row;
}

export function fitSpline(x, y, knots, degree = 3) {
  const X = x.map(v => splineBasis(v, knots, degree));
  const m = mlr(X, y);
  if (!m) return null;
  return {
    ...m, knots, degree,
    predict: v => sum([1, ...splineBasis(v, knots, degree)].map((b, j) => b * m.beta[j])),
  };
}

/* ── calculus (numeric, for the teaching panels) ──────────────────────────── */

export const deriv = (f, x, h = 1e-5) => (f(x + h) - f(x - h)) / (2 * h);
export const deriv2 = (f, x, h = 1e-4) => (f(x + h) - 2 * f(x) + f(x - h)) / (h * h);

export function riemann(f, a, b, n, rule = 'mid') {
  const h = (b - a) / n;
  const bars = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const x0 = a + i * h, x1 = x0 + h;
    let hgt;
    if (rule === 'left') hgt = f(x0);
    else if (rule === 'right') hgt = f(x1);
    else if (rule === 'trap') hgt = (f(x0) + f(x1)) / 2;
    else hgt = f((x0 + x1) / 2);
    bars.push({ x0, x1, h: hgt, area: hgt * h });
    total += hgt * h;
  }
  return { bars, total, h };
}

/** Simpson's rule — the "true" value we compare Riemann sums against */
export function simpson(f, a, b, n = 2000) {
  if (n % 2) n++;
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}

/* ── random ───────────────────────────────────────────────────────────────── */

/** seeded PRNG so every reader sees the same "random" run */
export function rng(seed = 42) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randNorm(r, mu = 0, s = 1) {
  const u = Math.max(r(), 1e-12), v = r();
  return mu + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function randPois(r, lam) {
  const L = Math.exp(-lam);
  let k = 0, p = 1;
  do { k++; p *= r(); } while (p > L);
  return k - 1;
}

export function randExp(r, rate = 1) { return -Math.log(Math.max(r(), 1e-12)) / rate; }

export function sample(arr, n, r) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(r() * arr.length)]);
  return out;
}

/* ── MCMC ─────────────────────────────────────────────────────────────────── */

/**
 * Random-walk Metropolis. Returns every proposal (accepted or not) so the
 * lesson can animate the rejected jumps too — that's where the intuition is.
 */
export function metropolis(logPost, start, { steps = 500, step = 0.5, seed = 7 } = {}) {
  const r = rng(seed);
  const dim = start.length;
  let cur = [...start];
  let curLP = logPost(cur);
  const chain = [{ x: [...cur], lp: curLP, accepted: true, proposal: [...cur], ratio: 1 }];
  for (let i = 0; i < steps; i++) {
    const prop = cur.map(v => v + randNorm(r, 0, step));
    const propLP = logPost(prop);
    const logRatio = propLP - curLP;
    const accepted = Math.log(Math.max(r(), 1e-300)) < logRatio;
    if (accepted) { cur = prop; curLP = propLP; }
    chain.push({
      x: [...cur], lp: curLP, accepted,
      proposal: prop, ratio: Math.min(1, Math.exp(logRatio)),
    });
  }
  return {
    chain,
    accRate: chain.filter(c => c.accepted).length / chain.length,
    draws: chain.map(c => c.x),
  };
}

/** simple discrete Markov chain: power-iterate to the stationary distribution */
export function markovRun(P, start, steps) {
  const path = [start.slice()];
  let v = start.slice();
  for (let i = 0; i < steps; i++) {
    v = P[0].map((_, j) => sum(v.map((p, k) => p * P[k][j])));
    path.push(v.slice());
  }
  return path;
}

/* ── histogram helper ─────────────────────────────────────────────────────── */

export function histogram(values, bins = 20, domain) {
  const [lo, hi] = domain || extent(values);
  const w = (hi - lo) / bins || 1;
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    let b = Math.floor((v - lo) / w);
    if (b < 0) b = 0;
    if (b >= bins) b = bins - 1;
    counts[b]++;
  }
  return counts.map((c, i) => ({ x0: lo + i * w, x1: lo + (i + 1) * w, n: c, density: c / (values.length * w) }));
}

/* ── formatting ───────────────────────────────────────────────────────────── */

export const fmt = (v, d = 2) =>
  !isFinite(v) ? '—' : (Math.abs(v) < 1e-4 && v !== 0 ? v.toExponential(1) : v.toFixed(d));

export function fmtP(p) {
  if (!isFinite(p)) return '—';
  if (p < 0.0001) return '< .0001';
  if (p < 0.001) return p.toFixed(5).replace(/^0/, '');
  return p.toFixed(4).replace(/^0/, '');
}

/** drop the leading zero the way journals do: 0.83 → .83 */
export const fmtR = (v, d = 3) => {
  const s = v.toFixed(d);
  return s.startsWith('0.') ? s.slice(1) : s.startsWith('-0.') ? '-' + s.slice(2) : s;
};
