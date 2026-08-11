"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  MessageCircle,
  Trash2,
  X,
} from "lucide-react";
import type { Orcamento, Reserva } from "@/lib/supabase";
import { formatarBRL, formatarDataBR, nomeDiaSemana } from "@/lib/pricing";
import { diasOcupados } from "@/lib/ocupacao";
import { bloquearPeriodo, liberarPeriodo } from "./actions";
import { CampoData } from "@/components/CampoData";

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

type Marca =
  | { tipo: "reserva"; dado: Reserva }
  | { tipo: "bloqueio"; dado: Bloqueio }
  | { tipo: "orcamento"; dado: Orcamento };

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
  const [bloqueioInicio, setBloqueioInicio] = useState("");
  const [bloqueioFim, setBloqueioFim] = useState("");
  const [diaAberto, setDiaAberto] = useState<string | null>(null);

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
      for (const dia of diasOcupados(r.data_checkin, r.data_checkout ?? r.data_checkin)) {
        marcar(dia, { tipo: "reserva", dado: r });
      }
    }

    for (const b of bloqueios) {
      for (const dia of diasOcupados(b.data_inicio, b.data_fim)) {
        marcar(dia, { tipo: "bloqueio", dado: b });
      }
    }

    // Só pedidos ainda em aberto — fechados já viram reserva, perdidos não ocupam.
    for (const o of orcamentos) {
      if (o.status !== "novo" && o.status !== "em_contato") continue;
      if (!o.checkin || !o.checkout) continue;
      for (const dia of diasOcupados(o.checkin, o.checkout)) {
        marcar(dia, { tipo: "orcamento", dado: o });
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
    setDiaAberto(null);
  }

  function aoBloquear(formData: FormData) {
    setErro("");
    iniciar(async () => {
      try {
        await bloquearPeriodo(formData);
        setBloqueioInicio("");
        setBloqueioFim("");
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
        setDiaAberto(null);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha ao liberar.");
      }
    });
  }

  const marcasDoDiaAberto = diaAberto ? (marcasPorDia.get(diaAberto) ?? []) : [];

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
            const aberto = iso === diaAberto;

            const temReserva = marcas.some((m) => m.tipo === "reserva");
            const temBloqueio = marcas.some((m) => m.tipo === "bloqueio");
            const temOrcamento = marcas.some((m) => m.tipo === "orcamento");

            let cor = "bg-white text-mata-800 hover:bg-mata-50";
            if (temReserva) cor = "bg-mata-600 text-white hover:bg-mata-700";
            else if (temBloqueio) cor = "bg-mata-300 text-mata-900 hover:bg-mata-400";
            else if (temOrcamento)
              cor = "bg-terra-500/20 text-terra-700 hover:bg-terra-500/30";

            return (
              <button
                key={iso}
                type="button"
                onClick={() => setDiaAberto(aberto ? null : iso)}
                aria-pressed={aberto}
                aria-label={`${dia} de ${MESES[mes]}${
                  marcas.length ? ` — ${marcas.length} registro(s)` : " — livre"
                }`}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition ${cor} ${
                  ehHoje ? "ring-2 ring-terra-500 ring-offset-1" : ""
                } ${aberto ? "ring-2 ring-mata-900 ring-offset-1" : ""}`}
              >
                <span className="font-medium">{dia}</span>
                {marcas.length > 1 && (
                  <span className="absolute bottom-1 text-[0.6rem] opacity-75">
                    {marcas.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap gap-4 border-t border-mata-100 pt-4 text-xs text-mata-600">
          <Legenda cor="bg-mata-600" rotulo="Reserva confirmada" />
          <Legenda cor="bg-terra-500/40" rotulo="Orçamento em aberto" />
          <Legenda cor="bg-mata-300" rotulo="Bloqueado por você" />
          <span className="text-mata-500">
            Clique num dia para ver os detalhes. A data de saída também conta
            como ocupada.
          </span>
        </div>

        {diaAberto && (
          <DetalhesDoDia
            dia={diaAberto}
            marcas={marcasDoDiaAberto}
            aoFechar={() => setDiaAberto(null)}
            aoLiberar={aoLiberar}
            pendente={pendente}
          />
        )}
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
            <CampoData
              label="De"
              name="data_inicio"
              valor={bloqueioInicio}
              aoMudar={setBloqueioInicio}
              obrigatorio
              compacto
            />
            <CampoData
              label="Até"
              name="data_fim"
              valor={bloqueioFim}
              aoMudar={setBloqueioFim}
              min={bloqueioInicio || undefined}
              obrigatorio
              compacto
            />
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

// ============================================================
//  Detalhes de um dia
// ============================================================

function DetalhesDoDia({
  dia,
  marcas,
  aoFechar,
  aoLiberar,
  pendente,
}: {
  dia: string;
  marcas: Marca[];
  aoFechar: () => void;
  aoLiberar: (id: string) => void;
  pendente: boolean;
}) {
  return (
    <div className="mt-5 rounded-2xl border border-mata-200 bg-areia-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-display text-base font-semibold text-mata-900">
            {nomeDiaSemana(dia)}, {formatarDataBR(dia)}
          </h4>
          <p className="text-xs text-mata-600">
            {marcas.length === 0
              ? "Nenhum compromisso — dia livre."
              : `${marcas.length} registro${marcas.length > 1 ? "s" : ""} neste dia`}
          </p>
        </div>
        <button
          type="button"
          onClick={aoFechar}
          className="rounded-lg p-1.5 text-mata-400 transition hover:bg-mata-100 hover:text-mata-700"
          aria-label="Fechar detalhes do dia"
        >
          <X className="size-4" />
        </button>
      </div>

      {marcas.length > 0 && (
        <div className="mt-4 space-y-3">
          {marcas.map((m, i) => (
            <Cartao
              key={`${m.tipo}-${i}`}
              marca={m}
              dia={dia}
              aoLiberar={aoLiberar}
              pendente={pendente}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Cartao({
  marca,
  dia,
  aoLiberar,
  pendente,
}: {
  marca: Marca;
  dia: string;
  aoLiberar: (id: string) => void;
  pendente: boolean;
}) {
  if (marca.tipo === "bloqueio") {
    const b = marca.dado;
    return (
      <article className="rounded-xl border border-mata-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Etiqueta cor="bg-mata-200 text-mata-800">Bloqueado</Etiqueta>
            <p className="mt-2 font-medium text-mata-900">
              {formatarDataBR(b.data_inicio)} a {formatarDataBR(b.data_fim)}
            </p>
            <p className="text-sm text-mata-600">
              {b.motivo || "Sem motivo informado"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => aoLiberar(b.id)}
            disabled={pendente}
            className="shrink-0 rounded-lg p-1.5 text-mata-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            aria-label="Liberar este bloqueio"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </article>
    );
  }

  if (marca.tipo === "reserva") {
    const r = marca.dado;
    const ehEntrada = r.data_checkin === dia;
    const ehSaida = r.data_checkout === dia;

    return (
      <article className="rounded-xl border border-mata-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Etiqueta cor="bg-mata-600 text-white">Reserva</Etiqueta>
          {ehEntrada && (
            <Etiqueta cor="bg-mata-100 text-mata-700">Entrada hoje</Etiqueta>
          )}
          {ehSaida && (
            <Etiqueta cor="bg-terra-500/15 text-terra-700">Saída hoje</Etiqueta>
          )}
        </div>

        <p className="mt-2 font-display text-lg font-semibold text-mata-900">
          {r.nome_cliente ?? "Sem nome"}
        </p>

        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <Item rotulo="Entrada" valor={formatarDataBR(r.data_checkin ?? "")} />
          <Item rotulo="Saída" valor={formatarDataBR(r.data_checkout ?? "")} />
          {r.qtd_pessoas ? (
            <Item rotulo="Pessoas" valor={String(r.qtd_pessoas)} />
          ) : null}
          {r.valor_final ? (
            <Item rotulo="Valor" valor={formatarBRL(Number(r.valor_final))} />
          ) : null}
          {r.tipo_evento ? <Item rotulo="Ocasião" valor={r.tipo_evento} /> : null}
          <Item rotulo="Situação" valor={rotuloStatus(r.status)} />
        </dl>

        {r.tipo_reserva && (
          <p className="mt-2 text-xs text-mata-500">{r.tipo_reserva}</p>
        )}

        {r.telefone && (
          <a
            href={`https://wa.me/55${r.telefone.replace(/\D/g, "").replace(/^55/, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-zap px-4 py-2 text-xs font-semibold text-white transition hover:bg-zap-escuro"
          >
            <MessageCircle className="size-4" aria-hidden />
            Falar com {(r.nome_cliente ?? "cliente").split(" ")[0]}
          </a>
        )}
      </article>
    );
  }

  const o = marca.dado;
  return (
    <article className="rounded-xl border border-terra-500/30 bg-white p-4">
      <Etiqueta cor="bg-terra-500/15 text-terra-700">Orçamento em aberto</Etiqueta>
      <p className="mt-2 font-display text-lg font-semibold text-mata-900">
        {o.nome}
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <Item rotulo="Entrada" valor={formatarDataBR(o.checkin ?? "")} />
        <Item rotulo="Saída" valor={formatarDataBR(o.checkout ?? "")} />
        <Item rotulo="Pessoas" valor={String(o.pessoas)} />
        {o.valor_calculado ? (
          <Item rotulo="Valor" valor={formatarBRL(Number(o.valor_calculado))} />
        ) : null}
        {o.ocasiao ? <Item rotulo="Ocasião" valor={o.ocasiao} /> : null}
      </dl>
      {o.telefone && (
        <a
          href={`https://wa.me/55${o.telefone.replace(/\D/g, "").replace(/^55/, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-zap px-4 py-2 text-xs font-semibold text-white transition hover:bg-zap-escuro"
        >
          <MessageCircle className="size-4" aria-hidden />
          Responder {o.nome.split(" ")[0]}
        </a>
      )}
    </article>
  );
}

function rotuloStatus(status: string | null): string {
  if (status === "CONFIRMADA") return "Confirmada";
  if (status === "CANCELADA") return "Cancelada";
  return "Aguardando contrato";
}

function Etiqueta({
  cor,
  children,
}: {
  cor: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${cor}`}
    >
      {children}
    </span>
  );
}

function Item({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-mata-500">{rotulo}</dt>
      <dd className="font-medium text-mata-900">{valor}</dd>
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
