// ══════════════════════════════════════════════
// auth.js — Splash, Login e Auth State
// ══════════════════════════════════════════════

let loginAttempts = 0, loginBloqueado = false, authResolved = false;

// ── Splash ────────────────────────────────────
function initSplash() {
  const splash = document.getElementById('splash');

  // Animação do pão saindo do forno
  splash.innerHTML = `
    <div class="splash-ring splash-ring-1"></div>
    <div class="splash-ring splash-ring-2"></div>
    <div class="splash-ring splash-ring-3"></div>
    <div style="display:flex;flex-direction:column;align-items:center">
      <div class="splash-oven">
        <div class="splash-steam">
          <div class="steam-line"></div>
          <div class="steam-line"></div>
          <div class="steam-line"></div>
        </div>
        <div class="splash-oven-door">
          <div class="splash-oven-glow"></div>
          <div class="splash-bread-emoji">🍞</div>
          <div class="splash-oven-handle"></div>
        </div>
      </div>
      <div class="splash-oven-legs">
        <div class="splash-oven-leg"></div>
        <div class="splash-oven-leg"></div>
      </div>
    </div>
    <div class="splash-name">Rede PegPão</div>
    <div class="splash-tagline">Controle de Estoque</div>
    <div class="splash-loader"><div class="splash-loader-bar"></div></div>
  `;

  // Esconde splash após ~3s
  setTimeout(() => {
    splash.classList.add('hide');
    setTimeout(() => splash.style.display = 'none', 600);
  }, 3000);
}

// ── Timeout de carregamento ───────────────────
const authTimeout = setTimeout(() => {
  document.getElementById('auth-loading') &&
    (document.getElementById('auth-loading').style.display = 'none');
  if (!currentUser) mostrarLogin();
}, 10000);

// ── Auth state ────────────────────────────────
auth.onAuthStateChanged(async firebaseUser => {
  if (authResolved && firebaseUser && currentUser) return;
  if (authResolved && !firebaseUser) authResolved = false;
  clearTimeout(authTimeout);

  if (!firebaseUser) {
    esconderTudo();
    setTimeout(mostrarLogin, 3100); // aguarda splash
    if (cacheUnsub) { cacheUnsub(); cacheUnsub = null; }
    cache = {}; cacheReady = false;
    userLevel = null; currentUser = null; currentPadariaId = null;
    return;
  }

  try {
    const snap   = await db.ref('config/usuarios/' + firebaseUser.uid).once('value');
    const perfil = snap.val();

    if (!perfil || perfil.ativo === false) {
      await auth.signOut();
      mostrarLogin('Acesso negado. Conta inativa ou não cadastrada.');
      return;
    }

    userLevel = perfil.nivel || 'OPERADOR';
    currentUser = {
      uid:       firebaseUser.uid,
      email:     firebaseUser.email,
      nome:      perfil.nome || firebaseUser.email.split('@')[0],
      padaria_id:perfil.padaria_id || null
    };

    db.ref('auditoria/login_ok').push({
      uid: currentUser.uid, email: currentUser.email,
      nivel: userLevel, ts: Date.now()
    });

    esconderTudo();
    const tb = document.getElementById('theme-btn');
    tb.style.display = 'flex';
    tb.textContent   = darkMode ? '🌙' : '☀️';
    authResolved = true;

    if (podeAcessar('DONO')) {
      mostrarDono();
    } else {
      currentPadariaId = currentUser.padaria_id;
      if (!currentPadariaId) {
        await auth.signOut();
        mostrarLogin('Usuário sem padaria atribuída. Contate o administrador.');
        return;
      }
      iniciarAppPadaria(currentPadariaId);
    }

  } catch (err) {
    console.error(err);
    await auth.signOut();
    mostrarLogin('Erro ao verificar perfil: ' + err.message);
  }
});

// ── Login ─────────────────────────────────────
function mostrarLogin(erro) {
  esconderTudo();
  document.getElementById('login-screen').style.display = 'flex';
  if (erro) {
    const el = document.getElementById('login-error');
    el.textContent = erro; el.style.display = 'block';
  }
}

function login() {
  if (loginBloqueado) { toast('Aguarde antes de tentar novamente.', 'err'); return; }
  const email = document.getElementById('inp-email').value.trim().toLowerCase();
  const pass  = document.getElementById('inp-pass').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  if (!email || !pass) return;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errEl.textContent = 'Email inválido.'; errEl.style.display = 'block'; return;
  }
  document.getElementById('login-screen').style.display = 'none';

  auth.signInWithEmailAndPassword(email, pass)
    .then(() => { loginAttempts = 0; })
    .catch(err => {
      loginAttempts++;
      if (loginAttempts >= 5) {
        loginBloqueado = true;
        setTimeout(() => { loginBloqueado = false; loginAttempts = 0; }, 30000);
        mostrarLogin('Bloqueado por 30s após 5 tentativas.');
      } else {
        const msg = (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found')
          ? `Email ou senha incorretos. (${loginAttempts}/5)` : 'Erro: ' + err.message;
        mostrarLogin(msg);
      }
      db.ref('auditoria/login_falha').push({ email, ts: Date.now(), tentativa: loginAttempts });
    });
}

// ── Esconder telas ────────────────────────────
function esconderTudo() {
  ['login-screen','dono-screen','app-screen'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function esconderApp() {
  document.getElementById('app-screen').style.display = 'none';
  if (cacheUnsub) { cacheUnsub(); cacheUnsub = null; }
  cache = {}; cacheReady = false; currentPadariaId = null;
}
