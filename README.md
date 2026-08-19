# Sítio Estâncias Feliz

Site institucional, calculadora de orçamento e painel administrativo do
Sítio Estâncias Feliz — Rod. BH-Brumadinho (MG-040), Km 30, Sarzedo/MG.

Feito em Next.js 16 (App Router) + Tailwind CSS v4 + Supabase.

---

## O que o site faz

| Página | Rota | O que é |
|---|---|---|
| Início | `/` | Vitrine: estrutura, galeria, preços, como chegar e dúvidas |
| Orçamento | `/orcamento` | Calendário com as datas ocupadas bloqueadas; o valor aparece depois do contato |
| Agenda | `/agenda` | Só datas livres e ocupadas, para mandar o link a quem pergunta. Sem link no site, `noindex` |
| Painel | `/admin` | Duas abas: agenda (reservas e bloqueios) e CRM de leads. Protegido por usuário e senha |

---

## O site é o cérebro do agente de WhatsApp

A atendente virtual (**Júlia**) roda em n8n e conversa pela Evolution API.
Ela **não calcula preço nem consulta agenda por conta própria**: chama
`/api/consultar` neste site e recebe os fatos prontos.

```
Cliente no WhatsApp
      ↓
Evolution API (api.estanciasfeliz.com.br, instância "sitio-atendimento")
      ↓ webhook
n8n (n8n.estanciasfeliz.com.br) — "Atendimento Sítio v4"
      ↓                                    ↓
   OpenAI  ←── fatos prontos ────  POST /api/consultar  (este site)
   (só redige)                            ↓
                                    pricing.ts + agenda.ts
                                          ↓
                                       Supabase
                                          ↑
                              Painel /admin (reservas e bloqueios)
```

Por que assim:

- **Uma regra, um lugar.** Preço mora só em `src/lib/pricing.ts`. Antes
  estava duplicado em nós de código do n8n e dentro dos prompts, e os dois
  canais divergiam.
- **A IA não inventa número.** O campo `fatos` da resposta traz o valor
  oficial e a disponibilidade; o prompt manda a Júlia escrever só em cima
  dele.
- **Adeus Google Calendar.** Ele vivia perdendo a autenticação e derrubava
  o atendimento. A agenda agora é o painel `/admin`, no mesmo banco.

### Trocar o workflow do n8n

O v4 está em `n8n/atendimento-sitio-v4.json` e já foi importado **inativo**.
Para ativar:

1. Publicar este site em `estanciasfeliz.com.br` (o v4 depende da API).
2. No n8n, definir a variável de ambiente `SITIO_API_TOKEN` com o mesmo
   valor de `API_TOKEN` na Vercel.
3. Apontar o webhook da Evolution para `/webhook/sitio-v4`:
   ```bash
   curl -X POST -H "apikey: $EVOLUTION_KEY" -H "Content-Type: application/json" \
     -d '{"webhook":{"enabled":true,"url":"https://n8n.estanciasfeliz.com.br/webhook/sitio-v4","events":["MESSAGES_UPSERT"]}}' \
     https://api.estanciasfeliz.com.br/webhook/set/sitio-atendimento
   ```
4. Desativar o v3, senão os dois respondem ao mesmo cliente.

---

## Calendário, captura de lead e CRM

Três peças que trabalham juntas e mudaram o caminho de quem pede orçamento.

### 1. A data ocupada já nasce bloqueada

Antes, a pessoa escolhia a data, esperava a consulta e só então descobria
que estava vendida. Agora `/orcamento` carrega a agenda inteira antes do
primeiro clique (`GET /api/agenda`, 18 meses, **só datas** — nem nome, nem
motivo, nem se é reserva ou manutenção) e o calendário simplesmente não
deixa clicar no que não dá.

O bloqueio vale para as **duas pontas**, e isso rende um caso que não é
óbvio: como a saída também ocupa, um dia livre espremido entre duas
reservas não aceita entrada nenhuma — a saída cairia em cima da reserva
seguinte. O calendário marca esse dia como indisponível e explica por quê,
em vez de aceitar o clique e deixar a pessoa num beco sem saída.

A regra mora em `src/lib/ocupacao.ts`, sem banco e travada por testes
(`podeSerEntrada`, `saidaMaxima`, `periodoLivre`). O desenho é só desenho.

**O calendário não é a última palavra.** Feriado é alugado em bloco
fechado, e o bloco pode ser maior do que as datas escolhidas — quem pede
sábado a domingo num feriadão leva de sexta a segunda. Esse pedaço a mais
ninguém clicou, então `/api/disponibilidade` continua conferindo o período
efetivamente cobrado, e `/api/orcamento` reconfere no envio.

### 2. O valor só aparece depois do contato

A pessoa preenche nome e WhatsApp, o pedido é gravado, e **aí** o
orçamento aparece. Quem chega até aqui vira lead mesmo que nunca clique
no WhatsApp.

```
escolhe a data ──► preenche contato ──► POST /api/orcamento ──► valor na tela
                                            (grava, devolve id)
mexeu nas datas depois? ──► PATCH /api/orcamento (mesmo id)
clicou em "Falar no WhatsApp"? ──► PATCH com abriu_whatsapp_em
```

