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
  // Trava de segurança: períodos absurdos não travam a interface.
  for (let i = 0; atual <= limite && i < 400; i++) {
    dias.push(atual);
    atual = somaDiasISO(atual);
  }
  return dias;
}
