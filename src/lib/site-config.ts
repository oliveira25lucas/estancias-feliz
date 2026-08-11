/**
 * Fonte única de verdade sobre o Sítio Estâncias Feliz.
 *
 * O agente de IA do WhatsApp (Júlia) usa a mesma descrição, montada no
 * nó "Montar Resposta" do workflow v4 no n8n. Se algo mudar aqui, mude
 * lá também — informação divergente entre o site e o WhatsApp confunde
 * o cliente na hora errada.
 */

export const CONTATO = {
  /**
   * Número da instância "sitio-atendimento" da Evolution API — é onde a
   * Júlia (agente de IA) atende. NÃO trocar pelo número pessoal do Lucas
   * ((31) 97181-1125), que o workflow usa só para notificar o gerente:
   * o cliente cairia no WhatsApp errado e sem atendimento automático.
   */
  telefone: "5531971397781",
  telefoneFormatado: "(31) 97139-7781",
  email: "sitioestanciasfeliz@gmail.com",
  instagram: "https://www.instagram.com/estanciasfeliz/",
  airbnb: "https://www.airbnb.com.br/rooms/1041082439031208384",
  /** Perfil do Google, com avaliações. */
  google: "https://share.google/oM2pUBLHVFb8oxk9n",
} as const;

export const LOCALIZACAO = {
  endereco: "Rod. MG-040, Km 30",
  bairro: "Zona Rural",
  cidade: "Sarzedo",
  estado: "MG",
  cep: "32450-000",
  referencia: "Referência: Floricultura Sarzedo",
  /** Coordenadas do pino no Google Maps — usadas no mapa e no SEO local. */
  latitude: -20.0319993,
  longitude: -44.1250467,
  /**
   * Link montado a partir do endereço, não encurtado: link curto
   * quebra quando o dono do perfil muda alguma coisa.
   */
  maps:
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(
      "Sítio Estâncias Feliz, Rod. MG-040, Km 30, Zona Rural, Sarzedo - MG, 32450-000",
    ),
  waze: "https://waze.com/ul/h7h2w5cm1h",
} as const;

/** Endereço em uma linha, para exibição. */
export const ENDERECO_COMPLETO =
  `${LOCALIZACAO.endereco} — ${LOCALIZACAO.bairro}, ` +
  `${LOCALIZACAO.cidade} - ${LOCALIZACAO.estado}, ${LOCALIZACAO.cep}`;

export const HORARIOS = {
  /** Um horário só, todos os dias — antes era 6h na semana e 10h no fim de semana. */
  checkin: "8h",
  checkout: "16h",
  observacao: "Horários fixos, não há flexibilização.",
} as const;

export const CAPACIDADE = {
  /** Camas e colchões disponíveis hoje. É o número honesto para o site. */
  dormirAtual: 25,
  /** Limite da casa, se houver estrutura extra combinada. */
  dormirMax: 30,
  quartos: 6,
  suites: 1,
  banheiros: 3,
  vestiarios: 2,
  lavabos: 2,
  eventoMax: 200,
} as const;

/** Blocos de estrutura exibidos na landing page. */
export const ESTRUTURA = [
  {
    titulo: "A casa",
    icone: "home" as const,
    itens: [
      "6 quartos, sendo 1 suíte",
      "Espaço para 25 pessoas dormirem",
      "Wi-Fi via Starlink — internet rápida mesmo na zona rural",
      "TV na área social",
    ],
  },
  {
    titulo: "Banheiros e vestiários",
    icone: "bath" as const,
    itens: [
      "3 banheiros completos na casa",
      "2 vestiários, cada um com 3 vasos e 1 chuveiro",
      "2 lavabos, com um vaso cada",
      "Estrutura pensada para grupo grande não fazer fila",
    ],
  },
  {
    titulo: "Piscina e área externa",
    icone: "waves" as const,
    itens: [
      "Piscina com profundidade de 1,40m a 1,90m",
      "Cascata na piscina",
      "Hidromassagem disponível (opcional, por diária)",
      "Quadra que serve para vôlei e para peteca",
    ],
  },
  {
    titulo: "Salão de festas",
    icone: "party" as const,
    itens: [
      "52 cadeiras e 15 mesas",
      "Coberto — chuva não atrapalha o seu dia",
      "Churrasqueira",
      "Mesa de sinuca",
    ],
  },
  {
    titulo: "Cozinha",
    icone: "chef" as const,
    itens: [
      "Fogão com gás incluso, airfryer, micro-ondas e misteira",
      "Geladeira e freezer",
      "Panelas básicas inclusas",
      "Talheres e louça para até 30 pessoas",
      "Fogão industrial disponível para eventos acima de 30 pessoas",
    ],
  },
] as const;

