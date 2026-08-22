/* ─────────────────────────────────────────────────────────────────────────────
   decisiontheory.js — the part that turns a number into an action. Expected
   value, utility, loss functions, and the fact that every point estimate you
   have ever reported was already an answer to a loss function.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, fnArea, histBars, arrowDefs } from '../core/plot.js';
import { knobCards } from '../core/knobs.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sqrt, sub, sup, paren, brack, eq, minus, op } from '../core/fx.js';

const F = () => frame({ w: 720, h: 540, l: 70, r: 28, t: 34, b: 58 });

/** a skewed posterior over some quantity — deliberately not symmetric */
const POST = (() => {
  const r = st.rng(1954);   // Savage's Foundations of Statistics
  return range(4000).map(() => 12 * Math.exp(st.randNorm(r, 0, 0.55)) / Math.exp(0.55 * 0.55 / 2));
})();

const LOSSES = {
  squared: {
    label: 'squared', fn: (a, y) => (a - y) ** 2,
    optimal: 'the mean', best: d => st.mean(d),
    note: 'being twice as wrong is four times as bad',
  },
  absolute: {
    label: 'absolute', fn: (a, y) => Math.abs(a - y),
    optimal: 'the median', best: d => st.median(d),
    note: 'every unit of error costs the same',
  },
  asym: {
    label: 'asymmetric', fn: (a, y) => (a < y ? 4 * (y - a) : (a - y)),
    optimal: 'the 80th percentile', best: d => st.quantile(d, 0.8),
    note: 'under-shooting costs four times as much as over-shooting',
  },
  zeroone: {
    label: 'all-or-nothing', fn: (a, y) => (Math.abs(a - y) < 0.75 ? 0 : 1),
    optimal: 'the mode', best: d => {
      const h = st.histogram(d, 40);
      const top = h.reduce((m, b) => (b.n > m.n ? b : m), h[0]);
      return (top.x0 + top.x1) / 2;
    },
    note: 'only exactly right counts',
  },
};

const expLoss = (s, a) => st.mean(POST.map(y => LOSSES[s.loss].fn(a, y)));

/* the gamble in step 1 */
const gamble = s => ({ p: +s.pWin / 100, win: +s.win, lose: -Math.abs(+s.stake) });
const ev = s => { const g = gamble(s); return g.p * g.win + (1 - g.p) * g.lose; };
const util = (w, eta) => (Math.abs(eta - 1) < 1e-9 ? Math.log(Math.max(w, 1e-9)) : (Math.max(w, 1e-9) ** (1 - eta) - 1) / (1 - eta));

