'use strict';
(() => {
  const D = window.REVIEW_DATA;
  const $ = id => document.getElementById(id);
  const key = 'pkgo-source-only-v2';
  const clone = x => JSON.parse(JSON.stringify(x));
  const fmt = x => Number(x).toLocaleString('ru-RU', {maximumFractionDigits: 2});
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeURL = s => /^(https?:\/\/|assets\/|sources\/|sources\.html)/.test(s || '') ? s : 'sources.html';
  let state = {version:2, variants:{}, points:{}, selection:{}}, history = [], storageOK = true;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved && saved.version === 2 && saved.variants && saved.points && saved.selection) state = saved;
  } catch { storageOK = false; $('save-status').textContent = 'Сохранённые данные недоступны. Работайте в текущем окне и скачайте JSON.'; }
  // Correct untouched historical defaults; preserve explicit user-entered prices.
  for (const variant of D.yards.flatMap(y => y.variants)) {
    const savedItems = state.variants[variant.id]?.items;
    if (!Array.isArray(savedItems)) continue;
    for (const row of savedItems) {
      const source = variant.items.find(item => item.key === row.key);
      if (source?.source_price_conflict && row.price === 293414 && row.price_basis === 'Исходная стоимость позиции / количество') {
        row.price = null;
        row.price_basis = source.price_basis;
      }
      if (source?.source_budget_block_note && row.price === source.price && row.price_basis === 'Исходная стоимость позиции / количество') {
        row.price_basis = source.price_basis;
      }
    }
  }
  let yard = D.yards[0], variant, map, markerGroup, pick = false;
  function save() {
    try {localStorage.setItem(key, JSON.stringify(state)); storageOK=true;}
    catch {storageOK=false;}
    $('save-status').textContent = storageOK ? 'Сохранено в этом браузере. Для передачи или резервной копии скачайте JSON.' : 'Браузер не сохранил изменения. Скачайте JSON до закрытия окна.';
  }
  function checkpoint() {history.push(clone(state)); if(history.length>30) history.shift();}
  function draft() {
    if (!state.variants[variant.id]) state.variants[variant.id]={items:clone(variant.items),extra:null};
    return state.variants[variant.id];
  }
  function link(id,url) {$(id).hidden=!url;if(url)$(id).href=safeURL(url);}
  function changed() {
    const composition=items=>items.map(r=>({key:r.key,qty:r.qty,price:r.price,excluded:Boolean(r.excluded)}));
    return JSON.stringify(composition(draft().items))!==JSON.stringify(composition(variant.items))||draft().extra!==null;
  }
  function totals() {
    const included=draft().items.filter(r=>!r.excluded&&r.qty>0);
    const missing=included.filter(r=>r.price===null || !Number.isFinite(r.price));
    const known=included.reduce((a,r)=>a+(Number.isFinite(r.price)?r.qty*r.price:0),0);
    const total=known+(draft().extra??0);
    $('totals').innerHTML=`${missing.length?'Известная часть стоимости':'Сумма выбранных МАФов и введённых работ'}: ${fmt(total)} ₽<small>${included.length} позиций; без цены: ${missing.length}. ${draft().extra===null?'Стоимость дополнительных работ и доставки не задана.':'Дополнительные работы: '+fmt(draft().extra)+' ₽.'} ${missing.length?'Итоговая стоимость комплекта пока не определена.':''}</small>`;
    $('draft-note').textContent = changed() ? (yard.approved?'Рабочее изменение согласованного состава. Требует пересогласования. ':'Рабочая комплектация изменена. ')+'Изображения и исходные документы остаются в первоначальном виде.' : (yard.approved?'Исходный состав из папки «согл». Его статус не переносится на изменённый вариант.':'Предложение для обсуждения. Изображения показывают реальные изделия, а не проверенную посадку на участке.');
    $('undo').disabled=!history.length;
  }
  function renderRows() {
    $('rows').innerHTML=draft().items.map((r,i)=>`<tr class="${r.excluded?'excluded':''}"><td><a href="${esc(safeURL(r.url))}" target="_blank" rel="noopener">${esc(r.code)} · ${esc(r.name)}</a><small>${esc(r.age||'Возраст уточнить')} · ${r.dimensions_mm?.every(Number.isFinite)?r.dimensions_mm.map(fmt).join(' × ')+' мм':'Габариты уточнить'}</small><small>Зона безопасности: ${esc(r.safety_zone||'запросить паспорт')}</small></td><td><input aria-label="Количество ${esc(r.code)}" data-index="${i}" data-field="qty" type="number" min="1" max="1000" step="1" value="${r.qty}" ${r.excluded?'disabled':''}></td><td><input aria-label="Цена ${esc(r.code)}" data-index="${i}" data-field="price" type="number" min="0" max="1000000000" step="0.01" value="${r.price??''}" placeholder="По запросу" ${r.excluded?'disabled':''}><small>${esc(r.price_basis)}</small>${r.price_basis === 'Введено пользователем' && variant.items.find(item=>item.key===r.key)?.source_price_conflict ? `<small>${esc(variant.items.find(item=>item.key===r.key).source_price_conflict)}</small>` : ''}</td><td>${r.excluded?'Исключено':r.price===null?'Не определена':fmt(r.price*r.qty)}</td><td><button data-toggle="${i}">${r.excluded?'Вернуть':'Исключить'}</button></td></tr>`).join('');
    $('extra').value=draft().extra??'';totals();
  }
  function showImages() {
    const active=new Set(draft().items.filter(r=>!r.excluded).map(r=>r.key));
    const source=yard.approved||variant.id==='9-1';
    const selectedImages=draft().items.filter(r=>active.has(r.key)&&r.image).map(r=>({src:r.image,caption:r.code+' · '+r.name,url:r.url}));
    let gallery=source?[...variant.gallery,...selectedImages]:selectedImages;
    const render=(images,target)=>{
      $(target).replaceChildren();
      for (const im of images) {
        const figure=document.createElement('figure'),button=document.createElement('button'),img=document.createElement('img'),caption=document.createElement('figcaption');
        img.src=im.src;img.alt=im.caption;img.loading='lazy';button.setAttribute('aria-label','Увеличить: '+im.caption);button.append(img);
        img.addEventListener('error',()=>{button.textContent='Изображение недоступно — откройте источник';});
        button.onclick=()=>{$('full-image').src=im.src;$('full-image').alt=im.caption;$('full-caption').textContent=im.caption;$('full-source').href=safeURL(im.url||im.src);$('viewer').showModal();};
        caption.textContent=im.caption+' ';const a=document.createElement('a');a.href=safeURL(im.url||im.src);a.target='_blank';a.rel='noopener';a.textContent='Источник ↗';caption.append(a);figure.append(button,caption);$(target).append(figure);
      }
      if(!images.length)$(target).textContent='Для выбранных изделий изображения пока недоступны. Ссылки на карточки производителей есть в таблице.';
    };
    $('media-note').textContent=source?'Исходные рендеры поставщика. Они не перерисовываются после удаления МАФов; для обновлённой посадки нужны исходные 3D-модели и проект.':'Точные изображения выбранных моделей с сайтов производителей. Это визуальная подборка оборудования, не новый рендер двора и не два ракурса одной площадки.';
    render(gallery,'gallery');render([...yard.plans,...yard.source_images],'originals');
  }
  function productOptions(){
    const query=$('product-search').value.toLocaleLowerCase('ru');
    const list=D.products.filter(p=>p.kind!=='series'&&(p.name+' '+p.article+' '+p.manufacturer).toLocaleLowerCase('ru').includes(query));
    $('product').innerHTML=list.map(p=>`<option value="${esc(p.id)}">${esc(p.manufacturer+' · '+p.article+' · '+p.name)}</option>`).join('');$('add').disabled=yard.approved||!list.length;
  }
  function selectYard(n,updateHash=true){
    yard=D.yards.find(y=>y.id===n)||D.yards[0];
    variant=yard.variants.find(v=>v.id===state.selection[yard.id])||yard.variants[0];
    state.selection[yard.id]=variant.id; $('audited-studio').href='studio.html?yard='+yard.id+'&mode=estimate';
    if(updateHash)window.history.replaceState(null,'','#yard-'+yard.id);
    document.querySelectorAll('#yards button').forEach(b=>b.setAttribute('aria-current',String(Number(b.dataset.yard)===yard.id)));
    $('status').textContent=yard.status+' · '+yard.source_folder;$('yard-name').textContent=yard.name;
    $('area').textContent=yard.area===null?'Не подтверждена':fmt(yard.area)+' м²';$('area-note').textContent=yard.area_note;
    $('source-budget').textContent=yard.budget===null?'Не подтверждён':fmt(yard.budget)+' ₽';$('budget-note').textContent=yard.budget_basis+(yard.id===3?' Смета прежнего состава; не считать ценой последнего плана.':yard.id===9?' Относится только к исходному альбому. Стоимость альтернатив рассчитывается отдельно.':'');
    $('variant').innerHTML=yard.variants.map(v=>`<option value="${v.id}">${esc(v.name)}</option>`).join('');$('variant').value=variant.id;
    $('variant-note').textContent=variant.note;$('address').textContent=yard.address;$('location-note').textContent=yard.location_status+'. '+yard.location_note;
    link('address-map',yard.search_url);link('location-source',yard.location_source);link('context-source',yard.context_source);
    $('context').textContent=yard.context;$('walking').textContent=yard.walking;$('recommendation').textContent=yard.recommendation;
    $('add-note').textContent=yard.approved?'Для согласованного двора произвольное добавление из каталога закрыто. Исходные изделия можно исключить и вернуть в рабочем сценарии.':'Изображение добавленного изделия появится в подборке. Размещение на участке ещё не проверено.';
    $('add-panel').hidden=yard.approved;productOptions();renderRows();showImages();renderPoints(true);pick=false;$('pick').textContent='Выбрать точку на карте';
  }
  function numberValue(input,nullable,max=1e9){if(nullable&&input.value==='')return null;const n=Number(input.value);if(!Number.isFinite(n)||n<0||n>max||input.value==='')return undefined;return n;}
  $('rows').addEventListener('change',e=>{
    const i=Number(e.target.dataset.index),field=e.target.dataset.field;if(!['qty','price'].includes(field)||!draft().items[i])return;
    const n=numberValue(e.target,field==='price',field==='qty'?1000:1e9);
    if(n===undefined||(field==='qty'&&(!Number.isInteger(n)||n<1))){alert('Введите допустимое неотрицательное число; количество — целое от 1 до 1000.');renderRows();return;}
    checkpoint();draft().items[i][field]=n;if(field==='price')draft().items[i].price_basis=n===null?'Цена по запросу':'Введено пользователем';save();renderRows();
  });
  $('rows').addEventListener('click',e=>{const b=e.target.closest('[data-toggle]');if(!b)return;checkpoint();const r=draft().items[Number(b.dataset.toggle)];r.excluded=!r.excluded;save();renderRows();showImages();});
  $('extra').onchange=e=>{const n=numberValue(e.target,true);if(n===undefined){alert('Введите сумму от 0 до 1 млрд ₽ либо оставьте поле пустым.');renderRows();return;}checkpoint();draft().extra=n;save();totals();};
  $('variant').onchange=e=>{state.selection[yard.id]=e.target.value;save();selectYard(yard.id);};
  $('product-search').oninput=productOptions;
  $('add').onclick=()=>{if(yard.approved)return;const p=D.products.find(p=>p.id===$('product').value);if(!p||p.kind==='series')return;checkpoint();const existing=draft().items.find(r=>r.key===p.id);if(existing){existing.excluded=false;existing.qty=Math.min(1000,existing.qty+1);}else draft().items.push({key:p.id,code:p.article,name:p.name,qty:1,price:null,price_basis:'Цена по запросу',url:p.url,image:p.local_image,dimensions_mm:p.dimensions_mm,age:p.age,safety_zone:p.safety_zone});save();renderRows();showImages();};
  $('undo').onclick=()=>{if(!history.length)return;state=history.pop();save();selectYard(yard.id);};
  $('reset').onclick=()=>{checkpoint();delete state.variants[variant.id];save();renderRows();showImages();};
  function download(name,data,type){const blob=new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('export-all').onclick=()=>download('dvory-pkgo-working-variants.json',JSON.stringify({exported_at:new Date().toISOString(),notice:'Рабочие изменения пользователя. Исходные согласования не изменены.',...state},null,2),'application/json;charset=utf-8');
  $('csv').onclick=()=>{
    const quote=v=>'"'+String(v??'').replace(/^[=+@\-]/,"'$&").replace(/"/g,'""')+'"';
    const rows=[['Двор','Вариант','Артикул','Наименование','Количество','Цена единицы','Сумма','Основание цены','Источник','Широта (рабочая)','Долгота (рабочая)']];
    for(const r of draft().items.filter(r=>!r.excluded))rows.push([yard.name,variant.name,r.code,r.name,r.qty,r.price,r.price===null?'':r.price*r.qty,r.price_basis,r.url,state.points[yard.id]?.lat,state.points[yard.id]?.lon]);
    rows.push([yard.name,variant.name,'','Дополнительные работы',1,draft().extra,draft().extra,'Оценка пользователя']);
    download('yard-'+yard.id+'-variant-'+variant.id+'.csv','\uFEFF'+rows.map(r=>r.map(quote).join(';')).join('\r\n'),'text/csv;charset=utf-8');
  };
  function validPoint(lat,lon){return Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180;}
  function setPoint(lat,lon){if(!validPoint(lat,lon)){alert('Проверьте координаты.');return;}checkpoint();state.points[yard.id]={lat,lon,status:'Рабочая точка пользователя',date:new Date().toISOString()};save();renderPoints(true);pick=false;$('pick').textContent='Выбрать точку на карте';}
  function renderPoints(center){
    const point=state.points[yard.id];$('lat').value=point?.lat??'';$('lon').value=point?.lon??'';
    $('point-link').hidden=!point;if(point)$('point-link').href=`https://yandex.ru/maps/?pt=${point.lon},${point.lat}&z=18&l=map`;
    $('map-status').textContent=point?'Рабочая точка: '+point.lat.toFixed(6)+', '+point.lon.toFixed(6)+'. Не подтверждена проектом.':'Точка двора пока не выбрана. Поиск по адресу доступен по ссылке выше.';
    if(!map)return;markerGroup.clearLayers();
    for(const [id,p] of Object.entries(state.points)){
      if(!validPoint(p.lat,p.lon))continue;const y=D.yards.find(y=>y.id===Number(id));if(!y)continue;
      const marker=L.circleMarker([p.lat,p.lon],{radius:Number(id)===yard.id?11:7,color:'#165744',fillOpacity:.8}).addTo(markerGroup);
      marker.bindTooltip(y.name+' · рабочая точка');marker.on('click',()=>selectYard(y.id));
    }
    if(center&&point)map.setView([point.lat,point.lon],17);
  }
  $('pick').onclick=()=>{pick=!pick;$('pick').textContent=pick?'Щёлкните по карте · отменить':'Выбрать точку на карте';};
  $('set-point').onclick=()=>{if($('lat').value===''||$('lon').value===''){alert('Введите обе координаты.');return;}setPoint(Number($('lat').value),Number($('lon').value));};
  $('clear-point').onclick=()=>{checkpoint();delete state.points[yard.id];save();renderPoints(false);};
  $('close-viewer').onclick=()=>$('viewer').close();
  D.yards.forEach(y=>{const b=document.createElement('button');b.textContent=String(y.id).padStart(2,'0')+' · '+y.name;b.dataset.yard=y.id;b.onclick=()=>selectYard(y.id);$('yards').append(b);});
  if(window.L){map=L.map('map').setView([53.04,158.65],12);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);markerGroup=L.layerGroup().addTo(map);map.on('click',e=>{if(pick)setPoint(e.latlng.lat,e.latlng.lng);});}
  else $('map').textContent='Карта недоступна. Можно открыть Яндекс Карты или ввести координаты ниже.';
  const hash=()=>{const m=location.hash.match(/^#yard-(\d+)$/);if(m)selectYard(Number(m[1]),false);};
  window.addEventListener('hashchange',hash);selectYard(Number(location.hash.match(/^#yard-(\d+)$/)?.[1])||9,false);
})();
