/* ─────────────────────────────────────────────────────────────────────────────
   fx.js — formulas as HTML, not images.

   Every piece of a formula is a real element, so it can be hovered for an
   explanation and wired to the drawing: hover "xᵢ − x̄" and the deviation
   sticks light up on the canvas. That link is the entire point of this file.
   ───────────────────────────────────────────────────────────────────────────── */

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * A hoverable term.
 * @param html    inner markup
 * @param explain plain-language gloss shown on hover
 * @param link    highlights canvas elements with class `link-<link>`
 * @param tone    warm | cold | gold | green | cyan | purple | muted
 */
export function t(html, { explain, link, tone, cls = '' } = {}) {
  const attrs = [
    `class="fx-t ${tone ? 'fx-' + tone : ''} ${cls}"`,
    explain ? `data-explain="${esc(explain)}"` : '',
    link ? `data-link="${esc(link)}"` : '',
    explain || link ? 'tabindex="0"' : '',
  ].filter(Boolean).join(' ');
  return `<span ${attrs}>${html}</span>`;
}

export const frac = (num, den, opts = {}) =>
  t(`<span class="fx-frac"><span class="fx-num">${num}</span><span class="fx-den">${den}</span></span>`, opts);

export const sqrt = (inner, opts = {}) =>
  t(`<span class="fx-sqrt"><span class="fx-radical">√</span><span class="fx-rad">${inner}</span></span>`, opts);

export const sub = (base, s) => `${base}<sub class="fx-sub">${s}</sub>`;
export const sup = (base, s) => `${base}<sup class="fx-sup">${s}</sup>`;
export const bar = v => `<span class="fx-overbar">${v}</span>`;
export const hat = v => `<span class="fx-hat">${v}</span>`;

export const sumOver = (body, { from = 'i=1', to = 'n', ...opts } = {}) =>
  t(`<span class="fx-bigop"><span class="fx-lim-top">${to}</span><span class="fx-op">∑</span><span class="fx-lim-bot">${from}</span></span>${body}`, opts);

export const prodOver = (body, { from = 'i=1', to = 'n', ...opts } = {}) =>
  t(`<span class="fx-bigop"><span class="fx-lim-top">${to}</span><span class="fx-op">∏</span><span class="fx-lim-bot">${from}</span></span>${body}`, opts);

export const intOver = (body, { from = 'a', to = 'b', ...opts } = {}) =>
  t(`<span class="fx-bigop fx-int"><span class="fx-lim-top">${to}</span><span class="fx-op">∫</span><span class="fx-lim-bot">${from}</span></span>${body}`, opts);

export const paren = (inner, opts = {}) =>
  t(`<span class="fx-paren">(</span>${inner}<span class="fx-paren">)</span>`, opts);

export const brack = (inner, opts = {}) =>
  t(`<span class="fx-paren">[</span>${inner}<span class="fx-paren">]</span>`, opts);

export const op = s => `<span class="fx-o">${s}</span>`;
export const eq = op('=');
export const minus = op('−');
export const plus = op('+');
export const times = op('·');
export const approx = op('≈');

/** wrap a complete display formula */
export function formula(html, { caption, size = 'md', id } = {}) {
  return `<div class="cs-fx cs-fx-${size}"${id ? ` data-fx="${id}"` : ''}>${html}` +
    (caption ? `<div class="cs-fx-cap">${caption}</div>` : '') + '</div>';
}

/** inline formula for use inside a sentence */
export const inline = html => `<span class="cs-fx cs-fx-inline">${html}</span>`;

/* ── prebuilt pieces reused across lessons ────────────────────────────────── */

export const X = { i: sub('x', 'i'), bar: bar('x'), dev: `${sub('x', 'i')} ${minus} ${bar('x')}` };
export const Y = { i: sub('y', 'i'), bar: bar('y'), dev: `${sub('y', 'i')} ${minus} ${bar('y')}` };

export const devX = (opts = {}) => t(`${sub('x', 'i')} ${minus} ${bar('x')}`, {
  explain: 'How far this point sits from the mean of x. Negative on the left, positive on the right.',
  link: 'devx', tone: 'cyan', ...opts,
});

export const devY = (opts = {}) => t(`${sub('y', 'i')} ${minus} ${bar('y')}`, {
  explain: 'How far this point sits from the mean of y. Negative below, positive above.',
  link: 'devy', tone: 'purple', ...opts,
});

export const nMinus1 = (opts = {}) => t('n ' + minus + ' 1', {
  explain: 'Degrees of freedom. You spent one piece of information estimating the mean, so only n−1 deviations are free to vary.',
  link: 'df', tone: 'gold', ...opts,
});
