import { esc, coordLabel, renderBoard } from './board.js';

/** ZIP reference: visual composition only. The backend still controls all battle rules. */
export function renderZipBattle({
  battle, mode, opponent, own, enemy, myTurn, finished, canAct,
  selected, skillTargets=[], skillArea=[], available, sunk, activeAbility, skillControls,
  activeEffects, radarInfo, clockStrip, pausedOverlay
}) {
  const ownLost = new Set((battle.shotsReceived || []).filter(shot => shot.sunkShip).map(shot => shot.sunkShip)).size;
  const enemyLost = new Set(sunk.map(shot => shot.sunkShip)).size;
  const totalShips = mode.fleet.length;
  const remainingOwn = Math.max(0, totalShips - ownLost);
  const remainingEnemy = Math.max(0, totalShips - enemyLost);
  const abilities = available || [];
  const usefulAbilities = abilities.filter(ability => ability.usesRemaining > 0 && !ability.locked).length;
  const abilityCredits = Number(battle.yourAbilityPointsEarned) || 0;
  const aimingForOwnBoard = activeAbility?.targetScope === 'OWN';
  const turnState = finished ? 'finished' : battle.paused ? 'paused' : myTurn ? 'your-turn' : 'opponent-turn';
  const turnTitle = finished ? 'PARTIDA ENCERRADA' : battle.paused ? 'PARTIDA PAUSADA' : myTurn ? 'SEU TURNO' : 'TURNO DO ADVERSÁRIO';
  const turnHint = finished ? 'Confira o resultado da partida' : battle.paused ? 'Aguardando reconexão' :
    myTurn ? activeAbility ? activeAbility.id==='double-shot' ? 'Escolha duas casas para o tiro duplo' : 'Escolha uma casa e confirme a habilidade' : 'Escolha um alvo ou use uma habilidade' : 'Aguarde a jogada do oponente';
  const fireHint = finished ? 'Partida encerrada' : battle.paused ? 'Partida pausada' :
    myTurn ? selected ? `Alvo ${coordLabel(selected)}` : 'Selecione uma casa' : 'Aguardando oponente';

  const powers = abilities.length
    ? abilities.map(ability => {
      const disabled = !canAct || ability.locked || ability.usesRemaining <= 0;
      const chosen = activeAbility?.id === ability.id;
      return `<button type="button" class="zip-ability ${chosen ? 'is-active' : ''}" data-action="pick-ability" data-ability-id="${esc(ability.id)}"
        title="${esc(ability.description || ability.name)}" ${disabled ? 'disabled' : ''} aria-pressed="${chosen}">
        <span class="zip-ability-emblem" aria-hidden="true">✦</span>
        <span class="zip-ability-name">${esc(ability.name)}</span>
        <small>${ability.usesRemaining} uso(s) · ${['radar','double-shot'].includes(ability.id)?'Grátis':'1 ponto'}${ability.locked?' · Bloqueado':''}</small>
      </button>`;
    }).join('')
    : '<p class="zip-no-powers">Este modo não possui habilidades disponíveis.</p>';

  return `<div class="screen combat-screen bn-zip-battle" data-turn="${turnState}" data-skill-scope="${activeAbility?.targetScope||'NONE'}">
    <main class="zip-game-layout" aria-label="Batalha naval em andamento">
      <header class="zip-battle-header">
        <details class="zip-battle-menu">
          <summary aria-label="Abrir menu da partida" title="Menu da partida">☰</summary>
          <div class="zip-battle-menu-panel">
            <b>Menu da batalha</b>
            <button type="button" data-action="forfeit" ${finished ? 'disabled' : ''}>Desistir da partida</button>
          </div>
        </details>
        <div class="zip-battle-headline"><span>COMBATE NAVAL</span><strong>Batalha em curso</strong></div>
        <div class="zip-battle-identity" aria-label="Estado do confronto">${finished ? 'Concluída' : 'Em andamento'}</div>
      </header>

      <section class="zip-scoreboard" aria-label="Placar da partida">
        <div class="zip-score-side">
          <strong>Você</strong>
          <small>Navios: ${remainingOwn}/${totalShips} · Acertos: ${enemy.hits.length}</small>
        </div>
        <div class="zip-score-value" aria-label="Acertos ${enemy.hits.length} a ${own.hits.length}">${enemy.hits.length} × ${own.hits.length}</div>
        <div class="zip-score-side zip-score-opponent">
          <strong>${esc(opponent?.nickname || 'Oponente')}</strong>
          <small>Navios: ${remainingEnemy}/${totalShips} · Acertos: ${own.hits.length}</small>
        </div>
      </section>

      <div class="zip-battle-center">
        <section class="zip-enemy-section" aria-label="Tabuleiro de ataque">
          <div class="zip-board-heading">Tabuleiro do oponente · ${canAct ? 'toque para mirar' : finished ? 'partida encerrada' : battle.paused ? 'partida pausada' : 'aguarde o oponente'}</div>
          <div class="zip-primary-board">
            ${renderBoard(mode, {
              hits: enemy.hits, misses: enemy.misses,
              selected: activeAbility ? null : selected,
              highlights: activeAbility && !aimingForOwnBoard ? skillArea : [],
              interactive: canAct && (!activeAbility || activeAbility.targetScope !== 'OWN')
            })}
          </div>
          <div class="zip-target-indicator" aria-live="polite">${activeAbility ? 'Área prevista · ' : 'Alvo: '}<b>${activeAbility ? skillArea.length ? skillArea.length===1 ? '1 casa afetada' : skillArea.length+' casas afetadas' : activeAbility.targetCount===0 ? 'Sem seleção necessária' : 'Escolha uma casa' : selected ? coordLabel(selected) : '—'}</b></div>
        </section>

        <section class="zip-turn-panel is-${turnState}" aria-label="Situação do turno e cronômetros">
          <div class="zip-turn-copy" role="status" aria-live="polite" aria-atomic="true">
            <span class="zip-turn-eyebrow"><i class="zip-turn-signal" aria-hidden="true"></i>TURNO ATUAL</span>
            <strong class="zip-turn-headline">${turnTitle}</strong>
            <small class="zip-turn-hint">${turnHint}</small>
          </div>
          <div class="zip-round-clocks" aria-label="Temporizadores oficiais">${clockStrip || '<span>Encerrada</span>'}</div>
        </section>

        <section class="zip-own-section" aria-label="Tabuleiro de defesa">
          <div class="zip-board-heading">SUA FROTA · ${remainingOwn} navios operacionais</div>
          <div class="zip-own-board">
            ${renderBoard(mode, {
              ships: battle.yourShips, hits: own.hits, misses: own.misses,
              markers: battle.yourAbilityPointCells || [], small: true,
              highlights: activeAbility && aimingForOwnBoard ? skillArea : [],
              interactive: canAct && Boolean(activeAbility) && aimingForOwnBoard
            })}
          </div>
        </section>
      </div>

      <footer class="zip-battle-footer" aria-label="Controles de batalha">
        <div class="zip-battle-action-bar">
          <div class="zip-tactics-section">
            ${activeAbility
              ? `<button type="button" class="zip-cancel-power" data-action="cancel-ability">Cancelar ${esc(activeAbility.name)}</button>`
              : `<details class="zip-abilities-menu">
                  <summary aria-label="Escolher habilidade" title="Habilidades da partida">
                    <span>Poderes</span><span class="zip-powers-count">${usefulAbilities} disponíveis · ${abilityCredits} pts</span><span aria-hidden="true">⌄</span>
                  </summary>
                  <div class="zip-abilities-options">
                    <div class="zip-abilities-grid">${powers}</div>
                    ${abilities.length ? '<button type="button" class="zip-powers-detail" data-action="open-abilities">Informações das habilidades</button>' : ''}
                  </div>
                </details>`}
          </div>
          ${activeAbility
            ? `<button type="button" class="zip-fire-button zip-activate-power" data-action="activate-ability"
                ${canAct && skillTargets.length===activeAbility.targetCount && !activeAbility.locked ? '' : 'disabled'}>
                <strong>ATIVAR PODER</strong><small>${activeAbility.targetCount===0 ? 'Sem alvo necessário' : skillTargets.length===activeAbility.targetCount ? 'Confirmar área escolhida' : activeAbility.id==='double-shot' ? skillTargets.length===1 ? 'Escolha a segunda casa' : 'Escolha duas casas' : 'Escolha uma casa'}</small>
              </button>`
            : `<button type="button" class="zip-fire-button" data-action="fire" ${canAct && selected ? '' : 'disabled'}>
                <strong>ATIRAR</strong><small>${fireHint}</small>
              </button>`}
        </div>
        ${skillControls || activeEffects || radarInfo
          ? `<div class="zip-battle-context" aria-live="polite">${skillControls}${activeEffects}${radarInfo}</div>`
          : ''}
      </footer>
    </main>
    ${pausedOverlay}
  </div>`;
}
