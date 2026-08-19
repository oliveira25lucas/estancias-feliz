import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularOrcamento,
  comReajuste,
  feriadoNoPeriodo,
  feriadoPorNome,
  feriadosDoAno,
  tabelaDePrecos,
} from "./pricing.ts";

/**
 * Estes casos travam as regras de negócio do sítio. Se um valor mudar
 * aqui sem intenção, o site e a Júlia passam a dar respostas diferentes
 * para o mesmo cliente.
 *
 * Rodar com: npm test
 *
 * Referência de agosto/2026 (sem feriado no caminho):
 *   14/08 sexta · 15/08 sábado · 16/08 domingo · 17/08 segunda
 * Atenção: 15/08 é feriado municipal de BH (Assunção), então os testes
 * de estadia comum usam a semana seguinte.
 */

// ============================================================
//  Estadias comuns
// ============================================================

test("fim de semana completo (sexta a domingo) custa R$ 3.350 em 2026", () => {
  const r = calcularOrcamento({
    checkin: "2026-08-21",
    checkout: "2026-08-23",
    pessoas: 20,
  });
  assert.equal(r.valido, true);
  assert.equal(r.dias, 2);
  assert.equal(r.valorTotal, 3350);
  assert.match(r.tipoCalculo, /Fim de semana completo/);
});

test("uma diária no sábado custa R$ 2.350", () => {
  const r = calcularOrcamento({
    checkin: "2026-08-22",
    checkout: "2026-08-23",
    pessoas: 20,
  });
  assert.equal(r.valorTotal, 2350);
});

test("diária de semana custa R$ 2.000 por dia", () => {
  const uma = calcularOrcamento({
    checkin: "2026-08-24",
    checkout: "2026-08-25",
    pessoas: 10,
  });
  assert.equal(uma.valorTotal, 2000);

  const duas = calcularOrcamento({
    checkin: "2026-08-26",
    checkout: "2026-08-28",
    pessoas: 10,
  });
  assert.equal(duas.valorTotal, 4000);
});

test("hidromassagem soma R$ 150 por diária", () => {
  const r = calcularOrcamento({
    checkin: "2026-08-21",
    checkout: "2026-08-23",
    pessoas: 20,
    hidromassagem: true,
  });
  assert.equal(r.valorHidromassagem, 300);
  assert.equal(r.valorTotal, 3650);
});

test("entrada no sábado sugere o fim de semana completo", () => {
  const r = calcularOrcamento({
    checkin: "2026-08-22",
    checkout: "2026-08-23",
    pessoas: 15,
  });
  assert.ok(r.upsell, "deveria sugerir a sexta");
  assert.match(r.upsell!, /3\.350/);
});

// ============================================================
//  Eventos
// ============================================================

test("evento de 50 pessoas em 1 diária: base 2200 + 1000", () => {
  const r = calcularOrcamento({
    checkin: "2026-08-24",
    checkout: "2026-08-25",
    pessoas: 50,
  });
  assert.equal(r.ehEvento, true);
  assert.equal(r.valorTotal, 3200);
});

test("evento de 100 pessoas em 2 diárias: 3080 + 1000 + 700", () => {
  const r = calcularOrcamento({
    checkin: "2026-08-24",
    checkout: "2026-08-26",
    pessoas: 100,
  });
  assert.equal(r.valorTotal, 4780);
});

// ============================================================
//  Reajuste anual de 10%
// ============================================================

test("o reajuste compõe 10% ao ano sobre a tabela de 2026", () => {
  assert.equal(comReajuste(3350, 2026), 3350);
  assert.equal(comReajuste(3350, 2027), 3690); // 3685 arredondado para a dezena
  assert.equal(comReajuste(2000, 2027), 2200);
  assert.equal(comReajuste(2000, 2028), 2420);
});

test("datas de 2027 já saem reajustadas", () => {
  const r = calcularOrcamento({
    checkin: "2027-08-20", // sexta
    checkout: "2027-08-22", // domingo
    pessoas: 20,
  });
  assert.equal(r.anoReferencia, 2027);
  assert.equal(r.valorTotal, 3690);
});

test("a caução não sofre reajuste", () => {
  const em2026 = calcularOrcamento({
    checkin: "2026-08-21",
    checkout: "2026-08-23",
    pessoas: 10,
  });
  const em2028 = calcularOrcamento({
    checkin: "2028-08-18",
    checkout: "2028-08-20",
    pessoas: 10,
  });
  assert.equal(em2026.caucao, 500);
  assert.equal(em2028.caucao, 500);
});

// ============================================================
//  Feriados: datas calculadas, não digitadas
// ============================================================

