// Real browser, two independent player sessions. Server responses are mock state
// transitions that follow the rematch contract, not fabricated match rewards.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const mode={id:'classic',name:'Clássico',placementDirections:['HORIZONTAL','VERTICAL'],
 geometry:{kind:'RECTANGULAR',rows:8,columns:8,
 cells:Array.from({length:64},(_,i)=>({row:Math.floor(i/8),col:i%8}))},
 fleet:[{id:'DESTROYER',length:2},{id:'CRUISER',length:3}]};
const profiles=[
 {id:13,nickname:'Capitão A',email:'a@example.test',avatarId:'captain'},
 {id:17,nickname:'Capitão B',email:'b@example.test',avatarId:'captain'}
];
const server=await createServer({server:{host:'127.0.0.1',port:4196,strictPort:true},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true});
await mkdir('artifacts/rematch',{recursive:true});
const respond=(route,payload,status=200)=>route.fulfill({
  status,contentType:'application/json',body:JSON.stringify(payload)
});
const snapshotState=()=>({code:'OLD123',status:'FINISHED',revision:7,mode,
  publicMatch:true,rematch:{hostAccepted:false,guestAccepted:false,available:true,declined:false},
  players:profiles.map(p=>({...p,ready:true,connected:true}))});
const battle={matchId:'old-battle',lobbyCode:'OLD123',status:'FINISHED',
  mode,revision:30,turnPlayerId:null,winnerId:13,finishReason:'TIME_LIMIT',
  shotsFired:[{row:1,col:1,hit:true}],shotsReceived:[{row:2,col:2,hit:false}],
  yourShips:[],reconnectDeadlines:{}};
const prep={preparationId:'new-preparation',revision:1,mode,
  yourShips:[],fleetPlaced:false,fleetConfirmed:false,opponentPlaced:false,
  opponentConfirmed:false,bothConfirmed:false};
