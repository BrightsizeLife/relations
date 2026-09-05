/* ─────────────────────────────────────────────────────────────────────────────
   survival.js — how long until, when some of the answers are still missing.

   The whole subject turns on one sentence: for some people you do not know the
   answer, you know a lower bound on it. Every method here is a way of spending
   that lower bound instead of throwing it away.

   Nothing below is asserted. The bias of the two obvious wrong answers is
   simulated across six censoring rates; the log-rank arithmetic is shown one
   event time at a time; the Cox coefficient comes out of a Newton–Raphson run
   on the partial likelihood in your browser.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import {
  kaplanMeier, survivalAt, medianSurvival, naiveMeans, logRank, coxPH,
  cohort, biasCurve,
} from '../core/survival.js';
import { frame, axes, points, label, numLabel, path, rect, hLine, vLine, arrowDefs } from '../core/plot.js';
import { range } from '../core/dom.js';
import { formula, t, frac, sub, sup, hat, paren, eq, minus, times, prodOver, op } from '../core/fx.js';

/* ── the study ────────────────────────────────────────────────────────────── */

/* twelve people, small enough to draw every one of them as a line */
const WARD = (() => {
  const rows = cohort({ n: 12, rate: 0.09, censorRate: 0.035, end: 24, seed: 4 });
  return rows.map((r, i) => ({ ...r, id: i, name: String.fromCharCode(65 + i) }))
    .sort((a, b) => a.t - b.t);
})();
const WARD_KM = kaplanMeier(WARD);
const WARD_NAIVE = naiveMeans(WARD);

/* the two arms, big enough for a test to mean something */
const ARM = {
  0: cohort({ n: 90, rate: 0.055, censorRate: 0.018, end: 60, seed: 11, group: 0 }),
  1: cohort({ n: 90, rate: 0.055, censorRate: 0.018, end: 60, seed: 29, group: 1, hr: 2.1 }),
};
const ARM_KM = { 0: kaplanMeier(ARM[0]), 1: kaplanMeier(ARM[1]) };
const LR = logRank(ARM[0], ARM[1]);
const COX = coxPH([...ARM[0], ...ARM[1]]);

/* how far wrong the two obvious answers go, as censoring gets heavier */
const BIAS = biasCurve({ reps: 80 });

/* ── formula pieces ───────────────────────────────────────────────────────── */

const fS = t(`${hat('S')}(t)`, { explain: 'The chance of still being event-free at time t. Not a probability of one person — a fraction of a population that has not had it yet.', tone: 'gold', link: 'curve' });
const fD = t(sub('d', 'j'), { explain: 'How many events happened at exactly this time. Almost always one.', tone: 'warm', link: 'd' });
const fN = t(sub('n', 'j'), { explain: 'The risk set: how many people were still being watched, and still event-free, an instant before this time.', tone: 'cyan', link: 'n' });

const KM_FORMULA = formula(
  `${fS} ${eq} ${prodOver(`${paren(`1 ${minus} ${frac(fD, fN)}`)}`, { from: `${sub('t', 'j')} ≤ t`, to: '' })}`,
  { caption: 'survive every instant up to t, one instant at a time' });

const COX_FORMULA = formula(
  `h(t | x) ${eq} ${sub('h', '0')}(t) ${times} ${sup('e', 'β x')}`,
  { caption: 'a baseline you never estimate, multiplied by something you do' });

/* ── scene helpers ────────────────────────────────────────────────────────── */

/** the step function, as a list of corner points */
function kmPts(km, tMax) {
  const pts = [[0, 1]];
  let s = 1;
  for (const k of km) {
    if (k.t > tMax) break;
    pts.push([k.t, s]);
    s = k.s;
    pts.push([k.t, s]);
  }
  pts.push([tMax, s]);
  return pts;
}

const swimFrame = () => frame({ w: 720, h: 500, l: 54, r: 26, t: 34, b: 54 })
  .setX(0, 26).setY(-0.6, 11.6);

const curveFrame = () => frame({ w: 720, h: 500, l: 62, r: 26, t: 30, b: 56 })
  .setX(0, 26).setY(0, 1.04);

/** one horizontal life, with a marker at the end that says which kind of end it was */
function swimmers(f, rows, { upTo = Infinity, key = 'sw', showKind = true } = {}) {
  const out = [];
  rows.forEach((r, i) => {
    const y = f.sy(i);
    const stop = Math.min(r.t, upTo);
    out.push({
      key: `${key}-line-${r.id}`, tag: 'line', delay: i * 45,
      cls: r.event ? 'stick stick-pos' : 'stick stick-neg',
      attrs: { x1: f.sx(0), y1: y, x2: f.sx(stop), y2: y },
      enter: { attrs: { x2: f.sx(0) } },
    });
    out.push(label(`${key}-name-${r.id}`, f.x0 - 12, y + 4, r.name, { cls: 'lab-sm lab-end', delay: i * 45 }));
    if (!showKind || r.t > upTo) return;
    if (r.event) {
      out.push({
        key: `${key}-end-${r.id}`, tag: 'circle', delay: i * 45,
        cls: 'pt pt-warm', attrs: { cx: f.sx(r.t), cy: y, r: 5.5 },
        tip: `${r.name}: event at ${r.t.toFixed(1)} months`,
        enter: { attrs: { r: 0 } },
      });
    } else {
      out.push(label(`${key}-end-${r.id}`, f.sx(r.t) + 3, y + 5, '→', {
        cls: 'lab lab-cold', delay: i * 45,
        tip: `${r.name}: still event-free at ${r.t.toFixed(1)} months, and then we stopped watching. The real time is somewhere past here.`,
      }));
    }
  });
  return out;
}

