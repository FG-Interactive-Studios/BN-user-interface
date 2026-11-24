import * as api from './client.js';
import {AudioManager,sceneEvent} from './audio-manager.js';
import {AudioEvents} from './audio-events.js';
import {updateClockNodes} from './game-clock.js';
import {audioPacks} from './audio-packs.js';
import { renderCosmeticStore } from './store-ui.js';
import {renderFleetEquipment,renderEquipmentSelection,equipmentCategory,ownedEquipment} from './fleet-equipment.js';
import {selectedExpression,publicExpression,impactAttacker,paidFuneral,paidCommentary} from './expressive-cosmetics.js';
import {tauntControls, equippedTaunts, funnyReaction, funeralReaction} from './chaos-humor.js';
import {walletMarkup,walletDialogMarkup} from './figma-wallet.js';
import {connectionStatusContent,connectionStatusLabel} from './connection-status.js';
import {RADAR_SWEEP_SECONDS, sonarContactMarkup} from './radar-blips.js';
import shipEmblem from '../assets/figma/ship-icon.png';
import cannonIcon from '../assets/figma/cannon.png';
import { renderFigmaResult } from './figma-result.js';
import {buildMatchReport,ridiculousAward} from './match-report.js';
import { renderFigmaProfile } from './figma-profile.js';
import {renderFigmaSettings,loadPreferences,savePreferences,settingKeys} from './figma-settings.js';
import { renderFigmaPlacement } from './figma-placement.js';
import { renderZipBattle } from './zip-battle.js';
import {renderAdminPanel} from './admin-panel.js';
import {planAbility, ABILITY_DIRECTIONS, abilityNeedsDirection, directionText} from './ability-targeting.js';
import { shipArt,equippedId,createCaptainMoodTracker } from './ship-art.js';
import { esc, renderBoard, keyOf, coordLabel, occupiedCells, shipName } from './board.js';
import { roomDeparture, resolvedRoute } from './room-flow.js';
import { compactEnemyContacts } from './mobile-presenters.js';

const logo = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 18h20l-3-6H5l-3 6zM8 12V8h4v4M12 6V4"/></svg>`;
const brand = () => `<div class="brand"><div class="brand-mark">${logo}</div><div><div class="brand-name">Batalha Naval</div><div class="brand-sub">Duelo 1v1 em alto-mar</div></div></div>`;
const state = {
  profile: null, modes: [], lobby: null, queue: null, queueStartedAt: null, preparation: null, battle: null,
  modeId: 'classic', selected: null, draft: null, placementShip: null, orientation: 'HORIZONTAL',
  notice: '', error: false, busy: false, socketOnline: false, initialized: false,
  roomExitNotice: null, leavingRoom: false,
  skillMode: null, skillTargets: [], skillArea: [], skillAnchor: null, skillDirection: 'RIGHT', skillDialog: false,
  adminModes: null, adminLoading: false, adminError: '',
  adminTab:'modes', adminProducts:null, adminStoreLoading:false, adminStoreError:'',
  store: null, demoTopupRequests: new Map(), storeLoading: false, storeFilter: 'ALL', walletDialog:null, profileEditorOpen: false, profileSecurityOpen: false,
  preferences: loadPreferences(),
};
const audio=new AudioManager({packs:audioPacks});
const audioEvents=new AudioEvents();
const captainMoodTracker=createCaptainMoodTracker();
let audioRoute='';
let storeLoadGeneration=0;
const rewardReceipts=new Map();
const rewardRequests=new Set();
const shownTaunts=new Set();
const celebratedMatches=new Set();
let chaosToastTimer;
let activeChaosToast=null;
function mountChaosToast(){
  if(!root || currentRoute()!=='match'||!activeChaosToast
      ||Date.now()>activeChaosToast.until)return;
  root.querySelector('.bn-chaos-toast')?.remove();
  const toast=document.createElement('div');
  toast.className='bn-chaos-toast is-'+activeChaosToast.kind;
  toast.setAttribute('role','status');
  toast.textContent=activeChaosToast.text;
  if(activeChaosToast.clown){const deco=document.createElement('span');deco.className='bn-impact-clowns';deco.setAttribute('aria-hidden','true');deco.textContent='🤡 🎉 🤡 🎊 🤡';toast.append(deco);}
  root.append(toast);
}
function showChaosToast(message,kind='taunt',clown=false){
  if(!root||currentRoute()!=='match')return;
  activeChaosToast={text:message,kind:kind==='hit'?'hit':kind==='miss'?'miss':kind==='sunk'?'sunk':'taunt',
    until:Date.now()+3200,clown};
  mountChaosToast();
  clearTimeout(chaosToastTimer);
  chaosToastTimer=setTimeout(()=>{
    activeChaosToast=null;root?.querySelector('.bn-chaos-toast')?.remove();
  },3200);
}
function showTauntMessage(data){
  if(!data || data.roomCode!==state.lobby?.code||typeof data.message!=='string'
     || typeof data.id!=='string'||shownTaunts.has(data.id))return;
  shownTaunts.add(data.id);
  if(shownTaunts.size>40)shownTaunts.delete(shownTaunts.values().next().value);
  const sender=state.lobby?.players?.find(p=>p.id===data.senderId);
  const who=data.senderId===state.profile?.id?'Você':sender?.nickname||'O adversário';
  showChaosToast(who+': '+data.message);
}
function claimVirtualRewardIfFinished(){
  const b=state.battle,uid=state.profile?.id;
  if(!b||b.status!=='FINISHED'||!b.matchId||!uid
     ||rewardRequests.has(b.matchId)||rewardReceipts.has(b.matchId))return;
  const matchId=b.matchId;
  rewardRequests.add(matchId);
  void api.post('/store/rewards/claim').then(receipt=>{
    if(!api.isAuthenticated()||state.profile?.id!==uid)return;
    rewardReceipts.set(matchId,receipt);
    if(receipt.wallet)state.store=receipt.wallet;
    if(currentRoute()==='result')render();
  }).catch(error=>{
    if(error instanceof api.ApiError && [404,409].includes(error.status))
      rewardReceipts.set(matchId,{unsupported:true});
    // Retry transient errors only when another authenticated room snapshot arrives.
    else rewardRequests.delete(matchId);
  }).finally(()=>rewardRequests.delete(matchId));
}
function configureAudio(route){
  audio.setState({packId:state.store?.items?.find(item=>item.category==='SOUND'&&item.equipped&&item.owned)?.id||'sound_default',preferences:state.preferences,scene:sceneEvent(route,state.lobby?.status,{battle:state.battle,userId:state.profile?.id,queueStatus:state.queue?.status})});
}
function syncAudio(route){
  if((audioRoute==='match'||audioRoute==='result')&&route!==audioRoute&&!(audioRoute==='match'&&route==='result'))audio.stopEffects();
  const changedRoute=audioRoute&&audioRoute!==route;
  audioRoute=route;
  configureAudio(route);
  // Do not overlap the outcome or combat entry with generic UI transitions.
  if(changedRoute&&!['match','result','placement'].includes(route))audio.play('ui_transition');
  const before=audioEvents.battle;
  const events=audioEvents.update({room:state.lobby,battle:state.battle,userId:state.profile?.id});
  for(const event of events)audio.play(event);
  if(route==='match'){
    const rev=state.battle?.revision||0, me=state.profile?.id, rival=state.lobby?.players?.find(p=>p.id!==me)?.id;
    const victim=events.includes('ship_sunk_ally')?me:events.includes('ship_sunk_enemy')?rival:null;
    const funeral=victim==null?null:paidFuneral(publicExpression(state.lobby,victim,'FUNERAL'),rev);
    const reaction=funeral?{kind:'sunk',text:funeral}:funeralReaction(events,rev)||funnyReaction(events,rev);
    const attacker=impactAttacker(before,state.battle,me,rival);
    const clown=attacker!=null&&publicExpression(state.lobby,attacker,'ATTACK')==='attack_clown';
    if(reaction)showChaosToast(paidCommentary(selectedExpression(state.store?.items,'COMMENTATOR'),reaction.kind,rev)||reaction.text,reaction.kind,clown);
  }
}
let root;
let refreshTimer;
let clockHudTimer;
let lastFallbackReconcileAt=0;
let loading=false;
let supportsMatchmakingState=true; // Old API builds still use legacy lookups.
let renderedRoute='';
function updateNotice() {
  const node=root?.querySelector?.('#tp-notice-root');
  if (node) node.innerHTML=state.walletDialog?'':alertNode();
}
function updateConnectionIndicator() {
  const badge=root?.querySelector('[data-socket-status]');
  if(!badge)return;
  const online=state.socketOnline;
  badge.dataset.online=String(online);
  badge.setAttribute('aria-label',connectionStatusLabel(online));
  badge.title=connectionStatusLabel(online);
  badge.innerHTML=connectionStatusContent(online);
}


