# Arquitetura — o que ficou implementado

Descreve o sistema **como ele é** ao fim da Sprint 1, não como foi planejado. Onde
os dois divergem, a divergência está anotada com o motivo.

---

## 1. As três camadas, e o que decide em cada uma

```
  TELA            server components · server actions
    │             não calcula regra; lê o que o serviço entrega
    ▼
  REGRA PURA      src/lib/business-rules/
    │             funções que NÃO leem o banco — recebem tudo por argumento.
    │             É o que as torna testáveis, e o que permitiu rodar as 1.804
    ▼             linhas reais por elas antes de qualquer tabela existir.
  BANCO           RLS · constraints · triggers · RPC
                  a fronteira REAL. Menu e guarda de rota são conveniência.
```

**A regra pura não é uma camada de conveniência.** Ela existe porque a mesma
decisão precisa acontecer em dois lugares — na tela, para mostrar o rótulo, e no
banco, para filtrar — e duas implementações da mesma regra divergem. O arnês de
paridade (ADR 0010) compara as duas contra a mesma entrada, e o que ele compara é
**uma com a outra**, nunca com valores escritos à mão.

## 2. Identidade de estabelecimento

```
Contrato presente?  ──sim──▶  identidade por `external_contract`
       │
       não
       ▼
CNPJ e endereço?    ──sim──▶  fallback: cnpj + hash do endereço normalizado
       │
       não
       ▼
                              linha nova
```

O hash é **coluna gerada** pelo banco sobre os componentes do endereço, composta
por `address_hash_input`. A aplicação nunca grava — e a função existe separada da
coluna justamente para que o importador possa calcular o mesmo hash **antes** de
gravar, sem reproduzir a expressão de memória.

Medido na base real: 1.804 contratos, todos distintos; **294 raízes de CNPJ**, com
CNPJ completo único; 67 endereços repetidos (shoppings) e **zero** pares
CNPJ+endereço repetidos. O fallback não foi exercitado por esta base — e continua
implementado e testado, porque a próxima pode exercitá-lo.

## 3. Importação como sincronização

```
  arquivo (.xlsx)
       │  lerPlanilha — o ÚNICO lugar que conhece o exceljs
       ▼
  LinhaCrua[]  ─── normalizeLinhaImportacao ──▶ LinhaNormalizada
       │                                              │
       │                          classifyImportRow ◀─┘  (recebe o estado atual
       ▼                                                  por ARGUMENTO)
  import_rows        ← a PRÉVIA escreve aqui, e só aqui
       │                nenhuma tabela de domínio é tocada
       │  import_finalize_preview: confere total E sequência sem buraco
       ▼
  status = previa    ← só agora é aplicável
       │
       │  import_commit — aplica o que a prévia classificou; NÃO reclassifica
       ▼
  establishments · addresses · capture_points · segments · capture_methods
```

**Por que o commit não reclassifica.** Se prévia e commit decidissem cada um por
conta, poderiam divergir — e o operador teria aprovado uma coisa e recebido outra.

**Por que ele ainda assim reconta os ausentes.** Trava que lê um campo gravado pela
prévia confia em quem deveria vigiar. O commit conta por conta própria, mas pela
**mesma definição** (`import_absent_establishments`): recalcular continua sendo
recalcular; o que não pode existir é uma segunda *regra*.

### O estado do job é o que impede o lote parcial

```
processando ──▶ previa ──▶ aplicando ──▶ concluida
     │             │
     └─────────────┴──▶ cancelada  (descarte, com motivo)
```

`processando` existe porque 1.804 inserções a partir do Node não são uma transação.
Queda na linha 900 deixaria contagens plausíveis, e o commit aplicaria metade. Só
vira `previa` quando a contagem gravada bate com o total lido **e** a sequência de
`line_number` não tem buraco — a segunda checagem é independente do que o cliente
afirma.

`aplicando` é o ponto de serialização: o commit exige `previa` e muda na mesma
transação, então clicar duas vezes não importa duas vezes.

## 4. Ausente: marcado, nunca apagado

Registro na base, dentro do **escopo declarado**, que não veio no arquivo. Sem o
escopo, importar o recorte de uma cidade faria o resto da base aparecer como sumido
(ADR 0011).

- **Reaparecer desmarca**, qualquer que seja o status da linha. A pergunta é
  "apareceu?", não "mudou?" — confundir as duas fazia o caso mais comum falhar.
- **Resolver** grava em `absence_resolutions` com motivo, autor e desde quando
  estava ausente (copiado, porque a marca é limpa).
- **Nunca grava `encerrado`.** A dimensão operacional é definida como confirmada em
  campo; ausência numa planilha é evidência mais fraca que o consultor na porta. O
  caminho administrativo para em `fechado_temporariamente`, e a RPC não recebe
  status por parâmetro — não há como pedir o definitivo a ela.

