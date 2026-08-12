import { NextResponse } from "next/server";
import { after } from "next/server";
import { calcularOrcamento } from "@/lib/pricing";
import { verificarDisponibilidade } from "@/lib/agenda";
import { getSupabase, supabaseConfigurado } from "@/lib/supabase";
import { excedeuLimite, ipDaRequisicao } from "@/lib/rate-limit";
import { avisarLeadNovo } from "@/lib/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/**
 * O disparo de WhatsApp sai dentro de `after()`, depois da resposta, mas
 * ainda dentro do tempo da invocação. O envio tem timeout de 15s e a
 * semeadura da sessão fala com o banco antes — 30s dá folga sem prender
 * a pessoa esperando o valor dela.
 */
export const maxDuration = 30;

/**
 * O lead entra AQUI, e entra cedo.
 *
 * A calculadora não mostra mais o valor de graça: a pessoa preenche nome
 * e WhatsApp, este POST grava o pedido e devolve o `id`, e só então o
 * orçamento aparece na tela. Quem mexer nas datas depois disso cai no
 * PATCH, que atualiza o MESMO registro — senão cada ajuste viraria um
 * lead novo e o painel encheria de duplicata da mesma pessoa.
 *
 * O valor é sempre recalculado aqui. O que vem do navegador é palpite.
 */

const JANELA_MS = 10 * 60 * 1000;
/** Leads novos por IP. Uma família decidindo junta não passa disso. */
const LIMITE_NOVOS = 5;
/** Ajustes no mesmo lead: mexer nas datas várias vezes é normal. */
const LIMITE_AJUSTES = 40;

function limpar(valor: unknown, max: number): string {
  return typeof valor === "string" ? valor.trim().slice(0, max) : "";
}

type Pedido =
  | { erro: string; status: number }
  | { registro: Record<string, unknown>; extra: Record<string, unknown> };

/**
 * Lê o corpo, valida e recalcula. É a mesma leitura para quem está
 * criando o lead e para quem está corrigindo o que já mandou.
 */
async function montarPedido(corpo: Record<string, unknown>): Promise<Pedido> {
  const nome = limpar(corpo.nome, 120);
  const telefone = limpar(corpo.telefone, 25);
  const email = limpar(corpo.email, 160);
  const ocasiao = limpar(corpo.ocasiao, 60);
  const observacoes = limpar(corpo.observacoes, 800);
  const periodoDesejado = limpar(corpo.periodoDesejado, 120);
  const pessoas = Number(corpo.pessoas);
  const hidromassagem = corpo.hidromassagem === true;
  const temData = corpo.temData !== false;

  if (nome.length < 3) {
    return { erro: "Informe seu nome.", status: 400 };
  }
  if (telefone.replace(/\D/g, "").length < 10) {
    return { erro: "Informe um WhatsApp válido com DDD.", status: 400 };
  }

  const base = {
    nome,
    telefone: telefone.replace(/\D/g, ""),
    email: email || null,
    pessoas: Number.isFinite(pessoas) && pessoas > 0 ? Math.round(pessoas) : 1,
    ocasiao: ocasiao || null,
    hidromassagem,
    observacoes: observacoes || null,
    origem: "site",
  };

  // ---- Caminho 1: cliente ainda não escolheu a data ----
  if (!temData) {
    return {
      registro: {
        ...base,
        tem_data: false,
        periodo_desejado: periodoDesejado || null,
        checkin: null,
        checkout: null,
        valor_calculado: null,
        tipo_calculo: null,
      },
      extra: { temData: false },
    };
  }

  // ---- Caminho 2: cliente já tem data ----
  const checkin = limpar(corpo.checkin, 10);
  const checkout = limpar(corpo.checkout, 10);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(checkin) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(checkout)
  ) {
    return { erro: "Datas inválidas.", status: 400 };
  }

  // As datas também podem mudar aqui, se caírem num bloco de feriado.
  const orcamento = calcularOrcamento({
    checkin,
    checkout,
    pessoas: base.pessoas,
    hidromassagem,
  });

  if (!orcamento.valido) {
    return {
      erro: orcamento.erro ?? "Não foi possível calcular o orçamento.",
      status: 400,
    };
  }

  // Data ocupada não impede o registro — o calendário do site já bloqueia
  // o que está vendido, e um lead com conflito ainda é um lead: dá para
  // oferecer outra data. Perder o contato é que não dá.
  let livre: boolean | null = null;
  if (supabaseConfigurado()) {
    try {
      const d = await verificarDisponibilidade(
        orcamento.checkin,
        orcamento.checkout,
      );
      livre = d.livre;
    } catch (e) {
      console.error("[orcamento] falha ao checar agenda:", e);
    }
  }

  return {
    registro: {
      ...base,
      tem_data: true,
      periodo_desejado: null,
      checkin: orcamento.checkin,
      checkout: orcamento.checkout,
      valor_calculado: orcamento.valorTotal,
      tipo_calculo: orcamento.tipoCalculo,
    },
    extra: {
      temData: true,
      valor: orcamento.valorTotal,
      checkin: orcamento.checkin,
      checkout: orcamento.checkout,
      pacoteObrigatorio: orcamento.pacoteObrigatorio ?? null,
      disponivel: livre,
    },
  };
}

