/**
 * Avisos automáticos de WhatsApp — a parte que fala com banco e internet.
 *
 * Duas automações:
 *
 *   1. AGENDA MUDOU. Quando uma reserva entra em CONFIRMADA ou sai de
 *      CONFIRMADA, o grupo dos donos e a Maurizia recebem a agenda
 *      atualizada, com o que mudou em negrito.
 *   2. FALTAM 7 DIAS. Um cron diário (`/api/cron/lembretes`) avisa a
 *      Maurizia e o grupo do aluguel que começa em uma semana.
 *
 * REGRA DE QUANDO AVISAR: entra em CONFIRMADA → avisa; sai de CONFIRMADA
 * → avisa cancelamento. Reserva em PENDENTE_CONTRATO não avisa ninguém,
 * mas APARECE na lista marcada como "aguardando contrato" — a data está
 * segurada e os donos precisam ver isso.
 *
 * NADA AQUI LANÇA. Um aviso é efeito colateral: se o WhatsApp estiver
 * fora do ar, a reserva continua salva e o painel continua funcionando.
 * Toda falha é registrada em `notificacoes.erro` e no log do servidor.
 */

import { getSupabase } from "./supabase";
import type { Reserva } from "./supabase";
import {
  listaAgenda,
  mensagemCanceladaParaEquipe,
  mensagemCanceladaParaGrupo,
  mensagemLembreteParaEquipe,
  mensagemLembreteParaGrupo,
  mensagemNovaParaEquipe,
  mensagemNovaParaGrupo,
  temDatas,
  type ReservaAviso,
  type ReservaComData,
} from "./notificacoes";
import { somaDiasISO } from "./ocupacao";
import {
  EQUIPE,
  destinoDe,
  enviarTexto,
  variavelDe,
  whatsappConfigurado,
  type Destinatario,
} from "./whatsapp";

/** Colunas que um aviso precisa. Menos que `select("*")`, de propósito. */
const CAMPOS =
  "id, nome_cliente, data_checkin, data_checkout, qtd_pessoas, valor_final, status";

export type TipoAviso = "NOVA" | "CANCELADA" | "LEMBRETE_7D";

export type Envio = {
  destinatario: Destinatario;
  enviado: boolean;
  motivo?: string;
  /** O texto que foi (ou seria) enviado. Serve para simular sem mandar. */
  texto: string;
};

