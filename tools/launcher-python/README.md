# Batalha Naval — Inicializador em Python

Uma interface gráfica para Windows que busca **automaticamente as PRs abertas** dos repositórios `BN-user-interface` e `BN-API-Central`, incluindo rascunhos, e permite executar diferentes combinações de frontend/backend sem atualizar o inicializador para cada PR nova.

## Como começar

1. Instale **Python 3.10+** com Tkinter (incluso no instalador oficial do Windows), **Git**, **Node.js 22+**, **Java 21** e **Docker Desktop**. Não é necessário `pip install` nem PyInstaller para executar o código-fonte.
2. Extraia este ZIP em qualquer pasta.
3. Dê um duplo clique em **`Iniciar-Batalha-Naval.cmd`**. (Também pode executar `python gui.py`.)
4. Selecione a versão da interface e da API — `main` ou uma PR aberta. Clique em **Atualizar PRs** sempre que quiser consultar as novidades.
5. Escolha a pasta de downloads (padrão: `%LOCALAPPDATA%\BatalhaNavalLauncherPython\workspace`). Ela será criada automaticamente.
6. Escolha se deseja inicializar o PostgreSQL via Docker Compose. Clique em **Baixar e iniciar**.
7. O launcher instala as dependências do frontend com `npm ci` e inicia a API (`mvnw.cmd ... -Dspring-boot.run.profiles=local`) e o Vite. Abra `http://127.0.0.1:5173/` e faça cadastro/login normalmente.
8. Para alternar entre PRs, use **Encerrar**, selecione a próxima e inicie novamente.

**Você não precisa clonar os repositórios nem informar a pasta do backend.** O launcher baixa os dois automaticamente e guarda cada commit em seu próprio diretório. **Baixar versões** permite preparar os arquivos sem ligar os serviços.

## O que o launcher faz internamente

- Consulta `https://api.github.com/repos/FG-Interactive-Studios/BN-user-interface/pulls?state=open` e o endpoint equivalente da API. Não existem números de PR fixos.
- Busca `refs/pull/<número>/head` ou `refs/heads/main` por Git.
- Cria worktrees isoladas por repositório, PR e hash do commit. Se a PR mudar, é criada uma nova pasta; nada é sobrescrito.
- Usa o proxy do Vite para REST (`/api`) e WebSocket (`/ws`) em `localhost:8080`.
- Inicializa o PostgreSQL com **`docker compose up -d`** e **não apaga** o volume com `down -v`.
- Usa o perfil `local` da API e as origens `http://localhost:5173,http://127.0.0.1:5173` para os WebSockets.
- Registra logs no diretório de downloads e permite encerrar apenas os processos iniciados por ele. O banco continua existindo.
- Salva escolhas e caminho local em `%LOCALAPPDATA%\BatalhaNavalLauncherPython\settings.json`, **sem credenciais**.

## Cuidados importantes

- Executar uma PR significa executar código daquela PR, incluindo scripts de instalação do npm e da API. **Confirme a origem e só execute código confiável.**
- Escolher uma PR de backend pode aplicar **migrações Flyway** ao banco local. Os volumes não são apagados, mas migrações podem modificar o schema; para comparações arriscadas, use uma base de teste separada.
- Se uma API estiver ativa na porta 8080, o launcher avisa. **Reutilizar API ativa** é opcional; nesse caso não é possível garantir qual branch está executando. Para testar exatamente a PR do backend escolhida, encerre a outra API primeiro.
- Se a porta 5173 estiver ocupada, o launcher não inicia um frontend diferente na mesma porta, evitando confusão.
- Se o backend levar um tempo para subir, acompanhe o log. A inicialização pode baixar dependências Maven na primeira vez.
- É preciso conexão com internet para consultar o GitHub ou baixar novos commits e dependências.
- O WebSocket e o login dependem da API estar disponível. A página de login isolada não fornece uma conta simulada.
- O executável `.cmd` usa Python instalado na máquina. Para distribuir um `.exe` sem exigir Python, é possível empacotar o `gui.py` com PyInstaller, mas essa é uma etapa opcional.

## Diagnóstico e testes

- Cheque `python --version`, `git --version`, `node --version`, `java -version` e `docker info`.
- Acesse `http://127.0.0.1:8080/api/health` para verificar a API e `http://127.0.0.1:5173/` para testar o frontend.
- Os logs ficam em `workspace/launcher.log`.
- Execute `python -m unittest discover -s tests -v` para validar descoberta de PRs, isolamento das worktrees e proteções de execução, sem conexão real ao GitHub.

### Limitações desta versão

A interface ainda precisa de um teste manual no Windows 11 com Docker, Java e Node instalados. Os testes automatizados validam a lógica e a sintaxe, mas não simulam uma partida multiplayer completa.