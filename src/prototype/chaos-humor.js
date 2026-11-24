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
  "hit": [
    "A seguradora já bloqueou seu número! 💥",
    "Esse casco virou peneira! 🧀",
    "Precisamos conversar sobre a garantia desse navio. 🚢",
    "O conserto ficou mais caro que o barco! 💸",
    "A tripulação abriu chamado no suporte. 📞",
    "Foi só um arranhão! De 3 metros. 🔨",
    "Tem um submarino novo, mas sem querer. 🤿",
    "O oceano acabou de ganhar um aquário. 🐠",
    "O inimigo está reconsiderando sua carreira. 📋",
    "Chamem o encanador, estamos vazando! 🚰",
    "O casco não gostou dessa conversa. 💬",
    "É pra boiar ou pra virar peneira? 🧽",
    "Ponto para você, prejuízo para o estaleiro! 🏗️",
    "O radar do adversário entrou em negação. 📡",
    "Essa reforma no navio não foi autorizada! 🛠️"
  ],
  "miss": [
    "O oceano sofreu danos irreparáveis! 🌊",
    "Os peixes estão pedindo trégua. 🐟",
    "Acertou uma quantidade impressionante de água! 💧",
    "Parabéns, você encontrou o mar! 🧭",
    "A mira foi fazer turismo. 🏖️",
    "O tiro chegou, mas o navio não estava. 🚢",
    "O peixe que viu isso pediu indenização. 🐡",
    "Você está perdendo para um tabuleiro. 📉",
    "O oceano continua invicto contra sua mira. 🌊",
    "É água! Outra vez! Que surpresa! 💦",
    "A bússola acabou de pedir demissão. 🧳",
    "O canhão estava de olhos fechados? 🙈",
    "Acertar o vento não dá ponto, capitão. 🌪️",
    "Esse tiro está indo procurar emprego. 💼",
    "O mapa era do estacionamento? 🅿️"
  ],
  "sunk": [
    "Mais um imóvel disponível no fundo do mar! 🏚️",
    "O navio virou submarino sem querer! 🤿",
    "A tripulação já está procurando boias! 🛟",
    "O navio foi promovido a atração turística! 🪸",
    "O fundo do mar ganhou um novo condomínio. 🏘️",
    "Foi de navio para aquário em segundos! 🐠",
    "O capitão saiu nadando e sem currículo. 🏊",
    "A seguradora desligou na sua cara! ☎️",
    "Era porta-aviões, agora é porta-peixes. 🐟",
    "Sacanagem, o barco tinha acabado de lavar. 🧼",
    "O estaleiro vai precisar de terapia. 🛠️",
    "A equipe de resgate pediu folga. 🛟",
    "O oceano ganhou mais um hóspede permanente. 🌊",
    "Mais uma frota matriculada na escola de natação. 🎓",
    "O barco decidiu morar embaixo d’água. 🫧"
  ],
  "blocked": [
    "O escudo disse NÃO, OBRIGADO! 🛡️",
    "O tiro bateu na portaria e voltou. 🚪",
    "Essa armadura está no plano premium! 💎",
    "Recusado: danos fora do horário comercial. 🕐",
    "Seu disparo caiu no spam do navio. 📧"
  ]
};
export function funnyReaction(events=[],seed=0) {
  const category=events.includes('ship_sunk_enemy')||events.includes('ship_sunk_ally')
    ? 'sunk':events.includes('attack_blocked')?'blocked':events.includes('hit')?'hit':events.includes('miss')?'miss':null;
  if(!category)return null;
  const phrases=REACTIONS[category];
  return {kind:category,text:phrases[Math.abs(seed)%phrases.length]};
}
