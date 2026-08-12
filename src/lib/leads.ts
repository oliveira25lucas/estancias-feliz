/**
 * Disparo de WhatsApp para o lead do site — a parte que fala com banco e
 * internet. Os textos moram em `notificacoes.ts`, puros e testados.
 *
 * ESTA É A ÚNICA AUTOMAÇÃO QUE ESCREVE PARA UM CLIENTE sem que ele tenha
 * mandado mensagem antes. As outras (agenda e lembrete de 7 dias) falam
 * com o grupo dos donos e com a Maurizia, que são de casa. Por isso aqui
 * há três travas que lá não existem:
 *
 *   1. LEAD_WHATSAPP_ATIVO. Sem essa variável valendo "1", nada é
 *      enviado. Publicar o código não começa a disparar sozinho — quem
 *      liga é uma pessoa, de propósito.
 *   2. TETO DIÁRIO. A Evolution é WhatsApp Web automatizado, não a API
 *      oficial: volume anormal de mensagem para quem nunca escreveu é o
 *      caminho mais curto para o número ser banido. E é o mesmo número
 *      em que a Júlia atende todo mundo.
 *   3. UMA MENSAGEM POR LEAD, travada no banco pela coluna `chave` de
 *      `notificacoes` — a mesma trava que impede o lembrete de 7 dias de
 *      sair duas vezes.
 *
 * NADA AQUI LANÇA. Falha de envio vira log e linha em `notificacoes.erro`.
 * O lead já está salvo; perder a mensagem é ruim, perder o cadastro seria
 * pior.
 */

import { getSupabase } from "./supabase";
import type { Orcamento } from "./supabase";
import {
  contextoDoLeadParaJulia,
  mensagemLeadNovo,
  mensagemLeadRetomada,
  type LeadAviso,
} from "./notificacoes";
import { hojeISO, somaDiasISO } from "./ocupacao";
import { enviarTexto, normalizarDestino, whatsappConfigurado } from "./whatsapp";

export type TipoLead = "LEAD_NOVO" | "LEAD_RETOMADA";

/**
 * Colunas que o disparo precisa. Menos que `select("*")`, de propósito.
 *
 * Numa linha só, e não concatenada: o TypeScript perde o tipo literal em
 * `"a" + "b"`, e sem literal o supabase-js não consegue inferir as
 * colunas — o resultado vira `GenericStringError[]` e o cast quebra.
 */
const CAMPOS =
  "id, nome, telefone, checkin, checkout, pessoas, ocasiao, hidromassagem, periodo_desejado, valor_calculado, status, avisado_em, retomado_em";

type LeadDoBanco = Pick<
  Orcamento,
  | "id"
  | "nome"
  | "telefone"
  | "checkin"
  | "checkout"
  | "pessoas"
  | "ocasiao"
  | "hidromassagem"
  | "periodo_desejado"
  | "valor_calculado"
  | "status"
> & { avisado_em: string | null; retomado_em: string | null };

export type ResultadoDisparo = {
  lead: string;
  enviado: boolean;
  /** Por que não foi enviado, quando não foi. */
  motivo?: string;
  /** O texto que foi (ou seria) enviado. Permite conferir sem disparar. */
  texto: string;
};

// ============================================================
//  Travas
// ============================================================

/**
 * O disparo é OPT-IN. Nenhum deploy deve começar a mandar mensagem para
 * cliente sozinho: alguém liga a chave quando decidir que é hora.
 */
