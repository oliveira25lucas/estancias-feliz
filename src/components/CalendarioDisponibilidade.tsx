"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Info, Loader2 } from "lucide-react";
import { INICIAIS_DIAS, MESES, formatarDataBR } from "@/lib/pricing";
import { podeSerEntrada, saidaMaxima, somaDiasISO } from "@/lib/ocupacao";

/**
 * Calendário de disponibilidade — a data ocupada já nasce bloqueada.
 *
 * Antes, a pessoa escolhia a data, esperava a consulta e só então descobria
 * que estava vendida. Agora o calendário abre sabendo o que está ocupado, e
 * o que não dá para reservar simplesmente não é clicável.
 *
 * DUAS PONTAS. A saída também ocupa (o hóspede sai às 16h e ainda há
 * limpeza), então o bloqueio vale para a entrada E para a saída — e um dia
 * livre espremido entre duas reservas não aceita entrada nenhuma, porque a
 * saída cairia em cima da reserva seguinte. Essa regra mora em
 * `ocupacao.ts`, testada, e aqui só é desenhada.
 *
 * O mesmo componente serve a página pública (só leitura, sem `selecao`) e a
 * calculadora de orçamento (escolhendo o período).
 */

export type SelecaoCalendario = {
  entrada: string;
  saida: string;
  /** Saída vazia significa "escolhi a entrada, falta a saída". */
  aoSelecionar: (entrada: string, saida: string) => void;
};

type Props = {
  /** Dias ocupados em ISO. Só datas — nunca de quem é a reserva. */
  ocupados: readonly string[];
  /** Primeiro dia navegável, normalmente hoje. */
  de: string;
  /** Último dia navegável. */
  ate: string;
  /** Ausente: calendário de leitura. Presente: escolhe o período. */
  selecao?: SelecaoCalendario;
  /** Avisa o pai que a pessoa insistiu numa data indisponível. */
  aoTentarDiaOcupado?: (dia: string) => void;
  /** A agenda ainda está vindo do servidor. */
  carregando?: boolean;
};

/** Situação de uma célula. É ela que define cor, clique e leitor de tela. */
type Situacao =
  | "fora" // fora da janela ou no passado
  | "ocupado" // reserva ou bloqueio
  | "sem-saida" // livre, mas a saída cairia numa data ocupada
  | "livre"
  | "entrada"
  | "saida"
  | "no-periodo"
  | "possivel-saida"
  | "longe-demais"; // escolhendo a saída, além da última possível

