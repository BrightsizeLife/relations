/* ─────────────────────────────────────────────────────────────────────────────
   factor.js — one unobserved cause behind several observed answers.

   The direct sequel to measurement & reliability. There, one indicator was a
   true score plus error. Here, several indicators share one true score, and
   the only trace of it is that they all agree with each other. Factor analysis
   is the arithmetic that turns that agreement back into the thing causing it.

   Every number on screen is computed from a simulated world whose true
   loadings are known, so the reader can check the recovery against the truth
   instead of taking it on faith.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import {
  jacobiEigen, faPrincipal, reproduce, residualMatrix, varimax,
  parallelEigen, corrOf, simulateItems,
} from '../core/factor.js';
import { frame, points, label, numLabel, path, rect, fnPath, arrowDefs } from '../core/plot.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sqrt, sub, sup, sumOver, paren, eq, minus, plus, times, op } from '../core/fx.js';

/* ── the simulated world ──────────────────────────────────────────────────── */

const ITEMS = [
  'I finish what I start',
  'I keep my things tidy',
  'I plan ahead',
  'I enjoy meeting new people',
  'I talk a lot at parties',
  'I make friends easily',
];
const SHORT = ['finish', 'tidy', 'plan', 'meet', 'talk', 'friends'];

/* item j's true loading on each of the two factors */
const TRUE2 = [[0.82, 0.06], [0.76, 0.0], [0.70, 0.10], [0.06, 0.80], [0.0, 0.74], [0.10, 0.69]];
const TRUE1 = [[0.85], [0.80], [0.75], [0.70], [0.60], [0.50]];

const COLS1 = simulateItems(TRUE1, { n: 400, seed: 9 });
const COLS2 = simulateItems(TRUE2, { n: 500, seed: 4 });
const NOISE = simulateItems(range(6).map(() => [0]), { n: 400, seed: 21 });

const R1 = corrOf(COLS1);
const R2 = corrOf(COLS2);
const RN = corrOf(NOISE);

const WORLD = s => (s.world === 'two' ? { R: R2, cols: COLS2, truth: TRUE2, n: 500 }
  : s.world === 'noise' ? { R: RN, cols: NOISE, truth: null, n: 400 }
    : { R: R1, cols: COLS1, truth: TRUE1, n: 400 });

const faCache = new Map();
const FA = (s, m = +s.m) => {
  const key = `${s.world}|${m}`;
  if (!faCache.has(key)) faCache.set(key, faPrincipal(WORLD(s).R, m));
  return faCache.get(key);
};
const rotCache = new Map();
const ROT = s => {
  const key = `${s.world}|${s.m}`;
  if (!rotCache.has(key)) rotCache.set(key, varimax(FA(s).loadings));
  return rotCache.get(key);
};
const L = s => (s.rotate ? ROT(s) : FA(s).loadings);

/** step 8 is about the two-factor world specifically, whatever step 6 left behind */
const TWO = s => ({ ...s, world: 'two', m: 2 });

/* The walk-through beats show unrotated, unrotated, rotated; only after that
   does the toggle take over. Readouts and scene read this same function, so
   the panel can never describe a picture that is not on screen. */
const rotAt = (s, ctx) =>
  (ctx && ctx.beat != null && ctx.beat < 3 ? ctx.beat === 2 : !!s.rotate);

const PARALLEL = parallelEigen(6, 400, { reps: 30 });

/* ── the matrix, drawn as a grid you can read ─────────────────────────────── */

function matGrid(key, M, {
  x0 = 120, y0 = 120, cell = 46, labels = SHORT, showDiag = true,
  fmt = v => (Math.abs(v) < 0.005 ? '·' : v.toFixed(2).replace(/^0\./, '.').replace(/^-0\./, '−.')),
  tone = 'warm', head = true, scale = 1, tip,
} = {}) {
  const out = [];
  const n = M.length;
  const shade = v => {
    const a = clamp(Math.abs(v) / scale, 0, 1);
    return v >= 0 ? `rgba(232,89,79,${(0.06 + 0.5 * a).toFixed(3)})`
      : `rgba(74,144,217,${(0.06 + 0.5 * a).toFixed(3)})`;
  };
  if (head) labels.forEach((lab, j) => {
    out.push(label(`${key}-ch-${j}`, x0 + j * cell + cell / 2, y0 - 10, lab, { cls: 'lab-sm lab-mid' }));
    out.push(label(`${key}-rh-${j}`, x0 - 8, y0 + j * cell + cell / 2 + 4, lab, { cls: 'lab-sm lab-end' }));
  });
  for (let i = 0; i < n; i++) for (let j = 0; j < M[i].length; j++) {
    const v = M[i][j];
    const dead = !showDiag && i === j;
    out.push({
      key: `${key}-c-${i}-${j}`, tag: 'rect', dur: 300,
      attrs: { x: x0 + j * cell, y: y0 + i * cell, width: cell - 2, height: cell - 2 },
      set: { fill: dead ? 'transparent' : shade(v), stroke: 'var(--cs-border-data)' },
      tip: tip ? tip(i, j, v) : `${labels[i] || i} × ${labels[j] || j}<br><b>${v.toFixed(3)}</b>`,
    });
    if (!dead) out.push(label(`${key}-t-${i}-${j}`, x0 + j * cell + (cell - 2) / 2, y0 + i * cell + cell / 2 + 4,
      fmt(v), { cls: 'lab-sm lab-mid' + (Math.abs(v) > 0.45 * scale ? ' lab-' + tone : ''), dur: 300 }));
  }
  return out;
}

/* ── formula pieces ───────────────────────────────────────────────────────── */

const fF = t('F', { explain: 'The factor: an unobserved variable, defined only by the fact that several items respond to it. Standardised to mean 0, sd 1, because its scale is arbitrary.', tone: 'gold', link: 'factor' });
const fL = t('λ', { explain: 'A loading: how much item j moves per one-sd move of the factor. A regression slope, in standardised units.', tone: 'cyan', link: 'load' });
const fU = t('u', { explain: 'The part of this item that is nothing to do with the factor — its own content plus its own measurement error.', tone: 'warm', link: 'uniq' });

