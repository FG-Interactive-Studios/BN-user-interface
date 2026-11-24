import {GD_ASSETS} from './gd-assets.js';
export const DEFAULT_SHIP_ART=Object.freeze({CARRIER:'/assets/bn-zip/ship-carrier.webp',DESTROYER:'/assets/bn-zip/ship-destroyer-gd.webp'});
const lookup=(obj,key)=>Object.hasOwn(obj,key)?obj[key]:null;
export function shipArt(id,skin,state='intact'){
 if(skin===undefined)return lookup(DEFAULT_SHIP_ART,id);
 const pack=lookup(GD_ASSETS.fleets,skin)||GD_ASSETS.fleets.skin_default;
 const ship=lookup(pack,id);
 return ship&&['intact','sunk'].includes(state)?ship[state]:null;
}
export function captainArt(id,state='neutral'){
 const pack=lookup(GD_ASSETS.captains,id)||GD_ASSETS.captains.captain_default;
 return lookup(pack,state)||pack.neutral;
}
export function coverArt(id){return lookup(GD_ASSETS.covers,id);}
export function isOfficialFleet(id){return Object.hasOwn(GD_ASSETS.fleets,id);}
export function isOfficialCaptain(id){return Object.hasOwn(GD_ASSETS.captains,id);}
export function equippedId(items,category,fallback){
 return (items||[]).find(i=>i.category===category&&i.owned&&i.equipped&&i.enabled)?.id||fallback;
}
// Only observed shots, never placement or information from the opponent's hidden fleet.
export function captainMoods(battle,previous){
 if(!battle||battle.matchId!==previous?.matchId||battle.revision!==previous.revision+1)return {mine:'neutral',rival:'neutral'};
 const newHit=(a,b)=>{const old=new Map((a||[]).map(s=>[s.row+','+s.col,s]));return (b||[]).some(s=>s.hit&&!s.blocked&&(!old.get(s.row+','+s.col)?.hit||old.get(s.row+','+s.col)?.blocked));};
 const fired=newHit(previous.shotsFired,battle.shotsFired),received=newHit(previous.shotsReceived,battle.shotsReceived);
 return {mine:fired?'hit':received?'damage':'neutral',rival:received?'hit':fired?'damage':'neutral'};
}
