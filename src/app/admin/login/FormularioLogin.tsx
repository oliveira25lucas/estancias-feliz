"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Loader2, LogIn } from "lucide-react";
import { entrar } from "../actions";

function Botao() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-mata-700 px-6 py-3.5 font-semibold text-areia-50 transition hover:bg-mata-800 disabled:opacity-60"
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Entrando...
        </>
      ) : (
        <>
          <LogIn className="size-4" aria-hidden />
          Entrar
        </>
      )}
    </button>
  );
}

export function FormularioLogin() {
  const [estado, acao] = useActionState(entrar, {});

  return (
    <form action={acao} className="space-y-5">
      <div>
        <label
          htmlFor="senha"
          className="mb-1.5 block text-sm font-medium text-mata-800"
        >
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          className="w-full rounded-xl border border-mata-200 px-4 py-3 outline-none transition focus:border-terra-500 focus:ring-2 focus:ring-terra-500/25"
        />
      </div>

      {estado?.erro && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{estado.erro}</span>
        </p>
      )}

      <Botao />
    </form>
  );
}
