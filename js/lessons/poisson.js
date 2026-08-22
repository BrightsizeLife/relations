/* ─────────────────────────────────────────────────────────────────────────────
   poisson.js — counting things. One parameter, a log link, and a variance
   assumption strong enough that it usually breaks.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, arrowDefs } from '../core/plot.js';
import { range } from '../core/dom.js';
import { formula, t, frac, sub, sup, hat, paren, eq, minus, op } from '../core/fx.js';

/* von Bortkiewicz (1898): deaths from horse kicks in the Prussian army,
   14 corps over 20 years. 200 corps-years, 122 deaths. */
const KICKS = [109, 65, 22, 3, 1];
const KICK_N = st.sum(KICKS);
const KICK_TOTAL = KICKS.reduce((a, c, k) => a + c * k, 0);
const KICK_MEAN = KICK_TOTAL / KICK_N;

/* Simulated hourly cyclist counts against temperature. Generated, not observed —
   labelled as such throughout. */
const BIKES = (() => {
  const r = st.rng(404);
  return range(28).map(i => {
    const temp = 4 + i * 1.05;
    return [+temp.toFixed(1), st.randPois(r, Math.exp(1.1 + 0.062 * temp))];
  });
})();

const F = () => frame({ w: 720, h: 540, l: 66, r: 28, t: 34, b: 58 });
const fit = () => st.glm(BIKES.map(p => [p[0]]), BIKES.map(p => p[1]), 'poisson');
const MU = x => { const m = fit(); return Math.exp(m.beta[0] + m.beta[1] * x); };

