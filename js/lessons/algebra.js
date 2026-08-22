/* ─────────────────────────────────────────────────────────────────────────────
   algebra.js — solving is undoing, in reverse order. The idea behind every link
   function, every transformation, and every "solve for b" on this site.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, arrowDefs } from '../core/plot.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sqrt, sub, sup, paren, eq, minus, op } from '../core/fx.js';

const F = () => frame({ w: 720, h: 540, l: 66, r: 28, t: 34, b: 58 });

const FNS = {
  linear: { f: (x, s) => s.a * x + s.b, inv: (y, s) => (y - s.b) / s.a, lab: 'a·x + b', invLab: '(y − b) / a', lo: -6, hi: 6, note: 'a straight line — the only function on this site with a closed-form everything' },
  square: { f: x => x * x, inv: y => Math.sqrt(Math.max(0, y)), lab: 'x²', invLab: '√y', lo: 0, hi: 6, note: 'only invertible if you agree to stay on one side of zero' },
  exp: { f: x => Math.exp(x), inv: y => Math.log(Math.max(1e-9, y)), lab: 'eˣ', invLab: 'ln y', lo: -3, hi: 3, note: 'the pair behind every log link and every rate ratio' },
  logit: {
    f: x => 1 / (1 + Math.exp(-x)), inv: y => Math.log(clamp(y, 1e-6, 1 - 1e-6) / (1 - clamp(y, 1e-6, 1 - 1e-6))),
    lab: '1 / (1 + e⁻ˣ)', invLab: 'ln(y / (1−y))', lo: -5, hi: 5, note: 'the logistic link, and its inverse the logit',
  },
};

export default {
  meta: {
    id: 'algebra', title: 'algebra & inverses', kicker: 'FOUNDATION',
    status: 'live',
    deck: 'Two ideas, and both of them turn up constantly in the statistics on this site: an equation is a balance you may do anything to as long as you do it to both sides, and an inverse function is a machine run backwards.',
    dataNote: 'No dataset here — this lesson is about the machinery itself. Everything is drawn live from the functions you pick.',
    deps: [], unlocks: ['matrix'],
    next: 'matrix', nextLabel: 'matrix algebra',
    outro: 'undo the operations in reverse order. that is the whole method.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { fn: 'linear', a: 2, b: 3, x: 1.5, step: 0 },

  steps: [
    {
      title: 'a function is a machine',
      prose: `<p>Put a number in, get a number out, always the same output for the same input. That's the entire definition, and it's worth holding onto because most of the confusion in algebra comes from thinking of a function as a formula rather than as a process.</p>
        <p><strong>Drag the input</strong> and watch it travel through. The arrow on the left is x, the arrow on the right is what came out.</p>`,
      readouts: [
        { key: 'x', label: 'input x', tone: 'cyan', get: s => +s.x, d: 3 },
        { key: 'y', label: 'output', tone: 'green', get: s => FNS[s.fn].f(+s.x, s), d: 3, wide: true },
      ],
      controls: [
        { type: 'segment', key: 'fn', label: 'the machine', options: Object.entries(FNS).map(([k, v]) => ({ value: k, label: v.lab })) },
        { type: 'slider', key: 'x', label: 'input x', min: -5, max: 5, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'slider', key: 'a', label: 'a', min: -4, max: 4, step: 0.1, fast: true, fmt: v => (+v).toFixed(1) },
        { type: 'slider', key: 'b', label: 'b', min: -5, max: 5, step: 0.1, fast: true, fmt: v => (+v).toFixed(1) },
      ],
      beats: [
        {
          label: 'in, through, out',
          note: 'The box does not care what you feed it. It applies the same rule every time.',
          scene: s => {
            const fn = FNS[s.fn];
            const y = fn.f(+s.x, s);
            return [
              rect('box', 280, 200, 160, 120, { cls: 'cell' }),
              label('bl', 360, 255, fn.lab, { cls: 'lab-big lab-mid lab-gold' }),
              label('bl2', 360, 285, 'the machine', { cls: 'lab-sm lab-mid' }),
              path('ain', [[130, 260], [272, 260]], { cls: 'arrow' }),
              path('aout', [[448, 260], [590, 260]], { cls: 'arrow arrow-warm' }),
              numLabel('xin', 110, 265, +s.x, { cls: 'lab-big lab-end lab-cyan', d: 2, dur: 200 }),
              label('xl', 110, 290, 'x', { cls: 'lab-sm lab-end' }),
              numLabel('yout', 610, 265, y, { cls: 'lab-big lab-green', d: 3, dur: 200 }),
              label('yl', 610, 290, 'y', { cls: 'lab-sm' }),
              label('nt', 360, 400, fn.note, { cls: 'lab lab-mid' }),
            ];
          },
        },
      ],
    },

    {
      title: 'solving is running the machine backwards',
      prose: `<p>"Solve for x" means: I know what came out, what went in?</p>
        <p>The method is mechanical. List the operations the machine applies, in order. Then undo them, in <strong>reverse</strong> order, applying each undo to both sides. Multiplication undone by division, addition by subtraction, squaring by rooting, exponentiating by logging.</p>
        <p>Reverse order is the part people drop. To undo socks-then-shoes you take off shoes first.</p>`,
      formula: formula(
        t('y', { tone: 'green' }) + eq + 'a·x + b' +
        op('&nbsp;&nbsp;→&nbsp;&nbsp;') + 'y − b ' + eq + ' a·x' +
        op('&nbsp;&nbsp;→&nbsp;&nbsp;') + frac('y − b', 'a') + eq + t('x', { tone: 'cyan' }),
        { caption: 'the b was added last, so it comes off first' }),
      readouts: [
        { key: 'y', label: 'known output', tone: 'green', get: s => FNS[s.fn].f(+s.x, s), d: 3, wide: true },
        { key: 'rec', label: 'recovered x', tone: 'cyan', get: s => FNS[s.fn].inv(FNS[s.fn].f(+s.x, s), s), d: 3, wide: true },
        { key: 'orig', label: 'original x', get: s => +s.x, d: 3, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'x', label: 'input x', min: -5, max: 5, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'slider', key: 'a', label: 'a', min: -4, max: 4, step: 0.1, fast: true, fmt: v => (+v).toFixed(1) },
        { type: 'slider', key: 'b', label: 'b', min: -5, max: 5, step: 0.1, fast: true, fmt: v => (+v).toFixed(1) },
      ],
      beats: [
        {
          label: 'forwards',
          note: 'Multiply by a, then add b. Two operations, in that order.',
          scene: s => {
            const xv = +s.x;
            return [
              ...pipeline([
                { lab: 'x', val: xv, tone: 'cyan' },
                { op: `× ${(+s.a).toFixed(1)}`, lab: 'a·x', val: s.a * xv },
                { op: `+ ${(+s.b).toFixed(1)}`, lab: 'a·x + b', val: s.a * xv + +s.b, tone: 'green' },
              ], 200),
              label('d', 360, 400, 'forwards: multiply, then add', { cls: 'lab lab-mid' }),
            ];
          },
        },
        {
          label: 'backwards',
          hold: 1700,
          note: 'Subtract b, then divide by a. Same operations, inverted, in the opposite order — and you land exactly where you started.',
          scene: s => {
            const xv = +s.x;
            const y = s.a * xv + +s.b;
            return [
              ...pipeline([
                { lab: 'y', val: y, tone: 'green' },
                { op: `− ${(+s.b).toFixed(1)}`, lab: 'y − b', val: y - +s.b },
                { op: `÷ ${(+s.a).toFixed(1)}`, lab: '(y − b)/a', val: (y - +s.b) / s.a, tone: 'cyan' },
              ], 200),
              label('d', 360, 400, 'backwards: undo the last thing first', { cls: 'lab lab-mid lab-gold' }),
              label('d2', 360, 425, `recovered x = ${((y - +s.b) / s.a).toFixed(3)}`, { cls: 'lab lab-mid lab-cyan' }),
            ];
          },
        },
      ],
    },

    {
      title: 'an inverse is a reflection',
      prose: `<p>There's a picture that makes inverses obvious, and once you've seen it you can't unsee it.</p>
        <p>The inverse function is the original function <strong>reflected across the line y = x</strong>. That's because swapping the roles of input and output is geometrically the same as swapping the two axes.</p>
        <p>It also tells you exactly when an inverse fails to exist: if a horizontal line ever crosses the function twice, the reflection crosses a vertical line twice — and that isn't a function any more. Try <span class="cs-inline-code">x²</span>: it's only invertible because we agreed to keep x positive.</p>`,
      formula: formula(
        'f' + paren(sup('f', '−1') + paren('y')) + eq + t('y', { tone: 'green' }) +
        op('&nbsp;&nbsp;and&nbsp;&nbsp;') + sup('f', '−1') + paren('f' + paren('x')) + eq + t('x', { tone: 'cyan' }),
        { caption: 'each one undoes the other — that is the definition, not a property' }),
      readouts: [
        { key: 'f', label: 'f', tone: 'warm', get: s => FNS[s.fn].lab },
        { key: 'inv', label: 'f⁻¹', tone: 'cyan', get: s => FNS[s.fn].invLab, wide: true },
        { key: 'x', label: 'x', get: s => +s.x, d: 2 },
        { key: 'fx', label: 'f(x)', tone: 'warm', get: s => FNS[s.fn].f(+s.x, s), d: 3, wide: true },
      ],
      controls: [
        { type: 'segment', key: 'fn', label: 'function', options: Object.entries(FNS).map(([k, v]) => ({ value: k, label: v.lab })) },
        { type: 'slider', key: 'x', label: 'x', min: -4.5, max: 4.5, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
      ],
      beats: [
        {
          label: 'the function and its mirror',
          note: 'The dashed diagonal is y = x. Every point on the warm curve has a twin on the blue one with its coordinates swapped.',
          scene: s => {
            const fn = FNS[s.fn];
            const f = F();
            const lim = s.fn === 'logit' ? 5 : 5;
            f.setX(-lim, lim); f.setY(-lim, lim);
            const xv = clamp(+s.x, fn.lo, fn.hi);
            const yv = fn.f(xv, s);
            return [
              ...axes(f, { xLabel: 'x', yLabel: 'y' }),
              path('diag', [[f.sx(-lim), f.sy(-lim)], [f.sx(lim), f.sy(lim)]], { cls: 'curve-ghost curve-dash' }),
              label('dl', f.sx(3.6), f.sy(4.1), 'y = x', { cls: 'lab-sm lab-muted' }),
              fnPath(f, x => fn.f(x, s), { key: 'f', cls: 'curve curve-warm', n: 220, from: fn.lo, to: fn.hi, dur: 240 }),
              fnPath(f, y => fn.inv(y, s), { key: 'fi', cls: 'curve curve-cyan', n: 220, from: Math.max(-lim, fn.f(fn.lo, s)), to: Math.min(lim, fn.f(fn.hi, s)), dur: 240 }),
              { key: 'p1', tag: 'circle', cls: 'pt pt-warm', dur: 200, attrs: { cx: f.sx(xv), cy: f.sy(clamp(yv, -lim, lim)), r: 7 } },
              { key: 'p2', tag: 'circle', cls: 'pt pt-cyan', dur: 200, attrs: { cx: f.sx(clamp(yv, -lim, lim)), cy: f.sy(xv), r: 7 } },
              path('mir', [[f.sx(xv), f.sy(clamp(yv, -lim, lim))], [f.sx(clamp(yv, -lim, lim)), f.sy(xv)]], { cls: 'rule-faint rule-dash', dur: 200 }),
              label('l1', f.x0 + 10, f.y1 + 10, `f(x) = ${fn.lab}`, { cls: 'lab lab-warm' }),
              label('l2', f.x0 + 10, f.y1 + 28, `f⁻¹(y) = ${fn.invLab}`, { cls: 'lab lab-cyan' }),
            ];
          },
        },
      ],
    },

    {
      title: 'where this shows up in the statistics',
      prose: `<p>Every link function in the GLM lesson is one of these pairs, and now you can see why the interpretations come out the way they do.</p>
        <p>The <strong>log link</strong> pairs with the exponential, so adding on the model's scale becomes multiplying on the data's scale — which is why Poisson coefficients are rate <em>ratios</em>.</p>
        <p>The <strong>logit link</strong> pairs with the logistic function, so adding on the model's scale multiplies the <em>odds</em> — which is why logistic coefficients are odds ratios.</p>
        <p>None of that is a convention someone chose. It falls straight out of what the inverse function does to addition.</p>`,
      formula: formula(
        'log' + paren('μ') + eq + 'η' + op('&nbsp;⟺&nbsp;') + 'μ ' + eq + ' e' + sup('', 'η') +
        op('&nbsp;&nbsp;&nbsp;so&nbsp;&nbsp;&nbsp;') + 'η + b ' + op('⟹') + ' μ × e' + sup('', 'b'),
        { size: 'sm', caption: 'addition on one scale is multiplication on the other' }),
      dep: { note: 'This is exactly the pair of dials in the GLM lesson.', lesson: 'glm', label: 'the glm idea' },
      readouts: [],
      beats: [
        {
          label: 'the four pairs',
          note: 'Left column: what the model adds. Right column: what happens to the thing you care about.',
          scene: () => {
            const rows = [
              ['link', 'inverse', 'add b on the model scale means…'],
              ['identity', 'identity', 'add b to the prediction'],
              ['log', 'exp', 'multiply the rate by e^b'],
              ['logit', 'logistic', 'multiply the odds by e^b'],
              ['√', 'square', 'nothing anyone can say in a sentence'],
            ];
            const colX = [130, 290, 450];
            const y0 = 150, rh = 60;
            const items = [];
            rows.forEach((r, i) => {
              if (i > 0) items.push(rect(`bg-${i}`, 70, y0 + i * rh - 24, 590, rh - 10, { cls: 'cell', opacity: i % 2 ? 1 : 0.4, delay: i * 100 }));
              r.forEach((c, j) => items.push(label(`c-${i}-${j}`, colX[j], y0 + i * rh, c, {
                cls: i === 0 ? 'lab-sm lab-gold' : (j === 2 ? 'lab lab-green' : 'lab lab-cyan'), delay: i * 100,
              })));
            });
            items.push(label('n', 360, y0 + rows.length * rh + 10,
              'the last row is why nobody uses a square-root link unless they must', { cls: 'lab-sm lab-mid' }));
            return items;
          },
        },
      ],
    },
  ],
};

function pipeline(stages, y) {
  const items = [];
  const w = 132, gap = 56;
  const total = stages.length * w + (stages.length - 1) * gap;
  let x = 360 - total / 2;
  stages.forEach((st_, i) => {
    if (i > 0) {
      items.push(path(`a-${i}`, [[x - gap + 6, y + 30], [x - 8, y + 30]], { cls: 'arrow', delay: i * 250 }));
      items.push(label(`ao-${i}`, x - gap / 2, y + 18, st_.op, { cls: 'lab lab-mid lab-gold', delay: i * 250 }));
    }
    items.push(rect(`b-${i}`, x, y, w, 62, { cls: 'cell', delay: i * 250 }));
    items.push(label(`bl-${i}`, x + w / 2, y + 22, st_.lab, { cls: 'lab-sm lab-mid', delay: i * 250 }));
    items.push(numLabel(`bv-${i}`, x + w / 2, y + 46, st_.val, {
      cls: `lab-big lab-mid ${st_.tone ? 'lab-' + st_.tone : ''}`, d: 2, delay: i * 250, dur: 300,
    }));
    x += w + gap;
  });
  return items;
}
