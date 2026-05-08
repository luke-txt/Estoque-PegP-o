// ══════════════════════════════════════════════
// diario.js
// ══════════════════════════════════════════════
async function renderDiario(){
  const data=document.getElementById('data-diario').value;if(!data)return;
  document.getElementById('lista-diario').innerHTML='<div class="empty-state">Carregando...</div>';
  const snap=await db.ref('padarias/'+currentPadariaId+'/logs/'+data).once('value').catch(()=>null);
  if(!snap||!snap.exists()){document.getElementById('lista-diario').innerHTML='<div class="empty-state">Nenhuma movimentação nesta data.</div>';document.getElementById('diario-totais').innerHTML='';return;}
  const logs=[];snap.forEach(l=>{const v=l.val();if(v)logs.push({...v,_key:l.key});});logs.sort((a,b)=>b._key-a._key);
  let totE=0,totS=0;logs.forEach(v=>{if(v.tipo==='ENTRADA')totE+=Number(v.qtd)||0;else totS+=Number(v.qtd)||0;});
  document.getElementById('diario-totais').innerHTML=`<span class="badge b-green">+${totE} entradas</span><span class="badge b-red">-${totS} saídas</span><span class="badge b-gray">${logs.length} registros</span>`;
  document.getElementById('lista-diario').innerHTML=logs.map(v=>`<div class="log-card"><div><div class="log-hora">${v.hora||''} · ${usuariosCache[v.usuario]||v.usuario||''}</div><div class="log-nome">${v.nome||'—'}</div>${v.obs?`<div class="log-obs">${v.obs}</div>`:''}</div><div class="log-qty" style="color:${v.tipo==='ENTRADA'?'var(--green)':'var(--red)'}">${v.tipo==='ENTRADA'?'+':'-'}${v.qtd} <span style="font-size:10px;font-weight:400;color:var(--muted)">${v.unidade||''}</span></div></div>`).join('');
}
async function exportarDiarioXLSX(){
  const data=document.getElementById('data-diario').value;if(!data){toast('Selecione uma data.','warn');return;}
  const snap=await db.ref('padarias/'+currentPadariaId+'/logs/'+data).once('value');if(!snap.exists()){toast('Sem dados nesta data.','warn');return;}
  const rows=[['Hora','Tipo','Nome','Código','Qtd','Unidade','Finalidade','Usuário']];snap.forEach(l=>{const v=l.val();if(v)rows.push([v.hora||'',v.tipo||'',v.nome||'',v.code||'',v.qtd||0,v.unidade||'',v.obs||'',v.usuario||'']);});
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'Diário');XLSX.writeFile(wb,'diario_'+nomePadaria(currentPadariaId).replace(/\s/g,'_')+'_'+data+'.xlsx');toast('✅ XLSX exportado!');
}
async function exportarBackupCompleto(){
  if(!podeAcessar('ADMIN')){toast('Acesso negado.','err');return;}
  toast('Gerando backup...','warn');
  const snap=await db.ref('padarias/'+currentPadariaId+'/logs').once('value');if(!snap.exists()){toast('Sem logs.','warn');return;}
  const wb=XLSX.utils.book_new();const datas=Object.keys(snap.val()||{}).sort();
  datas.forEach(dt=>{const rows=[['Hora','Tipo','Nome','Código','Qtd','Unidade','Finalidade','Usuário']];snap.child(dt).forEach(l=>{const v=l.val();if(v)rows.push([v.hora||'',v.tipo||'',v.nome||'',v.code||'',v.qtd||0,v.unidade||'',v.obs||'',v.usuario||'']);});XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),dt.replace(/-/g,''));});
  XLSX.writeFile(wb,'backup_'+nomePadaria(currentPadariaId).replace(/\s/g,'_')+'_'+dataLocal()+'.xlsx');toast('✅ Backup gerado — '+datas.length+' dias!');
}

