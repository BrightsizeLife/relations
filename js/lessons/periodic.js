/* ─────────────────────────────────────────────────────────────────────────────
   periodic.js — circles, waves, and taking them apart.

   Sine is not a squiggle that happens to repeat. It is the height of a point
   going round a circle, unrolled against time, and every property it has falls
   straight out of that. The lesson starts there and does not introduce a wave
   until the circle has produced one.

   The second half runs it backwards: given a shape, how much of each frequency
   is in it? That question has a mechanical answer — multiply by a cosine and
   add up — and it is the reason a spectrum can find a cycle buried in noise.
   ───────────────────────────────────────────────────────────────────────────── */

import * as st from '../core/stats.js';
import { TAU, component, spectrum, rebuild, sampleWave, WAVES, fourierTerms } from '../core/fourier.js';
import { frame, points, label, numLabel, path, rect, fnPath, arrowDefs } from '../core/plot.js';
import { range, clamp } from '../core/dom.js';
import { formula, t, frac, sqrt, sub, sup, sumOver, paren, eq, minus, plus, times, op } from '../core/fx.js';

/* ── the wheel and the strip it writes on ─────────────────────────────────── */

const CX = 152, CY = 262, R = 96;          /* the circle */
const WX0 = 276, WX1 = 692;                /* the wave */
const CYCLES = 2;
const wx = th => WX0 + (th / (CYCLES * TAU)) * (WX1 - WX0);

const SPEC = Object.fromEntries(Object.keys(WAVES).map(k => {
  const y = sampleWave(k, 128);
  return [k, { y, spec: spectrum(y) }];
}));

/* a series with two cycles hiding in it, for the detection step */
const HIDDEN = (() => {
  const n = 200, r = st.rng(77);
  const y = range(n).map(t2 =>
    3 * Math.sin((TAU * 7 * t2) / n)
    + 1.4 * Math.cos((TAU * 19 * t2) / n + 0.7)
    + st.randNorm(r, 0, 1.6));
  return { n, y, spec: spectrum(y) };
})();

/* twelve years of monthly data with a seasonal shape and a trend */
const SEASON = (() => {
  const n = 144, r = st.rng(404);
  const y = range(n).map(t2 =>
    100 + 0.18 * t2
    + 9 * Math.sin((TAU * t2) / 12 - 1.1)
    + 3.4 * Math.sin((TAU * 2 * t2) / 12 + 0.4)
    + st.randNorm(r, 0, 2.1));
  return { n, y };
})();

/* ── formula pieces ───────────────────────────────────────────────────────── */

const fA = t('A', { explain: 'Amplitude — how far the wave reaches from the middle. The radius of the circle.', tone: 'cyan', link: 'amp' });
const fW = t('f', { explain: 'Frequency — how many complete turns per unit of time. How fast the point goes round.', tone: 'gold', link: 'freq' });
const fP = t('φ', { explain: 'Phase — where on the circle the point was when the clock started. Slides the whole wave sideways.', tone: 'purple', link: 'phase' });

