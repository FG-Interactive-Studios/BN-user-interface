import assert from 'node:assert/strict';
import { loadConfigFromFile } from 'vite';
import { readFileSync } from 'node:fs';
const resolved=await loadConfigFromFile({command:'serve',mode:'development'},'vite.config.ts');
assert.ok(resolved, 'Vite config must load');
const ws=resolved.config.server.proxy['/ws'];
assert.equal(ws.target,'http://localhost:8080');
assert.equal(ws.ws,true);
assert.equal(ws.rewriteWsOrigin,true);
for(const origin of ['http://localhost:5173','http://127.0.0.1:5173','http://[::1]:5173']) {
  assert.equal(ws.bypass({headers:{origin}}),undefined, 'Allow local '+origin);
}
for(const origin of ['https://attacker.example','http://example.com:5173',undefined]) {
  assert.equal(ws.bypass({headers:{origin}}),false, 'Reject external origin');
}
const app=readFileSync(new URL('../src/prototype/app.js',import.meta.url),'utf8');
assert.ok(app.includes('now-lastFallbackReconcileAt >= 60000'));
assert.ok(app.includes('}, 20000);'));
assert.ok(!app.includes('}, 7000);'));
console.log('Proxy /ws local + fallback REST menos frequente: OK');
