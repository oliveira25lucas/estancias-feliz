/**
 * Motor de cálculo de diárias do Sítio Estâncias Feliz.
 *
 * Porte fiel do nó "Processar Calendar e Preco1" do workflow n8n
 * "Atendimento Sítio v3". O site e a Júlia (agente do WhatsApp) precisam
 * chegar sempre no MESMO valor — divergência de preço entre canais é a
 * forma mais rápida de perder a confiança do cliente.
 *
 * Se algum valor mudar aqui, atualize o workflow no n8n também.
 */

export type Feriado = {
  nome: string;
  inicio: string; // YYYY-MM-DD
  fim: string; // YYYY-MM-DD
  preco: number;
};

/** Pacotes fechados de feriado. O check-in é que define se a data cai no pacote. */
export const FERIADOS: Feriado[] = [
  { nome: "Carnaval 2026", inicio: "2026-02-14", fim: "2026-02-18", preco: 5000 },
  { nome: "Semana Santa 2026", inicio: "2026-04-02", fim: "2026-04-05", preco: 4500 },
  { nome: "Tiradentes 2026", inicio: "2026-04-17", fim: "2026-04-21", preco: 5000 },
  { nome: "Dia do Trabalho 2026", inicio: "2026-05-01", fim: "2026-05-03", preco: 3600 },
  { nome: "Corpus Christi 2026", inicio: "2026-06-04", fim: "2026-06-07", preco: 4500 },
  { nome: "Independência 2026", inicio: "2026-09-04", fim: "2026-09-07", preco: 4500 },
  { nome: "Aparecida 2026", inicio: "2026-10-09", fim: "2026-10-12", preco: 4500 },
  { nome: "Finados 2026", inicio: "2026-10-30", fim: "2026-11-02", preco: 4500 },
  { nome: "Consciência Negra 2026", inicio: "2026-11-20", fim: "2026-11-22", preco: 3600 },
  { nome: "Dezembro 2026", inicio: "2026-12-04", fim: "2026-12-08", preco: 5000 },
  { nome: "Natal 2026", inicio: "2026-12-23", fim: "2026-12-28", preco: 6000 },
  { nome: "Réveillon 2026/27", inicio: "2026-12-29", fim: "2027-01-02", preco: 12500 },
  { nome: "Carnaval 2027", inicio: "2027-02-13", fim: "2027-02-17", preco: 5000 },
  { nome: "Semana Santa 2027", inicio: "2027-03-27", fim: "2027-03-30", preco: 4500 },
  { nome: "Tiradentes 2027", inicio: "2027-04-16", fim: "2027-04-21", preco: 5000 },
  { nome: "Dia do Trabalho 2027", inicio: "2027-04-30", fim: "2027-05-03", preco: 3600 },
  { nome: "Corpus Christi 2027", inicio: "2027-05-27", fim: "2027-05-30", preco: 4500 },
  { nome: "Independência 2027", inicio: "2027-09-03", fim: "2027-09-07", preco: 4500 },
  { nome: "Aparecida 2027", inicio: "2027-10-08", fim: "2027-10-12", preco: 4500 },
  { nome: "Finados 2027", inicio: "2027-10-29", fim: "2027-11-02", preco: 4500 },
  { nome: "Natal 2027", inicio: "2027-12-23", fim: "2027-12-28", preco: 6000 },
  { nome: "Réveillon 2027/28", inicio: "2027-12-29", fim: "2028-01-02", preco: 12500 },
];

/** Faixas de valor base para eventos (acima de 30 pessoas). */
export const EVENTO_BASE = [
  { ate: 50, valor: 2200 },
  { ate: 75, valor: 2750 },
  { ate: 100, valor: 3080 },
  { ate: 150, valor: 3750 },
  { ate: 200, valor: 4180 },
  { ate: 999, valor: 4800 },
];

export const ESTADIA_FDS = 3350; // sexta -> domingo (2 diárias)
export const ESTADIA_CURTA = 2350; // 1 diária em sexta ou sábado
export const ESTADIA_DIARIA = 2000; // diária avulsa durante a semana

export const EVENTO_PRIMEIRO_DIA = 1000;
export const EVENTO_DIA_EXTRA = 700;

export const HIDROMASSAGEM_DIARIA = 150;
export const CAUCAO = 500;

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
 * `new Date("2026-08-11")` seria interpretado como UTC e pode voltar
 * um dia no Brasil — por isso montamos componente a componente.
 */