function notice(message, error=false) { state.notice=message; state.error=error; updateNotice(); }
function activeMode() { return state.battle?.mode || state.preparation?.mode || state.lobby?.mode || state.modes.find(m=>m.id===state.modeId) || null; }
function currentRoute() { return decodeURIComponent(location.hash.slice(1).split('?')[0] || 'auth'); }
function go(route) {
  route = resolvedRoute(route, api.isAuthenticated(), state.lobby?.status);
  if (route!=='profile') {state.profileEditorOpen=false;state.profileSecurityOpen=false;}
  if(route==='admin'&&state.profile?.admin!==true)return notice('Área restrita a administradores.',true);
  if (currentRoute()===route&&!(route==='fleet'&&fleetCategory())) render(); else location.hash=route;
}
function nav(active='play') {
  return `<nav class="bottom-nav bn-bottom-nav" aria-label="Navegação principal">
    <button type="button" class="nav-btn bn-nav-fleet ${active==='fleet'?'active':''}" data-go="fleet" ${active==='fleet'?'aria-current="page"':''}>Equipe</button>
    <button type="button" class="nav-btn play bn-nav-play ${active==='play'?'active':''}" data-go="lobby" ${active==='play'?'aria-current="page"':''}>Play</button>
    <button type="button" class="nav-btn bn-nav-store ${active==='store'?'active':''}" data-go="store" ${active==='store'?'aria-current="page"':''}>Loja</button>
  </nav>`;
}
function header() {
  const nickname=esc(state.profile?.nickname || 'Capitão');
  const showWallet=['lobby','store'].includes(currentRoute());
  return `<header class="topbar bn-topbar bn-shared-header ${showWallet?'has-wallet':'without-wallet'}">
    <button type="button" class="bn-header-identity" data-go="profile" aria-label="Abrir meu perfil">
      <span class="bn-header-avatar" aria-hidden="true"><img src="${shipEmblem}" alt="" width="42" height="42"></span>
      <span class="bn-header-player"><strong>${nickname}</strong><small>Conta de jogador</small></span>
    </button>
    <div class="bn-header-actions">
      <span class="bn-connection-status" data-socket-status data-online="${state.socketOnline}" role="status" aria-label="${connectionStatusLabel(state.socketOnline)}" title="${connectionStatusLabel(state.socketOnline)}">${connectionStatusContent(state.socketOnline)}</span>
      ${showWallet?walletMarkup(state.store,{compact:true}):''}
      <details class="tp-account-menu bn-account-menu"><summary aria-label="Abrir menu da conta" title="Menu da conta"><span aria-hidden="true">☰</span></summary>
        <div class="tp-account-popover"><button type="button" data-go="profile">Meu perfil</button><button type="button" data-go="settings">Configurações</button>${state.profile?.admin===true?'<button type="button" data-go="admin">Área administrativa</button>':''}<button type="button" data-action="logout">Sair</button></div>
      </details>
    </div>
  </header>`;
}
function screen(content,{active='play',noNav=false,noHeader=false,variant=''}={}) { return `<div class="screen ${variant}"><div class="shell">${noHeader?'':header()}<main class="main">${content}</main>${noNav?'':nav(active)}</div></div>`; }
function panel(title,body,cls='') { return `<section class="panel tp-panel ${cls}"><div class="eyebrow">Comando naval</div><h2 class="panel-title" style="margin:8px 0 16px">${title}</h2>${body}</section>`; }
function mainContent(inner,{active='play',noNav=false,noHeader=false,variant=''}={}) {return screen(`<div class="tp-content">${inner}</div>`,{active,noNav,noHeader,variant});}
function alertNode() { return state.notice ? `<div class="tp-notice ${state.error?'error':''}" role="alert">${esc(state.notice)} <button type="button" data-action="dismiss" style="float:right;background:transparent;color:inherit;border:0;cursor:pointer">×</button></div>` : ''; }
function routeForLobby(status) {return status==='WAITING'?'matchmaking':status==='PREPARING'?'placement':status==='PLAYING'?'match':status==='FINISHED'?'result':'lobby';}
function synchronizeRoute() {
  // Keep the departure dialog open until acknowledged, including after a room closes.
  if (state.roomExitNotice) { if (!state.lobby && currentRoute()!=='lobby') go('lobby'); return; }
  if (!state.lobby) {
    if(state.queue?.status==='SEARCHING') {
      if(['lobby','placement','match','result'].includes(currentRoute()))go('matchmaking');
    } else if(['placement','match','result'].includes(currentRoute()))go('lobby');
    return;
  }
  const route=routeForLobby(state.lobby.status);
  if (currentRoute()!==route && ['matchmaking','placement','match','result','lobby'].includes(currentRoute())) go(route);
}
async function guard(action) {
  if (state.busy) return;
  state.busy=true; state.notice=''; state.error=false; render();
  try { await action(); }
  catch(error) {
    state.notice=error?.message||'Falha inesperada na operação.';state.error=true;
    if (error instanceof api.ApiError && error.status===401) {api.clearSession(); reset();go('auth');}
  } finally {state.busy=false;render();}
}
function reset(){storeLoadGeneration++;rewardReceipts.clear();rewardRequests.clear();shownTaunts.clear();celebratedMatches.clear();clearTimeout(chaosToastTimer);activeChaosToast=null;audio.stop();audioEvents.reset();captainMoodTracker.reset();audioRoute='';state.skillMode=null;state.skillTargets=[];state.skillDialog=false;state.profile=null;state.modes=[];state.lobby=null;state.queue=null;state.queueStartedAt=null;state.preparation=null;state.battle=null;state.draft=null;state.placementShip=null;state.selected=null;state.socketOnline=false;state.roomExitNotice=null;state.leavingRoom=false;state.adminModes=null;state.adminLoading=false;state.adminError='';state.adminTab='modes';state.adminProducts=null;state.adminStoreLoading=false;state.adminStoreError='';state.store=null;state.demoTopupRequests.clear();state.storeLoading=false;state.storeFilter='ALL';state.walletDialog=null;state.profileEditorOpen=false;state.profileSecurityOpen=false;state.preferences=loadPreferences();}
async function sessionInit() {
  state.profile=await api.get('/users/me');
  state.modes=await api.get('/game-modes');
  if (!state.modes.some(m=>m.id===state.modeId)) state.modeId=state.modes[0]?.id||'';
  void loadStore({quiet:true});
  await reconcile();
  await api.connectRealtime((message)=>{
    if(message.type==='TAUNT_SENT') {showTauntMessage(message.data);return;}
    if (['LOBBY_UPDATED','LOBBY_CLOSED','LOBBY_LEFT','MATCH_FOUND','MATCH_SEARCHING','PREPARATION_UPDATED','BATTLE_UPDATED'].includes(message.type)) {
      // REST always recovers an authoritative personalized snapshot, including after reconnection.
      void reconcile();
    }
  }, online => {
    state.socketOnline=online; updateConnectionIndicator();
    if(online) {
      lastFallbackReconcileAt=Date.now();
      void reconcile();
    }
  });
  // Event-first synchronization: server events prompt an immediate authoritative
  // snapshot. REST is a safety net, not a substitute for websocket presence.
  // 60s when online; 20s while recovering from a websocket outage.
  if (!refreshTimer) refreshTimer=setInterval(()=>{
    if (!api.isAuthenticated()) return;
    const now=Date.now();
    // Search must progress even when the player's socket is unavailable.
    if (state.queue?.status==='SEARCHING' ||
       (state.lobby && (!state.socketOnline || now-lastFallbackReconcileAt >= 60000))) {
      lastFallbackReconcileAt=now;
      void reconcile();
    }
  }, 5000);
}
async function reconcile() {
  if (!api.isAuthenticated() || loading) return;
  loading=true;
  try {
    let room=null, queue=null;
    if (supportsMatchmakingState) {
      try {
        // IDLE is HTTP 200, not two expected 404s on every reconciliation.
        // This single snapshot also covers private rooms and public matches.
        const snapshot=await api.get('/matchmaking/state');
        if (snapshot?.status==='MATCHED') room=snapshot.room;
        else if (snapshot?.status==='SEARCHING') queue=snapshot;
        else if (snapshot?.status!=='IDLE')
          throw new Error('Estado de matchmaking desconhecido.');
      } catch(e) {
        if (e instanceof api.ApiError && e.status===404)
          supportsMatchmakingState=false; // Compatibility with earlier backend versions.
        else throw e;
      }
    }
    if (!supportsMatchmakingState) {
      // Compatibility path used only when the connected API predates /state.
      try { room=await api.get('/matchmaking/lobbies/me'); }
      catch(e) { if (!(e instanceof api.ApiError && e.status===404))throw e; }
      if (!room) {
        try {
          const search=await api.get('/matchmaking/queue/me');
          if(search?.status==='MATCHED'&&search.room)room=search.room;
          else if(search?.status==='SEARCHING')queue=search;
        } catch(e) { if (!(e instanceof api.ApiError && e.status===404))throw e; }
      }
    }
    if (!api.isAuthenticated()) return;
    if (room && state.lobby?.code===room.code && room.revision < state.lobby.revision) return;
    const previousRoom=state.lobby;
    const previous=previousRoom?.status;
    let changed=JSON.stringify(previousRoom)!==JSON.stringify(room)
      || JSON.stringify(state.queue)!==JSON.stringify(queue);
    if (!state.leavingRoom && !state.roomExitNotice && !(previousRoom?.publicMatch && queue)) {
      const departure = roomDeparture(previousRoom, room, state.profile?.id);
      if (departure) {
        state.roomExitNotice={type:departure};
        changed=true;
      }
    }
    state.lobby=room;
    if(queue?.status==='SEARCHING'){
      if(!state.queueStartedAt)state.queueStartedAt=Date.now();
    }else state.queueStartedAt=null;
    state.queue=queue;
    if (!room) {
      state.skillMode=null;state.skillTargets=[];state.skillDialog=false;
      if (state.preparation || state.battle || state.draft) changed=true;
      state.preparation=null;state.battle=null;state.draft=null;
    }
    else if (room.status==='PREPARING') {
      if (state.battle) changed=true;
      state.battle=null;
      const prep=await api.get('/matches/me/placement');
      if (!state.preparation || state.preparation.preparationId!==prep.preparationId || prep.revision>=state.preparation.revision) {
        changed ||= JSON.stringify(state.preparation)!==JSON.stringify(prep);
        state.preparation=prep;
        if (previous!=='PREPARING') {state.draft=null;state.placementShip=null;state.orientation='HORIZONTAL';}
      }
    } else if (['PLAYING','FINISHED'].includes(room.status)) {
      if (state.preparation) changed=true;
      state.preparation=null;
      const battle=await api.get('/matches/me');
      if (state.battle?.matchId!==battle.matchId) {state.skillMode=null;state.skillTargets=[];state.skillDialog=false;}
      if (!state.battle || state.battle.matchId!==battle.matchId || battle.revision>=state.battle.revision) {
        changed ||= JSON.stringify(state.battle)!==JSON.stringify(battle);
        state.battle=battle;
      }
    } else {
      if (state.preparation || state.battle) changed=true;
      state.preparation=null;state.battle=null;
    }
    synchronizeRoute();
    claimVirtualRewardIfFinished();
    // Avoid replacing a 100-cell DOM board every 7 s when nothing changed.
    if (changed || currentRoute()!==renderedRoute) render();
  } catch(error) {
    if(error instanceof api.ApiError && error.status===401) { api.clearSession();reset();go('auth'); }
    else if(error instanceof api.ApiError && error.status!==404 && error.status!==409) {
      state.notice=`Sincronização: ${error.message}`;state.error=true;render();
    }
  } finally {loading=false;}
}

