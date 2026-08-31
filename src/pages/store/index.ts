import { Panel, StatusBadge } from "../../components/index";

export function renderStorePage() {
  return `
    <div class="page-header">
      <div>
        <p class="eyebrow">Loja</p>
        <h1>Loja de itens</h1>
      </div>
      ${StatusBadge("120 moedas", "primary")}
    </div>

    <div class="page-grid two-columns">
      ${Panel(
        "Itens em destaque",
        "Upgrade para a próxima partida",
        `
          <div class="store-grid">
            <div class="store-item">
              <h4>Radar</h4>
              <p>Detecta linha de ataque.</p>
              <strong>35 moedas</strong>
            </div>
            <div class="store-item">
              <h4>Escudo</h4>
              <p>Protege uma rodada.</p>
              <strong>50 moedas</strong>
            </div>
            <div class="store-item">
              <h4>Boost</h4>
              <p>Aumento de precisão.</p>
              <strong>65 moedas</strong>
            </div>
          </div>
        `
      )}

      ${Panel(
        "Inventário",
        "Itens já comprados",
        `
          <ul class="info-list">
            <li><span>Radar</span><strong>1</strong></li>
            <li><span>Escudo</span><strong>2</strong></li>
          </ul>
        `
      )}
    </div>
  `;
}
