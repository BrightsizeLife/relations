/* ─────────────────────────────────────────────────────────────────────────────
   mixed.js — partial pooling, and why it is not a compromise.

   Three ways to handle groups: pretend they do not exist, treat each one as a
   separate universe, or let them borrow from each other. The third is not a
   diplomatic middle. It has lower error than both extremes across almost the
   whole range of worlds, and the amount of borrowing is estimated from the
   data rather than chosen.

   The weight that does the borrowing turns out to be the reliability formula
   from the measurement lesson, which is the connection worth carrying away.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { randomIntercept, shrinkSlopes, schools } from '../core/mixed.js';
import { frame, points, label, numLabel, path, rect, fnPath, arrowDefs } from '../core/plot.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sqrt, sub, sup, hat, paren, eq, minus, plus, times, op } from '../core/fx.js';

const S = schools();
const NAMES = S.names;
const K = S.sizes.length;
const PAL = ['var(--cs-cyan)', 'var(--cs-data-warm)', 'var(--cs-lime)', 'var(--cs-purple)',
  'var(--cs-data-gold)', 'var(--cs-data-cold)', 'var(--cs-coral)', 'var(--cs-data-green)'];
const col = j => PAL[j % PAL.length];

const dataCache = new Map();
const DATA = s => {
  const key = `${(+s.tau).toFixed(2)}|${(+s.sigma).toFixed(2)}`;
  if (!dataCache.has(key)) dataCache.set(key, S.at(+s.tau, +s.sigma));
  return dataCache.get(key);
};
const fitCache = new Map();
const FIT = s => {
  const key = `${(+s.tau).toFixed(2)}|${(+s.sigma).toFixed(2)}`;
  if (!fitCache.has(key)) fitCache.set(key, randomIntercept(DATA(s)));
  return fitCache.get(key);
};
const truthAt = s => {
  const base = S.truth.map(v => (v - 500) / 5);      /* the standardised effects */
  return base.map(v => 500 + (+s.tau) * v);
};

/** the risk curves — expensive, so computed once at module load */
const TAUS = [0, 1, 2, 3, 5, 8, 12, 20];
const RISK = TAUS.map(tau => {
  let a = 0, b = 0, c = 0;
  const R = 60;
  for (let i = 0; i < R; i++) {
    const W = schools({ tau, seed: 100 + i * 7 });
    const f = randomIntercept(W.at(tau, 10));
    const e = arr => arr.reduce((t2, v, j) => t2 + (v - W.truth[j]) ** 2, 0) / K;
    a += e(f.raw); b += e(f.raw.map(() => f.mu)); c += e(f.shrunk);
  }
  return { tau, none: Math.sqrt(a / R), complete: Math.sqrt(b / R), partial: Math.sqrt(c / R) };
});

/* ── the random-slope world: hours studied against score, per school ──────── */

const SLOPE = (() => {
  const r = st.rng(808);
  const beta = 6, tauS = 3.2;
  const per = S.sizes.map((nj, j) => {
    const sj = st.randNorm(r, 0, tauS);
    const b0 = S.truth[j] - 500;
    return {
      slope: beta + sj,
      pts: range(Math.max(nj, 4)).map(() => {
        const x = 1 + r() * 7;
        return [x, 470 + b0 + (beta + sj) * x + st.randNorm(r, 0, 9)];
      }),
    };
  });
  return { per, beta, groups: per.map(p => p.pts), fit: shrinkSlopes(per.map(p => p.pts)) };
})();

/* ── formula pieces ───────────────────────────────────────────────────────── */

const fTau = t('τ' + sup('', '2'), { explain: 'How much schools genuinely differ from each other. Estimated from the data, not assumed.', tone: 'gold', link: 'tau' });
const fSig = t('σ' + sup('', '2'), { explain: 'How much students differ within a school. The noise each group mean is measured through.', tone: 'warm', link: 'sigma' });
const fLam = t('λ' + sub('', 'j'), { explain: 'How much this particular group is trusted. Between 0 (ignore the group entirely) and 1 (take its own mean at face value).', tone: 'green', link: 'lam' });

