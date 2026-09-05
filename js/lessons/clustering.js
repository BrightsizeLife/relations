/* ─────────────────────────────────────────────────────────────────────────────
   clustering.js — finding groups nobody labelled.

   Every other lesson on this site is handed a y: a thing to predict, a group
   to compare, a label to separate. This one is not. The whole difficulty is
   that "the right answer" is not defined, and three reasonable algorithms will
   confidently hand you three different ones.

   The lesson is built so that every disagreement between them is visible
   rather than asserted.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { kmeans, wss, silhouette, hclust, cutTree, dbscan, clusterData, dist } from '../core/cluster.js';
import { frame, axes, points, label, numLabel, path, rect, fnPath, arrowDefs } from '../core/plot.js';
import { knobCards } from '../core/knobs.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sqrt, sub, sup, sumOver, paren, eq, minus, plus, times, op } from '../core/fx.js';

const PAL = ['var(--cs-cyan)', 'var(--cs-data-warm)', 'var(--cs-lime)',
  'var(--cs-purple)', 'var(--cs-data-gold)', 'var(--cs-data-cold)'];
const col = k => (k < 0 ? 'var(--cs-dim)' : PAL[k % PAL.length]);

const SHAPES = ['blobs', 'uneven', 'moons', 'rings', 'none'];
const DATA = Object.fromEntries(SHAPES.map(sh => [sh, clusterData({ shape: sh, n: 120, seed: 3 })]));
const X = s => DATA[s.shape] || DATA.blobs;

/* the hierarchical steps use a smaller sample, because a tree with 120 leaves
   is not a picture of anything */
const SMALL = Object.fromEntries(SHAPES.map(sh => [sh, clusterData({ shape: sh, n: 24, seed: 3 })]));
const XS = s => SMALL[s.shape] || SMALL.blobs;

const kmCache = new Map();
const KM = (s, k = +s.k, seed = +s.seed) => {
  const key = `${s.shape}|${k}|${seed}`;
  if (!kmCache.has(key)) kmCache.set(key, kmeans(X(s), k, { seed: seed + 1 }));
  return kmCache.get(key);
};
const hcCache = new Map();
const HC = s => {
  const key = `${s.shape}|${s.link}`;
  if (!hcCache.has(key)) hcCache.set(key, hclust(XS(s), { linkage: s.link }));
  return hcCache.get(key);
};
const dbCache = new Map();
const DB = s => {
  const key = `${s.shape}|${s.eps}|${s.minPts}`;
  if (!dbCache.has(key)) dbCache.set(key, dbscan(X(s), { eps: +s.eps, minPts: +s.minPts }));
  return dbCache.get(key);
};

function F(s, { r = 250, t = 44, b = 62, small = false } = {}) {
  const f = frame({ w: 720, h: 540, l: 58, r, t, b });
  const P = small ? XS(s) : X(s);
  f.fit(P.map(p => p[0]), P.map(p => p[1]), 0.12);
  return f;
}

const dots = (s, f, labels, o = {}) => (o.pts || X(s)).map((p, i) => ({
  key: `p-${i}`, tag: 'circle', dur: o.dur ?? 260,
  cls: 'pt',
  attrs: { cx: f.sx(p[0]), cy: f.sy(p[1]), r: o.r ?? 5 },
  set: { fill: labels ? col(labels[i]) : 'var(--cs-muted)', stroke: 'none' },
  opacity: o.opacity ? o.opacity(i) : 1,
  tip: o.tip ? o.tip(p, i) : `(${p[0].toFixed(2)}, ${p[1].toFixed(2)})`
    + (labels ? `<br>group ${labels[i] < 0 ? 'noise' : labels[i] + 1}` : ''),
}));

/* ── the dendrogram ───────────────────────────────────────────────────────── */

function layout(root) {
  const pos = new Map();
  let nextX = 0;
  (function place(node) {
    if (!node.left) { const p = { x: nextX++, y: 0, node }; pos.set(node.id, p); return p; }
    const a = place(node.left), b = place(node.right);
    const p = { x: (a.x + b.x) / 2, y: node.height, a, b, node };
    pos.set(node.id, p);
    return p;
  })(root);
  return pos;
}

