/* ─────────────────────────────────────────────────────────────────────────────
   negbin.js — what to do when counts are lumpier than Poisson allows. One extra
   parameter, and standard errors that stop lying.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, histBars, arrowDefs } from '../core/plot.js';
import { range } from '../core/dom.js';
import { formula, t, frac, sub, sup, paren, eq, minus, op } from '../core/fx.js';

const F = () => frame({ w: 720, h: 540, l: 66, r: 28, t: 34, b: 58 });

/**
 * Simulated counts with a dial for extra clumping. At theta = ∞ this is exactly
 * Poisson; as theta falls the same average arrives in lumpier bursts.
 */
function makeData(theta) {
  const r = st.rng(1871);
  return range(40).map(i => {
    const x = 1 + i * 0.5;
    const mu = Math.exp(0.7 + 0.11 * x);
    // gamma-mixed Poisson: draw a random multiplier, then a Poisson around it
    let g = 1;
    if (isFinite(theta)) {
      let s = 0;
      const k = Math.max(1, Math.round(theta));
      for (let j = 0; j < k; j++) s += -Math.log(Math.max(r(), 1e-12));
      g = s / k;
    }
    return [+x.toFixed(2), st.randPois(r, mu * g)];
  });
}

function models(s) {
  const data = makeData(s.theta >= 40 ? Infinity : s.theta);
  const X = data.map(p => [p[0]]), y = data.map(p => p[1]);
  const pois = st.glm(X, y, 'poisson');
  const nb = st.glmNB(X, y);
  return { data, pois, nb };
}

