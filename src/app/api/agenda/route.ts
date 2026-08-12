import { NextResponse } from "next/server";
import { agendaOcupada, fimDaJanela, hojeISO } from "@/lib/agenda";
import { supabaseConfigurado } from "@/lib/supabase";
import { excedeuLimite, ipDaRequisicao } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A agenda inteira em datas, para o calendário do site já nascer com as
 * datas ocupadas bloqueadas.
 *
 * Pública de propósito, e por isso devolve SÓ datas: nem nome, nem
 * telefone, nem o motivo do bloqueio, nem sequer se aquele dia é reserva
 * ou manutenção. Quem olha o calendário precisa saber se pode reservar,
 * não quem está lá.
 *
 * A /api/disponibilidade continua respondendo por período — é ela que
 * confere o bloco fechado de feriado, que pode ser maior do que as
 * datas escolhidas.
 */
export async function GET(request: Request) {
  if (excedeuLimite(`agenda:${ipDaRequisicao(request)}`, 60, 60_000)) {
    return NextResponse.json(
      { erro: "Muitas consultas seguidas. Aguarde um instante." },
      { status: 429 },
    );
  }

  if (!supabaseConfigurado()) {
    // Sem banco não dá para afirmar que alguma data está livre. Dizer
    // "não sei" faz o calendário abrir sem bloqueio nenhum e deixar a
    // conferência para o envio, que é checado no servidor.
    return NextResponse.json({ conhecido: false });
  }

  const de = hojeISO();

  try {
    const agenda = await agendaOcupada(de, fimDaJanela(de));

    return NextResponse.json(
      { conhecido: true, ...agenda },
      {
        headers: {
          // Um minuto de cache na borda segura rajada de acesso sem
          // atrasar de forma perceptível uma reserva recém-criada — e o
          // envio do orçamento reconfere no servidor de qualquer jeito.
          "Cache-Control":
            "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (e) {
    console.error("[agenda]", e);
    return NextResponse.json({ conhecido: false });
  }
}