export default {
  meta: {
    id: 'survival', title: 'survival analysis', short: 'survival',
    kicker: 'HOW LONG UNTIL', status: 'live',
    deck: 'Time-to-event data has a hole in it on purpose: when the study stops, some people have not had the event yet. You do not know their time — you know it is <em>at least</em> what you saw. Drop them and your answer collapses; count them as events and it collapses harder. Below, the same truth of 11.6 months is estimated as 3.1 by both obvious methods once three quarters of the data is censored, and correctly by the method that spends the lower bound instead of discarding it.',
    dataNote: 'A simulated cohort with a known exponential hazard, so that when an estimate is wrong you can see exactly how wrong and why. Every number on this page is computed in your browser.',
    deps: ['glm', 'logistic', 'chisq'], unlocks: [],
    next: 'regularisation', nextLabel: 'regularisation',
    outro: 'censoring is not missing data to be patched. it is information with a direction — "at least this long" — and the whole subject is the arithmetic of spending it.',
  },
  canvas: { w: 720, h: 500 },
  defs: arrowDefs,
  state: { upTo: 26, arm: 'both', showCI: false, cens: 3, tSel: 8 },

  steps: [

    /* ── 1 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'twelve people, and four unfinished stories',
      prose: `<p>Everyone enters on the left. The line runs forward until something happens.</p>
        <p>A <b>dot</b> is the event: the thing you were waiting for arrived, and you know exactly when.</p>
        <p>An <b>arrow</b> is the other ending. The study closed, or the person moved away, or they were still fine on the last day anybody looked. Their line stops — but the story does not. The event is out there somewhere past the arrow, and you have no idea how far.</p>
        <p>That arrow is called <em>censoring</em>, and it is the entire reason this subject exists as a separate thing.</p>`,
      beats: [
        { label: 'everyone starts', scene: (s, c) => scene1(0), hold: 1100 },
        { label: 'let time run', scene: (s, c) => scene1(26) },
      ],
      readouts: [
        { key: 'n', label: 'people', get: () => WARD.length, d: 0 },
        { key: 'e', label: 'events seen', tone: 'warm', get: () => WARD.filter(r => r.event).length, d: 0 },
        { key: 'c', label: 'censored', tone: 'cold', get: () => WARD.filter(r => !r.event).length, d: 0 },
      ],
    },

    /* ── 2 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'the two things everyone tries first',
      prose: `<p>You want the typical time to the event. Two obvious moves:</p>
        <p><b>Drop the arrows.</b> Only average the people whose story finished. But the arrows are not a random sample of anyone — they are, disproportionately, the people who were <em>doing well</em>. Deleting them deletes the long times.</p>
        <p><b>Count the arrows as events.</b> Pretend the line ended where it stopped. Now every one of those people is recorded as failing sooner than they did.</p>
        <p>Both moves push the answer down. Both are still made, in print, constantly.</p>`,
      formula: formula(
        `${t('drop', { tone: 'warm' })} ${eq} ${WARD_NAIVE.dropMed.toFixed(1)} ${op('·')} ${t('count as events', { tone: 'cold' })} ${eq} ${WARD_NAIVE.asEventMed.toFixed(1)} ${op('·')} ${t('truth', { tone: 'green' })} ${eq} ${WARD_NAIVE.truthMed.toFixed(1)}`,
        { caption: 'median months, on these twelve, where the truth is known because it was simulated' }),
      beats: [
        { label: 'what you saw', scene: () => scene2('seen'), hold: 1400 },
        { label: 'drop the censored', scene: () => scene2('drop'), hold: 1600, note: 'four lines deleted — and they were four of the six longest.' },
        { label: 'count them as events', scene: () => scene2('asevent'), hold: 1600, note: 'the arrows become dots. every one of them now claims an event that has not happened.' },
        { label: 'what was actually true', scene: () => scene2('truth'), note: 'the faint extensions are the real times. both methods just deleted them.' },
      ],
      readouts: [
        { key: 'd', label: 'median · drop censored', tone: 'warm', get: () => WARD_NAIVE.dropMed, d: 2 },
        { key: 'a', label: 'median · censored counted as events', tone: 'cold', get: () => WARD_NAIVE.asEventMed, d: 2 },
        { key: 't', label: 'median · the truth', tone: 'green', get: () => WARD_NAIVE.truthMed, d: 2 },
      ],
    },

    /* ── 3 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'how bad does it get',
      prose: `<p>Twelve people is an anecdote. So here is the same comparison run eighty times at each of six censoring rates, on cohorts of eighty, where the true median is <b>11.55 months</b> every time.</p>
        <p>The green line is Kaplan–Meier, which you have not met yet. It is flat. The other two fall off a cliff.</p>
        <p>At the right-hand end, roughly three quarters of the people are censored, and both naive answers say about <b>three months</b> for something whose true median is <b>eleven and a half</b>. That is not a small bias you correct later. It is the wrong answer by a factor of four.</p>`,
      beats: [
        { label: 'the truth, fixed', scene: () => scene3(0), hold: 1100 },
        { label: 'drop the censored', scene: () => scene3(1), hold: 1500 },
        { label: 'count them as events', scene: () => scene3(2), hold: 1500 },
        { label: 'and the method that works', scene: () => scene3(3), note: 'flat across the whole range. that is the thing worth explaining.' },
      ],
      readouts: [
        { key: 'w', label: 'at 73% censored · drop', tone: 'warm', get: () => BIAS[5].drop, d: 2 },
        { key: 'c', label: 'at 73% censored · as events', tone: 'cold', get: () => BIAS[5].asEvent, d: 2 },
        { key: 'k', label: 'at 73% censored · kaplan–meier', tone: 'green', get: () => BIAS[5].km, d: 2 },
        { key: 't', label: 'true median', tone: 'muted', get: () => BIAS[0].truth, d: 2 },
      ],
    },

    /* ── 4 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'stop asking about the whole time',
      prose: `<p>Here is the move. Stop trying to estimate a duration. Ask a much smaller question, and ask it over and over.</p>
        <p><b>Given that you made it to this instant, what is the chance you get through it?</b></p>
        <p>That question only needs two numbers, and both of them are things you actually observed: how many people were still being watched an instant before (<em>the risk set</em>), and how many events happened right then.</p>
        <p>Someone censored at month 9 was in the risk set for every instant up to month 9. They contribute to every one of those questions. Nothing about them is thrown away — you simply stop asking about them after month 9, because after month 9 you genuinely do not know.</p>`,
      formula: KM_FORMULA,
      controls: [
        { type: 'slider', key: 'tSel', label: 'look at time', min: 1, max: 24, step: 1, fast: true },
      ],
      scene: s => scene4(+s.tSel),
      readouts: [
        { key: 'n', label: 'at risk just before', tone: 'cyan', get: s => riskAt(+s.tSel).n, d: 0 },
        { key: 'd', label: 'events right now', tone: 'warm', get: s => riskAt(+s.tSel).d, d: 0 },
        { key: 'q', label: 'chance of getting through', tone: 'green', get: s => { const r = riskAt(+s.tSel); return r.n ? 1 - r.d / r.n : NaN; }, d: 3 },
      ],
    },

    /* ── 5 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'multiply them together',
      prose: `<p>Surviving to month 12 means getting through every instant before it. Chances of independent hurdles multiply, so the estimate is a running product — which is why the thing is also called the <em>product-limit</em> estimator.</p>
        <p>Watch the curve build. It only steps down at an event. A censored person produces <b>no step at all</b>: they leave the risk set quietly, which makes the <em>next</em> drop slightly bigger, because the same one event is now divided by a smaller number.</p>
        <p>That is the whole trick. Censoring does not lower the curve. It raises the price of every event that comes after it.</p>`,
      formula: KM_FORMULA,
      beats: WARD_KM.map((k, i) => ({
        label: `t = ${k.t.toFixed(1)}`,
        scene: () => scene5(i + 1),
        hold: 900,
        note: `${k.d} event out of ${k.n} still at risk → multiply by ${(1 - k.d / k.n).toFixed(3)} → ${k.s.toFixed(3)}`,
      })),
      readouts: [
        { key: 's', label: 'survival estimate', tone: 'gold', get: (s, c) => WARD_KM[Math.min(c.beat, WARD_KM.length - 1)].s, d: 3 },
        { key: 'n', label: 'at risk', tone: 'cyan', get: (s, c) => WARD_KM[Math.min(c.beat, WARD_KM.length - 1)].n, d: 0 },
        { key: 'm', label: 'median survival', tone: 'green', get: () => medianSurvival(WARD_KM) ?? '—', d: 1, suf: ' mo' },
      ],
    },

    /* ── 6 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'how much of that curve is real',
      prose: `<p>The estimate is a product of ratios, and every ratio has sampling error in it. Greenwood's formula propagates that error through the product — it is the delta method applied to a log of a product, which turns into a sum you can accumulate as you go.</p>
        <p>Turn the band on. Notice its shape: tight on the left, flaring badly on the right. That is not decoration. By the far end of the study almost nobody is still at risk, so each remaining event moves the curve enormously and the interval knows it.</p>
        <p><b>The tail of a Kaplan–Meier curve is nearly always junk.</b> Reporting "70% survival at five years" from a study where four people made it to five years is the most common abuse of this method.</p>`,
      controls: [
        { type: 'toggle', key: 'showCI', label: '95% band' },
      ],
      scene: s => scene6(!!s.showCI),
      readouts: [
        { key: 'e', label: 'at risk at the end', tone: 'warm', get: () => WARD_KM[WARD_KM.length - 1].n, d: 0 },
        { key: 'w', label: 'band width at the end', tone: 'cold', get: () => { const k = WARD_KM[WARD_KM.length - 1]; return k.hi - k.lo; }, d: 3 },
        { key: 'w0', label: 'band width at the start', tone: 'green', get: () => { const k = WARD_KM[0]; return k.hi - k.lo; }, d: 3 },
      ],
    },

    /* ── 7 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'two arms, and whether the gap is real',
      prose: `<p>Ninety people per arm, one arm with a hazard about twice the other. The curves separate. The question is whether a gap that size happens by luck.</p>
        <p>The <b>log-rank test</b> asks it one event time at a time, and the question it asks at each one is a question you have already met in the chi-square lesson: <em>given that somebody failed right now, and given who was standing there, how many of those failures should have come from arm B?</em></p>
        <p>Under the null the arms are interchangeable, so the answer is just the share of the risk set that arm B holds. Accumulate observed minus expected across all event times, scale by the variance, and you have a chi-square with one degree of freedom.</p>`,
      formula: formula(
        `${sup('χ', '2')} ${eq} ${frac(`${paren(`O ${minus} E`)}${sup('', '2')}`, 'V')} ${eq} ${frac(`${paren(`${LR.O.toFixed(0)} ${minus} ${LR.E.toFixed(1)}`)}${sup('', '2')}`, LR.V.toFixed(1))} ${eq} ${LR.chi2.toFixed(2)}`,
        { caption: 'observed events in arm B, against how many were due there' }),
      beats: [
        { label: 'arm A', scene: () => scene7(0), hold: 1100 },
        { label: 'arm B', scene: () => scene7(1), hold: 1300 },
        { label: 'the gap', scene: () => scene7(2) },
      ],
      readouts: [
        { key: 'o', label: 'observed events, arm B', tone: 'warm', get: () => LR.O, d: 0 },
        { key: 'e', label: 'expected under the null', tone: 'cold', get: () => LR.E, d: 2 },
        { key: 'x', label: 'χ²', tone: 'gold', get: () => LR.chi2, d: 2 },
        { key: 'p', label: 'p', tone: 'green', get: () => st.fmtP(LR.p) },
      ],
    },

    /* ── 8 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'the table the test is actually built from',
      prose: `<p>Every row here is one event time. At that instant there is a two-by-two table — arm by outcome — and the expected count is the hypergeometric one: the number of events, split in proportion to who was standing there.</p>
        <p>Nothing in this table is a duration. The log-rank test never uses <em>how long</em>. It only ever uses <em>who was there and who went</em>, in order. That is precisely why censoring costs it nothing: a censored person is simply in the risk set until they are not.</p>
        <p>It also tells you the test's blind spot. If the curves cross, early differences and late differences point opposite ways and cancel in the sum. Two very different survival stories can produce a log-rank p of 0.9.</p>`,
      scene: () => scene8(),
      readouts: [
        { key: 'r', label: 'event times summed over', tone: 'muted', get: () => LR.table.length, d: 0 },
        { key: 'o', label: '∑ observed', tone: 'warm', get: () => LR.O, d: 0 },
        { key: 'e', label: '∑ expected', tone: 'cold', get: () => LR.E, d: 2 },
        { key: 'v', label: '∑ variance', tone: 'gold', get: () => LR.V, d: 2 },
      ],
    },

    /* ── 9 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'cox: the baseline cancels',
      prose: `<p>A test gives you a p-value. You want a number — how much worse, and by how much, with what else held constant. That needs a model, and a model of time-to-event seems to need a shape for the hazard over time. Which you do not know and do not want to guess.</p>
        <p>Cox's move: write the hazard as an unknown baseline shape multiplied by something that depends on the covariates. Then, at each event time, ask only <b>which member of the risk set was the one who failed</b>. That is a ratio — this person's hazard over the sum of everyone's — and the baseline appears in the numerator and in every term of the denominator.</p>
        <p>It cancels. Completely. You never estimate it, never assume it, and still get the coefficient.</p>`,
      formula: COX_FORMULA,
      beats: [
        { label: 'the risk set at one event', scene: () => scene9(0), hold: 1600 },
        { label: 'whose turn was it?', scene: () => scene9(1), hold: 1700, note: 'this person’s hazard, over the total hazard standing there.' },
        { label: 'the baseline cancels', scene: () => scene9(2), note: 'h₀(t) is in every term of both. it divides out and never comes back.' },
      ],
      readouts: [
        { key: 'b', label: 'β', tone: 'gold', get: () => COX.beta[0], d: 4 },
        { key: 'h', label: 'hazard ratio', tone: 'warm', get: () => COX.hr[0], d: 3 },
        { key: 'ci', label: '95% CI', tone: 'cold', wide: true, get: () => `${COX.lo[0].toFixed(2)} … ${COX.hi[0].toFixed(2)}` },
        { key: 'p', label: 'p', tone: 'green', get: () => st.fmtP(COX.p[0]) },
      ],
    },

    /* ── 10 ────────────────────────────────────────────────────────────────── */
    {
      title: 'what a hazard ratio is not',
      prose: `<p>The hazard ratio here is <b>${COX.hr[0].toFixed(2)}</b>. It says: at any instant, among people still event-free, arm B is failing at about ${COX.hr[0].toFixed(1)} times the rate of arm A.</p>
        <p>It is <em>not</em> a ratio of risks, or of median times, or of anything you can hand a patient. And it is a single number for the whole study, which is a real assumption with a real name.</p>
        <p><b>Proportional hazards</b> says the ratio is constant over time. Log the negative log of both survival curves: if the assumption holds, the two lines are parallel. Flip the toggle and watch what a treatment that works brilliantly at first and then stops working does to that picture — and to the single number that is supposed to summarise it.</p>`,
      controls: [
        { type: 'segment', key: 'arm', label: 'data', options: [
          { value: 'both', label: 'proportional', explain: 'The simulated arms, where the ratio really is constant.' },
          { value: 'cross', label: 'crossing', explain: 'An effect that reverses halfway. The assumption fails and the summary number is meaningless.' },
        ] },
      ],
      scene: s => scene10(s.arm),
      readouts: [
        { key: 'h', label: 'hazard ratio reported', tone: 'warm', get: s => (s.arm === 'cross' ? CROSS.cox.hr[0] : COX.hr[0]), d: 3 },
        { key: 'p', label: 'log-rank p', tone: 'gold', get: s => st.fmtP(s.arm === 'cross' ? CROSS.lr.p : LR.p) },
        { key: 'v', label: 'is one number honest here?', tone: 'green', wide: true,
          get: s => (s.arm === 'cross' ? 'no — the sign reverses' : 'yes — lines stay parallel') },
      ],
    },

  ],
};

