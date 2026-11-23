// Mobile combat layout regression against the real app DOM, with a test-only REST fixture.
// Unlike unit tests, this checks CSS geometry and scroll reachability in Chromium.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const mode={
 id:'classic-powers',name:'Clássico com poderes',placementDirections:['HORIZONTAL','VERTICAL'],
 geometry:{kind:'RECTANGULAR',rows:8,columns:8,cells:Array.from({length:64},(_,i)=>({row:Math.floor(i/8),col:i%8}))},
 fleet:[{id:'SEARCH',length:1},{id:'DESTROYER',length:2},{id:'CARRIER',length:5}]
};
const player={id:13,nickname:'Jogador QA',email:'qa@example.test',avatarId:'captain'};
const room={code:'ABC123',status:'PREPARING',revision:1,mode,
 players:[{id:13,nickname:'Jogador QA',ready:true},{id:17,nickname:'Adversário',ready:true}]};
const ships=[{type:'CARRIER',row:0,col:0,orientation:'HORIZONTAL'},
{type:'DESTROYER',row:1,col:0,orientation:'HORIZONTAL'},
{type:'SEARCH',row:2,col:0,orientation:'HORIZONTAL'}];
const placement={preparationId:91,revision:1,mode,
 yourShips:[],fleetPlaced:false,fleetConfirmed:false,opponentConfirmed:false};
const match={matchId:91,revision:1,status:'PLAYING',mode,
 turnPlayerId:13,yourShips:ships,shotsReceived:[],
 yourAbilityPointsEarned:0,yourAbilityPointCells:[{row:5,col:2},{row:5,col:4},{row:6,col:5},{row:7,col:7}],
 yourAbilities:[
  {id:'radar',name:'Radar',description:'Encontra contatos na área 3×3',usesRemaining:1,targetCount:1,targetScope:'ENEMY',locked:false},
  {id:'double-shot',name:'Tiro duplo',description:'Duas casas num turno',usesRemaining:1,targetCount:2,targetScope:'ENEMY',locked:false},
  {id:'air-strike',name:'Ataque aéreo',description:'Área 2×2',usesRemaining:1,targetCount:1,targetScope:'ENEMY',locked:true}
 ],shotsFired:[{row:0,col:0,hit:false},{row:1,col:1,hit:true}]};

const vite=await createServer({server:{host:'127.0.0.1',port:4181,strictPort:true},logLevel:'error'});
await vite.listen();
const browser=await chromium.launch({headless:true});
await mkdir('artifacts/figma-combat',{recursive:true});

