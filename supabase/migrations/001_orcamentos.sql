-- ============================================================
--  Sítio Estâncias Feliz — tabelas usadas pelo site
--
--  Rode este arquivo no SQL Editor do Supabase, no MESMO projeto
--  que o n8n já usa (jmundnnugyqqwahugjxt). Assim as reservas criadas
--  pela Júlia no WhatsApp e os orçamentos vindos do site convivem
--  no mesmo lugar, e o painel admin enxerga os dois.
--
--  É seguro rodar mais de uma vez.
-- ============================================================

-- ---------- Orçamentos vindos do site ----------
create table if not exists public.orcamentos (
  id                uuid primary key default gen_random_uuid(),
  criado_em         timestamptz not null default now(),
  nome              text        not null,
  telefone          text        not null,
  email             text,
  checkin           date        not null,
  checkout          date        not null,
  pessoas           integer     not null check (pessoas > 0),
  ocasiao           text,
  hidromassagem     boolean     not null default false,
  observacoes       text,
  valor_calculado   numeric(10,2) not null,
  tipo_calculo      text,
  status            text        not null default 'novo',
  origem            text        not null default 'site',
  constraint orcamentos_status_valido
    check (status in ('novo','em_contato','fechado','perdido')),
  constraint orcamentos_datas_coerentes
    check (checkout > checkin)
);

comment on table public.orcamentos is
  'Pedidos de orçamento feitos pela calculadora do site.';

create index if not exists orcamentos_criado_em_idx
  on public.orcamentos (criado_em desc);
create index if not exists orcamentos_status_idx
  on public.orcamentos (status);
create index if not exists orcamentos_checkin_idx
  on public.orcamentos (checkin);

-- ---------- Datas bloqueadas manualmente pelo admin ----------
-- Serve para manutenção, uso da família, ou reserva fechada por fora.
create table if not exists public.datas_bloqueadas (
  id          uuid primary key default gen_random_uuid(),
  criado_em   timestamptz not null default now(),
  data_inicio date not null,
  data_fim    date not null,
  motivo      text,
  constraint datas_bloqueadas_coerentes check (data_fim >= data_inicio)
);

comment on table public.datas_bloqueadas is
  'Períodos indisponíveis marcados à mão no painel administrativo.';

create index if not exists datas_bloqueadas_periodo_idx
  on public.datas_bloqueadas (data_inicio, data_fim);

-- ---------- Segurança ----------
-- RLS ligado e SEM políticas de acesso público: só a service role key
-- (usada apenas no servidor do site) consegue ler e gravar.
alter table public.orcamentos       enable row level security;
alter table public.datas_bloqueadas enable row level security;

-- ---------- Migração pendente do agente do WhatsApp ----------
-- O workflow "Atendimento Sítio v3" espera estas colunas em `sessoes`.
-- Se elas não existirem, o nó "Upsert Sessao1" falha e a Júlia perde
-- o contexto da conversa.
alter table if exists public.sessoes
  add column if not exists msgs_pos_encaminhamento integer default 0;
alter table if exists public.sessoes
  add column if not exists historico_resumido text default '';
alter table if exists public.sessoes
  add column if not exists updated_at timestamptz default now();