export default {
  meta: {
    id: 'decisiontheory', title: 'decision theory', kicker: 'FROM NUMBERS TO ACTIONS',
    status: 'live',
    deck: 'Every analysis ends with somebody doing something. Decision theory is the part that says which action, given what you believe and what the mistakes cost — and it contains the most useful unglamorous fact in applied statistics: <em>your choice of point estimate is already a claim about your loss function, whether or not you meant it to be.</em>',
    dataNote: 'The gambles are yours to set. The loss-function step uses a <em>simulated</em> skewed posterior — skewed on purpose, because when a distribution is symmetric the mean, median and mode coincide and the entire lesson becomes invisible.',
    deps: ['bayes'], unlocks: ['gametheory'],
    next: 'gametheory', nextLabel: 'game theory',
    outro: 'the estimate you report is an answer. state the question it answers.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { pWin: 50, win: 120, stake: 100, eta: 1, wealth: 1000, loss: 'squared', action: 12, kellyEdge: 10, kellyF: 10 },

  steps: [
    {
      title: 'expected value, and why it is not enough',
      prose: `<p>A gamble: pay a stake, win a prize with some probability. Expected value is the average outcome if you could play it forever — probability times payoff, summed.</p>
        <p>Positive expected value is usually treated as the definition of a good bet. <strong>Set the win to 120 against a 100 stake at even odds.</strong> Expected value says take it. Now imagine the stake is your house.</p>
        <p>Nothing about the expected value changed. Your willingness did. That gap is what the rest of this lesson is about.</p>`,
      formula: formula(
        t('EV', { tone: 'gold' }) + eq +
        sup('Σ', '') + ' P(outcome) × value(outcome)' +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') +
        t('an average over a world you only get to visit once', { cls: 'fx-muted' }),
        { size: 'sm', caption: 'the long-run average, offered as advice for a single decision' }),
      readouts: [
        { key: 'p', label: 'P(win)', tone: 'green', get: s => +s.pWin, d: 0, suf: '%' },
        { key: 'w', label: 'if you win', tone: 'warm', get: s => +s.win, d: 0, pre: '+' },
        { key: 'l', label: 'if you lose', tone: 'cold', get: s => -Math.abs(+s.stake), d: 0 },
        { key: 'ev', label: 'expected value', tone: 'gold', get: s => ev(s), d: 2, wide: true },
        { key: 'verdict', label: 'EV says', wide: true, get: s => (ev(s) > 0 ? 'take it' : ev(s) < 0 ? 'refuse' : 'indifferent') },
      ],
      controls: [
        { type: 'slider', key: 'pWin', label: 'P(win)', min: 1, max: 99, step: 1, fast: true, fmt: v => v + '%' },
        { type: 'slider', key: 'win', label: 'prize', min: 0, max: 400, step: 5, fast: true },
        { type: 'slider', key: 'stake', label: 'stake', min: 0, max: 400, step: 5, fast: true },
      ],
      beats: [
        {
          label: 'the two outcomes',
          note: 'Bar width is how likely, bar height is how much. Expected value is the balance point of the two.',
          scene: s => {
            const g = gamble(s);
            const f = F();
            f.setX(0, 1); f.setY(Math.min(-420, g.lose * 1.2), Math.max(420, g.win * 1.2));
            return [
              ...axes(f, { xLabel: 'probability', yLabel: 'payoff', yN: 5 }),
              hLine(f, 0, { key: 'z', cls: 'ax-line' }),
              rect('lose', f.sx(0), f.sy(0), f.sx(1 - g.p) - f.sx(0), f.sy(g.lose) - f.sy(0), {
                cls: 'sq sq-neg', dur: 220, tip: `lose ${Math.abs(g.lose)} with probability ${(1 - g.p).toFixed(2)}`,
              }),
              rect('win', f.sx(1 - g.p), f.sy(g.win), f.sx(1) - f.sx(1 - g.p), f.sy(0) - f.sy(g.win), {
                cls: 'sq sq-pos', dur: 220, tip: `win ${g.win} with probability ${g.p.toFixed(2)}`,
              }),
              hLine(f, ev(s), { key: 'ev', cls: 'rule-gold', dur: 220 }),
              numLabel('evl', f.x1 - 6, f.sy(ev(s)) - 10, ev(s), { cls: 'lab-big lab-end lab-gold', d: 2, pre: 'EV = ', dur: 220 }),
              label('ll', f.sx((1 - g.p) / 2), f.y0 - 12, 'lose', { cls: 'lab lab-mid lab-cold' }),
              label('wl', f.sx(1 - g.p / 2), f.y1 + 14, 'win', { cls: 'lab lab-mid lab-warm' }),
            ];
          },
        },
        {
          label: 'one play is not the long run',
          hold: 2000,
          note: 'A hundred plays of a positive-EV bet. The average converges — but look at the path. <b>If any of those dips would have ended you, the average was never available to you.</b>',
          scene: s => {
            const g = gamble(s);
            const r = st.rng(77);
            let w = 0;
            const path_ = [0];
            for (let i = 0; i < 100; i++) { w += r() < g.p ? g.win : g.lose; path_.push(w); }
            const f = F();
            f.setX(0, 100);
            f.setY(Math.min(...path_) - 100, Math.max(...path_, ev(s) * 100) + 100);
            return [
              ...axes(f, { xLabel: 'plays', yLabel: 'cumulative winnings', yN: 5 }),
              hLine(f, 0, { key: 'z', cls: 'rule-faint rule-dash' }),
              path('exp', [[f.sx(0), f.sy(0)], [f.sx(100), f.sy(ev(s) * 100)]], { cls: 'curve curve-fit curve-dash' }),
              path('run', path_.map((v, i) => [f.sx(i), f.sy(v)]), { cls: 'curve curve-warm', dur: 900 }),
              label('l', f.x1 - 6, f.sy(ev(s) * 100) - 10, 'what EV promises', { cls: 'lab-sm lab-end lab-green' }),
              label('l2', 376, f.y0 - 12, 'the promise is about the average, not about you', { cls: 'lab lab-mid' }),
            ];
          },
        },
      ],
    },

    {
      title: 'utility: the second hundred pounds is worth less',
      prose: `<p>The fix Bernoulli proposed in 1738 and nobody has improved on much: people do not maximise money, they maximise <strong>utility</strong> — and utility is a bent function of money.</p>
        <p>The bend is the whole content. If the curve is concave, a gain of £100 adds less than a loss of £100 removes, so a fair bet is <em>worse than nothing</em>. That is risk aversion, and it falls out of the curvature rather than being bolted on as a preference.</p>
        <p><strong>Bend the curve</strong> and watch the certainty equivalent — the guaranteed amount you would swap the gamble for — fall below the expected value. The gap between them is what you would pay to avoid the risk.</p>`,
      formula: formula(
        t('EU', { tone: 'green' }) + eq + 'Σ P × ' + t('u', { tone: 'cyan' }) + paren('outcome') +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') +
        t('certainty equivalent', { tone: 'gold' }) + eq + sup('u', '−1') + paren('EU'),
        { size: 'sm', caption: 'the guaranteed sum you would accept instead of the gamble' }),
      dep: { note: 'The inverse function move is the algebra lesson.', lesson: 'algebra', label: 'algebra & inverses' },
      readouts: [
        { key: 'ev', label: 'expected value', tone: 'gold', get: s => +s.wealth + ev(s), d: 1, wide: true },
        { key: 'ce', label: 'certainty equivalent', tone: 'green', get: s => certEq(s), d: 1, wide: true },
        { key: 'prem', label: 'risk premium', tone: 'warm', get: s => (+s.wealth + ev(s)) - certEq(s), d: 1, wide: true },
        { key: 'take', label: 'a rational you', wide: true, get: s => (certEq(s) > +s.wealth ? 'takes the bet' : 'refuses it') },
      ],
      controls: [
        { type: 'slider', key: 'eta', label: 'how bent the curve is', min: 0, max: 3, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'slider', key: 'wealth', label: 'your wealth', min: 150, max: 5000, step: 50, fast: true },
        { type: 'slider', key: 'pWin', label: 'P(win)', min: 1, max: 99, step: 1, fast: true, fmt: v => v + '%' },
      ],
      beats: [
        {
          label: 'the bend',
          note: 'Flat curve (bend = 0) means you are an EV maximiser. As it bends, the same gamble becomes less and less attractive without any of its numbers changing.',
          scene: s => {
            const g = gamble(s);
            const W = +s.wealth, eta = +s.eta;
            const lo = Math.max(1, W + g.lose - 100), hi = W + g.win + 100;
            const f = F();
            f.setX(lo, hi);
            f.setY(util(lo, eta), util(hi, eta));
            const wLose = W + g.lose, wWin = W + g.win;
            const eu = g.p * util(wWin, eta) + (1 - g.p) * util(wLose, eta);
            const ce = certEq(s);
            return [
              ...axes(f, { xLabel: 'wealth', yLabel: 'utility', yN: 4, yFmt: () => '' }),
              fnPath(f, w => util(w, eta), { key: 'u', cls: 'curve curve-cyan', n: 200, dur: 240 }),
              path('chord', [[f.sx(wLose), f.sy(util(wLose, eta))], [f.sx(wWin), f.sy(util(wWin, eta))]],
                { cls: 'curve-ghost curve-dash', dur: 240 }),
              ...[[wLose, 'cold', 'lose'], [wWin, 'warm', 'win']].map(([w, tone, nm], i) => [
                { key: `p-${i}`, tag: 'circle', cls: `pt pt-${tone}`, dur: 240, attrs: { cx: f.sx(w), cy: f.sy(util(w, eta)), r: 7 } },
                label(`pl-${i}`, f.sx(w), f.sy(util(w, eta)) + (i ? -16 : 22), nm, { cls: `lab-sm lab-mid lab-${tone}`, dur: 240 }),
              ]),
              { key: 'eu', tag: 'circle', cls: 'pt pt-gold', dur: 240, attrs: { cx: f.sx(W + ev(s)), cy: f.sy(eu), r: 7 } },
              hLine(f, eu, { key: 'euline', cls: 'rule-gold rule-dash', dur: 240 }),
              vLine(f, ce, { key: 'ceLine', cls: 'rule-x', dur: 240 }),
              label('cel', f.sx(ce), f.y0 + 20, `certainty equivalent ${ce.toFixed(0)}`, { cls: 'lab-sm lab-mid lab-cyan', dur: 240 }),
              label('evl', f.sx(W + ev(s)), f.y0 + 38, `expected value ${(W + ev(s)).toFixed(0)}`, { cls: 'lab-sm lab-mid lab-gold', dur: 240 }),
              label('n', 376, f.y1 + 6,
                eta < 0.05 ? 'a straight line — you are indifferent to risk'
                  : `you would pay ${((W + ev(s)) - ce).toFixed(0)} to avoid this gamble`,
                { cls: 'lab lab-mid', dur: 240 }),
            ];
          },
        },
      ],
    },

    {
      title: 'your point estimate is already a loss function',
      prose: `<p>This is the step that changes how you read your own output.</p>
        <p>You have a posterior — or a predictive distribution, or just a set of plausible values. You have to report <em>one number</em>. Which one is right depends entirely on what it costs to be wrong, and in which direction.</p>
        <p>Minimise <strong>squared</strong> error and the best single number is the <strong>mean</strong>. Minimise <strong>absolute</strong> error and it is the <strong>median</strong>. Make under-shooting four times as costly as over-shooting and it becomes roughly the <strong>80th percentile</strong>. Make only exact answers count and it is the <strong>mode</strong>.</p>
        <p>These are not conventions. They are theorems. <strong>Switch the loss below</strong> and watch the optimal action move across a distribution that has not changed at all.</p>`,
      formula: formula(
        t('best action', { tone: 'green' }) + eq + 'argmin' + sub('', 'a') + ' E' +
        brack(t('L', { tone: 'warm' }) + paren('a, y')) +
        `<br>` +
        t('squared → mean', { tone: 'cyan' }) + op('&nbsp;·&nbsp;') +
        t('absolute → median', { tone: 'purple' }) + op('&nbsp;·&nbsp;') +
        t('asymmetric → a quantile', { tone: 'warm' }),
        { size: 'sm', caption: 'reporting a mean is choosing squared error, whether or not you said so' }),
      aside: `<b>Where this bites in practice.</b> Forecasting demand: running out costs far more than holding stock, so the mean is the wrong number and you should be reporting a high quantile. Estimating a delivery date: same asymmetry, same fix. Any time you catch yourself "adding buffer" to a mean by instinct, you are hand-correcting for a loss function you could have specified.`,
      readouts: [
        { key: 'loss', label: 'loss', tone: 'warm', get: s => LOSSES[s.loss].label, wide: true },
        { key: 'opt', label: 'optimal action is', tone: 'green', get: s => LOSSES[s.loss].optimal, wide: true },
        { key: 'val', label: 'which is', tone: 'gold', get: s => LOSSES[s.loss].best(POST), d: 2, wide: true },
        { key: 'your', label: 'your action', tone: 'cyan', get: s => +s.action, d: 2 },
        { key: 'exp', label: 'expected loss', tone: 'warm', get: s => expLoss(s, +s.action), d: 3, wide: true },
      ],
      controls: [
        { type: 'segment', key: 'loss', label: 'loss function', options: Object.entries(LOSSES).map(([k, v]) => ({ value: k, label: v.label, explain: v.note })) },
        { type: 'slider', key: 'action', label: 'the number you report', min: 5, max: 26, step: 0.1, fast: true, fmt: v => (+v).toFixed(1) },
        { type: 'button', key: 'snap', label: '[jump to the optimum]', action: s => { s.action = +LOSSES[s.loss].best(POST).toFixed(1); } },
      ],
      beats: [
        {
          label: 'the distribution you have',
          hold: 1700,
          note: 'A skewed posterior. Mean, median and mode are three different numbers — which is exactly why the choice matters.',
          scene: s => {
            const f = F();
            f.setX(4, 30);
            const bins = st.histogram(POST, 50, [4, 30]);
            f.setY(0, Math.max(...bins.map(b => b.density)) * 1.2);
            const mn = st.mean(POST), md = st.median(POST), mo = LOSSES.zeroone.best(POST);
            return [
              ...axes(f, { xLabel: 'the quantity you are estimating', yLabel: 'posterior density', yN: 4 }),
              ...histBars(f, bins, { key: 'h', cls: 'bar bar-dim', useDensity: true, stagger: 8 }),
              ...[[mo, 'green', 'mode'], [md, 'purple', 'median'], [mn, 'cyan', 'mean']].map(([v, tone, nm], i) => [
                vLine(f, v, { key: `v-${i}`, cls: `rule-${tone === 'cyan' ? 'x' : 'y'}`, delay: 400 + i * 250 }),
                label(`l-${i}`, f.sx(v), f.y1 + 10 + i * 18, `${nm} ${v.toFixed(2)}`,
                  { cls: `lab lab-mid lab-${tone}`, delay: 400 + i * 250 }),
              ]),
            ];
          },
        },
        {
          label: 'expected loss, for every action',
          note: 'Slide your reported number and read the curve. <b>The bottom of the curve is the right answer — and it moves when the loss changes.</b>',
          scene: s => {
            const f = F();
            f.setX(5, 26);
            const acts = range(90).map(i => 5 + (i * 21) / 89);
            const vals = acts.map(a => expLoss(s, a));
            f.setY(0, Math.max(...vals) * 1.15);
            const best = LOSSES[s.loss].best(POST);
            return [
              ...axes(f, { xLabel: 'the number you report', yLabel: 'expected loss', yN: 4 }),
              fnPath(f, a => expLoss(s, a), { key: 'c', cls: 'curve curve-warm', n: 120, dur: 240 }),
              vLine(f, best, { key: 'best', cls: 'rule-gold rule-dash', dur: 240 }),
              { key: 'bp', tag: 'circle', cls: 'pt pt-green', dur: 240, attrs: { cx: f.sx(best), cy: f.sy(expLoss(s, best)), r: 8 } },
              label('bl', f.sx(best), f.sy(expLoss(s, best)) - 18,
                `${LOSSES[s.loss].optimal} · ${best.toFixed(2)}`, { cls: 'lab lab-mid lab-green', dur: 240 }),
              { key: 'you', tag: 'circle', cls: 'pt pt-cyan', dur: 200, attrs: { cx: f.sx(+s.action), cy: f.sy(expLoss(s, +s.action)), r: 7 } },
              label('n', 376, f.y1 + 6, LOSSES[s.loss].note, { cls: 'lab lab-mid', dur: 240 }),
            ];
          },
        },
        {
          label: 'the same distribution, four answers',
          hold: 2100,
          note: 'Nothing about the evidence changed between these four. Only the question "what does being wrong cost?" changed.',
          scene: () => {
            const f = F();
            f.setX(4, 30);
            const bins = st.histogram(POST, 50, [4, 30]);
            f.setY(0, Math.max(...bins.map(b => b.density)) * 1.35);
            const keys = Object.keys(LOSSES);
            return [
              ...axes(f, { xLabel: 'the quantity you are estimating', yLabel: 'density', yN: 4 }),
              ...histBars(f, bins, { key: 'h', cls: 'bar bar-dim', useDensity: true }),
              ...keys.map((k, i) => {
                const v = LOSSES[k].best(POST);
                const tone = ['cyan', 'purple', 'warm', 'green'][i];
                return [
                  vLine(f, v, { key: `v-${i}`, cls: `rule-${tone === 'cyan' ? 'x' : 'y'}`, delay: i * 260 }),
                  label(`l-${i}`, f.sx(v), f.y1 + 8 + i * 20,
                    `${LOSSES[k].label} → ${v.toFixed(2)}`, { cls: `lab lab-mid lab-${tone}`, delay: i * 260 }),
                ];
              }),
              label('n', 376, f.y0 - 12, 'four defensible point estimates from one posterior', { cls: 'lab lab-mid lab-gold' }),
            ];
          },
        },
      ],
    },

    {
      title: 'the decision rule, and where the threshold comes from',
      prose: `<p>Back to the logistic regression lesson, which ended with an unanswered question: where do you put the classification threshold?</p>
        <p>Decision theory answers it in one line. Act if the <strong>expected loss from acting</strong> is lower than the expected loss from not acting. Work that through for a binary outcome and the optimal threshold is a ratio of the two costs — nothing to do with 0.5, and nothing to do with your data.</p>
        <p>The half-and-half default is not neutral. It is the specific claim that a false alarm and a miss cost exactly the same, which is almost never true and almost never checked.</p>`,
      formula: formula(
        t('act if', { tone: 'green' }) + '  p > ' +
        frac(t('cost of a false alarm', { tone: 'cold' }),
          t('cost of a false alarm', { tone: 'cold' }) + ' + ' + t('cost of a miss', { tone: 'warm' })) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('0.5 only when the two are equal', { cls: 'fx-muted' }),
        { size: 'sm', caption: 'the threshold is a statement about costs, not about probabilities' }),
      dep: { note: 'This is the threshold the logistic lesson left to you.', lesson: 'logistic', label: 'logistic regression' },
      readouts: [
        { key: 'fa', label: 'cost of a false alarm', tone: 'cold', get: s => +s.stake, d: 0, wide: true },
        { key: 'miss', label: 'cost of a miss', tone: 'warm', get: s => +s.win, d: 0, wide: true },
        { key: 'th', label: 'optimal threshold', tone: 'gold', get: s => +s.stake / (+s.stake + +s.win), d: 3, wide: true },
        { key: 'def', label: 'the default', tone: 'muted', get: () => 0.5, d: 3 },
      ],
      controls: [
        { type: 'slider', key: 'stake', label: 'cost of a false alarm', min: 1, max: 400, step: 1, fast: true },
        { type: 'slider', key: 'win', label: 'cost of a miss', min: 1, max: 400, step: 1, fast: true },
      ],
      beats: [
        {
          label: 'two lines, one crossing',
          note: 'Expected loss from acting rises with the chance of a false alarm; expected loss from waiting rises with the chance of a miss. <b>Act where the lines cross.</b>',
          scene: s => {
            const cFA = +s.stake, cMiss = +s.win;
            const f = F();
            f.setX(0, 1);
            f.setY(0, Math.max(cFA, cMiss) * 1.15);
            const th = cFA / (cFA + cMiss);
            return [
              ...axes(f, { xLabel: 'probability the thing is really happening', yLabel: 'expected loss', yN: 4 }),
              fnPath(f, p => (1 - p) * cFA, { key: 'act', cls: 'curve curve-cold', n: 60, dur: 240 }),
              fnPath(f, p => p * cMiss, { key: 'wait', cls: 'curve curve-warm', n: 60, dur: 240 }),
              vLine(f, th, { key: 'th', cls: 'rule-gold', dur: 240 }),
              rect('actzone', f.sx(th), f.y1, f.x1 - f.sx(th), f.y0 - f.y1, { cls: 'sq sq-pos', opacity: 0.2, dur: 240 }),
              label('la', f.x0 + 10, f.sy(cFA) - 10, 'loss if you act', { cls: 'lab lab-cold' }),
              label('lw', f.x1 - 8, f.sy(cMiss) - 10, 'loss if you wait', { cls: 'lab lab-end lab-warm' }),
              numLabel('thl', f.sx(th), f.y1 + 8, th, { cls: 'lab-big lab-mid lab-gold', d: 3, pre: 'act above p = ', dur: 240 }),
              label('zone', f.sx((th + 1) / 2), f.y0 - 14, 'act', { cls: 'lab lab-mid lab-green', dur: 240 }),
              vLine(f, 0.5, { key: 'half', cls: 'rule-faint rule-dash' }),
              label('hl', f.sx(0.5), f.y0 + 20, 'the default', { cls: 'lab-sm lab-mid lab-muted' }),
            ];
          },
        },
      ],
    },

    {
      title: 'how much to bet: the kelly criterion',
      prose: `<p>One more, because it is the cleanest case of a right answer that neither expected value nor intuition gets to.</p>
        <p>You have an edge. How much of your bankroll do you stake? Expected value says <em>all of it</em>, every time — which guarantees ruin, since you will eventually lose one. Intuition says "a bit", with no way to say how much.</p>
        <p>Kelly's answer is the fraction that maximises the <strong>long-run growth rate</strong>, which turns out to be maximising the expected logarithm of wealth. Bet more than that and your growth rate falls; bet twice it and your growth rate is zero no matter how big your edge.</p>`,
      formula: formula(
        sup('f', '*') + eq + frac(t('edge', { tone: 'green' }), t('odds', { tone: 'gold' })) +
        op('&nbsp;=&nbsp;') + frac('bp − q', 'b') +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('maximises E[log wealth]', { tone: 'cyan' }),
        { size: 'sm', caption: 'the only fraction whose long-run growth is not beaten by another' }),
      aside: `<b>Why log.</b> Wealth compounds multiplicatively, so what matters over many rounds is the average of the log, not the average of the level. That is also why a 50% loss needs a 100% gain to undo — and why "maximise expected value each round" quietly means "accept certain ruin eventually".`,
      readouts: [
        { key: 'edge', label: 'your edge', tone: 'green', get: s => +s.kellyEdge, d: 0, suf: '%' },
        { key: 'kf', label: 'Kelly fraction', tone: 'gold', get: s => kellyStar(s) * 100, d: 1, suf: '%', wide: true },
        { key: 'yf', label: 'you bet', tone: 'cyan', get: s => +s.kellyF, d: 0, suf: '%' },
        { key: 'g', label: 'growth per round', tone: 'warm', get: s => growth(s, +s.kellyF / 100) * 100, d: 3, suf: '%', wide: true },
      ],
      controls: [
        { type: 'slider', key: 'kellyEdge', label: 'edge (P(win) − 50%)', min: 1, max: 40, step: 1, fast: true, fmt: v => v + '%' },
        { type: 'slider', key: 'kellyF', label: 'fraction of bankroll staked', min: 1, max: 100, step: 1, fast: true, fmt: v => v + '%' },
      ],
      beats: [
        {
          label: 'the growth curve',
          note: 'A single hump. Left of the peak you are leaving money on the table; right of it you are destroying your own growth rate. <b>At twice Kelly, growth is exactly zero.</b>',
          scene: s => {
            const f = F();
            f.setX(0, 1);
            const star = kellyStar(s);
            const vals = range(80).map(i => growth(s, (i + 0.5) / 80));
            f.setY(Math.min(-0.05, Math.min(...vals)), Math.max(...vals) * 1.3);
            return [
              ...axes(f, { xLabel: 'fraction of bankroll staked', yLabel: 'long-run growth rate', yN: 5, xFmt: v => (v * 100).toFixed(0) + '%' }),
              hLine(f, 0, { key: 'z', cls: 'ax-line' }),
              fnPath(f, x => growth(s, clamp(x, 0.001, 0.999)), { key: 'g', cls: 'curve curve-warm', n: 160, dur: 240 }),
              vLine(f, star, { key: 'star', cls: 'rule-gold rule-dash', dur: 240 }),
              { key: 'sp', tag: 'circle', cls: 'pt pt-green', dur: 240, attrs: { cx: f.sx(star), cy: f.sy(growth(s, star)), r: 8 } },
              label('sl', f.sx(star), f.sy(growth(s, star)) - 16, `Kelly · ${(star * 100).toFixed(0)}%`, { cls: 'lab lab-mid lab-green', dur: 240 }),
              ...(2 * star < 1 ? [
                vLine(f, 2 * star, { key: 'dbl', cls: 'rule-faint rule-dash' }),
                label('dl', f.sx(2 * star), f.y0 - 14, 'twice Kelly · growth zero', { cls: 'lab-sm lab-mid lab-warm' }),
              ] : []),
              { key: 'you', tag: 'circle', cls: 'pt pt-cyan', dur: 200, attrs: { cx: f.sx(+s.kellyF / 100), cy: f.sy(growth(s, +s.kellyF / 100)), r: 7 } },
            ];
          },
        },
        {
          label: 'a hundred rounds, three strategies',
          note: 'Same edge, same luck, three stake sizes. Over-betting does not merely add risk — it loses, reliably, to a smaller bet.',
          scene: s => {
            const star = kellyStar(s);
            const p = 0.5 + +s.kellyEdge / 100;
            const strategies = [
              { f: star / 2, name: 'half Kelly', tone: 'cold' },
              { f: star, name: 'Kelly', tone: 'green' },
              { f: Math.min(0.99, star * 2.4), name: 'over-betting', tone: 'warm' },
            ];
            const r0 = st.rng(4242);
            const flips = range(100).map(() => r0() < p);
            const paths = strategies.map(str => {
              let w = 1; const out = [1];
              flips.forEach(win => { w *= win ? 1 + str.f : 1 - str.f; out.push(w); });
              return out;
            });
            const f = F();
            f.setX(0, 100);
            const all = paths.flat();
            f.setY(0, Math.max(...all) * 1.1);
            return [
              ...axes(f, { xLabel: 'rounds', yLabel: 'bankroll (× starting)', yN: 5 }),
              hLine(f, 1, { key: 'one', cls: 'rule-faint rule-dash' }),
              ...paths.map((pth, i) => path(`p-${i}`, pth.map((v, k) => [f.sx(k), f.sy(clamp(v, f.dy[0], f.dy[1]))]), {
                cls: `curve curve-${strategies[i].tone === 'cold' ? 'cold' : strategies[i].tone === 'green' ? 'fit' : 'warm'}`,
                dur: 900, delay: i * 200,
              })),
              ...strategies.map((str, i) => label(`l-${i}`, f.x1 - 8, f.y1 + 10 + i * 20,
                `${str.name} (${(str.f * 100).toFixed(0)}%) → ${paths[i].at(-1).toFixed(2)}×`,
                { cls: `lab-sm lab-end lab-${str.tone}`, delay: i * 200 })),
            ];
          },
        },
      ],
    },
  ],
};

function certEq(s) {
  const g = gamble(s), W = +s.wealth, eta = +s.eta;
  const eu = g.p * util(W + g.win, eta) + (1 - g.p) * util(W + g.lose, eta);
  // invert the utility by bisection — no closed form worth writing for both branches
  let lo = 1, hi = W + g.win + 1000;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    if (util(m, eta) < eu) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

const kellyStar = s => {
  const p = 0.5 + +s.kellyEdge / 100;
  return clamp(2 * p - 1, 0.001, 0.999);      // even-money odds: f* = p − q
};
const growth = (s, f) => {
  const p = 0.5 + +s.kellyEdge / 100;
  const fr = clamp(f, 0.0001, 0.9999);
  return p * Math.log(1 + fr) + (1 - p) * Math.log(1 - fr);
};
