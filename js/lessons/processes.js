/* ─────────────────────────────────────────────────────────────────────────────
   processes.js — words for how a thing behaves.

   Some vocabulary names a quantity: a mean, a variance, a correlation. Other
   vocabulary names a *behaviour* — what happens when you push the thing, or
   wait, or try to get out. Illiquidity is not a number an asset has; it is a
   description of what the price does when you sell. Volatility is a property
   of a path, not of an endpoint. Ergodicity is about whether the average over
   people tells you anything about the fate of a person.

   None of these can be defined statically without losing what they mean, so
   this lesson defines each one by running it.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, points, label, numLabel, path, rect, fnPath, arrowDefs } from '../core/plot.js';
import { knobCards } from '../core/knobs.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sqrt, sub, sup, prodOver, paren, eq, minus, plus, times, op } from '../core/fx.js';

/* ── shared randomness, drawn once so a slider scales a fixed wobble ──────── */

const T = 120;
const Z = (() => {
  const r = st.rng(4242);
  return range(24).map(() => range(T + 2).map(() => st.randNorm(r, 0, 1)));
})();

/** a price path: same shocks every time, only their size changes */
const walk = (s, seed = 0, vol = +s.vol, drift = 0.0006, n = T) => {
  const z = Z[seed % Z.length];
  const out = [100];
  for (let i = 1; i <= n; i++) out.push(out[i - 1] * Math.exp(drift + vol * z[i]));
  return out;
};

/** an AR(1) path — the same shocks, remembered to a degree you choose */
function ar1(s, seed = 0, phi = +s.phi, n = T) {
  const z = Z[seed % Z.length];
  const out = [100];
  let e = 0;
  for (let i = 1; i <= n; i++) {
    e = phi * e + Math.sqrt(1 - phi * phi) * z[i] * 0.02;
    out.push(out[i - 1] * Math.exp(e + 0.0006));
  }
  return out;
}

/** biggest peak-to-trough fall so far, and where it happened */
function drawdown(p) {
  let peak = p[0], worst = 0, at = [0, 0];
  p.forEach((v, i) => {
    if (v > peak) peak = v;
    const dd = v / peak - 1;
    if (dd < worst) { worst = dd; at = [p.lastIndexOf(peak, i), i]; }
  });
  return { worst, from: at[0], to: at[1] };
}

/* ── the ergodicity game ──────────────────────────────────────────────────── */

const UP = 1.5, DOWN = 0.6;             /* +50% or −40% on a fair coin */
const NPLAY = 200, ROUNDS = 100;
const FLIPS = (() => {
  const r = st.rng(90210);
  return range(NPLAY).map(() => range(ROUNDS).map(() => (r() < 0.5 ? DOWN : UP)));
})();
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const supNum = n => String(Math.abs(n)).split('').map(d => SUP[+d]).join('');

/* the walk-through beats fix how many rounds and players are shown; the last
   beat hands over to the sliders. Readouts read the same function. */
const ERGO_BEAT = [[1, 20], [20, 60], [NPLAY, ROUNDS], [NPLAY, ROUNDS], [NPLAY, ROUNDS]];
const ergoAt = (s, ctx) => (ctx && ctx.beat != null && ctx.beat < ERGO_BEAT.length
  ? ERGO_BEAT[ctx.beat] : [clamp(+s.players, 1, NPLAY), clamp(+s.round, 1, ROUNDS)]);

const GAME = (() => {
  const paths = FLIPS.map(f => {
    const p = [1];
    f.forEach(m => p.push(p[p.length - 1] * m));
    return p;
  });
  const meanAt = t2 => st.mean(paths.map(p => p[t2]));
  const medAt = t2 => st.median(paths.map(p => p[t2]));
  return { paths, meanAt, medAt };
})();

/* ── the order book ───────────────────────────────────────────────────────── */

const MID = 100, TICK = 0.05, LEVELS = 14;

/** bids, best first. `depth` scales every level, so it is thinness itself */
const bids = depth => range(LEVELS).map(i => ({
  price: MID - TICK / 2 - i * TICK,
  qty: Math.round(depth * (1 + i * 0.32)),
}));

/** walk the book: what you actually get for selling `size` */
function fill(depth, size) {
  const b = bids(depth);
  let left = size, cash = 0, taken = [];
  for (const lvl of b) {
    const q = Math.min(left, lvl.qty);
    if (q <= 0) break;
    cash += q * lvl.price;
    taken.push(q);
    left -= q;
  }
  const done = size - left;
  return {
    taken, done, unfilled: left,
    avg: done > 0 ? cash / done : MID,
    last: taken.length ? b[taken.length - 1].price : MID,
    slippage: done > 0 ? MID - cash / done : 0,
  };
}

/* Steps 6 and 7 walk through fixed sizes and depths before handing over to the
   sliders. Scene and readouts both resolve the state through these, so the
   panel always describes the book on screen. */
const BOOK6 = [null, { size: 100 }, { size: 1500 }, { size: 5000 }, null];
const BOOK7 = [{ depth: 380, size: 2000 }, { depth: 40, size: 2000 }, null, null];
const withBeat = (table) => (s, ctx) => ({
  ...s, ...(ctx && ctx.beat != null && table[ctx.beat] ? table[ctx.beat] : null),
});
const b6 = withBeat(BOOK6);
const b7 = withBeat(BOOK7);
const bv = withBeat([{ vol: 0.004 }, { vol: 0.012 }, { vol: 0.035 }, null]);
const bp = withBeat([{ phi: 0 }, { phi: 0.8 }, { phi: -0.8 }, null, null]);