export default {
  meta: {
    id: 'factor', title: 'factor analysis', short: 'factor analysis',
    kicker: 'ONE CAUSE, SIX ANSWERS', status: 'live',
    deck: 'Six questions on a survey, all correlated with each other. Either that is a coincidence six times over, or something they all respond to is doing it. Factor analysis is the arithmetic that turns the agreement between items back into an estimate of the thing causing it.',
    dataNote: 'Simulated from known loadings, so every recovered number can be checked against the value that generated it. The last option in the world selector has no factor in it at all.',
    deps: ['measurement', 'matrix'], unlocks: [],
    next: 'clustering', nextLabel: 'finding groups in data',
    outro: 'the arithmetic finds the structure. it does not name it, and it cannot tell you the name you chose was right.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { world: 'one', m: 1, lam: 0.8, item: 0, rotate: false, angle: 0 },

  steps: [

    /* ── 1 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'six questions that all agree',
      prose: `<p>A questionnaire. Six statements, four hundred people, each answering on a scale.</p>
        <p>Correlate every pair. Every single one comes out positive, and most come out moderate. People who finish what they start also tend to keep their things tidy, and also tend to plan ahead.</p>
        <p>That is fifteen correlations, all pointing the same way. Either that is a very long coincidence, or there is something all six questions are responding to.</p>`,
      dep: { note: 'each cell is one', lesson: 'correlation', label: "pearson's r" },
      beats: [
        { label: 'one pair', hold: 1400, note: 'Two of the six items, correlated. 0.66 — they agree, but they are not the same question.', scene: s => intro(s, 1) },
        { label: 'all fifteen', hold: 1700, note: 'Every pair. All positive, none of them 1, none of them 0.', scene: s => intro(s, 2) },
        { label: 'the pattern', note: 'The top-left corner is not brighter than the bottom-right for any reason to do with those particular questions. Every item agrees with every other item, by roughly the amount you would predict from how strongly each one agrees with the rest.', scene: s => intro(s, 3) },
      ],
    },

    /* ── 2 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'one explanation: they share a cause',
      prose: `<p>Here is the model, and it is the measurement model from the last lesson with one word changed.</p>
        <p>There, an observed score was a true score plus error. Here, the true score of every item is <em>the same unobserved variable</em>, scaled differently for each one. Call it <strong>F</strong>. Each item responds to it by an amount <strong>λ</strong>, and then adds its own private business <strong>u</strong> on top.</p>
        <p>F is not measured. It is not even defined independently of the items — it is whatever they have in common, given a name afterwards. Everything that makes this method powerful and everything that makes it dangerous comes from that sentence.</p>`,
      formula: formula(
        t('x', { tone: 'green' }) + sub('', 'j') + eq + fL + sub('', 'j') + fF + plus + fU + sub('', 'j') +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('compare:', { tone: 'muted', cls: 'fx-tiny' }) + op('&nbsp;') +
        t('X = T + E', { tone: 'muted' }),
        { caption: 'the true score of every item is the same F, wearing a different coefficient' }),
      dep: { note: 'this is X = T + E with a shared T — see', lesson: 'measurement', label: 'measurement & reliability' },
      beats: [
        { label: 'the six items', hold: 1200, note: 'Six observed things. This is all you have.', scene: s => pathDiagram(s, 1) },
        { label: 'one thing behind them', hold: 1500, note: 'A single unobserved variable, drawn as a circle because you never measure it. Squares are observed; circles are not — the standard notation, and worth knowing.', scene: s => pathDiagram(s, 2) },
        { label: 'the loadings', hold: 1600, note: 'One arrow per item, each with its own strength. That strength is the loading.', scene: s => pathDiagram(s, 3) },
        { label: 'and the leftovers', note: 'Each item also has its own private variance — the part that is nothing to do with F. That is the u, and it is exactly the E from the measurement lesson.', scene: s => pathDiagram(s, 4) },
      ],
    },

    /* ── 3 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'a loading is a regression slope',
      prose: `<p>λ has an ordinary meaning. Because both the factor and the item are standardised, λ is how many standard deviations the item moves for a one-standard-deviation move in the factor.</p>
        <p>Which makes it a regression slope, and — because both sides are standardised — also the correlation between the item and the factor.</p>
        <p>Here is the plot you can never draw in real life: the item against the factor. This world is simulated, so F is available. Pick an item and watch the cloud tighten as its loading rises.</p>`,
      formula: formula(
        fL + sub('', 'j') + eq + 'cor' + paren(t('x', { tone: 'green' }) + sub('', 'j') + ', ' + fF) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') +
        t('standardised slope = correlation', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'the same equality you met in linear regression, used in reverse' }),
      controls: [
        { type: 'slider', key: 'item', label: 'which item', min: 0, max: 5, step: 1, fast: true, fmt: v => SHORT[v] },
      ],
      readouts: [
        { key: 'i', label: 'item', get: s => ITEMS[+s.item], wide: true },
        { key: 'l', label: 'λ  (true)', tone: 'cyan', get: s => TRUE1[+s.item][0], d: 2 },
        { key: 'h', label: 'λ²  explained', tone: 'gold', get: s => TRUE1[+s.item][0] ** 2, d: 3, wide: true },
        { key: 'u', label: '1 − λ²  its own', tone: 'warm', get: s => 1 - TRUE1[+s.item][0] ** 2, d: 3, wide: true },
      ],
      beats: [
        { label: 'the strongest item', hold: 1500, note: '“I finish what I start”, against the factor. λ = 0.85 — a tight cloud.', scene: s => loadScatter({ ...s, item: 0 }) },
        { label: 'the weakest', hold: 1600, note: '“I make friends easily”, λ = 0.50. Same factor, much looser cloud — most of this item is not about F at all.', scene: s => loadScatter({ ...s, item: 5 }) },
        { label: 'your turn', note: 'Step through the items. The slope <em>is</em> the loading.', scene: s => loadScatter(s) },
      ],
    },

    /* ── 4 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'two items correlate because they share F',
      prose: `<p>Now the identity the whole method rests on, and it is one line of algebra.</p>
        <p>Item j is λ<sub>j</sub>F plus its own noise. Item k is λ<sub>k</sub>F plus <em>different</em> noise. Their covariance has four terms, three of which are zero for exactly the reasons you saw in the measurement lesson — noise does not correlate with the factor, and the two items' noises do not correlate with each other.</p>
        <p>What survives is <strong>λ<sub>j</sub>λ<sub>k</sub></strong>. Two items agree by exactly the product of how strongly each one responds to the thing behind them.</p>
        <p>Drag a loading and watch its whole row and column of the matrix move together.</p>`,
      formula: formula(
        'cor' + paren(t('x', { tone: 'green' }) + sub('', 'j') + ', ' + t('x', { tone: 'green' }) + sub('', 'k')) + eq +
        fL + sub('', 'j') + times + fL + sub('', 'k') + '<br>' +
        t('so a matrix of 15 correlations is produced by only 6 numbers', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'this over-determination is what makes the loadings recoverable' }),
      controls: [
        { type: 'slider', key: 'item', label: 'which item', min: 0, max: 5, step: 1, fast: true, fmt: v => SHORT[v] },
        { type: 'slider', key: 'lam', label: 'set its λ to', min: 0, max: 0.95, step: 0.01, fast: true, fmt: v => (+v).toFixed(2) },
      ],
      readouts: [
        { key: 'lj', label: 'λ of ' + 'this item', tone: 'cyan', get: s => +s.lam, d: 2, wide: true },
        { key: 'lk', label: 'λ of “tidy”', tone: 'purple', get: s => (+s.item === 1 ? +s.lam : TRUE1[1][0]), d: 2, wide: true },
        { key: 'r', label: 'so they correlate at', tone: 'green', get: s => (+s.item === 1 ? +s.lam : +s.lam * TRUE1[1][0]), d: 3, wide: true },
      ],
      beats: [
        { label: 'four terms', hold: 1700, note: 'Expand the covariance. Same four terms as the test–retest proof, same three reasons they vanish.', scene: s => product(s, 1) },
        { label: 'one survives', hold: 1600, note: 'λ<sub>j</sub>λ<sub>k</sub>. Nothing else.', scene: s => product(s, 2) },
        { label: 'the whole matrix', hold: 1700, note: 'Every cell is the product of two loadings. Fifteen numbers generated by six.', scene: s => product(s, 3) },
        { label: 'drag one', note: 'Move a single loading and a whole row and column respond. That constraint is what lets the arithmetic run backwards.', scene: s => product(s, 3) },
      ],
    },

    /* ── 5 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'communality: how much of an item is the factor',
      prose: `<p>Square the loading and you get the share of that item's variance the factor accounts for. It has a name — <strong>communality</strong>, h² — and it is the same quantity as reliability from the last lesson, with "the factor" playing the part of "the true score".</p>
        <p>What is left, 1 − h², is <strong>uniqueness</strong>: everything about the item that is not the factor. That includes measurement error, and it also includes whatever the item genuinely measures that nothing else on the questionnaire does.</p>
        <p>Those two are not separable from a single administration, which is a real limitation and rarely stated.</p>`,
      formula: formula(
        t('h', { tone: 'gold' }) + sup('', '2') + sub('', 'j') + eq + fL + sub('', 'j') + sup('', '2') +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('uniqueness', { tone: 'warm' }) + eq + '1' + minus + t('h', { tone: 'gold' }) + sup('', '2') + sub('', 'j') + '<br>' +
        t('the same split as reliability: signal share, and everything else', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'and every item has its own' }),
      beats: [
        { label: 'one item', hold: 1400, note: 'λ = 0.85, so 72% of this item is the factor and 28% is its own.', scene: s => commun(s, 1) },
        { label: 'all six', hold: 1700, note: 'The gold portion is the shared part. Notice how quickly it falls: a loading of 0.5 means the factor explains only a quarter of the item.', scene: s => commun(s, 2) },
        { label: 'what is in the grey', note: 'Measurement error <em>and</em> real content that nothing else on this questionnaire happens to ask about. One administration cannot tell you which.', scene: s => commun(s, 3) },
      ],
    },

    /* ── 6 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'running it backwards, without ever seeing F',
      prose: `<p>Everything so far went forwards: from loadings to correlations. In a real study you have the correlations and want the loadings, and F is unavailable for inspection.</p>
        <p>But the constraint from step 4 is strong. Fifteen observed correlations have to be reproduced by six unknowns, and that is enough to pin them down. Written as matrices, <em>R ≈ ΛΛ′</em>, and the leading eigenvector of R recovers Λ up to scale.</p>
        <p>Three matrices: what you observed, what the fitted loadings reproduce, and the difference. If the residuals are small, one factor was enough.</p>`,
      formula: formula(
        t('R', { tone: 'cyan' }) + eq + t('Λ', { tone: 'gold' }) + t('Λ', { tone: 'gold' }) + sup('', '′') + plus + t('Ψ', { tone: 'warm' }) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') +
        t('Ψ is diagonal: the uniquenesses, and nothing off the diagonal', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'the whole method, in one matrix equation' }),
      dep: { note: 'eigenvectors are the directions a matrix only stretches — see', lesson: 'matrix', label: 'matrix algebra' },
      controls: [
        { type: 'segment', key: 'world', label: 'world', options: [
          { value: 'one', label: 'one factor' }, { value: 'two', label: 'two factors' }, { value: 'noise', label: 'no factor' },
        ] },
        { type: 'slider', key: 'm', label: 'factors fitted', min: 1, max: 3, step: 1, fast: true },
      ],
      readouts: [
        { key: 'm', label: 'factors fitted', tone: 'gold', get: s => +s.m, d: 0 },
        { key: 'res', label: 'largest residual', tone: 'warm', get: s => Math.max(...residualMatrix(WORLD(s).R, FA(s).loadings).flat().map(Math.abs)), d: 4, wide: true },
        { key: 'exp', label: 'variance explained', tone: 'green', get: s => (st.sum(FA(s).communality) / 6) * 100, d: 1, suf: '%', wide: true },
      ],
      beats: [
        { label: 'what you observed', hold: 1400, note: 'The correlation matrix. This is the input, and the only input.', scene: s => recover(s, 1) },
        { label: 'what the fit reproduces', hold: 1600, note: 'Six loadings, multiplied out. Compare cell by cell.', scene: s => recover(s, 2) },
        { label: 'the difference', hold: 1700, note: 'Residuals. All under 0.05, which means one factor accounts for the entire pattern of agreement.', scene: s => recover(s, 3) },
        { label: 'recovered vs true', hold: 1800, note: 'And because this world was simulated, the recovered loadings can be checked against the ones that made the data. They agree to about two decimals.', scene: s => recover(s, 4) },
        { label: 'try a world with nothing in it', note: 'Switch to <b>no factor</b>. The method still returns loadings — it always does — but the observed matrix is nearly empty, so there is nothing for them to reproduce.', scene: s => recover(s, 4) },
      ],
    },

    /* ── 7 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'how many factors, and why the usual rule is wrong',
      prose: `<p>The eigenvalues of the correlation matrix say how much variance each successive factor accounts for. Plot them in order and you get a <strong>scree plot</strong> — named after the slope of loose rubble at the base of a cliff, which is what the uninformative factors look like.</p>
        <p>The rule everybody was taught is "keep eigenvalues above 1". It is wrong, and demonstrably so: with six items and four hundred people, <em>pure noise</em> produces a first eigenvalue of about 1.16. The rule would keep it.</p>
        <p><strong>Parallel analysis</strong> fixes it. Generate matrices of the same size from noise, average their eigenvalues, and keep only the factors that beat the noise line. That is the dashed line here, and it is the answer to this question.</p>`,
      controls: [
        { type: 'segment', key: 'world', label: 'world', options: [
          { value: 'one', label: 'one factor' }, { value: 'two', label: 'two factors' }, { value: 'noise', label: 'no factor' },
        ] },
      ],
      readouts: [
        { key: 'k1', label: 'kaiser rule keeps', tone: 'warm', get: s => jacobiEigen(WORLD(s).R).values.filter(v => v > 1).length, d: 0, wide: true, explain: 'Eigenvalues above 1. Keeps a factor from pure noise about half the time at this sample size.' },
        { key: 'pa', label: 'parallel analysis keeps', tone: 'green', get: s => jacobiEigen(WORLD(s).R).values.filter((v, i) => v > PARALLEL[i]).length, d: 0, wide: true },
        { key: 'e1', label: 'first eigenvalue', tone: 'gold', get: s => jacobiEigen(WORLD(s).R).values[0], d: 3, wide: true },
      ],
      beats: [
        { label: 'the scree', hold: 1600, note: 'Six eigenvalues, biggest first. One of them is much larger than the rest.', scene: s => scree(s, 1) },
        { label: 'the line at 1', hold: 1600, note: 'The rule everybody uses. Note where it falls.', scene: s => scree(s, 2) },
        { label: 'what noise does', hold: 1900, note: 'The dashed curve is the average eigenvalue from matrices of the same size built from pure noise. Its first value is <b>above 1</b> — so the Kaiser rule keeps factors that are not there.', scene: s => scree(s, 3) },
        { label: 'switch worlds', note: 'Try <b>no factor</b>. The Kaiser rule may still keep one. Parallel analysis keeps none.', scene: s => scree(s, 3) },
      ],
    },

    /* ── 8 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'with two factors the answer is not unique',
      prose: `<p>Here is a world with two factors — three items about being organised, three about being sociable — fitted with two.</p>
        <p>The raw solution is a mess. Every item loads on the first factor, because the eigen-decomposition puts as much as possible into it and lets the second mop up. Nothing about that is interpretable, and nothing about it is wrong either.</p>
        <p>Here is the awkward fact: <strong>any rotation of the axes fits exactly as well</strong>. The reproduced correlation matrix is identical to the last decimal place. So rotation is not a choice about the model — it is a choice about which of infinitely many equally good descriptions you would like to read.</p>
        <p>Varimax picks the one where each item loads on as few factors as possible. Turn it on.</p>`,
      formula: formula(
        t('Λ', { tone: 'gold' }) + t('Λ', { tone: 'gold' }) + sup('', '′') + eq +
        paren(t('Λ', { tone: 'gold' }) + t('T', { tone: 'cyan' })) + paren(t('Λ', { tone: 'gold' }) + t('T', { tone: 'cyan' })) + sup('', '′') +
        op('&nbsp;&nbsp;for any rotation&nbsp;') + t('T', { tone: 'cyan' }) + '<br>' +
        t('the fit cannot tell them apart. only you can.', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'rotational indeterminacy — the reason two papers can report different factors from the same data' }),
      controls: [
        { type: 'toggle', key: 'rotate', label: 'varimax rotation', explain: 'Rotate the axes so each item loads heavily on one factor and near zero on the others. Changes the description, not the fit.' },
      ],
      readouts: [
        { key: 'r', label: 'rotation', get: (s, c) => (rotAt(s, c) ? 'varimax' : 'none — raw eigenvectors'), wide: true },
        { key: 'fit', label: 'largest residual', tone: 'warm', get: (s, c) => Math.max(...residualMatrix(R2, L(TWO({ ...s, rotate: rotAt(s, c) }))).flat().map(Math.abs)), d: 5, wide: true, explain: 'Identical with and without rotation. That is the whole point.' },
        { key: 'cx', label: 'items loading on both', tone: 'gold', get: (s, c) => L(TWO({ ...s, rotate: rotAt(s, c) })).filter(r => r.filter(v => Math.abs(v) > 0.3).length > 1).length, d: 0, wide: true },
      ],
      beats: [
        { label: 'the raw solution', hold: 1800, note: 'Two factors, unrotated. Every item loads on the first one. This is a correct answer and a useless description.', scene: (s, c) => rotate(s, 1, c) },
        { label: 'as a picture', hold: 1700, note: 'Each item plotted by its two loadings. The cloud has obvious structure — it is just not aligned with the axes.', scene: (s, c) => rotate(s, 2, c) },
        { label: 'turn the axes', hold: 1900, note: 'Varimax spins the axes until each point sits near one of them. Nothing moved. The axes did.', scene: (s, c) => rotate(s, 2, c) },
        { label: 'the same fit', hold: 1900, note: 'Residuals before and after: identical to five decimal places. The data cannot distinguish these two answers, and no amount of data ever will.', scene: (s, c) => rotate(s, 3, c) },
        { label: 'your turn', note: 'Toggle the rotation and watch the loading table become readable while the fit number does not move.', scene: (s, c) => rotate(s, 3, c) },
      ],
    },

    /* ── 9 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'this is not principal components',
      prose: `<p>They get run by the same function in some software and they are not the same thing.</p>
        <p><strong>PCA</strong> puts ones down the diagonal of the correlation matrix and finds the directions of greatest total variance. Every component is a weighted sum of the items — a summary, computed from what you have, with no claim about causes.</p>
        <p><strong>Factor analysis</strong> puts communalities down that diagonal instead. It models only the part items share, deliberately leaving each item's own variance out, and posits a latent cause the items are effects of.</p>
        <p>The arrows point in opposite directions: in PCA the components are computed <em>from</em> the items; in factor analysis the items are caused <em>by</em> the factor. With high loadings the numbers barely differ. With modest ones, PCA inflates them.</p>`,
      controls: [
        { type: 'segment', key: 'world', label: 'world', options: [
          { value: 'one', label: 'one factor' }, { value: 'two', label: 'two factors' },
        ] },
      ],
      readouts: [
        { key: 'fa', label: 'FA mean loading', tone: 'gold', get: s => st.mean(FA({ ...s, m: 1 }).loadings.map(r => Math.abs(r[0]))), d: 3, wide: true },
        { key: 'pc', label: 'PCA mean loading', tone: 'cyan', get: s => st.mean(pcaLoad(s).map(Math.abs)), d: 3, wide: true },
        { key: 'd', label: 'inflation', tone: 'warm', get: s => st.mean(pcaLoad(s).map(Math.abs)) - st.mean(FA({ ...s, m: 1 }).loadings.map(r => Math.abs(r[0]))), d: 3, wide: true },
      ],
      beats: [
        { label: 'the diagonal', hold: 1700, note: 'One matrix, two diagonals. Ones for PCA; communalities for factor analysis. Everything else follows from that single choice.', scene: s => pcaVsFa(s, 1) },
        { label: 'the arrows', hold: 1700, note: 'PCA: items in, component out. Factor analysis: factor in, items out. These are different claims about the world.', scene: s => pcaVsFa(s, 2) },
        { label: 'the numbers', note: 'Side by side. PCA loadings are systematically larger, because each one is partly explaining that item’s own noise.', scene: s => pcaVsFa(s, 3) },
      ],
    },

    /* ── 10 ────────────────────────────────────────────────────────────────── */
    {
      title: 'the arithmetic will not name it for you',
      prose: `<p>Everything up to here was mechanical. What comes next is not, and pretending otherwise is where factor analysis earns its reputation.</p>
        <p>The method returns a column of numbers. Deciding that the column means "conscientiousness" is an act of interpretation performed by a person, on the basis of which items happen to load on it — and those items were chosen by a person too. A factor is only ever as good as the questions someone thought to ask.</p>
        <p>Three consequences worth carrying out of here.</p>`,
      beats: [
        {
          label: 'the three',
          scene: s => [
            label('h', 360, 66, 'what a factor is, and is not', { cls: 'lab-big lab-mid lab-gold' }),
            [
              ['it is a summary of what your items share',
                'not of the construct — of your items. leave out a facet and the factor',
                'silently does not contain it. the method cannot miss what was never asked.'],
              ['its name is a hypothesis, not a result',
                '"these six correlate, therefore conscientiousness exists" is not an inference.',
                'the correlations are the finding; the label is a proposal about them.'],
              ['it has to survive a second sample',
                'exploratory factor analysis will find structure in anything. the test is whether',
                'the same structure appears in data you did not use to find it.'],
            ].map(([a, b, c], i) => [
              rect('cr' + i, 60, 110 + i * 128, 600, 108, { cls: 'cell', delay: i * 160 }),
              label('ca' + i, 82, 142 + i * 128, a, { cls: 'lab-big lab-cyan', delay: i * 160 }),
              label('cb' + i, 82, 168 + i * 128, b, { cls: 'lab-sm', delay: i * 160 }),
              label('cc' + i, 82, 186 + i * 128, c, { cls: 'lab-sm', delay: i * 160 }),
            ]),
            label('f', 360, 512, 'the arithmetic is exact. the interpretation is yours, and it is the part that can be wrong.', { cls: 'lab lab-mid lab-green' }),
          ],
        },
      ],
    },
  ],
};

/* ── scenes ───────────────────────────────────────────────────────────────── */

function intro(s, phase) {
  if (phase === 1) {
    const f = frame({ w: 720, h: 540, l: 96, r: 250, t: 70, b: 92 });
    f.setX(-3.2, 3.2); f.setY(-3.2, 3.2);
    const a = COLS1[0], b = COLS1[1];
    return [
      { key: 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.sy(0), x2: f.x1, y2: f.sy(0) } },
      { key: 'ay', tag: 'line', cls: 'ax-line', attrs: { x1: f.sx(0), y1: f.y0, x2: f.sx(0), y2: f.y1 } },
      label('axl', (f.x0 + f.x1) / 2, f.y0 + 30, SHORT[0], { cls: 'ax-label' }),
      { key: 'ayl', tag: 'text', cls: 'ax-label', attrs: { x: 0, y: 0 }, set: { transform: `translate(${f.x0 - 26} ${(f.y0 + f.y1) / 2}) rotate(-90)` }, text: SHORT[1] },
      ...points(f, range(200), { key: 'p', r: 3, cls: 'pt pt-cyan', x: i => a[i], y: i => b[i], opacity: 0.6, stagger: 2 }),
      numLabel('rv', 486, 150, R1[0][1], { cls: 'lab-big lab-warm', d: 3, pre: 'r = ' }),
      label('rl', 486, 172, `“${ITEMS[0]}”`, { cls: 'lab-sm' }),
      label('rl2', 486, 188, `“${ITEMS[1]}”`, { cls: 'lab-sm' }),
      label('rl3', 486, 220, 'related, but plainly not', { cls: 'lab-sm lab-gold' }),
      label('rl4', 486, 236, 'the same question.', { cls: 'lab-sm lab-gold' }),
    ];
  }
  const M = R1.map((row, i) => row.map((v, j) => (i === j ? 1 : v)));
  return [
    ...matGrid('m', M, { x0: 176, y0: 132, cell: 52, showDiag: phase >= 3 }),
    label('t', 360, 84, phase >= 3 ? 'fifteen correlations, one pattern' : 'every pair, correlated', { cls: 'lab-big lab-mid lab-gold' }),
    phase >= 3 ? label('t2', 360, 476, 'red = positive. every single cell is red.', { cls: 'lab lab-mid lab-warm' }) : null,
    phase >= 3 ? label('t3', 360, 498, 'six questions cannot all agree by accident.', { cls: 'lab-sm lab-mid' }) : null,
  ].filter(Boolean);
}

