/* ─────────────────────────────────────────────────────────────────────────────
   gradientdescent.js — rolling downhill.

   Almost nothing on this site has a closed-form answer. Correlation and OLS do;
   logistic regression, Poisson regression, splines with penalties, every neural
   network and every Bayesian sampler do not. What they have instead is this:
   find the slope, take a step against it, repeat.

   The lesson is built to make one parameter — the step size — feel physical.
   Everything else is scaffolding for that.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, points, label, numLabel, path, rect, fnPath, surface, boundary, arrowDefs } from '../core/plot.js';
import { knobCards } from '../core/knobs.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sub, sup, hat, eq, minus, plus, times, paren, sumOver, op } from '../core/fx.js';

/* ── the hill (steps 1–5) ─────────────────────────────────────────────────── */

const MINX = 2;
const hill = x => 0.5 * (x - MINX) * (x - MINX) + 1.5;
const dhill = x => x - MINX;            /* the exact derivative, no approximation */

/** the whole trajectory, so any beat can show the first k steps of it */
function walk(x0, eta, n = 40, { grad = dhill } = {}) {
  const xs = [x0];
  let x = x0;
  for (let i = 0; i < n; i++) {
    x = x - eta * grad(x);
    if (!isFinite(x) || Math.abs(x) > 1e6) { xs.push(clamp(x, -1e6, 1e6)); break; }
    xs.push(x);
  }
  return xs;
}

const H = () => { const f = frame({ w: 720, h: 540, l: 68, r: 40, t: 46, b: 74 }); f.setX(-6, 10); f.setY(0, 34); return f; };

function hillAxes(f, { dur } = {}) {
  const out = [
    { key: 'hx', tag: 'line', cls: 'ax-line', dur, attrs: { x1: f.x0, y1: f.y0, x2: f.x1, y2: f.y0 } },
    { key: 'hy', tag: 'line', cls: 'ax-line', dur, attrs: { x1: f.x0, y1: f.y0, x2: f.x0, y2: f.y1 } },
    label('hxl', (f.x0 + f.x1) / 2, f.y0 + 34, 'x  ·  the thing you get to choose', { cls: 'ax-label', dur }),
    { key: 'hyl', tag: 'text', cls: 'ax-label', dur, attrs: { x: 0, y: 0 }, set: { transform: `translate(20 ${(f.y0 + f.y1) / 2}) rotate(-90)` }, text: 'how bad it is' },
  ];
  for (let v = -6; v <= 10; v += 2) out.push(label('hxt' + v, f.sx(v), f.y0 + 17, String(v), { cls: 'ax-tick', dur }));
  return out;
}

/* ── the data and its loss surface (steps 6–10) ───────────────────────────── */

const PTS = [[1, 2.4], [2, 3.1], [3, 4.6], [4, 4.9], [5, 6.4], [6, 6.6], [7, 8.3], [8, 8.6]];
const XZ = st.zscores(PTS.map(p => p[0]));   /* centred, sd 1 — a round bowl */
const YZ = st.zscores(PTS.map(p => p[1]));
const XOFF = XZ.map(v => v + 3);             /* the same data, not centred — a canyon */
const N = PTS.length;

const xsOf = s => (s.centred ? XZ : XOFF);

/** mean squared error, and its two partial derivatives */
function loss(s, b0, b1) {
  const x = xsOf(s);
  return st.mean(x.map((v, i) => (YZ[i] - b0 - b1 * v) ** 2));
}
function grad(s, b0, b1) {
  const x = xsOf(s);
  const r = x.map((v, i) => YZ[i] - b0 - b1 * v);
  return [(-2 / N) * st.sum(r), (-2 / N) * st.sum(r.map((e, i) => e * x[i]))];
}

/** the best fit, so the drawing always knows where the bottom is */
function best(s) {
  const x = xsOf(s);
  const f = st.linreg(x, YZ);
  return [f.b0, f.b1];
}

/** descent over both parameters, optionally with momentum */
function walk2(s, { eta, mu = 0, steps = 60, start }) {
  const p = [start.slice()];
  let b = start.slice(), v = [0, 0];
  for (let i = 0; i < steps; i++) {
    const g = grad(s, b[0], b[1]);
    v = [mu * v[0] - eta * g[0], mu * v[1] - eta * g[1]];
    b = [b[0] + v[0], b[1] + v[1]];
    if (!isFinite(b[0]) || !isFinite(b[1]) || Math.abs(b[0]) > 1e4) break;
    p.push(b.slice());
  }
  return p;
}

/** the loss landscape frame, sized to hold the walk and the optimum */
function bowlFrame(s, { l = 372, r = 34, t = 52, b = 74 } = {}) {
  const f = frame({ w: 720, h: 540, l, r, t, b });
  if (s.centred) { f.setX(-1.6, 1.6); f.setY(-0.6, 2.0); }
  else { f.setX(-3.4, 1.2); f.setY(-0.4, 1.6); }
  return f;
}

const LMAX = s => loss(s, s.centred ? -1.6 : -3.4, s.centred ? 2.0 : 1.6);

/* ── formula pieces ───────────────────────────────────────────────────────── */

const fEta = t('η', { explain: 'The learning rate, or step size. How far you move for a given amount of slope. The single most consequential number in machine learning.', tone: 'gold', link: 'eta' });
const fGrad = t('∇L' + paren('θ'), { explain: 'The gradient: the slope of the loss in every direction at once. It points uphill, which is why the update subtracts it.', tone: 'warm', link: 'grad' });
const fTheta = t('θ', { explain: 'Whatever you are choosing — one number here, two in a moment, forty million in a large model. The mathematics does not change.', tone: 'cyan', link: 'theta' });

