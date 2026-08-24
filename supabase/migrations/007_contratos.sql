-- ============================================================
--  Sítio Estâncias Feliz — contratos gerados pelo painel
--
--  Antes: um .docx era duplicado a cada aluguel e editado à mão. Nome,
--  CPF, datas, valor, parcelas e horários mudavam em nove lugares
--  diferentes do documento, e o que passava batido passava para o
--  cliente — o status PENDENTE_CONTRATO existia desde o começo, mas o
--  documento não.
--
--  Duas tabelas, e a diferença entre elas é a coisa toda:
--
--    contrato_clausulas  o MODELO, editável. Mexer aqui muda os
--                        próximos contratos.
--    contratos           um contrato emitido, que guarda uma CÓPIA das
--                        cláusulas do modelo no momento em que nasceu.
--                        Mexer no modelo depois NÃO altera este.
--
--  Documento assinado que muda de texto porque alguém editou o modelo
--  três meses depois não é documento, é armadilha.
--
--  Rode no SQL Editor do Supabase, depois do 006. É seguro repetir.
-- ============================================================

-- ---------- O contrato-base ----------
-- Nasce VAZIA de propósito. O texto das 30 cláusulas mora em
-- `src/lib/contrato.ts` (CLAUSULAS_BASE), que é o que o `npm test`
-- alcança; enquanto ninguém editar nada pelo painel, é de lá que o
-- contrato sai. A primeira edição grava o conjunto inteiro aqui.
-- Duas cópias do mesmo texto — uma no código, outra semeada no SQL —
-- divergiriam na primeira correção de vírgula.
create table if not exists public.contrato_clausulas (
  id uuid primary key default gen_random_uuid(),

  -- NUMERIC, não INT: reordenar e inserir entre a 5 e a 6 pede 5.5.
  -- A numeração que sai no papel é recontada do 1 a cada contrato — esta
  -- coluna é só a ordem, nunca o número da cláusula.
  ordem numeric not null,

  -- Texto com {{variaveis}} ainda dentro. A substituição acontece na
  -- leitura, não aqui.
  texto text not null,

  -- Quando a cláusula entra: null/'' = sempre. Ver CONDICOES em
  -- src/lib/contrato.ts. Condição desconhecida INCLUI a cláusula —
  -- cláusula a mais se discute, cláusula que sumiu sozinha ninguém vê.
  condicao text,

  -- Desligada continua guardada. Apagar perde o texto de uma cláusula
  -- que talvez volte no mês que vem.
  ativa boolean not null default true,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists contrato_clausulas_ordem_idx
  on public.contrato_clausulas (ordem);

comment on table public.contrato_clausulas is
  'O contrato-base. Vazia = usa CLAUSULAS_BASE de src/lib/contrato.ts.';

-- ---------- Os contratos emitidos ----------
create table if not exists public.contratos (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  -- De qual reserva este contrato saiu. Fica nulo quando o contrato é
  -- feito antes de a reserva existir, o que acontece.
  reserva_id uuid,

  -- ---- quem aluga ----
  locatario_nome text not null,
  locatario_cpf text,
  locatario_endereco text,
  locatario_telefone text,

  -- ---- a estadia ----
  data_checkin date not null,
  data_checkout date not null,

  -- HORÁRIO É POR CONTRATO, e é por isso que são colunas e não
  -- constantes. A tabela do site diz 8h/16h, mas o combinado muda: nos
  -- dois últimos contratos a entrada foi 05:00 e 06:00. É a mesma razão
  -- pela qual o aviso automático de WhatsApp deixou de citar horário.
  hora_checkin text not null default '08:00',
  hora_checkout text not null default '16:00',

  -- Dois tetos: quanta gente fica (quem dorme) e quanta gente vem no
  -- horário do evento. Iguais, ou evento zerado, = não há evento, e a
  -- cláusula sai na versão de um número só.
  pessoas_estadia integer not null default 30,
  pessoas_evento integer not null default 0,

  -- ---- dinheiro ----
  valor_total numeric not null,
  -- [{"valor": 780, "data": "2026-08-25"}, ...] — em ordem de vencimento.
  parcelas jsonb not null default '[]'::jsonb,
  pix_chave text,
  pix_titular text,

  caucao numeric not null default 500,
  hidromassagem boolean not null default false,
  hidromassagem_diaria numeric not null default 150,
  valor_pessoa_excedente numeric not null default 150,
  valor_diaria_excedente numeric not null default 1500,
  multa_atraso_checkin numeric not null default 100,
  multa_limpeza numeric not null default 150,

  -- ---- assinatura ----
  cidade_foro text not null default 'Belo Horizonte',
  data_assinatura date,

  -- ---- o congelamento ----
  -- Cópia do modelo no instante em que o contrato nasceu:
  -- [{"ordem":1,"texto":"...","condicao":null,"ativa":true}, ...]
  -- Com as {{variaveis}} AINDA DENTRO: congela-se o modelo, não os
  -- dados, senão corrigir um CPF errado depois seria impossível.
  clausulas jsonb not null default '[]'::jsonb,

  status text not null default 'RASCUNHO'
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contratos_status_valido'
  ) then
    alter table public.contratos
      add constraint contratos_status_valido
      check (status in ('RASCUNHO', 'ENVIADO', 'ASSINADO'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contratos_datas_coerentes'
  ) then
    alter table public.contratos
      add constraint contratos_datas_coerentes
      check (data_checkout > data_checkin);
  end if;
end $$;

create index if not exists contratos_reserva_idx
  on public.contratos (reserva_id);
create index if not exists contratos_checkin_idx
  on public.contratos (data_checkin);

comment on column public.contratos.clausulas is
  'Cópia congelada do modelo, com {{variaveis}} dentro. Editar o modelo NÃO altera contrato já emitido.';
comment on column public.contratos.hora_checkin is
  'Por contrato, não fixo: os últimos foram 05:00 e 06:00, não 8h.';
comment on column public.contratos.status is
  'RASCUNHO ainda não foi para o cliente. ENVIADO foi. ASSINADO voltou assinado.';

-- ---------- Segurança ----------
-- Contrato tem CPF, endereço e telefone de gente. Só a service role key
-- (servidor do site) enxerga — nunca o navegador.
alter table if exists public.contratos enable row level security;
alter table if exists public.contrato_clausulas enable row level security;
