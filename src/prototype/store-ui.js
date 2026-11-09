import { esc } from './board.js';

export function renderCosmeticStore(catalog, {loading=false,filter='ALL'}={}) {
  const items=(catalog?.items||[]).filter(item=>filter==='ALL'||item.category===filter);
  const credits=catalog ? String(catalog.credits) : '—';
  const categoryOptions=[
    ['ALL','Todos os itens'],['SKIN','Skins de frota'],['SOUND','Pacotes de sons']
  ].map(([id,label])=>`<option value="${id}" ${filter===id?'selected':''}>${label}</option>`).join('');
  const cards=items.map(item=>{
    const owned=Boolean(item.owned),equipped=Boolean(item.equipped),available=Boolean(item.enabled);
    const cls=['tp-store-card',item.category==='SOUND'?'is-sound':'is-skin',
      item.id==='skin_coral'?'is-coral':'',item.id==='skin_abyss'?'is-abyss':''].filter(Boolean).join(' ');
    const icon=item.category==='SOUND'?'♫':'⚓';
    const type=item.category==='SOUND'?'Som':'Skin';
    const description=esc(item.description);
    const tags=equipped?'<span class="tp-store-tag is-equipped">Equipado</span>':
      owned?'<span class="tp-store-tag">No inventário</span>':
      !available?'<span class="tp-store-tag is-future">Em breve</span>':
      '<span class="tp-store-tag">Disponível</span>';
    const action=!available?'<span class="tp-store-unavailable">Aguardando recursos do Game Design</span>':
      equipped?'<button class="btn btn-ghost" type="button" disabled>Em uso</button>':
      owned?`<button class="btn btn-primary" type="button" data-action="store-equip" data-item-id="${esc(item.id)}">Equipar</button>`:
      `<button class="btn btn-orange" type="button" data-action="store-buy" data-item-id="${esc(item.id)}" ${loading?'disabled':''}>Adquirir · ${item.price} créditos</button>`;
    return `<article class="${cls}">
      <div class="tp-store-preview" aria-hidden="true"><span>${icon}</span><i></i></div>
      <div class="tp-store-card-text"><div class="tp-store-card-meta"><span>${type}</span>${tags}</div>
      <h3>${esc(item.name)}</h3><p>${description}</p></div>
      <div class="tp-store-card-footer"><span class="tp-store-price">${available?(item.price===0?'Grátis':item.price+' créditos'):'Indisponível'}</span>${action}</div>
    </article>`;
  }).join('');
  return `<section class="tp-store-page" aria-label="Loja de cosméticos">
    <header class="tp-store-header">
      <div><span class="eyebrow">Arsenal TidePoint</span><h1>Loja e coleções</h1>
      <p>Personalize sua frota. Nenhum item altera o combate.</p></div>
      <div class="tp-store-wallet"><small>Saldo de teste</small><strong>${esc(credits)} <span>créditos</span></strong></div>
    </header>
    <div class="tp-store-toolbar"><label for="store-filter">Filtrar por categoria</label>
      <select class="tp-mode-select" id="store-filter">${categoryOptions}</select>
      <span class="tp-store-beta">Economia experimental · sem dinheiro real</span>
    </div>
    <div class="tp-store-grid" aria-live="polite">
      ${loading&&!catalog?'<p class="tp-store-loading">Carregando catálogo...</p>':
        !catalog?'<p class="tp-store-loading">A loja não está disponível no momento.</p>':
        cards||'<p class="tp-store-loading">Nenhum item nesta categoria.</p>'}
    </div>
    <footer class="tp-store-footnote">Os pacotes de som pagos serão liberados quando os áudios estiverem prontos. Skins compradas são exibidas no seu tabuleiro.</footer>
  </section>`;
}
