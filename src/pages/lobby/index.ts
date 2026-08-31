import { Panel, StatusBadge } from "../../components/index";

export function renderLobbyPage() {
  return `
    <div class="page-header">
      <div>
        <p class="eyebrow">Sala de espera</p>
        <h1>Lobby</h1>
      </div>
      ${StatusBadge("3 jogadores online", "primary")}
    </div>

    <div class="page-grid two-columns">
      ${Panel(
        "Partidas disponíveis",
        "Escolha como entrar em uma partida",
        `
          <div class="list-card">
            <div class="list-item">
              <div>
                <strong>Partida rápida</strong>
                <small>2-4 min</small>
              </div>
              <button type="button" class="button button-primary" data-action="find-match">Buscar</button>
            </div>
            <div class="list-item">
              <div>
                <strong>Ranked</strong>
                <small>Competição</small>
              </div>
              <button type="button" class="button button-secondary" data-action="find-match">Entrar</button>
            </div>
            <div class="list-item">
              <div>
                <strong>Loja</strong>
                <small>Cosméticos e itens</small>
              </div>
              <button type="button" class="button button-secondary" data-action="open-store">Abrir</button>
            </div>
          </div>
        `
      )}

      ${Panel(
        "Amigos e status",
        "Jogadores na sala",
        `
          <ul class="player-list">
            <li><span>player_01</span><em>pronto</em></li>
            <li><span>player_02</span><em>em fila</em></li>
            <li><span>player_03</span><em>pronto</em></li>
          </ul>
        `
      )}
    </div>
  `;
}
