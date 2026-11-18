/**
 * Compatibilidad con el motor ORIGINAL de Portrayer.
 * Mantiene: marco antiguo 7★, ascensión 1–12 y exportación por capas.
 * No reimplementar el selector, los portraits ni el render base aquí:
 * esos recursos viven en assets/index.8198a119.js y assets/.
 */
'use strict';

(function () {
        const FRAME_KEY = "useOld7Frame";
        const ASC_KEY = "ascensionEnabled";
        const ASC_LEVEL_KEY = "ascensionLevel";

        let booted = false;
        let exportHooked = false;
        let tierHooked = false;

        function getFrameFlag() {
          return localStorage.getItem(FRAME_KEY) === "1";
        }

        function setFrameFlag(v) {
          localStorage.setItem(FRAME_KEY, v ? "1" : "0");
        }

        function getAscensionFlag() {
          return localStorage.getItem(ASC_KEY) === "1";
        }

        function setAscensionFlag(v) {
          localStorage.setItem(ASC_KEY, v ? "1" : "0");
        }

        function getAscensionLevel() {
          return localStorage.getItem(ASC_LEVEL_KEY) || "1";
        }

        function setAscensionLevel(v) {
          localStorage.setItem(ASC_LEVEL_KEY, String(v));
        }

        function getTierInput() {
          return document.querySelector('input[type="number"][min="1"][max="7"]');
        }

        function getCurrentTier() {
          const input = getTierInput();
          if (!input) return 7;
          const value = parseInt(input.value || "7", 10);
          return Number.isFinite(value) ? value : 7;
        }

        function getAscensionAssetPath() {
          return "assets/ascension.PNG";
        }

        function getPreview() {
          return document.getElementById("preview");
        }

        function getFrameCanvas() {
          return document.getElementById("frame");
        }

        // La vista previa y el PNG utilizan EXACTAMENTE el mismo canvas.
        // Se elimina la antigua pareja <img> + <div> para evitar desfases
        // provocados por porcentajes, escalado responsive y métricas de fuentes.
        const BADGE = Object.freeze({ x: 374, y: 368, size: 74 });
        const BADGE_CENTER = Object.freeze({
          x: BADGE.x + BADGE.size / 2,
          y: BADGE.y + BADGE.size / 2
        });
        let badgeImage = null;
        let badgeLoadPromise = null;

        function ensureAscensionOverlay() {
          const preview = getPreview();
          if (!preview) return null;

          // Elimina el diseño antiguo si se ejecutó una versión anterior.
          document.getElementById('ascensionIcon')?.remove();
          document.getElementById('ascensionNumber')?.remove();

          let overlay = document.getElementById('ascensionOverlay');
          if (!overlay) {
            overlay = document.createElement('canvas');
            overlay.id = 'ascensionOverlay';
            overlay.width = 500;
            overlay.height = 500;
            overlay.setAttribute('aria-hidden', 'true');
            preview.appendChild(overlay);
          }

          loadBadgeImage();
          return overlay;
        }

        function loadBadgeImage() {
          if (badgeLoadPromise) return badgeLoadPromise;
          badgeLoadPromise = new Promise(resolve => {
            const img = new Image();
            let triedFallback = false;
            img.onload = () => {
              badgeImage = img;
              updateAscensionVisibility();
              resolve(true);
            };
            img.onerror = () => {
              if (!triedFallback) {
                triedFallback = true;
                img.src = 'assets/ascension.png';
              } else {
                console.warn('[Portrayer] No se pudo cargar el emblema de ascensión.');
                resolve(false);
              }
            };
            img.src = getAscensionAssetPath();
          });
          return badgeLoadPromise;
        }

        function drawAscensionOverlay() {
          const overlay = document.getElementById('ascensionOverlay');
          if (!overlay) return;
          const ctx = overlay.getContext('2d');
          if (!ctx) return;
          ctx.clearRect(0, 0, 500, 500);
          if (!getAscensionFlag() || !badgeImage) return;

          ctx.save();
          // Emblema original en el lugar original, sin modificar assets/.
          ctx.drawImage(badgeImage, BADGE.x, BADGE.y, BADGE.size, BADGE.size);

          // El centro del círculo se corresponde con el centro del emblema.
          // Se corrige además el centro VISUAL del glifo midiendo sus píxeles,
          // no usando line-height ni textBaseline='middle'.
          const level = getAscensionLevel();
          ctx.font = "bold 24px 'Hanzel Normal', sans-serif";
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          ctx.lineWidth = 4;
          ctx.lineJoin = 'round';
          ctx.strokeStyle = '#050505';
          ctx.fillStyle = '#ffffff';

          const m = ctx.measureText(level);
          const ascent = Number.isFinite(m.actualBoundingBoxAscent) ? m.actualBoundingBoxAscent : 18;
          const descent = Number.isFinite(m.actualBoundingBoxDescent) ? m.actualBoundingBoxDescent : 0;
          const left = Number.isFinite(m.actualBoundingBoxLeft) ? m.actualBoundingBoxLeft : 0;
          const right = Number.isFinite(m.actualBoundingBoxRight) ? m.actualBoundingBoxRight : 0;
          const x = BADGE_CENTER.x - (right - left) / 2;
          const y = BADGE_CENTER.y + (ascent - descent) / 2;

          ctx.strokeText(level, x, y);
          ctx.fillText(level, x, y);
          ctx.restore();
        }

        function updateAscensionVisibility() {
          const overlay = document.getElementById('ascensionOverlay');
          if (!overlay) return;
          overlay.hidden = !getAscensionFlag();
          drawAscensionOverlay();
        }

        function drawFrameCanvas() {
  const frameCanvas = getFrameCanvas();
  if (!frameCanvas) return;

  const ctx = frameCanvas.getContext("2d");
  if (!ctx) return;

  const tier = getCurrentTier();
  const useOld = getFrameFlag() && tier === 7;

  const src = useOld
    ? "assets/old_champion-frame-7.png"
    : `assets/champion-frame-${tier}.png`;

  const img = new Image();
  img.onload = function () {
    ctx.clearRect(0, 0, 500, 500);

    let x = 78;
    let y = 70;

    /* Corrección solo para champion-frame-7.png */
    if (tier === 7 && !useOld) {
      x = 74;
    }

    ctx.drawImage(img, x, y);
  };
  img.src = src;
}

        function buildAscensionControl() {
          if (document.getElementById("toggle-old-7frame")) return true;

          const labels = Array.from(document.querySelectorAll("label"));
          const duplicatedLabel = labels.find(l =>
            (l.textContent || "").trim().toUpperCase().includes("ESTA DUPLICADO")
          );

          if (!duplicatedLabel) return false;

          const wrap = document.createElement("label");
          wrap.className = "input-group ascension-inline-wrap";

          const content = document.createElement("span");
          content.className = "ascension-inline-content";

          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.id = "toggle-old-7frame";
          checkbox.checked = getFrameFlag();

          const text = document.createElement("span");
          text.textContent = " Usar marco 7★ ASCENSION? ";

          const levelLabel = document.createElement("span");
          levelLabel.id = "ascensionLevelLabel";
          levelLabel.textContent = " Nivel ";

          const select = document.createElement("select");
          select.id = "ascensionLevel";

          for (let i = 1; i <= 12; i++) {
            const opt = document.createElement("option");
            opt.value = String(i);
            opt.textContent = String(i);
            if (String(i) === getAscensionLevel()) opt.selected = true;
            select.appendChild(opt);
          }

          content.appendChild(checkbox);
          content.appendChild(text);
          content.appendChild(levelLabel);
          content.appendChild(select);
          wrap.appendChild(content);

          duplicatedLabel.insertAdjacentElement("afterend", wrap);

          checkbox.addEventListener("change", () => {
            const checked = checkbox.checked;
            setFrameFlag(checked);
            setAscensionFlag(checked);
            toggleLevelVisibility();
            updateAscensionVisibility();
            drawFrameCanvas();
          });

          select.addEventListener("change", () => {
            setAscensionLevel(select.value);
            updateAscensionVisibility();
          });

          toggleLevelVisibility();
          return true;
        }

        function toggleLevelVisibility() {
          const enabled = getAscensionFlag();
          const label = document.getElementById("ascensionLevelLabel");
          const select = document.getElementById("ascensionLevel");

          if (label) label.style.display = enabled ? "inline-block" : "none";
          if (select) select.style.display = enabled ? "inline-block" : "none";
        }

        function hookTierChanges() {
          if (tierHooked) return;
          const tierInput = getTierInput();
          if (!tierInput) return;

          tierHooked = true;

          tierInput.addEventListener("input", () => {
            setTimeout(() => {
              drawFrameCanvas();
              updateAscensionVisibility();
            }, 20);
          });

          tierInput.addEventListener("change", () => {
            setTimeout(() => {
              drawFrameCanvas();
              updateAscensionVisibility();
            }, 20);
          });
        }

        function hookExportButton() {
          if (exportHooked) return;
          const btn = document.querySelector('button.button-contest');
          if (!btn) return;
          exportHooked = true;

          btn.addEventListener('click', async function (event) {
            event.preventDefault();
            event.stopImmediatePropagation();

            // Si el usuario exporta antes de que termine de cargar el icono,
            // esperar a la imagen para no obtener una descarga incompleta.
            if (getAscensionFlag()) {
              await loadBadgeImage();
              if (document.fonts?.ready) await document.fonts.ready;
              drawAscensionOverlay();
            }

            const out = document.createElement('canvas');
            out.width = 500;
            out.height = 500;
            const ctx = out.getContext('2d');
            if (!ctx) return;

            for (const id of ['background', 'frame', 'portrait', 'engraving', 'tier', 'strings', 'rank']) {
              const layer = document.getElementById(id);
              if (layer) ctx.drawImage(layer, 0, 0);
            }

            if (getAscensionFlag()) {
              const overlay = document.getElementById('ascensionOverlay');
              if (overlay) ctx.drawImage(overlay, 0, 0);
            }

            const link = document.createElement('a');
            link.download = `portrait-${Date.now()}.png`;
            link.href = out.toDataURL('image/png');
            link.click();
          }, true);
        }

        function installFrameHook() {
          if (window.__ascensionFrameHookInstalled) return;
          window.__ascensionFrameHookInstalled = true;

          try {
            const desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
            if (!desc || typeof desc.set !== "function" || typeof desc.get !== "function") return;

            Object.defineProperty(HTMLImageElement.prototype, "src", {
              get: desc.get,
              set: function (value) {
                try {
                  const tier = getCurrentTier();
                  if (
                    getFrameFlag() &&
                    tier === 7 &&
                    typeof value === "string" &&
                    value.includes("champion-frame-7.png") &&
                    !value.includes("old_champion-frame-7.png")
                  ) {
                    value = value.replace("champion-frame-7.png", "old_champion-frame-7.png");
                  }
                } catch (e) {}
                return desc.set.call(this, value);
              },
              configurable: true,
              enumerable: true
            });
          } catch (e) {}
        }

        function readyForBoot() {
          return (
            !!getPreview() &&
            !!document.querySelector("button.button-contest") &&
            !!document.querySelectorAll("label").length
          );
        }

        function boot() {
          if (booted) return;
          if (!readyForBoot()) return;

          booted = true;
          ensureAscensionOverlay();
          buildAscensionControl();
          hookTierChanges();
          hookExportButton();
          updateAscensionVisibility();
          drawFrameCanvas();
          if (document.fonts?.ready) {
            document.fonts.ready.then(drawAscensionOverlay);
          }
        }

        installFrameHook();
        boot(); // Inicialización inmediata si el motor ya está montado.

        let tries = 0;
        const poll = setInterval(() => {
          tries++;
          boot();
          if (booted || tries > 120) clearInterval(poll);
        }, 150);
      })();
