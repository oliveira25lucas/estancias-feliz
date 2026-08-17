<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Commit, push e deploy — o ciclo completo

**`git push` publica em produção.** A conexão GitHub → Vercel está ligada
desde 17/08/2026 — antes não estava, e este arquivo dizia o contrário.
Cada push em `site-inicial` cria um deploy de produção sozinho, com o cron
registrado (conferido em 17/08). Ou seja: **pushar código quebrado derruba
o site na hora**. Rode os quatro comandos de verificação antes do push, não
depois.

A CLI continua servindo, e ela empacota o **diretório de trabalho**, não um
commit — é como se publica algo que ainda não foi commitado, ou se refaz um
deploy sem um push novo.

Na ordem, sem pular:

```bash
# 1. verificar — os quatro precisam passar
npm test && npx tsc --noEmit && npm run lint && npm run build

# 2. commitar — explícito, e leia o que está indo
git status --short
git add <caminhos>                    # evite `git add -A`
git diff --cached | grep -iE '^\+.*(sb_secret|service_role|eyJhbGciOi|apikey *[:=])' || echo limpo
git commit                            # assunto em português, corpo com o POR QUÊ, Co-Authored-By no fim

# 3. enviar ao GitHub — ATENÇÃO: isto já publica em produção
git push

# 4. preview, sem tocar no domínio (opcional; o push já subiu)
npx vercel deploy --yes

# 5. verificar o preview (tem Deployment Protection: curl comum leva 302)
npx vercel curl "/api/cron/lembretes?previa=1" --deployment <url> \
  -- --silent --header "Authorization: Bearer $CRON_SECRET"
npx vercel env ls                     # nome e ambiente; segredo faltando em Production só quebra depois

# 6. publicar
npx vercel deploy --prod --yes

# 7. verificar produção (aqui curl comum funciona)
curl -s -o /dev/null -w "%{http_code}\n" https://www.estanciasfeliz.com.br/        # 200
curl -s -o /dev/null -w "%{http_code}\n" https://www.estanciasfeliz.com.br/admin   # 307
npx vercel crons ls                                                               # 0 11 * * *

# 8. se deu ruim
npx vercel rollback
```

Armadilhas que já custaram tempo:

- **Cron só é registrado em deploy com target production.** "Promote to
  Production" no painel publica o site novo e deixa o cron para trás, sem
  erro na tela. Use `deploy --prod`.
- **`.vercelignore` manda no upload no lugar do `.gitignore`**, e `fotos/`
  sem barra inicial casa em qualquer nível e leva junto `public/fotos/` — o
  site sobe sem nenhuma imagem (commit `5f67fd7`).
- A CLI não está instalada: `npx vercel`. A conta já está autenticada.

O detalhamento está em "Publicar: verificar, commitar, enviar, subir" no
README.

# Avisos automáticos de WhatsApp

O site manda mensagem sozinho para o grupo dos donos e para a faxineira
(agenda mudou, e lembrete 7 dias antes). Antes de mexer em `src/lib/avisos.ts`,
`notificacoes.ts` ou `whatsapp.ts`, leia "Avisos automáticos no WhatsApp" no
README: **o painel de produção envia de verdade**, e o texto das mensagens é
travado por testes em `notificacoes.test.ts`.

# O workflow do n8n não é seu

`n8n/atendimento-sitio-v4.json` é o agente que está no ar. Reconstruí-lo a
partir de um snapshot baixado da API apaga qualquer mudança feita depois do
download — em 17/08/2026 isso apagou duas do Lucas em uma hora (o Renato na
lista `SEM_IA`, e a normalização do nono dígito), e ele só percebeu porque
o diff do git denunciou.

Antes de qualquer `PUT /api/v1/workflows/DUVUbni2SWf8TBj8`:

1. Baixe o que está no ar **na hora**, não minutos antes.
2. Compare com `n8n/atendimento-sitio-v4.json` do repositório e junte os
   dois. O nó `Filtrar Mensagem` em especial vem do repositório: é onde
   mora a lista de quem a Júlia não atende.
3. Guarde o JSON anterior — é o rollback.
4. Compile os nós de código antes de subir: extraia cada `jsCode`, embrulhe
   em `(async function(){ ... })` e rode `node --check`.

Mande só `name`, `nodes`, `connections`, `settings`; outros campos dão 400.
