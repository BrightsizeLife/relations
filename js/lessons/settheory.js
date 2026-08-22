/* ─────────────────────────────────────────────────────────────────────────────
   settheory.js — sets, drawn as a hundred actual outcomes you can count.
   Probability is just counting a subset; conditioning is throwing away part of
   the universe and counting again. Both of those are the whole of Bayes.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, label, numLabel, path, rect, arrowDefs } from '../core/plot.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sub, sup, paren, eq, minus, op } from '../core/fx.js';

/* a 10×10 universe: 100 equally likely outcomes */
const N = 100, COLS = 10;
const CELL = 40, GAP = 4;
const GX = 130, GY = 66;

const cellPos = i => [GX + (i % COLS) * (CELL + GAP), GY + Math.floor(i / COLS) * (CELL + GAP)];

/** membership: the first nAB are in both, then A-only, then B-only, then neither */
function sets(s) {
  const both = +s.nAB;
  const aOnly = Math.max(0, +s.nA - both);
  const bOnly = Math.max(0, +s.nB - both);
  const inA = new Set(), inB = new Set();
  let i = 0;
  for (let k = 0; k < both; k++, i++) { inA.add(i); inB.add(i); }
  for (let k = 0; k < aOnly && i < N; k++, i++) inA.add(i);
  for (let k = 0; k < bOnly && i < N; k++, i++) inB.add(i);
  return { inA, inB, both, aOnly, bOnly, neither: N - both - aOnly - bOnly };
}

const OPS = {
  A: { label: 'A', test: (a, b) => a, desc: 'everything in A' },
  B: { label: 'B', test: (a, b) => b, desc: 'everything in B' },
  union: { label: 'A ∪ B', test: (a, b) => a || b, desc: 'in A, or in B, or in both' },
  inter: { label: 'A ∩ B', test: (a, b) => a && b, desc: 'in both at once' },
  notA: { label: 'Aᶜ', test: (a, b) => !a, desc: 'everything outside A' },
  diff: { label: 'A \\ B', test: (a, b) => a && !b, desc: 'in A but not in B' },
  xor: { label: 'A △ B', test: (a, b) => (a || b) && !(a && b), desc: 'in exactly one of them' },
};

function grid(s, { highlight, dim = false, key = 'c', restrict = null } = {}) {
  const { inA, inB } = sets(s);
  return range(N).map(i => {
    const a = inA.has(i), b = inB.has(i);
    const [x, y] = cellPos(i);
    const on = highlight ? highlight(a, b) : false;
    const gone = restrict ? !restrict(a, b) : false;
    const cls = gone ? 'sq' : on ? (a && b ? 'sq sq-pos' : a ? 'sq sq-x' : b ? 'sq sq-y' : 'sq sq-neg') : 'cell';
    return rect(`${key}-${i}`, x, y, CELL, CELL, {
      cls, dur: 240, opacity: gone ? 0.07 : on ? 1 : 0.5,
      tip: `outcome ${i + 1}<br>${a ? 'in A' : 'not in A'} · ${b ? 'in B' : 'not in B'}`,
    });
  });
}

const ringItems = s => {
  const { inA, inB } = sets(s);
  const items = [];
  range(N).forEach(i => {
    const a = inA.has(i), b = inB.has(i);
    const [x, y] = cellPos(i);
    if (a) items.push(rect(`ra-${i}`, x + 2, y + 2, CELL - 4, CELL - 4, { cls: 'bar-out', dur: 240, opacity: 0.85 }));
    if (b) items.push({
      key: `rb-${i}`, tag: 'circle', cls: 'pt-ghost', dur: 240,
      attrs: { cx: x + CELL / 2, cy: y + CELL / 2, r: CELL / 2 - 5 },
    });
  });
  return items;
};