export default {
  meta: {
    id: 'gradientdescent', title: 'gradient descent', short: 'gradient descent',
    kicker: 'ROLLING DOWNHILL', status: 'live',
    deck: 'Correlation and least squares have exact answers you can write down. Almost nothing else does. What everything else has instead is one move, repeated: measure the slope, step against it, look again. This is the engine inside every model on this site that does not have a formula.',
    dataNote: 'The hill in the first half is a function you can see all of, which is exactly the situation you will never be in. The second half fits a real line to real points, and there the hill is the error.',
    deps: ['derivatives', 'linreg'], unlocks: [],
    next: 'neuralnet', nextLabel: 'neural networks',
    outro: 'measure the slope. step against it. look again. that is the whole algorithm, and it is running in every model you have ever used.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: {
    eta: 0.6, x0: -4.5, nsteps: 1,
    eta2: 0.25, mu: 0, k2: 1, centred: true,
  },

  steps: [

    /* ── 1 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'a hill, and you are standing on it',
      prose: `<p>Here is a curve. Left to right is a number you get to choose. Up is how bad that choice is.</p>
        <p>You want the bottom. That is the whole problem — every model on this site is some version of it.</p>
        <p>And here is the difficulty that makes the rest of the lesson necessary: you can see this curve because it was drawn for you. In a real problem you cannot. You are standing on it in fog, and all you can feel is the ground immediately under your feet.</p>`,
      beats: [
        { label: 'the hill', hold: 1300, note: 'A shape. Low is good.', scene: s => { const f = H(); return [hillAxes(f), fnPath(f, hill, { key: 'hill', cls: 'curve curve-ghost' })]; } },
        {
          label: 'you are here', hold: 1500,
          note: 'One dot: your current guess. It is nowhere near the bottom, and you have no way of knowing that.',
          scene: s => {
            const f = H();
            return [
              hillAxes(f), fnPath(f, hill, { key: 'hill', cls: 'curve curve-ghost' }),
              { key: 'dot', tag: 'circle', cls: 'pt pt-cyan link-theta', attrs: { cx: f.sx(s.x0), cy: f.sy(hill(s.x0)), r: 8 }, enter: { attrs: { r: 0 }, opacity: 0 } },
              label('dotl', f.sx(s.x0), f.sy(hill(s.x0)) - 18, 'you', { cls: 'lab lab-mid lab-cyan' }),
            ];
          },
        },
        {
          label: 'in the fog',
          note: 'What you can actually see. The curve is real; your access to it is not.',
          scene: s => {
            const f = H();
            const lo = s.x0 - 0.9, hi = s.x0 + 0.9;
            return [
              hillAxes(f),
              fnPath(f, hill, { key: 'hill', cls: 'curve curve-ghost', opacity: 0.09 }),
              fnPath(f, hill, { key: 'near', cls: 'curve', from: lo, to: hi }),
              { key: 'dot', tag: 'circle', cls: 'pt pt-cyan link-theta', attrs: { cx: f.sx(s.x0), cy: f.sy(hill(s.x0)), r: 8 } },
              label('fogl', f.sx(s.x0), f.sy(hill(s.x0)) - 24, 'all you can feel', { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
      ],
    },

    /* ── 2 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'feel the slope',
      prose: `<p>You can feel which way the ground tilts. That is a derivative, and you built it by squeezing a secant line until its two points merged.</p>
        <p>At this point the ground slopes <em>down to the right</em>, so the derivative is negative. Drag your starting position and watch the tangent tip over. On the far side it comes out positive. At the bottom it is exactly zero — which is the only place it is.</p>`,
      formula: formula(
        t('slope at θ', { tone: 'muted', cls: 'fx-tiny' }) + op('&nbsp;=&nbsp;') + t("L'", { tone: 'warm', link: 'grad' }) + paren(fTheta) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('negative → downhill is to the right', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'the sign tells you the direction; the size tells you how urgent it is' }),
      dep: { note: 'the slope at a single point is a', lesson: 'derivatives', label: 'derivative' },
      controls: [{ type: 'slider', key: 'x0', label: 'where you are standing', min: -5.5, max: 9, step: 0.1, fast: true, fmt: v => (+v).toFixed(1) }],
      readouts: [
        { key: 'x', label: 'your position', tone: 'cyan', get: s => s.x0, d: 2 },
        { key: 'l', label: 'how bad it is', tone: 'muted', get: s => hill(s.x0), d: 2 },
        { key: 'g', label: 'slope here', tone: 'warm', get: s => dhill(s.x0), d: 2, wide: true, explain: 'Negative means the ground falls away to the right. Zero means you have arrived.' },
      ],
      beats: [
        { label: 'the tangent', hold: 1500, note: 'The straight line that matches the curve exactly at your feet.', scene: s => tangentScene(s, false) },
        { label: 'which way is down', note: 'The slope is <b>negative</b>, so downhill is to the <b>right</b>. Drag yourself past the bottom and the arrow flips.', scene: s => tangentScene(s, true) },
      ],
    },

    /* ── 3 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'take one step against it',
      prose: `<p>Now the entire algorithm, in one line. Move in the direction opposite the slope, by an amount proportional to the slope.</p>
        <p>Proportional matters. Where the ground is steep you are probably far from the bottom, so take a big step. Where it flattens out you are probably close, so take a small one. The algorithm slows itself down automatically as it arrives — nobody has to tell it to.</p>
        <p>The constant of proportionality is <strong>η</strong>, and it is the only thing you get to choose.</p>`,
      formula: formula(
        fTheta + sub('', 'new') + eq + fTheta + minus + fEta + times + t("L'", { tone: 'warm', link: 'grad' }) + paren(fTheta) + '<br>' +
        t('steep ground → big step', { tone: 'muted', cls: 'fx-tiny' }) + op('&nbsp;&nbsp;·&nbsp;&nbsp;') +
        t('flat ground → small step', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'this is the whole of gradient descent. everything after it is bookkeeping.' }),
      controls: [
        { type: 'slider', key: 'eta', label: 'η  step size', min: 0.05, max: 2.6, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'slider', key: 'x0', label: 'where you start', min: -5.5, max: 9, step: 0.1, fast: true, fmt: v => (+v).toFixed(1) },
      ],
      readouts: [
        { key: 'g', label: 'slope', tone: 'warm', get: s => dhill(s.x0), d: 2 },
        { key: 'e', label: 'η', tone: 'gold', get: s => s.eta, d: 2 },
        { key: 'st', label: 'so you move', tone: 'green', get: s => -s.eta * dhill(s.x0), d: 2, wide: true },
        { key: 'to', label: 'landing at', tone: 'cyan', get: s => s.x0 - s.eta * dhill(s.x0), d: 2 },
      ],
      beats: [
        { label: 'the slope, again', hold: 1200, note: 'Where you are, and how the ground tilts.', scene: s => stepScene(s, 1) },
        { label: 'multiply by η', hold: 1400, note: 'Slope times η gives a distance. Nothing has moved yet — this is just the size of the move.', scene: s => stepScene(s, 2) },
        { label: 'move', hold: 1600, note: 'One step, against the slope. Change η and watch the same slope produce a different landing.', scene: s => stepScene(s, 3) },
      ],
    },

    /* ── 4 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'now do it again',
      prose: `<p>From the new position, feel the ground again. It is less steep now, so the next step is shorter. Then shorter again.</p>
        <p>Drag <strong>steps taken</strong> and watch the sequence lay itself down. The dots crowd together as they approach — not because anything told them to slow down, but because the slope they are multiplying by is shrinking.</p>
        <p>It never lands exactly on the bottom. It gets close enough that nobody can tell, which in practice is the same thing.</p>`,
      controls: [
        { type: 'slider', key: 'nsteps', label: 'steps taken', min: 0, max: 30, step: 1, fast: true },
        { type: 'slider', key: 'eta', label: 'η  step size', min: 0.05, max: 2.6, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
      ],
      readouts: [
        { key: 'n', label: 'steps', get: s => s.nsteps, d: 0 },
        { key: 'x', label: 'position now', tone: 'cyan', get: s => walk(s.x0, s.eta, s.nsteps)[s.nsteps], d: 4 },
        { key: 'l', label: 'how bad it is', tone: 'muted', get: s => hill(walk(s.x0, s.eta, s.nsteps)[s.nsteps]), d: 4 },
        { key: 'g', label: 'slope now', tone: 'warm', get: s => dhill(walk(s.x0, s.eta, s.nsteps)[s.nsteps]), d: 4, wide: true },
      ],
      beats: [
        { label: 'step 1', hold: 800, note: 'One.', scene: s => walkScene(s, 1) },
        { label: 'step 2', hold: 800, note: 'Two. Shorter, because the ground is less steep here.', scene: s => walkScene(s, 2) },
        { label: 'step 4', hold: 800, note: 'Four.', scene: s => walkScene(s, 4) },
        { label: 'step 8', hold: 1000, note: 'Eight. The steps are now too small to see individually.', scene: s => walkScene(s, 8) },
        { label: 'the whole walk', hold: 1600, note: 'Twenty. It is converging — approaching without arriving.', scene: s => walkScene(s, 20) },
        { label: 'your turn', note: 'Drag <b>steps taken</b> one at a time, then change η and drag again.', scene: s => walkScene(s, s.nsteps) },
      ],
    },

    /* ── 5 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'η is the whole game',
      prose: `<p>One parameter, four completely different behaviours. This is the step to spend time on.</p>
        <p><strong>Too small</strong> and it crawls: correct in direction, hopeless in practice, and indistinguishable from a bug. <strong>Just right</strong> and it lands in a handful of steps. <strong>Too big</strong> and it overshoots the bottom, comes back, overshoots the other way — converging, but wasting most of its motion. <strong>Far too big</strong> and each overshoot is worse than the last: it climbs the walls and leaves.</p>
        <p>On this particular hill the boundary is exactly η = 2, and the perfect step is exactly η = 1. Both numbers are properties of the curvature, not of the algorithm — which is why a learning rate that works on one problem is meaningless on another.</p>`,
      formula: formula(
        t('η < 1', { tone: 'cyan' }) + op('&nbsp;approach from one side&nbsp;·&nbsp;') +
        t('η = 1', { tone: 'green' }) + op('&nbsp;land exactly&nbsp;·&nbsp;') +
        t('1 < η < 2', { tone: 'gold' }) + op('&nbsp;zigzag in&nbsp;·&nbsp;') +
        t('η > 2', { tone: 'warm' }) + op('&nbsp;leave') + '<br>' +
        t('the boundary is 2 ÷ curvature, and curvature is a property of your problem', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'four regimes, one dial' }),
      controls: [
        { type: 'slider', key: 'eta', label: 'η  step size', min: 0.05, max: 2.6, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'slider', key: 'nsteps', label: 'steps taken', min: 0, max: 30, step: 1, fast: true },
      ],
      readouts: [
        { key: 'e', label: 'η', tone: 'gold', get: s => s.eta, d: 2 },
        { key: 'r', label: 'regime', get: s => s.eta > 2 ? 'diverging' : s.eta > 1 ? 'zigzag' : Math.abs(s.eta - 1) < 1e-9 ? 'exact' : 'creeping', wide: true },
        { key: 'x', label: 'after 30 steps', tone: 'cyan', get: s => { const w = walk(s.x0, s.eta, 30); const v = w[w.length - 1]; return Math.abs(v) > 1e5 ? 'gone' : v.toFixed(3); }, wide: true },
      ],
      beats: [
        { label: 'too small', hold: 1700, note: 'η = 0.1. Thirty steps and it is still not there. Every one of them was in the right direction.', scene: s => regime(s, 0.1, 30) },
        { label: 'just right', hold: 1700, note: 'η = 1. One step. The step size exactly cancels the curvature.', scene: s => regime(s, 1, 30) },
        { label: 'too big', hold: 1700, note: 'η = 1.7. It passes the bottom every time, but by less each time. Slow, ugly, and it does get there.', scene: s => regime(s, 1.7, 30) },
        { label: 'far too big', hold: 1900, note: 'η = 2.2. Each overshoot is larger than the last. The loss goes <em>up</em> — the classic sign that your learning rate is wrong, not your model.', scene: s => regime(s, 2.2, 12) },
        { label: 'your turn', note: 'Creep it across 2.0 and watch the walk stop coming back.', scene: s => regime(s, s.eta, s.nsteps || 30) },
      ],
      aside: `<p><strong>Reading the symptom.</strong> A loss that falls and then plateaus high means η is too small, or you stopped early. A loss that jumps around without a trend means η is too big. A loss that goes to infinity or NaN in a few iterations means η is far too big — and this is the single most common cause of a model "not working".</p>`,
    },

    /* ── 6 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'the hill is a loss function',
      prose: `<p>Time to stop inventing curves. Here is a real fitting problem, and the hill comes out of it.</p>
        <p>Left: eight points and a straight line through them, with the residuals drawn. Right: the same thing summarised as one number — the mean squared residual — plotted against the slope of the line.</p>
        <p>Every position on the right corresponds to a line on the left. Drag the slope and watch both move together. The curve on the right is not an analogy for the hill. It <em>is</em> the hill.</p>`,
      formula: formula(
        t('L', { tone: 'warm' }) + paren(t('b', { tone: 'cyan' })) + eq + frac('1', 'n') + sumOver(paren(sub('y', 'i') + minus + t('b', { tone: 'cyan' }) + sub('x', 'i')) + sup('', '2')) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('one number per candidate line', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'squared, so that missing by two is four times as bad as missing by one' }),
      dep: { note: 'squared residuals are the same quantity minimised in', lesson: 'linreg', label: 'least squares' },
      controls: [{ type: 'slider', key: 'eta2', label: 'slope of the line', min: -0.4, max: 1.8, step: 0.02, fast: true, fmt: v => (+v).toFixed(2) }],
      readouts: [
        { key: 'b', label: 'slope you picked', tone: 'cyan', get: s => s.eta2, d: 2 },
        { key: 'l', label: 'mean squared residual', tone: 'warm', get: s => st.mean(XZ.map((v, i) => (YZ[i] - s.eta2 * v) ** 2)), d: 4, wide: true },
        { key: 'bb', label: 'best possible', tone: 'green', get: s => st.linreg(XZ, YZ).b1, d: 3 },
      ],
      beats: [
        { label: 'the data', hold: 1200, note: 'Eight points, standardised so the numbers stay readable.', scene: s => lossCurve(s, 1) },
        { label: 'a line, and its misses', hold: 1400, note: 'One candidate slope. The red sticks are what it got wrong.', scene: s => lossCurve(s, 2) },
        { label: 'square them, average them', hold: 1500, note: 'Those eight misses collapse into one number. That number is the height of the hill at this slope.', scene: s => lossCurve(s, 3) },
        { label: 'try every slope', hold: 1700, note: 'Sweep the slope and plot the number. A parabola — the same shape you have been walking down all lesson.', scene: s => lossCurve(s, 4) },
        { label: 'roll down it', note: 'Now gradient descent has something to do. Drag the slope and watch the dot on the right move with the line on the left.', scene: s => lossCurve(s, 5) },
      ],
    },

    /* ── 7 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'two parameters make a bowl',
      prose: `<p>Real models have more than one number to choose. Let the intercept move as well and the hill becomes a surface: one height for every <em>pair</em> of values.</p>
        <p>Now "which way is down" needs two answers, one per direction. Stack them into a vector and it has a name: the <strong>gradient</strong>. It points straight uphill, and its length says how steep. Step against it and you are doing exactly what you did on the curve, twice at once.</p>`,
      formula: formula(
        fGrad + eq + t('[', { tone: 'muted' }) + frac('∂L', '∂' + sub('b', '0')) + ', ' + frac('∂L', '∂' + sub('b', '1')) + t(']', { tone: 'muted' }) + '<br>' +
        fTheta + sub('', 'new') + eq + fTheta + minus + fEta + times + fGrad +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('the same line as step 3, with θ now a pair', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'nothing new — the update is identical, it just has two components' }),
      controls: [
        { type: 'slider', key: 'k2', label: 'steps taken', min: 0, max: 40, step: 1, fast: true },
        { type: 'slider', key: 'eta2', label: 'η  step size', min: 0.02, max: 0.9, step: 0.01, fast: true, fmt: v => (+v).toFixed(2) },
      ],
      readouts: [
        { key: 'b0', label: 'intercept', tone: 'cyan', get: s => walk2(s, { eta: s.eta2, steps: 40, start: [1.4, -0.4] })[Math.min(s.k2, 40)]?.[0] ?? NaN, d: 3 },
        { key: 'b1', label: 'slope', tone: 'purple', get: s => walk2(s, { eta: s.eta2, steps: 40, start: [1.4, -0.4] })[Math.min(s.k2, 40)]?.[1] ?? NaN, d: 3 },
        { key: 'l', label: 'loss', tone: 'warm', get: s => { const p = walk2(s, { eta: s.eta2, steps: 40, start: [1.4, -0.4] })[Math.min(s.k2, 40)]; return p ? loss(s, p[0], p[1]) : NaN; }, d: 4, wide: true },
      ],
      beats: [
        { label: 'the surface', hold: 1500, note: 'Height is loss. Blue is low, red is high. The bottom of the bowl is the least-squares answer.', scene: s => bowl(s, 1) },
        { label: 'contours', hold: 1500, note: 'Rings of equal loss, like a contour map. Tightly packed means steep.', scene: s => bowl(s, 2) },
        { label: 'the gradient', hold: 1700, note: 'One arrow, pointing directly <em>uphill</em> and perpendicular to the contour you are standing on. That is not a coincidence — it is what "steepest" means.', scene: s => bowl(s, 3) },
        { label: 'step against it', hold: 1600, note: 'Flip the arrow, scale it by η, move. Exactly step 3, in two dimensions.', scene: s => bowl(s, 4) },
        { label: 'the path', note: 'Drag <b>steps taken</b>. Each step is perpendicular to the ring it started on, which is why the path bends.', scene: s => bowl(s, 5) },
      ],
    },

    /* ── 8 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'a canyon, and why you centre your predictors',
      prose: `<p>That bowl was round because the predictor was centred. Uncentre it — measure x in its original units, so its mean is nowhere near zero — and the bowl turns into a canyon.</p>
        <p>The two parameters are now entangled: raise the slope and the intercept must fall to compensate. The valley floor runs diagonally, and gradient descent, which always steps perpendicular to the contour, bounces across it instead of along it.</p>
        <p>Toggle <strong>centre x</strong> and watch the same algorithm with the same η go from a dozen steps to a hundred. Nothing about the model changed. Only the units did.</p>`,
      controls: [
        { type: 'toggle', key: 'centred', label: 'centre x', explain: 'Subtract the mean of x before fitting. It changes nothing about the fitted line, and everything about how hard it is to find.' },
        { type: 'slider', key: 'k2', label: 'steps taken', min: 0, max: 60, step: 1, fast: true },
        { type: 'slider', key: 'mu', label: 'momentum', min: 0, max: 0.92, step: 0.02, fast: true, fmt: v => (+v).toFixed(2) },
      ],
      readouts: [
        { key: 'cond', label: 'how stretched the bowl is', get: s => s.centred ? '≈ 1 to 1' : '≈ 120 to 1', wide: true, explain: 'The ratio of the steepest direction to the shallowest. One is a circle; a hundred is a canyon.' },
        { key: 'l', label: 'loss now', tone: 'warm', get: s => { const p = canyonPath(s)[Math.min(s.k2, 60)]; return p ? loss(s, p[0], p[1]) : NaN; }, d: 4 },
        { key: 'lb', label: 'best possible', tone: 'green', get: s => { const b = best(s); return loss(s, b[0], b[1]); }, d: 4 },
      ],
      beats: [
        { label: 'the round bowl', hold: 1500, note: 'Centred x. The gradient points more or less straight at the answer.', scene: s => canyon(s, 1, true) },
        { label: 'the canyon', hold: 1700, note: 'The same data, uncentred. Same eight points, same best-fit line — a completely different search problem.', scene: s => canyon(s, 1, false) },
        { label: 'the zigzag', hold: 1800, note: 'Perpendicular to a long thin contour points across the valley, not down it. Most of every step is wasted.', scene: s => canyon(s, 2, false) },
        { label: 'momentum', hold: 1800, note: 'Keep a fraction of the previous step. The side-to-side moves cancel out; the along-the-valley moves accumulate.', scene: s => canyon(s, 3, false) },
        { label: 'your turn', note: 'Toggle <b>centre x</b>, then wind <b>momentum</b> up and down on the canyon.', scene: s => canyon(s, 3, s.centred) },
      ],
      aside: `<p><strong>Why anyone tolerates this.</strong> For a linear model you would never use gradient descent — there is an exact matrix formula. But that formula needs to invert a matrix, which costs cubically in the number of predictors and does not exist at all for logistic regression, Poisson regression, or anything with a penalty. Descent scales to problems where the exact answer is unavailable or unaffordable, which is nearly all of them.</p>`,
    },

    /* ── 9 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'the dials, and what each one breaks',
      prose: `<p>Everything you can turn, what it does, and the failure at each end.</p>
        <p>Two of them are not really choices. <strong>Iterations</strong> just needs to be enough, and <strong>initialisation</strong> only matters when the surface has more than one basin — which for a linear model it never does, and for a neural network it always does.</p>`,
      controls: [
        { type: 'slider', key: 'eta2', label: 'η', min: 0.02, max: 0.9, step: 0.01, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'slider', key: 'mu', label: 'momentum', min: 0, max: 0.92, step: 0.02, fast: true, fmt: v => (+v).toFixed(2) },
      ],
      beats: [
        {
          label: 'the panel',
          note: 'Every one of these appears, under one name or another, in <code>optim.SGD</code>, <code>keras.optimizers</code>, and the sampler arguments in Stan.',
          scene: s => knobCards([
            { name: 'learning rate  η', value: (+s.eta2).toFixed(2), tone: 'gold',
              does: 'How far you move per unit of slope. Sets everything: speed, stability, and whether it converges at all.',
              low: 'crawls; looks like a broken model', high: 'overshoots, then diverges to NaN' },
            { name: 'momentum  μ', value: (+s.mu).toFixed(2), tone: 'cyan',
              does: 'How much of the last step you carry into this one. Cancels side-to-side wobble, accumulates consistent motion.',
              low: 'zigzags across every narrow valley', high: 'sails past the bottom and orbits it' },
            { name: 'batch size', value: 'all 8', tone: 'purple',
              does: 'How many observations you use to estimate the slope before each step. Fewer is noisier and far cheaper.',
              low: 'noisy path, but escapes shallow traps', high: 'smooth path, slow per step' },
            { name: 'iterations', value: '40', tone: 'green',
              does: 'How many steps you take before stopping. Not really a choice — take enough, and watch the loss to know when.',
              low: 'stops on the hillside', high: 'wastes time; on a flexible model, overfits' },
          ], { y0: 60, rowH: 110 }),
        },
        {
          label: 'where you have already met it',
          note: 'None of these lessons introduced a new optimiser. They all use this one.',
          scene: s => [
            label('wh', 360, 92, 'this exact loop is running inside', { cls: 'lab-big lab-mid lab-gold' }),
            [
              ['logistic regression', 'IRLS — descent with a step size chosen for you by the curvature'],
              ['poisson & negative binomial', 'the same solver, a different variance function'],
              ['neural networks', 'descent, with the chain rule supplying the gradient'],
              ['MCMC with gradients', 'the same slope, used to propose rather than to step'],
              ['penalised splines', 'descent on the fit plus a penalty for wiggliness'],
            ].map(([a, b], i) => [
              rect('wr' + i, 74, 132 + i * 66, 572, 54, { cls: 'cell', delay: i * 110 }),
              label('wa' + i, 92, 155 + i * 66, a, { cls: 'lab-big lab-cyan', delay: i * 110 }),
              label('wb' + i, 92, 174 + i * 66, b, { cls: 'lab-sm', delay: i * 110 }),
            ]),
            label('wf', 360, 490, 'measure the slope · step against it · look again', { cls: 'lab lab-mid lab-green' }),
          ],
        },
      ],
    },
  ],
};

/* ── scenes ───────────────────────────────────────────────────────────────── */

function tangentScene(s, showArrow) {
  const f = H();
  const x = s.x0, y = hill(x), g = dhill(x);
  const dx = 2.6;
  return [
    hillAxes(f),
    fnPath(f, hill, { key: 'hill', cls: 'curve curve-ghost' }),
    path('tan', [[f.sx(x - dx), f.sy(y - g * dx)], [f.sx(x + dx), f.sy(y + g * dx)]], { cls: 'curve curve-fit link-grad' }),
    { key: 'dot', tag: 'circle', cls: 'pt pt-cyan link-theta', attrs: { cx: f.sx(x), cy: f.sy(y), r: 8 } },
    numLabel('gl', f.sx(x), f.sy(y) - 26, g, { cls: 'lab lab-mid lab-warm', d: 2, pre: "slope = " }),
    showArrow ? path('arr', [[f.sx(x), f.y0 - 14], [f.sx(x - Math.sign(g) * 1.9), f.y0 - 14]], { cls: 'arrow arrow-warm link-grad' }) : null,
    showArrow ? label('arrl', f.sx(x - Math.sign(g) * 1.0), f.y0 - 24, 'downhill', { cls: 'lab-sm lab-mid lab-warm' }) : null,
  ];
}

function stepScene(s, phase) {
  const f = H();
  const x = s.x0, y = hill(x), g = dhill(x);
  const move = -s.eta * g, x1 = x + move;
  const dx = 2.2;
  return [
    hillAxes(f),
    fnPath(f, hill, { key: 'hill', cls: 'curve curve-ghost' }),
    path('tan', [[f.sx(x - dx), f.sy(y - g * dx)], [f.sx(x + dx), f.sy(y + g * dx)]], { cls: 'curve curve-fit link-grad', opacity: phase >= 1 ? 1 : 0 }),
    { key: 'dot', tag: 'circle', cls: 'pt pt-cyan link-theta', attrs: { cx: f.sx(x), cy: f.sy(y), r: 8 } },
    numLabel('gl', f.sx(x), f.sy(y) - 26, g, { cls: 'lab lab-mid lab-warm', d: 2, pre: 'slope = ' }),
    phase >= 2 ? [
      path('ruler', [[f.sx(x), f.y0 - 18], [f.sx(x1), f.y0 - 18]], { cls: 'stick stick-x link-eta', set: { 'stroke-width': 4 } }),
      numLabel('rl', f.sx((x + x1) / 2), f.y0 - 26, move, { cls: 'lab-sm lab-mid lab-gold', d: 2, pre: '−η·slope = ' }),
    ] : null,
    phase >= 3 ? [
      path('hop', [[f.sx(x), f.sy(y)], [f.sx(x1), f.sy(hill(x1))]], { cls: 'arrow arrow-warm' }),
      { key: 'dot2', tag: 'circle', cls: 'pt pt-green', attrs: { cx: f.sx(x1), cy: f.sy(hill(x1)), r: 8 }, enter: { attrs: { r: 0 }, opacity: 0 } },
      numLabel('d2l', f.sx(x1), f.sy(hill(x1)) - 20, x1, { cls: 'lab lab-mid lab-green', d: 2 }),
    ] : null,
    { key: 'minl', tag: 'line', cls: 'rule rule-faint rule-dash', attrs: { x1: f.sx(MINX), y1: f.y0, x2: f.sx(MINX), y2: f.y1 } },
    label('minlab', f.sx(MINX), f.y1 - 6, 'the bottom', { cls: 'lab-sm lab-mid' }),
  ];
}

function walkScene(s, n) {
  const f = H();
  const xs = walk(s.x0, s.eta, Math.max(1, n)).slice(0, n + 1);
  return [
    hillAxes(f),
    fnPath(f, hill, { key: 'hill', cls: 'curve curve-ghost' }),
    { key: 'minl', tag: 'line', cls: 'rule rule-faint rule-dash', attrs: { x1: f.sx(MINX), y1: f.y0, x2: f.sx(MINX), y2: f.y1 } },
    xs.slice(0, -1).map((x, i) => path(`hop-${i}`, [[f.sx(x), f.sy(hill(x))], [f.sx(xs[i + 1]), f.sy(hill(xs[i + 1]))]], {
      cls: 'arrow', opacity: 0.75, delay: i * 55,
    })),
    xs.map((x, i) => ({
      key: `w-${i}`, tag: 'circle',
      cls: 'pt ' + (i === xs.length - 1 ? 'pt-green' : 'pt-cyan'),
      attrs: { cx: f.sx(clamp(x, -60, 60)), cy: f.sy(clamp(hill(x), -60, 200)), r: i === xs.length - 1 ? 8 : 4.6 },
      opacity: i === xs.length - 1 ? 1 : 0.85, delay: i * 55,
      enter: { attrs: { r: 0 }, opacity: 0 },
      tip: `step ${i}<br>x = ${x.toFixed(4)}<br>slope = ${dhill(x).toFixed(4)}`,
    })),
    numLabel('nl', f.x1, f.y1 + 8, n, { cls: 'lab-big lab-end lab-cyan', d: 0, pre: 'steps: ' }),
  ];
}

const REGIMES = { 0.1: 'creeping', 1: 'exact', 1.7: 'zigzag', 2.2: 'diverging' };

function regime(s, eta, n) {
  const f = H();
  const xs = walk(s.x0, eta, n);
  const bad = xs.some(v => Math.abs(v) > 40);
  const tone = eta > 2 ? 'warm' : eta > 1 ? 'gold' : Math.abs(eta - 1) < 1e-9 ? 'green' : 'cyan';
  return [
    hillAxes(f),
    fnPath(f, hill, { key: 'hill', cls: 'curve curve-ghost' }),
    { key: 'minl', tag: 'line', cls: 'rule rule-faint rule-dash', attrs: { x1: f.sx(MINX), y1: f.y0, x2: f.sx(MINX), y2: f.y1 } },
    xs.slice(0, -1).map((x, i) => path(`hop-${i}`, [
      [f.sx(clamp(x, -40, 40)), f.sy(clamp(hill(x), -5, 60))],
      [f.sx(clamp(xs[i + 1], -40, 40)), f.sy(clamp(hill(xs[i + 1]), -5, 60))],
    ], { cls: 'arrow', opacity: 0.6, delay: i * 45 })),
    xs.map((x, i) => ({
      key: `w-${i}`, tag: 'circle', cls: 'pt pt-' + (i === xs.length - 1 ? 'green' : tone),
      attrs: { cx: f.sx(clamp(x, -40, 40)), cy: f.sy(clamp(hill(x), -5, 60)), r: i === xs.length - 1 ? 7.5 : 4.2 },
      opacity: 0.9, delay: i * 45, enter: { attrs: { r: 0 }, opacity: 0 },
      tip: `step ${i}<br>x = ${x.toFixed(3)}`,
    })),
    numLabel('el', f.x0 + 10, f.y1 + 10, eta, { cls: 'lab-big lab-' + tone, d: 2, pre: 'η = ' }),
    label('rl', f.x0 + 10, f.y1 + 30, REGIMES[eta] || (eta > 2 ? 'diverging' : eta > 1 ? 'zigzag' : 'creeping'), { cls: 'lab lab-' + tone }),
    bad ? label('gone', 360, f.y1 + 20, 'off the top of the chart, and still accelerating', { cls: 'lab lab-mid lab-warm' }) : null,
  ];
}

/* ── steps 6: data on the left, loss on the right ─────────────────────────── */

function lossCurve(s, phase) {
  const b = s.eta2;
  const d = frame({ w: 720, h: 540, l: 62, r: 396, t: 56, b: 92 });
  d.setX(-1.9, 1.9); d.setY(-2.1, 2.1);
  const L = b1 => st.mean(XZ.map((v, i) => (YZ[i] - b1 * v) ** 2));
  const bestB = st.linreg(XZ, YZ).b1;

  const left = [
    { key: 'dx', tag: 'line', cls: 'ax-line', attrs: { x1: d.x0, y1: d.sy(0), x2: d.x1, y2: d.sy(0) } },
    { key: 'dy', tag: 'line', cls: 'ax-line', attrs: { x1: d.sx(0), y1: d.y0, x2: d.sx(0), y2: d.y1 } },
    label('dxl', (d.x0 + d.x1) / 2, d.y0 + 30, 'x (standardised)', { cls: 'ax-label' }),
    phase >= 2 ? path('line', [[d.sx(-1.9), d.sy(-1.9 * b)], [d.sx(1.9), d.sy(1.9 * b)]], { cls: 'curve curve-fit' }) : null,
    phase >= 2 ? XZ.map((v, i) => path(`res-${i}`, [[d.sx(v), d.sy(YZ[i])], [d.sx(v), d.sy(b * v)]], {
      cls: 'stick stick-resid', tip: `residual = ${(YZ[i] - b * v).toFixed(3)}`,
    })) : null,
    points(d, range(N), { key: 'p', r: 6, cls: 'pt', x: i => XZ[i], y: i => YZ[i], stagger: 40 }),
  ];

  if (phase < 3) return left;

  const c = frame({ w: 720, h: 540, l: 400, r: 34, t: 90, b: 132 });
  c.setX(-0.4, 1.8); c.setY(0, Math.max(1.4, L(-0.4)));
  const right = [
    { key: 'cx', tag: 'line', cls: 'ax-line', attrs: { x1: c.x0, y1: c.y0, x2: c.x1, y2: c.y0 } },
    { key: 'cy', tag: 'line', cls: 'ax-line', attrs: { x1: c.x0, y1: c.y0, x2: c.x0, y2: c.y1 } },
    label('cxl', (c.x0 + c.x1) / 2, c.y0 + 32, 'slope of the line', { cls: 'ax-label' }),
    label('cyl', c.x0 + 4, c.y1 - 10, 'mean squared residual', { cls: 'lab-sm' }),
    [0, 0.5, 1, 1.5].map(v => label('cxt' + v, c.sx(v), c.y0 + 16, v.toFixed(1), { cls: 'ax-tick' })),
    phase >= 4 ? fnPath(c, L, { key: 'lc', cls: 'curve' }) : null,
    phase >= 4 ? path('bl', [[c.sx(bestB), c.y0], [c.sx(bestB), c.sy(L(bestB))]], { cls: 'rule rule-faint rule-dash' }) : null,
    phase >= 4 ? label('bll', c.sx(bestB), c.y0 - 10, 'least squares', { cls: 'lab-sm lab-mid lab-green' }) : null,
    { key: 'cd', tag: 'circle', cls: 'pt pt-cyan', attrs: { cx: c.sx(b), cy: c.sy(L(b)), r: 7.5 } },
    numLabel('cdl', c.sx(b), c.sy(L(b)) - 18, L(b), { cls: 'lab lab-mid lab-warm', d: 3 }),
  ];
  return [left, right];
}

/* ── steps 7–8: the bowl ──────────────────────────────────────────────────── */

function bowlBase(s, f, { contours = true } = {}) {
  const bb = best(s);
  const lo = loss(s, bb[0], bb[1]);
  const hi = LMAX(s);
  return [
    surface(f, (a, b) => clamp((loss(s, a, b) - lo) / (hi - lo), 0, 1), { key: 'srf', n: 34, opacity: 0.7 }),
    contours ? [0.04, 0.12, 0.28, 0.52, 0.84].map((lv, i) =>
      boundary(f, (a, b) => ((loss(s, a, b) - lo) / (hi - lo) < lv ? 0 : 1), { key: 'ct' + i, n: 110 })) : null,
    { key: 'bx', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x1, y2: f.y0 } },
    { key: 'by', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x0, y2: f.y1 } },
    label('bxl', (f.x0 + f.x1) / 2, f.y0 + 30, 'intercept  b₀', { cls: 'ax-label' }),
    { key: 'byl', tag: 'text', cls: 'ax-label', attrs: { x: 0, y: 0 }, set: { transform: `translate(${f.x0 - 26} ${(f.y0 + f.y1) / 2}) rotate(-90)` }, text: 'slope  b₁' },
    { key: 'opt', tag: 'circle', attrs: { cx: f.sx(bb[0]), cy: f.sy(bb[1]), r: 5 }, set: { fill: 'var(--cs-data-green)', stroke: 'none' } },
    label('optl', f.sx(bb[0]), f.sy(bb[1]) - 14, 'least squares', { cls: 'lab-sm lab-mid lab-green' }),
  ];
}

