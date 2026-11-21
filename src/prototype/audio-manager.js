/** Browser-independent audio catalog and playback coordinator.
 * No game rules or server requests; only confirmed presentation events.
 */
export const DEFAULT_PACK='sound_default';
export const EVENTS=Object.freeze({
  lobby:{channel:'music',loop:true}, battle_music:{channel:'music',loop:true},
  waiting_radar:{channel:'effects',loop:true},
  match_start:{channel:'effects'}, shot:{channel:'effects'}, hit:{channel:'effects'},
  miss:{channel:'effects'}, ship_sunk:{channel:'effects'}, victory:{channel:'effects'},
  defeat:{channel:'effects'}, ui_click:{channel:'effects'}, your_turn:{channel:'effects'},
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
  return [...new Set(candidates.filter(Boolean))];
}
export function sceneEvent(route,roomStatus) {
  if(route==='match')return 'battle_music';
  if(route==='placement'||(route==='matchmaking'&&roomStatus==='WAITING'))return 'waiting_radar';
  if(['auth','register','lobby','store','fleet','profile','settings','matchmaking'].includes(route))return 'lobby';
  return null;
}
export class AudioManager {
  constructor({packs,createContext=()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)(),
    fetchAudio=async url=>{const r=await fetch(url);if(!r.ok)throw Error('Audio unavailable');return r.arrayBuffer();}}) {
    this.packs=packs;this.createContext=createContext;this.fetchAudio=fetchAudio;
    this.packId=DEFAULT_PACK;this.preferences={music:true,effects:true};this.scene=null;
    this.visible=true;this.context=null;this.loopSource=null;this.loopKey='';this.loopEpoch=0;
    this.effectSource=null;this.effectEpoch=0;this.queue=[];this.draining=false;
    this.effectBuffers=new Map();this.failed=new Set();
  }
  async unlock() {
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
    const key=this.visible&&this.context?.state==='running'&&this.preferences[channel]&&paths.length
      ?event+':'+paths.join('|'):'';
    if(key===this.loopKey)return;
    this.loopKey=key;const epoch=++this.loopEpoch;
    if(this.loopSource){try{this.loopSource.stop();}catch{}this.loopSource=null;}
    if(!key)return;
    void (async()=>{
      try {
        const buffer=await this.bufferFor(event,false);
        if(!buffer||epoch!==this.loopEpoch)return;
        const source=this.context.createBufferSource();source.buffer=buffer;source.loop=true;
        const gain=this.context.createGain();gain.gain.value=channel==='music'?0.45:0.30;
        source.connect(gain);gain.connect(this.context.destination);source.onended=()=>{source.disconnect();gain.disconnect();};
        this.loopSource=source;source.start();
      }catch{/* Audio errors never block navigation. */}
    })();
  }
  play(event) {
    if(!this.visible||!this.preferences.effects||this.context?.state!=='running'||
       !isSoundEvent(event)||EVENTS[event]?.loop||!resolveSounds(this.packs,this.packId,event).length)return;
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
