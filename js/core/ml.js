/* ─────────────────────────────────────────────────────────────────────────────
   ml.js — a decision tree, a random forest and a one-hidden-layer network,
   written small enough to read. Everything here is trained in the browser so
   the lessons can show a parameter moving and the model responding.
   ───────────────────────────────────────────────────────────────────────────── */

import { rng, randNorm, sum, mean } from './stats.js';

/* ── impurity ─────────────────────────────────────────────────────────────── */

export const gini = p => 2 * p * (1 - p);
export const entropyBin = p =>
  p <= 0 || p >= 1 ? 0 : -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));

const IMP = { gini, entropy: entropyBin };

/* ── decision tree ────────────────────────────────────────────────────────── */

/**
 * Grow a binary classification tree by greedy splitting.
 *
 * @param X        array of feature vectors
 * @param y        array of 0/1 labels
 * @param maxDepth how many questions deep the tree may go
 * @param minLeaf  refuse to create a leaf smaller than this
 * @param minGain  refuse a split that improves impurity by less than this
 * @param mtry     how many features to consider per split (null = all)
 */
export function growTree(X, y, {
  maxDepth = 4, minLeaf = 5, minGain = 0, criterion = 'gini', mtry = null, rand = Math.random,
} = {}) {
  const imp = IMP[criterion] || gini;
  const nFeat = X[0].length;
  let nodeCount = 0;

  function build(idx, depth) {
    const n = idx.length;
    const p = n ? sum(idx.map(i => y[i])) / n : 0.5;
    const node = { n, p, depth, impurity: imp(p), id: nodeCount++ };

    if (depth >= maxDepth || n < 2 * minLeaf || p === 0 || p === 1) {
      node.leaf = true;
      return node;
    }

    // which features are we allowed to look at in this node?
    let feats = [...Array(nFeat).keys()];
    if (mtry && mtry < nFeat) {
      feats = feats.sort(() => rand() - 0.5).slice(0, mtry);
    }

    let best = null;
    for (const f of feats) {
      const vals = [...new Set(idx.map(i => X[i][f]))].sort((a, b) => a - b);
      if (vals.length < 2) continue;
      // cap candidate thresholds so a big dataset stays interactive
      const step = Math.max(1, Math.floor(vals.length / 24));
      for (let k = step; k < vals.length; k += step) {
        const thresh = (vals[k - 1] + vals[k]) / 2;
        const L = [], R = [];
        for (const i of idx) (X[i][f] <= thresh ? L : R).push(i);
        if (L.length < minLeaf || R.length < minLeaf) continue;
        const pL = sum(L.map(i => y[i])) / L.length;
        const pR = sum(R.map(i => y[i])) / R.length;
        const after = (L.length * imp(pL) + R.length * imp(pR)) / n;
        const gain = node.impurity - after;
        if (!best || gain > best.gain) best = { gain, f, thresh, L, R, pL, pR };
      }
    }

    if (!best || best.gain <= minGain) { node.leaf = true; return node; }

    node.leaf = false;
    node.feat = best.f;
    node.thresh = best.thresh;
    node.gain = best.gain;
    node.left = build(best.L, depth + 1);
    node.right = build(best.R, depth + 1);
    return node;
  }

  const tree = build([...Array(y.length).keys()], 0);
  tree.nNodes = nodeCount;
  tree.criterion = criterion;
  return tree;
}

export function treePredict(node, x) {
  while (!node.leaf) node = x[node.feat] <= node.thresh ? node.left : node.right;
  return node.p;
}

export function treeLeaves(node, acc = []) {
  if (node.leaf) { acc.push(node); return acc; }
  treeLeaves(node.left, acc);
  treeLeaves(node.right, acc);
  return acc;
}

export function treeDepth(node) {
  return node.leaf ? node.depth : Math.max(treeDepth(node.left), treeDepth(node.right));
}

/**
 * Walk the tree collecting the axis-aligned box each leaf owns, so a lesson can
 * draw the partition of the feature space directly.
 */
