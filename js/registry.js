/* ─────────────────────────────────────────────────────────────────────────────
   registry.js — the single source of truth for what exists, what it depends on,
   and whether it's finished. The tab bar, the dependency map and the router all
   read from here. Status is honest: 'live' means every step is built.
   ───────────────────────────────────────────────────────────────────────────── */

export const LESSONS = [
  {
    id: 'algebra', title: 'algebra & inverses', kicker: 'FOUNDATION',
    group: 'maths', sub: 'the basics', status: 'live', deps: [],
    blurb: 'Solving is undoing, in reverse order. The idea behind every link function and every transformation on this site.',
    load: () => import('./lessons/algebra.js'),
  },
  {
    id: 'limits', title: 'limits', kicker: 'FOUNDATION',
    group: 'maths', sub: 'calculus', status: 'live', deps: [],
    blurb: 'Where a function is heading, whether or not it ever gets there. The step everything in calculus stands on.',
    load: () => import('./lessons/limits.js'),
  },
  {
    id: 'derivatives', title: 'derivatives', kicker: 'FOUNDATION',
    group: 'maths', sub: 'calculus', status: 'live', deps: ['limits'],
    blurb: 'A secant line, squeezed. Slope at an instant — which is how every model on this site finds its best fit.',
    load: () => import('./lessons/derivatives.js'),
  },
  {
    id: 'integrals', title: 'integrals', kicker: 'FOUNDATION',
    group: 'maths', sub: 'calculus', status: 'live', deps: ['limits', 'derivatives'],
    blurb: 'Slice, multiply, add, shrink the slices. Every p-value on this site is an integral you did not have to do by hand.',
    load: () => import('./lessons/integrals.js'),
  },
  {
    id: 'matrix', title: 'matrix algebra', kicker: 'FOUNDATION',
    group: 'maths', sub: 'the basics', status: 'live', deps: ['algebra'],
    blurb: 'A matrix is a machine that moves space. Determinant is area, inverse is undo, and regression is one matrix equation.',
    load: () => import('./lessons/matrix.js'),
  },
  {
    id: 'settheory', title: 'set theory & probability', short: 'set theory', kicker: 'FOUNDATION',
    group: 'concepts', sub: 'how sure you can be', status: 'live', deps: [],
    blurb: 'A hundred outcomes you can count. Probability is measuring a subset; conditioning is shrinking the universe and counting again.',
    load: () => import('./lessons/settheory.js'),
  },
  {
    id: 'entropy', title: 'entropy & information', short: 'entropy', kicker: 'BITS',
    group: 'thinking', sub: 'information', status: 'live', deps: ['settheory'],
    blurb: 'Surprise, averaged. The splitting rule in a tree, the loss in a classifier, and the deviance in every GLM here are all this one quantity.',
    load: () => import('./lessons/entropy.js'),
  },
  {
    id: 'mutualinfo', title: 'mutual information', kicker: 'SHARED BITS',
    group: 'thinking', sub: 'information', status: 'live', deps: ['entropy'],
    blurb: 'How many bits knowing one thing saves you when guessing another. Catches relationships correlation is structurally blind to.',
    load: () => import('./lessons/mutualinfo.js'),
  },
  {
    id: 'computation', title: 'how computers do this', short: 'computation', kicker: 'THE MACHINE UNDERNEATH',
    group: 'thinking', sub: 'the machine underneath', status: 'live', deps: ['matrix', 'entropy'],
    blurb: 'Big-O, floating point, why statisticians live in log space, and what a seed actually is. The catastrophic cancellation is real and running.',
    load: () => import('./lessons/computation.js'),
  },
  {
    id: 'correlation', title: 'correlation', kicker: 'PEARSON r',
    group: 'concepts', sub: 'how things vary', status: 'live', deps: [],
    blurb: 'Two columns in, one number out. Means, deviations, squares and a sum of products — the four moves everything else reuses.',
    load: () => import('./lessons/correlation.js'),
  },
  {
    id: 'clt', title: 'normal distributions & the clt', short: 'normal & the clt', kicker: 'WHY BELLS APPEAR',
    group: 'concepts', sub: 'how sure you can be', status: 'live', deps: [],
    blurb: 'The central limit theorem is not a claim about your data. It is a claim about averages — and it is stranger than it sounds.',
    load: () => import('./lessons/clt.js'),
  },
  {
    id: 'measurement', title: 'measurement & reliability', short: 'measurement',
    kicker: 'BEFORE ANY OF THE REST OF IT',
    group: 'concepts', sub: 'what your numbers are', status: 'live', deps: ['correlation'],
    blurb: 'Every other lesson assumes the numbers are the thing. They are not. A score is truth plus error, and the share that is truth decides what your correlations are allowed to say.',
    load: () => import('./lessons/measurement.js'),
  },
  {
    id: 'ttest', title: 't-tests', kicker: 'DIFFERENCE OF MEANS',
    group: 'tools', sub: 'comparing groups', status: 'live', deps: ['correlation'],
    blurb: 'One difference, divided by how much difference you would expect from noise. Includes the Welch correction for unequal variances.',
    load: () => import('./lessons/ttest.js'),
  },
  {
    id: 'anova', title: 'one-way anova', kicker: 'VARIANCE, SPLIT',
    group: 'tools', sub: 'comparing groups', status: 'live', deps: ['ttest'],
    blurb: 'Three or more groups. Chop the total spread into "between groups" and "within groups" and take the ratio.',
    load: () => import('./lessons/anova.js'),
  },
  {
    id: 'chisq', title: 'chi-square', kicker: 'COUNTS, NOT MEASURES',
    group: 'tools', sub: 'comparing groups', status: 'live', deps: ['settheory'],
    blurb: 'What you saw versus what independence predicts. Squared gaps, scaled by how big a gap you should expect.',
    load: () => import('./lessons/chisq.js'),
  },
  {
    id: 'nonparametric', title: 'rank-based tests', short: 'rank tests', kicker: 'THROW THE NUMBERS AWAY',
    group: 'tools', sub: 'when the assumptions break', status: 'live', deps: ['ttest', 'correlation'],
    blurb: 'Sign test, Wilcoxon, Mann-Whitney, Kruskal-Wallis. Same four moves, run on the order instead of the values.',
    load: () => import('./lessons/nonparametric.js'),
  },
  {
    id: 'resampling', title: 'permutation & bootstrap', short: 'resampling', kicker: 'BUILD THE NULL BY HAND',
    group: 'tools', sub: 'when the assumptions break', status: 'live', deps: ['nonparametric', 'clt'],
    blurb: 'Shuffle the labels a few thousand times and watch what a world with no effect produces. Works for statistics nobody derived a formula for.',
    load: () => import('./lessons/resampling.js'),
  },
  {
    id: 'linreg', title: 'linear regression', kicker: 'THE LINE',
    group: 'tools', sub: 'fitting a line', status: 'live', deps: ['correlation'],
    blurb: 'The same sums as correlation, asked a different question: not how tightly, but how much y moves per unit of x.',
    load: () => import('./lessons/linreg.js'),
  },
  {
    id: 'multiple', title: 'multiple regression', kicker: 'HOLDING THINGS CONSTANT',
    group: 'tools', sub: 'fitting a line', status: 'live', deps: ['linreg', 'matrix'],
    blurb: 'What "controlling for" actually does to your data — shown by doing it the long way, with residuals.',
    load: () => import('./lessons/multiple.js'),
  },
  {
    id: 'splines', title: 'splines', kicker: 'BENDING THE LINE',
    group: 'tools', sub: 'fitting a line', status: 'live', deps: ['multiple'],
    blurb: 'Straight lines that agree to meet at knots. Still ordinary regression — the curve is hiding in the columns.',
    load: () => import('./lessons/splines.js'),
  },
  {
    id: 'glm', title: 'the glm idea', kicker: 'ONE ENGINE, MANY MODELS',
    group: 'tools', sub: 'when the outcome is not a measurement', status: 'live', deps: ['linreg'],
    blurb: 'Link function, variance function, weighted least squares on repeat. Logistic and Poisson are the same machine with two dials moved.',
    load: () => import('./lessons/glm.js'),
  },
  {
    id: 'logistic', title: 'logistic regression', kicker: 'PROBABILITY, BENT',
    group: 'tools', sub: 'when the outcome is not a measurement', status: 'live', deps: ['linreg', 'glm'],
    blurb: 'A straight line, squashed through the logistic curve so it can never promise a probability above 1 or below 0.',
    load: () => import('./lessons/logistic.js'),
  },
  {
    id: 'poisson', title: 'poisson regression', kicker: 'COUNTING THINGS',
    group: 'tools', sub: 'when the outcome is not a measurement', status: 'live', deps: ['glm'],
    blurb: 'Counts are not measurements. The log link keeps predictions positive; the variance is forced to equal the mean.',
    load: () => import('./lessons/poisson.js'),
  },
  {
    id: 'negbin', title: 'negative binomial', kicker: 'WHEN POISSON LIES',
    group: 'tools', sub: 'when the outcome is not a measurement', status: 'live', deps: ['poisson'],
    blurb: 'Real counts are lumpier than Poisson allows. Add one dispersion parameter and the standard errors stop lying to you.',
    load: () => import('./lessons/negbin.js'),
  },
  {
    id: 'factor', title: 'factor analysis', short: 'factor analysis',
    kicker: 'ONE CAUSE, SIX ANSWERS',
    group: 'tools', sub: 'no labels at all', status: 'live', deps: ['measurement', 'matrix'],
    blurb: 'Six questions that all agree, and the arithmetic that turns the agreement back into the thing causing it. Includes why rotation changes the answer without changing the fit.',
    load: () => import('./lessons/factor.js'),
  },
  {
    id: 'clustering', title: 'finding groups in data', short: 'clustering',
    kicker: 'NOBODY LABELLED THESE',
    group: 'tools', sub: 'no labels at all', status: 'live', deps: ['correlation', 'measurement'],
    blurb: 'k-means, hierarchical and dbscan on the same points, disagreeing for reasons you can watch. Ends by running all three on data with no groups in it.',
    load: () => import('./lessons/clustering.js'),
  },
  {
    id: 'decisiontree', title: 'decision trees', kicker: 'TWENTY QUESTIONS',
    group: 'tools', sub: 'learned from the data', status: 'live', deps: ['entropy'],
    blurb: 'Greedy yes/no questions, chosen by how much uncertainty each removes. Information theory, applied literally.',
    load: () => import('./lessons/decisiontree.js'),
  },
  {
    id: 'randomforest', title: 'random forests', kicker: 'AVERAGING UNSTABLE THINGS',
    group: 'tools', sub: 'learned from the data', status: 'live', deps: ['decisiontree'],
    blurb: 'One tree is high-variance. Grow hundreds of deliberately different ones, average them, and the noise cancels while the signal survives.',
    load: () => import('./lessons/randomforest.js'),
  },
  {
    id: 'neuralnet', title: 'neural networks', kicker: 'LOGISTIC, STACKED',
    group: 'tools', sub: 'learned from the data', status: 'live', deps: ['logistic', 'derivatives'],
    blurb: 'No new mathematics: logistic regression feeding into logistic regression, fitted by rolling downhill with the chain rule.',
    load: () => import('./lessons/neuralnet.js'),
  },
  {
    id: 'bayes', title: 'bayesian basics', kicker: 'UPDATING',
    group: 'concepts', sub: 'how sure you can be', status: 'live', deps: ['settheory'],
    blurb: 'Prior, likelihood, posterior. Watch a belief get dragged around by evidence, one observation at a time.',
    load: () => import('./lessons/bayes.js'),
  },
  {
    id: 'gradientdescent', title: 'gradient descent', short: 'gradient descent',
    kicker: 'ROLLING DOWNHILL',
    group: 'parameters', sub: 'finding the answer', status: 'live', deps: ['derivatives', 'linreg'],
    blurb: 'Measure the slope, step against it, look again. The engine inside every model here that has no formula — and one dial, η, that decides whether it works at all.',
    load: () => import('./lessons/gradientdescent.js'),
  },
  {
    id: 'activations', title: 'activation functions', short: 'activations',
    kicker: 'THE BEND',
    group: 'parameters', sub: 'model shape', status: 'live', deps: ['logistic', 'derivatives'],
    blurb: 'Stack a hundred linear layers and you have built one. The bend is the only component that stops that being true — shown as a number going in and a number coming out.',
    load: () => import('./lessons/activations.js'),
  },
  {
    id: 'mcmc', title: 'markov chains & mcmc', kicker: 'RANDOM WALKS THAT LEARN',
    group: 'parameters', sub: 'sampling', status: 'live', deps: ['bayes'],
    blurb: 'When you cannot do the integral, take a walk. Metropolis, drawn one proposal at a time — including the rejected ones.',
    load: () => import('./lessons/mcmc.js'),
  },
  {
    id: 'stan', title: 'rstanarm & brms', kicker: 'ARGUMENTS & WARNINGS',
    group: 'parameters', sub: 'sampling', status: 'live', deps: ['mcmc', 'linreg'],
    blurb: 'Which arguments change the answer, and what each red warning is measuring. R-hat, ESS, divergences and posterior predictive checks, live.',
    load: () => import('./lessons/stan.js'),
  },
  {
    id: 'processes', title: 'words for how things behave', short: 'process terms',
    kicker: 'VOCABULARY THAT ONLY MEANS SOMETHING IN MOTION',
    group: 'concepts', sub: 'how things behave over time', status: 'live', deps: ['clt', 'correlation'],
    blurb: 'Volatility, drawdown, liquidity, memory — terms that name a behaviour rather than a quantity, each defined by running it. Ends on a +5% game where the median player is ruined.',
    load: () => import('./lessons/processes.js'),
  },
  {
    id: 'causal', title: 'causal estimands', kicker: 'WHOSE EFFECT?',
    group: 'concepts', sub: 'what caused what', status: 'live', deps: ['multiple', 'logistic'],
    blurb: 'ATE, ATT, ATU, CATE — and the four ways to compute them, checked against a simulated world where both counterfactuals are known.',
    load: () => import('./lessons/causal.js'),
  },
  {
    id: 'decisiontheory', title: 'decision theory', kicker: 'FROM NUMBERS TO ACTIONS',
    group: 'thinking', sub: 'choosing under uncertainty', status: 'live', deps: ['bayes'],
    blurb: 'Expected value, utility, and the fact that reporting a mean is already a claim about what being wrong costs you.',
    load: () => import('./lessons/decisiontheory.js'),
  },
  {
    id: 'gametheory', title: 'game theory', kicker: 'WHEN THE WORLD ANSWERS BACK',
    group: 'thinking', sub: 'choosing under uncertainty', status: 'live', deps: ['decisiontheory'],
    blurb: 'Dominance, Nash equilibrium, and why an unpredictable mix is sometimes the only unexploitable move.',
    load: () => import('./lessons/gametheory.js'),
  },
];

