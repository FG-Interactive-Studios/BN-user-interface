import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const mode={id:'classic',name:'Clássico',geometry:{kind:'RECTANGULAR',rows:10,columns:10,
  cells:Array.from({length:100},(_,i)=>({row:Math.floor(i/10),col:i%10}))},
  placementDirections:['HORIZONTAL','VERTICAL'],
  fleet:[{id:'CARRIER',length:5},{id:'BATTLESHIP',length:4},{id:'CRUISER',length:3},
    {id:'SUBMARINE',length:3},{id:'DESTROYER',length:2}]};
const profiles=[
 {id:13,nickname:'Capitão Alfa',email:'alpha@example.test',avatarId:'captain'},
 {id:17,nickname:'Capitão Beta',email:'beta@example.test',avatarId:'captain'}
];
const queue=new Map();
let room=null;
let roomCounter=0;
const errors=[];
const lookups={unified:0,legacy:0};
const clone=value=>JSON.parse(JSON.stringify(value));
const missing=(route)=>route.fulfill({status:404,contentType:'application/json',body:'{}'});
const respond=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
const roomFor=id=>room?.players?.some(p=>p.id===id)?clone(room):null;
const queueFor=id=>roomFor(id)?{status:'MATCHED',modeId:'classic',room:roomFor(id)}
  :queue.has(id)?{status:'SEARCHING',modeId:'classic',room:null}:null;
