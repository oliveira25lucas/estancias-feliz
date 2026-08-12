/**
 * Regra de ocupação de datas — lógica pura, sem banco.
 *
 * Mora separada de `agenda.ts` justamente para poder ser testada sem
 * Supabase: é a regra que decide se o sítio está livre, e errar nela
 * significa vender a mesma data duas vezes.
 *
 * A DATA DE SAÍDA CONTA COMO OCUPADA. O hóspede sai às 16h e ainda há
 * limpeza e arrumação; na prática o sítio só volta a ficar livre no dia
 * seguinte. Quem sai no domingo ocupa o domingo, e a próxima entrada
 * possível é na segunda.
 */

/** Soma (ou subtrai) dias de uma data ISO, sem escorregar de fuso. */
export function somaDiasISO(iso: string, passo = 1): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  const d = new Date(ano, mes - 1, dia + passo);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
}

/** Dia da semana (0 = domingo) sem passar por fuso. */
function diaDaSemana(iso: string): number {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  return new Date(ano, mes - 1, dia).getDay();
}

/** Sobreposição de intervalos meio-abertos: [inicioA, fimA) e [inicioB, fimB). */
function seSobrepoe(
  inicioA: string,
  fimA: string,
  inicioB: string,
  fimB: string,
): boolean {
  return inicioA < fimB && inicioB < fimA;
}

/**
 * Duas estadias colidem?
 * As datas entram INCLUSIVAS nas duas pontas — do check-in ao check-out.
 */
export function periodosColidem(
  checkinA: string,
  checkoutA: string,
  checkinB: string,
  checkoutB: string,
): boolean {
  return seSobrepoe(
    checkinA,
    somaDiasISO(checkoutA),
    checkinB,
    somaDiasISO(checkoutB),
  );
}

/**
 * Todos os dias ocupados por um período, com as duas pontas incluídas.
 * É o que o calendário do painel pinta.
 */
export function diasOcupados(inicio: string, fim: string): string[] {
  const dias: string[] = [];
  let atual = inicio.slice(0, 10);
  const limite = fim.slice(0, 10);
  // Trava de segurança: períodos absurdos não travam a interface. O teto
  // é maior que a janela de MESES_DE_AGENDA para que um bloqueio longo
  // apareça inteiro no calendário público, e não cortado pela metade.
  for (let i = 0; atual <= limite && i < 800; i++) {
    dias.push(atual);
    atual = somaDiasISO(atual);
  }
  return dias;
}

// ============================================================
//  A agenda vista como um conjunto de dias
//
//  O calendário não pergunta "este período colide com algum destes?" —
//  ele pergunta, célula a célula, "este dia está ocupado?". Um conjunto
//  de dias responde isso em tempo constante, e é o mesmo conjunto que
//  o site manda para o navegador: só datas, sem nome de ninguém.
// ============================================================

/**
 * Até onde a agenda enxerga. Dezoito meses cobrem com folga o Réveillon
 * seguinte — o mais longe que alguém costuma reservar — e ainda cabem
 * numa resposta pequena o bastante para trafegar inteira.
 */
export const MESES_DE_AGENDA = 18;

export type Periodo = { inicio: string; fim: string };

/**
 * Hoje no fuso de Brasília, dê a resposta o servidor ou o navegador.
 *
 * A Vercel roda em UTC: às 21h de Brasília lá já é o dia seguinte, e um
 * "hoje" tirado do relógio do servidor faria o calendário abrir com a
 * data de hoje bloqueada. `en-CA` formata justamente em aaaa-mm-dd.
 */
export function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

/** Fim da janela de agenda: MESES_DE_AGENDA meses depois de `de`. */
export function fimDaJanela(de: string): string {
  const [ano, mes, dia] = de.slice(0, 10).split("-").map(Number);
  const d = new Date(ano, mes - 1 + MESES_DE_AGENDA, dia);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
}

/**
 * Junta vários períodos num conjunto de dias, recortado à janela pedida.
 * Devolve array ordenado, e não Set, porque isto atravessa a rede: quem
 * recebe monta o Set do outro lado.
 */
