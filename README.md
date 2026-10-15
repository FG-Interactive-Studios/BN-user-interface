# Battleship Web

Frontend web responsivo do jogo de Batalha Naval multiplayer.

O projeto utiliza uma abordagem **mobile-first**, mas deve funcionar tanto em celular quanto em desktop.

## Stack

- Vite
- Vanilla TypeScript
- HTML5
- CSS3
- Fetch API
- WebSocket API nativa do navegador

Não utilizamos React, Angular ou Vue no MVP.

## Objetivo

O frontend é responsável por:
- telas;
- navegação;
- componentes visuais;
- atualização de estado;
- responsividade;
- consumo da API REST;
- conexão WebSocket;
- renderização do estado recebido do backend.

O frontend **não é autoridade das regras da partida**.

## Fluxo inicial do jogador

```text
Login / Cadastro
      ↓
Lobby
      ↓
Matchmaking
      ↓
Posicionamento
      ↓
Partida
      ↓
Resultado
      ↓
Lobby / Nova partida
```

Também haverá acesso à loja de cosméticos a partir do lobby.

## Estrutura recomendada

```text
src/
├── assets/
├── components/
├── pages/
│   ├── auth/
│   ├── lobby/
│   ├── matchmaking/
│   ├── placement/
│   ├── match/
│   ├── result/
│   └── store/
├── services/
│   ├── api.ts
│   └── websocket.ts
├── models/
├── state/
├── styles/
└── main.ts
```

A estrutura pode crescer conforme a necessidade. Não crie arquivos vazios apenas para “completar” pastas.

## Executando localmente

### Pré-requisitos

- Node.js LTS
- npm
- Git

### Instalação

```bash
npm install
```

### Desenvolvimento

```bash
npm run dev
```

O Vite normalmente disponibilizará o projeto em:

```text
http://localhost:5173
```

## Variáveis de ambiente

Crie um `.env` a partir de `.env.example`.

Exemplo:

```env
VITE_API_URL=http://localhost:8080/api
VITE_WS_URL=ws://localhost:8080/ws
```

> Não faça commit do `.env`.

## Comunicação com o backend

### REST

REST deve ser usado para operações como:
- autenticação;
- carregar perfil;
- loja;
- dados do lobby;
- histórico.

Centralize chamadas HTTP em `src/services`.

Evite espalhar URLs e `fetch()` pela UI.

### WebSocket

WebSocket será utilizado para matchmaking/partida em tempo real.

O frontend envia intenções e recebe eventos.

Exemplo conceitual:

```text
Frontend → FIRE
Backend  → SHOT_RESULT
Backend  → TURN_STARTED
Backend  → MATCH_FINISHED
```

Nunca calcule o resultado real de uma partida apenas no cliente.

## Estado e navegação

O MVP não utiliza framework SPA.

Mesmo assim, organize o projeto para:
- trocar telas sem recarregar o navegador;
- manter estado da aplicação;
- renderizar componentes conforme os dados mudam;
- evitar um `main.ts` gigantesco.

A implementação deve permanecer simples. Não crie um “React caseiro”.

## Responsividade

A interface deve seguir mobile-first.

Priorize:
- toque confortável;
- tabuleiro legível;
- botões grandes;
- ausência de scroll horizontal;
- layout adaptável para desktop.

## Scripts

```bash
npm run dev
npm run build
npm run preview
```

## Fluxo de desenvolvimento

1. Crie branch a partir da `main`.
2. Implemente uma feature por vez.
3. Teste em tela pequena e desktop.
4. Execute build.
5. Abra Pull Request.

Exemplo:

```bash
git checkout -b feature/lobby-page
```

Antes de contribuir, leia:
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [AGENTS.md](./AGENTS.md)

## Painel administrativo mínimo (temporário)

Acesse `/admin` (por exemplo, `http://localhost:5173/admin`) para entrar
com **e-mail e senha de uma conta administradora real**. O painel chama
`POST /api/auth/login`, lista modos registrados em
`GET /api/admin/game-modes` e envia
`PUT /api/admin/game-modes/{modeId}/availability` ao clicar no status
de um tabuleiro. O backend valida acesso `is_admin`, persiste as alterações
e impede desabilitar o último modo ativo. Um jogador comum recebe 403.

Esta tela **não altera o design das páginas do jogo**, que continuam
protótipos simulados até o Game Design aprovar o visual. A UI administrativa
usa estilos mínimos responsivos e não adiciona dependências.

Credenciais JWT/refresh são mantidas **somente em memória**; atualizar a
página exige novo login. Em caso de 401, a sessão é renovada uma vez
com o refresh token enquanto a página permanecer aberta.

### API no ambiente local

O `vite.config.ts` faz o proxy do caminho `/api` para
`http://localhost:8080` em **desenvolvimento**, sem CORS cruzado.
O `.env.example` agora sugere `VITE_API_URL=/api`.
Se algum `.env` preexistente definir URL absoluta,
ajuste-o para `/api` durante o desenvolvimento local.

Em produção (inclusive Firebase Hosting), o proxy do Vite **não existe**.
Para o painel funcionar fora do ambiente local, configure um
reverse proxy de `/api` ou uma URL explícita via `VITE_API_URL`,
com HTTPS e política CORS do backend adequada. O deploy de hospedagem
e a política cross-origin serão definidos separadamente.

A primeira conta admin é criada pela API na inicialização com um banco
sem administradores, mediante senha aleatória salva em arquivo protegido.
Veja a documentação da API sobre o bootstrap.


## WebSocket de desenvolvimento (Vite)

Durante o desenvolvimento local, o navegador deve usar o proxy do Vite:

- `VITE_API_URL=/api` (evite apontar para outra origem sem configurar CORS);
- `VITE_WS_URL` **não deve** ser definido (o frontend usa `ws://localhost:5173/ws`);
- `vite.config.ts` encaminha `/ws` para `http://localhost:8080`, valida a origem local e reescreve o cabeçalho `Origin` para a API Spring aceitar o upgrade WebSocket.

O Vite aplica isso apenas em modo de desenvolvimento. **Não use** a reescrita de `Origin` para um proxy público: ela enfraquece a verificação contra WebSocket cross-site. Em produção, use TLS, um reverse proxy configurado corretamente e `REALTIME_ALLOWED_ORIGINS` restrito aos domínios do frontend.

Para diagnosticar: em DevTools → Network → WS, o pedido a `/ws` precisa retornar **101 Switching Protocols** e permanecer aberto. Um `POST /api/realtime/ticket` com status 201 **não prova** que o WebSocket conectou. `BOTH_DISCONNECTED` é a consequência de dois prazos de 120s expirados sem presença WebSocket — requests REST não contam como conexão.

Com socket funcionando, os eventos disparam atualização de estado. Há ainda uma sincronização REST de segurança a cada 60 segundos enquanto online, ou a cada 20 segundos quando o socket está offline. Não recarregue a página durante a partida: tokens estão só em memória e o reload exigirá login novamente.
