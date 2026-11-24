import assert from 'node:assert/strict';
import {walletMarkup,walletDialogMarkup} from '../src/prototype/figma-wallet.js';
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
assert.ok(!renderCosmeticStore({credits:0,items},{filter:'BUNDLE'}).includes('data-product-id="captain_corsair"'));
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
assert.ok(!renderCosmeticStore({credits:0,items:[{...items[3],id:'captain_unknown',enabled:true}]})
    .includes('data-action="store-buy"'),'captain without official art cannot be purchased even if enabled');
assert.ok(renderCosmeticStore({credits:0,items:[{...items[3],enabled:true,price:120}]})
    .includes('data-action="store-buy"'),'captain with official art can be purchased when server enables it');
const escaped=renderCosmeticStore({credits:0,items:[{...items[1],name:'<script>',description:'<img src=x onerror=alert(1)>'}]});
assert.ok(!escaped.includes('<script>'));assert.ok(!escaped.includes('<img src=x'));
assert.ok(!renderCosmeticStore({credits:0,items},{filter:'SOUND'}).includes('skin_default'));
assert.equal((html.match(/data-product-cover="true"/g)||[]).length,items.length);
assert.notEqual(renderProductCover(items[0]),renderProductCover(items[1]));
assert.match(renderProductCover({id:'unknown',category:'OTHER'}),/COSMÉTICO/);
assert.ok(!renderProductCover({id:'<script>',category:'<script>'}).includes('<script>'));
assert.ok(!renderProductCover({id:'__proto__',category:'OTHER'}).includes('undefined'));
const demo=renderCosmeticStore({credits:300,premiumCredits:100,demoPremiumEnabled:true,items:[{...items[1],premiumPrice:30},{...items[2],premiumPrice:30}]});
assert.ok(!demo.includes('data-action="store-demo-topup"'),'Top-ups belong to modal only');
assert.match(walletDialogMarkup({demoPremiumEnabled:true},{currency:'premium'}),/data-action="store-demo-topup"/);
assert.equal((walletDialogMarkup({demoPremiumEnabled:true}).match(/data-action="store-demo-topup"/g)||[]).length,3);
assert.ok(!walletDialogMarkup({demoPremiumEnabled:true},{currency:'free'}).includes('store-demo-topup'));
assert.ok(!walletDialogMarkup({demoPremiumEnabled:false}).includes('store-demo-topup'));
assert.equal((walletMarkup({credits:300,premiumCredits:0}).match(/data-action="open-wallet"/g)||[]).length,2);
assert.match(html,/Item em destaque/);
assert.match(html,/data-action="store-category" data-item-id="BUNDLE"/);
assert.match(html,/data-action="store-category" data-item-id="COSMETICS"/);
assert.match(demo,/Comprar · 30 premium/);
assert.ok(!demo.includes('data-item-id="sound_sonar"'));
assert.ok(!html.includes('data-action="store-demo-topup"'));
const collection={id:'bundle_chaos',category:'BUNDLE',name:'Almirante do Caos',description:'Coleção',price:330,premiumPrice:110,enabled:true,components:['skin_coral','taunt_meme']};
const collectionView=renderCosmeticStore({items:[...items,collection],demoPremiumEnabled:true},{filter:'BUNDLE'});
assert.match(collectionView,/Inclui:/);
assert.match(collectionView,/Comprar · 330 créditos/);
assert.match(collectionView,/Comprar · 110 premium/);
const ownedCollection=renderCosmeticStore({items:[...items,{...collection,owned:true}]},{filter:'BUNDLE'});
assert.match(ownedCollection,/Coleção completa/);
assert.ok(!ownedCollection.includes('data-item-id="bundle_chaos"'));
const premiumOnlyCaptain={...items[3],price:200,premiumPrice:200,enabled:true,premiumOnly:true};
const premiumOnlyView=renderCosmeticStore({credits:1000,premiumCredits:300,demoPremiumEnabled:true,items:[premiumOnlyCaptain]});
assert.match(premiumOnlyView,/200 moedas navais/);
assert.match(premiumOnlyView,/data-action="store-buy-premium"/);
assert.ok(!premiumOnlyView.includes('data-action="store-buy"'),'premium-only captain cannot be bought for free credits');
const demoOff=renderCosmeticStore({credits:1000,premiumCredits:300,items:[premiumOnlyCaptain]});
assert.ok(!demoOff.includes('data-action="store-buy"'));
assert.ok(!demoOff.includes('data-action="store-buy-premium"'));
assert.match(demoOff,/demonstração indisponível/);
console.log('TidePoint: catálogo de cosméticos, compras e filtros: OK');

