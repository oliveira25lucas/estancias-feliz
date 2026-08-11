import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
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
          <FormularioLogin />
        </div>

        <p className="mt-6 text-center text-xs text-mata-400">
          Acesso restrito. Em caso de dúvida, fale com o administrador.
        </p>
      </div>
    </main>
  );
}
