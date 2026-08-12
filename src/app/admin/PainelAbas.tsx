"use client";

import { useState } from "react";

/**
 * Abas do painel.
 *
 * O painel virou duas coisas diferentes: a agenda, que se olha para
 * saber o que vem pela frente, e o CRM, que se trabalha lead a lead.
 * Numa página só, a lista de leads empurrava a agenda para longe e o
 * celular — onde o painel mais é usado — virava rolagem infinita.
 *
 * O conteúdo inativo é escondido com `hidden`, não desmontado: assim o
 * mês que você estava olhando no calendário continua lá quando você
 * volta da outra aba.
 */

export type Aba = {
  id: string;
  rotulo: string;
  icone: React.ReactNode;
  contador?: number;
  conteudo: React.ReactNode;
};

export function PainelAbas({ abas }: { abas: Aba[] }) {
  const [ativa, setAtiva] = useState(abas[0]?.id ?? "");

  return (
    <div>
      <div
        role="tablist"
        aria-label="Seções do painel"
        className="flex flex-wrap gap-2 border-b border-mata-200"
      >
        {abas.map((a) => {
          const selecionada = a.id === ativa;
          return (
            <button
              key={a.id}
              type="button"
              role="tab"
              id={`aba-${a.id}`}
              aria-selected={selecionada}
              aria-controls={`painel-${a.id}`}
              onClick={() => setAtiva(a.id)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                selecionada
                  ? "border-terra-500 text-mata-900"
                  : "border-transparent text-mata-500 hover:text-mata-800"
              }`}
            >
              {a.icone}
              {a.rotulo}
              {a.contador !== undefined && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    selecionada
                      ? "bg-terra-500/15 text-terra-700"
                      : "bg-mata-100 text-mata-600"
                  }`}
                >
                  {a.contador}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {abas.map((a) => (
        <div
          key={a.id}
          role="tabpanel"
          id={`painel-${a.id}`}
          aria-labelledby={`aba-${a.id}`}
          hidden={a.id !== ativa}
          className="pt-8"
        >
          {a.conteudo}
        </div>
      ))}
    </div>
  );
}
