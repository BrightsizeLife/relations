/* ─────────────────────────────────────────────────────────────────────────────
   randomforest.js — one unstable model, run hundreds of times on deliberately
   corrupted copies of the data, then averaged. The instability is the point.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { growTree, treePredict, treeRegions, growForest, twoClass } from '../core/ml.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, surface, boundary, arrowDefs } from '../core/plot.js';
import { knobCards } from '../core/knobs.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sub, sup, paren, eq, minus, op } from '../core/fx.js';

const F = () => frame({ w: 720, h: 540, l: 62, r: 26, t: 30, b: 54 });

const DATA = {
  moons: twoClass({ shape: 'moons', n: 200, noise: 0.2, seed: 42 }),
  rings: twoClass({ shape: 'rings', n: 200, noise: 0.17, seed: 7 }),
  xor: twoClass({ shape: 'xor', n: 200, seed: 11 }),
};

const fCache = new Map();
function FO(s) {
  const key = `${s.shape}|${s.nTrees}|${s.depth}|${s.mtry}|${s.minLeaf}|${s.seed}`;
  if (!fCache.has(key)) {
    const d = DATA[s.shape];
    fCache.set(key, growForest(d.X, d.y, {
      nTrees: +s.nTrees, maxDepth: +s.depth, minLeaf: +s.minLeaf,
      mtry: +s.mtry, seed: 12 + +s.seed,
    }));
  }
  return fCache.get(key);
}

/** a single tree grown on one bootstrap resample — used to show instability */
const bCache = new Map();
function oneTree(s, k) {
  const key = `${s.shape}|${s.depth}|${k}`;
  if (!bCache.has(key)) {
    const d = DATA[s.shape];
    const r = st.rng(100 + k);
    const n = d.y.length;
    const idx = range(n).map(() => Math.floor(r() * n));
    bCache.set(key, growTree(idx.map(i => d.X[i]), idx.map(i => d.y[i]), {
      maxDepth: +s.depth, minLeaf: 2, rand: r,
    }));
  }
  return bCache.get(key);
}

const dataFrame = s => {
  const d = DATA[s.shape];
  const xs = d.X.map(p => p[0]), ys = d.X.map(p => p[1]);
  const f = F();
  f.setX(Math.min(...xs) - 0.35, Math.max(...xs) + 0.35);
  f.setY(Math.min(...ys) - 0.35, Math.max(...ys) + 0.35);
  return f;
};

const dots = (s, f, o = {}) => DATA[s.shape].X.map((p, i) => ({
  key: `p-${i}`, tag: 'circle', dur: 240,
  cls: DATA[s.shape].y[i] ? 'pt pt-warm' : 'pt pt-cold',
  attrs: { cx: f.sx(p[0]), cy: f.sy(p[1]), r: o.r ?? 4 },
  opacity: o.opacity ?? 1,
}));

