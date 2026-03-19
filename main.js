/**
 * main.js — Sanara's Relyenong Bangus (v5)
 *
 * Beat behaviour:
 *   - Active beat = large text bottom-left (clip-path reveal)
 *   - Past beats  = small italic chips stacked top-right, slide in from right
 *   - On scroll UP, chips lose .visible and slide back out
 *
 * Outro:
 *   - After last frame, the video stays frozen fullscreen
 *   - Extra scroll budget drives the outro panel sliding UP from the bottom
 *   - The page never visually scrolls away — viewport stays on the video
 */

(() => {
  'use strict';

  /* ─── CONFIG ────────────────────────────────────────────────── */
  const TOTAL_FRAMES  = 220;
  const PX_PER_FRAME  = 36;
  const OUTRO_SCROLL  = 600;   // extra px of scroll budget for outro slide-up
  const LERP_FACTOR   = 0.12;
  const FRAME_DIR     = 'relyeno frames';
  const FRAME_PREFIX  = 'ezgif-frame-';
  const FRAME_EXT     = '.jpg';
  const NATIVE_W      = 3840;
  const NATIVE_H      = 2204;
  const ASPECT        = NATIVE_W / NATIVE_H;

  const BEATS = [
    {
      start: 1,   end: 55,
      eyebrow:  'Straight from the kitchen',
      headline: ['Pure veggies', 'and <em>bangus</em>'],
      sub:      'Crafted with love — packed with fresh vegetables and premium milkfish.',
      chipLabel: 'Pure veggies and bangus',
    },
    {
      start: 57,  end: 110,
      eyebrow:  'The original. The best.',
      headline: ['Your number 1', '<em>relyeno</em>'],
      sub:      'Nothing else compares to the taste you grew up loving.',
      chipLabel: 'Your number 1 relyeno',
    },
    {
      start: 112,  end: 165,
      eyebrow:  'Every single bite',
      headline: ['Taste the', '<em>difference</em>'],
      sub:      'Every ingredient chosen with care. Every bite tells the story of tradition.',
      chipLabel: 'Taste the difference',
    },
    {
      start: 167,  end: 220,
      eyebrow:  'Ready to order?',
      headline: ['Order now', 'at <em>Sanara\'s</em>'],
      sub:      'Relyenong Bangus — freshly made, always delicious.',
      chipLabel: 'Order now at Sanara\'s',
    },
  ];

  /* ─── REFS ──────────────────────────────────────────────────── */
  const preloader     = document.getElementById('preloader');
  const loaderFill    = document.getElementById('loader-fill');
  const spacer        = document.getElementById('scroll-spacer');
  const stage         = document.getElementById('stage');
  const canvas        = document.getElementById('frame-canvas');
  const ctx           = canvas.getContext('2d');
  const progressBar   = document.getElementById('progress-bar');
  const scrollHint    = document.getElementById('scroll-hint');
  const ctaBtn        = document.getElementById('cta-btn');
  const beatPanel     = document.getElementById('beat-panel');
  const pastBeatsArea = document.getElementById('past-beats-area');
  const stageFlash    = document.getElementById('stage-flash');
  const outroPanel    = document.getElementById('outro-panel');

  /* ─── STATE ─────────────────────────────────────────────────── */
  const images     = new Array(TOTAL_FRAMES);
  let currentFrame = 0;
  let targetFrame  = 0;
  let activeBeat   = -1;
  let canvasCSSW   = 0;
  let canvasCSSH   = 0;

  /* ─── BUILD BEAT LAYERS ─────────────────────────────────────── */
  const layers = BEATS.map((beat) => {
    const layer = document.createElement('div');
    layer.className = 'beat-layer is-future';

    const rule = document.createElement('div');
    rule.className = 'beat-rule';
    layer.appendChild(rule);

    const eyebrow = document.createElement('div');
    eyebrow.className = 'beat-eyebrow';
    eyebrow.textContent = beat.eyebrow;
    layer.appendChild(eyebrow);

    const headline = document.createElement('div');
    headline.className = 'beat-headline';
    beat.headline.forEach((lineHTML) => {
      const lineEl = document.createElement('span');
      lineEl.className = 'beat-headline-line';
      lineEl.innerHTML = lineHTML;
      headline.appendChild(lineEl);
    });
    layer.appendChild(headline);

    const sub = document.createElement('div');
    sub.className = 'beat-sub';
    sub.textContent = beat.sub;
    layer.appendChild(sub);

    beatPanel.appendChild(layer);
    return layer;
  });

  /* ─── BUILD PAST CHIPS ──────────────────────────────────────── */
  const chips = BEATS.map((beat, i) => {
    const chip = document.createElement('div');
    chip.className = 'past-chip';
    chip.style.setProperty('--i', i);

    const eyebrow = document.createElement('div');
    eyebrow.className = 'chip-eyebrow';
    eyebrow.textContent = beat.eyebrow;
    chip.appendChild(eyebrow);

    const text = document.createElement('div');
    text.className = 'chip-text';
    text.textContent = beat.chipLabel;
    chip.appendChild(text);

    const rule = document.createElement('div');
    rule.className = 'chip-rule';
    chip.appendChild(rule);

    pastBeatsArea.appendChild(chip);
    return chip;
  });

  /* ─── SET PANEL MIN-HEIGHT ──────────────────────────────────── */
  function updatePanelHeight() {
    let maxH = 0;
    layers.forEach(layer => {
      const origPos = layer.style.position;
      layer.style.position = 'relative';
      const h = layer.offsetHeight;
      layer.style.position = origPos;
      if (h > maxH) maxH = h;
    });
    if (maxH > 0) beatPanel.style.minHeight = maxH + 'px';
  }

  /* ─── UPDATE TEXT & CHIPS ───────────────────────────────────── */
  function updateText(beatIndex) {
    if (beatIndex === activeBeat) return;

    const prev = activeBeat;
    activeBeat = beatIndex;

    layers.forEach((layer, i) => {
      layer.classList.remove('is-active', 'is-past', 'is-future');
      if      (i < beatIndex)  layer.classList.add('is-past');
      else if (i === beatIndex) layer.classList.add('is-active');
      else                      layer.classList.add('is-future');
    });

    chips.forEach((chip, i) => {
      if (i < beatIndex) chip.classList.add('visible');
      else               chip.classList.remove('visible');
    });

    if (prev !== -1 && stageFlash) {
      stageFlash.classList.add('flash');
      requestAnimationFrame(() =>
        requestAnimationFrame(() => stageFlash.classList.remove('flash'))
      );
    }
  }

  /* ─── BEAT DETECTION ────────────────────────────────────────── */
  function getBeat(frame1) {
    let found = 0;
    for (let i = 0; i < BEATS.length; i++) {
      if (frame1 >= BEATS[i].start) found = i;
    }
    return found;
  }

  /* ─── FRAME PATH ────────────────────────────────────────────── */
  function framePath(n) {
    return `${FRAME_DIR}/${FRAME_PREFIX}${String(n).padStart(3, '0')}${FRAME_EXT}`;
  }

  /* ─── PRELOAD ───────────────────────────────────────────────── */
  function preloadFrames() {
    return new Promise(resolve => {
      let loaded = 0;
      for (let i = 0; i < TOTAL_FRAMES; i++) {
        const img = new Image();
        img.src = framePath(i + 1);
        img.onload = img.onerror = () => {
          loaded++;
          loaderFill.style.width = (loaded / TOTAL_FRAMES * 100) + '%';
          if (loaded === TOTAL_FRAMES) resolve();
        };
        images[i] = img;
      }
    });
  }

  /* ─── CANVAS SIZING ─────────────────────────────────────────── */
  function resizeCanvas() {
    const vw  = stage.clientWidth;
    const vh  = stage.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    let cssW, cssH;
    if (vw / vh > ASPECT) {
      cssH = vh; cssW = Math.round(vh * ASPECT);
    } else {
      cssW = vw; cssH = Math.round(vw / ASPECT);
    }

    canvasCSSW = cssW; canvasCSSH = cssH;
    canvas.style.width  = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width  = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFrame(Math.round(currentFrame));
  }

  /* ─── DRAW FRAME ────────────────────────────────────────────── */
  function drawFrame(index) {
    const img = images[index];
    if (!img || !img.naturalWidth) return;
    ctx.clearRect(0, 0, canvasCSSW, canvasCSSH);
    ctx.drawImage(img, 0, 0, canvasCSSW, canvasCSSH);
  }

  /* ─── OUTRO SLIDE ───────────────────────────────────────────── */
function updateOutro(outroProgress) {
    if (outroProgress <= 0) {
      outroPanel.style.transform = 'translateY(100vh)';
      outroPanel.style.opacity   = '0';
      canvas.style.transform     = 'translate(-50%, -50%) scale(1)';
      canvas.style.opacity       = '1';
    } else {
      const translateY    = (1 - outroProgress) * 100;
      const panelOpacity  = Math.min(1, outroProgress * 2);
      const scale         = 1 - (outroProgress * 0.15);
      const canvasOpacity = Math.max(0, 1 - outroProgress * 1.5); // fades out by ~67% progress
      outroPanel.style.transform = `translateY(${translateY}vh)`;
      outroPanel.style.opacity   = String(panelOpacity);
      canvas.style.transform     = `translate(-50%, -50%) scale(${scale})`;
      canvas.style.opacity       = String(canvasOpacity);
    }
  }

  /* ─── RAF LOOP ──────────────────────────────────────────────── */
  function tick() {
    const delta = targetFrame - currentFrame;
    currentFrame = Math.abs(delta) > 0.05
      ? currentFrame + delta * LERP_FACTOR
      : targetFrame;

    const idx = Math.min(Math.round(currentFrame), TOTAL_FRAMES - 1);
    drawFrame(idx);
    updateText(getBeat(idx + 1));
    requestAnimationFrame(tick);
  }

  /* ─── SCROLL ────────────────────────────────────────────────── */
function onScroll() {
    const scrollTop      = window.scrollY || document.documentElement.scrollTop;
    const maxScrollable  = document.body.scrollHeight - window.innerHeight;
    const frameScrollMax = maxScrollable - OUTRO_SCROLL;

    // Frame progress
    const frameProgress = Math.max(0, Math.min(1, scrollTop / frameScrollMax));
    targetFrame = Math.min(Math.floor(frameProgress * TOTAL_FRAMES), TOTAL_FRAMES - 1);

    // Outro progress
    const outroRaw      = scrollTop - frameScrollMax;
    const outroProgress = Math.max(0, Math.min(1, outroRaw / OUTRO_SCROLL));
    updateOutro(outroProgress);

    // Fade beat panel + chips
    const beatOpacity = outroProgress > 0.1
      ? Math.max(0, 1 - (outroProgress - 0.1) / 0.3)
      : 1;
    beatPanel.style.opacity     = String(beatOpacity);
    pastBeatsArea.style.opacity = String(beatOpacity);

    // Progress bar
    const totalProgress = Math.max(0, Math.min(1, scrollTop / maxScrollable));
    progressBar.style.width = (totalProgress * 100) + '%';

    if (scrollTop > 40) scrollHint.classList.add('hidden');
    else                scrollHint.classList.remove('hidden');

    ctaBtn.classList.toggle('visible', frameProgress > 0.06);
  }

  /* ─── INIT ──────────────────────────────────────────────────── */
  async function init() {
    spacer.style.height = (TOTAL_FRAMES * PX_PER_FRAME + OUTRO_SCROLL) + 'px';

    await preloadFrames();
    await new Promise(r => setTimeout(r, 250));
    preloader.classList.add('hidden');

    resizeCanvas();
    drawFrame(0);
    updateText(0);
    updateOutro(0);

    requestAnimationFrame(() => updatePanelHeight());

    tick();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => {
      resizeCanvas();
      requestAnimationFrame(() => updatePanelHeight());
    }, { passive: true });
  }

  init().catch(console.error);
})();