import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AudioManager,EVENTS,isCustomizableSoundEvent,resolveSounds,sceneEvent} from '../src/prototype/audio-manager.js';
import {AudioEvents} from '../src/prototype/audio-events.js';
const packs={sound_default:{lobby:'default-lobby',shot:'default-shot',hit:'default-hit',ability_activation:'default-ability',waiting_radar:'default-radar',positioning_music:'default-positioning'},sound_sonar:{shot:'sonar-shot'}};
assert.deepEqual(resolveSounds(packs,'sound_sonar','shot'),['sonar-shot','default-shot']);
assert.deepEqual(resolveSounds(packs,'sound_sonar','hit'),['default-hit']);
assert.deepEqual(resolveSounds(packs,'sound_sonar','ability-radar'),[]);
assert.deepEqual(resolveSounds(packs,'sound_sonar','ability_radar'),['default-ability']);
assert.deepEqual(resolveSounds(packs,'unknown','hit'),['default-hit']);
// Commercial packs must never replace fixed events, even if a manifest
// or a caller directly supplies an otherwise valid audio file for them.
const commercial=['match_start','shot','hit','miss','ship_sunk_enemy','ship_sunk_ally','victory','defeat'];
assert.deepEqual(Object.keys(EVENTS).filter(isCustomizableSoundEvent).sort(),commercial.sort());
const completeDefault=Object.fromEntries(Object.keys(EVENTS).map(event=>[event,'default-'+event]));
const completePaid=Object.fromEntries(Object.keys(EVENTS).map(event=>[event,'paid-'+event]));
completeDefault.ability_radar='default-radar-ability';
completePaid.ability_radar='paid-radar-ability';
const full={sound_default:completeDefault,sound_sonar:completePaid};
for(const event of Object.keys(EVENTS)){
  const expected=commercial.includes(event)?['paid-'+event,'default-'+event]:['default-'+event];
  if(event==='ship_sunk_enemy'||event==='ship_sunk_ally')expected.push('default-ship_sunk');
  assert.deepEqual(resolveSounds(full,'sound_sonar',event),expected,event);
}
assert.deepEqual(resolveSounds(full,'sound_sonar','ability_radar'),['default-radar-ability','default-ability_activation']);
assert.equal(isCustomizableSoundEvent('ability_radar'),false);
assert.equal(isCustomizableSoundEvent('unknown'),false);
assert.deepEqual(resolveSounds({sound_default:{},sound_sonar:{match_start:'paid-start',ui_click:'paid-click'}},'sound_sonar','match_start'),['paid-start']);
assert.deepEqual(resolveSounds({sound_default:{},sound_sonar:{ui_click:'paid-click'}},'sound_sonar','ui_click'),[]);
assert.deepEqual(resolveSounds({sound_default:{ship_sunk:'default-generic'},sound_sonar:{ship_sunk:'paid-generic'}},'sound_sonar','ship_sunk_ally'),['default-generic']);
assert.equal(sceneEvent('store'),'lobby');
assert.equal(sceneEvent('matchmaking'),'lobby','Choice screen is not active search');
assert.equal(sceneEvent('matchmaking',null,{queueStatus:'SEARCHING'}),'waiting_radar');
assert.equal(sceneEvent('matchmaking','WAITING'),'positioning_music');
assert.equal(sceneEvent('matchmaking','WAITING',{queueStatus:'SEARCHING'}),'positioning_music','Room takes precedence over stale queue');
assert.equal(sceneEvent('matchmaking','PREPARING'),'positioning_music');
assert.equal(sceneEvent('matchmaking',null,{queueStatus:'IDLE'}),'lobby');
assert.equal(sceneEvent('match'),'battle_music');
assert.equal(sceneEvent('placement','PREPARING'),'positioning_music');
assert.equal(sceneEvent('result'),null);
assert.equal(sceneEvent('result','FINISHED',{battle:{status:'FINISHED',winnerId:1},userId:1}),'victory_music');
assert.equal(sceneEvent('result','FINISHED',{battle:{status:'FINISHED',winnerId:1},userId:2}),'defeat_music');
const p=1,room=(status,revision)=>({code:'ABC',status,revision,players:[{id:p,ready:false,connected:true},{id:2,ready:false,connected:true}]});
const base={matchId:'m',status:'PLAYING',revision:1,turnPlayerId:p,shotsFired:[],shotsReceived:[],yourAbilities:[{id:'radar',usesRemaining:1}]};
const tracker=new AudioEvents();
const readyTracker=new AudioEvents();
readyTracker.update({room:room('WAITING',1),battle:null,userId:p});
const readyRoom=room('PREPARING',2);readyRoom.players[0].ready=true;
assert.deepEqual(readyTracker.update({room:readyRoom,battle:null,userId:p}),['player_ready']);
assert.deepEqual(readyTracker.update({room:readyRoom,battle:{status:'PLAYING'},userId:p}),[]);
assert.deepEqual(tracker.update({room:room('PREPARING',1),battle:null,userId:p}),[]);
assert.deepEqual(tracker.update({room:room('PLAYING',2),battle:base,userId:p}),['match_start']);
const next={...base,revision:2,turnPlayerId:2,shotsFired:[{row:0,col:0,hit:true,sunkShip:'DESTROYER'}]};
assert.deepEqual(tracker.update({room:room('PLAYING',2),battle:next,userId:p}),['shot','hit','ship_sunk_enemy']);
assert.deepEqual(tracker.update({room:room('PLAYING',2),battle:next,userId:p}),[]);
assert.deepEqual(tracker.update({room:room('PLAYING',2),battle:base,userId:p}),[]);
const next2={...next,revision:3,turnPlayerId:p,shotsReceived:[{row:1,col:1,hit:false,blocked:true}]};
assert.deepEqual(tracker.update({room:room('PLAYING',2),battle:next2,userId:p}),['shot','attack_blocked','your_turn']);
const next3={...next2,revision:4,turnPlayerId:2,yourAbilities:[{id:'radar',usesRemaining:0}]};
assert.deepEqual(tracker.update({room:room('PLAYING',2),battle:next3,userId:p}),['ability_radar']);
const ally={...next3,revision:5,turnPlayerId:p,shotsReceived:[...next3.shotsReceived,{row:2,col:2,hit:true,sunkShip:'DESTROYER'}]};
assert.deepEqual(tracker.update({room:room('PLAYING',2),battle:ally,userId:p}),['shot','hit','ship_sunk_ally','your_turn']);
const finished={...ally,revision:7,status:'FINISHED',winnerId:p};
assert.deepEqual(tracker.update({room:room('FINISHED',3),battle:finished,userId:p}),['victory']);
assert.deepEqual(tracker.update({room:room('FINISHED',3),battle:finished,userId:p}),[]);
tracker.reset();
assert.deepEqual(tracker.update({room:room('FINISHED',3),battle:finished,userId:p}),[]);
const foundTracker=new AudioEvents();
const waiting=room('WAITING',1);waiting.players.pop();
foundTracker.update({room:waiting,battle:null,userId:p});
assert.deepEqual(foundTracker.update({room:room('WAITING',2),battle:null,userId:p}),[],'Private host does not receive a second sonar-like found cue');
assert.deepEqual(foundTracker.update({room:room('WAITING',2),battle:null,userId:p}),[]);
const publicRoom={...room('WAITING',1),code:'PUBLIC',publicMatch:true};
foundTracker.update({room:null,battle:null,userId:p});
assert.deepEqual(foundTracker.update({room:publicRoom,battle:null,userId:p}),['game_found']);
assert.deepEqual(foundTracker.update({room:publicRoom,battle:null,userId:p}),[]);
assert.deepEqual(foundTracker.update({room:{...publicRoom,status:'PREPARING',revision:2},battle:null,userId:p}),[]);
const restored=new AudioEvents();
assert.deepEqual(restored.update({room:publicRoom,battle:null,userId:p}),[],'Restored session must not replay found cue');
const started=[],stopped=[],fetched=[];
const fake={
 state:'suspended',destination:{},async resume(){this.state='running';},async decodeAudioData(data){return data;},
 createGain(){return {gain:{value:0},connect(){},disconnect(){}};},
 createBufferSource(){return {buffer:null,loop:false,connect(){},disconnect(){},
 start(){started.push(this.buffer);if(!this.loop)queueMicrotask(()=>this.onended?.());},
 stop(){stopped.push(this.buffer);this.onended?.();}};}
};
const media={src:'',loop:false,volume:0,paused:true,async play(){this.paused=false;started.push(this.src);},pause(){if(!this.paused)stopped.push(this.src);this.paused=true;},removeAttribute(){this.src='';},load(){}};
const manager=new AudioManager({packs,createMedia:()=>media,createContext:()=>fake,fetchAudio:async url=>{fetched.push(url);if(url==='sonar-shot')throw Error('missing');return url;}});
const settle=()=>new Promise(resolve=>setImmediate(resolve));
manager.setState({scene:'lobby',preferences:{music:true,effects:true},packId:'sound_sonar'});
assert.deepEqual(started,[]);
await manager.unlock();await settle();
assert.deepEqual(started,['default-lobby']);
manager.setState({scene:'lobby',preferences:{music:true,effects:true},packId:'sound_sonar'});await settle();
assert.deepEqual(started,['default-lobby']);
manager.play('shot');manager.play('hit');await settle();
assert.deepEqual(started,['default-lobby','default-shot','default-hit']);
assert.ok(fetched.includes('sonar-shot'));
manager.setState({scene:'waiting_radar',preferences:{music:false,effects:true},packId:'sound_sonar'});await settle();
assert.equal(started.at(-1),'default-radar');
assert.ok(stopped.includes('default-lobby'));
manager.setState({scene:'waiting_radar',preferences:{music:false,effects:false}});manager.play('hit');await settle();
assert.ok(stopped.includes('default-radar'));
assert.equal(started.filter(x=>x==='default-hit').length,1);
manager.setState({scene:'lobby',preferences:{music:true,effects:true}});await settle();
manager.setVisible(false);manager.play('shot');await settle();
assert.equal(started.filter(x=>x==='default-shot').length,1);
assert.equal(media.paused,true);
assert.equal(media.src,'');
assert.ok(!fetched.includes('default-lobby'),'Music must stream, not decode into effect cache');
// One streaming element and no restart when a second player joins or both ready.
manager.setVisible(true);
const begin=started.length;
const stoppedAt=stopped.length;
const scene=(route,status,queueStatus)=>manager.setState({scene:sceneEvent(route,status,{queueStatus}),preferences:{music:true,effects:true}});
scene('matchmaking',null,'SEARCHING');
assert.equal(media.src,'default-radar');
scene('matchmaking',null,'SEARCHING');
scene('matchmaking','WAITING');
assert.equal(media.src,'default-positioning');
assert.equal(media.paused,false);
scene('matchmaking','WAITING');
scene('matchmaking','PREPARING');
scene('placement','PREPARING');
await settle();
assert.deepEqual(started.slice(begin),['default-radar','default-positioning']);
assert.deepEqual(stopped.slice(stoppedAt),['default-lobby','default-radar']);
scene('lobby');
assert.equal(media.src,'default-lobby');
scene('matchmaking','WAITING');
assert.equal(media.src,'default-positioning','Private room starts preparation music immediately');
scene('matchmaking','WAITING');
assert.equal(started.filter(x=>x==='default-radar').length,2,'No radar in private room');
manager.stop();