function paraISO(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function CalendarioDisponibilidade({
  ocupados,
  de,
  ate,
  selecao,
  aoTentarDiaOcupado,
  carregando = false,
}: Props) {
  const bloqueados = useMemo(() => new Set(ocupados), [ocupados]);

  // Abre no mês da data já escolhida; sem escolha, no primeiro navegável.
  const inicial = selecao?.entrada || de;
  const [cursor, setCursor] = useState(() => ({
    ano: Number(inicial.slice(0, 4)),
    mes: Number(inicial.slice(5, 7)) - 1,
  }));
  const [pairado, setPairado] = useState("");
  const [recado, setRecado] = useState("");

  const entrada = selecao?.entrada ?? "";
  const saida = selecao?.saida ?? "";
  /** Entrada escolhida e saída em aberto: o próximo clique é a saída. */
  const escolhendoSaida = Boolean(entrada) && !saida;
  const ultimaSaida = escolhendoSaida ? saidaMaxima(entrada, bloqueados) : "";

  // Limites de navegação, em número de meses desde o ano 0 — comparar
  // ano e mês separados dá margem para o erro clássico da virada de ano.
  const emMeses = (iso: string) =>
    Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
  const atual = cursor.ano * 12 + cursor.mes;
  const podeVoltar = atual > emMeses(de);
  const podeAvancar = atual < emMeses(ate);

  /** O segundo mês da dupla, já com a virada de ano resolvida. */
  const proximo = new Date(cursor.ano, cursor.mes + 1, 1);
  const seguinte = { ano: proximo.getFullYear(), mes: proximo.getMonth() };

  function mudarMes(passo: number) {
    setCursor((c) => {
      const d = new Date(c.ano, c.mes + passo, 1);
      return { ano: d.getFullYear(), mes: d.getMonth() };
    });
    setPairado("");
  }

  function situacaoDe(dia: string): Situacao {
    if (dia < de || dia > ate) return "fora";
    if (bloqueados.has(dia)) return "ocupado";

    if (entrada && saida) {
      if (dia === entrada) return "entrada";
      if (dia === saida) return "saida";
      if (dia > entrada && dia < saida) return "no-periodo";
    }

    if (!selecao) return "livre";

    if (escolhendoSaida) {
      if (dia === entrada) return "entrada";
      if (dia > entrada && dia <= ultimaSaida) return "possivel-saida";
      if (dia > entrada) return "longe-demais";
    }

    return podeSerEntrada(dia, bloqueados) ? "livre" : "sem-saida";
  }

  const CLICAVEIS: Situacao[] = [
    "livre",
    "entrada",
    "saida",
    "no-periodo",
    "possivel-saida",
  ];

  function aoClicar(dia: string, situacao: Situacao) {
    if (!selecao || carregando) return;

    if (situacao === "ocupado") {
      setRecado(
        `${formatarDataBR(dia)} já está reservado. Escolha outra data — ou fale com a gente que a gente procura a mais próxima.`,
      );
      aoTentarDiaOcupado?.(dia);
      return;
    }

    if (situacao === "sem-saida") {
      setRecado(
        `Não dá para entrar em ${formatarDataBR(dia)}: a saída cairia em ${formatarDataBR(somaDiasISO(dia))}, que já está reservado. A diária mais curta é de um dia.`,
      );
      aoTentarDiaOcupado?.(dia);
      return;
    }

    if (situacao === "longe-demais") {
      setRecado(
        `Entrando em ${formatarDataBR(entrada)}, a saída vai no máximo até ${formatarDataBR(ultimaSaida)} — depois disso a agenda já está ocupada.`,
      );
      return;
    }

    if (situacao === "fora") return;

    setRecado("");

    // Escolhendo a saída, clicar antes da entrada é recomeçar.
    if (escolhendoSaida && dia > entrada) {
      selecao.aoSelecionar(entrada, dia);
      return;
    }
    selecao.aoSelecionar(dia, "");
  }

  return (
    <div>
      <div className="rounded-2xl border border-mata-100 bg-white p-4 shadow-sm sm:p-5">
        {/*
          Os nomes dos meses moram no cabeçalho, cada um em cima da sua
          grade — a mesma grade de duas colunas usada embaixo, para as
          colunas casarem sem cálculo de largura.
        */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => mudarMes(-1)}
            disabled={!podeVoltar}
            className="shrink-0 rounded-full p-2 text-mata-600 transition hover:bg-mata-50 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>

          <div
            className="grid flex-1 gap-6 sm:grid-cols-2"
            aria-live="polite"
          >
            <p className="text-center font-display text-base font-semibold text-mata-900">
              {MESES[cursor.mes]} de {cursor.ano}
            </p>
            <p className="hidden text-center font-display text-base font-semibold text-mata-900 sm:block">
              {MESES[seguinte.mes]} de {seguinte.ano}
            </p>
          </div>

          <button
            type="button"
            onClick={() => mudarMes(1)}
            disabled={!podeAvancar}
            className="shrink-0 rounded-full p-2 text-mata-600 transition hover:bg-mata-50 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Próximo mês"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>

        <div className="relative mt-4 grid gap-6 sm:grid-cols-2">
          {carregando && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70">
              <Loader2 className="size-6 animate-spin text-mata-400" aria-hidden />
              <span className="sr-only">Carregando a agenda</span>
            </div>
          )}

          <Mes
            ano={cursor.ano}
            mes={cursor.mes}
            situacaoDe={situacaoDe}
            clicaveis={CLICAVEIS}
            selecionavel={Boolean(selecao) && !carregando}
            pairado={pairado}
            aoPairar={setPairado}
            aoClicar={aoClicar}
          />
          {/* O segundo mês só cabe em tela larga; no celular, navega-se. */}
          <div className="hidden sm:block">
            <Mes
              ano={seguinte.ano}
              mes={seguinte.mes}
              situacaoDe={situacaoDe}
              clicaveis={CLICAVEIS}
              selecionavel={Boolean(selecao) && !carregando}
              pairado={pairado}
              aoPairar={setPairado}
              aoClicar={aoClicar}
            />
          </div>
        </div>

        <Legenda temSelecao={Boolean(selecao)} />
      </div>

      {selecao && (
        <p className="mt-3 text-sm text-mata-600" aria-live="polite">
          {escolhendoSaida ? (
            <>
              Entrada em <strong>{formatarDataBR(entrada)}</strong>. Agora
              escolha a saída
              {ultimaSaida && <> — dá até {formatarDataBR(ultimaSaida)}</>}.
            </>
          ) : entrada && saida ? (
            <>
              De <strong>{formatarDataBR(entrada)}</strong> a{" "}
              <strong>{formatarDataBR(saida)}</strong>. Clique em outro dia
              para recomeçar.
            </>
          ) : (
            <>Clique no dia da entrada.</>
          )}
        </p>
      )}

      {recado && (
        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{recado}</span>
        </p>
      )}
    </div>
  );
}

