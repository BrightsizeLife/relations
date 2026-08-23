/* ─────────────────────────────────────────────────────────────────────────────
   nonparametric.js — tests that throw the numbers away and keep the order.
   Same four moves as everywhere else, run on ranks instead of values.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, fnArea, strip, histBars, arrowDefs } from '../core/plot.js';
import { slots, byMagnitude, devBar, moveBadge } from '../core/bench.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sqrt, sub, sup, bar, sumOver, paren, eq, minus, op } from '../core/fx.js';

const F = () => frame({ w: 720, h: 540, l: 66, r: 28, t: 34, b: 58 });

/* Student's sleep data again — paired, so the sign and signed-rank tests apply */
const A = [0.7, -1.6, -0.2, -1.2, -0.1, 3.4, 3.7, 0.8, 0.0, 2.0];
const B = [1.9, 0.8, 1.1, 0.1, -0.1, 4.4, 5.5, 1.6, 4.6, 3.4];

/* PlantGrowth, for the two- and three-group rank tests */
const PLANTS = {
  control: [4.17, 5.58, 5.18, 6.11, 4.50, 4.61, 5.17, 4.53, 5.33, 5.14],
  treat1: [4.81, 4.17, 4.41, 3.59, 5.87, 3.83, 6.03, 4.89, 4.32, 4.69],
  treat2: [6.31, 5.12, 5.54, 5.50, 5.37, 5.29, 4.92, 6.15, 5.80, 5.26],
};

/** an outlier the reader can switch on, to show what ranks are immune to */
function diffs(s) {
  const d = B.map((v, i) => v - A[i]);
  if (s.outlier) d[9] = 42;         // one patient reports an absurd number
  return d;
}
const groupsOf = s => {
  const g = [PLANTS.control.slice(), PLANTS.treat1.slice(), PLANTS.treat2.slice()];
  if (s.outlier) g[1][0] = 40;
  return g;
};

