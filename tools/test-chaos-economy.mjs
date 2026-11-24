import {REACTIONS} from '../src/prototype/chaos-humor.js';
// End-to-end mocked transport, REAL Vite/DOM: fake money -> buy -> equip ->
// use taunt -> humorous shot -> result -> single reward credit.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const profile={id:13,nickname:'Capitão Caos',email:'caos@example.test',avatarId:'captain'};
const mode={id:'classic',name:'Clássico',placementDirections:['HORIZONTAL','VERTICAL'],
 geometry:{kind:'RECTANGULAR',rows:8,columns:8,
 cells:Array.from({length:64},(_,i)=>({row:Math.floor(i/8),col:i%8}))},
 fleet:[{id:'SEARCH',length:1},{id:'DESTROYER',length:2},{id:'CARRIER',length:5}]};
const opponent={id:17,nickname:'Marinheiro B',email:'b@example.test'};
const items=[
 {id:'skin_default',category:'SKIN',name:'Frota Original',description:'Padrão',price:0,enabled:true,owned:true,equipped:true},
 {id:'sound_default',category:'SOUND',name:'Sons Padrão',description:'Padrão',price:0,enabled:true,owned:true,equipped:true},
 {id:'taunt_default',category:'TAUNT',name:'Provocações Gratuitas',description:'Base',price:0,enabled:true,owned:true,equipped:true},
 {id:'taunt_banter',category:'TAUNT',name:'Tio do Pavê Naval',description:'Piadas marítimas',price:90,enabled:true,owned:false,equipped:false},
 {id:'taunt_panic',category:'TAUNT',name:'Surto Marítimo',description:'Dramas',price:140,enabled:true,owned:false,equipped:false},
 {id:'taunt_support',category:'TAUNT',name:'Atendimento Naval',description:'Suporte',price:120,enabled:true,owned:false,equipped:false},
 {id:'taunt_meme',category:'TAUNT',name:'Almirante dos Memes',description:'Memes',price:180,enabled:true,owned:false,equipped:false}
];
const wallet={credits:300,premiumCredits:0,items};
const room={code:'CHAOS1',status:'PLAYING',revision:4,mode,publicMatch:true,
 players:[{...profile,ready:true,connected:true},{...opponent,ready:true,connected:true}]};
const battle={matchId:'chaos-match-1',lobbyCode:'CHAOS1',status:'PLAYING',revision:5,mode,
 turnPlayerId:13,winnerId:null,shotsFired:[],shotsReceived:[],yourShips:[],
 yourAbilities:[],yourRadarReports:[],yourActiveEffects:[],reconnectDeadlines:{},
 paused:false,finishReason:null};