export default {
  meta: {
    id: 'clustering', title: 'finding groups in data', short: 'clustering',
    kicker: 'NOBODY LABELLED THESE', status: 'live',
    deck: 'Every other lesson here is handed something to predict. This one is handed a pile of points and asked which of them belong together — a question with no right answer, three popular algorithms, and three different opinions.',
    dataNote: 'Simulated shapes, chosen so each algorithm visibly succeeds on some and fails on others. The last one has no groups in it at all, and every method will still find you some.',
    deps: ['correlation', 'measurement'], unlocks: [],
    next: 'decisiontree', nextLabel: 'decision trees',
    outro: 'three algorithms, three answers, and no y to check them against. clustering is a hypothesis-generating exercise wearing the clothes of a result.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: {
    shape: 'blobs', k: 3, seed: 0, iter: 40, link: 'single',
    eps: 0.35, minPts: 4, cutK: 3, ax: -1.2, ay: 0.9,
  },

  steps: [

    /* ── 1 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'two dots and a ruler',
      prose: `<p>Before any algorithm, one quantity. How far apart are two points?</p>
        <p>Go across, go up, and the straight-line distance is the hypotenuse — the same right triangle you used to add variances together, doing a much more obvious job.</p>
        <p>Drag the blue dot. Every method in this lesson is a different opinion about what to do with a table of these numbers, so it is worth being sure this one is boring first.</p>`,
      formula: formula(
        'd' + paren('a, b') + eq + sqrt(paren(sub('a', '1') + minus + sub('b', '1')) + sup('', '2') + plus + paren(sub('a', '2') + minus + sub('b', '2')) + sup('', '2')) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('Pythagoras, and nothing else', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'the only formula in this lesson that is not a matter of taste' }),
      controls: [
        { type: 'slider', key: 'ax', label: 'move it across', min: -2.2, max: 2.2, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'slider', key: 'ay', label: 'move it up', min: -1.8, max: 1.8, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
      ],
      readouts: [
        { key: 'dx', label: 'across', tone: 'cyan', get: s => Math.abs(+s.ax - 1.2), d: 2 },
        { key: 'dy', label: 'up', tone: 'purple', get: s => Math.abs(+s.ay + 0.7), d: 2 },
        { key: 'd', label: 'distance', tone: 'green', get: s => Math.hypot(+s.ax - 1.2, +s.ay + 0.7), d: 3, wide: true },
      ],
      beats: [
        { label: 'two points', hold: 1200, note: 'That is all. Two positions.', scene: s => ruler(s, 1) },
        { label: 'across and up', hold: 1400, note: 'The two differences, taken separately.', scene: s => ruler(s, 2) },
        { label: 'the hypotenuse', note: 'Square them, add them, take the root. Drag either slider and watch all three numbers move together.', scene: s => ruler(s, 3) },
      ],
    },

    /* ── 2 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'a hundred and twenty points, and no labels',
      prose: `<p>Here is the situation. A pile of points, two measurements each, and nothing telling you which is which.</p>
        <p>That is genuinely different from everything else on this site. In a t-test you were handed the groups. In regression you were handed the outcome. Here there is no <em>y</em> at all — which means there is also nothing to check your answer against.</p>
        <p><strong>You</strong> can see three clumps. The question is what a procedure sees, and whether it would still see three when you cannot.</p>`,
      controls: [
        { type: 'segment', key: 'shape', label: 'data', options: [
          { value: 'blobs', label: 'blobs' }, { value: 'uneven', label: 'uneven' },
          { value: 'moons', label: 'moons' }, { value: 'rings', label: 'rings' },
          { value: 'none', label: 'no groups' },
        ] },
      ],
      beats: [
        { label: 'the axes', hold: 1000, note: 'Two measurements per point.', scene: s => plain(s, 0) },
        { label: 'the points', hold: 1500, note: 'All one colour, because nothing has told you otherwise.', scene: s => plain(s, 1) },
        { label: 'try the others', note: 'Switch the data. On <b>no groups</b> the points are uniform noise — worth remembering when an algorithm hands you clusters from it in three steps’ time.', scene: s => plain(s, 1) },
      ],
    },

    /* ── 3 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'k-means: guess, assign, move, repeat',
      prose: `<p>The oldest idea, and still the one people reach for. Decide in advance how many groups there are — call it <em>k</em> — and put down that many centres anywhere.</p>
        <p>Then two moves, alternating forever:</p>
        <p><strong>Assign.</strong> Give every point to its nearest centre. <strong>Move.</strong> Slide every centre to the mean of the points that just chose it.</p>
        <p>That is the entire algorithm. Drag <strong>iteration</strong> and watch the centres walk into place. Nothing is deciding anything clever — each move just makes the current arrangement slightly less wrong.</p>`,
      formula: formula(
        t('assign', { tone: 'cyan' }) + op(':&nbsp;') + t('each point → nearest centre', { tone: 'muted', cls: 'fx-tiny' }) + '<br>' +
        t('move', { tone: 'gold' }) + op(':&nbsp;') + t('each centre → mean of its points', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'both moves reduce the same quantity, which is why it always stops' }),
      dep: { note: 'a centre is the balance point of its points — a', lesson: 'correlation', label: 'mean' },
      controls: [
        { type: 'slider', key: 'iter', label: 'iteration', min: 0, max: 12, step: 1, fast: true },
        { type: 'slider', key: 'k', label: 'k  (how many centres)', min: 2, max: 6, step: 1, fast: true },
      ],
      readouts: [
        { key: 'it', label: 'iteration', get: (s, c) => atOf(s, c), d: 0 },
        { key: 'k', label: 'k', tone: 'gold', get: s => +s.k, d: 0 },
        { key: 'mv', label: 'centres moved by', tone: 'warm', get: (s, c) => { const h = KM(s).history[atOf(s, c)]; return isFinite(h.moved) ? h.moved : NaN; }, d: 4, wide: true },
        { key: 'st', label: 'settled after', tone: 'green', get: s => KM(s).iters, d: 0, suf: ' iterations', wide: true },
      ],
      beats: [
        { label: 'drop k centres', hold: 1400, note: 'Three crosses, put down before anything has been looked at.', scene: (s, c) => km(s, c) },
        { label: 'assign', hold: 1500, note: 'Every point takes the colour of its nearest cross. Some of these are obviously wrong — that is fine.', scene: (s, c) => km(s, c) },
        { label: 'move', hold: 1500, note: 'Each cross slides to the mean of the points that just chose it. Watch them jump.', scene: (s, c) => km(s, c) },
        { label: 'again', hold: 1300, note: 'Assign, move. Fewer points change colour this time.', scene: (s, c) => km(s, c) },
        { label: 'and again', hold: 1300, note: 'The crosses are barely moving now.', scene: (s, c) => km(s, c) },
        { label: 'settled', hold: 1700, note: 'Nothing changed colour, so nothing can move. That is the stopping rule — and it is a guarantee of stopping, not a guarantee of being right.', scene: (s, c) => km(s, c) },
        { label: 'your turn', note: 'Scrub <b>iteration</b> back and forth, then change <b>k</b> and watch it re-run.', scene: (s, c) => km(s, c) },
      ],
    },

    /* ── 4 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'what it is actually minimising',
      prose: `<p>Draw a spoke from every point to its own centre. Square the length of each spoke and add them all up. That total has a name — the <strong>within-cluster sum of squares</strong> — and it is the only thing k-means cares about.</p>
        <p>You have built this sum before. In correlation it was the squared distance from every point to <em>the</em> mean. Here it is the squared distance to <em>its own</em> mean, out of k of them. The move step minimises it exactly, because the mean is the point that minimises squared distance — that is what a mean is for.</p>
        <p>Drag the iteration and watch the number fall. It never rises. Not once, ever.</p>`,
      formula: formula(
        'WSS' + eq + sumOver(sumOver('d' + paren(t('x', { tone: 'cyan' }) + ', ' + t('c', { tone: 'gold' }) + sub('', 'j')) + sup('', '2'), { from: 'x ∈ Cⱼ', to: '' }), { from: 'j=1', to: 'k' }) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('the same sum of squares, with k means instead of one', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'and this is why the units of your two columns matter enormously' }),
      controls: [
        { type: 'slider', key: 'iter', label: 'iteration', min: 0, max: 12, step: 1, fast: true },
        { type: 'slider', key: 'k', label: 'k', min: 2, max: 6, step: 1, fast: true },
      ],
      readouts: [
        { key: 'w', label: 'within-cluster SS', tone: 'warm', get: (s, c) => wssAt(s, c && c.beat === 2 ? 40 : atOf(s, c)), d: 2, wide: true },
        { key: 'w0', label: 'at iteration 0', tone: 'muted', get: s => wssAt(s, 1), d: 2, wide: true },
        { key: 'wf', label: 'at the end', tone: 'green', get: s => KM(s).wss, d: 2, wide: true },
      ],
      beats: [
        { label: 'the spokes', hold: 1500, note: 'One line per point, to its own centre. Their squared lengths are what is being added up.', scene: (s, c) => spokes(s, Math.max(+s.iter, 1), true) },
        { label: 'watch it fall', hold: 1800, note: 'Scrub the iteration. The total drops at every step and then stops. It cannot go back up, because both moves are defined to reduce it.', scene: s => spokes(s, Math.max(+s.iter, 1), true) },
        { label: 'a warning about units', note: 'Distance treats both axes as comparable. Measure one column in metres and the other in millimetres and the millimetre column decides everything. <b>Standardise first, unless you have a reason not to.</b>', scene: s => spokes(s, 40, true, true) },
      ],
      aside: `<p><strong>Why the mean, specifically.</strong> The move step could put the centre anywhere. It puts it at the mean because the mean is, by construction, the point with the smallest total squared distance to a set — the same fact that makes least squares work. Swap squared distance for absolute distance and the optimal centre becomes the <em>median</em>, and the algorithm becomes k-medoids.</p>`,
    },

    /* ── 5 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'where you start changes where you end',
      prose: `<p>Those centres were placed at random. Change the random seed and the algorithm runs the same two moves on the same data — and can arrive somewhere else entirely.</p>
        <p>The stopping rule only guarantees that no single move improves things. That is a <em>local</em> minimum, and there is no promise it is the best one. Scrub the seed and watch the final sum of squares change.</p>
        <p>The universal fix is not clever: run it twenty times from different starts and keep the best. That is what <code>nstart = 25</code> means in R, and leaving it at the default of 1 is a genuine and common mistake.</p>`,
      controls: [
        { type: 'slider', key: 'seed', label: 'random start #', min: 0, max: 11, step: 1, fast: true },
        { type: 'slider', key: 'k', label: 'k', min: 2, max: 6, step: 1, fast: true },
        { type: 'segment', key: 'shape', label: 'data', options: [
          { value: 'blobs', label: 'blobs' }, { value: 'uneven', label: 'uneven' }, { value: 'moons', label: 'moons' },
        ] },
      ],
      readouts: [
        { key: 's', label: 'start #', tone: 'gold', get: s => +s.seed + 1, d: 0 },
        { key: 'w', label: 'this start ends at', tone: 'warm', get: s => KM(s).wss, d: 2, wide: true },
        { key: 'b', label: 'best of twelve', tone: 'green', get: s => Math.min(...range(12).map(i => KM(s, +s.k, i).wss)), d: 2, wide: true },
        { key: 'g', label: 'worse than best by', tone: 'cold', get: s => KM(s).wss - Math.min(...range(12).map(i => KM(s, +s.k, i).wss)), d: 2, wide: true },
      ],
      beats: [
        { label: 'this start', hold: 1500, note: 'One random initialisation, run to convergence.', scene: s => restarts(s, 1) },
        { label: 'all twelve', hold: 1800, note: 'Twelve starts, twelve final sums of squares. On clean data most agree; on anything harder they do not.', scene: s => restarts(s, 2) },
        { label: 'keep the best', note: 'Scrub <b>random start</b> and watch the bar for this run move against the rest. The green one is what <code>nstart</code> would have kept.', scene: s => restarts(s, 2) },
      ],
    },

    /* ── 6 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'k is your decision, and the data will not make it for you',
      prose: `<p>The awkward part. k-means needs k in advance, and the obvious way to choose it does not work.</p>
        <p>The within-cluster sum of squares <strong>always</strong> falls as k rises — at k = n every point is its own cluster and the total is zero. So you cannot pick k by minimising it. What people do instead is look for the <em>elbow</em>: the point where the improvement stops being worth it. It is a judgement call dressed as a diagnostic.</p>
        <p>The <strong>silhouette</strong> does better, because it also penalises groups for being close to each other. It goes up, peaks, and comes back down — so it can actually be maximised.</p>`,
      formula: formula(
        t('silhouette', { tone: 'green' }) + paren('i') + eq + frac(
          t('b', { tone: 'gold' }) + sub('', 'i') + minus + t('a', { tone: 'cyan' }) + sub('', 'i'),
          'max' + paren(t('a', { tone: 'cyan' }) + sub('', 'i') + ', ' + t('b', { tone: 'gold' }) + sub('', 'i'))) + '<br>' +
        t('a = mean distance to your own group', { tone: 'cyan', cls: 'fx-tiny' }) + op('&nbsp;&nbsp;·&nbsp;&nbsp;') +
        t('b = mean distance to the nearest other one', { tone: 'gold', cls: 'fx-tiny' }),
        { caption: 'near 1: comfortably in the right group. near 0: on the border. negative: in the wrong one.' }),
      controls: [
        { type: 'slider', key: 'k', label: 'k', min: 2, max: 6, step: 1, fast: true },
        { type: 'segment', key: 'shape', label: 'data', options: [
          { value: 'blobs', label: 'blobs' }, { value: 'uneven', label: 'uneven' }, { value: 'none', label: 'no groups' },
        ] },
      ],
      readouts: [
        { key: 'k', label: 'k', tone: 'gold', get: s => +s.k, d: 0 },
        { key: 'w', label: 'within-cluster SS', tone: 'warm', get: s => KM(s).wss, d: 1, wide: true },
        { key: 'sil', label: 'silhouette', tone: 'green', get: s => silAt(s, +s.k), d: 3, wide: true },
        { key: 'best', label: 'silhouette picks', tone: 'cyan', get: s => bestK(s), d: 0, pre: 'k = ', wide: true },
      ],
      beats: [
        { label: 'the elbow', hold: 1700, note: 'WSS against k. It falls forever, so its minimum is useless. The bend is where people stop, and different people see it in different places.', scene: s => choose(s, 1) },
        { label: 'the silhouette', hold: 1800, note: 'This one has a peak, because it charges you for clusters that sit close together.', scene: s => choose(s, 2) },
        { label: 'on data with no groups', hold: 1900, note: 'Switch the data to <b>no groups</b>. k-means still returns k clusters, still returns a falling WSS curve, and the silhouette stays low at every k — which is the only thing telling you anything is wrong.', scene: s => choose(s, 2) },
        { label: 'your turn', note: 'Change k and watch both the picture and both curves.', scene: s => choose(s, 3) },
      ],
    },

    /* ── 7 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'what k-means assumes without telling you',
      prose: `<p>Assigning every point to its nearest centre draws straight-line boundaries — a point belongs to a centre if it is closer to it than to any other, which carves the plane into flat-sided cells. Three consequences follow immediately, and none of them are optional.</p>
        <p><strong>Clusters must be roughly round</strong>, because a cell is convex. <strong>Roughly the same size</strong>, because a big cluster pulls its centre and steals the small one's points. And <strong>roughly the same density</strong>, for the same reason.</p>
        <p>Cycle through the shapes. On blobs it is excellent. On the crescents it cuts straight through both of them, because there is no arrangement of two centres that does anything else.</p>`,
      controls: [
        { type: 'segment', key: 'shape', label: 'data', options: [
          { value: 'blobs', label: 'blobs' }, { value: 'uneven', label: 'uneven' },
          { value: 'moons', label: 'moons' }, { value: 'rings', label: 'rings' },
        ] },
        { type: 'slider', key: 'k', label: 'k', min: 2, max: 6, step: 1, fast: true },
      ],
      readouts: [
        { key: 'sil', label: 'silhouette', tone: 'green', get: s => silAt(s, +s.k), d: 3, wide: true },
        { key: 'v', label: 'verdict', get: s => ({ blobs: 'exactly what it assumes', uneven: 'the big group steals points', moons: 'cuts through both crescents', rings: 'slices the doughnut in half', none: 'invents groups' }[s.shape]), wide: true },
      ],
      beats: [
        { label: 'the boundaries it can draw', hold: 1700, note: 'Shading by nearest centre. Every boundary is straight, because "closer to A than to B" always is.', scene: s => cells(s, 1) },
        { label: 'blobs: fine', hold: 1500, note: 'Round, separated, similar sizes. This is the case k-means was designed for and it is genuinely hard to beat here.', scene: s => cells({ ...s, shape: 'blobs' }, 1) },
        { label: 'uneven: dragged', hold: 1700, note: 'One group has five times the points. Its centre is pulled toward the boundary and takes some of the small group with it.', scene: s => cells({ ...s, shape: 'uneven', k: 2 }, 1) },
        { label: 'moons: hopeless', hold: 1900, note: 'Two crescents, and no pair of centres separates them. The failure is not bad luck or a bad start — the model cannot express the answer.', scene: s => cells({ ...s, shape: 'moons', k: 2 }, 1) },
        { label: 'your turn', note: 'Cycle the shapes and watch the silhouette drop as the assumptions break.', scene: s => cells(s, 1) },
      ],
    },

    /* ── 8 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'hierarchical: refuse to choose k',
      prose: `<p>A different idea, and a better-tempered one. Do not pick k. Start with every point in its own group and repeatedly merge the two closest groups until there is one left.</p>
        <p>That gives you the whole history of merges, drawn as a tree. The height of each join is <em>how far apart the two things were when they merged</em> — so a tall join means two genuinely distant groups were forced together, and a short one means they were basically the same thing already.</p>
        <p>You still get to choose k, but afterwards, by sliding a horizontal line down the tree and counting how many branches it crosses. Twenty-four points here, so the whole tree fits.</p>`,
      controls: [
        { type: 'slider', key: 'cutK', label: 'cut into this many groups', min: 1, max: 8, step: 1, fast: true },
        { type: 'segment', key: 'shape', label: 'data', options: [
          { value: 'blobs', label: 'blobs' }, { value: 'moons', label: 'moons' }, { value: 'none', label: 'no groups' },
        ] },
      ],
      readouts: [
        { key: 'k', label: 'groups', tone: 'gold', get: s => +s.cutK, d: 0 },
        { key: 'h', label: 'cut height', tone: 'cyan', get: s => cutHeight(s, +s.cutK), d: 3, wide: true },
        { key: 'j', label: 'tallest join', tone: 'warm', get: s => HC(s).merges.at(-1).height, d: 3, wide: true },
      ],
      beats: [
        { label: 'twenty-four singletons', hold: 1300, note: 'Every point is its own group. Twenty-four groups, zero decisions made.', scene: s => tree(s, 0) },
        { label: 'merge the closest pair', hold: 1400, note: 'The two nearest points join. The bracket is drawn at the height of the distance between them.', scene: s => tree(s, 1) },
        { label: 'keep going', hold: 1500, note: 'Five merges in. Short brackets, because the pairs so far were all close together.', scene: s => tree(s, 5) },
        { label: 'the whole tree', hold: 1800, note: 'All twenty-three merges. The tall brackets near the top are where genuinely different groups were forced together.', scene: s => tree(s, 99) },
        { label: 'cut it', note: 'Drag <b>cut into</b>. The dashed line slides, and the number of branches it crosses is your k — chosen with the tree in front of you rather than in advance.', scene: s => tree(s, 99, true) },
      ],
    },

    /* ── 9 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'linkage is not a technicality',
      prose: `<p>"The two closest groups" needs a definition once a group has more than one point in it, and there are three common answers.</p>
        <p><strong>Single</strong>: the distance between the two <em>nearest</em> members. <strong>Complete</strong>: between the two <em>furthest</em>. <strong>Average</strong>: the mean over all pairs.</p>
        <p>That sounds like a detail. It is not. Single linkage will happily chain along a thin filament, which is exactly what you want for the crescents and exactly what you do not want when two real groups are joined by a few stragglers. Complete linkage insists on compact balls and will split a long cluster in half rather than accept it.</p>
        <p>Switch the linkage on the <strong>moons</strong> and watch the answer change completely, on identical data.</p>`,
      controls: [
        { type: 'segment', key: 'link', label: 'linkage', options: [
          { value: 'single', label: 'single', explain: 'Distance between the two nearest members. Chains along filaments.' },
          { value: 'complete', label: 'complete', explain: 'Distance between the two furthest members. Insists on compact groups.' },
          { value: 'average', label: 'average', explain: 'Mean over all pairs. The usual compromise.' },
        ] },
        { type: 'segment', key: 'shape', label: 'data', options: [
          { value: 'moons', label: 'moons' }, { value: 'blobs', label: 'blobs' }, { value: 'rings', label: 'rings' },
        ] },
        { type: 'slider', key: 'cutK', label: 'cut into', min: 2, max: 6, step: 1, fast: true },
      ],
      readouts: [
        { key: 'l', label: 'linkage', get: s => s.link, wide: true },
        { key: 'sz', label: 'group sizes', get: s => { const l = cutTree(HC(s), +s.cutK, XS(s).length); return range(+s.cutK).map(k => l.filter(v => v === k).length).join(' / '); }, wide: true },
        { key: 'h', label: 'tallest join', tone: 'warm', get: s => HC(s).merges.at(-1).height, d: 3, wide: true },
      ],
      beats: [
        { label: 'single', hold: 1800, note: 'Nearest members. On the crescents it follows each one all the way round — the only method so far that gets this right.', scene: s => tree({ ...s, link: 'single' }, 99, true) },
        { label: 'complete', hold: 1800, note: 'Furthest members. It refuses to accept a long thin group and cuts across instead.', scene: s => tree({ ...s, link: 'complete' }, 99, true) },
        { label: 'average', hold: 1800, note: 'The compromise, and usually the sensible default when you have no reason to prefer either extreme.', scene: s => tree({ ...s, link: 'average' }, 99, true) },
        { label: 'your turn', note: 'Same points, same algorithm, one word changed. Compare the group sizes.', scene: s => tree(s, 99, true) },
      ],
    },

    /* ── 10 ────────────────────────────────────────────────────────────────── */
    {
      title: 'dbscan: a cluster is a crowded place',
      prose: `<p>The third idea drops centres and trees entirely. A cluster is wherever the points are <em>dense</em>.</p>
        <p>Two numbers. <strong>eps</strong> is how far you look; <strong>minPts</strong> is how many neighbours you need within that distance to count as being in a crowd. A point with enough neighbours is a <em>core</em> point; core points that can reach each other form a cluster; points near a core point come along as borders; and everything left over is labelled <strong>noise</strong> rather than being forced into a group.</p>
        <p>That last part is the real difference. k-means and hierarchical clustering must assign every point somewhere. This one is allowed to say "that one is not in a group", which on real data is very often true.</p>`,
      formula: formula(
        t('core', { tone: 'cyan' }) + op(':&nbsp;') + t('≥ minPts neighbours within eps', { tone: 'muted', cls: 'fx-tiny' }) + op('&nbsp;·&nbsp;') +
        t('border', { tone: 'gold' }) + op(':&nbsp;') + t('near a core point', { tone: 'muted', cls: 'fx-tiny' }) + op('&nbsp;·&nbsp;') +
        t('noise', { tone: 'muted' }) + op(':&nbsp;') + t('neither', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'no k anywhere in this definition' }),
      controls: [
        { type: 'slider', key: 'eps', label: 'eps  (how far you look)', min: 0.12, max: 1.0, step: 0.01, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'slider', key: 'minPts', label: 'minPts  (how crowded is crowded)', min: 2, max: 10, step: 1, fast: true },
        { type: 'segment', key: 'shape', label: 'data', options: [
          { value: 'moons', label: 'moons' }, { value: 'rings', label: 'rings' },
          { value: 'blobs', label: 'blobs' }, { value: 'none', label: 'no groups' },
        ] },
      ],
      readouts: [
        { key: 'k', label: 'clusters found', tone: 'green', get: s => DB(s).k, d: 0, wide: true },
        { key: 'n', label: 'called noise', tone: 'muted', get: s => DB(s).noise, d: 0, wide: true },
        { key: 'c', label: 'core points', tone: 'cyan', get: s => DB(s).core.filter(Boolean).length, d: 0, wide: true },
      ],
      beats: [
        { label: 'one point, one radius', hold: 1500, note: 'Look eps away from a point and count what you find. This one has enough neighbours, so it is a <b>core</b> point.', scene: s => db(s, 1) },
        { label: 'every point asks', hold: 1600, note: 'Core points in colour, everything else grey. No centres, no k — just a census of crowding.', scene: s => db(s, 2) },
        { label: 'join the core points up', hold: 1800, note: 'Core points within eps of each other are in the same cluster. Because the rule is local, the cluster can be any shape at all — including a crescent.', scene: s => db(s, 3) },
        { label: 'turn eps down', hold: 1800, note: 'Too small and the crowd never forms: everything fragments and most points become noise.', scene: s => db({ ...s, eps: 0.18 }, 3) },
        { label: 'turn eps up', hold: 1800, note: 'Too large and everything is one crowd. There is a window in between, and finding it is the whole job.', scene: s => db({ ...s, eps: 0.9 }, 3) },
        { label: 'your turn', note: 'Drag <b>eps</b> slowly across the middle of its range on the crescents. Two clusters appear, hold, and then merge.', scene: s => db(s, 3) },
      ],
    },

    /* ── 11 ────────────────────────────────────────────────────────────────── */
    {
      title: 'the dials, and the thing nobody says out loud',
      prose: `<p>Every parameter in this lesson, and the failure at each end.</p>
        <p>And then the warning that matters more than any of them. <strong>All three algorithms return groups from data with no groups in it.</strong> None of them has a way to say "there is nothing here" — the closest thing to one is a silhouette that stays low at every k, and almost nobody reports it.</p>
        <p>Clustering generates hypotheses. It does not test them. A cluster is a real finding when it survives on new data, predicts something you did not cluster on, or corresponds to a distinction someone can name. Until then it is a picture.</p>`,
      beats: [
        {
          label: 'the panel', hold: 2000,
          scene: s => knobCards([
            { name: 'k  (k-means, hierarchical cut)', value: String(+s.k), tone: 'gold',
              does: 'How many groups you have decided exist. Chosen before you look, or after, but always by you.',
              low: 'real distinctions get merged', high: 'one group gets split into arbitrary halves' },
            { name: 'nstart  (k-means restarts)', value: '12 here', tone: 'cyan',
              does: 'How many random initialisations to try before keeping the best. The default in most software is 1.',
              low: 'you report a local minimum as the answer', high: 'nothing breaks; it just costs time' },
            { name: 'linkage  (hierarchical)', value: s.link, tone: 'purple',
              does: 'What "distance between two groups" means. Single chains, complete compacts, average splits the difference.',
              low: 'single: two real groups joined by stragglers merge', high: 'complete: one long real group gets cut in half' },
            { name: 'eps / minPts  (dbscan)', value: `${(+s.eps).toFixed(2)} / ${s.minPts}`, tone: 'green',
              does: 'How far you look, and how many neighbours count as a crowd. Together they define density.',
              low: 'everything is noise', high: 'everything is one cluster' },
          ], { y0: 56, rowH: 112 }),
        },
        {
          label: 'the uncomfortable demonstration',
          note: 'Uniform noise. No structure whatsoever. All three methods return groups, and two of the three look entirely convincing.',
          scene: s => nothing(s),
        },
      ],
    },
  ],
};

