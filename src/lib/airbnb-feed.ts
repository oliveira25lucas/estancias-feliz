/**
 * O feed da Airbnb, interpretado. Lógica pura, sem rede e sem banco.
 *
 * Mora separado de `airbnb.ts` (que baixa o arquivo e grava no
 * Supabase) para poder ser testado com `node --test`: é aqui que se
 * decide se um evento vira RESERVA — linha na agenda, aviso para a
 * Maurizia, lembrete de 7 dias — ou só um bloqueio de data.
 *
 * ============================================================
 *  O QUE A AIRBNB NÃO MANDA
 * ============================================================
 *
 * Nome do hóspede e telefone completo NÃO existem neste arquivo. A
 * Airbnb removeu esses campos do calendário exportado em 1º de dezembro
 * de 2019, por privacidade, e não há como recuperá-los por iCal — não
 * é limitação deste código.
 *
 * O que sobra no evento, e que este módulo extrai:
 *
 *   - o código da reserva (HM...), que é a identidade dela lá dentro;
 *   - os 4 últimos dígitos do telefone;
 *   - o link direto para a reserva no painel da Airbnb.
 *
 * Com o link, o Lucas abre a reserva e vê quem é. É o melhor que o
 * canal permite, e é por isso que o link é guardado em vez de
 * descartado.
 */

import type { EventoICS } from "./ical.ts";
import { bloqueioParaPeriodo, eventoParaReserva } from "./ical.ts";
import { diasOcupados } from "./ocupacao.ts";

/** Como a reserva importada aparece no painel e nos avisos. */
export const NOME_HOSPEDE_AIRBNB = "Hóspede Airbnb";

/** Motivo gravado no bloqueio importado. */
export const MOTIVO_BLOQUEIO_AIRBNB = "Bloqueado na Airbnb";

export type ReservaImportada = {
  uid_externo: string;
  data_checkin: string;
  data_checkout: string;
  nome_cliente: string;
  observacoes: string;
};

export type BloqueioImportado = {
  uid_externo: string;
  data_inicio: string;
  data_fim: string;
  motivo: string;
};

// ============================================================
//  Reserva ou bloqueio?
// ============================================================

/** "Not available", "Blocked", "Indisponível" — e as variações. */
const PARECE_BLOQUEIO = /not\s*available|unavailable|blocked|indispon|bloquead/i;

/** "Reserved", "Reserva", "Booked". */
const PARECE_RESERVA = /reserved|reserva|booked/i;

/** O código da reserva na Airbnb, do tipo HMABCDEFGH. */
const CODIGO = /\b(HM[A-Z0-9]{4,})\b/i;

/** Como a Airbnb escreve o final do telefone na descrição. */
const FINAL_TELEFONE = /last\s*4\s*digits?\s*\)?\s*:?\s*(\d{4})/i;

const LINK = /(https?:\/\/[^\s\\]+)/i;

/**
 * Um evento de reserva tem hóspede chegando; um bloqueio, não.
 *
 * A ordem de decisão importa. O sinal mais forte é a descrição: só
 * reserva de verdade carrega link e código. O resumo entra depois,
 * porque a Airbnb já mudou o texto dele mais de uma vez e pode mudar
 * de novo.
 *
 * NA DÚVIDA, BLOQUEIO. Errar para o lado do bloqueio custa uma data
 * fechada a mais no site — chato e reversível. Errar para o lado da
 * reserva cria linha na agenda, dispara WhatsApp para a Maurizia e
 * para o grupo dos donos, e programa a limpeza de um hóspede que não
 * existe. Os dois erros não têm o mesmo preço.
 */
export function ehReserva(evento: EventoICS): boolean {
  const descricao = evento.descricao ?? "";
  if (CODIGO.test(descricao) || /reservation/i.test(descricao)) return true;

  const resumo = evento.resumo ?? "";
  if (PARECE_BLOQUEIO.test(resumo)) return false;
  if (PARECE_RESERVA.test(resumo)) return true;

  return false;
}

