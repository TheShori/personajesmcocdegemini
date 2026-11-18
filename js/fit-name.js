/**
 * Ajuste automático del nombre en los retratos MCoC.
 *
 * Además de reducir la fuente cuando el nombre es largo, esta versión
 * recentra verticalmente el texto dentro de su franja para que no quede
 * pegado abajo cuando el tamaño disminuye.
 */
(() => {
  'use strict';

  if (window.__portrayerFitNameInstalled) return;
  window.__portrayerFitNameInstalled = true;

  const TEXT_LAYER_IDS = new Set(['strings', 'engraving']);
  const BOUNDS = Object.freeze({ left: 98, right: 418 });
  const MIN_FONT_SIZE = 4;
  const EPSILON = 0.5;

  const originalFillText = CanvasRenderingContext2D.prototype.fillText;
  const originalStrokeText = CanvasRenderingContext2D.prototype.strokeText;

  function normalise(s) {
    return String(s ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleUpperCase('es-ES');
  }

  function getNameInput() {
    const app = document.getElementById('app');
    if (!app) return null;
    for (const label of app.querySelectorAll('label')) {
      if (/NOMBRE\s+DEL\s+PERSONAJE|NOMBRE\s+DEL\s+CAMPE[OÓ]N|CHARACTER\s+NAME|CHAMPION\s+NAME/i.test(label.textContent || '')) {
        const input = label.querySelector('input:not([type="number"]),textarea');
        if (input) return input;
      }
    }
    return null;
  }

  function isNameDrawing(ctx, text) {
    if (!ctx || !ctx.canvas || !TEXT_LAYER_IDS.has(ctx.canvas.id)) return false;
    if (typeof text !== 'string' || !text.trim()) return false;
    const input = getNameInput();
    if (!input || !input.value.trim()) return false;
    return normalise(text) === normalise(input.value);
  }

  function getFontSize(font) {
    const match = /(?:^|\s)(\d+(?:\.\d+)?)px\b/.exec(font);
    return match ? Number(match[1]) : null;
  }

  function setFontSize(font, sizePx) {
    return font.replace(/(^|\s)\d+(?:\.\d+)?px\b/, (_, prefix) => `${prefix}${sizePx.toFixed(2)}px`);
  }

  function rightLimit(ctx, x) {
    const canvasWidth = ctx.canvas.width || 500;
    const scale = canvasWidth / 500;
    const left = BOUNDS.left * scale;
    const right = BOUNDS.right * scale;
    switch (ctx.textAlign) {
      case 'center': return Math.max(0, 2 * Math.min(x - left, right - x));
      case 'right':
      case 'end': return Math.max(0, x - left);
      default: return Math.max(0, right - Math.max(x, left));
    }
  }

  function getVisualMetrics(ctx, text) {
    const m = ctx.measureText(text);
    let ascent = m.actualBoundingBoxAscent;
    let descent = m.actualBoundingBoxDescent;
    if (!(Number.isFinite(ascent) && Number.isFinite(descent))) {
      const size = getFontSize(ctx.font) || 0;
      ascent = size * 0.78;
      descent = size * 0.22;
    }
    return { width: m.width, ascent, descent };
  }

  function computeCenteredBaseline(originalY, origMetrics, newMetrics) {
    // Centro visual del texto original con textBaseline = alphabetic:
    // center = baseline + (-ascent + descent) / 2
    const originalCenter = originalY + (-origMetrics.ascent + origMetrics.descent) / 2;
    return originalCenter - (-newMetrics.ascent + newMetrics.descent) / 2;
  }

  function withFittedFont(ctx, text, x, y, maxWidth, original) {
    if (!isNameDrawing(ctx, text) || !Number.isFinite(x)) {
      return Number.isFinite(maxWidth) && maxWidth > 0
        ? original.call(ctx, text, x, y, maxWidth) : original.call(ctx, text, x, y);
    }

    const allowed = rightLimit(ctx, x) - EPSILON;
    if (allowed <= 0) return;

    const currentFont = ctx.font;
    const originalSize = getFontSize(currentFont);
    if (!originalSize || !Number.isFinite(originalSize)) {
      return original.call(ctx, text, x, y, allowed);
    }

    const origMetrics = getVisualMetrics(ctx, text);
    const existingLimit = Number.isFinite(maxWidth) && maxWidth > 0 ? maxWidth : Infinity;
    const limit = Math.min(allowed, existingLimit);

    if (origMetrics.width <= limit) {
      return Number.isFinite(maxWidth)
        ? original.call(ctx, text, x, y, maxWidth)
        : original.call(ctx, text, x, y);
    }

    let desired = Math.max(MIN_FONT_SIZE, originalSize * limit / origMetrics.width);
    let fittedFont = currentFont;
    let fittedMetrics = origMetrics;
    let fittedY = y;

    try {
      for (let i = 0; i < 5; i++) {
        fittedFont = setFontSize(currentFont, desired);
        ctx.font = fittedFont;
        fittedMetrics = getVisualMetrics(ctx, text);
        if (fittedMetrics.width <= limit || desired <= MIN_FONT_SIZE) break;
        desired = Math.max(MIN_FONT_SIZE, desired * (limit / fittedMetrics.width));
      }
      // Recentrar verticalmente para que el texto reducido no se quede abajo.
      fittedY = computeCenteredBaseline(y, origMetrics, fittedMetrics);
      return original.call(ctx, text, x, fittedY, limit);
    } finally {
      ctx.font = currentFont;
    }
  }

  CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
    return withFittedFont(this, text, x, y, maxWidth, originalFillText);
  };
  CanvasRenderingContext2D.prototype.strokeText = function (text, x, y, maxWidth) {
    return withFittedFont(this, text, x, y, maxWidth, originalStrokeText);
  };
})();
