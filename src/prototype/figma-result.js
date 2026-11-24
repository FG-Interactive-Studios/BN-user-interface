import {esc} from './board.js';
import {buildMatchReport} from './match-report.js';

/**
 * Post-battle artboard from the approved Figma PDF.
 * All competitive numbers come from BattleResponse (never fabricated rewards).
 * Leaves the battle board, lobby and other pages unchanged.
 */
export function renderFigmaResult({battle,profile,lobby}) {
  const report=buildMatchReport(battle,profile?.id);
  const {won,draw}=report;
  const outcome=draw?'draw':won?'victory':'defeat';
  const title=draw?'Empate!':won?'Vitória!':'Derrota';
  const opponent=lobby?.players?.find(player=>player.id!==profile?.id)?.nickname;
  const opponentLabel=opponent?esc(opponent):'o adversário';
  const description=won
    ? `Você venceu a batalha contra ${opponentLabel}!`
    : draw ? 'A batalha terminou empatada.'
    : `A batalha contra ${opponentLabel} terminou.`;

  // The server provides two perspectives: shotsFired (you) and shotsReceived (opponent).
  const gameMode=esc(battle.mode?.name||'Modo de jogo');
  const playerRow=(label,stats,isYou)=>`<div class="bn-report-player ${isYou?'is-you':'is-rival'}">
    <strong class="bn-report-player-name">${esc(label)}</strong>
    <div class="bn-report-player-numbers">
      <span><b>${stats.hits}</b><small>Acertos</small></span>
      <span><b>${stats.misses}</b><small>Erros</small></span>
      <span><b>${stats.accuracy}%</b><small>Precisão</small></span>
      <span><b>${stats.sunk}</b><small>Navios</small></span>
    </div>
  </div>`;
  const rematch=lobby?.rematch||null;
  const meIndex=lobby?.players?.findIndex(p=>p.id===profile?.id)??-1;
  const myAccepted=meIndex===0?rematch?.hostAccepted
    :meIndex===1?rematch?.guestAccepted:false;
  const opponentAccepted=meIndex===0?rematch?.guestAccepted
    :meIndex===1?rematch?.hostAccepted:false;
  const rematchAvailable=!rematch || rematch.available;
  const rematchText=rematch&&!rematchAvailable?'Revanche indisponível'
    :myAccepted?'Cancelar pedido'
    :opponentAccepted?'Aceitar revanche'
    :rematch?'Pedir revanche':'Jogar novamente';
  const rematchAction=myAccepted?'cancel-rematch':'play-again';
  const rematchHint=rematch&&!rematchAvailable
    ? 'O adversário saiu. Você pode voltar ao lobby.'
    :myAccepted?'Aguardando a confirmação do adversário…'
    :opponentAccepted?'O adversário quer jogar novamente com você!'
    : '';
  const sharedNote=report.comparable
    ? '<span class="bn-report-equal-stats"> Os acertos e erros foram iguais, mas a condição de encerramento definiu o vencedor.</span>'
    : '';
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
          <div class="bn-report-stats" aria-label="Comparação dos jogadores">
            ${playerRow('Você',report.player,true)}
            ${playerRow(opponent||'Adversário',report.rival,false)}
          </div>
          <p class="bn-report-verdict" aria-live="polite">${esc(report.reason)}${sharedNote}</p>
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
        ${rematchHint?`<p class="bn-rematch-status" role="status" aria-live="polite">${esc(rematchHint)}</p>`:''}
        <button type="button" class="bn-report-replay" data-action="${rematchAction}"
          ${rematchAvailable?'':'disabled'}>${rematchText}</button>
        <button type="button" class="bn-report-back" data-action="leave-lobby">Voltar ao lobby</button>
      </div>
    </main>
  </div>`;
}
