// ══════════════════════════════════════════════
// dono.js — Painel do Dono (visão geral da rede)
// ══════════════════════════════════════════════

// ── Mostrar painel dono ───────────────────────
function mostrarDono() {
  esconderTudo();
  document.getElementById('dono-screen').style.display = 'flex';
  document.getElementById('dono-greeting-sub').textContent  = saudacao();
  document.getElementById('dono-greeting-main').innerHTML   = `${saudacao()},<br><em>${currentUser.nome}!</em>`;
  document.getElementById('dono-top-sub').textContent = 'Painel dos Donos';

  switchDonoTab('geral');
  carregarVisaoGeral();
  renderPadariaGrid();
}

// ── Tabs do dono ──────────────────────────────
function switchDonoTab(tab) {
  document.querySelectorAll('.dono-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.dono-tab[data-dono-tab="${tab}"]`).classList.add('active');
  document.querySelectorAll('.dono-page').forEach(p => p.classList.remove('active'));
  document.getElementById('dono-page-' + tab).classList.add('active');
  if (tab === 'usuarios') renderUsuariosDono();
}

// ══════════════════════════════════════════════
// VISÃO GERAL DA REDE
// ══════════════════════════════════════════════
async function carregarVisaoGeral() {
  const padativasIds = PADARIAS.filter(p => p.ativo).map(p => p.id);

  // Carrega estoque de todas as padarias em paralelo
  const estoqueSnaps = await Promise.all(
    padativasIds.map(pid => db.ref('padarias/' + pid + '/estoque').once('value').catch(() => null))
  );

  // Carrega logs de hoje de todas as padarias
  const hoje = dataLocal();
  const logSnaps = await Promise.all(
    padativasIds.map(pid => db.ref('padarias/' + pid + '/logs/' + hoje).once('value').catch(() => null))
  );

  // Agrega dados
  let totalProdutos = 0, totalAlertas = 0, totalBaixos = 0;
  const alertasCriticos = [];
  const produtosBaixos  = [];
  const movPorPadaria   = {}; // { pid: { entradas: N, saidas: N } }
  const dadosGrafico    = {}; // { hora: { e:N, s:N } }

  padativasIds.forEach((pid, i) => {
    const snap = estoqueSnaps[i];
    movPorPadaria[pid] = { entradas: 0, saidas: 0, nome: nomePadaria(pid) };

    if (snap && snap.exists()) {
      snap.forEach(c => {
        const v = c.val(); if (!v) return;
        totalProdutos++;
        const dias = diasVencer(v.validade);
        if (dias !== null && dias <= 7) {
          totalAlertas++;
          alertasCriticos.push({
            pid, nome: v.nome || c.key,
            info: dias <= 0 ? 'VENCIDO' : dias + 'd para vencer',
            tipo: 'vencimento'
          });
        }
        if (v.minimo > 0 && Number(v.saldo || 0) < Number(v.minimo || 0)) {
          totalBaixos++;
          produtosBaixos.push({
            pid, nome: v.nome || c.key,
            saldo: Number(v.saldo || 0),
            minimo: Number(v.minimo || 0),
            unidade: v.unidade || 'un'
          });
          if (dias !== null && dias <= 7) return; // já contou como alerta
          alertasCriticos.push({
            pid, nome: v.nome || c.key,
            info: `${v.saldo}/${v.minimo} ${v.unidade || 'un'}`,
            tipo: 'baixo'
          });
        }
      });
    }

    // Processa logs de hoje
    const logSnap = logSnaps[i];
    if (logSnap && logSnap.exists()) {
      logSnap.forEach(l => {
        const v = l.val(); if (!v) return;
        if (v.tipo === 'ENTRADA') movPorPadaria[pid].entradas += Number(v.qtd) || 0;
        else movPorPadaria[pid].saidas += Number(v.qtd) || 0;

        // Para o gráfico: agrupa por hora
        const hora = v.hora ? v.hora.split(':')[0] + 'h' : '?';
        if (!dadosGrafico[hora]) dadosGrafico[hora] = { e: 0, s: 0 };
        if (v.tipo === 'ENTRADA') dadosGrafico[hora].e += Number(v.qtd) || 0;
        else dadosGrafico[hora].s += Number(v.qtd) || 0;
      });
    }
  });

  // ── Métricas ──────────────────────────────
  document.getElementById('dono-metrics').innerHTML = `
    <div class="metric-box" style="--metric-color:var(--gold)">
      <div class="metric-label">Unidades ativas</div>
      <div class="metric-value gold">${padativasIds.length}</div>
      <div class="metric-sub">padarias na rede</div>
    </div>
    <div class="metric-box" style="--metric-color:var(--green)">
      <div class="metric-label">Produtos</div>
      <div class="metric-value green">${totalProdutos}</div>
      <div class="metric-sub">total na rede</div>
    </div>
    <div class="metric-box" style="--metric-color:var(--red)">
      <div class="metric-label">Alertas</div>
      <div class="metric-value ${totalAlertas > 0 ? 'red' : 'green'}">${totalAlertas}</div>
      <div class="metric-sub">vencendo em 7 dias</div>
    </div>
    <div class="metric-box" style="--metric-color:var(--amber)">
      <div class="metric-label">Abaixo mínimo</div>
      <div class="metric-value ${totalBaixos > 0 ? 'amber' : 'green'}">${totalBaixos}</div>
      <div class="metric-sub">na rede toda</div>
    </div>`;

  // ── Alertas críticos ──────────────────────
  const secAlertas = document.getElementById('dono-alertas-section');
  if (alertasCriticos.length) {
    secAlertas.style.display = '';
    document.getElementById('dono-alertas-list').innerHTML =
      alertasCriticos.slice(0, 8).map(a => `
        <div class="dono-alert-item">
          <div>
            <div class="dai-padaria">${icoPadaria(a.pid)} ${nomePadaria(a.pid)}</div>
            <div class="dai-produto">${a.nome}</div>
          </div>
          <div class="dai-info">${a.tipo === 'vencimento' ? '⏰ ' : '📉 '}${a.info}</div>
        </div>`).join('');
  } else {
    secAlertas.style.display = 'none';
  }

  // ── Produtos em falta ─────────────────────
  const faltaEl = document.getElementById('dono-falta-list');
  if (produtosBaixos.length) {
    faltaEl.innerHTML = `<div style="padding:0">` +
      produtosBaixos.slice(0, 10).map(p => `
        <div class="falta-item">
          <div>
            <div class="fi-padaria">${icoPadaria(p.pid)} ${nomePadaria(p.pid)}</div>
            <div class="fi-nome">${p.nome}</div>
          </div>
          <div class="fi-saldo">${p.saldo}/${p.minimo} ${p.unidade}</div>
        </div>`).join('') + `</div>`;
  } else {
    faltaEl.innerHTML = '<div class="empty-state">✅ Nenhum produto abaixo do mínimo</div>';
  }

  // ── Totais por padaria hoje ───────────────
  const totEl = document.getElementById('dono-totais-list');
  const todasMov = Object.values(movPorPadaria).filter(m => m.entradas > 0 || m.saidas > 0);
  if (todasMov.length) {
    totEl.innerHTML = Object.entries(movPorPadaria)
      .filter(([, m]) => m.entradas > 0 || m.saidas > 0)
      .sort((a, b) => (b[1].entradas + b[1].saidas) - (a[1].entradas + a[1].saidas))
      .map(([pid, m]) => `
        <div class="totais-row">
          <div class="tr-padaria">${icoPadaria(pid)} ${m.nome}</div>
          <div class="tr-badges">
            ${m.entradas > 0 ? `<span class="badge b-green">+${m.entradas}</span>` : ''}
            ${m.saidas   > 0 ? `<span class="badge b-red">-${m.saidas}</span>`   : ''}
          </div>
        </div>`).join('');
  } else {
    totEl.innerHTML = '<div class="empty-state">Nenhuma movimentação hoje ainda.</div>';
  }

  // ── Gráfico de movimentações ──────────────
  renderGraficoRede(dadosGrafico);

  // ── Ranking de unidades ───────────────────
  const rankEl = document.getElementById('dono-ranking-list');
  const rankData = Object.entries(movPorPadaria)
    .map(([pid, m]) => ({ pid, nome:m.nome, total:m.entradas + m.saidas, e:m.entradas, s:m.saidas }))
    .sort((a, b) => b.total - a.total);
  const maxTotal = rankData[0]?.total || 1;

  if (rankData.some(r => r.total > 0)) {
    rankEl.innerHTML = rankData.filter(r => r.total > 0).map((r, i) => `
      <div class="rank-rede-item">
        <div class="rri-n">${i + 1}</div>
        <div class="rri-info">
          <div class="rri-nome">${icoPadaria(r.pid)} ${r.nome}</div>
          <div class="rri-bar-wrap">
            <div class="rri-bar">
              <div class="rri-fill" style="width:${(r.total/maxTotal*100).toFixed(0)}%"></div>
            </div>
          </div>
        </div>
        <div class="rri-qty">${r.total} <span style="font-size:9px;color:var(--muted);font-weight:400">mov</span></div>
      </div>`).join('');
  } else {
    rankEl.innerHTML = '<div class="empty-state">Nenhuma movimentação hoje.</div>';
  }
}

// ── Gráfico de barras ─────────────────────────
function renderGraficoRede(dadosGrafico) {
  const horas = Object.keys(dadosGrafico).sort();
  if (!horas.length) return;

  const maxVal = Math.max(...horas.map(h => Math.max(dadosGrafico[h].e, dadosGrafico[h].s)), 1);
  const BAR_H  = 72;

  // Insere gráfico no card de movimentações
  const totEl = document.getElementById('dono-totais-list');
  const graficoHTML = `
    <div style="padding:4px 0 12px">
      <div class="chart-bars">
        ${horas.map(h => {
          const he = ((dadosGrafico[h].e / maxVal) * BAR_H).toFixed(0);
          const hs = ((dadosGrafico[h].s / maxVal) * BAR_H).toFixed(0);
          return `
            <div class="chart-bar-wrap">
              <div style="display:flex;gap:2px;align-items:flex-end;height:${BAR_H}px">
                <div class="chart-bar entrada" style="height:${he}px;flex:1"></div>
                <div class="chart-bar saida"   style="height:${hs}px;flex:1"></div>
              </div>
              <div class="chart-label">${h}</div>
            </div>`;
        }).join('')}
      </div>
      <div class="chart-legend">
        <div class="chart-legend-item"><div class="chart-legend-dot" style="background:var(--green)"></div>Entradas</div>
        <div class="chart-legend-item"><div class="chart-legend-dot" style="background:var(--red)"></div>Saídas</div>
      </div>
    </div>`;

  totEl.innerHTML = graficoHTML + totEl.innerHTML;
}

// ── Grid de seleção de padarias ───────────────
function renderPadariaGrid() {
  const grid = document.getElementById('dono-padaria-grid');
  grid.innerHTML = '';
  PADARIAS.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'padaria-card' + (p.ativo ? '' : ' coming');
    card.style.animationDelay = (i * 0.05) + 's';
    card.innerHTML = `
      <div class="card-icon-wrap">${p.ico}</div>
      <div class="card-cidade">${p.cidade}</div>
      <div class="card-nome">${p.nome}</div>
      <div class="card-badges" id="pcb-${p.id}">
        ${p.ativo ? '<span class="card-badge cb-ok">Carregando...</span>' : ''}
        ${!p.ativo ? '<span class="card-coming-tag">Em breve</span>' : ''}
      </div>`;
    if (p.ativo) {
      card.addEventListener('click', () => {
        document.getElementById('dono-screen').style.display = 'none';
        iniciarAppPadaria(p.id);
      });
      carregarBadgesPadaria(p.id);
    }
    grid.appendChild(card);
  });
}

