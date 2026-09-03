/* ─────────────────────────────────────────────────────────────────────────────
   regularisation.js — paying a model to be smaller.

   Least squares has one instruction: make the residuals small. Given enough
   columns it can always obey, and it obeys by inventing enormous coefficients
   that cancel on the training rows and agree about nothing anywhere else.

   Everything here is fitted live: the overfitting curve is forty refits at each
   width, the coefficient paths are forty-five fits apiece, the λ is chosen by
   eight-fold cross-validation in your browser, and the bias–variance
   decomposition is sixty fresh samples per λ rather than a picture from a book.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import {
  standardise, ridge, lasso, elastic, soft, coefPath, cvCurve, design,
  biasVariance, overfitCurve, LAMBDAS,
} from '../core/regular.js';
import { frame, axes, label, numLabel, path, rect, hLine, vLine, fnPath, arrowDefs } from '../core/plot.js';
import { range } from '../core/dom.js';
import { formula, t, sub, sup, hat, paren, eq, minus, plus, times, sumOver } from '../core/fx.js';

/* ── the data, and everything fitted to it ────────────────────────────────── */

const D = design();                       // 60 rows, 20 columns, 4 of which matter
const STD = standardise(D.X);
const OLS = ridge(STD.Z, D.y, 1e-9).beta; // the unpenalised answer, stabilised

const PATH = { ridge: coefPath(STD.Z, D.y, 'ridge'), lasso: coefPath(STD.Z, D.y, 'lasso') };
const CV = { ridge: cvCurve(D.X, D.y, 'ridge'), lasso: cvCurve(D.X, D.y, 'lasso') };
const OVERFIT = overfitCurve({ reps: 30 });
const BV = biasVariance({ reps: 60 });

const CHOSEN = {
  ridge: ridge(STD.Z, D.y, CV.ridge.best.lam * D.n).beta,
  lasso: lasso(STD.Z, D.y, CV.lasso.oneSe.lam).beta,
};
const KEPT = CHOSEN.lasso.map((v, i) => (v !== 0 ? i : -1)).filter(i => i >= 0);
const NZ_MIN = lasso(STD.Z, D.y, CV.lasso.best.lam).beta.filter(v => v !== 0).length;
const NZ_1SE = KEPT.length;

/** the coefficients at whatever λ the reader has the slider on */
const fitAt = s => {
  const lam = LAMBDAS[Math.round(+s.li)];
  return {
    lam,
    beta: s.kind === 'ridge' ? ridge(STD.Z, D.y, lam * D.n).beta : lasso(STD.Z, D.y, lam).beta,
  };
};

/* ── formula pieces ───────────────────────────────────────────────────────── */

const fRSS = t(`${sumOver(`${paren(`${sub('y', 'i')} ${minus} ${hat('y')}${sub('', 'i')}`)}${sup('', '2')}`)}`,
  { explain: 'The only thing least squares cares about: how far the fitted line is from the points you have.', tone: 'gold', link: 'rss' });
const fLam = t('λ', { explain: 'The price of a coefficient. At zero you are back to least squares; at infinity every coefficient is zero and the model is a horizontal line at the mean.', tone: 'warm', link: 'lam' });
const fL2 = t(`${sumOver(`${sub('β', 'j')}${sup('', '2')}`, { from: 'j=1', to: 'p' })}`,
  { explain: 'Ridge: the sum of squares. Cheap near zero, brutal far away — so it shrinks the big ones hard and never quite kills the small ones.', tone: 'cyan', link: 'l2' });
const fL1 = t(`${sumOver(`|${sub('β', 'j')}|`, { from: 'j=1', to: 'p' })}`,
  { explain: 'Lasso: the sum of absolute values. The slope of the cost is the same all the way in to zero, which is exactly why coefficients arrive there.', tone: 'purple', link: 'l1' });

const RIDGE_F = formula(`${fRSS} ${plus} ${fLam} ${fL2}`, { caption: 'ridge · squared penalty' });
const LASSO_F = formula(`${fRSS} ${plus} ${fLam} ${fL1}`, { caption: 'lasso · absolute penalty' });

