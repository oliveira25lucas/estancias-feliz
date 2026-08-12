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

A `SUPABASE_SERVICE_ROLE_KEY` ignora as regras de segurança do banco.
Ela só pode existir no servidor — **nunca** use o prefixo `NEXT_PUBLIC_` nela.

### Banco de dados

Rode na ordem, no SQL Editor do Supabase:

```
supabase/migrations/001_orcamentos.sql
supabase/migrations/002_agenda.sql
```

O `001` cria `orcamentos` e `datas_bloqueadas` e liga RLS nas duas.
O `002` acrescenta `status` às `reservas` (sem ele não há como cancelar uma
reserva, e a data ficaria presa para sempre) e permite orçamento sem data,
para não perder o contato de quem pergunta preço antes de escolher o dia.

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
npm test        # testes do motor de preços
npm run lint    # eslint
```

---

## Publicação

O deploy é na Vercel, com deploy automático a cada push na branch `main`.

1. Importe o repositório na Vercel.
2. Cadastre as 4 variáveis de ambiente em *Settings → Environment Variables*.
3. Em *Settings → Domains*, adicione `estanciasfeliz.com.br` e `www`.
4. No painel de DNS do domínio, aponte os registros que a Vercel indicar.

> O domínio raiz `estanciasfeliz.com.br` ainda **não tem registro DNS**.
> Os subdomínios `n8n` e `api` já apontam para `91.99.198.110` (o VPS).
> Ao configurar o site, mexa apenas nos registros da raiz e do `www` — não
> altere `n8n` nem `api`, ou o agente do WhatsApp sai do ar.

---

## Estrutura

```
scripts/gerar-fotos.py            # seleção das fotos + geração das versões web
src/
├── app/
│   ├── page.tsx                  # início
│   ├── orcamento/page.tsx        # calculadora
│   ├── api/orcamento/route.ts    # recebe o pedido (recalcula o preço no servidor)
│   └── admin/                    # painel protegido
├── components/                   # header, rodapé, galeria, calculadora
└── lib/
    ├── pricing.ts                # motor de preços (espelha o n8n)
    ├── site-config.ts            # dados do sítio: endereço, estrutura, FAQ
    ├── fotos.ts                  # galeria: espaços e fotos
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