test("o Carnaval é calculado pela Páscoa, não copiado à mão", () => {
  // A tabela antiga dizia 13 a 17/02/2027. O Carnaval de 2027 é 09/02.
  const carnaval2027 = feriadosDoAno(2027).find((f) => f.nome === "Carnaval");
  assert.equal(carnaval2027?.data, "2027-02-09");

  const carnaval2026 = feriadosDoAno(2026).find((f) => f.nome === "Carnaval");
  assert.equal(carnaval2026?.data, "2026-02-17");
});

test("o Carnaval vai de sexta à quarta de cinzas", () => {
  const c = feriadosDoAno(2026).find((f) => f.nome === "Carnaval")!;
  assert.equal(c.inicio, "2026-02-13"); // sexta
  assert.equal(c.fim, "2026-02-18"); // quarta de cinzas
});

test("feriado em quarta-feira não forma pacote", () => {
  // Tiradentes 2027 cai numa quarta.
  const tiradentes = feriadosDoAno(2027).find((f) => f.nome === "Tiradentes");
  assert.equal(tiradentes, undefined);

  const r = calcularOrcamento({
    checkin: "2027-04-21",
    checkout: "2027-04-22",
    pessoas: 10,
  });
  assert.equal(r.feriado, undefined);
  assert.equal(r.valorTotal, comReajuste(2000, 2027));
});

// ============================================================
//  Blocos obrigatórios por dia da semana
// ============================================================

test("feriado na segunda fecha de sexta a segunda", () => {
  // Independência 2026: segunda, 07/09.
  const f = feriadosDoAno(2026).find((x) => x.nome === "Independência")!;
  assert.equal(f.inicio, "2026-09-04"); // sexta
  assert.equal(f.fim, "2026-09-07"); // segunda
});

test("feriado na quinta fecha de quinta a domingo", () => {
  // Corpus Christi 2026: quinta, 04/06.
  const f = feriadosDoAno(2026).find((x) => x.nome === "Corpus Christi")!;
  assert.equal(f.inicio, "2026-06-04");
  assert.equal(f.fim, "2026-06-07"); // domingo
});

test("feriado na terça fecha de sábado a terça, com sexta como opção", () => {
  // Imaculada Conceição 2026: terça, 08/12.
  const f = feriadosDoAno(2026).find((x) => x.nome === "Imaculada Conceição")!;
  assert.equal(f.inicio, "2026-12-05"); // sábado
  assert.equal(f.fim, "2026-12-08"); // terça
  assert.equal(f.inicioAlternativo, "2026-12-04"); // sexta
});

test("feriado no sábado fecha de sexta a domingo", () => {
  // N. S. da Assunção 2026: sábado, 15/08.
  const f = feriadosDoAno(2026).find((x) => x.nome === "N. S. da Assunção")!;
  assert.equal(f.inicio, "2026-08-14"); // sexta
  assert.equal(f.fim, "2026-08-16"); // domingo
});

test("pedir só parte do feriadão obriga a levar o bloco inteiro", () => {
  // Independência 2026 vai de sexta 04/09 a segunda 07/09.
  // O cliente pede sábado a domingo — precisa levar tudo.
  const r = calcularOrcamento({
    checkin: "2026-09-05",
    checkout: "2026-09-06",
    pessoas: 20,
  });
  assert.ok(r.pacoteObrigatorio, "deveria exigir o pacote");
  assert.equal(r.pacoteObrigatorio!.inicio, "2026-09-04");
  assert.equal(r.pacoteObrigatorio!.fim, "2026-09-07");
  assert.equal(r.checkin, "2026-09-04"); // datas cobradas foram ajustadas
  assert.equal(r.checkout, "2026-09-07");
  assert.equal(r.valorTotal, 4500);
});

test("quem já pede o bloco completo não recebe aviso de ajuste", () => {
  const r = calcularOrcamento({
    checkin: "2026-09-04",
    checkout: "2026-09-07",
    pessoas: 20,
  });
  assert.equal(r.pacoteObrigatorio, undefined);
  assert.equal(r.valorTotal, 4500);
});

// ============================================================
//  Feriados municipais
// ============================================================

test("aniversários de Sarzedo e Ibirité formam pacote de R$ 3.600", () => {
  const sarzedo = feriadosDoAno(2026).find(
    (f) => f.nome === "Aniversário de Sarzedo",
  )!;
  assert.equal(sarzedo.data, "2026-12-21");
  assert.equal(sarzedo.preco, 3600);

  const ibirite = feriadosDoAno(2026).find(
    (f) => f.nome === "Aniversário de Ibirité",
  )!;
  assert.equal(ibirite.data, "2026-03-01");
  assert.equal(ibirite.preco, 3600);
});

test("feriado municipal também reajusta 10% ao ano", () => {
  const em2027 = feriadosDoAno(2027).find(
    (f) => f.nome === "N. S. das Graças",
  )!;
  assert.equal(em2027.preco, 3960); // 3600 * 1,1
});

