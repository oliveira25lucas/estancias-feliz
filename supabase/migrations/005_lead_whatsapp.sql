-- ============================================================
--  Sítio Estâncias Feliz — disparo de WhatsApp para o lead
--
--  Até aqui, todo aviso automático ia para gente de casa: o grupo dos
--  donos e a Maurizia. Agora o site também escreve para o CLIENTE assim
--  que ele vira lead, e a Júlia recebe o contexto do orçamento para não
--  começar a conversa perguntando o que a pessoa acabou de informar.
--
--  Duas coisas precisam de espaço no banco:
--
--    notificacoes  ganha os dois tipos novos e um vínculo com o
--                  orçamento. `reserva_id` não serve: lead não é reserva.
--    orcamentos    guarda quando o site falou com a pessoa, o que
--                  alimenta a fila de retomada do dia seguinte e aparece
--                  na aba de CRM.
--
--  Rode no SQL Editor do Supabase, depois do 004. É seguro repetir.
-- ============================================================

-- ---------- Tipos novos de notificação ----------
alter table public.notificacoes
  drop constraint if exists notificacoes_tipo_valido;

alter table public.notificacoes
  add constraint notificacoes_tipo_valido
  check (tipo in (
    'NOVA',
    'CANCELADA',
    'LEMBRETE_7D',
    'LEAD_NOVO',
    'LEAD_RETOMADA'
  ));

alter table public.notificacoes
  add column if not exists orcamento_id uuid;

comment on column public.notificacoes.orcamento_id is
  'Lead que originou o disparo. Preenchido só nos tipos LEAD_*.';

create index if not exists notificacoes_orcamento_idx
  on public.notificacoes (orcamento_id);

/*
  A trava contra duplicata continua sendo a coluna `chave`, que já é
  unique desde o 003. Para os disparos de lead ela é 'LEAD_NOVO:<id>' e
  'LEAD_RETOMADA:<id>' — uma mensagem de cada tipo por lead, para sempre,
  mesmo que a rota seja chamada duas vezes ou o cron rode em duplicidade.
*/

-- ---------- Quando o site falou com a pessoa ----------
alter table public.orcamentos
  add column if not exists avisado_em timestamptz;
alter table public.orcamentos
  add column if not exists retomado_em timestamptz;

comment on column public.orcamentos.avisado_em is
  'Quando o site mandou a primeira mensagem de WhatsApp para este lead.';
comment on column public.orcamentos.retomado_em is
  'Quando saiu a retomada do dia seguinte. Uma por lead, no máximo.';

-- A fila de retomada busca por avisado_em dentro da janela de ontem.
create index if not exists orcamentos_avisado_em_idx
  on public.orcamentos (avisado_em);

-- ---------- Segurança ----------
-- `orcamentos` e `notificacoes` já têm RLS ligado e nenhuma política
-- pública desde o 001 e o 003. As colunas novas herdam isso.