function pathDiagram(s, phase) {
  const y = i => 108 + i * 62;
  const bx = 430, fx = 168, fy = 108 + 2.5 * 62;
  const out = [];

  ITEMS.forEach((it, i) => {
    out.push(
      rect(`b-${i}`, bx, y(i) - 20, 178, 40, { cls: 'cell', delay: i * 90 }),
      label(`bl-${i}`, bx + 10, y(i) + 4, it.length > 26 ? it.slice(0, 25) + '…' : it, { cls: 'lab-sm lab-cyan', delay: i * 90 }),
      label(`bs-${i}`, bx - 8, y(i) + 4, 'x' + (i + 1), { cls: 'lab-sm lab-end', delay: i * 90 }),
    );
  });

  if (phase >= 2) out.push(
    { key: 'fc', tag: 'circle', attrs: { cx: fx, cy: fy, r: 46 },
      set: { fill: 'rgba(245,166,35,.12)', stroke: 'var(--cs-data-gold)', 'stroke-width': 2 } },
    label('fl', fx, fy + 5, 'F', { cls: 'lab-big lab-mid lab-gold' }),
    label('fl2', fx, fy + 70, 'unobserved', { cls: 'lab-sm lab-mid lab-gold' }),
    label('fl3', fx, fy + 84, 'circle = never measured', { cls: 'lab-sm lab-mid' }),
  );

  if (phase >= 3) ITEMS.forEach((_, i) => {
    const lam = TRUE1[i][0];
    out.push(
      path(`ar-${i}`, [[fx + 46, fy], [bx - 34, y(i)]], {
        cls: 'arrow link-load', set: { 'stroke-width': 0.8 + lam * 3.2, stroke: 'var(--cs-cyan)' },
        delay: i * 90, tip: `λ = ${lam.toFixed(2)}`,
      }),
      numLabel(`al-${i}`, (fx + 46 + bx - 34) / 2, (fy + y(i)) / 2 - 5, lam, {
        cls: 'lab-sm lab-mid lab-cyan', d: 2, delay: i * 90,
      }));
  });

  if (phase >= 4) ITEMS.forEach((_, i) => {
    out.push(
      path(`ue-${i}`, [[688, y(i)], [bx + 182, y(i)]], { cls: 'arrow arrow-warm link-uniq', delay: i * 70 }),
      label(`ul-${i}`, 694, y(i) + 4, 'u', { cls: 'lab-sm lab-warm', delay: i * 70 }));
    out.push(label('uh', 620, 74, 'each item’s own', { cls: 'lab-sm lab-warm' }));
  });

  out.push(label('sq', bx + 89, 74, 'observed  ·  square = measured', { cls: 'lab-sm lab-mid lab-cyan' }));
  return out;
}

