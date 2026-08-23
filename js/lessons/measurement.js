/* ─────────────────────────────────────────────────────────────────────────────
   measurement.js — measurement & reliability.

   The most skipped topic in applied statistics, and the one that quietly
   decides whether any of the rest of it meant anything. Every other lesson
   here assumes the numbers in the column *are* the quantity of interest. This
   one takes that assumption apart and puts it back together.

   Everything rests on one construction: a fixed orthonormal basis over twelve
   people, so that "true score" and "measurement error" are exactly
   uncorrelated in the sample on screen. Every identity claimed below —
   variance adds, test–retest r equals reliability, Spearman–Brown, alpha,
   attenuation — is then exactly true of the dots you are looking at, not true
   on average in the long run. Check the arithmetic against the picture; it
   agrees to the last decimal.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, points, label, numLabel, path, rect, arrowDefs } from '../core/plot.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sqrt, sub, sup, bar, sumOver, paren, eq, minus, plus, times, op } from '../core/fx.js';

/* ── the construction ─────────────────────────────────────────────────────── */

const NP = 12;   // people
const NK = 8;    // items available

const centre = v => { const m = st.mean(v); return v.map(x => x - m); };
const dotp = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const orth = (v, u) => { const d = dotp(u, u); return d < 1e-12 ? v : v.map((x, i) => x - (dotp(v, u) / d) * u[i]); };
const unit = v => { const s = st.sd(v); return v.map(x => x / s); };

/** mean-zero, unit-sd, mutually uncorrelated columns over the twelve people */
const BASIS = (() => {
  const r = st.rng(20260823);
  const out = [];
  let guard = 0;
  while (out.length < NP - 1 && guard++ < 400) {
    let v = centre(range(NP).map(() => st.randNorm(r, 0, 1)));
    for (const u of out) v = orth(v, u);
    if (st.sd(v) < 1e-6) continue;
    out.push(unit(v));
  }
  return out;
})();

const TZ = BASIS[0];                         // the true-score direction
const EZ = range(NK).map(j => BASIS[j + 1]); // one error column per item

