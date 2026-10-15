import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css=readFileSync(new URL('../src/prototype/battle-report-v9.css', import.meta.url),'utf8');
const entry=readFileSync(new URL('../src/prototype/tidepoint-entry.css', import.meta.url),'utf8');
const app=readFileSync(new URL('../src/prototype/app.js', import.meta.url),'utf8');
const indexV8=entry.indexOf("@import './mobile-game-v8.css';");
const indexV9=entry.indexOf("@import './battle-report-v9.css';");
assert.ok(indexV8 >= 0 && indexV9 > indexV8,'V9 must load after V8 to override layout and radar');
assert.ok(css.includes('body[data-route="result"] .tp-result'));
assert.ok(css.includes('body[data-route="result"] .tp-content'));
assert.ok(css.includes('height: 100dvh !important'));
assert.ok(css.includes('overflow: hidden !important'));
assert.ok(css.includes('grid-template-columns: repeat(3, minmax(0, 1fr)) !important'));
assert.ok(app.includes('Relatório pós-batalha'));
assert.ok(app.includes('data-action="leave-lobby"'));
const radar=css.slice(css.indexOf('body[data-route="lobby"] .home-radar-sweep'));
assert.ok(radar.includes('transparent 0deg 278deg'));
assert.ok(radar.includes('transparent 360deg'));
assert.ok(radar.includes('tp-radar-sweep 3.4s linear infinite'));
assert.ok(radar.includes('.home-radar-sweep::after'), 'line and trail must share the same rotation');
const stops = [...radar.matchAll(/rgb\(81 219 255 \/ (\d+)%\) (\d+)deg/g)].map(([_,opacity,angle])=>({opacity:Number(opacity),angle:Number(angle)}));
assert.deepEqual(stops,[
  {opacity:10,angle:287},{opacity:40,angle:301},{opacity:30,angle:315},
  {opacity:13,angle:339},{opacity:3,angle:353}
]);
// The strongest echo lies 59 degrees BEHIND a clockwise sweep at 360,
// with ever lower opacity in the direction the sweep travels.
assert.ok(stops[1].angle < 360);
assert.ok(stops.slice(1).every((s,i,a)=>i===0 || s.opacity<a[i-1].opacity));
console.log('TidePoint V9: painel de resultado e gradiente do radar: OK');
