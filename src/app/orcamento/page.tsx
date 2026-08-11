import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CalculadoraOrcamento } from "@/components/CalculadoraOrcamento";

export const metadata: Metadata = {
  title: "Faça seu orçamento",
  description:
    "Calcule na hora o valor da sua data no Sítio Estâncias Feliz. Informe as datas e o número de pessoas e receba o valor com pacotes de feriado já considerados.",
  alternates: { canonical: "/orcamento" },
};

export default function PaginaOrcamento() {
  return (
    <>
      <Header />

      <main className="bg-areia-50 pb-24 pt-32">
        <div className="container-sitio">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-mata-600 transition hover:text-mata-800"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Voltar para o site
          </Link>

          <div className="mt-6 max-w-2xl">
            <h1 className="font-display text-4xl font-semibold text-mata-900 sm:text-5xl">
              Faça seu orçamento
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-mata-700">
              O valor aparece na hora, conforme você preenche. Ao final,
              enviamos tudo pronto para o nosso WhatsApp — é lá que a gente
              confirma se a sua data está livre.
            </p>
          </div>

          <div className="mt-12">
            <CalculadoraOrcamento />
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
