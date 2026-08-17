import { NextResponse } from "next/server";
import { calcularOrcamento, tabelaDePrecos } from "@/lib/pricing";
import { verificarDisponibilidade, proximosFinsDeSemanaLivres } from "@/lib/agenda";
import {
  fatosComData,
  fatosSemData,
  periodoConferivel,
} from "@/lib/fatos";
import { supabaseConfigurado } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cérebro do agente de IA do WhatsApp.
 *
 * A Júlia não calcula preço nem consulta agenda por conta própria: ela
 * chama esta rota e recebe os fatos prontos. Assim existe um só lugar
 * onde as regras moram, e o modelo não tem como inventar valor nem
 * prometer data ocupada.
 *
 * O campo `fatos` é feito para ir direto no prompt: são as afirmações
 * que a IA pode fazer, e só elas.
 *
 * Autenticação por token no cabeçalho `x-api-token`.
 */

function autorizado(request: Request): boolean {
  const esperado = process.env.API_TOKEN;
  if (!esperado) return false;
  const recebido = request.headers.get("x-api-token");
  return recebido === esperado;
}

export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json(
      { erro: "Token inválido ou ausente." },
      { status: 401 },
    );
  }

  let corpo: Record<string, unknown>;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const checkin = typeof corpo.checkin === "string" ? corpo.checkin.trim() : "";
  const checkout =
    typeof corpo.checkout === "string" ? corpo.checkout.trim() : "";
  const pessoas = Number(corpo.pessoas) || 0;
  const hidromassagem = corpo.hidromassagem === true;

  // ---- Sem data: devolve a tabela de vitrine ----
  if (!checkin || !checkout) {
    const ano = new Date().getFullYear();
    const tabela = tabelaDePrecos(ano);

    let sugestoes: { checkin: string; checkout: string }[] = [];
    if (supabaseConfigurado()) {
      try {
        sugestoes = await proximosFinsDeSemanaLivres(3);
      } catch {
        // Agenda indisponível não pode derrubar a resposta de preço.
      }
    }

    return NextResponse.json({
      temData: false,
      tabela,
      sugestoes,
      fatos: fatosSemData(tabela, sugestoes),
    });
  }

  // ---- Com data: a agenda primeiro, o preço depois ----
  // A ordem importa. A disponibilidade NÃO depende de saber quantas pessoas
  // vão; só o preço depende. Antes, um pedido sem "quantas pessoas" saía
  // daqui sem uma palavra sobre a data, e a IA preenchia o silêncio — foi
  // assim que a Júlia disse a um cliente que 02 a 04/10 estava ocupado
  // quando estava livre.
  const orcamento = calcularOrcamento({
    checkin,
    checkout,
    pessoas,
    hidromassagem,
  });

  // Se a data cai em feriado, o que precisa estar livre é o bloco inteiro —
  // por isso o período conferido é o cobrado, e não o pedido. Sem orçamento
  // válido não há bloco calculado, então vale o que o cliente disse.
  const inicio = orcamento.valido ? orcamento.checkin : checkin;
  const fim = orcamento.valido ? orcamento.checkout : checkout;
  const conferivel = periodoConferivel(inicio, fim);

  let disponibilidade = null;
  let erroAgenda: string | null = null;

  if (!conferivel) {
    erroAgenda = "período incompleto ou mal formado";
  } else if (supabaseConfigurado()) {
    try {
      disponibilidade = await verificarDisponibilidade(inicio, fim);
    } catch (e) {
      erroAgenda = e instanceof Error ? e.message : "erro desconhecido";
    }
  } else {
    erroAgenda = "banco não configurado";
  }

  return NextResponse.json({
    temData: true,
    ...(orcamento.valido ? { orcamento } : { erro: orcamento.erro }),
    disponibilidade,
    erroAgenda,
    fatos: fatosComData({ orcamento, disponibilidade, conferivel }),
  });
}

/** Atalho de leitura para testar no navegador ou via curl. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  return POST(
    new Request(url.origin + url.pathname, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-token": request.headers.get("x-api-token") ?? "",
      },
      body: JSON.stringify({
        checkin: url.searchParams.get("checkin") ?? "",
        checkout: url.searchParams.get("checkout") ?? "",
        pessoas: Number(url.searchParams.get("pessoas") ?? 0),
        hidromassagem: url.searchParams.get("hidromassagem") === "true",
      }),
    }),
  );
}