export function hojeISO(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

/**
 * Reservas que ainda ocupam data, da mais próxima para a mais distante.
 * CANCELADA fica fora: cancelada não é agenda.
 */
async function agendaFutura(desde = hojeISO()): Promise<ReservaAviso[]> {
  const { data, error } = await getSupabase()
    .from("reservas")
    .select(CAMPOS)
    .neq("status", "CANCELADA")
    .gte("data_checkout", desde)
    .order("data_checkin", { ascending: true });

  if (error) throw new Error(`Falha ao ler a agenda: ${error.message}`);
  return (data ?? []) as ReservaAviso[];
}

export async function buscarReserva(id: string): Promise<ReservaAviso | null> {
  const { data, error } = await getSupabase()
    .from("reservas")
    .select(CAMPOS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Falha ao ler a reserva: ${error.message}`);
  return (data as ReservaAviso) ?? null;
}

// ============================================================
//  Registro de envios
//
//  Serve para duas coisas: histórico ("mandou mesmo?") e trava de
//  duplicata. O cron pode rodar duas vezes no mesmo dia — a Vercel não
//  promete exatidão de horário — e a Maurizia não pode receber o mesmo
//  lembrete duas vezes.
// ============================================================

/**
 * Tenta reservar o direito de enviar. Devolve o id da linha criada, ou
 * `null` se alguém já mandou este aviso (`chave` é unique no banco).
 *
 * Grava ANTES de enviar, não depois: se gravasse depois, duas execuções
 * simultâneas do cron passariam as duas pela checagem e mandariam duas
 * mensagens.
 */
async function reivindicar(
  tipo: TipoAviso,
  reservaId: string,
  chave: string | null,
): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from("notificacoes")
    .insert({ tipo, reserva_id: reservaId, chave })
    .select("id")
    .maybeSingle();

  if (error) {
    // 23505 = unique_violation: este aviso já foi enviado antes.
    if (error.code === "23505") return null;
    throw new Error(`Falha ao registrar o aviso: ${error.message}`);
  }

  return (data as { id: string } | null)?.id ?? null;
}

async function registrarResultado(id: string, envios: Envio[]): Promise<void> {
  const enviados = envios.filter((e) => e.enviado);
  const falhas = envios.filter((e) => !e.enviado);

  await getSupabase()
    .from("notificacoes")
    .update({
      enviado: enviados.length > 0,
      destinos: enviados.map((e) => e.destinatario).join(",") || null,
      erro:
        falhas.length > 0
          ? falhas.map((e) => `${e.destinatario}: ${e.motivo}`).join(" | ")
          : null,
    })
    .eq("id", id);
}

/**
 * Envia um texto para um destinatário sem nunca lançar.
 * `simular` monta a mensagem e devolve sem enviar — é o que a rota do
 * cron usa em `?simular=1` para conferir o texto antes de disparar.
 */
async function entregar(
  destinatario: Destinatario,
  texto: string,
  simular: boolean,
): Promise<Envio> {
  const destino = destinoDe(destinatario);

  if (!destino) {
    return {
      destinatario,
      enviado: false,
      motivo: `${variavelDe(destinatario)} não configurada`,
      texto,
    };
  }

  if (simular) {
    return { destinatario, enviado: false, motivo: "simulação", texto };
  }

  try {
    await enviarTexto(destino, texto);
    return { destinatario, enviado: true, texto };
  } catch (e) {
    const motivo = e instanceof Error ? e.message : "erro desconhecido";
    console.error(`[avisos] falha ao enviar para ${destinatario}: ${motivo}`);
    return { destinatario, enviado: false, motivo, texto };
  }
}

// ============================================================
//  1. Agenda mudou
// ============================================================

async function avisarMudanca(
  tipo: "NOVA" | "CANCELADA",
  reserva: ReservaAviso,
): Promise<Envio[]> {
  if (!temDatas(reserva)) return [];

  if (!whatsappConfigurado()) {
    console.warn(
      "[avisos] EVOLUTION_KEY ausente — aviso de agenda não foi enviado.",
    );
    return [];
  }

  const futuras = await agendaFutura();

  // Cancelamento vindo de exclusão: a linha já não existe mais, então
  // ela não vem em `futuras`. Cancelamento por status também não vem,
  // porque a consulta descarta CANCELADA. Nos dois casos a lista já
  // está correta sem nenhum filtro extra.
  const paraGrupo =
    tipo === "NOVA"
      ? mensagemNovaParaGrupo(reserva, futuras)
      : mensagemCanceladaParaGrupo(reserva, futuras);

  // Log, sem trava de duplicata: o gatilho é um clique no painel, e
  // reserva cancelada e reconfirmada precisa avisar de novo.
  //
  // Falha aqui não cancela o aviso. Esquecer a migração 003 não pode
  // significar reserva confirmada sem ninguém saber — o aviso sai, e o
  // que se perde é só o histórico.
  let registro: string | null = null;
  try {
    registro = await reivindicar(tipo, reserva.id, null);
  } catch (e) {
    console.error("[avisos] sem registro no banco, mas enviando mesmo assim:", e);
  }

  const envios = [await entregar("grupo", paraGrupo, false)];

  // Um envio por pessoa da equipe, cada um com o próprio nome no "oi".
  // Sequencial de propósito: a Evolution é uma instância só, e disparar
  // em paralelo pelo mesmo número é pedir para ser limitado.
  for (const pessoa of EQUIPE) {
    const texto =
      tipo === "NOVA"
        ? mensagemNovaParaEquipe(pessoa.nome, reserva, futuras)
        : mensagemCanceladaParaEquipe(pessoa.nome, reserva, futuras);
    envios.push(await entregar(pessoa.chave, texto, false));
  }

  if (registro) {
    try {
      await registrarResultado(registro, envios);
    } catch (e) {
      console.error("[avisos] falha ao gravar o resultado do envio:", e);
    }
  }

  return envios;
}

/** Chamado quando a reserva ENTRA em CONFIRMADA. */
export async function avisarNovoAluguel(reserva: ReservaAviso): Promise<void> {
  try {
    await avisarMudanca("NOVA", reserva);
  } catch (e) {
    console.error("[avisos] avisarNovoAluguel:", e);
  }
}

/** Chamado quando a reserva SAI de CONFIRMADA (cancelada ou excluída). */
export async function avisarCancelamento(reserva: ReservaAviso): Promise<void> {
  try {
    await avisarMudanca("CANCELADA", reserva);
  } catch (e) {
    console.error("[avisos] avisarCancelamento:", e);
  }
}

/**
 * Decide se a mudança de status merece aviso e dispara o certo.
 * Concentrar a regra aqui evita que o painel e o cron discordem.
 */
export async function avisarTrocaDeStatus(
  reserva: ReservaAviso,
  statusAnterior: string | null,
  statusNovo: string | null,
): Promise<void> {
  if (statusAnterior === statusNovo) return;
  if (statusNovo === "CONFIRMADA") {
    await avisarNovoAluguel({ ...reserva, status: statusNovo });
    return;
  }
  if (statusAnterior === "CONFIRMADA") {
    await avisarCancelamento({ ...reserva, status: statusNovo });
  }
}

// ============================================================
//  2. Faltam 7 dias
// ============================================================

export type ResultadoLembretes = {
  hoje: string;
  alvo: string;
  simulado: boolean;
  /** Reservas que começam na data alvo. */
  encontradas: number;
  lembretes: {
    reserva: string;
    periodo: string;
    /** `false` quando o lembrete já havia sido enviado antes. */
    novo: boolean;
    envios: Envio[];
  }[];
};

/**
 * Avisa quem tem aluguel começando em exatamente 7 dias.
 *
 * Roda uma vez por dia pelo cron. A trava de duplicata usa a data de
 * check-in na chave: se a reserva for remanejada para outra data, o
 * lembrete novo pode sair.
 */
export async function enviarLembretes7Dias(
  opcoes: { hoje?: string; simular?: boolean } = {},
): Promise<ResultadoLembretes> {
  const hoje = opcoes.hoje || hojeISO();
  const simular = opcoes.simular === true;
  const alvo = somaDiasISO(hoje, 7);

  const resultado: ResultadoLembretes = {
    hoje,
    alvo,
    simulado: simular,
    encontradas: 0,
    lembretes: [],
  };

  const { data, error } = await getSupabase()
    .from("reservas")
    .select(CAMPOS)
    .eq("status", "CONFIRMADA")
    .eq("data_checkin", alvo);

  if (error) throw new Error(`Falha ao buscar reservas: ${error.message}`);

  const reservas = ((data ?? []) as ReservaAviso[]).filter(temDatas);
  resultado.encontradas = reservas.length;
  if (reservas.length === 0) return resultado;

  // O lembrete não repete a agenda inteira de propósito: ela já foi
  // mandada quando o aluguel entrou, e aqui o assunto é uma data só.
  for (const reserva of reservas) {
    const chave = `LEMBRETE_7D:${reserva.id}:${reserva.data_checkin}`;
    const registro = simular
      ? "simulacao"
      : await reivindicar("LEMBRETE_7D", reserva.id, chave);

    if (!registro) {
      resultado.lembretes.push({
        reserva: reserva.id,
        periodo: `${reserva.data_checkin} a ${reserva.data_checkout}`,
        novo: false,
        envios: [],
      });
      continue;
    }

    // A equipe primeiro: é dela que o grupo quer saber se já sabe. O aviso
    // ao grupo cita, no fim, quem de fato recebeu.
    const daEquipe: Envio[] = [];
    const avisados: string[] = [];
    for (const pessoa of EQUIPE) {
      const envio = await entregar(
        pessoa.chave,
        mensagemLembreteParaEquipe(pessoa.nome, reserva),
        simular,
      );
      daEquipe.push(envio);
      if (envio.enviado) avisados.push(pessoa.nome);
    }

    const paraGrupo = await entregar(
      "grupo",
      mensagemLembreteParaGrupo(reserva, avisados),
      simular,
    );

    const envios = [...daEquipe, paraGrupo];
    if (!simular) await registrarResultado(registro, envios);

    resultado.lembretes.push({
      reserva: reserva.id,
      periodo: `${reserva.data_checkin} a ${reserva.data_checkout}`,
      novo: true,
      envios,
    });
  }

  return resultado;
}

/** Prévia da agenda como ela sairia hoje. Usada para conferir o texto. */
export async function previaDaAgenda(): Promise<string> {
  return listaAgenda(await agendaFutura());
}

/** Só para o painel: o tipo do banco satisfaz o que o aviso precisa. */
export function comoAviso(r: Reserva): ReservaAviso {
  return {
    id: r.id,
    nome_cliente: r.nome_cliente,
    data_checkin: r.data_checkin,
    data_checkout: r.data_checkout,
    qtd_pessoas: r.qtd_pessoas,
    valor_final: r.valor_final,
    status: r.status,
  };
}

export type { ReservaComData };
