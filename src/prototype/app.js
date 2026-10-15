import * as api from './client.js';
import { esc, renderBoard, keyOf, coordLabel, occupiedCells, shipName } from './board.js';
import { roomDeparture, resolvedRoute } from './room-flow.js';

const logo = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 18h20l-3-6H5l-3 6zM8 12V8h4v4M12 6V4"/></svg>`;
const brand = () => `<div class="brand"><div class="brand-mark">${logo}</div><div><div class="brand-name">TIDEPOINT</div><div class="brand-sub">Estratégia • Navios • Vitória</div></div></div>`;
const state = {
  profile: null, modes: [], lobby: null, preparation: null, battle: null,
  modeId: 'classic', selected: null, draft: null, orientation: 'HORIZONTAL',
  notice: '', error: false, busy: false, socketOnline: false, initialized: false,
  roomExitNotice: null, leavingRoom: false,
};
let root;
let refreshTimer;
let loading=false;
let renderedRoute='';
function updateNotice() {
  const node=root?.querySelector?.('#tp-notice-root');
  if (node) node.innerHTML=alertNode();
}
function updateConnectionIndicator() {
  const badge=root?.querySelector('[data-socket-status]');
  if (badge) badge.innerHTML=`<i class="tp-live-dot ${state.socketOnline?'online':''}"></i>${state.socketOnline?'Conectado':'Reconectando'}`;
}


