/**
 * Galeria do sítio, organizada por espaço.
 *
 * A ideia é que quem chega no site entenda o lugar: cada foto pertence a um
 * espaço real (a piscina, o salão, o Quarto 3), e cada espaço tem uma linha
 * dizendo o que tem lá. Os espaços seguem as pastas de fotos do sítio.
 *
 * As imagens em `public/fotos/` já estão otimizadas para a web (1600px no
 * maior lado, JPEG qualidade 80). Os originais em alta ficam na pasta
 * `fotos/` na raiz do projeto, que não vai para o git.
 *
 * Para trocar ou acrescentar uma foto: coloque o arquivo em `public/fotos/`
 * e adicione a entrada aqui, apontando para um espaço existente. Enquanto o
 * arquivo não existir, o site mostra um espaço reservado no lugar — a página
 * nunca quebra por falta de imagem.
 */

/** Filtros da galeria. Agrupam os espaços em blocos que o cliente reconhece. */
export const CATEGORIAS = [
  "Todas",
  "Piscina",
  "Espaço gourmet",
  "Salão de festas",
  "Casa e jardim",
  "Salas e cozinha",
  "Quartos",
  "Banheiros",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export type Espaco = {
  nome: string;
  categoria: Exclude<Categoria, "Todas">;
  /** Uma linha sobre o espaço. Aparece acima das fotos dele. */
  descricao: string;
};

/**
 * Ordem em que os espaços aparecem na galeria — é o roteiro da visita:
 * começa pela piscina, passa pelas áreas de festa e termina nos quartos.
 */
export const ESPACOS = [
  {
    nome: "Piscina",
    categoria: "Piscina",
    descricao:
      "De 1,40 m a 1,90 m de profundidade, com cascata e piso de pedra em toda a volta.",
  },
  {
    nome: "Churrasqueira",
    categoria: "Espaço gourmet",
    descricao:
      "Coberta, com mesão de madeira e fogão, a poucos passos da piscina.",
  },
  {
    nome: "Bar e quiosques",
    categoria: "Espaço gourmet",
    descricao:
      "Quiosques de tijolo com balcão de madeira espalhados pela área da piscina.",
  },
  {
    nome: "Mesa de sinuca",
    categoria: "Espaço gourmet",
    descricao: "Em área coberta, de frente para a piscina.",
  },
  {
    nome: "Salão de festas",
    categoria: "Salão de festas",
    descricao:
      "Coberto, com 15 mesas e 52 cadeiras — recebe até 200 pessoas. Tem fogão industrial para eventos acima de 30 pessoas. A churrasqueira fica no espaço gourmet, ao lado da piscina.",
  },
  {
    nome: "A casa por fora",
    categoria: "Casa e jardim",
    descricao:
      "Um lugar muito agradável para ficar com a família: varanda com cadeiras na sombra, gramado na porta e caminhos de pedra ligando uma construção à outra.",
  },
  {
    nome: "Jardim",
    categoria: "Casa e jardim",
    descricao:
      "Gramado, balanços e área livre de sobra para as crianças correrem à vontade.",
  },
  {
    nome: "Quadra",
    categoria: "Casa e jardim",
    descricao: "Serve para vôlei e para peteca.",
  },
  {
    nome: "Sala de estar do 1º andar",
    categoria: "Salas e cozinha",
    descricao: "Sofás, TV e a escada caracol que sobe para o segundo andar.",
  },
  {
    nome: "Sala de estar do 2º andar",
    categoria: "Salas e cozinha",
    descricao:
      "Sob o telhado de madeira, com balcão de bar e uma vista linda de todo o espaço do sítio.",
  },
  {
    nome: "Sala de jantar",
    categoria: "Salas e cozinha",
    descricao: "Mesa grande e coberta, aberta para o jardim.",
  },
  {
    nome: "Cozinha",
    categoria: "Salas e cozinha",
    descricao:
      "Fogão, geladeira, freezer, micro-ondas e airfryer. Louça e talheres para 30 pessoas.",
  },
  {
    nome: "Suíte",
    categoria: "Quartos",
    descricao:
      "No alto da casa de madeira, com pé-direito alto e banheiro próprio com hidromassagem.",
  },
  {
    nome: "Quarto 1",
    categoria: "Quartos",
    descricao: "Duas camas de solteiro e ventilador de teto.",
  },
  {
    nome: "Quarto 2",
    categoria: "Quartos",
    descricao: "Cama de casal e cama de solteiro, com janela para o verde.",
  },
  {
    nome: "Quarto 3",
    categoria: "Quartos",
    descricao: "Cama de casal e cama de solteiro.",
  },
  {
    nome: "Quarto 4",
    categoria: "Quartos",
    descricao: "Dois triliches, seis camas — o quarto da turma grande e da criançada.",
  },
  {
    nome: "Quarto 5",
    categoria: "Quartos",
    descricao: "Duas camas de solteiro, piso de madeira.",
  },
  {
    nome: "Banheiro da suíte",
    categoria: "Banheiros",
    descricao:
      "Com hidromassagem, disponível como opcional por diária, e chuveiro separado.",
  },
  {
    nome: "Banheiro 1",
    categoria: "Banheiros",
    descricao: "Completo, com box e bancada de granito.",
  },
  {
    nome: "Banheiro 2",
    categoria: "Banheiros",
    descricao: "Completo, com box e armário.",
  },
  {
    nome: "Vestiários",
    categoria: "Banheiros",
    descricao:
      "São 2, cada um com 3 vasos e 1 chuveiro, além de armários e bancos — grupo grande não faz fila.",
  },
] as const satisfies readonly Espaco[];

export type NomeEspaco = (typeof ESPACOS)[number]["nome"];

export type Foto = {
  /** Caminho a partir de `public/`. Ex: "/fotos/piscina-vista-geral.jpg" */
  src: string;
  /** Descrição para leitores de tela e para o Google. Seja específico. */
  alt: string;
  espaco: NomeEspaco;
  /** Fotos marcadas como destaque ocupam o dobro de espaço na grade. */
  destaque?: boolean;
};

export const FOTOS: Foto[] = [
  // ---------------- Piscina ----------------
  {
    src: "/fotos/piscina-vista-geral.jpg",
    alt: "Piscina de azulejo azul com piso de pedra em volta, espreguiçadeiras e os quiosques de tijolo ao fundo",
    espaco: "Piscina",
    destaque: true,
  },
  {
    src: "/fotos/piscina-comprimento.jpg",
    alt: "Piscina vista no comprimento, com escada de azulejo azul e o verde do sítio em volta",
    espaco: "Piscina",
  },
  {
    src: "/fotos/piscina-cascata-01.jpg",
    alt: "Cascata de aço despejando água na piscina em dia de céu azul",
    espaco: "Piscina",
  },
  {
    src: "/fotos/piscina-espreguicadeiras.jpg",
    alt: "Espreguiçadeiras à beira da piscina, no piso de pedra cercado de plantas",
    espaco: "Piscina",
  },
  {
    src: "/fotos/piscina-cascata-02.jpg",
    alt: "Cascata da piscina contra a luz, com o verde do sítio ao fundo",
    espaco: "Piscina",
  },
  {
    src: "/fotos/piscina-cascata-jardim.jpg",
    alt: "Piscina com a cascata ligada, vasos de planta no piso de pedra e os quiosques ao lado",
    espaco: "Piscina",
  },
  {
    src: "/fotos/piscina-quiosques.jpg",
    alt: "Piscina vista da área dos quiosques, com cadeiras e mesas na sombra",
    espaco: "Piscina",
  },
  {
    src: "/fotos/piscina-mureta.jpg",
    alt: "Piscina com mureta de balaústres e o gramado do sítio logo atrás",
    espaco: "Piscina",
  },

  // ---------------- Churrasqueira ----------------
  {
    src: "/fotos/gourmet-churrasqueira-arcos.jpg",
    alt: "Churrasqueira coberta com arcos de tijolo e mesão de madeira maciça com bancos",
    espaco: "Churrasqueira",
    destaque: true,
  },
  {
    src: "/fotos/gourmet-quiosque-arcos.jpg",
    alt: "Quiosque de arcos de tijolo no fim da tarde, com o jardim e a piscina ao redor",
    espaco: "Churrasqueira",
  },
  {
    src: "/fotos/gourmet-churrasqueira-fogao.jpg",
    alt: "Churrasqueira de tijolo com grelha e fogão, aberta para o jardim",
    espaco: "Churrasqueira",
  },
  {
    src: "/fotos/gourmet-quiosques-piscina.jpg",
    alt: "Fileira de quiosques cobertos de frente para a piscina, na sombra",
    espaco: "Churrasqueira",
  },

  // ---------------- Bar e quiosques ----------------
  {
    src: "/fotos/bar-quiosque-redondo.jpg",
    alt: "Quiosque redondo com balcão de bar, banquetas e bancos de madeira rústica",
    espaco: "Bar e quiosques",
  },
  {
    src: "/fotos/bar-balcao-madeira.jpg",
    alt: "Balcão de bar em madeira maciça com banquetas altas, dentro do quiosque",
    espaco: "Bar e quiosques",
  },
  {
    src: "/fotos/bar-vista-piscina.jpg",
    alt: "Vista de dentro do quiosque para a piscina e as espreguiçadeiras",
    espaco: "Bar e quiosques",
  },

  // ---------------- Mesa de sinuca ----------------
  {
    src: "/fotos/sinuca-jardim.jpg",
    alt: "Mesa de sinuca em área coberta, aberta para o jardim",
    espaco: "Mesa de sinuca",
  },
  {
    src: "/fotos/sinuca-piscina.jpg",
    alt: "Mesa de sinuca sob o telhado de telha, com a piscina logo ao lado",
    espaco: "Mesa de sinuca",
  },

  // ---------------- Salão de festas ----------------
  {
    src: "/fotos/salao-mesas.jpg",
    alt: "Salão de festas coberto, com mesas, cadeiras e lustres de ferro no telhado de telha",
    espaco: "Salão de festas",
    destaque: true,
  },
  {
    src: "/fotos/salao-luz-natural.jpg",
    alt: "Salão de festas iluminado pela luz do dia, com as mesas montadas",
    espaco: "Salão de festas",
  },
  {
    src: "/fotos/salao-cadeiras.jpg",
    alt: "Salão de festas de outro ângulo, com as mesas e as cadeiras guardadas junto à parede de tijolo",
    espaco: "Salão de festas",
  },
  {
    src: "/fotos/salao-fogao-industrial.jpg",
    alt: "Fogão industrial de seis bocas com coifa, disponível para eventos acima de 30 pessoas",
    espaco: "Salão de festas",
  },

  // ---------------- A casa por fora ----------------
  {
    src: "/fotos/casa-fachada.jpg",
    alt: "Fachada da casa principal, com jardim bem cuidado e caminho de pedra na frente",
    espaco: "A casa por fora",
    destaque: true,
  },
  {
    src: "/fotos/casa-madeira-vidro.jpg",
    alt: "Construção de madeira e vidro do sítio, com estrutura aparente e telhado de telha",
    espaco: "A casa por fora",
  },
  {
    src: "/fotos/casa-varanda.jpg",
    alt: "Varanda coberta com cadeiras de madeira ao longo da parede da casa",
    espaco: "A casa por fora",
  },
  {
    src: "/fotos/casa-caminho-pedra.jpg",
    alt: "Caminho de pedra atravessando o gramado até a entrada da casa",
    espaco: "A casa por fora",
  },

  // ---------------- Jardim ----------------
  {
    src: "/fotos/jardim-quiosque-balanco.jpg",
    alt: "Gramado com balanço de criança e quiosque coberto no meio do jardim",
    espaco: "Jardim",
    destaque: true,
  },
  {
    src: "/fotos/jardim-alameda.jpg",
    alt: "Alameda de árvores altas com caminho de pedra cortando o gramado",
    espaco: "Jardim",
  },
  {
    src: "/fotos/jardim-balanco.jpg",
    alt: "Balanço de jardim na sombra das árvores, sobre o gramado",
    espaco: "Jardim",
  },
  {
    src: "/fotos/jardim-vista-piscina.jpg",
    alt: "Vista do gramado para a piscina, os quiosques e a quadra",
    espaco: "Jardim",
  },
  {
    src: "/fotos/jardim-arvores.jpg",
    alt: "Árvores e canteiro no centro do jardim, com as construções do sítio em volta",
    espaco: "Jardim",
  },

  // ---------------- Quadra ----------------
  {
    src: "/fotos/quadra-casa.jpg",
    alt: "Quadra de vôlei e peteca com a rede armada e a casa ao fundo",
    espaco: "Quadra",
  },
  {
    src: "/fotos/quadra-vista-geral.jpg",
    alt: "Quadra vista de longe, cercada pelo verde, em dia de céu azul",
    espaco: "Quadra",
  },

  // ---------------- Sala de estar do 1º andar ----------------
  {
    src: "/fotos/sala-estar-1-escada.jpg",
    alt: "Sala de estar com escada caracol de madeira, sofás e TV",
    espaco: "Sala de estar do 1º andar",
  },
  {
    src: "/fotos/sala-estar-1-sofas.jpg",
    alt: "Sofás da sala de estar do primeiro andar, com janelas de madeira abertas para o jardim",
    espaco: "Sala de estar do 1º andar",
  },

  // ---------------- Sala de estar do 2º andar ----------------
  {
    src: "/fotos/sala-estar-2-vista.jpg",
    alt: "Sala de estar do segundo andar, com sofás e teto de madeira em forma de arco",
    espaco: "Sala de estar do 2º andar",
    destaque: true,
  },
  {
    src: "/fotos/sala-estar-2-mezanino.jpg",
    alt: "Mezanino do segundo andar com janelão de madeira e vista para todo o sítio",
    espaco: "Sala de estar do 2º andar",
  },
  {
    src: "/fotos/sala-estar-2-bar.jpg",
    alt: "Balcão de bar com banquetas na sala de estar do segundo andar",
    espaco: "Sala de estar do 2º andar",
  },

  // ---------------- Sala de jantar ----------------
  {
    src: "/fotos/sala-jantar-mesa.jpg",
    alt: "Mesa de jantar comprida de madeira, com janelões abertos para o gramado",
    espaco: "Sala de jantar",
  },
  {
    src: "/fotos/sala-jantar-varanda.jpg",
    alt: "Sala de jantar coberta com telhado de telha aparente e cadeiras de madeira",
    espaco: "Sala de jantar",
  },

  // ---------------- Cozinha ----------------
  {
    src: "/fotos/cozinha-geral.jpg",
    alt: "Cozinha com fogão, geladeira, armários amplos e bancada comprida",
    espaco: "Cozinha",
  },
  {
    src: "/fotos/cozinha-bancada.jpg",
    alt: "Bancada da cozinha com banquetas, micro-ondas, forno e geladeira",
    espaco: "Cozinha",
  },

  // ---------------- Suíte ----------------
  {
    src: "/fotos/suite-cama.jpg",
    alt: "Suíte no alto da casa de madeira, com cama de casal e parede de madeira",
    espaco: "Suíte",
  },
  {
    src: "/fotos/suite-vista.jpg",
    alt: "Suíte com pé-direito alto, teto de madeira aparente e piso de tábua corrida",
    espaco: "Suíte",
  },
  {
    src: "/fotos/suite-camas.jpg",
    alt: "Outro ângulo da suíte, com cama de casal e cama de solteiro",
    espaco: "Suíte",
  },

  // ---------------- Quartos ----------------
  {
    src: "/fotos/quarto-1.jpg",
    alt: "Quarto 1, com duas camas de solteiro e ventilador de teto",
    espaco: "Quarto 1",
  },
  {
    src: "/fotos/quarto-2.jpg",
    alt: "Quarto 2, com cama de casal, cama de solteiro e janela de madeira",
    espaco: "Quarto 2",
  },
  {
    src: "/fotos/quarto-3.jpg",
    alt: "Quarto 3, com cama de casal, cama de solteiro e piso claro",
    espaco: "Quarto 3",
  },
  {
    src: "/fotos/quarto-4.jpg",
    alt: "Quarto 4, com dois triliches de madeira e teto alto",
    espaco: "Quarto 4",
  },
  {
    src: "/fotos/quarto-4-triliches.jpg",
    alt: "Outro ângulo do Quarto 4, mostrando os dois triliches lado a lado",
    espaco: "Quarto 4",
  },
  {
    src: "/fotos/quarto-5.jpg",
    alt: "Quarto 5, com duas camas de solteiro e piso de madeira",
    espaco: "Quarto 5",
  },

  // ---------------- Banheiro da suíte ----------------
  {
    src: "/fotos/hidromassagem-01.jpg",
    alt: "Banheira de hidromassagem da suíte, embutida em bancada de pedra sob o teto de madeira",
    espaco: "Banheiro da suíte",
  },
  {
    src: "/fotos/hidromassagem-02.jpg",
    alt: "Hidromassagem da suíte vista de outro ângulo, com parede de pedra e bancada",
    espaco: "Banheiro da suíte",
  },

  // ---------------- Banheiros e vestiários ----------------
  {
    src: "/fotos/banheiro-1-pia.jpg",
    alt: "Banheiro com bancada de granito, cuba e espelho grande",
    espaco: "Banheiro 1",
  },
  {
    src: "/fotos/banheiro-1-box.jpg",
    alt: "Box de vidro do banheiro, com porta de madeira maciça ao lado",
    espaco: "Banheiro 1",
  },
  {
    src: "/fotos/banheiro-2.jpg",
    alt: "Segundo banheiro completo, com box, pia e armário",
    espaco: "Banheiro 2",
  },
  {
    src: "/fotos/vestiario-armarios.jpg",
    alt: "Vestiário com parede de armários de madeira, banco comprido e pias",
    espaco: "Vestiários",
  },
  {
    src: "/fotos/vestiario-banco.jpg",
    alt: "Vestiário com cabines, banco de madeira e pé-direito alto",
    espaco: "Vestiários",
  },
];

/** Fotos de um espaço, na ordem em que foram cadastradas. */
export function fotosDoEspaco(espaco: NomeEspaco): Foto[] {
  return FOTOS.filter((f) => f.espaco === espaco);
}

/**
 * Espaços de uma categoria, já com as fotos de cada um. Espaço sem foto
 * cadastrada não aparece — melhor sumir do que abrir uma seção vazia.
 */
export function espacosDaCategoria(categoria: Categoria) {
  return ESPACOS.filter(
    (e) => categoria === "Todas" || e.categoria === categoria,
  )
    .map((espaco) => ({ espaco, fotos: fotosDoEspaco(espaco.nome) }))
    .filter((grupo) => grupo.fotos.length > 0);
}