// ============================================================
//  Natal e Réveillon
// ============================================================

test("pacote de Natal: 23 a 28/12 por R$ 6.000", () => {
  const r = calcularOrcamento({
    checkin: "2026-12-24",
    checkout: "2026-12-26",
    pessoas: 20,
  });
  assert.equal(r.feriado?.nome, "Natal");
  assert.equal(r.checkin, "2026-12-23");
  assert.equal(r.checkout, "2026-12-28");
  assert.equal(r.valorTotal, 6000);
});

test("Réveillon custa R$ 12.500 e atravessa o ano", () => {
  const r = calcularOrcamento({
    checkin: "2026-12-30",
    checkout: "2027-01-01",
    pessoas: 25,
  });
  assert.equal(r.feriado?.nome, "Réveillon");
  assert.equal(r.checkin, "2026-12-29");
  assert.equal(r.checkout, "2027-01-02");
  assert.equal(r.valorTotal, 12500); // ano de referência é o da entrada
});

test("em feriado com grupo grande, cobra-se o maior entre pacote e evento", () => {
  // Carnaval 2026 fecha em R$ 5.000, mas 150 pessoas por 5 diárias
  // dão 3750 + 1000 + 4x700 = 7550. Vale o maior.
  const r = calcularOrcamento({
    checkin: "2026-02-13",
    checkout: "2026-02-18",
    pessoas: 150,
  });
  assert.equal(r.dias, 5);
  assert.equal(r.valorTotal, 7550);
  assert.match(r.tipoCalculo, /Carnaval/);
});

// ============================================================
//  Entradas inválidas e fuso horário
// ============================================================

test("datas inconsistentes não geram valor", () => {
  const invertido = calcularOrcamento({
    checkin: "2026-08-23",
    checkout: "2026-08-21",
    pessoas: 10,
  });
  assert.equal(invertido.valido, false);
  assert.equal(invertido.valorTotal, 0);

  const semPessoas = calcularOrcamento({
    checkin: "2026-08-21",
    checkout: "2026-08-23",
    pessoas: 0,
  });
  assert.equal(semPessoas.valido, false);
});

test("o cálculo não escorrega de fuso horário", () => {
  // 21/08/2026 é sexta. Lida como UTC viraria quinta no Brasil e o valor
  // cairia para 2 diárias de semana (R$ 4.000).
  const r = calcularOrcamento({
    checkin: "2026-08-21",
    checkout: "2026-08-23",
    pessoas: 10,
  });
  assert.equal(r.valorTotal, 3350);
});

// ============================================================
//  Tabela de vitrine
// ============================================================

test("a tabela de vitrine acompanha o reajuste do ano", () => {
  const t2026 = tabelaDePrecos(2026);
  assert.equal(t2026[0].valor, 3350);

  const t2027 = tabelaDePrecos(2027);
  assert.equal(t2027[0].valor, 3690);
});

test("sobreposição de blocos cobra o pacote mais caro", () => {
  // Se algum ano encostar o aniversário de Sarzedo (R$ 3.600) no Natal
  // (R$ 6.000), vale o Natal.
  const f = feriadoNoPeriodo("2026-12-22", "2026-12-24");
  assert.ok(f);
  assert.equal(f!.nome, "Natal");
});

// ============================================================
//  Estadia longa que engloba um feriado
// ============================================================

test("estadia longa paga o pacote MAIS as noites fora do feriado", () => {
  // N. S. da Assunção 2026 cai no sábado 15/08; o bloco é sexta 14 a
  // domingo 16 (2 diárias, R$ 3.600). Pedindo 12 a 18/08 são 6 diárias:
  // 4 delas ficam fora do bloco e devem ser cobradas à parte.
  const r = calcularOrcamento({
    checkin: "2026-08-12",
    checkout: "2026-08-18",
    pessoas: 25,
  });
  assert.equal(r.dias, 6);
  assert.equal(r.feriado?.nome, "N. S. da Assunção");
  assert.equal(r.valorTotal, 3600 + 4 * 2000); // R$ 11.600
  assert.match(r.tipoCalculo, /4 diárias fora do feriado/);
});

test("estadia que cobre exatamente o bloco não ganha diária extra", () => {
  const r = calcularOrcamento({
    checkin: "2026-08-14",
    checkout: "2026-08-16",
    pessoas: 25,
  });
  assert.equal(r.valorTotal, 3600);
  assert.equal(r.tipoCalculo, "Pacote N. S. da Assunção");
});

