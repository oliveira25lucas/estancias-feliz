import { createHash, timingSafeEqual } from "node:crypto";
import { getSupabase, supabaseConfigurado } from "@/lib/supabase";
import { hojeISO, somaDiasISO } from "@/lib/ocupacao";
import {
  eventosDaAgenda,
  montarICS,
  type BloqueioCalendario,
  type ReservaCalendario,
} from "@/lib/ical";
import { excedeuLimite, ipDaRequisicao } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A agenda do sítio como calendário `.ics`, para a Airbnb importar.
 *
 * É a metade "site → Airbnb" da sincronia: tudo que está vendido aqui
 * dentro (reserva da Júlia, reserva fechada por contrato no painel,
 * bloqueio de manutenção) some do calendário da Airbnb sozinho, no
 * ritmo de 3 em 3 horas que é o deles.
 *
 * ============================================================
 *  ESTE ARQUIVO SAI DE CASA
 * ============================================================
 *
 * A Airbnb busca esta URL de um servidor que não é nosso, sem sessão e
 * sem cabeçalho nenhum além do que couber no endereço. Duas
 * consequências, as duas tratadas:
 *
 *   1. O segredo é a própria URL. `?token=` com valor sorteado é o que
 *      impede alguém de assinar a agenda do sítio só por adivinhar o
 *      endereço. Não protege dado pessoal — não há nenhum aqui —, mas
 *      evita que a agenda vire informação de concorrente.
 *
 *   2. O conteúdo é só data. Nome, telefone, valor e motivo do bloqueio
 *      ficam de fora, travado por teste em `ical.test.ts`. É o mesmo
 *      critério da /api/agenda, que também é pública.
 *
 * ============================================================
 *  FALHAR FECHADO, NUNCA VAZIO
 * ============================================================
 *
 * Se o banco estiver fora, esta rota devolve ERRO, não um calendário
 * vazio. Um `.ics` vazio não quer dizer "não sei": para a Airbnb ele
 * quer dizer "o ano inteiro está livre" — e ela desbloquearia todas as
 * datas já vendidas. Um 503 faz a Airbnb manter a última importação
 * que deu certo, que é exatamente o comportamento seguro.
 */

/** Compara sem deixar o tempo de resposta contar quanto do token bateu. */
function tokenConfere(recebido: string, esperado: string): boolean {
  // O hash iguala o tamanho dos dois lados: sem ele, `timingSafeEqual`
  // exigiria buffers iguais e a saída antecipada revelaria o
  // comprimento do token.
  const a = createHash("sha256").update(recebido).digest();
  const b = createHash("sha256").update(esperado).digest();
  return timingSafeEqual(a, b);
}

function erro(mensagem: string, status: number): Response {
  return new Response(`${mensagem}\n`, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(request: Request) {
  if (excedeuLimite(`calendario:${ipDaRequisicao(request)}`, 60, 60_000)) {
    return erro("Muitas consultas seguidas.", 429);
  }

  const esperado = process.env.ICAL_TOKEN;
  if (!esperado) {
    // Mensagem explícita de propósito: variável esquecida em Production
    // só apareceria como "a Airbnb parou de sincronizar", dias depois.
    return erro(
      "ICAL_TOKEN não configurado no servidor. Sem ele o calendário não é publicado.",
      503,
    );
  }

  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!tokenConfere(token, esperado)) {
    return erro("Token inválido ou ausente.", 401);
  }

  if (!supabaseConfigurado()) {
    return erro("Banco não configurado — calendário indisponível.", 503);
  }

  /*
    Uma semana para trás, e daí para a frente sem teto.

    Para trás porque uma estadia em andamento precisa continuar
    bloqueada — cortar em "hoje" liberaria na Airbnb a data de quem
    está dentro do sítio agora.

    Para a frente sem limite de propósito. A janela de 18 meses do
    site existe para o calendário na tela não ficar gigante; aqui ela
    só criaria um buraco: uma reserva de Réveillon fechada com dois
    anos de antecedência ficaria fora do arquivo, e a Airbnb venderia
    a mesma data. São dezenas de linhas, não milhares.
  */
  const desde = somaDiasISO(hojeISO(), -7);

  const supabase = getSupabase();
  const [resReservas, resBloqueios] = await Promise.all([
    supabase
      .from("reservas")
      .select("id, data_checkin, data_checkout, status, origem")
      .neq("status", "CANCELADA")
      .gte("data_checkout", desde)
      .order("data_checkin", { ascending: true })
      .limit(1000),
    supabase
      .from("datas_bloqueadas")
      .select("id, data_inicio, data_fim, origem")
      .gte("data_fim", desde)
      .order("data_inicio", { ascending: true })
      .limit(1000),
  ]);

  if (resReservas.error || resBloqueios.error) {
    const detalhe = resReservas.error?.message ?? resBloqueios.error?.message;
    console.error("[calendario.ics] falha ao ler a agenda:", detalhe);
    // De novo: erro, não calendário vazio.
    return erro("Falha ao ler a agenda. Tente de novo em instantes.", 503);
  }

  const ics = montarICS(
    eventosDaAgenda(
      (resReservas.data ?? []) as ReservaCalendario[],
      (resBloqueios.data ?? []) as BloqueioCalendario[],
    ),
    { nome: "Sítio Estâncias Feliz" },
  );

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="estancias-feliz.ics"',
      // Sem cache: a Airbnb já busca de 3 em 3 horas, e quando o Lucas
      // aperta "sincronizar agora" lá, ele quer o que acabou de gravar
      // aqui — não uma cópia de um minuto atrás.
      "Cache-Control": "no-store",
      // A agenda do sítio não é para buscador.
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
