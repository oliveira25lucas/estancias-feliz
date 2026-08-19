import { NextResponse } from "next/server";
import { airbnbConfigurado, sincronizarAirbnb } from "@/lib/airbnb";
import { supabaseConfigurado } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Baixar o feed, reconciliar e, se ligado, avisar no WhatsApp. */
export const maxDuration = 60;

/**
 * Traz para dentro o que foi reservado na Airbnb.
 *
 * QUEM CHAMA ISTO É O N8N DO VPS, de 15 em 15 minutos — não o cron da
 * Vercel. O plano Hobby só permite cron uma vez por dia, e uma vez por
 * dia não serve para agenda: a Airbnb venderia um fim de semana de
 * manhã e o site continuaria oferecendo o mesmo fim de semana até a
 * madrugada seguinte. O n8n já roda no servidor de vocês e faz isso
 * sem custo nenhum a mais.
 *
 * A metade contrária desta sincronia não precisa de rota: é a
 * `/api/calendario.ics`, que a Airbnb busca sozinha.
 *
 * Autenticação igual à do cron de lembretes: `Authorization: Bearer
 * $CRON_SECRET`, ou o `x-api-token` com o mesmo token que o n8n já usa
 * na /api/consultar.
 *
 * Parâmetro de teste:
 *   ?simular=1   lê a Airbnb, monta o plano e devolve SEM gravar nada
 */

function autorizado(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth === `Bearer ${cronSecret}`) return true;
  }

  const apiToken = process.env.API_TOKEN;
  if (apiToken && request.headers.get("x-api-token") === apiToken) return true;

  return false;
}

export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json(
      { erro: "Token inválido ou ausente." },
      { status: 401 },
    );
  }

  if (!supabaseConfigurado()) {
    return NextResponse.json(
      { erro: "Supabase não configurado." },
      { status: 500 },
    );
  }

  if (!airbnbConfigurado()) {
    // 503 e não 200: quem monitora precisa ver que a sincronia não está
    // acontecendo. Um 200 dizendo "desligado" seria lido como sucesso.
    return NextResponse.json(
      {
        erro:
          "AIRBNB_ICAL_URL não configurada. Pegue o link em Calendário → " +
          "Disponibilidade → Conectar a outro site → Exportar calendário.",
      },
      { status: 503 },
    );
  }

  const simular = new URL(request.url).searchParams.get("simular") === "1";

  try {
    const resultado = await sincronizarAirbnb({ simular });

    // Alerta não é erro: a sincronia rodou. Mas o n8n precisa conseguir
    // distinguir "rodou limpo" de "rodou e tem coisa para olhar", então
    // o campo vai sempre presente, mesmo vazio.
    return NextResponse.json(resultado);
  } catch (e) {
    const erro = e instanceof Error ? e.message : "erro desconhecido";
    console.error("[sync/airbnb]", erro);
    return NextResponse.json({ erro }, { status: 500 });
  }
}
