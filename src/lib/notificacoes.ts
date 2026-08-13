/**
 * Textos dos avisos automáticos de WhatsApp — lógica pura, sem banco.
 *
 * Mora separado de `avisos.ts` (que fala com o Supabase e com a Evolution)
 * pelo mesmo motivo que `ocupacao.ts` mora separado de `agenda.ts`: aqui
 * dentro não há rede nem banco, então os testes travam o texto exato que
 * chega no celular dos donos e da faxineira.
 *
 * Formatação é a do WhatsApp, não markdown: *negrito*, _itálico_,
 * ~riscado~. Asterisco duplo não vira negrito lá — vira asterisco.
 *
 * Regra de quando avisar mora em `avisos.ts`: avisa quando a reserva
 * ENTRA em CONFIRMADA e quando SAI de CONFIRMADA. Reserva que nasce e
 * morre em PENDENTE_CONTRATO nunca gera aviso, senão a Maurizia é
 * chamada por causa de contrato que não fechou.
 */

/**
 * A importação abaixo leva `.ts` de propósito: este arquivo é carregado
 * pelo `node --test`, que resolve ESM sem adivinhar extensão. Sem ela o
 * teste morre em ERR_MODULE_NOT_FOUND. Os arquivos que só rodam dentro do
 * Next continuam importando sem extensão.
 */
import {
  CAUCAO,
  diffDias,
  formatarBRL,
  formatarDataBR,
  getDiaSemana,
  nomeDiaSemana,
} from "./pricing.ts";

/** Abreviação por dia da semana, indexada por `getDay()` (0 = domingo). */
const DIA_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

const LINHA = "────────────────────";

/**
 * O que um aviso precisa saber de uma reserva. É um subconjunto de
 * `Reserva` (src/lib/supabase.ts) de propósito: assim este arquivo não
 * importa o cliente do Supabase e continua rodando no `node --test`.
 */
export type ReservaAviso = {
  id: string;
  nome_cliente: string | null;
  data_checkin: string | null;
  data_checkout: string | null;
  qtd_pessoas: number | null;
  /** Vem como texto do banco (o n8n gravava string). Converter antes de somar. */
  valor_final: string | number | null;
  status: string | null;
};

/** Reserva que já passou pelo filtro de datas — as duas pontas existem. */
export type ReservaComData = ReservaAviso & {
  data_checkin: string;
  data_checkout: string;
};

/** Sem as duas datas não há período para anunciar. */
export function temDatas(r: ReservaAviso): r is ReservaComData {
  return Boolean(r.data_checkin && r.data_checkout);
}

function diaCurto(iso: string): string {
  return DIA_CURTO[getDiaSemana(iso)];
}

/** "20/11 a 22/11 · sex a dom" — o ano fica no cabeçalho do grupo. */
function periodoCurto(checkin: string, checkout: string): string {
  const inicio = formatarDataBR(checkin).slice(0, 5);
  const fim = formatarDataBR(checkout).slice(0, 5);
  return `${inicio} a ${fim} · ${diaCurto(checkin)} a ${diaCurto(checkout)}`;
}

/** "sexta, 20/11/2026" — para quem precisa da data sem contar no calendário. */
function dataFalada(iso: string): string {
  return `${nomeDiaSemana(iso).toLowerCase()}, ${formatarDataBR(iso)}`;
}

function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * Cabeçalho de uma reserva: período em negrito e, embaixo, quem e quantos.
 *
 * VALOR NÃO ENTRA EM AVISO INTERNO. Nem para o grupo dos donos, nem para a
 * faxineira. O grupo é agenda, não financeiro, e mensagem de WhatsApp é
 * encaminhada com um toque — quem precisa do valor abre o painel, onde ele
 * está do lado do resto. (As mensagens de lead mais abaixo são outra
 * história: ali o valor aparece porque quem recebe é o próprio cliente,
 * que acabou de ver o número na tela do site.)
 *
 * `ReservaAviso` continua carregando `valor_final` de propósito: é o dado
 * disponível que a gente escolhe não imprimir, e é isso que o teste "o
 * valor nunca sai em aviso interno" trava. Sem o campo ali, ele não
 * testaria nada.
 *
 * Campo vazio simplesmente não aparece — reserva da Júlia costuma vir sem
 * quantidade de pessoas.
 */
