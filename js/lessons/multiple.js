/* ─────────────────────────────────────────────────────────────────────────────
   multiple.js — what "controlling for" actually does, shown by doing it the
   long way: fit, take residuals, fit again. Same answer, visible mechanism.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, arrowDefs } from '../core/plot.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sub, sup, hat, bar, paren, brack, eq, minus, op } from '../core/fx.js';

/* R's mtcars (1974 Motor Trend road tests): fuel economy, weight, horsepower. */
const CARS = [
  ['Mazda RX4', 21.0, 2.620, 110], ['Mazda RX4 Wag', 21.0, 2.875, 110],
  ['Datsun 710', 22.8, 2.320, 93], ['Hornet 4 Drive', 21.4, 3.215, 110],
  ['Hornet Sportabout', 18.7, 3.440, 175], ['Valiant', 18.1, 3.460, 105],
  ['Duster 360', 14.3, 3.570, 245], ['Merc 240D', 24.4, 3.190, 62],
  ['Merc 230', 22.8, 3.150, 95], ['Merc 280', 19.2, 3.440, 123],
  ['Merc 280C', 17.8, 3.440, 123], ['Merc 450SE', 16.4, 4.070, 180],
  ['Merc 450SL', 17.3, 3.730, 180], ['Merc 450SLC', 15.2, 3.780, 180],
  ['Cadillac Fleetwood', 10.4, 5.250, 205], ['Lincoln Continental', 10.4, 5.424, 215],
  ['Chrysler Imperial', 14.7, 5.345, 230], ['Fiat 128', 32.4, 2.200, 66],
  ['Honda Civic', 30.4, 1.615, 52], ['Toyota Corolla', 33.9, 1.835, 65],
  ['Toyota Corona', 21.5, 2.465, 97], ['Dodge Challenger', 15.5, 3.520, 150],
  ['AMC Javelin', 15.2, 3.435, 150], ['Camaro Z28', 13.3, 3.840, 245],
  ['Pontiac Firebird', 19.2, 3.845, 175], ['Fiat X1-9', 27.3, 1.935, 66],
  ['Porsche 914-2', 26.0, 2.140, 91], ['Lotus Europa', 30.4, 1.513, 113],
  ['Ford Pantera L', 15.8, 3.170, 264], ['Ferrari Dino', 19.7, 2.770, 175],
  ['Maserati Bora', 15.0, 3.570, 335], ['Volvo 142E', 21.4, 2.780, 109],
];

const MPG = CARS.map(c => c[1]);
const WT = CARS.map(c => c[2]);
const HP = CARS.map(c => c[3]);

const F = () => frame({ w: 720, h: 540, l: 68, r: 28, t: 34, b: 58 });

const joint = () => st.mlr(CARS.map(c => [c[2], c[3]]), MPG);
const soloWt = () => st.linreg(WT, MPG);
const soloHp = () => st.linreg(HP, MPG);

