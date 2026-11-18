/**
 * PORTRAYER TEST — Capa de interfaz (no motor de dibujo).
 *
 * El proyecto ORIGINAL sigue controlando la selección, los retratos, las estrellas,
 * las clases y la exportación a PNG. Este archivo únicamente ofrece navegación,
 * búsqueda visual y un aspecto más cómodo sin rehacer la aplicación Vue existente.
 */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const dialog = $('px-picker');
  const search = $('px-search');
  const results = $('px-picker-results');
  const meta = $('px-picker-meta');
  const sourceText = $('px-picker-description');
  const cacheKey = 'portrayer-test-champions-v1';
  const REPO = 'TheShori/personajesmcocdegemini';
  const IMAGE_DIRS = /^(?:assets\/(?:portraits?|portlayer|champions?)\/|portraits\/)/i;
  const IMAGE_EXTS = /\.(?:png|webp|jpe?g|avif)$/i;
  const MAX_SHOWN = 45;
  let catalog = [];
  let loadingCatalog = null;
  let queryDelay = 0;

  function normalized(text) {
    return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function uniqueCatalog(entries) {
    const seen = new Set();
    return entries.filter((entry) => {
      const key = normalized(entry.name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
  }

  function findChampionControl() {
    const app = $('app');
    if (!app) return null;

    const labels = [...app.querySelectorAll('label')];
    const label = labels.find((item) => {
      const text = normalized(item.textContent);
      return text.includes('personaje a elegir') || text.includes('champion to choose') ||
        text.includes('select champion') || text.includes('selecciona personaje');
    });

    if (label) {
      // La app original usa etiquetas; puede tener el campo dentro o al lado.
      const own = label.querySelector('input:not([type="checkbox"]), select');
      if (own) return own;
      const parent = label.parentElement;
      if (parent) {
        const sibling = [...parent.querySelectorAll('input:not([type="checkbox"]), select')]
          .find((element) => !label.contains(element));
        if (sibling) return sibling;
      }
      const next = label.nextElementSibling;
      if (next?.matches('input,select')) return next;
    }

    // Respaldo seguro para variantes del HTML compilado original.
    return app.querySelector('input[list], select[name*="character" i], input[name*="character" i]') ||
      [...app.querySelectorAll('input:not([type="checkbox"]):not([type="number"]), select')]
        .find((element) => element.tagName === 'INPUT' && element.type !== 'hidden') || null;
  }

  function optionsFromOriginal() {
    const control = findChampionControl();
    if (!control) return [];

    let options = [];
    if (control.tagName === 'SELECT') options = [...control.options];
    else if (control.list) options = [...control.list.options];
    else {
      const datalist = document.querySelector('#app datalist');
      if (datalist) options = [...datalist.options];
    }

    return uniqueCatalog(options
      .map((option) => ({ name: (option.label || option.textContent || option.value || '').trim(), value: option.value, source: 'native' }))
      .filter((option) => option.name && !/^(elige|select|choose)(\s|$)/i.test(option.name)));
  }

  function humanizeFilename(path) {
    const filename = String(path).split('/').at(-1).replace(IMAGE_EXTS, '');
    return filename.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
  }

  async function catalogFromAssets() {
    // Primero reutilizamos cualquier catálogo generado junto a los archivos.
    try {
      const response = await fetch('./data/champions.json', { cache: 'no-cache' });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          const items = data.map((item) => typeof item === 'string'
            ? { path: item, name: humanizeFilename(item), source: 'assets' }
            : { path: item.path, name: item.name || humanizeFilename(item.path), source: 'assets' });
          const valid = items.filter((item) => item.path && IMAGE_DIRS.test(item.path));
          if (valid.length) return uniqueCatalog(valid);
        }
      }
    } catch (_) { /* Catálogo local opcional. */ }

    // Alternativa sin servidor ni npm: enumerar los archivos PÚBLICOS del propio
    // repositorio TEST por GitHub API. Solo consulta; no modifica nada.
    try {
      const saved = sessionStorage.getItem(cacheKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (_) { /* El almacenamiento del navegador puede estar deshabilitado. */ }

    for (const branch of ['main', 'master']) {
      try {
        const response = await fetch(`https://api.github.com/repos/${REPO}/git/trees/${branch}?recursive=1`, {
          headers: { Accept: 'application/vnd.github+json' }
        });
        if (!response.ok) continue;
        const data = await response.json();
        const entries = (data.tree || [])
          .filter((item) => item.type === 'blob' && IMAGE_DIRS.test(item.path) && IMAGE_EXTS.test(item.path))
          .map((item) => ({ path: item.path, name: humanizeFilename(item.path), source: 'assets' }));
        if (entries.length) {
          const list = uniqueCatalog(entries);
          try { sessionStorage.setItem(cacheKey, JSON.stringify(list)); } catch (_) { /* opcional */ }
          return list;
        }
      } catch (_) { /* Si GitHub falla, se mantiene el selector nativo. */ }
    }
    return [];
  }

  async function loadCatalog() {
    if (loadingCatalog) return loadingCatalog;
    loadingCatalog = (async () => {
      const native = optionsFromOriginal();
      // Mostramos el catálogo original inmediatamente, sin esperar a GitHub.
      if (native.length) {
        catalog = native;
        if (native.length < 60) {
          void catalogFromAssets().then((extra) => {
            catalog = uniqueCatalog([...native, ...extra]);
            if (dialog.open) renderList();
          });
        }
        return catalog;
      }
      // Sin opciones nativas legibles, intentamos recuperar las imágenes del repositorio.
      catalog = await catalogFromAssets();
      return catalog;
    })();
    return loadingCatalog;
  }

  function fallbackCard(entry) {
    const holder = document.createElement('span');
    holder.className = 'px-champ__placeholder';
    holder.textContent = (entry.name || '?').slice(0, 1).toUpperCase();
    holder.setAttribute('aria-hidden', 'true');
    return holder;
  }

  function imageUrl(path) {
    // Solo rutas relativas a una carpeta de retratos validada (no URLs externas).
    return IMAGE_DIRS.test(String(path || '')) ? `./${path.split('/').map(encodeURIComponent).join('/')}` : null;
  }

  function cardFor(entry) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'px-champ';
    button.setAttribute('role', 'listitem');
    button.setAttribute('aria-label', `Seleccionar ${entry.name}`);

    const src = entry.path ? imageUrl(entry.path) : null;
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.loading = 'lazy';
      img.alt = '';
      img.addEventListener('error', () => img.replaceWith(fallbackCard(entry)), { once: true });
      button.appendChild(img);
    } else button.appendChild(fallbackCard(entry));

    const name = document.createElement('span');
    name.className = 'px-champ__name';
    name.textContent = entry.name;
    button.appendChild(name);
    button.addEventListener('click', () => pickChampion(entry));
    return button;
  }

  function showMessage(title, detail) {
    const area = document.createElement('div');
    area.className = 'px-empty';
    const strong = document.createElement('strong');
    strong.textContent = title;
    const description = document.createElement('span');
    description.textContent = detail;
    area.append(strong, description);
    results.replaceChildren(area);
  }

  function renderList() {
    const q = normalized(search.value);
    const matching = catalog.filter((entry) => normalized(entry.name).includes(q));
    meta.textContent = `${matching.length} campeón${matching.length === 1 ? '' : 'es'} encontrado${matching.length === 1 ? '' : 's'}${matching.length > MAX_SHOWN ? ` · mostrando los primeros ${MAX_SHOWN}` : ''}`;
    if (!matching.length) {
      showMessage('Sin coincidencias', 'Prueba otra búsqueda o usa el selector original de personajes.');
      return;
    }
    results.replaceChildren(...matching.slice(0, MAX_SHOWN).map(cardFor));
  }

  function setNativeValue(element, value) {
    const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) setter.call(element, value);
    else element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function pickChampion(entry) {
    const control = findChampionControl();
    if (!control) {
      sourceText.textContent = 'No se ha encontrado el campo de selección de la app original. Puedes utilizarlo al volver al editor.';
      dialog.close();
      return;
    }

    if (control.tagName === 'SELECT') {
      const match = [...control.options].find((option) =>
        normalized(option.value) === normalized(entry.value || entry.name) ||
        normalized(option.textContent) === normalized(entry.name));
      if (match) setNativeValue(control, match.value);
      else { dialog.close(); control.focus(); return; }
    } else {
      // Usa eventos reales de input/change para que Vue actualice el retrato.
      setNativeValue(control, entry.value && entry.source === 'native' ? entry.value : entry.name);
    }
    dialog.close();
    control.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  async function openPicker() {
    dialog.showModal();
    search.focus();
    if (!catalog.length) {
      meta.textContent = 'Cargando personajes de la biblioteca...';
      showMessage('Buscando retratos', 'Se usa primero el catálogo del selector original y, si hace falta, el directorio del repositorio TEST.');
      await loadCatalog();
      if (!dialog.open) return;
      if (!catalog.length) {
        meta.textContent = 'El selector original sigue disponible debajo.';
        showMessage('No se pudo obtener un listado externo', 'Cierra esta ventana y usa «Personaje a elegir» en la web original. Tus assets y su motor se mantienen intactos.');
        return;
      }
    }
    renderList();
  }

  function scrollToNative(kind) {
    let target;
    if (kind === 'choose') target = findChampionControl();
    if (kind === 'customize') target = $('app')?.querySelector('select, input:not([type="checkbox"])');
    if (kind === 'export') target = $('app')?.querySelector('button.button-contest');
    if (!target) target = $('app');
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (kind === 'choose') target?.focus?.({ preventScroll: true });
    for (const item of document.querySelectorAll('.px-step')) item.classList.remove('is-current');
    $(`px-step-${kind}`)?.classList.add('is-current');
  }

  $('px-open-picker').addEventListener('click', () => { void openPicker(); });
  $('px-picker-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  search.addEventListener('input', () => {
    window.clearTimeout(queryDelay);
    queryDelay = window.setTimeout(renderList, 110);
  });
  $('px-step-choose').addEventListener('click', () => scrollToNative('choose'));
  $('px-step-customize').addEventListener('click', () => scrollToNative('customize'));
  $('px-step-export').addEventListener('click', () => scrollToNative('export'));
})();
