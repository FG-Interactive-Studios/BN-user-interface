// Mobile combat layout regression against the real app DOM, with a test-only REST fixture.
// Unlike unit tests, this checks CSS geometry and scroll reachability in Chromium.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const mode={
 id:'classic-powers',name:'Clássico com poderes',placementDirections:['HORIZONTAL','VERTICAL'],
 geometry:{kind:'RECTANGULAR',rows:8,columns:8,cells:Array.from({length:64},(_,i)=>({row:Math.floor(i/8),col:i%8}))},
 fleet:[{id:'SEARCH',length:1},{id:'DESTROYER',length:2},{id:'CARRIER',length:5}]
};
const player={id:13,nickname:'Jogador QA',email:'qa@example.test',avatarId:'captain'};
const room={code:'ABC123',status:'PREPARING',revision:1,mode,
 players:[{id:13,nickname:'Jogador QA',ready:true},{id:17,nickname:'Adversário',ready:true}]};
const ships=[{type:'CARRIER',row:0,col:0,orientation:'HORIZONTAL'},
{type:'DESTROYER',row:1,col:0,orientation:'HORIZONTAL'},
{type:'SEARCH',row:2,col:0,orientation:'HORIZONTAL'}];
const placement={preparationId:91,revision:1,mode,
 yourShips:[],fleetPlaced:false,fleetConfirmed:false,opponentConfirmed:false};
const match={matchId:91,revision:1,status:'PLAYING',mode,
 turnDeadlineAt:new Date(Date.now()+60000).toISOString(),matchDeadlineAt:new Date(Date.now()+600000).toISOString(),
 turnPlayerId:13,yourShips:ships,shotsReceived:[],
 yourAbilityPointsEarned:0,yourAbilityPointCells:[{row:5,col:2},{row:5,col:4},{row:6,col:5},{row:7,col:7}],
 yourAbilities:[
  {id:'radar',name:'Radar',description:'Encontra contatos na área 3×3',usesRemaining:1,targetCount:1,targetScope:'ENEMY',locked:false},
  {id:'double-shot',name:'Tiro duplo',description:'Duas casas num turno',usesRemaining:1,targetCount:2,targetScope:'ENEMY',locked:false},
  {id:'air-strike',name:'Ataque aéreo',description:'Área 2×2',usesRemaining:1,targetCount:1,targetScope:'ENEMY',locked:false},
  {id:'line-barrage',name:'Rajada em linha',description:'Três casas em linha',usesRemaining:1,targetCount:2,targetScope:'ENEMY',locked:false},
  {id:'hull-shield',name:'Escudo de casco',description:'Protege navio intacto',usesRemaining:1,targetCount:1,targetScope:'OWN',locked:false},
  {id:'retreat',name:'Retirada',description:'Move navio intacto',usesRemaining:1,targetCount:2,targetScope:'OWN',locked:false},
  {id:'last-chance',name:'Última chance',description:'Evita o próximo ataque fatal',usesRemaining:1,targetCount:0,targetScope:'NONE',locked:false},
  {id:'interference',name:'Interferência',description:'Bloqueia habilidades',usesRemaining:1,targetCount:0,targetScope:'NONE',locked:false}
 ],shotsFired:[{row:0,col:0,hit:false},{row:1,col:1,hit:true}]};

const vite=await createServer({server:{host:'127.0.0.1',port:4181,strictPort:true},logLevel:'error'});
await vite.listen();
const browser=await chromium.launch({headless:true});
await mkdir('artifacts/figma-combat',{recursive:true});

