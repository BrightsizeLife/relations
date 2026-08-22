/* ─────────────────────────────────────────────────────────────────────────────
   causal.js — the estimands, and how you actually compute each one.
   Simulated on purpose: the only way to check a causal estimator is against a
   world where you know both potential outcomes, which never happens in real data.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, strip, arrowDefs } from '../core/plot.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sub, sup, hat, bar, paren, eq, minus, op } from '../core/fx.js';

const F = () => frame({ w: 720, h: 540, l: 66, r: 28, t: 34, b: 58 });

/**
 * One simulated trial. X is baseline severity. Sicker patients are more likely
 * to be treated (confounding) AND do worse regardless (so the naive comparison
 * is biased downward). The treatment effect itself grows with severity, so ATT
 * and ATU genuinely differ — which is the whole point of the estimand step.
 */
function world(s) {
  const r = st.rng(2718);
  const n = 300;
  const conf = +s.conf / 100;          // how strongly X drives assignment
  const het = +s.het / 100;            // how much the effect varies with X
  const rows = [];
  for (let i = 0; i < n; i++) {
    const x = r() * 10;                             // baseline severity 0–10
    const y0 = 20 - 1.4 * x + st.randNorm(r, 0, 1.6);  // outcome if untreated
    const tau = 3 + het * 1.0 * (x - 5);               // effect at this severity
    const y1 = y0 + tau;
    const eta = conf * 0.85 * (x - 5);                 // log-odds of treatment
    const ps = 1 / (1 + Math.exp(-eta));
    const tr = r() < (s.design === 'rct' ? 0.5 : ps) ? 1 : 0;
    rows.push({ x, y0, y1, tau, tr, ps: s.design === 'rct' ? 0.5 : ps, y: tr ? y1 : y0 });
  }
  return rows;
}

const est = s => {
  const R = world(s);
  const T = R.filter(r => r.tr === 1), C = R.filter(r => r.tr === 0);
  const ATE = st.mean(R.map(r => r.tau));
  const ATT = T.length ? st.mean(T.map(r => r.tau)) : NaN;
  const ATU = C.length ? st.mean(C.map(r => r.tau)) : NaN;
  const naive = st.mean(T.map(r => r.y)) - st.mean(C.map(r => r.y));

  // regression adjustment / g-computation: fit E[Y | T, X], predict both arms
  const X = R.map(r => [r.tr, r.x, r.tr * (r.x - 5)]);
  const m = st.mlr(X, R.map(r => r.y));
  const gcomp = m ? st.mean(R.map(r => {
    const p1 = m.beta[0] + m.beta[1] * 1 + m.beta[2] * r.x + m.beta[3] * (r.x - 5);
    const p0 = m.beta[0] + m.beta[2] * r.x;
    return p1 - p0;
  })) : NaN;

  // inverse probability weighting, using the true propensity (we simulated it)
  const wSum1 = st.sum(T.map(r => 1 / r.ps)), wSum0 = st.sum(C.map(r => 1 / (1 - r.ps)));
  const ipw = st.sum(T.map(r => r.y / r.ps)) / wSum1 - st.sum(C.map(r => r.y / (1 - r.ps))) / wSum0;

  // 1-nearest-neighbour matching on X, ATT flavour
  const matched = T.map(tr_ => {
    let best = null;
    for (const c of C) {
      const d = Math.abs(c.x - tr_.x);
      if (!best || d < best.d) best = { d, c };
    }
    return best ? tr_.y - best.c.y : NaN;
  }).filter(isFinite);
  const match = matched.length ? st.mean(matched) : NaN;

  return { R, T, C, ATE, ATT, ATU, naive, gcomp, ipw, match, m };
};

const METHODS = {
  naive: { label: 'naive difference', get: e => e.naive, target: 'nothing — it is biased', tone: 'warm' },
  gcomp: { label: 'regression / g-computation', get: e => e.gcomp, target: 'ATE', tone: 'green' },
  ipw: { label: 'inverse probability weighting', get: e => e.ipw, target: 'ATE', tone: 'cyan' },
  match: { label: 'nearest-neighbour matching', get: e => e.match, target: 'ATT', tone: 'purple' },
};

