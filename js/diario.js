// ══════════════════════════════════════════════
// diario.js — Diário de movimentações
// ══════════════════════════════════════════════

async function renderDiario() {
  const data = document.getElementById('data-diario').value;
  if (!data) return;
  document.getElementById('lista-diario').innerHTML = '<div class="empty">Carregando...</div>';

  const snap = await db.ref('padarias/' + currentPadariaId + '/logs/' + data).once('value').catch(() => null);
  if (!snap || !snap.exists()) {
    document.getElementById('lista-diario').innerHTML = '<div class="empty">Nenhuma movimentação nesta data.</div>';
    document.getElementById('diario-totais').innerHTML = '';
    return;
  }

  const logs = [];
  snap.forEach(l => { const v = l.val(); if (v) logs.push({ ...v, _key: l.key }); });
  logs.sort((a, b) => b._key - a._key);

  let totE = 0, totS = 0;
  logs.forEach(v => {
    if (v.tipo === 'ENTRADA') totE += Number(v.qtd) || 0;
    else totS += Number(v.qtd) || 0;
  });

  document.getElementById('diario-totais').innerHTML = `
    <span class="badge b-green">+${totE} entradas</span>
    <span class="badge b-red">-${totS} saídas</span>
    <span class="badge b-gray">${logs.length} registros</span>`;

  document.getElementById('lista-diario').innerHTML = logs.map(v => `
    <div class="log-card">
      <div>
        <div class="log-hora">${v.hora || ''} · ${usuariosCache[v.usuario] || v.usuario || ''}</div>
        <div class="log-nome">${v.nome || '—'}</div>
        ${v.obs ? `<div class="log-obs">${v.obs}</div>` : ''}
      </div>
      <div class="log-qty" style="color:${v.tipo === 'ENTRADA' ? 'var(--green)' : 'var(--red)'}">
        ${v.tipo === 'ENTRADA' ? '+' : '-'}${v.qtd}
        <span style="font-size:11px;font-weight:400;color:var(--muted)">${v.unidade || ''}</span>
      </div>
    </div>`).join('');
}

// ── Exportar XLSX ─────────────────────────────
async function exportarDiarioXLSX() {
  const data = document.getElementById('data-diario').value;
  if (!data) { toast('Selecione uma data.', 'warn'); return; }

  const snap = await db.ref('padarias/' + currentPadariaId + '/logs/' + data).once('value');
  if (!snap.exists()) { toast('Sem dados nesta data.', 'warn'); return; }

  const rows = [['Hora','Tipo','Nome','Código','Qtd','Unidade','Finalidade','Usuário']];
  snap.forEach(l => {
    const v = l.val();
    if (v) rows.push([v.hora||'', v.tipo||'', v.nome||'', v.code||'', v.qtd||0, v.unidade||'', v.obs||'', v.usuario||'']);
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Diário');
  XLSX.writeFile(wb, 'diario_' + nomePadaria(currentPadariaId).replace(/\s/g,'_') + '_' + data + '.xlsx');
  toast('✅ XLSX exportado!');
}

// ── Backup completo ───────────────────────────
async function exportarBackupCompleto() {
  if (!podeAcessar('ADMIN')) { toast('Acesso negado.', 'err'); return; }
  toast('Gerando backup...', 'warn');

  const snap = await db.ref('padarias/' + currentPadariaId + '/logs').once('value');
  if (!snap.exists()) { toast('Sem logs.', 'warn'); return; }

  const wb    = XLSX.utils.book_new();
  const datas = Object.keys(snap.val() || {}).sort();

  datas.forEach(dt => {
    const rows = [['Hora','Tipo','Nome','Código','Qtd','Unidade','Finalidade','Usuário']];
    snap.child(dt).forEach(l => {
      const v = l.val();
      if (v) rows.push([v.hora||'', v.tipo||'', v.nome||'', v.code||'', v.qtd||0, v.unidade||'', v.obs||'', v.usuario||'']);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), dt.replace(/-/g,''));
  });

  XLSX.writeFile(wb, 'backup_' + nomePadaria(currentPadariaId).replace(/\s/g,'_') + '_' + dataLocal() + '.xlsx');
  toast('✅ Backup gerado — ' + datas.length + ' dias!');
}