export default {
  meta: {
    id: 'periodic', title: 'circles, waves & fourier', short: 'waves & fourier',
    kicker: 'EVERYTHING THAT REPEATS', status: 'live',
    deck: 'Sine is not a squiggle that happens to repeat. It is the height of a point going round a circle, unrolled against time — and once you have seen that, every property it has stops needing to be memorised. Then the reverse: any repeating shape at all is a sum of these, and the arithmetic that takes it apart is a multiply and an add.',
    dataNote: 'Every wave and every spectrum on this page is computed live from the definition. The transform is written the slow, obvious way — for each candidate frequency, multiply and add — so every number traces back to something you can watch happen.',
    deps: ['algebra', 'derivatives'], unlocks: [],
    next: 'timeseries', nextLabel: 'time series',
    outro: 'a circle, unrolled. everything else on this page is that one picture, added to itself.',
  },
  canvas: { w: 720, h: 540 },
  defs: arrowDefs,
  state: {
    theta: 1.1, amp: 1, freq: 1, phase: 0, harm: 1,
    wave: 'square', probe: 3, terms: 2, rate: 20,
  },

  steps: [

    /* ── 1 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'a point going round a circle',
      prose: `<p>One dot, on a circle of radius one. Nothing else yet.</p>
        <p>Drag it round. There are two numbers describing where it is: how far along it is <em>horizontally</em>, and how far <em>up</em>. Both change as it goes, both come back to where they started after one full turn, and both are perfectly ordinary distances.</p>
        <p>Those two numbers are cosine and sine. That is the entire definition — everything else in this lesson is a consequence.</p>`,
      formula: formula(
        t('cos θ', { tone: 'gold' }) + eq + t('how far across', { tone: 'muted', cls: 'fx-tiny' }) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') +
        t('sin θ', { tone: 'cyan' }) + eq + t('how far up', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'no triangles required, and no mnemonic either' }),
      controls: [
        { type: 'slider', key: 'theta', label: 'angle θ', min: 0, max: TAU, step: 0.01, fast: true, fmt: v => (+v / Math.PI).toFixed(2) + 'π' },
      ],
      readouts: [
        { key: 'th', label: 'θ', tone: 'muted', get: s => +s.theta, d: 3 },
        { key: 'cos', label: 'cos θ — across', tone: 'gold', get: s => Math.cos(+s.theta), d: 4, wide: true },
        { key: 'sin', label: 'sin θ — up', tone: 'cyan', get: s => Math.sin(+s.theta), d: 4, wide: true },
        { key: 'p', label: 'cos² + sin²', tone: 'green', get: s => Math.cos(+s.theta) ** 2 + Math.sin(+s.theta) ** 2, d: 6, wide: true, explain: 'Always exactly one, because the point never leaves a circle of radius one. That is Pythagoras, not a trigonometric identity to memorise.' },
      ],
      beats: [
        { label: 'a circle', hold: 1200, note: 'Radius one, centred on nothing in particular.', scene: s => wheel(s, 0) },
        { label: 'a point on it', hold: 1400, note: 'At angle θ from the right-hand side, measured anticlockwise.', scene: s => wheel(s, 1) },
        { label: 'across and up', hold: 1700, note: 'The two legs of a right triangle whose hypotenuse is the radius. Which is why cos² + sin² is always 1 — read the readout while you drag.', scene: s => wheel(s, 2) },
      ],
    },

    /* ── 2 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'unroll the height and you have a wave',
      prose: `<p>Now let the point keep going, and plot its height against how far round it has got.</p>
        <p>That is the whole construction. The wave on the right is not a separate object — it is the same dot, traced. Every feature it has is a fact about a circle: it peaks when the dot is at the top, crosses zero when the dot is level with the centre, and repeats every full turn because the dot comes back.</p>
        <p>Drag the angle and watch the two move together.</p>`,
      controls: [
        { type: 'slider', key: 'theta', label: 'how far round', min: 0, max: CYCLES * TAU, step: 0.02, fast: true, fmt: v => (+v / TAU).toFixed(2) + ' turns' },
      ],
      readouts: [
        { key: 'tn', label: 'turns completed', tone: 'muted', get: s => +s.theta / TAU, d: 3 },
        { key: 'h', label: 'height now', tone: 'cyan', get: s => Math.sin(+s.theta), d: 4, wide: true },
        { key: 'w', label: 'where the dot is', get: s => { const p = ((+s.theta / TAU) % 1); return p < 0.25 ? 'climbing' : p < 0.5 ? 'falling from the top' : p < 0.75 ? 'falling below' : 'climbing back'; }, wide: true },
      ],
      beats: [
        { label: 'the dot, and its height', hold: 1500, note: 'A horizontal line from the dot, showing how high it is.', scene: s => unroll(s, 1) },
        { label: 'carry it across', hold: 1600, note: 'Take that height and put it at the current angle along the strip.', scene: s => unroll(s, 2) },
        { label: 'keep going', hold: 1800, note: 'Two full turns. The trail is the sine wave, and nobody drew it — the circle did.', scene: s => unroll({ ...s, theta: CYCLES * TAU }, 3) },
        { label: 'the shadow, too', hold: 1800, note: 'The horizontal position traced the same way is cosine: the identical wave, started a quarter turn earlier. They are one shape, seen from two directions.', scene: s => unroll({ ...s, theta: CYCLES * TAU }, 4) },
        { label: 'your turn', note: 'Drag it slowly and watch the dot and the pen stay level with each other.', scene: s => unroll(s, 4) },
      ],
    },

    /* ── 3 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'three dials, and nothing else',
      prose: `<p>Every sine wave that has ever existed is described by three numbers, and each one is a fact about the circle that made it.</p>
        <p><strong>Amplitude</strong> is the radius: how far the wave reaches. <strong>Frequency</strong> is how fast the point goes round: how many peaks per unit of time. <strong>Phase</strong> is where the point was when the clock started: it slides the whole wave sideways without changing its shape.</p>
        <p>That is a complete description. There is no fourth dial.</p>`,
      formula: formula(
        'y' + paren('t') + eq + fA + ' sin' + paren('2π' + fW + 't' + plus + fP) +
        '<br>' + t('radius', { tone: 'cyan', cls: 'fx-tiny' }) + op('&nbsp;·&nbsp;') +
        t('turns per unit time', { tone: 'gold', cls: 'fx-tiny' }) + op('&nbsp;·&nbsp;') +
        t('head start', { tone: 'purple', cls: 'fx-tiny' }),
        { caption: 'hover a letter to see which part of the circle it is' }),
      controls: [
        { type: 'slider', key: 'amp', label: 'amplitude', min: 0, max: 1.6, step: 0.02, fast: true, fmt: v => (+v).toFixed(2) },
        { type: 'slider', key: 'freq', label: 'frequency', min: 0.5, max: 5, step: 0.1, fast: true, fmt: v => (+v).toFixed(1) },
        { type: 'slider', key: 'phase', label: 'phase', min: 0, max: TAU, step: 0.05, fast: true, fmt: v => (+v / Math.PI).toFixed(2) + 'π' },
      ],
      readouts: [
        { key: 'a', label: 'amplitude', tone: 'cyan', get: s => +s.amp, d: 2 },
        { key: 'f', label: 'frequency', tone: 'gold', get: s => +s.freq, d: 1, wide: true },
        { key: 'p', label: 'period', tone: 'green', get: s => 1 / +s.freq, d: 3, wide: true, explain: 'How long one complete cycle takes. Always one divided by the frequency — they are the same fact stated two ways.' },
        { key: 'ph', label: 'phase', tone: 'purple', get: s => +s.phase, d: 2 },
      ],
      beats: [
        { label: 'amplitude', hold: 1600, note: 'The radius of the circle. Taller wave, same timing.', scene: s => dials({ ...s, amp: 1.4, freq: 1, phase: 0 }, 'amp') },
        { label: 'frequency', hold: 1600, note: 'How fast it goes round. More peaks in the same span, same height.', scene: s => dials({ ...s, amp: 1, freq: 3, phase: 0 }, 'freq') },
        { label: 'phase', hold: 1600, note: 'Where it started. The wave slides; its shape does not change at all.', scene: s => dials({ ...s, amp: 1, freq: 1, phase: Math.PI / 2 }, 'phase') },
        { label: 'your turn', note: 'Move all three. Anything you can make is still a sine wave — you cannot get a corner out of these dials.', scene: s => dials(s, null) },
      ],
    },

    /* ── 4 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'add two of them together',
      prose: `<p>Add two sine waves at the <em>same</em> frequency and you get a sine wave at that frequency. Different amplitude, different phase, same shape. Nothing new was created.</p>
        <p>Add two at <em>different</em> frequencies and something else happens: the result is not a sine wave at all. It still repeats, but its shape is new.</p>
        <p>That asymmetry is the hinge of the whole subject. Sines at one frequency are a closed shop. Sines at many frequencies can build anything.</p>`,
      controls: [
        { type: 'slider', key: 'freq', label: 'frequency of the second wave', min: 1, max: 6, step: 1, fast: true },
        { type: 'slider', key: 'amp', label: 'its amplitude', min: 0, max: 1.2, step: 0.05, fast: true, fmt: v => (+v).toFixed(2) },
      ],
      readouts: [
        { key: 'f1', label: 'wave 1', tone: 'cyan', get: () => '1 × , amplitude 1', wide: true },
        { key: 'f2', label: 'wave 2', tone: 'purple', get: s => `${+s.freq} × , amplitude ${(+s.amp).toFixed(2)}`, wide: true },
        { key: 'sh', label: 'the sum is', tone: 'green', get: s => (+s.freq === 1 ? 'still a sine wave' : +s.amp < 0.03 ? 'still a sine wave' : 'a new shape'), wide: true },
      ],
      beats: [
        { label: 'same frequency', hold: 1800, note: 'Two waves, both at 1×. Their sum is a third sine wave at 1× — taller, shifted, identical in shape.', scene: s => addWaves({ ...s, freq: 1, amp: 0.7 }) },
        { label: 'double frequency', hold: 1800, note: 'Now the second is at 2×. The sum has a bump in it that neither wave has. This is new information.', scene: s => addWaves({ ...s, freq: 2, amp: 0.7 }) },
        { label: 'triple', hold: 1800, note: 'At 3× the sum is starting to look flat-topped. Hold that thought for one step.', scene: s => addWaves({ ...s, freq: 3, amp: 0.5 }) },
        { label: 'your turn', note: 'Set the second frequency to 1 and drag its amplitude: the shape never changes. Set it to anything else and it does.', scene: s => addWaves(s) },
      ],
    },

    /* ── 5 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'any repeating shape at all',
      prose: `<p>Here is the claim, and it is a startling one the first time. <strong>Every</strong> repeating shape — including ones with corners, jumps and flat sections — is a sum of sine waves at whole-number multiples of its own frequency.</p>
        <p>A square wave. Nothing about it looks like a sine. Add the harmonics one at a time and watch the corners arrive out of curves.</p>
        <p>Notice the ears that will not go away at the jumps. They get narrower forever and never get shorter — about 9% of the step, no matter how many terms you add. That is the Gibbs phenomenon, and it is a fact about the sum rather than an error in it.</p>`,
      formula: formula(
        'square' + paren('x') + eq + frac('4', 'π') + paren(
          'sin x' + plus + frac('sin 3x', '3') + plus + frac('sin 5x', '5') + plus + '…') + '<br>' +
        t('odd harmonics only, each one weaker by 1/k', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'the even ones cancel, for a reason the spectrum will show you in two steps' }),
      controls: [
        { type: 'slider', key: 'harm', label: 'how many components', min: 1, max: 40, step: 1, fast: true },
        { type: 'segment', key: 'wave', label: 'shape', options: [
          { value: 'square', label: 'square' }, { value: 'saw', label: 'sawtooth' },
          { value: 'triangle', label: 'triangle' }, { value: 'pulse', label: 'pulse' },
        ] },
      ],
      readouts: [
        { key: 'h', label: 'components used', tone: 'cyan', get: s => +s.harm, d: 0 },
        { key: 'e', label: 'how wrong it still is', tone: 'warm', get: s => { const S2 = SPEC[s.wave]; const r = rebuild(S2.spec, +s.harm); return Math.sqrt(r.reduce((a, v, i) => a + (v - S2.y[i]) ** 2, 0) / r.length); }, d: 4, wide: true },
        { key: 'g', label: 'the overshoot', tone: 'gold', get: s => { const S2 = SPEC[s.wave]; const r = rebuild(S2.spec, +s.harm); return Math.max(...r); }, d: 4, wide: true, explain: 'The height of the ear at the jump. It stops falling at about 1.18 and stays there however many terms you add.' },
      ],
      beats: [
        { label: 'one sine', hold: 1400, note: 'A single sine wave, doing its best. Not close.', scene: s => build(s, 1) },
        { label: 'three', hold: 1400, note: 'Add the third harmonic. The top is flattening.', scene: s => build(s, 3) },
        { label: 'nine', hold: 1500, note: 'Recognisably a square wave built entirely out of curves.', scene: s => build(s, 9) },
        { label: 'forty', hold: 1800, note: 'Forty components. The sides are almost vertical — and the ears at the jumps are exactly as tall as they were at nine.', scene: s => build(s, 40) },
        { label: 'your turn', note: 'Drag the count, then change the shape. A sawtooth needs every harmonic; a triangle needs only the odd ones and converges much faster.', scene: s => build(s, +s.harm) },
      ],
    },

    /* ── 6 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'running it backwards: how much of frequency k is in here?',
      prose: `<p>Building a shape out of sines is one direction. The useful direction is the other one: hand me a shape, and I will tell you which frequencies are in it and how much of each.</p>
        <p>The method is embarrassingly simple. Multiply the signal by a cosine at the frequency you are asking about, and add up the result.</p>
        <p>If they line up, the products are mostly positive and the sum is large. If they do not, the products are as often negative as positive and the sum collapses to nothing. The multiply-and-add is a <em>test for agreement</em> — and you have used it before, because it is exactly the numerator of a correlation.</p>`,
      formula: formula(
        t('a', { tone: 'gold' }) + sub('', 'k') + eq + frac('2', 'n') + sumOver('y' + sub('', 't') + ' cos' + paren(frac('2πkt', 'n')), { from: 't', to: '' }) +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') + t('a sum of products — a correlation with a wave', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'and the same again with sine, which catches whatever cosine missed' }),
      dep: { note: 'a sum of products testing whether two things agree is', lesson: 'correlation', label: 'covariance' },
      controls: [
        { type: 'slider', key: 'probe', label: 'the frequency you are asking about', min: 1, max: 12, step: 1, fast: true },
      ],
      readouts: [
        { key: 'k', label: 'asking about k =', tone: 'gold', get: s => +s.probe, d: 0 },
        { key: 'a', label: 'the sum of products', tone: 'warm', get: s => component(SPEC.square.y, +s.probe).a, d: 4, wide: true },
        { key: 'amp', label: 'amplitude at this k', tone: 'green', get: s => component(SPEC.square.y, +s.probe).amp, d: 4, wide: true },
        { key: 'v', label: 'verdict', get: s => (component(SPEC.square.y, +s.probe).amp > 0.1 ? 'this frequency is in there' : 'barely present'), wide: true },
      ],
      beats: [
        { label: 'the signal, and a probe', hold: 1600, note: 'The square wave on top; a cosine at the frequency you are asking about underneath.', scene: s => probe(s, 1) },
        { label: 'multiply them', hold: 1700, note: 'Point by point. Where both are positive or both negative the product is positive; where they disagree it is negative.', scene: s => probe(s, 2) },
        { label: 'add it up', hold: 1800, note: 'One number. At a frequency that is genuinely present the positives dominate and the total is large.', scene: s => probe(s, 3) },
        { label: 'a frequency that is not there', hold: 1800, note: 'Ask about k = 2. The products cancel almost exactly and the total falls to nothing. The square wave contains no even harmonics, and this is why.', scene: s => probe({ ...s, probe: 2 }, 3) },
        { label: 'your turn', note: 'Step through k. Watch the total jump at 1, 3, 5, 7 and vanish in between.', scene: s => probe(s, 3) },
      ],
    },

    /* ── 7 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'do that for every frequency and you have the spectrum',
      prose: `<p>Run the last step once for each candidate frequency and plot the answers. That picture is the <strong>spectrum</strong>, and it is the same signal written in a different alphabet — no information gained, none lost.</p>
        <p>The square wave's spectrum is a comb: 1, 3, 5, 7, with nothing in between and each spike weaker by exactly 1/k. That is the formula from two steps ago, read off a chart instead of derived.</p>
        <p>Switch the shape and watch the comb rearrange itself. A sawtooth uses every harmonic. A triangle uses the odd ones and drops off as 1/k², which is why it converges so much faster.</p>`,
      controls: [
        { type: 'segment', key: 'wave', label: 'shape', options: [
          { value: 'square', label: 'square' }, { value: 'saw', label: 'sawtooth' },
          { value: 'triangle', label: 'triangle' }, { value: 'pulse', label: 'pulse' },
        ] },
        { type: 'slider', key: 'harm', label: 'components kept', min: 1, max: 40, step: 1, fast: true },
      ],
      readouts: [
        { key: 'w', label: 'shape', get: s => WAVES[s.wave].label, wide: true },
        { key: 'b', label: 'biggest frequency', tone: 'gold', get: s => { const c = SPEC[s.wave].spec.comps; return c.indexOf(c.reduce((a, b) => (b.amp > a.amp ? b : a))) + 1; }, d: 0, wide: true },
        { key: 'n', label: 'how many are above 1% of it', tone: 'cyan', get: s => { const c = SPEC[s.wave].spec.comps; const m = Math.max(...c.map(x => x.amp)); return c.filter(x => x.amp > 0.01 * m).length; }, d: 0, wide: true },
      ],
      beats: [
        { label: 'the shape', hold: 1300, note: 'What you started with, in time.', scene: s => spec(s, 1) },
        { label: 'the same thing, in frequency', hold: 1700, note: 'One bar per frequency, height = how much of it is present. Every bar was one multiply-and-add.', scene: s => spec(s, 2) },
        { label: 'keep only some', hold: 1800, note: 'Grey out the bars you are throwing away and rebuild from what is left. Fewer bars, blunter shape — and that trade is what image and audio compression is.', scene: s => spec(s, 3) },
        { label: 'change the shape', note: 'Switch between the four. The comb tells you what kind of shape it is before you look at the waveform.', scene: s => spec(s, 3) },
      ],
    },

    /* ── 8 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'finding a cycle nobody can see',
      prose: `<p>Now the reason anybody outside physics cares.</p>
        <p>Here is a series with two perfectly regular cycles buried in it and enough noise on top that neither is visible. Stare at it as long as you like — the eye is very poor at this.</p>
        <p>The spectrum is not. Every noisy wiggle contributes a small amount at a random frequency, so noise spreads itself thinly across the whole chart. A real cycle contributes all of itself at one frequency and stands up out of the floor.</p>
        <p>That is the whole trick, and it is why a periodogram is the first thing to reach for when you suspect something repeats but cannot say what.</p>`,
      readouts: [
        { key: 'a', label: 'the first cycle', tone: 'gold', get: () => 7, d: 0, suf: ' per span', wide: true },
        { key: 'b', label: 'the second', tone: 'purple', get: () => 19, d: 0, suf: ' per span', wide: true },
        { key: 'f', label: 'the noise floor', tone: 'muted', get: () => st.median(HIDDEN.spec.comps.map(c => c.amp)), d: 3, wide: true },
      ],
      beats: [
        { label: 'the series', hold: 1700, note: 'Two hundred points. There are two exact cycles in here.', scene: s => hidden(s, 1) },
        { label: 'take its spectrum', hold: 1800, note: 'Two spikes, at 7 and 19, standing clear of everything else. Nothing was assumed — the same multiply-and-add, run at every frequency.', scene: s => hidden(s, 2) },
        { label: 'the noise floor', hold: 1800, note: 'The dashed line is the median bar height. Noise spreads itself across every frequency and gets nowhere; a real cycle puts everything it has into one.', scene: s => hidden(s, 3) },
        { label: 'rebuild from the two', note: 'Take only those two components back into the time domain. The cycles that were invisible are now the only thing on screen.', scene: s => hidden(s, 4) },
      ],
    },

    /* ── 9 ─────────────────────────────────────────────────────────────────── */
    {
      title: 'putting a wave into a regression',
      prose: `<p>Twelve years of monthly numbers, with a trend and a seasonal shape on top. You want to model both.</p>
        <p>Eleven monthly dummy variables would do it, and cost eleven parameters for a shape that is obviously smooth. Instead add two columns: <em>sin(2πt/12)</em> and <em>cos(2πt/12)</em>. Two parameters, and ordinary least squares handles the rest.</p>
        <p>Two, not one, because a wave has a phase and you have no idea in advance where the peak falls. A weighted sum of a sine and a cosine at the same frequency is a wave of <em>any</em> phase — which is the identity from step 4, doing real work. The regression estimates the two weights and the phase comes out of them for free.</p>
        <p>Add another pair at twice the frequency and the seasonal shape can have two humps. Drag the harmonics.</p>`,
      formula: formula(
        'y' + sub('', 't') + eq + t('β', { tone: 'muted' }) + sub('', '0') + plus + t('β', { tone: 'muted' }) + sub('', '1') + 't' +
        plus + t('β', { tone: 'cyan' }) + sub('', '2') + ' sin' + paren(frac('2πt', '12')) +
        plus + t('β', { tone: 'purple' }) + sub('', '3') + ' cos' + paren(frac('2πt', '12')) + plus + '…' + '<br>' +
        t('two columns per harmonic, and no phase to estimate', { tone: 'muted', cls: 'fx-tiny' }),
        { caption: 'a linear model. the curve is hiding in the columns, exactly as it does for splines.' }),
      dep: { note: 'a curve built from columns of a linear model is the same trick as', lesson: 'splines', label: 'splines' },
      controls: [
        { type: 'slider', key: 'terms', label: 'harmonics', min: 0, max: 5, step: 1, fast: true },
      ],
      readouts: [
        { key: 'p', label: 'parameters used', tone: 'cyan', get: s => 2 + 2 * (+s.terms), d: 0, wide: true },
        { key: 'd', label: 'monthly dummies would cost', tone: 'muted', get: () => 13, d: 0, wide: true },
        { key: 'r', label: 'variance explained', tone: 'green', get: s => seasonFit(+s.terms).r2 * 100, d: 1, suf: '%', wide: true },
      ],
      beats: [
        { label: 'the data', hold: 1400, note: 'Twelve years, monthly. A trend, and something that repeats.', scene: s => season(s, 0) },
        { label: 'a straight line', hold: 1500, note: 'Trend only. It gets the drift and none of the season.', scene: s => season({ ...s, terms: 0 }, 1) },
        { label: 'one pair of columns', hold: 1700, note: 'Add sin and cos at the yearly frequency. Two parameters, and the season appears — including its phase, which nobody specified.', scene: s => season({ ...s, terms: 1 }, 1) },
        { label: 'two pairs', hold: 1700, note: 'A second harmonic lets the seasonal shape be something other than a plain wave.', scene: s => season({ ...s, terms: 2 }, 1) },
        { label: 'the columns themselves', hold: 1800, note: 'What was actually handed to the regression. Ordinary numeric columns; the model has no idea they are special.', scene: s => season(s, 2) },
        { label: 'your turn', note: 'Push the harmonics up and watch the fit start chasing noise. Four pairs is eight parameters, and it will happily fit the wobbles.', scene: s => season(s, 1) },
      ],
    },

    /* ── 10 ────────────────────────────────────────────────────────────────── */
    {
      title: 'what you cannot see: sampling and aliasing',
      prose: `<p>One warning, and it is the one that bites hardest in practice.</p>
        <p>A cycle can only be detected if you sample at least twice per turn. Sample any slower and it does not disappear — it <strong>reappears at the wrong frequency</strong>, indistinguishable from a slow cycle that is not there.</p>
        <p>Drag the sampling rate down through the true frequency and watch a fast wave turn into a slow one that the data supports perfectly. Nothing in your dataset can tell you it happened.</p>
        <p>The threshold is half the sampling rate and it is called the Nyquist frequency. Monthly data cannot see a fortnightly cycle; it sees something else instead.</p>`,
      formula: formula(
        t('Nyquist', { tone: 'gold' }) + eq + frac('sampling rate', '2') +
        op('&nbsp;&nbsp;·&nbsp;&nbsp;') +
        t('anything faster comes back wearing a disguise', { tone: 'warm', cls: 'fx-tiny' }),
        { caption: 'the one limit in this lesson that no amount of cleverness gets round' }),
      controls: [
        { type: 'slider', key: 'rate', label: 'samples per span', min: 4, max: 40, step: 1, fast: true },
        { type: 'slider', key: 'freq', label: 'true frequency', min: 1, max: 9, step: 1, fast: true },
      ],
      readouts: [
        { key: 'r', label: 'sampling rate', tone: 'cyan', get: s => +s.rate, d: 0 },
        { key: 'n', label: 'nyquist limit', tone: 'gold', get: s => +s.rate / 2, d: 1, wide: true },
        { key: 'f', label: 'true frequency', tone: 'purple', get: s => +s.freq, d: 0 },
        { key: 'a', label: 'what you will measure', tone: 'warm', get: s => aliasOf(+s.freq, +s.rate), d: 1, wide: true, explain: 'The frequency the samples are consistent with. Below Nyquist it is the truth; above it, it is a lie your data cannot detect.' },
      ],
      beats: [
        { label: 'sampled fast enough', hold: 1700, note: 'Forty samples for a wave that turns four times. Plenty — the dots trace the wave.', scene: s => alias({ ...s, rate: 40, freq: 4 }) },
        { label: 'right at the limit', hold: 1800, note: 'Eight samples, four turns: exactly two per turn. The bare minimum, and already fragile.', scene: s => alias({ ...s, rate: 8, freq: 4 }) },
        { label: 'too slow', hold: 1900, note: 'Six samples for four turns. The dots now sit perfectly on a much slower wave that was never there. Both curves fit the data exactly.', scene: s => alias({ ...s, rate: 6, freq: 4 }) },
        { label: 'your turn', note: 'Drag the rate down slowly and watch the moment the ghost wave takes over.', scene: s => alias(s) },
      ],
      aside: `<p><strong>Where this shows up.</strong> A weekly report cannot see a daily pattern; it sees whatever that pattern happens to line up with. A monthly survey cannot see a fortnightly one. And the reverse is worth knowing too: if a cycle in your data sits at exactly half or a third of your sampling rate, be suspicious — that is where aliases land.</p>`,
    },
  ],
};