export default {
  meta: {
    id: 'mixed', title: 'mixed-effects models', short: 'mixed effects',
    kicker: 'GROUPS THAT BORROW FROM EACH OTHER', status: 'live',
    deck: 'Your data comes in groups — schools, clinics, patients, repeated measures — and you have two obvious options, both bad. Ignore the groups and you pretend they are all the same. Fit each one separately and a group with three observations gets a wild answer. The third option is not a compromise between them: it has lower error than both.',
    dataNote: 'Eight schools with deliberately unequal enrolments, simulated so the true school effect is known and every method can be scored against it rather than against itself.',
    deps: ['multiple', 'measurement'], unlocks: [],
    next: 'timeseries', nextLabel: 'time series',
    outro: 'the amount of borrowing is not a taste. it is estimated, and when the groups really are the same it goes to one line on its own.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { tau: 5, sigma: 10, mode: 'raw', school: 0, mix: 1, slopes: false },

  steps: [

    /* ── 1 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'eight schools, and one of them has three students',
      prose: `<p>Test scores from eight schools. Every dot is a student.</p>
        <p>The thing that makes this hard is on the left. Ash has three students in it. Hollow has forty. Whatever you do next, those two facts should not be treated the same way — and the two standard approaches both do.</p>`,
      beats: [
        { label: 'the axes', hold: 1000, note: 'Schools across, score up.', scene: s => raw(s, 0) },
        { label: 'the students', hold: 1600, note: 'One hundred and sixteen students, unevenly spread. Three in Ash; forty in Hollow.', scene: s => raw(s, 1) },
        { label: 'how uneven', note: 'The bar under each school is how many students it has. This is the whole difficulty.', scene: s => raw(s, 2) },
      ],
    },

    /* ── 2 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'option one: pretend the schools do not exist',
      prose: `<p>Pool everything. One mean for all 116 students, and every school gets the same prediction.</p>
        <p>This is called <strong>complete pooling</strong>, and it is what you are doing every time you run a model on grouped data without mentioning the groups.</p>
        <p>Look at the residuals underneath. They are not scattered — students from the same school are consistently on the same side of the line. That structure is real information about the world, and this model has thrown it away.</p>`,
      formula: formula(
        t('complete pooling', { tone: 'cold' }) + op(':&nbsp;') + hat('y') + sub('', 'j') + eq + t('ȳ', { tone: 'gold' }) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('the same number for every group', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'one parameter for the whole dataset' }),
      readouts: [
        { key: 'm', label: 'the one estimate', tone: 'gold', get: s => st.mean(DATA(s).flat()), d: 2, wide: true },
        { key: 'e', label: 'error against the truth', tone: 'warm', get: s => rmse(DATA(s).map(() => st.mean(DATA(s).flat())), truthAt(s)), d: 3, wide: true },
      ],
      beats: [
        { label: 'one line', hold: 1500, note: 'The grand mean. Every school gets it.', scene: s => pool(s, 1) },
        { label: 'the residuals', hold: 1700, note: 'What each student is above or below that line. Sorted by school, and plainly not random — Dale is low, Elm is high, and the model has no way to say so.', scene: s => pool(s, 2) },
        { label: 'what it costs', note: 'The gaps between each school’s dots and the single line. Structure the model is calling noise.', scene: s => pool(s, 3) },
      ],
    },

    /* ── 3 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'option two: give every school its own mean',
      prose: `<p>The opposite. Eight schools, eight separate estimates, no communication between them. <strong>No pooling</strong>, and it is what a fixed-effect-per-group model does.</p>
        <p>The residuals are now well behaved, which looks like success. It is not.</p>
        <p>Ash's estimate is the average of three students. Move one of those three and it lurches. That is not a measurement of Ash — it is a measurement of Ash plus a great deal of noise, and the model is reporting it with the same confidence as Hollow's average of forty.</p>`,
      formula: formula(
        t('no pooling', { tone: 'warm' }) + op(':&nbsp;') + hat('y') + sub('', 'j') + eq + t('ȳ', { tone: 'cyan' }) + sub('', 'j') +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('one parameter per group, and nothing shared', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'and no answer at all for a school you have not seen' }),
      readouts: [
        { key: 'k', label: 'parameters fitted', tone: 'cyan', get: () => K, d: 0 },
        { key: 'se3', label: 'standard error, Ash (n=3)', tone: 'warm', get: s => +s.sigma / Math.sqrt(3), d: 2, wide: true },
        { key: 'se40', label: 'standard error, Hollow (n=40)', tone: 'green', get: s => +s.sigma / Math.sqrt(40), d: 2, wide: true },
        { key: 'e', label: 'error against the truth', tone: 'gold', get: s => rmse(FIT(s).raw, truthAt(s)), d: 3, wide: true },
      ],
      beats: [
        { label: 'eight means', hold: 1500, note: 'Each school, on its own terms.', scene: s => nopool(s, 1) },
        { label: 'with their error bars', hold: 1800, note: 'How far each estimate could plausibly be from the truth. Ash’s bar is nearly four times Hollow’s, for exactly one reason: √3 against √40.', scene: s => nopool(s, 2) },
        { label: 'against the truth', hold: 1900, note: 'The world is simulated, so the true school effects can be drawn. The small schools miss by a lot — and they miss <em>outward</em>, because noise pushes an estimate away from the middle far more often than toward it.', scene: s => nopool(s, 3) },
        { label: 'the pattern', note: 'Every one of the extreme-looking schools is a small one. That is not a coincidence, and it is the clue.', scene: s => nopool(s, 3) },
      ],
    },

    /* ── 4 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'the other seven schools know something about this one',
      prose: `<p>Here is the move, and it is the whole idea.</p>
        <p>Before seeing a single student from Ash, you already know something: schools are not wildly different from each other. The other seven tell you roughly how much variation between schools there is, and Ash is a school.</p>
        <p>So an estimate for Ash built from three students should not be taken at face value. Pull it toward what schools are like in general — and pull it <em>further</em> the less you trust it.</p>
        <p>Drag <strong>how much to borrow</strong> from 0 to 1 and watch the estimates slide.</p>`,
      controls: [
        { type: 'slider', key: 'mix', label: 'how much to borrow', min: 0, max: 1, step: 0.02, fast: true, fmt: v => (+v).toFixed(2) },
      ],
      readouts: [
        { key: 'm', label: 'borrowing', tone: 'gold', get: s => +s.mix, d: 2, wide: true },
        { key: 'w', label: 'what you are doing', get: s => (+s.mix < 0.02 ? 'no pooling' : +s.mix > 0.98 ? 'complete pooling' : 'something in between'), wide: true },
        { key: 'e', label: 'error against the truth', tone: 'warm', get: s => rmse(blend(s, +s.mix), truthAt(s)), d: 3, wide: true },
      ],
      beats: [
        { label: 'borrow nothing', hold: 1400, note: 'The eight separate means, untouched. This is step 3.', scene: s => blendScene(s, 0) },
        { label: 'borrow everything', hold: 1500, note: 'All the way to one line. This is step 2.', scene: s => blendScene(s, 1) },
        { label: 'somewhere between', hold: 1700, note: 'Half way. Everything moves by the same fraction, which is already better than either end — but it is still wrong, because Ash and Hollow are being treated identically.', scene: s => blendScene(s, 0.5) },
        { label: 'the missing piece', note: 'A single dial cannot be right. Ash needs to move a long way and Hollow barely at all. Each school needs <em>its own</em> amount.', scene: s => blendScene(s, +s.mix, true) },
      ],
    },

    /* ── 5 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'the weight is the reliability formula',
      prose: `<p>Each school gets its own weight, and the formula for it is one you have already built.</p>
        <p>Think of a school's own mean as a <em>measurement</em> of that school. Like any measurement it is a true value plus error — and the error here is the standard error of a mean, σ²⁄n. So the reliability of that measurement is signal over signal-plus-noise, exactly as before.</p>
        <p>That reliability <em>is</em> the weight. A school measured through less noise is trusted more, and trust is all that shrinkage means.</p>`,
      formula: formula(
        fLam + eq + frac(fTau, fTau + plus + frac(fSig, 'n' + sub('', 'j'))) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('compare:', { tone: 'muted', cls: 'fx-tiny' }) + op('&nbsp;') +
        t('ρ = s²ᴛ / (s²ᴛ + s²ᴇ)', { tone: 'muted' }) + '<br>' +
        hat('y') + sub('', 'j') + eq + t('μ̂', { tone: 'gold' }) + plus + fLam + paren(t('ȳ', { tone: 'cyan' }) + sub('', 'j') + minus + t('μ̂', { tone: 'gold' })),
        { caption: 'the same fraction, with the group mean playing the part of the measurement' }),
      dep: { note: 'signal over signal-plus-noise is', lesson: 'measurement', label: 'reliability' },
      controls: [
        { type: 'slider', key: 'school', label: 'which school', min: 0, max: K - 1, step: 1, fast: true, fmt: v => NAMES[v] },
      ],
      readouts: [
        { key: 'n', label: 'students', tone: 'cyan', get: s => S.sizes[+s.school], d: 0 },
        { key: 'se', label: 'σ²/n', tone: 'warm', get: s => ((+s.sigma) ** 2) / S.sizes[+s.school], d: 2, wide: true },
        { key: 'tau', label: 'τ²', tone: 'gold', get: s => FIT(s).tau2, d: 2 },
        { key: 'l', label: 'λ — how much it is trusted', tone: 'green', get: s => FIT(s).lambda[+s.school], d: 3, wide: true },
      ],
      beats: [
        { label: 'one school', hold: 1500, note: 'Ash. Three students, so its own mean is measured through a lot of noise.', scene: s => weight({ ...s, school: 0 }, 1) },
        { label: 'the two variances', hold: 1700, note: 'Gold is how much schools differ; red is how noisily this school was measured. λ is the gold share of the total.', scene: s => weight({ ...s, school: 0 }, 2) },
        { label: 'the biggest school', hold: 1700, note: 'Hollow. Forty students, so σ²/n is small, so almost all of the bar is gold and λ is close to 1.', scene: s => weight({ ...s, school: 7 }, 2) },
        { label: 'all eight', hold: 1800, note: 'One weight per school, rising with n. Nobody chose these — they fall out of two variances.', scene: s => weight(s, 3) },
        { label: 'your turn', note: 'Step through the schools and watch the red block shrink as n grows.', scene: s => weight(s, 2) },
      ],
    },

    /* ── 6 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'watch them move',
      prose: `<p>Now apply it. Each school's estimate slides from its own mean toward the overall mean, by 1 − λ of the way.</p>
        <p>The small schools travel a long way. The big ones barely move. Nothing was chosen: the distance each one travels is set by how many students it had and by how much schools were found to differ.</p>
        <p>This is <strong>shrinkage</strong>, and the name is unhelpful — nothing is being shrunk toward zero. Estimates are being pulled toward each other, in proportion to how little each one is worth on its own.</p>`,
      readouts: [
        { key: 'a', label: 'Ash moved', tone: 'warm', get: s => Math.abs(FIT(s).shrunk[0] - FIT(s).raw[0]), d: 2, wide: true },
        { key: 'h', label: 'Hollow moved', tone: 'green', get: s => Math.abs(FIT(s).shrunk[7] - FIT(s).raw[7]), d: 2, wide: true },
        { key: 'e', label: 'error against the truth', tone: 'gold', get: s => rmse(FIT(s).shrunk, truthAt(s)), d: 3, wide: true },
      ],
      beats: [
        { label: 'where they started', hold: 1400, note: 'The eight raw means from step 3.', scene: s => slide(s, 0) },
        { label: 'and where they go', hold: 1800, note: 'Each one pulled toward the middle by 1 − λ. Watch the three-student school travel.', scene: s => slide(s, 1) },
        { label: 'against the truth', hold: 1900, note: 'The crosses are the true school effects. The shrunk estimates are closer to them than the raw ones were — for six of the eight schools, and on average for all of them.', scene: s => slide(s, 2) },
        { label: 'the small ones gained most', note: 'Which is the point. Nothing was taken from Hollow to give to Ash; Hollow was already fine. The borrowing helps precisely the estimates that had nothing to lose.', scene: s => slide(s, 2) },
      ],
    },

    /* ── 7 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'nobody chose how much to borrow',
      prose: `<p>The weights came out of two numbers: how much students vary within a school, and how much schools vary from each other. The first is easy. The second is the interesting one, because you never observe a school's true level — only its noisy mean.</p>
        <p>So τ² is estimated by asking how much more spread out the school means are than noise alone could explain. If they are no more spread out than noise, τ̂² lands on zero and every λ goes to zero, and the model becomes complete pooling <em>by itself</em>.</p>
        <p>Drag <strong>how much schools really differ</strong>. The estimate follows it, and the amount of pooling follows the estimate.</p>`,
      formula: formula(
        t('spread of the group means', { tone: 'cyan', cls: 'fx-tiny' }) + op('&nbsp;=&nbsp;') +
        fTau + plus + t('what noise alone would give', { tone: 'warm', cls: 'fx-tiny' }) + '<br>' +
        t('so', { tone: 'muted', cls: 'fx-tiny' }) + op('&nbsp;') + hat('τ') + sup('', '2') + eq +
        t('observed spread', { tone: 'cyan', cls: 'fx-tiny' }) + minus + t('expected noise', { tone: 'warm', cls: 'fx-tiny' }) +
        op('&nbsp;&nbsp;(never below zero)', { tone: 'muted' }),
        { caption: 'and if that comes out at zero, the model pools completely without being told to' }),
      controls: [
        { type: 'slider', key: 'tau', label: 'how much schools really differ  (τ)', min: 0, max: 20, step: 0.5, fast: true, fmt: v => (+v).toFixed(1) },
        { type: 'slider', key: 'sigma', label: 'how much students differ  (σ)', min: 4, max: 20, step: 0.5, fast: true, fmt: v => (+v).toFixed(1) },
      ],
      readouts: [
        { key: 'tt', label: 'τ, true', tone: 'muted', get: s => +s.tau, d: 2 },
        { key: 'th', label: 'τ̂, estimated', tone: 'gold', get: s => FIT(s).tau, d: 2, wide: true },
        { key: 'l', label: 'λ range across schools', tone: 'green', get: s => `${FIT(s).lambda[0].toFixed(2)} – ${FIT(s).lambda[K - 1].toFixed(2)}`, wide: true },
        { key: 'icc', label: 'share of variance that is between schools', tone: 'cyan', get: s => FIT(s).icc * 100, d: 1, suf: '%', wide: true },
      ],
      beats: [
        { label: 'schools are identical', hold: 1800, note: 'τ = 0. The school means still differ, because noise. The model works out that the difference is only noise, sets τ̂ near zero, and collapses to one line.', scene: s => tauScene({ ...s, tau: 0 }) },
        { label: 'schools differ a little', hold: 1700, note: 'τ = 3. Partial pooling: everything moves, the small schools most.', scene: s => tauScene({ ...s, tau: 3 }) },
        { label: 'schools differ a lot', hold: 1800, note: 'τ = 15. Now a school’s own mean really is informative, every λ is close to 1, and the model stops pooling almost entirely — again, on its own.', scene: s => tauScene({ ...s, tau: 15 }) },
        { label: 'your turn', note: 'Drag τ across its range and watch τ̂ track it and the eight lines fan out.', scene: s => tauScene(s) },
      ],
      aside: `<p><strong>What "τ̂ = 0" means in practice.</strong> Software will tell you the random-effect variance is zero and call it a singular fit. That is not always an error — it can mean the groups genuinely do not differ by more than noise. It can also mean you have too few groups to tell. Five groups is very few; below about eight, τ̂ is barely identified and a warning is the honest output.</p>`,
    },

    /* ── 8 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'so is it actually better?',
      prose: `<p>The test that matters: distance from the truth, averaged over sixty simulated worlds at each setting, for all three methods.</p>
        <p><strong>No pooling</strong> is a flat line. It never learns anything from the other groups, so how much groups differ makes no difference to it.</p>
        <p><strong>Complete pooling</strong> is superb when groups are alike and catastrophic when they are not.</p>
        <p><strong>Partial pooling</strong> tracks whichever of the two is winning, and beats both in the middle — which is where every real dataset lives. It costs about ten percent at the extremes and saves you a great deal everywhere else.</p>`,
      controls: [
        { type: 'slider', key: 'tau', label: 'how much groups differ  (τ)', min: 0, max: 20, step: 0.5, fast: true, fmt: v => (+v).toFixed(1) },
      ],
      readouts: [
        { key: 'a', label: 'no pooling', tone: 'cyan', get: s => riskAt(+s.tau).none, d: 3, wide: true },
        { key: 'b', label: 'complete pooling', tone: 'cold', get: s => riskAt(+s.tau).complete, d: 3, wide: true },
        { key: 'c', label: 'partial pooling', tone: 'green', get: s => riskAt(+s.tau).partial, d: 3, wide: true },
        { key: 'w', label: 'best here', tone: 'gold', get: s => { const r = riskAt(+s.tau); const m = Math.min(r.none, r.complete, r.partial); return r.partial === m ? 'partial' : r.none === m ? 'no pooling' : 'complete'; }, wide: true },
      ],
      beats: [
        { label: 'no pooling', hold: 1500, note: 'Flat. It has no mechanism for using the other groups, so nothing about them changes its error.', scene: s => risk(s, 1) },
        { label: 'complete pooling', hold: 1700, note: 'Brilliant on the left, ruinous on the right. Everything depends on an assumption you cannot check by looking at the fit.', scene: s => risk(s, 2) },
        { label: 'partial pooling', hold: 1900, note: 'Hugging the lower envelope of both. This is the result that made the method famous — the estimate is better <em>even for the group you care about</em>, not just on average.', scene: s => risk(s, 3) },
        { label: 'your turn', note: 'Drag τ and watch the marker cross the point where complete pooling stops being a good idea.', scene: s => risk(s, 3) },
      ],
    },

    /* ── 9 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'slopes can vary too',
      prose: `<p>Everything so far let schools sit at different levels. But the <em>effect</em> of something can differ by group as well: an extra hour of study might be worth more in one school than another.</p>
        <p>That is a random slope, and it shrinks by the same logic. A slope estimated from four students has a large standard error, so it is pulled hard toward the average slope. A slope from forty students is left mostly alone.</p>
        <p>In the notation you will see in software this is the difference between <code>(1 | school)</code> and <code>(1 + hours | school)</code>, and the second is usually what people mean when they say "the effect varies by site".</p>`,
      controls: [
        { type: 'toggle', key: 'slopes', label: 'shrink the slopes', explain: 'Pull each school’s slope toward the average, by how precisely it was estimated.' },
      ],
      readouts: [
        { key: 'g', label: 'average slope', tone: 'gold', get: () => SLOPE.fit.grand, d: 2, wide: true },
        { key: 'sp', label: 'spread of raw slopes', tone: 'warm', get: () => st.sd(SLOPE.fit.slopes.map(f => f.b1).filter(isFinite)), d: 2, wide: true },
        { key: 'ss', label: 'spread after shrinking', tone: 'green', get: () => st.sd(SLOPE.fit.slopes.map(f => f.shrunk)), d: 2, wide: true },
      ],
      beats: [
        { label: 'one line per school', hold: 1600, note: 'Eight separate regressions, fitted with no communication. The small schools produce slopes that are frankly silly.', scene: s => slopes({ ...s, slopes: false }) },
        { label: 'shrink them', hold: 1900, note: 'Each slope pulled toward the average by its own weight. The fan closes, and it closes unevenly.', scene: s => slopes({ ...s, slopes: true }) },
        { label: 'your turn', note: 'Toggle it and watch which lines move. The ones that swing furthest are the ones with the fewest students.', scene: s => slopes(s) },
      ],
    },

    /* ── 10 ────────────────────────────────────────────────────────────────── */
    {
      title: 'the same idea, under six names',
      prose: `<p>This method was invented independently several times, and every field kept its own word for it. If you have met any of these you have met all of them.</p>`,
      beats: [
        {
          label: 'the names',
          scene: () => [
            label('h', 360, 68, 'all of these are the same estimator', { cls: 'lab-big lab-mid lab-gold' }),
            [
              ['mixed-effects model', 'some effects fixed, some allowed to vary by group. the phrasing in most software'],
              ['multilevel / hierarchical model', 'students inside schools inside districts. the education and Bayesian phrasing'],
              ['random effects', 'the group effects are treated as draws from a distribution, not as fixed unknowns'],
              ['empirical Bayes', 'the prior over group effects is estimated from the data rather than chosen'],
              ['James–Stein estimator', 'the 1961 proof that shrinking beats the obvious answer, which nobody believed at first'],
              ['ridge on group dummies', 'penalise the group coefficients and you get the same shrinkage, from the other direction'],
            ].map(([a, b], i) => [
              rect('nr' + i, 54, 100 + i * 66, 612, 54, { cls: 'cell', delay: i * 100 }),
              label('na' + i, 74, 124 + i * 66, a, { cls: 'lab-big lab-cyan', delay: i * 100 }),
              label('nb' + i, 74, 143 + i * 66, b, { cls: 'lab-sm', delay: i * 100 }),
            ]),
            label('f', 360, 516, 'if the groups are real, the model should know about them. this is how.', { cls: 'lab lab-mid lab-green' }),
          ],
        },
        {
          label: 'when to reach for it',
          note: 'The rule is not "when you have groups". It is "when you have groups <em>and</em> you want an estimate for each one".',
          scene: () => [
            label('h', 360, 76, 'reach for it when', { cls: 'lab-big lab-mid lab-gold' }),
            [
              ['you need an estimate per group', 'per-hospital, per-school, per-participant — and some of them are small', 'green'],
              ['observations are not independent', 'repeated measures, students in classes, patients in clinics. ignoring it makes every p-value too small', 'green'],
              ['the groups are a sample of more groups', 'you care about schools in general, not these eight specifically', 'green'],
              ['there are only three or four groups', 'τ̂ is barely identified. use fixed effects and say so', 'warm'],
              ['the groups are the whole population', 'four experimental conditions, and no ninth condition exists. fixed effects are the honest choice', 'warm'],
            ].map(([a, b, tone], i) => [
              rect('wr' + i, 54, 108 + i * 76, 612, 64, { cls: 'cell', delay: i * 120 }),
              label('wa' + i, 74, 134 + i * 76, a, { cls: 'lab-big lab-' + tone, delay: i * 120 }),
              label('wb' + i, 74, 154 + i * 76, b, { cls: 'lab-sm', delay: i * 120 }),
            ]),
          ],
        },
      ],
    },
  ],
};

/* ── helpers ──────────────────────────────────────────────────────────────── */

const rmse = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0) / a.length);
const blend = (s, m) => { const f = FIT(s); return f.raw.map(v => v + m * (f.mu - v)); };