export default {
  meta: {
    id: 'causal', title: 'causal estimands', kicker: 'WHICH EFFECT ARE YOU ASKING FOR?',
    status: 'live',
    deck: 'Before you can estimate a causal effect you have to say <em>whose</em> effect. The average across everyone, the average among the treated, and the effect for one particular person are three different numbers, and they are answered by three different calculations. Most confusion about causal inference is really confusion about which one was wanted.',
    dataNote: 'Data: a <em>simulated</em> trial, 300 patients, generated in your browser. Simulation is not a convenience here — it is the only way to see a causal estimator work, because it requires knowing both potential outcomes for every person, which no real dataset contains. The true effect is set by you, so every estimate on the page can be checked against it.',
    deps: ['multiple', 'logistic'], unlocks: [],
    next: 'stan', nextLabel: 'rstanarm & brms',
    outro: 'name the estimand first. the estimator is the easy part.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { conf: 100, het: 100, design: 'observational', method: 'gcomp', who: 'all', patient: 0 },

  steps: [
    {
      title: 'the effect on one person is unobservable',
      prose: `<p>For each patient there are two numbers: what happens if they get the treatment, and what happens if they don't. Those are the <strong>potential outcomes</strong> Y(1) and Y(0), and the causal effect for that person is the difference.</p>
        <p>The problem is that you only ever get to see one of them. The other is a counterfactual — a fact about a world that did not happen.</p>
        <p>This simulation knows both, because it made them up. <strong>Step through the patients</strong> and watch one of the two dots go dark: that is the one reality withholds.</p>`,
      formula: formula(
        t('τ', { tone: 'gold' }) + sub('', 'i') + eq +
        t('Y', { tone: 'warm' }) + sub('', 'i') + '(1)' + minus + t('Y', { tone: 'cold' }) + sub('', 'i') + '(0)' +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('you observe exactly one term', { cls: 'fx-muted' }),
        { caption: 'the fundamental problem of causal inference' }),
      readouts: [
        { key: 'i', label: 'patient', tone: 'gold', get: s => +s.patient + 1, d: 0 },
        { key: 'y1', label: 'Y(1)', tone: 'warm', get: s => world(s)[+s.patient].y1, d: 2, wide: true },
        { key: 'y0', label: 'Y(0)', tone: 'cold', get: s => world(s)[+s.patient].y0, d: 2, wide: true },
        { key: 'tau', label: 'their effect', tone: 'green', get: s => world(s)[+s.patient].tau, d: 2, wide: true },
        { key: 'seen', label: 'what you actually see', wide: true, get: s => {
          const r = world(s)[+s.patient];
          return r.tr ? `Y(1) = ${r.y1.toFixed(2)}` : `Y(0) = ${r.y0.toFixed(2)}`;
        } },
      ],
      controls: [
        { type: 'slider', key: 'patient', label: 'patient', min: 0, max: 19, step: 1, fast: true },
      ],
      beats: [
        {
          label: 'both worlds',
          note: 'Every patient has a warm dot and a cold dot. The gap between them is their personal treatment effect.',
          scene: s => {
            const R = world(s).slice(0, 20);
            const f = F();
            f.setX(-0.5, 19.5);
            f.setY(Math.min(...R.map(r => r.y0)) - 1, Math.max(...R.map(r => r.y1)) + 1);
            return [
              ...axes(f, { xLabel: 'patient', yLabel: 'outcome', xN: 5 }),
              ...R.map((r, i) => path(`ln-${i}`, [[f.sx(i), f.sy(r.y0)], [f.sx(i), f.sy(r.y1)]], {
                cls: 'stick stick-y', delay: i * 40, opacity: 0.6,
              })),
              ...R.map((r, i) => ({
                key: `y1-${i}`, tag: 'circle', cls: 'pt pt-warm', delay: i * 40,
                attrs: { cx: f.sx(i), cy: f.sy(r.y1), r: 5 },
                tip: `patient ${i + 1}<br>if treated: <b>${r.y1.toFixed(2)}</b>`,
              })),
              ...R.map((r, i) => ({
                key: `y0-${i}`, tag: 'circle', cls: 'pt pt-cold', delay: i * 40,
                attrs: { cx: f.sx(i), cy: f.sy(r.y0), r: 5 },
                tip: `patient ${i + 1}<br>if untreated: <b>${r.y0.toFixed(2)}</b>`,
              })),
              label('l', f.midX, f.y1 + 6, 'both potential outcomes — a view no study ever has', { cls: 'lab lab-mid lab-gold' }),
            ];
          },
        },
        {
          label: 'what reality shows you',
          hold: 1800,
          note: 'Half the dots vanish. <b>Every causal method is a strategy for reconstructing the missing half</b>, and they differ only in what they assume to do it.',
          scene: s => {
            const R = world(s).slice(0, 20);
            const f = F();
            f.setX(-0.5, 19.5);
            f.setY(Math.min(...R.map(r => r.y0)) - 1, Math.max(...R.map(r => r.y1)) + 1);
            const sel = +s.patient;
            return [
              ...axes(f, { xLabel: 'patient', yLabel: 'outcome', xN: 5 }),
              ...R.map((r, i) => ({
                key: `y1-${i}`, tag: 'circle', dur: 240,
                cls: r.tr ? 'pt pt-warm' : 'pt-ghost',
                attrs: { cx: f.sx(i), cy: f.sy(r.y1), r: 5 },
                opacity: r.tr ? 1 : 0.25,
                tip: r.tr ? `observed: <b>${r.y1.toFixed(2)}</b>` : 'never observed',
              })),
              ...R.map((r, i) => ({
                key: `y0-${i}`, tag: 'circle', dur: 240,
                cls: r.tr ? 'pt-ghost' : 'pt pt-cold',
                attrs: { cx: f.sx(i), cy: f.sy(r.y0), r: 5 },
                opacity: r.tr ? 0.25 : 1,
                tip: r.tr ? 'never observed' : `observed: <b>${r.y0.toFixed(2)}</b>`,
              })),
              vLine(f, sel, { key: 'sel', cls: 'rule-gold rule-dash', dur: 200 }),
              label('l', f.midX, f.y1 + 6, 'solid = observed · hollow = the counterfactual', { cls: 'lab lab-mid' }),
            ];
          },
        },
      ],
    },

    {
      title: 'four different averages',
      prose: `<p>Individual effects are hopeless, so we average. But <em>over whom?</em></p>
        <p><strong>ATE</strong> — average over everybody. The answer to "should this be policy for the whole population?"<br>
        <strong>ATT</strong> — average over those who actually got treated. "Did the programme help the people it enrolled?"<br>
        <strong>ATU</strong> — average over the untreated. "Would it help the people we haven't reached?"<br>
        <strong>CATE</strong> — average within a subgroup. "Does it help severe cases more than mild ones?"</p>
        <p>These coincide only when the effect is the same for everyone. <strong>Turn up the heterogeneity</strong> and watch them separate.</p>`,
      formula: formula(
        t('ATE', { tone: 'gold' }) + eq + 'E' + brk('τ') +
        op('&nbsp;&nbsp;') + t('ATT', { tone: 'warm' }) + eq + 'E' + brk('τ | T=1') +
        op('&nbsp;&nbsp;') + t('ATU', { tone: 'cold' }) + eq + 'E' + brk('τ | T=0') +
        op('&nbsp;&nbsp;') + t('CATE', { tone: 'green' }) + eq + 'E' + brk('τ | X=x'),
        { size: 'sm', caption: 'same τ, four different populations to average it over' }),
      readouts: [
        { key: 'ate', label: 'true ATE', tone: 'gold', get: s => est(s).ATE, d: 3, wide: true },
        { key: 'att', label: 'true ATT', tone: 'warm', get: s => est(s).ATT, d: 3, wide: true },
        { key: 'atu', label: 'true ATU', tone: 'cold', get: s => est(s).ATU, d: 3, wide: true },
        { key: 'gap', label: 'ATT − ATU', tone: 'green', get: s => est(s).ATT - est(s).ATU, d: 3, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'het', label: 'effect heterogeneity', min: 0, max: 200, step: 5, fast: true, fmt: v => (+v / 100).toFixed(2) + '×' },
        { type: 'slider', key: 'conf', label: 'confounding strength', min: 0, max: 200, step: 5, fast: true, fmt: v => (+v / 100).toFixed(2) + '×' },
        { type: 'segment', key: 'design', label: 'design', options: [{ value: 'observational', label: 'observational' }, { value: 'rct', label: 'randomised' }] },
      ],
      beats: [
        {
          label: 'the effect varies with severity',
          note: 'The line is the CATE — the effect at each level of severity. The three averages are just three different ways of weighting it.',
          scene: s => {
            const e = est(s);
            const f = F();
            f.setX(0, 10);
            const taus = e.R.map(r => r.tau);
            f.setY(Math.min(...taus) - 0.6, Math.max(...taus) + 0.6);
            return [
              ...axes(f, { xLabel: 'baseline severity X', yLabel: 'treatment effect τ(X)' }),
              ...e.R.map((r, i) => ({
                key: `p-${i}`, tag: 'circle', cls: r.tr ? 'pt pt-warm' : 'pt pt-cold', dur: 240,
                attrs: { cx: f.sx(r.x), cy: f.sy(r.tau), r: 3.4 }, opacity: 0.75,
                tip: `severity ${r.x.toFixed(1)}<br>effect <b>${r.tau.toFixed(2)}</b><br>${r.tr ? 'treated' : 'untreated'}`,
              })),
              hLine(f, e.ATE, { key: 'ate', cls: 'rule-gold', dur: 240 }),
              hLine(f, e.ATT, { key: 'att', cls: 'rule-x', dur: 240 }),
              hLine(f, e.ATU, { key: 'atu', cls: 'rule-y', dur: 240 }),
              label('lat', f.x1 - 6, f.sy(e.ATE) - 8, `ATE = ${e.ATE.toFixed(2)}`, { cls: 'lab lab-end lab-gold', dur: 240 }),
              label('ltt', f.x0 + 8, f.sy(e.ATT) - 8, `ATT = ${e.ATT.toFixed(2)}`, { cls: 'lab lab-warm', dur: 240 }),
              label('ltu', f.x0 + 8, f.sy(e.ATU) + 16, `ATU = ${e.ATU.toFixed(2)}`, { cls: 'lab lab-cold', dur: 240 }),
              label('n', f.midX, f.y1 + 6,
                Math.abs(e.ATT - e.ATU) < 0.15 ? 'the effect is constant — all three coincide'
                  : 'the treated are not like the untreated, so ATT ≠ ATU',
                { cls: 'lab lab-mid', dur: 240 }),
            ];
          },
        },
      ],
    },

    {
      title: 'why the naive comparison is wrong',
      prose: `<p>Compare the average outcome among the treated with the average among the untreated. In this simulation, sicker patients are both <em>more likely to be treated</em> and <em>worse off regardless</em>. So the treated group is stacked with people who were going to do badly anyway.</p>
        <p>The naive difference is therefore not the effect. It is the effect <strong>plus a selection term</strong>: how different the two groups would have been even if nobody had been treated.</p>
        <p><strong>Drag the confounding strength to zero</strong>, or switch to a randomised design, and watch the bias disappear.</p>`,
      formula: formula(
        t('naive', { tone: 'warm' }) + eq +
        t('ATT', { tone: 'green', explain: 'The causal part — what you wanted.' }) + ' + ' +
        t('E[Y(0) | T=1] − E[Y(0) | T=0]', { tone: 'cold', explain: 'The selection bias: how the two groups differ in the untreated world. Randomisation forces this term to zero.' }),
        { size: 'sm', caption: 'the second term is what randomisation is for' }),
      aside: `<b>What randomisation actually does.</b> It does not make the treatment work better, and it does not make the estimate more precise. It makes the second term zero <i>by construction</i>, so the difference you can measure equals the effect you want. Everything else on this page is an attempt to fake that property with statistics.`,
      readouts: [
        { key: 'naive', label: 'naive difference', tone: 'warm', get: s => est(s).naive, d: 3, wide: true },
        { key: 'ate', label: 'true ATE', tone: 'gold', get: s => est(s).ATE, d: 3, wide: true },
        { key: 'bias', label: 'bias', tone: 'cold', get: s => est(s).naive - est(s).ATE, d: 3, wide: true },
        { key: 'imb', label: 'severity imbalance', tone: 'purple', wide: true, get: s => {
          const e = est(s);
          return st.mean(e.T.map(r => r.x)) - st.mean(e.C.map(r => r.x));
        }, d: 2 },
      ],
      controls: [
        { type: 'slider', key: 'conf', label: 'confounding strength', min: 0, max: 200, step: 5, fast: true, fmt: v => (+v / 100).toFixed(2) + '×' },
        { type: 'segment', key: 'design', label: 'design', options: [{ value: 'observational', label: 'observational' }, { value: 'rct', label: 'randomised' }] },
      ],
      beats: [
        {
          label: 'the groups are not comparable',
          note: 'The two severity distributions do not line up. Any difference in outcomes is partly just that mismatch.',
          scene: s => {
            const e = est(s);
            const f = F();
            f.setX(0, 10);
            const bins = 16;
            const hT = st.histogram(e.T.map(r => r.x), bins, [0, 10]);
            const hC = st.histogram(e.C.map(r => r.x), bins, [0, 10]);
            const mx = Math.max(...hT.map(b => b.n), ...hC.map(b => b.n));
            f.setY(-mx * 1.15, mx * 1.15);
            const w = (f.x1 - f.x0) / bins;
            return [
              ...axes(f, { xLabel: 'baseline severity X', yLabel: 'patients', yN: 4, yFmt: v => String(Math.abs(v)) }),
              hLine(f, 0, { key: 'z', cls: 'ax-line' }),
              ...hT.map((b, i) => rect(`t-${i}`, f.sx(b.x0) + 1, f.sy(b.n), w - 2, f.sy(0) - f.sy(b.n), { cls: 'bar bar-warm', dur: 240 })),
              ...hC.map((b, i) => rect(`c-${i}`, f.sx(b.x0) + 1, f.sy(0), w - 2, f.sy(-b.n) - f.sy(0), { cls: 'bar bar-cold', dur: 240 })),
              label('lt', f.x0 + 8, f.y1 + 14, `treated · mean severity ${st.mean(e.T.map(r => r.x)).toFixed(2)}`, { cls: 'lab lab-warm', dur: 240 }),
              label('lc', f.x0 + 8, f.y0 - 10, `untreated · mean severity ${st.mean(e.C.map(r => r.x)).toFixed(2)}`, { cls: 'lab lab-cold', dur: 240 }),
              label('v', f.midX, f.y1 + 34,
                s.design === 'rct' || +s.conf < 6 ? 'balanced — the groups are comparable'
                  : 'imbalanced — the treated are sicker to begin with',
                { cls: `lab-big lab-mid ${s.design === 'rct' || +s.conf < 6 ? 'lab-green' : 'lab-warm'}`, dur: 240 }),
            ];
          },
        },
        {
          label: 'the bias, sized',
          note: 'Naive against truth. The gap is entirely selection — nothing to do with the treatment.',
          scene: s => {
            const e = est(s);
            const f = F();
            const lo = Math.min(0, e.naive, e.ATE) - 1, hi = Math.max(e.naive, e.ATE) + 1;
            f.setX(lo, hi); f.setY(0, 1);
            const row = (key, v, y, cls, name) => [
              { key: key + 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: y, x2: f.x1, y2: y } },
              rect(key + 'b', f.sx(Math.min(0, v)), y - 16, Math.abs(f.sx(v) - f.sx(0)), 32, { cls, dur: 240 }),
              { key: key + 'p', tag: 'circle', cls: 'pt pt-green', dur: 240, attrs: { cx: f.sx(v), cy: y, r: 8 } },
              label(key + 'n', f.x0, y - 30, name, { cls: 'lab' }),
              numLabel(key + 'v', f.sx(v), y + 32, v, { cls: 'lab-big lab-mid', d: 2, dur: 240 }),
            ];
            return [
              ...axes(f, { xLabel: 'estimated effect', showY: false, grid: false, xN: 5 }),
              vLine(f, 0, { key: 'z', cls: 'rule-faint rule-dash' }),
              ...row('n', e.naive, 180, 'sq sq-neg', 'what you would report'),
              ...row('a', e.ATE, 330, 'sq sq-pos', 'the true ATE'),
              { key: 'bias', tag: 'line', cls: 'rule-gold', dur: 240, attrs: { x1: f.sx(e.ATE), y1: 400, x2: f.sx(e.naive), y2: 400 } },
              numLabel('bl', (f.sx(e.ATE) + f.sx(e.naive)) / 2, 424, e.naive - e.ATE, {
                cls: 'lab-big lab-mid lab-gold', d: 2, pre: 'bias = ', dur: 240,
              }),
            ];
          },
        },
      ],
    },

    {
      title: 'four ways to fix it',
      prose: `<p>All of these assume the same thing — that severity is the <em>only</em> confounder, and that you measured it. Given that, they are four routes to the same place.</p>
        <p><strong>Regression / g-computation.</strong> Model the outcome given treatment and severity. Then predict every patient twice, once as treated and once as untreated, and average the difference. You are filling in the missing potential outcomes with the model.</p>
        <p><strong>Inverse probability weighting.</strong> Model the <em>treatment</em> instead. Patients who were unlikely to get what they got are rare and informative, so upweight them until the two groups look alike.</p>
        <p><strong>Matching.</strong> For each treated patient, find an untreated one with similar severity and compare them directly. Simple, transparent, and naturally targets ATT.</p>
        <p><strong>Randomisation.</strong> Not an estimator — a design. It makes the naive difference correct in the first place.</p>`,
      formula: formula(
        t('g-computation', { tone: 'green' }) + ': ' + frac('1', 'n') + 'Σ' + brk(hat('E') + '[Y|T=1,X] − ' + hat('E') + '[Y|T=0,X]') +
        `<br>` +
        t('IPW', { tone: 'cyan' }) + ': ' + frac('1', 'n') + 'Σ' + brk(frac(t('T', { tone: 'warm' }) + 'Y', 'e(X)') + minus + frac('(1−T)Y', '1 − e(X)')),
        { size: 'sm', caption: 'model the outcome, or model the treatment — either will do' }),
      readouts: [
        { key: 'true', label: 'true ATE', tone: 'gold', get: s => est(s).ATE, d: 3, wide: true },
        { key: 'naive', label: 'naive', tone: 'warm', get: s => est(s).naive, d: 3, wide: true },
        { key: 'g', label: 'g-computation', tone: 'green', get: s => est(s).gcomp, d: 3, wide: true },
        { key: 'ipw', label: 'IPW', tone: 'cyan', get: s => est(s).ipw, d: 3, wide: true },
        { key: 'm', label: 'matching (→ ATT)', tone: 'purple', get: s => est(s).match, d: 3, wide: true },
        { key: 'att', label: 'true ATT', tone: 'muted', get: s => est(s).ATT, d: 3, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'conf', label: 'confounding strength', min: 0, max: 200, step: 5, fast: true, fmt: v => (+v / 100).toFixed(2) + '×' },
        { type: 'slider', key: 'het', label: 'effect heterogeneity', min: 0, max: 200, step: 5, fast: true, fmt: v => (+v / 100).toFixed(2) + '×' },
        { type: 'segment', key: 'design', label: 'design', options: [{ value: 'observational', label: 'observational' }, { value: 'rct', label: 'randomised' }] },
      ],
      beats: [
        {
          label: 'every estimator against the truth',
          note: 'Gold lines are the truths. Note that matching lands on <b>ATT</b>, not ATE — it is answering a different question, correctly.',
          scene: s => {
            const e = est(s);
            const rows = [
              ['naive difference', e.naive, 'warm'],
              ['g-computation', e.gcomp, 'green'],
              ['IPW', e.ipw, 'cyan'],
              ['matching', e.match, 'purple'],
            ];
            const f = F();
            const all = [e.ATE, e.ATT, ...rows.map(r => r[1])].filter(isFinite);
            f.setX(Math.min(...all) - 1.2, Math.max(...all) + 1.2);
            f.setY(0, 1);
            const items = [
              ...axes(f, { xLabel: 'estimated effect', showY: false, grid: false, xN: 5 }),
              vLine(f, e.ATE, { key: 'ate', cls: 'rule-gold', dur: 240 }),
              vLine(f, e.ATT, { key: 'att', cls: 'rule-gold rule-dash', dur: 240 }),
              label('lat', f.sx(e.ATE), 92, 'true ATE', { cls: 'lab-sm lab-mid lab-gold', dur: 240 }),
              label('ltt', f.sx(e.ATT), 74, 'true ATT', { cls: 'lab-sm lab-mid lab-gold', dur: 240 }),
            ];
            rows.forEach(([name, v, tone], i) => {
              const y = 150 + i * 84;
              items.push({ key: `ax-${i}`, tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: y, x2: f.x1, y2: y } });
              items.push(rect(`e-${i}`, f.sx(Math.min(v, e.ATE)), y - 9, Math.abs(f.sx(v) - f.sx(e.ATE)), 18, {
                cls: Math.abs(v - e.ATE) < 0.25 ? 'sq sq-pos' : 'sq sq-neg', dur: 240, opacity: 0.6,
              }));
              items.push({ key: `p-${i}`, tag: 'circle', cls: `pt pt-${tone}`, dur: 240, attrs: { cx: f.sx(v), cy: y, r: 8 } });
              items.push(label(`n-${i}`, f.x0, y - 20, name, { cls: `lab lab-${tone}` }));
              items.push(numLabel(`v-${i}`, f.sx(v), y + 26, v, { cls: 'lab lab-mid', d: 3, dur: 240 }));
            });
            return items;
          },
        },
        {
          label: 'g-computation, drawn',
          hold: 1800,
          note: 'Fit one curve per arm. Then predict <b>every</b> patient on both curves — including the arm they were never in — and average the vertical gaps.',
          scene: s => {
            const e = est(s);
            const f = F();
            f.setX(0, 10);
            f.setY(Math.min(...e.R.map(r => r.y)) - 1.5, Math.max(...e.R.map(r => r.y)) + 3);
            const m = e.m;
            const p1 = x => m.beta[0] + m.beta[1] + m.beta[2] * x + m.beta[3] * (x - 5);
            const p0 = x => m.beta[0] + m.beta[2] * x;
            return [
              ...axes(f, { xLabel: 'baseline severity X', yLabel: 'outcome Y' }),
              ...e.R.map((r, i) => ({
                key: `p-${i}`, tag: 'circle', cls: r.tr ? 'pt pt-warm' : 'pt pt-cold', dur: 240,
                attrs: { cx: f.sx(r.x), cy: f.sy(r.y), r: 3.2 }, opacity: 0.55,
              })),
              fnPath(f, p1, { key: 'c1', cls: 'curve curve-warm', n: 80, dur: 240 }),
              fnPath(f, p0, { key: 'c0', cls: 'curve curve-cold', n: 80, dur: 240 }),
              ...[1.5, 3.5, 5.5, 7.5, 9].map((x, i) => [
                path(`g-${i}`, [[f.sx(x), f.sy(p0(x))], [f.sx(x), f.sy(p1(x))]], { cls: 'stick stick-y', dur: 240 }),
                label(`gl-${i}`, f.sx(x) + 8, (f.sy(p0(x)) + f.sy(p1(x))) / 2, (p1(x) - p0(x)).toFixed(2), { cls: 'lab-sm lab-green', dur: 240 }),
              ]),
              label('l1', f.x1 - 6, f.sy(p1(9.6)) - 10, 'predicted if treated', { cls: 'lab-sm lab-end lab-warm' }),
              label('l0', f.x1 - 6, f.sy(p0(9.6)) + 18, 'predicted if untreated', { cls: 'lab-sm lab-end lab-cold' }),
              numLabel('ate', f.midX, f.y1 + 6, e.gcomp, {
                cls: 'lab-big lab-mid lab-green', d: 3, pre: 'average gap = ', dur: 240,
              }),
            ];
          },
        },
        {
          label: 'IPW, drawn',
          note: 'Dot size is the weight. Patients who got the treatment their severity made unlikely are rare, so they stand in for everyone like them.',
          scene: s => {
            const e = est(s);
            const f = F();
            f.setX(0, 10);
            f.setY(Math.min(...e.R.map(r => r.y)) - 1.5, Math.max(...e.R.map(r => r.y)) + 1.5);
            return [
              ...axes(f, { xLabel: 'baseline severity X', yLabel: 'outcome Y' }),
              ...e.R.map((r, i) => {
                const w = r.tr ? 1 / r.ps : 1 / (1 - r.ps);
                return {
                  key: `p-${i}`, tag: 'circle', cls: r.tr ? 'pt pt-warm' : 'pt pt-cold', dur: 240,
                  attrs: { cx: f.sx(r.x), cy: f.sy(r.y), r: clamp(1.6 + w * 1.1, 2, 13) }, opacity: 0.55,
                  tip: `severity ${r.x.toFixed(1)}<br>P(treated) = <b>${r.ps.toFixed(2)}</b><br>weight <b>${w.toFixed(2)}</b>`,
                };
              }),
              numLabel('ipw', f.midX, f.y1 + 6, e.ipw, { cls: 'lab-big lab-mid lab-cyan', d: 3, pre: 'weighted difference = ', dur: 240 }),
              label('n', f.midX, f.y1 + 28, 'big dots are doing the work of the people who look like them', { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
      ],
    },

    {
      title: 'what all of this rests on',
      prose: `<p>Every estimator above produced roughly the right answer, and every one of them would have produced a confidently wrong answer if a single assumption failed. Three assumptions, and only the third is checkable.</p>
        <p><strong>No unmeasured confounding.</strong> You measured everything that drives both treatment and outcome. This is untestable — it is a claim about variables you don't have. It is where nearly every observational study actually fails.</p>
        <p><strong>No interference.</strong> One person's treatment doesn't change another person's outcome. Fails immediately for vaccines, schooling, anything with a network.</p>
        <p><strong>Positivity / overlap.</strong> Everyone had some chance of either arm. This one you <em>can</em> check — and should, because if some severity range contains only treated patients, no method can tell you what would have happened to them otherwise. It will silently extrapolate instead.</p>`,
      aside: `<b>Sensitivity analysis is the honest response.</b> Since you cannot test the first assumption, ask how badly it would have to fail to overturn your answer. If a modest unmeasured confounder would erase the effect, say so. That is a much more useful sentence than a p-value.`,
      readouts: [
        { key: 'minps', label: 'lowest P(treated)', tone: 'cold', get: s => Math.min(...world(s).map(r => r.ps)), d: 3, wide: true },
        { key: 'maxps', label: 'highest P(treated)', tone: 'warm', get: s => Math.max(...world(s).map(r => r.ps)), d: 3, wide: true },
        { key: 'wmax', label: 'largest weight', tone: 'gold', wide: true, get: s => {
          const e = est(s);
          return Math.max(...e.R.map(r => (r.tr ? 1 / r.ps : 1 / (1 - r.ps))));
        }, d: 1 },
        { key: 'ok', label: 'overlap', wide: true, get: s => {
          const ps = world(s).map(r => r.ps);
          return Math.min(...ps) > 0.08 && Math.max(...ps) < 0.92 ? 'acceptable' : 'POOR — some patients are near-deterministic';
        } },
      ],
      controls: [
        { type: 'slider', key: 'conf', label: 'confounding strength', min: 0, max: 400, step: 10, fast: true, fmt: v => (+v / 100).toFixed(2) + '×' },
      ],
      beats: [
        {
          label: 'the overlap check',
          note: 'Push the confounding up and the two propensity distributions separate. Where they stop overlapping, your estimate is pure extrapolation.',
          scene: s => {
            const e = est(s);
            const f = F();
            f.setX(0, 1);
            const bins = 20;
            const hT = st.histogram(e.T.map(r => r.ps), bins, [0, 1]);
            const hC = st.histogram(e.C.map(r => r.ps), bins, [0, 1]);
            const mx = Math.max(...hT.map(b => b.n), ...hC.map(b => b.n), 1);
            f.setY(-mx * 1.15, mx * 1.15);
            const w = (f.x1 - f.x0) / bins;
            const lo = Math.min(...e.R.map(r => r.ps)), hi = Math.max(...e.R.map(r => r.ps));
            return [
              ...axes(f, { xLabel: 'propensity score — P(treated | severity)', yLabel: 'patients', yN: 4, yFmt: v => String(Math.abs(v)) }),
              ...(lo > 0.02 ? [rect('bad1', f.x0, f.y1, f.sx(lo) - f.x0, f.y0 - f.y1, { cls: 'sq sq-neg', opacity: 0.3, dur: 240 })] : []),
              ...(hi < 0.98 ? [rect('bad2', f.sx(hi), f.y1, f.x1 - f.sx(hi), f.y0 - f.y1, { cls: 'sq sq-neg', opacity: 0.3, dur: 240 })] : []),
              hLine(f, 0, { key: 'z', cls: 'ax-line' }),
              ...hT.map((b, i) => rect(`t-${i}`, f.sx(b.x0) + 1, f.sy(b.n), w - 2, f.sy(0) - f.sy(b.n), { cls: 'bar bar-warm', dur: 240 })),
              ...hC.map((b, i) => rect(`c-${i}`, f.sx(b.x0) + 1, f.sy(0), w - 2, f.sy(-b.n) - f.sy(0), { cls: 'bar bar-cold', dur: 240 })),
              label('lt', f.x0 + 8, f.y1 + 14, 'treated', { cls: 'lab lab-warm' }),
              label('lc', f.x0 + 8, f.y0 - 10, 'untreated', { cls: 'lab lab-cold' }),
              label('v', f.midX, f.y1 + 34,
                lo > 0.08 && hi < 0.92 ? 'the two distributions overlap — comparisons are supported by data'
                  : 'the tails have no counterparts — anything you say about them is the model talking',
                { cls: `lab lab-mid ${lo > 0.08 && hi < 0.92 ? 'lab-green' : 'lab-warm'}`, dur: 240 }),
            ];
          },
        },
      ],
    },
  ],
};

function brk(x) { return `<span class="fx-paren">[</span>${x}<span class="fx-paren">]</span>`; }
