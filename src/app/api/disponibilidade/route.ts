import { NextResponse } from "next/server";
import { calcularOrcamento } from "@/lib/pricing";
import { verificarDisponibilidade } from "@/lib/agenda";
import { supabaseConfigurado } from "@/lib/supabase";
import { excedeuLimite, ipDaRequisicao } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Disponibilidade de um período, para a calculadora do site.
 *
 * Rota pública de propósito — é a mesma informação que qualquer site de
 * reserva mostra. Por isso devolve apenas livre/ocupado e as datas do
 * conflito, nunca nome ou telefone de quem reservou.
 *
 * O agente do WhatsApp usa a /api/consultar, que exige token e traz
 * preço junto.
 */
export async function GET(request: Request) {
  if (excedeuLimite(`disponibilidade:${ipDaRequisicao(request)}`, 30, 60_000)) {
    return NextResponse.json(
      { erro: "Muitas consultas seguidas. Aguarde um instante." },
      { status: 429 },
    );
  }

  const { searchParams } = new URL(request.url);
  const checkin = searchParams.get("checkin") ?? "";
  const checkout = searchParams.get("checkout") ?? "";

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(checkin) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(checkout)
  ) {
    return NextResponse.json({ erro: "Datas inválidas." }, { status: 400 });
  }

  if (!supabaseConfigurado()) {
    // Sem banco não dá para afirmar nada. Melhor dizer "não sei" do que
    // prometer uma data que pode estar ocupada.
    return NextResponse.json({ conhecido: false });
  }

  // O que precisa estar livre é o período efetivamente cobrado: numa data
  // de feriado, o bloco inteiro, não só as noites que a pessoa escolheu.
  const orcamento = calcularOrcamento({ checkin, checkout, pessoas: 1 });
  const inicio = orcamento.valido ? orcamento.checkin : checkin;
  const fim = orcamento.valido ? orcamento.checkout : checkout;

  try {
    const d = await verificarDisponibilidade(inicio, fim);
    return NextResponse.json({
      conhecido: true,
      livre: d.livre,
      checkin: inicio,
      checkout: fim,
      conflitos: d.conflitos.map((c) => ({
        inicio: c.inicio,
        fim: c.fim,
        tipo: c.tipo,
      })),
    });
  } catch (e) {
    console.error("[disponibilidade]", e);
    return NextResponse.json({ conhecido: false });
  }
}
