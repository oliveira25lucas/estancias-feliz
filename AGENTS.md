<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Publicar não é dar push

A conexão GitHub → Vercel deste projeto está **desligada**. `git push`
versiona e **não publica nada**. Quem publica é a CLI, de dentro desta pasta:

```bash
npx vercel deploy          # preview, numa URL própria, sem tocar no domínio
npx vercel deploy --prod   # publica em estanciasfeliz.com.br
npx vercel rollback        # volta para o deploy anterior
```

O deploy sai do **diretório de trabalho**, não de um commit — o que está
sem commitar vai para o ar junto.

Duas armadilhas que já custaram tempo:

- **Cron só é registrado em deploy com target production.** Promover um
  preview pelo painel publica o site novo e deixa o cron para trás. Confira
  com `npx vercel crons ls`.
- **Preview tem Deployment Protection**: curl comum leva 302. Para furar,
  `npx vercel curl "<path>" --deployment <url> -- --header "..."`.

O passo a passo completo, com as verificações, está em "Publicação" no
README.

# Avisos automáticos de WhatsApp

O site manda mensagem sozinho para o grupo dos donos e para a faxineira
(agenda mudou, e lembrete 7 dias antes). Antes de mexer em `src/lib/avisos.ts`,
`notificacoes.ts` ou `whatsapp.ts`, leia "Avisos automáticos no WhatsApp" no
README: **o painel de produção envia de verdade**, e o texto das mensagens é
travado por testes em `notificacoes.test.ts`.
