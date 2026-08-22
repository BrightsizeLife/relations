/* ─────────────────────────────────────────────────────────────────────────────
   mutualinfo.js — how much knowing one thing tells you about another, measured
   in bits. Correlation's stranger, more general cousin: it does not care
   whether the relationship is a straight line.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, arrowDefs } from '../core/plot.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sub, sup, sumOver, paren, eq, minus, op } from '../core/fx.js';

const F = () => frame({ w: 720, h: 540, l: 66, r: 28, t: 34, b: 58 });
const log2 = x => Math.log(x) / Math.LN2;
const XL = ['rain', 'no rain'];
const YL = ['late', 'on time'];

/** the 2×2 joint table, from the three sliders, as counts out of 1000 */
function joint(s) {
  const pRain = s.pRain / 100;
  const pLateRain = s.pLateRain / 100;
  const pLateDry = s.pLateDry / 100;
  return [
    [pRain * pLateRain, pRain * (1 - pLateRain)],
    [(1 - pRain) * pLateDry, (1 - pRain) * (1 - pLateDry)],
  ];
}

const rowSums = J => J.map(r => st.sum(r));
const colSums = J => J[0].map((_, j) => st.sum(J.map(r => r[j])));

const Hof = ps => st.sum(ps.map(p => (p <= 0 ? 0 : -p * log2(p))));

function info(s) {
  const J = joint(s);
  const px = rowSums(J), py = colSums(J);
  const Hx = Hof(px), Hy = Hof(py);
  const Hxy = Hof(J.flat());
  const MI = Hx + Hy - Hxy;
  return { J, px, py, Hx, Hy, Hxy, MI, HyGx: Hxy - Hx, HxGy: Hxy - Hy };
}

/* geometry for the Venn-style entropy bars */
const BX = 90, BW = 540, BY = 150, BH = 46;

