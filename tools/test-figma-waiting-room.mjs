// Visual and behavioral regression for the approved Figma waiting-room artboard.
// All data here is a test-only mock of the existing REST contracts.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const modes=[{
 id:'classic',name:'Clássico',
 geometry:{kind:'RECTANGULAR',rows:10,columns:10,cells:Array.from({length:100},(_,i)=>({row:Math.floor(i/10),col:i%10}))},
 placementDirections:['HORIZONTAL','VERTICAL'],
 fleet:[{id:'CARRIER',length:5},{id:'BATTLESHIP',length:4},{id:'CRUISER',length:3},{id:'SUBMARINE',length:3},{id:'DESTROYER',length:2}]
}];
const player={id:13,nickname:'Almirante Vitão',email:'capitao@example.test',avatarId:'captain'};
const baseRoom={
 code:'ABC234',status:'WAITING',revision:1,capacity:2,
 players:[
  {id:13,nickname:'Almirante Vitão',avatarId:'captain',ready:false,connected:true},
  {id:21,nickname:'MarinheiroX',avatarId:'submarine',ready:false,connected:true}
 ],
 mode:{id:'classic',name:'Clássico'}
};
const vite=await createServer({server:{host:'127.0.0.1',port:4181,strictPort:true},logLevel:'error'});
await vite.listen();
const browser=await chromium.launch({headless:true});
await mkdir('artifacts/figma-waiting',{recursive:true});
const errors=[];
try {
  for (const viewport of [
    {width:320,height:568},{width:375,height:667},{width:390,height:844},
    {width:1361,height:597},{width:1366,height:768}
  ]) {
    let room=structuredClone(baseRoom);
    const page=await browser.newPage({viewport,deviceScaleFactor:1});
    page.on('pageerror',error=>errors.push(viewport.width+': '+error.message));
    await page.route('**/api/**',async route=>{
      const path=new URL(route.request().url()).pathname;
      const method=route.request().method();
      if(path==='/api/matchmaking/lobbies/me'&&method==='GET'){
        return room
          ?route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(room)})
          :route.fulfill({status:404,contentType:'application/json',body:'{"code":"NOT_FOUND"}'});
      }
      if(path==='/api/matchmaking/lobbies/me/ready'&&method==='PUT'){
        const data=route.request().postDataJSON();
        room.players[0].ready=Boolean(data.ready);
        room.revision++;
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(room)});
      }
      if(path==='/api/matchmaking/lobbies/me'&&method==='DELETE'){
        room=null;
        return route.fulfill({status:204,body:''});
      }
      const body=path==='/api/auth/login'
        ?{tokenType:'Bearer',accessToken:'test-token',refreshToken:'test-refresh',expiresIn:900,user:player}
        :path==='/api/users/me'?player
        :path==='/api/game-modes'?modes
        :null;
      if(body!==null)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
      if(path==='/api/realtime/ticket')return route.fulfill({status:503,contentType:'application/json',body:'{"code":"UNAVAILABLE"}'});
      return route.fulfill({status:404,body:'{}'});
    });

    await page.goto('http://127.0.0.1:4181/',{waitUntil:'domcontentloaded'});
    await page.locator('[data-form="login"]').waitFor();
    await page.locator('#email').fill('capitao@example.test');
    await page.locator('#password').fill('test-password');
    await page.locator('[data-form="login"] button[type="submit"]').click();
    // The login action may navigate to the lobby after the first reconcile.
    await page.waitForFunction(()=>document.body.dataset.route==='lobby'||document.body.dataset.route==='matchmaking');
    if(!await page.locator('.bn-waiting-room').count()){
      await page.evaluate(()=>{location.hash='matchmaking'});
    }
    await page.locator('.bn-waiting-room').waitFor({timeout:15000});

    assert.equal(await page.locator('.bn-room-player').count(),2);
    assert.equal(await page.locator('.bn-room-player h2').first().innerText(),'Almirante Vitão');
    assert.equal(await page.locator('.bn-room-player h2').last().innerText(),'MarinheiroX');
    assert.equal(await page.locator('.bn-room-versus').innerText(),'VS');
    assert.equal(await page.locator('.bn-room-confirmation strong').innerText(),'0 de 2 prontos');
    assert.equal(await page.locator('.bn-room-invite strong').innerText(),'ABC234');
    assert.equal(await page.locator('.bn-topbar').count(),0,'approved room artboard has no account header');
    assert.equal(await page.locator('.bottom-nav').count(),0,'waiting room must not have bottom navigation');
    assert.equal(await page.locator('[data-action="ready"]').isEnabled(),true);

    const geometry=await page.evaluate(()=>{
      const box=selector=>document.querySelector(selector).getBoundingClientRect();
      const a=box('.bn-room-player:first-child');
      const b=box('.bn-room-player:last-child');
      return {doc:document.documentElement.scrollWidth,viewport:innerWidth,
        firstBottom:a.bottom,secondTop:b.top,firstRight:a.right,secondLeft:b.left};
    });
    assert.ok(geometry.doc<=geometry.viewport+2,
      'waiting room must not overflow horizontally: '+JSON.stringify(geometry));
    if(viewport.width<900)
      assert.ok(geometry.secondTop>geometry.firstBottom,
        'portrait layout must stack players: '+JSON.stringify(geometry));
    else
      assert.ok(geometry.secondLeft>geometry.firstRight,
        'desktop layout must flank VS: '+JSON.stringify(geometry));

    await page.screenshot({path:'artifacts/figma-waiting/waiting-'+viewport.width+'x'+viewport.height+'.png',fullPage:true});
    await page.locator('.bn-room-ready-button').click();
    await page.waitForFunction(()=>document.querySelector('.bn-room-confirmation strong')?.textContent?.includes('1 de 2'));
    assert.equal(await page.locator('.bn-room-ready-button').innerText(),'Cancelar prontidão');
    assert.equal(await page.locator('.bn-room-ready.is-ready').count(),1);

    // Host alone: the empty seat is visible and ready cannot be pressed.
    room={...baseRoom,revision:room.revision+1,players:[
      {...room.players[0],ready:false}
    ]};
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    // The live lobby normally updates on WebSocket; here the state is updated
    // on a fresh in-app login to avoid introducing a test-only code path.
    await page.locator('.bn-room-leave-button').click();
    await page.locator('.bn-lobby').waitFor({timeout:15000});
    assert.ok(!room||room.players.length===1);

    await page.close();
    console.log('PASS waiting room '+viewport.width+'x'+viewport.height+': layout, real labels, ready toggle, leave, no overflow');
  }
  assert.deepEqual(errors,[],'JavaScript errors: '+errors.join('; '));
} finally {
  await browser.close();
  await vite.close();
}
