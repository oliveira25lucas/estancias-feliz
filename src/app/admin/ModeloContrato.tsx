"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import {
  CONDICOES,
  VARIAVEIS_DISPONIVEIS,
  type Clausula,
} from "@/lib/contrato";
import { restaurarModeloContrato, salvarModeloContrato } from "./acoes-contratos";

/**
 * O contrato-base: adicionar, alterar, tirar e reordenar cláusulas.
 *
 * ⚠️ Editar aqui muda os PRÓXIMOS contratos. Os que já foram gerados
 * guardam a própria cópia das cláusulas e não se alteram — é o que
 * impede um documento já assinado de mudar de texto porque alguém
 * corrigiu uma vírgula no modelo três meses depois.
 *
 * A numeração NÃO é editável de propósito: ela é recontada do 1 a cada
 * contrato, porque uma cláusula condicional (a da hidromassagem) entra
 * ou sai conforme o caso. Reordenar é subir e descer.
 */
export function ModeloContrato({ modelo }: { modelo: Clausula[] }) {
  const [clausulas, setClausulas] = useState<Clausula[]>(() =>
    [...modelo].sort((a, b) => a.ordem - b.ordem),
  );
  const [aviso, setAviso] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  const sujo = JSON.stringify(clausulas) !== JSON.stringify(modelo);

  function trocar(i: number, mudanca: Partial<Clausula>) {
    setSalvo(false);
    setClausulas((lista) =>
      lista.map((c, j) => (j === i ? { ...c, ...mudanca } : c)),
    );
  }

  /**
   * Mover reescreve TODAS as ordens como 1, 2, 3…
   *
   * Trocar só os dois valores envolvidos parece mais econômico e é uma
   * armadilha: o modelo vem com 5.5 e 14.5 (as variantes que foram
   * inseridas entre duas cláusulas), e trocar um inteiro com um decimal
   * deixa a lista numa ordem que não é a que está na tela.
   */
  function mover(i: number, direcao: -1 | 1) {
    const j = i + direcao;
    if (j < 0 || j >= clausulas.length) return;
    setSalvo(false);
    setClausulas((lista) => {
      const copia = [...lista];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia.map((c, k) => ({ ...c, ordem: k + 1 }));
    });
  }

  function adicionar() {
    setSalvo(false);
    setClausulas((lista) => [
      ...lista,
      {
        ordem: lista.length + 1,
        texto: "",
        condicao: null,
        ativa: true,
      },
    ]);
  }

  function remover(i: number) {
    setSalvo(false);
    setClausulas((lista) =>
      lista.filter((_, j) => j !== i).map((c, k) => ({ ...c, ordem: k + 1 })),
    );
  }

  function salvar() {
    setAviso("");
    iniciar(async () => {
      try {
        await salvarModeloContrato(
          clausulas.map((c, i) => ({ ...c, ordem: i + 1 })),
        );
        setSalvo(true);
      } catch (e) {
        setAviso(e instanceof Error ? e.message : "Falha ao salvar.");
      }
    });
  }

  function restaurar() {
    setAviso("");
    iniciar(async () => {
      try {
        await restaurarModeloContrato();
        // O modelo volta a ser o do código, e ele chega por prop do
        // servidor — só um refresh traz a lista de verdade de volta.
        router.refresh();
      } catch (e) {
        setAviso(e instanceof Error ? e.message : "Falha ao restaurar.");
      }
    });
  }

  const ativas = clausulas.filter((c) => c.ativa !== false).length;

  return (
    <div className="rounded-2xl border border-mata-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-mata-900">
            Contrato base
          </h3>
          <p className="max-w-xl text-xs text-mata-500">
            {ativas} cláusulas ativas. O que mudar aqui vale para os próximos
            contratos — os já gerados guardam a própria cópia e não mudam.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={restaurar}
            disabled={pendente}
            className="inline-flex items-center gap-1.5 rounded-full border border-mata-200 px-3 py-1.5 text-xs font-medium text-mata-700 transition hover:bg-areia-50 disabled:opacity-50"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Voltar ao original
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={pendente || !sujo}
            className="inline-flex items-center gap-1.5 rounded-full bg-terra-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-terra-600 disabled:opacity-50"
          >
            {pendente ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Save className="size-3.5" aria-hidden />
            )}
            {salvo && !sujo ? "Salvo" : "Salvar modelo"}
          </button>
        </div>
      </div>

      {aviso && (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {aviso}
        </p>
      )}

      <details className="mt-4 rounded-xl border border-mata-100 bg-areia-50 p-3">
        <summary className="cursor-pointer text-sm font-medium text-mata-800">
          O que dá para escrever entre chaves
        </summary>
        <p className="mt-2 text-xs text-mata-600">
          Cada <code>{"{{nome}}"}</code> vira o valor daquele contrato na hora de
          imprimir. Nome que não existir fica visível no texto, para ninguém
          mandar um contrato com buraco.
        </p>
        <ul className="mt-3 grid gap-1 text-xs text-mata-700 sm:grid-cols-2">
          {VARIAVEIS_DISPONIVEIS.map((v) => (
            <li key={v.chave}>
              <code className="rounded bg-white px-1.5 py-0.5">
                {`{{${v.chave}}}`}
              </code>{" "}
              <span className="text-mata-500">{v.descricao}</span>
            </li>
          ))}
        </ul>
      </details>

      <ol className="mt-5 space-y-3">
        {clausulas.map((c, i) => (
          <li
            key={i}
            className={`rounded-xl border p-3 ${
              c.ativa === false
                ? "border-dashed border-mata-200 bg-areia-50/60 opacity-70"
                : "border-mata-100"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-mata-100 px-2 py-0.5 text-xs font-semibold text-mata-700">
                {i + 1}
              </span>

              <select
                value={c.condicao ?? ""}
                onChange={(e) =>
                  trocar(i, { condicao: e.target.value || null })
                }
                aria-label={`Quando a cláusula ${i + 1} entra`}
                className="rounded-full border border-mata-200 bg-white px-3 py-1 text-xs outline-none focus:border-terra-500"
              >
                {CONDICOES.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-1.5 text-xs text-mata-700">
                <input
                  type="checkbox"
                  checked={c.ativa !== false}
                  onChange={(e) => trocar(i, { ativa: e.target.checked })}
                  className="size-3.5 accent-terra-500"
                />
                Ativa
              </label>

              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => mover(i, -1)}
                  disabled={i === 0}
                  className="rounded-lg p-1 text-mata-400 transition hover:bg-areia-100 hover:text-mata-700 disabled:opacity-30"
                  aria-label={`Subir a cláusula ${i + 1}`}
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => mover(i, 1)}
                  disabled={i === clausulas.length - 1}
                  className="rounded-lg p-1 text-mata-400 transition hover:bg-areia-100 hover:text-mata-700 disabled:opacity-30"
                  aria-label={`Descer a cláusula ${i + 1}`}
                >
                  <ChevronDown className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remover(i)}
                  className="rounded-lg p-1 text-mata-400 transition hover:bg-red-50 hover:text-red-600"
                  aria-label={`Apagar a cláusula ${i + 1}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>

            <textarea
              value={c.texto}
              onChange={(e) => trocar(i, { texto: e.target.value })}
              rows={Math.min(12, Math.max(3, Math.ceil(c.texto.length / 95)))}
              aria-label={`Texto da cláusula ${i + 1}`}
              placeholder="Texto da cláusula. Use {{variaveis}} para o que muda a cada contrato."
              className="mt-2 w-full resize-y rounded-lg border border-mata-200 px-3 py-2 text-sm leading-relaxed outline-none focus:border-terra-500"
            />
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={adicionar}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-dashed border-mata-300 px-4 py-2 text-sm font-medium text-mata-700 transition hover:bg-areia-50"
      >
        <Plus className="size-4" aria-hidden />
        Nova cláusula
      </button>

      {sujo && (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Há mudanças não salvas.
        </p>
      )}
    </div>
  );
}