export default {
  meta: {
    id: 'regularisation', title: 'regularisation', short: 'regularisation',
    kicker: 'PAYING A MODEL TO BE SMALLER', status: 'live',
    deck: 'Give least squares thirty rows and twenty-six columns and it will fit them almost perfectly — training error <b>0.19</b>, test error <b>26.9</b>. The fix is not a better optimiser. It is a second instruction, a price on the coefficients themselves, and the difference between charging for their squares and charging for their absolute values is the difference between shrinking a model and deleting most of it.',
    dataNote: 'Sixty rows, twenty columns, four of which have a real effect and two of those nearly identical to each other. Simulated so the right answer is known and the methods can be caught being wrong.',
    deps: ['multiple', 'linreg', 'gradientdescent'], unlocks: [],
    next: 'randomforest', nextLabel: 'random forests',
    outro: 'the penalty is not a trick to make the matrix invertible. it is a statement that you expect the world to be simpler than your column count, and it pays off exactly as far as that is true.',
  },
  canvas: { w: 720, h: 500 },
  defs: arrowDefs,
  state: { kind: 'lasso', li: 22, z: 1.2, alpha: 1, showTrue: true },

  steps: [

    /* ── 1 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'the model that gets better and better and worse and worse',
      prose: `<p>Thirty rows. Keep adding columns of noise — genuinely unrelated to the outcome — and refit.</p>
        <p>The <b>training</b> error goes down every single time. It has to: a new column can always be given a coefficient of zero, so the best fit can never get worse. By twenty-six columns the model explains the training rows nearly perfectly.</p>
        <p>The <b>test</b> error, on fresh rows from the same world, goes up by a factor of ten.</p>
        <p>Nothing about this is a bug in the optimiser. Least squares did precisely what it was told. What it was told was incomplete.</p>`,
      beats: [
        { label: 'training error', scene: () => scene1(0), hold: 1500 },
        { label: 'error on new data', scene: () => scene1(1), note: 'the same fits, scored on rows they have never seen.' },
      ],
      readouts: [
        { key: 'a', label: 'train mse · 1 column', tone: 'muted', get: () => OVERFIT[0].train, d: 2 },
        { key: 'b', label: 'train mse · 26 columns', tone: 'green', get: () => OVERFIT[OVERFIT.length - 1].train, d: 2 },
        { key: 'c', label: 'test mse · 1 column', tone: 'muted', get: () => OVERFIT[0].test, d: 2 },
        { key: 'd', label: 'test mse · 26 columns', tone: 'warm', get: () => OVERFIT[OVERFIT.length - 1].test, d: 2 },
      ],
    },

    /* ── 2 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'add a price',
      prose: `<p>The second instruction is one term long. Keep minimising the squared residuals, but now the coefficients themselves cost money.</p>
        <p>The model can still buy a large coefficient. It just has to be worth it — the fit has to improve by more than the coefficient costs. A column that is genuinely noise improves the fit a little, by luck, and now that little is not enough.</p>
        <p>λ is the exchange rate. At λ = 0 nothing costs anything and you are back where you started. As λ grows every coefficient is squeezed toward zero, and at the far end the model is a flat line at the mean of y — which is not useless, it is just the model that claims nothing.</p>`,
      formula: RIDGE_F,
      controls: [
        { type: 'slider', key: 'li', label: 'λ', min: 0, max: 44, step: 1, fast: true, fmt: v => LAMBDAS[Math.round(v)].toFixed(3) },
        { type: 'segment', key: 'kind', label: 'penalty', options: [
          { value: 'ridge', label: 'ridge · β²', explain: 'Charges for the squares. Shrinks everything, deletes nothing.' },
          { value: 'lasso', label: 'lasso · |β|', explain: 'Charges for absolute values. Sends coefficients to exactly zero.' },
        ] },
      ],
      scene: s => scene2(s),
      readouts: [
        { key: 'l', label: 'λ', tone: 'warm', get: s => fitAt(s).lam, d: 4 },
        { key: 'n', label: 'coefficients not zero', tone: 'cyan', get: s => fitAt(s).beta.filter(v => Math.abs(v) > 1e-9).length, d: 0 },
        { key: 's', label: 'total size of the coefficients', tone: 'gold', get: s => st.sum(fitAt(s).beta.map(Math.abs)), d: 3 },
      ],
    },

    /* ── 3 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'squares shrink; absolute values delete',
      prose: `<p>Both penalties push toward zero. Only one of them arrives.</p>
        <p>The reason is a slope. Differentiate β² and you get 2β — near zero the squared penalty barely pushes at all, so a small coefficient is nudged smaller and smaller forever. Differentiate |β| and you get ±1 — the push is the <em>same size</em> all the way in, so a coefficient whose evidence is worth less than λ gets pushed past zero and pinned there.</p>
        <p>The lasso update is one line, and it is worth reading as arithmetic rather than geometry: take the coefficient least squares wanted, subtract λ from its magnitude, and if that takes you past zero, stop at zero.</p>`,
      formula: formula(
        `${t('soft', { tone: 'gold' })}(z, λ) ${eq} sign(z) ${times} max(|z| ${minus} λ, 0)`,
        { caption: 'the whole difference between the two methods, in one line' }),
      controls: [
        { type: 'slider', key: 'z', label: 'what least squares wanted', min: -3, max: 3, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
      ],
      scene: s => scene3(+s.z),
      readouts: [
        { key: 'z', label: 'unpenalised coefficient', tone: 'muted', get: s => +s.z, d: 2 },
        { key: 'r', label: 'ridge keeps', tone: 'cyan', get: s => (+s.z) / (1 + 0.8), d: 3 },
        { key: 'l', label: 'lasso keeps', tone: 'purple', get: s => soft(+s.z, 0.8), d: 3 },
      ],
    },

    /* ── 4 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'the corner',
      prose: `<p>The same fact, drawn. Minimising the residuals subject to a budget on the coefficients means: expand the elliptical contours of the residual sum of squares until they first touch the budget region.</p>
        <p>Ridge's budget is a <b>circle</b>. A circle has no special points, so the touch happens almost anywhere — and almost anywhere has both coefficients non-zero.</p>
        <p>Lasso's budget is a <b>diamond</b>. Its corners sit exactly on the axes, and they stick out. An expanding ellipse hits a corner far more often than chance, and a corner <em>is</em> a coefficient of zero.</p>
        <p>In two dimensions this is a curiosity. In two hundred, the diamond has an enormous number of corners, edges and faces of every dimension, and hitting one is the normal outcome rather than the exception.</p>`,
      beats: [
        { label: 'the least-squares answer', scene: () => scene4(0), hold: 1300 },
        { label: 'ridge · a circle', scene: () => scene4(1), hold: 1700, note: 'the ellipse touches the circle somewhere ordinary. both coefficients survive.' },
        { label: 'lasso · a diamond', scene: () => scene4(2), note: 'it touches at a corner. β₂ is not small. it is gone.' },
      ],
    },

    /* ── 5 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'twenty coefficients, one λ at a time',
      prose: `<p>Every line is one column's coefficient, traced as λ goes from almost nothing on the left to large on the right. Four of these columns have a real effect. The other sixteen are noise, and at λ = 0 least squares has given every one of them something.</p>
        <p>Follow ridge across: everything glides toward zero together, and nothing ever gets there. Twenty non-zero coefficients at the left, twenty at the right.</p>
        <p>Follow the lasso: the noise columns hit the axis one after another and <em>stay</em>. By the middle of the plot the model has forgotten they exist. That is variable selection happening as a side effect of a penalty, which is why the lasso arrived and did not leave.</p>`,
      controls: [
        { type: 'segment', key: 'kind', label: 'penalty', options: [
          { value: 'ridge', label: 'ridge' }, { value: 'lasso', label: 'lasso' },
        ] },
        { type: 'toggle', key: 'showTrue', label: 'mark the four real ones' },
      ],
      scene: s => scene5(s.kind, !!s.showTrue),
      readouts: [
        { key: 'a', label: 'non-zero at λ = 0.02', tone: 'cyan', get: s => nzAt(s.kind, 0.02), d: 0 },
        { key: 'b', label: 'non-zero at λ = 0.35', tone: 'purple', get: s => nzAt(s.kind, 0.35), d: 0 },
        { key: 'c', label: 'columns that really matter', tone: 'green', get: () => 4, d: 0 },
      ],
    },

    /* ── 6 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'nothing above tells you which λ',
      prose: `<p>The penalty is a knob and the data has to turn it. Split the rows into eight folds; for each λ, fit on seven and score on the eighth, eight times; average.</p>
        <p>The curve has a minimum, and that minimum is the honest estimate of out-of-sample error — honest because the fold being scored took no part in the fit.</p>
        <p>Then a refinement worth having. The minimum of a noisy curve is itself noisy, and the curve near the bottom is nearly flat, so the exact minimiser is not a meaningful choice. The <b>one-standard-error rule</b> takes the largest λ whose error is still within one standard error of the best. You give up a sliver of measured accuracy for a model that is genuinely simpler — here, from ${NZ_MIN} non-zero coefficients down to ${NZ_1SE}.</p>`,
      controls: [
        { type: 'segment', key: 'kind', label: 'penalty', options: [
          { value: 'lasso', label: 'lasso' }, { value: 'ridge', label: 'ridge' },
        ] },
      ],
      scene: s => scene6(s.kind),
      readouts: [
        { key: 'm', label: 'λ at the minimum', tone: 'gold', get: s => CV[s.kind].best.lam, d: 4 },
        { key: 'e', label: 'cv error there', tone: 'warm', get: s => CV[s.kind].best.mse, d: 3 },
        { key: 'o', label: 'λ by the 1-se rule', tone: 'cyan', get: s => CV[s.kind].oneSe.lam, d: 4 },
        { key: 'n', label: 'coefficients kept at 1-se', tone: 'green',
          get: s => (s.kind === 'ridge' ? 20 : lasso(STD.Z, D.y, CV.lasso.oneSe.lam).beta.filter(v => v !== 0).length), d: 0 },
      ],
    },

    /* ── 7 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'what you are actually buying',
      prose: `<p>Squared error at a point splits cleanly into two pieces: how far the <em>average</em> fit is from the truth, and how much the fit <em>jumps around</em> between samples. Bias and variance.</p>
        <p>This is not a proof, it is sixty independent samples at each λ, refitted, with the truth known. Watch the two pieces separately.</p>
        <p>Variance falls from <b>${BV[0].variance.toFixed(1)}</b> to <b>${BV[BV.length - 1].variance.toFixed(1)}</b>. Bias² climbs from <b>${BV[0].bias2.toFixed(2)}</b> to <b>${BV[BV.length - 1].bias2.toFixed(1)}</b>. Their sum has a minimum in the middle, at total error <b>${Math.min(...BV.map(r => r.total)).toFixed(2)}</b> against <b>${BV[0].total.toFixed(2)}</b> for the unpenalised fit.</p>
        <p>An unbiased estimator is not the goal. It never was. The goal is to be close, and being deliberately, slightly wrong on average is often the cheapest way to stop being wildly wrong in particular.</p>`,
      beats: [
        { label: 'variance', scene: () => scene7(0), hold: 1400 },
        { label: 'bias²', scene: () => scene7(1), hold: 1400 },
        { label: 'their sum', scene: () => scene7(2), note: 'the minimum is not at λ = 0, and it is not at λ = ∞.' },
      ],
      readouts: [
        { key: 'v', label: 'variance at λ→0', tone: 'warm', get: () => BV[0].variance, d: 2 },
        { key: 'b', label: 'bias² at λ→0', tone: 'cold', get: () => BV[0].bias2, d: 3 },
        { key: 'm', label: 'best total error', tone: 'green', get: () => Math.min(...BV.map(r => r.total)), d: 3 },
        { key: 'z', label: 'total error unpenalised', tone: 'muted', get: () => BV[0].total, d: 3 },
      ],
    },

    /* ── 8 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'the two columns that are nearly the same column',
      prose: `<p>Columns 1 and 2 in this data have a correlation of <b>${st.pearson(D.X.map(r => r[0]), D.X.map(r => r[1])).toFixed(3)}</b>. Both genuinely matter. Least squares cannot tell them apart and gives them wild, opposed coefficients.</p>
        <p>Ridge <b>shares</b>: the squared penalty is cheapest when a fixed total is split evenly, so two identical columns each get half. That is a sensible thing to report — you have two measurements of one thing.</p>
        <p>Lasso <b>picks</b>: the absolute penalty is indifferent between splitting and concentrating, so it takes whichever one is marginally luckier and drops the other entirely. Rerun on a fresh sample and it may pick the other one. The story you tell about which variable matters is then an artefact of the sample.</p>
        <p>Elastic net is the obvious repair: charge for both at once. Slide α from lasso to ridge and watch the pair come back together.</p>`,
      controls: [
        { type: 'slider', key: 'alpha', label: 'α · 1 = lasso, 0 = ridge', min: 0, max: 1, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
      ],
      scene: s => scene8(+s.alpha),
      readouts: [
        { key: 'r', label: 'correlation of the pair', tone: 'muted', get: () => st.pearson(D.X.map(r => r[0]), D.X.map(r => r[1])), d: 3 },
        { key: 'b1', label: 'β₁', tone: 'warm', get: s => enet(+s.alpha)[0], d: 3 },
        { key: 'b2', label: 'β₂', tone: 'cold', get: s => enet(+s.alpha)[1], d: 3 },
        { key: 'g', label: 'gap between them', tone: 'gold', get: s => Math.abs(enet(+s.alpha)[0] - enet(+s.alpha)[1]), d: 3 },
      ],
    },

    /* ── 9 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'two ways to get this silently wrong',
      prose: `<p><b>Not standardising.</b> The penalty is charged in the units of each column. Put one predictor in millimetres beside one in kilometres and the millimetre column's coefficient is a million times larger for reasons that have nothing to do with the world — so the penalty lands almost entirely on it. Below, the same model, once with the columns left in their own units. It is not slightly different. It selects a different set of variables.</p>
        <p><b>Penalising the intercept.</b> The intercept is not a claim about any predictor; it is where y sits when everything else is at its mean. Shrink it and you are shrinking the outcome toward zero, which is an arbitrary number that depends on what units y is in. Every implementation you will use leaves it alone — and it is worth knowing that is a deliberate exemption rather than an oversight.</p>`,
      beats: [
        { label: 'standardised', scene: () => scene9(0), hold: 1600 },
        { label: 'raw units', scene: () => scene9(1), note: 'one column arbitrarily rescaled. the penalty now falls almost entirely on it.' },
      ],
      readouts: [
        { key: 'a', label: 'kept · standardised', tone: 'green', wide: true, get: () => KEPT.join(', ') },
        { key: 'b', label: 'kept · unscaled', tone: 'warm', wide: true, get: () => UNSCALED.kept.join(', ') },
      ],
    },

    /* ── 10 ────────────────────────────────────────────────────────────────── */
    {
      title: 'what the penalty is claiming',
      prose: `<p>Ridge and lasso are not neutral repairs. Each one is a statement about the world, and it is worth saying it out loud before using it.</p>
        <p><b>Ridge says:</b> everything matters a little, nothing matters enormously. That is the right bet for genetics, for survey items, for anything where a hundred small correlated causes are the honest description.</p>
        <p><b>Lasso says:</b> most of these columns are irrelevant and a handful are not. Right for wide screens where you genuinely expect a few signals in a thousand candidates.</p>
        <p>If you turn the Bayesian handle, the correspondence is exact: ridge is the posterior mode under a normal prior on the coefficients, lasso under a Laplace prior — one with a sharp spike at zero. The penalty <em>is</em> the prior, written in optimisation notation. Which also settles a common misunderstanding: cross-validation is not choosing whether to have an opinion. It is choosing how strong the one you already committed to should be.</p>`,
      scene: () => scene10(),
      readouts: [
        { key: 'a', label: 'ridge · cv error', tone: 'cyan', get: () => CV.ridge.best.mse, d: 3 },
        { key: 'b', label: 'lasso · cv error', tone: 'purple', get: () => CV.lasso.best.mse, d: 3 },
        { key: 'c', label: 'the truth here is sparse', tone: 'green', wide: true, get: () => '4 of 20 columns' },
      ],
    },

  ],
};

