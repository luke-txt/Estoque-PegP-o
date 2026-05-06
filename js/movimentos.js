// ══════════════════════════════════════════════
// movimentos.js — Entrada, Saída e Autocomplete
// ══════════════════════════════════════════════

let acItems = [], acIdx = -1;
let confirmCallback = null;

// ══════════════════════════════════════════════
// AUTOCOMPLETE
// ══════════════════════════════════════════════
function onSaiBuscaInput() {
  const val = document.getElementById('sai-busca').value.trim().toLowerCase();
  document.getElementById('sai-code').value = '';
  document.getElementById('sai-preview-box').style.display = 'none';
  acIdx = -1;

  if (!val) { document.getElementById('ac-list').style.display = 'none'; return; }

  if (cacheReady) { buildAcList(val); return; }

  const list = document.getElementById('ac-list');
  list.innerHTML = '<div class="ac-item" style="color:var(--muted);cursor:default">Carregando...</div>';
  list.style.display = 'block';

  db.ref('padarias/' + currentPadariaId + '/estoque').once('value').then(snap => {
    snap.forEach(c => {
      const v = c.val(); if (!v) return;
      cache[c.key] = { nome:v.nome||c.key, saldo:Number(v.saldo)||0, setor:v.setor||'SECOS', validade:v.validade||'', unidade:v.unidade||'un', minimo:Number(v.minimo)||0 };
    });
    cacheReady = true;
    const cur = document.getElementById('sai-busca').value.trim().toLowerCase();
    if (cur) buildAcList(cur); else list.style.display = 'none';
  }).catch(() => toast('Erro ao buscar', 'err'));
}

function buildAcList(val) {
  const list = document.getElementById('ac-list');
  list.innerHTML = '';
  acItems = Object.entries(cache)
    .filter(([code, item]) =>
      (item.nome || '').toLowerCase().includes(val) ||
      (code || '').toLowerCase().includes(val)
    )
    .sort((a, b) => (a[1].nome || '').localeCompare(b[1].nome || ''))
    .slice(0, 10);

  if (!acItems.length) {
    const el = document.createElement('div');
    el.className = 'ac-item';
    el.style.cssText = 'color:var(--muted);cursor:default';
    el.textContent = 'Nenhum produto encontrado';
    list.appendChild(el);
    list.style.display = 'block';
    return;
  }

  acItems.forEach(([code, item]) => {
    const el   = document.createElement('div');
    el.className = 'ac-item';
    const left = document.createElement('div');
    const n    = document.createElement('div'); n.className = 'ac-name'; n.textContent = item.nome;
    const c    = document.createElement('div'); c.className = 'ac-code'; c.textContent = code;
    left.append(n, c);
    const badge = document.createElement('span');
    badge.className = 'badge ' + (item.saldo > 0 ? 'b-green' : 'b-red');
    badge.textContent = item.saldo + ' ' + (item.unidade || 'un');
    el.append(left, badge);
    el.addEventListener('mousedown', ev => { ev.preventDefault(); selecionarItem(code); });
    list.appendChild(el);
  });
  list.style.display = 'block';
}

function onSaiBuscaKeydown(ev) {
  const list  = document.getElementById('ac-list');
  const items = list.querySelectorAll('.ac-item');
  if (!items.length || list.style.display === 'none') return;

  if      (ev.key === 'ArrowDown') { acIdx = Math.min(acIdx + 1, items.length - 1); ev.preventDefault(); }
  else if (ev.key === 'ArrowUp')   { acIdx = Math.max(acIdx - 1, 0); ev.preventDefault(); }
  else if (ev.key === 'Enter' && acIdx >= 0) {
    ev.preventDefault();
    if (acItems[acIdx]) selecionarItem(acItems[acIdx][0]);
    return;
  } else return;

  items.forEach((el, i) => el.classList.toggle('sel', i === acIdx));
  items[acIdx]?.scrollIntoView({ block: 'nearest' });
}

function selecionarItem(code) {
  const item = cache[code];
  if (!item) { toast('Produto não encontrado', 'err'); return; }

  document.getElementById('sai-code').value  = code;
  document.getElementById('sai-busca').value = item.nome;
  document.getElementById('ac-list').style.display = 'none';
  document.getElementById('sai-preview-box').style.display = 'block';
  document.getElementById('prev-nome').textContent = item.nome;

  const saldo = document.getElementById('prev-saldo');
  saldo.textContent = item.saldo + ' ' + (item.unidade || 'un') + ' em estoque';
  saldo.className   = 'badge ' + (item.saldo > 0 ? 'b-green' : 'b-red');

  const dias = diasVencer(item.validade);
  const vel  = document.getElementById('prev-val');
  vel.textContent = item.validade ? 'Val: ' + item.validade : 'Sem validade';
  vel.className   = 'badge ' + (dias !== null && dias <= 7 ? 'b-red' : dias !== null && dias <= 30 ? 'b-yellow' : 'b-gray');

  const minEl = document.getElementById('prev-min');
  if (item.minimo > 0) { minEl.textContent = 'Mín: ' + item.minimo + ' ' + item.unidade; minEl.style.display = ''; }
  else minEl.style.display = 'none';
}

