// ══════════════════════════════════════════════
// usuarios.js — Gestão de usuários
// ══════════════════════════════════════════════

let passwdTargetUid = null;

// ── Listar usuários ───────────────────────────
function renderUsuarios() {
  if (!podeAcessar('ADMIN')) return;
  document.getElementById('usuarios-page-sub').textContent = 'Usuários — ' + nomePadaria(currentPadariaId);

  // Preenche select de padarias no painel dono
  const selPad = document.getElementById('dono-new-user-padaria');
  if (selPad && !selPad.options.length) {
    PADARIAS.filter(p => p.ativo).forEach(p => {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.nome;
      selPad.appendChild(o);
    });
  }

  db.ref('config/usuarios').once('value').then(snap => {
    const cont = document.getElementById('lista-usuarios');
    if (!snap.exists()) { cont.innerHTML = '<div class="empty">Nenhum usuário.</div>'; return; }

    let html = '';
    snap.forEach(u => {
      const uid = u.key, ud = u.val();
      const ativo = ud.ativo !== false;
      const isMe  = currentUser && uid === currentUser.uid;

      // Admin só vê usuários da sua padaria (exceto ele mesmo)
      if (!podeAcessar('DONO') && ud.padaria_id && ud.padaria_id !== currentPadariaId && !isMe) return;
      // Admin não vê Donos
      if (!podeAcessar('DONO') && ud.nivel === 'DONO') return;

      html += buildUserItem(uid, ud, ativo, isMe);
    });

    cont.innerHTML = html || '<div class="empty">Nenhum usuário desta padaria.</div>';
  });
}

function buildUserItem(uid, ud, ativo, isMe) {
  return `<div class="user-item">
    <div>
      <div class="user-name">
        ${ud.nome || ud.email || uid}
        ${isMe ? '<span style="font-size:10px;color:var(--muted)">(você)</span>' : ''}
      </div>
      <div class="user-level">
        ${nivelLabel(ud.nivel || 'OPERADOR')}
        <span style="font-size:11px;color:var(--muted);margin-left:4px">${ud.email || ''}</span>
        ${!ativo ? '<span class="badge b-red" style="font-size:9px;margin-left:4px">INATIVO</span>' : ''}
      </div>
      ${ud.padaria_id ? `<div style="font-size:10px;color:var(--muted);margin-top:2px">📍 ${nomePadaria(ud.padaria_id)}</div>` : ''}
    </div>
    <div class="user-actions">
      ${!isMe ? `<button class="btn btn-ghost btn-sm" onclick="toggleAtivoUsuario('${uid}',${ativo})" title="${ativo ? 'Inativar' : 'Ativar'}">${ativo ? '🚫' : '✅'}</button>` : ''}
      <button class="btn btn-ghost btn-sm" onclick="abrirTrocarSenha('${uid}','${ud.email || ''}')">🔑</button>
      ${!isMe ? `<button class="btn btn-sm" style="background:var(--red-dim);border:1px solid rgba(224,82,82,.3);color:var(--red)" onclick="confirmarApagarUsuario('${uid}','${ud.nome || ud.email || uid}')">🗑️</button>` : ''}
    </div>
  </div>`;
}