## 5. Elegibilidade — falha fechada

```
card_products.eligibility_mode
   all        → todos os segmentos ativos
   allowlist  → só os com rule_type = 'allow'
   denylist   → todos, exceto rule_type = 'deny'
```

Segmento não mapeado **nunca** é elegível em `allowlist`. Na base real isso não é
hipótese: os 15 valores de `Subgrupo` têm interseção zero com qualquer catálogo
prévio, então logo após a primeira importação a fila cobre 100% da base e nada é
elegível às modalidades restritas até alguém resolvê-la.

Por isso `/segmentos` é entregável, não extra — e por isso a fila ordena por
**impacto**, não por nome: a primeira pendência esconde centenas de
estabelecimentos, a última esconde um.

## 6. Segurança — três camadas, e qual delas é real

| Camada | O que faz | O que **não** faz |
|---|---|---|
| Menu (`enabled`) | esconde o que não existe | não protege nada |
| Guarda de rota | evita renderizar | contornável pela API |
| **GRANT + RLS** | **a fronteira** | — |

Sequência que este projeto aprendeu a respeitar, e cada item veio de um defeito
real:

1. **GRANT antes de policy.** Policy sem privilégio de tabela é código morto — o
   GRANT nega antes de a RLS ser avaliada (ADR 0012).
2. **Privilégio declarado, nunca herdado.** A imagem concede por
   `alter default privileges` mais do que qualquer migration escreve, e nenhuma
   revogação genérica alcança. Vale para tabelas (0011, 0014/0015) e para funções
   (0047).
3. **`security definer` desliga a RLS por dentro.** Quem usa checa o papel na
   entrada, ou o `grant execute` vira o único controle — e ele só pergunta "está
   logado?".
4. **Função `invoker` propaga o papel.** O que ela chama por dentro também precisa
   de privilégio, e a falta aparece como erro de regra.

Inventário das funções `security definer` executáveis por `authenticated` é
verificado em `05_grants_and_rls.sql`: função nova fora da lista quebra a suíte.
`anon` não executa função alguma de `public` e não tem privilégio de tabela algum.

## 7. Imutabilidade — por trigger, não por ausência de policy

`import_rows` e `absence_resolutions` são evidência. Ausência de policy protege
contra usuário, **não** contra `security definer` nem SQL direto — e "só o código X
escreve" descreve comportamento, não garantia.

Em `import_rows`, apenas `establishment_id` muda, e só de nulo para valor: é o elo
de resultado, preenchido pelo commit ao criar. Sem ele, "veio nesta importação?"
não seria pergunta que a tabela respondesse, e todo recém-criado apareceria como
ausente na importação que o criou.

## 8. Desempenho — o que é indexado e por quê

`calculate_transaction_status` é `STABLE` e lê `system_settings`: **não é
indexável**. Filtrar por status calculando-o em cada linha faz varredura completa.

A tela converte o status num **intervalo de datas** (`intervalo-de-recencia.ts`) e
compara `last_transaction_at`, que é indexado. A equivalência entre as duas formas é
verificada por igualdade de conjuntos contra a função SQL, sobre dados reais.

Medido com `EXPLAIN ANALYZE`:

```
intervalo → Bitmap Index Scan on establishments_recencia
status    → Seq Scan, Rows Removed by Filter: 1464
```

**O que não está resolvido:** a busca por nome usa `ilike '%termo%'`, que nenhum
btree serve. `pg_trgm` exigiria decisão registrada e custa escrita em cada
importação de 7.200 linhas — e a medição que justificaria ainda não existe.

## 9. Onde as coisas ficam

```
src/lib/business-rules/   regra pura, sem banco. O coração.
src/features/<modulo>/    domínio: serviços, componentes, tipos
src/components/           ui/ layout/ brand/ — não conhecem domínio
src/constants/            valores e enums. Nunca importa business-rules.
supabase/migrations/      47 arquivos, em ordem, nunca editados depois de aplicados
supabase/tests/           pgTAP — comportamento, não catálogo
tests/parity-db/          arnês SQL × TypeScript (ADR 0010)
tests/design/             invariantes estruturais: tokens, navegação, tipos, diretivas
scripts/ensaio.sh         instalação limpa de ponta a ponta
```

## 10. O que a Sprint 1 deixou registrado como dívida

| Item | Onde |
|---|---|
| CPF de pessoa física — decisão em aberto | ADR 0014 |
| `import_commit` continua `security definer` | migration 0038, com o motivo |
| Busca por nome sem índice | migration 0045 |
| Relatório exportável por estado | Sprint 6 |
