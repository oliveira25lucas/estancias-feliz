import { test } from "node:test";
import assert from "node:assert/strict";
import {
  alternativasProximas,
  diasOcupadosDaLista,
  finsDeSemanaLivres,
  periodoLivre,
  periodosColidem,
  podeSerEntrada,
  saidaMaxima,
} from "./ocupacao.ts";

/**
 * A data de saída conta como ocupada: o hóspede sai às 16h e ainda há
 * limpeza, então o sítio só volta a ficar livre no dia seguinte.
 * Estes casos travam essa regra.
 */

test("quem sai no domingo ocupa o domingo", () => {
  // Reserva de sexta 14 a domingo 16.
  // Outro grupo querendo entrar no domingo 16 colide.
  assert.equal(
    periodosColidem("2026-08-16", "2026-08-18", "2026-08-14", "2026-08-16"),
    true,
  );
});

test("a segunda seguinte já está livre", () => {
  assert.equal(
    periodosColidem("2026-08-17", "2026-08-19", "2026-08-14", "2026-08-16"),
    false,
  );
});

test("entrar no dia da entrada de outro grupo colide", () => {
  assert.equal(
    periodosColidem("2026-08-14", "2026-08-15", "2026-08-14", "2026-08-16"),
    true,
  );
});

test("um período contido no outro colide", () => {
  assert.equal(
    periodosColidem("2026-08-15", "2026-08-15", "2026-08-14", "2026-08-16"),
    true,
  );
});

test("períodos bem separados não colidem", () => {
  assert.equal(
    periodosColidem("2026-09-10", "2026-09-12", "2026-08-14", "2026-08-16"),
    false,
  );
});

test("sair na véspera da entrada do outro não colide", () => {
  // Sai dia 16; o próximo entra dia 17. Sem choque.
  assert.equal(
    periodosColidem("2026-08-14", "2026-08-16", "2026-08-17", "2026-08-20"),
    false,
  );
});

// ============================================================
//  A agenda como conjunto de dias
//
//  É este conjunto que o calendário do site consulta para decidir em
//  que dia dá para clicar. Errar aqui é deixar alguém escolher uma data
//  que já está vendida.
// ============================================================

/** Reserva de sexta 14 a domingo 16 de agosto de 2026. */
const AGENDA = new Set(
  diasOcupadosDaLista(
    [{ inicio: "2026-08-14", fim: "2026-08-16" }],
    "2026-08-01",
    "2026-08-31",
  ),
);

test("a lista de dias inclui as duas pontas do período", () => {
  assert.deepEqual(
    diasOcupadosDaLista(
      [{ inicio: "2026-08-14", fim: "2026-08-16" }],
      "2026-08-01",
      "2026-08-31",
    ),
    ["2026-08-14", "2026-08-15", "2026-08-16"],
  );
});

test("períodos sobrepostos não repetem dias, e saem em ordem", () => {
  assert.deepEqual(
    diasOcupadosDaLista(
      [
        { inicio: "2026-08-15", fim: "2026-08-16" },
        { inicio: "2026-08-14", fim: "2026-08-15" },
      ],
      "2026-08-01",
      "2026-08-31",
    ),
    ["2026-08-14", "2026-08-15", "2026-08-16"],
  );
});

test("a janela recorta o que está fora dela", () => {
  assert.deepEqual(
    diasOcupadosDaLista(
      [{ inicio: "2026-07-30", fim: "2026-08-02" }],
      "2026-08-01",
      "2026-08-31",
    ),
    ["2026-08-01", "2026-08-02"],
  );
});

test("período inteiramente fora da janela não devolve nada", () => {
  assert.deepEqual(
    diasOcupadosDaLista(
      [{ inicio: "2026-06-01", fim: "2026-06-10" }],
      "2026-08-01",
      "2026-08-31",
    ),
    [],
  );
});

test("não dá para entrar num dia ocupado", () => {
  assert.equal(podeSerEntrada("2026-08-15", AGENDA), false);
});

test("não dá para entrar na véspera de um dia ocupado", () => {
  // Entrar dia 13 obrigaria a sair dia 14, que já está vendido.
  assert.equal(podeSerEntrada("2026-08-13", AGENDA), false);
});

test("dá para entrar no dia seguinte à saída de outro grupo", () => {
  assert.equal(podeSerEntrada("2026-08-17", AGENDA), true);
});

test("a saída máxima para na véspera do próximo dia ocupado", () => {
  assert.equal(saidaMaxima("2026-08-10", AGENDA), "2026-08-13");
});

test("sem nada pela frente, a saída máxima respeita o teto de diárias", () => {
  assert.equal(saidaMaxima("2026-09-01", AGENDA, 3), "2026-09-04");
});

test("um dia livre espremido entre reservas não aceita entrada", () => {
  const espremido = new Set(
    diasOcupadosDaLista(
      [
        { inicio: "2026-08-14", fim: "2026-08-16" },
        { inicio: "2026-08-18", fim: "2026-08-20" },
      ],
      "2026-08-01",
      "2026-08-31",
    ),
  );
  assert.equal(saidaMaxima("2026-08-17", espremido), "");
  assert.equal(podeSerEntrada("2026-08-17", espremido), false);
});

test("um período que encosta na reserva não está livre", () => {
  assert.equal(periodoLivre("2026-08-12", "2026-08-14", AGENDA), false);
  assert.equal(periodoLivre("2026-08-11", "2026-08-13", AGENDA), true);
});

// ---- Alternativas oferecidas a quem pediu data ocupada ----

test("a alternativa mantém o dia da semana e a quantidade de diárias", () => {
  const achadas = alternativasProximas("2026-08-14", "2026-08-16", AGENDA, {
    minimo: "2026-08-01",
    quantidade: 2,
  });
  // Sexta a domingo vira outra sexta a domingo, nunca uma terça a quinta.
  // A de depois vem primeiro: à mesma distância, sobra tempo de organizar.
  assert.deepEqual(achadas, [
    { entrada: "2026-08-21", saida: "2026-08-23" },
    { entrada: "2026-08-07", saida: "2026-08-09" },
  ]);
});

test("a alternativa nunca cai antes do mínimo pedido", () => {
  const achadas = alternativasProximas("2026-08-14", "2026-08-16", AGENDA, {
    minimo: "2026-08-14",
    quantidade: 2,
  });
  assert.deepEqual(achadas, [
    { entrada: "2026-08-21", saida: "2026-08-23" },
    { entrada: "2026-08-28", saida: "2026-08-30" },
  ]);
});

// ---- Fins de semana livres ----

test("os fins de semana livres pulam os que já estão vendidos", () => {
  // 2026-08-10 é uma segunda; a próxima sexta é 14, que está ocupada.
  assert.deepEqual(finsDeSemanaLivres(AGENDA, "2026-08-10", 2), [
    { checkin: "2026-08-21", checkout: "2026-08-23" },
    { checkin: "2026-08-28", checkout: "2026-08-30" },
  ]);
});

test("numa sexta, a busca começa no fim de semana seguinte", () => {
  // Ninguém reserva sítio para daqui a algumas horas.
  assert.deepEqual(finsDeSemanaLivres(new Set(), "2026-08-07", 1), [
    { checkin: "2026-08-14", checkout: "2026-08-16" },
  ]);
});
