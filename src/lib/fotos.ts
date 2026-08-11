/**
 * Galeria do sítio.
 *
 * As imagens em `public/fotos/` já estão otimizadas para a web (1600px de
 * largura, JPEG qualidade 80). Os originais em alta ficam na pasta `fotos/`
 * na raiz do projeto, que não vai para o git.
 *
 * Para trocar ou acrescentar uma foto: coloque o arquivo em `public/fotos/`
 * e adicione a entrada aqui. Enquanto o arquivo não existir, o site mostra
 * um espaço reservado no lugar — a página nunca quebra por falta de imagem.
 */

export type Foto = {
  /** Caminho a partir de `public/`. Ex: "/fotos/piscina-01.jpg" */
  src: string;
  /** Descrição para leitores de tela e para o Google. Seja específico. */
  alt: string;
  categoria: "Piscina" | "Casa" | "Salão de festas" | "Área externa" | "Cozinha";
  /** Fotos marcadas como destaque ocupam o dobro de espaço na grade. */
  destaque?: boolean;
};

export const FOTOS: Foto[] = [
  {
    src: "/fotos/piscina-01.jpg",
    alt: "Piscina de azulejo azul cercada por palmeiras imperiais, com quiosques de tijolo ao fundo",
    categoria: "Piscina",
    destaque: true,
  },
  {
    src: "/fotos/casa-fachada.jpg",
    alt: "Fachada da casa principal com telhado de barro e caminho de pedra no gramado",
    categoria: "Casa",
  },
  {
    src: "/fotos/salao-01.jpg",
    alt: "Salão de festas coberto, com mesas e cadeiras montadas para receber convidados",
    categoria: "Salão de festas",
  },
  {
    src: "/fotos/piscina-cascata-01.jpg",
    alt: "Cascata de aço despejando água na piscina em dia de céu azul",
    categoria: "Piscina",
  },
  {
    src: "/fotos/area-jardim.jpg",
    alt: "Jardim gramado com palmeiras altas e caminho de pedra levando às construções",
    categoria: "Área externa",
    destaque: true,
  },
  {
    src: "/fotos/cozinha-01.jpg",
    alt: "Cozinha equipada com fogão, geladeira, forno e armários amplos",
    categoria: "Cozinha",
  },
  {
    src: "/fotos/casa-sala.jpg",
    alt: "Sala de estar com pé-direito alto, teto de madeira e sofás claros",
    categoria: "Casa",
  },
  {
    src: "/fotos/churrasqueira.jpg",
    alt: "Área da churrasqueira em alvenaria com arcos de tijolo e mesa de madeira maciça",
    categoria: "Área externa",
  },
  {
    src: "/fotos/piscina-cascata-02.jpg",
    alt: "Cascata da piscina contra o sol, com palmeiras ao fundo no fim da tarde",
    categoria: "Piscina",
  },
  {
    src: "/fotos/area-quiosque.jpg",
    alt: "Quiosque de alvenaria no meio do jardim, com caminho de pedra ao redor",
    categoria: "Área externa",
  },
  {
    src: "/fotos/casa-quarto.jpg",
    alt: "Quarto com paredes e teto de madeira, cama de casal arrumada",
    categoria: "Casa",
  },
  {
    src: "/fotos/salao-02.jpg",
    alt: "Salão de festas com fileiras de mesas e cadeiras e churrasqueira ao fundo",
    categoria: "Salão de festas",
  },
  {
    src: "/fotos/lazer-sinuca.jpg",
    alt: "Mesa de sinuca em área coberta, ao lado da piscina",
    categoria: "Área externa",
  },
  {
    src: "/fotos/piscina-02.jpg",
    alt: "Vista lateral da piscina com deck de pedra e coqueiros altos",
    categoria: "Piscina",
  },
  {
    src: "/fotos/casa-lareira.jpg",
    alt: "Sala com lareira de pedra, poltronas e estrutura aparente de madeira",
    categoria: "Casa",
  },
  {
    src: "/fotos/area-rede.jpg",
    alt: "Quiosque com rede armada, cercado por grama e árvores",
    categoria: "Área externa",
  },
  {
    src: "/fotos/cozinha-02.jpg",
    alt: "Cozinha com bancada de granito, ilha central e geladeira grande",
    categoria: "Cozinha",
  },
  {
    src: "/fotos/casa-hidromassagem.jpg",
    alt: "Banheira de hidromassagem embutida, com revestimento de pedra",
    categoria: "Casa",
  },
  {
    src: "/fotos/cozinha-industrial.jpg",
    alt: "Fogão industrial de seis bocas com coifa, disponível para eventos",
    categoria: "Cozinha",
  },
];

export const CATEGORIAS = [
  "Todas",
  "Piscina",
  "Casa",
  "Salão de festas",
  "Área externa",
  "Cozinha",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];
