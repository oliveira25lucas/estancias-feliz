-- ============================================================
--  Sítio Estâncias Feliz — agenda como fonte única da verdade
--
--  Antes, a disponibilidade vivia no Google Calendar, que desconectava
--  toda hora e derrubava o atendimento. A partir daqui a agenda mora
--  aqui no banco, e tanto o site quanto a Júlia consultam o mesmo lugar.
--
--  Escrito contra o schema REAL do projeto jmundnnugyqqwahugjxt:
--  `reservas` já existe, com id uuid, valor_final text, criado_em, e
--  status default 'PENDENTE_CONTRATO' em todas as 23 linhas atuais.
--  Por isso o vocabulário de status é estendido, não substituído.
--
--  Rode no SQL Editor do Supabase, depois do 001. É seguro repetir.
-- ============================================================

-- ---------- Status das reservas ----------
-- A coluna já existe. O que falta é poder CANCELAR: sem um status de
-- cancelamento, uma reserva desfeita seguraria a data para sempre.
alter table if exists public.reservas
  alter column status set default 'PENDENTE_CONTRATO';

update public.reservas set status = 'PENDENTE_CONTRATO' where status is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reservas_status_valido'
  ) then
    alter table public.reservas
      add constraint reservas_status_valido
      check (status in ('PENDENTE_CONTRATO', 'CONFIRMADA', 'CANCELADA'));
  end if;
end $$;

comment on column public.reservas.status is
  'PENDENTE_CONTRATO e CONFIRMADA ocupam a data. CANCELADA libera.';

-- De onde veio a reserva: whatsapp (Júlia) ou admin (painel do site).
alter table if exists public.reservas
  add column if not exists origem text default 'whatsapp';

-- ---------- Índices de agenda ----------
-- Toda consulta de disponibilidade filtra por período e por status.
create index if not exists reservas_periodo_idx
  on public.reservas (data_checkin, data_checkout);
create index if not exists reservas_status_idx
  on public.reservas (status);

-- ---------- Ligação entre orçamento e reserva ----------
-- reservas.id é uuid, não bigint.
alter table if exists public.orcamentos
  add column if not exists reserva_id uuid;

comment on column public.orcamentos.reserva_id is
  'Reserva gerada a partir deste orçamento, quando o negócio fecha.';

-- ---------- Orçamento de quem ainda não escolheu a data ----------
-- Boa parte dos clientes pergunta preço antes de decidir o dia. Perder
-- esse contato só porque não há data seria jogar lead fora.
alter table if exists public.orcamentos
  add column if not exists tem_data boolean not null default true;
alter table if exists public.orcamentos
  add column if not exists periodo_desejado text;

comment on column public.orcamentos.periodo_desejado is
  'Época pretendida em texto livre, quando o cliente ainda não tem data fechada.';

-- Sem data não há check-in nem valor calculado.
alter table if exists public.orcamentos alter column checkin  drop not null;
alter table if exists public.orcamentos alter column checkout drop not null;
alter table if exists public.orcamentos alter column valor_calculado drop not null;

-- A checagem de datas só vale quando as duas existem.
alter table if exists public.orcamentos
  drop constraint if exists orcamentos_datas_coerentes;
alter table if exists public.orcamentos
  add constraint orcamentos_datas_coerentes
  check (checkin is null or checkout is null or checkout > checkin);

-- ---------- Segurança ----------
-- Só a service role key (usada apenas no servidor do site e pelo n8n)
-- enxerga estas tabelas.
alter table if exists public.reservas enable row level security;

-- ============================================================
--  Limpeza opcional: reservas duplicadas
--
--  O workflow v3 grava a reserva sem checar se já existe uma igual.
--  Hoje há 4 linhas idênticas da mesma cliente (Sula, 01 a 04/07/2027).
--  Rode o SELECT primeiro para conferir, e só então o DELETE.
-- ============================================================

-- Conferir o que seria apagado:
--
--   select telefone, nome_cliente, data_checkin, data_checkout, count(*)
--   from public.reservas
--   group by 1,2,3,4
--   having count(*) > 1;
--
-- Apagar, mantendo a mais antiga de cada grupo:
--
--   delete from public.reservas r using (
--     select id, row_number() over (
--       partition by telefone, data_checkin, data_checkout
--       order by criado_em
--     ) as n
--     from public.reservas
--   ) dup
--   where r.id = dup.id and dup.n > 1;
