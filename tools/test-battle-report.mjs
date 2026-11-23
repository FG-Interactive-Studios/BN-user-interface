import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const legacy=readFileSync(new URL('../src/prototype/battle-report-v9.css',import.meta.url),'utf8');
const design=readFileSync(new URL('../src/prototype/figma-result-v7.css',import.meta.url),'utf8');
const markup=readFileSync(new URL('../src/prototype/figma-result.js',import.meta.url),'utf8');
const metrics=readFileSync(new URL('../src/prototype/match-report.js',import.meta.url),'utf8');
const entry=readFileSync(new URL('../src/prototype/tidepoint-entry.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/prototype/app.js',import.meta.url),'utf8');
const indexV8=entry.indexOf("@import './mobile-game-v8.css';");
const indexV9=entry.indexOf("@import './battle-report-v9.css';");
const indexFigma=entry.indexOf("@import './figma-result-v7.css';");
assert.ok(indexV8>=0&&indexV9>indexV8&&indexFigma>indexV9,
 'Figma result must override the retired report styles after V9');
assert.ok(legacy.includes('animation: tp-waiting-sweep 2.65s linear infinite !important'),
 'Existing waiting radar should remain untouched');
assert.ok(design.includes('body[data-route="result"] .screen.bn-result-stage'));
assert.ok(design.includes('height: 100dvh !important'));
assert.ok(design.includes('overflow: hidden !important'));
assert.ok(design.includes('storm.jpg'));
assert.ok(design.includes('center center/auto 100%'),'Figma portrait backdrop must show original storm framing');
assert.ok(design.includes('left bottom/auto 100%'),'Wide-screen backdrop must retain the left-hand ship artwork');
assert.ok(markup.includes('Resumo da partida'));
assert.ok(markup.includes('Recompensas'));
assert.ok(markup.includes('Navios'));
assert.ok(markup.includes('Comparação dos jogadores'));
assert.ok(markup.includes('bn-report-verdict'));
assert.ok(markup.includes('data-action="play-again"'));
assert.ok(markup.includes('data-action="leave-lobby"'));
assert.ok(markup.includes('buildMatchReport('));
assert.ok(metrics.includes('shotsFired'));
assert.ok(metrics.includes('shotsReceived'));
assert.ok(metrics.includes('shot=>!shot.blocked'));
assert.ok(metrics.includes('finishReasonText'));
assert.ok(markup.includes('Duração indisponível'));
assert.ok(!markup.includes('+120 XP')&&!markup.includes('+250'),
 'Rewards must not be fabricated before the backend supports them');
assert.ok(app.includes('renderFigmaResult('));
assert.ok(app.includes("case 'play-again'"));
assert.ok(app.includes('function radarMarkup()'));
assert.ok(app.includes('radarMarkup()'));
assert.ok(app.includes('bn-feature-card'));
assert.ok(!app.includes('home-radar-disc'));
console.log('Figma: post-battle comparative report from both server histories and official ending; legacy radar preserved: OK');
