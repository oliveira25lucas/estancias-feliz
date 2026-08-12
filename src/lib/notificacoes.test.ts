import { test } from "node:test";
import assert from "node:assert/strict";
import {
  listaAgenda,
  mensagemCanceladaParaGrupo,
  mensagemLembreteParaFaxineira,
  mensagemLembreteParaGrupo,
  mensagemNovaParaFaxineira,
  mensagemNovaParaGrupo,
  temDatas,
  type ReservaAviso,
  type ReservaComData,
} from "./notificacoes.ts";

/**
 * Estes testes travam o texto que chega no WhatsApp dos donos e da
 * faxineira. Se um deles quebrar, alguém vai receber mensagem torta —
 * conferir o texto novo antes de ajustar o teste.
 */

function reserva(campos: Partial<ReservaAviso> & { id: string }): ReservaAviso {
  return {
    nome_cliente: null,
    data_checkin: null,
    data_checkout: null,
    qtd_pessoas: null,
    valor_final: null,
    status: "CONFIRMADA",
    ...campos,
  };
}

/** A agenda real que o Lucas mandou, para o teste valer como exemplo. */
const AGENDA: ReservaAviso[] = [
  reserva({ id: "a", data_checkin: "2026-07-24", data_checkout: "2026-07-26" }),
  reserva({ id: "b", data_checkin: "2026-08-29", data_checkout: "2026-08-30" }),
  reserva({ id: "c", data_checkin: "2026-11-20", data_checkout: "2026-11-22" }),
  reserva({ id: "d", data_checkin: "2026-12-23", data_checkout: "2026-12-27" }),
  reserva({ id: "e", data_checkin: "2027-07-01", data_checkout: "2027-07-04" }),
];

const NOVA: ReservaComData = {
  id: "c",
  nome_cliente: "Ana Paula",
  data_checkin: "2026-11-20",
  data_checkout: "2026-11-22",
  qtd_pessoas: 30,
  valor_final: "3685",
  status: "CONFIRMADA",
};

// ---------- Lista da agenda ----------

test("a lista agrupa por ano e conta o total", () => {
  const texto = listaAgenda(AGENDA);
  assert.match(texto, /^\*PRÓXIMOS ALUGUÉIS — 5 no total\*/);
  assert.match(texto, /\*2026\*/);
  assert.match(texto, /\*2027\*/);
  // O ano aparece uma vez por cabeçalho, não em cada linha.
  assert.equal(texto.match(/\/2026/g), null);
});

test("cada linha traz o dia da semana das duas pontas", () => {
  const texto = listaAgenda(AGENDA);
  assert.match(texto, /• 24\/07 a 26\/07 · sex a dom/);
  assert.match(texto, /• 29\/08 a 30\/08 · sáb a dom/);
  assert.match(texto, /• 23\/12 a 27\/12 · qua a dom/);
});

test("o que entrou sai em negrito com a seta", () => {
  const texto = listaAgenda(AGENDA, "c");
  assert.match(texto, /\*• 20\/11 a 22\/11 · sex a dom {2}⬅️ NOVO\*/);
  // Só a linha destacada ganha negrito.
  assert.equal(texto.match(/⬅️ NOVO/g)?.length, 1);
});

test("reserva sem contrato aparece, mas marcada", () => {
  const texto = listaAgenda([
    ...AGENDA,
    reserva({
      id: "f",
      data_checkin: "2027-02-12",
      data_checkout: "2027-02-14",
      status: "PENDENTE_CONTRATO",
    }),
  ]);
  assert.match(texto, /• 12\/02 a 14\/02 · sex a dom \(aguardando contrato\)/);
});

test("a lista chega ordenada mesmo vindo fora de ordem do banco", () => {
  const texto = listaAgenda([AGENDA[3], AGENDA[0], AGENDA[2]]);
  const posJulho = texto.indexOf("24/07");
  const posNovembro = texto.indexOf("20/11");
  const posDezembro = texto.indexOf("23/12");
  assert.ok(posJulho < posNovembro && posNovembro < posDezembro);
});

test("agenda vazia não devolve lista quebrada", () => {
  assert.match(listaAgenda([]), /A agenda está vazia daqui pra frente/);
});

test("reserva sem as duas datas não entra em aviso", () => {
  assert.equal(temDatas(reserva({ id: "x", data_checkin: "2026-07-24" })), false);
  assert.equal(temDatas(NOVA), true);
});

// ---------- Grupo dos donos ----------

