/* ─────────────────────────────────────────────────────────────────────────────
   decisiontree.js — twenty questions, chosen greedily. The split rule is a drop
   in entropy, which means this lesson is the information lesson applied.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { growTree, treePredict, treeRegions, treeLeaves, treeDepth, gini, entropyBin, twoClass } from '../core/ml.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, surface, arrowDefs } from '../core/plot.js';
import { knobCards } from '../core/knobs.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sub, sup, sumOver, paren, eq, minus, op } from '../core/fx.js';

const F = () => frame({ w: 720, h: 540, l: 62, r: 26, t: 30, b: 54 });

const DATA = {
  moons: twoClass({ shape: 'moons', n: 220, noise: 0.19, seed: 42 }),
  rings: twoClass({ shape: 'rings', n: 220, noise: 0.16, seed: 7 }),
  xor: twoClass({ shape: 'xor', n: 220, seed: 11 }),
  linear: twoClass({ shape: 'linear', n: 220, noise: 0.2, seed: 5 }),
};

const cache = new Map();
function T(s) {
  const key = `${s.shape}|${s.depth}|${s.minLeaf}|${s.crit}|${s.minGain}`;
  if (!cache.has(key)) {
    const d = DATA[s.shape];
    cache.set(key, growTree(d.X, d.y, {
      maxDepth: +s.depth, minLeaf: +s.minLeaf, criterion: s.crit, minGain: +s.minGain / 1000,
    }));
  }
  return cache.get(key);
}

const dataFrame = s => {
  const d = DATA[s.shape];
  const f = F();
  const xs = d.X.map(p => p[0]), ys = d.X.map(p => p[1]);
  const pad = 0.35;
  f.setX(Math.min(...xs) - pad, Math.max(...xs) + pad);
  f.setY(Math.min(...ys) - pad, Math.max(...ys) + pad);
  return f;
};

const dots = (s, f, o = {}) => DATA[s.shape].X.map((p, i) => ({
  key: `p-${i}`, tag: 'circle', dur: o.dur ?? 240,
  cls: DATA[s.shape].y[i] ? 'pt pt-warm' : 'pt pt-cold',
  attrs: { cx: f.sx(p[0]), cy: f.sy(p[1]), r: o.r ?? 4.5 },
  opacity: o.opacity ?? 1,
}));

/* accuracy on a held-out half, so overfitting is visible */
function split(s) {
  const d = DATA[s.shape];
  const tr = [], te = [];
  d.X.forEach((x, i) => (i % 3 === 0 ? te : tr).push(i));
  return { d, tr, te };
}
function errs(s) {
  const { d, tr, te } = split(s);
  const tree = growTree(tr.map(i => d.X[i]), tr.map(i => d.y[i]), {
    maxDepth: +s.depth, minLeaf: +s.minLeaf, criterion: s.crit, minGain: +s.minGain / 1000,
  });
  const err = idx => idx.filter(i => (treePredict(tree, d.X[i]) >= 0.5 ? 1 : 0) !== d.y[i]).length / idx.length;
  return { train: err(tr), test: err(te), tree };
}

