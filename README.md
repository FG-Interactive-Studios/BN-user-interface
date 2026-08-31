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
