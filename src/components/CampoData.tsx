"use client";

import { useId, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { nomeDiaSemana } from "@/lib/pricing";

/**
 * Campo de data que SEMPRE mostra dd/mm/aaaa.
 *
 * O `<input type="date">` nativo exibe no formato do NAVEGADOR, não da
 * página: num navegador em inglês vira mm/dd/aaaa, e não existe atributo
 * nem CSS que mude isso. Numa reserva, 03/05 significar 3 de maio ou 5 de
 * março é o tipo de ambiguidade que vira briga no check-in.
 *
 * Aqui o que a pessoa vê e digita é um campo de texto no formato
 * brasileiro. O `<input type="date">` continua existindo, escondido, só
 * para abrir o calendário nativo — que no celular é bem melhor do que
 * qualquer calendário que eu desenhasse.
 *
 * O valor trafega sempre em ISO (aaaa-mm-dd), que é o que o motor de
 * preços espera.
 */

function isoParaBR(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Aplica a máscara conforme a pessoa digita: 12082026 -> 12/08/2026 */
function mascarar(texto: string): string {
  const d = texto.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/**
 * Converte dd/mm/aaaa em ISO, ou devolve "" se a data não existir.
 * Rejeita 31/02 e afins: `new Date(2026, 1, 31)` viraria 3 de março
 * silenciosamente, e o cliente receberia orçamento de outra data.
 */
function brParaISO(texto: string): string {
  const m = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";

  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || ano < 1900) return "";

  const d = new Date(ano, mes - 1, dia);
  if (
    d.getFullYear() !== ano ||
    d.getMonth() !== mes - 1 ||
    d.getDate() !== dia
  ) {
    return "";
  }

  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function CampoData({
  label,
  valor,
  aoMudar,
  min,
  obrigatorio,
  name,
  compacto,
}: {
  label: string;
  /** Data em ISO (aaaa-mm-dd) ou "". */
  valor: string;
  aoMudar: (iso: string) => void;
  /** Data mínima aceita, em ISO. */
  min?: string;
  obrigatorio?: boolean;
  /**
   * Quando presente, envia a data em ISO num campo oculto com este nome.
   * É como os formulários do painel, que usam Server Actions e leem
   * FormData, recebem o valor já no formato que o banco espera.
   */
  name?: string;
  /** Versão menor, para as telas do painel. */
  compacto?: boolean;
}) {
  const id = useId();
  const nativo = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState(() => isoParaBR(valor));
  const [valorAnterior, setValorAnterior] = useState(valor);

  /*
    Mantém o texto em dia quando o valor muda por FORA — por exemplo
    quando o cliente clica em "usar as datas do pacote" de feriado.

    Ajuste durante a renderização, e não dentro de um efeito: é o padrão
    que o React recomenda para estado derivado de prop, e evita o render
    extra que um setState em efeito provocaria.
  */
  if (valor !== valorAnterior) {
    setValorAnterior(valor);
    if (brParaISO(texto) !== valor) setTexto(isoParaBR(valor));
  }

  function aoDigitar(bruto: string) {
    const mascarado = mascarar(bruto);
    setTexto(mascarado);

    const iso = brParaISO(mascarado);
    // Só avisa o pai quando a data está completa e existe de verdade.
    if (iso) aoMudar(iso);
    else if (mascarado === "") aoMudar("");
  }

  function abrirCalendario() {
    const el = nativo.current;
    if (!el) return;
    // showPicker() não existe em navegadores antigos; ali o clique no
    // próprio campo nativo ainda funciona como alternativa.
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        // Alguns navegadores exigem interação direta; cai no foco abaixo.
      }
    }
    el.focus();
    el.click();
  }

  const iso = brParaISO(texto);
  const incompleta = texto.length > 0 && texto.length < 10;
  const invalida = texto.length === 10 && !iso;
  const antesDoMinimo = Boolean(iso && min && iso < min);

  return (
    <div>
      <label
        htmlFor={id}
        className={`mb-1 block font-medium text-mata-800 ${compacto ? "text-xs" : "mb-1.5 text-sm"}`}
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          value={texto}
          onChange={(e) => aoDigitar(e.target.value)}
          required={obrigatorio}
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd/mm/aaaa"
          aria-describedby={`${id}-apoio`}
          aria-invalid={invalida || antesDoMinimo || undefined}
          className={`w-full rounded-xl border bg-white text-mata-900 outline-none transition placeholder:text-mata-400 focus:ring-2 focus:ring-terra-500/25 ${
            compacto ? "px-3 py-2 pr-10 text-sm" : "px-4 py-3 pr-12"
          } ${
            invalida || antesDoMinimo
              ? "border-red-400 focus:border-red-500"
              : "border-mata-200 focus:border-terra-500"
          }`}
        />

        <button
          type="button"
          onClick={abrirCalendario}
          className={`absolute inset-y-0 right-0 flex items-center justify-center rounded-r-xl text-mata-500 transition hover:text-terra-600 ${
            compacto ? "w-9" : "w-11"
          }`}
          aria-label={`Escolher ${label.toLowerCase()} no calendário`}
        >
          <CalendarDays className={compacto ? "size-4" : "size-5"} aria-hidden />
        </button>

        {/*
          O campo nativo fica atrás do botão, invisível mas presente: é o
          que abre o calendário do sistema. Não usamos `hidden` nem
          `display:none` porque aí o showPicker() não funciona.
        */}
        <input
          ref={nativo}
          type="date"
          tabIndex={-1}
          aria-hidden
          min={min}
          value={iso}
          onChange={(e) => {
            setTexto(isoParaBR(e.target.value));
            aoMudar(e.target.value);
          }}
          className="pointer-events-none absolute bottom-0 right-3 size-px opacity-0"
        />

        {name && <input type="hidden" name={name} value={iso} />}
      </div>

      <p id={`${id}-apoio`} className="mt-1.5 text-xs">
        {invalida ? (
          <span className="text-red-600">Essa data não existe.</span>
        ) : antesDoMinimo ? (
          <span className="text-red-600">
            Precisa ser a partir de {isoParaBR(min!)}.
          </span>
        ) : iso ? (
          <span className="text-mata-600">
            {nomeDiaSemana(iso)}, {isoParaBR(iso)}
          </span>
        ) : incompleta ? (
          <span className="text-mata-500">Continue: dd/mm/aaaa</span>
        ) : (
          <span className="text-mata-500">Dia, mês e ano — ex: 14/08/2026</span>
        )}
      </p>
    </div>
  );
}