export const GROUPS = {
  concepts: {
    label: 'concepts', accent: 0,
    blurb: 'The ideas everything else is built out of. Not techniques — ways of seeing what a number is and what it is allowed to claim.',
    subs: ['how things vary', 'what your numbers are', 'how things behave over time', 'how sure you can be', 'what caused what'],
  },
  maths: {
    label: 'maths', accent: 3,
    blurb: 'The machinery underneath. None of it is statistics yet, and all of it turns up the moment a formula stops being obvious.',
    subs: ['the basics', 'calculus'],
  },
  tools: {
    label: 'analytic tools', accent: 1,
    blurb: 'The things you actually run on data. Each one is the same handful of moves in a different arrangement.',
    subs: ['comparing groups', 'when the assumptions break', 'fitting a line',
      'when the outcome is not a measurement', 'learned from the data', 'no labels at all'],
  },
  parameters: {
    label: 'parameters', accent: 2,
    blurb: 'The dials. What each one changes, what breaks at either extreme, and how to read the warning when you have set it wrong.',
    subs: ['finding the answer', 'model shape', 'sampling'],
  },
  thinking: {
    label: 'thinking', accent: 4,
    blurb: 'Frameworks for reasoning rather than procedures for computing: information, decisions, opponents, and the machine doing the arithmetic.',
    subs: ['information', 'choosing under uncertainty', 'the machine underneath'],
  },
};

