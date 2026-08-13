import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contextoDoLeadParaJulia,
  listaAgenda,
  mensagemCanceladaParaFaxineira,
  mensagemCanceladaParaGrupo,
  mensagemLeadNovo,
  mensagemLeadRetomada,
  mensagemLembreteParaFaxineira,
  mensagemLembreteParaGrupo,
  mensagemNovaParaFaxineira,
  mensagemNovaParaGrupo,
  primeiroNome,
  temDatas,
  type LeadAviso,
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
  assert.match(texto, /Ana Paula · 30 pessoas$/m);
  assert.match(texto, /⬅️ NOVO/);
});

test("pessoas ausente não deixa separador solto nem NaN", () => {
  const texto = mensagemNovaParaGrupo(
    { ...NOVA, qtd_pessoas: null, valor_final: null },
    AGENDA,
  );
  assert.match(texto, /^Ana Paula$/m);
  assert.doesNotMatch(texto, /NaN/);
  assert.doesNotMatch(texto, /· *$/m);
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

test("o valor nunca sai em aviso interno", () => {
  // O grupo é agenda, não financeiro, e mensagem de WhatsApp é
  // encaminhada com um toque. `NOVA` tem valor_final preenchido de
  // propósito: o dado existe e a escolha é não imprimir. As mensagens de
  // lead são outra história — lá o valor vai para o próprio cliente.
  const internas = [
    mensagemNovaParaGrupo(NOVA, AGENDA),
    mensagemCanceladaParaGrupo(NOVA, AGENDA),
    mensagemLembreteParaGrupo(NOVA, true),
    mensagemNovaParaFaxineira(NOVA, AGENDA),
    mensagemCanceladaParaFaxineira(NOVA, AGENDA),
    mensagemLembreteParaFaxineira(NOVA),
  ];
  for (const texto of internas) {
    assert.doesNotMatch(texto, /R\$/);
    assert.doesNotMatch(texto, /3\.685|3685/);
  }
});

// ---------- Faxineira ----------

test("a faxineira recebe entrada, saída, horários e quantas pessoas", () => {
  const texto = mensagemNovaParaFaxineira(NOVA, AGENDA);
  assert.match(texto, /^Oi, Maurizia! Tudo bem\? 🏡/);
  assert.match(texto, /\*Entrada:\* sexta, 20\/11\/2026, 8h/);
  assert.match(texto, /\*Saída:\* domingo, 22\/11\/2026, 16h/);
  assert.match(texto, /\*Pessoas:\* 30/);
});

test("nenhum aviso estipula prazo de limpeza", () => {
  // Quando a Maurizia limpa é combinado entre ela e o Lucas. O aviso dá o
  // fato — as datas — e não dá ordem.
  for (const texto of [
    mensagemNovaParaFaxineira(NOVA, AGENDA),
    mensagemLembreteParaFaxineira(NOVA),
  ]) {
    assert.doesNotMatch(texto, /pronta até|precisa estar pronta/);
  }
});

test("a faxineira recebe a agenda completa junto", () => {
  const texto = mensagemNovaParaFaxineira(NOVA, AGENDA);
  assert.match(texto, /\*PRÓXIMOS ALUGUÉIS — 5 no total\*/);
  assert.match(texto, /⬅️ NOVO/);
});

test("o lembrete de 7 dias é recado, e termina nas datas", () => {
  const texto = mensagemLembreteParaFaxineira(NOVA);
  assert.match(texto, /\*Falta 1 semana\*/);
  assert.match(texto, /\*Entrada:\* sexta, 20\/11\/2026, 8h/);
  // Nada de cobrar resposta: a Júlia está calada para o número dela, então
  // pergunta de robô fica sem ninguém do outro lado.
  assert.doesNotMatch(texto, /\?/);
  assert.match(texto, /\*Pessoas:\* 30$/);
});

// ============================================================
//  Mensagens para o lead do site
//
//  Estas duas são as ÚNICAS que saem para um cliente sem que ele tenha
//  escrito primeiro. O texto errado aqui não incomoda um colega — chega
//  em quem ainda está decidindo se aluga.
// ============================================================

function lead(campos: Partial<LeadAviso> & { nome: string }): LeadAviso {
  return {
    checkin: null,
    checkout: null,
    pessoas: null,
    ocasiao: null,
    valor_calculado: null,
    hidromassagem: null,
    periodo_desejado: null,
    ...campos,
  };
}

const LEAD_COM_DATA: LeadAviso = lead({
  nome: "Ana Paula Ferreira",
  checkin: "2026-11-20",
  checkout: "2026-11-22",
  pessoas: 20,
  ocasiao: "Aniversário",
  valor_calculado: 3600,
  disponivel: true,
});

test("o primeiro nome é o que a mensagem usa", () => {
  assert.equal(primeiroNome("Ana Paula Ferreira"), "Ana");
  assert.equal(primeiroNome("  Lucas  "), "Lucas");
});

test("a primeira mensagem recapitula período, pessoas e valor", () => {
  const texto = mensagemLeadNovo(LEAD_COM_DATA);
  assert.match(texto, /^Oi, Ana! Tudo bem\? 🏡/);
  assert.match(texto, /\*20\/11\/2026 a 22\/11\/2026\* · sex a dom/);
  assert.match(texto, /20 pessoas · Aniversário/);
  assert.match(texto, /\*R\$\s3\.600,00\* pela estadia/);
  assert.match(texto, /R\$\s500,00 de caução, que volta integral no final\./);
});

test("data livre é afirmada só quando a agenda confirmou", () => {
  assert.match(
    mensagemLeadNovo(LEAD_COM_DATA),
    /Essa data ainda está livre\./,
  );
  // Sem confirmação da agenda, não se promete disponibilidade.
  const semConferir = mensagemLeadNovo({ ...LEAD_COM_DATA, disponivel: null });
  assert.doesNotMatch(semConferir, /ainda está livre/);
  assert.match(semConferir, /já posso confirmar essa data pra você\?/);
});

test("a hidromassagem aparece quando foi pedida", () => {
  assert.match(
    mensagemLeadNovo({ ...LEAD_COM_DATA, hidromassagem: true }),
    /Com hidromassagem/,
  );
  assert.doesNotMatch(mensagemLeadNovo(LEAD_COM_DATA), /hidromassagem/i);
});

test("lead sem data pede a data, e não repete valor nenhum", () => {
  const texto = mensagemLeadNovo(
    lead({
      nome: "Marcos",
      pessoas: 30,
      ocasiao: "Casamento",
      periodo_desejado: "novembro",
    }),
  );
  assert.match(texto, /30 pessoas · Casamento/);
  assert.match(texto, /Época pretendida: novembro/);
  assert.match(texto, /Me fala uma data que você tem em mente/);
  assert.doesNotMatch(texto, /R\$/);
});

test("a retomada é curta e oferece uma saída explícita", () => {
  const texto = mensagemLeadRetomada(LEAD_COM_DATA);
  assert.match(texto, /^Oi, Ana! A Júlia de novo/);
  assert.match(texto, /\*20\/11\/2026 a 22\/11\/2026\*/);
  assert.match(texto, /A data continua livre por aqui\./);
  // A saída não é opcional: é o que segura o número contra denúncia.
  assert.match(texto, /é só me falar que eu não te incomodo mais/);
  // Nada de repetir o valor: quem não respondeu não quer textão.
  assert.doesNotMatch(texto, /R\$/);
});

// ---- Contexto que a Júlia recebe ----

test("o contexto proíbe a Júlia de pedir de novo o que já foi informado", () => {
  const texto = contextoDoLeadParaJulia(LEAD_COM_DATA, "2026-08-12");
  assert.match(texto, /^\[12\/08\/2026 · vindo do site\]/);
  assert.match(texto, /Ana Paula Ferreira preencheu a calculadora/);
  assert.match(texto, /Período pedido: 20\/11\/2026 a 22\/11\/2026\./);
  assert.match(texto, /mostrou para ela na tela: R\$\s3\.600,00/);
  assert.match(texto, /Pessoas: 20\./);
  assert.match(texto, /NÃO peça de novo data nem número de pessoas/);
});

test("período ocupado entra no contexto como alerta", () => {
  assert.match(
    contextoDoLeadParaJulia(
      { ...LEAD_COM_DATA, disponivel: false },
      "2026-08-12",
    ),
    /ATENÇÃO: esse período NÃO estava livre/,
  );
});