export default {
  meta: {
    id: 'negbin', title: 'negative binomial', kicker: 'WHEN POISSON LIES',
    status: 'live',
    deck: 'Poisson insists the variance equals the mean. Real counts almost never agree — they clump. The negative binomial adds exactly one parameter to buy that clumping back, and the coefficients barely move. What moves is your honesty about them.',
    dataNote: 'Data: <em>simulated</em> counts, generated in your browser as a gamma-mixed Poisson process, so the amount of extra clumping is a dial you control and the truth is known. Real overdispersed data behaves the same way; the point of simulating is that you can turn the cause on and off.',
    deps: ['poisson'], unlocks: [],
    next: 'multiple', nextLabel: 'multiple regression',
    outro: 'one extra parameter, and standard errors that survive contact with reality.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { theta: 40, showBoth: true },

  steps: [
    {
      title: 'counts clump',
      prose: `<p>Poisson assumes events arrive independently at a steady rate. Reality is rarely that tidy. Some days are simply <em>busier</em> for reasons the model can't see — a festival, a heatwave, a broken train line — and every count on those days is inflated together.</p>
        <p>The result is more zeros <em>and</em> more very large values than Poisson expects, with the same average. That's overdispersion.</p>
        <p><strong>Turn the clumping dial down</strong> and watch the distribution grow a heavy tail while its mean stays put.</p>`,
      readouts: [
        { key: 'th', label: 'θ (clumping)', tone: 'gold', get: s => s.theta >= 40 ? Infinity : +s.theta, d: 1, fmt: v => v >= 40 ? '∞' : v.toFixed(1) },
        { key: 'm', label: 'mean', tone: 'green', get: s => st.mean(models(s).data.map(p => p[1])), d: 2, wide: true },
        { key: 'v', label: 'variance', tone: 'warm', get: s => st.variance(models(s).data.map(p => p[1])), d: 2, wide: true },
        { key: 'r', label: 'variance ÷ mean', tone: 'cold', wide: true, get: s => {
          const y = models(s).data.map(p => p[1]);
          return st.variance(y) / st.mean(y);
        }, d: 2 },
      ],
      controls: [
        { type: 'slider', key: 'theta', label: 'θ — lower means lumpier', min: 0.5, max: 40, step: 0.5, fast: true, fmt: v => (+v >= 40 ? '∞ (pure Poisson)' : (+v).toFixed(1)) },
      ],
      beats: [
        {
          label: 'the distribution of counts',
          note: 'Bars are the simulated counts. The outline is what a Poisson with the same mean would predict. Watch the gap open in the tail.',
          scene: s => {
            const { data } = models(s);
            const y = data.map(p => p[1]);
            const m = st.mean(y);
            const maxK = Math.min(40, Math.max(...y) + 2);
            const f = F();
            f.setX(-0.6, maxK);
            const counts = range(maxK + 1).map(k => y.filter(v => v === k).length);
            f.setY(0, Math.max(...counts, ...range(maxK + 1).map(k => st.poissonPmf(k, m) * y.length)) * 1.2);
            const w = (f.x1 - f.x0) / (maxK + 1);
            return [
              ...axes(f, { xLabel: 'count', yLabel: 'how many observations', yN: 4 }),
              ...counts.map((c, k) => rect(`b-${k}`, f.sx(k) - w * 0.42, f.sy(c), w * 0.84, f.y0 - f.sy(c), {
                cls: 'bar bar-warm', dur: 240, tip: `<b>${c}</b> observations of ${k}`,
              })),
              ...range(maxK + 1).map(k => {
                const e = st.poissonPmf(k, m) * y.length;
                return rect(`e-${k}`, f.sx(k) - w * 0.5, f.sy(e), w, f.y0 - f.sy(e), { cls: 'bar-out', dur: 240 });
              }),
              label('cap', f.midX, f.y1 + 6,
                s.theta >= 40 ? 'θ = ∞ · this is exactly Poisson' : `θ = ${(+s.theta).toFixed(1)} · fatter tail, same mean`,
                { cls: 'lab-big lab-mid lab-gold', dur: 240 }),
            ];
          },
        },
      ],
    },

    {
      title: 'one extra parameter buys the lumpiness back',
      prose: `<p>The negative binomial keeps the same log-linear mean — the coefficients still mean rate ratios, everything you learned still applies. What changes is the variance function.</p>
        <p>Instead of Var = μ, it says Var = μ + μ²/θ. The extra term is quadratic, so it barely matters for small counts and takes over for large ones. And θ controls how fast: large θ collapses back to Poisson exactly, small θ allows enormous clumping.</p>
        <p>One way to picture where it comes from: each observation gets its own private rate, drawn from a gamma distribution, and <em>then</em> a Poisson count around that. Poisson with a randomly wobbling mean is exactly a negative binomial.</p>`,
      formula: formula(
        t('Poisson', { tone: 'cold' }) + ': Var ' + eq + ' μ' +
        op('&nbsp;&nbsp;&nbsp;&nbsp;') +
        t('negative binomial', { tone: 'warm' }) + ': Var ' + eq + ' μ + ' +
        frac(t('μ', { tone: 'gold' }) + sup('', '2'), t('θ', { tone: 'green', explain: 'The dispersion parameter. As θ → ∞ this term vanishes and you are back to Poisson.' })),
        { caption: 'the same mean model, a roomier variance' }),
      readouts: [
        { key: 'th', label: 'true θ', tone: 'gold', get: s => s.theta >= 40 ? Infinity : +s.theta, fmt: v => v >= 40 ? '∞' : v.toFixed(1) },
        { key: 'est', label: 'θ estimated', tone: 'green', get: s => models(s).nb.theta, d: 2, wide: true },
        { key: 'disp', label: 'poisson dispersion', tone: 'warm', get: s => models(s).pois.dispersion, d: 2, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'theta', label: 'θ — lower means lumpier', min: 0.5, max: 40, step: 0.5, fast: true, fmt: v => (+v >= 40 ? '∞' : (+v).toFixed(1)) },
      ],
      beats: [
        {
          label: 'the two variance functions',
          note: 'Below the curves is what the model thinks is plausible scatter. Poisson\'s straight line is far too tight once the counts get big.',
          scene: s => {
            const { nb } = models(s);
            const f = F();
            f.setX(0, 30); f.setY(0, 120);
            return [
              ...axes(f, { xLabel: 'μ — the expected count', yLabel: 'variance the model allows' }),
              fnPath(f, x => x, { key: 'p', cls: 'curve curve-cold', n: 100 }),
              fnPath(f, x => x + (x * x) / nb.theta, { key: 'n', cls: 'curve curve-warm', n: 140, dur: 240 }),
              label('lp', f.sx(26), f.sy(26) - 12, 'Poisson: μ', { cls: 'lab lab-cold lab-end' }),
              label('ln', f.sx(22), f.sy(Math.min(115, 22 + 484 / nb.theta)) - 12,
                `negative binomial: μ + μ²/${nb.theta.toFixed(1)}`, { cls: 'lab lab-warm lab-end', dur: 240 }),
            ];
          },
        },
        {
          label: 'both fits on the data',
          hold: 1600,
          note: 'The mean curves are nearly identical — that is the point. The models disagree about <b>uncertainty</b>, not about the trend.',
          scene: s => {
            const { data, pois, nb } = models(s);
            const ys = data.map(p => p[1]);
            const f = F();
            f.setX(0, 22); f.setY(0, Math.max(...ys) * 1.1);
            return [
              ...axes(f, { xLabel: 'x', yLabel: 'count' }),
              fnPath(f, x => Math.exp(pois.beta[0] + pois.beta[1] * x), { key: 'cp', cls: 'curve curve-cold', n: 150, dur: 240 }),
              fnPath(f, x => Math.exp(nb.beta[0] + nb.beta[1] * x), { key: 'cn', cls: 'curve curve-warm curve-dash', n: 150, dur: 240 }),
              ...points(f, data, { key: 'p', r: 5, x: p => p[0], y: p => p[1], cls: 'pt pt-green', opacity: 0.75 }),
              label('l1', f.x0 + 10, f.y1 + 10, 'poisson fit', { cls: 'lab lab-cold' }),
              label('l2', f.x0 + 10, f.y1 + 28, 'negative binomial fit', { cls: 'lab lab-warm' }),
            ];
          },
        },
      ],
    },

    {
      title: 'what actually changes: the standard errors',
      prose: `<p>Here's the payoff, and it's worth staring at. The slope estimates from the two models are almost the same number. The <strong>standard errors are not.</strong></p>
        <p>When the data is overdispersed, Poisson's SE is too small — sometimes by a factor of two or three. The z-statistic inflates, the p-value collapses, and you confidently report an effect whose real uncertainty you never measured.</p>
        <p><strong>Drag θ down and watch the two intervals separate.</strong> That gap is the entire practical consequence of getting the variance function wrong.</p>`,
      readouts: [
        { key: 'bp', label: 'slope (poisson)', tone: 'cold', get: s => models(s).pois.beta[1], d: 4, wide: true },
        { key: 'bn', label: 'slope (negbin)', tone: 'warm', get: s => models(s).nb.beta[1], d: 4, wide: true },
        { key: 'sp', label: 'SE (poisson)', tone: 'cold', get: s => models(s).pois.se[1], d: 4, wide: true },
        { key: 'sn', label: 'SE (negbin)', tone: 'warm', get: s => models(s).nb.se[1], d: 4, wide: true },
        { key: 'ratio', label: 'SE inflation', tone: 'gold', get: s => { const m = models(s); return m.nb.se[1] / m.pois.se[1]; }, d: 2, suf: '×', wide: true },
      ],
      controls: [
        { type: 'slider', key: 'theta', label: 'θ — lower means lumpier', min: 0.5, max: 40, step: 0.5, fast: true, fmt: v => (+v >= 40 ? '∞' : (+v).toFixed(1)) },
      ],
      beats: [
        {
          label: 'two intervals for the same slope',
          note: 'Same estimate, two very different claims about how well we know it.',
          scene: s => {
            const { pois, nb } = models(s);
            const f = F();
            const lo = Math.min(pois.beta[1] - 3 * nb.se[1], 0);
            const hi = Math.max(pois.beta[1] + 3 * nb.se[1], 0.02);
            f.setX(lo, hi); f.setY(0, 1);
            const row = (key, b, se, y, cls, name) => [
              { key: key + 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: y, x2: f.x1, y2: y } },
              rect(key + 'ci', f.sx(b - 1.96 * se), y - 15, f.sx(b + 1.96 * se) - f.sx(b - 1.96 * se), 30, { cls, dur: 240 }),
              { key: key + 'pt', tag: 'circle', cls: 'pt pt-green', dur: 240, attrs: { cx: f.sx(b), cy: y, r: 7 } },
              label(key + 'n', f.x0, y - 30, name, { cls: 'lab' }),
              label(key + 'v', f.sx(b), y + 30,
                `${b.toFixed(4)} ± ${(1.96 * se).toFixed(4)}`, { cls: 'lab-sm lab-mid', dur: 240 }),
            ];
            return [
              ...axes(f, { xLabel: 'slope on the log scale', showY: false, grid: false, xN: 5 }),
              vLine(f, 0, { key: 'z', cls: 'rule-gold rule-dash' }),
              label('zl', f.sx(0), f.y1 + 60, 'no effect', { cls: 'lab-sm lab-mid lab-gold' }),
              ...row('p', pois.beta[1], pois.se[1], 200, 'sq sq-neg', 'poisson — too confident when data clumps'),
              ...row('n', nb.beta[1], nb.se[1], 340, 'sq sq-pos', 'negative binomial — honest'),
              label('cmp', f.midX, 440,
                `the negative binomial interval is ${(nb.se[1] / pois.se[1]).toFixed(2)}× wider`,
                { cls: 'lab-big lab-mid lab-gold', dur: 240 }),
            ];
          },
        },
      ],
    },

    {
      title: 'how to decide',
      prose: `<p>A short, usable rule.</p>
        <ul>
          <li>Fit the Poisson model first. Always.</li>
          <li>Look at the dispersion. Near 1, stop — you're done, and Poisson's extra efficiency is yours.</li>
          <li>Meaningfully above 1, refit as negative binomial. Compare the two by AIC, which charges you for the extra parameter.</li>
          <li>If θ comes back large, the two models have converged and it didn't matter. If θ is small, you just avoided publishing a false certainty.</li>
        </ul>
        <p>There is almost no downside to checking. The negative binomial nests Poisson as a limiting case, so fitting it costs you one parameter and buys you insurance.</p>`,
      aside: `<b>Overdispersion is not the only culprit.</b> A pile of zeros beyond what any count model expects usually means two processes are at work — one deciding whether anything happens at all, another deciding how much. That is what zero-inflated and hurdle models are for, and they are the natural next step from here.`,
      readouts: [
        { key: 'disp', label: 'dispersion', tone: 'warm', get: s => models(s).pois.dispersion, d: 2, wide: true },
        { key: 'th', label: 'θ estimated', tone: 'green', get: s => models(s).nb.theta, d: 2, wide: true },
        { key: 'ap', label: 'AIC poisson', tone: 'cold', get: s => models(s).pois.aic, d: 1, wide: true },
        { key: 'an', label: 'AIC negbin', tone: 'warm', get: s => models(s).nb.aic, d: 1, wide: true },
        { key: 'pick', label: 'pick', tone: 'gold', wide: true, get: s => {
          const m = models(s);
          return m.pois.dispersion > 1.5 ? 'negative binomial' : 'poisson is fine';
        } },
      ],
      controls: [
        { type: 'slider', key: 'theta', label: 'θ — lower means lumpier', min: 0.5, max: 40, step: 0.5, fast: true, fmt: v => (+v >= 40 ? '∞' : (+v).toFixed(1)) },
      ],
      beats: [
        {
          label: 'the decision, as a dial',
          note: 'Sweep θ from lumpy to Poisson and watch the dispersion statistic walk down to 1. That statistic is the whole diagnostic.',
          scene: s => {
            const m = models(s);
            const f = F();
            f.setX(0, 5); f.setY(0, 1);
            const d = m.pois.dispersion;
            const y = 240;
            return [
              ...axes(f, { xLabel: 'dispersion of the Poisson fit', showY: false, grid: false, xN: 5 }),
              { key: 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: y, x2: f.x1, y2: y } },
              rect('ok', f.x0, y - 22, f.sx(1.5) - f.x0, 44, { cls: 'sq sq-pos', opacity: 0.4 }),
              rect('bad', f.sx(1.5), y - 22, f.x1 - f.sx(1.5), 44, { cls: 'sq sq-neg', opacity: 0.4 }),
              label('okl', (f.x0 + f.sx(1.5)) / 2, y - 34, 'poisson is fine', { cls: 'lab lab-mid lab-green' }),
              label('badl', (f.sx(1.5) + f.x1) / 2, y - 34, 'use the negative binomial', { cls: 'lab lab-mid lab-warm' }),
              vLine(f, 1, { key: 'one', cls: 'rule-faint rule-dash' }),
              { key: 'now', tag: 'circle', cls: 'pt pt-gold', dur: 240, attrs: { cx: f.sx(Math.min(d, 5)), cy: y, r: 10 } },
              numLabel('nowl', f.sx(Math.min(d, 5)), y + 46, d, { cls: 'lab-big lab-mid lab-gold', d: 2, dur: 240 }),
              label('aic', f.midX, y + 110,
                `AIC — poisson ${m.pois.aic.toFixed(0)}  ·  negbin ${m.nb.aic.toFixed(0)}  ·  lower wins`,
                { cls: 'lab lab-mid', dur: 240 }),
            ];
          },
        },
      ],
    },
  ],
};
