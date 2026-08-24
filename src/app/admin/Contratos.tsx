"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FilePlus2,
  FileText,
  Loader2,
  Pencil,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { CampoData } from "@/components/CampoData";
import { formatarBRL, formatarDataBR } from "@/lib/pricing";
import {
  PADROES,
  dadosDaReserva,
  noites,
  parcelasComSinal,
  parcelasIguais,
  somaParcelas,
  temEvento,
  type DadosContrato,
  type Parcela,
} from "@/lib/contrato";
import type { Contrato, StatusContrato } from "@/lib/contratos";
import type { Reserva } from "@/lib/supabase";
import { apagarContrato, novoContrato, salvarContrato } from "./acoes-contratos";

const STATUS: Record<StatusContrato, { rotulo: string; cor: string }> = {
  RASCUNHO: { rotulo: "Rascunho", cor: "bg-amber-100 text-amber-800" },
  ENVIADO: { rotulo: "Enviado", cor: "bg-mata-100 text-mata-800" },
  ASSINADO: { rotulo: "Assinado", cor: "bg-terra-500/15 text-terra-700" },
};

/** O formulário começa assim quando não vem de reserva nenhuma. */
function contratoEmBranco(): DadosContrato {
  return {
    locatarioNome: "",
    locatarioCpf: "",
    locatarioEndereco: "",
    locatarioTelefone: "",
    checkin: "",
    checkout: "",
    horaCheckin: PADROES.horaCheckin,
    horaCheckout: PADROES.horaCheckout,
    pessoasEstadia: PADROES.pessoasEstadia,
    pessoasEvento: 0,
    valorTotal: 0,
    parcelas: [],
    pixChave: PADROES.pixChave,
    pixTitular: PADROES.pixTitular,
    caucao: PADROES.caucao,
    hidromassagem: PADROES.hidromassagem,
    hidromassagemDiaria: PADROES.hidromassagemDiaria,
    valorPessoaExcedente: PADROES.valorPessoaExcedente,
    valorDiariaExcedente: PADROES.valorDiariaExcedente,
    multaAtrasoCheckin: PADROES.multaAtrasoCheckin,
    multaLimpeza: PADROES.multaLimpeza,
    cidadeForo: PADROES.cidadeForo,
    dataAssinatura: hojeLocal(),
  };
}

function hojeLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * O formulário é CONTROLADO (estado, não `defaultValue`).
 *
 * É o que permite escolher uma reserva e ver os campos se preencherem
 * na hora, e o que faz o botão "dividir em 3x" recalcular as parcelas
 * na tela. Com inputs não controlados, cada preenchimento automático
 * exigiria remontar o formulário inteiro por `key`, e o que a pessoa já
 * tivesse digitado se perderia.
 */