/** O código da reserva na Airbnb, quando o evento traz. */
export function codigoDaReserva(evento: EventoICS): string | null {
  const achado = CODIGO.exec(evento.descricao ?? "");
  return achado ? achado[1].toUpperCase() : null;
}

/** Os 4 últimos dígitos do telefone. É tudo que a Airbnb informa. */
export function finalDoTelefone(evento: EventoICS): string | null {
  const achado = FINAL_TELEFONE.exec(evento.descricao ?? "");
  return achado ? achado[1] : null;
}

/** O link para abrir a reserva no painel da Airbnb. */
export function linkDaReserva(evento: EventoICS): string | null {
  const achado = LINK.exec(evento.descricao ?? "");
  return achado ? achado[1] : null;
}

/**
 * O bloco de observações da reserva importada.
 *
 * É o que transforma uma linha anônima no painel em algo acionável:
 * com o código e o link, o Lucas descobre em dois cliques quem é o
 * hóspede — que é a informação que o iCal não entrega.
 */
export function observacoesDaReserva(evento: EventoICS): string {
  const linhas = ["Reserva importada da Airbnb."];

  const codigo = codigoDaReserva(evento);
  if (codigo) linhas.push(`Código: ${codigo}`);

  const final = finalDoTelefone(evento);
  if (final) linhas.push(`Telefone (4 últimos dígitos): ${final}`);

  const link = linkDaReserva(evento);
  if (link) linhas.push(link);

  linhas.push(
    "A Airbnb não envia nome nem telefone completo pelo calendário — abra o link para ver o hóspede.",
  );

  return linhas.join("\n");
}

// ============================================================
//  Do feed para as linhas do banco
// ============================================================

export type FeedSeparado = {
  reservas: ReservaImportada[];
  bloqueios: BloqueioImportado[];
};

/**
 * Separa o feed inteiro nas duas listas que o importador vai gravar.
 *
 * As conversões de data NÃO acontecem aqui: elas moram em `ical.ts`,
 * em `eventoParaReserva` e `bloqueioParaPeriodo`, que são as únicas
 * duas funções do sistema que sabem que o sítio conta o dia da saída
 * como ocupado e a Airbnb não.
 *
 * Evento repetido (mesmo UID) entra uma vez só: o banco tem índice
 * único em `uid_externo`, e mandar duplicata só renderia erro.
 */
export function separarFeed(eventos: readonly EventoICS[]): FeedSeparado {
  const reservas: ReservaImportada[] = [];
  const bloqueios: BloqueioImportado[] = [];
  const vistos = new Set<string>();

  for (const evento of eventos) {
    if (!evento.uid || vistos.has(evento.uid)) continue;
    vistos.add(evento.uid);

    if (ehReserva(evento)) {
      const { data_checkin, data_checkout } = eventoParaReserva(evento);
      reservas.push({
        uid_externo: evento.uid,
        data_checkin,
        data_checkout,
        nome_cliente: NOME_HOSPEDE_AIRBNB,
        observacoes: observacoesDaReserva(evento),
      });
      continue;
    }

    const { data_inicio, data_fim } = bloqueioParaPeriodo(evento);
    bloqueios.push({
      uid_externo: evento.uid,
      data_inicio,
      data_fim,
      motivo: MOTIVO_BLOQUEIO_AIRBNB,
    });
  }

  return { reservas, bloqueios };
}

// ============================================================
//  O plano de reconciliação
//
//  A parte que decide o que CRIAR, o que ATUALIZAR e — a perigosa — o
//  que CANCELAR ou APAGAR. Mora aqui, e não em `airbnb.ts`, justamente
//  para poder ser testada sem banco: é a lógica que, com um erro,
//  apagaria a agenda do sítio.
//
//  Ela nunca decide sozinha o alcance da destruição. Quem chama já
//  entrega apenas as linhas com `origem = 'airbnb'`, e repete o filtro
//  na hora de gravar. Aqui dentro assume-se que tudo que chegou em
//  `existentes` é descartável.
// ============================================================