function riskAt(tau) {
  const i = TAUS.findIndex(v => v >= tau);
  if (i <= 0) return RISK[0];
  const a = RISK[i - 1], b = RISK[i];
  const w = (tau - a.tau) / (b.tau - a.tau);
  return {
    none: a.none + w * (b.none - a.none),
    complete: a.complete + w * (b.complete - a.complete),
    partial: a.partial + w * (b.partial - a.partial),
  };
}

function SF(s, { r = 44, t = 52, b = 96 } = {}) {
  const f = frame({ w: 720, h: 540, l: 70, r, t, b });
  f.setX(-0.6, K - 0.4);
  const all = DATA(s).flat();
  const pad = Math.max(4, (Math.max(...all) - Math.min(...all)) * 0.08);
  f.setY(Math.min(...all) - pad, Math.max(...all) + pad);
  return f;
}

function schoolAxis(f, { counts = false } = {}) {
  const out = [
    { key: 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x1, y2: f.y0 } },
    { key: 'ay', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x0, y2: f.y1 } },
    ...[f.dy[0], (f.dy[0] + f.dy[1]) / 2, f.dy[1]].map((v, i) =>
      label('yt' + i, f.x0 - 9, f.sy(v) + 4, String(Math.round(v)), { cls: 'ax-tick ax-tick-y' })),
    ...NAMES.map((n, j) => label('xn' + j, f.sx(j), f.y0 + 17, n, { cls: 'ax-tick' })),
    { key: 'yl', tag: 'text', cls: 'ax-label', attrs: { x: 0, y: 0 }, set: { transform: `translate(20 ${(f.y0 + f.y1) / 2}) rotate(-90)` }, text: 'test score' },
  ];
  if (counts) S.sizes.forEach((nj, j) => {
    const w = 26;
    out.push(
      rect('cb' + j, f.sx(j) - w / 2, f.y0 + 24, (w * nj) / 40, 9, { cls: 'sq', set: { fill: col(j), stroke: 'none' }, delay: j * 60 }),
      label('cn' + j, f.sx(j), f.y0 + 46, `n = ${nj}`, { cls: 'lab-sm lab-mid', delay: j * 60 }));
  });
  return out;
}

