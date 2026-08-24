import { createHash } from "node:crypto";
import {
  normalizeAddress,
  normalizeCep,
  normalizeCnpj,
  normalizePhone,
  parseBrazilianDate,
} from "./normalize-address";
import {
  addressHashInput,
  parseEndereco,
  semNumero,
  type EnderecoDecomposto,
} from "./parse-endereco";

/**
 * Uma linha da planilha, crua, com as 20 colunas na grafia da origem.
 *
 * O importador não conhece o `.xlsx`: quem lê o arquivo entrega este formato.
 * Isso mantém a regra testável sem a biblioteca de planilha, e a biblioteca
 * confinada a um adaptador.
 */
export interface LinhaCrua {
  Empresa: string;
  "Data de Cadastro": string;
  Contrato: string;
  CNPJ: string;
  "Razão Social": string;
  Status: string;
  Descrição: string;
  Endereço: string;
  CEP: string;
  Cidade: string;
  UF: string;
  Telefone: string;
  CNAE: string;
  Subgrupo: string;
  Consultores: string;
  Origem: string;
  "E-mail": string;
  Captação: string;
  Terminal: string;
  "Última Transação": string;
}

/** Motivo pelo qual a linha não pode ser aplicada como está. */
export interface ProblemaDaLinha {
  campo: keyof LinhaCrua;
  /** `erro` impede aplicar; `conflito` exige decisão administrativa. */
  gravidade: "erro" | "conflito";
  mensagem: string;
}

export interface LinhaNormalizada {
  externalContract: string | null;
  cnpj: string | null;
  legalName: string;
  tradeName: string;
  registrationStatusRaw: string;
  descriptionRaw: string;
  endereco: EnderecoDecomposto | null;
  enderecoBruto: string;
  cep: string | null;
  city: string;
  state: string;
  phone: string | null;
  email: string | null;
  cnaeHint: string | null;
  /** Valor **cru** de `Subgrupo`: é a chave de reconciliação de `segments`. */
  segmentSourceName: string | null;
  /** Valor cru de `Consultores`. Nunca casado com `profiles` (Sprint 3). */
  assignedConsultantsRaw: string | null;
  origin: string | null;
  acquisitionChannel: string | null;
  /** Valores crus de `Terminal`, separados por `/`. Alimentam `capture_methods`. */
  captureMethodSourceNames: string[];
  lastTransactionAt: Date | null;
  neverTransacted: boolean;
  relationshipStartDate: Date | null;
  /**
   * Hash do endereço normalizado, calculado do mesmo jeito que o banco calcula a
   * coluna gerada (migration 0032).
   *
   * Existe porque o fallback de identidade do ADR 0001 casa a linha por
   * CNPJ + hash **antes** de gravar: sem ele, o diferenciador não teria como
   * reconhecer um estabelecimento sem contrato.
   */
  enderecoHash: string | null;
  /** Sem número na origem (`N.º: 0`): o fallback de identidade fica fraco. */
  enderecoSemNumero: boolean;
  problemas: ProblemaDaLinha[];
}

const vazio = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

/**
 * `-` é placeholder de vazio, não um e-mail.
 *
 * 1.255 das 1.804 linhas trazem `-`. Sem esta normalização, 70% da base ficaria
 * com e-mail `-` — e qualquer tela de contato mostraria um traço como se fosse
 * endereço válido.
 */
function normalizeEmail(bruto: string): string | null {
  const texto = vazio(bruto);
  if (texto === "" || texto === "-") return null;
  return texto.includes("@") ? texto.toLowerCase() : null;
}

/**
 * `Terminal` traz nomes de adquirente e gateway separados por ` / `, nunca número
 * de terminal — zero dos 1.804 valores contém dígito.
 *
 * Cada parte vira um meio de captura, com o valor cru como chave de
 * reconciliação. 13 meios distintos na base.
 *
 * Deduplica: 9 das 1.804 linhas listam o mesmo meio duas vezes — `CIELO / CIELO`,
 * `Software Express Sitef / CIELO / Rede / Rede`. Como a identidade de um ponto é
 * `(establishment_id, capture_method_id)`, inserir os dois violaria o índice
 * único e a primeira importação quebraria. São 3.586 partes brutas e **3.577**
 * vínculos.
 */
export function separarMeiosDeCaptura(bruto: string): string[] {
  return [
    ...new Set(
      vazio(bruto)
        .split("/")
        .map((p) => p.trim())
        .filter((p) => p !== ""),
    ),
  ];
}

const NUNCA_TRANSACIONOU = /nunca\s+transacionou/i;