function blocoReserva(r: ReservaComData): string {
  const dias = diffDias(r.data_checkin, r.data_checkout);
  const linhas = [
    `*${formatarDataBR(r.data_checkin)} a ${formatarDataBR(r.data_checkout)}*` +
      ` · ${diaCurto(r.data_checkin)} a ${diaCurto(r.data_checkout)}` +
      ` · ${plural(dias, "diária", "diárias")}`,
  ];

  const detalhes: string[] = [];
  if (r.nome_cliente?.trim()) detalhes.push(r.nome_cliente.trim());
  if (r.qtd_pessoas) detalhes.push(plural(r.qtd_pessoas, "pessoa", "pessoas"));

  if (detalhes.length > 0) linhas.push(detalhes.join(" · "));
  return linhas.join("\n");
}

/**
 * A agenda inteira do que ainda vai acontecer, agrupada por ano.
 *
 * `destaqueId` põe uma linha em negrito com a seta — é o "deu ênfase no
 * que entrou" do pedido. Quem chegou fica óbvio sem ler o cabeçalho.
 */
export function listaAgenda(
  futuras: ReservaAviso[],
  destaqueId?: string,
): string {
  const comData = futuras
    .filter(temDatas)
    .sort((a, b) => a.data_checkin.localeCompare(b.data_checkin));

  if (comData.length === 0) {
    return "*PRÓXIMOS ALUGUÉIS*\n\n_A agenda está vazia daqui pra frente._";
  }

  const linhas = [`*PRÓXIMOS ALUGUÉIS — ${comData.length} no total*`];
  let anoImpresso = "";

  for (const r of comData) {
    const ano = r.data_checkin.slice(0, 4);
    if (ano !== anoImpresso) {
      anoImpresso = ano;
      linhas.push("", `*${ano}*`);
    }

    let linha = `• ${periodoCurto(r.data_checkin, r.data_checkout)}`;
    if (r.status === "PENDENTE_CONTRATO") linha += " (aguardando contrato)";
    linhas.push(r.id === destaqueId ? `*${linha}  ⬅️ NOVO*` : linha);
  }

  return linhas.join("\n");
}

// ============================================================
//  Grupo dos donos
// ============================================================

export function mensagemNovaParaGrupo(
  nova: ReservaComData,
  futuras: ReservaAviso[],
): string {
  return [
    "*🏡 AGENDA SÍTIO — ENTROU ALUGUEL NOVO*",
    "",
    blocoReserva(nova),
    "",
    LINHA,
    listaAgenda(futuras, nova.id),
  ].join("\n");
}

export function mensagemCanceladaParaGrupo(
  cancelada: ReservaComData,
  futuras: ReservaAviso[],
): string {
  const quem = cancelada.nome_cliente?.trim();
  return [
    "*🏡 AGENDA SÍTIO — ALUGUEL CANCELADO*",
    "",
    `~*${formatarDataBR(cancelada.data_checkin)} a ${formatarDataBR(cancelada.data_checkout)}*~` +
      ` · ${diaCurto(cancelada.data_checkin)} a ${diaCurto(cancelada.data_checkout)}`,
    quem
      ? `${quem} · a data voltou a ficar livre`
      : "A data voltou a ficar livre",
    "",
    LINHA,
    // A cancelada já saiu da lista: `futuras` só traz o que ocupa data.
    listaAgenda(futuras),
  ].join("\n");
}

/**
 * Lembrete de 7 dias no grupo. Vai curto de propósito: os donos já
 * receberam a agenda completa quando o aluguel entrou, aqui o assunto
 * é uma data só.
 */
export function mensagemLembreteParaGrupo(
  r: ReservaComData,
  avisouFaxineira: boolean,
): string {
  const linhas = [
    "*🏡 SÍTIO — FALTA 1 SEMANA*",
    "",
    blocoReserva(r),
    "",
    `Entrada ${dataFalada(r.data_checkin)}.`,
  ];
  if (avisouFaxineira) linhas.push("A Maurizia já recebeu o lembrete da limpeza.");
  return linhas.join("\n");
}

// ============================================================
//  Faxineira
//
//  Texto de gente, não de sistema: ela recebe isso como mensagem
//  pessoal. Sem emoji de robô, sem "mensagem automática", e sempre
//  com os horários que valem (8h de entrada, 16h de saída).
// ============================================================

/**
 * O aviso não estipula prazo de limpeza. Já teve uma linha aqui dizendo
 * "a casa precisa estar pronta até <véspera>", deduzida do check-in de 8h,
 * e ela saiu: quando a Maurizia limpa é combinado entre ela e o Lucas, não
 * é regra do sistema. Aviso automático dá o fato (as datas) e não dá ordem.
 */
