/* ─────────────────────────────────────────────────────────────────────────────
   activations.js — the bend.

   A network without an activation function is a line, no matter how many
   layers you give it. That single fact is the whole reason this component
   exists, and it is demonstrable in about ten seconds, so this lesson opens by
   demonstrating it rather than by listing formulas.

   Everything here is shown twice: as a transfer diagram (a number goes in on
   one ruler, comes out on another) and as a curve. They are the same object.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, points, label, numLabel, path, rect, fnPath, surface, boundary, arrowDefs } from '../core/plot.js';
import { trainNet, twoClass } from '../core/ml.js';
import { knobCards } from '../core/knobs.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sub, sup, eq, minus, plus, times, paren, op } from '../core/fx.js';

/* ── the functions ────────────────────────────────────────────────────────── */

const sig = x => 1 / (1 + Math.exp(-x));

export const ACTS = {
  identity: {
    name: 'identity', tone: 'muted', lo: -4, hi: 4,
    f: x => x, d: () => 1,
    blurb: 'no activation at all — the number passes straight through',
  },
  relu: {
    name: 'ReLU', tone: 'cyan', lo: -0.4, hi: 4,
    f: x => Math.max(0, x), d: x => (x > 0 ? 1 : 0),
    blurb: 'negative in, zero out. positive in, unchanged.',
  },
  leaky: {
    name: 'leaky ReLU', tone: 'green', lo: -0.8, hi: 4,
    f: x => (x > 0 ? x : 0.1 * x), d: x => (x > 0 ? 1 : 0.1),
    blurb: 'the same bend, with a shallow slope left of zero instead of a flat',
  },
  logistic: {
    name: 'logistic', tone: 'gold', lo: 0, hi: 1,
    f: sig, d: x => sig(x) * (1 - sig(x)),
    blurb: 'squashes everything into (0, 1) — the same curve as logistic regression',
  },
  tanh: {
    name: 'tanh', tone: 'purple', lo: -1, hi: 1,
    f: Math.tanh, d: x => 1 - Math.tanh(x) ** 2,
    blurb: 'the same S, centred on zero and running −1 to 1',
  },
  softplus: {
    name: 'softplus', tone: 'warm', lo: -0.1, hi: 4,
    f: x => Math.log1p(Math.exp(-Math.abs(x))) + Math.max(x, 0), d: sig,
    blurb: 'ReLU with the corner rounded off, so it has a derivative everywhere',
  },
};

const A = s => ACTS[s.act] || ACTS.relu;

/* one hidden layer of three units, wired by hand so the shape is reproducible */
const UNITS = [
  { w: 1, b: 2, v: 1, tone: 'cyan' },
  { w: 1, b: -1, v: -1.6, tone: 'purple' },
  { w: -1, b: 2.5, v: 1.2, tone: 'gold' },
];
const netOut = (s, x, upTo = 3) => {
  const a = A(s);
  return UNITS.slice(0, upTo).reduce((acc, u) => acc + u.v * a.f(u.w * x + u.b), 0);
};

/* ── the transfer diagram: a number goes in, a number comes out ───────────── */

const IN_Y = 128, OUT_Y = 308, TX0 = 66, TX1 = 392;
const SAMPLES = [-3.5, -2.8, -2.1, -1.4, -0.7, 0, 0.7, 1.4, 2.1, 2.8, 3.5];

const inX = v => TX0 + ((v + 4) / 8) * (TX1 - TX0);
const outX = (a, v) => TX0 + ((v - a.lo) / (a.hi - a.lo)) * (TX1 - TX0);

function rulerRow(key, y, lo, hi, ticks, text, tone) {
  const px = v => TX0 + ((v - lo) / (hi - lo)) * (TX1 - TX0);
  return [
    { key: key + '-l', tag: 'line', cls: 'ax-line', attrs: { x1: TX0, y1: y, x2: TX1, y2: y } },
    ticks.map(v => [
      { key: `${key}-t${v}`, tag: 'line', cls: 'ax-line', attrs: { x1: px(v), y1: y, x2: px(v), y2: y + 5 } },
      label(`${key}-n${v}`, px(v), y + 17, String(v), { cls: 'ax-tick' }),
    ]),
    label(key + '-cap', TX0, y - 12, text, { cls: 'lab-sm lab-' + tone }),
  ];
}

/** the two rulers, with one thread per sampled value */
function transfer(s, { live = null, threads = true } = {}) {
  const a = A(s);
  const inTicks = [-4, -2, 0, 2, 4];
  const outTicks = a.hi - a.lo > 3 ? [Math.ceil(a.lo), 0, 2, 4].filter(v => v >= a.lo && v <= a.hi)
    : [+a.lo.toFixed(1), +(((a.lo + a.hi) / 2)).toFixed(1), +a.hi.toFixed(1)];
  const out = [
    rulerRow('ri', IN_Y, -4, 4, inTicks, 'INPUT  ·  what the unit receives', 'cyan'),
    rulerRow('ro', OUT_Y, a.lo, a.hi, outTicks, 'OUTPUT  ·  what it passes on', 'green'),
  ];
  if (threads) SAMPLES.forEach((v, i) => {
    const y = a.f(v);
    out.push(path(`th-${i}`, [[inX(v), IN_Y + 2], [outX(a, y), OUT_Y - 2]], {
      cls: 'stick', delay: i * 45,
      set: { stroke: v < 0 ? 'var(--cs-data-cold)' : 'var(--cs-data-warm)', 'stroke-width': 1.6 },
      opacity: 0.75,
      tip: `in ${v.toFixed(2)} → out ${y.toFixed(3)}`,
    }));
    out.push({ key: `di-${i}`, tag: 'circle', cls: 'pt', attrs: { cx: inX(v), cy: IN_Y, r: 3.6 }, delay: i * 45, set: { fill: 'var(--cs-cyan)' } });
    out.push({ key: `do-${i}`, tag: 'circle', cls: 'pt', attrs: { cx: outX(a, y), cy: OUT_Y, r: 3.6 }, delay: i * 45, set: { fill: 'var(--cs-data-green)' } });
  });
  if (live != null) {
    const y = a.f(live);
    out.push(
      path('lth', [[inX(live), IN_Y + 2], [outX(a, y), OUT_Y - 2]], { cls: 'curve curve-fit' }),
      { key: 'lin', tag: 'circle', cls: 'pt pt-cyan', attrs: { cx: inX(live), cy: IN_Y, r: 8 } },
      { key: 'lout', tag: 'circle', cls: 'pt pt-green', attrs: { cx: outX(a, y), cy: OUT_Y, r: 8 } },
      numLabel('linl', inX(live), IN_Y - 26, live, { cls: 'lab lab-mid lab-cyan', d: 2 }),
      numLabel('loutl', outX(a, y), OUT_Y + 36, y, { cls: 'lab lab-mid lab-green', d: 3 }),
    );
  }
  return out;
}

