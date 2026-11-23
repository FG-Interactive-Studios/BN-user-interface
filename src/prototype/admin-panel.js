import {esc} from './board.js';

/**
 * Administrative presentation within the main game's SPA.
 * Actions use the same authenticated client session/rotating refresh token.
 * This is visibility-only; /api/admin/* enforces is_admin against the database.
 */
export function renderAdminPanel({modes,loading=false,error=''}={}) {
  const items=(modes||[]).map(entry=>{
    const mode=entry.mode||{};
    return `<article class="bn-admin-mode">
      <div class="bn-admin-mode-details">
        <h2>${esc(mode.name||mode.id||'Modo')}</h2>
        <p>${esc(mode.geometry?.kind||'Tabuleiro')} · ${mode.geometry?.cells?.length||0} casas · ${mode.fleet?.length||0} navios</p>
        <small>${entry.updatedAt?'Atualizado em '+esc(new Date(entry.updatedAt).toLocaleString('pt-BR')):'Sem alterações anteriores'}</small>
      </div>
      <button type="button" data-action="admin-toggle-mode" data-item-id="${esc(mode.id||'')}"
        class="bn-admin-toggle ${entry.enabled?'is-enabled':'is-disabled'}"
        aria-label="${entry.enabled?'Desabilitar':'Habilitar'} ${esc(mode.name||mode.id)}"
        ${loading?'disabled':''}>${entry.enabled?'Habilitado':'Desabilitado'}</button>
    </article>`;
  }).join('');
  return `<div class="bn-page bn-admin-page">
    <header class="bn-page-heading">
      <span class="bn-admin-eyebrow">CONTROLE DE JOGO</span>
      <h1>Área administrativa</h1>
      <p>Disponibilidade dos modos para novas partidas. As batalhas existentes não são interrompidas.</p>
    </header>
    <section class="bn-admin-surface" aria-label="Gerenciar modos de jogo">
      <div class="bn-admin-section-header">
        <h2>Tabuleiros</h2>
        <button type="button" class="bn-admin-refresh" data-action="admin-refresh" ${loading?'disabled':''}>Atualizar</button>
      </div>
      <p class="bn-admin-feedback" role="status" aria-live="polite">${error?esc(error):loading?'Carregando modos...':''}</p>
      <div class="bn-admin-list">${items||(!loading?'<p>Nenhum modo administrativo disponível.</p>':'')}</div>
    </section>
    <button type="button" class="bn-admin-return" data-go="lobby">← Voltar ao jogo</button>
  </div>`;
}
