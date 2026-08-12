/**
 * Descobre o JID do grupo do WhatsApp.
 *
 * Para mandar mensagem em grupo, a Evolution não aceita número: precisa
 * do JID, que é um id tipo `120363021234567890@g.us`. Este script lista
 * os grupos da instância e imprime o JID de cada um, para você copiar o
 * do "Aluguel Sítio Estâncias Feliz" e colar em GRUPO_DONOS_JID.
 *
 * Antes de rodar, ponha a apikey da Evolution no .env.local:
 *
 *     EVOLUTION_KEY=<a mesma chave da credencial "Header Auth account" do n8n>
 *
 * Depois:
 *
 *     node scripts/listar-grupos.mjs
 *
 * A chave fica só no seu .env.local, que não vai para o git.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Lê o .env.local sem depender de biblioteca. */
function lerEnv() {
  const valores = {};
  let bruto = "";
  try {
    bruto = readFileSync(join(RAIZ, ".env.local"), "utf8");
  } catch {
    return valores;
  }

  for (const linha of bruto.split("\n")) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith("#")) continue;
    const igual = limpa.indexOf("=");
    if (igual < 0) continue;
    valores[limpa.slice(0, igual).trim()] = limpa
      .slice(igual + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return valores;
}

const env = { ...lerEnv(), ...process.env };
const chave = env.EVOLUTION_KEY;
const base = (env.EVOLUTION_URL || "https://api.estanciasfeliz.com.br").replace(
  /\/+$/,
  "",
);
const instancia = env.EVOLUTION_INSTANCIA || "sitio-atendimento";

if (!chave) {
  console.error(
    "\nFalta a EVOLUTION_KEY.\n\n" +
      "Pegue a apikey no n8n (credencial \"Header Auth account\", usada pelo nó\n" +
      '"Enviar WhatsApp") e acrescente ao .env.local:\n\n' +
      "    EVOLUTION_KEY=sua-chave-aqui\n",
  );
  process.exit(1);
}

const url = `${base}/group/fetchAllGroups/${instancia}?getParticipants=false`;
console.log(`Consultando ${url}\n`);

const resposta = await fetch(url, {
  headers: { apikey: chave },
  signal: AbortSignal.timeout(30_000),
});

if (!resposta.ok) {
  console.error(
    `A Evolution respondeu ${resposta.status}:\n${(await resposta.text()).slice(0, 500)}`,
  );
  process.exit(1);
}

const corpo = await resposta.json();
const grupos = Array.isArray(corpo) ? corpo : (corpo?.data ?? []);

if (!Array.isArray(grupos) || grupos.length === 0) {
  console.log("Nenhum grupo veio na resposta. Corpo recebido:\n");
  console.log(JSON.stringify(corpo, null, 2).slice(0, 2000));
  process.exit(0);
}

console.log(`${grupos.length} grupo(s):\n`);
for (const g of grupos) {
  const nome = g.subject || g.name || "(sem nome)";
  const jid = g.id || g.jid || "(sem id)";
  const tamanho = g.size ?? g.participants?.length;
  console.log(`  ${nome}`);
  console.log(`    GRUPO_DONOS_JID=${jid}${tamanho ? `   (${tamanho} membros)` : ""}\n`);
}

console.log(
  "Copie a linha GRUPO_DONOS_JID do grupo certo para o .env.local\n" +
    "e cadastre a mesma variável na Vercel.",
);