/* ── derived bits ─────────────────────────────────────────────────────────── */

const nzAt = (kind, lam) => {
  const b = kind === 'ridge' ? ridge(STD.Z, D.y, lam * D.n).beta : lasso(STD.Z, D.y, lam).beta;
  return b.filter(v => Math.abs(v) > 1e-9).length;
};

const ENET = new Map();
function enet(alpha) {
  const k = alpha.toFixed(2);
  if (!ENET.has(k)) ENET.set(k, elastic(STD.Z, D.y, 0.22, Math.max(alpha, 0.001)).beta);
  return ENET.get(k);
}

/* the same fit with column 5 left in absurd units, to show the penalty follow it */
const UNSCALED = (() => {
  const X2 = D.X.map(r => r.map((v, j) => (j === 5 ? v * 900 : j === 0 ? v * 0.001 : v)));
  const b = lasso(X2, D.y, CV.lasso.oneSe.lam).beta;
  return { beta: b, kept: b.map((v, i) => (v !== 0 ? i : -1)).filter(i => i >= 0) };
})();

/* ── scenes ───────────────────────────────────────────────────────────────── */

function scene1(upTo) {
  const f = frame({ w: 720, h: 500, l: 66, r: 120, t: 34, b: 58 })
    .setX(1, 26).setY(0, 30);
  const out = [axes(f, { xLabel: 'columns in the model', yLabel: 'mean squared error', xN: 6, yN: 6 })];
  const series = [
    { key: 'train', get: r => r.train, cls: 'curve curve-fit', lab: 'training rows', labCls: 'lab-sm lab-green' },
    { key: 'test', get: r => r.test, cls: 'curve curve-warm', lab: 'rows it has not seen', labCls: 'lab-sm lab-warm' },
  ];
  series.slice(0, upTo + 1).forEach((s, si) => {
    out.push(path(`s1-${s.key}`, OVERFIT.map(r => [f.sx(r.p), f.sy(Math.min(r[s.key], 30))]), { cls: s.cls, delay: si * 200 }));
    const last = OVERFIT[OVERFIT.length - 1];
    out.push(label(`s1-l-${s.key}`, f.sx(last.p) + 10, f.sy(Math.min(last[s.key], 30)) + 4, s.lab, { cls: s.labCls, delay: si * 200 }));
  });
  out.push(label('s1-n', f.x0 + 8, f.y1 + 14, '30 rows, whatever the width', { cls: 'lab-sm lab-gold' }));
  return out;
}