/** the same function drawn the ordinary way, on the right */
const CF = () => { const f = frame({ w: 720, h: 540, l: 452, r: 30, t: 96, b: 268 }); f.setX(-4, 4); return f; };

function curvePanel(s, { live = null, deriv = false, key = 'c' } = {}) {
  const a = A(s);
  const f = CF();
  f.setY(Math.min(a.lo, -0.15), Math.max(a.hi, 1.05));
  const out = [
    { key: key + 'x', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.sy(0), x2: f.x1, y2: f.sy(0) } },
    { key: key + 'y', tag: 'line', cls: 'ax-line', attrs: { x1: f.sx(0), y1: f.y0, x2: f.sx(0), y2: f.y1 } },
    fnPath(f, a.f, { key: key + 'fn', cls: 'curve curve-' + (a.tone === 'muted' ? 'ghost' : a.tone) }),
    label(key + 'lab', (f.x0 + f.x1) / 2, f.y1 - 14, a.name, { cls: 'lab-big lab-mid lab-' + a.tone }),
    label(key + 'xl', (f.x0 + f.x1) / 2, f.y0 + 26, 'in →', { cls: 'ax-label' }),
  ];
  if (deriv) {
    const g = frame({ w: 720, h: 540, l: 452, r: 30, t: 330, b: 74 });
    g.setX(-4, 4); g.setY(-0.1, 1.15);
    out.push(
      { key: key + 'gx', tag: 'line', cls: 'ax-line', attrs: { x1: g.x0, y1: g.sy(0), x2: g.x1, y2: g.sy(0) } },
      { key: key + 'gy', tag: 'line', cls: 'ax-line', attrs: { x1: g.sx(0), y1: g.y0, x2: g.sx(0), y2: g.y1 } },
      fnPath(g, a.d, { key: key + 'gfn', cls: 'curve curve-warm' }),
      label(key + 'g1', g.x0 + 4, g.sy(1) - 6, '1', { cls: 'ax-tick' }),
      path(key + 'g1l', [[g.x0, g.sy(1)], [g.x1, g.sy(1)]], { cls: 'rule rule-faint rule-dash' }),
      label(key + 'glab', (g.x0 + g.x1) / 2, g.y1 - 10, 'its derivative', { cls: 'lab lab-mid lab-warm' }),
      live != null ? { key: key + 'gp', tag: 'circle', cls: 'pt pt-warm', attrs: { cx: g.sx(live), cy: g.sy(a.d(live)), r: 6 } } : null,
      live != null ? numLabel(key + 'gv', g.sx(live), g.sy(a.d(live)) - 14, a.d(live), { cls: 'lab-sm lab-mid lab-warm', d: 3 }) : null,
    );
  }
  if (live != null) out.push(
    { key: key + 'p', tag: 'circle', cls: 'pt pt-cyan', attrs: { cx: f.sx(live), cy: f.sy(a.f(live)), r: 7 } },
    path(key + 'ph', [[f.sx(live), f.sy(0)], [f.sx(live), f.sy(a.f(live))]], { cls: 'rule rule-faint rule-dash' }));
  return out;
}

/* ── the two-class payoff (last step) ─────────────────────────────────────── */

const MOONS = twoClass({ n: 150, shape: 'moons', noise: 0.19, seed: 7 });
const NETS = {};
const netFor = act => (NETS[act] ||= trainNet(MOONS.X, MOONS.y, {
  hidden: 6, lr: 0.6, epochs: 600, act, seed: 4, snapshots: 2,
}));

