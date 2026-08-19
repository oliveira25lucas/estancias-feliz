import { test } from "node:test";
import assert from "node:assert/strict";
import {
  codigoDaReserva,
  diasJaOcupadosNoSite,
  ehReserva,
  finalDoTelefone,
  linkDaReserva,
  observacoesDaReserva,
  planejarBloqueios,
  planejarReservas,
  separarFeed,
  MOTIVO_BLOQUEIO_AIRBNB,
  NOME_HOSPEDE_AIRBNB,
} from "./airbnb-feed.ts";
import { lerICS, type EventoICS } from "./ical.ts";

function evento(parcial: Partial<EventoICS>): EventoICS {
  return {
    uid: "u@airbnb.com",
    inicio: "2026-09-10",
    fim: "2026-09-11",
    resumo: "Reserved",
    ...parcial,
  };
}

const DESCRICAO_RESERVA =
  "Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMABCDEFGH\n" +
  "Phone Number (Last 4 Digits): 1234";

// ============================================================
//  Reserva ou bloqueio
// ============================================================

test("evento com código de reserva é reserva", () => {
  assert.equal(ehReserva(evento({ descricao: DESCRICAO_RESERVA })), true);
});

test("'Reserved' sem descrição ainda é reserva", () => {
  assert.equal(ehReserva(evento({ resumo: "Reserved" })), true);
});

test("'Airbnb (Not available)' é bloqueio", () => {
  assert.equal(
    ehReserva(evento({ resumo: "Airbnb (Not available)", descricao: undefined })),
    false,
  );
});

test("'CLOSED - Not available' é bloqueio", () => {
  assert.equal(ehReserva(evento({ resumo: "CLOSED - Not available" })), false);
});

test("'Blocked' é bloqueio", () => {
  assert.equal(ehReserva(evento({ resumo: "Blocked" })), false);
});

test("resumo desconhecido vira BLOQUEIO, não reserva", () => {
  // Na dúvida, o erro barato: bloquear uma data a mais é reversível.
  // Inventar uma reserva dispara WhatsApp para a Maurizia e para os
  // donos por causa de um hóspede que não existe.
  assert.equal(ehReserva(evento({ resumo: "Sei lá o que é isso" })), false);
});

test("a descrição vence o resumo", () => {
  // A Airbnb já trocou o texto do resumo mais de uma vez; o código da
  // reserva na descrição é o sinal que não muda.
  assert.equal(
    ehReserva(evento({ resumo: "Texto novo qualquer", descricao: DESCRICAO_RESERVA })),
    true,
  );
});

// ============================================================
//  O que dá para extrair
// ============================================================

test("extrai o código, o final do telefone e o link", () => {
  const e = evento({ descricao: DESCRICAO_RESERVA });
  assert.equal(codigoDaReserva(e), "HMABCDEFGH");
  assert.equal(finalDoTelefone(e), "1234");
  assert.equal(
    linkDaReserva(e),
    "https://www.airbnb.com/hosting/reservations/details/HMABCDEFGH",
  );
});

test("evento sem descrição não inventa dado nenhum", () => {
  const e = evento({ descricao: undefined });
  assert.equal(codigoDaReserva(e), null);
  assert.equal(finalDoTelefone(e), null);
  assert.equal(linkDaReserva(e), null);
});

test("as observações trazem o link e dizem por que não há nome", () => {
  const texto = observacoesDaReserva(evento({ descricao: DESCRICAO_RESERVA }));
  assert.match(texto, /HMABCDEFGH/);
  assert.match(texto, /1234/);
  assert.match(texto, /hosting\/reservations/);
  // Quem abrir o painel daqui a um ano precisa entender por que a
  // reserva está sem nome, sem ter que perguntar a ninguém.
  assert.match(texto, /não envia nome nem telefone completo/);
});

// ============================================================
//  O feed inteiro
// ============================================================

