import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const app=readFileSync(new URL('../src/prototype/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/prototype/figma-v1.css',import.meta.url),'utf8');
for (const label of ['bn-lobby','Tempestade de Aço','Em desenvolvimento','Novas embarcações','Patentes em breve','data-go="matchmaking"','data-action="open-join-modal"','data-form="join"']) assert.ok(app.includes(label),'Missing new lobby element: '+label);
for (const token of ['--bn-bg:#0b1014','--bn-yellow:#fbbf24','--bn-selected:#34d399','.bn-news-grid','.bn-primary-button','.bottom-nav']) assert.ok(css.includes(token),'Missing design-system styling: '+token);
assert.ok(!app.includes('8.450 / 10.000 XP'),'Do not display fictitious XP');
console.log('Batalha Naval Figma: lobby, actions and visual tokens OK');
