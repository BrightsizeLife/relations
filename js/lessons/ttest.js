/* ─────────────────────────────────────────────────────────────────────────────
   ttest.js — a difference between two means, divided by how much difference
   noise alone would hand you. Same deviations and squares as correlation.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, hLine, vLine, label, numLabel, path, rect, fnPath, fnArea, strip, arrowDefs, bracket } from '../core/plot.js';
import { range } from '../core/dom.js';
import { formula, t, frac, sqrt, sub, sup, bar, sumOver, paren, nMinus1, eq, minus, op } from '../core/fx.js';

/* Cushny & Peebles' sleep data — the numbers Student used in the 1908 paper
   that introduced the t distribution. Extra hours of sleep, 10 patients, two
   drugs. Crucially: the same ten patients took both. */
const A = [0.7, -1.6, -0.2, -1.2, -0.1, 3.4, 3.7, 0.8, 0.0, 2.0];
const B = [1.9, 0.8, 1.1, 0.1, -0.1, 4.4, 5.5, 1.6, 4.6, 3.4];

const F = () => frame({ w: 720, h: 540, l: 66, r: 28, t: 34, b: 58 });

function G(s) {
  const spread = s.spreadB;
  const mb = st.mean(B);
  const b = B.map(v => mb + (v - mb) * spread);
  const a = A.slice(0, s.n), bb = b.slice(0, s.n);
  return {
    a, b: bb,
    res: st.tTestTwoSample(bb, a, { welch: s.welch }),
    paired: st.tTestPaired(b.slice(0, s.n), A.slice(0, s.n)),
  };
}

const XA = 250, XB = 470;

function groupsFrame(g) {
  const f = F();
  const all = [...g.a, ...g.b];
  f.setY(Math.min(...all) - 1, Math.max(...all) + 1);
  f.setX(0, 720);
  return f;
}

function dots(f, g, { showMeans = true, opacity = 1 } = {}) {
  const ma = st.mean(g.a), mb = st.mean(g.b);
  return [
    ...strip(f, g.a, XA, { key: 'a', cls: 'pt pt-cold', r: 7, seed: 3, stagger: 45, opacity, tip: (v, i) => `patient ${i + 1} · drug 1<br><b>${v.toFixed(1)}</b> extra hours` }),
    ...strip(f, g.b, XB, { key: 'b', cls: 'pt pt-warm', r: 7, seed: 9, stagger: 45, opacity, tip: (v, i) => `patient ${i + 1} · drug 2<br><b>${v.toFixed(1)}</b> extra hours` }),
    label('la', XA, f.y0 + 22, 'drug 1', { cls: 'ax-label lab-mid' }),
    label('lb', XB, f.y0 + 22, 'drug 2', { cls: 'ax-label lab-mid' }),
    ...(showMeans ? [
      { key: 'mla', tag: 'line', cls: 'rule-y', attrs: { x1: XA - 62, y1: f.sy(ma), x2: XA + 62, y2: f.sy(ma) } },
      { key: 'mlb', tag: 'line', cls: 'rule-x', attrs: { x1: XB - 62, y1: f.sy(mb), x2: XB + 62, y2: f.sy(mb) } },
      numLabel('mva', XA - 70, f.sy(ma) + 4, ma, { cls: 'lab lab-cold lab-end', d: 2 }),
      numLabel('mvb', XB + 70, f.sy(mb) + 4, mb, { cls: 'lab lab-warm', d: 2 }),
    ] : []),
  ];
}

