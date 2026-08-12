/**
 * Textos dos avisos automáticos de WhatsApp — lógica pura, sem banco.
 *
 * Mora separado de `avisos.ts` (que fala com o Supabase e com a Evolution)
 * pelo mesmo motivo que `ocupacao.ts` mora separado de `agenda.ts`: aqui
 * dentro não há rede nem banco, então os testes travam o texto exato que
 * chega no celular dos donos e da faxineira.
 *
 * Formatação é a do WhatsApp, não markdown: *negrito*, _itálico_,
 * ~riscado~. Asterisco duplo não vira negrito lá — vira asterisco.
 *
 * Regra de quando avisar mora em `avisos.ts`: avisa quando a reserva
 * ENTRA em CONFIRMADA e quando SAI de CONFIRMADA. Reserva que nasce e
 * morre em PENDENTE_CONTRATO nunca gera aviso, senão a Maurizia é
 * chamada por causa de contrato que não fechou.
 */

/**
 * As duas importações abaixo levam `.ts` de propósito: este arquivo é
 * carregado pelo `node --test`, que resolve ESM sem adivinhar extensão.
 * Sem elas o teste morre em ERR_MODULE_NOT_FOUND. Os arquivos que só
 * rodam dentro do Next continuam importando sem extensão.
 */
import {
  diffDias,
  formatarBRL,
  formatarDataBR,
  getDiaSemana,
  nomeDiaSemana,
} from "./pricing.ts";
import { somaDiasISO } from "./ocupacao.ts";

/** Abreviação por dia da semana, indexada por `getDay()` (0 = domingo). */
const DIA_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

const LINHA = "────────────────────";

/**
 * O que um aviso precisa saber de uma reserva. É um subconjunto de
 * `Reserva` (src/lib/supabase.ts) de propósito: assim este arquivo não
 * importa o cliente do Supabase e continua rodando no `node --test`.
 */
export type ReservaAviso = {
  id: string;
  nome_cliente: string | null;
  data_checkin: string | null;
  data_checkout: string | null;
  qtd_pessoas: number | null;
  /** Vem como texto do banco (o n8n gravava string). Converter antes de somar. */
  valor_final: string | number | null;
  status: string | null;
};

/** Reserva que já passou pelo filtro de datas — as duas pontas existem. */
export type ReservaComData = ReservaAviso & {
  data_checkin: string;
  data_checkout: string;
};

/** Sem as duas datas não há período para anunciar. */
export function temDatas(r: ReservaAviso): r is ReservaComData {
  return Boolean(r.data_checkin && r.data_checkout);
}

function diaCurto(iso: string): string {
  return DIA_CURTO[getDiaSemana(iso)];
}

/** "20/11 a 22/11 · sex a dom" — o ano fica no cabeçalho do grupo. */
function periodoCurto(checkin: string, checkout: string): string {
  const inicio = formatarDataBR(checkin).slice(0, 5);
  const fim = formatarDataBR(checkout).slice(0, 5);
  return `${inicio} a ${fim} · ${diaCurto(checkin)} a ${diaCurto(checkout)}`;
}

/** "sexta, 20/11/2026" — para quem precisa da data sem contar no calendário. */
function dataFalada(iso: string): string {
  return `${nomeDiaSemana(iso).toLowerCase()}, ${formatarDataBR(iso)}`;
}

function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * Cabeçalho de uma reserva: período em negrito e, embaixo, quem e quanto.
 * Campo vazio simplesmente não aparece — reserva da Júlia costuma vir
 * sem valor, e "R$ NaN" no grupo dos donos seria pior que a omissão.
 */
function blocoReserva(r: ReservaComData, comValor = true): string {
  const dias = diffDias(r.data_checkin, r.data_checkout);
  const linhas = [
    `*${formatarDataBR(r.data_checkin)} a ${formatarDataBR(r.data_checkout)}*` +
      ` · ${diaCurto(r.data_checkin)} a ${diaCurto(r.data_checkout)}` +
      ` · ${plural(dias, "diária", "diárias")}`,
  ];

  const detalhes: string[] = [];
  if (r.nome_cliente?.trim()) detalhes.push(r.nome_cliente.trim());
  if (r.qtd_pessoas) detalhes.push(plural(r.qtd_pessoas, "pessoa", "pessoas"));

  const valor = Number(r.valor_final);
  if (comValor && r.valor_final != null && Number.isFinite(valor) && valor > 0) {
    detalhes.push(formatarBRL(valor));
  }

  if (detalhes.length > 0) linhas.push(detalhes.join(" · "));
  return linhas.join("\n");
}

/**
 * A agenda inteira do que ainda vai acontecer, agrupada por ano.
 *
 * `destaqueId` põe uma linha em negrito com a seta — é o "deu ênfase no
 * que entrou" do pedido. Quem chegou fica óbvio sem ler o cabeçalho.
 */
