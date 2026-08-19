import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fatoDisponibilidade,
  fatosComData,
  fatosSemData,
  periodoConferivel,
} from "./fatos.ts";
import {
  calcularOrcamento,
  feriadoPorNome,
  tabelaDePrecos,
} from "./pricing.ts";
import type { Disponibilidade } from "./agenda.ts";

/**
 * Estes casos travam o erro de 14/08/2026: a Júlia disse a um cliente que
 * 02 a 04/10 estava ocupado quando estava livre. A regressão só é possível
 * se os fatos voltarem a ficar calados sobre a data.
 */

const LIVRE: Disponibilidade = {
  livre: true,
  checkin: "2026-10-02",
  checkout: "2026-10-04",
  conflitos: [],
  resumo: "livre",
};

const OCUPADO: Disponibilidade = {
  livre: false,
  checkin: "2026-10-05",
  checkout: "2026-10-15",
  conflitos: [
    {
      tipo: "reserva",
      inicio: "2026-10-05",
      fim: "2026-10-15",
      descricao: "Já há reserva de 05/10/2026 a 15/10/2026.",
    },
  ],
  resumo: "ocupado",
};

test("sem o número de pessoas, a data ainda é respondida", () => {
  // O caso do Ben: deu as duas datas, nunca disse quantas pessoas.
  const orcamento = calcularOrcamento({
    checkin: "2026-10-02",
    checkout: "2026-10-04",
    pessoas: 0,
  });

  assert.equal(orcamento.valido, false);

  const fatos = fatosComData({
    orcamento,
    disponibilidade: LIVRE,
    conferivel: true,
  });

  assert.match(fatos, /a data está LIVRE/);
  assert.match(fatos, /NÃO mencione nenhum valor/);
  // Sem o período escrito junto, "a data está LIVRE" não diz QUAL data, e a
  // IA cola o resultado numa data que o cliente nem pediu.
  assert.match(fatos, /Período conferido: 02\/10\/2026 a 04\/10\/2026/);
});

test("sem preço e sem agenda, a IA é proibida nos dois sentidos", () => {
  const orcamento = calcularOrcamento({
    checkin: "2026-10-02",
    checkout: "2026-10-04",
    pessoas: 0,
  });

  const fatos = fatosComData({
    orcamento,
    disponibilidade: null,
    conferivel: true,
  });

  // A regra antiga só proibia dizer "está livre". Foi pela brecha do
  // "está ocupado" que o erro passou.
  assert.match(fatos, /NÃO diga que a data está livre NEM que está ocupada/);
});

test("data ocupada traz o conflito junto", () => {
  const orcamento = calcularOrcamento({
    checkin: "2026-10-05",
    checkout: "2026-10-07",
    pessoas: 20,
  });

  const fatos = fatosComData({
    orcamento,
    disponibilidade: OCUPADO,
    conferivel: true,
  });

  assert.match(fatos, /a data NÃO está livre/);
  assert.match(fatos, /05\/10\/2026 a 15\/10\/2026/);
});

test("orçamento válido continua trazendo o valor oficial e a data livre", () => {
  const orcamento = calcularOrcamento({
    checkin: "2026-10-02",
    checkout: "2026-10-04",
    pessoas: 20,
  });

  assert.equal(orcamento.valido, true);

  const fatos = fatosComData({
    orcamento,
    disponibilidade: LIVRE,
    conferivel: true,
  });

  assert.match(fatos, /VALOR OFICIAL/);
  assert.match(fatos, /a data está LIVRE/);
  assert.match(fatos, /Nunca arredonde/);
});

test("sem data, a lista de sugestões não vale como agenda completa", () => {
  // A lista ia até setembro e o modelo concluiu que outubro estava ocupado.
  const fatos = fatosSemData(tabelaDePrecos(2026), [
    { checkin: "2026-08-21", checkout: "2026-08-23" },
    { checkin: "2026-09-11", checkout: "2026-09-13" },
  ]);

  assert.match(fatos, /NÃO é a agenda completa/);
  assert.match(fatos, /Nenhuma data foi conferida nesta consulta/);
  assert.match(fatos, /Não invente valores fora desta lista/);
});

test("período conferível exige duas datas ISO em ordem", () => {
  assert.equal(periodoConferivel("2026-10-02", "2026-10-04"), true);
  assert.equal(periodoConferivel("2026-10-04", "2026-10-02"), false);
  assert.equal(periodoConferivel("2026-10-02", "2026-10-02"), false);
  assert.equal(periodoConferivel("2026-10-02", ""), false);
  assert.equal(periodoConferivel("02/10/2026", "04/10/2026"), false);
});

test("faltando data de saída, a IA pede em vez de chutar", () => {
  const fatos = fatoDisponibilidade(null, false);
  assert.match(fatos, /peça a data que falta/);
  assert.match(fatos, /NÃO diga que a data está livre NEM que está ocupada/);
});

test("pedido pelo nome do feriado, os fatos dizem quais são as datas", () => {
  // 18/08/2026: "está disponível para carnaval 2027?". A resposta certa
  // precisa dizer 05 a 10/02/2027 — a cliente não sabe em que dia cai.
  const feriado = feriadoPorNome("carnaval", 2027)!;
  const orcamento = calcularOrcamento({
    checkin: feriado.inicio,
    checkout: feriado.fim,
    pessoas: 21,
  });

  const fatos = fatosComData({
    orcamento,
    disponibilidade: { ...LIVRE, checkin: feriado.inicio, checkout: feriado.fim },
    conferivel: true,
    feriadoPedido: { termo: "carnaval", feriado },
  });

  assert.match(fatos, /O cliente falou em "carnaval"/);
  assert.match(fatos, /05\/02\/2027 a 10\/02\/2027/);
  assert.match(fatos, /DIGA ESSAS DATAS/);
  assert.match(fatos, /R\$\s5\.500,00/);
  // E nunca o valor da data que o modelo tinha inventado.
  assert.doesNotMatch(fatos, /8\.800/);
});

test("sem feriado pedido, os fatos não falam de feriado nenhum", () => {
  const orcamento = calcularOrcamento({
    checkin: "2026-10-02",
    checkout: "2026-10-04",
    pessoas: 10,
  });
  const fatos = fatosComData({
    orcamento,
    disponibilidade: LIVRE,
    conferivel: true,
  });
  assert.doesNotMatch(fatos, /O cliente falou em/);
});

test("entrar depois do início do bloco não abate nada, e os fatos avisam", () => {
  // "Seria entrar no sábado e sair na quarta" — no carnaval de 2027 isso
  // é o mesmo pacote da sexta. Vale convidar a pessoa a chegar antes.
  const orcamento = calcularOrcamento({
    checkin: "2027-02-06",
    checkout: "2027-02-10",
    pessoas: 21,
  });
  const fatos = fatosComData({
    orcamento,
    disponibilidade: null,
    conferivel: true,
  });

  assert.match(fatos, /alugada fechada, de 05\/02\/2027 a 10\/02\/2027/);
  assert.match(fatos, /NÃO reduz o valor/);
  assert.match(fatos, /chegar já em 05\/02\/2027/);
});