export function normalizeLinhaImportacao(linha: LinhaCrua): LinhaNormalizada {
  const problemas: ProblemaDaLinha[] = [];

  const contrato = vazio(linha.Contrato);
  const cnpjBruto = vazio(linha.CNPJ);
  const cnpj = normalizeCnpj(cnpjBruto);

  // CPF em vez de CNPJ: pessoa física credenciada, com contrato válido. A base
  // tem um caso — Mercearia do Carlito. **Conflito, não erro**: rejeitar
  // perderia dado real, e dado perdido na importação não volta. A decisão sobre
  // aceitar pessoa física é do negócio, não do importador.
  if (cnpj === null && cnpjBruto !== "") {
    const digitos = cnpjBruto.replace(/\D/g, "");
    problemas.push({
      campo: "CNPJ",
      gravidade: "conflito",
      mensagem:
        digitos.length === 11
          ? `Documento com 11 dígitos (CPF), não CNPJ. Pessoa física credenciada — decisão administrativa pendente.`
          : `CNPJ com ${digitos.length} dígitos, esperado 14.`,
    });
  }

  const endereco = parseEndereco(vazio(linha.Endereço));
  if (endereco === null) {
    problemas.push({
      campo: "Endereço",
      gravidade: "erro",
      mensagem:
        "Endereço fora do padrão `Logradouro - N.º: X - Bairro`. Sem os componentes não há como calcular a identidade.",
    });
  }

  const cep = normalizeCep(vazio(linha.CEP));
  if (cep === null && vazio(linha.CEP) !== "") {
    problemas.push({ campo: "CEP", gravidade: "erro", mensagem: "CEP fora de 8 dígitos." });
  }

  const ultima = vazio(linha["Última Transação"]);
  const neverTransacted = NUNCA_TRANSACIONOU.test(ultima);
  const lastTransactionAt = neverTransacted ? null : parseBrazilianDate(ultima);
  if (!neverTransacted && ultima !== "" && lastTransactionAt === null) {
    problemas.push({
      campo: "Última Transação",
      gravidade: "erro",
      mensagem: `Data "${ultima}" não está em DD/MM/AAAA nem é "Nunca Transacionou".`,
    });
  }

  const cadastro = vazio(linha["Data de Cadastro"]);
  const relationshipStartDate = parseBrazilianDate(cadastro);
  if (cadastro !== "" && relationshipStartDate === null) {
    problemas.push({
      campo: "Data de Cadastro",
      gravidade: "erro",
      mensagem: `Data "${cadastro}" não está em DD/MM/AAAA.`,
    });
  }

  // Sem contrato, a identidade cai para o fallback CNPJ + endereço (ADR 0001).
  // Se o endereço também não tem número, o fallback fica fraco: é o caso a
  // sinalizar na prévia, não a rejeitar.
  const enderecoSemNumero = endereco !== null && semNumero(endereco);
  if (contrato === "" && enderecoSemNumero) {
    problemas.push({
      campo: "Contrato",
      gravidade: "conflito",
      mensagem:
        "Sem contrato e sem número no endereço: a identidade de fallback fica fraca e pode confundir dois pontos no mesmo logradouro.",
    });
  }

  return {
    externalContract: contrato === "" ? null : contrato,
    cnpj,
    legalName: vazio(linha["Razão Social"]) || vazio(linha.Empresa),
    tradeName: vazio(linha.Empresa),
    registrationStatusRaw: vazio(linha.Status),
    // Guardada crua, sem parse: `Descrição` traz `TEF`, que não existe em
    // `Terminal`, e duas fontes para o mesmo fato é o problema já evitado três
    // vezes neste projeto.
    descriptionRaw: vazio(linha.Descrição),
    endereco,
    enderecoBruto: vazio(linha.Endereço),
    cep,
    city: vazio(linha.Cidade),
    state: vazio(linha.UF),
    phone: normalizePhone(vazio(linha.Telefone)),
    email: normalizeEmail(linha["E-mail"]),
    cnaeHint: vazio(linha.CNAE) || null,
    segmentSourceName: vazio(linha.Subgrupo) || null,
    assignedConsultantsRaw: vazio(linha.Consultores) || null,
    origin: vazio(linha.Origem) || null,
    acquisitionChannel: vazio(linha.Captação) || null,
    captureMethodSourceNames: separarMeiosDeCaptura(linha.Terminal),
    lastTransactionAt,
    neverTransacted,
    relationshipStartDate,
    enderecoHash:
      endereco === null
        ? null
        : createHash("md5")
            .update(
              normalizeAddress(
                addressHashInput(
                  endereco.streetName,
                  endereco.streetNumber,
                  endereco.district,
                ),
                cep,
              ),
            )
            .digest("hex"),
    enderecoSemNumero,
    problemas,
  };
}

export function temErro(linha: LinhaNormalizada): boolean {
  return linha.problemas.some((p) => p.gravidade === "erro");
}

export function temConflito(linha: LinhaNormalizada): boolean {
  return linha.problemas.some((p) => p.gravidade === "conflito");
}
