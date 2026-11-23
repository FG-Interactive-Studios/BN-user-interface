import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const mode={id:'classic',name:'Clássico',geometry:{kind:'RECTANGULAR',rows:8,columns:8,
  cells:Array.from({length:64},(_,i)=>({row:Math.floor(i/8),col:i%8}))},
  placementDirections:['HORIZONTAL','VERTICAL'],fleet:[{id:'DESTROYER',length:2}]};
const respond=(route,data,status=200)=>route.fulfill({
  status,contentType:'application/json',body:JSON.stringify(data)
});
const cases=[
  {email:'admin@admin.com',id:101,nickname:'Administrador',admin:true,viewport:{width:390,height:844}},
  {email:'player@example.test',id:102,nickname:'Marinheiro',admin:false,viewport:{width:1366,height:768}}
];
const server=await createServer({server:{host:'127.0.0.1',port:4194,strictPort:true},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true});
try{
  for(const user of cases){
    const page=await browser.newPage({viewport:user.viewport});
    const errors=[];
    let loginCount=0,adminCalls=0;
    let enabled=false;
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/api/**',route=>{
      const path=new URL(route.request().url()).pathname;
      const method=route.request().method();
      const profile={id:user.id,email:user.email,nickname:user.nickname,admin:user.admin,
        avatarId:'captain',createdAt:'2026-01-01T00:00:00Z'};
      if(path==='/api/auth/login'){
        loginCount++;
        assert.equal(route.request().postDataJSON().password,'admin');
        return respond(route,{accessToken:'test-access-'+user.id,refreshToken:'test-refresh',
          tokenType:'Bearer',expiresIn:900,user:profile});
      }
      if(path==='/api/users/me')return respond(route,profile);
      if(path==='/api/game-modes')return respond(route,[mode]);
      if(path==='/api/matchmaking/state')return respond(route,{status:'IDLE',room:null,modeId:null});
      if(path==='/api/store')return respond(route,{items:[]});
      if(path==='/api/realtime/ticket')return route.fulfill({status:503,body:'{}'});
      if(path==='/api/admin/game-modes'){
        adminCalls++;
        assert.equal(route.request().headers().authorization,'Bearer test-access-'+user.id);
        if(!user.admin)return route.fulfill({status:403,body:'{}'});
        return respond(route,[{mode,enabled,updatedAt:null,updatedBy:null}]);
      }
      if(path==='/api/admin/game-modes/classic/availability'&&method==='PUT'){
        adminCalls++;
        assert.equal(route.request().headers().authorization,'Bearer test-access-'+user.id);
        assert.equal(user.admin,true,'Non-admin may not modify modes');
        enabled=route.request().postDataJSON().enabled;
        return respond(route,{mode,enabled,updatedAt:null,updatedBy:user.id});
      }
      return route.fulfill({status:404,body:'{}'});
    });
    await page.goto('http://127.0.0.1:4194/',{waitUntil:'domcontentloaded'});
    await page.locator('#email').fill(user.email);
    await page.locator('#password').fill('admin'); // This is a local bootstrap password, only 5 chars.
    await page.locator('[data-form="login"] button[type="submit"]').click();
    await page.locator('body[data-route="lobby"]').waitFor({timeout:12000});
    await page.locator('.tp-account-menu summary').click();
    const menu=page.locator('.tp-account-popover [data-go="admin"]');
    if(user.admin){
      assert.equal(await menu.count(),1,'Only admin should see the panel entry');
      await menu.click();
      await page.locator('body[data-route="admin"]').waitFor({timeout:12000});
      await page.locator('.bn-admin-mode').waitFor();
      assert.equal(loginCount,1,'Navigation to admin must not require another login');
      assert.equal(adminCalls,1,'One admin catalog request');
      assert.equal(new URL(page.url()).pathname,'/','Admin navigation should be SPA');
      assert.ok(page.url().endsWith('#admin'));
      await page.locator('[data-action="admin-toggle-mode"]').click();
      await page.locator('.bn-admin-toggle.is-enabled').waitFor({timeout:12000});
      assert.equal(enabled,true,'Admin action should use the original session JWT');
      assert.equal(loginCount,1,'Admin action must not create another login');
      await page.locator('[data-go="lobby"]').last().click();
      await page.locator('body[data-route="lobby"]').waitFor({timeout:12000});
    }else{
      assert.equal(await menu.count(),0,'Non-admin must not see admin entry');
      await page.evaluate(()=>{location.hash='#admin';});
      await page.locator('body[data-route="lobby"]').waitFor({timeout:12000});
      assert.notEqual(new URL(page.url()).hash,'#admin','Non-admin direct route must redirect');
      assert.equal(adminCalls,0,'Never request admin data for non-admins');
    }
    assert.deepEqual(errors,[],'No browser JavaScript errors');
    await page.close();
  }
  console.log('PASS admin: local 5-char password, same JWT/session, role-limited menu and protected route');
}finally{
  await browser.close();
  await server.close();
}
