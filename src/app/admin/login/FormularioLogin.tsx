"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { entrar } from "../actions";

const CAMPO =
  "w-full rounded-xl border border-mata-200 bg-white px-4 py-3 text-mata-900 outline-none transition placeholder:text-mata-300 focus:border-terra-500 focus:ring-2 focus:ring-terra-500/25";

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
  const [verSenha, setVerSenha] = useState(false);

  const idUsuario = useId();
  const idSenha = useId();
  const idErro = useId();

  return (
    <form action={acao} className="space-y-5" noValidate>
      <div>
        <label
          htmlFor={idUsuario}
          className="mb-1.5 block text-sm font-medium text-mata-800"
        >
          Usuário
        </label>
        <input
          id={idUsuario}
          name="usuario"
          type="text"
          required
          autoFocus
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          /*
            O React limpa o formulário quando a action termina. Errar a
            senha apagaria também o nome digitado, então a action devolve
            o usuário e ele volta como padrão do campo. A senha, essa
            sim, some — quem errou vai redigitar de qualquer jeito.
          */
          defaultValue={estado?.usuario ?? ""}
          aria-invalid={estado?.erro ? true : undefined}
          aria-describedby={estado?.erro ? idErro : undefined}
          className={CAMPO}
        />
      </div>

      <div>
        <label
          htmlFor={idSenha}
          className="mb-1.5 block text-sm font-medium text-mata-800"
        >
          Senha
        </label>
        <div className="relative">
          <input
            id={idSenha}
            name="senha"
            type={verSenha ? "text" : "password"}
            required
            autoComplete="current-password"
            aria-invalid={estado?.erro ? true : undefined}
            aria-describedby={estado?.erro ? idErro : undefined}
            className={`${CAMPO} pr-12`}
          />
          <button
            type="button"
            onClick={() => setVerSenha((v) => !v)}
            aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={verSenha}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-mata-400 transition hover:text-mata-700"
          >
            {verSenha ? (
              <EyeOff className="size-5" aria-hidden />
            ) : (
              <Eye className="size-5" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {estado?.erro && (
        <p
          id={idErro}
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{estado.erro}</span>
        </p>
      )}

      <Botao />
    </form>
  );
}
