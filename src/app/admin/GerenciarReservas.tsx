"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, ExternalLink, Loader2, Trash2, X } from "lucide-react";
import type { Reserva, StatusReserva } from "@/lib/supabase";
import { formatarBRL, formatarDataBR } from "@/lib/pricing";
import { criarReserva, excluirReserva, mudarStatusReserva } from "./actions";
import { CampoData } from "@/components/CampoData";

/**
 * O vocabulário vem do banco, que já usava PENDENTE_CONTRATO nas 23
 * reservas criadas pela Júlia. Renomear quebraria o histórico.
 * PENDENTE_CONTRATO e CONFIRMADA ocupam a data; CANCELADA libera.
 */
const STATUS = [
  {
    valor: "PENDENTE_CONTRATO",
    rotulo: "Aguardando contrato",
    cor: "bg-amber-100 text-amber-800",
  },
  { valor: "CONFIRMADA", rotulo: "Confirmada", cor: "bg-mata-100 text-mata-800" },
  { valor: "CANCELADA", rotulo: "Cancelada", cor: "bg-mata-50 text-mata-400" },
] as const satisfies readonly { valor: StatusReserva; rotulo: string; cor: string }[];

/**
 * O link da reserva no painel da Airbnb, guardado em `observacoes` pelo
 * importador.
 *
 * Existe porque o calendário da Airbnb NÃO manda nome nem telefone do
 * hóspede — eles removeram isso em 2019. A reserva chega aqui anônima,
 * e este link é o caminho de um clique para descobrir quem é. Sem ele,
 * a única saída seria procurar a data à mão no aplicativo da Airbnb.
 */
function linkDaAirbnb(observacoes: string | null): string | null {
  const achado = /(https?:\/\/[^\s]+)/.exec(observacoes ?? "");
  return achado ? achado[1] : null;
}

