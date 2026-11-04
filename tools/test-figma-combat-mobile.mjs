// Mobile combat layout regression against the real app DOM, with a test-only REST fixture.
// Unlike unit tests, this checks CSS geometry and scroll reachability in Chromium.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const mode={
 id:'classic',name:'Clássico',placementDirections:['HORIZONTAL','VERTICAL'],
 geometry:{kind:'RECTANGULAR',rows:10,columns:10,cells:Array.from({length:100},(_,i)=>({row:Math.floor(i/10),col:i%10}))},
 fleet:[{id:'CARRIER',length:5},{id:'BATTLESHIP',length:4},{id:'CRUISER',length:3},
        {id:'SUBMARINE',length:3},{id:'DESTROYER',length:2}]
};
const player={id:13,nickname:'Jogador QA',email:'qa@example.test',avatarId:'captain'};
const room={code:'ABC123',status:'PREPARING',revision:1,mode,
 players:[{id:13,nickname:'Jogador QA',ready:true},{id:17,nickname:'Adversário',ready:true}]};
const ships=[{type:'CARRIER',row:0,col:0,orientation:'HORIZONTAL'},
{type:'BATTLESHIP',row:1,col:0,orientation:'HORIZONTAL'},
{type:'CRUISER',row:2,col:0,orientation:'HORIZONTAL'},
{type:'SUBMARINE',row:3,col:0,orientation:'HORIZONTAL'},
{type:'DESTROYER',row:4,col:0,orientation:'HORIZONTAL'}];
const placement={preparationId:91,revision:1,mode,
 yourShips:[],fleetPlaced:false,fleetConfirmed:false,opponentConfirmed:false};
const match={matchId:91,revision:1,status:'PLAYING',mode,
 turnPlayerId:13,yourShips:ships,shotsReceived:[],
 shotsFired:[{row:0,col:0,hit:false},{row:1,col:1,hit:true}]};

const vite=await createServer({server:{host:'127.0.0.1',port:4181,strictPort:true},logLevel:'error'});
await vite.listen();
const browser=await chromium.launch({headless:true});
await mkdir('artifacts/figma-combat',{recursive:true});

