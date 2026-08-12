"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CalendarClock,
  Check,
  Clock,
  Loader2,
  Mail,
  MessageCircle,
  NotebookPen,
  Search,
} from "lucide-react";
import type { Orcamento, StatusOrcamento } from "@/lib/supabase";
import { formatarBRL, formatarDataBR } from "@/lib/pricing";
import { atualizarStatus, registrarContato, salvarAnotacao } from "./actions";

/**
 * CRM de leads.
 *
 * A calculadora do site grava o contato ANTES de mostrar o valor, então
 * esta lista não é mais "orçamentos enviados": é todo mundo que chegou
 * perto de fechar. Muita gente vai aparecer aqui sem nunca ter mandado
 * mensagem no WhatsApp — e é justamente essa gente que precisa de um
 * retorno.
 *
 * Por isso as três colunas que a migração 004 acrescentou: anotação do
 * que foi conversado, data do último contato, e se a pessoa chegou a
 * clicar para falar no WhatsApp.
 */

const ETAPAS = [
  { valor: "novo", rotulo: "Novo", cor: "bg-terra-500/15 text-terra-700" },
  {
    valor: "em_contato",
    rotulo: "Em contato",
    cor: "bg-amber-100 text-amber-800",
  },
  { valor: "fechado", rotulo: "Fechado", cor: "bg-mata-100 text-mata-800" },
  { valor: "perdido", rotulo: "Perdido", cor: "bg-mata-50 text-mata-500" },
] as const satisfies readonly {
  valor: StatusOrcamento;
  rotulo: string;
  cor: string;
}[];

type Ordem = "recentes" | "esquecidos";

