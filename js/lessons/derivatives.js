/* ─────────────────────────────────────────────────────────────────────────────
   derivatives.js — slope at an instant. The tool every model on this site uses
   to find its own best fit.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, arrowDefs } from '../core/plot.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sub, sup, paren, eq, minus, op } from '../core/fx.js';

const F = () => frame({ w: 720, h: 540, l: 66, r: 28, t: 34, b: 58 });

const FNS = {
  cubic: { f: x => 0.12 * x ** 3 - 0.9 * x ** 2 + 1.4 * x + 3, d: x => 0.36 * x ** 2 - 1.8 * x + 1.4, lab: '0.12x³ − 0.9x² + 1.4x + 3', lo: -1.5, hi: 7.5, ylo: -1, yhi: 8 },
  sine: { f: x => 3 * Math.sin(x) + 3, d: x => 3 * Math.cos(x), lab: '3·sin(x) + 3', lo: -1, hi: 8, ylo: -1, yhi: 7 },
  exp: { f: x => Math.exp(0.45 * x), d: x => 0.45 * Math.exp(0.45 * x), lab: 'e^0.45x', lo: -1, hi: 6, ylo: -1, yhi: 16 },
  loss: { f: x => 0.6 * (x - 3.2) ** 2 + 1.1, d: x => 1.2 * (x - 3.2), lab: 'a loss function', lo: -1, hi: 7.5, ylo: -1, yhi: 12 },
};

export default {
  meta: {
    id: 'derivatives', title: 'derivatives', kicker: 'FOUNDATION',
    status: 'live',
    deck: 'A derivative is a slope measured at a single instant, reached by squeezing a secant line until its two points merge. It matters here for one very practical reason: setting a derivative to zero is how every model on this site finds its best fit.',
    dataNote: 'No dataset — the curves are drawn from the formulas shown, and every slope is computed numerically at the point you choose.',
    deps: ['limits'], unlocks: ['integrals'],
    next: 'integrals', nextLabel: 'integrals',
    outro: 'the slope at a point, and the fact that it is zero at the bottom of every valley.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { fn: 'cubic', x: 2, h: 1.2, lr: 0.25, steps: 0 },

  steps: [
    {
      title: 'from average rate to instant rate',
      prose: `<p>Over an interval, "rate of change" is easy: rise over run. The trouble is that a curve's slope keeps changing <em>within</em> the interval, so the average is a compromise nobody quite experiences.</p>
        <p>Shrink the interval and the compromise gets less severe. Take it to zero — the limit from the last lesson — and you get the slope at one exact point.</p>
        <p><strong>Squeeze h to zero</strong> and watch the dashed secant settle onto the tangent.</p>`,
      formula: formula(
        t('f′(x)', { tone: 'green' }) + eq + 'lim' + sub('', 'h→0') +
        frac('f(x+' + t('h', { tone: 'warm' }) + ') − f(x)', t('h', { tone: 'warm' })),
        { caption: 'rise over run, with the run taken to nothing' }),
      readouts: [
        { key: 'h', label: 'h', tone: 'warm', get: s => +s.h, d: 4 },
        { key: 'sec', label: 'secant slope', tone: 'gold', get: s => (FNS[s.fn].f(+s.x + +s.h) - FNS[s.fn].f(+s.x)) / +s.h, d: 5, wide: true },
        { key: 'tan', label: 'true derivative', tone: 'green', get: s => FNS[s.fn].d(+s.x), d: 5, wide: true },
        { key: 'err', label: 'error', tone: 'cold', get: s => Math.abs((FNS[s.fn].f(+s.x + +s.h) - FNS[s.fn].f(+s.x)) / +s.h - FNS[s.fn].d(+s.x)), d: 5, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'h', label: 'interval h', min: 0.001, max: 2.5, step: 0.001, fast: true, fmt: v => (+v).toFixed(3) },
        { type: 'slider', key: 'x', label: 'at x =', min: -0.5, max: 6.5, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'segment', key: 'fn', label: 'function', options: [{ value: 'cubic', label: 'cubic' }, { value: 'sine', label: 'sine' }, { value: 'exp', label: 'exponential' }] },
      ],
      beats: [
        {
          label: 'the secant collapses',
          note: 'The warm dashed line is the secant. The green line is the true tangent. Squeeze h and they become the same line.',
          scene: s => {
            const C = FNS[s.fn];
            const f = F();
            f.setX(C.lo, C.hi); f.setY(C.ylo, C.yhi);
            const x0 = +s.x, h = +s.h;
            const m = (C.f(x0 + h) - C.f(x0)) / h;
            const dTrue = C.d(x0);
            const ln = (slope, key, cls) => path(key, [
              [f.sx(C.lo), f.sy(C.f(x0) + slope * (C.lo - x0))],
              [f.sx(C.hi), f.sy(C.f(x0) + slope * (C.hi - x0))],
            ], { cls, dur: 160 });
            return [
              ...axes(f, { xLabel: 'x', yLabel: 'f(x)' }),
              fnPath(f, C.f, { key: 'c', cls: 'curve', n: 260 }),
              ln(dTrue, 'tan', 'curve curve-fit'),
              ln(m, 'sec', 'curve curve-warm curve-dash'),
              { key: 'run', tag: 'line', cls: 'stick stick-x', dur: 160, attrs: { x1: f.sx(x0), y1: f.sy(C.f(x0)), x2: f.sx(x0 + h), y2: f.sy(C.f(x0)) } },
              { key: 'rise', tag: 'line', cls: 'stick stick-pos', dur: 160, attrs: { x1: f.sx(x0 + h), y1: f.sy(C.f(x0)), x2: f.sx(x0 + h), y2: f.sy(C.f(x0 + h)) } },
              label('runl', f.sx(x0 + h / 2), f.sy(C.f(x0)) + 16, `h = ${h.toFixed(3)}`, { cls: 'lab-sm lab-mid lab-cyan', dur: 160 }),
              { key: 'p1', tag: 'circle', cls: 'pt pt-green', dur: 160, attrs: { cx: f.sx(x0), cy: f.sy(C.f(x0)), r: 7 } },
              { key: 'p2', tag: 'circle', cls: 'pt pt-warm', dur: 160, attrs: { cx: f.sx(x0 + h), cy: f.sy(C.f(x0 + h)), r: 7 } },
              numLabel('ml', f.x0 + 10, f.y1 + 10, m, { cls: 'lab-big lab-gold', d: 4, pre: 'secant slope = ', dur: 160 }),
              numLabel('dl', f.x0 + 10, f.y1 + 30, dTrue, { cls: 'lab lab-green', d: 4, pre: 'derivative = ' }),
            ];
          },
        },
      ],
    },

    {
      title: 'the derivative is itself a function',
      prose: `<p>Do that at every x and you get a second curve: the slope of the first one, plotted against position.</p>
        <p>Read the two together and they narrate each other. Where the top curve climbs, the bottom is positive. Where it flattens at a peak or a trough, the bottom <strong>crosses zero</strong>. Where it plunges, the bottom is negative.</p>
        <p>That zero-crossing is the whole reason we care.</p>`,
      formula: formula(
        t('f', { tone: 'gold' }) + ' rising ⟺ ' + t('f′ > 0', { tone: 'green' }) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('f', { tone: 'gold' }) + ' flat ⟺ ' + t('f′ = 0', { tone: 'warm' }) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('f', { tone: 'gold' }) + ' falling ⟺ ' + t('f′ < 0', { tone: 'cold' }),
        { size: 'sm', caption: 'the sign of the derivative is the direction of travel' }),
      readouts: [
        { key: 'x', label: 'at x', get: s => +s.x, d: 2 },
        { key: 'fx', label: 'f(x)', tone: 'gold', get: s => FNS[s.fn].f(+s.x), d: 3, wide: true },
        { key: 'dx', label: "f′(x)", tone: 'green', get: s => FNS[s.fn].d(+s.x), d: 3, wide: true },
        { key: 'dir', label: 'so the curve is', wide: true, get: s => {
          const d = FNS[s.fn].d(+s.x);
          return Math.abs(d) < 0.05 ? 'flat — a turning point' : d > 0 ? 'climbing' : 'falling';
        } },
      ],
      controls: [
        { type: 'slider', key: 'x', label: 'at x =', min: -0.5, max: 6.5, step: 0.02, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'segment', key: 'fn', label: 'function', options: [{ value: 'cubic', label: 'cubic' }, { value: 'sine', label: 'sine' }, { value: 'exp', label: 'exponential' }] },
      ],
      beats: [
        {
          label: 'the two curves together',
          note: 'Move the marker and read across. Note where the lower curve hits zero and what the upper one is doing there.',
          scene: s => {
            const C = FNS[s.fn];
            const fa = frame({ w: 720, h: 540, l: 66, r: 28, t: 26, b: 300 });
            fa.setX(C.lo, C.hi); fa.setY(C.ylo, C.yhi);
            const fb = frame({ w: 720, h: 540, l: 66, r: 28, t: 300, b: 58 });
            fb.setX(C.lo, C.hi);
            const dv = range(60).map(i => C.d(C.lo + ((C.hi - C.lo) * i) / 59));
            fb.setY(Math.min(...dv) * 1.2 - 0.3, Math.max(...dv) * 1.2 + 0.3);
            const x0 = +s.x;
            return [
              ...axes(fa, { yLabel: 'f(x)', prefix: 'a', showX: false, xN: 0, yN: 4 }),
              fnPath(fa, C.f, { key: 'c', cls: 'curve', n: 260 }),
              ...axes(fb, { xLabel: 'x', yLabel: "f′(x)", prefix: 'b', yN: 4 }),
              hLine(fb, 0, { key: 'z', cls: 'rule-gold rule-dash' }),
              fnPath(fb, C.d, { key: 'd', cls: 'curve curve-fit', n: 260 }),
              { key: 'vl', tag: 'line', cls: 'rule-faint rule-dash', dur: 160, attrs: { x1: fa.sx(x0), y1: fa.y1, x2: fa.sx(x0), y2: fb.y0 } },
              { key: 'pa', tag: 'circle', cls: 'pt pt-gold', dur: 160, attrs: { cx: fa.sx(x0), cy: fa.sy(C.f(x0)), r: 7 } },
              { key: 'pb', tag: 'circle', cls: 'pt pt-green', dur: 160, attrs: { cx: fb.sx(x0), cy: fb.sy(C.d(x0)), r: 7 } },
              path('tan', [
                [fa.sx(x0 - 1), fa.sy(C.f(x0) - C.d(x0))],
                [fa.sx(x0 + 1), fa.sy(C.f(x0) + C.d(x0))],
              ], { cls: 'curve curve-warm', dur: 160 }),
              ...(Math.abs(C.d(x0)) < 0.08
                ? [label('tp', fa.sx(x0), fa.sy(C.f(x0)) - 18, 'turning point', { cls: 'lab lab-mid lab-warm' })] : []),
            ];
          },
        },
      ],
    },

    {
      title: 'why every model on this site needs one',
      prose: `<p>Fitting a model means finding the parameter values that make some loss as small as possible. The loss is a function of the parameters — a landscape — and you're looking for the bottom of a valley.</p>
        <p>At the bottom, the ground is flat. <strong>The derivative is zero.</strong> So instead of searching, you write down the derivative, set it equal to zero, and solve.</p>
        <p>That single move produced the regression formulas in the linear regression lesson, and everything after them. When the equation can't be solved in closed form — logistic, Poisson, anything with a link function — you follow the slope downhill instead, which is the next beat.</p>`,
      formula: formula(
        frac('d', 'db') + ' SS(b) ' + eq + ' 0' +
        op('&nbsp;&nbsp;→&nbsp;&nbsp;') + t('solve for b', { tone: 'green' }) +
        op('&nbsp;&nbsp;→&nbsp;&nbsp;') + t('the least-squares estimate', { tone: 'gold' }),
        { caption: 'the flat point at the bottom of the bowl' }),
      dep: { note: 'This is where the closed-form regression slope came from.', lesson: 'linreg', label: 'linear regression' },
      readouts: [
        { key: 'b', label: 'current parameter', tone: 'gold', get: s => gdPos(s), d: 4, wide: true },
        { key: 'loss', label: 'loss', tone: 'warm', get: s => FNS.loss.f(gdPos(s)), d: 4, wide: true },
        { key: 'grad', label: 'gradient', tone: 'cyan', get: s => FNS.loss.d(gdPos(s)), d: 4, wide: true },
        { key: 'opt', label: 'the true minimum', tone: 'green', get: () => 3.2, d: 2, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'steps', label: 'gradient descent steps', min: 0, max: 30, step: 1, fast: true },
        { type: 'slider', key: 'lr', label: 'learning rate', min: 0.02, max: 1.75, step: 0.01, fast: true, fmt: v => (+v).toFixed(2) },
      ],
      beats: [
        {
          label: 'roll downhill',
          note: 'Each step moves against the gradient, by an amount set by the learning rate. <b>Push the learning rate past about 1.6 and it overshoots and diverges</b> — the same failure that blows up a badly tuned neural net.',
          scene: s => {
            const C = FNS.loss;
            const f = F();
            f.setX(-1, 7.5); f.setY(-1, 14);
            const path_ = gdPath(s);
            return [
              ...axes(f, { xLabel: 'parameter value', yLabel: 'loss' }),
              fnPath(f, C.f, { key: 'c', cls: 'curve', n: 240 }),
              vLine(f, 3.2, { key: 'min', cls: 'rule-gold rule-dash' }),
              label('minl', f.sx(3.2), f.y0 - 10, 'the minimum', { cls: 'lab-sm lab-mid lab-gold' }),
              ...path_.map((p, i) => [
                i > 0 ? path(`s-${i}`, [
                  [f.sx(clamp(path_[i - 1], -1, 7.5)), f.sy(clamp(C.f(path_[i - 1]), -1, 14))],
                  [f.sx(clamp(p, -1, 7.5)), f.sy(clamp(C.f(p), -1, 14))],
                ], { cls: 'curve curve-warm', dur: 180, opacity: 0.5, set: { 'stroke-width': 1.2 } }) : null,
                {
                  key: `p-${i}`, tag: 'circle', cls: i === path_.length - 1 ? 'pt pt-green' : 'pt pt-warm', dur: 180,
                  attrs: { cx: f.sx(clamp(p, -1, 7.5)), cy: f.sy(clamp(C.f(p), -1, 14)), r: i === path_.length - 1 ? 8 : 4 },
                  opacity: i === path_.length - 1 ? 1 : 0.55,
                },
              ]),
              label('l', f.x0 + 10, f.y1 + 10,
                `step ${s.steps} · learning rate ${(+s.lr).toFixed(2)}`, { cls: 'lab-big lab-gold', dur: 180 }),
              label('l2', f.x0 + 10, f.y1 + 30,
                +s.lr > 1.66 ? 'diverging — the steps are bigger than the valley'
                  : +s.lr < 0.1 ? 'converging, but painfully slowly'
                    : 'converging nicely',
                { cls: `lab ${+s.lr > 1.66 ? 'lab-warm' : 'lab-green'}`, dur: 180 }),
            ];
          },
        },
      ],
    },

    {
      title: 'the chain rule, which you have already been using',
      prose: `<p>One rule deserves singling out, because every model with a link function depends on it.</p>
        <p>If a quantity passes through two machines in sequence, the sensitivities <strong>multiply</strong>. Wiggle the input by a little; the first machine amplifies it by its slope; the second amplifies that by its slope.</p>
        <p>This is exactly what happens in a GLM: the linear predictor feeds into the link's inverse, which feeds into the loss. To differentiate the loss with respect to a coefficient you chain those slopes together — and that product is precisely the <span class="cs-inline-code">dμ/dη</span> factor that appears in the IRLS weights.</p>
        <p>It is also, run in reverse across many layers, the entirety of backpropagation.</p>`,
      formula: formula(
        frac('d', 'dx') + ' f' + paren('g(x)') + eq +
        t("f′(g(x))", { tone: 'warm', explain: 'How sensitive the outer machine is, evaluated where the inner one put you.' }) + ' · ' +
        t("g′(x)", { tone: 'cyan', explain: 'How sensitive the inner machine is.' }),
        { caption: 'sensitivities multiply through a chain' }),
      dep: { note: 'The dμ/dη in the IRLS weights is one link of this chain.', lesson: 'glm', label: 'the glm idea' },
      readouts: [
        { key: 'x', label: 'x', get: s => +s.x, d: 2 },
        { key: 'g', label: 'inner slope g′', tone: 'cyan', get: s => st.deriv(x => 0.5 * x * x, +s.x), d: 3, wide: true },
        { key: 'f', label: 'outer slope f′', tone: 'warm', get: s => st.deriv(Math.sin, 0.5 * s.x * s.x), d: 3, wide: true },
        { key: 'ch', label: 'product', tone: 'green', get: s => st.deriv(x => Math.sin(0.5 * x * x), +s.x), d: 3, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'x', label: 'x', min: 0.1, max: 3.4, step: 0.02, fast: true, fmt: v => (+v).toFixed(2) },
      ],
      beats: [
        {
          label: 'two machines in a row',
          note: 'A small wiggle at the input is magnified twice on its way through. The total magnification is the product of the two.',
          scene: s => {
            const x = +s.x;
            const g = v => 0.5 * v * v, fo = v => Math.sin(v);
            const gp = st.deriv(g, x), fp = st.deriv(fo, g(x));
            const items = [
              rect('b1', 200, 190, 140, 90, { cls: 'cell' }),
              rect('b2', 420, 190, 140, 90, { cls: 'cell' }),
              label('l1', 270, 230, 'g: half x²', { cls: 'lab lab-mid lab-cyan' }),
              label('l2', 490, 230, 'f: sine', { cls: 'lab lab-mid lab-warm' }),
              path('a0', [[100, 235], [192, 235]], { cls: 'arrow' }),
              path('a1', [[348, 235], [412, 235]], { cls: 'arrow' }),
              path('a2', [[568, 235], [640, 235]], { cls: 'arrow arrow-warm' }),
              numLabel('v0', 88, 240, x, { cls: 'lab-big lab-end lab-cyan', d: 2, dur: 200 }),
              numLabel('v1', 380, 224, g(x), { cls: 'lab lab-mid', d: 2, dur: 200 }),
              numLabel('v2', 655, 240, fo(g(x)), { cls: 'lab-big lab-green', d: 3, dur: 200 }),
              label('s1', 270, 300, `slope ${gp.toFixed(3)}`, { cls: 'lab lab-mid lab-cyan', dur: 200 }),
              label('s2', 490, 300, `slope ${fp.toFixed(3)}`, { cls: 'lab lab-mid lab-warm', dur: 200 }),
              label('mult', 380, 350, '×', { cls: 'lab-big lab-mid' }),
              numLabel('tot', 380, 400, gp * fp, { cls: 'lab-big lab-mid lab-green', d: 4, pre: 'total slope = ', dur: 200 }),
              label('chk', 380, 428, `direct numerical check: ${st.deriv(v => Math.sin(0.5 * v * v), x).toFixed(4)}`, { cls: 'lab-sm lab-mid', dur: 200 }),
            ];
            return items;
          },
        },
      ],
    },
  ],
};

function gdPath(s) {
  const C = FNS.loss;
  const out = [0.4];
  let x = 0.4;
  for (let i = 0; i < s.steps; i++) {
    x = x - s.lr * C.d(x);
    if (!isFinite(x) || Math.abs(x) > 1e6) { out.push(x); break; }
    out.push(x);
  }
  return out;
}
const gdPos = s => gdPath(s).at(-1);