// ══════════════════════════════════════════════
// relatorio.js
// ══════════════════════════════════════════════
function renderDashboard(){
  const padaria=PADARIAS.find(p=>p.id===currentPadariaId);
  const h=new Date().getHours();
  document.getElementById('dash-greeting-sub').textContent=saudacao();
  document.getElementById('dash-greeting-main').innerHTML=`${saudacao()},<br><em>${currentUser.nome}!</em>`;
  document.getElementById('dash-padaria-label').textContent=(padaria?padaria.nome+' · ':'')+currentUser.nome;
  const itens=Object.values(cache);
  const vencidos=itens.filter(i=>{const d=diasVencer(i.validade);return d!==null&&d<=0;});
  const vencendo=itens.filter(i=>{const d=diasVencer(i.validade);return d!==null&&d>0&&d<=7;});
  const baixos=itens.filter(i=>i.minimo>0&&i.saldo<i.minimo);
  const alertDiv=document.getElementById('dash-alert');
  if(vencidos.length||vencendo.length){
    alertDiv.style.display='flex';
    document.getElementById('dash-alert-txt').textContent=`🚨 ${vencidos.length+vencendo.length} item(s) vencendo em 7 dias`;
    document.getElementById('dash-alert-sub').textContent=[...vencidos.map(i=>i.nome),...vencendo.map(i=>i.nome)].slice(0,3).join(' · ');
  }else alertDiv.style.display='none';
  document.getElementById('dash-metrics').innerHTML=`
    <div class="metric-box" style="--metric-color:var(--gold)" onclick="switchTab('estoque')"><div class="metric-label">Produtos</div><div class="metric-value gold">${itens.length}</div><div class="metric-sub">no estoque</div></div>
    <div class="metric-box" style="--metric-color:var(--green)" onclick="switchTab('estoque')"><div class="metric-label">Unidades</div><div class="metric-value green">${itens.reduce((s,i)=>s+(i.saldo||0),0)}</div><div class="metric-sub">em estoque</div></div>
    <div class="metric-box" style="--metric-color:var(--red)" onclick="switchTab('estoque')"><div class="metric-label">Vencendo</div><div class="metric-value ${vencidos.length+vencendo.length>0?'red':'green'}">${vencidos.length+vencendo.length}</div><div class="metric-sub">em 7 dias</div></div>
    <div class="metric-box" style="--metric-color:var(--amber)" onclick="switchTab('estoque')"><div class="metric-label">Abaixo mín.</div><div class="metric-value ${baixos.length>0?'amber':'green'}">${baixos.length}</div><div class="metric-sub">itens</div></div>`;
  db.ref('padarias/'+currentPadariaId+'/logs/'+dataLocal()).once('value').then(snap=>{
    const logs=[];if(snap.exists())snap.forEach(l=>{const v=l.val();if(v)logs.push(v);});logs.sort((a,b)=>b.ts-a.ts);
    document.getElementById('dash-recent').innerHTML=logs.slice(0,8).map(v=>`<div class="recent-item"><div><div class="recent-item-nome">${v.nome||'—'}</div><div class="recent-item-meta">${v.hora||''} · ${usuariosCache[v.usuario]||v.usuario||''}${v.obs?' · '+v.obs:''}</div></div><div class="recent-item-qty ${v.tipo==='ENTRADA'?'qty-in':'qty-out'}">${v.tipo==='ENTRADA'?'+':'-'}${v.qtd} ${v.unidade||''}</div></div>`).join('')||'<div class="empty-state">Nenhuma movimentação hoje.</div>';
  });
}

async function renderRelatorio(){
  const itens=Object.values(cache);const venc7=itens.filter(i=>{const d=diasVencer(i.validade);return d!==null&&d<=7;}).length;
  document.getElementById('rel-stats').innerHTML=`<div class="metric-box" style="--metric-color:var(--gold)"><div class="metric-label">Produtos</div><div class="metric-value gold">${itens.length}</div></div><div class="metric-box" style="--metric-color:var(--green)"><div class="metric-label">Unidades totais</div><div class="metric-value green">${itens.reduce((s,i)=>s+(i.saldo||0),0)}</div></div><div class="metric-box" style="--metric-color:var(--red)"><div class="metric-label">Vencendo</div><div class="metric-value${venc7>0?' red':''}">${venc7}</div></div><div class="metric-box" style="--metric-color:var(--amber)"><div class="metric-label">Categorias</div><div class="metric-value amber">${new Set(itens.map(i=>i.setor)).size}</div></div>`;
  const dias=relPeriod==='semana'?7:relPeriod==='mes'?30:365;const saidas={},entradas={};const proms=[];
  for(let i=0;i<dias;i++){const d=new Date();d.setDate(d.getDate()-i);proms.push(db.ref('padarias/'+currentPadariaId+'/logs/'+dataLocal(d)).once('value'));}
  const snaps=await Promise.all(proms);
  snaps.forEach(s=>s.forEach(l=>{const v=l.val();if(!v||!v.code)return;const key=v.code,nome=(cache[key]&&cache[key].nome)?cache[key].nome:(v.nome||key),unid=(cache[key]&&cache[key].unidade)?cache[key].unidade:(v.unidade||'un');
    if(v.tipo==='SAIDA'){if(!saidas[key])saidas[key]={nome,qtd:0,unidade:unid};saidas[key].qtd+=Number(v.qtd)||0;}
    else{if(!entradas[key])entradas[key]={nome,qtd:0,unidade:unid};entradas[key].qtd+=Number(v.qtd)||0;}
  }));
  function renderRankLocal(id,data,cor){const el=document.getElementById(id);const sorted=Object.values(data).sort((a,b)=>b.qtd-a.qtd).slice(0,10);if(!sorted.length){el.innerHTML='<div class="empty-state">Sem dados no período.</div>';return;}const max=sorted[0].qtd;el.innerHTML=sorted.map((item,i)=>`<div class="rank-item"><div class="rank-n">${i+1}</div><div class="rank-bar-wrap"><div class="rank-nome">${item.nome}</div><div class="rank-bar"><div class="rank-fill" style="width:${(item.qtd/max*100).toFixed(0)}%;background:${cor}"></div></div></div><div class="rank-qty" style="color:${cor}">${item.qtd} <span style="font-size:10px;color:var(--muted)">${item.unidade}</span></div></div>`).join('');}
  renderRankLocal('rank-saidas',saidas,'var(--red)');renderRankLocal('rank-entradas',entradas,'var(--green)');
}