function loadScatter(s) {
  const i = clamp(+s.item, 0, 5);
  const lam = TRUE1[i][0];
  /* reconstruct the latent factor from the world that generated the items,
     which is possible here only because the world is a simulation */
  const f = frame({ w: 720, h: 540, l: 84, r: 246, t: 62, b: 92 });
  f.setX(-3.2, 3.2); f.setY(-3.4, 3.4);
  const F = st.zscores(COLS1.map((c, j) => c.map(v => v / TRUE1[j][0]))
    .reduce((a, c) => a.map((v, k) => v + c[k] / 6), new Array(COLS1[0].length).fill(0)));
  const y = COLS1[i];
  return [
    { key: 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.sy(0), x2: f.x1, y2: f.sy(0) } },
    { key: 'ay', tag: 'line', cls: 'ax-line', attrs: { x1: f.sx(0), y1: f.y0, x2: f.sx(0), y2: f.y1 } },
    label('axl', (f.x0 + f.x1) / 2, f.y0 + 30, 'F  ·  the factor (never observable)', { cls: 'ax-label' }),
    { key: 'ayl', tag: 'text', cls: 'ax-label', attrs: { x: 0, y: 0 }, set: { transform: `translate(${f.x0 - 28} ${(f.y0 + f.y1) / 2}) rotate(-90)` }, text: 'the item' },
    ...points(f, range(220), { key: 'p', r: 3.2, cls: 'pt pt-cyan', x: k => F[k], y: k => y[k], opacity: 0.55, stagger: 2 }),
    path('sl', [[f.sx(-3.2), f.sy(-3.2 * lam)], [f.sx(3.2), f.sy(3.2 * lam)]], { cls: 'curve curve-fit' }),
    label('ttl', 486, 116, `“${ITEMS[i]}”`, { cls: 'lab lab-cyan' }),
    numLabel('lv', 486, 160, lam, { cls: 'lab-big lab-cyan', d: 2, pre: 'λ = ' }),
    label('lv2', 486, 182, 'the slope of that line', { cls: 'lab-sm' }),
    numLabel('hv', 486, 224, lam * lam, { cls: 'lab-big lab-gold', d: 3, pre: 'λ² = ' }),
    label('hv2', 486, 246, 'share of the item that is F', { cls: 'lab-sm' }),
    numLabel('uv', 486, 288, 1 - lam * lam, { cls: 'lab-big lab-warm', d: 3, pre: '1−λ² = ' }),
    label('uv2', 486, 310, 'share that is its own', { cls: 'lab-sm' }),
  ];
}

