/* ─────────────────────────────────────────────────────────────────────────────
   dags.js — drawing your assumptions, so they can be argued with.

   With three variables there are exactly three ways to wire them up, and every
   confusing result in observational research is one of the three being
   mistaken for another. The chain and the fork are the ones everybody knows.
   The collider is the one that does the damage.

   Every claim here is simulated from the diagram it is about, so "adjusting
   for a collider creates a correlation" is something you watch rather than
   something you are told.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { dag, SHAPES, pathBlocked, junction, isBackdoor, backdoorOK } from '../core/dag.js';
import { frame, points, label, numLabel, path, rect, fnPath, arrowDefs } from '../core/plot.js';
import { range, clamp, beatState } from '../core/dom.js';
import { formula, t, frac, sub, sup, paren, eq, minus, plus, times, op } from '../core/fx.js';

const NKEYS = ['chain', 'fork', 'collider'];
const SIM = Object.fromEntries(NKEYS.map(k => [k, SHAPES[k].d.simulate(1400, { seed: 7 })]));

/* the worked example: does the drug help, and what should you adjust for? */
const CLINIC = dag(
  [
    { id: 'age', x: 0, y: -1, label: 'age' },
    { id: 'sev', x: 1, y: -1, label: 'severity' },
    { id: 'drug', x: 0, y: 0.4, label: 'drug' },
    { id: 'bp', x: 1, y: 0.4, label: 'blood pressure', mediator: true },
    { id: 'rec', x: 2, y: 0.4, label: 'recovery' },
    { id: 'trial', x: 1.5, y: 1.5, label: 'in the trial', collider: true },
  ],
  [
    { from: 'age', to: 'drug', w: 0.8 }, { from: 'age', to: 'rec', w: -0.9 },
    { from: 'sev', to: 'drug', w: 0.9 }, { from: 'sev', to: 'rec', w: -1.0 },
    { from: 'drug', to: 'bp', w: 0.9 }, { from: 'bp', to: 'rec', w: 0.7 },
    { from: 'drug', to: 'rec', w: 0.5 },
    { from: 'drug', to: 'trial', w: 0.9 }, { from: 'rec', to: 'trial', w: 0.9 },
  ],
);
const CDATA = CLINIC.simulate(2500, { seed: 21 });
const TRUE_EFFECT = 0.5 + 0.9 * 0.7;   /* direct + through blood pressure */

/** the estimate of drug → recovery, adjusting for whatever you name */
const adjCache = new Map();
function estimate(given) {
  const key = given.slice().sort().join('|');
  if (adjCache.has(key)) return adjCache.get(key);
  let rows = range(CDATA.drug.length);
  const sel = given.includes('trial');
  if (sel) {
    const tr = CDATA.trial;
    const cut = st.quantile(tr, 0.5);
    rows = rows.filter(i => tr[i] > cut);
  }
  const covs = given.filter(g => g !== 'trial');
  const X = rows.map(i => [CDATA.drug[i], ...covs.map(c => CDATA[c][i])]);
  const y = rows.map(i => CDATA.rec[i]);
  const m = st.mlr(X, y);
  const out = { b: m ? m.beta[1] : NaN, n: rows.length, given: given.slice() };
  adjCache.set(key, out);
  return out;
}

/* ── drawing a diagram ────────────────────────────────────────────────────── */

function drawDag(d, {
  x0 = 120, x1 = 600, y0 = 130, y1 = 400, r = 32, key = 'g',
  given = [], hot = [], labels = true, small = false,
} = {}) {
  const xs = d.nodes.map(n => n.x), ys = d.nodes.map(n => n.y);
  const [lox, hix] = [Math.min(...xs), Math.max(...xs)];
  const [loy, hiy] = [Math.min(...ys), Math.max(...ys)];
  const px = n => (hix > lox ? x0 + ((n.x - lox) / (hix - lox)) * (x1 - x0) : (x0 + x1) / 2);
  const py = n => (hiy > loy ? y0 + ((n.y - loy) / (hiy - loy)) * (y1 - y0) : (y0 + y1) / 2);
  const out = [];

  d.edges.forEach((e, i) => {
    const a = d.byId[e.from], b = d.byId[e.to];
    const ax = px(a), ay = py(a), bx = px(b), by = py(b);
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    const pad = r + 6;
    const isHot = hot.includes(e.from + '>' + e.to);
    out.push(path(`${key}-e${i}`, [
      [ax + (dx / L) * pad, ay + (dy / L) * pad],
      [bx - (dx / L) * (pad + 4), by - (dy / L) * (pad + 4)],
    ], {
      cls: 'arrow' + (isHot ? ' arrow-warm' : ''),
      set: isHot ? { 'stroke-width': 2.6 } : { stroke: 'var(--cs-muted)' },
      dur: 300,
    }));
  });

  d.nodes.forEach(n => {
    const adj = given.includes(n.id);
    out.push({
      key: `${key}-n${n.id}`, tag: 'circle', dur: 300,
      attrs: { cx: px(n), cy: py(n), r },
      set: {
        fill: adj ? 'rgba(245,166,35,.22)' : 'var(--cs-bg-card, #16161c)',
        stroke: adj ? 'var(--cs-data-gold)' : 'var(--cs-border-data)',
        'stroke-width': adj ? 3 : 1.6,
      },
      tip: `${n.label || n.id}${adj ? '<br><b>adjusted for</b>' : ''}`,
    });
    if (labels) out.push(label(`${key}-l${n.id}`, px(n), py(n) + 4,
      small ? n.id : (n.label || n.id).slice(0, 9), {
      cls: (small ? 'lab' : 'lab-sm') + ' lab-mid' + (adj ? ' lab-gold' : ''), dur: 300,
    }));
    if (adj) out.push(rect(`${key}-b${n.id}`, px(n) - r - 6, py(n) - r - 6, (r + 6) * 2, (r + 6) * 2, {
      cls: 'cell', dur: 300, opacity: 0.001,
    }));
  });
  return out;
}

const B2 = beatState([{ shape: 'chain' }, { shape: 'fork' }, { shape: 'collider' }, null, null]);
const B3 = beatState([
  { shape: 'chain', given: true }, { shape: 'fork', given: true },
  { shape: 'collider', given: true }, { shape: 'collider', given: true }, null]);
