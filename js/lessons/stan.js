/* ─────────────────────────────────────────────────────────────────────────────
   stan.js — rstanarm and brms, from the outside in. Which arguments actually
   change something, and what each diagnostic is trying to tell you.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, fnArea, histBars, arrowDefs } from '../core/plot.js';
import { knobCards, diagRows } from '../core/knobs.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sub, sup, hat, paren, eq, minus, op } from '../core/fx.js';

const F = () => frame({ w: 720, h: 540, l: 66, r: 28, t: 34, b: 58 });

/* the same twelve Old Faithful eruptions as the regression lesson */
const FAITHFUL = [
  [3.600, 79], [1.800, 54], [3.333, 74], [2.283, 62], [4.533, 85], [2.883, 55],
  [4.700, 88], [3.600, 85], [1.950, 51], [4.350, 85], [1.833, 54], [3.917, 84],
];
const XS = FAITHFUL.map(p => p[0] - 3.2), YS = FAITHFUL.map(p => p[1]);
const OLS = st.linreg(XS, YS);

/** log posterior for y = a + b·x + normal(0, σ), with normal priors */
const makeLogPost = priorScale => ([a, b, ls]) => {
  const sig = Math.exp(ls);
  if (!isFinite(sig) || sig <= 0 || sig > 200) return -Infinity;
  let ll = 0;
  for (let i = 0; i < XS.length; i++) {
    const r = YS[i] - (a + b * XS[i]);
    ll += -0.5 * (r / sig) ** 2 - Math.log(sig);
  }
  // priors: intercept wide, slope normal(0, priorScale), sigma half-normal-ish
  ll += -0.5 * ((a - 70) / 40) ** 2;
  ll += -0.5 * (b / priorScale) ** 2;
  ll += -0.5 * (sig / 25) ** 2 + ls;   // + ls is the Jacobian for sampling log σ
  return ll;
};

/* ── the sampler ──────────────────────────────────────────────────────────── */

const runCache = new Map();
function run(s) {
  const key = `${s.chains}|${s.iter}|${s.step}|${s.prior}|${s.model}`;
  if (runCache.has(key)) return runCache.get(key);

  const lp = makeLogPost(+s.prior);
  const chains = [];
  const starts = [[70, 5, Math.log(4)], [40, -8, Math.log(20)], [95, 14, Math.log(1.2)], [60, 0, Math.log(9)]];
  let divergences = 0;

  for (let c = 0; c < +s.chains; c++) {
    const r = st.rng(11 + c * 97);
    let cur = [...starts[c % starts.length]];
    let curLP = lp(cur);
    const draws = [];
    let acc = 0;
    for (let i = 0; i < +s.iter; i++) {
      // scale the proposal per parameter so the three are comparable
      const prop = [
        cur[0] + st.randNorm(r, 0, +s.step * 6),
        cur[1] + st.randNorm(r, 0, +s.step * 3),
        cur[2] + st.randNorm(r, 0, +s.step * 0.45),
      ];
      const pLP = lp(prop);
      // the analogue of a divergent transition: the geometry changed so fast
      // across one step that the proposal is nonsense
      if (isFinite(pLP) && curLP - pLP > 140) divergences++;
      if (Math.log(Math.max(r(), 1e-300)) < pLP - curLP) { cur = prop; curLP = pLP; acc++; }
      draws.push([...cur]);
    }
    chains.push({ draws, acc: acc / +s.iter });
  }

  const out = { chains, divergences, lp };
  runCache.set(key, out);
  return out;
}

const PARAMS = [
  { key: 0, name: 'Intercept', tone: 'cyan', truth: () => OLS.b0 },
  { key: 1, name: 'slope', tone: 'warm', truth: () => OLS.b1 },
  { key: 2, name: 'sigma', tone: 'green', truth: () => OLS.rmse, xform: v => Math.exp(v) },
];

function post(s, p) {
  const R = run(s);
  const w = Math.min(+s.warmup, +s.iter - 10);
  const xf = PARAMS[p].xform || (v => v);
  return R.chains.map(c => c.draws.slice(w).map(d => xf(d[p])));
}
const pooled = (s, p) => post(s, p).flat();

function diagnostics(s) {
  const R = run(s);
  const w = Math.min(+s.warmup, +s.iter - 10);
  return PARAMS.map((P, p) => {
    const chains = post(s, p);
    const flat = chains.flat();
    return {
      name: P.name, tone: P.tone,
      mean: st.mean(flat), sd: st.sd(flat),
      lo: st.quantile(flat, 0.05), hi: st.quantile(flat, 0.95),
      rhat: st.rhat(chains),
      ess: st.sum(chains.map(c => st.essOf(c))),
      essTail: st.sum(chains.map(c => st.essOf(c.map(v => Math.abs(v - st.mean(c)))))),
    };
  }).concat([]).map(d => ({ ...d, divergences: R.divergences, accept: st.mean(R.chains.map(c => c.acc)) }));
}

