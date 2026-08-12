import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://estanciasfeliz.com.br";
  const agora = new Date();

  return [
    { url: base, lastModified: agora, changeFrequency: "monthly", priority: 1 },
    {
      url: `${base}/orcamento`,
      lastModified: agora,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${base}/fotos`,
      lastModified: agora,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
