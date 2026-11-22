# Pacotes de assets e produtos cosméticos — proposta de contrato

## Contexto
A loja MVP da API já possui catálogo, créditos de teste, compra atômica, inventário e um item equipado por categoria SKIN/SOUND. Não alteramos a economia, os itens existentes, as permissões ou a renderização nesta etapa. O pacote de áudio padrão mantém seu próprio contrato em [audio-packs.md](audio-packs.md).

Diferenciar:
- **Pacote de assets**: conteúdo versionado e validado (sprites, estados de avatar ou efeitos sonoros).
- **Produto**: registro do servidor que define preço, disponibilidade e direito adquirido. Nunca confiar no manifesto do frontend para esses atributos.
- **Coleção** (proposta futura): produto que concede atomicamente vários itens de categorias diferentes. Não se equipa a coleção: equipa-se cada componente. A coleção não muda regras nem permite comprar poderes.

## Categorias e inventário
| Categoria técnica | Equipamento | Situação |
| --- | --- | --- |
| FLEET (API SKIN) | Uma aparência de frota | CSS original, Coral e Abissal existentes; sprites em preparação |
| SOUND | Um pacote dos oito efeitos comercializáveis | Motor pronto; padrão gratuito, extras indisponíveis |
| CAPTAIN | Um capitão/estados de expressão | Contrato visual apenas; requer categoria de inventário e validação de propriedade pela API |
| COLLECTION | Concessão de itens, sem equipamento próprio | Proposta; requer regra de preço, itens já possuídos e compra transacional |

Não liberar capitães pagos por meio da edição livre de avatarId; primeiro a API deve validar propriedade, sem regressão de avatares gratuitos atuais. Não transformar IDs de skin em classes de embarcação ou alterar suas geometrias. Novos produtos ficam indisponíveis até o recurso e a integração funcional estarem validados. Não substituir Coral/Abissal já adquiridos nesta migração. Não alterar preços ou moedas sem aprovação específica; o GDD apresenta valores e economia diferentes dos créditos de teste atuais.

## Inventário de entregas do GD (21/11/2026)
| Tema | Material localizado | Pendência |
| --- | --- | --- |
| Básico | 3 classes, versões originais/destruídas | Confirmar identificação das artes de 1, 2 e 5 casas e orientações |
| Corsário / pasta PacoteMarinha | 3 classes, intactas/destruídas, imagem de pacote; capitão WebP em 3 estados | Confirmar identificação de Nau, Caravela e Galeão por classe |
| Futurista / espacial | 3 sprites de naves e 3 destruídos, banner; capitães PNG | Mapear classes/tamanhos, separar variantes e converter |
| Pirata | 3 sprites intactos | Estados destruídos, banner, cobertura |
| Magnata | 2 imagens JPEG compostas | Sprites individuais e estados |
| Zumbi | Tema mencionado no GDD | Entrega de sprites não identificada nas pastas consultadas |
| Sonar Retrô e Mar Profundo | Registros SOUND beta existentes | Novos OGGs dos oito eventos aprovados |

