/**
 * Os fatos que a Júlia pode afirmar.
 *
 * Este arquivo existe porque um cliente quase foi perdido: em 14/08/2026 a
 * Júlia disse duas vezes que 02 a 04/10 estava ocupado. Estava livre — a
 * única reserva de outubro começava no dia 05.
 *
 * Ela não inventou do nada. O sistema mandou a ela uma lista de fins de
 * semana livres que ia só até setembro, nenhuma palavra sobre outubro, e o
 * modelo preencheu o silêncio com a conclusão errada. **Onde o sistema cala,
 * a IA chuta.**
 *
 * Daí as duas regras que este módulo aplica:
 *
 *  1. Sempre que houver duas datas, a agenda é consultada e o resultado
 *     aparece nos fatos. Disponibilidade não depende de saber quantas
 *     pessoas vão — o número de pessoas só faz falta para o preço.
 *  2. Quando a agenda não foi consultada, os fatos dizem isso em voz alta e
 *     proíbem a IA de afirmar qualquer coisa sobre a data — nos DOIS
 *     sentidos. A regra antiga só proibia dizer "está livre", e foi pela
 *     brecha do "está ocupado" que o erro passou.
 */

import type { Disponibilidade } from "./agenda.ts";
import {
  formatarBRL,
  formatarDataBR,
  type LinhaTabela,
  type OrcamentoResultado,
} from "./pricing.ts";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Duas datas bem formadas e em ordem — o mínimo para consultar a agenda. */
export function periodoConferivel(checkin: string, checkout: string): boolean {
  return ISO.test(checkin) && ISO.test(checkout) && checkout > checkin;
}

/**
 * A frase sobre disponibilidade. Nunca é omitida: a omissão é exatamente o
 * que fez a IA chutar.
 */
export function fatoDisponibilidade(
  disponibilidade: Disponibilidade | null,
  conferivel: boolean,
): string {
  if (disponibilidade) {
    return disponibilidade.livre
      ? "✅ DISPONIBILIDADE: a data está LIVRE. Pode confirmar ao cliente."
      : `❌ DISPONIBILIDADE: a data NÃO está livre. ${disponibilidade.conflitos
          .map((c) => c.descricao)
          .join(" ")}`;
  }

  if (!conferivel) {
    return (
      "⚠️ DISPONIBILIDADE NÃO CONFERIDA: falta a data de entrada ou a de saída. " +
      "NÃO diga que a data está livre NEM que está ocupada — peça a data que falta."
    );
  }

  return (
    "⚠️ DISPONIBILIDADE NÃO CONFERIDA: a agenda não respondeu agora. " +
    "NÃO diga que a data está livre NEM que está ocupada — diga que vai confirmar e avisar em seguida."
  );
}

/** Fatos de quando o cliente ainda não deu data: só a vitrine de preços. */
export function fatosSemData(
  tabela: LinhaTabela[],
  sugestoes: { checkin: string; checkout: string }[],
): string {
  const linhas = [
    "O cliente ainda não informou data.",
    ...tabela.map(
      (l) =>
        `${l.titulo} (${l.detalhe}): ${l.prefixo ? l.prefixo + " " : ""}${formatarBRL(l.valor)}`,
    ),
  ];

  if (sugestoes.length > 0) {
    linhas.push(
      "Fins de semana livres a sugerir: " +
        sugestoes
          .map((s) => `${formatarDataBR(s.checkin)} a ${formatarDataBR(s.checkout)}`)
          .join("; "),
      // Sem esta ressalva o modelo lê a lista curta como se fosse a agenda
      // inteira e conclui que todo o resto está ocupado. Foi o que aconteceu.
      "⚠️ Essa lista é apenas uma sugestão dos próximos fins de semana livres, " +
        "NÃO é a agenda completa. Datas fora dela não estão ocupadas: só não foram conferidas.",
    );
  }

  linhas.push(
    "⛔ Não invente valores fora desta lista.",
    "⛔ Nenhuma data foi conferida nesta consulta. Não afirme que uma data específica " +
      "está livre nem que está ocupada — se o cliente citar uma data, peça a de saída " +
      "também e consulte antes de responder.",
  );

  return linhas.join("\n");
}

/** Fatos de quando já há data: disponibilidade sempre, preço quando der. */
export function fatosComData(args: {
  orcamento: OrcamentoResultado;
  disponibilidade: Disponibilidade | null;
  conferivel: boolean;
}): string {
  const { orcamento, disponibilidade, conferivel } = args;

  // Faltando o número de pessoas, o preço não sai — mas a data já pode ser
  // respondida, e é a resposta que o cliente está esperando.
  if (!orcamento.valido) {
    return [
      fatoDisponibilidade(disponibilidade, conferivel),
      `Ainda não dá para calcular o valor: ${orcamento.erro}`,
      "Peça essa informação que falta e NÃO mencione nenhum valor.",
    ].join("\n");
  }

  const linhas: string[] = [];

  if (orcamento.pacoteObrigatorio) {
    linhas.push(
      `⚠️ A data pedida cai em feriado. ${orcamento.pacoteObrigatorio.motivo}`,
    );
    if (orcamento.pacoteObrigatorio.inicioAlternativo) {
      linhas.push(
        `O cliente também pode entrar em ${formatarDataBR(orcamento.pacoteObrigatorio.inicioAlternativo)}, pagando o mesmo pacote.`,
      );
    }
  }

  linhas.push(
    `Período: ${formatarDataBR(orcamento.checkin)} a ${formatarDataBR(orcamento.checkout)} (${orcamento.dias} ${orcamento.dias === 1 ? "diária" : "diárias"}).`,
    `Pessoas: ${orcamento.pessoas}.`,
    `Tipo de cálculo: ${orcamento.tipoCalculo}.`,
    `╔══ VALOR OFICIAL ══╗ ${formatarBRL(orcamento.valorTotal)}`,
    `Caução à parte: ${formatarBRL(orcamento.caucao)}, devolvida ao final.`,
  );

  if (orcamento.valorHidromassagem > 0) {
    linhas.push(
      `Inclui hidromassagem: ${formatarBRL(orcamento.valorHidromassagem)}.`,
    );
  }

  linhas.push(fatoDisponibilidade(disponibilidade, conferivel));

  if (orcamento.upsell) linhas.push(`Sugestão de venda: ${orcamento.upsell}`);

  linhas.push(
    "⛔ Use exatamente o VALOR OFICIAL acima. Nunca arredonde, nunca invente outro número.",
  );

  return linhas.join("\n");
}
