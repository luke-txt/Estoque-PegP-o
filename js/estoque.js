// ══════════════════════════════════════════════
// estoque.js
// ══════════════════════════════════════════════
let estoqueTabAtual = 'lista', editCode = null;

function switchEstoqueTab(tab) {
  estoqueTabAtual = tab;
  ['lista','vencimentos','minimo','codigos'].forEach(t =>
    document.getElementById('tab-' + t).style.display = t === tab ? '' : 'none');
  renderEstoque();
}

function renderEstoque() {
  if (!document.getElementById('page-estoque').classList.contains('active')) return;
  const filtro = document.getElementById('filtro-estoque').value.trim().toLowerCase();
  const itens  = Object.entries(cache)
    .filter(([c,i]) => !filtro || (i.nome||'').toLowerCase().includes(filtro) || c.toLowerCase().includes(filtro))
    .sort((a,b) => (a[1].nome||'').localeCompare(b[1].nome||''));
  const somaBar = document.getElementById('soma-bar');
  if (filtro && itens.length) {
    document.getElementById('soma-val').textContent = itens.reduce((s,[,i])=>s+(i.saldo||0),0);
    document.getElementById('soma-sub').textContent = itens.length + ' produto' + (itens.length!==1?'s':'');
    somaBar.style.display = 'flex';
  } else somaBar.style.display = 'none';
  if (estoqueTabAtual==='lista')        renderLista(itens);
  else if (estoqueTabAtual==='vencimentos') renderVencimentos(itens);
  else if (estoqueTabAtual==='minimo')  renderMinimo(itens);
  else renderCodigos(itens);
}

function renderLista(itens) {
  const container = document.getElementById('estoque-categorias');
  container.innerHTML = '';
  const grupos = {};
  itens.forEach(([code,item]) => {
    const cat = item.setor||'SECOS';
    if (!grupos[cat]) grupos[cat] = [];
    grupos[cat].push([code,item]);
  });
  if (!Object.keys(grupos).length) { container.innerHTML = '<div class="empty-state" style="padding:40px">Estoque vazio</div>'; return; }
  Object.entries(grupos).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([cat,items]) => {
    const catInfo = CATEGORIAS[cat] || {label:cat,ico:'📦',cls:'cat-secos'};
    container.innerHTML += `<div class="cat-label">${catInfo.ico} ${catInfo.label}</div>` +
      items.map(([code,item]) => {
        const dias  = diasVencer(item.validade);
        const vc    = dias!==null&&dias<=7?'venc':dias!==null&&dias<=30?'venc-soon':'';
        const baixo = item.minimo>0&&item.saldo<item.minimo;
        const cor   = item.saldo>0?'var(--green)':'var(--red)';
        return `<div class="produto-item">
          <div class="produto-cat-dot ${catInfo.cls||'cat-secos'}">${catInfo.ico}</div>
          <div class="produto-info">
            <div class="produto-nome">${item.nome} ${baixo?'<span class="badge b-yellow" style="font-size:9px;padding:2px 6px">BAIXO</span>':''}</div>
            <div class="produto-meta"><span>${code}</span>${item.validade?`<span class="${vc}">${item.validade}</span>`:''}
            </div>
          </div>
          <div class="produto-saldo" style="color:${cor}">${item.saldo} <span style="font-size:10px;color:var(--muted)">${item.unidade||'un'}</span></div>
          <button class="btn-edit" data-edit-code="${code}">✏️</button>
        </div>`;
      }).join('');
  });
}

function renderVencimentos(itens) {
  const crit=document.getElementById('tbody-venc-crit'),aviso=document.getElementById('tbody-venc-aviso');
  crit.innerHTML='';aviso.innerHTML='';
  itens.forEach(([,item]) => {
    if (!item.validade) return;
    const dias=diasVencer(item.validade); if(dias===null||dias>30) return;
    const row=`<tr><td><b>${item.nome}</b></td><td class="${dias<=7?'venc':'venc-soon'}">${item.validade} (${dias<=0?'VENCIDO':dias+'d'})</td><td>${item.saldo} ${item.unidade||'un'}</td></tr>`;
    (dias<=7?crit:aviso).innerHTML+=row;
  });
  if(!crit.innerHTML)  crit.innerHTML ='<tr><td colspan="3" class="empty-state">✅ Nenhum crítico</td></tr>';
  if(!aviso.innerHTML) aviso.innerHTML='<tr><td colspan="3" class="empty-state">✅ Nenhum aviso</td></tr>';
}