/* ── the crossing-hazards counterexample ──────────────────────────────────── */

const CROSS = (() => {
  const r = st.rng(77);
  const make = g => range(90).map(i => {
    // early hazard high for g=1, late hazard high for g=0: the curves cross
    const early = st.randExp(r, g ? 0.13 : 0.035);
    const late = 12 + st.randExp(r, g ? 0.03 : 0.11);
    const trueT = Math.min(early < 12 ? early : Infinity, late);
    const cT = Math.min(st.randExp(r, 0.015), 60);
    return { id: i, group: g, trueT, t: +Math.min(trueT, cT).toFixed(2), event: trueT <= cT ? 1 : 0, x: [g] };
  });
  const a = make(0), b = make(1);
  return { a, b, km: { 0: kaplanMeier(a), 1: kaplanMeier(b) }, lr: logRank(a, b), cox: coxPH([...a, ...b]) };
})();

/* ── risk set at a chosen time ────────────────────────────────────────────── */

function riskAt(tt) {
  const n = WARD.filter(r => r.t >= tt).length;
  const d = WARD.filter(r => Math.abs(r.t - tt) < 0.5 && r.event).length;
  return { n, d };
}

/* ── scenes ───────────────────────────────────────────────────────────────── */

function scene1(upTo) {
  const f = swimFrame();
  return [
    axes(f, { xLabel: 'months since entry', showY: false, xN: 6, grid: true }),
    swimmers(f, WARD, { upTo }),
    label('l-key1', f.x1 - 6, f.y1 - 12, '● event    → still event-free when we stopped looking', { cls: 'lab-sm lab-end' }),
  ];
}

