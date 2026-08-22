/* ─────────────────────────────────────────────────────────────────────────────
   computation.js — the machine underneath. Growth rates, floating point, why
   statisticians work in logs, and what a seed actually is.

   Everything here is demonstrated with the arithmetic this site already uses,
   because the failures are not hypothetical: the naive variance formula really
   does destroy itself, and you can watch it happen.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, histBars, arrowDefs } from '../core/plot.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sqrt, sub, sup, sumOver, paren, eq, minus, op } from '../core/fx.js';

const F = () => frame({ w: 720, h: 540, l: 74, r: 28, t: 34, b: 58 });

const ORDERS = {
  log: { label: 'O(log n)', fn: n => Math.log2(Math.max(n, 1)), tone: 'green', eg: 'binary search' },
  lin: { label: 'O(n)', fn: n => n, tone: 'cyan', eg: 'one pass over your data' },
  nlogn: { label: 'O(n log n)', fn: n => n * Math.log2(Math.max(n, 2)), tone: 'gold', eg: 'sorting — and therefore every rank test' },
  sq: { label: 'O(n²)', fn: n => n * n, tone: 'warm', eg: 'every pair — Mann–Whitney, distance matrices' },
  cube: { label: 'O(n³)', fn: n => n * n * n, tone: 'cold', eg: 'inverting a matrix — regression with many predictors' },
};

/** the one-pass variance formula: mathematically correct, numerically a trap */
function naiveVar(xs) {
  let s = 0, ss = 0;
  for (const v of xs) { s += v; ss += v * v; }
  const n = xs.length;
  return (ss - (s * s) / n) / (n - 1);
}
/** the two-pass version, which is what stats.js actually uses */
const goodVar = xs => st.variance(xs);

const shifted = s => {
  const base = [4.17, 5.58, 5.18, 6.11, 4.50, 4.61, 5.17, 4.53, 5.33, 5.14];
  const off = Math.pow(10, +s.shift);
  return base.map(v => v + off);
};

