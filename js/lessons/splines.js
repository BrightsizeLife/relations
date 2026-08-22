/* ─────────────────────────────────────────────────────────────────────────────
   splines.js — bending the line without leaving linear regression. The curve
   is hiding in the columns of X.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, arrowDefs } from '../core/plot.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sub, sup, hat, paren, brack, eq, minus, plus, op } from '../core/fx.js';

/* Simulated: a bent, noisy relationship with a known shape, so you can see
   whether a fit is recovering the truth or inventing it. */
const TRUTH = x => 12 + 9 * Math.sin(x / 3.4) + 0.35 * x;
const DATA = (() => {
  const r = st.rng(31415);
  return range(48).map(i => {
    const x = 0.5 + (i * 23.5) / 47;
    return [+x.toFixed(2), +(TRUTH(x) + st.randNorm(r, 0, 1.5)).toFixed(2)];
  });
})();
const XS = DATA.map(p => p[0]), YS = DATA.map(p => p[1]);

const F = () => frame({ w: 720, h: 540, l: 62, r: 28, t: 34, b: 58 });

const baseFrame = () => {
  const f = F();
  f.setX(0, 24.5); f.setY(Math.min(...YS) - 2, Math.max(...YS) + 2);
  return f;
};

const knotsOf = s => range(s.k).map(i => 0.5 + ((i + 1) * 23.5) / (s.k + 1));

function fitOf(s) {
  if (s.model === 'line') {
    const m = st.linreg(XS, YS);
    return { predict: x => m.b0 + m.b1 * x, sse: m.sse, r2: m.r2, df: 2, knots: [] };
  }
  if (s.model === 'poly') {
    const X = XS.map(v => range(s.deg).map(d => v ** (d + 1)));
    const m = st.mlr(X, YS);
    return {
      predict: x => m.beta[0] + st.sum(range(s.deg).map(d => m.beta[d + 1] * x ** (d + 1))),
      sse: m.sse, r2: m.r2, df: s.deg + 1, knots: [],
    };
  }
  const kn = knotsOf(s);
  const sp = st.fitSpline(XS, YS, kn, 3);
  return { predict: sp.predict, sse: sp.sse, r2: sp.r2, df: sp.beta.length, knots: kn, beta: sp.beta };
}

