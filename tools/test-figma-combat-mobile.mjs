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

   if(status==='PREPARING') {
     const layout=await page.evaluate(()=>{
       const rect=selector=>{
         const el=document.querySelector(selector);
         if(!el)throw Error('Missing '+selector);
         const r=el.getBoundingClientRect();
         return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
       };
       const board=document.querySelector('.bn-placement-screen .board-main');
       const tile=board.querySelector('.cell');
       return {
         rootWidth:document.documentElement.scrollWidth,
         pageHeight:document.documentElement.scrollHeight,
         head:rect('.bn-placement-header'),
         board:rect('.bn-placement-screen .board-main'),
         fleet:rect('.bn-placement-fleet'),
         tools:rect('.bn-placement-tools'),
         action:rect('.bn-placement-confirm'),
         cellBorder:getComputedStyle(tile).borderStyle,
         containerType:getComputedStyle(document.querySelector('.bn-placement-board-wrap')).containerType,
       };
     });
     const explain='PREPARING '+viewport.width+'x'+viewport.height+' '+JSON.stringify(layout);
     assert.ok(layout.rootWidth<=viewport.width+2,'Document horizontal overflow: '+explain);
     assert.ok(layout.board.width>=viewport.width*.68,'Tiny preserved board: '+explain);
     assert.ok(Math.abs(layout.board.height-layout.board.width)<=3,'Board is not square: '+explain);
     assert.ok(layout.board.left>=-2&&layout.board.right<=viewport.width+2,'Board outside viewport: '+explain);
     assert.equal(layout.containerType,'normal','Board collapsed by size containment: '+explain);
     assert.equal(layout.cellBorder,'solid','Grid cell border changed: '+explain);
     assert.ok(layout.head.bottom<=layout.board.top+3,'Board overlaps header: '+explain);
     assert.ok(layout.board.bottom<=layout.fleet.top+4,'Ship cards overlap board: '+explain);
     assert.ok(layout.fleet.bottom<=layout.tools.top+4,'Tools overlap ship cards: '+explain);
     assert.equal(await page.locator('.bn-placement-screen .board-main .cell').count(),100);
     assert.equal(await page.locator('.bn-placement-ship').count(),5);
     assert.equal(await page.locator('.bn-placement-ship.is-selected').count(),1);
     assert.ok(await page.locator('[data-action="random-placement"]').isEnabled());
     for(const selector of ['[data-action="random-placement"]','[data-action="confirm-placement"]','[data-action="leave-lobby"]']){
       const button=page.locator(selector);
       await button.scrollIntoViewIfNeeded({timeout:5000});
       const bounds=await button.evaluate(el=>{
         const r=el.getBoundingClientRect();
         return {top:r.top,bottom:r.bottom,width:r.width,height:r.height};
       });
       const minWidth=selector.includes('leave-lobby')?28:selector.includes('random-placement')?40:70;
       assert.ok(bounds.width>=minWidth&&bounds.height>=25,'Collapsed placement action '+selector+' '+explain);
       assert.ok(bounds.top>=-2&&bounds.bottom<=viewport.height+2,'Placement action unreachable '+selector+' '+explain);
     }
     await page.screenshot({path:'artifacts/figma-combat/placement-'+viewport.width+'x'+viewport.height+'.png',fullPage:true});
     assert.deepEqual(errors,[],'Page errors '+explain);
     console.log('PASS PREPARING '+viewport.width+'x'+viewport.height+'; preserved board '+layout.board.width.toFixed(0)+'px, Figma actions reachable');
     await page.close();
     continue;
   }


   const metrics=await page.evaluate(()=>{
     const rect=selector=>{
       const element=document.querySelector(selector);
       if(!element)throw Error('Missing '+selector);
       const r=element.getBoundingClientRect();
       return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};
     };
     return {
       rootWidth:document.documentElement.scrollWidth,
       pageHeight:document.documentElement.scrollHeight,
       viewportWidth:innerWidth,viewportHeight:innerHeight,
       head:rect('.zip-battle-header'),
       score:rect('.zip-scoreboard'),
       enemy:rect('.zip-enemy-section'),
       board:rect('.zip-primary-board .board-main'),
       defense:rect('.zip-own-section'),
       powers:rect('.zip-tactics-section'),
       fire:rect('.zip-fire-button'),
       ownBoard:rect('.zip-own-board .board-preview'),
     };
   });
   const explain=status+' '+viewport.width+'x'+viewport.height+' '+JSON.stringify(metrics);
   assert.ok(metrics.rootWidth<=viewport.width+2,'Battle document horizontal overflow: '+explain);
   assert.ok(metrics.pageHeight<=viewport.height+2,'Battle document should fit screen: '+explain);
   assert.ok(metrics.board.width>=viewport.width*.58,'Targeting board too small: '+explain);
   assert.ok(Math.abs(metrics.board.height-metrics.board.width)<=3,'Targeting board distorted: '+explain);
   for(const key of ['head','score','enemy','board','defense','powers','fire','ownBoard']) {
     const bounds=metrics[key];
     assert.ok(bounds.left>=-2&&bounds.right<=viewport.width+2,'Offscreen horizontal '+key+': '+explain);
     assert.ok(bounds.top>=-2&&bounds.bottom<=viewport.height+2,'Offscreen vertical '+key+': '+explain);
   }
   assert.ok(metrics.head.bottom<=metrics.score.top+3,'Score overlays header: '+explain);
   assert.ok(metrics.score.bottom<=metrics.board.top+3,'Target board overlaps score: '+explain);
   assert.ok(metrics.board.bottom<=metrics.defense.top+4,'Defense overlaps attack: '+explain);
   assert.ok(metrics.defense.bottom<=metrics.fire.top+4,'Defense overlaps fire control: '+explain);
   assert.ok(metrics.powers.bottom<=metrics.fire.top+4,'Powers overlap fire control: '+explain);
   assert.equal(await page.locator('.zip-primary-board .board-main .cell').count(),100);
   assert.equal(await page.locator('.zip-own-board .board-preview .cell').count(),100);
   const fire=page.locator('[data-action="fire"]');
   assert.ok(await fire.isDisabled(),'Fire must be disabled before target selection');
   const target=page.locator('.zip-primary-board .board-main [data-coord="0,1"]');
   await target.click();
   assert.ok(await fire.isEnabled(),'Selecting target did not enable attack');
   assert.match(await page.locator('.zip-target-indicator').innerText(),/A2/);
   const menu=page.locator('.zip-battle-menu summary');
   await menu.click();
   assert.ok(await page.locator('[data-action="forfeit"]').isVisible(),'Forfeit option must remain reachable');
   await menu.click();
   const powers=page.locator('.zip-abilities-menu summary');
   await powers.click();
   assert.ok(await page.locator('.zip-no-powers').isVisible(),'Mode without powers must not invent abilities');
   await powers.click();
   await page.screenshot({path:'artifacts/figma-combat/'+route+'-'+viewport.width+'x'+viewport.height+'.png',fullPage:true});
   assert.deepEqual(errors,[],'Page errors '+explain);
   console.log('PASS '+status+' '+viewport.width+'x'+viewport.height+'; ZIP battle board '+metrics.board.width.toFixed(0)+'px, scroll-free controls');
   await page.close();
  }
 }
} finally {
 await browser.close();
 await vite.close();
}
