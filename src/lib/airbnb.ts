/**
 * Sincronia Airbnb → sítio. A parte que fala com a internet e o banco.
 *
 * A metade contrária (sítio → Airbnb) é a rota `/api/calendario.ics`,
 * que a Airbnb busca sozinha de 3 em 3 horas. Aqui é o outro sentido:
 * baixar o calendário da Airbnb e trazer para dentro o que foi vendido
 * lá — para que o site, a calculadora e a Júlia parem de oferecer uma
 * data que já tem gente.
 *
 * ============================================================
 *  A REGRA QUE NÃO PODE SER QUEBRADA
 * ============================================================
 *
 * Este código roda sozinho, de 15 em 15 minutos, e APAGA E CANCELA
 * COISA. A única coisa que o impede de destruir a agenda é esta regra:
 *
 *   SÓ SE TOCA EM LINHA COM `origem = 'airbnb'`.
 *
 * Reserva da Júlia, reserva fechada por contrato no painel e bloqueio
 * de manutenção são invioláveis. Toda consulta daqui para baixo filtra
 * por `origem`, e é de propósito que nenhuma delas seja genérica.
 *
 * ============================================================
 *  PLANEJAR, DEPOIS GRAVAR
 * ============================================================
 *
 * O trabalho é feito em duas fases: primeiro monta-se o plano do que
 * mudaria, depois ele é aplicado. É o que permite `?simular=1` mostrar
 * exatamente o que aconteceria sem escrever nada — e foi assim que o
 * cron de lembretes já funcionava.
 */

import { getSupabase } from "./supabase";
import { lerICS } from "./ical";
import { hojeISO, somaDiasISO } from "./ocupacao";
import {
  diasJaOcupadosNoSite,
  planejarBloqueios,
  planejarReservas,
  separarFeed,
  type LinhaBloqueio,
  type LinhaReserva,
  type ReservaDoSite,
} from "./airbnb-feed";
import { avisarCancelamento, avisarNovoAluguel } from "./avisos";
import type { ReservaAviso } from "./notificacoes";

const TIMEOUT_MS = 20_000;

/** Marca as linhas que este importador pode mexer. */
const ORIGEM = "airbnb";

export function airbnbConfigurado(): boolean {
  return Boolean(process.env.AIRBNB_ICAL_URL?.trim());
}

/**
 * Avisar no WhatsApp por reserva vinda da Airbnb é OPT-IN.
 *
 * Mesmo padrão de `LEAD_WHATSAPP_ATIVO`: quem dispara aqui é um robô
 * de 15 em 15 minutos, não um clique humano. Vale ver algumas
 * passadas darem certo antes de deixar isto acordar a Maurizia.
 *
 * O lembrete de 7 dias NÃO passa por esta chave — ele já sai para
 * qualquer reserva CONFIRMADA, e a limpeza precisa acontecer venha o
 * hóspede de onde vier.
 */
function avisoAtivo(): boolean {
  const v = process.env.AIRBNB_AVISA_WHATSAPP?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "sim";
}

// ============================================================
//  Tipos do resultado
// ============================================================

/**
 * A linha como ela vem do banco: o que o plano precisa (`LinhaReserva`)
 * mais o que o aviso de WhatsApp precisa para montar a mensagem.
 */
type LinhaReservaDB = LinhaReserva & {
  nome_cliente: string | null;
  qtd_pessoas: number | null;
  valor_final: string | number | null;
};

export type ResultadoSincronia = {
  simulado: boolean;
  /** Quantos VEVENT vieram no arquivo. */
  eventos: number;
  reservas: {
    criadas: string[];
    atualizadas: string[];
    canceladas: string[];
    /** Já existiam no site, cadastradas à mão. Não viraram duplicata. */
    ignoradas: string[];
  };
  bloqueios: {
    criados: string[];
    atualizados: string[];
    removidos: string[];
  };
  /** Avisos de WhatsApp: quantos saíram, ou por que não saíram. */
  avisos: string;
  /** O que merece olho humano. Vazio é o normal. */
  alertas: string[];
};

