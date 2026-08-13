import { cookies } from "next/headers";
import {
  criarToken,
  lerToken,
  VALIDADE_SEGUNDOS,
  type Sessao,
} from "./credenciais";

/**
 * Sessão do painel administrativo — a camada que mexe no cookie.
 *
 * A regra de quem pode entrar e como o token é assinado mora em
 * `credenciais.ts`, que não importa nada do Next e por isso tem teste.
 */

const COOKIE = "sitio_admin";

export async function criarSessao(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, criarToken(), {
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

export async function sessaoAtual(): Promise<Sessao | null> {
  const jar = await cookies();
  return lerToken(jar.get(COOKIE)?.value);
}

export async function estaAutenticado(): Promise<boolean> {
  return (await sessaoAtual()) !== null;
}
