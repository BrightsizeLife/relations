/* ─────────────────────────────────────────────────────────────────────────────
   terms.js — the glossary, and the machinery that applies it automatically.

   The rule this file enforces: no word appears on this site without somewhere
   to find out what it means. Rather than hand-annotating thirty-odd lessons,
   every step's prose is walked after it is rendered and the first occurrence of
   each known term is wrapped, so hovering works everywhere by default.

   `atom: true` marks the handful of ideas everything else is built out of.
   Those get a stronger underline, because if one of them has not landed the
   reader should stop and go and get it.
   ───────────────────────────────────────────────────────────────────────────── */

export const TERMS = {

  /* ── the atoms ── */
  mean: { atom: true, strict: true, def: 'The balance point of a set of numbers: add them up, divide by how many. Push one number out and the mean follows it.', see: 'correlation' },
  deviation: { atom: true, def: 'How far one observation sits from the middle. Signed: negative below, positive above. Almost everything on this site is built out of these.', see: 'correlation' },
  variance: { atom: true, def: 'The average squared deviation. Squaring turns a length into an area, which is why spread is measured in squared units.', see: 'correlation' },
  'standard deviation': { atom: true, def: 'The square root of the variance, which puts spread back into the original units. The side of the average square.', see: 'correlation' },
  probability: { atom: true, def: 'The size of a subset, measured against the whole space of things that could happen. Literally a count divided by a count when outcomes are equally likely.', see: 'settheory' },
  distribution: { atom: true, def: 'A description of which values are how likely. Not a set of data — a statement about what data would look like.', see: 'clt' },
  sample: { atom: true, strict: true, def: 'The observations you actually have, as opposed to the population you wish you had.', see: 'clt' },
  population: { def: 'Everything you would have measured if you could. Usually hypothetical, always unobserved.', see: 'clt' },

  /* ── spread and uncertainty ── */
  'standard error': { atom: true, def: 'How much a statistic would wobble if you ran the study again. Not how spread out the data is — how spread out the *estimate* is.', see: 'clt' },
  'sampling distribution': { def: 'The distribution of a statistic across hypothetical repeats of your study. The thing the central limit theorem is about.', see: 'clt' },
  'confidence interval': { def: 'A range built so that, across repeated studies, a stated share of such ranges would contain the true value. A claim about the procedure, not about this interval.', see: 'correlation' },
  'credible interval': { def: 'A range containing a stated share of the posterior probability. This one *is* a claim about the parameter.', see: 'bayes' },
  'degrees of freedom': { def: 'How many pieces of information were free to vary once you spent some estimating things. Usually n minus the number of parameters you fitted.', see: 'correlation' },
  bias: { strict: true, def: 'A systematic error — one that does not shrink as you collect more data. Distinct from noise, which does.', see: 'causal' },
  'p-value': { atom: true, def: 'How often a world with no effect would produce data at least this extreme. Not the probability the effect is real, and not the probability you are wrong.', see: 'correlation' },
  'null hypothesis': { def: 'The boring story you are trying to rule out — usually "no difference" or "no relationship".', see: 'ttest' },
  'effect size': { def: 'How big the thing is, in units someone can act on. Distinct from whether it is statistically detectable.', see: 'ttest' },
  power: { strict: true, def: 'The chance your study would detect an effect of a given size, if it is really there.' },

  /* ── relationships ── */
  correlation: { atom: true, def: 'How tightly two things move together on a straight line, on a scale from −1 to 1. Unit-free, so it can be compared across variables.', see: 'correlation' },
  covariance: { def: 'The average product of two deviations. Correlation before the units are divided out.', see: 'correlation' },
  'z-score': { def: 'A deviation measured in standard deviations. Puts any variable on a common ruler.', see: 'correlation' },
  residual: { atom: true, def: 'What the model got wrong for one observation: the actual value minus the fitted one.', see: 'linreg' },
  'sum of squares': { def: 'Add up the squared deviations. The raw material of variance, regression and ANOVA alike.', see: 'correlation' },
  'least squares': { def: 'Choose the line that makes the total squared residual as small as possible. The bottom of a bowl.', see: 'linreg' },
  slope: { def: 'How much the outcome moves per one-unit move in the predictor. A rate, with units.', see: 'linreg' },
  intercept: { def: 'What the model predicts when every predictor is zero — which is often a value nobody in your data has.', see: 'linreg' },
  confounder: { def: 'Something that drives both the treatment and the outcome, so the raw comparison mixes its effect in with the one you want.', see: 'causal' },

  /* ── model families ── */
  'link function': { def: 'The bend applied to a linear predictor so it lands in the right range — log for counts, logit for probabilities.', see: 'glm' },
  'odds ratio': { def: 'How much the odds multiply per one-unit change. Not a risk ratio, and the two diverge badly when outcomes are common.', see: 'logistic' },
  odds: { def: 'The ratio of a thing happening to it not happening. Runs from 0 to infinity, where probability is stuck between 0 and 1.', see: 'logistic' },
  deviance: { def: 'How badly a model fits, measured as twice the log-likelihood gap. The thing every GLM drives downward.', see: 'glm' },
  likelihood: { atom: true, def: 'How probable your data was, given a candidate set of parameter values. A score for each candidate, not a distribution over them.', see: 'bayes' },
  overdispersion: { def: 'More variability than the model allows. For counts it means the variance exceeds the mean, and the standard errors are too small.', see: 'negbin' },
  prior: { def: 'What you believed before seeing the data, written as a distribution.', see: 'bayes' },
  posterior: { atom: true, def: 'What you believe after seeing the data. Prior times likelihood, rescaled.', see: 'bayes' },

  /* ── learning ── */
  overfitting: { atom: true, def: 'Learning the noise in your training data. Looks like excellent performance right up until you test on anything new.', see: 'splines' },
  'cross-validation': { def: 'Hold data out, fit without it, score on it. The honest alternative to grading your own homework.', see: 'splines' },
  hyperparameter: { def: 'A setting you choose rather than estimate — a tree depth, a learning rate. It decides how much structure the model is allowed to invent.', see: 'decisiontree' },
  'gradient descent': { def: 'Find the slope, step against it, repeat. How every model without a closed-form answer gets fitted.', see: 'gradientdescent' },
  'loss function': { atom: true, def: 'What being wrong costs. Choosing one is choosing which single number is the right answer to report.', see: 'decisiontheory' },
  entropy: { def: 'How uncertain a distribution is, measured in bits — the average surprise you get from an outcome.', see: 'entropy' },
  'regularisation': { def: 'A penalty on model complexity, trading a little bias for a lot less variance.' },

  /* ── measurement ── */
  reliability: { atom: true, def: 'The share of the variance in your measure that is real signal rather than measurement noise. Between 0 and 1.', see: 'measurement' },
  validity: { atom: true, def: 'Whether the thing you measured is the thing you meant to measure. Entirely separate from reliability — a consistently wrong instrument is perfectly reliable.', see: 'measurement' },
  'true score': { def: 'The value a person would get averaged over infinitely many measurements. Unobservable by construction.', see: 'measurement' },
  attenuation: { def: 'The shrinking of an observed correlation caused by measurement error in either variable. Real relationships look weaker than they are.', see: 'measurement' },
  'measurement error': { def: 'The gap between what you recorded and the true value. Random error adds noise; systematic error adds bias.', see: 'measurement' },
  construct: { strict: true, def: 'The thing you actually care about — satisfaction, ability, trust — which you can only get at through indicators.', see: 'measurement' },
  'test–retest': { def: 'Measure everyone twice with a gap in between. The correlation between the two sittings is the reliability.', see: 'measurement' },
  'internal consistency': { def: 'How much the items on a scale agree with each other. What alpha reports, and not the same as measuring one thing.', see: 'measurement' },
  "cronbach's alpha": { def: 'Reliability estimated from a single sitting, by comparing the sum of the item variances with the variance of the total.', see: 'measurement' },
  'spearman–brown': { def: 'How reliability grows when you lengthen a scale: steeply at first, then hardly at all.', see: 'measurement' },
  'parallel': { strict: true, def: 'Items that measure the same true score with the same amount of error. The assumption under which alpha is exactly the reliability.', see: 'measurement' },
  standardised: { def: 'Rescaled to mean zero and standard deviation one, so different variables can be compared on the same ruler.', see: 'correlation' },

  /* ── procedures ── */
  bootstrap: { def: 'Resample your own data with replacement, recompute, repeat. Gives a standard error for any statistic you can code.', see: 'resampling' },
  'permutation test': { def: 'Shuffle the group labels a few thousand times to build the null distribution by brute force.', see: 'resampling' },
  rank: { strict: true, def: 'Position in the queue, ignoring by how much. The basis of every distribution-free test.', see: 'nonparametric' },
  'exchangeable': { def: 'Reordering the labels would not change anything — the assumption a permutation test runs on.', see: 'resampling' },
  'Monte Carlo': { def: 'Answering a question by simulating it many times rather than solving it.', see: 'mcmc' },
  convergence: { def: 'When an iterative procedure has stopped moving. Not the same as having arrived at the right place.', see: 'stan' },
  'R-hat': { def: 'Compares variance between MCMC chains with variance within them. Above 1.01 means they have not settled on the same answer.', see: 'stan' },
  'effective sample size': { def: 'How many independent draws your correlated MCMC draws are actually worth.', see: 'stan' },

  /* ── latent structure ── */
  loading: { def: 'How strongly one item responds to an underlying factor. A regression slope in standardised units, so also the correlation between the item and the factor.', see: 'factor' },
  communality: { def: "The share of an item's variance that the factors account for — the squared loading. Reliability, with a factor playing the part of the true score.", see: 'factor' },
  uniqueness: { def: 'Everything about an item that is not the factor: its measurement error plus whatever it measures that nothing else on the form asks about.', see: 'factor' },
  eigenvalue: { def: 'How much variance one direction of a matrix accounts for. In factor analysis, how big a factor is.', see: 'factor' },
  rotation: { def: 'Spinning the factor axes to make the loadings readable. Changes the description and not the fit, which is why two papers can report different factors from the same data.', see: 'factor' },
  'scree plot': { def: 'Eigenvalues in descending order. Named after the rubble at the base of a cliff, which is what the uninformative factors look like.', see: 'factor' },
  'parallel analysis': { def: 'Compare your eigenvalues with the ones pure noise would produce at the same size. Keeps only the factors that beat noise.', see: 'factor' },

  /* ── groups ── */
  'k-means': { def: 'Assign every point to its nearest centre, move every centre to the mean of its points, repeat. Assumes round clusters of similar size.', see: 'clustering' },
  silhouette: { def: 'How much closer a point is to its own cluster than to the nearest other one. Unlike within-cluster sum of squares, it has a maximum, so it can choose k.', see: 'clustering' },
  linkage: { def: 'What "distance between two groups" means in hierarchical clustering. Single chains along filaments; complete insists on compact balls.', see: 'clustering' },
  dendrogram: { def: 'The tree of merges, with each join drawn at the distance the two groups were apart. Cut it at any height to choose k after the fact.', see: 'clustering' },
  'euclidean distance': { def: 'Straight-line distance: go across, go up, take the hypotenuse. The atom of every clustering method.', see: 'clustering' },

  /* ── fitting ── */
  'learning rate': { def: 'How far you step for a given amount of slope. Too small and it crawls; too large and it overshoots and diverges.', see: 'gradientdescent' },
  gradient: { def: 'The slope of a loss in every direction at once, stacked into a vector. Points uphill, which is why the update subtracts it.', see: 'gradientdescent' },
  momentum: { def: 'Carry a fraction of the previous step into this one. Side-to-side wobble cancels; consistent motion accumulates.', see: 'gradientdescent' },
  'activation function': { def: 'The one non-linear thing done to a number between layers. Without it, a hundred stacked layers are algebraically one layer.', see: 'activations' },
  relu: { def: 'max(0, x). Negative in, zero out; positive in, unchanged. Its derivative is exactly 1 where it is on, which is why it survives depth.', see: 'activations' },
  'vanishing gradient': { def: 'Derivatives below 1, multiplied once per layer, shrink to nothing before reaching the first layer. Why deep networks would not train before rectifiers.', see: 'activations' },
  saturation: { def: 'When a squashing function has stopped being able to tell two different inputs apart, because both land at the flat end.', see: 'activations' },

  /* ── behaviour over time ── */
  volatility: { def: 'The typical size of a step-to-step change. A property of the ride, not of the destination — two paths can end in the same place having had completely different years.', see: 'processes' },
  drawdown: { def: 'The fall from a peak to the trough that followed it. Depends on the order the returns arrived in, so no distribution of returns can produce it.', see: 'processes' },
  liquidity: { def: 'How much you can transact before your own trading moves the price against you. A relationship between the size you need and the depth that happens to be there.', see: 'processes' },
  slippage: { def: 'The gap between the quoted price and the average price you actually got. What it costs to be bigger than the top of the book.', see: 'processes' },
  ergodic: { def: 'A process where the time average of one path equals the average across many paths. Most things are not, and expected value quietly assumes they are.', see: 'processes' },
  'geometric mean': { def: 'Multiply and take the root, rather than add and divide. The right average for anything that compounds, and always smaller than the arithmetic mean when values vary.', see: 'processes' },
  stationarity: { def: 'Whether the process generating your data changed while you were watching. When it fails, statistics do not become noisy — they become answers about a world that no longer exists.', see: 'processes' },
  autocorrelation: { def: 'How much a value knows about the one before it. Positive gives trends; negative gives a jagged path that keeps returning.', see: 'processes' },

  /* ── maths ── */
  derivative: { atom: true, strict: true, def: 'The slope at a single point, reached by squeezing a secant line until its two points merge.', see: 'derivatives' },
  integral: { strict: true, def: 'Area under a curve, reached by slicing it into rectangles and shrinking the slices to nothing.', see: 'integrals' },
  limit: { strict: true, def: 'Where a function is heading as you close in on a point, whether or not it ever arrives.', see: 'limits' },
  determinant: { def: 'How much a matrix stretches areas. Zero means it flattened space, which is why the inverse stops existing.', see: 'matrix' },
  matrix: { def: 'A machine that moves space. Its columns say where the basis vectors land.', see: 'matrix' },
  'inverse': { strict: true, def: 'The operation that undoes another. Only exists when nothing was lost on the way.', see: 'algebra' },
  eigenvector: { def: 'A direction a matrix only stretches, without rotating. The natural axes of the transformation.' },
  logarithm: { def: 'The inverse of exponentiating. Turns multiplication into addition, which is why every likelihood is computed in logs.', see: 'algebra' },
};