export const GROUP_ORDER = ['concepts', 'maths', 'tools', 'parameters', 'thinking'];

/**
 * Reading paths. The dependency map shows what is possible; these say what is
 * worth doing, in order, for a particular kind of reader.
 */
export const TRACKS = [
  {
    id: 'applied', label: 'the applied researcher', accent: 0,
    note: 'You have data and a question. This is the shortest route to answering it honestly.',
    ids: ['correlation', 'measurement', 'ttest', 'anova', 'linreg', 'multiple', 'causal', 'decisiontheory'],
  },
  {
    id: 'maths', label: 'the maths underneath', accent: 3,
    note: 'Where the formulas come from. Do this if you resent being told "it can be shown that".',
    ids: ['algebra', 'matrix', 'limits', 'derivatives', 'integrals', 'correlation'],
  },
  {
    id: 'bayes', label: 'going bayesian', accent: 2,
    note: 'From counting subsets to reading a Stan diagnostic without flinching.',
    ids: ['settheory', 'bayes', 'mcmc', 'stan'],
  },
  {
    id: 'ml', label: 'machine learning', accent: 4,
    note: 'Information theory first, because it is the splitting rule and the loss function both.',
    ids: ['entropy', 'decisiontree', 'randomforest', 'logistic', 'gradientdescent', 'activations', 'neuralnet', 'computation'],
  },
  {
    id: 'broken', label: 'when your assumptions break', accent: 1,
    note: 'Skewed data, wild values, counts that clump, and no formula in sight.',
    ids: ['clt', 'nonparametric', 'resampling', 'negbin', 'splines'],
  },
];

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
  { title: 'directed acyclic graphs', after: 'causal', note: 'choosing what to control for, and how adjusting can create bias' },
  { title: 'power analysis', after: 'ttest', note: 'the fourth corner of the α / effect / n / power square' },
  { title: 'gradient boosting', after: 'randomforest', note: 'fitting trees to the mistakes of the previous trees' },
  { title: 'regularisation', after: 'multiple', note: 'ridge, lasso, and trading a little bias for a lot of variance' },
  { title: 'missing data', after: 'multiple', note: 'MCAR, MAR, MNAR, and why deleting incomplete rows is a modelling choice' },
  { title: 'multiple comparisons', after: 'anova', note: 'Bonferroni, false discovery rate, and what "we ran forty tests" costs' },
  { title: 'power & study design', after: 'ttest', note: 'the fourth corner of the alpha / effect / n / power square, decided before you collect anything' },
  { title: "Simpson's paradox & aggregation", after: 'causal', note: 'the same data reversing its sign when you group it differently' },
  { title: 'sampling & weights', after: 'clt', note: 'how you got the data, and what survey weights are actually doing' },
  { title: 'meta-analysis', after: 'multiple', note: 'combining studies, and the difference between fixed and random effects' },
];

export const STATUS = {
  live: { label: 'built', cls: 'live' },
  wip: { label: 'in progress', cls: 'wip' },
  planned: { label: 'not yet', cls: 'soon' },
};