export function GerenciarReservas({ reservas }: { reservas: Reserva[] }) {
  const [abrindo, setAbrindo] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [aviso, setAviso] = useState("");
  const [entrada, setEntrada] = useState("");
  const [saida, setSaida] = useState("");

  // Reservas passadas não interessam no dia a dia; o filtro deixa a
  // lista curta e focada no que ainda vai acontecer.
  const [mostrarPassadas, setMostrarPassadas] = useState(false);
  const hoje = new Date().toISOString().slice(0, 10);

  const lista = reservas
    .filter((r) => mostrarPassadas || (r.data_checkout ?? "") >= hoje)
    .sort((a, b) => (a.data_checkin ?? "").localeCompare(b.data_checkin ?? ""));

  function executar(acao: () => Promise<void>) {
    setAviso("");
    iniciar(async () => {
      try {
        await acao();
        setAbrindo(false);
        setEntrada("");
        setSaida("");
      } catch (e) {
        setAviso(e instanceof Error ? e.message : "Falha na operação.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-mata-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-mata-900">
            Reservas
          </h3>
          <p className="text-xs text-mata-500">
            O que está aqui bloqueia a data para a Júlia no WhatsApp.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAbrindo((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full bg-mata-700 px-4 py-2 text-sm font-semibold text-areia-50 transition hover:bg-mata-800"
        >
          {abrindo ? (
            <>
              <X className="size-4" aria-hidden />
              Cancelar
            </>
          ) : (
            <>
              <CalendarPlus className="size-4" aria-hidden />
              Nova reserva
            </>
          )}
        </button>
      </div>

      {abrindo && (
        <form
          action={(fd) => executar(() => criarReserva(fd))}
          className="mt-5 grid gap-3 rounded-2xl bg-areia-50 p-4 sm:grid-cols-2"
        >
          <CampoAdmin label="Nome do cliente" nome="nome_cliente" obrigatorio />
          <CampoAdmin label="WhatsApp" nome="telefone" placeholder="31900000000" />
          <CampoData
            label="Entrada"
            name="data_checkin"
            valor={entrada}
            aoMudar={setEntrada}
            obrigatorio
            compacto
          />
          <CampoData
            label="Saída"
            name="data_checkout"
            valor={saida}
            aoMudar={setSaida}
            min={entrada || undefined}
            obrigatorio
            compacto
          />
          <CampoAdmin label="Pessoas" nome="qtd_pessoas" tipo="number" />
          <CampoAdmin label="Valor combinado" nome="valor_final" tipo="number" />
          <CampoAdmin label="Tipo de evento" nome="tipo_evento" placeholder="Aniversário, casamento..." />
          <div>
            <label
              htmlFor="status"
              className="mb-1 block text-xs font-medium text-mata-700"
            >
              Situação
            </label>
            <select
              id="status"
              name="status"
              defaultValue="PENDENTE_CONTRATO"
              className="w-full rounded-lg border border-mata-200 px-3 py-2 text-sm outline-none focus:border-terra-500"
            >
              {STATUS.filter((s) => s.valor !== "CANCELADA").map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.rotulo}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={pendente}
            className="mt-1 flex items-center justify-center gap-2 rounded-full bg-terra-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-terra-600 disabled:opacity-60 sm:col-span-2"
          >
            {pendente && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Salvar reserva
          </button>
        </form>
      )}

      {aviso && (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          {aviso}
        </p>
      )}

      <div className="mt-5 space-y-2">
        {lista.length === 0 ? (
          <p className="rounded-xl border border-dashed border-mata-200 p-6 text-center text-sm text-mata-500">
            {mostrarPassadas
              ? "Nenhuma reserva registrada."
              : "Nenhuma reserva futura."}
          </p>
        ) : (
          lista.map((r) => {
            const status =
              STATUS.find((s) => s.valor === r.status) ?? STATUS[0];
            return (
              <div
                key={String(r.id)}
                className={`flex flex-wrap items-center gap-3 rounded-xl border border-mata-100 p-3 text-sm ${
                  r.status === "CANCELADA" ? "opacity-60" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-mata-900">
                    {r.nome_cliente ?? r.telefone ?? "Sem nome"}
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${status.cor}`}
                    >
                      {status.rotulo}
                    </span>
                  </p>
                  <p className="text-xs text-mata-600">
                    {formatarDataBR(r.data_checkin ?? "")} a{" "}
                    {formatarDataBR(r.data_checkout ?? "")}
                    {r.qtd_pessoas ? ` · ${r.qtd_pessoas} pessoas` : ""}
                    {r.valor_final
                      ? ` · ${formatarBRL(Number(r.valor_final))}`
                      : ""}
                    {r.origem ? ` · via ${r.origem}` : ""}
                  </p>
                  {linkDaAirbnb(r.observacoes) && (
                    <a
                      href={linkDaAirbnb(r.observacoes) ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-terra-700 underline underline-offset-2 hover:text-terra-600"
                    >
                      <ExternalLink className="size-3" aria-hidden />
                      Ver o hóspede na Airbnb
                    </a>
                  )}
                </div>

                <select
                  value={r.status ?? "PENDENTE_CONTRATO"}
                  disabled={pendente}
                  onChange={(e) =>
                    executar(() =>
                      mudarStatusReserva(r.id, e.target.value as StatusReserva),
                    )
                  }
                  aria-label={`Situação da reserva de ${r.nome_cliente ?? "cliente"}`}
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
                  disabled={pendente}
                  onClick={() => executar(() => excluirReserva(r.id))}
                  className="rounded-lg p-1.5 text-mata-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  aria-label={`Excluir reserva de ${r.nome_cliente ?? "cliente"}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      <button
        type="button"
        onClick={() => setMostrarPassadas((v) => !v)}
        className="mt-4 text-xs font-medium text-mata-600 underline underline-offset-4"
      >
        {mostrarPassadas
          ? "Mostrar só as futuras"
          : "Mostrar também as reservas passadas"}
      </button>
    </div>
  );
}

function CampoAdmin({
  label,
  nome,
  tipo = "text",
  placeholder,
  obrigatorio,
}: {
  label: string;
  nome: string;
  tipo?: string;
  placeholder?: string;
  obrigatorio?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={nome}
        className="mb-1 block text-xs font-medium text-mata-700"
      >
        {label}
      </label>
      <input
        id={nome}
        name={nome}
        type={tipo}
        required={obrigatorio}
        placeholder={placeholder}
        className="w-full rounded-lg border border-mata-200 px-3 py-2 text-sm outline-none focus:border-terra-500"
      />
    </div>
  );
}
