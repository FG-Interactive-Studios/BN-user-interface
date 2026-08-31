import { Panel, StatusBadge } from "../../components/index";

export function renderResultPage() {
  return `
    <div class="page-header">
      <div>
        <p class="eyebrow">Fim da partida</p>
        <h1>Resultado</h1>
      </div>
      ${StatusBadge("Vitória", "success")}
    </div>

    <div class="page-grid two-columns">
      ${Panel(
        "Resumo da partida",
        "Estatísticas finais",
        `
          <ul class="info-list">
            <li><span>Jogadas</span><strong>42</strong></li>
            <li><span>Acertos</span><strong>18</strong></li>
            <li><span>Navios afundados</span><strong>4</strong></li>
          </ul>
        `
      )}

      ${Panel(
        "Próximos passos",
        "O que vem agora",
        `
          <div class="stacked-actions">
            <button type="button" class="button button-primary" data-action="play-again">Jogar de novo</button>
            <button type="button" class="button button-secondary" data-action="back-to-lobby">Voltar ao lobby</button>
          </div>
        `
      )}
    </div>
  `;
}