export function listaAgenda(
  futuras: ReservaAviso[],
  destaqueId?: string,
): string {
  const comData = futuras
    .filter(temDatas)
    .sort((a, b) => a.data_checkin.localeCompare(b.data_checkin));

  if (comData.length === 0) {
    return "*PRÓXIMOS ALUGUÉIS*\n\n_A agenda está vazia daqui pra frente._";
  }

  const linhas = [`*PRÓXIMOS ALUGUÉIS — ${comData.length} no total*`];
  let anoImpresso = "";

  for (const r of comData) {
    const ano = r.data_checkin.slice(0, 4);
    if (ano !== anoImpresso) {
      anoImpresso = ano;
      linhas.push("", `*${ano}*`);
    }

    let linha = `• ${periodoCurto(r.data_checkin, r.data_checkout)}`;
    if (r.status === "PENDENTE_CONTRATO") linha += " (aguardando contrato)";
    linhas.push(r.id === destaqueId ? `*${linha}  ⬅️ NOVO*` : linha);
  }

  return linhas.join("\n");
}

// ============================================================
//  Grupo dos donos
// ============================================================

export function mensagemNovaParaGrupo(
  nova: ReservaComData,
  futuras: ReservaAviso[],
): string {
  return [
    "*🏡 AGENDA SÍTIO — ENTROU ALUGUEL NOVO*",
    "",
    blocoReserva(nova),
    "",
    LINHA,
    listaAgenda(futuras, nova.id),
  ].join("\n");
}

export function mensagemCanceladaParaGrupo(
  cancelada: ReservaComData,
  futuras: ReservaAviso[],
): string {
  const quem = cancelada.nome_cliente?.trim();
  return [
    "*🏡 AGENDA SÍTIO — ALUGUEL CANCELADO*",
    "",
    `~*${formatarDataBR(cancelada.data_checkin)} a ${formatarDataBR(cancelada.data_checkout)}*~` +
      ` · ${diaCurto(cancelada.data_checkin)} a ${diaCurto(cancelada.data_checkout)}`,
    quem
      ? `${quem} · a data voltou a ficar livre`
      : "A data voltou a ficar livre",
    "",
    LINHA,
    // A cancelada já saiu da lista: `futuras` só traz o que ocupa data.
    listaAgenda(futuras),
  ].join("\n");
}

/**
 * Lembrete de 7 dias no grupo. Vai curto de propósito: os donos já
 * receberam a agenda completa quando o aluguel entrou, aqui o assunto
 * é uma data só.
 */
export function mensagemLembreteParaGrupo(
  r: ReservaComData,
  avisouFaxineira: boolean,
): string {
  const linhas = [
    "*🏡 SÍTIO — FALTA 1 SEMANA*",
    "",
    blocoReserva(r, false),
    "",
    `Entrada ${dataFalada(r.data_checkin)}.`,
  ];
  if (avisouFaxineira) linhas.push("A Maurizia já recebeu o lembrete da limpeza.");
  return linhas.join("\n");
}

// ============================================================
//  Faxineira
//
//  Texto de gente, não de sistema: ela recebe isso como mensagem
//  pessoal. Sem emoji de robô, sem "mensagem automática", e sempre
//  com os horários que valem (8h de entrada, 16h de saída).
// ============================================================

/** A casa tem que estar pronta na véspera: a entrada é às 8h. */
function precisaEstarPronto(checkin: string): string {
  return dataFalada(somaDiasISO(checkin, -1));
}

function blocoDatas(r: ReservaComData): string[] {
  const linhas = [
    `*Entrada:* ${dataFalada(r.data_checkin)}, 8h`,
    `*Saída:* ${dataFalada(r.data_checkout)}, 16h`,
  ];
  if (r.qtd_pessoas) linhas.push(`*Pessoas:* ${r.qtd_pessoas}`);
  return linhas;
}

export function mensagemNovaParaFaxineira(
  nova: ReservaComData,
  futuras: ReservaAviso[],
): string {
  return [
    "Oi, Maurizia! Tudo bem? 🏡",
    "",
    "Entrou um aluguel novo no sítio:",
    "",
    ...blocoDatas(nova),
    "",
    `A casa precisa estar pronta até ${precisaEstarPronto(nova.data_checkin)}.`,
    "Te mando um lembrete 7 dias antes também.",
    "",
    LINHA,
    listaAgenda(futuras, nova.id),
  ].join("\n");
}

export function mensagemCanceladaParaFaxineira(
  cancelada: ReservaComData,
  futuras: ReservaAviso[],
): string {
  return [
    "Oi, Maurizia! 🏡",
    "",
    "O aluguel abaixo foi *cancelado*, não precisa se preparar pra ele:",
    "",
    `~${formatarDataBR(cancelada.data_checkin)} a ${formatarDataBR(cancelada.data_checkout)}~`,
    "",
    LINHA,
    listaAgenda(futuras),
  ].join("\n");
}

export function mensagemLembreteParaFaxineira(r: ReservaComData): string {
  return [
    "Oi, Maurizia! ⏳",
    "",
    "*Falta 1 semana* para o próximo aluguel do sítio:",
    "",
    ...blocoDatas(r),
    "",
    `A casa precisa estar pronta até ${precisaEstarPronto(r.data_checkin)}.`,
    "Consegue confirmar a limpeza pra mim?",
  ].join("\n");
}
