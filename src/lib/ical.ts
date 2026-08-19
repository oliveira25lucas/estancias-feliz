/**
 * iCalendar (RFC 5545) — montar e ler arquivos `.ics`. Lógica pura.
 *
 * Mora separado de `airbnb.ts` (que fala com o Supabase e com a
 * internet) pelo mesmo motivo que `ocupacao.ts` mora separado de
 * `agenda.ts`: aqui dentro não há rede nem banco, então os testes
 * travam o formato exato do arquivo que a Airbnb vai ler — e, mais
 * importante, travam a conversão de datas que decide se o sítio vai
 * ser vendido duas vezes no mesmo fim de semana.
 *
 * ============================================================
 *  AS DUAS RÉGUAS
 * ============================================================
 *
 * O sítio e o iCalendar contam o fim de um período de um jeito
 * diferente, e é isso que faz esta integração ser perigosa.
 *
 *   iCalendar: DTEND é EXCLUSIVO. Um evento de 1 a 3 de setembro se
 *              escreve DTSTART=20260901, DTEND=20260904.
 *
 *   Sítio:     `data_checkout` é INCLUSIVO — o dia da saída conta como
 *              ocupado, porque o hóspede sai às 16h e ainda há limpeza
 *              e arrumação (veja `ocupacao.ts`).
 *
 * A conversão entre as duas vive em duas funções no fim deste arquivo,
 * `reservaParaEvento` e `eventoParaReserva`, e em lugar nenhum mais.
 * Quem for caçar um erro de um dia começa por elas.
 *
 * Ninguém de fora precisa pensar em DTEND: `EventoICS.fim` é sempre o
 * ÚLTIMO DIA COBERTO, inclusivo. O ±1 acontece dentro de `montarICS` e
 * de `lerICS`.
 */

import { somaDiasISO } from "./ocupacao.ts";

/**
 * Um evento de dia inteiro, na régua inclusiva.
 *
 * `fim` é o último dia que o evento cobre, não o dia seguinte. Um
 * evento de um dia só tem `inicio === fim`.
 */
export type EventoICS = {
  uid: string;
  /** Primeiro dia coberto, em ISO (aaaa-mm-dd). */
  inicio: string;
  /** ÚLTIMO dia coberto, em ISO. Inclusivo. */
  fim: string;
  resumo: string;
  descricao?: string;
};

const PROD_ID_PADRAO = "-//Sitio Estancias Feliz//Agenda//PT-BR";

/** RFC 5545 §3.1: nenhuma linha passa de 75 octetos. */
const LIMITE_OCTETOS = 75;

const CODIFICADOR = new TextEncoder();

// ============================================================
//  Texto: escape, dobra e desdobra
// ============================================================

/**
 * Escapa um valor TEXT (RFC 5545 §3.3.11).
 *
 * A contrabarra vem primeiro de propósito: escapar `;` antes de `\`
 * faria a contrabarra recém-criada ser escapada de novo, e o valor
 * chegaria dobrado do outro lado. Dois-pontos NÃO se escapa em TEXT.
 */
function escaparTexto(valor: string): string {
  return valor
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** O caminho de volta, para ler o que a Airbnb escreveu. */
function desescaparTexto(valor: string): string {
  let saida = "";
  for (let i = 0; i < valor.length; i++) {
    if (valor[i] !== "\\") {
      saida += valor[i];
      continue;
    }
    const proximo = valor[++i];
    if (proximo === "n" || proximo === "N") saida += "\n";
    else if (proximo === undefined) saida += "\\";
    else saida += proximo;
  }
  return saida;
}

/**
 * Dobra uma linha longa em várias, do jeito que a RFC manda: corta em
 * 75 OCTETOS (não caracteres) e começa a continuação com um espaço.
 *
 * Contar octeto e não caractere importa aqui: o sítio escreve em
 * português, e "Manutenção" ocupa mais bytes do que letras. Cortar por
 * caractere geraria linhas acima do limite, e cortar no meio de um
 * caractere de dois bytes geraria lixo.
 */
function dobrarLinha(linha: string): string {
  const partes: string[] = [];
  let atual = "";
  let octetos = 0;
  // A primeira linha usa os 75; as seguintes gastam 1 com o espaço.
  let limite = LIMITE_OCTETOS;

  for (const caractere of linha) {
    const tamanho = CODIFICADOR.encode(caractere).length;
    if (octetos + tamanho > limite) {
      partes.push(atual);
      atual = "";
      octetos = 0;
      limite = LIMITE_OCTETOS - 1;
    }
    atual += caractere;
    octetos += tamanho;
  }
  partes.push(atual);

  return partes.join("\r\n ");
}

/**
 * Desfaz a dobra antes de interpretar.
 *
 * Normaliza a quebra de linha primeiro: feed real chega com CRLF, mas
 * um arquivo que passou por editor de texto pode chegar só com LF, e
 * um parser que só conhece CRLF devolveria zero evento sem reclamar —
 * que é a falha mais cara possível aqui, porque parece "não tem
 * reserva nenhuma na Airbnb".
 */
function desdobrar(texto: string): string[] {
  return texto
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");
}

// ============================================================
//  Datas
// ============================================================

/** "2026-09-01" -> "20260901". */
function paraDataICS(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "");
}