// ══════════════════════════════════════════════
// usuarios.js
// ══════════════════════════════════════════════
let passwdTargetUid=null;

function renderUsuarios(){
  if(!podeAcessar('ADMIN'))return;
  document.getElementById('usuarios-page-sub').textContent='Usuários — '+nomePadaria(currentPadariaId);
  db.ref('config/usuarios').once('value').then(snap=>{
    const cont=document.getElementById('lista-usuarios');
    if(!snap.exists()){cont.innerHTML='<div class="empty-state">Nenhum usuário.</div>';return;}
    let html='';
    snap.forEach(u=>{
      const uid=u.key,ud=u.val(),ativo=ud.ativo!==false,isMe=currentUser&&uid===currentUser.uid;
      if(!podeAcessar('DONO')&&ud.padaria_id&&ud.padaria_id!==currentPadariaId&&!isMe)return;
      if(!podeAcessar('DONO')&&ud.nivel==='DONO')return;
      html+=`<div class="user-item"><div><div class="user-name">${ud.nome||ud.email||uid} ${isMe?'<span style="font-size:10px;color:var(--muted)">(você)</span>':''}</div><div class="user-level">${nivelLabel(ud.nivel||'OPERADOR')} <span style="font-size:11px;color:var(--muted)">${ud.email||''}</span> ${!ativo?'<span class="badge b-red" style="font-size:9px">INATIVO</span>':''}</div>${ud.padaria_id?`<div style="font-size:10px;color:var(--muted);margin-top:2px">${icoPadaria(ud.padaria_id)} ${nomePadaria(ud.padaria_id)}</div>`:''}</div><div class="user-actions">${!isMe?`<button class="btn-ghost-sm" onclick="toggleAtivoUsuario('${uid}',${ativo})">${ativo?'🚫':'✅'}</button>`:''}<button class="btn-ghost-sm" onclick="abrirTrocarSenha('${uid}','${ud.email||''}')">🔑</button>${!isMe?`<button class="btn-ghost-sm" style="color:var(--red)" onclick="confirmarApagarUsuario('${uid}','${ud.nome||ud.email||uid}')">🗑️</button>`:''}</div></div>`;
    });
    cont.innerHTML=html||'<div class="empty-state">Nenhum usuário desta padaria.</div>';
  });
}
function criarUsuario(){
  if(!podeAcessar('ADMIN')){toast('Acesso negado.','err');return;}
  const nome=document.getElementById('new-user-nome').value.trim();const email=document.getElementById('new-user-login').value.trim().toLowerCase();const pass=document.getElementById('new-user-pass').value;const nivel=document.getElementById('new-user-nivel').value;
  if(!nome){toast('Informe o nome.','err');return;}if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast('Email inválido.','err');return;}if(pass.length<6){toast('Senha mínimo 6 caracteres.','err');return;}
  _criarFirebaseUser(email,pass,{nome,email,nivel,ativo:true,padaria_id:currentPadariaId,criadoPor:currentUser?.email||'',criadoEm:Date.now()},()=>{['new-user-nome','new-user-login','new-user-pass'].forEach(id=>document.getElementById(id).value='');renderUsuarios();});
}
function _criarFirebaseUser(email,pass,perfil,onSuccess){
  const secApp=firebase.initializeApp(firebaseConfig,'sec_'+Date.now()),secAuth=secApp.auth();
  secAuth.createUserWithEmailAndPassword(email,pass).then(cred=>db.ref('config/usuarios/'+cred.user.uid).set(perfil).then(()=>secAuth.signOut().then(()=>secApp.delete())).then(()=>{toast('✅ Usuário criado: '+perfil.nome);onSuccess&&onSuccess();})).catch(err=>{secAuth.signOut().catch(()=>{});secApp.delete().catch(()=>{});toast(err.code==='auth/email-already-in-use'?'Email já cadastrado.':'Erro: '+err.message,'err');});
}
function toggleAtivoUsuario(uid,ativoAtual){
  if(!podeAcessar('ADMIN')){toast('Acesso negado.','err');return;}if(currentUser&&uid===currentUser.uid){toast('Não pode inativar a si mesmo.','err');return;}
  db.ref('config/usuarios/'+uid).update({ativo:!ativoAtual}).then(()=>{toast(ativoAtual?'🚫 Usuário inativado.':'✅ Usuário ativado.');renderUsuarios();renderUsuariosDono&&renderUsuariosDono();}).catch(err=>toast('Erro: '+err.code,'err'));
}
function confirmarApagarUsuario(uid,nome){
  if(!podeAcessar('ADMIN')){toast('Acesso negado.','err');return;}if(currentUser&&uid===currentUser.uid){toast('Não pode apagar a si mesmo.','err');return;}
  if(confirm('Remover usuário "'+nome+'"?')){db.ref('config/usuarios/'+uid).remove().then(()=>{toast('🗑️ Usuário removido: '+nome);renderUsuarios();renderUsuariosDono&&renderUsuariosDono();}).catch(err=>toast('Erro: '+err.code,'err'));}
}
function abrirTrocarSenha(uid,email){passwdTargetUid={uid,email};document.getElementById('passwd-user-label').textContent='Alterando senha de: '+email;document.getElementById('passwd-new').value='';document.getElementById('passwd-confirm').value='';document.getElementById('passwd-modal').classList.add('open');}
function salvarSenhaAdmin(){
  if(!passwdTargetUid)return;if(!podeAcessar('ADMIN')){toast('Acesso negado.','err');return;}
  const nova=document.getElementById('passwd-new').value,conf=document.getElementById('passwd-confirm').value;
  if(nova.length<6){toast('Mínimo 6 caracteres.','err');return;}if(nova!==conf){toast('Senhas não conferem.','err');return;}
  db.ref('config/usuarios/'+passwdTargetUid.uid).update({senha_reset_pendente:true,reset_solicitado_por:currentUser?.email||'',reset_ts:Date.now()}).then(()=>{toast('✅ Reset de senha solicitado.');document.getElementById('passwd-modal').classList.remove('open');}).catch(err=>toast('Erro: '+err.code,'err'));
}

