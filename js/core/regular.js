/* ─────────────────────────────────────────────────────────────────────────────
   regular.js — the machinery for paying a model to be smaller.

   Ordinary least squares has exactly one instruction: make the residuals small.
   With enough columns it can always obey, and the way it obeys is by inventing
   enormous coefficients that cancel each other out on the training rows and
   agree about nothing anywhere else.

   Regularisation adds a second instruction that costs money. Ridge charges for
   the squares of the coefficients, lasso for their absolute values, and that
   single difference — squared versus absolute — is the whole reason one shrinks
   and the other deletes.
   ───────────────────────────────────────────────────────────────────────────── */

import { mean, sd, sum, rng, randNorm, matT, matMul, matVec, matInv } from './stats.js';

/* ── standardising ────────────────────────────────────────────────────────── */

/**
 * A penalty on the coefficients is a penalty in the units of the columns. Leave
 * a column in millimetres next to one in kilometres and the penalty falls
 * almost entirely on the millimetre column, for no reason but the unit. So the
 * columns are centred and scaled first, always, and the intercept is never
 * penalised — it is just the mean of y once everything else is centred.
 */
export function standardise(X) {
  const p = X[0].length;
  const mu = range(p).map(j => mean(X.map(r => r[j])));
  const s = range(p).map(j => sd(X.map(r => r[j])) || 1);
  return {
    mu, s,
    Z: X.map(r => r.map((v, j) => (v - mu[j]) / s[j])),
    /** put coefficients back into the original units */
    unscale: b => b.map((v, j) => v / s[j]),
  };
}
const range = n => Array.from({ length: n }, (_, i) => i);

/* ── ridge ────────────────────────────────────────────────────────────────── */

/**
 * (ZᵀZ + λI)⁻¹ Zᵀy — closed form, because the squared penalty keeps everything
 * differentiable everywhere. Adding λ down the diagonal is literally adding
 * variance to the predictors that is not correlated with anything, which is why
 * it fixes the near-singular matrix that made OLS explode.
 */
export function ridge(Z, y, lam) {
  const p = Z[0].length;
  const ZT = matT(Z);
  const A = matMul(ZT, Z).map((row, i) => row.map((v, j) => v + (i === j ? lam : 0)));
  const b = matVec(ZT, y.map(v => v - mean(y)));
  const beta = matVec(matInv(A), b);
  return { beta, a0: mean(y) };
}

/* ── lasso ────────────────────────────────────────────────────────────────── */

/**
 * The one piece of arithmetic that makes the lasso different from ridge.
 *
 * Ridge multiplies a coefficient by a number slightly less than one, so it can
 * approach zero forever and never arrive. Soft thresholding *subtracts* a fixed
 * amount and stops at zero — so any coefficient whose evidence is worth less
 * than the penalty is not shrunk, it is deleted.
 */
export const soft = (z, g) => (z > g ? z - g : z < -g ? z + g : 0);

/**
 * Coordinate descent: hold every other coefficient still, look at what is left
 * of y, and solve the one-variable problem exactly with soft(). Repeat. On
 * standardised columns each update is a two-line closed form.
 */
export function lasso(Z, y, lam, { iters = 400, tol = 1e-9 } = {}) {
  const n = Z.length, p = Z[0].length;
  const yc = y.map(v => v - mean(y));
  let beta = new Array(p).fill(0);
  let r = yc.slice();
  for (let it = 0; it < iters; it++) {
    let move = 0;
    for (let j = 0; j < p; j++) {
      const bj = beta[j];
      // add this column's current contribution back into the residual
      let rho = 0, zz = 0;
      for (let i = 0; i < n; i++) {
        const zij = Z[i][j];
        rho += zij * (r[i] + zij * bj);
        zz += zij * zij;
      }
      const nb = soft(rho / n, lam) / (zz / n);
      if (nb !== bj) {
        for (let i = 0; i < n; i++) r[i] -= Z[i][j] * (nb - bj);
        move = Math.max(move, Math.abs(nb - bj));
        beta[j] = nb;
      }
    }
    if (move < tol) break;
  }
  return { beta, a0: mean(y) };
}

/** elastic net: α = 1 is pure lasso, α = 0 is pure ridge */
export function elastic(Z, y, lam, alpha, { iters = 400 } = {}) {
  const n = Z.length, p = Z[0].length;
  const yc = y.map(v => v - mean(y));
  let beta = new Array(p).fill(0);
  let r = yc.slice();
  for (let it = 0; it < iters; it++) {
    for (let j = 0; j < p; j++) {
      const bj = beta[j];
      let rho = 0, zz = 0;
      for (let i = 0; i < n; i++) {
        const zij = Z[i][j];
        rho += zij * (r[i] + zij * bj);
        zz += zij * zij;
      }
      const nb = soft(rho / n, lam * alpha) / (zz / n + lam * (1 - alpha));
      if (nb !== bj) {
        for (let i = 0; i < n; i++) r[i] -= Z[i][j] * (nb - bj);
        beta[j] = nb;
      }
    }
  }
  return { beta, a0: mean(y) };
}

/* ── paths ────────────────────────────────────────────────────────────────── */

export const LAMBDAS = (() => {
  const out = [];
  for (let i = 0; i <= 44; i++) out.push(Math.exp(Math.log(0.0015) + (i / 44) * (Math.log(4.5) - Math.log(0.0015))));
  return out;
})();

/** every coefficient at every λ — the picture that makes the difference obvious */
export function coefPath(Z, y, kind = 'lasso', lambdas = LAMBDAS) {
  return lambdas.map(lam => ({
    lam,
    beta: (kind === 'ridge' ? ridge(Z, y, lam * Z.length) : lasso(Z, y, lam)).beta,
  }));
}