function authForm(isRegister=false) {
  const fields=isRegister
    ? '<div class="bn-field"><label for="nick">Nome de usuário</label><input id="nick" name="nickname" autocomplete="nickname" minlength="3" maxlength="30" placeholder="Escolha seu nome de capitão" required /></div>'
    : '';
  return `<div class="screen bn-design-screen bn-auth-screen"><main class="bn-auth ${isRegister?'bn-register':''}">
    ${isRegister
      ? '<header class="bn-register-title"><button type="button" data-go="auth" class="bn-back-button" aria-label="Voltar ao login">‹</button><h1>Cadastro</h1><p>Crie sua conta e monte sua frota</p></header>'
      : '<div class="bn-auth-logo" aria-label="Batalha Naval"><span class="bn-auth-emblem" aria-hidden="true">⚓</span><h1>Batalha Naval</h1><p>Duelo 1v1 em alto-mar</p></div>'}
    <section class="bn-auth-panel" aria-label="${isRegister?'Criar conta':'Acessar conta'}">
      <form class="tp-form bn-auth-form" data-form="${isRegister?'register':'login'}">
        ${fields}
        <div class="bn-field"><label for="email">${isRegister?'E-mail':'E-mail'}</label><input id="email" name="email" type="email" autocomplete="email" placeholder="${isRegister?'Digite seu e-mail':'Seu e-mail'}" required maxlength="254" /></div>
        <div class="bn-field"><label for="password">Senha</label><input id="password" name="password" type="password" autocomplete="${isRegister?'new-password':'current-password'}" placeholder="Digite sua senha" ${isRegister?'minlength="8"':''} maxlength="72" required /></div>
        ${isRegister?'<div class="bn-field"><label for="repeat">Confirmar senha</label><input id="repeat" name="repeat" type="password" autocomplete="new-password" placeholder="Confirme sua senha" minlength="8" maxlength="72" required /></div>':'<p class="bn-auth-help">Recuperação de senha em breve</p>'}
        <button type="submit" class="btn btn-primary bn-primary-button">${isRegister?'Criar conta':'Entrar'}</button>
      </form>
    </section>
    <div class="bn-auth-switch"><span>${isRegister?'Já tem conta?':'Ainda não tem conta?'}</span><button type="button" class="bn-pill-button" data-go="${isRegister?'auth':'register'}">${isRegister?'Entrar':'Criar conta'}</button></div>
  </main></div>`;
}

/** Figma-approved green sonar; matchmaking still uses the API state. */
function radarMarkup() {
  return `<div class="radar bn-search-radar" style="--radar-period:${RADAR_SWEEP_SECONDS}s" aria-hidden="true">
    <span class="bn-radar-grid"></span><span class="bn-radar-axis is-horizontal"></span>
    <span class="bn-radar-axis is-vertical"></span>
    <span class="bn-radar-ring ring-one"></span><span class="bn-radar-ring ring-two"></span>
    <span class="bn-radar-ring ring-three"></span><span class="bn-radar-ring ring-four"></span>
    <span class="bn-radar-sweep"></span>${sonarContactMarkup()}
    <span class="bn-radar-center"></span>
  </div>`;
}
function updateSearchElapsed(){
  const node=root?.querySelector?.('[data-search-elapsed]');
  if(!node || !state.queueStartedAt)return;
  const elapsed=Math.max(0,Math.floor((Date.now()-state.queueStartedAt)/1000));
  node.textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(elapsed%60).padStart(2,'0');
}

function lobbyScreen() {
  if (state.lobby) return waitingScreen();
  return mainContent(`<div class="bn-lobby">
    <section class="bn-feature-card" aria-labelledby="bn-feature-title">
      <span class="bn-feature-icon" aria-hidden="true"><img src="${cannonIcon}" alt="" width="116" height="116" /></span>
      <div class="bn-feature-copy"><span class="bn-kicker">EVENTO</span><h1 id="bn-feature-title">Tempestade de Aço</h1>
        <p>Novos desafios e recompensas chegarão em breve.</p><small>Em desenvolvimento</small></div>
    </section>
    <section class="bn-news-grid" aria-label="Novidades">
      <article class="bn-news-card"><span class="bn-kicker">NOVIDADE</span><strong>Novas embarcações</strong><small>Personalizações em breve</small></article>
      <article class="bn-news-card"><span class="bn-kicker">NOVIDADE</span><strong>Novas temporadas</strong><small>Progressão em breve</small></article>
    </section>
    <div class="bn-rank-card"><span class="bn-rank-emblem" aria-hidden="true"><img src="${shipEmblem}" alt="" width="50" height="50" /></span><div><strong>Patentes em breve</strong><small>Batalhas privadas 1v1</small></div></div>
    <div class="bn-lobby-actions">
      <button type="button" class="btn btn-primary bn-primary-button" data-go="matchmaking" ${state.modes.length?'':'disabled'}>Jogar</button>
      <button type="button" class="bn-pill-button bn-join-button" data-action="open-join-modal">Entrar com código</button>
    </div>
  </div>
  <dialog id="tp-join-dialog" class="tp-join-dialog" aria-labelledby="tp-join-title">
    <div class="tp-modal-header"><div><div class="eyebrow">Convite de partida</div><h2 id="tp-join-title">Entrar em uma sala</h2></div>
      <button type="button" data-action="close-join-modal" aria-label="Fechar janela">×</button></div>
    <form data-form="join" class="tp-form"><div class="field"><label for="room-code">Código de seis caracteres</label>
      <input id="room-code" name="code" placeholder="ABC234" maxlength="6" minlength="6" pattern="[a-zA-Z0-9]{6}" autocomplete="off" required style="text-transform:uppercase" /></div>
      <p class="tp-modal-feedback" role="alert" aria-live="polite"></p><div class="tp-modal-actions">
      <button class="btn btn-ghost" type="button" data-action="close-join-modal">Cancelar</button>
      <button class="btn btn-primary" type="submit">Entrar na sala</button></div></form>
  </dialog>`);
}

function waitingScreen() {
  const room=state.lobby;
  if (!room && state.queue?.status==='SEARCHING') {
    const mode=state.modes.find(mode=>mode.id===state.queue.modeId);
    return mainContent(`<section class="bn-queue-search" aria-label="Buscando adversário">
      <div class="bn-queue-header">
        <span class="bn-kicker">PAREAMENTO ONLINE</span>
        <h1>Procurando partida</h1>
        <p>Buscando outro capitão para <strong>${esc(mode?.name||state.queue.modeId)}</strong></p>
      </div>
      ${radarMarkup()}
      <div class="bn-queue-readout" role="status" aria-live="polite">
        <span>Tempo de busca nesta sessão</span>
        <strong data-search-elapsed>00:00</strong>
        <small>Buscando adversário<span class="bn-queue-ellipsis" aria-hidden="true">...</span></small>
      </div>
      <div class="bn-queue-footer">
        <p>A sala abrirá automaticamente quando outro jogador for encontrado.</p>
        <button type="button" class="bn-room-leave-button" data-action="cancel-public-search">Cancelar busca</button>
      </div>
    </section>`,{noNav:true,noHeader:true,variant:'bn-waiting-screen bn-queue-screen'});
  }
  if (!room) {
    const options=state.modes.map(mode=>`<option value="${esc(mode.id)}" ${state.modeId===mode.id?'selected':''}>${esc(mode.name)} · ${mode.geometry?.cells?.length||0} casas</option>`).join('');
    return mainContent(`<div class="matchmaking-wrap tp-create-room-wrap"><section class="panel mm-card tp-create-room-card tp-room-setup bn-match-choice">
      <div class="eyebrow">Canal de combate</div><h2 class="form-title">Encontrar uma batalha</h2>
      <p class="form-sub tp-setup-description">Escolha o modo e encontre outro jogador automaticamente, sem código.</p>
      <div class="tp-create-mode"><label class="eyebrow" for="mode-picker">Modo de jogo</label>
        <select class="tp-mode-select" id="mode-picker" ${options?'':'disabled'}>${options||'<option>Sem modos habilitados</option>'}</select></div>
      <button type="button" class="btn btn-orange bn-search-button" data-action="find-public-match" ${options?'':'disabled'}>Buscar partida</button>
      <div class="bn-match-separator"><span>ou jogue com amigos</span></div>
      <button type="button" class="btn btn-ghost bn-private-button" data-action="create-lobby" ${options?'':'disabled'}>Criar sala com código</button>
      <button type="button" class="bn-match-back" data-go="lobby">← Voltar ao lobby</button>
    </section></div>`,{noNav:true});
  }
  // The backend only exposes name, avatar ID, connection and readiness.
  // The approved art also depicts level, wins and a countdown, none of which
  // exist in LobbyResponse yet; never fabricate those values on the client.
  const host=room.players[0] || null;
  const guest=room.players[1] || null;
  const me=room.players.find(p=>p.id===state.profile?.id);
  const other=room.players.find(p=>p.id!==state.profile?.id);
  const readyCount=room.players.filter(p=>p.ready).length;
  const playerCard=(player,role)=>{
    const nickname=player?.nickname || 'Vaga disponível';
    const initial=player ? (Array.from(String(nickname).trim())[0] || '?').toLocaleUpperCase('pt-BR') : '+';
    const isSelf=player?.id===state.profile?.id;
    const status=player ? player.ready ? 'Pronto' : !player.connected ? 'Desconectado' : 'Aguardando' : 'Aguardando';
    return `<article class="bn-room-player ${player?'':'bn-room-player-empty'}" aria-label="${esc(role)}: ${esc(nickname)}, ${status}">
      <span class="bn-room-avatar" aria-hidden="true">${esc(initial)}</span>
      <div class="bn-room-player-details">
        <h2>${esc(nickname)}</h2>
        <p class="bn-room-player-role">${isSelf?'Você · ':''}${role}${player ? '' : ' · Aguardando jogador'}</p>
        <span class="bn-room-ready ${player?.ready?'is-ready':'is-waiting'}"><i aria-hidden="true"></i>${status}</span>
      </div>
    </article>`;
  };
  return mainContent(`<section class="bn-waiting-room" aria-labelledby="bn-waiting-heading">
    <div class="bn-room-heading">
      <button type="button" class="bn-room-close" data-action="leave-lobby" aria-label="Sair da sala" title="Sair da sala">×</button>
      <h1 id="bn-waiting-heading">Sala de espera</h1>
    </div>
    <p class="bn-room-description">${room.publicMatch
      ? 'Adversário encontrado! Os dois capitães precisam marcar Pronto para posicionar a frota.'
      : 'A batalha começa quando os dois capitães estiverem prontos.'}</p>
    ${room.publicMatch
      ? '<div class="bn-queue-found" role="status">Pareamento público · adversário encontrado</div>'
      : `<button type="button" data-action="copy-code" class="bn-room-invite" aria-label="Copiar código da sala ${esc(room.code)}">
          <span>Código da sala</span><strong>${esc(room.code)}</strong><span aria-hidden="true">⧉</span>
        </button>`}
    <div class="bn-room-duel" aria-label="Capitães da sala">
      ${playerCard(host,room.publicMatch?'Jogador 1':'Anfitrião')}
      <div class="bn-room-versus" aria-hidden="true">VS</div>
      ${playerCard(guest,room.publicMatch?'Jogador 2':'Convidado')}
    </div>
    <p class="bn-room-confirmation" role="status" aria-live="polite">
      <span>${other ? 'Confirmações' : 'Aguardando adversário'}</span>
      <strong>${readyCount} de 2 prontos</strong>
    </p>
    <div class="bn-room-controls">
      <button type="button" class="bn-room-ready-button" data-action="ready" ${other?'':'disabled'}>
        ${me?.ready?'Cancelar prontidão':'Pronto'}
      </button>
      <button type="button" class="bn-room-leave-button" data-action="leave-lobby">Sair da sala</button>
    </div>
  </section>`,{noNav:true,noHeader:true,variant:'bn-waiting-screen'});
}