try {
 for(const status of ['PREPARING','PLAYING']){
  for(const viewport of [{width:320,height:568},{width:375,height:667},{width:390,height:844}]){
   const errors=[];
   const page=await browser.newPage({viewport,deviceScaleFactor:1});
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    const response=path==='/api/auth/login'?{
       tokenType:'Bearer',accessToken:'qa-token',refreshToken:'qa-refresh',expiresIn:900,user:player
      }:path==='/api/users/me'?player:path==='/api/game-modes'?[mode]:
      path==='/api/matchmaking/lobbies/me'?{...room,status}:
      path==='/api/matches/me/placement'?placement:
      path==='/api/matches/me'?match:null;
    if(response!==null) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
    if(path==='/api/realtime/ticket')return route.fulfill({status:503,body:'{"code":"UNAVAILABLE"}',contentType:'application/json'});
    return route.fulfill({status:404,body:'{}',contentType:'application/json'});
   });
   await page.goto('http://127.0.0.1:4181/',{waitUntil:'domcontentloaded'});
   await page.locator('#email').fill('qa@example.test');
   await page.locator('#password').fill('testing-password-123');
   await page.locator('[data-form="login"] button[type="submit"]').click();
   const route=status==='PREPARING'?'placement':'match';
   await page.locator('body[data-route="'+route+'"] .combat-screen').waitFor({timeout:15000});

   const metrics=await page.evaluate(()=>{
    const rect=selector=>{
      const el=document.querySelector(selector);
      if(!el)throw Error('Missing '+selector);
      const r=el.getBoundingClientRect();
      return {x:r.x,y:r.y,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,
              scrollWidth:el.scrollWidth,scrollHeight:el.scrollHeight,clientWidth:el.clientWidth,clientHeight:el.clientHeight};
    };
    return {
      viewport:innerWidth,
      rootWidth:document.documentElement.scrollWidth,
      pageHeight:document.documentElement.scrollHeight,
      head:rect('.combat-screen .match-head'),
      boardPanel:rect('.combat-screen .premium-board-panel'),
      board:rect('.combat-screen .board-main'),
      hud:rect('.combat-screen .premium-hud'),
      rail:rect('.combat-screen .side-stack'),
      actions:rect('.combat-screen '+(document.body.dataset.route==='placement'?'.placement-actions':'.combat-actions')),
      wrapper:rect('.combat-screen .combat-board-wrap'),
      containerType:getComputedStyle(document.querySelector('.combat-screen .combat-board-wrap')).containerType,
    };
   });
   const explain=status+' '+viewport.width+'x'+viewport.height+' '+JSON.stringify(metrics);
   assert.ok(metrics.rootWidth<=viewport.width+2,'Document horizontal overflow: '+explain);
   assert.ok(metrics.board.width >= viewport.width*0.68,'Tiny board: '+explain);
   assert.ok(Math.abs(metrics.board.height-metrics.board.width)<=3,'Board is not square: '+explain);
   assert.ok(metrics.board.left>=-2 && metrics.board.right<=viewport.width+2,'Board not inside viewport: '+explain);
   assert.equal(metrics.containerType,'normal','Wrong size container: '+explain);
   assert.ok(metrics.head.bottom<=metrics.boardPanel.top+3,'Board overlaps header: '+explain);
   assert.ok(metrics.boardPanel.bottom<=metrics.hud.top+4,'HUD overlaps board: '+explain);
   assert.ok(metrics.hud.bottom<=metrics.rail.top+4,'Secondary rail overlaps actions: '+explain);
   assert.ok(metrics.pageHeight>=viewport.height,'Page collapses: '+explain);
   const selectors=status==='PREPARING'?
    ['[data-action="random-placement"]','[data-action="confirm-placement"]','[data-action="leave-lobby"]']:
    ['[data-action="fire"]','[data-action="forfeit"]'];
   for(const selector of selectors){
     const button=page.locator(selector);
     await button.scrollIntoViewIfNeeded({timeout:5000});
     const accessible=await button.evaluate(btn=>{
       const r=btn.getBoundingClientRect();
       return {top:r.top,bottom:r.bottom,width:r.width,height:r.height,viewport:innerHeight};
     });
     assert.ok(accessible.width>150 && accessible.height>=35,
       'Action collapsed '+selector+' '+explain+' '+JSON.stringify(accessible));
     assert.ok(accessible.top>=-2 && accessible.bottom<=viewport.height+2,
       'Cannot scroll to action '+selector+' '+explain+' '+JSON.stringify(accessible));
   }
   if(status==='PLAYING'){
     assert.equal(await page.locator('.combat-screen .board-main .cell').count(),100);
     assert.ok(await page.locator('.combat-screen .preview-panel .board-preview').count()===1);
     const target=page.locator('.combat-screen .board-main [data-coord="0,1"]');
     await target.click();
     assert.ok(await page.locator('[data-action="fire"]').isEnabled(),'Selecting target did not enable attack');
   }else{
     assert.equal(await page.locator('.combat-screen .board-main .cell').count(),100);
     assert.equal(await page.locator('.placement-fleet-card .tp-ships>div').count(),5);
     assert.ok(await page.locator('[data-action="random-placement"]').isEnabled());
   }
   await page.screenshot({path:'artifacts/figma-combat/'+route+'-'+viewport.width+'x'+viewport.height+'.png',fullPage:true});
   assert.deepEqual(errors,[],'Page errors '+explain);
   console.log('PASS '+status+' '+viewport.width+'x'+viewport.height+'; board '+metrics.board.width.toFixed(0)+'px, scroll-safe actions');
   await page.close();
  }
 }
} finally {
 await browser.close();
 await vite.close();
}
