/* ─────────────────────────────────────────────────────────────────────────────
   logistic.js — a straight line, squashed. Built on linreg + glm, and told
   through the Challenger launch record, because the extrapolation step of this
   model is not an abstract concern.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, arrowDefs } from '../core/plot.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sub, sup, hat, paren, eq, minus, op } from '../core/fx.js';

const ORING = [
  [66, 0], [70, 1], [69, 0], [68, 0], [67, 0], [72, 0], [73, 0], [70, 0],
  [57, 1], [63, 1], [70, 1], [78, 0], [67, 0], [53, 1], [67, 0], [75, 0],
  [70, 0], [81, 0], [76, 0], [79, 0], [75, 1], [76, 0], [58, 1],
];

const F = () => frame({ w: 720, h: 540, l: 66, r: 28, t: 34, b: 58 });
const fit = () => st.glm(ORING.map(p => [p[0]]), ORING.map(p => p[1]), 'logistic');
const P = x => { const m = fit(); return 1 / (1 + Math.exp(-(m.beta[0] + m.beta[1] * x))); };

export default {
  meta: {
    id: 'logistic', title: 'logistic regression', kicker: 'PROBABILITY, BENT',
    status: 'live',
    deck: 'Everything from linear regression still applies — a linear predictor, a slope, a standard error. The only new idea is the scale you build the line on, and it is a scale worth understanding on its own: log odds.',
    dataNote: 'Data: the O-ring record of all 23 space shuttle launches before <em>Challenger</em> (Dalal, Fowlkes & Hoadley, <em>JASA</em> 1989). Temperature at launch, and whether the flight suffered a thermal-distress incident.',
    deps: ['linreg', 'glm'], unlocks: [],
    next: 'poisson', nextLabel: 'poisson regression',
    outro: 'a slope in log odds, an odds ratio to report it with, and a warning about the left edge of the plot.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { p: 0.5, xq: 60, thresh: 0.5 },

  steps: [
    {
      title: 'first, odds',
      prose: `<p>Before any regression: odds. A probability of ¾ means three chances in four. The <strong>odds</strong> are the same fact stated as a ratio of the two outcomes — three to one.</p>
        <p>Why bother? Because probability is trapped between 0 and 1 and gets squashed near the ends, while odds run from 0 to infinity. Half the awkwardness of modelling probabilities comes from that ceiling, and odds remove one side of it.</p>
        <p><strong>Drag the probability</strong> and watch the odds go vertical as you approach certainty.</p>`,
      formula: formula(
        t('odds', { tone: 'gold' }) + eq + frac(t('p', { tone: 'green' }), '1 ' + minus + ' ' + t('p', { tone: 'green' })) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('p', { tone: 'green' }) + eq + frac('odds', '1 + odds'),
        { caption: 'the same fact, said two ways' }),
      readouts: [
        { key: 'p', label: 'probability', tone: 'green', get: s => +s.p, d: 3 },
        { key: 'o', label: 'odds', tone: 'gold', get: s => s.p / (1 - s.p), d: 3, wide: true },
        { key: 'lo', label: 'log odds', tone: 'cyan', get: s => Math.log(s.p / (1 - s.p)), d: 3, wide: true },
        { key: 'say', label: 'in words', wide: true, get: s => {
          const o = s.p / (1 - s.p);
          return o >= 1 ? `${o.toFixed(1)} to 1 on` : `1 to ${(1 / o).toFixed(1)} against`;
        } },
      ],
      controls: [
        { type: 'slider', key: 'p', label: 'probability', min: 0.01, max: 0.99, step: 0.01, fast: true, fmt: v => (+v).toFixed(2) },
      ],
      beats: [
        {
          label: 'probability → odds',
          note: 'Probability crawls along a short leash. Odds break free of the top end entirely.',
          scene: s => {
            const f = F();
            f.setX(0, 1); f.setY(0, 10);
            return [
              ...axes(f, { xLabel: 'probability', yLabel: 'odds', yN: 5 }),
              fnPath(f, x => x / (1 - x), { key: 'c', cls: 'curve', n: 200, to: 0.985 }),
              vLine(f, 1, { key: 'w', cls: 'rule-faint rule-dash' }),
              { key: 'pt', tag: 'circle', cls: 'pt pt-green', dur: 180, attrs: { cx: f.sx(+s.p), cy: f.sy(Math.min(10, s.p / (1 - s.p))), r: 8 } },
              label('l', f.sx(0.05), f.y1 + 14, 'odds run 0 → ∞; probability is stuck in [0, 1]', { cls: 'lab' }),
            ];
          },
        },
        {
          label: 'odds → log odds',
          note: 'One more step. Taking the log opens up the bottom end too — now the scale runs all the way from −∞ to +∞, and <b>a straight line can live on it</b>.',
          scene: s => {
            const f = F();
            f.setX(0, 1); f.setY(-5, 5);
            return [
              ...axes(f, { xLabel: 'probability', yLabel: 'log odds (the logit)', yN: 5 }),
              hLine(f, 0, { key: 'z', cls: 'rule-faint rule-dash' }),
              fnPath(f, x => Math.log(x / (1 - x)), { key: 'c', cls: 'curve curve-cyan', n: 220, from: 0.008, to: 0.992 }),
              { key: 'pt', tag: 'circle', cls: 'pt pt-cyan', dur: 180, attrs: { cx: f.sx(+s.p), cy: f.sy(clamp(Math.log(s.p / (1 - s.p)), -5, 5)), r: 8 } },
              label('l0', f.sx(0.5), f.sy(0) - 10, 'p = ½ sits at 0', { cls: 'lab lab-mid lab-gold' }),
              label('l1', f.sx(0.5), f.y1 + 14, 'symmetric: p and 1−p are mirror images about zero', { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
      ],
    },

    {
      title: 'put the line on the log-odds scale',
      prose: `<p>Now the whole model in one sentence: <strong>fit a straight line to the log odds.</strong></p>
        <p>That's it. The linear predictor b₀ + b₁x is an ordinary line, doing ordinary line things on a scale with no boundaries. Then the logistic function bends it back into a probability, which is why the fitted curve has that S shape.</p>
        <p>The S isn't a modelling choice you made. It's what a straight line <em>looks like</em> after you undo the log-odds transformation.</p>`,
      formula: formula(
        'log' + paren(frac(t('p', { tone: 'green' }), '1 ' + minus + ' ' + t('p', { tone: 'green' }))) + eq +
        t(sub('b', '0'), { tone: 'cyan' }) + ' + ' + t(sub('b', '1'), { tone: 'cyan' }) + 'x' +
        op('&nbsp;&nbsp;→&nbsp;&nbsp;') +
        t('p', { tone: 'green' }) + eq + frac('1', '1 + e' + sup('', '−(b₀ + b₁x)')),
        { caption: 'a line, then a squash' }),
      readouts: [
        { key: 'b0', label: 'b₀', get: () => fit().beta[0], d: 3, wide: true },
        { key: 'b1', label: 'b₁ (per °F)', tone: 'cyan', get: () => fit().beta[1], d: 4, wide: true },
        { key: 'se', label: 'SE of b₁', get: () => fit().se[1], d: 4, wide: true },
        { key: 'p', label: 'p for b₁', tone: 'gold', get: () => fit().p[1], fmt: st.fmtP, wide: true },
      ],
      beats: [
        {
          label: 'the straight version',
          note: 'On the log-odds scale the model really is a straight line. This is the plot the arithmetic happens on.',
          scene: () => {
            const m = fit();
            const f = F();
            f.setX(30, 85); f.setY(-6, 6);
            return [
              ...axes(f, { xLabel: 'launch temperature (°F)', yLabel: 'log odds of an incident' }),
              hLine(f, 0, { key: 'z', cls: 'rule-faint rule-dash' }),
              label('zl', f.x1 - 6, f.sy(0) - 8, 'even odds', { cls: 'lab-sm lab-end lab-gold' }),
              fnPath(f, x => m.beta[0] + m.beta[1] * x, { key: 'l', cls: 'curve curve-cyan', clip: false }),
              ...ORING.map((p, i) => ({
                key: `p-${i}`, tag: 'circle', cls: p[1] ? 'pt pt-warm' : 'pt pt-cold', delay: i * 30,
                attrs: { cx: f.sx(p[0]), cy: f.sy(clamp(m.beta[0] + m.beta[1] * p[0], -6, 6)), r: 5 },
                tip: `${p[0]}°F → log odds <b>${(m.beta[0] + m.beta[1] * p[0]).toFixed(2)}</b>`,
              })),
            ];
          },
        },
        {
          label: 'the squashed version',
          hold: 1700,
          note: 'The same line, run through the logistic function. Nothing about the model changed — only the axis.',
          scene: () => {
            const f = F();
            f.setX(30, 85); f.setY(-0.12, 1.12);
            return [
              ...axes(f, { xLabel: 'launch temperature (°F)', yLabel: 'probability of an incident', yTickVals: [0, 0.25, 0.5, 0.75, 1] }),
              fnPath(f, P, { key: 'c', cls: 'curve curve-warm', n: 220 }),
              hLine(f, 0.5, { key: 'h', cls: 'rule-faint rule-dash' }),
              ...points(f, ORING, {
                key: 'p', r: 7, x: p => p[0], y: p => p[1], stagger: 30,
                cls: p => p[1] ? 'pt pt-warm' : 'pt pt-cold',
                tip: p => `${p[0]}°F · ${p[1] ? 'incident' : 'no incident'}<br>model says <b>${(P(p[0]) * 100).toFixed(0)}%</b>`,
              }),
            ];
          },
        },
      ],
    },

    {
      title: 'reading the slope: odds ratios',
      prose: `<p>b₁ is a change in log odds per degree, which is not a sentence anyone wants to say out loud. Exponentiate it and you get something reportable: the <strong>odds ratio</strong>.</p>
        <p>An odds ratio of 0.8 means every extra degree multiplies the odds of an incident by 0.8 — a 20% reduction in the odds, per degree, all the way along.</p>
        <p>That "all the way along" is the key property. The effect is constant <em>in odds</em>, which is exactly why it is not constant in probability: the same odds ratio moves the probability a lot in the middle of the curve and almost nothing at the ends.</p>`,
      formula: formula(
        t('odds ratio', { tone: 'gold' }) + eq + 'e' + sup('', t(sub('b', '1'), { tone: 'cyan' })) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + '95% CI ' + eq + ' e' + sup('', 'b₁ ± 1.96 · SE'),
        { caption: 'multiply the odds by this much for every one-unit step in x' }),
      aside: `<b>An odds ratio is not a risk ratio.</b> They are close when the outcome is rare and wildly different when it is common. "Twice the odds" for something that already happens half the time is a jump from 50% to 67%, not to 100%. Reporting an odds ratio as if it were a relative risk is one of the most common errors in applied papers.`,
      readouts: [
        { key: 'or', label: 'odds ratio per °F', tone: 'gold', get: () => Math.exp(fit().beta[1]), d: 3, wide: true },
        { key: 'orlo', label: 'CI low', tone: 'cold', get: () => Math.exp(fit().beta[1] - 1.96 * fit().se[1]), d: 3 },
        { key: 'orhi', label: 'CI high', tone: 'warm', get: () => Math.exp(fit().beta[1] + 1.96 * fit().se[1]), d: 3 },
        { key: 'pct', label: 'per 10°F colder', tone: 'warm', wide: true, get: () => Math.exp(-10 * fit().beta[1]), d: 2, suf: '× the odds' },
      ],
      controls: [
        { type: 'slider', key: 'xq', label: 'look at temperature', min: 31, max: 85, step: 1, fast: true, fmt: v => v + '°F' },
      ],
      beats: [
        {
          label: 'the same step, different places',
          note: 'A one-degree step changes the odds by the same factor everywhere — but the change in <b>probability</b> depends entirely on where you are standing.',
          scene: s => {
            const f = F();
            f.setX(30, 85); f.setY(-0.12, 1.12);
            const x = +s.xq;
            const p1 = P(x), p2 = P(x + 5);
            return [
              ...axes(f, { xLabel: 'launch temperature (°F)', yLabel: 'probability of an incident', yTickVals: [0, 0.5, 1] }),
              fnPath(f, P, { key: 'c', cls: 'curve curve-warm', n: 220 }),
              ...points(f, ORING, { key: 'p', r: 5, x: p => p[0], y: p => p[1], cls: p => p[1] ? 'pt pt-warm' : 'pt pt-cold', opacity: 0.4 }),
              rect('step', f.sx(x), f.sy(Math.max(p1, p2)), f.sx(x + 5) - f.sx(x), Math.abs(f.sy(p1) - f.sy(p2)), { cls: 'sq sq-pos', dur: 200 }),
              vLine(f, x, { key: 'v1', cls: 'rule-gold rule-dash', dur: 200 }),
              vLine(f, x + 5, { key: 'v2', cls: 'rule-gold rule-dash', dur: 200 }),
              label('l', f.sx(x + 2.5), f.sy(Math.max(p1, p2)) - 12,
                `5°F warmer: ${(p1 * 100).toFixed(0)}% → ${(p2 * 100).toFixed(0)}%`, { cls: 'lab lab-mid lab-gold', dur: 200 }),
              label('l2', f.midX, f.y1 + 6,
                `the odds ratio is always ${Math.exp(5 * fit().beta[1]).toFixed(2)} — the probability change is not`, { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
      ],
    },

    {
      title: 'the night before the launch',
      prose: `<p>Challenger launched on 28 January 1986 at <strong>31°F</strong> — fifteen degrees colder than any previous launch in the record you have been looking at.</p>
        <p>The engineers who argued to delay were shown a chart of only the seven flights that had suffered damage, which made temperature look unrelated. The flights with <em>no</em> damage — the ones that carry most of the information about temperature — were left off.</p>
        <p>Fit the model to all 23 and slide down to 31°F. The point estimate is essentially certainty. Note also how wide the interval is out there: this is an extrapolation, and the model is honest about knowing very little. The honest reading is not "the model predicted the disaster" — it is that the data could not support a claim of safety, and nobody had drawn this picture.</p>`,
      aside: `<b>What this step is really teaching.</b> Two things, both statistical. Selecting on the outcome destroys the relationship you are trying to see. And a model has no idea when it has left the range of its data — the widening interval is the only warning you get, which is why you have to plot it.`,
      readouts: [
        { key: 'x', label: 'temperature', tone: 'gold', get: s => +s.xq, d: 0, suf: '°F' },
        { key: 'p', label: 'predicted risk', tone: 'warm', get: s => P(+s.xq) * 100, d: 1, suf: '%', wide: true },
        { key: 'min', label: 'coldest in the data', tone: 'cold', get: () => Math.min(...ORING.map(p => p[0])), d: 0, suf: '°F', wide: true },
        { key: 'ext', label: 'status', wide: true, get: s => (+s.xq < Math.min(...ORING.map(p => p[0])) ? 'EXTRAPOLATING' : 'inside the data') },
      ],
      controls: [
        { type: 'slider', key: 'xq', label: 'temperature', min: 28, max: 85, step: 1, fast: true, fmt: v => v + '°F' },
      ],
      beats: [
        {
          label: 'only the failures',
          note: 'This is roughly the chart that was discussed. Seven points, no pattern. The other sixteen flights are missing.',
          scene: () => {
            const f = F();
            f.setX(30, 85); f.setY(-0.12, 1.12);
            return [
              ...axes(f, { xLabel: 'launch temperature (°F)', yLabel: 'incident', yTickVals: [0, 1] }),
              ...points(f, ORING.filter(p => p[1]), {
                key: 'f', r: 8, x: p => p[0], y: () => 1, cls: 'pt pt-warm', stagger: 90,
                tip: p => `${p[0]}°F — damage`,
              }),
              label('l', f.midX, f.y1 + 20, 'flights with damage only — temperature looks irrelevant', { cls: 'lab lab-mid lab-warm' }),
            ];
          },
        },
        {
          label: 'all 23 flights',
          hold: 1600,
          note: 'Add the flights that were fine. The cold end fills up with damage; the warm end fills up with success.',
          scene: () => {
            const f = F();
            f.setX(30, 85); f.setY(-0.12, 1.12);
            return [
              ...axes(f, { xLabel: 'launch temperature (°F)', yLabel: 'incident', yTickVals: [0, 1] }),
              ...points(f, ORING, {
                key: 'p', r: 7, x: p => p[0], y: p => p[1], stagger: 40,
                cls: p => p[1] ? 'pt pt-warm' : 'pt pt-cold',
                tip: p => `${p[0]}°F · ${p[1] ? 'damage' : 'no damage'}`,
              }),
              label('l', f.midX, f.y1 + 20, 'the sixteen successful flights are the evidence', { cls: 'lab lab-mid lab-cold' }),
            ];
          },
        },
        {
          label: 'extrapolate to 31°F',
          note: 'The band is a 95% interval for the fitted probability. Out at 31°F it covers almost everything — the model is telling you it is guessing.',
          scene: s => {
            const m = fit();
            const f = F();
            f.setX(28, 85); f.setY(-0.12, 1.12);
            const xs = ORING.map(p => p[0]);
            const minX = Math.min(...xs);
            const se = x => {
              // delta-method SE on the linear predictor, from the GLM covariance
              const X = ORING.map(p => [1, p[0]]);
              const w = m.mu.map(mm => mm * (1 - mm));
              let a = 0, b = 0, c = 0;
              X.forEach((r, i) => { a += w[i]; b += w[i] * r[1]; c += w[i] * r[1] * r[1]; });
              const det = a * c - b * b;
              const v = (c - 2 * x * b + x * x * a) / det;
              return Math.sqrt(Math.max(v, 0));
            };
            const up = [], dn = [];
            for (let i = 0; i <= 70; i++) {
              const x = 28 + (57 * i) / 70;
              const eta = m.beta[0] + m.beta[1] * x, w = 1.96 * se(x);
              up.push([f.sx(x), f.sy(1 / (1 + Math.exp(-(eta + w))))]);
              dn.unshift([f.sx(x), f.sy(1 / (1 + Math.exp(-(eta - w))))]);
            }
            const xq = +s.xq;
            return [
              ...axes(f, { xLabel: 'launch temperature (°F)', yLabel: 'probability of an incident', yTickVals: [0, 0.5, 1] }),
              rect('outside', f.x0, f.y1, f.sx(minX) - f.x0, f.y0 - f.y1, { cls: 'sq sq-neg', opacity: 0.35 }),
              label('ol', f.sx(minX) - 8, f.y1 + 16, 'no data over here', { cls: 'lab-sm lab-end lab-cold' }),
              path('band', [...up, ...dn], { cls: 'area area-warm', close: true }),
              fnPath(f, P, { key: 'c', cls: 'curve curve-warm', n: 220 }),
              ...points(f, ORING, { key: 'p', r: 6, x: p => p[0], y: p => p[1], cls: p => p[1] ? 'pt pt-warm' : 'pt pt-cold' }),
              vLine(f, xq, { key: 'q', cls: 'rule-gold', dur: 200 }),
              { key: 'qp', tag: 'circle', cls: 'pt pt-green', dur: 200, attrs: { cx: f.sx(xq), cy: f.sy(P(xq)), r: 8 } },
              label('ql', f.sx(xq) + (xq < 55 ? 12 : -12), f.sy(P(xq)) - 14,
                `${xq}°F → ${(P(xq) * 100).toFixed(0)}%`, { cls: `lab-big lab-green ${xq < 55 ? '' : 'lab-end'}`, dur: 200 }),
              ...(xq <= 32 ? [label('ch', f.midX, f.y0 - 12, 'Challenger launched at 31°F', { cls: 'lab lab-mid lab-warm' })] : []),
            ];
          },
        },
      ],
    },

    {
      title: 'from probabilities to decisions',
      prose: `<p>A logistic model outputs a probability. Turning that into a yes/no call needs one more thing you have to supply yourself: a <strong>threshold</strong>.</p>
        <p>Move it and the two kinds of error trade off against each other. A low threshold catches nearly every real incident but cries wolf constantly. A high one is quiet but misses things.</p>
        <p>There is no statistically correct threshold. It depends entirely on what the two mistakes cost — which is a question about the world, not about the data.</p>`,
      readouts: [
        { key: 'th', label: 'threshold', tone: 'gold', get: s => +s.thresh, d: 2 },
        { key: 'tp', label: 'caught', tone: 'green', get: s => cm(s).tp, d: 0 },
        { key: 'fn', label: 'missed', tone: 'warm', get: s => cm(s).fn, d: 0 },
        { key: 'fp', label: 'false alarms', tone: 'cold', get: s => cm(s).fp, d: 0, wide: true },
        { key: 'acc', label: 'accuracy', get: s => (cm(s).tp + cm(s).tn) / ORING.length * 100, d: 1, suf: '%', wide: true },
      ],
      controls: [
        { type: 'slider', key: 'thresh', label: 'call it an incident above', min: 0.05, max: 0.95, step: 0.01, fast: true, fmt: v => (+v).toFixed(2) },
      ],
      beats: [
        {
          label: 'draw the line somewhere',
          note: 'Points above the horizontal line get predicted "incident". Green = right, warm = a miss, cold = a false alarm.',
          scene: s => {
            const f = F();
            f.setX(30, 85); f.setY(-0.12, 1.12);
            const th = +s.thresh;
            return [
              ...axes(f, { xLabel: 'launch temperature (°F)', yLabel: 'predicted probability', yTickVals: [0, 0.5, 1] }),
              rect('call', f.x0, f.y1, f.x1 - f.x0, f.sy(th) - f.y1, { cls: 'sq sq-pos', opacity: 0.28, dur: 200 }),
              hLine(f, th, { key: 'th', cls: 'rule-gold', dur: 200 }),
              label('thl', f.x1 - 6, f.sy(th) - 8, 'predict "incident" above here', { cls: 'lab-sm lab-gold lab-end', dur: 200 }),
              fnPath(f, P, { key: 'c', cls: 'curve curve-warm', n: 200 }),
              ...ORING.map((p, i) => {
                const pr = P(p[0]);
                const pred = pr >= th ? 1 : 0;
                const cls = pred === p[1] ? 'pt pt-green' : (p[1] === 1 ? 'pt pt-warm' : 'pt pt-cold');
                return {
                  key: `pp-${i}`, tag: 'circle', cls, dur: 200,
                  attrs: { cx: f.sx(p[0]), cy: f.sy(pr), r: 6 },
                  tip: `${p[0]}°F<br>actual: <b>${p[1] ? 'incident' : 'fine'}</b><br>predicted: <b>${pred ? 'incident' : 'fine'}</b>`,
                };
              }),
            ];
          },
        },
      ],
    },
  ],
};

function cm(s) {
  const th = +s.thresh;
  let tp = 0, fp = 0, tn = 0, fn = 0;
  ORING.forEach(p => {
    const pred = P(p[0]) >= th ? 1 : 0;
    if (p[1] === 1 && pred === 1) tp++;
    else if (p[1] === 1) fn++;
    else if (pred === 1) fp++;
    else tn++;
  });
  return { tp, fp, tn, fn };
}
