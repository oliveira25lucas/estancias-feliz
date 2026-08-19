import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bloqueioParaPeriodo,
  eventoParaReserva,
  eventosDaAgenda,
  lerICS,
  montarICS,
  reservaParaEvento,
  type EventoICS,
} from "./ical.ts";
import { diasOcupados } from "./ocupacao.ts";

/** DTSTAMP fixo: sem isto o arquivo mudaria a cada execução do teste. */
const AGORA = new Date("2026-08-19T12:00:00.000Z");

function montar(eventos: EventoICS[]): string {
  return montarICS(eventos, { nome: "Sítio Estâncias Feliz", agora: AGORA });
}

function evento(inicio: string, fim: string, resumo = "Reservado"): EventoICS {
  return { uid: `${inicio}-${fim}@teste`, inicio, fim, resumo };
}

// ============================================================
//  O dia da saída — a regra que evita vender duas vezes
//
//  Estes são os testes que importam. Todo o resto do arquivo é
//  formato; estes são dinheiro e a Maurizia chegando numa casa com
//  gente dentro.
// ============================================================

test("uma reserva de 01 a 03 bloqueia os dias 1, 2 e 3 na Airbnb", () => {
  // O sítio guarda check-out 03 e considera o dia 3 ocupado (limpeza).
  // Em iCal isso é DTEND=04, porque DTEND é exclusivo.
  const e = reservaParaEvento(
    { data_checkin: "2026-09-01", data_checkout: "2026-09-03" },
    { uid: "x@teste", resumo: "Reservado" },
  );
  assert.equal(e.inicio, "2026-09-01");
  assert.equal(e.fim, "2026-09-03");

  const ics = montar([e]);
  assert.match(ics, /DTSTART;VALUE=DATE:20260901/);
  assert.match(ics, /DTEND;VALUE=DATE:20260904/);
});

test("o dia seguinte à saída continua livre para a Airbnb vender", () => {
  const ics = montar([evento("2026-09-01", "2026-09-03")]);
  // DTEND=04 quer dizer "o dia 4 já não faz parte do evento".
  assert.match(ics, /DTEND;VALUE=DATE:20260904/);
  assert.doesNotMatch(ics, /DTEND;VALUE=DATE:20260905/);
});

test("reserva da Airbnb ganha o dia da limpeza ao entrar no sítio", () => {
  // A Airbnb diz: entra dia 10, sai dia 12. O hóspede dorme 10 e 11.
  // O sítio precisa do dia 12 ocupado também — é o dia da limpeza.
  const daAirbnb: EventoICS = {
    uid: "abc@airbnb.com",
    inicio: "2026-09-10",
    fim: "2026-09-11", // última noite dormida
    resumo: "Reserved",
  };

  const reserva = eventoParaReserva(daAirbnb);
  assert.equal(reserva.data_checkin, "2026-09-10");
  assert.equal(reserva.data_checkout, "2026-09-12");

  // E o efeito prático: três dias ocupados, e o 13 livre.
  const ocupados = diasOcupados(reserva.data_checkin, reserva.data_checkout);
  assert.deepEqual(ocupados, ["2026-09-10", "2026-09-11", "2026-09-12"]);
});

test("bloqueio da Airbnb NÃO ganha dia de limpeza", () => {
  // Ninguém está saindo de um bloqueio: não há o que limpar. Somar um
  // dia aqui tiraria uma diária do mercado sem motivo.
  const bloqueio: EventoICS = {
    uid: "def@airbnb.com",
    inicio: "2026-09-20",
    fim: "2026-09-21",
    resumo: "Airbnb (Not available)",
  };

  assert.deepEqual(bloqueioParaPeriodo(bloqueio), {
    data_inicio: "2026-09-20",
    data_fim: "2026-09-21",
  });
});

