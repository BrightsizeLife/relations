# show your work

Interactive, step-by-step drawings of how statistics are actually calculated.
Scrollytelling lessons where every number is computed live in the browser from
the data on screen — drag a point and the p-value moves.

Part of [Cheap Sensationalism](https://cheapsensationalism.com).

## Running it

There is no build step. It is ES modules and static files.

```bash
python3 -m http.server 8000   # or any static server
open http://localhost:8000
```

Vercel serves it as-is — no framework, no install, no output directory.

## How it is put together

```
index.html            shell: masthead, tab bar, mount point
assets/
  colors_and_type.css the Cheap Sensationalism token system (canonical copy)
  app.css             chrome for this piece
js/
  app.js              hash router
  registry.js         every lesson: order, dependencies, status, lazy loader
  map.js              the dependency map + index views
  core/
    stats.js          all the maths — nothing on this site is hardcoded
    dom.js            element helpers, tween engine, keyed SVG scene renderer
    plot.js           frames, scales, axes, reusable marks
    fx.js             formulas as hoverable HTML
    theme.js          light / dark / high contrast, resolved before first paint
    stage.js          the lesson runner: scroll, steps, beats, controls
  lessons/*.js        one file per lesson
tools/                checks — not shipped, not imported by the site
  smoke.mjs           every lesson, every beat, looking for errors
  overlap.mjs         labels that sit on top of each other
  axe.mjs             axe-core in all three themes
```

### The scene renderer

A lesson step does not draw. It **declares** what should exist right now as a
list of keyed items, and `makeScene()` diffs that against what is on screen and
tweens the difference. A point that exists in step 4 and step 5 slides between
them for free. This is why every lesson gets continuity animation without a
single hand-written transition.

```js
{ key: 'p-3', tag: 'circle', cls: 'pt link-devx',
  attrs: { cx, cy, r }, tip: 'hover text', enter: { attrs: { r: 0 } } }
```

### Adding a lesson

1. Write `js/lessons/<id>.js` exporting a default object with `meta`, `state`
   and `steps`. Each step has `prose`, optionally a `formula`, `readouts`,
   `controls`, and a list of `beats` — the replayable micro-steps.
2. Add an entry to `LESSONS` in `js/registry.js` with its `deps`, which is what
   draws the dependency map and the "builds on / feeds" chips.

A step's `scene(state, ctx)` returns scene items. `ctx.refresh()` re-renders
after you mutate `state` — that is how dragging a point updates everything.

### Conventions

- **Every number is computed at runtime** from the data shown. If a figure
  cannot be derived from what is on screen, it does not belong on the page.
- **Real data is named and sourced** in `meta.dataNote`. Simulated data is
  labelled as simulated, with a reason for why simulation is the right tool.
- **Formula terms link to the drawing.** A term with `link: 'devx'` highlights
  every scene item carrying the class `link-devx` on hover.
- Design tokens come from `colors_and_type.css`. Do not add raw hex values —
  in CSS or in JS. A colour that does not come from a token will not follow the
  theme, and there are three of them.
- **Colour is never the only channel.** See below.

## Checking it

Three scripts, none of them part of the site — the page itself still has no
dependencies. Each needs playwright and a chromium (`npm i playwright axe-core
&& npx playwright install chromium`); set `CHROMIUM_PATH` if yours is somewhere
non-standard.

```bash
node tools/smoke.mjs      # load every lesson, click every beat, report JS errors
node tools/overlap.mjs    # any two labels in a drawing that touch
node tools/axe.mjs        # axe-core, in all three themes
```

`smoke.mjs` also prints how many marks each scene drew: a lesson at zero is
broken even when nothing threw, which is exactly how a missing import once hid
for a whole afternoon.

## Colour, and why it is not the whole story

The chart layer is six tokens, `--sc-0` through `--sc-5`, one per role:

| token | role |
|---|---|
| `--sc-0` | raw data, nothing claimed about it yet |
| `--sc-1` | series A · above · positive · the highlighted thing |
| `--sc-2` | series B · below · negative · the comparison |
| `--sc-3` | the horizontal component — x, the predictor |
| `--sc-4` | the vertical component — y, the outcome |
| `--sc-5` | the model: fits, predictions, "this one is right" |

These are not the `--cs-data-*` signal colours, which mean temperature and are
left alone. They were chosen by search rather than by eye: maximise the
worst-case CIE-Lab distance between any two roles that share a picture, across
normal vision, protanopia, deuteranopia and tritanopia, subject to clearing the
theme's contrast floor. The worst co-occurring pair scores 35. The red/blue pair
they replaced scored about 20 under deuteranopia and 1.5 in greyscale.

The search also proves something a better palette cannot fix. Forcing every
series to clear the same contrast floor against a single background pushes their
luminances together, so in greyscale — print, a bad projector, a phone in
sunlight — some pairs collapse to under two Lab units. **So colour is never the
only channel.** Every pair that shares a picture also differs in dash pattern,
fill or stroke weight; the signatures are listed at the top of the scene block
in `app.css`.

## Themes

Three: `light`, `dark` (the default and the brand), and `hc` (high contrast,
7:1 minimum, heavier rules). The choice is resolved in script and stamped on
`<html>` as `data-theme`, with a small inline copy of that logic in `<head>` so
a light-mode reader does not get a flash of dark first. Nothing in the CSS is
duplicated inside a media query. With no stored choice, `prefers-contrast: more`
selects high contrast; otherwise dark.

## Accessibility

Audited with axe-core in all three themes, plus two checks axe cannot do:

- `tools/overlap.mjs` walks every step and every beat of every lesson and
  reports any two pieces of text in the drawing whose boxes actually intersect.
  The target is zero, and it is currently met.
- The palette search above, which is a contrast-and-CVD check on the marks
  rather than on the text.

Things worth knowing if you are editing:

- `caps()` in `dom.js` does the uppercasing for axis and readout labels, not
  `text-transform`. CSS uppercasing turns λ into Λ and σ into Σ, which on this
  site is a different formula rather than a different style.
- `--cs-dim` is for rules and decoration. Text uses `--cs-faint`, which clears
  4.5:1.
- Every animation goes through `tween()` in `dom.js`, so honouring
  `prefers-reduced-motion` is one branch there. Under it, a step lands on its
  finished picture instead of playing to it.
- Touch targets are 24px even where the mark drawn inside them is 4px.

## Data used

| Lesson | Source |
|---|---|
| correlation, linear regression | `faithful` — Old Faithful eruptions (Azzalini & Bowman 1990), as shipped with R |
| t-tests | Cushny & Peebles' soporific trial — the data behind Student's 1908 paper |
| one-way anova | `PlantGrowth` |
| chi-square | Titanic survival by class; Mendel's 1866 pea counts |
| glm, logistic | Challenger O-ring record (Dalal, Fowlkes & Hoadley, *JASA* 1989) |
| poisson | von Bortkiewicz's 1898 Prussian horse-kick deaths |
| multiple regression | `mtcars` — 1974 *Motor Trend* road tests |
| rstanarm & brms | the same Old Faithful regression, refitted by sampling |
| splines, negative binomial, clt, bayes, mcmc, causal, trees, forests, nets | simulated in-browser from a fixed seed, labelled as such |

Simulation is used where the lesson needs a **knowable truth** — you cannot show
that a causal estimator recovers the right answer without knowing both potential
outcomes, or that a model is overfitting without knowing the true curve. Every
simulated dataset says so in its `dataNote`, with the reason.

## Keyboard

`←` `→` step through the animation · `r` replays the current step · `tab`
reaches every control, and the first stop is a skip link past the tab bar.
