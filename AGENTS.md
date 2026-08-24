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

> ⚠️ **`npm run build` não passa nesta máquina, e não é o seu código.**
> Ele morre em `Error occurred prerendering page "/_global-error"` →
> `TypeError: Cannot read properties of null (reading 'useContext')`. A
> página é interna do Next (não existe `global-error.tsx` no repo), o
> mesmo commit constrói na Vercel em ~21s, e limpar o `.next` não muda
> nada. É a combinação **Next 16 + turbopack + macOS Intel**
> (`swc-darwin-x64`); a Vercel constrói em linux-x64 e não vê isso.
> Conferido em 24/08/2026 fazendo `git stash` e construindo o HEAD limpo,
> que falha igual.
>
> Consequência prática: **o passo 1 perdeu o comando que mais salvava.**
> Rode os outros três (`npm test`, `npx tsc --noEmit`, `npm run lint`) e
> use um **preview da Vercel como o gate de build** — `npx vercel deploy
> --yes` constrói do lado deles e falha antes de qualquer coisa ir para
> produção. Não conclua que sua mudança quebrou o build sem antes
> comparar com o HEAD limpo.

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

Duas coisas que os testes travam e que parecem inofensivas de reverter:
**valor de aluguel nunca aparece** em aviso interno, e **horário de entrada
ou saída também não**. O horário saiu em 24/08/2026: a tabela é 8h e até
16h, mas o combinado com o hóspede muda, e um lembrete disparado sete dias
antes vira a versão errada que a Maurizia e o Renato leram primeiro. O aviso
diz **que dia** entra gente no sítio — a que horas é o Lucas quem fala com
eles, no dia.

# Sincronia com a Airbnb

O site publica `/api/calendario.ics` (a Airbnb busca de 3 em 3 horas) e
importa o calendário dela por `/api/sync/airbnb`, chamado pelo **n8n do
VPS** de 15 em 15 minutos — não pelo cron da Vercel, que no plano Hobby
só roda uma vez por dia. Leia "Sincronia de calendário com a Airbnb" no
README antes de mexer.

Dois pontos que quebram tudo em silêncio:

- **O dia da saída.** O sítio conta check-out como ocupado; o iCal conta
  `DTEND` como exclusivo. A conversão vive só em `reservaParaEvento` e
  `eventoParaReserva` (`src/lib/ical.ts`), travada por `ical.test.ts`.
  Errar um dia é vender o mesmo fim de semana duas vezes.
- **O importador apaga coisa.** Ele só pode tocar em linha com
  `origem = 'airbnb'` e `uid_externo` preenchido, e o filtro se repete na
  leitura E na escrita. Afrouxar isso apaga bloqueio de manutenção e
  reserva de contrato.

O calendário publicado sai de casa: nunca acrescente nome, telefone,
valor ou motivo de bloqueio ao `.ics` — há teste travando isso.

O workflow `n8n/sincronizar-airbnb.json` é **novo e separado** do
`atendimento-sitio-v4.json`, de propósito: sincronia não é motivo para
arriscar um `PUT` no agente que está no ar.

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

# Como a Júlia escreve

O prompt dela é o nó `Montar Resposta`, e a resposta sai em **balões**
(`Preparar Envio` quebra, `Splitar Balões` distribui, `Enviar WhatsApp`
manda com `batchSize: 1`). Antes de reescrever qualquer coisa aí, leia
"Como a Júlia escreve" no README.

A regra que se aprendeu caro, duas vezes: **o que dá para calcular não se
pede ao modelo.** O ano da data, o que ainda falta perguntar, se já houve
conversa e em que dia cai um feriado são todos decididos em código — o
modelo só redige. Nome de feriado em especial: ele devolve `feriado:
"carnaval"` e o site resolve o bloco.
