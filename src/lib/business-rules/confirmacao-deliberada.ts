/**
 * A confirmação deliberada da trava de ausentes.
 *
 * Regra pura: recebe o número que o SERVIDOR contou e o que o operador digitou, e
 * devolve o que a tela mostra. Não lê banco, não conhece componente.
 *
 * ## Por que digitar o número, e não uma palavra
 *
 * Digitar a quantidade obriga a **ler** a quantidade. Uma palavra fixa como
 * `CONFIRMAR` não obriga a olhar para nada — o dedo aprende a palavra, e o atrito
 * vira ritual.
 *
 * ## Por que só acima do limiar
 *
 * Atrito em todo lugar é atrito em lugar nenhum. Se a importação rotineira também
 * exigisse digitação, a digitação viraria automatismo e a trava perderia o efeito
 * justamente no dia em que importa.
 */

export type ModoDeAplicacao =
  /** Abaixo do limiar: botão comum, sem campo, sem confirmação extra. */
  | "livre"
  /** Acima do limiar: exige a quantidade digitada. */
  | "exige_confirmacao";

export interface EstadoDaConfirmacao {
  modo: ModoDeAplicacao;
  podeAplicar: boolean;
  /**
   * Mensagem de erro, ou `null`.
   *
   * `null` também enquanto o campo está vazio: quem ainda não digitou não errou,
   * e acusar erro antes da tentativa treina a pessoa a ignorar o texto vermelho.
   */
  erro: string | null;
}

/**
 * `1412` e `1.412` são a mesma coisa.
 *
 * Exigir o ponto seria atrito sobre a DIGITAÇÃO, não sobre a leitura — e o atrito
 * aqui existe para forçar leitura. Devolve `null` para entrada sem dígito algum.
 */
export function normalizarQuantidade(texto: string): number | null {
  const digitos = texto.replace(/\D/g, "");
  if (digitos === "") return null;
  return Number(digitos);
}

export interface EntradaDaConfirmacao {
  /** Quantos seriam marcados, contado pelo SERVIDOR agora — não pela tela. */
  ausentes: number;
  /** Se ainda excede o limiar. Vem junto do número, e não é derivado dele. */
  excede: boolean;
  /** O que está no campo. `null` quando a tela não mostra campo. */
  digitado: string | null;
}

export function avaliarConfirmacao(entrada: EntradaDaConfirmacao): EstadoDaConfirmacao {
  // `excede` vem do servidor junto com o número, de propósito. Se outra
  // importação rodou nesse meio-tempo e o total caiu abaixo do limiar, a
  // digitação deixou de ser necessária — e mantê-la seria atrito sem motivo, que
  // é o que corrói a trava.
  if (!entrada.excede) {
    return { modo: "livre", podeAplicar: true, erro: null };
  }

  const valor = normalizarQuantidade(entrada.digitado ?? "");

  if (valor === null) {
    return { modo: "exige_confirmacao", podeAplicar: false, erro: null };
  }

  if (valor !== entrada.ausentes) {
    return {
      modo: "exige_confirmacao",
      podeAplicar: false,
      erro:
        `Você digitou ${valor.toLocaleString("pt-BR")}. ` +
        `A quantidade é ${entrada.ausentes.toLocaleString("pt-BR")}.`,
    };
  }

  return { modo: "exige_confirmacao", podeAplicar: true, erro: null };
}

/**
 * A recontagem no momento do envio divergiu do que a tela mostrou.
 *
 * Mesmo TOCTOU da colisão de regra do E-004: o operador aprovou um número que não
 * existe mais. Aqui o campo É limpo — ao contrário do erro de digitação, onde
 * limpar puniria quem estava quase certo.
 */
export function mensagemDeRecontagem(anterior: number, atual: number): string {
  return (
    `A base mudou desde que esta prévia foi montada. ` +
    `Agora seriam ${atual.toLocaleString("pt-BR")} ausentes, não ${anterior.toLocaleString("pt-BR")}. ` +
    `Os números foram recarregados — confira antes de confirmar.`
  );
}
