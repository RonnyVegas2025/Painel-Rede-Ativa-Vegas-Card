#!/usr/bin/env bash
#
# Ensaio de instalação limpa.
#
# Destrói os volumes, aplica todas as migrations em sequência sobre um banco
# virgem, importa a planilha real e confere as contagens. Falha ruidosa em
# qualquer passo.
#
# ## Por que existe
#
# Trabalhar semanas sobre o mesmo volume esconde defeitos: uma fixture passa por
# dado que já estava lá, um privilégio parece declarado quando foi herdado, uma
# lista de exceções descreve aquele banco em vez do schema. Rodado três vezes na
# Sprint 1, encontrou coisa nas três — incluindo 37 funções executáveis por `anon`
# que nenhuma revisão de código tinha visto.
#
# Enquanto for sequência manual de comandos, ninguém roda no começo da sprint
# seguinte — que é exatamente quando vale mais, porque a próxima sprint adiciona
# migrations sobre as que já existem.
#
# ## Uso
#
#   npm run ensaio                 # sem importação (rápido, ~2 min)
#   npm run ensaio -- --com-dados  # com a planilha real
#
# `--com-dados` exige `ENSAIO_PLANILHA=/caminho/para/base.xlsx`. A planilha NÃO
# está no repositório: é dado real de comércios credenciados.

set -euo pipefail
cd "$(dirname "$0")/.."

COM_DADOS=0
[[ "${1:-}" == "--com-dados" ]] && COM_DADOS=1

# O nome dos contêineres vem do `project_id` do config, nao do diretorio.
PROJETO=$(grep -E '^project_id' supabase/config.toml | head -1 | sed 's/.*=//' | tr -d ' "')

falhou=0
passo()  { echo; echo "── $1"; T0=$(date +%s); }
fim()    { echo "   ⏱  $(( $(date +%s) - T0 ))s"; }
ok()     { echo "   ✓ $1"; }
erro()   { echo "   ✗ $1"; falhou=1; }
confere() { # confere <rótulo> <obtido> <esperado>
  if [[ "$2" == "$3" ]]; then ok "$1: $2"; else erro "$1: $2 (esperado $3)"; fi
}

DB() { docker exec -i "supabase_db_${PROJETO}" psql -U postgres -d postgres -X -q -A -t -c "$1"; }

passo "1. Destruir volumes"
npx supabase stop --no-backup >/dev/null 2>&1 || true
docker volume ls -q | grep -i "$PROJETO" | xargs -r docker volume rm >/dev/null 2>&1 || true
confere "volumes restantes" "$(docker volume ls -q | grep -ci "$PROJETO" || true)" "0"
fim

passo "2. Instalar do zero — todas as migrations em sequência"
if ! npx supabase start > /tmp/ensaio-start.log 2>&1; then
  erro "supabase start falhou; veja /tmp/ensaio-start.log"
  exit 1
