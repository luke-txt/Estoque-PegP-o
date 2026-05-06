// ══════════════════════════════════════════════
// auth.js — Autenticação e controle de sessão
// ══════════════════════════════════════════════

let loginAttempts = 0;
let loginBloqueado = false;
let authResolved = false;

// ── Timeout de carregamento (10s) ─────────────
const authTimeout = setTimeout(() => {
  const loading = document.getElementById('auth-loading');
  if (loading && loading.style.display !== 'none') {
    loading.style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
  }
}, 10000);

// ── Listener principal ────────────────────────
auth.onAuthStateChanged(async firebaseUser => {
  if (authResolved && firebaseUser && currentUser) return;
  if (authResolved && !firebaseUser) authResolved = false;

  clearTimeout(authTimeout);
  const loading = document.getElementById('auth-loading');

  if (!firebaseUser) {
    loading.style.display = 'none';
    esconderTudo();
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('theme-btn').style.display = 'none';
    if (cacheUnsub) { cacheUnsub(); cacheUnsub = null; }
    cache = {}; cacheReady = false;
    userLevel = null; currentUser = null; currentPadariaId = null;
    return;
  }

  try {
    const snap = await db.ref('config/usuarios/' + firebaseUser.uid).once('value');
    const perfil = snap.val();

    if (!perfil || perfil.ativo === false) {
      await auth.signOut();
      mostrarErroLogin('Acesso negado. Conta inativa ou não cadastrada.');
      return;
    }

    userLevel = perfil.nivel || 'OPERADOR';
    currentUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      nome: perfil.nome || firebaseUser.email.split('@')[0],
      padaria_id: perfil.padaria_id || null
    };

    db.ref('auditoria/login_ok').push({
      uid: currentUser.uid, email: currentUser.email,
      nivel: userLevel, ts: Date.now()
    });

    loading.style.display = 'none';
    const tb = document.getElementById('theme-btn');
    tb.style.display = 'flex';
    tb.textContent = darkMode ? '🌙' : '☀️';
    authResolved = true;

    if (podeAcessar('DONO')) {
      mostrarPadariaSelect();
    } else {
      currentPadariaId = currentUser.padaria_id;
      if (!currentPadariaId) {
        await auth.signOut();
        mostrarErroLogin('Usuário sem padaria atribuída. Contate o administrador.');
        return;
      }
      iniciarAppPadaria(currentPadariaId);
    }

  } catch (err) {
    console.error(err);
    await auth.signOut();
    mostrarErroLogin('Erro ao verificar perfil: ' + err.message);
  }
});

// ── Login ─────────────────────────────────────
function login() {
  if (loginBloqueado) { toast('Aguarde antes de tentar novamente.', 'err'); return; }

  const email = document.getElementById('inp-email').value.trim().toLowerCase();
  const pass  = document.getElementById('inp-pass').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  if (!email || !pass) return;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errEl.textContent = 'Email inválido.';
    errEl.style.display = 'block';
    return;
  }

  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('auth-loading').style.display = 'flex';

  auth.signInWithEmailAndPassword(email, pass)
    .then(() => { loginAttempts = 0; })
    .catch(err => {
      loginAttempts++;
      if (loginAttempts >= 5) {
        loginBloqueado = true;
        setTimeout(() => { loginBloqueado = false; loginAttempts = 0; }, 30000);
        mostrarErroLogin('Bloqueado por 30s após 5 tentativas.');
      } else {
        const msg = (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found')
          ? `Email ou senha incorretos. (${loginAttempts}/5)`
          : 'Erro: ' + err.message;
        mostrarErroLogin(msg);
      }
      db.ref('auditoria/login_falha').push({ email, ts: Date.now(), tentativa: loginAttempts });
    });
}

function mostrarErroLogin(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.style.display = 'block';
  document.getElementById('auth-loading').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

// ── Tela de seleção de padaria (Dono) ─────────
function mostrarPadariaSelect() {
  esconderTudo();
  const sel = document.getElementById('padaria-select-screen');
  sel.style.display = 'flex';
  renderPadariaSelect();
}

function renderPadariaSelect() {
  document.getElementById('psel-greeting').textContent = saudacao() + ', ' + currentUser.nome + '!';
  const grid = document.getElementById('psel-grid');
  grid.innerHTML = '';

  PADARIAS.forEach(p => {
    const card = document.createElement('div');
    card.className = 'psel-card' + (p.ativo ? '' : ' coming-soon');
    card.innerHTML = `
      <div class="psel-ico">${p.ico}</div>
      <div class="psel-nome">${p.nome}</div>
      <div class="psel-cidade">${p.cidade}</div>
      ${!p.ativo ? '<div class="psel-coming">Em breve</div>' : ''}
      <div class="psel-alerts" id="psel-alerts-${p.id}"></div>
    `;
    if (p.ativo) card.addEventListener('click', () => {
      currentPadariaId = p.id;
      document.getElementById('padaria-select-screen').style.display = 'none';
      iniciarAppPadaria(p.id);
    });
    grid.appendChild(card);
    if (p.ativo) carregarAlertasPadariaCard(p.id);
  });
}

async function carregarAlertasPadariaCard(pid) {
  const snap = await db.ref('padarias/' + pid + '/estoque').once('value').catch(() => null);
  if (!snap || !snap.exists()) return;
  let alertas = 0, baixos = 0;
  snap.forEach(c => {
    const v = c.val(); if (!v) return;
    const d = diasVencer(v.validade);
    if (d !== null && d <= 7) alertas++;
    if (v.minimo > 0 && Number(v.saldo || 0) < Number(v.minimo || 0)) baixos++;
  });
  const el = document.getElementById('psel-alerts-' + pid);
  if (!el) return;
  let html = '';
  if (alertas > 0) html += `<span class="psel-badge-mini b-red">${alertas} venc</span>`;
  if (baixos > 0)  html += `<span class="psel-badge-mini b-yellow">${baixos} baixo</span>`;
  el.innerHTML = html;
}

// ── Esconder telas ────────────────────────────
function esconderTudo() {
  document.getElementById('padaria-select-screen').style.display = 'none';
  document.getElementById('main-nav').style.display = 'none';
  document.getElementById('app').style.display = 'none';
}

function esconderApp() {
  document.getElementById('main-nav').style.display = 'none';
  document.getElementById('app').style.display = 'none';
  if (cacheUnsub) { cacheUnsub(); cacheUnsub = null; }
  cache = {}; cacheReady = false; currentPadariaId = null;
}
