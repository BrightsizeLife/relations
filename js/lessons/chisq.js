/* ─────────────────────────────────────────────────────────────────────────────
   chisq.js — chi-square. The first test on this site that never computes a mean.
   Counts in, expected counts out, squared gaps scaled by how big a gap you
   should have expected.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, label, numLabel, path, rect, fnPath, fnArea, vLine, arrowDefs } from '../core/plot.js';
import { range } from '../core/dom.js';
import { formula, t, frac, sub, sup, sumOver, paren, eq, minus, op } from '../core/fx.js';

/* Titanic: survival by travelling class. The standard 2201-person figures. */
const ROWS = ['1st class', '2nd class', '3rd class', 'crew'];
const COLS = ['survived', 'died'];
const OBS = [[203, 122], [118, 167], [178, 528], [212, 673]];

/* Mendel's 1866 pea counts against his own 9:3:3:1 prediction. */
const MENDEL = { obs: [315, 108, 101, 32], exp: [9 / 16, 3 / 16, 3 / 16, 1 / 16], names: ['round yellow', 'round green', 'wrinkled yellow', 'wrinkled green'] };

const F = () => frame({ w: 720, h: 540, l: 66, r: 28, t: 34, b: 58 });

function T(s) {
  const obs = OBS.map((r, i) => i === 0 ? [Math.round(r[0] * s.tweak), r[1]] : [...r]);
  return st.chi2Independence(obs);
}

/* table geometry */
const CX = [250, 380], CY0 = 130, RH = 56, CW = 118;
const cellX = j => CX[j] - CW / 2;
const cellY = i => CY0 + i * RH;

function tableItems(res, { mode = 'obs', key = 'c' } = {}) {
  const items = [
    ...COLS.map((c, j) => label(`h-${j}`, CX[j], CY0 - 18, c, { cls: 'lab lab-mid lab-gold' })),
    ...ROWS.map((r, i) => label(`rn-${i}`, cellX(0) - 14, cellY(i) + RH / 2 + 4, r, { cls: 'lab lab-end' })),
  ];
  res.obs.forEach((row, i) => row.forEach((o, j) => {
    const e = res.exp[i][j], cell = res.cells[i][j];
    const val = mode === 'obs' ? o : mode === 'exp' ? e : mode === 'gap' ? o - e : cell;
    const tone = mode === 'gap' || mode === 'cell'
      ? (o - e >= 0 ? 'lab-warm' : 'lab-cold') : '';
    items.push(rect(`${key}-bg-${i}-${j}`, cellX(j), cellY(i), CW, RH - 6, {
      cls: 'cell', opacity: mode === 'cell' ? 0.3 + 0.7 * Math.min(1, cell / Math.max(...res.cells.flat())) : 1,
      tip: `${ROWS[i]} · ${COLS[j]}<br>observed <b>${o}</b><br>expected <b>${e.toFixed(1)}</b><br>contribution <b>${cell.toFixed(2)}</b>`,
    }));
    items.push(numLabel(`${key}-v-${i}-${j}`, CX[j], cellY(i) + RH / 2 + 4, val, {
      cls: `lab-big lab-mid ${tone}`, d: mode === 'obs' ? 0 : mode === 'gap' ? 1 : 2,
      pre: mode === 'gap' && val > 0 ? '+' : '',
    }));
  }));
  return items;
}

