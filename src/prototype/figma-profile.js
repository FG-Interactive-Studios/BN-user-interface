import { esc, shipName } from './board.js';
import {captainArt} from './ship-art.js';
import {expressionTitle} from './expressive-cosmetics.js';

/** Approved Figma player-profile artboard.
 * Identity and authoritative /api/users/me/statistics. No invented XP or achievements.
 * The existing account editor and password forms remain functional in a modal.
 */
export function renderFigmaProfile(profile,{title,frame,captain,statistics,statisticsLoading=false,statisticsError=false}={}) {
  const p=profile||{};
  const nickname=esc(p.nickname||'Capitão');
  const initial=esc(Array.from(String(p.nickname||'C').trim())[0]?.toLocaleUpperCase('pt-BR')||'C');
  const id=p.id==null?'ID indisponível':'ID #'+esc(p.id);
  const avatar=p.avatarId||'captain';
  const avatars=['captain','submarine','destroyer','carrier'];
  const achievements=[
    {title:'Almirante',kind:'gold'},
    {title:'Invicto x10',kind:'silver'},
    {title:'Frota completa',kind:'ship'},
    {title:'Mira perfeita',kind:'cannon'}
  ];
  const stat=(title,kind,value)=>`<div class="bn-profile-stat ${kind}">
    <strong ${value==null?'aria-label="Dado indisponível"':''}>${value==null?'—':esc(value)}</strong><span>${title}</span></div>`;
  const n=value=>Number.isFinite(value)?value.toLocaleString('pt-BR'):null;
  const rate=statistics?((statistics.totalMatches?100*statistics.wins/statistics.totalMatches:0).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%'):null;
  const reasons={ALL_SHIPS_SUNK:'Frota afundada',ABANDONED:'Desistência',BOTH_DISCONNECTED:'Ambos desconectados',DISCONNECTED:'Desconexão',MATCH_TIMEOUT:'Tempo encerrado',TURN_TIMEOUT:'Tempo de turno'};
  const date=value=>{const d=new Date(value);return value&&!Number.isNaN(d.getTime())?d.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'Data indisponível';};
  const recent=Array.isArray(statistics?.recentMatches)?statistics.recentMatches.slice(0,10):[];
  const history=recent.map(m=>{
    const result=m.result==='WIN'?'Vitória':m.result==='LOSS'?'Derrota':'Empate';
    return `<article class="bn-profile-match" data-result="${esc(m.result)}">
      <span class="bn-profile-match-result">${result}</span>
      <div class="bn-profile-match-info"><strong>${esc(m.opponentNickname||'Adversário')}</strong><small>${esc(m.modeName||'Modo de jogo')} · ${esc(date(m.finishedAt))}</small></div>
      <div class="bn-profile-match-score"><strong>${esc(n(m.hits)??'—')} × ${esc(n(m.hitsReceived)??'—')}</strong><small>Acertos · ${esc(reasons[m.finishReason]||'Encerrada')}</small></div>
    </article>`;
  }).join('');
  const unavailable=statisticsLoading?'Carregando histórico…':statisticsError?'Não foi possível carregar as estatísticas.':statistics?'Nenhuma partida concluída ainda.':'Histórico de partidas indisponível.';
  return `<div class="screen bn-profile-stage">
    <main class="bn-profile-layout" aria-labelledby="bn-profile-title">
      <header class="bn-profile-heading">
        <button type="button" class="bn-profile-back" data-go="lobby" aria-label="Voltar ao lobby">‹</button>
        <h1 id="bn-profile-title">Perfil</h1>
      </header>
      <section class="bn-profile-card bn-profile-captain" aria-labelledby="bn-profile-name">
        <div class="bn-profile-portrait ${frame==='frame_neon'?'bn-neon-frame':''}">
          <div class="bn-profile-portrait-inner" role="img" aria-label="Capitão equipado">
            <img class="bn-gd-profile-captain" src="${captainArt(captain||'captain_default')}" data-fallback="${captainArt('captain_default')}" alt="" width="128" height="128">
            <span class="bn-profile-initial" hidden aria-hidden="true">${initial}</span>
          </div>
          <span class="bn-profile-level">Nível —</span>
        </div>
        <div class="bn-profile-identity">
          <h2 id="bn-profile-name">${nickname}</h2>${expressionTitle(title)?`<p class="bn-profile-rank">${esc(expressionTitle(title))}</p>`:''}
          <p class="bn-profile-rank">${id} <span aria-hidden="true">·</span> Patentes em breve</p>
          <div class="bn-profile-xp-track" role="img" aria-label="Progresso de XP não disponível na API"></div>
          <p class="bn-profile-xp-label">Experiência indisponível</p>
          <button type="button" class="bn-profile-edit" data-action="open-profile-editor">Editar perfil</button>
        </div>
      </section>
      <div class="bn-profile-dashboard">
        <section class="bn-profile-card bn-profile-statistics" aria-labelledby="bn-profile-stats-heading">
          <h2 id="bn-profile-stats-heading">Estatísticas</h2>
          <div class="bn-profile-stat-grid">
            ${stat('Partidas','total',n(statistics?.totalMatches))}
            ${stat('Vitórias','victories',n(statistics?.wins))}
            ${stat('Derrotas','defeats',n(statistics?.losses))}
            ${stat('Empates','draws',n(statistics?.draws))}
            ${stat('Taxa de vitória','rate',rate)}
            ${stat('Sequência atual','current-streak',n(statistics?.currentWinStreak))}
            ${stat('Melhor sequência','streak',n(statistics?.bestWinStreak))}
          </div>
          <p class="bn-profile-availability">${statistics?'Totais de todas as partidas registradas.':esc(unavailable)}</p>
        </section>
        <section class="bn-profile-card bn-profile-achievements" aria-labelledby="bn-profile-achievements-heading">
          <div class="bn-profile-panel-heading"><h2 id="bn-profile-achievements-heading">Conquistas</h2><span>Em breve</span></div>
          <div class="bn-profile-badges">
            ${achievements.map(item=>`<div class="bn-profile-achievement" aria-label="${item.title}: conquista ainda não implementada">
              <span class="bn-profile-badge-art ${item.kind}" aria-hidden="true"></span>
              <span class="bn-profile-badge-title">${item.title}</span>
            </div>`).join('')}
          </div>
          <p class="bn-profile-availability">Prévia das conquistas. Nenhuma conclusão é informada pela API.</p>
        </section>
        <section class="bn-profile-card bn-profile-history" aria-labelledby="bn-profile-history-heading">
          <div class="bn-profile-panel-heading"><h2 id="bn-profile-history-heading">Histórico recente</h2><span>Últimas 10 partidas</span></div>
          ${recent.length?`<div class="bn-profile-match-list">${history}</div>`:`<div class="bn-profile-history-empty">
            <span class="bn-profile-history-mark" aria-hidden="true">⚓</span>
            <p>${esc(unavailable)}</p>
          </div>`}
          ${statisticsError?'<button type="button" class="bn-profile-retry" data-action="reload-profile-statistics">Tentar novamente</button>':''}
        </section>
      </div>
    </main>
    <dialog class="bn-profile-dialog" id="bn-profile-editor" aria-labelledby="bn-profile-editor-title">
      <div class="bn-profile-dialog-heading">
        <h2 id="bn-profile-editor-title">Editar perfil</h2>
        <button type="button" data-action="close-profile-editor" aria-label="Fechar edição de perfil">×</button>
      </div>
      <form class="tp-form bn-profile-edit-form" data-form="profile">
        <div class="bn-field"><label for="profile-name">Nome de usuário</label><input id="profile-name" name="nickname" maxlength="30" minlength="3" required value="${nickname}"/></div>
        <div class="bn-field"><label for="avatar">Avatar</label>
          <select name="avatarId" id="avatar" class="tp-mode-select">
            ${avatars.map(id=>`<option value="${id}" ${p.avatarId===id?'selected':''}>${esc(id==='captain'?'Capitão':shipName(id.toUpperCase()))}</option>`).join('')}
          </select>
        </div>
        <button class="bn-profile-save" type="submit">Salvar perfil</button>
      </form>
      <details class="bn-profile-security">
        <summary>Alterar senha</summary>
        <form class="tp-form bn-profile-edit-form" data-form="password">
          <div class="bn-field"><label for="current-password">Senha atual</label><input id="current-password" name="currentPassword" type="password" autocomplete="current-password" required/></div>
          <div class="bn-field"><label for="new-password">Nova senha</label><input id="new-password" name="newPassword" type="password" autocomplete="new-password" minlength="8" maxlength="72" required/></div>
          <button type="submit" class="bn-profile-save">Alterar senha</button>
        </form>
        <p>Sua sessão permanece ativa após a alteração.</p>
      </details>
    </dialog>
  </div>`;
}
