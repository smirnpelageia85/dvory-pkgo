// addresses.js - Interactive unified addresses & options catalog
'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  let portalData = null;

  // 1. Try window global first (works offline via file://), then fetch fallback
  if (window.PKGO_UNIFIED_ADDRESSES) {
    portalData = window.PKGO_UNIFIED_ADDRESSES;
  } else {
    try {
      const res = await fetch('unified_addresses.json');
      if (res.ok) {
        portalData = await res.json();
      }
    } catch (e) {
      console.warn('Fetch fallback failed:', e);
    }
  }

  const container = document.getElementById('yards-container');
  if (!portalData || !portalData.yards) {
    container.innerHTML = '<div class="estimate-notice">Ошибка загрузки данных. Пожалуйста, откройте через локальный сервер или обновите страницу.</div>';
    return;
  }

  const yards = portalData.yards;
  const esc = value => String(value ?? '').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const localAsset = value => typeof value==='string' && /^(assets|sources|albums|downloads)\/[a-zA-Z0-9_./-]+$/.test(value) && !value.split('/').includes('..') ? value : '';
  let modalBindingsReady=false,lastModalTrigger=null;
  function statusGroup(yard) {
    const label=String(yard.status_label || '').toLowerCase();
    if (/^согласовано/.test(label)) return 'agreed';
    return /уточн|подрядчик/.test(label) ? 'clarify' : 'progress';
  }

  // Format money helper
  function formatMoney(num) {
    if (!Number.isFinite(num)) return 'Не определено';
    return new Intl.NumberFormat('ru-RU').format(Math.round(num)) + ' ₽';
  }

  // Render all yards
  function renderYards(items) {
    if (!items.length) {
      container.innerHTML = '<div class="estimate-notice">По заданному запросу ничего не найдено. Попробуйте изменить параметры поиска.</div>';
      return;
    }

    container.innerHTML = items.map(yard => {
      const statusClass = 'status-'+statusGroup(yard);
      const budgetText = Number.isFinite(yard.budget) ? `${yard.budget_kind==='promo' ? 'Исходное промопредложение' : 'Сумма исходного КП'}: ${formatMoney(yard.budget)}` : 'Исходная смета отсутствует';

      // Concepts Tab HTML
      const conceptsHtml = `
        <div class="concepts-grid">
          ${yard.concepts.map(concept => {
            const r1 = concept.renders && concept.renders[0] ? concept.renders[0] : null;
            const r2 = concept.renders && concept.renders[1] ? concept.renders[1] : null;
            const initialImg = r1 ? localAsset(r1.thumb || r1.thumbUrl || r1.src || r1.fullUrl) : '';
            const fullImg = r1 ? localAsset(r1.src || r1.fullUrl) : '';

            return `
              <div class="concept-card" id="card-${concept.id}">
                <div class="concept-preview-wrap" role="button" tabindex="0" aria-label="Увеличить ${esc(concept.title)}" data-full="${fullImg}" data-title="${esc(yard.address)}: ${esc(concept.title)}">
                  <img src="${initialImg}" alt="${esc(concept.title)}" loading="lazy" class="preview-img">
                  <span class="view-indicator">Общий вид</span>
                </div>
                <div class="concept-info">
                  <div class="concept-header-row">
                    <h3 class="concept-title">${esc(concept.title)}</h3>
                    <span class="concept-id-chip">${concept.id}</span>
                  </div>
                  <a class="btn-action btn-secondary" href="maf-editor.html?yard=${yard.id}&concept=${concept.id}&view=0">Редактировать МАФы →</a><p class="concept-desc">${esc(concept.description || 'Эскизное предложение по благоустройству площадки.')}</p>
                  ${r2 ? `
                    <div class="concept-view-toggles">
                      <button class="btn-view-switch active" aria-pressed="true" data-src="${localAsset(r1.thumb || r1.thumbUrl || r1.src || r1.fullUrl)}" data-full="${localAsset(r1.src || r1.fullUrl)}" data-label="Общий вид">Общий вид</button>
                      <button class="btn-view-switch" aria-pressed="false" data-src="${localAsset(r2.thumb || r2.thumbUrl || r2.src || r2.fullUrl)}" data-full="${localAsset(r2.src || r2.fullUrl)}" data-label="Второй ракурс">Второй ракурс</button>
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      // Themes 40 Tab HTML
      const themesHtml = yard.themes_40 && yard.themes_40.length ? `
        <p class="estimate-notice">Идеи из библиотеки тем. Суммы ниже — концептуальные ориентиры исходной программы без индексации, не сметы этого двора. Подбор темы не означает согласования оборудования.</p><div class="themes40-grid">
          ${yard.themes_40.map(theme => `
            <div class="theme40-card">
              ${theme.image ? `
                <div class="theme40-img-wrap" role="button" tabindex="0" aria-label="Увеличить тему ${esc(theme.title)}" data-full="${localAsset(theme.image)}" data-title="Тематика №${theme.id}: ${esc(theme.title)} (${esc(theme.archetype_name)})">
                  <img src="${localAsset(theme.image)}" alt="${esc(theme.title)}" loading="lazy">
                </div>
              ` : ''}
              <div class="theme40-info">
                <div class="theme40-top-bar">
                  <span class="theme40-badge">Архетип ${esc(theme.archetype)}: ${esc(theme.archetype_name)}</span>
                  <span class="theme40-budget">${formatMoney(theme.budget)}</span>
                </div>
                <h4 class="theme40-title">Тематика №${theme.id}: ${esc(theme.title)}</h4>
                ${theme.items && theme.items.length ? `
                  <table class="theme40-items-table">
                    <tbody>
                      ${theme.items.map(it => `
                        <tr>
                          <td>${esc(it.item)}</td>
                          <td>${formatMoney(it.cost)}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      ` : '<div class="estimate-notice">Для этого двора тематики программы «40 дворов» формируются по запросу.</div>';

      // Estimate Tab HTML
      const estimateHtml = yard.verified_items && yard.verified_items.length ? `
        <p class="estimate-notice">${esc(yard.budget_note)}. Таблица относится к исходному документу и не определяет цену выбранной новой концепции. <a href="studio.html?yard=${yard.id}&mode=estimate">Сверка документов и новой комплектации →</a></p><div class="estimate-table-wrap">
          <table class="estimate-table">
            <thead>
              <tr>
                <th>Артикул</th>
                <th>Наименование оборудования</th>
                <th>Кол-во</th>
                <th>Цена за ед.</th>
                <th>Сумма в источнике</th>
              </tr>
            </thead>
            <tbody>
              ${yard.verified_items.map(item => `
                <tr>
                  <td><code>${esc(item.code || '—')}</code></td>
                  <td><strong>${esc(item.name)}</strong>${item.conflict ? `<p class="estimate-notice">Расхождение: ${esc(item.conflictDetail)} Цена для новой концепции не подтверждена.</p>` : ''}</td>
                  <td>${esc(item.qty)} ${esc(item.unit || 'шт.')}</td>
                  <td>${formatMoney(item.unitPrice)}</td>
                  <td>${formatMoney(item.lineTotal)}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background:#f1f5f9;font-weight:bold;">
                <td colspan="4">Итог, указанный в исходном документе:</td>
                <td>${formatMoney(yard.budget)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ` : `
        <div class="estimate-notice">
          <strong>Статус сметы:</strong> Подтверждённое коммерческое предложение поставщика в исходном комплекте отсутствует.
          <br>Стоимость выбранного варианта рассчитывается после уточнения состава и объёмов работ. Типовой бюджет из библиотеки «40 тем» не заменяет этот расчёт.
        </div>
      `;

      // Location Tab HTML
      const geoText = yard.geo && yard.geo.lat ? `${yard.geo.lat.toFixed(6)}, ${yard.geo.lon.toFixed(6)}` : 'Координаты уточняются';
      const yandexQuery = encodeURIComponent(`Петропавловск-Камчатский ${yard.address}`);
      const locationHtml = `
        <div class="location-panel">
          <div class="location-info-box">
            <p><strong>Адресный ориентир:</strong> ${esc(yard.address)}</p>
            <p><strong>Координаты ориентира:</strong> <code>${geoText}</code> · ${esc(yard.geo?.label || '')}</p>
            <p>${esc(yard.geo?.note || '')}</p>
            <p><strong>Габариты проектной площадки:</strong> ${esc(yard.dimensions || 'Не подтверждены')}</p>
            <p>${esc(yard.area_note)}</p>
            <p><strong>${esc(yard.location_status)}</strong> ${esc(yard.location_note)}</p>
            <div style="margin-top:14px;">
              <a href="https://yandex.ru/maps/?text=${yandexQuery}" target="_blank" rel="noopener" class="btn-action btn-secondary">Открыть в Яндекс Картах ↗</a>
            </div>
          </div>
          <div class="location-map-box">
            <div class="estimate-notice"><p>Автономная схема показывает адресные ориентиры десяти дворов. Границы и точная посадка оборудования уточняются по исходным планам.</p><a href="index.html?yard=${yard.id}&offline=1" class="btn-action btn-primary">Открыть автономную схему →</a></div>
          </div>
        </div>
      `;

      return `
        <article class="yard-card" id="yard-${yard.id}" data-id="${yard.id}" data-status="${statusClass}">
          <header class="yard-card-header">
            <div class="yard-title-col">
              <span class="yard-badge-num">#${yard.id}</span>
              <div>
                <h2 class="yard-name-h2">${esc(yard.title)}</h2>
                <div class="yard-address-line">📍 ${esc(yard.address)}</div>
              </div>
            </div>
            <div class="yard-meta-col">
              <span class="status-badge ${statusClass}">${esc(yard.status_label)}</span>
              <span class="budget-chip">${budgetText}</span>
              ${yard.area_sqm ? `<span class="area-chip">📐 ${yard.area_sqm} м²</span>` : ''}
              <button class="btn-card-toggle" aria-expanded="true" aria-controls="body-${yard.id}" aria-label="Свернуть / Развернуть карточку">▼</button>
            </div>
          </header>

          <div class="yard-card-body" id="body-${yard.id}">
            <nav class="yard-tab-nav">
              <button class="tab-btn active" data-tab="concepts">🎨 3D-Концепции (${yard.concepts_count} вар.)</button>
              <button class="tab-btn" data-tab="themes40">🌳 Альтернативы «40 дворов» (${yard.themes_40_count})</button>
              <button class="tab-btn" data-tab="estimate">💰 Смета и спецификация</button>
              <button class="tab-btn" data-tab="location">📍 Карта и привязка</button>
            </nav>

            <div class="tab-content active" data-content="concepts">
              ${conceptsHtml}
            </div>
            <div class="tab-content" data-content="themes40">
              ${themesHtml}
            </div>
            <div class="tab-content" data-content="estimate">
              ${estimateHtml}
            </div>
            <div class="tab-content" data-content="location">
              ${locationHtml}
            </div>

            <footer class="yard-actions-footer">
              <div style="display:flex;gap:10px;flex-wrap:wrap;">
                ${yard.album_pdf ? `
                  <a href="${localAsset(yard.album_pdf)}" target="_blank" rel="noopener" class="btn-action btn-primary">📥 Скачать PDF-альбом двора</a>
                ` : ''}
                <a href="studio.html?yard=${yard.id}" class="btn-action btn-secondary">⚖️ Сравнить в Студии</a>
                <a href="concept.html?yard=${yard.id}#yard-content" class="btn-action btn-secondary">Общая концепция и мои замечания →</a>
                <a href="index.html?yard=${yard.id}" class="btn-action btn-secondary">🗺️ Показать в Атласе</a>
              </div>
              <small style="color:var(--text-muted)">Новые варианты — предложения для обсуждения. Статус согласования относится к исходному проекту.</small>
            </footer>
          </div>
        </article>
      `;
    }).join('');

    bindEvents();
  }

  // Bind interactive events
  function bindEvents() {
    // 1. Accordion Toggle
    document.querySelectorAll('.yard-card-header').forEach(header => {
      header.addEventListener('click', (e) => {
        if (e.target.closest('.btn-action')) return;
        const card = header.closest('.yard-card');
        card.classList.toggle('collapsed');
        card.querySelector('.btn-card-toggle').setAttribute('aria-expanded',String(!card.classList.contains('collapsed')));
      });
    });

    // 2. Tab Navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = btn.dataset.tab;
        const card = btn.closest('.yard-card');
        card.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        card.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const targetContent = card.querySelector(`.tab-content[data-content="${tabName}"]`);
        if (targetContent) targetContent.classList.add('active');
      });
    });

    // 3. Concept View Switcher (Общий вид / Человеческий рост)
    document.querySelectorAll('.btn-view-switch').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.concept-card');
        const imgWrap = card.querySelector('.concept-preview-wrap');
        const img = imgWrap.querySelector('.preview-img');
        const indicator = imgWrap.querySelector('.view-indicator');
        
        card.querySelectorAll('.btn-view-switch').forEach(b => b.classList.remove('active'));
        card.querySelectorAll('.btn-view-switch').forEach(b => b.setAttribute('aria-pressed',String(b===btn)));
        btn.classList.add('active');
        
        img.src = btn.dataset.src;
        imgWrap.dataset.full = btn.dataset.full;
        indicator.textContent = btn.dataset.label;
      });
    });

    // 4. Modal Lightbox
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-img');
    const modalCaption = document.getElementById('modal-caption');

    function openModal(fullSrc, caption) {
      lastModalTrigger=document.activeElement;
      modalImg.src = localAsset(fullSrc);
      modalImg.alt=caption;
      modalCaption.textContent = caption;
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      modal.setAttribute('role','dialog');
      modal.setAttribute('aria-modal','true');
      document.querySelector('.modal-close').focus();
    }

    document.querySelectorAll('.concept-preview-wrap, .theme40-img-wrap').forEach(wrap => {
      wrap.addEventListener('click', () => {
        const full = wrap.dataset.full;
        const title = wrap.dataset.title || '';
        if (full) openModal(full, title);
      });
      wrap.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();wrap.click();}});
    });
    if(modalBindingsReady)return;
    modalBindingsReady=true;
    function closeModal() {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      if(lastModalTrigger?.isConnected)lastModalTrigger.focus();
    }
    document.querySelector('.modal-close').addEventListener('click',closeModal);
    document.querySelector('.modal-overlay').addEventListener('click',closeModal);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
      }
      if(e.key==='Tab'&&modal.classList.contains('active')){e.preventDefault();document.querySelector('.modal-close').focus();}
    });
  }

  // Search and Filter functionality
  const searchInput = document.getElementById('address-search');
  const chips = document.querySelectorAll('.filter-chips .chip');
  const labels={all:'Все адреса',agreed:'Согласованные исходные проекты',progress:'В разработке / промо',clarify:'Требует уточнения'};
  chips.forEach(chip=>{
    const group=chip.dataset.filter;
    const count=group==='all'?yards.length:yards.filter(y=>statusGroup(y)===group).length;
    chip.textContent=`${labels[group]} (${count})`;
    chip.setAttribute('aria-pressed',String(group==='all'));
  });
  document.getElementById('theme-count').textContent=new Set(yards.flatMap(y=>y.themes_40.map(t=>t.id))).size;

  let currentFilter = 'all';
  let searchQuery = '';

  function applyFilters() {
    const q = searchQuery.toLowerCase().trim();
    const filtered = yards.filter(y => {
      // Status filter
      const matchesStatus = currentFilter==='all' || statusGroup(y)===currentFilter;

      // Text search
      const textMatch = !q || 
        y.address.toLowerCase().includes(q) || 
        y.title.toLowerCase().includes(q) || 
        String(y.id).includes(q) ||
        y.concepts.some(c => c.title.toLowerCase().includes(q));

      return matchesStatus && textMatch;
    });

    renderYards(filtered);
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      applyFilters();
    });
  }

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chips.forEach(c=>c.setAttribute('aria-pressed',String(c===chip)));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      applyFilters();
    });
  });

  // Expand / Collapse All
  document.getElementById('btn-expand-all').addEventListener('click', () => {
    document.querySelectorAll('.yard-card').forEach(c => {c.classList.remove('collapsed');c.querySelector('.btn-card-toggle').setAttribute('aria-expanded','true');});
  });

  document.getElementById('btn-collapse-all').addEventListener('click', () => {
    document.querySelectorAll('.yard-card').forEach(c => {c.classList.add('collapsed');c.querySelector('.btn-card-toggle').setAttribute('aria-expanded','false');});
  });

  // Initial render
  renderYards(yards);

  // Check URL parameters (e.g. ?yard=5)
  const urlParams = new URLSearchParams(location.search);
  const targetYard = urlParams.get('yard');
  if (targetYard) {
    setTimeout(() => {
      const el = document.getElementById('yard-' + targetYard);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.style.borderColor = 'var(--accent)';
      }
    }, 200);
  }
});