function fleetPanel(mode, ships, verified=false) {
  if (!mode) return '';
  return `<div class="tp-list tp-ships">${mode.fleet.map((def,i)=>{
    const placed=ships.find(s=>s.type===def.id);
    return `<div><span><b>${esc(shipName(def.id))}</b><small class="tp-muted"> · ${def.length} casas</small></span><span class="tp-tag">${placed?`${coordLabel(placed)} · ${esc(placed.orientation)}`:verified?'Pendente':'Não posicionado'}</span></div>`;
  }).join('')}</div>`;
}
function placementScreen(){
  const p=state.preparation,mode=p?.mode||activeMode();
  if (!p||!mode) return mainContent(panel('Carregando preparação','Aguarde a atualização do servidor.'),{noNav:true});
  // The approved Figma screen wraps the very same renderBoard(mode, ...) renderer
  // used in combat and the old placement view. Board tiles and styling are untouched.
  const directions=mode.placementDirections || [];
  if (!directions.includes(state.orientation)) state.orientation=directions[0] || 'HORIZONTAL';
  return renderFigmaPlacement({
    preparation:p,mode,draft:state.draft,selectedShipId:state.placementShip,
    orientation:state.orientation,skin:equippedId(state.store?.items,'SKIN','skin_default'),
  });
}

function skillMeta(id) { return (state.battle?.yourAbilities||[]).find(a=>a.id===id); }
function skillLimit(id){return Number(skillMeta(id)?.targetCount)||0;}
function skillScope(id){return skillMeta(id)?.targetScope||'ENEMY';}
function clearSkillTargeting(){
  state.skillTargets=[];state.skillArea=[];state.skillAnchor=null;
}
function chooseAbilityTarget(anchor){
  const selectedTargets=state.skillMode==='double-shot' && state.skillTargets.length===1 ? state.skillTargets : [];
  const plan=planAbility({ability:skillMeta(state.skillMode),anchor,mode:state.battle?.mode||activeMode(),battle:state.battle,direction:state.skillDirection,selectedTargets});
  if(!plan.valid)return plan;
  state.skillAnchor=anchor;state.skillTargets=plan.targets;state.skillArea=plan.affected;
  return plan;
}
function skillTargetSummary(){
  if(state.skillMode==='double-shot'){
    if(!state.skillTargets.length)return 'Escolha a primeira casa; depois uma segunda, em qualquer posição.';
    if(state.skillTargets.length===1)return 'Primeira casa: '+coordLabel(state.skillTargets[0])+' · Escolha a segunda.';
    return 'Alvos: '+state.skillTargets.map(coordLabel).join(' e ')+' · Confirme o poder.';
  }
  if(!state.skillArea.length)return state.skillAnchor && abilityNeedsDirection(state.skillMode) ? 'Use ↻ Girar para ajustar a área.' : 'Toque numa casa para escolher a área.';
  return state.skillArea.length===1?'1 casa afetada':state.skillArea.length+' casas afetadas';
}
function paintAbilityPreview(target){
  const screen=root.querySelector('.bn-zip-battle');
  if(!screen||!state.skillMode)return;
  const board=target?.closest('.zip-own-board,.zip-primary-board');
  const scope=board?.classList.contains('zip-own-board')?'OWN':'ENEMY';
  const raw=target?.dataset.coord?.split(',').map(Number);
  const selectedTargets=state.skillMode==='double-shot' && state.skillTargets.length===1 ? state.skillTargets : [];
  const alreadyComplete=state.skillMode==='double-shot' && state.skillTargets.length===2;
  const plan=!alreadyComplete&&raw?.length===2&&skillScope(state.skillMode)===scope
    ? planAbility({ability:skillMeta(state.skillMode),anchor:{row:raw[0],col:raw[1]},mode:state.battle?.mode||activeMode(),battle:state.battle,direction:state.skillDirection,selectedTargets})
    : null;
  screen.querySelectorAll('.pilot-skill-preview,.pilot-skill-preview-origin,.pilot-skill-preview-destination').forEach(node=>{
    node.classList.remove('pilot-skill-preview','pilot-skill-preview-origin','pilot-skill-preview-destination');
  });
  const readout=screen.querySelector('.zip-target-indicator b');
  if(readout)readout.textContent=plan?.valid
    ? plan.affected.length+' casas'
    : plan?.reason||skillTargetSummary();
  if(!plan?.valid||!board)return;
  const affected=new Set(plan.affected.map(keyOf)),origin=new Set(plan.origin.map(keyOf)),destination=new Set(plan.destination.map(keyOf));
  board.querySelectorAll('[data-cell]').forEach(node=>{
    if(affected.has(node.dataset.cell))node.classList.add('pilot-skill-preview');
    if(origin.has(node.dataset.cell))node.classList.add('pilot-skill-preview-origin');
    if(destination.has(node.dataset.cell))node.classList.add('pilot-skill-preview-destination');
  });
}
function skillDialogMarkup(){
  const abilities=state.battle?.yourAbilities||[];
  if(!abilities.length)return '';
  return `<dialog id='tp-skill-dialog' class='tp-join-dialog' aria-labelledby='tp-skill-title'><div class='tp-modal-header'><div><div class='eyebrow'>Mecânicas especiais · piloto</div><h2 id='tp-skill-title'>Escolher habilidade</h2></div><button type='button' data-action='close-abilities' aria-label='Fechar'>×</button></div><p class='tp-muted tp-small'>As regras são experimentais. Cada poder custa um turno. <span class='tp-skill-credit'>Pontos da partida: ${state.battle?.yourAbilityPointsEarned ?? 0}</span>.</p><div class='tp-skill-options'>${abilities.map(a=>`<button class='btn btn-ghost tp-skill-option' data-action='pick-ability' data-ability-id='${esc(a.id)}' ${a.usesRemaining>0&&!a.locked?'':'disabled'}><b>${esc(a.name)} · ${a.usesRemaining} uso(s)</b><small>${esc(a.description||'Habilidade tática')}${a.locked?' · Bloqueada (sem pontos ou interferência)':''}</small></button>`).join('')}</div><div class='tp-modal-actions'><button class='btn btn-ghost' data-action='close-abilities'>Cancelar</button></div></dialog>`;
}
function shotSummary(shots){return {hits:shots.filter(x=>x.hit&&!x.blocked),misses:shots.filter(x=>!x.hit&&!x.blocked)};}
function battleScreen(){
  const b=state.battle,mode=b?.mode||activeMode();
  if (!b||!mode) return mainContent(panel('Sincronizando batalha','Aguardando estado da partida...'),{noNav:true});
  const own=shotSummary(b.shotsReceived||[]),enemy=shotSummary(b.shotsFired||[]);
  const myTurn=b.turnPlayerId===state.profile?.id,finished=b.status==='FINISHED';
  const canAct=myTurn&&!finished&&!b.paused;
  const fired=new Set((b.shotsFired||[]).filter(s=>!s.blocked).map(keyOf));
  const selected=state.selected && !fired.has(keyOf(state.selected)) ? state.selected:null;
  const sunk=(b.shotsFired||[]).filter(s=>s.sunkShip);
  const opponent=state.lobby?.players.find(p=>p.id!==state.profile?.id);
  const available=b.yourAbilities||[];
  const usable=available.some(a=>a.usesRemaining>0&&!a.locked);
  const activeAbility=available.find(a=>a.id===state.skillMode);
  const skillCount=skillLimit(state.skillMode);
  const radarResult=b.yourRadarReports?.at(-1);
  const skillControls=state.skillMode && activeAbility
    ? `<div class="zip-power-guide" role="status"><div class="zip-power-guide-copy"><b>${esc(activeAbility.name)}</b><small>${esc(activeAbility.description)} · ${skillCount===0?'Sem alvo necessário':skillTargetSummary()}</small></div>
       ${abilityNeedsDirection(activeAbility.id)?`<button type="button" class="zip-power-direction" data-action="cycle-ability-direction" title="Girar a prévia da habilidade" aria-label="Girar prévia: ${esc(directionText(activeAbility.id,state.skillDirection))}">↻ ${esc(directionText(activeAbility.id,state.skillDirection))}</button>`:''}</div>`
    : '';
  const reconnectDeadline=Object.values(b.reconnectDeadlines||{})[0]||'';
  const pausedOverlay=b.paused
    ? `<div class="bn-gdd-paused" role="status" aria-live="polite"><b>Aguardando reconexão...</b><small>A partida e o turno estão pausados.</small><small>Limite para reconectar: <strong data-deadline-at="${esc(reconnectDeadline)}">—</strong></small></div>`
    : '';
  const clockStrip=finished?''
    : `<span class="bn-match-clock-strip"><span class="bn-clock-turn"><small>Tempo do turno</small><b data-deadline-at="${esc(b.turnDeadlineAt||'')}" data-clock-paused="${Boolean(b.paused)}">—</b></span><span class="bn-clock-match"><small>Partida</small><b data-deadline-at="${esc(b.matchDeadlineAt||'')}" data-clock-paused="${Boolean(b.paused)}">—</b></span></span>`;
  const radarInfo=radarResult ? `<p class='tp-radar-result'>Último radar em ${coordLabel(radarResult)}: ${esc(radarResult.contacts)} contato(s) no setor 3×3.</p>` : '';
  const activeEffects=(b.yourActiveEffects||[]).length
    ? `<div class='tp-active-effects' aria-live='polite'>${b.yourActiveEffects.map(effect=>`<span class='tp-active-effect'>${esc(effect.label)} · ${effect.actionsRemaining} ação(ões) restante(s)</span>`).join('')}</div>`
    : '';
  return renderZipBattle({
    battle:b, mode, opponent, own, enemy, myTurn, finished, canAct, selected,
    skillTargets:state.skillTargets, skillArea:state.skillArea,
    available, sunk, activeAbility, skillControls, activeEffects, radarInfo,
    clockStrip, pausedOverlay, tauntControls:tauntControls(state.store?.items),
    skin:equippedId(state.store?.items,'SKIN','skin_default'),captain:equippedId(state.store?.items,'CAPTAIN','captain_default'),moods:captainMoodTracker.update(b),
  }) + skillDialogMarkup();
}
function resultScreen() {
  const battle=state.battle;
  if(!battle)return mainContent(panel('Resultado','Aguardando dados da partida.'),{noNav:true});
  const celebrate=!celebratedMatches.has(battle.matchId);
  if(celebrate)celebratedMatches.add(battle.matchId);
  return renderFigmaResult({battle,profile:state.profile,lobby:state.lobby,
    reward:rewardReceipts.get(battle.matchId),celebrate});
}

