import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarDays, MessageCircle } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CalendarioDisponibilidade } from "@/components/CalendarioDisponibilidade";
import { agendaOcupada, fimDaJanela, hojeISO } from "@/lib/agenda";
import { supabaseConfigurado } from "@/lib/supabase";
import { finsDeSemanaLivres } from "@/lib/ocupacao";
import { formatarDataBR, nomeDiaSemana } from "@/lib/pricing";
import { linkWhatsApp } from "@/lib/site-config";

/**
 * Agenda pública — o que está livre e o que está ocupado, e nada mais.
 *
 * Serve para mandar o link a quem pergunta "que datas você tem?" sem
 * precisar digitar a lista à mão. Mostra SÓ datas: nem nome, nem valor,
 * nem se aquele dia é reserva de alguém ou manutenção da piscina.
 *
 * Fora do menu, fora do sitemap e com `noindex`: é uma página de link
 * direto, não uma porta de entrada do site. Para abrir ao Google um dia,
 * basta trocar o `robots` abaixo e acrescentar a rota em `sitemap.ts`.
 */

export const metadata: Metadata = {
  title: "Agenda do sítio",
  description:
    "Datas livres e ocupadas do Sítio Estâncias Feliz, atualizadas direto da agenda.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PaginaAgenda() {
  const de = hojeISO();
  const ate = fimDaJanela(de);

  let ocupados: string[] | null = null;

  if (supabaseConfigurado()) {
    try {
      ocupados = (await agendaOcupada(de, ate)).dias;
    } catch (e) {
      // Agenda fora do ar não pode virar tela de erro: a página cai para
      // o convite de falar no WhatsApp, que resolve do mesmo jeito.
      console.error("[agenda pública]", e);
    }
  }

  const livres = ocupados
    ? finsDeSemanaLivres(new Set(ocupados), de, 4)
    : [];

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
              Agenda do sítio
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-mata-700">
              O que está em cinza já está ocupado. O resto está livre — e a
              data de saída também ocupa, porque depois do check-out das 16h
              ainda tem limpeza e arrumação.
            </p>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
            <div>
              {ocupados ? (
                <CalendarioDisponibilidade ocupados={ocupados} de={de} ate={ate} />
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm leading-relaxed text-amber-900">
                  Não conseguimos carregar a agenda agora. Chame no WhatsApp
                  que a gente confere a sua data na hora.
                </div>
              )}
            </div>

            <aside className="space-y-5 lg:sticky lg:top-24">
              {livres.length > 0 && (
                <div className="rounded-3xl border border-mata-100 bg-white p-6 shadow-sm">
                  <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-mata-900">
                    <CalendarDays className="size-5 text-terra-500" aria-hidden />
                    Próximos fins de semana livres
                  </h2>
                  <ul className="mt-4 space-y-3 border-t border-mata-100 pt-4">
                    {livres.map((f) => (
                      <li key={f.checkin} className="text-sm">
                        <p className="font-medium text-mata-900">
                          {formatarDataBR(f.checkin)} a{" "}
                          {formatarDataBR(f.checkout)}
                        </p>
                        <p className="text-xs text-mata-500">
                          {nomeDiaSemana(f.checkin)} a{" "}
                          {nomeDiaSemana(f.checkout)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-3xl border border-mata-100 bg-mata-800 p-6 text-areia-50 shadow-lg">
                <h2 className="font-display text-lg font-semibold">
                  Achou sua data?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-areia-200">
                  A calculadora mostra o valor exato do seu período, já com
                  pacote de feriado considerado.
                </p>
                <Link
                  href="/orcamento"
                  className="mt-5 flex items-center justify-center rounded-full bg-terra-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-terra-600"
                >
                  Fazer meu orçamento
                </Link>
                <a
                  href={linkWhatsApp(
                    "Olá! Vi a agenda no site do Sítio Estâncias Feliz e queria falar sobre uma data.",
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center justify-center gap-2 rounded-full bg-zap px-6 py-3 text-sm font-semibold text-white transition hover:bg-zap-escuro"
                >
                  <MessageCircle className="size-4" aria-hidden />
                  Falar no WhatsApp
                </a>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
