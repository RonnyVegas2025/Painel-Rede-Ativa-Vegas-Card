# ADR 0009 — Modelo conceitual do domínio

- **Status:** aceito
- **Data:** 2026-08-02

## Contexto
As decisões dos ADRs 0001 a 0008 foram tomadas separadamente. Falta o mapa que mostra como
elas se encaixam, e onde ficam as fronteiras que não podem ser cruzadas.

## Modelo

```
   USUÁRIO                          CATÁLOGO
   ───────                          ────────
   profiles                         card_products ──┐
      │ role (JWT, ADR 0005)          eligibility_mode
      │                                             │ product_segments
   teams                                            │ unique(produto, segmento)
      │ supervisor                                  │ ADR 0003
      │                              segments ──────┘
      │                                 │ source_name (planilha)
      │                                 │
      │                                 ▼
      │                          PONTO CREDENCIADO
      │                          ─────────────────
      │                          establishments
      │                            id externo (contrato) — ADR 0001
      │                            cnpj = atributo, não chave
      │                            registration_status
      │                            operational_status
      │                             │        │        │
      │        ┌────────────────────┘        │        └──────────────┐
      │        ▼                             ▼                       ▼
      │  establishment_addresses    establishment_transactions   geocoding_queue
      │    is_current, histórico      last_transaction_at          ADR 0006
      │                               → transaction_status
      │                                 (derivado, nunca gravado)
      │
      ▼
   AÇÃO DE CAMPO                    VISITA
   ─────────────                    ──────
   field_actions                    visits ◄──── 1 ativa por establishment
      │ card_product_id               status (sem "disponivel")      ADR 0002
      │ cidade, período                │ expires_at, override_reason
      │                                │
   field_action_members                ├── visit_checklist
      │ consultor ↔ ação               ├── visit_attachments (Storage privado)
      │                                └── visit_actions ──► N field_actions
      │                                       ▲
      └───────────────────────────────────────┘
                                     UMA visita atende VÁRIAS ações

   OCORRÊNCIA                       BLOQUEIO                    TRAVESSIA
   ──────────                       ────────                    ─────────
   incidents                        block_requests              audit_logs
     occurrence_status                solicitado por CON          toda mudança crítica
     origem: visita ou manual         decidido por ADM/GM         sem update, sem delete
     ▲                                │
     └────────────────────────────────┘                        system_settings
       resultado crítico gera                                     parâmetro, não constante
       ocorrência automaticamente                                 nenhum número no código
```

## As fronteiras

**Catálogo × Ponto credenciado.** O segmento pertence ao ponto. A elegibilidade é calculada,
nunca gravada — se fosse coluna, mudar a regra de um produto exigiria reprocessar a base
inteira e a coluna mentiria no intervalo.

**Ponto credenciado × Visita.** A exclusividade vive aqui, e é global. `visits` não tem
`action_id`; a ligação com ação é `visit_actions`. Essa é a estrutura que permite resolver
Farmácia e Vegas Day numa ida só.

**Ação × Visita.** Ação é recorte de trabalho: produto, cidade, período, equipe. Visita é
evento no mundo. Uma não contém a outra; elas se cruzam em `visit_actions`.

**Consultor × Decisão.** O consultor observa e solicita. Ele nunca bloqueia, nunca aprova,
nunca suspende. `block_requests` existe para tornar essa separação estrutural em vez de
apenas contratual.

**Status.** Cinco dimensões, cinco perguntas diferentes. Cadastral: o cadastro está regular?
Transacional: está faturando? Operacional: está funcionando? Visita: alguém está lá agora?
Ocorrência: há tratamento em andamento? Um campo `status` só responderia mal a todas.

## O que é derivado e nunca gravado
- `transaction_status` — depende de `system_settings`, que muda.
- Elegibilidade — depende de `eligibility_mode` e `product_segments`, que mudam.
- `disponivel` — é a ausência de visita ativa.
- Cor do marcador — é a precedência do ADR 0004 aplicada às cinco dimensões.

Gravar qualquer um destes cria a mesma classe de bug: o dado fica correto no instante da
escrita e passa a mentir depois, sem sinal nenhum.

## Cardinalidades
| Relação | Card. | Observação |
|---|---|---|
| card_products ↔ segments | N:N | via `product_segments`, `unique(produto, segmento)` |
| establishments → segment | N:1 | segmento vem da planilha |
| establishments → addresses | 1:N | histórico, `is_current` |
| establishments → visits | 1:N | **apenas 1 ativa** |
| visits ↔ field_actions | N:N | via `visit_actions` |
| visits → attachments | 1:N | Storage privado, signed URL |
| establishments → incidents | 1:N | |
| incidents → block_requests | 1:0..1 | |
| profiles → teams | N:1 | |
| profiles ↔ field_actions | N:N | via `field_action_members` |

## Consequências
- Nenhuma tabela nova é exigida além do previsto.
- `visit_actions` precisa nascer junto com `visits`, na Sprint 3. Adicionar depois seria
  migração de dados com visitas em andamento.
- A Sprint 0 entrega o quadrante superior direito — usuário e catálogo — mais auditoria e
  parametrização. É a fundação de que todo o resto depende.
