import { esc, coordLabel, renderBoard } from './board.js';

/** ZIP reference: visual composition only. The backend still controls all battle rules. */
export function renderZipBattle({
  battle, mode, opponent, own, enemy, myTurn, finished, canAct,
  selected, skillTargets=[], available, sunk, activeAbility, skillControls,
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

  return `<div class="screen combat-screen bn-zip-battle">
    <main class="zip-game-layout" aria-label="Batalha naval em andamento">
      <header class="zip-battle-header">
        <details class="zip-battle-menu">
          <summary aria-label="Abrir menu da partida" title="Menu da partida">☰</summary>
          <div class="zip-battle-menu-panel">
            <b>Menu da batalha</b>
            <button type="button" data-action="forfeit" ${finished ? 'disabled' : ''}>Desistir da partida</button>
          </div>
        </details>
        <div class="zip-turn-indicator ${myTurn && !finished ? 'is-your-turn' : ''}" role="status" aria-live="polite">
          <span class="zip-compass" aria-hidden="true">✥</span>
          <strong>${finished ? 'Batalha concluída' : battle.paused ? 'Partida pausada' : myTurn ? 'Sua vez!' : 'Vez do rival'}</strong>
        </div>
        <div class="zip-match-timers" aria-label="Temporizadores oficiais da partida">${clockStrip || '<span>Encerrada</span>'}</div>
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
          <div class="zip-board-heading">Tabuleiro do oponente · ${canAct ? 'toque para mirar' : 'aguarde seu turno'}</div>
          <div class="zip-primary-board">
            ${renderBoard(mode, {
              hits: enemy.hits, misses: enemy.misses,
              selected: activeAbility ? null : selected,
              highlights: activeAbility && !aimingForOwnBoard ? skillTargets : [],
              interactive: canAct && (!activeAbility || activeAbility.targetScope !== 'OWN')
            })}
          </div>
          <div class="zip-target-indicator" aria-live="polite">${activeAbility ? 'Alvos de '+esc(activeAbility.name)+': ' : 'Alvo: '}<b>${activeAbility ? skillTargets.map(coordLabel).join(', ') || '—' : selected ? coordLabel(selected) : '—'}</b></div>
        </section>

        <section class="zip-lower-section" aria-label="Defesa e poderes">
          <div class="zip-own-section">
            <h2>Sua frota</h2>
            <div class="zip-own-board">
              ${renderBoard(mode, {
                ships: battle.yourShips, hits: own.hits, misses: own.misses,
                markers: battle.yourAbilityPointCells || [], small: true,
                highlights: activeAbility && aimingForOwnBoard ? skillTargets : [],
                interactive: canAct && Boolean(activeAbility) && aimingForOwnBoard
              })}
            </div>
          </div>
          <div class="zip-tactics-section">
            <details class="zip-abilities-menu">
              <summary aria-label="Escolher habilidade" title="Habilidades da partida">
                <span>Poderes</span><span class="zip-powers-count">${usefulAbilities} disponíveis · ${abilityCredits} pts</span><span aria-hidden="true">⌄</span>
              </summary>
              <div class="zip-abilities-options">
                <div class="zip-abilities-grid">${powers}</div>
                ${abilities.length ? '<button type="button" class="zip-powers-detail" data-action="open-abilities">Informações das habilidades</button>' : ''}
              </div>
            </details>
            ${activeAbility
              ? `<p class="zip-active-power" aria-live="polite">Selecionado: <b>${esc(activeAbility.name)}</b></p>`
              : `<p class="zip-tactical-hint">${canAct?'Use um poder ou faça um disparo normal.':'Poderes disponíveis no seu próximo turno.'}</p>`}
            ${skillControls}
            ${activeEffects}
            ${radarInfo}
          </div>
        </section>
      </div>

      <button type="button" class="zip-fire-button" data-action="fire"
        ${canAct && selected && !activeAbility ? '' : 'disabled'}>
        <strong>Atirar!</strong>
        <small>${selected ? `Alvo ${coordLabel(selected)}` : myTurn ? 'Selecione uma casa no mapa inimigo' : 'Aguardando oponente'}</small>
      </button>
    </main>
    ${pausedOverlay}
  </div>`;
}
