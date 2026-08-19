-- ============================================================
--  Sítio Estâncias Feliz — sincronia de calendário com a Airbnb
--
--  A partir daqui a agenda tem DUAS bocas de entrada automática: a
--  Júlia (WhatsApp) e a Airbnb. O que muda no banco é pouco, mas é o
--  que impede o desastre óbvio desta integração.
--
--  O IMPORTADOR RODA DE 15 EM 15 MINUTOS E APAGA COISA. Ele precisa
--  saber, sem chance de dúvida, quais linhas são dele. Duas colunas
--  dão isso:
--
--    origem       de quem é a linha. Já existia em `reservas` (padrão
--                 'whatsapp'); aqui ganha irmã em `datas_bloqueadas`,
--                 onde o padrão é 'admin' porque toda linha existente
--                 foi o Lucas que criou à mão no painel.
--    uid_externo  o UID do VEVENT no calendário da Airbnb. É a
--                 identidade da reserva do lado de lá, e é por ele que
--                 o importador reconhece o que já importou em vez de
--                 duplicar a cada passada.
--
--  A regra que o código honra, e que estas colunas tornam verificável:
--  o importador só toca em linha com origem = 'airbnb'. Bloqueio de
--  manutenção e reserva fechada por contrato são invioláveis.
--
--  Rode no SQL Editor do Supabase, depois do 005. É seguro repetir.
-- ============================================================

-- ---------- Identidade da reserva no calendário de fora ----------
alter table if exists public.reservas
  add column if not exists uid_externo text;

comment on column public.reservas.uid_externo is
  'UID do VEVENT na Airbnb. NULL em tudo que nasceu aqui dentro.';

/*
  Índice único PARCIAL, e não constraint unique.

  A tabela inteira tem `uid_externo` nulo hoje, e vai continuar tendo
  nulo em toda reserva da Júlia e do painel para sempre. Um índice
  parcial indexa só as linhas que a Airbnb criou — que são poucas — e
  ainda assim garante o que interessa: o mesmo VEVENT não entra duas
  vezes, mesmo que duas execuções do importador se cruzem.

  É esta unicidade que o importador usa como trava de concorrência,
  do mesmo jeito que `notificacoes.chave` trava o envio duplicado.
*/
create unique index if not exists reservas_uid_externo_idx
  on public.reservas (uid_externo)
  where uid_externo is not null;

create index if not exists reservas_origem_idx
  on public.reservas (origem);

-- ---------- Onde guardar o que a Airbnb deixa saber ----------
/*
  O calendário da Airbnb NÃO traz nome nem telefone do hóspede — eles
  removeram isso em dezembro de 2019, por privacidade. O que sobra no
  evento é o link da reserva e os 4 últimos dígitos do telefone.

  Parece pouco, e é o que existe: com o link, o Lucas abre a reserva na
  Airbnb e vê quem é. Sem uma coluna para guardá-lo, esse link se
  perderia e a reserva importada ficaria anônima para sempre no painel.
*/
alter table if exists public.reservas
  add column if not exists observacoes text;

comment on column public.reservas.observacoes is
  'Texto livre. Nas reservas da Airbnb, o link da reserva e o final do telefone.';

-- ---------- O mesmo para os bloqueios ----------
-- A Airbnb exporta dois tipos de evento: reserva de hóspede e bloqueio
-- que o anfitrião pôs no painel dela. O primeiro vira `reservas` (tem
-- gente chegando, a Maurizia precisa saber); o segundo vira bloqueio,
-- porque não há hóspede nenhum.
alter table if exists public.datas_bloqueadas
  add column if not exists origem text not null default 'admin';

comment on column public.datas_bloqueadas.origem is
  'admin (painel, feito à mão) ou airbnb (importado). O importador só apaga airbnb.';

alter table if exists public.datas_bloqueadas
  add column if not exists uid_externo text;

comment on column public.datas_bloqueadas.uid_externo is
  'UID do VEVENT na Airbnb. NULL em bloqueio criado no painel.';

create unique index if not exists datas_bloqueadas_uid_externo_idx
  on public.datas_bloqueadas (uid_externo)
  where uid_externo is not null;

create index if not exists datas_bloqueadas_origem_idx
  on public.datas_bloqueadas (origem);

-- ---------- Segurança ----------
-- As duas tabelas já têm RLS ligado e nenhuma política pública desde o
-- 001 e o 002. As colunas novas herdam isso. O calendário que a Airbnb
-- lê NÃO vem daqui direto: passa por /api/calendario.ics, que publica
-- só datas.
