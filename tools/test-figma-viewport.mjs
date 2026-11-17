// Headless browser regression: real CSS/layout with fake API responses (test-only).
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const modes=[{
 id:'classic',name:'Clássico',geometry:{kind:'RECTANGULAR',rows:10,columns:10,
 cells:Array.from({length:100},(_,i)=>({row:Math.floor(i/10),col:i%10}))},
 placementDirections:['HORIZONTAL','VERTICAL'],
 fleet:[{id:'CARRIER',length:5},{id:'BATTLESHIP',length:4},{id:'CRUISER',length:3},
        {id:'SUBMARINE',length:3},{id:'DESTROYER',length:2}]
}];
const player={id:13,nickname:'Almirante Vitão',email:'capitao@example.test',avatarId:'captain'};
const vite=await createServer({server:{host:'127.0.0.1',port:4178,strictPort:true},logLevel:'error'});
await vite.listen();
const browser=await chromium.launch({headless:true});
await mkdir('artifacts/figma-responsive',{recursive:true});
const errors=[];
try {
 for(const viewport of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:1361,height:597},{width:1366,height:768}]){
  const page=await browser.newPage({viewport,deviceScaleFactor:1});
  page.on('pageerror',error=>errors.push(String(viewport.width)+': '+error.message));
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   const body=path==='/api/auth/login'?{tokenType:'Bearer',accessToken:'test-token',refreshToken:'test-refresh',expiresIn:900,user:player}:
     path==='/api/users/me'?player:
     path==='/api/game-modes'?modes:
     path==='/api/store'?{credits:300,items:[
       {id:'skin_default',category:'SKIN',name:'Frota Original',description:'Visual padrão',price:0,enabled:true,owned:true,equipped:true},
       {id:'skin_coral',category:'SKIN',name:'Coral',description:'Personalização',price:90,enabled:true,owned:false,equipped:false},
       {id:'sound_sonar',category:'SOUND',name:'Sonar',description:'Em breve',price:90,enabled:false,owned:false,equipped:false}
     ]}:null;
   if(body!==null)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
   if(path==='/api/matchmaking/lobbies/me')return route.fulfill({status:404,contentType:'application/json',body:'{"code":"NOT_FOUND"}'});
   if(path==='/api/realtime/ticket')return route.fulfill({status:503,contentType:'application/json',body:'{"code":"UNAVAILABLE"}'});
   return route.fulfill({status:404,body:'{}'});
  });
  await page.goto('http://127.0.0.1:4178/',{waitUntil:'domcontentloaded'});
  await page.locator('[data-form="login"]').waitFor();
  async function horizontalFit(label) {
   const size=await page.evaluate(()=>({width:window.innerWidth,doc:document.documentElement.scrollWidth}));
   assert.ok(size.doc<=size.width+2,label+' '+viewport.width+': document wider than viewport '+JSON.stringify(size));
  }
  await horizontalFit('login');
  if(viewport.width===375)await page.screenshot({path:'artifacts/figma-responsive/login-375x667.png',fullPage:true});
  await page.locator('#email').fill('capitao@example.test');
  await page.locator('#password').fill('a-secure-password');
  await page.locator('[data-form="login"] button[type="submit"]').click();
  await page.locator('.bn-lobby').waitFor({timeout:18000});
  await horizontalFit('lobby');
  // Desktop is a real responsive composition, not the 540px portrait shell
  // stretched into a PC screenshot. Retain the approved mobile layout.
  if (viewport.width>=900) {
    const geometry=await page.evaluate(()=>{
      const box=selector=>document.querySelector(selector).getBoundingClientRect();
      const shell=box('body[data-route="lobby"] .shell');
      const event=box('.bn-feature-card');
      const news=box('.bn-news-grid');
      const rank=box('.bn-rank-card');
      const lobby=box('.bn-lobby');
      return {shellWidth:shell.width,viewport:innerWidth,lobbyWidth:lobby.width,
        eventRight:event.right,newsLeft:news.left,
        eventTop:event.top,rankBottom:rank.bottom};
    });
    assert.ok(geometry.shellWidth>=geometry.viewport*.95,
      'desktop lobby must use viewport width: '+JSON.stringify(geometry));
    assert.ok(geometry.lobbyWidth>=800,
      'desktop lobby should not be locked to portrait width: '+JSON.stringify(geometry));
    assert.ok(geometry.newsLeft>=geometry.eventRight-3,
      'desktop news should be beside the event: '+JSON.stringify(geometry));
    assert.ok(geometry.eventTop<geometry.rankBottom,
      'desktop event should visually anchor both right-side rows: '+JSON.stringify(geometry));
  }
  const join=page.locator('[data-action="open-join-modal"]');
  await join.evaluate(el=>el.scrollIntoView({block:'end'}));
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  const visible=await page.evaluate(()=>{
    const join=document.querySelector('[data-action="open-join-modal"]').getBoundingClientRect();
    const nav=document.querySelector('.bn-bottom-nav').getBoundingClientRect();
    return {joinBottom:join.bottom,navTop:nav.top,navBottom:nav.bottom,viewport:innerHeight};
  });
  assert.ok(visible.joinBottom<=visible.navTop+2,'lobby '+viewport.width+': join behind nav '+JSON.stringify(visible));
  if(viewport.width===375||viewport.width===1361||viewport.width===1366)await page.screenshot({path:'artifacts/figma-responsive/lobby-'+viewport.width+'.png',fullPage:true});
  await join.click();
  const dialog=page.locator('#tp-join-dialog');
  await dialog.waitFor({state:'visible'});
  await page.getByRole('button',{name:'Fechar janela'}).click();
  await page.locator('.bn-nav-fleet').click();
  await page.locator('.bn-fleet-page').waitFor();
  await horizontalFit('fleet');
  assert.equal(await page.locator('.bn-ship-item').count(),5,'fleet should follow API');
  if(viewport.width===375||viewport.width===1366)await page.screenshot({path:'artifacts/figma-responsive/fleet-'+viewport.width+'.png',fullPage:true});
  await page.locator('.bn-nav-store').click();
  await page.locator('.bn-store-page').waitFor();
  await horizontalFit('store');
  await page.locator('.tp-store-card').first().waitFor();
  assert.equal(await page.locator('.tp-store-card').count(),3,'store must display live API items');
  assert.match(await page.locator('.tp-store-wallet').innerText(),/300/);
  if(viewport.width===375)await page.screenshot({path:'artifacts/figma-responsive/store-375.png',fullPage:true});
  await page.locator('.bn-header-identity').click();
  await page.locator('.bn-profile-page').waitFor();
  await horizontalFit('profile');
  if(viewport.width===375)await page.screenshot({path:'artifacts/figma-responsive/profile-375.png',fullPage:true});
  await page.close();
  console.log('PASS '+viewport.width+'x'+viewport.height+': login, lobby, room dialog, fleet, store and profile; no horizontal overflow or nav overlap');
 }
 assert.deepEqual(errors,[],'Browser errors: '+errors.join('; '));
}finally{
 await browser.close();
 await vite.close();
}
