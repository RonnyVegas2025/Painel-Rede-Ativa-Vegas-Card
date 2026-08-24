-- 0033 A origem da auditoria passa a ser declarada, nao inferida
--
-- O PROBLEMA QUE VEM AI
--
-- Uma importacao escreve cerca de 7.200 linhas de dominio, e o trigger grava uma
-- linha de auditoria para cada. Numa importacao mensal, sao 7.200 registros de
-- maquina por vez sepultando os poucos registros de PESSOA — que sao exatamente
-- os que alguem procura quando algo deu errado.
--
-- O QUE NAO FAZER, E POR QUE
--
-- A saida obvia seria nao auditar durante a importacao. Nao.
--
-- "Auditar exceto quando X" e como auditoria ganha buraco, e o X sempre cresce.
-- Esta sprint ja produziu duas variacoes dessa classe de erro: a view que
-- ignorava a RLS por rodar com privilegio do dono, e a varredura de invariantes
-- que era generica quanto a tabelas e cega quanto a views. Nos dois casos o
-- defeito foi uma excecao que ninguem lembrava que existia.
--
-- O dado fica COMPLETO. O que e filtrado e a visao.
--
-- COMO
--
-- `origin` deixa de ser inferida de `actor_id is null` e passa a ser lida de
-- `app.audit_origin`, que quem escreve declara. A inferencia anterior continua
-- como padrao, entao nada que ja funciona muda de comportamento.
--
-- A RPC de importacao declara `import` no inicio da transacao, com `true` no
-- terceiro argumento para valer so ali. A tela de auditoria exclui `import` por
-- padrao, com opcao de incluir.
--
-- Efeito colateral util: `edge_function` passa a ser declaravel tambem, o que a
-- Sprint 2 vai precisar para o worker de geocodificacao.

create or replace function public.fn_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_changed text[];
  v_entity_id text;
  v_actor uuid := auth.uid();
  v_role public.user_role;
  v_origin public.audit_origin;
begin
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_entity_id := (v_old ->> 'id');
  elsif tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_entity_id := (v_new ->> 'id');
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_entity_id := (v_new ->> 'id');
    select array_agg(chave order by chave) into v_changed
    from jsonb_each(v_new) as e(chave, valor)
    where valor is distinct from (v_old -> e.chave);
  end if;

  begin
    v_role := public.auth_role();
  exception when others then
    v_role := null;
  end;

  -- Declarada por quem escreve; na ausencia, a inferencia de antes.
  v_origin := coalesce(
    nullif(current_setting('app.audit_origin', true), '')::public.audit_origin,
    case when v_actor is null then 'system' else 'web' end::public.audit_origin
  );

  insert into public.audit_logs (
    actor_id, actor_role, action, entity, entity_id,
    old_value, new_value, changed_fields, origin, ip_address, user_agent
  ) values (
    v_actor, v_role, lower(tg_op)::public.audit_action, tg_table_name, v_entity_id,
    v_old, v_new, v_changed,
    v_origin,
    public.request_ip(),
    nullif(current_setting('request.headers', true)::jsonb ->> 'user-agent', '')
  );

  return coalesce(new, old);
exception when others then
  -- Falha de auditoria nao pode derrubar a operacao de negocio, mas tambem nao
  -- pode passar despercebida. Vai para o log do Postgres.
  raise warning 'fn_audit falhou em %: %', tg_table_name, sqlerrm;
  return coalesce(new, old);
end;
$$;

comment on function public.fn_audit is
  'Trilha de auditoria. Grava SEMPRE — nao ha excecao por origem, e nao deve haver:
   "auditar exceto quando X" e como auditoria ganha buraco. `origin` e declarada
   em app.audit_origin por quem escreve, e cai para a inferencia antiga quando
   ausente. Filtrar importacao e trabalho da LEITURA, nao da escrita.';

-- Indice para a leitura filtrada: sem ele, excluir `import` viraria varredura
-- completa numa tabela que cresce 7.200 linhas por importacao.
create index if not exists audit_logs_origem_e_momento
  on public.audit_logs (origin, occurred_at desc);
