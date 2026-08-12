import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BotaoWhatsApp } from "@/components/BotaoWhatsApp";
import { Galeria } from "@/components/Galeria";
import { ESPACOS, FOTOS } from "@/lib/fotos";
import { linkWhatsApp } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Fotos do sítio, espaço por espaço",
  description:
    `As ${FOTOS.length} fotos do Sítio Estâncias Feliz separadas por espaço: ` +
    "piscina, churrasqueira, salão de festas, quartos, banheiros e área " +
    "externa. Veja cada canto antes de reservar.",
  alternates: { canonical: "/fotos" },
};

export default function PaginaFotos() {
  return (
    <>
      <Header />

      <main className="bg-white pb-24 pt-32">
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
              Conheça cada canto
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-mata-700">
              São {FOTOS.length} fotos em {ESPACOS.length} espaços, na ordem de
              uma visita: começa na piscina e termina nos quartos. Use os
              filtros para ir direto ao que interessa, ou clique em qualquer
              foto para ver em tamanho grande.
            </p>
          </div>

          <div className="mt-12">
            <Galeria />
          </div>

          <div className="mt-20 rounded-3xl bg-areia-100 p-8 text-center sm:p-12">
            <h2 className="font-display text-2xl font-semibold text-mata-900 sm:text-3xl">
              Gostou do que viu?
            </h2>
            <p className="mx-auto mt-3 max-w-xl leading-relaxed text-mata-700">
              A calculadora mostra o valor da sua data na hora, com pacote de
              feriado já considerado — e a agenda diz o que ainda está livre.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/orcamento"
                className="w-full rounded-full bg-terra-500 px-8 py-4 font-semibold text-white shadow-lg transition hover:bg-terra-600 sm:w-auto"
              >
                Calcular meu orçamento
              </Link>
              <a
                href={linkWhatsApp(
                  "Olá! Vi as fotos do sítio e gostaria de mais informações.",
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full rounded-full bg-zap px-8 py-4 font-semibold text-white shadow-lg transition hover:bg-zap-escuro sm:w-auto"
              >
                Falar no WhatsApp
              </a>
            </div>
          </div>
        </div>
      </main>

      <Footer />
      <BotaoWhatsApp />
    </>
  );
}
