/* ─────────────────────────────────────────────────────────────────────────────
   glm.js — the unifier. Logistic and Poisson regression are not two methods;
   they are one fitting loop with two dials moved. This lesson turns the dials.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, arrowDefs } from '../core/plot.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sub, sup, hat, paren, eq, minus, op } from '../core/fx.js';

/* Challenger O-ring data (Dalal, Fowlkes & Hoadley 1989): launch temperature
   in °F, and whether that flight had a thermal-distress incident. */
const ORING = [
  [66, 0], [70, 1], [69, 0], [68, 0], [67, 0], [72, 0], [73, 0], [70, 0],
  [57, 1], [63, 1], [70, 1], [78, 0], [67, 0], [53, 1], [67, 0], [75, 0],
  [70, 0], [81, 0], [76, 0], [79, 0], [75, 1], [76, 0], [58, 1],
];

/* A simulated count outcome, clearly labelled as such: hourly cyclists against
   temperature. Generated once from a Poisson process with a log-linear mean. */
const BIKES = (() => {
  const r = st.rng(404);
  return range(28).map(i => {
    const temp = 4 + i * 1.05;
    return [+temp.toFixed(1), st.randPois(r, Math.exp(1.1 + 0.062 * temp))];
  });
})();

const F = () => frame({ w: 720, h: 540, l: 66, r: 28, t: 34, b: 58 });

const FAMILIES = {
  gaussian: {
    label: 'gaussian', link: 'identity', linkFn: m => m, inv: e => e,
    varFn: () => 1, varLab: 'constant', outcome: 'any real number',
    use: 'ordinary linear regression', tone: 'cyan',
  },
  logistic: {
    label: 'binomial', link: 'logit', linkFn: m => Math.log(m / (1 - m)), inv: e => 1 / (1 + Math.exp(-e)),
    varFn: m => m * (1 - m), varLab: 'μ(1 − μ)', outcome: '0 or 1',
    use: 'logistic regression', tone: 'warm',
  },
  poisson: {
    label: 'poisson', link: 'log', linkFn: m => Math.log(m), inv: e => Math.exp(e),
    varFn: m => m, varLab: 'μ', outcome: '0, 1, 2, 3, …',
    use: 'poisson regression', tone: 'green',
  },
};

function data(s) {
  if (s.family === 'poisson') return { pts: BIKES, xl: 'temperature (°C)', yl: 'cyclists per hour' };
  return { pts: ORING, xl: 'launch temperature (°F)', yl: s.family === 'logistic' ? 'incident (1) or not (0)' : 'incident coded 0/1' };
}

function fit(s) {
  const { pts } = data(s);
  const X = pts.map(p => [p[0]]), y = pts.map(p => p[1]);
  if (s.family === 'gaussian') {
    const m = st.linreg(pts.map(p => p[0]), y);
    return { beta: [m.b0, m.b1], predict: x => m.b0 + m.b1 * x, trace: [{ beta: [m.b0, m.b1], dev: m.sse }], se: [m.seB0, m.seB1], p: [NaN, m.p] };
  }
  return st.glm(X, y, s.family);
}

