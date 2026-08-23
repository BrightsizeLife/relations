/* ─────────────────────────────────────────────────────────────────────────────
   factor.js — the linear algebra behind common factor analysis.

   A symmetric eigensolver (Jacobi rotations, which is slow and completely
   transparent), principal-axis factoring with iterated communalities, and
   varimax rotation. Everything runs on a 6×6 or 8×8 correlation matrix, so
   "slow" is measured in microseconds.
   ───────────────────────────────────────────────────────────────────────────── */

import { rng, randNorm, mean, sum } from './stats.js';

/**
 * Eigen-decomposition of a real symmetric matrix by cyclic Jacobi rotation:
 * repeatedly find the largest off-diagonal entry and rotate it to zero. It
 * always converges for symmetric input and needs no pivoting or balancing.
 *
 * Returns eigenvalues descending, with matching eigenvectors as columns.
 */
export function jacobiEigen(Ain, { iters = 100, tol = 1e-11 } = {}) {
  const n = Ain.length;
  const A = Ain.map(r => r.slice());
  let V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

  for (let sweep = 0; sweep < iters; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
    if (off < tol) break;

    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-14) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p], akq = A[k][q];
          A[k][p] = c * akp - s * akq;
          A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k], aqk = A[q][k];
          A[p][k] = c * apk - s * aqk;
          A[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p], vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq;
          V[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }

  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => A[b][b] - A[a][a]);
  return {
    values: order.map(i => A[i][i]),
    vectors: order.map(i => V.map(row => row[i])),   // vectors[k] is the k-th eigenvector
  };
}

/**
 * Principal-axis factoring. Put communality estimates on the diagonal of the
 * correlation matrix instead of ones, take the leading eigenvectors, and
 * repeat until the communalities stop moving.
 *
 * The difference from PCA is exactly that diagonal: PCA leaves the ones in
 * place and so explains every item's variance including its own noise, while
 * this explains only the part items have in common.
 */
export function faPrincipal(R, m = 1, { iters = 40 } = {}) {
  const n = R.length;
  /* first guess: squared multiple correlation is standard; the largest
     absolute off-diagonal is simpler and lands in the same place */
  let h2 = R.map((row, i) => Math.max(...row.map((v, j) => (i === j ? 0 : Math.abs(v)))));

  let L = null, ev = null;
  for (let it = 0; it < iters; it++) {
    const Rr = R.map((row, i) => row.map((v, j) => (i === j ? h2[i] : v)));
    const e = jacobiEigen(Rr);
    ev = e.values;
    L = Array.from({ length: n }, (_, i) =>
      Array.from({ length: m }, (_, k) => e.vectors[k][i] * Math.sqrt(Math.max(e.values[k], 0))));
    const next = L.map(row => sum(row.map(v => v * v)));
    const moved = Math.max(...next.map((v, i) => Math.abs(v - h2[i])));
    h2 = next.map(v => Math.min(v, 0.998));
    if (moved < 1e-8) break;
  }

  /* sign convention: make each factor's loadings mostly positive, otherwise
     the same solution flips arbitrarily between runs */
  for (let k = 0; k < m; k++) {
    if (sum(L.map(r => r[k])) < 0) L.forEach(r => { r[k] = -r[k]; });
  }

  return {
    loadings: L,
    communality: L.map(r => sum(r.map(v => v * v))),
    uniqueness: L.map(r => 1 - sum(r.map(v => v * v))),
    eigen: jacobiEigen(R).values,      // of the *unaltered* matrix, for the scree plot
    reduced: ev,
  };
}

/** the correlation matrix a set of loadings implies: R̂ = ΛΛ′, with ones down the diagonal */
export function reproduce(L) {
  const n = L.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : sum(L[i].map((v, k) => v * L[j][k])))));
}

/** what the model failed to explain, entry by entry */
export const residualMatrix = (R, L) => {
  const H = reproduce(L);
  return R.map((row, i) => row.map((v, j) => (i === j ? 0 : v - H[i][j])));
};

