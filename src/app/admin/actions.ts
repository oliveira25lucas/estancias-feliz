"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import {
  criarSessao,
  encerrarSessao,
  estaAutenticado,
  senhaCorreta,
} from "@/lib/auth";
import { getSupabase, type StatusReserva } from "@/lib/supabase";
import {
  avisarCancelamento,
  avisarNovoAluguel,
  avisarTrocaDeStatus,
  buscarReserva,
} from "@/lib/avisos";
import type { ReservaAviso } from "@/lib/notificacoes";

/** Toda ação abaixo passa por aqui antes de tocar no banco. */
async function exigirLogin() {
  if (!(await estaAutenticado())) {
    throw new Error("Sessão expirada. Entre novamente.");
  }
}

/**
 * Foto da reserva antes de mexer nela — é dela que sai o texto do aviso.
 * Falha de leitura nunca derruba a ação: sem aviso é ruim, painel travado
 * é pior.
 */
async function fotoParaAviso(id: string): Promise<ReservaAviso | null> {
  try {
    return await buscarReserva(id);
  } catch (e) {
    console.error("[admin] não foi possível ler a reserva para avisar:", e);
    return null;
  }
}

export async function entrar(
  _estadoAnterior: { erro?: string } | undefined,
  formData: FormData,
): Promise<{ erro?: string }> {
  const senha = String(formData.get("senha") ?? "");

  if (!senha) return { erro: "Digite a senha." };

  try {
    if (!senhaCorreta(senha)) {
      // Atraso pequeno desencoraja tentativa por força bruta.
      await new Promise((r) => setTimeout(r, 600));
      return { erro: "Senha incorreta." };
    }
  } catch (e) {
    return {
      erro:
        e instanceof Error
          ? e.message
          : "Painel não configurado. Verifique as variáveis de ambiente.",
    };
  }

  await criarSessao();
  redirect("/admin");
}

export async function sair(): Promise<void> {
  await encerrarSessao();
  redirect("/admin/login");
}

export async function atualizarStatus(
  id: string,
  status: "novo" | "em_contato" | "fechado" | "perdido",
): Promise<void> {
  await exigirLogin();

  const { error } = await getSupabase()
    .from("orcamentos")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error(`Não foi possível atualizar: ${error.message}`);
  revalidatePath("/admin");
}