export default {
  meta: {
    id: 'mutualinfo', title: 'mutual information', kicker: 'SHARED BITS',
    status: 'live',
    deck: 'Correlation asks whether two things move together along a straight line. Mutual information asks a blunter question: <em>how many bits does knowing one save you when guessing the other?</em> It catches relationships r cannot see, and it costs you the ability to say which direction they go.',
    dataNote: 'A 2×2 world — rain or not, train late or not — with the joint distribution under your control, so you can build dependence and independence by hand. The final step uses <em>simulated</em> data to compare against correlation on shapes r is known to miss.',
    deps: ['entropy'], unlocks: [],
    next: 'decisiontree', nextLabel: 'decision trees',
    outro: 'the overlap between two uncertainties, measured in bits.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { pRain: 30, pLateRain: 70, pLateDry: 20, shape: 'linear' },

  steps: [
    {
      title: 'two uncertainties',
      prose: `<p>Two things you don't know: whether it will rain, and whether your train will be late. Each has its own entropy — its own amount of not-knowing, measured in bits.</p>
        <p>The question is whether those two piles of uncertainty <em>overlap</em>. If learning about the rain would shrink your uncertainty about the train, then some of the same information is doing double duty.</p>`,
      formula: formula(
        t('H(X)', { tone: 'cyan' }) + op('&nbsp;&nbsp;and&nbsp;&nbsp;') + t('H(Y)', { tone: 'purple' }) +
        op('&nbsp;&nbsp;—&nbsp;&nbsp;') + t('two separate amounts of not-knowing', { cls: 'fx-muted' }),
        { size: 'sm', caption: 'each measured on its own, ignoring the other' }),
      readouts: [
        { key: 'hx', label: 'H(rain)', tone: 'cyan', get: s => info(s).Hx, d: 3, suf: ' bits', wide: true },
        { key: 'hy', label: 'H(late)', tone: 'purple', get: s => info(s).Hy, d: 3, suf: ' bits', wide: true },
        { key: 'hxy', label: 'H(both)', tone: 'gold', get: s => info(s).Hxy, d: 3, suf: ' bits', wide: true },
      ],
      controls: [
        { type: 'slider', key: 'pRain', label: 'chance of rain', min: 2, max: 98, step: 1, fast: true, fmt: v => v + '%' },
        { type: 'slider', key: 'pLateRain', label: 'late | rain', min: 0, max: 100, step: 1, fast: true, fmt: v => v + '%' },
        { type: 'slider', key: 'pLateDry', label: 'late | dry', min: 0, max: 100, step: 1, fast: true, fmt: v => v + '%' },
      ],
      beats: [
        {
          label: 'the joint table',
          note: 'Four cells, summing to 1. Everything on this page is computed from these four numbers.',
          scene: s => {
            const I = info(s);
            const cw = 180, ch = 92, x0 = 220, y0 = 160;
            const items = [
              label('t', 360, 90, 'the joint distribution', { cls: 'lab-big lab-mid' }),
              ...YL.map((l, j) => label(`ch-${j}`, x0 + cw / 2 + j * cw, y0 - 14, l, { cls: 'lab lab-mid lab-purple' })),
              ...XL.map((l, i) => label(`rh-${i}`, x0 - 14, y0 + ch / 2 + i * ch + 5, l, { cls: 'lab lab-end lab-cyan' })),
            ];
            I.J.forEach((row, i) => row.forEach((v, j) => {
              items.push(rect(`c-${i}-${j}`, x0 + j * cw, y0 + i * ch, cw - 4, ch - 4, {
                cls: 'sq sq-x', opacity: 0.25 + 0.75 * v * 2, dur: 220,
                tip: `${XL[i]} & ${YL[j]}<br><b>${(v * 100).toFixed(1)}%</b> of days`,
              }));
              items.push(numLabel(`v-${i}-${j}`, x0 + j * cw + cw / 2 - 2, y0 + i * ch + ch / 2 + 6, v, {
                cls: 'lab-big lab-mid', d: 3, dur: 220,
              }));
            }));
            I.px.forEach((v, i) => items.push(numLabel(`rs-${i}`, x0 + 2 * cw + 26, y0 + i * ch + ch / 2 + 6, v, { cls: 'lab lab-cyan', d: 3, dur: 220 })));
            I.py.forEach((v, j) => items.push(numLabel(`cs-${j}`, x0 + j * cw + cw / 2 - 2, y0 + 2 * ch + 24, v, { cls: 'lab lab-mid lab-purple', d: 3, dur: 220 })));
            items.push(label('m1', x0 + 2 * cw + 26, y0 - 14, 'rain?', { cls: 'lab-sm lab-cyan' }));
            items.push(label('m2', x0 - 14, y0 + 2 * ch + 24, 'late?', { cls: 'lab-sm lab-end lab-purple' }));
            return items;
          },
        },
        {
          label: 'each one alone',
          note: 'Collapse the table one way and you get the entropy of rain. Collapse it the other way and you get the entropy of lateness.',
          scene: s => {
            const I = info(s);
            return [
              label('t', 360, 80, 'two separate uncertainties', { cls: 'lab-big lab-mid' }),
              rect('hx-bg', BX, BY, BW, BH, { cls: 'cell' }),
              rect('hx', BX, BY, BW * I.Hx, BH, { cls: 'sq sq-x', dur: 240 }),
              label('hx-l', BX, BY - 12, 'H(rain)', { cls: 'lab lab-cyan' }),
              numLabel('hx-v', BX + BW + 14, BY + 30, I.Hx, { cls: 'lab-big lab-cyan', d: 3, dur: 240 }),
              rect('hy-bg', BX, BY + 120, BW, BH, { cls: 'cell' }),
              rect('hy', BX, BY + 120, BW * I.Hy, BH, { cls: 'sq sq-y', dur: 240 }),
              label('hy-l', BX, BY + 108, 'H(late)', { cls: 'lab lab-purple' }),
              numLabel('hy-v', BX + BW + 14, BY + 150, I.Hy, { cls: 'lab-big lab-purple', d: 3, dur: 240 }),
              label('sc', BX + BW, BY + 210, '1 bit', { cls: 'lab-sm lab-end' }),
              label('note', 360, 400, 'a full bit means a coin flip — total uncertainty about that one thing', { cls: 'lab lab-mid' }),
            ];
          },
        },
      ],
    },

    {
      title: 'condition, and watch one shrink',
      prose: `<p>Now suppose someone tells you it's raining. Your uncertainty about the train doesn't vanish — but if rain matters at all, it gets <strong>smaller</strong>.</p>
        <p>H(Y | X) is what's left of your uncertainty about the train after you've been told the weather. It is the entropy of each column, averaged by how often that column occurs.</p>
        <p><strong>Pull the two conditional sliders apart</strong> and watch the leftover uncertainty shrink. Set them equal and nothing shrinks at all.</p>`,
      formula: formula(
        t('H(Y | X)', { tone: 'gold' }) + eq +
        sumOver('P(x) · H(Y | X = x)', { from: 'x', to: '' }) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('always ≤ H(Y)', { tone: 'green', explain: 'Information never makes you more uncertain on average. Conditioning can only reduce entropy.' }),
        { size: 'sm', caption: 'what is left over once you have been told' }),
      readouts: [
        { key: 'hy', label: 'H(late)', tone: 'purple', get: s => info(s).Hy, d: 3, wide: true },
        { key: 'hyx', label: 'H(late | rain)', tone: 'gold', get: s => info(s).HyGx, d: 3, wide: true },
        { key: 'drop', label: 'uncertainty removed', tone: 'green', get: s => info(s).MI, d: 3, suf: ' bits', wide: true },
      ],
      controls: [
        { type: 'slider', key: 'pLateRain', label: 'late | rain', min: 0, max: 100, step: 1, fast: true, fmt: v => v + '%' },
        { type: 'slider', key: 'pLateDry', label: 'late | dry', min: 0, max: 100, step: 1, fast: true, fmt: v => v + '%' },
        { type: 'slider', key: 'pRain', label: 'chance of rain', min: 2, max: 98, step: 1, fast: true, fmt: v => v + '%' },
      ],
      beats: [
        {
          label: 'before and after',
          note: 'The green slice is the part of your uncertainty that the weather report just removed. <b>That slice is the mutual information.</b>',
          scene: s => {
            const I = info(s);
            const scale = BW / Math.max(1, I.Hy || 1);
            return [
              label('t', 360, 80, 'uncertainty about the train', { cls: 'lab-big lab-mid' }),
              rect('a-bg', BX, BY, BW, BH, { cls: 'cell' }),
              rect('a', BX, BY, BW * (I.Hy / Math.max(I.Hy, 0.001)), BH, { cls: 'sq sq-y', dur: 240 }),
              label('a-l', BX, BY - 12, 'before you know anything: H(Y)', { cls: 'lab lab-purple' }),
              numLabel('a-v', BX + BW + 14, BY + 30, I.Hy, { cls: 'lab-big lab-purple', d: 3, dur: 240 }),

              rect('b-bg', BX, BY + 130, BW, BH, { cls: 'cell' }),
              rect('b', BX, BY + 130, BW * (I.HyGx / Math.max(I.Hy, 0.001)), BH, { cls: 'sq sq-y', dur: 240 }),
              rect('mi', BX + BW * (I.HyGx / Math.max(I.Hy, 0.001)), BY + 130,
                BW * (I.MI / Math.max(I.Hy, 0.001)), BH, { cls: 'sq sq-pos', dur: 240,
                tip: `mutual information: <b>${I.MI.toFixed(3)}</b> bits` }),
              label('b-l', BX, BY + 118, 'after you are told about the rain: H(Y | X)', { cls: 'lab lab-gold' }),
              numLabel('b-v', BX + BW + 14, BY + 160, I.HyGx, { cls: 'lab-big lab-gold', d: 3, dur: 240 }),

              numLabel('mi-v', BX + BW * ((I.HyGx + I.MI / 2) / Math.max(I.Hy, 0.001)), BY + 210, I.MI, {
                cls: 'lab-big lab-mid lab-green', d: 3, pre: 'I(X;Y) = ', suf: ' bits', dur: 240,
              }),
              label('note', 360, 400,
                I.MI < 0.005 ? 'the weather report told you nothing at all'
                  : I.MI > 0.4 ? 'the weather report is doing a lot of work'
                    : 'the weather report helps a little',
                { cls: `lab-big lab-mid ${I.MI < 0.005 ? 'lab-warm' : 'lab-green'}`, dur: 240 }),
            ];
          },
        },
      ],
    },

    {
      title: 'mutual information is the overlap',
      prose: `<p>Three equivalent definitions, and they are worth seeing together because each one makes a different thing obvious.</p>
        <p><strong>I(X;Y) = H(Y) − H(Y|X).</strong> How much uncertainty about Y the knowledge of X removes.<br>
        <strong>I(X;Y) = H(X) + H(Y) − H(X,Y).</strong> The double-counted overlap — the same inclusion–exclusion move as in set theory.<br>
        <strong>I(X;Y) = 0 exactly when X and Y are independent.</strong> No overlap, no shared bits.</p>
        <p>The second form makes the symmetry obvious: X tells you exactly as much about Y as Y tells you about X. Unlike a regression coefficient, mutual information has no direction.</p>`,
      formula: formula(
        t('I(X;Y)', { tone: 'green' }) + eq + t('H(X)', { tone: 'cyan' }) + ' + ' + t('H(Y)', { tone: 'purple' }) + minus + t('H(X,Y)', { tone: 'gold' }) +
        `<br>` + eq +
        sumOver('P(x,y) log' + sub('', '2') + frac('P(x,y)', 'P(x)P(y)'), { from: 'x,y', to: '' }),
        { size: 'sm', caption: 'the overlap of two uncertainties — inclusion–exclusion again' }),
      dep: { note: 'Same double-counting correction as the union rule.', lesson: 'settheory', label: 'set theory' },
      readouts: [
        { key: 'mi', label: 'I(X;Y)', tone: 'green', get: s => info(s).MI, d: 4, suf: ' bits', wide: true },
        { key: 'nmi', label: 'normalised', tone: 'gold', get: s => { const I = info(s); return I.MI / Math.max(1e-9, Math.min(I.Hx, I.Hy)); }, d: 3, wide: true, explain: 'MI divided by the most it could possibly have been. Between 0 and 1, so you can compare across variables of different entropies.' },
        { key: 'g', label: 'G statistic', tone: 'warm', get: s => 2 * 1000 * info(s).MI * Math.LN2, d: 1, wide: true, explain: 'For a sample of n, 2n·I (in nats) is the likelihood-ratio chi-square statistic. Mutual information and the G-test are the same number in different clothes.' },
      ],
      controls: [
        { type: 'slider', key: 'pLateRain', label: 'late | rain', min: 0, max: 100, step: 1, fast: true, fmt: v => v + '%' },
        { type: 'slider', key: 'pLateDry', label: 'late | dry', min: 0, max: 100, step: 1, fast: true, fmt: v => v + '%' },
        { type: 'button', key: 'indep', label: '[make them independent]', action: s => { s.pLateDry = s.pLateRain; } },
      ],
      beats: [
        {
          label: 'the overlap, drawn',
          note: 'Two overlapping bars. The shared middle is the mutual information; the outer parts are what stays private to each variable.',
          scene: s => {
            const I = info(s);
            const total = I.Hxy || 1;
            const k = BW / total;
            const y = 200;
            const xStart = BX;
            const wX = I.Hx * k, wY = I.Hy * k, wM = I.MI * k;
            const yStart = xStart + wX - wM;
            return [
              label('t', 360, 90, 'H(X) and H(Y), overlapping by I(X;Y)', { cls: 'lab-big lab-mid' }),
              rect('bx', xStart, y, wX, BH, { cls: 'sq sq-x', dur: 240, tip: `H(X) = ${I.Hx.toFixed(3)}` }),
              rect('by', yStart, y + BH + 8, wY, BH, { cls: 'sq sq-y', dur: 240, tip: `H(Y) = ${I.Hy.toFixed(3)}` }),
              rect('bm', yStart, y - 34, wM, 26, { cls: 'sq sq-pos', dur: 240, tip: `I(X;Y) = ${I.MI.toFixed(4)}` }),
              label('lx', xStart, y - 44, 'H(X)', { cls: 'lab lab-cyan' }),
              label('ly', yStart + wY, y + 2 * BH + 26, 'H(Y)', { cls: 'lab lab-end lab-purple' }),
              numLabel('lm', yStart + wM / 2, y - 44, I.MI, { cls: 'lab lab-mid lab-green', d: 3, pre: 'shared: ', dur: 240 }),
              { key: 'br', tag: 'line', cls: 'rule-gold', dur: 240, attrs: { x1: xStart, y1: y + 2 * BH + 50, x2: xStart + Math.max(wX, yStart + wY - xStart), y2: y + 2 * BH + 50 } },
              numLabel('lt', (xStart + yStart + wY) / 2, y + 2 * BH + 72, I.Hxy, {
                cls: 'lab lab-mid lab-gold', d: 3, pre: 'H(X,Y) = ', suf: ' — the two together', dur: 240,
              }),
            ];
          },
        },
      ],
    },

    {
      title: 'what it catches that correlation does not',
      prose: `<p>Here's the payoff, and the reason anyone bothers.</p>
        <p>Pearson's r measures how well the points lie on a <em>straight line</em>. Give it a perfect but curved relationship — a parabola, a circle, a sine wave — and it reports something close to zero while a human can see the structure immediately.</p>
        <p>Mutual information doesn't care about shape. It asks whether knowing x narrows down y at all, by any mechanism.</p>
        <p><strong>Step through the shapes.</strong> Watch r collapse to nothing on relationships that are visibly, obviously not random.</p>`,
      aside: `<b>What you give up.</b> Mutual information has no sign and no slope — it will tell you that two things are related and nothing about how. It also needs a lot more data to estimate reliably, and on continuous variables the answer depends on how you bin them. It is a detector, not a description.`,
      readouts: [
        { key: 'r', label: 'Pearson r', tone: 'cold', get: s => { const d = shapeData(s); return st.pearson(d.x, d.y); }, d: 3, fmt: v => st.fmtR(v, 3), wide: true },
        { key: 'rho', label: 'Spearman ρ', tone: 'purple', get: s => { const d = shapeData(s); return st.spearman(d.x, d.y); }, d: 3, fmt: v => st.fmtR(v, 3), wide: true },
        { key: 'mi', label: 'mutual info', tone: 'green', get: s => binnedMI(shapeData(s)), d: 3, suf: ' bits', wide: true },
        { key: 'verd', label: 'verdict', tone: 'gold', wide: true, get: s => {
          const d = shapeData(s);
          const r = Math.abs(st.pearson(d.x, d.y));
          const mi = binnedMI(d);
          if (mi > 0.25 && r < 0.2) return 'r is blind to this';
          if (mi > 0.25) return 'both see it';
          return 'genuinely unrelated';
        } },
      ],
      controls: [
        {
          type: 'segment', key: 'shape', label: 'relationship', options: [
            { value: 'linear', label: 'linear' }, { value: 'parabola', label: 'parabola' },
            { value: 'circle', label: 'ring' }, { value: 'sine', label: 'wave' },
            { value: 'none', label: 'noise' },
          ],
        },
      ],
      beats: [
        {
          label: 'five relationships',
          note: 'Only the first one is a straight line. Every other shape except the noise is <b>strongly</b> structured, and r shrugs at all of them.',
          scene: s => {
            const d = shapeData(s);
            const f = F();
            f.setX(-3.4, 3.4); f.setY(-3.4, 3.4);
            const r = st.pearson(d.x, d.y);
            const mi = binnedMI(d);
            return [
              ...axes(f, { xLabel: 'x', yLabel: 'y' }),
              ...d.x.map((v, i) => ({
                key: `p-${i}`, tag: 'circle', cls: 'pt pt-green', dur: 240,
                attrs: { cx: f.sx(clamp(v, -3.4, 3.4)), cy: f.sy(clamp(d.y[i], -3.4, 3.4)), r: 4 },
                opacity: 0.85,
              })),
              label('lr', f.x0 + 10, f.y1 + 10, `r = ${st.fmtR(r, 3)}`, { cls: 'lab-big lab-cold', dur: 240 }),
              label('lm', f.x0 + 10, f.y1 + 32, `I(X;Y) = ${mi.toFixed(3)} bits`, { cls: 'lab-big lab-green', dur: 240 }),
              label('v', f.midX, f.y0 - 12,
                Math.abs(r) < 0.2 && mi > 0.25 ? 'correlation says nothing is here. it is wrong.'
                  : mi < 0.08 ? 'nothing here, and both agree'
                    : 'a straight line — both measures work',
                { cls: `lab lab-mid ${Math.abs(r) < 0.2 && mi > 0.25 ? 'lab-warm' : ''}`, dur: 240 }),
            ];
          },
        },
      ],
    },
  ],
};

/* ── simulated shapes for the last step ───────────────────────────────────── */

function shapeData(s) {
  const r = st.rng(808);
  const n = 260;
  const x = [], y = [];
  for (let i = 0; i < n; i++) {
    const u = st.randNorm(r);
    const e = st.randNorm(r, 0, 0.28);
    if (s.shape === 'linear') { x.push(u); y.push(0.9 * u + e); }
    else if (s.shape === 'parabola') { x.push(u); y.push(1.1 * (u * u - 1) + e); }
    else if (s.shape === 'circle') {
      const th = r() * 2 * Math.PI;
      x.push(2.1 * Math.cos(th) + e); y.push(2.1 * Math.sin(th) + st.randNorm(r, 0, 0.28));
    } else if (s.shape === 'sine') { const t2 = -3 + 6 * r(); x.push(t2); y.push(2 * Math.sin(2.2 * t2) + e); }
    else { x.push(u); y.push(st.randNorm(r)); }
  }
  return { x, y };
}

/** MI on a binned 2-D histogram — the standard estimator for continuous data */
function binnedMI(d, bins = 7) {
  const [xlo, xhi] = st.extent(d.x), [ylo, yhi] = st.extent(d.y);
  const bx = v => clamp(Math.floor(((v - xlo) / (xhi - xlo || 1)) * bins), 0, bins - 1);
  const by = v => clamp(Math.floor(((v - ylo) / (yhi - ylo || 1)) * bins), 0, bins - 1);
  const J = Array.from({ length: bins }, () => new Array(bins).fill(0));
  d.x.forEach((v, i) => { J[bx(v)][by(d.y[i])]++; });
  const n = d.x.length;
  const px = J.map(row => st.sum(row) / n);
  const py = J[0].map((_, j) => st.sum(J.map(r => r[j])) / n);
  let mi = 0;
  for (let i = 0; i < bins; i++) {
    for (let j = 0; j < bins; j++) {
      const pij = J[i][j] / n;
      if (pij <= 0 || px[i] <= 0 || py[j] <= 0) continue;
      mi += pij * (Math.log(pij / (px[i] * py[j])) / Math.LN2);
    }
  }
  return Math.max(0, mi);
}
