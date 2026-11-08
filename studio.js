'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const data = window.PKGO_ATLAS;
  const domain = window.PKGO_DOMAIN;
  if (!data?.yards?.length || !domain || !window.PKGO_EVIDENCE?.yards) {
    $('studio-content').innerHTML = '<p class="studio-error">Материалы не загрузились. Обновите страницу или вернитесь к карте.</p>';
    return;
  }
  const {esc, money, number, summarize, csv} = domain;
  const href = value => esc(domain.safeURL(value, location.href));
  const link = (url, text) => `<a href="${href(url)}" target="_blank" rel="noopener noreferrer">${esc(text)} ↗</a>`;
  const modes = {compare:'Сравните концепции', estimate:'Сметы и комплектация', location:'Планы и привязка к территории', album:'Альбом концепций'};
  let yard, left, right, mode, view;
  const evidence = () => window.PKGO_EVIDENCE.yards.find(item => item.id === yard.id) || {finance:{}, location:{}};
  function readState() {
    const params = new URLSearchParams(location.search);
    yard = data.yards.find(item => item.id === Number(params.get('yard'))) || data.yards[0];
    mode = Object.hasOwn(modes, params.get('mode')) ? params.get('mode') : 'compare';
    left = yard.concepts.find(item => item.id === params.get('left')) || yard.concepts[0];
    right = yard.concepts.find(item => item.id === params.get('right') && item.id !== left.id) || yard.concepts.find(item => item.id !== left.id);
    view = params.get('view') === '2' ? 1 : 0;
  }
  function urlFor(nextMode = mode) {
    const url = new URL(location.href);
    url.search = new URLSearchParams({yard:String(yard.id),mode:nextMode,left:left.id,right:right.id,view:String(view + 1)}).toString();
    url.hash = '';
    return url;
  }
  function saveState() {
    const url = urlFor();
    if (url.href !== location.href) history.pushState({}, '', url);
  }
  function statusSummary(items) {
    const totals = summarize(items);
    return `<div class="metric-grid"><div><small>${totals.complete ? 'Оборудование по известным ценам' : 'Известная часть оборудования'}</small><strong>${items.length > totals.unknownCount ? money(totals.knownSubtotal) : 'Нет цен'}</strong></div><div><small>Позиций без подтверждённой цены</small><strong>${totals.unknownCount} из ${items.length}</strong></div></div><p class="source-note">Стоимость всего благоустройства не определена. ${totals.conflictCount ? `В ${totals.conflictCount} позициях цены источника противоречат друг другу.` : 'Цены оборудования относятся к указанным исходным документам.'}</p>`;
  }
  function equipmentFacts(item) {
    const facts = [];
    if (item.manufacturer) facts.push(item.manufacturer);
    if (Object.hasOwn(item, 'dimensionsMm')) facts.push(Array.isArray(item.dimensionsMm) && item.dimensionsMm.length === 3 && item.dimensionsMm.every(Number.isFinite) ? 'Габариты: ' + item.dimensionsMm.map(value => number(value)).join(' × ') + ' мм' : 'Габариты не опубликованы');
    if (item.ageLabel) facts.push('Возраст: ' + item.ageLabel);
    if (Object.hasOwn(item, 'landingZoneMm')) facts.push(Array.isArray(item.landingZoneMm) && item.landingZoneMm.length === 2 && item.landingZoneMm.every(Number.isFinite) ? 'Зона приземления: ' + item.landingZoneMm.map(value => number(value)).join(' × ') + ' мм' : 'Зона приземления не опубликована');
    return facts.length ? '<small>' + facts.map(esc).join(' · ') + '</small>' : '';
  }
  function equipmentTable(items, caption) {
    const totals = summarize(items);
    return `<div class="table-wrap"><table><caption class="sr-only">${esc(caption)}</caption><thead><tr><th>МАФ и источник</th><th>Кол.</th><th>Цена, ₽</th><th>Сумма, ₽</th></tr></thead><tbody>${items.map(item => `<tr><td>${esc(item.name)}<small>${item.codeKind === 'internal' ? 'Обозначение в подборке' : 'Артикул'}: ${esc(item.code)} · ${link(item.sourceURL, 'Источник')}</small>${equipmentFacts(item)}${item.priceConflict ? `<small>Расхождение в источнике: ${esc(item.priceConflict)}</small>` : ''}</td><td>${number(item.qty)}</td><td>${item.priceConflict ? 'Уточнить' : Number.isFinite(item.price) ? number(item.price) : 'По запросу'}</td><td>${Number.isFinite(item.price) && !item.priceConflict ? number(Math.round(item.qty * item.price * 100) / 100) : '—'}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="3">${totals.complete ? 'Сумма оборудования' : 'Известная часть оборудования'}</td><td>${items.length > totals.unknownCount ? money(totals.knownSubtotal) : 'Не определена'}</td></tr></tfoot></table></div>`;
  }
  function conceptOptions(selectedId) {
    return yard.concepts.map((item, index) => `<option value="${esc(item.id)}" ${item.id === selectedId ? 'selected' : ''}>${index + 1}. ${esc(item.title)}</option>`).join('');
  }
  function comparisonCard(item, side) {
    const image = item.renders[view];
    return `<article class="comparison-card"><label class="comparison-controls" for="concept-${side}">${side === 'left' ? 'Первый вариант' : 'Второй вариант'}<select id="concept-${side}" data-choice="${side}">${conceptOptions(item.id)}</select></label><a href="${href(image.src)}" target="_blank" rel="noopener noreferrer" aria-label="Открыть изображение: ${esc(item.title)}"><img src="${href(image.src)}" alt="${esc(item.title)} — ${esc(image.title)}" width="1536" height="1024"></a><div class="comparison-body"><h2>${esc(item.title)}</h2><p>${esc(item.description)}</p>${statusSummary(item.items)}<ul class="equipment-list">${item.items.map(maf => `<li><span>${esc(maf.name)}<small>${esc(maf.code)}</small>${equipmentFacts(maf)}</span><strong>${number(maf.qty)} шт.</strong></li>`).join('')}</ul><div class="action-row"><a class="button-secondary" href="./?yard=${yard.id}&section=concepts&concept=${esc(item.id)}">Открыть на карте</a><a class="button-secondary" href="${href(image.src)}" download>Скачать ракурс ↓</a></div></div></article>`;
  }
  function compareHTML() {
    const keys = [...new Set([...left.items, ...right.items].map(item => item.code + '\u0000' + item.name))];
    const rows = keys.map(key => {
      const find = items => items.find(item => item.code + '\u0000' + item.name === key);
      const a = find(left.items), b = find(right.items);
      return {item:a || b, a:a?.qty || 0, b:b?.qty || 0};
    }).filter(row => row.a !== row.b);
    return `<div class="compare-toolbar"><p>Выберите два варианта одного двора. Одинаковый номер ракурса помогает сравнить решения; изображения остаются эскизами.</p><div class="view-switch" aria-label="Ракурс сравнения"><button data-studio-view="0" aria-pressed="${view === 0}">01 · Общий вид</button><button data-studio-view="1" aria-pressed="${view === 1}">02 · Второй ракурс</button></div></div><div class="compare-grid">${comparisonCard(left, 'left')}${comparisonCard(right, 'right')}</div><section class="audit-section comparison-differences"><h2>Разница в комплектации</h2>${rows.length ? `<div class="table-wrap"><table><thead><tr><th>МАФ</th><th>${esc(left.title)}</th><th>${esc(right.title)}</th></tr></thead><tbody>${rows.map(row => `<tr><td>${esc(row.item.name)}<small>${esc(row.item.code)}</small></td><td>${row.a} шт.</td><td>${row.b} шт.</td></tr>`).join('')}</tbody></table></div>` : '<p>Состав и количество МАФов совпадают. Варианты различаются компоновкой, озеленением, покрытиями или сценарием использования, показанными на рендерах.</p>'}<p class="source-note">Участки и зоны безопасности не подтверждаются изображениями. Проверка по исходным планам — в разделе «Планы и привязка».</p></section>`;
  }
  function issuesHTML(issues = []) {
    return issues.length ? `<ul class="audit-issues">${issues.map(issue => `<li><strong>${esc(issue.title)}</strong>${esc(issue.detail)}${issue.source ? `<br>${link(issue.source, issue.cell ? 'Источник · ' + issue.cell : 'Источник')}` : ''}</li>`).join('')}</ul>` : '<p>В доступных материалах дополнительные противоречия не выявлены.</p>';
  }
  function financeHTML() {
    const finance = evidence().finance;
    const reconciliation = finance.reconciliation || {};
    return `<section class="audit-section"><h2>Исходный проект</h2><div class="audit-summary"><div class="fact"><small>Сумма в исходном документе</small><strong>${money(yard.budget)}</strong><div class="fact-note">${esc(yard.budgetBasis)}</div></div><div class="fact"><small>Сумма строк источника</small><strong>${money(reconciliation.itemsTotal)}</strong></div><div class="fact"><small>Разница с итогом документа</small><strong>${Number.isFinite(reconciliation.difference) ? money(reconciliation.difference) : 'Не проверена'}</strong></div></div><p>${esc(reconciliation.summary || 'Подробная смета этого двора не предоставлена. Стоимость работ и комплектующих не рассчитана.')}</p><ul class="file-list">${(finance.documents || []).map(doc => `<li>${link(doc.publicPath, doc.title)}<small>${esc(doc.date || 'Дата не подтверждена')}${doc.dateBasis ? ' · ' + esc(doc.dateBasis) : ''}</small></li>`).join('')}</ul><h3>Проверка источников</h3>${issuesHTML(finance.issues)}${sourceTable(finance.verifiedItems || [])}<p>${esc(reconciliation.vatNote || 'НДС в доступных материалах не выделен.')}</p><p>${esc(reconciliation.deliveryNote || 'Стоимость доставки не определена.')}</p><p>${esc(reconciliation.worksNote || 'Работы и монтаж требуют отдельного расчёта.')}</p></section><section class="audit-section"><h2>Комплектация новой концепции</h2><label for="estimate-concept">Выберите концепцию</label> <select id="estimate-concept" data-choice="left">${conceptOptions(left.id)}</select>${statusSummary(left.items)}${equipmentTable(left.items, left.title)}<h3>Остальные затраты</h3><div class="table-wrap"><table><thead><tr><th>Раздел</th><th>Статус расчёта</th></tr></thead><tbody>${['Основание, земляные работы и водоотведение','Покрытия и бордюры','Озеленение','Наружное освещение и подключение','Доставка и разгрузка','Монтаж, фундаменты и подготовка площадки'].map(name => `<tr><td>${name}</td><td>Объёмы и цена не определены</td></tr>`).join('')}</tbody></table></div><p class="source-note">Общий итог не складывается из неполных данных. НДС повторно не начисляется на цены, в которых он уже учтён. Подсветка отдельных МАФов не заменяет проект наружного освещения.</p><div class="action-row"><button class="button-primary" data-studio-csv>Скачать ведомость · CSV ↓</button><a class="button-secondary" href="./?yard=${yard.id}&section=estimate&concept=${esc(left.id)}">Смета в карточке карты</a></div></section>`;
  }
  function sourceTable(items) {
    if (!items.length) return '';
    return `<details><summary>Проверенные строки исходного документа (${items.length})</summary><div class="table-wrap"><table><thead><tr><th>Позиция и основание</th><th>Кол.</th><th>Цена источника, ₽</th><th>Сумма источника, ₽</th></tr></thead><tbody>${items.map(item => `<tr><td>${esc(item.name)}<small>${item.code ? 'Артикул: ' + esc(item.code) : 'Артикул не указан'} · ${esc(item.page ? 'Страница ' + item.page : Object.values(item.cells || {}).join(', '))}</small>${item.quantityBasis ? `<small>${esc(item.quantityBasis)}</small>` : ''}${item.conflict ? '<small>Цена × количество не совпадает с суммой строки.</small>' : ''}</td><td>${number(item.qty)} ${esc(item.unit || 'шт.')}</td><td>${Number.isFinite(item.unitPrice) ? number(item.unitPrice) : 'Не дана отдельно'}</td><td>${number(item.lineTotal)}</td></tr>`).join('')}</tbody></table></div></details>`;
  }
  function locationHTML() {
    const locationAudit = evidence().location;
    const dims = locationAudit.dimensions || {};
    const review = locationAudit.addressReview || {};
    const checklist = locationAudit.missing || [];
    return `<div class="location-grid"><section class="location-card"><span class="status-label unresolved">Границы участка не подтверждены</span><h2>Адрес и точка на карте</h2><p>${esc(review.evidence || yard.locationNote)}</p><dl><dt>Адрес</dt><dd>${esc(yard.address)}</dd><dt>Точность точки</dt><dd>${esc(yard.geo.label)}</dd><dt>Координаты</dt><dd>${yard.geo.lat.toFixed(7)}, ${yard.geo.lon.toFixed(7)}</dd><dt>Площадь</dt><dd>${Number.isFinite(yard.area) ? number(yard.area) + ' м²' : 'Не подтверждена'}</dd><dt>Основание</dt><dd>${esc(yard.areaNote)}</dd></dl><p>${esc(dims.scope || '')}</p><div class="action-row">${link(yard.geo.source, 'Источник координат')}${review.source ? link(review.source, 'Источник адреса') : ''}${link(yard.searchURL, 'Открыть адрес на карте')}</div><a class="button-secondary" href="yards.geojson" download>Все адресные ориентиры · GeoJSON ↓</a><p class="source-note">GeoJSON содержит точки-ориентиры. Кадастровых границ и проектируемых контуров в нём нет.</p></section><section class="location-card"><h2>Что нужно для точной посадки</h2><ul class="requirements-list">${checklist.map(item => `<li>${esc(item)}</li>`).join('')}</ul><p class="source-note">До получения этих данных невозможно подтвердить посадку МАФов, площадь работ и окончательную смету.</p></section></div><section class="audit-section"><h2>Исходные планы и схемы</h2>${yard.plans.length ? `<div class="document-grid">${yard.plans.map(plan => `<article class="document-card"><a href="${href(plan.src)}" target="_blank" rel="noopener noreferrer"><img src="${href(plan.src)}" alt="${esc(plan.title)}" loading="lazy"></a><div>${link(plan.src, plan.title)}</div></article>`).join('')}</div>` : '<p>План участка не предоставлен. Рендеры не заменяют чертёж с размерами.</p>'}<h3>Уточнения и противоречия</h3>${issuesHTML(locationAudit.issues)}</section>`;
  }
  function albumHTML() {
    return `<section class="audit-section"><h2>${esc(yard.shortName)} · ${yard.concepts.length} концепций · ${yard.concepts.reduce((sum, item) => sum + item.renders.length, 0)} рендеров</h2><p>Альбом объединяет визуализации, комплектацию и проверку исходных материалов. PDF можно скачать для встречи и печати.</p><div class="action-row"><a class="button-primary" href="albums/yard-${String(yard.id).padStart(2,'0')}.pdf" download>Скачать альбом · PDF ↓</a><a class="button-secondary" href="${href(urlFor('location'))}">Проверка планов и привязки</a></div><nav class="album-index" aria-label="Концепции в альбоме">${yard.concepts.map((c,i) => `<a href="#album-${esc(c.id)}">${i+1}. ${esc(c.title)}</a>`).join('')}</nav></section>${yard.concepts.map((c,i) => `<article class="album-concept" id="album-${esc(c.id)}"><p class="eyebrow">Концепция ${i+1} из ${yard.concepts.length}</p><h2>${esc(c.title)}</h2><p>${esc(c.description)}</p><div class="album-pair">${c.renders.map((image,j) => `<figure><a href="${href(image.src)}" target="_blank" rel="noopener noreferrer"><img src="${href(image.src)}" alt="${esc(c.title)} — ракурс ${j+1}" width="1536" height="1024" loading="lazy"></a><figcaption>${j+1}. ${esc(image.title)}</figcaption></figure>`).join('')}</div>${equipmentTable(c.items, c.title)}<p class="source-note">${esc(c.disclosure)}</p></article>`).join('')}`;
  }
  function render() {
    $('studio-title').textContent = modes[mode];
    $('studio-address').textContent = `${yard.shortName} · ${yard.address}`;
    $('studio-yard').value = String(yard.id);
    $('album-link').href = `albums/yard-${String(yard.id).padStart(2,'0')}.pdf`;
    $('album-link').download = `ПКГО-${yard.shortName}-${yard.concepts.length}-концепций.pdf`;
    document.querySelectorAll('[data-mode]').forEach(anchor => {
      anchor.href = urlFor(anchor.dataset.mode).href;
      if (anchor.dataset.mode === mode) anchor.setAttribute('aria-current','page'); else anchor.removeAttribute('aria-current');
    });
    $('studio-content').innerHTML = ({compare:compareHTML,estimate:financeHTML,location:locationHTML,album:albumHTML})[mode]();
    document.title = `${yard.shortName} · ${modes[mode]} · Дворы ПКГО`;
  }
  function exportCSV() {
    const rows = [['Двор','Концепция','Артикул / обозначение','МАФ','Количество','Цена','Сумма','Статус цены','Источник']];
    left.items.forEach(item => rows.push([yard.shortName,left.title,item.code,item.name,item.qty,item.priceConflict ? '' : item.price,Number.isFinite(item.price) && !item.priceConflict ? Math.round(item.price * item.qty * 100) / 100 : '',item.priceConflict || item.priceBasis,item.sourceURL]));
    rows.push(['Примечание','Частичная ведомость оборудования. Итог благоустройства не определён. Неизвестные цены не равны нулю.']);
    const url = URL.createObjectURL(new Blob([csv(rows)],{type:'text/csv;charset=utf-8'}));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `ПКГО-${left.id}-ведомость.csv`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  $('studio-yard').innerHTML = data.yards.map(item => `<option value="${item.id}">${String(item.id).padStart(2,'0')} · ${esc(item.shortName)}</option>`).join('');
  $('studio-yard').addEventListener('change', () => {
    yard = data.yards.find(item => item.id === Number($('studio-yard').value));
    left = yard.concepts[0]; right = yard.concepts[1]; view = 0; saveState(); render();
    $('studio-status').textContent = `Выбран двор ${yard.shortName}`;
  });
  document.querySelector('.studio-nav').addEventListener('click', event => {
    const anchor = event.target.closest('[data-mode]');
    if (!anchor || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault(); mode = anchor.dataset.mode; saveState(); render(); $('studio-content').focus({preventScroll:true});
  });
  $('studio-content').addEventListener('change', event => {
    const target = event.target.closest('[data-choice]');
    if (!target) return;
    const next = yard.concepts.find(item => item.id === target.value);
    if (!next) return;
    if (target.dataset.choice === 'left') { if (right.id === next.id) right = left; left = next; }
    else { if (left.id === next.id) left = right; right = next; }
    const id = target.id; saveState(); render(); $(id)?.focus({preventScroll:true});
  });
  $('studio-content').addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.hasAttribute('data-studio-view')) {
      view = Number(target.dataset.studioView); saveState(); render();
      document.querySelector(`[data-studio-view="${view}"]`)?.focus({preventScroll:true});
    }
    if (target.hasAttribute('data-studio-csv')) exportCSV();
  });
  $('studio-content').addEventListener('error', event => {
    if (event.target.tagName !== 'IMG') return;
    event.target.alt = 'Изображение не загрузилось. Откройте его по ссылке или обновите страницу.';
  }, true);
  window.addEventListener('popstate', () => { readState(); render(); });
  readState(); render();
})();
