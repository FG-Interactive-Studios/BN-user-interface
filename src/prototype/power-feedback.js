/** Current server rules: Radar and Double Shot are free; other powers cost one point.
 * Preserve server order within each cost group. Never infer availability from cost. */
export function powerCost(ability){return ['radar','double-shot'].includes(ability.id)?0:1;}
export function orderedPowers(abilities=[]){return [...abilities].sort((a,b)=>powerCost(a)-powerCost(b));}
export function powerCostLabel(ability){return powerCost(ability)===0?'Grátis':'1 ponto';}

/** Compare accepted, personalized snapshots, including multi-shot revision gaps.
 * Paid attacks may earn points and spend one in the same action, so include
 * consumed paid uses when the server exposes its timed point system. */
export function gainedPowerPoints(before,after){
  if(!before||!after||before.matchId==null||before.matchId!==after.matchId||
      Number(after.revision)<=Number(before.revision)||after.status!=='PLAYING')return 0;
  const a=before.yourAbilityPointsEarned,b=after.yourAbilityPointsEarned;
  if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0)return 0;
  const timed=Boolean(after.yourAbilityPointCells?.length||before.yourAbilityPointCells?.length||a||b);
  const spent=timed?(after.yourAbilities||[]).reduce((sum,ability)=>{
    const old=before.yourAbilities?.find(x=>x.id===ability.id);
    return sum+(old?Math.max(0,old.usesRemaining-ability.usesRemaining)*powerCost(ability):0);
  },0):0;
  return Math.max(0,b-a+spent);
}
