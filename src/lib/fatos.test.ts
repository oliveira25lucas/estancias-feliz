import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fatoDisponibilidade,
  fatosComData,
  fatosSemData,
  periodoConferivel,
} from "./fatos.ts";
import { calcularOrcamento, tabelaDePrecos } from "./pricing.ts";
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