const B4 = beatState([{ slice: 1 }, { slice: 0.5 }, { slice: 0.2 }, { slice: 0.05 }, null]);
const B5 = beatState([null, null, null]);
const B6 = beatState([null, { adj: 'none' }, { adj: 'conf' }, { adj: 'med' }, { adj: 'all' }, null]);

export default {
  meta: {
    id: 'dags', title: 'causal diagrams', short: 'dags',
    kicker: 'THREE SHAPES, AND ONLY THREE', status: 'live',
    deck: 'With three variables there are exactly three ways to wire them together, and almost every confusing result in observational research is one of them being mistaken for another. Two of the three are familiar. The third — where two causes meet — behaves in the opposite way to what everyone expects, and it is where the paradoxes come from.',
    dataNote: 'Every number is simulated from the diagram beside it, so a claim about what adjustment does is something you can watch happen rather than something to take on trust.',
    deps: ['causal', 'multiple'], unlocks: ['paradoxes'],
    next: 'paradoxes', nextLabel: 'paradoxes',
    outro: 'a diagram cannot tell you what causes what. it can tell you what follows if you are right, which is the only thing any method here has ever done.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { shape: 'fork', given: false, sel: 0, adj: 'none', slice: 0.5 },

  steps: [

    /* ── 1 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'an arrow means one thing makes another happen',
      prose: `<p>Two circles and an arrow. The arrow points from the cause to the effect, and it means something specific: <em>if you reached in and changed X, Y would change.</em></p>
        <p>The absence of an arrow is the stronger claim. Drawing no arrow from X to Y says you are confident there is <strong>no</strong> direct effect — and that is the assumption the whole method runs on. A diagram is not a summary of your data. It is a statement of what you believe, written down where somebody can disagree with it.</p>`,
      beats: [
        { label: 'two things', hold: 1200, note: 'Two variables. No claim yet.', scene: () => drawDag(dag([{ id: 'X', x: 0, y: 0 }, { id: 'Y', x: 1, y: 0 }], []), { x0: 250, x1: 470, y0: 262, y1: 262, r: 42, small: true }) },
        {
          label: 'an arrow', hold: 1600,
          note: 'X causes Y. Not "X predicts Y" and not "X correlates with Y" — <b>changing X would change Y</b>.',
          scene: () => [
            ...drawDag(dag([{ id: 'X', x: 0, y: 0 }, { id: 'Y', x: 1, y: 0 }], [{ from: 'X', to: 'Y' }]),
              { x0: 250, x1: 470, y0: 262, y1: 262, r: 42, small: true }),
            label('c', 360, 350, 'if you reached in and changed X, Y would change', { cls: 'lab lab-mid lab-gold' }),
          ],
        },
        {
          label: 'and the arrows you did not draw',
          note: 'Every missing arrow is a claim too, and usually a bolder one.',
          scene: () => [
            ...drawDag(dag([{ id: 'X', x: 0, y: 0 }, { id: 'Y', x: 1, y: 0 }], [{ from: 'X', to: 'Y' }]),
              { x0: 250, x1: 470, y0: 220, y1: 220, r: 42, small: true }),
            path('no', [[470, 300], [250, 300]], { cls: 'arrow', set: { stroke: 'var(--cs-dim)', 'stroke-dasharray': '4 4' } }),
            label('nol', 360, 322, 'no arrow this way: you are claiming Y does not cause X', { cls: 'lab-sm lab-mid' }),
            label('n2', 360, 378, 'and no third circle: you are claiming nothing causes both', { cls: 'lab-sm lab-mid' }),
            label('n3', 360, 420, 'a diagram is a set of assumptions, drawn where', { cls: 'lab lab-mid lab-green' }),
            label('n4', 360, 442, 'someone can point at one and say "no".', { cls: 'lab lab-mid lab-green' }),
          ],
        },
      ],
    },

    /* ── 2 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'three variables, three shapes, and that is the entire list',
      prose: `<p>Add a third circle and count the possibilities. Up to relabelling there are exactly three.</p>
        <p><strong>A chain</strong>: X → M → Y. X affects Y, through M. <strong>A fork</strong>: X ← C → Y. Something causes both. <strong>A collider</strong>: X → C ← Y. Two causes meeting at one effect.</p>
        <p>The first two produce a correlation between X and Y and the third does not. That much is intuitive. What happens when you <em>adjust</em> for the middle variable is not, and it is different in all three cases — including one where adjusting makes things strictly worse.</p>`,
      controls: [
        { type: 'segment', key: 'shape', label: 'shape', options: NKEYS.map(k => ({ value: k, label: SHAPES[k].label })) },
      ],
      readouts: [
        { key: 's', label: 'shape', get: (s, c) => SHAPES[B2(s, c).shape].story, wide: true },
        { key: 'r', label: 'r between X and Y', tone: 'cyan', get: (s, c) => st.pearson(SIM[B2(s, c).shape].X, SIM[B2(s, c).shape].Y), d: 3, wide: true },
        { key: 'j', label: 'the middle node is a', tone: 'gold', get: (s, c) => { const k = B2(s, c).shape; return junction(SHAPES[k].d, ['X', SHAPES[k].middle, 'Y'], 1); }, wide: true },
      ],
      beats: [
        { label: 'the chain', hold: 1700, note: 'X → M → Y. X and Y correlate, and the correlation is real — X genuinely affects Y.', scene: (s, c) => three(B2(s, c).shape, 0) },
        { label: 'the fork', hold: 1700, note: 'X ← C → Y. X and Y correlate, and the correlation is <em>not</em> a causal effect. This is confounding.', scene: (s, c) => three(B2(s, c).shape, 0) },
        { label: 'the collider', hold: 1800, note: 'X → C ← Y. X and Y do not correlate at all, because nothing connects them except an effect they share.', scene: (s, c) => three(B2(s, c).shape, 0) },
        { label: 'all three', hold: 1900, note: 'Two of these produce an association, one does not. Now the interesting part.', scene: () => threeUp(0) },
        { label: 'your turn', note: 'Switch shapes and read the correlation. So far, nothing surprising.', scene: (s, c) => three(B2(s, c).shape, 0) },
      ],
    },

    /* ── 3 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'now adjust for the middle one',
      prose: `<p>"Adjusting for" a variable means comparing only cases that match on it — holding it fixed, or putting it in the regression, which for these purposes is the same move.</p>
        <p>Watch what it does in each shape. In the <strong>chain</strong>, a real association vanishes: you have blocked the route the effect travels by. In the <strong>fork</strong>, a spurious association vanishes: exactly what you wanted. In the <strong>collider</strong>, an association <em>appears out of nothing</em>.</p>
        <p>That third case is not an artefact or a small-sample fluke. It is a structural fact, and it means "adjust for everything you measured" is not a conservative choice — it is a way of manufacturing findings.</p>`,
      controls: [
        { type: 'segment', key: 'shape', label: 'shape', options: NKEYS.map(k => ({ value: k, label: SHAPES[k].label })) },
        { type: 'toggle', key: 'given', label: 'adjust for the middle variable' },
      ],
      readouts: [
        { key: 'r', label: 'r between X and Y', tone: 'cyan', get: (s, c) => st.pearson(SIM[B3(s, c).shape].X, SIM[B3(s, c).shape].Y), d: 3, wide: true },
        { key: 'rc', label: 'r after adjusting', tone: 'warm', get: (s, c) => condR(B3(s, c).shape), d: 3, wide: true },
        { key: 'w', label: 'adjusting', tone: 'gold', get: (s, c) => SHAPES[B3(s, c).shape].adjustEffect, wide: true },
      ],
      beats: [
        { label: 'the chain, adjusted', hold: 1900, note: 'r falls to zero. X really does affect Y, and you have just hidden it by controlling for the thing it works through. This is the single commonest way to lose an effect you had.', scene: (s, c) => three(B3(s, c).shape, 1) },
        { label: 'the fork, adjusted', hold: 1800, note: 'r falls to zero, and here that is correct — there was never a causal effect, only a shared cause.', scene: (s, c) => three(B3(s, c).shape, 1) },
        { label: 'the collider, adjusted', hold: 2000, note: 'r goes from <b>0.00</b> to <b>−0.46</b>. Two variables that were genuinely unrelated are now strongly related, and nothing about the data was faked.', scene: (s, c) => three(B3(s, c).shape, 1) },
        { label: 'why', hold: 2000, note: 'Hold C fixed and X and Y have to trade off against each other to produce it. Learning one tells you about the other — <em>given</em> that they add up to the value you selected on.', scene: () => colliderWhy() },
        { label: 'your turn', note: 'Toggle the adjustment on each shape. Three shapes, three completely different consequences from the same action.', scene: (s, c) => three(B3(s, c).shape, B3(s, c).given ? 1 : 0) },
      ],
    },

    /* ── 4 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'the collider, slowly',
      prose: `<p>This one is worth a step of its own, because the intuition has to be built rather than stated.</p>
        <p>Two independent things, X and Y. A third thing, C, that both of them push up. Now look only at cases with a high C.</p>
        <p>Among those cases, a low X almost has to come with a high Y — otherwise C would not have been high enough to get in. The selection has forced a trade-off between two variables that had nothing to do with each other.</p>
        <p>Drag the selection and watch a correlation appear from nowhere.</p>`,
      formula: formula(
        t('X', { tone: 'cyan' }) + ' ⊥ ' + t('Y', { tone: 'purple' }) +
        op('&nbsp;&nbsp;but&nbsp;&nbsp;') +
        t('X', { tone: 'cyan' }) + ' ⊥̸ ' + t('Y', { tone: 'purple' }) + ' | ' + t('C', { tone: 'gold' }) +
        '<br>' + t('independent, until you condition on what they jointly cause', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'and the induced correlation is negative, always' }),
      controls: [
        { type: 'slider', key: 'slice', label: 'keep only the top …', min: 0.05, max: 1, step: 0.05, fast: true, fmt: v => (+v * 100).toFixed(0) + '%' },
      ],
      readouts: [
        { key: 'a', label: 'r in everyone', tone: 'muted', get: () => st.pearson(SIM.collider.X, SIM.collider.Y), d: 3, wide: true },
        { key: 'b', label: 'r in the selected', tone: 'warm', get: (s, c) => sliceR(+B4(s, c).slice), d: 3, wide: true },
        { key: 'n', label: 'cases kept', tone: 'cyan', get: (s, c) => Math.round(+B4(s, c).slice * SIM.collider.X.length), d: 0, wide: true },
      ],
      beats: [
        { label: 'everybody', hold: 1500, note: 'X against Y, all 1400 cases. A round cloud — no relationship, because there is none.', scene: (s, c) => slice(+B4(s, c).slice) },
        { label: 'the top half', hold: 1700, note: 'Keep only cases where C is above the median. The cloud has developed a tilt.', scene: (s, c) => slice(+B4(s, c).slice) },
        { label: 'the top fifth', hold: 1800, note: 'Tighter selection, stronger tilt. Nobody has changed a single number.', scene: (s, c) => slice(+B4(s, c).slice) },
        { label: 'the top twentieth', hold: 1900, note: 'A convincing negative relationship between two variables that were generated independently, in separate lines of code.', scene: (s, c) => slice(+B4(s, c).slice) },
        { label: 'your turn', note: 'Drag the selection back to 100% and watch it dissolve. The correlation is a property of who you looked at.', scene: (s, c) => slice(+B4(s, c).slice) },
      ],
      aside: `<p><strong>Where you have met this without knowing.</strong> Talent and looks appear negatively related among actors who get cast, because either one alone can get you cast. Test scores and interviews appear negatively related among admitted students, for the same reason. Two diseases appear related among hospital patients — that one is Berkson's paradox and it has its own name because it kept fooling people. Every one of these is the picture above.</p>`,
    },

    /* ── 5 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'one rule covers all three',
      prose: `<p>The three cases collapse into a single rule, and once you have it you never need to reason case by case again.</p>
        <p>Association flows along a path unless something blocks it. Two sentences say when:</p>
        <p><strong>A chain or a fork is open, and adjusting closes it.</strong> <strong>A collider is closed, and adjusting opens it.</strong></p>
        <p>That is <em>d-separation</em>, and it is the entire formal content of causal diagrams. Everything else is bookkeeping over paths.</p>`,
      formula: formula(
        t('chain / fork', { tone: 'cyan' }) + op(':&nbsp;open&nbsp;→&nbsp;') + t('adjust', { tone: 'gold' }) + op('&nbsp;→&nbsp;closed') + '<br>' +
        t('collider', { tone: 'warm' }) + op(':&nbsp;closed&nbsp;→&nbsp;') + t('adjust', { tone: 'gold' }) + op('&nbsp;→&nbsp;open'),
        { caption: 'the collider runs backwards, and that is the whole difficulty' }),
      controls: [
        { type: 'segment', key: 'shape', label: 'shape', options: NKEYS.map(k => ({ value: k, label: SHAPES[k].label })) },
        { type: 'toggle', key: 'given', label: 'adjust for the middle variable' },
      ],
      readouts: [
        { key: 'j', label: 'junction', tone: 'cyan', get: s => junction(SHAPES[s.shape].d, ['X', SHAPES[s.shape].middle, 'Y'], 1), wide: true },
        { key: 'b', label: 'the path is', tone: 'gold', get: s => (pathBlocked(SHAPES[s.shape].d, ['X', SHAPES[s.shape].middle, 'Y'], s.given ? [SHAPES[s.shape].middle] : []).blocked ? 'blocked' : 'open'), wide: true },
        { key: 'r', label: 'and so r is', tone: 'warm', get: s => (s.given ? condR(s.shape) : st.pearson(SIM[s.shape].X, SIM[s.shape].Y)), d: 3, wide: true },
      ],
      beats: [
        { label: 'the rule', hold: 2000, note: 'Two sentences, and they disagree with each other on purpose.', scene: () => rule() },
        { label: 'check it', hold: 1800, note: 'The verdict from the rule, and the correlation from the simulated data, side by side. They agree at every setting.', scene: s => ruleCheck(s) },
        { label: 'your turn', note: 'Toggle through all six combinations. The rule predicts the number every time.', scene: s => ruleCheck(s) },
      ],
    },

    /* ── 6 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'a real diagram, and what to put in the model',
      prose: `<p>A clinical question. Does the drug help people recover? Here is what somebody believes about the situation.</p>
        <p>Age and severity both affect who gets the drug and who recovers — those are <strong>forks</strong>, and they are why the raw comparison is untrustworthy. The drug works partly by lowering blood pressure — that is a <strong>chain</strong>, and blood pressure is on the route. And people ended up in the trial partly because they were on the drug and partly because they were doing well — that is a <strong>collider</strong>.</p>
        <p>The true total effect is <strong>${TRUE_EFFECT.toFixed(2)}</strong>. Click the variables to adjust for them and see what you get.</p>`,
      controls: [
        { type: 'segment', key: 'adj', label: 'adjust for', options: [
          { value: 'none', label: 'nothing', explain: 'The raw comparison. Age and severity are wide open.' },
          { value: 'conf', label: 'age + severity', explain: 'Block both backdoor paths, and nothing else. This is the right answer.' },
          { value: 'med', label: '+ blood pressure', explain: 'Also adjust for the mediator — which blocks part of the effect you are trying to measure.' },
          { value: 'all', label: 'everything measured', explain: 'Including the collider. The kitchen-sink approach.' },
        ] },
      ],
      readouts: [
        { key: 'tr', label: 'the true effect', tone: 'green', get: () => TRUE_EFFECT, d: 3, wide: true },
        { key: 'es', label: 'what you estimate', tone: 'warm', get: (s, c) => estimate(ADJ[B6(s, c).adj]).b, d: 3, wide: true },
        { key: 'er', label: 'off by', tone: 'gold', get: (s, c) => estimate(ADJ[B6(s, c).adj]).b - TRUE_EFFECT, d: 3, wide: true },
        { key: 'n', label: 'cases used', tone: 'cyan', get: (s, c) => estimate(ADJ[B6(s, c).adj]).n, d: 0, wide: true },
      ],
      beats: [
        { label: 'the diagram', hold: 1800, note: 'Six variables. Two forks, one chain, one collider — all three shapes, in one honest picture of a clinical situation.', scene: (s, c) => clinic(B6(s, c), 0) },
        { label: 'adjust for nothing', hold: 1800, note: 'The raw comparison. Sicker and older people got the drug, so it looks harmful. This is confounding, and it is the case everybody knows about.', scene: (s, c) => clinic(B6(s, c), 1) },
        { label: 'age and severity', hold: 1900, note: 'Both backdoor paths blocked and nothing else touched. Lands on the truth.', scene: (s, c) => clinic(B6(s, c), 1) },
        { label: 'also blood pressure', hold: 1900, note: 'Now you have blocked the route the drug works <em>through</em>. You are measuring only the direct effect and calling it the total.', scene: (s, c) => clinic(B6(s, c), 1) },
        { label: 'everything measured', hold: 2000, note: 'Adding the collider on top. Worse than adjusting for nothing at all — and the model output looks identically respectable.', scene: (s, c) => clinic(B6(s, c), 1) },
        { label: 'your turn', note: 'Cycle the four. Only one of them is right, and no diagnostic in your regression output distinguishes them.', scene: (s, c) => clinic(B6(s, c), 1) },
      ],
    },

    /* ── 7 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'the backdoor criterion, which is the whole procedure',
      prose: `<p>The recipe for choosing an adjustment set, and it is three lines.</p>
        <p><strong>One.</strong> List every path from treatment to outcome whose first arrow points <em>into</em> the treatment. Those are the back doors, and they carry association that is not effect.</p>
        <p><strong>Two.</strong> Choose variables that block every one of them, using the rule from step 5.</p>
        <p><strong>Three.</strong> Do not adjust for anything downstream of the treatment. Mediators are on the route; colliders open doors you had closed.</p>
        <p>Satisfy those and the adjusted association <em>is</em> the causal effect. Fail any of them and it is something else with no name.</p>`,
      controls: [
        { type: 'segment', key: 'adj', label: 'adjustment set', options: [
          { value: 'none', label: 'nothing' }, { value: 'conf', label: 'age + severity' },
          { value: 'med', label: '+ blood pressure' }, { value: 'all', label: 'everything' },
        ] },
      ],
      readouts: [
        { key: 'bd', label: 'backdoor paths', tone: 'muted', get: () => CLINIC.paths('drug', 'rec').filter(p => isBackdoor(CLINIC, p, 'drug')).length, d: 0, wide: true },
        { key: 'op', label: 'still open', tone: 'warm', get: s => backdoorOK(CLINIC, 'drug', 'rec', ADJ[s.adj].filter(x => x !== 'trial')).openBackdoors.length, d: 0, wide: true },
        { key: 'ds', label: 'descendants of the drug used', tone: 'cold', get: s => backdoorOK(CLINIC, 'drug', 'rec', ADJ[s.adj]).descendantsUsed.length, d: 0, wide: true },
        { key: 'ok', label: 'criterion satisfied', tone: 'green', get: s => (backdoorOK(CLINIC, 'drug', 'rec', ADJ[s.adj]).ok ? 'yes' : 'no'), wide: true },
      ],
      beats: [
        { label: 'every path', hold: 1900, note: 'All the routes between drug and recovery. The front door is the effect you want; the back doors are everything else.', scene: s => paths(s) },
        { label: 'which are open', hold: 1900, note: 'Given what you have adjusted for. Green is blocked; red is leaking association into your estimate.', scene: s => paths(s) },
        { label: 'the verdict', note: 'Change the adjustment set and watch the paths open and close. Only one set closes every back door without opening a new one.', scene: s => paths(s) },
      ],
    },

    /* ── 8 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'what a diagram cannot do for you',
      prose: `<p>Three honest limits, and none of them are small.</p>
        <p>A DAG does not <em>discover</em> anything. It is a way of writing down what you already believe, and its output is only as good as that belief. Two people with different diagrams will correctly derive different adjustment sets from the same dataset, and the data cannot referee.</p>
        <p>Nor can it be tested end to end. Some of its implications can — a diagram says certain variables must be independent given others, and you can go and check — but the arrows that matter most are usually the ones about unmeasured things, and those cannot be checked at all.</p>`,
      beats: [
        {
          label: 'the three limits',
          scene: () => [
            label('h', 360, 66, 'what it is, and what it is not', { cls: 'lab-big lab-mid lab-gold' }),
            [
              ['it does not find the arrows', 'you supply them. the method turns your assumptions into a correct adjustment set, and does nothing about whether they are true', 'warm'],
              ['it is mostly untestable', 'a diagram implies some conditional independences you can check. the arrows involving things you did not measure imply none', 'warm'],
              ['it is still worth drawing', 'because it forces you to state, before you run anything, which comparison you think is fair — and lets someone else point at an arrow and object', 'green'],
            ].map(([a, b, tone], i) => [
              rect('lr' + i, 54, 104 + i * 116, 612, 100, { cls: 'cell', delay: i * 170 }),
              label('la' + i, 76, 134 + i * 116, a, { cls: 'lab-big lab-' + tone, delay: i * 170 }),
              ...wrapAt(b, 62).map((ln, k) => label(`lb${i}-${k}`, 76, 158 + i * 116 + k * 17, ln, { cls: 'lab-sm', delay: i * 170 })),
            ]),
            label('f', 360, 476, 'which is exactly what every method on this site does:', { cls: 'lab lab-mid lab-green' }),
            label('f2', 360, 498, 'make an assumption legible, then follow it honestly.', { cls: 'lab lab-mid lab-green' }),
          ],
        },
      ],
    },
  ],
};

/* ── helpers ──────────────────────────────────────────────────────────────── */

const ADJ = {
  none: [], conf: ['age', 'sev'], med: ['age', 'sev', 'bp'], all: ['age', 'sev', 'bp', 'trial'],
};

function wrapAt(text, chars) {
  const words = String(text).split(/\s+/); const out = []; let cur = '';
  for (const w of words) {
    if (!cur.length) { cur = w; continue; }
    if ((cur + ' ' + w).length > chars) { out.push(cur); cur = w; } else cur += ' ' + w;
  }
  if (cur) out.push(cur);
  return out;
}

const condCache = new Map();
function condR(shape) {
  if (condCache.has(shape)) return condCache.get(shape);
  const c = SIM[shape], mid = c[SHAPES[shape].middle];
  const m = st.median(mid), sd = st.sd(mid);
  const idx = mid.map((v, i) => i).filter(i => Math.abs(mid[i] - m) < 0.35 * sd);
  const v = st.pearson(idx.map(i => c.X[i]), idx.map(i => c.Y[i]));
  condCache.set(shape, v);
  return v;
}

const sliceCache = new Map();
function sliceIdx(frac) {
  const k = frac.toFixed(2);
  if (!sliceCache.has(k)) {
    const c = SIM.collider.C;
    const cut = st.quantile(c, 1 - clamp(frac, 0.02, 1));
    sliceCache.set(k, c.map((v, i) => i).filter(i => c[i] >= cut));
  }
  return sliceCache.get(k);
}
const sliceR = frac => {
  const idx = sliceIdx(frac);
  return idx.length > 4 ? st.pearson(idx.map(i => SIM.collider.X[i]), idx.map(i => SIM.collider.Y[i])) : NaN;
};

function scatterOf(f, key, xs, ys, o = {}) {
  return xs.map((v, i) => ({
    key: `${key}-${i}`, tag: 'circle', cls: 'pt', dur: 300,
    attrs: { cx: f.sx(v), cy: f.sy(ys[i]), r: o.r ?? 2.6 },
    set: { fill: o.fill || 'var(--cs-cyan)', stroke: 'none' },
    opacity: o.opacity ?? 0.45,
  }));
}

function three(shape, adjusted) {
  const S = SHAPES[shape], c = SIM[shape];
  const mid = c[S.middle];
  const m = st.median(mid), sd = st.sd(mid);
  const keep = new Set(mid.map((v, i) => i).filter(i => Math.abs(mid[i] - m) < 0.35 * sd));
  const f = frame({ w: 720, h: 540, l: 400, r: 40, t: 220, b: 84 });
  f.setX(-3.6, 3.6); f.setY(-3.6, 3.6);
  const r = adjusted ? condR(shape) : st.pearson(c.X, c.Y);

  return [
    ...drawDag(S.d, { x0: 150, x1: 570, y0: 96, y1: 168, r: 34, small: true, given: adjusted ? [S.middle] : [] }),
    label('st', 360, 42, S.story, { cls: 'lab-big lab-mid lab-gold' }),
    label('sj', 360, 206, adjusted ? `adjusting for ${S.middle} — ${S.adjustEffect}` : `no adjustment`, {
      cls: 'lab lab-mid ' + (adjusted ? (shape === 'collider' ? 'lab-warm' : shape === 'chain' ? 'lab-warm' : 'lab-green') : ''),
    }),
    { key: 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.sy(0), x2: f.x1, y2: f.sy(0) } },
    { key: 'ay', tag: 'line', cls: 'ax-line', attrs: { x1: f.sx(0), y1: f.y0, x2: f.sx(0), y2: f.y1 } },
    label('axl', (f.x0 + f.x1) / 2, f.y0 + 26, 'X', { cls: 'ax-label' }),
    label('ayl', f.x0 - 18, (f.y0 + f.y1) / 2, 'Y', { cls: 'ax-label' }),
    ...scatterOf(f, 'p', c.X, c.Y, {
      fill: 'var(--cs-muted)', opacity: adjusted ? 0.12 : 0.4,
    }),
    ...(adjusted ? scatterOf(f, 'q', c.X.filter((v, i) => keep.has(i)), c.Y.filter((v, i) => keep.has(i)),
      { fill: 'var(--cs-data-warm)', opacity: 0.55, r: 3 }) : []),
    numLabel('rv', 100, 300, r, { cls: 'lab-big lab-' + (Math.abs(r) > 0.2 ? 'warm' : 'green'), d: 3, pre: 'r = ' }),
    label('rl', 100, 322, adjusted ? `among cases matched on ${S.middle}` : 'across everybody', { cls: 'lab-sm' }),
    label('rw', 100, 362, adjusted ? 'adjusted' : 'unadjusted', { cls: 'lab lab-gold' }),
    adjusted ? wrapAt({
      chain: 'a real effect, hidden. you blocked the route it travels along.',
      fork: 'a spurious association, removed. this is the case adjustment is for.',
      collider: 'an association that did not exist, manufactured by the act of adjusting.',
    }[shape], 30).map((ln, i) => label('rn' + i, 100, 396 + i * 18, ln, {
      cls: 'lab-sm lab-' + (shape === 'fork' ? 'green' : 'warm'),
    })) : null,
  ].flat().filter(Boolean);
}

function threeUp(adjusted) {
  const out = [label('h', 360, 44, 'three variables, three wirings, and that is the complete list', { cls: 'lab lab-mid lab-gold' })];
  NKEYS.forEach((k, i) => {
    const S = SHAPES[k], c = SIM[k];
    const y = 96 + i * 148;
    out.push(
      ...drawDag(S.d, { key: 'd' + i, x0: 108, x1: 300, y0: y + 20, y1: y + 56, r: 24, small: true, given: adjusted ? [S.middle] : [] }),
      label('t' + i, 360, y + 26, S.label, { cls: 'lab-big lab-cyan' }),
      label('s' + i, 360, y + 48, S.story, { cls: 'lab-sm' }),
      numLabel('r' + i, 620, y + 40, adjusted ? condR(k) : st.pearson(c.X, c.Y), {
        cls: 'lab-big lab-end lab-' + (Math.abs(adjusted ? condR(k) : st.pearson(c.X, c.Y)) > 0.2 ? 'warm' : 'green'),
        d: 3, pre: 'r = ',
      }),
      label('rl' + i, 620, y + 60, adjusted ? 'adjusted' : 'unadjusted', { cls: 'lab-sm lab-end' }),
    );
  });
  return out;
}

function colliderWhy() {
  const f = frame({ w: 720, h: 540, l: 96, r: 250, t: 116, b: 108 });
  f.setX(-3.4, 3.4); f.setY(-3.4, 3.4);
  const c = SIM.collider;
  const keep = new Set(sliceIdx(0.25));
  return [
    label('h', 360, 64, 'hold C fixed and X and Y have to trade off', { cls: 'lab-big lab-mid lab-gold' }),
    { key: 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.sy(0), x2: f.x1, y2: f.sy(0) } },
    { key: 'ay', tag: 'line', cls: 'ax-line', attrs: { x1: f.sx(0), y1: f.y0, x2: f.sx(0), y2: f.y1 } },
    label('axl', (f.x0 + f.x1) / 2, f.y0 + 28, 'X', { cls: 'ax-label' }),
    label('ayl', f.x0 - 20, (f.y0 + f.y1) / 2, 'Y', { cls: 'ax-label' }),
    ...scatterOf(f, 'p', c.X, c.Y, { fill: 'var(--cs-muted)', opacity: 0.14 }),
    ...scatterOf(f, 'q', c.X.filter((v, i) => keep.has(i)), c.Y.filter((v, i) => keep.has(i)),
      { fill: 'var(--cs-data-warm)', opacity: 0.6, r: 3 }),
    ...[1.4, 2.2, 3.0].map((k, i) => path('bl' + i, [[f.sx(-3.4), f.sy(k + 3.4)], [f.sx(3.4), f.sy(k - 3.4)]], {
      cls: 'curve curve-dash', set: { stroke: 'var(--cs-data-gold)', 'stroke-width': 1.2 }, opacity: 0.6,
    })),
    label('bll', f.sx(2.4), f.sy(-1.6), 'lines of constant C', { cls: 'lab-sm lab-gold' }),
    label('n1', 496, 152, 'C = X + Y + noise.', { cls: 'lab lab-gold' }),
    label('n2', 496, 186, 'so if C is high and X', { cls: 'lab-sm' }),
    label('n3', 496, 200, 'is low, Y has to be high', { cls: 'lab-sm' }),
    label('n4', 496, 214, '— or C could not have', { cls: 'lab-sm' }),
    label('n5', 496, 228, 'got that high.', { cls: 'lab-sm' }),
    label('n6', 496, 262, 'the selection forced a', { cls: 'lab-sm lab-warm' }),
    label('n7', 496, 276, 'trade-off between two', { cls: 'lab-sm lab-warm' }),
    label('n8', 496, 290, 'unrelated things.', { cls: 'lab-sm lab-warm' }),
    label('n9', 496, 330, 'nothing about the data', { cls: 'lab-sm' }),
    label('n10', 496, 344, 'was faked. the shape', { cls: 'lab-sm' }),
    label('n11', 496, 358, 'came from who you', { cls: 'lab-sm' }),
    label('n12', 496, 372, 'chose to look at.', { cls: 'lab-sm' }),
  ];
}

function slice(frac) {
  const c = SIM.collider;
  const keep = new Set(sliceIdx(frac));
  const f = frame({ w: 720, h: 540, l: 90, r: 244, t: 90, b: 96 });
  f.setX(-3.6, 3.6); f.setY(-3.6, 3.6);
  const r = sliceR(frac);
  return [
    ...drawDag(SHAPES.collider.d, { x0: 500, x1: 668, y0: 400, y1: 448, r: 20, small: true, given: ['C'] }),
    { key: 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.sy(0), x2: f.x1, y2: f.sy(0) } },
    { key: 'ay', tag: 'line', cls: 'ax-line', attrs: { x1: f.sx(0), y1: f.y0, x2: f.sx(0), y2: f.y1 } },
    label('axl', (f.x0 + f.x1) / 2, f.y0 + 28, 'X', { cls: 'ax-label' }),
    label('ayl', f.x0 - 20, (f.y0 + f.y1) / 2, 'Y', { cls: 'ax-label' }),
    ...scatterOf(f, 'p', c.X, c.Y, { fill: 'var(--cs-muted)', opacity: frac >= 0.99 ? 0.4 : 0.1 }),
    ...(frac < 0.99 ? scatterOf(f, 'q', c.X.filter((v, i) => keep.has(i)), c.Y.filter((v, i) => keep.has(i)),
      { fill: 'var(--cs-data-warm)', opacity: 0.6, r: 3.2 }) : []),
    frac < 0.99 && keep.size > 20 ? (() => {
      const xs = c.X.filter((v, i) => keep.has(i)), ys = c.Y.filter((v, i) => keep.has(i));
      const m = st.linreg(xs, ys);
      return path('fit', [[f.sx(-3.6), f.sy(m.b0 + m.b1 * -3.6)], [f.sx(3.6), f.sy(m.b0 + m.b1 * 3.6)]], { cls: 'curve curve-warm' });
    })() : null,
    numLabel('kv', 494, 130, frac * 100, { cls: 'lab-big lab-cyan', d: 0, pre: 'keeping the top ', suf: '%' }),
    label('kl', 494, 150, 'of C', { cls: 'lab-sm' }),
    numLabel('rv', 494, 196, r, { cls: 'lab-big lab-warm', d: 3, pre: 'r = ' }),
    label('rl', 494, 216, 'among the selected', { cls: 'lab-sm' }),
    numLabel('r0', 494, 254, st.pearson(c.X, c.Y), { cls: 'lab lab-green', d: 3, pre: 'r = ', suf: '  in everyone' }),
    label('n1', 494, 300, 'X and Y were generated', { cls: 'lab-sm' }),
    label('n2', 494, 314, 'independently.', { cls: 'lab-sm' }),
    label('n3', 494, 342, 'the relationship belongs', { cls: 'lab-sm lab-gold' }),
    label('n4', 494, 356, 'to the selection, not', { cls: 'lab-sm lab-gold' }),
    label('n5', 494, 370, 'to the variables.', { cls: 'lab-sm lab-gold' }),
  ].filter(Boolean);
}

