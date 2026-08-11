/**
 * Motor de cálculo de diárias do Sítio Estâncias Feliz.
 *
 * Este arquivo é a ÚNICA fonte de verdade sobre preço. O site e o agente
 * de IA do WhatsApp (Júlia) consultam daqui — a Júlia através da rota
 * `/api/orcamento/calcular`. Nenhum valor deve ser calculado em prompt
 * ou duplicado no n8n: preço divergente entre canais é a forma mais
 * rápida de perder a confiança do cliente.
 *
 * Três regras de negócio moram aqui:
 *
 * 1. REAJUSTE ANUAL — todo 1º de janeiro os valores sobem 10% sobre a
 *    tabela de 2026. A caução não reajusta: é depósito, não preço.
 *
 * 2. FERIADOS SÃO CALCULADOS, NÃO DIGITADOS — as datas móveis saem do
 *    algoritmo da Páscoa. A tabela antiga, escrita à mão, errava o
 *    Carnaval de 2027 em quatro dias.
 *
 * 3. BLOCO OBRIGATÓRIO — feriado não se aluga por diária solta. O dia da
 *    semana em que o feriado cai define o período fechado que o cliente
 *    precisa levar.
 */

// ============================================================
//  Reajuste anual
// ============================================================

export const ANO_BASE = 2026;
export const REAJUSTE_ANUAL = 0.1;

/** Quanto multiplicar a tabela de 2026 para chegar no ano pedido. */
export function fatorAno(ano: number): number {
  return Math.pow(1 + REAJUSTE_ANUAL, Math.max(0, ano - ANO_BASE));
}

/** Aplica o reajuste e arredonda para a dezena, para não gerar centavos. */
export function comReajuste(valorBase: number, ano: number): number {
  return Math.round((valorBase * fatorAno(ano)) / 10) * 10;
}

// ============================================================
//  Tabela de 2026 (valores-base)
// ============================================================

export const ESTADIA_FDS = 3350; // sexta a domingo, 2 diárias
export const ESTADIA_CURTA = 2350; // 1 diária, entrando sexta ou sábado
export const ESTADIA_DIARIA = 2000; // diária avulsa de segunda a quinta

export const EVENTO_PRIMEIRO_DIA = 1000;
export const EVENTO_DIA_EXTRA = 700;

export const HIDROMASSAGEM_DIARIA = 150;

/** Depósito de segurança, devolvido ao final. Não sofre reajuste. */
export const CAUCAO = 500;

/** Valor base do evento conforme o número de convidados (acima de 30). */
export const EVENTO_BASE = [
  { ate: 50, valor: 2200 },
  { ate: 75, valor: 2750 },
  { ate: 100, valor: 3080 },
  { ate: 150, valor: 3750 },
  { ate: 200, valor: 4180 },
  { ate: 999, valor: 4800 },
];

/**
 * Pacotes de feriado, em reais de 2026.
 *
 * Inclui os municipais da região de onde vem a maior parte dos hóspedes:
 * Belo Horizonte (Assunção e Imaculada Conceição), Sarzedo e Ibirité.
 */
const PACOTES_FERIADO: Record<string, number> = {
  // Nacionais e móveis
  Carnaval: 5000,
  "Semana Santa": 4500,
  Tiradentes: 5000,
  "Dia do Trabalho": 3600,
  "Corpus Christi": 4500,
  Independência: 4500,
  "N. S. Aparecida": 4500,
  Finados: 4500,
  "Consciência Negra": 3600,
  Natal: 6000,
  Réveillon: 12500,

  // Municipais
  "Imaculada Conceição": 5000, // 08/12 — feriado municipal de BH
  "N. S. da Assunção": 3600, // 15/08 — feriado municipal de BH
  "Aniversário de Ibirité": 3600, // 01/03
  "N. S. das Graças": 3600, // 27/11 — padroeira de Ibirité
  "Aniversário de Sarzedo": 3600, // 21/12
};

// ============================================================
//  Datas
// ============================================================

const DIAS_SEMANA = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

/**
 * Constrói a data no fuso local a partir de "YYYY-MM-DD".
 * `new Date("2026-08-14")` seria lido como UTC e voltaria um dia no
 * Brasil — trocaria sexta por quinta e mudaria o preço.
 */