/* ── scenes ───────────────────────────────────────────────────────────────── */

function wheel(s, phase) {
  const th = +s.theta;
  const x = CX + R * Math.cos(th), y = CY - R * Math.sin(th);
  const out = [
    { key: 'c', tag: 'circle', attrs: { cx: CX, cy: CY, r: R },
      set: { fill: 'none', stroke: 'var(--cs-border-data)', 'stroke-width': 1.6 } },
    path('ax', [[CX - R - 26, CY], [CX + R + 26, CY]], { cls: 'rule rule-faint' }),
    path('ay', [[CX, CY - R - 26], [CX, CY + R + 26]], { cls: 'rule rule-faint' }),
  ];
  if (phase >= 1) out.push(
    path('rad', [[CX, CY], [x, y]], { cls: 'stick', set: { stroke: 'var(--cs-muted)', 'stroke-width': 2 } }),
    { key: 'dot', tag: 'circle', cls: 'pt pt-cyan', attrs: { cx: x, cy: y, r: 8 } },
    path('arc', arcPts(0, th, R * 0.28), { cls: 'curve', set: { stroke: 'var(--cs-data-gold)', 'stroke-width': 1.6, fill: 'none' } }),
    label('thl', CX + R * 0.42 * Math.cos(th / 2), CY - R * 0.42 * Math.sin(th / 2), 'θ', { cls: 'lab lab-mid lab-gold' }));
  if (phase >= 2) out.push(
    path('cos', [[CX, CY], [x, CY]], { cls: 'stick link-cos', set: { stroke: 'var(--cs-data-gold)', 'stroke-width': 4 } }),
    path('sin', [[x, CY], [x, y]], { cls: 'stick link-sin', set: { stroke: 'var(--cs-cyan)', 'stroke-width': 4 } }),
    numLabel('cosv', (CX + x) / 2, CY + 20, Math.cos(th), { cls: 'lab lab-mid lab-gold', d: 3 }),
    numLabel('sinv', x + (Math.cos(th) >= 0 ? 12 : -12), (CY + y) / 2, Math.sin(th), {
      cls: 'lab lab-cyan' + (Math.cos(th) >= 0 ? '' : ' lab-end'), d: 3,
    }),
    label('l1', 430, 176, 'cos θ — how far across', { cls: 'lab-big lab-gold' }),
    label('l2', 430, 210, 'sin θ — how far up', { cls: 'lab-big lab-cyan' }),
    label('l3', 430, 262, 'the two legs of a right triangle', { cls: 'lab-sm' }),
    label('l4', 430, 278, 'whose hypotenuse is the radius,', { cls: 'lab-sm' }),
    label('l5', 430, 294, 'which never changes.', { cls: 'lab-sm' }),
    label('l6', 430, 328, 'so cos²θ + sin²θ = 1,', { cls: 'lab lab-green' }),
    label('l7', 430, 348, 'always, for the dullest possible reason.', { cls: 'lab-sm lab-green' }));
  return out;
}

