/* ─────────────────────────────────────────────────────────────────────────────
   registry.js — the single source of truth for what exists, what it depends on,
   and whether it's finished. The tab bar, the dependency map and the router all
   read from here. Status is honest: 'live' means every step is built.
   ───────────────────────────────────────────────────────────────────────────── */

export const LESSONS = [
  {
    id: 'correlation', title: 'correlation', kicker: 'PEARSON r',
    group: 'core', status: 'live', deps: [],
    blurb: 'Two columns in, one number out. Means, deviations, squares and a sum of products — the four moves everything else reuses.',
    load: () => import('./lessons/correlation.js'),
  },
  {
    id: 'settheory', title: 'set theory & probability', short: 'set theory', kicker: 'FOUNDATION',
    group: 'foundations', status: 'live', deps: [],
    blurb: 'A hundred outcomes you can count. Probability is measuring a subset; conditioning is shrinking the universe and counting again.',
    load: () => import('./lessons/settheory.js'),
  },
  {
    id: 'entropy', title: 'entropy & information', short: 'entropy', kicker: 'BITS',
    group: 'foundations', status: 'live', deps: ['settheory'],
    blurb: 'Surprise, averaged. The splitting rule in a tree, the loss in a classifier, and the deviance in every GLM here are all this one quantity.',
    load: () => import('./lessons/entropy.js'),
  },
  {
    id: 'mutualinfo', title: 'mutual information', kicker: 'SHARED BITS',
    group: 'foundations', status: 'live', deps: ['entropy'],
    blurb: 'How many bits knowing one thing saves you when guessing another. Catches relationships correlation is structurally blind to.',
    load: () => import('./lessons/mutualinfo.js'),
  },
  {
    id: 'ttest', title: 't-tests', kicker: 'DIFFERENCE OF MEANS',
    group: 'tests', status: 'live', deps: ['correlation'],
    blurb: 'One difference, divided by how much difference you would expect from noise. Includes the Welch correction for unequal variances.',
    load: () => import('./lessons/ttest.js'),
  },
  {
    id: 'anova', title: 'one-way anova', kicker: 'VARIANCE, SPLIT',
    group: 'tests', status: 'live', deps: ['ttest'],
    blurb: 'Three or more groups. Chop the total spread into "between groups" and "within groups" and take the ratio.',
    load: () => import('./lessons/anova.js'),
  },
  {
    id: 'linreg', title: 'linear regression', kicker: 'THE LINE',
    group: 'models', status: 'live', deps: ['correlation'],
    blurb: 'The same sums as correlation, asked a different question: not how tightly, but how much y moves per unit of x.',
    load: () => import('./lessons/linreg.js'),
  },
  {
    id: 'chisq', title: 'chi-square', kicker: 'COUNTS, NOT MEASURES',
    group: 'tests', status: 'live', deps: ['settheory'],
    blurb: 'What you saw versus what independence predicts. Squared gaps, scaled by how big a gap you should expect.',
    load: () => import('./lessons/chisq.js'),
  },
  {
    id: 'glm', title: 'the glm idea', kicker: 'ONE ENGINE, MANY MODELS',
    group: 'models', status: 'live', deps: ['linreg'],
    blurb: 'Link function, variance function, weighted least squares on repeat. Logistic and Poisson are the same machine with two dials moved.',
    load: () => import('./lessons/glm.js'),
  },
  {
    id: 'logistic', title: 'logistic regression', kicker: 'PROBABILITY, BENT',
    group: 'models', status: 'live', deps: ['linreg', 'glm'],
    blurb: 'A straight line, squashed through the logistic curve so it can never promise a probability above 1 or below 0.',
    load: () => import('./lessons/logistic.js'),
  },
  {
    id: 'poisson', title: 'poisson regression', kicker: 'COUNTING THINGS',
    group: 'models', status: 'live', deps: ['glm'],
    blurb: 'Counts are not measurements. The log link keeps predictions positive; the variance is forced to equal the mean.',
    load: () => import('./lessons/poisson.js'),
  },
  {
    id: 'negbin', title: 'negative binomial', kicker: 'WHEN POISSON LIES',
    group: 'models', status: 'live', deps: ['poisson'],
    blurb: 'Real counts are lumpier than Poisson allows. Add one dispersion parameter and the standard errors stop lying to you.',
    load: () => import('./lessons/negbin.js'),
  },
  {
    id: 'multiple', title: 'multiple regression', kicker: 'HOLDING THINGS CONSTANT',
    group: 'models', status: 'live', deps: ['linreg', 'matrix'],
    blurb: 'What "controlling for" actually does to your data — shown by doing it the long way, with residuals.',
    load: () => import('./lessons/multiple.js'),
  },
  {
    id: 'splines', title: 'splines', kicker: 'BENDING THE LINE',
    group: 'models', status: 'live', deps: ['multiple'],
    blurb: 'Straight lines that agree to meet at knots. Still ordinary regression — the curve is hiding in the columns.',
    load: () => import('./lessons/splines.js'),
  },
  {
    id: 'clt', title: 'normal distributions & the clt', short: 'normal & the clt', kicker: 'WHY BELLS APPEAR',
    group: 'core', status: 'live', deps: [],
    blurb: 'The central limit theorem is not a claim about your data. It is a claim about averages — and it is stranger than it sounds.',
    load: () => import('./lessons/clt.js'),
  },
  {
    id: 'bayes', title: 'bayesian basics', kicker: 'UPDATING',
    group: 'inference', status: 'live', deps: ['settheory'],
    blurb: 'Prior, likelihood, posterior. Watch a belief get dragged around by evidence, one observation at a time.',
    load: () => import('./lessons/bayes.js'),
  },
  {
    id: 'mcmc', title: 'markov chains & mcmc', kicker: 'RANDOM WALKS THAT LEARN',
    group: 'inference', status: 'live', deps: ['bayes'],
    blurb: 'When you cannot do the integral, take a walk. Metropolis, drawn one proposal at a time — including the rejected ones.',
    load: () => import('./lessons/mcmc.js'),
  },
  {
    id: 'stan', title: 'rstanarm & brms', kicker: 'ARGUMENTS & WARNINGS',
    group: 'inference', status: 'live', deps: ['mcmc', 'linreg'],
    blurb: 'Which arguments change the answer, and what each red warning is measuring. R-hat, ESS, divergences and posterior predictive checks, live.',
    load: () => import('./lessons/stan.js'),
  },
  {
    id: 'causal', title: 'causal estimands', kicker: 'WHOSE EFFECT?',
    group: 'inference', status: 'live', deps: ['multiple', 'logistic'],
    blurb: 'ATE, ATT, ATU, CATE — and the four ways to compute them, checked against a simulated world where both counterfactuals are known.',
    load: () => import('./lessons/causal.js'),
  },
  {
    id: 'decisiontree', title: 'decision trees', kicker: 'TWENTY QUESTIONS',
    group: 'models', status: 'live', deps: ['entropy'],
    blurb: 'Greedy yes/no questions, chosen by how much uncertainty each removes. Information theory, applied literally.',
    load: () => import('./lessons/decisiontree.js'),
  },
  {
    id: 'randomforest', title: 'random forests', kicker: 'AVERAGING UNSTABLE THINGS',
    group: 'models', status: 'live', deps: ['decisiontree'],
    blurb: 'One tree is high-variance. Grow hundreds of deliberately different ones, average them, and the noise cancels while the signal survives.',
    load: () => import('./lessons/randomforest.js'),
  },
  {
    id: 'neuralnet', title: 'neural networks', kicker: 'LOGISTIC, STACKED',
    group: 'models', status: 'live', deps: ['logistic', 'derivatives'],
    blurb: 'No new mathematics: logistic regression feeding into logistic regression, fitted by rolling downhill with the chain rule.',
    load: () => import('./lessons/neuralnet.js'),
  },
  {
    id: 'algebra', title: 'algebra & inverses', kicker: 'FOUNDATION',
    group: 'foundations', status: 'live', deps: [],
    blurb: 'Solving is undoing, in reverse order. The idea behind every link function and every transformation on this site.',
    load: () => import('./lessons/algebra.js'),
  },
  {
    id: 'matrix', title: 'matrix algebra', kicker: 'FOUNDATION',
    group: 'foundations', status: 'live', deps: ['algebra'],
    blurb: 'A matrix is a machine that moves space. Determinant is area, inverse is undo, and regression is one matrix equation.',
    load: () => import('./lessons/matrix.js'),
  },
  {
    id: 'limits', title: 'limits', kicker: 'FOUNDATION',
    group: 'foundations', status: 'live', deps: [],
    blurb: 'Where a function is heading, whether or not it ever gets there. The step everything in calculus stands on.',
    load: () => import('./lessons/limits.js'),
  },
  {
    id: 'derivatives', title: 'derivatives', kicker: 'FOUNDATION',
    group: 'foundations', status: 'live', deps: ['limits'],
    blurb: 'A secant line, squeezed. Slope at an instant — which is how every model on this site finds its best fit.',
    load: () => import('./lessons/derivatives.js'),
  },
  {
    id: 'integrals', title: 'integrals', kicker: 'FOUNDATION',
    group: 'foundations', status: 'live', deps: ['limits', 'derivatives'],
    blurb: 'Slice, multiply, add, shrink the slices. Every p-value on this site is an integral you did not have to do by hand.',
    load: () => import('./lessons/integrals.js'),
  },
];