export default {
  meta: {
    id: 'randomforest', title: 'random forests', kicker: 'AVERAGING UNSTABLE THINGS',
    status: 'live',
    deck: 'A single decision tree is high-variance: change a handful of data points and the whole thing rearranges. A random forest turns that flaw into the mechanism — grow hundreds of deliberately different trees and average them, and the noise cancels while the signal survives.',
    dataNote: 'Data: the same <em>simulated</em> two-class problems as the tree lesson, so the two models can be compared on identical inputs with a known true boundary.',
    deps: ['decisiontree'], unlocks: [],
    next: 'neuralnet', nextLabel: 'neural networks',
    outro: 'many bad models, disagreeing in different directions, averaged into a good one.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { shape: 'moons', nTrees: 30, depth: 6, mtry: 2, minLeaf: 2, seed: 0, which: 0, showTrees: true },

  steps: [
    {
      title: 'one tree is a coin toss',
      prose: `<p>Resample the data — draw 200 points from your 200 with replacement, so some appear twice and some not at all — and refit. Then do it again.</p>
        <p><strong>Flip through the resamples.</strong> The data barely changed. The boundary jumped all over the place.</p>
        <p>That's high variance, and for a single model it's a serious problem. But notice <em>how</em> it fails: the boundaries scatter around the true shape rather than all leaning the same wrong way. Errors that scatter can be averaged away.</p>`,
      formula: formula(
        t('high variance', { tone: 'warm' }) + ': small change in data → large change in model' +
        `<br>` +
        t('low bias', { tone: 'green' }) + ': on average, roughly right',
        { size: 'sm', caption: 'exactly the combination that averaging fixes' }),
      readouts: [
        { key: 'w', label: 'resample', tone: 'gold', get: s => +s.which + 1, d: 0 },
        { key: 'acc', label: 'this tree, on all the data', tone: 'cyan', wide: true, get: s => {
          const d = DATA[s.shape], tr = oneTree(s, +s.which);
          return d.y.filter((yy, i) => (treePredict(tr, d.X[i]) >= 0.5 ? 1 : 0) === yy).length / d.y.length * 100;
        }, d: 1, suf: '%' },
      ],
      controls: [
        { type: 'slider', key: 'which', label: 'resample #', min: 0, max: 11, step: 1, fast: true },
        { type: 'slider', key: 'depth', label: 'tree depth', min: 2, max: 10, step: 1, fast: true },
        { type: 'segment', key: 'shape', label: 'data', options: [{ value: 'moons', label: 'moons' }, { value: 'rings', label: 'rings' }, { value: 'xor', label: 'xor' }] },
      ],
      beats: [
        {
          label: 'one bootstrap tree',
          note: 'Same underlying data, a different random resample. Step through the numbers and watch the staircase rearrange itself.',
          scene: s => {
            const f = dataFrame(s);
            const tr = oneTree(s, +s.which);
            const regions = treeRegions(tr, [f.dx[0], f.dx[1], f.dy[0], f.dy[1]]);
            return [
              ...axes(f, { xLabel: 'x₁', yLabel: 'x₂' }),
              ...regions.map((r, i) => {
                const [x0, x1, y0, y1] = r.box;
                const c = [74 + (232 - 74) * r.p, 144 + (89 - 144) * r.p, 217 + (79 - 217) * r.p].map(Math.round);
                return rect(`r-${i}`, f.sx(x0), f.sy(y1), f.sx(x1) - f.sx(x0), f.sy(y0) - f.sy(y1), {
                  dur: 200, set: { fill: `rgb(${c[0]},${c[1]},${c[2]})`, stroke: 'rgba(255,255,255,.1)' },
                  opacity: 0.12 + 0.5 * Math.abs(r.p - 0.5) * 2,
                });
              }),
              ...dots(s, f),
              label('l', f.x0 + 10, f.y1 + 8, `bootstrap resample ${+s.which + 1}`, { cls: 'lab-big lab-gold', dur: 200 }),
            ];
          },
        },
        {
          label: 'all twelve at once',
          hold: 1800,
          note: 'Twelve boundaries, overlaid. They disagree everywhere — but they disagree <b>around</b> the truth, not consistently to one side.',
          scene: s => {
            const f = dataFrame(s);
            const items = [...axes(f, { xLabel: 'x₁', yLabel: 'x₂' })];
            for (let k = 0; k < 12; k++) {
              const tr = oneTree(s, k);
              items.push(...boundary(f, (x, y) => treePredict(tr, [x, y]), {
                key: `b${k}`, n: 46, dur: 240,
              }).map(it => ({ ...it, opacity: 0.3, set: { ...it.set, fill: 'var(--cs-data-gold)' } })));
            }
            items.push(...dots(s, f, { opacity: 0.8 }));
            items.push(label('l', f.midX, f.y1 + 8, 'twelve trees, twelve different answers', { cls: 'lab-big lab-mid lab-gold' }));
            return items;
          },
        },
      ],
    },

    {
      title: 'average them',
      prose: `<p>Now instead of picking one tree, ask all of them and take the mean of their predicted probabilities. That's <strong>bagging</strong> — bootstrap aggregating.</p>
        <p>The individual staircases don't line up, so where they disagree the average lands somewhere in between. The result is a smooth boundary that no single tree in the forest could have drawn.</p>
        <p><strong>Turn the number of trees up from 1.</strong> Most of the improvement arrives in the first twenty or so, and then it flattens — more trees never hurt, they just stop helping.</p>`,
      formula: formula(
        t('p̂', { tone: 'green' }) + paren('x') + eq + frac('1', 'B') +
        `Σ ` + t('tree', { tone: 'gold' }) + sub('', 'b') + paren('x') +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') +
        t('variance falls by roughly 1/B when the trees are independent', { cls: 'fx-muted' }),
        { size: 'sm', caption: 'the same √n idea from the CLT, applied to models instead of observations' }),
      dep: { note: 'Averaging shrinks variance for exactly the reason the CLT says it does.', lesson: 'clt', label: 'the clt' },
      readouts: [
        { key: 'n', label: 'trees', tone: 'gold', get: s => +s.nTrees, d: 0 },
        { key: 'oob', label: 'out-of-bag error', tone: 'warm', get: s => FO(s).oobError * 100, d: 2, suf: '%', wide: true },
        { key: 'one', label: 'one tree alone', tone: 'cold', wide: true, get: s => {
          const d = DATA[s.shape], tr = oneTree(s, 0);
          return (1 - d.y.filter((yy, i) => (treePredict(tr, d.X[i]) >= 0.5 ? 1 : 0) === yy).length / d.y.length) * 100;
        }, d: 2, suf: '%' },
      ],
      controls: [
        { type: 'slider', key: 'nTrees', label: 'number of trees', min: 1, max: 80, step: 1, fast: true },
        { type: 'slider', key: 'depth', label: 'tree depth', min: 2, max: 12, step: 1, fast: true },
        { type: 'segment', key: 'shape', label: 'data', options: [{ value: 'moons', label: 'moons' }, { value: 'rings', label: 'rings' }, { value: 'xor', label: 'xor' }] },
      ],
      beats: [
        {
          label: 'the averaged surface',
          note: 'Smooth, and much closer to the real shape than any staircase in it. That smoothness came from disagreement.',
          scene: s => {
            const f = dataFrame(s);
            const fo = FO(s);
            return [
              ...axes(f, { xLabel: 'x₁', yLabel: 'x₂' }),
              ...surface(f, (x, y) => fo.predict([x, y]), { n: 34, dur: 200, opacity: 0.6 }),
              ...boundary(f, (x, y) => fo.predict([x, y]), { n: 70, dur: 200 }),
              ...dots(s, f),
              label('l', f.x0 + 10, f.y1 + 8,
                `${s.nTrees} tree${+s.nTrees === 1 ? '' : 's'} averaged`, { cls: 'lab-big lab-gold', dur: 200 }),
            ];
          },
        },
        {
          label: 'diminishing returns',
          note: 'Error against forest size. Steep, then flat. Beyond a hundred trees you are mostly buying compute time.',
          scene: s => {
            const f = F();
            f.setX(1, 60); f.setY(0, 0.42);
            const ns = [1, 2, 3, 5, 8, 12, 18, 25, 35, 45, 60];
            const es = ns.map(n => FO({ ...s, nTrees: n }).oobError);
            return [
              ...axes(f, { xLabel: 'number of trees', yLabel: 'out-of-bag error', yN: 5 }),
              path('c', ns.map((n, i) => [f.sx(n), f.sy(es[i])]), { cls: 'curve curve-warm', dur: 260 }),
              ...ns.map((n, i) => ({
                key: `d-${i}`, tag: 'circle', cls: 'pt pt-warm', delay: i * 60, dur: 260,
                attrs: { cx: f.sx(n), cy: f.sy(es[i]), r: 4.5 },
                tip: `${n} trees → <b>${(es[i] * 100).toFixed(1)}%</b>`,
              })),
              { key: 'now', tag: 'circle', cls: 'pt pt-green', dur: 200, attrs: { cx: f.sx(Math.min(60, +s.nTrees)), cy: f.sy(FO(s).oobError), r: 8 } },
              label('l', f.midX, f.y1 + 10, 'more trees never make it worse — they just stop helping', { cls: 'lab lab-mid' }),
            ];
          },
        },
      ],
    },

    {
      title: 'make the trees disagree on purpose',
      prose: `<p>Bagging alone has a weakness. If one feature is strongly predictive, <em>every</em> tree will split on it first, and the trees end up highly correlated. Averaging correlated things barely reduces variance at all.</p>
        <p>So the forest adds a second source of randomness: at each split, each tree may only consider a <strong>random subset of the features</strong>. Sometimes the best feature isn't on the menu, and the tree is forced to find a different angle.</p>
        <p>That sounds like sabotage, and for any individual tree it is. For the ensemble it is the whole reason forests beat plain bagging.</p>`,
      formula: formula(
        t('mtry', { tone: 'gold' }) + ' features considered per split' +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') +
        'default ' + t('√p', { tone: 'green' }) + ' for classification, ' + t('p/3', { tone: 'cyan' }) + ' for regression',
        { size: 'sm', caption: 'deliberately handicapping each tree to decorrelate the ensemble' }),
      aside: `<b>Averaging correlated things does not help much.</b> The variance of a mean of B things with pairwise correlation ρ is σ²(ρ + (1−ρ)/B). As B grows, the second term vanishes but the first does not — so ρ is a floor on how good averaging can get. Cutting ρ is exactly what mtry is for.`,
      readouts: [
        { key: 'mtry', label: 'mtry', tone: 'gold', get: s => +s.mtry, d: 0 },
        { key: 'oob', label: 'out-of-bag error', tone: 'warm', get: s => FO(s).oobError * 100, d: 2, suf: '%', wide: true },
        { key: 'imp1', label: 'importance x₁', tone: 'cyan', get: s => FO(s).importance[0] * 100, d: 1, suf: '%', wide: true },
        { key: 'imp2', label: 'importance x₂', tone: 'purple', get: s => FO(s).importance[1] * 100, d: 1, suf: '%', wide: true },
      ],
      controls: [
        { type: 'segment', key: 'mtry', label: 'features per split', options: [{ value: 1, label: '1 of 2' }, { value: 2, label: 'all 2' }] },
        { type: 'slider', key: 'nTrees', label: 'number of trees', min: 5, max: 80, step: 5, fast: true },
      ],
      beats: [
        {
          label: 'importance, and where it comes from',
          note: 'Each feature\'s share of the total impurity it removed across the whole forest. Free, and roughly honest — though it inflates for features with many possible split points.',
          scene: s => {
            const fo = FO(s);
            const W = 460, x0 = 150;
            return [
              label('t', 360, 110, 'how much work each feature did', { cls: 'lab-big lab-mid' }),
              ...fo.importance.map((v, i) => [
                rect(`bg-${i}`, x0, 170 + i * 80, W, 40, { cls: 'cell' }),
                rect(`b-${i}`, x0, 170 + i * 80, W * v, 40, { cls: `sq ${i ? 'sq-y' : 'sq-x'}`, dur: 240 }),
                label(`l-${i}`, x0 - 14, 196 + i * 80, `x${i + 1}`, { cls: `lab-big lab-end lab-${i ? 'purple' : 'cyan'}` }),
                numLabel(`v-${i}`, x0 + W + 14, 196 + i * 80, v * 100, { cls: 'lab-big', d: 1, suf: '%', dur: 240 }),
              ]),
              label('n', 360, 350, `mtry = ${s.mtry} · out-of-bag error ${(fo.oobError * 100).toFixed(2)}%`,
                { cls: 'lab-big lab-mid lab-gold', dur: 240 }),
              label('n2', 360, 380,
                +s.mtry === 1 ? 'each tree sees only one feature per split — maximally decorrelated'
                  : 'every tree sees both features — the trees will look alike',
                { cls: 'lab lab-mid', dur: 240 }),
            ];
          },
        },
      ],
    },

    {
      title: 'the free validation set',
      prose: `<p>Here is the forest's nicest property, and the one people most often fail to use.</p>
        <p>Each tree is trained on a bootstrap sample, which leaves out about <strong>37%</strong> of the data by chance. (That number is 1/e, and it falls out of the same limit as the compound-interest calculation in the limits lesson.) Those left-out points are a ready-made test set for that tree.</p>
        <p>Predict each observation using only the trees that never saw it, and you get an honest error estimate <em>for free</em>, with no separate holdout and no cross-validation loop.</p>`,
      formula: formula(
        'P(a point is left out of one bootstrap) ' + eq +
        paren('1 − ' + frac('1', 'n')) + sup('', 'n') + op('&nbsp;→&nbsp;') +
        frac('1', 'e') + op('&nbsp;≈&nbsp;') + t('0.368', { tone: 'green' }),
        { caption: 'about a third of the data sits out every tree' }),
      dep: { note: 'That 1/e is the same limit as the compound-interest one.', lesson: 'limits', label: 'limits' },
      readouts: [
        { key: 'oob', label: 'out-of-bag error', tone: 'warm', get: s => FO(s).oobError * 100, d: 2, suf: '%', wide: true },
        { key: 'cov', label: 'points with OOB votes', tone: 'green', get: s => FO(s).oobCoverage * 100, d: 1, suf: '%', wide: true },
        { key: 'n', label: 'trees', tone: 'gold', get: s => +s.nTrees, d: 0 },
      ],
      controls: [
        { type: 'slider', key: 'nTrees', label: 'number of trees', min: 3, max: 80, step: 1, fast: true },
        { type: 'slider', key: 'seed', label: 'reshuffle', min: 0, max: 8, step: 1, fast: true, fmt: () => 'reroll' },
      ],
      beats: [
        {
          label: 'in the bag and out of it',
          note: 'For one tree: the filled points were drawn into its training sample, the hollow ones were not. The hollow ones score that tree.',
          scene: s => {
            const f = dataFrame(s);
            const d = DATA[s.shape];
            const r = st.rng(100 + +s.seed);
            const n = d.y.length;
            const inBag = new Set();
            for (let i = 0; i < n; i++) inBag.add(Math.floor(r() * n));
            const outN = n - inBag.size;
            return [
              ...axes(f, { xLabel: 'x₁', yLabel: 'x₂' }),
              ...d.X.map((p, i) => ({
                key: `p-${i}`, tag: 'circle', dur: 240,
                cls: inBag.has(i) ? (d.y[i] ? 'pt pt-warm' : 'pt pt-cold') : 'pt-ghost',
                attrs: { cx: f.sx(p[0]), cy: f.sy(p[1]), r: inBag.has(i) ? 4.5 : 5.5 },
                tip: inBag.has(i) ? 'used to train this tree' : 'left out — scores this tree',
              })),
              label('l', f.x0 + 10, f.y1 + 8,
                `${outN} of ${n} left out — ${((outN / n) * 100).toFixed(0)}%`, { cls: 'lab-big lab-gold', dur: 240 }),
              label('l2', f.x0 + 10, f.y1 + 28, 'the theoretical figure is 36.8%', { cls: 'lab-sm' }),
            ];
          },
        },
      ],
    },

    {
      title: 'the knobs, and what each one does',
      prose: `<p>Forests are famously forgiving — the defaults usually work, which is a large part of why they became the standard first thing to try on tabular data.</p>
        <p>Still, it's worth knowing which dial does what, and in particular which one is <em>not</em> a bias–variance trade-off. Adding trees is the only parameter here that cannot make the model worse.</p>`,
      readouts: [
        { key: 'oob', label: 'out-of-bag error', tone: 'warm', get: s => FO(s).oobError * 100, d: 2, suf: '%', wide: true },
        { key: 'n', label: 'trees', tone: 'gold', get: s => +s.nTrees, d: 0 },
        { key: 'd', label: 'depth', tone: 'cyan', get: s => +s.depth, d: 0 },
        { key: 'ml', label: 'min leaf', tone: 'green', get: s => +s.minLeaf, d: 0 },
      ],
      controls: [
        { type: 'slider', key: 'nTrees', label: 'n_estimators', min: 1, max: 80, step: 1, fast: true },
        { type: 'slider', key: 'depth', label: 'max_depth', min: 1, max: 14, step: 1, fast: true },
        { type: 'slider', key: 'minLeaf', label: 'min_samples_leaf', min: 1, max: 25, step: 1, fast: true },
        { type: 'segment', key: 'mtry', label: 'max_features', options: [{ value: 1, label: '1' }, { value: 2, label: '2 (all)' }] },
      ],
      beats: [
        {
          label: 'the parameter reference',
          note: 'Note the first row: it is the only one whose "too high" is just wasted electricity.',
          scene: s => knobCards([
            {
              name: 'n_estimators', value: s.nTrees, tone: 'gold',
              does: 'How many trees to average. More trees only ever reduce variance — this is the one knob that cannot overfit.',
              low: 'you get one unstable tree back',
              high: 'nothing bad, just slower',
            },
            {
              name: 'max_features (mtry)', value: s.mtry, tone: 'green',
              does: 'How many features each split may consider. Lower means the trees are forced to disagree, which is what makes averaging pay.',
              low: 'trees are weak but nicely decorrelated',
              high: 'trees become near-identical; bagging stalls',
            },
            {
              name: 'max_depth', value: s.depth, tone: 'cyan',
              does: 'How deep each tree may grow. Forests usually want deep, low-bias trees — the averaging is what handles the variance.',
              low: 'every tree underfits, and averaging cannot fix bias',
              high: 'fine here, unlike for a single tree',
            },
            {
              name: 'min_samples_leaf', value: s.minLeaf, tone: 'purple',
              does: 'Smallest allowed leaf. The main brake if your data is noisy and deep trees are chasing it.',
              low: 'individual trees memorise, though the average survives',
              high: 'the whole forest goes blurry',
            },
          ]),
        },
      ],
    },
  ],
};
