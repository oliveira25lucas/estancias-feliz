"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarCheck,
  CalendarDays,
  CalendarSearch,
  CheckCircle2,
  Lightbulb,
  Loader2,
  Users,
  XCircle,
} from "lucide-react";
import {
  CAUCAO,
  HIDROMASSAGEM_DIARIA,
  calcularOrcamento,
  comReajuste,
  formatarBRL,
  formatarDataBR,
  tabelaDePrecos,
} from "@/lib/pricing";
import { CAPACIDADE, linkWhatsApp } from "@/lib/site-config";
import { CampoData } from "./CampoData";

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

type Modo = "indefinido" | "com-data" | "sem-data";
type Estado = "parado" | "enviando" | "enviado" | "erro";
type Agenda =
  | { situacao: "ocioso" }
  | { situacao: "checando" }
  | { situacao: "livre" }
  | { situacao: "ocupado" }
  | { situacao: "desconhecido" };

export function CalculadoraOrcamento() {
  const [modo, setModo] = useState<Modo>("indefinido");

  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [pessoas, setPessoas] = useState("");
  const [hidromassagem, setHidromassagem] = useState(false);
  const [periodoDesejado, setPeriodoDesejado] = useState("");

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [ocasiao, setOcasiao] = useState<string>(OCASIOES[0]);
  const [observacoes, setObservacoes] = useState("");

  const [estado, setEstado] = useState<Estado>("parado");
  const [mensagemErro, setMensagemErro] = useState("");
  /** Última resposta da agenda, marcada com o período que originou a consulta. */
  const [consulta, setConsulta] = useState<{
    chave: string;
    livre: boolean | null;
  } | null>(null);

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

  // Identifica o período consultado. Enquanto a resposta guardada não for
  // deste período, ainda estamos esperando.
  const chavePeriodo = orcamento.valido
    ? `${orcamento.checkin}|${orcamento.checkout}`
    : "";

  // O estado exibido é derivado, não guardado: evita renderização em
  // cascata e nunca fica preso num "checando" antigo.
  const agenda: Agenda =
    modo !== "com-data" || !orcamento.valido
      ? { situacao: "ocioso" }
      : consulta?.chave !== chavePeriodo
        ? { situacao: "checando" }
        : consulta.livre === null
          ? { situacao: "desconhecido" }
          : { situacao: consulta.livre ? "livre" : "ocupado" };

  // ---- Consulta a agenda quando as datas mudam ----
  useEffect(() => {
    if (modo !== "com-data" || !chavePeriodo) return;

    let cancelado = false;
    const [inicio, fim] = chavePeriodo.split("|");

    // Espera a pessoa parar de mexer antes de consultar.
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/disponibilidade?checkin=${inicio}&checkout=${fim}`,
        );
        const dados = await r.json();
        if (cancelado) return;
        setConsulta({
          chave: chavePeriodo,
          livre: dados.conhecido ? Boolean(dados.livre) : null,
        });
      } catch {
        if (!cancelado) setConsulta({ chave: chavePeriodo, livre: null });
      }
    }, 500);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [modo, chavePeriodo]);

  const contatoOk =
    nome.trim().length >= 3 && telefone.replace(/\D/g, "").length >= 10;
  const podeEnviar =
    contatoOk &&
    estado !== "enviando" &&
    (modo === "sem-data" ? Number(pessoas) > 0 : orcamento.valido);

  function montarMensagem(): string {
    const linhas = [`Olá! Fiz um orçamento no site do Sítio Estâncias Feliz:`, ``];
    linhas.push(`Nome: ${nome}`);

    if (modo === "com-data" && orcamento.valido) {
      linhas.push(
        `Entrada: ${formatarDataBR(orcamento.checkin)}`,
        `Saída: ${formatarDataBR(orcamento.checkout)}`,
        `Pessoas: ${orcamento.pessoas}`,
        `Ocasião: ${ocasiao}`,
      );
      if (hidromassagem) linhas.push(`Hidromassagem: sim`);
      linhas.push(
        ``,
        `Valor calculado: ${formatarBRL(orcamento.valorTotal)}`,
        `(${orcamento.tipoCalculo})`,
      );
      if (orcamento.pacoteObrigatorio) {
        linhas.push(`Obs: esta data é alugada como pacote fechado.`);
      }
    } else {
      linhas.push(
        `Pessoas: ${pessoas || "a definir"}`,
        `Ocasião: ${ocasiao}`,
        `Época pretendida: ${periodoDesejado || "ainda não sei"}`,
        ``,
        `Ainda não tenho data fechada e gostaria de ver as opções.`,
      );
    }

    if (observacoes.trim()) linhas.push(``, `Observações: ${observacoes.trim()}`);
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
          temData: modo === "com-data",
          nome,
          telefone,
          email,
          ocasiao,
          observacoes,
          pessoas: Number(pessoas) || 1,
          hidromassagem,
          ...(modo === "com-data"
            ? { checkin: orcamento.checkin, checkout: orcamento.checkout }
            : { periodoDesejado }),
        }),
      });

      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => ({}));
        throw new Error(corpo.erro || "Não foi possível registrar o pedido.");
      }

      setEstado("enviado");
      window.open(linkWhatsApp(mensagem), "_blank", "noopener,noreferrer");
    } catch (erro) {
      // O contato nunca pode se perder por causa de uma falha nossa:
      // mesmo com erro no registro, mandamos a pessoa para o WhatsApp.
      setEstado("erro");
      setMensagemErro(erro instanceof Error ? erro.message : "Erro inesperado.");
      window.open(linkWhatsApp(mensagem), "_blank", "noopener,noreferrer");
    }
  }

  // ---- Escolha inicial do caminho ----
  if (modo === "indefinido") {
    return <EscolhaDeCaminho onEscolher={setModo} />;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
      <form
        onSubmit={aoEnviar}
        className="space-y-8 rounded-3xl border border-mata-100 bg-white p-6 shadow-sm sm:p-8"
      >
        <button
          type="button"
          onClick={() => setModo("indefinido")}
          className="text-sm font-medium text-mata-600 underline underline-offset-4 transition hover:text-mata-800"
        >
          {modo === "com-data"
            ? "Na verdade, ainda não tenho data"
            : "Na verdade, já sei minha data"}
        </button>

        {modo === "com-data" ? (
          <fieldset>
            <legend className="flex items-center gap-2 font-display text-lg font-semibold text-mata-900">
              <CalendarDays className="size-5 text-terra-500" aria-hidden />
              Quando vai ser?
            </legend>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <CampoData
                label="Entrada"
                valor={checkin}
                aoMudar={setCheckin}
                min={hojeISO()}
                obrigatorio
              />
              <CampoData
                label="Saída"
                valor={checkout}
                aoMudar={setCheckout}
                min={checkin || hojeISO()}
                obrigatorio
              />
            </div>

            {orcamento.pacoteObrigatorio && (
              <div className="mt-4 flex gap-3 rounded-2xl bg-terra-500/10 p-4">
                <CalendarCheck
                  className="mt-0.5 size-5 shrink-0 text-terra-600"
                  aria-hidden
                />
                <div className="text-sm leading-relaxed text-mata-800">
                  <p>{orcamento.pacoteObrigatorio.motivo}</p>
                  {orcamento.pacoteObrigatorio.inicioAlternativo && (
                    <p className="mt-1 text-mata-600">
                      Você também pode entrar em{" "}
                      {formatarDataBR(
                        orcamento.pacoteObrigatorio.inicioAlternativo,
                      )}
                      , pelo mesmo valor.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setCheckin(orcamento.pacoteObrigatorio!.inicio);
                      setCheckout(orcamento.pacoteObrigatorio!.fim);
                    }}
                    className="mt-2 font-semibold text-terra-700 underline underline-offset-4"
                  >
                    Usar as datas do pacote
                  </button>
                </div>
              </div>
            )}

            <AvisoAgenda agenda={agenda} />
          </fieldset>
        ) : (
          <fieldset>
            <legend className="flex items-center gap-2 font-display text-lg font-semibold text-mata-900">
              <CalendarSearch className="size-5 text-terra-500" aria-hidden />
              Tem alguma época em mente?
            </legend>
            <p className="mt-2 text-sm text-mata-600">
              Não precisa ser exato. Ajuda a gente a te mostrar as datas livres.
            </p>
            <div className="mt-5">
              <Campo
                label="Época pretendida"
                htmlFor="periodo"
                opcional
                dica="Ex: novembro, no meio do ano, feriado de setembro"
              >
                <input
                  id="periodo"
                  placeholder="Ex: um fim de semana em novembro"
                  value={periodoDesejado}
                  onChange={(e) => setPeriodoDesejado(e.target.value)}
                  className={estiloInput}
                />
              </Campo>
            </div>
          </fieldset>
        )}

        <fieldset>
          <legend className="flex items-center gap-2 font-display text-lg font-semibold text-mata-900">
            <Users className="size-5 text-terra-500" aria-hidden />
            Quantas pessoas?
          </legend>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Campo
              label="Número de pessoas"
              htmlFor="pessoas"
              dica={`${CAPACIDADE.dormirAtual} para dormir, até ${CAPACIDADE.eventoMax} em evento`}
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

          {modo === "com-data" && (
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
                Adicional por diária.
              </span>
            </label>
          )}
        </fieldset>

        <fieldset>
          <legend className="font-display text-lg font-semibold text-mata-900">
            Para onde enviamos a resposta?
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
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0 text-mata-600"
              aria-hidden
            />
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

      <aside className="lg:sticky lg:top-24">
        {modo === "com-data" ? (
          <ResumoComData orcamento={orcamento} />
        ) : (
          <ResumoSemData />
        )}
      </aside>
    </div>
  );
}

// ============================================================
//  Escolha do caminho
// ============================================================

function EscolhaDeCaminho({
  onEscolher,
}: {
  onEscolher: (m: Modo) => void;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-center font-display text-2xl font-semibold text-mata-900">
        Você já tem uma data em mente?
      </h2>
      <p className="mt-2 text-center text-mata-600">
        Nos dois casos a gente responde na hora.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onEscolher("com-data")}
          className="group rounded-3xl border-2 border-mata-100 bg-white p-7 text-left transition hover:border-terra-500 hover:shadow-lg"
        >
          <span className="inline-flex rounded-2xl bg-terra-500/10 p-3">
            <CalendarDays className="size-6 text-terra-600" aria-hidden />
          </span>
          <h3 className="mt-4 font-display text-xl font-semibold text-mata-900">
            Já sei minha data
          </h3>
          <p className="mt-2 leading-relaxed text-mata-600">
            Calculamos o valor exato daquele período e conferimos na hora se
            está livre.
          </p>
          <span className="mt-4 inline-block font-semibold text-terra-600 transition group-hover:underline">
            Calcular minha data →
          </span>
        </button>

        <button
          type="button"
          onClick={() => onEscolher("sem-data")}
          className="group rounded-3xl border-2 border-mata-100 bg-white p-7 text-left transition hover:border-mata-400 hover:shadow-lg"
        >
          <span className="inline-flex rounded-2xl bg-mata-50 p-3">
            <CalendarSearch className="size-6 text-mata-600" aria-hidden />
          </span>
          <h3 className="mt-4 font-display text-xl font-semibold text-mata-900">
            Ainda não decidi
          </h3>
          <p className="mt-2 leading-relaxed text-mata-600">
            Mostramos a tabela completa de valores e ajudamos você a escolher a
            melhor data.
          </p>
          <span className="mt-4 inline-block font-semibold text-mata-700 transition group-hover:underline">
            Ver a tabela de preços →
          </span>
        </button>
      </div>
    </div>
  );
}

// ============================================================
//  Resumos
// ============================================================

function ResumoComData({
  orcamento,
}: {
  orcamento: ReturnType<typeof calcularOrcamento>;
}) {
  return (
    <div className="rounded-3xl border border-mata-100 bg-mata-800 p-6 text-areia-50 shadow-lg">
      <h2 className="font-display text-lg font-semibold">Seu orçamento</h2>

      {!orcamento.valido ? (
        <p className="mt-4 text-sm leading-relaxed text-areia-200">
          {orcamento.erro ??
            "Preencha as datas e o número de pessoas para ver o valor."}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-areia-300">{orcamento.tipoCalculo}</p>

          <dl className="mt-6 space-y-3 border-t border-mata-600 pt-5 text-sm">
            <Linha
              rotulo="Entrada"
              valor={formatarDataBR(orcamento.checkin)}
            />
            <Linha rotulo="Saída" valor={formatarDataBR(orcamento.checkout)} />
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
              <strong className="text-white">{orcamento.feriado.nome}</strong>
              {orcamento.diasForaDoFeriado > 0 ? (
                <>
                  , de {formatarDataBR(orcamento.feriado.inicio)} a{" "}
                  {formatarDataBR(orcamento.feriado.fim)}. As outras{" "}
                  {orcamento.diasForaDoFeriado} diária
                  {orcamento.diasForaDoFeriado > 1 ? "s" : ""} da sua estadia
                  {orcamento.diasForaDoFeriado > 1 ? " são cobradas" : " é cobrada"}{" "}
                  à parte.
                </>
              ) : (
                ", que tem valor fechado."
              )}
            </p>
          )}

          {orcamento.upsell && (
            <p className="mt-4 flex gap-2 rounded-2xl bg-terra-500/20 p-4 text-xs leading-relaxed text-areia-100">
              <Lightbulb
                className="mt-0.5 size-4 shrink-0 text-terra-400"
                aria-hidden
              />
              <span>{orcamento.upsell}</span>
            </p>
          )}
        </>
      )}

      <p className="mt-6 text-xs leading-relaxed text-areia-300">
        Este valor é uma estimativa automática. A confirmação da data acontece
        pelo WhatsApp.
      </p>
    </div>
  );
}

function ResumoSemData() {
  const ano = new Date().getFullYear();
  const tabela = tabelaDePrecos(ano);
  const hidro = comReajuste(HIDROMASSAGEM_DIARIA, ano);

  return (
    <div className="rounded-3xl border border-mata-100 bg-mata-800 p-6 text-areia-50 shadow-lg">
      <h2 className="font-display text-lg font-semibold">Tabela de valores</h2>
      <p className="mt-1 text-sm text-areia-300">
        Valores da estadia inteira, não por pessoa.
      </p>

      <ul className="mt-6 space-y-4 border-t border-mata-600 pt-5">
        {tabela.map((l) => (
          <li key={l.titulo}>
            <p className="text-sm font-medium">{l.titulo}</p>
            <p className="text-xs text-areia-300">{l.detalhe}</p>
            <p className="mt-1 font-display text-xl font-semibold">
              {l.prefixo && (
                <span className="mr-1 text-xs font-normal uppercase tracking-wide text-areia-300">
                  {l.prefixo}
                </span>
              )}
              {formatarBRL(l.valor)}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-5 space-y-2 border-t border-mata-600 pt-5 text-xs leading-relaxed text-areia-200">
        <p>Hidromassagem: {formatarBRL(hidro)} por diária, se quiser.</p>
        <p>Caução de {formatarBRL(CAUCAO)}, devolvida ao final.</p>
        <p>
          Feriados têm pacotes próprios, com período fechado. Diga a época que
          você pensa e a gente calcula certinho.
        </p>
      </div>
    </div>
  );
}

// ============================================================
//  Peças de interface
// ============================================================

function AvisoAgenda({ agenda }: { agenda: Agenda }) {
  if (agenda.situacao === "ocioso") return null;

  const conteudo = {
    checando: {
      icone: <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />,
      texto: "Conferindo se essa data está livre...",
      classe: "bg-mata-50 text-mata-700",
    },
    livre: {
      icone: <CheckCircle2 className="size-4 shrink-0" aria-hidden />,
      texto: "Essa data está livre! Garanta agora, elas costumam voar.",
      classe: "bg-mata-100 text-mata-800",
    },
    ocupado: {
      icone: <XCircle className="size-4 shrink-0" aria-hidden />,
      texto:
        "Essa data já está reservada. Envie assim mesmo que a gente sugere as datas livres mais próximas.",
      classe: "bg-amber-50 text-amber-800",
    },
    desconhecido: {
      icone: <AlertCircle className="size-4 shrink-0" aria-hidden />,
      texto:
        "Não conseguimos conferir a agenda agora. Envie o pedido que confirmamos pelo WhatsApp.",
      classe: "bg-areia-100 text-mata-700",
    },
  }[agenda.situacao];

  return (
    <p
      className={`mt-4 flex items-center gap-2 rounded-2xl p-4 text-sm ${conteudo.classe}`}
    >
      {conteudo.icone}
      <span>{conteudo.texto}</span>
    </p>
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
