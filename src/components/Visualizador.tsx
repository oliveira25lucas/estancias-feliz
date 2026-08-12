"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, X } from "lucide-react";
import type { Foto } from "@/lib/fotos";

/**
 * O visualizador em tela cheia, usado pela amostra da home e pela galeria
 * completa de /fotos. Fica separado porque as duas telas mostram conjuntos
 * diferentes de fotos, mas abrem exatamente o mesmo visualizador — e antes
 * isso vivia dentro da galeria, sem como reaproveitar.
 */

/** Espaço reservado usado quando o arquivo da foto ainda não foi enviado. */
export function Reservado({ alt }: { alt: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-mata-100 p-4 text-center">
      <ImageIcon className="size-8 text-mata-400" aria-hidden />
      <span className="text-xs leading-snug text-mata-600">{alt}</span>
    </div>
  );
}

export type EstadoVisualizador = {
  aberta: number | null;
  abrir: (indice: number) => void;
  fechar: () => void;
  anterior: () => void;
  proxima: () => void;
  comErro: Set<string>;
  marcarErro: (src: string) => void;
};

/**
 * As setas andam pela lista inteira que está na tela e dão a volta no fim.
 * `fotos` precisa ser a mesma lista usada para calcular os índices da grade.
 */
export function useVisualizador(fotos: Foto[]): EstadoVisualizador {
  const [aberta, setAberta] = useState<number | null>(null);
  const [comErro, setComErro] = useState<Set<string>>(new Set());
  const total = fotos.length;

  const marcarErro = useCallback((src: string) => {
    setComErro((anterior) => new Set(anterior).add(src));
  }, []);

  const fechar = useCallback(() => setAberta(null), []);

  const anterior = useCallback(() => {
    setAberta((i) => (i === null ? null : (i - 1 + total) % total));
  }, [total]);

  const proxima = useCallback(() => {
    setAberta((i) => (i === null ? null : (i + 1) % total));
  }, [total]);

  useEffect(() => {
    if (aberta === null) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
      if (e.key === "ArrowLeft") anterior();
      if (e.key === "ArrowRight") proxima();
    };
    window.addEventListener("keydown", aoTeclar);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = "";
    };
  }, [aberta, anterior, proxima, fechar]);

  return {
    aberta,
    abrir: setAberta,
    fechar,
    anterior,
    proxima,
    comErro,
    marcarErro,
  };
}

export function Visualizador({
  fotos,
  estado,
}: {
  fotos: Foto[];
  estado: EstadoVisualizador;
}) {
  const { aberta, fechar, anterior, proxima, comErro, marcarErro } = estado;
  const foto = aberta !== null ? fotos[aberta] : null;
  if (!foto) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-mata-950/95 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={foto.alt}
      onClick={fechar}
    >
      <button
        type="button"
        onClick={fechar}
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
          {comErro.has(foto.src) ? (
            <Reservado alt={foto.alt} />
          ) : (
            <Image
              src={foto.src}
              alt={foto.alt}
              fill
              sizes="100vw"
              className="object-contain"
              onError={() => marcarErro(foto.src)}
            />
          )}
        </div>
        <figcaption className="mt-3 text-center text-sm text-areia-200">
          <span className="font-semibold text-areia-100">{foto.espaco}</span> ·{" "}
          {foto.alt}
          <span className="ml-2 text-mata-400">
            ({(aberta ?? 0) + 1} de {fotos.length})
          </span>
        </figcaption>
      </figure>
    </div>
  );
}
