// ══════════════════════════════════════════════
// app.js — App por padaria: nav, cache, QR
// ══════════════════════════════════════════════

let qrInst = {}, qrOn = {};
let relPeriod = 'semana';

// ── Iniciar app padaria ───────────────────────
function iniciarAppPadaria(pid) {
  const padaria = PADARIAS.find(p => p.id === pid);
  currentPadariaId = pid;

  document.getElementById('app-screen').style.display = 'flex';
  document.getElementById('app-padaria-name').textContent = padaria ? padaria.nome : pid;
  document.getElementById('app-user-name').textContent    = currentUser.nome;
  document.getElementById('app-nivel-pill').textContent   =
    userLevel === 'DONO' ? '👑 Dono' :
    userLevel === 'ADMIN' ? '🔴 Admin' :
    userLevel === 'GERENTE' ? '🟡 Gerente' : '🟢 Operador';

  // Botão voltar/sair
  const btnVoltar = document.getElementById('btn-app-voltar');
  btnVoltar.title = podeAcessar('DONO') ? 'Voltar à rede' : 'Sair';

  aplicarNivel();
  carregarCache(pid);
  switchTab(userLevel === 'OPERADOR' ? 'saida' : 'dashboard');
}

// ── Nível de acesso ───────────────────────────
function aplicarNivel() {
  // Oculta itens por nível no drawer
  document.querySelectorAll('.level-gerente').forEach(el => {
    el.style.display = podeAcessar('GERENTE') ? '' : 'none';
  });
  document.querySelectorAll('.level-admin').forEach(el => {
    el.style.display = podeAcessar('ADMIN') ? '' : 'none';
  });

  // Operador: só saída visível no nav
  if (userLevel === 'OPERADOR') {
    document.querySelectorAll('.nav-btn[data-tab]').forEach(el => {
      el.style.display = el.dataset.tab === 'saida' ? '' : 'none';
    });
    const mais = document.getElementById('nav-mais-btn');
    if (mais) mais.style.display = 'none';
  }

  // Gerente+: campo de data manual e sem obrigação de obs
  if (podeAcessar('GERENTE')) {
    const df = document.getElementById('sai-data-field');
    if (df) df.style.display = '';
    const ob = document.getElementById('sai-obs-req');
    if (ob) ob.style.display = 'none';
  }
}

// ── Cache realtime ────────────────────────────
function carregarCache(pid) {
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
  ref.on('value', handler, err => toast('Erro Firebase: ' + err.code, 'err'));
  cacheUnsub = () => ref.off('value', handler);
}

function atualizarBadgeNav() {
  const alerta = Object.values(cache).some(i => {
    const d = diasVencer(i.validade);
    return (d !== null && d <= 7) || (i.minimo > 0 && i.saldo < i.minimo);
  });
  document.getElementById('nav-badge-estoque').style.display = alerta ? 'block' : 'none';
}

// ── Navegação ─────────────────────────────────
async function switchTab(tab) {
  if (userLevel === 'OPERADOR' && tab !== 'saida') {
    toast('Acesso não autorizado.', 'err'); return;
  }
  const perm = { entrada:'GERENTE', diario:'GERENTE', relatorio:'ADMIN', usuarios:'ADMIN' };
  if (perm[tab] && !podeAcessar(perm[tab])) { toast('Acesso não autorizado.', 'err'); return; }

  // Para QR ativos
  for (const k of Object.keys(qrInst)) {
    if (qrOn[k]) {
      await qrInst[k].stop().catch(() => {});
      qrOn[k] = false;
      document.getElementById('qr-wrap-' + k).style.display = 'none';
      const sp = document.querySelector('#qr-toggle-' + k + ' span');
      if (sp) sp.textContent = 'Usar câmera / QR';
    }
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn[data-tab], .nav-center-btn[data-tab]').forEach(n => n.classList.remove('active'));

  document.getElementById('page-' + tab).classList.add('active');
  const navEl = document.querySelector(`[data-tab="${tab}"]`);
  if (navEl) navEl.classList.add('active');

  fecharDrawer();

  if (tab === 'dashboard') renderDashboard();
  if (tab === 'estoque')   renderEstoque();
  if (tab === 'diario')    { document.getElementById('data-diario').value = dataLocal(); renderDiario(); }
  if (tab === 'relatorio') renderRelatorio();
  if (tab === 'usuarios')  renderUsuarios();
  if (tab === 'saida') {
    fecharRecibo();
    const lbl = document.getElementById('sai-data-label');
    if (lbl) lbl.textContent = new Date().toLocaleDateString('pt-BR',
      { weekday:'long', day:'numeric', month:'long' });
  }
}

// ── Drawer "Mais" ─────────────────────────────
function abrirDrawer() {
  document.getElementById('drawer-mais').classList.add('open');
  document.getElementById('drawer-bg').classList.add('open');
}
function fecharDrawer() {
  document.getElementById('drawer-mais').classList.remove('open');
  document.getElementById('drawer-bg').classList.remove('open');
}

// ── QR ───────────────────────────────────────
async function toggleQR(key) {
  const wrap   = document.getElementById('qr-wrap-' + key);
  const spanEl = document.querySelector('#qr-toggle-' + key + ' span');
  if (qrOn[key]) {
    await qrInst[key].stop().catch(() => {});
    qrOn[key] = false; wrap.style.display = 'none';
    spanEl.textContent = 'Usar câmera / QR'; return;
  }
  wrap.style.display = 'block';
  spanEl.textContent = 'Fechar câmera';
  if (!qrInst[key]) qrInst[key] = new Html5Qrcode('qr-reader-' + key);
  qrInst[key].start(
    { facingMode: 'environment' },
    { fps:15, qrbox:{width:240,height:160} },
    text => {
      if (key === 'entrada') {
        document.getElementById('ent-code').value = text;
        if (cache[text]) {
          document.getElementById('ent-nome').value  = cache[text].nome;
          document.getElementById('ent-setor').value = cache[text].setor;
        }
      } else { selecionarItem(text); }
      qrInst[key].stop().catch(() => {});
      qrOn[key] = false; wrap.style.display = 'none';
      spanEl.textContent = 'Usar câmera / QR';
    }, () => {}
  ).then(() => qrOn[key] = true)
   .catch(() => { toast('Câmera indisponível', 'err'); wrap.style.display = 'none'; });
}
