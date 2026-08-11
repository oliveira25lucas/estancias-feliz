"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Lightbulb,
  Loader2,
  Users,
} from "lucide-react";
import {
  CAUCAO,
  HIDROMASSAGEM_DIARIA,
  calcularOrcamento,
  formatarBRL,
} from "@/lib/pricing";
import { CAPACIDADE, linkWhatsApp } from "@/lib/site-config";

const OCASIOES = [
  "Confraternização em família",
  "Aniversário",
  "Casamento",
  "Evento de empresa",
  "Férias / descanso",
  "Outro",
] as const;

/** Formata o telefone conforme a pessoa digita: (31) 91234-5678 */
function mascararTelefone(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function hojeISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

type Estado = "parado" | "enviando" | "enviado" | "erro";

export function CalculadoraOrcamento() {
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [pessoas, setPessoas] = useState("");
  const [hidromassagem, setHidromassagem] = useState(false);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [ocasiao, setOcasiao] = useState<string>(OCASIOES[0]);
  const [observacoes, setObservacoes] = useState("");

  const [estado, setEstado] = useState<Estado>("parado");
  const [mensagemErro, setMensagemErro] = useState("");

  const orcamento = useMemo(
    () =>
      calcularOrcamento({
        checkin,
        checkout,
        pessoas: Number(pessoas),
        hidromassagem,
      }),
    [checkin, checkout, pessoas, hidromassagem],
  );

  const podeEnviar =
    orcamento.valido &&
    nome.trim().length >= 3 &&
    telefone.replace(/\D/g, "").length >= 10 &&
    estado !== "enviando";

  /** Texto que a pessoa leva pronto para o WhatsApp — a Júlia continua dali. */
  function montarMensagem(): string {
    const linhas = [
      `Olá! Fiz um orçamento no site do Sítio Estâncias Feliz:`,
      ``,
      `Nome: ${nome}`,
      `Entrada: ${formatarDataBR(checkin)}`,
      `Saída: ${formatarDataBR(checkout)}`,
      `Pessoas: ${orcamento.pessoas}`,
      `Ocasião: ${ocasiao}`,
    ];
    if (hidromassagem) linhas.push(`Hidromassagem: sim`);
    linhas.push(``, `Valor calculado: ${formatarBRL(orcamento.valorTotal)}`);
    linhas.push(`(${orcamento.tipoCalculo})`);
    if (observacoes.trim()) linhas.push(``, `Observações: ${observacoes.trim()}`);
    linhas.push(``, `Gostaria de confirmar a disponibilidade dessa data.`);
    return linhas.join("\n");
  }

  async function aoEnviar(e: React.FormEvent) {
    e.preventDefault();
    if (!podeEnviar) return;

    setEstado("enviando");
    setMensagemErro("");

    const mensagem = montarMensagem();

    try {
      const resposta = await fetch("/api/orcamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          telefone,
          email,
          checkin,
          checkout,
          pessoas: orcamento.pessoas,
          ocasiao,
          hidromassagem,
          observacoes,
          valorCalculado: orcamento.valorTotal,
          tipoCalculo: orcamento.tipoCalculo,
        }),
      });

      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => ({}));
        throw new Error(corpo.erro || "Não foi possível registrar o pedido.");
      }

      setEstado("enviado");
      // Abre o WhatsApp já com tudo preenchido.
      window.open(linkWhatsApp(mensagem), "_blank", "noopener,noreferrer");
    } catch (erro) {
      // O contato nunca pode se perder por causa de uma falha nossa:
      // mesmo com erro no registro, mandamos a pessoa para o WhatsApp.
      setEstado("erro");
      setMensagemErro(
        erro instanceof Error ? erro.message : "Erro inesperado.",
      );
      window.open(linkWhatsApp(mensagem), "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
      <form
        onSubmit={aoEnviar}
        className="space-y-8 rounded-3xl border border-mata-100 bg-white p-6 shadow-sm sm:p-8"
      >
        {/* ---- Etapa 1: a data ---- */}
        <fieldset>
          <legend className="flex items-center gap-2 font-display text-lg font-semibold text-mata-900">
            <CalendarDays className="size-5 text-terra-500" aria-hidden />
            Quando vai ser?
          </legend>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Campo label="Entrada" htmlFor="checkin">
              <input
                id="checkin"
                type="date"
                required
                min={hojeISO()}
                value={checkin}
                onChange={(e) => setCheckin(e.target.value)}
                className={estiloInput}
              />
            </Campo>
            <Campo label="Saída" htmlFor="checkout">
              <input
                id="checkout"
                type="date"
                required
                min={checkin || hojeISO()}
                value={checkout}
                onChange={(e) => setCheckout(e.target.value)}
                className={estiloInput}
              />
            </Campo>
          </div>
        </fieldset>

        {/* ---- Etapa 2: o grupo ---- */}
        <fieldset>
          <legend className="flex items-center gap-2 font-display text-lg font-semibold text-mata-900">
            <Users className="size-5 text-terra-500" aria-hidden />
            Quantas pessoas?
          </legend>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Campo
              label="Número de pessoas"
              htmlFor="pessoas"
              dica={`Até ${CAPACIDADE.dormirMax} para dormir, até ${CAPACIDADE.eventoMax} em evento`}
            >
              <input
                id="pessoas"
                type="number"
                required
                min={1}
                max={CAPACIDADE.eventoMax}
                inputMode="numeric"
                placeholder="Ex: 25"
                value={pessoas}
                onChange={(e) => setPessoas(e.target.value)}
                className={estiloInput}
              />
            </Campo>
            <Campo label="Qual a ocasião?" htmlFor="ocasiao">
              <select
                id="ocasiao"
                value={ocasiao}
                onChange={(e) => setOcasiao(e.target.value)}
                className={estiloInput}
              >
                {OCASIOES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-areia-50 p-4">
            <input
              type="checkbox"
              checked={hidromassagem}
              onChange={(e) => setHidromassagem(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 rounded accent-terra-500"
            />
            <span className="text-sm text-mata-700">
              <strong className="font-semibold text-mata-900">
                Quero a hidromassagem
              </strong>
              <br />
              Adicional de {formatarBRL(HIDROMASSAGEM_DIARIA)} por diária.
            </span>
          </label>
        </fieldset>

        {/* ---- Etapa 3: contato ---- */}
        <fieldset>
          <legend className="font-display text-lg font-semibold text-mata-900">
            Para onde enviamos a confirmação?
          </legend>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Campo label="Seu nome" htmlFor="nome">
              <input
                id="nome"
                required
                minLength={3}
                placeholder="Nome e sobrenome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className={estiloInput}
              />
            </Campo>
            <Campo label="WhatsApp" htmlFor="telefone">
              <input
                id="telefone"
                required
                inputMode="tel"
                placeholder="(31) 90000-0000"
                value={telefone}
                onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
                className={estiloInput}
              />
            </Campo>
          </div>

          <div className="mt-4 grid gap-4">
            <Campo label="E-mail" htmlFor="email" opcional>
              <input
                id="email"
                type="email"
                placeholder="seuemail@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={estiloInput}
              />
            </Campo>
            <Campo label="Quer contar mais alguma coisa?" htmlFor="obs" opcional>
              <textarea
                id="obs"
                rows={3}
                placeholder="Ex: vamos levar um DJ, teremos crianças pequenas..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className={`${estiloInput} resize-y`}
              />
            </Campo>
          </div>
        </fieldset>

        {estado === "erro" && (
          <p className="flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Não conseguimos registrar seu pedido aqui no site ({mensagemErro}),
              mas já abrimos o WhatsApp com tudo preenchido. É só enviar a
              mensagem que a gente te responde.
            </span>
          </p>
        )}

        {estado === "enviado" && (
          <p className="flex items-start gap-2 rounded-2xl bg-mata-50 p-4 text-sm text-mata-800">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-mata-600" aria-hidden />
            <span>
              Pedido registrado! Abrimos o WhatsApp em outra aba — é só enviar a
              mensagem. Se não abriu, verifique o bloqueador de pop-ups.
            </span>
          </p>
        )}

        <button
          type="submit"
          disabled={!podeEnviar}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-terra-500 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-terra-600 disabled:cursor-not-allowed disabled:bg-mata-200 disabled:text-mata-500 disabled:shadow-none"
        >
          {estado === "enviando" ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden />
              Enviando...
            </>
          ) : (
            "Enviar e falar no WhatsApp"
          )}
        </button>

        <p className="text-center text-xs text-mata-500">
          Seus dados são usados apenas para responder a este orçamento.
        </p>
      </form>

      {/* ---- Resumo grudado na lateral ---- */}
      <aside className="lg:sticky lg:top-24">
        <div className="rounded-3xl border border-mata-100 bg-mata-800 p-6 text-areia-50 shadow-lg">
          <h2 className="font-display text-lg font-semibold">Seu orçamento</h2>

          {!orcamento.valido ? (
            <p className="mt-4 text-sm leading-relaxed text-areia-200">
              {orcamento.erro ??
                "Preencha as datas e o número de pessoas para ver o valor."}
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-areia-300">
                {orcamento.tipoCalculo}
              </p>

              <dl className="mt-6 space-y-3 border-t border-mata-600 pt-5 text-sm">
                <Linha rotulo="Diárias" valor={`${orcamento.dias}`} />
                <Linha rotulo="Pessoas" valor={`${orcamento.pessoas}`} />
                <Linha
                  rotulo="Hospedagem"
                  valor={formatarBRL(orcamento.valorBase)}
                />
                {orcamento.valorHidromassagem > 0 && (
                  <Linha
                    rotulo="Hidromassagem"
                    valor={formatarBRL(orcamento.valorHidromassagem)}
                  />
                )}
              </dl>

              <div className="mt-5 border-t border-mata-600 pt-5">
                <p className="text-xs uppercase tracking-widest text-areia-300">
                  Valor total
                </p>
                <p className="font-display text-4xl font-semibold">
                  {formatarBRL(orcamento.valorTotal)}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-areia-300">
                  + {formatarBRL(CAUCAO)} de caução, devolvida integralmente ao
                  final se estiver tudo certo.
                </p>
              </div>

              {orcamento.feriado && (
                <p className="mt-5 rounded-2xl bg-mata-900/60 p-4 text-xs leading-relaxed text-areia-200">
                  Sua data cai no pacote{" "}
                  <strong className="text-white">
                    {orcamento.feriado.nome}
                  </strong>
                  , que tem valor fechado.
                </p>
              )}

              {orcamento.upsell && (
                <p className="mt-4 flex gap-2 rounded-2xl bg-terra-500/20 p-4 text-xs leading-relaxed text-areia-100">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-terra-400" aria-hidden />
                  <span>{orcamento.upsell}</span>
                </p>
              )}
            </>
          )}

          <p className="mt-6 text-xs leading-relaxed text-areia-300">
            Este valor é uma estimativa automática. A confirmação da data
            acontece pelo WhatsApp.
          </p>
        </div>
      </aside>
    </div>
  );
}

const estiloInput =
  "w-full rounded-xl border border-mata-200 bg-white px-4 py-3 text-mata-900 outline-none transition placeholder:text-mata-400 focus:border-terra-500 focus:ring-2 focus:ring-terra-500/25";

function Campo({
  label,
  htmlFor,
  dica,
  opcional,
  children,
}: {
  label: string;
  htmlFor: string;
  dica?: string;
  opcional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-sm font-medium text-mata-800"
      >
        {label}
        {opcional && (
          <span className="ml-1.5 font-normal text-mata-500">(opcional)</span>
        )}
      </label>
      {children}
      {dica && <p className="mt-1.5 text-xs text-mata-500">{dica}</p>}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-areia-200">{rotulo}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}

function formatarDataBR(iso: string): string {
  if (!iso) return "";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}
