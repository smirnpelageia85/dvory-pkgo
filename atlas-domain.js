'use strict';
(function (root) {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const number = value => new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 2}).format(value);
  const money = value => Number.isFinite(value) ? number(value) + ' ₽' : 'Не определена';
  function summarize(items) {
    let knownSubtotal = 0, unknownCount = 0, conflictCount = 0;
    for (const item of items) {
      if (item.priceConflict) conflictCount++;
      if (!Number.isFinite(item.price) || item.priceConflict || !Number.isFinite(item.qty) || item.qty <= 0) unknownCount++;
      else knownSubtotal += Math.round(item.price * item.qty * 100) / 100;
    }
    knownSubtotal = Math.round(knownSubtotal * 100) / 100;
    return {knownSubtotal, unknownCount, conflictCount, complete: items.length > 0 && unknownCount === 0, total: items.length > 0 && unknownCount === 0 ? knownSubtotal : null};
  }
  function safeURL(value, base) {
    try { const url = new URL(value, base); return ['https:', 'http:'].includes(url.protocol) ? url.href : '#'; }
    catch { return '#'; }
  }
  function csv(rows) {
    const cell = value => '"' + String(value ?? '').replace(/^[\s]*[=+@\-]/, "'$&").replaceAll('"', '""') + '"';
    return '\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n');
  }
  const api = {esc, number, money, summarize, safeURL, csv};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PKGO_DOMAIN = api;
})(typeof window !== 'undefined' ? window : globalThis);
