"use server";

import { revalidatePath } from "next/cache";
import { estaAutenticado } from "@/lib/auth";
import { PADROES, type Clausula, type DadosContrato, type Parcela } from "@/lib/contrato";
import {
  atualizarClausulasDoContrato,
  atualizarContrato,
  criarContrato,
  excluirContrato,
  lerContrato,
  mudarStatusContrato,
  restaurarModelo,
  salvarModelo,
  type StatusContrato,
} from "@/lib/contratos";

async function exigirLogin() {
  if (!(await estaAutenticado())) {
    throw new Error("Sessão expirada. Entre novamente.");
  }
}

// ============================================================
//  Formulário → dados do contrato
//
//  As parcelas viajam como JSON num campo escondido. Poderiam ser
//  `parcela_valor_0`, `parcela_data_0`... mas a lista cresce e encolhe
//  na tela, e reconstruir isso a partir de nomes numerados é onde some
//  a última parcela quando alguém remove a do meio.
// ============================================================

function texto(fd: FormData, chave: string, padrao = ""): string {
  const v = fd.get(chave);
  return typeof v === "string" && v.trim() ? v.trim() : padrao;
}

function numero(fd: FormData, chave: string, padrao: number): number {
  const v = Number(String(fd.get(chave) ?? "").replace(",", "."));
  return Number.isFinite(v) ? v : padrao;
}

function parcelasDoFormulario(fd: FormData): Parcela[] {
  const bruto = String(fd.get("parcelas") ?? "[]");
  try {
    const lista = JSON.parse(bruto);
    if (!Array.isArray(lista)) return [];
    return lista
      .map((p) => ({
        valor: Number(p?.valor) || 0,
        data: String(p?.data ?? "").slice(0, 10),
      }))
      .filter((p) => p.valor > 0 && p.data);
  } catch {
    // JSON quebrado vira contrato sem parcela, e a cláusula 4 diz "a
    // combinar entre as partes" — visível, em vez de um valor inventado.
    return [];
  }
}

function dadosDoFormulario(fd: FormData): DadosContrato {
  const dados: DadosContrato = {
    locatarioNome: texto(fd, "locatario_nome"),
    locatarioCpf: texto(fd, "locatario_cpf"),
    locatarioEndereco: texto(fd, "locatario_endereco"),
    locatarioTelefone: texto(fd, "locatario_telefone"),

    checkin: texto(fd, "data_checkin"),
    checkout: texto(fd, "data_checkout"),
    horaCheckin: texto(fd, "hora_checkin", PADROES.horaCheckin),
    horaCheckout: texto(fd, "hora_checkout", PADROES.horaCheckout),

    pessoasEstadia: numero(fd, "pessoas_estadia", PADROES.pessoasEstadia),
    pessoasEvento: numero(fd, "pessoas_evento", 0),

    valorTotal: numero(fd, "valor_total", 0),
    parcelas: parcelasDoFormulario(fd),
    pixChave: texto(fd, "pix_chave", PADROES.pixChave),
    pixTitular: texto(fd, "pix_titular", PADROES.pixTitular),

    caucao: numero(fd, "caucao", PADROES.caucao),
    hidromassagem: fd.get("hidromassagem") === "on" || fd.get("hidromassagem") === "true",
    hidromassagemDiaria: numero(fd, "hidromassagem_diaria", PADROES.hidromassagemDiaria),
    valorPessoaExcedente: numero(fd, "valor_pessoa_excedente", PADROES.valorPessoaExcedente),
    valorDiariaExcedente: numero(fd, "valor_diaria_excedente", PADROES.valorDiariaExcedente),
    multaAtrasoCheckin: numero(fd, "multa_atraso_checkin", PADROES.multaAtrasoCheckin),
    multaLimpeza: numero(fd, "multa_limpeza", PADROES.multaLimpeza),

    cidadeForo: texto(fd, "cidade_foro", PADROES.cidadeForo),
    dataAssinatura: texto(fd, "data_assinatura"),
  };

  if (!dados.locatarioNome) throw new Error("Informe o nome de quem vai assinar.");
  if (!dados.checkin || !dados.checkout) throw new Error("Informe entrada e saída.");
  if (dados.checkout <= dados.checkin) {
    throw new Error("A saída precisa ser depois da entrada.");
  }
  if (dados.valorTotal <= 0) throw new Error("Informe o valor do aluguel.");

  return dados;
}

// ============================================================
//  Contratos
// ============================================================

/** Cria e devolve o id, para o painel abrir o contrato na sequência. */
export async function novoContrato(fd: FormData): Promise<string> {
  await exigirLogin();
  const reservaId = texto(fd, "reserva_id") || null;
  const id = await criarContrato(dadosDoFormulario(fd), reservaId);
  revalidatePath("/admin");
  return id;
}


export async function salvarContrato(id: string, fd: FormData): Promise<void> {
  await exigirLogin();
  await atualizarContrato(id, dadosDoFormulario(fd));
  revalidatePath("/admin");
  revalidatePath(`/admin/contratos/${id}`);
}

export async function definirStatusContrato(
  id: string,
  status: StatusContrato,
): Promise<void> {
  await exigirLogin();
  await mudarStatusContrato(id, status);
  revalidatePath("/admin");
  revalidatePath(`/admin/contratos/${id}`);
}

export async function apagarContrato(id: string): Promise<void> {
  await exigirLogin();
  await excluirContrato(id);
  revalidatePath("/admin");
}

/**
 * Muda as cláusulas de UM contrato, sem tocar no modelo — o cliente que
 * pediu uma condição diferente não deve mudar o contrato dos outros.
 */
export async function salvarClausulasDesteContrato(
  id: string,
  clausulas: Clausula[],
): Promise<void> {
  await exigirLogin();
  const atual = await lerContrato(id);
  if (!atual) throw new Error("Contrato não encontrado.");
  if (atual.status === "ASSINADO") {
    // Um contrato assinado é prova. Editar o texto dele depois da
    // assinatura é justamente o que a cópia congelada existe para impedir.
    throw new Error(
      "Este contrato já está assinado. Para mudar o texto, crie um novo.",
    );
  }
  await atualizarClausulasDoContrato(id, clausulas);
  revalidatePath(`/admin/contratos/${id}`);
}

// ============================================================
//  O modelo (contrato-base)
// ============================================================

export async function salvarModeloContrato(clausulas: Clausula[]): Promise<void> {
  await exigirLogin();
  await salvarModelo(clausulas);
  revalidatePath("/admin");
}

export async function restaurarModeloContrato(): Promise<void> {
  await exigirLogin();
  await restaurarModelo();
  revalidatePath("/admin");
}
