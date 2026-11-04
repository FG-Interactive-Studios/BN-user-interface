# Batalha Naval — Migração da interface Figma (em desenvolvimento)

Referência: design aprovado `PHfipffDE6V0Dil3RGCzC6`, exportado no PDF **Batalha Naval - Fluxo de Telas.pdf** (12 telas verticais, 1080×1920). A integração direta com o Figma atingiu o limite de chamadas; o PDF e os assets exportados foram a referência desta etapa.

## Arquitetura e branch
- Stack preservada: Vite + Vanilla JavaScript / HTML / CSS. Nenhuma migração para React.
- Trabalho em `feature/figma-new-ui-v1`, PR #5 **sem merge**, comparável à `main`.
- Interface anterior preservada em `archive/tidepoint-classic-ui-2026-11-04`.
- Regras de sala, posição de navios, batalha, autenticação e reconexão permanecem autoritativas na API.

## O que foi implementado nesta etapa
- Autenticação e cadastro em composição vertical (Pirata One, Lexend, fundo Tempestade, botões pílula).
- Lobby com carta de evento, novidades, patentes identificadas como indisponíveis, ação Jogar e modal de entrada por código.
- Header compacto com perfil/conexão/menu de conta e navegação inferior Equipe/Play/Loja.
- Frota real derivada dos modos recebidos por `GET /api/game-modes`, sem inventar posições.
- Perfil com edição de nickname, avatar e senha por endpoints existentes.
- **Loja beta real:** `GET /api/store` traz créditos de teste e itens, com filtros SKIN/SOUND; `POST /api/store/purchase/{itemId}` compra, `PUT /api/store/equip/{itemId}` equipa. Não há preços fictícios nem pagamentos reais. A arte e os sons finais ainda dependem do time de Game Design.
- Regras finais de layout no `figma-responsive-v2.css`, sobrescrevendo a herança TidePoint para as telas novas. Removidos cortes por `100dvh + overflow:hidden` nas rotas de navegação e, no mobile, em preparação/batalha; barra inferior com área reservada e safe area.
- Fundo Tempestade, moedas e três ícones originais são recursos locais em `src/assets/figma`.

## Responsividade
- Referência principal é o retrato 9:16; desktop usa uma coluna central que mantém a hierarquia de conteúdo do Figma, em vez de esticar os painéis até a largura da janela.
- Breakpoints testáveis: 320×568, 375×667 (iPhone SE), 390×844 e 1366×768.
- Conteúdo deve permanecer utilizável com **rolagem vertical quando necessária**; botões nunca podem ficar atrás do menu inferior.
- No combate mobile, o tabuleiro permanece quadrado e os blocos passam a uma coluna com ações alcançáveis. O visual específico do combate ainda requer homologação com dois jogadores e screenshots reais.

## Limitações conhecidas
- O Figma apresenta saldos e recompensas, XP, ranking, eventos e poderes com valores ilustrativos; a API não fornece todos esses dados. A interface não os inventa. Somente créditos cosméticos beta da API são exibidos.
- Ícones de âncora dourado/azul, arte de evento e ilustrações de produtos ainda precisam ser integrados em seus slots definitivos. Não usar prints de tela como assets.
- O "Jogar" da versão funcional abre o fluxo existente de **sala privada**, não uma fila de matchmaking público.
- Tela de configurações e fidelidade integral das telas de posicionamento, batalha, perda de conexão e resultado ainda são etapas futuras. Alguns estilos TidePoint antigos permanecem nesses fluxos.
- Não alterar o CSS da interface clássica apenas para forçar a correspondência com o Figma.

## Validação
```bash
npm ci
npm run build
node tools/test-store.mjs
node tools/test-figma-assets.mjs
node tools/test-lobby.mjs
# O workflow "Figma responsive browser check" instala Playwright no CI:
node tools/test-figma-viewport.mjs
```

O workflow faz login com mock **apenas em teste**, visita lobby, modal, frota, loja e perfil, mede overflow horizontal e sobreposição de nav em diferentes viewports, e anexa screenshots à execução. A versão publicada continua exigindo login real.