function scene2(mode) {
  const f = swimFrame();
  const out = [axes(f, { xLabel: 'months since entry', showY: false, xN: 6 })];
  WARD.forEach((r, i) => {
    const y = f.sy(i);
    const gone = mode === 'drop' && !r.event;
    const asEv = mode === 'asevent' && !r.event;
    out.push({
      key: `s2-line-${r.id}`, tag: 'line',
      cls: r.event ? 'stick stick-pos' : 'stick stick-neg',
      opacity: gone ? 0.07 : 1,
      attrs: { x1: f.sx(0), y1: y, x2: f.sx(r.t), y2: y },
    });
    out.push(label(`s2-name-${r.id}`, f.x0 - 12, y + 4, r.name, {
      cls: 'lab-sm lab-end', opacity: gone ? 0.15 : 1,
    }));
    if (mode === 'truth' && !r.event) {
      out.push({
        key: `s2-true-${r.id}`, tag: 'line', cls: 'curve curve-ghost curve-dash',
        attrs: { x1: f.sx(r.t), y1: y, x2: f.sx(Math.min(r.trueT, 26)), y2: y },
      });
      out.push({
        key: `s2-truept-${r.id}`, tag: 'circle', cls: 'pt pt-ghost',
        attrs: { cx: f.sx(Math.min(r.trueT, 26)), cy: y, r: 5 },
        tip: `${r.name}: the event really happened at ${r.trueT.toFixed(1)} months`,
      });
    }
    if (r.event || asEv) {
      out.push({
        key: `s2-end-${r.id}`, tag: 'circle',
        cls: asEv ? 'pt pt-warm' : 'pt pt-warm', opacity: gone ? 0.07 : 1,
        attrs: { cx: f.sx(r.t), cy: y, r: 5.5 },
      });
    } else {
      out.push(label(`s2-end-${r.id}`, f.sx(r.t) + 3, y + 5, '→', {
        cls: 'lab lab-cold', opacity: gone ? 0.1 : 1,
      }));
    }
  });
  const note = {
    seen: 'what the study recorded',
    drop: 'the four censored lines, deleted',
    asevent: 'the four arrows, promoted to events they never had',
    truth: 'faint: where the events really were',
  }[mode];
  out.push(label('s2-note', f.midX, f.y1 - 12, note, { cls: 'lab-sm lab-mid lab-gold' }));
  return out;
}

