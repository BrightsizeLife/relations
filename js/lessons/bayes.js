/* ─────────────────────────────────────────────────────────────────────────────
   bayes.js — updating. A belief, some evidence, a multiplication, a new belief.
   Drawn as an actual multiplication of two curves.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, fnArea, arrowDefs } from '../core/plot.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sub, sup, paren, eq, minus, times, op } from '../core/fx.js';

const F = () => frame({ w: 720, h: 540, l: 66, r: 28, t: 34, b: 58 });

/* a fixed coin-flip sequence, revealed one at a time */
const FLIPS = (() => {
  const r = st.rng(1763); // Bayes' essay was read to the Royal Society in 1763
  return range(40).map(() => (r() < 0.68 ? 1 : 0));
})();

const PRIORS = {
  flat: { a: 1, b: 1, label: 'no idea', note: 'every proportion equally plausible' },
  fair: { a: 20, b: 20, label: 'probably fair', note: 'a strong belief that it is a normal coin' },
  weak: { a: 3, b: 3, label: 'mildly fair', note: 'leaning fair, easily talked out of it' },
  skept: { a: 2, b: 8, label: 'suspect it is biased low', label2: 'biased low', note: 'expecting tails' },
};

function post(s) {
  const pr = PRIORS[s.prior];
  const seen = FLIPS.slice(0, s.k);
  const h = st.sum(seen), n = seen.length;
  return { a: pr.a + h, b: pr.b + (n - h), h, n, pr };
}

const postMean = s => { const p = post(s); return p.a / (p.a + p.b); };

/** highest-density-ish credible interval via the beta quantile, by bisection */
function credible(a, b, conf = 0.95) {
  const cdf = x => st.ibeta(a, b, x);
  const inv = p => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (cdf(m) < p) lo = m; else hi = m; }
    return (lo + hi) / 2;
  };
  return [inv((1 - conf) / 2), inv(1 - (1 - conf) / 2)];
}

