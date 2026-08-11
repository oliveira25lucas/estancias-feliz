import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularOrcamento } from "./pricing.ts";

/**
 * Estes casos travam o comportamento do motor de preços contra o workflow
 * do n8n. Se um valor mudar aqui sem mudar lá (ou vice-versa), o site e a
 * Júlia passam a dar respostas diferentes para o mesmo cliente.
 *
 * Rodar com: npm test
 *
 * Datas de agosto/2026 usadas como referência (sem feriado no caminho):
 *   14/08 sexta · 15/08 sábado · 16/08 domingo · 17/08 segunda
 */

test("fim de semana completo (sexta a domingo) custa R$ 3.350", () => {
  const r = calcularOrcamento({
    checkin: "2026-08-14",
    checkout: "2026-08-16",
    pessoas: 20,
  });
  assert.equal(r.valido, true);
  assert.equal(r.dias, 2);
  assert.equal(r.valorTotal, 3350);
  assert.match(r.tipoCalculo, /Fim de semana completo/);
});

test("uma diária no sábado custa R$ 2.350", () => {
  const r = calcularOrcamento({
    checkin: "2026-08-15",
    checkout: "2026-08-16",
    pessoas: 20,
  });
  assert.equal(r.valorTotal, 2350);
});

test("diária de semana custa R$ 2.000 por dia", () => {
  const uma = calcularOrcamento({
    checkin: "2026-08-17",
    checkout: "2026-08-18",
    pessoas: 10,
  });
  assert.equal(uma.valorTotal, 2000);

  const duas = calcularOrcamento({
    checkin: "2026-08-19",
    checkout: "2026-08-21",
    pessoas: 10,
  });
  assert.equal(duas.valorTotal, 4000);
});

test("evento de 50 pessoas em 1 diária: base 2200 + 1000", () => {
  const r = calcularOrcamento({
    checkin: "2026-08-17",
    checkout: "2026-08-18",
    pessoas: 50,
  });
  assert.equal(r.ehEvento, true);
  assert.equal(r.valorTotal, 3200);
});

test("evento de 100 pessoas em 2 diárias: 3080 + 1000 + 700", () => {
  const r = calcularOrcamento({
    checkin: "2026-08-17",
    checkout: "2026-08-19",
    pessoas: 100,
  });
  assert.equal(r.valorTotal, 4780);
});

test("pacote de Natal tem valor fechado de R$ 6.000", () => {
  const r = calcularOrcamento({
    checkin: "2026-12-24",
    checkout: "2026-12-26",
    pessoas: 20,
  });
  assert.equal(r.feriado?.nome, "Natal 2026");
  assert.equal(r.valorTotal, 6000);
});

test("Réveillon custa R$ 12.500", () => {
  const r = calcularOrcamento({
    checkin: "2026-12-30",
    checkout: "2027-01-01",
    pessoas: 25,
  });
  assert.equal(r.valorTotal, 12500);
});

test("em feriado com grupo grande, cobra-se o maior entre pacote e evento", () => {
  // Carnaval 2026 fecha em R$ 5.000, mas 150 pessoas por 4 diárias
  // dão 3750 + 1000 + 3x700 = 6850. Vale o maior.
  const r = calcularOrcamento({
    checkin: "2026-02-14",
    checkout: "2026-02-18",
    pessoas: 150,
  });
  assert.equal(r.valorTotal, 6850);
  assert.match(r.tipoCalculo, /Carnaval 2026/);
});

test("hidromassagem soma R$ 150 por diária", () => {
  const r = calcularOrcamento({
    checkin: "2026-08-14",
    checkout: "2026-08-16",
    pessoas: 20,
    hidromassagem: true,
  });
  assert.equal(r.valorHidromassagem, 300);
  assert.equal(r.valorTotal, 3650);
});

test("entrada no sábado sugere o fim de semana completo", () => {
  const r = calcularOrcamento({
    checkin: "2026-08-15",
    checkout: "2026-08-16",
    pessoas: 15,
  });
  assert.ok(r.upsell, "deveria sugerir a sexta");
  assert.match(r.upsell!, /3\.350/);
});

test("datas inconsistentes não geram valor", () => {
  const invertido = calcularOrcamento({
    checkin: "2026-08-16",
    checkout: "2026-08-14",
    pessoas: 10,
  });
  assert.equal(invertido.valido, false);
  assert.equal(invertido.valorTotal, 0);

  const semPessoas = calcularOrcamento({
    checkin: "2026-08-14",
    checkout: "2026-08-16",
    pessoas: 0,
  });
  assert.equal(semPessoas.valido, false);
});

test("o cálculo não escorrega de fuso horário", () => {
  // 14/08/2026 é sexta. Se a data fosse lida como UTC, viraria quinta
  // no Brasil e o valor cairia para 2 diárias de semana (R$ 4.000).
  const r = calcularOrcamento({
    checkin: "2026-08-14",
    checkout: "2026-08-16",
    pessoas: 10,
  });
  assert.equal(r.valorTotal, 3350);
});
