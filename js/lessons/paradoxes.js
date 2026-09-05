/* ─────────────────────────────────────────────────────────────────────────────
   paradoxes.js — six results that feel impossible, and are not.

   None of these are quirks of arithmetic. Every one is a case where two
   different questions have two different correct answers, and the confusion
   comes from not having said which question was being asked. The diagrams from
   the previous lesson are how you say it.

   Real data where real data exists, simulation where the truth has to be
   knowable.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { dag, pathBlocked, junction } from '../core/dag.js';
import { frame, points, label, numLabel, path, rect, fnPath, arrowDefs } from '../core/plot.js';
import { range, clamp, beatState } from '../core/dom.js';
import { formula, t, frac, sub, sup, paren, eq, minus, plus, times, op } from '../core/fx.js';

/* ── 1. Berkeley, 1973 — the real numbers ─────────────────────────────────── */

const BERK = [
  { d: 'A', mA: 825, mY: 512, wA: 108, wY: 89 },
  { d: 'B', mA: 560, mY: 353, wA: 25, wY: 17 },
  { d: 'C', mA: 325, mY: 120, wA: 593, wY: 202 },
  { d: 'D', mA: 417, mY: 138, wA: 375, wY: 131 },
  { d: 'E', mA: 191, mY: 53, wA: 393, wY: 94 },
  { d: 'F', mA: 373, mY: 22, wA: 341, wY: 24 },
];
const BTOT = BERK.reduce((a, r) => ({
  mA: a.mA + r.mA, mY: a.mY + r.mY, wA: a.wA + r.wA, wY: a.wY + r.wY,
}), { mA: 0, mY: 0, wA: 0, wY: 0 });
const mRate = r => r.mY / r.mA, wRate = r => r.wY / r.wA;
const WOMEN_HIGHER = BERK.filter(r => wRate(r) > mRate(r)).length;

/* ── 2. regression to the mean ────────────────────────────────────────────── */

const PILOTS = (() => {
  const r = st.rng(1955), n = 240;
  const skill = range(n).map(() => st.randNorm(r, 0, 1));
  const t1 = skill.map(s => s + st.randNorm(r, 0, 1.2));
  const t2 = skill.map(s => s + st.randNorm(r, 0, 1.2));
  return { n, skill, t1, t2 };
})();
const tail = (frac, worst) => {
  const { t1, n } = PILOTS;
  const idx = t1.map((v, i) => i).sort((a, b) => t1[a] - t1[b]);
  const k = Math.max(2, Math.round(frac * n));
  return worst ? idx.slice(0, k) : idx.slice(-k);
};

/* ── 3. base rates ────────────────────────────────────────────────────────── */

const TEST = { prev: 0.001, sens: 0.99, spec: 0.95, pop: 100000 };
const testCounts = (prev = TEST.prev, sens = TEST.sens, spec = TEST.spec, N = TEST.pop) => {
  const ill = Math.round(N * prev), well = N - ill;
  const tp = Math.round(ill * sens), fn = ill - tp;
  const tn = Math.round(well * spec), fp = well - tn;
  return { ill, well, tp, fn, tn, fp, ppv: tp / Math.max(1, tp + fp), N };
};

/* ── 4. monty hall ────────────────────────────────────────────────────────── */

const MONTY = (() => {
  const r = st.rng(3), n = 3000;
  let stayWin = 0, switchWin = 0;
  for (let i = 0; i < n; i++) {
    const car = Math.floor(r() * 3);
    const pick = Math.floor(r() * 3);
    if (pick === car) stayWin++; else switchWin++;
  }
  return { n, stay: stayWin / n, swap: switchWin / n };
})();

/* ── 5. adjusting for baseline ────────────────────────────────────────────── */

const LORD = (() => {
  const r = st.rng(88), n = 240, RHO = 0.6;
  /* Two groups that already differed before anything happened, and a programme
     that does nothing to anybody. Within each group the second measurement
     regresses toward that group's own mean — which is what makes the two
     standard analyses disagree. */
  const rows = range(n).map(i => {
    const grp = i % 2;
    const m = grp ? 6 : 0;
    const base = st.randNorm(r, m, 4);
    const after = m + RHO * (base - m) + st.randNorm(r, 0, 3.2);
    return { grp, base, after, ch: after - base };
  });
  const g0 = rows.filter(x => !x.grp), g1 = rows.filter(x => x.grp);
  const changeDiff = st.mean(g1.map(x => x.ch)) - st.mean(g0.map(x => x.ch));
  const m = st.mlr(rows.map(x => [x.grp, x.base]), rows.map(x => x.after));
  return { rows, g0, g1, changeDiff, ancova: m.beta[1] };
})();

const B3 = beatState([{ frac: 1 }, { frac: 0.4 }, { frac: 0.4 }, { frac: 0.12 }, null]);
const B4 = beatState([{ frac: 0.15 }, { frac: 0.15, worst: true }, { frac: 0.15, worst: true }, { frac: 0.15, worst: false }, null]);
const B5 = beatState([{ prev: 1 }, { prev: 1 }, { prev: 1 }, { prev: 100 }, null]);
const B7 = beatState([null, { adj: 'change' }, { adj: 'ancova' }, { adj: 'ancova' }, null]);