const mock=(page,profile)=>{
 page.on('pageerror',e=>errors.push(profile.id+': '+e.message));
 return page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname, method=route.request().method();
  if(path==='/api/auth/login')return respond(route,{tokenType:'Bearer',accessToken:'test-token-'+profile.id,
    refreshToken:'test-refresh',expiresIn:900,user:profile});
  if(path==='/api/users/me')return respond(route,profile);
  if(path==='/api/game-modes')return respond(route,[mode]);
  if(path==='/api/realtime/ticket')return route.fulfill({status:503,body:'{}'});
  if(path==='/api/matchmaking/state'&&method==='GET'){
    lookups.unified++;
    return respond(route,queueFor(profile.id)||{status:'IDLE',modeId:null,room:null});
  }
  if((path==='/api/matchmaking/lobbies/me'||path==='/api/matchmaking/queue/me')&&method==='GET')
    lookups.legacy++;
  if(path==='/api/matchmaking/lobbies/me'&&method==='GET')
    return roomFor(profile.id)?respond(route,roomFor(profile.id)):missing(route);
  if(path==='/api/matchmaking/queue/me'&&method==='GET')
    return queueFor(profile.id)?respond(route,queueFor(profile.id)):missing(route);
  if(path==='/api/matchmaking/queue'&&method==='POST'){
    if(roomFor(profile.id))return respond(route,queueFor(profile.id));
    if(queue.has(profile.id))return respond(route,queueFor(profile.id));
    const other=[...queue.keys()].find(id=>id!==profile.id);
    if(other){
      queue.delete(other);
      room={code:'PUB'+String(++roomCounter).padStart(3,'0'),status:'WAITING',publicMatch:true,
        capacity:2,revision:1,mode,players:[other,profile.id].map(id=>({
          ...profiles.find(p=>p.id===id),ready:false,connected:true}))};
      return respond(route,queueFor(profile.id));
    }
    queue.set(profile.id,'classic');
    return respond(route,queueFor(profile.id));
  }
  if(path==='/api/matchmaking/queue/me'&&method==='DELETE'){
    queue.delete(profile.id);return route.fulfill({status:204,body:''});
  }
  if(path==='/api/matchmaking/lobbies'&&method==='POST'){
    if(queue.has(profile.id))return route.fulfill({status:409,body:'{}'});
    room={code:'ABC234',status:'WAITING',publicMatch:false,capacity:2,revision:1,
      mode,players:[{...profile,ready:false,connected:true}]};
    return respond(route,room,201);
  }
  if(path==='/api/matchmaking/lobbies/me'&&method==='DELETE'){
    room=null;return route.fulfill({status:204,body:''});
  }
  if(path==='/api/matchmaking/lobbies/me/ready'&&method==='PUT'){
    const record=room?.players.find(p=>p.id===profile.id);
    if(!record)return missing(route);
    record.ready=route.request().postDataJSON().ready;
    if(room.players.length===2 && room.players.every(p=>p.ready))room.status='PREPARING';
    room.revision++;
    return respond(route,room);
  }
  if(path==='/api/matches/me/placement'&&method==='GET'){
    return respond(route,{preparationId:1,revision:1,mode,yourShips:[],
      fleetConfirmed:false,opponentConfirmed:false,deadlineAt:new Date(Date.now()+90000).toISOString()});
  }
  return missing(route);
 });
};
const vite=await createServer({server:{host:'127.0.0.1',port:4191,strictPort:true},logLevel:'error'});
await vite.listen();
const browser=await chromium.launch({headless:true});
await mkdir('artifacts/public-matchmaking',{recursive:true});
try {
 const a=await browser.newPage({viewport:{width:375,height:667}});
 const b=await browser.newPage({viewport:{width:1366,height:768}});
 await mock(a,profiles[0]);await mock(b,profiles[1]);
 async function login(page,email){
   await page.goto('http://127.0.0.1:4191/',{waitUntil:'domcontentloaded'});
   await page.locator('#email').fill(email);
   await page.locator('#password').fill('valid-password');
   await page.locator('[data-form="login"] button[type="submit"]').click();
   await page.locator('.bn-lobby').waitFor({timeout:10000});
 }
 await login(a,profiles[0].email);
 await login(b,profiles[1].email);
 await a.locator('[data-go="matchmaking"]').click();
 await a.locator('.bn-match-choice').waitFor();
 assert.ok(await a.locator('[data-action="find-public-match"]').isVisible());
 assert.ok(await a.locator('[data-action="create-lobby"]').isVisible());
 await a.locator('[data-action="find-public-match"]').click();
 await a.locator('.bn-queue-search').waitFor();
 assert.equal(queue.has(profiles[0].id),true);
 assert.equal(await a.locator('.bn-room-invite').count(),0);
 await a.screenshot({path:'artifacts/public-matchmaking/search-mobile.png',fullPage:true});
 await a.locator('[data-action="cancel-public-search"]').click();
 await a.locator('.bn-lobby').waitFor();
 assert.equal(queue.size,0,'Cancel must remove queue entry');
 // The old invitation path remains selectable and produces a private code.
 await a.locator('[data-go="matchmaking"]').click();
 await a.locator('[data-action="create-lobby"]').click();
 await a.locator('.bn-waiting-room').waitFor();
 assert.equal(room.publicMatch,false);
 assert.equal(await a.locator('.bn-room-invite strong').innerText(),'ABC234');
 await a.locator('[data-action="leave-lobby"]').first().click();
 await a.locator('.bn-lobby').waitFor();
 assert.equal(room,null);
 // Two players find each other without invitation code.
 await a.locator('[data-go="matchmaking"]').click();
 await a.locator('[data-action="find-public-match"]').click();
 await a.locator('.bn-queue-search').waitFor();
 await b.locator('[data-go="matchmaking"]').click();
 await b.locator('[data-action="find-public-match"]').click();
 await b.locator('.bn-waiting-room').waitFor();
 assert.equal(room.publicMatch,true);
 assert.equal(room.players.length,2);
 assert.equal(await b.locator('.bn-room-invite').count(),0,'Code must be hidden in public match');
 await a.locator('.bn-waiting-room').waitFor({timeout:18000}); // REST polling without socket
 assert.equal(await a.locator('.bn-room-invite').count(),0);
 assert.match(await a.locator('.bn-queue-found').innerText(),/adversário encontrado/i);
 await a.screenshot({path:'artifacts/public-matchmaking/paired-mobile.png',fullPage:true});
 await b.screenshot({path:'artifacts/public-matchmaking/paired-desktop.png',fullPage:true});
 const docWidth=await a.evaluate(()=>document.documentElement.scrollWidth);
 assert.ok(docWidth<=375+2,'Public match waiting room horizontal overflow');
 await a.locator('[data-action="ready"]').click();
 assert.equal(room.players[0].ready,true);
 await b.locator('[data-action="ready"]').click();
 assert.equal(room.status,'PREPARING');
 await b.locator('body[data-route="placement"]').waitFor({timeout:10000});
 await a.locator('body[data-route="placement"]').waitFor({timeout:18000});
 assert.ok(lookups.unified>=2,'Snapshot must serve both players');
 assert.equal(lookups.legacy,0,'No expected 404 lookups of empty room/queue');
 assert.deepEqual(errors,[]);
 console.log('PASS public matchmaking: queue, cancellation, optional private code, two-player match, ready -> placement, mobile + desktop');
}finally {
 await browser.close();
 await vite.close();
}
