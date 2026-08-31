import { Panel, StatusBadge } from "../../components/index";

export function renderAuthPage() {
  return `
    <div class="page-header">
      <div>
        <p class="eyebrow">Acesso ao jogo</p>
        <h1>Entrar</h1>
      </div>
      ${StatusBadge("Servidor online", "success")}
    </div>

    <div class="page-grid two-columns">
      ${Panel(
        "Sua conta",
        "Continue para o lobby",
        `
          <form class="stacked-form">
            <label>
              <span>Nickname</span>
              <input value="player_01" />
            </label>
            <label>
              <span>Senha</span>
              <input type="password" value="••••••••" />
            </label>
            <div class="form-actions">
              <button type="button" class="button button-primary" data-action="login">Entrar</button>
              <button type="button" class="button button-secondary" data-action="login">Cadastrar</button>
            </div>
          </form>
        `
      )}

      ${Panel(
        "Resumo do servidor",
        "Situação do ambiente",
        `
          <ul class="info-list">
            <li><span>API</span><strong>online</strong></li>
            <li><span>WebSocket</span><strong>estável</strong></li>
            <li><span>Fila</span><strong>3 jogadores</strong></li>
          </ul>
        `
      )}
    </div>
  `;
}
