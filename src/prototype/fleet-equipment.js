import {esc,shipName} from './board.js';
import {shipArt,captainArt,isOfficialCaptain} from './ship-art.js';
import {renderProductCover} from './store-ui.js';
import {EXPRESSIVE_LABELS} from './expressive-cosmetics.js';

const categories=Object.freeze([
 ['SKIN','Frota','⚓','skin_default','Frota Original'],
 ['CAPTAIN','Capitão','♟','captain_default','Capitão Padrão'],
 ['SOUND','Sons','♫','sound_default','Sons Padrão'],
 ['TAUNT','Provocações','💬','taunt_default','Provocações Gratuitas'],
 ['ATTACK','Efeitos de ataque','✦','attack_default','Impacto padrão'],
 ['CELEBRATION','Comemorações','🎊','celebration_default','Comemoração padrão'],
 ['FUNERAL','Funerais','⚰','funeral_default','Funeral naval'],
 ['TITLE','Títulos','⚑','title_default','Capitão'],
 ['COMMENTATOR','Comentaristas','📢','commentator_default','Comentarista padrão'],
 ['FRAME','Molduras','◈','frame_default','Moldura padrão'],
 ['BOARD_THEME','Temas de tabuleiro','▦','board_default','Tabuleiro padrão']
].map(([id,label,icon,baseId,baseName])=>({id,label,icon,baseId,baseName})));
export const equipmentCategory=id=>categories.find(c=>c.id===id);
export function ownedEquipment(catalog,category){
 return (catalog?.items||[]).filter(i=>i.category===category&&i.enabled===true&&i.owned===true&&(category!=='CAPTAIN'||isOfficialCaptain(i.id)));
}
export function activeEquipment(catalog,category){return ownedEquipment(catalog,category).find(i=>i.equipped===true)||null;}
const btn=(category,label='Alterar')=>`<button class="bn-equipment-change" type="button" data-action="fleet-select" data-item-id="${category}" aria-label="${esc(label+' '+equipmentCategory(category).label)}">${esc(label)} <span aria-hidden="true">›</span></button>`;
const name=(catalog,category)=>esc(activeEquipment(catalog,category)?.name||'Nenhum confirmado');
const info=(catalog,loading)=>!catalog?`<div class="bn-equipment-message" role="status">${loading?'Carregando seu inventário…':'Não foi possível consultar seu inventário.'}${loading?'':' <button type="button" data-action="fleet-reload">Tentar novamente</button>'}</div>`:'';
function art(item,category){
 if(category==='CAPTAIN')return `<div class="bn-equipment-portrait-art"><img src="${captainArt(item.id)}" alt="" loading="lazy"></div>`;
 return renderProductCover(item);
}
export function renderFleetEquipment({catalog,mode,loading=false}={}){
 const skin=activeEquipment(catalog,'SKIN');
 const captain=activeEquipment(catalog,'CAPTAIN');
 const ships=Array.isArray(mode?.fleet)?mode.fleet:[];
 return `<div class="bn-page bn-fleet-page bn-equipment-page">
  <header class="bn-page-heading bn-equipment-heading"><div><h1>Sua frota</h1><p>Personalize sua equipe antes de entrar em batalha.</p></div></header>
  ${info(catalog,loading)}
  <div class="bn-equipment-showcase">
   <section class="bn-equipment-fleet" aria-label="Frota ativa">
    <div class="bn-equipment-section-heading"><div><span class="bn-equipment-kicker">FROTA ATIVA</span><h2>${name(catalog,'SKIN')}</h2></div>${btn('SKIN','Alterar')}</div>
    <div class="bn-equipment-ships">${ships.map(def=>{
      const src=shipArt(def.id,skin?.id||'skin_default');
      return `<article class="bn-ship-item bn-equipment-ship"><div class="bn-equipment-ship-art">${src?`<img src="${src}" alt="" loading="lazy">`:'<span aria-hidden="true">⚓</span>'}</div><strong>${esc(shipName(def.id))}</strong><small>${esc(def.length)} casas</small></article>`;
    }).join('')||'<p>Nenhum modo de jogo habilitado.</p>'}</div>
    <p class="bn-equipment-mode">Embarcações do modo ${esc(mode?.name||'atual')}. As regras da partida definem a composição.</p>
   </section>
   <section class="bn-equipment-captain" aria-label="Capitão ativo">
    <div class="bn-equipment-section-heading"><div><span class="bn-equipment-kicker">CAPITÃO ATIVO</span><h2>${name(catalog,'CAPTAIN')}</h2></div>${btn('CAPTAIN','Alterar')}</div>
    <div class="bn-equipment-hero-portrait"><img src="${captainArt(captain?.id||'captain_default')}" alt="Retrato do capitão" loading="lazy"></div>
    <p class="bn-equipment-mode">Expressões durante o combate</p>
   </section>
  </div>
  <section class="bn-equipment-other" aria-label="Outros itens ativos"><h2>Seu equipamento</h2><div class="bn-equipment-slots">
   ${categories.slice(2).map(c=>{
    const active=activeEquipment(catalog,c.id);
    return `<button type="button" class="bn-equipment-slot" data-action="fleet-select" data-item-id="${c.id}"><span class="bn-equipment-slot-icon" aria-hidden="true">${c.icon}</span><span class="bn-equipment-slot-copy"><small>${esc(c.label)}</small><strong>${esc(active?.name||'Nenhum confirmado')}</strong></span><span aria-hidden="true">›</span></button>`;
   }).join('')}
  </div></section>
 </div>`;
}
export function renderEquipmentSelection(category,{catalog,mode,loading=false}={}){
 const c=equipmentCategory(category);
 if(!c)return renderFleetEquipment({catalog,mode,loading});
 const items=ownedEquipment(catalog,category),active=activeEquipment(catalog,category);
 const others=items.filter(i=>i.id!==active?.id);
 const card=(item,selected)=>`<article class="bn-inventory-card ${selected?'is-active':''}" data-equipment-id="${esc(item.id)}">
   ${art(item,category)}
   <div class="bn-inventory-copy"><h3>${esc(item.name)}</h3><p>${esc(item.description||'')}</p>
   ${selected?'<span class="bn-inventory-equipped">✓ Equipado</span>':`<button type="button" class="bn-equipment-equip" data-action="fleet-equip" data-item-id="${esc(item.id)}" ${loading?'disabled':''}>Equipar</button>`}</div>
 </article>`;
 return `<div class="bn-page bn-fleet-page bn-equipment-page bn-equipment-selection" data-equipment-category="${category}">
  <header class="bn-page-heading bn-equipment-heading"><button type="button" class="bn-equipment-back" data-action="fleet-back" aria-label="Voltar para sua frota">‹</button><div><h1>${esc(c.label)}</h1><p>Escolha entre os itens que você possui.</p></div></header>
  ${info(catalog,loading)}
  <section class="bn-inventory-active" aria-label="Item ativo"><h2>Item ativo</h2>${active?card(active,true):'<p class="bn-equipment-message">Nenhum item ativo confirmado.</p>'}</section>
  <section aria-label="Itens disponíveis"><h2 class="bn-inventory-heading">Disponíveis para equipar <small>${others.length}</small></h2><div class="bn-inventory-grid">${others.map(item=>card(item,false)).join('')||'<p class="bn-equipment-message">Nenhum outro item disponível no seu inventário.</p>'}</div></section>
 </div>`;
}