const studentDots = (s, f, o = {}) => DATA(s).flatMap((g, j) => g.map((v, i) => ({
  key: `d-${j}-${i}`, tag: 'circle', cls: 'pt', dur: 300,
  attrs: { cx: f.sx(j) + (((i % 7) - 3) * 3.4), cy: f.sy(v), r: 3.4 },
  set: { fill: col(j), stroke: 'none' },
  opacity: o.opacity ?? 0.75,
  tip: `${NAMES[j]} · student ${i + 1}<br><b>${v.toFixed(1)}</b>`,
})));

function raw(s, phase) {
  const f = SF(s);
  return [
    ...schoolAxis(f, { counts: phase >= 2 }),
    ...(phase >= 1 ? studentDots(s, f) : []),
    phase >= 2 ? label('cl', f.x0, f.y0 + 46, 'students:', { cls: 'lab-sm lab-end' }) : null,
  ].filter(Boolean);
}

function pool(s, phase) {
  const f = SF(s);
  const gm = st.mean(DATA(s).flat());
  const out = [
    ...schoolAxis(f),
    ...studentDots(s, f, { opacity: phase >= 2 ? 0.35 : 0.75 }),
    path('gm', [[f.x0, f.sy(gm)], [f.x1, f.sy(gm)]], { cls: 'curve curve-fit' }),
    numLabel('gml', f.x1 - 4, f.sy(gm) - 8, gm, { cls: 'lab lab-end lab-green', d: 2, pre: 'one estimate: ' }),
  ];
  if (phase >= 2) {
    const g = frame({ w: 720, h: 540, l: 70, r: 44, t: 356, b: 96 });
    g.setX(-0.6, K - 0.4);
    const res = DATA(s).flat().map(v => v - gm);
    const m = Math.max(...res.map(Math.abs));
    g.setY(-m * 1.1, m * 1.1);
    out.push(
      { key: 'rz', tag: 'line', cls: 'ax-line', attrs: { x1: g.x0, y1: g.sy(0), x2: g.x1, y2: g.sy(0) } },
      label('rl', g.x0, g.y1 - 8, 'residuals, sorted by school — and plainly not random', { cls: 'lab-sm lab-warm' }),
      ...DATA(s).flatMap((grp, j) => grp.map((v, i) => ({
        key: `r-${j}-${i}`, tag: 'circle', cls: 'pt', dur: 300,
        attrs: { cx: g.sx(j) + (((i % 7) - 3) * 3.4), cy: g.sy(v - gm), r: 3 },
        set: { fill: col(j), stroke: 'none' }, opacity: 0.8,
      }))));
  }
  if (phase >= 3) out.push(...FIT(s).raw.map((v, j) =>
    path(`gap-${j}`, [[f.sx(j), f.sy(gm)], [f.sx(j), f.sy(v)]], {
      cls: 'stick', set: { stroke: col(j), 'stroke-width': 3 }, opacity: 0.9,
      tip: `${NAMES[j]} sits ${(v - gm).toFixed(1)} from the single estimate`,
    })));
  return out;
}