export default {
  meta: {
    id: 'bayes', title: 'bayesian basics', kicker: 'UPDATING',
    status: 'live',
    deck: 'Everywhere else on this site, a parameter is a fixed unknown number and the <em>data</em> is random. Here it is the other way round: the data is what it is, and the uncertainty lives in a distribution over the parameter. That one swap changes what every answer means.',
    dataNote: 'The coin sequence is <em>simulated</em> in your browser from a fixed seed, so the flips are reproducible and you can reveal them one at a time. The diagnostic-test panel uses illustrative but realistic figures, stated on the page.',
    deps: [], unlocks: ['mcmc'],
    next: 'mcmc', nextLabel: 'markov chains & mcmc',
    outro: 'prior times likelihood, normalised. everything else is computation.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { prior: 'weak', k: 0, conf: 95, base: 1, sens: 90, spec: 95 },

  steps: [
    {
      title: 'a belief, drawn as a shape',
      prose: `<p>Someone hands you a coin and asks how likely it is to land heads. You don't know — but you're not completely ignorant either. Most coins are close to fair.</p>
        <p>A Bayesian starts by writing that down as a <strong>distribution over the unknown</strong>. Not a single guess, a whole curve: how plausible is each possible value of the bias?</p>
        <p><strong>Try the different priors.</strong> Flat says you'll believe anything. The tall narrow one says you'd take a lot of convincing.</p>`,
      formula: formula(
        t('p(θ)', { tone: 'cyan', explain: 'The prior: what you believed before seeing any data.' }) +
        op('&nbsp;&nbsp;—&nbsp;&nbsp;') + 'a Beta(α, β) here, because it is the natural shape for a proportion',
        { size: 'sm', caption: 'the whole curve is the belief, not just its peak' }),
      readouts: [
        { key: 'a', label: 'α', tone: 'cyan', get: s => PRIORS[s.prior].a, d: 0 },
        { key: 'b', label: 'β', tone: 'cyan', get: s => PRIORS[s.prior].b, d: 0 },
        { key: 'm', label: 'prior mean', tone: 'gold', get: s => PRIORS[s.prior].a / (PRIORS[s.prior].a + PRIORS[s.prior].b), d: 3, wide: true },
        { key: 'strength', label: 'worth this many flips', tone: 'green', wide: true, get: s => PRIORS[s.prior].a + PRIORS[s.prior].b - 2, d: 0, explain: 'A Beta(α, β) prior carries the same weight as α+β−2 previously observed flips. That is a useful way to keep yourself honest about how strong a prior really is.' },
      ],
      controls: [
        { type: 'segment', key: 'prior', label: 'prior', options: Object.entries(PRIORS).map(([k, v]) => ({ value: k, label: v.label2 || v.label })) },
      ],
      beats: [
        {
          label: 'the prior',
          note: 'The height at each point is how plausible you find that bias, before any evidence.',
          scene: s => {
            const pr = PRIORS[s.prior];
            const f = F();
            f.setX(0, 1);
            f.setY(0, Math.max(2.2, st.betaPdf(pr.a / (pr.a + pr.b), pr.a, pr.b) * 1.15));
            return [
              ...axes(f, { xLabel: 'θ — the coin\'s probability of heads', yLabel: 'plausibility', yN: 4 }),
              fnArea(f, x => st.betaPdf(x, pr.a, pr.b), 0.001, 0.999, { key: 'a', cls: 'area area-cold', base: 0, dur: 300 }),
              fnPath(f, x => st.betaPdf(x, pr.a, pr.b), { key: 'c', cls: 'curve curve-cyan', n: 240, dur: 300 }),
              vLine(f, 0.5, { key: 'h', cls: 'rule-faint rule-dash' }),
              label('hl', f.sx(0.5), f.y1 + 10, 'a fair coin', { cls: 'lab-sm lab-mid' }),
              label('nt', f.midX, f.y0 - 14, pr.note, { cls: 'lab lab-mid lab-cyan', dur: 300 }),
            ];
          },
        },
      ],
    },

    {
      title: 'the evidence, drawn as another shape',
      prose: `<p>Now flip the coin. Each flip is a fact, and every possible bias has an opinion about how likely that fact was.</p>
        <p>The <strong>likelihood</strong> is that opinion drawn as a curve: for each candidate value of θ, how probable was the data we actually got? A run of heads makes high values of θ look good and low values look silly.</p>
        <p>Note the likelihood is <em>not</em> a probability distribution over θ. It doesn't have to integrate to 1 and it usually doesn't. It's a score, evaluated for every candidate.</p>`,
      formula: formula(
        t('p(data | θ)', { tone: 'warm', explain: 'The likelihood: how well each candidate value of θ explains what you saw.' }) +
        op('&nbsp;∝&nbsp;') + t('θ', { tone: 'warm' }) + sup('', 'heads') + ' ' +
        paren('1 ' + minus + ' ' + t('θ', { tone: 'warm' })) + sup('', 'tails'),
        { caption: 'read left to right: given a coin with bias θ, how likely was this sequence?' }),
      readouts: [
        { key: 'k', label: 'flips seen', tone: 'gold', get: s => s.k, d: 0 },
        { key: 'h', label: 'heads', tone: 'warm', get: s => post(s).h, d: 0 },
        { key: 'p', label: 'proportion', tone: 'green', get: s => (post(s).n ? post(s).h / post(s).n : 0.5), d: 3, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'k', label: 'flips revealed', min: 0, max: 40, step: 1, fast: true },
      ],
      beats: [
        {
          label: 'the likelihood',
          note: 'Reveal flips one at a time. The curve sharpens as the data starts ruling candidates out.',
          scene: s => {
            const p = post(s);
            const f = F();
            f.setX(0, 1);
            const lik = x => (p.n === 0 ? 1 : Math.exp(p.h * Math.log(Math.max(x, 1e-9)) + (p.n - p.h) * Math.log(Math.max(1 - x, 1e-9))));
            const mx = p.n === 0 ? 1 : lik(p.h / p.n);
            f.setY(0, mx * 1.2);
            return [
              ...axes(f, { xLabel: 'θ', yLabel: 'likelihood of the data', yN: 3, yFmt: () => '' }),
              fnArea(f, lik, 0.001, 0.999, { key: 'a', cls: 'area area-warm', base: 0, dur: 240 }),
              fnPath(f, lik, { key: 'c', cls: 'curve curve-warm', n: 240, dur: 240 }),
              ...(p.n ? [
                vLine(f, p.h / p.n, { key: 'mle', cls: 'rule-gold rule-dash', dur: 240 }),
                label('ml', f.sx(p.h / p.n), f.y1 + 10,
                  `best-supported θ = ${(p.h / p.n).toFixed(3)}`, { cls: 'lab lab-mid lab-gold', dur: 240 }),
              ] : [label('none', f.midX, f.midY, 'no data yet — every θ explains it equally well', { cls: 'lab lab-mid' })]),
              ...FLIPS.slice(0, s.k).map((v, i) => ({
                key: `fl-${i}`, tag: 'circle', cls: v ? 'pt pt-warm' : 'pt pt-cold',
                attrs: { cx: f.x0 + 14 + (i % 20) * 16, cy: f.y1 - 22 + Math.floor(i / 20) * 15, r: 5 },
                tip: `flip ${i + 1}: <b>${v ? 'heads' : 'tails'}</b>`,
              })),
            ];
          },
        },
      ],
    },

    {
      title: 'multiply them',
      prose: `<p>Bayes' rule is a multiplication. Point by point along the θ axis: take the prior height, take the likelihood height, multiply. Then divide everything by the total so it integrates to 1 again.</p>
        <p>That's it. The denominator — the "evidence" — does no work in shaping the answer; it's just the constant that rescales the product back into a proper distribution. Which is convenient, because it's also the part that's hard to compute, and the reason MCMC exists.</p>
        <p><strong>Watch the posterior get dragged.</strong> Where prior and likelihood agree, the product is tall. Where either says "no", the product collapses.</p>`,
      formula: formula(
        t('p(θ | data)', { tone: 'green', explain: 'The posterior: what you believe now.' }) + eq +
        frac(t('p(data | θ)', { tone: 'warm' }) + ' · ' + t('p(θ)', { tone: 'cyan' }),
          t('p(data)', { tone: 'muted', explain: 'The evidence — just a normalising constant. It has no effect on the shape.' })) +
        op('&nbsp;&nbsp;∝&nbsp;&nbsp;') + t('likelihood', { tone: 'warm' }) + ' × ' + t('prior', { tone: 'cyan' }),
        { caption: 'posterior ∝ likelihood × prior' }),
      readouts: [
        { key: 'k', label: 'flips', tone: 'gold', get: s => s.k, d: 0 },
        { key: 'pm', label: 'prior mean', tone: 'cyan', get: s => PRIORS[s.prior].a / (PRIORS[s.prior].a + PRIORS[s.prior].b), d: 3, wide: true },
        { key: 'data', label: 'data says', tone: 'warm', get: s => (post(s).n ? post(s).h / post(s).n : NaN), d: 3, wide: true },
        { key: 'post', label: 'posterior mean', tone: 'green', get: s => postMean(s), d: 3, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'k', label: 'flips revealed', min: 0, max: 40, step: 1, fast: true },
        { type: 'segment', key: 'prior', label: 'prior', options: Object.entries(PRIORS).map(([k, v]) => ({ value: k, label: v.label2 || v.label })) },
      ],
      beats: [
        {
          label: 'all three curves',
          note: 'Blue is what you thought. Warm is what the data says. <b>Green is where you end up</b> — always between the two, pulled toward whichever is more confident.',
          scene: s => {
            const p = post(s);
            const f = F();
            f.setX(0, 1);
            const peak = Math.max(
              st.betaPdf(clamp(p.pr.a / (p.pr.a + p.pr.b), 0.01, 0.99), p.pr.a, p.pr.b),
              st.betaPdf(clamp((p.a - 1) / (p.a + p.b - 2) || 0.5, 0.01, 0.99), p.a, p.b));
            f.setY(0, peak * 1.15);
            const lik = x => (p.n === 0 ? 1 : Math.exp(p.h * Math.log(Math.max(x, 1e-9)) + (p.n - p.h) * Math.log(Math.max(1 - x, 1e-9))));
            const likMax = p.n === 0 ? 1 : lik(clamp(p.h / p.n, 0.001, 0.999));
            const likScaled = x => (lik(x) / likMax) * peak * 0.8;
            return [
              ...axes(f, { xLabel: 'θ — probability of heads', yLabel: 'plausibility', yN: 4 }),
              fnPath(f, x => st.betaPdf(x, p.pr.a, p.pr.b), { key: 'pri', cls: 'curve curve-cyan', n: 220, dur: 240 }),
              fnPath(f, likScaled, { key: 'lik', cls: 'curve curve-warm curve-dash', n: 220, dur: 240 }),
              fnArea(f, x => st.betaPdf(x, p.a, p.b), 0.001, 0.999, { key: 'pa', cls: 'area area-green', base: 0, dur: 240 }),
              fnPath(f, x => st.betaPdf(x, p.a, p.b), { key: 'pos', cls: 'curve curve-fit', n: 220, dur: 240 }),
              label('l1', f.x0 + 10, f.y1 + 10, 'prior', { cls: 'lab lab-cyan' }),
              label('l2', f.x0 + 10, f.y1 + 28, 'likelihood (rescaled to fit)', { cls: 'lab lab-warm' }),
              label('l3', f.x0 + 10, f.y1 + 46, 'posterior', { cls: 'lab lab-green' }),
              vLine(f, postMean(s), { key: 'pm', cls: 'rule-gold rule-dash', dur: 240 }),
              numLabel('pml', f.sx(postMean(s)), f.y0 - 12, postMean(s), { cls: 'lab lab-mid lab-gold', d: 3, pre: 'posterior mean = ', dur: 240 }),
            ];
          },
        },
        {
          label: 'the prior stops mattering',
          hold: 1900,
          note: 'All four priors, updated on the same data. With 5 flips they disagree wildly. With 40 they have almost converged. <b>Evidence beats opinion, eventually.</b>',
          scene: s => {
            const f = F();
            f.setX(0, 1);
            const keys = Object.keys(PRIORS);
            const posts = keys.map(k => post({ ...s, prior: k }));
            const peak = Math.max(...posts.map(p => st.betaPdf(clamp((p.a - 1) / (p.a + p.b - 2) || 0.5, 0.01, 0.99), p.a, p.b)));
            f.setY(0, peak * 1.15);
            return [
              ...axes(f, { xLabel: 'θ', yLabel: 'posterior plausibility', yN: 4 }),
              ...posts.map((p, i) => fnPath(f, x => st.betaPdf(x, p.a, p.b), {
                key: `c-${i}`, cls: `curve ${['curve-cyan', 'curve-warm', 'curve-purple', 'curve-fit'][i]}`, n: 220, dur: 240,
              })),
              ...keys.map((k, i) => label(`l-${i}`, f.x1 - 8, f.y1 + 10 + i * 18,
                PRIORS[k].label2 || PRIORS[k].label,
                { cls: `lab-sm lab-end ${['lab-cyan', 'lab-warm', 'lab-purple', 'lab-green'][i]}` })),
              label('k', f.x0 + 10, f.y1 + 10, `after ${s.k} flip${s.k === 1 ? '' : 's'}`, { cls: 'lab-big lab-gold', dur: 240 }),
              ...(s.k >= 30 ? [label('cv', f.midX, f.y0 - 14, 'the priors have washed out', { cls: 'lab lab-mid lab-green' })] : []),
            ];
          },
        },
      ],
    },

    {
      title: 'a credible interval means what people think a confidence interval means',
      prose: `<p>This is the payoff, and it's worth being precise about.</p>
        <p>A 95% <em>confidence</em> interval is a statement about a procedure: if you repeated the study forever, 95% of the intervals you built this way would contain the true value. This particular one either does or doesn't.</p>
        <p>A 95% <em>credible</em> interval is a statement about the parameter: given your prior and this data, there is a 95% probability that θ is in here. That's the sentence everyone wants to say about a confidence interval and isn't allowed to.</p>
        <p>You buy that directly by having a distribution over θ in the first place. The price is that you had to supply a prior.</p>`,
      formula: formula(
        'P' + paren(t('a ≤ θ ≤ b', { tone: 'green' }) + ' | data') + eq + '0.95' +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('a statement about θ, not about intervals', { cls: 'fx-muted' }),
        { size: 'sm', caption: 'the thing you actually wanted' }),
      readouts: [
        { key: 'k', label: 'flips', tone: 'gold', get: s => s.k, d: 0 },
        { key: 'm', label: 'posterior mean', tone: 'green', get: s => postMean(s), d: 3, wide: true },
        { key: 'lo', label: 'lower', tone: 'cold', get: s => { const p = post(s); return credible(p.a, p.b, s.conf / 100)[0]; }, d: 3 },
        { key: 'hi', label: 'upper', tone: 'warm', get: s => { const p = post(s); return credible(p.a, p.b, s.conf / 100)[1]; }, d: 3 },
        { key: 'pfair', label: 'P(θ > ½ | data)', tone: 'gold', wide: true, get: s => { const p = post(s); return (1 - st.ibeta(p.a, p.b, 0.5)) * 100; }, d: 1, suf: '%', explain: 'A question a frequentist interval cannot answer at all, computed here by reading off an area.' },
      ],
      controls: [
        { type: 'slider', key: 'k', label: 'flips revealed', min: 1, max: 40, step: 1, fast: true },
        { type: 'segment', key: 'conf', label: 'credible level', options: [{ value: 80, label: '80%' }, { value: 90, label: '90%' }, { value: 95, label: '95%' }, { value: 99, label: '99%' }] },
      ],
      beats: [
        {
          label: 'shade the middle 95%',
          note: 'The interval is just an area under the posterior. So is any other question you want to ask — including "is it biased at all?"',
          scene: s => {
            const p = post(s);
            const [lo, hi] = credible(p.a, p.b, s.conf / 100);
            const f = F();
            f.setX(0, 1);
            f.setY(0, st.betaPdf(clamp((p.a - 1) / (p.a + p.b - 2) || 0.5, 0.01, 0.99), p.a, p.b) * 1.18);
            return [
              ...axes(f, { xLabel: 'θ', yLabel: 'posterior', yN: 4 }),
              fnArea(f, x => st.betaPdf(x, p.a, p.b), lo, hi, { key: 'ci', cls: 'area area-green', base: 0, dur: 240 }),
              fnPath(f, x => st.betaPdf(x, p.a, p.b), { key: 'c', cls: 'curve curve-fit', n: 240, dur: 240 }),
              vLine(f, lo, { key: 'lo', cls: 'rule-gold', dur: 240 }),
              vLine(f, hi, { key: 'hi', cls: 'rule-gold', dur: 240 }),
              vLine(f, 0.5, { key: 'half', cls: 'rule-faint rule-dash' }),
              numLabel('lol', f.sx(lo), f.y1 + 12, lo, { cls: 'lab lab-mid lab-cold', d: 3, dur: 240 }),
              numLabel('hil', f.sx(hi), f.y1 + 12, hi, { cls: 'lab lab-mid lab-warm', d: 3, dur: 240 }),
              label('cap', f.midX, f.y0 - 14,
                `${s.conf}% of the posterior sits between these lines`, { cls: 'lab lab-mid lab-green' }),
            ];
          },
        },
      ],
    },

    {
      title: 'the base rate, which everyone gets wrong',
      prose: `<p>One more use of the same rule, and the one with the highest stakes.</p>
        <p>A test for a rare condition is 90% sensitive and 95% specific. You test positive. What's the chance you have it?</p>
        <p>Most people — including, in repeated studies, most doctors — say something near 90%. The correct answer depends entirely on how rare the condition is, and with a prevalence of 1% it's about <strong>15%</strong>.</p>
        <p>The reason is visible in the grid: when the condition is rare, the small false-positive rate applies to an enormous number of healthy people, and those false positives swamp the true ones. <strong>Slide the prevalence</strong> and watch the answer swing.</p>`,
      formula: formula(
        'P(sick | +) ' + eq +
        frac(t('sensitivity', { tone: 'green' }) + ' × ' + t('prevalence', { tone: 'gold' }),
          t('sensitivity', { tone: 'green' }) + ' × ' + t('prevalence', { tone: 'gold' }) + ' + ' +
          paren('1 − ' + t('specificity', { tone: 'cold' })) + ' × ' + paren('1 − ' + t('prevalence', { tone: 'gold' }))),
        { size: 'sm', caption: 'the prior is the prevalence. ignoring it is the base rate fallacy.' }),
      aside: `<b>This is not a puzzle about arithmetic.</b> It is the same prior-times-likelihood we just drew, applied to two categories instead of a continuum. The test result is the likelihood; the prevalence is the prior. Skip the prior and you will be confidently wrong about a medical result, a screening programme, or a fraud alert.`,
      readouts: [
        { key: 'prev', label: 'prevalence', tone: 'gold', get: s => +s.base, d: 1, suf: '%' },
        { key: 'sens', label: 'sensitivity', tone: 'green', get: s => +s.sens, d: 0, suf: '%' },
        { key: 'spec', label: 'specificity', tone: 'cold', get: s => +s.spec, d: 0, suf: '%' },
        { key: 'ppv', label: 'P(sick | positive)', tone: 'warm', wide: true, get: s => ppv(s) * 100, d: 1, suf: '%' },
        { key: 'npv', label: 'P(well | negative)', tone: 'cyan', wide: true, get: s => npv(s) * 100, d: 1, suf: '%' },
      ],
      controls: [
        { type: 'slider', key: 'base', label: 'prevalence', min: 0.1, max: 50, step: 0.1, fast: true, fmt: v => (+v).toFixed(1) + '%' },
        { type: 'slider', key: 'sens', label: 'sensitivity', min: 50, max: 100, step: 1, fast: true, fmt: v => v + '%' },
        { type: 'slider', key: 'spec', label: 'specificity', min: 50, max: 100, step: 1, fast: true, fmt: v => v + '%' },
      ],
      beats: [
        {
          label: 'ten thousand people',
          note: 'Each square is one person. Warm = has the condition. The ring marks everyone who tested positive — count how many of those rings are on healthy people.',
          scene: s => {
            const N = 2500, cols = 50;
            const prev = s.base / 100, sens = s.sens / 100, spec = s.spec / 100;
            const sick = Math.round(N * prev);
            const cell = 9.6, x0 = 150, y0 = 60;
            const items = [];
            const r = st.rng(99);
            const truePos = Math.round(sick * sens);
            const falsePos = Math.round((N - sick) * (1 - spec));
            for (let i = 0; i < N; i++) {
              const isSick = i < sick;
              const pos = isSick ? i < truePos : (i - sick) < falsePos;
              if (!pos && !isSick) continue; // only draw the interesting ones for legibility
              const cx = x0 + (i % cols) * cell, cy = y0 + Math.floor(i / cols) * cell;
              items.push(rect(`c-${i}`, cx, cy, cell - 1.6, cell - 1.6, {
                cls: isSick ? 'sq sq-pos' : 'sq sq-neg', dur: 200, opacity: pos ? 1 : 0.35,
              }));
              if (pos) items.push({
                key: `o-${i}`, tag: 'circle', cls: 'bar-out', dur: 200,
                attrs: { cx: cx + cell / 2 - 0.8, cy: cy + cell / 2 - 0.8, r: cell / 2 },
              });
            }
            items.push(label('leg1', 40, 80, 'warm = has it', { cls: 'lab-sm lab-warm' }));
            items.push(label('leg2', 40, 100, 'cold = healthy', { cls: 'lab-sm lab-cold' }));
            items.push(label('leg3', 40, 120, 'ringed = tested +', { cls: 'lab-sm' }));
            items.push(label('leg4', 40, 150, `of ${N} people:`, { cls: 'lab-sm' }));
            items.push(label('leg5', 40, 170, `${truePos} true +`, { cls: 'lab-sm lab-warm' }));
            items.push(label('leg6', 40, 190, `${falsePos} false +`, { cls: 'lab-sm lab-cold' }));
            items.push(label('ans', 400, 500,
              `test positive → ${(ppv(s) * 100).toFixed(1)}% chance you have it`,
              { cls: 'lab-big lab-mid lab-gold', dur: 200 }));
            return items;
          },
        },
        {
          label: 'the answer against prevalence',
          note: 'The curve is steep exactly where screening programmes operate. Below about 5% prevalence, a positive result on a good test is still more likely to be wrong than right.',
          scene: s => {
            const f = F();
            f.setX(0, 30); f.setY(0, 1);
            const g = p => ppv({ ...s, base: p });
            return [
              ...axes(f, { xLabel: 'prevalence (%)', yLabel: 'P(sick | positive)', yN: 5 }),
              hLine(f, 0.5, { key: 'h', cls: 'rule-faint rule-dash' }),
              label('hl', f.x1 - 6, f.sy(0.5) - 8, 'coin-flip territory', { cls: 'lab-sm lab-end' }),
              fnPath(f, g, { key: 'c', cls: 'curve curve-warm', n: 200, from: 0.05, dur: 200 }),
              { key: 'now', tag: 'circle', cls: 'pt pt-green', dur: 200, attrs: { cx: f.sx(Math.min(30, +s.base)), cy: f.sy(ppv(s)), r: 8 } },
              label('nl', f.sx(Math.min(30, +s.base)), f.sy(ppv(s)) - 16,
                `${(ppv(s) * 100).toFixed(1)}%`, { cls: 'lab-big lab-mid lab-green', dur: 200 }),
              label('cap', f.midX, f.y1 + 10,
                `sensitivity ${s.sens}% · specificity ${s.spec}%`, { cls: 'lab lab-mid' }),
            ];
          },
        },
      ],
    },
  ],
};

function ppv(s) {
  const p = s.base / 100, se = s.sens / 100, sp = s.spec / 100;
  return (se * p) / (se * p + (1 - sp) * (1 - p));
}
function npv(s) {
  const p = s.base / 100, se = s.sens / 100, sp = s.spec / 100;
  return (sp * (1 - p)) / (sp * (1 - p) + (1 - se) * p);
}
