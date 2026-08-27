# Guia de implantação e validação — Sprint 1

O que este guia pede de você **não é conferir contagens**. Isso o
`npm run ensaio` faz melhor, mais rápido e sem esquecer nenhuma.

O que só você pode fazer é julgar se o sistema **serve**: se os números da tela
fazem sentido para quem conhece a rede, se a trava de fato faz parar, se a ficha
mostra o que um consultor precisaria ver na porta da loja.

Reserve cerca de 40 minutos. A maior parte é você olhando, não digitando.

> A validação da Sprint 0 está em `setup-validation-sprint0.md`. Ela descreve um
> sistema que mudou: a V3 conta seeds que foram esvaziados de propósito, e a V4
> espera elegibilidade que hoje só existe depois da importação e da fila. Fica
> como registro, não como roteiro.

---

## 1. Pré-requisitos

| Item | Versão | Como conferir |
|---|---|---|
| Node.js | 22.x LTS | `node -v` |
| npm | 10+ | `npm -v` |
| Docker Desktop | 4.30+, **em execução** | `docker ps` |
| Supabase CLI | 2.x | `supabase --version` |

E a planilha real (`.xlsx`, 20 colunas). Ela **não** está no repositório: é dado de
comércios credenciados.

```bash
git clone <repo> && cd Painel-Rede-Ativa-Vegas-Card
git checkout claude/rede-ativa-repo-conexao-ohun6s
npm install
cp .env.example .env.local     # os valores locais saem do `supabase start`
```

---

## 2. O que o script cobre — V1 a V6

```bash
ENSAIO_PLANILHA=/caminho/base.xlsx npm run ensaio -- --com-dados
```

Instalação limpa (volumes destruídos), 47 migrations em sequência, invariantes de
base virgem, suíte completa, e a importação da base real **pelas telas**.

**Saída esperada:**

```
══ ENSAIO OK ══
```

com `1804 · 3577 · 13 · 15 · 319 nunca · 1 conflito · 0 erros · 9 duplicados
· 61 sem número · 1 objeto no bucket · anon com zero funções`

Se falhar, a mensagem diz o passo e o número que não bateu.

> **Por que o guia não repete esses passos.** Se o roteiro e o script cobrissem o
> mesmo caminho com instruções próprias, os dois divergiriam — e seriam duas
> fontes para o mesmo fato, que é a classe de problema que esta sprint inteira
> passou eliminando. O script é a fonte; o guia aponta para ele.

Só um número **não** é conferido pelo script, e de propósito: a distribuição
transacional. Quatro das cinco faixas são função da data em que se mede — em
24/08/2026 eram `293 · 285 · 132 · 775 · 319`, e dois dias depois já eram
`232 · 340 · 134 · 779 · 319`. O que é atemporal (a soma e a cobertura sem buraco)
é verificado por igualdade de conjuntos na paridade.

---

## 3. O que só você pode julgar — V7 a V12

Suba a aplicação e entre com o usuário que o ensaio criou
(`ensaio@vegas.local` / `EnsaioForte123!`):

```bash
npm run dev
```

### V7 — Os números fazem sentido para quem conhece a rede?

Abra `/estabelecimentos`. Filtre por cada faixa transacional.

| O que perguntar | Por quê |
|---|---|
| A quantidade de **críticos** bate com sua percepção da rede? | 779 de 1.804 é muito ou é o esperado? |
| Os **319 que nunca transacionaram** fazem sentido? | Credenciado que nunca vendeu é problema comercial ou cadastro antigo? |
| A ordenação por **mais dias sem transação** traz quem você esperaria? | |

**Não há resposta certa aqui.** Se um número te surpreender, é sinal — pode ser
defeito nosso ou informação sobre a rede que ninguém tinha olhado.

### V8 — A confirmação deliberada faz parar?

Este é o teste mais importante do guia, e **o único que você precisa fazer sem
pensar antes**.

1. Importe um recorte da planilha — apague metade das linhas e salve como outro
   arquivo — declarando o escopo como `São Paulo`.
2. A prévia vai avisar que centenas serão marcados como ausentes.
3. **Tente aplicar como você aplicaria num dia corrido.**

Depois, responda com honestidade:

- Você **leu** o número, ou digitou no reflexo porque a tela pediu um número?
- A saída — *"O arquivo é de um recorte?"* — chamou atenção antes da confirmação?
- Se você fosse o operador com pressa, teria escolhido descartar e redeclarar?

Se a resposta for "digitei no reflexo", a trava não está funcionando, por mais que
o código esteja correto. Me diga — o desenho muda.

### V9 — Os três exemplos comunicam?

Na mesma tela, o bloco *"Entre os que sumiriam"* mostra três nomes com a data da
última transação.

- Você reconhece algum?
- **"Transacionou há 25 dias" te fez desconfiar do escopo?** É para isso que serve:
  um comércio que vendeu semana passada aparecendo como sumido é o sinal mais forte
  de que o arquivo estava filtrado.
- Se os três tivessem transacionado há oito meses, você teria confirmado com mais
  tranquilidade?

### V10 — A ficha serve para quem está na porta da loja?

Abra um estabelecimento qualquer em `/estabelecimentos/<id>`.

Imagine o consultor parado na frente do comércio, com o tablet:

