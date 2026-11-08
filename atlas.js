'use strict';
(() => {
  const data = window.PKGO_ATLAS;
  const $ = id => document.getElementById(id);
  if (!data?.yards?.length || !window.PKGO_DOMAIN) {
    const error = document.createElement('div');
    error.className = 'atlas-fatal';
    error.textContent = 'Данные карты не загрузились. Обновите страницу или откройте раздел «Документы».';
    document.body.append(error);
    return;
  }
  const {esc, money, number, summarize} = window.PKGO_DOMAIN;
  const normalized = value => String(value).toLocaleLowerCase('ru-RU').replaceAll('ё', 'е');
  const safeURL = value => {
    try {
      const url = new URL(value, location.href);
      return ['https:', 'http:'].includes(url.protocol) ? url.href : '#';
    } catch { return '#'; }
  };
  const external = (url, title, cls = '') => `<a class="${cls}" href="${esc(safeURL(url))}" target="_blank" rel="noopener noreferrer">${esc(title)}</a>`;
  const sections = ['overview', 'concepts', 'plans', 'estimate'];
  const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let selected = null, concept = null, section = 'overview', view = 0, map, markerLayer, tiles, lightMap = false;
  let lastTrigger = null;
  const markers = new Map();
  const viewerItems = new Map();
  let viewerGallery = [], viewerIndex = 0;
  function studioActions(mode = 'compare') {
    return `<div class="action-row"><a class="button-primary" href="studio.html?yard=${selected.id}&mode=${mode}&left=${esc(concept.id)}">${mode === 'estimate' ? 'Подробная проверка сметы' : mode === 'location' ? 'Проверка планов и адреса' : 'Сравнить два варианта'}</a><a class="button-secondary" href="studio.html?yard=${selected.id}&mode=album">Альбом · ${selected.concepts.reduce((sum, item) => sum + item.renders.length, 0)} рендеров</a></div>`;
  }
  function syncMobilePanel() {
    const modal = Boolean(selected) && innerWidth <= 900;
    const panel = $('detail-panel');
    panel.setAttribute('role', modal ? 'dialog' : 'region');
    if (modal) panel.setAttribute('aria-modal', 'true');
    else panel.removeAttribute('aria-modal');
    document.querySelectorAll('.topbar,.intro,.yard-sidebar,.map-wrap,.skip').forEach(element => { element.inert = modal; });
  }

  $('concept-count').textContent = data.yards.reduce((sum, y) => sum + y.concepts.length, 0);
  $('render-count').textContent = data.yards.reduce((sum, y) => sum + y.concepts.reduce((s, c) => s + c.renders.length, 0), 0);

  function filteredYards() {
    const query = normalized($('yard-search').value.trim());
    const status = $('status-filter').value;
    return data.yards.filter(y => (status === 'all' || y.statusCode === status) && normalized(`${y.name} ${y.address} ${y.theme}`).includes(query));
  }
  function renderList() {
    const visible = filteredYards();
    $('visible-count').textContent = `${visible.length} из 10`;
    $('yard-list').innerHTML = visible.length ? visible.map(y => `<button class="yard-card" data-yard="${y.id}" aria-pressed="${selected?.id === y.id}"><span class="number">${String(y.id).padStart(2, '0')}</span><span><strong>${esc(y.shortName)}</strong><small>${esc(y.address)}</small><small><i class="status-dot ${esc(y.statusCode)}" aria-hidden="true"></i>${esc(y.status)} · ${y.concepts.length} концепций</small></span></button>`).join('') : '<p class="empty-state">Дворы не найдены. Измените запрос или выберите все исходные проекты.</p>';
    if (!map) return;
    markerLayer.clearLayers();
    markers.clear();
    visible.forEach(y => {
      const icon = L.divIcon({className: 'yard-pin' + (selected?.id === y.id ? ' selected' : ''), html: `<div class="pin-inner"><span>${String(y.id).padStart(2, '0')}</span></div>`, iconSize: [38, 44], iconAnchor: [19, 42]});
      const marker = L.marker([y.geo.lat, y.geo.lon], {icon, keyboard: true, title: `${y.shortName} — открыть паспорт`, alt: `${y.shortName} — открыть паспорт`, riseOnHover: true}).addTo(markerLayer);
      const tooltip = document.createElement('span');
      tooltip.textContent = `${y.shortName} · ${y.geo.label}`;
      marker.bindTooltip(tooltip, {direction: 'top', offset: [0, -32]});
      marker.getElement().dataset.state = y.statusCode;
      marker.getElement().setAttribute('aria-label', `${y.shortName} — открыть паспорт`);
      marker.on('click', () => selectYard(y.id, {trigger: marker.getElement()}));
      markers.set(y.id, marker);
    });
  }
  function initializeMap() {
    if (!window.L) {
      $('map-error').hidden = false;
      $('map-error').textContent = 'Карта сейчас недоступна. Все паспорта и концепции можно открыть из списка слева.';
      $('show-all').disabled = true;
      $('toggle-map').disabled = true;
      return;
    }
    map = L.map('city-map', {zoomControl: false, scrollWheelZoom: true}).setView([53.025, 158.655], 12);
    L.control.zoom({position: 'bottomright'}).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
    setTiles();
    fitAll();
  }
  function setTiles() {
    if (tiles) map.removeLayer(tiles);
    const url = lightMap ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    tiles = L.tileLayer(url, {maxZoom: 19, subdomains: 'abcd', attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' + (lightMap ? ' © <a href="https://carto.com/attributions">CARTO</a>' : '')}).addTo(map);
    let errors = 0;
    tiles.on('tileerror', () => {
      if (++errors < 3) return;
      $('map-error').hidden = false;
      $('map-error').textContent = 'Фон карты загружается с перебоями. Точки и карточки доступны; можно переключить подложку.';
    });
    tiles.on('tileload', () => { $('map-error').hidden = true; });
  }
  function fitAll() {
    if (!map) return;
    map.fitBounds(data.yards.map(y => [y.geo.lat, y.geo.lon]), {paddingTopLeft: [55, 65], paddingBottomRight: [55, 90], animate: motion, maxZoom: 12});
  }
  function updateURL(replace = false) {
    const url = new URL(location.href);
    ['yard', 'concept', 'section'].forEach(key => url.searchParams.delete(key));
    if (selected) {
      url.searchParams.set('yard', selected.id);
      url.searchParams.set('section', section);
      if (concept) url.searchParams.set('concept', concept.id);
    }
    url.hash = '';
    const method = replace ? 'replaceState' : 'pushState';
    if (url.href !== location.href) history[method]({}, '', url);
  }
  function selectYard(id, options = {}) {
    const yard = data.yards.find(y => y.id === Number(id));
    if (!yard) return;
    const changedYard = selected?.id !== yard.id;
    selected = yard;
    concept = yard.concepts.find(c => c.id === options.conceptId) || (!changedYard && concept) || yard.concepts[0];
    section = sections.includes(options.section) ? options.section : (changedYard ? 'overview' : section);
    view = 0;
    lastTrigger = options.trigger || lastTrigger;
    $('detail-panel').hidden = false;
    document.body.classList.add('panel-open');
    syncMobilePanel();
    $('detail-kicker').textContent = `Территория ${String(yard.id).padStart(2, '0')} / 10 · исходный проект: ${yard.status}`;
    $('detail-title').textContent = yard.shortName;
    $('detail-address').textContent = yard.address;
    renderList();
    renderDetail();
    if (map && options.pan !== false) {
      const point = [yard.geo.lat, yard.geo.lon];
      const panelSpace = innerWidth > 900 ? $('detail-panel').offsetWidth + 16 : 0;
      map.fitBounds([point, point], {paddingTopLeft: [30, 30], paddingBottomRight: [panelSpace + 30, 30], maxZoom: 14, animate: motion});
    }
    if (options.history !== false) updateURL();
    $('announcement').textContent = `Открыт двор ${yard.shortName}. ${yard.concepts.length} концепций, планы и смета.`;
    if (options.focus !== false) $('detail-title').focus({preventScroll: true});
  }
  function closePanel(options = {}) {
    const closedYardId = selected?.id;
    selected = null;
    concept = null;
    $('detail-panel').hidden = true;
    document.body.classList.remove('panel-open');
    syncMobilePanel();
    renderList();
    if (options.history !== false) updateURL();
    if (options.focus !== false) {
      const rebuiltTrigger = lastTrigger?.classList.contains('yard-pin')
        ? markers.get(closedYardId)?.getElement()
        : document.querySelector(`[data-yard="${closedYardId}"]`);
      const returnTarget = lastTrigger?.isConnected ? lastTrigger : rebuiltTrigger || $('yard-search');
      returnTarget.focus({preventScroll: true});
    }
  }
  function openSection(value) {
    if (!selected || !sections.includes(value)) return;
    section = value;
    view = 0;
    renderDetail();
    updateURL();
  }
  function registerImage(image, title, disclosure = '') {
    const id = `image-${viewerItems.size}`;
    viewerItems.set(id, {src: image.src, title: title || image.title, disclosure});
    return id;
  }
  function cover(image, title, disclosure) {
    if (!image) return '<div class="loading-image">Визуализация готовится</div>';
    const key = registerImage(image, title, disclosure);
    return `<button class="cover-button" data-image="${key}" aria-label="Увеличить: ${esc(title)}"><img src="${esc(safeURL(image.src))}" alt="${esc(title)}" width="1536" height="1024" decoding="async"><span class="sr-only">Открыть на весь экран</span></button>`;
  }
  function sourceNotice() {
    return '<div class="notice">Новые концепции — эскизные предложения на основе реальных МАФов. Границы, размещение, зоны безопасности и стоимость работ требуют проектной проверки.</div>';
  }
  function sourceBudgetCard() {
    const has = Number.isFinite(selected.budget);
    return `<div class="fact"><small>${selected.budgetKind === 'promo' ? 'Стоимость исходной промо-концепции' : 'Оборудование по исходному КП'}</small><strong>${has ? money(selected.budget) : 'Нет документа'}</strong><div class="fact-note">${has ? esc(selected.budgetBasis) : 'Запросить коммерческое предложение'}</div></div>`;
  }
  function overviewHTML() {
    const hero = concept?.renders[0] || selected.originalImages[0];
    const heroTitle = concept?.renders[0] ? concept.title + ' · общий вид' : 'Исходная визуализация поставщика';
    const newHero = Boolean(concept?.renders[0]);
    return `${cover(hero, heroTitle, newHero ? concept.disclosure : 'Из исходных материалов проекта.')}<div class="cover-caption"><span>${newHero ? 'Новая эскизная концепция' : 'Исходные материалы'}</span><span>Нажмите для увеличения ↗</span></div><h3 style="margin-top:21px">${esc(newHero ? concept.title : selected.theme)}</h3><p>${esc(newHero ? concept.description : selected.description)}</p><div class="action-row"><button class="button-primary" data-open-section="concepts">Сравнить концепции →</button><button class="button-secondary" data-open-section="plans">Открыть планы</button></div><h4>Исходный проект: ${esc(selected.theme)}</h4>${newHero ? `<p>${esc(selected.description)}</p>` : ''}<div class="fact-grid"><div class="fact"><small>Площадь из исходных материалов</small><strong>${Number.isFinite(selected.area) ? number(selected.area) + ' м²' : 'Не задана'}</strong><div class="fact-note">${esc(selected.areaNote)}</div></div>${sourceBudgetCard()}</div><h4>Привязка к территории</h4><span class="pill amber">${esc(selected.locationStatus)}</span><p>${esc(selected.locationNote)}</p><p class="footer-link">${esc(selected.geo.label)} · ${esc(selected.geo.note)}</p><div class="action-row">${external(selected.searchURL, 'Проверить адрес на карте ↗', 'button-secondary')}${selected.locationSource ? external(selected.locationSource, 'Источник адреса ↗', 'button-secondary') : ''}</div>${sourceNotice()}<div class="action-row"><a class="button-secondary" href="review.html#yard-${selected.id}">Редактор комплектации ↗</a></div>`;
  }
  function conceptSelectorHTML() {
    return `<div class="concept-selector" aria-label="Концепции двора">${selected.concepts.map((c, index) => `<button class="concept-choice" data-concept="${esc(c.id)}" aria-pressed="${c.id === concept.id}" aria-label="Концепция ${index + 1}: ${esc(c.title)}">${c.renders[0] ? `<img src="${esc(safeURL(c.renders[0].thumb || c.renders[0].src))}" alt="" loading="lazy" decoding="async">` : '<div style="height:57px;background:#edf1eb"></div>'}<span>${String(index + 1).padStart(2, '0')}<br>${esc(c.title)}</span></button>`).join('')}</div>`;
  }
  function equipmentFacts(item) {
    const facts = [];
    if (item.manufacturer) facts.push(item.manufacturer);
    if (Object.hasOwn(item, 'dimensionsMm')) facts.push(Array.isArray(item.dimensionsMm) && item.dimensionsMm.length === 3 && item.dimensionsMm.every(Number.isFinite) ? 'Габариты: ' + item.dimensionsMm.map(value => number(value)).join(' × ') + ' мм' : 'Габариты не опубликованы');
    if (item.ageLabel) facts.push('Возраст: ' + item.ageLabel);
    if (Object.hasOwn(item, 'landingZoneMm')) facts.push(Array.isArray(item.landingZoneMm) && item.landingZoneMm.length === 2 && item.landingZoneMm.every(Number.isFinite) ? 'Зона приземления: ' + item.landingZoneMm.map(value => number(value)).join(' × ') + ' мм' : 'Зона приземления не опубликована');
    return facts.length ? '<small>' + facts.map(esc).join(' · ') + '</small>' : '';
  }
  function equipmentHTML(items) {
    return `<ul class="equipment-list">${items.map(item => `<li><span>${external(item.sourceURL, item.name)}<small>${item.codeKind === 'internal' ? 'Обозначение в подборке' : 'Артикул'} ${esc(item.code)}${item.priceConflict ? ' · расхождение цены в источнике' : item.price !== null ? ' · цена из исходного источника' : ' · цена по запросу'}</small>${equipmentFacts(item)}</span><span class="qty">${item.qty} шт.</span></li>`).join('')}</ul>`;
  }
  function conceptsHTML() {
    const current = concept.renders[view] || concept.renders[0];
    return `${conceptSelectorHTML()}<div class="concept-title"><h3>${esc(concept.title)}</h3><span class="pill">Эскиз</span></div>${cover(current, `${concept.title} · ${current?.title || 'визуализация'}`, concept.disclosure)}<div class="view-switch" aria-label="Ракурс концепции">${[0, 1].map(i => `<button data-view="${i}" aria-pressed="${view === i}" ${!concept.renders[i] ? 'disabled' : ''}>${i === 0 ? '01 · Общий вид' : '02 · Второй ракурс'}</button>`).join('')}</div><p>${esc(concept.description)}</p><div class="notice">${esc(concept.disclosure)}</div><h4>МАФы в основе концепции</h4>${equipmentHTML(concept.items)}<p class="footer-link">Озеленение, покрытия, освещение и места отдыха показаны как предложения. Их объёмы и стоимость уточняются отдельно.</p><div class="action-row"><button class="button-primary" data-open-section="estimate">Состав и стоимость →</button><button class="button-secondary" data-copy-link>Ссылка на концепцию ↗</button></div>`;
  }
  function imageGrid(images, emptyText) {
    if (!images.length) return `<div class="empty-state">${esc(emptyText)}</div>`;
    return `<div class="plan-grid">${images.map(image => {
      const key = registerImage(image, image.title, 'Исходный документ. Новые концепции не заменяют этот план.');
      return `<button class="plan-card" data-image="${key}"><img src="${esc(safeURL(image.src))}" alt="${esc(image.title)}" loading="lazy" decoding="async"><span>${esc(image.title)} ↗</span></button>`;
    }).join('')}</div>`;
  }
  function filesHTML(files) {
    return `<ul class="file-list">${files.map(file => `<li>${external(file.src, file.name + ' ↗')}<small>${esc(file.label || file.type)}${file.size ? ' · ' + esc(file.size) : ''}</small></li>`).join('')}</ul>`;
  }
  function plansHTML() {
    return `<h3>Исходные схемы площадок</h3><p>Схемы из папки двора показывают размеры или сценарные зоны. Географические границы не подтверждены; для точной посадки новых концепций нужны обмеры и геопривязка.</p>${imageGrid(selected.plans, 'Исходный план этого двора пока не предоставлен. Для точной посадки нужны обмеры и границы участка.')}<h4>Документы и оригиналы</h4>${selected.files.length ? filesHTML(selected.files) : '<div class="empty-state">Папка исходных материалов пока пуста. Новые эскизы доступны в разделе «Концепции».</div>'}<h4>Визуализации из исходного проекта</h4>${imageGrid(selected.originalImages, 'Исходных визуализаций поставщика нет.')}<div class="action-row"><a class="button-secondary" href="sources.html">Все исходные документы ↗</a></div>`;
  }
  function subtotal(items) {
    return summarize(items).knownSubtotal;
  }
  function itemTable(items, label) {
    if (!items.length) return '<p>Детализация оборудования не предоставлена.</p>';
    const unknown = items.filter(item => !Number.isFinite(item.price)).length;
    return `<div class="table-wrap"><table><caption class="sr-only">${esc(label)}</caption><thead><tr><th>Оборудование</th><th>Кол.</th><th>Цена, ₽</th><th>Сумма, ₽</th></tr></thead><tbody>${items.map(item => `<tr><td>${esc(item.name)}<small>${esc(item.code)}</small>${equipmentFacts(item)}${item.priceConflict ? `<small>${esc(item.priceConflict)}</small>` : ''}</td><td>${item.qty}</td><td>${Number.isFinite(item.price) ? number(item.price) : 'По запросу'}</td><td>${Number.isFinite(item.price) ? number(item.price * item.qty) : '—'}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="3">${unknown === items.length ? 'Стоимость оборудования' : unknown ? 'Известная часть оборудования' : 'Сумма оборудования'}</td><td>${unknown === items.length ? 'Не определена' : money(subtotal(items))}</td></tr></tfoot></table></div>${unknown ? `<p class="footer-link">${unknown} позиций без цены. Итоговая стоимость не определена; неизвестные цены не считаются нулевыми.</p>` : ''}`;
  }
  function estimateHTML() {
    const documents = selected.files.filter(file => ['estimate', 'excel', 'pdf'].includes(file.role) || file.type === 'excel' || file.type === 'pdf');
    return `<h3>Финансовые исходники двора</h3><div class="finance-block"><small>${selected.budgetKind === 'promo' ? 'Промо-концепция поставщика' : 'По документам проекта'}</small><strong>${Number.isFinite(selected.budget) ? money(selected.budget) : 'Смета не предоставлена'}</strong><small>${esc(selected.budgetBasis)}</small></div>${documents.length ? filesHTML(documents) : '<p>Для этого двора нет подтверждённого сметного документа. Предварительные оценки старой панели не включены в стоимость.</p>'}<details><summary style="font-size:12px;cursor:pointer;margin:16px 0">Состав исходного проекта</summary>${itemTable(selected.originalItems, 'Исходная комплектация')}</details><h4>Новая концепция: ${esc(concept.title)}</h4>${conceptSelectorHTML()}${itemTable(concept.items, 'Оборудование выбранной концепции')}<div class="notice">Стоимость нового благоустройства не утверждена. Цены из исходных смет относятся к конкретным изделиям и дате документа. Покрытия, основание, земляные работы, озеленение, освещение, монтаж и доставка требуют отдельного расчёта. В трёх исходных КП НДС уже включён; повторно он не начисляется. Исходный бюджет не является ценой новой концепции.</div><div class="action-row"><button class="button-primary" data-export>Скачать состав · CSV ↓</button><a class="button-secondary" href="review.html#yard-${selected.id}">Редактор исходных вариантов ↗</a></div>`;
  }
  function renderDetail() {
    viewerItems.clear();
    document.querySelectorAll('[data-section]').forEach(tab => {
      const active = tab.dataset.section === section;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    $('detail-body').setAttribute('aria-labelledby', `tab-${section}`);
    const renderers = {overview: overviewHTML, concepts: conceptsHTML, plans: plansHTML, estimate: estimateHTML};
    const mode = section === 'plans' ? 'location' : section === 'estimate' ? 'estimate' : 'compare';
    $('detail-body').innerHTML = studioActions(mode) + renderers[section]();
    $('detail-body').scrollTop = 0;
  }
  function openImage(key) {
    const image = viewerItems.get(key);
    if (!image) return;
    const concepts = selected.concepts.flatMap(c => c.renders.map(render => ({src:render.src,title:c.title + ' · ' + render.title,disclosure:c.disclosure})));
    viewerGallery = concepts.some(item => item.src === image.src) ? concepts : [...viewerItems.values()];
    viewerIndex = Math.max(0, viewerGallery.findIndex(item => item.src === image.src));
    updateViewer();
    $('image-viewer').showModal();
  }
  function updateViewer() {
    const image = viewerGallery[viewerIndex];
    $('viewer-title').textContent = image.title;
    $('viewer-image').src = safeURL(image.src);
    $('viewer-image').alt = image.title;
    $('viewer-description').textContent = image.disclosure;
    $('viewer-download').href = safeURL(image.src);
    $('viewer-counter').textContent = `${viewerIndex + 1} / ${viewerGallery.length}`;
    $('viewer-previous').disabled = viewerIndex === 0;
    $('viewer-next').disabled = viewerIndex === viewerGallery.length - 1;
  }
  function changeViewer(delta) {
    const next = viewerIndex + delta;
    if (next < 0 || next >= viewerGallery.length) return;
    viewerIndex = next;
    updateViewer();
  }
  function exportConcept() {
    const cell = value => '"' + String(value ?? '').replace(/^[=+@\-]/, "'$&").replaceAll('"', '""') + '"';
    const rows = [['Двор', 'Концепция', 'Артикул', 'МАФ', 'Количество', 'Цена', 'Сумма', 'Основание цены', 'Источник']];
    concept.items.forEach(item => rows.push([selected.shortName, concept.title, item.code, item.name, item.qty, item.price, Number.isFinite(item.price) ? item.price * item.qty : '', item.priceBasis, item.sourceURL]));
    rows.push(['Примечание', 'Эскизная концепция. Стоимость работ, доставки и монтажа не определена.']);
    const blob = new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ПКГО-двор-${selected.id}-${concept.id}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function readURL() {
    const params = new URLSearchParams(location.search);
    const id = Number(params.get('yard'));
    const yard = data.yards.find(y => y.id === id);
    if (yard) {
      const urlConcept = yard.concepts.find(item => item.id === params.get('concept')) || yard.concepts[0];
      const urlSection = sections.includes(params.get('section')) ? params.get('section') : 'overview';
      selectYard(id, {conceptId: urlConcept.id, section: urlSection, history: false, focus: false});
    }
    else closePanel({history: false, focus: false});
  }
  $('yard-list').addEventListener('click', event => {
    const button = event.target.closest('[data-yard]');
    if (button) selectYard(Number(button.dataset.yard), {trigger: button});
  });
  ['yard-search', 'status-filter'].forEach(id => $(id).addEventListener('input', renderList));
  $('show-all').onclick = () => {
    $('yard-search').value = '';
    $('status-filter').value = 'all';
    closePanel({focus: false});
    fitAll();
    $('announcement').textContent = 'На карте показаны все десять дворов.';
  };
  $('toggle-map').onclick = () => {
    lightMap = !lightMap;
    $('toggle-map').setAttribute('aria-pressed', String(lightMap));
    $('toggle-map').textContent = lightMap ? 'Обычная карта' : 'Светлая карта';
    setTiles();
  };
  $('close-panel').onclick = () => closePanel();
  document.querySelector('.detail-tabs').addEventListener('click', event => {
    const tab = event.target.closest('[data-section]');
    if (tab) openSection(tab.dataset.section);
  });
  document.querySelector('.detail-tabs').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let index = sections.indexOf(section);
    index = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (index + (event.key === 'ArrowRight' ? 1 : 3)) % 4;
    openSection(sections[index]);
    $(`tab-${sections[index]}`).focus();
  });
  $('detail-body').addEventListener('click', async event => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.openSection) { openSection(target.dataset.openSection); $('detail-body').focus({preventScroll: true}); }
    if (target.dataset.concept) {
      concept = selected.concepts.find(c => c.id === target.dataset.concept) || concept;
      view = 0;
      renderDetail();
      updateURL();
      document.querySelector(`[data-concept="${concept.id}"]`)?.focus({preventScroll: true});
    }
    if (target.hasAttribute('data-view')) { view = Number(target.dataset.view); renderDetail(); document.querySelector(`[data-view="${view}"]`)?.focus({preventScroll: true}); }
    if (target.dataset.image) openImage(target.dataset.image);
    if (target.hasAttribute('data-export')) exportConcept();
    if (target.hasAttribute('data-copy-link')) {
      try { await navigator.clipboard.writeText(location.href); target.textContent = 'Ссылка скопирована ✓'; }
      catch { target.textContent = 'Скопируйте адрес из строки браузера'; }
    }
  });
  $('detail-body').addEventListener('error', event => {
    if (event.target.tagName !== 'IMG') return;
    const image = event.target;
    const note = document.createElement('span');
    note.className = 'empty-state';
    note.textContent = 'Изображение не загрузилось. Откройте оригинал или обновите страницу.';
    image.replaceWith(note);
  }, true);
  $('viewer-close').onclick = () => $('image-viewer').close();
  $('viewer-previous').onclick = () => changeViewer(-1);
  $('viewer-next').onclick = () => changeViewer(1);
  $('image-viewer').addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    changeViewer(event.key === 'ArrowLeft' ? -1 : 1);
  });
  $('image-viewer').addEventListener('click', event => { if (event.target === $('image-viewer')) $('image-viewer').close(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && selected && !$('image-viewer').open) closePanel();
    if (event.key === 'Tab' && selected && innerWidth <= 900 && !$('image-viewer').open) {
      const focusable = [...$('detail-panel').querySelectorAll('button,a[href],input,select,[tabindex="0"]')].filter(element => !element.disabled && element.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === $('detail-title'))) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  window.addEventListener('popstate', readURL);
  window.addEventListener('resize', syncMobilePanel);
  initializeMap();
  renderList();
  readURL();
})();