function scene2(s) {
  const { beta, lam } = fitAt(s);
  const f = frame({ w: 720, h: 500, l: 44, r: 26, t: 46, b: 62 })
    .setX(-0.6, 19.6).setY(-2.6, 3.0);
  const out = [
    axes(f, { xLabel: 'column', yLabel: 'coefficient', xN: 5, yN: 6 }),
    hLine(f, 0, { key: 's2-zero', cls: 'rule rule-faint' }),
  ];
  beta.forEach((b, j) => {
    const real = j < 4;
    const dead = Math.abs(b) < 1e-9;
    out.push(rect(`s2-b${j}`, f.sx(j) - 11, f.sy(0), 22, f.sy(b) - f.sy(0), {
      cls: dead ? 'bar bar-dim' : real ? 'bar bar-warm' : 'bar bar-cold',
      opacity: dead ? 0.35 : 1,
      tip: `column ${j}${real ? ' (real effect ' + D.truth[j].toFixed(1) + ')' : ' (noise)'} → ${b.toFixed(3)}`,
    }));
  });
  out.push(label('s2-t', f.midX, 30, `${s.kind} at λ = ${lam.toFixed(3)}`, { cls: 'lab-big lab-mid lab-gold' }));
  out.push(label('s2-k', f.x0 + 6, f.y1 + 8, 'orange: the four that matter · violet: pure noise', { cls: 'lab-sm' }));
  return out;
}

