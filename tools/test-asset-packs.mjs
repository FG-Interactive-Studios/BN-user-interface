import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validatePack,SHIP_TYPES,EXPRESSIONS} from './validate-asset-packs.mjs';
// The header fixtures verify the gate only, not image decoding or final artwork.
assert.deepEqual(SHIP_TYPES,['SEARCH','DESTROYER','CARRIER']);
const root=mkdtempSync(join(tmpdir(),'bn-assets-'));
try{
  const file='sprite.webp';writeFileSync(join(root,file),Buffer.from('RIFF0000WEBP'));
  const pack={version:1,id:'skin_test',type:'FLEET',name:'Test',status:'draft',preview:null,ships:Object.fromEntries(SHIP_TYPES.map(t=>[t,{intact:null,sunk:null}]))};
  assert.equal(validatePack(pack,root),'draft');
  assert.throws(()=>validatePack({...pack,status:'ready'},root));
  assert.throws(()=>validatePack({...pack,ships:{...pack.ships,UNKNOWN:{intact:null,sunk:null}}},root));
  assert.throws(()=>validatePack({...pack,preview:'../sprite.webp'},root));
  assert.throws(()=>validatePack({...pack,preview:'missing.webp'},root));
  assert.throws(()=>validatePack({...pack,preview:'https://example.com/sprite.webp'},root));
  const ready={...pack,status:'ready',preview:file,ships:Object.fromEntries(SHIP_TYPES.map(t=>[t,{intact:file,sunk:file}]))};
  assert.equal(validatePack(ready,root),'ready');
  const captain={version:1,id:'captain_test',name:'Test',type:'CAPTAIN',status:'ready',preview:file,expressions:Object.fromEntries(EXPRESSIONS.map(t=>[t,file]))};
  assert.equal(validatePack(captain,root),'ready');
  assert.throws(()=>validatePack({...captain,expressions:{neutral:file,hit:file}},root));
  writeFileSync(join(root,'bad.webp'),'not an image');
  assert.throws(()=>validatePack({...ready,preview:'bad.webp'},root));
  console.log('Visual pack manifest validation OK');
}finally{rmSync(root,{recursive:true,force:true});}