export default {
  meta: {
    id: 'paradoxes', title: 'paradoxes', short: 'paradoxes',
    kicker: 'SIX RESULTS THAT FEEL IMPOSSIBLE', status: 'live',
    deck: 'A treatment that helps every subgroup and harms the population. Two independent diseases that predict each other. A punishment that works and a reward that does not, in a world where neither does anything. None of these are tricks — each one is two different questions with two different correct answers, and the confusion is entirely about which was asked.',
    dataNote: 'Berkeley 1973 is the real admissions table. The rest are simulated, because the point of each is that the answer you get differs from a truth you have to be able to see.',
    deps: ['dags', 'measurement'], unlocks: [],
    next: 'causal', nextLabel: 'causal estimands',
    outro: 'not one of these is a paradox. every one is a question that was never specified, answered twice.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { dept: 0, frac: 0.15, worst: true, prev: 1, adj: 'change', doors: 3, agg: false },

  steps: [

    /* ── 1 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'every department admitted women at a higher rate',
      prose: `<p>Berkeley, 1973. The university was accused of discriminating against women in graduate admissions, and the top-line numbers looked damning: <strong>${(100 * BTOT.mY / BTOT.mA).toFixed(0)}%</strong> of men admitted against <strong>${(100 * BTOT.wY / BTOT.wA).toFixed(0)}%</strong> of women.</p>
        <p>Then somebody looked department by department. In ${WOMEN_HIGHER} of the six largest departments, <em>women were admitted at a higher rate than men</em>.</p>
        <p>Both statements are true, of the same 4,526 applications, computed correctly. This is Simpson's paradox, and the numbers are real.</p>`,
      controls: [
        { type: 'toggle', key: 'agg', label: 'show the total instead' },
      ],
      readouts: [
        { key: 'm', label: 'men admitted', tone: 'cyan', get: () => (100 * BTOT.mY) / BTOT.mA, d: 1, suf: '%', wide: true },
        { key: 'w', label: 'women admitted', tone: 'purple', get: () => (100 * BTOT.wY) / BTOT.wA, d: 1, suf: '%', wide: true },
        { key: 'g', label: 'gap, overall', tone: 'warm', get: () => (100 * BTOT.mY) / BTOT.mA - (100 * BTOT.wY) / BTOT.wA, d: 1, suf: ' pts', wide: true },
        { key: 'd', label: 'departments favouring women', tone: 'green', get: () => `${WOMEN_HIGHER} of 6`, wide: true },
      ],
      beats: [
        { label: 'the headline', hold: 1700, note: 'Two bars. Forty-five percent against thirty. A gap of fifteen points across four and a half thousand applications.', scene: () => berkTotal() },
        { label: 'by department', hold: 1900, note: 'The same applications, split six ways. Look at the direction of each pair.', scene: () => berk(1) },
        { label: 'who applied where', hold: 1900, note: 'And the thing the headline hid: men applied overwhelmingly to A and B, which admitted about two thirds of everyone. Women applied to C through F, which admitted a quarter.', scene: () => berk(2) },
        { label: 'both at once', hold: 2000, note: 'Nothing was miscalculated. The aggregate is a weighted average, and the two groups had completely different weights.', scene: () => berk(3) },
      ],
    },

    /* ── 2 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'the diagram says which number you wanted',
      prose: `<p>So which figure is the right one? The data cannot tell you, and this is the part that matters.</p>
        <p>Draw it. Gender affects which department you apply to; department affects your chance of admission; and the question is whether there is also an arrow from gender straight to admission — a committee treating identical applicants differently.</p>
        <p>If <em>that</em> is your question, department sits on a different path and you must hold it fixed: the within-department numbers are the answer. If your question is instead "does the overall system produce fewer women", department is on the causal route from gender to outcome and adjusting for it hides exactly what you were asking about.</p>
        <p><strong>Same table, two questions, two correct answers.</strong> The paradox was never in the arithmetic.</p>`,
      formula: formula(
        t('gender', { tone: 'purple' }) + op('&nbsp;→&nbsp;') + t('department', { tone: 'gold' }) + op('&nbsp;→&nbsp;') + t('admission', { tone: 'cyan' }) + '<br>' +
        t('adjust for department', { tone: 'gold', cls: 'fx-tiny' }) + op('&nbsp;→ the committee question') +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') +
        t('do not', { tone: 'gold', cls: 'fx-tiny' }) + op('&nbsp;→ the system question'),
        { caption: 'a mediator. blocking it is right or wrong depending entirely on what you asked' }),
      dep: { note: 'a variable on the causal route is a', lesson: 'dags', label: 'chain' },
      beats: [
        { label: 'the diagram', hold: 1800, note: 'Three nodes. Department is a mediator: gender affects it, and it affects admission.', scene: () => simpsonDag(1) },
        { label: 'the committee question', hold: 1900, note: 'Is a woman treated worse than an identical man in the same department? Block the mediator — that is the within-department comparison, and the answer is no.', scene: () => simpsonDag(2) },
        { label: 'the system question', hold: 1900, note: 'Does the whole process admit fewer women? Do not block it — the department someone applies to is part of how the outcome happens. The answer is yes.', scene: () => simpsonDag(3) },
        { label: 'the general lesson', hold: 2000, note: 'Simpson’s paradox is not about small numbers or weighting. It is about a mediator, and about a question nobody wrote down.', scene: () => simpsonDag(4) },
      ],
    },

    /* ── 3 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'two unrelated things that predict each other',
      prose: `<p>Different shape, different paradox.</p>
        <p>Two conditions, entirely unrelated in the population — knowing somebody has one tells you nothing about the other. Now look only at hospital patients. Among <em>them</em>, the two are <strong>negatively</strong> associated, and strongly.</p>
        <p>Nothing changed about the diseases. Either one alone can get you admitted, so a patient who is in hospital and does not have the first probably has the second. The correlation belongs to the admission criterion.</p>
        <p>This is Berkson's paradox — a collider, and it is why every study conducted on a selected population needs to explain how the selection worked.</p>`,
      controls: [
        { type: 'slider', key: 'frac', label: 'how selective the admission is', min: 0.05, max: 1, step: 0.05, fast: true, fmt: v => 'top ' + (+v * 100).toFixed(0) + '%' },
      ],
      readouts: [
        { key: 'a', label: 'r in the population', tone: 'green', get: () => berkR(1), d: 3, wide: true },
        { key: 'b', label: 'r among the admitted', tone: 'warm', get: (s, c) => berkR(+B3(s, c).frac), d: 3, wide: true },
        { key: 'n', label: 'patients', tone: 'cyan', get: (s, c) => Math.round(+B3(s, c).frac * 1600), d: 0, wide: true },
      ],
      beats: [
        { label: 'everyone', hold: 1600, note: 'Sixteen hundred people. Two conditions, generated independently. No relationship, because there is none.', scene: (s, c) => berkson(+B3(s, c).frac) },
        { label: 'who gets admitted', hold: 1800, note: 'Either condition, if severe enough, gets you into hospital. The admitted are the upper-right band.', scene: (s, c) => berkson(+B3(s, c).frac, true) },
        { label: 'look only at patients', hold: 1900, note: 'Among the admitted the two conditions are strongly negatively associated. A doctor studying their own patients would find it, replicate it, and publish it.', scene: (s, c) => berkson(+B3(s, c).frac) },
        { label: 'tighter', hold: 1800, note: 'A more selective hospital produces a stronger spurious relationship.', scene: (s, c) => berkson(+B3(s, c).frac) },
        { label: 'your turn', note: 'Drag the selection back to everybody and watch it dissolve.', scene: (s, c) => berkson(+B3(s, c).frac) },
      ],
    },

    /* ── 4 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'punishment works and praise backfires, in a world where neither does anything',
      prose: `<p>An instructor watches trainee pilots. After an unusually bad landing he shouts; after an unusually good one he praises. He notices, reliably, that shouting is followed by improvement and praise is followed by decline. He concludes that criticism works.</p>
        <p>Here is a simulation where the shouting does <strong>nothing at all</strong>. Every pilot has a fixed skill; every landing is that skill plus noise. There is no feedback, no learning and no effect of any kind.</p>
        <p>Take the worst performers on the first attempt and they improve on the second. Take the best and they decline. Both, every time, with nothing happening in between.</p>
        <p>An unusually bad score needs bad luck as well as low skill. The luck does not repeat. That is the whole mechanism, and it is called <strong>regression to the mean</strong>.</p>`,
      dep: { note: 'an extreme observation is skill plus error — see', lesson: 'measurement', label: 'measurement & reliability' },
      controls: [
        { type: 'slider', key: 'frac', label: 'how extreme a group you pick', min: 0.05, max: 0.5, step: 0.05, fast: true, fmt: v => 'top/bottom ' + (+v * 100).toFixed(0) + '%' },
        { type: 'toggle', key: 'worst', label: 'the worst performers' },
      ],
      readouts: [
        { key: 'a', label: 'their first attempt', tone: 'warm', get: (s, c) => st.mean(tail(+B4(s, c).frac, !!B4(s, c).worst).map(i => PILOTS.t1[i])), d: 3, wide: true },
        { key: 'b', label: 'their second', tone: 'green', get: (s, c) => st.mean(tail(+B4(s, c).frac, !!B4(s, c).worst).map(i => PILOTS.t2[i])), d: 3, wide: true },
        { key: 'c', label: 'apparent effect', tone: 'gold', get: (s, c) => st.mean(tail(+B4(s, c).frac, !!B4(s, c).worst).map(i => PILOTS.t2[i] - PILOTS.t1[i])), d: 3, wide: true },
        { key: 'd', label: 'actual effect', tone: 'cyan', get: () => 0, d: 3, wide: true, explain: 'Exactly zero, by construction. The second attempt was generated with no reference to the first.' },
      ],
      beats: [
        { label: 'two attempts', hold: 1600, note: 'Every pilot, twice. Correlated, because skill is real — but far from perfectly, because landings are noisy.', scene: () => pilots(1) },
        { label: 'the worst on the first', hold: 1800, note: 'Take the bottom fifteen percent. They are low on skill <em>and</em> unlucky, and only one of those repeats.', scene: (s, c) => pilots(2, !!B4(s, c).worst, +B4(s, c).frac) },
        { label: 'shout at them', hold: 1900, note: 'Their second attempts. Substantially better, on average, and nothing was done.', scene: (s, c) => pilots(3, !!B4(s, c).worst, +B4(s, c).frac) },
        { label: 'now the best', hold: 1900, note: 'Praise the top fifteen percent and they decline by about as much. The instructor now has evidence for both halves of his theory.', scene: (s, c) => pilots(3, !!B4(s, c).worst, +B4(s, c).frac) },
        { label: 'your turn', note: 'The more extreme the group you select, the larger the effect you will appear to have.', scene: (s, c) => pilots(3, !!B4(s, c).worst, +B4(s, c).frac) },
      ],
      aside: `<p><strong>How to tell it apart from a real effect.</strong> Regression to the mean is exactly the size that unreliability predicts: the further from average you selected, and the noisier the measure, the bigger the bounce. A real effect does not care how extreme your group was. Which is why the fix is a control group selected the same way — both groups regress, and the difference between them is what you wanted.</p>`,
    },

    /* ── 5 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'a 99% accurate test, and a positive result that means almost nothing',
      prose: `<p>A disease affecting one person in a thousand. A test that catches 99% of the people who have it and correctly clears 95% of those who do not. You test positive.</p>
        <p>Almost everybody guesses your chance of being ill at somewhere around 95%. It is <strong>about two percent</strong>.</p>
        <p>The way to see it is to stop using percentages and count people. In a hundred thousand: 100 are ill, and 99 of them test positive. 99,900 are well, and 5% of those — <strong>4,995 people</strong> — test positive anyway. Nearly all the positives are the second group, because the second group is enormous.</p>`,
      formula: formula(
        'P' + paren('ill | positive') + eq + frac(
          t('true positives', { tone: 'green', cls: 'fx-tiny' }),
          t('true positives', { tone: 'green', cls: 'fx-tiny' }) + plus + t('false positives', { tone: 'warm', cls: 'fx-tiny' })) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('and the second term is where the population size lives', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'the accuracy of the test is not the accuracy of the result' }),
      controls: [
        { type: 'slider', key: 'prev', label: 'cases per thousand', min: 0.1, max: 200, step: 0.1, fast: true, fmt: v => (+v).toFixed(1) },
      ],
      readouts: [
        { key: 'p', label: 'prevalence', tone: 'muted', get: (s, c) => +B5(s, c).prev / 10, d: 2, suf: '%', wide: true },
        { key: 'tp', label: 'true positives', tone: 'green', get: (s, c) => testCounts(+B5(s, c).prev / 1000).tp, d: 0, wide: true },
        { key: 'fp', label: 'false positives', tone: 'warm', get: (s, c) => testCounts(+B5(s, c).prev / 1000).fp, d: 0, wide: true },
        { key: 'v', label: 'chance you are actually ill', tone: 'gold', get: (s, c) => testCounts(+B5(s, c).prev / 1000).ppv * 100, d: 1, suf: '%', wide: true },
      ],
      beats: [
        { label: 'a hundred thousand people', hold: 1500, note: 'Every square is a thousand people. One hundred of them have the disease — a tenth of one square.', scene: (s, c) => base(1, +B5(s, c).prev) },
        { label: 'test everybody', hold: 1800, note: 'Green: correctly caught. Red: healthy people the test flagged anyway. There are fifty times more red than green.', scene: (s, c) => base(2, +B5(s, c).prev) },
        { label: 'you are one of the positives', hold: 1900, note: 'Which pile are you in? Fifty times more likely the red one — and neither the test nor the lab report knows that.', scene: (s, c) => base(3, +B5(s, c).prev) },
        { label: 'a common disease', hold: 1800, note: 'Push the prevalence to a hundred per thousand and the same test becomes genuinely informative. Nothing about the test changed.', scene: (s, c) => base(3, +B5(s, c).prev) },
        { label: 'your turn', note: 'Drag the prevalence. The one number that decides what your result means is the one printed nowhere on it.', scene: (s, c) => base(3, +B5(s, c).prev) },
      ],
    },

    /* ── 6 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'monty hall, and why the host is a collider',
      prose: `<p>Three doors, a car behind one. You pick a door. The host — who knows where the car is — opens a different door to reveal a goat, and offers you the swap.</p>
        <p>Switching wins two times in three. This is the most argued-about result in probability, and the reason is that people model the host as a coin flip when he is nothing of the sort.</p>
        <p>Your first pick was right one time in three, and nothing the host does can change that: he always opens a goat door, whatever you picked. So the remaining two thirds, which used to be spread over two doors, are now concentrated on the one he did not open.</p>
        <p>Here is the causal reading. <strong>Which door the host opens depends on where the car is and on what you picked.</strong> That is a collider — and observing it, exactly as in the last lesson, creates information about the thing you could not see.</p>`,
      readouts: [
        { key: 's', label: 'stay wins', tone: 'muted', get: () => MONTY.stay * 100, d: 1, suf: '%', wide: true },
        { key: 'w', label: 'switch wins', tone: 'green', get: () => MONTY.swap * 100, d: 1, suf: '%', wide: true },
        { key: 'n', label: 'games simulated', tone: 'cyan', get: () => MONTY.n, d: 0, wide: true },
      ],
      beats: [
        { label: 'the three cases', hold: 1900, note: 'Enumerate. You picked door 1; the car is behind 1, 2 or 3 with equal chance. Follow the host in each row.', scene: () => monty(1) },
        { label: 'count them', hold: 1900, note: 'Staying wins in one row of three. Switching wins in two. That is the entire proof and it fits on this screen.', scene: () => monty(2) },
        { label: 'three thousand games', hold: 1800, note: 'Simulated rather than argued. 33.5% against 66.5%.', scene: () => monty(3) },
        { label: 'the diagram', hold: 2000, note: 'The door the host opens is caused by your pick <em>and</em> by the car’s position. Watching a collider tells you about its causes — which is the same mechanism that made two independent diseases correlate, used for good.', scene: () => monty(4) },
      ],
    },

    /* ── 7 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'two analysts, one dataset, opposite conclusions',
      prose: `<p>A programme is evaluated. The two groups differed before it started — one began higher.</p>
        <p>Analyst one computes <strong>change scores</strong>: after minus before, compared between groups. Finds no effect. Analyst two runs <strong>ANCOVA</strong>: outcome regressed on group with the baseline as a covariate. Finds a large, significant effect.</p>
        <p>Both are competently executed. Both are standard. They disagree, and in this simulation the programme does <em>nothing whatsoever</em> — so one of them is manufacturing a result.</p>
        <p>This is Lord's paradox, and once again the resolution is not statistical. Adjusting for the baseline asks "given two people who started at the same place, does group membership predict where they ended?" If groups were randomly assigned, that is the right question. If they were not — if starting higher is <em>part of what it means</em> to be in that group — the baseline is a collider-ish trap and the change score is closer to honest.</p>`,
      controls: [
        { type: 'segment', key: 'adj', label: 'analysis', options: [
          { value: 'change', label: 'change scores', explain: 'after − before, compared between groups.' },
          { value: 'ancova', label: 'ancova', explain: 'after regressed on group, adjusting for before.' },
        ] },
      ],
      readouts: [
        { key: 'tr', label: 'the true effect', tone: 'green', get: () => 0, d: 3, wide: true },
        { key: 'c', label: 'change scores say', tone: 'cyan', get: () => LORD.changeDiff, d: 3, wide: true },
        { key: 'a', label: 'ancova says', tone: 'warm', get: () => LORD.ancova, d: 3, wide: true },
        { key: 'sh', label: 'the analysis on screen', get: (s, c) => (B7(s, c).adj === 'ancova' ? 'ancova' : 'change scores'), wide: true },
        { key: 'g', label: 'baseline gap', tone: 'muted', get: () => st.mean(LORD.g1.map(x => x.base)) - st.mean(LORD.g0.map(x => x.base)), d: 2, wide: true },
      ],
      beats: [
        { label: 'the data', hold: 1700, note: 'Before across, after up. Two groups, one starting higher. The programme was applied to the higher one.', scene: () => lord(1) },
        { label: 'change scores', hold: 1800, note: 'Everyone moved about the same amount. No difference between groups — which is correct, because nothing was done.', scene: () => lord(2) },
        { label: 'ancova', hold: 1900, note: 'Compare people who started at the same place, and a large group difference appears. Same data, competent method, and the effect is not there.', scene: () => lord(3) },
        { label: 'why they differ', hold: 2000, note: 'Matching on baseline compares a lucky-low member of the high group with an unlucky-high member of the low group — and both of them regress toward their own group’s mean.', scene: () => lord(4) },
        { label: 'your turn', note: 'Switch between them. The data cannot choose; only a claim about how people ended up in the groups can.', scene: (s, c) => lord(B7(s, c).adj === 'ancova' ? 3 : 2) },
      ],
    },

    /* ── 8 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'six costumes, two mechanisms',
      prose: `<p>Line them up and there are only two things going on.</p>
        <p><strong>You conditioned on the wrong variable.</strong> A mediator, and you hid a real effect. A collider, and you invented one. That is Simpson, Berkson, Monty Hall and Lord.</p>
        <p><strong>You compared groups that were selected differently.</strong> Extreme scores contain luck that does not repeat; a rare condition is swamped by a common error. That is regression to the mean and the base rate.</p>
        <p>Neither is a failure of arithmetic, and no amount of extra data fixes either. What fixes them is stating the question — and a diagram is how you state it in a form somebody else can check.</p>`,
      beats: [
        {
          label: 'the table', hold: 2200,
          scene: () => [
            label('h', 360, 58, 'what was actually going wrong', { cls: 'lab-big lab-mid lab-gold' }),
            [
              ['simpson', 'a mediator, aggregated over', 'conditioning', 'cyan'],
              ['berkson', 'a collider, selected on', 'conditioning', 'warm'],
              ['monty hall', 'a collider, observed — usefully', 'conditioning', 'green'],
              ["lord's paradox", 'a baseline that is part of the group', 'conditioning', 'warm'],
              ['regression to the mean', 'selecting on a noisy measure', 'selection', 'purple'],
              ['base rate', 'a rare truth against a common error', 'selection', 'purple'],
            ].map(([a, b, c, tone], i) => {
              const y = 90 + i * 62;
              return [
                rect('r' + i, 48, y, 624, 52, { cls: 'cell', delay: i * 110 }),
                rect('rb' + i, 48, y, 4, 52, { cls: 'sq', set: { fill: `var(--cs-${tone === 'cyan' ? 'cyan' : tone === 'warm' ? 'data-warm' : tone === 'green' ? 'data-green' : 'purple'})`, stroke: 'none' }, delay: i * 110 }),
                label('ra' + i, 68, y + 22, a, { cls: 'lab-big lab-' + tone, delay: i * 110 }),
                label('rb2' + i, 68, y + 40, b, { cls: 'lab-sm', delay: i * 110 }),
                label('rc' + i, 656, y + 32, c, { cls: 'lab lab-end lab-gold', delay: i * 110 }),
              ];
            }),
            label('f', 360, 496, 'two mechanisms. six famous names. none of them arithmetic.', { cls: 'lab lab-mid lab-green' }),
          ],
        },
        {
          label: 'the questions to ask',
          note: 'In order, before running anything.',
          scene: () => [
            label('h', 360, 62, 'four questions that prevent all six', { cls: 'lab-big lab-mid lab-gold' }),
            [
              ['what exactly am I asking?', 'the committee question or the system question. write it down before you choose a model'],
              ['is this variable on the route?', 'if the treatment causes it, adjusting for it removes part of the effect you are measuring'],
              ['do two things cause this variable?', 'then conditioning on it will relate them, whether or not they are related'],
              ['how did these cases get into my data?', 'selection is conditioning. anyone who is here for a reason is a collider you have already adjusted for'],
            ].map(([a, b], i) => [
              rect('q' + i, 54, 100 + i * 96, 612, 80, { cls: 'cell', delay: i * 150 }),
              label('qa' + i, 76, 130 + i * 96, `${i + 1}. ${a}`, { cls: 'lab-big lab-cyan', delay: i * 150 }),
              ...wrapAt(b, 66).map((ln, k) => label(`qb${i}-${k}`, 76, 152 + i * 96 + k * 17, ln, { cls: 'lab-sm', delay: i * 150 })),
            ]),
            label('f', 360, 500, 'the fourth one catches more published errors than the other three together.', { cls: 'lab lab-mid lab-green' }),
          ],
        },
      ],
    },
  ],
};

/* ── helpers ──────────────────────────────────────────────────────────────── */

function wrapAt(text, chars) {
  const words = String(text).split(/\s+/); const out = []; let cur = '';
  for (const w of words) {
    if (!cur.length) { cur = w; continue; }
    if ((cur + ' ' + w).length > chars) { out.push(cur); cur = w; } else cur += ' ' + w;
  }
  if (cur) out.push(cur);
  return out;
}

function berkTotal() {
  const X0 = 200, W = 340, Y = 180;
  const m = BTOT.mY / BTOT.mA, w = BTOT.wY / BTOT.wA;
  return [
    label('h', 360, 84, 'berkeley graduate admissions, 1973', { cls: 'lab-big lab-mid lab-gold' }),
    label('h2', 360, 106, `${(BTOT.mA + BTOT.wA).toLocaleString()} applications to the six largest departments`, { cls: 'lab-sm lab-mid' }),
    rect('mb', X0, Y, W, 44, { cls: 'sq sq-dim' }),
    rect('mf', X0, Y, W * m, 44, { cls: 'sq sq-x' }),
    label('ml', X0 - 12, Y + 28, 'men', { cls: 'lab-big lab-end lab-cyan' }),
    numLabel('mv', X0 + W + 14, Y + 28, m * 100, { cls: 'lab-big lab-cyan', d: 1, suf: '%' }),
    numLabel('mn', X0 + 12, Y + 28, BTOT.mA, { cls: 'lab-sm', d: 0, suf: ' applied' }),
    rect('wb', X0, Y + 80, W, 44, { cls: 'sq sq-dim' }),
    rect('wf', X0, Y + 80, W * w, 44, { cls: 'sq sq-y' }),
    label('wl', X0 - 12, Y + 108, 'women', { cls: 'lab-big lab-end lab-purple' }),
    numLabel('wv', X0 + W + 14, Y + 108, w * 100, { cls: 'lab-big lab-purple', d: 1, suf: '%' }),
    numLabel('wn', X0 + 12, Y + 108, BTOT.wA, { cls: 'lab-sm', d: 0, suf: ' applied' }),
    numLabel('g', 360, 372, (m - w) * 100, { cls: 'lab-big lab-mid lab-warm', d: 1, pre: 'a gap of ', suf: ' points' }),
    label('gl', 360, 396, 'this is the number that made the news', { cls: 'lab-sm lab-mid' }),
  ];
}

function berk(phase) {
  const X0 = 178, W = 240, RH = 52, Y0 = 106;
  const out = [
    label('h', 360, 62, 'the same applications, department by department', { cls: 'lab lab-mid lab-gold' }),
    label('c1', X0 - 90, Y0 - 14, 'dept', { cls: 'lab-sm' }),
    label('c2', X0 + W / 2, Y0 - 14, 'admitted', { cls: 'lab-sm lab-mid' }),
    phase >= 2 ? label('c3', 560, Y0 - 14, 'who applied', { cls: 'lab-sm lab-mid' }) : null,
  ];
  BERK.forEach((r, i) => {
    const y = Y0 + i * RH;
    const m = mRate(r), w = wRate(r);
    out.push(
      label('d' + i, X0 - 90, y + 24, r.d, { cls: 'lab-big lab-gold' }),
      rect('mb' + i, X0, y + 4, W, 14, { cls: 'sq sq-dim', delay: i * 70 }),
      rect('mf' + i, X0, y + 4, W * m, 14, { cls: 'sq sq-x', delay: i * 70, tip: `dept ${r.d} · men ${r.mY}/${r.mA}` }),
      numLabel('mv' + i, X0 + W + 10, y + 15, m * 100, { cls: 'lab-sm lab-cyan', d: 0, suf: '%', delay: i * 70 }),
      rect('wb' + i, X0, y + 22, W, 14, { cls: 'sq sq-dim', delay: i * 70 }),
      rect('wf' + i, X0, y + 22, W * w, 14, { cls: 'sq sq-y', delay: i * 70, tip: `dept ${r.d} · women ${r.wY}/${r.wA}` }),
      numLabel('wv' + i, X0 + W + 10, y + 33, w * 100, { cls: 'lab-sm lab-purple', d: 0, suf: '%', delay: i * 70 }),
      w > m ? label('ck' + i, X0 + W + 54, y + 26, '↑ women higher', { cls: 'lab-sm lab-green', delay: i * 70 }) : null,
    );
    if (phase >= 2) {
      const tot = r.mA + r.wA, mw = 96 * (r.mA / tot);
      out.push(
        rect('am' + i, 512, y + 12, mw, 16, { cls: 'sq sq-x', delay: i * 70, tip: `${r.mA} men` }),
        rect('aw' + i, 512 + mw, y + 12, 96 - mw, 16, { cls: 'sq sq-y', delay: i * 70, tip: `${r.wA} women` }),
        numLabel('at' + i, 616, y + 24, tot, { cls: 'lab-sm', d: 0, delay: i * 70 }),
      );
    }
  });
  if (phase >= 2) out.push(
    label('n1', 512, Y0 + 6 * RH + 6, 'A and B admitted ~65% and were mostly men', { cls: 'lab-sm lab-cyan' }),
    label('n2', 512, Y0 + 6 * RH + 22, 'C to F admitted ~25% and were mostly women', { cls: 'lab-sm lab-purple' }));
  if (phase >= 3) out.push(
    label('f', 360, 496, `${WOMEN_HIGHER} of 6 departments favoured women — and the total favours men by 15 points`, { cls: 'lab lab-mid lab-warm' }),
    label('f2', 360, 518, 'both computed correctly, from the same 4,526 applications', { cls: 'lab-sm lab-mid' }));
  return out.filter(Boolean);
}

const SIMPSON_DAG = dag(
  [{ id: 'G', x: 0, y: 0, label: 'gender' }, { id: 'D', x: 1, y: -0.7, label: 'department' }, { id: 'A', x: 2, y: 0, label: 'admission' }],
  [{ from: 'G', to: 'D' }, { from: 'D', to: 'A' }, { from: 'G', to: 'A' }]);

function simpsonDag(phase) {
  const given = phase === 2 ? ['D'] : [];
  const xs = SIMPSON_DAG.nodes.map(n => n.x), ys = SIMPSON_DAG.nodes.map(n => n.y);
  const px = n => 150 + ((n.x - Math.min(...xs)) / (Math.max(...xs) - Math.min(...xs))) * 420;
  const py = n => 130 + ((n.y - Math.min(...ys)) / (Math.max(...ys) - Math.min(...ys))) * 130;
  const out = [];
  SIMPSON_DAG.edges.forEach((e, i) => {
    const a = SIMPSON_DAG.byId[e.from], b = SIMPSON_DAG.byId[e.to];
    const ax = px(a), ay = py(a), bx = px(b), by = py(b);
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, pad = 42;
    const direct = e.from === 'G' && e.to === 'A';
    out.push(path('e' + i, [[ax + (dx / L) * pad, ay + (dy / L) * pad], [bx - (dx / L) * (pad + 4), by - (dy / L) * (pad + 4)]], {
      cls: 'arrow' + ((phase === 2 && direct) || (phase === 3 && !direct) ? ' arrow-warm' : ''),
      set: (phase === 2 && direct) || (phase === 3 && !direct) ? { 'stroke-width': 2.8 } : { stroke: 'var(--cs-muted)' },
      dur: 300,
    }));
  });
  SIMPSON_DAG.nodes.forEach(n => {
    const adj = given.includes(n.id);
    out.push(
      { key: 'n' + n.id, tag: 'circle', dur: 300, attrs: { cx: px(n), cy: py(n), r: 38 },
        set: { fill: adj ? 'rgba(245,166,35,.22)' : 'var(--cs-bg-card, #16161c)', stroke: adj ? 'var(--cs-data-gold)' : 'var(--cs-border-data)', 'stroke-width': adj ? 3 : 1.6 } },
      label('l' + n.id, px(n), py(n) + 4, n.label, { cls: 'lab-sm lab-mid' + (adj ? ' lab-gold' : ''), dur: 300 }));
  });

  if (phase >= 2) {
    const q = phase === 2
      ? { h: 'the committee question', a: 'is a woman treated worse than an identical man in the same department?',
        b: 'block the mediator. compare within departments.', c: 'the answer is no — 4 of 6 favoured women.', tone: 'green' }
      : phase === 3
        ? { h: 'the system question', a: 'does the process as a whole admit fewer women?',
          b: 'do not block it. which department you apply to is part of how the outcome happens.', c: 'the answer is yes — 45% against 30%.', tone: 'warm' }
        : { h: '', a: '', b: '', c: '', tone: '' };
    if (phase <= 3) out.push(
      label('qh', 360, 316, q.h, { cls: 'lab-big lab-mid lab-' + q.tone }),
      ...wrapAt(q.a, 62).map((ln, i) => label('qa' + i, 360, 348 + i * 20, ln, { cls: 'lab lab-mid' })),
      ...wrapAt(q.b, 62).map((ln, i) => label('qb' + i, 360, 396 + i * 18, ln, { cls: 'lab-sm lab-mid' })),
      label('qc', 360, 452, q.c, { cls: 'lab lab-mid lab-' + q.tone }));
  }
  if (phase >= 4) out.push(
    label('f1', 360, 320, 'the table cannot choose between them.', { cls: 'lab-big lab-mid lab-gold' }),
    label('f2', 360, 356, 'both numbers are correct answers.', { cls: 'lab lab-mid' }),
    label('f3', 360, 380, 'they are answers to different questions,', { cls: 'lab lab-mid' }),
    label('f4', 360, 404, 'and nobody had written down which was being asked.', { cls: 'lab lab-mid' }),
    label('f5', 360, 452, 'that is what the diagram is for.', { cls: 'lab-big lab-mid lab-green' }));
  return out;
}

/* ── berkson ──────────────────────────────────────────────────────────────── */

const BSIM = (() => {
  const r = st.rng(451), n = 1600;
  const A = range(n).map(() => st.randNorm(r, 0, 1));
  const B = range(n).map(() => st.randNorm(r, 0, 1));
  const sev = A.map((v, i) => v + B[i] + st.randNorm(r, 0, 0.5));
  return { n, A, B, sev };
})();
const bIdx = frac => {
  const cut = st.quantile(BSIM.sev, 1 - clamp(frac, 0.03, 1));
  return BSIM.sev.map((v, i) => i).filter(i => BSIM.sev[i] >= cut);
};
const berkR = frac => {
  if (frac >= 0.99) return st.pearson(BSIM.A, BSIM.B);
  const idx = bIdx(frac);
  return idx.length > 8 ? st.pearson(idx.map(i => BSIM.A[i]), idx.map(i => BSIM.B[i])) : NaN;
};

function berkson(frac, showCut) {
  const f = frame({ w: 720, h: 540, l: 88, r: 244, t: 88, b: 96 });
  f.setX(-3.4, 3.4); f.setY(-3.4, 3.4);
  const keep = new Set(bIdx(frac));
  const r = berkR(frac);
  const cut = st.quantile(BSIM.sev, 1 - clamp(frac, 0.03, 1));
  return [
    { key: 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.sy(0), x2: f.x1, y2: f.sy(0) } },
    { key: 'ay', tag: 'line', cls: 'ax-line', attrs: { x1: f.sx(0), y1: f.y0, x2: f.sx(0), y2: f.y1 } },
    label('axl', (f.x0 + f.x1) / 2, f.y0 + 28, 'severity of condition A', { cls: 'ax-label' }),
    { key: 'ayl', tag: 'text', cls: 'ax-label', attrs: { x: 0, y: 0 }, set: { transform: `translate(${f.x0 - 30} ${(f.y0 + f.y1) / 2}) rotate(-90)` }, text: 'condition B' },
    ...BSIM.A.map((v, i) => ({
      key: 'p' + i, tag: 'circle', cls: 'pt', dur: 300,
      attrs: { cx: f.sx(v), cy: f.sy(BSIM.B[i]), r: keep.has(i) && frac < 0.99 ? 3 : 2.4 },
      set: { fill: frac >= 0.99 ? 'var(--cs-muted)' : keep.has(i) ? 'var(--cs-data-warm)' : 'var(--cs-muted)', stroke: 'none' },
      opacity: frac >= 0.99 ? 0.4 : keep.has(i) ? 0.65 : 0.09,
    })),
    showCut ? path('cut', [[f.sx(-3.4), f.sy(cut + 3.4)], [f.sx(3.4), f.sy(cut - 3.4)]], { cls: 'curve curve-fit curve-dash' }) : null,
    showCut ? label('cutl', f.sx(1.9), f.sy(cut - 1.4), 'admitted above here', { cls: 'lab-sm lab-end lab-green' }) : null,
    frac < 0.99 && keep.size > 20 && !showCut ? (() => {
      const xs = [...keep].map(i => BSIM.A[i]), ys = [...keep].map(i => BSIM.B[i]);
      const m = st.linreg(xs, ys);
      return path('fit', [[f.sx(-3.4), f.sy(m.b0 + m.b1 * -3.4)], [f.sx(3.4), f.sy(m.b0 + m.b1 * 3.4)]], { cls: 'curve curve-warm' });
    })() : null,
    numLabel('r0', 494, 128, st.pearson(BSIM.A, BSIM.B), { cls: 'lab-big lab-green', d: 3, pre: 'r = ' }),
    label('r0l', 494, 148, 'in the population', { cls: 'lab-sm' }),
    frac < 0.99 ? numLabel('r1', 494, 196, r, { cls: 'lab-big lab-warm', d: 3, pre: 'r = ' }) : null,
    frac < 0.99 ? label('r1l', 494, 216, 'among the admitted', { cls: 'lab-sm' }) : null,
    label('d1', 494, 268, 'either condition, if bad', { cls: 'lab-sm' }),
    label('d2', 494, 282, 'enough, gets you admitted.', { cls: 'lab-sm' }),
    label('d3', 494, 310, 'so a patient without one', { cls: 'lab-sm lab-gold' }),
    label('d4', 494, 324, 'probably has the other.', { cls: 'lab-sm lab-gold' }),
    label('d5', 494, 358, 'the relationship belongs', { cls: 'lab-sm' }),
    label('d6', 494, 372, 'to the front door.', { cls: 'lab-sm' }),
  ].filter(Boolean);
}

/* ── pilots ───────────────────────────────────────────────────────────────── */

function pilots(phase, worst, frac = 0.15) {
  const { t1, t2, n } = PILOTS;
  const f = frame({ w: 720, h: 540, l: 84, r: 230, t: 74, b: 92 });
  f.setX(-4, 4); f.setY(-4, 4);
  const idx = phase >= 2 ? new Set(tail(frac, worst)) : new Set();
  const m1 = idx.size ? st.mean([...idx].map(i => t1[i])) : 0;
  const m2 = idx.size ? st.mean([...idx].map(i => t2[i])) : 0;

  return [
    { key: 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x1, y2: f.y0 } },
    { key: 'ay', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x0, y2: f.y1 } },
    label('axl', (f.x0 + f.x1) / 2, f.y0 + 28, 'first landing', { cls: 'ax-label' }),
    { key: 'ayl', tag: 'text', cls: 'ax-label', attrs: { x: 0, y: 0 }, set: { transform: `translate(${f.x0 - 30} ${(f.y0 + f.y1) / 2}) rotate(-90)` }, text: 'second landing' },
    path('diag', [[f.sx(-4), f.sy(-4)], [f.sx(4), f.sy(4)]], { cls: 'curve curve-ghost curve-dash' }),
    ...t1.map((v, i) => ({
      key: 'p' + i, tag: 'circle', cls: 'pt', dur: 300,
      attrs: { cx: f.sx(v), cy: f.sy(t2[i]), r: idx.has(i) ? 4 : 2.6 },
      set: { fill: idx.has(i) ? (worst ? 'var(--cs-data-warm)' : 'var(--cs-data-green)') : 'var(--cs-muted)', stroke: 'none' },
      opacity: idx.size ? (idx.has(i) ? 0.85 : 0.14) : 0.4,
    })),
    phase >= 2 ? path('sel', [[f.sx(Math.max(...[...idx].map(i => t1[i]))), f.y0], [f.sx(Math.max(...[...idx].map(i => t1[i]))), f.y1]], {
      cls: 'rule rule-gold rule-dash',
    }) : null,
    phase >= 3 ? [
      path('m1', [[f.sx(m1), f.y0], [f.sx(m1), f.sy(m2)]], { cls: 'stick', set: { stroke: 'var(--cs-data-warm)', 'stroke-width': 2, 'stroke-dasharray': '4 4' } }),
      path('m2', [[f.x0, f.sy(m2)], [f.sx(m1), f.sy(m2)]], { cls: 'stick', set: { stroke: 'var(--cs-data-green)', 'stroke-width': 2, 'stroke-dasharray': '4 4' } }),
      path('arr', [[f.sx(m1), f.sy(m1)], [f.sx(m1), f.sy(m2)]], { cls: 'arrow arrow-warm' }),
    ] : null,
    numLabel('v1', 496, 130, m1, { cls: 'lab-big lab-warm', d: 3, pre: 'first: ' }),
    numLabel('v2', 496, 168, m2, { cls: 'lab-big lab-green', d: 3, pre: 'second: ' }),
    numLabel('v3', 496, 212, m2 - m1, { cls: 'lab-big lab-gold', d: 3, pre: 'moved ' }),
    label('v3l', 496, 232, worst ? 'they got better' : 'they got worse', { cls: 'lab-sm' }),
    label('t1', 496, 278, 'the true effect of', { cls: 'lab-sm' }),
    label('t2', 496, 292, 'the intervention:', { cls: 'lab-sm' }),
    label('t3', 496, 320, 'exactly zero', { cls: 'lab-big lab-cyan' }),
    phase >= 3 ? [
      label('w1', 496, 364, 'an extreme score needs', { cls: 'lab-sm lab-gold' }),
      label('w2', 496, 378, 'bad luck as well as low', { cls: 'lab-sm lab-gold' }),
      label('w3', 496, 392, 'skill. the luck does not', { cls: 'lab-sm lab-gold' }),
      label('w4', 496, 406, 'come back next time.', { cls: 'lab-sm lab-gold' }),
    ] : null,
  ].flat().filter(Boolean);
}