function renderMinimo(itens) {
  const tbody=document.getElementById('tbody-minimo'); tbody.innerHTML='';
  const com=itens.filter(([,i])=>i.minimo>0).sort((a,b)=>a[1].saldo/a[1].minimo-b[1].saldo/b[1].minimo);
  if(!com.length){tbody.innerHTML='<tr><td colspan="4" class="empty-state">Nenhum produto com mínimo definido.</td></tr>';return;}
  com.forEach(([,item])=>{
    const ok=item.saldo>=item.minimo,pct=Math.min((item.saldo/item.minimo*100),100).toFixed(0);
    tbody.innerHTML+=`<tr><td><b>${item.nome}</b></td>
      <td><span class="badge ${ok?'b-green':'b-red'}">${item.saldo} ${item.unidade||'un'}</span></td>
      <td style="font-family:var(--ff-mono);font-size:12px;color:var(--muted)">${item.minimo}</td>
      <td><div style="background:var(--surface3);border-radius:4px;height:5px;width:50px;display:inline-block;overflow:hidden"><div style="height:100%;width:${pct}%;background:${ok?'var(--green)':'var(--red)'};border-radius:4px"></div></div></td>
    </tr>`;
  });
}

function renderCodigos(itens) {
  const grid=document.getElementById('bc-grid');
  if(!itens.length){grid.innerHTML='<div class="empty-state">Nenhum produto</div>';return;}
  grid.innerHTML=itens.map(([code,item])=>`<div class="bc-card"><div class="bc-nome">${item.nome}</div><div class="bc-code">${code}</div>${barcodeVisual(code)}<div class="bc-saldo">Saldo: <b>${item.saldo} ${item.unidade||'un'}</b></div></div>`).join('');
}

function abrirEditar(code) {
  if(!podeAcessar('GERENTE')){toast('Sem permissão.','err');return;}
  const item=cache[code]; if(!item){toast('Item não encontrado.','err');return;}
  editCode=code;
  document.getElementById('edit-code-label').textContent='Código: '+code;
  document.getElementById('edit-nome').value   =item.nome||'';
  document.getElementById('edit-val').value    =item.validade||'';
  document.getElementById('edit-setor').value  =item.setor||'SECOS';
  document.getElementById('edit-unidade').value=item.unidade||'un';
  document.getElementById('edit-saldo').value  =item.saldo||0;
  document.getElementById('edit-minimo').value =item.minimo||0;
  document.getElementById('edit-modal').classList.add('open');
}
function fecharModal(){document.getElementById('edit-modal').classList.remove('open');editCode=null;}
function salvarEdicao(){
  if(!editCode)return;
  if(!podeAcessar('GERENTE')){toast('Sem permissão.','err');return;}
  const nome=document.getElementById('edit-nome').value.trim();
  if(!nome){toast('Informe o nome.','err');return;}
  db.ref('padarias/'+currentPadariaId+'/estoque/'+editCode).update({
    nome, validade:document.getElementById('edit-val').value,
    setor:document.getElementById('edit-setor').value,
    unidade:document.getElementById('edit-unidade').value,
    saldo:parseFloat(document.getElementById('edit-saldo').value)||0,
    minimo:parseFloat(document.getElementById('edit-minimo').value)||0
  }).then(()=>{toast('✅ Produto atualizado!');fecharModal();}).catch(err=>toast('Erro: '+err.code,'err'));
}

async function abrirHistorico(code) {
  document.getElementById('hist-title').textContent='📜 '+(cache[code]?.nome||code);
  document.getElementById('hist-list').innerHTML='<div class="empty-state">Carregando...</div>';
  document.getElementById('hist-modal').classList.add('open');
  const hoje=new Date(),proms=[];
  for(let i=0;i<30;i++){const d=new Date(hoje);d.setDate(d.getDate()-i);proms.push(db.ref('padarias/'+currentPadariaId+'/logs/'+dataLocal(d)).once('value'));}
  const snaps=await Promise.all(proms);
  const logs=[];
  snaps.forEach(s=>s.forEach(l=>{const v=l.val();if(v&&v.code===code)logs.push(v);}));
  logs.sort((a,b)=>(b.ts||0)-(a.ts||0));
  if(!logs.length){document.getElementById('hist-list').innerHTML='<div class="empty-state">Sem histórico nos últimos 30 dias.</div>';return;}
  document.getElementById('hist-list').innerHTML=logs.slice(0,40).map(v=>`
    <div class="hist-item">
      <div><div class="hist-qty" style="color:${v.tipo==='ENTRADA'?'var(--green)':'var(--red)'}">${v.tipo==='ENTRADA'?'+':'-'}${v.qtd} ${v.unidade||''}</div><div class="hist-nome">${v.obs||v.tipo}</div></div>
      <div class="hist-meta">${v.hora||''}<br>${usuariosCache[v.usuario]||v.usuario||''}</div>
    </div>`).join('');
}

function exportarEstoqueCSV(){
  const itens=Object.entries(cache);
  if(!itens.length){toast('Estoque vazio.','warn');return;}
  const linhas=[['Código','Nome','Categoria','Quantidade','Unidade','Mínimo','Validade'],...itens.map(([c,i])=>[c,i.nome,i.setor,i.saldo,i.unidade,i.minimo,i.validade||''])];
  const csv=linhas.map(l=>l.map(v=>'"'+String(v||'').replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download='estoque_'+nomePadaria(currentPadariaId).replace(/\s/g,'_')+'_'+dataLocal()+'.csv';
  a.click();URL.revokeObjectURL(url);toast('✅ CSV exportado!');
}