/* ── scenes ───────────────────────────────────────────────────────────────── */

function ruler(s, phase) {
  const f = frame({ w: 720, h: 540, l: 70, r: 240, t: 60, b: 78 });
  f.setX(-2.6, 2.6); f.setY(-2.1, 2.1);
  const a = [+s.ax, +s.ay], b = [1.2, -0.7];
  const dx = a[0] - b[0], dy = a[1] - b[1], d = Math.hypot(dx, dy);
  return [
    ...axes(f, { xLabel: 'measurement 1', yLabel: 'measurement 2', xN: 5, yN: 5 }),
    phase >= 2 ? path('leg1', [[f.sx(b[0]), f.sy(b[1])], [f.sx(a[0]), f.sy(b[1])]], { cls: 'stick stick-x', set: { 'stroke-width': 3 } }) : null,
    phase >= 2 ? path('leg2', [[f.sx(a[0]), f.sy(b[1])], [f.sx(a[0]), f.sy(a[1])]], { cls: 'stick stick-y', set: { 'stroke-width': 3 } }) : null,
    phase >= 2 ? numLabel('leg1v', (f.sx(a[0]) + f.sx(b[0])) / 2, f.sy(b[1]) + 18, Math.abs(dx), { cls: 'lab-sm lab-mid lab-cyan', d: 2 }) : null,
    phase >= 2 ? numLabel('leg2v', f.sx(a[0]) + 10, (f.sy(a[1]) + f.sy(b[1])) / 2, Math.abs(dy), { cls: 'lab-sm lab-purple', d: 2 }) : null,
    phase >= 3 ? path('hyp', [[f.sx(b[0]), f.sy(b[1])], [f.sx(a[0]), f.sy(a[1])]], { cls: 'curve curve-fit' }) : null,
    { key: 'pa', tag: 'circle', cls: 'pt pt-cyan', attrs: { cx: f.sx(a[0]), cy: f.sy(a[1]), r: 9 } },
    { key: 'pb', tag: 'circle', cls: 'pt pt-warm', attrs: { cx: f.sx(b[0]), cy: f.sy(b[1]), r: 9 } },
    label('la', f.sx(a[0]), f.sy(a[1]) - 18, 'a', { cls: 'lab-big lab-mid lab-cyan' }),
    label('lb', f.sx(b[0]), f.sy(b[1]) + 26, 'b', { cls: 'lab-big lab-mid lab-warm' }),
    phase >= 3 ? numLabel('dv', 500, 200, d, { cls: 'lab-big lab-green', d: 3, pre: 'd = ' }) : null,
    phase >= 3 ? numLabel('dw', 500, 226, d, {
      cls: 'lab-sm', d: 3, fmt: v => `√(${Math.abs(dx).toFixed(2)}² + ${Math.abs(dy).toFixed(2)}²) = ${v.toFixed(3)}`,
    }) : null,
  ].filter(Boolean);
}

