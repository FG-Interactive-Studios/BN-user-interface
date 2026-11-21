/** Visual pack contract. Runtime integration is a later step: this gate checks the
 * versioned assets, not the backend's pricing/ownership or visual suitability. */
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
export const SHIP_TYPES=Object.freeze(["SEARCH","DESTROYER","CARRIER"]);
export const EXPRESSIONS=Object.freeze(['neutral','hit','damage']);
const validPath=/^(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:webp|jpe?g)$/;
function validateKeys(obj,keys,label){
  assert.ok(obj&&typeof obj==='object'&&!Array.isArray(obj),label+' must be an object');
  assert.deepEqual(Object.keys(obj).sort(),[...keys].sort(),label+' slots');
}
function imageFile(folder,value,{required=false,transparent=false,label}={}){
  if(value===null){assert.ok(!required,label+' is required for ready packs');return;}
  assert.ok(typeof value==='string'&&validPath.test(value),label+' must be normalized local image path');
  if(transparent)assert.ok(value.endsWith('.webp'),label+' must use WebP for sprites');
  const target=resolve(folder,value);
  assert.ok(!relative(folder,target).startsWith('..'+sep),label+' path must be inside pack');
  assert.ok(statSync(target).isFile(),label+' is not a file');
  const bytes=readFileSync(target);
  if(value.endsWith('.webp')){
    assert.equal(bytes.subarray(0,4).toString(),'RIFF',label+' RIFF');
    assert.equal(bytes.subarray(8,12).toString(),'WEBP',label+' WebP');
  }else assert.equal(bytes.subarray(0,2).toString('hex'),'ffd8',label+' JPEG');
}
export function validatePack(pack,folder){
  assert.equal(pack.version,1);
  assert.ok(['FLEET','CAPTAIN'].includes(pack.type),'Unknown pack type');
  assert.match(pack.id,pack.type==='FLEET'?/^skin_[a-z0-9_-]{1,35}$/:/^captain_[a-z0-9_-]{1,32}$/);
  assert.ok(typeof pack.name==='string'&&pack.name.trim().length>0);
  assert.ok(['draft','ready'].includes(pack.status),'Unknown status');
  const required=pack.status==='ready';
  // A ready fleet covers the three classes defined by GDD v1.2. Sprites use
  // a canonical horizontal orientation; rotation is a presentation concern.
  imageFile(folder,pack.preview,{required,label:pack.id+' preview'});
  if(pack.type==='FLEET'){
    validateKeys(pack.ships,SHIP_TYPES,pack.id+' ships');
    for(const type of SHIP_TYPES){
      const slot=pack.ships[type];validateKeys(slot,['intact','sunk'],type);
      for(const state of ['intact','sunk'])
        imageFile(folder,slot[state],{required,transparent:true,label:type+' '+state});
    }
  }else{
    validateKeys(pack.expressions,EXPRESSIONS,pack.id+' expressions');
    for(const expression of EXPRESSIONS)imageFile(folder,pack.expressions[expression],{required,transparent:true,label:expression});
  }
  return pack.status;
}
export function validateCatalog(root){
  const ids=new Set();let drafts=0,ready=0;
  for(const entry of readdirSync(root,{withFileTypes:true})){
    if(!entry.isDirectory())continue;
    const folder=resolve(root,entry.name);
    const pack=JSON.parse(readFileSync(resolve(folder,'manifest.json'),'utf8'));
    assert.equal(pack.id,entry.name,'Folder and id must match');
    assert.ok(!ids.has(pack.id),'Duplicate pack ID');ids.add(pack.id);
    if(validatePack(pack,folder)==='ready')ready++;else drafts++;
  }
  assert.ok(ids.size>0,'No visual packs found');
  return {drafts,ready};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const result=validateCatalog(fileURLToPath(new URL('../src/assets/cosmetics/',import.meta.url)));
  console.log('Visual assets:',result);
}