/* ── application ────────────────────────────────────────────────────────────── */

const KEYS = Object.keys(TERMS).sort((a, b) => b.length - a.length);
const SKIP_TAGS = new Set(['CODE', 'PRE', 'A', 'BUTTON', 'SCRIPT', 'STYLE']);

/**
 * Walk a rendered block and wrap the first occurrence of each known term.
 * Runs on text nodes only, so it can never break existing markup, and each
 * term is linked once per block so the prose does not turn into a minefield.
 */
export function applyGlossary(root, { limit = 1 } = {}) {
  const used = new Map();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      let p = node.parentElement;
      while (p && p !== root) {
        if (SKIP_TAGS.has(p.tagName) || p.classList.contains('cs-term')
          || p.classList.contains('fx-t') || p.hasAttribute('data-explain')) {
          return NodeFilter.FILTER_REJECT;
        }
        p = p.parentElement;
      }
      return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  const targets = [];
  while (walker.nextNode()) targets.push(walker.currentNode);

  for (const node of targets) {
    let text = node.nodeValue;
    let match = null, key = null;
    for (const k of KEYS) {
      if ((used.get(k) || 0) >= limit) continue;
      const pre = TERMS[k].strict ? DET : '(?:^|[^\\w-])';
      const re = new RegExp(`(${pre})(${escapeRe(k)}s?)(?![\\w-])`, 'i');
      const m = re.exec(text);
      if (m && (!match || m.index < match.index)) { match = m; key = k; }
    }
    if (!match) continue;

    const start = match.index + match[1].length;
    const word = match[2];
    const frag = document.createDocumentFragment();
    frag.appendChild(document.createTextNode(text.slice(0, start)));
    frag.appendChild(termSpan(key, word));
    frag.appendChild(document.createTextNode(text.slice(start + word.length)));
    node.parentNode.replaceChild(frag, node);
    used.set(key, (used.get(key) || 0) + 1);
  }
  return used.size;
}