function fleetCategory(){
  const category=new URLSearchParams(location.hash.split('?')[1]||'').get('equipment');
  return equipmentCategory(category)?category:null;
}
function fleetScreen(){
  const mode=activeMode()||state.modes[0];
  const category=fleetCategory();
  const options={catalog:state.store,mode,loading:state.storeLoading||state.busy};
  return mainContent(category?renderEquipmentSelection(category,options):renderFleetEquipment(options),{active:'fleet',variant:'bn-equipment-screen'});
}
function storeScreen(){
  return mainContent(renderCosmeticStore(state.store,{loading:state.storeLoading||state.busy,filter:state.storeFilter}),{active:'store'});
}
async function loadStore({quiet=false}={}){
  if(!api.isAuthenticated() || state.storeLoading) return;
  state.storeLoading=true;
  const generation=++storeLoadGeneration;
  const userId=state.profile?.id;
  if(['store','fleet'].includes(currentRoute())) render();
  try {
    const snapshot=await api.get('/store');
    if(generation!==storeLoadGeneration||!api.isAuthenticated()||state.profile?.id!==userId)return;
    state.store=snapshot;
    configureAudio(audioRoute||currentRoute());
    document.body.dataset.shipSkin=state.store?.items?.find(item=>item.category==='SKIN' && item.equipped)?.id || 'skin_default';
  } catch(error) {
    if(generation===storeLoadGeneration&&!quiet) notice(error?.message || 'Catálogo temporariamente indisponível.',true);
  } finally {
    if(generation===storeLoadGeneration){
      state.storeLoading=false;
      if(['store','lobby','match','placement','profile','fleet'].includes(currentRoute())) render();
    }
  }
}
function profileScreen(){
  return renderFigmaProfile(state.profile,{title:selectedExpression(state.store?.items,'TITLE'),frame:selectedExpression(state.store?.items,'FRAME'),captain:equippedId(state.store?.items,'CAPTAIN','captain_default')});
}
function settingsScreen(){
  return renderFigmaSettings(state.profile,state.preferences);
}
function adminScreen(){
  if(state.profile?.admin!==true)
    return mainContent(panel('Acesso restrito','Somente administradores podem acessar esta área.'),{noNav:true});
  return mainContent(renderAdminPanel({modes:state.adminModes,loading:state.adminLoading||state.busy,error:state.adminError,tab:state.adminTab,products:state.adminProducts,storeLoading:state.adminStoreLoading||state.busy,storeError:state.adminStoreError}),{noNav:true});
}
async function loadAdminModes(){
  if(!api.isAuthenticated()||state.profile?.admin!==true||state.adminLoading)return;
  state.adminLoading=true;state.adminError='';
  if(currentRoute()==='admin')render();
  const userId=state.profile?.id;
  try{
    const modes=await api.get('/admin/game-modes');
    if(!api.isAuthenticated()||state.profile?.id!==userId)return;
    state.adminModes=modes;
  }catch(error){
    if(state.profile?.id!==userId)return;
    state.adminError=error instanceof api.ApiError&&error.status===403
      ? 'Acesso negado pela API. Sua conta não possui autorização administrativa.'
      : error?.message||'Não foi possível consultar os modos.';
  }finally{
    if(state.profile?.id===userId){
      state.adminLoading=false;
      if(currentRoute()==='admin')render();
    }
  }
}

async function loadAdminStore(){
  if(!api.isAuthenticated()||state.profile?.admin!==true||state.adminStoreLoading)return;
  state.adminStoreLoading=true;state.adminStoreError='';
  const userId=state.profile.id;
  if(currentRoute()==='admin')render();
  try{
    const items=await api.get('/admin/store/items');
    if(api.isAuthenticated()&&state.profile?.id===userId)state.adminProducts=items;
  }catch(error){
    if(state.profile?.id===userId){
      state.adminProducts=null;
      state.adminStoreError=error?.message||'Não foi possível consultar os produtos.';
    }
  }finally{
    if(state.profile?.id===userId){
      state.adminStoreLoading=false;
      if(currentRoute()==='admin')render();
    }
  }
}

function roomExitDialog() {
  if (!state.roomExitNotice) return "";
  const hostLeft=state.roomExitNotice.type==='host-left';
  const eyebrow=hostLeft?'Sala encerrada':'Sala disponível';
  const heading=hostLeft?'O anfitrião encerrou a sala':'O convidado deixou a sala';
  const description=hostLeft
    ? 'O anfitrião saiu. Esta sala foi encerrada e você voltará à tela inicial.'
    : 'Você continua como anfitrião. A sala e o código de convite permanecem ativos para receber outro jogador.';
  const button=hostLeft?'Voltar ao início':'Continuar aguardando';
  return `<dialog id="tp-room-exit-dialog" class="tp-room-exit-dialog" aria-labelledby="tp-room-exit-title" aria-describedby="tp-room-exit-description"><div class="tp-room-exit-symbol" aria-hidden="true">⚓</div><div class="eyebrow">${eyebrow}</div><h2 id="tp-room-exit-title">${heading}</h2><p id="tp-room-exit-description">${description}</p><button type="button" class="btn btn-primary" data-action="ack-room-exit">${button}</button></dialog>`;
}
function render(){ if (!root) return;
  let route=currentRoute();
  if (!api.isAuthenticated() && !['auth','register'].includes(route)) { if (location.hash!=='#auth') {location.hash='auth';return;} route='auth'; }
  if (api.isAuthenticated() && ['auth','register'].includes(route)) {
    // Replace the history entry: Back must not expose the login screen to an active session.
    route=resolvedRoute(route,true,state.lobby?.status);
    history.replaceState(null,'',`${location.pathname}${location.search}#${route}`);
  }
  if(route!=='match'||state.battle?.status==='FINISHED'){state.skillMode=null;clearSkillTargeting();state.skillDialog=false;}
  if(route==='admin'&&state.profile?.admin!==true&&api.isAuthenticated()){
    history.replaceState(null,'',`${location.pathname}${location.search}#lobby`);
    route='lobby';
  }
  if(!['lobby','store'].includes(route)||renderedRoute&&renderedRoute!==route)state.walletDialog=null;
  const pages={auth:()=>authForm(false),register:()=>authForm(true),lobby:lobbyScreen,matchmaking:waitingScreen,placement:placementScreen,match:battleScreen,result:resultScreen,fleet:fleetScreen,store:storeScreen,profile:profileScreen,settings:settingsScreen,admin:adminScreen};
  const categoryScroll=route==='store'?root.querySelector('.bn-store-categories')?.scrollLeft:0;
  root.innerHTML='<div id="tp-notice-root" aria-live="polite"></div>'+(pages[route]||pages.lobby)()+roomExitDialog()+(state.walletDialog?walletDialogMarkup(state.store,{currency:state.walletDialog,loading:state.busy||state.storeLoading,notice:state.notice,error:state.error}):'');
  if(categoryScroll){const categories=root.querySelector('.bn-store-categories');if(categories)categories.scrollLeft=categoryScroll;}
  if(state.walletDialog){
    const dialog=root.querySelector('#bn-wallet-dialog');
    // Native dialog cancel does not bubble; attach directly to each rendered dialog.
    dialog?.addEventListener('cancel',event=>{
      event.preventDefault();
      const currency=state.walletDialog;
      state.walletDialog=null;state.notice='';state.error=false;
      dialog.close();
      render();
      root.querySelector('.bn-wallet-add[data-item-id="'+(currency==='free'?'free':'premium')+'"]')?.focus();
    });
    dialog?.showModal();
  }
  mountChaosToast();
  if(route==='match'){
    const dialog=root.querySelector('#tp-skill-dialog');
    if(state.skillDialog&&dialog&&!dialog.open)dialog.showModal();
  }
  renderedRoute=route;
  updateNotice();
  if (state.busy) root.classList.add('tp-loading'); else root.classList.remove('tp-loading');
  document.body.dataset.route=route;
  document.body.dataset.boardTheme=selectedExpression(state.store?.items,'BOARD_THEME')==='board_abyss'?'abyss':'default';
  syncAudio(route);
  document.body.dataset.shipSkin=state.store?.items?.find(item=>item.category==='SKIN' && item.equipped)?.id || 'skin_default';
  if(route==='profile'&&state.profileEditorOpen){
    const profileDialog=root.querySelector('#bn-profile-editor');
    if(profileDialog && !profileDialog.open)profileDialog.showModal();
    if(state.profileSecurityOpen){
      const security=profileDialog?.querySelector('.bn-profile-security');
      if(security)security.open=true;
    }
  }
  const exitDialog=root.querySelector('#tp-room-exit-dialog');
  if (exitDialog && !exitDialog.open) exitDialog.showModal();
}

