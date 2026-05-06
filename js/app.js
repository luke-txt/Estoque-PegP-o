// ══════════════════════════════════════════════
// app.js — Navegação, layout e cache realtime
// ══════════════════════════════════════════════

let qrInst = {}, qrOn = {};

// ── Iniciar app para uma padaria ──────────────
function iniciarAppPadaria(pid) {
  const padaria = PADARIAS.find(p => p.id === pid);

  document.getElementById('main-nav').style.display = 'flex';
  document.getElementById('app').style.display = 'block';
  document.getElementById('nav-padaria-label').textContent = padaria ? padaria.nome : pid;

  // Botão de logout/voltar
  const btnSair = document.getElementById('btn-nav-logout');
  if (podeAcessar('DONO')) {
    btnSair.innerHTML = '← Rede';
  } else {
    btnSair.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg> Sair`;
  }

  aplicarNivel();
  carregarCache(pid);
  switchTab(userLevel === 'OPERADOR' ? 'saida' : 'dashboard');
}

// ── Aplicar visibilidade por nível ────────────
function aplicarNivel() {
  // Gerente+
  document.querySelectorAll('.level-gerente, .level-gerente-field').forEach(el => {
    el.style.display = podeAcessar('GERENTE') ? '' : 'none';
  });
  // Admin+
  document.querySelectorAll('.level-admin').forEach(el => {
    el.style.display = podeAcessar('ADMIN') ? '' : 'none';
  });
  // Operador: só vê saída
  if (userLevel === 'OPERADOR') {
    document.querySelectorAll('.nav-item[data-tab]').forEach(el => {
      el.style.display = el.dataset.tab === 'saida' ? '' : 'none';
    });
    document.querySelector('.nav-logo').style.display = 'none';
  } else {
    if (podeAcessar('GERENTE')) {
      const df = document.getElementById('sai-data-field');
      if (df) df.style.display = '';
      const ob = document.getElementById('sai-obs-required');
      if (ob) ob.style.display = 'none';
    }
    // Dono: mostra painel de criar usuário dono
    if (podeAcessar('DONO')) {
      const dc = document.getElementById('dono-criar-usuario-card');
      if (dc) dc.style.display = '';
    }
  }
}

// ── Cache realtime ────────────────────────────
function carregarCache(pid) {
  // Carrega nomes de usuários
  db.ref('config/usuarios').once('value').then(snap => {
    snap.forEach(u => {
      const v = u.val();
      if (v && v.email) usuariosCache[v.email] = v.nome || v.email.split('@')[0];
    });
  });

  if (cacheUnsub) cacheUnsub();
  const ref = db.ref('padarias/' + pid + '/estoque');
  const handler = snap => {
    cache = {};
    snap.forEach(c => {
      const v = c.val(); if (!v) return;
      cache[c.key] = {
        nome:     v.nome || c.key,
        saldo:    Number(v.saldo) || 0,
        setor:    v.setor || 'SECOS',
        validade: v.validade || '',
        unidade:  v.unidade || 'un',
        minimo:   Number(v.minimo) || 0
      };
    });
    cacheReady = true;
    atualizarBadgeNav();
    if (document.getElementById('page-estoque').classList.contains('active'))   renderEstoque();
    if (document.getElementById('page-relatorio').classList.contains('active')) renderRelatorio();
    if (document.getElementById('page-dashboard').classList.contains('active')) renderDashboard();
  };
  ref.on('value', handler, err => { console.error('[Cache]', err); toast('Erro Firebase: ' + err.code, 'err'); });
  cacheUnsub = () => ref.off('value', handler);
}

function atualizarBadgeNav() {
  const temAlerta = Object.values(cache).some(i => {
    const d = diasVencer(i.validade);
    return (d !== null && d <= 7) || (i.minimo > 0 && i.saldo < i.minimo);
  });
  document.getElementById('nav-badge-estoque').style.display = temAlerta ? 'block' : 'none';
}

// ── Trocar de aba ─────────────────────────────
async function switchTab(tab) {
  if (userLevel === 'OPERADOR' && tab !== 'saida') {
    toast('Acesso não autorizado.', 'err'); return;
  }
  const permMap = { entrada:'GERENTE', diario:'GERENTE', relatorio:'ADMIN', usuarios:'ADMIN' };
  if (permMap[tab] && !podeAcessar(permMap[tab])) {
    toast('Acesso não autorizado.', 'err'); return;
  }

  // Para QR ativos
  for (const k of Object.keys(qrInst)) {
    if (qrOn[k]) {
      await qrInst[k].stop().catch(() => {});
      qrOn[k] = false;
      document.getElementById('qr-wrap-' + k).style.display = 'none';
      document.querySelector('#qr-toggle-' + k + ' span').textContent = 'Usar câmera / QR Code';
    }
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + tab).classList.add('active');
  const navEl = document.querySelector(`.nav-item[data-tab="${tab}"]`);
  if (navEl) navEl.classList.add('active');

  if (tab === 'dashboard') renderDashboard();
  if (tab === 'estoque')   renderEstoque();
  if (tab === 'diario')    { document.getElementById('data-diario').value = dataLocal(); renderDiario(); }
  if (tab === 'relatorio') renderRelatorio();
  if (tab === 'usuarios')  renderUsuarios();
  if (tab === 'saida') {
    fecharRecibo();
    const lbl = document.getElementById('sai-data-label');
    if (lbl) {
      lbl.textContent = new Date().toLocaleDateString('pt-BR',
        { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    }
  }
}

// ── QR Code ───────────────────────────────────
async function toggleQR(key) {
  const wrap    = document.getElementById('qr-wrap-' + key);
  const spanEl  = document.querySelector('#qr-toggle-' + key + ' span');

  if (qrOn[key]) {
    await qrInst[key].stop().catch(() => {});
    qrOn[key] = false;
    wrap.style.display = 'none';
    spanEl.textContent = 'Usar câmera / QR Code';
    return;
  }

  wrap.style.display = 'block';
  spanEl.textContent = 'Fechar câmera';
  if (!qrInst[key]) qrInst[key] = new Html5Qrcode('qr-reader-' + key);

  qrInst[key].start(
    { facingMode: 'environment' },
    { fps: 15, qrbox: { width:250, height:180 } },
    text => {
      if (key === 'entrada') {
        document.getElementById('ent-code').value = text;
        if (cache[text]) {
          document.getElementById('ent-nome').value  = cache[text].nome;
          document.getElementById('ent-setor').value = cache[text].setor;
        }
      } else {
        selecionarItem(text);
      }
      qrInst[key].stop().catch(() => {});
      qrOn[key] = false;
      wrap.style.display = 'none';
      spanEl.textContent = 'Usar câmera / QR Code';
    },
    () => {}
  ).then(() => qrOn[key] = true)
   .catch(() => { toast('Câmera indisponível', 'err'); wrap.style.display = 'none'; });
}