export default {
  meta: {
    id: 'decisiontree', title: 'decision trees', kicker: 'TWENTY QUESTIONS',
    status: 'live',
    deck: 'A tree asks one yes/no question at a time and picks, at every step, whichever question removes the most uncertainty. That "most uncertainty removed" is entropy, which makes a decision tree the most literal application of information theory in ordinary use.',
    dataNote: 'Data: <em>simulated</em> two-class problems with known boundaries, generated in your browser. Simulation is right here because the whole lesson is about whether a model recovers the true shape or memorises noise — which you can only judge when the truth is knowable.',
    deps: ['entropy'], unlocks: ['randomforest'],
    next: 'randomforest', nextLabel: 'random forests',
    outro: 'greedy questions, axis-aligned boxes, and one parameter that decides everything.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { shape: 'moons', depth: 3, minLeaf: 5, crit: 'gini', minGain: 0, showSurface: true, thresh: 0 },

  steps: [
    {
      title: 'one question, chosen greedily',
      prose: `<p>Two classes, scattered in a plane. A tree is only allowed one kind of move: pick a feature, pick a threshold, and cut.</p>
        <p>Every possible cut leaves you with two groups, each with its own mix of classes. A good cut leaves each side <em>purer</em> than the parent was. So try all of them and take the best.</p>
        <p><strong>Drag the threshold</strong> and watch the purity gain rise and fall. The tree does this search exhaustively at every node.</p>`,
      formula: formula(
        t('gain', { tone: 'green' }) + eq +
        t('impurity(parent)', { tone: 'gold' }) + minus +
        paren(frac(t('n', { tone: 'muted' }) + sub('', 'L'), 'n') + '·imp(L) + ' + frac(sub('n', 'R'), 'n') + '·imp(R)'),
        { size: 'sm', caption: 'how much mess the question removed, weighted by group size' }),
      readouts: [
        { key: 'th', label: 'threshold', tone: 'gold', get: s => +s.thresh, d: 2 },
        { key: 'gain', label: 'gain', tone: 'green', get: s => gainAt(s, +s.thresh), d: 4, wide: true },
        { key: 'best', label: 'best possible', tone: 'cyan', get: s => bestSplit(s).gain, d: 4, wide: true },
        { key: 'bestT', label: 'at threshold', tone: 'cyan', get: s => bestSplit(s).thresh, d: 2, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'thresh', label: 'cut x₁ at', min: -3, max: 3, step: 0.02, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'segment', key: 'crit', label: 'impurity', options: [{ value: 'gini', label: 'gini' }, { value: 'entropy', label: 'entropy' }] },
        { type: 'button', key: 'snap', label: '[jump to the best cut]', action: s => { s.thresh = +bestSplit(s).thresh.toFixed(2); } },
      ],
      beats: [
        { label: 'two features', hold: 1100, note: 'Two measurements per point. Nothing decided yet.', scene: s => cut(s, 0) },
        { label: 'the points', hold: 1400, note: 'Two classes. The tree has never seen a colour before this moment.', scene: s => cut(s, 1) },
        { label: 'one cut', hold: 1500, note: 'Pick a feature, pick a threshold, draw a line. That is the only move a tree has.', scene: s => cut(s, 2) },
        {
          label: 'was it a good one?',
          note: 'Left of the line and right of the line. The bars underneath show the class mix on each side — the tree wants them as lopsided as possible.',
          scene: s => cut(s, 3),
        },
        {
          label: 'the gain across all cuts',
          note: 'Every possible threshold, scored. The tree takes the peak. Notice there are usually several near-ties — which is why trees are unstable.',
          scene: s => {
            const f = F();
            f.setX(-3, 3);
            const gains = range(120).map(i => gainAt(s, -3 + (6 * i) / 119));
            f.setY(0, Math.max(...gains) * 1.25 + 1e-6);
            const best = bestSplit(s);
            return [
              ...axes(f, { xLabel: 'threshold on x₁', yLabel: `${s.crit} gain`, yN: 4 }),
              fnPath(f, x => gainAt(s, x), { key: 'g', cls: 'curve curve-fit', n: 200 }),
              vLine(f, best.thresh, { key: 'b', cls: 'rule-gold rule-dash' }),
              { key: 'bp', tag: 'circle', cls: 'pt pt-green', attrs: { cx: f.sx(best.thresh), cy: f.sy(best.gain), r: 7 } },
              { key: 'now', tag: 'circle', cls: 'pt pt-gold', dur: 200, attrs: { cx: f.sx(+s.thresh), cy: f.sy(gainAt(s, +s.thresh)), r: 6 } },
              label('bl', f.sx(best.thresh), f.sy(best.gain) - 16, `best cut at ${best.thresh.toFixed(2)}`, { cls: 'lab lab-mid lab-green' }),
            ];
          },
        },
      ],
    },

    {
      title: 'then do it again inside each half',
      prose: `<p>Having cut once, treat each side as its own smaller problem and cut again. And again. Each cut is chosen with no thought for what might come later — the tree is <strong>greedy</strong>, and that is both why it is fast and why it is not optimal.</p>
        <p>The result is a partition of the plane into rectangles, every one of them axis-aligned. That constraint is the tree's defining limitation: a diagonal boundary has to be approximated by a staircase.</p>
        <p><strong>Push the depth up</strong> and watch the boxes multiply.</p>`,
      readouts: [
        { key: 'd', label: 'depth', tone: 'gold', get: s => +s.depth, d: 0 },
        { key: 'leaves', label: 'leaves', tone: 'green', get: s => treeLeaves(T(s)).length, d: 0 },
        { key: 'acc', label: 'training accuracy', tone: 'cyan', get: s => trainAcc(s) * 100, d: 1, suf: '%', wide: true },
      ],
      controls: [
        { type: 'slider', key: 'depth', label: 'max depth', min: 1, max: 10, step: 1, fast: true },
        { type: 'segment', key: 'shape', label: 'data', options: [{ value: 'moons', label: 'moons' }, { value: 'rings', label: 'rings' }, { value: 'xor', label: 'xor' }, { value: 'linear', label: 'linear' }] },
        { type: 'toggle', key: 'showSurface', label: 'shade the prediction' },
      ],
      beats: [
        {
          label: 'the partition',
          note: 'Each rectangle is one leaf — one final answer. Everything landing in that box gets the same prediction.',
          scene: s => {
            const f = dataFrame(s);
            const tree = T(s);
            const regions = treeRegions(tree, [f.dx[0], f.dx[1], f.dy[0], f.dy[1]]);
            return [
              ...axes(f, { xLabel: 'feature x₁', yLabel: 'feature x₂' }),
              ...(s.showSurface ? regions.map((r, i) => {
                const [x0, x1, y0, y1] = r.box;
                const c = [74 + (232 - 74) * r.p, 144 + (89 - 144) * r.p, 217 + (79 - 217) * r.p].map(Math.round);
                return rect(`r-${i}`, f.sx(x0), f.sy(y1), f.sx(x1) - f.sx(x0), f.sy(y0) - f.sy(y1), {
                  dur: 240, set: { fill: `rgb(${c[0]},${c[1]},${c[2]})`, stroke: 'rgba(255,255,255,.14)' },
                  opacity: 0.1 + 0.5 * Math.abs(r.p - 0.5) * 2,
                  tip: `${r.n} points here<br>predicts <b>${(r.p * 100).toFixed(0)}%</b> warm`,
                });
              }) : []),
              ...dots(s, f),
              label('l', f.x0 + 10, f.y1 + 8,
                `depth ${s.depth} · ${treeLeaves(tree).length} leaves`, { cls: 'lab-big lab-gold', dur: 240 }),
              ...(s.shape === 'linear' && +s.depth > 2
                ? [label('stair', f.midX, f.y0 - 12, 'a diagonal boundary, approximated by a staircase', { cls: 'lab lab-mid lab-warm' })] : []),
            ];
          },
        },
        {
          label: 'the tree itself',
          hold: 1700,
          note: 'The same model as a diagram. Each box is a question; each leaf is an answer with the number of training points behind it.',
          scene: s => {
            const tree = T(s);
            return drawTree(tree, { x0: 30, x1: 690, y0: 60, y1: 500 });
          },
        },
      ],
    },

    {
      title: 'the knobs, and what each one does',
      prose: `<p>A tree has no coefficients to estimate. What it has instead are <strong>hyperparameters</strong> — settings you choose, which decide how much structure the tree is allowed to invent.</p>
        <p>Almost all of them do the same job from different angles: stop the tree before it starts memorising. Set them too loose and the tree will happily grow one leaf per data point and report perfect accuracy on data it has already seen.</p>
        <p>The names below are the ones scikit-learn and rpart use, so they should look familiar in your own code.</p>`,
      readouts: [
        { key: 'leaves', label: 'leaves', tone: 'green', get: s => treeLeaves(T(s)).length, d: 0 },
        { key: 'depth', label: 'actual depth', tone: 'gold', get: s => treeDepth(T(s)), d: 0, wide: true },
        { key: 'tr', label: 'train error', tone: 'cyan', get: s => errs(s).train * 100, d: 1, suf: '%', wide: true },
        { key: 'te', label: 'held-out error', tone: 'warm', get: s => errs(s).test * 100, d: 1, suf: '%', wide: true },
      ],
      controls: [
        { type: 'slider', key: 'depth', label: 'max_depth', min: 1, max: 12, step: 1, fast: true },
        { type: 'slider', key: 'minLeaf', label: 'min_samples_leaf', min: 1, max: 40, step: 1, fast: true },
        { type: 'slider', key: 'minGain', label: 'min_impurity_decrease', min: 0, max: 40, step: 1, fast: true, fmt: v => (+v / 1000).toFixed(3) },
        { type: 'segment', key: 'crit', label: 'criterion', options: [{ value: 'gini', label: 'gini' }, { value: 'entropy', label: 'entropy' }] },
      ],
      beats: [
        {
          label: 'the parameter reference',
          note: 'These four are almost the whole API. Move any slider and watch the two error readouts move in opposite directions.',
          scene: s => knobCards([
            {
              name: 'max_depth', value: s.depth, tone: 'gold',
              does: 'How many questions deep the tree may go. Each level can at most double the number of regions, so this is an exponential dial.',
              low: 'underfits — cannot express the real shape',
              high: 'memorises individual points',
            },
            {
              name: 'min_samples_leaf', value: s.minLeaf, tone: 'cyan',
              does: 'The smallest group a leaf is allowed to contain. Refusing tiny leaves stops the tree carving out boxes around single observations.',
              low: 'leaves of one — pure noise fitting',
              high: 'coarse, blurry regions',
            },
            {
              name: 'min_impurity_decrease', value: (+s.minGain / 1000).toFixed(3), tone: 'green',
              does: 'A minimum payoff a split must deliver before it is allowed. Splits that barely help get refused.',
              low: 'accepts splits that are basically noise',
              high: 'the tree refuses to grow at all',
            },
            {
              name: 'criterion', value: s.crit, tone: 'purple',
              does: 'How impurity is measured. Gini is 2p(1−p); entropy is the information measure. They rank splits almost identically in practice.',
              low: 'gini — very slightly faster',
              high: 'entropy — punishes near-50/50 a little harder',
            },
          ]),
        },
        {
          label: 'gini against entropy',
          note: 'Both peak at a 50/50 mix and hit zero at purity. They disagree so rarely that the choice almost never matters.',
          scene: () => {
            const f = F();
            f.setX(0, 1); f.setY(0, 1.08);
            return [
              ...axes(f, { xLabel: 'proportion of one class in the node', yLabel: 'impurity', yN: 4 }),
              fnPath(f, gini, { key: 'g', cls: 'curve curve-cyan', n: 200 }),
              fnPath(f, entropyBin, { key: 'e', cls: 'curve curve-warm', n: 200 }),
              vLine(f, 0.5, { key: 'h', cls: 'rule-faint rule-dash' }),
              label('lg', f.sx(0.5), f.sy(0.5) + 20, 'gini · 2p(1−p)', { cls: 'lab lab-mid lab-cyan' }),
              label('le', f.sx(0.5), f.sy(1) - 12, 'entropy · −Σ p log p', { cls: 'lab lab-mid lab-warm' }),
              label('l0', f.sx(0.03), f.y0 - 14, 'pure', { cls: 'lab-sm' }),
              label('l1', f.sx(0.97), f.y0 - 14, 'pure', { cls: 'lab-sm lab-end' }),
            ];
          },
        },
      ],
    },

    {
      title: 'where it goes wrong',
      prose: `<p>Trees overfit more eagerly than almost any other model, because they can always keep asking questions until every point is alone in its own box.</p>
        <p>The plot below fits on two-thirds of the data and scores on the third the tree never saw. Training error marches to zero. <strong>Held-out error bottoms out and then climbs</strong> — and everything after that minimum is the tree learning the noise in the training set.</p>
        <p>This is the same bias–variance curve as the splines lesson, with a different dial. It always looks like this.</p>`,
      aside: `<b>What people actually do.</b> Rather than guessing the depth, grow the tree fully and then <i>prune</i> it back, using cross-validation to decide how much to cut. Or — far more common now — stop trying to make one tree good and average hundreds of them instead, which is the next lesson.`,
      readouts: [
        { key: 'd', label: 'depth', tone: 'gold', get: s => +s.depth, d: 0 },
        { key: 'tr', label: 'train error', tone: 'cyan', get: s => errs(s).train * 100, d: 1, suf: '%', wide: true },
        { key: 'te', label: 'held-out error', tone: 'warm', get: s => errs(s).test * 100, d: 1, suf: '%', wide: true },
        { key: 'best', label: 'best depth', tone: 'green', get: s => bestDepth(s), d: 0, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'depth', label: 'max_depth', min: 1, max: 12, step: 1, fast: true },
        { type: 'segment', key: 'shape', label: 'data', options: [{ value: 'moons', label: 'moons' }, { value: 'rings', label: 'rings' }, { value: 'xor', label: 'xor' }, { value: 'linear', label: 'linear' }] },
      ],
      beats: [
        {
          label: 'the two error curves',
          note: 'The gap between the lines is the model fooling itself. It only ever widens.',
          scene: s => {
            const f = F();
            f.setX(1, 12); f.setY(0, 0.55);
            const ds = range(12).map(i => i + 1);
            const tr = ds.map(dd => errs({ ...s, depth: dd }).train);
            const te = ds.map(dd => errs({ ...s, depth: dd }).test);
            const bd = bestDepth(s);
            return [
              ...axes(f, { xLabel: 'max_depth', yLabel: 'classification error', xN: 6, yN: 5 }),
              path('tr', ds.map((dd, i) => [f.sx(dd), f.sy(tr[i])]), { cls: 'curve curve-cyan', dur: 260 }),
              path('te', ds.map((dd, i) => [f.sx(dd), f.sy(te[i])]), { cls: 'curve curve-warm', dur: 260 }),
              ...ds.map((dd, i) => ({
                key: `te-${i}`, tag: 'circle', cls: 'pt pt-warm', delay: i * 50, dur: 260,
                attrs: { cx: f.sx(dd), cy: f.sy(te[i]), r: 4.5 },
                tip: `depth ${dd}<br>held-out error <b>${(te[i] * 100).toFixed(1)}%</b>`,
              })),
              vLine(f, bd, { key: 'bd', cls: 'rule-gold rule-dash' }),
              { key: 'now', tag: 'circle', cls: 'pt pt-green', dur: 200, attrs: { cx: f.sx(+s.depth), cy: f.sy(errs(s).test), r: 8 } },
              label('l1', f.x1 - 6, f.sy(tr[10]) + 22, 'training error — always improving', { cls: 'lab-sm lab-end lab-cyan' }),
              label('l2', f.x1 - 6, f.sy(te[10]) - 12, 'held-out error — the honest one', { cls: 'lab-sm lab-end lab-warm' }),
              label('l3', f.sx(bd), f.y1 + 10, `best depth: ${bd}`, { cls: 'lab lab-mid lab-gold' }),
            ];
          },
        },
      ],
    },
  ],
};

/* ── helpers ──────────────────────────────────────────────────────────────── */

function gainAt(s, th) {
  const d = DATA[s.shape];
  const imp = s.crit === 'entropy' ? entropyBin : gini;
  const idx = range(d.y.length);
  const p = st.mean(d.y);
  const L = idx.filter(i => d.X[i][0] <= th), R = idx.filter(i => d.X[i][0] > th);
  if (!L.length || !R.length) return 0;
  const pL = st.sum(L.map(i => d.y[i])) / L.length;
  const pR = st.sum(R.map(i => d.y[i])) / R.length;
  return imp(p) - (L.length * imp(pL) + R.length * imp(pR)) / idx.length;
}

function bestSplit(s) {
  let best = { gain: 0, thresh: 0 };
  for (let i = 0; i < 200; i++) {
    const th = -3 + (6 * i) / 199;
    const g = gainAt(s, th);
    if (g > best.gain) best = { gain: g, thresh: th };
  }
  return best;
}

function trainAcc(s) {
  const d = DATA[s.shape], tree = T(s);
  return d.y.filter((yy, i) => (treePredict(tree, d.X[i]) >= 0.5 ? 1 : 0) === yy).length / d.y.length;
}

function bestDepth(s) {
  let best = 1, bv = Infinity;
  for (let dd = 1; dd <= 12; dd++) {
    const e = errs({ ...s, depth: dd }).test;
    if (e < bv - 1e-9) { bv = e; best = dd; }
  }
  return best;
}

/** lay a tree out level by level and draw it */
function drawTree(tree, { x0, x1, y0, y1 }) {
  const depth = treeDepth(tree);
  const levels = [];
  const walk = (node, d, lo, hi) => {
    (levels[d] ||= []).push({ node, x: (lo + hi) / 2, lo, hi });
    if (node.leaf) return;
    const mid = (lo + hi) / 2;
    walk(node.left, d + 1, lo, mid);
    walk(node.right, d + 1, mid, hi);
  };
  walk(tree, 0, x0, x1);
  const rowH = (y1 - y0) / Math.max(1, depth + 1);
  const items = [];
  const posOf = new Map();
  levels.forEach((lv, d) => lv.forEach(e => posOf.set(e.node.id, [e.x, y0 + d * rowH])));

  levels.forEach((lv, d) => lv.forEach((e, k) => {
    const [x, y] = posOf.get(e.node.id);
    const w = Math.min(140, (e.hi - e.lo) - 8);
    if (!e.node.leaf) {
      [e.node.left, e.node.right].forEach((ch, ci) => {
        const [cx, cy] = posOf.get(ch.id);
        items.push(path(`e-${e.node.id}-${ci}`, [[x, y + 16], [cx, cy - 16]], { cls: 'map-edge', dur: 240, set: { stroke: '#33333d' } }));
      });
      items.push(rect(`n-${e.node.id}`, x - w / 2, y - 15, w, 30, { cls: 'cell', dur: 240 }));
      items.push(label(`nl-${e.node.id}`, x, y + 4,
        `x${e.node.feat + 1} ≤ ${e.node.thresh.toFixed(2)}`, { cls: 'lab-sm lab-mid lab-gold', dur: 240 }));
    } else {
      const c = [74 + (232 - 74) * e.node.p, 144 + (89 - 144) * e.node.p, 217 + (79 - 217) * e.node.p].map(Math.round);
      items.push(rect(`n-${e.node.id}`, x - Math.min(64, w) / 2, y - 14, Math.min(64, w), 28, {
        dur: 240, set: { fill: `rgb(${c[0]},${c[1]},${c[2]})`, stroke: 'rgba(255,255,255,.2)' }, opacity: 0.65,
        tip: `${e.node.n} points<br><b>${(e.node.p * 100).toFixed(0)}%</b> warm`,
      }));
      items.push(label(`nl-${e.node.id}`, x, y + 4, `${(e.node.p * 100).toFixed(0)}%`, { cls: 'lab-sm lab-mid', dur: 240 }));
    }
  }));
  items.push(label('tt', (x0 + x1) / 2, y0 - 26, 'the same model, drawn as a tree', { cls: 'lab-big lab-mid' }));
  return items;
}

/* ── the opening, staged ──────────────────────────────────────────────────────
   Axes, then points, then a cut, then the verdict on the cut. The whole
   apparatus used to land in one frame. */

function cut(s, phase) {
  const f = dataFrame(s);
  const d = DATA[s.shape];
  const th = +s.thresh;
  const out = [...axes(f, { xLabel: 'feature x₁', yLabel: 'feature x₂' })];

  if (phase >= 3) {
    out.push(
      rect('lz', f.x0, f.y1, f.sx(th) - f.x0, f.y0 - f.y1, { cls: 'sq sq-neg', opacity: 0.18, dur: 200 }),
      rect('rz', f.sx(th), f.y1, f.x1 - f.sx(th), f.y0 - f.y1, { cls: 'sq sq-pos', opacity: 0.18, dur: 200 }));
  }
  if (phase >= 1) out.push(...dots(s, f));
  if (phase >= 2) out.push(vLine(f, th, { key: 'cut', cls: 'rule-gold', dur: 200 }));

  if (phase >= 3) {
    const L = d.X.map((p, i) => i).filter(i => d.X[i][0] <= th);
    const R = d.X.map((p, i) => i).filter(i => d.X[i][0] > th);
    const pL = L.length ? st.sum(L.map(i => d.y[i])) / L.length : 0;
    const pR = R.length ? st.sum(R.map(i => d.y[i])) / R.length : 0;
    const bar = (x0, w, p, n, key) => [
      rect(`${key}bg`, x0, f.y0 + 22, w, 14, { cls: 'cell', dur: 200 }),
      rect(`${key}f`, x0, f.y0 + 22, w * p, 14, { cls: 'sq sq-pos', dur: 200 }),
      label(`${key}l`, x0 + w / 2, f.y0 + 48, `${n} points · ${(p * 100).toFixed(0)}% warm`, { cls: 'lab-sm lab-mid', dur: 200 }),
    ];
    out.push(
      ...bar(f.x0, Math.max(2, f.sx(th) - f.x0), pL, L.length, 'L'),
      ...bar(f.sx(th) + 2, Math.max(2, f.x1 - f.sx(th) - 2), pR, R.length, 'R'));
  }
  return out;
}