/** "20260901" ou "20260901T140000Z" -> "2026-09-01". */
function deDataICS(bruto: string): string | null {
  const compacta = bruto.trim().slice(0, 8);
  if (!/^\d{8}$/.test(compacta)) return null;
  return `${compacta.slice(0, 4)}-${compacta.slice(4, 6)}-${compacta.slice(6, 8)}`;
}

/** DTSTAMP: "20260819T120000Z". */
function carimbo(momento: Date): string {
  return `${momento.toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;
}

// ============================================================
//  Montar
// ============================================================

export type OpcoesICS = {
  /** Nome que aparece para quem assina o calendário. */
  nome: string;
  /**
   * DTSTAMP de todos os eventos. Existe como parâmetro para o teste
   * poder fixar o valor — sem isso o arquivo mudaria a cada execução e
   * não daria para comparar com um esperado.
   */
  agora?: Date;
  prodId?: string;
};

/**
 * Monta o arquivo `.ics` inteiro.
 *
 * Tudo é evento de dia inteiro (`VALUE=DATE`). Hora não faria sentido
 * aqui: o que se está publicando é "estes dias não estão à venda", e
 * horário de entrada e saída é combinado com o cliente, não com o
 * calendário da Airbnb.
 */
export function montarICS(
  eventos: readonly EventoICS[],
  opcoes: OpcoesICS,
): string {
  const dtstamp = carimbo(opcoes.agora ?? new Date());

  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${opcoes.prodId ?? PROD_ID_PADRAO}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escaparTexto(opcoes.nome)}`,
    // Dica de quanto esperar antes de buscar de novo. A Airbnb usa o
    // ritmo dela (3h) e ignora isto, mas outros leitores respeitam.
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const evento of eventos) {
    linhas.push(
      "BEGIN:VEVENT",
      `UID:${escaparTexto(evento.uid)}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${paraDataICS(evento.inicio)}`,
      // O ±1 do fim acontece AQUI, e é o único lugar do lado da
      // escrita: `fim` chega inclusivo e DTEND sai exclusivo.
      `DTEND;VALUE=DATE:${paraDataICS(somaDiasISO(evento.fim, 1))}`,
      `SUMMARY:${escaparTexto(evento.resumo)}`,
    );
    if (evento.descricao) {
      linhas.push(`DESCRIPTION:${escaparTexto(evento.descricao)}`);
    }
    // TRANSP:OPAQUE diz "este período está ocupado". É o que faz o
    // evento bloquear em vez de só aparecer no calendário.
    linhas.push("TRANSP:OPAQUE", "END:VEVENT");
  }

  linhas.push("END:VCALENDAR");

  // CRLF em tudo, inclusive no fim do arquivo: a RFC exige, e leitor
  // rigoroso rejeita arquivo terminado em LF puro.
  return linhas.map(dobrarLinha).join("\r\n") + "\r\n";
}

// ============================================================
//  Ler
// ============================================================

/** Separa "NOME;PARAM=X:VALOR" nas três partes. */
function partirLinha(
  linha: string,
): { nome: string; parametros: string; valor: string } | null {
  let dentroDeAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') dentroDeAspas = !dentroDeAspas;
    else if (c === ":" && !dentroDeAspas) {
      const cabeca = linha.slice(0, i);
      const ponto = cabeca.indexOf(";");
      return {
        nome: (ponto === -1 ? cabeca : cabeca.slice(0, ponto)).toUpperCase(),
        parametros: ponto === -1 ? "" : cabeca.slice(ponto + 1).toUpperCase(),
        valor: linha.slice(i + 1),
      };
    }
  }
  return null;
}

/**
 * Lê um `.ics` e devolve os eventos, na régua inclusiva do sítio.
 *
 * Tolerante de propósito: evento sem UID ou sem DTSTART é descartado
 * em silêncio em vez de derrubar a leitura inteira. Um feed com um
 * evento estranho não pode fazer o sítio perder as outras vinte
 * reservas — o custo de ignorar um é muito menor que o de ignorar
 * todos.
 */