test("ida e volta pelo arquivo preserva o último dia ocupado", () => {
  const original = evento("2026-12-30", "2027-01-02");
  const [lido] = lerICS(montar([original]));

  assert.equal(lido.inicio, "2026-12-30");
  // Atravessa a virada do ano sem escorregar um dia.
  assert.equal(lido.fim, "2027-01-02");
});

test("uma diária só sobrevive à ida e à volta", () => {
  const [lido] = lerICS(montar([evento("2026-09-05", "2026-09-05")]));
  assert.equal(lido.inicio, "2026-09-05");
  assert.equal(lido.fim, "2026-09-05");
});

// ============================================================
//  Ler o que a Airbnb manda de verdade
// ============================================================

/**
 * Recorte fiel de um feed da Airbnb: DTEND antes de DTSTART, UID com
 * arroba, e a DESCRIPTION que eles passaram a mandar desde que
 * removeram o nome do hóspede (dezembro de 2019). Os `\\n` são a
 * barra invertida literal que existe dentro do arquivo.
 */
const FEED_AIRBNB = [
  "BEGIN:VCALENDAR",
  "PRODID:-//Airbnb Inc//Hosting Calendar 1.0.0//EN",
  "CALSCALE:GREGORIAN",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "DTEND;VALUE=DATE:20260912",
  "DTSTART;VALUE=DATE:20260910",
  "UID:1234567890abcdef@airbnb.com",
  "SUMMARY:Reserved",
  "DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservatio",
  " ns/details/HMABCDEFGH\\nPhone Number (Last 4 Digits): 1234",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTEND;VALUE=DATE:20260922",
  "DTSTART;VALUE=DATE:20260920",
  "UID:fedcba0987654321@airbnb.com",
  "SUMMARY:Airbnb (Not available)",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

test("lê os dois eventos do feed da Airbnb", () => {
  const eventos = lerICS(FEED_AIRBNB);
  assert.equal(eventos.length, 2);
  assert.equal(eventos[0].uid, "1234567890abcdef@airbnb.com");
  assert.equal(eventos[0].resumo, "Reserved");
  assert.equal(eventos[1].resumo, "Airbnb (Not available)");
});

test("a reserva do feed vira 10 a 12 no sítio", () => {
  const [reserva] = lerICS(FEED_AIRBNB);
  assert.equal(reserva.inicio, "2026-09-10");
  assert.equal(reserva.fim, "2026-09-11");
  assert.deepEqual(eventoParaReserva(reserva), {
    data_checkin: "2026-09-10",
    data_checkout: "2026-09-12",
  });
});

test("a linha dobrada da DESCRIPTION é remontada inteira", () => {
  const [reserva] = lerICS(FEED_AIRBNB);
  // Sem desdobrar, o código da reserva sairia partido no meio.
  assert.match(reserva.descricao ?? "", /HMABCDEFGH/);
  // E o \n escapado vira quebra de linha de verdade.
  assert.match(reserva.descricao ?? "", /\nPhone Number/);
});

test("feed que chega só com LF ainda é lido", () => {
  // Não é o que a Airbnb manda, mas é o que sobra quando o arquivo
  // passa por um editor. Devolver zero evento aqui seria lido como
  // 'não há reserva nenhuma' — a falha mais cara possível.
  const eventos = lerICS(FEED_AIRBNB.replace(/\r\n/g, "\n"));
  assert.equal(eventos.length, 2);
});

test("evento sem UID é descartado sem derrubar os outros", () => {
  const feed = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "DTSTART;VALUE=DATE:20260901",
    "DTEND;VALUE=DATE:20260903",
    "SUMMARY:Sem identidade",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:bom@airbnb.com",
    "DTSTART;VALUE=DATE:20261001",
    "DTEND;VALUE=DATE:20261003",
    "SUMMARY:Reserved",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const eventos = lerICS(feed);
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].uid, "bom@airbnb.com");
});