function blocoDatas(r: ReservaComData): string[] {
  const linhas = [
    `*Entrada:* ${dataFalada(r.data_checkin)}, 8h`,
    `*Saída:* ${dataFalada(r.data_checkout)}, 16h`,
  ];
  if (r.qtd_pessoas) linhas.push(`*Pessoas:* ${r.qtd_pessoas}`);
  return linhas;
}

export function mensagemNovaParaFaxineira(
  nova: ReservaComData,
  futuras: ReservaAviso[],
): string {
  return [
    "Oi, Maurizia! Tudo bem? 🏡",
    "",
    "Entrou um aluguel novo no sítio:",
    "",
    ...blocoDatas(nova),
    "",
    "Te mando um lembrete 7 dias antes também.",
    "",
    LINHA,
    listaAgenda(futuras, nova.id),
  ].join("\n");
}

export function mensagemCanceladaParaFaxineira(
  cancelada: ReservaComData,
  futuras: ReservaAviso[],
): string {
  return [
    "Oi, Maurizia! 🏡",
    "",
    "O aluguel abaixo foi *cancelado*, não precisa se preparar pra ele:",
    "",
    `~${formatarDataBR(cancelada.data_checkin)} a ${formatarDataBR(cancelada.data_checkout)}~`,
    "",
    LINHA,
    listaAgenda(futuras),
  ].join("\n");
}

export function mensagemLembreteParaFaxineira(r: ReservaComData): string {
  return [
    "Oi, Maurizia! ⏳",
    "",
    "*Falta 1 semana* para o próximo aluguel do sítio:",
    "",
    ...blocoDatas(r),
    "",
    "Consegue confirmar a limpeza pra mim?",
  ].join("\n");
}

// ============================================================
//  Lead do site
//
//  Estas duas mensagens são as ÚNICAS que saem para um cliente sem que
//  ele tenha escrito primeiro. Por isso o tom é de pessoa retomando um
//  assunto que a própria pessoa começou — ela acabou de digitar o número
//  dela num formulário nosso — e nunca de propaganda.
//
//  A retomada carrega uma saída explícita ("me fala que eu paro"). É
//  educação, e é também o que segura o número: quem tem como pedir para
//  parar não denuncia.
// ============================================================

/**
 * O que uma mensagem de lead precisa saber. Subconjunto de `Orcamento`
 * (src/lib/supabase.ts), para este arquivo seguir sem importar Supabase.
 */
export type LeadAviso = {
  nome: string;
  checkin: string | null;
  checkout: string | null;
  pessoas: number | null;
  ocasiao: string | null;
  /** Numérico no banco, mas o n8n já gravou string em tabela vizinha. */
  valor_calculado: string | number | null;
  hidromassagem: boolean | null;
  periodo_desejado: string | null;
  /** `null` quando não deu para conferir a agenda na hora do orçamento. */
  disponivel?: boolean | null;
};

/** Lead que escolheu data. É o que permite recapitular período e valor. */
export type LeadComData = LeadAviso & { checkin: string; checkout: string };

export function leadTemData(l: LeadAviso): l is LeadComData {
  return Boolean(l.checkin && l.checkout);
}

/** "Maria Aparecida da Silva" -> "Maria". Ninguém chama pelo nome inteiro. */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || nome.trim();
}

function valorEmReais(l: LeadAviso): string | null {
  const n = Number(l.valor_calculado);
  return Number.isFinite(n) && n > 0 ? formatarBRL(n) : null;
}

/** "20 pessoas · Aniversário", pulando o que a pessoa não informou. */
function quemEQuando(l: LeadAviso): string | null {
  const partes: string[] = [];
  if (l.pessoas) partes.push(plural(l.pessoas, "pessoa", "pessoas"));
  if (l.ocasiao?.trim()) partes.push(l.ocasiao.trim());
  return partes.length > 0 ? partes.join(" · ") : null;
}

/**
 * A primeira mensagem, disparada assim que a pessoa vira lead.
 * Recapitula o que ela acabou de ver na tela — o valor fica registrado na
 * conversa, e é dele que a Júlia parte quando a pessoa responder.
 */