export function diasOcupadosDaLista(
  periodos: readonly Periodo[],
  de: string,
  ate: string,
): string[] {
  const dias = new Set<string>();

  for (const p of periodos) {
    // Recorta ANTES de expandir: um bloqueio de anos não precisa virar
    // milhares de strings para a janela jogar quase todas fora.
    const inicio = p.inicio > de ? p.inicio : de;
    const fim = p.fim < ate ? p.fim : ate;
    if (inicio > fim) continue;
    for (const dia of diasOcupados(inicio, fim)) dias.add(dia);
  }

  return [...dias].sort();
}

/**
 * Dá para ENTRAR neste dia?
 *
 * Não basta ele estar livre. A estadia mais curta possível é de uma
 * diária, e a saída também ocupa — então um dia livre espremido entre
 * duas reservas não serve para nada. Deixar clicar nele levaria a
 * pessoa a um beco sem saída: entrada aceita, nenhuma saída possível.
 */
export function podeSerEntrada(
  dia: string,
  ocupados: ReadonlySet<string>,
): boolean {
  return !ocupados.has(dia) && !ocupados.has(somaDiasISO(dia));
}

/**
 * Última saída possível para quem entra em `entrada`.
 *
 * Como a saída ocupa, a estadia inteira precisa estar livre: dá para ir
 * até a véspera do primeiro dia ocupado depois da entrada. Devolve ""
 * quando nem uma diária cabe.
 */
export function saidaMaxima(
  entrada: string,
  ocupados: ReadonlySet<string>,
  maximoDeDiarias = 30,
): string {
  if (ocupados.has(entrada)) return "";

  let ultima = entrada;
  for (let i = 0; i < maximoDeDiarias; i++) {
    const proximo = somaDiasISO(ultima);
    if (ocupados.has(proximo)) break;
    ultima = proximo;
  }

  return ultima === entrada ? "" : ultima;
}

/** O período inteiro — as duas pontas incluídas — está livre? */
export function periodoLivre(
  entrada: string,
  saida: string,
  ocupados: ReadonlySet<string>,
): boolean {
  return diasOcupados(entrada, saida).every((d) => !ocupados.has(d));
}

/**
 * Períodos livres para oferecer a quem pediu uma data ocupada.
 *
 * Anda de SETE em sete dias, para os dois lados, mantendo o mesmo dia da
 * semana e a mesma quantidade de diárias. Quem queria sexta a domingo
 * não quer ouvir "tenho terça a quinta" — quer o fim de semana seguinte.
 *
 * Empatada a distância, ganha a data mais para a frente: sobra tempo de
 * organizar a viagem, o que uma data mais próxima já não oferece.
 */
export function alternativasProximas(
  entrada: string,
  saida: string,
  ocupados: ReadonlySet<string>,
  { minimo = entrada, quantidade = 3, semanas = 16 } = {},
): { entrada: string; saida: string }[] {
  const achadas: { entrada: string; saida: string }[] = [];
  const diarias = diasOcupados(entrada, saida).length - 1;
  if (diarias < 1) return achadas;

  for (let k = 1; k <= semanas && achadas.length < quantidade; k++) {
    for (const passo of [7 * k, -7 * k]) {
      if (achadas.length >= quantidade) break;

      const candidata = somaDiasISO(entrada, passo);
      if (candidata < minimo) continue;

      const fim = somaDiasISO(candidata, diarias);
      if (periodoLivre(candidata, fim, ocupados)) {
        achadas.push({ entrada: candidata, saida: fim });
      }
    }
  }

  return achadas;
}

/**
 * Próximos fins de semana completos (sexta a domingo) ainda livres.
 * É a resposta para "o que você tem disponível?", tanto na página
 * pública quanto na boca da Júlia no WhatsApp.
 */
export function finsDeSemanaLivres(
  ocupados: ReadonlySet<string>,
  hoje: string,
  quantidade = 4,
  semanas = 26,
): { checkin: string; checkout: string }[] {
  const livres: { checkin: string; checkout: string }[] = [];

  // Anda até a próxima sexta. Hoje sendo sexta, começa na semana que vem:
  // ninguém reserva sítio para daqui a algumas horas.
  let sexta = somaDiasISO(hoje, ((5 - diaDaSemana(hoje) + 7) % 7) || 7);

  for (let i = 0; i < semanas && livres.length < quantidade; i++) {
    const domingo = somaDiasISO(sexta, 2);
    if (periodoLivre(sexta, domingo, ocupados)) {
      livres.push({ checkin: sexta, checkout: domingo });
    }
    sexta = somaDiasISO(sexta, 7);
  }

  return livres;
}
