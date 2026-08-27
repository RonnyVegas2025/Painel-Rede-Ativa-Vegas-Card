# Painel Rede Vegas Ativa

Painel de operações de campo da rede credenciada Vegas Card.


## Ensaio de instalação limpa

```bash
npm run ensaio                                        # ~2 min, sem dados
ENSAIO_PLANILHA=/caminho/base.xlsx npm run ensaio -- --com-dados
```

Destrói os volumes, aplica todas as migrations sobre um banco virgem, confere os
invariantes de instalação limpa, roda a suíte inteira e — com `--com-dados` —
importa a planilha real **pelas telas**, conferindo as contagens.

**Rode no começo de cada sprint.** Trabalhar semanas sobre o mesmo volume esconde
defeitos: uma fixture passa por dado que já estava lá, um privilégio parece
declarado quando foi herdado do ambiente, uma lista de exceções descreve aquele
banco em vez do schema. Rodado três vezes na Sprint 1, encontrou coisa nas três —
inclusive 37 funções executáveis por `anon` que nenhuma revisão de código viu.

A planilha real **não** está no repositório: é dado de comércios credenciados.

## Como subir

```bash
npm install
cp .env.example .env.local

supabase start          # aplica migrations e seed
supabase status         # copie a anon key para .env.local

npm run db:types        # gera src/lib/supabase/database.types.ts
npm run dev
```

Primeiro acesso: crie o usuário no Studio (`http://127.0.0.1:54323`) e promova.

```sql
update public.profiles set role = 'gestor_master' where email = 'voce@vegas.local';
```

**O papel só vale no próximo token.** Encerre a sessão e entre de novo — o papel é
lido do JWT, não consultado a cada requisição (ADR 0005). `/diagnostico` mostra
quando o claim e o perfil divergem.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run check` | tipos, lint e testes |
| `npm run test` | Vitest: regras puras e paridade |
| `npm run db:reset` | recria o banco local com migrations e seed |
| `npm run db:test` | pgTAP: policies, constraints, funções |
| `npm run db:types` | regenera os tipos do banco |

Depois de qualquer migration, rode `npm run db:types`.

## Onde fica o quê

```
src/
├── app/                 rotas. Orquestram; não decidem regra de negócio.
├── features/<modulo>/   domínio: componentes, serviços, validações, hooks
├── components/          ui/, layout/, brand/ — não conhecem domínio
├── lib/
│   ├── business-rules/  funções puras. Não leem o banco: recebem por argumento.
│   ├── permissions/     espelho da matriz. Não é controle de acesso; a RLS é.
│   ├── settings/        único lugar que lê system_settings
│   └── supabase/        client, server, middleware, admin
├── constants/           valores e enums. Nunca importa de camadas acima.
├── types/               tipos compartilhados
└── styles/tokens.css    fonte canônica de tokens --vg-*
```

## Regras que não se negociam

- Nenhum número de parâmetro fixo em componente: tudo vem de `system_settings`.
- Permissão vive no banco. Esconder botão é conveniência de interface.
- `disponivel` não é status de visita: é a ausência de visita ativa.
- A marca pinta a interface; os status têm rampa de cor própria.
- Cor nunca é o único canal: ícone, forma e texto acompanham.
- Sem `any`.
- Hexadecimal só em `src/styles/tokens.css`. Verificado por teste.

## Padrões

Dois documentos governam o projeto: `PLATFORM-STANDARDS.md` traz as regras globais da
plataforma Vegas; `CLAUDE.md` traz as regras deste sistema. A norma visual completa está
em `docs/VEGAS-PLATFORM-UI-STANDARD.md` (versão 1.0), e o que ainda falta alinhar está
em `docs/ui-conformance.md`.

## Validação

`docs/setup-validation.md` traz o passo a passo de instalação e as 12 verificações
que comprovam que a fundação está de pé.

## Documentação

`CLAUDE.md` é a fonte de verdade. Decisões estruturais em `docs/decisions/`
(ADR 0001 a 0009). Fluxos de status em `docs/status-flows.md`, matriz completa em
`docs/permissions.md`, esquema em `docs/data-dictionary.md`.

## Pendente

Provedor de geocodificação e mapa (ADR 0006). Google está descartado; a avaliação
está entre Mapbox e MapLibre/OSM. **Bloqueia a Sprint 2.**