function parseData(dateStr: string): Date {
  const [ano, mes, dia] = dateStr.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

function paraISO(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function somaDias(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function diffDias(checkin: string, checkout: string): number {
  const ms = parseData(checkout).getTime() - parseData(checkin).getTime();
  return Math.round(ms / 86_400_000);
}

export function getDiaSemana(dateStr: string): number {
  return parseData(dateStr).getDay();
}

export function nomeDiaSemana(dateStr: string): string {
  return DIAS_SEMANA[getDiaSemana(dateStr)];
}

export function formatarBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function formatarDataBR(iso: string): string {
  if (!iso) return "";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

// ============================================================
//  Feriados
// ============================================================

/** Domingo de Páscoa pelo algoritmo de Meeus/Jones/Butcher. */
function domingoDePascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

export type Feriado = {
  nome: string;
  /** O dia do feriado em si (YYYY-MM-DD). */
  data: string;
  /** Início do bloco fechado que o cliente precisa levar. */
  inicio: string;
  /** Fim do bloco (data de saída). */
  fim: string;
  /** Valor do pacote já com o reajuste do ano aplicado. */
  preco: number;
  /**
   * Entrada alternativa mais cedo, quando existe. Feriado na terça aceita
   * entrar na sexta ou no sábado; o bloco mínimo é o sábado.
   */
  inicioAlternativo?: string;
};

/**
 * Bloco obrigatório conforme o dia da semana do feriado.
 *
 * Regras definidas pelo proprietário:
 *   quinta  -> quinta a domingo
 *   sexta   -> sexta a domingo
 *   sábado  -> sexta a domingo (o fim de semana já cobre)
 *   domingo -> sexta a domingo (mesma lógica do sábado)
 *   segunda -> sexta a segunda
 *   terça   -> sábado a terça (sexta a terça também é aceito)
 *   quarta  -> não forma pacote; vale a diária comum de semana
 */
type Bloco = { inicio: Date; fim: Date; inicioAlternativo?: Date };

function blocoDoFeriado(data: Date): Bloco | null {
  switch (data.getDay()) {
    case 4: // quinta
      return { inicio: data, fim: somaDias(data, 3) };
    case 5: // sexta
      return { inicio: data, fim: somaDias(data, 2) };
    case 6: // sábado
      return { inicio: somaDias(data, -1), fim: somaDias(data, 1) };
    case 0: // domingo
      return { inicio: somaDias(data, -2), fim: data };
    case 1: // segunda
      return { inicio: somaDias(data, -3), fim: data };
    case 2: // terça
      return {
        inicio: somaDias(data, -3), // sábado
        fim: data,
        inicioAlternativo: somaDias(data, -4), // sexta
      };
    default: // quarta
      return null;
  }
}

/**
 * Feriados que não seguem a regra de dia da semana, por decisão do
 * proprietário: Carnaval vai de sexta à quarta de cinzas, e Natal e
 * Réveillon são períodos longos e fechados.
 */
const BLOCOS_FIXOS: Record<string, (data: Date, ano: number) => Bloco> = {
  // A terça de Carnaval puxa a sexta anterior e solta na quarta de cinzas.
  Carnaval: (data) => ({
    inicio: somaDias(data, -4),
    fim: somaDias(data, 1),
  }),
  Natal: (_data, ano) => ({
    inicio: new Date(ano, 11, 23),
    fim: new Date(ano, 11, 28),
  }),
  Réveillon: (_data, ano) => ({
    inicio: new Date(ano, 11, 29),
    fim: new Date(ano + 1, 0, 2),
  }),
};

/** Todos os feriados de um ano, com bloco e preço já reajustado. */
export function feriadosDoAno(ano: number): Feriado[] {
  const pascoa = domingoDePascoa(ano);

  const datas: [string, Date][] = [
    // Móveis, derivados da Páscoa
    ["Carnaval", somaDias(pascoa, -47)],
    ["Semana Santa", somaDias(pascoa, -2)], // Sexta-feira Santa
    ["Corpus Christi", somaDias(pascoa, 60)],

    // Nacionais de data fixa
    ["Tiradentes", new Date(ano, 3, 21)],
    ["Dia do Trabalho", new Date(ano, 4, 1)],
    ["Independência", new Date(ano, 8, 7)],
    ["N. S. Aparecida", new Date(ano, 9, 12)],
    ["Finados", new Date(ano, 10, 2)],
    ["Consciência Negra", new Date(ano, 10, 20)],
    ["Natal", new Date(ano, 11, 25)],
    ["Réveillon", new Date(ano, 11, 31)],

    // Municipais da região dos hóspedes
    ["Aniversário de Ibirité", new Date(ano, 2, 1)], // 01/03
    ["N. S. da Assunção", new Date(ano, 7, 15)], // 15/08, BH
    ["N. S. das Graças", new Date(ano, 10, 27)], // 27/11, Ibirité
    ["Imaculada Conceição", new Date(ano, 11, 8)], // 08/12, BH
    ["Aniversário de Sarzedo", new Date(ano, 11, 21)], // 21/12
  ];

  const resultado: Feriado[] = [];

  for (const [nome, data] of datas) {
    const fixo = BLOCOS_FIXOS[nome];
    const bloco = fixo ? fixo(data, ano) : blocoDoFeriado(data);
    // Feriado em quarta-feira não vira pacote.
    if (!bloco) continue;

    const alternativo = bloco.inicioAlternativo;

    resultado.push({
      nome,
      data: paraISO(data),
      inicio: paraISO(bloco.inicio),
      fim: paraISO(bloco.fim),
      preco: comReajuste(PACOTES_FERIADO[nome], ano),
      ...(alternativo ? { inicioAlternativo: paraISO(alternativo) } : {}),
    });
  }

  return resultado.sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/**
 * Acha o feriado cujo bloco se sobrepõe ao período pedido.
 *
 * A comparação é por sobreposição, não por "o check-in cai dentro": quem
 * pede sábado a domingo num feriadão de sexta a segunda também precisa
 * levar o pacote.
 *
 * Quando dois blocos se encostam — o aniversário de Sarzedo (21/12) pode
 * emendar no Natal conforme o dia da semana — vale o pacote mais caro,
 * para não vender o período cheio pelo preço do menor.
 */
export function feriadoNoPeriodo(
  checkin: string,
  checkout: string,
): Feriado | undefined {
  const anoEntrada = parseData(checkin).getFullYear();
  const anos = new Set([
    anoEntrada - 1, // pega o Réveillon que começou no ano anterior
    anoEntrada,
    parseData(checkout).getFullYear(),
  ]);

  const sobrepostos = [...anos]
    .flatMap((ano) => feriadosDoAno(ano))
    .filter((f) => checkin < f.fim && checkout > f.inicio);

  if (sobrepostos.length === 0) return undefined;

  return sobrepostos.reduce((maior, f) => (f.preco > maior.preco ? f : maior));
}

// ============================================================
//  Cálculo
// ============================================================

export type OrcamentoInput = {
  checkin: string; // YYYY-MM-DD
  checkout: string; // YYYY-MM-DD
  pessoas: number;
  hidromassagem?: boolean;
};

export type OrcamentoResultado = {
  valido: boolean;
  erro?: string;
  checkin: string;
  checkout: string;
  dias: number;
  pessoas: number;
  /** Valor da hospedagem, sem adicionais. */
  valorBase: number;
  /** Adicional de hidromassagem, por diária. */
  valorHidromassagem: number;
  /** Base + adicionais. É o que o cliente paga pela estadia. */
  valorTotal: number;
  /** Explicação legível de como o valor foi formado. */
  tipoCalculo: string;
  feriado?: Feriado;
  /**
   * Diárias que ficam FORA do bloco do feriado e são cobradas à parte.
   * Zero quando a estadia cabe exatamente no pacote.
   */
  diasForaDoFeriado: number;
  ehEvento: boolean;
  caucao: number;
  /** Ano usado no reajuste e quanto ele representa sobre 2026. */
  anoReferencia: number;
  /**
   * Preenchido quando a data pedida encosta num feriado sem cobrir o
   * bloco inteiro. O valor já é o do pacote completo, e as datas dizem
   * qual período o cliente precisa levar.
   */
  pacoteObrigatorio?: {
    inicio: string;
    fim: string;
    inicioAlternativo?: string;
    motivo: string;
  };
  /** Sugestão de upsell quando o cliente entra no sábado. */
  upsell?: string;
};

/** Valor do evento (acima de 30 pessoas) para um número de diárias. */
function valorEvento(pessoas: number, dias: number, ano: number): number {
  const faixa =
    EVENTO_BASE.find((f) => pessoas <= f.ate) ??
    EVENTO_BASE[EVENTO_BASE.length - 1];

  let extras = 0;
  if (dias >= 1) {
    extras += EVENTO_PRIMEIRO_DIA;
    if (dias > 1) extras += (dias - 1) * EVENTO_DIA_EXTRA;
  }

  return comReajuste(faixa.valor + extras, ano);
}

export function calcularOrcamento(input: OrcamentoInput): OrcamentoResultado {
  const { checkin, checkout, hidromassagem = false } = input;
  const pessoas = Number(input.pessoas) || 0;

  const vazio: OrcamentoResultado = {
    valido: false,
    checkin,
    checkout,
    dias: 0,
    pessoas,
    valorBase: 0,
    valorHidromassagem: 0,
    valorTotal: 0,
    tipoCalculo: "",
    diasForaDoFeriado: 0,
    ehEvento: false,
    caucao: CAUCAO,
    anoReferencia: ANO_BASE,
  };

  if (!checkin || !checkout) {
    return { ...vazio, erro: "Informe a data de entrada e de saída." };
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(checkin) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(checkout)
  ) {
    return { ...vazio, erro: "Datas em formato inválido." };
  }

  const diasPedidos = diffDias(checkin, checkout);
  if (diasPedidos <= 0) {
    return {
      ...vazio,
      erro: "A data de saída precisa ser depois da data de entrada.",
    };
  }
  if (pessoas <= 0) {
    return { ...vazio, erro: "Informe quantas pessoas vão." };
  }

  const anoReferencia = parseData(checkin).getFullYear();
  const feriado = feriadoNoPeriodo(checkin, checkout);
  const ehEvento = pessoas > 30;

  // ---- Datas efetivamente cobradas ----
  // Se o período encosta num feriado, o cliente leva o bloco inteiro.
  let inicioCobrado = checkin;
  let fimCobrado = checkout;
  let pacoteObrigatorio: OrcamentoResultado["pacoteObrigatorio"];

  if (feriado) {
    const cobreBloco = checkin <= feriado.inicio && checkout >= feriado.fim;
    if (!cobreBloco) {
      inicioCobrado = feriado.inicio;
      fimCobrado = feriado.fim;
      pacoteObrigatorio = {
        inicio: feriado.inicio,
        fim: feriado.fim,
        ...(feriado.inicioAlternativo
          ? { inicioAlternativo: feriado.inicioAlternativo }
          : {}),
        motivo:
          `${feriado.nome} cai em ${nomeDiaSemana(feriado.data).toLowerCase()}, ` +
          `então a data é alugada fechada, de ${formatarDataBR(feriado.inicio)} ` +
          `a ${formatarDataBR(feriado.fim)}.`,
      };
    }
  }

  const dias = diffDias(inicioCobrado, fimCobrado);

  // ---- Valor da hospedagem ----
  let valorBase = 0;
  let tipoCalculo = "";
  let diasForaDoFeriado = 0;

  if (feriado) {
    /*
      O pacote de feriado cobre APENAS o bloco dele. Quem fica além disso
      paga as noites extras pela diária comum — senão uma estadia de 6
      noites que encosta num feriadão de 2 sairia pelo preço do feriadão,
      e as outras 4 noites iriam de graça.
    */
    const diasDoBloco = diffDias(feriado.inicio, feriado.fim);
    const diasExtras = Math.max(0, dias - diasDoBloco);
    diasForaDoFeriado = diasExtras;
    const valorExtras = comReajuste(diasExtras * ESTADIA_DIARIA, anoReferencia);
    const pacoteComExtras = feriado.preco + valorExtras;

    const descreveExtras =
      diasExtras > 0
        ? ` + ${diasExtras} diária${diasExtras > 1 ? "s" : ""} fora do feriado`
        : "";

    if (ehEvento) {
      const evento = valorEvento(pessoas, dias, anoReferencia);
      // No feriado cobra-se o que for maior: o pacote ou o cálculo de evento.
      if (evento > pacoteComExtras) {
        valorBase = evento;
        tipoCalculo = `Evento para ${pessoas} pessoas (${feriado.nome})`;
      } else {
        valorBase = pacoteComExtras;
        tipoCalculo = `Pacote ${feriado.nome}${descreveExtras}`;
      }
    } else {
      valorBase = pacoteComExtras;
      tipoCalculo = `Pacote ${feriado.nome}${descreveExtras}`;
    }
  } else if (ehEvento) {
    valorBase = valorEvento(pessoas, dias, anoReferencia);
    tipoCalculo = `Evento para ${pessoas} pessoas`;
  } else {
    const diaCheckin = getDiaSemana(inicioCobrado);
    if (diaCheckin === 5 && dias === 2) {
      valorBase = comReajuste(ESTADIA_FDS, anoReferencia);
      tipoCalculo = "Fim de semana completo (sexta a domingo)";
    } else if ((diaCheckin === 6 || diaCheckin === 5) && dias === 1) {
      valorBase = comReajuste(ESTADIA_CURTA, anoReferencia);
      tipoCalculo = `Diária de fim de semana (${nomeDiaSemana(
        inicioCobrado,
      )} a ${nomeDiaSemana(fimCobrado)})`;
    } else {
      valorBase = comReajuste(dias * ESTADIA_DIARIA, anoReferencia);
      tipoCalculo = `${dias} diária${dias > 1 ? "s" : ""} durante a semana`;
    }
  }

  const valorHidromassagem = hidromassagem
    ? comReajuste(dias * HIDROMASSAGEM_DIARIA, anoReferencia)
    : 0;

  // ---- Upsell: entrando no sábado, mostrar o fim de semana inteiro ----
  let upsell: string | undefined;
  if (
    !feriado &&
    !ehEvento &&
    getDiaSemana(inicioCobrado) === 6 &&
    dias === 1
  ) {
    const fds = comReajuste(ESTADIA_FDS, anoReferencia);
    const diferenca = fds - valorBase;
    if (diferenca > 0) {
      upsell =
        `Entrando na sexta em vez do sábado, você leva o fim de semana ` +
        `completo por ${formatarBRL(fds)} — só ${formatarBRL(diferenca)} ` +
        `a mais por uma noite extra.`;
    }
  }

  return {
    valido: true,
    checkin: inicioCobrado,
    checkout: fimCobrado,
    dias,
    pessoas,
    valorBase,
    valorHidromassagem,
    valorTotal: valorBase + valorHidromassagem,
    tipoCalculo,
    feriado,
    diasForaDoFeriado,
    ehEvento,
    caucao: CAUCAO,
    anoReferencia,
    pacoteObrigatorio,
    upsell,
  };
}

// ============================================================
//  Tabela de vitrine (para quem ainda não tem data)
// ============================================================

export type LinhaTabela = {
  titulo: string;
  detalhe: string;
  valor: number;
  prefixo?: string;
  destaque?: boolean;
};

/** Valores de vitrine do ano pedido, para a home e o orçamento padrão. */
export function tabelaDePrecos(ano: number = new Date().getFullYear()): LinhaTabela[] {
  return [
    {
      titulo: "Fim de semana completo",
      detalhe: "Sexta a domingo, 2 diárias",
      valor: comReajuste(ESTADIA_FDS, ano),
      destaque: true,
    },
    {
      titulo: "Uma diária no fim de semana",
      detalhe: "Entrada na sexta ou no sábado",
      valor: comReajuste(ESTADIA_CURTA, ano),
    },
    {
      titulo: "Diária durante a semana",
      detalhe: "De segunda a quinta, por dia",
      valor: comReajuste(ESTADIA_DIARIA, ano),
    },
    {
      titulo: "Eventos acima de 30 pessoas",
      detalhe: "Valor conforme o número de convidados",
      valor: comReajuste(EVENTO_BASE[0].valor + EVENTO_PRIMEIRO_DIA, ano),
      prefixo: "a partir de",
    },
  ];
}
