# Contrato de áudio — pacote padrão e extensões

Fontes: [GD #6](https://github.com/FG-Interactive-Studios/BN-GameDesign/issues/6), [#7](https://github.com/FG-Interactive-Studios/BN-GameDesign/issues/7), [#16](https://github.com/FG-Interactive-Studios/BN-GameDesign/issues/16), [#24](https://github.com/FG-Interactive-Studios/BN-GameDesign/issues/24), [#31](https://github.com/FG-Interactive-Studios/BN-GameDesign/issues/31).
Arquivos oficiais: [efeitos](https://drive.google.com/drive/folders/1vWTJid9zdA_qyjXkWQia-Ce2CEoWULL6), [músicas](https://drive.google.com/drive/folders/1_r37zE_eW4EZT1TQUG02OfC1zSSJDNpG).

## Integração

AudioManager, AudioEvents e audio-packs separam reprodução, extração de eventos e catálogo. A API continua autoritativa. O catálogo usa imports Vite de arquivos existentes; o manifesto não cria URLs para arquivos ausentes. O pacote padrão inclui os 15 arquivos OGG Vorbis oficiais, importados das pastas do GD. Consulte [roteiro de uso](https://docs.google.com/document/d/1vbL_11du98aO5ieMyKxQDCmXriaCv13reQFpx9eSo4k/edit). Eventos adicionais sem arquivo permanecem silenciosos. O pacote padrão conserva os áudios oficiais; o Sonar Retrô contém quatro efeitos sintetizados aprovados na demonstração.

| Evento | Disparo | Canal |
| --- | --- | --- |
| lobby | Login/cadastro, lobby, menus e criação de sala | Música, loop |
| waiting_radar | Sala WAITING | Efeitos, loop |
| positioning_music | Posicionamento | Música, loop |
| victory_music / defeat_music | Tela de resultado, conforme vencedor | Música, loop |
| game_found | Segundo jogador entra na sala; convidado após confirmação da entrada | Efeito |
| ui_transition | Navegação entre telas (exceto entradas de preparação, combate e resultado) | Efeito |
| battle_music | Combate | Música, loop |
| match_start | Transição observada PREPARING para PLAYING | Efeito |
| shot | Novo disparo confirmado em snapshot (próprio ou recebido) | Efeito |
| hit / miss | Resultado confirmado, uma vez por tipo em ação com vários alvos | Efeito |
| ship_sunk_enemy / ship_sunk_ally | Afundamento confirmado, conforme perspectiva | Efeito |
| ship_sunk | Fallback genérico opcional para afundamento | Efeito |
| victory / defeat | Transição para FINISHED com vencedor definido, perspectiva local | Efeito |
| ui_click | Botão de navegação/ação (não confirma ataque) | Efeito |
| your_turn | Turno passa ao jogador | Efeito |
| player_ready | Jogador se torna pronto | Efeito |
| ship_placement | Posição local aceita no rascunho, não confirmação do servidor | Efeito |
| ability_activation / ability_ID | Consumo confirmado do poder próprio, com fallback genérico | Efeito |
| attack_blocked | Tiro bloqueado confirmado | Efeito |
| disconnect / reconnect | Mudança de presença adversária em preparação/combate | Efeito |
| purchase_success | Compra aceita pela API | Efeito |

O GD entregou lobby, posicionamento, combate, vitória e derrota como músicas, e dez efeitos: radar, partida encontrada, clique, transição, acerto, erro, afundamento aliado/inimigo e os dois jingles. Não há arquivo separado para lançamento do tiro (shot) ou início efetivo do combate (match_start), nem para os poderes; os respectivos slots permanecem opcionais e silenciosos. No resultado a trilha corresponde ao vencedor e os jingles tocam uma vez. Lobby/loja/perfil compartilham loop, sem restart na renderização. Música e efeitos respeitam os toggles existentes; radar é efeito. Áudio pausado em aba oculta, e desbloqueado por gesto do usuário. Nenhuma ação sonora altera o jogo.

Não reproduz histórico ao carregar um match, nem ao receber revisão repetida/antiga. Saltos de revisão não reexecutam tiros; desfecho de partida conhecida pode ser ouvido. A API atual mantém o último registro por célula; múltiplas tentativas bloqueadas idênticas não são distinguíveis nessa estrutura. Não infere poderes secretos do oponente. A renderização conserva o efeito final entre match e result. Prontidão é reconhecida também na transição WAITING → PREPARING quando a mudança aparece no snapshot. Não há histórico de eventos de sala. Mídia HTML: um loop reproduzido sob demanda por elemento de áudio reutilizável, sem decodificar músicas longas em memória. Web Audio: fila limitada de efeitos de combate e cache limitado para clips curtos; cliques/transições independentes da fila. Falha de arquivo/codec é tratada silenciosamente.

## Entrega de arquivos

`src/assets/audio/default/manifest.json` contém os slots e caminhos padronizados; os 15 OGGs de GD estão presentes (32 kHz, mono ou estéreo original, sem reconversão). Para extensões, copie o áudio OGG Vorbis aprovado para o caminho correspondente, por exemplo `default/music/lobby.ogg` e `default/sfx/hit.ogg`. Nomes de arquivos ASCII minúsculos, sem espaços. Validar audição, loops sem emenda perceptível e volume coerente (sem clipping); evitar WAV em produção. Preferir efeitos curtos. Não adotar trilhas só pelo nome sem confirmação do GD.

## Pacotes de loja

IDs do manifesto devem ser iguais ao item SOUND da API (existentes: sound_default, sound_sonar, sound_deep, sound_pirate). Exemplo opcional em `src/assets/audio/sonar/manifest.json`:

```json
{"id":"sound_sonar","version":1,"sounds":{"shot":"sfx/shot.ogg","hit":"sfx/hit.ogg"}}
```

### Política comercial aprovada pelo líder de desenvolvimento (21/11/2026)

Somente os oito eventos abaixo têm `customizable: true` no catálogo:

| Evento | Personalização |
| --- | --- |
| match_start | Início efetivo do combate |
| shot | Disparo |
| hit | Acerto |
| miss | Tiro na água |
| ship_sunk_enemy | Afundamento inimigo |
| ship_sunk_ally | Afundamento aliado |
| victory | Jingle de vitória |
| defeat | Jingle de derrota |

Todas as músicas (incluindo combate e resultado), radar de espera, partida encontrada, interface, avisos, poderes e demais efeitos ficam fixos no pacote padrão. O fallback genérico `ship_sunk` também pertence ao padrão; ofereça os dois afundamentos específicos no pacote comercial. Eventos novos são fixos por padrão até aprovação explícita. A política vale tanto para a leitura do manifesto quanto para o resolvedor de reprodução; arquivos de slots fixos em outros pacotes são ignorados. Não se usa o manifesto para escolher quais slots são comercializáveis.

Os slots `shot` e `match_start` ainda não têm OGGs próprios no pacote oficial. São personalizáveis, mas permanecem silenciosos no padrão até receberem arquivos do GD. Pacotes parciais são permitidos; som ausente/falha cai para o padrão. Efeitos específicos de poderes podem cair para `ability_activation`, ambos exclusivos do padrão.

Para adicionar pacote, versionar arquivos + manifesto e cadastrar/ativar o item SOUND no backend depois da validação. Seleção usa apenas item equipado e possuído retornado pelo GET /api/store e pelas operações de compra/equipar. Sonar Retrô (`sound_sonar`) está disponível com quatro efeitos OGG aprovados (acerto, água, afundamento aliado e inimigo). Os outros eventos conservam o fallback padrão. Canhões Piratas (`sound_pirate`) contém os seis efeitos V3 aprovados: disparo, água, acerto, afundamentos aliado/inimigo e vitória. Créditos e licenças em `src/assets/audio/pirate/CREDITOS.txt`. Mar Profundo e os protótipos Futurista e Caótico permanecem indisponíveis. Áudio é cosmético e pessoal, sem vantagem competitiva; as indicações críticas continuam visíveis independentemente da configuração sonora. Não use URLs externas ou arquivos de usuário não validados em manifesto.

## Validação

`node tools/test-audio.mjs`: catálogo/fallback, estados, revisão, ciclo de vida e preferências com contexto de áudio simulado. `npm run build` verifica a integração Vite. Antes de liberar o pacote oficial, testar reprodução real, áudio móvel, autoplay após interação, troca de pacote e duas sessões ao mesmo tempo.
