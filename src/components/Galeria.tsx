"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  CATEGORIAS,
  espacosDaCategoria,
  type Categoria,
  type Foto,
} from "@/lib/fotos";
import { Reservado, Visualizador, useVisualizador } from "./Visualizador";

/**
 * A galeria completa da página /fotos: filtros por categoria e uma seção
 * para cada espaço do sítio. A página inicial usa a `GaleriaCapa`, que
 * mostra só a amostra.
 */
export function Galeria() {
  const [categoria, setCategoria] = useState<Categoria>("Todas");

  /**
   * Cada grupo já sai daqui sabendo em que posição da lista achatada a
   * primeira foto dele cai — é o que liga o clique na grade ao visualizador.
   */
  const grupos = useMemo(() => {
    const lista = espacosDaCategoria(categoria);
    return lista.map((grupo, i) => ({
      ...grupo,
      inicio: lista
        .slice(0, i)
        .reduce((total, anterior) => total + anterior.fotos.length, 0),
    }));
  }, [categoria]);

  /**
   * As setas do visualizador andam pela galeria inteira que está na tela,
   * atravessando de um espaço para o próximo — por isso a lista achatada.
   */
  const fotos = useMemo<Foto[]>(() => grupos.flatMap((g) => g.fotos), [grupos]);
  const estado = useVisualizador(fotos);

  return (
    <>
      <div className="mb-10 flex flex-wrap justify-center gap-2">
        {CATEGORIAS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setCategoria(c);
              estado.fechar();
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

      <div className="space-y-12">
        {grupos.map(({ espaco, fotos: doEspaco, inicio }) => (
          <section key={espaco.nome} aria-labelledby={`espaco-${inicio}`}>
            <div className="mb-5 border-b border-mata-100 pb-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2
                  id={`espaco-${inicio}`}
                  className="font-display text-xl font-semibold text-mata-900"
                >
                  {espaco.nome}
                </h2>
                <span className="text-xs uppercase tracking-widest text-mata-500">
                  {doEspaco.length} {doEspaco.length === 1 ? "foto" : "fotos"}
                </span>
              </div>
              <p className="mt-1.5 max-w-2xl leading-relaxed text-mata-700">
                {espaco.descricao}
              </p>
            </div>

            <div className="grid auto-rows-[13rem] grid-cols-2 gap-3 sm:auto-rows-[15rem] md:grid-cols-3 lg:grid-cols-4">
              {doEspaco.map((foto, i) => (
                <button
                  key={foto.src}
                  type="button"
                  onClick={() => estado.abrir(inicio + i)}
                  className={`group relative overflow-hidden rounded-2xl bg-mata-100 shadow-sm transition hover:shadow-lg ${
                    foto.destaque ? "sm:col-span-2 sm:row-span-2" : ""
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
                    {espaco.nome}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <Visualizador fotos={fotos} estado={estado} />
    </>
  );
}