export default {
  meta: {
    id: 'computation', title: 'how computers do this', kicker: 'THE MACHINE UNDERNEATH',
    status: 'live',
    deck: 'Every number on this site came out of a machine that cannot represent most numbers, cannot generate randomness, and takes measurably longer as your data grows. None of that is usually taught alongside the statistics, and all of it shows up the first time your analysis is slow, irreproducible, or quietly wrong.',
    dataNote: 'The failures on this page are real and running in your browser — the catastrophic cancellation is genuinely happening to the numbers shown, not a re-enactment. Timings are computed from operation counts rather than measured, since a browser tab is a terrible stopwatch.',
    deps: ['matrix', 'entropy'], unlocks: [],
    next: 'index', nextLabel: 'the index',
    outref: '',
    outro: 'floating point, log space, and a seed. three things that will save you a bad afternoon.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { n: 1000, order: 'sq', shift: 0, terms: 400, seed: 42, draw: 0 },

  steps: [
    {
      title: 'the shape of the cost, not the speed of the machine',
      prose: `<p>Big-O notation ignores constants and asks one question: <strong>as your data grows, what happens to the work?</strong> That is the only part that survives a faster laptop.</p>
        <p>The distinction that matters in practice is between things that scale linearly and things that scale with pairs. A single pass over a million rows is a million operations. Comparing every row to every other is a <em>trillion</em>. No hardware fixes that gap; only a different algorithm does.</p>
        <p><strong>Slide n</strong> and watch the curves separate. Note where each of the methods on this site sits.</p>`,
      formula: formula(
        t('O(n)', { tone: 'cyan' }) + ' → double the data, double the work' +
        `<br>` +
        t('O(n²)', { tone: 'warm' }) + ' → double the data, ' + t('quadruple', { tone: 'warm' }) + ' the work' +
        `<br>` +
        t('O(n³)', { tone: 'cold' }) + ' → double the data, ' + t('eight times', { tone: 'cold' }) + ' the work',
        { size: 'sm', caption: 'constants are the machine; the exponent is the algorithm' }),
      readouts: [
        { key: 'n', label: 'n', tone: 'gold', get: s => +s.n, d: 0 },
        { key: 'ops', label: 'operations', tone: 'warm', wide: true, get: s => ORDERS[s.order].fn(+s.n), fmt: v => bignum(v) },
        { key: 'eg', label: 'for example', wide: true, get: s => ORDERS[s.order].eg },
        { key: 'time', label: 'at a billion per second', tone: 'cyan', wide: true, get: s => humanTime(ORDERS[s.order].fn(+s.n) / 1e9) },
      ],
      controls: [
        { type: 'slider', key: 'n', label: 'rows of data', min: 10, max: 100000, step: 10, fast: true, fmt: v => bignum(+v) },
        { type: 'segment', key: 'order', label: 'complexity', options: Object.entries(ORDERS).map(([k, v]) => ({ value: k, label: v.label, explain: v.eg })) },
      ],
      beats: [
        {
          label: 'the growth curves',
          note: 'Log scale on both axes, so each straight line is a different power. <b>The slope is the exponent.</b>',
          scene: s => {
            const f = F();
            f.setX(1, 5); f.setY(0, 15);   // log10 n, log10 operations
            const keys = Object.keys(ORDERS);
            return [
              ...axes(f, {
                xLabel: 'rows of data', yLabel: 'operations',
                xFmt: v => bignum(Math.pow(10, v)), yFmt: v => bignum(Math.pow(10, v)), yN: 5, xN: 5,
              }),
              ...keys.map((k, i) => fnPath(f, lx => Math.log10(Math.max(1, ORDERS[k].fn(Math.pow(10, lx)))), {
                key: `c-${i}`, cls: `curve curve-${ORDERS[k].tone === 'cyan' ? 'cyan' : ORDERS[k].tone === 'warm' ? 'warm' : ORDERS[k].tone === 'cold' ? 'cold' : ORDERS[k].tone === 'green' ? 'fit' : ''}`,
                n: 80, delay: i * 140,
              })),
              ...keys.map((k, i) => label(`l-${i}`, f.x1 - 6, f.sy(Math.min(14.4, Math.log10(Math.max(1, ORDERS[k].fn(1e5))))) - 8,
                ORDERS[k].label, { cls: `lab-sm lab-end lab-${ORDERS[k].tone}`, delay: i * 140 })),
              vLine(f, Math.log10(+s.n), { key: 'now', cls: 'rule-gold', dur: 200 }),
              { key: 'dot', tag: 'circle', cls: 'pt pt-gold', dur: 200,
                attrs: { cx: f.sx(Math.log10(+s.n)), cy: f.sy(clamp(Math.log10(Math.max(1, ORDERS[s.order].fn(+s.n))), 0, 15)), r: 8 } },
              label('nl', f.sx(Math.log10(+s.n)), f.y1 + 8,
                `${bignum(+s.n)} rows → ${bignum(ORDERS[s.order].fn(+s.n))} operations`, { cls: 'lab lab-mid lab-gold', dur: 200 }),
            ];
          },
        },
        {
          label: 'what this site costs',
          note: 'Where each method sits. The ones that scale with pairs or with matrix inversion are the ones that stop being interactive first.',
          scene: () => {
            const rows = [
              ['a mean, a variance, a correlation', 'O(n)', 'cyan'],
              ['sorting — so every rank test', 'O(n log n)', 'gold'],
              ['Mann–Whitney, all pairwise comparisons', 'O(n²)', 'warm'],
              ['OLS with p predictors', 'O(np² + p³)', 'cold'],
              ['a decision tree', 'O(p · n log n)', 'gold'],
              ['MCMC', 'O(iterations × n)', 'green'],
              ['bootstrap / permutation', 'O(resamples × n)', 'green'],
            ];
            const items = [label('t', 376, 90, 'the cost of everything on this site', { cls: 'lab-big lab-mid' })];
            rows.forEach(([name, o, tone], i) => {
              const y = 150 + i * 52;
              items.push(rect(`bg-${i}`, 40, y - 22, 640, 42, { cls: 'cell', delay: i * 90, opacity: i % 2 ? 0.9 : 0.5 }));
              items.push(label(`n-${i}`, 62, y, name, { cls: 'lab', delay: i * 90 }));
              items.push(label(`o-${i}`, 658, y, o, { cls: `lab lab-end lab-${tone}`, delay: i * 90 }));
            });
            items.push(label('c', 376, 520, 'resampling is expensive on purpose — it is buying you freedom from algebra',
              { cls: 'lab-sm lab-mid' }));
            return items;
          },
        },
      ],
    },

    {
      title: 'the computer cannot hold your numbers',
      prose: `<p>A double holds about sixteen significant digits. Not sixteen decimal places — sixteen <em>digits</em>, total, wherever the decimal point happens to be. Everything else is rounded away the moment the number is stored.</p>
        <p>Usually harmless. It becomes catastrophic when you <strong>subtract two nearly equal large numbers</strong>, because the digits they agree on cancel and you are left holding whatever rounding noise was hiding underneath. That is <em>catastrophic cancellation</em>, and it has a famous victim: the one-pass variance formula.</p>
        <p><span class="cs-inline-code">Var = (Σx² − (Σx)²/n) / (n−1)</span> is algebraically perfect and numerically a trap. <strong>Add a large constant to the data below.</strong> The variance should not change at all — a shift moves every value equally. Watch it change anyway, and then collapse into nonsense.</p>`,
      formula: formula(
        t('naive', { tone: 'warm' }) + ': ' + frac('Σx² − (Σx)²/n', 'n − 1') +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') +
        t('two-pass', { tone: 'green' }) + ': ' + frac('Σ(x − x̄)²', 'n − 1'),
        { size: 'sm', caption: 'identical on paper — one of them survives contact with a computer' }),
      aside: `<b>This is not an exotic edge case.</b> Timestamps, coordinates, prices in cents, and anything measured from an arbitrary origin all sit far from zero with small variation around them. The one-pass formula is still in textbooks and in a lot of code, because it looks efficient. Centre your data first, or use Welford's online algorithm, which is one pass <i>and</i> stable.`,
      readouts: [
        { key: 'off', label: 'constant added', tone: 'gold', get: s => Math.pow(10, +s.shift), fmt: v => bignum(v), wide: true },
        { key: 'good', label: 'two-pass variance', tone: 'green', get: s => goodVar(shifted(s)), d: 6, wide: true },
        { key: 'bad', label: 'one-pass variance', tone: 'warm', get: s => naiveVar(shifted(s)), d: 6, wide: true },
        { key: 'err', label: 'relative error', tone: 'cold', wide: true, get: s => {
          const g = goodVar(shifted(s));
          return Math.abs(naiveVar(shifted(s)) - g) / g * 100;
        }, d: 4, suf: '%' },
      ],
      controls: [
        { type: 'slider', key: 'shift', label: 'add 10^k to every value', min: 0, max: 12, step: 0.5, fast: true, fmt: v => '10^' + (+v).toFixed(1) },
      ],
      beats: [
        {
          label: 'the two answers diverge',
          note: 'Shifting the data cannot change its spread. The green line knows that. The warm one falls apart, and eventually reports a <b>negative variance</b>.',
          scene: s => {
            const f = F();
            f.setX(0, 12);
            f.setY(-0.4, 0.9);
            return [
              ...axes(f, { xLabel: 'size of the constant added (powers of ten)', yLabel: 'computed variance', yN: 5 }),
              hLine(f, goodVar(shifted({ shift: 0 })), { key: 'true', cls: 'rule-gold rule-dash' }),
              label('tl', f.x0 + 10, f.sy(goodVar(shifted({ shift: 0 }))) - 10, 'the correct answer', { cls: 'lab-sm lab-gold' }),
              hLine(f, 0, { key: 'z', cls: 'ax-line' }),
              fnPath(f, k => clamp(goodVar(shifted({ shift: k })), -0.4, 0.9), { key: 'g', cls: 'curve curve-fit', n: 120 }),
              fnPath(f, k => clamp(naiveVar(shifted({ shift: k })), -0.4, 0.9), { key: 'b', cls: 'curve curve-warm', n: 240 }),
              vLine(f, +s.shift, { key: 'now', cls: 'rule-x', dur: 200 }),
              label('lg', f.x1 - 8, f.y1 + 10, 'two-pass', { cls: 'lab-sm lab-end lab-green' }),
              label('lb', f.x1 - 8, f.y1 + 30, 'one-pass', { cls: 'lab-sm lab-end lab-warm' }),
              label('n', 376, f.y0 - 14,
                naiveVar(shifted(s)) < 0 ? 'the one-pass formula is now reporting a negative variance'
                  : Math.abs(naiveVar(shifted(s)) - goodVar(shifted(s))) / goodVar(shifted(s)) > 0.01
                    ? 'the one-pass answer is already wrong in the second digit'
                    : 'both agree — for now',
                { cls: `lab lab-mid ${naiveVar(shifted(s)) < 0 ? 'lab-warm' : ''}`, dur: 200 }),
            ];
          },
        },
        {
          label: 'where the digits go',
          hold: 2000,
          note: 'The two quantities being subtracted agree in more and more leading digits. Everything they share cancels, and what is left is the rounding error.',
          scene: s => {
            const xs = shifted(s);
            let sum = 0, ss = 0;
            for (const v of xs) { sum += v; ss += v * v; }
            const a = ss, b = (sum * sum) / xs.length;
            const shared = sharedDigits(a, b);
            return [
              label('t', 376, 100, 'the subtraction that destroys the answer', { cls: 'lab-big lab-mid' }),
              label('l1', 90, 180, 'Σx²', { cls: 'lab lab-warm' }),
              label('v1', 660, 180, a.toPrecision(17), { cls: 'lab lab-end', dur: 200 }),
              label('l2', 90, 226, '(Σx)²/n', { cls: 'lab lab-cold' }),
              label('v2', 660, 226, b.toPrecision(17), { cls: 'lab lab-end', dur: 200 }),
              { key: 'rule', tag: 'line', cls: 'rule-faint', attrs: { x1: 90, y1: 248, x2: 660, y2: 248 } },
              label('l3', 90, 288, 'difference', { cls: 'lab lab-gold' }),
              label('v3', 660, 288, (a - b).toPrecision(17), { cls: 'lab-big lab-end lab-gold', dur: 200 }),
              rect('bar', 90, 340, 570, 30, { cls: 'cell' }),
              rect('lost', 90, 340, 570 * clamp(shared / 17, 0, 1), 30, { cls: 'sq sq-neg', dur: 260 }),
              label('bl', 90, 392, `${shared} of the 17 available digits cancelled`, { cls: 'lab lab-warm', dur: 260 }),
              label('bl2', 660, 392, `${Math.max(0, 17 - shared)} digits of real answer left`, { cls: 'lab lab-end lab-green', dur: 260 }),
              label('n', 376, 470,
                shared > 13 ? 'there is essentially nothing left but noise'
                  : 'still enough digits to survive — for now',
                { cls: 'lab lab-mid', dur: 260 }),
            ];
          },
        },
      ],
    },

    {
      title: 'why statisticians live in log space',
      prose: `<p>A likelihood is a product of one term per observation. With a thousand observations, each contributing a probability of maybe 0.1, the product is 10<sup>−1000</sup> — which a double cannot represent at all. It becomes exactly zero, and every comparison downstream becomes 0 ÷ 0.</p>
        <p>The fix is the same one from the algebra lesson: <strong>take logs, and multiplication becomes addition</strong>. Adding a thousand numbers around −2.3 gives −2300, which is a perfectly ordinary double.</p>
        <p>This is why every model on this site optimises a <em>log</em>-likelihood, why the GLM lesson tracks deviance, and why the MCMC lesson compares log posteriors rather than posteriors.</p>`,
      formula: formula(
        t('∏ p', { tone: 'warm' }) + sub('', 'i') + op('&nbsp;→&nbsp;underflows to 0') +
        op('&nbsp;&nbsp;&nbsp;&nbsp;') +
        t('Σ log p', { tone: 'green' }) + sub('', 'i') + op('&nbsp;→&nbsp;perfectly fine'),
        { size: 'sm', caption: 'the same quantity, in a representation the machine can hold' }),
      dep: { note: 'Logs turning products into sums is the inverse-function lesson.', lesson: 'algebra', label: 'algebra & inverses' },
      readouts: [
        { key: 'n', label: 'observations', tone: 'gold', get: s => +s.terms, d: 0 },
        { key: 'prod', label: 'the product', tone: 'warm', wide: true, get: s => {
          let p = 1;
          for (let i = 0; i < +s.terms; i++) p *= 0.1;
          return p === 0 ? 'underflowed to 0' : p.toExponential(2);
        } },
        { key: 'log', label: 'the log-sum', tone: 'green', get: s => +s.terms * Math.log(0.1), d: 2, wide: true },
        { key: 'ok', label: 'usable?', wide: true, get: s => (+s.terms > 323 ? 'product is gone; log is fine' : 'both still work') },
      ],
      controls: [
        { type: 'slider', key: 'terms', label: 'number of observations', min: 1, max: 800, step: 1, fast: true },
      ],
      beats: [
        {
          label: 'the cliff',
          note: 'Around 323 terms the product hits the smallest number a double can hold and drops to exactly zero. <b>The log-sum does not notice anything happening.</b>',
          scene: s => {
            const f = F();
            f.setX(1, 800); f.setY(-900, 60);
            const prodLog = n => { let p = 1; for (let i = 0; i < n; i++) p *= 0.1; return p === 0 ? -900 : Math.log10(p) * 2.303; };
            return [
              ...axes(f, { xLabel: 'number of observations multiplied', yLabel: 'log of the value', yN: 5 }),
              fnPath(f, n => Math.max(-900, n * Math.log(0.1)), { key: 'l', cls: 'curve curve-fit', n: 120 }),
              fnPath(f, n => prodLog(Math.round(n)), { key: 'p', cls: 'curve curve-warm', n: 400 }),
              vLine(f, 323, { key: 'cliff', cls: 'rule-gold rule-dash' }),
              label('cl', f.sx(323), f.y1 + 10, 'the smallest double', { cls: 'lab-sm lab-mid lab-gold' }),
              vLine(f, +s.terms, { key: 'now', cls: 'rule-x', dur: 200 }),
              label('lg', f.x1 - 8, f.y1 + 30, 'Σ log p — a straight line forever', { cls: 'lab-sm lab-end lab-green' }),
              label('lp', f.x1 - 8, f.y0 - 12, '∏ p — falls off a cliff', { cls: 'lab-sm lab-end lab-warm' }),
            ];
          },
        },
        {
          label: 'the log-sum-exp trick',
          note: 'Sometimes you do need the sum of probabilities, not their product. Factor out the biggest one first and the exponentials stay in range.',
          scene: () => {
            const items = [
              label('t', 376, 100, 'when you must add probabilities you only have in logs', { cls: 'lab lab-mid' }),
              label('bad', 376, 180, 'log( e^a + e^b + e^c )', { cls: 'lab-big lab-mid lab-warm' }),
              label('badl', 376, 208, 'exponentiating first — each term overflows or underflows', { cls: 'lab-sm lab-mid' }),
              path('arr', [[376, 240], [376, 290]], { cls: 'arrow' }),
              label('good', 376, 330, 'm + log( e^(a−m) + e^(b−m) + e^(c−m) )', { cls: 'lab-big lab-mid lab-green' }),
              label('goodl', 376, 358, 'with m = the largest — now the biggest term is exactly e⁰ = 1', { cls: 'lab-sm lab-mid' }),
              label('n', 376, 430, 'identical algebra · completely different behaviour on a machine', { cls: 'lab lab-mid lab-gold' }),
              label('n2', 376, 462, 'you will find this inside every softmax and every mixture model', { cls: 'lab-sm lab-mid' }),
            ];
            return items;
          },
        },
      ],
    },

    {
      title: 'nothing here is random',
      prose: `<p>Every "random" number on this site — every bootstrap resample, every MCMC proposal, every simulated dataset — came from a deterministic function. Give it the same starting number and it produces the identical sequence, forever.</p>
        <p>That starting number is the <strong>seed</strong>, and it is the single most useful reproducibility tool you have. Set it and your analysis gives the same answer tomorrow, on someone else's machine, in the reviewer's hands.</p>
        <p>It is also a trap worth naming: because the seed is a choice, it can be <em>tried</em>. Running your bootstrap under twenty seeds and reporting the friendliest one is p-hacking with extra steps.</p>`,
      formula: formula(
        sub('x', 'n+1') + eq + 'f' + paren(sub('x', 'n')) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') +
        t('same seed → same sequence → same answer', { tone: 'green' }),
        { size: 'sm', caption: 'a very elaborate deterministic function that looks like noise' }),
      aside: `<b>What "looks random" means.</b> A good generator produces sequences that pass statistical tests for randomness — uniform, uncorrelated, no detectable period at any scale you will use. That is enough for simulation. It is <i>not</i> enough for cryptography, where an adversary is actively trying to predict the next value, and it is not enough for the mixed strategies in the game theory lesson if your opponent can see your code.`,
      readouts: [
        { key: 'seed', label: 'seed', tone: 'gold', get: s => +s.seed, d: 0 },
        { key: 'd1', label: 'first draw', tone: 'cyan', get: s => st.rng(+s.seed)(), d: 6, wide: true },
        { key: 'mean', label: 'mean of 5000 draws', tone: 'green', get: s => {
          const r = st.rng(+s.seed);
          return st.mean(range(5000).map(() => r()));
        }, d: 4, wide: true },
        { key: 'again', label: 'run it again', tone: 'muted', get: s => st.rng(+s.seed)(), d: 6, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'seed', label: 'seed', min: 1, max: 60, step: 1, fast: true },
      ],
      beats: [
        {
          label: 'the same seed, twice',
          hold: 1800,
          note: 'Two independent runs of the generator with the same seed. Identical, digit for digit. <b>Change the seed and both change together.</b>',
          scene: s => {
            const r1 = st.rng(+s.seed), r2 = st.rng(+s.seed);
            const a = range(8).map(() => r1()), b = range(8).map(() => r2());
            const items = [
              label('t', 376, 100, `seed = ${s.seed}`, { cls: 'lab-big lab-mid lab-gold', dur: 200 }),
              label('h1', 250, 150, 'first run', { cls: 'lab lab-mid lab-cyan' }),
              label('h2', 500, 150, 'second run', { cls: 'lab lab-mid lab-green' }),
            ];
            a.forEach((v, i) => {
              const y = 190 + i * 34;
              items.push(label(`a-${i}`, 250, y, v.toFixed(8), { cls: 'lab lab-mid', dur: 200 }));
              items.push(label(`b-${i}`, 500, y, b[i].toFixed(8), { cls: 'lab lab-mid', dur: 200 }));
            });
            items.push(label('n', 376, 490, 'not similar — identical', { cls: 'lab lab-mid lab-green' }));
            return items;
          },
        },
        {
          label: 'it still passes for random',
          note: 'Five thousand draws. Flat histogram, no correlation between consecutive values. Deterministic, and indistinguishable from noise by any test you would run.',
          scene: s => {
            const r = st.rng(+s.seed);
            const draws = range(5000).map(() => r());
            const f = F();
            f.setX(0, 1);
            const bins = st.histogram(draws, 40, [0, 1]);
            f.setY(0, Math.max(...bins.map(b => b.density)) * 1.3);
            const lag = st.pearson(draws.slice(0, -1), draws.slice(1));
            return [
              ...axes(f, { xLabel: 'value', yLabel: 'density', yN: 4 }),
              ...histBars(f, bins, { key: 'h', cls: 'bar bar-cold', useDensity: true, dur: 240 }),
              hLine(f, 1, { key: 'flat', cls: 'rule-gold rule-dash' }),
              label('fl', f.x1 - 6, f.sy(1) - 10, 'perfectly uniform would be flat here', { cls: 'lab-sm lab-end lab-gold' }),
              label('n', 376, f.y1 + 6,
                `correlation between consecutive draws: ${st.fmtR(lag, 4)}`, { cls: 'lab-big lab-mid lab-green', dur: 240 }),
              label('n2', 376, f.y1 + 28, 'no memory of the previous value, and yet fully determined by the seed', { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
      ],
    },

    {
      title: 'the short list',
      prose: `<p>Five habits that come out of the above, and cost nothing to adopt.</p>
        <ul>
          <li><strong>Centre before you square.</strong> Any time you compute a variance, covariance, or sum of squares on data that lives far from zero, subtract the mean first.</li>
          <li><strong>Work in logs.</strong> If you are multiplying probabilities, add their logarithms instead. Always.</li>
          <li><strong>Set the seed, once, at the top.</strong> Not per-function, not per-run, and never chosen after seeing results.</li>
          <li><strong>Never test floats for equality.</strong> <span class="cs-inline-code">0.1 + 0.2 === 0.3</span> is false in every language that uses doubles. Compare with a tolerance.</li>
          <li><strong>Know which loop is the n².</strong> When something is slow, it is almost always one nested loop or one matrix inversion, and almost never the language.</li>
        </ul>`,
      readouts: [
        { key: 'eq', label: '0.1 + 0.2', tone: 'warm', get: () => 0.1 + 0.2, d: 17, wide: true },
        { key: 'is', label: '=== 0.3 ?', tone: 'cold', get: () => (0.1 + 0.2 === 0.3 ? 'true' : 'false'), wide: true },
        { key: 'diff', label: 'off by', tone: 'gold', get: () => Math.abs(0.1 + 0.2 - 0.3), fmt: v => v.toExponential(2), wide: true },
      ],
      beats: [
        {
          label: 'the classic',
          note: 'Not a bug in any language. Neither 0.1 nor 0.2 exists exactly in binary, so their sum cannot either.',
          scene: () => [
            label('t', 376, 140, '0.1 + 0.2', { cls: 'lab-big lab-mid lab-cyan' }),
            path('arr', [[376, 170], [376, 215]], { cls: 'arrow' }),
            label('v', 376, 250, (0.1 + 0.2).toPrecision(20), { cls: 'lab-big lab-mid lab-warm' }),
            label('n', 376, 290, 'not 0.3', { cls: 'lab lab-mid lab-gold' }),
            rect('box', 100, 330, 552, 130, { cls: 'cell' }),
            label('e1', 376, 366, 'one tenth in binary is 0.0001100110011001100…', { cls: 'lab lab-mid' }),
            label('e2', 376, 394, 'repeating forever, exactly like 1/3 in decimal', { cls: 'lab lab-mid' }),
            label('e3', 376, 428, 'the machine stores the closest double it has, and the error survives the addition',
              { cls: 'lab-sm lab-mid lab-muted' }),
          ],
        },
      ],
    },
  ],
};

/* ── helpers ──────────────────────────────────────────────────────────────── */

function bignum(v) {
  if (!isFinite(v)) return '—';
  if (v >= 1e15) return v.toExponential(1);
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'bn';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'k';
  return v < 10 ? v.toFixed(1) : String(Math.round(v));
}

function humanTime(sec) {
  if (sec < 1e-6) return 'instant';
  if (sec < 1) return (sec * 1000).toFixed(1) + ' ms';
  if (sec < 60) return sec.toFixed(1) + ' s';
  if (sec < 3600) return (sec / 60).toFixed(1) + ' min';
  if (sec < 86400 * 365) return (sec / 3600).toFixed(1) + ' hours';
  return (sec / (86400 * 365)).toFixed(1) + ' years';
}

/** how many leading significant digits two numbers share */
function sharedDigits(a, b) {
  if (a === b) return 17;
  const rel = Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-300);
  return clamp(Math.round(-Math.log10(Math.max(rel, 1e-17))), 0, 17);
}
