import { esc, shipName } from './board.js';

/** Approved Figma player-profile artboard.
 * Data from /api/users/me only. No invented rank, XP, record or achievements.
 * The existing account editor and password forms remain functional in a modal.
 */
export function renderFigmaProfile(profile) {
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
  const stat=(title,kind)=>`<div class="bn-profile-stat ${kind}">
    <strong aria-label="Dado indisponível">—</strong><span>${title}</span></div>`;
  return `<div class="screen bn-profile-stage">
    <main class="bn-profile-layout" aria-labelledby="bn-profile-title">
      <header class="bn-profile-heading">
        <button type="button" class="bn-profile-back" data-go="lobby" aria-label="Voltar ao lobby">‹</button>
        <h1 id="bn-profile-title">Perfil</h1>
      </header>
      <section class="bn-profile-card bn-profile-captain" aria-labelledby="bn-profile-name">
        <div class="bn-profile-portrait">
          <div class="bn-profile-portrait-inner" aria-label="Avatar selecionado: ${esc(avatar)}"><span>${initial}</span></div>
          <span class="bn-profile-level">Nível —</span>
        </div>
        <div class="bn-profile-identity">
          <h2 id="bn-profile-name">${nickname}</h2>
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
            ${stat('Vitórias','victories')}
            ${stat('Derrotas','defeats')}
            ${stat('Taxa de vitória','rate')}
            ${stat('Melhor sequência','streak')}
          </div>
          <p class="bn-profile-availability">As estatísticas aparecerão quando a API disponibilizar o histórico de partidas.</p>
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
          <h2 id="bn-profile-history-heading">Histórico recente</h2>
          <div class="bn-profile-history-empty">
            <span class="bn-profile-history-mark" aria-hidden="true">⚓</span>
            <p>Histórico de partidas ainda indisponível.</p>
          </div>
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