export default {
  meta: {
    id: 'activations', title: 'activation functions', short: 'activations',
    kicker: 'THE BEND', status: 'live',
    deck: 'Stack a hundred linear layers and you have built one linear layer. The activation function is the single component that stops that from being true — and choosing it badly is why networks trained slowly for thirty years.',
    dataNote: 'Every curve here is evaluated live. The last step trains a six-unit network three times, once per activation, on the same 150 points.',
    deps: ['logistic', 'derivatives'], unlocks: [],
    next: 'neuralnet', nextLabel: 'neural networks',
    outro: 'a bend, applied one number at a time. that is the entire difference between a line and a neural network.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { act: 'relu', live: 1.2, depth: 6, units: 3, w1: 1.4, w2: -0.8 },

  steps: [

    /* ── 1 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'a wire that does nothing',
      prose: `<p>Start with one unit, doing nothing at all. A number goes in on the top ruler, and the same number comes out on the bottom one.</p>
        <p>Drag the input. The output follows exactly. Every thread between the rulers is vertical, because nothing happened.</p>
        <p>This is what a layer looks like with no activation function, and it is the baseline everything else is a departure from.</p>`,
      controls: [{ type: 'slider', key: 'live', label: 'input', min: -4, max: 4, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) }],
      readouts: [
        { key: 'i', label: 'in', tone: 'cyan', get: s => +s.live, d: 2 },
        { key: 'o', label: 'out', tone: 'green', get: s => +s.live, d: 2 },
      ],
      beats: [
        { label: 'two rulers', hold: 1300, note: 'Input on top, output underneath. Nothing between them yet.', scene: s => transfer({ act: 'identity' }, { threads: false }) },
        { label: 'let some numbers through', hold: 1500, note: 'Eleven values, sent through. Every thread is vertical.', scene: s => transfer({ act: 'identity' }) },
        { label: 'drag one', note: 'Move the input and watch the pair move together. Out = in, always.', scene: s => [transfer({ act: 'identity' }, { live: +s.live }), curvePanel({ act: 'identity' }, { live: +s.live })] },
      ],
    },

    /* ── 2 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'stack two of them and you still have a line',
      prose: `<p>Add a second layer. The first multiplies by <em>w₁</em>, the second by <em>w₂</em>. Surely two layers can do more than one?</p>
        <p>They cannot. Multiplying by w₁ and then by w₂ is multiplying by w₁w₂ — a single number. The composite is a straight line through the origin, and dragging both weights only ever changes its steepness.</p>
        <p>Do this a hundred times and it is still one line. <strong>Depth, on its own, buys you nothing.</strong> That is the problem an activation function exists to solve, and it is worth feeling before meeting any of them.</p>`,
      formula: formula(
        t('layer 2', { tone: 'purple' }) + paren(t('layer 1', { tone: 'cyan' }) + paren('x')) + eq +
        t('w', { tone: 'purple' }) + sub('', '2') + paren(t('w', { tone: 'cyan' }) + sub('', '1') + 'x') + eq +
        paren(t('w', { tone: 'purple' }) + sub('', '2') + t('w', { tone: 'cyan' }) + sub('', '1')) + 'x' +
        op('&nbsp;&nbsp;=&nbsp;&nbsp;') + t('one layer', { tone: 'green' }),
        { caption: 'the composition of two linear maps is a linear map' }),
      controls: [
        { type: 'slider', key: 'w1', label: 'w₁ (first layer)', min: -2, max: 2, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'slider', key: 'w2', label: 'w₂ (second layer)', min: -2, max: 2, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
      ],
      readouts: [
        { key: 'w1', label: 'w₁', tone: 'cyan', get: s => +s.w1, d: 2 },
        { key: 'w2', label: 'w₂', tone: 'purple', get: s => +s.w2, d: 2 },
        { key: 'p', label: 'the whole network', tone: 'green', get: s => s.w1 * s.w2, d: 3, wide: true, fmt: v => 'x × ' + v.toFixed(3) },
      ],
      beats: [
        { label: 'layer one', hold: 1200, note: 'Multiply by w₁. Still a line.', scene: s => stack(s, 1) },
        { label: 'layer two', hold: 1400, note: 'Multiply that by w₂. Still a line.', scene: s => stack(s, 2) },
        { label: 'collapse it', hold: 1600, note: 'The two layers together are indistinguishable from one layer with weight w₁w₂. Drag both — the green line never bends.', scene: s => stack(s, 3) },
      ],
    },

    /* ── 3 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'put a bend in the wire',
      prose: `<p>Here is the smallest possible fix: after the multiply, do one non-linear thing to the number.</p>
        <p>ReLU is that thing, and it is almost embarrassingly simple — <em>if it is negative, make it zero; otherwise leave it alone</em>. One comparison. No exponentials, no lookup tables.</p>
        <p>Watch what it does to the threads. Everything to the left of zero collapses onto a single point. Everything to the right passes through untouched.</p>`,
      formula: formula(
        t('ReLU', { tone: 'cyan' }) + paren('x') + eq + 'max' + paren('0, x') +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('one comparison per number', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'rectified linear unit — a rectifier is a thing that only lets current through one way' }),
      controls: [{ type: 'slider', key: 'live', label: 'input', min: -4, max: 4, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) }],
      readouts: [
        { key: 'i', label: 'in', tone: 'cyan', get: s => +s.live, d: 2 },
        { key: 'o', label: 'out', tone: 'green', get: s => Math.max(0, +s.live), d: 2 },
        { key: 'w', label: 'what happened', get: s => (+s.live < 0 ? 'flattened to zero' : 'passed through'), wide: true },
      ],
      beats: [
        { label: 'the threads bend', hold: 1600, note: 'Every negative input lands on the same output. That is information being thrown away, deliberately.', scene: s => transfer({ act: 'relu' }) },
        { label: 'as a curve', hold: 1600, note: 'The same function, drawn the usual way. Flat, then a corner, then a 45° line.', scene: s => [transfer({ act: 'relu' }), curvePanel({ act: 'relu' })] },
        { label: 'drag it across zero', note: 'Move the input from left to right and watch the output stick at zero, then let go.', scene: s => [transfer({ act: 'relu' }, { live: +s.live }), curvePanel({ act: 'relu' }, { live: +s.live })] },
      ],
    },

    /* ── 4 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'now two layers do something',
      prose: `<p>Go back to the stacked network and put a ReLU between the layers. Three hidden units, each with its own weight and offset, each bending at a different place.</p>
        <p>Add them one at a time. Each unit contributes one straight piece and one corner, and the sum of three of them is a shape that no single line can make.</p>
        <p>That is the whole trick. A network is not learning a curve. It is learning <em>where to put the corners</em>, and then adding up straight lines.</p>`,
      controls: [
        { type: 'segment', key: 'act', label: 'activation', options: [
          { value: 'identity', label: 'none', explain: 'No bend. The sum of three lines is a line, however many you add.' },
          { value: 'relu', label: 'ReLU', explain: 'One corner per unit.' },
          { value: 'tanh', label: 'tanh', explain: 'A smooth S per unit — soft corners instead of sharp ones.' },
        ] },
        { type: 'slider', key: 'units', label: 'hidden units', min: 1, max: 3, step: 1, fast: true },
      ],
      readouts: [
        { key: 'a', label: 'activation', get: s => A(s).name, wide: true },
        { key: 'u', label: 'units', get: s => s.units, d: 0 },
        { key: 'k', label: 'corners in the output', get: s => (s.act === 'identity' ? 'none — it is a line' : `${s.units}`), wide: true },
      ],
      beats: [
        { label: 'one unit', hold: 1300, note: 'One bend, in one place.', scene: s => sumScene(s, 1) },
        { label: 'two', hold: 1300, note: 'Two bends. The output is now genuinely not a line.', scene: s => sumScene(s, 2) },
        { label: 'three', hold: 1600, note: 'Three. Straight pieces, hinged together.', scene: s => sumScene(s, 3) },
        { label: 'take the bend away', hold: 1800, note: 'Switch the activation to <b>none</b>. The three units are still there and the sum is a perfectly straight line again.', scene: s => sumScene({ ...s, act: 'identity' }, 3) },
        { label: 'your turn', note: 'Switch between <b>none</b>, <b>ReLU</b> and <b>tanh</b> with three units and watch the same weights make three different shapes.', scene: s => sumScene(s, s.units) },
      ],
    },

    /* ── 5 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'the squashing family',
      prose: `<p>ReLU is the modern default. The two that came first squash instead of bending: they take the whole real line and fold it into a bounded interval.</p>
        <p><strong>Logistic</strong> lands in (0, 1), which is exactly the curve you met turning a linear predictor into a probability. <strong>tanh</strong> is the same S, stretched to (−1, 1) and centred on zero — which matters, because a layer whose outputs are all positive pushes every gradient in the next layer the same way.</p>
        <p>Look at the threads at the edges of the input ruler. Inputs of 3 and 4 land almost on top of each other. The function has stopped being able to tell them apart — that is <em>saturation</em>, and it is about to become the whole problem.</p>`,
      controls: [
        { type: 'segment', key: 'act', label: 'activation', options: [
          { value: 'logistic', label: 'logistic' }, { value: 'tanh', label: 'tanh' },
          { value: 'relu', label: 'ReLU' }, { value: 'softplus', label: 'softplus' },
        ] },
        { type: 'slider', key: 'live', label: 'input', min: -4, max: 4, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
      ],
      readouts: [
        { key: 'a', label: 'activation', get: s => A(s).name, wide: true },
        { key: 'r', label: 'output range', get: s => `${A(s).lo} to ${A(s).hi}`, wide: true },
        { key: 'o', label: 'out', tone: 'green', get: s => A(s).f(+s.live), d: 4 },
        { key: 'sat', label: 'gap between in=3 and in=4', tone: 'warm', get: s => Math.abs(A(s).f(4) - A(s).f(3)), d: 4, wide: true, explain: 'How much of the difference between two quite different inputs survives. Near zero means the unit has saturated.' },
      ],
      beats: [
        { label: 'logistic', hold: 1700, note: 'Everything lands between 0 and 1. The threads crowd together at both ends.', scene: s => [transfer({ act: 'logistic' }), curvePanel({ act: 'logistic' })] },
        { label: 'tanh', hold: 1700, note: 'The same shape, centred on zero. Negative inputs give negative outputs, which keeps the next layer honest.', scene: s => [transfer({ act: 'tanh' }), curvePanel({ act: 'tanh' })] },
        { label: 'saturation', hold: 1800, note: 'Push the input to 4 and then to 3. The output barely notices. Two very different numbers have become the same number.', scene: s => [transfer(s, { live: 3.6 }), curvePanel(s, { live: 3.6 }), satMark(s)] },
        { label: 'compare them', note: 'Switch between all four. Watch how much of the input ruler each one actually uses.', scene: s => [transfer(s, { live: +s.live }), curvePanel(s, { live: +s.live })] },
      ],
    },

    /* ── 6 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'the derivative is the part that learns',
      prose: `<p>Fitting a network means rolling downhill, and rolling downhill means multiplying derivatives together — one per layer, by the chain rule. So the number that actually decides whether a network trains is not the activation. It is the activation's <strong>derivative</strong>.</p>
        <p>Both curves are drawn now: the function on top, its slope underneath, with a dashed line at 1 for reference.</p>
        <p>ReLU's derivative is <em>exactly 1</em> everywhere it is on. Logistic's peaks at <em>0.25</em> and falls away to nothing in both directions. Hold that 0.25 in mind for one more step.</p>`,
      formula: formula(
        frac('∂L', '∂w') + eq + t('…', { tone: 'muted' }) + times + t("f'", { tone: 'warm' }) + paren(sub('z', '3')) + times + t("f'", { tone: 'warm' }) + paren(sub('z', '2')) + times + t("f'", { tone: 'warm' }) + paren(sub('z', '1')) + times + t('…', { tone: 'muted' }) +
        '<br>' + t('one factor per layer, all multiplied together', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'the chain rule, which is the only reason any of this matters' }),
      dep: { note: 'a slope multiplied through a composition is the', lesson: 'derivatives', label: 'chain rule' },
      controls: [
        { type: 'segment', key: 'act', label: 'activation', options: [
          { value: 'relu', label: 'ReLU' }, { value: 'logistic', label: 'logistic' },
          { value: 'tanh', label: 'tanh' }, { value: 'leaky', label: 'leaky ReLU' },
        ] },
        { type: 'slider', key: 'live', label: 'input', min: -4, max: 4, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
      ],
      readouts: [
        { key: 'a', label: 'activation', get: s => A(s).name, wide: true },
        { key: 'd', label: "f'(x) here", tone: 'warm', get: s => A(s).d(+s.live), d: 4, wide: true },
        { key: 'm', label: 'largest it ever gets', tone: 'gold', get: s => Math.max(...range(801).map(i => A(s).d(-4 + i * 0.01))), d: 3, wide: true },
      ],
      beats: [
        { label: 'ReLU and its slope', hold: 1700, note: 'One or zero. Nothing in between, and nothing that shrinks.', scene: s => [transfer({ act: 'relu' }, { threads: false, live: +s.live }), curvePanel({ act: 'relu' }, { live: +s.live, deriv: true })] },
        { label: 'logistic and its slope', hold: 1800, note: 'A bump that maxes out at <b>0.25</b> and is essentially zero past ±4.', scene: s => [transfer({ act: 'logistic' }, { threads: false, live: +s.live }), curvePanel({ act: 'logistic' }, { live: +s.live, deriv: true })] },
        { label: 'tanh and its slope', hold: 1800, note: 'Maxes at 1 — four times better than logistic, and the reason tanh replaced it long before ReLU did.', scene: s => [transfer({ act: 'tanh' }, { threads: false, live: +s.live }), curvePanel({ act: 'tanh' }, { live: +s.live, deriv: true })] },
        { label: 'your turn', note: 'Drag the input to the edges and watch the derivative readout for each one.', scene: s => [transfer(s, { threads: false, live: +s.live }), curvePanel(s, { live: +s.live, deriv: true })] },
      ],
    },

    /* ── 7 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'why deep networks would not train',
      prose: `<p>Now multiply those derivatives together, one per layer, and watch what happens to the number that reaches the first layer.</p>
        <p>With logistic units the very best case is 0.25 per layer. Six layers of that is 0.25⁶ — about two ten-thousandths. The first layer receives a gradient so small it is indistinguishable from zero, and it never learns anything. This is the <strong>vanishing gradient</strong>, and it is why neural networks were considered a dead end for most of the 1990s.</p>
        <p>With ReLU the factor is 1. Multiply 1 by itself as many times as you like. The gradient arrives intact.</p>
        <p>Drag <strong>layers</strong> and watch the bars.</p>`,
      formula: formula(
        t('logistic', { tone: 'gold' }) + op(':&nbsp;') + '0.25' + sup('', 'L') + op('&nbsp;&nbsp;·&nbsp;&nbsp;') +
        t('tanh', { tone: 'purple' }) + op(':&nbsp;') + '≤ 1' + sup('', 'L') + op('&nbsp;&nbsp;·&nbsp;&nbsp;') +
        t('ReLU', { tone: 'cyan' }) + op(':&nbsp;') + '1' + sup('', 'L') + eq + '1',
        { caption: 'best case per layer, raised to the number of layers' }),
      controls: [{ type: 'slider', key: 'depth', label: 'layers', min: 1, max: 12, step: 1, fast: true }],
      readouts: [
        { key: 'L', label: 'layers', get: s => s.depth, d: 0 },
        { key: 'lo', label: 'logistic, best case', tone: 'gold', get: s => Math.pow(0.25, s.depth), d: 8, wide: true },
        { key: 'ta', label: 'tanh, best case', tone: 'purple', get: s => 1, d: 2 },
        { key: 're', label: 'ReLU, when on', tone: 'cyan', get: s => 1, d: 2 },
      ],
      beats: [
        { label: 'one layer', hold: 1200, note: 'At one layer they all look fine. This is why the problem was hard to see.', scene: s => vanish(s, 1) },
        { label: 'three layers', hold: 1300, note: '0.25³ is already 0.016.', scene: s => vanish(s, 3) },
        { label: 'six layers', hold: 1500, note: '0.00024. The first layer is receiving noise.', scene: s => vanish(s, 6) },
        { label: 'twelve', hold: 1800, note: 'Six in a hundred million. In 32-bit arithmetic this is close to being literally zero.', scene: s => vanish(s, 12) },
        { label: 'your turn', note: 'Drag <b>layers</b>. The cyan bar never moves; that is the entire argument for ReLU.', scene: s => vanish(s, s.depth) },
      ],
      aside: `<p><strong>The historical version.</strong> This is not a footnote — it is the reason deep learning arrived in 2012 rather than 1992. The architectures were known. What was missing was a way to get a usable gradient back through more than about three layers, and a rectifier plus better initialisation supplied it.</p>`,
    },

    /* ── 8 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'the failure mode ReLU has instead',
      prose: `<p>ReLU trades one problem for a smaller one. Its derivative left of zero is not small — it is <em>exactly</em> zero.</p>
        <p>A unit whose input is negative for every training example receives no gradient at all, so its weights never update, so its input stays negative. It is dead, permanently, and a badly set learning rate can kill a large fraction of a layer in a single step.</p>
        <p><strong>Leaky ReLU</strong> gives the flat side a shallow slope, so a dead unit can crawl back. <strong>Softplus</strong> rounds the corner off entirely and is smooth everywhere, at the cost of an exponential per number.</p>`,
      controls: [
        { type: 'segment', key: 'act', label: 'activation', options: [
          { value: 'relu', label: 'ReLU' }, { value: 'leaky', label: 'leaky ReLU' }, { value: 'softplus', label: 'softplus' },
        ] },
      ],
      readouts: [
        { key: 'a', label: 'activation', get: s => A(s).name, wide: true },
        { key: 'd', label: "f'(−2)", tone: 'warm', get: s => A(s).d(-2), d: 4, wide: true, explain: 'The gradient a unit sitting at −2 receives. Zero means it can never move again.' },
        { key: 'v', label: 'verdict', get: s => (A(s).d(-2) === 0 ? 'this unit is dead' : 'it can recover'), wide: true },
      ],
      beats: [
        { label: 'the dead half', hold: 1700, note: 'Left of zero the slope is flat. A unit that lives over there gets no signal to move.', scene: s => dying(s, 1) },
        { label: 'leaky ReLU', hold: 1700, note: 'A slope of 0.1 instead of 0. Small enough to keep the bend, large enough to escape.', scene: s => dying({ ...s, act: 'leaky' }, 2) },
        { label: 'softplus', hold: 1700, note: 'A smooth version with no corner at all. Its derivative is the logistic curve — which is a pleasing thing to discover rather than be told.', scene: s => dying({ ...s, act: 'softplus' }, 2) },
        { label: 'compare', note: 'Switch between the three and read <b>f′(−2)</b>.', scene: s => dying(s, 2) },
      ],
    },

    /* ── 9 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'what the bend actually buys',
      prose: `<p>The payoff, on real points. Six hidden units, the same data, the same training loop, three different activations.</p>
        <p>With <strong>no activation</strong> the six units collapse into one, exactly as in step 2, and the best the network can do is a straight boundary. With <strong>ReLU</strong> the boundary is made of straight segments hinged together. With <strong>tanh</strong> it is smooth.</p>
        <p>Nothing about the architecture changed between these three pictures. One function, applied one number at a time, is the difference between a line and a shape.</p>`,
      controls: [
        { type: 'segment', key: 'act', label: 'activation', options: [
          { value: 'identity', label: 'none' }, { value: 'relu', label: 'ReLU' }, { value: 'tanh', label: 'tanh' },
        ] },
      ],
      readouts: [
        { key: 'a', label: 'activation', get: s => (ACTS[s.act] || ACTS.relu).name, wide: true },
        { key: 'acc', label: 'training accuracy', tone: 'green', get: s => accOf(s.act), d: 1, fmt: v => v.toFixed(1) + '%', wide: true },
        { key: 'sh', label: 'boundary shape', get: s => ({ identity: 'a straight line', relu: 'hinged segments', tanh: 'smooth' }[s.act] || '—'), wide: true },
      ],
      beats: [
        { label: 'the data', hold: 1300, note: 'Two interleaving crescents. No straight line separates them.', scene: s => moons(s, 0) },
        { label: 'no activation', hold: 1800, note: 'Six units, and the best it can manage is one line. The extra units are algebraically redundant.', scene: s => moons({ ...s, act: 'identity' }, 1) },
        { label: 'ReLU', hold: 1800, note: 'The same six units, now each contributing a hinge.', scene: s => moons({ ...s, act: 'relu' }, 1) },
        { label: 'tanh', hold: 1800, note: 'Smooth, because each unit contributes an S rather than a corner.', scene: s => moons({ ...s, act: 'tanh' }, 1) },
        { label: 'the summary', note: 'Everything you can turn, and what it costs.', scene: s => knobCards([
          { name: 'ReLU', value: 'the default', tone: 'cyan',
            does: 'max(0, x). Gradient of exactly 1 when on, so it survives depth. One comparison per number.',
            low: 'units can die and never recover', high: 'no upper bound — activations can grow without limit' },
          { name: 'tanh', value: 'small nets, RNNs', tone: 'purple',
            does: 'A smooth S from −1 to 1, centred on zero so the next layer sees both signs.',
            low: 'saturates at the edges', high: 'gradient below 1 everywhere, so it fades with depth' },
          { name: 'logistic', value: 'output layer only', tone: 'gold',
            does: 'Maps anything to (0, 1). Correct for a probability; a poor choice in a hidden layer.',
            low: 'derivative caps at 0.25', high: 'outputs never negative, so gradients all share a sign' },
          { name: 'leaky / softplus', value: 'the repairs', tone: 'green',
            does: 'Give the flat half a small slope, or round the corner off, so nothing can get permanently stuck.',
            low: 'leak too small to rescue anything', high: 'leak so large the bend stops mattering' },
        ], { y0: 62, rowH: 110 }) },
      ],
    },
  ],
};

/* ── scenes ───────────────────────────────────────────────────────────────── */

function stack(s, phase) {
  const f = frame({ w: 720, h: 540, l: 96, r: 60, t: 70, b: 96 });
  f.setX(-3, 3); f.setY(-4.5, 4.5);
  const w1 = +s.w1, w2 = +s.w2;
  const ln = (key, m, cls, lab, labTone) => [
    path(key, [[f.sx(-3), f.sy(clamp(-3 * m, -6, 6))], [f.sx(3), f.sy(clamp(3 * m, -6, 6))]], { cls }),
    label(key + 'l', f.x1 - 4, f.sy(clamp(2.7 * m, -4.2, 4.2)) - 8, lab, { cls: 'lab-sm lab-end lab-' + labTone }),
  ];
  return [
    { key: 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.sy(0), x2: f.x1, y2: f.sy(0) } },
    { key: 'ay', tag: 'line', cls: 'ax-line', attrs: { x1: f.sx(0), y1: f.y0, x2: f.sx(0), y2: f.y1 } },
    label('axl', (f.x0 + f.x1) / 2, f.y0 + 30, 'input x', { cls: 'ax-label' }),
    phase >= 1 ? ln('l1', w1, 'curve curve-cyan curve-dash', 'after layer 1:  w₁x', 'cyan') : null,
    phase >= 2 ? ln('l2', w1 * w2, 'curve curve-purple curve-dash', 'after layer 2:  w₂(w₁x)', 'purple') : null,
    phase >= 3 ? [
      ln('l3', w1 * w2, 'curve curve-fit', '', 'green'),
      label('coll', 360, 96, 'one layer, weight w₁w₂', { cls: 'lab-big lab-mid lab-green' }),
      numLabel('collv', 360, 118, w1 * w2, { cls: 'lab lab-mid lab-green', d: 3, fmt: v => `${w1.toFixed(2)} × ${w2.toFixed(2)} = ${v.toFixed(3)}` }),
      label('coll2', 360, 500, 'drag either weight — it tilts, it never bends', { cls: 'lab-sm lab-mid' }),
    ] : null,
  ];
}

function sumScene(s, upTo) {
  const a = A(s);
  const n = clamp(upTo, 1, 3);
  const f = frame({ w: 720, h: 540, l: 76, r: 40, t: 66, b: 210 });
  f.setX(-4, 4); f.setY(-3.2, 4.2);
  const g = frame({ w: 720, h: 540, l: 76, r: 40, t: 348, b: 66 });
  g.setX(-4, 4); g.setY(-3.6, 4.6);

  return [
    { key: 'ux', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.sy(0), x2: f.x1, y2: f.sy(0) } },
    label('uh', f.x0, f.y1 - 12, 'each hidden unit,  v · f(wx + b)', { cls: 'lab-sm lab-cyan' }),
    UNITS.slice(0, n).map((u, i) => [
      fnPath(f, x => clamp(u.v * a.f(u.w * x + u.b), -8, 8), {
        key: 'u' + i, cls: 'curve curve-' + u.tone, delay: i * 160, opacity: 0.9,
      }),
      label('ul' + i, f.x1 - 4, f.sy(clamp(u.v * a.f(u.w * 3.6 + u.b), -3, 4)) - 8,
        `unit ${i + 1}`, { cls: 'lab-sm lab-end lab-' + u.tone, delay: i * 160 }),
    ]),
    { key: 'sx', tag: 'line', cls: 'ax-line', attrs: { x1: g.x0, y1: g.sy(0), x2: g.x1, y2: g.sy(0) } },
    label('sh', g.x0, g.y1 - 12, 'their sum — what the network outputs', { cls: 'lab-sm lab-green' }),
    fnPath(g, x => clamp(netOut({ act: s.act }, x, n), -8, 8), { key: 'sum', cls: 'curve curve-fit' }),
    label('sn', g.x1 - 4, g.y1 - 12, a.name, { cls: 'lab lab-end lab-' + a.tone }),
    s.act === 'identity'
      ? label('flat', 360, g.y0 + 40, 'still a straight line, with any number of units', { cls: 'lab lab-mid lab-warm' })
      : label('bent', 360, g.y0 + 40, `${n} unit${n > 1 ? 's' : ''} → ${n} bend${n > 1 ? 's' : ''}`, { cls: 'lab lab-mid lab-green' }),
  ];
}

function satMark(s) {
  const a = A(s);
  return [
    path('sat', [[inX(3), IN_Y - 34], [inX(4), IN_Y - 34]], { cls: 'stick', set: { stroke: 'var(--cs-data-warm)', 'stroke-width': 3 } }),
    label('satl', inX(3.5), IN_Y - 42, 'a whole unit of input', { cls: 'lab-sm lab-mid lab-warm' }),
    path('sao', [[outX(a, a.f(3)), OUT_Y + 46], [outX(a, a.f(4)), OUT_Y + 46]], { cls: 'stick', set: { stroke: 'var(--cs-data-warm)', 'stroke-width': 3 } }),
    numLabel('saol', (outX(a, a.f(3)) + outX(a, a.f(4))) / 2, OUT_Y + 62, Math.abs(a.f(4) - a.f(3)), {
      cls: 'lab-sm lab-mid lab-warm', d: 4, pre: 'becomes ', suf: ' of output',
    }),
  ];
}

const VBARS = [
  { k: 'logistic', per: 0.25, tone: 'gold', label: 'logistic  (0.25 per layer)' },
  { k: 'tanh', per: 0.85, tone: 'purple', label: 'tanh  (≈0.85 in practice)' },
  { k: 'relu', per: 1, tone: 'cyan', label: 'ReLU  (1 per layer)' },
];

function vanish(s, L) {
  const X0 = 92, W = 500, Y0 = 132, ROW = 92;
  const bar = v => W * Math.max(0.0025, Math.pow(Math.max(v, 1e-12), 1 / 3));
  return [
    label('vh', 360, 84, `gradient reaching the first layer, after ${L} layer${L > 1 ? 's' : ''}`, { cls: 'lab-big lab-mid lab-gold' }),
    label('vh2', 360, 104, 'bar length is the cube root of the value, or the small ones would be invisible', { cls: 'lab-sm lab-mid' }),
    VBARS.map((b, i) => {
      const v = Math.pow(b.per, L);
      const y = Y0 + i * ROW;
      return [
        rect('vt-' + b.k, X0, y, W, 34, { cls: 'sq sq-dim' }),
        rect('vb-' + b.k, X0, y, bar(v), 34, { cls: 'sq sq-' + (b.k === 'relu' ? 'x' : b.k === 'tanh' ? 'y' : 'gold') }),
        label('vl-' + b.k, X0, y - 8, b.label, { cls: 'lab-sm lab-' + b.tone }),
        numLabel('vv-' + b.k, X0 + W + 14, y + 23, v, {
          cls: 'lab-big lab-' + b.tone, d: 8,
          fmt: x => (x < 1e-4 ? x.toExponential(1) : x.toFixed(x < 0.01 ? 6 : 4)),
        }),
      ];
    }),
    label('vf', 360, 448, Math.pow(0.25, L) < 1e-5
      ? 'the first layer is receiving nothing. it will never learn.'
      : 'still usable — which is why shallow networks trained fine.',
      { cls: 'lab lab-mid ' + (Math.pow(0.25, L) < 1e-5 ? 'lab-warm' : 'lab-green') }),
    label('vf2', 360, 472, 'the cyan bar is the same length at every depth. that is the entire argument.', { cls: 'lab-sm lab-mid' }),
  ];
}

function dying(s, phase) {
  const a = A(s);
  const f = frame({ w: 720, h: 540, l: 76, r: 300, t: 74, b: 260 });
  f.setX(-4, 4); f.setY(-1, 4);
  const g = frame({ w: 720, h: 540, l: 76, r: 300, t: 330, b: 74 });
  g.setX(-4, 4); g.setY(-0.15, 1.2);
  return [
    rect('dead', f.x0, f.y1, f.sx(0) - f.x0, f.y0 - f.y1, { cls: 'sq sq-resid', opacity: phase >= 1 ? 0.5 : 0 }),
    { key: 'fx', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.sy(0), x2: f.x1, y2: f.sy(0) } },
    fnPath(f, a.f, { key: 'fn', cls: 'curve curve-' + a.tone }),
    label('fl', f.x0 + 6, f.y1 - 10, a.name, { cls: 'lab-big lab-' + a.tone }),
    rect('deadg', g.x0, g.y1, g.sx(0) - g.x0, g.y0 - g.y1, { cls: 'sq sq-resid', opacity: phase >= 1 ? 0.5 : 0 }),
    { key: 'gx', tag: 'line', cls: 'ax-line', attrs: { x1: g.x0, y1: g.sy(0), x2: g.x1, y2: g.sy(0) } },
    fnPath(g, a.d, { key: 'gfn', cls: 'curve curve-warm' }),
    path('g1', [[g.x0, g.sy(1)], [g.x1, g.sy(1)]], { cls: 'rule rule-faint rule-dash' }),
    label('gl', g.x0 + 6, g.y1 - 10, 'its derivative', { cls: 'lab lab-warm' }),
    label('dl', (f.x0 + f.sx(0)) / 2, f.y1 + 16, 'inputs over here', { cls: 'lab-sm lab-mid lab-warm' }),
    { key: 'unit', tag: 'circle', cls: 'pt pt-warm', attrs: { cx: g.sx(-2), cy: g.sy(a.d(-2)), r: 7 } },
    numLabel('unitv', g.sx(-2), g.sy(a.d(-2)) - 14, a.d(-2), { cls: 'lab lab-mid lab-warm', d: 3, pre: "f'(−2) = " }),
    label('p1', 442, 116, 'a unit sitting at −2', { cls: 'lab-big lab-warm' }),
    label('p2', 442, 142, a.d(-2) === 0 ? 'receives a gradient of' : 'receives a gradient of', { cls: 'lab-sm' }),
    numLabel('p3', 442, 172, a.d(-2), { cls: 'lab-big lab-' + (a.d(-2) === 0 ? 'warm' : 'green'), d: 3 }),
    a.d(-2) === 0 ? [
      label('p4', 442, 210, 'so its weights never change,', { cls: 'lab-sm' }),
      label('p5', 442, 224, 'so its input stays negative,', { cls: 'lab-sm' }),
      label('p6', 442, 238, 'so it never receives a gradient.', { cls: 'lab-sm' }),
      label('p7', 442, 264, 'dead. permanently.', { cls: 'lab lab-warm' }),
    ] : [
      label('p4', 442, 210, 'small, but not zero — so it', { cls: 'lab-sm' }),
      label('p5', 442, 224, 'still drifts, and can climb back', { cls: 'lab-sm' }),
      label('p6', 442, 238, 'into the useful half.', { cls: 'lab-sm' }),
      label('p7', 442, 264, 'recoverable.', { cls: 'lab lab-green' }),
    ],
    label('p8', 442, 320, 'this is the trade ReLU makes:', { cls: 'lab-sm lab-gold' }),
    label('p9', 442, 334, 'a gradient that never shrinks,', { cls: 'lab-sm' }),
    label('p10', 442, 348, 'in exchange for one that can', { cls: 'lab-sm' }),
    label('p11', 442, 362, 'switch off for good.', { cls: 'lab-sm' }),
  ];
}