function rule() {
  const rows = [
    { a: 'chain', b: 'X → M → Y', c: 'open', d: 'adjusting closes it', tone: 'cyan' },
    { a: 'fork', b: 'X ← C → Y', c: 'open', d: 'adjusting closes it', tone: 'cyan' },
    { a: 'collider', b: 'X → C ← Y', c: 'closed', d: 'adjusting OPENS it', tone: 'warm' },
  ];
  return [
    label('h', 360, 74, 'when does association flow along a path?', { cls: 'lab-big lab-mid lab-gold' }),
    label('c1', 200, 128, 'shape', { cls: 'lab-sm lab-mid' }),
    label('c2', 356, 128, 'by default', { cls: 'lab-sm lab-mid' }),
    label('c3', 540, 128, 'if you adjust for the middle', { cls: 'lab-sm lab-mid' }),
    ...rows.map((r, i) => {
      const y = 154 + i * 84;
      return [
        rect('rr' + i, 54, y, 612, 68, { cls: 'cell', delay: i * 180 }),
        label('ra' + i, 200, y + 28, r.a, { cls: 'lab-big lab-mid lab-' + r.tone, delay: i * 180 }),
        label('rb' + i, 200, y + 50, r.b, { cls: 'lab-sm lab-mid', delay: i * 180 }),
        label('rc' + i, 356, y + 40, r.c, { cls: 'lab-big lab-mid lab-' + (r.c === 'open' ? 'green' : 'muted'), delay: i * 180 }),
        label('rd' + i, 540, y + 40, r.d, { cls: 'lab lab-mid lab-' + r.tone, delay: i * 180 }),
      ];
    }).flat(),
    label('f', 360, 434, 'the collider runs backwards. that one line is the whole difficulty,', { cls: 'lab lab-mid lab-green' }),
    label('f2', 360, 456, 'and the reason "control for everything" is bad advice.', { cls: 'lab lab-mid lab-green' }),
  ];
}