try {
 for(const status of ['PREPARING','PLAYING']){
  for(const viewport of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:412,height:915},{width:1366,height:768}]){
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
     assert.ok(layout.board.width>=Math.min(viewport.width*.68,500),'Tiny preserved board: '+explain);
     assert.ok(Math.abs(layout.board.height-layout.board.width)<=3,'Board is not square: '+explain);
     assert.ok(layout.board.left>=-2&&layout.board.right<=viewport.width+2,'Board outside viewport: '+explain);
     assert.equal(layout.containerType,'normal','Board collapsed by size containment: '+explain);
     assert.equal(layout.cellBorder,'solid','Grid cell border changed: '+explain);
     assert.ok(layout.head.bottom<=layout.board.top+3,'Board overlaps header: '+explain);
     const titleBounds=await page.evaluate(()=>{
       const h=document.querySelector('.bn-placement-header h1').getBoundingClientRect();
       const clock=document.querySelector('.bn-placement-phase').getBoundingClientRect();
       return {titleRight:h.right,titleTop:h.top,titleBottom:h.bottom,clockLeft:clock.left,clockBottom:clock.bottom};
     });
     assert.ok(titleBounds.titleRight<=titleBounds.clockLeft+2,'Preparation title overlaps timer: '+explain+' '+JSON.stringify(titleBounds));
     assert.ok(titleBounds.titleBottom<=layout.head.bottom+2,'Preparation title clipped by header: '+explain+' '+JSON.stringify(titleBounds));
     assert.ok(layout.board.bottom<=layout.fleet.top+4,'Ship cards overlap board: '+explain);
     assert.ok(layout.fleet.bottom<=layout.tools.top+4,'Tools overlap ship cards: '+explain);
     assert.equal(await page.locator('.bn-placement-screen .board-main .cell').count(),64);
     assert.equal(await page.locator('.bn-placement-ship').count(),3);
     assert.equal(await page.locator('.bn-placement-ship[data-item-id="CARRIER"] img[src*="ship-carrier.webp"]').count(),1,'ZIP carrier artwork absent');
     assert.equal(await page.locator('.bn-placement-ship[data-item-id="DESTROYER"] img[src*="ship-destroyer-gd.webp"]').count(),1,'GD destroyer artwork absent');
     assert.equal(await page.locator('.bn-placement-ship[data-item-id="SEARCH"] img').count(),0,'SEARCH must not inherit unrelated submarine art');
     for(const type of ['CARRIER','DESTROYER']) {
       const art=page.locator('.bn-placement-ship[data-item-id="'+type+'"] img');
       const decoded=await art.evaluate(async img=>{
         try {await img.decode();return img.naturalWidth>0&&img.naturalHeight>0;}
         catch {return false;}
       });
       assert.ok(decoded,'Broken sprite file for '+type+': '+explain);
     }
     const backdrop=await page.locator('.bn-zip-placement').evaluate(el=>getComputedStyle(el).backgroundImage);
     assert.ok(backdrop.includes('/assets/bn-zip/bg.webp'),'ZIP background is not active on preparation: '+backdrop);
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
       compass:rect('.zip-compass-divider'),
       actions:rect('.zip-battle-action-bar'),
       enemy:rect('.zip-enemy-section'),
       board:rect('.zip-primary-board .board-main'),
       defense:rect('.zip-own-section'),
       powers:rect('.zip-tactics-section'),
       fire:rect('.zip-fire-button'),
       ownBoard:rect('.zip-own-board .board-preview'),
       cell:rect('.zip-primary-board .board-main .cell'),
       previewCell:rect('.zip-own-board .board-preview .cell'),
     };
   });
   const explain=status+' '+viewport.width+'x'+viewport.height+' '+JSON.stringify(metrics);
   assert.ok(metrics.rootWidth<=viewport.width+2,'Battle document horizontal overflow: '+explain);
   const battleBackdrop=await page.locator('.bn-zip-battle').evaluate(el=>getComputedStyle(el).backgroundImage);
   assert.ok(battleBackdrop.includes('/assets/bn-zip/bg.webp'),'ZIP background is not active during battle: '+battleBackdrop);
   assert.ok(metrics.pageHeight<=viewport.height+2,'Battle document should fit screen: '+explain);
   assert.ok(metrics.board.width>=Math.min(130,viewport.width*.4),'Targeting board too small: '+explain);
   assert.ok(Math.abs(metrics.board.height-metrics.board.width)<=3,'Targeting board distorted: '+explain);
   for(const key of ['head','score','enemy','board','compass','defense','powers','fire','ownBoard']) {
     const bounds=metrics[key];
     assert.ok(bounds.left>=-2&&bounds.right<=viewport.width+2,'Offscreen horizontal '+key+': '+explain);
     assert.ok(bounds.top>=-2&&bounds.bottom<=viewport.height+2,'Offscreen vertical '+key+': '+explain);
   }
   assert.ok(metrics.head.bottom<=metrics.score.top+3,'Score overlays header: '+explain);
   assert.ok(metrics.score.bottom<=metrics.board.top+3,'Target board overlaps score: '+explain);
   assert.ok(metrics.board.bottom<=metrics.compass.top+4,'Compass overlaps attack board: '+explain);
   assert.ok(metrics.compass.bottom<=metrics.defense.top+4,'Defense overlaps compass: '+explain);
   assert.ok(metrics.defense.bottom<=metrics.fire.top+4,'Defense overlaps fire control: '+explain);
   assert.ok(metrics.powers.right<=metrics.fire.left+5,'Powers and fire must sit side-by-side: '+explain);
   assert.ok(Math.abs(metrics.powers.top-metrics.fire.top)<=5,'Powers and fire are not aligned: '+explain);
   assert.ok(Math.abs(metrics.ownBoard.width-metrics.board.width)<=4,'Both game boards must have equal scale: '+explain);
   assert.ok(Math.abs(metrics.ownBoard.height-metrics.ownBoard.width)<=3,'Defense board distorted: '+explain);
   assert.equal(await page.locator('.zip-primary-board .board-main .cell').count(),64);
   assert.equal(await page.locator('.zip-own-board .board-preview .cell').count(),64);
   assert.ok(Math.abs(metrics.cell.width-metrics.cell.height)<=2,'Target cell distorted: '+explain);
   assert.ok(Math.abs(metrics.previewCell.width-metrics.previewCell.height)<=2,'Own cell distorted: '+explain);
   assert.ok(metrics.ownBoard.width>=Math.min(130,viewport.width*.4),'Defense board collapsed: '+explain);
   await page.screenshot({path:'artifacts/figma-combat/'+route+'-initial-'+viewport.width+'x'+viewport.height+'.png',fullPage:true});
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
   const powerOptions=page.locator('.zip-abilities-options');
   assert.equal(await powerOptions.isVisible(),false,'Closed powers menu is covering the grid: '+explain);
   await powers.click();
   assert.ok(await powerOptions.isVisible(),'Powers do not open: '+explain);
   assert.equal(await page.locator('.zip-ability').count(),3);
   const popup=await powerOptions.boundingBox();
   assert.ok(popup && popup.x>=-2 && popup.x+popup.width<=viewport.width+2,
     'Power menu extends outside viewport: '+explain);
   await powers.click();
   assert.equal(await powerOptions.isVisible(),false,'Powers failed to close: '+explain);
   await powers.click();
   await page.locator('.zip-abilities-menu [data-action="pick-ability"][data-ability-id="radar"]').click();
   assert.ok(await page.locator('.tp-pilot-skill-control').isVisible(),'Power targeting UI missing: '+explain);
   await page.locator('.zip-primary-board .board-main [data-coord="0,2"]').click();
   assert.equal(await page.locator('.zip-primary-board .pilot-skill-target').count(),1,
     'Selected power target is not highlighted: '+explain);
   await page.locator('[data-action="cancel-ability"]').click();
   assert.equal(await page.locator('.zip-primary-board .pilot-skill-target').count(),0);
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
