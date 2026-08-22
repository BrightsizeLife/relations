/* ─────────────────────────────────────────────────────────────────────────────
   linreg.js — simple linear regression. Identical sums to correlation, asked a
   different question: not "how tightly", but "how much y per unit of x".
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, arrowDefs, dragger } from '../core/plot.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sqrt, sub, sup, bar, hat, sumOver, paren, nMinus1, eq, minus, times, op } from '../core/fx.js';

const FAITHFUL = [
  [3.600, 79], [1.800, 54], [3.333, 74], [2.283, 62], [4.533, 85], [2.883, 55],
  [4.700, 88], [3.600, 85], [1.950, 51], [4.350, 85], [1.833, 54], [3.917, 84],
];

const F = () => frame({ w: 720, h: 540, l: 66, r: 28, t: 34, b: 58 });

function M(s) {
  const x = s.pts.map(p => p[0]), y = s.pts.map(p => p[1]);
  return { x, y, m: st.linreg(x, y) };
}

function fitFrame(s, { padX = 0.12 } = {}) {
  const { x, y } = M(s);
  const f = F();
  f.setX(Math.min(...x), Math.max(...x), padX);
  f.setY(Math.min(...y), Math.max(...y), 0.16);
  return f;
}

function scatter(s, f, ctx, o = {}) {
  return points(f, s.pts, {
    key: 'p', r: 6.5, cls: 'pt pt-drag', x: p => p[0], y: p => p[1], ...o,
    tip: (p, i) => `#${i + 1}<br>x = <b>${p[0].toFixed(2)}</b> min<br>y = <b>${p[1].toFixed(0)}</b> min`,
    on: dragger(ctx.svg, f, () => {}),
  }).map((it, i) => ({
    ...it,
    on: {
      pointerdown: e => {
        e.preventDefault();
        e.target.setPointerCapture?.(e.pointerId);
        const move = ev => {
          const pt = ctx.svg.createSVGPoint();
          pt.x = ev.clientX; pt.y = ev.clientY;
          const p = pt.matrixTransform(ctx.svg.getScreenCTM().inverse());
          s.pts[i] = [clamp(f.ix(p.x), f.dx[0], f.dx[1]), clamp(f.iy(p.y), f.dy[0], f.dy[1])];
          ctx.refresh();
        };
        const up = ev => {
          ctx.svg.removeEventListener('pointermove', move);
          ctx.svg.removeEventListener('pointerup', up);
        };
        ctx.svg.addEventListener('pointermove', move);
        ctx.svg.addEventListener('pointerup', up);
      },
    },
  }));
}

const lineItems = (f, b0, b1, { key = 'fit', cls = 'curve curve-fit', dur } = {}) =>
  path(key, [[f.sx(f.dx[0]), f.sy(b0 + b1 * f.dx[0])], [f.sx(f.dx[1]), f.sy(b0 + b1 * f.dx[1])]], { cls, dur });

const AXO = { xLabel: 'eruption length — minutes', yLabel: 'wait until next — minutes' };

export default {
  meta: {
    id: 'linreg', title: 'linear regression', kicker: 'THE LINE',
    status: 'live',
    deck: 'Correlation asks how tightly two things move together. Regression asks a more useful question: for every extra minute of eruption, how many more minutes do I wait? Same arithmetic, different output — and a line you can actually predict with.',
    dataNote: 'Data: the same 12 Old Faithful eruptions used in the correlation lesson, so you can watch identical sums produce a different answer. Drag any point.',
    deps: ['correlation'], unlocks: ['glm', 'multiple', 'logistic'],
    next: 'glm', nextLabel: 'the glm idea',
    outro: 'a slope, its uncertainty, and a warning about where you are allowed to use it.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: {
    pts: FAITHFUL.map(p => [...p]),
    b0: 40, b1: 6, showSq: true, band: 'conf', xNew: 3.2,
  },

  steps: [
    {
      title: 'the same cloud, a different question',
      prose: `<p>This is the geyser data again. Correlation gave us r = .87 — a tight relationship. But r doesn't answer the question a park ranger actually has, which is: <em>the eruption just ran for four minutes, when should I tell the tourists to come back?</em></p>
        <p>For that you need a line: a rule that turns any x into a predicted y.</p>`,
      readouts: [
        { key: 'r', label: 'r', tone: 'green', get: s => st.pearson(M(s).x, M(s).y), d: 3, fmt: v => st.fmtR(v, 3) },
        { key: 'n', label: 'n', get: s => s.pts.length, d: 0 },
      ],
      beats: [
        {
          label: 'the cloud',
          note: 'Correlation looks at this and reports a tightness. Regression wants a rule.',
          scene: (s, ctx) => {
            const f = fitFrame(s);
            return [...axes(f, AXO), ...scatter(s, f, ctx)];
          },
        },
        {
          label: 'what we want',
          note: 'A line. Feed in an eruption length, read off a predicted wait.',
          scene: (s, ctx) => {
            const f = fitFrame(s);
            const { m } = M(s);
            const xq = 4.0;
            return [
              ...axes(f, AXO), ...scatter(s, f, ctx, { opacity: 0.5 }),
              lineItems(f, m.b0, m.b1),
              vLine(f, xq, { key: 'q', cls: 'rule-gold rule-dash', y1: f.sy(m.b0 + m.b1 * xq) }),
              { key: 'qh', tag: 'line', cls: 'rule-gold rule-dash', attrs: { x1: f.x0, y1: f.sy(m.b0 + m.b1 * xq), x2: f.sx(xq), y2: f.sy(m.b0 + m.b1 * xq) } },
              { key: 'qp', tag: 'circle', cls: 'pt pt-green', attrs: { cx: f.sx(xq), cy: f.sy(m.b0 + m.b1 * xq), r: 7 } },
              label('ql', f.sx(xq) + 10, f.sy(m.b0 + m.b1 * xq) - 12,
                `4 minutes in → about ${(m.b0 + m.b1 * xq).toFixed(0)} minutes' wait`, { cls: 'lab lab-green' }),
            ];
          },
        },
      ],
    },

    {
      title: 'try to draw it yourself',
      prose: `<p>Before we derive anything: <strong>use the two sliders</strong> and put a line where you think it belongs.</p>
        <p>The vertical sticks are the <em>residuals</em> — how wrong the line is about each point. The squares are those residuals squared, and their total area is the score we are trying to make small.</p>
        <p>Get the total as low as you can. Then press <span class="cs-inline-code">[snap to the best line]</span> and see how close you got.</p>`,
      formula: formula(
        `${t('SS', { tone: 'warm', explain: 'The sum of squared residuals — the thing being minimised.' })} ${eq} ` +
        sumOver(paren(t(sub('y', 'i'), { tone: 'purple' }) + minus + t(hat('y') + sub('', 'i'), { tone: 'green', explain: 'The line\'s prediction for this point.' })) + sup('', '2')),
        { caption: 'add up the squares. smaller is better.' }),
      readouts: [
        { key: 'ss', label: 'your SS', tone: 'warm', get: s => { const { x, y } = M(s); return st.sum(y.map((v, i) => (v - (s.b0 + s.b1 * x[i])) ** 2)); }, d: 1, wide: true },
        { key: 'best', label: 'best possible', tone: 'green', get: s => M(s).m.sse, d: 1, wide: true },
        { key: 'gap', label: 'you are off by', tone: 'gold', get: s => { const { x, y } = M(s); return st.sum(y.map((v, i) => (v - (s.b0 + s.b1 * x[i])) ** 2)) - M(s).m.sse; }, d: 1, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'b1', label: 'slope', min: -5, max: 25, step: 0.1, fast: true, fmt: v => (+v).toFixed(1) },
        { type: 'slider', key: 'b0', label: 'intercept', min: 0, max: 90, step: 0.5, fast: true, fmt: v => (+v).toFixed(1) },
        { type: 'toggle', key: 'showSq', label: 'show the squares' },
        { type: 'button', key: 'snap', label: '[snap to the best line]', action: s => { const m = M(s).m; s.b0 = +m.b0.toFixed(2); s.b1 = +m.b1.toFixed(2); } },
      ],
      beats: [
        {
          label: 'your line, your errors',
          note: 'Drag the sliders. Every square is one point\'s mistake, and mistakes count by <b>area</b>.',
          scene: (s, ctx) => {
            const f = fitFrame(s);
            const { x, y } = M(s);
            const scale = 0.55;
            return [
              ...axes(f, AXO),
              ...(s.showSq ? x.map((v, i) => {
                const pred = s.b0 + s.b1 * v;
                const side = Math.abs(f.sy(y[i]) - f.sy(pred)) * scale;
                const up = y[i] > pred;
                return rect(`sq-${i}`, f.sx(v), up ? f.sy(y[i]) : f.sy(pred), side * (i % 2 ? -1 : 1), up ? f.sy(pred) - f.sy(y[i]) : f.sy(y[i]) - f.sy(pred), {
                  cls: 'sq sq-resid', dur: 160,
                  tip: `residual ${(y[i] - pred).toFixed(1)} → squared ${(y[i] - pred) ** 2 < 1000 ? ((y[i] - pred) ** 2).toFixed(1) : '…'}`,
                });
              }) : []),
              ...x.map((v, i) => ({
                key: `res-${i}`, tag: 'line', cls: 'stick stick-resid', dur: 160,
                attrs: { x1: f.sx(v), y1: f.sy(y[i]), x2: f.sx(v), y2: f.sy(s.b0 + s.b1 * v) },
              })),
              lineItems(f, s.b0, s.b1, { cls: 'curve curve-warm', dur: 160 }),
              ...scatter(s, f, ctx),
              label('eq', f.x0 + 10, f.y1 + 10, `ŷ = ${(+s.b0).toFixed(1)} + ${(+s.b1).toFixed(1)} · x`, { cls: 'lab-big lab-warm', dur: 160 }),
            ];
          },
        },
      ],
    },

    {
      title: 'why squares, and where the bottom is',
      prose: `<p>Why square the errors instead of just taking their size? Two reasons, one practical and one deep.</p>
        <p>Practical: squaring punishes a single terrible miss much harder than several small ones, which is usually what you want from a summary line.</p>
        <p>Deep: squared error is the one loss function with a <strong>closed-form answer</strong>. Plot the total against the slope and you get a parabola — a smooth bowl with exactly one bottom. Calculus can find that bottom in one step instead of searching for it.</p>`,
      aside: `<b>This is where the calculus lesson pays off.</b> The bottom of the bowl is where the derivative is zero. Set the derivative of SS with respect to each coefficient to zero, solve the two equations, and the formulas on the next step drop out. Every fitting procedure on this site is some version of this move.`,
      dep: { note: 'The bottom of the bowl is found by setting a derivative to zero.', lesson: 'derivatives', label: 'derivatives' },
      readouts: [
        { key: 'b1', label: 'your slope', tone: 'warm', get: s => +s.b1, d: 2 },
        { key: 'ols', label: 'best slope', tone: 'green', get: s => M(s).m.b1, d: 2 },
      ],
      controls: [
        { type: 'slider', key: 'b1', label: 'slope', min: -5, max: 25, step: 0.1, fast: true, fmt: v => (+v).toFixed(1) },
      ],
      beats: [
        {
          label: 'the bowl',
          note: 'Total squared error as a function of the slope, with the intercept always set to its best value. One bowl, one bottom.',
          scene: s => {
            const { x, y, m } = M(s);
            const ssFor = b1 => {
              const b0 = st.mean(y) - b1 * st.mean(x);
              return st.sum(y.map((v, i) => (v - (b0 + b1 * x[i])) ** 2));
            };
            const f = F();
            f.setX(-5, 25);
            const vals = range(80).map(i => ssFor(-5 + (i * 30) / 79));
            f.setY(0, Math.max(...vals) * 1.05);
            return [
              ...axes(f, { xLabel: 'slope', yLabel: 'total squared error', yN: 4 }),
              fnPath(f, ssFor, { key: 'bowl', cls: 'curve', n: 140 }),
              vLine(f, m.b1, { key: 'best', cls: 'rule-gold rule-dash' }),
              { key: 'bp', tag: 'circle', cls: 'pt pt-green', attrs: { cx: f.sx(m.b1), cy: f.sy(m.sse), r: 7 } },
              label('bl', f.sx(m.b1), f.sy(m.sse) - 16, `minimum at ${m.b1.toFixed(2)}`, { cls: 'lab lab-mid lab-green' }),
              { key: 'you', tag: 'circle', cls: 'pt pt-warm', dur: 160, attrs: { cx: f.sx(+s.b1), cy: f.sy(ssFor(+s.b1)), r: 7 } },
              path('tang', tangentPts(f, ssFor, +s.b1), { cls: 'curve curve-warm curve-dash', dur: 160 }),
              label('sl', f.x1 - 6, f.y1 + 12,
                `slope of the bowl here: ${st.deriv(ssFor, +s.b1).toFixed(1)}`, { cls: 'lab lab-warm lab-end', dur: 160 }),
            ];
          },
        },
      ],
    },

    {
      title: 'the answer, in the pieces you already have',
      prose: `<p>Solve the calculus and the best slope turns out to be something we computed two lessons ago:</p>
        <p>The slope is the <strong>covariance divided by the variance of x</strong>. Which is also r, rescaled by the ratio of the two spreads. Correlation and regression are not cousins — they are the same sums wearing different clothes.</p>
        <p>Read the second form carefully: it says a regression slope is a correlation converted out of z-units and back into real ones.</p>`,
      formula: formula(
        `${t(hat('b') + sub('', '1'), { tone: 'green', explain: 'The least-squares slope.' })} ${eq} ` +
        frac(t('cov(x, y)', { tone: 'gold', link: 'cov' }), t(sup('s', '2') + sub('', 'x'), { tone: 'cyan' })) +
        op('&nbsp;=&nbsp;') + frac(sumOver(paren(sub('x', 'i') + minus + bar('x')) + paren(sub('y', 'i') + minus + bar('y'))), sumOver(paren(sub('x', 'i') + minus + bar('x')) + sup('', '2'))) +
        op('&nbsp;=&nbsp;') + t('r', { tone: 'green' }) + ' · ' + frac(t(sub('s', 'y'), { tone: 'purple' }), t(sub('s', 'x'), { tone: 'cyan' })) +
        `<br>${t(hat('b') + sub('', '0'), { tone: 'green' })} ${eq} ${bar('y')} ${minus} ${hat('b')}${sub('', '1')}${bar('x')}`,
        { size: 'sm', caption: 'the slope is a covariance, rescaled. the intercept just makes the line pass through the middle.' }),
      dep: { note: 'Every ingredient here was built in the correlation lesson.', lesson: 'correlation', label: 'correlation' },
      readouts: [
        { key: 'cov', label: 'cov(x,y)', tone: 'gold', get: s => st.covariance(M(s).x, M(s).y), d: 2, wide: true },
        { key: 'vx', label: 's²ₓ', tone: 'cyan', get: s => st.variance(M(s).x), d: 3 },
        { key: 'b1', label: 'slope b₁', tone: 'green', get: s => M(s).m.b1, d: 3 },
        { key: 'b0', label: 'intercept b₀', tone: 'green', get: s => M(s).m.b0, d: 2, wide: true },
      ],
      beats: [
        {
          label: 'the line must pass through the middle',
          note: 'Whatever the slope, the least-squares line always goes through <b>(x̄, ȳ)</b>. That single fact is what fixes the intercept.',
          scene: (s, ctx) => {
            const f = fitFrame(s);
            const { x, y, m } = M(s);
            const mx = st.mean(x), my = st.mean(y);
            return [
              ...axes(f, AXO),
              vLine(f, mx, { key: 'mx', cls: 'rule-x' }), hLine(f, my, { key: 'my', cls: 'rule-y' }),
              ...range(5).map(i => lineItems(f, my - (m.b1 * 0.4 + i * m.b1 * 0.3) * mx, m.b1 * 0.4 + i * m.b1 * 0.3,
                { key: `alt-${i}`, cls: 'curve-ghost curve-dash' })),
              lineItems(f, m.b0, m.b1),
              ...scatter(s, f, ctx),
              { key: 'ctr', tag: 'circle', cls: 'pt pt-green', attrs: { cx: f.sx(mx), cy: f.sy(my), r: 7 } },
              label('cl', f.sx(mx) + 10, f.sy(my) + 18, '(x̄, ȳ) — every candidate line pivots here', { cls: 'lab lab-green' }),
            ];
          },
        },
        {
          label: 'read the slope',
          note: 'A minute of extra eruption buys you this many extra minutes of waiting. That is a rate, with units — which r never had.',
          scene: (s, ctx) => {
            const f = fitFrame(s);
            const { m } = M(s);
            const x0 = 2.6, x1 = 3.6;
            return [
              ...axes(f, AXO), ...scatter(s, f, ctx, { opacity: 0.45 }),
              lineItems(f, m.b0, m.b1),
              { key: 'run', tag: 'line', cls: 'stick stick-x', attrs: { x1: f.sx(x0), y1: f.sy(m.b0 + m.b1 * x0), x2: f.sx(x1), y2: f.sy(m.b0 + m.b1 * x0) } },
              { key: 'rise', tag: 'line', cls: 'stick stick-pos', attrs: { x1: f.sx(x1), y1: f.sy(m.b0 + m.b1 * x0), x2: f.sx(x1), y2: f.sy(m.b0 + m.b1 * x1) } },
              label('runl', (f.sx(x0) + f.sx(x1)) / 2, f.sy(m.b0 + m.b1 * x0) + 18, '1 minute', { cls: 'lab-sm lab-mid lab-cyan' }),
              numLabel('risel', f.sx(x1) + 8, (f.sy(m.b0 + m.b1 * x0) + f.sy(m.b0 + m.b1 * x1)) / 2, m.b1, { cls: 'lab lab-warm', d: 2, suf: ' more minutes of waiting' }),
              label('eq', f.x0 + 10, f.y1 + 10, `ŷ = ${m.b0.toFixed(1)} + ${m.b1.toFixed(2)} · x`, { cls: 'lab-big lab-green' }),
            ];
          },
        },
      ],
    },

    {
      title: 'look at what is left over',
      prose: `<p>The line is a claim, and the residuals are the receipts. Plot them against x and you should see <em>nothing</em> — a shapeless band around zero.</p>
        <p>Structure in the residuals is the model telling you it's wrong: a curve means the relationship is bent, a fan means the noise grows with x, and a lone point way out means one observation is running the show.</p>`,
      aside: `<b>The residual plot is the single most useful diagnostic in applied statistics</b>, and almost nobody looks at it. Drag one point far from the line and watch the pattern appear.`,
      readouts: [
        { key: 'rmse', label: 'residual SD', tone: 'warm', get: s => M(s).m.rmse, d: 2, wide: true },
        { key: 'r2', label: 'r²', tone: 'green', get: s => M(s).m.r2, d: 3, fmt: v => st.fmtR(v, 3) },
        { key: 'sumr', label: 'Σ residuals', get: s => st.sum(M(s).m.resid), d: 6, wide: true, explain: 'Always zero, by construction — the line balances its errors exactly like a mean does.' },
      ],
      beats: [
        {
          label: 'lift the line flat',
          hold: 1700,
          note: 'Rotate the picture so the fitted line becomes the horizontal axis. What is left is pure residual.',
          scene: s => {
            const { x, m } = M(s);
            const f = F();
            f.setX(Math.min(...x), Math.max(...x), 0.12);
            const lim = Math.max(...m.resid.map(Math.abs)) * 1.3;
            f.setY(-lim, lim);
            return [
              ...axes(f, { xLabel: 'eruption length — minutes', yLabel: 'residual (actual − predicted)' }),
              hLine(f, 0, { key: 'z', cls: 'curve curve-fit' }),
              ...x.map((v, i) => ({
                key: `st-${i}`, tag: 'line', cls: 'stick stick-resid',
                attrs: { x1: f.sx(v), y1: f.sy(0), x2: f.sx(v), y2: f.sy(m.resid[i]) }, delay: i * 45,
              })),
              ...x.map((v, i) => ({
                key: `p-${i}`, tag: 'circle', cls: m.resid[i] >= 0 ? 'pt pt-warm' : 'pt pt-cold', delay: i * 45,
                attrs: { cx: f.sx(v), cy: f.sy(m.resid[i]), r: 6 },
                tip: `#${i + 1}<br>off by <b>${m.resid[i].toFixed(1)}</b> minutes`,
              })),
              rect('band', f.x0, f.sy(m.rmse), f.x1 - f.x0, f.sy(-m.rmse) - f.sy(m.rmse), { cls: 'sq sq-resid', opacity: 0.4 }),
              label('bl', f.x1 - 6, f.sy(m.rmse) - 8, `± typical miss of ${m.rmse.toFixed(1)} min`, { cls: 'lab-sm lab-end' }),
            ];
          },
        },
      ],
    },

    {
      title: 'is the slope real?',
      prose: `<p>The slope is an estimate, and estimates wobble. The standard error of the slope says how much — and its formula has a nice moral built in.</p>
        <p>Look at the denominator: the more <em>spread out your x values are</em>, the smaller the standard error. Measuring eruptions that all lasted about three minutes tells you almost nothing about the effect of eruption length. <strong>Range is information.</strong></p>`,
      formula: formula(
        'SE' + paren(hat('b') + sub('', '1')) + ' ' + eq + ' ' +
        frac(t(sub('s', 'resid'), { tone: 'warm', explain: 'The typical size of a residual — how noisy the points are around the line.' }),
          sqrt(sumOver(paren(sub('x', 'i') + minus + bar('x')) + sup('', '2'), { ...{} })) ) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + 't ' + eq + ' ' + frac(hat('b') + sub('', '1'), 'SE') +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('df = n − 2', { tone: 'gold', explain: 'Two parameters estimated: a slope and an intercept.' }),
        { size: 'sm', caption: 'noisy points push it up; a wide spread of x pushes it down' }),
      readouts: [
        { key: 'b1', label: 'slope', tone: 'green', get: s => M(s).m.b1, d: 3 },
        { key: 'se', label: 'SE', tone: 'gold', get: s => M(s).m.seB1, d: 3 },
        { key: 't', label: 't', tone: 'warm', get: s => M(s).m.t, d: 2 },
        { key: 'p', label: 'p', tone: 'gold', get: s => M(s).m.p, fmt: st.fmtP, wide: true },
        { key: 'ci', label: '95% CI for slope', tone: 'cyan', wide: true, get: s => { const c = M(s).m.ciB1; return `${c[0].toFixed(2)} … ${c[1].toFixed(2)}`; } },
      ],
      beats: [
        {
          label: 'the cloud of possible lines',
          note: 'Each faint line is a slope the data cannot rule out. Where they fan apart, you know least.',
          scene: (s, ctx) => {
            const f = fitFrame(s);
            const { m } = M(s);
            const mx = st.mean(m.fit.map((_, i) => M(s).x[i]));
            const my = st.mean(M(s).y);
            return [
              ...axes(f, AXO),
              ...range(11).map(i => {
                const b1 = m.b1 + (i - 5) * (m.crit * m.seB1) / 5;
                return lineItems(f, my - b1 * mx, b1, { key: `cand-${i}`, cls: 'curve-ghost' });
              }),
              lineItems(f, m.b0, m.b1),
              ...scatter(s, f, ctx),
              label('cap', f.midX, f.y1 + 6, `95% of plausible slopes: ${m.ciB1[0].toFixed(2)} to ${m.ciB1[1].toFixed(2)} min per min`, { cls: 'lab lab-mid lab-cyan' }),
            ];
          },
        },
        {
          label: 'against the null slope',
          note: 'The null hypothesis is a <b>flat</b> line: eruption length tells you nothing. Our t sits far out in that world\'s tail.',
          scene: s => {
            const { m } = M(s);
            const df = m.df;
            const f = F();
            const lim = Math.max(5, Math.abs(m.t) * 1.2);
            f.setX(-lim, lim); f.setY(0, st.tPdf(0, df) * 1.2);
            return [
              ...axes(f, { xLabel: 't for the slope', yLabel: 'density', yN: 4 }),
              fnPath(f, x => st.tPdf(x, df), { key: 'c', cls: 'curve', n: 220 }),
              vLine(f, m.t, { key: 'tv', cls: 'rule-gold' }),
              label('l', f.midX, f.y1 + 6, `t = ${m.t.toFixed(2)} · df = ${df} · p = ${st.fmtP(m.p)}`, { cls: 'lab-big lab-mid lab-gold' }),
            ];
          },
        },
      ],
    },

    {
      title: 'two very different bands',
      prose: `<p>People conflate these constantly, so it's worth drawing them together.</p>
        <p>The <span class="cs-datum-cold">confidence band</span> is uncertainty about <em>the line</em> — about where the average wait is for a given eruption length. It's narrow, and it gets narrower with more data.</p>
        <p>The <span class="cs-datum-warm">prediction band</span> is uncertainty about <em>the next actual eruption</em>. It has to include the scatter of individual points as well, so it's much wider — and it never shrinks below the natural noise, no matter how much data you collect.</p>
        <p>Both bands flare at the edges, because a small error in the slope gets amplified the further you get from the middle.</p>`,
      readouts: [
        { key: 'xn', label: 'x =', tone: 'gold', get: s => +s.xNew, d: 2 },
        { key: 'pred', label: 'predicted wait', tone: 'green', get: s => { const m = M(s).m; return m.b0 + m.b1 * s.xNew; }, d: 1, wide: true },
        { key: 'cw', label: 'conf ± ', tone: 'cold', get: s => { const m = M(s).m; return m.crit * m.seFit(+s.xNew); }, d: 1 },
        { key: 'pw', label: 'pred ± ', tone: 'warm', get: s => { const m = M(s).m; return m.crit * m.sePred(+s.xNew); }, d: 1 },
      ],
      controls: [
        { type: 'slider', key: 'xNew', label: 'predict at x =', min: 1.2, max: 5.4, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'segment', key: 'band', label: 'show', options: [{ value: 'conf', label: 'confidence' }, { value: 'pred', label: 'prediction' }, { value: 'both', label: 'both' }] },
      ],
      beats: [
        {
          label: 'the bands',
          note: 'Slide the prediction point out past the data and watch both bands flare. That flare is the model admitting it is guessing.',
          scene: (s, ctx) => {
            const f = fitFrame(s, { padX: 0.3 });
            const { m } = M(s);
            const band = (seFn, key, cls) => {
              const up = [], dn = [];
              for (let i = 0; i <= 60; i++) {
                const xv = f.dx[0] + ((f.dx[1] - f.dx[0]) * i) / 60;
                const pr = m.b0 + m.b1 * xv, w = m.crit * seFn(xv);
                up.push([f.sx(xv), f.sy(pr + w)]);
                dn.unshift([f.sx(xv), f.sy(pr - w)]);
              }
              return path(key, [...up, ...dn], { cls, close: true });
            };
            const xn = +s.xNew;
            const pr = m.b0 + m.b1 * xn;
            return [
              ...axes(f, AXO),
              ...(s.band !== 'conf' ? [band(m.sePred, 'pb', 'area area-warm')] : []),
              ...(s.band !== 'pred' ? [band(m.seFit, 'cb', 'area area-cold')] : []),
              lineItems(f, m.b0, m.b1),
              ...scatter(s, f, ctx),
              vLine(f, xn, { key: 'q', cls: 'rule-gold rule-dash', dur: 200 }),
              { key: 'qp', tag: 'circle', cls: 'pt pt-green', dur: 200, attrs: { cx: f.sx(xn), cy: f.sy(pr), r: 7 } },
              label('ql', f.sx(xn), f.y1 + 6, `${pr.toFixed(1)} min`, { cls: 'lab-big lab-mid lab-green', dur: 200 }),
              ...(xn < Math.min(...M(s).x) || xn > Math.max(...M(s).x)
                ? [label('warn', f.midX, f.y0 - 12, 'you are now extrapolating — the data has nothing to say here', { cls: 'lab lab-mid lab-warm' })]
                : []),
            ];
          },
        },
      ],
    },
  ],
};

function tangentPts(f, fn, x) {
  const y = fn(x), m = st.deriv(fn, x);
  const dx = (f.dx[1] - f.dx[0]) * 0.12;
  return [[f.sx(x - dx), f.sy(y - m * dx)], [f.sx(x + dx), f.sy(y + m * dx)]];
}