fi
EM_DISCO=$(ls supabase/migrations/*.sql | wc -l | tr -d ' ')
APLICADAS=$(DB "select count(*) from supabase_migrations.schema_migrations;")
confere "migrations aplicadas" "$APLICADAS" "$EM_DISCO"
fim

passo "3. Invariantes de instalação limpa"
# Base vazia: os segmentos vêm da importação, não de seed — se houver segmento
# aqui, alguém semeou à mão e a reconciliação da próxima importação vai duplicar.
confere "estabelecimentos" "$(DB 'select count(*) from public.establishments;')" "0"
confere "segmentos"        "$(DB 'select count(*) from public.segments;')" "0"
confere "meios de captura" "$(DB 'select count(*) from public.capture_methods;')" "0"
confere "modalidades"      "$(DB 'select count(*) from public.card_products;')" "6"
# Privilégio herdado do ambiente é a classe de defeito que este projeto encontrou
# três vezes (ADR 0012). Aqui ela é medida, não presumida.
confere "funções alcançáveis por anon" \
  "$(DB "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and has_function_privilege('anon',p.oid,'execute');")" "0"
confere "privilégio de tabela para anon" \
  "$(DB "select count(*) from information_schema.role_table_grants where table_schema='public' and grantee='anon';")" "0"
fim

passo "4. Suíte completa"
npx tsc --noEmit && ok "typecheck"       || erro "typecheck"
npm run lint  >/dev/null 2>&1 && ok "lint"      || erro "lint"
npm run test  >/dev/null 2>&1 && ok "vitest"    || erro "vitest"
npx supabase test db --local >/dev/null 2>&1 && ok "pgTAP" || erro "pgTAP"
npm run test:parity >/dev/null 2>&1 && ok "paridade" || erro "paridade"
npm run build >/dev/null 2>&1 && ok "build"     || erro "build"
fim

if [[ $COM_DADOS -eq 1 ]]; then
  passo "5. Importação real"
  if [[ -z "${ENSAIO_PLANILHA:-}" || ! -f "${ENSAIO_PLANILHA}" ]]; then
    erro "defina ENSAIO_PLANILHA com o caminho da planilha real"
  else
    # BOOTSTRAP DO PRIMEIRO GESTOR — em dois passos, e cada um por um motivo.
    #
    # CRIAR pela API do GoTrue, não por `insert into auth.users`. O insert direto
    # produz uma linha que o GoTrue não reconhece, e o login falha com
    # "Database error querying schema" — sintoma sem relação com a causa.
    #
    # PROMOVER por SQL, não pela API. `fn_protect_profile_fields` recusa mudança de
    # papel vinda de quem não é gestor master, e `service_role` não é — está certo:
    # cliente de serviço que promove torna a proteção decorativa.
    #
    # É a mesma sequência que `docs/setup-validation.md` manda o operador seguir.
    URL=$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d= -f2-)
    KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2-)
    curl -s -X POST "$URL/auth/v1/admin/users" \
      -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
      -d '{"email":"ensaio@vegas.local","password":"EnsaioForte123!","email_confirm":true,"user_metadata":{"full_name":"Operador do Ensaio"}}' \
      >/dev/null
    DB "update public.profiles set role = 'gestor_master', is_active = true where email = 'ensaio@vegas.local';" >/dev/null
    confere "papel do operador" "$(DB "select role from public.profiles where email='ensaio@vegas.local';")" "gestor_master"

    # O servidor precisa estar no ar: o fluxo passa pelas telas.
    (npm run dev >/tmp/ensaio-dev.log 2>&1 &)
    # Espera pelo CONTEÚDO, não pelo status: o Next dev responde 200 enquanto
    # ainda compila a rota, e o navegador chegava numa página sem formulário.
    pronto=0
    for _ in $(seq 1 90); do
      if curl -s http://localhost:3000/login | grep -q 'type="email"'; then pronto=1; break; fi
      sleep 1
    done
    [[ $pronto -eq 1 ]] || erro "servidor não ficou pronto"


    if node scripts/ensaio-fluxo.mjs "$ENSAIO_PLANILHA"; then
      # As contagens que NÃO dependem da data. A distribuição transacional fica de
      # fora de propósito: quatro das cinco faixas são função do dia em que se mede.
      confere "estabelecimentos"    "$(DB 'select count(*) from public.establishments;')" "1804"
      confere "pontos de captura"   "$(DB 'select count(*) from public.establishment_capture_points;')" "3577"
      confere "meios de captura"    "$(DB 'select count(*) from public.capture_methods;')" "13"
      confere "segmentos"           "$(DB 'select count(*) from public.segments;')" "15"
      confere "nunca transacionou"  "$(DB 'select count(*) from public.establishments where never_transacted;')" "319"
      confere "conflitos"           "$(DB 'select conflict_count from public.import_jobs where status = $$concluida$$;')" "1"
      confere "erros"               "$(DB 'select error_count from public.import_jobs where status = $$concluida$$;')" "0"
      confere "meios duplicados"    "$(DB 'select duplicated_capture_methods from public.import_jobs where status = $$concluida$$;')" "9"
      confere "sem número"          "$(DB 'select addresses_without_number from public.import_jobs where status = $$concluida$$;')" "61"
      confere "objeto no bucket"    "$(DB "select count(*) from storage.objects where bucket_id='import-files';")" "1"
    else
      erro "fluxo pelas telas falhou"
    fi

    pkill -f "next dev" >/dev/null 2>&1 || true
  fi
  fim
fi

echo
if [[ $falhou -eq 0 ]]; then
  echo "══ ENSAIO OK ══"
else
  echo "══ ENSAIO FALHOU — veja os ✗ acima ══"; exit 1
fi
