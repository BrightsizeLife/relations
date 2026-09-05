/* ─────────────────────────────────────────────────────────────────────────────
   gametheory.js — decision theory when the thing you are deciding against is
   also deciding. Three ideas: dominance, equilibrium, and why you sometimes
   have to be genuinely random.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, arrowDefs } from '../core/plot.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sub, sup, paren, eq, minus, op } from '../core/fx.js';

const F = () => frame({ w: 720, h: 540, l: 70, r: 28, t: 34, b: 58 });

/* payoffs are [row player, column player] */
const GAMES = {
  prisoner: {
    label: "prisoner's dilemma",
    rows: ['stay quiet', 'confess'], cols: ['stay quiet', 'confess'],
    pay: [[[-1, -1], [-3, 0]], [[0, -3], [-2, -2]]],
    note: 'both would do better staying quiet, and neither will',
  },
  stag: {
    label: 'stag hunt',
    rows: ['hunt stag', 'hunt hare'], cols: ['hunt stag', 'hunt hare'],
    pay: [[[4, 4], [0, 3]], [[3, 0], [2, 2]]],
    note: 'two equilibria — one better for everyone, one safer',
  },
  chicken: {
    label: 'chicken',
    rows: ['swerve', 'straight'], cols: ['swerve', 'straight'],
    pay: [[[0, 0], [-1, 2]], [[2, -1], [-10, -10]]],
    note: 'two equilibria, and they disagree about who wins',
  },
  pennies: {
    label: 'matching pennies',
    rows: ['heads', 'tails'], cols: ['heads', 'tails'],
    pay: [[[1, -1], [-1, 1]], [[-1, 1], [1, -1]]],
    note: 'zero-sum, and no pure equilibrium exists at all',
  },
};

const G = s => GAMES[s.game];

/** which cells are Nash equilibria in pure strategies */
function nash(g) {
  const out = [];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const rowBest = g.pay[i][j][0] >= g.pay[1 - i][j][0];
    const colBest = g.pay[i][j][1] >= g.pay[i][1 - j][1];
    if (rowBest && colBest) out.push([i, j]);
  }
  return out;
}

/** does the row player have a strictly dominant strategy? */
function dominant(g, who) {
  for (let i = 0; i < 2; i++) {
    let all = true;
    for (let j = 0; j < 2; j++) {
      const mine = who === 0 ? g.pay[i][j][0] : g.pay[j][i][1];
      const other = who === 0 ? g.pay[1 - i][j][0] : g.pay[j][1 - i][1];
      if (mine <= other) { all = false; break; }
    }
    if (all) return i;
  }
  return null;
}

/* matrix geometry */
const CW = 150, CH = 96, MX = 250, MY = 180;

function matrix(g, { highlight = [], key = 'm', showBest = false, dur } = {}) {
  const items = [
    label(key + '-rt', MX - 20, MY - 46, 'you', { cls: 'lab lab-end lab-cyan' }),
    label(key + '-ct', MX + CW, MY - 38, 'them', { cls: 'lab lab-mid lab-warm' }),
    ...g.cols.map((c, j) => label(`${key}-ch-${j}`, MX + j * CW + CW / 2, MY - 20, c, { cls: 'lab-sm lab-mid lab-warm' })),
    ...g.rows.map((r, i) => label(`${key}-rh-${i}`, MX - 14, MY + i * CH + CH / 2 + 4, r, { cls: 'lab-sm lab-end lab-cyan' })),
  ];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const hot = highlight.some(([a, b]) => a === i && b === j);
    items.push(rect(`${key}-c-${i}-${j}`, MX + j * CW, MY + i * CH, CW - 4, CH - 4, {
      cls: hot ? 'sq sq-pos' : 'cell', dur, opacity: hot ? 0.85 : 1,
      tip: `you ${g.pay[i][j][0]}, them ${g.pay[i][j][1]}`,
    }));
    items.push(label(`${key}-a-${i}-${j}`, MX + j * CW + 30, MY + i * CH + CH / 2 + 6,
      String(g.pay[i][j][0]), { cls: 'lab-big lab-cyan', dur }));
    items.push(label(`${key}-b-${i}-${j}`, MX + j * CW + CW - 34, MY + i * CH + CH / 2 + 6,
      String(g.pay[i][j][1]), { cls: 'lab-big lab-end lab-warm', dur }));
  }
  if (showBest) {
    // mark each player's best reply to each of the other's choices
    for (let j = 0; j < 2; j++) {
      const i = g.pay[0][j][0] >= g.pay[1][j][0] ? 0 : 1;
      items.push({
        key: `${key}-br-${j}`, tag: 'circle', cls: 'pt pt-cyan', dur,
        attrs: { cx: MX + j * CW + 14, cy: MY + i * CH + CH / 2, r: 5 },
      });
    }
    for (let i = 0; i < 2; i++) {
      const j = g.pay[i][0][1] >= g.pay[i][1][1] ? 0 : 1;
      items.push({
        key: `${key}-bc-${i}`, tag: 'circle', cls: 'pt pt-warm', dur,
        attrs: { cx: MX + j * CW + CW - 18, cy: MY + i * CH + CH / 2, r: 5 },
      });
    }
  }
  return items;
}