const arcPts = (a, b, r) => range(41).map(i => {
  const th = a + ((b - a) * i) / 40;
  return [CX + r * Math.cos(th), CY - r * Math.sin(th)];
});

function unroll(s, phase) {
  const th = clamp(+s.theta, 0, CYCLES * TAU);
  const x = CX + R * Math.cos(th), y = CY - R * Math.sin(th);
  const trail = range(Math.max(2, Math.round((th / (CYCLES * TAU)) * 240)) + 1)
    .map(i => { const a = (i / 240) * CYCLES * TAU; return [wx(a), CY - R * Math.sin(a)]; });
  const trailC = range(Math.max(2, Math.round((th / (CYCLES * TAU)) * 240)) + 1)
    .map(i => { const a = (i / 240) * CYCLES * TAU; return [wx(a), CY - R * Math.cos(a)]; });

  const out = [
    { key: 'c', tag: 'circle', attrs: { cx: CX, cy: CY, r: R },
      set: { fill: 'none', stroke: 'var(--cs-border-data)', 'stroke-width': 1.6 } },
    path('base', [[WX0, CY], [WX1, CY]], { cls: 'rule rule-faint' }),
    path('rad', [[CX, CY], [x, y]], { cls: 'stick', set: { stroke: 'var(--cs-muted)', 'stroke-width': 2 } }),
    { key: 'dot', tag: 'circle', cls: 'pt pt-cyan', attrs: { cx: x, cy: y, r: 8 } },
    ...range(CYCLES + 1).map(i => [
      path('gl' + i, [[wx(i * TAU), CY - R - 16], [wx(i * TAU), CY + R + 16]], { cls: 'rule rule-faint rule-dash' }),
      label('gt' + i, wx(i * TAU), CY + R + 32, i === 0 ? '0' : i === 1 ? '1 turn' : `${i} turns`, { cls: 'ax-tick' }),
    ]).flat(),
  ];

  if (phase >= 1) out.push(
    path('lvl', [[x, y], [wx(th), y]], { cls: 'stick', set: { stroke: 'var(--cs-cyan)', 'stroke-width': 1.4, 'stroke-dasharray': '4 4' } }),
    path('hgt', [[CX, CY], [CX, y]], { cls: 'stick', set: { stroke: 'var(--cs-cyan)', 'stroke-width': 4 } }));
  if (phase >= 2) out.push(
    path('sw', trail, { cls: 'curve curve-cyan' }),
    { key: 'pen', tag: 'circle', cls: 'pt pt-cyan', attrs: { cx: wx(th), cy: y, r: 6 } },
    label('swl', WX1, CY - R - 24, 'sin', { cls: 'lab lab-end lab-cyan' }));
  if (phase >= 4) out.push(
    path('cw', trailC, { cls: 'curve', set: { stroke: 'var(--cs-data-gold)', 'stroke-width': 2 }, opacity: 0.9 }),
    label('cwl', WX1, CY + R + 12, 'cos — a quarter turn ahead', { cls: 'lab-sm lab-end lab-gold' }),
    path('hor', [[CX, CY], [x, CY]], { cls: 'stick', set: { stroke: 'var(--cs-data-gold)', 'stroke-width': 4 } }));
  return out;
}

