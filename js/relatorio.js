// ══════════════════════════════════════════════
// relatorio.js — Métricas e rankings
// ══════════════════════════════════════════════

let relPeriod = 'semana';

// ── Dashboard ─────────────────────────────────
function renderDashboard() {
  const padaria = PADARIAS.find(p => p.id === currentPadariaId);
  document.getElementById('dash-greeting').textContent   = saudacao() + '!';
  document.getElementById('dash-user-label').textContent = currentUser.nome + ' · ' + (padaria ? padaria.nome : '');

  const itens   = Object.values(cache);
  const vencidos= itens.filter(i => { const d = diasVencer(i.validade); return d !== null && d <= 0; });
  const vencendo= itens.filter(i => { const d = diasVencer(i.validade); return d !== null && d > 0 && d <= 7; });
  const baixos  = itens.filter(i => i.minimo > 0 && i.saldo < i.minimo);

  // Alertas
  const alertDiv = document.getElementById('dash-alert');
  if (vencidos.length || vencendo.length) {
    alertDiv.style.display = 'block';
    document.getElementById('dash-alert-list').innerHTML = [
      ...vencidos.map(i => `<div class="dash-alert-item"><span>${i.nome}</span><span style="color:var(--red);font-weight:700;font-family:'JetBrains Mono',monospace">VENCIDO</span></div>`),
      ...vencendo.map(i => `<div class="dash-alert-item"><span>${i.nome}</span><span style="color:var(--amber);font-family:'JetBrains Mono',monospace">${diasVencer(i.validade)}d</span></div>`)
    ].join('');
  } else alertDiv.style.display = 'none';

  // Baixo estoque
  const lowDiv = document.getElementById('dash-low');
  if (baixos.length) {
    lowDiv.style.display = 'block';
    document.getElementById('dash-low-list').innerHTML = baixos.map(i =>
      `<div class="dash-alert-item"><span>${i.nome}</span><span style="color:var(--amber);font-family:'JetBrains Mono',monospace">${i.saldo}/${i.minimo} ${i.unidade}</span></div>`
    ).join('');
  } else lowDiv.style.display = 'none';

  // Métricas
  document.getElementById('dash-metrics').innerHTML = `
    <div class="dash-box" onclick="switchTab('estoque')">
      <div class="dl">Produtos</div>
      <div class="dv gold">${itens.length}</div>
      <div class="ds">no estoque</div>
    </div>
    <div class="dash-box" onclick="switchTab('estoque')">
      <div class="dl">Unidades</div>
      <div class="dv">${itens.reduce((s, i) => s + (i.saldo || 0), 0)}</div>
      <div class="ds">total em estoque</div>
    </div>
    <div class="dash-box" onclick="switchTab('estoque')">
      <div class="dl">Vencendo</div>
      <div class="dv ${vencidos.length + vencendo.length > 0 ? 'red' : 'green'}">${vencidos.length + vencendo.length}</div>
      <div class="ds">em 7 dias</div>
    </div>
    <div class="dash-box" onclick="switchTab('estoque')">
      <div class="dl">Abaixo mín.</div>
      <div class="dv ${baixos.length > 0 ? 'amber' : 'green'}">${baixos.length}</div>
      <div class="ds">itens</div>
    </div>`;

  // Últimas movimentações
  db.ref('padarias/' + currentPadariaId + '/logs/' + dataLocal()).once('value').then(snap => {
    const logs = [];
    if (snap.exists()) snap.forEach(l => { const v = l.val(); if (v) logs.push(v); });
    logs.sort((a, b) => b.ts - a.ts);

    document.getElementById('dash-recent').innerHTML = logs.slice(0, 8).map(v => `
      <div class="recent-log">
        <div>
          <div class="recent-log-nome">${v.nome || '—'}
            <span class="badge ${v.tipo === 'ENTRADA' ? 'b-green' : 'b-red'}" style="font-size:9px">
              ${v.tipo === 'ENTRADA' ? '+' : '-'}${v.qtd} ${v.unidade || ''}
            </span>
          </div>
          ${v.obs ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">${v.obs}</div>` : ''}
        </div>
        <div class="recent-log-hora">${v.hora || ''}</div>
      </div>`).join('') || '<div class="empty">Nenhuma movimentação hoje.</div>';
  });
}

// ── Relatórios ────────────────────────────────
async function renderRelatorio() {
  const itens  = Object.values(cache);
  const venc7  = itens.filter(i => { const d = diasVencer(i.validade); return d !== null && d <= 7; }).length;

  document.getElementById('rel-stats').innerHTML = `
    <div class="stat-box"><div class="sl">Produtos</div><div class="sv">${itens.length}</div></div>
    <div class="stat-box"><div class="sl">Unidades totais</div><div class="sv">${itens.reduce((s, i) => s + (i.saldo || 0), 0)}</div></div>
    <div class="stat-box"><div class="sl">Vencendo</div><div class="sv${venc7 > 0 ? ' red' : ''}">${venc7}</div></div>
    <div class="stat-box"><div class="sl">Categorias</div><div class="sv">${new Set(itens.map(i => i.setor)).size}</div></div>`;

  const dias   = relPeriod === 'semana' ? 7 : relPeriod === 'mes' ? 30 : 365;
  const saidas = {}, entradas = {};
  const proms  = [];

  for (let i = 0; i < dias; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    proms.push(db.ref('padarias/' + currentPadariaId + '/logs/' + dataLocal(d)).once('value'));
  }

  const snaps = await Promise.all(proms);
  snaps.forEach(s => s.forEach(l => {
    const v = l.val(); if (!v || !v.code) return;
    const key  = v.code;
    const nome = (cache[key] && cache[key].nome) ? cache[key].nome : (v.nome || key);
    const unid = (cache[key] && cache[key].unidade) ? cache[key].unidade : (v.unidade || 'un');

    if (v.tipo === 'SAIDA') {
      if (!saidas[key]) saidas[key] = { nome, qtd:0, unidade:unid };
      saidas[key].qtd += Number(v.qtd) || 0;
    } else {
      if (!entradas[key]) entradas[key] = { nome, qtd:0, unidade:unid };
      entradas[key].qtd += Number(v.qtd) || 0;
    }
  }));

  renderRanking('rank-saidas',   saidas,   'var(--red)');
  renderRanking('rank-entradas', entradas, 'var(--green)');
}

function renderRanking(id, data, cor) {
  const el     = document.getElementById(id);
  const sorted = Object.values(data).sort((a, b) => b.qtd - a.qtd).slice(0, 10);

  if (!sorted.length) { el.innerHTML = '<div class="empty">Sem dados no período.</div>'; return; }

  const max = sorted[0].qtd;
  el.innerHTML = sorted.map((item, i) => `
    <div class="rank-item">
      <div class="rank-n">${i + 1}</div>
      <div class="rank-bar-wrap">
        <div class="rank-nome">${item.nome}</div>
        <div class="rank-bar">
          <div class="rank-fill" style="width:${(item.qtd / max * 100).toFixed(0)}%;background:${cor}"></div>
        </div>
      </div>
      <div class="rank-qty" style="color:${cor}">
        ${item.qtd} <span style="font-size:10px;font-weight:400;color:var(--muted)">${item.unidade}</span>
      </div>
    </div>`).join('');
}
