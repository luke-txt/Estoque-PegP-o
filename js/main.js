// ══════════════════════════════════════════════
// main.js — Event listeners e inicialização
// ══════════════════════════════════════════════

// ── Tema ──────────────────────────────────────
if (!darkMode) document.body.classList.add('light');

document.addEventListener('DOMContentLoaded', () => {

  // ── Login ────────────────────────────────────
  document.getElementById('btn-login').addEventListener('click', login);
  document.getElementById('inp-pass').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  document.getElementById('btn-forgot').addEventListener('click', () => {
    const p = document.getElementById('reset-panel');
    p.style.display = p.style.display === 'none' || !p.style.display ? 'block' : 'none';
  });

  // ── Logout ───────────────────────────────────
  document.getElementById('psel-logout-btn').addEventListener('click', () => auth.signOut());
  document.getElementById('btn-nav-logout').addEventListener('click', () => {
    if (podeAcessar('DONO')) {
      esconderApp();
      mostrarPadariaSelect();
    } else {
      auth.signOut();
    }
  });

  // ── Nav principal ─────────────────────────────
  document.querySelectorAll('.nav-item[data-tab]').forEach(el => {
    el.addEventListener('click', () => switchTab(el.dataset.tab));
  });

  // ── Operações ────────────────────────────────
  document.getElementById('btn-entrada').addEventListener('click', processarEntrada);
  document.getElementById('btn-saida').addEventListener('click',  processarSaida);
  document.getElementById('btn-nova-saida').addEventListener('click', fecharRecibo);

  // ── QR Code ──────────────────────────────────
  document.getElementById('qr-toggle-entrada').addEventListener('click', () => toggleQR('entrada'));
  document.getElementById('qr-toggle-saida').addEventListener('click',   () => toggleQR('saida'));

  // ── Autocomplete ─────────────────────────────
  const saiBusca = document.getElementById('sai-busca');
  saiBusca.addEventListener('input',   onSaiBuscaInput);
  saiBusca.addEventListener('keydown', onSaiBuscaKeydown);
  saiBusca.addEventListener('blur',    () => setTimeout(() => {
    document.getElementById('ac-list').style.display = 'none';
  }, 180));

  // ── Estoque ──────────────────────────────────
  document.getElementById('filtro-estoque').addEventListener('input', renderEstoque);
  document.getElementById('btn-export-csv').addEventListener('click', exportarEstoqueCSV);

  document.querySelectorAll('.tab-btn[data-estoque-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      switchEstoqueTab(btn.dataset.estoqueTab);
    });
  });

  // ── Diário ───────────────────────────────────
  document.getElementById('data-diario').addEventListener('change', renderDiario);
  document.getElementById('btn-export-diario').addEventListener('click',   exportarDiarioXLSX);
  document.getElementById('btn-export-completo').addEventListener('click', exportarBackupCompleto);

  // ── Relatórios ───────────────────────────────
  document.querySelectorAll('.pt[data-period]').forEach(btn => {
    btn.addEventListener('click', () => {
      relPeriod = btn.dataset.period;
      document.querySelectorAll('.pt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderRelatorio();
    });
  });

  // ── Modais ───────────────────────────────────
  // Editar produto
  document.getElementById('btn-modal-close').addEventListener('click',  fecharModal);
  document.getElementById('btn-modal-cancel').addEventListener('click', fecharModal);
  document.getElementById('btn-modal-save').addEventListener('click',   salvarEdicao);
  document.getElementById('edit-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('edit-modal')) fecharModal();
  });
  document.getElementById('btn-ver-historico').addEventListener('click', () => {
    if (editCode) abrirHistorico(editCode);
  });
  // Botão editar nos cards (delegado)
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-edit-code]');
    if (btn) abrirEditar(btn.dataset.editCode);
  });

  // Confirmar saída
  document.getElementById('btn-confirm-close').addEventListener('click',  fecharConfirm);
  document.getElementById('btn-confirm-cancel').addEventListener('click', fecharConfirm);
  document.getElementById('btn-confirm-ok').addEventListener('click', () => {
    const fn = confirmCallback;
    fecharConfirm();
    if (fn) fn();
  });
  document.getElementById('confirm-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('confirm-modal')) fecharConfirm();
  });

  // Histórico
  document.getElementById('btn-hist-close').addEventListener('click', () =>
    document.getElementById('hist-modal').classList.remove('open'));
  document.getElementById('hist-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('hist-modal'))
      document.getElementById('hist-modal').classList.remove('open');
  });

  // Senha
  document.getElementById('btn-passwd-close').addEventListener('click', () =>
    document.getElementById('passwd-modal').classList.remove('open'));
  document.getElementById('passwd-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('passwd-modal'))
      document.getElementById('passwd-modal').classList.remove('open');
  });
  document.getElementById('btn-passwd-save').addEventListener('click', salvarSenhaAdmin);

  // ── Usuários ─────────────────────────────────
  document.getElementById('btn-criar-usuario').addEventListener('click', criarUsuario);

  const btnDono = document.getElementById('btn-criar-usuario-dono');
  if (btnDono) btnDono.addEventListener('click', criarUsuarioDono);

  // Esconde campo padaria quando nível = DONO
  const selNivelDono = document.getElementById('dono-new-user-nivel');
  if (selNivelDono) {
    selNivelDono.addEventListener('change', () => {
      const field = document.getElementById('dono-padaria-field');
      if (field) field.style.display = selNivelDono.value === 'DONO' ? 'none' : '';
    });
  }

  // ── Tema ─────────────────────────────────────
  const tb = document.getElementById('theme-btn');
  tb.addEventListener('click', () => {
    darkMode = !darkMode;
    document.body.classList.toggle('light', !darkMode);
    tb.textContent = darkMode ? '🌙' : '☀️';
    localStorage.setItem('tema', darkMode ? 'dark' : 'light');
  });

  // ── Inatividade (8h) ─────────────────────────
  let inactivityTimer;
  function resetTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      toast('Sessão encerrada por inatividade.', 'warn');
      setTimeout(() => auth.signOut(), 2000);
    }, 8 * 60 * 60 * 1000);
  }
  ['click','keydown','touchstart'].forEach(e =>
    document.addEventListener(e, resetTimer, { passive: true }));
  resetTimer();
});