const NAMES = ['Ali', 'Bea', 'Cam', 'Dev', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo', 'Kit', 'Lou'];
const MID = 62;

const trueOf = (s, i) => MID + s.trueSd * TZ[i];
const trues = s => range(NP).map(i => trueOf(s, i));
const errK = (s, i, k) => st.mean(range(k).map(j => EZ[j][i])) * s.errSd;
const obsOf = (s, i, k = s.k) => trueOf(s, i) + errK(s, i, k);
const observed = (s, k = s.k) => range(NP).map(i => obsOf(s, i, k));

/* exact by construction — no sampling slop */
const varT = s => s.trueSd * s.trueSd;
const varE = (s, k = s.k) => (s.errSd * s.errSd) / k;
const varX = (s, k = s.k) => varT(s) + varE(s, k);
const rel = (s, k = s.k) => varX(s, k) > 0 ? varT(s) / varX(s, k) : 1;

/** alpha needs k − 1 in a denominator, so this step never sees a one-item scale */
const kA = s => clamp(s.k, 2, NK);

/** two administrations, each with its own independent error column */
const admin = (s, which) => range(NP).map(i => trueOf(s, i) + s.errSd * EZ[which][i]);

/* one person, measured over and over: Ali is person 0 */
const REP = (() => { const r = st.rng(515); return unit(centre(range(24).map(() => st.randNorm(r, 0, 1)))); })();
const repOf = (s, j) => trueOf(s, 0) + s.errSd * REP[j];

/* ── shared marks ─────────────────────────────────────────────────────────── */

const R = () => { const f = frame({ w: 720, h: 540, l: 78, r: 48, t: 92, b: 152 }); f.setX(36, 90); return f; };
const dotY = (f, j) => f.y0 - 46 - j * 10.5;

function ruler(f, { text = 'reading score (points)', lo = 40, hi = 88, step = 4, dur } = {}) {
  const out = [{ key: 'rl', tag: 'line', cls: 'ax-line', dur, attrs: { x1: f.x0, y1: f.y0, x2: f.x1, y2: f.y0 } }];
  for (let v = lo; v <= hi; v += step) {
    out.push({ key: 'rt' + v, tag: 'line', cls: 'ax-line', dur, attrs: { x1: f.sx(v), y1: f.y0, x2: f.sx(v), y2: f.y0 + 6 } });
    out.push(label('rn' + v, f.sx(v), f.y0 + 21, String(v), { cls: 'ax-tick', dur }));
  }
  out.push(label('rlab', (f.x0 + f.x1) / 2, f.y0 + 46, text, { cls: 'ax-label', dur }));
  return out;
}

/** the twelve people, laid out left to right, with a y-domain that only moves in steps of 5 */
function peopleFrame(s, { r = 56, t = 58, b = 86, k = s.k, extra = [] } = {}) {
  const f = frame({ w: 720, h: 540, l: 70, r, t, b });
  f.setX(-0.7, NP - 0.3);
  const all = [...trues(s), ...observed(s, k), ...extra];
  const m = Math.max(...all.map(v => Math.abs(v - MID)));
  const half = Math.ceil((m + 4) / 5) * 5;
  f.setY(MID - half, MID + half);
  return f;
}

function peopleAxis(f, { names = true, dur } = {}) {
  const out = [
    { key: 'pax', tag: 'line', cls: 'ax-line', dur, attrs: { x1: f.x0, y1: f.y0, x2: f.x1, y2: f.y0 } },
    { key: 'pay', tag: 'line', cls: 'ax-line', dur, attrs: { x1: f.x0, y1: f.y0, x2: f.x0, y2: f.y1 } },
  ];
  const yt = [f.dy[0], (f.dy[0] + f.dy[1]) / 2, f.dy[1]];
  yt.forEach((v, i) => out.push(label('payt' + i, f.x0 - 9, f.sy(v) + 4, String(Math.round(v)), { cls: 'ax-tick ax-tick-y', dur })));
  if (names) range(NP).forEach(i => out.push(
    label('pn' + i, f.sx(i), f.y0 + 18, NAMES[i], { cls: 'ax-tick', dur })));
  return out;
}

/** a true score: a short horizontal bar, because it is a value not a measurement */
const trueTick = (f, i, v, o = {}) => rect(`tt-${i}`, f.sx(i) - 11, f.sy(v) - 1.5, 22, 3, {
  cls: 'bar link-true', ...o,
});

/** the error: a stick from the true score to the observation. this is E. */
const errStick = (f, i, tv, ov, o = {}) => path(`es-${i}`, [[f.sx(i), f.sy(tv)], [f.sx(i), f.sy(ov)]], {
  cls: 'stick ' + (ov >= tv ? 'stick-pos' : 'stick-neg') + ' link-err', ...o,
});

const obsDot = (f, i, v, o = {}) => ({
  key: `od-${i}`, tag: 'circle', cls: 'pt pt-cyan link-obs',
  attrs: { cx: f.sx(i), cy: f.sy(v), r: 6 },
  enter: { attrs: { r: 0 }, opacity: 0 },
  ...o,
});

/** a square standing on a baseline, sized by a standard deviation */
function sdSquare(key, cx, base, side, { cls = 'sq sq-x', dur, delay = 0, opacity = 1 } = {}) {
  return rect(key, cx - side / 2, base - side, side, side, { cls, dur, delay, opacity });
}

/* ── formula pieces, wired to the drawing ─────────────────────────────────── */

const fX = t('X', { explain: 'The observed score — the number that actually lands in your spreadsheet.', link: 'obs', tone: 'cyan' });
const fT = t('T', { explain: 'The true score: what this person would average over infinitely many measurements. Real, and permanently unobservable.', link: 'true', tone: 'gold' });
const fE = t('E', { explain: 'Measurement error for this one occasion. Random, mean zero, and uncorrelated with the true score by definition.', link: 'err', tone: 'warm' });
const vT = t('s' + sup('', '2') + sub('', 'T'), { explain: 'Variance of the true scores: how much people genuinely differ.', link: 'true', tone: 'gold' });
const vE = t('s' + sup('', '2') + sub('', 'E'), { explain: 'Variance of the measurement error: how much the instrument wobbles.', link: 'err', tone: 'warm' });
const vX = t('s' + sup('', '2') + sub('', 'X'), { explain: 'Variance of the observed scores — the only one of the three you can compute from your data.', link: 'obs', tone: 'cyan' });
const rho = t('ρ', { explain: 'Reliability: the share of observed variance that is true-score variance. Between 0 and 1.', tone: 'green' });

export default {
  meta: {
    id: 'measurement', title: 'measurement & reliability', short: 'measurement',
    kicker: 'BEFORE ANY OF THE REST OF IT', status: 'live',
    deck: 'Every other lesson on this site starts with a column of numbers and treats them as the thing itself. They are not. A score is a true value plus an error, and the share that is true has a name, a formula, and consequences for every correlation you will ever report.',
    dataNote: 'Twelve people, measured with an instrument whose noise you control. The true scores are visible here only because this world is simulated — that is the whole difficulty, staged so you can watch it.',
    deps: ['correlation'], unlocks: [],
    next: 'linreg', nextLabel: 'linear regression',
    outro: 'you cannot fix a measurement problem downstream. no model repairs a ruler.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: {
    trueSd: 12, errSd: 9, k: 1, reps: 1,
    relX: 0.80, relY: 0.80, rTrue: 0.60,
    bias: 0, noise: 9, target: 'rv',
  },

  steps: [

    /* ── 1 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'one person, one number',
      prose: `<p>Nothing here yet but a ruler.</p>
        <p>Ali sits a reading test on Monday and scores <strong>62</strong>. That is the entire dataset. One person, one occasion, one number.</p>
        <p>You would be forgiven for treating that 62 as a fact about Ali, in the way that her height is a fact about her. Hold that thought for one step.</p>`,
      beats: [
        {
          label: 'a ruler', hold: 1300,
          note: 'A scale with nothing on it. Every number in every other lesson arrived on one of these.',
          scene: s => { const f = R(); return ruler(f); },
        },
        {
          label: 'the score',
          note: 'Ali, Monday: <b>62</b>. One observation.',
          scene: s => {
            const f = R();
            return [
              ruler(f),
              { key: 'ali', tag: 'circle', cls: 'pt pt-cyan link-obs', attrs: { cx: f.sx(62), cy: dotY(f, 0), r: 8 }, enter: { attrs: { r: 0 }, opacity: 0 }, tip: '<b>Ali</b><br>Monday<br>score = 62' },
              label('alil', f.sx(62), dotY(f, 0) - 20, 'Ali · Monday', { cls: 'lab lab-mid lab-cyan' }),
              numLabel('aliv', f.sx(62), dotY(f, 0) + 5, 62, { cls: 'lab-sm lab-mid', d: 0, from: 0 }),
            ];
          },
        },
      ],
    },

    /* ── 2 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'measure her again',
      prose: `<p>Tuesday, same test, same room, same girl. <strong>66</strong>.</p>
        <p>Wednesday: <strong>57</strong>. Thursday: <strong>64</strong>.</p>
        <p>Ali did not become a better reader overnight and then a worse one. Nothing about her changed by nine points in forty-eight hours. So the number moved without the person moving, which means the number was never only about the person.</p>
        <p>That is the entire problem, and everything else on this page is bookkeeping about it.</p>`,
      beats: [
        { label: 'monday', hold: 1000, note: 'Monday: <b>62</b>.', scene: s => oneDay(s, 0) },
        { label: 'tuesday', hold: 1000, note: 'Tuesday: <b>66</b>. The dot moved four points to the right.', scene: s => oneDay(s, 1) },
        { label: 'wednesday', hold: 1000, note: 'Wednesday: <b>57</b>. Now nine points the other way.', scene: s => oneDay(s, 2) },
        { label: 'thursday', hold: 1400, note: 'Thursday: <b>64</b>.', scene: s => oneDay(s, 3) },
        {
          label: 'all four',
          note: 'Four numbers for one unchanged person. Whatever a score is, it is not simply the person.',
          scene: s => {
            const f = R();
            const vals = [62, 66, 57, 64];
            return [
              ruler(f),
              vals.map((v, j) => ([
                { key: 'ali' + j, tag: 'circle', cls: 'pt pt-cyan link-obs', attrs: { cx: f.sx(v), cy: dotY(f, 0), r: 7 }, opacity: 0.9, enter: { attrs: { r: 0 }, opacity: 0 }, tip: `<b>Ali</b><br>${['Mon', 'Tue', 'Wed', 'Thu'][j]}<br>score = ${v}` },
                label('alin' + j, f.sx(v), dotY(f, 0) - 16, ['Mon', 'Tue', 'Wed', 'Thu'][j], { cls: 'lab-sm lab-mid' }),
              ])),
              label('spread', f.sx(61.5), dotY(f, 0) - 52, 'one person · four occasions', { cls: 'lab lab-mid lab-cyan' }),
            ];
          },
        },
      ],
    },

    /* ── 3 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'so the number has two parts',
      prose: `<p>Split it. Say there is a value that <em>is</em> about Ali — call it her <strong>true score</strong>, T — and that each occasion adds a nudge on top of it, call that <strong>error</strong>, E.</p>
        <p>Then what you wrote down is <em>X = T + E</em>. Not a model with assumptions to check: a definition. E is <em>defined</em> as whatever the gap turned out to be, which is why it costs nothing to write.</p>
        <p>What it buys is a place to put the wobble. Drag the noise dial and watch the dot move while the dashed line stays exactly where it is. The line is Ali. The dot is Monday.</p>`,
      formula: formula(
        fX + eq + fT + plus + fE +
        op('&nbsp;&nbsp;&nbsp;') + t('observed', { tone: 'muted', cls: 'fx-tiny' }) + op('&nbsp;=&nbsp;') +
        t('person', { tone: 'muted', cls: 'fx-tiny' }) + op('&nbsp;+&nbsp;') + t('occasion', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'hover any letter — the drawing answers' }),
      controls: [
        { type: 'slider', key: 'errSd', label: 'measurement noise', min: 0, max: 16, step: 0.5, fast: true, fmt: v => (+v).toFixed(1) },
      ],
      readouts: [
        { key: 'T', label: 'T &nbsp;true score', tone: 'gold', get: s => trueOf(s, 0), d: 1, explain: 'Fixed. It does not know what day it is.' },
        { key: 'E', label: 'E &nbsp;error today', tone: 'warm', get: s => s.errSd * REP[0], d: 1, explain: 'This occasion only. Change the noise dial and this is what moves.' },
        { key: 'X', label: 'X &nbsp;what you record', tone: 'cyan', get: s => repOf(s, 0), d: 1, explain: 'The sum. The only one of the three that ends up in your data file.' },
      ],
      beats: [
        {
          label: 'the true score',
          note: 'A vertical line where Ali actually is. In real life this line is invisible; here it is drawn because the world is simulated.',
          scene: s => {
            const f = R(); const tv = trueOf(s, 0);
            return [
              ruler(f),
              { key: 'tline', tag: 'line', cls: 'rule rule-gold rule-dash link-true', attrs: { x1: f.sx(tv), y1: f.y0, x2: f.sx(tv), y2: f.y1 - 14 } },
              label('tlab', f.sx(tv), f.y1 - 22, 'T = Ali', { cls: 'lab lab-mid lab-gold' }),
            ];
          },
        },
        {
          label: 'today’s observation',
          note: 'Monday’s dot, sitting off the line.',
          scene: s => devScene(s, { showStick: false }),
        },
        {
          label: 'the gap is E',
          note: 'The stick between them <em>is</em> the error. Its length is E, and its sign says which way.',
          scene: s => devScene(s, { showStick: true, labelE: true }),
        },
        {
          label: 'turn the noise up',
          note: 'Drag <b>measurement noise</b>. The line does not move. Only the stick and the dot do — because only E depends on the occasion.',
          scene: s => devScene(s, { showStick: true, labelE: true, showSum: true }),
        },
      ],
    },

    /* ── 4 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'measure enough times and the error averages away',
      prose: `<p>If the nudges are random, they are as often up as down. So stack the occasions and take the mean, and the nudges start cancelling.</p>
        <p>Watch the running mean crawl toward the dashed line as observations pile up. It never quite lands, but it stops wandering.</p>
        <p>Which gives the true score a definition that is not hand-waving: <strong>T is the mean you would get from infinitely many measurements.</strong> That is not a philosophical claim about Ali's inner reading ability. It is a statement about a limit, and it is the only definition of "true score" anyone actually uses.</p>`,
      dep: { note: 'a mean converging as n grows is the same fact you met as the', lesson: 'clt', label: 'central limit theorem' },
      controls: [
        { type: 'slider', key: 'reps', label: 'occasions measured', min: 1, max: 24, step: 1, fast: true },
        { type: 'slider', key: 'errSd', label: 'measurement noise', min: 0, max: 16, step: 0.5, fast: true, fmt: v => (+v).toFixed(1) },
      ],
      readouts: [
        { key: 'n', label: 'occasions', get: s => s.reps, d: 0 },
        { key: 'm', label: 'mean of them', tone: 'cyan', get: s => st.mean(range(s.reps).map(j => repOf(s, j))), d: 2 },
        { key: 'T', label: 'true score T', tone: 'gold', get: s => trueOf(s, 0), d: 2 },
        { key: 'g', label: 'still off by', tone: 'warm', get: s => Math.abs(st.mean(range(s.reps).map(j => repOf(s, j))) - trueOf(s, 0)), d: 2 },
      ],
      beats: [
        { label: 'one', hold: 900, note: 'One occasion. The mean of one number is that number.', scene: s => repScene(s, 1) },
        { label: 'three', hold: 900, note: 'Three. Already the mean sits closer than most of the individual dots.', scene: s => repScene(s, 3) },
        { label: 'eight', hold: 900, note: 'Eight.', scene: s => repScene(s, 8) },
        { label: 'twenty-four', hold: 1600, note: 'Twenty-four. The cyan marker has all but merged with the line.', scene: s => repScene(s, 24) },
        {
          label: 'your turn',
          note: 'Drag <b>occasions measured</b> yourself, then drag the noise up and watch how many more occasions it takes to get as close.',
          scene: s => repScene(s, s.reps),
        },
      ],
    },

    /* ── 5 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'now twelve people, measured once each',
      prose: `<p>Nobody measures one person twenty-four times. You measure a lot of people once, which is the situation that makes this hard.</p>
        <p>Twelve people. Each has her own true score — the gold bars — and each is measured once, giving the cyan dots. The stick between them is that person's error, exactly as it was for Ali.</p>
        <p>Two different things are now spreading the dots out, and they are not the same thing at all. <strong>People genuinely differ</strong> from each other. <strong>The instrument wobbles</strong> on each of them. Both widen the cloud; only one of them is information.</p>`,
      controls: [
        { type: 'slider', key: 'trueSd', label: 'how much people differ', min: 3, max: 14, step: 0.5, fast: true, fmt: v => (+v).toFixed(1) },
        { type: 'slider', key: 'errSd', label: 'measurement noise', min: 0, max: 16, step: 0.5, fast: true, fmt: v => (+v).toFixed(1) },
      ],
      readouts: [
        { key: 'sT', label: 'sd of true scores', tone: 'gold', get: s => s.trueSd, d: 2 },
        { key: 'sE', label: 'sd of the errors', tone: 'warm', get: s => s.errSd, d: 2 },
        { key: 'sX', label: 'sd of what you saw', tone: 'cyan', get: s => Math.sqrt(varX(s, 1)), d: 2 },
      ],
      beats: [
        {
          label: 'the people', hold: 1300,
          note: 'Twelve true scores. This is the thing you are trying to learn about, and in real life you never see this frame.',
          scene: s => {
            const f = peopleFrame(s, { k: 1 });
            return [peopleAxis(f), trues(s).map((v, i) => trueTick(f, i, v, { delay: i * 45, tip: `<b>${NAMES[i]}</b><br>true score = ${v.toFixed(1)}` }))];
          },
        },
        {
          label: 'measure them', hold: 1400,
          note: 'One measurement each. Every dot lands somewhere near its bar, and never exactly on it.',
          scene: s => peopleScene(s, { k: 1, sticks: false }),
        },
        {
          label: 'the errors',
          note: 'Twelve sticks. Same object as Ali’s gap in step 3 — one per person now.',
          scene: s => peopleScene(s, { k: 1, sticks: true }),
        },
        {
          label: 'hide the truth',
          note: 'This is your actual data: twelve dots, no bars, no sticks. Everything from here has to be recovered from this.',
          scene: s => peopleScene(s, { k: 1, sticks: false, hideTrue: true }),
        },
      ],
    },

    /* ── 6 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'the two spreads add — as areas',
      prose: `<p>You already know what to do with a spread: square the deviations and average them. That is variance, and you built it by hand in <em>correlation</em> — a length becoming an area.</p>
        <p>Do it three times. Once on the gold bars, giving <em>s²<sub>T</sub></em>. Once on the sticks, giving <em>s²<sub>E</sub></em>. Once on the cyan dots, giving <em>s²<sub>X</sub></em>.</p>
        <p>The third square is exactly the first two put together. Not roughly — exactly, and for a reason: error is uncorrelated with true score, and uncorrelated means at right angles, and at right angles means Pythagoras.</p>`,
      formula: formula(
        vX + eq + vT + plus + vE + '<br>' +
        t('because', { tone: 'muted', cls: 'fx-tiny' }) + op('&nbsp;') +
        t('cov(T, E) = 0', { tone: 'muted', explain: 'By definition of E as the leftover. If error correlated with true score it would not be error — it would be a second signal you had failed to model.' }),
        { caption: 'the only equation in this lesson you have to remember' }),
      controls: [
        { type: 'slider', key: 'trueSd', label: 'how much people differ', min: 3, max: 14, step: 0.5, fast: true, fmt: v => (+v).toFixed(1) },
        { type: 'slider', key: 'errSd', label: 'measurement noise', min: 0, max: 16, step: 0.5, fast: true, fmt: v => (+v).toFixed(1) },
      ],
      readouts: [
        { key: 'vT', label: 's²<sub>T</sub> signal', tone: 'gold', get: s => varT(s), d: 1 },
        { key: 'vE', label: 's²<sub>E</sub> noise', tone: 'warm', get: s => varE(s, 1), d: 1 },
        { key: 'vX', label: 's²<sub>X</sub> observed', tone: 'cyan', get: s => varX(s, 1), d: 1 },
        { key: 'chk', label: 'T + E', tone: 'green', get: s => varT(s) + varE(s, 1), d: 1, explain: 'Identical to s²ₓ, to every decimal, every time. That is not a coincidence — it is what "uncorrelated" means.' },
      ],
      beats: [
        { label: 'the signal square', hold: 1250, note: 'Square the spread of the gold bars. Side = sd of true scores; area = <b>s²<sub>T</sub></b>.', scene: s => sqScene(s, 1) },
        { label: 'the noise square', hold: 1250, note: 'Square the spread of the sticks. Side = sd of the errors; area = <b>s²<sub>E</sub></b>.', scene: s => sqScene(s, 2) },
        { label: 'the observed square', hold: 1500, note: 'Square the spread of the dots you actually recorded. Compare its area with the other two combined.', scene: s => sqScene(s, 3) },
        { label: 'they add', hold: 1600, note: 'Exactly equal. Drag either slider and the sum tracks it to the decimal.', scene: s => sqScene(s, 4) },
        { label: 'why: right angles', note: 'The three sides form a right triangle. Uncorrelated <em>means</em> perpendicular, so the observed sd is a hypotenuse — which is why noise is so expensive at first and so cheap later.', scene: s => sqScene(s, 5) },
      ],
    },

    /* ── 7 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'reliability is the signal’s share of the area',
      prose: `<p>Now the definition, and it is a one-liner: <strong>reliability is the fraction of the observed variance that is true-score variance.</strong></p>
        <p>Take the observed square from the last step and cut it into two bands. Gold is signal, grey is noise. The gold band's share of the area is ρ, and because the square has a fixed side, its share of the <em>height</em> is ρ too. Drag the noise dial and watch the line between them slide.</p>
        <p>ρ = 1 means every difference you see between people is real. ρ = 0 means you have a random number generator with a logo on it. Everything else is in between, and most published measures live around 0.7 to 0.9.</p>`,
      formula: formula(
        rho + eq + frac(vT, vT + plus + vE) + eq + frac(vT, vX) +
        op('&nbsp;&nbsp;&nbsp;') + t('0 ≤ ρ ≤ 1', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'a proportion of an area, which is why it cannot leave [0, 1]' }),
      controls: [
        { type: 'slider', key: 'errSd', label: 'measurement noise', min: 0, max: 16, step: 0.5, fast: true, fmt: v => (+v).toFixed(1) },
        { type: 'slider', key: 'trueSd', label: 'how much people differ', min: 3, max: 14, step: 0.5, fast: true, fmt: v => (+v).toFixed(1) },
      ],
      readouts: [
        { key: 'r', label: 'ρ reliability', tone: 'green', get: s => rel(s, 1), d: 3, wide: true },
        { key: 'vT', label: 'signal s²<sub>T</sub>', tone: 'gold', get: s => varT(s), d: 1 },
        { key: 'vE', label: 'noise s²<sub>E</sub>', tone: 'warm', get: s => varE(s, 1), d: 1 },
      ],
      beats: [
        { label: 'the observed square', hold: 1200, note: 'The whole area is everything you measured: <b>s²<sub>X</sub></b>.', scene: s => shareScene(s, 1) },
        { label: 'cut it', hold: 1400, note: 'Gold band = signal. Grey band = noise. The cut is at ρ of the way up.', scene: s => shareScene(s, 2) },
        { label: 'put it on a scale', hold: 1500, note: 'The same fraction, straightened out. Conventional landmarks marked.', scene: s => shareScene(s, 3) },
        { label: 'drag it', note: 'Turn the noise to zero and the gold fills the square. Turn it up and watch how fast the top third disappears.', scene: s => shareScene(s, 4) },
      ],
    },

    /* ── 8 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'except you can never see T',
      prose: `<p>Read the formula for ρ again and notice the problem. It is written in terms of <em>s²<sub>T</sub></em>, the variance of the true scores — a quantity that exists, matters, and is unavailable. You have twelve dots and nothing else.</p>
        <p>So here is the trick the whole field is built on. <strong>Measure everyone twice.</strong></p>
        <p>Two administrations. The true scores are the same both times — that is what makes them true scores. The errors are fresh, because that is what makes them errors. Which means anything the two administrations <em>agree</em> about has to be true score, and anything they disagree about has to be error.</p>`,
      controls: [
        { type: 'slider', key: 'errSd', label: 'measurement noise', min: 0, max: 16, step: 0.5, fast: true, fmt: v => (+v).toFixed(1) },
      ],
      beats: [
        { label: 'what you have', hold: 1300, note: 'Twelve dots. The bars are gone for good.', scene: s => retest(s, 1) },
        { label: 'do it again', hold: 1400, note: 'A second administration. Same people, same true scores, brand new errors.', scene: s => retest(s, 2) },
        { label: 'pair them up', hold: 1500, note: 'Each person now has two numbers. Some pairs sit almost on top of each other; some are far apart.', scene: s => retest(s, 3) },
        { label: 'the question', note: 'How much do the two occasions agree? You have a tool for exactly that question, and you built it by hand.', scene: s => retest(s, 4) },
      ],
      dep: { note: 'agreement between two columns is', lesson: 'correlation', label: "pearson's r" },
    },

    /* ── 9 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'the retest correlation is the reliability',
      prose: `<p>Plot administration one against administration two and take the correlation. Compare it to the ρ you computed in step 7 from the true scores you are not supposed to have.</p>
        <p>They are the same number. Not close — the same, to every decimal, however you move the sliders.</p>
        <p>Here is why. Expand the covariance between the two administrations and four terms fall out. Three of them are zero: errors do not correlate with true scores (definition), and the two occasions' errors do not correlate with each other (they are independent draws). What survives is <em>s²<sub>T</sub></em> — the unobservable quantity, delivered by two observable columns.</p>`,
      formula: formula(
        'cov' + paren(fX + sub('', '1') + ', ' + fX + sub('', '2')) + eq + 'cov' + paren(fT + plus + fE + sub('', '1') + ', ' + fT + plus + fE + sub('', '2')) + '<br>' +
        eq + vT + plus + t('cov(T,E₂)', { tone: 'muted' }) + plus + t('cov(E₁,T)', { tone: 'muted' }) + plus + t('cov(E₁,E₂)', { tone: 'muted' }) + '<br>' +
        eq + vT + op('&nbsp;&nbsp;⟹&nbsp;&nbsp;') + t('r', { tone: 'green' }) + sub('', '12') + eq + frac(vT, vX) + eq + rho,
        { caption: 'three of the four terms are zero, and each for its own reason' }),
      controls: [
        { type: 'slider', key: 'errSd', label: 'measurement noise', min: 0, max: 16, step: 0.5, fast: true, fmt: v => (+v).toFixed(1) },
        { type: 'slider', key: 'trueSd', label: 'how much people differ', min: 3, max: 14, step: 0.5, fast: true, fmt: v => (+v).toFixed(1) },
      ],
      readouts: [
        { key: 'r12', label: 'r between the two sittings', tone: 'cyan', get: s => st.pearson(admin(s, 0), admin(s, 1)), d: 3, wide: true },
        { key: 'rho', label: 'ρ from the true scores', tone: 'gold', get: s => rel(s, 1), d: 3, wide: true },
        { key: 'd', label: 'difference', tone: 'green', get: s => Math.abs(st.pearson(admin(s, 0), admin(s, 1)) - rel(s, 1)), d: 4 },
      ],
      beats: [
        { label: 'the scatter', hold: 1400, note: 'Sitting one across, sitting two up. Twelve people, two numbers each.', scene: s => ttScene(s, 1) },
        { label: 'take r', hold: 1500, note: 'The correlation between the two columns.', scene: s => ttScene(s, 2) },
        { label: 'compare', hold: 1600, note: 'Identical to the ρ from step 7 — which was computed from information you do not have.', scene: s => ttScene(s, 3) },
        { label: 'expand the covariance', hold: 1500, note: 'Four terms come out of the bracket.', scene: s => ttScene(s, 4) },
        { label: 'three vanish', hold: 1600, note: 'Errors are uncorrelated with true scores, and with each other. Only the shared true score survives.', scene: s => ttScene(s, 5) },
        { label: 'what it cost', note: 'Two administrations, and an assumption that nothing about the people changed in between. That assumption is doing real work, and it is why the next step matters.', scene: s => ttScene(s, 6) },
      ],
    },

    /* ── 10 ────────────────────────────────────────────────────────────────── */
    {
      title: 'more items, less noise — but not linearly',
      prose: `<p>Testing everyone twice is expensive and the second sitting is never quite comparable. The usual move instead is to ask the <em>same thing several ways in one sitting</em> — several items — and average them.</p>
        <p>You already know why that works. Step 4 did it for Ali: averaging k measurements divides the error variance by k, while leaving the true score exactly where it was. The signal square stays; the noise square shrinks.</p>
        <p>Drag <strong>items</strong> and watch the dots pull onto their bars. Then look at the curve: the first extra item is worth a great deal and the tenth is worth almost nothing. That is Spearman–Brown, and it is the reason questionnaires stop at ten items rather than a hundred.</p>`,
      formula: formula(
        rho + sub('', 'k') + eq + frac('k' + times + rho + sub('', '1'), '1' + plus + paren('k' + minus + '1') + times + rho + sub('', '1')) +
        op('&nbsp;&nbsp;from&nbsp;&nbsp;') + vE + op('&nbsp;→&nbsp;') + frac(vE, 'k'),
        { caption: 'the same averaging that shrank Ali’s error, applied to items instead of days' }),
      dep: { note: 'error variance falling as 1/k is the', lesson: 'clt', label: 'standard error' },
      controls: [
        { type: 'slider', key: 'k', label: 'items averaged', min: 1, max: NK, step: 1, fast: true },
        { type: 'slider', key: 'errSd', label: 'noise per item', min: 0, max: 16, step: 0.5, fast: true, fmt: v => (+v).toFixed(1) },
      ],
      readouts: [
        { key: 'k', label: 'items', get: s => s.k, d: 0 },
        { key: 'v', label: 'noise variance', tone: 'warm', get: s => varE(s), d: 2 },
        { key: 'r1', label: 'ρ of one item', tone: 'muted', get: s => rel(s, 1), d: 3 },
        { key: 'rk', label: 'ρ of the average', tone: 'green', get: s => rel(s), d: 3, wide: true },
      ],
      beats: [
        { label: 'one item', hold: 1200, note: 'k = 1. Where step 5 left off.', scene: s => sbScene(s, 1, 1) },
        { label: 'two items', hold: 1200, note: 'k = 2. The sticks are visibly shorter — error variance has halved.', scene: s => sbScene(s, 2, 2) },
        { label: 'four items', hold: 1200, note: 'k = 4. Quartered.', scene: s => sbScene(s, 4, 4) },
        { label: 'eight items', hold: 1500, note: 'k = 8. The dots are nearly sitting on their bars.', scene: s => sbScene(s, 8, 8) },
        { label: 'the curve', hold: 1700, note: 'Reliability against number of items. Steep, then flat. Doubling a good scale barely helps; doubling a terrible one helps a lot.', scene: s => sbScene(s, s.k, s.k, true) },
        { label: 'your turn', note: 'Set the noise high and see how many items it takes to reach 0.8. Then set it low and see how few.', scene: s => sbScene(s, s.k, s.k, true) },
      ],
    },

    /* ── 11 ────────────────────────────────────────────────────────────────── */
    {
      title: 'alpha: reliability without a second sitting',
      prose: `<p>If the items are already several measurements of the same thing, you do not need a retest at all — the items can check each other. That is Cronbach's alpha, and it is the number reported in roughly every questionnaire paper ever written.</p>
        <p>The logic is a subtraction. Add up the variances of the individual items. Then compute the variance of the total score. The total is <em>bigger</em> than the sum of the parts, and the excess is precisely the agreement between items — which, by step 9, is true-score variance.</p>
        <p>Alpha turns that excess into a proportion and rescales it. When the items are parallel, as they are here, it lands exactly on the Spearman–Brown reliability from the last step.</p>`,
      formula: formula(
        t('α', { tone: 'green' }) + eq + frac('k', 'k ' + minus + ' 1') + times + paren('1' + minus + frac(sumOver('s' + sup('', '2') + sub('', 'i'), { from: 'i=1', to: 'k' }), 's' + sup('', '2') + sub('', 'total'))) + '<br>' +
        t('equivalently', { tone: 'muted', cls: 'fx-tiny' }) + op('&nbsp;') +
        t('α', { tone: 'green' }) + eq + frac('k' + times + bar('r'), '1' + plus + paren('k' + minus + '1') + times + bar('r')) + op('&nbsp;&nbsp;') +
        t('— Spearman–Brown, run on the average correlation between items', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'the same formula as step 10, fed a different input' }),
      controls: [
        { type: 'slider', key: 'k', label: 'items on the scale', min: 2, max: NK, step: 1, fast: true },
        { type: 'slider', key: 'errSd', label: 'noise per item', min: 0, max: 16, step: 0.5, fast: true, fmt: v => (+v).toFixed(1) },
      ],
      readouts: [
        { key: 'sum', label: 'Σ item variances', tone: 'warm', get: s => kA(s) * (varT(s) + s.errSd * s.errSd), d: 0 },
        { key: 'tot', label: 'variance of the total', tone: 'cyan', get: s => kA(s) * kA(s) * varT(s) + kA(s) * s.errSd * s.errSd, d: 0 },
        { key: 'rbar', label: 'r̄ between items', tone: 'muted', get: s => rel(s, 1), d: 3, explain: 'The average correlation between any two items. Feed this to Spearman–Brown and you get α.' },
        { key: 'a', label: 'α', tone: 'green', get: s => rel(s, kA(s)), d: 3, wide: true },
      ],
      beats: [
        { label: 'the items', hold: 1300, note: 'Each item is a full measurement of the same true score, with its own independent noise.', scene: s => alphaScene(s, 1) },
        { label: 'add up the parts', hold: 1400, note: 'Σ of the k item variances. Each item carries signal <em>and</em> noise.', scene: s => alphaScene(s, 2) },
        { label: 'the whole', hold: 1500, note: 'Variance of the summed score. Much larger than the sum of the parts — because the items agree with each other.', scene: s => alphaScene(s, 3) },
        { label: 'the excess is signal', hold: 1600, note: 'The gap is 2× the sum of the item covariances. Covariance between items can only come from what they share, and what they share is T.', scene: s => alphaScene(s, 4) },
        { label: 'α, and the catch', note: 'α equals the reliability from step 10 exactly — <em>here</em>. In the wild, items are not parallel, and then α is a lower bound. It also climbs with k whatever the items measure, which is why a long bad scale can post a respectable α.', scene: s => alphaScene(s, 5) },
      ],
      aside: `<p><strong>What alpha is not.</strong> It is not evidence that your scale measures one thing — two distinct clusters of items can produce a perfectly healthy α. It is not a property of the instrument, only of this instrument in this sample. And because it rises with k on its own, "α = .91" from a forty-item scale is a much weaker claim than the same number from five items.</p>`,
    },

    /* ── 12 ────────────────────────────────────────────────────────────────── */
    {
      title: 'what unreliability costs: attenuation',
      prose: `<p>Here is why any of this should change what you do on Monday.</p>
        <p>Two variables with a real correlation of 0.60 between their true scores. Measure both with error and the correlation you observe is <em>smaller</em> — always smaller, never larger, and by an amount you can compute exactly.</p>
        <p>Drag either reliability down and watch the cloud inflate away from the ghosts of its true positions while r slides toward zero. Nothing about the underlying relationship changed. Only the ruler got worse.</p>
        <p>So a null result can mean there is no effect, or it can mean your measures were too noisy to show one. Those are very different papers, and the observed r alone cannot tell you which you have.</p>`,
      formula: formula(
        t('r', { tone: 'cyan' }) + sub('', 'observed') + eq + t('r', { tone: 'gold' }) + sub('', 'true') + times + sqrt(rho + sub('', 'x') + times + rho + sub('', 'y')) + '<br>' +
        t('so, going backwards', { tone: 'muted', cls: 'fx-tiny' }) + op('&nbsp;') +
        t('r', { tone: 'gold' }) + sub('', 'true') + eq + frac(t('r', { tone: 'cyan' }) + sub('', 'observed'), sqrt(rho + sub('', 'x') + times + rho + sub('', 'y'))),
        { caption: 'the correction for attenuation — easy to apply, easy to abuse' }),
      controls: [
        { type: 'slider', key: 'relX', label: 'reliability of x', min: 0.25, max: 1, step: 0.01, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'slider', key: 'relY', label: 'reliability of y', min: 0.25, max: 1, step: 0.01, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'slider', key: 'rTrue', label: 'true correlation', min: 0, max: 0.95, step: 0.01, fast: true, fmt: v => (+v).toFixed(2) },
      ],
      readouts: [
        { key: 'rt', label: 'r between true scores', tone: 'gold', get: s => s.rTrue, d: 3 },
        { key: 'ro', label: 'r you would observe', tone: 'cyan', get: s => s.rTrue * Math.sqrt(s.relX * s.relY), d: 3, wide: true },
        { key: 'lost', label: 'shrinkage', tone: 'warm', get: s => 1 - Math.sqrt(s.relX * s.relY), d: 3, fmt: v => (v * 100).toFixed(1) + '%' },
      ],
      beats: [
        { label: 'the real relationship', hold: 1400, note: 'True scores against true scores. r = 0.60 by construction.', scene: s => attScene(s, 1) },
        { label: 'add error to x', hold: 1500, note: 'The cloud smears sideways. Every point keeps its true y and loses its true x.', scene: s => attScene(s, 2) },
        { label: 'add error to y', hold: 1600, note: 'Now it smears both ways. The relationship is intact underneath; the picture is not.', scene: s => attScene(s, 3) },
        { label: 'the exact cost', hold: 1600, note: 'r shrinks by the square root of the product of the two reliabilities. Two measures at ρ = 0.7 cost you 30% of your correlation.', scene: s => attScene(s, 4) },
        { label: 'correcting it', note: 'Divide back out and you recover r<sub>true</sub>. Do this carelessly and you will publish a corrected correlation above 1 — a standard way of discovering your reliability estimates were wrong.', scene: s => attScene(s, 5) },
      ],
      aside: `<p><strong>The same disease, in regression.</strong> Error in a predictor drags its coefficient toward zero too — the textbook name is <em>regression dilution</em>. Error in the <em>outcome</em> is kinder: it inflates the standard errors but leaves the coefficient unbiased. So noise in x biases you; noise in y merely costs you power.</p>`,
    },

    /* ── 13 ────────────────────────────────────────────────────────────────── */
    {
      title: 'reliable is not the same as right',
      prose: `<p>One last thing, and it is the one people get backwards.</p>
        <p>A bathroom scale that reads ten kilos heavy is <strong>perfectly reliable</strong>. Step on it a hundred times and it gives the same answer every time. Its ρ is superb. It is also wrong every single time, and no amount of reliability will ever tell you so.</p>
        <p>Move the two dials. <strong>Spread</strong> changes reliability. <strong>Bias</strong> does not touch it — the shots move as a group and ρ does not flinch. Only the distance from the bullseye notices, and that number is not one your data can compute.</p>
        <p>Reliability is a question about your instrument that your instrument can answer. Validity is a question about your instrument that only the world can answer.</p>`,
      controls: [
        { type: 'segment', key: 'target', label: 'pick a case',
          onChange: st2 => { const p = PRESETS[st2.target]; st2.bias = p.bias; st2.noise = p.noise; },
          options: [
            { value: 'rv', label: 'reliable + valid', explain: 'Tight cluster, centred on the bullseye. High ρ, no bias.' },
            { value: 'ri', label: 'reliable, biased', explain: 'Same tight cluster, moved off centre. Identical ρ — and wrong every time.' },
            { value: 'ur', label: 'noisy but centred', explain: 'Right on average, useless for any single person. Low ρ, no bias.' },
            { value: 'no', label: 'neither', explain: 'Low ρ and biased. At least this one is obvious.' },
          ] },
        { type: 'slider', key: 'noise', label: 'spread', min: 0, max: 26, step: 0.5, fast: true, fmt: v => (+v).toFixed(1) },
        { type: 'slider', key: 'bias', label: 'bias', min: -30, max: 30, step: 1, fast: true },
      ],
      readouts: [
        { key: 'rho', label: 'ρ reliability', tone: 'green', get: s => varT(s) / (varT(s) + s.noise * s.noise), d: 3, wide: true },
        { key: 'b', label: 'systematic bias', tone: 'warm', get: s => s.bias, d: 1 },
        { key: 'rmse', label: 'typical distance from truth', tone: 'cyan', get: s => Math.sqrt(s.bias * s.bias + s.noise * s.noise), d: 2, wide: true },
      ],
      beats: [
        { label: 'the target', hold: 1200, note: 'The bullseye is the quantity you meant to measure. Each dot is one measurement.', scene: s => targetScene(s, 1) },
        { label: 'tight and true', hold: 1400, note: 'High ρ, no bias. What you were hoping for.', scene: s => targetScene(s, 2) },
        { label: 'tight and wrong', hold: 1600, note: 'Same spread, moved off centre. <b>ρ is unchanged.</b> Reliability cannot see this failure, and neither can any statistic computed from your data alone.', scene: s => targetScene(s, 3) },
        { label: 'all four', hold: 1800, note: 'Reliability is <em>how wide</em> the cluster is. Validity is <em>where</em> it sits. Neither one constrains the other.', scene: s => targetScene(s, 4) },
        { label: 'your turn', note: 'Pick a case, or drive the two dials yourself. <b>Bias</b> moves the cluster and leaves ρ untouched.', scene: s => targetScene(s, 5) },
      ],
      dep: { note: 'a systematic error that never shrinks with n is', lesson: 'causal', label: 'bias' },
    },
  ],
};

/* ── scenes ───────────────────────────────────────────────────────────────── */

function oneDay(s, j) {
  const f = R();
  const vals = [62, 66, 57, 64];
  return [
    ruler(f),
    { key: 'ali', tag: 'circle', cls: 'pt pt-cyan link-obs', attrs: { cx: f.sx(vals[j]), cy: dotY(f, 0), r: 8 }, enter: { attrs: { r: 0 }, opacity: 0 } },
    label('alil', f.sx(vals[j]), dotY(f, 0) - 20, 'Ali · ' + ['Monday', 'Tuesday', 'Wednesday', 'Thursday'][j], { cls: 'lab lab-mid lab-cyan' }),
    numLabel('aliv', f.sx(vals[j]), dotY(f, 0) + 5, vals[j], { cls: 'lab-sm lab-mid', d: 0 }),
  ];
}

function devScene(s, { showStick, labelE, showSum } = {}) {
  const f = R();
  const tv = trueOf(s, 0), ov = repOf(s, 0), e = ov - tv;
  const y = dotY(f, 0);
  return [
    ruler(f),
    { key: 'tline', tag: 'line', cls: 'rule rule-gold rule-dash link-true', attrs: { x1: f.sx(tv), y1: f.y0, x2: f.sx(tv), y2: f.y1 - 14 } },
    label('tlab', f.sx(tv), f.y1 - 22, 'T = Ali', { cls: 'lab lab-mid lab-gold' }),
    numLabel('tval', f.sx(tv), f.y1 - 6, tv, { cls: 'lab-sm lab-mid lab-gold', d: 1 }),
    showStick ? path('estick', [[f.sx(tv), y], [f.sx(ov), y]], {
      cls: 'stick ' + (e >= 0 ? 'stick-pos' : 'stick-neg') + ' link-err',
      tip: `error on this occasion<br>E = ${e.toFixed(2)}`,
    }) : null,
    labelE ? numLabel('elab', (f.sx(tv) + f.sx(ov)) / 2, y - 14, e, {
      cls: 'lab-sm lab-mid ' + (e >= 0 ? 'lab-warm' : 'lab-cold'), d: 2, pre: e >= 0 ? 'E = +' : 'E = ',
    }) : null,
    { key: 'ali', tag: 'circle', cls: 'pt pt-cyan link-obs', attrs: { cx: f.sx(ov), cy: y, r: 8 }, enter: { attrs: { r: 0 }, opacity: 0 }, tip: `X = ${ov.toFixed(2)}` },
    numLabel('aliv', f.sx(ov), y + 22, ov, { cls: 'lab lab-mid lab-cyan', d: 1, pre: 'X = ' }),
    showSum ? label('sum', 300, y - 96, 'X = T + E', { cls: 'lab-big lab-mid' }) : null,
    showSum ? numLabel('sumv', 300, y - 74,
      ov, { cls: 'lab lab-mid', d: 2, fmt: v => `${tv.toFixed(2)}  ${e >= 0 ? '+' : '−'} ${Math.abs(e).toFixed(2)}  =  ${v.toFixed(2)}` }) : null,
  ];
}

function repScene(s, n) {
  const f = R();
  const tv = trueOf(s, 0);
  const vals = range(n).map(j => repOf(s, j));
  const m = st.mean(vals);
  return [
    ruler(f),
    { key: 'tline', tag: 'line', cls: 'rule rule-gold rule-dash link-true', attrs: { x1: f.sx(tv), y1: f.y0, x2: f.sx(tv), y2: f.y1 - 14 } },
    label('tlab', f.sx(tv), f.y1 - 22, 'T', { cls: 'lab lab-mid lab-gold' }),
    vals.map((v, j) => ({
      key: 'r-' + j, tag: 'circle', cls: 'pt pt-cyan link-obs',
      attrs: { cx: f.sx(v), cy: dotY(f, j), r: 5 }, opacity: 0.8, delay: j * 24,
      enter: { attrs: { r: 0 }, opacity: 0 },
      tip: `occasion ${j + 1}<br>X = ${v.toFixed(2)}<br>E = ${(v - tv).toFixed(2)}`,
    })),
    path('mline', [[f.sx(m), f.y0 + 2], [f.sx(m), f.y0 - 12]], { cls: 'stick stick-x' }),
    { key: 'mmark', tag: 'path', cls: 'bar-cold', pts: [[f.sx(m), f.y0 - 12], [f.sx(m) - 7, f.y0 - 24], [f.sx(m) + 7, f.y0 - 24]], close: true, set: { fill: 'var(--cs-cyan)' } },
    numLabel('mv', f.sx(m), f.y0 - 30, m, { cls: 'lab-sm lab-mid lab-cyan', d: 2, pre: 'mean = ' }),
  ];
}

function peopleScene(s, { k = 1, sticks = true, hideTrue = false, dur } = {}) {
  const f = peopleFrame(s, { k });
  const tv = trues(s), ov = observed(s, k);
  return [
    peopleAxis(f, { dur }),
    hideTrue ? null : tv.map((v, i) => trueTick(f, i, v, {
      dur, tip: `<b>${NAMES[i]}</b><br>true score T = ${v.toFixed(1)}`,
    })),
    sticks ? ov.map((v, i) => errStick(f, i, tv[i], v, {
      dur, tip: `<b>${NAMES[i]}</b><br>E = ${(v - tv[i]).toFixed(2)}`,
    })) : null,
    ov.map((v, i) => obsDot(f, i, v, {
      dur, delay: i * 35,
      tip: `<b>${NAMES[i]}</b><br>observed X = ${v.toFixed(1)}<br>true T = ${tv[i].toFixed(1)}<br>error E = ${(v - tv[i]).toFixed(2)}`,
    })),
    hideTrue ? null : label('lgd-t', f.x1, f.y0 + 42, '▬ true score', { cls: 'lab-sm lab-end lab-gold' }),
    label('lgd-x', f.x1, f.y0 + 56, '● observed', { cls: 'lab-sm lab-end lab-cyan' }),
  ];
}

/* ── step 6: the three squares ─────────────────────────────────────────────── */

const SQ_BASE = 494, PXV = 7.0, SQ_GAP = 66;

function sqScene(s, phase) {
  const f = peopleFrame(s, { k: 1, t: 40, b: 330, r: 56 });
  const tv = trues(s), ov = observed(s, 1);
  const sT = s.trueSd, sE = s.errSd, sX = Math.sqrt(varX(s, 1));
  const wT = sT * PXV, wE = sE * PXV, wX = sX * PXV;

  const strip = [
    { key: 'sax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x1, y2: f.y0 } },
    tv.map((v, i) => trueTick(f, i, v, { opacity: phase >= 1 ? 1 : 0.25 })),
    ov.map((v, i) => errStick(f, i, tv[i], v, { opacity: phase >= 2 ? 1 : 0.25 })),
    ov.map((v, i) => obsDot(f, i, v, { attrs: { cx: f.sx(i), cy: f.sy(v), r: 4.5 }, opacity: phase >= 3 ? 1 : 0.3 })),
  ];

  if (phase >= 5) {
    /* the right triangle: legs sd(T) and sd(E), hypotenuse sd(X) */
    const TPX = 12;                       /* the triangle gets its own scale */
    const lT = sT * TPX, lE = sE * TPX;
    const ox = 360 - lT / 2, oy = 486;
    const ax = ox, ay = oy, bx = ox + lT, by = oy, cx = ox + lT, cy = oy - lE;
    return [
      strip,
      path('tri', [[ax, ay], [bx, by], [cx, cy]], { close: true, cls: 'curve curve-fit' }),
      path('ra', [[bx - 12, by], [bx - 12, by - 12], [bx, by - 12]], { cls: 'brace' }),
      path('legT', [[ax, ay], [bx, by]], { cls: 'stick link-true', set: { stroke: 'var(--cs-data-gold)', 'stroke-width': 4 } }),
      path('legE', [[bx, by], [cx, cy]], { cls: 'stick link-err', set: { stroke: 'var(--cs-data-warm)', 'stroke-width': 4 } }),
      path('hyp', [[ax, ay], [cx, cy]], { cls: 'stick link-obs', set: { stroke: 'var(--cs-cyan)', 'stroke-width': 4 } }),
      numLabel('legTv', (ax + bx) / 2, ay + 20, sT, { cls: 'lab-sm lab-mid lab-gold', d: 2, pre: 's_T = ' }),
      numLabel('legEv', bx + 12, (by + cy) / 2, sE, { cls: 'lab-sm lab-warm', d: 2, pre: 's_E = ' }),
      numLabel('hypv', (ax + cx) / 2 - 14, (ay + cy) / 2 - 6, sX, { cls: 'lab-sm lab-end lab-cyan', d: 2, pre: 's_X = ' }),
      label('trilab', 360, 262, 'uncorrelated = perpendicular', { cls: 'lab-big lab-mid lab-green' }),
      label('trilab2', 360, 284, 'so the observed sd is a hypotenuse, and never a sum', { cls: 'lab-sm lab-mid' }),
    ];
  }

  const total = wT + wE + wX + SQ_GAP * 2;
  const x0 = 360 - total / 2;
  const cT = x0 + wT / 2;
  const cE = x0 + wT + SQ_GAP + wE / 2;
  const cX = x0 + wT + SQ_GAP + wE + SQ_GAP + wX / 2;

  return [
    strip,
    phase >= 1 ? [
      sdSquare('sqT', cT, SQ_BASE, wT, { cls: 'sq sq-gold link-true', opacity: 0.95 }),
      label('sqTl', cT, SQ_BASE + 18, 's²_T  signal', { cls: 'lab-sm lab-mid lab-gold' }),
      numLabel('sqTv', cT, SQ_BASE - wT / 2 + 4, varT(s), { cls: 'lab lab-mid lab-gold', d: 0 }),
    ] : null,
    phase >= 2 ? [
      label('plus', cT + wT / 2 + SQ_GAP / 2, SQ_BASE - 20, '+', { cls: 'lab-big lab-mid' }),
      sdSquare('sqE', cE, SQ_BASE, wE, { cls: 'sq sq-resid link-err', opacity: 0.95 }),
      label('sqEl', cE, SQ_BASE + 18, 's²_E  noise', { cls: 'lab-sm lab-mid lab-warm' }),
      numLabel('sqEv', cE, SQ_BASE - wE / 2 + 4, varE(s, 1), { cls: 'lab lab-mid lab-warm', d: 0 }),
    ] : null,
    phase >= 3 ? [
      label('equals', cE + wE / 2 + SQ_GAP / 2, SQ_BASE - 20, '=', { cls: 'lab-big lab-mid' }),
      sdSquare('sqX', cX, SQ_BASE, wX, { cls: 'sq sq-x link-obs', opacity: 0.95 }),
      label('sqXl', cX, SQ_BASE + 18, 's²_X  what you saw', { cls: 'lab-sm lab-mid lab-cyan' }),
      numLabel('sqXv', cX, SQ_BASE - wX / 2 + 4, varX(s, 1), { cls: 'lab lab-mid lab-cyan', d: 0 }),
    ] : null,
    phase >= 4 ? [
      label('chk', 360, 288, 'area + area = area', { cls: 'lab-big lab-mid lab-green' }),
      numLabel('chkv', 360, 310, varX(s, 1), {
        cls: 'lab-sm lab-mid', d: 1,
        fmt: v => `${varT(s).toFixed(1)} + ${varE(s, 1).toFixed(1)} = ${v.toFixed(1)}`,
      }),
    ] : null,
  ];
}

/* ── step 7: the share ────────────────────────────────────────────────────── */

function shareScene(s, phase) {
  const SIDE = 200, X0 = 92, Y1 = 96;
  const r = rel(s, 1);
  const cut = Y1 + SIDE * (1 - r);
  const barX0 = 92, barX1 = 628, barY = 376;

  return [
    rect('bx', X0, Y1, SIDE, SIDE, { cls: 'cell link-obs' }),
    label('bxl', X0 + SIDE / 2, Y1 - 14, 's²_X  ·  everything you measured', { cls: 'lab-sm lab-mid lab-cyan' }),
    phase >= 2 ? [
      rect('bsig', X0, cut, SIDE, Y1 + SIDE - cut, { cls: 'sq sq-gold link-true' }),
      rect('bnoi', X0, Y1, SIDE, cut - Y1, { cls: 'sq sq-dim link-err' }),
      path('bcut', [[X0 - 8, cut], [X0 + SIDE + 8, cut]], { cls: 'rule rule-gold' }),
      label('bsigl', X0 + SIDE / 2, (cut + Y1 + SIDE) / 2 + 4, 'signal', { cls: 'lab-big lab-mid lab-gold' }),
      cut - Y1 > 22 ? label('bnoil', X0 + SIDE / 2, (Y1 + cut) / 2 + 4, 'noise', { cls: 'lab lab-mid' }) : null,
    ] : null,
    phase >= 2 ? [
      numLabel('vTn', X0 + SIDE + 22, Y1 + 26, varT(s), { cls: 'lab lab-gold', d: 1, pre: 's²_T = ' }),
      numLabel('vEn', X0 + SIDE + 22, Y1 + 50, varE(s, 1), { cls: 'lab lab-warm', d: 1, pre: 's²_E = ' }),
      numLabel('vXn', X0 + SIDE + 22, Y1 + 74, varX(s, 1), { cls: 'lab lab-cyan', d: 1, pre: 's²_X = ' }),
      numLabel('rhon', X0 + SIDE + 22, Y1 + 116, r, { cls: 'lab-big lab-green', d: 3, pre: 'ρ = ' }),
      label('rhoe', X0 + SIDE + 22, Y1 + 138, 'the gold band’s share of the area', { cls: 'lab-sm' }),
    ] : null,
    phase >= 3 ? [
      path('brl', [[barX0, barY], [barX1, barY]], { cls: 'ax-line' }),
      rect('brt', barX0, barY - 16, barX1 - barX0, 16, { cls: 'sq sq-dim' }),
      rect('brf', barX0, barY - 16, (barX1 - barX0) * r, 16, { cls: 'sq sq-gold' }),
      [0, 0.5, 0.7, 0.8, 0.9, 1].map(v => ([
        path('brt' + v, [[barX0 + (barX1 - barX0) * v, barY], [barX0 + (barX1 - barX0) * v, barY + 7]], { cls: 'ax-line' }),
        label('brn' + v, barX0 + (barX1 - barX0) * v, barY + 21, v.toFixed(1), { cls: 'ax-tick' }),
      ])),
      path('brc7l', [[barX0 + (barX1 - barX0) * 0.7, barY + 26], [barX0 + (barX1 - barX0) * 0.7, barY + 38]], { cls: 'rule rule-faint' }),
      label('brc7', barX0 + (barX1 - barX0) * 0.7, barY + 50, '0.7 · good enough to compare groups', { cls: 'lab-sm lab-mid' }),
      path('brc9l', [[barX0 + (barX1 - barX0) * 0.9, barY + 26], [barX0 + (barX1 - barX0) * 0.9, barY + 62]], { cls: 'rule rule-faint' }),
      label('brc9', barX1, barY + 74, '0.9 · good enough to judge one person', { cls: 'lab-sm lab-end' }),
      path('brm', [[barX0 + (barX1 - barX0) * r, barY - 26], [barX0 + (barX1 - barX0) * r, barY + 4]], { cls: 'rule rule-gold' }),
      numLabel('brv', barX0 + (barX1 - barX0) * r, barY - 32, r, { cls: 'lab lab-mid lab-green', d: 3 }),
      label('brl2', barX0, barY - 32, 'reliability', { cls: 'lab-sm' }),
    ] : null,
  ];
}

/* ── steps 8–9: two administrations ───────────────────────────────────────── */

function retest(s, phase) {
  const a1 = admin(s, 0), a2 = admin(s, 1);
  const f = peopleFrame(s, { k: 1, extra: [...a1, ...a2] });
  return [
    peopleAxis(f),
    a1.map((v, i) => ({
      key: `a1-${i}`, tag: 'circle', cls: 'pt pt-cyan', attrs: { cx: f.sx(i) - (phase >= 3 ? 7 : 0), cy: f.sy(v), r: 6 },
      delay: i * 30, enter: { attrs: { r: 0 }, opacity: 0 }, tip: `<b>${NAMES[i]}</b><br>sitting 1 = ${v.toFixed(1)}`,
    })),
    phase >= 2 ? a2.map((v, i) => ({
      key: `a2-${i}`, tag: 'circle', cls: 'pt pt-purple', attrs: { cx: f.sx(i) + (phase >= 3 ? 7 : 0), cy: f.sy(v), r: 6 },
      delay: i * 30, enter: { attrs: { r: 0 }, opacity: 0 }, tip: `<b>${NAMES[i]}</b><br>sitting 2 = ${v.toFixed(1)}`,
    })) : null,
    phase >= 3 ? a1.map((v, i) => path(`pair-${i}`, [[f.sx(i) - 7, f.sy(v)], [f.sx(i) + 7, f.sy(a2[i])]], {
      cls: 'stick', set: { stroke: 'var(--cs-muted)', 'stroke-width': 1.4 },
      tip: `<b>${NAMES[i]}</b><br>gap between sittings = ${Math.abs(v - a2[i]).toFixed(2)}`,
    })) : null,
    label('l1', f.x1, f.y0 + 42, '● sitting 1', { cls: 'lab-sm lab-end lab-cyan' }),
    phase >= 2 ? label('l2', f.x1, f.y0 + 56, '● sitting 2', { cls: 'lab-sm lab-end lab-purple' }) : null,
    phase >= 4 ? [
      label('q', 360, f.y1 - 26, 'how much do the two columns agree?', { cls: 'lab-big lab-mid lab-green' }),
    ] : null,
  ];
}

const TERMS9 = [
  { k: 'v', txt: 'cov(T, T)  =  s²_T', why: 'the same true score on both occasions.\nthis is the part that survives.', tone: 'gold', zero: false },
  { k: 'a', txt: 'cov(T, E₂)  =  0', why: 'error does not track true score.\nthat is what makes it error.', tone: 'muted', zero: true },
  { k: 'b', txt: 'cov(E₁, T)  =  0', why: 'the same reason, the other way round.', tone: 'muted', zero: true },
  { k: 'c', txt: 'cov(E₁, E₂)  =  0', why: 'two independent draws. monday’s nudge\nknows nothing about tuesday’s.', tone: 'muted', zero: true },
];

function ttScene(s, phase) {
  const a1 = admin(s, 0), a2 = admin(s, 1);
  const r = st.pearson(a1, a2);
  const f = frame({ w: 720, h: 540, l: 78, r: 322, t: 56, b: 162 });
  const all = [...a1, ...a2];
  const lo = Math.min(...all), hi = Math.max(...all);
  const pad = (hi - lo) * 0.1;
  f.setX(lo - pad, hi + pad); f.setY(lo - pad, hi + pad);

  const scatter = [
    { key: 'ax1', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x1, y2: f.y0 } },
    { key: 'ax2', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x0, y2: f.y1 } },
    label('axl1', (f.x0 + f.x1) / 2, f.y0 + 26, 'sitting 1', { cls: 'ax-label' }),
    { key: 'axl2', tag: 'text', cls: 'ax-label', attrs: { x: 0, y: 0 }, set: { transform: `translate(24 ${(f.y0 + f.y1) / 2}) rotate(-90)` }, text: 'sitting 2' },
    path('diag', [[f.sx(f.dx[0]), f.sy(f.dx[0])], [f.sx(f.dx[1]), f.sy(f.dx[1])]], { cls: 'curve curve-ghost curve-dash' }),
    points(f, range(NP), {
      key: 'tt', r: 6.5, cls: 'pt pt-cyan', x: i => a1[i], y: i => a2[i], stagger: 32,
      tip: i => `<b>${NAMES[i]}</b><br>sitting 1 = ${a1[i].toFixed(1)}<br>sitting 2 = ${a2[i].toFixed(1)}<br>true = ${trueOf(s, i).toFixed(1)}`,
    }),
  ];

  const panelX = 424;
  const out = [scatter];

  if (phase >= 2) out.push(
    numLabel('rv', panelX, 92, r, { cls: 'lab-big lab-cyan', d: 3, pre: 'r₁₂ = ' }),
    label('rvl', panelX, 110, 'correlation between the two sittings', { cls: 'lab-sm' }));
  if (phase >= 3) out.push(
    numLabel('rhov', panelX, 150, rel(s, 1), { cls: 'lab-big lab-gold', d: 3, pre: 'ρ  = ' }),
    label('rhovl', panelX, 168, 'reliability, from the true scores', { cls: 'lab-sm' }),
    label('same', panelX, 198, '— the same number —', { cls: 'lab lab-green' }));
  if (phase >= 4) TERMS9.forEach((tm, i) => {
    const y = 228 + i * 58;
    const dead = phase >= 5 && tm.zero;
    out.push(
      rect('tc-' + tm.k, panelX - 8, y - 18, 276, 50, { cls: 'cell', opacity: dead ? 0.25 : 0.9, delay: i * 90 }),
      label('tt-' + tm.k, panelX + 4, y, tm.txt, { cls: 'lab ' + (dead ? '' : 'lab-' + tm.tone), opacity: dead ? 0.3 : 1, delay: i * 90 }),
      tm.why.split('\n').map((ln, j) => label(`tw-${tm.k}-${j}`, panelX + 4, y + 16 + j * 12, ln,
        { cls: 'lab-sm', opacity: dead ? 0.25 : 1, delay: i * 90 })));
  });
  if (phase >= 5) out.push(
    label('surv', panelX, 478, 'one term left: s²_T', { cls: 'lab-big lab-gold' }),
    label('surv2', panelX, 496, 'divide by s²_X and you have ρ', { cls: 'lab-sm lab-green' }));
  if (phase >= 6) out.push(
    label('cost', (f.x0 + f.x1) / 2, f.y0 + 54, 'the price: two sittings, and the assumption', { cls: 'lab-sm lab-mid lab-warm' }),
    label('cost2', (f.x0 + f.x1) / 2, f.y0 + 68, 'that nobody changed in between', { cls: 'lab-sm lab-mid lab-warm' }));
  return out;
}