export function disparoDeLeadAtivo(): boolean {
  const v = (process.env.LEAD_WHATSAPP_ATIVO || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "sim";
}

function tetoDiario(): number {
  const n = Number(process.env.LEAD_WHATSAPP_TETO_DIARIO);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30;
}

/** Meia-noite de hoje em Brasília, no formato que o Postgres entende. */
function inicioDeHoje(hoje: string): string {
  return `${hoje}T00:00:00-03:00`;
}

async function disparosHoje(hoje: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from("notificacoes")
    .select("id", { count: "exact", head: true })
    .in("tipo", ["LEAD_NOVO", "LEAD_RETOMADA"])
    .gte("criado_em", inicioDeHoje(hoje));

  if (error) throw new Error(`Falha ao contar disparos: ${error.message}`);
  return count ?? 0;
}

/**
 * Reserva o direito de enviar. Devolve o id da linha, ou `null` se este
 * disparo já aconteceu (`chave` é unique). Grava ANTES de enviar: se
 * gravasse depois, duas execuções simultâneas mandariam as duas.
 */
async function reivindicar(
  tipo: TipoLead,
  orcamentoId: string,
): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from("notificacoes")
    .insert({ tipo, orcamento_id: orcamentoId, chave: `${tipo}:${orcamentoId}` })
    .select("id")
    .maybeSingle();

  if (error) {
    // 23505 = unique_violation: este disparo já saiu antes.
    if (error.code === "23505") return null;
    throw new Error(`Falha ao registrar o disparo: ${error.message}`);
  }

  return (data as { id: string } | null)?.id ?? null;
}

async function registrarResultado(
  id: string,
  enviado: boolean,
  erro?: string,
): Promise<void> {
  await getSupabase()
    .from("notificacoes")
    .update({ enviado, destinos: enviado ? "lead" : null, erro: erro ?? null })
    .eq("id", id);
}

// ============================================================
//  A memória da Júlia
// ============================================================

function comoLead(l: LeadDoBanco, disponivel: boolean | null): LeadAviso {
  return {
    nome: l.nome,
    checkin: l.checkin,
    checkout: l.checkout,
    pessoas: l.pessoas,
    ocasiao: l.ocasiao,
    valor_calculado: l.valor_calculado,
    hidromassagem: l.hidromassagem,
    periodo_desejado: l.periodo_desejado,
    disponivel,
  };
}

/**
 * Escreve o contexto do orçamento na sessão que o n8n carrega pelo
 * telefone. É o que faz a Júlia já saber a data, o número de pessoas e o
 * valor quando a pessoa responder — em vez de perguntar tudo de novo a
 * quem acabou de informar tudo no site.
 *
 * ACRESCENTA ao histórico, nunca substitui: cliente que já conversou
 * antes não pode perder a conversa dele porque pediu um orçamento novo.
 */
async function semearSessao(
  telefone: string,
  lead: LeadAviso,
  quando: string,
  hoje: string,
): Promise<void> {
  const supabase = getSupabase();
  const contexto = contextoDoLeadParaJulia(lead, hoje);

  const { data: existente, error } = await supabase
    .from("sessoes")
    .select("id, historico_resumido")
    .eq("telefone", telefone)
    .maybeSingle();

  if (error) throw new Error(`Falha ao ler a sessão: ${error.message}`);

  const anterior = (existente?.historico_resumido as string | null)?.trim();
  const campos = {
    telefone,
    nome_cliente: lead.nome,
    data_checkin: lead.checkin,
    data_checkout: lead.checkout,
    qtd_pessoas: lead.pessoas,
    historico_resumido: anterior ? `${anterior}\n\n${contexto}` : contexto,
    // O n8n grava esta mesma coluna a cada turno. É a comparação com ela
    // que diz, no dia seguinte, se a pessoa chegou a responder.
    updated_at: quando,
  };

  const resposta = existente
    ? await supabase.from("sessoes").update(campos).eq("id", existente.id)
    : await supabase.from("sessoes").insert(campos);

  if (resposta.error) {
    throw new Error(`Falha ao gravar a sessão: ${resposta.error.message}`);
  }
}

// ============================================================
//  1. O primeiro contato
// ============================================================

/**
 * Dispara a mensagem de boas-vindas do lead recém-criado.
 *
 * Chamada de dentro de `after()` na rota de orçamento: roda DEPOIS da
 * resposta, então a pessoa não espera o WhatsApp para ver o valor dela.
 */
export async function avisarLeadNovo(
  orcamentoId: string,
  disponivel: boolean | null = null,
): Promise<ResultadoDisparo | null> {
  try {
    return await dispararPrimeiroContato(orcamentoId, disponivel);
  } catch (e) {
    console.error("[leads] avisarLeadNovo:", e);
    return null;
  }
}

