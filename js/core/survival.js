/* ─────────────────────────────────────────────────────────────────────────────
   survival.js — the machinery for "how long until", when some of the answers
   are still missing.

   The whole subject exists because of one awkward fact: when the study stops,
   some people have not had the event yet. You know their time is *at least*
   what you observed, and nothing more. Throw them away and you bias the answer
   downwards; count them as events and you bias it downwards harder. Every
   method here is a way of using "at least this long" honestly.
   ───────────────────────────────────────────────────────────────────────────── */

import { mean, sum, rng, randExp, normCdf, chi2P } from './stats.js';

/**
 * Kaplan–Meier, computed the way it is defined: walk the distinct event times
 * in order and multiply the conditional chances of getting through each one.
 *
 * rows: [{ t, event }]  event = 1 if the thing happened, 0 if we simply
 * stopped watching (censored).
 *
 * Returns one row per *event* time — censoring never produces a drop, it only
 * quietly shrinks the risk set for later times.
 */
export function kaplanMeier(rows) {
  const sorted = rows.slice().sort((a, b) => a.t - b.t || b.event - a.event);
  const times = [...new Set(sorted.filter(r => r.event).map(r => r.t))].sort((a, b) => a - b);
  const steps = [];
  let s = 1, gw = 0;                       // survival, and Greenwood's running sum
  for (const t of times) {
    const n = sorted.filter(r => r.t >= t).length;              // still at risk
    const d = sorted.filter(r => r.t === t && r.event).length;  // events right now
    const c = sorted.filter(r => r.t === t && !r.event).length; // censored right now
    s *= 1 - d / n;
    if (n > d) gw += d / (n * (n - d));
    const se = s * Math.sqrt(gw);
    steps.push({
      t, n, d, c, q: d / n, p: 1 - d / n, s, se,
      lo: Math.max(0, s - 1.96 * se), hi: Math.min(1, s + 1.96 * se),
    });
  }
  return steps;
}

/** the censoring times, so a drawing can mark them on the curve */
export const censorMarks = (rows, km) => rows.filter(r => !r.event).map(r => ({
  t: r.t, s: survivalAt(km, r.t),
}));

/** read the step function at any time */
export function survivalAt(km, t) {
  let s = 1;
  for (const k of km) { if (k.t > t) break; s = k.s; }
  return s;
}

/** the first time the curve is at or below 0.5 — undefined if it never gets there */
export function medianSurvival(km) {
  const hit = km.find(k => k.s <= 0.5);
  return hit ? hit.t : null;
}

/**
 * The two wrong answers, computed so the lesson can show how wrong they are.
 *   drop     — average only the people who had the event
 *   asEvent  — pretend everyone's last observed time was the event
 *   truth    — the average of the real (partly unobserved) times
 */
export function naiveMeans(rows) {
  const seen = rows.filter(r => r.event).map(r => r.t);
  const all = rows.map(r => r.t);
  return {
    drop: mean(seen), dropMed: med(seen),
    asEvent: mean(all), asEventMed: med(all),
    truth: rows[0].trueT != null ? mean(rows.map(r => r.trueT)) : null,
    truthMed: rows[0].trueT != null ? med(rows.map(r => r.trueT)) : null,
    dropped: rows.filter(r => !r.event).length,
  };
}
const med = a => {
  if (!a.length) return NaN;
  const s = a.slice().sort((x, y) => x - y), h = s.length / 2;
  return s.length % 2 ? s[Math.floor(h)] : (s[h - 1] + s[h]) / 2;
};

/**
 * Log-rank test. At every event time, ask how many of that instant's events
 * *should* have come from group 1 if the groups were interchangeable — the
 * hypergeometric expectation — and accumulate the gap.
 */
export function logRank(a, b) {
  const all = [...a.map(r => ({ ...r, g: 0 })), ...b.map(r => ({ ...r, g: 1 }))];
  const times = [...new Set(all.filter(r => r.event).map(r => r.t))].sort((x, y) => x - y);
  const table = [];
  let O = 0, E = 0, V = 0;
  for (const t of times) {
    const n1 = all.filter(r => r.g === 1 && r.t >= t).length;
    const n0 = all.filter(r => r.g === 0 && r.t >= t).length;
    const n = n1 + n0;
    const d1 = all.filter(r => r.g === 1 && r.t === t && r.event).length;
    const d = all.filter(r => r.t === t && r.event).length;
    if (n < 2 || d === 0) continue;
    const e1 = (d * n1) / n;
    const v1 = n > 1 ? (d * (n1 / n) * (1 - n1 / n) * (n - d)) / (n - 1) : 0;
    O += d1; E += e1; V += v1;
    table.push({ t, n, n1, n0, d, d1, e1, v1 });
  }
  const chi2 = V > 0 ? ((O - E) ** 2) / V : 0;
  return { O, E, V, chi2, df: 1, p: chi2P(chi2, 1), table, hr: E > 0 ? (O / E) : NaN };
}

/**
 * Cox proportional hazards by Newton–Raphson on the partial likelihood
 * (Breslow's handling of ties).
 *
 * The trick worth staring at: at each event time the likelihood asks only
 * "given that *someone* in the risk set failed here, what is the chance it was
 * this one?" — and the baseline hazard, whatever shape it has, cancels out of
 * that ratio entirely. You never estimate it. That is the whole reason the
 * model is semi-parametric.
 */
