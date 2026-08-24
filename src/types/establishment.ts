import type { RegistrationStatus } from "@/constants/establishment-status";
import type { OperationalStatus } from "@/constants/operational-status";
import type { TransactionStatus } from "@/constants/transaction-status";

/**
 * Ponto credenciado (ADR 0001). A identidade e o contrato externo; o CNPJ e
 * atributo, porque o mesmo CNPJ tem varias lojas.
 *
 * Conferido campo a campo contra o schema real das migrations 0018 a 0022. A
 * versao anterior foi escrita na Sprint 0, antes de a tabela existir, e faltavam
 * oito colunas.
 */
export interface Establishment {
  id: string;
  externalContract: string | null;
  cnpj: string | null;
  legalName: string;
  tradeName: string;
  segmentId: string | null;
  registrationStatus: RegistrationStatus;
  operationalStatus: OperationalStatus;
  /**
   * Desde quando existe relacionamento — coluna `Data de Cadastro` da planilha.
   * Nao confundir com `createdAt`, que e quando o registro entrou neste sistema.
   */
  relationshipStartDate: string | null;
  lastTransactionAt: string | null;
  /**
   * Verdadeiro apenas quando a planilha trouxe o texto `Nunca Transacionou`.
   * Nulo em `lastTransactionAt` sem esta flag significa dado nao informado — a
   * distincao e garantida por constraint no banco.
   */
  neverTransacted: boolean;
  phone: string | null;
  email: string | null;
  origin: string | null;
  /**
   * Coluna `Captacao` da planilha: como o comercio foi CREDENCIADO —
   * `Pessoalmente`, `E-Mail`, `Telefone`, `Site`, `Licitacao`.
   *
   * Nao confundir com meio de captura de transacao, que e `CaptureMethod` e vem
   * da coluna `Terminal`. A confusao entre os dois chegou a virar instrucao de
   * projeto antes de a base real ser medida.
   */
  acquisitionChannel: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Endereco historico. `isCurrent` marca o vigente, e ha no maximo um por
 * estabelecimento, garantido por indice unico parcial.
 */
export interface EstablishmentAddress {
  id: string;
  establishmentId: string;
  /**
   * Endereco bruto da planilha, preservado intocado — inclusive o rotulo `N.º:`
   * do formulario de origem (ADR 0006).
   */
  street: string;
  /** Logradouro, do padrao `Logradouro - N.º: X - Bairro`. Alimenta o hash. */
  streetName: string | null;
  /** Numero. `0` na origem significa sem numero: 61 casos na base real. */
  streetNumber: string | null;
  /** Bairro, do mesmo padrao. Alimenta o hash. */
  district: string | null;
  cep: string | null;
  city: string;
  state: string;
  /**
   * GERADA PELO BANCO. `readonly` aqui nao e estilo: a coluna e
   * `generated always as (...) stored` e recusa escrita.
   *
   * Calculada sobre os COMPONENTES — logradouro, numero e bairro — e nao sobre
   * `street`. O rotulo `N.º:` do formulario de origem fica fora do hash: se ele
   * mudar na origem, os hashes nao mudam junto (migration 0028). Quem calcula e o banco, para que um defeito no importador nao possa
   * gravar hash divergente — divergencia em hash persistido so se corrige com
   * migracao de dados (ADR 0001).
   *
   * Nulavel porque o Postgres nao prova nao-nulidade de coluna gerada.
   */
  readonly normalizedAddress: string | null;
  /** GERADA PELO BANCO — md5 de `normalizedAddress`. Ver acima. */
  readonly addressHash: string | null;
  /** Populadas na Sprint 2, pelo worker de geocodificacao (ADR 0006). */
  latitude: number | null;
  longitude: number | null;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Estado do ponto de captura. Seis valores, conforme o complemento de escopo §11.
 *
 * A distincao que importa nao e "em uso", e sim **ocupa o numero do terminal**:
 * `ativo`, `em_homologacao` e `com_erro` ocupam; `inativo`, `substituido` e
 * `cancelado` liberam. E o predicado do indice unico parcial.
 */
export type CapturePointStatus =
  | "ativo"
  | "inativo"
  | "em_homologacao"
  | "com_erro"
  | "substituido"
  | "cancelado";

/** Estados que prendem o numero do terminal. Espelha o indice parcial da 0022. */
export const CAPTURE_POINT_OCCUPYING_STATUSES: readonly CapturePointStatus[] = [
  "ativo",
  "em_homologacao",
  "com_erro",
];

/**
 * Ponto de captura. `Terminal` deixou de ser coluna do estabelecimento e virou
 * tabela filha, entao um estabelecimento com dois terminais deixa de ser ambiguo.
 */
export interface EstablishmentCapturePoint {
  id: string;
  establishmentId: string;
  /** Nulo ate o importador reconciliar o valor de `Terminal` com `captureMethods`. */
  captureMethodId: string | null;
  /**
   * NULO em toda a base atual. A coluna `Terminal` da planilha traz nome de
   * adquirente e gateway separados por `/` — zero dos 1.804 valores contem
   * digito. Fica para quando houver origem que traga o numero de fato.
   */
  terminalNumber: string | null;
  status: CapturePointStatus;
  /**
   * No maximo um por estabelecimento, por indice unico parcial — e nulo nao e
   * primario, entao varios nulos convivem.
   *
   * Nulo em toda a base atual: deduzir o principal pela ordem em que os meios
   * aparecem numa string seria dado fabricado.
   */
  isPrimary: boolean | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Meio de captura de transacao — adquirente ou gateway.
 *
 * A tabela nasce vazia: quem popula e o importador, a partir da coluna
 * `Terminal`, separando por `/`. Treze meios na base real, sendo Software
 * Express Sitef, Resomaq, Software Express CARD SE e CIELO os mais frequentes.
 *
 * `sourceName` guarda o valor cru e e a chave de reconciliacao na proxima
 * importacao, mesma disciplina de `segments`.
 */
export interface CaptureMethod {
  id: string;
  sourceName: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** As cinco dimensoes juntas, como o mapa e a ficha precisam. */
export interface EstablishmentStatusView {
  registration: RegistrationStatus;
  operational: OperationalStatus;
  transaction: TransactionStatus;
  daysSinceTransaction: number | null;
}
