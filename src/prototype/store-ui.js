import { esc } from './board.js';
import {TAUNT_PACKS} from './chaos-humor.js';


// Original vector illustrations, built from fixed shapes; no external images,
// scripts, remote requests or claims that preview art is final ship artwork.
const coverThemes = {
  skin_default:['#071c36','#197da0','#8de3ff','FROTA ORIGINAL'],
  skin_coral:['#341827','#b75147','#ffc399','CORAL'],
  skin_abyss:['#17122e','#6946b8','#c6adff','ABISSAL'],
  skin_corsair:['#382515','#997344','#f6dc9a','CORSÁRIA'],
  skin_space:['#121538','#514bc4','#8dfaff','FUTURISTA'],
  skin_pirate:['#1c2423','#496d50','#c7e9a4','PIRATA'],
  skin_magnate:['#242019','#a87929','#ffe09a','MAGNATA'],
  sound_default:['#102d39','#327387','#b9f3fc','SONS PADRÃO'],
  sound_sonar:['#09291e','#21894f','#92ffba','SONAR RETRÔ'],
  sound_deep:['#09172b','#244b9b','#8bbcff','MAR PROFUNDO'],
  captain_default:['#12253b','#497a9d','#d6e8ff','CAPITÃO PADRÃO'],
  captain_corsair:['#382515','#977145','#ffe0a0','CAPITÃO CORSÁRIO'],
  captain_space:['#171638','#5d48c2','#a6eaff','CAPITÃO FUTURISTA'],
  bundle_corsair:['#302018','#b27b42','#ffe0a0','COLEÇÃO CORSÁRIA'],
  bundle_space:['#191434','#7151bc','#9ceaff','COLEÇÃO FUTURISTA'],
  taunt_default:['#14263c','#296b9e','#b4e8ff','PROVOCAÇÕES'],
  taunt_banter:['#382619','#b27135','#ffe0a3','TIO DO PAVÊ'],
  taunt_panic:['#3c1929','#bc3654','#ffc0c8','SURTO MARÍTIMO'],
  taunt_support:['#10352f','#258a79','#a6fce2','ATENDIMENTO NAVAL'],
  taunt_meme:['#301643','#994db4','#ffc1f8','ALMIRANTE DOS MEMES']
};
const genericTheme=['#14253a','#3b658a','#b5e6ff','COSMÉTICO'];
const ship='<path d="M-92 13 L-62 31 H53 L98 -10 H57 L45 -24 H10 V-43 H-24 V-26 H-49 L-56 -9 H-92Z" fill="#b8cdda" stroke="#e6f7ff" stroke-width="2"/><path d="M-83 17 H70 L53 31 H-62Z" fill="#233b55"/><path d="M-21 -42 V-63 M-21 -61 L10 -53 L-21 -49" fill="none" stroke="currentColor" stroke-width="3"/><path d="M-43 -8 H44 M-36 1 H65" stroke="#48647b" stroke-width="4"/><circle cx="24" cy="-17" r="4" fill="currentColor"/>';
const speech='<path d="M-77 -40 H40 Q62 -40 62 -18 V9 Q62 30 40 30 H-10 L-40 52 V30 H-77 Q-98 30 -98 9 V-18 Q-98 -40 -77 -40Z" fill="#ffffff" fill-opacity=".18" stroke="currentColor" stroke-width="3"/><path d="M5 -57 H75 Q95 -57 95 -37 V-17 Q95 3 75 3 H67" fill="none" stroke="currentColor" stroke-width="3"/><g fill="currentColor"><circle cx="-59" cy="-6" r="7"/><circle cx="-18" cy="-6" r="7"/><circle cx="23" cy="-6" r="7"/></g>';
const sonar='<g fill="none" stroke="currentColor" stroke-width="2"><circle r="60"/><circle r="42"/><circle r="24"/><path d="M-65 0 H65 M0 -65 V65 M0 0 L50 -37"/></g><path d="M0 0 L60 -10 A60 60 0 0 0 35 -49Z" fill="currentColor" opacity=".25"/><g fill="currentColor"><circle cx="36" cy="-26" r="5"/><circle cx="-25" cy="15" r="4"/><circle cx="10" cy="38" r="3"/></g>';
const captain='<path d="M-59 47 Q-58 10 -29 1 L29 1 Q58 10 59 47Z" fill="#b8cdda" stroke="currentColor" stroke-width="2"/><circle cy="-20" r="29" fill="#b8cdda"/><path d="M-36 -30 Q-40 -60 0 -61 Q40 -60 36 -30Z" fill="#23354e" stroke="currentColor" stroke-width="3"/><path d="M-39 -29 H39" stroke="currentColor" stroke-width="6"/><path d="M-16 7 L0 26 L16 7 M0 26 V45" fill="none" stroke="#38546b" stroke-width="4"/>';
export function renderProductCover(item){
  const [dark,mid,accent,label]=Object.hasOwn(coverThemes,item.id)?coverThemes[item.id]:genericTheme;
  const art=item.category==='SKIN'?ship:item.category==='SOUND'?sonar:item.category==='CAPTAIN'?captain:item.category==='BUNDLE'?'<g transform="translate(-48 8) scale(.65)">'+ship+'</g><g transform="translate(56 -4) scale(.7)">'+captain+'</g>':speech;
  return `<div class="tp-store-preview" aria-hidden="true" style="position:relative;overflow:hidden"><svg data-product-cover="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0;width:100%;height:100%;display:block">
  <rect width="320" height="180" fill="${dark}"/><circle cx="160" cy="65" r="113" fill="${mid}" opacity=".34"/><circle cx="160" cy="65" r="82" fill="${mid}" opacity=".45"/>
  <g stroke="${accent}" opacity=".16" fill="none"><circle cx="160" cy="65" r="100"/><circle cx="160" cy="65" r="72"/><path d="M0 20 H320 M0 55 H320 M0 90 H320 M0 125 H320 M40 0 V180 M100 0 V180 M220 0 V180 M280 0 V180"/></g>
  <g fill="${accent}" opacity=".6"><circle cx="29" cy="37" r="2"/><circle cx="282" cy="28" r="3"/><circle cx="253" cy="89" r="2"/><circle cx="66" cy="99" r="3"/></g>
  <g transform="translate(160 72)" color="${accent}">${art}</g>
  <path d="M0 132 H320 V180 H0Z" fill="${dark}" opacity=".92"/><path d="M26 132 H294" stroke="${accent}" opacity=".65"/>
  <text x="160" y="151" text-anchor="middle" font-size="10" font-weight="700" letter-spacing="2" fill="${accent}" font-family="system-ui,sans-serif">NAVIIWAR / COLEÇÃO</text>
  <text x="160" y="169" text-anchor="middle" font-size="13" font-weight="800" fill="#fff" font-family="system-ui,sans-serif">${label}</text>
  </svg></div>`;
}