/**
 * Varimax: rotate the factor axes to make each loading as close to 0 or ±1 as
 * possible. The fit is identical before and after — rotation is a change of
 * description, not of model, which is the single most misunderstood point in
 * the whole method.
 */
export function varimax(L, { iters = 60, eps = 1e-9 } = {}) {
  const n = L.length, m = L[0].length;
  if (m < 2) return L.map(r => r.slice());
  let A = L.map(r => r.slice());
  let last = 0;

  for (let it = 0; it < iters; it++) {
    for (let p = 0; p < m - 1; p++) {
      for (let q = p + 1; q < m; q++) {
        let sx = 0, sy = 0, sxy = 0, sx2y2 = 0;
        for (let i = 0; i < n; i++) {
          const u = A[i][p] * A[i][p] - A[i][q] * A[i][q];
          const v = 2 * A[i][p] * A[i][q];
          sx += u; sy += v; sxy += u * v; sx2y2 += u * u - v * v;
        }
        const num = 2 * (n * sxy - sx * sy);
        const den = n * sx2y2 - (sx * sx - sy * sy);
        if (Math.abs(num) < 1e-14 && Math.abs(den) < 1e-14) continue;
        const phi = Math.atan2(num, den) / 4;
        const c = Math.cos(phi), s = Math.sin(phi);
        for (let i = 0; i < n; i++) {
          const a = A[i][p], b = A[i][q];
          A[i][p] = c * a + s * b;
          A[i][q] = -s * a + c * b;
        }
      }
    }
    const crit = varimaxCriterion(A);
    if (Math.abs(crit - last) < eps) break;
    last = crit;
  }
  for (let k = 0; k < m; k++) if (sum(A.map(r => r[k])) < 0) A.forEach(r => { r[k] = -r[k]; });
  return A;
}

function varimaxCriterion(A) {
  const n = A.length;
  return sum(A[0].map((_, k) => {
    const c = A.map(r => r[k] * r[k]);
    return sum(c.map(v => v * v)) - (sum(c) ** 2) / n;
  }));
}

/**
 * Parallel analysis: how large would an eigenvalue be if the items were pure
 * noise? Anything below that line is not evidence of a factor. Slower and far
 * more honest than "eigenvalue greater than one".
 */
export function parallelEigen(nItems, nObs, { reps = 40, seed = 17 } = {}) {
  const r = rng(seed);
  const acc = new Array(nItems).fill(0);
  for (let rep = 0; rep < reps; rep++) {
    const cols = Array.from({ length: nItems }, () =>
      Array.from({ length: nObs }, () => randNorm(r, 0, 1)));
    const R = corrOf(cols);
    jacobiEigen(R).values.forEach((v, i) => { acc[i] += v; });
  }
  return acc.map(v => v / reps);
}

/** correlation matrix of an array of columns */
export function corrOf(cols) {
  const z = cols.map(c => {
    const m = mean(c);
    const sd = Math.sqrt(sum(c.map(v => (v - m) ** 2)) / (c.length - 1)) || 1;
    return c.map(v => (v - m) / sd);
  });
  const n = z[0].length;
  return z.map(a => z.map(b => sum(a.map((v, i) => v * b[i])) / (n - 1)));
}

/**
 * Simulate items generated by a known factor structure, so the lesson can
 * compare what factor analysis recovers with the truth that produced it.
 * `spec` is one row of loadings per item.
 */
export function simulateItems(spec, { n = 250, seed = 9 } = {}) {
  const r = rng(seed);
  const m = spec[0].length;
  const F = Array.from({ length: m }, () => Array.from({ length: n }, () => randNorm(r, 0, 1)));
  return spec.map(row => {
    const u = Math.sqrt(Math.max(0, 1 - sum(row.map(v => v * v))));
    return Array.from({ length: n }, (_, i) =>
      sum(row.map((v, k) => v * F[k][i])) + u * randNorm(r, 0, 1));
  });
}
