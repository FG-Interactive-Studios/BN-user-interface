import { BoardGrid, Panel, StatusBadge } from "../../components/index";

export function renderMatchPage() {
  return `
    <div class="page-header">
      <div>
        <p class="eyebrow">Partida ativa</p>
        <h1>Partida</h1>
      </div>
      ${StatusBadge("Sua vez", "success")}
    </div>

    <div class="page-grid two-columns">
      ${Panel("Seu tabuleiro", "Defesa", BoardGrid(10))}
      ${Panel("Tabuleiro inimigo", "Ataque", BoardGrid(10))}
    </div>

    <div class="toolbar">
      <button type="button" class="button button-primary" data-action="fire-shot">Atirar em A3</button>
      <button type="button" class="button button-secondary" data-action="fire-shot">Atirar em C7</button>
    </div>
  `;
}