function nopool(s, phase) {
  const f = SF(s);
  const F = FIT(s);
  const truth = truthAt(s);
  const out = [
    ...schoolAxis(f),
    ...studentDots(s, f, { opacity: 0.3 }),
    ...F.raw.map((v, j) => path(`m-${j}`, [[f.sx(j) - 15, f.sy(v)], [f.sx(j) + 15, f.sy(v)]], {
      cls: 'stick', set: { stroke: col(j), 'stroke-width': 4 },
      tip: `${NAMES[j]}<br>own mean = <b>${v.toFixed(1)}</b><br>n = ${S.sizes[j]}`,
    })),
  ];
  if (phase >= 2) out.push(...F.raw.map((v, j) => {
    const se = (+s.sigma) / Math.sqrt(S.sizes[j]);
    return [
      path(`e-${j}`, [[f.sx(j), f.sy(v - 1.96 * se)], [f.sx(j), f.sy(v + 1.96 * se)]], {
        cls: 'stick', set: { stroke: col(j), 'stroke-width': 1.4 }, opacity: 0.8,
      }),
      path(`ea-${j}`, [[f.sx(j) - 6, f.sy(v - 1.96 * se)], [f.sx(j) + 6, f.sy(v - 1.96 * se)]], { cls: 'stick', set: { stroke: col(j), 'stroke-width': 1.4 }, opacity: 0.8 }),
      path(`eb-${j}`, [[f.sx(j) - 6, f.sy(v + 1.96 * se)], [f.sx(j) + 6, f.sy(v + 1.96 * se)]], { cls: 'stick', set: { stroke: col(j), 'stroke-width': 1.4 }, opacity: 0.8 }),
    ];
  }).flat());
  if (phase >= 3) out.push(...truth.map((v, j) => [
    path(`tx-${j}`, [[f.sx(j) - 7, f.sy(v) - 7], [f.sx(j) + 7, f.sy(v) + 7]], { cls: 'stick', set: { stroke: 'var(--cs-text-bright)', 'stroke-width': 2 } }),
    path(`ty-${j}`, [[f.sx(j) - 7, f.sy(v) + 7], [f.sx(j) + 7, f.sy(v) - 7]], { cls: 'stick', set: { stroke: 'var(--cs-text-bright)', 'stroke-width': 2 } }),
  ]).flat(),
  label('tl', f.x1 - 4, f.y1 + 6, '✕ the true school effect', { cls: 'lab-sm lab-end' }));
  return out;
}