/* ── base rates ───────────────────────────────────────────────────────────── */

function base(phase, prevPerK = 1) {
  const c = testCounts(prevPerK / 1000);
  const COLS = 25, ROWS = 4, CW = 24, CH = 24, X0 = 66, Y0 = 118;
  const cells = COLS * ROWS;                    /* 100 squares = 100k people */
  const out = [
    label('h', 360, 74, `${c.N.toLocaleString()} people · one square is a thousand`, { cls: 'lab lab-mid lab-gold' }),
  ];
  /* how many squares' worth of each category */
  const share = [
    { n: c.tp, fill: 'var(--cs-data-green)', k: 'tp' },
    { n: c.fp, fill: 'var(--cs-data-warm)', k: 'fp' },
    { n: c.fn, fill: 'var(--cs-purple)', k: 'fn' },
    { n: c.tn, fill: 'rgba(255,255,255,.06)', k: 'tn' },
  ];
  let filled = 0;
  const assign = new Array(cells).fill('tn');
  share.forEach(sh => {
    const k = Math.round((sh.n / c.N) * cells);
    for (let i = 0; i < k && filled < cells; i++) assign[filled++] = sh.k;
  });
  const colOf = { tp: 'var(--cs-data-green)', fp: 'var(--cs-data-warm)', fn: 'var(--cs-purple)', tn: 'rgba(255,255,255,.06)' };
  range(cells).forEach(i => {
    const r = Math.floor(i / COLS), col = i % COLS;
    const shown = phase >= 2 ? assign[i] : (assign[i] === 'tn' ? 'tn' : 'ill');
    out.push(rect('c' + i, X0 + col * CW, Y0 + r * CH, CW - 3, CH - 3, {
      cls: 'sq', dur: 260,
      set: {
        fill: phase >= 2 ? colOf[assign[i]] : (assign[i] === 'tn' ? 'rgba(255,255,255,.06)' : 'var(--cs-data-cold)'),
        stroke: 'none',
      },
    }));
  });

  const Y1 = Y0 + ROWS * CH + 34;
  if (phase >= 2) out.push(
    ...[['tp', 'caught, and ill', c.tp], ['fp', 'flagged, and well', c.fp], ['fn', 'missed', c.fn]].map(([k, lab, n], i) => [
      rect('k' + i, X0 + i * 200, Y1, 14, 14, { cls: 'sq', set: { fill: colOf[k], stroke: 'none' } }),
      label('kl' + i, X0 + i * 200 + 22, Y1 + 12, lab, { cls: 'lab-sm' }),
      numLabel('kn' + i, X0 + i * 200 + 22, Y1 + 28, n, { cls: 'lab lab-' + (k === 'tp' ? 'green' : k === 'fp' ? 'warm' : 'purple'), d: 0 }),
    ]).flat());

  if (phase >= 3) {
    const W = 520, Y2 = Y1 + 74;
    const p = c.tp / Math.max(1, c.tp + c.fp);
    out.push(
      label('ph', X0, Y2 - 10, 'of everyone who tested positive:', { cls: 'lab-sm' }),
      rect('pb', X0, Y2, W, 34, { cls: 'sq sq-dim' }),
      rect('pf', X0, Y2, W * p, 34, { cls: 'sq', set: { fill: 'var(--cs-data-green)', stroke: 'none' } }),
      numLabel('pv', X0, Y2 + 68, p * 100, { cls: 'lab-big lab-gold', d: 1, pre: 'you have a ', suf: '% chance of being ill' }),
      label('pl', X0, Y2 + 90, `even though the test is ${(TEST.sens * 100).toFixed(0)}% sensitive and ${(TEST.spec * 100).toFixed(0)}% specific`, { cls: 'lab-sm' }),
      numLabel('pn', X0 + W + 12, Y2 + 22, c.tp + c.fp, { cls: 'lab lab-end', d: 0, suf: ' positives' }),
    );
  }
  return out;
}