export default {
  meta: {
    id: 'multiple', title: 'multiple regression', kicker: 'HOLDING THINGS CONSTANT',
    status: 'live',
    deck: 'Adding a second predictor does not just add a second slope — it <em>changes the first one</em>. This lesson does the change by hand, so "controlling for weight" stops being a phrase and becomes something you can watch happen.',
    dataNote: 'Data: R\'s <code>mtcars</code> — 32 cars from 1974 <em>Motor Trend</em> road tests. Fuel economy in miles per gallon, weight in thousands of pounds, and gross horsepower.',
    deps: ['linreg', 'matrix'], unlocks: ['splines'],
    next: 'splines', nextLabel: 'splines',
    outro: 'a coefficient is never about a variable alone. it is about what is left of that variable once the others have had their say.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { view: 'wt', collin: 0, showResid: true },

  steps: [
    {
      title: 'two predictors, one outcome',
      prose: `<p>Heavy cars use more fuel. Powerful cars use more fuel. Both are obviously true, and both are easy to check one at a time.</p>
        <p>The trouble is that heavy cars <em>are</em> powerful cars. The two predictors overlap badly, and when you look at either one alone you are partly looking at the other one in disguise.</p>`,
      readouts: [
        { key: 'n', label: 'cars', get: () => CARS.length, d: 0 },
        { key: 'rw', label: 'r(mpg, weight)', tone: 'cold', get: () => st.pearson(WT, MPG), d: 3, wide: true, fmt: v => st.fmtR(v, 3) },
        { key: 'rh', label: 'r(mpg, hp)', tone: 'warm', get: () => st.pearson(HP, MPG), d: 3, wide: true, fmt: v => st.fmtR(v, 3) },
        { key: 'rwh', label: 'r(weight, hp)', tone: 'gold', get: () => st.pearson(WT, HP), d: 3, wide: true, fmt: v => st.fmtR(v, 3) },
      ],
      controls: [
        { type: 'segment', key: 'view', label: 'plot mpg against', options: [{ value: 'wt', label: 'weight' }, { value: 'hp', label: 'horsepower' }, { value: 'both', label: 'weight vs hp' }] },
      ],
      beats: [
        { label: 'the points', hold: 1300, note: 'Thirty-two cars. One predictor across, fuel economy up.', scene: s => solo(s, 0) },
        {
          label: 'one at a time',
          note: 'Each predictor on its own looks like a clean story. <b>Switch to "weight vs hp"</b> and the problem appears.',
          scene: s => solo(s, 1),
        },
      ],
    },

    {
      title: 'fit them together and the slopes move',
      prose: `<p>Now fit both at once. The model finds the plane that best predicts mpg from weight <em>and</em> horsepower together.</p>
        <p>Look at what happens to the horsepower coefficient. On its own it was about −0.068 mpg per horsepower. In the joint model it shrinks to about −0.032 — less than half.</p>
        <p>Nothing about horsepower changed. What changed is the <em>question</em>. The solo slope answered "how do powerful cars differ from weak ones?" — and powerful cars are also heavy. The joint slope answers "among cars of the <strong>same weight</strong>, how does power matter?" That is a different, and usually more useful, question.</p>`,
      formula: formula(
        hat('y') + eq + t(sub('b', '0'), { tone: 'muted' }) + ' + ' +
        t(sub('b', '1'), { tone: 'cold' }) + '·weight + ' + t(sub('b', '2'), { tone: 'warm' }) + '·hp' +
        `<div style="margin-top:.6em">` +
        t('each slope is the effect of its own predictor with every other predictor held still', { cls: 'fx-muted' }) + `</div>`,
        { caption: 'a plane through a cloud, not two separate lines' }),
      readouts: [
        { key: 'sw', label: 'weight alone', tone: 'cold', get: () => soloWt().b1, d: 3, wide: true },
        { key: 'jw', label: 'weight, joint', tone: 'cyan', get: () => joint().beta[1], d: 3, wide: true },
        { key: 'sh', label: 'hp alone', tone: 'warm', get: () => soloHp().b1, d: 4, wide: true },
        { key: 'jh', label: 'hp, joint', tone: 'gold', get: () => joint().beta[2], d: 4, wide: true },
        { key: 'r2', label: 'R²', tone: 'green', get: () => joint().r2, d: 3, fmt: v => st.fmtR(v, 3) },
        { key: 'ar2', label: 'adjusted R²', tone: 'green', get: () => joint().adjR2, d: 3, fmt: v => st.fmtR(v, 3), wide: true, explain: 'R² can only go up when you add predictors. The adjusted version charges you for each one, so it can go down.' },
      ],
      beats: [
        {
          label: 'the coefficients move',
          hold: 1800,
          note: 'Solo slope on the left, joint slope on the right. Horsepower loses more than half its apparent effect once weight is in the room.',
          scene: () => {
            const j = joint();
            const rows = [
              { n: 'weight', solo: soloWt().b1, jt: j.beta[1], d: 3, tone: 'cold' },
              { n: 'horsepower', solo: soloHp().b1, jt: j.beta[2], d: 4, tone: 'warm' },
            ];
            const items = [
              label('h1', 250, 130, 'on its own', { cls: 'lab lab-mid lab-muted' }),
              label('h2', 500, 130, 'controlling for the other', { cls: 'lab lab-mid lab-gold' }),
            ];
            rows.forEach((r, i) => {
              const y = 210 + i * 120;
              items.push(label(`n-${i}`, 110, y, r.n, { cls: `lab-big lab-${r.tone}` }));
              items.push(numLabel(`s-${i}`, 250, y, r.solo, { cls: 'lab-big lab-mid', d: r.d, dur: 700 }));
              items.push(path(`a-${i}`, [[310, y - 5], [430, y - 5]], { cls: 'arrow', delay: 300 + i * 200 }));
              items.push(numLabel(`j-${i}`, 500, y, r.jt, { cls: `lab-big lab-mid lab-${r.tone}`, d: r.d, dur: 900, delay: 400 + i * 200 }));
              items.push(label(`c-${i}`, 500, y + 26,
                `${((1 - Math.abs(r.jt / r.solo)) * 100).toFixed(0)}% smaller`, { cls: 'lab-sm lab-mid lab-gold', delay: 700 + i * 200 }));
            });
            items.push(label('note', 360, 440,
              'the shared information got assigned to weight, which explains mpg better', { cls: 'lab lab-mid' }));
            return items;
          },
        },
      ],
    },

    {
      title: 'do it by hand: residualise, then fit',
      prose: `<p>Here is the mechanism, and it's the most useful thing in this lesson. You can get the joint horsepower coefficient <strong>without ever fitting a multiple regression</strong>, in three steps:</p>
        <ul>
          <li>Regress mpg on weight. Keep the residuals — the part of fuel economy weight can't explain.</li>
          <li>Regress horsepower on weight. Keep those residuals too — the part of power that <em>isn't</em> just being a big car.</li>
          <li>Regress the first set of residuals on the second.</li>
        </ul>
        <p>The slope you get is <em>exactly</em> the joint coefficient, to the last decimal. That's the Frisch–Waugh–Lovell theorem, and it is what "holding weight constant" literally means: strip weight out of both variables first, then look at what's left.</p>`,
      formula: formula(
        t('resid', { tone: 'green' }) + paren('mpg | weight') + op('&nbsp;against&nbsp;') +
        t('resid', { tone: 'gold' }) + paren('hp | weight') + op('&nbsp;&nbsp;→&nbsp;&nbsp;') +
        t('the joint slope, exactly', { tone: 'warm' }),
        { size: 'sm', caption: 'controlling for something = removing it from both sides first' }),
      aside: `<b>This is why the plot is called an added-variable plot</b>, and why it is the right picture to look at when you want to know whether a predictor is really earning its place. If the residual cloud has no tilt, the variable adds nothing beyond what you already had.`,
      readouts: [
        { key: 'fwl', label: 'slope of the residual plot', tone: 'green', wide: true, get: () => {
          const ry = st.residualize(MPG, WT.map(v => [v]));
          const rx = st.residualize(HP, WT.map(v => [v]));
          return st.linreg(rx, ry).b1;
        }, d: 5 },
        { key: 'jh', label: 'joint coefficient', tone: 'gold', get: () => joint().beta[2], d: 5, wide: true },
        { key: 'same', label: 'identical?', tone: 'green', wide: true, get: () => {
          const ry = st.residualize(MPG, WT.map(v => [v]));
          const rx = st.residualize(HP, WT.map(v => [v]));
          return Math.abs(st.linreg(rx, ry).b1 - joint().beta[2]) < 1e-9 ? 'yes, exactly' : 'no';
        } },
      ],
      beats: [
        {
          label: 'step one: strip weight out of mpg',
          note: 'Fit mpg on weight, then keep only the vertical distances from that line.',
          scene: () => {
            const f = F();
            const m = st.linreg(WT, MPG);
            f.setX(Math.min(...WT), Math.max(...WT), 0.08);
            f.setY(Math.min(...MPG), Math.max(...MPG), 0.12);
            return [
              ...axes(f, { xLabel: 'weight (1000 lbs)', yLabel: 'miles per gallon' }),
              fnPath(f, x => m.b0 + m.b1 * x, { key: 'l', cls: 'curve curve-fit' }),
              ...WT.map((v, i) => ({
                key: `r-${i}`, tag: 'line', cls: 'stick stick-resid', delay: i * 22,
                attrs: { x1: f.sx(v), y1: f.sy(m.fit[i]), x2: f.sx(v), y2: f.sy(MPG[i]) },
              })),
              ...points(f, CARS, { key: 'p', r: 5, x: c => c[2], y: c => c[1], cls: 'pt pt-cold' }),
              label('l2', f.midX, f.y1 + 6, 'keep the sticks, throw away the line', { cls: 'lab lab-mid' }),
            ];
          },
        },
        {
          label: 'step two: strip weight out of horsepower',
          note: 'The same move on the predictor. What remains is the horsepower a car has <b>beyond what its weight would predict</b>.',
          scene: () => {
            const f = F();
            const m = st.linreg(WT, HP);
            f.setX(Math.min(...WT), Math.max(...WT), 0.08);
            f.setY(Math.min(...HP), Math.max(...HP), 0.12);
            return [
              ...axes(f, { xLabel: 'weight (1000 lbs)', yLabel: 'horsepower' }),
              fnPath(f, x => m.b0 + m.b1 * x, { key: 'l', cls: 'curve curve-warm' }),
              ...WT.map((v, i) => ({
                key: `r-${i}`, tag: 'line', cls: 'stick stick-resid', delay: i * 22,
                attrs: { x1: f.sx(v), y1: f.sy(m.fit[i]), x2: f.sx(v), y2: f.sy(HP[i]) },
              })),
              ...points(f, CARS, { key: 'p', r: 5, x: c => c[2], y: c => c[3], cls: 'pt pt-gold' }),
              label('l2', f.midX, f.y1 + 6, 'a Ferrari is above this line; a Cadillac is below it', { cls: 'lab lab-mid' }),
            ];
          },
        },
        {
          label: 'step three: plot the leftovers',
          hold: 1900,
          note: 'Neither axis has any weight left in it. The tilt of <b>this</b> cloud is the joint horsepower coefficient — check the readouts.',
          scene: () => {
            const ry = st.residualize(MPG, WT.map(v => [v]));
            const rx = st.residualize(HP, WT.map(v => [v]));
            const m = st.linreg(rx, ry);
            const f = F();
            f.setX(Math.min(...rx), Math.max(...rx), 0.1);
            f.setY(Math.min(...ry), Math.max(...ry), 0.12);
            return [
              ...axes(f, { xLabel: 'horsepower, with weight removed', yLabel: 'mpg, with weight removed' }),
              hLine(f, 0, { key: 'h', cls: 'rule-faint rule-dash' }),
              vLine(f, 0, { key: 'v', cls: 'rule-faint rule-dash' }),
              fnPath(f, x => m.b0 + m.b1 * x, { key: 'l', cls: 'curve curve-fit' }),
              ...rx.map((v, i) => ({
                key: `p-${i}`, tag: 'circle', cls: 'pt pt-green', delay: i * 25,
                attrs: { cx: f.sx(v), cy: f.sy(ry[i]), r: 6 },
                tip: `<b>${CARS[i][0]}</b><br>${rx[i].toFixed(1)} hp more than its weight suggests<br>${ry[i].toFixed(1)} mpg ${ry[i] >= 0 ? 'better' : 'worse'} than its weight suggests`,
              })),
              label('sl', f.midX, f.y1 + 6, `slope = ${m.b1.toFixed(5)}`, { cls: 'lab-big lab-mid lab-green' }),
            ];
          },
        },
      ],
    },

    {
      title: 'when the predictors overlap too much',
      prose: `<p>The residualising picture shows exactly when multiple regression gets into trouble. If weight and horsepower were <em>perfectly</em> correlated, then stripping weight out of horsepower would leave nothing at all — no variation, no slope, no answer.</p>
        <p>Short of perfect, you get something worse than an error: an answer that is technically correct and practically useless. The coefficients stay unbiased but their standard errors explode, so they swing wildly from sample to sample and often come out with the wrong sign.</p>
        <p><strong>Slide the overlap up</strong> and watch the residual cloud collapse toward a point while the confidence interval blows open.</p>`,
      formula: formula(
        t('VIF', { tone: 'warm', explain: 'Variance inflation factor: how many times wider this coefficient\'s variance is because of overlap with the other predictors.' }) +
        eq + frac('1', '1 ' + minus + ' ' + t(sup('R', '2'), { tone: 'gold', explain: 'R² from regressing this predictor on all the others.' })) +
        op('&nbsp;&nbsp;→&nbsp;&nbsp;') + 'SE grows by ' + t('√VIF', { tone: 'warm' }),
        { caption: 'the price of asking two predictors the same question' }),
      readouts: [
        { key: 'r', label: 'r between predictors', tone: 'gold', get: s => corrOf(s), d: 3, fmt: v => st.fmtR(v, 3), wide: true },
        { key: 'vif', label: 'VIF', tone: 'warm', get: s => 1 / (1 - corrOf(s) ** 2), d: 2 },
        { key: 'se', label: 'SE of the hp slope', tone: 'warm', get: s => simFit(s).se[2], d: 4, wide: true },
        { key: 'width', label: 'interval width', tone: 'cold', get: s => 2 * 1.96 * simFit(s).se[2], d: 4, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'collin', label: 'force the predictors to overlap', min: 0, max: 0.97, step: 0.01, fast: true, fmt: v => 'r ≈ ' + (+v).toFixed(2) },
      ],
      beats: [
        {
          label: 'the collapsing cloud',
          note: 'As the overlap grows, the residualised predictor loses all its range — and a slope estimated from almost no range is almost no estimate.',
          scene: s => {
            const d = simData(s);
            const rx = st.residualize(d.x2, d.x1.map(v => [v]));
            const ry = st.residualize(d.y, d.x1.map(v => [v]));
            const m = st.linreg(rx, ry);
            const f = F();
            f.setX(-3.2, 3.2); f.setY(-9, 9);
            const fitc = simFit(s);
            return [
              ...axes(f, { xLabel: 'predictor 2, with predictor 1 removed', yLabel: 'y, with predictor 1 removed' }),
              hLine(f, 0, { key: 'h', cls: 'rule-faint rule-dash' }),
              vLine(f, 0, { key: 'v', cls: 'rule-faint rule-dash' }),
              rect('ci', f.sx(-3.2), 0, f.sx(3.2) - f.sx(-3.2), 0, { cls: 'sq sq-resid', opacity: 0 }),
              ...range(9).map(i => {
                const b = m.b1 + (i - 4) * (1.96 * fitc.se[2]) / 4;
                return path(`c-${i}`, [[f.sx(-3.2), f.sy(-3.2 * b)], [f.sx(3.2), f.sy(3.2 * b)]], { cls: 'curve-ghost', dur: 200 });
              }),
              path('fit', [[f.sx(-3.2), f.sy(m.b0 - 3.2 * m.b1)], [f.sx(3.2), f.sy(m.b0 + 3.2 * m.b1)]], { cls: 'curve curve-fit', dur: 200 }),
              ...rx.map((v, i) => ({
                key: `p-${i}`, tag: 'circle', cls: 'pt pt-green', dur: 200,
                attrs: { cx: f.sx(clamp(v, -3.2, 3.2)), cy: f.sy(clamp(ry[i], -9, 9)), r: 5 },
              })),
              label('l', f.midX, f.y1 + 6,
                corrOf(s) > 0.9 ? 'almost nothing left to learn from' : corrOf(s) > 0.7 ? 'the estimate is getting unstable' : 'plenty of independent variation',
                { cls: 'lab-big lab-mid ' + (corrOf(s) > 0.9 ? 'lab-warm' : corrOf(s) > 0.7 ? 'lab-gold' : 'lab-green'), dur: 200 }),
            ];
          },
        },
      ],
    },

    {
      title: 'all of it in one line of matrix algebra',
      prose: `<p>Two predictors was manageable by hand. Twenty is not — and you never do it by hand anyway, because the whole thing collapses into a single expression.</p>
        <p>Stack your predictors as columns of a matrix X, put a column of 1s in front for the intercept, and the coefficients are one matrix inverse away. That formula is doing exactly the residualising you just watched, for every predictor simultaneously.</p>
        <p>The collinearity problem from the last step has a home in this notation too: when predictors overlap, XᵀX gets close to singular, and inverting a nearly-singular matrix is where the enormous standard errors come from.</p>`,
      formula: formula(
        t(hat('b'), { tone: 'green' }) + eq +
        paren(t('X', { tone: 'cyan' }) + sup('', 'T') + t('X', { tone: 'cyan' })) + sup('', '−1') +
        t('X', { tone: 'cyan' }) + sup('', 'T') + t('y', { tone: 'purple' }),
        { size: 'lg', caption: 'the normal equations — every regression on this site is one call to this' }),
      dep: { note: 'What an inverse is, and when it fails to exist, is the matrix algebra lesson.', lesson: 'matrix', label: 'matrix algebra' },
      readouts: [
        { key: 'b0', label: 'b₀', get: () => joint().beta[0], d: 3, wide: true },
        { key: 'b1', label: 'b₁ weight', tone: 'cold', get: () => joint().beta[1], d: 3, wide: true },
        { key: 'b2', label: 'b₂ hp', tone: 'warm', get: () => joint().beta[2], d: 4, wide: true },
        { key: 'F', label: 'F', tone: 'gold', get: () => joint().F, d: 1 },
        { key: 'p', label: 'p', tone: 'gold', get: () => joint().fp, fmt: st.fmtP, wide: true },
      ],
      beats: [
        {
          label: 'the matrices, with real numbers',
          note: 'Three numbers come out. Each is a slope with everything else held still.',
          scene: () => {
            const j = joint();
            const items = [];
            const y0 = 120, rh = 26;
            items.push(label('xh', 175, y0 - 20, 'X  (32 × 3)', { cls: 'lab lab-mid lab-cyan' }));
            items.push(label('yh', 400, y0 - 20, 'y', { cls: 'lab lab-mid lab-purple' }));
            for (let i = 0; i < 5; i++) {
              items.push(label(`x1-${i}`, 110, y0 + i * rh, '1', { cls: 'lab lab-mid lab-muted' }));
              items.push(label(`x2-${i}`, 175, y0 + i * rh, CARS[i][2].toFixed(3), { cls: 'lab lab-mid lab-cyan' }));
              items.push(label(`x3-${i}`, 245, y0 + i * rh, String(CARS[i][3]), { cls: 'lab lab-mid lab-cyan' }));
              items.push(label(`y-${i}`, 400, y0 + i * rh, CARS[i][1].toFixed(1), { cls: 'lab lab-mid lab-purple' }));
            }
            items.push(label('dots1', 175, y0 + 5 * rh, '⋮', { cls: 'lab lab-mid' }));
            items.push(label('dots2', 400, y0 + 5 * rh, '⋮', { cls: 'lab lab-mid' }));
            items.push(path('br1', [[85, y0 - 14], [78, y0 - 14], [78, y0 + 5 * rh + 8], [85, y0 + 5 * rh + 8]], { cls: 'brace' }));
            items.push(path('br2', [[268, y0 - 14], [275, y0 - 14], [275, y0 + 5 * rh + 8], [268, y0 + 5 * rh + 8]], { cls: 'brace' }));
            items.push(path('arr', [[300, y0 + 60], [370, y0 + 60]], { cls: 'arrow' }));

            items.push(label('res', 360, 330, '(XᵀX)⁻¹Xᵀy  =', { cls: 'lab-big lab-mid lab-gold' }));
            const names = ['intercept', 'weight', 'horsepower'];
            j.beta.forEach((b, i) => {
              items.push(label(`bn-${i}`, 250, 380 + i * 34, names[i], { cls: 'lab lab-end' }));
              items.push(numLabel(`bv-${i}`, 340, 380 + i * 34, b, {
                cls: `lab-big lab-end lab-${['gold', 'cold', 'warm'][i]}`, d: i === 2 ? 4 : 3, delay: i * 200,
              }));
              items.push(label(`bt-${i}`, 380, 380 + i * 34,
                `t = ${j.t[i].toFixed(2)},  p ${st.fmtP(j.p_[i])}`, { cls: 'lab', delay: i * 200 }));
            });
            items.push(label('r2', 360, 496,
              `R² = ${st.fmtR(j.r2, 3)}  ·  adjusted ${st.fmtR(j.adjR2, 3)}  ·  F = ${j.F.toFixed(1)}`, { cls: 'lab lab-mid lab-green' }));
            return items;
          },
        },
      ],
    },
  ],
};

/* a controllable-overlap simulation, used only in the collinearity step */
function simData(s) {
  const r = st.rng(77);
  const rho = +s.collin;
  const n = 60;
  const x1 = [], x2 = [], y = [];
  for (let i = 0; i < n; i++) {
    const a = st.randNorm(r), e = st.randNorm(r);
    const b = rho * a + Math.sqrt(1 - rho * rho) * e;
    x1.push(a); x2.push(b);
    y.push(2 * a + 1.5 * b + st.randNorm(r, 0, 2));
  }
  return { x1, x2, y };
}
const corrOf = s => st.pearson(simData(s).x1, simData(s).x2);
function simFit(s) {
  const d = simData(s);
  return st.mlr(d.x1.map((v, i) => [v, d.x2[i]]), d.y);
}

/* ── the opening, staged ──────────────────────────────────────────────────────
   The scatter first, then the line through it, so the line is something that
   arrives rather than something that was always there. */

function solo(s, phase) {
  const f = F();
  if (s.view === 'both') {
    f.setX(Math.min(...WT), Math.max(...WT), 0.08);
    f.setY(Math.min(...HP), Math.max(...HP), 0.1);
    const m = st.linreg(WT, HP);
    return [
      ...axes(f, { xLabel: 'weight (1000 lbs)', yLabel: 'horsepower' }),
      phase >= 1 ? fnPath(f, x => m.b0 + m.b1 * x, { key: 'l', cls: 'curve curve-warm curve-dash' }) : null,
      ...points(f, CARS, {
        key: 'p', r: 6, x: c => c[2], y: c => c[3], cls: 'pt pt-gold', stagger: 20,
        tip: c => `<b>${c[0]}</b><br>${c[2]} klbs · ${c[3]} hp`,
      }),
      phase >= 1 ? label('l', f.midX, f.y1 + 6,
        `the two predictors correlate at r = ${st.fmtR(st.pearson(WT, HP), 2)} — they are not independent questions`,
        { cls: 'lab lab-mid lab-gold' }) : null,
    ].filter(Boolean);
  }
  const xs = s.view === 'wt' ? WT : HP;
  const m = st.linreg(xs, MPG);
  f.setX(Math.min(...xs), Math.max(...xs), 0.08);
  f.setY(Math.min(...MPG), Math.max(...MPG), 0.12);
  return [
    ...axes(f, { xLabel: s.view === 'wt' ? 'weight (1000 lbs)' : 'horsepower', yLabel: 'miles per gallon' }),
    phase >= 1 ? fnPath(f, x => m.b0 + m.b1 * x, { key: 'l', cls: 'curve curve-fit' }) : null,
    ...points(f, CARS, {
      key: 'p', r: 6, x: c => (s.view === 'wt' ? c[2] : c[3]), y: c => c[1], stagger: 20,
      cls: 'pt ' + (s.view === 'wt' ? 'pt-cold' : 'pt-warm'),
      tip: c => `<b>${c[0]}</b><br>${c[1]} mpg`,
    }),
    phase >= 1 ? label('sl', f.midX, f.y1 + 6,
      `on its own: ${m.b1.toFixed(3)} mpg per ${s.view === 'wt' ? '1000 lbs' : 'horsepower'}`,
      { cls: 'lab-big lab-mid lab-green' }) : null,
  ].filter(Boolean);
}