// ── Criar usuário (admin da padaria) ─────────
function criarUsuario() {
  if (!podeAcessar('ADMIN')) { toast('Acesso negado.', 'err'); return; }

  const nome  = document.getElementById('new-user-nome').value.trim();
  const email = document.getElementById('new-user-login').value.trim().toLowerCase();
  const pass  = document.getElementById('new-user-pass').value;
  const nivel = document.getElementById('new-user-nivel').value;

  if (!nome)  { toast('Informe o nome.', 'err'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Email inválido.', 'err'); return; }
  if (pass.length < 6) { toast('Senha mínimo 6 caracteres.', 'err'); return; }

  _criarFirebaseUser(email, pass, { nome, email, nivel, ativo:true, padaria_id:currentPadariaId,
    criadoPor: currentUser ? currentUser.email : '', criadoEm: Date.now() }, () => {
    ['new-user-nome','new-user-login','new-user-pass'].forEach(id => document.getElementById(id).value = '');
    renderUsuarios();
  });
}

// ── Criar usuário (dono — qualquer padaria) ───
function criarUsuarioDono() {
  if (!podeAcessar('DONO')) { toast('Acesso negado.', 'err'); return; }

  const nome      = document.getElementById('dono-new-user-nome').value.trim();
  const email     = document.getElementById('dono-new-user-login').value.trim().toLowerCase();
  const pass      = document.getElementById('dono-new-user-pass').value;
  const nivel     = document.getElementById('dono-new-user-nivel').value;
  const padaria_id= nivel === 'DONO' ? null : document.getElementById('dono-new-user-padaria').value;

  if (!nome)  { toast('Informe o nome.', 'err'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Email inválido.', 'err'); return; }
  if (pass.length < 6) { toast('Senha mínimo 6 caracteres.', 'err'); return; }

  const perfil = { nome, email, nivel, ativo:true, criadoPor: currentUser ? currentUser.email : '', criadoEm: Date.now() };
  if (padaria_id) perfil.padaria_id = padaria_id;

  _criarFirebaseUser(email, pass, perfil, () => {
    ['dono-new-user-nome','dono-new-user-login','dono-new-user-pass'].forEach(id => document.getElementById(id).value = '');
    renderUsuarios();
  });
}

// ── Helper: cria usuário em app secundário ────
function _criarFirebaseUser(email, pass, perfil, onSuccess) {
  const secApp  = firebase.initializeApp(firebaseConfig, 'sec_' + Date.now());
  const secAuth = secApp.auth();

  secAuth.createUserWithEmailAndPassword(email, pass)
    .then(cred =>
      db.ref('config/usuarios/' + cred.user.uid).set(perfil)
        .then(() => secAuth.signOut().then(() => secApp.delete()))
        .then(() => { toast('✅ Usuário criado: ' + perfil.nome); onSuccess && onSuccess(); })
    )
    .catch(err => {
      secAuth.signOut().catch(() => {}); secApp.delete().catch(() => {});
      toast(err.code === 'auth/email-already-in-use' ? 'Email já cadastrado.' : 'Erro: ' + err.message, 'err');
    });
}

// ── Ativar / inativar ─────────────────────────
function toggleAtivoUsuario(uid, ativoAtual) {
  if (!podeAcessar('ADMIN')) { toast('Acesso negado.', 'err'); return; }
  if (currentUser && uid === currentUser.uid) { toast('Não pode inativar a si mesmo.', 'err'); return; }

  db.ref('config/usuarios/' + uid).update({ ativo: !ativoAtual }).then(() => {
    toast(ativoAtual ? '🚫 Usuário inativado.' : '✅ Usuário ativado.');
    renderUsuarios();
  }).catch(err => toast('Erro: ' + err.code, 'err'));
}

// ── Apagar ─────────────────────────────────────
function confirmarApagarUsuario(uid, nome) {
  if (!podeAcessar('ADMIN')) { toast('Acesso negado.', 'err'); return; }
  if (currentUser && uid === currentUser.uid) { toast('Não pode apagar a si mesmo.', 'err'); return; }
  if (confirm('Remover usuário "' + nome + '"? O acesso será bloqueado imediatamente.')) {
    db.ref('config/usuarios/' + uid).remove().then(() => {
      toast('🗑️ Usuário removido: ' + nome);
      renderUsuarios();
    }).catch(err => toast('Erro: ' + err.code, 'err'));
  }
}

// ── Trocar senha ──────────────────────────────
function abrirTrocarSenha(uid, email) {
  passwdTargetUid = { uid, email };
  document.getElementById('passwd-user-label').textContent = 'Alterando senha de: ' + email;
  document.getElementById('passwd-new').value     = '';
  document.getElementById('passwd-confirm').value = '';
  document.getElementById('passwd-modal').classList.add('open');
}

function salvarSenhaAdmin() {
  if (!passwdTargetUid) return;
  if (!podeAcessar('ADMIN')) { toast('Acesso negado.', 'err'); return; }

  const nova = document.getElementById('passwd-new').value;
  const conf = document.getElementById('passwd-confirm').value;
  if (nova.length < 6) { toast('Mínimo 6 caracteres.', 'err'); return; }
  if (nova !== conf)   { toast('Senhas não conferem.', 'err'); return; }

  // Sinaliza reset pendente no banco (a ser processado via Firebase Functions ou manualmente)
  db.ref('config/usuarios/' + passwdTargetUid.uid).update({
    senha_reset_pendente: true,
    reset_solicitado_por: currentUser ? currentUser.email : '',
    reset_ts: Date.now()
  }).then(() => {
    toast('✅ Reset de senha solicitado. Notifique o usuário.');
    document.getElementById('passwd-modal').classList.remove('open');
  }).catch(err => toast('Erro: ' + err.code, 'err'));
}