/* ── step 10: spearman–brown ──────────────────────────────────────────────── */

function sbScene(s, k, kShown, showCurve) {
  const kk = clamp(kShown, 1, NK);
  const f = peopleFrame(s, { k: 1, r: showCurve ? 356 : 56, b: 86 });
  const tv = trues(s), ov = observed(s, kk);
  const out = [
    peopleAxis(f),
    tv.map((v, i) => trueTick(f, i, v)),
    ov.map((v, i) => errStick(f, i, tv[i], v, { tip: `<b>${NAMES[i]}</b><br>error of the ${kk}-item average = ${(v - tv[i]).toFixed(2)}` })),
    ov.map((v, i) => obsDot(f, i, v, { tip: `<b>${NAMES[i]}</b><br>mean of ${kk} item${kk > 1 ? 's' : ''} = ${v.toFixed(1)}` })),
    label('kk', f.x0 + 8, f.y1 - 12, `k = ${kk}`, { cls: 'lab-big lab-cyan' }),
    numLabel('rk', f.x0 + 78, f.y1 - 12, rel(s, kk), { cls: 'lab-big lab-green', d: 3, pre: 'ρ = ' }),
  ];
  if (!showCurve) return out;

  const c = frame({ w: 720, h: 540, l: 420, r: 34, t: 120, b: 214 });
  c.setX(1, NK); c.setY(0, 1);
  out.push(
    { key: 'cax', tag: 'line', cls: 'ax-line', attrs: { x1: c.x0, y1: c.y0, x2: c.x1, y2: c.y0 } },
    { key: 'cay', tag: 'line', cls: 'ax-line', attrs: { x1: c.x0, y1: c.y0, x2: c.x0, y2: c.y1 } },
    [0, 0.5, 1].map(v => label('cyt' + v, c.x0 - 8, c.sy(v) + 4, v.toFixed(1), { cls: 'ax-tick ax-tick-y' })),
    range(NK).map(j => label('cxt' + j, c.sx(j + 1), c.y0 + 16, String(j + 1), { cls: 'ax-tick' })),
    label('cxl', (c.x0 + c.x1) / 2, c.y0 + 36, 'items averaged', { cls: 'ax-label' }),
    label('cyl', c.x0 + 4, c.y1 - 12, 'reliability of the average', { cls: 'lab-sm' }),
    path('c8', [[c.x0, c.sy(0.8)], [c.x1, c.sy(0.8)]], { cls: 'rule rule-faint rule-dash' }),
    label('c8l', c.x1, c.sy(0.8) - 5, '0.8', { cls: 'lab-sm lab-end' }),
    path('curve', range(NK * 6 + 1).map(j => {
      const kv = 1 + (j * (NK - 1)) / (NK * 6);
      return [c.sx(kv), c.sy(varT(s) / (varT(s) + (s.errSd * s.errSd) / kv))];
    }), { cls: 'curve curve-fit' }),
    range(NK).map(j => ({
      key: 'cp' + j, tag: 'circle',
      cls: 'pt ' + (j + 1 === kk ? 'pt-cyan' : 'pt-ghost'),
      attrs: { cx: c.sx(j + 1), cy: c.sy(rel(s, j + 1)), r: j + 1 === kk ? 6 : 3.4 },
      tip: `k = ${j + 1}<br>ρ = ${rel(s, j + 1).toFixed(3)}`,
    })),
    numLabel('cnow', c.sx(kk), c.sy(rel(s, kk)) - 16, rel(s, kk), { cls: 'lab lab-mid lab-green', d: 3 }),
  );
  return out;
}