function termSpan(key, word) {
  const t = TERMS[key];
  const el = document.createElement('span');
  el.className = 'cs-term' + (t.atom ? ' cs-term-atom' : '');
  el.setAttribute('data-term', key);
  el.setAttribute('tabindex', '0');
  el.textContent = word;
  return el;
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* Words like "mean", "sample" and "power" are verbs at least as often as they
   are terms. Requiring a determiner in front is crude, but it is right almost
   every time and it never links "can mean" to the arithmetic mean. */
const DET = '(?:^|[^\\w-])(?:the|a|an|its|their|his|her|this|that|these|those|each|every|one|observed|true|sample)\\s+';

/** the popover body for a term, as HTML. `here` suppresses a circular pointer. */
export function termCard(key, here) {
  const t = TERMS[key];
  if (!t) return '';
  const see = t.see && t.see !== here ? t.see.replace(/-/g, ' ') : null;
  return `<span class="cs-term-name">${key}</span>`
    + (t.atom ? '<span class="cs-term-atom-tag">atom</span>' : '')
    + `<span class="cs-term-def">${t.def}</span>`
    + (see ? `<span class="cs-term-see">built in: ${see}</span>` : '');
}

/** explicit wrapper, for when a lesson wants to force a term to be linked */
export const term = (key, label) =>
  `<span class="cs-term${TERMS[key]?.atom ? ' cs-term-atom' : ''}" data-term="${key}" tabindex="0">${label || key}</span>`;