function blendScene(s, m, hint) {
  const f = SF(s);
  const F = FIT(s);
  const est = blend(s, m);
  return [
    ...schoolAxis(f),
    ...studentDots(s, f, { opacity: 0.22 }),
    path('gm', [[f.x0, f.sy(F.mu)], [f.x1, f.sy(F.mu)]], { cls: 'rule rule-gold rule-dash' }),
    ...F.raw.map((v, j) => path(`ghost-${j}`, [[f.sx(j) - 13, f.sy(v)], [f.sx(j) + 13, f.sy(v)]], {
      cls: 'stick', set: { stroke: col(j), 'stroke-width': 1.4 }, opacity: 0.3,
    })),
    ...est.map((v, j) => path(`m-${j}`, [[f.sx(j) - 15, f.sy(v)], [f.sx(j) + 15, f.sy(v)]], {
      cls: 'stick', set: { stroke: col(j), 'stroke-width': 4 },
      tip: `${NAMES[j]}<br>raw ${F.raw[j].toFixed(1)} → <b>${v.toFixed(1)}</b>`,
    })),
    numLabel('ml', f.x0 + 8, f.y1 + 6, m, { cls: 'lab-big lab-gold', d: 2, pre: 'borrowing = ' }),
    hint ? [
      label('h1', f.x0 + 8, f.y1 + 28, 'one dial moves everything the same amount —', { cls: 'lab-sm lab-warm' }),
      label('h2', f.x0 + 8, f.y1 + 42, 'but Ash has three students and Hollow has forty.', { cls: 'lab-sm lab-warm' }),
    ] : null,
  ].filter(Boolean);
}

function weight(s, phase) {
  const F = FIT(s);
  const j = clamp(+s.school, 0, K - 1);

  if (phase >= 3) {
    const X0 = 118, W = 420, RH = 44;
    return [
      label('h', 360, 76, 'one weight per school', { cls: 'lab-big lab-mid lab-gold' }),
      ...F.lambda.map((l, k) => {
        const y = 112 + k * RH;
        return [
          label('n' + k, X0 - 12, y + 20, NAMES[k], { cls: 'lab-sm lab-end' }),
          label('c' + k, X0 - 12, y + 32, `n = ${S.sizes[k]}`, { cls: 'lab-sm lab-end' }),
          rect('bg' + k, X0, y, W, 26, { cls: 'sq sq-dim' }),
          rect('bf' + k, X0, y, W * l, 26, { cls: 'sq', set: { fill: col(k), stroke: 'none' }, opacity: 0.75,
            tip: `${NAMES[k]}<br>λ = ${l.toFixed(3)}` }),
          numLabel('v' + k, X0 + W + 14, y + 19, l, { cls: 'lab', d: 3 }),
        ];
      }),
      label('f', 360, 490, 'λ rises with n, because a mean of forty is a better measurement than a mean of three.', { cls: 'lab-sm lab-mid lab-green' }),
    ];
  }

  const noise = F.sigma2 / S.sizes[j];
  const tot = F.tau2 + noise;
  const X0 = 110, W = 470, Y = 190, H = 64;
  return [
    label('h', 360, 90, `${NAMES[j]} · ${S.sizes[j]} students`, { cls: 'lab-big lab-mid lab-cyan' }),
    label('h2', 360, 112, 'how much of this school’s apparent difference is real?', { cls: 'lab-sm lab-mid' }),
    phase >= 2 ? [
      rect('sig', X0, Y, W * (F.tau2 / tot), H, { cls: 'sq sq-gold' }),
      rect('noi', X0 + W * (F.tau2 / tot), Y, W * (noise / tot), H, { cls: 'sq sq-resid' }),
      label('sl', X0 + 10, Y + 26, 'τ² — schools really do differ', { cls: 'lab-sm lab-gold' }),
      numLabel('sv', X0 + 10, Y + 46, F.tau2, { cls: 'lab lab-gold', d: 2 }),
      noise / tot > 0.22 ? label('nl', X0 + W * (F.tau2 / tot) + 10, Y + 26, 'σ²/n — noise in this mean', { cls: 'lab-sm lab-warm' }) : null,
      noise / tot > 0.22 ? numLabel('nv', X0 + W * (F.tau2 / tot) + 10, Y + 46, noise, { cls: 'lab lab-warm', d: 2 }) : null,
      path('cut', [[X0 + W * (F.tau2 / tot), Y - 10], [X0 + W * (F.tau2 / tot), Y + H + 10]], { cls: 'rule rule-gold' }),
      numLabel('lam', 360, Y + 120, F.lambda[j], { cls: 'lab-big lab-mid lab-green', d: 3, pre: 'λ = ' }),
      label('lam2', 360, Y + 142, 'the gold share of the bar', { cls: 'lab-sm lab-mid' }),
      numLabel('lam3', 360, Y + 174, F.lambda[j], {
        cls: 'lab lab-mid', d: 3,
        fmt: v => `${F.tau2.toFixed(1)} ÷ (${F.tau2.toFixed(1)} + ${noise.toFixed(1)}) = ${v.toFixed(3)}`,
      }),
      label('lam4', 360, Y + 208, `so ${NAMES[j]} keeps ${(F.lambda[j] * 100).toFixed(0)}% of its own mean, and takes ${((1 - F.lambda[j]) * 100).toFixed(0)}% from everyone else`, { cls: 'lab-sm lab-mid lab-green' }),
    ] : [
      rect('one', X0, Y, W, H, { cls: 'cell' }),
      label('onel', 360, Y + 38, `mean of ${S.sizes[j]} students = ${F.raw[j].toFixed(1)}`, { cls: 'lab-big lab-mid' }),
      label('onel2', 360, Y + 110, 'a measurement of this school — true level plus error', { cls: 'lab lab-mid lab-gold' }),
      label('onel3', 360, Y + 132, 'and the error is σ²/n, which is small only when n is big', { cls: 'lab-sm lab-mid' }),
    ],
  ].flat().filter(Boolean);
}

