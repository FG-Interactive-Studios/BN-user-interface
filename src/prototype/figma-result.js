import {esc} from './board.js';

/**
 * Post-battle artboard from the approved Figma PDF.
 * All competitive numbers come from BattleResponse (never fabricated rewards).
 * Leaves the battle board, lobby and other pages unchanged.
 */
export function renderFigmaResult({battle,profile,lobby}) {
  const won=battle.winnerId===profile?.id;
  const draw=battle.winnerId==null;
  const outcome=draw?'draw':won?'victory':'defeat';
  const title=draw?'Empate!':won?'Vitória!':'Derrota';
  const opponent=lobby?.players?.find(player=>player.id!==profile?.id)?.nickname;
  const opponentLabel=opponent?esc(opponent):'o adversário';
  const description=won
    ? `Você venceu a batalha contra ${opponentLabel}!`
    : draw ? 'A batalha terminou empatada.'
    : `A batalha contra ${opponentLabel} terminou.`;

  const shots=battle.shotsFired||[];
  const hits=shots.filter(shot=>shot.hit).length;
  const errors=shots.length-hits;
  const accuracy=shots.length?Math.round(hits/shots.length*100):0;
  const sunk=new Set(shots.filter(s=>s.sunkShip).map(s=>s.sunkShip)).size;
  // The real API has no round start/end timestamps or reward balance. These
  // parts of the approved visual must stay present but without fake values.
  const gameMode=esc(battle.mode?.name||'Modo de jogo');
  const stat=(amount,label,tone)=>`<div class="bn-report-stat ${tone}"><strong>${amount}</strong><span>${label}</span></div>`;

  return `<div class="screen bn-result-stage is-${outcome}">
    <main class="bn-result-viewport" aria-label="Resultado da partida">
      <header class="bn-report-hero">
        <span class="bn-report-emblem" aria-hidden="true"></span>
        <h1 id="bn-result-title">${title}</h1>
        <p>${description}</p>
      </header>

      <div class="bn-report-panels">
        <section class="bn-report-panel bn-report-summary" aria-labelledby="bn-result-summary">
          <h2 id="bn-result-summary">Resumo da partida</h2>
          <div class="bn-report-stats">
            ${stat(hits,'Acertos','positive')}
            ${stat(errors,'Erros','negative')}
            ${stat(accuracy+'%','Precisão','positive')}
            ${stat(sunk,'Navios destruídos','positive')}
          </div>
          <p class="bn-report-meta">Duração indisponível <span aria-hidden="true">·</span> ${gameMode}</p>
        </section>

        <section class="bn-report-panel bn-report-rewards" aria-labelledby="bn-result-rewards">
          <h2 id="bn-result-rewards">Recompensas</h2>
          <div class="bn-report-xp">
            <div class="bn-report-xp-head"><strong>XP</strong><span>Indisponível</span></div>
            <div class="bn-report-xp-track" role="img" aria-label="Progresso de XP não disponível na API"></div>
          </div>
          <div class="bn-report-reward-items">
            <div class="bn-report-reward-item"><span class="bn-report-currency gold" aria-hidden="true"></span><span><strong>—</strong><small>Moedas</small></span></div>
            <div class="bn-report-reward-item"><span class="bn-report-currency blue" aria-hidden="true"></span><span><strong>—</strong><small>Recompensa</small></span></div>
          </div>
          <p class="bn-report-reward-note">As recompensas serão exibidas quando estiverem disponíveis no jogo.</p>
        </section>
      </div>

      <div class="bn-report-actions">
        <button type="button" class="bn-report-replay" data-action="play-again">Jogar novamente</button>
        <button type="button" class="bn-report-back" data-action="leave-lobby">Voltar ao lobby</button>
      </div>
    </main>
  </div>`;
}
