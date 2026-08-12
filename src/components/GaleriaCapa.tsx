"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FOTOS, fotosDaCapa } from "@/lib/fotos";
import { Reservado, Visualizador, useVisualizador } from "./Visualizador";

/**
 * A amostra da página inicial: poucas fotos, as mais bonitas, e um caminho
 * para /fotos. A galeria completa (57 fotos em 22 espaços) pesava demais na
 * home — quem só queria uma ideia do lugar tinha de rolar por todos os
 * banheiros até chegar nos preços.
 *
 * Quem escolhe as fotos daqui é a marca `capa` em `src/lib/fotos.ts`.
 */
export function GaleriaCapa() {
  const fotos = fotosDaCapa();
  const estado = useVisualizador(fotos);

  return (
    <>
      {/* A primeira ocupa 2x2 e ancora a grade; as outras oito completam as
          três fileiras de quatro. */}
      <div className="grid auto-rows-[11rem] grid-cols-2 gap-3 sm:auto-rows-[13rem] md:grid-cols-3 lg:grid-cols-4">
        {fotos.map((foto, i) => (
          <button
            key={foto.src}
            type="button"
            onClick={() => estado.abrir(i)}
            className={`group relative overflow-hidden rounded-2xl bg-mata-100 shadow-sm transition hover:shadow-lg ${
              i === 0 ? "sm:col-span-2 sm:row-span-2" : ""
            }`}
          >
            {estado.comErro.has(foto.src) ? (
              <Reservado alt={foto.alt} />
            ) : (
              <Image
                src={foto.src}
                alt={foto.alt}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover transition duration-500 group-hover:scale-105"
                onError={() => estado.marcarErro(foto.src)}
              />
            )}
            <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-mata-950/80 to-transparent p-3 text-left text-xs font-medium text-areia-50 opacity-0 transition group-hover:opacity-100">
              {foto.espaco}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Link
          href="/fotos"
          className="inline-flex items-center gap-2 rounded-full bg-mata-700 px-8 py-4 text-base font-semibold text-areia-50 shadow-lg transition hover:bg-mata-800"
        >
          Ver todas as {FOTOS.length} fotos
          <ArrowRight className="size-5" aria-hidden />
        </Link>
        <p className="mt-3 text-sm text-mata-600">
          Espaço por espaço, da piscina ao último quarto.
        </p>
      </div>

      <Visualizador fotos={fotos} estado={estado} />
    </>
  );
}
