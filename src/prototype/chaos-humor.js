import {esc} from './board.js';

/** Mirror of the API allowlisted phrase selection; API always enforces ownership. */
export const TAUNT_PACKS=Object.freeze({
  taunt_default:[
    "Foi sem querer! 😇",
    "Isso foi calculado. Confia! 🧠",
    "Parabéns, você acertou água! 🌊",
    "Minha bússola pediu demissão! 🧭",
    "Eu ouvi um ploc. Isso conta como acerto? 🫧",
    "Meu mapa veio de um guardanapo. 🗺️",
    "É uma manobra de distração, tá? 🎭",
    "Vou fingir que foi de propósito. 😎",
    "Alguém viu onde estacionei minha frota? 🚗",
    "Nota oficial: tudo sob controle (mentira). 📋"
  ],
  taunt_banter:[
    "É pavê ou pra afundar? 🍮",
    "Meu barco é tão bom que dá até nó! 🪢",
    "Navio sem mar? Tá mal! 🛟",
    "Não sou capitão, sou capi-tão azarado! 🤡",
    "É afundar ou é pra boiar? 🛟",
    "Esse ataque foi mar-avilhoso! 🌊",
    "Você viu meu trocadilho boiando? 🤿",
    "Se eu errar de novo, é maré de azar! 🍀",
    "Essa vitória tá vindo a remo! 🚣",
    "Meu radar tá de férias no litoral. 🏖️"
  ],
  taunt_panic:[
    "EU JURO QUE TINHA UM NAVIO AQUI! 😭",
    "CHAMA A SEGURADORA! 💥",
    "A TRIPULAÇÃO ESTÁ EM MODO PÂNICO! 🚨",
    "A CULPA FOI DO VENTO! 🌪️",
    "ALGUÉM DESLIGA O MAR! 🚨",
    "SE ACHAR MEU CANHÃO, ME AVISA! 📢",
    "COMO ASSIM O NAVIO NÃO TEM FREIO?! 🛑",
    "PRECISO DE UM ADULTO RESPONSÁVEL! 😵",
    "CAPITÃO, O MANUAL TÁ MOLHADO! 📖",
    "ESTOU NEGOCIANDO COM OS PEIXES! 🐟"
  ],
  taunt_support:[
    "Seu naufrágio é muito importante para nós. ☎️",
    "Protocolo aberto: água onde não devia. 🧾",
    "Nosso prazo é de três marés úteis. ⌛",
    "Para reclamar, disque 0800-AFUNDE. 📞",
    "Sua embarcação foi encaminhada ao suporte. 🛠️",
    "Aperte 1 para pânico, 2 para mais pânico. ☎️",
    "O seguro cobre danos emocionais? 📄",
    "Aguarde na linha. O casco já não aguarda. 📠",
    "Seu chamado foi encerrado por afogamento. 🗂️",
    "Nos avalie de 1 a naufrágio. ⭐"
  ],
  taunt_meme:[
    "Achei que fosse batalha naval, não aula de natação! 🏊",
    "Confia no processo. O processo afundou. 📉",
    "Esse tiro foi patrocinado pelo acaso. 🎲",
    "Alguém atualiza o currículo do meu navio? 💼",
    "Minha estratégia veio de um sonho estranho. 🛌",
    "Tá tudo bem. Só não olha pro casco. 🙈",
    "Esse oceano tá com hitbox duvidosa! 🎯",
    "Foi lag do universo, eu juro! 📶",
    "Acabou o orçamento para mira. 💸",
    "Meu capitão está em manutenção. 🔧"
  ]
});
export const TAUNT_PACK_NAMES=Object.freeze({
  "taunt_default": "Provocações Gratuitas",
  "taunt_banter": "Tio do Pavê Naval",
  "taunt_panic": "Surto Marítimo",
  "taunt_support": "Atendimento Naval",
  "taunt_meme": "Almirante dos Memes"
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
      <strong>${esc(TAUNT_PACK_NAMES[pack.id]||'Provocações')}</strong>
      ${pack.phrases.map((phrase,index)=>`<button type="button" data-action="send-taunt" data-item-id="${index}" title="Enviar provocação">${esc(phrase)}</button>`).join('')}
      <small>${pack.phrases.length} frases disponíveis · 1 a cada 5 segundos · Sem efeito na batalha</small>
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
