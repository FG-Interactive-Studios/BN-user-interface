import { Panel, StatusBadge } from "../../components/index";

export function renderMatchmakingPage() {
  return `
    <div class="page-header">
      <div>
        <p class="eyebrow">Conectando</p>
        <h1>Matchmaking</h1>
      </div>
      ${StatusBadge("Buscando rival", "warning")}
    </div>

    <div class="page-grid">
      ${Panel(
        "Procurando partida",
        "Aguardando um oponente compatível",
        `
          <div class="matcher-shell">
            <div class="spinner"></div>
            <div class="matcher-text">
              <strong>Tempo estimado</strong>
              <p>18 segundos</p>
            </div>
          </div>
          <div class="form-actions align-left">
            <button type="button" class="button button-secondary" data-action="cancel-match">Cancelar busca</button>
            <button type="button" class="button button-primary" data-action="match-found">Simular encontro</button>
          </div>
        `
      )}
    </div>
  `;
}