function scene3(z) {
  const LAM = 0.8;
  const f = frame({ w: 720, h: 500, l: 70, r: 40, t: 40, b: 62 })
    .setX(-3, 3).setY(-3, 3);
  const out = [
    axes(f, { xLabel: 'what least squares wanted', yLabel: 'what the penalty leaves', xN: 7, yN: 7 }),
    path('s3-id', [[f.sx(-3), f.sy(-3)], [f.sx(3), f.sy(3)]], { cls: 'curve curve-ghost curve-dash' }),
    fnPath(f, x => x / (1 + LAM), { key: 's3-ridge', cls: 'curve curve-cyan' }),
    fnPath(f, x => soft(x, LAM), { key: 's3-lasso', cls: 'curve curve-purple' }),
    label('s3-lr', f.sx(2.6), f.sy(2.6 / (1 + LAM)) - 10, 'ridge', { cls: 'lab lab-cyan' }),
    label('s3-ll', f.sx(2.6), f.sy(soft(2.6, LAM)) - 10, 'lasso', { cls: 'lab lab-purple' }),
    label('s3-li', f.sx(-2.7), f.sy(-2.6) - 10, 'no penalty', { cls: 'lab-sm' }),
    rect('s3-flat', f.sx(-LAM), f.sy(0) - 1, f.sx(LAM) - f.sx(-LAM), 2, { cls: 'bar bar-warm' }),
    label('s3-flatl', f.sx(0), f.sy(0) + 22, `anything inside ±λ becomes exactly zero`, { cls: 'lab-sm lab-mid lab-warm' }),
    vLine(f, z, { key: 's3-z', cls: 'rule rule-gold' }),
    { key: 's3-pr', tag: 'circle', cls: 'pt pt-cyan', attrs: { cx: f.sx(z), cy: f.sy(z / (1 + LAM)), r: 7 } },
    { key: 's3-pl', tag: 'circle', cls: 'pt pt-purple', attrs: { cx: f.sx(z), cy: f.sy(soft(z, LAM)), r: 7 } },
    numLabel('s3-vr', f.sx(z) + 12, f.sy(z / (1 + LAM)) + 4, z / (1 + LAM), { cls: 'lab lab-cyan', d: 3 }),
    numLabel('s3-vl', f.sx(z) + 12, f.sy(soft(z, LAM)) + 4, soft(z, LAM), { cls: 'lab lab-purple', d: 3 }),
  ];
  return out;
}

