/**
 * Agenda do sítio — fonte única da disponibilidade.
 *
 * Substitui o Google Calendar, que vivia perdendo a autenticação e
 * deixava a Júlia sem saber o que estava livre. Agora as reservas e os
 * bloqueios moram no Supabase, e tanto o site quanto o agente do
 * WhatsApp consultam daqui.
 *
 * Regra de sobreposição: duas estadias colidem quando
 * `inicioA < fimB && inicioB < fimA`.
 *
 * O DIA DA SAÍDA CONTA COMO OCUPADO. O hóspede sai às 16h e ainda há
 * limpeza e arrumação; na prática o sítio só volta a ficar livre no dia
 * seguinte. Por isso o período ocupado vai do check-in ao check-out
 * INCLUSIVE, e a próxima entrada possível é no dia seguinte à saída.
 */

import { getSupabase, type Reserva } from "./supabase";
import { formatarDataBR } from "./pricing";
import {
  diasOcupadosDaLista,
  fimDaJanela,
  finsDeSemanaLivres,
  hojeISO,
  periodosColidem,
  somaDiasISO,
  type Periodo,
} from "./ocupacao";

export { fimDaJanela, hojeISO };

export type Conflito = {
  tipo: "reserva" | "bloqueio";
  inicio: string;
  fim: string;
  /** Descrição sem dado pessoal — o retorno é público. */
  descricao: string;
};

export type Disponibilidade = {
  livre: boolean;
  checkin: string;
  checkout: string;
  conflitos: Conflito[];
  /** Frase pronta, do jeito que pode ser dita ao cliente. */
  resumo: string;
};

/**
 * Verifica se o período está livre.
 * Reservas canceladas não ocupam data.
 */
export async function verificarDisponibilidade(
  checkin: string,
  checkout: string,
): Promise<Disponibilidade> {
  const supabase = getSupabase();

  // Busca só o que pode encostar no período pedido, com uma folga de
  // alguns dias para não depender de comparação de data no banco.
  const [resReservas, resBloqueios] = await Promise.all([
    supabase
      .from("reservas")
      .select("id, data_checkin, data_checkout, status, qtd_pessoas")
      .neq("status", "CANCELADA")
      // Alarga um dia: a saída ocupa, então uma reserva que termina no
      // próprio check-in pedido ainda conflita.
      .lte("data_checkin", checkout)
      .gte("data_checkout", somaDiasISO(checkin, -1)),
    supabase
      .from("datas_bloqueadas")
      .select("id, data_inicio, data_fim, motivo")
      .lte("data_inicio", checkout)
      .gte("data_fim", checkin),
  ]);

  if (resReservas.error) {
    throw new Error(`Falha ao ler reservas: ${resReservas.error.message}`);
  }
  if (resBloqueios.error) {
    throw new Error(`Falha ao ler bloqueios: ${resBloqueios.error.message}`);
  }

  const conflitos: Conflito[] = [];

  for (const r of (resReservas.data ?? []) as Partial<Reserva>[]) {
    if (!r.data_checkin || !r.data_checkout) continue;
    if (periodosColidem(checkin, checkout, r.data_checkin, r.data_checkout)) {
      conflitos.push({
        tipo: "reserva",
        inicio: r.data_checkin,
        fim: r.data_checkout,
        descricao: `Já reservado de ${formatarDataBR(r.data_checkin)} a ${formatarDataBR(r.data_checkout)}`,
      });
    }
  }

  for (const b of resBloqueios.data ?? []) {
    // O bloqueio é inclusivo nas duas pontas, igual à reserva.
    if (periodosColidem(checkin, checkout, b.data_inicio, b.data_fim)) {
      conflitos.push({
        tipo: "bloqueio",
        inicio: b.data_inicio,
        fim: b.data_fim,
        descricao: b.motivo
          ? `Indisponível de ${formatarDataBR(b.data_inicio)} a ${formatarDataBR(b.data_fim)}: ${b.motivo}`
          : `Indisponível de ${formatarDataBR(b.data_inicio)} a ${formatarDataBR(b.data_fim)}`,
      });
    }
  }

  const livre = conflitos.length === 0;

  return {
    livre,
    checkin,
    checkout,
    conflitos,
    resumo: livre
      ? `LIVRE: de ${formatarDataBR(checkin)} a ${formatarDataBR(checkout)} está disponível.`
      : `OCUPADO: de ${formatarDataBR(checkin)} a ${formatarDataBR(checkout)} não está disponível.`,
  };
}

// ============================================================
//  A agenda inteira, como conjunto de dias
//
//  A checagem período a período responde "esta data dá?". O calendário
//  do site precisa do contrário: quais datas NÃO dão, todas de uma vez,
//  para já nascer com elas bloqueadas.
//
//  O que ocupa é o mesmo que ocupa em `verificarDisponibilidade`:
//  reservas não canceladas e bloqueios do painel. Orçamento em aberto
//  NÃO entra — é lead, não é reserva, e segurar data por causa de um
//  pedido de preço afastaria quem estava pronto para fechar.
// ============================================================

export type AgendaOcupada = {
  de: string;
  ate: string;
  /** Dias ocupados em ISO, ordenados. Só datas — nada de quem reservou. */
  dias: string[];
};

/**
 * Todos os dias ocupados numa janela. É o que a página pública mostra e
 * o que a calculadora usa para não deixar escolher data vendida.
 */
export async function agendaOcupada(
  de: string = hojeISO(),
  ate: string = fimDaJanela(de),
): Promise<AgendaOcupada> {
  const supabase = getSupabase();

  const [resReservas, resBloqueios] = await Promise.all([
    supabase
      .from("reservas")
      .select("data_checkin, data_checkout")
      .neq("status", "CANCELADA")
      .lte("data_checkin", ate)
      .gte("data_checkout", de),
    supabase
      .from("datas_bloqueadas")
      .select("data_inicio, data_fim")
      .lte("data_inicio", ate)
      .gte("data_fim", de),
  ]);

  if (resReservas.error) {
    throw new Error(`Falha ao ler reservas: ${resReservas.error.message}`);
  }
  if (resBloqueios.error) {
    throw new Error(`Falha ao ler bloqueios: ${resBloqueios.error.message}`);
  }

  const periodos: Periodo[] = [];

  for (const r of (resReservas.data ?? []) as Partial<Reserva>[]) {
    if (!r.data_checkin) continue;
    periodos.push({
      inicio: r.data_checkin,
      // Reserva sem saída registrada ocupa ao menos o dia da entrada.
      fim: r.data_checkout ?? r.data_checkin,
    });
  }

  for (const b of resBloqueios.data ?? []) {
    periodos.push({ inicio: b.data_inicio, fim: b.data_fim });
  }

  return { de, ate, dias: diasOcupadosDaLista(periodos, de, ate) };
}

/**
 * Próximas datas livres a partir de hoje, para quando o cliente pergunta
 * "o que você tem disponível?". Devolve fins de semana completos.
 *
 * Antes isto era uma consulta ao banco POR FIM DE SEMANA — até 26 idas
 * e voltas para responder uma pergunta. Agora é uma só: traz a janela
 * inteira e decide em memória.
 */
export async function proximosFinsDeSemanaLivres(
  quantidade = 4,
): Promise<{ checkin: string; checkout: string }[]> {
  const hoje = hojeISO();
  const { dias } = await agendaOcupada(hoje);
  return finsDeSemanaLivres(new Set(dias), hoje, quantidade);
}
