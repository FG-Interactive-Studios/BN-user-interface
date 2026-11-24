// Real-browser checks for the approved Figma result artboard.
// Mocked responses mirror BattleResponse and LobbyResponse; no reward values
// are fabricated and no backend contracts are changed.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const mode={id:'classic',name:'Clássico',placementDirections:['HORIZONTAL','VERTICAL'],
 geometry:{kind:'RECTANGULAR',rows:10,columns:10,cells:Array.from({length:100},(_,i)=>({row:Math.floor(i/10),col:i%10}))},
 fleet:[{id:'CARRIER',length:5},{id:'BATTLESHIP',length:4},{id:'CRUISER',length:3},
        {id:'SUBMARINE',length:3},{id:'DESTROYER',length:2}]};
const profile={id:13,nickname:'Capitão QA',email:'qa@example.test',avatarId:'captain'};
const makeRoom=()=>({code:'ABC123',status:'FINISHED',revision:14,mode,
 players:[{id:13,nickname:'Capitão QA',ready:true,connected:true},
          {id:17,nickname:'MarinheiroX',ready:true,connected:true}]});
const shots=[
 {row:0,col:0,hit:true}, {row:0,col:1,hit:true}, {row:0,col:2,hit:false},
 {row:1,col:0,hit:false}, {row:2,col:0,hit:true},
 {row:2,col:1,hit:true,sunkShip:'DESTROYER'},
 {row:3,col:0,hit:false}
];
const enemyShots=[{row:4,col:4,hit:true},{row:5,col:5,hit:false},{row:5,col:6,hit:true,sunkShip:'DESTROYER'},{row:6,col:6,hit:false}];
const makeBattle=winnerId=>({matchId:'abc-123',lobbyCode:'ABC123',status:'FINISHED',
 revision:40,mode,winnerId,turnPlayerId:null,finishReason:winnerId==null?'TIME_LIMIT_DRAW':'TIME_LIMIT',
 shotsFired:shots,shotsReceived:enemyShots,yourShips:[],reconnectDeadlines:{}});