export default {
  meta: {
    id: 'stan', title: 'rstanarm & brms', kicker: 'THE ARGUMENTS AND THE WARNINGS',
    status: 'live',
    deck: 'You wrote <code>stan_glm(y ~ x)</code> and it printed a wall of numbers and possibly a warning in red. This lesson is about which arguments actually change the answer, and what each diagnostic is measuring — so that the warnings become information rather than noise to be suppressed.',
    dataNote: 'Model: the Old Faithful regression from earlier, refitted by sampling instead of least squares, so you can compare the posterior against a maximum-likelihood answer you already know. <strong>The sampler here is random-walk Metropolis, not Stan\'s HMC</strong> — it is the honest simple version. R-hat, effective sample size and the trace plots mean exactly the same thing either way; the divergence indicator is an illustration of the same failure, not the identical check Stan runs.',
    deps: ['bayes', 'mcmc', 'linreg'], unlocks: [],
    next: 'index', nextLabel: 'the index',
    outro: 'the warnings are the model telling you it did not finish the job. read them.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: {
    chains: 4, iter: 1000, warmup: 300, step: 0.35, prior: 20, model: 'simple',
    param: 1, showPrior: true, ppc: 0,
  },

  steps: [
    {
      title: 'the same model, sampled instead of solved',
      prose: `<p>The model is identical to the regression from earlier: a line through the geyser data, with normally distributed errors. What changes is what you get back.</p>
        <p><code>lm()</code> returns one number per parameter, with a standard error bolted on afterwards. <code>stan_glm()</code> returns <strong>thousands of plausible parameter values</strong> — a cloud of lines, each one a version of the model the data does not rule out.</p>
        <p>Everything else in this lesson is about how that cloud gets generated and how you check whether the generating went wrong.</p>`,
      formula: formula(
        'stan_glm(wait ~ length, family = gaussian(), data = faithful)' +
        `<br>` +
        t('→ 4 chains × (iter − warmup) draws from the posterior', { cls: 'fx-muted' }),
        { size: 'sm', caption: 'not an estimate — a sample from a distribution over estimates' }),
      readouts: [
        { key: 'ols', label: 'lm() slope', tone: 'muted', get: () => OLS.b1, d: 3, wide: true },
        { key: 'bayes', label: 'posterior mean', tone: 'warm', get: s => st.mean(pooled(s, 1)), d: 3, wide: true },
        { key: 'sd', label: 'posterior sd', tone: 'gold', get: s => st.sd(pooled(s, 1)), d: 3, wide: true },
        { key: 'se', label: 'lm() std error', tone: 'muted', get: () => OLS.seB1, d: 3, wide: true },
      ],
      beats: [
        {
          label: 'a cloud of lines',
          note: 'Each faint line is one posterior draw — one entirely plausible version of the relationship. The spread <b>is</b> the uncertainty; nothing had to be added afterwards.',
          scene: s => {
            const f = F();
            f.setX(Math.min(...XS) - 0.3, Math.max(...XS) + 0.3);
            f.setY(Math.min(...YS) - 6, Math.max(...YS) + 6);
            const R = run(s);
            const w = Math.min(+s.warmup, +s.iter - 10);
            const draws = R.chains.flatMap(c => c.draws.slice(w));
            const show = range(90).map(i => draws[Math.floor((i * draws.length) / 90)]).filter(Boolean);
            return [
              ...axes(f, { xLabel: 'eruption length (centred)', yLabel: 'wait until next — min' }),
              ...show.map((d, i) => path(`ln-${i}`, [
                [f.sx(f.dx[0]), f.sy(d[0] + d[1] * f.dx[0])],
                [f.sx(f.dx[1]), f.sy(d[0] + d[1] * f.dx[1])],
              ], { cls: 'curve-ghost', dur: 240, opacity: 0.22 })),
              path('ols', [
                [f.sx(f.dx[0]), f.sy(OLS.b0 + OLS.b1 * f.dx[0])],
                [f.sx(f.dx[1]), f.sy(OLS.b0 + OLS.b1 * f.dx[1])],
              ], { cls: 'curve curve-fit' }),
              ...points(f, FAITHFUL, { key: 'p', r: 6, x: (p, i) => XS[i], y: p => p[1], cls: 'pt' }),
              label('l', f.x0 + 10, f.y1 + 8, `${show.length} of ${draws.length} posterior draws shown`, { cls: 'lab lab-gold', dur: 240 }),
              label('l2', f.x1 - 8, f.y1 + 8, 'green: the least-squares line', { cls: 'lab-sm lab-end lab-green' }),
            ];
          },
        },
      ],
    },

    {
      title: 'prior: the argument everyone worries about',
      prose: `<p>rstanarm puts weakly informative priors on everything by default, and brms will tell you what it picked if you ask with <code>get_prior()</code>. The question is what those defaults are doing to your answer.</p>
        <p>With twelve data points and a wide prior, essentially nothing: the likelihood dominates and the posterior sits on the least-squares answer. <strong>Tighten the prior toward zero</strong> and watch the posterior get dragged — that pull is called shrinkage, and it is a feature, not a bug, as long as you meant it.</p>
        <p>The rule to internalise: a prior is only a problem if you cannot say out loud what it claims. "The slope is probably between −40 and +40 minutes per minute" is a defensible sentence. "I used the default" is not, if the default happens to be doing the work.</p>`,
      formula: formula(
        'prior = normal(0, ' + t('scale', { tone: 'gold' }) + ')' +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') +
        'posterior ∝ likelihood × prior' +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') +
        t('with enough data the prior stops mattering', { cls: 'fx-muted' }),
        { size: 'sm', caption: 'the same multiplication as the Bayes lesson, one parameter at a time' }),
      dep: { note: 'This is prior × likelihood, drawn for a regression coefficient.', lesson: 'bayes', label: 'bayesian basics' },
      readouts: [
        { key: 'pr', label: 'prior scale', tone: 'gold', get: s => +s.prior, d: 1, wide: true },
        { key: 'post', label: 'posterior mean', tone: 'warm', get: s => st.mean(pooled(s, 1)), d: 3, wide: true },
        { key: 'ols', label: 'least squares says', tone: 'muted', get: () => OLS.b1, d: 3, wide: true },
        { key: 'shr', label: 'shrunk by', tone: 'cold', get: s => (1 - st.mean(pooled(s, 1)) / OLS.b1) * 100, d: 1, suf: '%', wide: true },
      ],
      controls: [
        { type: 'slider', key: 'prior', label: 'prior scale on the slope', min: 0.4, max: 40, step: 0.2, fast: true, fmt: v => (+v).toFixed(1) },
        { type: 'toggle', key: 'showPrior', label: 'show the prior' },
      ],
      beats: [
        {
          label: 'prior, likelihood, posterior',
          note: 'A wide prior is nearly flat where the data lives, so it changes nothing. A tight one fights the likelihood and the posterior lands between them.',
          scene: s => {
            const draws = pooled(s, 1);
            const f = F();
            f.setX(-6, 26);
            const bins = st.histogram(draws, 40, [-6, 26]);
            const priorPdf = x => st.normPdf(x, 0, +s.prior);
            const peak = Math.max(...bins.map(b => b.density));
            f.setY(0, peak * 1.25);
            return [
              ...axes(f, { xLabel: 'slope — minutes of waiting per minute of eruption', yLabel: 'density', yN: 4 }),
              ...(s.showPrior ? [
                fnPath(f, x => priorPdf(x) * (peak / Math.max(priorPdf(0), 1e-9)) * 0.85, {
                  key: 'pri', cls: 'curve curve-cyan curve-dash', n: 200, dur: 240,
                }),
                label('pl', f.x0 + 10, f.y1 + 26, `prior: normal(0, ${(+s.prior).toFixed(1)})`, { cls: 'lab lab-cyan', dur: 240 }),
              ] : []),
              ...histBars(f, bins, { key: 'h', cls: 'bar bar-warm', useDensity: true, dur: 240 }),
              vLine(f, OLS.b1, { key: 'ols', cls: 'rule-gold rule-dash' }),
              label('ol', f.sx(OLS.b1), f.y1 + 8, `least squares: ${OLS.b1.toFixed(2)}`, { cls: 'lab-sm lab-mid lab-gold' }),
              vLine(f, st.mean(draws), { key: 'pm', cls: 'rule-gold', dur: 240 }),
              numLabel('pv', f.sx(st.mean(draws)), f.y0 - 12, st.mean(draws), {
                cls: 'lab-big lab-mid lab-warm', d: 2, pre: 'posterior mean ', dur: 240,
              }),
            ];
          },
        },
      ],
    },

    {
      title: 'chains, iter, warmup',
      prose: `<p>Three arguments, one job: make sure you have enough independent draws from the right distribution.</p>
        <p><strong>warmup</strong> — the opening stretch, thrown away. The chain starts somewhere arbitrary and needs time to find the posterior; those early draws are not from it. In Stan warmup also tunes the step size, which is why it cannot simply be set to zero.</p>
        <p><strong>iter</strong> — total iterations, warmup included. So <code>iter=2000, warmup=1000</code> keeps a thousand.</p>
        <p><strong>chains</strong> — independent runs from different starting points. Their whole purpose is to disagree if something is wrong, which is the next step.</p>
        <p><strong>Set warmup to near zero</strong> and watch the discarded burn-in contaminate the posterior.</p>`,
      readouts: [
        { key: 'ch', label: 'chains', tone: 'cyan', get: s => +s.chains, d: 0 },
        { key: 'it', label: 'iter', tone: 'gold', get: s => +s.iter, d: 0 },
        { key: 'wu', label: 'warmup', tone: 'warm', get: s => +s.warmup, d: 0 },
        { key: 'kept', label: 'draws kept', tone: 'green', get: s => (+s.iter - Math.min(+s.warmup, +s.iter - 10)) * +s.chains, d: 0, wide: true },
      ],
      controls: [
        { type: 'segment', key: 'chains', label: 'chains', options: [{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }] },
        { type: 'slider', key: 'iter', label: 'iter', min: 150, max: 2000, step: 50, fast: true },
        { type: 'slider', key: 'warmup', label: 'warmup', min: 0, max: 900, step: 10, fast: true },
        { type: 'segment', key: 'param', label: 'parameter', options: PARAMS.map((p, i) => ({ value: i, label: p.name })) },
      ],
      beats: [
        {
          label: 'the trace',
          note: 'The shaded region is warmup — discarded. After it, a healthy chain looks like a fuzzy caterpillar with no trend, and the colours should be completely overlapping.',
          scene: s => {
            const R = run(s);
            const p = +s.param;
            const xf = PARAMS[p].xform || (v => v);
            const f = F();
            f.setX(0, +s.iter);
            const all = R.chains.flatMap(c => c.draws.map(d => xf(d[p])));
            const lo = st.quantile(all, 0.005), hi = st.quantile(all, 0.995);
            f.setY(lo, hi);
            const w = Math.min(+s.warmup, +s.iter - 10);
            return [
              ...axes(f, { xLabel: 'iteration', yLabel: PARAMS[p].name, yN: 5 }),
              rect('wu', f.x0, f.y1, f.sx(w) - f.x0, f.y0 - f.y1, { cls: 'sq sq-neg', opacity: 0.3, dur: 240 }),
              label('wl', f.sx(w) - 6, f.y1 + 14, 'warmup, discarded', { cls: 'lab-sm lab-end lab-cold', dur: 240 }),
              ...R.chains.map((c, k) => path(`c-${k}`, c.draws.map((d, i) => [f.sx(i), f.sy(clamp(xf(d[p]), lo, hi))]), {
                cls: `curve ${['curve-cyan', 'curve-warm', 'curve-fit', 'curve-purple'][k % 4]}`,
                dur: 240, opacity: 0.75, set: { 'stroke-width': 1 },
              })),
              hLine(f, PARAMS[p].truth(), { key: 'tr', cls: 'rule-gold rule-dash' }),
              label('l', f.x1 - 8, f.y1 + 8,
                w < 60 ? 'warmup too short — the start is polluting the posterior' : 'the chains have settled',
                { cls: `lab lab-end ${w < 60 ? 'lab-warm' : 'lab-green'}`, dur: 240 }),
            ];
          },
        },
        {
          label: 'what gets kept',
          note: 'The histogram of what survives. With too little warmup you can see the tail of the approach still sitting in it.',
          scene: s => {
            const p = +s.param;
            const draws = pooled(s, p);
            const f = F();
            const lo = st.quantile(draws, 0.002), hi = st.quantile(draws, 0.998);
            f.setX(lo, hi);
            const bins = st.histogram(draws, 40, [lo, hi]);
            f.setY(0, Math.max(...bins.map(b => b.density)) * 1.15);
            return [
              ...axes(f, { xLabel: PARAMS[p].name, yLabel: 'density', yN: 4 }),
              ...histBars(f, bins, { key: 'h', cls: `bar bar-${PARAMS[p].tone === 'cyan' ? 'cold' : PARAMS[p].tone === 'warm' ? 'warm' : 'green'}`, useDensity: true, dur: 240 }),
              vLine(f, PARAMS[p].truth(), { key: 'tr', cls: 'rule-gold rule-dash' }),
              label('tl', f.sx(PARAMS[p].truth()), f.y1 + 8, 'least-squares value', { cls: 'lab-sm lab-mid lab-gold' }),
              numLabel('m', f.midX, f.y1 + 30, st.mean(draws), { cls: 'lab-big lab-mid', d: 3, pre: 'posterior mean = ', dur: 240 }),
            ];
          },
        },
      ],
    },

    {
      title: 'R-hat: did the chains agree?',
      prose: `<p>R-hat compares how much the chains vary <em>between</em> each other with how much each one varies <em>within</em> itself. If they have all found the same distribution, those two numbers should match and the ratio should be 1.</p>
        <p>If one chain is stuck somewhere else, the between-chain variance is inflated and R-hat rises. <strong>Above 1.01, your answer is not trustworthy</strong> — not "slightly noisy", but potentially describing a distribution the sampler never finished exploring.</p>
        <p><strong>Drop the iterations low</strong> and watch it climb. This is also why a single chain is a bad idea: with nothing to compare against, the most common failure becomes invisible.</p>`,
      formula: formula(
        hat('R') + eq + sqrt2(frac(t('between-chain variance', { tone: 'warm' }) + ' + ' + t('within', { tone: 'cyan' }), t('within-chain variance', { tone: 'cyan' }))) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('want < 1.01', { tone: 'green' }),
        { size: 'sm', caption: 'chains that found the same place have nothing extra between them' }),
      readouts: [
        { key: 'r0', label: 'R̂ intercept', tone: 'cyan', get: s => diagnostics(s)[0].rhat, d: 4, wide: true },
        { key: 'r1', label: 'R̂ slope', tone: 'warm', get: s => diagnostics(s)[1].rhat, d: 4, wide: true },
        { key: 'r2', label: 'R̂ sigma', tone: 'green', get: s => diagnostics(s)[2].rhat, d: 4, wide: true },
        { key: 'worst', label: 'verdict', tone: 'gold', wide: true, get: s => {
          const m = Math.max(...diagnostics(s).map(d => d.rhat || 0));
          return m < 1.01 ? 'converged' : m < 1.05 ? 'not converged — run longer' : 'badly unconverged';
        } },
      ],
      controls: [
        { type: 'slider', key: 'iter', label: 'iter', min: 120, max: 2000, step: 20, fast: true },
        { type: 'slider', key: 'warmup', label: 'warmup', min: 0, max: 900, step: 10, fast: true },
        { type: 'segment', key: 'chains', label: 'chains', options: [{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 4, label: '4' }] },
      ],
      beats: [
        {
          label: 'the chains, separately',
          note: 'One histogram per chain. When they lie on top of each other, R-hat is 1. When they do not, it is the only warning you get.',
          scene: s => {
            const p = +s.param;
            const chains = post(s, p);
            const flat = chains.flat();
            const f = F();
            const lo = st.quantile(flat, 0.002), hi = st.quantile(flat, 0.998);
            f.setX(lo, hi);
            const hs = chains.map(c => st.histogram(c, 30, [lo, hi]));
            f.setY(0, Math.max(...hs.flatMap(h => h.map(b => b.density))) * 1.15);
            const d = diagnostics(s)[p];
            return [
              ...axes(f, { xLabel: PARAMS[p].name, yLabel: 'density', yN: 4 }),
              ...hs.flatMap((h, k) => h.map((b, i) => rect(`h-${k}-${i}`, f.sx(b.x0) + 0.5, f.sy(b.density),
                Math.max(0.5, f.sx(b.x1) - f.sx(b.x0) - 1), f.y0 - f.sy(b.density), {
                cls: 'sq', dur: 240, opacity: 0.42,
                set: { fill: ['var(--cs-cyan)', 'var(--cs-data-warm)', 'var(--cs-data-green)', 'var(--cs-purple)'][k % 4], stroke: 'none' },
              }))),
              label('l', f.midX, f.y1 + 8, `R̂ = ${(d.rhat || NaN).toFixed(4)}`, {
                cls: `lab-big lab-mid ${d.rhat < 1.01 ? 'lab-green' : 'lab-warm'}`, dur: 240,
              }),
              label('l2', f.midX, f.y1 + 30,
                d.rhat < 1.01 ? 'the chains agree' : 'the chains disagree — they have not all found the posterior',
                { cls: 'lab lab-mid', dur: 240 }),
            ];
          },
        },
      ],
    },

    {
      title: 'effective sample size: how many draws you really have',
      prose: `<p>MCMC draws are not independent — each one is a small step from the last, so consecutive draws are correlated and carry overlapping information.</p>
        <p>Effective sample size converts your correlated draws into the number of <em>independent</em> ones they are worth. Four thousand draws with heavy autocorrelation might be worth two hundred, and it is the two hundred that governs your Monte Carlo error.</p>
        <p>Stan reports two: <strong>bulk-ESS</strong> for the centre of the distribution, and <strong>tail-ESS</strong> for the extremes. Tail-ESS is usually the smaller one, which matters because it is the tails that your 95% interval endpoints are made of. Aim for at least 400 of each.</p>`,
      formula: formula(
        'ESS ' + eq + frac('N', '1 + 2 Σ ' + t('ρ', { tone: 'warm' }) + sub('', 'k')) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') +
        'Monte Carlo error ' + eq + frac('sd', sqrt2('ESS')),
        { size: 'sm', caption: 'the autocorrelation is the tax you pay for not having independent draws' }),
      readouts: [
        { key: 'n', label: 'draws kept', tone: 'muted', get: s => (+s.iter - Math.min(+s.warmup, +s.iter - 10)) * +s.chains, d: 0, wide: true },
        { key: 'ess', label: 'bulk ESS', tone: 'green', get: s => diagnostics(s)[+s.param].ess, d: 0, wide: true },
        { key: 'et', label: 'tail ESS', tone: 'warm', get: s => diagnostics(s)[+s.param].essTail, d: 0, wide: true },
        { key: 'eff', label: 'efficiency', tone: 'gold', wide: true, get: s => {
          const N = (+s.iter - Math.min(+s.warmup, +s.iter - 10)) * +s.chains;
          return (diagnostics(s)[+s.param].ess / N) * 100;
        }, d: 1, suf: '%' },
        { key: 'mcse', label: 'MC error', tone: 'cold', wide: true, get: s => {
          const d = diagnostics(s)[+s.param];
          return d.sd / Math.sqrt(Math.max(1, d.ess));
        }, d: 4 },
      ],
      controls: [
        { type: 'slider', key: 'step', label: 'step size', min: 0.05, max: 1.6, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'slider', key: 'iter', label: 'iter', min: 200, max: 2000, step: 50, fast: true },
        { type: 'segment', key: 'param', label: 'parameter', options: PARAMS.map((p, i) => ({ value: i, label: p.name })) },
      ],
      beats: [
        {
          label: 'the autocorrelation',
          note: 'How similar a draw is to the one k steps later. The faster this decays to zero, the more independent information each draw carries.',
          scene: s => {
            const p = +s.param;
            const c = post(s, p)[0] || [];
            const m = st.mean(c), v = st.varianceP(c);
            const acf = k => {
              if (k === 0) return 1;
              let a = 0;
              for (let i = 0; i < c.length - k; i++) a += (c[i] - m) * (c[i + k] - m);
              return v > 0 ? a / ((c.length - k) * v) : 0;
            };
            const f = F();
            f.setX(0, 40); f.setY(-0.25, 1.05);
            const d = diagnostics(s)[p];
            return [
              ...axes(f, { xLabel: 'lag', yLabel: 'autocorrelation', yN: 5 }),
              hLine(f, 0, { key: 'z', cls: 'ax-line' }),
              ...range(41).map(k => rect(`b-${k}`, f.sx(k) - 5, f.sy(Math.max(0, acf(k))), 10,
                Math.abs(f.sy(acf(k)) - f.sy(0)), { cls: 'bar bar-warm', dur: 240 })),
              label('l', f.x1 - 8, f.y1 + 8,
                `bulk ESS ${d.ess} of ${(+s.iter - Math.min(+s.warmup, +s.iter - 10)) * +s.chains} draws`,
                { cls: 'lab-big lab-end lab-green', dur: 240 }),
              label('l2', f.x1 - 8, f.y1 + 30,
                acf(10) > 0.5 ? 'slow decay — the chain is shuffling, not exploring' : 'fast decay — draws are nearly independent',
                { cls: `lab lab-end ${acf(10) > 0.5 ? 'lab-warm' : 'lab-green'}`, dur: 240 }),
            ];
          },
        },
      ],
    },

    {
      title: 'divergences, and what adapt_delta really does',
      prose: `<p>The warning people suppress most often. A divergent transition means the sampler tried to move through a region where the posterior's shape changes faster than its step size can follow, and the numerical integration blew up.</p>
        <p>Why it matters: divergences are <strong>not random noise</strong>. They cluster in exactly the part of the parameter space the sampler is failing to explore — usually a narrow neck in a hierarchical model. So the draws you did get are systematically missing a region, and your posterior is biased in a direction you cannot see from the summary table.</p>
        <p>Raising <code>adapt_delta</code> tells Stan to aim for a higher acceptance rate, which forces smaller steps, which usually clears the divergences at the cost of speed. If it does not clear them, the geometry is the problem and the fix is reparameterising the model — the non-centred parameterisation — not turning the dial higher.</p>`,
      aside: `<b>Never just suppress it.</b> "A few divergences are probably fine" is the single most expensive piece of folk wisdom in applied Bayesian work. A handful of divergences in a benign spot may indeed be harmless; a handful clustered in a funnel means the variance parameter is being systematically over-estimated. The summary table looks identical in both cases.`,
      readouts: [
        { key: 'st', label: 'step size', tone: 'gold', get: s => +s.step, d: 2 },
        { key: 'acc', label: 'acceptance rate', tone: 'cyan', get: s => diagnostics(s)[0].accept * 100, d: 1, suf: '%', wide: true },
        { key: 'div', label: 'divergences', tone: 'warm', get: s => run(s).divergences, d: 0, wide: true },
        { key: 'ess', label: 'bulk ESS (slope)', tone: 'green', get: s => diagnostics(s)[1].ess, d: 0, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'step', label: 'step size (↓ = higher adapt_delta)', min: 0.05, max: 2.5, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'slider', key: 'iter', label: 'iter', min: 200, max: 2000, step: 50, fast: true },
      ],
      beats: [
        {
          label: 'the trade-off',
          note: 'Small steps: no divergences, but the chain barely moves and ESS collapses. Big steps: fast mixing until it hits a wall. <b>There is a sweet spot and Stan tunes it during warmup.</b>',
          scene: s => {
            const f = F();
            f.setX(0.05, 2.5); f.setY(0, 1);
            const steps = range(14).map(i => 0.05 + (i * 2.45) / 13);
            const rows = steps.map(sv => {
              const d = diagnostics({ ...s, step: +sv.toFixed(2) });
              const R = run({ ...s, step: +sv.toFixed(2) });
              return { sv, ess: d[1].ess, acc: d[0].accept, div: R.divergences };
            });
            const maxEss = Math.max(...rows.map(r => r.ess), 1);
            const maxDiv = Math.max(...rows.map(r => r.div), 1);
            return [
              ...axes(f, { xLabel: 'step size', yLabel: 'scaled', yN: 5, yFmt: () => '' }),
              path('ess', rows.map(r => [f.sx(r.sv), f.sy(r.ess / maxEss)]), { cls: 'curve curve-fit', dur: 260 }),
              path('acc', rows.map(r => [f.sx(r.sv), f.sy(r.acc)]), { cls: 'curve curve-cyan', dur: 260 }),
              path('div', rows.map(r => [f.sx(r.sv), f.sy(r.div / maxDiv)]), { cls: 'curve curve-warm', dur: 260 }),
              vLine(f, +s.step, { key: 'now', cls: 'rule-gold', dur: 200 }),
              label('l1', f.x1 - 8, f.y1 + 8, 'effective sample size', { cls: 'lab-sm lab-end lab-green' }),
              label('l2', f.x1 - 8, f.y1 + 26, 'acceptance rate', { cls: 'lab-sm lab-end lab-cyan' }),
              label('l3', f.x1 - 8, f.y1 + 44, 'divergences', { cls: 'lab-sm lab-end lab-warm' }),
              label('now', f.sx(+s.step), f.y0 - 12,
                `step ${(+s.step).toFixed(2)} · accept ${(diagnostics(s)[0].accept * 100).toFixed(0)}% · ${run(s).divergences} divergences`,
                { cls: 'lab lab-mid lab-gold', dur: 200 }),
            ];
          },
        },
      ],
    },

    {
      title: 'reading the output',
      prose: `<p>Here is the table <code>print(fit)</code> gives you, computed from the chains you have been driving. Every column is something you have now built.</p>
        <p>Read it in this order, and stop at the first thing that fails: <strong>divergences → R-hat → ESS → then, finally, the estimates.</strong> A beautiful posterior mean from a sampler that did not converge is not a weak result; it is a meaningless one.</p>`,
      formula: formula(
        t('divergences = 0', { tone: 'green' }) + op('&nbsp;→&nbsp;') +
        t('R̂ < 1.01', { tone: 'green' }) + op('&nbsp;→&nbsp;') +
        t('ESS > 400', { tone: 'green' }) + op('&nbsp;→&nbsp;') +
        t('only now read the estimates', { tone: 'gold' }),
        { size: 'sm', caption: 'the order matters — each check is meaningless if the one before it failed' }),
      readouts: [],
      controls: [
        { type: 'slider', key: 'iter', label: 'iter', min: 150, max: 2000, step: 50, fast: true },
        { type: 'slider', key: 'warmup', label: 'warmup', min: 0, max: 900, step: 10, fast: true },
        { type: 'slider', key: 'step', label: 'step size', min: 0.05, max: 2.5, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'segment', key: 'chains', label: 'chains', options: [{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 4, label: '4' }] },
      ],
      beats: [
        {
          label: 'the summary table',
          note: 'Break the sampler with the sliders and watch cells go red before the estimates change much. That is the point of diagnostics.',
          scene: s => {
            const D = diagnostics(s);
            const cols = [70, 220, 320, 420, 520, 630];
            const items = [
              label('t', 360, 66, 'print(fit)', { cls: 'lab-big lab-mid lab-gold' }),
              ...['parameter', 'mean', 'sd', '5%', '95%', 'R̂   ESS'].map((h, i) =>
                label(`h-${i}`, cols[i], 110, h, { cls: 'lab-sm lab-gold' })),
            ];
            D.forEach((d, i) => {
              const y = 150 + i * 56;
              const bad = !(d.rhat < 1.01) || d.ess < 100;
              items.push(rect(`bg-${i}`, 50, y - 22, 620, 46, {
                cls: `sq ${bad ? 'sq-neg' : 'sq-pos'}`, opacity: 0.25, dur: 240, delay: i * 90,
              }));
              items.push(label(`n-${i}`, cols[0], y, d.name, { cls: `lab lab-${d.tone}`, delay: i * 90 }));
              items.push(numLabel(`m-${i}`, cols[1], y, d.mean, { cls: 'lab', d: 2, dur: 240, delay: i * 90 }));
              items.push(numLabel(`s-${i}`, cols[2], y, d.sd, { cls: 'lab', d: 2, dur: 240, delay: i * 90 }));
              items.push(numLabel(`l-${i}`, cols[3], y, d.lo, { cls: 'lab', d: 2, dur: 240, delay: i * 90 }));
              items.push(numLabel(`q-${i}`, cols[4], y, d.hi, { cls: 'lab', d: 2, dur: 240, delay: i * 90 }));
              items.push(label(`d-${i}`, cols[5], y,
                `${(d.rhat || NaN).toFixed(3)}  ${d.ess}`,
                { cls: `lab ${bad ? 'lab-warm' : 'lab-green'}`, delay: i * 90, dur: 240 }));
            });
            const R = run(s);
            items.push(label('div', 360, 350,
              R.divergences === 0 ? 'no divergent transitions' : `${R.divergences} divergent transitions after warmup`,
              { cls: `lab-big lab-mid ${R.divergences === 0 ? 'lab-green' : 'lab-warm'}`, dur: 240 }));
            const worst = Math.max(...D.map(d => d.rhat || 9));
            const minEss = Math.min(...D.map(d => d.ess));
            items.push(label('verdict', 360, 400,
              R.divergences > 0 ? 'stop — fix the geometry before reading anything below'
                : worst >= 1.01 ? 'stop — the chains have not converged'
                  : minEss < 100 ? 'stop — not enough effective draws to trust the tails'
                    : 'all three checks pass — now the estimates mean something',
              { cls: `lab lab-mid ${R.divergences > 0 || worst >= 1.01 || minEss < 100 ? 'lab-warm' : 'lab-green'}`, dur: 240 }));
            return items;
          },
        },
        {
          label: 'the parameter reference',
          note: 'The four arguments worth knowing, and what each failure looks like.',
          scene: s => knobCards([
            {
              name: 'chains', value: s.chains, tone: 'cyan',
              does: 'Independent runs from different starting points. Their only job is to disagree when something has gone wrong — with one chain, R-hat cannot see the most common failure.',
              low: '1 chain: no convergence check at all',
              high: 'more cores used, nothing lost',
            },
            {
              name: 'iter / warmup', value: `${s.iter} / ${s.warmup}`, tone: 'gold',
              does: 'Total iterations and how many of them are discarded. Warmup lets the chain find the posterior and lets Stan tune its step size.',
              low: 'unconverged chains and tiny ESS',
              high: 'just slower — never harmful',
            },
            {
              name: 'adapt_delta', value: (1 - +s.step / 3).toFixed(2), tone: 'warm',
              does: 'Target acceptance rate during warmup. Higher forces smaller steps, which usually clears divergences.',
              low: 'big steps, fast mixing, divergences',
              high: 'safe but slow; will not fix bad geometry',
            },
            {
              name: 'prior', value: `normal(0, ${(+s.prior).toFixed(1)})`, tone: 'green',
              does: 'What you believed before the data. With few observations it does real work, so you should be able to defend it in a sentence.',
              low: 'tight: shrinks estimates toward zero',
              high: 'wide: the likelihood does everything',
            },
          ]),
        },
      ],
    },

    {
      title: 'the check that catches what diagnostics cannot',
      prose: `<p>All the diagnostics so far ask whether the <em>sampler</em> worked. None of them ask whether the <em>model</em> is any good — a perfectly converged fit of a badly wrong model produces flawless R-hats.</p>
        <p>The posterior predictive check does ask. Simulate new datasets from the fitted model, and compare them with the data you actually have. If your real data doesn't look like something the model would produce, the model is wrong, no matter how clean the sampling was.</p>
        <p>In rstanarm that's <code>pp_check(fit)</code>, and it should be the first plot you look at.</p>`,
      readouts: [
        { key: 'sd', label: 'sd of real data', tone: 'gold', get: () => st.sd(YS), d: 2, wide: true },
        { key: 'sim', label: 'sd of a simulated set', tone: 'cyan', get: s => st.sd(ppSim(s, +s.ppc)), d: 2, wide: true },
        { key: 'sig', label: 'posterior sigma', tone: 'green', get: s => st.mean(pooled(s, 2)), d: 2, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'ppc', label: 'simulated dataset #', min: 0, max: 30, step: 1, fast: true },
      ],
      beats: [
        {
          label: 'real against simulated',
          note: 'The gold curve is your data. The faint ones are datasets the fitted model invented. Your data should look like one of the crowd — not like an outlier among them.',
          scene: s => {
            const f = F();
            f.setX(Math.min(...YS) - 18, Math.max(...YS) + 18);
            f.setY(0, 0.055);
            const dens = (vals, x) => st.mean(vals.map(v => st.normPdf(x, v, 6)));
            const items = [
              ...axes(f, { xLabel: 'wait until next eruption — minutes', yLabel: 'density', yN: 4 }),
            ];
            for (let k = 0; k < 24; k++) {
              const sim = ppSim(s, k);
              items.push(fnPath(f, x => dens(sim, x), {
                key: `s-${k}`, cls: 'curve-ghost', n: 90, opacity: 0.32, dur: 240, delay: k * 20,
              }));
            }
            items.push(fnPath(f, x => dens(YS, x), { key: 'real', cls: 'curve', n: 120, dur: 240 }));
            items.push(label('l1', f.x0 + 10, f.y1 + 8, 'your data', { cls: 'lab lab-gold' }));
            items.push(label('l2', f.x0 + 10, f.y1 + 28, 'datasets the model would produce', { cls: 'lab-sm lab-muted' }));
            items.push(label('n', f.midX, f.y0 - 12,
              'the real data is bimodal; the model insists on one hump — a real misfit no R-hat would flag',
              { cls: 'lab lab-mid lab-warm' }));
            return items;
          },
        },
      ],
    },
  ],
};

function ppSim(s, k) {
  const R = run(s);
  const w = Math.min(+s.warmup, +s.iter - 10);
  const draws = R.chains.flatMap(c => c.draws.slice(w));
  const d = draws[Math.floor(((k + 1) * draws.length) / 34) % draws.length] || [70, 10, Math.log(5)];
  const r = st.rng(500 + k);
  return XS.map(x => d[0] + d[1] * x + st.randNorm(r, 0, Math.exp(d[2])));
}

function sqrt2(inner) {
  return `<span class="fx-sqrt"><span class="fx-radical">√</span><span class="fx-rad">${inner}</span></span>`;
}
