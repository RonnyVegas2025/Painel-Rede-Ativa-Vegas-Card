# ADR 0012 — Privilégio de tabela é declarado, não herdado

- **Status:** aceito
- **Data:** 2026-08-24

## Contexto

As migrations 0001 a 0010 escreveram RLS em toda tabela operacional e **nunca
concederam privilégio de tabela** a `anon`, `authenticated` ou `service_role`.

Passou despercebido porque as imagens antigas do Supabase concediam DML por
`alter default privileges` no schema `public`. As atuais não concedem. O ACL
efetivo passou a ser `{anon=Dxt, authenticated=Dxt, service_role=Dxt}` — TRUNCATE,
REFERENCES e TRIGGER, e nenhum SELECT, INSERT ou UPDATE.

Encontrado na validação da Sprint 0, com o banco no ar. Quatro consequências:

1. Toda chamada à API respondia `42501 permission denied`, para qualquer papel,
   gestor master incluído. A aplicação inteira inoperante.
2. As policies da 0009 eram código morto: o GRANT nega antes de a RLS ser
   avaliada.
3. **Os testes de segurança passavam pelo motivo errado.** Confirmar que o
   consultor *não* altera parâmetro fica verde quando ninguém altera coisa
   alguma. Recusa por indisponibilidade se parece com recusa por política.
4. `anon` recebia TRUNCATE, que ignora RLS e apagaria `audit_logs`.

## Decisão

**Privilégio de tabela é declarado neste repositório, não herdado do ambiente.**

Herdar tornava o modelo de segurança dependente da versão da imagem: a mesma
migration produzindo permissão diferente em máquinas diferentes, com o sintoma
aparecendo longe da causa.

- `0011` concede, tabela a tabela, exatamente os comandos que têm policy.
  Privilégio sem policy é superfície sem guarda; policy sem privilégio é regra que
  nunca roda.
- `0014` e `0015` declaram o **privilégio padrão do schema**, para que tabela nova
  nasça correta. A `0015` emite a cláusula para `current_user` em vez de um papel
  fixo: `alter default privileges` vale por papel criador, e supor que o ambiente
  hospedado aplica as migrations como `postgres` é o tipo de premissa que este
  projeto já pagou caro para descobrir errada.
- `anon` não recebe nada, por ausência deliberada. Nenhuma tela abre sem sessão.

## O teste é peça estrutural, não conveniência

`supabase/tests/05_grants_and_rls.sql` varre o schema inteiro sem citar nome de
tabela nem de papel. **Enfraquecê-lo reabre uma escalada de privilégio**, e isso
não é hipótese.

`alter default privileges ... on tables` cobre tabelas **e views** no PostgreSQL.
Não há como conceder DML por padrão a tabela sem conceder a view. Ou seja: toda
view nova do schema nasce com privilégio de escrita, e a única coisa entre isso e
uma escalada são as asserções daquele arquivo.

Já aconteceu. `segment_normalization_queue` nasceu assim, e um `consultor_campo`
inseriu uma linha em `public.segments` com um `POST` na view, contornando a policy
que exige `is_admin()`. A view era auto-atualizável e, sem `security_invoker`,
rodava com privilégio do dono, ignorando a RLS. Corrigido na `0025`.

A causa-raiz **continua de pé**: não dá para desligar o padrão só para views. O
teste é o que segura.

### O que a varredura cobre, e por que cada caso é diferente

| `relkind` | Tratamento |
|---|---|
| `r` tabela · `p` particionada | RLS obrigatória, sem TRUNCATE, sem privilégio a `anon`, policy com grant correspondente |
| `v` view | `security_invoker` obrigatório, escrita proibida |
| `m` materializada | **proibida** — matview não suporta RLS de forma nenhuma; é vazamento por construção |
| `f` estrangeira | **proibida** — se aparecer, é integração montada fora do desenho |

Particionada importa e chega: `transaction_hourly_metrics` é particionada por mês
no desenho da Sprint 8. A RLS se declara no **pai**, e uma varredura que só olhe
`'r'` verifica as partições e ignora exatamente onde a política vive.

## Consequências

- Toda tabela nova nasce com DML para `authenticated` e `service_role`, e a
  fronteira passa a ser inteiramente a policy. Tabela sem RLS deixa de ser
  incompleta e passa a ser **aberta** — daí a asserção de RLS obrigatória.
- Toda view nova nasce com escrita e precisa de `security_invoker` e revoke
  explícitos, na própria migration que a cria.
- Enfraquecer `05_grants_and_rls.sql` é mudança de segurança, não de teste.
