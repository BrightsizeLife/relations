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
    stage.js          the lesson runner: scroll, steps, beats, controls
  lessons/*.js        one file per lesson
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
- Design tokens come from `colors_and_type.css`. Do not add raw hex values.

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
| splines, negative binomial, clt, bayes, mcmc | simulated in-browser from a fixed seed, labelled as such |

## Keyboard

`←` `→` step through the animation · `r` replays the current step