function parseData(dateStr: string): Date {
  const [ano, mes, dia] = dateStr.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
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

export function encontrarFeriado(checkin: string): Feriado | undefined {
  return FERIADOS.find((f) => checkin >= f.inicio && checkin <= f.fim);
}

export function formatarBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export type OrcamentoInput = {
  checkin: string; // YYYY-MM-DD
  checkout: string; // YYYY-MM-DD
  pessoas: number;
  hidromassagem?: boolean;
};

export type OrcamentoResultado = {
  valido: boolean;
  erro?: string;
  dias: number;
  pessoas: number;
  /** Valor da hospedagem, sem adicionais. */
  valorBase: number;
  /** Adicional de hidromassagem (R$ 150 por diária), quando escolhido. */
  valorHidromassagem: number;
  /** Base + adicionais. É o valor que o cliente paga pela estadia. */
  valorTotal: number;
  /** Explicação legível de como o valor foi formado. */
  tipoCalculo: string;
  feriado?: Feriado;
  ehEvento: boolean;
  caucao: number;
  /** Sugestão de upsell quando o cliente entra no sábado. */
  upsell?: string;
};

/**
 * Calcula o valor da estadia seguindo exatamente a mesma ordem de decisão
 * do workflow: feriado primeiro, evento depois, estadia comum por último.
 */
export function calcularOrcamento(input: OrcamentoInput): OrcamentoResultado {
  const { checkin, checkout, hidromassagem = false } = input;
  const pessoas = Number(input.pessoas) || 0;

  const vazio: OrcamentoResultado = {
    valido: false,
    dias: 0,
    pessoas,
    valorBase: 0,
    valorHidromassagem: 0,
    valorTotal: 0,
    tipoCalculo: "",
    ehEvento: false,
    caucao: CAUCAO,
  };

  if (!checkin || !checkout) {
    return { ...vazio, erro: "Informe a data de entrada e de saída." };
  }

  const dias = diffDias(checkin, checkout);
  if (dias <= 0) {
    return {
      ...vazio,
      erro: "A data de saída precisa ser depois da data de entrada.",
    };
  }
  if (pessoas <= 0) {
    return { ...vazio, erro: "Informe quantas pessoas vão." };
  }

  const feriado = encontrarFeriado(checkin);
  const ehEvento = pessoas > 30;

  let valorBase = 0;
  let tipoCalculo = "";

  const valorEvento = () => {
    const faixa =
      EVENTO_BASE.find((f) => pessoas <= f.ate) ??
      EVENTO_BASE[EVENTO_BASE.length - 1];
    let extras = 0;
    if (dias >= 1) {
      extras += EVENTO_PRIMEIRO_DIA;
      if (dias > 1) extras += (dias - 1) * EVENTO_DIA_EXTRA;
    }
    return faixa.valor + extras;
  };

  if (feriado) {
    if (ehEvento) {
      const evento = valorEvento();
      // No feriado, cobra-se o que for maior: o pacote ou o cálculo de evento.
      if (evento > feriado.preco) {
        valorBase = evento;
        tipoCalculo = `Evento para ${pessoas} pessoas (${feriado.nome})`;
      } else {
        valorBase = feriado.preco;
        tipoCalculo = `Pacote Feriado: ${feriado.nome}`;
      }
    } else {
      valorBase = feriado.preco;
      tipoCalculo = `Pacote Feriado: ${feriado.nome}`;
    }
  } else if (ehEvento) {
    valorBase = valorEvento();
    tipoCalculo = `Evento para ${pessoas} pessoas`;
  } else {
    const diaCheckin = getDiaSemana(checkin);
    if (diaCheckin === 5 && dias === 2) {
      valorBase = ESTADIA_FDS;
      tipoCalculo = "Fim de semana completo (sexta a domingo)";
    } else if ((diaCheckin === 6 || diaCheckin === 5) && dias === 1) {
      valorBase = ESTADIA_CURTA;
      tipoCalculo = `Diária de fim de semana (${nomeDiaSemana(
        checkin,
      )} a ${nomeDiaSemana(checkout)})`;
    } else {
      valorBase = dias * ESTADIA_DIARIA;
      tipoCalculo = `${dias} diária${dias > 1 ? "s" : ""} durante a semana`;
    }
  }

  const valorHidromassagem = hidromassagem ? dias * HIDROMASSAGEM_DIARIA : 0;

  // Entrando no sábado sem feriado, vale mostrar o fim de semana completo.
  let upsell: string | undefined;
  if (getDiaSemana(checkin) === 6 && !feriado && dias <= 2 && !ehEvento) {
    const diferenca = ESTADIA_FDS - valorBase;
    if (diferenca > 0) {
      upsell = `Entrando na sexta em vez do sábado, você leva o fim de semana completo por ${formatarBRL(
        ESTADIA_FDS,
      )} — só ${formatarBRL(diferenca)} a mais por uma noite extra.`;
    }
  }

  return {
    valido: true,
    dias,
    pessoas,
    valorBase,
    valorHidromassagem,
    valorTotal: valorBase + valorHidromassagem,
    tipoCalculo,
    feriado,
    ehEvento,
    caucao: CAUCAO,
    upsell,
  };
}