test("uma noite a mais depois do feriadão custa uma diária a mais", () => {
  // Independência 2026: bloco sexta 04 a segunda 07/09 (3 diárias).
  // Saindo na terça 08, é uma diária extra.
  const r = calcularOrcamento({
    checkin: "2026-09-04",
    checkout: "2026-09-08",
    pessoas: 20,
  });
  assert.equal(r.dias, 4);
  assert.equal(r.valorTotal, 4500 + 2000);
  assert.match(r.tipoCalculo, /1 diária fora do feriado/);
});

test("as noites extras também sofrem o reajuste anual", () => {
  // Mesmo caso do anterior, em 2027: Independência cai na terça 07/09,
  // bloco sábado 04 a terça 07 (3 diárias), e saída na quarta 08.
  const r = calcularOrcamento({
    checkin: "2027-09-04",
    checkout: "2027-09-08",
    pessoas: 20,
  });
  assert.equal(r.valorTotal, comReajuste(4500, 2027) + comReajuste(2000, 2027));
});

// ============================================================
//  O feriado pelo nome
// ============================================================

/**
 * Estes casos travam o erro de 18/08/2026: uma cliente perguntou por
 * "carnaval 2027" e o modelo de extração devolveu 18 a 22/02/2027. O
 * Carnaval de 2027 é de 05 a 10/02, e a diferença entre os dois na conta
 * é de R$ 8.800,00 contra R$ 5.500,00.
 */

test("carnaval de 2027 é de 05 a 10/02, e não o que o modelo achar", () => {
  const f = feriadoPorNome("carnaval", 2027);
  assert.equal(f?.nome, "Carnaval");
  assert.equal(f?.data, "2027-02-09"); // terça
  assert.equal(f?.inicio, "2027-02-05"); // sexta
  assert.equal(f?.fim, "2027-02-10"); // quarta de cinzas
  assert.equal(f?.preco, comReajuste(5000, 2027));
});

test("o bloco do carnaval de 2027 custa R$ 5.500, não R$ 8.800", () => {
  const f = feriadoPorNome("carnaval", 2027)!;
  const certo = calcularOrcamento({
    checkin: f.inicio,
    checkout: f.fim,
    pessoas: 21,
  });
  assert.equal(certo.valorTotal, 5500);
  assert.match(certo.tipoCalculo, /Pacote Carnaval/);

  // O que a Júlia chegou a cotar, com as datas que o modelo inventou.
  const errado = calcularOrcamento({
    checkin: "2027-02-18",
    checkout: "2027-02-22",
    pessoas: 21,
  });
  assert.equal(errado.valorTotal, 8800);
  assert.match(errado.tipoCalculo, /diárias durante a semana/);
});

test("o cliente escreve como quiser: acento, caixa e apelido", () => {
  const esperado = feriadoPorNome("Carnaval", 2027)?.inicio;
  for (const termo of [
    "CARNAVAL",
    "carnaval!!",
    "Carnaval 2027",
    "no feriadão de carnaval",
    "terça de carnaval",
  ]) {
    assert.equal(feriadoPorNome(termo, 2027)?.inicio, esperado, termo);
  }

  assert.equal(feriadoPorNome("reveillon", 2027)?.nome, "Réveillon");
  assert.equal(feriadoPorNome("ano novo", 2027)?.nome, "Réveillon");
  assert.equal(feriadoPorNome("páscoa", 2027)?.nome, "Semana Santa");
  assert.equal(feriadoPorNome("sexta-feira santa", 2027)?.nome, "Semana Santa");
  assert.equal(feriadoPorNome("7 de setembro", 2027)?.nome, "Independência");
});

test("sem ano dito, vale a próxima ocorrência que ainda não terminou", () => {
  // Em 19/08/2026 o carnaval do ano já passou: quem pergunta quer o de 2027.
  assert.equal(feriadoPorNome("carnaval", null, "2026-08-19")?.inicio, "2027-02-05");
  // Já o Natal de 2026 ainda vem.
  assert.equal(feriadoPorNome("natal", null, "2026-08-19")?.inicio, "2026-12-23");
  // No último dia do bloco ele ainda conta como o desta vez, não da próxima.
  assert.equal(feriadoPorNome("natal", null, "2026-12-28")?.inicio, "2026-12-23");
  assert.equal(feriadoPorNome("natal", null, "2026-12-29")?.inicio, "2027-12-23");
});

test("o que não é feriado não vira feriado", () => {
  for (const termo of ["", "  ", "fim de semana", "sábado", "aniversário da minha mãe"]) {
    assert.equal(feriadoPorNome(termo, 2027), undefined, termo);
  }
});

test("feriado em quarta não tem bloco, então não é achado pelo nome", () => {
  // Em 2027 o Dia do Trabalho cai em sábado; em 2030, em quarta-feira.
  assert.equal(feriadoPorNome("dia do trabalho", 2027)?.inicio, "2027-04-30");
  assert.equal(feriadoPorNome("dia do trabalho", 2030), undefined);
});
