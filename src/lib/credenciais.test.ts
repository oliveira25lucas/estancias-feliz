import { test } from "node:test";
import assert from "node:assert/strict";
import {
  credenciaisCorretas,
  criarToken,
  lerToken,
  VALIDADE_SEGUNDOS,
} from "./credenciais.ts";

/**
 * A porta do painel. O que está atrás dela: telefone de todo mundo que
 * pediu orçamento, e o botão que dispara WhatsApp de verdade para o
 * grupo dos donos e para a Maurizia. Vale travar o comportamento.
 *
 * As variáveis são lidas na hora da chamada, não no import — é o que
 * permite trocar o ambiente no meio do teste.
 */

const SECRET = "0".repeat(64);

function ambiente(usuario?: string, senha?: string, secret?: string) {
  process.env.ADMIN_USUARIO = usuario;
  process.env.ADMIN_SENHA = senha;
  process.env.ADMIN_SECRET = secret;
  if (usuario === undefined) delete process.env.ADMIN_USUARIO;
  if (senha === undefined) delete process.env.ADMIN_SENHA;
  if (secret === undefined) delete process.env.ADMIN_SECRET;
}

function ambientePadrao() {
  ambiente("oliveira25lucas", "senha-de-teste", SECRET);
}

// ------------------------------------------------------------------
//  Usuário + senha
// ------------------------------------------------------------------

test("usuário e senha certos entram", () => {
  ambientePadrao();
  assert.equal(credenciaisCorretas("oliveira25lucas", "senha-de-teste"), true);
});

test("senha certa com usuário errado não entra", () => {
  ambientePadrao();
  assert.equal(credenciaisCorretas("outro", "senha-de-teste"), false);
});

test("usuário certo com senha errada não entra", () => {
  ambientePadrao();
  assert.equal(credenciaisCorretas("oliveira25lucas", "chute"), false);
});

test("o usuário tolera maiúsculas e espaço colado", () => {
  ambientePadrao();
  assert.equal(
    credenciaisCorretas("  Oliveira25Lucas ", "senha-de-teste"),
    true,
  );
});

test("a senha não tolera nada — nem caixa, nem espaço", () => {
  ambientePadrao();
  assert.equal(credenciaisCorretas("oliveira25lucas", "Senha-De-Teste"), false);
  assert.equal(credenciaisCorretas("oliveira25lucas", " senha-de-teste"), false);
});

test("campo vazio não vira passe livre", () => {
  ambientePadrao();
  assert.equal(credenciaisCorretas("", ""), false);
  assert.equal(credenciaisCorretas("oliveira25lucas", ""), false);
});

test("sem variável de ambiente, ninguém entra e o erro diz o nome que falta", () => {
  ambiente(undefined, "senha-de-teste", SECRET);
  assert.throws(() => credenciaisCorretas("x", "y"), /ADMIN_USUARIO/);

  ambiente("oliveira25lucas", undefined, SECRET);
  assert.throws(() => credenciaisCorretas("x", "y"), /ADMIN_SENHA/);

  ambiente("oliveira25lucas", "senha-de-teste", "curto");
  assert.throws(() => credenciaisCorretas("x", "y"), /ADMIN_SECRET/);
});

// ------------------------------------------------------------------
//  Token de sessão
// ------------------------------------------------------------------

test("o token recém-criado é aceito e sabe de quem é", () => {
  ambientePadrao();
  const sessao = lerToken(criarToken());
  assert.equal(sessao?.usuario, "oliveira25lucas");
});

test("o token vence em 12 horas", () => {
  ambientePadrao();
  const agora = 1_760_000_000_000;
  const token = criarToken(agora);

  const umMinutoAntes = agora + VALIDADE_SEGUNDOS * 1000 - 60_000;
  assert.notEqual(lerToken(token, umMinutoAntes), null);

  const umMinutoDepois = agora + VALIDADE_SEGUNDOS * 1000 + 60_000;
  assert.equal(lerToken(token, umMinutoDepois), null);
});

test("lixo no lugar do token não derruba nada — só não entra", () => {
  ambientePadrao();
  for (const entrada of [undefined, "", "abc", "a.b", "....", "eyJ9.x"]) {
    assert.equal(lerToken(entrada), null, `entrada: ${String(entrada)}`);
  }
});

test("payload adulterado é recusado", () => {
  ambientePadrao();
  const [, assinatura] = criarToken().split(".");

  // Um ano de validade e o mesmo usuário, mas assinado por ninguém.
  const forjado = Buffer.from(
    JSON.stringify({ usuario: "oliveira25lucas", expiraEm: 4_000_000_000_000 }),
  ).toString("base64url");

  assert.equal(lerToken(`${forjado}.${assinatura}`), null);
});

test("token assinado com outro ADMIN_SECRET é recusado", () => {
  ambiente("oliveira25lucas", "senha-de-teste", "1".repeat(64));
  const token = criarToken();

  ambientePadrao();
  assert.equal(lerToken(token), null);
});

test("trocar a senha derruba a sessão que já estava aberta", () => {
  ambientePadrao();
  const token = criarToken();

  ambiente("oliveira25lucas", "senha-nova", SECRET);
  assert.equal(lerToken(token), null);
});

test("trocar o usuário também derruba a sessão", () => {
  ambientePadrao();
  const token = criarToken();

  ambiente("outro-nome", "senha-de-teste", SECRET);
  assert.equal(lerToken(token), null);
});

test("ambiente incompleto recusa o token em vez de explodir", () => {
  ambientePadrao();
  const token = criarToken();

  ambiente(undefined, undefined, undefined);
  assert.equal(lerToken(token), null);
});
