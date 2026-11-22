import { esc } from './board.js';

export function renderCosmeticStore(catalog, {loading=false,filter='ALL'}={}) {
  const items=(catalog?.items||[]).filter(item=>filter==='ALL'||item.category===filter);
  const credits=catalog ? String(catalog.credits) : '—';
  const categoryOptions=[
    ['ALL','Todos'],['SKIN','Embarcações'],['SOUND','Sons'],['CAPTAIN','Capitães'],['BUNDLE','Coleções']
  ].map(([id,label])=>`<option value="${id}" ${filter===id?'selected':''}>${label}</option>`).join('');
  const cards=items.map(item=>{
    // CAPTAIN/BUNDLE are catalog previews only until the API grants them safely.
    const owned=Boolean(item.owned),equipped=Boolean(item.equipped);
    const available=Boolean(item.enabled)&&['SKIN','SOUND'].includes(item.category);
    const cls=['tp-store-card',item.category==='SOUND'?'is-sound':item.category==='CAPTAIN'?'is-captain':item.category==='BUNDLE'?'is-bundle':'is-skin',
      item.id==='skin_coral'?'is-coral':'',item.id==='skin_abyss'?'is-abyss':''].filter(Boolean).join(' ');
    const appearance={SKIN:['⚓','Frota'],SOUND:['♫','Som'],CAPTAIN:['♟','Capitão'],BUNDLE:['✦','Coleção']};
    const [icon,type]=appearance[item.category]||['◈','Cosmético'];
    const description=esc(item.description);
    const tags=equipped?'<span class="tp-store-tag is-equipped">Equipado</span>':
      owned?'<span class="tp-store-tag">No inventário</span>':
      !available?'<span class="tp-store-tag is-future">Em breve</span>':
      '<span class="tp-store-tag">Disponível</span>';
    const unavailableReason=item.category==='BUNDLE'?'Coleção em preparação':
      item.category==='CAPTAIN'?'Capitão em preparação':'Aguardando recursos do Game Design';
    const action=!available?`<span class="tp-store-unavailable">${unavailableReason}</span>`:
      equipped?'<button class="btn btn-ghost" type="button" disabled>Em uso</button>':
      owned?`<button class="btn btn-primary" type="button" data-action="store-equip" data-item-id="${esc(item.id)}">Equipar</button>`:
      `<button class="btn btn-orange" type="button" data-action="store-buy" data-item-id="${esc(item.id)}" ${loading?'disabled':''}>Comprar · ${item.price} créditos</button>`;
    return `<article class="${cls}">
      <div class="tp-store-preview" aria-hidden="true"><span>${icon}</span><small>Prévia beta</small><i></i></div>
      <div class="tp-store-card-text"><div class="tp-store-card-meta"><span>${type}</span>${tags}</div>
      <h3>${esc(item.name)}</h3><p>${description}</p></div>
      <div class="tp-store-card-footer"><span class="tp-store-price">${available?(item.price===0?'Grátis':item.price+' créditos'):'Indisponível'}</span>${action}</div>
    </article>`;
  }).join('');
  return `<section class="bn-page bn-store-page tp-store-page" aria-label="Loja de cosméticos">
    <header class="bn-page-heading tp-store-header">
      <div><h1>Loja</h1><p>Personalize sua frota com itens cosméticos.</p></div>
      <div class="tp-store-wallet"><small>Créditos de teste</small><strong>${esc(credits)}</strong></div>
    </header>
    <div class="tp-store-toolbar"><label for="store-filter">Categorias</label>
      <select class="tp-mode-select" id="store-filter">${categoryOptions}</select>
      <span class="tp-store-beta">Economia beta · sem dinheiro real</span>
    </div>
    <div class="tp-store-grid" aria-live="polite">
      ${loading&&!catalog?'<p class="tp-store-loading">Carregando catálogo...</p>':
        !catalog?'<p class="tp-store-loading">A loja não está disponível no momento.</p>':
        cards||'<p class="tp-store-loading">Nenhum item nesta categoria.</p>'}
    </div>
    <footer class="tp-store-footnote">Os itens em preparação não estão à venda. Capitães e coleções aguardam integração; sons e frotas extras só serão liberados com recursos homologados pelo Game Design.</footer>
  </section>`;
}
