-- ============================================================
--  Sítio Estâncias Feliz — agenda como fonte única da verdade
--
--  Antes, a disponibilidade vivia no Google Calendar, que desconectava
--  toda hora e derrubava o atendimento. A partir daqui a agenda mora
--  aqui no banco, e tanto o site quanto a Júlia consultam o mesmo lugar.
--
--  Rode no SQL Editor do Supabase, depois do 001. É seguro repetir.
-- ============================================================

-- ---------- Status das reservas ----------
-- O workflow do n8n cria reservas sem status. Sem essa coluna não há
-- como cancelar uma reserva: a data ficaria bloqueada para sempre.
alter table if exists public.reservas
  add column if not exists status text default 'confirmada';

alter table if exists public.reservas
  add column if not exists origem text default 'whatsapp';

-- Reservas antigas, criadas antes desta migração, entram como confirmadas.
update public.reservas set status = 'confirmada' where status is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reservas_status_valido'
  ) then
    alter table public.reservas
      add constraint reservas_status_valido
      check (status in ('confirmada', 'pre_reserva', 'cancelada'));
  end if;
end $$;

-- ---------- Índices de agenda ----------
-- Toda consulta de disponibilidade filtra por período e por status.
create index if not exists reservas_periodo_idx
  on public.reservas (data_checkin, data_checkout);
create index if not exists reservas_status_idx
  on public.reservas (status);

-- ---------- Ligação entre orçamento e reserva ----------
-- Quando um orçamento do site vira reserva, guardamos de onde veio.
alter table if exists public.orcamentos
  add column if not exists reserva_id bigint;

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