let phase='IDLE',purchases=0,equipments=0,taunts=0,claims=0,shots=0;
const errors=[],pageUrl='http://127.0.0.1:4197/';
const server=await createServer({server:{host:'127.0.0.1',port:4197,strictPort:true},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true});
await mkdir('artifacts/chaos-economy',{recursive:true});
const respond=(r,body,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
async function openPage(viewport) {
 const page=await browser.newPage({viewport});
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept());
 await page.route('**/api/**',route=>{
  const url=new URL(route.request().url()),path=url.pathname,method=route.request().method();
  if(path==='/api/auth/login')return respond(route,{
    tokenType:'Bearer',accessToken:'qa-chaos-token',refreshToken:'qa-chaos-refresh',expiresIn:900,user:profile});
  if(path==='/api/users/me')return respond(route,profile);
  if(path==='/api/game-modes')return respond(route,[mode]);
  if(path==='/api/store'&&method==='GET')return respond(route,wallet);
  if(path==='/api/store/purchase/taunt_banter'&&method==='POST'){
    purchases++;
    if(wallet.items[3].owned)return respond(route,{code:'ALREADY_OWNED'},409);
    wallet.credits-=90;wallet.items[3].owned=true;
    return respond(route,wallet);
  }
  if(path==='/api/store/equip/taunt_banter'&&method==='PUT'){
    equipments++;
    if(!wallet.items[3].owned)return respond(route,{code:'NOT_OWNED'},409);
    wallet.items[2].equipped=false;wallet.items[3].equipped=true;
    return respond(route,wallet);
  }
  if(path==='/api/realtime/ticket')return respond(route,{message:'not in CI'},503);
  if(path==='/api/matchmaking/state'&&method==='GET')
    return respond(route,phase==='IDLE'?{status:'IDLE',room:null,modeId:null}
      :{status:'MATCHED',room:{...room,status:phase},modeId:'classic'});
  if(path==='/api/matches/me'&&method==='GET')
    return respond(route,battle);
  if(path==='/api/matches/me/taunts'&&method==='POST'){
    taunts++;
    const index=route.request().postDataJSON().index;
    assert.ok(index===0||index===9,'Only requested phrase indexes are submitted');
    return respond(route,{id:'taunt-'+taunts,roomCode:'CHAOS1',packId:'taunt_banter',
      message:index===0?'É pavê ou pra afundar? 🍮':'Meu radar tá de férias no litoral. 🏖️',
      senderId:13,sentAt:new Date().toISOString()});
  }
  if(path==='/api/matches/me/shots'&&method==='POST'){
    shots++;battle.revision++;battle.turnPlayerId=17;
    const shot=route.request().postDataJSON();
    battle.shotsFired=[{...shot,hit:true,blocked:false}];
    return respond(route,battle);
  }
  if(path==='/api/matches/me/forfeit'&&method==='POST'){
    phase='FINISHED';room.status='FINISHED';room.revision++;battle.status='FINISHED';
    battle.winnerId=17;battle.turnPlayerId=null;battle.finishReason='FORFEIT';battle.revision++;
    return respond(route,battle);
  }
  if(path==='/api/store/rewards/claim'&&method==='POST'){
    claims++;
    if(phase!=='FINISHED')return respond(route,{code:'NOT_FINISHED'},409);
    if(claims===1)wallet.credits+=25;
    return respond(route,{earned:claims===1?25:0,wallet});
  }
  return respond(route,{code:'NOT_FOUND'},404);
 });
 await page.goto(pageUrl,{waitUntil:'domcontentloaded'});
 await page.locator('#email').fill(profile.email);
 await page.locator('#password').fill('valid-password');
 await page.locator('[data-form="login"] button[type="submit"]').click();
 return page;
}
try {
 // Shop route: buy with fake credit balance and equip the purchased pack.
 const shop=await openPage({width:1366,height:768});
 await shop.locator('.bn-lobby').waitFor({timeout:12000});
 await shop.locator('[data-go="store"]').click();
 await shop.locator('[data-action="store-category"][data-item-id="TAUNT"]').click();
 assert.equal(await shop.locator('.tp-store-card.is-taunt').count(),5);
 assert.match(await shop.locator('.tp-store-grid').innerText(),/Atendimento Naval/);
 assert.match(await shop.locator('.tp-store-grid').innerText(),/Almirante dos Memes/);
 await shop.locator('[data-action="store-buy"][data-item-id="taunt_banter"]').click();
 await shop.waitForFunction(()=>document.querySelector('.bn-wallet-pill.is-free strong')?.textContent==='210');
 assert.equal(wallet.credits,210,'Fake currency must be deducted by purchase');
 await shop.locator('[data-action="store-equip"][data-item-id="taunt_banter"]').click();
 await shop.locator('.tp-store-card').filter({hasText:'Tio do Pavê Naval'}).locator('.tp-store-tag.is-equipped').waitFor({timeout:10000});
 assert.equal(wallet.items[3].equipped,true,'New pack must be equipped server-side');
 assert.equal(purchases,1);assert.equal(equipments,1);
 await shop.screenshot({path:'artifacts/chaos-economy/shop-desktop.png',fullPage:true});
 await shop.close();

 // Reconnect to same account: purchased taunts must still be available in battle.
 phase='PLAYING';
 const play=await openPage({width:375,height:667});
 await play.locator('body[data-route="match"] .bn-zip-battle').waitFor({timeout:12000});
 await play.locator('.bn-taunt-menu summary').click();
 const options=play.locator('[data-action="send-taunt"]');
 assert.equal(await options.count(),10,'The equipped pack must expose ten phrases');
 assert.match(await options.first().innerText(),/pavê ou pra afundar/);
 await options.first().click();
 await play.locator('.bn-chaos-toast').waitFor({timeout:10000});
 assert.match(await play.locator('.bn-chaos-toast').innerText(),/É pavê ou pra afundar/);
 assert.equal(taunts,1,'Taunt request must reach server mock exactly once');
 await play.locator('.bn-taunt-menu summary').click();
 assert.match(await options.last().innerText(),/radar tá de férias/);
 await options.last().click();
 await play.waitForFunction(()=>document.querySelector('.bn-chaos-toast')?.textContent?.includes('radar tá de férias'));
 assert.equal(taunts,2,'The tenth phrase must submit index 9 to the API');
 // A normal shot triggers a text-only humorous reaction.
 await play.locator('.zip-primary-board [data-coord]').first().click();
 await play.locator('[data-action="fire"]').click();
 await play.waitForFunction(phrases=>phrases.includes(document.querySelector('.bn-chaos-toast')?.textContent),REACTIONS.hit,{timeout:10000});
 assert.equal(shots,1);
 await play.screenshot({path:'artifacts/chaos-economy/battle-mobile.png',fullPage:true});
 // Finish -> one 25-coin reward paid; original store purchases stay owned.
 await play.locator('.zip-battle-menu summary').click();
 await play.locator('[data-action="forfeit"]').click();
 await play.locator('body[data-route="result"] .bn-result-stage').waitFor({timeout:12000});
 await play.locator('.bn-report-reward-item strong').first().getByText('+25').waitFor({timeout:10000});
 assert.equal(wallet.credits,235,'Loss reward adds 25 to post-purchase balance');
 assert.equal(claims,1,'Finished match rewards must be claimed once');
 await play.screenshot({path:'artifacts/chaos-economy/result-mobile.png',fullPage:true});
 await play.close();
 assert.deepEqual(errors,[],'No JavaScript errors in shop or battle');
 console.log('PASS fun fake-currency loop: shop -90 / equip / 10 taunts / funny hit / loss +25, no real payments');
} finally {
 await browser.close();
 await server.close();
}