async function joinFromModal(form, code) {
  if (state.busy) return;
  const input=form.querySelector('input[name="code"]');
  const submit=form.querySelector('button[type="submit"]');
  const feedback=form.querySelector('.tp-modal-feedback');
  if (feedback) feedback.textContent='';
  if (submit) submit.disabled=true;
  state.busy=true;
  try {
    state.lobby=await api.post('/matchmaking/lobbies/join',{code:code.trim().toUpperCase()});
    state.queue=null;
    root.querySelector('#tp-join-dialog')?.close();
    go('matchmaking');
  } catch(error) {
    if (error instanceof api.ApiError && error.status===401) {
      api.clearSession();reset();go('auth');
    } else {
      const alert=form.querySelector('.tp-modal-feedback');
      if (alert) alert.textContent=error?.message||'Não foi possível entrar nesta sala.';
      input?.focus();
    }
  } finally {state.busy=false;if (submit?.isConnected) submit.disabled=false;}
}

async function handleForm(form) {
  const values=Object.fromEntries(new FormData(form).entries());
  switch(form.dataset.form) {
    case 'login': await guard(async()=>{await api.login(values.email.trim(),values.password);await sessionInit();go('lobby');});break;
    case 'register':
      if (values.password!==values.repeat) return notice('As senhas digitadas são diferentes.',true);
      await guard(async()=>{await api.register(values.nickname.trim(),values.email.trim(),values.password);await api.login(values.email.trim(),values.password);await sessionInit();go('lobby');});break;
    case 'join':await joinFromModal(form,values.code);break;
    case 'profile':await guard(async()=>{state.profile=await api.patch('/users/me',{nickname:values.nickname.trim(),avatarId:values.avatarId});state.profileEditorOpen=false;state.profileSecurityOpen=false;notice('Perfil atualizado com sucesso.');});break;
    case 'password':state.profileSecurityOpen=true;await guard(async()=>{await api.post('/auth/change-password',{currentPassword:values.currentPassword,newPassword:values.newPassword});state.profileSecurityOpen=false;notice('Senha atualizada. Sua sessão permanece ativa.');});break;
  }
}

