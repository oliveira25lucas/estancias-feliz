# Sítio Estâncias Feliz

Site institucional, calculadora de orçamento e painel administrativo do
Sítio Estâncias Feliz — Rod. BH-Brumadinho (MG-040), Km 30, Sarzedo/MG.

Feito em Next.js 16 (App Router) + Tailwind CSS v4 + Supabase.

---

## O que o site faz

| Página | Rota | O que é |
|---|---|---|
| Início | `/` | Vitrine: estrutura, galeria, preços, como chegar e dúvidas |
| Orçamento | `/orcamento` | Calculadora ao vivo; ao enviar, grava o pedido e abre o WhatsApp preenchido |
| Painel | `/admin` | Orçamentos recebidos, agenda e bloqueio de datas (protegido por senha) |

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

## Avisos automáticos no WhatsApp

O site avisa duas pessoas sozinho: o **grupo dos donos** ("Aluguel Sítio
Estâncias Feliz") e a **Maurizia**, que faz a limpeza.

| Quando | Quem recebe | O que chega |
|---|---|---|
| Reserva entra em `CONFIRMADA` | grupo + Maurizia | a agenda futura inteira, com a data que entrou em negrito e uma seta |
| Reserva sai de `CONFIRMADA` (cancelada ou excluída) | grupo + Maurizia | o período riscado e a agenda já sem ele |
| 7 dias antes da entrada | Maurizia + grupo | data, horários, quantas pessoas, e o prazo da véspera |

A regra é uma frase: **avisa quem entra em `CONFIRMADA` e quem sai de
`CONFIRMADA`**. Reserva em `PENDENTE_CONTRATO` não incomoda ninguém —
mas aparece na lista marcada como *(aguardando contrato)*, porque a data
está segurada e os donos precisam ver isso.

```
Painel /admin  ──►  status muda  ──►  after()  ──►  Evolution API ──►  grupo + Maurizia
                                                        ▲
Cron da Vercel ──►  /api/cron/lembretes (D-7)  ─────────┘
```

Três arquivos mandam nisso:

| Arquivo | Papel |
| --- | --- |
| `src/lib/notificacoes.ts` | o texto das mensagens. Lógica pura, sem banco — os testes travam palavra por palavra |
| `src/lib/avisos.ts` | quando avisar, quem recebe, e o registro do que já foi enviado |
| `src/lib/whatsapp.ts` | o envio pela Evolution API |

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
   `FAXINEIRA_WHATSAPP` e `CRON_SECRET`.
5. Importe o workflow v4 atualizado no n8n (o nó `Filtrar Mensagem` ganhou
   a lista `SEM_IA`).

**Sem `EVOLUTION_KEY` nada é enviado** e nada quebra: o site registra no
log que não avisou e segue funcionando. Vale para cada destino em separado
— se só o JID do grupo estiver faltando, a Maurizia recebe normalmente.

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

- **A Júlia não responde nesses dois.** O grupo já era ignorado por ser
  `@g.us`; o número da Maurizia entrou na lista `SEM_IA` do nó `Filtrar
  Mensagem`. Sem isso, um "ok, combinado" dela viraria conversa de
  orçamento com a IA.
- **Mas as respostas dela chegam em algum lugar.** Os avisos saem pela
  instância `sitio-atendimento`, o número do sítio. Com a IA calada, o que
  a Maurizia responder fica lá esperando alguém ler — vale abrir esse
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
- **A Maurizia nunca vê valor de aluguel.** Nem no aviso, nem no lembrete —
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
| `ADMIN_SENHA` | Senha de entrada em `/admin` | Você escolhe |
| `ADMIN_SECRET` | Assina o cookie de sessão | `openssl rand -hex 32` |
| `API_TOKEN` | Autentica o n8n em `/api/consultar` | `openssl rand -hex 32` |
| `EVOLUTION_KEY` | Envia os avisos de WhatsApp | n8n → credencial *Header Auth account* |
| `GRUPO_DONOS_JID` | Grupo que recebe a agenda | `node scripts/listar-grupos.mjs` |
| `FAXINEIRA_WHATSAPP` | WhatsApp da Maurizia, com DDI e DDD | você já tem |
| `CRON_SECRET` | Autentica o cron da Vercel no lembrete de 7 dias | `openssl rand -hex 32` |

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
```

O `001` cria `orcamentos` e `datas_bloqueadas` e liga RLS nas duas.
O `002` acrescenta `status` às `reservas` (sem ele não há como cancelar uma
reserva, e a data ficaria presa para sempre) e permite orçamento sem data,
para não perder o contato de quem pergunta preço antes de escolher o dia.
O `003` cria `notificacoes`, que guarda o histórico dos avisos de WhatsApp
e impede o lembrete de 7 dias de sair duas vezes.

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
│   ├── api/orcamento/route.ts    # recebe o pedido (recalcula o preço no servidor)
│   ├── api/cron/lembretes/       # lembrete de 7 dias (chamado pelo cron)
│   └── admin/                    # painel protegido (dispara os avisos)
├── components/                   # header, rodapé, galeria, calculadora
└── lib/
    ├── pricing.ts                # motor de preços (espelha o n8n)
    ├── site-config.ts            # dados do sítio: endereço, estrutura, FAQ
    ├── fotos.ts                  # galeria: espaços e fotos
    ├── notificacoes.ts           # texto dos avisos de WhatsApp (puro, testado)
    ├── avisos.ts                 # quando avisar e quem recebe
    ├── whatsapp.ts               # envio pela Evolution API
    ├── supabase.ts               # cliente de servidor
    └── auth.ts                   # sessão do admin
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
- **Módulo puro importa com `.ts` na frente.** `notificacoes.ts` escreve
  `from "./pricing.ts"` porque o `node --test` resolve ESM sem adivinhar
  extensão. É o que `allowImportingTsExtensions` no `tsconfig.json`
  permite. Arquivo que só roda dentro do Next continua importando sem
  extensão.
