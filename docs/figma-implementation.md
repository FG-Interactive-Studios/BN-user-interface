# Batalha Naval — implementação da interface Figma (fase 1)

Fonte: Figma `PHfipffDE6V0Dil3RGCzC6`; design mobile 1080 × 1920.

## Escopo
- Formulários de login/cadastro e lobby recebem a linguagem visual aprovada (Pirata One, Lexend, paleta de cores, componentes pílula).
- As ações de cadastro, login, criar sala privada, entrar por código, perfil, logout e navegação usam o fluxo e os handlers existentes.
- Nenhum endpoint novo, lib de frontend ou dado fictício de economia/progressão é introduzido.
- Ícones de navegação exportados diretamente das fontes do Figma.
- A branch arquivada da UI clássica permanece disponível.

## Pendências para fidelidade completa
- Exportar localmente o asset **Fundo Tempestade** e os outros elementos ilustrados do Figma (a integração atingiu o limite de chamadas).
- Afinar a composição visual comparando com capturas das telas de login e lobby em 360×800 e desktop.
- Implementar as demais telas por etapas mantendo a API autoritativa (sala, posicionamento, batalha, resultado, perfil e loja).
- O Figma mostra evento, XP, patente e moedas; essas informações ainda não são fornecidas pela API atual. Os cards usam rótulos explícitos de "em breve" e não inventam saldos nem estatísticas.
- Matchmaking público não foi criado: o botão Jogar abre o fluxo funcional de sala privada.

## Arquivos
- `src/prototype/app.js`: estrutura das telas sem trocar a lógica de eventos.
- `src/prototype/figma-v1.css`: novos tokens e regras de layout, carregados no final.
- `src/assets/figma/*`: ícones reais extraídos do arquivo do Figma.

## Validar antes de fazer merge
```sh
npm ci
npm run build
node tools/test-tidepoint.mjs
node tools/test-client.mjs
node tools/test-room-flow.mjs
```
Testar visualmente login, cadastro, lobby e abertura do modal da sala; depois confirmar uma partida com dois navegadores e API real.
