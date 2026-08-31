# Contributing — Battleship Web

## Branches

Não altere a `main` diretamente.

Padrões:

```text
feature/<descricao>
fix/<descricao>
refactor/<descricao>
docs/<descricao>
```

Exemplos:

```text
feature/login-page
feature/game-board
fix/mobile-overflow
```

## Pull Requests

Cada PR deve:
- resolver um objetivo específico;
- evitar mudanças fora do escopo;
- passar no build;
- ser testado visualmente;
- explicar alterações relevantes.

Antes do PR:

```bash
npm run build
```

## Organização

Evite concentrar tudo em `main.ts`.

Separe responsabilidades em:
- `pages/`: telas/fluxos;
- `components/`: elementos reutilizáveis;
- `services/`: REST/WebSocket;
- `models/`: tipos e contratos;
- `state/`: estado compartilhado quando necessário;
- `styles/`: estilos globais e tokens.

## TypeScript

Prefira tipagem explícita nos contratos de comunicação.

Exemplo:

```ts
export interface ShotResult {
  x: number
  y: number
  result: 'HIT' | 'MISS' | 'SUNK'
}
```

Evite `any` sem necessidade.

## REST

Não espalhe `fetch()` em páginas e componentes.

Centralize chamadas em `services/`.

Não hardcode a URL do backend. Use:

```ts
import.meta.env.VITE_API_URL
```

## WebSocket

Centralize a conexão e o tratamento base do socket em `services/websocket.ts`.

Páginas/componentes podem reagir a eventos, mas não devem criar conexões independentes sem motivo.

## Regra de autoridade

O frontend não decide:
- acerto/erro;
- afundamento;
- turno;
- vitória;
- recompensa;
- estado secreto do oponente.

Ele renderiza o estado recebido do servidor.

## CSS e responsividade

O frontend é mobile-first.

Antes do PR, teste pelo menos:
- largura próxima a 360px;
- largura de tablet;
- desktop.

Evite:
- valores fixos que quebram telas pequenas;
- scroll horizontal;
- texto ilegível;
- áreas de clique pequenas.

Prefira Flexbox/Grid quando adequado.

## Design

Implemente os wireframes/decisões aprovadas pelo Game Design.

Não redesenhe fluxos importantes silenciosamente.

Quando um requisito visual estiver ambíguo, registre a dúvida antes de inventar comportamento.

## Dependências

Não adicione framework ou biblioteca sem necessidade clara.

Especialmente, não introduza por conta própria:
- React;
- Angular;
- Vue;
- bibliotecas de estado;
- bibliotecas CSS completas.

O MVP deve permanecer em Vanilla TypeScript + HTML/CSS.

## IA no desenvolvimento

IA é permitida e incentivada.

Regras:
- o autor é responsável pelo código;
- não faça merge de código que você não entende;
- peça ao agente para ler `AGENTS.md`;
- revise HTML, CSS e TypeScript gerados;
- valide responsividade manualmente;
- não aceite endpoints inventados pela IA.

## Checklist antes do PR

```text
[ ] npm run build passa
[ ] A tela funciona no navegador
[ ] Testado em viewport mobile
[ ] Testado em desktop
[ ] Sem URLs/secrets hardcoded
[ ] Sem dependências desnecessárias
[ ] Contratos com backend respeitados
[ ] Código gerado por IA foi revisado
```