function dials(s, hot) {
  const A = +s.amp, F = +s.freq, P = +s.phase;
  const th = CYCLES * TAU;
  const pts = range(300).map(i => {
    const a = (i / 299) * th;
    return [wx(a), CY - R * A * Math.sin(F * a + P)];
  });
  const ref = range(300).map(i => { const a = (i / 299) * th; return [wx(a), CY - R * Math.sin(a)]; });
  const dotTh = 0.7 * th;
  const x = CX + R * A * Math.cos(F * dotTh + P), y = CY - R * A * Math.sin(F * dotTh + P);
  return [
    { key: 'c', tag: 'circle', attrs: { cx: CX, cy: CY, r: R * Math.max(A, 0.02) },
      set: { fill: 'none', stroke: hot === 'amp' ? 'var(--cs-cyan)' : 'var(--cs-border-data)', 'stroke-width': hot === 'amp' ? 2.4 : 1.6 } },
    { key: 'cref', tag: 'circle', attrs: { cx: CX, cy: CY, r: R },
      set: { fill: 'none', stroke: 'var(--cs-border-dark)', 'stroke-width': 1, 'stroke-dasharray': '3 4' } },
    path('rad', [[CX, CY], [x, y]], { cls: 'stick', set: { stroke: 'var(--cs-muted)', 'stroke-width': 2 } }),
    { key: 'dot', tag: 'circle', cls: 'pt pt-cyan', attrs: { cx: x, cy: y, r: 7 } },
    path('base', [[WX0, CY], [WX1, CY]], { cls: 'rule rule-faint' }),
    path('ref', ref, { cls: 'curve curve-ghost' }),
    path('w', pts, { cls: 'curve curve-cyan' }),
    label('rl', WX1, CY + R + 30, 'faint: a plain sine, for comparison', { cls: 'lab-sm lab-end' }),
    hot ? label('hot', (WX0 + WX1) / 2, CY - R - 30, {
      amp: 'amplitude — the radius changed, the timing did not',
      freq: 'frequency — more turns in the same span, same height',
      phase: 'phase — the whole wave slid sideways, unchanged in shape',
    }[hot], { cls: 'lab lab-mid lab-gold' }) : null,
  ].filter(Boolean);
}

