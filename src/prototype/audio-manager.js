/** Browser-independent audio catalog and playback coordinator.
 * No game rules or server requests; only confirmed presentation events.
 */
export const DEFAULT_PACK='sound_default';
export const EVENTS=Object.freeze({
  lobby:{channel:'music',loop:true}, battle_music:{channel:'music',loop:true},
  positioning_music:{channel:'music',loop:true}, victory_music:{channel:'music',loop:true}, defeat_music:{channel:'music',loop:true},
  waiting_radar:{channel:'effects',loop:true},
  match_start:{channel:'effects'}, shot:{channel:'effects'}, hit:{channel:'effects'},
  miss:{channel:'effects'}, ship_sunk:{channel:'effects'}, ship_sunk_enemy:{channel:'effects'}, ship_sunk_ally:{channel:'effects'}, victory:{channel:'effects'},
  defeat:{channel:'effects'}, ui_click:{channel:'effects'}, ui_transition:{channel:'effects'}, game_found:{channel:'effects'}, your_turn:{channel:'effects'},
  player_ready:{channel:'effects'}, ship_placement:{channel:'effects'},
  ability_activation:{channel:'effects'}, attack_blocked:{channel:'effects'},
  disconnect:{channel:'effects'}, reconnect:{channel:'effects'}, purchase_success:{channel:'effects'}
});
export function isSoundEvent(event) {
  return Object.hasOwn(EVENTS,event)||(/^ability_[a-z][a-z0-9-]*$/.test(event));
}
export function resolveSounds(packs,packId,event) {
  if(!isSoundEvent(event))return [];
  const candidates=[packs[packId]?.[event],packs[DEFAULT_PACK]?.[event]];
  if(event.startsWith('ability_')&&event!=='ability_activation')
    candidates.push(packs[packId]?.ability_activation,packs[DEFAULT_PACK]?.ability_activation);
  if(event==='ship_sunk_enemy'||event==='ship_sunk_ally')
    candidates.push(packs[packId]?.ship_sunk,packs[DEFAULT_PACK]?.ship_sunk);
  return [...new Set(candidates.filter(Boolean))];
}
export function sceneEvent(route,roomStatus,{battle,userId}={}) {
  if(route==='result'){
    if(battle?.status!=='FINISHED'||battle.winnerId==null||userId==null)return null;
    return battle.winnerId===userId?'victory_music':'defeat_music';
  }
  if(route==='match')return 'battle_music';
  if(route==='placement')return 'positioning_music';
  if(route==='matchmaking'&&roomStatus==='WAITING')return 'waiting_radar';
  if(['auth','register','lobby','store','fleet','profile','settings','matchmaking'].includes(route))return 'lobby';
  return null;
}
export class AudioManager {
  constructor({packs,createContext=()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)(),
    createMedia=()=>new Audio(),
    fetchAudio=async url=>{const r=await fetch(url);if(!r.ok)throw Error('Audio unavailable');return r.arrayBuffer();}}) {
    this.packs=packs;this.createContext=createContext;this.createMedia=createMedia;this.fetchAudio=fetchAudio;
    this.packId=DEFAULT_PACK;this.preferences={music:true,effects:true};this.scene=null;
    this.visible=true;this.unlocked=false;this.context=null;this.media=null;this.loopKey='';this.loopEpoch=0;
    this.effectSource=null;this.uiSource=null;this.uiEpoch=0;this.effectEpoch=0;this.queue=[];this.draining=false;
    this.effectBuffers=new Map();this.failed=new Set();
  }
  async unlock() {
    // Media play() starts synchronously in the trusted gesture, before any await.
    this.unlocked=true;this.refreshLoop();
    try {
      if(!this.context)this.context=this.createContext();
      if(this.context.state!=='running')await this.context.resume();
      this.refreshLoop();
    } catch { /* Unsupported or autoplay denied: gameplay remains usable. */ }
  }
  setState({packId=DEFAULT_PACK,preferences=this.preferences,scene=this.scene}={}) {
    const nextPack=Object.hasOwn(this.packs,packId)?packId:DEFAULT_PACK;
    const changedPack=nextPack!==this.packId;
    this.packId=nextPack;this.preferences={music:preferences.music!==false,effects:preferences.effects!==false};
    this.scene=scene;
    if(changedPack||!this.preferences.effects)this.stopEffects();
    this.refreshLoop();
  }
  setVisible(visible) {
    if(this.visible===visible)return;
    this.visible=visible;
    if(!visible)this.stopEffects();
    this.refreshLoop();
  }
  stopEffects() {
    this.effectEpoch++;this.queue.length=0;
    const source=this.effectSource;this.effectSource=null;
    if(source)try{source.stop();}catch{}
    this.uiEpoch++;
    if(this.uiSource)try{this.uiSource.stop();}catch{}
    this.uiSource=null;
  }
  stop() {
    this.scene=null;this.stopEffects();this.refreshLoop();
  }
  async load(url,cache) {
    if(this.failed.has(url))throw Error('Audio unavailable');
    if(cache&&this.effectBuffers.has(url))return this.effectBuffers.get(url);
    try {
      const buffer=await this.context.decodeAudioData(await this.fetchAudio(url));
      if(cache){
        if(this.effectBuffers.size>=24)this.effectBuffers.delete(this.effectBuffers.keys().next().value);
        this.effectBuffers.set(url,buffer);
      }
      return buffer;
    }catch(error){this.failed.add(url);throw error;}
  }
  async bufferFor(event,cache,packId=this.packId) {
    for(const url of resolveSounds(this.packs,packId,event)){
      try{return await this.load(url,cache);}catch{/* fallback to default */}
    }
    return null;
  }
  refreshLoop() {
    const event=this.scene,channel=EVENTS[event]?.channel;
    const paths=event?resolveSounds(this.packs,this.packId,event):[];
    const key=this.visible&&this.unlocked&&this.preferences[channel]&&paths.length
      ?event+':'+paths.join('|'):'';
    if(key===this.loopKey)return;
    this.loopKey=key;const epoch=++this.loopEpoch;
    // A single reusable streaming media element keeps long music out of decoded
    // Web Audio memory. Reusing it also helps with mobile autoplay policies.
    if(this.media){
      this.media.onerror=null;
      this.media.pause();
      this.media.removeAttribute('src');this.media.load();
    }
    if(!key)return;
    try{
      const media=this.media||(this.media=this.createMedia());
      media.preload='metadata';media.loop=true;media.volume=channel==='music'?0.45:0.30;
      let attempt=0;
      const tryNext=index=>{
        if(epoch!==this.loopEpoch)return;
        const token=++attempt;
        media.onerror=null;
        if(index>=paths.length){
          media.pause();media.removeAttribute('src');media.load();
          return;
        }
        const next=()=>{if(epoch===this.loopEpoch&&token===attempt)tryNext(index+1);};
        media.onerror=next;media.src=paths[index];
        try{
          Promise.resolve(media.play()).catch(error=>{
            if(epoch!==this.loopEpoch||token!==attempt)return;
            if(error?.name==='NotAllowedError'){
              // Do not fall through to another URL when user activation is missing.
              // Next genuine gesture can retry, without repeated render retries.
              this.loopKey='';this.unlocked=false;media.pause();
            }else next();
          });
        }catch{next();}
      };
      tryNext(0);
    }catch{/* Audio errors never block navigation. */}
  }
  play(event) {
    if(!this.visible||!this.preferences.effects||this.context?.state!=='running'||
       !isSoundEvent(event)||EVENTS[event]?.loop||!resolveSounds(this.packs,this.packId,event).length)return;
    if(event==='ui_click'||event==='ui_transition'){
      // Prefer the latest UI gesture. It must never delay the combat queue.
      const epoch=++this.uiEpoch;
      if(this.uiSource)try{this.uiSource.stop();}catch{}
      this.uiSource=null;
      void (async()=>{
        try{
          const buffer=await this.bufferFor(event,true);
          if(!buffer||epoch!==this.uiEpoch||!this.visible||!this.preferences.effects)return;
          const source=this.context.createBufferSource(),gain=this.context.createGain();
          source.buffer=buffer;gain.gain.value=0.45;source.connect(gain);gain.connect(this.context.destination);
          this.uiSource=source;source.onended=()=>{if(this.uiSource===source)this.uiSource=null;source.disconnect();gain.disconnect();};
          source.start();
        }catch{/* Non-critical UI cue */}
      })();
      return;
    }
    if(this.queue.length>=16)return;
    this.queue.push({event,packId:this.packId,epoch:this.effectEpoch});void this.drain();
  }
  async drain() {
    if(this.draining)return;
    this.draining=true;
    try {
      while(this.queue.length){
        const {event,packId,epoch}=this.queue.shift();
        const buffer=await this.bufferFor(event,true,packId);
        if(!buffer||epoch!==this.effectEpoch||!this.visible||!this.preferences.effects)continue;
        await new Promise(resolve=>{
          try{
            const source=this.context.createBufferSource();source.buffer=buffer;
            const gain=this.context.createGain();gain.gain.value=0.7;
            source.connect(gain);gain.connect(this.context.destination);
            this.effectSource=source;
            source.onended=()=>{if(this.effectSource===source)this.effectSource=null;source.disconnect();gain.disconnect();resolve();};
            source.start();
          }catch{resolve();}
        });
      }
    }finally{this.draining=false;}
  }
}