export default {
  meta: {
    id: 'ttest', title: 't-tests', kicker: 'DIFFERENCE OF MEANS',
    status: 'live',
    deck: 'A t-test is one fraction. On top: the gap between two averages. On the bottom: how big a gap pure noise would have handed you anyway. Everything else — pooled variance, Welch, pairing — is an argument about the bottom half.',
    dataNote: 'Data: Cushny & Peebles\' soporific trial, the dataset <em>Student</em> used in the 1908 paper that introduced the t distribution. Ten patients each took two drugs; the numbers are extra hours of sleep relative to no drug. R ships it as <code>sleep</code>.',
    deps: ['correlation'], unlocks: ['anova'],
    next: 'anova', nextLabel: 'one-way anova',
    outro: 'one fraction, three ways of arguing about the denominator.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { n: 10, welch: false, spreadB: 1, paired: false, showNull: true },

  steps: [
    {
      title: 'two groups, one question',
      prose: `<p>Ten patients. Two drugs. For each patient we know how many extra hours of sleep each drug bought them.</p>
        <p>Drug 2 looks better. But <em>looks better</em> is not a finding — with ten people and this much scatter, you could see a gap like that by luck. The whole job of a t-test is to put a number on how easily luck could have done it.</p>`,
      readouts: [
        { key: 'ma', label: 'mean drug 1', tone: 'cold', get: s => st.mean(G(s).a), d: 3, wide: true },
        { key: 'mb', label: 'mean drug 2', tone: 'warm', get: s => st.mean(G(s).b), d: 3, wide: true },
        { key: 'd', label: 'gap', tone: 'gold', get: s => G(s).res.diff, d: 3 },
      ],
      beats: [
        {
          label: 'the raw numbers',
          note: 'Twenty numbers. Each dot is one patient on one drug.',
          scene: s => {
            const g = G(s), f = groupsFrame(g);
            return [
              ...axes(f, { yLabel: 'extra hours of sleep', showX: false, xN: 0 }),
              hLine(f, 0, { key: 'zero', cls: 'rule-faint rule-dash' }),
              label('z', 70, f.sy(0) - 8, 'no effect', { cls: 'lab-sm' }),
              ...dots(f, g, { showMeans: false }),
            ];
          },
        },
        {
          label: 'average each column',
          note: 'The same mean calculation from the correlation lesson, run twice.',
          scene: s => {
            const g = G(s), f = groupsFrame(g);
            return [
              ...axes(f, { yLabel: 'extra hours of sleep', showX: false, xN: 0 }),
              hLine(f, 0, { key: 'zero', cls: 'rule-faint rule-dash' }),
              ...dots(f, g),
            ];
          },
        },
        {
          label: 'the gap',
          note: 'The distance between the two lines is the entire top half of the t statistic.',
          scene: s => {
            const g = G(s), f = groupsFrame(g);
            const ma = st.mean(g.a), mb = st.mean(g.b);
            return [
              ...axes(f, { yLabel: 'extra hours of sleep', showX: false, xN: 0 }),
              ...dots(f, g),
              bracket('br', 620, f.sy(ma), f.sy(mb), { cls: 'brace', width: 12 }),
              numLabel('gap', 634, (f.sy(ma) + f.sy(mb)) / 2 + 4, mb - ma, {
                cls: 'lab-big lab-gold', d: 2, pre: 'gap = ',
              }),
            ];
          },
        },
      ],
    },

    {
      title: 'the denominator: how much would this wobble?',
      prose: `<p>Suppose you ran the trial again with ten different patients. You would not get the same gap. So the question is: <strong>how much does a mean bounce around from sample to sample?</strong></p>
        <p>The answer comes from the spread we already know how to compute. Take the variance within a group, divide it by n, take the root. That's the <strong>standard error of the mean</strong> — and the √n is why bigger samples give steadier answers.</p>`,
      formula: formula(
        `${t('SE', { tone: 'gold', explain: 'The standard error: the typical wobble of the statistic, not of the data.' })} ${eq} ` +
        sqrt(frac(t(sup('s', '2') + sub('', '1'), { explain: 'Variance inside group 1.', tone: 'cold' }), t(sub('n', '1'), { tone: 'muted' })) +
          ' + ' + frac(t(sup('s', '2') + sub('', '2'), { explain: 'Variance inside group 2.', tone: 'warm' }), t(sub('n', '2'), { tone: 'muted' }))),
        { caption: 'spread of the data ÷ how much data — the wobble of the gap' }),
      aside: `<b>Standard deviation vs standard error.</b> The standard deviation describes the <i>patients</i>: how differently people respond. The standard error describes the <i>average</i>: how much your estimate of the group mean would move if you ran the study again. Collecting more patients does nothing to the first and shrinks the second.`,
      readouts: [
        { key: 'sa', label: 's₁', tone: 'cold', get: s => Math.sqrt(G(s).res.va), d: 3 },
        { key: 'sb', label: 's₂', tone: 'warm', get: s => Math.sqrt(G(s).res.vb), d: 3 },
        { key: 'n', label: 'n each', get: s => s.n, d: 0 },
        { key: 'se', label: 'SE of gap', tone: 'gold', get: s => G(s).res.se, d: 3, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'n', label: 'patients per group', min: 3, max: 10, step: 1, fast: true },
        { type: 'slider', key: 'spreadB', label: 'stretch drug 2\'s spread', min: 0.4, max: 3, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) + '×' },
      ],
      beats: [
        {
          label: 'spread inside each group',
          note: 'Deviations from each group\'s own mean — squared and averaged, exactly as before.',
          scene: s => {
            const g = G(s), f = groupsFrame(g);
            const ma = st.mean(g.a), mb = st.mean(g.b);
            const sa = Math.sqrt(g.res.va), sb = Math.sqrt(g.res.vb);
            return [
              ...axes(f, { yLabel: 'extra hours of sleep', showX: false, xN: 0 }),
              rect('ba', XA - 62, f.sy(ma + sa), 124, f.sy(ma - sa) - f.sy(ma + sa), { cls: 'sq sq-neg' }),
              rect('bb', XB - 62, f.sy(mb + sb), 124, f.sy(mb - sb) - f.sy(mb + sb), { cls: 'sq sq-pos' }),
              ...dots(f, g),
              label('sa', XA, f.sy(ma + sa) - 10, `± s = ${sa.toFixed(2)}`, { cls: 'lab-sm lab-mid lab-cold' }),
              label('sb', XB, f.sy(mb + sb) - 10, `± s = ${sb.toFixed(2)}`, { cls: 'lab-sm lab-mid lab-warm' }),
            ];
          },
        },
        {
          label: 'shrink by √n',
          note: 'The mean wobbles far less than the patients do. Slide the sample size and watch the narrow band close in.',
          scene: s => {
            const g = G(s), f = groupsFrame(g);
            const ma = st.mean(g.a), mb = st.mean(g.b);
            const sea = Math.sqrt(g.res.va / g.a.length), seb = Math.sqrt(g.res.vb / g.b.length);
            const sa = Math.sqrt(g.res.va), sb = Math.sqrt(g.res.vb);
            return [
              ...axes(f, { yLabel: 'extra hours of sleep', showX: false, xN: 0 }),
              rect('ba', XA - 62, f.sy(ma + sa), 124, f.sy(ma - sa) - f.sy(ma + sa), { cls: 'sq sq-neg', opacity: 0.4 }),
              rect('bb', XB - 62, f.sy(mb + sb), 124, f.sy(mb - sb) - f.sy(mb + sb), { cls: 'sq sq-pos', opacity: 0.4 }),
              rect('sea', XA - 30, f.sy(ma + sea), 60, f.sy(ma - sea) - f.sy(ma + sea), { cls: 'sq sq-x', dur: 300 }),
              rect('seb', XB - 30, f.sy(mb + seb), 60, f.sy(mb - seb) - f.sy(mb + seb), { cls: 'sq sq-x', dur: 300 }),
              ...dots(f, g),
              label('cap', 360, f.y1 + 6, 'wide band = spread of patients · narrow band = wobble of the mean', { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
      ],
    },

    {
      title: 'divide one by the other',
      prose: `<p>Now the whole test. Take the gap. Divide it by the wobble. The answer is in units of "standard errors" — a signal-to-noise ratio.</p>
        <p>t = 1 means the gap is exactly the size you would routinely get from noise. t = 4 means the gap is four times bigger than noise usually manages. That is all t is.</p>`,
      formula: formula(
        `${t('t', { tone: 'gold', explain: 'The test statistic.' })} ${eq} ` +
        frac(t(bar('x') + sub('', '2'), { tone: 'warm' }) + minus + t(bar('x') + sub('', '1'), { tone: 'cold' }),
          t('SE', { tone: 'gold', explain: 'The wobble we just built.', link: 'se' })),
        { caption: 'signal ÷ noise' }),
      readouts: [
        { key: 'diff', label: 'gap', tone: 'gold', get: s => G(s).res.diff, d: 3 },
        { key: 'se', label: 'SE', get: s => G(s).res.se, d: 3 },
        { key: 't', label: 't', tone: 'warm', get: s => G(s).res.t, d: 3 },
        { key: 'df', label: 'df', get: s => G(s).res.df, d: 1 },
        { key: 'p', label: 'p', tone: 'gold', wide: true, get: s => G(s).res.p, fmt: st.fmtP },
      ],
      controls: [
        { type: 'slider', key: 'n', label: 'patients per group', min: 3, max: 10, step: 1, fast: true },
        { type: 'slider', key: 'spreadB', label: 'stretch drug 2\'s spread', min: 0.4, max: 3, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) + '×' },
      ],
      beats: [
        {
          label: 'measure the gap in SE units',
          note: 'Stack standard errors between the two means until you reach the other one. How many fit is <b>t</b>.',
          scene: s => {
            const g = G(s), f = groupsFrame(g);
            const ma = st.mean(g.a), mb = st.mean(g.b);
            const se = g.res.se;
            const steps = Math.min(14, Math.max(1, Math.ceil(Math.abs(g.res.t))));
            const marks = range(steps + 1).map(i => {
              const yv = ma + Math.sign(g.res.t) * i * se;
              return {
                key: `tick-${i}`, tag: 'line', cls: 'rule-gold', delay: i * 120,
                attrs: { x1: 600, y1: f.sy(yv), x2: 640, y2: f.sy(yv) },
              };
            });
            return [
              ...axes(f, { yLabel: 'extra hours of sleep', showX: false, xN: 0 }),
              ...dots(f, g),
              { key: 'ruler', tag: 'line', cls: 'rule-gold', attrs: { x1: 620, y1: f.sy(ma), x2: 620, y2: f.sy(mb) } },
              ...marks,
              numLabel('tv', 650, (f.sy(ma) + f.sy(mb)) / 2, g.res.t, { cls: 'lab-big lab-gold', d: 2, pre: 't = ' }),
              label('cap', 650, (f.sy(ma) + f.sy(mb)) / 2 + 18, 'standard errors', { cls: 'lab-sm' }),
            ];
          },
        },
        {
          label: 'against the null',
          hold: 1600,
          note: 'The curve is what t looks like when the two drugs are identical. The shaded tails are how often noise alone beats what we saw.',
          scene: s => {
            const g = G(s), df = Math.max(1, g.res.df);
            const tv = g.res.t, at = Math.abs(tv);
            const f = F();
            const lim = Math.max(5, at * 1.25);
            f.setX(-lim, lim); f.setY(0, st.tPdf(0, df) * 1.2);
            return [
              ...axes(f, { xLabel: 't', yLabel: 'density', yN: 4 }),
              fnArea(f, x => st.tPdf(x, df), at, lim, { key: 'u', cls: 'area area-warm', base: 0 }),
              fnArea(f, x => st.tPdf(x, df), -lim, -at, { key: 'l', cls: 'area area-warm', base: 0 }),
              fnPath(f, x => st.tPdf(x, df), { key: 'c', cls: 'curve', n: 220 }),
              vLine(f, tv, { key: 'tv', cls: 'rule-gold' }),
              label('pl', f.midX, f.y1 + 4, `t = ${tv.toFixed(2)} · df = ${df.toFixed(1)} · p = ${st.fmtP(g.res.p)}`, { cls: 'lab-big lab-mid lab-gold' }),
            ];
          },
        },
      ],
    },

    {
      title: 'what if the two spreads are different?',
      prose: `<p>The classic Student t-test assumes both groups have the same underlying variance, and <em>pools</em> them into one estimate. When that assumption holds, pooling buys you a little extra precision.</p>
        <p>When it doesn't, pooling quietly lies. <strong>Welch's correction</strong> refuses to pool: it keeps the two variances separate and pays for it with a fractional, shrunken degrees of freedom.</p>
        <p><strong>Stretch drug 2's spread and toggle between them.</strong> With equal spreads the two tests agree almost exactly. As the spreads diverge, the pooled version keeps reporting a smaller p than it has earned.</p>`,
      formula: formula(
        t('pooled', { tone: 'cold' }) + ': ' + sup('s', '2') + sub('', 'p') + eq +
        frac('(n₁−1)s₁² + (n₂−1)s₂²', 'n₁ + n₂ − 2') +
        op('&nbsp;&nbsp;&nbsp;') + t('Welch', { tone: 'warm' }) + ': df ' + eq +
        frac(paren('s₁²/n₁ + s₂²/n₂') + sup('', '2'), frac('(s₁²/n₁)²', 'n₁−1') + ' + ' + frac('(s₂²/n₂)²', 'n₂−1')),
        { size: 'sm', caption: 'one assumes the spreads match; the other buys its way out with degrees of freedom' }),
      aside: `<b>Which should you use?</b> Welch, almost always. It costs you very little when the variances really are equal, and it saves you from a badly wrong answer when they are not. Most statistical software has quietly made it the default for exactly this reason.`,
      readouts: [
        { key: 'sa', label: 's₁', tone: 'cold', get: s => Math.sqrt(G(s).res.va), d: 2 },
        { key: 'sb', label: 's₂', tone: 'warm', get: s => Math.sqrt(G(s).res.vb), d: 2 },
        { key: 'tp', label: 't pooled', tone: 'cold', get: s => st.tTestTwoSample(G(s).b, G(s).a, { welch: false }).t, d: 3, wide: true },
        { key: 'tw', label: 't Welch', tone: 'warm', get: s => st.tTestTwoSample(G(s).b, G(s).a, { welch: true }).t, d: 3, wide: true },
        { key: 'pp', label: 'p pooled', tone: 'cold', get: s => st.tTestTwoSample(G(s).b, G(s).a, { welch: false }).p, fmt: st.fmtP, wide: true },
        { key: 'pw', label: 'p Welch', tone: 'warm', get: s => st.tTestTwoSample(G(s).b, G(s).a, { welch: true }).p, fmt: st.fmtP, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'spreadB', label: 'stretch drug 2\'s spread', min: 0.4, max: 4, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) + '×' },
        { type: 'segment', key: 'welch', label: 'test', options: [{ value: false, label: 'pooled (Student)' }, { value: true, label: 'unequal (Welch)' }], },
      ],
      beats: [
        {
          label: 'two curves, two answers',
          note: 'Both tests use nearly the same t. They disagree about <b>df</b> — and df is what sets how fat the tails are.',
          scene: s => {
            const g = G(s);
            const rp = st.tTestTwoSample(g.b, g.a, { welch: false });
            const rw = st.tTestTwoSample(g.b, g.a, { welch: true });
            const f = F();
            const lim = Math.max(5, Math.abs(rw.t) * 1.3);
            f.setX(-lim, lim); f.setY(0, st.tPdf(0, Math.max(rp.df, rw.df)) * 1.25);
            return [
              ...axes(f, { xLabel: 't', yLabel: 'density', yN: 4 }),
              fnPath(f, x => st.tPdf(x, rp.df), { key: 'cp', cls: 'curve curve-cold', n: 200 }),
              fnPath(f, x => st.tPdf(x, rw.df), { key: 'cw', cls: 'curve curve-warm', n: 200 }),
              vLine(f, rp.t, { key: 'tp', cls: 'rule-faint rule-dash' }),
              vLine(f, rw.t, { key: 'tw', cls: 'rule-gold' }),
              label('lp', f.x1 - 6, f.y1 + 14, `pooled: df = ${rp.df.toFixed(1)}, p = ${st.fmtP(rp.p)}`, { cls: 'lab lab-cold lab-end' }),
              label('lw', f.x1 - 6, f.y1 + 32, `Welch: df = ${rw.df.toFixed(1)}, p = ${st.fmtP(rw.p)}`, { cls: 'lab lab-warm lab-end' }),
              label('note', f.midX, f.y0 - 14,
                Math.abs(rp.p - rw.p) < 0.005 ? 'the two agree — the spreads are close enough' : 'they now disagree — pooling is claiming precision it does not have',
                { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
      ],
    },

    {
      title: 'the same ten people took both drugs',
      prose: `<p>Here is the thing everyone misses about this famous dataset: it isn't two independent groups at all. <strong>Every patient appears twice.</strong></p>
        <p>That changes everything, because a huge share of the scatter is just <em>people differ</em> — patient 7 sleeps a lot more on both drugs than patient 5 does. If you treat the groups as independent, all that between-person variation lands in your noise estimate and drowns the signal.</p>
        <p>Pairing removes it. Subtract each patient from themselves, and you're left with ten differences that contain only the thing you care about. Same data. Same gap. Far less noise.</p>`,
      formula: formula(
        `${t(sub('d', 'i'), { tone: 'green', explain: 'One patient\'s difference: their drug 2 result minus their drug 1 result.' })} ${eq} ` +
        sub('y', 'i') + minus + sub('x', 'i') +
        op('&nbsp;&nbsp;→&nbsp;&nbsp;') + 't ' + eq + frac(bar('d'), t(sub('s', 'd'), { tone: 'green' }) + '/' + sqrt('n')),
        { caption: 'a two-sample test, collapsed into a one-sample test on the differences' }),
      aside: `<b>Why this is the whole argument for within-subject designs.</b> Pairing doesn't make the effect bigger — the gap is identical. It makes the <i>noise</i> smaller, by deleting a source of variation you were never interested in. That's why the same experiment run within people needs a fraction of the sample size.`,
      readouts: [
        { key: 'ti', label: 't independent', tone: 'cold', get: s => st.tTestTwoSample(G(s).b, G(s).a, { welch: true }).t, d: 2, wide: true },
        { key: 'tp', label: 't paired', tone: 'green', get: s => G(s).paired.t, d: 2, wide: true },
        { key: 'pi', label: 'p independent', tone: 'cold', get: s => st.tTestTwoSample(G(s).b, G(s).a, { welch: true }).p, fmt: st.fmtP, wide: true },
        { key: 'pp', label: 'p paired', tone: 'green', get: s => G(s).paired.p, fmt: st.fmtP, wide: true },
      ],
      controls: [{ type: 'slider', key: 'n', label: 'patients', min: 3, max: 10, step: 1, fast: true }],
      beats: [
        {
          label: 'join each patient to themselves',
          note: 'Every line is one person. Notice that almost all of them slope the same way — that consistency is invisible to an independent-groups test.',
          scene: s => {
            const g = G(s), f = groupsFrame(g);
            return [
              ...axes(f, { yLabel: 'extra hours of sleep', showX: false, xN: 0 }),
              hLine(f, 0, { key: 'zero', cls: 'rule-faint rule-dash' }),
              ...g.a.map((v, i) => path(`ln-${i}`, [[XA, f.sy(v)], [XB, f.sy(g.b[i])]], {
                cls: g.b[i] >= v ? 'curve curve-warm' : 'curve curve-cold', delay: i * 100,
                set: { 'stroke-width': 1.4 }, opacity: 0.8,
              })),
              ...dots(f, g, { showMeans: false }),
            ];
          },
        },
        {
          label: 'collapse to differences',
          hold: 1600,
          note: 'Ten numbers now, one per patient. Between-person variation is gone; only the within-person effect is left.',
          scene: s => {
            const g = G(s);
            const d = g.paired.d;
            const f = F();
            f.setY(Math.min(0, ...d) - 1, Math.max(...d) + 1);
            f.setX(0, 720);
            const md = st.mean(d);
            return [
              ...axes(f, { yLabel: 'drug 2 − drug 1, per patient', showX: false, xN: 0 }),
              hLine(f, 0, { key: 'zero', cls: 'rule-faint rule-dash' }),
              label('z', 74, f.sy(0) - 8, 'no difference', { cls: 'lab-sm' }),
              ...strip(f, d, 360, { key: 'd', cls: 'pt pt-green', r: 8, jitter: 60, seed: 5, stagger: 70, tip: (v, i) => `patient ${i + 1}: <b>${v.toFixed(1)}</b> hours better` }),
              { key: 'md', tag: 'line', cls: 'rule-gold', attrs: { x1: 250, y1: f.sy(md), x2: 470, y2: f.sy(md) } },
              numLabel('mdv', 486, f.sy(md) + 4, md, { cls: 'lab-big lab-gold', d: 2, pre: 'd̄ = ' }),
              rect('sed', 300, f.sy(md + g.paired.se), 120, f.sy(md - g.paired.se) - f.sy(md + g.paired.se), { cls: 'sq sq-x' }),
              label('sel', 360, f.sy(md + g.paired.se) - 10, `± SE = ${g.paired.se.toFixed(3)}`, { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
        {
          label: 'the payoff',
          note: 'Same gap. Same ten people. The paired test finds it far more convincingly, purely by refusing to count irrelevant noise.',
          scene: s => {
            const g = G(s);
            const ind = st.tTestTwoSample(g.b, g.a, { welch: true });
            const pr = g.paired;
            const f = F();
            const lim = Math.max(6, Math.abs(pr.t) * 1.2);
            f.setX(-lim, lim); f.setY(0, st.tPdf(0, pr.df) * 1.2);
            return [
              ...axes(f, { xLabel: 't', yLabel: 'density', yN: 4 }),
              fnArea(f, x => st.tPdf(x, pr.df), Math.abs(pr.t), lim, { key: 'ua', cls: 'area area-green', base: 0 }),
              fnPath(f, x => st.tPdf(x, pr.df), { key: 'c', cls: 'curve', n: 220 }),
              vLine(f, ind.t, { key: 'ti', cls: 'rule-faint rule-dash' }),
              vLine(f, pr.t, { key: 'tp', cls: 'rule-gold' }),
              label('li', f.sx(ind.t), f.y1 + 16, `independent: t = ${ind.t.toFixed(2)}`, { cls: 'lab-sm lab-mid lab-cold' }),
              label('lp', f.sx(pr.t), f.y1 + 34, `paired: t = ${pr.t.toFixed(2)}`, { cls: 'lab-sm lab-mid lab-green' }),
              label('pp', f.midX, f.y0 - 12, `p goes from ${st.fmtP(ind.p)} to ${st.fmtP(pr.p)}`, { cls: 'lab-big lab-mid lab-green' }),
            ];
          },
        },
      ],
    },

    {
      title: 'report the interval, not just the verdict',
      prose: `<p>"Significant" tells you the gap probably isn't zero. It doesn't tell you whether the drug buys you three minutes or three hours — and that's the part a patient cares about.</p>
        <p>The interval is built exactly like the t-test, run backwards: instead of asking how many standard errors from zero we are, we step out a critical number of standard errors on either side of the observed gap.</p>`,
      formula: formula(
        'CI ' + eq + ' ' + paren(bar('x') + sub('', '2') + minus + bar('x') + sub('', '1')) + ' ± ' +
        t('t*', { tone: 'gold', explain: 'The critical t for your df — about 2.1 for df = 18, more for smaller samples.' }) +
        ' · ' + t('SE', { tone: 'gold' }),
        { caption: 'same ingredients, rearranged into a range' }),
      readouts: [
        { key: 'diff', label: 'gap', tone: 'gold', get: s => G(s).paired.md, d: 3 },
        { key: 'lo', label: 'lower', tone: 'cold', get: s => G(s).paired.ci[0], d: 3 },
        { key: 'hi', label: 'upper', tone: 'warm', get: s => G(s).paired.ci[1], d: 3 },
        { key: 'd', label: "Cohen's d", tone: 'green', get: s => G(s).res.d, d: 2, explain: 'The gap expressed in standard deviations — an effect size that does not care about sample size.' },
      ],
      controls: [{ type: 'slider', key: 'n', label: 'patients', min: 3, max: 10, step: 1, fast: true }],
      beats: [
        {
          label: 'both intervals',
          note: 'Whenever an interval clears zero, the test would have called it significant. They are the same statement.',
          scene: s => {
            const g = G(s);
            const ind = st.tTestTwoSample(g.b, g.a, { welch: true });
            const pr = g.paired;
            const f = F();
            const lim = Math.max(3, Math.abs(ind.ci[0]), Math.abs(ind.ci[1])) * 1.15;
            f.setX(-lim, lim); f.setY(0, 1);
            const rowInd = f.y1 + 150, rowPr = f.y1 + 280;
            const bar_ = (key, ci, est, y, cls, name) => [
              { key: key + 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: y, x2: f.x1, y2: y } },
              rect(key + 'ci', f.sx(ci[0]), y - 14, f.sx(ci[1]) - f.sx(ci[0]), 28, { cls }),
              { key: key + 'pt', tag: 'circle', cls: 'pt pt-green', attrs: { cx: f.sx(est), cy: y, r: 7 } },
              label(key + 'n', f.x0, y - 28, name, { cls: 'lab' }),
              label(key + 'lo', f.sx(ci[0]), y + 26, ci[0].toFixed(2), { cls: 'lab-sm lab-mid lab-cold' }),
              label(key + 'hi', f.sx(ci[1]), y + 26, ci[1].toFixed(2), { cls: 'lab-sm lab-mid lab-warm' }),
            ];
            return [
              ...axes(f, { xLabel: 'extra hours of sleep from drug 2 over drug 1', showY: false, grid: false }),
              vLine(f, 0, { key: 'z', cls: 'rule-gold rule-dash' }),
              label('zl', f.sx(0), f.y1 + 90, 'no difference', { cls: 'lab-sm lab-mid lab-gold' }),
              ...bar_('i', ind.ci, ind.diff, rowInd, 'sq sq-neg', 'treated as independent groups'),
              ...bar_('p', pr.ci, pr.md, rowPr, 'sq sq-pos', 'paired — the correct analysis here'),
            ];
          },
        },
      ],
    },
  ],
};