async function carregarBadgesPadaria(pid) {
  const snap = await db.ref('padarias/' + pid + '/estoque').once('value').catch(() => null);
  const el   = document.getElementById('pcb-' + pid);
  if (!el) return;
  if (!snap || !snap.exists()) { el.innerHTML = '<span class="card-badge cb-ok">0 itens</span>'; return; }

  let total = 0, alertas = 0, baixos = 0;
  snap.forEach(c => {
    const v = c.val(); if (!v) return;
    total++;
    const d = diasVencer(v.validade);
    if (d !== null && d <= 7) alertas++;
    if (v.minimo > 0 && Number(v.saldo || 0) < Number(v.minimo || 0)) baixos++;
  });

  el.innerHTML =
    `<span class="card-badge cb-ok">${total} itens</span>` +
    (alertas > 0 ? `<span class="card-badge cb-alert">${alertas} venc</span>` : '') +
    (baixos  > 0 ? `<span class="card-badge cb-warn">${baixos} baixo</span>`  : '');
}

// ── Usuários (painel dono) ────────────────────
function renderUsuariosDono() {
  // Preenche select de padarias
  const selPad = document.getElementById('dono-new-user-padaria');
  if (selPad && !selPad.options.length) {
    PADARIAS.filter(p => p.ativo).forEach(p => {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.nome;
      selPad.appendChild(o);
    });
  }

  db.ref('config/usuarios').once('value').then(snap => {
    const cont = document.getElementById('dono-lista-usuarios');
    if (!snap.exists()) { cont.innerHTML = '<div class="empty-state">Nenhum usuário.</div>'; return; }
    let html = '';
    snap.forEach(u => {
      const uid = u.key, ud = u.val();
      const ativo = ud.ativo !== false;
      const isMe  = currentUser && uid === currentUser.uid;
      html += `<div class="user-item">
        <div>
          <div class="user-name">${ud.nome || ud.email || uid} ${isMe ? '<span style="font-size:10px;color:var(--muted)">(você)</span>' : ''}</div>
          <div class="user-level">${nivelLabel(ud.nivel || 'OPERADOR')} <span style="font-size:11px;color:var(--muted)">${ud.email || ''}</span> ${!ativo ? '<span class="badge b-red" style="font-size:9px">INATIVO</span>' : ''}</div>
          ${ud.padaria_id ? `<div style="font-size:10px;color:var(--muted);margin-top:2px">${icoPadaria(ud.padaria_id)} ${nomePadaria(ud.padaria_id)}</div>` : ''}
        </div>
        <div class="user-actions">
          ${!isMe ? `<button class="btn-ghost-sm" onclick="toggleAtivoUsuario('${uid}',${ativo})">${ativo ? '🚫' : '✅'}</button>` : ''}
          <button class="btn-ghost-sm" onclick="abrirTrocarSenha('${uid}','${ud.email || ''}')">🔑</button>
          ${!isMe ? `<button class="btn-ghost-sm" style="color:var(--red);border-color:var(--red-dim)" onclick="confirmarApagarUsuario('${uid}','${ud.nome || ud.email || uid}')">🗑️</button>` : ''}
        </div>
      </div>`;
    });
    cont.innerHTML = html || '<div class="empty-state">Nenhum usuário.</div>';
  });
}

function criarUsuarioDono() {
  if (!podeAcessar('DONO')) { toast('Acesso negado.', 'err'); return; }
  const nome      = document.getElementById('dono-new-user-nome').value.trim();
  const email     = document.getElementById('dono-new-user-login').value.trim().toLowerCase();
  const pass      = document.getElementById('dono-new-user-pass').value;
  const nivel     = document.getElementById('dono-new-user-nivel').value;
  const padaria_id= nivel === 'DONO' ? null : document.getElementById('dono-new-user-padaria').value;
  if (!nome)  { toast('Informe o nome.', 'err'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Email inválido.', 'err'); return; }
  if (pass.length < 6) { toast('Mínimo 6 caracteres.', 'err'); return; }
  const perfil = { nome, email, nivel, ativo:true, criadoPor:currentUser?.email||'', criadoEm:Date.now() };
  if (padaria_id) perfil.padaria_id = padaria_id;
  _criarFirebaseUser(email, pass, perfil, () => {
    ['dono-new-user-nome','dono-new-user-login','dono-new-user-pass'].forEach(id => document.getElementById(id).value = '');
    renderUsuariosDono();
  });
}