const dir=new URL('../src/assets/audio/default/',import.meta.url);
const official=JSON.parse(readFileSync(new URL('manifest.json',dir),'utf8'));
for(const event of ['lobby','positioning_music','battle_music','victory_music','defeat_music','waiting_radar','hit','miss','ship_sunk_enemy','ship_sunk_ally','game_found','ui_click','ui_transition','victory','defeat']){
 const bytes=readFileSync(new URL(official.sounds[event],dir));
 assert.equal(bytes.subarray(0,4).toString(),'OggS',event+' is OGG');
 assert.ok(bytes.subarray(0,100).includes(Buffer.from('vorbis')),event+' is Vorbis');
}
console.log('Audio: fallback, snapshots, revision gaps, mute, loops and visibility OK');

// The approved retro clips are exact Git blobs, not substitute recordings.
const retroManifest=JSON.parse(readFileSync(new URL('../src/assets/audio/sonar/manifest.json',import.meta.url),'utf8'));
assert.equal(retroManifest.id,'sound_sonar');
assert.deepEqual(Object.keys(retroManifest.sounds).sort(),['hit','miss','ship_sunk_ally','ship_sunk_enemy']);
for(const [event,file] of Object.entries(retroManifest.sounds)){
 assert.ok(isCustomizableSoundEvent(event));
 const bytes=readFileSync(new URL('../src/assets/audio/sonar/'+file,import.meta.url));
 assert.equal(bytes.subarray(0,4).toString(),'OggS');
 assert.ok(bytes.length>10000);
}

