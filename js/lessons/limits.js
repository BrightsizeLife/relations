/* ─────────────────────────────────────────────────────────────────────────────
   limits.js — where a function is heading, whether or not it ever arrives.
   The step everything in calculus, and therefore every model fit, stands on.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, arrowDefs } from '../core/plot.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sub, sup, paren, eq, minus, op } from '../core/fx.js';

const F = () => frame({ w: 720, h: 540, l: 66, r: 28, t: 34, b: 58 });

const CASES = {
  hole: {
    label: 'a hole', a: 1, L: 2,
    f: x => (Math.abs(x - 1) < 1e-12 ? NaN : (x * x - 1) / (x - 1)),
    expr: '(x² − 1) / (x − 1)', at: 'undefined at x = 1 — you would be dividing by zero',
    note: 'the limit exists even though the function does not',
  },
  jump: {
    label: 'a jump', a: 0, L: null,
    f: x => (x < 0 ? -1 : 1),
    expr: 'sign(x)', at: 'defined, but the two sides disagree',
    note: 'no limit — approach from the left and the right and you land in different places',
  },
  smooth: {
    label: 'no drama', a: 1, L: 3,
    f: x => x * x + 2 * x, expr: 'x² + 2x', at: 'defined and equal to the limit',
    note: 'continuous — the limit is just the value, which is why nobody thinks about limits until they break',
  },
  osc: {
    label: 'chaos', a: 0, L: null,
    f: x => (Math.abs(x) < 1e-9 ? NaN : Math.sin(1 / x)),
    expr: 'sin(1/x)', at: 'undefined, and gets worse the closer you look',
    note: 'no limit — it never settles, no matter how close you get',
  },
};

export default {
  meta: {
    id: 'limits', title: 'limits', kicker: 'FOUNDATION',
    status: 'live',
    deck: 'A limit answers a strange question: where is a function <em>heading</em> as you close in on a point — even if it does something unhelpful, or nothing at all, when you get there? That gap between "heading toward" and "arriving at" is where every derivative and every integral is born.',
    dataNote: 'No dataset. Every curve here is drawn from the formula shown.',
    deps: [], unlocks: ['derivatives', 'integrals'],
    next: 'derivatives', nextLabel: 'derivatives',
    outro: 'the value it wants to be, regardless of what it actually is.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { case: 'hole', eps: 0.5, n: 8 },

  steps: [
    {
      title: 'approaching without arriving',
      prose: `<p>Take the expression <span class="cs-inline-code">(x² − 1)/(x − 1)</span>. At x = 1 it is 0/0 — genuinely undefined, not a technicality.</p>
        <p>But feed it 1.1, then 1.01, then 1.001, and the outputs march toward 2 without hesitating. Do the same from below and they march toward 2 as well. The function has a definite destination at x = 1; it just never checks in.</p>
        <p>That destination is the limit. <strong>Slide the closeness dial</strong> and watch the values converge from both sides.</p>`,
      formula: formula(
        'lim' + sub('', 'x→a') + ' f(x) ' + eq + t('L', { tone: 'green' }) +
        op('&nbsp;&nbsp;means&nbsp;&nbsp;') +
        t('you can get f(x) as close to L as you like, by getting x close enough to a', { cls: 'fx-muted' }),
        { size: 'sm', caption: 'a claim about the approach, not about the destination point itself' }),
      readouts: [
        { key: 'from', label: 'from the left', tone: 'cold', get: s => CASES[s.case].f(CASES[s.case].a - s.eps), d: 5, wide: true },
        { key: 'to', label: 'from the right', tone: 'warm', get: s => CASES[s.case].f(CASES[s.case].a + s.eps), d: 5, wide: true },
        { key: 'at', label: 'at the point itself', wide: true, get: s => {
          const v = CASES[s.case].f(CASES[s.case].a);
          return isFinite(v) ? v.toFixed(3) : 'undefined';
        } },
        { key: 'lim', label: 'the limit', tone: 'green', wide: true, get: s => CASES[s.case].L == null ? 'does not exist' : CASES[s.case].L.toFixed(3) },
      ],
      controls: [
        { type: 'segment', key: 'case', label: 'what happens at the point', options: Object.entries(CASES).map(([k, v]) => ({ value: k, label: v.label })) },
        { type: 'slider', key: 'eps', label: 'how close we get', min: 0.001, max: 1, step: 0.001, fast: true, fmt: v => (+v).toFixed(3) },
      ],
      beats: [
        {
          label: 'close in from both sides',
          note: 'The two dots walk toward the point. <b>Where they are heading is the limit</b> — whether or not anything is waiting there.',
          scene: s => {
            const C = CASES[s.case];
            const f = F();
            f.setX(C.a - 2, C.a + 2);
            const probe = range(60).map(i => C.f(C.a - 2 + (4 * i) / 59)).filter(isFinite);
            const lo = Math.min(...probe), hi = Math.max(...probe);
            f.setY(Math.max(lo - 0.6, -6), Math.min(hi + 0.6, 8));
            const e = +s.eps;
            const yl = C.f(C.a - e), yr = C.f(C.a + e);
            return [
              ...axes(f, { xLabel: 'x', yLabel: 'f(x)' }),
              fnPath(f, x => C.f(x), { key: 'c', cls: 'curve', n: s.case === 'osc' ? 900 : 300 }),
              vLine(f, C.a, { key: 'a', cls: 'rule-gold rule-dash' }),
              ...(C.L != null ? [
                hLine(f, C.L, { key: 'L', cls: 'rule-faint rule-dash' }),
                label('Ll', f.x1 - 6, f.sy(C.L) - 8, `L = ${C.L}`, { cls: 'lab lab-end lab-green' }),
              ] : []),
              ...(isFinite(yl) ? [
                { key: 'pl', tag: 'circle', cls: 'pt pt-cold', dur: 160, attrs: { cx: f.sx(C.a - e), cy: f.sy(clamp(yl, f.dy[0], f.dy[1])), r: 7 } },
              ] : []),
              ...(isFinite(yr) ? [
                { key: 'pr', tag: 'circle', cls: 'pt pt-warm', dur: 160, attrs: { cx: f.sx(C.a + e), cy: f.sy(clamp(yr, f.dy[0], f.dy[1])), r: 7 } },
              ] : []),
              ...(s.case === 'hole' ? [{
                key: 'hole', tag: 'circle', cls: 'pt-ghost', attrs: { cx: f.sx(1), cy: f.sy(2), r: 6 },
                tip: 'the function is not defined here',
              }] : []),
              label('e', f.x0 + 10, f.y1 + 10, `f(x) = ${C.expr}`, { cls: 'lab-big lab-gold' }),
              label('e2', f.x0 + 10, f.y1 + 30, C.at, { cls: 'lab-sm' }),
              label('nt', f.midX, f.y0 - 12, C.note, { cls: 'lab lab-mid ' + (C.L == null ? 'lab-warm' : 'lab-green') }),
            ];
          },
        },
      ],
    },

    {
      title: 'what "as close as you like" actually means',
      prose: `<p>The informal version — "it gets closer and closer" — is not quite enough, because plenty of things get closer and closer without ever settling.</p>
        <p>The precise version turns it into a challenge. <strong>You name a tolerance</strong> around L, however small. I have to produce a window around a, such that every x in my window lands inside your tolerance. If I can always meet the challenge, the limit is L.</p>
        <p><strong>Shrink the tolerance band</strong> and watch the required window shrink with it. As long as I can always find one, the limit holds.</p>`,
      formula: formula(
        '∀ ' + t('ε', { tone: 'warm', explain: 'The tolerance you demand around L. Any positive number, however small.' }) + ' > 0, ∃ ' +
        t('δ', { tone: 'cyan', explain: 'The window I get to choose around a.' }) + ' > 0 : ' +
        '0 < |x − a| < ' + t('δ', { tone: 'cyan' }) + ' ⟹ |f(x) − L| < ' + t('ε', { tone: 'warm' }),
        { size: 'sm', caption: 'the ε–δ definition — a game you always win if the limit exists' }),
      aside: `<b>Why the fuss.</b> Everything in calculus — every derivative, every integral, the entire central limit theorem — is a statement of the form "this thing converges". Without a definition of convergence that survives adversarial examples like sin(1/x), none of it can be proved, and results that <i>look</i> obvious turn out to be false.`,
      readouts: [
        { key: 'eps', label: 'tolerance ε', tone: 'warm', get: s => +s.eps, d: 3 },
        { key: 'delta', label: 'window δ needed', tone: 'cyan', get: s => deltaFor(s), d: 4, wide: true },
        { key: 'ok', label: 'can I meet it?', tone: 'green', wide: true, get: s => (CASES[s.case].L == null ? 'no — no limit exists' : 'yes, always') },
      ],
      controls: [
        { type: 'slider', key: 'eps', label: 'your tolerance ε', min: 0.02, max: 1.5, step: 0.01, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'segment', key: 'case', label: 'function', options: [{ value: 'hole', label: 'a hole' }, { value: 'smooth', label: 'no drama' }, { value: 'jump', label: 'a jump' }] },
      ],
      beats: [
        {
          label: 'the two bands',
          note: 'Warm band: your tolerance around L. Blue band: the window I found. Every point of the curve inside the blue window stays inside the warm band.',
          scene: s => {
            const C = CASES[s.case];
            const L = C.L ?? 0;
            const d = deltaFor(s);
            const f = F();
            f.setX(C.a - 2, C.a + 2);
            f.setY(L - 2.4, L + 2.4);
            return [
              ...axes(f, { xLabel: 'x', yLabel: 'f(x)' }),
              rect('epsb', f.x0, f.sy(L + s.eps), f.x1 - f.x0, f.sy(L - s.eps) - f.sy(L + s.eps), { cls: 'sq sq-pos', dur: 200 }),
              rect('delb', f.sx(C.a - d), f.y1, f.sx(C.a + d) - f.sx(C.a - d), f.y0 - f.y1, { cls: 'sq sq-x', dur: 200 }),
              fnPath(f, x => C.f(x), { key: 'c', cls: 'curve', n: 400 }),
              hLine(f, L, { key: 'L', cls: 'rule-gold rule-dash' }),
              vLine(f, C.a, { key: 'a', cls: 'rule-gold rule-dash' }),
              label('le', f.x1 - 6, f.sy(L + s.eps) - 8, `L + ε`, { cls: 'lab-sm lab-end lab-warm', dur: 200 }),
              label('ld', f.sx(C.a + d), f.y1 + 14, `a + δ`, { cls: 'lab-sm lab-mid lab-cyan', dur: 200 }),
              ...(C.L == null ? [label('fail', f.midX, f.y0 - 14,
                'no window works — the jump is bigger than a small ε', { cls: 'lab-big lab-mid lab-warm' })] : []),
            ];
          },
        },
      ],
    },

    {
      title: 'the limit that becomes a derivative',
      prose: `<p>Here's the reason this lesson exists.</p>
        <p>To find the slope of a curve at a single point, you'd like to use rise over run. But at a single point there is no run — you'd be dividing zero by zero, exactly like the first example.</p>
        <p>So instead: take a second point a distance h away, compute the slope of the line through both, and then <strong>take the limit as h goes to zero</strong>. The two points collapse together, the secant line becomes the tangent, and the 0/0 resolves into a number.</p>
        <p><strong>Drag h toward zero</strong> and watch it happen.</p>`,
      formula: formula(
        `f′(x) ` + eq + ' lim' + sub('', 'h→0') + ' ' +
        frac('f(x + ' + t('h', { tone: 'warm' }) + ') − f(x)', t('h', { tone: 'warm' })),
        { caption: 'a slope you cannot compute directly, reached as a limit' }),
      dep: { note: 'This limit is the whole content of the next lesson.', lesson: 'derivatives', label: 'derivatives' },
      readouts: [
        { key: 'h', label: 'h', tone: 'warm', get: s => hOf(s), d: 6, wide: true },
        { key: 'sec', label: 'slope of the secant', tone: 'gold', get: s => secSlope(s), d: 5, wide: true },
        { key: 'tan', label: 'the limit', tone: 'green', get: () => 2 * 1.2 + 2, d: 5, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'n', label: 'squeeze h toward 0', min: 0, max: 20, step: 1, fast: true, fmt: v => 'h = ' + (2 * Math.pow(0.68, +v)).toFixed(5) },
      ],
      beats: [
        {
          label: 'two points, closing',
          note: 'The dashed line goes through both points. As they merge, its slope stops changing — <b>that settled value is the derivative</b>.',
          scene: s => {
            const g = x => x * x + 2 * x;
            const x0 = 1.2, h = hOf(s);
            const f = F();
            f.setX(-0.4, 3.4); f.setY(-1, 12);
            const m = (g(x0 + h) - g(x0)) / h;
            return [
              ...axes(f, { xLabel: 'x', yLabel: 'f(x) = x² + 2x' }),
              fnPath(f, g, { key: 'c', cls: 'curve', n: 220 }),
              path('sec', [
                [f.sx(-0.4), f.sy(g(x0) + m * (-0.4 - x0))],
                [f.sx(3.4), f.sy(g(x0) + m * (3.4 - x0))],
              ], { cls: 'curve curve-warm curve-dash', dur: 200 }),
              { key: 'p1', tag: 'circle', cls: 'pt pt-green', attrs: { cx: f.sx(x0), cy: f.sy(g(x0)), r: 7 } },
              { key: 'p2', tag: 'circle', cls: 'pt pt-warm', dur: 200, attrs: { cx: f.sx(x0 + h), cy: f.sy(g(x0 + h)), r: 7 } },
              { key: 'run', tag: 'line', cls: 'stick stick-x', dur: 200, attrs: { x1: f.sx(x0), y1: f.sy(g(x0)), x2: f.sx(x0 + h), y2: f.sy(g(x0)) } },
              { key: 'rise', tag: 'line', cls: 'stick stick-pos', dur: 200, attrs: { x1: f.sx(x0 + h), y1: f.sy(g(x0)), x2: f.sx(x0 + h), y2: f.sy(g(x0 + h)) } },
              numLabel('ml', f.midX, f.y1 + 8, m, { cls: 'lab-big lab-mid lab-gold', d: 5, pre: 'slope = ', dur: 200 }),
              label('hl', f.midX, f.y1 + 30, `h = ${h.toFixed(6)}`, { cls: 'lab lab-mid lab-warm', dur: 200 }),
              ...(h < 0.02 ? [label('conv', f.midX, f.y0 - 12, 'it has stopped moving — the limit is 4.4', { cls: 'lab lab-mid lab-green' })] : []),
            ];
          },
        },
      ],
    },

    {
      title: 'limits at infinity, and where e comes from',
      prose: `<p>The other direction: what happens as x runs off to infinity? Same idea, no destination point.</p>
        <p>One of these limits is worth knowing by name. Compound interest at 100% a year, paid once, doubles your money. Paid twice a year at 50% each, you get 2.25×. Monthly, 2.613×. Continuously — the limit — you get <strong>e = 2.71828…</strong></p>
        <p>That number is not a convention. It is the limit of a perfectly concrete process, and it is why <span class="cs-inline-code">e</span> turns up in the exponential link, the normal density, and the Poisson distribution.</p>`,
      formula: formula(
        'e ' + eq + ' lim' + sub('', 'n→∞') + ' ' + paren('1 + ' + frac('1', t('n', { tone: 'cyan' }))) + sup('', t('n', { tone: 'cyan' })) +
        op('&nbsp;=&nbsp;') + t('2.718281828…', { tone: 'green' }),
        { caption: 'compounding, taken to its limit' }),
      readouts: [
        { key: 'n', label: 'compounding periods', tone: 'cyan', get: s => Math.round(Math.pow(1.6, s.n)), d: 0, wide: true },
        { key: 'v', label: 'you end up with', tone: 'gold', get: s => Math.pow(1 + 1 / Math.pow(1.6, s.n), Math.pow(1.6, s.n)), d: 8, wide: true },
        { key: 'e', label: 'e', tone: 'green', get: () => Math.E, d: 8, wide: true },
        { key: 'gap', label: 'still short by', tone: 'warm', get: s => Math.E - Math.pow(1 + 1 / Math.pow(1.6, s.n), Math.pow(1.6, s.n)), d: 8, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'n', label: 'compound more often', min: 0, max: 30, step: 1, fast: true, fmt: v => Math.round(Math.pow(1.6, +v)) + '×/yr' },
      ],
      beats: [
        {
          label: 'converging on e',
          note: 'Fast at first, then agonisingly slow. It never reaches e — but it gets as close as you like, which is exactly what a limit promises.',
          scene: s => {
            const f = F();
            f.setX(1, 60); f.setY(2, 2.78);
            const g = n => Math.pow(1 + 1 / n, n);
            const nn = Math.pow(1.6, s.n);
            return [
              ...axes(f, { xLabel: 'compounding periods per year', yLabel: 'end of year multiplier', yN: 5 }),
              hLine(f, Math.E, { key: 'e', cls: 'rule-gold rule-dash' }),
              label('el', f.x1 - 6, f.sy(Math.E) - 8, 'e = 2.71828…', { cls: 'lab lab-end lab-green' }),
              fnPath(f, g, { key: 'c', cls: 'curve curve-cyan', n: 240, from: 1 }),
              ...[1, 2, 4, 12, 52].map((k, i) => [
                { key: `d-${i}`, tag: 'circle', cls: 'pt pt-cyan', attrs: { cx: f.sx(k), cy: f.sy(g(k)), r: 5 }, delay: i * 150,
                  tip: `${k}× a year → <b>${g(k).toFixed(5)}</b>` },
                label(`dl-${i}`, f.sx(k), f.sy(g(k)) + 18, ['yearly', 'twice', 'quarterly', 'monthly', 'weekly'][i], { cls: 'lab-sm lab-mid', delay: i * 150 }),
              ]),
              ...(nn <= 60 ? [{ key: 'now', tag: 'circle', cls: 'pt pt-green', dur: 200, attrs: { cx: f.sx(nn), cy: f.sy(g(nn)), r: 8 } }] : []),
            ];
          },
        },
      ],
    },
  ],
};

const hOf = s => 2 * Math.pow(0.68, s.n);
function secSlope(s) {
  const g = x => x * x + 2 * x;
  const x0 = 1.2, h = hOf(s);
  return (g(x0 + h) - g(x0)) / h;
}
function deltaFor(s) {
  const C = CASES[s.case];
  if (C.L == null) return NaN;
  // find the largest window that keeps |f(x) − L| < eps, by search
  let d = 0.001;
  for (let k = 0; k < 400; k++) {
    const trial = d * 1.02;
    const pts = [C.a - trial, C.a + trial, C.a - trial / 2, C.a + trial / 2];
    if (pts.some(x => { const v = C.f(x); return isFinite(v) && Math.abs(v - C.L) >= s.eps; })) break;
    d = trial;
    if (d > 1.8) break;
  }
  return d;
}