export default {
  meta: {
    id: 'nonparametric', title: 'rank-based tests', kicker: 'THROW THE NUMBERS AWAY',
    status: 'live',
    deck: '"Non-parametric" does not mean assumption-free, and it is not a safety net you reach for when a test comes out non-significant. It means the test asks about <em>order</em> rather than about size — which changes what is being claimed, not just how it is computed.',
    dataNote: 'Data: Cushny & Peebles\' paired sleep trial (the one behind Student\'s 1908 paper) for the paired tests, and R\'s <code>PlantGrowth</code> for the group comparisons. A toggle lets you inject one absurd value so you can watch what ranks are and are not immune to.',
    deps: ['ttest', 'correlation'], unlocks: ['resampling'],
    next: 'resampling', nextLabel: 'permutation & bootstrap',
    outro: 'order survives things that values do not. that is the whole trade.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { outlier: false, show: 'values', pair: 0 },

  steps: [
    {
      title: 'what a rank test actually claims',
      prose: `<p>Start with the thing that is usually skipped. A t-test says: <em>the two population means are equal</em>. A rank test says something different — roughly, <em>a value drawn from one group is as likely to exceed a value from the other as the reverse</em>.</p>
        <p>Those are not the same hypothesis. Two distributions can have identical means while one is far more likely to produce the larger value. So a rank test is not a "more careful" version of a t-test; it is an answer to a different question.</p>
        <p>What it buys you is that no arithmetic is done on the values themselves — only on their positions in the queue. And positions cannot be dragged around by one absurd number.</p>`,
      formula: formula(
        t('t-test', { tone: 'cold' }) + ': ' + t('H₀', { tone: 'muted' }) + ' the means are equal' +
        `<br>` +
        t('rank test', { tone: 'warm' }) + ': ' + t('H₀', { tone: 'muted' }) + ' P(a > b) ' + eq + ' P(b > a)',
        { size: 'sm', caption: 'different claims, not different levels of caution' }),
      readouts: [
        { key: 'n', label: 'patients', get: () => A.length, d: 0 },
        { key: 'md', label: 'mean difference', tone: 'gold', get: s => st.mean(diffs(s)), d: 3, wide: true },
        { key: 'medd', label: 'median difference', tone: 'green', get: s => st.median(diffs(s)), d: 3, wide: true },
      ],
      controls: [
        { type: 'toggle', key: 'outlier', label: 'one patient reports 42 extra hours', explain: 'A transcription error, or a patient who misunderstood the question. It happens.' },
      ],
      beats: [
        { label: 'the values', hold: 1300, note: 'Ten patients, each with a difference. This is the number a t-test does arithmetic on.', scene: s => vr(s, 1) },
        { label: 'their mean', hold: 1400, note: 'Add them up, divide by ten. One number, and it can be moved by any one of the ten.', scene: s => vr(s, 2) },
        { label: 'now throw the values away', hold: 1600, note: 'Line them up in order and keep only the position. Tenth, ninth, eighth. The gaps between them are gone.', scene: s => vr(s, 3) },
        {
          label: 'break one value',
          note: 'Turn the outlier on. <b>The mean lurches; the median barely moves, and the ranks do not change at all</b> — the wild value is still just “the biggest one”.',
          scene: s => vr(s, 4),
        },
      ],
    },

    {
      title: 'the sign test: just count',
      prose: `<p>The crudest possible test, and worth doing once because everything else is a refinement of it.</p>
        <p>Ignore how big each difference is. Just ask: <strong>did it go up or down?</strong> If the drug does nothing, each patient is a coin flip, so the number of improvements should look like ten tosses of a fair coin.</p>
        <p>That gives you an exact p-value from the binomial distribution, with no normality, no variance, and nothing to estimate. It also throws away almost all your information, which is why it is rarely the right choice.</p>`,
      formula: formula(
        'under ' + t('H₀', { tone: 'muted' }) + ': #improved ~ Binomial' + paren('n, ½') +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('nothing else is assumed', { cls: 'fx-muted' }),
        { size: 'sm', caption: 'the whole test is a coin-flip count' }),
      readouts: [
        { key: 'up', label: 'improved', tone: 'warm', get: s => st.signTest(diffs(s)).pos, d: 0 },
        { key: 'dn', label: 'got worse', tone: 'cold', get: s => st.signTest(diffs(s)).neg, d: 0, wide: true },
        { key: 'n', label: 'usable pairs', get: s => st.signTest(diffs(s)).n, d: 0, wide: true },
        { key: 'p', label: 'exact p', tone: 'gold', get: s => st.signTest(diffs(s)).p, fmt: st.fmtP, wide: true },
      ],
      controls: [
        { type: 'toggle', key: 'outlier', label: 'inject the absurd value' },
      ],
      beats: [
        {
          label: 'up or down',
          hold: 1700,
          note: 'Ten patients. Each is one arrow. That is the entire dataset as far as this test is concerned.',
          scene: s => {
            const d = diffs(s);
            const items = [label('t', 376, 100, 'did this patient improve?', { cls: 'lab-big lab-mid' })];
            d.forEach((v, i) => {
              const x = 110 + i * 56;
              items.push(label(`n-${i}`, x, 380, String(i + 1), { cls: 'lab-sm lab-mid lab-muted', delay: i * 110 }));
              if (v === 0) {
                items.push(label(`a-${i}`, x, 290, '–', { cls: 'lab-big lab-mid lab-muted', delay: i * 110 }));
              } else {
                items.push(path(`a-${i}`, v > 0 ? [[x, 320], [x, 200]] : [[x, 200], [x, 320]], {
                  cls: v > 0 ? 'arrow arrow-warm' : 'arrow', delay: i * 110,
                  set: { 'stroke-width': 3, stroke: v > 0 ? 'var(--cs-data-warm)' : 'var(--cs-data-cold)' },
                }));
              }
            });
            const T = st.signTest(d);
            items.push(label('c', 376, 430, `${T.pos} up, ${T.neg} down`, { cls: 'lab-big lab-mid lab-gold' }));
            return items;
          },
        },
        {
          label: 'against ten coin flips',
          note: 'The bars are what a useless drug would produce. Our count sits out in the tail, so the coin-flip story fits badly.',
          scene: s => {
            const T = st.signTest(diffs(s));
            const f = F();
            f.setX(-0.6, T.n + 0.6); f.setY(0, 0.3);
            return [
              ...axes(f, { xLabel: 'number of patients who improved', yLabel: 'probability if the drug does nothing', yN: 4 }),
              ...range(T.n + 1).map(k => rect(`b-${k}`,
                f.sx(k) - 22, f.sy(st.binomPmf(k, T.n, 0.5)), 44, f.y0 - f.sy(st.binomPmf(k, T.n, 0.5)), {
                cls: Math.abs(k - T.n / 2) >= Math.abs(T.pos - T.n / 2) ? 'bar bar-warm' : 'bar bar-dim',
                dur: 240, delay: k * 45,
                tip: `${k} improved: <b>${(st.binomPmf(k, T.n, 0.5) * 100).toFixed(1)}%</b>`,
              })),
              vLine(f, T.pos, { key: 'obs', cls: 'rule-gold', dur: 240 }),
              label('l', 376, f.y1 + 6, `${T.pos} of ${T.n} improved · exact p = ${st.fmtP(T.p)}`,
                { cls: 'lab-big lab-mid lab-gold', dur: 240 }),
              label('l2', 376, f.y1 + 28, 'warm bars are outcomes at least this lopsided', { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
      ],
    },

    {
      title: 'signed-rank: use the sizes, but only their order',
      prose: `<p>The sign test wastes information — a patient who gained six hours counts exactly the same as one who gained six minutes.</p>
        <p>Wilcoxon's fix is the compromise the whole family is built on. Rank the differences <strong>by size, ignoring sign</strong>. Then add up the ranks belonging to the improvements. A big improvement contributes a big rank, so magnitude comes back — but only through its position in the queue, so one absurd value contributes rank 10 and no more.</p>
        <p>This is the same move as Spearman in the correlation lesson: run the familiar calculation on ranks.</p>`,
      formula: formula(
        t('V', { tone: 'warm' }) + eq + sumOver('rank' + paren('|' + sub('d', 'i') + '|'), { from: 'improved', to: '' }) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + 'under H₀, E[V] ' + eq + frac('n(n+1)', '4'),
        { size: 'sm', caption: 'magnitude, laundered through the ranks' }),
      dep: { note: 'Same trick as Spearman: keep the calculation, change the input.', lesson: 'correlation', label: 'correlation' },
      readouts: [
        { key: 'V', label: 'V', tone: 'warm', get: s => st.wilcoxonSigned(diffs(s)).V, d: 1 },
        { key: 'exp', label: 'expected if null', get: s => st.wilcoxonSigned(diffs(s)).mu, d: 1, wide: true },
        { key: 'z', label: 'z', tone: 'gold', get: s => st.wilcoxonSigned(diffs(s)).z, d: 3 },
        { key: 'p', label: 'p (signed-rank)', tone: 'gold', get: s => st.wilcoxonSigned(diffs(s)).p, fmt: st.fmtP, wide: true },
        { key: 'pt', label: 'p (paired t)', tone: 'cold', get: s => st.tTestPaired(B, A).p, fmt: st.fmtP, wide: true },
      ],
      controls: [
        { type: 'toggle', key: 'outlier', label: 'inject the absurd value' },
      ],
      beats: [
        {
          label: 'rank by size',
          hold: 1900,
          note: 'Bars sorted by how big the change was, sign ignored. The colour still remembers the direction.',
          scene: s => {
            const d = diffs(s);
            const W = st.wilcoxonSigned(d);
            const sl = slots(d.length, { rows: 1, rowY: [420], x0: 70, x1: 680 });
            const k = sl.scaleFor(Math.max(...d.map(Math.abs)));
            const rank = byMagnitude(d);
            return [
              ...moveBadge(1, { reused: true }),
              label('t', 376, 110, 'the differences, sorted by size', { cls: 'lab-big lab-mid' }),
              ...d.map((v, i) => devBar(i, v, {
                key: 'w', mode: 'square', k: 1, sl, slot: rank[i], baseY: 420,
                delay: rank[i] * 90,
                tip: `patient ${i + 1}: ${v.toFixed(1)} h`,
              })).map((it, i) => ({
                ...it,
                attrs: { x: sl.x(rank[i]), y: 420 - Math.abs(d[i]) * k, width: sl.width, height: Math.abs(d[i]) * k },
              })),
              ...d.map((v, i) => label(`r-${i}`, sl.centre(rank[i]), 440,
                String(d.length - rank[i]), { cls: 'lab-sm lab-mid lab-gold', delay: rank[i] * 90 })),
              label('rl', 376, 466, 'rank (1 = smallest change)', { cls: 'lab-sm lab-mid' }),
              label('key', 376, 490, 'warm = improved · cold = got worse', { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
        {
          label: 'add the ranks that improved',
          note: 'Only the warm bars contribute their rank. If the drug did nothing, the warm and cold ranks would split evenly.',
          scene: s => {
            const d = diffs(s);
            const W = st.wilcoxonSigned(d);
            const f = F();
            f.setX(0, Math.max(W.V, W.Vneg, W.mu) * 1.5); f.setY(0, 1);
            const rowY = [190, 290, 400];
            const bar = (key, v, y, cls, name) => [
              rect(key, 90, y - 18, ((f.x1 - 90) * v) / f.dx[1], 36, { cls, dur: 300 }),
              label(key + 'n', 90, y - 30, name, { cls: 'lab' }),
              numLabel(key + 'v', 96 + ((f.x1 - 90) * v) / f.dx[1], y + 6, v, { cls: 'lab-big', d: 1, dur: 300 }),
            ];
            return [
              ...bar('vp', W.V, rowY[0], 'sq sq-pos', 'sum of ranks that improved (V)'),
              ...bar('vn', W.Vneg, rowY[1], 'sq sq-neg', 'sum of ranks that got worse'),
              ...bar('mu', W.mu, rowY[2], 'sq sq-x', 'what H₀ expects for each'),
              label('z', 376, 470,
                `z = ${W.z.toFixed(3)} · p = ${st.fmtP(W.p)}`, { cls: 'lab-big lab-mid lab-gold', dur: 300 }),
              label('c', 376, 496,
                'the two sums always add to n(n+1)/2 — only the split matters', { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
      ],
    },

    {
      title: 'mann–whitney: every pair, compared',
      prose: `<p>For two independent groups, the rank test has an interpretation so useful it deserves to be the headline.</p>
        <p>Take every possible pairing of one control plant with one treated plant — a hundred of them here. Count how often the treated one is heavier. <strong>That count is U.</strong> Divide by the number of pairs and you have a probability you can say out loud: <em>if I pick one of each at random, how often does the treated one win?</em></p>
        <p>Nobody has ever intuited a t statistic. Everybody can intuit "wins 64% of the time".</p>`,
      formula: formula(
        t('U', { tone: 'warm' }) + eq + '#' + paren(sub('a', 'i') + ' > ' + sub('b', 'j')) +
        op('&nbsp;&nbsp;→&nbsp;&nbsp;') +
        frac(t('U', { tone: 'warm' }), t('n', { tone: 'muted' }) + sub('', 'a') + t('n', { tone: 'muted' }) + sub('', 'b')) +
        eq + t('P(a beats b)', { tone: 'green' }),
        { size: 'sm', caption: 'the common-language effect size, and it falls straight out of the statistic' }),
      readouts: [
        { key: 'U', label: 'U', tone: 'warm', get: s => mw(s).U, d: 1 },
        { key: 'pairs', label: 'pairs compared', get: s => mw(s).na * mw(s).nb, d: 0, wide: true },
        { key: 'ps', label: 'P(treat2 wins)', tone: 'green', get: s => mw(s).pSuperior * 100, d: 1, suf: '%', wide: true },
        { key: 'p', label: 'p (Mann–Whitney)', tone: 'gold', get: s => mw(s).p, fmt: st.fmtP, wide: true },
        { key: 'pt', label: 'p (Welch t)', tone: 'cold', get: s => st.tTestTwoSample(groupsOf(s)[2], groupsOf(s)[0]).p, fmt: st.fmtP, wide: true },
      ],
      controls: [
        { type: 'toggle', key: 'outlier', label: 'inject the absurd value' },
      ],
      beats: [
        {
          label: 'one hundred comparisons',
          hold: 2000,
          note: 'Each cell is one head-to-head. Warm means the treated plant was heavier. <b>U is just the count of warm cells.</b>',
          scene: s => {
            const g = groupsOf(s);
            const a = g[2], b = g[0];
            const cell = 34, x0 = 200, y0 = 110;
            const items = [
              label('t', 376, 80, 'treatment 2 (rows) versus control (columns)', { cls: 'lab lab-mid' }),
            ];
            a.forEach((va, i) => b.forEach((vb, j) => {
              const win = va > vb;
              items.push(rect(`c-${i}-${j}`, x0 + j * cell, y0 + i * cell, cell - 2, cell - 2, {
                cls: `sq ${win ? 'sq-pos' : 'sq-neg'}`, dur: 200, delay: (i * 10 + j) * 6, opacity: 0.85,
                tip: `${va.toFixed(2)} vs ${vb.toFixed(2)} → <b>${win ? 'treated wins' : 'control wins'}</b>`,
              }));
            }));
            const m = st.mannWhitney(a, b);
            items.push(label('u', 376, y0 + 10 * cell + 34,
              `U = ${m.U} of ${m.na * m.nb} → P(treated wins) = ${(m.pSuperior * 100).toFixed(0)}%`,
              { cls: 'lab-big lab-mid lab-gold' }));
            return items;
          },
        },
        {
          label: 'the two groups',
          note: 'The same information as a picture. Rank tests care only about how interleaved these two columns are.',
          scene: s => {
            const g = groupsOf(s);
            const f = F();
            const all = [...g[0], ...g[2]];
            f.setY(Math.min(...all) - 0.4, Math.min(8, Math.max(...all) + 0.4));
            f.setX(0, 720);
            return [
              ...axes(f, { yLabel: 'dried weight (g)', showX: false, xN: 0 }),
              ...strip(f, g[0].map(v => clamp(v, f.dy[0], f.dy[1])), 250, { key: 'c', cls: 'pt pt-cold', r: 7, seed: 3, stagger: 40 }),
              ...strip(f, g[2].map(v => clamp(v, f.dy[0], f.dy[1])), 470, { key: 't', cls: 'pt pt-warm', r: 7, seed: 9, stagger: 40 }),
              label('lc', 250, f.y0 + 22, 'control', { cls: 'ax-label lab-mid' }),
              label('lt', 470, f.y0 + 22, 'treatment 2', { cls: 'ax-label lab-mid' }),
              label('n', 376, f.y1 + 6,
                `P(a treated plant beats a control plant) = ${(mw(s).pSuperior * 100).toFixed(0)}%`,
                { cls: 'lab-big lab-mid lab-green' }),
            ];
          },
        },
      ],
    },

    {
      title: 'kruskal–wallis: anova on ranks',
      prose: `<p>Three or more groups, and the pattern should now be predictable. Replace every value by its rank in the pooled data, then ask whether the groups have different average ranks — which is the between-versus-within question from the ANOVA lesson, computed on ranks.</p>
        <p>The statistic even follows a chi-square distribution rather than an F, because once you are on ranks the variance is fixed by n and there is nothing left to estimate in the denominator.</p>`,
      formula: formula(
        t('H', { tone: 'gold' }) + eq + frac('12', 'N(N+1)') +
        sumOver(frac(sub('R', 'j') + sup('', '2'), sub('n', 'j')), { from: 'groups', to: '' }) + minus + '3(N+1)' +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('≈ χ² with k − 1 df', { tone: 'muted' }),
        { size: 'sm', caption: 'between-group spread of the mean ranks' }),
      dep: { note: 'Same between/within logic as the parametric version.', lesson: 'anova', label: 'one-way anova' },
      readouts: [
        { key: 'H', label: 'H', tone: 'gold', get: s => st.kruskal(groupsOf(s)).H, d: 3 },
        { key: 'df', label: 'df', get: s => st.kruskal(groupsOf(s)).df, d: 0 },
        { key: 'p', label: 'p (Kruskal–Wallis)', tone: 'gold', get: s => st.kruskal(groupsOf(s)).p, fmt: st.fmtP, wide: true },
        { key: 'pf', label: 'p (ANOVA F)', tone: 'cold', get: s => st.anova(groupsOf(s)).p, fmt: st.fmtP, wide: true },
      ],
      controls: [
        { type: 'toggle', key: 'outlier', label: 'inject the absurd value', explain: 'Watch the ANOVA p-value move a long way and the Kruskal–Wallis one barely budge.' },
      ],
      beats: [
        {
          label: 'pool, then rank',
          hold: 1900,
          note: 'All thirty plants line up in one queue. Each keeps its group colour but loses its value.',
          scene: s => {
            const g = groupsOf(s);
            const all = g.flat();
            const r = st.ranks(all);
            const f = F();
            f.setX(0, 31); f.setY(0, 1);
            const colour = i => (i < 10 ? 'pt pt-cold' : i < 20 ? 'pt pt-warm' : 'pt pt-green');
            return [
              ...axes(f, { xLabel: 'rank in the pooled data', showY: false, grid: false, xN: 6 }),
              { key: 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: 300, x2: f.x1, y2: 300 } },
              ...all.map((v, i) => ({
                key: `p-${i}`, tag: 'circle', cls: colour(i), dur: 300, delay: i * 30,
                attrs: { cx: f.sx(r[i]), cy: 300, r: 7 },
                tip: `${['control', 'treat 1', 'treat 2'][Math.floor(i / 10)]}<br>${v.toFixed(2)} g → rank <b>${r[i]}</b>`,
              })),
              ...['control', 'treatment 1', 'treatment 2'].map((n, gi) => label(`l-${gi}`, 150 + gi * 220, 150, n,
                { cls: `lab ${['lab-cold', 'lab-warm', 'lab-green'][gi]} lab-mid` })),
              label('n', 376, 400, 'if the treatments did nothing, the colours would be evenly mixed along this line',
                { cls: 'lab lab-mid' }),
            ];
          },
        },
        {
          label: 'the mean rank per group',
          note: 'Now the same question as ANOVA: are these three averages further apart than shuffling would produce?',
          scene: s => {
            const g = groupsOf(s);
            const K = st.kruskal(g);
            const f = F();
            f.setX(0, 3.2); f.setY(0, 31);
            return [
              ...axes(f, { yLabel: 'mean rank', showX: false, xN: 0, yN: 5 }),
              hLine(f, (g.flat().length + 1) / 2, { key: 'grand', cls: 'rule-gold rule-dash' }),
              label('gl', f.x1 - 6, f.sy((g.flat().length + 1) / 2) - 8, 'expected under H₀', { cls: 'lab-sm lab-end lab-gold' }),
              ...K.meanRanks.map((v, i) => rect(`b-${i}`, f.sx(i + 0.35) - 60, f.sy(v), 120, f.y0 - f.sy(v), {
                cls: `bar ${['bar-cold', 'bar-warm', 'bar-green'][i]}`, dur: 260, delay: i * 160,
                tip: `mean rank <b>${v.toFixed(1)}</b>`,
              })),
              ...['control', 'treatment 1', 'treatment 2'].map((n, i) =>
                label(`n-${i}`, f.sx(i + 0.35), f.y0 + 20, n, { cls: 'lab-sm lab-mid' })),
              label('res', 376, f.y1 + 6, `H = ${K.H.toFixed(2)} on ${K.df} df · p = ${st.fmtP(K.p)}`,
                { cls: 'lab-big lab-mid lab-gold', dur: 260 }),
            ];
          },
        },
      ],
    },

    {
      title: 'what you actually gain, and what it costs',
      prose: `<p>The honest summary, because rank tests are both over-sold and over-avoided.</p>
        <p><strong>You gain:</strong> immunity to wild values, no normality assumption, a workable test for genuinely ordinal data, and — with Mann–Whitney — an effect size anyone can understand.</p>
        <p><strong>You pay:</strong> a little power when the data really is normal (about 5% — much less than people fear), no confidence interval for a mean difference, and a null hypothesis that is <em>not</em> about means, so you cannot report "the groups differ by 0.5 g" from a rank test.</p>
        <p>The failure mode worth naming: reaching for a rank test <em>after</em> the t-test came out non-significant. That is choosing your analysis from your results, and it invalidates the p-value from either test.</p>`,
      aside: `<b>The unequal-spread trap.</b> Mann–Whitney is often described as testing medians. It only does so if the two distributions have the same shape. If one group is much more spread out, you can get a significant result with identical medians — because a value from one group really is more likely to exceed a value from the other. That is a true finding, but it is not the one most people report.`,
      readouts: [
        { key: 'pt', label: 'paired t', tone: 'cold', get: () => st.tTestPaired(B, A).p, fmt: st.fmtP, wide: true },
        { key: 'pw', label: 'signed-rank', tone: 'warm', get: () => st.wilcoxonSigned(B.map((v, i) => v - A[i])).p, fmt: st.fmtP, wide: true },
        { key: 'ps', label: 'sign test', tone: 'muted', get: () => st.signTest(B.map((v, i) => v - A[i])).p, fmt: st.fmtP, wide: true },
      ],
      beats: [
        {
          label: 'the three tests, same data',
          note: 'The sign test throws away the most and pays for it. The signed-rank test costs almost nothing relative to the t-test here — and would have survived the outlier.',
          scene: () => {
            const d = B.map((v, i) => v - A[i]);
            const rows = [
              ['paired t-test', st.tTestPaired(B, A).p, 'uses the values', 'cold'],
              ['Wilcoxon signed-rank', st.wilcoxonSigned(d).p, 'uses the order of the sizes', 'warm'],
              ['sign test', st.signTest(d).p, 'uses only the direction', 'muted'],
            ];
            const items = [label('t', 376, 100, 'the same ten patients, three ways', { cls: 'lab-big lab-mid' })];
            rows.forEach(([name, p, what, tone], i) => {
              const y = 180 + i * 110;
              items.push(rect(`bg-${i}`, 60, y - 34, 600, 86, { cls: 'cell', delay: i * 180, opacity: 0.85 }));
              items.push(label(`n-${i}`, 86, y, name, { cls: `lab-big lab-${tone}`, delay: i * 180 }));
              items.push(label(`w-${i}`, 86, y + 24, what, { cls: 'lab-sm', delay: i * 180 }));
              items.push(label(`p-${i}`, 636, y + 6, `p = ${st.fmtP(p)}`, { cls: 'lab-big lab-end lab-gold', delay: i * 180 }));
            });
            items.push(label('c', 376, 512, 'more information used · more power · more assumptions', { cls: 'lab lab-mid' }));
            return items;
          },
        },
      ],
    },
  ],
};

function mw(s) {
  const g = groupsOf(s);
  return st.mannWhitney(g[2], g[0]);
}

/* ── the opening, staged ──────────────────────────────────────────────────────
   The whole argument is that ranks survive something values do not, and that
   only lands if the values are on screen by themselves first. */

function vr(s, phase) {
  const d = diffs(s);
  const f = F();
  const lo = Math.min(-2, ...d) - 1, hi = Math.min(12, Math.max(...d) + 1);
  f.setX(lo, hi); f.setY(0, 1);
  const r = st.ranks(d);
  const y1 = 190, y2 = 380;

  const out = [
    ...axes(f, { xLabel: 'extra hours of sleep, drug 2 − drug 1', showY: false, grid: false }),
    { key: 'ax1', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1, x2: f.x1, y2: y1 } },
    label('t1', f.x0, y1 - 40, 'the values', { cls: 'lab-big lab-cyan' }),
    ...d.map((v, i) => ({
      key: `v-${i}`, tag: 'circle', cls: v >= 0 ? 'pt pt-warm' : 'pt pt-cold', dur: 260,
      attrs: { cx: f.sx(clamp(v, lo, hi)), cy: y1 + ((i % 3) - 1) * 13, r: 6 },
      tip: `patient ${i + 1}: <b>${v.toFixed(1)}</b> hours`,
    })),
  ];

  if (phase >= 2) out.push(
    vLine(f, st.mean(d), { key: 'mean', cls: 'rule-gold', y0: y1 + 34, y1: y1 - 34, dur: 260 }),
    label('ml', f.sx(clamp(st.mean(d), lo, hi)), y1 - 44, `mean ${st.mean(d).toFixed(2)}`, { cls: 'lab-sm lab-mid lab-gold', dur: 260 }));

  if (phase >= 3) out.push(
    { key: 'ax2', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: y2, x2: f.x1, y2 } },
    label('t2', f.x0, y2 - 40, 'the ranks', { cls: 'lab-big lab-warm' }),
    ...r.map((v, i) => ({
      key: `r-${i}`, tag: 'circle', cls: 'pt pt-green', dur: 260,
      attrs: { cx: f.x0 + ((v - 0.5) / d.length) * (f.x1 - f.x0), cy: y2, r: 7 },
      tip: `patient ${i + 1}: rank <b>${v}</b> of ${d.length}`,
    })),
    ...r.map((v, i) => label(`rl-${i}`, f.x0 + ((v - 0.5) / d.length) * (f.x1 - f.x0), y2 + 22,
      String(v), { cls: 'lab-sm lab-mid', dur: 260 })),
    ...d.map((v, i) => path(`dr-${i}`, [
      [f.sx(clamp(v, lo, hi)), y1 + ((i % 3) - 1) * 13 + 8],
      [f.x0 + ((r[i] - 0.5) / d.length) * (f.x1 - f.x0), y2 - 9],
    ], { cls: 'stick', set: { stroke: 'var(--cs-dim)', 'stroke-width': 1 }, opacity: 0.5, delay: i * 40 })),
    label('n', 376, 470,
      s.outlier ? 'the top rank is still just "1st" — no matter how absurd the value behind it'
        : 'evenly spaced, by construction: ranks are always 1, 2, 3, …',
      { cls: `lab lab-mid ${s.outlier ? 'lab-green' : ''}`, dur: 260 }));
  return out;
}
