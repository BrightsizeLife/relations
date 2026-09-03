/* ─────────────────────────────────────────────────────────────────────────────
   stage.js — the lesson runner.

   Layout: a sticky drawing on the left, a column of steps you scroll through on
   the right. Scrolling picks the step. Each step is a list of *beats* — the one
   micro-move at a time, replayable. Controls and readouts live under the
   drawing so you can fiddle while you read.
   ───────────────────────────────────────────────────────────────────────────── */

import { h, S, clear, makeScene, setNum, qsa, qs, stopAllTweens, clamp, reduceMotion, caps } from './dom.js';
import { applyGlossary, termCard } from './terms.js';

const isTouch = matchMedia('(hover: none)').matches;

export function mountLesson(root, lesson, { onNav } = {}) {
  clear(root);
  const state = structuredClone(lesson.state ?? {});
  if (lesson.init) lesson.init(state);

  const size = lesson.canvas || { w: 680, h: 500 };
  const steps = lesson.steps.map((s, i) => ({
    ...s,
    idx: i,
    beats: s.beats || [{ label: s.title, scene: s.scene, hold: s.hold }],
  }));

  /* ── shell ──────────────────────────────────────────────────────────────── */

  const noteId = `${lesson.meta.id}-beat-note`;
  const svg = S('svg', {
    class: 'cs-canvas', viewBox: `0 0 ${size.w} ${size.h}`,
    preserveAspectRatio: 'xMidYMid meet', role: 'img', tabindex: '0',
    'aria-label': `Diagram for ${lesson.meta.title}`,
    'aria-describedby': noteId,
  });
  const defs = S('defs', {}, ...(lesson.defs ? lesson.defs() : []));
  const sceneG = S('g', { class: 'scene' });
  svg.append(defs, sceneG);
  const scene = makeScene(sceneG);

  const beatLabel = h('div', { class: 'cs-beat-label' });
  const beatDots = h('div', { class: 'cs-beat-dots' });
  const btnPrev = h('button', { class: 'cs-mini-btn', title: 'previous micro-step (←)', 'aria-label': 'previous micro-step' }, '‹');
  const btnNext = h('button', { class: 'cs-mini-btn', title: 'next micro-step (→)', 'aria-label': 'next micro-step' }, '›');
  const btnReplay = h('button', { class: 'cs-mini-btn cs-replay', title: 'replay this step' }, '↺ replay');
  const beatBar = h('div', {
    class: 'cs-beatbar', role: 'group', 'aria-label': 'micro-steps of this step',
  }, btnPrev, beatDots, btnNext, btnReplay);

  const readoutStrip = h('div', { class: 'cs-readouts' });
  const controlDeck = h('div', { class: 'cs-controls' });
  const tip = h('div', { class: 'cs-tip', role: 'tooltip' });

  const stageCol = h('div', { class: 'cs-stage' },
    h('div', { class: 'cs-canvas-wrap' }, svg, tip),
    beatBar, readoutStrip, controlDeck,
    h('div', { class: 'cs-beat-note' })
  );
  const beatNote = qs('.cs-beat-note', stageCol);
  beatNote.id = noteId;
  beatNote.setAttribute('role', 'status');
  beatNote.setAttribute('aria-live', 'polite');

  const stepCol = h('div', { class: 'cs-steps' });
  const rail = h('nav', { class: 'cs-rail', 'aria-label': 'steps in this lesson' });

  const header = h('header', { class: 'cs-lesson-head' },
    h('div', { class: 'cs-kicker cs-lesson-kicker' }, lesson.meta.kicker || ''),
    h('h1', { class: 'cs-lesson-title' }, lesson.meta.title),
    h('p', { class: 'cs-lesson-deck', html: lesson.meta.deck || '' }),
    lesson.meta.dataNote ? h('p', { class: 'cs-datasource', html: lesson.meta.dataNote }) : null,
    depsBar(lesson.meta, onNav),
  );

  applyGlossary(qs('.cs-lesson-deck', header));

  root.append(header, h('div', { class: 'cs-lesson-body' }, stageCol, h('div', { class: 'cs-steps-wrap' }, rail, stepCol)));

  /* ── steps ──────────────────────────────────────────────────────────────── */

  const cards = steps.map(step => {
    const card = h('section', {
      class: 'cs-step', id: `${lesson.meta.id}-step-${step.idx}`, 'data-step': step.idx,
    },
      h('div', { class: 'cs-step-num' }, String(step.idx + 1).padStart(2, '0')),
      h('h2', { class: 'cs-step-title' }, step.title),
      h('div', { class: 'cs-step-prose', html: step.prose || '' }),
      step.formula ? h('div', { class: 'cs-step-formula', html: step.formula }) : null,
      step.aside ? h('div', { class: 'cs-aside', html: step.aside }) : null,
      step.dep ? depChip(step.dep, onNav) : null,
    );
    qsa('.cs-step-prose, .cs-aside', card).forEach(el => applyGlossary(el));
    stepCol.appendChild(card);
    return card;
  });

  steps.forEach(step => {
    const dot = h('button', {
      class: 'cs-rail-dot', title: step.title, 'data-step': step.idx,
      'aria-label': `step ${step.idx + 1}: ${step.title}`,
      onclick: () => cards[step.idx].scrollIntoView({
        behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center',
      }),
    });
    rail.appendChild(dot);
  });

  stepCol.appendChild(h('div', { class: 'cs-step-end' },
    h('div', { class: 'cs-step-end-mark' }, '///'),
    h('p', { html: lesson.meta.outro || 'that\'s the whole calculation. nothing left in the box.' }),
    lesson.meta.next ? h('button', {
      class: 'cs-data-cta', onclick: () => onNav && onNav(lesson.meta.next),
    }, `[next: ${lesson.meta.nextLabel || lesson.meta.next}]`) : null,
  ));

  /* ── render loop ────────────────────────────────────────────────────────── */

  let cur = 0, beat = 0, timers = [], played = new Set();

  const ctx = {
    state,
    get step() { return steps[cur]; },
    get beat() { return beat; },
    refresh: () => draw(),
    scene,
    svg,
    size,
  };

  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function draw(opts = {}) {
    const step = steps[cur];
    const b = step.beats[Math.min(beat, step.beats.length - 1)];
    const items = (b.scene ? b.scene(state, { ...ctx, beat, replay: opts.replay }) : []) || [];
    scene.update(items.flat(3).filter(Boolean), { dur: opts.dur });
    beatNote.innerHTML = b.note || '';
    beatNote.classList.toggle('is-empty', !b.note);
    const where = step.beats.length > 1
      ? `, micro-step ${beat + 1} of ${step.beats.length}${b.label ? ': ' + b.label : ''}`
      : '';
    svg.setAttribute('aria-label',
      `${lesson.meta.title}, step ${cur + 1} of ${steps.length}: ${step.title}${where}`);
    renderBeatBar(step);
    renderReadouts(step);
    // a control can move another control's value (a preset button setting two
    // sliders); re-syncing here keeps the deck honest about the live state
    renderControls(step);
  }

  function renderBeatBar(step) {
    const n = step.beats.length;
    beatBar.style.display = n > 1 ? '' : 'none';
    if (n <= 1) return;
    clear(beatDots);
    for (let i = 0; i < n; i++) {
      const name = step.beats[i].label || `micro-step ${i + 1}`;
      beatDots.appendChild(h('button', {
        class: 'cs-beat-dot' + (i === beat ? ' active' : '') + (i < beat ? ' done' : ''),
        title: name, 'aria-label': `micro-step ${i + 1} of ${n}: ${name}`,
        'aria-current': i === beat ? 'true' : 'false',
        onclick: () => { clearTimers(); beat = i; draw(); },
      }));
    }
    beatLabel.textContent = step.beats[beat].label || '';
    btnPrev.disabled = beat === 0;
    btnNext.disabled = beat === n - 1;
  }

  let readoutEls = new Map();
  function renderReadouts(step) {
    const defs = step.readouts || lesson.readouts || [];
    const wanted = defs.map(r => r.key || r.label);
    const same = wanted.length === readoutEls.size && wanted.every(k => readoutEls.has(k));
    if (!same) {
      clear(readoutStrip);
      readoutEls = new Map();
      defs.forEach(r => {
        const val = h('span', { class: 'cs-ro-val' + (r.tone ? ' tone-' + r.tone : '') }, '—');
        const box = h('div', {
          class: 'cs-ro' + (r.wide ? ' wide' : ''),
          'data-explain': r.explain || null,
          'data-link': r.link || null,
          role: 'group',
          'aria-label': String(r.label ?? r.key ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
          tabindex: r.explain ? '0' : null,
        },
          h('span', { class: 'cs-ro-label', html: caps(r.label) }), val);
        readoutStrip.appendChild(box);
        readoutEls.set(r.key || r.label, val);
      });
    }
    readoutStrip.style.display = defs.length ? '' : 'none';
    defs.forEach(r => {
      const el = readoutEls.get(r.key || r.label);
      let v;
      try { v = r.get(state, ctx); } catch { v = NaN; }
      if (typeof v === 'string') { el.textContent = v; return; }
      setNum(el, v, { d: r.d ?? 2, pre: r.pre || '', suf: r.suf || '', fmt: r.fmt });
    });
  }

  /* ── controls ───────────────────────────────────────────────────────────── */

  let controlSig = '';
  function renderControls(step) {
    const defs = step.controls || lesson.controls || [];
    const sig = JSON.stringify(defs.map(c => [c.key, c.label, c.type, c.options]));
    if (sig === controlSig) { syncControls(defs); return; }
    controlSig = sig;
    clear(controlDeck);
    controlDeck.style.display = defs.length ? '' : 'none';
    defs.forEach(c => {
      // a step can narrow a slider's range (k starts at 2 where k−1 is a
      // divisor); pull the carried-over value inside it before drawing
      if (c.type === 'slider') state[c.key] = clamp(+state[c.key], c.min, c.max);
      if (c.type === 'segment') {
        const vals = c.options.map(o => String(o.value ?? o));
        if (!vals.includes(String(state[c.key]))) {
          const v = c.options[0].value ?? c.options[0];
          state[c.key] = typeof v === 'number' ? +v : v;
        }
      }
      controlDeck.appendChild(buildControl(c));
    });
  }

  function syncControls(defs) {
    defs.forEach(c => {
      const el = qs(`[data-ctl="${c.key}"]`, controlDeck);
      if (!el) return;
      const v = state[c.key];
      if (c.type === 'toggle') {
        el.classList.toggle('active', !!v);
        el.setAttribute('aria-pressed', String(!!v));
      }
      else if (c.type === 'slider' && el.value != v) {
        el.value = v;
        const out = qs(`[data-ctlval="${c.key}"]`, controlDeck);
        if (out) out.textContent = c.fmt ? c.fmt(v) : v;
      } else if (c.type === 'segment') {
        qsa('button', el).forEach(b => {
          const on = b.dataset.val === String(v);
          b.classList.toggle('active', on);
          b.setAttribute('aria-checked', String(on));
        });
      }
    });
  }

  function buildControl(c) {
    const commit = v => {
      state[c.key] = v;
      c.onChange && c.onChange(state, ctx);
      draw({ dur: c.fast ? 220 : undefined });
    };
    if (c.type === 'slider') {
      const out = h('span', { class: 'cs-ctl-val', 'data-ctlval': c.key },
        c.fmt ? c.fmt(state[c.key]) : String(state[c.key]));
      const input = h('input', {
        type: 'range', class: 'cs-slider', 'data-ctl': c.key,
        'aria-label': String(c.label).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
        min: c.min, max: c.max, step: c.step ?? 1, value: state[c.key],
        oninput: e => {
          const v = +e.target.value;
          out.textContent = c.fmt ? c.fmt(v) : String(v);
          commit(v);
        },
      });
      return h('label', { class: 'cs-ctl cs-ctl-slider' },
        h('span', { class: 'cs-ctl-label', html: c.label }, ), input, out);
    }
    if (c.type === 'toggle') {
      return h('button', {
        class: 'cs-data-toggle' + (state[c.key] ? ' active' : ''), 'data-ctl': c.key,
        'aria-pressed': String(!!state[c.key]),
        onclick: e => {
          commit(!state[c.key]);
          e.currentTarget.classList.toggle('active', !!state[c.key]);
          e.currentTarget.setAttribute('aria-pressed', String(!!state[c.key]));
        },
        'data-explain': c.explain || null,
      }, c.label);
    }
    if (c.type === 'segment') {
      const plain = String(c.label || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const wrap = h('div', {
        class: 'cs-segment', 'data-ctl': c.key,
        role: 'radiogroup', 'aria-label': plain || c.key,
      });
      c.options.forEach(o => {
        const val = o.value ?? o;
        wrap.appendChild(h('button', {
          class: 'cs-seg-btn' + (String(state[c.key]) === String(val) ? ' active' : ''),
          'data-val': String(val), 'data-explain': o.explain || null,
          role: 'radio', 'aria-checked': String(String(state[c.key]) === String(val)),
          onclick: () => {
            qsa('button', wrap).forEach(b => {
              const on = b.dataset.val === String(val);
              b.classList.toggle('active', on);
              b.setAttribute('aria-checked', String(on));
            });
            commit(typeof val === 'number' ? +val : val);
          },
        }, o.label ?? String(o)));
      });
      return h('div', { class: 'cs-ctl' }, c.label ? h('span', { class: 'cs-ctl-label', html: c.label }) : null, wrap);
    }
    if (c.type === 'button') {
      return h('button', {
        class: 'cs-data-toggle', onclick: () => { c.action(state, ctx); draw(); },
      }, c.label);
    }
    return h('span');
  }

  /* ── beats ──────────────────────────────────────────────────────────────── */

  function playFrom(i = 0) {
    clearTimers();
    const step = steps[cur];
    // asked not to be animated at: land on the finished picture and leave the
    // dots there to walk back through at the reader's own pace
    if (reduceMotion()) { beat = step.beats.length - 1; draw({ dur: 0 }); return; }
    beat = i;
    draw();
    let acc = 0;
    for (let k = i + 1; k < step.beats.length; k++) {
      acc += step.beats[k - 1].hold ?? 1150;
      timers.push(setTimeout(() => { beat = k; draw(); }, acc));
    }
  }

  function replay() {
    clearTimers();
    scene.clear();
    playFrom(0);
  }

  btnPrev.onclick = () => { clearTimers(); beat = Math.max(0, beat - 1); draw(); };
  btnNext.onclick = () => { clearTimers(); beat = Math.min(steps[cur].beats.length - 1, beat + 1); draw(); };
  btnReplay.onclick = replay;

  function goStep(i, { autoplay = true } = {}) {
    if (i === cur) return;
    cur = i;
    clearTimers();
    renderControls(steps[cur]);
    cards.forEach((c, k) => c.classList.toggle('active', k === i));
    qsa('.cs-rail-dot', rail).forEach((d, k) => {
      d.classList.toggle('active', k === i);
      d.classList.toggle('done', k < i);
    });
    if (autoplay && !played.has(i) && steps[i].beats.length > 1) {
      played.add(i);
      playFrom(0);
    } else {
      beat = steps[i].beats.length - 1 >= 0 && played.has(i) ? beat : 0;
      beat = Math.min(beat, steps[i].beats.length - 1);
      if (!played.has(i)) { played.add(i); beat = 0; }
      draw();
    }
  }

  /* ── scroll wiring ──────────────────────────────────────────────────────── */

  const io = new IntersectionObserver(entries => {
    let best = null;
    entries.forEach(e => { if (e.isIntersecting && (!best || e.intersectionRatio > best.intersectionRatio)) best = e; });
    if (!best) return;
    goStep(+best.target.dataset.step);
  }, { rootMargin: '-42% 0px -42% 0px', threshold: [0, 0.01, 0.5, 1] });
  cards.forEach(c => io.observe(c));

  /* ── tooltips + formula↔drawing linking ─────────────────────────────────── */

  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.classList.add('show');
    const wrap = qs('.cs-canvas-wrap', stageCol).getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = x - wrap.left + 14, top = y - wrap.top - th - 12;
    if (left + tw > wrap.width - 6) left = x - wrap.left - tw - 14;
    if (top < 4) top = y - wrap.top + 18;
    tip.style.left = Math.max(4, left) + 'px';
    tip.style.top = Math.max(4, top) + 'px';
  }
  const hideTip = () => tip.classList.remove('show');

  svg.addEventListener('pointermove', e => {
    const el = e.target.closest('[data-tip]');
    if (!el) { hideTip(); return; }
    showTip(el.getAttribute('data-tip'), e.clientX, e.clientY);
  });
  svg.addEventListener('pointerleave', hideTip);

  // one popover for both formula terms and readouts, anywhere in the lesson
  const pop = h('div', { class: 'cs-pop', role: 'tooltip' });
  root.appendChild(pop);
  function showPop(el) {
    const key = el.getAttribute('data-term');
    if (key) {
      const card = termCard(key, lesson.meta.id);
      if (!card) return;
      pop.innerHTML = card;
      pop.classList.add('is-term');
    } else {
      const txt = el.getAttribute('data-explain');
      if (!txt) return;
      pop.textContent = txt;
      pop.classList.remove('is-term');
    }
    pop.classList.add('show');
    const r = el.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    let left = r.left - rr.left + r.width / 2 - pop.offsetWidth / 2;
    left = Math.max(8, Math.min(left, rr.width - pop.offsetWidth - 8));
    pop.style.left = left + 'px';
    pop.style.top = (r.top - rr.top - pop.offsetHeight - 10) + 'px';
  }
  const hidePop = () => pop.classList.remove('show');

  function setHighlight(name) {
    sceneG.classList.toggle('has-hl', !!name);
    qsa('[class*="link-"]', sceneG).forEach(el => el.classList.remove('hot'));
    if (!name) return;
    qsa('.link-' + name, sceneG).forEach(el => el.classList.add('hot'));
  }

  root.addEventListener('pointerover', e => {
    const ex = e.target.closest('[data-explain],[data-term]');
    if (ex) showPop(ex);
    const lk = e.target.closest('[data-link]');
    if (lk) setHighlight(lk.getAttribute('data-link'));
  });
  root.addEventListener('pointerout', e => {
    if (e.target.closest('[data-explain],[data-term]')) hidePop();
    if (e.target.closest('[data-link]')) setHighlight(null);
  });
  root.addEventListener('focusin', e => {
    const ex = e.target.closest('[data-explain],[data-term]');
    if (ex) showPop(ex);
    const lk = e.target.closest('[data-link]');
    if (lk) setHighlight(lk.getAttribute('data-link'));
  });
  root.addEventListener('focusout', () => { hidePop(); setHighlight(null); });

  const onKey = e => {
    if (e.target.matches('input,textarea')) return;
    if (e.key === 'ArrowRight') { btnNext.click(); }
    else if (e.key === 'ArrowLeft') { btnPrev.click(); }
    else if (e.key.toLowerCase() === 'r') { replay(); }
  };
  window.addEventListener('keydown', onKey);

  /* ── go ─────────────────────────────────────────────────────────────────── */

  renderControls(steps[0]);
  cards[0].classList.add('active');
  qsa('.cs-rail-dot', rail)[0]?.classList.add('active');
  played.add(0);
  requestAnimationFrame(() => playFrom(0));

  return {
    destroy() {
      io.disconnect();
      clearTimers();
      stopAllTweens();
      window.removeEventListener('keydown', onKey);
      clear(root);
    },
  };
}

/* ── dependency chrome ────────────────────────────────────────────────────── */

function depsBar(meta, onNav) {
  const needs = meta.deps || [];
  const gives = meta.unlocks || [];
  if (!needs.length && !gives.length) return null;
  const chip = (id, kind) => h('button', {
    class: 'cs-dep-chip ' + kind,
    onclick: () => onNav && onNav(id),
  }, id.replace(/-/g, ' '));
  return h('div', { class: 'cs-deps-bar' },
    needs.length ? h('div', { class: 'cs-deps-group' },
      h('span', { class: 'cs-data-label' }, 'builds on'),
      ...needs.map(d => chip(d, 'needs'))) : null,
    gives.length ? h('div', { class: 'cs-deps-group' },
      h('span', { class: 'cs-data-label' }, 'feeds'),
      ...gives.map(d => chip(d, 'gives'))) : null,
  );
}

function depChip(dep, onNav) {
  return h('div', { class: 'cs-step-dep' },
    h('span', { class: 'cs-step-dep-mark' }, '↳'),
    h('span', { html: dep.note }),
    dep.lesson ? h('button', {
      class: 'cs-dep-chip needs', onclick: () => onNav && onNav(dep.lesson),
    }, dep.label || dep.lesson.replace(/-/g, ' ')) : null,
  );
}
