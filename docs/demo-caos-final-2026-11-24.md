# Demonstração Caos Naval — PRs de validação (24/11/2026)

As alterações desta etapa ficam **apenas nas PRs**, não na `main`.

- Interface: FG-Interactive-Studios/BN-user-interface **PR #27**
- API: FG-Interactive-Studios/BN-API-Central **PR #30**
- Inicializador Python: selecione estas duas PRs no lugar de main.

## Roteiro rápido com duas contas

1. Inicie duas sessões, faça login e entre numa mesma partida pública ou privada.
2. Veja as frases engraçadas temporárias após **acertar**, **errar**, **afundar** ou ter um ataque **bloqueado**. A seleção é a partir dos eventos de batalha confirmados pelo servidor, não por resultados simulados.
3. Na primeira vez que for seu turno, aperte **🎲 REZA**, ao lado de **ATIRAR**.
   Confirme o uso: o servidor escolhe uma casa ainda não atingida efetivamente,
   registra um **tiro normal** e avança o turno conforme a regra do modo.
   Não há segundo uso pela mesma pessoa, e a ação não revela navios não acertados.
4. Após o uso, confira que o botão fica desabilitado. Na nova partida/revanche,
   ele volta a ficar disponível para ambos, independentemente do resultado anterior.
5. Termine a partida. O painel de **Resumo** mostra um **Prêmio Ridículo**
   derivado apenas das estatísticas realmente registradas; clique em **⧉** para
   copiar o título e compartilhar. O título não altera pontuação nem dinheiro.
6. Observe uma comemoração curta com emojis/confetes CSS na vitória, empate ou
   derrota (animada somente na primeira entrada do resultado).
   Para quem prefere movimento reduzido, não há animação.
7. Teste no telefone em 320 × 568 e no desktop. A tela não deve ter scroll.

## Regras e limites

- Novo recurso sujeito a **validação de Game Design antes do merge**:
  Aperta e Reza é um único disparo comum sorteado pelo servidor por jogador/partida.
  Não custa moedas, não concede acertos garantidos e não modifica o inventário.
- Nenhum asset novo, pagamentos reais ou novas classes de navio foram introduzidos.
- Se a partida acabou, está pausada ou não é seu turno, a API recusa a ação
  e o uso não é consumido.
- A seleção aleatória inclui somente casas válidas da geometria do modo e
  ignora casas que já receberam disparos efetivos. Tentativas anteriormente
  bloqueadas por escudo podem ser sorteadas novamente, conforme as regras do jogo.
- O backend envia somente os snapshots por jogador e mantém oculta a frota
  adversária que ainda não foi atingida.
- Os Prêmios Ridículos são apenas títulos temporários daquele resultado;
  não são itens persistentes compráveis nesta etapa.