function product(s, phase) {
  const i = clamp(+s.item, 0, 5);
  const lam = TRUE1.map((r, j) => (j === i ? +s.lam : r[0]));
  const M = lam.map((a, j) => lam.map((b, k) => (j === k ? 1 : a * b)));

  if (phase <= 2) {
    const rows = [
      { txt: 'cov(λⱼF, λₖF)  =  λⱼλₖ', why: 'both items respond to the same F', tone: 'gold', keep: true },
      { txt: 'cov(λⱼF, uₖ)  =  0', why: 'noise does not track the factor', tone: 'muted', keep: false },
      { txt: 'cov(uⱼ, λₖF)  =  0', why: 'the same, the other way round', tone: 'muted', keep: false },
      { txt: 'cov(uⱼ, uₖ)  =  0', why: 'the two items’ own parts are unrelated', tone: 'muted', keep: false },
    ];
    return [
      label('h', 360, 92, 'expand cor(xⱼ, xₖ)', { cls: 'lab-big lab-mid lab-gold' }),
      rows.map((r, k) => {
        const dead = phase >= 2 && !r.keep;
        const y = 148 + k * 74;
        return [
          rect('rc' + k, 132, y - 22, 456, 58, { cls: 'cell', opacity: dead ? 0.2 : 0.92, delay: k * 110 }),
          label('rt' + k, 150, y, r.txt, { cls: 'lab-big ' + (dead ? '' : 'lab-' + r.tone), opacity: dead ? 0.28 : 1, delay: k * 110 }),
          label('rw' + k, 150, y + 20, r.why, { cls: 'lab-sm', opacity: dead ? 0.24 : 1, delay: k * 110 }),
        ];
      }),
      phase >= 2 ? label('f', 360, 470, 'one term left: λⱼ × λₖ', { cls: 'lab-big lab-mid lab-green' }) : null,
    ].filter(Boolean);
  }

  return [
    ...matGrid('pm', M, { x0: 150, y0: 138, cell: 50, showDiag: false, scale: 1,
      tip: (a, b, v) => `${SHORT[a]} × ${SHORT[b]}<br>λ = ${lam[a].toFixed(2)} × ${lam[b].toFixed(2)}<br><b>${v.toFixed(3)}</b>` }),
    label('h', 360, 92, 'every cell is λⱼ × λₖ', { cls: 'lab-big lab-mid lab-gold' }),
    lam.map((v, j) => [
      rect('lb' + j, 150 + j * 50, 462, 48, 14, { cls: 'sq sq-dim' }),
      rect('lf' + j, 150 + j * 50, 462, 48 * v, 14, { cls: 'sq ' + (j === i ? 'sq-x' : 'sq-gold') }),
      numLabel('lv' + j, 150 + j * 50 + 24, 492, v, { cls: 'lab-sm lab-mid lab-' + (j === i ? 'cyan' : 'gold'), d: 2 }),
    ]),
    label('lh', 150, 452, 'λ for each item — drag one', { cls: 'lab-sm lab-gold' }),
  ];
}

