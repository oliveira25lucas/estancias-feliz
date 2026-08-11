import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Autenticação do painel administrativo.
 *
 * Um único administrador, uma senha. O cookie guarda um token assinado
 * com HMAC — não dá para forjar sem conhecer ADMIN_SECRET, e não
 * precisamos de tabela de usuários nem de serviço externo.
 */

const COOKIE = "sitio_admin";
const VALIDADE_SEGUNDOS = 60 * 60 * 12; // 12 horas

function segredo(): string {
  const s = process.env.ADMIN_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "ADMIN_SECRET ausente ou curto demais. Gere um com: openssl rand -hex 32",
    );
  }
  return s;
}

function assinar(payload: string): string {
  return createHmac("sha256", segredo()).update(payload).digest("hex");
}

/** Compara sem vazar tempo — evita descobrir a senha por medição. */
function iguais(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function senhaCorreta(tentativa: string): boolean {
  const esperada = process.env.ADMIN_SENHA;
  if (!esperada) {
    throw new Error("ADMIN_SENHA não definida no ambiente.");
  }
  return iguais(tentativa, esperada);
}

export async function criarSessao(): Promise<void> {
  const expiraEm = Date.now() + VALIDADE_SEGUNDOS * 1000;
  const payload = String(expiraEm);
  const token = `${payload}.${assinar(payload)}`;

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VALIDADE_SEGUNDOS,
  });
}

export async function encerrarSessao(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function estaAutenticado(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return false;

  const [payload, assinatura] = token.split(".");
  if (!payload || !assinatura) return false;

  let esperada: string;
  try {
    esperada = assinar(payload);
  } catch {
    return false;
  }
  if (!iguais(assinatura, esperada)) return false;

  const expiraEm = Number(payload);
  return Number.isFinite(expiraEm) && Date.now() < expiraEm;
}
