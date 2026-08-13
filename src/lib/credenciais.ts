import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Credenciais do painel e o token de sessão.
 *
 * Um administrador só: usuário e senha vêm do ambiente (`ADMIN_USUARIO`
 * e `ADMIN_SENHA`), sem tabela de usuários e sem serviço externo. Quem
 * entra recebe um cookie com um token assinado por HMAC — não dá para
 * forjar sem conhecer `ADMIN_SECRET`.
 *
 * Este arquivo NÃO importa `next/headers` de propósito: é o que permite
 * testá-lo com `node --test`. A parte que mexe no cookie está em
 * `auth.ts`.
 */

export const VALIDADE_SEGUNDOS = 60 * 60 * 12; // 12 horas

export type Sessao = { usuario: string; expiraEm: number };

function usuarioEsperado(): string {
  const u = process.env.ADMIN_USUARIO?.trim();
  if (!u) throw new Error("ADMIN_USUARIO não definido no ambiente.");
  return u;
}

function senhaEsperada(): string {
  const s = process.env.ADMIN_SENHA;
  if (!s) throw new Error("ADMIN_SENHA não definida no ambiente.");
  return s;
}

function segredo(): string {
  const s = process.env.ADMIN_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "ADMIN_SECRET ausente ou curto demais. Gere um com: openssl rand -hex 32",
    );
  }
  return s;
}

/** Comparação de tempo constante entre dois valores de mesmo tamanho. */
function bytesIguais(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Compara segredo digitado com segredo esperado sem vazar tempo.
 *
 * Passa os dois por HMAC antes de comparar. Sem isso, `timingSafeEqual`
 * exigiria buffers do mesmo tamanho e a saída antecipada quando os
 * tamanhos diferem seria, ela mesma, a resposta: quem tenta adivinhar
 * descobriria o COMPRIMENTO da senha só medindo. Depois do hash, os
 * dois lados têm sempre 32 bytes.
 */
function segredosIguais(digitado: string, esperado: string): boolean {
  const chave = segredo();
  const a = createHmac("sha256", chave).update(digitado).digest("hex");
  const b = createHmac("sha256", chave).update(esperado).digest("hex");
  return bytesIguais(a, b);
}

/**
 * O usuário não diferencia maiúsculas nem espaço nas pontas — errar o
 * shift no celular não é falha de autenticação. A senha, sim: ela é o
 * segredo de verdade e vale byte a byte.
 */
function normalizarUsuario(u: string): string {
  return u.trim().toLowerCase();
}

export function credenciaisCorretas(usuario: string, senha: string): boolean {
  // As duas comparações rodam SEMPRE, sem curto-circuito. Se o usuário
  // errado saísse mais cedo, o tempo de resposta contaria a quem está
  // tentando qual das duas metades já foi acertada.
  const usuarioBate = segredosIguais(
    normalizarUsuario(usuario),
    normalizarUsuario(usuarioEsperado()),
  );
  const senhaBate = segredosIguais(senha, senhaEsperada());
  return usuarioBate && senhaBate;
}

/**
 * A chave que assina o cookie sai do segredo MAIS as credenciais atuais.
 *
 * Efeito prático: trocar o usuário ou a senha derruba na hora toda
 * sessão aberta, em qualquer navegador. É o botão de pânico se a senha
 * escapar — basta mudar a variável e publicar.
 */
function chaveDeSessao(): Buffer {
  return createHmac("sha256", segredo())
    .update(`sessao-v2|${usuarioEsperado()}|${senhaEsperada()}`)
    .digest();
}

function assinar(payload: string): string {
  return createHmac("sha256", chaveDeSessao()).update(payload).digest("base64url");
}

export function criarToken(agora: number = Date.now()): string {
  const dados: Sessao = {
    usuario: usuarioEsperado(),
    expiraEm: agora + VALIDADE_SEGUNDOS * 1000,
  };
  const payload = Buffer.from(JSON.stringify(dados)).toString("base64url");
  return `${payload}.${assinar(payload)}`;
}

/** Devolve a sessão do token, ou `null` se ele for inválido ou vencido. */
export function lerToken(
  token: string | undefined,
  agora: number = Date.now(),
): Sessao | null {
  if (!token) return null;

  const [payload, assinatura] = token.split(".");
  if (!payload || !assinatura) return null;

  let esperada: string;
  try {
    esperada = assinar(payload);
  } catch {
    // Ambiente sem as variáveis: ninguém entra. Melhor negar do que
    // explodir na renderização de uma página.
    return null;
  }
  if (!bytesIguais(assinatura, esperada)) return null;

  // Só aqui o conteúdo passa a ser confiável: a assinatura já provou
  // que o payload saiu daqui e não foi mexido.
  let dados: unknown;
  try {
    dados = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  const sessao = dados as Partial<Sessao> | null;
  if (typeof sessao?.usuario !== "string") return null;
  if (typeof sessao.expiraEm !== "number" || !Number.isFinite(sessao.expiraEm)) {
    return null;
  }
  if (agora >= sessao.expiraEm) return null;

  return { usuario: sessao.usuario, expiraEm: sessao.expiraEm };
}
