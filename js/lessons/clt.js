/* ─────────────────────────────────────────────────────────────────────────────
   clt.js — why bell curves keep showing up. The central limit theorem is a
   claim about averages, not about data, and the difference matters.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, fnArea, histBars, strip, arrowDefs } from '../core/plot.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sqrt, sub, sup, bar, paren, eq, minus, op } from '../core/fx.js';

const F = () => frame({ w: 720, h: 540, l: 66, r: 28, t: 34, b: 58 });

/* four deliberately un-bell-shaped populations */
const POPS = {
  skewed: {
    label: 'heavily skewed', draw: r => st.randExp(r, 0.5), lo: 0, hi: 14,
    pdf: x => (x < 0 ? 0 : 0.5 * Math.exp(-0.5 * x)), mu: 2, sd: 2,
    note: 'waiting times, incomes, most things measured in money',
  },
  bimodal: {
    label: 'two humps', draw: r => (r() < 0.5 ? st.randNorm(r, 2, 0.7) : st.randNorm(r, 9, 1.1)), lo: -1, hi: 13,
    pdf: x => 0.5 * st.normPdf(x, 2, 0.7) + 0.5 * st.normPdf(x, 9, 1.1), mu: 5.5, sd: 3.66,
    note: 'two populations mixed together and never separated',
  },
  uniform: {
    label: 'flat', draw: r => r() * 12, lo: -1, hi: 13,
    pdf: x => (x >= 0 && x <= 12 ? 1 / 12 : 0), mu: 6, sd: 12 / Math.sqrt(12),
    note: 'nothing is more likely than anything else',
  },
  spiky: {
    label: 'a die', draw: r => 1 + Math.floor(r() * 6), lo: 0, hi: 7,
    pdf: null, mu: 3.5, sd: Math.sqrt(35 / 12),
    note: 'discrete, only six possible values',
  },
};

function samples(s) {
  const r = st.rng(s.seed);
  const P = POPS[s.pop];
  const out = [];
  for (let i = 0; i < s.reps; i++) {
    const draw = range(s.n).map(() => P.draw(r));
    out.push({ draw, mean: st.mean(draw) });
  }
  return out;
}