Fontes: [GD #4](https://github.com/FG-Interactive-Studios/BN-GameDesign/issues/4), [#25](https://github.com/FG-Interactive-Studios/BN-GameDesign/issues/25), [#26](https://github.com/FG-Interactive-Studios/BN-GameDesign/issues/26), [#10](https://github.com/FG-Interactive-Studios/BN-GameDesign/issues/10), [#31](https://github.com/FG-Interactive-Studios/BN-GameDesign/issues/31), [GDD](https://docs.google.com/document/d/1FaZL_fbkirnFMeqXpmaEBfSZla3ko9VJ/edit), [recursos visuais](https://drive.google.com/drive/folders/19FgYnEWfBG45y7rRgGL2Jlm9odi5onJ_).

## Manifestos visuais (etapa implementada)
`src/assets/cosmetics/<id>/manifest.json` é um contrato de preparação. IDs correspondem a IDs de produtos individuais quando cadastrados; os novos IDs são propostas técnicas. `draft` não representa produto vendável. `ready` significa que os campos de assets estão presentes; não concede direito, nem habilita compra automaticamente.

Frota: três classes conforme [GDD v1.2, seção 2.1](https://docs.google.com/document/d/1FaZL_fbkirnFMeqXpmaEBfSZla3ko9VJ/edit) e [GD #9](https://github.com/FG-Interactive-Studios/BN-GameDesign/issues/9#issuecomment-6997453001): embarcação de busca (SEARCH, 1 casa), contratorpedeiro (DESTROYER, 2 casas) e porta-aviões (CARRIER, 5 casas). Cada uma contém sprite intacto e afundado. SEARCH é identificador técnico proposto, não uma regra adicional. O GDD define três embarcações por jogador em 8×8, mas não explicita se classes repetidas são permitidas; a composição válida continua não marcada em GD #9. A frota provisória de cinco classes da API não é requisito para assets. A adequação das regras da API é uma entrega separada; até lá, o renderer legado não deve exigir artes para classes não especificadas pelo GD. Uma orientação horizontal canônica para tabuleiro quadrado, com rotação para vertical no renderer. Sprites com transparência em WebP; banner em WebP ou JPEG. Não exigir novas artes para as cinco classes provisórias; utilizar os três sprites definidos pelo GD e confirmar sua correspondência sem supor a classe pelo nome do arquivo. A interface mantém marcadores e contornos atuais, não expõe navios inimigos e não renderiza a skin como alteração de ocupação. Geometrias experimentais usam fallback atual até homologação. Capitão: neutral, hit, damage, de acordo com os estados autorizados pela API; não deduzir informações secretas.

Os manifestos draft registram origens verificadas e slots vazios, sem chutar correspondência. Nenhuma imagem nova foi importada nesta etapa. O validador no CI exige caminhos locais, formato válido, slots completos e arquivos reais para passar a ready. Não substitui inspeção de transparência, proporção, orientação e teste visual.

## Próximas entregas
1. GD: confirmar a correspondência dos sprites às três classes do GDD, capitães e banners; completar apenas assets realmente ausentes e confirmar a regra de repetição/composição.
2. Front: importar os arquivos, resolvedor de frotas/capitães com fallback, renderização própria em placement/combate e prévia na loja/equipe/perfil, sem vazar posição inimiga.
3. API: adequar os modos e a seleção/validação de frota às regras do GDD, em PR própria, preservando os modos existentes até definir a transição; categoria CAPTAIN, concessão/equipamento de itens, autorização de avatar; cadastrar skins/sons reais após validação, mantendo compras e saldo antigos.
4. Coleções temáticas: somente após itens individuais funcionarem, definir preço, comportamento de compra parcial/itens repetidos, moeda e transação. Sem pagamento real nesta fase.
5. QA: validar aquisição/recusa de item não entregue, re-login, equipar/desquipar, dois jogadores, orientação, skins de terceiros sem vazamento, fallback e responsividade.

Validação técnica: `node tools/validate-asset-packs.mjs`, `node tools/test-asset-packs.mjs`, build e CI. A validação de conteúdo não altera a disponibilidade dos produtos no servidor.


## Registro automático na loja

A API [PR #22](https://github.com/FG-Interactive-Studios/BN-API-Central/pull/22) mantém uma definição versionada de produtos no próprio backend. A migration V9 e o runner registram os itens e coleções ao iniciar a API, sem aceitar preço ou disponibilidade vindos de manifestos deste repositório. As frotas e capitães ainda estão `draft`; seus cards aparecem em **Em breve**, sem compra ou equipamento até a homologação. A loja reconhece as categorias `SKIN`, `SOUND`, `CAPTAIN` e `BUNDLE`, mas apenas SKIN e SOUND estão operacionais. Os arquivos de asset propriamente ditos seguem pendentes de integração. O pacote padrão e os seis produtos já cadastrados na V7 permanecem intactos.