const START7 = [1.4, -0.4];

function bowl(s, phase) {
  const f = bowlFrame({ centred: true }, { l: 96, r: 300 });
  const S = { ...s, centred: true };
  const p = walk2(S, { eta: s.eta2, steps: 40, start: START7 });
  const at = p[Math.min(phase >= 5 ? s.k2 : phase >= 4 ? 1 : 0, p.length - 1)];
  const g = grad(S, at[0], at[1]);
  const gl = Math.hypot(g[0], g[1]) || 1;
  const A = 0.55 / gl;

  const out = [bowlBase(S, f, { contours: phase >= 2 })];
  if (phase >= 3) out.push(
    path('gv', [[f.sx(at[0]), f.sy(at[1])], [f.sx(at[0] + g[0] * A), f.sy(at[1] + g[1] * A)]], { cls: 'arrow arrow-warm link-grad' }),
    label('gvl', f.sx(at[0] + g[0] * A), f.sy(at[1] + g[1] * A) - 10, '∇L  · uphill', { cls: 'lab-sm lab-mid lab-warm' }));
  if (phase >= 4) out.push(
    path('gd', [[f.sx(at[0]), f.sy(at[1])], [f.sx(at[0] - g[0] * A), f.sy(at[1] - g[1] * A)]], { cls: 'arrow link-eta', set: { stroke: 'var(--cs-data-gold)' } }),
    label('gdl', f.sx(at[0] - g[0] * A), f.sy(at[1] - g[1] * A) + 18, '−η∇L · where you go', { cls: 'lab-sm lab-mid lab-gold' }));
  if (phase >= 5) out.push(
    path('trail', p.slice(0, s.k2 + 1).map(q => [f.sx(q[0]), f.sy(q[1])]), { cls: 'curve curve-cyan' }),
    ...p.slice(0, s.k2 + 1).map((q, i) => ({
      key: 'tp' + i, tag: 'circle', cls: 'pt pt-cyan',
      attrs: { cx: f.sx(q[0]), cy: f.sy(q[1]), r: 3.2 }, opacity: 0.85,
      tip: `step ${i}<br>b₀ = ${q[0].toFixed(3)}<br>b₁ = ${q[1].toFixed(3)}<br>loss = ${loss(S, q[0], q[1]).toFixed(4)}`,
    })));
  out.push({ key: 'here', tag: 'circle', cls: 'pt pt-cyan link-theta', attrs: { cx: f.sx(at[0]), cy: f.sy(at[1]), r: 7.5 } });

  /* the numbers, spelled out, so the arrow is never just decoration */
  const px = 452;
  out.push(
    numLabel('n1', px, 110, at[0], { cls: 'lab lab-cyan', d: 3, pre: 'b₀ = ' }),
    numLabel('n2', px, 132, at[1], { cls: 'lab lab-purple', d: 3, pre: 'b₁ = ' }),
    numLabel('n3', px, 166, loss(S, at[0], at[1]), { cls: 'lab-big lab-warm', d: 4, pre: 'L = ' }),
    phase >= 3 ? [
      label('n4', px, 210, 'the gradient here', { cls: 'lab-sm lab-gold' }),
      numLabel('n5', px, 232, g[0], { cls: 'lab lab-warm', d: 3, pre: '∂L/∂b₀ = ' }),
      numLabel('n6', px, 252, g[1], { cls: 'lab lab-warm', d: 3, pre: '∂L/∂b₁ = ' }),
      label('n7', px, 282, 'each one is the slope you would', { cls: 'lab-sm' }),
      label('n8', px, 296, 'feel walking in that direction', { cls: 'lab-sm' }),
      label('n9', px, 310, 'with the other one held still.', { cls: 'lab-sm' }),
    ] : null,
    phase >= 4 ? [
      numLabel('n10', px, 348, -s.eta2 * g[0], { cls: 'lab lab-gold', d: 3, pre: 'Δb₀ = ' }),
      numLabel('n11', px, 368, -s.eta2 * g[1], { cls: 'lab lab-gold', d: 3, pre: 'Δb₁ = ' }),
    ] : null,
  );
  return out;
}