function plain(s, phase) {
  const f = F(s, { r: 44 });
  return [
    ...axes(f, { xLabel: 'measurement 1', yLabel: 'measurement 2' }),
    ...(phase >= 1 ? dots(s, f, null, { r: 5 }) : []),
    phase >= 1 ? label('n', f.x1 - 6, f.y1 + 6, `${X(s).length} points · no labels`, { cls: 'lab-sm lab-end' }) : null,
  ].filter(Boolean);
}

/* the centre gets a dark halo and a white cross-hair, so it never reads as
   just another point in the same colour */
const cross = (key, f, c, j, o = {}) => [
  { key: `${key}o-${j}`, tag: 'circle', dur: o.dur,
    attrs: { cx: f.sx(c[0]), cy: f.sy(c[1]), r: 11 },
    set: { fill: 'var(--cs-bg)', stroke: col(j), 'stroke-width': 2.4 }, opacity: 0.95 },
  path(`${key}h-${j}`, [[f.sx(c[0]) - 6, f.sy(c[1])], [f.sx(c[0]) + 6, f.sy(c[1])]], {
    cls: 'stick', set: { stroke: col(j), 'stroke-width': 2.6 }, ...o,
  }),
  path(`${key}v-${j}`, [[f.sx(c[0]), f.sy(c[1]) - 6], [f.sx(c[0]), f.sy(c[1]) + 6]], {
    cls: 'stick', set: { stroke: col(j), 'stroke-width': 2.6 }, ...o,
  }),
];