function dataHoraBR(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Dias inteiros entre duas datas ISO, sem passar por fuso. */
function diasEntre(de: string, ate: string): number {
  const [a1, m1, d1] = de.slice(0, 10).split("-").map(Number);
  const [a2, m2, d2] = ate.slice(0, 10).split("-").map(Number);
  const ms =
    new Date(a2, m2 - 1, d2).getTime() - new Date(a1, m1 - 1, d1).getTime();
  return Math.round(ms / 86_400_000);
}

function so(texto: string | null | undefined): string {
  return (texto ?? "").toLowerCase();
}

export function CRMLeads({
  leads,
  hoje,
}: {
  leads: Orcamento[];
  /**
   * Vem do servidor de propósito. Calcular "há quantos dias" com o
   * relógio do navegador faria o HTML da hidratação divergir do que o
   * servidor renderizou.
   */
  hoje: string;
}) {
  const [etapa, setEtapa] = useState<StatusOrcamento | "todos">("todos");
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("recentes");

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const digitos = termo.replace(/\D/g, "");

    const filtrados = leads.filter((l) => {
      if (etapa !== "todos" && l.status !== etapa) return false;
      if (!termo) return true;
      return (
        so(l.nome).includes(termo) ||
        so(l.email).includes(termo) ||
        (digitos.length >= 3 && (l.telefone ?? "").includes(digitos))
      );
    });

    return filtrados.sort((a, b) => {
      if (ordem === "recentes") {
        return b.criado_em.localeCompare(a.criado_em);
      }
      // Quem nunca foi contatado vem primeiro; depois, o contato mais
      // antigo. É a fila de quem está esperando retorno.
      const semA = a.contatado_em ? 1 : 0;
      const semB = b.contatado_em ? 1 : 0;
      if (semA !== semB) return semA - semB;
      if (!a.contatado_em || !b.contatado_em) {
        return a.criado_em.localeCompare(b.criado_em);
      }
      return a.contatado_em.localeCompare(b.contatado_em);
    });
  }, [leads, etapa, busca, ordem]);

  if (leads.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-mata-200 bg-white p-10 text-center text-mata-500">
        Assim que alguém preencher nome e WhatsApp na calculadora do site, o
        lead aparece aqui — mesmo que a conversa não chegue a começar.
      </p>
    );
  }

  const semContato = leads.filter(
    (l) => l.status === "novo" && !l.contatado_em,
  ).length;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <BotaoFiltro
          ativo={etapa === "todos"}
          onClick={() => setEtapa("todos")}
          rotulo={`Todos (${leads.length})`}
        />
        {ETAPAS.map((e) => (
          <BotaoFiltro
            key={e.valor}
            ativo={etapa === e.valor}
            onClick={() => setEtapa(e.valor)}
            rotulo={`${e.rotulo} (${leads.filter((l) => l.status === e.valor).length})`}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mata-400"
            aria-hidden
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, telefone ou e-mail"
            aria-label="Buscar lead"
            className="w-full rounded-full border border-mata-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-terra-500"
          />
        </div>

        <label className="sr-only" htmlFor="ordem-crm">
          Ordenar leads
        </label>
        <select
          id="ordem-crm"
          value={ordem}
          onChange={(e) => setOrdem(e.target.value as Ordem)}
          className="rounded-full border border-mata-200 bg-white px-4 py-2.5 text-sm text-mata-800 outline-none transition focus:border-terra-500"
        >
          <option value="recentes">Mais recentes primeiro</option>
          <option value="esquecidos">Esperando há mais tempo</option>
        </select>
      </div>

      {semContato > 0 && (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-terra-500/10 p-4 text-sm text-terra-800">
          <Clock className="size-4 shrink-0" aria-hidden />
          <span>
            {semContato} lead{semContato > 1 ? "s" : ""} ainda sem nenhum
            contato registrado.
          </span>
        </p>
      )}

      <div className="mt-5 space-y-3">
        {lista.map((l) => (
          <Cartao key={l.id} lead={l} hoje={hoje} />
        ))}
        {lista.length === 0 && (
          <p className="rounded-2xl border border-dashed border-mata-200 bg-white p-8 text-center text-mata-500">
            Nenhum lead com esse filtro.
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
      aria-pressed={ativo}
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

function Cartao({ lead: l, hoje }: { lead: Orcamento; hoje: string }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");
  const [anotacao, setAnotacao] = useState(l.anotacoes ?? "");
  const [salvou, setSalvou] = useState(false);

  const etapa = ETAPAS.find((e) => e.valor === l.status) ?? ETAPAS[0];
  const sujo = anotacao !== (l.anotacoes ?? "");
  const esperando = diasEntre(l.criado_em, hoje);

  function executar(acao: () => Promise<void>, aoDarCerto?: () => void) {
    setErro("");
    iniciar(async () => {
      try {
        await acao();
        aoDarCerto?.();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha na operação.");
      }
    });
  }

  const mensagem = encodeURIComponent(
    `Olá, ${l.nome.split(" ")[0]}! Aqui é do Sítio Estâncias Feliz. ` +
      (l.checkin && l.checkout
        ? `Vi que você fez um orçamento para ${formatarDataBR(l.checkin)} a ${formatarDataBR(l.checkout)}. `
        : `Vi que você pediu um orçamento pelo site. `) +
      `Posso te ajudar a fechar essa data?`,
  );

  const zap = `https://wa.me/55${l.telefone.replace(/\D/g, "").replace(/^55/, "")}?text=${mensagem}`;

  return (
    <article className="rounded-2xl border border-mata-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold text-mata-900">
              {l.nome}
            </h3>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${etapa.cor}`}
            >
              {etapa.rotulo}
            </span>
            {l.abriu_whatsapp_em ? (
              <span className="rounded-full bg-zap/15 px-2.5 py-0.5 text-xs font-semibold text-zap-escuro">
                Chamou no WhatsApp
              </span>
            ) : (
              <span className="rounded-full bg-areia-100 px-2.5 py-0.5 text-xs font-semibold text-mata-600">
                Só viu o valor
              </span>
            )}
            {l.status === "novo" && !l.contatado_em && esperando >= 2 && (
              <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                Esperando há {esperando} dias
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-mata-500">
            Chegou em {dataHoraBR(l.criado_em)}
            {" · "}
            {l.contatado_em
              ? `último contato em ${dataHoraBR(l.contatado_em)}`
              : "sem contato registrado"}
          </p>
        </div>

        {l.valor_calculado ? (
          <div className="text-right">
            <p className="font-display text-2xl font-semibold text-mata-900">
              {formatarBRL(Number(l.valor_calculado))}
            </p>
            <p className="text-xs text-mata-500">{l.tipo_calculo}</p>
          </div>
        ) : null}
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-mata-100 pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {l.checkin && l.checkout ? (
          <>
            <Item rotulo="Entrada" valor={formatarDataBR(l.checkin)} />
            <Item rotulo="Saída" valor={formatarDataBR(l.checkout)} />
          </>
        ) : (
          <Item
            rotulo="Época pretendida"
            valor={l.periodo_desejado || "ainda não sabe"}
          />
        )}
        <Item rotulo="Pessoas" valor={String(l.pessoas)} />
        <Item rotulo="Ocasião" valor={l.ocasiao ?? "—"} />
      </dl>

      {(l.hidromassagem || l.observacoes) && (
        <div className="mt-3 space-y-2 text-sm text-mata-700">
          {l.hidromassagem && (
            <p className="inline-block rounded-full bg-areia-100 px-3 py-1 text-xs">
              Quer hidromassagem
            </p>
          )}
          {l.observacoes && (
            <p className="rounded-xl bg-areia-50 p-3 leading-relaxed">
              “{l.observacoes}”
            </p>
          )}
        </div>
      )}

      {/* ---- Anotações internas ---- */}
      <div className="mt-4 border-t border-mata-100 pt-4">
        <label
          htmlFor={`anotacao-${l.id}`}
          className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-mata-500"
        >
          <NotebookPen className="size-3.5" aria-hidden />
          Suas anotações
        </label>
        <textarea
          id={`anotacao-${l.id}`}
          rows={2}
          value={anotacao}
          onChange={(e) => {
            setAnotacao(e.target.value);
            setSalvou(false);
          }}
          placeholder="Ex: pediu para ligar depois das 18h. Vai confirmar com o marido."
          className="mt-1.5 w-full resize-y rounded-xl border border-mata-200 px-3 py-2 text-sm outline-none transition focus:border-terra-500"
        />
        {(sujo || salvou) && (
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              disabled={pendente || !sujo}
              onClick={() =>
                executar(
                  () => salvarAnotacao(l.id, anotacao),
                  () => setSalvou(true),
                )
              }
              className="rounded-full bg-mata-700 px-4 py-1.5 text-xs font-semibold text-areia-50 transition hover:bg-mata-800 disabled:opacity-50"
            >
              Salvar anotação
            </button>
            {salvou && !sujo && (
              <span className="flex items-center gap-1 text-xs text-mata-600">
                <Check className="size-3.5" aria-hidden />
                Salvo
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-mata-100 pt-4">
        <a
          href={zap}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-zap px-4 py-2 text-sm font-semibold text-white transition hover:bg-zap-escuro"
        >
          <MessageCircle className="size-4" aria-hidden />
          Responder no WhatsApp
        </a>

        {l.email && (
          <a
            href={`mailto:${l.email}`}
            className="inline-flex items-center gap-2 rounded-full border border-mata-200 px-4 py-2 text-sm font-medium text-mata-700 transition hover:bg-mata-50"
          >
            <Mail className="size-4" aria-hidden />
            E-mail
          </a>
        )}

        <button
          type="button"
          disabled={pendente}
          onClick={() => executar(() => registrarContato(l.id))}
          className="inline-flex items-center gap-2 rounded-full border border-mata-200 px-4 py-2 text-sm font-medium text-mata-700 transition hover:bg-mata-50 disabled:opacity-50"
        >
          <CalendarClock className="size-4" aria-hidden />
          Falei hoje
        </button>

        <div className="ml-auto flex items-center gap-2">
          {pendente && (
            <Loader2 className="size-4 animate-spin text-mata-400" aria-hidden />
          )}
          <label className="sr-only" htmlFor={`etapa-${l.id}`}>
            Mudar etapa de {l.nome}
          </label>
          <select
            id={`etapa-${l.id}`}
            value={l.status}
            disabled={pendente}
            onChange={(e) =>
              executar(() =>
                atualizarStatus(l.id, e.target.value as StatusOrcamento),
              )
            }
            className="rounded-full border border-mata-200 bg-white px-3 py-2 text-sm text-mata-800 outline-none transition focus:border-terra-500 disabled:opacity-60"
          >
            {ETAPAS.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.rotulo}
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