function slide(s, phase) {
  const f = SF(s);
  const F = FIT(s);
  const est = phase >= 1 ? F.shrunk : F.raw;
  return [
    ...schoolAxis(f),
    ...studentDots(s, f, { opacity: 0.2 }),
    path('gm', [[f.x0, f.sy(F.mu)], [f.x1, f.sy(F.mu)]], { cls: 'rule rule-gold rule-dash' }),
    label('gml', f.x1 - 4, f.sy(F.mu) - 8, 'overall mean', { cls: 'lab-sm lab-end lab-gold' }),
    phase >= 1 ? F.raw.map((v, j) => [
      path(`gh-${j}`, [[f.sx(j) - 13, f.sy(v)], [f.sx(j) + 13, f.sy(v)]], {
        cls: 'stick', set: { stroke: col(j), 'stroke-width': 1.4 }, opacity: 0.3,
      }),
      path(`ar-${j}`, [[f.sx(j), f.sy(v)], [f.sx(j), f.sy(F.shrunk[j])]], { cls: 'arrow', delay: j * 90 }),
    ]) : null,
    ...est.map((v, j) => path(`m-${j}`, [[f.sx(j) - 15, f.sy(v)], [f.sx(j) + 15, f.sy(v)]], {
      cls: 'stick', set: { stroke: col(j), 'stroke-width': 4 },
      tip: `${NAMES[j]} (n=${S.sizes[j]})<br>own mean ${F.raw[j].toFixed(1)}<br>λ = ${F.lambda[j].toFixed(2)}<br>estimate <b>${F.shrunk[j].toFixed(1)}</b>`,
    })),
    phase >= 2 ? truthAt(s).map((v, j) => [
      path(`tx-${j}`, [[f.sx(j) - 7, f.sy(v) - 7], [f.sx(j) + 7, f.sy(v) + 7]], { cls: 'stick', set: { stroke: 'var(--cs-text-bright)', 'stroke-width': 2 } }),
      path(`ty-${j}`, [[f.sx(j) - 7, f.sy(v) + 7], [f.sx(j) + 7, f.sy(v) - 7]], { cls: 'stick', set: { stroke: 'var(--cs-text-bright)', 'stroke-width': 2 } }),
    ]) : null,
    phase >= 1 ? F.raw.map((v, j) => numLabel(`mv-${j}`, f.sx(j), f.y1 + 4 + (j % 2) * 15, Math.abs(F.shrunk[j] - v), {
      cls: 'lab-sm lab-mid', d: 1, pre: 'moved ', delay: j * 90,
    })) : null,
    phase >= 2 ? label('tl', f.x0 + 6, f.y1 + 34, '✕ the truth', { cls: 'lab-sm' }) : null,
  ].flat(2).filter(Boolean);
}

function tauScene(s) {
  const f = SF(s);
  const F = FIT(s);
  return [
    ...schoolAxis(f),
    ...studentDots(s, f, { opacity: 0.2 }),
    path('gm', [[f.x0, f.sy(F.mu)], [f.x1, f.sy(F.mu)]], { cls: 'rule rule-gold rule-dash' }),
    ...F.raw.map((v, j) => path(`gh-${j}`, [[f.sx(j) - 13, f.sy(v)], [f.sx(j) + 13, f.sy(v)]], {
      cls: 'stick', set: { stroke: col(j), 'stroke-width': 1.2 }, opacity: 0.28,
    })),
    ...F.shrunk.map((v, j) => path(`m-${j}`, [[f.sx(j) - 15, f.sy(v)], [f.sx(j) + 15, f.sy(v)]], {
      cls: 'stick', set: { stroke: col(j), 'stroke-width': 4 },
      tip: `${NAMES[j]}<br>λ = ${F.lambda[j].toFixed(2)}`,
    })),
    numLabel('t1', f.x0 + 8, f.y1 + 4, +s.tau, { cls: 'lab lab-muted', d: 1, pre: 'τ set to ' }),
    numLabel('t2', f.x0 + 8, f.y1 + 24, F.tau, { cls: 'lab-big lab-gold', d: 2, pre: 'τ̂ estimated at ' }),
    label('t3', f.x1 - 4, f.y1 + 4, F.tau < 0.4 ? 'λ ≈ 0 — collapsed to one line'
      : F.lambda[0] > 0.85 ? 'λ ≈ 1 — barely pooling at all'
        : 'partial pooling', { cls: 'lab lab-end lab-green' }),
  ];
}

