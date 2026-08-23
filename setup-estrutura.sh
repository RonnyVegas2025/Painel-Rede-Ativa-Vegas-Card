#!/usr/bin/env bash
# Painel Rede Vegas Ativa - estrutura de pastas (Sprint 0, versao 2)
#
# Mudancas em relacao a versao 1:
#   + src/features/<12 modulos>/{components,services,validations,types,hooks,utils}
#   + src/lib/business-rules, src/lib/settings, src/lib/utils
#   + src/constants
#   + docs/decisions
#   + tests/{unit,parity}, supabase/tests
#   - src/components/{map,visits,establishments,dashboard,forms}  -> viraram features
#   - src/services                                                -> servico pertence ao modulo
#
# Idempotente: pode rodar de novo sem estragar nada.
set -euo pipefail

MODULOS=(
  autenticacao dashboard mapa estabelecimentos visitas acoes
  importacoes produtos segmentos usuarios ocorrencias configuracoes
)
SUBPASTAS=(components services validations types hooks utils)

DIRS=(
  # rotas
  "src/app/(auth)/login"
  "src/app/auth/callback"
  "src/app/(dashboard)/dashboard"
  "src/app/(dashboard)/diagnostico"
  "src/app/(dashboard)/acoes/[id]"
  "src/app/(dashboard)/mapa"
  "src/app/(dashboard)/estabelecimentos/[id]"
  "src/app/(dashboard)/minhas-visitas"
  "src/app/(dashboard)/atencao"
  "src/app/(dashboard)/importacoes"
  "src/app/(dashboard)/produtos"
  "src/app/(dashboard)/segmentos"
  "src/app/(dashboard)/usuarios"
  "src/app/(dashboard)/relatorios"
  "src/app/(dashboard)/configuracoes"
  "src/app/api"

  # transversais - nao conhecem dominio
  "src/components/ui"
  "src/components/layout"
  "src/components/brand"

  # biblioteca
  "src/lib/supabase"
  "src/lib/auth"
  "src/lib/permissions"
  "src/lib/business-rules"
  "src/lib/settings"
  "src/lib/validation"
  "src/lib/geolocation"
  "src/lib/maps"
  "src/lib/import"
  "src/lib/utils"

  "src/constants"
  "src/types"
  "src/hooks"        # apenas hooks transversais

  # banco
  "supabase/migrations"
  "supabase/functions"
  "supabase/tests"   # pgTAP

  # testes
  "tests/unit"
  "tests/parity"

  # apoio
  "docs/decisions"
  "public/brand"
  ".github/workflows"
)

for m in "${MODULOS[@]}"; do
  for s in "${SUBPASTAS[@]}"; do
    DIRS+=("src/features/$m/$s")
  done
done

for d in "${DIRS[@]}"; do
  mkdir -p "$d"
  [ -z "$(ls -A "$d" 2>/dev/null)" ] && touch "$d/.gitkeep"
done

touch docs/business-rules.md docs/data-dictionary.md docs/acceptance-tests.md \
      docs/architecture.md docs/permissions.md docs/import-layout.md docs/status-flows.md

# Aviso sobre pastas da versao 1 que agora tem outro dono.
for antiga in src/components/map src/components/visits src/components/establishments \
              src/components/dashboard src/components/forms src/services; do
  if [ -d "$antiga" ]; then
    echo "AVISO: $antiga existe da versao 1. O conteudo deve migrar para src/features/. Nao removi nada."
  fi
done

echo "Estrutura criada: ${#DIRS[@]} pastas, ${#MODULOS[@]} modulos."
echo "Proximo: globals.css em src/app/, logo em public/brand/."
