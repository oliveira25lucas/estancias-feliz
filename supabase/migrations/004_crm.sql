-- ============================================================
--  Sítio Estâncias Feliz — CRM de leads
--
--  A calculadora passou a captar o contato ANTES de mostrar o valor:
--  a pessoa preenche nome e WhatsApp, o pedido é gravado, e só então o
--  orçamento aparece. Isso muda a natureza da tabela `orcamentos` — ela
--  deixa de ser "pedidos enviados" e vira a lista de leads do sítio.
--
--  Três colunas dão conta disso:
--
--    anotacoes         o que foi conversado. Sem isso o acompanhamento
--                      vive no WhatsApp e some.
--    contatado_em      quando alguém falou com o lead pela última vez.
--                      É o que separa "novo de ontem" de "esquecido há
--                      duas semanas" na aba de CRM.
--    abriu_whatsapp_em quando a pessoa clicou para conversar. Sem esta
--                      coluna não dá para distinguir quem só espiou o
--                      preço de quem de fato veio falar — e são leads
--                      de temperatura muito diferente.
--
--  Rode no SQL Editor do Supabase, depois do 003. É seguro repetir.
-- ============================================================

alter table if exists public.orcamentos
  add column if not exists anotacoes text;
alter table if exists public.orcamentos
  add column if not exists contatado_em timestamptz;
alter table if exists public.orcamentos
  add column if not exists abriu_whatsapp_em timestamptz;

comment on column public.orcamentos.anotacoes is
  'Bloco de notas do lead, escrito no painel. Nunca vai para o cliente.';
comment on column public.orcamentos.contatado_em is
  'Último contato feito com este lead. Alimenta a fila de retorno do CRM.';
comment on column public.orcamentos.abriu_whatsapp_em is
  'Quando o lead clicou para falar no WhatsApp depois de ver o valor.';

-- A fila de "esquecidos" ordena por esta coluna, com os nulos na frente.
create index if not exists orcamentos_contatado_em_idx
  on public.orcamentos (contatado_em nulls first);

-- ---------- Segurança ----------
-- A tabela já tem RLS ligado desde o 001 e nenhuma política pública:
-- só a service role key (servidor do site) lê e grava. As colunas novas
-- herdam isso — anotação de CRM não é dado para o navegador.
