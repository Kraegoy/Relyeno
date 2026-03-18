/**
 * main.js — Sanara's Relyenong Bangus (v3)
 *
 * Beat behaviour:
 *   - Active beat = large text bottom-left (clip-path reveal)
 *   - Past beats  = small italic chips stacked top-left, slide in from left
 *   - On scroll UP, chips lose .visible and slide back out
 *   - Beat 0 (first beat) never becomes a chip — it only shows as active
 *     then fades away when beat 1 takes over, restoring on scroll up
 */

(() => {
  'use strict';

  /* ─── CONFIG ────────────────────────────────────────────────── */
  const TOTAL_FRAMES = 151;
  const PX_PER_FRAME = 36;
  const LERP_FACTOR  = 0.12;
  const FRAME_DIR    = 'relyeno frames';
  const FRAME_PREFIX = 'ezgif-frame-';
  const FRAME_EXT    = '.jpg';
  const NATIVE_W     = 3840;
  const NATIVE_H     = 2204;
  const ASPECT       = NATIVE_W / NATIVE_H;

  const BEATS = [
    {
      start: 1,   end: 30,
      eyebrow:  'Straight from the kitchen',
      headline: ['Pure veggies', 'and <em>bangus</em>'],
      sub:      'Crafted with love — packed with fresh vegetables and premium milkfish.',
      chipLabel: 'Pure veggies and bangus',
    },
    {
      start: 32,  end: 65,
      eyebrow:  'The original. The best.',
      headline: ['Your number 1', '<em>relyeno</em>'],
      sub:      'Nothing else compares to the taste you grew up loving.',
      chipLabel: 'Your number 1 relyeno',
    },
    {
      start: 67,  end: 95,
      eyebrow:  'Every single bite',
      headline: ['Taste the', '<em>difference</em>'],
      sub:      'Every ingredient chosen with care. Every bite tells the story of tradition.',
      chipLabel: 'Taste the difference',
    },
    {
      start: 97,  end: 151,
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
  const outroEl       = document.getElementById('outro');
  const stageFlash    = document.getElementById('stage-flash');

  /* ─── STATE ─────────────────────────────────────────────────── */
  const images     = new Array(TOTAL_FRAMES);
  let currentFrame = 0;
  let targetFrame  = 0;
  let activeBeat   = -1;
  let canvasCSSW   = 0;
  let canvasCSSH   = 0;

  /* ─── BUILD BEAT LAYERS (bottom-left active panel) ──────────── */
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

  /* ─── BUILD PAST CHIPS (top-left area) ─────────────────────── */
  /*
    One chip per beat. All chips exist in DOM always.
    JS toggles .visible based on whether beat index < activeBeat.
    --i is the stagger index for enter transition-delay.
  */
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
    // Measure each layer's natural height and set the panel tall enough
    let maxH = 0;
    layers.forEach(layer => {
      // Briefly make it block-positioned so offsetHeight works
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

    // Update beat layers
    layers.forEach((layer, i) => {
      layer.classList.remove('is-active', 'is-past', 'is-future');
      if      (i < beatIndex)  layer.classList.add('is-past');
      else if (i === beatIndex) layer.classList.add('is-active');
      else                      layer.classList.add('is-future');
    });

    // Update chips:
    // A chip is visible iff its beat index < activeBeat
    // i.e. all beats that have ALREADY been passed are shown as chips
    chips.forEach((chip, i) => {
      if (i < beatIndex) {
        chip.classList.add('visible');
      } else {
        chip.classList.remove('visible');
      }
    });

    // Subtle flash on beat change
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
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const maxScroll = Math.max(
      spacer.scrollHeight - outroEl.offsetHeight - window.innerHeight, 1
    );
    const progress = Math.max(0, Math.min(1, scrollTop / maxScroll));

    targetFrame = Math.min(Math.floor(progress * TOTAL_FRAMES), TOTAL_FRAMES - 1);
    progressBar.style.width = (progress * 100) + '%';
    if (scrollTop > 40) scrollHint.classList.add('hidden');
    else                scrollHint.classList.remove('hidden');
    ctaBtn.classList.toggle('visible', progress > 0.06);
  }

  /* ─── INIT ──────────────────────────────────────────────────── */
  async function init() {
    spacer.style.height = (TOTAL_FRAMES * PX_PER_FRAME) + 'px';

    await preloadFrames();
    await new Promise(r => setTimeout(r, 250));
    preloader.classList.add('hidden');

    resizeCanvas();
    drawFrame(0);
    updateText(0);

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