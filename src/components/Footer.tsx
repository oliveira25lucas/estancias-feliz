import Link from "next/link";
import Image from "next/image";
import { Mail, MapPin, MessageCircle } from "lucide-react";
import { CONTATO, LOCALIZACAO, HORARIOS, linkWhatsApp } from "@/lib/site-config";

/** O lucide não distribui ícones de marca, então o do Instagram vem aqui. */
function IconeInstagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069M12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0m0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8m6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881"
      />
    </svg>
  );
}

export function Footer() {
  const ano = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-mata-950 text-areia-100">
      <div className="container-sitio grid gap-10 py-16 md:grid-cols-3">
        <div>
          <Image
            src="/logo-claro.png"
            alt="Sítio Estâncias Feliz"
            width={640}
            height={379}
            className="h-20 w-auto"
          />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-mata-200">
            Um espaço para a sua família e seus amigos aproveitarem sem pressa,
            a apenas 30 km de Belo Horizonte.
          </p>
          <div className="mt-5 flex gap-3">
            <a
              href={CONTATO.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-mata-800 p-2.5 transition hover:bg-mata-700"
              aria-label="Instagram do Sítio Estâncias Feliz"
            >
              <IconeInstagram className="size-5" />
            </a>
            <a
              href={linkWhatsApp("Olá! Gostaria de informações sobre o sítio.")}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-mata-800 p-2.5 transition hover:bg-mata-700"
              aria-label="WhatsApp do Sítio Estâncias Feliz"
            >
              <MessageCircle className="size-5" />
            </a>
            <a
              href={`mailto:${CONTATO.email}`}
              className="rounded-full bg-mata-800 p-2.5 transition hover:bg-mata-700"
              aria-label="E-mail do Sítio Estâncias Feliz"
            >
              <Mail className="size-5" />
            </a>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-mata-300">
            Contato
          </h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <a
                href={linkWhatsApp()}
                target="_blank"
                rel="noopener noreferrer"
                className="transition hover:text-white"
              >
                {CONTATO.telefoneFormatado}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${CONTATO.email}`}
                className="break-all transition hover:text-white"
              >
                {CONTATO.email}
              </a>
            </li>
            <li className="flex gap-2 pt-1 text-mata-200">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {LOCALIZACAO.endereco}
                <br />
                {LOCALIZACAO.cidade} — {LOCALIZACAO.estado}
              </span>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-mata-300">
            Horários
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-mata-200">
            <li>
              Check-in, todos os dias:{" "}
              <strong className="text-areia-100">{HORARIOS.checkin}</strong>
            </li>
            <li>
              Check-out:{" "}
              <strong className="text-areia-100">{HORARIOS.checkout}</strong>
            </li>
          </ul>
          <Link
            href="/orcamento"
            className="mt-6 inline-flex rounded-full bg-terra-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-terra-600"
          >
            Fazer meu orçamento
          </Link>
        </div>
      </div>

      <div className="border-t border-mata-800">
        <div className="container-sitio flex flex-col gap-2 py-6 text-xs text-mata-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {ano} Sítio Estâncias Feliz. Todos os direitos reservados.</p>
          <Link href="/admin" className="transition hover:text-mata-200">
            Área administrativa
          </Link>
        </div>
      </div>
    </footer>
  );
}