export default {
  meta: {
    id: 'clt', title: 'normal distributions & the clt', kicker: 'WHY BELLS APPEAR',
    status: 'live',
    deck: 'The central limit theorem is the most misquoted result in statistics. It does not say your data becomes normal with enough of it. It says something much stranger and more useful — and once you have seen it happen, half the machinery on this site stops looking arbitrary.',
    dataNote: 'Everything on this page is <em>simulated live in your browser</em> from a population you choose, with a fixed seed so the run is reproducible. Simulation is the right tool here: the whole point is to watch the same procedure repeated thousands of times, which no real dataset lets you do.',
    deps: [], unlocks: [],
    next: 'bayes', nextLabel: 'bayesian basics',
    outro: 'averages are normal even when nothing else is. that is the entire trick.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { pop: 'skewed', n: 5, reps: 400, seed: 7, showNormal: true },

  steps: [
    {
      title: 'start with something that is not a bell',
      prose: `<p>Pick a population. None of these look remotely normal — one is heavily skewed, one has two humps, one is flat, one is a six-sided die.</p>
        <p>This is deliberate. Everything that follows will work regardless of which one you choose, and that's the surprising part.</p>`,
      readouts: [
        { key: 'mu', label: 'population mean', tone: 'gold', get: s => POPS[s.pop].mu, d: 2, wide: true },
        { key: 'sd', label: 'population sd', tone: 'cold', get: s => POPS[s.pop].sd, d: 2, wide: true },
      ],
      controls: [
        { type: 'segment', key: 'pop', label: 'population', options: Object.entries(POPS).map(([k, v]) => ({ value: k, label: v.label })) },
      ],
      beats: [
        { label: 'the shape', hold: 1400, note: 'This is what the world hands you. It is not a bell, and nothing is going to make it one.', scene: s => pop1(s, 1) },
        {
          label: 'and its mean',
          note: 'One number for the whole population. Everything that follows is about how well a handful of observations can find it.',
          scene: s => pop1(s, 2),
        },
      ],
    },

    {
      title: 'take a sample, take its average, keep the average',
      prose: `<p>Here's the procedure, and it's the whole lesson. Draw <em>n</em> observations from that population. Average them. Write down that one number. Throw the sample away.</p>
        <p>Now do it again. And again. Thousands of times.</p>
        <p>You are building a new distribution — not of observations, but of <strong>averages of observations</strong>. It is a distribution of a <em>statistic</em>, and it has a name: the sampling distribution.</p>`,
      readouts: [
        { key: 'n', label: 'sample size n', tone: 'gold', get: s => s.n, d: 0 },
        { key: 'one', label: 'this sample\'s mean', tone: 'green', get: s => samples({ ...s, reps: 1 })[0].mean, d: 3, wide: true },
        { key: 'mu', label: 'true μ', get: s => POPS[s.pop].mu, d: 2 },
      ],
      controls: [
        { type: 'slider', key: 'n', label: 'sample size n', min: 1, max: 60, step: 1, fast: true },
        { type: 'slider', key: 'seed', label: 'draw a different sample', min: 1, max: 60, step: 1, fast: true, fmt: () => 'reroll' },
      ],
      beats: [
        {
          label: 'one sample',
          note: 'n values pulled from the population. Individually they are as un-normal as ever.',
          scene: s => {
            const P = POPS[s.pop];
            const sm = samples({ ...s, reps: 1 })[0];
            const f = F();
            f.setX(P.lo, P.hi); f.setY(0, 1);
            const y = 300;
            return [
              ...axes(f, { xLabel: 'value', showY: false, grid: false }),
              { key: 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: y, x2: f.x1, y2: y } },
              ...sm.draw.map((v, i) => ({
                key: `d-${i}`, tag: 'circle', cls: 'pt pt-cold', delay: i * 35,
                attrs: { cx: f.sx(v), cy: y + ((i % 7) - 3) * 13, r: 6 },
                tip: `observation ${i + 1}: <b>${v.toFixed(2)}</b>`,
              })),
              label('l', f.midX, 180, `one sample of n = ${s.n}`, { cls: 'lab-big lab-mid' }),
            ];
          },
        },
        {
          label: 'collapse it to its mean',
          hold: 1600,
          note: 'All those values become a single number. That number is one dot in the picture we are about to build.',
          scene: s => {
            const P = POPS[s.pop];
            const sm = samples({ ...s, reps: 1 })[0];
            const f = F();
            f.setX(P.lo, P.hi); f.setY(0, 1);
            const y = 300;
            return [
              ...axes(f, { xLabel: 'value', showY: false, grid: false }),
              { key: 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: y, x2: f.x1, y2: y } },
              ...sm.draw.map((v, i) => ({
                key: `d-${i}`, tag: 'circle', cls: 'pt pt-cold', opacity: 0.3,
                attrs: { cx: f.sx(sm.mean), cy: y, r: 5 }, delay: i * 40,
              })),
              { key: 'mn', tag: 'circle', cls: 'pt pt-green', delay: 600, attrs: { cx: f.sx(sm.mean), cy: y, r: 11 } },
              numLabel('ml', f.sx(sm.mean), y - 26, sm.mean, { cls: 'lab-big lab-mid lab-green', d: 3, delay: 600 }),
              vLine(f, P.mu, { key: 'mu', cls: 'rule-gold rule-dash' }),
              label('mul', f.sx(P.mu), f.y1 + 10, 'true μ', { cls: 'lab-sm lab-mid lab-gold' }),
              label('l', f.midX, 180, 'one sample → one number', { cls: 'lab-big lab-mid' }),
            ];
          },
        },
      ],
    },

    {
      title: 'now do it four hundred times',
      prose: `<p>Every sample gives a different average, because every sample contains different observations. Pile those averages up and a shape appears.</p>
        <p>It is a bell. It was a bell for the skewed population, for the two-humped one, for the flat one, and for the die. <strong>The shape of the sampling distribution does not inherit the shape of the population.</strong></p>
        <p>Set n to 1 first — with samples of one, the "average" is just an observation, and you get the population shape back exactly. Then walk n upward and watch the bell assemble itself.</p>`,
      formula: formula(
        bar('X') + op('&nbsp;→&nbsp;') + 'Normal' + paren(t('μ', { tone: 'gold', explain: 'The sampling distribution is centred on the true population mean.' }) + ',&nbsp;' +
          frac(t('σ', { tone: 'cold' }), sqrt(t('n', { tone: 'green' })))) +
        op('&nbsp;&nbsp;as n grows'),
        { caption: 'whatever the population was' }),
      readouts: [
        { key: 'n', label: 'n', tone: 'gold', get: s => s.n, d: 0 },
        { key: 'mm', label: 'mean of the means', tone: 'green', get: s => st.mean(samples(s).map(x => x.mean)), d: 3, wide: true },
        { key: 'mu', label: 'true μ', get: s => POPS[s.pop].mu, d: 3, wide: true },
        { key: 'sdm', label: 'sd of the means', tone: 'warm', get: s => st.sd(samples(s).map(x => x.mean)), d: 3, wide: true },
        { key: 'pred', label: 'σ/√n predicts', tone: 'cold', get: s => POPS[s.pop].sd / Math.sqrt(s.n), d: 3, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'n', label: 'sample size n', min: 1, max: 60, step: 1, fast: true },
        { type: 'segment', key: 'pop', label: 'population', options: Object.entries(POPS).map(([k, v]) => ({ value: k, label: v.label })) },
        { type: 'toggle', key: 'showNormal', label: 'overlay the normal curve' },
      ],
      beats: [
        {
          label: 'the sampling distribution',
          note: 'Slide <b>n</b> from 1 upward. Somewhere around n = 5 the skew is already mostly gone.',
          scene: s => {
            const P = POPS[s.pop];
            const ms = samples(s).map(x => x.mean);
            const f = F();
            const se = P.sd / Math.sqrt(s.n);
            const lo = P.mu - Math.max(4 * se, 1), hi = P.mu + Math.max(4 * se, 1);
            f.setX(Math.max(P.lo - 1, lo), Math.min(P.hi + 1, hi));
            const bins = st.histogram(ms, 36, [f.dx[0], f.dx[1]]);
            const peak = Math.max(...bins.map(b => b.density), st.normPdf(P.mu, P.mu, se));
            f.setY(0, peak * 1.2);
            return [
              ...axes(f, { xLabel: `average of ${s.n} observation${s.n === 1 ? '' : 's'}`, yLabel: 'density', yN: 4 }),
              ...histBars(f, bins, { key: 'h', cls: 'bar bar-green', useDensity: true, dur: 240 }),
              ...(s.showNormal ? [fnPath(f, x => st.normPdf(x, P.mu, se), { key: 'nc', cls: 'curve curve-warm', n: 220, dur: 240 })] : []),
              vLine(f, P.mu, { key: 'mu', cls: 'rule-gold rule-dash' }),
              label('l', f.x0 + 10, f.y1 + 10, `n = ${s.n} · ${s.reps} samples`, { cls: 'lab-big lab-gold', dur: 240 }),
              label('l2', f.x1 - 8, f.y1 + 10,
                s.n === 1 ? 'n = 1: this IS the population' : s.n < 5 ? 'still lopsided' : 'that is a bell',
                { cls: 'lab lab-end ' + (s.n < 5 ? 'lab-warm' : 'lab-green'), dur: 240 }),
            ];
          },
        },
        {
          label: 'population vs sampling distribution',
          hold: 1800,
          note: 'Top: what one observation looks like. Bottom: what an average of n looks like. Same units, same axis, completely different animals.',
          scene: s => {
            const P = POPS[s.pop];
            const ms = samples(s).map(x => x.mean);
            const se = P.sd / Math.sqrt(s.n);
            const f = F();
            f.setX(P.lo, P.hi);
            const r = st.rng(1);
            const pop = range(3000).map(() => P.draw(r));
            const pb = st.histogram(pop, 34, [P.lo, P.hi]);
            const mb = st.histogram(ms, 34, [P.lo, P.hi]);
            const top = 100, bot = 300, H = 150;
            const pmax = Math.max(...pb.map(b => b.density));
            const mmax = Math.max(...mb.map(b => b.density));
            const bar = (b, y0, h, max, cls, key) => b.map((d, i) => rect(`${key}-${i}`,
              f.sx(d.x0) + 0.5, y0 - (d.density / max) * h, Math.max(0.5, f.sx(d.x1) - f.sx(d.x0) - 1), (d.density / max) * h,
              { cls, dur: 240 }));
            return [
              label('t1', f.midX, top - H - 16, 'one observation', { cls: 'lab lab-mid lab-cold' }),
              { key: 'ax1', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: top, x2: f.x1, y2: top } },
              ...bar(pb, top, H, pmax, 'bar bar-cold', 'p'),
              label('t2', f.midX, bot - H - 16, `average of ${s.n}`, { cls: 'lab lab-mid lab-green' }),
              { key: 'ax2', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: bot + 130, x2: f.x1, y2: bot + 130 } },
              ...bar(mb, bot + 130, H + 60, mmax, 'bar bar-green', 'm'),
              label('xl', f.midX, bot + 160, 'same axis, same units', { cls: 'ax-label' }),
              { key: 'muline', tag: 'line', cls: 'rule-gold rule-dash', attrs: { x1: f.sx(P.mu), y1: top - H - 8, x2: f.sx(P.mu), y2: bot + 138 } },
            ];
          },
        },
      ],
    },

    {
      title: 'the √n law, and why it is bad news',
      prose: `<p>The bell doesn't just appear — it narrows, and it narrows at a very specific rate. The standard deviation of the sampling distribution is σ divided by <strong>the square root of n</strong>.</p>
        <p>The square root is doing something economically brutal. To halve your uncertainty you need <em>four times</em> the data. To cut it by a factor of ten, a hundred times.</p>
        <p>This single fact explains why big studies are expensive, why the last bit of precision costs more than all the rest combined, and why the standard error appeared in the denominator of every test on this site.</p>`,
      formula: formula(
        t('SE', { tone: 'warm' }) + eq + frac(t('σ', { tone: 'cold' }), sqrt(t('n', { tone: 'green' }))) +
        op('&nbsp;&nbsp;→&nbsp;&nbsp;') + 'to halve SE, use ' + t('4n', { tone: 'gold' }),
        { caption: 'diminishing returns, baked into the arithmetic' }),
      readouts: [
        { key: 'n', label: 'n', tone: 'gold', get: s => s.n, d: 0 },
        { key: 'se', label: 'SE = σ/√n', tone: 'warm', get: s => POPS[s.pop].sd / Math.sqrt(s.n), d: 4, wide: true },
        { key: 'obs', label: 'observed spread', tone: 'green', get: s => st.sd(samples(s).map(x => x.mean)), d: 4, wide: true },
        { key: 'x4', label: 'to halve it, n =', tone: 'cold', get: s => s.n * 4, d: 0, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'n', label: 'sample size n', min: 1, max: 200, step: 1, fast: true },
      ],
      beats: [
        {
          label: 'the shrink curve',
          note: 'Steep at the start, then almost flat. The first 30 observations buy you more than the next 300.',
          scene: s => {
            const P = POPS[s.pop];
            const f = F();
            f.setX(1, 200); f.setY(0, P.sd * 1.05);
            return [
              ...axes(f, { xLabel: 'sample size n', yLabel: 'standard error of the mean', yN: 5 }),
              fnPath(f, n => P.sd / Math.sqrt(Math.max(1, n)), { key: 'c', cls: 'curve curve-warm', n: 240 }),
              { key: 'now', tag: 'circle', cls: 'pt pt-green', dur: 200, attrs: { cx: f.sx(s.n), cy: f.sy(P.sd / Math.sqrt(s.n)), r: 8 } },
              ...[4, 16, 64].map((k, i) => [
                vLine(f, k, { key: `g-${i}`, cls: 'rule-faint rule-dash' }),
                label(`gl-${i}`, f.sx(k), f.sy(P.sd / Math.sqrt(k)) - 12, `n=${k}`, { cls: 'lab-sm lab-mid' }),
              ]),
              label('l', f.midX, f.y1 + 10, 'each halving of the error costs four times the data', { cls: 'lab lab-mid lab-gold' }),
            ];
          },
        },
        {
          label: 'stacked bells',
          note: 'The same population, sampled at four different sizes. All centred on μ; each one √4 = 2× narrower than the one before.',
          scene: s => {
            const P = POPS[s.pop];
            const f = F();
            const se1 = P.sd;
            f.setX(P.mu - 3 * se1, P.mu + 3 * se1);
            f.setY(0, st.normPdf(P.mu, P.mu, P.sd / Math.sqrt(64)) * 1.1);
            return [
              ...axes(f, { xLabel: 'sample mean', yLabel: 'density', yN: 4 }),
              ...[1, 4, 16, 64].map((n, i) => fnPath(f, x => st.normPdf(x, P.mu, P.sd / Math.sqrt(n)), {
                key: `c-${i}`, cls: `curve ${['curve-cold', 'curve-purple', 'curve-warm', 'curve-fit'][i]}`, n: 200, delay: i * 220,
              })),
              ...[1, 4, 16, 64].map((n, i) => label(`l-${i}`, f.sx(P.mu) + 8,
                f.sy(st.normPdf(P.mu, P.mu, P.sd / Math.sqrt(n))) - 6, `n = ${n}`,
                { cls: `lab ${['lab-cold', 'lab-purple', 'lab-warm', 'lab-green'][i]}`, delay: i * 220 })),
              vLine(f, P.mu, { key: 'mu', cls: 'rule-gold rule-dash' }),
            ];
          },
        },
      ],
    },

    {
      title: 'what the clt does not say',
      prose: `<p>Three misreadings, all common, all worth killing off.</p>
        <p><strong>"With enough data, my data becomes normal."</strong> No. Look back at the top panel of the comparison plot — the population never changed shape, no matter how many samples we took. The CLT is about the sampling distribution of a statistic, not about the observations.</p>
        <p><strong>"n > 30 and you're fine."</strong> Sometimes. The rate of convergence depends on how badly skewed the population is. For a mild skew, n = 10 is plenty; for something genuinely heavy-tailed, n = 200 may not be enough. <strong>Switch to the skewed population and set n = 30</strong> — it's close, but you can still see the lean.</p>
        <p><strong>"It applies to everything."</strong> It needs finite variance and observations that don't lean on each other. Time series, clustered data, and genuinely heavy-tailed distributions all break one of those, and then the whole edifice — every t-test, every confidence interval — is standing on nothing.</p>`,
      aside: `<b>Where this actually gets used.</b> Every t-test on this site divides by a standard error and compares to a t distribution. That comparison is only legitimate because the sampling distribution of the mean is approximately normal. The CLT is not a topic that sits next to the tests — it is the thing holding them up.`,
      readouts: [
        { key: 'n', label: 'n', tone: 'gold', get: s => s.n, d: 0 },
        { key: 'skew', label: 'skew of the means', tone: 'warm', wide: true, get: s => {
          const ms = samples(s).map(x => x.mean);
          const m = st.mean(ms), sd = st.sd(ms);
          return st.mean(ms.map(v => ((v - m) / sd) ** 3));
        }, d: 3 },
        { key: 'verdict', label: 'verdict', wide: true, get: s => {
          const ms = samples(s).map(x => x.mean);
          const m = st.mean(ms), sd = st.sd(ms);
          const sk = Math.abs(st.mean(ms.map(v => ((v - m) / sd) ** 3)));
          return sk < 0.2 ? 'close enough to normal' : sk < 0.5 ? 'still visibly lopsided' : 'not normal yet';
        } },
      ],
      controls: [
        { type: 'segment', key: 'pop', label: 'population', options: Object.entries(POPS).map(([k, v]) => ({ value: k, label: v.label })) },
        { type: 'slider', key: 'n', label: 'sample size n', min: 1, max: 120, step: 1, fast: true },
      ],
      beats: [
        {
          label: 'how close is close?',
          note: 'The curve is the normal the CLT promises. The bars are what the simulation actually produced. Watch the gap close — at different speeds for different populations.',
          scene: s => {
            const P = POPS[s.pop];
            const ms = samples(s).map(x => x.mean);
            const se = P.sd / Math.sqrt(s.n);
            const f = F();
            f.setX(P.mu - 4 * se, P.mu + 4 * se);
            const bins = st.histogram(ms, 32, [f.dx[0], f.dx[1]]);
            f.setY(0, Math.max(...bins.map(b => b.density), st.normPdf(P.mu, P.mu, se)) * 1.15);
            const m = st.mean(ms), sd = st.sd(ms);
            const sk = st.mean(ms.map(v => ((v - m) / sd) ** 3));
            return [
              ...axes(f, { xLabel: 'sample mean', yLabel: 'density', yN: 4 }),
              ...histBars(f, bins, { key: 'h', cls: 'bar bar-green', useDensity: true, dur: 240 }),
              fnPath(f, x => st.normPdf(x, P.mu, se), { key: 'nc', cls: 'curve curve-warm', n: 220, dur: 240 }),
              vLine(f, P.mu, { key: 'mu', cls: 'rule-gold rule-dash' }),
              label('l', f.x0 + 10, f.y1 + 10,
                `n = ${s.n} · skew of the sampling distribution = ${sk.toFixed(3)}`, { cls: 'lab lab-gold', dur: 240 }),
              label('l2', f.x1 - 8, f.y1 + 10,
                Math.abs(sk) < 0.2 ? 'the normal approximation is safe here' : 'do not trust a t-test yet',
                { cls: `lab lab-end ${Math.abs(sk) < 0.2 ? 'lab-green' : 'lab-warm'}`, dur: 240 }),
            ];
          },
        },
      ],
    },
  ],
};

