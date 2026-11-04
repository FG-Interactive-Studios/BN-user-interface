# Batalha Naval | Inicializador grafico de PRs (Windows)

Interface grafica em Windows Forms (PowerShell 5.1 nativo). Nao exige framework, Python ou instalacao de interface adicional.

## Uso rapido

1. Instale **Git**, **Node.js 22+**, **Java 21** e **Docker Desktop**.
2. Tenha o repositorio **BN-API-Central** em uma pasta do computador. O front nao precisa estar clonado: o inicializador guarda um clone isolado em %LOCALAPPDATA%\BatalhaNavalLauncher\cache.
3. Abra tools/launcher/Iniciar-Batalha-Naval.cmd com duplo clique.
4. Clique em **Atualizar PRs** ou use a lista carregada automaticamente. Escolha main ou qualquer PR **aberta**, incluindo rascunhos, consultada ao vivo na API publica do GitHub.
5. Confira a pasta da API e marque **Iniciar PostgreSQL (Docker Compose)** caso queira que o inicializador faca isso.
6. Clique em **Iniciar esta versao**. O aplicativo abre terminais separados para API e Vite, acompanha readiness e pode abrir http://127.0.0.1:5173/.
7. Teste cadastro, login, sala e jogo normalmente. Para trocar de PR, clique em **Encerrar processos** antes de iniciar a proxima.

O frontend usa o proxy do Vite para /api e /ws, de modo que a autenticacao e o WebSocket locais funcionem quando a API esta ativa. A API roda com spring-boot.run.profiles=local e REALTIME_ALLOWED_ORIGINS definido somente para origins locais.

## Como o seletor funciona

O inicializador consulta:
GET https://api.github.com/repos/FG-Interactive-Studios/BN-user-interface/pulls?state=open

A cada atualizacao o aplicativo consulta novamente as PRs; nao existem PRs hardcoded no codigo. No momento de executar uma PR, o Git busca refs/pull/NUMERO/head, resolvendo o commit **atual** do GitHub. Para main, busca refs/heads/main.

Cada commit fica em uma pasta propria:
- %LOCALAPPDATA%\BatalhaNavalLauncher\cache\versions\main-SHA
- %LOCALAPPDATA%\BatalhaNavalLauncher\cache\versions\pr-NUMERO-SHA

Nao ha git checkout, git reset --hard, alteracao de main ou stashes no repositorio de trabalho do usuario. Nova versao gera outra pasta e reutiliza o cache de Git.

## Garantias e limites

- docker compose up -d **nao** executa down -v e nao apaga o volume PostgreSQL.
- O aplicativo apenas encerra os terminais que **ele proprio iniciou**. Se a API ja responde em localhost:8080/api/health, ela e reutilizada, nao reiniciada nem encerrada.
- Se a porta 5173 estiver em uso, a troca de versao e recusada. Feche a sessao anterior para nao testar a PR errada.
- Executar uma PR implica instalar dependencias e executar codigo daquela PR. Revise PRs de terceiros antes de testa-las.
- E necessario ter internet para obter a lista de PRs e baixar commits ou dependencias nao armazenados em cache.
- O aplicativo nao atualiza o backend para a branch correspondente; ele usa a pasta da API selecionada. Se uma PR altera o contrato backend, atualize essa API conscientemente.
- Tokens de autenticacao seguem apenas em memoria no navegador; atualizar a pagina pode pedir novo login.
- A API do GitHub tem limite de requisicoes sem autenticacao. Pode-se fornecer GITHUB_TOKEN por variavel de ambiente para elevar a cota; o app nao armazena nem solicita tokens.
- Windows PowerShell 5.1 e WinForms sao requisitos; nao suporta Linux/macOS nativamente.

## Diagnostico

- Verifique Git, Node.js, npm, Java 21 e Docker no PATH do Windows.
- Se preferir gerenciar PostgreSQL manualmente, desmarque a opcao Docker.
- O health check do backend e http://127.0.0.1:8080/api/health.
- Se uma API existente estiver rodando sem permitir http://127.0.0.1:5173 no WebSocket, reinicie a API com REALTIME_ALLOWED_ORIGINS apropriado.
- Os logs por sessao ficam em %LOCALAPPDATA%\BatalhaNavalLauncher\sessions (launcher.log e status.json).
- Em settings.json sao persistidos somente o caminho da API e preferencias visuais, nunca senhas ou credenciais.
- A GUI deixa os terminais ativos caso seja fechada; para encerra-los use o botao ou feche os terminais.

## Testes automatizados

Execute: node tools/test-launcher.mjs

O workflow launcher-validation.yml valida a sintaxe dos scripts com o parser do **Windows PowerShell 5.1** em Windows, sem abrir a GUI.