// Approved Pirate V3: all six exact OGG blobs, with fixed music/UI fallback.
const pirateDir=new URL('../src/assets/audio/pirate/',import.meta.url);
const pirateManifest=JSON.parse(readFileSync(new URL('manifest.json',pirateDir),'utf8'));
assert.equal(pirateManifest.id,'sound_pirate');
assert.deepEqual(Object.keys(pirateManifest.sounds).sort(),['hit','miss','ship_sunk_ally','ship_sunk_enemy','shot','victory']);
const {createHash}=await import('node:crypto');
const approved={"miss":"1484856aa8116ee22049e1e0a2faf5b688d72480","hit":"f4d02266e06831633ca2c443e710731c7658ceee","ship_sunk_ally":"ba48805f53d8b44b0ae9b388da4b1e54be44227c","ship_sunk_enemy":"e8259d445648f09f02c9d709b4542366e424a864","shot":"583fa560dfc488b79aaeb6427fb475f112426d1e","victory":"b29053a02d4ecbf8e5670f838add99f86fce6bf6"};
for(const [event,file] of Object.entries(pirateManifest.sounds)){
 assert.ok(isCustomizableSoundEvent(event));
 const bytes=readFileSync(new URL(file,pirateDir));
 assert.equal(bytes.subarray(0,4).toString(),'OggS');
 assert.ok(bytes.subarray(0,100).includes(Buffer.from('vorbis')));
 assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),approved[event]);
}
const piratePacks={sound_default:completeDefault,sound_pirate:pirateManifest.sounds};
for(const event of Object.keys(EVENTS)){
 const expected=[pirateManifest.sounds[event],completeDefault[event]].filter(Boolean);
 if(event==='ship_sunk_ally'||event==='ship_sunk_enemy')expected.push('default-ship_sunk');
 assert.deepEqual(resolveSounds(piratePacks,'sound_pirate',event),expected);
}
