import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';

const root=new URL('../public/assets/bn-zip/', import.meta.url);
const names=['water-tile','cell-placed','cell-selected','cell-hit','cell-miss'];
const css=readFileSync(new URL('../src/prototype/zip-battle-repair-v11.css',import.meta.url),'utf8');
for (const basename of names) {
  const filename=basename+'.webp';
  const path=new URL(filename,root);
  assert.ok(existsSync(path),`Missing ZIP reference artwork: ${filename}`);
  const data=readFileSync(path);
  assert.equal(data.toString('ascii',0,4),'RIFF',`Bad WebP RIFF signature: ${filename}`);
  assert.equal(data.toString('ascii',8,12),'WEBP',`Bad WebP MIME signature: ${filename}`);
  assert.ok(data.length>40,`Empty ZIP reference artwork: ${filename}`);
  assert.ok(css.includes('/assets/bn-zip/'+filename),`Artwork not applied by CSS: ${filename}`);
}
console.log('ZIP cell-art assets OK: 5 verified WebP files referenced by the game');
