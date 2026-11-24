import {esc} from './board.js';

/** Mirror of the API allowlisted phrase selection; API always enforces ownership. */
export const TAUNT_PACKS=Object.freeze({
  taunt_default:['Foi sem querer! 😇','Isso foi calculado. Confia! 🧠',
    'Parabéns, você acertou água! 🌊','Minha bússola pediu demissão! 🧭'],
  taunt_banter:['É pavê ou pra afundar? 🍮','Meu barco é tão bom que dá até nó! 🪢',
    'Navio sem mar? Tá mal! 🛟','Não sou capitão, sou capi-tão azarado! 🤡'],
  taunt_panic:['EU JURO QUE TINHA UM NAVIO AQUI! 😭','CHAMA A SEGURADORA! 💥',
    'A TRIPULAÇÃO ESTÁ EM MODO PÂNICO! 🚨','A CULPA FOI DO VENTO! 🌪️']
});

export function equippedTaunts(items=[]) {
  const equipped=items.find(i=>i.category==='TAUNT'&&i.owned&&i.equipped);
  return equipped?{id:equipped.id,phrases:TAUNT_PACKS[equipped.id]||[]}:null;
}

export function tauntControls(items) {
  const pack=equippedTaunts(items||[]);
  if(!pack||!pack.phrases.length) return '';
  return `<details class="bn-taunt-menu"><summary>💬 Provocar</summary>
    <div class="bn-taunt-popover" role="group" aria-label="Provocações do capitão">
      <strong>${esc(pack.id==='taunt_default'?'Provocações gratuitas':pack.id==='taunt_banter'?'Tio do Pavê Naval':'Surto Marítimo')}</strong>
      ${pack.phrases.map((phrase,index)=>`<button type="button" data-action="send-taunt" data-item-id="${index}" title="Enviar provocação">${esc(phrase)}</button>`).join('')}
      <small>Uma provocação a cada 5 segundos · Sem efeito na batalha</small>
    </div>
  </details>`;
}

export const REACTIONS={
  hit:['A seguradora já bloqueou seu número! 💥','Esse casco virou peneira! 🧀',
    'Precisamos conversar sobre a garantia desse navio. 🚢'],
  miss:['O oceano sofreu danos irreparáveis! 🌊','Os peixes estão pedindo trégua. 🐟',
    'Acertou uma quantidade impressionante de água! 💧'],
  sunk:['Mais um imóvel disponível no fundo do mar! 🏚️','O navio virou submarino sem querer! 🤿',
    'A tripulação já está procurando boias! 🛟'],
};
export function funnyReaction(events=[],seed=0) {
  const category=events.includes('ship_sunk_enemy')||events.includes('ship_sunk_ally')
    ? 'sunk':events.includes('hit')?'hit':events.includes('miss')?'miss':null;
  if(!category)return null;
  const phrases=REACTIONS[category];
  return {kind:category,text:phrases[Math.abs(seed)%phrases.length]};
}
