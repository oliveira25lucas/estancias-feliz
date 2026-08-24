/**
 * Contratos — a parte que fala com o banco.
 *
 * O texto, as cláusulas e as contas moram em `contrato.ts`, que é puro e
 * testado. Aqui fica só ler e gravar, na mesma divisão que
 * `notificacoes.ts` / `avisos.ts` já usa.
 *
 * ⚠️ NUMERIC VOLTA COMO STRING. O cliente do Supabase entrega colunas
 * `numeric` do Postgres como texto — `"3900.00"`, não `3900` — porque um
 * numeric pode não caber num double sem perder precisão. Somar sem
 * converter concatena: "3900" + "500" vira "3900500". Todo campo de
 * dinheiro passa por `num()` na entrada. É o mesmo tropeço que
 * `reservas.valor_final` já documenta.
 */

import { getSupabase } from "./supabase";
import {
  CLAUSULAS_BASE,
  PADROES,
  type Clausula,
  type DadosContrato,
  type Parcela,
} from "./contrato";

export type StatusContrato = "RASCUNHO" | "ENVIADO" | "ASSINADO";

/** Uma linha da tabela `contratos`, já convertida para números de verdade. */
export type Contrato = DadosContrato & {
  id: string;
  criadoEm: string;
  atualizadoEm: string;
  reservaId: string | null;
  status: StatusContrato;
  /** Cópia congelada do modelo, com as {{variaveis}} ainda dentro. */
  clausulas: Clausula[];
};

function num(v: unknown, padrao = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : padrao;
}

function texto(v: unknown, padrao = ""): string {
  return typeof v === "string" ? v : padrao;
}

// ============================================================
//  O modelo (contrato-base)
// ============================================================

/**
 * As cláusulas que os próximos contratos vão usar.
 *
 * Tabela vazia = ninguém editou nada ainda, e o modelo é o do código.
 * Isso é de propósito: o painel nunca fica sem contrato para emitir, e
 * o texto original tem só uma cópia — a que os testes vigiam.
 */
export async function lerModelo(): Promise<Clausula[]> {
  const { data, error } = await getSupabase()
    .from("contrato_clausulas")
    .select("ordem, texto, condicao, ativa")
    .order("ordem", { ascending: true });

  if (error) {
    // Tabela ainda não criada (falta rodar a 007) não pode derrubar o
    // painel: cai no modelo do código e o contrato sai igual.
    console.error("[contratos] modelo do banco indisponível:", error.message);
    return CLAUSULAS_BASE;
  }
  if (!data || data.length === 0) return CLAUSULAS_BASE;

  return data.map((c) => ({
    ordem: num(c.ordem),
    texto: texto(c.texto),
    condicao: c.condicao ? String(c.condicao) : null,
    ativa: c.ativa !== false,
  }));
}

/**
 * Grava o modelo inteiro de uma vez — apaga e reescreve.
 *
 * Parece grosseiro e é o certo: são 30 linhas de texto, o painel edita a
 * lista toda na tela, e diferenciar o que mudou para fazer UPDATE
 * seletivo custaria mais código do que vale. Reescrever também é o que
 * torna reordenar trivial.
 *
 * Contratos JÁ EMITIDOS não são tocados — eles guardam a própria cópia.
 */
export async function salvarModelo(clausulas: Clausula[]): Promise<void> {
  const supabase = getSupabase();

  const limpas = clausulas
    .map((c, i) => ({
      ordem: Number.isFinite(c.ordem) ? c.ordem : i + 1,
      texto: c.texto.trim(),
      condicao: c.condicao || null,
      ativa: c.ativa !== false,
    }))
    .filter((c) => c.texto.length > 0);

  if (limpas.length === 0) {
    throw new Error("O modelo não pode ficar sem nenhuma cláusula.");
  }

  const { error: erroApagar } = await supabase
    .from("contrato_clausulas")
    .delete()
    .not("id", "is", null);
  if (erroApagar) {
    throw new Error(`Não foi possível salvar o modelo: ${erroApagar.message}`);
  }

  const { error } = await supabase.from("contrato_clausulas").insert(limpas);
  if (error) {
    throw new Error(`Não foi possível salvar o modelo: ${error.message}`);
  }
}

/** Volta o modelo para o texto do código, como veio de fábrica. */
export async function restaurarModelo(): Promise<void> {
  const { error } = await getSupabase()
    .from("contrato_clausulas")
    .delete()
    .not("id", "is", null);
  if (error) {
    throw new Error(`Não foi possível restaurar: ${error.message}`);
  }
}

// ============================================================
//  Contratos emitidos
// ============================================================

type LinhaContrato = Record<string, unknown>;