function scene4(stage) {
  const f = frame({ w: 720, h: 500, l: 70, r: 40, t: 36, b: 58 })
    .setX(-1.4, 3.2).setY(-1.4, 3.2);
  const B = [2.1, 1.35];                    // where least squares lands
  const budget = 1.35;
  const out = [
    axes(f, { xLabel: 'β₁', yLabel: 'β₂', xN: 5, yN: 5 }),
    hLine(f, 0, { key: 's4-h', cls: 'rule rule-faint' }),
    vLine(f, 0, { key: 's4-v', cls: 'rule rule-faint' }),
  ];
  // elliptical RSS contours around the least-squares solution, tilted by the
  // correlation between the two columns
  const th = -0.62, ct = Math.cos(th), stt = Math.sin(th);
  [0.55, 1.0, 1.5, 2.1].forEach((r, i) => {
    const pts = range(97).map(k => {
      const a = (k / 96) * Math.PI * 2;
      const u = r * 1.5 * Math.cos(a), v = r * 0.45 * Math.sin(a);
      return [f.sx(B[0] + u * ct - v * stt), f.sy(B[1] + u * stt + v * ct)];
    });
    out.push(path(`s4-e${i}`, pts, { cls: 'curve curve-ghost', opacity: 0.55, close: true, delay: i * 60 }));
  });
  out.push({ key: 's4-ols', tag: 'circle', cls: 'pt pt-warm', attrs: { cx: f.sx(B[0]), cy: f.sy(B[1]), r: 7 } });
  out.push(label('s4-olsl', f.sx(B[0]) + 12, f.sy(B[1]) - 8, 'least squares', { cls: 'lab lab-warm' }));

  if (stage === 1) {
    const pts = range(97).map(k => {
      const a = (k / 96) * Math.PI * 2;
      return [f.sx(budget * Math.cos(a)), f.sy(budget * Math.sin(a))];
    });
    out.push(path('s4-region', pts, { cls: 'area area-cold', close: true, opacity: 0.5 }));
    out.push(path('s4-regionl', pts, { cls: 'curve curve-cyan', close: true }));
    const hit = touchCircle(B, budget, th);
    out.push({ key: 's4-hit', tag: 'circle', cls: 'pt pt-cyan', attrs: { cx: f.sx(hit[0]), cy: f.sy(hit[1]), r: 8 } });
    out.push(label('s4-hl', f.sx(hit[0]) - 14, f.sy(hit[1]) - 12,
      `β₁ = ${hit[0].toFixed(2)}, β₂ = ${hit[1].toFixed(2)}`, { cls: 'lab lab-cyan lab-end' }));
    out.push(label('s4-note', f.midX, f.y1 - 10, 'a circle has no corners — both survive', { cls: 'lab-sm lab-mid lab-cyan' }));
  }
  if (stage === 2) {
    const pts = [[budget, 0], [0, budget], [-budget, 0], [0, -budget]].map(([a, b]) => [f.sx(a), f.sy(b)]);
    out.push(path('s4-region', pts, { cls: 'area area-cold', close: true, opacity: 0.5 }));
    out.push(path('s4-regionl', pts, { cls: 'curve curve-purple', close: true }));
    out.push({ key: 's4-hit', tag: 'circle', cls: 'pt pt-purple', attrs: { cx: f.sx(budget), cy: f.sy(0), r: 9 } });
    out.push(label('s4-hl', f.sx(budget) + 14, f.sy(0) + 22, `β₁ = ${budget.toFixed(2)}, β₂ = 0`, { cls: 'lab lab-purple' }));
    out.push(label('s4-note', f.midX, f.y1 - 10, 'the corner sits on the axis — β₂ is deleted', { cls: 'lab-sm lab-mid lab-purple' }));
  }
  return out;
}

