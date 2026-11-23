# Batalha Naval — Inicializador em Python

Uma interface gráfica para Windows que busca **automaticamente as PRs abertas** dos repositórios `BN-user-interface` e `BN-API-Central`, incluindo rascunhos, e permite executar diferentes combinações de frontend/backend sem atualizar o inicializador para cada PR nova.

> **Vai apenas jogar ou testar e não programa?** Siga o [guia passo a passo para testadores](../../docs/GUIA-PARA-TESTADORES.md). Ele explica a instalação e a execução sem comandos.

## Como começar

1. Instale **Python 3.10+** com Tkinter (incluso no instalador oficial do Windows), **Git**, **Node.js 22+**, **Java 21** e **Docker Desktop**. Não é necessário `pip install` nem PyInstaller para executar o código-fonte.
2. Extraia este ZIP em qualquer pasta.
3. Dê um duplo clique em **`Iniciar-Batalha-Naval.cmd`**. (Também pode executar `python gui.py`.)
4. Selecione a versão da interface e da API — `main` ou uma PR aberta. Clique em **Atualizar PRs** sempre que quiser consultar as novidades.
5. Escolha a pasta de downloads (padrão: `%LOCALAPPDATA%\BatalhaNavalLauncherPython\workspace`). Ela será criada automaticamente.
6. Escolha se deseja inicializar o Docker Desktop (quando necessário) e o PostgreSQL via Docker Compose. Clique em **Baixar e iniciar**.
7. O launcher instala as dependências do frontend com `npm ci` e inicia a API (`SPRING_PROFILES_ACTIVE=local` e `mvnw.cmd spring-boot:run`) e o Vite. Ao iniciar uma API própria com suporte ao bootstrap local, o inicializador mostra um cartão **Conta administrativa · teste local** com e-mail `admin@admin.com`, senha inicial `admin` e botão **Copiar acesso**. Abra `http://127.0.0.1:5173/` para entrar.
8. Para alternar entre PRs, use **Encerrar**, selecione a próxima e inicie novamente.

**Você não precisa clonar os repositórios nem informar a pasta do backend.** O launcher baixa os dois automaticamente e guarda cada commit em seu próprio diretório. **Baixar versões** permite preparar os arquivos sem ligar os serviços.

### Conta administrativa para testes locais

A conta inicial é criada **pela API**, somente com o perfil Spring `local` e somente se o banco ainda não tiver administrador. O inicializador apenas apresenta o e-mail e a senha **iniciais** previstos pelo bootstrap, sem validar nem alterar a senha e sem provocar um segundo login.

O cartão é mostrado **depois de API e frontend prontos**, somente quando o inicializador iniciou sua **própria API local** e reconheceu o bootstrap. Ele não aparece quando se reutiliza outra API ativa, quando o backend escolhido é uma versão anterior ou quando o bootstrap local foi desabilitado pelas variáveis `ADMIN_BOOTSTRAP_ENABLED` / `ADMIN_BOOTSTRAP_LOCAL_DEFAULT_ENABLED`.

Se o banco já tinha outro administrador, a conta padrão pode não ter sido criada; se a senha foi alterada, use a senha atual. O botão **Copiar acesso** copia as credenciais iniciais para a área de transferência. O inicializador não grava a senha em `settings.json` nem em `launcher.log`. **Nunca reutilize essas credenciais fracas em produção ou em um servidor público.**

## O que o launcher faz internamente

