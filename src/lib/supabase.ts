import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase para uso EXCLUSIVO no servidor.
 *
 * Usa a service role key, que ignora as políticas de RLS — por isso ela
 * nunca pode ir para o navegador. Só importe este arquivo em route
 * handlers, server actions ou server components.
 *
 * O projeto é o mesmo que a Júlia (agente do WhatsApp) já usa no n8n,
 * então as reservas criadas por ela aparecem no painel administrativo
 * automaticamente.
 */

let cliente: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cliente) return cliente;

  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !chave) {
    throw new Error(
      "Supabase não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no arquivo .env.local (veja .env.example).",
    );
  }

  cliente = createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cliente;
}

/** Permite ao site funcionar (e redirecionar ao WhatsApp) mesmo sem banco. */
export function supabaseConfigurado(): boolean {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export type StatusOrcamento = "novo" | "em_contato" | "fechado" | "perdido";

/**
 * Um lead. Nasce no momento em que a pessoa preenche nome e WhatsApp na
 * calculadora — antes de ver o valor, e antes de decidir se conversa com
 * a gente. Por isso a tabela é o CRM do sítio, e não só a caixa de
 * pedidos enviados.
 */
export type Orcamento = {
  id: string;
  criado_em: string;
  nome: string;
  telefone: string;
  email: string | null;
  /** Nulo quando a pessoa ainda não escolheu a data (`tem_data` falso). */
  checkin: string | null;
  checkout: string | null;
  pessoas: number;
  ocasiao: string | null;
  hidromassagem: boolean;
  observacoes: string | null;
  valor_calculado: number | null;
  tipo_calculo: string | null;
  status: StatusOrcamento;
  origem: string;
  tem_data: boolean | null;
  /** Época pretendida em texto livre, de quem ainda não tem data. */
  periodo_desejado: string | null;
  // ---- CRM (migração 004) ----
  anotacoes: string | null;
  contatado_em: string | null;
  /** Preenchido quando o lead clicou para falar no WhatsApp. */
  abriu_whatsapp_em: string | null;
  // ---- Disparo automático de WhatsApp (migração 005) ----
  /** Quando o SITE mandou a primeira mensagem para este lead. */
  avisado_em: string | null;
  /** Quando saiu a retomada do dia seguinte. Uma por lead, no máximo. */
  retomado_em: string | null;
};

/**
 * Espelha a tabela `reservas`, que a Júlia já alimenta pelo n8n.
 * Os nomes das colunas vêm do nó "Criar Reserva1" do workflow — não
 * renomear sem mexer lá também.
 */
/** PENDENTE_CONTRATO e CONFIRMADA ocupam a data; CANCELADA libera. */
export type StatusReserva = "PENDENTE_CONTRATO" | "CONFIRMADA" | "CANCELADA";

export type Reserva = {
  /** uuid, não bigint. */
  id: string;
  criado_em: string | null;
  telefone: string | null;
  nome_cliente: string | null;
  tipo_evento: string | null;
  qtd_pessoas: number | null;
  data_checkin: string | null;
  data_checkout: string | null;
  /** Gravado como texto pelo workflow do n8n. Converter antes de somar. */
  valor_final: string | number | null;
  tipo_reserva: string | null;
  status: StatusReserva | null;
  origem: string | null;
};

export type DatasBloqueadas = {
  id: string;
  criado_em: string;
  data_inicio: string;
  data_fim: string;
  motivo: string | null;
};