/** the point on the circle of radius r closest to B in the tilted metric */
function touchCircle(B, r, th) {
  let best = null, bd = Infinity;
  const ct = Math.cos(th), stt = Math.sin(th);
  for (let k = 0; k < 720; k++) {
    const a = (k / 720) * Math.PI * 2;
    const p = [r * Math.cos(a), r * Math.sin(a)];
    const dx = p[0] - B[0], dy = p[1] - B[1];
    const u = dx * ct + dy * stt, v = -dx * stt + dy * ct;
    const d = (u / 1.5) ** 2 + (v / 0.45) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function scene5(kind, showTrue) {
  const P = PATH[kind];
  const f = frame({ w: 720, h: 500, l: 66, r: 60, t: 38, b: 60 })
    .setX(Math.log(LAMBDAS[0]), Math.log(LAMBDAS[LAMBDAS.length - 1]))
    .setY(-2.4, 3.0);
  const out = [
    axes(f, {
      xLabel: 'λ  (log scale)', yLabel: 'coefficient', yN: 6, xN: 5,
      xFmt: v => Math.exp(v).toFixed(v > 0 ? 1 : 3),
    }),
    hLine(f, 0, { key: 's5-zero', cls: 'rule rule-faint' }),
  ];
  range(D.p).forEach(j => {
    const real = j < 4;
    const pts = P.map(r => [f.sx(Math.log(r.lam)), f.sy(r.beta[j])]);
    out.push(path(`s5-c${j}`, pts, {
      cls: real && showTrue ? 'curve curve-warm' : 'curve curve-cold',
      opacity: real && showTrue ? 1 : 0.42,
      tip: `column ${j}${real ? ` · real effect ${D.truth[j].toFixed(1)}` : ' · noise'}`,
    }));
  });
  out.push(label('s5-t', f.midX, 28, kind === 'ridge'
    ? 'ridge — everything approaches zero, nothing arrives'
    : 'lasso — they hit zero one by one and stay there',
    { cls: 'lab lab-mid lab-gold' }));
  out.push(label('s5-k', f.x1 - 4, f.y1 + 8,
    showTrue ? 'orange: the four real ones' : 'all twenty, unmarked', { cls: 'lab-sm lab-end' }));
  return out;
}

function scene6(kind) {
  const cv = CV[kind];
  const f = frame({ w: 720, h: 500, l: 70, r: 40, t: 40, b: 60 })
    .setX(Math.log(LAMBDAS[0]), Math.log(LAMBDAS[LAMBDAS.length - 1]))
    .setY(Math.min(...cv.rows.map(r => r.mse - r.se)) * 0.96,
      Math.min(Math.max(...cv.rows.map(r => r.mse)), cv.best.mse * 3.2));
  const out = [
    axes(f, {
      xLabel: 'λ  (log scale)', yLabel: 'cross-validated mse', yN: 6, xN: 5,
      xFmt: v => Math.exp(v).toFixed(v > 0 ? 1 : 3),
    }),
  ];
  const band = [
    ...cv.rows.map(r => [f.sx(Math.log(r.lam)), f.sy(r.mse + r.se)]),
    ...cv.rows.slice().reverse().map(r => [f.sx(Math.log(r.lam)), f.sy(r.mse - r.se)]),
  ];
  out.push(path('s6-band', band, { cls: 'area area-faint', close: true }));
  out.push(path('s6-curve', cv.rows.map(r => [f.sx(Math.log(r.lam)), f.sy(r.mse)]), { cls: 'curve curve-warm' }));
  out.push(hLine(f, cv.ceiling, { key: 's6-ceil', cls: 'rule rule-dash' }));
  out.push(label('s6-ceill', f.x1 - 4, f.sy(cv.ceiling) - 8, 'one standard error above the minimum', { cls: 'lab-sm lab-end' }));
  out.push(vLine(f, Math.log(cv.best.lam), { key: 's6-best', cls: 'rule rule-gold' }));
  out.push(label('s6-bestl', f.sx(Math.log(cv.best.lam)), f.y1 - 10, 'minimum', { cls: 'lab lab-gold lab-mid' }));
  out.push(vLine(f, Math.log(cv.oneSe.lam), { key: 's6-1se', cls: 'rule rule-x' }));
  out.push(label('s6-1sel', f.sx(Math.log(cv.oneSe.lam)), f.y1 + 10, '1-se choice', { cls: 'lab lab-cyan lab-mid' }));
  return out;
}

function scene7(upTo) {
  const f = frame({ w: 720, h: 500, l: 70, r: 110, t: 38, b: 60 })
    .setX(Math.log(BV[0].lam), Math.log(BV[BV.length - 1].lam))
    .setY(0, Math.max(...BV.map(r => r.total)) * 1.04);
  const out = [axes(f, {
    xLabel: 'λ  (log scale)', yLabel: 'squared error at a test point', yN: 6, xN: 5,
    xFmt: v => Math.exp(v).toFixed(v > 0 ? 1 : 3),
  })];
  const series = [
    { k: 'variance', cls: 'curve curve-cold', lab: 'variance', labCls: 'lab-sm lab-cold' },
    { k: 'bias2', cls: 'curve curve-warm', lab: 'bias²', labCls: 'lab-sm lab-warm' },
    { k: 'total', cls: 'curve curve-fit', lab: 'their sum', labCls: 'lab-sm lab-green' },
  ];
  series.slice(0, upTo + 1).forEach((s, si) => {
    out.push(path(`s7-${s.k}`, BV.map(r => [f.sx(Math.log(r.lam)), f.sy(r[s.k])]), { cls: s.cls, delay: si * 180 }));
    const last = BV[BV.length - 1];
    out.push(label(`s7-l-${s.k}`, f.sx(Math.log(last.lam)) + 10, f.sy(last[s.k]) + 4, s.lab, { cls: s.labCls, delay: si * 180 }));
  });
  if (upTo >= 2) {
    const best = BV.reduce((a, b) => (b.total < a.total ? b : a));
    out.push(vLine(f, Math.log(best.lam), { key: 's7-best', cls: 'rule rule-gold' }));
    out.push(label('s7-bl', f.sx(Math.log(best.lam)), f.y1 - 10,
      `best total error ${best.total.toFixed(2)} at λ = ${best.lam}`, { cls: 'lab lab-gold lab-mid' }));
  }
  return out;
}

function scene8(alpha) {
  const b = enet(alpha);
  const f = frame({ w: 720, h: 500, l: 60, r: 34, t: 46, b: 62 })
    .setX(-0.6, 5.6).setY(-2.4, 3.2);
  const names = ['β₁', 'β₂ (≈ β₁)', 'β₃', 'β₄', 'noise 5', 'noise 6'];
  const out = [
    axes(f, { yLabel: 'coefficient', yN: 6, showX: false }),
    hLine(f, 0, { key: 's8-zero', cls: 'rule rule-faint' }),
  ];
  range(6).forEach(j => {
    out.push(rect(`s8-b${j}`, f.sx(j) - 22, f.sy(0), 44, f.sy(b[j]) - f.sy(0), {
      cls: j === 0 ? 'bar bar-warm' : j === 1 ? 'bar bar-cold' : j < 4 ? 'bar' : 'bar bar-dim',
      tip: `${names[j]} → ${b[j].toFixed(3)} (true ${D.truth[j].toFixed(1)})`,
    }));
    out.push(label(`s8-n${j}`, f.sx(j), f.y0 + 20, names[j], { cls: 'lab-sm lab-mid' }));
    out.push(label(`s8-tr${j}`, f.sx(j), f.sy(D.truth[j]) - 6, '─ true', { cls: 'lab-sm lab-mid lab-green' }));
  });
  out.push(label('s8-t', f.midX, 30,
    alpha > 0.85 ? 'α = 1 · pure lasso — it keeps one of the pair and drops the other'
      : alpha < 0.2 ? 'α → 0 · pure ridge — the pair splits the effect evenly'
        : `α = ${alpha.toFixed(2)} · elastic net — sharing comes back`,
    { cls: 'lab lab-mid lab-gold' }));
  return out;
}

function scene9(mode) {
  const b = mode ? UNSCALED.beta : CHOSEN.lasso;
  const kept = mode ? UNSCALED.kept : KEPT;
  const f = frame({ w: 720, h: 500, l: 46, r: 26, t: 48, b: 62 })
    .setX(-0.6, 19.6).setY(-1, 1);
  const mx = Math.max(...b.map(v => Math.abs(v))) || 1;
  const out = [
    axes(f, { xLabel: 'column', yN: 5, showY: false }),
    hLine(f, 0, { key: 's9-zero', cls: 'rule rule-faint' }),
  ];
  b.forEach((v, j) => {
    const on = Math.abs(v) > 1e-12;
    out.push(rect(`s9-b${j}`, f.sx(j) - 11, f.sy(0), 22, f.sy(v / mx) - f.sy(0), {
      cls: !on ? 'bar bar-dim' : j < 4 ? 'bar bar-warm' : 'bar bar-cold',
      opacity: on ? 1 : 0.3,
      tip: `column ${j} → ${v.toExponential(2)}${j < 4 ? ' · real effect' : ' · noise'}`,
    }));
  });
  out.push(label('s9-t', f.midX, 30, mode
    ? 'columns left in their own units — column 5 scaled by 900, column 0 by 0.001'
    : 'columns standardised before the penalty is applied',
    { cls: 'lab lab-mid lab-gold' }));
  out.push(label('s9-k', f.midX, f.y1 + 6, `kept: ${kept.join(', ') || 'nothing'}`,
    { cls: `lab-sm lab-mid lab-${mode ? 'warm' : 'green'}` }));
  out.push(label('s9-s', f.midX, f.y1 + 24, 'bar heights are relative — the point is which bars exist',
    { cls: 'lab-sm lab-mid' }));
  return out;
}

function scene10() {
  const f = frame({ w: 720, h: 500, l: 70, r: 40, t: 40, b: 60 })
    .setX(-3, 3).setY(0, 1.05);
  const lap = x => Math.exp(-Math.abs(x) / 0.55) / (2 * 0.55);
  const nor = x => Math.exp(-(x * x) / (2 * 0.62 * 0.62)) / (0.62 * Math.sqrt(2 * Math.PI));
  const mx = Math.max(lap(0), nor(0));
  return [
    axes(f, { xLabel: 'a coefficient, before seeing the data', yLabel: 'prior density', xN: 7, showY: false }),
    fnPath(f, x => nor(x) / mx, { key: 's10-n', cls: 'curve curve-cyan' }),
    fnPath(f, x => lap(x) / mx, { key: 's10-l', cls: 'curve curve-purple' }),
    label('s10-nl', f.sx(1.5), f.sy(nor(1.5) / mx) - 12, 'normal prior → ridge', { cls: 'lab lab-cyan' }),
    label('s10-ll', f.sx(-1.6), f.sy(lap(1.6) / mx) - 12, 'laplace prior → lasso', { cls: 'lab lab-purple lab-end' }),
    label('s10-sp', f.sx(0), f.sy(1) - 14, 'the spike is the whole story', { cls: 'lab-sm lab-mid lab-gold' }),
    label('s10-note', f.midX, f.y1 + 18,
      'a penalty is a prior. cross-validation only sets how loudly you assert it.',
      { cls: 'lab-sm lab-mid lab-green' }),
  ];
}
