import { NextResponse } from "next/server";
import { enviarLembretes7Dias, previaDaAgenda } from "@/lib/avisos";
import { supabaseConfigurado } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Dois envios por reserva, cada um com timeout de 15s. 60s sobra. */
export const maxDuration = 60;

/**
 * Lembrete de 7 dias — a segunda automação.
 *
 * Roda uma vez por dia pelo cron da Vercel (veja `vercel.json`) e avisa
 * a Maurizia e o grupo dos donos de todo aluguel CONFIRMADO que começa
 * daqui a exatamente 7 dias.
 *
 * O cron da Vercel chega como GET com `Authorization: Bearer $CRON_SECRET`.
 * O `x-api-token` é o atalho manual, com o mesmo token que o n8n já usa —
 * serve para testar sem esperar o horário.
 *
 * Parâmetros de teste:
 *   ?simular=1        monta as mensagens e devolve SEM enviar nada
 *   ?hoje=2026-11-13  finge que hoje é essa data (alvo = hoje + 7)
 *   ?previa=1         devolve só a lista da agenda, do jeito que sai
 *
 * `?hoje=` só vale junto de `?simular=1`: mandar lembrete de data
 * escolhida à mão no WhatsApp de verdade seria confusão garantida.
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

  const params = new URL(request.url).searchParams;
  const simular = params.get("simular") === "1";

  try {
    if (params.get("previa") === "1") {
      return NextResponse.json({ previa: await previaDaAgenda() });
    }

    const hoje = simular ? params.get("hoje") || undefined : undefined;
    const resultado = await enviarLembretes7Dias({ hoje, simular });

    return NextResponse.json(resultado);
  } catch (e) {
    const erro = e instanceof Error ? e.message : "erro desconhecido";
    console.error("[cron/lembretes]", erro);
    return NextResponse.json({ erro }, { status: 500 });
  }
}
