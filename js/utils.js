// ══════════════════════════════════════════════
// utils.js — Estado global e helpers
// ══════════════════════════════════════════════

let userLevel        = null;
let currentUser      = null;
let currentPadariaId = null;
let cache            = {};
let cacheReady       = false;
let cacheUnsub       = null;
let usuariosCache    = {};
let darkMode         = localStorage.getItem('tema') !== 'light';

function podeAcessar(nivel) {
  return (NIVEL[userLevel] || 0) >= (NIVEL[nivel] || 99);
}

function dataLocal(d) {
  const dt = d || new Date();
  return dt.getFullYear() + '-' +
    String(dt.getMonth() + 1).padStart(2, '0') + '-' +
    String(dt.getDate()).padStart(2, '0');
}

function diasVencer(v) {
  if (!v) return null;
  const [y, m, d] = v.split('-').map(Number);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(y, m - 1, d) - hoje) / 86400000);
}

function toast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show ' + (type || 'ok');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.className = '', 3400);
}

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

function nivelLabel(nivel) {
  const map = {
    DONO:     '<span class="badge b-gold">👑 Dono</span>',
    ADMIN:    '<span class="badge b-red">🔴 Admin</span>',
    GERENTE:  '<span class="badge b-yellow">🟡 Gerente</span>',
    OPERADOR: '<span class="badge b-green">🟢 Operador</span>'
  };
  return map[nivel] || `<span class="badge b-gray">${nivel || '?'}</span>`;
}

function nomePadaria(pid) {
  const p = PADARIAS.find(x => x.id === pid);
  return p ? p.nome : (pid || '—');
}

function icoPadaria(pid) {
  const p = PADARIAS.find(x => x.id === pid);
  return p ? p.ico : '🏪';
}

function barcodeVisual(code) {
  let x = 0, bars = '';
  const seed = code.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const n    = Math.max(code.length, 8) * 11;
  const unit = 160 / n;
  for (let i = 0; i < n; i++) {
    const w = unit * (1 + ((seed * (i + 1) * 7) % 3));
    if (i % 2 === 0)
      bars += `<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="40" fill="#e8ddd0"/>`;
    x += w;
  }
  return `<svg viewBox="0 0 ${x.toFixed(0)} 40" xmlns="http://www.w3.org/2000/svg"
    style="background:#0d0806;width:100%;height:48px">${bars}</svg>`;
}
