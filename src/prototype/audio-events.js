/** Derive presentation events only from accepted personalized snapshots.
 * No old shots on reconnect or repeated REST/WS updates. The server keeps the
 * latest result per coordinate; repeated identical blocked attempts cannot be
 * distinguished until the API provides a separate action/event history.
 */
const shotKey=s=>s.row+','+s.col;
const sameShot=(a,b)=>a&&a.hit===b.hit&&Boolean(a.blocked)===Boolean(b.blocked)&&a.sunkShip===b.sunkShip;
function changedShots(before,after) {
  const old=new Map((before||[]).map(s=>[shotKey(s),s]));
  return (after||[]).filter(s=>!sameShot(old.get(shotKey(s)),s));
}
export class AudioEvents {
  constructor(){this.reset();}
  reset(){this.room=null;this.battle=null;this.userId=null;}
  update({room,battle,userId}) {
    const out=[];
    if(userId==null){this.reset();return out;}
    const sameUser=this.userId===userId;
    if(!sameUser){this.reset();this.userId=userId;}
    const prevRoom=this.room;
    if(room&&prevRoom?.code===room.code&&Number(room.revision)<Number(prevRoom.revision))return out;
    // The found cue is for automatic pairing, not private code invitations.
    // Derive it once from the accepted snapshot rather than both HTTP actions
    // and realtime reconciliation. Do not replay when restoring a session.
    if(sameUser&&room?.publicMatch===true&&['WAITING','PREPARING'].includes(room.status)&&
      (room.players||[]).length>=2&&(prevRoom?.code!==room.code||
        (prevRoom.status==='WAITING'&&(prevRoom.players||[]).length<2)))out.push('game_found');
    if(room&&prevRoom?.code===room.code){
      for(const p of room.players||[]){
        const previous=prevRoom.players?.find(x=>x.id===p.id);
        if(!previous)continue;
        if(prevRoom.status==='WAITING'&&['WAITING','PREPARING'].includes(room.status)&&p.ready===true&&previous.ready===false)out.push('player_ready');
        if(p.id!==userId&&['PREPARING','PLAYING'].includes(room.status)){
          if(previous.connected===true&&p.connected===false)out.push('disconnect');
          if(previous.connected===false&&p.connected===true)out.push('reconnect');
        }
      }
    }
    this.room=room;
    if(!battle){if(!room||!['PLAYING','FINISHED'].includes(room.status))this.battle=null;return out;}
    if(battle.matchId==null||!Number.isFinite(Number(battle.revision)))return out;
    const old=this.battle;
    if(!old||old.matchId!==battle.matchId){
      this.battle=battle;
      if(prevRoom?.code===room?.code&&prevRoom?.status==='PREPARING'&&battle.status==='PLAYING')out.push('match_start');
      return out;
    }
    if(Number(battle.revision)<=Number(old.revision))return out;
    this.battle=battle;
    // Skip missed transient history after a revision gap; final outcome is still meaningful.
    if(Number(battle.revision)===Number(old.revision)+1){
      const ability=(battle.yourAbilities||[]).find(a=>{
        const before=old.yourAbilities?.find(x=>x.id===a.id);
        return before&&a.usesRemaining<before.usesRemaining;
      });
      if(ability)out.push('ability_'+ability.id);
      const fired=changedShots(old.shotsFired,battle.shotsFired);
      const received=changedShots(old.shotsReceived,battle.shotsReceived);
      const shots=[...fired,...received];
      if(shots.length){
        out.push('shot');
        if(shots.some(s=>s.blocked))out.push('attack_blocked');
        if(shots.some(s=>!s.blocked&&s.hit))out.push('hit');
        if(shots.some(s=>!s.blocked&&!s.hit))out.push('miss');
        if(fired.some(s=>!s.blocked&&s.sunkShip))out.push('ship_sunk_enemy');
        if(received.some(s=>!s.blocked&&s.sunkShip))out.push('ship_sunk_ally');
      }
      if(battle.status==='PLAYING'&&battle.turnPlayerId===userId&&old.turnPlayerId!==userId)out.push('your_turn');
    }
    if(old.status!=='FINISHED'&&battle.status==='FINISHED'&&battle.winnerId!=null)
      out.push(battle.winnerId===userId?'victory':'defeat');
    return out;
  }
}