function addWaves(s) {
  const F = +s.freq, A = +s.amp;
  const th = CYCLES * TAU;
  const mk = f => range(300).map(i => { const a = (i / 299) * th; return [wx(a), a]; })
    .map(([px, a]) => [px, f(a)]);
  const y0 = 150, y1 = 250, y2 = 400, sc = 40;
  const w1 = mk(a => y0 - sc * Math.sin(a));
  const w2 = mk(a => y1 - sc * A * Math.sin(F * a));
  const sum = mk(a => y2 - sc * (Math.sin(a) + A * Math.sin(F * a)));
  return [
    path('b0', [[WX0, y0], [WX1, y0]], { cls: 'rule rule-faint' }),
    path('b1', [[WX0, y1], [WX1, y1]], { cls: 'rule rule-faint' }),
    path('b2', [[WX0, y2], [WX1, y2]], { cls: 'rule rule-faint' }),
    path('w1', w1, { cls: 'curve curve-cyan' }),
    path('w2', w2, { cls: 'curve curve-purple' }),
    path('ws', sum, { cls: 'curve curve-fit' }),
    label('l1', WX0 - 12, y0 + 4, 'wave 1', { cls: 'lab-sm lab-end lab-cyan' }),
    label('l1b', WX0 - 12, y0 + 18, '1×', { cls: 'lab-sm lab-end' }),
    label('l2', WX0 - 12, y1 + 4, 'wave 2', { cls: 'lab-sm lab-end lab-purple' }),
    label('l2b', WX0 - 12, y1 + 18, `${F}×`, { cls: 'lab-sm lab-end' }),
    label('l3', WX0 - 12, y2 + 4, 'their sum', { cls: 'lab-sm lab-end lab-green' }),
    label('plus', (WX0 + WX1) / 2, (y0 + y1) / 2 + 6, '+', { cls: 'lab-big lab-mid' }),
    label('eq', (WX0 + WX1) / 2, (y1 + y2) / 2 + 6, '=', { cls: 'lab-big lab-mid' }),
    label('v', (WX0 + WX1) / 2, 486, F === 1 || A < 0.03
      ? 'still a sine wave — same frequency, new amplitude and phase'
      : 'not a sine wave any more', {
      cls: 'lab lab-mid ' + (F === 1 || A < 0.03 ? 'lab-green' : 'lab-warm'),
    }),
  ];
}

function build(s, m) {
  const S2 = SPEC[s.wave];
  const n = 128;
  const r = rebuild(S2.spec, clamp(m, 1, 40));
  const f = frame({ w: 720, h: 540, l: 66, r: 40, t: 84, b: 168 });
  f.setX(0, n - 1); f.setY(-1.45, 1.45);
  const g = frame({ w: 720, h: 540, l: 66, r: 40, t: 400, b: 62 });
  g.setX(0.5, 20.5); g.setY(0, Math.max(...S2.spec.comps.map(c => c.amp)) * 1.15);

  return [
    { key: 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.sy(0), x2: f.x1, y2: f.sy(0) } },
    path('tgt', S2.y.map((v, i) => [f.sx(i), f.sy(v)]), { cls: 'curve curve-ghost' }),
    path('rb', r.map((v, i) => [f.sx(i), f.sy(v)]), { cls: 'curve curve-cyan' }),
    label('tl', f.x0 + 6, f.y1 - 10, `${WAVES[s.wave].label} · ${m} component${m > 1 ? 's' : ''}`, { cls: 'lab-big lab-cyan' }),
    label('tg', f.x1 - 4, f.y1 - 10, 'faint: the shape you are chasing', { cls: 'lab-sm lab-end' }),
    m >= 5 ? [
      path('ov', [[f.x0, f.sy(1.18)], [f.x1, f.sy(1.18)]], { cls: 'rule rule-faint rule-dash' }),
      label('ovl', f.x1 - 4, f.sy(1.18) - 6, 'the ears stop here, forever', { cls: 'lab-sm lab-end lab-gold' }),
    ] : null,
    { key: 'gx', tag: 'line', cls: 'ax-line', attrs: { x1: g.x0, y1: g.y0, x2: g.x1, y2: g.y0 } },
    ...S2.spec.comps.slice(0, 20).map((c, i) => rect('bar' + i, g.sx(i + 1) - 6, g.sy(c.amp), 12, g.y0 - g.sy(c.amp), {
      cls: 'sq ' + (i < m ? 'sq-x' : 'sq-dim'), dur: 260,
      tip: `k = ${c.k}<br>amplitude ${c.amp.toFixed(4)}`,
    })),
    ...range(20).map(i => (i % 2 === 0 ? label('gt' + i, g.sx(i + 1), g.y0 + 15, String(i + 1), { cls: 'ax-tick' }) : null)),
    label('gl', g.x0 + 4, g.y1 - 6, 'which components are in play', { cls: 'lab-sm lab-cyan' }),
  ].filter(Boolean);
}