export default {
  meta: {
    id: 'processes', title: 'words for how things behave', short: 'process terms',
    kicker: 'VOCABULARY THAT ONLY MEANS SOMETHING IN MOTION', status: 'live',
    deck: 'Some words name a quantity. Others name a behaviour — what a thing does when you push it, or wait, or try to get out. Illiquidity is not a number an asset has; it is a description of what the price does when you sell. Every term here is defined by running it rather than by stating it.',
    dataNote: 'Simulated paths and a simulated order book, both driven by a fixed set of shocks so that moving a dial rescales the same wobble rather than drawing a new one. What you are watching respond is the parameter, not the randomness.',
    deps: ['clt', 'correlation'], unlocks: [],
    next: 'decisiontheory', nextLabel: 'decision theory',
    outro: 'a number describes a state. these words describe what happens next, and you cannot get at them by looking at a column.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { vol: 0.012, seed: 0, n: T, size: 900, depth: 160, phi: 0, players: 60, round: 100 },

  steps: [

    /* ── 1 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'a number that moves',
      prose: `<p>One quantity, changing over time. A price, a queue length, a body temperature — it does not matter which.</p>
        <p>Everything in this lesson is a word for a <em>way this can move</em>. None of them can be read off a single snapshot, which is why they get skipped in courses built around columns of numbers.</p>`,
      controls: [{ type: 'slider', key: 'n', label: 'steps elapsed', min: 2, max: T, step: 1, fast: true }],
      readouts: [
        { key: 'now', label: 'value now', tone: 'cyan', get: s => walk(s)[clamp(+s.n, 0, T)], d: 2 },
        { key: 'start', label: 'where it started', tone: 'muted', get: () => 100, d: 2 },
      ],
      beats: [
        { label: 'one value', hold: 1100, note: 'A number. It is 100.', scene: s => line(s, 1) },
        { label: 'and the next', hold: 1100, note: 'A step later. Slightly different.', scene: s => line(s, 6) },
        { label: 'let it run', hold: 1500, note: 'A hundred and twenty steps. Now there is something to describe.', scene: s => line(s, T) },
        { label: 'your turn', note: 'Drag <b>steps elapsed</b>. Nothing here is random any more — the shocks were drawn once and never change.', scene: s => line(s, +s.n) },
      ],
    },

    /* ── 2 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'volatility is a property of the ride, not the destination',
      prose: `<p>Turn the <strong>volatility</strong> dial. The shocks are the same ones — the same coin flips, in the same order — only scaled.</p>
        <p>Notice what does and does not change. The general direction is unmoved, because the drift is unmoved. What changes is how far the path wanders from it, and that is all volatility is: the typical size of a step.</p>
        <p>Two paths can end in exactly the same place having had completely different years. The endpoint does not carry that information, and no summary of endpoints ever will.</p>`,
      formula: formula(
        t('σ', { tone: 'warm' }) + eq + t('sd of the step-to-step changes', { tone: 'muted', cls: 'fx-tiny' }) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('not', { tone: 'muted' }) + op('&nbsp;') +
        t('sd of the level', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'a rate of wandering, quoted per unit of time' }),
      controls: [
        { type: 'slider', key: 'vol', label: 'volatility per step', min: 0.001, max: 0.045, step: 0.001, fast: true, fmt: v => (+v * 100).toFixed(1) + '%' },
      ],
      readouts: [
        { key: 'v', label: 'σ per step', tone: 'warm', get: (s, c) => +bv(s, c).vol * 100, d: 2, suf: '%' },
        { key: 'ann', label: 'over 120 steps', tone: 'gold', get: (s, c) => +bv(s, c).vol * Math.sqrt(T) * 100, d: 1, suf: '%', wide: true, explain: 'Volatility grows with the square root of time, because independent shocks add in variance, not in sd. The same √n from the central limit theorem.' },
        { key: 'end', label: 'where it ends', tone: 'cyan', get: (s, c) => walk(bv(s, c))[T], d: 2 },
      ],
      dep: { note: 'σ growing as √time is the same √n behind the', lesson: 'clt', label: 'standard error' },
      beats: [
        { label: 'calm', hold: 1500, note: 'σ = 0.4% per step. Barely a wobble.', scene: (s, c) => line(bv(s, c), T, true) },
        { label: 'ordinary', hold: 1500, note: 'σ = 1.2%. The same shocks, three times the size.', scene: (s, c) => line(bv(s, c), T, true) },
        { label: 'violent', hold: 1600, note: 'σ = 3.5%. Same coin flips. Same order. Same drift.', scene: (s, c) => line(bv(s, c), T, true) },
        { label: 'your turn', note: 'Drag it slowly. The shape never changes — it only gets taller.', scene: (s, c) => line(bv(s, c), T, true) },
      ],
    },

    /* ── 3 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'drawdown: how bad it got on the way',
      prose: `<p>Here is a word that cannot be computed from a distribution at all. <strong>Drawdown</strong> is the fall from a peak to the trough that followed it, and the maximum drawdown is the worst one on the path.</p>
        <p>It depends on the <em>order</em> the returns arrived in. Shuffle the same returns and every summary statistic — mean, variance, skewness, the whole lot — is unchanged, while the maximum drawdown moves a great deal.</p>
        <p>That is what makes it a process word. It is a fact about the sequence, not about the set.</p>`,
      controls: [
        { type: 'slider', key: 'vol', label: 'volatility per step', min: 0.001, max: 0.045, step: 0.001, fast: true, fmt: v => (+v * 100).toFixed(1) + '%' },
        { type: 'slider', key: 'seed', label: 'a different run', min: 0, max: 11, step: 1, fast: true },
      ],
      readouts: [
        { key: 'dd', label: 'max drawdown', tone: 'warm', get: s => drawdown(walk(s, +s.seed)).worst * 100, d: 1, suf: '%', wide: true },
        { key: 'end', label: 'ended at', tone: 'cyan', get: s => walk(s, +s.seed)[T], d: 2 },
        { key: 'v', label: 'σ per step', tone: 'gold', get: s => +s.vol * 100, d: 2, suf: '%' },
      ],
      beats: [
        { label: 'the path', hold: 1200, note: 'One run.', scene: s => dd(s, 1) },
        { label: 'the running peak', hold: 1500, note: 'The highest value seen so far. It only ever goes up, in steps.', scene: s => dd(s, 2) },
        { label: 'the gap below it', hold: 1600, note: 'How far below the peak the path currently sits. Zero at every new high.', scene: s => dd(s, 3) },
        { label: 'the worst one', hold: 1700, note: 'The deepest of those gaps. That is the number people mean by "drawdown", and it is the one that decides whether you were still holding at the bottom.', scene: s => dd(s, 4) },
        { label: 'a different run', note: 'Step through the runs at the same volatility. Same σ, wildly different worst-case.', scene: s => dd(s, 4) },
      ],
    },

    /* ── 4 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'compounding: the average return is not the return you get',
      prose: `<p>Gain 50% and then lose 40%. The two returns average to +5%. You have 90% of what you started with.</p>
        <p>The arithmetic mean of returns describes what you would get if you reset to the same stake every round. Compounding does not reset — each round multiplies what the last one left — and multiplication is governed by the <strong>geometric</strong> mean, which is always smaller when the returns vary.</p>
        <p>The gap between them is called <strong>volatility drag</strong>, and it is about σ²⁄2. It is not a fee or an inefficiency. It is what multiplying does.</p>`,
      formula: formula(
        t('arithmetic', { tone: 'gold' }) + op(':&nbsp;') + frac('r₁ + r₂', '2') +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') +
        t('geometric', { tone: 'green' }) + op(':&nbsp;') + sqrt(paren('1+r₁') + paren('1+r₂')) + minus + '1' + '<br>' +
        t('the gap ≈ σ²⁄2, and it is entirely mechanical', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'nothing was lost to costs. this is what multiplication does.' }),
      beats: [
        { label: '+50%', hold: 1300, note: 'One hundred becomes one hundred and fifty.', scene: s => drag(s, 1) },
        { label: 'then −40%', hold: 1500, note: 'One hundred and fifty becomes ninety. You are down, on an average return of +5%.', scene: s => drag(s, 2) },
        { label: 'the two means', hold: 1700, note: 'Arithmetic says +5% per round. Geometric says −5.1%. Only one of them is a claim about your money.', scene: s => drag(s, 3) },
        { label: 'over many rounds', note: 'Repeat the pair. The arithmetic mean stays at +5% forever while the actual balance falls by half every seven rounds.', scene: s => drag(s, 4) },
      ],
    },

    /* ── 5 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'ergodicity: the average of everyone is not the fate of anyone',
      prose: `<p>Now the version of that with two hundred people in it, and it is the most important idea on this page.</p>
        <p>Everyone plays the same game: a fair coin, +50% on heads, −40% on tails. Expected value per round is <strong>+5%</strong>. Any expected-value calculation says play, and play forever.</p>
        <p>Watch what happens. The <strong>average</strong> across all two hundred players does grow at 5% a round, exactly as advertised. The <strong>median</strong> player loses 5% a round and is ruined. Both statements are true at once, because the average is being carried by a handful of players who got lucky early and never gave it back.</p>
        <p>A process where the time average of one path equals the ensemble average over many is called <strong>ergodic</strong>. This one is not, and neither is most of life. Expected value answers the question "what happens on average across parallel worlds", which is not the question anyone living in one world was asking.</p>`,
      formula: formula(
        t('ensemble average', { tone: 'gold' }) + op(':&nbsp;') + '1.05' + sup('', 'n') + op('&nbsp;→&nbsp;∞') + '<br>' +
        t('what one player gets', { tone: 'warm' }) + op(':&nbsp;') + sqrt('1.5 × 0.6') + sup('', 'n') + eq + '0.949' + sup('', 'n') + op('&nbsp;→&nbsp;0'),
        { caption: 'both are correct. they are answers to different questions.' }),
      dep: { note: 'expected value is the tool this breaks — see', lesson: 'decisiontheory', label: 'decision theory' },
      controls: [
        { type: 'slider', key: 'round', label: 'rounds played', min: 1, max: ROUNDS, step: 1, fast: true },
        { type: 'slider', key: 'players', label: 'players shown', min: 5, max: NPLAY, step: 5, fast: true },
      ],
      readouts: [
        { key: 'm', label: 'average player', tone: 'gold', get: (s, c) => GAME.meanAt(ergoAt(s, c)[1]), d: 2, suf: '×', wide: true },
        { key: 'md', label: 'median player', tone: 'warm', get: (s, c) => GAME.medAt(ergoAt(s, c)[1]), d: 4, suf: '×', wide: true },
        { key: 'ruin', label: 'players under 1×', tone: 'cold', get: (s, c) => GAME.paths.filter(p => p[ergoAt(s, c)[1]] < 1).length, d: 0, suf: ' of 200', wide: true },
      ],
      beats: [
        { label: 'one player', hold: 1500, note: 'One person, playing a game with a +5% expected return. Note the log scale — without it nothing below is visible.', scene: (s, c) => ergo(s, c, false, false) },
        { label: 'twenty', hold: 1600, note: 'Twenty people, same game, different coins.', scene: (s, c) => ergo(s, c, false, false) },
        { label: 'two hundred', hold: 1700, note: 'The whole ensemble. Most of them are heading down.', scene: (s, c) => ergo(s, c, false, false) },
        { label: 'the average', hold: 1800, note: 'And yet the mean across all of them climbs at exactly the advertised 5% a round. It is being carried by two or three players near the top.', scene: (s, c) => ergo(s, c, true, false) },
        { label: 'the median', hold: 1900, note: 'The player in the middle. Down by more than 99%. Both lines are computed from the same two hundred paths.', scene: (s, c) => ergo(s, c, true, true) },
        { label: 'your turn', note: 'Drag <b>rounds played</b> from the beginning and watch the two lines separate.', scene: (s, c) => ergo(s, c, true, true) },
      ],
      aside: `<p><strong>Where this bites.</strong> Any decision you will make repeatedly with the same pot of money — investing, betting, taking on risk in a business — is a time average, not an ensemble average. Positive expected value is not sufficient. What matters is the growth rate of the median path, and a strategy can have an excellent expected value and a median that goes to zero.</p>`,
    },

    /* ── 6 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'liquidity: the price depends on how much you want',
      prose: `<p>A different kind of process word. Ask what something is worth and you get a number. Try to <em>sell</em> and you find out that the number was for one share.</p>
        <p>Underneath every quoted price is a queue of buyers: a stack of bids, each willing to take a certain quantity at a certain price. Sell a little and you hit the top of the stack and get roughly the quoted price. Sell a lot and you eat through the top, and the second level, and the third, and your <em>average</em> price is worse than any quote you ever saw.</p>
        <p>Drag <strong>how much you sell</strong> and watch the fill walk down the book.</p>`,
      formula: formula(
        t('average fill', { tone: 'warm' }) + eq + frac('Σ price × quantity taken', 'total quantity') + '<br>' +
        t('slippage', { tone: 'gold' }) + eq + t('mid price', { tone: 'muted' }) + minus + t('average fill', { tone: 'warm' }),
        { caption: 'the quote is a price for the first share only' }),
      controls: [
        { type: 'slider', key: 'size', label: 'how much you sell', min: 0, max: 6000, step: 50, fast: true },
        { type: 'slider', key: 'depth', label: 'depth of the book', min: 20, max: 400, step: 10, fast: true },
      ],
      readouts: [
        { key: 'q', label: 'quoted price', tone: 'muted', get: () => MID, d: 2 },
        { key: 'sz', label: 'you are selling', tone: 'cyan', get: (s, c) => +b6(s, c).size, d: 0 },
        { key: 'a', label: 'you actually got', tone: 'warm', get: (s, c) => fill(+b6(s, c).depth, +b6(s, c).size).avg, d: 3, wide: true },
        { key: 'sl', label: 'slippage', tone: 'gold', get: (s, c) => fill(+b6(s, c).depth, +b6(s, c).size).slippage, d: 3, wide: true },
        { key: 'pc', label: 'as a share of the price', tone: 'cold', get: (s, c) => (fill(+b6(s, c).depth, +b6(s, c).size).slippage / MID) * 100, d: 3, suf: '%', wide: true },
      ],
      beats: [
        { label: 'the book', hold: 1400, note: 'Every bar is one price level: how much someone will buy, and at what price. This is what "the price is 100" is hiding.', scene: (s, c) => book(b6(s, c), 0) },
        { label: 'sell a little', hold: 1500, note: 'One hundred shares. You take the top of the book and get essentially the quoted price.', scene: (s, c) => book(b6(s, c), 1) },
        { label: 'sell more', hold: 1600, note: 'Fifteen hundred. You have eaten four levels and your average is already below every quote you saw.', scene: (s, c) => book(b6(s, c), 1) },
        { label: 'sell a lot', hold: 1800, note: 'Five thousand. You have walked the book down and paid for the privilege. Nothing went wrong here — this is what the market always was.', scene: (s, c) => book(b6(s, c), 1) },
        { label: 'your turn', note: 'Drag <b>how much you sell</b> and watch the average fill fall away from the quote.', scene: (s, c) => book(b6(s, c), 1) },
      ],
    },

    /* ── 7 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'illiquidity is not a number the asset has',
      prose: `<p>Now drag the second dial, the <strong>depth of the book</strong>, and leave the sell size alone.</p>
        <p>Nothing about what you are selling changed. The same quantity, the same quoted price, the same everything. All that changed is how many people are standing there ready to buy — and your realised price moves by several percent.</p>
        <p>So illiquidity is not a property of the asset. It is a property of the <em>relationship</em> between the size you need and the depth that happens to be there, and the depth is a thing that varies.</p>
        <p>Which produces the part that hurts. Books are deepest when nobody needs them and thinnest exactly when everyone wants out at once. Liquidity measured in calm conditions is not the liquidity you will get.</p>`,
      controls: [
        { type: 'slider', key: 'depth', label: 'depth of the book', min: 20, max: 400, step: 10, fast: true },
        { type: 'slider', key: 'size', label: 'how much you sell', min: 0, max: 6000, step: 50, fast: true },
      ],
      readouts: [
        { key: 'd', label: 'depth at the top', tone: 'cyan', get: (s, c) => +b7(s, c).depth, d: 0, suf: ' shares' },
        { key: 'sl', label: 'slippage', tone: 'gold', get: (s, c) => fill(+b7(s, c).depth, +b7(s, c).size).slippage, d: 3, wide: true },
        { key: 'pc', label: 'cost of getting out', tone: 'warm', get: (s, c) => (fill(+b7(s, c).depth, +b7(s, c).size).slippage / MID) * 100, d: 3, suf: '%', wide: true },
        { key: 'un', label: 'you could not sell', tone: 'cold', get: (s, c) => fill(+b7(s, c).depth, +b7(s, c).size).unfilled, d: 0, suf: ' shares', wide: true },
      ],
      beats: [
        { label: 'a deep book', hold: 1600, note: 'Plenty of buyers at every level. Two thousand shares barely registers.', scene: (s, c) => book(b7(s, c), 2) },
        { label: 'a thin one', hold: 1800, note: 'The same two thousand shares, the same asset, the same quoted price. Now it costs you real money — and some of it does not sell at all.', scene: (s, c) => book(b7(s, c), 2) },
        { label: 'the cost curve', hold: 1800, note: 'Slippage against size, at three depths. Not a line — it bends upward, because each extra share is filled at a worse level than the last.', scene: (s, c) => impact(b7(s, c)) },
        { label: 'the part that hurts', note: 'Books thin out precisely when everybody wants to sell. Liquidity measured on a calm day is not the liquidity available on the day you need it.', scene: (s, c) => impact(b7(s, c), true) },
      ],
      aside: `<p><strong>The same shape, outside markets.</strong> Anything with a queue behaves like this. Hospital beds, server capacity, a road at rush hour: usage is fine until the queue is nearly full, and then each additional unit of demand costs far more than the last. The word for it changes — congestion, saturation, capacity — but the curve is the one above.</p>`,
    },

    /* ── 8 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'memory: momentum and mean reversion',
      prose: `<p>Does a step know what the last step did? That one parameter changes the character of a process completely, and both extremes look nothing like the middle.</p>
        <p><strong>Positive</strong> memory is momentum: an up move makes the next up move more likely, so the path trends and wanders far from where it started. <strong>Negative</strong> memory is mean reversion: an up move makes a down move more likely, so the path is jagged and keeps coming back.</p>
        <p>Both have the same volatility per step. Drag the dial from one end to the other and watch the character change while the step size does not.</p>`,
      formula: formula(
        t('e', { tone: 'warm' }) + sub('', 't') + eq + t('φ', { tone: 'gold' }) + t('e', { tone: 'warm' }) + sub('', 't−1') + plus + t('shock', { tone: 'cyan' }) + '<br>' +
        t('φ > 0 trends', { tone: 'muted', cls: 'fx-tiny' }) + op('&nbsp;·&nbsp;') +
        t('φ = 0 forgets', { tone: 'muted', cls: 'fx-tiny' }) + op('&nbsp;·&nbsp;') +
        t('φ < 0 reverts', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'one number, and it decides whether trends are real' }),
      controls: [
        { type: 'slider', key: 'phi', label: 'φ  memory', min: -0.85, max: 0.85, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'slider', key: 'seed', label: 'a different run', min: 0, max: 11, step: 1, fast: true },
      ],
      readouts: [
        { key: 'p', label: 'φ', tone: 'gold', get: (s, c) => +bp(s, c).phi, d: 2 },
        { key: 'c', label: 'character', get: (s, c) => { const v = +bp(s, c).phi; return v > 0.25 ? 'trending' : v < -0.25 ? 'mean-reverting' : 'no memory'; }, wide: true },
        { key: 'r', label: 'how far it wandered', tone: 'cyan', get: (s, c) => Math.max(...ar1(s, +s.seed, +bp(s, c).phi).map(v => Math.abs(v - 100))), d: 1, wide: true },
        { key: 'sd', label: 'σ of the steps', tone: 'warm', get: (s, c) => { const p = ar1(s, +s.seed, +bp(s, c).phi); return st.sd(range(T).map(i => Math.log(p[i + 1] / p[i]))) * 100; }, d: 2, suf: '%', wide: true },
      ],
      beats: [
        { label: 'no memory', hold: 1500, note: 'φ = 0. Each step forgets the last. This is the path from step 1.', scene: (s, c) => mem(s, +bp(s, c).phi) },
        { label: 'momentum', hold: 1700, note: 'φ = +0.8. The same shocks, remembered. Long smooth runs, and it strays a very long way from where it began.', scene: (s, c) => mem(s, +bp(s, c).phi) },
        { label: 'mean reversion', hold: 1700, note: 'φ = −0.8. The same shocks, contradicted. Jagged, and it never goes anywhere.', scene: (s, c) => mem(s, +bp(s, c).phi) },
        { label: 'all three', hold: 1800, note: 'Together, from the same shocks. Any of these can be produced from the identical underlying randomness.', scene: (s, c) => mem(s, +bp(s, c).phi, true) },
        { label: 'why it matters', note: 'A momentum path <em>looks</em> like it is being driven by something. It is not — it is the same coin as the flat one, with a memory bolted on. Trends you can see are not evidence of a cause.', scene: (s, c) => mem(s, +bp(s, c).phi, true) },
      ],
    },

    /* ── 9 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'stationarity: whether the rules stayed the same',
      prose: `<p>Every statistic you have ever computed on a time series assumed something you probably did not check: that the process generating it did not change while you were watching.</p>
        <p>That assumption has a name — <strong>stationarity</strong> — and when it fails, the numbers do not become noisy. They become answers about a world that no longer exists.</p>
        <p>Here the volatility triples half way through. The overall standard deviation is a perfectly good number and it describes neither half.</p>`,
      readouts: [
        { key: 'a', label: 'σ, first half', tone: 'cold', get: () => 1.0, d: 1, suf: '%', wide: true },
        { key: 'b', label: 'σ, second half', tone: 'warm', get: () => 3.5, d: 1, suf: '%', wide: true },
        { key: 'c', label: 'σ, whole sample', tone: 'gold', get: () => 2.6, d: 1, suf: '%', wide: true, explain: 'A number that is correct, computable, and describes no period of this series.' },
      ],
      beats: [
        { label: 'the first half', hold: 1500, note: 'Calm. σ of about 1% per step. Everything you would compute here is stable and correct.', scene: s => regime(s, 1) },
        { label: 'the rules change', hold: 1700, note: 'Half way through, the volatility triples. Nothing announced it.', scene: s => regime(s, 2) },
        { label: 'the whole-sample number', hold: 1800, note: 'One σ for the lot: 2.6%. Too high to describe the calm half, too low to describe the wild one. Correct arithmetic, and useless.', scene: s => regime(s, 3) },
        { label: 'what to do instead', note: 'Look at your statistic in windows before you quote it for the whole series. If it moves, a single number for the whole thing is a summary of two different worlds.', scene: s => regime(s, 4) },
      ],
    },

    /* ── 10 ────────────────────────────────────────────────────────────────── */
    {
      title: 'the vocabulary, collected',
      prose: `<p>Every word here answers the question "what does this thing do when something happens to it", and none of them can be read off a snapshot.</p>
        <p>Which is the point worth carrying out. If a term describes a behaviour, the only honest way to define it is to run the thing and watch — and the only honest way to measure it is to record what happened when you actually pushed.</p>`,
      beats: [
        {
          label: 'the panel', hold: 2000,
          scene: () => knobCards([
            { name: 'volatility', value: 'per step', tone: 'warm',
              does: 'The typical size of a change. A property of the ride; two identical endpoints can have had completely different years.',
              low: 'the path barely moves', high: 'the path is unreadable, and the endpoint tells you nothing' },
            { name: 'drawdown', value: 'peak to trough', tone: 'gold',
              does: 'The worst fall from a high point. Depends on the order of the returns, so no distribution of returns can produce it.',
              low: 'you were never far underwater', high: 'you were, and whether you were still there is a separate question' },
            { name: 'liquidity', value: 'depth ÷ size', tone: 'cyan',
              does: 'How much you can transact before your own trading moves the price against you. Not a property of the asset.',
              low: 'getting out costs several percent, and part of it does not sell', high: 'the quote is roughly the price you get' },
            { name: 'memory  φ', value: 'trend vs revert', tone: 'purple',
              does: 'Whether a step knows what the last one did. Decides whether visible trends mean anything.',
              low: 'jagged, goes nowhere', high: 'long smooth runs from nothing but a coin' },
          ], { y0: 56, rowH: 112 }),
        },
        {
          label: 'and the one that is not a dial',
          note: 'Ergodicity is not a setting. It is a question about whether the average over people has anything at all to do with the fate of a person.',
          scene: () => [
            label('h', 360, 96, 'ergodicity', { cls: 'lab-big lab-mid lab-gold' }),
            label('h2', 360, 122, 'the question behind every expected value you have ever computed', { cls: 'lab-sm lab-mid' }),
            [
              ['ergodic', 'the time average of one path equals the average across many.',
                'expected value answers your question. dice, coin flips, one bet at a time', 'green'],
              ['non-ergodic', 'they are different, and often opposite.',
                'anything you repeat with the same pot: investing, business risk, your career', 'warm'],
            ].map(([a, b, c, tone], i) => [
              rect('e' + i, 66, 168 + i * 118, 588, 96, { cls: 'cell', delay: i * 200 }),
              label('ea' + i, 88, 200 + i * 118, a, { cls: 'lab-big lab-' + tone, delay: i * 200 }),
              label('eb' + i, 88, 224 + i * 118, b, { cls: 'lab-sm', delay: i * 200 }),
              label('ec' + i, 88, 244 + i * 118, c, { cls: 'lab-sm', delay: i * 200 }),
            ]),
            label('f', 360, 434, 'a term that names a behaviour cannot be defined by stating it.', { cls: 'lab lab-mid lab-green' }),
            label('f2', 360, 456, 'you have to run the thing.', { cls: 'lab-big lab-mid' }),
          ],
        },
      ],
    },
  ],
};

/* ── scenes ───────────────────────────────────────────────────────────────── */

function PF(pathsMax, { r = 40, t = 54, b = 70 } = {}) {
  const f = frame({ w: 720, h: 540, l: 68, r, t, b });
  f.setX(0, T);
  const lo = Math.min(...pathsMax), hi = Math.max(...pathsMax);
  const pad = Math.max(1.5, (hi - lo) * 0.14);
  f.setY(lo - pad, hi + pad);
  return f;
}

function timeAxis(f, { yFmt = v => v.toFixed(0), yN = 5 } = {}) {
  const ys = range(yN).map(i => f.dy[0] + ((f.dy[1] - f.dy[0]) * i) / (yN - 1));
  return [
    { key: 'tx', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x1, y2: f.y0 } },
    { key: 'ty', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x0, y2: f.y1 } },
    ...ys.map((v, i) => label('tyt' + i, f.x0 - 9, f.sy(v) + 4, yFmt(v), { cls: 'ax-tick ax-tick-y' })),
    label('txl', (f.x0 + f.x1) / 2, f.y0 + 30, 'time', { cls: 'ax-label' }),
  ];
}