function scene3(upTo) {
  const f = frame({ w: 720, h: 500, l: 66, r: 130, t: 34, b: 58 })
    .setX(0, 0.8).setY(0, 14);
  const series = [
    { key: 'truth', get: r => r.truth, cls: 'curve curve-dash', lab: 'the truth', labCls: 'lab-sm' },
    { key: 'drop', get: r => r.drop, cls: 'curve curve-warm', lab: 'drop censored', labCls: 'lab-sm lab-warm' },
    { key: 'asev', get: r => r.asEvent, cls: 'curve curve-cold', lab: 'count as events', labCls: 'lab-sm lab-cold' },
    { key: 'km', get: r => r.km, cls: 'curve curve-fit', lab: 'kaplan–meier', labCls: 'lab-sm lab-green' },
  ];
  const out = [axes(f, { xLabel: 'fraction of people censored', yLabel: 'estimated median months', xN: 5, yN: 7, xFmt: v => (v * 100).toFixed(0) + '%' })];
  series.slice(0, upTo + 1).forEach((s, si) => {
    const pts = BIAS.map(r => [r.censored, s.get(r)]);
    out.push(path(`s3-${s.key}`, pts.map(([a, b]) => [f.sx(a), f.sy(b)]), { cls: s.cls, delay: si * 120 }));
    out.push(...points(f, pts.map(([a, b]) => ({ x: a, y: b })), {
      key: `s3-p-${s.key}`, r: 4, cls: s.cls.includes('warm') ? 'pt pt-warm'
        : s.cls.includes('cold') ? 'pt pt-cold' : s.cls.includes('fit') ? 'pt pt-green' : 'pt pt-ghost',
      delay: si * 120,
    }));
    const last = pts[pts.length - 1];
    out.push(label(`s3-l-${s.key}`, f.sx(last[0]) + 12, f.sy(last[1]) + 4 + (si === 2 ? 14 : si === 1 ? -8 : 0),
      s.lab, { cls: s.labCls, delay: si * 120 }));
  });
  return out;
}

