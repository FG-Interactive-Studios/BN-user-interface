import assert from 'node:assert/strict';
import {buildMatchReport,ridiculousAward,reportStats} from '../src/prototype/match-report.js';
import {REACTIONS,funnyReaction} from '../src/prototype/chaos-humor.js';

const shots=(hits,misses,sunk=0)=>[
 ...Array.from({length:hits},(_,i)=>({row:0,col:i,hit:true,sunkShip:i<sunk?'SHIP'+i:null})),
 ...Array.from({length:misses},(_,i)=>({row:1,col:i,hit:false}))
];
const outcome=(fired,received,winnerId=13)=>buildMatchReport({
 shotsFired:fired,shotsReceived:received,winnerId,finishReason:'TIME_LIMIT'
},13);
assert.equal(ridiculousAward(outcome(shots(1,6),[])).title,'Terror dos Peixes');
assert.equal(ridiculousAward(outcome(shots(5,1),[])).title,'Sniper de Banheira');
assert.equal(ridiculousAward(outcome(shots(2,2,2),[])).title,'Colecionador de Âncoras');
assert.equal(ridiculousAward(outcome(shots(1,3),[])).title,'Atirador de Água');
assert.equal(ridiculousAward(outcome(shots(1,1),[],null)).title,'Rei do Empate');
assert.equal(ridiculousAward(outcome(shots(1,1),[],13)).title,'Almirante do Improviso');
assert.equal(ridiculousAward(outcome(shots(1,1),[],17)).title,'Capitão Persistente');
assert.equal(ridiculousAward(outcome([],[],17)).title,'Capitão de Água Doce');
assert.equal(reportStats([{hit:true,blocked:true}]).attempts,0,'Blocked shots are not real hits');
assert.deepEqual(Object.fromEntries(Object.entries(REACTIONS).map(([k,v])=>[k,v.length])),
 {hit:15,miss:15,sunk:15,blocked:5});
for(const [event,kind] of [
 ['hit','hit'],['miss','miss'],['ship_sunk_enemy','sunk'],
 ['ship_sunk_ally','sunk'],['attack_blocked','blocked']
]){
 assert.equal(funnyReaction([event],4).kind,kind);
}
assert.equal(funnyReaction([],2),null);
console.log('PASS: funny comments and ridiculous awards use real battle stats');
