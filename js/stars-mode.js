/**
 * PORTRAYER / FICHA DE ESTRELLAS — TEST
 *
 * Renderer independiente que REUTILIZA las capas del motor original.
 * No sustituye los assets, el selector, los marcos, Vue ni el modo clásico.
 * Tamaño intrínseco 500x500. La exportación usa el mismo canvas que la vista.
 */
(() => {
  'use strict';
  const el = (id) => document.getElementById(id);
  const canvas = el('px-stars-canvas');
  const classical = el('px-original-mode');
  const stars = el('px-stars-view');
  if (!canvas || !classical || !stars) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  const choices = {
    count: el('px-stars-count'), frame: el('px-stars-frame'),
    duped: el('px-stars-duped'), asc: el('px-stars-ascension'),
    level: el('px-stars-level'), background: el('px-stars-background')
  };
  const state = { active: false, champion: '', assetImage: null, frameCache: new Map(), lastPortraitPresent: false };
  const nativeValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

  function findLabelControl(pattern, selector) {
    const app = el('app');
    if (!app) return null;
    for (const label of app.querySelectorAll('label')) {
      if (!pattern.test(label.textContent || '')) continue;
      return label.querySelector(selector) || label.parentElement?.querySelector(selector) || null;
    }
    return null;
  }

  function championInput() {
    return findLabelControl(/personaje a elegir|champion to choose|select champion|selecciona personaje/i, 'input:not([type="checkbox"]),select') ||
      el('app')?.querySelector('input[list]');
  }

  function nativeTierInput() {
    return el('app')?.querySelector('input[type="number"][min="1"][max="7"]');
  }

  function nativeDupedInput() {
    return findLabelControl(/est[aá] duplicado|duped|awakened/i, 'input[type="checkbox"]');
  }

  function changeNativeInput(input, value, type = 'value') {
    if (!input) return;
    if (type === 'checked') {
      if (input.checked === value) return;
      input.checked = value;
    } else {
      if (String(input.value) === String(value)) return;
      if (nativeValueSetter && input.tagName === 'INPUT') nativeValueSetter.call(input, String(value));
      else input.value = String(value);
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function selectedFrameTier() {
    return Number(choices.frame.value === 'auto' ? choices.count.value : choices.frame.value);
  }

  function syncFrameToOriginal() {
    // La rareza determina el marco por defecto. El selector manual lo puede sobreescribir.
    changeNativeInput(nativeTierInput(), selectedFrameTier());
    scheduleDraw();
  }

  function syncDupedToOriginal() {
    changeNativeInput(nativeDupedInput(), choices.duped.checked, 'checked');
    scheduleDraw();
  }

  function setChampionName(name) {
    const cleaned = String(name || '').trim();
    state.champion = cleaned;
    el('px-stars-character').textContent = cleaned || 'Elige un personaje…';
    scheduleDraw();
  }

  function loadBadge() {
    const image = new Image();
    let triedFallback = false;
    image.onload = () => { state.assetImage = image; scheduleDraw(); };
    image.onerror = () => {
      if (!triedFallback) { triedFallback = true; image.src = './assets/ascension.png'; }
    };
    image.src = './assets/ascension.PNG';
  }

  function frameFallback() {
    const tier = selectedFrameTier();
    const asset = tier === 7 ? './assets/champion-frame-7.png' : `./assets/champion-frame-${tier}.png`;
    if (state.frameCache.has(asset)) return state.frameCache.get(asset);
    const img = new Image();
    state.frameCache.set(asset, null);
    img.onload = () => { state.frameCache.set(asset, img); scheduleDraw(); };
    img.onerror = () => { state.frameCache.set(asset, false); };
    img.src = asset;
    return null;
  }

  // Fondo oscuro verde, parecido al ejemplo; también se puede exportar transparente.
  function drawBackground() {
    if (choices.background.value === 'transparent') return;
    const gradient = ctx.createLinearGradient(0, 0, 500, 500);
    gradient.addColorStop(0, '#011918');
    gradient.addColorStop(.5, '#061820');
    gradient.addColorStop(1, '#05130d');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 500, 500);
    for (const [x, y, r, alpha] of [
      [70, 50, 225, .11], [430, 150, 190, .12], [240, 455, 260, .14]
    ]) {
      const fog = ctx.createRadialGradient(x, y, 0, x, y, r);
      fog.addColorStop(0, `rgba(16,111,88,${alpha})`);
      fog.addColorStop(1, 'rgba(16,111,88,0)');
      ctx.fillStyle = fog;
      ctx.fillRect(0, 0, 500, 500);
    }
  }

  function originalCanvas(id) {
    const source = el(id);
    if (!(source instanceof HTMLCanvasElement)) return null;
    return source.width > 0 && source.height > 0 ? source : null;
  }

  function hasPixels(source) {
    if (!source) return false;
    try {
      const context = source.getContext('2d', { willReadFrequently: true });
      if (!context) return false;
      // El contenido puede tener transparencias: revisamos varios puntos antes
      // de decidir si hace falta el recurso original de respaldo.
      for (const [x, y] of [[250, 200], [200, 250], [300, 300], [400, 175], [150, 120]]) {
        const px = Math.min(source.width - 1, Math.round(x * source.width / 500));
        const py = Math.min(source.height - 1, Math.round(y * source.height / 500));
        if (context.getImageData(px, py, 1, 1).data[3] > 5) return true;
      }
      return false;
    } catch (_) {
      return true; // No bloquear capas si el navegador restringe la lectura.
    }
  }

  function drawFrameAndPortrait() {
    const frame = originalCanvas('frame');
    const portrait = originalCanvas('portrait');
    const hasFrame = hasPixels(frame);
    const hasPortrait = hasPixels(portrait);
    state.lastPortraitPresent = hasPortrait;
    ctx.save();
    // Eliminamos la placa clásica (nombre, clase y potencia), que se encuentra
    // en la zona inferior; el busto y el marco siguen siendo los originales.
    ctx.beginPath();
    ctx.rect(0, 0, 500, 348);
    ctx.clip();
    if (hasFrame) ctx.drawImage(frame, 0, 0, 500, 500);
    else {
      const fallback = frameFallback();
      if (fallback) {
        const x = selectedFrameTier() === 7 ? 74 : 78;
        ctx.drawImage(fallback, x, 70);
      }
    }
    if (hasPortrait) ctx.drawImage(portrait, 0, 0, 500, 500);
    ctx.restore();

    if (!hasPortrait) {
      ctx.save();
      ctx.font = '600 17px system-ui, sans-serif';
      ctx.fillStyle = '#a8b9bf';
      ctx.textAlign = 'center';
      ctx.fillText('Elige un campeón en la biblioteca', 250, 245);
      ctx.restore();
    }
  }

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function starShape(cx, cy, outer, inner = outer * .43) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? outer : inner;
      const angle = -Math.PI / 2 + (i * Math.PI / 5);
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawStar(cx, cy, radius, gold) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.82)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 4;
    starShape(cx, cy, radius);
    ctx.fillStyle = gold ? '#82400b' : '#536877';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = gold ? '#723403' : '#293942';
    ctx.stroke();
    const gradient = ctx.createLinearGradient(0, cy - radius, 0, cy + radius);
    if (gold) {
      gradient.addColorStop(0, '#fff4a0');
      gradient.addColorStop(.26, '#f5b328');
      gradient.addColorStop(.48, '#c66b10');
      gradient.addColorStop(.62, '#ffbd3a');
      gradient.addColorStop(1, '#8d430b');
    } else {
      gradient.addColorStop(0, '#e7f7ff');
      gradient.addColorStop(.45, '#b1d5e7');
      gradient.addColorStop(1, '#55798c');
    }
    starShape(cx, cy, radius - 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    // Facetas claras para acercarse al aspecto metalizado de MCoC.
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius + 2);
    ctx.lineTo(cx, cy - 2);
    ctx.lineTo(cx - radius * .76, cy - radius * .23);
    ctx.closePath();
    ctx.fillStyle = gold ? 'rgba(255,245,184,.50)' : 'rgba(255,255,255,.43)';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, cy - 2);
    ctx.lineTo(cx + radius * .85, cy - radius * .23);
    ctx.lineTo(cx + radius * .53, cy + radius * .71);
    ctx.closePath();
    ctx.fillStyle = gold ? 'rgba(148,54,0,.37)' : 'rgba(42,69,86,.32)';
    ctx.fill();
    ctx.restore();
  }

  function drawStarsPlaque() {
    const x = 55, y = 332, w = 390, h = 111;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.82)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 7;
    roundedRect(x, y, w, h, 5);
    ctx.fillStyle = '#101112';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 0;
    roundedRect(x + 2, y + 2, w - 4, h - 4, 3);
    const bg = ctx.createLinearGradient(0, y, 0, y + h);
    bg.addColorStop(0, '#353536');
    bg.addColorStop(.72, '#333335');
    bg.addColorStop(1, '#29292b');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.10)';
    ctx.lineWidth = 1;
    ctx.stroke();
    const count = Math.max(1, Math.min(7, Number(choices.count.value) || 7));
    const gap = count === 7 ? 47 : 48;
    const start = 250 - (count - 1) * gap / 2;
    for (let i = 0; i < count; i++) drawStar(start + i * gap, y + h / 2 + 3, 25, choices.duped.checked);
    ctx.restore();
  }

  function drawBadge() {
    if (!choices.asc.checked) return;
    const img = state.assetImage;
    if (!img) return;
    ctx.save();
    const bx = 343, by = 61, bs = 98;
    ctx.drawImage(img, bx, by, bs, bs);
    const text = choices.level.value;
    const cx = bx + bs / 2;
    const cy = by + bs / 2;
    ctx.font = `900 ${text.length > 1 ? 28 : 34}px 'Hanzel Normal',system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText(text);
    const asc = m.actualBoundingBoxAscent || 24;
    const desc = m.actualBoundingBoxDescent || 2;
    const adjustedY = cy + (asc - desc) / 2;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#100c08';
    ctx.strokeText(text, cx, adjustedY);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, cx, adjustedY);
    ctx.restore();
  }

  function draw() {
    if (!state.active || !ctx) return;
    ctx.clearRect(0, 0, 500, 500);
    drawBackground();
    drawFrameAndPortrait();
    drawStarsPlaque();
    drawBadge();
  }

  function scheduleDraw() {
    if (!state.active) return;
    requestAnimationFrame(draw);
    // La capa de retrato y el marco pueden actualizarse tras una carga asíncrona.
    window.setTimeout(draw, 120);
    window.setTimeout(draw, 450);
  }

  function showMode(newMode) {
    const isStars = newMode === 'stars';
    if (el('px-picker')?.open) el('px-picker').close();
    state.active = isStars;
    document.body.classList.toggle('px-stars-mode', isStars);
    stars.hidden = !isStars;
    classical.hidden = isStars;
    el('px-tab-original').classList.toggle('is-active', !isStars);
    el('px-tab-stars').classList.toggle('is-active', isStars);
    el('px-tab-original').setAttribute('aria-selected', String(!isStars));
    el('px-tab-stars').setAttribute('aria-selected', String(isStars));
    if (isStars) {
      if (!state.champion) setChampionName(championInput()?.value || '');
      syncFrameToOriginal();
      syncDupedToOriginal();
      scheduleDraw();
    }
  }

  function openChampionSearch() {
    const nativeButton = el('px-open-picker');
    if (nativeButton) nativeButton.click();
  }

  async function download() {
    draw();
    if (!state.lastPortraitPresent) {
      window.alert('El retrato del campeón todavía no se ha cargado. Elige un personaje o inténtalo de nuevo.');
      return;
    }
    const filename = (state.champion || 'campeon').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '').slice(0, 60);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.download = `mcoc-${filename}-${choices.count.value}estrellas.png`;
    anchor.href = url;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  el('px-tab-original').addEventListener('click', () => showMode('original'));
  el('px-tab-stars').addEventListener('click', () => showMode('stars'));
  el('px-stars-find').addEventListener('click', openChampionSearch);
  el('px-stars-change').addEventListener('click', openChampionSearch);
  el('px-stars-download').addEventListener('click', () => { void download(); });

  choices.count.addEventListener('change', syncFrameToOriginal);
  choices.frame.addEventListener('change', syncFrameToOriginal);
  choices.duped.addEventListener('change', syncDupedToOriginal);
  choices.asc.addEventListener('change', () => {
    stars.classList.toggle('px-stars-no-asc', !choices.asc.checked);
    scheduleDraw();
  });
  choices.level.addEventListener('change', scheduleDraw);
  choices.background.addEventListener('change', scheduleDraw);

  document.addEventListener('px:champion-selected', (event) => setChampionName(event.detail?.name));
  // También detecta cambios realizados directamente en el selector original.
  el('app')?.addEventListener('input', (event) => {
    if (event.target === championInput()) setChampionName(event.target.value);
    if (event.target === nativeTierInput()) scheduleDraw();
  });

  // El renderizador original dibuja en canvas asincrónicamente; un refresco ligero
  // solo mientras se ve esta pestaña permite reflejar cada retrato al cargar.
  window.setInterval(() => { if (state.active && !document.hidden) draw(); }, 650);
  loadBadge();
})();