export default {
  meta: {
    id: 'poisson', title: 'poisson regression', kicker: 'COUNTING THINGS',
    status: 'live',
    deck: 'Counts are not measurements. They cannot go negative, they arrive in whole lumps, and their noise grows with their size. The Poisson model handles all three — and makes one assumption so strong that checking it is half the work.',
    dataNote: 'Data: von Bortkiewicz\'s 1898 record of Prussian cavalry deaths by horse kick — 200 corps-years, the founding example of the Poisson distribution. The regression example uses <em>simulated</em> cyclist counts, generated in your browser from a known log-linear mean, so you can compare the fit against the truth.',
    deps: ['glm'], unlocks: ['negbin'],
    next: 'negbin', nextLabel: 'negative binomial',
    outro: 'one parameter, a log link, and a dispersion check you should never skip.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { lam: 0.61, xq: 20, showFit: true },

  steps: [
    {
      title: 'a distribution with one knob',
      prose: `<p>In 1898 Ladislaus von Bortkiewicz counted how many Prussian cavalrymen were killed by horse kicks, corps by corps, year by year. Two hundred corps-years, 122 deaths.</p>
        <p>Rare, independent, unrelated events, counted in fixed windows — that is exactly the setting the Poisson distribution describes. And it has only <strong>one parameter</strong>: the mean rate λ. Fix the average and the entire shape is determined. No spread to estimate separately.</p>
        <p><strong>Slide λ</strong> and watch the whole distribution follow.</p>`,
      formula: formula(
        'P' + paren('Y ' + eq + ' k') + eq +
        frac(t('λ', { tone: 'gold' }) + sup('', 'k') + ' e' + sup('', '−λ'), 'k!'),
        { caption: 'the only input is the average rate' }),
      readouts: [
        { key: 'lam', label: 'λ', tone: 'gold', get: s => +s.lam, d: 2 },
        { key: 'obs', label: 'observed mean', tone: 'green', get: () => KICK_MEAN, d: 3, wide: true },
        { key: 'v', label: 'observed variance', tone: 'cold', get: () => {
          const vals = KICKS.flatMap((c, k) => range(c).map(() => k));
          return st.variance(vals);
        }, d: 3, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'lam', label: 'λ', min: 0.1, max: 4, step: 0.01, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'button', key: 'snap', label: '[set λ to the observed mean]', action: s => { s.lam = +KICK_MEAN.toFixed(2); } },
      ],
      beats: [
        {
          label: 'what was counted',
          note: '109 corps-years with no deaths, 65 with one, and so on. Four deaths in a single corps-year happened exactly once.',
          scene: () => {
            const f = F();
            f.setX(-0.6, 4.6); f.setY(0, 120);
            return [
              ...axes(f, { xLabel: 'deaths in a corps-year', yLabel: 'how many corps-years', xTickVals: [0, 1, 2, 3, 4] }),
              ...KICKS.map((c, k) => rect(`b-${k}`, f.sx(k) - 42, f.sy(c), 84, f.y0 - f.sy(c), {
                cls: 'bar bar-green', delay: k * 150, tip: `<b>${c}</b> corps-years with ${k} death${k === 1 ? '' : 's'}`,
              })),
              ...KICKS.map((c, k) => label(`l-${k}`, f.sx(k), f.sy(c) - 9, String(c), { cls: 'lab lab-mid', delay: k * 150 })),
            ];
          },
        },
        {
          label: 'the model on top',
          hold: 1700,
          note: 'Set λ to the observed mean and the theoretical distribution lands almost exactly on the counts. One number reproduces all five bars.',
          scene: s => {
            const f = F();
            f.setX(-0.6, 4.6); f.setY(0, 120);
            const lam = +s.lam;
            return [
              ...axes(f, { xLabel: 'deaths in a corps-year', yLabel: 'how many corps-years', xTickVals: [0, 1, 2, 3, 4] }),
              ...KICKS.map((c, k) => rect(`b-${k}`, f.sx(k) - 42, f.sy(c), 84, f.y0 - f.sy(c), {
                cls: 'bar bar-dim', tip: `observed <b>${c}</b>`,
              })),
              ...range(5).map(k => {
                const e = st.poissonPmf(k, lam) * KICK_N;
                return rect(`e-${k}`, f.sx(k) - 48, f.sy(e), 96, f.y0 - f.sy(e), {
                  cls: 'bar-out', dur: 200, tip: `Poisson predicts <b>${e.toFixed(1)}</b>`,
                });
              }),
              ...range(5).map(k => label(`el-${k}`, f.sx(k), f.sy(st.poissonPmf(k, lam) * KICK_N) - 9,
                (st.poissonPmf(k, lam) * KICK_N).toFixed(1), { cls: 'lab-sm lab-mid lab-gold', dur: 200 })),
              label('cap', f.midX, f.y1 + 6, `λ = ${lam.toFixed(2)}  ·  outline = what Poisson predicts`, { cls: 'lab lab-mid lab-gold', dur: 200 }),
            ];
          },
        },
      ],
    },

    {
      title: 'the assumption hiding in plain sight',
      prose: `<p>Because there's only one parameter, the mean and the variance are not free to disagree. In a Poisson distribution they are <strong>the same number</strong>.</p>
        <p>That's a real, checkable claim about your data, and it's the thing that most often turns out to be false. The horse-kick data passes — its variance is about 0.61, matching its mean almost exactly. Most real count data does not.</p>`,
      formula: formula(
        'E' + paren('Y') + eq + t('λ', { tone: 'gold' }) +
        op('&nbsp;&nbsp;and&nbsp;&nbsp;') + 'Var' + paren('Y') + eq + t('λ', { tone: 'gold' }) +
        op('&nbsp;&nbsp;→&nbsp;&nbsp;') + frac('Var', 'mean') + eq + t('1', { tone: 'green' }),
        { caption: 'not a result. an assumption you are making.' }),
      readouts: [
        { key: 'm', label: 'mean', tone: 'gold', get: () => KICK_MEAN, d: 4, wide: true },
        { key: 'v', label: 'variance', tone: 'cold', get: () => st.variance(KICKS.flatMap((c, k) => range(c).map(() => k))), d: 4, wide: true },
        { key: 'r', label: 'ratio', tone: 'green', get: () => st.variance(KICKS.flatMap((c, k) => range(c).map(() => k))) / KICK_MEAN, d: 3, wide: true },
      ],
      beats: [
        {
          label: 'mean equals variance',
          note: 'Each curve is a Poisson with a different λ. As the average rises, the spread rises with it — always at exactly the same rate.',
          scene: () => {
            const f = F();
            f.setX(-0.5, 20); f.setY(0, 0.42);
            const lams = [1, 3, 8, 14];
            return [
              ...axes(f, { xLabel: 'count', yLabel: 'probability', yN: 4 }),
              ...lams.flatMap((lam, li) => range(21).map(k => rect(`b-${li}-${k}`, f.sx(k) - 6 + li * 3, f.sy(st.poissonPmf(k, lam)), 5, f.y0 - f.sy(st.poissonPmf(k, lam)), {
                cls: ['bar bar-warm', 'bar bar-cold', 'bar bar-green', 'bar'][li], delay: li * 200, opacity: 0.85,
                tip: `λ = ${lam}, k = ${k}<br><b>${(st.poissonPmf(k, lam) * 100).toFixed(1)}%</b>`,
              }))),
              ...lams.map((lam, li) => label(`ll-${li}`, f.sx(lam), f.sy(st.poissonPmf(Math.floor(lam), lam)) - 12,
                `λ = ${lam}`, { cls: `lab lab-mid ${['lab-warm', 'lab-cold', 'lab-green', 'lab-gold'][li]}`, delay: li * 200 })),
              label('cap', f.midX, f.y1 + 6, 'higher average ⇒ wider spread, automatically', { cls: 'lab lab-mid' }),
            ];
          },
        },
      ],
    },

    {
      title: 'now let the rate depend on something',
      prose: `<p>Poisson regression says: the rate isn't one number, it's a function of a predictor. Warmer days, more cyclists.</p>
        <p>You can't put a straight line on λ directly — it would eventually predict a negative number of cyclists. So the line goes on <strong>log λ</strong>, and exponentiating brings it back. Exponentials never reach zero, which is exactly the guarantee we needed.</p>
        <p>Notice the consequence: the model is additive in logs, which means it is <strong>multiplicative in counts</strong>. That changes how you read the coefficient.</p>`,
      formula: formula(
        'log' + paren(t('λ', { tone: 'gold' })) + eq + sub('b', '0') + ' + ' + sub('b', '1') + 'x' +
        op('&nbsp;&nbsp;→&nbsp;&nbsp;') +
        t('λ', { tone: 'gold' }) + eq + 'e' + sup('', sub('b', '0')) + ' · e' + sup('', sub('b', '1') + 'x'),
        { caption: 'add on the log scale, multiply on the count scale' }),
      readouts: [
        { key: 'b0', label: 'b₀', get: () => fit().beta[0], d: 3, wide: true },
        { key: 'b1', label: 'b₁ (per °C)', tone: 'green', get: () => fit().beta[1], d: 4, wide: true },
        { key: 'rr', label: 'rate ratio per °C', tone: 'gold', get: () => Math.exp(fit().beta[1]), d: 4, wide: true },
        { key: 'p', label: 'p', tone: 'warm', get: () => fit().p[1], fmt: st.fmtP },
      ],
      controls: [
        { type: 'toggle', key: 'showFit', label: 'show the fitted rate' },
        { type: 'slider', key: 'xq', label: 'predict at', min: 4, max: 34, step: 0.5, fast: true, fmt: v => (+v).toFixed(1) + '°C' },
      ],
      beats: [
        {
          label: 'the counts',
          note: 'Every point is one hour. Note the scatter fanning out as the counts get bigger — that is the variance following the mean.',
          scene: s => {
            const f = F();
            const ys = BIKES.map(p => p[1]);
            f.setX(2, 36); f.setY(0, Math.max(...ys) * 1.15);
            return [
              ...axes(f, { xLabel: 'temperature (°C)', yLabel: 'cyclists counted in the hour' }),
              ...(s.showFit ? [fnPath(f, MU, { key: 'c', cls: 'curve curve-fit', n: 200 })] : []),
              ...points(f, BIKES, {
                key: 'p', r: 6, x: p => p[0], y: p => p[1], cls: 'pt pt-green', stagger: 30,
                tip: p => `${p[0]}°C<br><b>${p[1]}</b> cyclists<br>model expects <b>${MU(p[0]).toFixed(1)}</b>`,
              }),
            ];
          },
        },
        {
          label: 'straight on the log scale',
          note: 'Same model, y-axis logged. The curve becomes the straight line the arithmetic actually fits.',
          scene: () => {
            const m = fit();
            const f = F();
            const ys = BIKES.map(p => Math.log(Math.max(0.5, p[1])));
            f.setX(2, 36); f.setY(Math.min(...ys) - 0.4, Math.max(...ys) + 0.4);
            return [
              ...axes(f, { xLabel: 'temperature (°C)', yLabel: 'log(count)' }),
              fnPath(f, x => m.beta[0] + m.beta[1] * x, { key: 'l', cls: 'curve curve-cyan', clip: false }),
              ...BIKES.map((p, i) => ({
                key: `p-${i}`, tag: 'circle', cls: 'pt pt-green', delay: i * 25,
                attrs: { cx: f.sx(p[0]), cy: f.sy(Math.log(Math.max(0.5, p[1]))), r: 5.5 },
                tip: `${p[0]}°C → log(${p[1]}) = <b>${Math.log(Math.max(0.5, p[1])).toFixed(2)}</b>`,
              })),
              label('n', f.midX, f.y1 + 6, 'zero counts cannot be plotted here — the log link\'s one awkwardness', { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
        {
          label: 'multiplicative effects',
          note: 'Every extra degree multiplies the expected count by the same factor. Ten degrees compounds it ten times over.',
          scene: s => {
            const m = fit();
            const f = F();
            const ys = BIKES.map(p => p[1]);
            f.setX(2, 36); f.setY(0, Math.max(...ys) * 1.15);
            const x = +s.xq;
            const steps = range(4).map(i => x + i * 5).filter(v => v <= 34);
            return [
              ...axes(f, { xLabel: 'temperature (°C)', yLabel: 'expected cyclists' }),
              fnPath(f, MU, { key: 'c', cls: 'curve curve-fit', n: 200 }),
              ...points(f, BIKES, { key: 'p', r: 5, x: p => p[0], y: p => p[1], cls: 'pt pt-green', opacity: 0.35 }),
              ...steps.flatMap((v, i) => [
                vLine(f, v, { key: `v-${i}`, cls: 'rule-gold rule-dash', dur: 200, y1: f.sy(MU(v)) }),
                { key: `d-${i}`, tag: 'circle', cls: 'pt pt-warm', dur: 200, attrs: { cx: f.sx(v), cy: f.sy(MU(v)), r: 6 } },
                label(`dl-${i}`, f.sx(v), f.sy(MU(v)) - 12, MU(v).toFixed(1), { cls: 'lab lab-mid lab-warm', dur: 200 }),
              ]),
              label('rr', f.midX, f.y1 + 6,
                `each +5°C multiplies the rate by ${Math.exp(5 * m.beta[1]).toFixed(2)}`, { cls: 'lab-big lab-mid lab-gold' }),
            ];
          },
        },
      ],
    },

    {
      title: 'when the windows are different sizes',
      prose: `<p>One practical thing that trips people up. Suppose you counted cyclists for a full hour on some days and only twenty minutes on others. Raw counts are then not comparable — you'd be modelling your own measurement effort.</p>
        <p>The fix is an <strong>offset</strong>: a term added to the linear predictor with its coefficient nailed to 1. Because the model lives on the log scale, adding log(time) is the same as dividing the count by time. You are quietly modelling a <em>rate</em> while still letting the data be whole counts.</p>`,
      formula: formula(
        'log' + paren('λ') + eq + t('log(exposure)', { tone: 'cyan', explain: 'The offset. Its coefficient is fixed at 1, never estimated.' }) +
        ' + ' + sub('b', '0') + ' + ' + sub('b', '1') + 'x' +
        `<br>` + op('which is') + ' log' + paren(frac('λ', 'exposure')) + eq + sub('b', '0') + ' + ' + sub('b', '1') + 'x',
        { size: 'sm', caption: 'model the count, interpret the rate' }),
      aside: `<b>Where you meet this.</b> Deaths per 100,000 population, defects per metre of cable, claims per policy-year, events per patient-month. Any time the denominator varies, it belongs in the model as an offset — not as a predictor, and not by silently dividing first, which throws away the count structure the Poisson assumption needs.`,
      readouts: [],
      beats: [
        {
          label: 'same rate, different windows',
          note: 'Three corps observed for different lengths of time. The raw counts differ wildly; the underlying rate is identical.',
          scene: () => {
            const f = F();
            f.setX(0, 3.2); f.setY(0, 34);
            const rows = [
              { n: 'watched 1 hour', exp: 1, c: 8 },
              { n: 'watched 2 hours', exp: 2, c: 17 },
              { n: 'watched 4 hours', exp: 4, c: 31 },
            ];
            return [
              ...axes(f, { yLabel: 'cyclists counted', showX: false, xN: 0 }),
              ...rows.map((r, i) => rect(`b-${i}`, f.sx(i + 0.35) - 60, f.sy(r.c), 120, f.y0 - f.sy(r.c), {
                cls: 'bar bar-cold', delay: i * 160, tip: `${r.c} in ${r.exp}h`,
              })),
              ...rows.map((r, i) => label(`l-${i}`, f.sx(i + 0.35), f.sy(r.c) - 10, String(r.c), { cls: 'lab-big lab-mid', delay: i * 160 })),
              ...rows.map((r, i) => label(`n-${i}`, f.sx(i + 0.35), f.y0 + 20, r.n, { cls: 'lab-sm lab-mid', delay: i * 160 })),
              ...rows.map((r, i) => label(`rt-${i}`, f.sx(i + 0.35), f.y0 + 38,
                `${(r.c / r.exp).toFixed(1)} per hour`, { cls: 'lab-sm lab-mid lab-green', delay: i * 160 })),
              label('cap', f.midX, f.y1 + 6, 'without an offset the model would call the third one a hotspot', { cls: 'lab lab-mid lab-warm' }),
            ];
          },
        },
      ],
    },

    {
      title: 'check the assumption before you believe the p-value',
      prose: `<p>The last step, and the one people skip. Compare how much the observations actually scatter around their fitted means with how much Poisson says they should.</p>
        <p>That ratio is the <strong>dispersion</strong>. Poisson insists it's 1. If it comes back at 3, your data is three times lumpier than the model allows — and because the standard errors are derived from that same assumption, they'll be roughly √3 times too small. Every p-value the model prints will be too exciting.</p>
        <p>This simulated data was generated from a genuine Poisson process, so it passes. Real data usually doesn't, which is what the next lesson is for.</p>`,
      formula: formula(
        t('dispersion', { tone: 'warm' }) + eq +
        frac('1', 'n ' + minus + ' p') + '·' +
        `Σ` + frac(paren(t('y', { tone: 'green' }) + minus + t('μ̂', { tone: 'gold' })) + sup('', '2'), t('μ̂', { tone: 'gold' })),
        { caption: 'observed scatter ÷ assumed scatter. should be about 1.' }),
      readouts: [
        { key: 'disp', label: 'dispersion', tone: 'warm', get: () => fit().dispersion, d: 3, wide: true },
        { key: 'verdict', label: 'verdict', wide: true, get: () => {
          const d = fit().dispersion;
          return d > 1.5 ? 'overdispersed — do not trust the SEs' : d < 0.6 ? 'underdispersed' : 'consistent with Poisson';
        } },
        { key: 'dev', label: 'deviance', get: () => fit().dev, d: 1, wide: true },
        { key: 'r2', label: 'pseudo-R²', tone: 'green', get: () => fit().pseudoR2, d: 3, fmt: v => st.fmtR(v, 3) },
      ],
      dep: { note: 'If this number comes back well above 1, you need the model in the next lesson.', lesson: 'negbin', label: 'negative binomial' },
      beats: [
        {
          label: 'residuals against the fit',
          note: 'The dashed band is where Poisson says ±2 standard deviations should fall — and it widens as √μ. Points should mostly stay inside it.',
          scene: () => {
            const m = fit();
            const f = F();
            const ys = BIKES.map(p => p[1]);
            f.setX(2, 36); f.setY(-Math.max(...ys) * 0.55, Math.max(...ys) * 0.55);
            return [
              ...axes(f, { xLabel: 'temperature (°C)', yLabel: 'observed − expected' }),
              path('bu', range(60).map(i => { const x = 2 + (34 * i) / 59; return [f.sx(x), f.sy(2 * Math.sqrt(MU(x)))]; }), { cls: 'curve-ghost curve-dash' }),
              path('bd', range(60).map(i => { const x = 2 + (34 * i) / 59; return [f.sx(x), f.sy(-2 * Math.sqrt(MU(x)))]; }), { cls: 'curve-ghost curve-dash' }),
              hLine(f, 0, { key: 'z', cls: 'curve curve-fit' }),
              ...BIKES.map((p, i) => {
                const e = p[1] - MU(p[0]);
                return {
                  key: `r-${i}`, tag: 'circle', cls: Math.abs(e) > 2 * Math.sqrt(MU(p[0])) ? 'pt pt-warm' : 'pt pt-green',
                  delay: i * 30, attrs: { cx: f.sx(p[0]), cy: f.sy(e), r: 6 },
                  tip: `${p[0]}°C<br>observed <b>${p[1]}</b>, expected <b>${MU(p[0]).toFixed(1)}</b>`,
                };
              }),
              label('l', f.midX, f.y1 + 6, `dispersion = ${fit().dispersion.toFixed(2)}`, { cls: 'lab-big lab-mid lab-warm' }),
            ];
          },
        },
      ],
    },
  ],
};
