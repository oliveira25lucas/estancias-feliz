import { NextResponse } from "next/server";
import { enviarLembretes7Dias, previaDaAgenda } from "@/lib/avisos";
import { retomarLeadsSemResposta } from "@/lib/leads";
import { supabaseConfigurado } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Dois envios por reserva, cada um com timeout de 15s. 60s sobra. */
export const maxDuration = 60;

/**
 * O que roda uma vez por dia. Duas coisas, na mesma invocação:
 *
 *   1. LEMBRETE DE 7 DIAS. Avisa a Maurizia e o grupo dos donos de todo
 *      aluguel CONFIRMADO que começa daqui a exatamente 7 dias.
 *   2. RETOMADA DE LEAD. Quem pediu orçamento no site, recebeu a
 *      mensagem automática e nunca respondeu leva um único retorno.
 *
 * As duas são independentes de propósito: a retomada falha com o cliente
 * lá fora, o lembrete falha com a equipe. Um erro na primeira não pode
 * fazer a Maurizia perder o aviso da limpeza, então ela roda depois e
 * dentro do seu próprio try.
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

    // A retomada é a única automação que fala com CLIENTE. Falhar aqui
    // não pode derrubar o lembrete da limpeza, que já saiu acima.
    let leads;
    try {
      leads = await retomarLeadsSemResposta({ hoje, simular });
    } catch (e) {
      const erro = e instanceof Error ? e.message : "erro desconhecido";
      console.error("[cron/lembretes] retomada de leads:", erro);
      leads = { erro };
    }

    return NextResponse.json({ ...resultado, leads });
  } catch (e) {
    const erro = e instanceof Error ? e.message : "erro desconhecido";
    console.error("[cron/lembretes]", erro);
    return NextResponse.json({ erro }, { status: 500 });
  }
}
