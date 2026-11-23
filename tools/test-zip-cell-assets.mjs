import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';

const root=new URL('../public/assets/bn-zip/', import.meta.url);
const names=['water-tile','cell-placed','cell-selected','cell-hit','cell-miss','bg','ship-carrier'];
const css=['zip-battle-repair-v11.css','zip-approved-art-v13.css'].map(f=>readFileSync(new URL('../src/prototype/'+f,import.meta.url),'utf8')).join('\n');
const shipArtSource=readFileSync(new URL('../src/prototype/ship-art.js',import.meta.url),'utf8');
for (const basename of names) {
  const filename=basename+'.webp';
  const path=new URL(filename,root);
  assert.ok(existsSync(path),`Missing ZIP reference artwork: ${filename}`);
  const data=readFileSync(path);
  assert.equal(data.toString('ascii',0,4),'RIFF',`Bad WebP RIFF signature: ${filename}`);
  assert.equal(data.toString('ascii',8,12),'WEBP',`Bad WebP MIME signature: ${filename}`);
  assert.ok(data.length>40,`Empty ZIP reference artwork: ${filename}`);
  assert.ok((css+shipArtSource).includes('/assets/bn-zip/'+filename),`Artwork not used by UI: ${filename}`);
}
const map=readFileSync(new URL('../src/prototype/ship-art.js',import.meta.url),'utf8');
assert.ok(map.includes('CARRIER:')&&!map.includes('DESTROYER:')&&!map.includes('SEARCH:'),'GD mapping not authorized');
console.log('ZIP art assets OK: 7 verified WebP files, only carrier mapped');
