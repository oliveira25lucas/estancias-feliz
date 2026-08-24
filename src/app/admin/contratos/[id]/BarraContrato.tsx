"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Loader2, Printer } from "lucide-react";
import { definirStatusContrato } from "../../acoes-contratos";
import type { StatusContrato } from "@/lib/contratos";

const STATUS = [
  { valor: "RASCUNHO", rotulo: "Rascunho" },
  { valor: "ENVIADO", rotulo: "Enviado ao cliente" },
  { valor: "ASSINADO", rotulo: "Assinado" },
] as const satisfies readonly { valor: StatusContrato; rotulo: string }[];

/**
 * As ações do contrato. Some na impressão (`.nao-imprimir` no pai).
 *
 * "Salvar PDF" é `window.print()` de propósito: o diálogo do navegador
 * já tem "Salvar como PDF", em A4, com o texto selecionável. Uma
 * biblioteca de PDF no servidor daria o mesmo arquivo por muito mais
 * código e uma dependência a mais no bundle da Vercel.
 */
export function BarraContrato({
  id,
  status,
  nome,
  texto,
}: {
  id: string;
  status: StatusContrato;
  nome: string;
  texto: string;
}) {
  const [pendente, iniciar] = useTransition();
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState("");

  async function copiar() {
    setErro("");
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErro("O navegador não deixou copiar. Selecione o texto à mão.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-mata-100 bg-white p-4 shadow-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-base font-semibold text-mata-900">
          Contrato · {nome || "sem nome"}
        </p>
        <p className="text-xs text-mata-500">
          O PDF sai pelo diálogo de impressão — escolha “Salvar como PDF”.
        </p>
      </div>

      <select
        value={status}
        disabled={pendente}
        onChange={(e) =>
          iniciar(async () => {
            setErro("");
            try {
              await definirStatusContrato(id, e.target.value as StatusContrato);
            } catch (x) {
              setErro(x instanceof Error ? x.message : "Falha ao atualizar.");
            }
          })
        }
        aria-label="Situação do contrato"
        className="rounded-full border border-mata-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-terra-500 disabled:opacity-60"
      >
        {STATUS.map((s) => (
          <option key={s.valor} value={s.valor}>
            {s.rotulo}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={copiar}
        className="inline-flex items-center gap-2 rounded-full border border-mata-200 px-4 py-2 text-sm font-medium text-mata-800 transition hover:bg-areia-50"
      >
        {copiado ? (
          <Check className="size-4 text-mata-600" aria-hidden />
        ) : (
          <Copy className="size-4" aria-hidden />
        )}
        {copiado ? "Copiado" : "Copiar texto"}
      </button>

      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-full bg-terra-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-terra-600"
      >
        <Printer className="size-4" aria-hidden />
        Imprimir / Salvar PDF
      </button>

      {pendente && (
        <Loader2 className="size-4 animate-spin text-mata-400" aria-hidden />
      )}
      {erro && <p className="w-full text-sm text-amber-800">{erro}</p>}
    </div>
  );
}
