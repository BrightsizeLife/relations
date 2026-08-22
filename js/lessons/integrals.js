/* ─────────────────────────────────────────────────────────────────────────────
   integrals.js — slice, multiply, add, shrink the slices. Every p-value on this
   site is an integral somebody else already did for you.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, fnArea, arrowDefs } from '../core/plot.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sub, sup, intOver, paren, eq, minus, op } from '../core/fx.js';

const F = () => frame({ w: 720, h: 540, l: 66, r: 28, t: 34, b: 58 });

const FNS = {
  hump: { f: x => 0.35 * x * x - 0.06 * x ** 3 + 1, F: x => (0.35 / 3) * x ** 3 - 0.015 * x ** 4 + x, lab: '0.35x² − 0.06x³ + 1', lo: 0, hi: 6 },
  sine: { f: x => 2 + 1.6 * Math.sin(x), F: x => 2 * x - 1.6 * Math.cos(x), lab: '2 + 1.6·sin(x)', lo: 0, hi: 6 },
  line: { f: x => 0.6 * x + 0.5, F: x => 0.3 * x * x + 0.5 * x, lab: '0.6x + 0.5', lo: 0, hi: 6 },
};

export default {
  meta: {
    id: 'integrals', title: 'integrals', kicker: 'FOUNDATION',
    status: 'live',
    deck: 'An integral is an area, computed by slicing something into rectangles you <em>can</em> measure and then making the slices infinitely thin. It is also, quietly, the thing that turns a probability density into an actual probability — which is where every p-value on this site comes from.',
    dataNote: 'No dataset. The curves come from the formulas shown and every area is computed numerically as you change the slicing.',
    deps: ['limits', 'derivatives'], unlocks: [],
    next: 'entropy', nextLabel: 'entropy & information',
    outro: 'a sum of rectangles, taken to its limit — and the reason a shaded tail is a probability.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { fn: 'hump', n: 6, rule: 'left', a: 1, b: 5, z: 1.96 },

  steps: [
    {
      title: 'the area under a curve',
      prose: `<p>The area of a rectangle is easy. The area under a curve is not, because the top keeps moving.</p>
        <p>So cheat: chop the region into thin vertical strips, pretend each strip is a rectangle, add them up. The answer is wrong — but it gets less wrong as the strips get thinner, and "less wrong without limit" is exactly what a limit is for.</p>
        <p><strong>Slide the number of slices</strong> and watch the error collapse.</p>`,
      formula: formula(
        intOver('f(x) dx', { from: 'a', to: 'b' }) + op('&nbsp;=&nbsp;lim') + sub('', 'n→∞') +
        ' Σ f' + paren(sub('x', 'i')) + ' · ' + t('Δx', { tone: 'gold', explain: 'The width of one slice. As n grows, this shrinks.' }),
        { caption: 'height × width, added up, with the width taken to zero' }),
      readouts: [
        { key: 'n', label: 'slices', tone: 'gold', get: s => s.n, d: 0 },
        { key: 'est', label: 'estimated area', tone: 'warm', get: s => riem(s).total, d: 5, wide: true },
        { key: 'true', label: 'exact area', tone: 'green', get: s => exact(s), d: 5, wide: true },
        { key: 'err', label: 'error', tone: 'cold', get: s => Math.abs(riem(s).total - exact(s)), d: 5, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'n', label: 'slices', min: 1, max: 200, step: 1, fast: true },
        { type: 'segment', key: 'rule', label: 'measure each slice at its', options: [{ value: 'left', label: 'left' }, { value: 'right', label: 'right' }, { value: 'mid', label: 'middle' }, { value: 'trap', label: 'trapezoid' }] },
        { type: 'segment', key: 'fn', label: 'curve', options: [{ value: 'hump', label: 'hump' }, { value: 'sine', label: 'wave' }, { value: 'line', label: 'line' }] },
      ],
      beats: [
        {
          label: 'rectangles',
          note: 'Left rule undershoots on a rising curve, right rule overshoots. The <b>midpoint</b> rule is far better than either, for free.',
          scene: s => {
            const C = FNS[s.fn];
            const r = riem(s);
            const f = F();
            f.setX(-0.2, 6.2);
            f.setY(0, Math.max(...range(60).map(i => C.f((6 * i) / 59))) * 1.2);
            return [
              ...axes(f, { xLabel: 'x', yLabel: 'f(x)' }),
              ...r.bars.map((b, i) => rect(`b-${i}`, f.sx(b.x0), f.sy(b.h), f.sx(b.x1) - f.sx(b.x0), f.y0 - f.sy(b.h), {
                cls: 'sq sq-pos', dur: 200,
                tip: `slice ${i + 1}<br>height ${b.h.toFixed(3)} × width ${r.h.toFixed(3)}<br>= <b>${b.area.toFixed(4)}</b>`,
              })),
              fnPath(f, C.f, { key: 'c', cls: 'curve', n: 240 }),
              vLine(f, +s.a, { key: 'av', cls: 'rule-gold rule-dash' }),
              vLine(f, +s.b, { key: 'bv', cls: 'rule-gold rule-dash' }),
              label('l', f.x0 + 10, f.y1 + 10,
                `${s.n} slice${s.n === 1 ? '' : 's'} · ${s.rule} rule · area ≈ ${r.total.toFixed(5)}`, { cls: 'lab-big lab-gold', dur: 200 }),
              label('l2', f.x0 + 10, f.y1 + 30, `exact: ${exact(s).toFixed(5)}`, { cls: 'lab lab-green' }),
            ];
          },
        },
        {
          label: 'error against slice count',
          note: 'On a log scale the rules separate cleanly. Doubling the slices halves the error for the left rule and quarters it for the midpoint rule.',
          scene: s => {
            const f = F();
            f.setX(1, 60);
            const errFor = (n, rule) => Math.abs(riem({ ...s, n, rule }).total - exact(s));
            f.setY(0, errFor(2, 'left') * 1.1);
            return [
              ...axes(f, { xLabel: 'number of slices', yLabel: 'absolute error', yN: 5 }),
              ...['left', 'right', 'mid', 'trap'].map((rule, i) =>
                path(`e-${i}`, range(59).map(k => {
                  const n = k + 2;
                  return [f.sx(n), f.sy(Math.min(errFor(n, rule), f.dy[1]))];
                }), { cls: `curve ${['curve-warm', 'curve-cold', 'curve-fit', 'curve-purple'][i]}`, delay: i * 160 })),
              ...['left', 'right', 'midpoint', 'trapezoid'].map((nm, i) =>
                label(`el-${i}`, f.x1 - 6, f.y1 + 12 + i * 18, nm,
                  { cls: `lab-sm lab-end ${['lab-warm', 'lab-cold', 'lab-green', 'lab-purple'][i]}`, delay: i * 160 })),
              { key: 'now', tag: 'circle', cls: 'pt pt-gold', dur: 200, attrs: { cx: f.sx(Math.min(60, s.n)), cy: f.sy(Math.min(errFor(Math.min(60, s.n), s.rule), f.dy[1])), r: 7 } },
            ];
          },
        },
      ],
    },

    {
      title: 'the accumulated area is a function too',
      prose: `<p>Instead of one fixed region, let the right-hand edge slide. The area you've swept out so far is a function of where that edge is.</p>
        <p>Watch the two panels together. Where the curve is <em>tall</em>, the accumulated area climbs steeply. Where the curve is near zero, the accumulation flattens off. Where the curve dips below the axis, the accumulation actually goes down.</p>
        <p>Which is to say: the height of the top curve is the <strong>slope</strong> of the bottom one. That's not a coincidence, and it has a name.</p>`,
      readouts: [
        { key: 'b', label: 'right edge at', tone: 'gold', get: s => +s.b, d: 2 },
        { key: 'h', label: 'height there', tone: 'warm', get: s => FNS[s.fn].f(+s.b), d: 3, wide: true },
        { key: 'area', label: 'area so far', tone: 'green', get: s => FNS[s.fn].F(+s.b) - FNS[s.fn].F(0), d: 3, wide: true },
        { key: 'slope', label: 'slope of the area curve', tone: 'cyan', wide: true, get: s => st.deriv(x => FNS[s.fn].F(x) - FNS[s.fn].F(0), +s.b), d: 3 },
      ],
      controls: [
        { type: 'slider', key: 'b', label: 'sweep the right edge', min: 0.05, max: 6, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'segment', key: 'fn', label: 'curve', options: [{ value: 'hump', label: 'hump' }, { value: 'sine', label: 'wave' }, { value: 'line', label: 'line' }] },
      ],
      beats: [
        {
          label: 'sweep it out',
          note: 'Top: the curve and the shaded area so far. Bottom: that area, plotted. Compare the two readouts on the right — <b>they are the same number</b>.',
          scene: s => {
            const C = FNS[s.fn];
            const fa = frame({ w: 720, h: 540, l: 66, r: 28, t: 26, b: 300 });
            fa.setX(-0.2, 6.2);
            fa.setY(0, Math.max(...range(60).map(i => C.f((6 * i) / 59))) * 1.2);
            const fb = frame({ w: 720, h: 540, l: 66, r: 28, t: 300, b: 58 });
            fb.setX(-0.2, 6.2);
            fb.setY(0, (C.F(6) - C.F(0)) * 1.15);
            const b = +s.b;
            return [
              ...axes(fa, { yLabel: 'f(x)', prefix: 'a', showX: false, xN: 0, yN: 3 }),
              fnArea(fa, C.f, 0, b, { key: 'ar', cls: 'area area-green', base: 0, dur: 160 }),
              fnPath(fa, C.f, { key: 'c', cls: 'curve', n: 240 }),
              { key: 'edge', tag: 'line', cls: 'rule-gold', dur: 160, attrs: { x1: fa.sx(b), y1: fa.y0, x2: fa.sx(b), y2: fa.sy(C.f(b)) } },
              { key: 'hp', tag: 'circle', cls: 'pt pt-warm', dur: 160, attrs: { cx: fa.sx(b), cy: fa.sy(C.f(b)), r: 6 } },
              ...axes(fb, { xLabel: 'x', yLabel: 'area accumulated', prefix: 'b', yN: 3 }),
              path('acc', range(120).filter(i => (6 * i) / 119 <= b).map(i => {
                const x = (6 * i) / 119;
                return [fb.sx(x), fb.sy(C.F(x) - C.F(0))];
              }), { cls: 'curve curve-fit', dur: 160 }),
              { key: 'ap', tag: 'circle', cls: 'pt pt-green', dur: 160, attrs: { cx: fb.sx(b), cy: fb.sy(C.F(b) - C.F(0)), r: 7 } },
              path('tang', [
                [fb.sx(b - 0.8), fb.sy(C.F(b) - C.F(0) - 0.8 * C.f(b))],
                [fb.sx(b + 0.8), fb.sy(C.F(b) - C.F(0) + 0.8 * C.f(b))],
              ], { cls: 'curve curve-warm curve-dash', dur: 160 }),
              label('tl', fb.sx(b) + 10, fb.sy(C.F(b) - C.F(0)) - 12,
                `slope here = ${C.f(b).toFixed(3)}`, { cls: 'lab lab-warm', dur: 160 }),
            ];
          },
        },
      ],
    },

    {
      title: 'the fundamental theorem',
      prose: `<p>The observation from the last step, stated properly: <strong>differentiation and integration undo each other.</strong></p>
        <p>That is a genuinely astonishing thing to be true. Slopes and areas have no obvious relationship — one is about steepness at a point, the other about accumulation over a region. And yet each is the other's inverse.</p>
        <p>The practical consequence is enormous. To find an area exactly, you don't have to sum infinitely many rectangles. You just have to find a function whose derivative is your curve, and subtract its values at the two ends.</p>`,
      formula: formula(
        intOver('f(x) dx', { from: 'a', to: 'b' }) + eq + t('F(b)', { tone: 'green' }) + minus + t('F(a)', { tone: 'cold' }) +
        op('&nbsp;&nbsp;where&nbsp;&nbsp;') + t('F′ = f', { tone: 'gold' }),
        { size: 'lg', caption: 'find the antiderivative, evaluate at the ends, subtract' }),
      dep: { note: 'The other half of this pair is the previous lesson.', lesson: 'derivatives', label: 'derivatives' },
      readouts: [
        { key: 'a', label: 'a', tone: 'cold', get: s => +s.a, d: 2 },
        { key: 'b', label: 'b', tone: 'green', get: s => +s.b, d: 2 },
        { key: 'Fb', label: 'F(b)', tone: 'green', get: s => FNS[s.fn].F(+s.b), d: 4, wide: true },
        { key: 'Fa', label: 'F(a)', tone: 'cold', get: s => FNS[s.fn].F(+s.a), d: 4, wide: true },
        { key: 'diff', label: 'the area', tone: 'gold', get: s => FNS[s.fn].F(+s.b) - FNS[s.fn].F(+s.a), d: 4, wide: true },
        { key: 'num', label: 'numerical check', get: s => st.simpson(FNS[s.fn].f, +s.a, +s.b), d: 4, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'a', label: 'from a =', min: 0, max: 5.5, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'slider', key: 'b', label: 'to b =', min: 0.5, max: 6, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
      ],
      beats: [
        {
          label: 'subtract the two ends',
          note: 'No slicing. Two evaluations of the antiderivative and one subtraction — and the numerical check agrees to four decimals.',
          scene: s => {
            const C = FNS[s.fn];
            const a = Math.min(+s.a, +s.b), b = Math.max(+s.a, +s.b);
            const fa = frame({ w: 720, h: 540, l: 66, r: 28, t: 26, b: 300 });
            fa.setX(-0.2, 6.2);
            fa.setY(0, Math.max(...range(60).map(i => C.f((6 * i) / 59))) * 1.2);
            const fb = frame({ w: 720, h: 540, l: 66, r: 28, t: 300, b: 58 });
            fb.setX(-0.2, 6.2);
            fb.setY(Math.min(0, C.F(0)), C.F(6) * 1.1);
            return [
              ...axes(fa, { yLabel: 'f(x)', prefix: 'a', showX: false, xN: 0, yN: 3 }),
              fnArea(fa, C.f, a, b, { key: 'ar', cls: 'area area-green', base: 0, dur: 160 }),
              fnPath(fa, C.f, { key: 'c', cls: 'curve', n: 240 }),
              numLabel('arl', fa.sx((a + b) / 2), fa.sy(0) - 20, C.F(b) - C.F(a), { cls: 'lab-big lab-mid lab-gold', d: 3, dur: 160 }),
              ...axes(fb, { xLabel: 'x', yLabel: 'F(x), the antiderivative', prefix: 'b', yN: 3 }),
              fnPath(fb, C.F, { key: 'F', cls: 'curve curve-fit', n: 240 }),
              { key: 'pa', tag: 'circle', cls: 'pt pt-cold', dur: 160, attrs: { cx: fb.sx(a), cy: fb.sy(C.F(a)), r: 7 } },
              { key: 'pb', tag: 'circle', cls: 'pt pt-green', dur: 160, attrs: { cx: fb.sx(b), cy: fb.sy(C.F(b)), r: 7 } },
              { key: 'br', tag: 'line', cls: 'stick stick-pos', dur: 160, attrs: { x1: fb.sx(b) + 16, y1: fb.sy(C.F(a)), x2: fb.sx(b) + 16, y2: fb.sy(C.F(b)) } },
              numLabel('gap', fb.sx(b) + 24, (fb.sy(C.F(a)) + fb.sy(C.F(b))) / 2, C.F(b) - C.F(a), { cls: 'lab lab-gold', d: 3, dur: 160 }),
              { key: 'hl', tag: 'line', cls: 'rule-faint rule-dash', dur: 160, attrs: { x1: fb.sx(a), y1: fb.sy(C.F(a)), x2: fb.sx(b) + 16, y2: fb.sy(C.F(a)) } },
            ];
          },
        },
      ],
    },

    {
      title: 'why a p-value is an integral',
      prose: `<p>Now the payoff for statistics.</p>
        <p>A probability density is not a probability. Its height at a single point tells you nothing you can bet on — the probability of any exact value is zero. <strong>Probability is area under the density</strong>, and area means integral.</p>
        <p>So every shaded tail you saw in the correlation, t-test, ANOVA and chi-square lessons was an integral. When software reports p = .003, it has integrated the tail of a distribution. Nobody does it by hand because the normal density has no elementary antiderivative — which is exactly why tables existed, and why your computer runs a numerical routine instead.</p>`,
      formula: formula(
        'P' + paren('Z > ' + t('z', { tone: 'gold' })) + eq +
        intOver(frac('1', '√(2π)') + ' e' + sup('', '−x²/2') + ' dx', { from: t('z', { tone: 'gold' }), to: '∞' }),
        { caption: 'the shaded tail from every test on this site' }),
      aside: `<b>The one that has no closed form.</b> There is no elementary function whose derivative is the normal density — you cannot write its antiderivative with the usual symbols. Every normal probability you have ever used came from a numerical approximation. The <code>gammap</code> routine in this site's source is doing exactly that job.`,
      readouts: [
        { key: 'z', label: 'z', tone: 'gold', get: s => +s.z, d: 3 },
        { key: 'tail', label: 'one tail', tone: 'warm', get: s => 1 - st.normCdf(+s.z), fmt: st.fmtP, wide: true },
        { key: 'two', label: 'two-tailed p', tone: 'warm', get: s => 2 * (1 - st.normCdf(+s.z)), fmt: st.fmtP, wide: true },
        { key: 'mid', label: 'area in the middle', tone: 'green', get: s => (2 * st.normCdf(+s.z) - 1) * 100, d: 2, suf: '%', wide: true },
      ],
      controls: [
        { type: 'slider', key: 'z', label: 'z', min: 0, max: 4, step: 0.01, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'slider', key: 'n', label: 'slices used to compute it', min: 2, max: 200, step: 2, fast: true },
      ],
      beats: [
        {
          label: 'the tail, sliced',
          note: 'Those rectangles are literally how the number gets computed. Add slices and the estimate converges on the p-value your software reports.',
          scene: s => {
            const f = F();
            f.setX(-4, 4); f.setY(0, 0.46);
            const z = +s.z;
            const r = st.riemann(x => st.normPdf(x), z, 4, s.n, 'mid');
            return [
              ...axes(f, { xLabel: 'z', yLabel: 'density', yN: 4 }),
              ...r.bars.map((b, i) => rect(`b-${i}`, f.sx(b.x0), f.sy(b.h), Math.max(0.5, f.sx(b.x1) - f.sx(b.x0)), f.y0 - f.sy(b.h), {
                cls: 'sq sq-pos', dur: 180,
              })),
              fnArea(f, x => st.normPdf(x), -4, z, { key: 'mid', cls: 'area area-faint', base: 0 }),
              fnPath(f, x => st.normPdf(x), { key: 'c', cls: 'curve', n: 240 }),
              vLine(f, z, { key: 'zv', cls: 'rule-gold', dur: 180 }),
              label('l', f.x0 + 10, f.y1 + 10,
                `${s.n} slices give ${r.total.toFixed(6)}`, { cls: 'lab-big lab-gold', dur: 180 }),
              label('l2', f.x0 + 10, f.y1 + 30,
                `the exact tail is ${(1 - st.normCdf(z)).toFixed(6)}`, { cls: 'lab lab-green', dur: 180 }),
              ...(Math.abs(z - 1.96) < 0.03
                ? [label('famous', f.midX, f.y0 - 14, 'z = 1.96 — the number behind every 95% interval', { cls: 'lab lab-mid lab-warm' })] : []),
            ];
          },
        },
      ],
    },
  ],
};

function riem(s) {
  const C = FNS[s.fn];
  return st.riemann(C.f, 0, 6, s.n, s.rule);
}
const exact = s => FNS[s.fn].F(6) - FNS[s.fn].F(0);