function accOf(act) {
  const net = netFor(act === 'identity' ? 'identity' : act);
  const ok = MOONS.y.filter((yy, i) => (net.predict(MOONS.X[i]) > 0.5 ? 1 : 0) === yy).length;
  return (100 * ok) / MOONS.y.length;
}

function moons(s, phase) {
  const f = frame({ w: 720, h: 540, l: 60, r: 44, t: 52, b: 62 });
  const xs = MOONS.X.map(p => p[0]), ys = MOONS.X.map(p => p[1]);
  f.fit(xs, ys, 0.08);
  const out = [];
  if (phase >= 1) {
    const net = netFor(s.act);
    out.push(
      surface(f, (a, b) => net.predict([a, b]), { key: 'srf', n: 46, opacity: 0.6 }),
      boundary(f, (a, b) => net.predict([a, b]), { key: 'bnd', n: 120 }),
    );
  }
  out.push(points(f, range(MOONS.y.length), {
    key: 'm', r: 4.6, x: i => MOONS.X[i][0], y: i => MOONS.X[i][1],
    cls: i => 'pt ' + (MOONS.y[i] ? 'pt-warm' : 'pt-cold'),
  }));
  if (phase >= 1) out.push(
    label('ml', f.x0 + 8, f.y1 + 4, (ACTS[s.act] || ACTS.relu).name, { cls: 'lab-big lab-' + (ACTS[s.act] || ACTS.relu).tone }),
    numLabel('ma', f.x0 + 8, f.y1 + 24, accOf(s.act), { cls: 'lab lab-green', d: 1, suf: '% correct' }),
    label('mh', f.x1 - 8, f.y1 + 4, '6 hidden units, 600 epochs, same seed', { cls: 'lab-sm lab-end' }));
  return out;
}