const server=await createServer({server:{host:'127.0.0.1',port:4183,strictPort:true},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true});
await mkdir('artifacts/figma-result',{recursive:true});
const screens=[
 {width:320,height:568,outcome:'defeat'},
 {width:328,height:561,outcome:'victory'},
 {width:375,height:667,outcome:'victory'},
 {width:390,height:844,outcome:'draw'},
 {width:1363,height:602,outcome:'defeat'},
 {width:1366,height:768,outcome:'victory'}
];
try{
 for(const viewport of screens){
  let room=makeRoom();
  const winnerId=viewport.outcome==='victory'?13:viewport.outcome==='defeat'?17:null;
  const battle=makeBattle(winnerId);
  let leaves=0;
  const errors=[];
  const page=await browser.newPage({viewport,deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   const method=route.request().method();
   let response=null;
   if(path==='/api/auth/login')response={tokenType:'Bearer',accessToken:'qa-token',refreshToken:'qa-refresh',expiresIn:900,user:profile};
   else if(path==='/api/users/me')response=profile;
   else if(path==='/api/game-modes')response=[mode];
   else if(path==='/api/matchmaking/lobbies/me'&&method==='GET'){
     if(!room)return route.fulfill({status:404,contentType:'application/json',body:'{"code":"NOT_FOUND"}'});
     response=room;
   }
   else if(path==='/api/matchmaking/lobbies/me'&&method==='DELETE'){
     leaves++;room=null;
     return route.fulfill({status:204,body:''});
   }
   else if(path==='/api/matches/me')response=battle;
   if(response!==null)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
   if(path==='/api/realtime/ticket')
     return route.fulfill({status:503,contentType:'application/json',body:'{"code":"UNAVAILABLE"}'});
   return route.fulfill({status:404,contentType:'application/json',body:'{}'});
  });
  await page.goto('http://127.0.0.1:4183/',{waitUntil:'domcontentloaded'});
  await page.locator('#email').fill('qa@example.test');
  await page.locator('#password').fill('valid-password');
  await page.locator('[data-form="login"] button[type="submit"]').click();
  await page.locator('body[data-route="result"] .bn-result-stage').waitFor({timeout:15000});

  const title=viewport.outcome==='victory'?'Vitória!':viewport.outcome==='defeat'?'Derrota':'Empate!';
  assert.equal(await page.locator('#bn-result-title').innerText(),title);
  assert.equal(await page.locator('.bn-report-summary').count(),1);
  assert.equal(await page.locator('.bn-report-rewards').count(),1);
  assert.equal(await page.locator('.bn-report-player').count(),0,'Opponent comparison must be absent');
  assert.equal(await page.locator('.bn-report-stat').count(),4);
  assert.deepEqual(await page.locator('.bn-report-stat strong').allInnerTexts(),['4','3','57%','1/5']);
  assert.deepEqual(await page.locator('.bn-report-stat span').allInnerTexts(),['Acertos','Erros','Precisão','Navios destruídos']);
  assert.match(await page.locator('.bn-report-verdict').innerText(),/tempo terminou/i);
  assert.match(await page.locator('.bn-report-meta').innerText(),/Duração indisponível.*Clássico/);
  assert.equal(await page.locator('.bn-report-reward-item strong').first().innerText(),'—');
  assert.equal(await page.locator('.bn-report-reward-item strong').last().innerText(),'0',
    'Premium currency has no rewards; only earned fake credits are issued');
  assert.equal(await page.locator('.topbar').count(),0,'Figma result has no account topbar');
  assert.equal(await page.locator('.bn-bottom-nav').count(),0,'Figma result has no navigation dock');

  const geo=await page.evaluate(()=>{
   const rect=selector=>{
    const el=document.querySelector(selector);
    if(!el)throw Error('Missing '+selector);
    const r=el.getBoundingClientRect();
    return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
   };
   const stage=document.querySelector('.bn-result-stage');
   return {
    width:innerWidth,height:innerHeight,
    scrollWidth:document.documentElement.scrollWidth,
    scrollHeight:document.documentElement.scrollHeight,
    hero:rect('.bn-report-hero'),
    summary:rect('.bn-report-summary'),
    rewards:rect('.bn-report-rewards'),
    actions:rect('.bn-report-actions'),
    replay:rect('.bn-report-replay'),
    back:rect('.bn-report-back'),
    stageImage:getComputedStyle(stage).backgroundImage,
    backgroundSize:getComputedStyle(stage).backgroundSize,
    foregroundDesktop:getComputedStyle(stage,'::before').backgroundImage
   };
  });
  const msg=viewport.width+'x'+viewport.height+' '+JSON.stringify(geo);
  assert.ok(geo.scrollWidth<=geo.width+2,'Horizontal scroll: '+msg);
  assert.ok(geo.scrollHeight<=geo.height+2,'Vertical scroll: '+msg);
  assert.ok(geo.stageImage.includes('storm.jpg'),'Missing original storm art: '+msg);
  for(const id of ['hero','summary','rewards','actions','replay','back']){
   const x=geo[id];
   assert.ok(x.width>0&&x.height>0,'Hidden result element '+id+': '+msg);
   assert.ok(x.left>=-2&&x.right<=geo.width+2,'Result element off horizontal viewport '+id+': '+msg);
   assert.ok(x.top>=-2&&x.bottom<=geo.height+2,'Result element off vertical viewport '+id+': '+msg);
  }
  if(viewport.width<850){
   assert.ok(geo.summary.bottom<=geo.rewards.top+3,'Panels overlap on mobile: '+msg);
   assert.ok(geo.rewards.bottom<=geo.actions.top+3,'Buttons cover rewards panel on mobile: '+msg);
   assert.ok(geo.backgroundSize.includes('auto 100%'),'Portrait art should preserve full vertical painting: '+msg);
  } else {
   assert.ok(geo.summary.right<=geo.rewards.left+3,'Desktop panels not side-by-side: '+msg);
   assert.ok(geo.foregroundDesktop.includes('storm.jpg'),'Desktop foreground painting is not left-anchored: '+msg);
  }
  await page.screenshot({path:'artifacts/figma-result/result-'+viewport.outcome+'-'+viewport.width+'x'+viewport.height+'.png',fullPage:true});

  // A finished game's membership must be released by the API for BOTH actions.
  if(viewport.width===320||viewport.width===1363){
   await page.locator('[data-action="leave-lobby"]').click();
   await page.locator('.bn-lobby').waitFor({timeout:10000});
  }else{
   await page.locator('[data-action="play-again"]').click();
   await page.locator('.tp-create-room-card').waitFor({timeout:10000});
  }
  assert.equal(leaves,1,'Finished lobby must be removed by server exactly once');
  assert.deepEqual(errors,[],'Unexpected JS errors: '+msg+' '+errors.join('; '));
  console.log('PASS Figma result '+viewport.outcome+' '+viewport.width+'x'+viewport.height+
    ': summary+rewards visible, storm aligned, no clipping, actions functional');
  await page.close();
 }
}finally{
 await browser.close();
 await server.close();
}