function commun(s, phase) {
  const n = phase === 1 ? 1 : 6;
  const X0 = 130, W = 380, RH = 58;
  return [
    label('h', 360, 76, 'each item, split into shared and its own', { cls: 'lab-big lab-mid lab-gold' }),
    range(n).map(i => {
      const lam = TRUE1[i][0], h2 = lam * lam;
      const y = 124 + i * RH;
      return [
        label('nm' + i, X0 - 10, y + 20, SHORT[i], { cls: 'lab-sm lab-end', delay: i * 100 }),
        rect('bg' + i, X0, y, W, 30, { cls: 'sq sq-dim', delay: i * 100 }),
        rect('h2' + i, X0, y, W * h2, 30, { cls: 'sq sq-gold', delay: i * 100,
          tip: `${SHORT[i]}<br>λ = ${lam.toFixed(2)}<br>h² = ${h2.toFixed(3)}` }),
        numLabel('hv' + i, X0 + W + 12, y + 20, h2, { cls: 'lab lab-gold', d: 3, delay: i * 100 }),
        numLabel('uv' + i, X0 + W + 78, y + 20, 1 - h2, { cls: 'lab lab-warm', d: 3, delay: i * 100 }),
      ];
    }),
    label('c1', X0 + W + 12, 112, 'h²', { cls: 'lab-sm lab-gold' }),
    label('c2', X0 + W + 78, 112, '1 − h²', { cls: 'lab-sm lab-warm' }),
    phase >= 3 ? [
      label('g1', 360, 480, 'the grey holds two different things at once:', { cls: 'lab lab-mid lab-warm' }),
      label('g2', 360, 502, 'measurement error, and real content nothing else on the form asks about.', { cls: 'lab-sm lab-mid' }),
    ] : null,
  ].filter(Boolean);
}

