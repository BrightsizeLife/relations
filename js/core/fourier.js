/* ─────────────────────────────────────────────────────────────────────────────
   fourier.js — decomposing a repeating thing into circles.

   A naive discrete Fourier transform, written the obvious way: for every
   candidate frequency, multiply the signal by a cosine and by a sine of that
   frequency and add up. Nothing here is clever and nothing here is fast, which
   is the point — every number a lesson draws can be traced back to a product
   and a sum.
   ───────────────────────────────────────────────────────────────────────────── */

import { sum, mean } from './stats.js';

export const TAU = Math.PI * 2;

/**
 * How much of frequency k is in the signal?
 *
 * Project the signal onto cos and sin at that frequency. The two projections
 * are the legs of a right triangle; the hypotenuse is the amplitude and the
 * angle is the phase. That geometry is the whole transform.
 */
export function component(y, k) {
  const n = y.length;
  const a = (2 / n) * sum(y.map((v, t) => v * Math.cos((TAU * k * t) / n)));
  const b = (2 / n) * sum(y.map((v, t) => v * Math.sin((TAU * k * t) / n)));
  return {
    k, a, b,
    amp: Math.hypot(a, b),
    phase: Math.atan2(-b, a),
    /** the wave this component contributes, evaluated at any t */
    at: t => a * Math.cos((TAU * k * t) / n) + b * Math.sin((TAU * k * t) / n),
  };
}

/** every frequency up to the Nyquist limit, plus the mean */
export function spectrum(y, { maxK } = {}) {
  const n = y.length;
  const top = Math.min(maxK ?? Math.floor(n / 2), Math.floor(n / 2));
  const dc = mean(y);
  const comps = [];
  for (let k = 1; k <= top; k++) comps.push(component(y, k));
  return { dc, comps, n, nyquist: Math.floor(n / 2) };
}

/** rebuild the signal from the mean plus the first m components */
export function rebuild(spec, m, n = spec.n) {
  const use = spec.comps.slice(0, m);
  return Array.from({ length: n }, (_, t) => spec.dc + sum(use.map(c => c.at(t))));
}

/** rebuild using the m largest components rather than the m lowest */
export function rebuildBiggest(spec, m, n = spec.n) {
  const order = spec.comps.map((c, i) => i).sort((a, b) => spec.comps[b].amp - spec.comps[a].amp).slice(0, m);
  return Array.from({ length: n }, (_, t) => spec.dc + sum(order.map(i => spec.comps[i].at(t))));
}

/* ── the classic waveforms, for the "any shape is a sum of sines" step ────── */

export const WAVES = {
  square: { label: 'square', f: x => (Math.sin(x) >= 0 ? 1 : -1) },
  saw: { label: 'sawtooth', f: x => 2 * (((x / TAU) % 1) - 0.5) },
  triangle: { label: 'triangle', f: x => (2 / Math.PI) * Math.asin(Math.sin(x)) },
  pulse: { label: 'pulse', f: x => (((x / TAU) % 1) < 0.15 ? 1 : -0.18) },
};

/** sample one of them n times over exactly one period */
export const sampleWave = (name, n = 128) =>
  Array.from({ length: n }, (_, t) => WAVES[name].f((TAU * t) / n));

/* ── seasonality, for the regression connection ───────────────────────────── */

/**
 * Fourier terms as regression columns. Two columns per harmonic — a sine and a
 * cosine — which between them can produce a wave of any amplitude and any
 * phase at that frequency without anyone having to estimate a phase.
 */
export function fourierTerms(t, period, harmonics) {
  const out = [];
  for (let h = 1; h <= harmonics; h++) {
    out.push(Math.sin((TAU * h * t) / period), Math.cos((TAU * h * t) / period));
  }
  return out;
}
