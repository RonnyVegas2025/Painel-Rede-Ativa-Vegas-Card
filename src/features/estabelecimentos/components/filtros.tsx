import { Card } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { REGISTRATION_STATUS_LABELS } from "@/constants/establishment-status";
import { OPERATIONAL_STATUS_LABELS } from "@/constants/operational-status";
import { TRANSACTION_STATUS_LABELS } from "@/constants/transaction-status";
import type { OpcoesDeFiltro } from "@/features/estabelecimentos/services/listagem";

/**
 * Filtros como formulário GET.
 *
 * Sem estado de cliente: a URL é o estado. Cada filtro é compartilhável, o botão
 * voltar funciona, e a página continua sendo renderizada no servidor — que é o que
 * permite a consulta indexada em vez de filtrar no navegador.
 */
export function Filtros({
  opcoes,
  atual,
}: {
  opcoes: OpcoesDeFiltro;
  atual: Record<string, string | undefined>;
}) {
  const campo =
    "mt-1 h-11 w-full rounded-[var(--vg-radius-md)] border border-[var(--vg-border-field)] bg-[var(--vg-surface)] px-3 text-[length:var(--vg-text-body)] text-[var(--vg-ink)]";
  const rotulo = "text-[length:var(--vg-text-caption)] text-[var(--vg-ink-secondary)]";

  return (
    <Card className="mt-2">
      <form action={ROUTES.ESTABELECIMENTOS} method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label className={rotulo} htmlFor="busca">Nome, contrato ou CNPJ</label>
          <input id="busca" name="busca" defaultValue={atual.busca ?? ""} className={campo} />
        </div>

        <div>
          <label className={rotulo} htmlFor="transacional">Transacional</label>
          <select id="transacional" name="transacional" defaultValue={atual.transacional ?? ""} className={campo}>
            <option value="">Todos</option>
            {Object.entries(TRANSACTION_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={rotulo} htmlFor="operacional">Operacional</label>
          <select id="operacional" name="operacional" defaultValue={atual.operacional ?? ""} className={campo}>
            <option value="">Todos</option>
            {Object.entries(OPERATIONAL_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={rotulo} htmlFor="cadastral">Cadastral</label>
          <select id="cadastral" name="cadastral" defaultValue={atual.cadastral ?? ""} className={campo}>
            <option value="">Todos</option>
            {Object.entries(REGISTRATION_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={rotulo} htmlFor="segmento">Segmento</label>
          <select id="segmento" name="segmento" defaultValue={atual.segmento ?? ""} className={campo}>
            <option value="">Todos</option>
            {opcoes.segmentos.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={rotulo} htmlFor="cidade">Cidade</label>
          <select id="cidade" name="cidade" defaultValue={atual.cidade ?? ""} className={campo}>
            <option value="">Todas</option>
            {opcoes.cidades.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={rotulo} htmlFor="ordem">Ordem</label>
          <select id="ordem" name="ordem" defaultValue={atual.ordem ?? "recentes"} className={campo}>
            <option value="recentes">Transação mais recente</option>
            <option value="antigos">Mais dias sem transação</option>
            <option value="nome">Nome</option>
          </select>
        </div>

        <div className="flex items-end gap-3">
          <label className="flex h-11 items-center gap-2 text-[length:var(--vg-text-body-sm)] text-[var(--vg-ink)]">
            <input type="checkbox" name="ausentes" value="1" defaultChecked={atual.ausentes === "1"} className="size-4" />
            Só ausentes
          </label>
          <button
            type="submit"
            className="h-11 rounded-[var(--vg-radius-md)] bg-[var(--vg-brand-500)] px-4 text-[length:var(--vg-text-body)] text-[var(--vg-ink-on-brand)] hover:bg-[var(--vg-brand-600)]"
          >
            Filtrar
          </button>
        </div>
      </form>
    </Card>
  );
}