O PATCH existe para o painel não encher de duplicata da mesma pessoa: sem
ele, cada ajuste de data viraria um lead novo e a equipe ligaria cobrando
a primeira data que ela tentou. Ele só alcança pedido `origem = 'site'` e
`status = 'novo'` — assim que alguém mexe no lead pelo painel, o registro
congela e nenhuma chamada de fora reescreve o que a equipe anotou.

**Falha nossa não prende o valor.** Se o banco cair, o orçamento aparece
do mesmo jeito, com um aviso honesto. É a mesma regra de sempre: o
contato não pode se perder, e o cliente não paga pelo nosso problema.

A tabela de preços de quem *ainda não tem data* continua aberta — ela já
está na home, e escondê-la só puniria quem está pesquisando.

### 3. A aba de CRM

`orcamentos` deixou de ser "pedidos enviados" e virou a lista de leads do
sítio. A migração `004` acrescenta o que faltava para trabalhar essa lista:

| Coluna | Para que serve |
| --- | --- |
| `anotacoes` | O que foi conversado. Sem isso o acompanhamento vive no WhatsApp e some |
| `contatado_em` | Separa "novo de ontem" de "esquecido há duas semanas" |
| `abriu_whatsapp_em` | Distingue quem só espiou o preço de quem veio falar — leads de temperatura bem diferente |

O painel ficou em duas abas: **Agenda** (o que vem pela frente) e
**Leads** (o que se trabalha um a um). Numa página só, a lista de leads
empurrava a agenda para longe, e o painel é usado muito no celular.

### A página `/agenda`

Mostra livre e ocupado, e nada mais — serve para mandar o link a quem
pergunta "que datas você tem?". Está fora do menu, fora do `sitemap.ts` e
com `noindex`: é página de link direto, não porta de entrada. Para abrir
ao Google, troque o `robots` em `src/app/agenda/page.tsx` e acrescente a
rota no `sitemap.ts`.

> Orçamento em aberto **não** ocupa data no site público. É lead, não é
> reserva — segurar data por causa de um pedido de preço afastaria quem
> estava pronto para fechar. No painel ele continua aparecendo pintado,
> porque ali a informação é útil.

---

## Avisos automáticos no WhatsApp

