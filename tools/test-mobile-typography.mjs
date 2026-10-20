import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css=readFileSync(new URL('../src/prototype/home-flow-v7.css', import.meta.url),'utf8');
const entry=readFileSync(new URL('../src/prototype/tidepoint-entry.css', import.meta.url),'utf8');
const v7 = entry.indexOf("@import './home-flow-v7.css';");
const v8 = entry.indexOf("@import './mobile-game-v8.css';");
assert.ok(v7 >= 0 && v8 > v7,'CSS must load V7 typography before V8 mobile game overrides');
for(const selector of ['.tp-action-copy b','.tp-action-copy small','.tp-player-status-list .tp-mission-info small','.tp-player-status-list .tp-mission-info b','.bottom-nav .nav-btn','.hero-title'])
  assert.ok(css.includes(selector),'Missing typography override: '+selector);
for(const size of ['font-size:16px!important','font-size:13px!important','font-size:12px!important','font-size:clamp(31px,8.7vw,36px)!important'])
  assert.ok(css.includes(size),'Missing font size: '+size);
assert.ok(css.includes('grid-template-rows:minmax(0,1fr) minmax(152px,28dvh)!important'));
console.log('TidePoint: mobile type sizes and compact viewport overrides present');
