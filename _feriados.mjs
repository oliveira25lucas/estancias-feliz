const DIAS = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'];

// Páscoa pelo algoritmo de Meeus/Jones/Butcher (calendário gregoriano).
function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano/100), c = ano % 100;
  const d = Math.floor(b/4), e = b % 4, f = Math.floor((b+8)/25);
  const g = Math.floor((b-f+1)/3), h = (19*a+b-d-g+15) % 30;
  const i = Math.floor(c/4), k = c % 4;
  const l = (32+2*e+2*i-h-k) % 7, m = Math.floor((a+11*h+22*l)/451);
  const mes = Math.floor((h+l-7*m+114)/31), dia = ((h+l-7*m+114) % 31)+1;
  return new Date(ano, mes-1, dia);
}
const somaDias = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

function feriados(ano) {
  const p = pascoa(ano);
  return [
    ['Carnaval',            somaDias(p,-47)],
    ['Sexta-feira Santa',   somaDias(p,-2)],
    ['Tiradentes',          new Date(ano,3,21)],
    ['Dia do Trabalho',     new Date(ano,4,1)],
    ['Corpus Christi',      somaDias(p,60)],
    ['Independência',       new Date(ano,8,7)],
    ['N. S. Aparecida',     new Date(ano,9,12)],
    ['Finados',             new Date(ano,10,2)],
    ['Consciência Negra',   new Date(ano,10,20)],
    ['Imaculada Conceição', new Date(ano,11,8)],
    ['Natal',               new Date(ano,11,25)],
  ];
}

// Regras que o Lucas passou, por dia da semana do feriado.
const REGRAS = { 4:'quinta a domingo', 5:'sexta a domingo', 1:'sexta a segunda', 2:'sexta ou sábado a terça' };

for (const ano of [2026, 2027, 2028]) {
  console.log(`\n===== ${ano} =====`);
  for (const [nome, data] of feriados(ano)) {
    const dow = data.getDay();
    const regra = REGRAS[dow];
    console.log(`  ${iso(data)} ${DIAS[dow].padEnd(8)} ${nome.padEnd(21)} ${regra ? '-> '+regra : '*** SEM REGRA ***'}`);
  }
}
