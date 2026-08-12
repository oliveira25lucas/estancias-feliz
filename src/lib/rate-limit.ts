/**
 * Limite de requisições por IP, guardado em memória.
 *
 * Segura envio automatizado sem atrapalhar quem está de fato orçando.
 * É por instância do servidor — se um dia o site crescer para várias
 * instâncias, trocar por Upstash/Redis.
 */

type Balde = { marcas: number[] };

const baldes = new Map<string, Balde>();

/**
 * A `chave` precisa incluir a ROTA, não só o IP.
 *
 * Os baldes são um mapa só. Com o IP puro como chave, uma consulta de
 * agenda (janela de 1 minuto) apagava as marcas do envio de orçamento
 * (janela de 10 minutos) na hora de filtrar — e o limite do envio, que é
 * o que realmente importa segurar, deixava de existir. Por isso
 * `agenda:${ip}`, `orcamento:${ip}`, e assim por diante.
 */
export function excedeuLimite(
  chave: string,
  limite: number,
  janelaMs: number,
): boolean {
  const agora = Date.now();
  const balde = baldes.get(chave) ?? { marcas: [] };

  balde.marcas = balde.marcas.filter((t) => agora - t < janelaMs);
  balde.marcas.push(agora);
  baldes.set(chave, balde);

  // Evita o mapa crescer sem parar em execuções longas.
  if (baldes.size > 5000) {
    for (const [k, b] of baldes) {
      if (b.marcas.every((t) => agora - t >= janelaMs)) baldes.delete(k);
    }
  }

  return balde.marcas.length > limite;
}

/** Melhor palpite de IP atrás do proxy da Vercel. */
export function ipDaRequisicao(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "desconhecido"
  );
}
