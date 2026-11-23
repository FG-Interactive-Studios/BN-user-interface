import { occupiedCells, keyOf } from './board.js';

/** Display-only footprints and server-compatible targets from a single anchor.
 * Mechanics follow SquareAbilityRule (square-pilot-v1). No enemy ships inspected.
 */
export const ABILITY_DIRECTIONS=['RIGHT','DOWN','LEFT','UP'];
const steps={RIGHT:[0,1],DOWN:[1,0],LEFT:[0,-1],UP:[-1,0]};
const cell=(row,col)=>({row,col});
const unique=xs=>[...new Map(xs.map(p=>[keyOf(p),p])).values()];
const invalid=reason=>({valid:false,reason,targets:[],affected:[],origin:[],destination:[]});
const accepted=(targets,affected,origin=[],destination=[])=>({valid:true,reason:'',targets,affected:unique(affected),origin,destination});
export const abilityNeedsDirection=id=>id==='line-barrage'||id==='air-strike'||id==='retreat';
export const directionText=(id,direction)=>id==='line-barrage'
  ? (direction==='DOWN'||direction==='UP'?'Vertical ↕':'Horizontal ↔')
  : id==='air-strike'
    ? ({RIGHT:'Sudeste ↘',DOWN:'Sudoeste ↙',LEFT:'Noroeste ↖',UP:'Nordeste ↗'}[direction]||'Sudeste ↘')
    : ({RIGHT:'Direita →',DOWN:'Baixo ↓',LEFT:'Esquerda ←',UP:'Cima ↑'}[direction]||'Direita →');

export function planAbility({ability,anchor,mode,battle,direction='RIGHT',selectedTargets=[]}){
  if(!ability||!mode?.geometry?.cells?.length||!battle)return invalid('Dados da batalha indisponíveis.');
  const valid=new Set(mode.geometry.cells.map(keyOf));
  const inside=p=>valid.has(keyOf(p));
  const enemyShots=new Set((battle.shotsFired||[]).filter(s=>!s.blocked).map(keyOf));
  const ownShots=new Set((battle.shotsReceived||[]).filter(s=>!s.blocked).map(keyOf));
  const shot=ability.targetScope==='OWN'?ownShots:enemyShots;
  const free=p=>inside(p)&&!shot.has(keyOf(p));
  const count=Number(ability.targetCount)||0;
  if(count===0)return accepted([],[]);
  if(!anchor||!inside(anchor))return invalid('Escolha uma casa válida.');
  if(ability.targetScope==='ENEMY'&&!free(anchor))return invalid('Escolha uma casa não atingida.');
  const move=(p,d,n=1)=>cell(p.row+steps[d][0]*n,p.col+steps[d][1]*n);
  const footprint=ship=>[...occupiedCells([ship],mode)].map(s=>{const [row,col]=s.split(',').map(Number);return cell(row,col);});
  switch(ability.id){
    case 'radar':{
      const area=[];
      for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
        const p=cell(anchor.row+dr,anchor.col+dc);if(inside(p))area.push(p);
      }
      return accepted([anchor],area);
    }
    case 'air-strike':{
      // Backend always expects the TOP-LEFT of the 2x2 area.
      // Rotation changes which quadrant surrounds the clicked anchor, not server mechanics.
      const shifts={RIGHT:[0,0],DOWN:[0,-1],LEFT:[-1,-1],UP:[-1,0]};
      const [dr,dc]=shifts[direction]||shifts.RIGHT;
      const topLeft=cell(anchor.row+dr,anchor.col+dc);
      const area=[topLeft,cell(topLeft.row,topLeft.col+1),
        cell(topLeft.row+1,topLeft.col),cell(topLeft.row+1,topLeft.col+1)];
      return area.every(inside)?accepted([topLeft],area):invalid('Gire o ataque para manter a área de 2×2 dentro do tabuleiro.');
    }
    case 'double-shot':{
      // Unlike line/area powers, the API allows TWO distinct arbitrary enemy cells.
      // The second click is a real player choice, never fabricated by the frontend.
      const first=selectedTargets.length===1?selectedTargets[0]:null;
      if(!first)return accepted([anchor],[anchor]);
      if(!free(first))return invalid('A primeira casa já foi atingida. Selecione outra.');
      if(keyOf(first)===keyOf(anchor))return invalid('A segunda casa precisa ser diferente da primeira.');
      return accepted([first,anchor],[first,anchor]);
    }
    case 'line-barrage':{
      const order=direction==='DOWN'||direction==='UP'?['DOWN','UP']:['RIGHT','LEFT'];
      const end=order.map(d=>move(anchor,d,2)).find(free);
      if(!end)return invalid('A linha de três casas não cabe nessa direção.');
      const mid=cell((anchor.row+end.row)/2,(anchor.col+end.col)/2);
      return inside(mid)?accepted([anchor,end],[anchor,mid,end]):invalid('Linha fora do tabuleiro.');
    }
    case 'hull-shield':{
      const ship=(battle.yourShips||[]).find(s=>occupiedCells([s],mode).has(keyOf(anchor)));
      if(!ship)return invalid('Selecione uma casa ocupada por um navio seu.');
      const area=footprint(ship);
      if(area.some(p=>ownShots.has(keyOf(p))))return invalid('Somente navios intactos podem receber escudo.');
      return accepted([anchor],area);
    }
    case 'retreat':{
      const ships=battle.yourShips||[];
      const ship=ships.find(s=>occupiedCells([s],mode).has(keyOf(anchor)));
      if(!ship)return invalid('Selecione o navio que será movido.');
      const origin=footprint(ship);
      if(origin.some(p=>ownShots.has(keyOf(p))))return invalid('Navios danificados não podem recuar.');
      const blocked=occupiedCells(ships.filter(s=>s!==ship),mode);
      const order=[direction,...ABILITY_DIRECTIONS.filter(d=>d!==direction)];
      for(const d of order){
        const from=cell(ship.row,ship.col),to=move(from,d);
        const future=footprint({...ship,row:to.row,col:to.col});
        if(future.length===origin.length&&future.every(p=>inside(p)&&!blocked.has(keyOf(p))&&!ownShots.has(keyOf(p))))
          return accepted([from,to],[...origin,...future],origin,future);
      }
      return invalid('Não há um deslocamento adjacente válido.');
    }
    default:
      if(count===1)return accepted([anchor],[anchor]);
      return invalid('Esse poder ainda não permite seleção automática.');
  }
}
