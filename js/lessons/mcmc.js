/* ─────────────────────────────────────────────────────────────────────────────
   mcmc.js — when you can't do the integral, take a walk. Metropolis drawn one
   proposal at a time, rejections included, against a posterior we know exactly
   so you can check the answer.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, fnArea, histBars, arrowDefs } from '../core/plot.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sub, sup, paren, eq, minus, op } from '../core/fx.js';

const F = () => frame({ w: 720, h: 540, l: 66, r: 28, t: 34, b: 58 });

/* The same coin problem as the Bayes lesson — 27 heads in 40 flips, Beta(3,3)
   prior — so the true posterior is Beta(30, 16) and we can check the walk. */
const HEADS = 27, N = 40, PRI_A = 3, PRI_B = 3;
const POST_A = PRI_A + HEADS, POST_B = PRI_B + (N - HEADS);
const truePost = x => st.betaPdf(x, POST_A, POST_B);

/** the un-normalised target: prior × likelihood, computed in logs */
const logTarget = ([theta]) => {
  if (theta <= 0 || theta >= 1) return -Infinity;
  return (PRI_A - 1) * Math.log(theta) + (PRI_B - 1) * Math.log(1 - theta)
    + HEADS * Math.log(theta) + (N - HEADS) * Math.log(1 - theta);
};

const runCache = new Map();
function chain(s) {
  const key = `${s.step}|${s.seed}|${s.start}`;
  if (!runCache.has(key)) {
    runCache.set(key, st.metropolis(logTarget, [s.start], { steps: 3000, step: s.step, seed: s.seed }));
  }
  return runCache.get(key);
}
const upTo = s => chain(s).chain.slice(0, Math.max(2, s.iter));
const kept = s => upTo(s).slice(s.burn).map(c => c.x[0]);

/* a small discrete chain for the "what is a Markov chain" step */
const P = [[0.75, 0.2, 0.05], [0.3, 0.5, 0.2], [0.1, 0.4, 0.5]];
const STATES = ['sunny', 'cloudy', 'raining'];

