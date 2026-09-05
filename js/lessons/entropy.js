/* ─────────────────────────────────────────────────────────────────────────────
   entropy.js — how much you don't know, measured in bits. Surprise, averaged.
   Turns up as the splitting rule in trees, the loss in classifiers, and the
   deviance in every GLM on this site.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { frame, axes, points, hLine, vLine, label, numLabel, path, rect, fnPath, arrowDefs } from '../core/plot.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sub, sup, sumOver, paren, eq, minus, op } from '../core/fx.js';

const F = () => frame({ w: 720, h: 540, l: 66, r: 28, t: 34, b: 58 });

const LABELS = ['A', 'B', 'C', 'D'];

/** normalise the four sliders into a probability distribution */
function P(s) {
  const raw = [s.p0, s.p1, s.p2, s.p3].map(v => Math.max(0, +v));
  const tot = st.sum(raw) || 1;
  return raw.map(v => v / tot);
}

const log2 = x => Math.log(x) / Math.LN2;
const surprise = (p, base) => (p <= 0 ? Infinity : -(base === 2 ? log2(p) : Math.log(p)));

function H(p, base = 2) {
  return st.sum(p.map(v => (v <= 0 ? 0 : -v * (base === 2 ? log2(v) : Math.log(v)))));
}

const unit = s => (s.base === 2 ? 'bits' : 'nats');

