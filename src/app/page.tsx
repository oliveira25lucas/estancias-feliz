import Link from "next/link";
import Image from "next/image";
import {
  BedDouble,
  Bath,
  ChefHat,
  Home,
  MapPin,
  PartyPopper,
  Sparkles,
  Umbrella,
  Users,
  Waves,
  Wifi,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BotaoWhatsApp } from "@/components/BotaoWhatsApp";
import { Galeria } from "@/components/Galeria";
import {
  CAPACIDADE,
  ENDERECO_COMPLETO,
  ESTRUTURA,
  FAQ,
  HORARIOS,
  LOCALIZACAO,
  NAO_INCLUSO,
  OBSERVACOES_PISCINA,
  PAGAMENTO,
  linkWhatsApp,
} from "@/lib/site-config";
import { formatarBRL, tabelaDePrecos } from "@/lib/pricing";

/**
 * Os valores sobem 10% na virada do ano. Sem esta revalidação a página
 * ficaria congelada no preço do ano em que foi publicada.
 */
export const revalidate = 3600;

const ICONES = {
  home: Home,
  bath: Bath,
  waves: Waves,
  party: PartyPopper,
  chef: ChefHat,
} as const;

const DESTAQUES = [
  {
    icone: Users,
    valor: `${CAPACIDADE.dormirAtual}`,
    rotulo: "pessoas para dormir",
  },
  { icone: BedDouble, valor: `${CAPACIDADE.quartos}`, rotulo: "quartos, 1 suíte" },
  {
    icone: PartyPopper,
    valor: `${CAPACIDADE.eventoMax}`,
    rotulo: "pessoas em evento",
  },
  { icone: MapPin, valor: "30", rotulo: "km de Belo Horizonte" },
];

