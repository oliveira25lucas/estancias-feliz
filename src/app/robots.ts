import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // O painel não deve aparecer em buscador nenhum.
      disallow: ["/admin", "/admin/", "/api/"],
    },
    sitemap: "https://estanciasfeliz.com.br/sitemap.xml",
  };
}