function probe(s, phase) {
  const y = SPEC.square.y, n = y.length, k = clamp(+s.probe, 1, 12);
  const c = range(n).map(t2 => Math.cos((TAU * k * t2) / n));
  const prod = y.map((v, i) => v * c[i]);
  const total = component(y, k).a;

  const H = 96;
  const F = (top) => { const f = frame({ w: 720, h: 540, l: 66, r: 190, t: top, b: 540 - top - H }); f.setX(0, n - 1); f.setY(-1.35, 1.35); return f; };
  const f1 = F(58), f2 = F(186), f3 = F(316);

  const out = [
    { key: 'a1', tag: 'line', cls: 'ax-line', attrs: { x1: f1.x0, y1: f1.sy(0), x2: f1.x1, y2: f1.sy(0) } },
    path('sig', y.map((v, i) => [f1.sx(i), f1.sy(v)]), { cls: 'curve curve-cyan' }),
    label('sl', f1.x0 + 4, f1.y1 + 2, 'the signal', { cls: 'lab-sm lab-cyan' }),
    { key: 'a2', tag: 'line', cls: 'ax-line', attrs: { x1: f2.x0, y1: f2.sy(0), x2: f2.x1, y2: f2.sy(0) } },
    path('prb', c.map((v, i) => [f2.sx(i), f2.sy(v)]), { cls: 'curve', set: { stroke: 'var(--cs-data-gold)', 'stroke-width': 2 } }),
    label('pl', f2.x0 + 4, f2.y1 + 2, `a cosine at k = ${k}`, { cls: 'lab-sm lab-gold' }),
  ];

  if (phase >= 2) out.push(
    { key: 'a3', tag: 'line', cls: 'ax-line', attrs: { x1: f3.x0, y1: f3.sy(0), x2: f3.x1, y2: f3.sy(0) } },
    ...range(n).map(i => rect('pb' + i, f3.sx(i) - 1.4, Math.min(f3.sy(0), f3.sy(prod[i])), 2.8, Math.abs(f3.sy(prod[i]) - f3.sy(0)), {
      cls: 'sq ' + (prod[i] >= 0 ? 'sq-pos' : 'sq-neg'), dur: 240,
    })),
    label('ml', f3.x0 + 4, f3.y1 + 2, 'their product, point by point', { cls: 'lab-sm lab-warm' }));

  const px = 542;
  if (phase >= 3) {
    const pos = prod.filter(v => v > 0).length;
    out.push(
      numLabel('tv', px, 132, total, { cls: 'lab-big lab-green', d: 4, pre: 'total ' }),
      label('tl2', px, 154, 'the sum of all 128 products', { cls: 'lab-sm' }),
      numLabel('pv', px, 194, pos, { cls: 'lab lab-warm', d: 0, suf: ' positive' }),
      numLabel('nv', px, 216, n - pos, { cls: 'lab lab-cold', d: 0, suf: ' negative' }),
      label('vv', px, 256, Math.abs(total) > 0.1 ? 'they line up.' : 'they cancel.', {
        cls: 'lab-big lab-' + (Math.abs(total) > 0.1 ? 'green' : 'muted'),
      }),
      label('vv2', px, 278, Math.abs(total) > 0.1 ? 'this frequency is in' : 'this frequency is', { cls: 'lab-sm' }),
      label('vv3', px, 292, Math.abs(total) > 0.1 ? 'the signal.' : 'not in the signal.', { cls: 'lab-sm' }),
      numLabel('av', px, 336, component(y, k).amp, { cls: 'lab lab-cyan', d: 4, pre: 'amplitude ' }),
      label('av2', px, 356, 'cos and sin combined', { cls: 'lab-sm' }));
  }
  return out;
}

function spec(s, phase) {
  const S2 = SPEC[s.wave];
  const m = clamp(+s.harm, 1, 40);
  const n = S2.y.length;
  const f = frame({ w: 720, h: 540, l: 66, r: 40, t: 76, b: 320 });
  f.setX(0, n - 1); f.setY(-1.45, 1.45);
  const g = frame({ w: 720, h: 540, l: 66, r: 40, t: 300, b: 66 });
  const amps = S2.spec.comps.slice(0, 40).map(c => c.amp);
  g.setX(0.4, 40.6); g.setY(0, Math.max(...amps) * 1.14);

  const out = [
    { key: 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.sy(0), x2: f.x1, y2: f.sy(0) } },
    path('sig', S2.y.map((v, i) => [f.sx(i), f.sy(v)]), { cls: 'curve curve-ghost' }),
    label('sl', f.x0 + 4, f.y1 - 6, `${WAVES[s.wave].label} · in time`, { cls: 'lab lab-cyan' }),
  ];
  if (phase >= 3) out.push(path('rb', rebuild(S2.spec, m).map((v, i) => [f.sx(i), f.sy(v)]), { cls: 'curve curve-cyan' }));
  if (phase >= 2) out.push(
    { key: 'gx', tag: 'line', cls: 'ax-line', attrs: { x1: g.x0, y1: g.y0, x2: g.x1, y2: g.y0 } },
    { key: 'gy', tag: 'line', cls: 'ax-line', attrs: { x1: g.x0, y1: g.y0, x2: g.x0, y2: g.y1 } },
    ...amps.map((a, i) => rect('b' + i, g.sx(i + 1) - 3.4, g.sy(a), 6.8, g.y0 - g.sy(a), {
      cls: 'sq ' + (phase >= 3 && i >= m ? 'sq-dim' : 'sq-x'), dur: 260,
      tip: `k = ${i + 1}<br>amplitude ${a.toFixed(4)}`,
    })),
    ...[1, 5, 10, 15, 20, 25, 30, 35, 40].map(v => label('gt' + v, g.sx(v), g.y0 + 15, String(v), { cls: 'ax-tick' })),
    label('gl', (g.x0 + g.x1) / 2, g.y0 + 34, 'frequency  (turns per span)', { cls: 'ax-label' }),
    label('gl2', g.x0 + 4, g.y1 - 6, 'the same thing · in frequency', { cls: 'lab lab-gold' }),
    phase >= 3 ? label('gk', g.x1 - 4, g.y1 - 6, `keeping ${m} of 40`, { cls: 'lab-sm lab-end lab-cyan' }) : null,
  );
  return out.filter(Boolean);
}

function hidden(s, phase) {
  const { y, n, spec: sp } = HIDDEN;
  const f = frame({ w: 720, h: 540, l: 66, r: 40, t: 66, b: 316 });
  f.setX(0, n - 1);
  const m = Math.max(...y.map(Math.abs)) * 1.1;
  f.setY(-m, m);
  const g = frame({ w: 720, h: 540, l: 66, r: 40, t: 300, b: 70 });
  const amps = sp.comps.map(c => c.amp);
  g.setX(0.4, sp.comps.length + 0.6); g.setY(0, Math.max(...amps) * 1.14);
  const floor = st.median(amps);

  const out = [
    { key: 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.sy(0), x2: f.x1, y2: f.sy(0) } },
    path('sig', y.map((v, i) => [f.sx(i), f.sy(v)]), { cls: 'curve', set: { stroke: 'var(--cs-muted)', 'stroke-width': 1.2 } }),
    label('sl', f.x0 + 4, f.y1 - 6, 'two hundred noisy points', { cls: 'lab lab-muted' }),
  ];
  if (phase >= 4) {
    const two = range(n).map(t2 => sp.comps[6].at(t2) + sp.comps[18].at(t2));
    out.push(
      path('two', two.map((v, i) => [f.sx(i), f.sy(v)]), { cls: 'curve curve-fit' }),
      label('twl', f.x1 - 4, f.y1 - 6, 'the two components, alone', { cls: 'lab-sm lab-end lab-green' }));
  }
  if (phase >= 2) out.push(
    { key: 'gx', tag: 'line', cls: 'ax-line', attrs: { x1: g.x0, y1: g.y0, x2: g.x1, y2: g.y0 } },
    ...amps.map((a, i) => rect('b' + i, g.sx(i + 1) - 2.4, g.sy(a), 4.8, g.y0 - g.sy(a), {
      cls: 'sq ' + (a > 3 * floor ? 'sq-gold' : 'sq-dim'), dur: 260,
      tip: `k = ${i + 1}<br>amplitude ${a.toFixed(3)}`,
    })),
    ...[1, 7, 19, 40, 60, 80, 100].map(v => label('gt' + v, g.sx(v), g.y0 + 15, String(v), { cls: 'ax-tick' })),
    label('gl', (g.x0 + g.x1) / 2, g.y0 + 34, 'cycles per span', { cls: 'ax-label' }),
    label('gl2', g.x0 + 4, g.y1 - 6, 'the spectrum', { cls: 'lab lab-gold' }),
    numLabel('k7', g.sx(7), g.sy(amps[6]) - 12, 7, { cls: 'lab lab-mid lab-gold', d: 0, pre: 'k = ' }),
    numLabel('k19', g.sx(19), g.sy(amps[18]) - 12, 19, { cls: 'lab lab-mid lab-purple', d: 0, pre: 'k = ' }),
  );
  if (phase >= 3) out.push(
    path('fl', [[g.x0, g.sy(floor)], [g.x1, g.sy(floor)]], { cls: 'rule rule-faint rule-dash' }),
    label('fll', g.x1 - 4, g.sy(floor) - 6, 'the noise floor', { cls: 'lab-sm lab-end' }));
  return out;
}

