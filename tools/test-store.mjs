import assert from 'node:assert/strict';
import { renderCosmeticStore } from '../src/prototype/store-ui.js';
const items=[
 {id:'skin_default',category:'SKIN',name:'Frota Original',description:'Padrão',price:0,enabled:true,owned:true,equipped:true},
 {id:'skin_coral',category:'SKIN',name:'Coral',description:'Cosmético',price:90,enabled:true,owned:false,equipped:false},
 {id:'sound_sonar',category:'SOUND',name:'Sonar',description:'Em breve',price:90,enabled:false,owned:false,equipped:false}
];
const html=renderCosmeticStore({credits:300,items});
assert.match(html,/300/);assert.match(html,/Em uso/);assert.match(html,/Adquirir · 90 créditos/);
assert.match(html,/data-action="store-buy"/);
assert.match(html,/Aguardando recursos do Game Design/);
assert.ok(!html.includes('data-item-id="sound_sonar"'),'do not sell unavailable sounds');
const escaped=renderCosmeticStore({credits:0,items:[{...items[1],name:'<script>',description:'<img src=x onerror=alert(1)>'}]});
assert.ok(!escaped.includes('<script>'));assert.ok(!escaped.includes('<img src=x'));
assert.ok(!renderCosmeticStore({credits:0,items},{filter:'SOUND'}).includes('skin_default'));
console.log('TidePoint: catálogo de cosméticos, compras e filtros: OK');
