/**
 * Ajuste automático del nombre en los retratos MCoC.
 *
 * Este archivo complementa el renderizador original (assets/index.8198a119.js).
 * No modifica ningún retrato ni cambia el tamaño del formulario o del canvas.
 * El motor original sigue dibujando el nombre en #strings; interceptamos SOLO
 * ese texto para elegir una fuente que encaje en una única línea.
 */
(() => {
  'use strict';

  if (window.__portrayerFitNameInstalled) return;
  window.__portrayerFitNameInstalled = true;

  const TEXT_LAYER_IDS = new Set(['strings', 'engraving']);
  // Límites medidos respecto al canvas original de 500 × 500.
  // Se reserva espacio a la derecha para mantener el nombre sobre la placa.
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
    // Busca por el texto del label, no por la posición del input en el formulario.
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

  function rightLimit(ctx, x) {
    // #strings usa coordenadas de lienzo de 500 × 500. El extremo derecho
    // del rótulo es fijo, independientemente del zoom/responsive CSS.
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

  function withFittedFont(ctx, text, x, y, maxWidth, original) {
    if (!isNameDrawing(ctx, text) || !Number.isFinite(x)) {
      return Number.isFinite(maxWidth) && maxWidth > 0
        ? original.call(ctx, text, x, y, maxWidth) : original.call(ctx, text, x, y);
    }

    const allowed = rightLimit(ctx, x) - EPSILON;
    if (allowed <= 0) return; // Evita pintar fuera de los límites de la placa.
    const currentFont = ctx.font;
    const originalSize = getFontSize(currentFont);
    if (!originalSize || !Number.isFinite(originalSize)) {
      return original.call(ctx, text, x, y, allowed);
    }

    const normalWidth = ctx.measureText(text).width;
    const existingLimit = Number.isFinite(maxWidth) && maxWidth > 0 ? maxWidth : Infinity;
    const limit = Math.min(allowed, existingLimit);
    if (normalWidth <= limit) {
      // Nombres cortos: el motor dibuja con su fuente ORIGINAL sin cambios.
      return Number.isFinite(maxWidth) ? original.call(ctx, text, x, y, maxWidth) : original.call(ctx, text, x, y);
    }

    // El ancho del texto es aproximadamente lineal con el tamaño de fuente.
    // Refinamos por medida real para tipos de letra que no son perfectamente lineales.
    let desired = Math.max(MIN_FONT_SIZE, originalSize * limit / normalWidth);
    try {
      for (let i = 0; i < 3; i++) {
        ctx.font = currentFont.replace(/(^|\s)\d+(?:\.\d+)?px\b/, (_, prefix) => `${prefix}${desired.toFixed(2)}px`);
        const current = ctx.measureText(text).width;
        if (current <= limit || desired <= MIN_FONT_SIZE) break;
        desired = Math.max(MIN_FONT_SIZE, desired * (limit / current));
      }
      // Incluso nombres exageradamente largos permanecen en una sola línea.
      return original.call(ctx, text, x, y, limit);
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
