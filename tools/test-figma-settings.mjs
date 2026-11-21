// Browser coverage of the approved Figma settings screen and active account controls.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const profile={id:13,nickname:'Almirante Vitão',email:'capitao@example.test',avatarId:'captain'};
const mode={id:'classic',name:'Clássico',placementDirections:['HORIZONTAL','VERTICAL'],
 geometry:{kind:'RECTANGULAR',rows:10,columns:10,cells:Array.from({length:100},(_,i)=>({row:Math.floor(i/10),col:i%10}))},
 fleet:[{id:'CARRIER',length:5},{id:'BATTLESHIP',length:4},{id:'CRUISER',length:3},{id:'SUBMARINE',length:3},{id:'DESTROYER',length:2}]};
const server=await createServer({server:{host:'127.0.0.1',port:4185,strictPort:true},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true});
await mkdir('artifacts/figma-settings',{recursive:true});
try{
 for(const viewport of [
  {width:320,height:568},{width:375,height:667},{width:390,height:844},
  {width:1363,height:602},{width:1366,height:768}
 ]){
  const errors=[];
  let logouts=0;
  const page=await browser.newPage({viewport,deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/api/auth/logout'&&route.request().method()==='POST'){
    logouts++;
    return route.fulfill({status:204,body:''});
   }
   const response=path==='/api/auth/login'?
    {tokenType:'Bearer',accessToken:'qa-token',refreshToken:'qa-refresh',expiresIn:900,user:profile}:
    path==='/api/users/me'?profile:
    path==='/api/game-modes'?[mode]:null;
   if(response!==null)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
   if(path==='/api/realtime/ticket')return route.fulfill({status:503,contentType:'application/json',body:'{"code":"UNAVAILABLE"}'});
   return route.fulfill({status:404,contentType:'application/json',body:'{}'});
  });
  async function login(){
   await page.locator('[data-form="login"]').waitFor({timeout:15000});
   await page.locator('#email').fill('capitao@example.test');
   await page.locator('#password').fill('strong-password');
   await page.locator('[data-form="login"] button[type="submit"]').click();
   await page.locator('.bn-lobby').waitFor({timeout:15000});
  }
  async function openSettings(){
   await page.locator('.bn-account-menu summary').click();
   await page.locator('.tp-account-popover [data-go="settings"]').click();
   await page.locator('body[data-route="settings"] .bn-settings-stage').waitFor({timeout:15000});
  }
  await page.goto('http://127.0.0.1:4185/',{waitUntil:'domcontentloaded'});
  await login();
  await openSettings();

  assert.equal(await page.locator('#bn-settings-title').innerText(),'Configurações');
  for(const x of ['sound','game','account'])
   assert.equal(await page.locator('.bn-settings-'+x).count(),1,'Missing Figma section '+x);
  assert.equal(await page.locator('.bn-settings-switch').count(),4);
  assert.equal(await page.locator('.bn-settings-account-link small').innerText(),profile.email);
  assert.equal(await page.locator('.bn-settings-footer p').innerText(),'Versão 0.1.0');
  for(const [key,expected] of [['music','true'],['effects','true'],['vibration','true'],['notifications','false']])
   assert.equal(await page.locator('[data-action="toggle-setting"][data-item-id="'+key+'"]').getAttribute('aria-checked'),expected);

  const geometry=await page.evaluate(()=>{
   const box=selector=>{
    const node=document.querySelector(selector);
    if(!node)throw Error('Missing '+selector);
    const r=node.getBoundingClientRect();
    return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
   };
   const scene=document.querySelector('.bn-settings-stage');
   return {w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,
    sh:document.documentElement.scrollHeight,heading:box('.bn-settings-heading'),
    sound:box('.bn-settings-sound'),game:box('.bn-settings-game'),
    account:box('.bn-settings-account'),logout:box('.bn-settings-logout'),
    version:box('.bn-settings-footer p'),
    bg:getComputedStyle(scene).backgroundImage,
    bgSize:getComputedStyle(scene).backgroundSize,
    crop:getComputedStyle(scene,'::before').backgroundImage};
  });
  const explain=viewport.width+'x'+viewport.height+' '+JSON.stringify(geometry);
  assert.ok(geometry.sw<=geometry.w+2,'Horizontal overflow: '+explain);
  assert.ok(geometry.sh<=geometry.h+2,'Vertical overflow: '+explain);
  assert.ok(geometry.bg.includes('storm.jpg'),'Approved storm background missing: '+explain);
  for(const part of ['heading','sound','game','account','logout','version']){
   const r=geometry[part];
   assert.ok(r.left>=-2&&r.right<=geometry.w+2&&r.width>0,'Horizontal clip '+part+': '+explain);
   assert.ok(r.top>=-2&&r.bottom<=geometry.h+2&&r.height>0,'Vertical clip '+part+': '+explain);
  }
  if(viewport.width<850){
   assert.ok(geometry.sound.bottom<=geometry.game.top+2&&geometry.game.bottom<=geometry.account.top+2,
    'Mobile cards not stacked: '+explain);
   assert.ok(geometry.account.bottom<=geometry.logout.top+2,'Logout overlaps account: '+explain);
   assert.ok(geometry.bgSize.includes('auto 100%'),'Portrait painting must use full vertical crop: '+explain);
  }else{
   assert.ok(geometry.game.right<=geometry.account.left+2,'Desktop panels should be side-by-side: '+explain);
   assert.ok(geometry.crop.includes('storm.jpg'),'Desktop must preserve left-hand ship foreground: '+explain);
  }
  await page.screenshot({path:'artifacts/figma-settings/settings-'+viewport.width+'x'+viewport.height+'.png',fullPage:true});

  // Real controls: persisted toggles and informative language/legal dialogs.
  await page.locator('[data-action="toggle-setting"][data-item-id="music"]').click();
  assert.equal(await page.locator('[data-item-id="music"]').getAttribute('aria-checked'),'false');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('bn.ui.preferences.v1')).music),false);
  await page.locator('[data-action="toggle-setting"][data-item-id="notifications"]').click();
  assert.equal(await page.locator('[data-item-id="notifications"]').getAttribute('aria-checked'),'true');
  await page.locator('[data-action="settings-language"]').click();
  assert.match(await page.locator('#bn-settings-dialog-description').innerText(),/único idioma disponível/);
  await page.locator('[data-action="settings-close-dialog"]').last().click();
  await page.locator('[data-action="settings-legal"][data-item-id="terms"]').click();
  assert.match(await page.locator('#bn-settings-dialog-description').innerText(),/ainda não foram publicados/);
  await page.locator('[data-action="settings-close-dialog"]').last().click();
  await page.locator('[data-action="settings-legal"][data-item-id="privacy"]').click();
  assert.match(await page.locator('#bn-settings-dialog-description').innerText(),/ainda não foi publicada/);
  await page.locator('[data-action="settings-close-dialog"]').last().click();

  // Managing account must open the genuine profile editor, not a fake form.
  await page.locator('[data-action="settings-manage-account"]').click();
  await page.locator('.bn-profile-stage').waitFor();
  assert.equal(await page.locator('#bn-profile-editor').evaluate(node=>node.open),true);
  await page.locator('[data-action="close-profile-editor"]').click();
  await page.locator('[data-go="lobby"]').first().click();
  await page.locator('.bn-lobby').waitFor();
  await openSettings();
  assert.equal(await page.locator('[data-item-id="music"]').getAttribute('aria-checked'),'false');
  assert.equal(await page.locator('[data-item-id="notifications"]').getAttribute('aria-checked'),'true');

  if(viewport.width===375){
   // Token memory is intentionally cleared on reload, but device preferences remain.
   await page.reload({waitUntil:'domcontentloaded'});
   await login();
   await openSettings();
   assert.equal(await page.locator('[data-item-id="music"]').getAttribute('aria-checked'),'false');
   assert.equal(await page.locator('[data-item-id="notifications"]').getAttribute('aria-checked'),'true');
  }

  await page.locator('[data-action="logout"]').click();
  await page.locator('[data-form="login"]').waitFor({timeout:10000});
  assert.equal(logouts,1,'Logout must invoke the actual API once');
  assert.deepEqual(errors,[],'JavaScript exceptions: '+errors.join('; '));
  console.log('PASS Figma settings '+viewport.width+'x'+viewport.height+
   ': no clipping, panels, toggles, locale/legal info, account management and logout');
  await page.close();
 }
}finally{
 await browser.close();
 await server.close();
}
