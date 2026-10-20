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
// Matchmaking keeps its radar. Lobby restores the original faint rings,
 // crosshair and contacts; only the sweep animation is reused.
assert.ok(app.includes('function radarMarkup()'));
assert.ok(app.includes('radarMarkup()'));
assert.ok(!app.includes("radarMarkup('home-radar-disc tp-home-radar')"));
for (const cls of ['home-radar-disc', 'home-radar-ring ring-a', 'home-radar-axis axis-x', 'home-radar-contact contact-a', 'home-radar-sweep'])
  assert.ok(app.includes(cls), 'original lobby element missing: '+cls);
assert.ok(css.includes('body[data-route="lobby"] .home-radar-sweep'));
assert.ok(css.includes('conic-gradient(from 0deg, #52d6ff45, transparent 25%)'));
assert.ok(css.includes('animation: tp-waiting-sweep 2.65s linear infinite !important'));
assert.ok(!css.includes('body[data-route="lobby"] .tp-home-radar'), 'do not override lobby decor with waiting room CSS');
console.log('TidePoint: report full-screen, original lobby radar visual + waiting sweep: OK');
