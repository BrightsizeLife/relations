/* ─────────────────────────────────────────────────────────────────────────────
   cluster.js — finding groups nobody labelled.

   Three algorithms that answer "which of these belong together", and disagree
   with each other for reasons you can see rather than reasons you have to take
   on trust. All of them run in the browser and all of them expose their
   intermediate states, because the intermediate states are the lesson.
   ───────────────────────────────────────────────────────────────────────────── */

import { rng, mean, sum } from './stats.js';

export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

/* ── k-means ──────────────────────────────────────────────────────────────── */

/**
 * Lloyd's algorithm, recorded frame by frame.
 *
 * Every iteration is two moves: assign each point to its nearest centre, then
 * move each centre to the mean of what it just claimed. `history` holds both
 * halves separately so a lesson can animate them one at a time.
 */
export function kmeans(X, k, { seed = 1, maxIter = 40, init = null } = {}) {
  const r = rng(seed);
  const n = X.length;

  /* k-means++ seeding: spread the initial centres out, which is what every
     real implementation does and what makes the "bad start" step honest */
  let centres = init ? init.map(c => c.slice()) : (() => {
    const c = [X[Math.floor(r() * n)].slice()];
    while (c.length < k) {
      const d = X.map(p => Math.min(...c.map(q => dist2(p, q))));
      const tot = sum(d);
      let t = r() * tot, i = 0;
      while (i < n - 1 && (t -= d[i]) > 0) i++;
      c.push(X[i].slice());
    }
    return c;
  })();

  const assign = cs => X.map(p => {
    let bi = 0, bd = Infinity;
    cs.forEach((c, j) => { const d = dist2(p, c); if (d < bd) { bd = d; bi = j; } });
    return bi;
  });

  const move = lab => centres.map((c, j) => {
    const pts = X.filter((_, i) => lab[i] === j);
    return pts.length ? [mean(pts.map(p => p[0])), mean(pts.map(p => p[1]))] : c.slice();
  });

  const history = [{ centres: centres.map(c => c.slice()), labels: null, moved: Infinity }];
  let labels = assign(centres);
  history.push({ centres: centres.map(c => c.slice()), labels: labels.slice(), moved: Infinity });

  for (let it = 0; it < maxIter; it++) {
    const next = move(labels);
    const moved = Math.max(...next.map((c, j) => dist(c, centres[j])));
    centres = next;
    labels = assign(centres);
    history.push({ centres: centres.map(c => c.slice()), labels: labels.slice(), moved });
    if (moved < 1e-9) break;
  }

  return { centres, labels, history, wss: wss(X, labels, centres), iters: history.length - 2 };
}

/** total within-cluster sum of squares — what k-means is actually minimising */
export function wss(X, labels, centres) {
  return sum(X.map((p, i) => dist2(p, centres[labels[i]])));
}

/**
 * Silhouette: for each point, how much closer it is to its own cluster than to
 * the nearest other one, scaled to [−1, 1]. Unlike WSS it does not improve
 * automatically as k grows, so it can actually choose a k.
 */
export function silhouette(X, labels) {
  const ks = [...new Set(labels)];
  if (ks.length < 2) return 0;
  const byK = new Map(ks.map(k => [k, X.filter((_, i) => labels[i] === k)]));
  const s = X.map((p, i) => {
    const own = byK.get(labels[i]);
    if (own.length <= 1) return 0;
    const a = sum(own.map(q => dist(p, q))) / (own.length - 1);
    const b = Math.min(...ks.filter(k => k !== labels[i])
      .map(k => mean(byK.get(k).map(q => dist(p, q)))));
    return (b - a) / Math.max(a, b);
  });
  return mean(s);
}

/* ── hierarchical ─────────────────────────────────────────────────────────── */

const LINK = {
  single: ds => Math.min(...ds),
  complete: ds => Math.max(...ds),
  average: ds => mean(ds),
};

/**
 * Agglomerative clustering: start with every point alone, repeatedly merge the
 * two closest groups. Returns the merge sequence, which is the dendrogram.
 *
 * `linkage` decides what "closest" means between two groups — and it is not a
 * detail: single linkage chains along thin filaments, complete linkage insists
 * on compact balls, and they can produce completely different trees from the
 * same points.
 */
export function hclust(X, { linkage = 'average' } = {}) {
  const L = LINK[linkage] || LINK.average;
  const n = X.length;
  let groups = X.map((_, i) => ({ id: i, members: [i], height: 0, size: 1 }));
  const merges = [];
  let nextId = n;

  const between = (a, b) => L(a.members.flatMap(i => b.members.map(j => dist(X[i], X[j]))));

  while (groups.length > 1) {
    let bi = 0, bj = 1, bd = Infinity;
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const d = between(groups[i], groups[j]);
        if (d < bd) { bd = d; bi = i; bj = j; }
      }
    }
    const a = groups[bi], b = groups[bj];
    const node = {
      id: nextId++, left: a, right: b, height: bd,
      members: [...a.members, ...b.members], size: a.size + b.size,
    };
    merges.push({ a: a.id, b: b.id, height: bd, id: node.id, size: node.size });
    groups = groups.filter((_, i) => i !== bi && i !== bj);
    groups.push(node);
  }
  return { root: groups[0], merges, linkage };
}

