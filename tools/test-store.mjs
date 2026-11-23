import assert from 'node:assert/strict';
import { renderCosmeticStore } from '../src/prototype/store-ui.js';
const items=[
 {id:'skin_default',category:'SKIN',name:'Frota Original',description:'Padrão',price:0,enabled:true,owned:true,equipped:true},
 {id:'skin_coral',category:'SKIN',name:'Coral',description:'Cosmético',price:90,enabled:true,owned:false,equipped:false},
 {id:'sound_sonar',category:'SOUND',name:'Sonar',description:'Em breve',price:90,enabled:false,owned:false,equipped:false},
 {id:'captain_corsair',category:'CAPTAIN',name:'Capitão Corsário',description:'Piloto',price:0,enabled:false,owned:false,equipped:false},
 {id:'bundle_corsair',category:'BUNDLE',name:'Coleção Corsária',description:'Pacote planejado',price:0,enabled:false,owned:false,equipped:false}
];
const html=renderCosmeticStore({credits:300,premiumCredits:0,items});
assert.match(html,/Premium/);
assert.match(html,/Moedas/);
assert.match(html,/blue-coin\.png/);
assert.match(html,/gold-coin\.png/);
assert.match(html,/300/);assert.match(html,/Em uso/);assert.match(html,/Comprar · 90 créditos/);
assert.match(html,/data-action="store-buy"/);
assert.match(html,/Aguardando recursos do Game Design/);
assert.ok(!html.includes('data-item-id="sound_sonar"'),'do not sell unavailable sounds');
assert.ok(!html.includes('data-item-id="captain_corsair"'),'do not sell unavailable captains');
assert.ok(!html.includes('data-item-id="bundle_corsair"'),'do not sell unavailable bundles');
assert.match(html,/Capitão Corsário/);assert.match(html,/Coleção Corsária/);
assert.match(html,/Capitão em preparação/);assert.match(html,/Coleção em preparação/);
assert.ok(!html.includes('Comprar · 0 créditos'),'draft sentinel price must not look like a free offer');
assert.ok(!renderCosmeticStore({credits:0,items},{filter:'CAPTAIN'}).includes('skin_default'));
assert.ok(!renderCosmeticStore({credits:0,items},{filter:'BUNDLE'}).includes('captain_corsair'));
assert.ok(!renderCosmeticStore({credits:0,items:[{...items[3],enabled:true}]})
    .includes('data-action="store-buy"'),'unsupported category cannot be purchased even if enabled');
const escaped=renderCosmeticStore({credits:0,items:[{...items[1],name:'<script>',description:'<img src=x onerror=alert(1)>'}]});
assert.ok(!escaped.includes('<script>'));assert.ok(!escaped.includes('<img src=x'));
assert.ok(!renderCosmeticStore({credits:0,items},{filter:'SOUND'}).includes('skin_default'));
console.log('TidePoint: catálogo de cosméticos, compras e filtros: OK');