/* which iteration each beat of steps 3 and 4 is showing. The last entry is the
   interactive one, so the slider takes over only once the walk-through ends. */
const BEAT_ITER = [0, 1, 2, 3, 4, 40];
const iterOf = (s, ctx) =>
  ctx && ctx.beat != null && ctx.beat < BEAT_ITER.length ? BEAT_ITER[ctx.beat] : +s.iter;

function frameAt(s, i) {
  const H = KM(s).history;
  return H[clamp(i, 0, H.length - 1)];
}
const atOf = (s, ctx) => clamp(iterOf(s, ctx), 0, KM(s).history.length - 1);

function km(s, ctx) {
  const f = F(s, { r: 44 });
  const i = atOf(s, ctx);
  const h = frameAt(s, i);
  return [
    ...axes(f, { xLabel: 'measurement 1', yLabel: 'measurement 2' }),
    ...dots(s, f, h.labels, { r: 5 }),
    ...h.centres.flatMap((c, j) => cross('c', f, c, j)),
    label('it', f.x0 + 6, f.y1 + 4, `iteration ${i}`, { cls: 'lab-big lab-gold' }),
    label('it2', f.x0 + 6, f.y1 + 22, h.labels ? 'assigned, then moved' : 'centres placed, nothing assigned yet', { cls: 'lab-sm' }),
  ];
}

