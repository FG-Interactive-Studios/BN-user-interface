// Browser regression of the approved profile layout and retained account workflows.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const mode={
 id:'classic',name:'Clássico',geometry:{kind:'RECTANGULAR',rows:10,columns:10,
 cells:Array.from({length:100},(_,i)=>({row:Math.floor(i/10),col:i%10}))},
 placementDirections:['HORIZONTAL','VERTICAL'],
 fleet:[{id:'CARRIER',length:5},{id:'BATTLESHIP',length:4},{id:'CRUISER',length:3},
 {id:'SUBMARINE',length:3},{id:'DESTROYER',length:2}]
};
const vite=await createServer({server:{host:'127.0.0.1',port:4184,strictPort:true},logLevel:'error'});
await vite.listen();
const browser=await chromium.launch({headless:true});
await mkdir('artifacts/figma-profile',{recursive:true});
try{
 for(const viewport of [
  {width:320,height:568},{width:375,height:667},{width:390,height:844},
  {width:1363,height:602},{width:1366,height:768}
 ]){
   let profile={id:13,nickname:'Almirante Vitão',email:'capitao@example.test',avatarId:'captain',createdAt:'2026-11-01T00:00:00Z'};
   const requests={profile:[],password:[]},errors=[];
   const statistics={totalMatches:15,wins:9,losses:5,draws:1,currentWinStreak:2,bestWinStreak:4,recentMatches:Array.from({length:10},(_,i)=>({matchId:'match-'+i,opponentNickname:'Capitão '+i,modeId:'classic',modeName:'Clássico',result:i%2?'LOSS':'WIN',finishReason:'ALL_SHIPS_SUNK',finishedAt:'2026-11-24T15:00:00Z',hits:8,hitsReceived:4}))};
   const page=await browser.newPage({viewport,deviceScaleFactor:1});
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/**',async route=>{
     const pathname=new URL(route.request().url()).pathname;
     const method=route.request().method();
     if(pathname==='/api/users/me'&&method==='PATCH'){
       const payload=route.request().postDataJSON();
       requests.profile.push(payload);
       profile={...profile,...payload};
       return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(profile)});
     }
     if(pathname==='/api/auth/change-password'&&method==='POST'){
       requests.password.push(route.request().postDataJSON());
       return route.fulfill({status:204,body:''});
     }
     const result=pathname==='/api/auth/login'
       ?{tokenType:'Bearer',accessToken:'test-token',refreshToken:'test-refresh',expiresIn:900,user:profile}
       :pathname==='/api/users/me/statistics'?statistics
       :pathname==='/api/users/me'?profile
       :pathname==='/api/game-modes'?[mode]
       :null;
     if(result!==null)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
     if(pathname==='/api/realtime/ticket')return route.fulfill({status:503,contentType:'application/json',body:'{"code":"UNAVAILABLE"}'});
     return route.fulfill({status:404,contentType:'application/json',body:'{}'});
   });
   await page.goto('http://127.0.0.1:4184/',{waitUntil:'domcontentloaded'});
   await page.locator('#email').fill('capitao@example.test');
   await page.locator('#password').fill('valid-password');
   await page.locator('[data-form="login"] button[type="submit"]').click();
   await page.locator('.bn-lobby').waitFor({timeout:15000});
   await page.locator('.bn-header-identity').click();
   await page.locator('.bn-profile-stage').waitFor({timeout:10000});
   assert.equal(await page.locator('#bn-profile-name').innerText(),'Almirante Vitão');
   assert.match(await page.locator('.bn-profile-rank').innerText(),/ID #13/);
   for(const block of ['captain','statistics','achievements','history'])
     assert.equal(await page.locator('.bn-profile-'+block).count(),1,block+' card missing');
   const portrait=page.locator('.bn-gd-profile-captain');
   await portrait.waitFor();
   assert.ok(await portrait.evaluate(async img=>{try{await img.decode();return img.naturalWidth>0;}catch{return false;}}),'Captain must decode successfully');
   const portraitGeometry=await page.evaluate(()=>{
     const box=selector=>document.querySelector(selector).getBoundingClientRect();
     const image=box('.bn-gd-profile-captain'),frame=box('.bn-profile-portrait-inner'),identity=box('.bn-profile-identity');
     return {fits:image.width<=frame.width&&image.height<=frame.height&&image.left>=frame.left&&image.right<=frame.right, separate:frame.right<=identity.left+1, square:Math.abs(frame.width-frame.height)<1, width:frame.width};
   });
   assert.ok(portraitGeometry.fits&&portraitGeometry.separate&&portraitGeometry.square&&portraitGeometry.width<=132,'Captain portrait overlaps profile: '+JSON.stringify(portraitGeometry));
   await page.locator('.bn-profile-match').first().waitFor();
   assert.equal(await page.locator('.bn-profile-stat').count(),7);
   assert.equal(await page.locator('.bn-profile-achievement').count(),4);
   assert.equal(await page.locator('.bn-profile-stat.total strong').innerText(),'15');
   assert.equal(await page.locator('.bn-profile-stat.victories strong').innerText(),'9');
   assert.equal(await page.locator('.bn-profile-stat.defeats strong').innerText(),'5');
   assert.equal(await page.locator('.bn-profile-stat.rate strong').innerText(),'60%');
   assert.equal(await page.locator('.bn-profile-match').count(),10);
   assert.match(await page.locator('.bn-profile-match').first().innerText(),/Vitória.*Capitão 0/s);
   assert.equal(await page.locator('.topbar').count(),0,'No extra account header in approved profile');
   const geo=await page.evaluate(()=>{
     const r=s=>{const box=document.querySelector(s).getBoundingClientRect();return {left:box.left,right:box.right,top:box.top,bottom:box.bottom,width:box.width,height:box.height}};
     const root=document.querySelector('.bn-profile-stage');
     return {viewport:innerWidth,doc:document.documentElement.scrollWidth,
       title:r('.bn-profile-heading'),captain:r('.bn-profile-captain'),
       statistics:r('.bn-profile-statistics'),achievements:r('.bn-profile-achievements'),history:r('.bn-profile-history'),
       bg:getComputedStyle(root).backgroundImage,
       bgSize:getComputedStyle(root).backgroundSize};
   });
   const explain=viewport.width+'x'+viewport.height+' '+JSON.stringify(geo);
   assert.ok(geo.doc<=geo.viewport+2,'Horizontal overflow: '+explain);
   assert.ok(geo.bg.includes('storm.jpg'),'Storm illustration missing: '+explain);
   for(const name of ['title','captain','statistics','achievements','history']){
     const b=geo[name];
     assert.ok(b.width>0&&b.height>0&&b.left>=-2&&b.right<=geo.viewport+2,
       'Hidden or clipped profile panel '+name+': '+explain);
   }
   assert.ok(geo.title.bottom<geo.captain.top,'Captain card overlaps header: '+explain);
   if(viewport.width<850)
     assert.ok(geo.statistics.bottom<=geo.achievements.top+3&&geo.achievements.bottom<=geo.history.top+3,
       'Portrait panels must be stacked: '+explain);
   else
     assert.ok(geo.statistics.right<=geo.achievements.left+3,'Desktop panels should be alongside: '+explain);
   await page.screenshot({path:'artifacts/figma-profile/profile-'+viewport.width+'x'+viewport.height+'.png',fullPage:true});

   await page.locator('[data-action="open-profile-editor"]').click();
   assert.equal(await page.locator('#bn-profile-editor').evaluate(el=>el.open),true);
   await page.locator('#profile-name').fill('Capitão Atualizado');
   await page.locator('#avatar').selectOption('submarine');
   await page.locator('form[data-form="profile"] button[type="submit"]').click();
   await page.waitForFunction(()=>document.querySelector('#bn-profile-name')?.textContent==='Capitão Atualizado');
   assert.equal(await page.locator('#bn-profile-editor').evaluate(el=>el.open),false);
   assert.deepEqual(requests.profile,[{nickname:'Capitão Atualizado',avatarId:'submarine'}]);

   await page.locator('[data-action="open-profile-editor"]').click();
   await page.locator('.bn-profile-security summary').click();
   await page.locator('#current-password').fill('old-password');
   await page.locator('#new-password').fill('new-password-123');
   await page.locator('form[data-form="password"] button[type="submit"]').click();
   await page.waitForFunction(()=>document.querySelector('#tp-notice-root')?.textContent?.includes('Senha atualizada'));
   assert.deepEqual(requests.password,[{currentPassword:'old-password',newPassword:'new-password-123'}]);
   if(viewport.width===375){
     await page.locator('#tp-notice-root .tp-notice').waitFor({state:'detached',timeout:6500});
     assert.equal(await page.locator('.bn-profile-notice').count(),0);
     assert.equal(await page.locator('#bn-profile-editor').evaluate(el=>el.open),true,'Notice expiration must not close account editor');
   }
   await page.locator('[data-action="close-profile-editor"]').click();
   assert.equal(await page.locator('#bn-profile-editor').evaluate(el=>el.open),false);
   assert.deepEqual(errors,[],'JavaScript errors: '+errors.join('; '));
   console.log('PASS Figma profile '+viewport.width+'x'+viewport.height+
     ': captain/stats/achievements/history, backdrop, edit/avatar/password, no horizontal clipping');
   await page.close();
 }
}finally{
 await browser.close();
 await vite.close();
}