function line(s, n, fixedScale) {
  const full = walk(s);
  const p = full.slice(0, clamp(n, 2, T) + 1);
  const f = PF(fixedScale ? walk({ ...s, vol: 0.045 }) : full);
  return [
    ...timeAxis(f),
    path('base', [[f.x0, f.sy(100)], [f.x1, f.sy(100)]], { cls: 'rule rule-faint rule-dash' }),
    path('p', p.map((v, i) => [f.sx(i), f.sy(v)]), { cls: 'curve curve-cyan' }),
    { key: 'now', tag: 'circle', cls: 'pt pt-cyan', attrs: { cx: f.sx(p.length - 1), cy: f.sy(p[p.length - 1]), r: 7 } },
    numLabel('nowv', f.sx(p.length - 1) - 12, f.sy(p[p.length - 1]) - 14, p[p.length - 1], { cls: 'lab lab-end lab-cyan', d: 2 }),
    label('vl', f.x0 + 8, f.y1 + 4, `σ = ${(+s.vol * 100).toFixed(1)}% per step`, { cls: 'lab-sm lab-warm' }),
  ];
}

function dd(s, phase) {
  const p = walk(s, +s.seed);
  const f = PF(p);
  const peaks = [];
  let pk = p[0];
  p.forEach(v => { pk = Math.max(pk, v); peaks.push(pk); });
  const D = drawdown(p);

  return [
    ...timeAxis(f),
    phase >= 2 ? path('pk', peaks.map((v, i) => [f.sx(i), f.sy(v)]), { cls: 'curve curve-fit curve-dash' }) : null,
    phase >= 3 ? p.map((v, i) => (i % 2 ? null : path('g' + i, [[f.sx(i), f.sy(v)], [f.sx(i), f.sy(peaks[i])]], {
      cls: 'stick', set: { stroke: 'var(--cs-data-warm)', 'stroke-width': 1 }, opacity: 0.4,
    }))) : null,
    path('p', p.map((v, i) => [f.sx(i), f.sy(v)]), { cls: 'curve curve-cyan' }),
    phase >= 4 ? [
      rect('band', f.sx(D.from), f.sy(p[D.from]), Math.max(3, f.sx(D.to) - f.sx(D.from)), f.sy(p[D.to]) - f.sy(p[D.from]), {
        cls: 'sq sq-resid', opacity: 0.4,
      }),
      { key: 'hi', tag: 'circle', cls: 'pt pt-green', attrs: { cx: f.sx(D.from), cy: f.sy(p[D.from]), r: 6 } },
      { key: 'lo', tag: 'circle', cls: 'pt pt-warm', attrs: { cx: f.sx(D.to), cy: f.sy(p[D.to]), r: 6 } },
      numLabel('ddv', (f.sx(D.from) + f.sx(D.to)) / 2, f.sy(p[D.to]) + 22, D.worst * 100, {
        cls: 'lab-big lab-mid lab-warm', d: 1, suf: '%',
      }),
      label('ddl', (f.sx(D.from) + f.sx(D.to)) / 2, f.sy(p[D.to]) + 38, 'maximum drawdown', { cls: 'lab-sm lab-mid' }),
    ] : null,
    phase >= 2 ? label('pkl', f.x1 - 6, f.sy(peaks[T]) - 10, 'running peak', { cls: 'lab-sm lab-end lab-green' }) : null,
  ].filter(Boolean);
}