// ══════════════════════════════════════════════
// ENTRADA
// ══════════════════════════════════════════════
function processarEntrada() {
  if (!podeAcessar('GERENTE')) { toast('Acesso negado.', 'err'); return; }

  const qtd   = parseFloat(document.getElementById('ent-qtd').value.replace(',', '.'));
  const code  = document.getElementById('ent-code').value.trim();
  const nome  = document.getElementById('ent-nome').value.trim();

  if (isNaN(qtd) || qtd <= 0) { toast('Quantidade inválida.', 'err'); return; }
  if (!code) { toast('Informe o código.', 'err'); return; }
  if (!nome) { toast('Informe o nome.', 'err'); return; }

  gravarMovimento('ENTRADA', code, {
    nome,
    setor:    document.getElementById('ent-setor').value,
    validade: document.getElementById('ent-val').value,
    unidade:  document.getElementById('ent-unidade').value,
    minimo:   parseFloat(document.getElementById('ent-minimo').value) || 0,
    obs:      document.getElementById('ent-obs').value.trim()
  }, qtd);
}

// ══════════════════════════════════════════════
// SAÍDA
// ══════════════════════════════════════════════
function processarSaida() {
  const qtd = parseFloat(document.getElementById('sai-qtd').value.replace(',', '.'));
  if (isNaN(qtd) || qtd <= 0) { toast('Quantidade inválida.', 'err'); return; }

  let code = document.getElementById('sai-code').value.trim();
  if (!code) {
    const busca = document.getElementById('sai-busca').value.trim().toLowerCase();
    const found = Object.entries(cache).find(([k, v]) =>
      k.toLowerCase() === busca || (v.nome && v.nome.toLowerCase() === busca));
    if (found) { code = found[0]; }
    else { toast('Selecione um produto da lista.', 'err'); if (busca && cacheReady) buildAcList(busca); return; }
  }

  const item = cache[code];
  if (!item) { toast('Produto não encontrado.', 'err'); return; }
  if (item.saldo < qtd) { toast('Saldo insuficiente! Há apenas ' + item.saldo + ' ' + item.unidade + '.', 'err'); return; }

  const obs = document.getElementById('sai-obs').value.trim();
  if (userLevel === 'OPERADOR' && !obs) { toast('Informe a finalidade da retirada.', 'err'); document.getElementById('sai-obs').focus(); return; }

  let dataManual = null;
  if (podeAcessar('GERENTE')) {
    const mf = document.getElementById('sai-data-manual');
    dataManual = mf ? mf.value : null;
  }

  // Abre modal de confirmação
  document.getElementById('confirm-nome').textContent = item.nome;
  document.getElementById('confirm-det').textContent  = qtd + ' ' + item.unidade + ' · Saldo: ' + item.saldo + ' ' + item.unidade;
  document.getElementById('confirm-msg').textContent  = obs ? 'Finalidade: "' + obs + '"' : 'Confirme a saída deste produto.';
  document.getElementById('confirm-modal').classList.add('open');
  confirmCallback = () => gravarMovimento('SAIDA', code, null, qtd, dataManual, obs, item);
}

function fecharConfirm() {
  document.getElementById('confirm-modal').classList.remove('open');
  confirmCallback = null;
}

