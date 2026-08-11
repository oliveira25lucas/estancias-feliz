import { test } from "node:test";
import assert from "node:assert/strict";
import { periodosColidem } from "./ocupacao.ts";

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
