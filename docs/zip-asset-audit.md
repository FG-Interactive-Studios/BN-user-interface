# Auditoria dos assets — Fluxo de Batalha Naval.zip

**Base da auditoria:** ZIP entregue pelo Game Design em 23/11/2026, arquivos `src/App.tsx`, `src/index.css` e `public/assets/**`; PR #15 e jogo atual. Esta lista distingue **asset disponibilizado** de **uso real no protótipo** e de **arte aprovada como regra**. Não inventar novos modelos ou poderes.

| Asset original | Intenção comprovada no ZIP | Estado da PR #15 após esta revisão | Prioridade |
|---|---|---|---|
| `bg.png` | Fundo principal da área de jogo via CSS | **Pendente**: o visual atual usa `storm.jpg`; precisa reproduzir composição final | P0 |
| `water-tile.png` | Fundo de cada célula do tabuleiro | **Integrado** como `water-tile.webp`, ambas as telas, substituindo gradiente genérico | P0 |
| `cell-placed.png` | Células ocupadas por frota própria | **Integrado** como `cell-placed.webp`; não revela navios inimigos | P0 |
| `cell-selected.png` | Retícula de alvo selecionado | **Integrado** como `cell-selected.webp`; funciona com tiro normal e marcação de poder | P0 |
| `cell-hit.png` | Sobreposição de acerto | **Integrado** como `cell-hit.webp` | P0 |
| `cell-miss.png` | Sobreposição de tiro na água | **Integrado** como `cell-miss.webp` | P0 |
| `ship-sub.png` | Arte do submarino 1 casa usada nos cards do ZIP | **Pendente GD**: API chama a classe de 1 casa de `SEARCH`; confirmar com GD se pode ser esta representação | P1 |
| `ship-battleship.png` | Arte do encouraçado 2 casas nos cards do ZIP | **Pendente GD**: API chama a classe de 2 casas de `DESTROYER`; confirmar associação visual | P1 |
| `ship-carrier.png` | Arte do porta-aviões 5 casas nos cards do ZIP | **Pendente de integração**: mesmo tamanho e nome de classe, mas sprite ainda não renderizado nos cards | P1 |
| `Capitan/neutral.png` | Arquivo disponível no ZIP, **não referenciado por `App.tsx`** | **Pendente de definição**: precisa de ponto de uso aprovado para não inventar painel novo | P2 |

## Status técnico real
- Cinco imagens de célula transcodificadas em WebP com transparência preservada quando presente; os respectivos PNGs originais e seus nomes constam do ZIP fornecido pelo usuário. A otimização apenas reduz peso; não redesenha a arte.
- O repositório utiliza também `src/assets/figma/{storm.jpg,cannon.png,ship-icon.png,...}`. Isso **não equivale** aos assets da referência do ZIP.
- A PR #15 ainda possui diferenças estruturais em relação ao ZIP: duas grades 8×8 empilhadas e bússola central no protótipo, contra grade principal e frota miniatura na PR. Esta revisão de recursos **não aprova a fidelidade geral**.
- O ZIP é um protótipo **visual**: nomes `sub/battleship/carrier` não substituem as decisões de Game Design (`SEARCH/DESTROYER/CARRIER`) nem os IDs de loja, e seus temporizadores/dados locais são demonstrações, não regras do backend.
- `Capitan/neutral.png` constar da pasta não significa que o protótipo efetivamente o colocou na tela — não criar posicionamento sem aprovação.
- Ícones utilitários de relógio, girar, menu, chevron e spark **não têm PNG correspondente no ZIP**: CSS/SVG nesses casos não é desvio de fidelidade.

## Critérios antes de liberar o merge
- [x] Usar imagens originais de textura/estado de célula, sem reconstruir ícones por CSS
- [x] Incluir verificação automatizada de assinatura WebP e existência dos cinco arquivos no CI
- [ ] Integrar `bg.png` como fundo do fluxo, com recorte semelhante à referência
- [ ] Confirmar com GD o mapeamento das artes de uma e duas casas e incorporar as três imagens nos cards
- [ ] Reproduzir composição dos **dois tabuleiros** e bússola conforme ZIP, mantendo controles responsivos e backend autoritativo
- [ ] Validar lado a lado screenshots no celular 320×568, 375×667, 390×844, 412×915 e desktop, incluindo textura, retículas e recortes dos navios
- [ ] Confirmar com GD se e onde o capitão deve aparecer
- [ ] Verificar se skins compradas/substituídas não sobrescrevem o pacote visual `skin_default` sem assets homologados

O critério de fidelidade é **reproduzir os recursos reais do layout**, não recriá-los visualmente por CSS. O CI de geometria não é prova de fidelidade estética.