function drag(s, phase) {
  const seq = phase >= 4 ? range(21).map(i => (i % 2 ? DOWN : UP)) : [UP, DOWN].slice(0, phase);
  const bal = [100];
  seq.forEach(m => bal.push(bal[bal.length - 1] * m));
  const f = frame({ w: 720, h: 540, l: 76, r: 230, t: 66, b: 84 });
  f.setX(0, Math.max(2, bal.length - 1));
  f.setY(0, Math.max(160, ...bal) * 1.05);

  const arith = 0.05, geo = Math.sqrt(UP * DOWN) - 1;
  return [
    ...timeAxis(f),
    path('base', [[f.x0, f.sy(100)], [f.x1, f.sy(100)]], { cls: 'rule rule-faint rule-dash' }),
    path('b', bal.map((v, i) => [f.sx(i), f.sy(v)]), { cls: 'curve curve-cyan' }),
    ...bal.map((v, i) => ({
      key: 'bp' + i, tag: 'circle', cls: 'pt pt-cyan',
      attrs: { cx: f.sx(i), cy: f.sy(v), r: bal.length > 6 ? 3.4 : 7 }, delay: i * 90,
      tip: `round ${i}<br><b>${v.toFixed(2)}</b>`,
    })),
    bal.length <= 4 ? bal.map((v, i) => numLabel('bv' + i, f.sx(i), f.sy(v) - 16, v, { cls: 'lab lab-mid lab-cyan', d: 2, delay: i * 90 })) : null,
    phase >= 2 ? label('m1', f.sx(0.5), f.sy(130) - 22, '+50%', { cls: 'lab-sm lab-mid lab-green' }) : null,
    phase >= 2 ? label('m2', f.sx(1.5), f.sy(130) - 38, '−40%', { cls: 'lab-sm lab-mid lab-warm' }) : null,
    phase >= 3 ? [
      numLabel('a1', 500, 130, arith * 100, { cls: 'lab-big lab-gold', d: 1, pre: 'arithmetic: +', suf: '%' }),
      label('a2', 500, 150, 'per round, on average', { cls: 'lab-sm' }),
      numLabel('g1', 500, 194, geo * 100, { cls: 'lab-big lab-warm', d: 1, pre: 'geometric: ', suf: '%' }),
      label('g2', 500, 214, 'per round, to your money', { cls: 'lab-sm' }),
      numLabel('d1', 500, 262, (arith - geo) * 100, { cls: 'lab lab-cold', d: 1, pre: 'the drag: ', suf: '%' }),
      label('d2', 500, 282, 'nothing was charged.', { cls: 'lab-sm' }),
      label('d3', 500, 296, 'this is what multiplying does.', { cls: 'lab-sm' }),
    ] : null,
    phase >= 4 ? numLabel('end', 500, 344, bal[bal.length - 1], { cls: 'lab-big lab-cyan', d: 2, pre: 'after 20 rounds: ' }) : null,
  ].filter(Boolean);
}

