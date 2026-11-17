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
const randomShips=mode.fleet.map((s,index)=>({type:s.id,row:index,col:0,orientation:'HORIZONTAL'}));
const server=await createServer({server:{host:'127.0.0.1',port:4182,strictPort:true},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true});
await mkdir('artifacts/figma-placement',{recursive:true});

try {
 for(const viewport of [{width:375,height:667},{width:1366,height:768}]){
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
   await page.locator('.bn-placement-confirm').waitFor({state:'visible'});
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
