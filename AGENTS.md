# AGENTS.md — Battleship Web

## Missão

Você está trabalhando no frontend web de um jogo de Batalha Naval multiplayer.

O objetivo é manter a aplicação simples, responsiva, modular e fácil de entender.

Antes de modificar código:
1. leia este arquivo;
2. leia `README.md`;
3. leia `CONTRIBUTING.md`;
4. inspecione o código existente;
5. não invente requisitos de UX nem contratos de backend.

## Stack obrigatória

- Vite
- Vanilla TypeScript
- HTML5
- CSS3
- Fetch API
- WebSocket nativo do navegador

Não introduza React, Angular, Vue ou outro framework sem solicitação explícita.

## Princípios

- mobile-first;
- sem reload completo entre etapas do fluxo quando desnecessário;
- TypeScript tipado;
- código simples;
- componentes reutilizáveis apenas quando houver reutilização real;
- serviços de rede centralizados;
- backend como autoridade da partida.

## Estrutura

Preferencial:

```text
src/
├── assets/
├── components/
├── pages/
├── services/
├── models/
├── state/
├── styles/
└── main.ts
```

Não transforme `main.ts` em um arquivo monolítico.

Não crie abstrações prematuras.

## Navegação e telas

Fluxo principal:

```text
auth
→ lobby
→ matchmaking
→ placement
→ match
→ result
```

A loja é acessada a partir do lobby.

A implementação pode usar funções/controladores simples para trocar a tela renderizada. Não crie um framework de roteamento próprio complexo.

## Estado

Mantenha apenas o estado necessário no cliente.

Exemplos:
- usuário logado;
- saldo exibido;
- tela atual;
- id da partida;
- estado visual conhecido da partida.

Não tente manter uma cópia “mais verdadeira” que o backend.

## API REST

Centralize chamadas em `services/api.ts` ou arquivos especializados.

Use:

```ts
import.meta.env.VITE_API_URL
```

Não hardcode hosts/portas nas páginas.

Defina tipos para requests/responses importantes.

## WebSocket

Centralize a conexão em `services/websocket.ts`.

Responsabilidades desejadas:
- conectar;
- desconectar;
- enviar eventos;
- receber eventos;
- encaminhar eventos para a camada apropriada;
- evitar listeners duplicados.

Não abra múltiplos sockets sem justificativa.

## Multiplayer

O cliente envia intenção, por exemplo:

```text
FIRE
PLAYER_READY
PLACE_SHIP
```

O servidor responde com o resultado real.

Nunca:
- revele navios adversários não descobertos;
- determine vitória no cliente como fonte de verdade;
- avance turno sem confirmação do servidor;
- gere recompensa localmente.

## CSS

Use abordagem mobile-first.

Prefira:
- Flexbox;
- CSS Grid;
- unidades responsivas;
- variáveis CSS para tokens de design;
- classes semânticas.

Evite estilos inline em grande escala.

O tabuleiro deve permanecer utilizável em telas pequenas.

## Design

Siga wireframes e decisões aprovadas.

Não altere por iniciativa própria:
- fluxo do jogador;
- quantidade de etapas;
- posicionamento de ações críticas;
- regras de feedback da partida.

Se faltar definição, sinalize a ambiguidade.

## Dependências

Antes de adicionar um pacote npm:
1. verifique se a Web Platform resolve;
2. explique por que a dependência é necessária;
3. prefira a solução mais simples.

## Segurança

- não armazene secrets no frontend;
- não considere dados do cliente confiáveis;
- sanitize/escape conteúdo dinâmico quando necessário;
- não injete HTML externo sem validação.

## Estilo de trabalho

Antes de implementar:
1. indique os arquivos que serão alterados;
2. preserve o escopo;
3. faça a menor mudança funcional;
4. rode `npm run build`;
5. teste o comportamento no navegador;
6. reporte alterações e limitações.

Evite refatorar áreas não relacionadas.

## Definição de pronto

A tarefa não está pronta se:
- o build falha;
- quebra mobile;
- viola contrato do backend;
- adiciona dependência desnecessária;
- deixa listeners/conexões duplicados;
- o autor humano não entende o código.

Código gerado por IA deve ser compreensível e revisável pelo responsável humano.