function canyonPath(s) {
  return walk2(s, { eta: s.centred ? 0.25 : 0.03, mu: s.mu, steps: 60, start: s.centred ? [1.4, -0.4] : [-2.8, 1.3] });
}

function canyon(s, phase, centred) {
  const S = { ...s, centred };
  const f = bowlFrame(S, { l: 92, r: 296 });
  const mu = phase >= 3 ? s.mu : 0;
  const p = walk2(S, { eta: centred ? 0.25 : 0.03, mu, steps: 60, start: centred ? [1.4, -0.4] : [-2.8, 1.3] });
  const n = Math.min(phase >= 2 ? (phase >= 3 ? 60 : 40) : 0, p.length - 1);
  const shown = p.slice(0, n + 1);
  const at = shown[shown.length - 1];

  const out = [bowlBase(S, f)];
  if (n > 0) out.push(
    path('trail', shown.map(q => [f.sx(clamp(q[0], -20, 20)), f.sy(clamp(q[1], -20, 20))]), { cls: 'curve curve-cyan' }),
    ...shown.map((q, i) => ({
      key: 'tp' + i, tag: 'circle', cls: 'pt pt-cyan',
      attrs: { cx: f.sx(clamp(q[0], -20, 20)), cy: f.sy(clamp(q[1], -20, 20)), r: 2.8 },
      opacity: 0.8, delay: i * 14,
      tip: `step ${i}<br>loss = ${loss(S, q[0], q[1]).toFixed(4)}`,
    })),
    { key: 'here', tag: 'circle', cls: 'pt pt-green', attrs: { cx: f.sx(clamp(at[0], -20, 20)), cy: f.sy(clamp(at[1], -20, 20)), r: 7 } });

  const px = 448;
  out.push(
    label('t1', px, 100, centred ? 'x centred' : 'x uncentred', { cls: 'lab-big ' + (centred ? 'lab-green' : 'lab-warm') }),
    label('t2', px, 120, centred ? 'a round bowl' : 'a canyon, 120 : 1', { cls: 'lab-sm' }),
    numLabel('t3', px, 158, n, { cls: 'lab lab-cyan', d: 0, pre: 'steps shown: ' }),
    numLabel('t4', px, 180, loss(S, at[0], at[1]), { cls: 'lab lab-warm', d: 4, pre: 'loss = ' }),
    numLabel('t5', px, 200, loss(S, ...best(S)), { cls: 'lab lab-green', d: 4, pre: 'best = ' }),
    phase >= 3 ? [
      numLabel('t6', px, 240, mu, { cls: 'lab-big lab-gold', d: 2, pre: 'momentum = ' }),
      label('t7', px, 264, 'v ← μv − η∇L', { cls: 'lab lab-gold' }),
      label('t8', px, 282, 'θ ← θ + v', { cls: 'lab lab-gold' }),
      label('t9', px, 312, 'the across-the-valley moves', { cls: 'lab-sm' }),
      label('t10', px, 326, 'alternate in sign and cancel.', { cls: 'lab-sm' }),
      label('t11', px, 340, 'the along-the-valley moves', { cls: 'lab-sm' }),
      label('t12', px, 354, 'all point the same way and add up.', { cls: 'lab-sm' }),
    ] : null,
  );
  return out;
}
