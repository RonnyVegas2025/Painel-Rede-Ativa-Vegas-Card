import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import type {
  CaptureMethod,
  Establishment,
  EstablishmentAddress,
  EstablishmentCapturePoint,
} from "@/types/establishment";
import type { ImportJob, ImportRow } from "@/types/import";

/**
 * Os tipos de dominio nao podem divergir do schema.
 *
 * `src/types/establishment.ts` e `import.ts` foram escritos na Sprint 0, antes de
 * as tabelas existirem. Quando as migrations chegaram, `Establishment` estava sem
 * oito colunas, `EstablishmentAddress` sem `addressHash`, e `ImportJob` sem o
 * escopo inteiro e sem a trava de confirmacao — divergencias que nada detectava,
 * porque nada ligava um lado ao outro.
 *
 * Isto liga. As assercoes abaixo sao de TIPO, nao de execucao: quando uma coluna
 * entra numa migration e o tipo de dominio nao acompanha, `npm run typecheck`
 * falha, no job `aplicacao` do CI, antes de qualquer tela ser construida em cima
 * do tipo errado.
 *
 * Compara apenas o CONJUNTO DE CAMPOS, e nao os tipos de cada um. Nomear a coluna
 * e o que se esquece; o tipo do campo, quando o nome existe, o compilador ja
 * cobra em todo uso.
 */

/** `never_transacted` -> `neverTransacted`. */
type CamelCase<S extends string> = S extends `${infer Head}_${infer Tail}`
  ? `${Head}${Capitalize<CamelCase<Tail>>}`
  : S;

type CamelKeys<T> = { [K in keyof T as CamelCase<K & string>]: T[K] };

type Linha<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

/** Verdadeiro apenas quando os dois conjuntos de chaves coincidem exatamente. */
type MesmasChaves<Dominio, Row> = [keyof Dominio] extends [keyof CamelKeys<Row>]
  ? [keyof CamelKeys<Row>] extends [keyof Dominio]
    ? true
    : false
  : false;

// Cada linha falha o typecheck se o tipo de dominio e a tabela divergirem. O erro
// aponta o tipo, e a mensagem do compilador lista a chave que sobra ou falta.
const estabelecimento: MesmasChaves<Establishment, Linha<"establishments">> = true;
const endereco: MesmasChaves<EstablishmentAddress, Linha<"establishment_addresses">> = true;
const pontoDeCaptura: MesmasChaves<
  EstablishmentCapturePoint,
  Linha<"establishment_capture_points">
> = true;
const meioDeCaptura: MesmasChaves<CaptureMethod, Linha<"capture_methods">> = true;
const importacao: MesmasChaves<ImportJob, Linha<"import_jobs">> = true;
const linhaDaImportacao: MesmasChaves<ImportRow, Linha<"import_rows">> = true;

describe("tipos de dominio acompanham o schema", () => {
  it.each([
    ["Establishment x establishments", estabelecimento],
    ["EstablishmentAddress x establishment_addresses", endereco],
    ["EstablishmentCapturePoint x establishment_capture_points", pontoDeCaptura],
    ["CaptureMethod x capture_methods", meioDeCaptura],
    ["ImportJob x import_jobs", importacao],
    ["ImportRow x import_rows", linhaDaImportacao],
  ])("%s tem exatamente os mesmos campos", (_nome, coincide) => {
    // A verificacao real acontece no typecheck. Isto existe para a suite reportar
    // o par verificado por nome, em vez de o arquivo passar despercebido.
    expect(coincide).toBe(true);
  });
});