/* ── step 11: alpha ───────────────────────────────────────────────────────── */

function alphaScene(s, phase) {
  const k = kA(s);
  const vItem = varT(s) + s.errSd * s.errSd;
  const sumItems = k * vItem;
  const vTotal = k * k * varT(s) + k * s.errSd * s.errSd;
  const share = sumItems / vTotal;
  const alpha = (k / (k - 1)) * (1 - share);

  const X0 = 92, W = 540, yA = 250, yB = 340, H = 40;
  const out = [];

  /* the items themselves: one column of dots each */
  const f = frame({ w: 720, h: 540, l: 116, r: 92, t: 54, b: 372 });
  f.setX(-0.55, k - 0.45);
  const allv = range(k).flatMap(j => range(NP).map(i => trueOf(s, i) + s.errSd * EZ[j][i]));
  const m = Math.max(...allv.map(v => Math.abs(v - MID)));
  f.setY(MID - m - 3, MID + m + 3);
  out.push(
    { key: 'iax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x1, y2: f.y0 } },
    { key: 'iay', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x0, y2: f.y1 } },
    [f.dy[0], MID, f.dy[1]].map((v, i) => label('iyt' + i, f.x0 - 9, f.sy(v) + 4, String(Math.round(v)), { cls: 'ax-tick ax-tick-y' })),
    label('ihead', f.x0, f.y1 - 12, 'each item, scored by all twelve people', { cls: 'lab-sm' }),
    range(k).map(j => range(NP).map(i => ({
      key: `it-${j}-${i}`, tag: 'circle', cls: 'pt pt-purple',
      attrs: { cx: f.sx(j) + (i - (NP - 1) / 2) * 4.2, cy: f.sy(trueOf(s, i) + s.errSd * EZ[j][i]), r: 3.4 },
      opacity: 0.8, delay: j * 60, enter: { attrs: { r: 0 }, opacity: 0 },
      tip: `item ${j + 1} · <b>${NAMES[i]}</b>`,
    }))),
    range(k).map(j => label('itl' + j, f.sx(j), f.y0 + 16, 'item ' + (j + 1), { cls: 'ax-tick' })),
  );

  if (phase >= 2) out.push(
    rect('barB', X0, yB, W * share, H, { cls: 'sq sq-resid' }),
    range(k).map(j => path('seg' + j, [[X0 + (W * share * (j + 1)) / k, yB], [X0 + (W * share * (j + 1)) / k, yB + H]], { cls: 'rule rule-faint' })),
    label('barBl', X0, yB - 8, 'Σ of the k item variances', { cls: 'lab-sm lab-warm' }),
    numLabel('barBv', X0 + W + 12, yB + 25, sumItems, { cls: 'lab lab-warm', d: 0 }));

  if (phase >= 3) out.push(
    rect('barA', X0, yA, W, H, { cls: 'sq sq-x' }),
    label('barAl', X0, yA - 8, 'variance of the total score', { cls: 'lab-sm lab-cyan' }),
    numLabel('barAv', X0 + W + 10, yA + 25, vTotal, { cls: 'lab lab-cyan', d: 0 }));

  if (phase >= 4) out.push(
    rect('gap', X0 + W * share, yB, W * (1 - share), H, { cls: 'sq sq-gold' }),
    label('gapl', X0 + W * share + (W * (1 - share)) / 2, yB + H + 18, 'the excess — what the items agree about', { cls: 'lab-sm lab-mid lab-gold' }),
    path('gapa', [[X0 + W, yA + H + 4], [X0 + W, yB - 4]], { cls: 'arrow' }),
    path('gapb', [[X0 + W * share, yA + H + 4], [X0 + W * share, yB - 4]], { cls: 'rule rule-faint rule-dash' }));

  if (phase >= 5) out.push(
    numLabel('alph', 360, 452, alpha, { cls: 'lab-big lab-mid lab-green', d: 3, pre: 'α = ' }),
    numLabel('alphw', 360, 474, alpha, {
      cls: 'lab-sm lab-mid', d: 3,
      fmt: v => `${k}/${k - 1} × (1 − ${sumItems.toFixed(0)}/${vTotal.toFixed(0)}) = ${v.toFixed(3)}`,
    }),
    numLabel('alphc', 360, 500, rel(s, k), { cls: 'lab-sm lab-mid lab-gold', d: 3, pre: `Spearman–Brown ρ for ${k} items = ` }));

  return out;
}