- Consulta `https://api.github.com/repos/FG-Interactive-Studios/BN-user-interface/pulls?state=open` e o endpoint equivalente da API. Não existem números de PR fixos.
- Busca `refs/pull/<número>/head` ou `refs/heads/main` por Git.
- Cria worktrees isoladas por repositório, PR e hash do commit. Se a PR mudar, é criada uma nova pasta; nada é sobrescrito.
- Usa o proxy do Vite para REST (`/api`) e WebSocket (`/ws`) em `localhost:8080`.
- Verifica **`docker info --format '{{.OSType}}'`** antes de inicializar o PostgreSQL; no Windows, se o daemon estiver desligado, tenta abrir o **Docker Desktop automaticamente** e aguarda o mecanismo Linux. Se estiver em modo Windows Containers, orienta a trocar de modo.
- Quando o container **`batalha-naval-postgres`** já existe, verifica se ele utiliza `postgres:17`, banco `battleship`, usuário `postgres` e porta local `5432`. Se for compatível, reutiliza-o (ou inicia o próprio container, caso esteja parado), evitando conflitos de nome. Executa uma consulta `SELECT 1` para validar o banco antes de iniciar a API. Se não for compatível, interrompe com orientação e **não altera nem remove** o container.
- Caso o container não exista, inicializa o PostgreSQL com **`docker compose up -d`**, sem apagar volumes com `down -v`.
- Usa o perfil `local` da API e as origens `http://localhost:5173,http://127.0.0.1:5173` para os WebSockets.
- Registra logs no diretório de downloads e permite encerrar apenas os processos iniciados por ele. O banco continua existindo.
- Salva escolhas e caminho local em `%LOCALAPPDATA%\BatalhaNavalLauncherPython\settings.json`, **sem credenciais**.

## Cuidados importantes

- Executar uma PR significa executar código daquela PR, incluindo scripts de instalação do npm e da API. **Confirme a origem e só execute código confiável.**
- Escolher uma PR de backend pode aplicar **migrações Flyway** ao banco local. Os volumes não são apagados, mas migrações podem modificar o schema; para comparações arriscadas, use uma base de teste separada.
- Se uma API estiver ativa na porta 8080, o launcher avisa. **Reutilizar API ativa** é opcional; nesse caso não é possível garantir qual branch está executando. Para testar exatamente a PR do backend escolhida, encerre a outra API primeiro.
- Se a porta 5173 estiver ocupada, o launcher não inicia um frontend diferente na mesma porta, evitando confusão.
- Se aparecer `container name is already in use`, não use `docker rm`, `docker compose down -v` nem apague volumes. Atualize o inicializador: ele identifica e reutiliza o container existente quando compatível. Para inspecionar manualmente, use `docker ps -a --filter name=batalha-naval-postgres`.
- Reutilizar um banco existente preserva os dados, mas a API selecionada pode aplicar **migrações Flyway**. Faça backup antes de testar versões do backend com schemas diferentes.
- O launcher executa `mvnw.cmd` e `npm.cmd` diretamente com a lista de argumentos, sem adicionar uma camada de aspas via `cmd /c`. Isso evita falhas quando o caminho local tem espaços, como `FG Interactive`. O perfil da API é definido pela variável de ambiente `SPRING_PROFILES_ACTIVE=local`.
- Se o backend levar um tempo para subir, acompanhe o log. A inicialização pode baixar dependências Maven na primeira vez.
- É preciso conexão com internet para consultar o GitHub ou baixar novos commits e dependências.
- O WebSocket e o login dependem da API estar disponível. A página de login isolada não fornece uma conta simulada.
- O executável `.cmd` usa Python instalado na máquina. Para distribuir um `.exe` sem exigir Python, é possível empacotar o `gui.py` com PyInstaller, mas essa é uma etapa opcional.

## Diagnóstico e testes

- Cheque `python --version`, `git --version`, `node --version`, `java -version` e `docker info`. Se `docker info` mencionar `dockerDesktopLinuxEngine` ou `//./pipe/`, o Docker Desktop não está disponibilizando o daemon Linux: abra o Docker Desktop e aguarde **Engine running**; verifique **Linux Containers / WSL 2**. O launcher também tenta abrir e aguardar automaticamente, sem apagar os volumes.
- Acesse `http://127.0.0.1:8080/api/health` para verificar a API e `http://127.0.0.1:5173/` para testar o frontend.
- Os logs ficam em `workspace/launcher.log`.
- Execute `python -m unittest discover -s tests -v` para validar descoberta de PRs, isolamento das worktrees e proteções de execução, sem conexão real ao GitHub.

### Limitações desta versão

A interface ainda precisa de um teste manual no Windows 11 com Docker, Java e Node instalados. Os testes automatizados validam a lógica e a sintaxe, mas não simulam uma partida multiplayer completa.