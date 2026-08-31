import { BoardGrid, Panel, StatusBadge } from "../../components/index";

export function renderPlacementPage() {
  return `
    <div class="page-header">
      <div>
        <p class="eyebrow">Preparação da partida</p>
        <h1>Posicionamento</h1>
      </div>
      ${StatusBadge("Sua frota", "primary")}
    </div>

    <div class="page-grid two-columns">
      ${Panel(
        "Tabuleiro",
        "Posicione suas embarcações antes de iniciar",
        BoardGrid(10)
      )}

      ${Panel(
        "Embarcações",
        "Disponíveis para alocar",
        `
          <ul class="fleet-list">
            <li><span>Porta-aviões</span><strong>1</strong></li>
            <li><span>Encouraçado</span><strong>2</strong></li>
            <li><span>Destroyer</span><strong>3</strong></li>
            <li><span>Submarino</span><strong>4</strong></li>
          </ul>
          <div class="form-actions align-left">
            <button type="button" class="button button-primary" data-action="confirm-placement">Confirmar posição</button>
          </div>
        `
      )}
    </div>
  `;
}