export const GROUPS = {
  foundations: { label: 'foundations', accent: 3 },
  core: { label: 'core ideas', accent: 0 },
  tests: { label: 'tests', accent: 1 },
  models: { label: 'models', accent: 4 },
  inference: { label: 'inference', accent: 2 },
};

export const byId = id => LESSONS.find(l => l.id === id);

/** everything that must come before `id`, transitively, in a sane order */
export function ancestry(id, seen = new Set()) {
  const l = byId(id);
  if (!l) return [];
  for (const d of l.deps) {
    if (seen.has(d)) continue;
    seen.add(d);
    ancestry(d, seen);
  }
  return [...seen];
}

/** everything that depends on `id`, transitively */
export function descendants(id) {
  const out = new Set();
  const walk = k => LESSONS.forEach(l => {
    if (l.deps.includes(k) && !out.has(l.id)) { out.add(l.id); walk(l.id); }
  });
  walk(id);
  return [...out];
}

/** longest path to a root — used to lay the map out in tiers */
export function depth(id, memo = new Map()) {
  if (memo.has(id)) return memo.get(id);
  const l = byId(id);
  const d = !l || !l.deps.length ? 0 : 1 + Math.max(...l.deps.map(x => depth(x, memo)));
  memo.set(id, d);
  return d;
}

