import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
const read = path => readFileSync(new URL(path, import.meta.url));
const assets = [
  ['../src/assets/figma/storm.jpg', [0xff, 0xd8, 0xff], 30000],
  ['../src/assets/figma/gold-coin.png', [137, 80, 78, 71], 3000],
  ['../src/assets/figma/blue-coin.png', [137, 80, 78, 71], 3000],
  ['../src/assets/figma/cannon.png', [137, 80, 78, 71], 1000],
  ['../src/assets/figma/ship-icon.png', [137, 80, 78, 71], 1000],
  ['../src/assets/figma/coin-icon.png', [137, 80, 78, 71], 1000],
];
for (const [path, signature, minBytes] of assets) {
  const bytes=read(path);
  assert.ok(bytes.length>minBytes, 'Asset missing or truncated: '+path);
  assert.deepEqual([...bytes.subarray(0,signature.length)],signature,'Invalid image header: '+path);
}
const css=read('../src/prototype/figma-v1.css').toString('utf8');
for(const expected of ['storm.jpg','gold-coin.png','ship-icon.png','cannon.png','coin-icon.png']) {
  assert.ok(css.includes(expected),'Asset not referenced by the visual theme: '+expected);
}
assert.ok(!css.includes('api/mcp/asset'),'No temporary Figma asset URLs in shipped CSS');
console.log('Batalha Naval: original Figma assets and CSS references OK');