export function treeRegions(node, box, out = []) {
  if (node.leaf) { out.push({ box: [...box], p: node.p, n: node.n, node }); return out; }
  const L = [...box], R = [...box];
  // box is [x0, x1, y0, y1]; feature 0 splits x, feature 1 splits y
  if (node.feat === 0) { L[1] = node.thresh; R[0] = node.thresh; }
  else { L[3] = node.thresh; R[2] = node.thresh; }
  treeRegions(node.left, L, out);
  treeRegions(node.right, R, out);
  return out;
}

/* ── random forest ────────────────────────────────────────────────────────── */

/**
 * Bagging plus per-split feature subsampling. Returns the trees, the ensemble
 * predictor, and the out-of-bag error — which is the forest's built-in
 * cross-validation and the reason you rarely need a separate holdout.
 */
export function growForest(X, y, {
  nTrees = 30, maxDepth = 6, minLeaf = 2, mtry = null, criterion = 'gini', seed = 12,
} = {}) {
  const r = rng(seed);
  const n = y.length;
  const trees = [];
  const oobVotes = Array.from({ length: n }, () => []);

  for (let t = 0; t < nTrees; t++) {
    const idx = [], inBag = new Set();
    for (let i = 0; i < n; i++) { const j = Math.floor(r() * n); idx.push(j); inBag.add(j); }
    const bX = idx.map(i => X[i]), bY = idx.map(i => y[i]);
    const tree = growTree(bX, bY, { maxDepth, minLeaf, criterion, mtry, rand: r });
    trees.push(tree);
    for (let i = 0; i < n; i++) if (!inBag.has(i)) oobVotes[i].push(treePredict(tree, X[i]));
  }

  const predict = x => mean(trees.map(t => treePredict(t, x)));

  let oobErr = 0, oobN = 0;
  oobVotes.forEach((v, i) => {
    if (!v.length) return;
    oobN++;
    if ((mean(v) >= 0.5 ? 1 : 0) !== y[i]) oobErr++;
  });

  return {
    trees, predict, nTrees,
    oobError: oobN ? oobErr / oobN : NaN,
    oobCoverage: oobN / n,
    /** how much each feature reduced impurity across the whole forest */
    importance: featureImportance(trees, X[0].length),
  };
}

function featureImportance(trees, nFeat) {
  const imp = new Array(nFeat).fill(0);
  const walk = node => {
    if (node.leaf) return;
    imp[node.feat] += node.gain * node.n;
    walk(node.left); walk(node.right);
  };
  trees.forEach(walk);
  const tot = sum(imp) || 1;
  return imp.map(v => v / tot);
}

/* ── one-hidden-layer neural network ──────────────────────────────────────── */

const ACT = {
  tanh: { f: x => Math.tanh(x), d: y => 1 - y * y, label: 'tanh' },
  relu: { f: x => Math.max(0, x), d: y => (y > 0 ? 1 : 0), label: 'relu' },
  logistic: { f: x => 1 / (1 + Math.exp(-x)), d: y => y * (1 - y), label: 'logistic' },
};

/**
 * 2 inputs → H hidden units → 1 logistic output, trained by full-batch
 * gradient descent on cross-entropy. Deliberately the smallest thing that is
 * still recognisably a neural network.
 */
