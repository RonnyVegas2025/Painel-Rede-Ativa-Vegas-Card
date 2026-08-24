import type { LinhaNormalizada } from "./normalize-linha-importacao";
import { temConflito, temErro } from "./normalize-linha-importacao";

/** Espelha `public.import_row_status`. */
export type ImportRowStatus =
  | "novo"
  | "atualizado"
  | "inalterado"
  | "conflito"
  | "erro"
  | "ausente";

/**
 * O estado atual da base, na forma em que a comparação precisa dele.
 *
 * Recebido por argumento, não lido: é o que torna o diferenciador testável sem
 * infraestrutura (`PLATFORM-STANDARDS.md` §4) e o que permitiu rodar as 1.804
 * linhas reais por ele antes de qualquer tabela ser escrita.
 */
export interface EstabelecimentoExistente {
  id: string;
  externalContract: string | null;
  cnpj: string | null;
  /** Hash do endereço **corrente**. Segunda metade da identidade de fallback. */
  addressHash: string | null;
  /** Campos comparáveis, para distinguir `atualizado` de `inalterado`. */
  legalName: string;
  tradeName: string;
  cep: string | null;
  city: string;
  state: string;
  phone: string | null;
  email: string | null;
  segmentSourceName: string | null;
  acquisitionChannel: string | null;
  assignedConsultantsRaw: string | null;
  origin: string | null;
  lastTransactionAt: string | null;
  neverTransacted: boolean;
  captureMethodSourceNames: readonly string[];
}

export interface EstadoAtual {
  porContrato: ReadonlyMap<string, EstabelecimentoExistente>;
  /** Chave: `${cnpj}|${addressHash}`. Só entradas com os dois preenchidos. */
  porCnpjEEndereco: ReadonlyMap<string, EstabelecimentoExistente>;
}

export interface Classificacao {
  status: ImportRowStatus;
  establishmentId: string | null;
  /** Como a linha foi identificada. `null` quando não casou com nada. */
  identificadaPor: "contrato" | "cnpj_endereco" | null;
  /** Campos que mudaram, quando `atualizado`. Vira `changed_fields` na trilha. */
  camposAlterados: string[];
  motivo: string | null;
}

/** Data em ISO curto, para comparar planilha com banco sem ruído de fuso. */
function diaOuNulo(v: Date | string | null): string | null {
  if (v === null) return null;
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function mesmoConjunto(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const x = [...a].sort();
  const y = [...b].sort();
  return x.every((v, i) => v === y[i]);
}

/**
 * Campos comparados para decidir entre `atualizado` e `inalterado`.
 *
 * A lista é explícita de propósito. Comparar o objeto inteiro traria `updated_at`
 * e derivados junto, e a segunda importação do mesmo arquivo marcaria 1.804
 * linhas como atualizadas — enchendo a auditoria de ruído que esconde alteração
 * real depois. `import_rows` guarda a linha crua; a trilha guarda o que mudou.
 */
function compararCampos(
  linha: LinhaNormalizada,
  atual: EstabelecimentoExistente,
): string[] {
  const mudou: string[] = [];
  const par = (nome: string, a: unknown, b: unknown) => {
    if (a !== b) mudou.push(nome);
  };

  par("legal_name", linha.legalName, atual.legalName);
  par("trade_name", linha.tradeName, atual.tradeName);
  par("cep", linha.cep, atual.cep);
  par("city", linha.city, atual.city);
  par("state", linha.state, atual.state);
  par("phone", linha.phone, atual.phone);
  par("email", linha.email, atual.email);
  par("acquisition_channel", linha.acquisitionChannel, atual.acquisitionChannel);
  par("assigned_consultants_raw", linha.assignedConsultantsRaw, atual.assignedConsultantsRaw);
  par("origin", linha.origin, atual.origin);
  par("segment", linha.segmentSourceName, atual.segmentSourceName);
  par("never_transacted", linha.neverTransacted, atual.neverTransacted);
  par(
    "last_transaction_at",
    diaOuNulo(linha.lastTransactionAt),
    diaOuNulo(atual.lastTransactionAt),
  );

  if (!mesmoConjunto(linha.captureMethodSourceNames, atual.captureMethodSourceNames)) {
    mudou.push("capture_points");
  }

  return mudou;
}

/**
 * Classifica uma linha da planilha contra o estado atual.
 *
 * Ordem das decisões, e ela importa:
 *
 * 1. **Erro** vem antes de tudo: linha que não normaliza não tem como ser
 *    comparada, e tentar identificá-la produziria casamento por dado parcial.
 * 2. **Identidade por contrato** (ADR 0001), quando presente.
 * 3. **Fallback CNPJ + endereço**, só quando os dois existem. Endereço sozinho
 *    não identifica: a base tem 67 endereços repetidos — shoppings, com quatro
 *    estabelecimentos distintos no mesmo lugar — e **zero** pares CNPJ+endereço
 *    repetidos.
 * 4. **Conflito** é reportado mesmo quando a linha casou: dado que precisa de
 *    decisão administrativa não deixa de precisar por já existir na base.
 */
export function classifyImportRow(
  linha: LinhaNormalizada,
  estado: EstadoAtual,
): Classificacao {
  if (temErro(linha)) {
    return {
      status: "erro",
      establishmentId: null,
      identificadaPor: null,
      camposAlterados: [],
      motivo: linha.problemas
        .filter((p) => p.gravidade === "erro")
        .map((p) => `${p.campo}: ${p.mensagem}`)
        .join(" · "),
    };
  }

  let atual: EstabelecimentoExistente | undefined;
  let identificadaPor: Classificacao["identificadaPor"] = null;

  if (linha.externalContract !== null) {
    atual = estado.porContrato.get(linha.externalContract);
    if (atual) identificadaPor = "contrato";
  }

  if (!atual && linha.cnpj !== null && linha.enderecoHash !== null) {
    atual = estado.porCnpjEEndereco.get(`${linha.cnpj}|${linha.enderecoHash}`);
    if (atual) identificadaPor = "cnpj_endereco";
  }

  if (temConflito(linha)) {
    return {
      status: "conflito",
      establishmentId: atual?.id ?? null,
      identificadaPor,
      camposAlterados: atual ? compararCampos(linha, atual) : [],
      motivo: linha.problemas
        .filter((p) => p.gravidade === "conflito")
        .map((p) => `${p.campo}: ${p.mensagem}`)
        .join(" · "),
    };
  }

  if (!atual) {
    return {
      status: "novo",
      establishmentId: null,
      identificadaPor: null,
      camposAlterados: [],
      motivo: null,
    };
  }

  const camposAlterados = compararCampos(linha, atual);
  return {
    status: camposAlterados.length === 0 ? "inalterado" : "atualizado",
    establishmentId: atual.id,
    identificadaPor,
    camposAlterados,
    motivo: null,
  };
}

/**
 * Estabelecimentos que existem na base e não vieram no arquivo, **dentro do
 * escopo declarado** (ADR 0011).
 *
 * Nunca excluídos: vão para análise administrativa. E nunca calculados fora do
 * escopo — importar o recorte de uma cidade faria o resto da base aparecer como
 * sumido.
 */
export function encontrarAusentes(
  noEscopo: readonly EstabelecimentoExistente[],
  identificados: ReadonlySet<string>,
): EstabelecimentoExistente[] {
  return noEscopo.filter((e) => !identificados.has(e.id));
}
