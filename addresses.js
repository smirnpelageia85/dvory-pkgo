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

  // Format money helper
  function formatMoney(num) {
    if (!num) return 'Смета на согласовании';
    return new Intl.NumberFormat('ru-RU').format(Math.round(num)) + ' ₽';
  }

  // Render all yards
  function renderYards(items) {
    if (!items.length) {
      container.innerHTML = '<div class="estimate-notice">По заданному запросу ничего не найдено. Попробуйте изменить параметры поиска.</div>';
      return;
    }

    container.innerHTML = items.map(yard => {
      const agreed = yard.status_label.includes('Согласовано');
      const clarify = yard.status_label.includes('уточн') || yard.status_label.includes('подрядчик');
      const statusClass = agreed ? 'status-agreed' : (clarify ? 'status-clarify' : 'status-progress');
      const budgetText = yard.budget ? formatMoney(yard.budget) + ' (с НДС)' : 'Подтверждённая смета отсутствует';

      // Concepts Tab HTML
      const conceptsHtml = `
        <div class="concepts-grid">
          ${yard.concepts.map(concept => {
            const r1 = concept.renders && concept.renders[0] ? concept.renders[0] : null;
            const r2 = concept.renders && concept.renders[1] ? concept.renders[1] : null;
            const initialImg = r1 ? (r1.thumbUrl || r1.fullUrl) : '';
            const fullImg = r1 ? r1.fullUrl : '';

            return `
              <div class="concept-card" id="card-${concept.id}">
                <div class="concept-preview-wrap" data-full="${fullImg}" data-title="${yard.address}: ${concept.title}">
                  <img src="${initialImg}" alt="${concept.title}" loading="lazy" class="preview-img">
                  <span class="view-indicator">Вид сверху</span>
                </div>
                <div class="concept-info">
                  <div class="concept-header-row">
                    <h3 class="concept-title">${concept.title}</h3>
                    <span class="concept-id-chip">${concept.id}</span>
                  </div>
                  <p class="concept-desc">${concept.description || 'Проектное 3D-решение благоустройства площадки.'}</p>
                  ${r2 ? `
                    <div class="concept-view-toggles">
                      <button class="btn-view-switch active" data-src="${r1.thumbUrl || r1.fullUrl}" data-full="${r1.fullUrl}" data-label="Вид сверху">Общий вид</button>
                      <button class="btn-view-switch" data-src="${r2.thumbUrl || r2.fullUrl}" data-full="${r2.fullUrl}" data-label="С уровня глаз">С уровня человека</button>
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
        <div class="themes40-grid">
          ${yard.themes_40.map(theme => `
            <div class="theme40-card">
              ${theme.image ? `
                <div class="theme40-img-wrap" data-full="${theme.image}" data-title="Тематика №${theme.id}: ${theme.title} (${theme.archetype_name})">
                  <img src="${theme.image}" alt="${theme.title}" loading="lazy">
                </div>
              ` : ''}
              <div class="theme40-info">
                <div class="theme40-top-bar">
                  <span class="theme40-badge">Архетип ${theme.archetype}: ${theme.archetype_name}</span>
                  <span class="theme40-budget">${formatMoney(theme.budget)}</span>
                </div>
                <h4 class="theme40-title">Тематика №${theme.id}: ${theme.title}</h4>
                ${theme.items && theme.items.length ? `
                  <table class="theme40-items-table">
                    <tbody>
                      ${theme.items.map(it => `
                        <tr>
                          <td>${it.item}</td>
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
        <div class="estimate-table-wrap">
          <table class="estimate-table">
            <thead>
              <tr>
                <th>Артикул</th>
                <th>Наименование оборудования</th>
                <th>Кол-во</th>
                <th>Цена за ед.</th>
                <th>Сумма (с НДС)</th>
              </tr>
            </thead>
            <tbody>
              ${yard.verified_items.map(item => `
                <tr>
                  <td><code>${item.code || '—'}</code></td>
                  <td><strong>${item.name}</strong></td>
                  <td>${item.qty} ${item.unit || 'шт.'}</td>
                  <td>${formatMoney(item.unitPrice)}</td>
                  <td>${formatMoney(item.lineTotal)}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background:#f1f5f9;font-weight:bold;">
                <td colspan="4">Итого по подтверждённой спецификации КП:</td>
                <td>${formatMoney(yard.budget)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ` : `
        <div class="estimate-notice">
          <strong>Статус сметы:</strong> Подтверждённое коммерческое предложение поставщика в исходном комплекте отсутствует.
          <br>Параметры стоимости определяются на стадии рабочего проектирования либо по базовому архетипу программы «40 дворов».
        </div>
      `;

      // Location Tab HTML
      const geoText = yard.geo && yard.geo.lat ? `${yard.geo.lat.toFixed(6)}, ${yard.geo.lon.toFixed(6)}` : 'Координаты уточняются';
      const yandexQuery = encodeURIComponent(`Петропавловск-Камчатский ${yard.address}`);
      const locationHtml = `
        <div class="location-panel">
          <div class="location-info-box">
            <p><strong>Адрес площадки:</strong> ${yard.address}</p>
            <p><strong>Географические координаты:</strong> <code>${geoText}</code></p>
            <p><strong>Габариты и площадь:</strong> ${yard.dimensions || 'По фактическому контуру двора'} ${yard.area_sqm ? `(≈ ${yard.area_sqm} м²)` : ''}</p>
            <p><strong>Кадастровый статус:</strong> Точный контур подлежит межеванию и согласованию с инженерными сетями.</p>
            <div style="margin-top:14px;">
              <a href="https://yandex.ru/maps/?text=${yandexQuery}" target="_blank" rel="noopener" class="btn-action btn-secondary">Открыть в Яндекс Картах ↗</a>
            </div>
          </div>
          <div class="location-map-box">
            <iframe title="Карта ${yard.address}" src="https://yandex.ru/map-widget/v1/?text=${yandexQuery}" allowfullscreen loading="lazy"></iframe>
          </div>
        </div>
      `;

      return `
        <article class="yard-card" id="yard-${yard.id}" data-id="${yard.id}" data-status="${statusClass}">
          <header class="yard-card-header">
            <div class="yard-title-col">
              <span class="yard-badge-num">#${yard.id}</span>
              <div>
                <h2 class="yard-name-h2">${yard.title}</h2>
                <div class="yard-address-line">📍 ${yard.address}</div>
              </div>
            </div>
            <div class="yard-meta-col">
              <span class="status-badge ${statusClass}">${yard.status_label}</span>
              <span class="budget-chip">${budgetText}</span>
              ${yard.area_sqm ? `<span class="area-chip">📐 ${yard.area_sqm} м²</span>` : ''}
              <button class="btn-card-toggle" aria-label="Свернуть / Развернуть карточку">▼</button>
            </div>
          </header>

          <div class="yard-card-body">
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
                  <a href="${yard.album_pdf}" target="_blank" class="btn-action btn-primary">📥 Скачать PDF-альбом двора</a>
                ` : ''}
                <a href="studio.html?yard=${yard.id}" class="btn-action btn-secondary">⚖️ Сравнить в Студии</a>
                <a href="index.html?yard=${yard.id}" class="btn-action btn-secondary">🗺️ Показать в Атласе</a>
              </div>
              <small style="color:var(--text-muted)">Варианты согласованы на уровне концептуального ТЗ</small>
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
      modalImg.src = fullSrc;
      modalCaption.textContent = caption;
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
    }

    document.querySelectorAll('.concept-preview-wrap, .theme40-img-wrap').forEach(wrap => {
      wrap.addEventListener('click', () => {
        const full = wrap.dataset.full;
        const title = wrap.dataset.title || '';
        if (full) openModal(full, title);
      });
    });

    document.querySelector('.modal-close').addEventListener('click', () => {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    });

    document.querySelector('.modal-overlay').addEventListener('click', () => {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        modal.classList.remove('active');
      }
    });
  }

  // Search and Filter functionality
  const searchInput = document.getElementById('address-search');
  const chips = document.querySelectorAll('.filter-chips .chip');

  let currentFilter = 'all';
  let searchQuery = '';

  function applyFilters() {
    const q = searchQuery.toLowerCase().trim();
    const filtered = yards.filter(y => {
      // Status filter
      const agreed = y.status_label.includes('Согласовано');
      const clarify = y.status_label.includes('уточн') || y.status_label.includes('подрядчик');
      
      let matchesStatus = true;
      if (currentFilter === 'agreed') matchesStatus = agreed;
      else if (currentFilter === 'progress') matchesStatus = (!agreed && !clarify);
      else if (currentFilter === 'clarify') matchesStatus = clarify;

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
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      applyFilters();
    });
  });

  // Expand / Collapse All
  document.getElementById('btn-expand-all').addEventListener('click', () => {
    document.querySelectorAll('.yard-card').forEach(c => c.classList.remove('collapsed'));
  });

  document.getElementById('btn-collapse-all').addEventListener('click', () => {
    document.querySelectorAll('.yard-card').forEach(c => c.classList.add('collapsed'));
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