// ══════════════════════════════════════════════
// GRAVAR MOVIMENTO
// ══════════════════════════════════════════════
function gravarMovimento(tipo, code, dadosEntrada, qtd, dataManual = null, obs = '', itemRef = null) {
  if (!currentPadariaId) { toast('Nenhuma padaria selecionada.', 'err'); return; }
  if (!code || typeof code !== 'string' || code.length > 100) { toast('Código inválido.', 'err'); return; }

  const pid = currentPadariaId;

  db.ref('padarias/' + pid + '/estoque/' + code).once('value').then(snap => {
    const atual = snap.val();
    if (tipo === 'SAIDA' && !atual) { toast('Produto não existe.', 'err'); return; }

    const base = atual || {
      nome:     dadosEntrada.nome,
      saldo:    0,
      setor:    dadosEntrada.setor,
      validade: dadosEntrada.validade,
      unidade:  dadosEntrada.unidade || 'un',
      minimo:   dadosEntrada.minimo || 0
    };

    const novoSaldo = tipo === 'ENTRADA' ? base.saldo + qtd : base.saldo - qtd;
    if (novoSaldo < 0) { toast('Saldo insuficiente!', 'err'); return; }

    const novosDados = {
      nome:     tipo === 'ENTRADA' ? dadosEntrada.nome    : (base.nome || ''),
      saldo:    novoSaldo,
      setor:    tipo === 'ENTRADA' ? dadosEntrada.setor   : (base.setor || 'SECOS'),
      validade: tipo === 'ENTRADA' ? dadosEntrada.validade: (base.validade || ''),
      unidade:  tipo === 'ENTRADA' ? dadosEntrada.unidade : (base.unidade || 'un'),
      minimo:   tipo === 'ENTRADA' ? (dadosEntrada.minimo || 0) : (base.minimo || 0)
    };

    const dataLog  = dataManual || dataLocal();
    const logEntry = {
      tipo, code,
      nome:    novosDados.nome,
      qtd,
      unidade: novosDados.unidade || 'un',
      hora:    new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }),
      usuario: currentUser ? currentUser.email : 'desconhecido',
      ts:      Date.now()
    };
    if (obs) logEntry.obs = obs;

    const updates = {};
    updates['padarias/' + pid + '/estoque/' + code]              = novosDados;
    updates['padarias/' + pid + '/logs/' + dataLog + '/' + Date.now()] = logEntry;

    db.ref().update(updates).then(() => {
      toast(tipo === 'ENTRADA' ? '✅ Entrada registrada!' : '✅ Saída registrada!');

      if (tipo === 'SAIDA' && novosDados.minimo > 0 && novoSaldo < novosDados.minimo)
        setTimeout(() => toast('⚠️ ' + novosDados.nome + ' abaixo do mínimo!', 'warn'), 600);

      if (tipo === 'ENTRADA') {
        ['ent-code','ent-nome','ent-val','ent-obs'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('ent-qtd').value    = 1;
        document.getElementById('ent-unidade').value = 'kg';
        document.getElementById('ent-minimo').value = 0;
      } else {
        ['sai-code','sai-busca','sai-obs'].forEach(id => document.getElementById(id).value = '');
        const smf = document.getElementById('sai-data-manual'); if (smf) smf.value = '';
        document.getElementById('sai-qtd').value = 1;
        document.getElementById('sai-preview-box').style.display = 'none';
        if (userLevel === 'OPERADOR') mostrarRecibo(novosDados.nome, qtd, novosDados.unidade, obs, novoSaldo);
      }

      if (document.getElementById('page-dashboard').classList.contains('active')) renderDashboard();

    }).catch(err => { console.error(err); toast('Erro: ' + (err.code || err.message), 'err'); });
  }).catch(err => { console.error(err); toast('Erro: ' + (err.message || 'Desconhecido'), 'err'); });
}

// ══════════════════════════════════════════════
// RECIBO (operador)
// ══════════════════════════════════════════════
function mostrarRecibo(nome, qtd, unidade, obs, novoSaldo) {
  const hora = new Date().toLocaleTimeString('pt-BR',  { hour:'2-digit', minute:'2-digit' });
  const data = new Date().toLocaleDateString('pt-BR',  { weekday:'short', day:'numeric', month:'short' });
  document.getElementById('recibo-content').innerHTML = `
    <div class="recibo-row"><span class="recibo-label">Produto</span><span class="recibo-val">${nome}</span></div>
    <div class="recibo-row"><span class="recibo-label">Quantidade</span><span class="recibo-val" style="color:var(--red)">-${qtd} ${unidade}</span></div>
    <div class="recibo-row"><span class="recibo-label">Finalidade</span><span class="recibo-val" style="font-size:13px">${obs}</span></div>
    <div class="recibo-row"><span class="recibo-label">Saldo restante</span><span class="recibo-val" style="color:${novoSaldo > 0 ? 'var(--green)' : 'var(--red)'}">${novoSaldo} ${unidade}</span></div>
    <div class="recibo-row"><span class="recibo-label">Horário</span><span class="recibo-val" style="font-size:13px">${data} · ${hora}</span></div>`;
  document.getElementById('recibo-box').style.display = 'block';
  document.querySelector('#page-saida .card.accent-red').style.display  = 'none';
  document.querySelector('#page-saida .qr-toggle').style.display = 'none';
  document.getElementById('qr-wrap-saida').style.display = 'none';
}

function fecharRecibo() {
  document.getElementById('recibo-box').style.display = 'none';
  const card   = document.querySelector('#page-saida .card.accent-red');
  const toggle = document.querySelector('#page-saida .qr-toggle');
  if (card)   card.style.display   = '';
  if (toggle) toggle.style.display = '';
}
