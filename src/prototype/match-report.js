/** This report is computed per player from the authoritative BattleResponse perspective.
 * The enemy's shots are in shotsReceived. Never mirror the local shot list.
 */
export function reportStats(records=[]){
  const shots=(records||[]).filter(shot=>!shot.blocked);
  const hits=shots.filter(shot=>shot.hit).length;
  const misses=shots.length-hits;
  const sunk=new Set(shots.filter(shot=>shot.sunkShip).map(shot=>shot.sunkShip)).size;
  return {hits,misses,accuracy:shots.length?Math.round(100*hits/shots.length):0,sunk,attempts:shots.length,
    blocked:(records||[]).filter(shot=>shot.blocked).length};
}

export function finishReasonText(reason,winnerId,playerId){
  switch(reason){
    case 'ALL_SHIPS_SUNK':return 'Uma frota foi completamente destruída.';
    case 'TIME_LIMIT':return 'O tempo terminou: venceu quem preservou mais navios.';
    case 'TIME_LIMIT_DRAW':return 'O tempo terminou com o mesmo número de navios restantes.';
    case 'ABANDONED':return winnerId===playerId?'O adversário desistiu da partida.':'A partida terminou por desistência.';
    case 'DISCONNECT_TIMEOUT':return winnerId===playerId?'O adversário não retornou a tempo.':'A partida terminou pelo limite de reconexão.';
    case 'TURN_TIMEOUT_FORFEIT':return winnerId===playerId?'O adversário perdeu o prazo de turnos.':'A partida terminou pelo limite de turnos perdidos.';
    case 'BOTH_DISCONNECTED':return 'Os dois jogadores perderam a conexão.';
    default:return 'Encerramento confirmado pelo servidor.';
  }
}

export function buildMatchReport(battle,profileId){
  const player=reportStats(battle?.shotsFired||[]);
  const rival=reportStats(battle?.shotsReceived||[]);
  const winnerId=battle?.winnerId;
  const draw=winnerId==null;
  return {
    player,rival,draw,won:!draw&&winnerId===profileId,
    reason:finishReasonText(battle?.finishReason,winnerId,profileId),
    comparable:!draw && player.hits===rival.hits && player.misses===rival.misses,
  };
}

/** A cosmetic, truthful title derived only from server-backed shot statistics. */
export function ridiculousAward(report) {
  const {player,won,draw}=report;
  if(player.attempts===0)
    return {title:'Capitão de Água Doce',emoji:'🛟',description:'A batalha acabou antes de você testar o canhão.'};
  if(player.misses>=5&&player.misses>player.hits*2)
    return {title:'Terror dos Peixes',emoji:'🐟',description:'Os peixes conhecem sua mira melhor que os navios.'};
  if(player.hits>=3&&player.accuracy>=80)
    return {title:'Sniper de Banheira',emoji:'🎯',description:'Você quase esqueceu que tinha água no tabuleiro.'};
  if(player.sunk>=2)
    return {title:'Colecionador de Âncoras',emoji:'⚓',description:'Transformou navios em um museu subaquático.'};
  if(player.misses>player.hits)
    return {title:'Atirador de Água',emoji:'💦',description:'Foi uma ótima batalha contra o oceano.'};
  if(draw)
    return {title:'Rei do Empate',emoji:'🤝',description:'Ninguém venceu, mas a água ficou agitada.'};
  if(won)
    return {title:'Almirante do Improviso',emoji:'🏴‍☠️',description:'Ninguém sabe como, mas seu plano funcionou.'};
  return {title:'Capitão Persistente',emoji:'🚢',description:'O importante é tentar. A frota já discordou.'};
}
