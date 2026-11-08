'use strict';
(() => {
  const data = window.PKGO_ATLAS;
  const proposal = window.PKGO_CONCEPT;
  const additions = window.PKGO_NEW_RENDERS;
  const references = window.PKGO_REFERENCE_40;
  const {esc, money, csv} = window.PKGO_DOMAIN;
  const $ = id => document.getElementById(id);
  const key = 'pkgo-concept-decisions-v1';
  const empty = () => ({version:1, decisions:{}});
  let state = empty(), noticeTimer, current, concept, view = 0;
  let newComposition = additions.compositions[0], newView = 0;
  function notify(text, persistent = false) {
    clearTimeout(noticeTimer); $('message').textContent = text; $('message').hidden = false;
    if (!persistent) noticeTimer = setTimeout(() => { $('message').hidden = true; }, 5500);
  }
  function validate(input) {
    if (!input || input.version !== 1 || typeof input.decisions !== 'object' || !input.decisions || Array.isArray(input.decisions)) throw new Error('Неверный формат файла выбора.');
    const clean = empty();
    for (const [id,value] of Object.entries(input.decisions)) {
      const yard = data.yards.find(y => String(y.id) === id);
      if (!yard || !value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Неизвестный двор в файле.');
      if (value.concept !== null && !yard.concepts.some(c => c.id === value.concept)) throw new Error('Неизвестная концепция в файле.');
      if (typeof value.notes !== 'string' || value.notes.length > 4000) throw new Error('Замечания должны быть текстом до 4000 символов.');
      clean.decisions[id] = {concept:value.concept, notes:value.notes};
    }
    return clean;
  }
  try { const raw = localStorage.getItem(key); if (raw) state = validate(JSON.parse(raw)); }
  catch { notify('Сохранённый выбор недоступен. Можно загрузить ранее экспортированный JSON.', true); }
  const entry = id => state.decisions[id] || {concept:null,notes:''};
  const rec = id => proposal.yards.find(y => y.id === id);
  const reference = id => references.yards.find(y => y.id === id);
  $('total-concepts').textContent = data.yards.reduce((sum,yard)=>sum+yard.concepts.length,0);
  $('total-renders').textContent = data.yards.reduce((sum,yard)=>sum+yard.concepts.reduce((count,item)=>count+item.renders.length,0),0);
  const safeAsset = value => typeof value === 'string' && /^(assets|sources)\/[a-zA-Z0-9_./-]+$/.test(value) && !value.split('/').includes('..') ? value : '';
  function save() {
    try { localStorage.setItem(key, JSON.stringify(state)); return true; }
    catch { notify('Браузер не сохранил изменения. Скачайте выбор и замечания в JSON.', true); return false; }
  }
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], {type}));
    const link = document.createElement('a'); link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function renderOverview() {
    $('progress').textContent = `Выбрано для обсуждения: ${Object.values(state.decisions).filter(x => x.concept).length} из 10`;
    $('yard-buttons').innerHTML = data.yards.map(y => `<button class="yard-button" data-yard="${y.id}" aria-pressed="${current?.id === y.id}"><span class="num">${String(y.id).padStart(2,'0')}</span><span>${esc(y.shortName)}</span>${entry(y.id).concept ? '<span class="picked" aria-label="Есть рабочий выбор">✓</span>' : ''}</button>`).join('');
    $('summary-rows').innerHTML = data.yards.map(y => {
      const chosen = y.concepts.find(c => c.id === entry(y.id).concept);
      const recommended = y.concepts.find(c => c.id === rec(y.id).recommended);
      return `<tr><td><button data-yard="${y.id}">${y.id}. ${esc(y.shortName)}</button></td><td>${esc(recommended.title)}</td><td>${chosen ? esc(chosen.title) : 'Пока не выбран'}</td><td>${esc(entry(y.id).notes || '—')}</td></tr>`;
    }).join('');
  }
  function showImage() {
    const render = concept.renders[view];
    $('hero').src = safeAsset(render.src); $('hero').alt = `${current.shortName} — ${concept.title}, ${render.title}. Эскизная визуализация.`;
    $('download-image').href = safeAsset(render.src);
    $('edit-mafs').href=`maf-editor.html?yard=${current.id}&concept=${concept.id}&view=${view}`;
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.view) === view)));
  }
  function updateChoice() {
    const picked = current.concepts.find(c => c.id === entry(current.id).concept);
    $('choose').textContent = picked?.id === concept.id ? 'Выбрано для обсуждения ✓' : 'Выбрать для обсуждения';
    $('choose').disabled = picked?.id === concept.id;
    $('unchoose').hidden = !picked;
    $('selection-label').textContent = picked ? `Мой выбор: ${picked.title}. Это предложение для обсуждения.` : 'Ваш рабочий выбор пока не сделан.';
    renderOverview();
  }
  function showConcept(id, updateRoute = true) {
    concept = current.concepts.find(c => c.id === id) || current.concepts[0]; view = 0;
    const recommendation = rec(current.id);
    $('concept-kind').textContent = concept.id === recommendation.recommended ? 'РЕКОМЕНДУЕМОЕ НАПРАВЛЕНИЕ' : 'АЛЬТЕРНАТИВНЫЙ ВАРИАНТ';
    $('concept-title').textContent = concept.title; $('concept-description').textContent = concept.description;
    $('concept-buttons').innerHTML = current.concepts.map(c => `<button class="concept-button" data-concept="${esc(c.id)}" aria-pressed="${c.id === concept.id}"><img src="${esc(safeAsset(c.renders[0].thumb || c.renders[0].src))}" width="300" height="200" alt="" loading="lazy">${c.id === recommendation.recommended ? '<span class="rec-tag">Предложение альбома</span>' : ''}<span>${String(c.number).padStart(2,'0')} · ${esc(c.title)}</span></button>`).join('');
    $('equipment-rows').innerHTML = concept.items.map(i => `<tr><td>${esc(i.code)}</td><td>${esc(i.name)}</td><td>${esc(i.qty)}</td><td>${i.priceConflict ? 'Есть расхождение в источнике' : Number.isFinite(i.price) ? esc(money(i.price)) : 'Требует уточнения'}</td></tr>`).join('');
    const imageMismatch = current.id === 10 && ['y10-c01','y10-c04'].includes(concept.id);
    $('image-warning').hidden = !imageMismatch;
    $('image-warning').textContent = imageMismatch ? 'На рендере показана пожарная машина, а в ведомости — автобус Г-2314. Перед согласованием изображение нужно исправить.' : '';
    $('map-link').href = `index.html?yard=${current.id}&section=concepts&concept=${encodeURIComponent(concept.id)}`;
    showImage(); updateChoice();
    if (updateRoute) { const url = new URL(location.href); url.searchParams.set('yard',current.id);url.searchParams.set('concept',concept.id);history.replaceState(null,'',url); }
  }
  function showYard(id, wantedConcept) {
    current = data.yards.find(y => y.id === Number(id)) || data.yards[4];
    const recommendation = rec(current.id), recommended = current.concepts.find(c => c.id === recommendation.recommended);
    $('yard-number').textContent = `ДВОР ${String(current.id).padStart(2,'0')} / 10`;
    $('yard-title').textContent = current.shortName;
    $('original-status').textContent = `Исходный проект: ${current.status}. Новые концепции обсуждаются отдельно.`;
    $('recommended-title').textContent = recommended.title; $('reason').textContent = recommendation.reason;
    $('changes').innerHTML = recommendation.changes.map(t => `<li>${esc(t)}</li>`).join('');
    $('retain').textContent = recommendation.retain; $('check').textContent = recommendation.check;
    $('area-note').textContent = current.areaNote; $('notes').value = entry(current.id).notes;
    $('concept-list-title').textContent = `Все варианты: ${current.concepts.length}`;
    const idea = reference(current.id);
    $('reference-heading').textContent = idea.title;
    $('reference-themes').textContent = idea.themes.map(theme=>`${String(theme.number).padStart(2,'0')} · ${theme.title}`).join('  /  ');
    $('reference-proposal').textContent = idea.proposal;
    $('reference-moves').innerHTML = idea.moves.map(text=>`<li>${esc(text)}</li>`).join('');
    $('reference-adaptation').textContent = idea.adaptation;
    $('reference-check').textContent = idea.check;
    $('plans-link').href = `index.html?yard=${current.id}&section=plans`;
    showConcept(wantedConcept || entry(current.id).concept || recommended.id);
  }
  function showNewImage() {
    const render = newComposition.renders[newView];
    $('new-hero').src = safeAsset(render.src);
    $('new-hero').alt = `${newComposition.title}. ${render.alt}. Эскизная визуализация.`;
    $('download-new-image').href = safeAsset(render.src);
    document.querySelectorAll('[data-new-view]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.newView) === newView)));
  }
  function showNewComposition(id) {
    newComposition = additions.compositions.find(item => item.id === id) || additions.compositions[0];
    newView = 0;
    for (const field of ['title','subtitle','idea','use','check']) $('new-'+field).textContent = newComposition[field];
    $('new-linked-concept').textContent = `${newComposition.related.yardName} · ${newComposition.related.title} →`;
    $('new-linked-concept').href = `concept.html?yard=${newComposition.related.yard}&concept=${encodeURIComponent(newComposition.related.concept)}#yard-content`;
    $('new-changes').innerHTML = newComposition.changes.map(text => `<li>${esc(text)}</li>`).join('');
    document.querySelectorAll('[data-new-composition]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.newComposition === newComposition.id)));
    $('new-view-buttons').innerHTML = newComposition.renders.map((render,index) => `<button data-new-view="${index}" aria-pressed="${index === 0}">${String(index+1).padStart(2,'0')} ${esc(render.title)}</button>`).join('');
    showNewImage();
  }
  function openViewer(src, alt, caption) {
    $('large-image').src = safeAsset(src);
    $('large-image').alt = alt;
    $('large-caption').textContent = caption;
    $('viewer').showModal();
  }
  $('new-intro').textContent = additions.intro;
  $('new-buttons').innerHTML = additions.compositions.map((item,index) => `<button class="concept-button" data-new-composition="${esc(item.id)}" aria-pressed="${index === 0}"><img src="${esc(safeAsset(item.renders[0].src))}" width="300" height="200" alt="" loading="lazy"><span>${String(index+1).padStart(2,'0')} · ${esc(item.title)}</span><span class="small">${item.renders.length === 1 ? '1 изображение' : '2 ракурса'}</span></button>`).join('');
  for (const yard of data.yards) $('new-yard').add(new Option(`${yard.id}. ${yard.shortName}`, String(yard.id)));
  showNewComposition(newComposition.id);
  $('new-buttons').addEventListener('click', event => {
    const button = event.target.closest('[data-new-composition]');
    if (button) showNewComposition(button.dataset.newComposition);
  });
  $('new-view-buttons').addEventListener('click', event => {
    const button = event.target.closest('[data-new-view]');
    if (button) { newView = Number(button.dataset.newView); showNewImage(); }
  });
  function appendNote(yardId,text,successMessage) {
    const previous = entry(yardId);
    if (previous.notes.includes(text)) { notify('Это предложение уже записано в замечания к выбранному двору.'); return; }
    const notes = [previous.notes,text].filter(Boolean).join('\n');
    if (notes.length > 4000) { notify('В замечаниях недостаточно места. Сократите текст выбранного двора и повторите запись.',true); return; }
    state.decisions[yardId] = {...previous,notes};
    const saved = save();
    if (current.id === yardId) $('notes').value = notes;
    renderOverview();
    if (saved) notify(successMessage);
  }
  $('add-reference').addEventListener('click',()=>{
    const idea=reference(current.id);
    appendNote(current.id,`Обсудить идею из библиотеки 40 тем: «${idea.title}» (темы ${idea.themes.map(theme=>theme.number).join(', ')}). ${idea.proposal}`,`Идея добавлена в замечания: ${current.shortName}.`);
  });
  $('add-new-to-notes').addEventListener('click', () => {
    const yard = data.yards.find(item => String(item.id) === $('new-yard').value);
    if (!yard) { notify('Выберите двор для записи предложения.'); $('new-yard').focus(); return; }
    const text = `Обсудить новую композицию «${newComposition.title}» (${newComposition.id}). Привязка и состав требуют уточнения.`;
    appendNote(yard.id,text,`«${newComposition.title}» добавлена в замечания: ${yard.shortName}.`);
  });
  $('principle-grid').innerHTML = proposal.principles.map((p,i) => `<section><p class="eyebrow">0${i+1}</p><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></section>`).join('');
  document.addEventListener('click', event => {
    const yardButton = event.target.closest('[data-yard]');
    if (yardButton) { showYard(yardButton.dataset.yard); $('yard-content').scrollIntoView({block:'start'}); $('yard-title').setAttribute('tabindex','-1'); $('yard-title').focus({preventScroll:true}); }
    const conceptButton = event.target.closest('[data-concept]');
    if (conceptButton) { const id=conceptButton.dataset.concept;showConcept(id);document.querySelector(`[data-concept="${id}"]`).focus({preventScroll:true}); }
    const viewButton = event.target.closest('[data-view]'); if (viewButton) { view=Number(viewButton.dataset.view);showImage(); }
  });
  $('choose').addEventListener('click', () => {state.decisions[current.id] = {...entry(current.id),concept:concept.id};const saved=save();updateChoice();if(saved)notify('Вариант выбран для обсуждения.');});
  $('unchoose').addEventListener('click', () => {state.decisions[current.id] = {...entry(current.id),concept:null};save();updateChoice();});
  $('notes').addEventListener('input', () => {state.decisions[current.id] = {...entry(current.id),notes:$('notes').value};save();renderOverview();});
  $('show-recommended').addEventListener('click', () => showConcept(rec(current.id).recommended));
  $('export').addEventListener('click', () => download('PKGO_working_choices.json',JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2),'application/json;charset=utf-8'));
  $('export-csv').addEventListener('click', () => download('PKGO_working_choices.csv',csv([['Двор','Предложение альбома','Мой выбор','Замечания'],...data.yards.map(y => [y.shortName,y.concepts.find(c=>c.id===rec(y.id).recommended).title,y.concepts.find(c=>c.id===entry(y.id).concept)?.title || '',entry(y.id).notes])]),'text/csv;charset=utf-8'));
  $('import').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try { if(file.size > 1000000)throw new Error('Файл слишком большой. Выберите JSON выбора до 1 МБ.');const incoming=validate(JSON.parse(await file.text()));state=incoming;const saved=save();showYard(current.id);if(saved)notify('Рабочий выбор и замечания загружены.'); }
    catch(error) {notify(error instanceof SyntaxError ? 'Файл не является корректным JSON. Текущий выбор сохранён.' : error.message,true);}
    finally {event.target.value='';}
  });
  $('open-image').addEventListener('click', () => openViewer(concept.renders[view].src,$('hero').alt,`${current.shortName} · ${concept.title} · ${concept.renders[view].title}. Эскизная визуализация.`));
  $('open-new-image').addEventListener('click', () => openViewer(newComposition.renders[newView].src,$('new-hero').alt,`${newComposition.title} · ${newComposition.renders[newView].title}. В актуальной базе: ${newComposition.related.yardName}, ${newComposition.related.title}.`));
  $('close-viewer').addEventListener('click', () => $('viewer').close());
  $('viewer').addEventListener('click', e => {if(e.target===$('viewer'))$('viewer').close();});
  const params = new URLSearchParams(location.search); showYard(params.get('yard') || 5, params.get('concept'));
})();