export default {
  meta: {
    id: 'mcmc', title: 'markov chains & mcmc', kicker: 'RANDOM WALKS THAT LEARN',
    status: 'live',
    deck: 'Bayes\' rule has a denominator nobody can compute once there is more than a handful of parameters. Markov chain Monte Carlo is the workaround that made modern Bayesian statistics practical: never compute it, and instead take a very particular kind of random walk whose footprints pile up in exactly the right shape.',
    dataNote: 'The target here is the posterior from the coin problem in the Bayes lesson — 27 heads in 40 flips with a Beta(3,3) prior — because that posterior has a known closed form. The whole point is that you can check the walk against the right answer.',
    deps: ['bayes'], unlocks: [],
    next: 'algebra', nextLabel: 'algebra & inverses',
    outro: 'a walk that forgets where it came from, and remembers where it should be.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { iter: 60, step: 0.08, seed: 7, start: 0.15, burn: 0, showTrue: true, wstate: 0 },

  steps: [
    {
      title: 'the denominator nobody can compute',
      prose: `<p>In the last lesson the posterior came out in closed form, because a beta prior and a binomial likelihood happen to multiply into another beta. That is a lucky accident, and it stops happening the moment your model has more than a couple of parameters.</p>
        <p>The problem is always the same: the numerator is easy — prior times likelihood, evaluated at any point you like. The <strong>denominator</strong> is an integral over the entire parameter space, and in twenty dimensions there is no numerical method that will touch it.</p>
        <p>So MCMC gives up on it entirely. It only ever compares two points, and in a <em>ratio</em> the denominator cancels.</p>`,
      formula: formula(
        'p(θ | y) ' + eq + frac(t('p(y | θ) p(θ)', { tone: 'green', explain: 'Easy: evaluate at any θ you like.' }),
          t('∫ p(y | θ) p(θ) dθ', { tone: 'warm', explain: 'Impossible in any interesting number of dimensions.' })) +
        op('&nbsp;&nbsp;but&nbsp;&nbsp;') +
        frac('p(θ′ | y)', 'p(θ | y)') + eq + frac('p(y | θ′) p(θ′)', 'p(y | θ) p(θ)'),
        { size: 'sm', caption: 'the impossible part cancels in a ratio — that is the entire loophole' }),
      readouts: [],
      beats: [
        {
          label: 'the shape without the scale',
          note: 'We can draw the right <b>shape</b> anywhere we like. What we cannot do is work out what to divide by so the area is 1.',
          scene: () => {
            const f = F();
            f.setX(0, 1);
            const un = x => Math.exp(logTarget([x]));
            const mx = un(HEADS / N);
            f.setY(0, mx * 1.2);
            return [
              ...axes(f, { xLabel: 'θ', yLabel: 'prior × likelihood (unnormalised)', yN: 3, yFmt: () => '' }),
              fnArea(f, un, 0.001, 0.999, { key: 'a', cls: 'area area-faint', base: 0 }),
              fnPath(f, un, { key: 'c', cls: 'curve curve-gold', n: 240 }),
              label('q', f.midX, f.y1 + 14, 'what is the area under this?', { cls: 'lab-big lab-mid lab-warm' }),
              label('q2', f.midX, f.y1 + 36, 'in one dimension: easy. in twenty: hopeless.', { cls: 'lab lab-mid' }),
            ];
          },
        },
      ],
    },

    {
      title: 'first, what a markov chain is',
      prose: `<p>A Markov chain is a process that hops between states, where <strong>the next hop depends only on where you are now</strong> — not on how you got there. That amnesia is the whole definition.</p>
        <p>Here's a toy weather chain. From sunny it usually stays sunny; from raining it often clears up. Run it for a while and something remarkable happens: the long-run fraction of time spent in each state settles down to fixed numbers, <em>and those numbers do not depend on where you started</em>.</p>
        <p>That settled distribution is called the <strong>stationary distribution</strong>. MCMC is the trick of building a chain whose stationary distribution is the posterior you want.</p>`,
      formula: formula(
        'P' + paren(sub('X', 't+1') + ' | ' + sub('X', 't') + ', ' + sub('X', 't−1') + ', …') + eq +
        'P' + paren(sub('X', 't+1') + ' | ' + t(sub('X', 't'), { tone: 'green', explain: 'Only the present matters. The past is irrelevant given the present.' })),
        { caption: 'the memorylessness property' }),
      readouts: [
        { key: 'start', label: 'started in', tone: 'gold', get: s => STATES[s.wstate] },
        { key: 's1', label: 'long-run sunny', tone: 'gold', get: () => stationary()[0] * 100, d: 1, suf: '%', wide: true },
        { key: 's2', label: 'cloudy', tone: 'muted', get: () => stationary()[1] * 100, d: 1, suf: '%' },
        { key: 's3', label: 'raining', tone: 'cold', get: () => stationary()[2] * 100, d: 1, suf: '%' },
      ],
      controls: [
        { type: 'segment', key: 'wstate', label: 'start from', options: STATES.map((n, i) => ({ value: i, label: n })) },
      ],
      beats: [
        {
          label: 'the transition rules',
          note: 'Thicker arrows are likelier hops. Nothing here remembers yesterday.',
          scene: () => {
            const pos = [[180, 180], [540, 180], [360, 420]];
            const items = [];
            P.forEach((row, i) => row.forEach((p, j) => {
              if (i === j || p < 0.03) return;
              const [x1, y1] = pos[i], [x2, y2] = pos[j];
              const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
              const ux = dx / len, uy = dy / len;
              const off = 12 * (i < j ? 1 : -1);
              items.push(path(`e-${i}-${j}`, [
                [x1 + ux * 52 - uy * off, y1 + uy * 52 + ux * off],
                [x2 - ux * 52 - uy * off, y2 - uy * 52 + ux * off],
              ], { cls: 'arrow', set: { 'stroke-width': 0.8 + p * 5 }, opacity: 0.4 + p * 0.6 }));
              items.push(label(`el-${i}-${j}`, (x1 + x2) / 2 - uy * (off + 14), (y1 + y2) / 2 + ux * (off + 14),
                p.toFixed(2), { cls: 'lab-sm lab-mid' }));
            }));
            pos.forEach(([x, y], i) => {
              items.push({ key: `n-${i}`, tag: 'circle', cls: `pt ${['pt-gold', 'pt-cold', 'pt-cyan'][i]}`, attrs: { cx: x, cy: y, r: 46 } });
              items.push(label(`nl-${i}`, x, y + 5, STATES[i], { cls: 'lab-big lab-mid' }));
              items.push(label(`sl-${i}`, x, y + 68, `stays: ${P[i][i].toFixed(2)}`, { cls: 'lab-sm lab-mid' }));
            });
            return items;
          },
        },
        {
          label: 'it forgets where it started',
          hold: 1900,
          note: 'Three different starting points, run forward. Within about eight steps they are indistinguishable. <b>That convergence is what makes MCMC possible.</b>',
          scene: s => {
            const f = F();
            f.setX(0, 20); f.setY(0, 1);
            const runs = [0, 1, 2].map(k => {
              const v0 = [0, 0, 0]; v0[k] = 1;
              return st.markovRun(P, v0, 20);
            });
            const stat = stationary();
            return [
              ...axes(f, { xLabel: 'step', yLabel: 'probability of being sunny', yN: 5 }),
              hLine(f, stat[0], { key: 'st', cls: 'rule-gold rule-dash' }),
              label('stl', f.x1 - 6, f.sy(stat[0]) - 8, `stationary: ${(stat[0] * 100).toFixed(1)}%`, { cls: 'lab-sm lab-gold lab-end' }),
              ...runs.map((r, k) => path(`r-${k}`, r.map((v, i) => [f.sx(i), f.sy(v[0])]), {
                cls: `curve ${['curve-cyan', 'curve-warm', 'curve-purple'][k]}`, delay: k * 220,
              })),
              ...runs.map((r, k) => label(`rl-${k}`, f.sx(0) + 8, f.sy(r[0][0]) + (k === 0 ? -10 : 16),
                `started ${STATES[k]}`, { cls: `lab-sm ${['lab-cyan', 'lab-warm', 'lab-purple'][k]}`, delay: k * 220 })),
            ];
          },
        },
      ],
    },

    {
      title: 'metropolis: propose, compare, decide',
      prose: `<p>Now the algorithm, which is four lines long.</p>
        <ul>
          <li>From where you are, <strong>propose</strong> a nearby point at random.</li>
          <li>Compute the ratio of the target at the proposal to the target where you are. (The impossible denominator cancels here.)</li>
          <li>If the proposal is <strong>better</strong>, go there.</li>
          <li>If it's <strong>worse</strong>, still go there — but only with probability equal to that ratio. Otherwise stay put and write down your current position again.</li>
        </ul>
        <p>That last rule is the one that matters. Always climbing would trap you at the peak; sometimes accepting a downhill move is what lets the walk explore the whole distribution in the right proportions.</p>`,
      formula: formula(
        t('α', { tone: 'gold' }) + eq + 'min' + paren('1, ' + frac(t('p(θ′) L(θ′)', { tone: 'green' }), t('p(θ) L(θ)', { tone: 'cold' }))) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + 'accept with probability ' + t('α', { tone: 'gold' }),
        { caption: 'uphill always; downhill sometimes' }),
      readouts: [
        { key: 'it', label: 'step', tone: 'gold', get: s => s.iter, d: 0 },
        { key: 'at', label: 'currently at θ =', tone: 'green', get: s => upTo(s).at(-1).x[0], d: 4, wide: true },
        { key: 'acc', label: 'accepted so far', tone: 'cyan', get: s => upTo(s).filter(c => c.accepted).length, d: 0, wide: true },
        { key: 'rate', label: 'acceptance rate', tone: 'warm', get: s => (upTo(s).filter(c => c.accepted).length / upTo(s).length) * 100, d: 1, suf: '%', wide: true },
      ],
      controls: [
        { type: 'slider', key: 'iter', label: 'steps taken', min: 2, max: 400, step: 1, fast: true },
        { type: 'slider', key: 'step', label: 'proposal size', min: 0.005, max: 0.5, step: 0.005, fast: true, fmt: v => (+v).toFixed(3) },
        { type: 'slider', key: 'start', label: 'start from θ =', min: 0.05, max: 0.95, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
      ],
      beats: [
        {
          label: 'the walk, with its rejections',
          note: '<b>Green</b> hops were accepted. <b>Warm ticks</b> are proposals that were rejected — the walk stayed put and counted the same spot again.',
          scene: s => {
            const c = upTo(s);
            const f = F();
            f.setX(0, 1);
            const un = x => Math.exp(logTarget([x]));
            const mx = un(HEADS / N);
            f.setY(0, mx * 1.25);
            const items = [
              ...axes(f, { xLabel: 'θ', yLabel: 'target (unnormalised)', yN: 3, yFmt: () => '' }),
              fnPath(f, un, { key: 'c', cls: 'curve curve-gold', n: 220 }),
            ];
            const show = c.slice(-70);
            show.forEach((pt, i) => {
              const prev = show[i - 1];
              if (!prev) return;
              if (pt.accepted) {
                items.push(path(`h-${i}`, [
                  [f.sx(prev.x[0]), f.sy(un(prev.x[0]))],
                  [f.sx(pt.x[0]), f.sy(un(pt.x[0]))],
                ], { cls: 'curve curve-fit', dur: 160, opacity: 0.35 + (0.65 * i) / show.length, set: { 'stroke-width': 1.2 } }));
              } else {
                items.push({
                  key: `rj-${i}`, tag: 'line', cls: 'stick stick-pos', dur: 160, opacity: 0.5,
                  attrs: { x1: f.sx(pt.proposal[0]), y1: f.y0, x2: f.sx(pt.proposal[0]), y2: f.y0 - 16 },
                  tip: `rejected proposal at θ = <b>${pt.proposal[0].toFixed(3)}</b>`,
                });
              }
            });
            const last = c.at(-1);
            items.push({ key: 'now', tag: 'circle', cls: 'pt pt-green', dur: 160, attrs: { cx: f.sx(last.x[0]), cy: f.sy(un(last.x[0])), r: 9 } });
            items.push(label('nl', f.sx(last.x[0]), f.sy(un(last.x[0])) - 18, `θ = ${last.x[0].toFixed(3)}`, { cls: 'lab lab-mid lab-green', dur: 160 }));
            items.push(label('sl', f.sx(s.start), f.y0 - 6, 'start', { cls: 'lab-sm lab-mid lab-cold' }));
            return items;
          },
        },
        {
          label: 'the trace',
          note: 'The same walk, plotted against time. The early climb out of a bad starting point is the <b>burn-in</b>; after that it should look like a hairy caterpillar.',
          scene: s => {
            const c = upTo(s);
            const f = F();
            f.setX(0, Math.max(20, c.length)); f.setY(0, 1);
            const [lo, hi] = credibleBeta();
            return [
              ...axes(f, { xLabel: 'step', yLabel: 'θ', yN: 5 }),
              rect('ci', f.x0, f.sy(hi), f.x1 - f.x0, f.sy(lo) - f.sy(hi), { cls: 'sq sq-pos', opacity: 0.3 }),
              label('cil', f.x1 - 6, f.sy(hi) - 8, 'true 95% posterior interval', { cls: 'lab-sm lab-end lab-green' }),
              path('tr', c.map((pt, i) => [f.sx(i), f.sy(pt.x[0])]), { cls: 'curve curve-cyan', dur: 200, set: { 'stroke-width': 1.2 } }),
              ...(s.burn > 0 ? [
                rect('burn', f.x0, f.y1, f.sx(s.burn) - f.x0, f.y0 - f.y1, { cls: 'sq sq-neg', opacity: 0.4 }),
                label('bl', f.sx(s.burn) - 6, f.y1 + 14, 'burn-in, discarded', { cls: 'lab-sm lab-end lab-cold' }),
              ] : []),
              hLine(f, POST_A / (POST_A + POST_B), { key: 'tm', cls: 'rule-gold rule-dash' }),
            ];
          },
        },
      ],
    },

    {
      title: 'the footprints are the answer',
      prose: `<p>Now the payoff. Forget the path. Just count <strong>how often the walk visited each region</strong> and draw a histogram.</p>
        <p>That histogram <em>is</em> the posterior. Not an approximation to a summary of it — the draws are samples from it, so any question you can ask of the posterior you can answer by counting draws: the mean, an interval, the probability that θ exceeds a half.</p>
        <p>The dashed curve is the exact Beta(30, 16) posterior we could compute in closed form. Run enough steps and the bars land on it. That agreement is the proof that this strange procedure works.</p>`,
      formula: formula(
        'E' + brackOf('f(θ)') + op('&nbsp;≈&nbsp;') + frac('1', 'S') + ' Σ f' + paren(sup('θ', '(s)')) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('any posterior quantity is now a sample average', { cls: 'fx-muted' }),
        { size: 'sm', caption: 'integration replaced by counting' }),
      readouts: [
        { key: 'n', label: 'draws kept', tone: 'gold', get: s => kept(s).length, d: 0, wide: true },
        { key: 'm', label: 'MCMC mean', tone: 'cyan', get: s => st.mean(kept(s)), d: 4, wide: true },
        { key: 'tm', label: 'exact mean', tone: 'green', get: () => POST_A / (POST_A + POST_B), d: 4, wide: true },
        { key: 'ci', label: 'MCMC 95%', tone: 'warm', wide: true, get: s => {
          const k = kept(s);
          return `${st.quantile(k, 0.025).toFixed(3)}–${st.quantile(k, 0.975).toFixed(3)}`;
        } },
        { key: 'tci', label: 'exact 95%', tone: 'green', wide: true, get: () => {
          const [lo, hi] = credibleBeta();
          return `${lo.toFixed(3)}–${hi.toFixed(3)}`;
        } },
      ],
      controls: [
        { type: 'slider', key: 'iter', label: 'steps taken', min: 20, max: 3000, step: 10, fast: true },
        { type: 'slider', key: 'burn', label: 'discard the first', min: 0, max: 500, step: 10, fast: true },
        { type: 'toggle', key: 'showTrue', label: 'overlay the exact posterior' },
      ],
      beats: [
        {
          label: 'count the visits',
          note: 'Drag the step count up. The bars converge on the exact answer — <b>without ever computing the integral</b>.',
          scene: s => {
            const k = kept(s);
            const f = F();
            f.setX(0.35, 0.95);
            const bins = st.histogram(k, 40, [0.35, 0.95]);
            f.setY(0, Math.max(...bins.map(b => b.density), truePost(POST_A / (POST_A + POST_B))) * 1.15);
            return [
              ...axes(f, { xLabel: 'θ', yLabel: 'density', yN: 4 }),
              ...histBars(f, bins, { key: 'h', cls: 'bar bar-cold', useDensity: true, dur: 220 }),
              ...(s.showTrue ? [fnPath(f, truePost, { key: 'tp', cls: 'curve curve-fit curve-dash', n: 220 })] : []),
              vLine(f, st.mean(k), { key: 'mm', cls: 'rule-gold', dur: 220 }),
              label('l', f.x0 + 10, f.y1 + 10,
                `${k.length} draws · mean ${st.mean(k).toFixed(4)} vs exact ${(POST_A / (POST_A + POST_B)).toFixed(4)}`,
                { cls: 'lab lab-gold', dur: 220 }),
            ];
          },
        },
      ],
    },

    {
      title: 'the step size is the whole craft',
      prose: `<p>Metropolis has one dial, and getting it wrong ruins everything in two opposite ways.</p>
        <p><strong>Too small:</strong> almost every proposal is accepted, but each one barely moves. The chain shuffles instead of exploring, consecutive draws are nearly identical, and although you have ten thousand of them they carry the information of about fifty.</p>
        <p><strong>Too large:</strong> proposals fly off into regions with almost no posterior mass and get rejected. The chain sits in one place for dozens of steps at a time.</p>
        <p>The sweet spot for a one-dimensional random walk is an acceptance rate near <strong>0.44</strong>; in high dimensions it drops toward 0.23. <strong>Sweep the step size</strong> and watch both failures.</p>`,
      aside: `<b>Why modern samplers exist.</b> Everything hard about MCMC is in this step. Hamiltonian Monte Carlo — what Stan and PyMC actually run — uses gradients of the log posterior to propose distant points that still get accepted, which is how a hundred-parameter model becomes feasible. Metropolis is the honest illustration; nobody runs it in anger.`,
      readouts: [
        { key: 'step', label: 'proposal size', tone: 'gold', get: s => +s.step, d: 3 },
        { key: 'rate', label: 'acceptance rate', tone: 'warm', get: s => (upTo(s).filter(c => c.accepted).length / upTo(s).length) * 100, d: 1, suf: '%', wide: true },
        { key: 'ess', label: 'effective sample size', tone: 'cyan', get: s => ess(kept(s)), d: 0, wide: true, explain: 'How many independent draws your correlated chain is actually worth. This is the number that matters, not the raw step count.' },
        { key: 'n', label: 'raw draws', get: s => kept(s).length, d: 0, wide: true },
        { key: 'verdict', label: 'verdict', tone: 'green', wide: true, get: s => {
          const r = upTo(s).filter(c => c.accepted).length / upTo(s).length;
          return r > 0.8 ? 'too timid' : r < 0.15 ? 'too bold' : 'about right';
        } },
      ],
      controls: [
        { type: 'slider', key: 'step', label: 'proposal size', min: 0.002, max: 0.6, step: 0.002, fast: true, fmt: v => (+v).toFixed(3) },
        { type: 'slider', key: 'iter', label: 'steps taken', min: 100, max: 3000, step: 20, fast: true },
      ],
      beats: [
        {
          label: 'trace and histogram together',
          note: 'A healthy chain looks like a fuzzy band with no trends and no long flat runs. Both failure modes are obvious once you know the picture.',
          scene: s => {
            const c = upTo(s);
            const k = kept(s);
            const fa = frame({ w: 720, h: 540, l: 58, r: 300, t: 40, b: 60 });
            fa.setX(0, c.length); fa.setY(0.35, 0.95);
            const fb = frame({ w: 720, h: 540, l: 440, r: 28, t: 40, b: 60 });
            fb.setX(0.35, 0.95);
            const bins = st.histogram(k, 26, [0.35, 0.95]);
            fb.setY(0, Math.max(...bins.map(b => b.density), truePost(0.65)) * 1.15);
            const rate = c.filter(x => x.accepted).length / c.length;
            return [
              ...axes(fa, { xLabel: 'step', yLabel: 'θ', prefix: 'a', xN: 3, yN: 5 }),
              path('tr', c.map((pt, i) => [fa.sx(i), fa.sy(pt.x[0])]), { cls: 'curve curve-cyan', dur: 200, set: { 'stroke-width': 1 } }),
              ...axes(fb, { xLabel: 'θ', prefix: 'b', xN: 3, showY: false }),
              ...histBars(fb, bins, { key: 'h', cls: 'bar bar-cold', useDensity: true, dur: 200 }),
              fnPath(fb, truePost, { key: 'tp', cls: 'curve curve-fit curve-dash', n: 200 }),
              label('r', 360, 500,
                `acceptance ${(rate * 100).toFixed(0)}% · effective sample size ${ess(k)} out of ${k.length}`,
                { cls: 'lab-big lab-mid lab-gold', dur: 200 }),
              label('v', 360, 522,
                rate > 0.8 ? 'too timid — barely moving, draws nearly identical'
                  : rate < 0.15 ? 'too bold — stuck in place, long flat runs'
                    : 'healthy — a hairy caterpillar',
                { cls: `lab lab-mid ${rate > 0.8 || rate < 0.15 ? 'lab-warm' : 'lab-green'}`, dur: 200 }),
            ];
          },
        },
      ],
    },
  ],
};

function brackOf(x) { return `<span class="fx-paren">[</span>${x}<span class="fx-paren">]</span>`; }

function stationary() {
  let v = [1 / 3, 1 / 3, 1 / 3];
  for (let i = 0; i < 400; i++) v = P[0].map((_, j) => st.sum(v.map((p, k) => p * P[k][j])));
  return v;
}

function credibleBeta(conf = 0.95) {
  const inv = p => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 70; i++) { const m = (lo + hi) / 2; if (st.ibeta(POST_A, POST_B, m) < p) lo = m; else hi = m; }
    return (lo + hi) / 2;
  };
  return [inv((1 - conf) / 2), inv(1 - (1 - conf) / 2)];
}

/** effective sample size from the integrated autocorrelation, truncated at the first negative lag */
function ess(x) {
  const n = x.length;
  if (n < 10) return n;
  const m = st.mean(x), v = st.varianceP(x);
  if (v === 0) return 1;
  let sum = 0;
  for (let lag = 1; lag < Math.min(200, n - 1); lag++) {
    let c = 0;
    for (let i = 0; i < n - lag; i++) c += (x[i] - m) * (x[i + lag] - m);
    const rho = c / ((n - lag) * v);
    if (rho <= 0.02) break;
    sum += rho;
  }
  return Math.max(1, Math.round(n / (1 + 2 * sum)));
}