function periodo(inicio: string, fim: string): string {
  return `${inicio} a ${fim}`;
}

// ============================================================
//  Baixar
// ============================================================

async function baixarFeed(url: string): Promise<string> {
  let resposta: Response;
  try {
    resposta = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
      headers: { Accept: "text/calendar, text/plain;q=0.9, */*;q=0.8" },
    });
  } catch (e) {
    const motivo = e instanceof Error ? e.message : "erro desconhecido";
    throw new Error(`Não foi possível buscar o calendário da Airbnb: ${motivo}`);
  }

  if (!resposta.ok) {
    throw new Error(
      `A Airbnb respondeu ${resposta.status} ao entregar o calendário. ` +
        "Confira se o link em AIRBNB_ICAL_URL ainda é válido — ela troca o " +
        "endereço quando o anúncio é recriado.",
    );
  }

  const texto = await resposta.text();

  /*
    Página de erro em HTML também chega com status 200 às vezes. Sem
    esta checagem, `lerICS` devolveria zero evento e a sincronia
    entenderia "a Airbnb não tem nenhuma reserva" — cancelando todas as
    que existem. Melhor falhar alto.
  */
  if (!texto.includes("BEGIN:VCALENDAR")) {
    throw new Error(
      "O que veio da Airbnb não é um calendário. Confira a URL: ela precisa " +
        "ser o link de exportação do anúncio, terminado em .ics",
    );
  }

  return texto;
}

// ============================================================
//  A sincronia
// ============================================================

/**
 * Traz o calendário da Airbnb para dentro do sítio.
 *
 * Chamada pela rota `/api/sync/airbnb`, que o n8n do VPS aciona de 15
 * em 15 minutos. Com `simular`, lê tudo e devolve o plano sem gravar.
 */
