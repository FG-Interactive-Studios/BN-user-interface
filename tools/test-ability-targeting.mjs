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
check('double-shot',{row:0,col:1},2,2);
check('double-shot',{row:0,col:7},2,2);
const blocked={...match,shotsFired:[{row:0,col:1,hit:false}]};
const double=planAbility({ability:power('double-shot',2),anchor:{row:0,col:0},mode,battle:blocked});
assert.equal(double.valid,true);
assert.deepEqual(double.targets,[{row:0,col:0},{row:1,col:0}]);
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
console.log('PASS ability targeting: eight pilot powers, previews and server-compatible payloads');