function ergo(s, ctx, showMean, showMed) {
  const [nShow, nRound] = ergoAt(s, ctx);
  const R = clamp(nRound, 1, ROUNDS);
  const N = clamp(nShow, 1, NPLAY);
  const f = frame({ w: 720, h: 540, l: 82, r: 214, t: 58, b: 78 });
  f.setX(0, ROUNDS);
  f.setY(-7, 3);                     /* log10 of wealth */
  const lg = v => Math.log10(Math.max(v, 1e-8));

  const out = [
    { key: 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x1, y2: f.y0 } },
    { key: 'ay', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x0, y2: f.y1 } },
    ...range(6).map(i => {
      const e = -6 + i * 2;
      return label('yt' + i, f.x0 - 9, f.sy(e) + 4,
        e === 0 ? '1×' : `10${e < 0 ? '⁻' : ''}${supNum(e)}`, { cls: 'ax-tick ax-tick-y' });
    }),
    label('xl', (f.x0 + f.x1) / 2, f.y0 + 30, 'rounds played', { cls: 'ax-label' }),
    path('one', [[f.x0, f.sy(0)], [f.x1, f.sy(0)]], { cls: 'rule rule-faint rule-dash' }),
    label('onel', f.x0 + 6, f.sy(0) - 6, 'break even', { cls: 'lab-sm' }),
    ...range(N).map(k => path('pl' + k, GAME.paths[k].slice(0, R + 1).map((v, i) => [f.sx(i), f.sy(lg(v))]), {
      cls: 'curve', set: { stroke: 'var(--cs-muted)', 'stroke-width': 1 }, opacity: N > 40 ? 0.16 : 0.4,
      delay: Math.min(k, 20) * 30,
    })),
  ];

  if (showMean) out.push(
    path('mean', range(R + 1).map(i => [f.sx(i), f.sy(lg(GAME.meanAt(i)))]), { cls: 'curve', set: { stroke: 'var(--cs-data-gold)', 'stroke-width': 3 } }),
    label('meanl', f.sx(R * 0.5), f.sy(lg(GAME.meanAt(Math.round(R * 0.5)))) - 14, 'the average', { cls: 'lab lab-mid lab-gold' }));
  if (showMed) out.push(
    path('med', range(R + 1).map(i => [f.sx(i), f.sy(lg(GAME.medAt(i)))]), { cls: 'curve', set: { stroke: 'var(--cs-data-warm)', 'stroke-width': 3 } }),
    label('medl', f.sx(R * 0.5), f.sy(lg(GAME.medAt(Math.round(R * 0.5)))) + 22, 'the median player', { cls: 'lab lab-mid lab-warm' }));

  const px = 522;
  out.push(
    label('r1', px, 108, `after ${R} rounds`, { cls: 'lab-sm' }),
    numLabel('r2', px, 138, GAME.meanAt(R), { cls: 'lab-big lab-gold', d: 2, pre: 'mean  ', suf: '×' }),
    numLabel('r3', px, 172, GAME.medAt(R), { cls: 'lab-big lab-warm', d: 5, pre: 'median ', suf: '×' }),
    numLabel('r4', px, 214, GAME.paths.filter(p => p[R] < 1).length, { cls: 'lab lab-cold', d: 0, suf: ' of 200 are down' }),
    numLabel('r5', px, 236, GAME.paths.filter(p => p[R] > GAME.meanAt(R)).length, { cls: 'lab lab-cold', d: 0, suf: ' beat the mean' }),
    label('r6', px, 280, 'the mean is carried by', { cls: 'lab-sm lab-gold' }),
    label('r7', px, 294, 'the handful at the top.', { cls: 'lab-sm lab-gold' }),
    label('r8', px, 316, 'it is a true statement', { cls: 'lab-sm' }),
    label('r9', px, 330, 'about nobody in particular.', { cls: 'lab-sm' }),
    label('lg', f.x0 + 6, f.y1 + 2, 'log scale — each gridline is 100×', { cls: 'lab-sm' }),
  );
  return out;
}

