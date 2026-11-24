import {esc} from './board.js';

/**
 * Administrative presentation within the main game's SPA.
 * Actions use the same authenticated client session/rotating refresh token.
 * This is visibility-only; /api/admin/* enforces is_admin against the database.
 */
const STORE_CATEGORIES=[['SKIN','Frotas'],['CAPTAIN','Capitães'],['SOUND','Sons'],['BUNDLE','Coleções'],['TAUNT','Provocações'],['ATTACK','Efeitos de ataque'],['CELEBRATION','Comemorações'],['FUNERAL','Funerais'],['TITLE','Títulos'],['COMMENTATOR','Comentaristas'],['FRAME','Molduras'],['BOARD_THEME','Temas de tabuleiro']];
function renderStoreAdmin(items,loading,error){
  const products=items||[];
  const groups=STORE_CATEGORIES.map(([category,label])=>{
    const rows=products.filter(item=>item.category===category);
    if(!rows.length)return '';
    return `<section class="bn-admin-product-group"><h3>${label} <small>${rows.length}</small></h3>${rows.map(item=>{
      const status=!item.released?'Não homologado':!item.manageable?'Padrão gratuito':!item.enabled?'Fora de venda':!item.availableForPurchase?'Componente indisponível':'À venda';
      const price=item.price===0?'Grátis':item.premiumOnly?item.price+' Naval':item.price+' Marinha';
      return `<article class="bn-admin-mode bn-admin-product" data-admin-product="${esc(item.id)}">
        <div class="bn-admin-mode-details"><h2>${esc(item.name)}</h2><p>${esc(price)} · ${status}</p><small>${item.updatedAt?'Atualizado em '+esc(new Date(item.updatedAt).toLocaleString('pt-BR')):esc(item.id)}</small></div>
        <button type="button" data-action="admin-toggle-product" data-item-id="${esc(item.id)}"
          class="bn-admin-toggle ${item.enabled?'is-enabled':'is-disabled'}" aria-pressed="${Boolean(item.enabled)}"
          aria-label="${item.enabled?'Desativar venda de':'Ativar venda de'} ${esc(item.name)}"
          ${loading||!item.manageable?'disabled':''}>${!item.manageable?'Protegido':item.enabled?'Desativar':'Ativar'}</button>
      </article>`;
    }).join('')}</section>`;
  }).join('');
  return `<section class="bn-admin-surface" aria-label="Gerenciar loja">
    <div class="bn-admin-section-header"><h2>Itens da loja</h2><button type="button" class="bn-admin-refresh" data-action="admin-refresh" ${loading?'disabled':''}>Atualizar</button></div>
    <p>Controle apenas novas compras. Itens já adquiridos continuam no inventário e podem ser equipados.</p>
    <p class="bn-admin-feedback" role="status" aria-live="polite">${error?esc(error):loading?'Carregando produtos...':products.length?products.filter(i=>i.availableForPurchase&&i.manageable).length+' produtos à venda · '+products.filter(i=>i.manageable&&!i.availableForPurchase).length+' fora de venda':''}</p>
    <div class="bn-admin-list">${groups||(!loading?'<p>Nenhum produto disponível.</p>':'')}</div>
  </section>`;
}
export function renderAdminPanel({modes,loading=false,error='',tab='modes',products=null,storeLoading=false,storeError=''}={}) {
  const items=(modes||[]).map(entry=>{
    const mode=entry.mode||{};
    return `<article class="bn-admin-mode">
      <div class="bn-admin-mode-details">
        <h2>${esc(mode.name||mode.id||'Modo')}</h2>
        <p>${esc(mode.geometry?.kind||'Tabuleiro')} · ${mode.geometry?.cells?.length||0} casas · ${mode.fleet?.length||0} navios</p>
        <small>${entry.updatedAt?'Atualizado em '+esc(new Date(entry.updatedAt).toLocaleString('pt-BR')):'Sem alterações anteriores'}</small>
      </div>
      <button type="button" data-action="admin-toggle-mode" data-item-id="${esc(mode.id||'')}"
        class="bn-admin-toggle ${entry.enabled?'is-enabled':'is-disabled'}"
        aria-label="${entry.enabled?'Desabilitar':'Habilitar'} ${esc(mode.name||mode.id)}"
        ${loading?'disabled':''}>${entry.enabled?'Habilitado':'Desabilitado'}</button>
    </article>`;
  }).join('');
  return `<div class="bn-page bn-admin-page">
    <header class="bn-page-heading">
      <span class="bn-admin-eyebrow">CONTROLE DE JOGO</span>
      <h1>Área administrativa</h1>
      <p>Gerencie os modos de jogo e os produtos disponíveis na loja.</p>
    </header>
    <nav class="bn-admin-tabs" aria-label="Seções administrativas">
      <button type="button" data-action="admin-tab" data-item-id="modes" aria-pressed="${tab==='modes'}">Tabuleiros</button>
      <button type="button" data-action="admin-tab" data-item-id="store" aria-pressed="${tab==='store'}">Loja</button>
    </nav>
    ${tab==='store'?renderStoreAdmin(products,storeLoading,storeError):`<section class="bn-admin-surface" aria-label="Gerenciar modos de jogo">
      <div class="bn-admin-section-header">
        <h2>Tabuleiros</h2>
        <button type="button" class="bn-admin-refresh" data-action="admin-refresh" ${loading?'disabled':''}>Atualizar</button>
      </div>
      <p>Disponibilidade para novas partidas. As batalhas existentes não são interrompidas.</p>
      <p class="bn-admin-feedback" role="status" aria-live="polite">${error?esc(error):loading?'Carregando modos...':''}</p>
      <div class="bn-admin-list">${items||(!loading?'<p>Nenhum modo administrativo disponível.</p>':'')}</div>
    </section>`}
    <button type="button" class="bn-admin-return" data-go="lobby">← Voltar ao jogo</button>
  </div>`;
}
