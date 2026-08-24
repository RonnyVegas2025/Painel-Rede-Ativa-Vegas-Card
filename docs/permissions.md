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

## Sprints seguintes — intenção registrada

| Recurso | GM | ADM | SUP | CON | SUP.T | COM | CSL |
|---|---|---|---|---|---|---|---|
| `establishments` | L E | L E | L | L | L | L | L |
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