function notice(message, error=false) { state.notice=message; state.error=error; updateNotice(); }
function activeMode() { return state.battle?.mode || state.preparation?.mode || state.lobby?.mode || state.modes.find(m=>m.id===state.modeId) || null; }
function currentRoute() { return decodeURIComponent(location.hash.slice(1).split('?')[0] || 'auth'); }
function go(route) {
  route = resolvedRoute(route, api.isAuthenticated(), state.lobby?.status);
  if (currentRoute()===route) render(); else location.hash=route;
}
function nav(active='play') { return `<nav class="bottom-nav"><button class="nav-btn ${active==='fleet'?'active':''}" data-go="fleet">⚓ Frota</button><button class="nav-btn play ${active==='play'?'active':''}" data-go="lobby">⌁ Jogar</button><button class="nav-btn ${active==='store'?'active':''}" data-go="store">◈ Arsenal</button></nav>`; }
function header() { const player=state.profile; return `<header class="topbar">${brand()}<div class="currencies"><span class="pill">● TidePoint V1</span><span class="pill" data-socket-status><i class="tp-live-dot ${state.socketOnline?'online':''}"></i>${state.socketOnline?'Conectado':'Reconectando'}</span></div><div class="player-strip"><div class="avatar" aria-hidden="true">⚓</div><div class="name"><b>${esc(player?.nickname || 'Capitão')}</b><div style="font-size:10px;color:var(--muted)">Conta de jogador</div></div><div class="tp-top-actions"><button data-go="profile">Perfil</button><button data-action="logout">Sair</button><a href="/admin" class="tp-small" style="color:var(--cyan)">Admin</a></div><details class="tp-account-menu"><summary aria-label="Abrir menu da conta" title="Menu da conta"><span aria-hidden="true">☰</span></summary><div class="tp-account-popover"><button type="button" data-go="profile">Meu perfil</button><button type="button" data-action="logout">Sair</button><a href="/admin">Administração</a></div></details></div></header>`; }
function screen(content,{active='play',noNav=false}={}) { return `<div class="screen"><div class="shell">${header()}<main class="main">${content}</main>${noNav?'':nav(active)}</div></div>`; }
function panel(title,body,cls='') { return `<section class="panel tp-panel ${cls}"><div class="eyebrow">Comando naval</div><h2 class="panel-title" style="margin:8px 0 16px">${title}</h2>${body}</section>`; }
function mainContent(inner,{active='play',noNav=false}={}) {return screen(`<div class="tp-content">${inner}</div>`,{active,noNav});}
function alertNode() { return state.notice ? `<div class="tp-notice ${state.error?'error':''}" role="alert">${esc(state.notice)} <button type="button" data-action="dismiss" style="float:right;background:transparent;color:inherit;border:0;cursor:pointer">×</button></div>` : ''; }
function routeForLobby(status) {return status==='WAITING'?'matchmaking':status==='PREPARING'?'placement':status==='PLAYING'?'match':status==='FINISHED'?'result':'lobby';}
function synchronizeRoute() {
  // Keep the departure dialog open until acknowledged, including after a room closes.
  if (state.roomExitNotice) { if (!state.lobby && currentRoute()!=='lobby') go('lobby'); return; }
  if (!state.lobby) { if (['placement','match','result'].includes(currentRoute())) go('lobby'); return; }
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
function reset(){state.profile=null;state.modes=[];state.lobby=null;state.preparation=null;state.battle=null;state.draft=null;state.selected=null;state.socketOnline=false;state.roomExitNotice=null;state.leavingRoom=false;}
async function sessionInit() {
  state.profile=await api.get('/users/me');
  state.modes=await api.get('/game-modes');
  if (!state.modes.some(m=>m.id===state.modeId)) state.modeId=state.modes[0]?.id||'';
  await reconcile();
  await api.connectRealtime((message)=>{
    if (['LOBBY_UPDATED','LOBBY_CLOSED','LOBBY_LEFT','PREPARATION_UPDATED','BATTLE_UPDATED'].includes(message.type)) {
      // REST always recovers an authoritative personalized snapshot, including after reconnection.
      void reconcile();
    }
  }, online => {
    state.socketOnline=online; updateConnectionIndicator();
    if(online) void reconcile();
  });
  if (!refreshTimer) refreshTimer=setInterval(()=>{
    if (api.isAuthenticated() && state.lobby) void reconcile();
  }, 7000);
}
async function reconcile() {
  if (!api.isAuthenticated() || loading) return;
  loading=true;
  try {
    let room;
    try { room=await api.get('/matchmaking/lobbies/me'); }
    catch(e) { if (e instanceof api.ApiError && e.status===404) room=null; else throw e; }
    if (!api.isAuthenticated()) return;
    if (room && state.lobby?.code===room.code && room.revision < state.lobby.revision) return;
    const previousRoom=state.lobby;
    const previous=previousRoom?.status;
    let changed=JSON.stringify(previousRoom)!==JSON.stringify(room);
    if (!state.leavingRoom && !state.roomExitNotice) {
      const departure = roomDeparture(previousRoom, room, state.profile?.id);
      if (departure) {
        state.roomExitNotice={type:departure};
        changed=true;
      }
    }
    state.lobby=room;
    if (!room) {
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
        if (previous!=='PREPARING') state.draft=null;
      }
    } else if (['PLAYING','FINISHED'].includes(room.status)) {
      if (state.preparation) changed=true;
      state.preparation=null;
      const battle=await api.get('/matches/me');
      if (!state.battle || state.battle.matchId!==battle.matchId || battle.revision>=state.battle.revision) {
        changed ||= JSON.stringify(state.battle)!==JSON.stringify(battle);
        state.battle=battle;
      }
    } else {
      if (state.preparation || state.battle) changed=true;
      state.preparation=null;state.battle=null;
    }
    synchronizeRoute();
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
  const inputs=isRegister ? `<div class="field"><label for="nick">Nickname</label><input id="nick" name="nickname" autocomplete="nickname" minlength="3" maxlength="30" required /></div>`:'';
  return `<div class="screen"><div class="auth-wrap"><section class="auth-art"><div>${brand()}</div><div class="auth-quote"><div class="eyebrow">${isRegister?'Novo recruta':'Comando Naval Online'}</div><h1>${isRegister?'Seu nome.<br>Sua frota.<br><em>Seu oceano.</em>':'Leia o mar.<br><em>Antecipe.</em><br>Afunde.'}</h1><p>Partidas navais de estratégia 1v1. Uma conta, sua frota e decisões reais no campo de batalha.</p></div><div class="eyebrow">TIDEPOINT • Batalha Naval</div></section><section class="auth-form-wrap"><div class="panel auth-card"><div class="eyebrow">${isRegister?'Cadastro':'Acesso ao convés'}</div><h2 class="form-title">${isRegister?'Criar conta':'Entrar no comando'}</h2><p class="form-sub">${isRegister?'Crie um perfil para começar.':'Entre com seu e-mail e senha.'}</p><form class="tp-form" data-form="${isRegister?'register':'login'}">${inputs}<div class="field"><label for="email">E-mail</label><input id="email" name="email" type="email" autocomplete="email" required maxlength="254" /></div><div class="field"><label for="password">Senha</label><input id="password" name="password" type="password" autocomplete="${isRegister?'new-password':'current-password'}" minlength="8" maxlength="72" required /></div>${isRegister?'<div class="field"><label for="repeat">Confirmar senha</label><input id="repeat" name="repeat" type="password" autocomplete="new-password" required /></div>':''}<button type="submit" class="btn btn-primary btn-wide">${isRegister?'Cadastrar e entrar':'Entrar'}</button></form><div class="tp-actions" style="margin-top:15px"><button class="btn btn-ghost" data-go="${isRegister?'auth':'register'}">${isRegister?'Já tenho conta':'Criar conta'}</button></div><p class="tp-small tp-muted" style="margin-top:12px">Recuperação de senha por e-mail ainda não está disponível.</p></div></section></div></div>`;
}

function lobbyScreen() {
  if (state.lobby) return waitingScreen();
  return screen(`<div class="hero-grid home-grid"><section class="panel hero-card home-hero"><div class="home-hero-grid"><div class="hero-copy home-copy"><h1 class="hero-title">Domine a<br><span>linha d'água.</span></h1><div class="tp-lobby-intro"><span class="tp-lobby-sign">⚓ PONTO DE PARTIDA</span><span class="tp-lobby-sign-line" aria-hidden="true"></span></div><div class="hero-actions tp-lobby-actions" aria-label="Escolha sua próxima ação"><button class="btn btn-orange home-primary-action tp-launch-card" type="button" data-go="matchmaking" ${state.modes.length?'':'disabled'}><span class="home-btn-icon">◎</span><span class="tp-action-copy"><b>Criar sala</b><small>Escolha o cenário e convoque um capitão</small></span><span class="tp-action-chevron" aria-hidden="true">↗</span></button><button class="btn btn-ghost home-ranked-action tp-join-card" type="button" data-action="open-join-modal"><span class="home-btn-icon">⌁</span><span class="tp-action-copy"><b>Entrar na sala</b><small>Recebeu um convite? Embarque aqui</small></span><span class="tp-action-chevron" aria-hidden="true">→</span></button></div><div class="tp-lobby-dock" aria-label="Características das partidas"><span><i aria-hidden="true">◈</i> Duelo 1×1</span><span><i aria-hidden="true">◎</i> Estratégia por turnos</span></div></div><div class="home-ocean-art" aria-hidden="true"><div class="home-radar-disc"><i class="home-radar-ring ring-a"></i><i class="home-radar-ring ring-b"></i><i class="home-radar-axis axis-x"></i><i class="home-radar-axis axis-y"></i><i class="home-radar-sweep"></i><span class="home-radar-contact contact-a"></span><span class="home-radar-contact contact-b"></span><span class="home-radar-contact contact-c"></span></div><div class="home-ship-silhouette"><i class="home-ship-hull"></i><i class="home-ship-deck"></i><i class="home-ship-tower"></i><i class="home-ship-gun"></i></div><div class="home-art-label"><span>Seu próximo desafio</span><b>1 × 1</b></div></div></div></section><aside class="panel mission-card home-missions"><div class="home-mission-head"><div><div class="eyebrow">Diário de bordo</div><div class="panel-title">Informações da conta</div></div></div><div class="mission-list home-mission-list"><div class="mission"><div class="tp-mission-info"><small>Capitão</small><b>${esc(state.profile?.nickname)}</b></div></div><div class="mission"><div class="tp-mission-info"><small>Modos habilitados</small><b>${state.modes.length}</b></div></div><div class="mission"><div class="tp-mission-info"><small>Multiplayer</small><b>Sala privada para dois</b></div></div></div><div class="home-event-card"><div class="home-event-copy"><div class="eyebrow">Em breve</div><b>Missões, ranking e skins</b><small>A API ainda não oferece esses recursos.</small></div></div></aside></div><dialog id="tp-join-dialog" class="tp-join-dialog" aria-labelledby="tp-join-title"><div class="tp-modal-header"><div><div class="eyebrow">Convite de partida</div><h2 id="tp-join-title">Entrar em uma sala</h2></div><button type="button" data-action="close-join-modal" aria-label="Fechar janela">×</button></div><form data-form="join" class="tp-form"><div class="field"><label for="room-code">Código de seis caracteres</label><input id="room-code" name="code" placeholder="ABC234" maxlength="6" minlength="6" pattern="[a-zA-Z0-9]{6}" autocomplete="off" required style="text-transform:uppercase" /></div><p class="tp-modal-feedback" role="alert" aria-live="polite"></p><div class="tp-modal-actions"><button class="btn btn-ghost" type="button" data-action="close-join-modal">Cancelar</button><button class="btn btn-primary" type="submit">Entrar na sala</button></div></form></dialog>`);
}

function waitingScreen() {
  const room=state.lobby;
  if (!room) {
    const options=state.modes.map(mode=>`<option value="${esc(mode.id)}" ${state.modeId===mode.id?'selected':''}>${esc(mode.name)} · ${mode.geometry?.cells?.length||0} casas</option>`).join('');
    return mainContent(`<div class="matchmaking-wrap tp-create-room-wrap"><section class="panel mm-card tp-create-room-card"><div class="eyebrow">Canal de combate</div><h2 class="form-title">Criar sala privada</h2><p class="form-sub">Escolha o modo de jogo antes de criar sua sala. Depois você receberá um código para convidar outro jogador.</p><div class="tp-create-mode"><label class="eyebrow" for="mode-picker">Modo de jogo</label><select class="tp-mode-select" id="mode-picker" ${options?'':'disabled'}>${options||'<option>Sem modos habilitados</option>'}</select></div><div class="tp-actions tp-create-actions"><button type="button" class="btn btn-ghost" data-go="lobby">← Voltar</button><button type="button" class="btn btn-orange" data-action="create-lobby" ${options?'':'disabled'}>Criar sala</button></div></section></div>`,{noNav:true});
  }
  const me=room.players.find(p=>p.id===state.profile?.id);
  const other=room.players.find(p=>p.id!==state.profile?.id);
  const players=room.players.map(p=>`<div><span><span class="tp-live-dot ${p.connected?'online':''}"></span> ${esc(p.nickname)} ${p.id===state.profile?.id?'(você)':''}</span><span class="tp-tag">${p.ready?'Pronto':'Aguardando'} · ${p.connected?'Online':'Offline'}</span></div>`).join('');
  return mainContent(`<div class="matchmaking-wrap"><section class="panel mm-card" style="max-width:760px;width:100%"><div class="eyebrow">Canal de combate • ${esc(room.mode?.name||'Modo clássico')}</div><h2 class="form-title">Sala privada</h2><p class="form-sub">Compartilhe o código abaixo com outro jogador. Ambos precisam marcar prontidão.</p><button type="button" data-action="copy-code" class="btn btn-primary" style="font-size:22px;letter-spacing:5px" aria-label="Copiar código da sala">${esc(room.code)} ⧉</button><div class="radar" aria-hidden="true" style="margin:12px auto"><span class="radar-contact radar-contact-one"></span><span class="radar-contact radar-contact-two"></span><span class="radar-contact radar-contact-three"></span></div><div class="tp-list">${players}</div><p class="tp-muted tp-small">${other?'Aguarde ambos confirmarem prontidão.':'Aguardando o segundo jogador entrar pelo código.'}</p><div class="tp-actions" style="justify-content:center;margin-top:16px"><button class="btn ${me?.ready?'btn-ghost':'btn-orange'}" data-action="ready" ${other?'':'disabled'}>${me?.ready?'Cancelar prontidão':'Estou pronto'}</button><button class="btn btn-danger" data-action="leave-lobby">Sair da sala</button></div></section></div>`,{noNav:true});
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
  const ships=state.draft??(p.yourShips||[]);
  const editable=!p.fleetConfirmed;
  const canManual=editable && mode.geometry.kind==='RECTANGULAR' && mode.placementDirections.includes(state.orientation);
  const already=new Set(ships.map(s=>s.type));
  const next=mode.fleet.find(s=>!already.has(s.id));
  const complete=mode.fleet.every(s=>already.has(s.id));
  return `<div class="screen combat-screen placement-screen"><div class="match-layout"><header class="match-head setup-head">${brand()}<div class="turn-box"><b>POSICIONE SUA FROTA</b><small>${esc(mode.name)} · ${mode.geometry.cells.length} casas</small></div><div class="setup-meta"><span class="tp-tag">${p.fleetConfirmed?'CONFIRMADO':complete?'FROTA PRONTA':'PREPARANDO'}</span></div></header><main class="match-grid placement-grid premium-placement-grid"><aside class="side-stack placement-left-rail"><section class="panel compact combat-side-card placement-fleet-card"><div class="eyebrow">Frota disponível</div>${fleetPanel(mode,ships,true)}</section><section class="panel compact combat-side-card placement-tip-card"><div class="eyebrow">Status de preparação</div><div class="tp-list"><div>Você <span>${p.fleetConfirmed?'Confirmou':'Preparando'}</span></div><div>Oponente <span>${p.opponentConfirmed?'Confirmou':'Preparando'}</span></div></div><p class="tp-muted tp-small">Somente você vê suas posições. Os navios do adversário permanecem ocultos.</p></section></aside><section class="panel board-panel board-panel-primary premium-board-panel placement-board-panel"><div class="board-head premium-board-head"><div><div class="eyebrow">Seu mapa</div><b>Quadrante Alfa</b></div><div class="placement-readout"><span>Posicionamento</span><strong>${complete?'Completo':'Pendente'}</strong></div></div><div class="board-wrap board-wrap-primary combat-board-wrap placement-board-wrap tp-board"><div class="tactical-board-frame setup-board-frame">${renderBoard(mode,{ships,interactive:canManual})}</div></div><div class="board-meta placement-board-meta"><div class="meta-block"><div><b>Grade de implantação</b><small>${canManual&&next?`Clique no mapa para posicionar ${esc(shipName(next.id))}`:'Use a distribuição automática para qualquer geometria'}</small></div></div></div></section><aside class="action-col premium-hud placement-hud"><section class="panel placement-protocol-card"><div class="eyebrow">Protocolo de implantação</div><b>Frota ${ships.length} / ${mode.fleet.length}</b>${canManual?`<div class="tp-space" style="margin-top:15px"><label>Orientação <select id="orientation" class="tp-mode-select">${mode.placementDirections.map(d=>`<option ${d===state.orientation?'selected':''} value="${esc(d)}">${esc(d)}</option>`).join('')}</select></label><p class="tp-muted tp-small">Para posicionamento manual, selecione uma casa inicial. É necessário completar toda a frota antes de salvar.</p></div>`:''}<div class="tp-actions" style="margin-top:12px"><button class="btn btn-ghost" data-action="clear-draft" ${!canManual||!ships.length?'disabled':''}>Limpar edição</button><button class="btn btn-primary" data-action="save-placement" ${!complete||!editable||state.draft===null?'disabled':''}>Salvar frota</button></div></section><div class="combat-actions placement-actions"><button class="btn btn-primary setup-random-btn" data-action="random-placement" ${!editable?'disabled':''}><span class="action-copy"><b>Aleatório</b><small>Gerar frota válida na API</small></span></button><button class="btn btn-orange attack-btn" data-action="confirm-placement" ${!p.fleetPlaced||!editable?'disabled':''}><span class="action-copy"><b>${p.fleetConfirmed?'Confirmada':'Confirmar frota'}</b><small>${p.opponentConfirmed?'A batalha começará após confirmar':'Aguarde o adversário'}</small></span></button><button class="btn btn-ghost setup-cancel-btn" data-action="leave-lobby">Cancelar / sair da sala</button></div></aside></main><footer class="match-foot combat-foot placement-foot"><span><b>SETUP</b> ${esc(mode.name)}</span><span class="foot-center">${p.fleetConfirmed?'Aguardando o adversário':'Preparação em andamento'}</span><span>TIDEPOINT / PREPARAÇÃO</span></footer></div></div>`;
}

function shotSummary(shots){return {hits:shots.filter(x=>x.hit),misses:shots.filter(x=>!x.hit)};}
function battleScreen(){
  const b=state.battle,mode=b?.mode||activeMode();
  if (!b||!mode) return mainContent(panel('Sincronizando batalha','Aguardando estado da partida...'),{noNav:true});
  const own=shotSummary(b.shotsReceived||[]),enemy=shotSummary(b.shotsFired||[]);
  const myTurn=b.turnPlayerId===state.profile?.id,finished=b.status==='FINISHED';
  const fired=new Set((b.shotsFired||[]).map(keyOf));
  const selected=state.selected && !fired.has(keyOf(state.selected)) ? state.selected:null;
  const sunk=(b.shotsFired||[]).filter(s=>s.sunkShip);
  const opponent=state.lobby?.players.find(p=>p.id!==state.profile?.id);
  return `<div class="screen combat-screen"><div class="match-layout"><header class="match-head">${brand()}<div class="turn-box"><b>${finished?'BATALHA CONCLUÍDA':myTurn?'SUA VEZ':'AGUARDANDO O OPONENTE'}</b><small>${finished?'Resultado definido pelo servidor':myTurn?'Escolha um alvo no mapa inimigo':'Aguarde a jogada adversária'}</small></div><div class="enemy-meta"><b>${esc(opponent?.nickname||'Oponente')}</b></div></header><main class="match-grid combat-grid"><aside class="side-stack combat-left-rail"><section class="panel compact player-status-card"><div class="player-status-inner"><div class="player-id"><div class="avatar">⚓</div><div><b>${esc(state.profile?.nickname)}</b><small>Seu comando</small></div></div><span class="pill loss-pill">${own.hits.length} acertos sofridos</span></div></section><section class="panel compact combat-side-card"><div class="eyebrow">Sua frota</div>${fleetPanel(mode,b.yourShips||[],true)}</section><section class="panel compact preview-panel combat-side-card"><div class="side-card-heading"><div class="eyebrow">Seu mapa</div></div><div class="board-wrap board-wrap-preview tp-board tp-board-small">${renderBoard(mode,{ships:b.yourShips,hits:own.hits,misses:own.misses,small:true})}</div></section></aside><section class="panel board-panel board-panel-primary premium-board-panel"><div class="board-head premium-board-head"><div><div class="eyebrow enemy-map-label">Mapa inimigo</div><b>Quadrante inimigo</b></div><div class="target-readout"><span>Alvo selecionado</span><strong>${selected?coordLabel(selected):'—'}</strong></div></div><div class="board-wrap board-wrap-primary combat-board-wrap tp-board"><div class="tactical-board-frame">${renderBoard(mode,{hits:enemy.hits,misses:enemy.misses,selected,interactive:myTurn&&!finished})}</div></div><div class="board-meta"><div class="meta-block"><div><b>Inteligência naval</b><small>${enemy.hits.length} acertos · ${enemy.misses.length} disparos na água</small></div></div></div></section><aside class="action-col premium-hud"><section class="panel enemy-intel-panel"><div class="enemy-intel-head"><div><div class="eyebrow">Inteligência inimiga</div><b>Navios identificados</b></div><span class="intel-progress">${sunk.length} / ${mode.fleet.length}</span></div><div class="enemy-intel-list">${mode.fleet.map((ship,i)=>{const sunkType=sunk.some(s=>s.sunkShip===ship.id);return `<article class="intel-ship ${sunkType?'destroyed':'unknown'}"><div class="intel-ship-copy"><div class="intel-state-label">${sunkType?'Afundado':'Não identificado'}</div><b>${sunkType?esc(shipName(ship.id)):'Contato desconhecido'}</b><small>${sunkType?'Classe identificada pelo servidor':`Contato ${i+1} · classe não revelada`}</small></div></article>`}).join('')}</div></section><div class="combat-actions"><button class="btn btn-orange attack-btn" data-action="fire" ${myTurn&&selected&&!finished?'':'disabled'}><span class="action-copy"><b>Atacar</b><small>${selected?`Disparar em ${coordLabel(selected)}`:'Selecione uma casa livre'}</small></span></button><button class="btn btn-ghost skill-btn tp-disabled" disabled><span class="action-copy"><b>Habilidades</b><small>Em desenvolvimento no backend</small></span></button><button class="btn btn-danger" data-action="forfeit" ${finished?'disabled':''}>Desistir da partida</button></div></aside></main><footer class="match-foot combat-foot"><span>${esc(mode.name)}</span><span class="foot-center">${finished?'Partida finalizada':myTurn?'Sua vez de atacar':'Turno do oponente'}</span><span>${b.shotsFired.length} disparos realizados</span></footer></div></div>`;
}
function resultScreen(){
  const b=state.battle;
  if(!b) return mainContent(panel('Resultado','Aguardando dados da partida.'),{noNav:true});
  const won=b.winnerId===state.profile?.id,draw=b.winnerId===null;
  const label=draw?'Sem vencedor':won?'Vitória':'Derrota';
  const shots=b.shotsFired||[],hits=shots.filter(s=>s.hit).length;
  return mainContent(`<section class="panel result-card tp-result"><div class="eyebrow">Relatório pós-batalha</div><div class="result-stamp">${label}</div><h2 class="form-title">${won?'O mar ficou com você.':draw?'O oceano segue sem dono.':'Uma batalha, uma lição.'}</h2><p class="tp-muted">Resultado confirmado pela API · ${esc(b.finishReason||'Batalha finalizada')}</p><div class="result-grid"><div class="result-stat"><b>${shots.length?Math.round(hits/shots.length*100):0}%</b><span>Precisão</span></div><div class="result-stat"><b>${hits}</b><span>Acertos</span></div><div class="result-stat"><b>${shots.length}</b><span>Disparos</span></div></div><div class="tp-actions" style="justify-content:center;margin-top:26px"><button class="btn btn-orange" data-action="leave-lobby">Voltar ao lobby</button></div></section>`,{noNav:true});
}
function fleetScreen(){const mode=activeMode()||state.modes[0];return mainContent(`<div class="tp-page-header"><div class="eyebrow">Frota / Arsenal pessoal</div><h2 class="form-title">Navios do ${esc(mode?.name||'TidePoint')}</h2></div><div class="tp-flow">${panel('Catálogo de embarcações',mode?fleetPanel(mode,[],false):'Não há modos disponíveis.')}${panel('Configuração atual','<p class="tp-muted">A frota de cada modo é definida no servidor e posicionada para cada partida. Inventário, skins equipáveis e habilidades personalizadas ainda não possuem endpoints na API.</p><button class="btn btn-orange" data-go="lobby">Preparar partida</button>')}</div>`,{active:'fleet'});}
function storeScreen(){return mainContent(`<div class="tp-page-header"><div class="eyebrow">Arsenal TidePoint</div><h2 class="form-title">Loja e coleções</h2></div>${panel('Em construção','<p>O layout de cosméticos do protótipo foi reservado para o futuro catálogo. Compras, moedas, skins e pacotes de som ainda não existem na API e, portanto, não há preços ou saldos fictícios aqui.</p><p class="tp-muted">As partidas reais e os tabuleiros estão disponíveis no lobby.</p><button class="btn btn-orange" data-go="lobby">Voltar para jogar</button>')}`,{active:'store'});}
function profileScreen(){const p=state.profile;return mainContent(`<div class="tp-page-header"><button class="btn btn-ghost tp-back" type="button" data-go="lobby">← Voltar</button><div class="eyebrow">Conta de jogador</div><h2 class="form-title">Meu perfil</h2></div><div class="tp-flow"><section class="panel tp-panel"><div class="eyebrow">Identidade</div><form class="tp-form" data-form="profile"><div class="field"><label for="profile-name">Nickname</label><input id="profile-name" name="nickname" maxlength="30" minlength="3" required value="${esc(p?.nickname)}" /></div><div class="field"><label for="avatar">Avatar</label><select name="avatarId" id="avatar" class="tp-mode-select">${['captain','submarine','destroyer','carrier'].map(id=>`<option value="${id}" ${p?.avatarId===id?'selected':''}>${esc(shipName(id.toUpperCase()))}</option>`).join('')}</select></div><button class="btn btn-primary" type="submit">Salvar perfil</button></form><p class="tp-muted tp-small" style="margin-top:12px">E-mail: ${esc(p?.email||'—')}</p></section><section class="panel tp-panel"><div class="eyebrow">Segurança</div><h2 class="panel-title">Alterar senha</h2><form class="tp-form" data-form="password"><div class="field"><label>Senha atual<input name="currentPassword" type="password" autocomplete="current-password" required /></label></div><div class="field"><label>Nova senha<input name="newPassword" type="password" autocomplete="new-password" minlength="8" maxlength="72" required /></label></div><button class="btn btn-orange" type="submit">Alterar senha</button></form><p class="tp-muted tp-small">A sessão continua ativa após a troca de senha.</p></section></div>`,{noNav:true});}

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
  const pages={auth:()=>authForm(false),register:()=>authForm(true),lobby:lobbyScreen,matchmaking:waitingScreen,placement:placementScreen,match:battleScreen,result:resultScreen,fleet:fleetScreen,store:storeScreen,profile:profileScreen};
  root.innerHTML='<div id="tp-notice-root" aria-live="polite"></div>'+(pages[route]||pages.lobby)()+roomExitDialog();
  renderedRoute=route;
  updateNotice();
  if (state.busy) root.classList.add('tp-loading'); else root.classList.remove('tp-loading');
  document.body.dataset.route=route;
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
    case 'profile':await guard(async()=>{state.profile=await api.patch('/users/me',{nickname:values.nickname.trim(),avatarId:values.avatarId});notice('Perfil atualizado com sucesso.');});break;
    case 'password':await guard(async()=>{await api.post('/auth/change-password',{currentPassword:values.currentPassword,newPassword:values.newPassword});notice('Senha atualizada. Sua sessão permanece ativa.');});break;
  }
}

