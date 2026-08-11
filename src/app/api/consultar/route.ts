import { NextResponse } from "next/server";
import {
  calcularOrcamento,
  formatarBRL,
  formatarDataBR,
  tabelaDePrecos,
} from "@/lib/pricing";
import { verificarDisponibilidade, proximosFinsDeSemanaLivres } from "@/lib/agenda";
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
      fatos: [
        "O cliente ainda não informou data.",
        ...tabela.map(
          (l) =>
            `${l.titulo} (${l.detalhe}): ${l.prefixo ? l.prefixo + " " : ""}${formatarBRL(l.valor)}`,
        ),
        ...(sugestoes.length > 0
          ? [
              "Fins de semana livres a sugerir: " +
                sugestoes
                  .map(
                    (s) =>
                      `${formatarDataBR(s.checkin)} a ${formatarDataBR(s.checkout)}`,
                  )
                  .join("; "),
            ]
          : []),
        "⛔ Não invente valores fora desta lista.",
      ].join("\n"),
    });
  }

  // ---- Com data: calcula o valor ----
  const orcamento = calcularOrcamento({
    checkin,
    checkout,
    pessoas,
    hidromassagem,
  });

  if (!orcamento.valido) {
    return NextResponse.json(
      {
        temData: true,
        erro: orcamento.erro,
        fatos: `Não foi possível calcular: ${orcamento.erro}. Peça a informação que falta e NÃO mencione nenhum valor.`,
      },
      { status: 200 },
    );
  }

  // ---- Disponibilidade do período efetivamente cobrado ----
  // Se a data cai em feriado, o que precisa estar livre é o bloco inteiro.
  let disponibilidade = null;
  let erroAgenda: string | null = null;

  if (supabaseConfigurado()) {
    try {
      disponibilidade = await verificarDisponibilidade(
        orcamento.checkin,
        orcamento.checkout,
      );
    } catch (e) {
      erroAgenda = e instanceof Error ? e.message : "erro desconhecido";
    }
  } else {
    erroAgenda = "banco não configurado";
  }

  // ---- Fatos que a IA pode afirmar ----
  const fatos: string[] = [];

  if (orcamento.pacoteObrigatorio) {
    fatos.push(
      `⚠️ A data pedida cai em feriado. ${orcamento.pacoteObrigatorio.motivo}`,
    );
    if (orcamento.pacoteObrigatorio.inicioAlternativo) {
      fatos.push(
        `O cliente também pode entrar em ${formatarDataBR(orcamento.pacoteObrigatorio.inicioAlternativo)}, pagando o mesmo pacote.`,
      );
    }
  }

  fatos.push(
    `Período: ${formatarDataBR(orcamento.checkin)} a ${formatarDataBR(orcamento.checkout)} (${orcamento.dias} ${orcamento.dias === 1 ? "diária" : "diárias"}).`,
    `Pessoas: ${orcamento.pessoas}.`,
    `Tipo de cálculo: ${orcamento.tipoCalculo}.`,
    `╔══ VALOR OFICIAL ══╗ ${formatarBRL(orcamento.valorTotal)}`,
    `Caução à parte: ${formatarBRL(orcamento.caucao)}, devolvida ao final.`,
  );

  if (orcamento.valorHidromassagem > 0) {
    fatos.push(
      `Inclui hidromassagem: ${formatarBRL(orcamento.valorHidromassagem)}.`,
    );
  }

  if (disponibilidade) {
    fatos.push(
      disponibilidade.livre
        ? "✅ DISPONIBILIDADE: a data está LIVRE. Pode confirmar ao cliente."
        : `❌ DISPONIBILIDADE: a data NÃO está livre. ${disponibilidade.conflitos.map((c) => c.descricao).join(" ")}`,
    );
  } else {
    fatos.push(
      "⚠️ Não foi possível checar a agenda agora. NÃO afirme que a data está livre — diga que vai confirmar e avisar em seguida.",
    );
  }

  if (orcamento.upsell) fatos.push(`Sugestão de venda: ${orcamento.upsell}`);

  fatos.push(
    "⛔ Use exatamente o VALOR OFICIAL acima. Nunca arredonde, nunca invente outro número.",
  );

  return NextResponse.json({
    temData: true,
    orcamento,
    disponibilidade,
    erroAgenda,
    fatos: fatos.join("\n"),
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
