/* ─────────────────────────────────────────────────────────────────────────────
   neuralnet.js — logistic regression, stacked. Two inputs, a handful of hidden
   units, one output, trained by gradient descent with the chain rule.
   Small enough that nothing is hidden.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { trainNet, twoClass } from '../core/ml.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, surface, boundary, arrowDefs } from '../core/plot.js';
import { knobCards } from '../core/knobs.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sub, sup, hat, paren, eq, minus, op } from '../core/fx.js';

const F = () => frame({ w: 720, h: 540, l: 62, r: 26, t: 30, b: 54 });

const DATA = {
  xor: twoClass({ shape: 'xor', n: 200, seed: 11 }),
  moons: twoClass({ shape: 'moons', n: 200, noise: 0.2, seed: 42 }),
  rings: twoClass({ shape: 'rings', n: 200, noise: 0.17, seed: 7 }),
  linear: twoClass({ shape: 'linear', n: 200, noise: 0.2, seed: 5 }),
};

const nCache = new Map();
function NET(s) {
  const key = `${s.shape}|${s.hidden}|${s.lr}|${s.act}|${s.l2}|${s.seed}`;
  if (!nCache.has(key)) {
    const d = DATA[s.shape];
    nCache.set(key, trainNet(d.X, d.y, {
      hidden: +s.hidden, lr: +s.lr, epochs: 1200, act: s.act,
      l2: +s.l2 / 1000, seed: 3 + +s.seed, snapshots: 30,
    }));
  }
  return nCache.get(key);
}
const netAt = s => { const n = NET(s); return n.at(Math.round((+s.epoch / 100) * (n.history.length - 1))); };

const dataFrame = s => {
  const d = DATA[s.shape];
  const xs = d.X.map(p => p[0]), ys = d.X.map(p => p[1]);
  const f = F();
  f.setX(Math.min(...xs) - 0.4, Math.max(...xs) + 0.4);
  f.setY(Math.min(...ys) - 0.4, Math.max(...ys) + 0.4);
  return f;
};

const dots = (s, f, o = {}) => DATA[s.shape].X.map((p, i) => ({
  key: `p-${i}`, tag: 'circle', dur: 200,
  cls: DATA[s.shape].y[i] ? 'pt pt-warm' : 'pt pt-cold',
  attrs: { cx: f.sx(p[0]), cy: f.sy(p[1]), r: o.r ?? 4 },
  opacity: o.opacity ?? 1,
}));

const accOf = (s, f) => {
  const d = DATA[s.shape];
  return d.y.filter((yy, i) => ((f(d.X[i]) >= 0.5 ? 1 : 0) === yy)).length / d.y.length;
};

export default {
  meta: {
    id: 'neuralnet', title: 'neural networks', kicker: 'LOGISTIC REGRESSION, STACKED',
    status: 'live',
    deck: 'There is no new mathematics here. A neural network is logistic regression feeding into logistic regression, fitted by rolling downhill using the chain rule. What is new is that the intermediate features are <em>learned</em> rather than chosen by you.',
    dataNote: 'Data: <em>simulated</em> two-class problems, generated in your browser. The XOR pattern is the historically important one — it is the shape that a single-layer model provably cannot learn, and the reason hidden layers exist.',
    deps: ['logistic', 'derivatives'], unlocks: [],
    next: 'causal', nextLabel: 'causal estimands',
    outro: 'a stack of squashed linear models, and a slope followed downhill.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { shape: 'xor', hidden: 4, lr: 0.9, act: 'tanh', l2: 0, epoch: 100, seed: 0, unit: 0 },

  steps: [
    {
      title: 'one unit is something you have already built',
      prose: `<p>Take two inputs, multiply each by a weight, add a bias, squash the result through the logistic function. That is a "neuron", and it is <em>exactly</em> the logistic regression from earlier — same equation, different vocabulary.</p>
        <p>Which means it inherits logistic regression's limitation: the boundary it can draw is a straight line. Nothing about calling it a neuron changes that.</p>
        <p><strong>Switch the data to XOR.</strong> No straight line separates those four clumps. A single unit cannot do it, and in 1969 that observation nearly killed the field.</p>`,
      formula: formula(
        t('output', { tone: 'green' }) + eq + 'σ' + paren(
          t(sub('w', '1'), { tone: 'cyan' }) + sub('x', '1') + ' + ' +
          t(sub('w', '2'), { tone: 'cyan' }) + sub('x', '2') + ' + ' + t('b', { tone: 'gold' })) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('this is logistic regression', { cls: 'fx-muted' }),
        { size: 'sm', caption: 'weights are coefficients; bias is the intercept; the activation is the link' }),
      dep: { note: 'Everything in this equation was built two lessons ago.', lesson: 'logistic', label: 'logistic regression' },
      readouts: [
        { key: 'acc', label: 'one unit gets', tone: 'warm', get: s => accOf({ ...s, hidden: 1 }, NET({ ...s, hidden: 1 }).predict) * 100, d: 1, suf: '%', wide: true },
        { key: 'base', label: 'guessing gets', tone: 'muted', get: s => Math.max(st.mean(DATA[s.shape].y), 1 - st.mean(DATA[s.shape].y)) * 100, d: 1, suf: '%', wide: true },
      ],
      controls: [
        { type: 'segment', key: 'shape', label: 'data', options: [{ value: 'linear', label: 'linear' }, { value: 'xor', label: 'xor' }, { value: 'moons', label: 'moons' }, { value: 'rings', label: 'rings' }] },
      ],
      beats: [
        {
          label: 'a single unit tries',
          note: 'On linearly separable data it does fine. On XOR it is stuck at chance — <b>and no amount of training will help</b>, because the model class cannot express the answer.',
          scene: s => {
            const f = dataFrame(s);
            const net = NET({ ...s, hidden: 1 });
            const acc = accOf(s, net.predict);
            return [
              ...axes(f, { xLabel: 'x₁', yLabel: 'x₂' }),
              ...surface(f, (x, y) => net.predict([x, y]), { n: 30, dur: 220, opacity: 0.55 }),
              ...boundary(f, (x, y) => net.predict([x, y]), { n: 70, dur: 220 }),
              ...dots(s, f),
              label('l', f.x0 + 10, f.y1 + 8, `one unit · accuracy ${(acc * 100).toFixed(1)}%`, { cls: 'lab-big lab-gold', dur: 220 }),
              ...(s.shape === 'xor' ? [label('w', f.midX, f.y0 - 12,
                'no straight line can do this', { cls: 'lab lab-mid lab-warm' })] : []),
            ];
          },
        },
      ],
    },

    {
      title: 'a hidden layer buys you bends',
      prose: `<p>Now put several units side by side, each drawing its own straight boundary, and feed all their outputs into one final unit that decides how to combine them.</p>
        <p>The final unit is <em>still</em> only doing logistic regression. But it is no longer working with your raw x₁ and x₂ — it is working with features the hidden units invented, and in that transformed space the problem has become linearly separable.</p>
        <p>That is the entire trick, and it is why depth helps: each layer gets to reshape the space before the next one looks at it.</p>`,
      formula: formula(
        t('h', { tone: 'cyan' }) + sub('', 'j') + eq + 'σ' + paren(sub('w', 'j1') + sub('x', '1') + ' + ' + sub('w', 'j2') + sub('x', '2') + ' + ' + sub('b', 'j')) +
        `<br>` +
        t('output', { tone: 'green' }) + eq + 'σ' + paren('Σ ' + t('v', { tone: 'gold' }) + sub('', 'j') + t('h', { tone: 'cyan' }) + sub('', 'j') + ' + c'),
        { size: 'sm', caption: 'a linear model on features that a linear model made up' }),
      readouts: [
        { key: 'h', label: 'hidden units', tone: 'cyan', get: s => +s.hidden, d: 0 },
        { key: 'par', label: 'parameters', tone: 'gold', get: s => +s.hidden * 3 + 1, d: 0, wide: true },
        { key: 'acc', label: 'accuracy', tone: 'green', get: s => accOf(s, netAt(s)) * 100, d: 1, suf: '%', wide: true },
      ],
      controls: [
        { type: 'slider', key: 'hidden', label: 'hidden units', min: 1, max: 12, step: 1, fast: true },
        { type: 'segment', key: 'shape', label: 'data', options: [{ value: 'xor', label: 'xor' }, { value: 'moons', label: 'moons' }, { value: 'rings', label: 'rings' }, { value: 'linear', label: 'linear' }] },
        { type: 'segment', key: 'act', label: 'activation', options: [{ value: 'tanh', label: 'tanh' }, { value: 'relu', label: 'relu' }, { value: 'logistic', label: 'logistic' }] },
      ],
      beats: [
        {
          label: 'each unit draws a line',
          note: 'Faint lines are what each hidden unit alone is responding to. The final boundary is built by combining them.',
          scene: s => {
            const f = dataFrame(s);
            const fn = netAt(s);
            const snap = fn.snapshot;
            const items = [
              ...axes(f, { xLabel: 'x₁', yLabel: 'x₂' }),
              ...surface(f, (x, y) => fn([x, y]), { n: 30, dur: 220, opacity: 0.5 }),
            ];
            snap.W1.forEach((w, j) => {
              // where this unit's pre-activation crosses zero: w0 x + w1 y + b = 0
              if (Math.abs(w[1]) < 1e-6) return;
              const yAt = x => -(w[0] * x + snap.b1[j]) / w[1];
              items.push(path(`u-${j}`, [
                [f.sx(f.dx[0]), f.sy(clamp(yAt(f.dx[0]), f.dy[0] - 9, f.dy[1] + 9))],
                [f.sx(f.dx[1]), f.sy(clamp(yAt(f.dx[1]), f.dy[0] - 9, f.dy[1] + 9))],
              ], { cls: 'curve-ghost', dur: 220, opacity: 0.6 }));
            });
            items.push(...boundary(f, (x, y) => fn([x, y]), { n: 70, dur: 220 }));
            items.push(...dots(s, f));
            items.push(label('l', f.x0 + 10, f.y1 + 8,
              `${s.hidden} hidden unit${+s.hidden === 1 ? '' : 's'} · ${(accOf(s, fn) * 100).toFixed(1)}%`,
              { cls: 'lab-big lab-gold', dur: 220 }));
            return items;
          },
        },
        {
          label: 'the architecture',
          hold: 1700,
          note: 'Line thickness is the size of the weight; warm means positive, cold negative. This whole diagram is the model — there is nothing else.',
          scene: s => {
            const fn = netAt(s);
            const snap = fn.snapshot;
            const H = +s.hidden;
            const inX = 140, hX = 380, outX = 610;
            const inY = [220, 320];
            const hY = range(H).map(j => 100 + ((j + 0.5) * 340) / H);
            const items = [];
            snap.W1.forEach((w, j) => w.forEach((v, i) => {
              items.push(path(`w1-${j}-${i}`, [[inX + 22, inY[i]], [hX - 20, hY[j]]], {
                cls: v >= 0 ? 'stick stick-pos' : 'stick stick-neg', dur: 240,
                set: { 'stroke-width': Math.min(5, 0.4 + Math.abs(v) * 1.1) }, opacity: 0.75,
              }));
            }));
            snap.W2.forEach((v, j) => {
              items.push(path(`w2-${j}`, [[hX + 22, hY[j]], [outX - 22, 270]], {
                cls: v >= 0 ? 'stick stick-pos' : 'stick stick-neg', dur: 240,
                set: { 'stroke-width': Math.min(5, 0.4 + Math.abs(v) * 1.1) }, opacity: 0.75,
              }));
            });
            inY.forEach((y, i) => {
              items.push({ key: `in-${i}`, tag: 'circle', cls: 'pt pt-cyan', attrs: { cx: inX, cy: y, r: 20 } });
              items.push(label(`inl-${i}`, inX, y + 5, `x${i + 1}`, { cls: 'lab-big lab-mid' }));
            });
            hY.forEach((y, j) => {
              items.push({ key: `h-${j}`, tag: 'circle', cls: 'pt pt-gold', dur: 240, attrs: { cx: hX, cy: y, r: 16 } });
              items.push(label(`hl-${j}`, hX, y + 4, `h${j + 1}`, { cls: 'lab-sm lab-mid', dur: 240 }));
            });
            items.push({ key: 'out', tag: 'circle', cls: 'pt pt-green', attrs: { cx: outX, cy: 270, r: 22 } });
            items.push(label('outl', outX, 275, 'p̂', { cls: 'lab-big lab-mid' }));
            items.push(label('t1', inX, 60, 'inputs', { cls: 'lab lab-mid lab-cyan' }));
            items.push(label('t2', hX, 60, `hidden (${s.act})`, { cls: 'lab lab-mid lab-gold', dur: 240 }));
            items.push(label('t3', outX, 60, 'output', { cls: 'lab lab-mid lab-green' }));
            items.push(label('n', 360, 500, `${H * 3 + 1} numbers in total — that is the entire model`, { cls: 'lab lab-mid' }));
            return items;
          },
        },
      ],
    },

    {
      title: 'training is rolling downhill',
      prose: `<p>The weights start random and the model is useless. Then, repeatedly: run the data through, measure how wrong you were, work out which direction each weight should move to reduce that, and take a small step.</p>
        <p>Working out those directions is <strong>backpropagation</strong>, and it is nothing more than the chain rule applied from the output backwards. Each weight's gradient is the product of the sensitivities along the path from that weight to the loss.</p>
        <p><strong>Scrub the training slider</strong> and watch the boundary assemble itself out of noise.</p>`,
      formula: formula(
        frac('∂L', '∂' + t('w', { tone: 'cyan' })) + eq +
        frac('∂L', '∂' + t('p̂', { tone: 'green' })) + ' · ' +
        frac('∂' + t('p̂', { tone: 'green' }), '∂' + t('h', { tone: 'gold' })) + ' · ' +
        frac('∂' + t('h', { tone: 'gold' }), '∂' + t('w', { tone: 'cyan' })) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('w ← w − lr · gradient', { tone: 'warm' }),
        { size: 'sm', caption: 'the chain rule, run backwards through the network' }),
      dep: { note: 'This is the chain rule and gradient descent from the calculus lesson.', lesson: 'derivatives', label: 'derivatives' },
      readouts: [
        { key: 'ep', label: 'training progress', tone: 'gold', get: s => +s.epoch, d: 0, suf: '%' },
        { key: 'loss', label: 'loss', tone: 'warm', get: s => netAt(s).snapshot.loss, d: 4, wide: true },
        { key: 'acc', label: 'accuracy', tone: 'green', get: s => accOf(s, netAt(s)) * 100, d: 1, suf: '%', wide: true },
      ],
      controls: [
        { type: 'slider', key: 'epoch', label: 'training progress', min: 0, max: 100, step: 2, fast: true, fmt: v => v + '%' },
        { type: 'slider', key: 'hidden', label: 'hidden units', min: 1, max: 12, step: 1, fast: true },
        { type: 'segment', key: 'shape', label: 'data', options: [{ value: 'xor', label: 'xor' }, { value: 'moons', label: 'moons' }, { value: 'rings', label: 'rings' }] },
      ],
      beats: [
        {
          label: 'the boundary forming',
          note: 'At 0% these are random weights. Everything you see appear after that came from following a gradient.',
          scene: s => {
            const f = dataFrame(s);
            const fn = netAt(s);
            return [
              ...axes(f, { xLabel: 'x₁', yLabel: 'x₂' }),
              ...surface(f, (x, y) => fn([x, y]), { n: 30, dur: 180, opacity: 0.6 }),
              ...boundary(f, (x, y) => fn([x, y]), { n: 70, dur: 180 }),
              ...dots(s, f),
              label('l', f.x0 + 10, f.y1 + 8,
                `epoch ${fn.snapshot.epoch} · loss ${fn.snapshot.loss.toFixed(4)}`, { cls: 'lab-big lab-gold', dur: 180 }),
            ];
          },
        },
        {
          label: 'the loss curve',
          note: 'Steep early, then a long flat tail. If yours goes <b>up</b>, the learning rate is too big — the next step covers that.',
          scene: s => {
            const net = NET(s);
            const f = F();
            f.setX(0, net.history.at(-1).epoch);
            f.setY(0, Math.max(...net.history.map(h => h.loss)) * 1.1);
            const cur = netAt(s).snapshot;
            return [
              ...axes(f, { xLabel: 'epoch', yLabel: 'cross-entropy loss', yN: 5 }),
              path('c', net.history.map(h => [f.sx(h.epoch), f.sy(h.loss)]), { cls: 'curve curve-warm', dur: 240 }),
              { key: 'now', tag: 'circle', cls: 'pt pt-green', dur: 180, attrs: { cx: f.sx(cur.epoch), cy: f.sy(cur.loss), r: 8 } },
              label('l', f.midX, f.y1 + 8, 'this is the same quantity as the GLM deviance', { cls: 'lab lab-mid' }),
            ];
          },
        },
      ],
    },

    {
      title: 'the knobs, and what each one does',
      prose: `<p>Four settings account for most of what goes wrong with a small network. Two of them — the learning rate and the width — fail in ways you can see immediately on the plot.</p>
        <p><strong>Push the learning rate above about 3</strong> and watch training fall apart: the steps overshoot the valley and the loss climbs instead of falling. It is the same divergence as the gradient-descent demo in the calculus lesson, and it is the most common reason a network "won't train".</p>`,
      readouts: [
        { key: 'lr', label: 'learning rate', tone: 'warm', get: s => +s.lr, d: 2 },
        { key: 'h', label: 'hidden units', tone: 'cyan', get: s => +s.hidden, d: 0 },
        { key: 'loss', label: 'final loss', tone: 'gold', get: s => NET(s).finalLoss, d: 4, wide: true },
        { key: 'acc', label: 'accuracy', tone: 'green', get: s => NET(s).accuracy * 100, d: 1, suf: '%', wide: true },
      ],
      controls: [
        { type: 'slider', key: 'lr', label: 'learning_rate', min: 0.02, max: 6, step: 0.02, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'slider', key: 'hidden', label: 'hidden_units', min: 1, max: 12, step: 1, fast: true },
        { type: 'slider', key: 'l2', label: 'weight_decay', min: 0, max: 60, step: 1, fast: true, fmt: v => (+v / 1000).toFixed(3) },
        { type: 'segment', key: 'act', label: 'activation', options: [{ value: 'tanh', label: 'tanh' }, { value: 'relu', label: 'relu' }, { value: 'logistic', label: 'logistic' }] },
      ],
      beats: [
        {
          label: 'the parameter reference',
          note: 'Move the learning rate through its whole range while watching the loss readout. It is the fastest way to feel what each failure looks like.',
          scene: s => knobCards([
            {
              name: 'learning_rate', value: (+s.lr).toFixed(2), tone: 'warm',
              does: 'How big a step to take against the gradient. Sets how fast you descend and whether you descend at all.',
              low: 'trains, but far too slowly to finish',
              high: 'overshoots the valley; loss diverges',
            },
            {
              name: 'hidden_units', value: s.hidden, tone: 'cyan',
              does: 'How many linear boundaries the layer may draw before combining them. This is the capacity of the model.',
              low: 'cannot represent the shape at all',
              high: 'enough capacity to memorise noise',
            },
            {
              name: 'weight_decay (L2)', value: (+s.l2 / 1000).toFixed(3), tone: 'green',
              does: 'A penalty on large weights, pulling them toward zero. Keeps the boundary smooth when the model has more capacity than the data supports.',
              low: 'no brake — sharp, wiggly boundaries',
              high: 'all weights crushed; the model gives up',
            },
            {
              name: 'activation', value: s.act, tone: 'purple',
              does: 'The squashing function inside each hidden unit. Without one, stacking layers collapses back to a single linear model.',
              low: 'tanh — smooth, saturates at both ends',
              high: 'relu — cheap, sparse, can go permanently dead',
            },
          ]),
        },
        {
          label: 'what a bad learning rate looks like',
          note: 'Each curve is the same network at a different learning rate. Too small never arrives; too large never settles.',
          scene: s => {
            const rates = [0.05, 0.5, 2, 5];
            const f = F();
            f.setX(0, 1200); f.setY(0, 1.0);
            return [
              ...axes(f, { xLabel: 'epoch', yLabel: 'loss', yN: 5 }),
              ...rates.map((r, i) => {
                const n = NET({ ...s, lr: r });
                return path(`c-${i}`, n.history.map(h => [f.sx(h.epoch), f.sy(Math.min(h.loss, 1.0))]), {
                  cls: `curve ${['curve-cold', 'curve-fit', 'curve-gold', 'curve-warm'][i]}`, delay: i * 200, dur: 260,
                });
              }),
              ...rates.map((r, i) => label(`l-${i}`, f.x1 - 6, f.y1 + 12 + i * 18, `lr = ${r}`, {
                cls: `lab-sm lab-end ${['lab-cold', 'lab-green', 'lab-gold', 'lab-warm'][i]}`, delay: i * 200,
              })),
              { key: 'now', tag: 'circle', cls: 'pt pt-green', dur: 200, attrs: { cx: f.sx(1200), cy: f.sy(Math.min(NET(s).finalLoss, 1)), r: 7 } },
              label('n', f.midX, f.y0 - 12, 'your current setting is the green dot', { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
      ],
    },

    {
      title: 'what it is and is not',
      prose: `<p>A network with enough hidden units can approximate essentially any continuous function. That is a real theorem, and it is also nearly useless as guidance — it says a solution exists, not that gradient descent will find it, nor that you have enough data to justify it.</p>
        <p>What you actually get in exchange for that flexibility:</p>
        <ul>
          <li><strong>No coefficients to interpret.</strong> There is no "effect of x₁ holding x₂ constant" — the weights are not identified, and a different random start gives different ones with the same predictions.</li>
          <li><strong>No standard errors.</strong> Nothing here produces a confidence interval. If you need uncertainty, you have to build it in — which is what the Bayesian lessons are for.</li>
          <li><strong>A hunger for data.</strong> More capacity needs more observations to pin it down, and there is no n − p bookkeeping to warn you.</li>
        </ul>
        <p>On the small tabular problems most people actually have, a random forest usually wins. The network earns its keep when the raw features are pixels, audio or text — where the learned intermediate representation is the entire value.</p>`,
      aside: `<b>The honest comparison.</b> Try the same dataset in the forest lesson and here. On 200 points in two dimensions they land in the same place, and the forest got there with no learning rate to tune and a free error estimate. Flexibility is not free, and it is not always what is missing.`,
      readouts: [
        { key: 'acc', label: 'network accuracy', tone: 'green', get: s => NET(s).accuracy * 100, d: 1, suf: '%', wide: true },
        { key: 'par', label: 'parameters', tone: 'gold', get: s => NET(s).nParams, d: 0, wide: true },
        { key: 'n', label: 'observations', tone: 'cyan', get: s => DATA[s.shape].y.length, d: 0, wide: true },
        { key: 'ratio', label: 'points per parameter', tone: 'warm', get: s => DATA[s.shape].y.length / NET(s).nParams, d: 1, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'hidden', label: 'hidden_units', min: 1, max: 12, step: 1, fast: true },
        { type: 'slider', key: 'seed', label: 'different random start', min: 0, max: 8, step: 1, fast: true, fmt: () => 'reroll' },
      ],
      beats: [
        {
          label: 'same predictions, different weights',
          note: 'Reroll the initialisation. The boundary barely moves; the weights underneath are completely different numbers. <b>That is why they cannot be interpreted.</b>',
          scene: s => {
            const f = dataFrame(s);
            const net = NET(s);
            const snap = net.history.at(-1);
            const items = [
              ...axes(f, { xLabel: 'x₁', yLabel: 'x₂' }),
              ...surface(f, (x, y) => net.predict([x, y]), { n: 30, dur: 220, opacity: 0.55 }),
              ...boundary(f, (x, y) => net.predict([x, y]), { n: 70, dur: 220 }),
              ...dots(s, f),
              label('acc', f.x0 + 10, f.y1 + 8, `accuracy ${(net.accuracy * 100).toFixed(1)}%`, { cls: 'lab-big lab-green', dur: 220 }),
            ];
            snap.W1.slice(0, 6).forEach((w, j) => {
              items.push(label(`w-${j}`, f.x1 - 8, f.y1 + 8 + j * 16,
                `h${j + 1}: ${w[0].toFixed(2)}, ${w[1].toFixed(2)}`, { cls: 'lab-sm lab-end', dur: 220 }));
            });
            return items;
          },
        },
      ],
    },
  ],
};