test("o aviso de aluguel novo abre com quem entrou e depois a agenda", () => {
  const texto = mensagemNovaParaGrupo(NOVA, AGENDA);
  assert.match(texto, /^\*🏡 AGENDA SÍTIO — ENTROU ALUGUEL NOVO\*/);
  assert.match(texto, /\*20\/11\/2026 a 22\/11\/2026\* · sex a dom · 2 diárias/);
  // `formatarBRL` separa o R$ com espaço fixo (U+00A0), daí o \s.
  assert.match(texto, /Ana Paula · 30 pessoas · R\$\s3\.685,00/);
  assert.match(texto, /⬅️ NOVO/);
});

test("valor gravado como texto pelo n8n vira moeda, e valor ausente desaparece", () => {
  assert.match(mensagemNovaParaGrupo(NOVA, AGENDA), /R\$\s3\.685,00/);

  const semValor = mensagemNovaParaGrupo(
    { ...NOVA, valor_final: null },
    AGENDA,
  );
  assert.match(semValor, /Ana Paula · 30 pessoas$/m);
  assert.doesNotMatch(semValor, /R\$/);
  assert.doesNotMatch(semValor, /NaN/);
});

test("uma diária não vira 1 diárias", () => {
  const umaNoite: ReservaComData = {
    ...NOVA,
    id: "b",
    data_checkin: "2026-08-29",
    data_checkout: "2026-08-30",
  };
  assert.match(mensagemNovaParaGrupo(umaNoite, AGENDA), /· 1 diária\b/);
});

test("o cancelamento risca o período e a data sai da lista", () => {
  const restante = AGENDA.filter((r) => r.id !== "c");
  const texto = mensagemCanceladaParaGrupo(NOVA, restante);
  assert.match(texto, /ALUGUEL CANCELADO/);
  assert.match(texto, /~\*20\/11\/2026 a 22\/11\/2026\*~/);
  assert.match(texto, /Ana Paula · a data voltou a ficar livre/);
  assert.match(texto, /4 no total/);
  // A data cancelada não pode reaparecer na lista de futuros.
  assert.doesNotMatch(texto, /• 20\/11 a 22\/11/);
});

test("o lembrete do grupo só fala da Maurizia quando ela foi avisada", () => {
  assert.match(
    mensagemLembreteParaGrupo(NOVA, true),
    /A Maurizia já recebeu o lembrete da limpeza\./,
  );
  assert.doesNotMatch(mensagemLembreteParaGrupo(NOVA, false), /Maurizia/);
});

test("o lembrete do grupo não expõe o valor combinado", () => {
  assert.doesNotMatch(mensagemLembreteParaGrupo(NOVA, false), /R\$/);
});

// ---------- Faxineira ----------

test("a faxineira recebe entrada, saída, horários e o prazo da véspera", () => {
  const texto = mensagemNovaParaFaxineira(NOVA, AGENDA);
  assert.match(texto, /^Oi, Maurizia! Tudo bem\? 🏡/);
  assert.match(texto, /\*Entrada:\* sexta, 20\/11\/2026, 8h/);
  assert.match(texto, /\*Saída:\* domingo, 22\/11\/2026, 16h/);
  assert.match(texto, /\*Pessoas:\* 30/);
  // A entrada é 8h: tem que estar pronto na véspera, não no dia.
  assert.match(texto, /pronta até quinta, 19\/11\/2026\./);
});

test("a faxineira recebe a agenda completa junto", () => {
  const texto = mensagemNovaParaFaxineira(NOVA, AGENDA);
  assert.match(texto, /\*PRÓXIMOS ALUGUÉIS — 5 no total\*/);
  assert.match(texto, /⬅️ NOVO/);
});

test("a faxineira não recebe valor de aluguel", () => {
  assert.doesNotMatch(mensagemNovaParaFaxineira(NOVA, AGENDA), /R\$/);
  assert.doesNotMatch(mensagemLembreteParaFaxineira(NOVA), /R\$/);
});

test("o lembrete de 7 dias pede confirmação da limpeza", () => {
  const texto = mensagemLembreteParaFaxineira(NOVA);
  assert.match(texto, /\*Falta 1 semana\*/);
  assert.match(texto, /\*Entrada:\* sexta, 20\/11\/2026, 8h/);
  assert.match(texto, /Consegue confirmar a limpeza pra mim\?/);
});

test("a véspera de virada de mês não escorrega", () => {
  // Entrada em 01/11/2026 (domingo): a véspera é 31/10, não 01/10.
  const viradaDeMes: ReservaComData = {
    ...NOVA,
    data_checkin: "2026-11-01",
    data_checkout: "2026-11-02",
  };
  assert.match(
    mensagemLembreteParaFaxineira(viradaDeMes),
    /pronta até sábado, 31\/10\/2026\./,
  );
});
