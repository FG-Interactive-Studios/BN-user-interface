# TidePoint — integração do protótipo com a API

Esta implementação adapta o protótipo entregue pelo Game Design à API atual.
Não altera endpoints Java nem adiciona bibliotecas no frontend.

## Implementado

- Login, cadastro e refresh token **rotativo** em memória; logout.
- Perfil privado, atualização de nickname/avatar e senha.
- Catálogo de modos habilitados (`GET /api/game-modes`).
- Sala privada: criação, entrada com código, prontidão e saída.
- Preparação: frota aleatória no servidor, edição manual para geometria
  retangular, validação/salvamento/confirmacão via API.
- Batalha: tiro real por coordenadas, turno autoritativo, acerto/água,
  embarcação identificada **apenas após afundar**, vitória, derrota e abandono.
- Renderização das células do modo pela geometria e `tiles` devolvidos pela
  API. Polígonos funcionam para hexágonos/triângulos, inclusive na batalha.
- WebSocket autenticado com ticket efêmero e protocolos `battleship.v1` e
  `bn-ticket.<ticket>`. Ao receber notificação/reconectar, recupera o estado
  via REST. O WebSocket não transmite comandos de partida.
- Mantém `/admin` com o painel pré-existente, carregando CSS isoladamente.

## Fora do escopo porque não existe contrato implementado na API

- Matchmaking público/rankeado, recompensas, economia, compras, loja, skins
  equipáveis, sons comprados, estatísticas persistentes, poderes e debuffs.
  As telas reservam o espaço, mas **não simulam saldos nem resultados**.
- Persistência de sessão no navegador. É intencional manter tokens apenas em
  memória: F5 exige novo login. Uma atualização da página durante a partida
  não encerra o jogo; faça login novamente e o frontend recuperará a sala.
- Histórico de partidas depois de ambos dispensarem o resultado.

## Desenvolvimento local

Requisitos: Java 21, Docker Desktop, Node.js 22+, npm e Git.

1. Banco: `docker compose up -d` dentro de `BN-API-Central`.
2. API: `mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=local`.
3. Permitir origin do Vite no WebSocket local:
   `REALTIME_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`.
4. Frontend: `npm ci` e `npm run dev` dentro de `BN-user-interface`.
5. No frontend use `VITE_API_URL=/api` e `VITE_WS_URL=ws://localhost:5173/ws`.
   `vite.config.ts` contém ambos os proxies de desenvolvimento.
6. Jogo: `http://localhost:5173`; administração: `http://localhost:5173/admin`.

O executável `Testar-TidePoint.bat` incluído no pacote aplica essas
configurações temporárias ao processo local e abre os serviços, sem tocar no
banco existente ou no Git.

**Teste multiplayer:** abra dois navegadores/perfis separados, faça cadastro
em cada um, crie uma sala em um e entre pelo código no outro. Marque ambos
prontos; gere e confirme as frotas; então dispare nos turnos indicados.
O mesmo jogador não pode manter duas sessões independentes simultâneas.

## Validação local

```
node tools/test-tidepoint.mjs
node tools/test-client.mjs
node tools/test-screen.mjs
npm ci
npm run build
```

## Segurança e limites

- O servidor decide identidade, turno, impacto do disparo, vencedor e permissão.
- Não enviamos `userId`, código de lobby ou token por WebSocket nem credenciais
  nos logs.
- Dados de jogador escapados antes de montar o HTML para evitar injeção.
- Os lobbies/partidas ainda estão em memória na API e se perdem ao reiniciá-la.
- O servidor precisa permitir explicitamente a origem WebSocket do Vite.
- Em produção será necessário configurar HTTPS/WSS, endpoint API acessível e
  controle CORS (ou proxy reverso na mesma origem).

## Ajustes de interface e sessão (V2)

- **Sessão**: renovação antecipada do JWT antes de 15 minutos, um refresh
  rotativo de cada vez e retentativa de requests quando outra chamada
  já atualizou o token. O refresh permanece somente em memória.
- **Performance**: `reconcile()` só renderiza novamente se houver alterações
  reais de estado; clicar num alvo modifica somente a célula/indicadores
  relacionados, sem substituir os ~100 botões do tabuleiro.
- **Layout**: CSS complementar `tidepoint-fixes.css` após o protótipo,
  corrigindo containers responsivos, grade quadrada no Chrome, navios
  desabilitados com opacidade explícita, inteligência inimiga e botões
  de implantação menores. Telas longas podem rolar verticalmente.
- **Avisos**: toast fixo fora do fluxo, não desloca a página.
- **Radar**: animação/contatos do protótipo original no lobby e na sala privada,
  respeitando `prefers-reduced-motion`.
- **Perfil**: botão voltar e troca de nickname/avatar sem revogar
  a sessão; a API define e mantém a autorização.
- **Homologação**: testes unitários locais e testes visuais em Chromium headless
  com fetch simulado em 1366×637 e 390×844. Fluxo real com duas
  sessões e PostgreSQL precisa ser homologado no ambiente local.