export function mensagemLeadNovo(l: LeadAviso): string {
  const linhas = [
    `Oi, ${primeiroNome(l.nome)}! Tudo bem? 🏡`,
    "",
    "Aqui é a Júlia, do Sítio Estâncias Feliz. Vi que você acabou de fazer um orçamento no nosso site:",
    "",
  ];

  if (leadTemData(l)) {
    linhas.push(
      `*${formatarDataBR(l.checkin)} a ${formatarDataBR(l.checkout)}* · ${diaCurto(l.checkin)} a ${diaCurto(l.checkout)}`,
    );
    const detalhe = quemEQuando(l);
    if (detalhe) linhas.push(detalhe);
    if (l.hidromassagem) linhas.push("Com hidromassagem");

    const valor = valorEmReais(l);
    if (valor) {
      linhas.push(
        "",
        `*${valor}* pela estadia`,
        `+ ${formatarBRL(CAUCAO)} de caução, que volta integral no final.`,
      );
    }

    linhas.push("");
    if (l.disponivel === true) {
      linhas.push(
        "Essa data ainda está livre. Ficou alguma dúvida, ou já posso segurar ela pra você?",
      );
    } else {
      linhas.push(
        "Ficou alguma dúvida, ou já posso confirmar essa data pra você?",
      );
    }
  } else {
    const detalhe = quemEQuando(l);
    if (detalhe) linhas.push(detalhe);
    if (l.periodo_desejado?.trim()) {
      linhas.push(`Época pretendida: ${l.periodo_desejado.trim()}`);
    }
    linhas.push(
      "",
      "Me fala uma data que você tem em mente e eu já te digo na hora se está livre e quanto fica. Quer que eu te mande os fins de semana que ainda tenho abertos?",
    );
  }

  return linhas.join("\n");
}

/**
 * A retomada do dia seguinte, para quem não respondeu a primeira.
 * Curta de propósito: quem não respondeu ontem não vai ler textão hoje.
 */
export function mensagemLeadRetomada(l: LeadAviso): string {
  const linhas = [
    `Oi, ${primeiroNome(l.nome)}! A Júlia de novo, do Sítio Estâncias Feliz 🌿`,
    "",
  ];

  if (leadTemData(l)) {
    linhas.push(
      `Passei pra saber se você chegou a ver minha mensagem sobre *${formatarDataBR(l.checkin)} a ${formatarDataBR(l.checkout)}*.`,
    );
    if (l.disponivel === true) linhas.push("A data continua livre por aqui.");
  } else {
    linhas.push(
      "Passei pra saber se você já pensou numa data para o sítio.",
    );
  }

  linhas.push(
    "",
    "Se quiser, me manda sua dúvida que eu respondo na hora. E se não for mais o caso, é só me falar que eu não te incomodo mais. 🙂",
  );

  return linhas.join("\n");
}

/**
 * O contexto que a Júlia recebe quando a pessoa responder.
 *
 * Vai para `sessoes.historico_resumido`, que o workflow do n8n carrega
 * pelo telefone e injeta no prompt como "Conversa até agora". Sem isto a
 * Júlia começaria do zero — perguntando data e número de pessoas para
 * alguém que acabou de informar as duas no site, que é a forma mais
 * rápida de a pessoa perceber que está falando com um robô.
 */
export function contextoDoLeadParaJulia(l: LeadAviso, hoje: string): string {
  const linhas = [
    `[${formatarDataBR(hoje)} · vindo do site]`,
    `${l.nome} preencheu a calculadora de orçamento no site.`,
  ];

  if (leadTemData(l)) {
    linhas.push(
      `Período pedido: ${formatarDataBR(l.checkin)} a ${formatarDataBR(l.checkout)}.`,
    );
    const valor = valorEmReais(l);
    if (valor) {
      linhas.push(
        `Valor que o sistema mostrou para ela na tela: ${valor} (+ ${formatarBRL(CAUCAO)} de caução).`,
      );
    }
    if (l.disponivel === false) {
      linhas.push("ATENÇÃO: esse período NÃO estava livre na conferência.");
    }
  } else {
    linhas.push(
      `Ainda não escolheu data. Época pretendida: ${l.periodo_desejado?.trim() || "não informou"}.`,
    );
  }

  if (l.pessoas) linhas.push(`Pessoas: ${l.pessoas}.`);
  if (l.ocasiao?.trim()) linhas.push(`Ocasião: ${l.ocasiao.trim()}.`);
  if (l.hidromassagem) linhas.push("Quer hidromassagem.");

  linhas.push(
    "A Júlia já mandou a primeira mensagem recapitulando isso e perguntando se pode prosseguir.",
    "NÃO peça de novo data nem número de pessoas: ela já informou tudo acima.",
  );

  return linhas.join("\n");
}
