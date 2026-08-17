/**
 * Envio de WhatsApp pela Evolution API.
 *
 * Usa a MESMA instância em que a Júlia atende (`sitio-atendimento`), então
 * os avisos saem do número do sítio — que é o número que os donos e a
 * Maurizia já conhecem. Não trocar pelo número pessoal do Lucas.
 *
 * Consequência de compartilhar a instância: quando a Maurizia responde,
 * a mensagem dela cai no fluxo do agente. Por isso o nó `Filtrar
 * Mensagem` do workflow v4 tem uma lista de números sem IA — o grupo já
 * era ignorado por ser `@g.us`, mas o número dela precisa estar lá.
 *
 * Nada aqui é chamado do navegador: a EVOLUTION_KEY é chave de servidor.
 */

const URL_PADRAO = "https://api.estanciasfeliz.com.br";
const INSTANCIA_PADRAO = "sitio-atendimento";
const TIMEOUT_MS = 15_000;

/** Quem recebe os avisos. Cada um vem de uma variável de ambiente. */
export type Destinatario = "grupo" | "faxineira" | "piscineiro";

/** Todos menos o grupo: gente que trabalha no sítio e precisa das datas. */
export type MembroEquipe = Exclude<Destinatario, "grupo">;

/**
 * A equipe que recebe aviso de agenda.
 *
 * O nome mora aqui, e não dentro do texto, justamente para que acrescentar
 * gente seja acrescentar uma linha nesta lista: as mensagens recebem o
 * nome por parâmetro e valem para qualquer um. Os dois recebem exatamente
 * a mesma informação — datas, quantas pessoas e a agenda futura — porque é
 * o que os dois precisam saber para se organizar.
 */
export const EQUIPE = [
  { chave: "faxineira", nome: "Maurizia" },
  { chave: "piscineiro", nome: "Renato" },
] as const satisfies readonly { chave: MembroEquipe; nome: string }[];

export function whatsappConfigurado(): boolean {
  return Boolean(process.env.EVOLUTION_KEY);
}

/**
 * Normaliza o destino aceito pela Evolution.
 *
 * Grupo é um JID (`120363...@g.us`) e vai inteiro. Pessoa é só dígitos,
 * com código do país: número de 10 ou 11 dígitos é DDD + linha sem o 55,
 * e mandar assim faz a Evolution devolver 400.
 */
export function normalizarDestino(bruto: string): string {
  const limpo = bruto.trim();
  if (limpo.includes("@")) return limpo;

  const digitos = limpo.replace(/\D/g, "");
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  return digitos;
}

/**
 * Qual variável de ambiente guarda o número de cada um. O `switch` sobre o
 * tipo é de propósito: destinatário novo sem variável correspondente não
 * compila, em vez de falhar calado na hora de enviar.
 */
export function variavelDe(quem: Destinatario): string {
  switch (quem) {
    case "grupo":
      return "GRUPO_DONOS_JID";
    case "faxineira":
      return "FAXINEIRA_WHATSAPP";
    case "piscineiro":
      return "PISCINEIRO_WHATSAPP";
  }
}

/**
 * `null` quando a variável não está configurada — o aviso é só omitido,
 * e cada destino é independente: faltar o número do piscineiro não impede
 * o grupo e a faxineira de receberem.
 *
 * As leituras de `process.env` são escritas uma por uma, sem índice
 * dinâmico, porque é assim que o bundler garante o valor em runtime.
 */
export function destinoDe(quem: Destinatario): string | null {
  let bruto: string | undefined;
  switch (quem) {
    case "grupo":
      bruto = process.env.GRUPO_DONOS_JID;
      break;
    case "faxineira":
      bruto = process.env.FAXINEIRA_WHATSAPP;
      break;
    case "piscineiro":
      bruto = process.env.PISCINEIRO_WHATSAPP;
      break;
  }

  if (!bruto?.trim()) return null;
  return normalizarDestino(bruto);
}

/**
 * Manda o texto. Lança em qualquer falha — quem chama decide o que fazer,
 * e no caso dos avisos isso significa registrar o erro e seguir a vida:
 * WhatsApp fora do ar não pode derrubar o painel.
 */
export async function enviarTexto(destino: string, texto: string): Promise<void> {
  const chave = process.env.EVOLUTION_KEY;
  if (!chave) {
    throw new Error(
      "EVOLUTION_KEY não configurada. Sem ela não há como enviar WhatsApp.",
    );
  }

  const base = (process.env.EVOLUTION_URL || URL_PADRAO).replace(/\/+$/, "");
  const instancia = process.env.EVOLUTION_INSTANCIA || INSTANCIA_PADRAO;

  const resposta = await fetch(`${base}/message/sendText/${instancia}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: chave },
    body: JSON.stringify({
      number: destino,
      text: texto,
      // Um respiro antes de enviar; a Evolution usa isso para simular
      // digitação e não parecer disparo de robô.
      delay: 800,
      linkPreview: false,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => "");
    throw new Error(
      `Evolution respondeu ${resposta.status} ao enviar para ${destino}: ${corpo.slice(0, 300)}`,
    );
  }
}