try {
 for(const status of ['PREPARING','PLAYING','RIVAL','PAUSED']){
  for(const viewport of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:412,height:915},{width:1366,height:768},...(status==='PREPARING'?[]:[{width:1366,height:636},{width:1024,height:600},{width:850,height:650}])]){
   const errors=[];
   const page=await browser.newPage({viewport,deviceScaleFactor:1});
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    const response=path==='/api/auth/login'?{
       tokenType:'Bearer',accessToken:'qa-token',refreshToken:'qa-refresh',expiresIn:900,user:player
      }:path==='/api/users/me'?player:path==='/api/game-modes'?[mode]:
      path==='/api/matchmaking/lobbies/me'?{...room,status:status==='PREPARING'?'PREPARING':'PLAYING'}:
      path==='/api/matches/me/placement'?placement:
      path==='/api/matches/me'?{...match,turnPlayerId:status==='RIVAL'?17:13,paused:status==='PAUSED'}:null;
    if(response!==null) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
    if(path==='/api/realtime/ticket')return route.fulfill({status:503,body:'{"code":"UNAVAILABLE"}',contentType:'application/json'});
    return route.fulfill({status:404,body:'{}',contentType:'application/json'});
   });
   await page.goto('http://127.0.0.1:4181/',{waitUntil:'domcontentloaded'});
   await page.locator('#email').fill('qa@example.test');
   await page.locator('#password').fill('testing-password-123');
   await page.locator('[data-form="login"] button[type="submit"]').click();
   const route=status==='PREPARING'?'placement':'match';
   await page.locator('body[data-route="'+route+'"] .combat-screen').waitFor({timeout:15000});

   if(status==='PREPARING') {
     const layout=await page.evaluate(()=>{
       const rect=selector=>{
         const el=document.querySelector(selector);
         if(!el)throw Error('Missing '+selector);
         const r=el.getBoundingClientRect();
         return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
       };
       const board=document.querySelector('.bn-placement-screen .board-main');
       const tile=board.querySelector('.cell');
       return {
         rootWidth:document.documentElement.scrollWidth,
         pageHeight:document.documentElement.scrollHeight,
         head:rect('.bn-placement-header'),
         board:rect('.bn-placement-screen .board-main'),
         fleet:rect('.bn-placement-fleet'),
         tools:rect('.bn-placement-tools'),
         action:rect('.bn-placement-confirm'),
         cellBorder:getComputedStyle(tile).borderStyle,
         containerType:getComputedStyle(document.querySelector('.bn-placement-board-wrap')).containerType,
       };
     });
     const explain='PREPARING '+viewport.width+'x'+viewport.height+' '+JSON.stringify(layout);
     assert.ok(layout.rootWidth<=viewport.width+2,'Document horizontal overflow: '+explain);
     assert.ok(layout.board.width>=Math.min(viewport.width*.68,500),'Tiny preserved board: '+explain);
     assert.ok(Math.abs(layout.board.height-layout.board.width)<=3,'Board is not square: '+explain);
     assert.ok(layout.board.left>=-2&&layout.board.right<=viewport.width+2,'Board outside viewport: '+explain);
     assert.equal(layout.containerType,'normal','Board collapsed by size containment: '+explain);
     assert.equal(layout.cellBorder,'solid','Grid cell border changed: '+explain);
     assert.ok(layout.head.bottom<=layout.board.top+3,'Board overlaps header: '+explain);
     const titleBounds=await page.evaluate(()=>{
       const h=document.querySelector('.bn-placement-header h1').getBoundingClientRect();
       const clock=document.querySelector('.bn-placement-phase').getBoundingClientRect();
       return {titleRight:h.right,titleTop:h.top,titleBottom:h.bottom,clockLeft:clock.left,clockBottom:clock.bottom};
     });
     assert.ok(titleBounds.titleRight<=titleBounds.clockLeft+2,'Preparation title overlaps timer: '+explain+' '+JSON.stringify(titleBounds));
     assert.ok(titleBounds.titleBottom<=layout.head.bottom+2,'Preparation title clipped by header: '+explain+' '+JSON.stringify(titleBounds));
     if(viewport.width<=849)
       assert.ok(layout.board.bottom<=layout.fleet.top+4,'Ship cards overlap board: '+explain);
     else
       assert.ok(layout.board.right<=layout.fleet.left+4,'Desktop placement columns overlap: '+explain);
     assert.ok(layout.fleet.bottom<=layout.tools.top+4,'Tools overlap ship cards: '+explain);
     assert.equal(await page.locator('.bn-placement-screen .board-main .cell').count(),64);
     assert.equal(await page.locator('.bn-placement-ship').count(),3);
     for(const type of ['CARRIER','DESTROYER','SEARCH']) {
       assert.equal(await page.locator('.bn-placement-ship[data-item-id="'+type+'"] img[src*="/assets/gd/skin_default/"]').count(),1,
         'Official fleet art absent for '+type);
     }
     for(const type of ['CARRIER','DESTROYER','SEARCH']) {
       const art=page.locator('.bn-placement-ship[data-item-id="'+type+'"] img');
       const decoded=await art.evaluate(async img=>{
         try {await img.decode();return img.naturalWidth>0&&img.naturalHeight>0;}
         catch {return false;}
       });
       assert.ok(decoded,'Broken sprite file for '+type+': '+explain);
     }
     const backdrop=await page.locator('.bn-zip-placement').evaluate(el=>getComputedStyle(el).backgroundImage);
     assert.ok(backdrop.includes('/assets/bn-zip/bg.webp'),'ZIP background is not active on preparation: '+backdrop);
     assert.equal(await page.locator('.bn-placement-ship.is-selected').count(),1);
     assert.ok(await page.locator('[data-action="random-placement"]').isEnabled());
     for(const selector of ['[data-action="random-placement"]','[data-action="confirm-placement"]','[data-action="leave-lobby"]']){
       const button=page.locator(selector);
       await button.scrollIntoViewIfNeeded({timeout:5000});
       const bounds=await button.evaluate(el=>{
         const r=el.getBoundingClientRect();
         return {top:r.top,bottom:r.bottom,width:r.width,height:r.height};
       });
       const minWidth=selector.includes('leave-lobby')?28:selector.includes('random-placement')?40:70;
       assert.ok(bounds.width>=minWidth&&bounds.height>=25,'Collapsed placement action '+selector+' '+explain);
       assert.ok(bounds.top>=-2&&bounds.bottom<=viewport.height+2,'Placement action unreachable '+selector+' '+explain);
     }
     await page.screenshot({path:'artifacts/figma-combat/placement-'+viewport.width+'x'+viewport.height+'.png',fullPage:true});
     assert.deepEqual(errors,[],'Page errors '+explain);
     console.log('PASS PREPARING '+viewport.width+'x'+viewport.height+'; preserved board '+layout.board.width.toFixed(0)+'px, Figma actions reachable');
     await page.close();
     continue;
   }


   const metrics=await page.evaluate(()=>{
     const rect=selector=>{
       const element=document.querySelector(selector);
       if(!element)throw Error('Missing '+selector);
       const r=element.getBoundingClientRect();
       return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};
     };
     return {
       rootWidth:document.documentElement.scrollWidth,
       pageHeight:document.documentElement.scrollHeight,
       viewportWidth:innerWidth,viewportHeight:innerHeight,
       head:rect('.zip-battle-header'),
       score:rect('.zip-scoreboard'),
       turn:rect('.zip-turn-panel'),
       actions:rect('.zip-battle-action-bar'),
       enemy:rect('.zip-enemy-section'),
       enemyHeading:rect('.zip-enemy-section .zip-board-heading'),
       enemyPortrait:rect('.zip-enemy-section .zip-combat-captain'),
       ownPortrait:rect('.zip-own-section .zip-combat-captain'),
       footer:rect('.zip-battle-footer'),
       board:rect('.zip-primary-board .board-main'),
       defense:rect('.zip-own-section'),
       defenseHeading:rect('.zip-own-section .zip-board-heading'),
       powers:rect('.zip-tactics-section'),
       fire:rect('.zip-fire-button'),
       ownBoard:rect('.zip-own-board .board-preview'),
       cell:rect('.zip-primary-board .board-main .cell'),
       previewCell:rect('.zip-own-board .board-preview .cell'),
     };
   });
   const explain=status+' '+viewport.width+'x'+viewport.height+' '+JSON.stringify(metrics);
   assert.ok(metrics.rootWidth<=viewport.width+2,'Battle document horizontal overflow: '+explain);
   const battleBackdrop=await page.locator('.bn-zip-battle').evaluate(el=>getComputedStyle(el).backgroundImage);
   assert.ok(battleBackdrop.includes('/assets/bn-zip/bg.webp'),'ZIP background is not active during battle: '+battleBackdrop);
   assert.ok(metrics.pageHeight<=viewport.height+2,'Battle document should fit screen: '+explain);
   assert.ok(metrics.board.width>=Math.min(130,viewport.width*.4),'Targeting board too small: '+explain);
   assert.ok(Math.abs(metrics.board.height-metrics.board.width)<=3,'Targeting board distorted: '+explain);
   for(const key of ['head','score','enemy','board','turn','defense','powers','fire','ownBoard','enemyPortrait','ownPortrait','footer']) {
     const bounds=metrics[key];
     assert.ok(bounds.left>=-2&&bounds.right<=viewport.width+2,'Offscreen horizontal '+key+': '+explain);
     assert.ok(bounds.top>=-2&&bounds.bottom<=viewport.height+2,'Offscreen vertical '+key+': '+explain);
   }
   assert.ok(metrics.head.bottom<=metrics.score.top+3,'Score overlays header: '+explain);
   assert.ok(metrics.score.bottom<=metrics.board.top+3,'Target board overlaps score: '+explain);
   assert.match(await page.locator('.zip-enemy-section .zip-side-label').innerText(),/ATAQUE.*OPONENTE/);
   assert.match(await page.locator('.zip-own-section .zip-side-label').innerText(),/DEFESA.*SUA FROTA/);
   assert.equal(await page.locator('.zip-scoreboard img').count(),0,'Portraits must not resize the score row');
   for(const [portrait,section,board] of [['enemyPortrait','enemy','board'],['ownPortrait','defense','ownBoard']]) {
     const p=metrics[portrait],s=metrics[section],b=metrics[board];
     assert.ok(p.width>=24&&p.height>=24&&p.width<=115&&p.height<=132,'Captain portrait not bounded: '+explain);
     assert.ok(p.left>=s.left-2&&p.right<=s.right+2&&p.top>=s.top-2&&p.bottom<=s.bottom+2,'Captain escaped panel: '+explain);
     assert.ok(p.right<=b.left+2||p.bottom<=b.top+2,'Portrait overlaps grid: '+explain);
   }
   for(const selector of ['.zip-enemy-section .zip-combat-captain','.zip-own-section .zip-combat-captain']) {
     assert.ok(await page.locator(selector).evaluate(async img=>{try{await img.decode();return img.naturalWidth>0;}catch{return false;}}),'Broken captain artwork: '+explain);
   }
   assert.ok(metrics.enemy.bottom<=metrics.footer.top+2&&metrics.defense.bottom<=metrics.footer.top+2&&metrics.turn.bottom<=metrics.footer.top+2,'Action footer overlaps arena: '+explain);
   if(viewport.width<=849) {
     assert.ok(metrics.enemyHeading.top>=metrics.score.bottom-2,'Enemy heading covered by scoreboard: '+explain);
     assert.ok(metrics.enemyHeading.bottom<=metrics.board.top+3,'Enemy heading overlaps attack board: '+explain);
     assert.ok(metrics.board.bottom<=metrics.turn.top+4,'Turn panel overlaps attack board: '+explain);
     assert.ok(metrics.turn.bottom<=metrics.defense.top+4,'Defense overlaps turn panel: '+explain);
     assert.ok(metrics.defenseHeading.bottom<=metrics.ownBoard.top+3,'Own heading overlaps defense: '+explain);
     assert.ok(metrics.board.width>=metrics.ownBoard.width&&metrics.ownBoard.width>=metrics.board.width*.8,'Mobile grids should be similarly sized, with attack slightly larger: '+explain);
   } else {
     assert.ok(metrics.ownBoard.right<=metrics.turn.left+4,'Desktop: own fleet must be LEFT of turn panel: '+explain);
     assert.ok(metrics.turn.right<=metrics.board.left+4,'Desktop: enemy grid must be RIGHT of turn panel: '+explain);
     assert.ok(metrics.board.width>=Math.min(300,viewport.width*.31,viewport.height*.46),'Desktop boards must use the available space: '+explain);
   }
   assert.ok(metrics.defense.bottom<=metrics.fire.top+4,'Defense overlaps fire control: '+explain);
   assert.ok(metrics.powers.right<=metrics.fire.left+5,'Powers and fire must sit side-by-side: '+explain);
   assert.ok(Math.abs(metrics.powers.top-metrics.fire.top)<=5,'Powers and fire are not aligned: '+explain);
   if(viewport.width>=850)assert.ok(Math.abs(metrics.ownBoard.width-metrics.board.width)<=4,'Desktop boards must share scale: '+explain);
   assert.ok(Math.abs(metrics.ownBoard.height-metrics.ownBoard.width)<=3,'Defense board distorted: '+explain);
   assert.equal(await page.locator('.zip-primary-board .board-main .cell').count(),64);
   assert.equal(await page.locator('.zip-own-board .board-preview .cell').count(),64);
   assert.ok(Math.abs(metrics.cell.width-metrics.cell.height)<=2,'Target cell distorted: '+explain);
   assert.ok(Math.abs(metrics.previewCell.width-metrics.previewCell.height)<=2,'Own cell distorted: '+explain);
   assert.ok(metrics.ownBoard.width>=Math.min(85,viewport.width*.27),'Defense board collapsed: '+explain);
   await page.screenshot({path:'artifacts/figma-combat/'+route+'-initial-'+viewport.width+'x'+viewport.height+'.png',fullPage:true});
   const turnPanel=page.locator('.zip-turn-panel');
   assert.equal(await page.locator('.zip-compass-widget').count(),0,'Decorative compass still present');
   assert.equal(await turnPanel.count(),1,'Missing turn panel');
   assert.ok(await page.locator('.bn-clock-turn').isVisible(),'Turn clock is not visible');
   assert.match(await page.locator('.bn-clock-turn').innerText(),/tempo do turno/i);
   const turnTitle=await page.locator('.zip-turn-headline').innerText();
   const turnHint=await page.locator('.zip-turn-hint').innerText();
   const fire=page.locator('[data-action="fire"]');
   if(status==='RIVAL') {
     assert.equal(turnTitle,'TURNO DO ADVERSÁRIO');
     assert.match(turnHint,/Aguarde a jogada do oponente/);
     assert.ok(await turnPanel.evaluate(el=>el.classList.contains('is-opponent-turn')));
     assert.ok(await fire.isDisabled(),'Shooting enabled during opponent turn');
     await page.screenshot({path:'artifacts/figma-combat/match-rival-'+viewport.width+'x'+viewport.height+'.png',fullPage:true});
     assert.deepEqual(errors,[],'Page errors '+explain);
     await page.close();
     continue;
   }
   if(status==='PAUSED') {
     assert.equal(turnTitle,'PARTIDA PAUSADA');
     assert.match(turnHint,/Aguardando reconexão/);
     assert.ok(await turnPanel.evaluate(el=>el.classList.contains('is-paused')));
     assert.ok(await fire.isDisabled(),'Shooting enabled while paused');
     assert.ok(await page.locator('.bn-gdd-paused').isVisible(),'Pause overlay missing');
     await page.screenshot({path:'artifacts/figma-combat/match-paused-'+viewport.width+'x'+viewport.height+'.png',fullPage:true});
     assert.deepEqual(errors,[],'Page errors '+explain);
     await page.close();
     continue;
   }
   assert.equal(turnTitle,'SEU TURNO');
   assert.match(turnHint,/Escolha um alvo ou use uma habilidade/);
   assert.ok(await turnPanel.evaluate(el=>el.classList.contains('is-your-turn')));

   assert.ok(await fire.isDisabled(),'Fire must be disabled before target selection');
   const target=page.locator('.zip-primary-board .board-main [data-coord="0,1"]');
   await target.click();
   assert.ok(await fire.isEnabled(),'Selecting target did not enable attack');
   assert.match(await page.locator('.zip-target-indicator').innerText(),/A2/);
   const menu=page.locator('.zip-battle-menu summary');
   await menu.click();
   assert.ok(await page.locator('[data-action="forfeit"]').isVisible(),'Forfeit option must remain reachable');
   await menu.click();
   const powers=page.locator('.zip-abilities-menu summary');
   const powerOptions=page.locator('.zip-abilities-options');
   assert.equal(await powerOptions.isVisible(),false,'Closed powers menu is covering the grid: '+explain);
   await powers.click();
   assert.ok(await powerOptions.isVisible(),'Powers do not open: '+explain);
   assert.equal(await page.locator('.zip-ability').count(),8);
   const popup=await powerOptions.boundingBox();
   assert.ok(popup && popup.x>=-2 && popup.x+popup.width<=viewport.width+2,
     'Power menu extends outside viewport: '+explain);
   await powers.click();
   assert.equal(await powerOptions.isVisible(),false,'Powers failed to close: '+explain);
   const pick=async id=>{
     await page.locator('.zip-abilities-menu summary').click();
     await page.locator('.zip-abilities-menu [data-action="pick-ability"][data-ability-id="'+id+'"]').click();
     assert.ok(await page.locator('.zip-power-guide').isVisible(),'Power guide missing: '+id+' '+explain);
     assert.ok(await page.locator('[data-action="cancel-ability"]').isVisible(),'Cancel missing: '+id);
     assert.ok(await page.locator('[data-action="activate-ability"]').isVisible(),'Activate missing: '+id);
   };
   await pick('radar');
   const hoverCell=page.locator('.zip-primary-board [data-coord="3,3"]');
   await hoverCell.hover();
   assert.equal(await page.locator('.zip-primary-board .pilot-skill-preview').count(),9,
     'Radar must preview its full 3x3 sector on hover: '+explain);
   await page.screenshot({path:'artifacts/figma-combat/match-radar-hover-'+viewport.width+'x'+viewport.height+'.png',fullPage:true});
   await hoverCell.click();
   assert.equal(await page.locator('.zip-primary-board .pilot-skill-target').count(),9,
     'Selecting radar anchor must retain nine marked cells: '+explain);
   assert.ok(await page.locator('[data-action="activate-ability"]').isEnabled());
   const enemyAfterSelection=await page.locator('.zip-primary-board .board-main').boundingBox();
   const footerGuide=await page.locator('.zip-power-guide').boundingBox();
   assert.ok(enemyAfterSelection&&footerGuide&&enemyAfterSelection.y+enemyAfterSelection.height<=footerGuide.y+3,
     'Power controls cover the enemy board: '+explain);
   const enemyVisibility=await page.locator('.zip-primary-board .board-main .cell').evaluateAll(cells=>{
     const board=cells[0].parentElement.getBoundingClientRect();
     const last=cells.at(-1).getBoundingClientRect();
     return last.bottom<=board.bottom+2&&last.right<=board.right+2;
   });
   assert.equal(enemyVisibility,true,'Skill hides last board row: '+explain);
   await page.locator('[data-action="cancel-ability"]').click();
   assert.equal(await page.locator('.zip-primary-board .pilot-skill-target').count(),0);
   await pick('double-shot');
   await page.locator('.zip-primary-board [data-coord="3,3"]').click();
   assert.equal(await page.locator('.zip-primary-board .pilot-skill-target').count(),1,'First double shot click marks only one target');
   assert.ok(await page.locator('[data-action="activate-ability"]').isDisabled(),'Double shot must wait for a second selected target');
   await page.locator('.zip-primary-board [data-coord="7,6"]').hover();
   assert.equal(await page.locator('.zip-primary-board .pilot-skill-preview').count(),2,'Hover previews both independent targets');
   await page.locator('.zip-primary-board [data-coord="7,6"]').click();
   assert.equal(await page.locator('.zip-primary-board .pilot-skill-target').count(),2,'Second click selects a distant second target');
   assert.ok(await page.locator('[data-action="activate-ability"]').isEnabled(),'Double shot should be ready after two distinct clicks');
   await page.locator('[data-action="cancel-ability"]').click();
   await pick('air-strike');
   await page.locator('.zip-primary-board [data-coord="3,3"]').hover();
   assert.equal(await page.locator('.zip-primary-board .pilot-skill-preview').count(),4,'Area strike must show 2x2');
   await page.locator('.zip-primary-board [data-coord="3,3"]').click();
   assert.equal(await page.locator('.zip-primary-board .pilot-skill-target').count(),4,'Area strike must select 4 affected cells');
   const beforeRotation=await page.locator('.zip-primary-board .pilot-skill-target').evaluateAll(nodes=>nodes.map(n=>n.dataset.cell).sort());
   await page.locator('[data-action="cycle-ability-direction"]').click();
   const afterRotation=await page.locator('.zip-primary-board .pilot-skill-target').evaluateAll(nodes=>nodes.map(n=>n.dataset.cell).sort());
   assert.notDeepEqual(afterRotation,beforeRotation,'Rotating the area attack must move the shown footprint');
   assert.equal(afterRotation.length,4,'Rotated air strike must retain 4 affected cells');
   assert.ok(await page.locator('[data-action="activate-ability"]').isEnabled(),'Rotated area remains one anchor');
   await page.locator('.zip-primary-board [data-coord="7,7"]').click();
   assert.ok(await page.locator('[data-action="activate-ability"]').isDisabled(),'Off-board orientation should not activate');
   await page.locator('[data-action="cycle-ability-direction"]').click();
   assert.equal(await page.locator('.zip-primary-board .pilot-skill-target').count(),4,
     'Rotating an edge anchor should recover a valid area without a second click');
   assert.ok(await page.locator('[data-action="activate-ability"]').isEnabled());
   await page.locator('[data-action="cancel-ability"]').click();
   await pick('line-barrage');
   await page.locator('.zip-primary-board [data-coord="3,3"]').click();
   assert.equal(await page.locator('.zip-primary-board .pilot-skill-target').count(),3,'Line barrage must auto choose 3 cells');
   assert.ok(await page.locator('[data-action="activate-ability"]').isEnabled());
   await page.locator('[data-action="cycle-ability-direction"]').click();
   assert.equal(await page.locator('.zip-primary-board .pilot-skill-target').count(),3,'Direction change lost selected footprint');
   await page.locator('[data-action="cancel-ability"]').click();
   await pick('hull-shield');
   if(viewport.width<850) {
     const ownPower=await page.locator('.zip-own-board .board-preview').boundingBox();
     const enemyPower=await page.locator('.zip-primary-board .board-main').boundingBox();
     assert.ok(ownPower && enemyPower && ownPower.width>enemyPower.width,
       'Defensive power must enlarge own board on mobile: '+explain);
     assert.ok(ownPower.y+ownPower.height<=viewport.height,
       'Defensive board must be reachable: '+explain);
     const guide=await page.locator('.zip-power-guide').boundingBox();
     assert.ok(guide && ownPower.y+ownPower.height<guide.y,
       'Defensive power controls overlap own board: '+explain);
   }
   await page.locator('.zip-own-board [data-coord="1,0"]').hover();
   assert.equal(await page.locator('.zip-own-board .pilot-skill-preview').count(),2,'Own hull shield does not preview ship');
   await page.locator('.zip-own-board [data-coord="1,0"]').click();
   assert.equal(await page.locator('.zip-own-board .pilot-skill-target').count(),2,'Own board click was interpreted as enemy');
   await page.locator('[data-action="cancel-ability"]').click();
   await pick('retreat');
   await page.locator('.zip-own-board [data-coord="1,0"]').click();
   assert.ok(await page.locator('[data-action="activate-ability"]').isEnabled(),'Retreat should select start and move automatically');
   assert.ok(await page.locator('.zip-own-board .pilot-skill-target').count()>=2);
   await page.locator('[data-action="cancel-ability"]').click();
   await pick('last-chance');
   assert.ok(await page.locator('[data-action="activate-ability"]').isEnabled(),'Targetless power should work without a board click');
   await page.locator('[data-action="cancel-ability"]').click();
   await page.screenshot({path:'artifacts/figma-combat/'+route+'-'+viewport.width+'x'+viewport.height+'.png',fullPage:true});
   assert.deepEqual(errors,[],'Page errors '+explain);
   console.log('PASS '+status+' '+viewport.width+'x'+viewport.height+'; ZIP battle board '+metrics.board.width.toFixed(0)+'px, scroll-free controls');
   await page.close();
  }
 }
} finally {
 await browser.close();
 await vite.close();
}