/** slice the tree so that exactly k groups remain, and label every point */
export function cutTree(tree, k, n) {
  const labels = new Array(n).fill(0);
  let front = [tree.root];
  while (front.length < k) {
    /* always split whichever remaining group was merged last — that is what
       cutting the dendrogram at a horizontal line does */
    let hi = 0;
    front.forEach((g, i) => { if ((g.height ?? 0) > (front[hi].height ?? 0)) hi = i; });
    const g = front[hi];
    if (!g.left) break;
    front = front.filter((_, i) => i !== hi).concat([g.left, g.right]);
  }
  front.forEach((g, j) => g.members.forEach(i => { labels[i] = j; }));
  return labels;
}

/* ── dbscan ───────────────────────────────────────────────────────────────── */

/**
 * Density-based clustering. A point is a *core* point if at least `minPts`
 * points lie within `eps` of it; clusters are the connected runs of core
 * points plus whatever sits on their edges; everything else is noise.
 *
 * Returns labels where −1 means noise, and the core/border classification, so
 * a lesson can draw the eps-balls and show why a point qualified.
 */
export function dbscan(X, { eps = 0.5, minPts = 4 } = {}) {
  const n = X.length;
  const nbrs = X.map(p => X.map((q, j) => j).filter(j => dist(p, X[j]) <= eps));
  const core = nbrs.map(v => v.length >= minPts);
  const labels = new Array(n).fill(-1);
  let c = 0;

  for (let i = 0; i < n; i++) {
    if (!core[i] || labels[i] !== -1) continue;
    const stack = [i];
    labels[i] = c;
    while (stack.length) {
      const j = stack.pop();
      for (const m of nbrs[j]) {
        if (labels[m] === -1) {
          labels[m] = c;
          if (core[m]) stack.push(m);
        }
      }
    }
    c++;
  }
  return { labels, core, nbrs, k: c, noise: labels.filter(v => v === -1).length };
}

/* ── datasets ─────────────────────────────────────────────────────────────── */

/**
 * Shapes chosen so that each algorithm visibly succeeds on some and fails on
 * others. `blobs` is what k-means assumes the world looks like; `moons` and
 * `rings` are what it actually looks like; `uneven` is the case where one
 * cluster is far bigger than the other and centroids get dragged.
 */
export function clusterData({ shape = 'blobs', n = 120, seed = 5 } = {}) {
  const r = rng(seed);
  const nrm = (mu, sd) => {
    let u = 0, v = 0;
    while (u === 0) u = r();
    while (v === 0) v = r();
    return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const P = [];
  if (shape === 'blobs') {
    const cs = [[-1.5, 1.1], [1.6, 1.3], [0.1, -1.5]];
    for (let i = 0; i < n; i++) { const c = cs[i % 3]; P.push([nrm(c[0], 0.45), nrm(c[1], 0.45)]); }
  } else if (shape === 'uneven') {
    for (let i = 0; i < n; i++) {
      if (i % 6 === 0) P.push([nrm(2.1, 0.28), nrm(-1.2, 0.28)]);
      else P.push([nrm(-0.7, 0.95), nrm(0.5, 0.95)]);
    }
  } else if (shape === 'moons') {
    /* the gap is deliberate: wide enough that a density method can find it and
       narrow enough that the two crescents still interleave, which is what
       makes centroids useless here */
    for (let i = 0; i < n; i++) {
      const cls = i % 2, t = Math.PI * r();
      const cx = cls ? 0.5 - Math.cos(t) : Math.cos(t) - 0.5;
      const cy = cls ? 0.45 - Math.sin(t) : Math.sin(t);
      P.push([cx * 1.5 + nrm(0, 0.1), cy * 1.5 + nrm(0, 0.1)]);
    }
  } else if (shape === 'rings') {
    for (let i = 0; i < n; i++) {
      const rad = i % 2 ? 2.2 : 0.6, th = 2 * Math.PI * r();
      P.push([rad * Math.cos(th) + nrm(0, 0.14), rad * Math.sin(th) + nrm(0, 0.14)]);
    }
  } else { /* 'none' — one uniform smear, so the reader can see an algorithm
              confidently invent groups that are not there */
    for (let i = 0; i < n; i++) P.push([r() * 4.4 - 2.2, r() * 3.6 - 1.8]);
  }
  return P;
}