export function lerICS(texto: string): EventoICS[] {
  const eventos: EventoICS[] = [];
  let atual: Partial<EventoICS> & { dtend?: string; dtendData?: boolean } | null =
    null;

  for (const linha of desdobrar(texto)) {
    const bruta = linha.trim();
    if (!bruta) continue;

    if (bruta.toUpperCase() === "BEGIN:VEVENT") {
      atual = {};
      continue;
    }

    if (bruta.toUpperCase() === "END:VEVENT") {
      if (atual?.uid && atual.inicio) {
        eventos.push({
          uid: atual.uid,
          inicio: atual.inicio,
          fim: fimDoEvento(atual.inicio, atual.dtend, atual.dtendData),
          resumo: atual.resumo ?? "",
          ...(atual.descricao ? { descricao: atual.descricao } : {}),
        });
      }
      atual = null;
      continue;
    }

    if (!atual) continue;

    const partes = partirLinha(bruta);
    if (!partes) continue;

    switch (partes.nome) {
      case "UID":
        atual.uid = desescaparTexto(partes.valor).trim();
        break;
      case "DTSTART": {
        const data = deDataICS(partes.valor);
        if (data) atual.inicio = data;
        break;
      }
      case "DTEND": {
        const data = deDataICS(partes.valor);
        if (data) {
          atual.dtend = data;
          // `VALUE=DATE` é dia inteiro, e aí DTEND é exclusivo. Sem o
          // parâmetro é DATE-TIME: um instante, que pertence ao dia em
          // que acontece. Os dois casos aparecem em feed real.
          atual.dtendData =
            partes.parametros.includes("VALUE=DATE") ||
            !partes.valor.includes("T");
        }
        break;
      }
      case "SUMMARY":
        atual.resumo = desescaparTexto(partes.valor).trim();
        break;
      case "DESCRIPTION":
        atual.descricao = desescaparTexto(partes.valor).trim();
        break;
    }
  }

  return eventos;
}

/**
 * DTEND (exclusivo, quando é dia inteiro) vira o último dia coberto.
 *
 * Sem DTEND o evento dura um dia — é o que a RFC manda para dia
 * inteiro, e é o que alguns feeds mandam em bloqueio de um dia só.
 */
function fimDoEvento(
  inicio: string,
  dtend: string | undefined,
  dtendEhData: boolean | undefined,
): string {
  if (!dtend) return inicio;
  const fim = dtendEhData ? somaDiasISO(dtend, -1) : dtend;
  // Feed malformado com DTEND antes do DTSTART não pode gerar período
  // invertido, que quebraria o cálculo de dias ocupados.
  return fim < inicio ? inicio : fim;
}

// ============================================================
//  A ponte entre as duas réguas
//
//  Estas duas funções são o coração do risco desta integração. Elas
//  traduzem entre o `data_checkout` INCLUSIVO do sítio e o dia de
//  check-out da Airbnb, que na régua deles já está livre para o
//  próximo hóspede entrar.
//
//  Errar um dia aqui tem dois desfechos, os dois ruins:
//
//    para menos — a Airbnb libera o dia da saída para outra pessoa
//                 entrar, e a Maurizia encontra hóspede novo chegando
//                 sobre a limpeza do anterior;
//    para mais  — o sítio bloqueia um dia que estava à venda, e perde
//                 diária sem ninguém perceber.
//
//  Por isso ficam juntas, nomeadas, e travadas por teste.
// ============================================================

/**
 * Reserva do sítio → evento de calendário.
 *
 * Direto: `data_checkout` do sítio JÁ É o último dia ocupado, que é
 * exatamente o que `EventoICS.fim` quer dizer. O ±1 para DTEND é
 * problema de `montarICS`.
 *
 * O efeito prático do lado da Airbnb é o certo: uma reserva de 01 a 03
 * bloqueia 1, 2 e 3, e libera entrada no dia 4.
 */
export function reservaParaEvento(
  reserva: { data_checkin: string; data_checkout: string },
  dados: { uid: string; resumo: string; descricao?: string },
): EventoICS {
  return {
    uid: dados.uid,
    inicio: reserva.data_checkin,
    fim: reserva.data_checkout,
    resumo: dados.resumo,
    ...(dados.descricao ? { descricao: dados.descricao } : {}),
  };
}