export default {
  meta: {
    id: 'chisq', title: 'chi-square', kicker: 'COUNTS, NOT MEASURES',
    status: 'live',
    deck: 'No means, no standard deviations, no line. Just counts in a table, a prediction of what those counts would look like if nothing were going on, and a disciplined way of measuring the gap.',
    dataNote: 'Data: the Titanic\'s 2,201 passengers and crew, cross-tabulated by travelling class and survival — the standard figures from the British Board of Trade inquiry. The goodness-of-fit step uses Mendel\'s original 1866 pea counts.',
    deps: [], unlocks: [],
    next: 'clt', nextLabel: 'normal distributions & the clt',
    outro: 'a table, a prediction, and the squared distance between them.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { tweak: 1, mode: 'obs' },

  steps: [
    {
      title: 'a table of counts',
      prose: `<p>2,201 people. Two facts about each: which class they travelled in, and whether they survived.</p>
        <p>There is nothing to average here. You cannot take the mean of "died". All you have is <strong>how many people fell into each box</strong> — and the question is whether the boxes are related.</p>`,
      readouts: [
        { key: 'n', label: 'total people', get: s => T(s).N, d: 0, wide: true },
        { key: 'surv', label: 'survived', tone: 'green', get: s => T(s).colT[0], d: 0 },
        { key: 'rate', label: 'overall survival', tone: 'gold', get: s => (T(s).colT[0] / T(s).N) * 100, d: 1, suf: '%', wide: true },
      ],
      beats: [
        {
          label: 'the counts',
          note: 'Four classes, two outcomes, eight numbers. Hover any cell.',
          scene: s => [
            label('ttl', 360, 80, 'observed counts', { cls: 'lab-big lab-mid' }),
            ...tableItems(T(s), { mode: 'obs' }),
          ],
        },
        {
          label: 'the margins',
          note: 'Row totals and column totals. These are the only things the null hypothesis is allowed to keep.',
          scene: s => {
            const r = T(s);
            return [
              label('ttl', 360, 80, 'observed counts, with margins', { cls: 'lab-big lab-mid' }),
              ...tableItems(r, { mode: 'obs' }),
              ...r.rowT.map((v, i) => label(`rt-${i}`, CX[1] + CW / 2 + 24, cellY(i) + RH / 2 + 4, String(v), { cls: 'lab lab-gold' })),
              ...r.colT.map((v, j) => label(`ct-${j}`, CX[j], cellY(4) + 18, String(v), { cls: 'lab lab-mid lab-gold' })),
              label('nt', CX[1] + CW / 2 + 24, cellY(4) + 18, String(r.N), { cls: 'lab lab-gold' }),
              label('rl', CX[1] + CW / 2 + 44, CY0 - 18, 'row total', { cls: 'lab-sm lab-gold' }),
              label('cl', cellX(0) - 14, cellY(4) + 18, 'column total', { cls: 'lab-sm lab-gold lab-end' }),
            ];
          },
        },
      ],
    },

    {
      title: 'what would "no relationship" look like?',
      prose: `<p>Here's the move that makes the whole test work. Assume class had <em>nothing</em> to do with survival — that the ship's overall survival rate applied equally to everyone.</p>
        <p>Then the expected count in any cell is just: how many people were in that row, times the overall rate for that column. Written as a formula, that's the row total times the column total, divided by the grand total.</p>
        <p>These expected counts are not data. They are what a specific, boring hypothesis <em>predicts</em>. Everything from here on measures how badly that prediction failed.</p>`,
      formula: formula(
        t('E', { tone: 'cold', explain: 'The count you would expect if the two variables were independent.' }) + sub('', 'ij') + eq +
        frac(t('row total', { tone: 'gold' }) + ' × ' + t('column total', { tone: 'gold' }), t('N', { tone: 'muted' })),
        { caption: 'independence means the row tells you nothing about the column' }),
      readouts: [
        { key: 'e11', label: 'expected 1st survived', tone: 'cold', get: s => T(s).exp[0][0], d: 1, wide: true },
        { key: 'o11', label: 'actually survived', tone: 'warm', get: s => T(s).obs[0][0], d: 0, wide: true },
        { key: 'g11', label: 'gap', tone: 'gold', get: s => T(s).obs[0][0] - T(s).exp[0][0], d: 1 },
      ],
      beats: [
        {
          label: 'one cell',
          note: 'First class held 325 people. If the ship\'s overall 32% survival applied to them, about 105 of them should have lived.',
          scene: s => {
            const r = T(s);
            return [
              label('ttl', 360, 80, 'expected under independence', { cls: 'lab-big lab-mid lab-cold' }),
              ...tableItems(r, { mode: 'obs' }),
              rect('hl', cellX(0) - 2, cellY(0) - 2, CW + 4, RH - 2, { cls: 'bar-out' }),
              label('calc', 360, cellY(4) + 40,
                `${r.rowT[0]} × ${r.colT[0]} ÷ ${r.N}  =  ${r.exp[0][0].toFixed(1)}`, { cls: 'lab-big lab-mid lab-cold' }),
            ];
          },
        },
        {
          label: 'the whole predicted table',
          hold: 1600,
          note: 'The same arithmetic in all eight cells. Compare these with the previous beat — first class did far better than this, third class far worse.',
          scene: s => [
            label('ttl', 360, 80, 'expected under independence', { cls: 'lab-big lab-mid lab-cold' }),
            ...tableItems(T(s), { mode: 'exp' }),
          ],
        },
        {
          label: 'the gaps',
          note: 'Observed minus expected. <span style="color:var(--cs-data-warm)">Warm</span> means more survivors than independence predicts; <span style="color:var(--cs-data-cold)">cold</span> means fewer.',
          scene: s => [
            label('ttl', 360, 80, 'observed − expected', { cls: 'lab-big lab-mid lab-gold' }),
            ...tableItems(T(s), { mode: 'gap' }),
            label('note', 360, cellY(4) + 40, 'these always sum to zero — that is what fixing the margins does', { cls: 'lab-sm lab-mid' }),
          ],
        },
      ],
    },

    {
      title: 'square the gaps — then scale them',
      prose: `<p>The gaps sum to zero, exactly like the deviations back in the correlation lesson, so we square them for exactly the same reason.</p>
        <p>But there's a second step that's specific to counts, and it's the clever bit. <strong>A gap of 50 is enormous in a cell where you expected 20, and unremarkable in a cell where you expected 600.</strong> So each squared gap is divided by the expected count — measuring the miss in proportion to how big a miss was plausible.</p>
        <p>Add the eight scaled squares together and you have χ².</p>`,
      formula: formula(
        t('χ', { tone: 'gold' }) + sup('', '2') + eq +
        sumOver(frac(paren(t('O', { tone: 'warm', explain: 'What you counted.' }) + minus + t('E', { tone: 'cold', explain: 'What independence predicted.' })) + sup('', '2'),
          t('E', { tone: 'cold', explain: 'Dividing by E turns an absolute miss into a relative one.' })), { from: 'cells', to: '' }),
        { caption: 'each cell contributes; big expected counts forgive big misses' }),
      aside: `<b>The rule of thumb.</b> This scaling stops working when the expected counts get tiny — a gap of 3 where you expected 0.5 blows up the statistic. The usual guidance is that every expected count should be at least 5. Note that it is the <i>expected</i> counts that matter, not the observed ones.`,
      readouts: [
        { key: 'x2', label: 'χ²', tone: 'gold', get: s => T(s).X2, d: 2 },
        { key: 'df', label: 'df', get: s => T(s).df, d: 0, explain: '(rows − 1) × (columns − 1). Once the margins are fixed, only this many cells are free to move.' },
        { key: 'p', label: 'p', tone: 'warm', get: s => T(s).p, fmt: st.fmtP, wide: true },
        { key: 'v', label: "Cramér's V", tone: 'green', get: s => T(s).cramersV, d: 3, wide: true, explain: 'An effect size: how strong the association is, on a 0–1 scale that does not grow with sample size.' },
      ],
      controls: [
        { type: 'slider', key: 'tweak', label: 'change 1st-class survivors', min: 0.3, max: 1.6, step: 0.01, fast: true, fmt: v => (+v).toFixed(2) + '×' },
      ],
      beats: [
        {
          label: 'per-cell contributions',
          note: 'Brighter cells contributed more. Third class alone accounts for a huge share of the total.',
          scene: s => [
            label('ttl', 360, 80, '(O − E)² / E', { cls: 'lab-big lab-mid lab-gold' }),
            ...tableItems(T(s), { mode: 'cell' }),
            numLabel('tot', 360, cellY(4) + 40, T(s).X2, { cls: 'lab-big lab-mid lab-gold', d: 2, pre: 'χ² = ' }),
          ],
        },
        {
          label: 'stack them up',
          hold: 1700,
          note: 'The eight contributions, laid end to end. Hover to see which cell each block is.',
          scene: s => {
            const r = T(s);
            const flat = [];
            r.cells.forEach((row, i) => row.forEach((c, j) => flat.push({ c, i, j })));
            flat.sort((a, b) => b.c - a.c);
            const f = F();
            const total = r.X2;
            const W = 560;
            let x = 80;
            return [
              label('ttl', 360, 150, 'every cell\'s contribution to χ²', { cls: 'lab-big lab-mid' }),
              ...flat.map((d, k) => {
                const w = (d.c / total) * W;
                const item = rect(`b-${k}`, x, 200, w, 60, {
                  cls: `sq ${r.obs[d.i][d.j] >= r.exp[d.i][d.j] ? 'sq-pos' : 'sq-neg'}`, delay: k * 110,
                  tip: `${ROWS[d.i]} · ${COLS[d.j]}<br>contributes <b>${d.c.toFixed(2)}</b> (${((d.c / total) * 100).toFixed(0)}%)`,
                });
                const lbl = w > 46 ? label(`bl-${k}`, x + w / 2, 235, d.c.toFixed(0), { cls: 'lab-sm lab-mid', delay: k * 110 }) : null;
                x += w;
                return [item, lbl];
              }),
              numLabel('tot', 360, 300, total, { cls: 'lab-big lab-mid lab-gold', d: 2, pre: 'χ² = ' }),
              label('sub', 360, 324, `with ${r.df} degrees of freedom`, { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
        {
          label: 'against the null',
          note: 'The χ² distribution is what this statistic looks like when the two variables really are unrelated. Ours is not close.',
          scene: s => {
            const r = T(s);
            const f = F();
            const lim = Math.max(20, r.X2 * 1.2);
            f.setX(0, lim);
            f.setY(0, st.chi2Pdf(Math.max(0.6, r.df - 2), r.df) * 1.35);
            return [
              ...axes(f, { xLabel: 'χ²', yLabel: 'density', yN: 4 }),
              fnArea(f, x => st.chi2Pdf(x, r.df), Math.min(r.X2, lim), lim, { key: 'tail', cls: 'area area-warm', base: 0, dur: 260 }),
              fnPath(f, x => st.chi2Pdf(x, r.df), { key: 'c', cls: 'curve', n: 240, from: 0.01, dur: 260 }),
              vLine(f, Math.min(r.X2, lim), { key: 'obs', cls: 'rule-gold', dur: 260 }),
              numLabel('l', Math.min(f.sx(r.X2), f.x1 - 60), f.y1 + 6, r.X2, { cls: 'lab-big lab-gold lab-end', d: 1, pre: 'χ² = ', dur: 260 }),
              label('p', f.midX, f.y1 + 28, `df = ${r.df} · p = ${st.fmtP(r.p)}`, { cls: 'lab lab-mid lab-gold', dur: 260 }),
            ];
          },
        },
      ],
    },

    {
      title: 'which cells actually did it?',
      prose: `<p>A significant χ² tells you the table is not independent. It does not tell you <em>where</em>. For that, look at the standardised residuals — each gap divided by the square root of its expected count.</p>
        <p>These behave roughly like z-scores: anything beyond about ±2 is a cell pulling hard. Read them and the Titanic story writes itself.</p>`,
      formula: formula(
        t('r', { tone: 'green' }) + sub('', 'ij') + eq + frac('O ' + minus + ' E', '√E'),
        { caption: 'roughly a z-score for each cell' }),
      readouts: [
        { key: 'x2', label: 'χ²', tone: 'gold', get: s => T(s).X2, d: 1 },
        { key: 'v', label: "Cramér's V", tone: 'green', get: s => T(s).cramersV, d: 3, wide: true },
        { key: 'worst', label: 'biggest offender', wide: true, get: s => {
          const r = T(s);
          let best = { v: 0, i: 0, j: 0 };
          r.cells.forEach((row, i) => row.forEach((c, j) => { if (c > best.v) best = { v: c, i, j }; }));
          return `${ROWS[best.i]} ${COLS[best.j]}`;
        } },
      ],
      beats: [
        {
          label: 'standardised residuals',
          note: 'Warm = more survivors than independence predicts. Cold = fewer. The class gradient is not subtle.',
          scene: s => {
            const r = T(s);
            const maxAbs = Math.max(...r.resid.flat().map(Math.abs));
            const items = [
              label('ttl', 360, 80, 'standardised residuals', { cls: 'lab-big lab-mid' }),
              ...COLS.map((c, j) => label(`h-${j}`, CX[j], CY0 - 18, c, { cls: 'lab lab-mid lab-gold' })),
              ...ROWS.map((rw, i) => label(`rn-${i}`, cellX(0) - 14, cellY(i) + RH / 2 + 4, rw, { cls: 'lab lab-end' })),
            ];
            r.resid.forEach((row, i) => row.forEach((v, j) => {
              items.push(rect(`rz-${i}-${j}`, cellX(j), cellY(i), CW, RH - 6, {
                cls: `sq ${v >= 0 ? 'sq-pos' : 'sq-neg'}`,
                opacity: 0.2 + 0.8 * (Math.abs(v) / maxAbs),
                tip: `${ROWS[i]} · ${COLS[j]}<br>standardised residual <b>${v.toFixed(2)}</b>`,
              }));
              items.push(label(`rl-${i}-${j}`, CX[j], cellY(i) + RH / 2 + 4,
                (v >= 0 ? '+' : '') + v.toFixed(1), { cls: `lab-big lab-mid ${v >= 0 ? 'lab-warm' : 'lab-cold'}` }));
            }));
            items.push(label('story', 360, cellY(4) + 42,
              'first class survived far more than chance; third class and crew far less', { cls: 'lab lab-mid' }));
            return items;
          },
        },
      ],
    },

    {
      title: 'the same test with only one row',
      prose: `<p>Everything so far compared two variables. The other use of χ² compares one set of counts against a theory — <strong>goodness of fit</strong>.</p>
        <p>Mendel counted 556 pea plants and predicted a 9:3:3:1 ratio from his model of inheritance. The arithmetic is identical: expected counts from the theory, squared gaps, scaled by E, summed.</p>
        <p>Here the test comes back <em>not</em> significant, and that is the point. A big p-value doesn't prove the theory — it just means the data gave you no reason to abandon it.</p>`,
      aside: `<b>A famous footnote.</b> Fisher noticed in 1936 that Mendel's results across all his experiments fit the theory <i>too</i> well — the χ² values were suspiciously small, as if the data had been tidied. The debate has run for ninety years. It is a nice reminder that a test statistic can be surprising in either direction.`,
      readouts: [
        { key: 'x2', label: 'χ²', tone: 'gold', get: () => st.chi2GoodnessOfFit(MENDEL.obs, MENDEL.exp).X2, d: 3 },
        { key: 'df', label: 'df', get: () => st.chi2GoodnessOfFit(MENDEL.obs, MENDEL.exp).df, d: 0 },
        { key: 'p', label: 'p', tone: 'green', get: () => st.chi2GoodnessOfFit(MENDEL.obs, MENDEL.exp).p, fmt: st.fmtP, wide: true },
        { key: 'n', label: 'plants', get: () => st.chi2GoodnessOfFit(MENDEL.obs, MENDEL.exp).N, d: 0 },
      ],
      beats: [
        {
          label: 'observed against predicted',
          note: 'Grey outline: what 9:3:3:1 predicts. Solid: what Mendel counted. The fit is close.',
          scene: () => {
            const r = st.chi2GoodnessOfFit(MENDEL.obs, MENDEL.exp);
            const f = F();
            f.setX(-0.5, 3.5); f.setY(0, Math.max(...MENDEL.obs) * 1.2);
            return [
              ...axes(f, { yLabel: 'plants counted', showX: false, xN: 0 }),
              ...MENDEL.obs.map((o, i) => rect(`o-${i}`, f.sx(i) - 45, f.sy(o), 90, f.y0 - f.sy(o), {
                cls: 'bar bar-green', delay: i * 130,
                tip: `${MENDEL.names[i]}<br>observed <b>${o}</b><br>expected <b>${r.exp[i].toFixed(1)}</b><br>contributes <b>${r.cells[i].toFixed(3)}</b>`,
              })),
              ...r.exp.map((e, i) => rect(`e-${i}`, f.sx(i) - 52, f.sy(e), 104, f.y0 - f.sy(e), { cls: 'bar-out', delay: i * 130 })),
              ...MENDEL.names.map((n, i) => label(`n-${i}`, f.sx(i), f.y0 + 20, n.replace(' ', '\n'), { cls: 'lab-sm lab-mid' })),
              label('res', f.midX, f.y1 + 6,
                `χ² = ${r.X2.toFixed(3)} on ${r.df} df · p = ${st.fmtP(r.p)}`, { cls: 'lab-big lab-mid lab-gold' }),
              label('res2', f.midX, f.y1 + 26, 'no evidence against 9:3:3:1', { cls: 'lab-sm lab-mid lab-green' }),
            ];
          },
        },
      ],
    },
  ],
};
