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
| Básico | 3 classes, versões originais/destruídas | Confirmar mapeamento de 5 classes e orientações |
| Corsário / pasta PacoteMarinha | 3 classes, intactas/destruídas, imagem de pacote; capitão WebP em 3 estados | Confirmar associação temática e cobertura |
| Futurista / espacial | 3 sprites de naves e 3 destruídos, banner; capitães PNG | Mapear classes/tamanhos, separar variantes e converter |
| Pirata | 3 sprites intactos | Estados destruídos, banner, cobertura |
| Magnata | 2 imagens JPEG compostas | Sprites individuais e estados |
| Zumbi | Tema mencionado no GDD | Entrega de sprites não identificada nas pastas consultadas |
| Sonar Retrô e Mar Profundo | Registros SOUND beta existentes | Novos OGGs dos oito eventos aprovados |

Fontes: [GD #4](https://github.com/FG-Interactive-Studios/BN-GameDesign/issues/4), [#25](https://github.com/FG-Interactive-Studios/BN-GameDesign/issues/25), [#26](https://github.com/FG-Interactive-Studios/BN-GameDesign/issues/26), [#10](https://github.com/FG-Interactive-Studios/BN-GameDesign/issues/10), [#31](https://github.com/FG-Interactive-Studios/BN-GameDesign/issues/31), [GDD](https://docs.google.com/document/d/1FaZL_fbkirnFMeqXpmaEBfSZla3ko9VJ/edit), [recursos visuais](https://drive.google.com/drive/folders/19FgYnEWfBG45y7rRgGL2Jlm9odi5onJ_).

## Manifestos visuais (etapa implementada)
`src/assets/cosmetics/<id>/manifest.json` é um contrato de preparação. IDs correspondem a IDs de produtos individuais quando cadastrados; os novos IDs são propostas técnicas. `draft` não representa produto vendável. `ready` significa que os campos de assets estão presentes; não concede direito, nem habilita compra automaticamente.

Frota: cinco classes (CARRIER 5, BATTLESHIP 4, CRUISER 3, SUBMARINE 3, DESTROYER 2); cada uma contém sprite intacto e afundado. Uma orientação horizontal canônica para tabuleiro quadrado, com rotação para vertical no renderer. Sprites com transparência em WebP; banner em WebP ou JPEG. Podemos reaproveitar a mesma arte para mais de uma classe **apenas se GD aprovar a correspondência e a proporção**. A interface mantém marcadores e contornos atuais, não expõe navios inimigos e não renderiza a skin como alteração de ocupação. Geometrias experimentais usam fallback atual até homologação. Capitão: neutral, hit, damage, de acordo com os estados autorizados pela API; não deduzir informações secretas.

Os manifestos draft registram origens verificadas e slots vazios, sem chutar correspondência. Nenhuma imagem nova foi importada nesta etapa. O validador no CI exige caminhos locais, formato válido, slots completos e arquivos reais para passar a ready. Não substitui inspeção de transparência, proporção, orientação e teste visual.

## Próximas entregas
1. GD: completar/mapear sprites da frota atual, confirmar capitães e banners e aprovar quais temas terão efeitos de áudio.
2. Front: importar os arquivos, resolvedor de frotas/capitães com fallback, renderização própria em placement/combate e prévia na loja/equipe/perfil, sem vazar posição inimiga.
3. API: categoria CAPTAIN, concessão/equipamento de itens, autorização de avatar; cadastrar skins/sons reais após validação, mantendo compras e saldo antigos.
4. Coleções temáticas: somente após itens individuais funcionarem, definir preço, comportamento de compra parcial/itens repetidos, moeda e transação. Sem pagamento real nesta fase.
5. QA: validar aquisição/recusa de item não entregue, re-login, equipar/desquipar, dois jogadores, orientação, skins de terceiros sem vazamento, fallback e responsividade.

Validação técnica: `node tools/validate-asset-packs.mjs`, `node tools/test-asset-packs.mjs`, build e CI. A validação de conteúdo não altera a disponibilidade dos produtos no servidor.