export async function sincronizarAirbnb(
  opcoes: { simular?: boolean } = {},
): Promise<ResultadoSincronia> {
  const simular = opcoes.simular === true;
  const url = process.env.AIRBNB_ICAL_URL?.trim();

  if (!url) {
    throw new Error(
      "AIRBNB_ICAL_URL não configurada. É o link de exportação do calendário " +
        "do anúncio, em Calendário → Disponibilidade → Conectar a outro site.",
    );
  }

  const eventos = lerICS(await baixarFeed(url));
  const { reservas: doFeed, bloqueios: bloqueiosDoFeed } = separarFeed(eventos);

  const supabase = getSupabase();

  /*
    Três consultas, e a terceira é a que impede a agenda de dobrar.

    O SITE É A FONTE DA VERDADE — o Lucas foi explícito. Enquanto esta
    sincronia não existiu, toda reserva da Airbnb chegou aqui digitada à
    mão no painel, com `origem = 'admin'` e sem UID. Sem olhar para
    essas linhas, o importador criaria a versão dele por cima de cada
    uma, e o lembrete de 7 dias sairia DUAS VEZES para a Maurizia sobre
    o mesmo hóspede.
  */
  const [resReservas, resBloqueios, resDoSite] = await Promise.all([
    supabase
      .from("reservas")
      .select(
        "id, uid_externo, data_checkin, data_checkout, status, nome_cliente, qtd_pessoas, valor_final",
      )
      .eq("origem", ORIGEM),
    supabase
      .from("datas_bloqueadas")
      .select("id, uid_externo, data_inicio, data_fim")
      .eq("origem", ORIGEM),
    // Sem filtro de origem no banco: `neq` do PostgREST descarta NULL, e
    // reserva antiga pode ter `origem` nula. A separação é feita em
    // memória, por `diasJaOcupadosNoSite`.
    supabase
      .from("reservas")
      .select("data_checkin, data_checkout, status, origem")
      .neq("status", "CANCELADA")
      .gte("data_checkout", somaDiasISO(hojeISO(), -1)),
  ]);

  if (resReservas.error || resBloqueios.error || resDoSite.error) {
    const detalhe =
      resReservas.error?.message ??
      resBloqueios.error?.message ??
      resDoSite.error?.message;
    throw new Error(
      `Falha ao ler o que já foi importado: ${detalhe}. ` +
        "Se a mensagem fala em coluna inexistente, falta rodar a migração " +
        "supabase/migrations/006_airbnb.sql.",
    );
  }

  const existentesReservas = (resReservas.data ?? []) as LinhaReservaDB[];
  const existentesBloqueios = (resBloqueios.data ?? []) as LinhaBloqueio[];

  const jaOcupados = diasJaOcupadosNoSite(
    (resDoSite.data ?? []) as ReservaDoSite[],
  );

  const planoR = planejarReservas(doFeed, existentesReservas, jaOcupados);
  const planoB = planejarBloqueios(bloqueiosDoFeed, existentesBloqueios);

  const alertas: string[] = [];

  /*
    Choque de datas de verdade: a reserva da Airbnb encosta numa reserva
    do site sem ser a mesma. Ela É criada — os dias a mais precisam
    bloquear —, mas ninguém fecha os olhos para isto.
  */
  for (const r of planoR.conflitos) {
    alertas.push(
      `Reserva da Airbnb de ${periodo(r.data_checkin, r.data_checkout)} ` +
        "encosta numa reserva que já existe no site sem ser a mesma. " +
        "Confira: pode ser data vendida duas vezes.",
    );
  }

  /*
    TRAVA DE SEGURANÇA: feed sem evento nenhum não apaga nada.

    Um calendário legitimamente vazio existe (anúncio sem reserva), mas
    é indistinguível de um feed quebrado que ainda assim trouxe o
    cabeçalho. Como cancelar tudo é a ação mais cara que este código
    sabe fazer, ela exige pelo menos um evento como prova de vida.

    O caso legítimo se resolve sozinho: basta o Lucas cancelar a reserva
    no painel, ou a Airbnb voltar a mandar qualquer evento.
  */
  const removeria = planoR.cancelar.length + planoB.remover.length;
  if (eventos.length === 0 && removeria > 0) {
    alertas.push(
      `O calendário da Airbnb veio sem nenhum evento, e isso cancelaria ${removeria} ` +
        "registro(s). Nada foi removido — confira o link antes de confiar.",
    );
    planoR.cancelar = [];
    planoB.remover = [];
  }

  const resultado: ResultadoSincronia = {
    simulado: simular,
    eventos: eventos.length,
    reservas: {
      criadas: planoR.criar.map((r) => periodo(r.data_checkin, r.data_checkout)),
      atualizadas: planoR.atualizar.map((a) =>
        periodo(
          String(a.campos.data_checkin ?? a.linha.data_checkin),
          String(a.campos.data_checkout ?? a.linha.data_checkout),
        ),
      ),
      canceladas: planoR.cancelar.map((l) =>
        periodo(String(l.data_checkin), String(l.data_checkout)),
      ),
      ignoradas: planoR.ignorar.map((r) =>
        periodo(r.data_checkin, r.data_checkout),
      ),
    },
    bloqueios: {
      criados: planoB.criar.map((b) => periodo(b.data_inicio, b.data_fim)),
      atualizados: planoB.atualizar.map((a) =>
        periodo(
          String(a.campos.data_inicio ?? a.linha.data_inicio),
          String(a.campos.data_fim ?? a.linha.data_fim),
        ),
      ),
      removidos: planoB.remover.map((l) => periodo(l.data_inicio, l.data_fim)),
    },
    avisos: "",
    alertas,
  };

  if (simular) {
    resultado.avisos = "simulação — nada enviado";
    return resultado;
  }

  // ---------- Aplicar ----------

  const novas: ReservaAviso[] = [];

  for (const reserva of planoR.criar) {
    const { data, error } = await supabase
      .from("reservas")
      .insert({
        nome_cliente: reserva.nome_cliente,
        data_checkin: reserva.data_checkin,
        data_checkout: reserva.data_checkout,
        observacoes: reserva.observacoes,
        uid_externo: reserva.uid_externo,
        // CONFIRMADA de propósito: reserva da Airbnb está paga e
        // fechada, e é este status que faz o lembrete de 7 dias sair
        // para a Maurizia. PENDENTE_CONTRATO seguraria a data mas
        // deixaria a limpeza sem aviso.
        status: "CONFIRMADA",
        origem: ORIGEM,
      })
      .select(
        "id, nome_cliente, data_checkin, data_checkout, qtd_pessoas, valor_final, status",
      )
      .maybeSingle();

    if (error) {
      // 23505 = duas execuções se cruzaram e a outra já inseriu. O
      // índice único em uid_externo é justamente a trava disso.
      if (error.code === "23505") continue;
      alertas.push(`Falha ao criar reserva ${reserva.uid_externo}: ${error.message}`);
      continue;
    }

    if (data) novas.push(data as ReservaAviso);
  }

  for (const { linha, campos } of planoR.atualizar) {
    const { error } = await supabase
      .from("reservas")
      .update(campos)
      .eq("id", linha.id)
      // O filtro por origem se repete aqui de propósito: mesmo que o
      // plano venha errado, o UPDATE não alcança linha que não é nossa.
      .eq("origem", ORIGEM);
    if (error) alertas.push(`Falha ao atualizar reserva: ${error.message}`);
  }

  const canceladas: ReservaAviso[] = [];
  for (const linha of planoR.cancelar) {
    const { error } = await supabase
      .from("reservas")
      .update({ status: "CANCELADA" })
      .eq("id", linha.id)
      .eq("origem", ORIGEM);

    if (error) {
      alertas.push(`Falha ao cancelar reserva: ${error.message}`);
      continue;
    }
    canceladas.push({ ...linha, status: "CANCELADA" } as ReservaAviso);
  }

  /*
    Um a um, e não um INSERT com a lista inteira.

    Em lote, um único conflito de `uid_externo` — duas execuções que se
    cruzaram — derruba a instrução toda, e nenhum dos outros bloqueios
    entra. Como o 23505 é justamente o erro que se ignora aqui, a perda
    seria silenciosa: o calendário voltaria com datas faltando e nada
    apareceria no resultado. São poucas linhas; uma por vez é barato.
  */
  for (const bloqueio of planoB.criar) {
    const { error } = await supabase.from("datas_bloqueadas").insert({
      data_inicio: bloqueio.data_inicio,
      data_fim: bloqueio.data_fim,
      motivo: bloqueio.motivo,
      uid_externo: bloqueio.uid_externo,
      origem: ORIGEM,
    });
    if (error && error.code !== "23505") {
      alertas.push(
        `Falha ao criar bloqueio ${bloqueio.uid_externo}: ${error.message}`,
      );
    }
  }

  for (const { linha, campos } of planoB.atualizar) {
    const { error } = await supabase
      .from("datas_bloqueadas")
      .update(campos)
      .eq("id", linha.id)
      .eq("origem", ORIGEM);
    if (error) alertas.push(`Falha ao atualizar bloqueio: ${error.message}`);
  }

  if (planoB.remover.length > 0) {
    const { error } = await supabase
      .from("datas_bloqueadas")
      .delete()
      .in(
        "id",
        planoB.remover.map((l) => l.id),
      )
      // Bloqueio não tem status para virar "cancelado", então aqui é
      // DELETE mesmo — e é o único DELETE do arquivo. O filtro por
      // origem é o que garante que ele nunca alcança um bloqueio de
      // manutenção criado no painel.
      .eq("origem", ORIGEM);
    if (error) alertas.push(`Falha ao remover bloqueios: ${error.message}`);
  }

  // ---------- Avisar ----------

  if (!avisoAtivo()) {
    resultado.avisos =
      novas.length + canceladas.length > 0
        ? "AIRBNB_AVISA_WHATSAPP desligada — nada foi enviado"
        : "nada a avisar";
  } else {
    // Nenhum aviso pode derrubar a sincronia: a data já está bloqueada,
    // que é a parte que importa. WhatsApp fora do ar é contratempo.
    for (const reserva of novas) await avisarNovoAluguel(reserva);
    for (const reserva of canceladas) await avisarCancelamento(reserva);
    resultado.avisos = `${novas.length} nova(s), ${canceladas.length} cancelada(s)`;
  }

  return resultado;
}
