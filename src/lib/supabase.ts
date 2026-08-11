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

export type Orcamento = {
  id: string;
  criado_em: string;
  nome: string;
  telefone: string;
  email: string | null;
  checkin: string;
  checkout: string;
  pessoas: number;
  ocasiao: string | null;
  hidromassagem: boolean;
  observacoes: string | null;
  valor_calculado: number;
  tipo_calculo: string | null;
  status: "novo" | "em_contato" | "fechado" | "perdido";
  origem: string;
};

/**
 * Espelha a tabela `reservas`, que a Júlia já alimenta pelo n8n.
 * Os nomes das colunas vêm do nó "Criar Reserva1" do workflow — não
 * renomear sem mexer lá também.
 */
export type Reserva = {
  id: string | number;
  created_at: string | null;
  telefone: string | null;
  nome_cliente: string | null;
  tipo_evento: string | null;
  qtd_pessoas: number | null;
  data_checkin: string | null;
  data_checkout: string | null;
  valor_final: number | null;
  tipo_reserva: string | null;
  /** Coluna acrescentada pelo site: reserva cancelada não ocupa a data. */
  status: "confirmada" | "pre_reserva" | "cancelada" | null;
  origem: string | null;
};

export type DatasBloqueadas = {
  id: string;
  criado_em: string;
  data_inicio: string;
  data_fim: string;
  motivo: string | null;
};
