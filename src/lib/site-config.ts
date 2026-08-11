/**
 * Fonte única de verdade sobre o Sítio Estâncias Feliz.
 *
 * Estes dados foram extraídos do workflow "Atendimento Sítio v3" do n8n,
 * que alimenta a Júlia (atendente de IA do WhatsApp). Manter este arquivo
 * e o workflow em sincronia — se um preço ou regra mudar aqui, mude lá também.
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
  airbnb:
    "https://www.airbnb.com.br/rooms/1041082439031208384",
} as const;

export const LOCALIZACAO = {
  endereco: "Rod. BH-Brumadinho (MG-040), Km 30",
  referencia: "Referência: Floricultura Sarzedo",
  cidade: "Sarzedo",
  estado: "MG",
  waze: "https://waze.com/ul/h7h2w5cm1h",
  maps: "https://maps.app.goo.gl/7zhGHoEc1by1sEtc8?g_st=iw",
} as const;

export const HORARIOS = {
  checkinSemana: "6h",
  checkinFimDeSemana: "10h",
  checkout: "16h",
  observacao: "Horários fixos, não há flexibilização.",
} as const;

export const CAPACIDADE = {
  dormirMax: 30,
  camas: 25,
  quartos: 6,
  suites: 1,
  banheiros: 3,
  eventoMax: 200,
} as const;

/** Blocos de estrutura exibidos na landing page. */
export const ESTRUTURA = [
  {
    titulo: "A casa",
    icone: "home" as const,
    itens: [
      "6 quartos, sendo 1 suíte",
      "3 banheiros completos",
      "Acomoda até 30 pessoas para dormir (25 camas e colchões)",
      "TV e Wi-Fi",
    ],
  },
  {
    titulo: "Piscina e área externa",
    icone: "waves" as const,
    itens: [
      "Piscina com profundidade de 1,40m a 1,90m",
      "Cascata funcionando das 9h às 12h e das 14h às 17h",
      "Hidromassagem disponível (opcional, R$ 150 por diária)",
      "Quadra de vôlei e peteca",
    ],
  },
  {
    titulo: "Salão de festas",
    icone: "party" as const,
    itens: [
      "52 cadeiras e 15 mesas",
      "2 vestiários e 2 lavabos",
      "Churrasqueira",
      "Mesa de sinuca",
      "Som liberado em qualquer horário",
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

export const OBSERVACOES_PISCINA =
  "A piscina não é aquecida." as const;

/** Perguntas que a Júlia mais recebe no WhatsApp. */
export const FAQ = [
  {
    pergunta: "Quantas pessoas o sítio acomoda?",
    resposta:
      "Para dormir, até 30 pessoas, com 25 camas e colchões distribuídos em 6 quartos (1 suíte) e 3 banheiros. Para eventos durante o dia, atendemos até 200 pessoas no salão de festas.",
  },
  {
    pergunta: "Preciso levar roupa de cama e toalha?",
    resposta:
      "Sim. Não fornecemos travesseiro, roupa de cama, edredom, cobertor nem toalha. O restante da estrutura — cozinha equipada, panelas, talheres e louça para 30 pessoas — está tudo incluso.",
  },
  {
    pergunta: "Qual o horário de check-in e check-out?",
    resposta:
      "Check-in de segunda a sexta às 6h, e aos sábados e domingos às 10h. O check-out é sempre às 16h. Esses horários são fixos.",
  },
  {
    pergunta: "A piscina é aquecida?",
    resposta:
      "Não, a piscina não é aquecida. Ela tem de 1,40m a 1,90m de profundidade, e a cascata funciona das 9h às 12h e das 14h às 17h.",
  },
  {
    pergunta: "Posso colocar som? Até que horas?",
    resposta:
      "Pode sim, o som é liberado em qualquer horário. O sítio é afastado, então você aproveita sua festa sem preocupação com vizinhos.",
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
  {
    pergunta: "Aceitam animais de estimação?",
    resposta:
      "Fale com a gente no WhatsApp para confirmar as condições da sua data.",
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
