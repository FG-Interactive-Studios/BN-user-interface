# Contrato de áudio — pacote padrão e extensões

Fontes: [GD #6](https://github.com/FG-Interactive-Studios/BN-GameDesign/issues/6), [#7](https://github.com/FG-Interactive-Studios/BN-GameDesign/issues/7), [#16](https://github.com/FG-Interactive-Studios/BN-GameDesign/issues/16), [#24](https://github.com/FG-Interactive-Studios/BN-GameDesign/issues/24), [#31](https://github.com/FG-Interactive-Studios/BN-GameDesign/issues/31).
Arquivos oficiais: [efeitos](https://drive.google.com/drive/folders/1vWTJid9zdA_qyjXkWQia-Ce2CEoWULL6), [músicas](https://drive.google.com/drive/folders/1_r37zE_eW4EZT1TQUG02OfC1zSSJDNpG).

## Integração

AudioManager, AudioEvents e audio-packs separam reprodução, extração de eventos e catálogo. A API continua autoritativa. O catálogo usa imports Vite de arquivos existentes; o manifesto não cria URLs para arquivos ausentes. O pacote padrão está especificado, mas os OGG oficiais ainda precisam ser importados e mapeados: **até isso ocorrer os eventos sem arquivo são silenciosos**. Não há sons artificiais na versão de jogo.

| Evento | Disparo | Canal |
| --- | --- | --- |
| lobby | Login/cadastro, lobby, menus e criação de sala | Música, loop |
| waiting_radar | Sala WAITING e posicionamento | Efeitos, loop |
| battle_music | Combate | Música, loop |
| match_start | Transição observada PREPARING para PLAYING | Efeito |
| shot | Novo disparo confirmado em snapshot (próprio ou recebido) | Efeito |
| hit / miss | Resultado confirmado, uma vez por tipo em ação com vários alvos | Efeito |
| ship_sunk | Afundamento confirmado | Efeito |
| victory / defeat | Transição para FINISHED com vencedor definido, perspectiva local | Efeito |
| ui_click | Botão de navegação/ação (não confirma ataque) | Efeito |
| your_turn | Turno passa ao jogador | Efeito |
| player_ready | Jogador se torna pronto | Efeito |
| ship_placement | Posição local aceita no rascunho, não confirmação do servidor | Efeito |
| ability_activation / ability_ID | Consumo confirmado do poder próprio, com fallback genérico | Efeito |
| attack_blocked | Tiro bloqueado confirmado | Efeito |
| disconnect / reconnect | Mudança de presença adversária em preparação/combate | Efeito |
| purchase_success | Compra aceita pela API | Efeito |

Os nove primeiros sons do escopo GD são lobby, waiting_radar, match_start, shot, hit, miss, ship_sunk, victory, defeat. battle_music e outros efeitos são extensões propostas; arquivos opcionais podem ficar ausentes. Em resultado não há loop; os jingles tocam uma vez. Lobby/loja/perfil compartilham loop, sem restart na renderização. Música e efeitos respeitam os toggles existentes; radar é efeito. Áudio pausado em aba oculta, e desbloqueado por gesto do usuário. Nenhuma ação sonora altera o jogo.

Não reproduz histórico ao carregar um match, nem ao receber revisão repetida/antiga. Saltos de revisão não reexecutam tiros; desfecho de partida conhecida pode ser ouvido. A API atual mantém o último registro por célula; múltiplas tentativas bloqueadas idênticas não são distinguíveis nessa estrutura. Não infere poderes secretos do oponente. A renderização conserva o efeito final entre match e result. O efeito de prontidão na transição direta para PREPARING pode não ocorrer: não há histórico de eventos de sala. Web Audio: carregamento sob demanda, um loop, fila limitada de efeitos, cache limitado para clips curtos; falha de arquivo/codec é tratada silenciosamente.

## Entrega de arquivos

`src/assets/audio/default/manifest.json` contém os slots e caminhos padronizados. Copie o áudio OGG Vorbis aprovado para o caminho correspondente, por exemplo `default/music/lobby.ogg` e `default/sfx/hit.ogg`. Nomes de arquivos ASCII minúsculos, sem espaços. Validar audição, loops sem emenda perceptível e volume coerente (sem clipping); evitar WAV em produção. Preferir efeitos curtos. Não adotar trilhas só pelo nome sem confirmação do GD.

## Pacotes de loja

IDs do manifesto devem ser iguais ao item SOUND da API (existentes: sound_default, sound_sonar, sound_deep). Exemplo opcional em `src/assets/audio/sonar/manifest.json`:

```json
{"id":"sound_sonar","version":1,"sounds":{"shot":"sfx/shot.ogg","hit":"sfx/hit.ogg"}}
```

Som ausente/falha no pacote equipado cai para o padrão; efeitos específicos de poderes podem cair para ability_activation. Para adicionar pacote, versionar arquivos + manifesto e cadastrar/ativar o item SOUND no backend depois da validação. Seleção usa apenas item equipado e possuído retornado pelo GET /api/store e pelas operações de compra/equipar. A loja mantém os adicionais indisponíveis nesta etapa. A política de quais slots comerciais serão permitidos ainda depende de GD; o motor não precisa ser modificado para adicionar pacotes. Áudio é cosmético e pessoal, sem vantagem competitiva. Não use URLs externas ou arquivos de usuário não validados em manifesto.

## Validação

`node tools/test-audio.mjs`: catálogo/fallback, estados, revisão, ciclo de vida e preferências com contexto de áudio simulado. `npm run build` verifica a integração Vite. Antes de liberar o pacote oficial, testar reprodução real, áudio móvel, autoplay após interação, troca de pacote e duas sessões ao mesmo tempo.
