"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Loader2, Lock, Trash2 } from "lucide-react";
import type { Orcamento, Reserva } from "@/lib/supabase";
import { bloquearPeriodo, liberarPeriodo } from "./actions";

export type Bloqueio = {
  id: string;
  criado_em: string;
  data_inicio: string;
  data_fim: string;
  motivo: string | null;
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIAS_CURTOS = ["D", "S", "T", "Q", "Q", "S", "S"];

/** "2026-08-11" a partir de um Date local, sem escorregar de fuso. */
function paraISO(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Dias de um período, incluindo o primeiro e excluindo o último (padrão de hospedagem). */
function diasDoPeriodo(inicio: string, fim: string, incluirFim = false): string[] {
  const dias: string[] = [];
  const [ai, mi, di] = inicio.slice(0, 10).split("-").map(Number);
  const [af, mf, df] = fim.slice(0, 10).split("-").map(Number);
  const atual = new Date(ai, mi - 1, di);
  const limite = new Date(af, mf - 1, df);
  while (incluirFim ? atual <= limite : atual < limite) {
    dias.push(paraISO(atual));
    atual.setDate(atual.getDate() + 1);
  }
  return dias;
}

type Marca = {
  tipo: "reserva" | "bloqueio" | "orcamento";
  descricao: string;
};

export function CalendarioAdmin({
  reservas,
  orcamentos,
  bloqueios,
}: {
  reservas: Reserva[];
  orcamentos: Orcamento[];
  bloqueios: Bloqueio[];
}) {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");

  /** Um mapa dia -> marcas evita varrer todas as listas para cada célula. */
  const marcasPorDia = useMemo(() => {
    const mapa = new Map<string, Marca[]>();

    const marcar = (dia: string, marca: Marca) => {
      const atuais = mapa.get(dia) ?? [];
      atuais.push(marca);
      mapa.set(dia, atuais);
    };

    for (const r of reservas) {
      if (!r.data_checkin) continue;
      if (r.status === "CANCELADA") continue; // reserva cancelada libera a data
      const fim = r.data_checkout ?? r.data_checkin;
      for (const dia of diasDoPeriodo(r.data_checkin, fim, !r.data_checkout)) {
        marcar(dia, {
          tipo: "reserva",
          descricao: `Reserva: ${r.nome_cliente ?? r.telefone ?? "sem nome"}${
            r.qtd_pessoas ? ` (${r.qtd_pessoas} pessoas)` : ""
          }`,
        });
      }
    }

    for (const b of bloqueios) {
      for (const dia of diasDoPeriodo(b.data_inicio, b.data_fim, true)) {
        marcar(dia, {
          tipo: "bloqueio",
          descricao: `Bloqueado${b.motivo ? `: ${b.motivo}` : ""}`,
        });
      }
    }

    // Só pedidos ainda em aberto — fechados já viram reserva, perdidos não ocupam.
    for (const o of orcamentos) {
      if (o.status !== "novo" && o.status !== "em_contato") continue;
      for (const dia of diasDoPeriodo(o.checkin, o.checkout)) {
        marcar(dia, {
          tipo: "orcamento",
          descricao: `Pedido de ${o.nome} (${o.pessoas} pessoas)`,
        });
      }
    }

    return mapa;
  }, [reservas, bloqueios, orcamentos]);

  const primeiroDia = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const celulas: (number | null)[] = [
    ...Array<null>(primeiroDia).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];

  function mudarMes(delta: number) {
    const d = new Date(ano, mes + delta, 1);
    setMes(d.getMonth());
    setAno(d.getFullYear());
  }

  function aoBloquear(formData: FormData) {
    setErro("");
    iniciar(async () => {
      try {
        await bloquearPeriodo(formData);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha ao bloquear.");
      }
    });
  }

  function aoLiberar(id: string) {
    setErro("");
    iniciar(async () => {
      try {
        await liberarPeriodo(id);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha ao liberar.");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
      <div className="rounded-2xl border border-mata-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => mudarMes(-1)}
            className="rounded-full p-2 text-mata-600 transition hover:bg-mata-50"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h3 className="font-display text-lg font-semibold text-mata-900">
            {MESES[mes]} de {ano}
          </h3>
          <button
            type="button"
            onClick={() => mudarMes(1)}
            className="rounded-full p-2 text-mata-600 transition hover:bg-mata-50"
            aria-label="Próximo mês"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-7 gap-1 text-center">
          {DIAS_CURTOS.map((d, i) => (
            <span
              key={`${d}-${i}`}
              className="pb-2 text-xs font-semibold uppercase text-mata-400"
            >
              {d}
            </span>
          ))}

          {celulas.map((dia, i) => {
            if (dia === null) return <span key={`vazio-${i}`} />;

            const iso = paraISO(new Date(ano, mes, dia));
            const marcas = marcasPorDia.get(iso) ?? [];
            const ehHoje = iso === paraISO(hoje);

            const temReserva = marcas.some((m) => m.tipo === "reserva");
            const temBloqueio = marcas.some((m) => m.tipo === "bloqueio");
            const temOrcamento = marcas.some((m) => m.tipo === "orcamento");

            let cor = "bg-white text-mata-800 hover:bg-mata-50";
            if (temReserva) cor = "bg-mata-600 text-white";
            else if (temBloqueio) cor = "bg-mata-300 text-mata-900";
            else if (temOrcamento) cor = "bg-terra-500/20 text-terra-700";

            return (
              <div
                key={iso}
                title={marcas.map((m) => m.descricao).join("\n") || undefined}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition ${cor} ${
                  ehHoje ? "ring-2 ring-terra-500 ring-offset-1" : ""
                }`}
              >
                <span className="font-medium">{dia}</span>
                {marcas.length > 1 && (
                  <span className="absolute bottom-1 text-[0.6rem] opacity-75">
                    {marcas.length}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap gap-4 border-t border-mata-100 pt-4 text-xs text-mata-600">
          <Legenda cor="bg-mata-600" rotulo="Reserva confirmada" />
          <Legenda cor="bg-terra-500/40" rotulo="Orçamento em aberto" />
          <Legenda cor="bg-mata-300" rotulo="Bloqueado por você" />
        </div>
      </div>

      <div className="space-y-5">
        <form
          action={aoBloquear}
          className="rounded-2xl border border-mata-100 bg-white p-5 shadow-sm"
        >
          <h3 className="flex items-center gap-2 font-display text-base font-semibold text-mata-900">
            <Lock className="size-4 text-terra-500" aria-hidden />
            Bloquear datas
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-mata-500">
            Use para manutenção, uso da família ou reserva fechada fora do site.
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="data_inicio"
                className="mb-1 block text-xs font-medium text-mata-700"
              >
                De
              </label>
              <input
                id="data_inicio"
                name="data_inicio"
                type="date"
                required
                className="w-full rounded-lg border border-mata-200 px-3 py-2 text-sm outline-none focus:border-terra-500"
              />
            </div>
            <div>
              <label
                htmlFor="data_fim"
                className="mb-1 block text-xs font-medium text-mata-700"
              >
                Até
              </label>
              <input
                id="data_fim"
                name="data_fim"
                type="date"
                required
                className="w-full rounded-lg border border-mata-200 px-3 py-2 text-sm outline-none focus:border-terra-500"
              />
            </div>
            <div>
              <label
                htmlFor="motivo"
                className="mb-1 block text-xs font-medium text-mata-700"
              >
                Motivo (opcional)
              </label>
              <input
                id="motivo"
                name="motivo"
                placeholder="Ex: manutenção da piscina"
                className="w-full rounded-lg border border-mata-200 px-3 py-2 text-sm outline-none focus:border-terra-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={pendente}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-mata-700 px-5 py-2.5 text-sm font-semibold text-areia-50 transition hover:bg-mata-800 disabled:opacity-60"
          >
            {pendente && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Bloquear
          </button>

          {erro && <p className="mt-3 text-xs text-red-600">{erro}</p>}
        </form>

        {bloqueios.length > 0 && (
          <div className="rounded-2xl border border-mata-100 bg-white p-5 shadow-sm">
            <h3 className="font-display text-base font-semibold text-mata-900">
              Períodos bloqueados
            </h3>
            <ul className="mt-3 space-y-2">
              {bloqueios.map((b) => (
                <li
                  key={b.id}
                  className="flex items-start justify-between gap-3 rounded-xl bg-areia-50 p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-mata-900">
                      {b.data_inicio.slice(8, 10)}/{b.data_inicio.slice(5, 7)} a{" "}
                      {b.data_fim.slice(8, 10)}/{b.data_fim.slice(5, 7)}
                    </p>
                    {b.motivo && (
                      <p className="truncate text-xs text-mata-600">{b.motivo}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => aoLiberar(b.id)}
                    disabled={pendente}
                    className="shrink-0 rounded-lg p-1.5 text-mata-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    aria-label={`Liberar período de ${b.data_inicio} a ${b.data_fim}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Legenda({ cor, rotulo }: { cor: string; rotulo: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-3 rounded ${cor}`} aria-hidden />
      {rotulo}
    </span>
  );
}