function daLinha(l: LinhaContrato): Contrato {
  const parcelas = Array.isArray(l.parcelas)
    ? (l.parcelas as unknown[]).map((p) => {
        const item = (p ?? {}) as Record<string, unknown>;
        return { valor: num(item.valor), data: texto(item.data) } as Parcela;
      })
    : [];

  const clausulas = Array.isArray(l.clausulas)
    ? (l.clausulas as unknown[]).map((c, i) => {
        const item = (c ?? {}) as Record<string, unknown>;
        return {
          ordem: num(item.ordem, i + 1),
          texto: texto(item.texto),
          condicao: item.condicao ? String(item.condicao) : null,
          ativa: item.ativa !== false,
        } as Clausula;
      })
    : [];

  return {
    id: String(l.id),
    criadoEm: texto(l.criado_em),
    atualizadoEm: texto(l.atualizado_em),
    reservaId: l.reserva_id ? String(l.reserva_id) : null,
    status: (texto(l.status, "RASCUNHO") as StatusContrato) ?? "RASCUNHO",

    locatarioNome: texto(l.locatario_nome),
    locatarioCpf: texto(l.locatario_cpf),
    locatarioEndereco: texto(l.locatario_endereco),
    locatarioTelefone: texto(l.locatario_telefone),

    checkin: texto(l.data_checkin).slice(0, 10),
    checkout: texto(l.data_checkout).slice(0, 10),
    horaCheckin: texto(l.hora_checkin, PADROES.horaCheckin).slice(0, 5),
    horaCheckout: texto(l.hora_checkout, PADROES.horaCheckout).slice(0, 5),

    pessoasEstadia: num(l.pessoas_estadia, PADROES.pessoasEstadia),
    pessoasEvento: num(l.pessoas_evento, 0),

    valorTotal: num(l.valor_total),
    parcelas,
    pixChave: texto(l.pix_chave, PADROES.pixChave),
    pixTitular: texto(l.pix_titular, PADROES.pixTitular),

    caucao: num(l.caucao, PADROES.caucao),
    hidromassagem: l.hidromassagem === true,
    hidromassagemDiaria: num(l.hidromassagem_diaria, PADROES.hidromassagemDiaria),
    valorPessoaExcedente: num(l.valor_pessoa_excedente, PADROES.valorPessoaExcedente),
    valorDiariaExcedente: num(l.valor_diaria_excedente, PADROES.valorDiariaExcedente),
    multaAtrasoCheckin: num(l.multa_atraso_checkin, PADROES.multaAtrasoCheckin),
    multaLimpeza: num(l.multa_limpeza, PADROES.multaLimpeza),

    cidadeForo: texto(l.cidade_foro, PADROES.cidadeForo),
    dataAssinatura: texto(l.data_assinatura).slice(0, 10),

    clausulas: clausulas.length > 0 ? clausulas : CLAUSULAS_BASE,
  };
}

function paraLinha(d: DadosContrato): LinhaContrato {
  return {
    locatario_nome: d.locatarioNome,
    locatario_cpf: d.locatarioCpf || null,
    locatario_endereco: d.locatarioEndereco || null,
    locatario_telefone: d.locatarioTelefone || null,
    data_checkin: d.checkin,
    data_checkout: d.checkout,
    hora_checkin: d.horaCheckin,
    hora_checkout: d.horaCheckout,
    pessoas_estadia: d.pessoasEstadia,
    pessoas_evento: d.pessoasEvento,
    valor_total: d.valorTotal,
    parcelas: d.parcelas,
    pix_chave: d.pixChave || null,
    pix_titular: d.pixTitular || null,
    caucao: d.caucao,
    hidromassagem: d.hidromassagem,
    hidromassagem_diaria: d.hidromassagemDiaria,
    valor_pessoa_excedente: d.valorPessoaExcedente,
    valor_diaria_excedente: d.valorDiariaExcedente,
    multa_atraso_checkin: d.multaAtrasoCheckin,
    multa_limpeza: d.multaLimpeza,
    cidade_foro: d.cidadeForo,
    data_assinatura: d.dataAssinatura || null,
  };
}

export async function listarContratos(limite = 200): Promise<Contrato[]> {
  const { data, error } = await getSupabase()
    .from("contratos")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(limite);

  if (error) {
    console.error("[contratos] falha ao listar:", error.message);
    return [];
  }
  return (data ?? []).map(daLinha);
}

export async function lerContrato(id: string): Promise<Contrato | null> {
  const { data, error } = await getSupabase()
    .from("contratos")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Não foi possível ler o contrato: ${error.message}`);
  return data ? daLinha(data) : null;
}

/**
 * Cria o contrato E congela o modelo dentro dele, no mesmo instante.
 *
 * A cópia é feita aqui, e não na leitura, porque é o nascimento do
 * documento que define qual texto vale. Editar o modelo amanhã não pode
 * reescrever o que já foi enviado hoje.
 */
export async function criarContrato(
  dados: DadosContrato,
  reservaId: string | null = null,
): Promise<string> {
  const modelo = await lerModelo();

  const { data, error } = await getSupabase()
    .from("contratos")
    .insert({
      ...paraLinha(dados),
      reserva_id: reservaId,
      clausulas: modelo,
      status: "RASCUNHO",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Não foi possível criar o contrato: ${error.message}`);
  return String(data.id);
}

/** Corrige os dados de um contrato. As cláusulas congeladas não mudam. */
export async function atualizarContrato(
  id: string,
  dados: DadosContrato,
): Promise<void> {
  const { error } = await getSupabase()
    .from("contratos")
    .update({ ...paraLinha(dados), atualizado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`Não foi possível salvar: ${error.message}`);
}

/**
 * Troca as cláusulas DESTE contrato, sem tocar no modelo.
 *
 * Serve para o caso que sempre aparece: um cliente pediu uma condição
 * diferente e só ele tem essa cláusula.
 */
export async function atualizarClausulasDoContrato(
  id: string,
  clausulas: Clausula[],
): Promise<void> {
  const { error } = await getSupabase()
    .from("contratos")
    .update({ clausulas, atualizado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`Não foi possível salvar as cláusulas: ${error.message}`);
}

export async function mudarStatusContrato(
  id: string,
  status: StatusContrato,
): Promise<void> {
  const { error } = await getSupabase()
    .from("contratos")
    .update({ status, atualizado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`Não foi possível atualizar: ${error.message}`);
}

export async function excluirContrato(id: string): Promise<void> {
  const { error } = await getSupabase().from("contratos").delete().eq("id", id);
  if (error) throw new Error(`Não foi possível excluir: ${error.message}`);
}