| Pergunta | Está na tela? |
|---|---|
| É este o lugar certo? | endereço, bairro, CEP |
| Com quem eu falo? | telefone, razão social |
| Qual a situação dele? | as cinco dimensões, separadas |
| Faz quanto tempo que não vende? | dias sem transação |
| Que máquina ele usa? | meios de captura, com os inativos e a data |
| Quem é o consultor da carteira? | consultores, texto cru da planilha |

**O que falta?** Visita e ocorrência aparecem com `—` porque são das Sprints 3 e 5.
Qualquer outra ausência é lacuna nossa.

### V11 — A fila de ausentes é decidível?

Em `/importacoes`, seção *"Ausentes aguardando análise"*.

- A ordenação por transação mais recente ajuda a decidir?
- As três decisões estão claras sobre o que fazem?
- **"Não opera mais" diz que não grava encerramento** — isso faz sentido para você?
  O encerramento definitivo fica para a visita confirmar em campo.

### V12 — Navegação por papel

Crie um segundo usuário e deixe como `consultor_campo`:

```sql
update public.profiles set role = 'consultor_campo' where email = '<e-mail>';
```

Entrando com ele, a barra lateral **não** deve mostrar Importações. Tentar abrir
`/importacoes` direto pela URL deve redirecionar.

---

## 4. Storage — V13, V14, V15

**Estas três nunca foram exercitadas fora do ambiente de desenvolvimento.** São as
com maior chance de conter defeito.

### V13 — Upload por signed URL

Já coberto pelo ensaio (`✓ objeto no bucket: 1`). Confirme no Studio que o objeto
existe em `import-files` com o caminho `importacoes/<id do job>.xlsx` — **derivado
do id**, nunca do nome do arquivo.

### V14 — Cópia na redeclaração de escopo

1. Numa prévia acima do limiar, use **"Descartar e declarar outro escopo"**.
2. Esperado: vai para a prévia nova, já montada, **sem reenviar o arquivo**.
3. No banco:

```sql
select j.status, j.scope_city, j.storage_path, a.status as original, a.error_message
  from public.import_jobs j
  left join public.import_jobs a on a.id = j.derivado_de_id
 order by j.started_at desc limit 1;
```

A nova em `previa` com o escopo novo; a original `cancelada` com
`descartada: escopo redeclarado para <cidade>`; os dois `storage_path` diferentes,
e **os dois objetos existindo** no bucket.

4. **O caminho de falha importa mais.** Apague o objeto da original no Studio e
   tente redeclarar. Esperado: erro na tela dizendo que a original continua intacta,
   a original **ainda em `previa`**, e a derivada `cancelada` com
   `cópia do arquivo falhou`.

### V15 — O bucket recusa o que não é planilha

| Tentativa | Esperado |
|---|---|
| `.txt` ou `.pdf` | recusa por mime type, sem criar job aplicável |
| acima de 20 MB | recusado **antes de abrir o parser**, com o tamanho em MB |
| `.xlsx` com cabeçalho errado | recusa **nomeando as colunas ausentes** |

Nos três, confira que a lista de pendentes **não** ganhou item.

---

## 5. Problemas prováveis

### "Database error querying schema" ao entrar

**Causa:** o usuário foi criado com `insert into auth.users` direto.

É o caminho óbvio para quem já está no SQL Editor promovendo o papel — e produz uma
linha que o GoTrue não reconhece. O sintoma não tem relação nenhuma com a causa.

**Regra: criar pela API ou pelo Studio; promover por SQL.**

```bash
curl -s -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"...","password":"...","email_confirm":true}'
```

```sql
update public.profiles set role = 'gestor_master' where email = '...';
```

### "Alteracao de papel exige gestor_master" com o cliente de serviço

**Não é defeito.** `fn_protect_profile_fields` recusa mudança de papel vinda de quem
não é gestor master, e `service_role` não é. Cliente de serviço que promove torna a
proteção decorativa.

O primeiro gestor é promovido por SQL direto — o único momento em que isso é
necessário.

### `supabase start` falha baixando imagens

Rede bloqueando o registro. As imagens já baixadas ficam em cache; se o ambiente
tiver as tags certas com outro prefixo, `docker tag` resolve.

### A fila de segmentos não muda nada em `/estabelecimentos`

Esperado. Resolver a fila define **o que o segmento é** e **quais modalidades o
aceitam** — sem a segunda parte, nada fica elegível. É a falha fechada do ADR 0003.

### `npm run ensaio` acusa "funções alcançáveis por anon: N"

Alguma migration nova criou função sem revogar o padrão do schema. A imagem do
Supabase concede `execute` a `anon`, `authenticated` e `service_role` por
`alter default privileges` — e `revoke ... from public` **não** alcança isso.
Ver migration 0047.

---

## 6. Checklist

- [ ] `npm run ensaio -- --com-dados` termina com `══ ENSAIO OK ══`
- [ ] V7 — os números fazem sentido para quem conhece a rede
- [ ] V8 — **a confirmação deliberada fez você parar e ler**
- [ ] V9 — os três exemplos comunicaram o que deveriam
- [ ] V10 — a ficha serve para quem está na porta da loja
- [ ] V11 — a fila de ausentes é decidível
- [ ] V12 — consultor não vê Importações
- [ ] V13 — objeto no bucket com caminho derivado do id
- [ ] V14 — cópia na redeclaração, **e o caminho de falha**
- [ ] V15 — recusa por mime type, tamanho e cabeçalho

Falhando qualquer uma, me mande o passo, o que você viu e o que esperava.

**V8 é a mais importante.** As outras verificam se o sistema faz o que dissemos;
ela verifica se o que dissemos adianta.
