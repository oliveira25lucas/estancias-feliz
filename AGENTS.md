<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Commit, push e deploy — o ciclo completo

`git push` **não publica nada**: a conexão GitHub → Vercel está desligada.
Quem publica é a CLI da Vercel, e ela empacota o **diretório de trabalho**,
não um commit. São dois passos separados e os dois precisam acontecer.

Na ordem, sem pular:

```bash
# 1. verificar — os quatro precisam passar
npm test && npx tsc --noEmit && npm run lint && npm run build

# 2. commitar — explícito, e leia o que está indo
git status --short
git add <caminhos>                    # evite `git add -A`
git diff --cached | grep -iE '^\+.*(sb_secret|service_role|eyJhbGciOi|apikey *[:=])' || echo limpo
git commit                            # assunto em português, corpo com o POR QUÊ, Co-Authored-By no fim

# 3. enviar ao GitHub (só versiona — origin/site-inicial)
git push

# 4. preview, sem tocar no domínio
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