function scene4(tt) {
  const f = swimFrame();
  const risk = WARD.filter(r => r.t >= tt);
  const out = [
    axes(f, { xLabel: 'months since entry', showY: false, xN: 6 }),
    vLine(f, tt, { key: 's4-now', cls: 'rule rule-gold' }),
    label('s4-now-l', f.sx(tt), f.y1 - 12, `t = ${tt}`, { cls: 'lab lab-gold lab-mid' }),
  ];
  WARD.forEach((r, i) => {
    const y = f.sy(i);
    const inRisk = r.t >= tt;
    out.push({
      key: `s4-line-${r.id}`, tag: 'line',
      cls: inRisk ? 'stick stick-x' : 'stick',
      opacity: inRisk ? 1 : 0.18,
      attrs: { x1: f.sx(0), y1: y, x2: f.sx(r.t), y2: y },
    });
    out.push(label(`s4-name-${r.id}`, f.x0 - 12, y + 4, r.name, {
      cls: 'lab-sm lab-end' + (inRisk ? ' lab-cyan' : ''), opacity: inRisk ? 1 : 0.3,
    }));
    if (r.event) out.push({
      key: `s4-end-${r.id}`, tag: 'circle', cls: 'pt pt-warm',
      opacity: inRisk ? 1 : 0.18, attrs: { cx: f.sx(r.t), cy: y, r: 5.5 },
    });
    else out.push(label(`s4-end-${r.id}`, f.sx(r.t) + 3, y + 5, '→', {
      cls: 'lab lab-cold', opacity: inRisk ? 1 : 0.18,
    }));
  });
  out.push(label('s4-count', f.x1 - 6, f.y1 - 12, `${risk.length} still at risk`, { cls: 'lab lab-cyan lab-end' }));
  return out;
}

function scene5(upTo) {
  const f = curveFrame();
  const shown = WARD_KM.slice(0, upTo);
  const last = shown[shown.length - 1];
  const out = [
    axes(f, { xLabel: 'months', yLabel: 'still event-free', yN: 6, xN: 6, yFmt: v => v.toFixed(1) }),
    path('s5-curve', kmPts(shown, last ? last.t : 0).map(([a, b]) => [f.sx(a), f.sy(b)]), { cls: 'curve curve-warm' }),
  ];
  shown.forEach(k => {
    out.push({
      key: `s5-drop-${k.t}`, tag: 'line', cls: 'stick stick-pos',
      attrs: { x1: f.sx(k.t), y1: f.sy(k.s / (1 - k.d / k.n)), x2: f.sx(k.t), y2: f.sy(k.s) },
      tip: `${k.d} of ${k.n} → × ${(1 - k.d / k.n).toFixed(3)}`,
    });
  });
  WARD.filter(r => !r.event && (!last || r.t <= last.t)).forEach(r => {
    const y = f.sy(survivalAt(shown, r.t));
    out.push({
      key: `s5-cens-${r.id}`, tag: 'line', cls: 'stick stick-neg',
      attrs: { x1: f.sx(r.t), y1: y - 9, x2: f.sx(r.t), y2: y + 9 },
      tip: `${r.name} censored at ${r.t.toFixed(1)} — no step down, but the risk set is one smaller from here on`,
    });
  });
  if (shown.length) out.push(label('s5-key', f.x0 + 6, f.y1 + 4, '│ censored — the curve does not step', { cls: 'lab-sm lab-cold' }));
  if (last) {
    out.push(numLabel('s5-s', f.sx(last.t) + 10, f.sy(last.s) - 8, last.s, { cls: 'lab-big lab-gold', d: 3 }));
    out.push(label('s5-frac', f.x1 - 6, f.y1 + 6, `${last.d} / ${last.n} at t = ${last.t.toFixed(1)}`, { cls: 'lab-sm lab-end lab-cyan' }));
  }
  return out;
}