export function renderCosmeticStore(catalog, {loading=false,filter='ALL'}={}) {
  const items=(catalog?.items||[]).filter(item=>filter==='ALL'||item.category===filter);
  const categoryOptions=[
    ['ALL','Todos'],['SKIN','Embarcações'],['SOUND','Sons'],['TAUNT','Provocações'],['CAPTAIN','Capitães'],['BUNDLE','Coleções']
  ].map(([id,label])=>`<option value="${id}" ${filter===id?'selected':''}>${label}</option>`).join('');
  const cards=items.map(item=>{
    // CAPTAIN/BUNDLE are catalog previews only until the API grants them safely.
    const owned=Boolean(item.owned),equipped=Boolean(item.equipped);
    const available=Boolean(item.enabled)&&['SKIN','SOUND','TAUNT'].includes(item.category);
    const cls=['tp-store-card',item.category==='SOUND'?'is-sound':item.category==='TAUNT'?'is-taunt':item.category==='CAPTAIN'?'is-captain':item.category==='BUNDLE'?'is-bundle':'is-skin',
      item.id==='skin_coral'?'is-coral':'',item.id==='skin_abyss'?'is-abyss':''].filter(Boolean).join(' ');
    const appearance={SKIN:['⚓','Frota'],SOUND:['♫','Som'],TAUNT:['💬','Provocação'],CAPTAIN:['♟','Capitão'],BUNDLE:['✦','Coleção']};
    const [icon,type]=appearance[item.category]||['◈','Cosmético'];
    const description=esc(item.description);
    const phrases=item.category==='TAUNT'&&Array.isArray(TAUNT_PACKS[item.id])
      ? TAUNT_PACKS[item.id].slice(0,2).map(p=>`<span class="bn-taunt-phrase">${esc(p)}</span>`).join('')
      : '';
    const tags=equipped?'<span class="tp-store-tag is-equipped">Equipado</span>':
      owned?'<span class="tp-store-tag">No inventário</span>':
      !available?'<span class="tp-store-tag is-future">Em breve</span>':
      '<span class="tp-store-tag">Disponível</span>';
    const unavailableReason=item.category==='BUNDLE'?'Coleção em preparação':
      item.category==='CAPTAIN'?'Capitão em preparação':'Aguardando recursos do Game Design';
    const premiumAction=available&&!owned&&!equipped&&catalog?.demoPremiumEnabled===true&&Number.isSafeInteger(item.premiumPrice)&&item.premiumPrice>0
      ? `<button class="btn btn-ghost" type="button" data-action="store-buy-premium" data-item-id="${esc(item.id)}" ${loading?'disabled':''}>Comprar · ${item.premiumPrice} premium</button>` : '';
    const action=!available?`<span class="tp-store-unavailable">${unavailableReason}</span>`:
      equipped?'<button class="btn btn-ghost" type="button" disabled>Em uso</button>':
      owned?`<button class="btn btn-primary" type="button" data-action="store-equip" data-item-id="${esc(item.id)}">Equipar</button>`:
      `<button class="btn btn-orange" type="button" data-action="store-buy" data-item-id="${esc(item.id)}" ${loading?'disabled':''}>Comprar · ${item.price} créditos</button>`;
    return `<article class="${cls}">
      ${renderProductCover(item)}
      <div class="tp-store-card-text"><div class="tp-store-card-meta"><span>${type}</span>${tags}</div>
      <h3>${esc(item.name)}</h3><p>${description}</p>${phrases}</div>
      <div class="tp-store-card-footer"><span class="tp-store-price">${available?(item.price===0?'Grátis':item.price+' créditos'):'Indisponível'}</span><div style="display:flex;flex-direction:column;gap:6px;min-width:0">${action}${premiumAction}</div></div>
    </article>`;
  }).join('');
  return `<section class="bn-page bn-store-page tp-store-page" aria-label="Loja de cosméticos">
    <header class="bn-page-heading tp-store-header">
      <div><h1>Loja</h1><p>Personalize sua experiência com frotas, sons e provocações. Nenhum dinheiro real é usado.</p></div>
    </header>
    <div class="tp-store-toolbar"><label for="store-filter">Categorias</label>
      <select class="tp-mode-select" id="store-filter">${categoryOptions}</select>
      <span class="tp-store-beta">Economia beta · sem dinheiro real</span>
    </div>
    <div class="tp-store-grid" aria-live="polite">
      ${catalog?.demoPremiumEnabled===true?`<article class="tp-store-card" style="grid-column:1/-1;min-height:0"><div class="tp-store-card-text"><h3>Créditos premium de demonstração</h3><p>Simule uma compra para experimentar a loja. Nenhum pagamento ou dado financeiro será solicitado.</p><div style="display:flex;flex-wrap:wrap;gap:8px">${[100,300,700].map(amount=>`<button class="btn btn-primary" type="button" data-action="store-demo-topup" data-item-id="demo_${amount}" ${loading?'disabled':''}>+ ${amount} premium</button>`).join('')}</div></div></article>`:''}
      ${loading&&!catalog?'<p class="tp-store-loading">Carregando catálogo...</p>':
        !catalog?'<p class="tp-store-loading">A loja não está disponível no momento.</p>':
        cards||'<p class="tp-store-loading">Nenhum item nesta categoria.</p>'}
    </div>
    <footer class="tp-store-footnote">As provocações são cosméticas: não aumentam poder, precisão ou dano. Capitães, coleções e sons extras aguardam homologação.</footer>
  </section>`;
}