const themedBundle=renderProductCover({id:'bundle_corsair',category:'BUNDLE'});
assert.match(themedBundle,/bn-collection-cover/);
assert.match(themedBundle,/skin_corsair\/banner/);
assert.match(themedBundle,/captain_corsair\/neutral/);
assert.match(renderProductCover({id:'sound_sonar',category:'SOUND'}),/xMidYMid meet/);
assert.match(renderCosmeticStore({items:[{id:'sound_sonar',category:'SOUND',name:'Sonar Retrô',description:'Efeitos',enabled:true,price:90}]}),/4 efeitos de combate em 8 bits/);

const {connectionStatusContent,connectionStatusLabel}=await import('../src/prototype/connection-status.js');
assert.equal(connectionStatusLabel(true),'Conectado');
assert.match(connectionStatusContent(true),/tp-live-dot online/);
assert.ok(!connectionStatusContent(true).includes('<span>'),'Online indicator has no visible text');
assert.match(connectionStatusContent(false),/tp-live-dot warning/);
assert.match(connectionStatusContent(false),/<span>Reconectando<\/span>/);

const {renderFleetEquipment,renderEquipmentSelection,ownedEquipment,equipmentCategory}=await import('../src/prototype/fleet-equipment.js');
const equipFixture={items:[{id:'skin_default',category:'SKIN',name:'Original',enabled:true,owned:true,equipped:true},{id:'skin_pirate',category:'SKIN',name:'Pirata',enabled:true,owned:true,equipped:false},{id:'skin_space',category:'SKIN',name:'Não adquirido',enabled:true,owned:false},{id:'skin_magnate',category:'SKIN',name:'Desativado',enabled:false,owned:true},{id:'bundle_space',category:'BUNDLE',owned:true,enabled:true}]};
assert.equal(ownedEquipment(equipFixture,'SKIN').length,2);
assert.equal(equipmentCategory('BUNDLE'),undefined);
const selection=renderEquipmentSelection('SKIN',{catalog:equipFixture});
assert.match(selection,/bn-inventory-active[\s\S]*data-equipment-id="skin_default"/);
assert.match(selection,/data-action="fleet-equip" data-item-id="skin_pirate"/);
assert.ok(!selection.includes('skin_space')&&!selection.includes('skin_magnate')&&!selection.includes('bundle_space'));
assert.match(renderFleetEquipment({catalog:equipFixture,mode:{fleet:[{id:'SEARCH',length:1}]}}),/skin_default\/search-intact/);

const {renderCaptainExpressions}=await import('../src/prototype/fleet-equipment.js');
for(const mood of ['neutral','hit','damage']){
 assert.ok(renderCaptainExpressions('captain_corsair').includes('data-mood="'+mood+'"'));
 assert.ok(renderCaptainExpressions('captain_corsair').includes('/captain_corsair/'+mood+'.'));
}

// Withdrawal hides a released item from the store but preserves its owned equipment.
const withdrawn={id:'sound_pirate',category:'SOUND',name:'Canhões Piratas',price:140,enabled:true,saleEnabled:false,owned:true,equipped:true};
assert.ok(!renderCosmeticStore({items:[withdrawn]}).includes('sound_pirate'));
const withdrawnSelection=renderEquipmentSelection('SOUND',{catalog:{items:[withdrawn]}});
assert.match(withdrawnSelection,/data-equipment-id="sound_pirate"/);
assert.ok(renderCosmeticStore({items:[{...withdrawn,saleEnabled:true}]}).includes('sound_pirate'));
