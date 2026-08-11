"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, X } from "lucide-react";
import { CATEGORIAS, FOTOS, type Categoria } from "@/lib/fotos";

/** Espaço reservado usado quando o arquivo da foto ainda não foi enviado. */
function Reservado({ alt }: { alt: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-mata-100 p-4 text-center">
      <ImageIcon className="size-8 text-mata-400" aria-hidden />
      <span className="text-xs leading-snug text-mata-600">{alt}</span>
    </div>
  );
}

export function Galeria() {
  const [categoria, setCategoria] = useState<Categoria>("Todas");
  const [aberta, setAberta] = useState<number | null>(null);
  const [comErro, setComErro] = useState<Set<string>>(new Set());

  const fotos =
    categoria === "Todas"
      ? FOTOS
      : FOTOS.filter((f) => f.categoria === categoria);

  const marcarErro = useCallback((src: string) => {
    setComErro((anterior) => new Set(anterior).add(src));
  }, []);

  const anterior = useCallback(() => {
    setAberta((i) => (i === null ? null : (i - 1 + fotos.length) % fotos.length));
  }, [fotos.length]);

  const proxima = useCallback(() => {
    setAberta((i) => (i === null ? null : (i + 1) % fotos.length));
  }, [fotos.length]);

  useEffect(() => {
    if (aberta === null) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberta(null);
      if (e.key === "ArrowLeft") anterior();
      if (e.key === "ArrowRight") proxima();
    };
    window.addEventListener("keydown", aoTeclar);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = "";
    };
  }, [aberta, anterior, proxima]);

  const fotoAberta = aberta !== null ? fotos[aberta] : null;

  return (
    <>
      <div className="mb-8 flex flex-wrap justify-center gap-2">
        {CATEGORIAS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setCategoria(c);
              setAberta(null);
            }}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              categoria === c
                ? "bg-mata-700 text-areia-50"
                : "bg-mata-100 text-mata-700 hover:bg-mata-200"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid auto-rows-[13rem] grid-cols-2 gap-3 sm:auto-rows-[15rem] md:grid-cols-3 lg:grid-cols-4">
        {fotos.map((foto, i) => (
          <button
            key={foto.src}
            type="button"
            onClick={() => setAberta(i)}
            className={`group relative overflow-hidden rounded-2xl bg-mata-100 shadow-sm transition hover:shadow-lg ${
              foto.destaque ? "sm:col-span-2 sm:row-span-2" : ""
            }`}
          >
            {comErro.has(foto.src) ? (
              <Reservado alt={foto.alt} />
            ) : (
              <Image
                src={foto.src}
                alt={foto.alt}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover transition duration-500 group-hover:scale-105"
                onError={() => marcarErro(foto.src)}
              />
            )}
            <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-mata-950/80 to-transparent p-3 text-left text-xs font-medium text-areia-50 opacity-0 transition group-hover:opacity-100">
              {foto.categoria}
            </span>
          </button>
        ))}
      </div>

      {fotoAberta && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-mata-950/95 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={fotoAberta.alt}
          onClick={() => setAberta(null)}
        >
          <button
            type="button"
            onClick={() => setAberta(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
            aria-label="Fechar"
          >
            <X className="size-6" />
          </button>

          {fotos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  anterior();
                }}
                className="absolute left-3 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 sm:left-6"
                aria-label="Foto anterior"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  proxima();
                }}
                className="absolute right-3 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 sm:right-6"
                aria-label="Próxima foto"
              >
                <ChevronRight className="size-6" />
              </button>
            </>
          )}

          <figure
            className="max-h-full w-full max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
              {comErro.has(fotoAberta.src) ? (
                <Reservado alt={fotoAberta.alt} />
              ) : (
                <Image
                  src={fotoAberta.src}
                  alt={fotoAberta.alt}
                  fill
                  sizes="100vw"
                  className="object-contain"
                  onError={() => marcarErro(fotoAberta.src)}
                />
              )}
            </div>
            <figcaption className="mt-3 text-center text-sm text-areia-200">
              {fotoAberta.alt}
              <span className="ml-2 text-mata-400">
                ({(aberta ?? 0) + 1} de {fotos.length})
              </span>
            </figcaption>
          </figure>
        </div>
      )}
    </>
  );
}