// ============================================================
//  Um mês
// ============================================================

function Mes({
  ano,
  mes,
  situacaoDe,
  clicaveis,
  selecionavel,
  pairado,
  aoPairar,
  aoClicar,
}: {
  ano: number;
  mes: number;
  situacaoDe: (dia: string) => Situacao;
  clicaveis: Situacao[];
  selecionavel: boolean;
  pairado: string;
  aoPairar: (dia: string) => void;
  aoClicar: (dia: string, situacao: Situacao) => void;
}) {
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();

  return (
    <div
      role="group"
      aria-label={`Dias de ${MESES[mes]} de ${ano}`}
    >
      <div className="grid grid-cols-7 gap-1 text-center">
        {INICIAIS_DIAS.map((d, i) => (
          <span
            key={`${d}-${i}`}
            className="pb-1 text-[0.65rem] font-semibold uppercase text-mata-400"
          >
            {d}
          </span>
        ))}

        {Array.from({ length: primeiroDiaSemana }, (_, i) => (
          <span key={`vazio-${i}`} />
        ))}

        {Array.from({ length: diasNoMes }, (_, i) => {
          const dia = paraISO(ano, mes, i + 1);
          const situacao = situacaoDe(dia);
          const clicavel = selecionavel && situacao !== "fora";
          const noCaminho =
            situacao === "possivel-saida" && pairado && dia <= pairado;

          return (
            <button
              key={dia}
              type="button"
              disabled={!clicavel}
              onClick={() => aoClicar(dia, situacao)}
              onMouseEnter={() => aoPairar(dia)}
              onMouseLeave={() => aoPairar("")}
              aria-label={`${i + 1} de ${MESES[mes]} — ${DESCRICAO[situacao]}`}
              aria-disabled={!clicaveis.includes(situacao) || undefined}
              className={`flex aspect-square items-center justify-center rounded-lg text-sm transition ${
                CORES[situacao]
              } ${noCaminho ? "ring-1 ring-terra-400" : ""} ${
                clicavel ? "" : "cursor-default"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A cor decide antes do texto: VERDE é o que dá para clicar, CINZA é o
 * que não dá. Um cinza de verdade, e não um verde mais apagado — lado a
 * lado com o livre, dois tons da mesma cor viram a mesma coisa numa
 * olhada rápida, e a pessoa insiste no dia que já está vendido.
 */
const CORES: Record<Situacao, string> = {
  fora: "text-stone-300",
  ocupado: "bg-stone-200 text-stone-400 line-through",
  "sem-saida": "bg-stone-100 text-stone-400 line-through",
  "longe-demais": "bg-stone-100 text-stone-400",
  livre: "bg-mata-50 font-medium text-mata-800 hover:bg-mata-100",
  "possivel-saida": "bg-mata-50 font-medium text-mata-800 hover:bg-terra-500/20",
  "no-periodo": "bg-terra-500/20 text-terra-800",
  entrada: "bg-terra-500 font-semibold text-white",
  saida: "bg-terra-500 font-semibold text-white",
};

const DESCRICAO: Record<Situacao, string> = {
  fora: "fora do período aceito",
  ocupado: "ocupado",
  "sem-saida": "indisponível, a saída cairia numa data ocupada",
  "longe-demais": "indisponível para saída",
  livre: "livre",
  "possivel-saida": "livre, pode ser a saída",
  "no-periodo": "dentro da sua estadia",
  entrada: "sua entrada",
  saida: "sua saída",
};

function Legenda({ temSelecao }: { temSelecao: boolean }) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-mata-100 pt-4 text-xs text-mata-600">
      <Item cor="bg-mata-50 border border-mata-200" rotulo="Livre" />
      <Item cor="bg-stone-200" rotulo="Ocupado" />
      {temSelecao && <Item cor="bg-terra-500" rotulo="Sua escolha" />}
      <span className="text-mata-500">
        A data de saída também ocupa — por isso quem sai no domingo deixa o
        sítio livre só na segunda.
      </span>
    </div>
  );
}

function Item({ cor, rotulo }: { cor: string; rotulo: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-3 rounded ${cor}`} aria-hidden />
      {rotulo}
    </span>
  );
}
