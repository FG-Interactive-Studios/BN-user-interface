// Regression for the Figma "Sua frota" view, with real DOM and mock REST only in CI.
// Exercises manual ship choice, rotation, replacement, clear, random and server confirmation.
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
const player={id:13,nickname:'QA Capitão',email:'qa@example.test',avatarId:'captain'};
const room={code:'PREP01',status:'PREPARING',revision:1,mode,players:[
 {id:13,nickname:'QA Capitão',ready:true,connected:true},
 {id:17,nickname:'Oponente',ready:true,connected:true}
]};
// A different arrangement ensures manual edits really require a PUT before confirmation.
const randomShips=mode.fleet.map((s,index)=>({type:s.id,row:index+5,col:0,orientation:'HORIZONTAL'}));
const server=await createServer({server:{host:'127.0.0.1',port:4182,strictPort:true},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true});
await mkdir('artifacts/figma-placement',{recursive:true});

try {
 for(const viewport of [{width:320,height:568},{width:328,height:561},{width:375,height:667},{width:390,height:844},{width:1363,height:602},{width:1366,height:768}]){
   let preparation={
     preparationId:'abcdef',revision:1,mode,fleetPlaced:false,fleetConfirmed:false,
     opponentConfirmed:false,opponentPlaced:false,bothConfirmed:false,yourShips:[]
   };
   const calls={random:0,put:[],confirm:0};
   const errors=[];
   const page=await browser.newPage({viewport,deviceScaleFactor:1});
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/api/**',async route=>{
     const path=new URL(route.request().url()).pathname,method=route.request().method();
     let response=null;
     if(path==='/api/auth/login') response={tokenType:'Bearer',accessToken:'qa-token',refreshToken:'qa-refresh',expiresIn:900,user:player};
     else if(path==='/api/users/me')response=player;
     else if(path==='/api/game-modes')response=[mode];
     else if(path==='/api/matchmaking/lobbies/me')response=room;
     else if(path==='/api/matches/me/placement'&&method==='GET')response=preparation;
     else if(path==='/api/matches/me/placement'&&method==='PUT'){
       const ships=route.request().postDataJSON().ships;
       calls.put.push(structuredClone(ships));
       preparation={...preparation,revision:preparation.revision+1,yourShips:ships,fleetPlaced:true};
       response=preparation;
     }else if(path==='/api/matches/me/placement/random'){
       calls.random++;
       preparation={...preparation,revision:preparation.revision+1,yourShips:structuredClone(randomShips),fleetPlaced:true};
       response=preparation;
     }else if(path==='/api/matches/me/placement/confirm'){
       calls.confirm++;
       if(!preparation.fleetPlaced||preparation.yourShips.length!==mode.fleet.length)
         return route.fulfill({status:409,contentType:'application/json',body:'{"code":"FLEET_INCOMPLETE"}'});
       preparation={...preparation,revision:preparation.revision+1,fleetConfirmed:true};
       response=preparation;
     }
     if(response!==null)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
     if(path==='/api/realtime/ticket')return route.fulfill({status:503,contentType:'application/json',body:'{"code":"UNAVAILABLE"}'});
     return route.fulfill({status:404,contentType:'application/json',body:'{}'});
   });

   await page.goto('http://127.0.0.1:4182/',{waitUntil:'domcontentloaded'});
   await page.locator('#email').fill('qa@example.test');
   await page.locator('#password').fill('valid-password');
   await page.locator('[data-form="login"] button[type="submit"]').click();
   await page.locator('body[data-route="placement"] .bn-placement-screen').waitFor({timeout:15000});

   async function shipCells(){return page.locator('.bn-placement-board-wrap .cell.ship').count();}
   async function clickCell(row,col){await page.locator('.bn-placement-board-wrap [data-coord="'+row+','+col+'"]').click();}
   assert.equal(await page.locator('.bn-placement-board-wrap .cell').count(),100);
   assert.equal(await page.locator('.bn-placement-ship').count(),5);
   assert.equal(await page.locator('.bn-placement-ship.is-selected').count(),1);
   assert.equal(await page.locator('.bn-placement-confirm').isDisabled(),true);

   // Viewport is a fixed-height game screen, not a long scrollable document.
   // Checking the CTA rect (not just CSS overflow:hidden) catches clipped actions.
   const geometry=await page.evaluate(()=>{
     const rect=selector=>{
       const el=document.querySelector(selector);
       if(!el)throw Error('Missing '+selector);
       const r=el.getBoundingClientRect();
       return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
     };
     const tile=document.querySelector('.bn-placement-board-wrap .cell');
     return {
       viewportWidth:innerWidth,viewportHeight:innerHeight,
       docWidth:document.documentElement.scrollWidth,
       docHeight:document.documentElement.scrollHeight,
       header:rect('.bn-placement-header'),
       hint:rect('.bn-placement-instruction'),
       board:rect('.bn-placement-board-wrap .board-main'),
       cards:rect('.bn-placement-fleet'),
       tools:rect('.bn-placement-tools'),
       progress:rect('.bn-placement-progress'),
       confirm:rect('.bn-placement-confirm'),
       exit:rect('.bn-placement-exit'),
       cellBorder:getComputedStyle(tile).borderStyle,
     };
   });
   const context=viewport.width+'x'+viewport.height+' '+JSON.stringify(geometry);
   assert.ok(geometry.docWidth<=geometry.viewportWidth+2,'Horizontal document scroll: '+context);
   assert.ok(geometry.docHeight<=geometry.viewportHeight+2,'Vertical document scroll: '+context);
   assert.ok(geometry.board.width>=190,'Board collapsed too far: '+context);
   assert.ok(Math.abs(geometry.board.height-geometry.board.width)<3,'Board distorted: '+context);
   assert.equal(geometry.cellBorder,'solid','Original board borders must remain solid: '+context);
   for (const key of ['header','hint','board','cards','tools','progress','confirm','exit']){
     const box=geometry[key];
     assert.ok(box.left>=-2&&box.right<=geometry.viewportWidth+2,'Offscreen horizontally '+key+': '+context);
     assert.ok(box.top>=-2&&box.bottom<=geometry.viewportHeight+2,'Offscreen vertically '+key+': '+context);
   }
   if(viewport.width<850){
     assert.ok(geometry.board.bottom<=geometry.cards.top+3,'Fleet overlaps board mobile: '+context);
     assert.ok(geometry.cards.bottom<=geometry.tools.top+3,'Actions overlap fleet mobile: '+context);
     assert.ok(geometry.tools.bottom<=geometry.progress.top+3,'Progress overlaps tools mobile: '+context);
     assert.ok(geometry.progress.bottom<=geometry.confirm.top+3,'CTA overlaps status mobile: '+context);
   }else{
     assert.ok(geometry.board.right<=geometry.cards.left+3,'Fleet must sit alongside board desktop: '+context);
   }
   await page.screenshot({path:'artifacts/figma-placement/fleet-empty-'+viewport.width+'.png',fullPage:true});

   // No out-of-bounds placement can overwrite the draft.
   await clickCell(0,8);
   assert.equal(await shipCells(),0);
   await clickCell(0,0);
   assert.equal(await shipCells(),5);

   // Select a later ship, rotate it and place vertically.
   await page.locator('[data-action="select-placement-ship"][data-item-id="SUBMARINE"]').click();
   assert.equal(await page.locator('[data-item-id="SUBMARINE"]').getAttribute('aria-pressed'),'true');
   await page.locator('[data-action="rotate-placement"]').click();
   await clickCell(5,8);
   assert.equal(await shipCells(),8);

   // Selecting the already placed submarine preserves its orientation.
   await page.locator('[data-item-id="SUBMARINE"]').click();
   await page.locator('[data-action="rotate-placement"]').click();
   await clickCell(6,0);
   assert.equal(await shipCells(),8);
   assert.equal(await page.locator('.bn-placement-board-wrap [data-coord="5,8"].ship').count(),0);

   // Clearing removes only the unsaved client draft and resets ship ordering.
   await page.locator('[data-action="clear-draft"]').click();
   assert.equal(await shipCells(),0);
   assert.equal(await page.locator('.bn-placement-confirm').isDisabled(),true);

   // Random is generated and persisted by the server, never by the frontend.
   await page.locator('[data-action="random-placement"]').click();
   await page.waitForFunction(()=>document.querySelectorAll('.bn-placement-board-wrap .cell.ship').length===17);
   assert.equal(calls.random,1);
   assert.equal(await shipCells(),17);
   assert.equal(await page.locator('.bn-placement-confirm').isEnabled(),true);
   await page.screenshot({path:'artifacts/figma-placement/fleet-random-'+viewport.width+'.png',fullPage:true});

   // Replace the server's random layout by manually editing all five ships.
   await page.locator('[data-action="clear-draft"]').click();
   for(let row=0;row<5;row++)await clickCell(row,0);
   assert.equal(await shipCells(),17);
   assert.equal(await page.locator('.bn-placement-confirm').isEnabled(),true);
   await page.locator('.bn-placement-confirm').click();
   await page.waitForFunction(()=>document.querySelector('.bn-placement-confirm')?.disabled
     && /confirmadas/i.test(document.querySelector('.bn-placement-confirm')?.textContent||''));
   assert.equal(calls.put.length,1,'Manual fleet must be validated/persisted on API before confirming');
   assert.equal(calls.put[0].length,5,'Server must receive all five ship placements');
   assert.equal(new Set(calls.put[0].map(s=>s.type)).size,5);
   assert.equal(calls.confirm,1,'Server confirmation must be called');
   assert.equal(await page.locator('.bn-placement-confirm').isDisabled(),true);
   assert.match(await page.locator('.bn-placement-confirm').innerText(),/confirmadas/i);
   await page.screenshot({path:'artifacts/figma-placement/fleet-confirmed-'+viewport.width+'.png',fullPage:true});

   assert.deepEqual(errors,[],'JavaScript errors '+viewport.width);
   console.log('PASS Figma placement '+viewport.width+'x'+viewport.height+
     ': existing 100-cell board, selected/rotated/replaced, clear, server random, server confirm');
   await page.close();
 }
}finally{
 await browser.close();
 await server.close();
}