let calls=0,queueCalls=0;
const errors=[];
let room, members;
async function setupScenario(){
  room=snapshotState();
  members=new Set(profiles.map(p=>p.id));
  const pages=[];
  for(const [i,profile] of profiles.entries()){
    const page=await browser.newPage({viewport:i===0?{width:320,height:568}:{width:1366,height:768}});
    page.on('pageerror',e=>errors.push(profile.nickname+': '+e.message));
    await page.route('**/api/**',route=>{
      const path=new URL(route.request().url()).pathname,method=route.request().method();
      if(path==='/api/auth/login')return respond(route,{
        accessToken:'token-'+profile.id,refreshToken:'refresh',tokenType:'Bearer',
        expiresIn:900,user:profile
      });
      if(path==='/api/users/me')return respond(route,profile);
      if(path==='/api/game-modes')return respond(route,[mode]);
      if(path==='/api/store')return respond(route,{credits:0,premiumCredits:0,items:[]});
      if(path==='/api/realtime/ticket')return respond(route,{code:'UNAVAILABLE'},503);
      if(path.includes('/matchmaking/queue')){queueCalls++;return respond(route,{code:'NO_QUEUE'},404);}
      if(path==='/api/matchmaking/state'&&method==='GET'){
        return respond(route,members.has(profile.id)
          ? {status:'MATCHED',modeId:'classic',room}
          : {status:'IDLE',modeId:null,room:null});
      }
      if(path==='/api/matches/me'&&method==='GET')
        return respond(route,battle);
      if(path==='/api/matches/me/placement'&&method==='GET')
        return respond(route,prep);
      if(path==='/api/matchmaking/lobbies/me/rematch'&&method==='PUT'){
        if(room.status!=='FINISHED'||!members.has(profile.id)||!room.rematch?.available)
          return respond(route,{message:'Rematch unavailable'},409);
        calls++;
        const key=profile.id===profiles[0].id?'hostAccepted':'guestAccepted';
        room.rematch[key]=route.request().postDataJSON().accepted;
        room.revision++;
        if(room.rematch.hostAccepted&&room.rematch.guestAccepted){
          room={...room,code:'NEW456',status:'PREPARING',revision:1,rematch:null,
            players:room.players.map(player=>({...player,ready:true}))};
        }
        return respond(route,room);
      }
      if(path==='/api/matchmaking/lobbies/me'&&method==='DELETE'){
        members.delete(profile.id);
        if(room.status==='FINISHED'){
          room.rematch.available=false;
          room.rematch.declined=true;
          room.revision++;
        }
        return route.fulfill({status:204,body:''});
      }
      return respond(route,{code:'NOT_FOUND'},404);
    });
    await page.goto('http://127.0.0.1:4196/',{waitUntil:'domcontentloaded'});
    await page.locator('#email').fill(profile.email);
    await page.locator('#password').fill('correct-password');
    await page.locator('[data-form="login"] button[type="submit"]').click();
    await page.locator('body[data-route="result"] .bn-result-stage').waitFor({timeout:12000});
    pages.push(page);
  }
  return pages;
}
try {
  {
    const [a,b]=await setupScenario();
    assert.equal(await a.locator('[data-action="play-again"]').innerText(),'Pedir revanche');
    await a.locator('[data-action="play-again"]').click();
    await a.locator('[data-action="cancel-rematch"]').waitFor();
    assert.match(await a.locator('.bn-rematch-status').innerText(),/Aguardando/);
    const box=await a.locator('.bn-report-actions').boundingBox();
    assert.ok(box && box.y+box.height<=568+2,'Rematch waiting status overflows small mobile');
    await a.screenshot({path:'artifacts/rematch/pending-320x568.png',fullPage:true});
    await a.locator('[data-action="cancel-rematch"]').click();
    await a.locator('[data-action="play-again"]').waitFor();
    assert.equal(room.rematch.hostAccepted,false,'Withdrawal should be reversible');
    await a.locator('[data-action="play-again"]').click();
    await b.locator('.bn-rematch-status').getByText(/adversário quer jogar novamente/i)
      .waitFor({timeout:18000});
    assert.equal(await b.locator('[data-action="play-again"]').innerText(),'Aceitar revanche');
    await b.screenshot({path:'artifacts/rematch/invitation-desktop.png',fullPage:true});
    await b.locator('[data-action="play-again"]').click();
    await b.locator('body[data-route="placement"]').waitFor({timeout:12000});
    await a.locator('body[data-route="placement"]').waitFor({timeout:18000});
    assert.equal(room.code,'NEW456','A rematch needs a fresh server room');
    assert.equal(room.status,'PREPARING','Both acceptances must start placement immediately');
    assert.equal(queueCalls,0,'Rematch cannot enter a public queue');
    assert.equal(calls,4,'Request, withdraw, request, accept exactly once');
    assert.ok(await a.locator('.bn-placement-board-wrap .cell').count()>0);
    await a.screenshot({path:'artifacts/rematch/placement-mobile.png',fullPage:true});
    await a.close();await b.close();
  }
  {
    const [a,b]=await setupScenario();
    await a.locator('[data-action="play-again"]').click();
    await a.locator('[data-action="cancel-rematch"]').waitFor();
    await b.locator('[data-action="leave-lobby"]').click();
    await b.locator('.bn-lobby').waitFor({timeout:12000});
    await a.locator('.bn-rematch-status').getByText(/adversário saiu/i)
      .waitFor({timeout:18000});
    assert.equal(await a.locator('.bn-report-replay').isDisabled(),true,
      'Leaving the result screen must prevent unconsented rematch');
    await a.locator('[data-action="leave-lobby"]').click();
    await a.locator('.bn-lobby').waitFor({timeout:12000});
    await a.close();await b.close();
  }
  assert.deepEqual(errors,[],errors.join('; '));
  console.log('PASS rematch: two independent players, reversible vote, fresh placement, declined invitation, 320px mobile + desktop');
}finally {
  await browser.close();
  await server.close();
}