function scene6(showCI) {
  const f = curveFrame();
  const pts = kmPts(WARD_KM, 26);
  const out = [axes(f, { xLabel: 'months', yLabel: 'still event-free', yN: 6, xN: 6, yFmt: v => v.toFixed(1) })];
  if (showCI) {
    const hi = [[0, 1]], lo = [[0, 1]];
    let h = 1, l = 1;
    for (const k of WARD_KM) {
      hi.push([k.t, h]); lo.push([k.t, l]);
      h = k.hi; l = k.lo;
      hi.push([k.t, h]); lo.push([k.t, l]);
    }
    hi.push([26, h]); lo.push([26, l]);
    out.push(path('s6-band', [...hi, ...lo.slice().reverse()].map(([a, b]) => [f.sx(a), f.sy(b)]),
      { cls: 'area area-warm', close: true, opacity: 0.55 }));
  }
  out.push(path('s6-curve', pts.map(([a, b]) => [f.sx(a), f.sy(b)]), { cls: 'curve curve-warm' }));
  const med = medianSurvival(WARD_KM);
  if (med != null) {
    out.push(hLine(f, 0.5, { key: 's6-half', cls: 'rule rule-dash' }));
    out.push(vLine(f, med, { key: 's6-med', cls: 'rule rule-gold', y1: f.sy(0.5) }));
    out.push(label('s6-medl', f.sx(med) + 8, f.sy(0.5) - 8, `median ${med.toFixed(1)} mo`, { cls: 'lab lab-gold' }));
  }
  const end = WARD_KM[WARD_KM.length - 1];
  out.push(label('s6-tail', f.x1 - 6, f.y1 + 10,
    showCI ? `${end.n} person still at risk out here` : 'turn the band on', { cls: 'lab-sm lab-end lab-cold' }));
  return out;
}

function scene7(upTo) {
  const f = curveFrame();
  const out = [axes(f, { xLabel: 'months', yLabel: 'still event-free', yN: 6, xN: 6, yFmt: v => v.toFixed(1) })];
  const arms = [
    { g: 0, cls: 'curve curve-warm', lab: 'arm A' },
    { g: 1, cls: 'curve curve-cold', lab: 'arm B' },
  ];
  arms.slice(0, Math.min(upTo + 1, 2)).forEach((a, i) => {
    const pts = kmPts(ARM_KM[a.g], 26);
    out.push(path(`s7-${a.g}`, pts.map(([x, y]) => [f.sx(x), f.sy(y)]), { cls: a.cls, delay: i * 200 }));
    const last = pts[pts.length - 1];
    out.push(label(`s7-l-${a.g}`, f.sx(last[0]) - 6, f.sy(last[1]) - 10, a.lab, {
      cls: `lab lab-end lab-${a.g ? 'cold' : 'warm'}`, delay: i * 200,
    }));
  });
  if (upTo >= 2) {
    const m0 = medianSurvival(ARM_KM[0]), m1 = medianSurvival(ARM_KM[1]);
    out.push(hLine(f, 0.5, { key: 's7-half', cls: 'rule rule-dash' }));
    if (m0 != null && m1 != null) {
      out.push({
        key: 's7-gap', tag: 'line', cls: 'arrow arrow-warm',
        attrs: { x1: f.sx(m1), y1: f.sy(0.5), x2: f.sx(m0), y2: f.sy(0.5) },
      });
      out.push(label('s7-gapl', f.sx((m0 + m1) / 2), f.sy(0.5) - 12,
        `${(m0 - m1).toFixed(1)} months of median`, { cls: 'lab lab-mid lab-gold' }));
    }
  }
  return out;
}

function scene8() {
  const rows = LR.table.filter((_, i) => i % Math.ceil(LR.table.length / 11) === 0).slice(0, 11);
  const f = frame({ w: 720, h: 500 });
  const x = [56, 178, 300, 412, 524, 648];
  const head = ['event time', 'at risk (A / B)', 'events', 'expected in B', 'observed in B', 'O − E'];
  const out = [
    label('s8-t', 36, 42, 'one row per event time · every quantity is a count of people standing there', { cls: 'lab-sm lab-gold' }),
    ...head.map((hd, i) => label(`s8-h${i}`, x[i], 70, hd, {
      cls: 'lab-sm lab-cyan' + (i >= 2 ? ' lab-end' : ''),
    })),
    { key: 's8-rule', tag: 'line', cls: 'rule rule-faint', attrs: { x1: 36, y1: 80, x2: 686, y2: 80 } },
  ];
  let run = 0;
  rows.forEach((r, i) => {
    const y = 106 + i * 33;
    run += r.d1 - r.e1;
    out.push(rect(`s8-bg${i}`, 36, y - 15, 650, 27, { cls: 'sq sq-dim', opacity: i % 2 ? 0.5 : 0.16, delay: i * 50 }));
    out.push(label(`s8-a${i}`, x[0], y + 3, r.t.toFixed(1), { cls: 'lab', delay: i * 50 }));
    out.push(label(`s8-b${i}`, x[1], y + 3, `${r.n0} / ${r.n1}`, { cls: 'lab lab-cyan', delay: i * 50 }));
    out.push(label(`s8-c${i}`, x[2], y + 3, String(r.d), { cls: 'lab lab-end', delay: i * 50 }));
    out.push(label(`s8-d${i}`, x[3], y + 3, r.e1.toFixed(3), { cls: 'lab lab-end lab-cold', delay: i * 50 }));
    out.push(label(`s8-e${i}`, x[4], y + 3, String(r.d1), { cls: 'lab lab-end lab-warm', delay: i * 50 }));
    out.push(label(`s8-f${i}`, x[5], y + 3, (r.d1 - r.e1).toFixed(3), {
      cls: `lab lab-end lab-${r.d1 - r.e1 > 0 ? 'warm' : 'cold'}`, delay: i * 50,
    }));
  });
  out.push(label('s8-sum', x[5], 106 + rows.length * 33 + 18,
    `over all ${LR.table.length} event times:  O − E = ${(LR.O - LR.E).toFixed(2)}`,
    { cls: 'lab-big lab-end lab-gold' }));
  return out;
}