const wssAt = (s, i) => {
  const h = frameAt(s, Math.max(i, 1));
  return h.labels ? wss(X(s), h.labels, h.centres) : NaN;
};

function spokes(s, i, show, warn) {
  const f = F(s, { r: 210 });
  const h = frameAt(s, Math.max(i, 1));
  const P = X(s);
  return [
    ...axes(f, { xLabel: 'measurement 1', yLabel: 'measurement 2' }),
    ...(show ? P.map((p, k) => path(`sp-${k}`, [
      [f.sx(p[0]), f.sy(p[1])], [f.sx(h.centres[h.labels[k]][0]), f.sy(h.centres[h.labels[k]][1])],
    ], { cls: 'stick', set: { stroke: col(h.labels[k]), 'stroke-width': 1.1 }, opacity: 0.55, dur: 260 })) : []),
    ...dots(s, f, h.labels, { r: 4.4 }),
    ...h.centres.flatMap((c, j) => cross('c', f, c, j)),
    numLabel('w', 500, 120, wssAt(s, i), { cls: 'lab-big lab-warm', d: 2, pre: 'WSS = ' }),
    label('wl', 500, 142, 'sum of the squared spokes', { cls: 'lab-sm' }),
    numLabel('w2', 500, 180, wssAt(s, 1), { cls: 'lab lab-muted', d: 2, pre: 'started at ' }),
    numLabel('w3', 500, 202, KM(s).wss, { cls: 'lab lab-green', d: 2, pre: 'ends at ' }),
    warn ? [
      label('u1', 500, 260, 'both axes are treated', { cls: 'lab-sm lab-gold' }),
      label('u2', 500, 274, 'as equally important.', { cls: 'lab-sm lab-gold' }),
      label('u3', 500, 296, 'measure one in metres and', { cls: 'lab-sm' }),
      label('u4', 500, 310, 'the other in millimetres and', { cls: 'lab-sm' }),
      label('u5', 500, 324, 'the millimetres decide', { cls: 'lab-sm' }),
      label('u6', 500, 338, 'everything.', { cls: 'lab-sm' }),
    ] : null,
  ].filter(Boolean);
}

function restarts(s, phase) {
  const f = F(s, { r: 268 });
  const R = KM(s);
  const all = range(12).map(i => KM(s, +s.k, i).wss);
  const bestW = Math.min(...all), worstW = Math.max(...all);
  const out = [
    ...axes(f, { xLabel: 'measurement 1', yLabel: 'measurement 2' }),
    ...dots(s, f, R.labels, { r: 4.6 }),
    ...R.centres.flatMap((c, j) => cross('c', f, c, j)),
  ];
  if (phase >= 2) {
    const X0 = 470, W = 210, Y0 = 96, RH = 26;
    out.push(label('bh', X0, Y0 - 14, 'final WSS, twelve starts', { cls: 'lab-sm lab-gold' }));
    all.forEach((w, i) => {
      const y = Y0 + i * RH;
      const frac2 = worstW > bestW ? (w - bestW) / (worstW - bestW) : 0;
      out.push(
        rect('bt' + i, X0, y, W, 16, { cls: 'sq sq-dim' }),
        rect('bf' + i, X0, y, W * (0.25 + 0.75 * (1 - frac2)), 16, {
          cls: 'sq ' + (i === +s.seed ? 'sq-x' : Math.abs(w - bestW) < 1e-6 ? 'sq-gold' : 'sq-resid'),
        }),
        numLabel('bv' + i, X0 + W + 8, y + 13, w, { cls: 'lab-sm lab-' + (i === +s.seed ? 'cyan' : 'muted'), d: 1 }),
      );
    });
    out.push(label('bl', X0, Y0 + 12 * RH + 10, 'cyan: the start you are looking at', { cls: 'lab-sm lab-cyan' }));
    out.push(label('bl2', X0, Y0 + 12 * RH + 26, 'gold: the best of the twelve', { cls: 'lab-sm lab-gold' }));
  }
  return out;
}

const silCache = new Map();
function silAt(s, k) {
  const key = `${s.shape}|${k}|${s.seed}`;
  if (!silCache.has(key)) silCache.set(key, silhouette(X(s), KM(s, k).labels));
  return silCache.get(key);
}
const bestK = s => range(5).map(i => i + 2).reduce((a, b) => (silAt(s, b) > silAt(s, a) ? b : a), 2);

