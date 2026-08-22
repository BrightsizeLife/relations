/* ─────────────────────────────────────────────────────────────────────────────
   matrix.js — a matrix is a machine that moves space. Determinant is area,
   inverse is undo, and every regression on this site is one matrix equation.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, arrowDefs } from '../core/plot.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sub, sup, paren, brack, eq, minus, op } from '../core/fx.js';

const F = () => frame({ w: 720, h: 540, l: 66, r: 28, t: 34, b: 58 });
const M = s => [[s.m00, s.m01], [s.m10, s.m11]];
const apply = (m, v) => [m[0][0] * v[0] + m[0][1] * v[1], m[1][0] * v[0] + m[1][1] * v[1]];

const gridFrame = () => {
  const f = F();
  f.setX(-4, 4); f.setY(-4, 4);
  return f;
};

function transformedGrid(f, m, key = 'g') {
  const items = [];
  for (let i = -4; i <= 4; i++) {
    const a = apply(m, [i, -4]), b = apply(m, [i, 4]);
    items.push(path(`${key}-v-${i + 4}`, [[f.sx(a[0]), f.sy(a[1])], [f.sx(b[0]), f.sy(b[1])]],
      { cls: i === 0 ? 'rule-faint' : 'ax-grid', dur: 240 }));
    const c = apply(m, [-4, i]), d = apply(m, [4, i]);
    items.push(path(`${key}-h-${i + 4}`, [[f.sx(c[0]), f.sy(c[1])], [f.sx(d[0]), f.sy(d[1])]],
      { cls: i === 0 ? 'rule-faint' : 'ax-grid', dur: 240 }));
  }
  return items;
}

export default {
  meta: {
    id: 'matrix', title: 'matrix algebra', kicker: 'FOUNDATION',
    status: 'live',
    deck: 'Matrices are usually taught as grids of numbers with arbitrary multiplication rules. They are much easier to hold onto as <em>machines that move space</em> — and once you see them that way, the determinant, the inverse, and why collinearity wrecks a regression all become the same fact.',
    dataNote: 'No dataset — this one is geometry. Every drawing is computed from the matrix you set with the sliders.',
    deps: ['algebra'], unlocks: ['multiple'],
    next: 'limits', nextLabel: 'limits',
    outro: 'move space, measure how much you stretched it, and undo it — unless you flattened it, in which case you cannot.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { m00: 1.6, m01: 0.6, m10: 0.4, m11: 1.2, vx: 1, vy: 1 },

  steps: [
    {
      title: 'a matrix moves the whole plane',
      prose: `<p>Feed a 2×2 matrix a vector and you get another vector. Do that to <em>every</em> point at once and you have a transformation of the plane — a stretch, a rotation, a shear, or some combination.</p>
        <p>The two columns of the matrix tell you everything: <strong>the first column is where the point (1,0) lands, and the second is where (0,1) lands</strong>. Everything else follows, because everything else is built out of those two.</p>
        <p><strong>Drag the four numbers</strong> and watch the grid deform.</p>`,
      formula: formula(
        brack(frac('a', 'c') + '&nbsp;' + frac('b', 'd')) +
        brack(frac('x', 'y')) + eq +
        t('x', { tone: 'cyan' }) + brack(frac('a', 'c')) + ' + ' + t('y', { tone: 'purple' }) + brack(frac('b', 'd')),
        { caption: 'the output is a weighted sum of the columns — that is all matrix–vector multiplication is' }),
      readouts: [
        { key: 'i', label: 'where (1,0) goes', tone: 'cyan', wide: true, get: s => `(${(+s.m00).toFixed(1)}, ${(+s.m10).toFixed(1)})` },
        { key: 'j', label: 'where (0,1) goes', tone: 'purple', wide: true, get: s => `(${(+s.m01).toFixed(1)}, ${(+s.m11).toFixed(1)})` },
      ],
      controls: [
        { type: 'slider', key: 'm00', label: 'a', min: -3, max: 3, step: 0.1, fast: true, fmt: v => (+v).toFixed(1) },
        { type: 'slider', key: 'm01', label: 'b', min: -3, max: 3, step: 0.1, fast: true, fmt: v => (+v).toFixed(1) },
        { type: 'slider', key: 'm10', label: 'c', min: -3, max: 3, step: 0.1, fast: true, fmt: v => (+v).toFixed(1) },
        { type: 'slider', key: 'm11', label: 'd', min: -3, max: 3, step: 0.1, fast: true, fmt: v => (+v).toFixed(1) },
      ],
      beats: [
        {
          label: 'before',
          note: 'The plain grid, and the two basis vectors that define it.',
          scene: () => {
            const f = gridFrame();
            const I = [[1, 0], [0, 1]];
            return [
              ...transformedGrid(f, I),
              ...axes(f, { xLabel: 'x', yLabel: 'y', grid: false }),
              path('i', [[f.sx(0), f.sy(0)], [f.sx(1), f.sy(0)]], { cls: 'arrow', set: { 'stroke-width': 3, stroke: 'var(--cs-cyan)', 'marker-end': 'url(#arrowhead-cyan)' } }),
              path('j', [[f.sx(0), f.sy(0)], [f.sx(0), f.sy(1)]], { cls: 'arrow', set: { 'stroke-width': 3, stroke: 'var(--cs-purple)' } }),
              rect('sq', f.sx(0), f.sy(1), f.sx(1) - f.sx(0), f.sy(0) - f.sy(1), { cls: 'sq sq-x' }),
              label('l', f.sx(0.5), f.sy(0.5) + 4, 'area 1', { cls: 'lab lab-mid' }),
            ];
          },
        },
        {
          label: 'after',
          note: 'Straight lines stay straight and the origin stays put. That is the definition of a <b>linear</b> transformation.',
          scene: s => {
            const f = gridFrame();
            const m = M(s);
            const i = apply(m, [1, 0]), j = apply(m, [0, 1]);
            return [
              ...transformedGrid(f, m),
              ...axes(f, { xLabel: 'x', yLabel: 'y', grid: false }),
              path('sq', [
                [f.sx(0), f.sy(0)], [f.sx(i[0]), f.sy(i[1])],
                [f.sx(i[0] + j[0]), f.sy(i[1] + j[1])], [f.sx(j[0]), f.sy(j[1])],
              ], { cls: 'sq sq-x', close: true, dur: 240 }),
              path('i', [[f.sx(0), f.sy(0)], [f.sx(i[0]), f.sy(i[1])]], { cls: 'arrow', dur: 240, set: { 'stroke-width': 3, stroke: 'var(--cs-cyan)', 'marker-end': 'url(#arrowhead-cyan)' } }),
              path('j', [[f.sx(0), f.sy(0)], [f.sx(j[0]), f.sy(j[1])]], { cls: 'arrow', dur: 240, set: { 'stroke-width': 3, stroke: 'var(--cs-purple)' } }),
              label('li', f.sx(i[0]) + 8, f.sy(i[1]) - 6, `(${i[0].toFixed(1)}, ${i[1].toFixed(1)})`, { cls: 'lab lab-cyan', dur: 240 }),
              label('lj', f.sx(j[0]) + 8, f.sy(j[1]) - 6, `(${j[0].toFixed(1)}, ${j[1].toFixed(1)})`, { cls: 'lab lab-purple', dur: 240 }),
            ];
          },
        },
      ],
    },

    {
      title: 'the determinant is an area',
      prose: `<p>The unit square had area 1. After the transformation it's a parallelogram with some other area. <strong>The determinant is that area.</strong> Nothing more mysterious than that.</p>
        <p>A determinant of 3 means the machine triples every area. A determinant of 1 means it preserves them (a rotation does this). A <em>negative</em> determinant means space got flipped over — the transformation is a reflection as well as a stretch.</p>
        <p>And a determinant of <strong>zero</strong> means everything collapsed onto a line. That case is the important one, and it's the next step.</p>`,
      formula: formula(
        'det' + brack(frac('a', 'c') + '&nbsp;' + frac('b', 'd')) + eq +
        t('ad', { tone: 'green' }) + minus + t('bc', { tone: 'warm' }) +
        op('&nbsp;&nbsp;=&nbsp;&nbsp;') + t('the area of the parallelogram', { cls: 'fx-muted' }),
        { caption: 'signed area — negative means space was flipped' }),
      readouts: [
        { key: 'det', label: 'determinant', tone: 'gold', get: s => st.det2(M(s)), d: 3, wide: true },
        { key: 'what', label: 'meaning', wide: true, get: s => {
          const d = st.det2(M(s));
          if (Math.abs(d) < 0.05) return 'space is collapsing';
          if (d < 0) return `flipped, areas × ${Math.abs(d).toFixed(2)}`;
          return `areas × ${d.toFixed(2)}`;
        } },
      ],
      controls: [
        { type: 'slider', key: 'm00', label: 'a', min: -3, max: 3, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'slider', key: 'm01', label: 'b', min: -3, max: 3, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'slider', key: 'm10', label: 'c', min: -3, max: 3, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'slider', key: 'm11', label: 'd', min: -3, max: 3, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
      ],
      beats: [
        {
          label: 'the area, live',
          note: 'Drive the determinant toward zero and watch the parallelogram flatten into a line. At that moment the transformation has thrown away a dimension.',
          scene: s => {
            const f = gridFrame();
            const m = M(s);
            const d = st.det2(m);
            const i = apply(m, [1, 0]), j = apply(m, [0, 1]);
            return [
              ...transformedGrid(f, m),
              ...axes(f, { xLabel: 'x', yLabel: 'y', grid: false }),
              path('sq', [
                [f.sx(0), f.sy(0)], [f.sx(i[0]), f.sy(i[1])],
                [f.sx(i[0] + j[0]), f.sy(i[1] + j[1])], [f.sx(j[0]), f.sy(j[1])],
              ], { cls: `sq ${d < 0 ? 'sq-neg' : 'sq-pos'}`, close: true, dur: 240 }),
              path('i', [[f.sx(0), f.sy(0)], [f.sx(i[0]), f.sy(i[1])]], { cls: 'arrow', dur: 240, set: { 'stroke-width': 3, stroke: 'var(--cs-cyan)' } }),
              path('j', [[f.sx(0), f.sy(0)], [f.sx(j[0]), f.sy(j[1])]], { cls: 'arrow', dur: 240, set: { 'stroke-width': 3, stroke: 'var(--cs-purple)' } }),
              numLabel('dl', f.midX, f.y1 + 8, d, { cls: 'lab-big lab-mid lab-gold', d: 3, pre: 'det = ', dur: 240 }),
              ...(Math.abs(d) < 0.12 ? [label('w', f.midX, f.y1 + 30, 'the plane has been squashed onto a line', { cls: 'lab lab-mid lab-warm' })] : []),
            ];
          },
        },
      ],
    },

    {
      title: 'the inverse is the undo, and it can fail',
      prose: `<p>If a matrix moves the plane, its inverse moves it back. Apply both and you're where you started.</p>
        <p>But an undo only exists if the original move lost no information. And a transformation with determinant zero <em>did</em> lose information: it squashed a whole line of different points onto the same output point. You can't undo that, because you can't work out which of the infinitely many inputs you started from.</p>
        <p>That's the entire meaning of "singular", and it is the same failure that shows up as perfect collinearity in a regression.</p>`,
      formula: formula(
        sup('A', '−1') + eq + frac('1', t('det A', { tone: 'gold' })) +
        brack(frac('d', '−c') + '&nbsp;' + frac('−b', 'a')) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('undefined when det = 0', { tone: 'warm' }),
        { caption: 'dividing by the determinant — which is why a zero determinant breaks everything' }),
      readouts: [
        { key: 'det', label: 'determinant', tone: 'gold', get: s => st.det2(M(s)), d: 3, wide: true },
        { key: 'inv', label: 'invertible?', wide: true, get: s => (Math.abs(st.det2(M(s))) < 1e-6 ? 'NO — singular' : 'yes') },
        { key: 'cond', label: 'how close to singular', tone: 'warm', wide: true, get: s => 1 / Math.max(Math.abs(st.det2(M(s))), 1e-9), d: 1, explain: 'The bigger this gets, the more a tiny wobble in the data throws the answer around. In regression this is what makes standard errors explode.' },
      ],
      controls: [
        { type: 'slider', key: 'm00', label: 'a', min: -3, max: 3, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'slider', key: 'm01', label: 'b', min: -3, max: 3, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'slider', key: 'm10', label: 'c', min: -3, max: 3, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'slider', key: 'm11', label: 'd', min: -3, max: 3, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
      ],
      beats: [
        {
          label: 'there and back',
          note: 'Left: the transformed grid. Right: the inverse applied to it. When det is near zero the inverse\'s numbers blow up — that is the instability.',
          scene: s => {
            const m = M(s);
            const inv = st.inv2(m);
            const f = gridFrame();
            if (!inv) {
              return [
                ...transformedGrid(f, m),
                ...axes(f, { xLabel: 'x', yLabel: 'y', grid: false }),
                label('w', f.midX, f.midY, 'singular — no inverse exists', { cls: 'lab-big lab-mid lab-warm' }),
                label('w2', f.midX, f.midY + 26, 'every point on a line got mapped to the same place', { cls: 'lab lab-mid' }),
              ];
            }
            const items = [
              ...transformedGrid(f, m),
              ...axes(f, { xLabel: 'x', yLabel: 'y', grid: false }),
            ];
            const y0 = 96;
            [['A', m], ['A⁻¹', inv]].forEach(([nm, mat], k) => {
              const x0 = 470 + k * 0;
              const yy = y0 + k * 120;
              items.push(label(`t-${k}`, 500, yy - 14, nm, { cls: `lab-big ${k ? 'lab-cyan' : 'lab-gold'}` }));
              mat.forEach((row, i) => row.forEach((v, j) => {
                items.push(numLabel(`m-${k}-${i}-${j}`, 560 + j * 70, yy + 14 + i * 26, v, {
                  cls: `lab lab-mid ${k ? 'lab-cyan' : 'lab-gold'}`, d: 2, dur: 240,
                }));
              }));
            });
            items.push(label('chk', 600, 350, 'A⁻¹A =', { cls: 'lab lab-mid' }));
            const prod = st.matMul(inv, m);
            prod.forEach((row, i) => row.forEach((v, j) => {
              items.push(numLabel(`p-${i}-${j}`, 570 + j * 60, 380 + i * 24, Math.abs(v) < 1e-9 ? 0 : v, {
                cls: 'lab lab-mid lab-green', d: 2, dur: 240,
              }));
            }));
            items.push(label('chk2', 600, 440, 'the identity — nothing moved', { cls: 'lab-sm lab-mid lab-green' }));
            return items;
          },
        },
      ],
    },

    {
      title: 'why any of this appears in a regression',
      prose: `<p>Stack your predictors as columns of a matrix X. The least-squares coefficients are <span class="cs-inline-code">(XᵀX)⁻¹Xᵀy</span>, and every piece of that expression is now something you can picture.</p>
        <p>XᵀX is a small square matrix holding all the sums of squares and cross-products — the exact quantities built in the correlation lesson. Its inverse is the undo step that turns those sums into coefficients.</p>
        <p>And when two predictors are nearly the same thing, the columns of X are nearly parallel, XᵀX is nearly singular, and the inverse divides by a determinant that is nearly zero. That's not an analogy for why collinearity inflates standard errors — it <em>is</em> the mechanism.</p>`,
      formula: formula(
        t(sup('(X', 'T') + 'X)' + sup('', '−1'), { tone: 'cyan' }) + t(sup('X', 'T'), { tone: 'cyan' }) + t('y', { tone: 'purple' }) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') +
        'Var' + paren('b') + eq + t(sup('σ', '2'), { tone: 'gold' }) + sup('(X', 'T') + 'X)' + sup('', '−1'),
        { size: 'sm', caption: 'the same inverse appears in both the estimate and its uncertainty' }),
      dep: { note: 'This formula is the engine underneath every model on this site.', lesson: 'multiple', label: 'multiple regression' },
      readouts: [
        { key: 'r', label: 'correlation of the columns', tone: 'gold', get: s => colCorr(s), d: 3, fmt: v => st.fmtR(v, 3), wide: true },
        { key: 'det', label: 'det(XᵀX)', tone: 'warm', get: s => detXtX(s), d: 3, wide: true },
        { key: 'var', label: 'variance of b₁', tone: 'cold', get: s => varB(s), d: 3, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'vx', label: 'how much the two predictors overlap', min: 0, max: 0.99, step: 0.01, fast: true, fmt: v => 'r ≈ ' + (+v).toFixed(2) },
      ],
      beats: [
        {
          label: 'two columns, closing in',
          note: 'Each arrow is a predictor, drawn as a vector. As they line up, the parallelogram they span collapses, the determinant heads for zero, and the variance of the coefficients explodes.',
          scene: s => {
            const f = gridFrame();
            const rho = +s.vx;
            const a = [1, 0];
            const b = [rho, Math.sqrt(1 - rho * rho)];
            const d = a[0] * b[1] - a[1] * b[0];
            return [
              ...axes(f, { xLabel: '', yLabel: '', grid: true }),
              path('par', [
                [f.sx(0), f.sy(0)], [f.sx(a[0] * 2.4), f.sy(a[1] * 2.4)],
                [f.sx((a[0] + b[0]) * 2.4), f.sy((a[1] + b[1]) * 2.4)], [f.sx(b[0] * 2.4), f.sy(b[1] * 2.4)],
              ], { cls: 'sq sq-pos', close: true, dur: 200 }),
              path('a', [[f.sx(0), f.sy(0)], [f.sx(a[0] * 2.4), f.sy(a[1] * 2.4)]], { cls: 'arrow', dur: 200, set: { 'stroke-width': 3, stroke: 'var(--cs-cyan)' } }),
              path('b', [[f.sx(0), f.sy(0)], [f.sx(b[0] * 2.4), f.sy(b[1] * 2.4)]], { cls: 'arrow', dur: 200, set: { 'stroke-width': 3, stroke: 'var(--cs-purple)' } }),
              label('la', f.sx(a[0] * 2.4) + 8, f.sy(0) - 8, 'predictor 1', { cls: 'lab lab-cyan' }),
              label('lb', f.sx(b[0] * 2.4) + 8, f.sy(b[1] * 2.4) - 8, 'predictor 2', { cls: 'lab lab-purple', dur: 200 }),
              label('l', f.midX, f.y1 + 8,
                rho > 0.95 ? 'almost the same variable — the model cannot tell them apart'
                  : rho > 0.8 ? 'badly overlapping — coefficients will be unstable'
                    : 'plenty of independent information',
                { cls: `lab-big lab-mid ${rho > 0.8 ? 'lab-warm' : 'lab-green'}`, dur: 200 }),
              label('l2', f.midX, f.y1 + 30, `variance of the coefficients scales as 1/(1 − r²) = ${(1 / (1 - rho * rho)).toFixed(1)}×`,
                { cls: 'lab lab-mid', dur: 200 }),
            ];
          },
        },
      ],
    },
  ],
};

function cols(s) {
  const r = st.rng(5);
  const rho = +s.vx;
  const x1 = [], x2 = [];
  for (let i = 0; i < 50; i++) {
    const a = st.randNorm(r), e = st.randNorm(r);
    x1.push(a); x2.push(rho * a + Math.sqrt(1 - rho * rho) * e);
  }
  return { x1, x2 };
}
const colCorr = s => st.pearson(cols(s).x1, cols(s).x2);
function detXtX(s) {
  const { x1, x2 } = cols(s);
  const a = st.sum(x1.map(v => v * v)), b = st.sum(x1.map((v, i) => v * x2[i])), c = st.sum(x2.map(v => v * v));
  return (a * c - b * b) / 1000;
}
function varB(s) {
  const { x1, x2 } = cols(s);
  const r = st.pearson(x1, x2);
  return 1 / (1 - r * r);
}