function ruleCheck(s) {
  const S = SHAPES[s.shape];
  const given = s.given ? [S.middle] : [];
  const b = pathBlocked(S.d, ['X', S.middle, 'Y'], given);
  const r = s.given ? condR(s.shape) : st.pearson(SIM[s.shape].X, SIM[s.shape].Y);
  return [
    ...drawDag(S.d, { x0: 180, x1: 540, y0: 118, y1: 186, r: 36, small: true, given }),
    label('j', 360, 246, `the middle node is a ${junction(S.d, ['X', S.middle, 'Y'], 1)}`, { cls: 'lab-big lab-mid lab-cyan' }),
    label('g', 360, 274, s.given ? `and you are adjusting for ${S.middle}` : 'and you are adjusting for nothing', { cls: 'lab lab-mid' }),
    rect('c1', 96, 314, 244, 118, { cls: 'cell' }),
    label('l1', 218, 342, 'the rule says', { cls: 'lab-sm lab-mid lab-gold' }),
    label('v1', 218, 382, b.blocked ? 'blocked' : 'open', { cls: 'lab-big lab-mid lab-' + (b.blocked ? 'muted' : 'green') }),
    label('w1', 218, 408, b.blocked ? 'so r should be zero' : 'so r should not be', { cls: 'lab-sm lab-mid' }),
    rect('c2', 380, 314, 244, 118, { cls: 'cell' }),
    label('l2', 502, 342, 'the data says', { cls: 'lab-sm lab-mid lab-gold' }),
    numLabel('v2', 502, 384, r, { cls: 'lab-big lab-mid lab-' + (Math.abs(r) > 0.2 ? 'warm' : 'muted'), d: 3, pre: 'r = ' }),
    label('w2', 502, 408, Math.abs(r) < 0.08 ? 'essentially zero' : 'plainly not zero', { cls: 'lab-sm lab-mid' }),
    label('ag', 360, 472, (b.blocked === (Math.abs(r) < 0.08)) ? 'they agree.' : 'they disagree — which would mean the diagram is wrong.', {
      cls: 'lab lab-mid lab-green',
    }),
  ];
}