async function runAction(action,itemId=null) {
  switch(action) {
    case 'open-wallet':
      if(!['lobby','store'].includes(currentRoute()))break;
      state.walletDialog=itemId==='free'?'free':'premium';state.notice='';state.error=false;render();
      if(!state.store)void loadStore();
      break;
    case 'wallet-currency':
      if(state.walletDialog&&['free','premium'].includes(itemId)){state.walletDialog=itemId;render();}
      break;
    case 'close-wallet': {
      const currency=state.walletDialog;state.walletDialog=null;state.notice='';state.error=false;render();
      root.querySelector('.bn-wallet-add[data-item-id="'+(currency==='free'?'free':'premium')+'"]')?.focus();break;
    }
    case 'fleet-select':
      if(currentRoute()==='fleet'&&equipmentCategory(itemId)){state.notice='';state.error=false;location.hash='fleet?equipment='+encodeURIComponent(itemId);}
      break;
    case 'fleet-back':
      if(currentRoute()==='fleet'){state.notice='';state.error=false;go('fleet');}
      break;
    case 'fleet-reload':
      if(currentRoute()==='fleet')void loadStore();
      break;
    case 'fleet-equip': {
      const category=fleetCategory();
      if(currentRoute()!=='fleet'||!category||!ownedEquipment(state.store,category).some(item=>item.id===itemId&&!item.equipped))break;
      await guard(async()=>{
        state.store=await api.put('/store/equip/'+encodeURIComponent(itemId));
        configureAudio(audioRoute||currentRoute());
      });
      break;
    }
    case 'store-category':
      if(currentRoute()==='store'&&['ALL','SKIN','SOUND','TAUNT','CAPTAIN','BUNDLE','COSMETICS'].includes(itemId)){state.storeFilter=itemId;render();root.querySelector('.bn-store-category[data-item-id="'+itemId+'"]')?.focus({preventScroll:true});}
      break;
    case 'admin-tab':
      if(currentRoute()==='admin'&&state.profile?.admin===true&&!state.busy&&['modes','store'].includes(itemId)){
        state.adminTab=itemId;render();
        if(itemId==='store')await loadAdminStore();
        else if(state.adminModes===null)await loadAdminModes();
      }
      break;
    case 'admin-refresh':
      if(currentRoute()==='admin'&&state.profile?.admin===true&&!state.busy){
        if(state.adminTab==='store')await loadAdminStore();
        else {state.adminModes=null;await loadAdminModes();}
      }
      break;
    case 'admin-toggle-product': {
      if(currentRoute()!=='admin'||state.profile?.admin!==true||state.adminStoreLoading||state.busy||state.adminTab!=='store')break;
      const item=state.adminProducts?.find(p=>p.id===itemId);
      if(!item?.manageable)break;
      if(item.enabled&&!confirm('Desativar a venda de '+item.name+'? Quem já possui o item continuará podendo usá-lo.'))break;
      await guard(async()=>{
        const updated=await api.put('/admin/store/items/'+encodeURIComponent(itemId)+'/availability',{enabled:!item.enabled});
        state.adminProducts=(state.adminProducts||[]).map(p=>p.id===itemId?updated:p);
        await loadAdminStore(); // Also refresh the effective status of dependent bundles.
        storeLoadGeneration++;state.storeLoading=false;
        await loadStore({quiet:true});
        notice('Disponibilidade de '+item.name+' atualizada.');
      });
      break;
    }
    case 'admin-toggle-mode':
      if(currentRoute()!=='admin'||state.profile?.admin!==true||state.adminLoading)break;
      {
        const entry=state.adminModes?.find(m=>m.mode?.id===itemId);
        if(!entry)break;
        if(entry.enabled&&!confirm('Desabilitar '+entry.mode.name+' para novas salas? Partidas existentes continuarão.'))break;
        await guard(async()=>{
          const updated=await api.put('/admin/game-modes/'+encodeURIComponent(itemId)+'/availability',{enabled:!entry.enabled});
          state.adminModes=(state.adminModes||[]).map(m=>m.mode?.id===itemId?updated:m);
          notice('Disponibilidade de '+entry.mode.name+' atualizada.');
        });
      }
      break;
    case 'toggle-setting': {
      if(currentRoute()!=='settings'||!settingKeys.includes(itemId))break;
      state.preferences=savePreferences({...state.preferences,[itemId]:!state.preferences[itemId]});
      render();
      root.querySelector(`[data-action="toggle-setting"][data-item-id="${itemId}"]`)?.focus();
      // Audio preferences are applied immediately by syncAudio; vibration and notifications remain local preferences.
      break;
    }
    case 'settings-manage-account':{
      state.profileEditorOpen=true;
      state.profileSecurityOpen=false;
      go('profile');
      break;
    }
    case 'settings-language':
    case 'settings-legal': {
      if(currentRoute()!=='settings')break;
      const dialog=root.querySelector('#bn-settings-info-dialog');
      if(!dialog)break;
      const title=dialog.querySelector('#bn-settings-dialog-title');
      const description=dialog.querySelector('#bn-settings-dialog-description');
      if(action==='settings-language'){
        title.textContent='Idioma';
        description.textContent='Português (BR) é o único idioma disponível nesta versão.';
      } else if(itemId==='terms'){
        title.textContent='Termos de uso';
        description.textContent='Os termos de uso ainda não foram publicados nesta versão de testes.';
      } else if(itemId==='privacy'){
        title.textContent='Política de privacidade';
        description.textContent='A política de privacidade ainda não foi publicada nesta versão de testes.';
      }else break;
      dialog.showModal();
      dialog.querySelector('[data-action="settings-close-dialog"]')?.focus();
      break;
    }
    case 'settings-close-dialog':
      root.querySelector('#bn-settings-info-dialog')?.close();
      break;
    case 'open-profile-editor': {
      if(currentRoute()!=='profile')break;
      state.profileEditorOpen=true;
      const dialog=root.querySelector('#bn-profile-editor');
      if(dialog&&!dialog.open)dialog.showModal();
      dialog?.querySelector('#profile-name')?.focus();
      break;
    }
    case 'close-profile-editor': {
      state.profileEditorOpen=false;
      state.profileSecurityOpen=false;
      root.querySelector('#bn-profile-editor')?.close();
      break;
    }
    case 'ack-room-exit': {
      if (!state.roomExitNotice || state.busy) break;
      const hostLeft=state.roomExitNotice.type==='host-left';
      state.roomExitNotice=null;
      if (hostLeft) {
        // Backend removed the lobby and both memberships when the host left.
        state.lobby=null;state.preparation=null;state.battle=null;state.draft=null;state.selected=null;
        go('lobby');
      } else {
        // Backend already kept the host's room open and reset readiness.
        // Never DELETE the surviving room; it may receive a new guest.
        go(state.lobby ? routeForLobby(state.lobby.status) : 'lobby');
      }
      render();
      break;
    }
    case 'send-taunt':await guard(async()=>{
      const index=Number(itemId);
      if(currentRoute()!=='match'||state.battle?.status!=='PLAYING'
          ||!Number.isInteger(index)||index<0
          ||index>=(equippedTaunts(state.store?.items)?.phrases.length??0))return;
      const sent=await api.post('/matches/me/taunts',{index});
      showTauntMessage(sent);
    });break;
    case 'store-buy':await guard(async()=>{
      if(!itemId) return;
      state.store=await api.post('/store/purchase/'+encodeURIComponent(itemId));
      audio.play('purchase_success');
      notice('Item adquirido. Você pode equipá-lo no catálogo.');
    });break;
    case 'store-buy-premium':await guard(async()=>{
      if(!itemId||state.store?.demoPremiumEnabled!==true) return;
      state.store=await api.post('/store/purchase/'+encodeURIComponent(itemId)+'?premium=true');
      audio.play('purchase_success');
      notice('Item adquirido com créditos premium de demonstração.');
    });break;
    case 'store-demo-topup':{
      if(state.walletDialog!=='premium'||!['demo_100','demo_300','demo_700'].includes(itemId)||state.store?.demoPremiumEnabled!==true||state.busy)break;
      const amount=itemId.split('_')[1];
      if(!window.confirm('Simular a aquisição de '+amount+' créditos premium? Nenhum dinheiro real será cobrado.'))break;
      await guard(async()=>{
        const requestId=state.demoTopupRequests.get(itemId)||crypto.randomUUID();
        state.demoTopupRequests.set(itemId,requestId);
        state.store=await api.post('/store/demo-premium',{packId:itemId,requestId});
        state.demoTopupRequests.delete(itemId);
        notice('Compra simulada concluída. Nenhum dinheiro real foi usado.');
      });break;
    }
    case 'store-equip':await guard(async()=>{
      if(!itemId) return;
      state.store=await api.put('/store/equip/'+encodeURIComponent(itemId));
      configureAudio(audioRoute||currentRoute());
      document.body.dataset.shipSkin=state.store?.items?.find(item=>item.category==='SKIN' && item.equipped)?.id || 'skin_default';
      notice('Item equipado com sucesso.');
    });break;
    case 'dismiss':state.notice='';updateNotice();break;
    case 'open-join-modal': { const dialog=root.querySelector('#tp-join-dialog'); if (dialog && !dialog.open) { dialog.showModal(); dialog.querySelector('input[name=code]')?.focus(); } break; }
    case 'close-join-modal':root.querySelector('#tp-join-dialog')?.close();break;
    case 'logout':await guard(async()=>{await api.logout();reset();clearInterval(refreshTimer);refreshTimer=null;go('auth');});break;
    case 'find-public-match':await guard(async()=>{
      const search=await api.post('/matchmaking/queue',{modeId:state.modeId});
      state.queue=search.status==='SEARCHING'?search:null;
      state.queueStartedAt=search.status==='SEARCHING'?Date.now():null;
      state.lobby=search.status==='MATCHED'?search.room:null;
      go('matchmaking');
    });break;
    case 'cancel-public-search':await guard(async()=>{
      if(state.queue?.status!=='SEARCHING')return;
      try {await api.remove('/matchmaking/queue/me');}
      catch(error) {
        if(error instanceof api.ApiError && error.status===409){await reconcile();return;}
        throw error;
      }
      state.queue=null;state.queueStartedAt=null;go('lobby');
    });break;
    case 'create-lobby':await guard(async()=>{
      state.lobby=await api.post('/matchmaking/lobbies',{modeId:state.modeId});
      state.queue=null;go('matchmaking');
    });break;
    case 'copy-code':if(state.lobby){try{await navigator.clipboard.writeText(state.lobby.code);notice('Código copiado para a área de transferência.');}catch{notice(`Código da sala: ${state.lobby.code}`);}}break;
    case 'copy-award':{
      if(currentRoute()!=='result'||!state.battle)return;
      const award=ridiculousAward(buildMatchReport(state.battle,state.profile?.id));
      const share=`🏆 ${award.emoji} ${award.title} — ${award.description} #BatalhaNaval`;
      try {await navigator.clipboard.writeText(share);notice('Prêmio copiado para compartilhar!');}
      catch {notice(share);}
      break;
    }
    case 'ready':await guard(async()=>{const me=state.lobby?.players.find(p=>p.id===state.profile.id);state.lobby=await api.put('/matchmaking/lobbies/me/ready',{ready:!me?.ready});await reconcile();});break;
    case 'leave-lobby':{
      if (state.lobby?.status==='PLAYING' && !confirm('Sair agora significa desistir e perder a partida. Continuar?')) return;
      state.leavingRoom=true;
      try {await guard(async()=>{await api.remove('/matchmaking/lobbies/me');state.lobby=null;state.queue=null;state.battle=null;state.preparation=null;state.draft=null;go('lobby');});}
      finally {state.leavingRoom=false;}
      break;}
    case 'cancel-rematch':
    case 'play-again': {
      if(state.lobby?.status!=='FINISHED'||state.busy)break;
      if(state.lobby.rematch) {
        if(!state.lobby.rematch.available) {
          notice('O adversário saiu. Volte ao lobby para jogar novamente.',true);
          break;
        }
        await guard(async()=>{
          try {
            state.lobby=await api.put('/matchmaking/lobbies/me/rematch',{
              accepted:action==='play-again'
            });
          } catch(error) {
            if(error instanceof api.ApiError && error.status===409) {
              // The other player may have accepted/left during the request.
              await reconcile();
              return;
            }
            throw error;
          }
          // The second acceptance creates a new code and preparation instantly.
          // Otherwise retain the final score while waiting for the opponent.
          await reconcile();
        });
        break;
      }
      // Backwards compatibility with an older API that does not expose rematch.
      state.leavingRoom=true;
      try {
        await guard(async()=>{
          await api.remove('/matchmaking/lobbies/me');
          state.lobby=null;state.preparation=null;state.battle=null;state.draft=null;
          state.selected=null;state.placementShip=null;
          go('matchmaking');
        });
      } finally {state.leavingRoom=false;}
      break;
    }
    case 'random-placement':await guard(async()=>{state.preparation=await api.post('/matches/me/placement/random');state.draft=[...state.preparation.yourShips];state.placementShip=null;});break;
    case 'select-placement-ship': {
      const mode=activeMode();
      if(currentRoute()!=='placement'||state.preparation?.fleetConfirmed||!mode?.fleet.some(s=>s.id===itemId))break;
      if(mode.geometry.kind!=='RECTANGULAR')break;
      state.placementShip=itemId;
      const selectedPlacement=(state.draft??state.preparation?.yourShips??[]).find(s=>s.type===itemId);
      if(selectedPlacement && mode.placementDirections?.includes(selectedPlacement.orientation))
        state.orientation=selectedPlacement.orientation;
      render();break;
    }
    case 'rotate-placement': {
      const mode=activeMode();
      if(currentRoute()!=='placement'||state.preparation?.fleetConfirmed||mode?.geometry.kind!=='RECTANGULAR')break;
      const directions=mode.placementDirections||[];
      if(!directions.includes('HORIZONTAL')||!directions.includes('VERTICAL'))break;
      state.orientation=state.orientation==='HORIZONTAL'?'VERTICAL':'HORIZONTAL';
      render();break;
    }
    case 'save-placement':await guard(async()=>{state.preparation=await api.put('/matches/me/placement',{ships:state.draft});state.draft=[...state.preparation.yourShips];notice('Frota validada e salva pela API.');});break;
    case 'confirm-placement':await guard(async()=>{
      if (state.draft!==null && JSON.stringify(state.draft)!==JSON.stringify(state.preparation.yourShips)) state.preparation=await api.put('/matches/me/placement',{ships:state.draft});
      state.preparation=await api.post('/matches/me/placement/confirm');state.draft=[...state.preparation.yourShips];state.placementShip=null;await reconcile();
    });break;
    case 'clear-draft':if(currentRoute()==='placement'&&!state.preparation?.fleetConfirmed){state.draft=[];state.placementShip=null;state.orientation='HORIZONTAL';render();}break;
    case 'open-abilities':if((state.battle?.yourAbilities||[]).some(a=>a.usesRemaining>0&&!a.locked)){state.skillDialog=true;render();}break;
    case 'close-abilities':state.skillDialog=false;render();break;
    case 'pick-ability':{
      const available=state.battle?.yourAbilities?.find(a=>a.id===itemId&&a.usesRemaining>0&&!a.locked);
      if(!available||state.battle?.turnPlayerId!==state.profile?.id||state.battle?.paused)break;
      state.skillMode=available.id;clearSkillTargeting();state.skillDirection='RIGHT';state.skillDialog=false;state.selected=null;render();break;
    }
    case 'cancel-ability':state.skillMode=null;clearSkillTargeting();render();break;
    case 'cycle-ability-direction':{
      if(!abilityNeedsDirection(state.skillMode))break;
      const directions=state.skillMode==='line-barrage'?['RIGHT','DOWN']:ABILITY_DIRECTIONS;
      const index=directions.indexOf(state.skillDirection);
      state.skillDirection=directions[(index+1)%directions.length];
      if(state.skillAnchor){
        const anchor=state.skillAnchor;
        clearSkillTargeting();
        const plan=chooseAbilityTarget(anchor);
        if(!plan.valid)state.skillAnchor=anchor; // Keep the anchor while user rotates past invalid orientations.
      }
      render();break;
    }
    case 'activate-ability':await guard(async()=>{
      if(!state.skillMode||state.skillTargets.length!==skillLimit(state.skillMode)
          ||skillMeta(state.skillMode)?.locked||state.battle?.turnPlayerId!==state.profile?.id||state.battle?.paused)return;
      const oldReports=state.battle?.yourRadarReports?.length||0;
      const chosenName=skillMeta(state.skillMode)?.name||'Habilidade';
      state.battle=await api.post('/matches/me/abilities',{
        abilityId:state.skillMode,targets:state.skillTargets,
      });
      syncAudio(currentRoute());
      state.skillMode=null;clearSkillTargeting();state.selected=null;
      notice(`${chosenName} ativada com sucesso.`);
      const last=state.battle.yourRadarReports?.at(-1);
      if(last&&state.battle.yourRadarReports.length>oldReports)
        notice(`Radar em ${coordLabel(last)}: ${last.contacts} contato(s) no setor 3×3.`);
      await reconcile();
    });break;
    case 'desperation-shot':{
      if(state.busy||currentRoute()!=='match'||!state.battle
        ||state.skillMode||state.battle.status!=='PLAYING'
        ||state.battle.paused||state.battle.yourDesperationUsed
        ||state.battle.turnPlayerId!==state.profile?.id)return;
      if(!confirm('🎲 Aperta e Reza! O servidor escolherá um alvo aleatório. Isso gasta seu turno e só pode ser usado uma vez por partida. Continuar?'))return;
      await guard(async()=>{
        const previous=state.battle.shotsFired||[];
        state.battle=await api.post('/matches/me/shots/desperation');
        const latest=(state.battle.shotsFired||[]).find(shot=>
          !previous.some(old=>old.row===shot.row&&old.col===shot.col&&
            old.hit===shot.hit&&Boolean(old.blocked)===Boolean(shot.blocked)));
        syncAudio(currentRoute());
        state.selected=null;
        await reconcile();
        if(latest&&currentRoute()==='match')showChaosToast('🎲 Aperta e Reza acertou '+coordLabel(latest)+'!','taunt');
      });
      break;
    }
    case 'fire':await guard(async()=>{
      if(!state.selected||state.skillMode||!state.battle||state.battle.turnPlayerId!==state.profile.id||state.battle.paused)return;
      state.battle=await api.post('/matches/me/shots',state.selected);
      syncAudio(currentRoute());
      state.selected=null;await reconcile();
    });break;
    case 'forfeit':if(confirm('Confirmar desistência? O adversário receberá a vitória.'))await guard(async()=>{state.battle=await api.post('/matches/me/forfeit');await reconcile();});break;
  }
}
function selectCell(row,col,side='ENEMY'){
  const route=currentRoute(),mode=activeMode();if(!mode || state.busy) return;
  if(route==='match') {
    if(state.battle?.turnPlayerId!==state.profile?.id||state.battle?.status!=='PLAYING'||state.battle?.paused) return;
    if(state.skillMode){
      if(skillScope(state.skillMode)!==side)return;
      const plan=chooseAbilityTarget({row,col});
      if(!plan.valid){
        if(state.skillMode==='air-strike'||state.skillMode==='line-barrage'){
          clearSkillTargeting();state.skillAnchor={row,col};render();
        }
        notice(plan.reason,true);return;
      }
      render();return;
    }
    if(side!=='ENEMY')return;
    if(state.battle.shotsFired.some(s=>s.row===row&&s.col===col&&!s.blocked))return;
    state.selected={row,col};
    // Update only target readout/cells, not the whole combat HUD and its boards.
    const board=root.querySelector('.combat-screen .board-panel-primary')
      || root.querySelector('.bn-zip-battle .zip-primary-board');
    if (!board) { render(); return; }
    board.querySelectorAll('.cell.target,.tile.target').forEach(node=>{
      node.classList.remove('target');
      node.querySelector('.target-reticle')?.remove();
    });
    const key=`${row},${col}`;
    const node=[...board.querySelectorAll('[data-coord]')].find(el=>el.dataset.coord===key);
    if (node) node.classList.add('target');
    const readout=board.querySelector('.target-readout strong')
      || root.querySelector('.zip-target-indicator b');
    if(readout) readout.textContent=coordLabel(state.selected);
    const button=root.querySelector('[data-action="fire"]');
    if(button){button.disabled=false;const caption=button.querySelector('small');if(caption)caption.textContent=`Disparar em ${coordLabel(state.selected)}`;}
  } else if(route==='placement'){
    if(state.preparation?.fleetConfirmed||mode.geometry.kind!=='RECTANGULAR')return;
    const placed=[...(state.draft??state.preparation?.yourShips??[])];
    const chosen=mode.fleet.find(s=>s.id===state.placementShip)
      || mode.fleet.find(s=>!placed.some(d=>d.type===s.id));
    if(!chosen)return notice('Selecione um navio para reposicioná-lo ou confirme a frota.',false);
    // Replacing a selected ship is atomic in the draft: invalid destinations
    // must leave the existing coordinates and all other ships intact.
    const candidate={type:chosen.id,row,col,orientation:state.orientation};
    const proposed=[...placed.filter(s=>s.type!==chosen.id),candidate];
    const occupied=occupiedCells(proposed,mode);
    const valid=new Set(mode.geometry.cells.map(keyOf));
    const total=proposed.reduce((sum,s)=>sum+(mode.fleet.find(d=>d.id===s.type)?.length||0),0);
    if(occupied.size!==total||[...occupied].some(key=>!valid.has(key)))return notice('Posição inválida ou sobreposta. Escolha outra célula.',true);
    state.draft=proposed;
    audio.play('ship_placement');
    state.placementShip=mode.fleet.find(s=>!proposed.some(d=>d.type===s.id))?.id||chosen.id;
    state.notice='';render();
  }
}
function bindEvents() {
  // Browser policy: only a real gesture may resume the audio context.
  const unlock=event=>{if(event.isTrusted)void audio.unlock();};
  root.addEventListener('pointerdown',unlock,true);
  root.addEventListener('keydown',unlock,true);
  document.addEventListener('visibilitychange',()=>audio.setVisible(!document.hidden));
  audio.setVisible(!document.hidden);
  // Image failures must not display an oversized alt string inside the portrait.
  root.addEventListener('error',event=>{
    const image=event.target;
    if(!image?.matches?.('.bn-gd-profile-captain'))return;
    if(image.dataset.fallback&&image.getAttribute('src')!==image.dataset.fallback){
      image.setAttribute('src',image.dataset.fallback);
      return;
    }
    image.hidden=true;
    const fallback=image.parentElement?.querySelector('.bn-profile-initial');
    if(fallback)fallback.hidden=false;
  },true);
  root.addEventListener('cancel', event=>{
    if (event.target?.id==='tp-room-exit-dialog') event.preventDefault();
    if (event.target?.id==='tp-skill-dialog') state.skillDialog=false;
    if (event.target?.id==='bn-profile-editor'){state.profileEditorOpen=false;state.profileSecurityOpen=false;}
  });
  root.addEventListener('close', event=>{if(event.target?.id==='bn-profile-editor'){state.profileEditorOpen=false;state.profileSecurityOpen=false;}},true);
  root.addEventListener('submit', event=>{
    const form=event.target.closest('form[data-form]');if(!form)return;
    event.preventDefault(); void handleForm(form);
  });
  root.addEventListener('click',event=>{
    const target=event.target.closest('[data-coord]');
    if(target){const [row,col]=target.dataset.coord.split(',').map(Number);selectCell(row,col,target.closest('.zip-own-board,.combat-left-rail')?'OWN':'ENEMY');return;}
    const action=event.target.closest('[data-action]');if(action){if(!action.disabled&&!['fire','activate-ability','toggle-setting'].includes(action.dataset.action))audio.play('ui_click');void runAction(action.dataset.action,action.dataset.abilityId||action.dataset.itemId);return;}
    const link=event.target.closest('[data-go]');if(link){audio.play('ui_click');go(link.dataset.go);}
  });
  root.addEventListener('pointerover',event=>{
    if(state.skillMode&&currentRoute()==='match'){
      const cell=event.target.closest('[data-coord]');
      if(cell)paintAbilityPreview(cell);
    }
  });
  root.addEventListener('pointerout',event=>{
    if(!state.skillMode||currentRoute()!=='match')return;
    const cell=event.target.closest('[data-coord]');
    if(cell&&cell!==event.relatedTarget?.closest?.('[data-coord]'))paintAbilityPreview(null);
  });
  root.addEventListener('focusin',event=>{
    if(state.skillMode&&currentRoute()==='match'&&event.target.matches('[data-coord]'))paintAbilityPreview(event.target);
  });
  root.addEventListener('focusout',event=>{
    if(state.skillMode&&currentRoute()==='match'&&event.target.matches('[data-coord]'))paintAbilityPreview(null);
  });
  root.addEventListener('keydown',event=>{
    if((event.key==='Enter'||event.key===' ')&&event.target.matches('g[data-coord]')) {
      event.preventDefault();const [r,c]=event.target.dataset.coord.split(',').map(Number);selectCell(r,c,event.target.closest('.zip-own-board,.combat-left-rail')?'OWN':'ENEMY');
    }
  });
  root.addEventListener('change',event=>{
    if(event.target.id==='mode-picker')state.modeId=event.target.value;
    if(event.target.id==='orientation')state.orientation=event.target.value;
    if(event.target.matches('.bn-profile-security'))state.profileSecurityOpen=event.target.open;
  });
  window.addEventListener('hashchange',()=>{
    if(state.lobby&&['lobby','matchmaking','placement','match','result'].includes(currentRoute()))synchronizeRoute();
    if(currentRoute()!=='profile'){state.profileEditorOpen=false;state.profileSecurityOpen=false;}
    render();
    if((currentRoute()==='store'||(currentRoute()==='fleet'&&!state.store))&&!state.storeLoading) void loadStore({quiet:true});
    if(currentRoute()==='admin'&&state.profile?.admin===true){if(state.adminTab==='store')void loadAdminStore();else if(state.adminModes===null&&!state.adminLoading)void loadAdminModes();}
  });
}
export function startTidepoint(element) {
  root=element; bindEvents();render();
  if(clockHudTimer)clearInterval(clockHudTimer);
  clockHudTimer=setInterval(()=>{updateClockNodes(root);updateSearchElapsed();},250);
  // Tokens are memory-only by design; a reload requires a new login.
}