test("evento sem DTEND dura um dia", () => {
  const feed = [
    "BEGIN:VEVENT",
    "UID:um-dia@airbnb.com",
    "DTSTART;VALUE=DATE:20260901",
    "SUMMARY:Reserved",
    "END:VEVENT",
  ].join("\r\n");

  const [e] = lerICS(feed);
  assert.equal(e.inicio, "2026-09-01");
  assert.equal(e.fim, "2026-09-01");
});

test("DTEND com hora pertence ao dia em que acontece", () => {
  // DATE-TIME é um instante, não um dia inteiro: aqui DTEND NÃO é
  // exclusivo por dia, e subtrair 24h perderia o dia 3.
  const feed = [
    "BEGIN:VEVENT",
    "UID:com-hora@exemplo.com",
    "DTSTART:20260901T140000Z",
    "DTEND:20260903T110000Z",
    "SUMMARY:Reserved",
    "END:VEVENT",
  ].join("\r\n");

  const [e] = lerICS(feed);
  assert.equal(e.inicio, "2026-09-01");
  assert.equal(e.fim, "2026-09-03");
});

test("DTEND antes de DTSTART não gera período invertido", () => {
  const feed = [
    "BEGIN:VEVENT",
    "UID:torto@exemplo.com",
    "DTSTART;VALUE=DATE:20260910",
    "DTEND;VALUE=DATE:20260901",
    "SUMMARY:Reserved",
    "END:VEVENT",
  ].join("\r\n");

  const [e] = lerICS(feed);
  assert.equal(e.fim, "2026-09-10");
});

test("calendário vazio devolve lista vazia, não erro", () => {
  assert.deepEqual(lerICS("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n"), []);
  assert.deepEqual(lerICS(""), []);
});

// ============================================================
//  Formato do arquivo
// ============================================================

test("o arquivo é separado e terminado por CRLF", () => {
  const ics = montar([evento("2026-09-01", "2026-09-03")]);
  assert.ok(ics.endsWith("\r\n"));
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  // Nenhum LF solto: todo \n é precedido de \r.
  assert.equal(/(?<!\r)\n/.test(ics), false);
});

test("nenhuma linha passa de 75 octetos", () => {
  const ics = montarICS(
    [
      {
        uid: "longo@estanciasfeliz.com.br",
        inicio: "2026-09-01",
        fim: "2026-09-03",
        resumo: "Indisponível",
        descricao:
          "Manutenção da piscina e da área de churrasco, com troca de " +
          "acentuação suficiente para atravessar o limite de setenta e " +
          "cinco octetos mais de uma vez em português",
      },
    ],
    { nome: "Sítio Estâncias Feliz", agora: AGORA },
  );

  const codificador = new TextEncoder();
  for (const linha of ics.split("\r\n")) {
    assert.ok(
      codificador.encode(linha).length <= 75,
      `linha com ${codificador.encode(linha).length} octetos: ${linha}`,
    );
  }
});

test("a dobra sobrevive à volta, com acento e tudo", () => {
  const descricao =
    "Manutenção da piscina e da área de churrasco, com acentuação " +
    "suficiente para forçar a dobra em mais de uma linha do arquivo";

  const ics = montarICS(
    [
      {
        uid: "volta@estanciasfeliz.com.br",
        inicio: "2026-09-01",
        fim: "2026-09-03",
        resumo: "Indisponível",
        descricao,
      },
    ],
    { nome: "Sítio", agora: AGORA },
  );

  assert.equal(lerICS(ics)[0].descricao, descricao);
});

test("ponto e vírgula, vírgula e contrabarra sobrevivem", () => {
  const resumo = "Reservado; com vírgula, contrabarra \\ e fim";
  const ics = montarICS(
    [{ uid: "escape@teste", inicio: "2026-09-01", fim: "2026-09-01", resumo }],
    { nome: "Sítio", agora: AGORA },
  );

  assert.match(ics, /SUMMARY:Reservado\\; com vírgula\\, contrabarra \\\\ e fim/);
  assert.equal(lerICS(ics)[0].resumo, resumo);
});