function choose(s, phase) {
  const f = F(s, { r: 330, b: 62 });
  const out = [
    ...axes(f, { xLabel: 'm1', yLabel: 'm2' }),
    ...dots(s, f, KM(s).labels, { r: 4.2 }),
    ...KM(s).centres.flatMap((c, j) => cross('c', f, c, j)),
  ];
  const KS = range(6).map(i => i + 1);
  const ws = KS.map(k => KM(s, k).wss);

  const e = frame({ w: 720, h: 540, l: 428, r: 30, t: 66, b: 336 });
  e.setX(1, 6); e.setY(0, Math.max(...ws) * 1.1);
  out.push(
    { key: 'ex', tag: 'line', cls: 'ax-line', attrs: { x1: e.x0, y1: e.y0, x2: e.x1, y2: e.y0 } },
    { key: 'ey', tag: 'line', cls: 'ax-line', attrs: { x1: e.x0, y1: e.y0, x2: e.x0, y2: e.y1 } },
    label('el', e.x0, e.y1 - 10, 'within-cluster SS', { cls: 'lab-sm lab-warm' }),
    path('ec', KS.map((k, i) => [e.sx(k), e.sy(ws[i])]), { cls: 'curve curve-warm' }),
    ...KS.map(k => ({
      key: 'ep' + k, tag: 'circle', cls: 'pt',
      attrs: { cx: e.sx(k), cy: e.sy(ws[k - 1]), r: k === +s.k ? 6 : 3.4 },
      set: { fill: k === +s.k ? 'var(--cs-cyan)' : 'var(--cs-data-warm)', stroke: 'none' },
      tip: `k = ${k}<br>WSS = ${ws[k - 1].toFixed(2)}`,
    })),
    ...KS.map(k => label('ext' + k, e.sx(k), e.y0 + 16, String(k), { cls: 'ax-tick' })),
    label('exl', (e.x0 + e.x1) / 2, e.y0 + 34, 'k', { cls: 'ax-label' }),
  );

  if (phase >= 2) {
    const sil = range(5).map(i => silAt(s, i + 2));
    const g = frame({ w: 720, h: 540, l: 428, r: 30, t: 300, b: 92 });
    g.setX(1, 6); g.setY(Math.min(0, ...sil) - 0.05, Math.max(0.8, ...sil) * 1.15);
    out.push(
      { key: 'gx', tag: 'line', cls: 'ax-line', attrs: { x1: g.x0, y1: g.sy(0), x2: g.x1, y2: g.sy(0) } },
      { key: 'gy', tag: 'line', cls: 'ax-line', attrs: { x1: g.x0, y1: g.y0, x2: g.x0, y2: g.y1 } },
      label('gl', g.x0, g.y1 - 10, 'silhouette — this one has a peak', { cls: 'lab-sm lab-green' }),
      path('gc', sil.map((v, i) => [g.sx(i + 2), g.sy(v)]), { cls: 'curve curve-fit' }),
      ...sil.map((v, i) => ({
        key: 'gp' + i, tag: 'circle', cls: 'pt',
        attrs: { cx: g.sx(i + 2), cy: g.sy(v), r: i + 2 === +s.k ? 6 : 3.4 },
        set: { fill: i + 2 === bestK(s) ? 'var(--cs-data-green)' : 'var(--cs-muted)', stroke: 'none' },
        tip: `k = ${i + 2}<br>silhouette = ${v.toFixed(3)}`,
      })),
      ...range(5).map(i => label('gxt' + i, g.sx(i + 2), g.y0 + 16, String(i + 2), { cls: 'ax-tick' })),
      numLabel('gb', g.x1, g.y1 - 10, bestK(s), { cls: 'lab-sm lab-end lab-green', d: 0, pre: 'peak at k = ' }),
    );
  }
  return out;
}

function cells(s, phase) {
  const f = F(s, { r: 200 });
  const R = KM(s);
  const n = 36;
  const w = (f.x1 - f.x0) / n, hh = (f.y0 - f.y1) / n;
  const bg = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const px = f.x0 + i * w, py = f.y1 + j * hh;
    const p = [f.ix(px + w / 2), f.iy(py + hh / 2)];
    let bi = 0, bd = Infinity;
    R.centres.forEach((c, m) => { const d = dist(p, c); if (d < bd) { bd = d; bi = m; } });
    bg.push({
      key: `g-${i}-${j}`, tag: 'rect', dur: 200,
      attrs: { x: px, y: py, width: w + 0.7, height: hh + 0.7 },
      set: { fill: col(bi), stroke: 'none' }, opacity: 0.13,
    });
  }
  return [
    ...bg,
    ...axes(f, { xLabel: 'm1', yLabel: 'm2' }),
    ...dots(s, f, R.labels, { r: 4.4 }),
    ...R.centres.flatMap((c, j) => cross('c', f, c, j)),
    numLabel('sv', 486, 130, silAt(s, +s.k), { cls: 'lab-big lab-green', d: 3, pre: 'silhouette = ' }),
    label('sv2', 486, 152, ({ blobs: 'exactly what it assumes', uneven: 'the big group steals points', moons: 'cuts through both crescents', rings: 'slices the doughnut in half', none: 'invents groups' }[s.shape] || ''), { cls: 'lab-sm lab-warm' }),
    label('c1', 486, 200, 'every boundary is straight,', { cls: 'lab-sm' }),
    label('c2', 486, 214, 'because "closer to A than to B"', { cls: 'lab-sm' }),
    label('c3', 486, 228, 'always is. so every cluster', { cls: 'lab-sm' }),
    label('c4', 486, 242, 'k-means can find is convex.', { cls: 'lab-sm' }),
  ];
}

function cutHeight(s, k) {
  const m = HC(s).merges;
  if (k <= 1) return m.at(-1).height * 1.08;
  if (k > m.length) return 0;
  const hs = m.map(x => x.height).sort((a, b) => b - a);
  return (hs[k - 2] + (hs[k - 1] ?? 0)) / 2;
}

function tree(s, upTo, showCut) {
  const P = XS(s);
  const T = HC(s);
  const pos = layout(T.root);
  const merges = T.merges.slice(0, upTo);
  const maxH = T.merges.at(-1).height;
  const labels = showCut ? cutTree(T, +s.cutK, P.length) : null;

  /* the scatter, small, on the left; the tree on the right */
  const f = frame({ w: 720, h: 540, l: 46, r: 448, t: 60, b: 300 });
  f.fit(P.map(p => p[0]), P.map(p => p[1]), 0.16);
  const d = frame({ w: 720, h: 540, l: 296, r: 26, t: 56, b: 92 });
  d.setX(-0.6, P.length - 0.4); d.setY(0, maxH * 1.06);

  const out = [
    ...axes(f, { xN: 3, yN: 3 }),
    ...P.map((p, i) => ({
      key: `sp-${i}`, tag: 'circle', cls: 'pt', dur: 260,
      attrs: { cx: f.sx(p[0]), cy: f.sy(p[1]), r: 5 },
      set: { fill: labels ? col(labels[i]) : 'var(--cs-muted)', stroke: 'none' },
      tip: `point ${i + 1}`,
    })),
    label('sl', f.x0, f.y1 - 10, `${P.length} points`, { cls: 'lab-sm' }),
    { key: 'dx', tag: 'line', cls: 'ax-line', attrs: { x1: d.x0, y1: d.y0, x2: d.x1, y2: d.y0 } },
    { key: 'dy', tag: 'line', cls: 'ax-line', attrs: { x1: d.x0, y1: d.y0, x2: d.x0, y2: d.y1 } },
    { key: 'dyl', tag: 'text', cls: 'ax-label', attrs: { x: 0, y: 0 }, set: { transform: `translate(${Math.max(14, d.x0 - 44)} ${(d.y0 + d.y1) / 2}) rotate(-90)` }, text: 'distance at merge' },
    label('dl', (d.x0 + d.x1) / 2, d.y0 + 26, `${s.link} linkage`, { cls: 'ax-label' }),
  ];

  /* leaves */
  P.forEach((p, i) => {
    const q = pos.get(i);
    out.push({
      key: `lf-${i}`, tag: 'circle', cls: 'pt', dur: 260,
      attrs: { cx: d.sx(q.x), cy: d.sy(0), r: 2.8 },
      set: { fill: labels ? col(labels[i]) : 'var(--cs-muted)', stroke: 'none' },
    });
  });

  /* one bracket per merge, drawn only up to the frame being shown */
  merges.forEach((m, i) => {
    const q = pos.get(m.id);
    if (!q) return;
    const colr = labels && sameGroup(q.node, labels) != null ? col(sameGroup(q.node, labels)) : 'var(--cs-muted)';
    out.push(path(`br-${m.id}`, [
      [d.sx(q.a.x), d.sy(q.a.y)], [d.sx(q.a.x), d.sy(q.y)],
      [d.sx(q.b.x), d.sy(q.y)], [d.sx(q.b.x), d.sy(q.b.y)],
    ], { cls: 'stick', set: { stroke: colr, 'stroke-width': 1.5, fill: 'none' }, delay: Math.min(i, 12) * 60, dur: 260 }));
  });

  if (showCut) {
    const h = cutHeight(s, +s.cutK);
    out.push(
      path('cut', [[d.x0, d.sy(h)], [d.x1, d.sy(h)]], { cls: 'rule rule-gold rule-dash' }),
      numLabel('cutl', d.x1, d.sy(h) - 6, +s.cutK, { cls: 'lab lab-end lab-gold', d: 0, pre: 'cut → ', suf: ' groups' }),
    );
  }
  out.push(label('mn', d.x0 + 4, d.y1 - 10, `${merges.length} of ${T.merges.length} merges`, { cls: 'lab-sm lab-cyan' }));
  return out;
}

