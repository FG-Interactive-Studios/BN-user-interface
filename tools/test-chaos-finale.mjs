// Browser regression for the approved battle/result frames with fake API transports.
// Exercise the actual button and its authenticated, no-coordinates POST.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const mode={id:'classic',name:'Clássico',placementDirections:['HORIZONTAL','VERTICAL'],
 geometry:{kind:'RECTANGULAR',rows:8,columns:8,
 cells:Array.from({length:64},(_,i)=>({row:Math.floor(i/8),col:i%8}))},
 fleet:[{id:'CARRIER',length:5},{id:'DESTROYER',length:2},{id:'SEARCH',length:1}]};
const profile={id:13,nickname:'Almirante QA',email:'qa@example.test'};
const rival={id:17,nickname:'Marinheiro Teste'};
const room={code:'LUCK21',status:'PLAYING',revision:1,mode,
 players:[{...profile,connected:true,ready:true},{...rival,connected:true,ready:true}]};
const battle={matchId:'lucky-match',lobbyCode:room.code,status:'PLAYING',revision:3,
 mode,turnPlayerId:13,winnerId:null,finishReason:null,shotsFired:[],shotsReceived:[],
 yourShips:[],yourAbilities:[],yourRadarReports:[],yourActiveEffects:[],
 reconnectDeadlines:{},paused:false,yourDesperationUsed:false};
const server=await createServer({server:{host:'127.0.0.1',port:4198,strictPort:true},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true});
await mkdir('artifacts/chaos-finale',{recursive:true});
const errors=[];
let luckyCalls=0,normalCalls=0;
const respond=(route,obj,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(obj)});
try{
 for(const viewport of [{width:320,height:568},{width:1366,height:768}]){
  // Reset per independent browser test battle.
  luckyCalls=0;normalCalls=0;room.status='PLAYING';room.revision++;
  Object.assign(battle,{status:'PLAYING',revision:3,turnPlayerId:13,winnerId:null,
    finishReason:null,shotsFired:[],shotsReceived:[],yourDesperationUsed:false});
  const page=await browser.newPage({viewport});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname,method=route.request().method();
    if(path==='/api/auth/login')return respond(route,{tokenType:'Bearer',
      accessToken:'jwt-chaos',refreshToken:'jwt-refresh',expiresIn:900,user:profile});
    if(path==='/api/users/me')return respond(route,profile);
    if(path==='/api/game-modes')return respond(route,[mode]);
    if(path==='/api/store')return respond(route,{credits:300,premiumCredits:0,items:[]});
    if(path==='/api/realtime/ticket')return respond(route,{code:'NO_SOCKET'},503);
    if(path==='/api/matchmaking/state')return respond(route,{
      status:'MATCHED',modeId:'classic',room});
    if(path==='/api/matches/me'&&method==='GET')return respond(route,battle);
    if(path==='/api/matches/me/shots/desperation'&&method==='POST'){
      luckyCalls++;
      assert.equal(route.request().postData()||'', '',
        'Aperta e Reza must never submit target coordinates');
      if(battle.yourDesperationUsed)return respond(route,{code:'ALREADY_USED'},409);
      battle.shotsFired=[{row:2,col:3,hit:false,blocked:false}];
      battle.yourDesperationUsed=true;battle.turnPlayerId=17;battle.revision++;
      return respond(route,battle);
    }
    if(path==='/api/matches/me/shots'&&method==='POST'){
      normalCalls++;return respond(route,{code:'UNEXPECTED'},409);
    }
    if(path==='/api/matches/me/forfeit'&&method==='POST'){
      battle.status='FINISHED';battle.turnPlayerId=null;battle.winnerId=17;
      battle.finishReason='ABANDONED';battle.revision++;
      room.status='FINISHED';room.revision++;
      return respond(route,battle);
    }
    if(path==='/api/store/rewards/claim'&&method==='POST')
      return respond(route,{earned:25,wallet:{credits:325,premiumCredits:0,items:[]}});
    return respond(route,{code:'NOT_FOUND'},404);
  });
  await page.goto('http://127.0.0.1:4198/',{waitUntil:'domcontentloaded'});
  await page.locator('#email').fill(profile.email);
  await page.locator('#password').fill('secret-password');
  await page.locator('[data-form="login"] button[type="submit"]').click();
  await page.locator('body[data-route="match"] .zip-battle-action-bar').waitFor({timeout:14000});
  const button=page.locator('[data-action="desperation-shot"]');
  assert.equal(await button.count(),1,'Random-shot button should be in the combat footer');
  assert.equal(await button.isEnabled(),true,'Random shot is available on the first turn');
  assert.equal(await page.locator('[data-action="fire"]').isDisabled(),true,
    'Ordinary shot still requires explicit target selection');
  const geometry=await page.locator('.zip-attack-buttons').evaluate(el=>{
    const b=el.getBoundingClientRect();
    const die=el.querySelector('.zip-desperation-button').getBoundingClientRect();
    const fire=el.querySelector('.zip-fire-button').getBoundingClientRect();
    return {width:b.width,left:b.left,right:b.right,dieRight:die.right,fireLeft:fire.left,
      scroll:document.documentElement.scrollWidth-innerWidth};
  });
  assert.ok(geometry.dieRight<=geometry.fireLeft+2,
    'Random button must be to the left of ATIRAR');
  assert.ok(geometry.width>90 && geometry.scroll<=2,
    'Combat footer should fit without horizontal scrolling');
  await page.screenshot({path:'artifacts/chaos-finale/battle-'+viewport.width+'.png',fullPage:true});
  await button.click();
  await page.waitForFunction(()=>document.querySelector('[data-action="desperation-shot"]')?.disabled);
  assert.equal(luckyCalls,1,'Only one server-drawn shot is sent');
  assert.equal(normalCalls,0,'Random shot must not call ordinary endpoint with client coordinates');
  assert.equal(battle.yourDesperationUsed,true,'Server response marks shot consumed');
  assert.equal(await page.locator('[data-action="desperation-shot"]').isDisabled(),true);
  await page.locator('.zip-battle-menu summary').click();
  await page.locator('[data-action="forfeit"]').click();
  await page.locator('body[data-route="result"] .bn-report-award').waitFor({timeout:12000});
  assert.match(await page.locator('.bn-report-award-copy strong').innerText(),/Atirador de Água/);
  const shared=page.locator('[data-action="copy-award"]');
  assert.equal(await shared.count(),1);
  const rects=await page.evaluate(()=>{
    const selectors=['.bn-result-viewport','.bn-report-summary','.bn-report-rewards',
      '.bn-report-award','.bn-report-actions'];
    return selectors.map(sel=>{
      const r=document.querySelector(sel).getBoundingClientRect();
      return {sel,left:r.left,right:r.right,top:r.top,bottom:r.bottom};
    });
  });
  for(const r of rects){
    assert.ok(r.left>=-2&&r.right<=viewport.width+2,
      'Out-of-screen award/result horizontally '+JSON.stringify(rects));
    assert.ok(r.top>=-2&&r.bottom<=viewport.height+2,
      'Out-of-screen award/result vertically '+JSON.stringify(rects));
  }
  await page.screenshot({path:'artifacts/chaos-finale/result-'+viewport.width+'.png',fullPage:true});
  await page.close();
 }
 assert.deepEqual(errors,[],errors.join('; '));
 console.log('PASS: random shot 1/match, no client coords, footer mobile/desktop, awards in result');
}finally{
 await browser.close();await server.close();
}