/* ── cross-validation ─────────────────────────────────────────────────────── */

export function kFold(n, k, seed = 3) {
  const r = rng(seed);
  const idx = range(n);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return range(k).map(f => ({
    test: idx.filter((_, i) => i % k === f),
    train: idx.filter((_, i) => i % k !== f),
  }));
}

/**
 * The curve that chooses λ. Also returns the one-standard-error rule: the
 * largest λ whose error is still within one standard error of the minimum,
 * because the minimum of a noisy curve is itself a noisy quantity and the
 * simpler model inside the noise is the better bet.
 */
export function cvCurve(X, y, kind = 'lasso', { k = 8, lambdas = LAMBDAS, seed = 3 } = {}) {
  const folds = kFold(X.length, k, seed);
  const rows = lambdas.map(lam => {
    const errs = folds.map(f => {
      const Xtr = f.train.map(i => X[i]), ytr = f.train.map(i => y[i]);
      const std = standardise(Xtr);
      const fit = kind === 'ridge' ? ridge(std.Z, ytr, lam * Xtr.length) : lasso(std.Z, ytr, lam);
      const se = f.test.map(i => {
        const z = X[i].map((v, j) => (v - std.mu[j]) / std.s[j]);
        const yh = fit.a0 + sum(z.map((v, j) => v * fit.beta[j]));
        return (y[i] - yh) ** 2;
      });
      return mean(se);
    });
    const m = mean(errs);
    return { lam, mse: m, se: sd(errs) / Math.sqrt(k), nz: 0 };
  });
  const best = rows.reduce((a, b) => (b.mse < a.mse ? b : a));
  const ceiling = best.mse + best.se;
  const oneSe = rows.filter(r => r.mse <= ceiling).reduce((a, b) => (b.lam > a.lam ? b : a), best);
  return { rows, best, oneSe, ceiling };
}

/* ── the demonstration data ───────────────────────────────────────────────── */

/**
 * Twenty columns, of which four matter. Two of the four are nearly the same
 * column as each other, which is where ridge and lasso visibly disagree.
 */
export function design({ n = 60, p = 20, seed = 5, rho = 0.92, noise = 1.6 } = {}) {
  const r = rng(seed);
  const truth = new Array(p).fill(0);
  [2.4, 2.0, -1.7, 1.1].forEach((v, j) => { if (j < p) truth[j] = v; });
  const X = [];
  for (let i = 0; i < n; i++) {
    const row = range(p).map(() => randNorm(r, 0, 1));
    // column 1 is a near-copy of column 0: the collinear pair
    if (p > 1) row[1] = rho * row[0] + Math.sqrt(1 - rho * rho) * row[1];
    X.push(row);
  }
  const y = X.map(row => 5 + sum(row.map((v, j) => v * truth[j])) + randNorm(r, 0, noise));
  return { X, y, truth, n, p };
}

/**
 * Bias, variance and total error of ridge across λ, estimated by refitting on
 * many fresh samples from the same truth and looking at what the predictions do
 * at a fixed test point. This is the decomposition drawn rather than asserted.
 */
export function biasVariance({
  lambdas = [0.001, 0.01, 0.03, 0.08, 0.2, 0.5, 1.2, 3, 8], reps = 120, n = 34, p = 24,
} = {}) {
  const base = design({ n: 400, p, seed: 1, noise: 0 });
  const test = base.X.slice(0, 60);
  const truthY = test.map(row => 5 + sum(row.map((v, j) => v * base.truth[j])));
  return lambdas.map((lam, k) => {
    const preds = test.map(() => []);
    for (let rep = 0; rep < reps; rep++) {
      const d = design({ n, p, seed: 5000 + k * 311 + rep });
      const std = standardise(d.X);
      const fit = ridge(std.Z, d.y, lam * n);
      test.forEach((row, i) => {
        const z = row.map((v, j) => (v - std.mu[j]) / std.s[j]);
        preds[i].push(fit.a0 + sum(z.map((v, j) => v * fit.beta[j])));
      });
    }
    const bias2 = mean(preds.map((ps, i) => (mean(ps) - truthY[i]) ** 2));
    const varc = mean(preds.map(ps => mean(ps.map(v => (v - mean(ps)) ** 2))));
    return { lam, bias2, variance: varc, total: bias2 + varc };
  });
}

/** what OLS does when you keep adding columns to a fixed number of rows */
export function overfitCurve({ n = 30, maxP = 26, reps = 40 } = {}) {
  const out = [];
  for (let p = 1; p <= maxP; p++) {
    const tr = [], te = [];
    for (let rep = 0; rep < reps; rep++) {
      const d = design({ n: n * 2, p, seed: 900 + p * 53 + rep, noise: 1.6 });
      const Xtr = d.X.slice(0, n), ytr = d.y.slice(0, n);
      const Xte = d.X.slice(n), yte = d.y.slice(n);
      const std = standardise(Xtr);
      const fit = ridge(std.Z, ytr, 1e-8);        // effectively OLS, but stable
      const pred = row => {
        const z = row.map((v, j) => (v - std.mu[j]) / std.s[j]);
        return fit.a0 + sum(z.map((v, j) => v * fit.beta[j]));
      };
      tr.push(mean(Xtr.map((r, i) => (ytr[i] - pred(r)) ** 2)));
      te.push(mean(Xte.map((r, i) => (yte[i] - pred(r)) ** 2)));
    }
    out.push({ p, train: mean(tr), test: mean(te) });
  }
  return out;
}
