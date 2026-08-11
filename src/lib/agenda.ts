/**
 * Agenda do sítio — fonte única da disponibilidade.
 *
 * Substitui o Google Calendar, que vivia perdendo a autenticação e
 * deixava a Júlia sem saber o que estava livre. Agora as reservas e os
 * bloqueios moram no Supabase, e tanto o site quanto o agente do
 * WhatsApp consultam daqui.
 *
 * Regra de sobreposição: duas estadias colidem quando
 * `inicioA < fimB && inicioB < fimA`. O dia da saída não conta como
 * ocupado — quem sai às 16h libera a data para quem entra no dia
 * seguinte, e o check-out do sábado não impede a entrada no sábado.
 */

import { getSupabase, type Reserva } from "./supabase";
import { formatarDataBR } from "./pricing";

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

function seSobrepoe(
  inicioA: string,
  fimA: string,
  inicioB: string,
  fimB: string,
): boolean {
  return inicioA < fimB && inicioB < fimA;
}

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
      .neq("status", "cancelada")
      .lt("data_checkin", checkout)
      .gt("data_checkout", checkin),
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
    if (seSobrepoe(checkin, checkout, r.data_checkin, r.data_checkout)) {
      conflitos.push({
        tipo: "reserva",
        inicio: r.data_checkin,
        fim: r.data_checkout,
        descricao: `Já reservado de ${formatarDataBR(r.data_checkin)} a ${formatarDataBR(r.data_checkout)}`,
      });
    }
  }

  for (const b of resBloqueios.data ?? []) {
    // O bloqueio é inclusivo nas duas pontas: o dia final também está
    // indisponível, diferente do check-out de uma reserva.
    const fimExclusivo = somaUmDia(b.data_fim);
    if (seSobrepoe(checkin, checkout, b.data_inicio, fimExclusivo)) {
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

function somaUmDia(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  const d = new Date(ano, mes - 1, dia + 1);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
}

/**
 * Próximas datas livres a partir de hoje, para quando o cliente pergunta
 * "o que você tem disponível?". Devolve fins de semana completos.
 */
export async function proximosFinsDeSemanaLivres(
  quantidade = 4,
): Promise<{ checkin: string; checkout: string }[]> {
  const hoje = new Date();
  const livres: { checkin: string; checkout: string }[] = [];

  // Anda de semana em semana procurando a próxima sexta.
  const cursor = new Date(hoje);
  cursor.setDate(cursor.getDate() + ((5 - cursor.getDay() + 7) % 7 || 7));

  for (let i = 0; i < 26 && livres.length < quantidade; i++) {
    const sexta = new Date(cursor);
    const domingo = new Date(cursor);
    domingo.setDate(domingo.getDate() + 2);

    const checkin = paraISO(sexta);
    const checkout = paraISO(domingo);

    const d = await verificarDisponibilidade(checkin, checkout);
    if (d.livre) livres.push({ checkin, checkout });

    cursor.setDate(cursor.getDate() + 7);
  }

  return livres;
}

function paraISO(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}