function recover(s, phase) {
  const W = WORLD(s);
  const Ls = FA(s).loadings;
  const H = reproduce(Ls);
  const E = residualMatrix(W.R, Ls);
  const cell = 34;

  const out = [
    ...matGrid('o', W.R, { x0: 44, y0: 128, cell, showDiag: false, head: false }),
    label('oh', 44 + 3 * cell, 112, 'observed R', { cls: 'lab lab-mid lab-cyan' }),
  ];
  if (phase >= 2) out.push(
    ...matGrid('h', H, { x0: 268, y0: 128, cell, showDiag: false, head: false }),
    label('hh', 268 + 3 * cell, 112, 'reproduced ΛΛ′', { cls: 'lab lab-mid lab-gold' }));
  if (phase >= 3) out.push(
    ...matGrid('e', E, { x0: 492, y0: 128, cell, showDiag: false, head: false, scale: 0.2,
      fmt: v => (Math.abs(v) < 0.005 ? '·' : v.toFixed(2).replace(/^0\./, '.').replace(/^-0\./, '−.')) }),
    label('eh', 492 + 3 * cell, 112, 'what is left over', { cls: 'lab lab-mid lab-warm' }),
    numLabel('em', 492 + 3 * cell, 128 + 6 * cell + 22, Math.max(...E.flat().map(Math.abs)), {
      cls: 'lab lab-mid lab-warm', d: 4, pre: 'largest: ',
    }));

  if (phase >= 4) {
    const y0 = 380;
    out.push(
      label('lh', 60, y0 - 14, 'loadings', { cls: 'lab-sm lab-gold' }),
      label('lh2', 60, y0 + 6, 'recovered', { cls: 'lab-sm lab-cyan' }),
      W.truth ? label('lh3', 60, y0 + 26, 'true', { cls: 'lab-sm lab-muted' }) : null);
    Ls.forEach((row, i) => {
      const x = 176 + i * 78;
      out.push(
        label('ln' + i, x, y0 - 14, SHORT[i], { cls: 'lab-sm lab-mid' }),
        numLabel('lr' + i, x, y0 + 6, row[0], { cls: 'lab lab-mid lab-cyan', d: 3 }),
        W.truth ? numLabel('lt' + i, x, y0 + 26, W.truth[i][0], { cls: 'lab-sm lab-mid', d: 3 }) : null);
    });
    out.push(label('lf', 360, y0 + 62,
      W.truth ? 'recovered from fifteen correlations, with F never observed once.'
        : 'no factor in this world — and the method returned loadings anyway.',
      { cls: 'lab lab-mid ' + (W.truth ? 'lab-green' : 'lab-warm') }));
  }
  return out.filter(Boolean);
}

function scree(s, phase) {
  const ev = jacobiEigen(WORLD(s).R).values;
  const f = frame({ w: 720, h: 540, l: 86, r: 210, t: 76, b: 96 });
  f.setX(0.6, 6.4); f.setY(0, Math.max(3.6, ev[0] * 1.15));
  const out = [
    { key: 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x1, y2: f.y0 } },
    { key: 'ay', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x0, y2: f.y1 } },
    label('axl', (f.x0 + f.x1) / 2, f.y0 + 32, 'factor number', { cls: 'ax-label' }),
    { key: 'ayl', tag: 'text', cls: 'ax-label', attrs: { x: 0, y: 0 }, set: { transform: `translate(${f.x0 - 30} ${(f.y0 + f.y1) / 2}) rotate(-90)` }, text: 'eigenvalue' },
    ...range(6).map(i => label('xt' + i, f.sx(i + 1), f.y0 + 17, String(i + 1), { cls: 'ax-tick' })),
    ...[0, 1, 2, 3].map(v => label('yt' + v, f.x0 - 9, f.sy(v) + 4, String(v), { cls: 'ax-tick ax-tick-y' })),
    path('sc', ev.map((v, i) => [f.sx(i + 1), f.sy(v)]), { cls: 'curve curve-fit' }),
    ...ev.map((v, i) => ({
      key: 'sp' + i, tag: 'circle', cls: 'pt',
      attrs: { cx: f.sx(i + 1), cy: f.sy(v), r: 6 },
      set: { fill: v > PARALLEL[i] ? 'var(--cs-data-green)' : 'var(--cs-muted)', stroke: 'none' },
      tip: `factor ${i + 1}<br>eigenvalue ${v.toFixed(3)}<br>noise would give ${PARALLEL[i].toFixed(3)}`,
    })),
  ];
  if (phase >= 2) out.push(
    path('one', [[f.x0, f.sy(1)], [f.x1, f.sy(1)]], { cls: 'rule rule-gold rule-dash' }),
    label('onel', f.x1 - 4, f.sy(1) - 8, 'the “eigenvalue > 1” rule', { cls: 'lab-sm lab-end lab-gold' }));
  if (phase >= 3) out.push(
    path('pa', PARALLEL.map((v, i) => [f.sx(i + 1), f.sy(v)]), { cls: 'curve curve-warm curve-dash' }),
    label('pal', f.sx(3), f.sy(PARALLEL[2]) - 12, 'what pure noise gives', { cls: 'lab-sm lab-mid lab-warm' }),
    numLabel('pa1', 500, 130, PARALLEL[0], { cls: 'lab-big lab-warm', d: 3, pre: 'noise gives ' }),
    label('pa2', 500, 152, 'as its first eigenvalue —', { cls: 'lab-sm' }),
    label('pa3', 500, 166, 'above 1, so the rule keeps it.', { cls: 'lab-sm lab-warm' }),
    numLabel('pa4', 500, 208, ev.filter(v => v > 1).length, { cls: 'lab lab-gold', d: 0, pre: 'kaiser keeps ' }),
    numLabel('pa5', 500, 230, ev.filter((v, i) => v > PARALLEL[i]).length, { cls: 'lab lab-green', d: 0, pre: 'parallel keeps ' }),
    label('pa6', 500, 268, 'green dots beat the noise line.', { cls: 'lab-sm lab-green' }));
  return out;
}

function rotate(s, phase, ctx) {
  const S = TWO(s);
  const on = rotAt(s, ctx);
  const raw = FA(S, 2).loadings;
  const rot = varimax(raw);
  const cur = on ? rot : raw;

  const out = [
    label('h', 360, 74, on ? 'after varimax rotation' : 'raw eigenvector solution', {
      cls: 'lab-big lab-mid ' + (on ? 'lab-green' : 'lab-warm'),
    }),
  ];

  /* the loading table, always */
  const X0 = 66, RH = 42;
  out.push(
    label('c1', X0 + 150, 118, 'factor 1', { cls: 'lab-sm lab-mid lab-cyan' }),
    label('c2', X0 + 236, 118, 'factor 2', { cls: 'lab-sm lab-mid lab-purple' }));
  cur.forEach((row, i) => {
    const y = 142 + i * RH;
    out.push(
      label('n' + i, X0, y + 16, SHORT[i], { cls: 'lab-sm' }),
      ...row.map((v, k) => [
        rect(`cell-${i}-${k}`, X0 + 106 + k * 86, y, 78, 28, {
          cls: 'cell', dur: 320,
        }),
        rect(`bar-${i}-${k}`, X0 + 106 + k * 86, y, 78 * Math.min(Math.abs(v), 1), 28, {
          cls: 'sq ' + (k ? 'sq-y' : 'sq-x'), dur: 320, opacity: 0.8,
        }),
        numLabel(`nv-${i}-${k}`, X0 + 106 + k * 86 + 39, y + 19, v, {
          cls: 'lab-sm lab-mid' + (Math.abs(v) > 0.4 ? (k ? ' lab-purple' : ' lab-cyan') : ''), d: 2, dur: 320,
        }),
      ]).flat());
  });

  if (phase >= 2) {
    const f = frame({ w: 720, h: 540, l: 424, r: 44, t: 132, b: 156 });
    f.setX(-0.95, 0.95); f.setY(-0.95, 0.95);
    out.push(
      { key: 'px', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.sy(0), x2: f.x1, y2: f.sy(0) } },
      { key: 'py', tag: 'line', cls: 'ax-line', attrs: { x1: f.sx(0), y1: f.y0, x2: f.sx(0), y2: f.y1 } },
      label('pxl', (f.x0 + f.x1) / 2, f.y0 + 26, 'loading on factor 1', { cls: 'ax-label' }),
      ...cur.map((row, i) => ({
        key: 'pp' + i, tag: 'circle', cls: 'pt', dur: 420,
        attrs: { cx: f.sx(row[0]), cy: f.sy(row[1]), r: 6.5 },
        set: { fill: i < 3 ? 'var(--cs-cyan)' : 'var(--cs-purple)', stroke: 'none' },
        tip: `${SHORT[i]}<br>(${row[0].toFixed(2)}, ${row[1].toFixed(2)})`,
      })),
      ...cur.map((row, i) => label('pl' + i, f.sx(row[0]), f.sy(row[1]) + (i % 2 ? 20 : -12), SHORT[i], {
        cls: 'lab-sm lab-mid', dur: 420,
      })),
      label('pcap', (f.x0 + f.x1) / 2, f.y1 - 12, 'each item, by its two loadings', { cls: 'lab-sm lab-mid' }),
    );
  }

  if (phase >= 3) {
    const eRaw = Math.max(...residualMatrix(WORLD(S).R, raw).flat().map(Math.abs));
    const eRot = Math.max(...residualMatrix(WORLD(S).R, rot).flat().map(Math.abs));
    out.push(
      numLabel('f1', 424, 434, eRaw, { cls: 'lab lab-warm', d: 6, pre: 'unrotated residual: ' }),
      numLabel('f2', 424, 456, eRot, { cls: 'lab lab-green', d: 6, pre: 'rotated residual:  ' }),
      label('f3', 424, 486, 'identical. the data cannot tell', { cls: 'lab-sm lab-gold' }),
      label('f4', 424, 500, 'these two answers apart.', { cls: 'lab-sm lab-gold' }));
  }
  return out;
}