// ══════════════════════════════════════════════
// main.js — Event listeners
// ══════════════════════════════════════════════
if(!darkMode) document.body.classList.add('light');

document.addEventListener('DOMContentLoaded',()=>{
  // Splash
  initSplash();

  // Login
  document.getElementById('btn-login').addEventListener('click',login);
  document.getElementById('inp-pass').addEventListener('keydown',e=>{if(e.key==='Enter')login();});
  document.getElementById('btn-forgot').addEventListener('click',()=>{const p=document.getElementById('reset-panel');p.style.display=p.style.display==='none'||!p.style.display?'block':'none';});

  // Dono
  document.getElementById('dono-logout-btn').addEventListener('click',()=>auth.signOut());
  document.querySelectorAll('.dono-tab[data-dono-tab]').forEach(el=>el.addEventListener('click',()=>switchDonoTab(el.dataset.donoTab)));
  document.getElementById('btn-criar-usuario-dono').addEventListener('click',criarUsuarioDono);
  document.getElementById('dono-new-user-nivel').addEventListener('change',()=>{const v=document.getElementById('dono-new-user-nivel').value;document.getElementById('dono-padaria-field').style.display=v==='DONO'?'none':'';});

  // App voltar/sair
  document.getElementById('btn-app-voltar').addEventListener('click',()=>{if(podeAcessar('DONO')){esconderApp();mostrarDono();}else auth.signOut();});

  // Nav bottom
  document.querySelectorAll('.nav-btn[data-tab], .nav-center-btn[data-tab]').forEach(el=>{
    el.addEventListener('click',()=>switchTab(el.dataset.tab));
  });
  document.getElementById('nav-mais-btn').addEventListener('click',abrirDrawer);

  // Drawer
  document.getElementById('drawer-bg').addEventListener('click',fecharDrawer);
  document.querySelectorAll('.drawer-item[data-tab]').forEach(el=>el.addEventListener('click',()=>switchTab(el.dataset.tab)));
  document.getElementById('drawer-logout').addEventListener('click',()=>{if(podeAcessar('DONO')){esconderApp();mostrarDono();}else auth.signOut();});

  // Operações
  document.getElementById('btn-entrada').addEventListener('click',processarEntrada);
  document.getElementById('btn-saida').addEventListener('click',processarSaida);
  document.getElementById('btn-nova-saida').addEventListener('click',fecharRecibo);

  // QR
  document.getElementById('qr-toggle-entrada').addEventListener('click',()=>toggleQR('entrada'));
  document.getElementById('qr-toggle-saida').addEventListener('click',()=>toggleQR('saida'));

  // Autocomplete
  const saiBusca=document.getElementById('sai-busca');
  saiBusca.addEventListener('input',onSaiBuscaInput);
  saiBusca.addEventListener('keydown',onSaiBuscaKeydown);
  saiBusca.addEventListener('blur',()=>setTimeout(()=>document.getElementById('ac-list').style.display='none',180));

  // Estoque
  document.getElementById('filtro-estoque').addEventListener('input',renderEstoque);
  document.getElementById('btn-export-csv').addEventListener('click',exportarEstoqueCSV);
  document.querySelectorAll('.tab-pill[data-estoque-tab]').forEach(btn=>{
    btn.addEventListener('click',()=>{document.querySelectorAll('.tab-pill').forEach(b=>b.classList.remove('active'));btn.classList.add('active');switchEstoqueTab(btn.dataset.estoqueTab);});
  });
  document.addEventListener('click',e=>{const btn=e.target.closest('[data-edit-code]');if(btn)abrirEditar(btn.dataset.editCode);});

  // Diário
  document.getElementById('data-diario').addEventListener('change',renderDiario);
  document.getElementById('btn-export-diario').addEventListener('click',exportarDiarioXLSX);
  document.getElementById('btn-export-completo').addEventListener('click',exportarBackupCompleto);

  // Relatório
  document.querySelectorAll('.pt[data-period]').forEach(btn=>{
    btn.addEventListener('click',()=>{relPeriod=btn.dataset.period;document.querySelectorAll('.pt').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderRelatorio();});
  });

  // Modais
  document.getElementById('btn-modal-close').addEventListener('click',fecharModal);
  document.getElementById('btn-modal-cancel').addEventListener('click',fecharModal);
  document.getElementById('btn-modal-save').addEventListener('click',salvarEdicao);
  document.getElementById('edit-modal').addEventListener('click',e=>{if(e.target===document.getElementById('edit-modal'))fecharModal();});
  document.getElementById('btn-ver-historico').addEventListener('click',()=>{if(editCode)abrirHistorico(editCode);});
  document.getElementById('btn-confirm-close').addEventListener('click',fecharConfirm);
  document.getElementById('btn-confirm-cancel').addEventListener('click',fecharConfirm);
  document.getElementById('btn-confirm-ok').addEventListener('click',()=>{const fn=confirmCallback;fecharConfirm();if(fn)fn();});
  document.getElementById('confirm-modal').addEventListener('click',e=>{if(e.target===document.getElementById('confirm-modal'))fecharConfirm();});
  document.getElementById('btn-hist-close').addEventListener('click',()=>document.getElementById('hist-modal').classList.remove('open'));
  document.getElementById('hist-modal').addEventListener('click',e=>{if(e.target===document.getElementById('hist-modal'))document.getElementById('hist-modal').classList.remove('open');});
  document.getElementById('btn-passwd-close').addEventListener('click',()=>document.getElementById('passwd-modal').classList.remove('open'));
  document.getElementById('passwd-modal').addEventListener('click',e=>{if(e.target===document.getElementById('passwd-modal'))document.getElementById('passwd-modal').classList.remove('open');});
  document.getElementById('btn-passwd-save').addEventListener('click',salvarSenhaAdmin);

  // Usuários
  document.getElementById('btn-criar-usuario').addEventListener('click',criarUsuario);

  // Tema
  const tb=document.getElementById('theme-btn');
  tb.addEventListener('click',()=>{darkMode=!darkMode;document.body.classList.toggle('light',!darkMode);tb.textContent=darkMode?'🌙':'☀️';localStorage.setItem('tema',darkMode?'dark':'light');});

  // Inatividade 8h
  let inactivityTimer;
  function resetTimer(){clearTimeout(inactivityTimer);inactivityTimer=setTimeout(()=>{toast('Sessão encerrada por inatividade.','warn');setTimeout(()=>auth.signOut(),2000);},8*60*60*1000);}
  ['click','keydown','touchstart'].forEach(e=>document.addEventListener(e,resetTimer,{passive:true}));resetTimer();
});
