# Matriz de permissões

Papéis: `gestor_master` (GM) · `administrativo` (ADM) · `supervisor_rede` (SUP) ·
`consultor_campo` (CON) · `suporte_tecnico` (SUP.T) · `comercial` (COM) · `consulta` (CSL)

Legenda: **L** leitura · **E** escrita · **—** sem acesso · **P** parcial (escopo abaixo)

## Sprint 0

| Tabela | GM | ADM | SUP | CON | SUP.T | COM | CSL |
|---|---|---|---|---|---|---|---|
| `profiles` | L E | L | P L | P L | P L | P L | P L |
| `teams` | L E | L | L | L | L | L | L |
| `card_products` | L E | L E | L | L | L | L | L |
| `segments` | L E | L E | L | L | L | L | L |
| `product_segments` | L E | L E | L | L | L | L | L |
| `system_settings` | L E | L P | L | L | L | L | L |
| `audit_logs` | L | L | — | — | — | — | — |

Escopos parciais:
- `profiles`: cada usuário lê e edita o próprio registro (nome e telefone; nunca o próprio
  papel). `SUP` lê também os perfis da sua equipe.
- `system_settings`: cada chave tem `min_role`. `ADM` altera as chaves marcadas como
  administrativas; parâmetros estruturais ficam com `GM`.
- `audit_logs`: ninguém tem `update` nem `delete`. `insert` só pela função de trigger.
- `profiles.role`, `profiles.team_id` e `profiles.is_active`: alteráveis apenas por `GM`,
  garantido pela trigger `fn_protect_profile_fields`, não por policy — policy de `update`
  não distingue coluna. Sem a trigger, qualquer usuário se promoveria editando o próprio
  perfil.

  **A tela de gestão de usuários terá que promover papel com o JWT do gestor master, e
  não com `service_role`.** A trigger decide por `auth_role()`, e o token de
  `service_role` não carrega `user_role`: `auth_role()` cai para `consulta` e a operação
  é recusada. É comportamento pretendido — `service_role` ignora RLS, e promoção por ele
  transformaria qualquer descuido de rota em escalada de privilégio. Detalhe e
  verificação no ADR 0005, seção Consequências.

## Sprint 1 — implementada

| Tabela | GM | ADM | SUP | CON | SUP.T | COM | CSL |
|---|---|---|---|---|---|---|---|
| `establishments` | L E | L E | L | L | L | L | L |
| `establishment_addresses` | L E | L E | L | L | L | L | L |
| `establishment_capture_points` | L E | L E | L | L | L | L | L |
| `capture_methods` | L E | L E | L | L | L | L | L |
| `import_jobs` | L E | L E | — | — | — | — | — |
| `import_rows` | L E | L E | — | — | — | — | — |
| `absence_resolutions` | L E | L E | — | — | — | — | — |

"Gestão" nas policies é `is_admin()` — `gestor_master` ou `administrativo`. As três tabelas
de importação não são legíveis pelos demais papéis porque `raw_data` guarda telefone, e-mail
e razão social de terceiros.

Nenhuma tabela da Sprint 1 tem policy de `DELETE`, para papel nenhum. Registro ausente vai
para análise administrativa; não some.

**`import_rows` e `absence_resolutions` não têm `UPDATE` útil.** Ambas têm trigger de
imutabilidade: em `import_rows` só `establishment_id` muda, e só de nulo para valor;
`absence_resolutions` não muda nada. Evidência que a aplicação pode reescrever não é
evidência.

### O caminho de escrita da importação passa pela RLS

A prévia grava `import_rows` com o **cliente do usuário**, não com `service_role`. A policy
de `insert` é escopada ao próprio job, em `processando`:

```
is_admin()
and exists (select 1 from import_jobs j
             where j.id = import_id
               and j.status = 'processando'
               and j.uploaded_by = (select auth.uid()))
```

Sem o escopo, a policy diria "gestão pode inserir linhas" sem dizer **em qual job** — e um
operador contaminaria a prévia do outro. Com `service_role`, a RLS não seria avaliada e a
verificação de papel dentro da RPC não protegeria a inserção que acontece um andar acima.

### Privilégio de execução de função

Estabelecido pela migration 0047, e verificado pelo pgTAP `05`:

| Papel | Funções em `public` |
|---|---|
| `anon` | **nenhuma** |
| `authenticated` | apenas as declaradas, uma a uma, com razão registrada |
| `supabase_auth_admin` | apenas `custom_access_token_hook` |

O ambiente concede mais do que qualquer migration escreve: `pg_default_acl` dava `EXECUTE`
em `public` a `anon`, `authenticated` e `service_role`, e `revoke ... from public` nunca
remove concessão a papel nomeado. Eram 37 funções alcançáveis por `anon`. A correção é
declarar o default, revogar em massa e conceder uma a uma — não catalogar.

Nenhuma função de trigger é executável por papel de aplicação. Gravador de auditoria
chamável à mão não é auditoria.

## Sprints seguintes — intenção registrada

| Recurso | GM | ADM | SUP | CON | SUP.T | COM | CSL |
|---|---|---|---|---|---|---|---|
| `field_actions` | L E | L | L E | P L | — | — | L |
| `visits` | L | L | P L E | P L E | — | — | L |
| `visit_attachments` (fotos) | L | L | P L | P L E | P L | **—** | — |
| `consultant_locations` | L | — | P L | P L | — | **—** | — |
| `incidents` | L | L E | P L | P L E | P L E | **—** | L |
| `block_requests` | L | L E | L | P L E | — | **—** | — |
| Aprovar bloqueio | ✓ | ✓ | — | **—** | — | — | — |
| Transferir reserva | ✓ | — | ✓ | — | — | — | — |
| Exceção de check-in | ✓ | — | ✓ | solicita | — | — | — |
| Indicadores agregados | ✓ | ✓ | ✓ | próprios | — | ✓ | ✓ |

Escopos: `CON` acessa apenas ações às quais foi vinculado e visitas de sua autoria.
`SUP` acessa a sua equipe. `SUP.T` acessa apenas ocorrências de categoria técnica.

## O que o comercial nunca vê

Localização de consultor · fotos e evidências · observações internas · ocorrências
sensíveis · solicitações de bloqueio · auditoria · ações administrativas.

O comercial enxerga a rede como cobertura: quantos pontos aptos por cidade, por modalidade e
por segmento. Isso é implementado como **view agregada com `security_invoker`**, não como
leitura filtrada da tabela operacional — é mais difícil vazar um campo por engano quando o
campo não está na view.

## Consulta

Somente leitura. Nenhuma policy de `insert`, `update` ou `delete` em nenhuma tabela.
Não reserva, não conclui visita, não aprova, não bloqueia.

## Princípio

A permissão vive no banco. Esconder o botão é conveniência de interface, nunca controle de
acesso. Toda linha desta matriz tem um teste pgTAP correspondente que assume o papel e
verifica que a operação proibida falha.