/* ── the opening, staged ─────────────────────────────────────────────────── */

function pop1(s, phase) {
  const P = POPS[s.pop];
  const f = F();
  f.setX(P.lo, P.hi);
  const r = st.rng(1);
  const vals = range(4000).map(() => P.draw(r));
  const bins = st.histogram(vals, s.pop === 'spiky' ? 7 : 34, [P.lo, P.hi]);
  f.setY(0, Math.max(...bins.map(b => b.density)) * 1.25);
  return [
    ...axes(f, { xLabel: 'value of one observation', yLabel: 'density', yN: 4 }),
    ...histBars(f, bins, { key: 'h', cls: 'bar bar-cold', useDensity: true, stagger: 12 }),
    ...(P.pdf ? [fnPath(f, P.pdf, { key: 'c', cls: 'curve', n: 220 })] : []),
    phase >= 2 ? vLine(f, P.mu, { key: 'mu', cls: 'rule-gold' }) : null,
    phase >= 2 ? label('mul', f.sx(P.mu), f.y1 + 8, `μ = ${P.mu.toFixed(2)}`, { cls: 'lab lab-mid lab-gold' }) : null,
    label('nt', f.midX, f.y0 - 14, P.note, { cls: 'lab lab-mid' }),
  ].filter(Boolean);
}