O site escreve sozinho para três destinos: o **grupo dos donos** ("Aluguel
Sítio Estâncias Feliz"), a **equipe do sítio** e — só com a chave ligada —
o **próprio cliente** que virou lead.

A equipe hoje são duas pessoas, e as duas recebem exatamente a mesma
mensagem, só com o nome trocado na saudação:

| Quem | Papel | Variável |
|---|---|---|
| Maurizia | limpeza | `FAXINEIRA_WHATSAPP` |
| Renato | piscina | `PISCINEIRO_WHATSAPP` |

| Quando | Quem recebe | O que chega |
|---|---|---|
| Reserva entra em `CONFIRMADA` | grupo + equipe | a agenda futura inteira, com a data que entrou em negrito e uma seta |
| Reserva sai de `CONFIRMADA` (cancelada ou excluída) | grupo + equipe | o período riscado e a agenda já sem ele |
| 7 dias antes da entrada | equipe + grupo | data, horários e quantas pessoas; o aviso ao grupo diz quem da equipe já foi avisado |
| Pessoa vira lead no site | **o cliente** | recapitulação do orçamento e "posso prosseguir?" — veja o aviso abaixo |
| Lead não respondeu | **o cliente** | uma única retomada, com saída explícita |

**Para acrescentar uma terceira pessoa** (jardineiro, caseiro) são quatro
lugares, e nenhum deles é o texto da mensagem: a lista `EQUIPE` em
`src/lib/whatsapp.ts`, o tipo `Destinatario` no mesmo arquivo (o `switch`
não compila sem a variável nova), a variável de ambiente aqui e na Vercel,
e a lista `SEM_IA` do nó `Filtrar Mensagem` no n8n.

A regra é uma frase: **avisa quem entra em `CONFIRMADA` e quem sai de
`CONFIRMADA`**. Reserva em `PENDENTE_CONTRATO` não incomoda ninguém —
mas aparece na lista marcada como *(aguardando contrato)*, porque a data
está segurada e os donos precisam ver isso.

```
Painel /admin  ──►  status muda  ──►  after()  ──►  Evolution API ──►  grupo + equipe
                                                        ▲
Cron da Vercel ──►  /api/cron/lembretes (D-7)  ─────────┘
```

Quatro arquivos mandam nisso:

| Arquivo | Papel |
| --- | --- |
| `src/lib/notificacoes.ts` | o texto das mensagens. Lógica pura, sem banco — os testes travam palavra por palavra |
| `src/lib/avisos.ts` | quando avisar a EQUIPE, quem recebe, e o registro do que já foi enviado |
| `src/lib/leads.ts` | quando escrever para o CLIENTE, e as travas que só existem aí |
| `src/lib/whatsapp.ts` | o envio pela Evolution API |

### ⚠️ Escrever para o cliente é diferente de escrever para a equipe

O grupo e a equipe são de casa. O lead não: ele nunca mandou mensagem
para o sítio, só digitou o número dele num formulário.

**A Evolution é WhatsApp Web automatizado, não a API oficial.** Volume
anormal de mensagem para quem nunca escreveu é o caminho mais curto para
o número ser banido — e é o mesmo número em que a Júlia atende todo
mundo. Perder ele derruba o atendimento inteiro.

O que joga a favor: a pessoa acabou de digitar o próprio número num
formulário que pergunta "para onde enviamos o seu valor?". A expectativa
de contato é legítima e a chance de denúncia é baixa. Mas não é zero, e
por isso `leads.ts` tem três travas que `avisos.ts` não tem:

| Trava | O que faz |
| --- | --- |
| `LEAD_WHATSAPP_ATIVO` | Sem ela valendo `1`, **nada** é enviado. Publicar o código não começa a disparar sozinho |
| `LEAD_WHATSAPP_TETO_DIARIO` | Teto de mensagens para lead por dia, somando primeiro contato e retomadas. Padrão 30 |
| `chave` em `notificacoes` | Uma mensagem de cada tipo por lead, para sempre — a mesma trava do lembrete de 7 dias |

A retomada carrega uma saída explícita ("é só me falar que eu não te
incomodo mais"). É educação, e é também o que segura o número: quem tem
como pedir para parar não denuncia.

**Para ligar:**

```bash
npx vercel env add LEAD_WHATSAPP_ATIVO production   # valor: 1
npx vercel deploy --prod --yes                      # variável nova só vale no deploy seguinte
```

Para desligar às pressas, troque o valor para `0` e publique de novo — ou
`npx vercel rollback`.

### A Júlia sabe do que se trata quando a pessoa responde

Não adianta mandar mensagem e, quando o cliente responder, a Júlia
perguntar a data e o número de pessoas que ele acabou de informar no
site. É a forma mais rápida de a pessoa perceber que está falando com um
robô.

Por isso o disparo faz duas coisas, nesta ordem:

```
lead criado ──► semeia sessoes[telefone]  ──► manda o WhatsApp
                 (contexto do orçamento)         │
                                                 ▼
                        cliente responde ──► n8n carrega a sessão ──► prompt da Júlia
```

`sessoes` é a mesma tabela que o workflow do n8n carrega pelo telefone e
injeta no prompt como "Conversa até agora". O site grava ali o período, o
número de pessoas, a ocasião, o valor que apareceu na tela, e uma
instrução direta: *não peça de novo o que ela já informou*.

O que vale saber:

- **O contexto é ACRESCENTADO, nunca substituído.** Cliente que já
  conversou com a Júlia antes não pode perder o histórico dele porque
  pediu um orçamento novo.
- **A mensagem do site não aciona a Júlia.** O nó `Filtrar Mensagem`
  descarta `key.fromMe`, então o número não responde a si mesmo.
- **`sessoes.updated_at` é o sinal de que a pessoa respondeu.** O n8n
  regrava essa coluna a cada turno, e só roda com mensagem que entra. O
  site grava ali o instante do disparo; qualquer valor mais novo no dia
  seguinte significa que houve conversa, e a retomada não sai.
- **O disparo sai dentro de `after()`**, depois da resposta: ninguém fica
  esperando quinze segundos de Evolution para ver o próprio orçamento.
- **A retomada tem orçamento de tempo.** O cron tem 60s e cada envio pode
  levar 15s. Passou de 40s, ela para e registra `restantes` — a janela
  olha uma semana para trás justamente para o que sobrou sair no dia
  seguinte. Nunca é descarte silencioso.

### Conferir a retomada sem mandar nada

```bash
curl -H "x-api-token: $API_TOKEN" \
  "https://www.estanciasfeliz.com.br/api/cron/lembretes?simular=1" | jq .leads
```

`?simular=1` monta as mensagens dos dois lados — lembrete e retomada — e
não envia nenhuma.

### Ligar

1. Rode `supabase/migrations/003_notificacoes.sql` no SQL Editor.
2. Pegue a apikey da Evolution no n8n (credencial *Header Auth account*,
   a que o nó "Enviar WhatsApp" usa) e ponha em `EVOLUTION_KEY`.
3. Descubra o JID do grupo — não é telefone, é um id que termina em
   `@g.us`:
   ```bash
   node scripts/listar-grupos.mjs
   ```
   Copie a linha `GRUPO_DONOS_JID=` do grupo certo.
4. Cadastre na Vercel: `EVOLUTION_KEY`, `GRUPO_DONOS_JID`,
   `FAXINEIRA_WHATSAPP`, `PISCINEIRO_WHATSAPP` e `CRON_SECRET`.
5. Importe o workflow v4 atualizado no n8n (o nó `Filtrar Mensagem` ganhou
   a lista `SEM_IA`).

**Sem `EVOLUTION_KEY` nada é enviado** e nada quebra: o site registra no
log que não avisou e segue funcionando. Vale para cada destino em separado
— se só o JID do grupo estiver faltando, a equipe recebe normalmente.

### Conferir antes de disparar de verdade

```bash
curl -H "x-api-token: $API_TOKEN" \
  "https://estanciasfeliz.com.br/api/cron/lembretes?previa=1"
```

devolve a lista da agenda do jeito que ela vai sair. E para ver a mensagem
completa de um lembrete sem mandar nada para ninguém:

```bash
curl -H "x-api-token: $API_TOKEN" \
  "https://estanciasfeliz.com.br/api/cron/lembretes?simular=1&hoje=2026-11-13"
```

`?simular=1` monta tudo e **não envia**. `?hoje=` só é aceito junto de
`simular=1`, para ninguém receber lembrete de data escolhida à mão.

### O que vale saber antes de mexer

- **A Júlia não responde para a equipe.** O grupo já era ignorado por ser
  `@g.us`; os números da Maurizia e do Renato estão na lista `SEM_IA` do nó
  `Filtrar Mensagem`. Sem isso, um "ok, combinado" viraria conversa de
  orçamento com a IA. Número novo na equipe **precisa** entrar lá também.
- **O nono dígito é uma armadilha, e ela já mordeu.** O JID brasileiro
  chega de dois jeitos, conforme o número foi registrado no WhatsApp: com
  o nono dígito (`5531975278287`) e sem ele (`553175278287`). O da Maurizia
  chega **sem**, então a lista `SEM_IA` comparando string crua nunca casou
  — em 13/08/2026 ela agradeceu o aviso e a Júlia ofereceu data para ela.
  O filtro agora compara por `chaveTelefone()`: DDI + DDD + os 8 últimos
  dígitos, iguais nos dois formatos. Os dois formatos convivem no banco
  (`sessoes`), então nunca compare número de telefone por igualdade.
- **Mas as respostas deles chegam em algum lugar.** Os avisos saem pela
  instância `sitio-atendimento`, o número do sítio. Com a IA calada, o que
  a equipe responder fica lá esperando alguém ler — vale abrir esse
  WhatsApp de vez em quando.
- **O cron da Vercel fala UTC.** `0 11 * * *` em `vercel.json` é 8h de
  Brasília. No plano Hobby a chamada acontece em algum momento dentro
  daquela hora, não no minuto exato.
- **Lembrete não sai duas vezes.** A tabela `notificacoes` guarda uma
  `chave` única por reserva e data de entrada, e ela é gravada *antes* do
  envio. Se o cron rodar duas vezes no mesmo dia, o segundo não manda nada.
- **O envio nunca derruba o painel.** Tudo sai dentro de `after()`, depois
  da resposta. Evolution fora do ar vira uma linha em `notificacoes.erro`,
  não um erro na tela.
- **A equipe nunca vê valor de aluguel.** Nem no aviso, nem no lembrete —
  os testes garantem.

### Regras de preço que valem conhecer

- **Reajuste anual de 10%** sobre a tabela de 2026, todo 1º de janeiro.
  A caução não reajusta — é depósito, não preço.
- **Feriados são calculados**, nunca digitados: as datas móveis saem do
  algoritmo da Páscoa. A tabela escrita à mão que existia antes errava o
  Carnaval de 2027 em quatro dias.
- **Bloco obrigatório por dia da semana.** Feriado na quinta fecha de
  quinta a domingo; na sexta ou no sábado, de sexta a domingo; na segunda,
  de sexta a segunda; na terça, de sábado a terça (sexta também vale).
  Na quarta não forma pacote. Carnaval é exceção: sexta à quarta de cinzas.
- **Feriados municipais** de BH, Sarzedo e Ibirité entram como pacote de
  R$ 3.600 (base 2026).

Os testes em `src/lib/pricing.test.ts` travam tudo isso.

---

## Sincronia de calendário com a Airbnb

Fechou data aqui, fecha na Airbnb. Reservou pela Airbnb, fecha aqui — e a
Júlia para de oferecer o fim de semana no WhatsApp.

```
   RESERVA NO SITE / PAINEL / JÚLIA          RESERVA NA AIRBNB
              ↓                                      ↓
         Supabase                            calendário .ics
              ↓                                      ↓
   GET /api/calendario.ics  ──── 3h ───►  Airbnb busca sozinha
                                                     ↓
   n8n do VPS, 15 em 15 min  ────────►  GET /api/sync/airbnb
              ↓
         Supabase  ──►  site, calculadora, Júlia, Maurizia
```

**Não é instantâneo, e não tem como ser.** A Airbnb atualiza calendário
importado de 3 em 3 horas — é o número oficial deles. Existe uma janela de
até algumas horas em que os dois lados podem vender a mesma data. É assim
para todo anfitrião que usa iCal; só a API oficial resolveria, e ela é
fechada a parceiros convidados.

### Custa alguma coisa? Não

Nada além do que já se paga. iCal é um formato de arquivo, não um serviço:
não há assinatura nem cadastro. A rota roda na Vercel que já existe, e a
Airbnb bate nela **8 vezes por dia** — o plano Hobby inclui um milhão de
invocações por mês.

**A busca roda no n8n do VPS, não no cron da Vercel**, e isso é uma escolha
de custo: no Hobby o cron só roda uma vez por dia, e para rodar de 15 em 15
minutos seria preciso o Pro (US$ 20/mês). O n8n já está no ar e não tem
cota de execução por ser self-hosted.

### A pegadinha: o dia da saída

O sítio conta o **dia da saída como ocupado** (o hóspede sai às 16h e ainda
há limpeza). O iCalendar conta `DTEND` como **exclusivo**. As duas réguas
não batem, e errar um dia aqui é vender o mesmo fim de semana duas vezes.

| Sentido | Conversão |
|---|---|
| Site → Airbnb | reserva `01 a 03` vira `DTSTART=01, DTEND=04` — bloqueia 1, 2 e 3, libera o dia 4 |
| Airbnb → site | `DTSTART=10, DTEND=12` vira check-in 10, check-out **12** — o dia 12 é a limpeza |

A conversão mora em duas funções e em lugar nenhum mais:
`reservaParaEvento` e `eventoParaReserva`, em `src/lib/ical.ts`. Quem for
caçar um erro de um dia começa por elas — e por `ical.test.ts`, que trava
as duas.

### O que a Airbnb NÃO manda

**Nome e telefone do hóspede não existem no calendário.** A Airbnb removeu
esses campos em 1º de dezembro de 2019, por privacidade. Não é limitação
deste código e não há como contornar por iCal.

O que o evento traz, e que o importador guarda em `reservas.observacoes`:
o código da reserva (`HM...`), os **4 últimos dígitos** do telefone e o
link direto para a reserva no painel da Airbnb. A reserva aparece no
painel como "Hóspede Airbnb", com um link **"Ver o hóspede na Airbnb"** —
é o caminho de um clique para descobrir quem é.

Escreveu o nome à mão no lugar de "Hóspede Airbnb"? O importador **nunca
sobrescreve**: ele não tem nome nenhum para mandar, e apagar o que foi
descoberto à mão seria o pior resultado possível.

### As travas contra apagar a agenda

O importador roda sozinho, de 15 em 15 minutos, e cancela e apaga coisa.
O que o segura:

- **Só toca em linha com `origem = 'airbnb'`.** Reserva da Júlia, reserva
  de contrato e bloqueio de manutenção são invioláveis. O filtro se repete
  na consulta E na escrita.
- **Linha sem `uid_externo` é intocável**, mesmo marcada como airbnb.
- **Feed vazio não apaga nada.** Um calendário sem nenhum evento é
  indistinguível de um feed quebrado, então ele exige pelo menos um evento
  como prova de vida antes de cancelar qualquer coisa.
- **Resposta que não é calendário derruba a sincronia** em vez de ser lida
  como "não há reserva nenhuma".
- **Reserva que some é CANCELADA, não apagada** — o histórico fica.
- **O site é a fonte da verdade.** Reserva da Airbnb cujas datas o site
  já tem registradas por outro caminho é **ignorada**, não duplicada.
  Sem isso, as reservas que o Lucas digitou à mão no painel ganhariam
  uma segunda linha — e o lembrete de 7 dias, que é por linha, sairia
  **duas vezes para a Maurizia** sobre o mesmo hóspede. Ignorar se cura
  sozinho: apagada a linha manual, a passada seguinte cria a da Airbnb.
  Sobreposição *parcial* é caso diferente — é criada e vira alerta,
  porque aí é choque de datas de verdade.
- **O que veio da Airbnb não volta para a Airbnb**, senão o dia de limpeza
  empilharia um dia a cada volta até fechar o calendário inteiro.

### Ligar

1. Rodar `supabase/migrations/006_airbnb.sql` no SQL Editor.
2. Gerar o token e cadastrar na Vercel, **em Production**:
   ```bash
   openssl rand -hex 32
   ```
   `ICAL_TOKEN=<o valor>`. Sem ele a rota devolve 503.
3. Na Airbnb, em Calendário → Disponibilidade → **Conectar a outro site**:
   - **Exportar calendário**: copiar o link e pôr em `AIRBNB_ICAL_URL`.
   - **Importar calendário**: colar
     `https://www.estanciasfeliz.com.br/api/calendario.ics?token=<ICAL_TOKEN>`
4. Ainda na Airbnb, ligar **tempo de preparo = 1 noite**. É o que dá o dia
   de limpeza entre um hóspede e outro sem criar laço entre os calendários.
5. Importar `n8n/sincronizar-airbnb.json` no n8n e ativar. Ele já aponta
   para a credencial *Site Estancias Feliz (x-api-token)* que existe.
6. Conferir sem gravar nada:
   ```bash
   curl -s -H "x-api-token: $API_TOKEN" \
     "https://www.estanciasfeliz.com.br/api/sync/airbnb?simular=1" | head -40
   ```
7. Só depois de ver algumas sincronias limpas, ligar
   `AIRBNB_AVISA_WHATSAPP=1`, que faz reserva da Airbnb avisar o grupo e a
   equipe. **O lembrete de 7 dias para a Maurizia não depende dessa chave**
   — ele já sai para toda reserva `CONFIRMADA`, inclusive as importadas.

### Nada aqui cancela reserva

Vale dizer explicitamente, porque a dúvida aparece e o medo é razoável:
**esta sincronia não consegue cancelar um aluguel, em nenhum dos dois
sentidos.**

- O importador **só lê** a Airbnb. Não existe uma linha de código que
  escreva lá — nem para bloquear, nem para cancelar.
- O calendário que a Airbnb importa daqui **só fecha data para venda
  nova**. Reserva confirmada tem precedência sobre bloqueio importado.

O pior caso possível é uma data ficar fechada quando podia estar aberta.
É oportunidade perdida, nunca dinheiro já ganho.

### Bloqueio não é reserva

O feed da Airbnb traz dois tipos de evento, e confundi-los assusta à toa:

| `SUMMARY` | O que é | Tem link/código? |
|---|---|---|
| `Reserved` | hóspede que pagou | sim |
| `Airbnb (Not available)` | data fechada à mão pelo anfitrião | não |

Apagar um bloqueio na Airbnb reabre a data para venda. Não toca em
reserva nenhuma — na tela deles, desfazer uma reserva exige entrar nela
e **cancelar**, ação separada e com multa.

Bloqueio antigo que sobrou na Airbnb **não precisa ser limpo**. Se ele
cobre data que o site já tem vendida, não faz efeito nenhum. O único
incômodo aparece se um aluguel for cancelado no site e a data continuar
fechada: aí o bloqueio da Airbnb é que está segurando, e apagá-lo lá
libera aqui na passada seguinte.

### O que o iCal não resolve

- **Preço e mínimo de noites não atravessam.** A regra de bloco fechado de
  feriado do `pricing.ts` não existe do lado de lá: alguém pode pegar duas
  noites soltas de Carnaval pela Airbnb. Só se resolve configurando
  estadia mínima no painel deles.
- **A Airbnb avisa** que noites *reservadas* em outra plataforma bloqueiam,
  mas *bloqueios* podem ou não bloquear. Na prática funciona; vale
  confirmar com um bloqueio de teste antes de confiar.

---

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha os valores
npm run dev
```

Abre em <http://localhost:3000>.

### Variáveis de ambiente

| Variável | Para que serve | Onde achar |
|---|---|---|
| `SUPABASE_URL` | Banco de orçamentos e reservas | Supabase → Project Settings → Data API |
| `SUPABASE_SERVICE_ROLE_KEY` | Acesso de servidor ao banco | Supabase → Project Settings → API Keys |
| `ADMIN_USUARIO` | Usuário de entrada em `/admin` | Você escolhe |
| `ADMIN_SENHA` | Senha de entrada em `/admin` | Você escolhe |
| `ADMIN_SECRET` | Assina o cookie de sessão | `openssl rand -hex 32` |
| `API_TOKEN` | Autentica o n8n em `/api/consultar` | `openssl rand -hex 32` |
| `EVOLUTION_KEY` | Envia os avisos de WhatsApp | n8n → credencial *Header Auth account* |
| `GRUPO_DONOS_JID` | Grupo que recebe a agenda | `node scripts/listar-grupos.mjs` |
| `FAXINEIRA_WHATSAPP` | WhatsApp da Maurizia (limpeza), com DDI e DDD | você já tem |
| `PISCINEIRO_WHATSAPP` | WhatsApp do Renato (piscina) | você já tem |
| `CRON_SECRET` | Autentica o cron da Vercel no lembrete de 7 dias | `openssl rand -hex 32` |
| `LEAD_WHATSAPP_ATIVO` | **Liga o disparo para o cliente.** Sem `1`, nada sai | você decide quando ligar |
| `LEAD_WHATSAPP_TETO_DIARIO` | Teto de mensagens para lead por dia (padrão 30) | opcional |

`EVOLUTION_URL` e `EVOLUTION_INSTANCIA` são opcionais: sem elas o site usa
`api.estanciasfeliz.com.br` e `sitio-atendimento`, a mesma instância em que
a Júlia atende.

A `SUPABASE_SERVICE_ROLE_KEY` ignora as regras de segurança do banco.
Ela só pode existir no servidor — **nunca** use o prefixo `NEXT_PUBLIC_` nela.

### Banco de dados

Rode na ordem, no SQL Editor do Supabase:

```
supabase/migrations/001_orcamentos.sql
supabase/migrations/002_agenda.sql
supabase/migrations/003_notificacoes.sql
supabase/migrations/004_crm.sql
supabase/migrations/005_lead_whatsapp.sql
supabase/migrations/006_airbnb.sql
```

O `001` cria `orcamentos` e `datas_bloqueadas` e liga RLS nas duas.
O `002` acrescenta `status` às `reservas` (sem ele não há como cancelar uma
reserva, e a data ficaria presa para sempre) e permite orçamento sem data,
para não perder o contato de quem pergunta preço antes de escolher o dia.
O `003` cria `notificacoes`, que guarda o histórico dos avisos de WhatsApp
e impede o lembrete de 7 dias de sair duas vezes.
O `004` acrescenta as três colunas de CRM em `orcamentos` (`anotacoes`,
`contatado_em`, `abriu_whatsapp_em`). **Sem ele o site funciona**, mas a
aba de Leads não salva anotação nem registra contato, e o clique no
WhatsApp deixa de ser marcado.
O `005` libera os tipos `LEAD_NOVO` e `LEAD_RETOMADA` em `notificacoes` e
guarda em `orcamentos` quando o site falou com a pessoa. Sem ele o
disparo para o lead não sai — a trava de duplicata falha no CHECK de
`tipo` e a mensagem é engolida com erro no log.
O `006` acrescenta `uid_externo` e `origem` às tabelas de agenda, e
`observacoes` a `reservas`. É o que permite ao importador da Airbnb
reconhecer o que já trouxe e — mais importante — saber quais linhas
**não** são dele. Sem ele, `/api/sync/airbnb` falha com erro de coluna
inexistente e nada é importado.

---

## Fotos

A galeria é organizada **por espaço**: piscina, churrasqueira, salão, cada
quarto, cada banheiro. Quem entra no site consegue percorrer o sítio inteiro
e entender o que tem em cada canto. São 57 fotos em 22 espaços.

Três arquivos mandam nisso:

| Arquivo | Papel |
| --- | --- |
| `fotos/` (raiz) | Originais em alta, por espaço. **Fora do git** (237 MB) — guarde cópia em outro lugar. |
| `scripts/gerar-fotos.py` | O manifesto da seleção: liga cada `IMG_0000` ao nome publicado e gera as versões web. |
| `src/lib/fotos.ts` | Os espaços (nome, descrição, filtro) e a descrição de cada foto. |

As fotos publicadas ficam em `public/fotos/`, já otimizadas (1600px no maior
lado, JPEG qualidade 80, ~21 MB no total).

Para trocar a seleção: edite o `MANIFESTO` em `scripts/gerar-fotos.py` e rode

```bash
python3 scripts/gerar-fotos.py
```

O script regrava `public/fotos/` e apaga o que saiu da seleção — só `hero.jpg`,
a foto de capa, fica de fora dessa limpeza. Depois ajuste as entradas em
`src/lib/fotos.ts`. Enquanto um arquivo listado lá não existir, o site mostra
um espaço reservado no lugar — nada quebra.

---

## Comandos

```bash
npm run dev     # desenvolvimento
npm run build   # build de produção
npm start       # roda o build
npm test        # testes do motor de preços e dos textos dos avisos
npm run lint    # eslint

node scripts/listar-grupos.mjs   # descobre o JID do grupo do WhatsApp
```

---

## Publicar: verificar, commitar, enviar, subir

**Duas coisas separadas, que já foram confundidas:** `git push` guarda o
código no GitHub e **não publica nada**; quem publica é a CLI da Vercel,
que empacota o **diretório de trabalho** (não um commit). Se você fizer só
o push, o site continua o mesmo. Se fizer só o deploy, o site sai na frente
do repositório — e foi o que já aconteceu aqui.

Faça na ordem. Nada abaixo é opcional.

### 1. Verificar

```bash
npm test            # preços, ocupação e o texto dos avisos de WhatsApp
npx tsc --noEmit    # tipos
npm run lint        # eslint
npm run build       # o build de produção pega o que o dev deixa passar
```

Os quatro precisam passar antes de qualquer commit. O `build` é o que
mais salva: erro de tipo em route handler só aparece nele.

### 2. Commitar

```bash
git status --short                    # o que exatamente vai entrar
git add <caminhos>                    # explícito; evite `git add -A`
git diff --cached                     # leia o que está indo
git commit
```

Antes de commitar, confira que nenhum segredo entrou:

```bash
git diff --cached | grep -iE '^\+.*(sb_secret|service_role|eyJhbGciOi|apikey *[:=])' \
  || echo "limpo"
```

Estilo das mensagens deste repo: assunto curto em português, no presente
(*"Cobra as diárias que passam do bloco do feriado"*), corpo explicando o
**por quê** e não o quê, e `Co-Authored-By:` no fim quando teve IA no meio.

### 3. Enviar para o GitHub

```bash
git push
```

Só versionamento. `origin` é `github.com/oliveira25lucas/estancias-feliz`,
branch `site-inicial`. **Não dispara deploy.**

### 4. Preview

```bash
npx vercel deploy --yes
```

Devolve uma URL `*-estancias-feliz.vercel.app` que **não** toca no domínio.
Sempre passe por aqui.

### 5. Verificar o preview

O preview tem *Deployment Protection*: curl comum leva `302 Redirecting`.
Para furar, use o `vercel curl` — as flags do curl vão depois do `--`:

```bash
npx vercel curl "/api/cron/lembretes?previa=1" \
  --deployment <url-do-preview> \
  -- --silent --header "Authorization: Bearer $CRON_SECRET"
```

Confira também as variáveis, que é onde falha silenciosamente:

```bash
npx vercel env ls   # nome e ambiente (Preview/Production); nunca o valor
```

Segredo que existe em Preview e falta em Production só quebra depois do
`--prod`, e só em runtime.

### 6. Publicar

```bash
npx vercel deploy --prod --yes
```

Use **isto**, não "Promote to Production" no painel: o **cron só é
registrado em deploy com target production**. Promover um preview publica o
site novo e deixa o cron para trás, sem erro nenhum na tela.

### 7. Verificar produção

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://www.estanciasfeliz.com.br/        # 200
curl -s -o /dev/null -w "%{http_code}\n" https://www.estanciasfeliz.com.br/admin   # 307
npx vercel crons ls                                                               # /api/cron/lembretes  0 11 * * *
```

O domínio de produção **não** tem Deployment Protection — aqui curl comum
funciona.

### 8. Se deu ruim

```bash
npx vercel rollback
```

Ou no painel: *Deployments → o anterior → Promote to Production*.

### Armadilhas

- **`.vercelignore` manda no upload no lugar do `.gitignore`.** Ele existe
  para barrar os 237 MB de `/fotos/`. A barra inicial é obrigatória:
  `fotos/` sem barra casa em qualquer nível e leva junto `public/fotos/` —
  o site sobe sem imagem nenhuma. Já aconteceu (commit `5f67fd7`).
- **O deploy sobe o diretório de trabalho.** Arquivo sem commitar vai ao ar
  junto; arquivo commitado mas apagado do disco não vai.
- **`vercel link` acrescenta um `VERCEL_OIDC_TOKEN` ao `.env.local`.** É da
  CLI, expira sozinho, e o arquivo é gitignored.
- A CLI da Vercel não está instalada no projeto — `npx vercel` baixa na
  hora. A conta já está autenticada; `vercel login` é interativo e não faz
  falta.

> Os subdomínios `n8n` e `api` apontam para `91.99.198.110` (o VPS).
> Se algum dia precisar mexer no DNS, mexa apenas na raiz e no `www` — não
> altere `n8n` nem `api`, ou o agente do WhatsApp sai do ar.

---

## Estrutura

```
scripts/gerar-fotos.py            # seleção das fotos + geração das versões web
scripts/listar-grupos.mjs         # descobre o JID do grupo do WhatsApp
vercel.json                       # cron do lembrete de 7 dias
src/
├── app/
│   ├── page.tsx                  # início
│   ├── orcamento/page.tsx        # calculadora
│   ├── agenda/page.tsx           # calendário público (noindex, sem link no site)
│   ├── api/agenda/route.ts       # dias ocupados da janela (só datas, público)
│   ├── api/orcamento/route.ts    # POST cria o lead, PATCH atualiza o mesmo
│   ├── api/cron/lembretes/       # lembrete de 7 dias (chamado pelo cron)
│   └── admin/                    # painel protegido, em abas (dispara os avisos)
│       ├── PainelAbas.tsx        # agenda | leads
│       └── CRMLeads.tsx          # funil, anotações e último contato
├── components/
│   ├── CalendarioDisponibilidade.tsx  # calendário compartilhado (público e calculadora)
│   └── ...                       # header, rodapé, galeria, calculadora
└── lib/
    ├── pricing.ts                # motor de preços (espelha o n8n)
    ├── site-config.ts            # dados do sítio: endereço, estrutura, FAQ
    ├── fotos.ts                  # galeria: espaços e fotos
    ├── notificacoes.ts           # texto dos avisos de WhatsApp (puro, testado)
    ├── avisos.ts                 # quando avisar a equipe e quem recebe
    ├── leads.ts                  # quando escrever para o CLIENTE, com as travas
    ├── whatsapp.ts               # envio pela Evolution API
    ├── supabase.ts               # cliente de servidor
    ├── credenciais.ts            # usuário, senha e token do admin (puro, testado)
    └── auth.ts                   # o cookie de sessão do admin
```

### Decisões que valem saber

- **O preço é sempre recalculado no servidor** (`api/orcamento/route.ts`).
  O valor que chega do navegador é tratado como palpite: aceitá-lo permitiria
  a alguém forjar um orçamento de R$ 1.
- **O lead nunca se perde.** Se o banco falhar, o site ainda abre o WhatsApp
  com a mensagem pronta e avisa a pessoa.
- **Datas são montadas componente a componente** (`parseData`), nunca com
  `new Date("2026-08-14")` — essa forma é lida como UTC e volta um dia no
  Brasil, o que trocaria uma sexta por quinta e mudaria o preço.
- **Regra sem banco fica em arquivo separado.** `ocupacao.ts` e
  `notificacoes.ts` não importam Supabase, e é só por isso que o
  `npm test` alcança as duas. Quem fala com banco e rede mora ao lado, em
  `agenda.ts` e `avisos.ts`.
- **"Hoje" é sempre o de Brasília.** A Vercel roda em UTC: às 21h daqui,
  lá já é o dia seguinte, e o calendário abriria com a data de hoje
  bloqueada. `hojeISO()` formata em `America/Sao_Paulo`.
- **O rate-limit é por rota, não por IP puro.** Os baldes são um mapa só;
  com o IP como chave, uma consulta de agenda (janela de 1 minuto) apagava
  as marcas do envio de orçamento (janela de 10 minutos) na hora de
  filtrar, e o limite que mais importa segurar deixava de existir. Por
  isso `agenda:${ip}`, `orcamento:${ip}`, e assim por diante.
- **`proximosFinsDeSemanaLivres` faz uma consulta, não 26.** Antes ia ao
  banco por fim de semana até achar os livres. Agora traz a janela inteira
  uma vez e decide em memória, com a mesma função pura que o calendário
  usa.
- **Módulo puro importa com `.ts` na frente.** `notificacoes.ts` escreve
  `from "./pricing.ts"` porque o `node --test` resolve ESM sem adivinhar
  extensão. É o que `allowImportingTsExtensions` no `tsconfig.json`
  permite. Arquivo que só roda dentro do Next continua importando sem
  extensão.