export default {
  meta: {
    id: 'glm', title: 'the glm idea', kicker: 'ONE ENGINE, MANY MODELS',
    status: 'live',
    deck: 'Logistic regression, Poisson regression and ordinary least squares are the same procedure with two settings changed: how the prediction is bent to fit the outcome, and how the noise is assumed to grow. Learn the two settings and you get the whole family at once.',
    dataNote: 'Data: the Challenger O-ring record (Dalal, Fowlkes & Hoadley 1989) — 23 shuttle launches, temperature at launch and whether a thermal-distress incident occurred. The count example uses <em>simulated</em> cyclist counts, labelled as such because I did not want to pass off generated data as real.',
    deps: ['linreg'], unlocks: ['logistic', 'poisson'],
    next: 'logistic', nextLabel: 'logistic regression',
    outro: 'two dials: the link and the variance. everything else is the same loop.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { family: 'gaussian', iter: 0, showLin: false },

  steps: [
    {
      title: 'a straight line, used where it should not be',
      prose: `<p>The Challenger O-ring data: 23 launches, and for each one, whether the seals showed thermal damage. The outcome is a 0 or a 1 — nothing in between.</p>
        <p>Fit an ordinary regression line to it and look what happens. The line keeps going. It promises a 130% chance of failure at low temperatures and a <em>negative</em> chance at high ones. Those aren't approximations; they're nonsense.</p>
        <p>The problem isn't the data. It's that a line is unbounded and a probability isn't.</p>`,
      readouts: [
        { key: 'n', label: 'launches', get: () => ORING.length, d: 0 },
        { key: 'inc', label: 'with incidents', tone: 'warm', get: () => st.sum(ORING.map(p => p[1])), d: 0, wide: true },
        { key: 'p31', label: 'line says at 31°F', tone: 'warm', wide: true, get: () => {
          const m = st.linreg(ORING.map(p => p[0]), ORING.map(p => p[1]));
          return (m.b0 + m.b1 * 31) * 100;
        }, d: 0, suf: '%' },
      ],
      beats: [
        {
          label: 'the data',
          note: 'Every point is a launch. Bottom row: fine. Top row: damage. Cold launches cluster at the top.',
          scene: () => {
            const f = F();
            f.setX(30, 85); f.setY(-0.35, 1.35);
            return [
              ...axes(f, { xLabel: 'launch temperature (°F)', yLabel: 'thermal distress incident', yTickVals: [0, 1] }),
              ...points(f, ORING, {
                key: 'p', r: 7, x: p => p[0], y: p => p[1], stagger: 45,
                cls: (p) => p[1] ? 'pt pt-warm' : 'pt pt-cold',
                tip: p => `${p[0]}°F<br><b>${p[1] ? 'incident' : 'no incident'}</b>`,
              }),
            ];
          },
        },
        {
          label: 'a line through it',
          hold: 1700,
          note: 'The least-squares line does its honest best — and immediately walks off both ends of the probability scale.',
          scene: () => {
            const f = F();
            f.setX(30, 85); f.setY(-0.35, 1.35);
            const m = st.linreg(ORING.map(p => p[0]), ORING.map(p => p[1]));
            return [
              ...axes(f, { xLabel: 'launch temperature (°F)', yLabel: 'probability of an incident', yTickVals: [0, 0.5, 1] }),
              rect('bad1', f.x0, f.y1, f.x1 - f.x0, f.sy(1) - f.y1, { cls: 'sq sq-pos', opacity: 0.35 }),
              rect('bad2', f.x0, f.sy(0), f.x1 - f.x0, f.y0 - f.sy(0), { cls: 'sq sq-pos', opacity: 0.35 }),
              label('b1', f.x1 - 8, f.y1 + 16, 'impossible: p > 1', { cls: 'lab-sm lab-warm lab-end' }),
              label('b2', f.x1 - 8, f.y0 - 8, 'impossible: p < 0', { cls: 'lab-sm lab-warm lab-end' }),
              fnPath(f, x => m.b0 + m.b1 * x, { key: 'ln', cls: 'curve curve-warm', clip: false }),
              ...points(f, ORING, {
                key: 'p', r: 7, x: p => p[0], y: p => p[1],
                cls: (p) => p[1] ? 'pt pt-warm' : 'pt pt-cold',
              }),
              hLine(f, 0, { key: 'z0', cls: 'rule-faint rule-dash' }),
              hLine(f, 1, { key: 'z1', cls: 'rule-faint rule-dash' }),
            ];
          },
        },
      ],
    },

    {
      title: 'dial one: the link function',
      prose: `<p>The fix is not to abandon the line. It's to keep the line where it works — on an unbounded scale — and then <strong>bend the output</strong> to land where the data lives.</p>
        <p>That bending is the <em>link function</em>. The linear predictor η = b₀ + b₁x runs from −∞ to +∞ as it always did. The link's inverse squashes it into the right range: through a logistic curve for probabilities, through an exponential for counts, or through nothing at all for ordinary regression.</p>
        <p><strong>Switch families below</strong> and watch the same straight line become three different shapes.</p>`,
      formula: formula(
        t('η', { tone: 'cyan', explain: 'The linear predictor — always a straight line, always unbounded.' }) + eq +
        sub('b', '0') + ' + ' + sub('b', '1') + 'x' +
        op('&nbsp;&nbsp;→&nbsp;&nbsp;') +
        t('μ', { tone: 'green', explain: 'The mean of the outcome, on the scale the data actually lives on.' }) + eq +
        t('g', { tone: 'gold' }) + sup('', '−1') + paren('η'),
        { caption: 'one straight line, bent at the last moment' }),
      readouts: [
        { key: 'fam', label: 'family', tone: 'gold', get: s => FAMILIES[s.family].label },
        { key: 'lk', label: 'link', tone: 'cyan', get: s => FAMILIES[s.family].link },
        { key: 'out', label: 'outcome can be', wide: true, get: s => FAMILIES[s.family].outcome },
        { key: 'name', label: 'you would call it', wide: true, get: s => FAMILIES[s.family].use },
      ],
      controls: [
        { type: 'segment', key: 'family', label: 'family', options: [
          { value: 'gaussian', label: 'gaussian' }, { value: 'logistic', label: 'binomial' }, { value: 'poisson', label: 'poisson' },
        ] },
        { type: 'toggle', key: 'showLin', label: 'show the straight line underneath' },
      ],
      beats: [
        {
          label: 'the same line, three shapes',
          note: 'The dashed line is η — the straight part, identical in spirit for all three. The solid curve is what comes out after the link.',
          scene: s => {
            const fam = FAMILIES[s.family];
            const d = data(s);
            const m = fit(s);
            const xs = d.pts.map(p => p[0]), ys = d.pts.map(p => p[1]);
            const f = F();
            f.setX(Math.min(...xs) - 4, Math.max(...xs) + 4);
            f.setY(Math.min(0, ...ys) - Math.max(...ys) * 0.15, Math.max(...ys) * 1.2 || 1.3);
            const lin = x => m.beta[0] + m.beta[1] * x;
            const pred = x => s.family === 'gaussian' ? lin(x) : fam.inv(lin(x));
            return [
              ...axes(f, { xLabel: d.xl, yLabel: d.yl }),
              ...(s.showLin && s.family !== 'gaussian'
                ? [fnPath(f, lin, { key: 'lin', cls: 'curve-ghost curve-dash', clip: true })] : []),
              fnPath(f, pred, { key: 'fit', cls: `curve ${s.family === 'poisson' ? 'curve-fit' : s.family === 'logistic' ? 'curve-warm' : 'curve-cyan'}`, n: 200 }),
              ...points(f, d.pts, {
                key: 'p', r: 6, x: p => p[0], y: p => p[1],
                cls: 'pt ' + (s.family === 'poisson' ? 'pt-green' : ''),
                tip: p => `x = <b>${p[0]}</b><br>y = <b>${p[1]}</b><br>model says <b>${pred(p[0]).toFixed(2)}</b>`,
              }),
              label('lk', f.x0 + 10, f.y1 + 10, `${fam.label} · ${fam.link} link`, { cls: 'lab-big lab-gold' }),
            ];
          },
        },
        {
          label: 'the three links, side by side',
          hold: 1800,
          note: 'Left to right on the input: the linear predictor. Up the side: what the model predicts. Only the middle one is bounded.',
          scene: () => {
            const f = F();
            f.setX(-4, 4); f.setY(-1.2, 4);
            return [
              ...axes(f, { xLabel: 'η — the linear predictor', yLabel: 'μ — the prediction' }),
              hLine(f, 0, { key: 'z', cls: 'rule-faint' }),
              hLine(f, 1, { key: 'o', cls: 'rule-faint rule-dash' }),
              fnPath(f, x => x, { key: 'id', cls: 'curve curve-cyan', n: 100 }),
              fnPath(f, x => 1 / (1 + Math.exp(-x)), { key: 'lg', cls: 'curve curve-warm', n: 160 }),
              fnPath(f, x => Math.exp(x), { key: 'ex', cls: 'curve curve-fit', n: 160 }),
              label('l1', f.sx(3.2), f.sy(3.2) - 10, 'identity', { cls: 'lab lab-cyan' }),
              label('l2', f.sx(2.6), f.sy(1) - 10, 'logistic — trapped between 0 and 1', { cls: 'lab lab-warm lab-end' }),
              label('l3', f.sx(1.3), f.sy(3.6), 'exponential — always positive', { cls: 'lab lab-green' }),
            ];
          },
        },
      ],
    },

    {
      title: 'dial two: how the noise grows',
      prose: `<p>The second setting is quieter but just as important. Ordinary regression assumes the scatter around the line is the <em>same size everywhere</em>. For counts and for 0/1 outcomes, that's plainly false.</p>
        <p>A coin flip that lands heads 50% of the time is maximally unpredictable; one that lands heads 99% of the time is almost certain. So the variance of a binary outcome has to depend on the mean — and it does: μ(1 − μ), an upside-down parabola peaking at ½.</p>
        <p>For counts it's even simpler and stranger. A Poisson distribution has <strong>variance equal to its mean</strong>. Days averaging 5 cyclists vary a little; days averaging 500 vary a lot. You don't estimate that relationship — it's assumed.</p>`,
      formula: formula(
        'Var' + paren('y') + eq + t('φ', { tone: 'gold', explain: 'The dispersion — fixed at 1 for binomial and Poisson.' }) +
        ' · ' + t('V', { tone: 'warm' }) + paren('μ') +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + 'gaussian: ' + t('1', { tone: 'cyan' }) +
        op('&nbsp;&nbsp;') + 'binomial: ' + t('μ(1 − μ)', { tone: 'warm' }) +
        op('&nbsp;&nbsp;') + 'poisson: ' + t('μ', { tone: 'green' }),
        { size: 'sm', caption: 'the variance function is an assumption, not an estimate' }),
      aside: `<b>This is where GLMs go wrong in practice.</b> Real counts are almost always more variable than Poisson allows — extra clumping the model has no room for. The symptom is a dispersion statistic well above 1, and the consequence is standard errors that are too small and p-values that are too exciting. The negative binomial lesson is the fix.`,
      readouts: [
        { key: 'fam', label: 'family', tone: 'gold', get: s => FAMILIES[s.family].label },
        { key: 'v', label: 'variance function', tone: 'warm', get: s => FAMILIES[s.family].varLab, wide: true },
      ],
      controls: [
        { type: 'segment', key: 'family', label: 'family', options: [
          { value: 'gaussian', label: 'gaussian' }, { value: 'logistic', label: 'binomial' }, { value: 'poisson', label: 'poisson' },
        ] },
      ],
      beats: [
        {
          label: 'variance against the mean',
          note: 'Where the curve is high, the model expects noisy observations. Where it is low, it expects the outcome to be nearly determined.',
          scene: s => {
            const f = F();
            const fam = FAMILIES[s.family];
            if (s.family === 'logistic') { f.setX(0, 1); f.setY(0, 0.32); }
            else { f.setX(0, 10); f.setY(0, 11); }
            return [
              ...axes(f, { xLabel: 'μ — the predicted mean', yLabel: 'variance the model assumes' }),
              fnPath(f, x => (s.family === 'gaussian' ? 1 : fam.varFn(x)), {
                key: 'v', cls: `curve ${s.family === 'poisson' ? 'curve-fit' : s.family === 'logistic' ? 'curve-warm' : 'curve-cyan'}`, n: 180,
              }),
              ...(s.family === 'logistic' ? [
                vLine(f, 0.5, { key: 'h', cls: 'rule-gold rule-dash' }),
                label('hl', f.sx(0.5), f.y1 + 12, 'a coin flip — maximum uncertainty', { cls: 'lab lab-mid lab-gold' }),
                label('e0', f.sx(0.04), f.y0 - 14, 'near-certain', { cls: 'lab-sm' }),
              ] : s.family === 'poisson' ? [
                fnPath(f, x => x, { key: 'diag', cls: 'curve-ghost curve-dash', n: 40 }),
                label('pl', f.midX, f.y1 + 12, 'variance = mean, exactly', { cls: 'lab lab-mid lab-green' }),
              ] : [
                label('gl', f.midX, f.y1 + 12, 'the same everywhere — homoskedasticity', { cls: 'lab lab-mid lab-cyan' }),
              ]),
            ];
          },
        },
      ],
    },

    {
      title: 'the fitting loop, iteration by iteration',
      prose: `<p>Ordinary regression has a closed-form answer: one matrix equation, done. GLMs don't. There's no formula that hands you the logistic coefficients.</p>
        <p>Instead you <strong>guess, then improve</strong>. At the current guess, pretend the problem is a weighted linear regression — using a working response and weights that come from the variance function — and solve that. The answer becomes your next guess. Repeat.</p>
        <p>This is <em>iteratively reweighted least squares</em>, and it usually converges in about five rounds. <strong>Drag the iteration slider</strong> and watch the curve crawl into place.</p>`,
      formula: formula(
        t('z', { tone: 'cyan', explain: 'The working response: where the data would sit if the model were linear here.' }) + eq +
        'η + ' + frac('y ' + minus + ' μ', 'dμ/dη') +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') +
        t('w', { tone: 'gold', explain: 'The weight: points the model is confident about count for more.' }) + eq +
        frac(paren('dμ/dη') + sup('', '2'), 'V(μ)') +
        op('&nbsp;&nbsp;→&nbsp;&nbsp;') + 'solve ' + t('XᵀWX b = XᵀWz', { tone: 'green' }),
        { size: 'sm', caption: 'a weighted least-squares problem, re-posed every round' }),
      dep: { note: 'Each round is one solve of the normal equations — the matrix step from linear regression.', lesson: 'matrix', label: 'matrix algebra' },
      readouts: [
        { key: 'it', label: 'iteration', tone: 'gold', get: s => Math.min(s.iter, fit(s).trace.length - 1), d: 0 },
        { key: 'b0', label: 'b₀', get: s => cur(s).beta[0], d: 3, wide: true },
        { key: 'b1', label: 'b₁', tone: 'green', get: s => cur(s).beta[1], d: 4, wide: true },
        { key: 'dev', label: 'deviance', tone: 'warm', get: s => cur(s).dev, d: 3, wide: true, explain: 'How badly the model fits. Each round drives it down; when it stops moving, you are done.' },
      ],
      controls: [
        { type: 'segment', key: 'family', label: 'family', options: [
          { value: 'logistic', label: 'binomial' }, { value: 'poisson', label: 'poisson' },
        ], onChange: s => { s.iter = 0; } },
        { type: 'slider', key: 'iter', label: 'iteration', min: 0, max: 8, step: 1, fast: true },
      ],
      beats: [
        {
          label: 'watch it converge',
          note: 'Iteration 0 is a flat, uninformed guess. By round four or five it has stopped moving — that is convergence.',
          scene: s => {
            if (s.family === 'gaussian') s.family = 'logistic';
            const d = data(s);
            const fam = FAMILIES[s.family];
            const m = fit(s);
            const b = cur(s).beta;
            const xs = d.pts.map(p => p[0]), ys = d.pts.map(p => p[1]);
            const f = F();
            f.setX(Math.min(...xs) - 4, Math.max(...xs) + 4);
            f.setY(Math.min(0, ...ys) - Math.max(...ys) * 0.15, Math.max(...ys) * 1.2 || 1.3);
            const ghosts = m.trace.slice(0, Math.min(s.iter, m.trace.length - 1)).map((tr, i) =>
              fnPath(f, x => fam.inv(tr.beta[0] + tr.beta[1] * x), { key: `g-${i}`, cls: 'curve-ghost', n: 120, opacity: 0.35, dur: 200 }));
            return [
              ...axes(f, { xLabel: d.xl, yLabel: d.yl }),
              ...ghosts,
              fnPath(f, x => fam.inv(b[0] + b[1] * x), { key: 'fit', cls: 'curve curve-fit', n: 180, dur: 260 }),
              ...points(f, d.pts, { key: 'p', r: 6, x: p => p[0], y: p => p[1], cls: 'pt' }),
              label('it', f.x0 + 10, f.y1 + 10, `iteration ${Math.min(s.iter, m.trace.length - 1)} of ${m.trace.length - 1}`, { cls: 'lab-big lab-gold', dur: 200 }),
              ...(s.iter >= m.trace.length - 1
                ? [label('done', f.x1 - 8, f.y1 + 10, 'converged — the deviance stopped moving', { cls: 'lab lab-green lab-end' })] : []),
            ];
          },
        },
        {
          label: 'the deviance falling',
          note: 'Each round strictly improves the fit, in ever smaller steps, until the improvement is below the tolerance.',
          scene: s => {
            const m = fit(s);
            const tr = m.trace;
            const f = F();
            f.setX(0, Math.max(1, tr.length - 1));
            f.setY(Math.min(...tr.map(x => x.dev)) * 0.95, tr[0].dev * 1.05);
            return [
              ...axes(f, { xLabel: 'iteration', yLabel: 'deviance', xN: Math.min(6, tr.length), yN: 4 }),
              path('c', tr.map((x, i) => [f.sx(i), f.sy(x.dev)]), { cls: 'curve curve-warm' }),
              ...tr.map((x, i) => ({
                key: `d-${i}`, tag: 'circle', cls: 'pt pt-warm', delay: i * 140,
                attrs: { cx: f.sx(i), cy: f.sy(x.dev), r: 6 },
                tip: `iteration ${i}<br>deviance <b>${x.dev.toFixed(4)}</b>`,
              })),
              label('l', f.midX, f.y1 + 6, `${tr.length - 1} iterations to convergence`, { cls: 'lab lab-mid lab-gold' }),
            ];
          },
        },
      ],
    },

    {
      title: 'the whole family on one card',
      prose: `<p>That's it. Pick the shape of your outcome, and the family tells you which two dials to set. The loop never changes.</p>
        <p>This is why the next four lessons are short: once you have this table, logistic regression is "binomial family, logit link" and Poisson regression is "poisson family, log link". The rest is interpretation.</p>`,
      readouts: [],
      beats: [
        {
          label: 'the table',
          note: 'Every row is a model you have probably been taught as a separate subject.',
          scene: () => {
            const rows = [
              ['outcome', 'family', 'link', 'variance', 'usual name'],
              ['a real number', 'gaussian', 'identity', '1', 'linear regression'],
              ['0 or 1', 'binomial', 'logit', 'μ(1 − μ)', 'logistic regression'],
              ['a count', 'poisson', 'log', 'μ', 'poisson regression'],
              ['a lumpy count', 'neg. binomial', 'log', 'μ + μ²/θ', 'negative binomial'],
              ['a positive amount', 'gamma', 'log', 'μ²', 'gamma regression'],
            ];
            const colX = [70, 250, 375, 470, 590];
            const y0 = 130, rh = 52;
            const items = [];
            rows.forEach((r, i) => {
              if (i > 0) items.push(rect(`bg-${i}`, 40, y0 + i * rh - 22, 640, rh - 8, {
                cls: 'cell', opacity: i % 2 ? 1 : 0.4, delay: i * 90,
              }));
              r.forEach((c, j) => items.push(label(`c-${i}-${j}`, colX[j], y0 + i * rh,
                c, { cls: i === 0 ? 'lab-sm lab-gold' : (j === 4 ? 'lab lab-green' : 'lab'), delay: i * 90 })));
            });
            items.push(label('note', 360, y0 + rows.length * rh + 16,
              'same loop. same solve. two settings.', { cls: 'lab lab-mid lab-gold' }));
            return items;
          },
        },
      ],
    },
  ],
};

function cur(s) {
  const m = fit(s);
  const i = Math.min(s.iter, m.trace.length - 1);
  return m.trace[i];
}