/** PCA loadings: the leading eigenvector of R with ones left on the diagonal */
function pcaLoad(s) {
  const e = jacobiEigen(WORLD(s).R);
  const v = e.vectors[0].map(x => x * Math.sqrt(Math.max(e.values[0], 0)));
  return st.sum(v) < 0 ? v.map(x => -x) : v;
}

function pcaVsFa(s, phase) {
  const R = WORLD(s).R;
  const fa = FA({ ...s, m: 1 });
  const out = [];

  if (phase === 1) {
    const pcaM = R.map((row, i) => row.map((v, j) => (i === j ? 1 : v)));
    const faM = R.map((row, i) => row.map((v, j) => (i === j ? fa.communality[i] : v)));
    return [
      label('h', 360, 74, 'the same matrix, two diagonals', { cls: 'lab-big lab-mid lab-gold' }),
      ...matGrid('p', pcaM, { x0: 62, y0: 148, cell: 40, head: false, tone: 'cyan' }),
      label('ph', 62 + 3 * 40, 132, 'PCA:  ones', { cls: 'lab lab-mid lab-cyan' }),
      label('ph2', 62 + 3 * 40, 148 + 6 * 40 + 24, 'explains each item’s whole variance,', { cls: 'lab-sm lab-mid' }),
      label('ph3', 62 + 3 * 40, 148 + 6 * 40 + 38, 'including its own noise', { cls: 'lab-sm lab-mid' }),
      ...matGrid('f', faM, { x0: 402, y0: 148, cell: 40, head: false, tone: 'gold' }),
      label('fh', 402 + 3 * 40, 132, 'FA:  communalities', { cls: 'lab lab-mid lab-gold' }),
      label('fh2', 402 + 3 * 40, 148 + 6 * 40 + 24, 'explains only the part the items', { cls: 'lab-sm lab-mid' }),
      label('fh3', 402 + 3 * 40, 148 + 6 * 40 + 38, 'have in common', { cls: 'lab-sm lab-mid' }),
    ];
  }

  if (phase === 2) {
    const y = i => 132 + i * 52;
    ITEMS.forEach((_, i) => out.push(
      rect('l' + i, 130, y(i) - 15, 90, 30, { cls: 'cell' }),
      label('ln' + i, 175, y(i) + 4, SHORT[i], { cls: 'lab-sm lab-mid lab-cyan' }),
      rect('r' + i, 500, y(i) - 15, 90, 30, { cls: 'cell' }),
      label('rn' + i, 545, y(i) + 4, SHORT[i], { cls: 'lab-sm lab-mid lab-cyan' }),
      path('la' + i, [[224, y(i)], [286, 288]], { cls: 'arrow', delay: i * 70 }),
      path('ra' + i, [[434, 288], [496, y(i)]], { cls: 'arrow arrow-warm', delay: i * 70 })));
    out.push(
      rect('pc', 250, 264, 76, 48, { cls: 'cell' }),
      label('pcl', 288, 292, 'PC', { cls: 'lab-big lab-mid lab-cyan' }),
      { key: 'fc', tag: 'circle', attrs: { cx: 396, cy: 288, r: 30 },
        set: { fill: 'rgba(245,166,35,.12)', stroke: 'var(--cs-data-gold)', 'stroke-width': 2 } },
      label('fcl', 396, 294, 'F', { cls: 'lab-big lab-mid lab-gold' }),
      label('h1', 288, 404, 'computed FROM the items', { cls: 'lab lab-mid lab-cyan' }),
      label('h2', 288, 424, 'a summary. no causal claim.', { cls: 'lab-sm lab-mid' }),
      label('h3', 396, 462, 'the items are caused BY it', { cls: 'lab lab-mid lab-gold' }),
      label('h4', 396, 482, 'a claim about the world.', { cls: 'lab-sm lab-mid' }));
    return out;
  }

  const pc = pcaLoad(s);
  const X0 = 130, W = 320;
  return [
    label('h', 360, 80, 'loadings, side by side', { cls: 'lab-big lab-mid lab-gold' }),
    label('c1', X0 + W + 20, 116, 'FA', { cls: 'lab-sm lab-gold' }),
    label('c2', X0 + W + 86, 116, 'PCA', { cls: 'lab-sm lab-cyan' }),
    ...range(6).map(i => {
      const y = 132 + i * 50;
      return [
        label('n' + i, X0 - 10, y + 20, SHORT[i], { cls: 'lab-sm lab-end' }),
        rect('bg' + i, X0, y, W, 14, { cls: 'sq sq-dim' }),
        rect('fa' + i, X0, y, W * Math.abs(fa.loadings[i][0]), 14, { cls: 'sq sq-gold' }),
        rect('bg2' + i, X0, y + 18, W, 14, { cls: 'sq sq-dim' }),
        rect('pc' + i, X0, y + 18, W * Math.abs(pc[i]), 14, { cls: 'sq sq-x' }),
        numLabel('fv' + i, X0 + W + 20, y + 12, Math.abs(fa.loadings[i][0]), { cls: 'lab-sm lab-gold', d: 3 }),
        numLabel('pv' + i, X0 + W + 86, y + 12, Math.abs(pc[i]), { cls: 'lab-sm lab-cyan', d: 3 }),
      ];
    }).flat(),
    label('f', 360, 462, 'PCA is larger on every item, because each component is also', { cls: 'lab lab-mid lab-cyan' }),
    label('f2', 360, 484, 'explaining that item’s own noise. the gap widens as loadings fall.', { cls: 'lab-sm lab-mid' }),
  ];
}
