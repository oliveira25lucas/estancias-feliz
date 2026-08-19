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
  nomeDiaSemana,
  type Feriado,
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

/**
 * A frase de quando o cliente pediu o feriado pelo nome.
 *
 * Ela existe para ser dita em voz alta ao cliente. Em 18/08/2026 uma
 * cliente perguntou por "carnaval 2027" e recebeu preço de 18 a 22/02 —
 * datas que ninguém tinha falado e que não são o Carnaval. Quem pergunta
 * pelo nome do feriado quase nunca sabe em que dia ele cai; dizer as
 * datas é metade da resposta.
 */
export function fatoFeriadoPedido(termo: string, feriado: Feriado): string {
  const ano = feriado.data.slice(0, 4);
  return (
    `📅 O cliente falou em "${termo}", não em datas. ` +
    `${feriado.nome} de ${ano} cai em ${nomeDiaSemana(feriado.data).toLowerCase()}, ` +
    `${formatarDataBR(feriado.data)}, e o sítio é alugado fechado no bloco de ` +
    `${formatarDataBR(feriado.inicio)} a ${formatarDataBR(feriado.fim)}. ` +
    `DIGA ESSAS DATAS ao cliente — ele provavelmente não sabe quais são.`
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
  /** Preenchido quando o período veio do nome de um feriado, não de datas. */
  feriadoPedido?: { termo: string; feriado: Feriado } | null;
}): string {
  const { orcamento, disponibilidade, conferivel, feriadoPedido } = args;

  const cabecalho = feriadoPedido
    ? [fatoFeriadoPedido(feriadoPedido.termo, feriadoPedido.feriado)]
    : [];

  // Faltando o número de pessoas, o preço não sai — mas a data já pode ser
  // respondida, e é a resposta que o cliente está esperando.
  if (!orcamento.valido) {
    return [
      ...cabecalho,
      // O período vem ANTES da disponibilidade, e não pode faltar: um
      // "❌ a data não está livre" solto não diz de qual data se trata, e
      // a IA acaba colando o resultado numa data que o cliente nem pediu.
      conferivel
        ? `Período conferido: ${formatarDataBR(orcamento.checkin)} a ${formatarDataBR(orcamento.checkout)}.`
        : "",
      fatoDisponibilidade(disponibilidade, conferivel),
      `Ainda não dá para calcular o valor: ${orcamento.erro}`,
      "Peça essa informação que falta e NÃO mencione nenhum valor.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const linhas: string[] = [...cabecalho];

  if (orcamento.pacoteObrigatorio) {
    linhas.push(
      `⚠️ A data pedida cai em feriado. ${orcamento.pacoteObrigatorio.motivo}`,
    );
    if (orcamento.pacoteObrigatorio.inicioAlternativo) {
      linhas.push(
        `O cliente também pode entrar em ${formatarDataBR(orcamento.pacoteObrigatorio.inicioAlternativo)}, pagando o mesmo pacote.`,
      );
    }
    // Chegar depois não abate nada: o bloco é fechado e já está pago.
    // Dizer isso é honesto e ainda melhora a estadia de quem entra tarde.
    linhas.push(
      `Entrar depois do primeiro dia do bloco NÃO reduz o valor — vale avisar que ` +
        `ele pode chegar já em ${formatarDataBR(orcamento.checkin)} sem pagar nada a mais.`,
    );
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