export default {
  meta: {
    id: 'entropy', title: 'entropy & information', kicker: 'HOW MUCH YOU DO NOT KNOW',
    status: 'live',
    deck: 'Information has a unit. Entropy measures how uncertain a distribution is — literally, how many yes/no questions you would need on average to pin down the answer. It is the splitting rule inside a decision tree, the loss function in every classifier, and the deviance in every GLM here.',
    dataNote: 'The distribution is yours to set with the sliders, so you can drive it to both extremes and watch the measure respond. No dataset needed — entropy is a property of a distribution, not of a sample.',
    deps: ['settheory'], unlocks: ['mutualinfo', 'decisiontree'],
    next: 'mutualinfo', nextLabel: 'mutual information',
    outro: 'surprise, averaged. that is the whole definition, and it turns out to be the only one that works.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: { p0: 25, p1: 25, p2: 25, p3: 25, base: 2, coin: 0.5 },

  steps: [
    {
      title: 'surprise is the log of how unlikely it was',
      prose: `<p>Start with one outcome, not a whole distribution. How <em>surprising</em> is it when something with probability p happens?</p>
        <p>Three things any sensible measure must do: something certain should carry zero surprise; rarer things should surprise you more; and the surprise of two independent things happening should be the <strong>sum</strong> of their individual surprises.</p>
        <p>That third requirement is the demanding one, and it forces the answer. Only a logarithm turns multiplication into addition. So surprise is −log p, and there is no other option.</p>`,
      formula: formula(
        t('surprise', { tone: 'warm' }) + paren('p') + eq + minus + 'log' + sub('', '2') + ' p' +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') +
        t('p(A and B) = p(A)p(B)', { tone: 'muted' }) + op('&nbsp;⟹&nbsp;') + t('surprises add', { tone: 'green' }),
        { caption: 'the only function that turns multiplying into adding' }),
      readouts: [
        { key: 'p', label: 'probability', tone: 'cyan', get: s => +s.coin, d: 3 },
        { key: 's', label: 'surprise', tone: 'warm', get: s => surprise(+s.coin, s.base), d: 3, wide: true },
        { key: 'u', label: 'unit', get: s => unit(s) },
      ],
      controls: [
        { type: 'slider', key: 'coin', label: 'probability of the event', min: 0.005, max: 1, step: 0.005, fast: true, fmt: v => (+v).toFixed(3) },
        { type: 'segment', key: 'base', label: 'measured in', options: [{ value: 2, label: 'bits (log₂)' }, { value: 'e', label: 'nats (ln)' }] },
      ],
      beats: [
        {
          label: 'the surprise curve',
          note: 'A certainty carries <b>zero</b> information — learning it told you nothing. A one-in-a-thousand event carries about ten bits.',
          scene: s => {
            const f = F();
            f.setX(0, 1); f.setY(0, 8);
            return [
              ...axes(f, { xLabel: 'probability of the outcome', yLabel: `surprise (${unit(s)})`, yN: 5 }),
              fnPath(f, x => Math.min(8, surprise(x, s.base)), { key: 'c', cls: 'curve curve-warm', n: 300, from: 0.004 }),
              { key: 'pt', tag: 'circle', cls: 'pt pt-warm', dur: 180, attrs: { cx: f.sx(+s.coin), cy: f.sy(Math.min(8, surprise(+s.coin, s.base))), r: 8 } },
              vLine(f, 1, { key: 'one', cls: 'rule-faint rule-dash' }),
              label('l1', f.sx(1) - 8, f.y0 - 12, 'certain → no information', { cls: 'lab-sm lab-end' }),
              label('l2', f.x0 + 12, f.y1 + 14, 'nearly impossible → a lot of information', { cls: 'lab-sm' }),
              numLabel('v', f.sx(+s.coin) + 12, f.sy(Math.min(8, surprise(+s.coin, s.base))) - 10, surprise(+s.coin, s.base), {
                cls: 'lab-big lab-warm', d: 2, suf: ' ' + unit(s), dur: 180,
              }),
            ];
          },
        },
        {
          label: 'why it has to be a log',
          note: 'Two independent coin flips: each is 1 bit, together they are 2 bits — and 1/2 × 1/2 = 1/4, whose surprise is exactly 2. Multiplication became addition.',
          scene: s => {
            const items = [];
            const rows = [
              ['one flip', 0.5, '1 bit'],
              ['two flips', 0.25, '2 bits'],
              ['three flips', 0.125, '3 bits'],
              ['ten flips', 1 / 1024, '10 bits'],
            ];
            rows.forEach((r, i) => {
              const y = 150 + i * 78;
              items.push(rect(`bg-${i}`, 70, y - 26, 580, 62, { cls: 'cell', delay: i * 160, opacity: 0.8 }));
              items.push(label(`n-${i}`, 92, y, r[0], { cls: 'lab-big lab-cyan', delay: i * 160 }));
              items.push(label(`p-${i}`, 300, y, `p = ${r[1] < 0.01 ? '1/1024' : r[1]}`, { cls: 'lab', delay: i * 160 }));
              items.push(label(`s-${i}`, 620, y, r[2], { cls: 'lab-big lab-end lab-warm', delay: i * 160 }));
              items.push(label(`e-${i}`, 92, y + 20, `−log₂(${r[1] < 0.01 ? '1/1024' : r[1]}) = ${(-log2(r[1])).toFixed(0)}`, { cls: 'lab-sm', delay: i * 160 }));
            });
            items.push(label('t', 360, 90, 'probabilities multiply · surprises add', { cls: 'lab-big lab-mid lab-gold' }));
            return items;
          },
        },
      ],
    },

    {
      title: 'entropy is surprise, averaged',
      prose: `<p>Now a whole distribution. Some outcomes are likely and boring, some are rare and informative. Entropy is the <strong>expected</strong> surprise — each outcome's surprise, weighted by how often it happens.</p>
        <p>That weighting matters. A very rare outcome carries enormous surprise but almost never occurs, so it contributes little. The middle of the distribution does most of the work.</p>
        <p><strong>Drag the four bars around.</strong> Watch entropy peak when everything is equally likely and collapse to zero when one outcome takes over.</p>`,
      formula: formula(
        t('H', { tone: 'gold' }) + paren('X') + eq + minus +
        sumOver(t('p', { tone: 'cyan' }) + sub('', 'i') + ' log' + sub('', '2') + ' ' + t('p', { tone: 'cyan' }) + sub('', 'i'), { from: 'i', to: '' }),
        { caption: 'each outcome\'s surprise, weighted by its probability' }),
      readouts: [
        { key: 'h', label: 'entropy', tone: 'gold', get: s => H(P(s), s.base), d: 4, wide: true },
        { key: 'max', label: 'maximum possible', tone: 'green', get: s => (s.base === 2 ? 2 : Math.log(4)), d: 4, wide: true },
        { key: 'pct', label: 'of the maximum', tone: 'cyan', get: s => (H(P(s), s.base) / (s.base === 2 ? 2 : Math.log(4))) * 100, d: 1, suf: '%', wide: true },
        { key: 'u', label: 'unit', get: s => unit(s) },
      ],
      controls: [
        ...range(4).map(i => ({ type: 'slider', key: 'p' + i, label: LABELS[i], min: 0, max: 100, step: 1, fast: true })),
        { type: 'button', key: 'flat', label: '[make it uniform]', action: s => { s.p0 = s.p1 = s.p2 = s.p3 = 25; } },
        { type: 'button', key: 'sure', label: '[make it certain]', action: s => { s.p0 = 100; s.p1 = s.p2 = s.p3 = 0; } },
      ],
      beats: [
        {
          label: 'the contributions',
          note: 'The warm outline on each bar is that outcome\'s contribution to the total. Notice it is <b>not</b> tallest for the tallest bar.',
          scene: s => {
            const p = P(s);
            const contrib = p.map(v => (v <= 0 ? 0 : -v * (s.base === 2 ? log2(v) : Math.log(v))));
            const f = F();
            f.setX(-0.5, 3.5); f.setY(0, 1.05);
            const maxC = Math.max(...contrib, 0.01);
            return [
              ...axes(f, { yLabel: 'probability', showX: false, xN: 0, yN: 4 }),
              ...p.map((v, i) => rect(`b-${i}`, f.sx(i) - 62, f.sy(v), 124, f.y0 - f.sy(v), {
                cls: `sq sq-${['x', 'y', 'pos', 'neg'][i]}`, dur: 220, opacity: 0.9,
                tip: `${LABELS[i]}<br>p = <b>${v.toFixed(3)}</b><br>surprise = <b>${v > 0 ? surprise(v, s.base).toFixed(2) : '∞'}</b><br>contributes <b>${contrib[i].toFixed(3)}</b>`,
              })),
              ...p.map((v, i) => rect(`c-${i}`, f.sx(i) - 30, f.y0 - (contrib[i] / maxC) * 120, 60, (contrib[i] / maxC) * 120, {
                cls: 'bar-out', dur: 220,
              })),
              ...LABELS.map((L, i) => label(`l-${i}`, f.sx(i), f.y0 + 20, L, { cls: 'ax-label lab-mid' })),
              ...p.map((v, i) => label(`pv-${i}`, f.sx(i), f.sy(v) - 10, v.toFixed(2), { cls: 'lab-sm lab-mid', dur: 220 })),
              numLabel('h', f.midX, f.y1 + 6, H(p, s.base), {
                cls: 'lab-big lab-mid lab-gold', d: 3, pre: 'H = ', suf: ' ' + unit(s), dur: 220,
              }),
              label('note', f.midX, f.y1 + 28, 'outline height = contribution to the total', { cls: 'lab-sm lab-mid' }),
            ];
          },
        },
        {
          label: 'the two extremes',
          hold: 1800,
          note: 'Flat means maximum uncertainty: every question you could ask is still open. A single certainty means zero — there is nothing left to learn.',
          scene: s => {
            const f = F();
            f.setX(0, 1); f.setY(0, 1.08);
            const p = +s.coin;
            const h2 = p <= 0 || p >= 1 ? 0 : -(p * log2(p) + (1 - p) * log2(1 - p));
            return [
              ...axes(f, { xLabel: 'probability of heads', yLabel: 'entropy of one coin flip (bits)', yN: 4 }),
              fnPath(f, x => (x <= 0 || x >= 1 ? 0 : -(x * log2(x) + (1 - x) * log2(1 - x))), { key: 'c', cls: 'curve curve-gold', n: 300 }),
              vLine(f, 0.5, { key: 'h', cls: 'rule-faint rule-dash' }),
              { key: 'pt', tag: 'circle', cls: 'pt pt-gold', dur: 180, attrs: { cx: f.sx(p), cy: f.sy(h2), r: 8 } },
              label('l1', f.sx(0.5), f.y1 + 12, 'a fair coin — 1 full bit', { cls: 'lab lab-mid lab-gold' }),
              label('l2', f.sx(0.02), f.y0 - 14, 'a rigged coin tells you almost nothing', { cls: 'lab-sm' }),
              // beside the dot, not above it: at p = ½ the dot is at the peak and
              // the reading landed on top of the caption there
              numLabel('v', f.sx(p) + (p > 0.6 ? -14 : 14), f.sy(h2) + 5, h2, {
                cls: 'lab-big lab-gold' + (p > 0.6 ? ' lab-end' : ''), d: 3, suf: ' bits', dur: 180,
              }),
            ];
          },
        },
      ],
    },

    {
      title: 'a bit is a yes/no question',
      prose: `<p>The unit is not a metaphor. <strong>One bit is one well-chosen yes/no question.</strong></p>
        <p>Four equally likely outcomes take exactly two questions — "is it A or B?", then one more — and the entropy is exactly 2 bits. That is not a coincidence; it is what the formula measures.</p>
        <p>When the outcomes are <em>not</em> equally likely you can do better than log₂(4) by asking about the common cases first. The entropy is the average number of questions the best possible strategy needs, and no scheme can beat it. That is Shannon's source coding theorem, and it is why compression has a hard floor.</p>`,
      formula: formula(
        t('H', { tone: 'gold' }) + ' ≤ average questions < ' + t('H', { tone: 'gold' }) + ' + 1' +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('no encoding can do better than H', { cls: 'fx-muted' }),
        { size: 'sm', caption: 'entropy is a floor on how short a message can be' }),
      readouts: [
        { key: 'h', label: 'entropy', tone: 'gold', get: s => H(P(s), 2), d: 3, suf: ' bits', wide: true },
        { key: 'flat', label: 'if you ignored the odds', tone: 'cold', get: () => 2, d: 3, suf: ' bits', wide: true },
        { key: 'save', label: 'you could save', tone: 'green', get: s => 2 - H(P(s), 2), d: 3, suf: ' bits', wide: true },
      ],
      controls: [
        ...range(4).map(i => ({ type: 'slider', key: 'p' + i, label: LABELS[i], min: 0, max: 100, step: 1, fast: true })),
      ],
      beats: [
        {
          label: 'the question tree',
          note: 'Give the common outcomes short codes and the rare ones long codes. The average code length can never drop below the entropy.',
          scene: s => {
            const p = P(s);
            const order = p.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
            const codes = ['0', '10', '110', '111'];
            const items = [
              label('t', 360, 60, 'a code for each outcome, shortest for the commonest', { cls: 'lab-big lab-mid' }),
              label('h1', 120, 120, 'outcome', { cls: 'lab-sm lab-gold' }),
              label('h2', 280, 120, 'probability', { cls: 'lab-sm lab-mid lab-gold' }),
              label('h3', 430, 120, 'code', { cls: 'lab-sm lab-mid lab-gold' }),
              label('h4', 610, 120, 'length', { cls: 'lab-sm lab-end lab-gold' }),
            ];
            let avg = 0;
            order.forEach(([v, idx], k) => {
              const y = 175 + k * 62;
              avg += v * codes[k].length;
              items.push(rect(`bg-${k}`, 90, y - 24, 540, 52, { cls: 'cell', delay: k * 120, opacity: 0.8 }));
              items.push(label(`n-${k}`, 120, y, LABELS[idx], { cls: `lab-big lab-${['cyan', 'purple', 'warm', 'cold'][idx]}`, delay: k * 120 }));
              items.push(label(`p-${k}`, 280, y, v.toFixed(3), { cls: 'lab lab-mid', delay: k * 120, dur: 220 }));
              items.push(label(`c-${k}`, 430, y, codes[k], { cls: 'lab-big lab-mid lab-green', delay: k * 120 }));
              items.push(label(`l-${k}`, 610, y, String(codes[k].length), { cls: 'lab lab-end', delay: k * 120 }));
            });
            items.push(label('avg', 360, 452,
              `average code length = ${avg.toFixed(3)} bits`, { cls: 'lab-big lab-mid lab-green', dur: 220 }));
            items.push(label('h', 360, 478,
              `entropy = ${H(p, 2).toFixed(3)} bits — the floor`, { cls: 'lab lab-mid lab-gold', dur: 220 }));
            return items;
          },
        },
      ],
    },

    {
      title: 'where entropy is already hiding on this site',
      prose: `<p>You have been using this quantity for several lessons without it being named.</p>
        <p><strong>Log-likelihood is negative entropy.</strong> Maximising the likelihood of a model is the same act as minimising the surprise it assigns to the data you actually saw.</p>
        <p><strong>Deviance is cross-entropy.</strong> The number that IRLS drives downward in the GLM lesson is measuring how surprised your model is by reality — the same quantity a neural network calls its loss.</p>
        <p><strong>Trees split on entropy.</strong> A decision tree picks the question that removes the most uncertainty about the outcome, which is precisely a drop in H.</p>`,
      formula: formula(
        t('cross-entropy', { tone: 'warm' }) + eq + minus +
        sumOver(t('y', { tone: 'green' }) + ' log ' + t('p̂', { tone: 'gold' }) + ' + ' + paren('1−y') + ' log' + paren('1−p̂'), { from: 'i', to: '' }) +
        `<br>` + t('which is exactly the binomial deviance from the GLM lesson', { cls: 'fx-muted' }),
        { size: 'sm', caption: 'one quantity, four names, depending on who is talking' }),
      dep: { note: 'The deviance being minimised by IRLS is this number.', lesson: 'glm', label: 'the glm idea' },
      readouts: [
        { key: 'p', label: 'model says', tone: 'gold', get: s => +s.coin, d: 3 },
        { key: 'l1', label: 'loss if truth is 1', tone: 'green', get: s => -Math.log(Math.max(1e-9, +s.coin)), d: 3, wide: true },
        { key: 'l0', label: 'loss if truth is 0', tone: 'warm', get: s => -Math.log(Math.max(1e-9, 1 - +s.coin)), d: 3, wide: true },
      ],
      controls: [
        { type: 'slider', key: 'coin', label: 'the probability your model predicted', min: 0.005, max: 0.995, step: 0.005, fast: true, fmt: v => (+v).toFixed(3) },
      ],
      beats: [
        {
          label: 'the loss of being confidently wrong',
          note: 'Being confident and right costs almost nothing. Being confident and <b>wrong</b> costs unboundedly much — which is exactly the incentive you want a model to face.',
          scene: s => {
            const f = F();
            f.setX(0, 1); f.setY(0, 5);
            const p = +s.coin;
            return [
              ...axes(f, { xLabel: 'probability your model assigned to the truth', yLabel: 'loss (nats)', yN: 5 }),
              fnPath(f, x => Math.min(5, -Math.log(Math.max(1e-9, x))), { key: 'c', cls: 'curve curve-warm', n: 300, from: 0.006 }),
              { key: 'p1', tag: 'circle', cls: 'pt pt-green', dur: 180, attrs: { cx: f.sx(p), cy: f.sy(Math.min(5, -Math.log(p))), r: 8 } },
              { key: 'p0', tag: 'circle', cls: 'pt pt-warm', dur: 180, attrs: { cx: f.sx(1 - p), cy: f.sy(Math.min(5, -Math.log(1 - p))), r: 8 } },
              label('l1', f.sx(p) + 12, f.sy(Math.min(5, -Math.log(p))) - 10, 'if the truth was 1', { cls: 'lab-sm lab-green', dur: 180 }),
              // one above, one below — at p = ½ both points are the same point
              label('l0', f.sx(1 - p) + 12, f.sy(Math.min(5, -Math.log(1 - p))) + 20, 'if the truth was 0', { cls: 'lab-sm lab-warm', dur: 180 }),
              label('n', f.midX, f.y1 + 10, 'this curve is the log-loss, the deviance, and the cross-entropy', { cls: 'lab lab-mid lab-gold' }),
            ];
          },
        },
      ],
    },
  ],
};
