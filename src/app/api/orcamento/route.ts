import { NextResponse } from "next/server";
import { calcularOrcamento } from "@/lib/pricing";
import { getSupabase, supabaseConfigurado } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Limite simples por IP: 5 pedidos a cada 10 minutos.
 * Segura envio automatizado sem atrapalhar quem está de fato orçando.
 * É por instância — para algo mais forte, usar Upstash/Redis.
 */
const JANELA_MS = 10 * 60 * 1000;
const LIMITE = 5;
const acessos = new Map<string, number[]>();

function excedeuLimite(ip: string): boolean {
  const agora = Date.now();
  const anteriores = (acessos.get(ip) ?? []).filter((t) => agora - t < JANELA_MS);
  anteriores.push(agora);
  acessos.set(ip, anteriores);

  // Evita o mapa crescer sem parar em execuções longas.
  if (acessos.size > 5000) {
    for (const [chave, marcas] of acessos) {
      if (marcas.every((t) => agora - t >= JANELA_MS)) acessos.delete(chave);
    }
  }
  return anteriores.length > LIMITE;
}

function limpar(valor: unknown, max: number): string {
  return typeof valor === "string" ? valor.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "desconhecido";

  if (excedeuLimite(ip)) {
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
  const checkin = limpar(corpo.checkin, 10);
  const checkout = limpar(corpo.checkout, 10);
  const ocasiao = limpar(corpo.ocasiao, 60);
  const observacoes = limpar(corpo.observacoes, 800);
  const pessoas = Number(corpo.pessoas);
  const hidromassagem = corpo.hidromassagem === true;

  if (nome.length < 3) {
    return NextResponse.json({ erro: "Informe seu nome." }, { status: 400 });
  }
  if (telefone.replace(/\D/g, "").length < 10) {
    return NextResponse.json(
      { erro: "Informe um WhatsApp válido com DDD." },
      { status: 400 },
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkin) || !/^\d{4}-\d{2}-\d{2}$/.test(checkout)) {
    return NextResponse.json({ erro: "Datas inválidas." }, { status: 400 });
  }

  // O valor é sempre recalculado aqui. O que vem do navegador é só palpite:
  // aceitar o preço do cliente permitiria forjar um orçamento de R$ 1.
  const orcamento = calcularOrcamento({
    checkin,
    checkout,
    pessoas,
    hidromassagem,
  });

  if (!orcamento.valido) {
    return NextResponse.json(
      { erro: orcamento.erro ?? "Não foi possível calcular o orçamento." },
      { status: 400 },
    );
  }

  const registro = {
    nome,
    telefone: telefone.replace(/\D/g, ""),
    email: email || null,
    checkin,
    checkout,
    pessoas: orcamento.pessoas,
    ocasiao: ocasiao || null,
    hidromassagem,
    observacoes: observacoes || null,
    valor_calculado: orcamento.valorTotal,
    tipo_calculo: orcamento.tipoCalculo,
    status: "novo" as const,
    origem: "site",
  };

  if (!supabaseConfigurado()) {
    // Sem banco configurado o site ainda encaminha para o WhatsApp;
    // o lead chega, só não fica registrado no painel.
    console.warn(
      "[orcamento] Supabase não configurado — pedido não foi gravado:",
      registro.nome,
      registro.telefone,
    );
    return NextResponse.json({
      ok: true,
      registrado: false,
      valor: orcamento.valorTotal,
    });
  }

  const { error } = await getSupabase().from("orcamentos").insert(registro);

  if (error) {
    console.error("[orcamento] falha ao gravar no Supabase:", error.message);
    return NextResponse.json(
      { erro: "Não conseguimos registrar seu pedido agora." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    registrado: true,
    valor: orcamento.valorTotal,
  });
}