async function lerCorpo(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ============================================================
//  POST — nasce o lead
// ============================================================

export async function POST(request: Request) {
  const ip = ipDaRequisicao(request);
  if (excedeuLimite(`orcamento:${ip}`, LIMITE_NOVOS, JANELA_MS)) {
    return NextResponse.json(
      { erro: "Muitos pedidos seguidos. Tente novamente em alguns minutos." },
      { status: 429 },
    );
  }

  const corpo = await lerCorpo(request);
  if (!corpo) {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  const pedido = await montarPedido(corpo);
  if ("erro" in pedido) {
    return NextResponse.json({ erro: pedido.erro }, { status: pedido.status });
  }

  const registro: Record<string, unknown> = {
    ...pedido.registro,
    status: "novo",
  };

  if (!supabaseConfigurado()) {
    console.warn(
      "[orcamento] Supabase não configurado — pedido não foi gravado:",
      registro.nome,
      registro.telefone,
    );
    return NextResponse.json({ ok: true, ...pedido.extra, registrado: false });
  }

  const { data, error } = await getSupabase()
    .from("orcamentos")
    .insert(registro)
    .select("id")
    .single();

  if (error) {
    console.error("[orcamento] falha ao gravar no Supabase:", error.message);
    return NextResponse.json(
      { erro: "Não conseguimos registrar seu pedido agora." },
      { status: 500 },
    );
  }

  const id = data.id as string;

  /*
    A mensagem de boas-vindas sai DEPOIS da resposta. A pessoa está
    olhando a tela esperando o valor dela aparecer; ela não pode ficar
    presa em quinze segundos de Evolution API. E, se o WhatsApp estiver
    fora do ar, isso não pode virar erro no envio do orçamento.

    O disparo tem travas próprias (chave em LEAD_WHATSAPP_ATIVO, teto
    diário e trava de duplicata). Elas moram em `src/lib/leads.ts`.
  */
  const disponivel =
    typeof pedido.extra.disponivel === "boolean" ? pedido.extra.disponivel : null;
  after(() => avisarLeadNovo(id, disponivel));

  return NextResponse.json({
    ok: true,
    registrado: true,
    id,
    ...pedido.extra,
  });
}

// ============================================================
//  PATCH — o mesmo lead, corrigido
//
//  Quem já viu o valor pode mexer nas datas, no número de pessoas, ou
//  enfim clicar para falar no WhatsApp. Tudo isso atualiza o registro
//  que já existe.
//
//  O `id` é um uuid que só quem criou o lead recebeu, e mesmo assim a
//  atualização só alcança pedido vindo do site e ainda intocado no
//  painel: assim que alguém marca "em contato", o registro congela e
//  nenhuma chamada de fora reescreve o que a equipe já anotou.
// ============================================================

export async function PATCH(request: Request) {
  const ip = ipDaRequisicao(request);
  if (excedeuLimite(`orcamento-ajuste:${ip}`, LIMITE_AJUSTES, JANELA_MS)) {
    return NextResponse.json(
      { erro: "Muitas alterações seguidas." },
      { status: 429 },
    );
  }

  const corpo = await lerCorpo(request);
  if (!corpo) {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  const id = limpar(corpo.id, 40);
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }

  const pedido = await montarPedido(corpo);
  if ("erro" in pedido) {
    return NextResponse.json({ erro: pedido.erro }, { status: pedido.status });
  }

  if (!supabaseConfigurado()) {
    return NextResponse.json({ ok: true, ...pedido.extra, registrado: false });
  }

  const registro = { ...pedido.registro };
  if (corpo.abriuWhatsapp === true) {
    registro.abriu_whatsapp_em = new Date().toISOString();
  }

  const { error } = await getSupabase()
    .from("orcamentos")
    .update(registro)
    .eq("id", id)
    .eq("origem", "site")
    .eq("status", "novo");

  if (error) {
    console.error("[orcamento] falha ao atualizar:", error.message);
    return NextResponse.json(
      { erro: "Não conseguimos atualizar seu pedido agora." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, registrado: true, id, ...pedido.extra });
}
