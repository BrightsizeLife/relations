/* ─────────────────────────────────────────────────────────────────────────────
   dag.js — causal diagrams, and simulating from them.

   A DAG here is a list of nodes with positions and a list of arrows. Two
   things are done with it: it is drawn, and it is *run* — every node is
   generated as a linear combination of its parents plus noise, so a lesson can
   show what the data from a stated set of assumptions actually looks like.

   The path logic (is this path blocked, given what I have adjusted for?) is the
   d-separation rule, implemented literally rather than cleverly, because the
   point is to be able to read it.
   ───────────────────────────────────────────────────────────────────────────── */

import { rng, randNorm, sum } from './stats.js';

/**
 * @param nodes {id, x, y, label, latent?}
 * @param edges {from, to, w}  — w is the linear coefficient used when simulating
 */
export function dag(nodes, edges) {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const parents = id => edges.filter(e => e.to === id).map(e => e.from);
  const children = id => edges.filter(e => e.from === id).map(e => e.to);
  const has = (a, b) => edges.some(e => e.from === a && e.to === b);

  /** topological order, so a node is always generated after its parents */
  const order = (() => {
    const done = [], seen = new Set();
    const visit = id => {
      if (seen.has(id)) return;
      seen.add(id);
      parents(id).forEach(visit);
      done.push(id);
    };
    nodes.forEach(n => visit(n.id));
    return done;
  })();

  return {
    nodes, edges, byId, parents, children, has, order,
    /** every undirected path between two nodes, as a list of node ids */
    paths: (a, b) => allPaths(nodes, edges, a, b),
    /** simulate n rows */
    simulate: (n, { seed = 1, noise = 1 } = {}) => simulate(nodes, edges, order, parents, n, seed, noise),
  };
}

function allPaths(nodes, edges, a, b) {
  const adj = {};
  nodes.forEach(n => { adj[n.id] = []; });
  edges.forEach(e => { adj[e.from].push(e.to); adj[e.to].push(e.from); });
  const out = [];
  const walk = (cur, seen) => {
    if (cur === b) { out.push([...seen]); return; }
    for (const nx of adj[cur]) {
      if (seen.includes(nx)) continue;
      walk(nx, [...seen, nx]);
    }
  };
  walk(a, [a]);
  return out;
}

/**
 * Is this path blocked, given the adjustment set?
 *
 * Walk the interior nodes. A non-collider blocks when it is adjusted for; a
 * collider blocks when it is *not* adjusted for (or has no adjusted
 * descendant). Those two sentences are the whole of d-separation.
 */
export function pathBlocked(d, path, given = []) {
  const G = new Set(given);
  const descendantAdjusted = id => {
    const stack = [...d.children(id)];
    while (stack.length) {
      const k = stack.pop();
      if (G.has(k)) return true;
      stack.push(...d.children(k));
    }
    return false;
  };
  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1], cur = path[i], next = path[i + 1];
    const isCollider = d.has(prev, cur) && d.has(next, cur);
    if (isCollider) {
      if (!G.has(cur) && !descendantAdjusted(cur)) return { blocked: true, at: cur, why: 'collider, not adjusted' };
    } else if (G.has(cur)) {
      return { blocked: true, at: cur, why: 'adjusted for' };
    }
  }
  return { blocked: false };
}

/** what kind of junction is this interior node on this path? */
export function junction(d, path, i) {
  const prev = path[i - 1], cur = path[i], next = path[i + 1];
  if (d.has(prev, cur) && d.has(next, cur)) return 'collider';
  if (d.has(cur, prev) && d.has(cur, next)) return 'fork';
  return 'chain';
}

/** a path is a backdoor from x if its first arrow points *into* x */
export const isBackdoor = (d, path, x) => path.length > 1 && d.has(path[1], x);

/**
 * Does this adjustment set satisfy the backdoor criterion for x → y?
 * Every backdoor path blocked, and nothing in the set is a descendant of x.
 */
export function backdoorOK(d, x, y, given = []) {
  const desc = new Set();
  const stack = [...d.children(x)];
  while (stack.length) { const k = stack.pop(); if (!desc.has(k)) { desc.add(k); stack.push(...d.children(k)); } }
  const bad = given.filter(g => desc.has(g));
  const open = d.paths(x, y)
    .filter(p => isBackdoor(d, p, x))
    .filter(p => !pathBlocked(d, p, given).blocked);
  return { ok: bad.length === 0 && open.length === 0, descendantsUsed: bad, openBackdoors: open };
}

function simulate(nodes, edges, order, parents, n, seed, noise) {
  const r = rng(seed);
  const cols = {};
  nodes.forEach(nd => { cols[nd.id] = new Array(n).fill(0); });
  for (const id of order) {
    const ps = edges.filter(e => e.to === id);
    for (let i = 0; i < n; i++) {
      cols[id][i] = sum(ps.map(e => (e.w ?? 1) * cols[e.from][i])) + randNorm(r, 0, noise);
    }
  }
  return cols;
}

/* ── the three shapes, and the classic diagrams ───────────────────────────── */

export const SHAPES = {
  chain: {
    label: 'chain', story: 'X causes M causes Y',
    d: dag(
      [{ id: 'X', x: 0, y: 0 }, { id: 'M', x: 1, y: 0 }, { id: 'Y', x: 2, y: 0 }],
      [{ from: 'X', to: 'M', w: 1 }, { from: 'M', to: 'Y', w: 1 }]),
    middle: 'M', adjustEffect: 'destroys a real association',
  },
  fork: {
    label: 'fork', story: 'C causes both X and Y',
    d: dag(
      [{ id: 'X', x: 0, y: 0.7 }, { id: 'C', x: 1, y: -0.5 }, { id: 'Y', x: 2, y: 0.7 }],
      [{ from: 'C', to: 'X', w: 1 }, { from: 'C', to: 'Y', w: 1 }]),
    middle: 'C', adjustEffect: 'removes a spurious association',
  },
  collider: {
    label: 'collider', story: 'X and Y both cause C',
    d: dag(
      [{ id: 'X', x: 0, y: -0.5 }, { id: 'C', x: 1, y: 0.7 }, { id: 'Y', x: 2, y: -0.5 }],
      [{ from: 'X', to: 'C', w: 1 }, { from: 'Y', to: 'C', w: 1 }]),
    middle: 'C', adjustEffect: 'creates an association that was not there',
  },
};
