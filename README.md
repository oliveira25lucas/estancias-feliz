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

## Ligação com o agente de IA do WhatsApp

A atendente virtual (**Júlia**) roda em n8n e conversa pela Evolution API.
O site **compartilha o mesmo banco Supabase** que ela usa, então:

- Reservas fechadas pela Júlia aparecem na agenda do painel.
- O motor de preços do site é um porte fiel do nó `Processar Calendar e Preco1`
  do workflow *Atendimento Sítio v3*.

> **Importante:** se um preço mudar, mude nos **dois** lugares —
> `src/lib/pricing.ts` e o workflow no n8n. Preço divergente entre o site e o
> WhatsApp é a forma mais rápida de perder a confiança do cliente.
> Os testes em `src/lib/pricing.test.ts` travam os valores atuais.

Arquitetura resumida:

```
Cliente no WhatsApp
      ↓
Evolution API (api.estanciasfeliz.com.br, instância "sitio-atendimento")
      ↓ webhook
n8n (n8n.estanciasfeliz.com.br) — workflow "Atendimento Sítio v3"
      ↓                    ↓                      ↓
   OpenAI            Google Calendar          Supabase
                                                  ↑
                                          Site (este projeto)
```

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

A `SUPABASE_SERVICE_ROLE_KEY` ignora as regras de segurança do banco.
Ela só pode existir no servidor — **nunca** use o prefixo `NEXT_PUBLIC_` nela.

### Banco de dados

Rode uma vez, no SQL Editor do Supabase:

```
supabase/migrations/001_orcamentos.sql
```

Cria `orcamentos` e `datas_bloqueadas`, liga RLS nas duas e aplica a migração
pendente da tabela `sessoes` que o workflow v3 do n8n espera.

---

## Fotos

As fotos publicadas ficam em `public/fotos/`, já otimizadas (1600px de
largura, JPEG qualidade 80, ~6,5 MB no total). A lista e as descrições estão
em `src/lib/fotos.ts`.

Os originais em alta resolução ficam na pasta `fotos/` na raiz — **fora do
git**, por causa do tamanho (238 MB). Guarde uma cópia em outro lugar.

Para trocar uma foto, gere a versão web com:

```bash
npx sharp-cli --input fotos/IMG_0000.JPG --output public/fotos/nova.jpg resize 1600
```

e adicione a entrada em `src/lib/fotos.ts`. Enquanto um arquivo listado não
existir, o site mostra um espaço reservado no lugar — nada quebra.

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
    ├── fotos.ts                  # galeria
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
