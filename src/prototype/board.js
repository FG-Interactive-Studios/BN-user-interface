/** Renders only the cells and polygons described by the selected server mode. */
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export { esc };
export const shipName = (type) => ({CARRIER:'Porta-aviões',BATTLESHIP:'Encouraçado',CRUISER:'Cruzador',SUBMARINE:'Submarino',DESTROYER:'Contratorpedeiro'})[type] || String(type).replace(/_/g, ' ');
export const coordLabel = ({ row, col }) => `${String.fromCharCode(65 + (row % 26))}${col + 1}`;
export const keyOf = ({row,col}) => `${row},${col}`;

export function occupiedCells(ships, mode) {
  const cells = new Set();
  for (const ship of ships || []) {
    const length = mode?.fleet?.find(s => s.id === ship.type)?.length || 1;
    let delta = [0, 1];
    switch (ship.orientation) {
      case 'VERTICAL': case 'HEX_VERTICAL': delta = [1,0]; break;
      case 'TRI_DOWN_LEFT': delta = null; break;
      case 'TRI_DOWN_RIGHT': delta = null; break;
      case 'HEX_DIAGONAL_DOWN': delta = [0,1]; break;
      case 'HEX_DIAGONAL_UP': delta = [-1,1]; break;
      case 'TRI_RIGHT': case 'HORIZONTAL': delta = [0,1]; break;
    }
    if (ship.orientation?.startsWith('TRI_')) {
      let r=ship.row,c=ship.col;
      for (let n=0;n<length;n++) {
        cells.add(`${r},${c}`);
        const upward=c%2===0;
        if(ship.orientation==='TRI_RIGHT') c+=1;
        else if(ship.orientation==='TRI_DOWN_RIGHT') {if(upward){r+=1;c+=1;} else c+=1;}
        else if(ship.orientation==='TRI_DOWN_LEFT') {if(upward){r+=1;c+=1;} else c-=1;}
      }
    } else { for (let n=0; n<length; n++) cells.add(`${ship.row + delta[0]*n},${ship.col + delta[1]*n}`); }
  }
  return cells;
}

export function renderBoard(mode, { ships=[], hits=[], misses=[], selected=null, interactive=false, small=false }={}) {
  const geometry = mode?.geometry;
  if (!geometry?.cells?.length) return '<p class="muted">Tabuleiro indisponível.</p>';
  const own = occupiedCells(ships, mode);
  const hitSet = new Set(hits.map(keyOf)); const missSet = new Set(misses.map(keyOf));
  const selectedKey = selected ? keyOf(selected) : '';
  const isRegular = geometry.kind === 'RECTANGULAR' && geometry.rows === geometry.columns && geometry.cells.length === geometry.rows * geometry.columns;
  if (isRegular) {
    const size = geometry.rows;
    const coords = new Set(geometry.cells.map(keyOf));
    let html = `<div class="board board-${small?'preview':'main'}" style="--size:${size}"><div></div>`;
    for (let c=1;c<=size;c++) html += `<div class="coord">${c}</div>`;
    for (let row=0;row<size;row++) {
      html += `<div class="coord">${String.fromCharCode(65+row)}</div>`;
      for (let col=0;col<size;col++) {
        const key=`${row},${col}`; const cell={row,col};
        if (!coords.has(key)) { html+='<span class="cell inactive"></span>'; continue; }
        const hit=hitSet.has(key),miss=missSet.has(key);
        const cls=['cell',own.has(key)?'ship':'',hit?'hit':'',miss?'miss':'',selectedKey===key?'target':''].filter(Boolean).join(' ');
        const allowed=interactive && !hit && !miss;
        html += `<button type="button" class="${cls}" ${allowed?`data-coord="${key}"`: 'disabled'} aria-label="${coordLabel(cell)}${hit?', acerto':miss?', água':''}" title="${coordLabel(cell)}">${selectedKey===key?'<span class="target-reticle" aria-hidden="true"><i></i></span>':''}</button>`;
      }
    }
    return html+'</div>';
  }
  // Polygon geometries (triangle tiles and hexagons) are supplied by the API.
  const tiles = geometry.tiles || [];
  if (!tiles.length) return '<p class="muted">A API não informou os polígonos deste tabuleiro.</p>';
  const vertices=tiles.flatMap(tile=>tile.vertices||[]);
  const minX=Math.min(...vertices.map(p=>p.x)),maxX=Math.max(...vertices.map(p=>p.x));
  const minY=Math.min(...vertices.map(p=>p.y)),maxY=Math.max(...vertices.map(p=>p.y));
  const pad=0.4;
  const width=Math.max(maxX-minX,1)+pad*2,height=Math.max(maxY-minY,1)+pad*2;
  return `<svg class="tide-polygon-board ${small?'small':''}" viewBox="${minX-pad} ${minY-pad} ${width} ${height}" role="group" aria-label="Tabuleiro ${esc(mode.name)}">${tiles.map(tile=>{
    const k=keyOf(tile.cell);const hit=hitSet.has(k),miss=missSet.has(k),target=selectedKey===k;
    const cls=['tile',own.has(k)?'ship':'',hit?'hit':'',miss?'miss':'',target?'target':''].filter(Boolean).join(' ');
    const points=tile.vertices.map(p=>`${p.x},${p.y}`).join(' ');
    const cx=tile.vertices.reduce((sum,p)=>sum+p.x,0)/tile.vertices.length;
    const cy=tile.vertices.reduce((sum,p)=>sum+p.y,0)/tile.vertices.length;
    const enabled=interactive&&!hit&&!miss;
    return `<g class="${cls}" ${enabled?`data-coord="${k}" tabindex="0" role="button"`:'role="img"'} aria-label="${coordLabel(tile.cell)}"><polygon points="${points}"/><title>${coordLabel(tile.cell)}</title>${hit||miss||target?`<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="0.55" pointer-events="none">${hit?'×':miss?'•':'◎'}</text>`:''}</g>`;
  }).join('')}</svg>`;
}