export function coxPH(rows, { iters = 40, tol = 1e-9 } = {}) {
  const p = rows[0].x.length;
  let beta = new Array(p).fill(0);
  let ll = 0;
  const times = [...new Set(rows.filter(r => r.event).map(r => r.t))].sort((a, b) => a - b);

  let I = null;
  for (let it = 0; it < iters; it++) {
    const u = new Array(p).fill(0);
    I = Array.from({ length: p }, () => new Array(p).fill(0));
    ll = 0;
    for (const t of times) {
      const risk = rows.filter(r => r.t >= t);
      const evs = rows.filter(r => r.t === t && r.event);
      const w = risk.map(r => Math.exp(sum(r.x.map((v, j) => v * beta[j]))));
      const s0 = sum(w);
      const s1 = new Array(p).fill(0);
      const s2 = Array.from({ length: p }, () => new Array(p).fill(0));
      risk.forEach((r, i) => {
        for (let j = 0; j < p; j++) {
          s1[j] += w[i] * r.x[j];
          for (let k = 0; k < p; k++) s2[j][k] += w[i] * r.x[j] * r.x[k];
        }
      });
      const d = evs.length;
      for (const e of evs) {
        ll += sum(e.x.map((v, j) => v * beta[j]));
        for (let j = 0; j < p; j++) u[j] += e.x[j];
      }
      ll -= d * Math.log(s0);
      for (let j = 0; j < p; j++) {
        u[j] -= (d * s1[j]) / s0;
        for (let k = 0; k < p; k++) I[j][k] += d * (s2[j][k] / s0 - (s1[j] * s1[k]) / (s0 * s0));
      }
    }
    const step = solveSym(I, u);
    if (!step) break;
    beta = beta.map((v, j) => v + step[j]);
    if (Math.max(...step.map(Math.abs)) < tol) break;
  }

  const cov = invSym(I);
  const se = beta.map((_, j) => Math.sqrt(Math.max(0, cov ? cov[j][j] : NaN)));
  return {
    beta, se, ll,
    hr: beta.map(Math.exp),
    lo: beta.map((b, j) => Math.exp(b - 1.96 * se[j])),
    hi: beta.map((b, j) => Math.exp(b + 1.96 * se[j])),
    z: beta.map((b, j) => b / se[j]),
    p: beta.map((b, j) => 2 * (1 - normCdf(Math.abs(b / se[j])))),
  };
}

/* small dense solvers — the design matrices here are 1–3 columns wide */
function solveSym(A, b) {
  const n = A.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < n; i++) {
    let piv = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[piv][i])) piv = k;
    if (Math.abs(M[piv][i]) < 1e-12) return null;
    [M[i], M[piv]] = [M[piv], M[i]];
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const f = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j];
    }
  }
  return M.map((r, i) => r[n] / M[i][i]);
}

function invSym(A) {
  if (!A) return null;
  const n = A.length;
  const out = [];
  for (let c = 0; c < n; c++) {
    const e = new Array(n).fill(0); e[c] = 1;
    const col = solveSym(A, e);
    if (!col) return null;
    out.push(col);
  }
  // solveSym gives columns; transpose back into rows
  return out[0].map((_, i) => out.map(col => col[i]));
}

/**
 * A cohort where we know the truth. Times come from an exponential with a
 * given rate; a separate exponential decides when we stop watching. Anyone
 * still going at `end` is censored there too — that is administrative
 * censoring, the honest kind that arrives simply because the study finished.
 */
export function cohort({
  n = 60, rate = 0.06, censorRate = 0.02, end = 60, hr = 1, seed = 7, group = 0,
} = {}) {
  const r = rng(seed);
  const rows = [];
  for (let i = 0; i < n; i++) {
    const trueT = randExp(r, rate * hr);
    const cT = Math.min(randExp(r, censorRate), end);
    const event = trueT <= cT ? 1 : 0;
    rows.push({
      id: i, group, trueT,
      t: +(Math.min(trueT, cT)).toFixed(2),
      event, x: [group],
    });
  }
  return rows;
}

/**
 * How badly do the two wrong answers miss, on average, as censoring gets
 * heavier? Run the whole thing many times so the lesson can plot it rather
 * than claim it.
 */
export function biasCurve({ rates = [0, 0.01, 0.02, 0.04, 0.08, 0.16], reps = 80, n = 80, rate = 0.06 } = {}) {
  return rates.map((cr, k) => {
    const drop = [], asEv = [], km = [], frac = [];
    let refused = 0;
    for (let i = 0; i < reps; i++) {
      const rows = cohort({ n, rate, censorRate: cr, seed: 1000 + k * 97 + i, end: 80 });
      const nv = naiveMeans(rows);
      // like for like: three estimates of the same quantity, the median time
      drop.push(nv.dropMed);
      asEv.push(nv.asEventMed);
      const m = medianSurvival(kaplanMeier(rows));
      if (m == null) refused++; else km.push(m);
      frac.push(nv.dropped / n);
    }
    return {
      censorRate: cr,
      censored: mean(frac),
      drop: mean(drop.filter(Number.isFinite)),
      asEvent: mean(asEv),
      km: km.length ? mean(km) : NaN,
      // the honest failure mode: with almost everyone censored the curve never
      // reaches a half, and the method declines to answer rather than guessing
      refused: refused / reps,
      truth: Math.LN2 / rate,
    };
  });
}
