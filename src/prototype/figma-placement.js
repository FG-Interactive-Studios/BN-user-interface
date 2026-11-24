import { esc, renderBoard, shipName, occupiedCells, keyOf } from './board.js';
import { shipArt } from './ship-art.js';

/** Figma "Sua frota" layout; the existing board renderer/CSS remain authoritative. */
const iconRotate = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 1-2.35-5.65"/><path d="M20 4v6h-6"/></svg>`;
const iconRandom = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h3c4 0 5 12 10 12h3"/><path d="m17 15 3 3-3 3"/><path d="M4 18h3c2 0 3-3 4-5"/><path d="M14 8c1-1 2-2 3-2h3"/><path d="m17 3 3 3-3 3"/></svg>`;
const iconClear = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>`;

/** Display-name exception within this approved Figma screen only. */
const displayShipName = (id) => id === 'DESTROYER' ? 'Destróier' : shipName(id);

/** Prefer explicit selection, otherwise the first unplaced ship in mode order. */
export function chosenPlacementShip(mode,ships,selectedShipId){
  return mode?.fleet?.find(s=>s.id===selectedShipId)||mode?.fleet?.find(s=>!ships.some(p=>p.type===s.id))||null;
}
/** One pure plan for the ghost preview AND the actual placement click. */
export function planPlacement({mode,ships=[],selectedShipId,orientation,anchor}){
  if(!anchor||mode?.geometry?.kind!=='RECTANGULAR'||!mode.placementDirections?.includes(orientation))return null;
  const chosen=chosenPlacementShip(mode,ships,selectedShipId);
  if(!chosen)return null;
  const candidate={type:chosen.id,row:anchor.row,col:anchor.col,orientation};
  const rest=ships.filter(s=>s.type!==chosen.id);
  const cells=occupiedCells([candidate],mode),occupied=occupiedCells(rest,mode);
  const playable=new Set(mode.geometry.cells.map(keyOf));
  const inside=[...cells].every(key=>playable.has(key));
  const overlaps=[...cells].some(key=>occupied.has(key));
  return {candidate,length:chosen.length,cells,inside,valid:inside&&!overlaps,proposed:[...rest,candidate]};
}

export function renderFigmaPlacement({ preparation, mode, draft, selectedShipId, orientation, skin }) {
  const ships = draft ?? (preparation.yourShips || []);
  const editable = !preparation.fleetConfirmed;
  const placed = new Set(ships.map(ship => ship.type));
  const chosenId = chosenPlacementShip(mode,ships,selectedShipId)?.id||null;
  const directions = mode.placementDirections || [];
  const canManual = editable && mode.geometry.kind === 'RECTANGULAR' && directions.includes(orientation);
  const repositioning = canManual && chosenId!==null && placed.has(chosenId);
  // Retain original draft coordinates until a valid release/click; render only the other ships.
  const visibleShips = repositioning ? ships.filter(s=>s.type!==chosenId) : ships;
  const canRotate = canManual && chosenId!==null && directions.includes('VERTICAL') && directions.includes('HORIZONTAL');
  const complete = mode.fleet.every(ship => placed.has(ship.id));
  const progress = `${ships.length} de ${mode.fleet.length} posicionados`;
  const hint = preparation.fleetConfirmed
    ? 'Sua frota está confirmada. Aguarde a confirmação do adversário.'
    : canManual
      ? chosenId ? 'Passe o mouse ou arraste o dedo. Clique ou solte para posicionar.' : 'Frota posicionada. Selecione um navio para reposicionar.'
      : 'Use Aleatório para posicionar a frota neste modo de jogo.';

  const cards = mode.fleet.map(def => {
    const isPlaced = placed.has(def.id);
    const isChosen = canManual && chosenId === def.id;
    const state = isChosen ? 'Selecionado' : isPlaced ? 'Posicionado' : 'Pendente';
    const stateClass = isChosen ? 'selected' : isPlaced ? 'positioned' : 'pending';
    const segments = Array.from({ length: def.length }, () => '<i></i>').join('');
    const artwork = shipArt(def.id,skin);
    const preview = artwork ? `<span class="bn-placement-art-preview"><img src="${artwork}" alt="" aria-hidden="true" loading="lazy" /></span>` : `<span class="bn-placement-segments" aria-hidden="true">${segments}</span>`;
    return `<button type="button" class="bn-placement-ship ${isChosen?'is-selected':''}"
      data-action="select-placement-ship" data-item-id="${esc(def.id)}"
      aria-pressed="${isChosen}" aria-label="${esc(displayShipName(def.id))}, ${state}"
      ${!canManual?'disabled':''}>
      ${preview}
      <span class="bn-placement-ship-name">${esc(displayShipName(def.id))}</span>
      <span class="bn-placement-ship-status ${stateClass}">${state}</span>
    </button>`;
  }).join('');

  return `<div class="screen combat-screen placement-screen bn-placement-screen bn-zip-placement">
    <main class="bn-placement-page" aria-labelledby="bn-placement-title">
      <header class="bn-placement-header">
        <div class="bn-placement-heading">
          <button type="button" class="bn-placement-exit" data-action="leave-lobby" aria-label="Sair da sala" title="Sair da sala">×</button>
          <div><span class="bn-placement-kicker">Fase estratégica</span><h1 id="bn-placement-title">Posicione os navios</h1></div>
        </div>
        <span class="bn-placement-phase" aria-label="Prazo de preparação definido pelo servidor">
          <span class="bn-placement-clock" aria-hidden="true">◷</span>
          Preparação <strong data-deadline-at="${esc(preparation.placementDeadlineAt||'')}">--:--</strong>
        </span>
      </header>
      <p class="bn-placement-instruction">${hint}</p>
      <div class="bn-placement-workspace">
        <div class="bn-placement-board-wrap board-wrap board-wrap-primary combat-board-wrap placement-board-wrap tp-board"
        aria-label="Tabuleiro para posicionamento da frota">
        <div class="tactical-board-frame setup-board-frame">
          ${renderBoard(mode, { ships:visibleShips, interactive: canManual&&chosenId!==null,skin })}
        </div>
      </div>
        <div class="bn-placement-side">
          <span class="bn-placement-fleet-label">Esquadra naval · ${ships.length}/${mode.fleet.length}</span>
          <section class="bn-placement-fleet" aria-label="Seleção de embarcações">
        ${cards}
      </section>
      <div class="bn-placement-tools" aria-label="Ferramentas de posicionamento">
        <button type="button" class="bn-placement-tool" data-action="rotate-placement"
          ${!canRotate?'disabled':''} aria-label="Girar embarcação selecionada" title="Girar (R) · ${orientation==='VERTICAL'?'Vertical':'Horizontal'}" aria-keyshortcuts="R">
          <span class="bn-placement-tool-icon">${iconRotate}</span><span>Girar <span class="bn-placement-orientation">(R)</span></span>
        </button>
        <button type="button" class="bn-placement-tool" data-action="random-placement"
          ${!editable?'disabled':''} aria-label="Gerar posições aleatórias">
          <span class="bn-placement-tool-icon">${iconRandom}</span><span>Aleatório</span>
        </button>
        <button type="button" class="bn-placement-tool" data-action="clear-draft"
          ${!editable||!ships.length?'disabled':''} aria-label="Limpar posições da frota">
          <span class="bn-placement-tool-icon">${iconClear}</span><span>Limpar</span>
        </button>
      </div>
      <p class="bn-placement-progress" role="status" aria-live="polite">
        ${preparation.fleetConfirmed ? 'Sua frota está confirmada' : progress}
        <span aria-hidden="true">·</span>
        ${preparation.opponentConfirmed ? 'Adversário confirmado' : 'Aguardando adversário'}
      </p>
      <div class="bn-placement-actions">
        <button type="button" class="bn-placement-confirm" data-action="confirm-placement"
          ${!editable||!complete||repositioning?'disabled':''}>
          ${preparation.fleetConfirmed ? 'Posições confirmadas' : 'Confirmar posições'}
        </button>
      </div>
        </div>
      </div>
    </main>
  </div>`;
}