export async function bloquearPeriodo(formData: FormData): Promise<void> {
  await exigirLogin();

  const data_inicio = String(formData.get("data_inicio") ?? "");
  const data_fim = String(formData.get("data_fim") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();

  if (!data_inicio || !data_fim) throw new Error("Informe as duas datas.");
  if (data_fim < data_inicio) {
    throw new Error("A data final precisa ser igual ou depois da inicial.");
  }

  const { error } = await getSupabase().from("datas_bloqueadas").insert({
    data_inicio,
    data_fim,
    motivo: motivo || null,
  });

  if (error) throw new Error(`Não foi possível bloquear: ${error.message}`);
  revalidatePath("/admin");
}

export async function liberarPeriodo(id: string): Promise<void> {
  await exigirLogin();

  const { error } = await getSupabase()
    .from("datas_bloqueadas")
    .delete()
    .eq("id", id);

  if (error) throw new Error(`Não foi possível liberar: ${error.message}`);
  revalidatePath("/admin");
}

// ============================================================
//  Reservas
//
//  A agenda daqui é a mesma que a Júlia consulta pelo WhatsApp.
//  Uma reserva criada nesta tela bloqueia a data para o agente na
//  mesma hora — é isso que substituiu o Google Calendar.
//
//  AVISOS AUTOMÁTICOS: entrar em CONFIRMADA manda a agenda atualizada
//  para o grupo dos donos e para a Maurizia; sair de CONFIRMADA manda o
//  cancelamento. Tudo dentro de `after()`, que roda DEPOIS da resposta:
//  o painel não espera o WhatsApp, e WhatsApp fora do ar não trava o
//  clique. A regra de quem recebe o quê mora em `src/lib/avisos.ts`.
// ============================================================

export async function criarReserva(formData: FormData): Promise<void> {
  await exigirLogin();

  const nome_cliente = String(formData.get("nome_cliente") ?? "").trim();
  const telefone = String(formData.get("telefone") ?? "").replace(/\D/g, "");
  const data_checkin = String(formData.get("data_checkin") ?? "");
  const data_checkout = String(formData.get("data_checkout") ?? "");
  const qtd_pessoas = Number(formData.get("qtd_pessoas")) || null;
  const valor_final = Number(formData.get("valor_final")) || null;
  const tipo_evento = String(formData.get("tipo_evento") ?? "").trim();
  const status = String(formData.get("status") ?? "PENDENTE_CONTRATO");

  if (!nome_cliente) throw new Error("Informe o nome do cliente.");
  if (!data_checkin || !data_checkout) throw new Error("Informe as duas datas.");
  if (data_checkout <= data_checkin) {
    throw new Error("A saída precisa ser depois da entrada.");
  }

  // Avisa sobre choque de datas, mas deixa o Lucas decidir: às vezes ele
  // quer registrar mesmo assim para depois remanejar.
  const { data: choques } = await getSupabase()
    .from("reservas")
    .select("id, nome_cliente, data_checkin, data_checkout")
    .neq("status", "CANCELADA")
    .lt("data_checkin", data_checkout)
    .gt("data_checkout", data_checkin);

  const { data: criada, error } = await getSupabase()
    .from("reservas")
    .insert({
      nome_cliente,
      telefone: telefone || null,
      data_checkin,
      data_checkout,
      qtd_pessoas,
      valor_final,
      tipo_evento: tipo_evento || null,
      status,
      origem: "admin",
    })
    .select(
      "id, nome_cliente, data_checkin, data_checkout, qtd_pessoas, valor_final, status",
    )
    .single();

  if (error) throw new Error(`Não foi possível criar: ${error.message}`);

  revalidatePath("/admin");

  // Reserva que já nasce confirmada avisa na hora. Nascendo em
  // PENDENTE_CONTRATO, o aviso sai quando o contrato fechar.
  const nova = criada as ReservaAviso | null;
  if (nova?.status === "CONFIRMADA") after(() => avisarNovoAluguel(nova));

  if (choques && choques.length > 0) {
    throw new Error(
      `Reserva criada, mas atenção: já existe ${choques.length} reserva nessas datas (${choques
        .map((c) => c.nome_cliente ?? "sem nome")
        .join(", ")}).`,
    );
  }
}

export async function mudarStatusReserva(
  id: string,
  status: StatusReserva,
): Promise<void> {
  await exigirLogin();

  // Lê antes de gravar: é o status anterior que diz se este clique
  // merece aviso — e qual deles.
  const antes = await fotoParaAviso(id);

  const { error } = await getSupabase()
    .from("reservas")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error(`Não foi possível atualizar: ${error.message}`);
  revalidatePath("/admin");

  if (antes) {
    const anterior = antes.status;
    after(() => avisarTrocaDeStatus(antes, anterior, status));
  }
}

export async function excluirReserva(id: string): Promise<void> {
  await exigirLogin();

  // Depois do delete não há mais de onde tirar as datas para dizer que
  // a agenda mudou, então a foto tem que sair antes.
  const antes = await fotoParaAviso(id);

  const { error } = await getSupabase().from("reservas").delete().eq("id", id);

  if (error) throw new Error(`Não foi possível excluir: ${error.message}`);
  revalidatePath("/admin");

  // Excluir uma reserva confirmada é, para quem recebe o aviso, um
  // cancelamento: a data voltou a ficar livre.
  if (antes?.status === "CONFIRMADA") {
    after(() => avisarCancelamento({ ...antes, status: "CANCELADA" }));
  }
}
