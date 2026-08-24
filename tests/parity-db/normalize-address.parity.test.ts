/**
 * Paridade de `normalize_address` (ADR 0001).
 *
 * A mais importante do sistema. O hash desta normalização é **chave persistida**:
 * divergência entre SQL e TypeScript faz a importação tratar o mesmo ponto
 * credenciado como dois, e não existe conserto que não passe por migração de
 * dados — os hashes errados já estarão gravados.
 *
 * Por isso esta paridade entra no primeiro commit da Sprint 1, antes de qualquer
 * tabela de estabelecimento existir.
 */
import { normalizeAddress } from "@/lib/business-rules/normalize-address";
import { ENTRADAS_ENDERECO, type EntradaEndereco } from "../fixtures/normalize-address";
import { verificarParidade } from "./harness";

verificarParidade<EntradaEndereco>(
  {
    nome: "normalize_address",
    funcaoSql: "normalize_address",
    argumentosSql: (e) => [e.bruto, e.cep],
    funcaoTs: (e) => normalizeAddress(e.bruto, e.cep),
    rotulo: (e) => `${JSON.stringify(e.bruto)} + cep ${JSON.stringify(e.cep)}`,
  },
  ENTRADAS_ENDERECO,
);