export function trainNet(X, y, {
  hidden = 4, lr = 0.5, epochs = 400, act = 'tanh', seed = 3, l2 = 0, snapshots = 24,
} = {}) {
  const A = ACT[act] || ACT.tanh;
  const r = rng(seed);
  const nIn = X[0].length, n = y.length;

  // small random weights — symmetry has to be broken or every unit learns the same thing
  let W1 = Array.from({ length: hidden }, () => Array.from({ length: nIn }, () => randNorm(r, 0, 0.8)));
  let b1 = Array.from({ length: hidden }, () => 0);
  let W2 = Array.from({ length: hidden }, () => randNorm(r, 0, 0.8));
  let b2 = 0;

  const forward = x => {
    const h = W1.map((w, j) => A.f(w[0] * x[0] + w[1] * x[1] + b1[j]));
    const z = sum(h.map((v, j) => v * W2[j])) + b2;
    return { h, p: 1 / (1 + Math.exp(-z)) };
  };

  const loss = () => {
    let L = 0;
    for (let i = 0; i < n; i++) {
      const { p } = forward(X[i]);
      L -= y[i] * Math.log(Math.max(p, 1e-12)) + (1 - y[i]) * Math.log(Math.max(1 - p, 1e-12));
    }
    return L / n;
  };

  const history = [];
  const snapEvery = Math.max(1, Math.floor(epochs / snapshots));

  for (let ep = 0; ep <= epochs; ep++) {
    if (ep % snapEvery === 0 || ep === epochs) {
      history.push({
        epoch: ep, loss: loss(),
        W1: W1.map(w => [...w]), b1: [...b1], W2: [...W2], b2,
      });
    }
    if (ep === epochs) break;

    const gW1 = W1.map(() => [0, 0]), gb1 = W1.map(() => 0);
    const gW2 = W2.map(() => 0);
    let gb2 = 0;

    for (let i = 0; i < n; i++) {
      const { h, p } = forward(X[i]);
      const dz = p - y[i];                       // dLoss/dz for cross-entropy + logistic
      gb2 += dz;
      for (let j = 0; j < hidden; j++) {
        gW2[j] += dz * h[j];
        const dh = dz * W2[j] * A.d(h[j]);       // the chain rule, one link at a time
        gW1[j][0] += dh * X[i][0];
        gW1[j][1] += dh * X[i][1];
        gb1[j] += dh;
      }
    }

    for (let j = 0; j < hidden; j++) {
      W2[j] -= lr * (gW2[j] / n + l2 * W2[j]);
      b1[j] -= lr * (gb1[j] / n);
      W1[j][0] -= lr * (gW1[j][0] / n + l2 * W1[j][0]);
      W1[j][1] -= lr * (gW1[j][1] / n + l2 * W1[j][1]);
    }
    b2 -= lr * (gb2 / n);
  }

  const at = k => {
    const s = history[Math.min(k, history.length - 1)];
    const f = x => {
      const h = s.W1.map((w, j) => A.f(w[0] * x[0] + w[1] * x[1] + s.b1[j]));
      const z = sum(h.map((v, j) => v * s.W2[j])) + s.b2;
      return 1 / (1 + Math.exp(-z));
    };
    f.snapshot = s;
    return f;
  };

  return {
    history, at, hidden, act: A.label,
    predict: at(history.length - 1),
    finalLoss: history.at(-1).loss,
    nParams: hidden * nIn + hidden + hidden + 1,
    accuracy: (() => {
      const f = at(history.length - 1);
      let c = 0;
      for (let i = 0; i < n; i++) if ((f(X[i]) >= 0.5 ? 1 : 0) === y[i]) c++;
      return c / n;
    })(),
  };
}

/* ── shared toy dataset ───────────────────────────────────────────────────── */

/**
 * A 2-D classification problem with a known curved boundary, so a lesson can
 * show whether a model is recovering real structure or memorising noise.
 * Simulated on purpose: the truth has to be knowable.
 */
export function twoClass({ n = 220, noise = 0.18, shape = 'moons', seed = 42 } = {}) {
  const r = rng(seed);
  const X = [], y = [];
  for (let i = 0; i < n; i++) {
    if (shape === 'moons') {
      const cls = i % 2;
      const t = Math.PI * r();
      const cx = cls ? 1 - Math.cos(t) - 0.5 : Math.cos(t) - 0.5;
      const cy = cls ? 1 - Math.sin(t) - 0.4 : Math.sin(t) - 0.1;
      X.push([cx * 1.6 + randNorm(r, 0, noise), cy * 1.6 + randNorm(r, 0, noise)]);
      y.push(cls);
    } else if (shape === 'rings') {
      const cls = i % 2;
      const rad = cls ? 1.9 : 0.75;
      const th = 2 * Math.PI * r();
      X.push([rad * Math.cos(th) + randNorm(r, 0, noise * 1.6), rad * Math.sin(th) + randNorm(r, 0, noise * 1.6)]);
      y.push(cls);
    } else if (shape === 'xor') {
      const a = randNorm(r, 0, 0.85), b = randNorm(r, 0, 0.85);
      X.push([a, b]);
      y.push((a > 0) === (b > 0) ? 1 : 0);
    } else { // 'linear'
      const a = randNorm(r, 0, 1), b = randNorm(r, 0, 1);
      X.push([a, b]);
      y.push(a + b + randNorm(r, 0, noise * 3) > 0 ? 1 : 0);
    }
  }
  return { X, y, shape };
}