function book(s, phase) {
  const depth = +s.depth, size = +s.size;
  const b = bids(depth);
  const R = fill(depth, size);
  const maxQ = Math.max(...b.map(l => l.qty));
  const X0 = 176, W = 300, RH = 26;

  const out = [
    label('h', 360, 74, `the book · ${depth} shares at the top level`, { cls: 'lab lab-mid lab-cyan' }),
  ];
  b.forEach((lvl, i) => {
    const y = 100 + i * RH;
    const w = (W * lvl.qty) / maxQ;
    const took = phase >= 1 ? (R.taken[i] || 0) : 0;
    out.push(
      numLabel('pr' + i, X0 - 10, y + 13, lvl.price, { cls: 'lab-sm lab-end' + (took ? ' lab-warm' : ''), d: 2 }),
      rect('bar' + i, X0, y, w, RH - 6, { cls: 'sq sq-dim', dur: 240 }),
      took ? rect('tk' + i, X0, y, (W * took) / maxQ, RH - 6, { cls: 'sq sq-resid', dur: 240 }) : null,
      label('q' + i, X0 + w + 8, y + 13, String(lvl.qty), { cls: 'lab-sm', dur: 240 }),
    );
  });

  const px = 512;
  out.push(
    label('mh', X0, 100 - 12, 'price', { cls: 'lab-sm lab-mid' }),
    label('mh2', X0 + W + 40, 100 - 12, 'buyers waiting', { cls: 'lab-sm' }),
    numLabel('n1', px, 128, MID, { cls: 'lab lab-muted', d: 2, pre: 'quoted: ' }),
    numLabel('n2', px, 162, R.avg, { cls: 'lab-big lab-warm', d: 3, pre: 'you got: ' }),
    numLabel('n3', px, 196, R.slippage, { cls: 'lab lab-gold', d: 3, pre: 'slippage: ' }),
    numLabel('n4', px, 218, (R.slippage / MID) * 100, { cls: 'lab lab-gold', d: 3, suf: '% of the price' }),
    numLabel('n5', px, 252, R.done, { cls: 'lab lab-cyan', d: 0, pre: 'sold: ', suf: ' shares' }),
    R.unfilled > 0 ? numLabel('n6', px, 274, R.unfilled, { cls: 'lab lab-cold', d: 0, pre: 'left over: ' }) : null,
    phase >= 2 ? [
      label('w1', px, 322, 'the asset did not change.', { cls: 'lab-sm lab-gold' }),
      label('w2', px, 336, 'the size did not change.', { cls: 'lab-sm lab-gold' }),
      label('w3', px, 358, 'only how many people', { cls: 'lab-sm' }),
      label('w4', px, 372, 'happened to be standing', { cls: 'lab-sm' }),
      label('w5', px, 386, 'there ready to buy.', { cls: 'lab-sm' }),
    ] : null,
  );
  return out.filter(Boolean);
}

