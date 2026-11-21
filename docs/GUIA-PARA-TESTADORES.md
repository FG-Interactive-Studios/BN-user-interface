# 🚢 Batalha Naval — Guia simples para instalar e testar

**Para Windows 10/11 · Atualizado em 21/11/2026**

Você **não precisa saber programar**, usar terminal nem baixar o código manualmente. Temos uma ferramenta que baixa e executa o jogo para você.

**➡️ [CLIQUE AQUI PARA BAIXAR O INICIALIZADOR (ZIP)](https://github.com/FG-Interactive-Studios/BN-user-interface/archive/refs/heads/main.zip)**

> ⚠️ O jogo está em desenvolvimento. É normal encontrar erros: precisamos da sua ajuda para identificá-los.

## 1. Prepare o computador (apenas na primeira vez)

Instale os programas abaixo. Se algum deles já estiver instalado na versão necessária, pode pular esse item.

| Programa | Download oficial | Para que serve |
| --- | --- | --- |
| **Python 3.10 ou superior** | [Baixar Python](https://www.python.org/downloads/windows/) | Abre a ferramenta do jogo. |
| **Git para Windows** | [Baixar Git](https://git-scm.com/install/win) | Baixa as versões do jogo. |
| **Node.js 22 ou superior** | [Baixar Node.js](https://nodejs.org/en/download/) | Executa a interface. |
| **Java JDK 21** | [Baixar Java (Temurin)](https://adoptium.net/temurin/releases/?version=21&os=windows&arch=x64&package=jdk) | Executa o servidor (API). Escolha **JDK 21**, não apenas JRE. |
| **Docker Desktop** | [Baixar Docker](https://docs.docker.com/desktop/setup/install/windows-install/) | Executa o banco de dados. |

**Na instalação:** siga as opções recomendadas. Se existir a opção **Add to PATH / Adicionar ao PATH**, marque-a. Reinicie o Windows se for solicitado.

**No Docker:** abra o Docker Desktop e aguarde a indicação **Engine running**. Caso apareça um pedido para configurar **WSL 2**, siga o que o programa mostrar. O modo de containers deve ser **Linux**.

> Se o Windows ou o antivírus sinalizar um problema, peça ajuda à equipe. Não é necessário desativar a proteção do computador.

## 2. Baixe e abra a ferramenta

1. Clique no link **BAIXAR O INICIALIZADOR (ZIP)** no começo deste guia.
2. Encontre o arquivo ZIP na pasta **Downloads** do Windows.
3. Clique com o botão direito no ZIP e escolha **Extrair tudo**.
4. Abra as pastas **BN-user-interface-main → tools → launcher-python**.
5. Dê **dois cliques** em **Iniciar-Batalha-Naval.cmd**.
6. Uma janela escura chamada **Batalha Naval · Inicializador de PRs** deve aparecer.

**Importante:** extraia o ZIP antes de dar dois cliques no arquivo. Não tente executar a ferramenta de dentro do ZIP.

O inicializador baixa automaticamente tanto a interface quanto a API. **Você não precisa clonar os repositórios.**

## 3. Inicie o jogo

Na janela do inicializador:

1. Em **INTERFACE · BN-user-interface**, deixe **main — versão principal**.
2. Em **BACKEND · BN-API-Central**, deixe **main — versão principal**.
3. Em **PASTA DE DOWNLOADS E EXECUÇÃO**, mantenha a pasta sugerida.
4. Deixe marcadas **Iniciar Docker e PostgreSQL** e **Abrir jogo no navegador**.
5. Deixe **Reutilizar API já ativa** desmarcado (a menos que a equipe oriente o contrário).
6. Clique em **▶ Baixar e iniciar**.
7. Acompanhe as mensagens em **LOGS DE EXECUÇÃO**. Na primeira vez, o programa precisa baixar arquivos e dependências.
8. Quando aparecer **API e jogo prontos**, o navegador deverá abrir automaticamente. Se não abrir, clique em **Abrir jogo ↗**.

**Endereço do jogo:** http://127.0.0.1:5173/

**Atenção:** esse endereço só funciona no computador em que você abriu o inicializador. Ele não é um servidor público na internet.

## 4. Teste o jogo

1. Crie uma conta de teste ou faça login.
2. Explore o lobby e as telas do jogo.
3. Tente criar ou entrar em uma sala, marcar pronto, posicionar os navios e jogar.
4. Experimente também a loja, o perfil, as configurações e o resultado da partida.
5. Se algo travar, não responder ou parecer estranho, anote o que aconteceu.

### Como testar com dois jogadores no mesmo computador

Para testar uma partida multiplayer com **duas contas diferentes**:

1. Abra http://127.0.0.1:5173/ em uma janela normal do navegador.
2. Abra uma janela **anônima/privativa** e acesse o mesmo endereço.
3. Entre com **uma conta diferente em cada janela**.
4. Use as duas janelas para entrar na mesma sala e jogar.

**Importante:** iniciar o jogo em **dois computadores separados não conecta os dois jogadores entre si**, pois cada um estará usando a própria API local. Para jogar de computadores diferentes é necessário que a equipe disponibilize um servidor compartilhado.

## 5. Para que servem os botões?

| Botão | O que faz |
| --- | --- |
| **↻ Atualizar PRs** | Atualiza a lista de versões em desenvolvimento do GitHub. |
| **↓ Baixar versões** | Baixa os arquivos, **sem iniciar** o jogo. |
| **▶ Baixar e iniciar** | Baixa o que falta e inicia o jogo. |
| **Abrir jogo ↗** | Abre a página do jogo no navegador. |
| **■ Encerrar** | Encerra os processos iniciados pela ferramenta, sem apagar o banco. |

**Sobre as versões:** para os testes normais, escolha **main** nos dois campos. Uma **PR** é uma versão experimental; selecione outra apenas se a equipe pedir.

**Ao terminar os testes**, clique em **Encerrar** no inicializador. Para trocar de versão, encerre primeiro a versão que estiver rodando.

## 6. Se algo der errado

**A janela fecha ou aparece “Python não encontrado”.** Verifique se instalou Python 3.10 ou superior. Reinicie o computador e tente abrir **Iniciar-Batalha-Naval.cmd** novamente.

**Aparece “Git”, “Node/npm” ou “Java” não encontrado.** Volte à seção 1, instale o programa indicado e reinicie o Windows se necessário.

**Erro com Docker ou PostgreSQL.** Abra o **Docker Desktop** e espere **Engine running**, com containers Linux / WSL 2. Não apague containers nem volumes.

**O jogo não abre, fica carregando ou não faz login.** Veja se o inicializador exibiu **API e jogo prontos**. Caso sim, clique em **Abrir jogo ↗**. Caso não, observe o erro mostrado nos logs.

**Porta 5173 ou 8080 ocupada.** Pode existir outra execução do jogo ou da API aberta. Encerre-a. Não ative **Reutilizar API já ativa** sem orientação.

**Problema ao baixar ou listar versões.** Confira a internet e clique em **Atualizar PRs**. Se continuar, tire um print e envie para a equipe.

### Onde ficam os logs?

Na pasta indicada em **PASTA DE DOWNLOADS E EXECUÇÃO**, procure o arquivo **launcher.log**. Ele ajuda a equipe a identificar o que deu errado. Não envie senhas nem dados pessoais.

## 7. Como reportar bugs

Quando encontrar um problema, copie e preencha este modelo com o que souber:

> **🐛 BUG — Batalha Naval**
>
> **O que eu estava fazendo:** (ex.: tentando entrar numa sala)
>
> **O que aconteceu:** (ex.: a tela travou)
>
> **O que eu esperava:** (ex.: entrar na sala)
>
> **Como repetir:** (ex.: login → criar sala → entrar)
>
> **Versão da interface:** main ou PR #...
>
> **Versão da API:** main ou PR #...
>
> **Navegador:** Chrome / Edge / Firefox / outro
>
> **Anexos:** print, vídeo ou trecho do launcher.log, se possível.

Você **não precisa descobrir por que deu erro**. Basta explicar o que tentou fazer e mostrar o que aconteceu.

## 8. Checklist de testes

- [ ] Abri o inicializador e consegui iniciar o jogo.
- [ ] Criei uma conta e fiz login.
- [ ] Entrei no lobby.
- [ ] Criei ou entrei em uma sala e marquei pronto.
- [ ] Posicionei os navios.
- [ ] Testei ataques, turnos e a tela de resultado.
- [ ] Abri a loja, o perfil e as configurações.
- [ ] Testei a interface com uma janela menor.
- [ ] Registrei e reportei as dificuldades e os bugs.

---

Para detalhes técnicos, consulte a [documentação do inicializador em Python](../tools/launcher-python/README.md).

**Segurança:** só execute PRs experimentais quando a equipe orientar. Elas podem executar scripts e alterar o banco local de testes.