async function dispararPrimeiroContato(
  orcamentoId: string,
  disponivel: boolean | null,
): Promise<ResultadoDisparo | null> {
  if (!disparoDeLeadAtivo()) {
    console.warn(
      "[leads] LEAD_WHATSAPP_ATIVO desligada — nenhuma mensagem enviada ao lead.",
    );
    return null;
  }
  if (!whatsappConfigurado()) {
    console.warn("[leads] EVOLUTION_KEY ausente — lead não recebeu mensagem.");
    return null;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("orcamentos")
    .select(CAMPOS)
    .eq("id", orcamentoId)
    .maybeSingle();

  if (error) throw new Error(`Falha ao ler o lead: ${error.message}`);
  const lead = data as LeadDoBanco | null;
  if (!lead) return null;

  const destino = normalizarDestino(lead.telefone ?? "");
  if (destino.length < 12) {
    return { lead: orcamentoId, enviado: false, motivo: "telefone inválido", texto: "" };
  }

  const hoje = hojeISO();
  if ((await disparosHoje(hoje)) >= tetoDiario()) {
    console.warn("[leads] teto diário de disparos atingido.");
    return { lead: orcamentoId, enviado: false, motivo: "teto diário", texto: "" };
  }

  const registro = await reivindicar("LEAD_NOVO", orcamentoId);
  if (!registro) {
    return { lead: orcamentoId, enviado: false, motivo: "já enviado", texto: "" };
  }

  const paraMensagem = comoLead(lead, disponivel);
  const texto = mensagemLeadNovo(paraMensagem);
  const quando = new Date().toISOString();

  // A sessão vem ANTES do envio: se a pessoa responder no mesmo minuto,
  // a Júlia já precisa saber do que se trata.
  try {
    await semearSessao(destino, paraMensagem, quando, hoje);
  } catch (e) {
    // Sem contexto a Júlia ainda atende, só começa perguntando de novo.
    // Ruim, mas não é motivo para engolir a mensagem.
    console.error("[leads] não foi possível semear a sessão:", e);
  }

  try {
    await enviarTexto(destino, texto);
  } catch (e) {
    const motivo = e instanceof Error ? e.message : "erro desconhecido";
    console.error("[leads] falha ao enviar para o lead:", motivo);
    await registrarResultado(registro, false, motivo);
    return { lead: orcamentoId, enviado: false, motivo, texto };
  }

  await registrarResultado(registro, true);
  await supabase
    .from("orcamentos")
    .update({ avisado_em: quando })
    .eq("id", orcamentoId);

  return { lead: orcamentoId, enviado: true, texto };
}

// ============================================================
//  2. A retomada do dia seguinte
// ============================================================

export type ResultadoRetomada = {
  hoje: string;
  /** Primeiro dia da janela olhada. */
  alvo: string;
  simulado: boolean;
  ativo: boolean;
  candidatos: number;
  /** Sobrou para a próxima rodada — nunca é descarte silencioso. */
  restantes: number;
  disparos: ResultadoDisparo[];
};

/**
 * Quanto tempo a varredura pode gastar enviando.
 *
 * A rota do cron tem `maxDuration = 60`, e cada envio pode levar até 15s
 * no pior caso. Sem esta trava, uma Evolution lenta faria a função
 * morrer no meio — deixando lead marcado como reivindicado e sem
 * mensagem. Quem sobra é retomado amanhã: a janela olha uma semana para
 * trás justamente para isso.
 */
const ORCAMENTO_DE_TEMPO_MS = 40_000;

/** Dias para trás que a retomada ainda alcança. */
const JANELA_DE_RETOMADA = 7;

/**
 * Retoma quem virou lead ONTEM e nunca respondeu.
 *
 * Roda no cron diário, junto do lembrete de 7 dias. Três filtros, e cada
 * um existe por um motivo:
 *
 *   status = 'novo'          se a equipe já trabalhou o lead no painel,
 *                            robô não entra por cima
 *   retomado_em is null      uma retomada por lead, no máximo
 *   sessão não mexeu         quem respondeu não precisa ser cutucado
 */
export async function retomarLeadsSemResposta(
  opcoes: { hoje?: string; simular?: boolean } = {},
): Promise<ResultadoRetomada> {
  const hoje = opcoes.hoje || hojeISO();
  const simular = opcoes.simular === true;
  const alvo = somaDiasISO(hoje, -JANELA_DE_RETOMADA);

  const resultado: ResultadoRetomada = {
    hoje,
    alvo,
    simulado: simular,
    ativo: disparoDeLeadAtivo(),
    candidatos: 0,
    restantes: 0,
    disparos: [],
  };

  if (!resultado.ativo && !simular) return resultado;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("orcamentos")
    .select(CAMPOS)
    .eq("status", "novo")
    .is("retomado_em", null)
    // Só quem foi avisado ANTES de hoje: a retomada é do dia seguinte
    // em diante, nunca em cima da mensagem que acabou de sair.
    .gte("avisado_em", inicioDeHoje(alvo))
    .lt("avisado_em", inicioDeHoje(hoje))
    .order("avisado_em", { ascending: true });

  if (error) throw new Error(`Falha ao buscar leads: ${error.message}`);

  const leads = (data ?? []) as LeadDoBanco[];
  resultado.candidatos = leads.length;
  if (leads.length === 0) return resultado;

  const teto = tetoDiario();
  const prazo = Date.now() + ORCAMENTO_DE_TEMPO_MS;

  for (const [indice, lead] of leads.entries()) {
    if (!simular && Date.now() > prazo) {
      // O que sobrou continua elegível amanhã, dentro da mesma janela.
      resultado.restantes = leads.length - indice;
      console.warn(
        `[leads] tempo esgotado na retomada; ${resultado.restantes} ficaram para a próxima rodada.`,
      );
      break;
    }

    const destino = normalizarDestino(lead.telefone ?? "");
    if (destino.length < 12) continue;

    if (await jaRespondeu(destino, lead.avisado_em)) {
      resultado.disparos.push({
        lead: lead.id,
        enviado: false,
        motivo: "já respondeu",
        texto: "",
      });
      continue;
    }

    const texto = mensagemLeadRetomada(comoLead(lead, null));

    if (simular) {
      resultado.disparos.push({
        lead: lead.id,
        enviado: false,
        motivo: "simulação",
        texto,
      });
      continue;
    }

    if ((await disparosHoje(hoje)) >= teto) {
      resultado.disparos.push({
        lead: lead.id,
        enviado: false,
        motivo: "teto diário",
        texto,
      });
      resultado.restantes = leads.length - indice;
      break;
    }

    const registro = await reivindicar("LEAD_RETOMADA", lead.id);
    if (!registro) {
      resultado.disparos.push({
        lead: lead.id,
        enviado: false,
        motivo: "já enviado",
        texto,
      });
      continue;
    }

    try {
      await enviarTexto(destino, texto);
      await registrarResultado(registro, true);
      await supabase
        .from("orcamentos")
        .update({ retomado_em: new Date().toISOString() })
        .eq("id", lead.id);
      resultado.disparos.push({ lead: lead.id, enviado: true, texto });
    } catch (e) {
      const motivo = e instanceof Error ? e.message : "erro desconhecido";
      console.error("[leads] falha na retomada:", motivo);
      await registrarResultado(registro, false, motivo);
      resultado.disparos.push({ lead: lead.id, enviado: false, motivo, texto });
    }
  }

  return resultado;
}

/**
 * A pessoa respondeu depois do nosso disparo?
 *
 * O workflow do n8n regrava `sessoes.updated_at` a cada turno, e só é
 * acionado por mensagem que ENTRA (o nó `Filtrar Mensagem` descarta
 * `fromMe`). Como o site gravou ali exatamente o instante do disparo,
 * qualquer valor mais novo significa que a pessoa escreveu.
 */
async function jaRespondeu(
  telefone: string,
  avisadoEm: string | null,
): Promise<boolean> {
  if (!avisadoEm) return false;

  const { data, error } = await getSupabase()
    .from("sessoes")
    .select("updated_at")
    .eq("telefone", telefone)
    .maybeSingle();

  // Sem saber, o mais seguro é NÃO mandar: uma retomada indevida em cima
  // de quem já está conversando é pior do que uma retomada a menos.
  if (error) {
    console.error("[leads] falha ao ler a sessão:", error.message);
    return true;
  }

  const atualizado = (data as { updated_at: string | null } | null)?.updated_at;
  if (!atualizado) return false;

  return new Date(atualizado).getTime() > new Date(avisadoEm).getTime();
}
