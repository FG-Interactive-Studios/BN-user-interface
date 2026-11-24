# Demonstração: Batalha Naval mais divertida e economia virtual

A demo usa **apenas créditos de teste**. Não há cobrança, checkout, dinheiro real
nem venda de vantagens competitivas.

## Teste em dois jogadores

1. Execute o inicializador Python com **Interface: main** e **Backend: main**
   (ou selecione as PRs correspondentes enquanto estiverem abertas).
2. Entre com duas contas, em dois navegadores diferentes. Cada conta recebe
   300 créditos virtuais no primeiro uso da loja. O saldo é persistente.
3. Na **Loja**, selecione **Provocações**. A conta já possui o pack **Provocações
   Gratuitas**. Compre **Tio do Pavê Naval** por **90 créditos de teste**
   ou **Surto Marítimo** por **140 créditos**. Também há **Atendimento Naval**
   por **120 créditos** e **Almirante dos Memes** por **180 créditos**.
   Todos os cinco pacotes contêm **10 frases**, e o gratuito já vem equipado.
   Após comprar um pacote pago, clique em **Equipar**.
4. Inicie uma partida. Na tela de combate, abra **💬 Provocar** e escolha uma
   das dez frases disponíveis no pacote equipado. A frase será enviada ao outro jogador em
   tempo real via WebSocket. Apenas um pack **comprado e equipado** pode ser
   usado; não existe chat livre nem envio de frases arbitrárias.
5. Faça um disparo: acertos, erros e navios afundados podem exibir
   mensagens humorísticas e usar os sons já existentes.
6. Conclua a partida. O resultado resgata automaticamente uma recompensa de
   **60 créditos virtuais por vitória**, **25 por derrota** ou **30 por empate**.
   O resgate é ligado ao ID real da partida, validado pelo servidor e nunca
   credita duas vezes pelo mesmo resultado.
7. Volte à loja para conferir o saldo atualizado; faça outra compra ou solicite
   **revanche** para continuar jogando.

### Limites
- Não permite comprar créditos com dinheiro real.
- A moeda premium continua separada e não é gerada por esse piloto.
- Compras de sons/capitães/frotas ainda em DRAFT continuam bloqueadas.
- Frases não dão vantagens táticas e são limitadas a uma a cada cinco segundos
  por jogador, durante uma partida em andamento.
- Os balões são temporários e dependem de conexão em tempo real para aparecer
  no adversário; uma desconexão não guarda mensagens antigas para replay.
- O Tiro do Desespero e eventos que alteram regras ainda **não** foram
  implementados, pois exigem decisão e balanceamento do Game Design.