/* ── monty ────────────────────────────────────────────────────────────────── */

function monty(phase) {
  if (phase <= 2) {
    const rows = [
      { car: 1, opens: '2 or 3', stay: true },
      { car: 2, opens: '3', stay: false },
      { car: 3, opens: '2', stay: false },
    ];
    const out = [
      label('h', 360, 66, 'you picked door 1. enumerate the three cases.', { cls: 'lab-big lab-mid lab-gold' }),
      label('c1', 150, 112, 'car is behind', { cls: 'lab-sm lab-mid' }),
      label('c2', 330, 112, 'host opens', { cls: 'lab-sm lab-mid' }),
      label('c3', 490, 112, 'stay', { cls: 'lab-sm lab-mid' }),
      label('c4', 610, 112, 'switch', { cls: 'lab-sm lab-mid' }),
    ];
    rows.forEach((r, i) => {
      const y = 136 + i * 84;
      out.push(
        rect('r' + i, 54, y, 612, 68, { cls: 'cell', delay: i * 180 }),
        label('a' + i, 150, y + 40, `door ${r.car}`, { cls: 'lab-big lab-mid lab-cyan', delay: i * 180 }),
        label('b' + i, 330, y + 40, `door ${r.opens}`, { cls: 'lab lab-mid', delay: i * 180 }),
        label('c' + i, 490, y + 40, r.stay ? 'WIN' : 'lose', {
          cls: 'lab-big lab-mid lab-' + (r.stay ? 'green' : 'muted'), delay: i * 180,
        }),
        label('d' + i, 610, y + 40, r.stay ? 'lose' : 'WIN', {
          cls: 'lab-big lab-mid lab-' + (r.stay ? 'muted' : 'green'), delay: i * 180,
        }));
    });
    if (phase >= 2) out.push(
      label('s1', 490, 412, '1 of 3', { cls: 'lab-big lab-mid lab-muted' }),
      label('s2', 610, 412, '2 of 3', { cls: 'lab-big lab-mid lab-green' }),
      label('f', 360, 462, 'the host never opens the car. that is the whole thing —', { cls: 'lab lab-mid lab-gold' }),
      label('f2', 360, 486, 'his choice depends on where it is, so his door carries information.', { cls: 'lab lab-mid lab-gold' }));
    return out;
  }
  if (phase === 3) {
    const X0 = 150, W = 420;
    return [
      label('h', 360, 92, `${MONTY.n.toLocaleString()} games, simulated`, { cls: 'lab-big lab-mid lab-gold' }),
      rect('sb', X0, 180, W, 46, { cls: 'sq sq-dim' }),
      rect('sf', X0, 180, W * MONTY.stay, 46, { cls: 'sq sq-dim', set: { fill: 'rgba(255,255,255,.16)' } }),
      label('sl', X0 - 12, 208, 'stay', { cls: 'lab-big lab-end' }),
      numLabel('sv', X0 + W + 14, 208, MONTY.stay * 100, { cls: 'lab-big', d: 1, suf: '%' }),
      rect('wb', X0, 260, W, 46, { cls: 'sq sq-dim' }),
      rect('wf', X0, 260, W * MONTY.swap, 46, { cls: 'sq', set: { fill: 'var(--cs-data-green)', stroke: 'none' } }),
      label('wl', X0 - 12, 288, 'switch', { cls: 'lab-big lab-end lab-green' }),
      numLabel('wv', X0 + W + 14, 288, MONTY.swap * 100, { cls: 'lab-big lab-green', d: 1, suf: '%' }),
      label('f', 360, 384, 'exactly twice as often, and no argument required.', { cls: 'lab lab-mid lab-green' }),
      label('f2', 360, 420, 'your first pick was right one time in three, and nothing', { cls: 'lab-sm lab-mid' }),
      label('f3', 360, 438, 'the host does afterwards can change that number.', { cls: 'lab-sm lab-mid' }),
    ];
  }
  const D = dag(
    [{ id: 'P', x: 0, y: 0, label: 'your pick' }, { id: 'C', x: 2, y: 0, label: 'car' }, { id: 'H', x: 1, y: 1, label: 'door opened' }],
    [{ from: 'P', to: 'H' }, { from: 'C', to: 'H' }]);
  const px = { P: 190, C: 530, H: 360 }, py = { P: 170, C: 170, H: 300 };
  const out = [label('h', 360, 84, 'the door the host opens is a collider', { cls: 'lab-big lab-mid lab-gold' })];
  D.edges.forEach((e, i) => {
    const ax = px[e.from], ay = py[e.from], bx = px[e.to], by = py[e.to];
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy), pad = 46;
    out.push(path('e' + i, [[ax + (dx / L) * pad, ay + (dy / L) * pad], [bx - (dx / L) * (pad + 4), by - (dy / L) * (pad + 4)]], { cls: 'arrow arrow-warm', set: { 'stroke-width': 2.4 } }));
  });
  ['P', 'C', 'H'].forEach(k => out.push(
    { key: 'n' + k, tag: 'circle', attrs: { cx: px[k], cy: py[k], r: 42 },
      set: { fill: k === 'H' ? 'rgba(245,166,35,.22)' : 'var(--cs-bg-card, #16161c)', stroke: k === 'H' ? 'var(--cs-data-gold)' : 'var(--cs-border-data)', 'stroke-width': k === 'H' ? 3 : 1.6 } },
    label('l' + k, px[k], py[k] + 4, D.byId[k].label, { cls: 'lab-sm lab-mid' + (k === 'H' ? ' lab-gold' : '') })));
  out.push(
    label('o1', 360, 376, 'you observe the collider.', { cls: 'lab lab-mid lab-gold' }),
    label('o2', 360, 404, 'so the two things that caused it become related —', { cls: 'lab lab-mid' }),
    label('o3', 360, 426, 'and since you know your own pick, you learn about the car.', { cls: 'lab lab-mid' }),
    label('o4', 360, 470, 'the same mechanism that made two independent diseases', { cls: 'lab-sm lab-mid lab-green' }),
    label('o5', 360, 490, 'correlate. here it is working for you instead of against.', { cls: 'lab-sm lab-mid lab-green' }));
  return out;
}

