import assert from 'node:assert/strict';
import {AudioManager,resolveSounds,sceneEvent} from '../src/prototype/audio-manager.js';
import {AudioEvents} from '../src/prototype/audio-events.js';
const packs={sound_default:{lobby:'default-lobby',shot:'default-shot',hit:'default-hit',ability_activation:'default-ability',waiting_radar:'default-radar'},sound_sonar:{shot:'sonar-shot'}};
assert.deepEqual(resolveSounds(packs,'sound_sonar','shot'),['sonar-shot','default-shot']);
assert.deepEqual(resolveSounds(packs,'sound_sonar','hit'),['default-hit']);
assert.deepEqual(resolveSounds(packs,'sound_sonar','ability-radar'),[]);
assert.deepEqual(resolveSounds(packs,'sound_sonar','ability_radar'),['default-ability']);
assert.deepEqual(resolveSounds(packs,'unknown','hit'),['default-hit']);
assert.equal(sceneEvent('store'),'lobby');
assert.equal(sceneEvent('matchmaking','WAITING'),'waiting_radar');
assert.equal(sceneEvent('match'),'battle_music');
assert.equal(sceneEvent('result'),null);
const p=1,room=(status,revision)=>({code:'ABC',status,revision,players:[{id:p,ready:false,connected:true},{id:2,ready:false,connected:true}]});
const base={matchId:'m',status:'PLAYING',revision:1,turnPlayerId:p,shotsFired:[],shotsReceived:[],yourAbilities:[{id:'radar',usesRemaining:1}]};
const tracker=new AudioEvents();
assert.deepEqual(tracker.update({room:room('PREPARING',1),battle:null,userId:p}),[]);
assert.deepEqual(tracker.update({room:room('PLAYING',2),battle:base,userId:p}),['match_start']);
const next={...base,revision:2,turnPlayerId:2,shotsFired:[{row:0,col:0,hit:true,sunkShip:'DESTROYER'}]};
assert.deepEqual(tracker.update({room:room('PLAYING',2),battle:next,userId:p}),['shot','hit','ship_sunk']);
assert.deepEqual(tracker.update({room:room('PLAYING',2),battle:next,userId:p}),[]);
assert.deepEqual(tracker.update({room:room('PLAYING',2),battle:base,userId:p}),[]);
const next2={...next,revision:3,turnPlayerId:p,shotsReceived:[{row:1,col:1,hit:false,blocked:true}]};
assert.deepEqual(tracker.update({room:room('PLAYING',2),battle:next2,userId:p}),['shot','attack_blocked','your_turn']);
const next3={...next2,revision:4,turnPlayerId:2,yourAbilities:[{id:'radar',usesRemaining:0}]};
assert.deepEqual(tracker.update({room:room('PLAYING',2),battle:next3,userId:p}),['ability_radar']);
const finished={...next3,revision:7,status:'FINISHED',winnerId:p};
assert.deepEqual(tracker.update({room:room('FINISHED',3),battle:finished,userId:p}),['victory']);
assert.deepEqual(tracker.update({room:room('FINISHED',3),battle:finished,userId:p}),[]);
tracker.reset();
assert.deepEqual(tracker.update({room:room('FINISHED',3),battle:finished,userId:p}),[]);
const started=[],stopped=[],fetched=[];
const fake={
 state:'suspended',destination:{},async resume(){this.state='running';},async decodeAudioData(data){return data;},
 createGain(){return {gain:{value:0},connect(){},disconnect(){}};},
 createBufferSource(){return {buffer:null,loop:false,connect(){},disconnect(){},
 start(){started.push(this.buffer);if(!this.loop)queueMicrotask(()=>this.onended?.());},
 stop(){stopped.push(this.buffer);this.onended?.();}};}
};
const manager=new AudioManager({packs,createContext:()=>fake,fetchAudio:async url=>{fetched.push(url);if(url==='sonar-shot')throw Error('missing');return url;}});
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
assert.equal(manager.loopSource,null);
console.log('Audio: fallback, snapshots, revision gaps, mute, loops and visibility OK');
