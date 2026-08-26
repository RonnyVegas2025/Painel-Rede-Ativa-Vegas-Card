-- A resolucao de ausentes: a assimetria entre as tres acoes.
--
-- O que estas assercoes protegem:
--
-- 1. AUSENCIA NAO GRAVA `encerrado`. A dimensao operacional e definida como
--    confirmada em campo, e `encerrado` como definitivo. Ausencia numa planilha e
--    evidencia mais fraca que o consultor na porta — pode ser troca de adquirente,
--    recorte de exportacao, ou arquivo filtrado. A garantia e estrutural: a funcao
--    nao recebe status por parametro.
--
-- 2. LOTE DE `nao_opera_mais` EXIGE CONFIRMACAO. Desmarcar e reversivel; mudar a
--    dimensao operacional de centenas de uma vez nao deveria ser um clique. Por
--    item nao exige nada — atrito em todo lugar e atrito em lugar nenhum.
--
-- 3. A DECISAO FICA. Resolver limpa `absent_since`; sem o historico, "sumiu ontem"
--    e "sumiu em marco e ja foi verificado" ficariam indistinguiveis no dia
--    seguinte.

begin;
select plan(15);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('dddd4444-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin-res@pgtap.invalid', '{"full_name":"Admin"}'::jsonb),
  ('dddd4444-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'consultor-res@pgtap.invalid', '{"full_name":"Consultor"}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"dddd4444-0000-4000-8000-000000000001","user_role":"administrativo"}', true);

insert into public.import_jobs (id, file_name, storage_path, scope_city, status)
values ('eeee5555-0000-4000-8000-000000000001', 'r.xlsx', 'p/r.xlsx', 'TESTE Cidade', 'concluida');

insert into public.establishments (id, external_contract, legal_name, trade_name,
                                   absent_since, absent_from_import, never_transacted)
select ('ffff6666-0000-4000-8000-00000000000' || n)::uuid,
       'TESTE-A-' || n, 'Ausente ' || n, 'TESTE Ausente ' || n,
       now() - interval '40 days', 'eeee5555-0000-4000-8000-000000000001', true
  from generate_series(1, 5) as n;

-- Um que NAO esta ausente, para provar que a acao nao o alcanca.
insert into public.establishments (id, external_contract, legal_name, trade_name, never_transacted)
values ('ffff6666-0000-4000-8000-000000000009', 'TESTE-A-9', 'Presente', 'TESTE Presente', true);

-- ===========================================================================
-- O que a acao recusa
-- ===========================================================================
select throws_ok(
  $$ select public.resolve_absences('{}'::uuid[], 'voltou_a_operar', 'x') $$,
  'P0001', null, 'selecao vazia e recusada'
);

select throws_ok(
  $$ select public.resolve_absences(array['ffff6666-0000-4000-8000-000000000001']::uuid[],
                                    'voltou_a_operar', '   ') $$,
  'P0001', null, 'motivo vazio e recusado: e o que fica no historico'
);

select throws_ok(
  $$ select public.resolve_absences(array['ffff6666-0000-4000-8000-000000000009']::uuid[],
                                    'voltou_a_operar', 'nao esta ausente') $$,
  'P0001', null, 'quem nao esta ausente nao e alcancado pela acao'
);

-- ===========================================================================
-- LOTE de `nao_opera_mais` exige a quantidade
-- ===========================================================================
select throws_ok(
  $$ select public.resolve_absences(
       array['ffff6666-0000-4000-8000-000000000001',
             'ffff6666-0000-4000-8000-000000000002']::uuid[],
       'nao_opera_mais', 'fecharam') $$,
  'P0001', null,
  'lote de `nao_opera_mais` sem a quantidade confirmada e recusado'
);

select throws_ok(
  $$ select public.resolve_absences(
       array['ffff6666-0000-4000-8000-000000000001',
             'ffff6666-0000-4000-8000-000000000002']::uuid[],
       'nao_opera_mais', 'fecharam', 3) $$,
  'P0001', null,
  'quantidade que nao bate e recusada — digitar qualquer numero nao serve'
);

-- Por ITEM nao exige nada: o atrito existe onde a decisao e grande.
select is(
  (select public.resolve_absences(array['ffff6666-0000-4000-8000-000000000001']::uuid[],
                                  'nao_opera_mais', 'visita confirmou porta fechada')),
  1, 'por item, `nao_opera_mais` nao exige confirmacao'
);

-- ===========================================================================
-- A DECISAO CENTRAL: nao grava `encerrado`
-- ===========================================================================
select is(
  (select operational_status::text from public.establishments
    where id = 'ffff6666-0000-4000-8000-000000000001'),
  'fechado_temporariamente',
  'ausencia grava `fechado_temporariamente`, NAO `encerrado`: a planilha nao e confirmacao em campo'
);

select is(
  (select count(*)::int from public.establishments where operational_status = 'encerrado'),
  0,
  'nenhum caminho desta tela alcanca `encerrado` — a funcao nao recebe status por parametro'
);

select is(
  (select absent_since from public.establishments where id = 'ffff6666-0000-4000-8000-000000000001'),
  null, 'resolvido sai da fila'
);

-- ===========================================================================
-- O historico guarda o que a marca perdeu
-- ===========================================================================
select is(
  (select resolution::text from public.absence_resolutions
    where establishment_id = 'ffff6666-0000-4000-8000-000000000001'),
  'nao_opera_mais', 'a decisao fica registrada'
);

select isnt(
  (select was_absent_since from public.absence_resolutions
    where establishment_id = 'ffff6666-0000-4000-8000-000000000001'),
  null,
  'desde quando estava ausente e COPIADO: `absent_since` e limpo, e sem isto a pergunta some'
);

-- Como SUPERUSUARIO. Sob a RLS o UPDATE afeta zero linhas e o gatilho nem
-- dispara — a assercao passaria sem testar o gatilho, que e justamente a guarda
-- que existe para valer onde a policy nao vale. A primeira versao deste teste
-- tinha esse defeito, e a injecao o revelou.
reset role;

select throws_ok(
  $$ update public.absence_resolutions set reason = 'outro' $$,
  '23514', null,
  'a decisao registrada nao muda — nem por quem passa por cima da RLS'
);

select throws_ok(
  $$ delete from public.absence_resolutions $$,
  '23514', null,
  'nem apagar: historico nao se apaga'
);

set local role authenticated;

-- ===========================================================================
-- Desmarcar em lote nao tem atrito: e reversivel
-- ===========================================================================
select is(
  (select public.resolve_absences(
     array['ffff6666-0000-4000-8000-000000000002',
           'ffff6666-0000-4000-8000-000000000003',
           'ffff6666-0000-4000-8000-000000000004',
           'ffff6666-0000-4000-8000-000000000005']::uuid[],
     'escopo_incorreto', 'arquivo era so a zona sul')),
  4, 'desmarcar em lote nao exige confirmacao: nao destroi nada'
);

select is(
  (select count(*)::int from public.establishments
    where operational_status <> 'apto' and external_contract like 'TESTE-A-%'),
  1,
  'desmarcar por escopo NAO mexe na dimensao operacional: so o que fechou mudou'
);

select * from finish();
rollback;