/** O que uma reserva já importada precisa ter para entrar no plano. */
export type LinhaReserva = {
  id: string;
  uid_externo: string | null;
  data_checkin: string | null;
  data_checkout: string | null;
  status: string | null;
};

export type LinhaBloqueio = {
  id: string;
  uid_externo: string | null;
  data_inicio: string;
  data_fim: string;
};

export type PlanoReservas<L extends LinhaReserva = LinhaReserva> = {
  criar: ReservaImportada[];
  atualizar: { linha: L; campos: Record<string, unknown> }[];
  cancelar: L[];
  /**
   * Reservas da Airbnb que o site JÁ TEM registradas por outro caminho.
   * Não são criadas — veja `planejarReservas`.
   */
  ignorar: ReservaImportada[];
  /**
   * Reservas da Airbnb que encostam numa reserva do site sem serem a
   * mesma. Isto é choque de datas de verdade, e pede olho humano.
   */
  conflitos: ReservaImportada[];
};

/** O que basta saber de uma reserva do site para medir cobertura. */
export type ReservaDoSite = {
  data_checkin: string | null;
  data_checkout: string | null;
  status: string | null;
  origem: string | null;
};

/**
 * Os dias que o sítio já tem ocupados por reserva que NÃO veio da Airbnb.
 *
 * É o que permite reconhecer uma reserva que o Lucas já cadastrou à mão
 * depois de recebê-la pela Airbnb — situação que era a regra antes desta
 * sincronia existir, e que continua acontecendo enquanto ele não confiar
 * nela o bastante para parar de digitar.
 */
export function diasJaOcupadosNoSite(
  reservas: readonly ReservaDoSite[],
): Set<string> {
  const dias = new Set<string>();
  for (const r of reservas) {
    if (r.origem === "airbnb") continue;
    if (r.status === "CANCELADA") continue;
    if (!r.data_checkin || !r.data_checkout) continue;
    for (const d of diasOcupados(r.data_checkin, r.data_checkout)) dias.add(d);
  }
  return dias;
}

export type PlanoBloqueios<L extends LinhaBloqueio = LinhaBloqueio> = {
  criar: BloqueioImportado[];
  atualizar: { linha: L; campos: Record<string, unknown> }[];
  remover: L[];
};

/**
 * Compara o que a Airbnb tem hoje com o que o sítio já importou.
 *
 * `nome_cliente` NUNCA entra numa atualização. A Airbnb não manda nome
 * nenhum, então o que estiver ali só pode ter sido escrito por gente —
 * e sobrescrever apagaria justamente o trabalho manual de descobrir
 * quem é o hóspede. Mesmo raciocínio para `qtd_pessoas` e `valor_final`.
 *
 * Reserva que sumiu do feed é CANCELADA, não apagada: cancelada libera
 * a data (é a regra de `agenda.ts`) e o histórico continua no painel,
 * que é o que permite entender depois por que a data abriu.
 */
export function planejarReservas<L extends LinhaReserva>(
  doFeed: readonly ReservaImportada[],
  existentes: readonly L[],
  jaOcupados: ReadonlySet<string> = new Set(),
): PlanoReservas<L> {
  const porUid = new Map<string, L>();
  for (const linha of existentes) {
    if (linha.uid_externo) porUid.set(linha.uid_externo, linha);
  }
  const noFeed = new Set(doFeed.map((r) => r.uid_externo));

  const plano: PlanoReservas<L> = {
    criar: [],
    atualizar: [],
    cancelar: [],
    ignorar: [],
    conflitos: [],
  };

  for (const reserva of doFeed) {
    const linha = porUid.get(reserva.uid_externo);
    if (!linha) {
      plano.criar.push(...decidirCriacao(reserva, jaOcupados, plano));
      continue;
    }

    const campos: Record<string, unknown> = {};
    if (linha.data_checkin !== reserva.data_checkin) {
      campos.data_checkin = reserva.data_checkin;
    }
    if (linha.data_checkout !== reserva.data_checkout) {
      campos.data_checkout = reserva.data_checkout;
    }
    // Reserva que tinha sumido e voltou: o hóspede remarcou, ou a
    // Airbnb piscou. Ressuscitar é o único caminho — o índice único em
    // uid_externo impediria criar uma segunda linha.
    if (linha.status === "CANCELADA") campos.status = "CONFIRMADA";

    if (Object.keys(campos).length > 0) plano.atualizar.push({ linha, campos });
  }

  for (const linha of existentes) {
    if (!linha.uid_externo) continue;
    if (noFeed.has(linha.uid_externo)) continue;
    if (linha.status === "CANCELADA") continue;
    plano.cancelar.push(linha);
  }

  return plano;
}

