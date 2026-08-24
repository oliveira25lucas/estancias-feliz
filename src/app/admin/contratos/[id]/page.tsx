import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { sessaoAtual } from "@/lib/auth";
import { supabaseConfigurado } from "@/lib/supabase";
import { lerContrato } from "@/lib/contratos";
import {
  ABERTURA_CLAUSULAS,
  IMOVEL,
  LOCADOR,
  PREAMBULO,
  buracos,
  dataPorExtenso,
  montarClausulas,
  textoDoContrato,
} from "@/lib/contrato";
import { BarraContrato } from "./BarraContrato";

export const metadata: Metadata = {
  title: "Contrato",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * A via impressa do contrato.
 *
 * O PDF sai do "Salvar como PDF" do navegador (o botão chama
 * `window.print()`), e não de uma biblioteca. A troca é deliberada: o
 * projeto não ganha dependência nenhuma, o texto continua selecionável e
 * pesquisável no PDF, e a tipografia é CSS — a mesma linguagem do resto
 * do site — em vez de coordenadas desenhadas à mão. As regras de folha
 * ficam em `globals.css`, sob `@media print`.
 *
 * A tela mostra a mesma folha que vai sair no papel, com uma barra de
 * ações por cima que a impressão esconde (`.nao-imprimir`).
 */
export default async function PaginaContrato({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/admin/login");
  if (!supabaseConfigurado()) redirect("/admin");

  const { id } = await params;
  const contrato = await lerContrato(id);
  if (!contrato) notFound();

  const clausulas = montarClausulas(contrato.clausulas, contrato);
  const faltando = buracos(contrato.clausulas, contrato);
  const semAssinatura = !contrato.dataAssinatura;
  const textoCorrido = textoDoContrato(contrato.clausulas, contrato);

  return (
    <div className="min-h-screen bg-mata-950/5 py-6 print:bg-white print:py-0">
      <div className="nao-imprimir mx-auto mb-6 max-w-[210mm] px-4">
        <Link
          href="/admin"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-mata-700 hover:text-mata-900"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Voltar ao painel
        </Link>

        <BarraContrato
          id={contrato.id}
          status={contrato.status}
          nome={contrato.locatarioNome}
          texto={textoCorrido}
        />

        {(faltando.length > 0 || semAssinatura) && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">
                Falta preencher antes de mandar para o cliente
              </p>
              <ul className="mt-1.5 space-y-1">
                {faltando.map((f) => (
                  <li key={f}>
                    · <code className="rounded bg-amber-100 px-1.5">{f}</code> —
                    aparece marcado no meio do texto
                  </li>
                ))}
                {semAssinatura && <li>· a data de assinatura</li>}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/*
        A folha imita A4 na tela (210mm de largura, a mesma margem do
        @page) para que o que se vê seja o que sai. Na impressão as
        medidas somem e quem manda é o @page.
      */}
      <article className="folha-contrato mx-auto max-w-[210mm] bg-white px-[16mm] py-[18mm] text-[10.5pt] leading-relaxed text-black shadow-sm print:shadow-none">
        <header className="text-center">
          <h1 className="font-display text-[15pt] font-semibold">
            Contrato de Locação do {IMOVEL.nome}
          </h1>
          <p className="mx-auto mt-3 max-w-[85%] text-[9.5pt] leading-snug">
            {PREAMBULO}
          </p>
        </header>

        <section className="mt-7 space-y-3 text-[10pt]">
          <p>
            <strong>IMÓVEL:</strong> {IMOVEL.nome}, localizado na{" "}
            {IMOVEL.endereco}, coordenadas geográficas Latitude{" "}
            {IMOVEL.latitude}, Longitude {IMOVEL.longitude}, município de{" "}
            {IMOVEL.municipio}.
          </p>

          <div>
            <p className="font-semibold">LOCADOR:</p>
            <p>Nome Empresarial: {LOCADOR.nomeEmpresarial}</p>
            <p>CNPJ: {LOCADOR.cnpj}</p>
            <p>Endereço: {LOCADOR.endereco}</p>
            <p>Telefone: {LOCADOR.telefone}</p>
            <p>
              Administrador: {LOCADOR.administrador} (CPF: {LOCADOR.cpf})
            </p>
          </div>

          <div>
            <p className="font-semibold">DADOS DO LOCATÁRIO:</p>
            <p>Nome: {contrato.locatarioNome || <Vazio />}</p>
            <p>CPF: {contrato.locatarioCpf || <Vazio />}</p>
            <p>Endereço: {contrato.locatarioEndereco || <Vazio />}</p>
            <p>Telefone: {contrato.locatarioTelefone || <Vazio />}</p>
          </div>

          <p>{ABERTURA_CLAUSULAS}</p>
        </section>

        <section className="mt-7 space-y-5">
          {clausulas.map((c) => (
            <div key={c.numero} className="clausula">
              <p className="text-center text-[10.5pt] font-semibold">
                Cláusula {c.numero}º
              </p>
              {c.texto.split("\n").map((paragrafo, i) => (
                <p key={i} className="mt-1 text-justify">
                  {paragrafo}
                </p>
              ))}
            </div>
          ))}
        </section>

        <section className="assinaturas mt-10">
          <p>
            {IMOVEL.municipio},{" "}
            {contrato.dataAssinatura ? (
              dataPorExtenso(contrato.dataAssinatura)
            ) : (
              <Vazio />
            )}
          </p>

          <div className="mt-12 space-y-12">
            <div>
              <p>
                Administrador Locador:{" "}
                <span className="inline-block w-[60%] border-b border-black" />
              </p>
              <p className="mt-1 pl-[9.5rem] text-[9.5pt]">
                {LOCADOR.administrador}
              </p>
            </div>
            <div>
              <p>
                Locatário:{" "}
                <span className="inline-block w-[65%] border-b border-black" />
              </p>
              <p className="mt-1 pl-[5.5rem] text-[9.5pt]">
                {contrato.locatarioNome}
              </p>
            </div>
          </div>
        </section>
      </article>
    </div>
  );
}

/**
 * Um campo vazio no meio de um contrato passa despercebido; um traço
 * marcado, não. É a mesma escolha do `{{variavel}}` que fica visível
 * quando não tem valor.
 */
function Vazio() {
  return (
    <span className="rounded bg-amber-100 px-2 text-amber-900 print:bg-transparent print:text-black">
      ____________________
    </span>
  );
}