async function runAction(action) {
  switch(action) {
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
    case 'dismiss':state.notice='';updateNotice();break;
    case 'open-join-modal': { const dialog=root.querySelector('#tp-join-dialog'); if (dialog && !dialog.open) { dialog.showModal(); dialog.querySelector('input[name=code]')?.focus(); } break; }
    case 'close-join-modal':root.querySelector('#tp-join-dialog')?.close();break;
    case 'logout':await guard(async()=>{await api.logout();reset();clearInterval(refreshTimer);refreshTimer=null;go('auth');});break;
    case 'create-lobby':await guard(async()=>{state.lobby=await api.post('/matchmaking/lobbies',{modeId:state.modeId});go('matchmaking');});break;
    case 'copy-code':if(state.lobby){try{await navigator.clipboard.writeText(state.lobby.code);notice('Código copiado para a área de transferência.');}catch{notice(`Código da sala: ${state.lobby.code}`);}}break;
    case 'ready':await guard(async()=>{const me=state.lobby?.players.find(p=>p.id===state.profile.id);state.lobby=await api.put('/matchmaking/lobbies/me/ready',{ready:!me?.ready});await reconcile();});break;
    case 'leave-lobby':{
      if (state.lobby?.status==='PLAYING' && !confirm('Sair agora significa desistir e perder a partida. Continuar?')) return;
      state.leavingRoom=true;
      try {await guard(async()=>{await api.remove('/matchmaking/lobbies/me');state.lobby=null;state.battle=null;state.preparation=null;state.draft=null;go('lobby');});}
      finally {state.leavingRoom=false;}
      break;}
    case 'random-placement':await guard(async()=>{state.preparation=await api.post('/matches/me/placement/random');state.draft=[...state.preparation.yourShips];});break;
    case 'save-placement':await guard(async()=>{state.preparation=await api.put('/matches/me/placement',{ships:state.draft});state.draft=[...state.preparation.yourShips];notice('Frota validada e salva pela API.');});break;
    case 'confirm-placement':await guard(async()=>{
      if (state.draft!==null && JSON.stringify(state.draft)!==JSON.stringify(state.preparation.yourShips)) state.preparation=await api.put('/matches/me/placement',{ships:state.draft});
      state.preparation=await api.post('/matches/me/placement/confirm');state.draft=[...state.preparation.yourShips];await reconcile();
    });break;
    case 'clear-draft':state.draft=[];render();break;
    case 'fire':await guard(async()=>{
      if(!state.selected||!state.battle||state.battle.turnPlayerId!==state.profile.id)return;
      state.battle=await api.post('/matches/me/shots',state.selected);
      state.selected=null;await reconcile();
    });break;
    case 'forfeit':if(confirm('Confirmar desistência? O adversário receberá a vitória.'))await guard(async()=>{state.battle=await api.post('/matches/me/forfeit');await reconcile();});break;
  }
}
function selectCell(row,col){
  const route=currentRoute(),mode=activeMode();if(!mode || state.busy) return;
  if(route==='match') {
    if(state.battle?.turnPlayerId!==state.profile?.id||state.battle?.status!=='PLAYING') return;
    if(state.battle.shotsFired.some(s=>s.row===row&&s.col===col))return;
    state.selected={row,col};
    // Update only target readout/cells, not the whole combat HUD and its boards.
    const board=root.querySelector('.combat-screen .board-panel-primary');
    if (!board) { render(); return; }
    board.querySelectorAll('.cell.target,.tile.target').forEach(node=>{
      node.classList.remove('target');
      node.querySelector('.target-reticle')?.remove();
    });
    const key=`${row},${col}`;
    const node=[...board.querySelectorAll('[data-coord]')].find(el=>el.dataset.coord===key);
    if (node) node.classList.add('target');
    const readout=board.querySelector('.target-readout strong');
    if(readout) readout.textContent=coordLabel(state.selected);
    const button=root.querySelector('[data-action="fire"]');
    if(button){button.disabled=false;const caption=button.querySelector('small');if(caption)caption.textContent=`Disparar em ${coordLabel(state.selected)}`;}
  } else if(route==='placement'){
    if(state.preparation?.fleetConfirmed||mode.geometry.kind!=='RECTANGULAR')return;
    const placed=[...(state.draft??[])];const next=mode.fleet.find(s=>!placed.some(d=>d.type===s.id));
    if(!next)return notice('Toda a frota já está posicionada. Salve ou confirme.',false);
    const candidate={type:next.id,row,col,orientation:state.orientation};
    const proposed=[...placed,candidate];const occupied=occupiedCells(proposed,mode);
    const valid=new Set(mode.geometry.cells.map(keyOf));
    const total=proposed.reduce((sum,s)=>sum+(mode.fleet.find(d=>d.id===s.type)?.length||0),0);
    if(occupied.size!==total||[...occupied].some(key=>!valid.has(key)))return notice('Posição inválida ou sobreposta. Escolha outra célula.',true);
    state.draft=proposed;state.notice='';render();
  }
}
function bindEvents() {
  root.addEventListener('cancel', event=>{
    if (event.target?.id==='tp-room-exit-dialog') event.preventDefault();
  });
  root.addEventListener('submit', event=>{
    const form=event.target.closest('form[data-form]');if(!form)return;
    event.preventDefault(); void handleForm(form);
  });
  root.addEventListener('click',event=>{
    const target=event.target.closest('[data-coord]');
    if(target){const [row,col]=target.dataset.coord.split(',').map(Number);selectCell(row,col);return;}
    const action=event.target.closest('[data-action]');if(action){void runAction(action.dataset.action);return;}
    const link=event.target.closest('[data-go]');if(link){go(link.dataset.go);}
  });
  root.addEventListener('keydown',event=>{
    if((event.key==='Enter'||event.key===' ')&&event.target.matches('g[data-coord]')) {
      event.preventDefault();const [r,c]=event.target.dataset.coord.split(',').map(Number);selectCell(r,c);
    }
  });
  root.addEventListener('change',event=>{
    if(event.target.id==='mode-picker')state.modeId=event.target.value;
    if(event.target.id==='orientation')state.orientation=event.target.value;
  });
  window.addEventListener('hashchange',()=>{
    if(state.lobby&&['lobby','matchmaking','placement','match','result'].includes(currentRoute()))synchronizeRoute();render();
  });
}
export function startTidepoint(element) {
  root=element; bindEvents();render();
  // Tokens are memory-only by design; a reload requires a new login.
}