const DEPTHS = [40, 160, 380];

function impact(s, warn) {
  const f = frame({ w: 720, h: 540, l: 84, r: 214, t: 66, b: 92 });
  f.setX(0, 6000); f.setY(0, 3.2);
  const out = [
    { key: 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x1, y2: f.y0 } },
    { key: 'ay', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x0, y2: f.y1 } },
    label('xl', (f.x0 + f.x1) / 2, f.y0 + 30, 'how much you sell', { cls: 'ax-label' }),
    { key: 'yl', tag: 'text', cls: 'ax-label', attrs: { x: 0, y: 0 }, set: { transform: `translate(${f.x0 - 30} ${(f.y0 + f.y1) / 2}) rotate(-90)` }, text: 'cost of getting out (%)' },
    ...range(4).map(i => label('yt' + i, f.x0 - 9, f.sy(i) + 4, String(i), { cls: 'ax-tick ax-tick-y' })),
    ...range(4).map(i => label('xt' + i, f.sx(i * 2000), f.y0 + 17, String(i * 2000), { cls: 'ax-tick' })),
  ];
  DEPTHS.forEach((d, i) => {
    const pts = range(41).map(k => {
      const q = (k * 6000) / 40;
      return [f.sx(q), f.sy(clamp((fill(d, q).slippage / MID) * 100, 0, 3.2))];
    });
    out.push(
      path('c' + i, pts, { cls: 'curve', set: { stroke: ['var(--cs-data-warm)', 'var(--cs-data-gold)', 'var(--cs-cyan)'][i], 'stroke-width': 2.4 } }),
      label('cl' + i, f.x1 - 4, pts[40][1] + (i === 0 ? -8 : 14), `depth ${d}`, {
        cls: 'lab-sm lab-end lab-' + ['warm', 'gold', 'cyan'][i],
      }));
  });
  out.push(
    { key: 'you', tag: 'circle', cls: 'pt pt-green',
      attrs: { cx: f.sx(clamp(+s.size, 0, 6000)), cy: f.sy(clamp((fill(+s.depth, +s.size).slippage / MID) * 100, 0, 3.2)), r: 7 } },
    label('yl2', 500, 122, 'each extra share is filled', { cls: 'lab-sm' }),
    label('yl3', 500, 136, 'at a worse level than the', { cls: 'lab-sm' }),
    label('yl4', 500, 150, 'one before it, so the cost', { cls: 'lab-sm' }),
    label('yl5', 500, 164, 'bends upward.', { cls: 'lab-sm' }),
  );
  if (warn) out.push(
    label('w1', 500, 220, 'and the depth is not fixed.', { cls: 'lab lab-warm' }),
    label('w2', 500, 250, 'books are deepest when', { cls: 'lab-sm' }),
    label('w3', 500, 264, 'nobody needs them and', { cls: 'lab-sm' }),
    label('w4', 500, 278, 'thinnest exactly when', { cls: 'lab-sm' }),
    label('w5', 500, 292, 'everyone wants out.', { cls: 'lab-sm' }),
    label('w6', 500, 322, 'so you slide from the cyan', { cls: 'lab-sm lab-gold' }),
    label('w7', 500, 336, 'curve to the red one on', { cls: 'lab-sm lab-gold' }),
    label('w8', 500, 350, 'the day it matters.', { cls: 'lab-sm lab-gold' }));
  return out;
}