/**
 * Not built. Listed openly rather than left as a silent gap, because the map is
 * supposed to tell you what you can learn here and what you cannot.
 */
export const PLANNED = [
  { title: 'mixed-effects models', after: 'multiple', note: 'partial pooling, random intercepts and slopes, and why shrinkage is not a compromise' },
  { title: 'survival analysis', after: 'glm', note: 'censoring, Kaplan–Meier, and the Cox partial likelihood' },
  { title: 'time series', after: 'linreg', note: 'autocorrelation, differencing, and why the CLT stops protecting you' },
  { title: 'principal components', after: 'matrix', note: 'eigenvectors as the directions the data actually varies in' },
  { title: 'directed acyclic graphs', after: 'causal', note: 'choosing what to control for, and how adjusting can create bias' },
  { title: 'measurement & reliability', after: 'correlation', note: 'attenuation, Cronbach\'s alpha, and what a scale score is' },
  { title: 'power analysis', after: 'ttest', note: 'the fourth corner of the α / effect / n / power square' },
  { title: 'bootstrapping', after: 'clt', note: 'resampling your way to a standard error when no formula exists' },
  { title: 'gradient boosting', after: 'randomforest', note: 'fitting trees to the mistakes of the previous trees' },
  { title: 'regularisation', after: 'multiple', note: 'ridge, lasso, and trading a little bias for a lot of variance' },
];

export const STATUS = {
  live: { label: 'built', cls: 'live' },
  wip: { label: 'in progress', cls: 'wip' },
  planned: { label: 'not yet', cls: 'soon' },
};