/**
 * Evento de RESERVA da Airbnb → datas do sítio.
 *
 * Aqui entra o dia a mais, e ele é deliberado. `evento.fim` é a última
 * NOITE dormida; o hóspede vai embora no dia seguinte. Na régua do
 * sítio esse dia da saída conta como ocupado, porque é o dia da
 * limpeza — então `data_checkout` é `fim + 1`.
 *
 * Exemplo: a Airbnb manda DTSTART=10/09, DTEND=12/09. O hóspede dorme
 * 10 e 11 e sai dia 12. O sítio grava check-in 10, check-out 12, e
 * fica ocupado nos dias 10, 11 e 12.
 *
 * Vale só para RESERVA. Bloqueio não tem hóspede indo embora, então
 * não ganha dia de limpeza — veja `bloqueioParaPeriodo`.
 */
export function eventoParaReserva(evento: EventoICS): {
  data_checkin: string;
  data_checkout: string;
} {
  return {
    data_checkin: evento.inicio,
    data_checkout: somaDiasISO(evento.fim, 1),
  };
}

/**
 * Evento de BLOQUEIO da Airbnb → período bloqueado no sítio.
 *
 * Sem dia extra: ninguém está saindo, não há limpeza a proteger. O
 * anfitrião fechou aqueles dias na Airbnb e são exatamente aqueles
 * dias que o sítio precisa fechar.
 */
export function bloqueioParaPeriodo(evento: EventoICS): {
  data_inicio: string;
  data_fim: string;
} {
  return { data_inicio: evento.inicio, data_fim: evento.fim };
}

// ============================================================
//  A agenda do sítio como calendário publicável
//
//  O QUE SAI DAQUI VAI PARA FORA DE CASA. A Airbnb busca esta lista
//  sem autenticação nenhuma, de um servidor que não é nosso. Por isso
//  o resumo de todo evento é uma palavra fixa: nem nome, nem telefone,
//  nem valor, nem o motivo do bloqueio.
//
//  É o mesmo critério da /api/agenda, que é pública e devolve só
//  datas. Quem lê isto precisa saber que o dia não está à venda, não
//  quem está no sítio naquele dia.
// ============================================================

/** O que uma reserva precisa ter para virar evento. Subconjunto de `Reserva`. */
export type ReservaCalendario = {
  id: string;
  data_checkin: string | null;
  data_checkout: string | null;
  status: string | null;
  origem: string | null;
};

/** Subconjunto de `DatasBloqueadas`. */
export type BloqueioCalendario = {
  id: string;
  data_inicio: string;
  data_fim: string;
  origem: string | null;
};

/** Domínio do UID. Precisa ser estável: é a identidade do evento. */
const DOMINIO_UID = "estanciasfeliz.com.br";

/**
 * Converte a agenda em eventos prontos para publicar.
 *
 * DUAS EXCLUSÕES, as duas importantes:
 *
 *   CANCELADA não vai. Cancelada não ocupa data — é a mesma regra de
 *   `agendaOcupada`, e mandá-la faria a Airbnb segurar um fim de
 *   semana que voltou a estar à venda.
 *
 *   origem 'airbnb' não vai. Isso é o que impede o laço: o que veio da
 *   Airbnb não pode voltar para a Airbnb. Sem este filtro, cada
 *   importação alimentaria a exportação seguinte, e o dia de limpeza
 *   que o sítio acrescenta iria empilhando um dia a cada volta até o
 *   calendário inteiro estar bloqueado.
 *
 * O dia de preparo entre um hóspede e outro NÃO se resolve aqui, pelo
 * mesmo motivo. Resolve-se no ajuste "tempo de preparo" da própria
 * Airbnb, que faz isso nativamente e sem laço.
 */
export function eventosDaAgenda(
  reservas: readonly ReservaCalendario[],
  bloqueios: readonly BloqueioCalendario[],
): EventoICS[] {
  const eventos: EventoICS[] = [];

  for (const r of reservas) {
    if (r.origem === "airbnb") continue;
    if (r.status === "CANCELADA") continue;
    if (!r.data_checkin || !r.data_checkout) continue;

    eventos.push(
      reservaParaEvento(
        { data_checkin: r.data_checkin, data_checkout: r.data_checkout },
        { uid: `reserva-${r.id}@${DOMINIO_UID}`, resumo: "Reservado" },
      ),
    );
  }

  for (const b of bloqueios) {
    if (b.origem === "airbnb") continue;
    if (!b.data_inicio || !b.data_fim) continue;

    eventos.push({
      uid: `bloqueio-${b.id}@${DOMINIO_UID}`,
      inicio: b.data_inicio,
      // Bloqueio já é inclusivo nas duas pontas no banco, que é
      // exatamente o que `EventoICS.fim` quer dizer.
      fim: b.data_fim,
      // O motivo NÃO entra: "Aniversário da Ana" é dado de família.
      resumo: "Indisponível",
    });
  }

  return eventos.sort((a, b) => a.inicio.localeCompare(b.inicio));
}
