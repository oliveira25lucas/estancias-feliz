-- ============================================================
--  Sítio Estâncias Feliz — registro dos avisos automáticos
--
--  Duas automações passam por aqui:
--    NOVA / CANCELADA  — disparadas pelo painel quando uma reserva
--                        entra ou sai de CONFIRMADA.
--    LEMBRETE_7D       — disparado pelo cron diário, 7 dias antes da
--                        entrada.
--
--  Por que gravar: a Vercel não promete horário exato de cron e pode
--  invocar a rota mais de uma vez. Sem trava, a Maurizia receberia o
--  mesmo lembrete duas vezes. A coluna `chave` é a trava.
--
--  Rode no SQL Editor do Supabase, depois do 002. É seguro repetir.
-- ============================================================

create table if not exists public.notificacoes (
  id         uuid primary key default gen_random_uuid(),
  criado_em  timestamptz not null default now(),
  reserva_id uuid,
  tipo       text not null,
  /**
   * Trava de duplicata. NULL de propósito nos avisos do painel: lá o
   * gatilho é um clique humano, e uma reserva cancelada e reconfirmada
   * precisa avisar de novo. O Postgres permite vários NULL num unique,
   * então só o cron trava.
   */
  chave      text unique,
  /** Quem recebeu de fato: 'grupo', 'faxineira', ou os dois. */
  destinos   text,
  enviado    boolean not null default false,
  erro       text,
  constraint notificacoes_tipo_valido
    check (tipo in ('NOVA', 'CANCELADA', 'LEMBRETE_7D'))
);

comment on table public.notificacoes is
  'Histórico dos avisos de WhatsApp e trava contra envio duplicado.';

comment on column public.notificacoes.chave is
  'LEMBRETE_7D:<reserva_id>:<data_checkin>. NULL nos avisos do painel.';

create index if not exists notificacoes_reserva_idx
  on public.notificacoes (reserva_id);
create index if not exists notificacoes_criado_em_idx
  on public.notificacoes (criado_em desc);

-- ---------- Segurança ----------
-- Só a service role key (servidor do site) enxerga. O histórico diz
-- quem alugou e quando — não é dado para o navegador.
alter table public.notificacoes enable row level security;