/** if every member of this subtree ended in one group, which one? */
function sameGroup(node, labels) {
  const g = labels[node.members[0]];
  return node.members.every(i => labels[i] === g) ? g : null;
}

function db(s, phase) {
  const f = F(s, { r: 214 });
  const R = DB(s);
  const P = X(s);
  const out = [...axes(f, { xLabel: 'm1', yLabel: 'm2' })];

  if (phase === 1) {
    const i = 0;
    const rpx = Math.abs(f.sx(P[i][0] + (+s.eps)) - f.sx(P[i][0]));
    out.push(
      { key: 'ball', tag: 'circle', attrs: { cx: f.sx(P[i][0]), cy: f.sy(P[i][1]), r: rpx },
        set: { fill: 'rgba(0,212,255,.10)', stroke: 'var(--cs-cyan)', 'stroke-dasharray': '4 4' } },
      ...P.map((p, j) => ({
        key: `p-${j}`, tag: 'circle', cls: 'pt', dur: 260,
        attrs: { cx: f.sx(p[0]), cy: f.sy(p[1]), r: j === i ? 8 : 4.4 },
        set: { fill: j === i ? 'var(--cs-cyan)' : R.nbrs[i].includes(j) ? 'var(--cs-data-gold)' : 'var(--cs-muted)', stroke: 'none' },
        opacity: j === i || R.nbrs[i].includes(j) ? 1 : 0.4,
      })),
      numLabel('nb', 468, 130, R.nbrs[i].length - 1, { cls: 'lab-big lab-gold', d: 0, pre: 'neighbours: ' }),
      numLabel('mp', 468, 156, +s.minPts, { cls: 'lab lab-cyan', d: 0, pre: 'minPts = ' }),
      label('vd', 468, 190, R.core[i] ? 'enough → this is a CORE point' : 'not enough → not core', { cls: 'lab ' + (R.core[i] ? 'lab-green' : 'lab-warm') }),
    );
    return out;
  }

  out.push(...P.map((p, j) => ({
    key: `p-${j}`, tag: 'circle', cls: 'pt', dur: 260,
    attrs: { cx: f.sx(p[0]), cy: f.sy(p[1]), r: R.core[j] ? 5 : 3.6 },
    set: {
      fill: phase >= 3 ? col(R.labels[j]) : R.core[j] ? 'var(--cs-cyan)' : 'var(--cs-muted)',
      stroke: 'none',
    },
    opacity: R.labels[j] < 0 && phase >= 3 ? 0.45 : 1,
    tip: `${R.core[j] ? 'core' : R.labels[j] < 0 ? 'noise' : 'border'}<br>${R.nbrs[j].length - 1} neighbours within eps`,
  })));

  const px = 466;
  out.push(
    numLabel('ep', px, 122, +s.eps, { cls: 'lab-big lab-cyan', d: 2, pre: 'eps = ' }),
    numLabel('mp', px, 146, +s.minPts, { cls: 'lab lab-cyan', d: 0, pre: 'minPts = ' }),
    numLabel('kk', px, 190, R.k, { cls: 'lab-big lab-green', d: 0, pre: 'clusters: ' }),
    numLabel('cr', px, 214, R.core.filter(Boolean).length, { cls: 'lab lab-cyan', d: 0, pre: 'core points: ' }),
    numLabel('nz', px, 236, R.noise, { cls: 'lab lab-muted', d: 0, pre: 'noise: ' }),
    label('v1', px, 280, R.k === 0 ? 'eps too small — no crowd forms'
      : R.k === 1 ? 'eps too large — one crowd'
      : 'a workable window', { cls: 'lab ' + (R.k >= 2 && R.k <= 4 ? 'lab-green' : 'lab-warm') }),
    phase >= 3 ? [
      label('v2', px, 320, 'grey points are noise —', { cls: 'lab-sm' }),
      label('v3', px, 334, 'not assigned to anything.', { cls: 'lab-sm' }),
      label('v4', px, 356, 'no other method here', { cls: 'lab-sm lab-gold' }),
      label('v5', px, 370, 'is allowed to do that.', { cls: 'lab-sm lab-gold' }),
    ] : null,
  );
  return out.filter(Boolean);
}

function nothing(s) {
  const N = { ...s, shape: 'none' };
  const P = X(N);
  const mk = (x0, x1, labels, ttl, sub) => {
    const f = frame({ w: 720, h: 540, l: x0, r: 720 - x1, t: 116, b: 250 });
    f.fit(P.map(p => p[0]), P.map(p => p[1]), 0.12);
    return [
      { key: `bx${x0}`, tag: 'rect', attrs: { x: f.x0 - 8, y: f.y1 - 8, width: f.x1 - f.x0 + 16, height: f.y0 - f.y1 + 16 }, cls: 'cell' },
      ...P.map((p, i) => ({
        key: `n${x0}-${i}`, tag: 'circle', cls: 'pt',
        attrs: { cx: f.sx(p[0]), cy: f.sy(p[1]), r: 2.8 },
        set: { fill: col(labels[i]), stroke: 'none' }, opacity: labels[i] < 0 ? 0.35 : 1,
      })),
      label(`t${x0}`, (f.x0 + f.x1) / 2, f.y1 - 18, ttl, { cls: 'lab lab-mid lab-gold' }),
      label(`s${x0}`, (f.x0 + f.x1) / 2, f.y0 + 28, sub, { cls: 'lab-sm lab-mid' }),
    ];
  };
  const hcN = hclust(P.slice(0, 60), { linkage: 'average' });
  const hcLab = cutTree(hcN, 3, 60);
  const hcFull = P.map((_, i) => (i < 60 ? hcLab[i] : hcLab[i % 60]));
  return [
    label('nh', 360, 62, 'uniform noise. no groups. no structure of any kind.', { cls: 'lab-big lab-mid lab-warm' }),
    label('nh2', 360, 84, 'here is what each method reports anyway.', { cls: 'lab-sm lab-mid' }),
    mk(38, 244, KM(N, 3, 0).labels, 'k-means, k = 3', `silhouette ${silAt(N, 3).toFixed(2)}`),
    mk(262, 468, hcFull, 'hierarchical, cut at 3', 'three tidy groups'),
    mk(486, 692, dbscan(P, { eps: 0.28, minPts: 4 }).labels, 'dbscan', 'the only one that hedges'),
    label('nf', 360, 372, 'a cluster is a finding when it survives on new data,', { cls: 'lab lab-mid lab-green' }),
    label('nf2', 360, 394, 'predicts something you did not cluster on,', { cls: 'lab lab-mid lab-green' }),
    label('nf3', 360, 416, 'or names a distinction someone can act on.', { cls: 'lab lab-mid lab-green' }),
    label('nf4', 360, 448, 'until then it is a picture.', { cls: 'lab-big lab-mid' }),
  ];
}
