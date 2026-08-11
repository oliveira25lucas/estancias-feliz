import { NextResponse } from "next/server";
import { calcularOrcamento } from "@/lib/pricing";
import { verificarDisponibilidade } from "@/lib/agenda";
import { getSupabase, supabaseConfigurado } from "@/lib/supabase";
import { excedeuLimite, ipDaRequisicao } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JANELA_MS = 10 * 60 * 1000;
const LIMITE = 5;

function limpar(valor: unknown, max: number): string {
  return typeof valor === "string" ? valor.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  if (excedeuLimite(ipDaRequisicao(request), LIMITE, JANELA_MS)) {
    return NextResponse.json(
      { erro: "Muitos pedidos seguidos. Tente novamente em alguns minutos." },
      { status: 429 },
    );
  }

  let corpo: Record<string, unknown>;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

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
    return NextResponse.json({ erro: "Informe seu nome." }, { status: 400 });
  }
  if (telefone.replace(/\D/g, "").length < 10) {
    return NextResponse.json(
      { erro: "Informe um WhatsApp válido com DDD." },
      { status: 400 },
    );
  }

  const base = {
    nome,
    telefone: telefone.replace(/\D/g, ""),
    email: email || null,
    pessoas: Number.isFinite(pessoas) && pessoas > 0 ? Math.round(pessoas) : 1,
    ocasiao: ocasiao || null,
    hidromassagem,
    observacoes: observacoes || null,
    status: "novo" as const,
    origem: "site",
  };

  // ---- Caminho 1: cliente ainda não escolheu a data ----
  if (!temData) {
    const registro = {
      ...base,
      tem_data: false,
      periodo_desejado: periodoDesejado || null,
      checkin: null,
      checkout: null,
      valor_calculado: null,
      tipo_calculo: null,
    };
    return gravar(registro, { registrado: true });
  }

  // ---- Caminho 2: cliente já tem data ----
  const checkin = limpar(corpo.checkin, 10);
  const checkout = limpar(corpo.checkout, 10);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(checkin) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(checkout)
  ) {
    return NextResponse.json({ erro: "Datas inválidas." }, { status: 400 });
  }

  // O valor é sempre recalculado aqui. O que vem do navegador é só
  // palpite: aceitar o preço do cliente permitiria forjar um orçamento
  // de R$ 1. As datas também podem mudar, se caírem num bloco de feriado.
  const orcamento = calcularOrcamento({
    checkin,
    checkout,
    pessoas: base.pessoas,
    hidromassagem,
  });

  if (!orcamento.valido) {
    return NextResponse.json(
      { erro: orcamento.erro ?? "Não foi possível calcular o orçamento." },
      { status: 400 },
    );
  }

  // Se a data já estiver ocupada, o pedido ainda é gravado — o Lucas
  // pode oferecer outra data. Melhor um lead com conflito do que nenhum.
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

  const registro = {
    ...base,
    tem_data: true,
    periodo_desejado: null,
    checkin: orcamento.checkin,
    checkout: orcamento.checkout,
    valor_calculado: orcamento.valorTotal,
    tipo_calculo: orcamento.tipoCalculo,
  };

  return gravar(registro, {
    registrado: true,
    valor: orcamento.valorTotal,
    checkin: orcamento.checkin,
    checkout: orcamento.checkout,
    pacoteObrigatorio: orcamento.pacoteObrigatorio ?? null,
    disponivel: livre,
  });
}

/**
 * Grava o pedido. Se o banco falhar, ainda respondemos ok: o cliente
 * é levado ao WhatsApp de qualquer jeito, e um contato não pode se
 * perder por causa de uma falha nossa.
 */
async function gravar(
  registro: Record<string, unknown>,
  extra: Record<string, unknown>,
) {
  if (!supabaseConfigurado()) {
    console.warn(
      "[orcamento] Supabase não configurado — pedido não foi gravado:",
      registro.nome,
      registro.telefone,
    );
    return NextResponse.json({ ok: true, ...extra, registrado: false });
  }

  const { error } = await getSupabase().from("orcamentos").insert(registro);

  if (error) {
    console.error("[orcamento] falha ao gravar no Supabase:", error.message);
    return NextResponse.json(
      { erro: "Não conseguimos registrar seu pedido agora." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, ...extra });
}
