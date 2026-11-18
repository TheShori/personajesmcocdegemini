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
  let selectedValue = null;
  const app = $('app');
  // El motor ORIGINAL se monta una única vez y se mueve sin destruir el DOM,
  // sus componentes Vue, los listeners ni los canvas de previsualización.
  const originalLocation = document.createComment('Ubicación original del editor Portrayer');
  app?.parentNode?.insertBefore(originalLocation, app);

  function mountEditorInSearch() {
    const host = $('px-editor-target');
    if (app && host && app.parentNode !== host) host.appendChild(app);
  }

  function restoreEditor() {
    if (app && originalLocation.parentNode && app.parentNode !== originalLocation.parentNode) {
      originalLocation.parentNode.insertBefore(app, originalLocation.nextSibling);
    }
  }

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
    if (!q) {
      meta.textContent = 'Escribe el nombre de un campeón para buscarlo.';
      showMessage('¿Qué campeón quieres crear?', 'Prueba con Electro, Thanos o Elsa Bloodstone. La ficha completa aparecerá a la derecha.');
      return;
    }
    const matching = catalog.filter((entry) => normalized(entry.name).includes(q));
    meta.textContent = `${matching.length} campeón${matching.length === 1 ? '' : 'es'} encontrado${matching.length === 1 ? '' : 's'}`;
    if (!matching.length) {
      showMessage('Sin coincidencias', 'Prueba otro nombre o utiliza el selector del editor original.');
      return;
    }
    // Se mantiene una lista reducida para las variantes (por ejemplo, varios Thanos).
    // La ficha GRANDE se genera en el mismo buscador, no se abre otra pantalla.
    results.replaceChildren(...matching.slice(0, MAX_SHOWN).map(cardFor));

    // «Electro» coincide también con «Alt Electro Luke»; preferimos SIEMPRE
    // el nombre exacto. Si solo hay una coincidencia y la búsqueda es suficientemente
    // clara, también la preseleccionamos sin exigir un clic adicional.
    const exact = matching.find((entry) => normalized(entry.name) === q);
    const obvious = matching.length === 1 && q.length >= 3 ? matching[0] : null;
    const choice = exact || obvious;
    if (choice && normalized(selectedValue) !== normalized(choice.value || choice.name)) {
      pickChampion(choice, { automatic: true });
    }
    for (const button of results.querySelectorAll('.px-champ')) {
      const name = normalized(button.querySelector('.px-champ__name')?.textContent);
      const active = selectedValue && name === normalized(selectedValue);
      button.classList.toggle('is-active', Boolean(active));
      button.setAttribute('aria-pressed', String(Boolean(active)));
    }
  }

  function setNativeValue(element, value) {
    const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) setter.call(element, value);
    else element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * La selección actualiza la ficha original sin cerrar la biblioteca.
   * Es el mismo #app Vue que queda disponible debajo al cerrar el buscador.
   */
  function showEditor(championName) {
    const main = document.querySelector('.px-main');
    const bar = $('px-editing-bar');
    if (main && bar) {
      $('px-editing-name').textContent = championName;
      bar.hidden = false;
      main.classList.add('is-editing');
    }
    $('px-inline-name').textContent = championName;
  }

  function nativeCandidateValue(control, entry) {
    // Evita enviar un nombre humanizado diferente al esperado por el motor.
    const options = control.tagName === 'SELECT'
      ? [...control.options]
      : control.list ? [...control.list.options] : [...(document.querySelector('#app datalist')?.options || [])];
    const wanted = [entry.value, entry.name].filter(Boolean).map(normalized);
    const match = options.find((option) =>
      wanted.includes(normalized(option.value)) ||
      wanted.includes(normalized(option.label || option.textContent)));
    if (match) return match.value;
    return control.tagName === 'SELECT' ? null : (entry.source === 'native' && entry.value ? entry.value : entry.name);
  }

  function pickChampion(entry, { automatic = false } = {}) {
    const control = findChampionControl();
    if (!control) {
      if (!automatic) showMessage('Editor no disponible', 'El motor original todavía no ha cargado. Recarga la página e inténtalo de nuevo.');
      return false;
    }
    const value = nativeCandidateValue(control, entry);
    if (!value) {
      if (!automatic) showMessage('Campeón no disponible', 'No aparece en las opciones del editor original. Elige otro campeón.');
      return false;
    }

    // Solo actualizamos el modelo si cambia la selección; de esta forma
    // no se reinician nombre, potencia, clase ni otros valores ya editados.
    if (normalized(control.value) !== normalized(value)) setNativeValue(control, value);
    selectedValue = entry.value || entry.name;
    showEditor(entry.name);
    // La nueva pestaña escucha esta señal y dibuja su propia placa de estrellas.
    document.dispatchEvent(new CustomEvent('px:champion-selected', { detail: { name: entry.name, value } }));
    // Tras elegir un campeón en la pestaña de estrellas volvemos al editor nuevo.
    if (document.body.classList.contains('px-stars-mode') && dialog.open) {
      dialog.close();
    }
    // Señal visual de qué personaje está seleccionado actualmente.
    for (const item of results.querySelectorAll('.px-champ')) {
      const active = normalized(item.querySelector('.px-champ__name')?.textContent) === normalized(entry.name);
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    }
    return true;
  }

  async function openPicker() {
    if (!dialog.open) dialog.showModal();
    mountEditorInSearch();
    search.focus({ preventScroll: true });
    if (!catalog.length) {
      meta.textContent = 'Cargando biblioteca de campeones…';
      showMessage('Buscando retratos', 'Se está cargando el catálogo del selector original.');
      await loadCatalog();
      if (!dialog.open) return;
      if (!catalog.length) {
        meta.textContent = 'Biblioteca no disponible';
        showMessage('No se pudo cargar el catálogo', 'Puedes editar el personaje desde el campo «Personaje a elegir» de la ficha original.');
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
  $('px-change-champion').addEventListener('click', () => { void openPicker(); });
  $('px-picker-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    // Cuando se cierra el buscador se devuelve el editor a su lugar sin recrearlo.
    restoreEditor();
    if (document.body.classList.contains('px-stars-mode')) return;
    if (document.querySelector('.px-main.is-editing')) {
      const bar = $('px-editing-bar');
      requestAnimationFrame(() => bar?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  });
  search.addEventListener('input', () => {
    window.clearTimeout(queryDelay);
    queryDelay = window.setTimeout(renderList, 110);
  });
  $('px-step-choose').addEventListener('click', () => scrollToNative('choose'));
  $('px-step-customize').addEventListener('click', () => scrollToNative('customize'));
  $('px-step-export').addEventListener('click', () => scrollToNative('export'));
})();