function clinic(s, phase) {
  const set = ADJ[s.adj] || [];
  const est = estimate(set);
  const out = [
    ...drawDag(CLINIC, { x0: 130, x1: 566, y0: 96, y1: 352, r: 36, given: set }),
    label('h', 360, 50, 'does the drug help?', { cls: 'lab-big lab-mid lab-gold' }),
    label('k1', 60, 462, 'gold ring = adjusted for', { cls: 'lab-sm lab-gold' }),
  ];
  if (phase >= 1) {
    const off = est.b - TRUE_EFFECT;
    out.push(
      rect('bar', 60, 396, 600, 40, { cls: 'cell' }),
      label('t1', 76, 420, 'true effect', { cls: 'lab-sm' }),
      numLabel('t2', 176, 421, TRUE_EFFECT, { cls: 'lab-big lab-green', d: 3 }),
      label('t3', 268, 420, 'you estimate', { cls: 'lab-sm' }),
      numLabel('t4', 380, 421, est.b, { cls: 'lab-big lab-' + (Math.abs(off) < 0.06 ? 'green' : 'warm'), d: 3 }),
      label('t5', 470, 420, 'off by', { cls: 'lab-sm' }),
      numLabel('t6', 540, 421, off, { cls: 'lab-big lab-' + (Math.abs(off) < 0.06 ? 'green' : 'warm'), d: 3 }),
      label('v', 360, 494, {
        none: 'confounded — older and sicker people got the drug, so it looks harmful',
        conf: 'correct. both backdoor paths blocked and nothing downstream touched.',
        med: 'you blocked the route the drug works through, and measured only what is left',
        all: 'a mediator blocked and a collider opened — worse than doing nothing',
      }[s.adj], { cls: 'lab lab-mid lab-' + (s.adj === 'conf' ? 'green' : 'warm') }));
  }
  return out;
}

