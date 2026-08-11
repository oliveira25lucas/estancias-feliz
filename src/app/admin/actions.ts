"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  criarSessao,
  encerrarSessao,
  estaAutenticado,
  senhaCorreta,
} from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

/** Toda ação abaixo passa por aqui antes de tocar no banco. */
async function exigirLogin() {
  if (!(await estaAutenticado())) {
    throw new Error("Sessão expirada. Entre novamente.");
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
