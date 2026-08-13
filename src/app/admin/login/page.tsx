import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { estaAutenticado } from "@/lib/auth";
import { FormularioLogin } from "./FormularioLogin";

export const metadata: Metadata = {
  title: "Entrar no painel",
  robots: { index: false, follow: false },
};

export default async function PaginaLogin() {
  if (await estaAutenticado()) redirect("/admin");

  return (
    <main className="flex min-h-screen items-center justify-center bg-mata-900 px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/logo-claro.png"
            alt="Sítio Estâncias Feliz"
            width={640}
            height={379}
            className="h-20 w-auto"
          />
          <p className="mt-3 text-xs uppercase tracking-[0.25em] text-mata-400">
            Painel administrativo
          </p>
        </div>

        <div className="mt-8 rounded-3xl bg-white p-7 shadow-2xl">
          <h1 className="font-display text-xl font-semibold text-mata-900">
            Entrar
          </h1>
          <p className="mt-1 mb-6 text-sm text-mata-600">
            Use o seu usuário e a sua senha.
          </p>
          <FormularioLogin />
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-mata-400">
          Acesso restrito. Em caso de dúvida, fale com o administrador.
        </p>

        <Link
          href="/"
          className="mx-auto mt-4 flex w-fit items-center gap-1.5 text-xs text-mata-400 transition hover:text-areia-200"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Voltar para o site
        </Link>
      </div>
    </main>
  );
}