function mem(s, phi, all) {
  const seed = +s.seed;
  const sets = all ? [[-0.8, 'warm'], [0, 'muted'], [0.8, 'cyan']] : [[phi, phi > 0.25 ? 'cyan' : phi < -0.25 ? 'warm' : 'muted']];
  const every = [-0.85, 0, 0.85].flatMap(p => ar1(s, seed, p));
  const f = PF(every);
  const out = [...timeAxis(f), path('base', [[f.x0, f.sy(100)], [f.x1, f.sy(100)]], { cls: 'rule rule-faint rule-dash' })];
  sets.forEach(([p, tone], i) => {
    const q = ar1(s, seed, p);
    out.push(
      path('m' + i, q.map((v, k) => [f.sx(k), f.sy(v)]), {
        cls: 'curve', set: { stroke: `var(--cs-${tone === 'muted' ? 'muted' : tone === 'warm' ? 'data-warm' : 'cyan'})`, 'stroke-width': all ? 2 : 2.6 },
        opacity: all && Math.abs(p - phi) > 0.2 ? 0.55 : 1,
      }),
      label('ml' + i, f.x1 - 6, f.sy(q[T]) + (i === 1 ? 16 : -8), `φ = ${p.toFixed(2)}`, {
        cls: 'lab-sm lab-end lab-' + tone,
      }));
  });
  out.push(label('now', f.x0 + 8, f.y1 + 4,
    all ? 'the same shocks, three memories' : `φ = ${phi.toFixed(2)}`, { cls: 'lab-big lab-gold' }));
  return out;
}

const REGIME = (() => {
  const z = Z[3];
  const p = [100];
  for (let i = 1; i <= T; i++) p.push(p[i - 1] * Math.exp(0.0004 + (i > T / 2 ? 0.035 : 0.010) * z[i]));
  return p;
})();

function regime(s, phase) {
  const half = Math.floor(T / 2);
  const shown = phase === 1 ? REGIME.slice(0, half + 1) : REGIME;
  const f = PF(REGIME);
  const rets = a => st.sd(range(a.length - 1).map(i => Math.log(a[i + 1] / a[i]))) * 100;
  const s1 = rets(REGIME.slice(0, half + 1)), s2 = rets(REGIME.slice(half)), sa = rets(REGIME);

  return [
    ...timeAxis(f),
    phase >= 2 ? rect('r2', f.sx(half), f.y1, f.x1 - f.sx(half), f.y0 - f.y1, { cls: 'sq sq-resid', opacity: 0.16 }) : null,
    phase >= 2 ? path('brk', [[f.sx(half), f.y0], [f.sx(half), f.y1]], { cls: 'rule rule-gold rule-dash' }) : null,
    phase >= 2 ? label('brkl', f.sx(half), f.y1 - 6, 'the rules change here', { cls: 'lab-sm lab-mid lab-gold' }) : null,
    path('p', shown.map((v, i) => [f.sx(i), f.sy(v)]), { cls: 'curve curve-cyan' }),
    numLabel('s1', f.sx(half / 2), f.y0 + 46, s1, { cls: 'lab lab-mid lab-cold', d: 1, pre: 'σ = ', suf: '%' }),
    phase >= 2 ? numLabel('s2', f.sx(half * 1.5), f.y0 + 46, s2, { cls: 'lab lab-mid lab-warm', d: 1, pre: 'σ = ', suf: '%' }) : null,
    phase >= 3 ? [
      numLabel('sa', f.midX, f.y0 + 72, sa, { cls: 'lab-big lab-mid lab-gold', d: 1, pre: 'σ for the whole sample = ', suf: '%' }),
      label('sal', f.midX, f.y0 + 90, 'too high for the first half, too low for the second', { cls: 'lab-sm lab-mid' }),
    ] : null,
    phase >= 4 ? [
      label('f1', f.midX, f.y1 + 24, 'compute your statistic in windows before you quote it for the series.', { cls: 'lab lab-mid lab-green' }),
      label('f2', f.midX, f.y1 + 44, 'if it moves, one number for the whole thing is a summary of two worlds.', { cls: 'lab-sm lab-mid' }),
    ] : null,
  ].filter(Boolean);
}