export default {
  meta: {
    id: 'settheory', title: 'set theory & probability', kicker: 'FOUNDATION',
    status: 'live',
    deck: 'Probability is not really about randomness. It is about <em>measuring subsets</em> — you have a collection of things that could happen, you mark off the ones you care about, and you count. Every rule that follows is a rule about counting overlaps.',
    dataNote: 'A universe of 100 equally likely outcomes, so every probability on this page is literally a count you can check by eye. The sliders decide how many land in each region.',
    deps: [], unlocks: ['bayes', 'chisq', 'entropy'],
    next: 'entropy', nextLabel: 'entropy & information',
    outro: 'count the subset, divide by the universe. conditioning just shrinks the universe.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { nA: 40, nB: 30, nAB: 12, op: 'union', cond: 'none' },

  steps: [
    {
      title: 'a universe, and two things you might care about',
      prose: `<p>Here is everything that could happen: one hundred outcomes, all equally likely. That grid is the <strong>sample space</strong>.</p>
        <p>Inside it, mark off two subsets. Call them A and B — say, "it rains" and "the train is late". A square can be in A, in B, in both, or in neither.</p>
        <p><strong>Move the sliders</strong> and watch the four regions redistribute. Every probability on this page is just how many squares are lit, out of a hundred.</p>`,
      formula: formula(
        'P' + paren(t('A', { tone: 'cyan' })) + eq +
        frac('outcomes in ' + t('A', { tone: 'cyan' }), 'outcomes in total'),
        { caption: 'a probability is a count divided by a count' }),
      readouts: [
        { key: 'a', label: '|A|', tone: 'cyan', get: s => +s.nA, d: 0 },
        { key: 'b', label: '|B|', tone: 'purple', get: s => +s.nB, d: 0 },
        { key: 'ab', label: '|A ∩ B|', tone: 'green', get: s => sets(s).both, d: 0, wide: true },
        { key: 'pa', label: 'P(A)', tone: 'cyan', get: s => +s.nA / N, d: 2, wide: true },
        { key: 'pb', label: 'P(B)', tone: 'purple', get: s => +s.nB / N, d: 2, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'nA', label: '|A|', min: 0, max: 70, step: 1, fast: true },
        { type: 'slider', key: 'nB', label: '|B|', min: 0, max: 70, step: 1, fast: true },
        { type: 'slider', key: 'nAB', label: 'overlap', min: 0, max: 40, step: 1, fast: true },
      ],
      beats: [
        {
          label: 'the sample space',
          note: 'A hundred squares. Nothing is marked yet — this is everything that could happen.',
          scene: s => [
            ...grid(s, { highlight: () => false }),
            label('t', 360, 40, 'the sample space — 100 equally likely outcomes', { cls: 'lab-big lab-mid' }),
          ],
        },
        {
          label: 'mark off A and B',
          note: 'Squares are shaded by which region they fall in. The green ones are in both — that overlap is where all the interesting rules live.',
          scene: s => [
            ...grid(s, { highlight: (a, b) => a || b }),
            label('t', 360, 40, 'A, B, and the overlap', { cls: 'lab-big lab-mid' }),
            label('la', 44, GY + 24, 'A', { cls: 'lab-big lab-cyan' }),
            label('lb', 44, GY + 54, 'B', { cls: 'lab-big lab-purple' }),
            label('lab', 44, GY + 84, 'both', { cls: 'lab-big lab-green' }),
            label('ln', 44, GY + 114, 'neither', { cls: 'lab-sm' }),
          ],
        },
      ],
    },

    {
      title: 'the operations are all about the overlap',
      prose: `<p>Union, intersection, complement, difference. Each one is a rule for deciding which squares survive.</p>
        <p><strong>Step through the operations below.</strong> They are worth doing by eye once, because the only one that ever causes trouble is the union — and the reason is visible.</p>`,
      readouts: [
        { key: 'op', label: 'operation', tone: 'gold', get: s => OPS[s.op].label, wide: true },
        { key: 'n', label: 'outcomes', tone: 'green', get: s => countOp(s), d: 0, wide: true },
        { key: 'p', label: 'probability', tone: 'gold', get: s => countOp(s) / N, d: 2, wide: true },
      ],
      controls: [
        { type: 'segment', key: 'op', label: 'show', options: Object.entries(OPS).map(([k, v]) => ({ value: k, label: v.label, explain: v.desc })) },
        { type: 'slider', key: 'nAB', label: 'overlap', min: 0, max: 40, step: 1, fast: true },
      ],
      beats: [
        {
          label: 'pick an operation',
          note: 'Lit squares are the ones in the result. The readout counts them for you.',
          scene: s => [
            ...grid(s, { highlight: OPS[s.op].test }),
            label('t', 360, 40, OPS[s.op].label + ' — ' + OPS[s.op].desc, { cls: 'lab-big lab-mid lab-gold', dur: 200 }),
            numLabel('n', 360, 512, countOp(s) / N, { cls: 'lab-big lab-mid lab-green', d: 2, pre: 'P = ', dur: 200 }),
          ],
        },
      ],
    },

    {
      title: 'why you subtract the overlap',
      prose: `<p>Here's the one rule people get wrong. To count the union you might add |A| and |B| — but every square in the overlap just got counted <strong>twice</strong>, once for each set.</p>
        <p>So subtract it back off. That's inclusion–exclusion, and it's not an algebraic trick; it is literally correcting a double count you can see on the grid.</p>
        <p><strong>Push the overlap slider</strong> and watch the naive sum drift away from the true count.</p>`,
      formula: formula(
        'P' + paren(t('A ∪ B', { tone: 'gold' })) + eq +
        'P' + paren(t('A', { tone: 'cyan' })) + ' + ' + 'P' + paren(t('B', { tone: 'purple' })) +
        minus + 'P' + paren(t('A ∩ B', { tone: 'green', explain: 'The double-counted part. Subtract it exactly once.' })),
        { caption: 'add, then undo the double count' }),
      readouts: [
        { key: 'naive', label: 'P(A) + P(B)', tone: 'warm', get: s => (+s.nA + +s.nB) / N, d: 2, wide: true },
        { key: 'olap', label: 'minus P(A∩B)', tone: 'green', get: s => sets(s).both / N, d: 2, wide: true },
        { key: 'true', label: 'true P(A∪B)', tone: 'gold', get: s => countOp({ ...s, op: 'union' }) / N, d: 2, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'nAB', label: 'overlap', min: 0, max: 40, step: 1, fast: true },
        { type: 'slider', key: 'nA', label: '|A|', min: 0, max: 70, step: 1, fast: true },
        { type: 'slider', key: 'nB', label: '|B|', min: 0, max: 70, step: 1, fast: true },
      ],
      beats: [
        {
          label: 'the double count',
          note: 'The green squares got counted once as part of A and again as part of B. The correction removes exactly that surplus.',
          scene: s => {
            const S = sets(s);
            const naive = +s.nA + +s.nB;
            const trueN = countOp({ ...s, op: 'union' });
            const W = 560, x0 = 80, y = 470;
            const k = W / Math.max(naive, 1);
            return [
              ...grid(s, { highlight: (a, b) => a || b, key: 'c' }),
              rect('bar-a', x0, y, +s.nA * k, 20, { cls: 'sq sq-x', dur: 220, tip: `|A| = ${+s.nA}` }),
              rect('bar-b', x0 + +s.nA * k, y, +s.nB * k, 20, { cls: 'sq sq-y', dur: 220, tip: `|B| = ${+s.nB}` }),
              rect('bar-o', x0 + (naive - S.both) * k, y, S.both * k, 20, { cls: 'sq sq-pos', dur: 220, tip: `double counted: ${S.both}` }),
              { key: 'mark', tag: 'line', cls: 'rule-gold', dur: 220, attrs: { x1: x0 + trueN * k, y1: y - 10, x2: x0 + trueN * k, y2: y + 30 } },
              label('lt', x0 + trueN * k, y + 46, `true union = ${trueN}`, { cls: 'lab-sm lab-mid lab-gold', dur: 220 }),
              label('ln', x0 + naive * k, y - 16, `naive sum = ${naive}`, { cls: 'lab-sm lab-end lab-warm', dur: 220 }),
              label('t', 360, 40, 'adding them counts the overlap twice', { cls: 'lab-big lab-mid' }),
            ];
          },
        },
      ],
    },

    {
      title: 'conditioning throws away part of the universe',
      prose: `<p>This is the single most important idea on the page, and it is much simpler than the notation suggests.</p>
        <p><strong>P(A | B) means: forget every outcome that isn't in B, then ask what fraction of what's left is in A.</strong> You are not changing anything about A. You are shrinking the universe and recounting.</p>
        <p>Watch the greyed-out squares disappear from consideration. The denominator changes from 100 to |B|, and that's the entire effect.</p>`,
      formula: formula(
        'P' + paren(t('A', { tone: 'cyan' }) + ' | ' + t('B', { tone: 'purple' })) + eq +
        frac('P' + paren(t('A ∩ B', { tone: 'green' })), 'P' + paren(t('B', { tone: 'purple', explain: 'The new universe. Everything outside B has been discarded.' }))),
        { caption: 'the overlap, measured against the smaller universe' }),
      aside: `<b>Where this becomes Bayes.</b> Write the same overlap two ways — P(A∩B) = P(A|B)·P(B) and also = P(B|A)·P(A) — set them equal, and rearrange. That is the whole derivation of Bayes' rule. It is a statement about one region of a grid being measured from two directions.`,
      readouts: [
        { key: 'pa', label: 'P(A)', tone: 'cyan', get: s => +s.nA / N, d: 3, wide: true },
        { key: 'pab', label: 'P(A | B)', tone: 'gold', get: s => (+s.nB ? sets(s).both / +s.nB : NaN), d: 3, wide: true },
        { key: 'pba', label: 'P(B | A)', tone: 'green', get: s => (+s.nA ? sets(s).both / +s.nA : NaN), d: 3, wide: true },
        { key: 'ind', label: 'related?', wide: true, get: s => {
          const pa = +s.nA / N, pab = +s.nB ? sets(s).both / +s.nB : NaN;
          if (!isFinite(pab)) return '—';
          return Math.abs(pab - pa) < 0.015 ? 'independent' : pab > pa ? 'B makes A likelier' : 'B makes A less likely';
        } },
      ],
      controls: [
        { type: 'segment', key: 'cond', label: 'condition on', options: [{ value: 'none', label: 'nothing' }, { value: 'B', label: 'B' }, { value: 'A', label: 'A' }] },
        { type: 'slider', key: 'nAB', label: 'overlap', min: 0, max: 40, step: 1, fast: true },
        { type: 'slider', key: 'nB', label: '|B|', min: 1, max: 70, step: 1, fast: true },
      ],
      beats: [
        {
          label: 'the whole universe',
          note: 'Unconditionally, P(A) is A measured against all 100 outcomes.',
          scene: s => [
            ...grid(s, { highlight: (a) => a }),
            label('t', 360, 40, `P(A) = ${+s.nA} / 100 = ${(+s.nA / N).toFixed(2)}`, { cls: 'lab-big lab-mid lab-cyan' }),
          ],
        },
        {
          label: 'shrink it to B',
          hold: 1800,
          note: 'Everything outside B fades out. The question has not changed — only what counts as possible.',
          scene: s => {
            const S = sets(s);
            const cond = s.cond === 'A' ? (a) => a : (a, b) => b;
            const denom = s.cond === 'A' ? +s.nA : +s.nB;
            const num = S.both;
            return [
              ...grid(s, { highlight: (a, b) => a && b, restrict: s.cond === 'none' ? null : cond }),
              label('t', 360, 40,
                s.cond === 'none' ? 'pick something to condition on'
                  : `P(${s.cond === 'A' ? 'B | A' : 'A | B'}) = ${num} / ${denom} = ${denom ? (num / denom).toFixed(3) : '—'}`,
                { cls: 'lab-big lab-mid lab-gold', dur: 220 }),
              label('t2', 360, 508,
                s.cond === 'none' ? '' : 'the denominator is no longer 100', { cls: 'lab lab-mid', dur: 220 }),
            ];
          },
        },
      ],
    },

    {
      title: 'independence, and what it actually claims',
      prose: `<p>Two events are independent when knowing one tells you nothing about the other — when P(A | B) equals P(A) exactly.</p>
        <p>On the grid that means A takes up <em>the same share</em> of B as it does of the whole universe. Not that they don't overlap — that's a completely different thing called being disjoint, and it is in fact the strongest possible <em>dependence</em>: if you know B happened, you know A did not.</p>
        <p><strong>Hit the button below</strong> to set the overlap to exactly the independent value and see what that looks like.</p>`,
      formula: formula(
        t('independent', { tone: 'green' }) + ': P(A ∩ B) ' + eq + ' P(A) · P(B)' +
        `<br>` +
        t('disjoint', { tone: 'warm' }) + ': P(A ∩ B) ' + eq + ' 0 ' +
        op('&nbsp;—&nbsp;') + t('which makes them maximally dependent', { cls: 'fx-muted' }),
        { size: 'sm', caption: 'these two are constantly confused and mean opposite things' }),
      readouts: [
        { key: 'obs', label: 'P(A∩B) observed', tone: 'gold', get: s => sets(s).both / N, d: 3, wide: true },
        { key: 'exp', label: 'if independent', tone: 'green', get: s => (+s.nA / N) * (+s.nB / N), d: 3, wide: true },
        { key: 'gap', label: 'difference', tone: 'warm', get: s => sets(s).both / N - (+s.nA / N) * (+s.nB / N), d: 3, wide: true },
        { key: 'verdict', label: 'verdict', wide: true, get: s => {
          const g = sets(s).both / N - (+s.nA / N) * (+s.nB / N);
          if (Math.abs(g) < 0.008) return 'independent';
          return sets(s).both === 0 ? 'disjoint — maximally dependent' : g > 0 ? 'positively related' : 'negatively related';
        } },
      ],
      controls: [
        { type: 'slider', key: 'nAB', label: 'overlap', min: 0, max: 40, step: 1, fast: true },
        { type: 'button', key: 'indep', label: '[set the overlap to independence]', action: s => { s.nAB = Math.round((+s.nA * +s.nB) / N); } },
      ],
      dep: { note: 'This expected-count-under-independence is exactly what a chi-square test compares against.', lesson: 'chisq', label: 'chi-square' },
      beats: [
        {
          label: 'same share, or not',
          note: 'Two bars: A\'s share of everything, and A\'s share of B. When they match, the events are independent.',
          scene: s => {
            const S = sets(s);
            const pa = +s.nA / N;
            const pab = +s.nB ? S.both / +s.nB : 0;
            const y0 = 400, W = 460, x0 = 130;
            return [
              ...grid(s, { highlight: (a, b) => a && b }),
              rect('b1bg', x0, y0, W, 26, { cls: 'cell' }),
              rect('b1', x0, y0, W * pa, 26, { cls: 'sq sq-x', dur: 220 }),
              label('b1l', x0 - 10, y0 + 18, 'A of everything', { cls: 'lab-sm lab-end' }),
              label('b1v', x0 + W + 10, y0 + 18, pa.toFixed(3), { cls: 'lab lab-cyan', dur: 220 }),
              rect('b2bg', x0, y0 + 44, W, 26, { cls: 'cell' }),
              rect('b2', x0, y0 + 44, W * pab, 26, { cls: 'sq sq-pos', dur: 220 }),
              label('b2l', x0 - 10, y0 + 62, 'A of B only', { cls: 'lab-sm lab-end' }),
              label('b2v', x0 + W + 10, y0 + 62, pab.toFixed(3), { cls: 'lab lab-green', dur: 220 }),
              label('t', 360, 40,
                Math.abs(pab - pa) < 0.015 ? 'the bars match — independent' : 'the bars differ — B carries information about A',
                { cls: `lab-big lab-mid ${Math.abs(pab - pa) < 0.015 ? 'lab-green' : 'lab-warm'}`, dur: 220 }),
            ];
          },
        },
      ],
    },

    {
      title: 'chop the universe into pieces',
      prose: `<p>One last construction, because everything downstream uses it. A <strong>partition</strong> cuts the sample space into non-overlapping pieces that between them cover everything.</p>
        <p>Once you have one, any event's probability can be assembled piece by piece: how likely each piece is, times how likely the event is <em>within</em> that piece. That's the law of total probability, and it is exactly the denominator of Bayes' rule.</p>
        <p>It is also what you're doing every time you compute a weighted average, standardise a rate, or work out a base rate.</p>`,
      formula: formula(
        'P' + paren('A') + eq + 'P' + paren('A | ' + sub('B', '1')) + 'P' + paren(sub('B', '1')) +
        ' + P' + paren('A | ' + sub('B', '2')) + 'P' + paren(sub('B', '2')) + ' + …',
        { caption: 'break it into cases, weight each by how often that case happens' }),
      dep: { note: 'This sum is the denominator that MCMC exists to avoid computing.', lesson: 'bayes', label: 'bayesian basics' },
      readouts: [
        { key: 'p1', label: 'P(B₁)', tone: 'cyan', get: s => +s.nA / N, d: 2, wide: true },
        { key: 'p2', label: 'P(B₂)', tone: 'purple', get: s => 1 - +s.nA / N, d: 2, wide: true },
        { key: 'tot', label: 'they must sum to', tone: 'green', get: () => 1, d: 2, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'nA', label: 'size of the first piece', min: 5, max: 95, step: 1, fast: true },
      ],
      beats: [
        {
          label: 'a partition',
          note: 'No square is in two pieces, and no square is left out. That is the only requirement.',
          scene: s => {
            const cut = +s.nA;
            return [
              ...range(N).map(i => {
                const [x, y] = cellPos(i);
                return rect(`p-${i}`, x, y, CELL, CELL, {
                  cls: i < cut ? 'sq sq-x' : 'sq sq-y', dur: 220, opacity: 0.85,
                  tip: `outcome ${i + 1} → piece ${i < cut ? 'B₁' : 'B₂'}`,
                });
              }),
              label('t', 360, 40, 'two pieces, no overlap, nothing left over', { cls: 'lab-big lab-mid' }),
              label('l1', 44, GY + 30, 'B₁', { cls: 'lab-big lab-cyan' }),
              label('l2', 44, GY + 60, 'B₂', { cls: 'lab-big lab-purple' }),
              label('sum', 360, 508, `${cut}/100 + ${N - cut}/100 = 1`, { cls: 'lab-big lab-mid lab-green', dur: 220 }),
            ];
          },
        },
      ],
    },
  ],
};

function countOp(s) {
  const { inA, inB } = sets(s);
  const test = OPS[s.op].test;
  let n = 0;
  for (let i = 0; i < N; i++) if (test(inA.has(i), inB.has(i))) n++;
  return n;
}