function risk(s, phase) {
  const f = frame({ w: 720, h: 540, l: 82, r: 214, t: 76, b: 90 });
  f.setX(0, 20); f.setY(0, 20);
  const px = (k, key) => RISK.map(r => [f.sx(r.tau), f.sy(Math.min(r[key], 20))]);
  const out = [
    { key: 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x1, y2: f.y0 } },
    { key: 'ay', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x0, y2: f.y1 } },
    label('xl', (f.x0 + f.x1) / 2, f.y0 + 32, 'how much groups really differ  (τ)', { cls: 'ax-label' }),
    { key: 'yl', tag: 'text', cls: 'ax-label', attrs: { x: 0, y: 0 }, set: { transform: `translate(${f.x0 - 30} ${(f.y0 + f.y1) / 2}) rotate(-90)` }, text: 'distance from the truth' },
    ...[0, 5, 10, 15, 20].map(v => label('xt' + v, f.sx(v), f.y0 + 17, String(v), { cls: 'ax-tick' })),
    ...[0, 5, 10, 15, 20].map(v => label('yt' + v, f.x0 - 9, f.sy(v) + 4, String(v), { cls: 'ax-tick ax-tick-y' })),
  ];
  const LINES = [
    { k: 'none', c: 'var(--cs-cyan)', lab: 'no pooling', at: 1 },
    { k: 'complete', c: 'var(--cs-data-cold)', lab: 'complete pooling', at: 2 },
    { k: 'partial', c: 'var(--cs-data-green)', lab: 'partial pooling', at: 3 },
  ];
  LINES.forEach((L, i) => {
    if (phase < L.at) return;
    out.push(
      path('c' + i, px(i, L.k), { cls: 'curve', set: { stroke: L.c, 'stroke-width': L.k === 'partial' ? 3.4 : 2 } }),
      ...RISK.map((r, j) => ({
        key: `p${i}-${j}`, tag: 'circle', cls: 'pt',
        attrs: { cx: f.sx(r.tau), cy: f.sy(Math.min(r[L.k], 20)), r: 3.4 },
        set: { fill: L.c, stroke: 'none' },
        tip: `${L.lab}<br>τ = ${r.tau}<br>error ${r[L.k].toFixed(3)}`,
      })));
  });
  const now = riskAt(+s.tau);
  out.push(
    path('you', [[f.sx(clamp(+s.tau, 0, 20)), f.y0], [f.sx(clamp(+s.tau, 0, 20)), f.y1]], { cls: 'rule rule-gold rule-dash' }),
    numLabel('yl2', f.sx(clamp(+s.tau, 0, 20)), f.y1 - 6, +s.tau, { cls: 'lab-sm lab-mid lab-gold', d: 1, pre: 'τ = ' }),
  );
  const px2 = 502;
  out.push(
    label('lh', px2, 108, `at τ = ${(+s.tau).toFixed(1)}`, { cls: 'lab-sm' }),
    ...LINES.filter(L => phase >= L.at).map((L, i) => [
      label('ll' + i, px2, 138 + i * 46, L.lab, { cls: 'lab-sm', set: { fill: L.c } }),
      numLabel('lv' + i, px2, 158 + i * 46, now[L.k], { cls: 'lab-big', d: 3, set: { fill: L.c } }),
    ]).flat(),
    phase >= 3 ? [
      label('n1', px2, 300, 'partial pooling hugs the', { cls: 'lab-sm lab-green' }),
      label('n2', px2, 314, 'lower of the other two', { cls: 'lab-sm lab-green' }),
      label('n3', px2, 328, 'at every setting.', { cls: 'lab-sm lab-green' }),
      label('n4', px2, 356, 'sixty simulated worlds', { cls: 'lab-sm' }),
      label('n5', px2, 370, 'per point.', { cls: 'lab-sm' }),
    ] : null,
  );
  return out.filter(Boolean);
}

function slopes(s) {
  const f = frame({ w: 720, h: 540, l: 68, r: 216, t: 54, b: 78 });
  const all = SLOPE.groups.flat();
  f.setX(0, 8.6);
  f.setY(Math.min(...all.map(p => p[1])) - 8, Math.max(...all.map(p => p[1])) + 8);
  const on = !!s.slopes;
  const F = SLOPE.fit;

  const out = [
    { key: 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x1, y2: f.y0 } },
    { key: 'ay', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x0, y2: f.y1 } },
    label('xl', (f.x0 + f.x1) / 2, f.y0 + 30, 'hours studied', { cls: 'ax-label' }),
    { key: 'yl', tag: 'text', cls: 'ax-label', attrs: { x: 0, y: 0 }, set: { transform: `translate(20 ${(f.y0 + f.y1) / 2}) rotate(-90)` }, text: 'score' },
    ...SLOPE.groups.flatMap((g, j) => g.map((p, i) => ({
      key: `sp-${j}-${i}`, tag: 'circle', cls: 'pt',
      attrs: { cx: f.sx(p[0]), cy: f.sy(p[1]), r: 3 },
      set: { fill: col(j), stroke: 'none' }, opacity: 0.5,
    }))),
  ];

  SLOPE.groups.forEach((g, j) => {
    const fit = F.slopes[j];
    const b1 = on ? fit.shrunk : (isFinite(fit.b1) ? fit.b1 : F.grand);
    const mx = st.mean(g.map(p => p[0])), my = st.mean(g.map(p => p[1]));
    out.push(path(`ln-${j}`, [
      [f.sx(0), f.sy(my + b1 * (0 - mx))],
      [f.sx(8.6), f.sy(my + b1 * (8.6 - mx))],
    ], {
      cls: 'curve', set: { stroke: col(j), 'stroke-width': 2.2 }, dur: 520,
      tip: `${NAMES[j]} (n=${g.length})<br>own slope ${isFinite(fit.b1) ? fit.b1.toFixed(2) : '—'}<br>λ = ${fit.lambda.toFixed(2)}<br>shrunk to <b>${fit.shrunk.toFixed(2)}</b>`,
    }));
  });

  const px = 508;
  out.push(
    label('h', px, 104, on ? 'slopes, shrunk' : 'slopes, on their own', { cls: 'lab-big lab-' + (on ? 'green' : 'warm') }),
    ...F.slopes.map((fit, j) => [
      label('sn' + j, px, 136 + j * 34, NAMES[j] + ` (${SLOPE.groups[j].length})`, { cls: 'lab-sm', set: { fill: col(j) } }),
      numLabel('sv' + j, px + 152, 136 + j * 34, on ? fit.shrunk : (isFinite(fit.b1) ? fit.b1 : F.grand), {
        cls: 'lab lab-end', d: 2, dur: 520, set: { fill: col(j) },
      }),
    ]).flat(),
    numLabel('gv', px, 424, F.grand, { cls: 'lab lab-gold', d: 2, pre: 'average slope ' }),
    label('gl', px, 448, on ? 'the fan has closed unevenly' : 'the fan is far too wide', { cls: 'lab-sm lab-' + (on ? 'green' : 'warm') }),
  );
  return out;
}
