"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Mail, Loader2 } from "lucide-react";
import type { Orcamento } from "@/lib/supabase";
import { formatarBRL } from "@/lib/pricing";
import { atualizarStatus } from "./actions";

const STATUS = [
  { valor: "novo", rotulo: "Novo", cor: "bg-terra-500/15 text-terra-700" },
  { valor: "em_contato", rotulo: "Em contato", cor: "bg-amber-100 text-amber-800" },
  { valor: "fechado", rotulo: "Fechado", cor: "bg-mata-100 text-mata-800" },
  { valor: "perdido", rotulo: "Perdido", cor: "bg-mata-50 text-mata-500" },
] as const;

type StatusValor = (typeof STATUS)[number]["valor"];

function dataBR(iso: string | null): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

function dataHoraBR(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TabelaOrcamentos({ orcamentos }: { orcamentos: Orcamento[] }) {
  const [filtro, setFiltro] = useState<StatusValor | "todos">("todos");

  const lista =
    filtro === "todos"
      ? orcamentos
      : orcamentos.filter((o) => o.status === filtro);

  if (orcamentos.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-mata-200 bg-white p-10 text-center text-mata-500">
        Assim que alguém preencher a calculadora do site, o pedido aparece aqui.
      </p>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <BotaoFiltro
          ativo={filtro === "todos"}
          onClick={() => setFiltro("todos")}
          rotulo={`Todos (${orcamentos.length})`}
        />
        {STATUS.map((s) => {
          const total = orcamentos.filter((o) => o.status === s.valor).length;
          return (
            <BotaoFiltro
              key={s.valor}
              ativo={filtro === s.valor}
              onClick={() => setFiltro(s.valor)}
              rotulo={`${s.rotulo} (${total})`}
            />
          );
        })}
      </div>

      <div className="space-y-3">
        {lista.map((o) => (
          <Cartao key={o.id} orcamento={o} />
        ))}
        {lista.length === 0 && (
          <p className="rounded-2xl border border-dashed border-mata-200 bg-white p-8 text-center text-mata-500">
            Nenhum pedido com esse status.
          </p>
        )}
      </div>
    </>
  );
}

function BotaoFiltro({
  ativo,
  onClick,
  rotulo,
}: {
  ativo: boolean;
  onClick: () => void;
  rotulo: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        ativo
          ? "bg-mata-700 text-areia-50"
          : "bg-white text-mata-700 hover:bg-mata-50"
      }`}
    >
      {rotulo}
    </button>
  );
}

function Cartao({ orcamento: o }: { orcamento: Orcamento }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");

  const status = STATUS.find((s) => s.valor === o.status) ?? STATUS[0];

  function mudarStatus(novo: StatusValor) {
    setErro("");
    iniciar(async () => {
      try {
        await atualizarStatus(o.id, novo);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha ao atualizar.");
      }
    });
  }

  const mensagem = encodeURIComponent(
    `Olá, ${o.nome.split(" ")[0]}! Aqui é do Sítio Estâncias Feliz. ` +
      `Recebemos seu pedido de orçamento para ${dataBR(o.checkin)} a ${dataBR(o.checkout)}. ` +
      `Podemos confirmar essa data pra você?`,
  );

  return (
    <article className="rounded-2xl border border-mata-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold text-mata-900">
              {o.nome}
            </h3>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.cor}`}
            >
              {status.rotulo}
            </span>
          </div>
          <p className="mt-1 text-sm text-mata-500">
            Recebido em {dataHoraBR(o.criado_em)}
          </p>
        </div>

        <div className="text-right">
          <p className="font-display text-2xl font-semibold text-mata-900">
            {formatarBRL(Number(o.valor_calculado))}
          </p>
          <p className="text-xs text-mata-500">{o.tipo_calculo}</p>
        </div>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-mata-100 pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Item rotulo="Entrada" valor={dataBR(o.checkin)} />
        <Item rotulo="Saída" valor={dataBR(o.checkout)} />
        <Item rotulo="Pessoas" valor={String(o.pessoas)} />
        <Item rotulo="Ocasião" valor={o.ocasiao ?? "—"} />
      </dl>

      {(o.hidromassagem || o.observacoes) && (
        <div className="mt-3 space-y-2 text-sm text-mata-700">
          {o.hidromassagem && (
            <p className="inline-block rounded-full bg-areia-100 px-3 py-1 text-xs">
              Quer hidromassagem
            </p>
          )}
          {o.observacoes && (
            <p className="rounded-xl bg-areia-50 p-3 leading-relaxed">
              “{o.observacoes}”
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-mata-100 pt-4">
        <a
          href={`https://wa.me/55${o.telefone.replace(/\D/g, "").replace(/^55/, "")}?text=${mensagem}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-zap px-4 py-2 text-sm font-semibold text-white transition hover:bg-zap-escuro"
        >
          <MessageCircle className="size-4" aria-hidden />
          Responder no WhatsApp
        </a>

        {o.email && (
          <a
            href={`mailto:${o.email}`}
            className="inline-flex items-center gap-2 rounded-full border border-mata-200 px-4 py-2 text-sm font-medium text-mata-700 transition hover:bg-mata-50"
          >
            <Mail className="size-4" aria-hidden />
            E-mail
          </a>
        )}

        <div className="ml-auto flex items-center gap-2">
          {pendente && (
            <Loader2 className="size-4 animate-spin text-mata-400" aria-hidden />
          )}
          <label className="sr-only" htmlFor={`status-${o.id}`}>
            Mudar status de {o.nome}
          </label>
          <select
            id={`status-${o.id}`}
            value={o.status}
            disabled={pendente}
            onChange={(e) => mudarStatus(e.target.value as StatusValor)}
            className="rounded-full border border-mata-200 bg-white px-3 py-2 text-sm text-mata-800 outline-none transition focus:border-terra-500 disabled:opacity-60"
          >
            {STATUS.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.rotulo}
              </option>
            ))}
          </select>
        </div>
      </div>

      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
    </article>
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