export function Contratos({
  contratos,
  reservas,
}: {
  contratos: Contrato[];
  reservas: Reserva[];
}) {
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [dados, setDados] = useState<DadosContrato>(contratoEmBranco);
  const [reservaId, setReservaId] = useState("");
  const [aviso, setAviso] = useState("");
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  const reservasUteis = useMemo(
    () =>
      reservas
        .filter((r) => r.status !== "CANCELADA" && r.data_checkin)
        .sort((a, b) => (a.data_checkin ?? "").localeCompare(b.data_checkin ?? "")),
    [reservas],
  );

  function mudar<K extends keyof DadosContrato>(chave: K, valor: DadosContrato[K]) {
    setDados((d) => ({ ...d, [chave]: valor }));
  }

  function abrirNovo() {
    setEditando(null);
    setReservaId("");
    setDados(contratoEmBranco());
    setAviso("");
    setAberto(true);
  }

  function abrirEdicao(c: Contrato) {
    setEditando(c.id);
    setReservaId(c.reservaId ?? "");
    setDados({ ...c });
    setAviso("");
    setAberto(true);
  }

  function usarReserva(id: string) {
    setReservaId(id);
    const r = reservasUteis.find((x) => String(x.id) === id);
    if (!r) return;
    // Preserva o que já foi digitado à mão: a reserva não sabe CPF nem
    // endereço, e apagar isso porque alguém trocou a reserva de lugar
    // seria o pior momento para perder um dado que só existe aqui.
    setDados((d) => ({
      ...dadosDaReserva(r),
      locatarioCpf: d.locatarioCpf,
      locatarioEndereco: d.locatarioEndereco,
      dataAssinatura: d.dataAssinatura || hojeLocal(),
    }));
  }

  function paraFormData(): FormData {
    const fd = new FormData();
    fd.set("reserva_id", reservaId);
    fd.set("locatario_nome", dados.locatarioNome);
    fd.set("locatario_cpf", dados.locatarioCpf);
    fd.set("locatario_endereco", dados.locatarioEndereco);
    fd.set("locatario_telefone", dados.locatarioTelefone);
    fd.set("data_checkin", dados.checkin);
    fd.set("data_checkout", dados.checkout);
    fd.set("hora_checkin", dados.horaCheckin);
    fd.set("hora_checkout", dados.horaCheckout);
    fd.set("pessoas_estadia", String(dados.pessoasEstadia));
    fd.set("pessoas_evento", String(dados.pessoasEvento));
    fd.set("valor_total", String(dados.valorTotal));
    fd.set("parcelas", JSON.stringify(dados.parcelas));
    fd.set("pix_chave", dados.pixChave);
    fd.set("pix_titular", dados.pixTitular);
    fd.set("caucao", String(dados.caucao));
    fd.set("hidromassagem", dados.hidromassagem ? "true" : "false");
    fd.set("hidromassagem_diaria", String(dados.hidromassagemDiaria));
    fd.set("valor_pessoa_excedente", String(dados.valorPessoaExcedente));
    fd.set("valor_diaria_excedente", String(dados.valorDiariaExcedente));
    fd.set("multa_atraso_checkin", String(dados.multaAtrasoCheckin));
    fd.set("multa_limpeza", String(dados.multaLimpeza));
    fd.set("cidade_foro", dados.cidadeForo);
    fd.set("data_assinatura", dados.dataAssinatura);
    return fd;
  }

  function salvar() {
    setAviso("");
    iniciar(async () => {
      try {
        if (editando) {
          await salvarContrato(editando, paraFormData());
          setAberto(false);
        } else {
          const id = await novoContrato(paraFormData());
          // Contrato novo abre direto na via impressa: o passo seguinte
          // é sempre conferir e mandar, nunca voltar para a lista.
          router.push(`/admin/contratos/${id}`);
        }
      } catch (e) {
        setAviso(e instanceof Error ? e.message : "Falha ao salvar.");
      }
    });
  }

  const qtdNoites = noites(dados);
  const soma = somaParcelas(dados.parcelas);
  const difere =
    dados.parcelas.length > 0 && Math.abs(soma - dados.valorTotal) > 0.005;

  return (
    <div className="rounded-2xl border border-mata-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-mata-900">
            Contratos
          </h3>
          <p className="text-xs text-mata-500">
            Sai do modelo base, com nome, datas, parcelas e horários deste
            aluguel. O PDF é o “Salvar como PDF” do navegador.
          </p>
        </div>
        <button
          type="button"
          onClick={() => (aberto ? setAberto(false) : abrirNovo())}
          className="inline-flex items-center gap-2 rounded-full bg-mata-700 px-4 py-2 text-sm font-semibold text-areia-50 transition hover:bg-mata-800"
        >
          {aberto ? (
            <>
              <X className="size-4" aria-hidden /> Cancelar
            </>
          ) : (
            <>
              <FilePlus2 className="size-4" aria-hidden /> Novo contrato
            </>
          )}
        </button>
      </div>

      {aberto && (
        <div className="mt-5 space-y-5 rounded-2xl bg-areia-50 p-4">
          {/* ---- de onde vem ---- */}
          {!editando && (
            <div>
              <label
                htmlFor="reserva_id"
                className="mb-1 block text-xs font-medium text-mata-700"
              >
                Preencher a partir de uma reserva
              </label>
              <select
                id="reserva_id"
                value={reservaId}
                onChange={(e) => usarReserva(e.target.value)}
                className="w-full rounded-lg border border-mata-200 bg-white px-3 py-2 text-sm outline-none focus:border-terra-500"
              >
                <option value="">Começar em branco</option>
                {reservasUteis.map((r) => (
                  <option key={String(r.id)} value={String(r.id)}>
                    {r.nome_cliente ?? r.telefone ?? "sem nome"} ·{" "}
                    {formatarDataBR(r.data_checkin ?? "")} a{" "}
                    {formatarDataBR(r.data_checkout ?? "")}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-mata-500">
                CPF e endereço não vêm da reserva — ninguém pergunta isso no
                WhatsApp.
              </p>
            </div>
          )}

          {/* ---- quem assina ---- */}
          <Bloco titulo="Quem assina">
            <Campo
              label="Nome completo"
              valor={dados.locatarioNome}
              aoMudar={(v) => mudar("locatarioNome", v)}
              largo
            />
            <Campo
              label="CPF"
              valor={dados.locatarioCpf}
              aoMudar={(v) => mudar("locatarioCpf", v)}
              placeholder="000.000.000-00"
            />
            <Campo
              label="Telefone"
              valor={dados.locatarioTelefone}
              aoMudar={(v) => mudar("locatarioTelefone", v)}
              placeholder="(31) 90000-0000"
            />
            <Campo
              label="Endereço"
              valor={dados.locatarioEndereco}
              aoMudar={(v) => mudar("locatarioEndereco", v)}
              largo
            />
          </Bloco>

          {/* ---- a estadia ---- */}
          <Bloco titulo="A estadia">
            <CampoData
              label="Entrada"
              name="data_checkin"
              valor={dados.checkin}
              aoMudar={(v) => mudar("checkin", v)}
              obrigatorio
              compacto
            />
            <CampoData
              label="Saída"
              name="data_checkout"
              valor={dados.checkout}
              aoMudar={(v) => mudar("checkout", v)}
              min={dados.checkin || undefined}
              obrigatorio
              compacto
            />
            <Campo
              label="Hora de entrada"
              tipo="time"
              valor={dados.horaCheckin}
              aoMudar={(v) => mudar("horaCheckin", v)}
            />
            <Campo
              label="Hora de saída"
              tipo="time"
              valor={dados.horaCheckout}
              aoMudar={(v) => mudar("horaCheckout", v)}
            />
            <Campo
              label="Pessoas dormindo"
              tipo="number"
              valor={String(dados.pessoasEstadia)}
              aoMudar={(v) => mudar("pessoasEstadia", Number(v) || 0)}
            />
            <Campo
              label="Pessoas no evento"
              tipo="number"
              valor={String(dados.pessoasEvento)}
              aoMudar={(v) => mudar("pessoasEvento", Number(v) || 0)}
              dica={
                temEvento(dados)
                  ? "A cláusula sai com os dois limites."
                  : "0 ou igual ao de dormir: a cláusula sai com um número só."
              }
            />
            {qtdNoites > 0 && (
              <p className="sm:col-span-2 text-xs text-mata-600">
                {qtdNoites} {qtdNoites === 1 ? "noite" : "noites"} — é o que vai
                escrito na cláusula do prazo.
              </p>
            )}
          </Bloco>

          {/* ---- dinheiro ---- */}
          <Bloco titulo="Valor e pagamento">
            <Campo
              label="Valor do aluguel"
              tipo="number"
              valor={String(dados.valorTotal)}
              aoMudar={(v) => mudar("valorTotal", Number(v) || 0)}
            />
            <Campo
              label="Caução"
              tipo="number"
              valor={String(dados.caucao)}
              aoMudar={(v) => mudar("caucao", Number(v) || 0)}
            />
            <Campo
              label="Chave PIX"
              valor={dados.pixChave}
              aoMudar={(v) => mudar("pixChave", v)}
            />
            <Campo
              label="Titular do PIX"
              valor={dados.pixTitular}
              aoMudar={(v) => mudar("pixTitular", v)}
            />

            <div className="sm:col-span-2">
              <Parcelas
                parcelas={dados.parcelas}
                total={dados.valorTotal}
                checkin={dados.checkin}
                aoMudar={(p) => mudar("parcelas", p)}
              />
              {difere && (
                <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                  As parcelas somam {formatarBRL(soma)} e o aluguel é{" "}
                  {formatarBRL(dados.valorTotal)}. Diferença de{" "}
                  {formatarBRL(Math.abs(soma - dados.valorTotal))}.
                </p>
              )}
            </div>
          </Bloco>

          {/* ---- hidro ---- */}
          <Bloco titulo="Hidromassagem">
            <label className="flex items-center gap-2 text-sm text-mata-800">
              <input
                type="checkbox"
                checked={dados.hidromassagem}
                onChange={(e) => mudar("hidromassagem", e.target.checked)}
                className="size-4 accent-terra-500"
              />
              Contratada neste contrato
            </label>
            <Campo
              label="Valor por diária"
              tipo="number"
              valor={String(dados.hidromassagemDiaria)}
              aoMudar={(v) => mudar("hidromassagemDiaria", Number(v) || 0)}
              dica={
                dados.hidromassagem && qtdNoites > 0
                  ? `${formatarBRL(dados.hidromassagemDiaria * qtdNoites)} pelas ${qtdNoites} diárias`
                  : "Sai na cláusula como opcional."
              }
            />
          </Bloco>

          {/* ---- o que quase nunca muda ---- */}
          <details className="rounded-xl border border-mata-100 bg-white p-3">
            <summary className="cursor-pointer text-sm font-medium text-mata-800">
              Multas, excedentes e foro
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Campo
                label="Por pessoa excedente / diária"
                tipo="number"
                valor={String(dados.valorPessoaExcedente)}
                aoMudar={(v) => mudar("valorPessoaExcedente", Number(v) || 0)}
              />
              <Campo
                label="Diária por atraso na saída"
                tipo="number"
                valor={String(dados.valorDiariaExcedente)}
                aoMudar={(v) => mudar("valorDiariaExcedente", Number(v) || 0)}
              />
              <Campo
                label="Multa por atraso no check-in"
                tipo="number"
                valor={String(dados.multaAtrasoCheckin)}
                aoMudar={(v) => mudar("multaAtrasoCheckin", Number(v) || 0)}
              />
              <Campo
                label="Multa de limpeza"
                tipo="number"
                valor={String(dados.multaLimpeza)}
                aoMudar={(v) => mudar("multaLimpeza", Number(v) || 0)}
              />
              <Campo
                label="Foro"
                valor={dados.cidadeForo}
                aoMudar={(v) => mudar("cidadeForo", v)}
              />
              <CampoData
                label="Data de assinatura"
                name="data_assinatura"
                valor={dados.dataAssinatura}
                aoMudar={(v) => mudar("dataAssinatura", v)}
                compacto
              />
            </div>
          </details>

          {aviso && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              {aviso}
            </p>
          )}

          <button
            type="button"
            onClick={salvar}
            disabled={pendente}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-terra-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-terra-600 disabled:opacity-60"
          >
            {pendente && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {editando ? "Salvar alterações" : "Gerar contrato"}
          </button>
        </div>
      )}

      {/* ---- a lista ---- */}
      <div className="mt-5 space-y-2">
        {contratos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-mata-200 p-6 text-center text-sm text-mata-500">
            Nenhum contrato gerado ainda.
          </p>
        ) : (
          contratos.map((c) => {
            const s = STATUS[c.status] ?? STATUS.RASCUNHO;
            return (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-mata-100 p-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-mata-900">
                    {c.locatarioNome || "sem nome"}
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${s.cor}`}
                    >
                      {s.rotulo}
                    </span>
                  </p>
                  <p className="text-xs text-mata-600">
                    {formatarDataBR(c.checkin)} a {formatarDataBR(c.checkout)} ·{" "}
                    {c.horaCheckin} às {c.horaCheckout} ·{" "}
                    {formatarBRL(c.valorTotal)}
                    {c.parcelas.length > 1 ? ` em ${c.parcelas.length}x` : ""}
                  </p>
                </div>

                <Link
                  href={`/admin/contratos/${c.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-mata-200 px-3 py-1.5 text-xs font-medium text-mata-800 transition hover:bg-areia-50"
                >
                  <FileText className="size-3.5" aria-hidden />
                  Abrir
                </Link>

                <button
                  type="button"
                  onClick={() => abrirEdicao(c)}
                  className="rounded-lg p-1.5 text-mata-400 transition hover:bg-areia-100 hover:text-mata-700"
                  aria-label={`Editar contrato de ${c.locatarioNome}`}
                >
                  <Pencil className="size-4" />
                </button>

                <button
                  type="button"
                  disabled={pendente}
                  onClick={() =>
                    iniciar(async () => {
                      setAviso("");
                      try {
                        await apagarContrato(c.id);
                      } catch (e) {
                        setAviso(
                          e instanceof Error ? e.message : "Falha ao excluir.",
                        );
                      }
                    })
                  }
                  className="rounded-lg p-1.5 text-mata-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  aria-label={`Excluir contrato de ${c.locatarioNome}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============================================================
//  Parcelas
// ============================================================

/**
 * Dividir à mão é onde o contrato erra: 3.800 em 3 não dá número
 * redondo, e a conta feita na cabeça some ou inventa um centavo. Os
 * botões dividem certo (a sobra vai para as últimas), e cada linha
 * continua editável — porque o combinado com o cliente nem sempre é uma
 * divisão igual.
 */
function Parcelas({
  parcelas,
  total,
  checkin,
  aoMudar,
}: {
  parcelas: Parcela[];
  total: number;
  checkin: string;
  aoMudar: (p: Parcela[]) => void;
}) {
  const [vezes, setVezes] = useState(2);
  const [sinal, setSinal] = useState(20);
  const primeira = parcelas[0]?.data || hojeLocal();

  return (
    <div className="rounded-xl border border-mata-100 bg-white p-3">
      <p className="text-xs font-medium text-mata-700">Pagamento</p>

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div className="flex items-end gap-1">
          <input
            type="number"
            min={1}
            max={12}
            value={vezes}
            onChange={(e) => setVezes(Math.max(1, Number(e.target.value) || 1))}
            aria-label="Número de parcelas"
            className="w-16 rounded-lg border border-mata-200 px-2 py-1.5 text-sm outline-none focus:border-terra-500"
          />
          <button
            type="button"
            onClick={() => aoMudar(parcelasIguais(total, vezes, primeira, checkin))}
            disabled={total <= 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-mata-200 px-3 py-1.5 text-xs font-medium text-mata-800 transition hover:bg-areia-50 disabled:opacity-50"
          >
            <Wand2 className="size-3.5" aria-hidden />
            Dividir igual
          </button>
        </div>

        <div className="flex items-end gap-1">
          <input
            type="number"
            min={1}
            max={99}
            value={sinal}
            onChange={(e) => setSinal(Math.max(1, Number(e.target.value) || 1))}
            aria-label="Percentual do sinal"
            className="w-16 rounded-lg border border-mata-200 px-2 py-1.5 text-sm outline-none focus:border-terra-500"
          />
          <button
            type="button"
            onClick={() => aoMudar(parcelasComSinal(total, sinal, primeira, checkin))}
            disabled={total <= 0 || !checkin}
            className="inline-flex items-center gap-1.5 rounded-full border border-mata-200 px-3 py-1.5 text-xs font-medium text-mata-800 transition hover:bg-areia-50 disabled:opacity-50"
          >
            <Wand2 className="size-3.5" aria-hidden />
            % de sinal, resto na entrada
          </button>
        </div>
      </div>

      {parcelas.length === 0 ? (
        <p className="mt-3 text-xs text-mata-500">
          Sem parcela definida, a cláusula diz “a ser combinado entre as
          partes”.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {parcelas.map((p, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-6 text-xs text-mata-500">{i + 1}º</span>
              <input
                type="number"
                step="0.01"
                value={p.valor}
                onChange={(e) => {
                  const copia = [...parcelas];
                  copia[i] = { ...p, valor: Number(e.target.value) || 0 };
                  aoMudar(copia);
                }}
                aria-label={`Valor da ${i + 1}ª parcela`}
                className="w-28 rounded-lg border border-mata-200 px-2 py-1.5 text-sm outline-none focus:border-terra-500"
              />
              <input
                type="date"
                value={p.data}
                onChange={(e) => {
                  const copia = [...parcelas];
                  copia[i] = { ...p, data: e.target.value };
                  aoMudar(copia);
                }}
                aria-label={`Data da ${i + 1}ª parcela`}
                className="rounded-lg border border-mata-200 px-2 py-1.5 text-sm outline-none focus:border-terra-500"
              />
              <button
                type="button"
                onClick={() => aoMudar(parcelas.filter((_, j) => j !== i))}
                className="rounded-lg p-1 text-mata-400 transition hover:bg-red-50 hover:text-red-600"
                aria-label={`Remover a ${i + 1}ª parcela`}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================
//  Pedacinhos de formulário
// ============================================================

function Bloco({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-mata-500">
        {titulo}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Campo({
  label,
  valor,
  aoMudar,
  tipo = "text",
  placeholder,
  dica,
  largo,
}: {
  label: string;
  valor: string;
  aoMudar: (v: string) => void;
  tipo?: string;
  placeholder?: string;
  dica?: string;
  largo?: boolean;
}) {
  const id = `contrato-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div className={largo ? "sm:col-span-2" : undefined}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-mata-700">
        {label}
      </label>
      <input
        id={id}
        type={tipo}
        value={valor}
        placeholder={placeholder}
        onChange={(e) => aoMudar(e.target.value)}
        className="w-full rounded-lg border border-mata-200 bg-white px-3 py-2 text-sm outline-none focus:border-terra-500"
      />
      {dica && <p className="mt-1 text-xs text-mata-500">{dica}</p>}
    </div>
  );
}