export default function PaginaInicial() {
  const ano = new Date().getFullYear();
  const tabela = tabelaDePrecos(ano);

  return (
    <>
      <Header />

      <main>
        {/* ---------------- HERO ---------------- */}
        <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-mata-800 via-mata-700 to-mata-950" />
          <Image
            src="/fotos/hero.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="-z-10 object-cover opacity-90"
          />
          {/* Escurece o suficiente para o texto branco ter contraste,
              sem apagar a piscina e as palmeiras da foto. */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-mata-950/85 via-mata-950/55 to-mata-950/65" />

          <div className="container-sitio pb-20 pt-28 text-center">
            {/* O cabeçalho já diz onde fica; aqui o espaço rende mais
                dizendo para que serve o sítio. */}
            <p className="surgir mb-4 text-xs font-semibold uppercase tracking-[0.35em] text-areia-300">
              Festas · Eventos · Temporada
            </p>
            <h1 className="surgir font-display text-4xl font-semibold leading-tight text-white sm:text-6xl lg:text-7xl">
              Sítio Estâncias Feliz
            </h1>
            <p className="surgir mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-areia-100 sm:text-xl">
              Piscina com cascata, salão de festas coberto, churrasqueira e
              espaço de sobra para a família toda. A 30 km de Belo Horizonte,
              com Wi-Fi.
            </p>

            <div className="surgir mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/orcamento"
                className="w-full rounded-full bg-terra-500 px-8 py-4 text-base font-semibold text-white shadow-xl transition hover:bg-terra-600 sm:w-auto"
              >
                Calcular meu orçamento
              </Link>
              {/* Antes este botão jogava para o WhatsApp. Não fazia sentido:
                  a própria calculadora consulta a agenda na hora. Aqui o
                  papel dele é deixar quem acabou de chegar ver o lugar. */}
              <Link
                href="/#fotos"
                className="w-full rounded-full border border-white/30 bg-white/10 px-8 py-4 text-base font-semibold text-white backdrop-blur transition hover:bg-white/20 sm:w-auto"
              >
                Ver as fotos
              </Link>
            </div>

            <dl className="surgir mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-6 border-t border-white/15 pt-10 sm:grid-cols-4">
              {DESTAQUES.map(({ icone: Icone, valor, rotulo }) => (
                <div key={rotulo} className="flex flex-col items-center gap-1">
                  <Icone className="size-6 text-areia-300" aria-hidden />
                  <dt className="font-display text-3xl font-semibold text-white">
                    {valor}
                  </dt>
                  <dd className="text-xs leading-snug text-areia-200">{rotulo}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ---------------- ESTRUTURA ---------------- */}
        <section id="estrutura" className="py-20 sm:py-28">
          <div className="container-sitio">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-semibold text-mata-900 sm:text-4xl">
                Tudo pronto para o seu dia
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-mata-700">
                O sítio recebe desde um fim de semana em família até festas com
                200 convidados. Veja o que está esperando por você.
              </p>
            </div>

            <div className="mt-14 grid gap-6 md:grid-cols-2">
              {ESTRUTURA.map((bloco) => {
                const Icone = ICONES[bloco.icone];
                return (
                  <div
                    key={bloco.titulo}
                    className="rounded-3xl border border-mata-100 bg-white p-7 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <span className="rounded-2xl bg-mata-50 p-3">
                        <Icone className="size-6 text-mata-600" aria-hidden />
                      </span>
                      <h3 className="font-display text-xl font-semibold text-mata-900">
                        {bloco.titulo}
                      </h3>
                    </div>
                    <ul className="mt-5 space-y-2.5">
                      {bloco.itens.map((item) => (
                        <li
                          key={item}
                          className="flex gap-2.5 text-[0.95rem] leading-relaxed text-mata-700"
                        >
                          <Sparkles
                            className="mt-1 size-4 shrink-0 text-terra-500"
                            aria-hidden
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* Diferenciais, não regras de contrato. Caução e adicional de
                hidromassagem aparecem mais abaixo, junto do pagamento. */}
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-2xl bg-mata-700 p-5 text-areia-50">
                <Wifi className="size-6 shrink-0" aria-hidden />
                <p className="text-sm font-medium leading-snug">
                  Wi-Fi Starlink: internet rápida mesmo no meio do verde
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-mata-700 p-5 text-areia-50">
                <Waves className="size-6 shrink-0" aria-hidden />
                <p className="text-sm font-medium leading-snug">
                  Piscina com cascata e área verde de sobra
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-mata-700 p-5 text-areia-50">
                <Umbrella className="size-6 shrink-0" aria-hidden />
                <p className="text-sm font-medium leading-snug">
                  Salão e churrasqueira cobertos — chuva não estraga o dia
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- FOTOS ---------------- */}
        <section id="fotos" className="bg-white py-20 sm:py-28">
          <div className="container-sitio">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-semibold text-mata-900 sm:text-4xl">
                Conheça cada canto
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-mata-700">
                Clique em qualquer foto para ver em tamanho grande.
              </p>
            </div>
            <div className="mt-12">
              <Galeria />
            </div>
          </div>
        </section>

        {/* ---------------- PREÇOS ---------------- */}
        <section id="precos" className="py-20 sm:py-28">
          <div className="container-sitio">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-semibold text-mata-900 sm:text-4xl">
                Preços sem surpresa
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-mata-700">
                Estes são os valores da estadia inteira, não por pessoa.
                Feriados têm pacotes próprios.
              </p>
            </div>

            <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {tabela.map((p) => (
                <div
                  key={p.titulo}
                  className={`flex flex-col rounded-3xl border p-7 ${
                    p.destaque
                      ? "border-terra-500 bg-mata-800 text-areia-50 shadow-xl"
                      : "border-mata-100 bg-white text-mata-900 shadow-sm"
                  }`}
                >
                  {p.destaque && (
                    <span className="mb-3 self-start rounded-full bg-terra-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                      Mais procurado
                    </span>
                  )}
                  <h3 className="font-display text-lg font-semibold">
                    {p.titulo}
                  </h3>
                  <p
                    className={`mt-1 text-sm ${
                      p.destaque ? "text-areia-200" : "text-mata-600"
                    }`}
                  >
                    {p.detalhe}
                  </p>
                  <div className="mt-6">
                    {p.prefixo && (
                      <span
                        className={`block text-xs uppercase tracking-wide ${
                          p.destaque ? "text-areia-300" : "text-mata-500"
                        }`}
                      >
                        {p.prefixo}
                      </span>
                    )}
                    <span className="font-display text-3xl font-semibold">
                      {formatarBRL(p.valor)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 rounded-3xl bg-mata-50 p-8 text-center">
              <p className="text-lg font-medium text-mata-800">
                Sua data cai em feriado? O valor muda.
              </p>
              <p className="mx-auto mt-2 max-w-xl text-mata-700">
                A calculadora já considera todos os pacotes de feriado, o
                tamanho do seu grupo e a hidromassagem. Leva menos de um minuto.
              </p>
              <Link
                href="/orcamento"
                className="mt-6 inline-flex rounded-full bg-terra-500 px-8 py-3.5 font-semibold text-white transition hover:bg-terra-600"
              >
                Ver o valor da minha data
              </Link>
            </div>

            <div className="mt-10 grid gap-6 rounded-3xl border border-mata-100 bg-white p-8 sm:grid-cols-2">
              <div>
                <h3 className="font-display text-lg font-semibold text-mata-900">
                  Como funciona o pagamento
                </h3>
                <ul className="mt-4 space-y-2 text-mata-700">
                  <li>· {PAGAMENTO.sinal}</li>
                  <li>· {PAGAMENTO.restante}</li>
                  <li>· {PAGAMENTO.caucaoObservacao}</li>
                </ul>
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-mata-900">
                  O que você precisa levar
                </h3>
                <p className="mt-4 text-mata-700">
                  A cozinha está completa, mas a roupa de cama e banho fica por
                  sua conta:
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {NAO_INCLUSO.map((item) => (
                    <li
                      key={item}
                      className="rounded-full bg-areia-100 px-3 py-1.5 text-sm text-mata-700"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- LOCALIZAÇÃO ---------------- */}
        <section
          id="localizacao"
          className="bg-mata-800 py-20 text-areia-50 sm:py-28"
        >
          <div className="container-sitio grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-semibold sm:text-4xl">
                Pertinho de BH, longe da correria
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-areia-200">
                Estamos na {LOCALIZACAO.endereco}, em {LOCALIZACAO.cidade}. O
                acesso é tranquilo e o caminho é asfaltado até a entrada.
              </p>

              <div className="mt-8 flex items-start gap-3 rounded-2xl bg-mata-900/60 p-5">
                <MapPin
                  className="mt-0.5 size-5 shrink-0 text-areia-300"
                  aria-hidden
                />
                <div>
                  <p className="font-medium">{ENDERECO_COMPLETO}</p>
                  <p className="text-sm text-areia-300">
                    {LOCALIZACAO.referencia}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={LOCALIZACAO.maps}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-areia-100 px-6 py-3 text-sm font-semibold text-mata-900 transition hover:bg-white"
                >
                  Abrir no Google Maps
                </a>
                <a
                  href={LOCALIZACAO.waze}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-areia-200/40 px-6 py-3 text-sm font-semibold text-areia-100 transition hover:bg-white/10"
                >
                  Abrir no Waze
                </a>
              </div>

              <div className="mt-8 rounded-2xl border border-mata-600 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-areia-300">
                  Horários fixos
                </h3>
                <p className="mt-3 leading-relaxed text-areia-100">
                  Check-in às {HORARIOS.checkin}, todos os dias. Check-out
                  sempre às {HORARIOS.checkout}.
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl shadow-2xl">
              <iframe
                title="Mapa com a localização do Sítio Estâncias Feliz"
                src={`https://www.google.com/maps?q=${LOCALIZACAO.latitude},${LOCALIZACAO.longitude}&z=15&output=embed`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-[26rem] w-full border-0"
              />
            </div>
          </div>
        </section>

        {/* ---------------- DÚVIDAS ---------------- */}
        <section id="duvidas" className="py-20 sm:py-28">
          <div className="container-sitio max-w-3xl">
            <div className="text-center">
              <h2 className="font-display text-3xl font-semibold text-mata-900 sm:text-4xl">
                Perguntas frequentes
              </h2>
              <p className="mt-4 text-lg text-mata-700">
                As dúvidas que mais chegam no nosso WhatsApp.
              </p>
            </div>

            <div className="mt-12 space-y-3">
              {FAQ.map((item) => (
                <details
                  key={item.pergunta}
                  className="group rounded-2xl border border-mata-100 bg-white px-6 py-5 shadow-sm transition open:shadow-md"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-mata-900 marker:content-none">
                    {item.pergunta}
                    <span className="shrink-0 text-2xl leading-none text-terra-500 transition group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-4 leading-relaxed text-mata-700">
                    {item.resposta}
                  </p>
                </details>
              ))}
            </div>

            <p className="mt-8 text-center text-sm text-mata-600">
              {OBSERVACOES_PISCINA} Ficou com outra dúvida?{" "}
              <a
                href={linkWhatsApp("Olá! Tenho uma dúvida sobre o sítio.")}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-terra-600 underline underline-offset-4"
              >
                Chame a gente no WhatsApp
              </a>
              .
            </p>
          </div>
        </section>

        {/* ---------------- CHAMADA FINAL ---------------- */}
        <section className="bg-areia-100 py-20 sm:py-24">
          <div className="container-sitio max-w-3xl text-center">
            <h2 className="font-display text-3xl font-semibold text-mata-900 sm:text-4xl">
              Vamos garantir a sua data?
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-mata-700">
              Os fins de semana costumam fechar cedo por aqui. Faça o orçamento
              e a gente confirma a disponibilidade na hora.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/orcamento"
                className="w-full rounded-full bg-terra-500 px-8 py-4 font-semibold text-white shadow-lg transition hover:bg-terra-600 sm:w-auto"
              >
                Fazer orçamento agora
              </Link>
              <a
                href={linkWhatsApp(
                  "Olá! Quero verificar a disponibilidade de uma data no sítio.",
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full rounded-full bg-zap px-8 py-4 font-semibold text-white shadow-lg transition hover:bg-zap-escuro sm:w-auto"
              >
                Falar no WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <BotaoWhatsApp />
    </>
  );
}