/**
 * A reserva da Airbnb ainda não existe com este UID. Criar mesmo assim?
 *
 * NEM SEMPRE. Enquanto esta sincronia não existiu, o caminho de toda
 * reserva da Airbnb foi: o Lucas recebe o aviso deles e digita a reserva
 * no painel. Essas linhas estão lá, com as mesmas datas e sem UID
 * nenhum — e criar a versão da Airbnb por cima delas dobraria a agenda.
 *
 * O dobro não é só feio no painel: o lembrete de 7 dias é por LINHA, e
 * duas linhas mandam **dois WhatsApps para a Maurizia** sobre o mesmo
 * hóspede.
 *
 * Três desfechos:
 *
 *   totalmente coberta  — é a mesma reserva, digitada à mão. Ignora.
 *   parcialmente        — encosta numa reserva do site sem ser ela.
 *                         Cria (os dias a mais precisam bloquear) e
 *                         grita: isso é choque de datas de verdade.
 *   descoberta          — reserva nova. Cria, que é o caso comum daqui
 *                         para a frente.
 *
 * Ignorar se cura sozinho: se o Lucas apagar a linha manual, a próxima
 * passada (15 minutos depois) não encontra mais cobertura e cria a da
 * Airbnb. A data nunca fica desprotegida.
 */
function decidirCriacao<L extends LinhaReserva>(
  reserva: ReservaImportada,
  jaOcupados: ReadonlySet<string>,
  plano: PlanoReservas<L>,
): ReservaImportada[] {
  if (jaOcupados.size === 0) return [reserva];

  const dias = diasOcupados(reserva.data_checkin, reserva.data_checkout);
  const cobertos = dias.filter((d) => jaOcupados.has(d)).length;

  if (cobertos === dias.length) {
    plano.ignorar.push(reserva);
    return [];
  }

  if (cobertos > 0) plano.conflitos.push(reserva);
  return [reserva];
}

/**
 * O mesmo para bloqueios, com uma diferença: bloqueio some do feed e é
 * APAGADO, porque não existe status de cancelamento numa data
 * bloqueada — ela simplesmente volta a estar à venda.
 */
export function planejarBloqueios<L extends LinhaBloqueio>(
  doFeed: readonly BloqueioImportado[],
  existentes: readonly L[],
): PlanoBloqueios<L> {
  const porUid = new Map<string, L>();
  for (const linha of existentes) {
    if (linha.uid_externo) porUid.set(linha.uid_externo, linha);
  }
  const noFeed = new Set(doFeed.map((b) => b.uid_externo));

  const plano: PlanoBloqueios<L> = { criar: [], atualizar: [], remover: [] };

  for (const bloqueio of doFeed) {
    const linha = porUid.get(bloqueio.uid_externo);
    if (!linha) {
      plano.criar.push(bloqueio);
      continue;
    }

    const campos: Record<string, unknown> = {};
    if (linha.data_inicio !== bloqueio.data_inicio) {
      campos.data_inicio = bloqueio.data_inicio;
    }
    if (linha.data_fim !== bloqueio.data_fim) campos.data_fim = bloqueio.data_fim;

    if (Object.keys(campos).length > 0) plano.atualizar.push({ linha, campos });
  }

  for (const linha of existentes) {
    if (!linha.uid_externo) continue;
    if (!noFeed.has(linha.uid_externo)) plano.remover.push(linha);
  }

  return plano;
}