const FEED = [
  "BEGIN:VCALENDAR",
  "PRODID:-//Airbnb Inc//Hosting Calendar 1.0.0//EN",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "DTEND;VALUE=DATE:20260912",
  "DTSTART;VALUE=DATE:20260910",
  "UID:reserva-1@airbnb.com",
  "SUMMARY:Reserved",
  "DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations",
  " /details/HMABCDEFGH\\nPhone Number (Last 4 Digits): 1234",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTEND;VALUE=DATE:20260922",
  "DTSTART;VALUE=DATE:20260920",
  "UID:bloqueio-1@airbnb.com",
  "SUMMARY:Airbnb (Not available)",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

test("separa o feed em uma reserva e um bloqueio", () => {
  const { reservas, bloqueios } = separarFeed(lerICS(FEED));
  assert.equal(reservas.length, 1);
  assert.equal(bloqueios.length, 1);
});

test("a reserva importada ganha o dia da limpeza", () => {
  const { reservas } = separarFeed(lerICS(FEED));
  // A Airbnb disse 10 a 12 (sai dia 12). O sítio ocupa até o dia 12.
  assert.equal(reservas[0].data_checkin, "2026-09-10");
  assert.equal(reservas[0].data_checkout, "2026-09-12");
  assert.equal(reservas[0].nome_cliente, NOME_HOSPEDE_AIRBNB);
  assert.equal(reservas[0].uid_externo, "reserva-1@airbnb.com");
});

test("o bloqueio importado NÃO ganha o dia da limpeza", () => {
  const { bloqueios } = separarFeed(lerICS(FEED));
  // 20 a 22 exclusivo = dias 20 e 21. Ninguém está saindo daqui.
  assert.equal(bloqueios[0].data_inicio, "2026-09-20");
  assert.equal(bloqueios[0].data_fim, "2026-09-21");
  assert.equal(bloqueios[0].motivo, MOTIVO_BLOQUEIO_AIRBNB);
});

test("UID repetido entra uma vez só", () => {
  const eventos = [
    evento({ uid: "igual@airbnb.com", descricao: DESCRICAO_RESERVA }),
    evento({ uid: "igual@airbnb.com", descricao: DESCRICAO_RESERVA }),
  ];
  assert.equal(separarFeed(eventos).reservas.length, 1);
});

test("evento sem UID é ignorado", () => {
  const { reservas, bloqueios } = separarFeed([evento({ uid: "" })]);
  assert.equal(reservas.length, 0);
  assert.equal(bloqueios.length, 0);
});

test("feed vazio não gera nada", () => {
  assert.deepEqual(separarFeed([]), { reservas: [], bloqueios: [] });
});

// ============================================================
//  O plano de reconciliação
//
//  Estes testes são sobre destruição: o que este código cancela e
//  apaga sozinho, de 15 em 15 minutos, sem ninguém olhando.
// ============================================================

function importada(uid: string, checkin: string, checkout: string) {
  return {
    uid_externo: uid,
    data_checkin: checkin,
    data_checkout: checkout,
    nome_cliente: NOME_HOSPEDE_AIRBNB,
    observacoes: "",
  };
}

function jaNoBanco(
  uid: string | null,
  checkin: string,
  checkout: string,
  status = "CONFIRMADA",
  nome_cliente = NOME_HOSPEDE_AIRBNB,
) {
  return {
    id: `id-${uid ?? "sem-uid"}`,
    uid_externo: uid,
    data_checkin: checkin,
    data_checkout: checkout,
    status,
    nome_cliente,
  };
}

test("reserva que ainda não existe é criada", () => {
  const plano = planejarReservas([importada("a", "2026-09-10", "2026-09-12")], []);
  assert.equal(plano.criar.length, 1);
  assert.equal(plano.atualizar.length, 0);
  assert.equal(plano.cancelar.length, 0);
});

test("reserva sem mudança nenhuma não gera escrita", () => {
  const plano = planejarReservas(
    [importada("a", "2026-09-10", "2026-09-12")],
    [jaNoBanco("a", "2026-09-10", "2026-09-12")],
  );
  assert.deepEqual(plano.criar, []);
  assert.deepEqual(plano.atualizar, []);
  assert.deepEqual(plano.cancelar, []);
});

test("hóspede que remarcou tem as datas atualizadas", () => {
  const plano = planejarReservas(
    [importada("a", "2026-09-17", "2026-09-19")],
    [jaNoBanco("a", "2026-09-10", "2026-09-12")],
  );
  assert.equal(plano.atualizar.length, 1);
  assert.deepEqual(plano.atualizar[0].campos, {
    data_checkin: "2026-09-17",
    data_checkout: "2026-09-19",
  });
});

test("reserva que sumiu do feed é CANCELADA, não apagada", () => {
  const plano = planejarReservas([], [jaNoBanco("a", "2026-09-10", "2026-09-12")]);
  assert.equal(plano.cancelar.length, 1);
  assert.equal(plano.cancelar[0].id, "id-a");
});

test("reserva já cancelada não é cancelada de novo", () => {
  // Sem isto, toda passada do importador reescreveria as mesmas linhas
  // e — com o aviso ligado — repetiria o WhatsApp de cancelamento.
  const plano = planejarReservas(
    [],
    [jaNoBanco("a", "2026-09-10", "2026-09-12", "CANCELADA")],
  );
  assert.deepEqual(plano.cancelar, []);
});

test("reserva cancelada que voltou ao feed ressuscita", () => {
  const plano = planejarReservas(
    [importada("a", "2026-09-10", "2026-09-12")],
    [jaNoBanco("a", "2026-09-10", "2026-09-12", "CANCELADA")],
  );
  assert.equal(plano.criar.length, 0);
  assert.deepEqual(plano.atualizar[0].campos, { status: "CONFIRMADA" });
});

test("o nome escrito à mão nunca é sobrescrito", () => {
  // O Lucas abriu o link da Airbnb, viu que é a Marina e digitou.
  // A Airbnb não manda nome nenhum — se este código mandasse, apagaria.
  const plano = planejarReservas(
    [importada("a", "2026-09-17", "2026-09-19")],
    [jaNoBanco("a", "2026-09-10", "2026-09-12", "CONFIRMADA", "Marina Alves")],
  );
  assert.equal(plano.atualizar.length, 1);
  assert.equal("nome_cliente" in plano.atualizar[0].campos, false);
});

test("linha sem uid_externo é intocável", () => {
  // Uma reserva marcada como origem=airbnb mas sem UID não veio deste
  // importador. Cancelá-la seria mexer no que não é dele.
  const plano = planejarReservas([], [jaNoBanco(null, "2026-09-10", "2026-09-12")]);
  assert.deepEqual(plano.cancelar, []);
});

test("bloqueio que sumiu do feed é removido", () => {
  const plano = planejarBloqueios(
    [],
    [
      {
        id: "b1",
        uid_externo: "x",
        data_inicio: "2026-09-20",
        data_fim: "2026-09-21",
      },
    ],
  );
  assert.equal(plano.remover.length, 1);
  assert.equal(plano.remover[0].id, "b1");
});

test("bloqueio com data mudada é atualizado, não recriado", () => {
  const plano = planejarBloqueios(
    [
      {
        uid_externo: "x",
        data_inicio: "2026-09-20",
        data_fim: "2026-09-25",
        motivo: MOTIVO_BLOQUEIO_AIRBNB,
      },
    ],
    [
      {
        id: "b1",
        uid_externo: "x",
        data_inicio: "2026-09-20",
        data_fim: "2026-09-21",
      },
    ],
  );
  assert.equal(plano.criar.length, 0);
  assert.equal(plano.remover.length, 0);
  assert.deepEqual(plano.atualizar[0].campos, { data_fim: "2026-09-25" });
});

test("bloqueio sem uid_externo é intocável", () => {
  const plano = planejarBloqueios(
    [],
    [
      {
        id: "manual",
        uid_externo: null,
        data_inicio: "2026-09-20",
        data_fim: "2026-09-21",
      },
    ],
  );
  assert.deepEqual(plano.remover, []);
});

// ============================================================
//  O site é a fonte da verdade
//
//  Antes desta sincronia existir, toda reserva da Airbnb chegava ao
//  sítio digitada à mão no painel. Essas linhas continuam lá, e criar a
//  versão da Airbnb por cima delas dobraria a agenda — e o lembrete de
//  7 dias, que é por linha, sairia duas vezes para a Maurizia.
// ============================================================

test("dias ocupados ignoram o que já veio da Airbnb", () => {
  // Senão a cobertura se auto-alimentaria e nada seria criado nunca.
  const dias = diasJaOcupadosNoSite([
    {
      data_checkin: "2026-09-10",
      data_checkout: "2026-09-12",
      status: "CONFIRMADA",
      origem: "airbnb",
    },
  ]);
  assert.equal(dias.size, 0);
});

test("dias ocupados ignoram reserva cancelada", () => {
  const dias = diasJaOcupadosNoSite([
    {
      data_checkin: "2026-09-10",
      data_checkout: "2026-09-12",
      status: "CANCELADA",
      origem: "admin",
    },
  ]);
  assert.equal(dias.size, 0);
});

test("reserva do site conta as duas pontas, saída incluída", () => {
  const dias = diasJaOcupadosNoSite([
    {
      data_checkin: "2026-09-10",
      data_checkout: "2026-09-12",
      status: "CONFIRMADA",
      origem: "admin",
    },
  ]);
  assert.deepEqual([...dias].sort(), ["2026-09-10", "2026-09-11", "2026-09-12"]);
});

test("reserva que o site já tem à mão é IGNORADA, não duplicada", () => {
  // O caso real de 19/08/2026: a reserva de 29 a 30/08 estava nos dois
  // lados, e o importador criaria a segunda linha.
  const jaOcupados = diasJaOcupadosNoSite([
    {
      data_checkin: "2026-08-29",
      data_checkout: "2026-08-30",
      status: "CONFIRMADA",
      origem: "admin",
    },
  ]);

  const plano = planejarReservas(
    [importada("a", "2026-08-29", "2026-08-30")],
    [],
    jaOcupados,
  );

  assert.deepEqual(plano.criar, []);
  assert.equal(plano.ignorar.length, 1);
  assert.deepEqual(plano.conflitos, []);
});

test("apagada a linha manual, a próxima passada cria a da Airbnb", () => {
  // É o que torna ignorar seguro: a data nunca fica desprotegida.
  const plano = planejarReservas(
    [importada("a", "2026-08-29", "2026-08-30")],
    [],
    diasJaOcupadosNoSite([]),
  );
  assert.equal(plano.criar.length, 1);
  assert.deepEqual(plano.ignorar, []);
});

test("sobreposição parcial é criada E grita", () => {
  // O site tem 29 a 30; a Airbnb diz 29 a 31. O dia 31 precisa
  // bloquear, mas isso é choque de datas de verdade.
  const jaOcupados = diasJaOcupadosNoSite([
    {
      data_checkin: "2026-08-29",
      data_checkout: "2026-08-30",
      status: "CONFIRMADA",
      origem: "admin",
    },
  ]);

  const plano = planejarReservas(
    [importada("a", "2026-08-29", "2026-08-31")],
    [],
    jaOcupados,
  );

  assert.equal(plano.criar.length, 1);
  assert.equal(plano.conflitos.length, 1);
  assert.deepEqual(plano.ignorar, []);
});

test("data totalmente livre no site é criada sem alarde", () => {
  const jaOcupados = diasJaOcupadosNoSite([
    {
      data_checkin: "2026-08-29",
      data_checkout: "2026-08-30",
      status: "CONFIRMADA",
      origem: "admin",
    },
  ]);

  const plano = planejarReservas(
    [importada("nova", "2026-12-05", "2026-12-07")],
    [],
    jaOcupados,
  );

  assert.equal(plano.criar.length, 1);
  assert.deepEqual(plano.ignorar, []);
  assert.deepEqual(plano.conflitos, []);
});
