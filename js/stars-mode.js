/**
 * PORTRAYER / FICHA DE ESTRELLAS — TEST
 *
 * Renderer independiente que reutiliza los retratos/capas del motor original,
 * pero compone una ficha alternativa inspirada en la referencia del usuario:
 * - sin nombre/clase/potencia
 * - banda inferior con estrellas tipo referencia
 * - 7★ usa el marco morado original, NO el de ascensión+
 * - duplicado => estrellas doradas / no duplicado => estrellas grises
 * - exportación PNG transparente
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
  const state = {
    active: false,
    champion: '',
    assetImage: null,
    frameCache: new Map(),
    lastPortraitPresent: false,
    classicalSettings: null,
    goldStarImage: null,
    greyStarImage: null,
    starLoadStarted: false
  };
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

  // En el Portrayer original, Ascensión+ utiliza el marco antiguo 7★,
  // que es distinto del marco 7★ morado actual.
  function ascensionPlusEnabled() {
    return choices.asc.checked && Number(choices.count.value) === 7 && selectedFrameTier() === 7;
  }

  function updateAscensionControls() {
    stars.classList.toggle('px-stars-no-asc', !ascensionPlusEnabled());
    choices.level.disabled = !ascensionPlusEnabled();
  }

  function syncFrameToOriginal() {
    // Se sigue actualizando el tier nativo, pero el render de la ficha de estrellas
    // NO usa el frame canvas original para evitar el 7★ de ascensión+.
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


  function loadStarAssets() {
    if (state.starLoadStarted) return;
    state.starLoadStarted = true;
    const items = [
      ['greyStarImage', './stars-assets/star-grey.png'],
      ['goldStarImage', './stars-assets/star-gold.png']
    ];
    for (const [key, path] of items) {
      const image = new Image();
      image.onload = () => { state[key] = image; scheduleDraw(); };
      image.onerror = () => { console.warn('[Portrayer] No se pudo cargar', path); };
      image.src = path;
    }
  }

  function frameAssetPath(tier) {
    // Recurso ORIGINAL usado por el retrato clásico al activar Ascensión+.
    // La ficha de estrellas no hereda el checkbox de la otra pestaña.
    return tier === 7 && ascensionPlusEnabled()
      ? './assets/old_champion-frame-7.png'
      : `./assets/champion-frame-${tier}.png`;
  }

  function frameImage(tier) {
    const asset = frameAssetPath(tier);
    if (state.frameCache.has(asset)) return state.frameCache.get(asset);
    const img = new Image();
    state.frameCache.set(asset, null);
    img.onload = () => { state.frameCache.set(asset, img); scheduleDraw(); };
    img.onerror = () => { state.frameCache.set(asset, false); };
    // Bypassa el hook heredado que reemplaza el marco 7★ por el de ascensión+.
    // El valor src se aplica por atributo, no por el setter modificado.
    img.setAttribute('src', asset);
    return null;
  }

  function drawBackground() {
    if (choices.background.value === 'transparent') return;
    const gradient = ctx.createLinearGradient(0, 0, 500, 500);
    gradient.addColorStop(0, '#011918');
    gradient.addColorStop(.5, '#061820');
    gradient.addColorStop(1, '#05130d');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 500, 500);
    for (const [x, y, r, alpha] of [[70, 50, 225, .11], [430, 150, 190, .12], [240, 455, 260, .14]]) {
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
      for (const [x, y] of [[250, 200], [200, 250], [300, 300], [400, 175], [150, 120]]) {
        const px = Math.min(source.width - 1, Math.round(x * source.width / 500));
        const py = Math.min(source.height - 1, Math.round(y * source.height / 500));
        if (context.getImageData(px, py, 1, 1).data[3] > 5) return true;
      }
      return false;
    } catch (_) {
      return true;
    }
  }

  function drawFrameAndPortrait() {
    const portrait = originalCanvas('portrait');
    const hasPortrait = hasPixels(portrait);
    state.lastPortraitPresent = hasPortrait;
    const tier = selectedFrameTier();
    const fallback = frameImage(tier);

    ctx.save();
    // Se recorta por encima de la banda, dejando que esta suba hasta tocar el retrato.
    ctx.beginPath();
    ctx.rect(0, 0, 500, 320);
    ctx.clip();

    // Normal: champion-frame-X.png; Ascensión+: old_champion-frame-7.png.
    if (fallback) {
      const x = tier === 7 && !ascensionPlusEnabled() ? 74 : 78;
      ctx.drawImage(fallback, x, 70);
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

  function getConfiguredStarSprite() {
    return choices.duped.checked ? state.greyStarImage : state.goldStarImage;
  }

  function drawNativeStar(sprite, cx, cy, width) {
    if (!sprite) return;
    const height = width * (sprite.height / sprite.width);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.25)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 2;
    ctx.drawImage(sprite, cx - width / 2, cy - height / 2, width, height);
    ctx.restore();
  }

  function drawStarsPlaque() {
    // Subida hasta tocar el retrato; ligera superposición para eliminar la línea negra.
    const x = 54, y = 302, w = 392, h = 110;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.60)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;
    roundedRect(x, y, w, h, 5);
    ctx.fillStyle = '#171717';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 0;
    roundedRect(x + 2, y + 2, w - 4, h - 4, 4);
    const bg = ctx.createLinearGradient(0, y, 0, y + h);
    bg.addColorStop(0, '#3a3a3c');
    bg.addColorStop(.65, '#343436');
    bg.addColorStop(1, '#29292b');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const count = Math.max(1, Math.min(7, Number(choices.count.value) || 7));
    const gap = count >= 6 ? 42 : 46;
    const radius = count >= 6 ? 22 : 24;
    const start = 250 - ((count - 1) * gap / 2);
    // Lógica correcta pedida por el usuario:
    // duplicado = grises, no duplicado = doradas.
    const sprite = getConfiguredStarSprite();
    if (sprite) {
      for (let i = 0; i < count; i++) {
        drawNativeStar(sprite, start + i * gap, y + h / 2 + 5, radius * 2.15);
      }
    } else {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.fillStyle = '#d8c99e';
      ctx.fillText('Cargando estrellas originales…', 250, y + h / 2);
    }
    ctx.restore();
  }

  function drawBadge() {
    if (!ascensionPlusEnabled()) return;
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
    window.setTimeout(draw, 120);
    window.setTimeout(draw, 450);
  }

  function showMode(newMode) {
    const isStars = newMode === 'stars';
    if (el('px-picker')?.open) el('px-picker').close();
    if (isStars && !state.active) {
      // Al volver a Retrato clásico, recuperamos sus ajustes de rareza y duplicado.
      state.classicalSettings = {
        tier: nativeTierInput()?.value,
        duped: nativeDupedInput()?.checked
      };
    }
    if (!isStars && state.active && state.classicalSettings) {
      if (state.classicalSettings.tier != null) {
        changeNativeInput(nativeTierInput(), state.classicalSettings.tier);
      }
      if (state.classicalSettings.duped != null) {
        changeNativeInput(nativeDupedInput(), state.classicalSettings.duped, 'checked');
      }
    }
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
      updateAscensionControls();
      scheduleDraw();
    }
  }

  function openChampionSearch() {
    const nativeButton = el('px-open-picker');
    if (nativeButton) nativeButton.click();
  }

  async function download() {
    // La exportación debe salir SIN fondo, en PNG transparente.
    // Espera a que se haya cargado el marco seleccionado (normal / Ascensión+).
    const path = frameAssetPath(selectedFrameTier());
    if (!state.frameCache.get(path)) {
      frameImage(selectedFrameTier());
      const started = Date.now();
      while (state.frameCache.get(path) === null && Date.now() - started < 4000) {
        await new Promise(resolve => setTimeout(resolve, 80));
      }
    }
    if (!state.frameCache.get(path)) {
      window.alert('No se pudo cargar el marco original desde assets/. Comprueba que exista: ' + path);
      return;
    }
    const previousBg = choices.background.value;
    choices.background.value = 'transparent';
    draw();
    if (!state.lastPortraitPresent) {
      choices.background.value = previousBg;
      draw();
      window.alert('El retrato del campeón todavía no se ha cargado. Elige un personaje o inténtalo de nuevo.');
      return;
    }
    const filename = (state.champion || 'campeon').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '').slice(0, 60);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
      choices.background.value = previousBg;
      draw();
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.download = `mcoc-${filename}-${choices.count.value}estrellas.png`;
    anchor.href = url;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    // Restaurar la vista previa al valor visible en el selector.
    choices.background.value = previousBg;
    draw();
  }

  el('px-tab-original').addEventListener('click', () => showMode('original'));
  el('px-tab-stars').addEventListener('click', () => showMode('stars'));
  el('px-stars-find').addEventListener('click', openChampionSearch);
  el('px-stars-change').addEventListener('click', openChampionSearch);
  el('px-stars-download').addEventListener('click', () => { void download(); });

  choices.count.addEventListener('change', () => {
    // Ascensión+ solo corresponde al marco de 7 estrellas.
    if (Number(choices.count.value) !== 7) choices.asc.checked = false;
    updateAscensionControls();
    syncFrameToOriginal();
  });
  choices.frame.addEventListener('change', () => {
    if (selectedFrameTier() !== 7) choices.asc.checked = false;
    updateAscensionControls();
    syncFrameToOriginal();
  });
  choices.duped.addEventListener('change', syncDupedToOriginal);
  choices.asc.addEventListener('change', () => {
    if (choices.asc.checked) {
      // Igual que en Retrato clásico: Ascensión+ implica marco especial 7★
      // y emblema dorado con el nivel elegido.
      choices.count.value = '7';
      choices.frame.value = 'auto';
    }
    updateAscensionControls();
    syncFrameToOriginal();
  });
  choices.level.addEventListener('change', scheduleDraw);
  choices.background.addEventListener('change', scheduleDraw);

  document.addEventListener('px:champion-selected', (event) => setChampionName(event.detail?.name));
  el('app')?.addEventListener('input', (event) => {
    if (event.target === championInput()) setChampionName(event.target.value);
    if (event.target === nativeTierInput()) scheduleDraw();
  });

  // La exportación final debe ser transparente por defecto.
  if (choices.background) choices.background.value = 'transparent';
  updateAscensionControls();

  window.setInterval(() => { if (state.active && !document.hidden) draw(); }, 650);
  loadBadge();
  loadStarAssets();
})();