export default {
  meta: {
    id: 'splines', title: 'splines', kicker: 'BENDING THE LINE',
    status: 'live',
    deck: 'A spline is not a new kind of model. It is ordinary least squares, fed some extra columns that have been built so the fitted curve can bend in one place without flailing everywhere else.',
    dataNote: 'Data: <em>simulated</em>, from a known bent function plus noise — so you can judge whether a fit is recovering the real shape or chasing the noise. That comparison is the whole point of this lesson, and it needs a truth to compare against.',
    deps: ['multiple'], unlocks: [],
    next: 'clt', nextLabel: 'normal distributions & the clt',
    outro: 'still linear regression. the nonlinearity is in the columns, not the method.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { model: 'line', deg: 3, k: 3, showTruth: false, showBasis: false },

  steps: [
    {
      title: 'a line is not always enough',
      prose: `<p>Here's a relationship that clearly goes somewhere and then comes back. A straight line does what it can and gets it wrong in three distinct regions — too low at the start, too high in the middle, too low at the end.</p>
        <p>You don't need a test to see this. It's in the residuals: a clean sine wave where there should be noise. That pattern is the model telling you the shape is wrong, not the noise.</p>`,
      readouts: [
        { key: 'n', label: 'points', get: () => DATA.length, d: 0 },
        { key: 'r2', label: 'R² of a line', tone: 'cold', get: () => st.linreg(XS, YS).r2, d: 3, fmt: v => st.fmtR(v, 3), wide: true },
        { key: 'sse', label: 'SSE', tone: 'warm', get: () => st.linreg(XS, YS).sse, d: 0, wide: true },
      ],
      beats: [
        {
          label: 'the data',
          note: 'A bend. Nothing exotic — this is what most real dose-response, growth and seasonal data looks like.',
          scene: () => {
            const f = baseFrame();
            return [
              ...axes(f, { xLabel: 'x', yLabel: 'y' }),
              ...points(f, DATA, { key: 'p', r: 5.5, x: p => p[0], y: p => p[1], cls: 'pt', stagger: 18 }),
            ];
          },
        },
        {
          label: 'the line tries',
          note: 'It is the best straight line available. That is the problem.',
          scene: () => {
            const f = baseFrame();
            const m = st.linreg(XS, YS);
            return [
              ...axes(f, { xLabel: 'x', yLabel: 'y' }),
              fnPath(f, x => m.b0 + m.b1 * x, { key: 'l', cls: 'curve curve-cold' }),
              ...XS.map((v, i) => ({
                key: `r-${i}`, tag: 'line', cls: 'stick stick-resid', delay: i * 16,
                attrs: { x1: f.sx(v), y1: f.sy(m.fit[i]), x2: f.sx(v), y2: f.sy(YS[i]) },
              })),
              ...points(f, DATA, { key: 'p', r: 5.5, x: p => p[0], y: p => p[1], cls: 'pt' }),
            ];
          },
        },
        {
          label: 'the residuals confess',
          note: 'Under, over, under. Structure this obvious is never noise.',
          scene: () => {
            const m = st.linreg(XS, YS);
            const f = F();
            f.setX(0, 24.5);
            const lim = Math.max(...m.resid.map(Math.abs)) * 1.25;
            f.setY(-lim, lim);
            return [
              ...axes(f, { xLabel: 'x', yLabel: 'residual' }),
              hLine(f, 0, { key: 'z', cls: 'curve curve-cold' }),
              ...XS.map((v, i) => ({
                key: `p-${i}`, tag: 'circle', cls: m.resid[i] >= 0 ? 'pt pt-warm' : 'pt pt-cold', delay: i * 16,
                attrs: { cx: f.sx(v), cy: f.sy(m.resid[i]), r: 5 },
              })),
              path('trend', range(50).map(i => {
                const x = (24.5 * i) / 49;
                return [f.sx(x), f.sy(TRUTH(x) - (m.b0 + m.b1 * x))];
              }), { cls: 'curve-ghost curve-dash' }),
            ];
          },
        },
      ],
    },

    {
      title: 'polynomials: the obvious fix, and why it misbehaves',
      prose: `<p>The first thing everyone tries is adding powers of x. Add a column of x², a column of x³, and let least squares sort it out. It's still ordinary regression — you have just handed it more columns.</p>
        <p>For a gentle bend this works fine. But a polynomial is a single global formula: <strong>every coefficient affects the curve everywhere</strong>. Push the degree up to chase a wiggle at one end and the other end goes berserk.</p>
        <p><strong>Crank the degree</strong> and watch the ends start flailing. That instability at the boundaries is the whole reason splines exist.</p>`,
      formula: formula(
        hat('y') + eq + sub('b', '0') + plus + sub('b', '1') + 'x' + plus + sub('b', '2') + sup('x', '2') + plus +
        sub('b', '3') + sup('x', '3') + plus + t('…', { tone: 'muted' }),
        { caption: 'more columns, same solve — but one formula for the whole range' }),
      readouts: [
        { key: 'deg', label: 'degree', tone: 'gold', get: s => s.deg, d: 0 },
        { key: 'par', label: 'parameters', get: s => s.deg + 1, d: 0 },
        { key: 'r2', label: 'R²', tone: 'green', get: s => fitOf({ ...s, model: 'poly' }).r2, d: 4, fmt: v => st.fmtR(v, 4), wide: true },
      ],
      controls: [
        { type: 'slider', key: 'deg', label: 'polynomial degree', min: 1, max: 14, step: 1, fast: true },
        { type: 'toggle', key: 'showTruth', label: 'show the true curve' },
      ],
      beats: [
        {
          label: 'raise the degree',
          note: 'Around degree 5 it looks great. Keep going and the fit starts inventing detail the data does not contain.',
          scene: s => {
            const f = baseFrame();
            const fit = fitOf({ ...s, model: 'poly' });
            return [
              ...axes(f, { xLabel: 'x', yLabel: 'y' }),
              ...(s.showTruth ? [fnPath(f, TRUTH, { key: 'tr', cls: 'curve-ghost curve-dash', n: 200 })] : []),
              fnPath(f, fit.predict, { key: 'fit', cls: 'curve curve-warm', n: 260, dur: 200 }),
              ...points(f, DATA, { key: 'p', r: 5, x: p => p[0], y: p => p[1], cls: 'pt' }),
              label('l', f.x0 + 10, f.y1 + 10, `degree ${s.deg} · R² = ${st.fmtR(fit.r2, 4)}`, { cls: 'lab-big lab-gold', dur: 200 }),
              ...(s.deg >= 10 ? [label('w', f.midX, f.y0 - 14, 'look at the ends — that is not signal', { cls: 'lab lab-mid lab-warm' })] : []),
            ];
          },
        },
      ],
    },

    {
      title: 'the spline idea: bend locally',
      prose: `<p>The fix is almost embarrassingly direct. Pick a few positions along x, called <strong>knots</strong>. Between consecutive knots, fit a separate cubic. Then force the pieces to join up smoothly at each knot — same value, same slope, same curvature.</p>
        <p>The result is one continuous curve made of local pieces. A wiggle in the middle stays in the middle, because the coefficient that produces it is attached to a column that is <em>zero everywhere to the left of its knot</em>.</p>
        <p>That's the truncated power basis, and it's the simplest way to see how the trick works.</p>`,
      formula: formula(
        hat('y') + eq + sub('b', '0') + plus + sub('b', '1') + 'x' + plus + sub('b', '2') + sup('x', '2') + plus + sub('b', '3') + sup('x', '3') +
        plus + t(sub('b', '4') + paren('x − κ₁') + sub(sup('', '3'), '+'), { tone: 'warm', explain: 'This column is exactly zero until x passes the first knot. That is what makes the bend local.' }) +
        plus + t('…', { tone: 'muted' }),
        { size: 'sm', caption: 'the + subscript means "zero if negative" — the column switches on at the knot' }),
      readouts: [
        { key: 'k', label: 'knots', tone: 'gold', get: s => s.k, d: 0 },
        { key: 'par', label: 'parameters', get: s => s.k + 4, d: 0 },
        { key: 'r2', label: 'R²', tone: 'green', get: s => fitOf({ ...s, model: 'spline' }).r2, d: 4, fmt: v => st.fmtR(v, 4), wide: true },
      ],
      controls: [
        { type: 'slider', key: 'k', label: 'number of knots', min: 1, max: 12, step: 1, fast: true },
        { type: 'toggle', key: 'showTruth', label: 'show the true curve' },
      ],
      beats: [
        {
          label: 'place the knots',
          note: 'The vertical lines are the knots. Each one gives the curve permission to change shape at that point, and nowhere else.',
          scene: s => {
            const f = baseFrame();
            const fit = fitOf({ ...s, model: 'spline' });
            return [
              ...axes(f, { xLabel: 'x', yLabel: 'y' }),
              ...fit.knots.map((k, i) => vLine(f, k, { key: `k-${i}`, cls: 'rule-gold rule-dash', dur: 200, tip: `knot at x = <b>${k.toFixed(2)}</b>` })),
              ...(s.showTruth ? [fnPath(f, TRUTH, { key: 'tr', cls: 'curve-ghost curve-dash', n: 200 })] : []),
              fnPath(f, fit.predict, { key: 'fit', cls: 'curve curve-fit', n: 260, dur: 200 }),
              ...points(f, DATA, { key: 'p', r: 5, x: p => p[0], y: p => p[1], cls: 'pt' }),
              label('l', f.x0 + 10, f.y1 + 10,
                `${s.k} knot${s.k === 1 ? '' : 's'} · ${s.k + 4} parameters · R² = ${st.fmtR(fit.r2, 4)}`,
                { cls: 'lab-big lab-green', dur: 200 }),
            ];
          },
        },
        {
          label: 'the pieces underneath',
          hold: 1700,
          note: 'The shaded strips are the regions between knots. Inside each one the curve is a plain cubic; at every boundary the pieces agree to three derivatives, which is why you cannot see the joins.',
          scene: s => {
            const f = baseFrame();
            const fit = fitOf({ ...s, model: 'spline' });
            const edges = [0, ...fit.knots, 24.5];
            return [
              ...axes(f, { xLabel: 'x', yLabel: 'y' }),
              ...edges.slice(0, -1).map((a, i) => rect(`seg-${i}`, f.sx(a), f.y1, f.sx(edges[i + 1]) - f.sx(a), f.y0 - f.y1, {
                cls: i % 2 ? 'sq sq-x' : 'sq sq-y', opacity: 0.35, dur: 200,
              })),
              ...fit.knots.map((k, i) => vLine(f, k, { key: `k-${i}`, cls: 'rule-gold', dur: 200 })),
              fnPath(f, fit.predict, { key: 'fit', cls: 'curve curve-fit', n: 260, dur: 200 }),
              ...points(f, DATA, { key: 'p', r: 4.5, x: p => p[0], y: p => p[1], cls: 'pt', opacity: 0.6 }),
              ...fit.knots.map((k, i) => ({
                key: `kp-${i}`, tag: 'circle', cls: 'pt pt-gold', dur: 200,
                attrs: { cx: f.sx(k), cy: f.sy(fit.predict(k)), r: 6 },
              })),
            ];
          },
        },
      ],
    },

    {
      title: 'the curve is a weighted sum of simple shapes',
      prose: `<p>This is the part worth internalising, because it's the same idea behind Fourier series, wavelets, and most of modern function approximation.</p>
        <p>Each column of your design matrix is a <strong>basis function</strong> — a fixed, simple shape. Regression's only job is to decide how much of each shape to use. The final curve is those shapes, scaled by their coefficients, added together.</p>
        <p>Look at the truncated cubics below. Each one is flat at zero until its knot, then rises. Stack them in the right proportions and you can build almost any smooth shape you like.</p>`,
      readouts: [
        { key: 'k', label: 'knots', tone: 'gold', get: s => s.k, d: 0 },
        { key: 'nb', label: 'basis functions', get: s => s.k + 3, d: 0, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'k', label: 'number of knots', min: 1, max: 8, step: 1, fast: true },
        { type: 'toggle', key: 'showBasis', label: 'scale each shape by its coefficient' },
      ],
      beats: [
        {
          label: 'the raw shapes',
          note: 'x, x², x³, then one truncated cubic per knot. Each stays at zero until its knot switches it on.',
          scene: s => {
            const kn = knotsOf(s);
            const fit = fitOf({ ...s, model: 'spline' });
            const f = F();
            f.setX(0, 24.5);
            const scaled = s.showBasis;
            const vals = [];
            const basisFn = j => x => {
              const b = st.splineBasis(x, kn, 3);
              const raw = b[j];
              return scaled ? raw * fit.beta[j + 1] : raw / Math.max(1e-9, Math.max(...XS.map(v => Math.abs(st.splineBasis(v, kn, 3)[j]))));
            };
            for (let j = 0; j < kn.length + 3; j++) {
              for (const x of [0, 6, 12, 18, 24]) vals.push(basisFn(j)(x));
            }
            const lim = Math.max(...vals.map(Math.abs)) * 1.15 || 1;
            f.setY(scaled ? -lim : -0.1, scaled ? lim : 1.15);
            return [
              ...axes(f, { xLabel: 'x', yLabel: scaled ? 'contribution to ŷ' : 'basis function (scaled to 1)' }),
              hLine(f, 0, { key: 'z', cls: 'rule-faint' }),
              ...kn.map((k, i) => vLine(f, k, { key: `k-${i}`, cls: 'rule-faint rule-dash', dur: 200 })),
              ...range(kn.length + 3).map(j => fnPath(f, basisFn(j), {
                key: `b-${j}`, cls: `curve ${['curve-cyan', 'curve-purple', 'curve-warm', 'curve-fit', 'curve-cold'][j % 5]}`,
                n: 180, dur: 220, opacity: 0.9,
              })),
              label('l', f.x0 + 10, f.y1 + 10,
                scaled ? 'add these up (plus the intercept) and you get the fitted curve' : 'the shapes, before regression decides how much of each to use',
                { cls: 'lab lab-gold', dur: 200 }),
            ];
          },
        },
      ],
    },

    {
      title: 'how many knots?',
      prose: `<p>The knot count is the dial between two failures. Too few and the curve can't follow the real shape — it's biased. Too many and it follows the noise — it's overfit, and it will do badly on data it hasn't seen.</p>
        <p><strong>Turn on the true curve</strong> and slide the knots. Watch R² climb forever while the fit gets visibly worse. R² cannot warn you about this; it goes up every time you add a column, by construction.</p>
        <p>What does warn you is honest out-of-sample error. Here that's shown as leave-one-out cross-validation: refit without each point, then see how badly the model predicts the point it never saw.</p>`,
      aside: `<b>The general shape of this problem never goes away.</b> Bias falls and variance rises as you add flexibility, and the best model sits at the bottom of the sum. Knot counts, polynomial degrees, tree depths, network sizes, regularisation strengths — same trade-off, different dial.`,
      readouts: [
        { key: 'k', label: 'knots', tone: 'gold', get: s => s.k, d: 0 },
        { key: 'r2', label: 'R² (in-sample)', tone: 'cold', get: s => fitOf({ ...s, model: 'spline' }).r2, d: 4, fmt: v => st.fmtR(v, 4), wide: true },
        { key: 'cv', label: 'CV error (honest)', tone: 'warm', get: s => cvError(s.k), d: 3, wide: true },
        { key: 'best', label: 'best knot count', tone: 'green', get: () => bestK(), d: 0, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'k', label: 'number of knots', min: 1, max: 16, step: 1, fast: true },
        { type: 'toggle', key: 'showTruth', label: 'show the true curve' },
      ],
      beats: [
        {
          label: 'overfitting, live',
          note: 'Past about six knots the curve starts hugging individual points. R² keeps rising and the model keeps getting worse.',
          scene: s => {
            const f = baseFrame();
            const fit = fitOf({ ...s, model: 'spline' });
            return [
              ...axes(f, { xLabel: 'x', yLabel: 'y' }),
              ...(s.showTruth ? [fnPath(f, TRUTH, { key: 'tr', cls: 'curve-ghost curve-dash', n: 220 })] : []),
              ...fit.knots.map((k, i) => vLine(f, k, { key: `k-${i}`, cls: 'rule-faint rule-dash', dur: 200 })),
              fnPath(f, fit.predict, { key: 'fit', cls: 'curve curve-fit', n: 300, dur: 200 }),
              ...points(f, DATA, { key: 'p', r: 5, x: p => p[0], y: p => p[1], cls: 'pt' }),
              label('l', f.x0 + 10, f.y1 + 10,
                `${s.k} knots · R² = ${st.fmtR(fit.r2, 4)} · CV error = ${cvError(s.k).toFixed(3)}`,
                { cls: 'lab-big lab-gold', dur: 200 }),
            ];
          },
        },
        {
          label: 'the two curves that matter',
          note: 'In-sample error only ever falls. Out-of-sample error falls, bottoms out, then climbs. <b>The bottom is your answer.</b>',
          scene: s => {
            const ks = range(16).map(i => i + 1);
            const cvs = ks.map(cvError);
            const ins = ks.map(k => fitOf({ model: 'spline', k }).sse / DATA.length);
            const f = F();
            f.setX(1, 16);
            f.setY(0, Math.max(...cvs.slice(0, 14)) * 1.2);
            return [
              ...axes(f, { xLabel: 'number of knots', yLabel: 'mean squared error', xN: 6, yN: 5 }),
              path('ins', ks.map((k, i) => [f.sx(k), f.sy(ins[i])]), { cls: 'curve curve-cold' }),
              path('cv', ks.map((k, i) => [f.sx(k), f.sy(Math.min(cvs[i], f.dy[1]))]), { cls: 'curve curve-warm' }),
              ...ks.map((k, i) => ({
                key: `c-${i}`, tag: 'circle', cls: 'pt pt-warm', delay: i * 45,
                attrs: { cx: f.sx(k), cy: f.sy(Math.min(cvs[i], f.dy[1])), r: 4.5 },
                tip: `${k} knots<br>CV error <b>${cvs[i].toFixed(3)}</b>`,
              })),
              vLine(f, bestK(), { key: 'bk', cls: 'rule-gold rule-dash' }),
              { key: 'now', tag: 'circle', cls: 'pt pt-green', dur: 200, attrs: { cx: f.sx(s.k), cy: f.sy(Math.min(cvError(s.k), f.dy[1])), r: 8 } },
              label('l1', f.x1 - 6, f.sy(ins[13]) - 10, 'in-sample — always improving, always lying', { cls: 'lab-sm lab-cold lab-end' }),
              label('l2', f.x1 - 6, f.y1 + 14, 'cross-validated — the honest one', { cls: 'lab-sm lab-warm lab-end' }),
              label('l3', f.sx(bestK()), f.y1 + 34, `best: ${bestK()} knots`, { cls: 'lab lab-mid lab-gold' }),
            ];
          },
        },
      ],
    },
  ],
};

/* leave-one-out CV, cached because the slider redraws often */
const cvCache = new Map();
function cvError(k) {
  if (cvCache.has(k)) return cvCache.get(k);
  const kn = range(k).map(i => 0.5 + ((i + 1) * 23.5) / (k + 1));
  let tot = 0, used = 0;
  for (let i = 0; i < DATA.length; i++) {
    const xs = XS.filter((_, j) => j !== i), ys = YS.filter((_, j) => j !== i);
    const sp = st.fitSpline(xs, ys, kn, 3);
    if (!sp) continue;
    const pred = sp.predict(XS[i]);
    if (!isFinite(pred)) continue;
    tot += (YS[i] - pred) ** 2;
    used++;
  }
  const v = used ? tot / used : NaN;
  cvCache.set(k, v);
  return v;
}
function bestK() {
  let best = 1, bv = Infinity;
  for (let k = 1; k <= 16; k++) {
    const v = cvError(k);
    if (isFinite(v) && v < bv) { bv = v; best = k; }
  }
  return best;
}
