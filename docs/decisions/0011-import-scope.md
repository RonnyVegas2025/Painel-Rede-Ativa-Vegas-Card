# ADR 0011 — Escopo da importação e o estado `ausente`

- **Status:** aceito
- **Data:** 2026-08-24

## Contexto

A importação é sincronização, não cadastro. Disso decorre que registro presente na
base e ausente do arquivo **nunca é excluído**: vai para análise administrativa.

Mas `ausente` só tem significado contra um extrato completo. Se alguém importar um
recorte — uma cidade, uma modalidade —, tudo que está fora do recorte aparece como
sumido, e a fila administrativa enche de ruído.

Pior: o desastre clássico deste tipo de importação é exportar a planilha com um
filtro ainda aplicado. Nada seria excluído, e ainda assim uma fila com 1.400 itens
é indistinguível de ruído. O efeito prático é o mesmo de ter apagado a base — a
informação existe, mas ninguém consegue usá-la.

## Decisão

**`import_jobs` carrega escopo explícito.** `scope_city` e `scope_card_product_id`,
nulos significando "toda a base". O estado `ausente` só é calculado **dentro do
escopo declarado**.

**Trava de limiar.** Se a importação marcaria mais que um limiar da base como
ausente, o job para e exige confirmação explícita, com o número na tela. As colunas
`requires_confirmation`, `confirmed_by` e `confirmed_at` registram a decisão, e uma
constraint garante que as duas últimas andem juntas.

O limiar — sugestão inicial de 20% — vive em `system_settings`, não no código nem
na migration. Parâmetro operacional fixo em componente é erro de revisão neste
projeto, e este é um parâmetro operacional: quem opera a base sabe melhor que o
desenvolvedor qual variação é normal.

**A primeira importação nunca calcula ausentes.** Não há contra o que comparar, e
marcar tudo como ausente numa base vazia seria ruído garantido.

**A prévia lista os ausentes, não só os conta.** Registro que sumiu nunca é
excluído, mas também não pode ficar invisível: a decisão administrativa depende de
alguém ver a lista. Contagem sem lista transfere a responsabilidade sem transferir
a informação.

## Alternativas consideradas

- **Toda importação é a base completa, por definição.** Mais simples, e falso: a
  operação vai querer corrigir uma cidade sem reexportar 1.804 linhas. A regra
  seria contornada informalmente, com alguém marcando ausentes como resolvidos em
  lote — que é o pior dos dois mundos.
- **Nunca calcular ausentes.** Elimina o ruído e também o valor: estabelecimento
  descredenciado deixaria de aparecer para o administrativo, e o consultor
  continuaria visitando ponto que não existe mais.
- **Excluir o ausente.** Contraria a decisão de sincronização e destrói histórico
  de visita e ocorrência ligado ao registro.

## Consequências

- `import_jobs` tem escopo, e toda consulta de ausentes precisa respeitá-lo. Ignorar
  o escopo numa consulta futura reintroduz o problema em silêncio.
- O limiar é parâmetro, então mudá-lo é ato administrativo com auditoria, não
  deploy.
- A tela de importação tem um estado a mais: *aguardando confirmação*, distinto de
  *em andamento* e de *concluída*.

---

# Anexo — por que `establishment_transactions` não existe

Registrado aqui porque ausência sem justificativa lê como esquecimento, e alguém
corrige o "esquecimento".

**Onde a tabela entra:** Sprint 8, métricas transacionais, com ingestão e
consolidação horária e diária.

**Por que ainda não:** a Sprint 8 está bloqueada pela origem dos dados
transacionais. A planilha traz apenas uma data de última transação, e não há como
derivar histórico dela. O bloqueio está aberto no roadmap e não deve ser
contornado.

**Por que não criar vazia agora:** convidaria alguém a preenchê-la com premissa
errada antes de a origem existir. E o volume não é detalhe — 1.804 estabelecimentos
× 24 horas × 365 dias são cerca de 15,8 milhões de linhas por ano, o que exige
decisão de particionamento que não se toma sem conhecer o formato da origem.
Particionar errado é mais caro que não particionar.

**O que basta até lá:** `establishments.last_transaction_at`, que é tudo o que a
classificação de recência consome nas Sprints 1 e 2.