function scene9(stage) {
  const at = 8;
  // take from both arms alternately — a risk set that is all one group would
  // make the question the picture is asking impossible to see
  const inA = ARM[0].filter(r => r.t >= at), inB = ARM[1].filter(r => r.t >= at);
  const risk = [];
  for (let i = 0; i < 7; i++) { if (inA[i]) risk.push(inA[i]); if (inB[i]) risk.push(inB[i]); }
  const failed = risk.find(r => r.group === 1 && r.event) || risk.find(r => r.group === 1) || risk[0];
  const out = [
    label('s9-t', 360, 44, `the risk set an instant before t = ${at} months`, { cls: 'lab lab-mid lab-gold' }),
    label('s9-t2', 360, 62, `${inA.length} still going in arm A · ${inB.length} in arm B`, { cls: 'lab-sm lab-mid' }),
  ];
  risk.forEach((r, i) => {
    const cx = 76 + (i % 7) * 95;
    const cy = 116 + Math.floor(i / 7) * 76;
    const isIt = stage >= 1 && r === failed;
    out.push({
      key: `s9-p${i}`, tag: 'circle',
      cls: isIt ? 'pt pt-warm' : r.group ? 'pt pt-cold' : 'pt',
      attrs: { cx, cy, r: isIt ? 16 : 11 }, delay: i * 40,
      opacity: stage >= 1 && !isIt ? 0.35 : 1,
      tip: `arm ${r.group ? 'B' : 'A'}, still event-free at ${at} months`,
    });
    out.push(label(`s9-l${i}`, cx, cy + 28, r.group ? 'B' : 'A', {
      cls: `lab-sm lab-mid${isIt ? ' lab-warm' : ''}`, delay: i * 40,
      opacity: stage >= 1 && !isIt ? 0.4 : 1,
    }));
  });
  if (stage >= 1) {
    out.push(label('s9-q', 360, 288, 'given that somebody failed right now,', { cls: 'lab lab-mid' }));
    out.push(label('s9-q2', 360, 312, 'what is the chance it was this one?', { cls: 'lab-big lab-mid lab-warm' }));
  }
  if (stage >= 2) {
    out.push(rect('s9-box', 70, 336, 580, 142, { cls: 'plate' }));
    // the two h₀(t) are drawn as their own labels so they can be greyed out
    // exactly where they sit, rather than struck through at a guessed position
    // struck through, not painted over: you have to be able to read what it is
    // that cancels
    out.push(label('s9-h1', 268, 372, 'h₀(t)', { cls: 'lab-big lab-mid', opacity: 0.5 }));
    out.push({ key: 's9-h1x', tag: 'line', cls: 'stick stick-neg',
      attrs: { x1: 236, y1: 380, x2: 300, y2: 358 } });
    out.push(label('s9-n1', 380, 372, '·  e^(β xᵢ)', { cls: 'lab-big lab-mid lab-gold' }));
    out.push({ key: 's9-bar', tag: 'line', cls: 'rule rule-gold', attrs: { x1: 150, y1: 388, x2: 570, y2: 388 } });
    out.push(label('s9-s', 176, 412, '∑ over the risk set of', { cls: 'lab lab-mid' }));
    out.push(label('s9-h2', 330, 412, 'h₀(t)', { cls: 'lab-big lab-mid', opacity: 0.5 }));
    out.push({ key: 's9-h2x', tag: 'line', cls: 'stick stick-neg',
      attrs: { x1: 298, y1: 420, x2: 362, y2: 398 } });
    out.push(label('s9-n2', 442, 412, '·  e^(β xⱼ)', { cls: 'lab-big lab-mid lab-gold' }));
    out.push(label('s9-cancel', 360, 448, 'the same h₀(t) multiplies every term above and below', { cls: 'lab-sm lab-mid lab-green' }));
    out.push(label('s9-cancel2', 360, 466, 'so it divides out, and is never estimated at all', { cls: 'lab-sm lab-mid lab-green' }));
  }
  return out;
}

function scene10(kind) {
  const f = curveFrame();
  const km = kind === 'cross' ? CROSS.km : ARM_KM;
  const out = [axes(f, { xLabel: 'months', yLabel: 'still event-free', yN: 6, xN: 6, yFmt: v => v.toFixed(1) })];
  [0, 1].forEach(g => {
    const pts = kmPts(km[g], 26);
    out.push(path(`s10-${g}`, pts.map(([x, y]) => [f.sx(x), f.sy(y)]), {
      cls: g ? 'curve curve-cold' : 'curve curve-warm',
    }));
    const last = pts[pts.length - 1];
    out.push(label(`s10-l-${g}`, f.sx(last[0]) - 6, f.sy(last[1]) + (g ? 18 : -10), g ? 'arm B' : 'arm A', {
      cls: `lab lab-end lab-${g ? 'cold' : 'warm'}`,
    }));
  });
  out.push(label('s10-note', f.midX, f.y1 - 12,
    kind === 'cross'
      ? 'the curves cross — one hazard ratio cannot describe both halves'
      : 'the gap holds its shape — one hazard ratio is a fair summary',
    { cls: `lab-sm lab-mid lab-${kind === 'cross' ? 'warm' : 'green'}` }));
  return out;
}
