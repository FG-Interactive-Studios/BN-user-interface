// Pure regression against the public SquareAbilityRule targeting contract.
import assert from 'node:assert/strict';
import {planAbility} from '../src/prototype/ability-targeting.js';

const cells=Array.from({length:64},(_,n)=>({row:Math.floor(n/8),col:n%8}));
const mode={geometry:{kind:'RECTANGULAR',rows:8,columns:8,cells},
  fleet:[{id:'CARRIER',length:5},{id:'DESTROYER',length:2},{id:'SEARCH',length:1}]};
const match={shotsFired:[],shotsReceived:[],yourShips:[
  {type:'DESTROYER',row:1,col:1,orientation:'HORIZONTAL'},
  {type:'CARRIER',row:3,col:0,orientation:'HORIZONTAL'},
  {type:'SEARCH',row:7,col:7,orientation:'HORIZONTAL'}
]};
const power=(id,targetCount=1,targetScope='ENEMY')=>({id,targetCount,targetScope});
const check=(id,anchor,count,area,scope='ENEMY',direction='RIGHT')=>{
  const result=planAbility({ability:power(id,count,scope),anchor,mode,battle:match,direction});
  assert.equal(result.valid,true,id+': '+result.reason);
  assert.equal(result.targets.length,count,id+' API target count');
  assert.equal(result.affected.length,area,id+' preview footprint');
  assert.ok(result.targets.every(p=>cells.some(c=>c.row===p.row&&c.col===p.col)));
  return result;
};
check('radar',{row:3,col:3},1,9);
check('radar',{row:0,col:0},1,4);
check('air-strike',{row:6,col:6},1,4);
assert.equal(planAbility({ability:power('air-strike'),anchor:{row:7,col:7},mode,battle:match}).valid,false);
const rotatedAir=planAbility({ability:power('air-strike'),anchor:{row:3,col:3},mode,battle:match,direction:'DOWN'});
assert.equal(rotatedAir.valid,true);
assert.deepEqual(rotatedAir.targets,[{row:3,col:2}],'rotated area always sends top-left to backend');
assert.ok(rotatedAir.affected.some(p=>p.row===4&&p.col===2));
const airNorthwest=planAbility({ability:power('air-strike'),anchor:{row:7,col:7},mode,battle:match,direction:'LEFT'});
assert.equal(airNorthwest.valid,true,'edge anchor can rotate footprint back into the board');
assert.deepEqual(airNorthwest.targets,[{row:6,col:6}]);
const first=check('double-shot',{row:0,col:1},1,1);
const second=planAbility({ability:power('double-shot',2),anchor:{row:7,col:6},mode,battle:match,selectedTargets:first.targets});
assert.equal(second.valid,true);
assert.deepEqual(second.targets,[{row:0,col:1},{row:7,col:6}],'double shot supports independent non-adjacent cells');
assert.equal(second.affected.length,2);
assert.equal(planAbility({ability:power('double-shot',2),anchor:{row:0,col:1},mode,battle:match,selectedTargets:first.targets}).valid,false,'duplicate second target rejected');
const blocked={...match,shotsFired:[{row:7,col:6,hit:false}]};
assert.equal(planAbility({ability:power('double-shot',2),anchor:{row:7,col:6},mode,battle:blocked,selectedTargets:first.targets}).valid,false,'already shot second target rejected');
check('line-barrage',{row:2,col:2},2,3);
check('line-barrage',{row:2,col:2},2,3,'ENEMY','DOWN');
check('hull-shield',{row:1,col:2},1,2,'OWN');
const moved=check('retreat',{row:1,col:2},2,3,'OWN');
assert.deepEqual(moved.targets[0],{row:1,col:1},'retreat uses ship starting coordinate');
assert.deepEqual(moved.targets[1],{row:1,col:2},'retreat moves one adjacent cell');
assert.equal(planAbility({ability:power('hull-shield',1,'OWN'),anchor:{row:0,col:0},mode,battle:match}).valid,false);
check('interference',null,0,0,'NONE');
check('last-chance',null,0,0,'NONE');
assert.equal(planAbility({ability:power('future-multi-shot',3),anchor:{row:1,col:1},mode,battle:match}).valid,false);
const damaged=planAbility({ability:power('hull-shield',1,'OWN'),anchor:{row:1,col:1},mode,battle:{...match,shotsReceived:[{row:1,col:1,hit:true}]}});
assert.equal(damaged.valid,false);
console.log('PASS ability targeting: manually selected double shot, rotatable line/area and backend-compatible payloads');
