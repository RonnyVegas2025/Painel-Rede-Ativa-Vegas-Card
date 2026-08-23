-- 0010 Buckets do Storage
-- Privados por padrao. Entrega por signed URL de validade curta.
-- As policies de leitura por visita entram na Sprint 4, quando visits existir.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('visit-evidence', 'visit-evidence', false, 5242880,
   array['image/jpeg','image/png','image/webp']),
  ('import-files', 'import-files', false, 20971520,
   array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/vnd.ms-excel','text/csv'])
on conflict (id) do nothing;

-- Limite de 5 MB em visit-evidence e piso, nao teto de conforto: a foto sobe
-- comprimida pelo cliente (T4). Arquivo no limite indica compressao que falhou.

create policy "gestao le arquivos de importacao"
  on storage.objects for select to authenticated
  using (bucket_id = 'import-files' and public.is_admin());

create policy "gestao envia arquivo de importacao"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'import-files' and public.is_admin());

-- visit-evidence fica sem policy nenhuma nesta sprint: sem visits, nao ha como
-- escrever a condicao correta, e bucket sem policy nao le ninguem. Falha fechada.