/* ── lord ─────────────────────────────────────────────────────────────────── */

function lord(phase) {
  const f = frame({ w: 720, h: 540, l: 84, r: 232, t: 76, b: 92 });
  const bs = LORD.rows.map(r => r.base), as = LORD.rows.map(r => r.after);
  f.setX(Math.min(...bs) - 1, Math.max(...bs) + 1);
  f.setY(Math.min(...as) - 1, Math.max(...as) + 1);
  const out = [
    { key: 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x1, y2: f.y0 } },
    { key: 'ay', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x0, y2: f.y1 } },
    label('axl', (f.x0 + f.x1) / 2, f.y0 + 28, 'before', { cls: 'ax-label' }),
    { key: 'ayl', tag: 'text', cls: 'ax-label', attrs: { x: 0, y: 0 }, set: { transform: `translate(${f.x0 - 30} ${(f.y0 + f.y1) / 2}) rotate(-90)` }, text: 'after' },
    path('diag', [[f.sx(f.dx[0]), f.sy(f.dx[0])], [f.sx(f.dx[1]), f.sy(f.dx[1])]], { cls: 'curve curve-ghost curve-dash' }),
    ...LORD.rows.map((r, i) => ({
      key: 'p' + i, tag: 'circle', cls: 'pt',
      attrs: { cx: f.sx(r.base), cy: f.sy(r.after), r: 3 },
      set: { fill: r.grp ? 'var(--cs-data-warm)' : 'var(--cs-cyan)', stroke: 'none' }, opacity: 0.6,
    })),
    label('gl0', f.x0 + 8, f.y1 + 4, 'control', { cls: 'lab-sm lab-cyan' }),
    label('gl1', f.x0 + 8, f.y1 + 20, 'programme', { cls: 'lab-sm lab-warm' }),
  ];
  if (phase === 2) {
    [LORD.g0, LORD.g1].forEach((g, k) => {
      const mb = st.mean(g.map(x => x.base)), ma = st.mean(g.map(x => x.after));
      out.push(path('ch' + k, [[f.sx(mb), f.sy(mb)], [f.sx(mb), f.sy(ma)]], {
        cls: 'arrow', set: { stroke: k ? 'var(--cs-data-warm)' : 'var(--cs-cyan)', 'stroke-width': 2.4 },
      }));
    });
    out.push(
      numLabel('c1', 502, 148, LORD.changeDiff, { cls: 'lab-big lab-cyan', d: 3, pre: 'difference: ' }),
      label('c2', 502, 170, 'in average change', { cls: 'lab-sm' }),
      label('c3', 502, 208, 'both groups moved by', { cls: 'lab-sm' }),
      label('c4', 502, 222, 'about the same amount.', { cls: 'lab-sm' }),
      label('c5', 502, 252, 'no effect.', { cls: 'lab-big lab-green' }));
  }
  if (phase >= 3) {
    [LORD.g0, LORD.g1].forEach((g, k) => {
      const m = st.linreg(g.map(x => x.base), g.map(x => x.after));
      out.push(path('ln' + k, [
        [f.sx(f.dx[0]), f.sy(m.b0 + m.b1 * f.dx[0])], [f.sx(f.dx[1]), f.sy(m.b0 + m.b1 * f.dx[1])],
      ], { cls: 'curve', set: { stroke: k ? 'var(--cs-data-warm)' : 'var(--cs-cyan)', 'stroke-width': 2.4 } }));
    });
    const xm = (f.dx[0] + f.dx[1]) / 2;
    out.push(
      path('vl', [[f.sx(xm), f.y0], [f.sx(xm), f.y1]], { cls: 'rule rule-gold rule-dash' }),
      label('vll', f.sx(xm), f.y1 - 6, 'same baseline', { cls: 'lab-sm lab-mid lab-gold' }),
      numLabel('a1', 502, 148, LORD.ancova, { cls: 'lab-big lab-warm', d: 3, pre: 'difference: ' }),
      label('a2', 502, 170, 'at a matched baseline', { cls: 'lab-sm' }),
      label('a3', 502, 208, 'the two lines are', { cls: 'lab-sm' }),
      label('a4', 502, 222, 'vertically apart.', { cls: 'lab-sm' }),
      label('a5', 502, 252, 'a large effect.', { cls: 'lab-big lab-warm' }),
      numLabel('a6', 502, 296, 0, { cls: 'lab lab-green', d: 0, pre: 'true effect: ' }));
  }
  if (phase >= 4) out.push(
    label('w1', 502, 340, 'matching on baseline pairs', { cls: 'lab-sm lab-gold' }),
    label('w2', 502, 354, 'a lucky-low member of the', { cls: 'lab-sm lab-gold' }),
    label('w3', 502, 368, 'high group with an unlucky-', { cls: 'lab-sm lab-gold' }),
    label('w4', 502, 382, 'high member of the low one.', { cls: 'lab-sm lab-gold' }),
    label('w5', 502, 408, 'both regress toward their', { cls: 'lab-sm' }),
    label('w6', 502, 422, 'own group, in opposite', { cls: 'lab-sm' }),
    label('w7', 502, 436, 'directions.', { cls: 'lab-sm' }));
  return out;
}
