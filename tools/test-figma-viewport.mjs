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
  let premiumCredits=0,topups=0,lastWallet=null;
  page.on('dialog',dialog=>dialog.accept());
  page.on('pageerror',error=>errors.push(String(viewport.width)+': '+error.message));
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/api/store/demo-premium'&&route.request().method()==='POST'){
    const payload=route.request().postDataJSON();assert.equal(payload.packId,'demo_100');assert.ok(payload.requestId);
    topups++;premiumCredits+=100;lastWallet={...lastWallet,premiumCredits};
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(lastWallet)});
   }
   const body=path==='/api/auth/login'?{tokenType:'Bearer',accessToken:'test-token',refreshToken:'test-refresh',expiresIn:900,user:player}:
     path==='/api/users/me'?player:
     path==='/api/game-modes'?modes:
     path==='/api/store'?{credits:300,premiumCredits,demoPremiumEnabled:true,items:[
       {id:'skin_default',category:'SKIN',name:'Frota Original',description:'Visual padrão',price:0,enabled:true,owned:true,equipped:true},
       {id:'skin_coral',category:'SKIN',name:'Coral',description:'Personalização',price:90,premiumPrice:30,enabled:true,owned:false,equipped:false},
       {id:'sound_sonar',category:'SOUND',name:'Sonar',description:'Em breve',price:90,enabled:false,owned:false,equipped:false}
     ]}:null;
   if(path==='/api/store')lastWallet=body;
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
  async function assertStickyAccountHeader(label) {
    const measure=await page.evaluate(async()=>{
      const header=document.querySelector('.bn-topbar');
      const main=document.querySelector('.main');
      const spacer=document.createElement('div');
      spacer.style.height='120vh';
      spacer.setAttribute('aria-hidden','true');
      main.appendChild(spacer);
      window.scrollTo(0,180);
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const result={
        position:getComputedStyle(header).position,
        top:header.getBoundingClientRect().top,
        scrollY:window.scrollY,
        identityVisible:header.querySelector('.bn-header-identity')?.getBoundingClientRect().height>0,
        menuVisible:header.querySelector('.bn-account-menu summary')?.getBoundingClientRect().height>0
      };
      spacer.remove();
      window.scrollTo(0,0);
      return result;
    });
    assert.equal(measure.position,'sticky',label+': header must be sticky');
    assert.ok(measure.scrollY>50,label+': scroll did not happen '+JSON.stringify(measure));
    assert.ok(Math.abs(measure.top)<4,label+': header left top of viewport '+JSON.stringify(measure));
    assert.ok(measure.identityVisible&&measure.menuVisible,
      label+': user identity and menu must remain visible '+JSON.stringify(measure));
  }

  await horizontalFit('login');
  if(viewport.width===375)await page.screenshot({path:'artifacts/figma-responsive/login-375x667.png',fullPage:true});
  await page.locator('#email').fill('capitao@example.test');
  await page.locator('#password').fill('a-secure-password');
  await page.locator('[data-form="login"] button[type="submit"]').click();
  await page.locator('.bn-lobby').waitFor({timeout:18000});
  await horizontalFit('lobby');
  const measureHeader=()=>page.evaluate(()=>{
    const header=document.querySelector('.bn-shared-header');
    const measure=sel=>{const el=header.querySelector(sel),box=el.getBoundingClientRect(),style=getComputedStyle(el);return {width:box.width,height:box.height,font:style.fontSize,family:style.fontFamily};};
    return {avatar:measure('.bn-header-avatar'),image:measure('.bn-header-avatar img'),name:measure('.bn-header-player strong'),menu:measure('.bn-account-menu summary')};
  });
  const lobbyHeader=await measureHeader();
  const assertSameHeader=async route=>{
    const actual=await measureHeader();
    for(const key of ['avatar','image','menu']){
      assert.ok(Math.abs(actual[key].width-lobbyHeader[key].width)<1&&Math.abs(actual[key].height-lobbyHeader[key].height)<1,route+' header asset mismatch '+key);
    }
    assert.equal(actual.name.font,lobbyHeader.name.font,route+' nickname size mismatch');
    assert.equal(actual.name.family,lobbyHeader.name.family,route+' nickname font mismatch');
  };
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
  await assertStickyAccountHeader('fleet');
  await assertSameHeader('fleet');
  assert.equal(await page.locator('.bn-wallet-pills').count(),0);
  assert.equal(await page.locator('.bn-ship-item').count(),5,'fleet should follow API');
  if(viewport.width===375||viewport.width===1366)await page.screenshot({path:'artifacts/figma-responsive/fleet-'+viewport.width+'.png',fullPage:true});
  await page.locator('.bn-nav-store').click();
  await page.locator('.bn-store-page').waitFor();
  await horizontalFit('store');
  await assertStickyAccountHeader('store');
  await assertSameHeader('store');
  await page.locator('.tp-store-card').first().waitFor();
  assert.equal(await page.locator('.tp-store-card').count(),3,'store must display live API items');
  const storeLayout=await page.evaluate(()=>{
    const rect=selector=>document.querySelector(selector).getBoundingClientRect();
    const nav=document.querySelector('.bn-store-categories');
    const hero=rect('.is-featured .tp-store-preview'),card=rect('.is-featured');
    const regular=rect('.tp-store-grid .tp-store-card'),thumb=rect('.tp-store-grid .tp-store-preview'),copy=rect('.tp-store-grid .tp-store-card-text');
    const buttons=[...document.querySelectorAll('.is-featured .tp-store-card-footer .btn')].map(el=>{const b=el.getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,height:b.height};});
    return {regularHeight:regular.height,thumbWidth:thumb.width,thumbHeight:thumb.height,thumbRight:thumb.right,copyLeft:copy.left,buttons,page:rect('.tp-store-page').width,featured:rect('.bn-store-featured').width,heroWidth:hero.width,heroHeight:hero.height,cardWidth:card.width,cardTop:card.top,heroTop:hero.top,navWidth:nav.clientWidth,navScroll:nav.scrollWidth,navHeight:nav.clientHeight,navDisplay:getComputedStyle(nav).display,artFit:document.querySelector('.is-featured svg')?.getAttribute('preserveAspectRatio')};
  });
  assert.ok(storeLayout.featured>=storeLayout.page-4,'Hero spans catalog width: '+JSON.stringify(storeLayout));
  assert.equal(storeLayout.navDisplay,'flex');
  assert.ok(storeLayout.navHeight<70,'Categories must remain a single row');
  if(viewport.width>=850){
    assert.ok(storeLayout.page<=1122&&storeLayout.heroHeight<=254,'Desktop hero must remain shallow: '+JSON.stringify(storeLayout));
    assert.ok(storeLayout.heroWidth<storeLayout.cardWidth*.65,'Desktop hero uses artwork and copy side by side');
  }else{
    assert.ok(storeLayout.heroWidth>=storeLayout.cardWidth-4,'Mobile hero cover must use full card width');
    assert.ok(storeLayout.heroHeight<=138,'Mobile hero art must be compact: '+JSON.stringify(storeLayout));
    assert.ok(storeLayout.thumbWidth<=118&&storeLayout.thumbHeight<=118&&storeLayout.thumbRight<=storeLayout.copyLeft+1,'Mobile products use bounded thumbnails beside details: '+JSON.stringify(storeLayout));
    assert.ok(storeLayout.regularHeight<=205,'Simple mobile product should be compact: '+JSON.stringify(storeLayout));
    assert.equal(storeLayout.buttons.length,2);
    assert.ok(Math.abs(storeLayout.buttons[0].top-storeLayout.buttons[1].top)<2&&storeLayout.buttons.every(b=>b.height>=39),'Purchase currencies should share one accessible row: '+JSON.stringify(storeLayout));
    assert.ok(storeLayout.navScroll>storeLayout.navWidth,'Mobile categories should scroll horizontally');
  }
  assert.equal(storeLayout.artFit,'xMidYMid meet','Fallback artwork must never be cropped');
  assert.match(await page.locator('.bn-wallet-pill.is-free strong').innerText(),/300/);
  assert.equal(await page.locator('.bn-wallet-pills').count(),1,'Store must display only one wallet in the sticky header');
  assert.equal(await page.locator('.bn-store-wallet').count(),0,'Redundant store wallet must be removed');
  assert.equal(await page.locator('.bn-wallet-add').count(),2);
  const connection=page.locator('.bn-topbar [data-socket-status]');
  await connection.waitFor({state:'visible'});
  assert.equal(await connection.getAttribute('data-online'),'false');
  assert.equal(await connection.innerText(),'Reconectando');
  assert.equal(await connection.locator('.tp-live-dot').evaluate(dot=>getComputedStyle(dot).backgroundColor),'rgb(245, 167, 66)');
  const headerPositions=await page.evaluate(()=>{
    const status=document.querySelector('.bn-topbar [data-socket-status]').getBoundingClientRect();
    const wallet=document.querySelector('.bn-topbar .bn-wallet-pills').getBoundingClientRect();
    const menu=document.querySelector('.bn-topbar .bn-account-menu summary').getBoundingClientRect();
    return {statusRight:status.right,statusBottom:status.bottom,statusCenter:(status.top+status.bottom)/2,walletLeft:wallet.left,walletTop:wallet.top,menuLeft:menu.left,menuCenter:(menu.top+menu.bottom)/2};
  });
  if(viewport.width<=760){
    assert.ok(headerPositions.statusBottom<=headerPositions.walletTop+1&&headerPositions.statusRight<=headerPositions.menuLeft+1&&Math.abs(headerPositions.statusCenter-headerPositions.menuCenter)<2,'Mobile connection status must be beside the menu, above the wallet: '+JSON.stringify(headerPositions));
  }else{
    assert.ok(headerPositions.statusRight<=headerPositions.walletLeft+1,'Desktop connection status must precede wallet: '+JSON.stringify(headerPositions));
  }
  await horizontalFit('wallet with connection warning');
  await page.locator('.bn-wallet-add[data-item-id="free"]').click();
  await page.locator('#bn-wallet-dialog[open]').waitFor();
  assert.match(await page.locator('#bn-wallet-dialog').innerText(),/Ganhe moedas Marinha/);
  assert.equal(await page.locator('[data-action="store-demo-topup"]').count(),0);
  await page.locator('[data-action="wallet-currency"][data-item-id="premium"]').click();
  await page.locator('#bn-wallet-dialog[open]').waitFor();
  assert.match(await page.locator('#bn-wallet-dialog').innerText(),/moedas Naval/i);
  assert.equal(await page.locator('#bn-wallet-dialog [data-action="store-demo-topup"]').count(),3);
  await page.locator('#bn-wallet-dialog [data-item-id="demo_100"]').click();
  await page.waitForFunction(()=>document.querySelector('.bn-wallet-pill.is-premium strong')?.textContent==='100');
  assert.equal(topups,1,'Top-up should call the server exactly once');
  assert.equal(await page.locator('#bn-wallet-dialog[open]').count(),1,'Wallet dialog stays open after purchase');
  await page.locator('#bn-wallet-dialog [data-action="store-demo-topup"]').first().waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('#bn-wallet-dialog [data-action="store-demo-topup"]')?.disabled);
  await page.keyboard.press('Escape');
  await page.locator('#bn-wallet-dialog').waitFor({state:'detached'});
  assert.equal(await page.locator('#tp-notice-root .tp-notice').count(),0,'Wallet feedback must not block the header after closing');
  await page.locator('[data-action="store-category"][data-item-id="SKIN"]').click();
  assert.equal(await page.locator('[data-action="store-category"][data-item-id="SKIN"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-action="store-category"][data-item-id="ALL"]').click();
  if(viewport.width===375||viewport.width===1366)await page.screenshot({path:'artifacts/figma-responsive/store-'+viewport.width+'.png',fullPage:true});
  await page.locator('.bn-header-identity').click();
  await page.locator('.bn-profile-stage').waitFor();
  await horizontalFit('profile');
  assert.equal(await page.locator('.bn-profile-captain').count(),1,'profile captain details must be visible');
  assert.equal(await page.locator('.bn-profile-statistics').count(),1,'profile statistics panel must be visible');
  assert.equal(await page.locator('.bn-profile-achievements').count(),1,'profile achievements panel must be visible');
  assert.equal(await page.locator('.bn-profile-history').count(),1,'profile history panel must be visible');
  assert.equal(await page.locator('.bn-profile-stat').count(),4);
  assert.equal(await page.locator('.bn-profile-achievement').count(),4);
  if(viewport.width===375||viewport.width===1366)await page.screenshot({path:'artifacts/figma-responsive/profile-'+viewport.width+'.png',fullPage:true});
  await page.close();
  console.log('PASS '+viewport.width+'x'+viewport.height+': login, lobby, room dialog, fleet, store and profile; no horizontal overflow or nav overlap');
 }
 assert.deepEqual(errors,[],'Browser errors: '+errors.join('; '));
}finally{
 await browser.close();
 await vite.close();
}
