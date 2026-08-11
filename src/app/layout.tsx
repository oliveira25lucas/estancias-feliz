import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { CONTATO, LOCALIZACAO } from "@/lib/site-config";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "WONK"],
});

const SITE_URL = "https://estanciasfeliz.com.br";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Sítio Estâncias Feliz — Aluguel para festas e temporada em Sarzedo, MG",
    template: "%s | Sítio Estâncias Feliz",
  },
  description:
    "Sítio para alugar perto de Belo Horizonte: piscina com cascata, salão de festas, churrasqueira e 6 quartos para 25 pessoas. Wi-Fi Starlink. Na MG-040, Km 30, em Sarzedo. Faça seu orçamento na hora.",
  keywords: [
    "sítio para alugar BH",
    "sítio para festa Belo Horizonte",
    "chácara para alugar Sarzedo",
    "sítio com piscina MG",
    "aluguel de sítio Brumadinho",
    "salão de festas sítio MG",
  ],
  authors: [{ name: "Sítio Estâncias Feliz" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_URL,
    siteName: "Sítio Estâncias Feliz",
    title: "Sítio Estâncias Feliz — Seu evento com piscina, salão e churrasqueira",
    description:
      "25 pessoas para dormir e 200 para eventos. Piscina com cascata, salão de festas coberto e Wi-Fi Starlink. A 30 km de BH, na MG-040.",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "Vista da piscina e da área de lazer do Sítio Estâncias Feliz",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sítio Estâncias Feliz",
    description:
      "Sítio para festas e temporada perto de BH. Piscina, salão de festas e churrasqueira.",
    images: ["/og.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export const viewport: Viewport = {
  themeColor: "#274f37",
  width: "device-width",
  initialScale: 1,
};

/**
 * Dados estruturados para o Google entender que isto é uma hospedagem
 * real, com endereço e telefone — melhora muito a busca local.
 */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LodgingBusiness",
  name: "Sítio Estâncias Feliz",
  description:
    "Sítio para aluguel de temporada, festas e eventos, com piscina, salão de festas e churrasqueira.",
  url: SITE_URL,
  telephone: `+${CONTATO.telefone}`,
  email: CONTATO.email,
  address: {
    "@type": "PostalAddress",
    streetAddress: LOCALIZACAO.endereco,
    addressLocality: `${LOCALIZACAO.bairro}, ${LOCALIZACAO.cidade}`,
    addressRegion: LOCALIZACAO.estado,
    postalCode: LOCALIZACAO.cep,
    addressCountry: "BR",
  },
  // As coordenadas ajudam o Google a posicionar o sítio na busca local,
  // que é como quase todo cliente daqui encontra o lugar.
  geo: {
    "@type": "GeoCoordinates",
    latitude: LOCALIZACAO.latitude,
    longitude: LOCALIZACAO.longitude,
  },
  sameAs: [CONTATO.instagram, CONTATO.airbnb, CONTATO.google],
  amenityFeature: [
    "Piscina",
    "Salão de festas",
    "Churrasqueira",
    "Wi-Fi Starlink",
    "Quadra de vôlei e peteca",
    "Mesa de sinuca",
  ].map((nome) => ({
    "@type": "LocationFeatureSpecification",
    name: nome,
    value: true,
  })),
  numberOfRooms: 6,
  maximumAttendeeCapacity: 200,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