function paths(s) {
  const set = (ADJ[s.adj] || []).filter(x => x !== 'trial');
  const all = CLINIC.paths('drug', 'rec');
  const back = all.filter(p => isBackdoor(CLINIC, p, 'drug'));
  const front = all.filter(p => !isBackdoor(CLINIC, p, 'drug'));
  const rows = [
    ...front.map(p => ({ p, kind: 'front' })),
    ...back.map(p => ({ p, kind: 'back' })),
  ].slice(0, 8);

  return [
    label('h', 360, 56, `drug → recovery · ${front.length} front door${front.length > 1 ? 's' : ''}, ${back.length} back`, { cls: 'lab-big lab-mid lab-gold' }),
    label('h2', 360, 78, 'a back door is a path whose first arrow points into the treatment', { cls: 'lab-sm lab-mid' }),
    ...rows.map((row, i) => {
      const y = 104 + i * 46;
      const blk = pathBlocked(CLINIC, row.p, set);
      const good = row.kind === 'front' ? !blk.blocked : blk.blocked;
      return [
        rect('pr' + i, 48, y, 624, 38, { cls: 'cell', opacity: 0.9, delay: i * 70 }),
        rect('pb' + i, 48, y, 4, 38, {
          cls: 'sq', set: { fill: good ? 'var(--cs-data-green)' : 'var(--cs-data-warm)', stroke: 'none' }, delay: i * 70,
        }),
        label('pt' + i, 66, y + 18, row.p.map(k => CLINIC.byId[k].label || k).join('  →  '), {
          cls: 'lab-sm lab-' + (row.kind === 'front' ? 'cyan' : 'muted'), delay: i * 70,
        }),
        label('pk' + i, 66, y + 32, row.kind === 'front' ? 'front door — the effect you want' : 'back door', {
          cls: 'lab-sm', delay: i * 70,
        }),
        label('pv' + i, 660, y + 24, blk.blocked ? 'blocked' : 'open', {
          cls: 'lab lab-end lab-' + (good ? 'green' : 'warm'), delay: i * 70,
        }),
      ];
    }).flat(),
    (() => {
      const v = backdoorOK(CLINIC, 'drug', 'rec', ADJ[s.adj] || []);
      return label('f', 360, 500, v.ok
        ? 'every back door closed, nothing downstream adjusted for. the criterion is satisfied.'
        : v.descendantsUsed.length ? 'you have adjusted for something the drug causes. the criterion fails.'
          : `${v.openBackdoors.length} back door${v.openBackdoors.length > 1 ? 's' : ''} still open.`,
      { cls: 'lab lab-mid lab-' + (v.ok ? 'green' : 'warm') });
    })(),
  ];
}