export default {
  meta: {
    id: 'gametheory', title: 'game theory', kicker: 'WHEN THE WORLD ANSWERS BACK',
    status: 'live',
    deck: 'Everything else on this site treats the world as indifferent — it produces data, you analyse it, it does not react. Game theory is what happens when the thing you are modelling is also modelling you. Three ideas cover most of it, and the third one is the reason randomness can be a <em>strategy</em>.',
    dataNote: 'No dataset. The payoff numbers are the classic textbook games, and every equilibrium and best-reply on the page is computed from whichever matrix you have selected.',
    deps: ['decisiontheory'], unlocks: [],
    next: 'computation', nextLabel: 'how computers do this',
    outro: 'your best move depends on their best move, which depends on yours. that circle is the whole subject.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { game: 'prisoner', p: 50, q: 50, rounds: 0 },

  steps: [
    {
      title: 'a payoff matrix, and a move you should always make',
      prose: `<p>Two players, two choices each, four outcomes. Each cell holds two numbers: what you get, and what they get.</p>
        <p>Start with the easiest situation. Sometimes one of your options is better <em>no matter what they do</em> — better if they cooperate, better if they defect. That is a <strong>dominant strategy</strong>, and it removes the need to think about them at all.</p>
        <p>In the prisoner's dilemma both players have one, and both dominant strategies lead to an outcome both players dislike. That is the whole scandal of the game: individually rational choices, collectively worse than the alternative, with no error anywhere.</p>`,
      formula: formula(
        t('dominant', { tone: 'green' }) + ': ' +
        t('u(A, anything they do)', { tone: 'cyan' }) + ' > ' + t('u(B, that same thing)', { tone: 'muted' }) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('then never play B', { cls: 'fx-muted' }),
        { size: 'sm', caption: 'a choice that survives every guess about the other player' }),
      readouts: [
        { key: 'g', label: 'game', tone: 'gold', get: s => G(s).label, wide: true },
        { key: 'dr', label: 'your dominant move', tone: 'cyan', wide: true, get: s => {
          const d = dominant(G(s), 0);
          return d == null ? 'none' : G(s).rows[d];
        } },
        { key: 'dc', label: 'their dominant move', tone: 'warm', wide: true, get: s => {
          const d = dominant(G(s), 1);
          return d == null ? 'none' : G(s).cols[d];
        } },
      ],
      controls: [
        { type: 'segment', key: 'game', label: 'game', options: Object.entries(GAMES).map(([k, v]) => ({ value: k, label: v.label.replace("prisoner's ", "prisoner's ").split(' ')[0], explain: v.note })) },
      ],
      beats: [
        {
          label: 'read the matrix',
          note: 'Blue is your payoff, warm is theirs. Higher is better for both. <b>Hover any cell.</b>',
          scene: s => [
            label('t', 376, 110, G(s).label, { cls: 'lab-big lab-mid lab-gold', dur: 240 }),
            ...matrix(G(s), { dur: 240 }),
            label('n', 376, 460, G(s).note, { cls: 'lab lab-mid', dur: 240 }),
          ],
        },
        {
          label: 'compare down each column',
          hold: 2000,
          note: 'Fix what they do, then ask which of your rows is better. If the same row wins in <b>both</b> columns, it dominates.',
          scene: s => {
            const g = G(s);
            const d = dominant(g, 0);
            const items = [
              label('t', 376, 110, 'for each thing they might do, which row is better for you?', { cls: 'lab lab-mid' }),
              ...matrix(g, { dur: 240 }),
            ];
            for (let j = 0; j < 2; j++) {
              const better = g.pay[0][j][0] >= g.pay[1][j][0] ? 0 : 1;
              items.push(rect(`hl-${j}`, MX + j * CW, MY + better * CH, CW - 4, CH - 4, {
                cls: 'bar-out', dur: 300, delay: j * 400,
              }));
            }
            items.push(label('v', 376, 460,
              d == null ? 'no row wins both columns — you cannot avoid thinking about them'
                : `"${g.rows[d]}" wins in both columns — it dominates`,
              { cls: `lab-big lab-mid ${d == null ? 'lab-warm' : 'lab-green'}`, dur: 240 }));
            return items;
          },
        },
        {
          label: 'where dominance leads',
          note: 'If both players follow their dominant move you land here. In the prisoner\'s dilemma that cell is worse for <b>both</b> of them than the one they could have had.',
          scene: s => {
            const g = G(s);
            const dr = dominant(g, 0), dc = dominant(g, 1);
            const cell = dr != null && dc != null ? [[dr, dc]] : [];
            const better = g.pay[0][0][0] > (cell.length ? g.pay[dr][dc][0] : -99)
              && g.pay[0][0][1] > (cell.length ? g.pay[dr][dc][1] : -99);
            return [
              label('t', 376, 110, cell.length ? 'both play their dominant move' : 'no dominant moves here', { cls: 'lab-big lab-mid', dur: 240 }),
              ...matrix(g, { highlight: cell, dur: 240 }),
              ...(better ? [
                rect('alt', MX, MY, CW - 4, CH - 4, { cls: 'bar-out', dur: 300 }),
                label('altl', 376, 462, 'the outlined cell is better for both of them, and unreachable',
                  { cls: 'lab lab-mid lab-warm', dur: 240 }),
              ] : [label('altl', 376, 462, g.note, { cls: 'lab lab-mid', dur: 240 })]),
            ];
          },
        },
      ],
    },

    {
      title: 'nash equilibrium: nobody wants to move',
      prose: `<p>Most games have no dominant strategy, so you need a weaker idea that still pins something down.</p>
        <p>A <strong>Nash equilibrium</strong> is a pair of choices where neither player can improve by changing theirs alone, given what the other is doing. It is not "the best outcome" and it is not "what they agreed". It is just a resting point: a place where unilateral second thoughts do not pay.</p>
        <p>Find it by marking each player's best reply to each of the other's options. Where both marks land in the same cell, nobody wants to move.</p>`,
      formula: formula(
        t('Nash', { tone: 'green' }) + ': ' +
        t('your move is a best reply to theirs', { tone: 'cyan' }) +
        op('&nbsp;&nbsp;and&nbsp;&nbsp;') +
        t('theirs is a best reply to yours', { tone: 'warm' }),
        { size: 'sm', caption: 'stability, not optimality — the two get confused constantly' }),
      readouts: [
        { key: 'g', label: 'game', tone: 'gold', get: s => G(s).label, wide: true },
        { key: 'n', label: 'pure equilibria', tone: 'green', get: s => nash(G(s)).length, d: 0, wide: true },
        { key: 'which', label: 'at', wide: true, get: s => {
          const n = nash(G(s));
          if (!n.length) return 'none in pure strategies';
          return n.map(([i, j]) => `${G(s).rows[i]} / ${G(s).cols[j]}`).join('  ·  ');
        } },
      ],
      controls: [
        { type: 'segment', key: 'game', label: 'game', options: Object.entries(GAMES).map(([k, v]) => ({ value: k, label: v.label.split(' ')[0], explain: v.note })) },
      ],
      beats: [
        {
          label: 'mark the best replies',
          hold: 2000,
          note: 'A blue dot marks your best row given their column. A warm dot marks their best column given your row.',
          scene: s => [
            label('t', 376, 110, 'best replies', { cls: 'lab-big lab-mid', dur: 240 }),
            ...matrix(G(s), { showBest: true, dur: 240 }),
            label('n', 376, 460, 'a cell with both dots is an equilibrium', { cls: 'lab lab-mid', dur: 240 }),
          ],
        },
        {
          label: 'the resting points',
          note: 'Zero, one or two of them. <b>Chicken and the stag hunt have two</b> — which means the theory alone cannot tell you which one you will end up in.',
          scene: s => {
            const g = G(s);
            const n = nash(g);
            return [
              label('t', 376, 110, n.length === 0 ? 'no pure equilibrium exists' : n.length === 1 ? 'one equilibrium' : 'two equilibria', { cls: 'lab-big lab-mid lab-gold', dur: 240 }),
              ...matrix(g, { highlight: n, showBest: true, dur: 240 }),
              label('n', 376, 460,
                n.length === 0 ? 'whatever you do, one of you wants to change — the next step is the fix'
                  : n.length === 2 ? 'stability does not imply agreement about which stable point'
                    : g.note,
                { cls: `lab lab-mid ${n.length !== 1 ? 'lab-warm' : ''}`, dur: 240 }),
            ];
          },
        },
      ],
    },

    {
      title: 'when you have to be genuinely random',
      prose: `<p>Matching pennies has no resting point at all. If you always play heads, they play heads and beat you; so you switch to tails, and they follow. Every pure strategy is exploitable, which is the same problem a goalkeeper, a tax auditor and a poker player all have.</p>
        <p>The resolution is to stop choosing a move and start choosing a <strong>probability</strong>. And the equilibrium mixture has a property that always surprises people: you pick your probability so that <em>your opponent is indifferent</em> between their options — not so that your own payoff is maximised.</p>
        <p><strong>Slide your mix and watch their two payoff lines.</strong> Where the lines cross, they have no reason to prefer either move, and so no way to exploit you.</p>`,
      formula: formula(
        t('mixed equilibrium', { tone: 'green' }) + ': choose p so that ' +
        t('their payoff from heads', { tone: 'warm' }) + eq + t('their payoff from tails', { tone: 'warm' }) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('you are making them indifferent, not yourself happy', { cls: 'fx-muted' }),
        { size: 'sm', caption: 'unexploitable, which in a zero-sum game is the best there is' }),
      dep: { note: 'A genuinely unpredictable mix needs a real random source — which is its own problem.', lesson: 'computation', label: 'how computers do this' },
      readouts: [
        { key: 'p', label: 'you play heads', tone: 'cyan', get: s => +s.p, d: 0, suf: '%' },
        { key: 'eh', label: 'their payoff if heads', tone: 'warm', get: s => theirs(s, 0), d: 3, wide: true },
        { key: 'et', label: 'their payoff if tails', tone: 'warm', get: s => theirs(s, 1), d: 3, wide: true },
        { key: 'exp', label: 'exploitable?', tone: 'gold', wide: true, get: s => {
          const gap = Math.abs(theirs(s, 0) - theirs(s, 1));
          return gap < 0.02 ? 'no — they are indifferent' : 'yes, they will pick the better one';
        } },
      ],
      controls: [
        { type: 'slider', key: 'p', label: 'your probability of heads', min: 0, max: 100, step: 1, fast: true, fmt: v => v + '%' },
        { type: 'segment', key: 'game', label: 'game', options: [{ value: 'pennies', label: 'matching pennies' }, { value: 'chicken', label: 'chicken' }] },
      ],
      beats: [
        {
          label: 'their two options, as you vary',
          note: 'The crossing point is the only mix they cannot beat. Anywhere else, one of their lines is above the other and they simply take it.',
          scene: s => {
            const g = G(s);
            const f = F();
            f.setX(0, 1);
            const vals = [0, 1].flatMap(j => [0, 1].map(p => theirsAt(g, p, j)));
            f.setY(Math.min(...vals) - 0.6, Math.max(...vals) + 0.6);
            const cross = crossing(g);
            return [
              ...axes(f, { xLabel: 'your probability of the first move', yLabel: 'their expected payoff', yN: 5, xFmt: v => (v * 100).toFixed(0) + '%' }),
              fnPath(f, p => theirsAt(g, p, 0), { key: 'h', cls: 'curve curve-warm', n: 40 }),
              fnPath(f, p => theirsAt(g, p, 1), { key: 't', cls: 'curve curve-cold', n: 40 }),
              label('lh', f.x1 - 8, f.sy(theirsAt(g, 1, 0)) - 10, `they play "${g.cols[0]}"`, { cls: 'lab-sm lab-end lab-warm' }),
              label('lt', f.x1 - 8, f.sy(theirsAt(g, 1, 1)) + 18, `they play "${g.cols[1]}"`, { cls: 'lab-sm lab-end lab-cold' }),
              ...(cross != null ? [
                vLine(f, cross, { key: 'x', cls: 'rule-gold rule-dash' }),
                { key: 'xp', tag: 'circle', cls: 'pt pt-green', attrs: { cx: f.sx(cross), cy: f.sy(theirsAt(g, cross, 0)), r: 8 } },
                label('xl', f.sx(cross), f.y1 + 8, `equilibrium mix · ${(cross * 100).toFixed(0)}%`, { cls: 'lab-big lab-mid lab-green' }),
              ] : []),
              vLine(f, +s.p / 100, { key: 'you', cls: 'rule-x', dur: 200 }),
              label('yl', f.sx(+s.p / 100), f.y0 + 20, 'you', { cls: 'lab-sm lab-mid lab-cyan', dur: 200 }),
            ];
          },
        },
        {
          label: 'what happens if you are predictable',
          hold: 2000,
          note: 'Two hundred rounds against an opponent who watches your history and plays the counter. <b>Any bias at all gets found and punished.</b>',
          scene: s => {
            const g = G(s);
            const p = +s.p / 100;
            const r = st.rng(606);
            let score = 0;
            const pts = [0];
            const hist = [0, 0];
            for (let k = 0; k < 200; k++) {
              const mine = r() < p ? 0 : 1;
              // opponent estimates your mix and best-replies to it
              const est = hist[0] / Math.max(1, hist[0] + hist[1]);
              const theirBest = theirsAt(g, est, 0) >= theirsAt(g, est, 1) ? 0 : 1;
              score += g.pay[mine][theirBest][0];
              hist[mine]++;
              pts.push(score);
            }
            const f = F();
            f.setX(0, 200);
            f.setY(Math.min(-60, Math.min(...pts) - 10), Math.max(20, Math.max(...pts) + 10));
            return [
              ...axes(f, { xLabel: 'rounds', yLabel: 'your cumulative payoff', yN: 5 }),
              hLine(f, 0, { key: 'z', cls: 'rule-faint rule-dash' }),
              path('run', pts.map((v, i) => [f.sx(i), f.sy(clamp(v, f.dy[0], f.dy[1]))]), { cls: 'curve curve-warm', dur: 900 }),
              label('l', 376, f.y1 + 6,
                `playing heads ${(+s.p).toFixed(0)}% of the time → ${pts.at(-1)} after 200 rounds`,
                { cls: 'lab-big lab-mid lab-gold', dur: 240 }),
              label('l2', 376, f.y1 + 28,
                Math.abs(p - 0.5) < 0.04 ? 'an even mix cannot be beaten — it hovers around zero'
                  : 'a lopsided mix bleeds steadily once they notice',
                { cls: 'lab lab-mid', dur: 240 }),
            ];
          },
        },
      ],
    },

    {
      title: 'why any of this matters to a researcher',
      prose: `<p>Three places this stops being a curiosity and starts being your problem.</p>
        <p><strong>Your measurement changes behaviour.</strong> The moment a metric becomes a target, the people being measured start optimising against it. That is not cheating, it is a best reply — and it means an observational estimate of "the effect of the metric" is estimating an equilibrium, not a mechanism.</p>
        <p><strong>Incentives inside your own field.</strong> Publication rewards novel positive results. Individually rational responses to that — p-hacking, selective reporting, HARKing — produce a literature everyone would prefer not to have. It is a prisoner's dilemma with journals as the payoff matrix, and it explains why exhortation fails and preregistration works.</p>
        <p><strong>Randomisation as strategy.</strong> Audits, quality checks and A/B assignment all have to be unpredictable to the people affected, or they get gamed. That is the mixed-strategy result, applied.</p>`,
      aside: `<b>Goodhart's law, stated properly.</b> "When a measure becomes a target, it ceases to be a good measure" is usually quoted as a warning about bad faith. It is really a statement about equilibria: the correlation you measured held under the old incentives, and you have just changed the incentives. The relationship does not survive the intervention that relied on it.`,
      readouts: [],
      beats: [
        {
          label: 'the research dilemma',
          note: 'Same structure as the prisoner\'s dilemma, with the field as the other player. Both would rather everyone reported everything; neither individually benefits from going first.',
          scene: () => {
            const g = {
              rows: ['report everything', 'report the wins'],
              cols: ['report everything', 'report the wins'],
              pay: [[[3, 3], [0, 4]], [[4, 0], [1, 1]]],
            };
            return [
              label('t', 376, 100, 'you, and everyone else in your field', { cls: 'lab-big lab-mid' }),
              ...matrix(g, { highlight: [[1, 1]], showBest: true }),
              label('n1', 376, 458, 'the equilibrium is bottom-right, and everybody prefers top-left', { cls: 'lab lab-mid lab-warm' }),
              label('n2', 376, 484, 'you do not fix this by asking people to be better — you change the payoffs', { cls: 'lab-sm lab-mid lab-green' }),
            ];
          },
        },
      ],
    },
  ],
};

const theirsAt = (g, p, j) => p * g.pay[0][j][1] + (1 - p) * g.pay[1][j][1];
const theirs = (s, j) => theirsAt(G(s), +s.p / 100, j);

/** the mix that makes the column player indifferent, if it exists in [0,1] */
function crossing(g) {
  const a = g.pay[0][0][1] - g.pay[0][1][1];
  const b = g.pay[1][0][1] - g.pay[1][1][1];
  if (Math.abs(a - b) < 1e-9) return null;
  const p = -b / (a - b);
  return p >= 0 && p <= 1 ? p : null;
}
