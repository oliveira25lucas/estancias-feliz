"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X, MessageCircle } from "lucide-react";
import { linkWhatsApp } from "@/lib/site-config";

const LINKS = [
  { href: "/#estrutura", label: "Estrutura" },
  { href: "/#fotos", label: "Fotos" },
  { href: "/#precos", label: "Preços" },
  { href: "/#localizacao", label: "Como chegar" },
  { href: "/#duvidas", label: "Dúvidas" },
] as const;

export function Header() {
  const [aberto, setAberto] = useState(false);
  const [rolou, setRolou] = useState(false);
  const caminho = usePathname();

  /**
   * Só a home tem o hero escuro atrás do cabeçalho. Nas outras páginas o
   * fundo é claro, e um cabeçalho transparente deixaria o logo branco
   * invisível — por isso ali ele já nasce sólido.
   */
  const precisaDeFundo = caminho !== "/" || rolou || aberto;

  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 24);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  // Trava a rolagem do fundo enquanto o menu mobile está aberto.
  useEffect(() => {
    document.body.style.overflow = aberto ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [aberto]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        precisaDeFundo
          ? "bg-mata-900/95 shadow-lg shadow-mata-950/20 backdrop-blur"
          : "bg-gradient-to-b from-mata-950/70 to-transparent"
      }`}
    >
      <div className="container-sitio flex h-20 items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-3"
          onClick={() => setAberto(false)}
        >
          <Image
            src="/logo-claro.png"
            alt="Sítio Estâncias Feliz"
            width={640}
            height={379}
            priority
            className="h-12 w-auto sm:h-14"
          />
          <span className="hidden text-[0.65rem] uppercase leading-tight tracking-[0.25em] text-mata-300 sm:block">
            Sarzedo
            <br />
            Minas Gerais
          </span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-areia-100/90 transition hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/orcamento"
            className="hidden rounded-full bg-terra-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-terra-600 sm:inline-flex"
          >
            Fazer orçamento
          </Link>
          <a
            href={linkWhatsApp(
              "Olá! Vi o site do Sítio Estâncias Feliz e gostaria de mais informações.",
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-zap px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-zap-escuro"
          >
            <MessageCircle className="size-4" aria-hidden />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="rounded-lg p-2 text-areia-100 lg:hidden"
            aria-label={aberto ? "Fechar menu" : "Abrir menu"}
            aria-expanded={aberto}
          >
            {aberto ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      {aberto && (
        <div className="border-t border-mata-700 bg-mata-900 lg:hidden">
          <nav className="container-sitio flex flex-col py-3">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setAberto(false)}
                className="border-b border-mata-800 py-3.5 text-base font-medium text-areia-100 last:border-0"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/orcamento"
              onClick={() => setAberto(false)}
              className="mt-4 rounded-full bg-terra-500 px-5 py-3 text-center text-base font-semibold text-white"
            >
              Fazer orçamento
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