test("o DTSTAMP é o mesmo em todos os eventos", () => {
  const ics = montar([
    evento("2026-09-01", "2026-09-03"),
    evento("2026-10-01", "2026-10-03"),
  ]);
  const carimbos = [...ics.matchAll(/DTSTAMP:(\S+)/g)].map((m) => m[1]);
  assert.deepEqual(carimbos, ["20260819T120000Z", "20260819T120000Z"]);
});

// ============================================================
//  O que a agenda publica — e o que ela nunca publica
// ============================================================

const RESERVAS = [
  {
    id: "r1",
    data_checkin: "2026-09-01",
    data_checkout: "2026-09-03",
    status: "CONFIRMADA",
    origem: "admin",
  },
  {
    id: "r2",
    data_checkin: "2026-10-10",
    data_checkout: "2026-10-12",
    status: "PENDENTE_CONTRATO",
    origem: "whatsapp",
  },
  {
    id: "r3",
    data_checkin: "2026-11-01",
    data_checkout: "2026-11-03",
    status: "CANCELADA",
    origem: "admin",
  },
  {
    id: "r4",
    data_checkin: "2026-12-01",
    data_checkout: "2026-12-03",
    status: "CONFIRMADA",
    origem: "airbnb",
  },
];

const BLOQUEIOS = [
  {
    id: "b1",
    data_inicio: "2026-09-20",
    data_fim: "2026-09-22",
    origem: "admin",
  },
  {
    id: "b2",
    data_inicio: "2026-12-20",
    data_fim: "2026-12-22",
    origem: "airbnb",
  },
];

test("reserva cancelada não é publicada", () => {
  const eventos = eventosDaAgenda(RESERVAS, []);
  assert.equal(
    eventos.some((e) => e.uid.includes("r3")),
    false,
  );
});

test("aguardando contrato É publicada — a data está segurada", () => {
  const eventos = eventosDaAgenda(RESERVAS, []);
  assert.ok(eventos.some((e) => e.uid.includes("r2")));
});

test("o que veio da Airbnb não volta para a Airbnb", () => {
  // Sem este filtro, cada importação alimentaria a exportação seguinte
  // e o dia de limpeza empilharia um dia a cada volta.
  const eventos = eventosDaAgenda(RESERVAS, BLOQUEIOS);
  assert.equal(
    eventos.some((e) => e.uid.includes("r4") || e.uid.includes("b2")),
    false,
  );
});

test("nome, telefone e motivo NUNCA saem no calendário", () => {
  const ics = montarICS(eventosDaAgenda(RESERVAS, BLOQUEIOS), {
    nome: "Sítio Estâncias Feliz",
    agora: AGORA,
  });

  // O resumo é uma palavra fixa. Qualquer coisa além disso seria dado
  // de cliente saindo de casa num arquivo que a Airbnb lê sem senha.
  for (const resumo of [...ics.matchAll(/SUMMARY:(.*)/g)].map((m) => m[1])) {
    assert.ok(
      ["Reservado", "Indisponível"].includes(resumo.trim()),
      `resumo inesperado no calendário público: ${resumo}`,
    );
  }
  assert.doesNotMatch(ics, /DESCRIPTION/);
});

test("os eventos saem ordenados por data de início", () => {
  const eventos = eventosDaAgenda(RESERVAS, BLOQUEIOS);
  const inicios = eventos.map((e) => e.inicio);
  assert.deepEqual(inicios, [...inicios].sort());
});

test("reserva sem as duas datas não vira evento", () => {
  const eventos = eventosDaAgenda(
    [
      {
        id: "sem-saida",
        data_checkin: "2026-09-01",
        data_checkout: null,
        status: "CONFIRMADA",
        origem: "whatsapp",
      },
    ],
    [],
  );
  assert.deepEqual(eventos, []);
});