/* ── step 12: attenuation ─────────────────────────────────────────────────── */

function attScene(s, phase) {
  const A = BASIS[0], B = BASIS[1], EX = BASIS[2], EY = BASIS[3];
  const rt = s.rTrue;
  const tx = A;
  const ty = A.map((v, i) => rt * v + Math.sqrt(Math.max(0, 1 - rt * rt)) * B[i]);
  const ex = phase >= 2 ? Math.sqrt((1 - s.relX) / Math.max(s.relX, 1e-6)) : 0;
  const ey = phase >= 3 ? Math.sqrt((1 - s.relY) / Math.max(s.relY, 1e-6)) : 0;
  /* observed scores, put back on a unit-sd ruler: correlation does not care
     about scale, and it keeps the cloud inside the axes at every setting */
  const ox = tx.map((v, i) => (v + ex * EX[i]) / Math.sqrt(1 + ex * ex));
  const oy = ty.map((v, i) => (v + ey * EY[i]) / Math.sqrt(1 + ey * ey));
  const rObs = st.pearson(ox, oy);

  const f = frame({ w: 720, h: 540, l: 76, r: 252, t: 48, b: 84 });
  f.setX(-3.4, 3.4); f.setY(-3.4, 3.4);

  const out = [
    { key: 'aax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.sy(0), x2: f.x1, y2: f.sy(0) } },
    { key: 'aay', tag: 'line', cls: 'ax-line', attrs: { x1: f.sx(0), y1: f.y0, x2: f.sx(0), y2: f.y1 } },
    label('aaxl', (f.x0 + f.x1) / 2, f.y0 + 30, 'x  (standardised)', { cls: 'ax-label' }),
    { key: 'aayl', tag: 'text', cls: 'ax-label', attrs: { x: 0, y: 0 }, set: { transform: `translate(22 ${(f.y0 + f.y1) / 2}) rotate(-90)` }, text: 'y  (standardised)' },
  ];

  if (phase >= 2) out.push(...range(NP).map(i =>
    ({ key: `gh-${i}`, tag: 'circle', cls: 'pt pt-ghost', attrs: { cx: f.sx(tx[i]), cy: f.sy(ty[i]), r: 5 }, opacity: 0.55 })));
  if (phase >= 2) out.push(...range(NP).map(i =>
    path(`dr-${i}`, [[f.sx(tx[i]), f.sy(ty[i])], [f.sx(ox[i]), f.sy(oy[i])]], {
      cls: 'stick', set: { stroke: 'var(--cs-data-warm)', 'stroke-width': 1.2, 'stroke-dasharray': '3 3' }, opacity: 0.7,
    })));

  out.push(...points(f, range(NP), {
    key: 'at', r: 6.5, cls: phase >= 2 ? 'pt pt-cyan' : 'pt', x: i => ox[i], y: i => oy[i], stagger: 26,
    tip: i => `<b>${NAMES[i]}</b><br>true (${tx[i].toFixed(2)}, ${ty[i].toFixed(2)})<br>observed (${ox[i].toFixed(2)}, ${oy[i].toFixed(2)})`,
  }));

  const px = 486;
  out.push(
    numLabel('rtv', px, 96, rt, { cls: 'lab-big lab-gold', d: 3, pre: 'r true = ' }),
    label('rtl', px, 114, 'between the true scores', { cls: 'lab-sm' }),
    numLabel('rov', px, 156, rObs, { cls: 'lab-big lab-cyan', d: 3, pre: 'r obs = ' }),
    label('rol', px, 174, 'between what you recorded', { cls: 'lab-sm' }),
  );
  if (phase >= 4) out.push(
    label('fx1', px, 226, 'r obs = r true × √(ρx·ρy)', { cls: 'lab lab-green' }),
    numLabel('fx2', px, 250, rt * Math.sqrt(s.relX * s.relY), {
      cls: 'lab-sm', d: 3,
      fmt: v => `${rt.toFixed(2)} × √(${s.relX.toFixed(2)}·${s.relY.toFixed(2)}) = ${v.toFixed(3)}`,
    }),
    numLabel('fx3', px, 282, 1 - Math.sqrt(s.relX * s.relY), {
      cls: 'lab lab-warm', d: 1, fmt: v => `${(v * 100).toFixed(1)}% of the relationship, gone`,
    }));
  if (phase >= 5) out.push(
    label('cor1', px, 330, 'corrected back:', { cls: 'lab-sm lab-gold' }),
    numLabel('cor2', px, 352, rObs / Math.sqrt(s.relX * s.relY), { cls: 'lab-big lab-gold', d: 3, pre: 'r = ' }),
    label('cor3', px, 380, 'exact here, because ρx and ρy', { cls: 'lab-sm' }),
    label('cor4', px, 394, 'are known. in a real study they', { cls: 'lab-sm' }),
    label('cor5', px, 408, 'are themselves estimates, with', { cls: 'lab-sm' }),
    label('cor6', px, 422, 'their own error — which is how', { cls: 'lab-sm' }),
    label('cor7', px, 436, 'corrected r ends up above 1.', { cls: 'lab-sm lab-warm' }));
  return out;
}

/* ── step 13: the target ──────────────────────────────────────────────────── */

const SHOTX = BASIS[5], SHOTY = BASIS[6];
const NPX = 1.5, BPX = 2.4;   /* pixels per unit of spread / of bias */
const PRESETS = {
  rv: { bias: 0, noise: 6, label: 'reliable + valid', tone: 'green' },
  ri: { bias: 24, noise: 6, label: 'reliable, biased', tone: 'warm' },
  ur: { bias: 0, noise: 22, label: 'noisy but centred', tone: 'cyan' },
  no: { bias: 24, noise: 22, label: 'neither', tone: 'muted' },
};

/** one target: rings, bullseye, and twelve shots */
function oneTarget(key, cx, cy, scale, bias, noise, { shots = true, ring = true } = {}) {
  const out = [];
  if (ring) {
    [150, 110, 70, 30].forEach((r, i) => out.push({
      key: `${key}-ring${i}`, tag: 'circle', cls: 'cell',
      attrs: { cx, cy, r: r * scale },
      set: { fill: i % 2 ? 'rgba(255,255,255,.025)' : 'rgba(255,255,255,.055)' },
    }));
    out.push({ key: `${key}-bull`, tag: 'circle', attrs: { cx, cy, r: 5 * scale + 1.5 }, set: { fill: 'var(--cs-data-gold)', stroke: 'none' } });
  }
  if (shots) range(NP).forEach(i => out.push({
    key: `${key}-sh${i}`, tag: 'circle', cls: 'pt pt-cyan',
    attrs: {
      cx: cx + (bias * BPX + noise * SHOTX[i] * NPX) * scale,
      cy: cy + noise * SHOTY[i] * NPX * scale,
      r: 5.5 * scale + 1,
    },
    delay: i * 26, enter: { attrs: { r: 0 }, opacity: 0 },
    tip: `measurement ${i + 1}`,
  }));
  return out;
}

function targetScene(s, phase) {
  const cx = 250, cy = 262;

  /* the four-up comparison: the whole point made in one picture */
  if (phase === 4) {
    const spots = [[192, 168], [486, 168], [192, 396], [486, 396]];
    return [
      Object.keys(PRESETS).map((k, i) => {
        const pr = PRESETS[k];
        const [tx, ty] = spots[i];
        return [
          oneTarget('q' + k, tx, ty, 0.62, pr.bias, pr.noise),
          label('ql' + k, tx, ty + 112, pr.label, { cls: `lab lab-mid lab-${pr.tone}` }),
          label('qr' + k, tx, ty + 128,
            `ρ = ${(varT(s) / (varT(s) + pr.noise * pr.noise)).toFixed(2)}   ·   bias = ${pr.bias}`,
            { cls: 'lab-sm lab-mid' }),
        ];
      }),
      label('qhead', 360, 60, 'the two failures are independent', { cls: 'lab-big lab-mid lab-gold' }),
      label('qhead2', 360, 78, 'top row: identical spread, identical ρ. only one of them is measuring the right thing.', { cls: 'lab-sm lab-mid' }),
    ];
  }

  const bias = phase >= 5 ? s.bias : (phase === 3 ? 24 : 0);
  const noise = phase >= 5 ? s.noise : 6;
  const rr = varT(s) / (varT(s) + noise * noise);

  const out = [
    oneTarget('t', cx, cy, 1, bias, noise, { shots: phase >= 2 }),
    label('bulll', cx, cy + 180, 'the quantity you meant to measure', { cls: 'lab-sm lab-mid lab-gold' }),
  ];

  if (phase >= 3 && bias !== 0) out.push(
    path('biasa', [[cx, cy], [cx + bias * BPX, cy]], { cls: 'arrow arrow-warm' }),
    numLabel('biasl', cx + (bias * BPX) / 2, cy - 12, bias, { cls: 'lab-sm lab-mid lab-warm', d: 0, pre: 'bias = ' }));

  const px = 452;
  out.push(
    numLabel('rrv', px, 132, rr, { cls: 'lab-big lab-green', d: 3, pre: 'ρ = ' }),
    label('rrl', px, 150, 'reliability — computed from the', { cls: 'lab-sm' }),
    label('rrl2', px, 164, 'spread, and only the spread', { cls: 'lab-sm' }),
    numLabel('bsv', px, 212, bias, { cls: 'lab-big lab-warm', d: 0, pre: 'bias = ' }),
    label('bsl', px, 230, 'distance from the truth — and', { cls: 'lab-sm' }),
    label('bsl2', px, 244, 'not computable from your data', { cls: 'lab-sm' }),
    numLabel('rmv', px, 292, Math.sqrt(bias * bias + noise * noise), { cls: 'lab-big lab-cyan', d: 2, pre: 'typical miss = ' }),
    label('rml', px, 310, 'what you actually care about', { cls: 'lab-sm' }),
  );

  if (phase >= 5) out.push(
    label('hint', px, 360, 'drag bias and watch ρ', { cls: 'lab-sm lab-gold' }),
    label('hint2', px, 374, 'refuse to move.', { cls: 'lab-sm lab-gold' }));
  return out;
}