const seasonCache = new Map();
function seasonFit(h) {
  if (seasonCache.has(h)) return seasonCache.get(h);
  const { y, n } = SEASON;
  const X = range(n).map(t2 => (h > 0 ? [t2, ...fourierTerms(t2, 12, h)] : [t2]));
  const m = st.mlr(X, y);
  const out = { m, yhat: m.fit, r2: m.r2 };
  seasonCache.set(h, out);
  return out;
}

function season(s, phase) {
  const { y, n } = SEASON;
  const h = clamp(+s.terms, 0, 5);
  const f = frame({ w: 720, h: 540, l: 68, r: 40, t: 62, b: phase >= 2 ? 274 : 78 });
  f.setX(0, n - 1);
  f.setY(Math.min(...y) - 3, Math.max(...y) + 3);

  const out = [
    { key: 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x1, y2: f.y0 } },
    { key: 'ay', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.y0, x2: f.x0, y2: f.y1 } },
    ...range(13).map(i => (i % 2 === 0 ? label('xt' + i, f.sx(i * 12), f.y0 + 16, `yr ${i}`, { cls: 'ax-tick' }) : null)),
    ...y.map((v, i) => ({
      key: 'p' + i, tag: 'circle', cls: 'pt',
      attrs: { cx: f.sx(i), cy: f.sy(v), r: 2.4 },
      set: { fill: 'var(--cs-muted)', stroke: 'none' }, opacity: 0.8,
      tip: `month ${i + 1}<br><b>${v.toFixed(1)}</b>`,
    })),
  ];
  if (phase >= 1) {
    const F = seasonFit(h);
    out.push(
      path('fit', F.yhat.map((v, i) => [f.sx(i), f.sy(v)]), { cls: 'curve curve-fit', dur: 480 }),
      label('fl', f.x0 + 6, f.y1 - 8, h === 0 ? 'trend only' : `trend + ${h} harmonic${h > 1 ? 's' : ''}  ·  ${2 + 2 * h} parameters`, { cls: 'lab-big lab-green' }),
      numLabel('r2', f.x1 - 4, f.y1 - 8, F.r2 * 100, { cls: 'lab lab-end lab-cyan', d: 1, suf: '% explained' }));
  }
  if (phase >= 2) {
    const g = frame({ w: 720, h: 540, l: 68, r: 40, t: 318, b: 70 });
    g.setX(0, 47); g.setY(-1.25, 1.25);
    out.push(
      { key: 'gx', tag: 'line', cls: 'ax-line', attrs: { x1: g.x0, y1: g.sy(0), x2: g.x1, y2: g.sy(0) } },
      label('gl', g.x0 + 4, g.y1 - 8, 'the columns handed to the regression', { cls: 'lab lab-gold' }),
      ...range(Math.max(1, h) * 2).map((c, i) => path('col' + i,
        range(48).map(t2 => [g.sx(t2), g.sy(fourierTerms(t2, 12, Math.max(1, h))[i])]), {
        cls: 'curve', set: { stroke: i % 2 ? 'var(--cs-purple)' : 'var(--cs-cyan)', 'stroke-width': 1.8 },
        opacity: 1 - Math.floor(i / 2) * 0.22,
      })),
      label('gl2', g.x1 - 4, g.y1 - 8, 'cyan: sine · purple: cosine', { cls: 'lab-sm lab-end' }),
      label('gl3', (g.x0 + g.x1) / 2, g.y0 + 30, 'four years of the seasonal columns — just numbers', { cls: 'lab-sm lab-mid' }));
  }
  return out.filter(Boolean);
}

/** the frequency a too-slow sampler will report instead of the truth */
function aliasOf(f, rate) {
  const nyq = rate / 2;
  let a = f % rate;
  if (a > nyq) a = rate - a;
  return a;
}

function alias(s) {
  const rate = clamp(+s.rate, 4, 40), F = clamp(+s.freq, 1, 9);
  const f = frame({ w: 720, h: 540, l: 66, r: 200, t: 84, b: 120 });
  f.setX(0, 1); f.setY(-1.3, 1.3);
  const al = aliasOf(F, rate);
  const samples = range(rate + 1).map(i => {
    const x = i / rate;
    return [x, Math.sin(TAU * F * x)];
  });
  const fake = al > 0.01 ? range(300).map(i => { const x = i / 299; return [f.sx(x), f.sy(Math.sin(TAU * al * x + (Math.abs(al - F) > 0.01 ? Math.PI * ((Math.round(F / rate) * 2) % 2) : 0)))]; }) : null;

  return [
    { key: 'ax', tag: 'line', cls: 'ax-line', attrs: { x1: f.x0, y1: f.sy(0), x2: f.x1, y2: f.sy(0) } },
    path('true', range(400).map(i => { const x = i / 399; return [f.sx(x), f.sy(Math.sin(TAU * F * x))]; }),
      { cls: 'curve', set: { stroke: 'var(--cs-muted)', 'stroke-width': 1.4 }, opacity: 0.6 }),
    Math.abs(al - F) > 0.05 && fake ? path('alias', fake, { cls: 'curve curve-warm' }) : null,
    ...samples.map((p, i) => ({
      key: 'sm' + i, tag: 'circle', cls: 'pt pt-cyan',
      attrs: { cx: f.sx(p[0]), cy: f.sy(p[1]), r: 5.5 },
      tip: `sample ${i}<br>${p[1].toFixed(3)}`,
    })),
    ...samples.map((p, i) => path('st' + i, [[f.sx(p[0]), f.sy(0)], [f.sx(p[0]), f.sy(p[1])]], {
      cls: 'stick', set: { stroke: 'var(--cs-cyan)', 'stroke-width': 1 }, opacity: 0.4,
    })),
    label('tl', f.x0 + 4, f.y1 - 12, `true wave: ${F} turns`, { cls: 'lab-sm' }),
    label('sl', f.x0 + 4, f.y0 + 26, `${rate} samples · nyquist limit ${(rate / 2).toFixed(1)}`, { cls: 'lab-sm lab-cyan' }),
    numLabel('av', 536, 150, al, { cls: 'lab-big lab-warm', d: 1, pre: 'you measure ' }),
    label('av2', 536, 172, 'turns per span', { cls: 'lab-sm' }),
    numLabel('tv', 536, 210, F, { cls: 'lab lab-muted', d: 0, pre: 'the truth is ' }),
    label('vd', 536, 258, F <= rate / 2 ? 'sampled fast enough' : 'aliased', {
      cls: 'lab-big lab-' + (F <= rate / 2 ? 'green' : 'warm'),
    }),
    F > rate / 2 ? [
      label('w1', 536, 292, 'the red wave fits every', { cls: 'lab-sm lab-warm' }),
      label('w2', 536, 306, 'sample exactly, and it', { cls: 'lab-sm lab-warm' }),
      label('w3', 536, 320, 'is not there.', { cls: 'lab-sm lab-warm' }),
      label('w4', 536, 348, 'nothing in the data can', { cls: 'lab-sm' }),
      label('w5', 536, 362, 'tell you which is which.', { cls: 'lab-sm' }),
    ] : null,
  ].flat().filter(Boolean);
}
