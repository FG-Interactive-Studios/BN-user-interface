import assert from 'node:assert/strict';
import { renderCosmeticStore, renderProductCover } from '../src/prototype/store-ui.js';
const items=[
 {id:'skin_default',category:'SKIN',name:'Frota Original',description:'Padrão',price:0,enabled:true,owned:true,equipped:true},
 {id:'skin_coral',category:'SKIN',name:'Coral',description:'Cosmético',price:90,enabled:true,owned:false,equipped:false},
 {id:'sound_sonar',category:'SOUND',name:'Sonar',description:'Em breve',price:90,enabled:false,owned:false,equipped:false},
 {id:'captain_corsair',category:'CAPTAIN',name:'Capitão Corsário',description:'Piloto',price:0,enabled:false,owned:false,equipped:false},
 {id:'bundle_corsair',category:'BUNDLE',name:'Coleção Corsária',description:'Pacote planejado',price:0,enabled:false,owned:false,equipped:false},
 {id:'taunt_default',category:'TAUNT',name:'Provocações Gratuitas',description:'Base',price:0,enabled:true,owned:true,equipped:true},
 {id:'taunt_banter',category:'TAUNT',name:'Tio do Pavê Naval',description:'Piadas ruins',price:90,enabled:true,owned:false,equipped:false},
 {id:'taunt_support',category:'TAUNT',name:'Atendimento Naval',description:'Suporte',price:120,enabled:true,owned:false,equipped:false},
 {id:'taunt_meme',category:'TAUNT',name:'Almirante dos Memes',description:'Meme',price:180,enabled:true,owned:false,equipped:false}
];
const html=renderCosmeticStore({credits:300,premiumCredits:0,items});
assert.ok(!html.includes('bn-store-wallet'),'Store must not repeat the currency display from sticky header');
assert.ok(!html.includes('bn-wallet-pill'),'Store catalog must not duplicate the real currency header');assert.match(html,/Em uso/);assert.match(html,/Comprar · 90 créditos/);
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
const taunts=renderCosmeticStore({credits:300,items},{filter:'TAUNT'});
assert.match(taunts,/Tio do Pavê Naval/);
assert.match(taunts,/É pavê ou pra afundar/);
assert.match(taunts,/data-item-id="taunt_banter"/);
assert.match(taunts,/Atendimento Naval/);
assert.match(taunts,/Almirante dos Memes/);
assert.match(taunts,/Seu naufrágio é muito importante para nós/);
assert.match(taunts,/Achei que fosse batalha naval/);
assert.match(taunts,/Comprar · 120 créditos/);
assert.match(taunts,/Comprar · 180 créditos/);
assert.ok(!taunts.includes('skin_coral'),'Taunt filter must exclude unrelated cosmetics');
assert.ok(!renderCosmeticStore({credits:0,items:[{...items[3],enabled:true}]})
    .includes('data-action="store-buy"'),'unsupported category cannot be purchased even if enabled');
const escaped=renderCosmeticStore({credits:0,items:[{...items[1],name:'<script>',description:'<img src=x onerror=alert(1)>'}]});
assert.ok(!escaped.includes('<script>'));assert.ok(!escaped.includes('<img src=x'));
assert.ok(!renderCosmeticStore({credits:0,items},{filter:'SOUND'}).includes('skin_default'));
assert.equal((html.match(/data-product-cover="true"/g)||[]).length,items.length);
assert.notEqual(renderProductCover(items[0]),renderProductCover(items[1]));
assert.match(renderProductCover({id:'unknown',category:'OTHER'}),/COSMÉTICO/);
assert.ok(!renderProductCover({id:'<script>',category:'<script>'}).includes('<script>'));
assert.ok(!renderProductCover({id:'__proto__',category:'OTHER'}).includes('undefined'));
console.log('TidePoint: catálogo de cosméticos, compras e filtros: OK');
