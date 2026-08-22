/* ─────────────────────────────────────────────────────────────────────────────
   knobs.js — a consistent way to show a model's tunable parameters: what each
   one controls, what it is set to right now, and what breaks at each extreme.

   Used by every lesson where the model has hyperparameters rather than
   estimated coefficients — trees, forests, nets, samplers.
   ───────────────────────────────────────────────────────────────────────────── */

import { label, rect, path } from './plot.js';

/** crude but reliable monospace wrapping — we know the font is fixed-width */
export function wrap(text, chars) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur.length) { cur = w; continue; }
    if ((cur + ' ' + w).length > chars) { lines.push(cur); cur = w; }
    else cur += ' ' + w;
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Render a stack of parameter cards as scene items.
 *
 * rows: [{ name, value, does, low, high, tone }]
 *   name  — what it is called in the software
 *   value — its current setting, as a string
 *   does  — one sentence on what it controls
 *   low   — what goes wrong if you turn it down
 *   high  — what goes wrong if you turn it up
 */
export function knobCards(rows, {
  x0 = 34, x1 = 686, y0 = 76, rowH = 104, key = 'k', wrapAt = 74,
} = {}) {
  const items = [];
  rows.forEach((r, i) => {
    const y = y0 + i * rowH;
    const tone = r.tone || ['cyan', 'warm', 'green', 'purple', 'gold'][i % 5];
    items.push(rect(`${key}-bg-${i}`, x0, y, x1 - x0, rowH - 12, {
      cls: 'cell', delay: i * 90, opacity: 0.9,
    }));
    items.push(rect(`${key}-bar-${i}`, x0, y, 3, rowH - 12, {
      cls: `sq sq-${tone === 'warm' ? 'pos' : tone === 'cold' ? 'neg' : 'x'}`, delay: i * 90,
    }));
    items.push(label(`${key}-n-${i}`, x0 + 16, y + 22, r.name, {
      cls: `lab-big lab-${tone}`, delay: i * 90,
    }));
    if (r.value != null) {
      items.push(label(`${key}-v-${i}`, x1 - 16, y + 22, String(r.value), {
        cls: `lab-big lab-end lab-${tone}`, delay: i * 90, dur: 200,
      }));
    }
    wrap(r.does, wrapAt).forEach((ln, k) => {
      items.push(label(`${key}-d-${i}-${k}`, x0 + 16, y + 42 + k * 15, ln, {
        cls: 'lab-sm', delay: i * 90,
      }));
    });
    const base = y + 42 + wrap(r.does, wrapAt).length * 15 + 6;
    if (r.low) items.push(label(`${key}-lo-${i}`, x0 + 16, base + 8, '↓ ' + r.low, {
      cls: 'lab-sm lab-cold', delay: i * 90,
    }));
    if (r.high) items.push(label(`${key}-hi-${i}`, x0 + 340, base + 8, '↑ ' + r.high, {
      cls: 'lab-sm lab-warm', delay: i * 90,
    }));
  });
  return items;
}

/**
 * A compact diagnostic strip: name, value, and a pass/warn verdict.
 * rows: [{ name, value, ok, target, why }]
 */
export function diagRows(rows, { x0 = 40, x1 = 680, y0 = 110, rowH = 62, key = 'd' } = {}) {
  const items = [
    label(`${key}-h1`, x0 + 14, y0 - 14, 'diagnostic', { cls: 'lab-sm lab-gold' }),
    label(`${key}-h2`, x0 + 250, y0 - 14, 'value', { cls: 'lab-sm lab-mid lab-gold' }),
    label(`${key}-h3`, x0 + 360, y0 - 14, 'should be', { cls: 'lab-sm lab-gold' }),
    label(`${key}-h4`, x1 - 14, y0 - 14, 'verdict', { cls: 'lab-sm lab-end lab-gold' }),
  ];
  rows.forEach((r, i) => {
    const y = y0 + i * rowH;
    items.push(rect(`${key}-bg-${i}`, x0, y, x1 - x0, rowH - 10, {
      cls: `sq ${r.ok ? 'sq-pos' : 'sq-neg'}`, opacity: 0.35, delay: i * 90, dur: 220,
    }));
    items.push(label(`${key}-n-${i}`, x0 + 14, y + 24, r.name, { cls: 'lab', delay: i * 90 }));
    items.push(label(`${key}-v-${i}`, x0 + 250, y + 24, r.value, {
      cls: `lab-big lab-mid lab-${r.ok ? 'green' : 'warm'}`, delay: i * 90, dur: 220,
    }));
    items.push(label(`${key}-t-${i}`, x0 + 360, y + 24, r.target, { cls: 'lab-sm', delay: i * 90 }));
    items.push(label(`${key}-o-${i}`, x1 - 14, y + 24, r.ok ? 'ok' : 'PROBLEM', {
      cls: `lab lab-end lab-${r.ok ? 'green' : 'warm'}`, delay: i * 90, dur: 220,
    }));
    if (r.why) items.push(label(`${key}-w-${i}`, x0 + 14, y + 42, r.why, {
      cls: 'lab-sm lab-muted', delay: i * 90,
    }));
  });
  return items;
}