/** Itens que o hóspede precisa levar — evita 90% dos mal-entendidos no check-in. */
export const NAO_INCLUSO = [
  "Travesseiro",
  "Roupa de cama",
  "Edredom",
  "Cobertor",
  "Toalha",
] as const;

export const PAGAMENTO = {
  sinal: "50% de sinal na assinatura do contrato",
  restante: "50% restante no check-in",
  caucao: 500,
  caucaoObservacao:
    "Caução de R$ 500, devolvida integralmente se estiver tudo certo.",
} as const;

export const OBSERVACOES_PISCINA = "A piscina não é aquecida." as const;

/** Perguntas que a Júlia mais recebe no WhatsApp. */
export const FAQ = [
  {
    pergunta: "Quantas pessoas o sítio acomoda?",
    resposta:
      "Para dormir, temos espaço para 25 pessoas, distribuídas em 6 quartos (1 suíte). Para eventos durante o dia, o salão de festas atende até 200 pessoas.",
  },
  {
    pergunta: "Quantos banheiros tem?",
    resposta:
      "São 3 banheiros completos na casa, mais 2 vestiários — cada um com 3 vasos e 1 chuveiro — e 2 lavabos com um vaso cada. Dá para receber grupo grande sem fila.",
  },
  {
    pergunta: "Preciso levar roupa de cama e toalha?",
    resposta:
      "Sim. Não fornecemos travesseiro, roupa de cama, edredom, cobertor nem toalha. O restante da estrutura — cozinha equipada, panelas, talheres e louça para 30 pessoas — está tudo incluso.",
  },
  {
    pergunta: "Tem internet?",
    resposta:
      "Tem, e boa: Wi-Fi via Starlink. Mesmo na zona rural você consegue trabalhar, fazer chamada de vídeo ou só deixar as crianças assistindo.",
  },
  {
    pergunta: "Qual o horário de check-in e check-out?",
    resposta:
      "O check-in é às 8h, todos os dias, e o check-out é sempre às 16h. Esses horários são fixos.",
  },
  {
    pergunta: "A piscina é aquecida?",
    resposta:
      "Não, a piscina não é aquecida. Ela tem de 1,40m a 1,90m de profundidade e conta com cascata.",
  },
  {
    pergunta: "Como funciona o pagamento?",
    resposta:
      "São 50% de sinal na assinatura do contrato e os outros 50% no check-in, junto com a caução de R$ 500 — que devolvemos integralmente se estiver tudo certo.",
  },
  {
    pergunta: "Posso visitar o sítio antes de fechar?",
    resposta:
      "Pode! As visitas são agendadas antes da assinatura do contrato. Chame no WhatsApp que combinamos o melhor dia e horário.",
  },
] as const;

/**
 * Monta o link do WhatsApp já com a mensagem pronta.
 * O número aponta para a instância onde a Júlia (agente de IA) atende.
 */
export function linkWhatsApp(mensagem?: string): string {
  const base = `https://wa.me/${CONTATO.telefone}`;
  if (!mensagem) return base;
  return `${base}?text=${encodeURIComponent(mensagem)}`;
}
