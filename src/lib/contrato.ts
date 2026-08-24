/**
 * Contrato de locação por temporada — o texto, e só o texto.
 *
 * Módulo PURO: não conhece Supabase, não conhece rede. É aqui que mora
 * o contrato-base (as cláusulas), a substituição das variáveis e a
 * numeração. Quem fala com banco é `contratos.ts`, ao lado — a mesma
 * divisão que `notificacoes.ts` / `avisos.ts` já usa, e é ela que
 * permite ao `npm test` alcançar este arquivo.
 *
 * ============================================================
 *  Duas ideias que sustentam o resto
 * ============================================================
 *
 * 1. **O contrato-base é editável; o contrato emitido é congelado.**
 *    Editar uma cláusula do modelo muda os PRÓXIMOS contratos, nunca os
 *    que já foram enviados. Documento assinado que muda de texto porque
 *    alguém mexeu no modelo três meses depois não é documento, é
 *    armadilha. Por isso cada contrato guarda uma CÓPIA das cláusulas
 *    (com as `{{variaveis}}` ainda dentro) no momento em que nasce.
 *
 * 2. **As variáveis são substituídas na hora de ler, não na hora de
 *    gravar.** Congelar o texto já substituído impediria corrigir um
 *    CPF errado depois. Congela-se o MODELO; os dados continuam vivos.
 *
 * A numeração é sempre recalculada: tirar a cláusula da hidromassagem
 * não pode deixar um buraco entre a 13ª e a 15ª.
 */

import { formatarBRL, formatarDataBR, MESES, diffDias } from "./pricing.ts";

// ============================================================
//  Quem aluga — o lado que não muda de contrato para contrato
// ============================================================

export const LOCADOR = {
  nomeEmpresarial: "58.659.960 LUCAS ALMEIDA OLIVEIRA",
  cnpj: "58.659.960/0001-48",
  endereco: "Rod. MG 040, km 30 - Zona Rural, Sarzedo - MG, 32450-000",
  /**
   * O número PESSOAL do Lucas, de propósito. Aqui é o contrário do
   * `site-config.ts`: quem assina contrato precisa falar com uma
   * pessoa, não com a Júlia. Não trocar pelo (31) 97139-7781, que é a
   * instância da Evolution.
   */
  telefone: "(31) 97181-1125",
  administrador: "Lucas Almeida Oliveira",
  cpf: "135.246.166-82",
} as const;

export const IMOVEL = {
  nome: "Sítio Estâncias Feliz",
  endereco: "Rod. MG 040, km 30 - Zona Rural, Sarzedo - MG, 32450-000",
  latitude: -20.03161656864093,
  longitude: -44.12539401408083,
  municipio: "Sarzedo",
} as const;

/** Abre o documento, acima da qualificação das partes. */
export const PREAMBULO =
  "As partes abaixo qualificadas firmam o presente contrato de locação por " +
  "temporada, regido pela Lei nº 8.245/1991 (Lei do Inquilinato), art. 48 e " +
  "seguintes, e, subsidiariamente, pelos arts. 565 a 578 do Código Civil " +
  "(Lei 10.406/2002), além das demais normas aplicáveis.";

export const ABERTURA_CLAUSULAS =
  "As partes, acima qualificadas, ajustam a locação por temporada do sítio " +
  "objeto do presente contrato, mediante as cláusulas e condições seguintes:";

// ============================================================
//  Números por extenso
//
//  O contrato escreve todo valor duas vezes — "R$ 3.900,00 (três mil e
//  novecentos reais)". É praxe jurídica e serve para desfazer dúvida
//  sobre dígito rasurado. Escrever isso à mão em cada contrato é
//  justamente o tipo de trabalho que a máquina não erra e a pessoa sim.
// ============================================================

/**
 * "R$ 3.900,00" com espaço COMUM.
 *
 * `formatarBRL` usa espaço inquebrável (U+00A0) entre "R$" e o número —
 * ótimo na tela, onde impede o "R$" de sobrar sozinho no fim da linha.
 * No contrato atrapalha: este texto é copiado para o WhatsApp, para o
 * e-mail e para editores, e um U+00A0 no meio do valor quebra busca
 * ingênua e às vezes aparece como caractere estranho. Os contratos já
 * assinados usam espaço comum; o gerado usa o mesmo, para que um valha
 * pelo outro.
 */
function dinheiro(valor: number): string {
  return formatarBRL(valor).replace(/\u00A0/g, " ");
}

const UNIDADES = [
  "zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito",
  "nove", "dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis",
  "dezessete", "dezoito", "dezenove",
] as const;

const UNIDADES_F: Record<number, string> = { 1: "uma", 2: "duas" };

const DEZENAS = [
  "", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta",
  "oitenta", "noventa",
] as const;

const CENTENAS = [
  "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
  "seiscentos", "setecentos", "oitocentos", "novecentos",
] as const;

const CENTENAS_F: Record<number, string> = {
  2: "duzentas", 3: "trezentas", 4: "quatrocentas", 5: "quinhentas",
  6: "seiscentas", 7: "setecentas", 8: "oitocentas", 9: "novecentas",
};

export type Genero = "m" | "f";

function abaixoDeCem(n: number, genero: Genero): string {
  if (n < 20) {
    return genero === "f" && UNIDADES_F[n] ? UNIDADES_F[n] : UNIDADES[n];
  }
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u === 0
    ? DEZENAS[d]
    : `${DEZENAS[d]} e ${abaixoDeCem(u, genero)}`;
}

function ateNovecentos(n: number, genero: Genero): string {
  // "cem" só quando é exatamente 100; 101 já vira "cento e um".
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const cabeca =
    c === 0 ? "" : genero === "f" && CENTENAS_F[c] ? CENTENAS_F[c] : CENTENAS[c];
  if (r === 0) return cabeca;
  const cauda = abaixoDeCem(r, genero);
  return cabeca ? `${cabeca} e ${cauda}` : cauda;
}

/** Nome da escala por posição do grupo, contando da direita. */
const ESCALAS = [
  { singular: "", plural: "" },
  { singular: "mil", plural: "mil" },
  { singular: "milhão", plural: "milhões" },
  { singular: "bilhão", plural: "bilhões" },
] as const;

/**
 * 3900 → "três mil e novecentos". 1266 → "mil duzentos e sessenta e seis".
 *
 * A conjunção entre grupos segue a regra da língua, não o gosto: entra
 * "e" antes do último grupo quando ele é menor que cem ou é centena
 * redonda ("três mil E novecentos"), e nada quando não é ("mil duzentos
 * e sessenta e seis" — sem "e" depois de "mil").
 */
export function porExtenso(valor: number, genero: Genero = "m"): string {
  const n = Math.floor(Math.abs(valor));
  if (n === 0) return "zero";

  // Quebra em grupos de três, do menos para o mais significativo.
  const grupos: number[] = [];
  let resto = n;
  while (resto > 0) {
    grupos.push(resto % 1000);
    resto = Math.floor(resto / 1000);
  }

  const partes: string[] = [];
  for (let i = grupos.length - 1; i >= 0; i--) {
    const g = grupos[i];
    if (g === 0) continue;
    const escala = ESCALAS[i] ?? ESCALAS[0];
    // O gênero só alcança o grupo das unidades: "duas mil pessoas" é
    // exceção rara e nenhum número deste contrato chega lá.
    const corpo = ateNovecentos(g, i === 0 ? genero : "m");
    if (i === 0) {
      partes.push(corpo);
    } else if (i === 1) {
      // "mil", nunca "um mil".
      partes.push(g === 1 ? "mil" : `${corpo} mil`);
    } else {
      partes.push(`${corpo} ${g === 1 ? escala.singular : escala.plural}`);
    }
  }

  if (partes.length === 1) return partes[0];

  const ultimoGrupo = grupos.findIndex((g) => g !== 0);
  const ultimoValor = grupos[ultimoGrupo];
  const usaE = ultimoValor < 100 || ultimoValor % 100 === 0;
  const cabeca = partes.slice(0, -1).join(" ");
  return `${cabeca}${usaE ? " e " : " "}${partes[partes.length - 1]}`;
}

/** 3900 → "três mil e novecentos reais". Centavos entram quando existem. */
export function reaisPorExtenso(valor: number): string {
  const total = Math.round(Math.abs(valor) * 100);
  const reais = Math.floor(total / 100);
  const centavos = total % 100;

  const parteReais =
    reais === 0 ? "" : `${porExtenso(reais)} ${reais === 1 ? "real" : "reais"}`;
  const parteCentavos =
    centavos === 0
      ? ""
      : `${porExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`;

  if (parteReais && parteCentavos) return `${parteReais} e ${parteCentavos}`;
  return parteReais || parteCentavos || "zero reais";
}

/** "R$ 3.900,00 (três mil e novecentos reais)" — o par completo. */
export function valorPorExtenso(valor: number): string {
  return `${dinheiro(valor)} (${reaisPorExtenso(valor)})`;
}

/** "2 (duas) noites" — número e extenso, no gênero certo. */
export function quantidadePorExtenso(n: number, genero: Genero = "m"): string {
  return `${n} (${porExtenso(n, genero)})`;
}

/** "24 de Agosto de 2026" — como o contrato sempre assinou. */
export function dataPorExtenso(iso: string): string {
  if (!iso) return "";
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  return `${dia} de ${MESES[mes - 1]} de ${ano}`;
}

const ORDINAIS = [
  "primeiro", "segundo", "terceiro", "quarto", "quinto", "sexto", "sétimo",
  "oitavo", "nono", "décimo", "décimo primeiro", "décimo segundo",
] as const;

export function ordinal(indice: number): string {
  return ORDINAIS[indice] ?? `${indice + 1}º`;
}

// ============================================================
//  Os dados de um contrato
// ============================================================

export type Parcela = {
  /** Em reais. */
  valor: number;
  /** ISO, "2026-09-11". */
  data: string;
};

export type DadosContrato = {
  locatarioNome: string;
  locatarioCpf: string;
  locatarioEndereco: string;
  locatarioTelefone: string;

  checkin: string;
  checkout: string;
  /** "08:00". Muda de contrato para contrato — nos dois últimos foi 05:00 e 06:00. */
  horaCheckin: string;
  horaCheckout: string;

  /** Teto de gente fora do horário do evento (quem dorme). */
  pessoasEstadia: number;
  /** Teto durante o evento. Zero ou igual ao de estadia = sem evento. */
  pessoasEvento: number;

  valorTotal: number;
  parcelas: Parcela[];
  pixChave: string;
  pixTitular: string;

  caucao: number;
  hidromassagem: boolean;
  hidromassagemDiaria: number;
  valorPessoaExcedente: number;
  valorDiariaExcedente: number;
  multaAtrasoCheckin: number;
  multaLimpeza: number;

  cidadeForo: string;
  dataAssinatura: string;
};

/** Preenche o que quase nunca muda, para o formulário já nascer pronto. */
export const PADROES = {
  horaCheckin: "08:00",
  horaCheckout: "16:00",
  pessoasEstadia: 30,
  pessoasEvento: 50,
  caucao: 500,
  hidromassagem: false,
  hidromassagemDiaria: 150,
  valorPessoaExcedente: 150,
  valorDiariaExcedente: 1500,
  multaAtrasoCheckin: 100,
  multaLimpeza: 150,
  cidadeForo: "Belo Horizonte",
  pixChave: "estanciaseliane@gmail.com",
  pixTitular: "Maria Susana - Banco Nubank",
} as const;

// ============================================================
//  As cláusulas
// ============================================================

/**
 * Quando uma cláusula entra. Vazio = sempre.
 *
 * Chave desconhecida ENTRA no contrato, de propósito: cláusula a mais
 * é visível e discutível, cláusula que sumiu sozinha ninguém percebe.
 * Num documento jurídico, errar para o lado do excesso é o erro barato.
 */
export const CONDICOES = [
  { valor: "", rotulo: "Sempre" },
  { valor: "com_hidromassagem", rotulo: "Só se a hidro foi contratada" },
  { valor: "sem_hidromassagem", rotulo: "Só se a hidro NÃO foi contratada" },
  { valor: "com_evento", rotulo: "Só se há evento (teto maior de gente)" },
  { valor: "sem_evento", rotulo: "Só se NÃO há evento" },
  { valor: "parcelado", rotulo: "Só se há mais de um pagamento" },
] as const;

export type Clausula = {
  ordem: number;
  texto: string;
  condicao: string | null;
  ativa: boolean;
};

export type ClausulaMontada = {
  /** Recalculado a cada montagem — tirar uma cláusula não deixa buraco. */
  numero: number;
  texto: string;
  /** Variáveis do texto que ficaram sem valor. Vazio é o esperado. */
  faltando: string[];
};

/**
 * O contrato-base, transcrito do modelo em uso (o último assinado é de
 * 24/08/2026). Serve para duas coisas: semear a tabela do banco na
 * primeira vez, e ser a rede de segurança quando a tabela está vazia —
 * assim o painel nunca fica sem contrato para emitir.
 *
 * As `{{variaveis}}` são substituídas na leitura. Ver `variaveis()`.
 */
export const CLAUSULAS_BASE: Clausula[] = [
  {
    ordem: 1,
    condicao: null,
    ativa: true,
    texto:
      "As partes contratantes declaram que este contrato de locação é regido pelas disposições da Lei nº 8.245, de 18 de outubro de 1991, e suas alterações posteriores, que regulamentam as locações de imóveis urbanos, salvo nos casos em que a referida lei for incompatível com as especificidades deste contrato.",
  },
  {
    ordem: 2,
    condicao: null,
    ativa: true,
    texto:
      "AS PARTES se comprometem a:\n" +
      "2.1 Tratar os dados pessoais, aos quais tiverem acesso para o cumprimento contratual e relações negociais, de acordo com o previsto pela Lei Geral de Proteção de Dados Pessoais – LGPD, Lei 13.709/2018, conforme instruções do CONTROLADOR.\n" +
      "2.2 Adotar medidas de segurança, técnicas e administrativas aptas a proteger os dados pessoais de acessos não autorizados e de situações acidentais ou ilícitas de destruição, perda, alteração, comunicação ou qualquer forma de tratamento inadequado ou ilícito, em conformidade com o previsto no artigo 46º, §§ 1º e 2º da LGPD.\n" +
      "2.3 Manter o dever de sigilo em relação aos dados pessoais obtidos durante as relações negociais, mesmo após o término do propósito.\n" +
      "2.4 Manter a confidencialidade em relação às operações de Tratamento de Dados Pessoais decorrentes do presente contrato e assegurarão que qualquer pessoa física ou jurídica que elas autorizem a tratar tais dados pessoais esteja sujeita a mesma obrigação de confidencialidade e se comprometam a cumprir as medidas de segurança correspondentes a Lei Geral de Proteção de Dados Pessoais.",
  },
  {
    ordem: 3,
    condicao: null,
    ativa: true,
    texto:
      "O prazo de locação será de {{noites_extenso}} noites com entrada a partir das {{hora_checkin}} horas do dia {{data_checkin}} terminando às {{hora_checkout}} horas do dia {{data_checkout}}, data em que o locatário se obriga a restituir o sítio locado, completamente desocupado e nas condições de entrada.",
  },
  {
    ordem: 4,
    condicao: null,
    ativa: true,
    texto:
      "O aluguel base da temporada correspondente a {{noites_extenso}} noites é no valor de {{valor_total_extenso}}, podendo sofrer acréscimo conforme a cláusula seguinte. O pagamento base será realizado por PIX, chave: {{pix_chave}} ({{pix_titular}}), {{frase_pagamento}}. Eventuais valores adicionais referentes ao excedente de pessoas deverão ser quitados impreterivelmente até o momento do check-in.",
  },
  {
    ordem: 5,
    condicao: "com_evento",
    ativa: true,
    texto:
      "O valor estabelecido neste contrato contempla a presença de até {{pessoas_evento_extenso}} pessoas no imóvel exclusivamente durante a realização do evento, sendo permitida a permanência de até {{pessoas_estadia_extenso}} pessoas nos demais períodos da locação. Em nenhuma hipótese será permitida a entrada ou permanência de número superior ao limite estabelecido para cada período sem prévia autorização do LOCADOR. Caso isso ocorra, poderá ser aplicada cobrança adicional de {{valor_pessoa_excedente_extenso}} por pessoa excedente, por diária, além da possibilidade de rescisão imediata do contrato.\n" +
      "A verificação do número de pessoas poderá ser realizada pelo LOCADOR ou preposto, mediante registros idôneos. Na ausência de aviso prévio e pagamento do acréscimo, a presença de pessoas acima do limite original ou acima do teto de {{pessoas_estadia}} pessoas caracterizará infração contratual, sujeitando o LOCATÁRIO às penalidades previstas (multa e/ou retenção da caução e, se aplicável, rescisão).",
  },
  {
    ordem: 5.5,
    condicao: "sem_evento",
    ativa: true,
    texto:
      "O valor estabelecido neste contrato contempla a permanência de até {{pessoas_estadia_extenso}} pessoas no imóvel durante toda a locação. Em nenhuma hipótese será permitida a entrada ou permanência de número superior a esse limite sem prévia autorização do LOCADOR. Caso isso ocorra, poderá ser aplicada cobrança adicional de {{valor_pessoa_excedente_extenso}} por pessoa excedente, por diária, além da possibilidade de rescisão imediata do contrato.\n" +
      "A verificação do número de pessoas poderá ser realizada pelo LOCADOR ou preposto, mediante registros idôneos. Na ausência de aviso prévio e pagamento do acréscimo, a presença de pessoas acima do limite caracterizará infração contratual, sujeitando o LOCATÁRIO às penalidades previstas (multa e/ou retenção da caução e, se aplicável, rescisão).",
  },
  {
    ordem: 6,
    condicao: null,
    ativa: true,
    texto:
      "O locatário compromete-se a realizar o check-in no horário previamente estipulado pelas partes, com tolerância máxima de 2 (duas) horas após o horário combinado. Caso o locatário não compareça dentro desse prazo, será aplicada uma multa no valor de {{multa_atraso_extenso}}, que deverá ser paga no ato do check-in ou debitada de valores previamente pagos. Caso o locador deseje adiar o horário do check-in, poderá fazê-lo com até 48 (quarenta e oito) horas de antecedência em relação ao horário originalmente estipulado, devendo comunicar o locatário sobre a alteração. No caso de saída antecipada do imóvel, o locatário deverá comunicar o locador com, no mínimo, 1 (um) dia de antecedência. Caso a comunicação não seja realizada dentro deste prazo, não será possível efetuar a saída antecipada, permanecendo o locatário vinculado ao período originalmente contratado.",
  },
  {
    ordem: 7,
    condicao: null,
    ativa: true,
    texto:
      "O locatário deixará um depósito caução de {{caucao_extenso}}, transferido para a conta do locador no horário do check-in no dia {{data_checkin}}; que poderá ser utilizado pelo locador, para ressarcimento de prejuízos causados pelo locatário do sítio ou aos seus bens. Se os prejuízos ultrapassem este valor, a diferença deverá ser paga pelo locatário. Caso não haja o que abater do depósito, o mesmo será devolvido ao locatário após feita a vistoria no último dia da temporada, quando da desocupação do imóvel.",
  },
  {
    ordem: 8,
    condicao: null,
    ativa: true,
    texto:
      "Não é permitida qualquer alteração ou modificação nas disposições do imóvel, que deverá devolver ao locador no perfeito estado em que foi encontrado.",
  },
  {
    ordem: 9,
    condicao: null,
    ativa: true,
    texto:
      "O locatário, assim que ingressar no sítio receberá uma relação de todos os objetos encontrados no mesmo, e de posse desse inventário, conferirá todos os bens junto com o locador e, estando de acordo o assinará, responsabilizando-se totalmente por qualquer dano que venha porventura a causar.",
  },
  {
    ordem: 10,
    condicao: null,
    ativa: true,
    texto:
      "O locatário, desde já, faculta ao locador examinar o imóvel locado, quando este achar necessário.",
  },
  {
    ordem: 11,
    condicao: null,
    ativa: true,
    texto:
      "Em caso de desistência, por iniciativa do LOCATÁRIO, da presente locação de temporada, este deverá pagar ao LOCADOR, a título de indenização, o equivalente a 50% (cinquenta por cento) do valor total da locação.",
  },
  {
    ordem: 12,
    condicao: null,
    ativa: true,
    texto:
      "No último dia da temporada, o locador fará a vistoria no imóvel juntamente com o locatário quando deverão ser devolvidas as chaves.",
  },
  {
    ordem: 13,
    condicao: null,
    ativa: true,
    texto:
      "A sauna e a lareira NÃO estão em condições de funcionamento. Sendo expressamente proibido o uso delas.",
  },
  {
    ordem: 14,
    condicao: "sem_hidromassagem",
    ativa: true,
    texto:
      "A hidromassagem encontra-se em funcionamento, porém seu uso é opcional e somente será permitido mediante contratação adicional, no valor de {{hidro_diaria_extenso}} por diária.\n" +
      "Para fins desta contratação, entende-se por diária cada pernoite, contado do horário de check-in até o horário de check-out do dia seguinte. Assim, o total de diárias corresponde ao número de noites entre as datas contratadas.\n" +
      "O LOCATÁRIO declara que, neste ato, não contratou o uso da hidromassagem. Caso deseje contratar posteriormente (inclusive durante a estadia), poderá fazê-lo a qualquer momento, mediante solicitação ao LOCADOR e pagamento prévio do valor adicional correspondente às diárias restantes, quando então o uso será liberado.",
  },
  {
    ordem: 14.5,
    condicao: "com_hidromassagem",
    ativa: true,
    texto:
      "A hidromassagem encontra-se em funcionamento e seu uso foi CONTRATADO neste ato, no valor de {{hidro_diaria_extenso}} por diária, totalizando {{hidro_total_extenso}} pelas {{noites_extenso}} diárias contratadas.\n" +
      "Para fins desta contratação, entende-se por diária cada pernoite, contado do horário de check-in até o horário de check-out do dia seguinte. Assim, o total de diárias corresponde ao número de noites entre as datas contratadas.\n" +
      "O valor da hidromassagem é adicional ao aluguel base e deverá estar quitado até o momento do check-in, quando então o uso será liberado.",
  },
  {
    ordem: 15,
    condicao: null,
    ativa: true,
    texto:
      "É permitido levar animais de estimação para o imóvel, desde que o locatário se responsabilize integralmente por sua higiene, alimentação e eventuais danos causados pelo pet às instalações, móveis e demais itens da propriedade. O locador não se responsabiliza por qualquer incidente envolvendo os animais no local.",
  },
  {
    ordem: 16,
    condicao: null,
    ativa: true,
    texto:
      "O uso da cascata da piscina será permitido apenas nos seguintes horários: das 9:00 às 12:00 e das 14:00 às 17:00. Fora desses períodos, a cascata deverá permanecer desligada.",
  },
  {
    ordem: 17,
    condicao: null,
    ativa: true,
    texto:
      "O locador não se responsabiliza por eventual falta de energia elétrica de responsabilidade da concessionária CEMIG.",
  },
  {
    ordem: 18,
    condicao: null,
    ativa: true,
    texto:
      "As partes contratantes exigirão, reciprocamente recibos protocolados ou termos de recebimento e entrega, pois todo e qualquer tipo de prova far-se-á por meio de, apenas, de prova documental, inclusive dados digitalizados, internet/e-mail e WhatsApp.",
  },
  {
    ordem: 19,
    condicao: null,
    ativa: true,
    texto:
      "A cascata existente na piscina NÃO pode ser usada como trampolim, pois poderá quebrar a prancha além de causar sérios ferimentos. Caso isso ocorra o locatário assume o valor gasto para o conserto. É terminantemente proibido a utilização de objetos perfurocortantes, tais como: garrafas de vidro, copos de vidro, talheres ao redor da piscina. Sobre os jardins, também não é permitido arrancar ou danificar a vegetação existente.",
  },
  {
    ordem: 20,
    condicao: null,
    ativa: true,
    texto:
      "O locador não se responsabiliza por nenhum item perdido ou esquecido no tempo da hospedagem do locatário.",
  },
  {
    ordem: 21,
    condicao: null,
    ativa: true,
    texto:
      "Ressaltamos que por se tratar de um local extenso e com contato direto com a natureza, podem ser encontrados animais peçonhentos, insetos e afins, ficando o Locador isento de qualquer responsabilidade.",
  },
  {
    ordem: 22,
    condicao: null,
    ativa: true,
    texto:
      "O locatário responderá pelo incêndio do imóvel, salvo se provar que este decorreu de caso fortuito, força maior, curto-circuito não imputável ao locatário ou propagação proveniente de outro imóvel, nos termos do artigo 1.208 e seu parágrafo único do Código Civil.\n" +
      "Fica expressamente vedado ao locatário realizar qualquer intervenção, reparo ou modificação na parte elétrica do imóvel, salvo mediante autorização prévia e por escrito do locador, sob pena de responsabilização por eventuais danos decorrentes.\n" +
      "No caso de incêndio do imóvel locado, ficará o presente contrato rescindido de pleno direito, independentemente de notificação.",
  },
  {
    ordem: 23,
    condicao: null,
    ativa: true,
    texto:
      "Caso o locatário não desocupe o imóvel no dia estipulado no contrato, estará obrigado a pagar as diárias que excederem ao dia fixado a sua saída, no valor de {{diaria_excedente_extenso}} a diária; todos os outros gastos que se fizerem necessários com relação à acomodação das pessoas que ocupariam o imóvel, mas foram impedidas de fazê-lo devido a sua permanência abusiva no mesmo, e se necessário ainda recorrer ao Poder Judiciário para que assim deixe o imóvel, arcará com o pagamento das despesas e custas judiciais, assim como honorários advocatícios na base de 20% sob o valor do débito.",
  },
  {
    ordem: 24,
    condicao: null,
    ativa: true,
    texto:
      "O LOCADOR não se responsabiliza por quaisquer acidentes, lesões, ferimentos ou danos físicos que venham a ocorrer com o LOCATÁRIO, seus acompanhantes ou terceiros, em decorrência do uso das instalações do imóvel, incluindo piscina, escadas, áreas externas, jardim ou quaisquer áreas comuns.\n" +
      "Também não será o LOCADOR responsável por quaisquer danos materiais, perdas, extravios ou furtos de pertences pessoais ocorridos durante o período da locação.\n" +
      "O LOCATÁRIO declara estar ciente dos riscos naturais e estruturais do imóvel e se compromete a utilizar o espaço com cautela, assumindo total responsabilidade pela sua segurança e pela de seus convidados.",
  },
  {
    ordem: 25,
    condicao: null,
    ativa: true,
    texto:
      "É proibido o consumo de bebidas alcoólicas por menores de 18 anos, e expressamente proibido portar ou usar drogas ilícitas nas dependências do imóvel; o locador não tem qualquer responsabilidade sobre os eventuais acontecimentos ou gravames que possam ocorrer devido a qualquer tipo de práticas ilícitas praticadas pelo locatário. Nestes casos em que houver comunicação de fato ou conduta, o Sítio Estâncias Feliz deverá ser desocupado imediatamente (e, se preciso for, com a ajuda da polícia), sem quaisquer ônus para o locador, ficando somente o locatário responsabilizado por responder criminalmente pelos fatos ocorridos sob sua responsabilidade.",
  },
  {
    ordem: 26,
    condicao: null,
    ativa: true,
    texto:
      "O(a) LOCATÁRIO(a)/HÓSPEDE compromete-se a realizar, antes do horário de check-out, a limpeza completa de todas as vasilhas, panelas e demais utensílios utilizados, deixando-os devidamente lavados e limpos, bem como retirar todo o lixo do interior do imóvel e deixá-lo do lado de fora da casa, no local indicado para coleta.\n" +
      "O não cumprimento, até o horário do check-out, de qualquer uma dessas obrigações (utensílios sujos e/ou lixo não retirado e colocado do lado de fora) acarretará multa de {{multa_limpeza_extenso}}, autorizando o(a) LOCADOR(a) a efetuar a cobrança correspondente.",
  },
  {
    ordem: 27,
    condicao: null,
    ativa: true,
    texto:
      "O LOCATÁRIO não poderá sublocar, ceder ou transferir, no todo ou em parte, o uso do imóvel objeto deste contrato a terceiros, a qualquer título, sem a prévia e expressa autorização, por escrito, do LOCADOR.",
  },
  {
    ordem: 28,
    condicao: null,
    ativa: true,
    texto:
      "Não cumpridas quaisquer das cláusulas deste contrato, fica o LOCADOR autorizado a tomar posse do referido imóvel, independentemente do término deste contrato e de procedimento judicial.",
  },
  {
    ordem: 29,
    condicao: null,
    ativa: true,
    texto:
      "As partes contratantes elegem o Foro da cidade de {{cidade_foro}} para dirimir quaisquer ações que se originarem do presente contrato, renunciando aos de seus domicílios futuros.",
  },
  {
    ordem: 30,
    condicao: null,
    ativa: true,
    texto:
      "E por estarem justos e contratados, assim o presente em duas vias de igual teor e forma, que leram e acharam conforme, na presença das testemunhas, também abaixo assinadas.",
  },
];

// ============================================================
//  Montagem
// ============================================================

/** Quantas noites o período contratado tem. */
export function noites(d: Pick<DadosContrato, "checkin" | "checkout">): number {
  if (!d.checkin || !d.checkout) return 0;
  return Math.max(0, diffDias(d.checkin, d.checkout));
}

/** Há evento quando o teto durante o evento é maior que o da estadia. */
export function temEvento(d: Pick<DadosContrato, "pessoasEvento" | "pessoasEstadia">): boolean {
  return d.pessoasEvento > 0 && d.pessoasEvento > d.pessoasEstadia;
}

/**
 * "dividido em 3 pagamentos: o primeiro no valor de R$ 1.266,00 no dia
 * 15/08/2026, o segundo ... e o terceiro ...".
 *
 * É a frase que mais dava trabalho de escrever à mão, e a que mais
 * aparecia com data ou valor trocado.
 */
export function frasePagamento(parcelas: Parcela[]): string {
  if (parcelas.length === 0) {
    return "em pagamento a ser combinado entre as partes";
  }
  if (parcelas.length === 1) {
    const p = parcelas[0];
    return `em pagamento único no valor de ${valorPorExtenso(p.valor)} no dia ${formatarDataBR(p.data)}`;
  }
  const itens = parcelas.map(
    (p, i) =>
      `o ${ordinal(i)} no valor de ${dinheiro(p.valor)} no dia ${formatarDataBR(p.data)}`,
  );
  const cabeca = itens.slice(0, -1).join(", ");
  return `dividido em ${parcelas.length} pagamentos: ${cabeca} e ${itens[itens.length - 1]}`;
}

/** Tudo que uma `{{variavel}}` pode virar. */
export function variaveis(d: DadosContrato): Record<string, string> {
  const n = noites(d);
  const hidroTotal = d.hidromassagem ? d.hidromassagemDiaria * n : 0;

  return {
    locatario_nome: d.locatarioNome,
    locatario_cpf: d.locatarioCpf,
    locatario_endereco: d.locatarioEndereco,
    locatario_telefone: d.locatarioTelefone,

    locador_nome: LOCADOR.nomeEmpresarial,
    locador_cnpj: LOCADOR.cnpj,
    locador_endereco: LOCADOR.endereco,
    locador_telefone: LOCADOR.telefone,
    locador_admin: LOCADOR.administrador,
    locador_cpf: LOCADOR.cpf,
    imovel_nome: IMOVEL.nome,
    imovel_endereco: IMOVEL.endereco,

    data_checkin: formatarDataBR(d.checkin),
    data_checkout: formatarDataBR(d.checkout),
    hora_checkin: d.horaCheckin,
    hora_checkout: d.horaCheckout,
    noites: String(n),
    noites_extenso: quantidadePorExtenso(n, "f"),

    pessoas_estadia: String(d.pessoasEstadia),
    pessoas_estadia_extenso: quantidadePorExtenso(d.pessoasEstadia, "f"),
    pessoas_evento: String(d.pessoasEvento),
    pessoas_evento_extenso: quantidadePorExtenso(d.pessoasEvento, "f"),

    valor_total: dinheiro(d.valorTotal),
    valor_total_extenso: valorPorExtenso(d.valorTotal),
    frase_pagamento: frasePagamento(d.parcelas),
    qtd_parcelas: String(d.parcelas.length),
    pix_chave: d.pixChave,
    pix_titular: d.pixTitular,

    caucao: dinheiro(d.caucao),
    caucao_extenso: valorPorExtenso(d.caucao),
    hidro_diaria: dinheiro(d.hidromassagemDiaria),
    hidro_diaria_extenso: valorPorExtenso(d.hidromassagemDiaria),
    hidro_total_extenso: valorPorExtenso(hidroTotal),
    valor_pessoa_excedente: dinheiro(d.valorPessoaExcedente),
    valor_pessoa_excedente_extenso: valorPorExtenso(d.valorPessoaExcedente),
    diaria_excedente_extenso: valorPorExtenso(d.valorDiariaExcedente),
    multa_atraso_extenso: valorPorExtenso(d.multaAtrasoCheckin),
    multa_limpeza_extenso: valorPorExtenso(d.multaLimpeza),

    cidade_foro: d.cidadeForo,
    data_assinatura: dataPorExtenso(d.dataAssinatura),
  };
}

/** Uma condição é satisfeita? Chave desconhecida sempre entra — ver CONDICOES. */
export function condicaoAtendida(condicao: string | null, d: DadosContrato): boolean {
  switch (condicao) {
    case null:
    case undefined:
    case "":
      return true;
    case "com_hidromassagem":
      return d.hidromassagem;
    case "sem_hidromassagem":
      return !d.hidromassagem;
    case "com_evento":
      return temEvento(d);
    case "sem_evento":
      return !temEvento(d);
    case "parcelado":
      return d.parcelas.length > 1;
    default:
      return true;
  }
}

const PADRAO_VARIAVEL = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

/** Troca `{{x}}` pelo valor. O que não conhecer, devolve na lista `faltando`. */
export function substituir(
  texto: string,
  vars: Record<string, string>,
): { texto: string; faltando: string[] } {
  const faltando: string[] = [];
  const saida = texto.replace(PADRAO_VARIAVEL, (_todo, nome: string) => {
    const chave = nome.toLowerCase();
    const valor = vars[chave];
    if (valor === undefined || valor === "") {
      if (!faltando.includes(chave)) faltando.push(chave);
      // Deixa a marca visível no documento: um buraco em branco no meio
      // de um contrato passa despercebido, "{{cpf}}" não passa.
      return `{{${chave}}}`;
    }
    return valor;
  });
  return { texto: saida, faltando };
}

/**
 * O contrato pronto para ler: cláusulas filtradas pela condição,
 * variáveis substituídas e numeração recontada do 1.
 */
export function montarClausulas(
  clausulas: Clausula[],
  d: DadosContrato,
): ClausulaMontada[] {
  const vars = variaveis(d);
  return clausulas
    .filter((c) => c.ativa !== false)
    .filter((c) => condicaoAtendida(c.condicao, d))
    .sort((a, b) => a.ordem - b.ordem)
    .map((c, i) => {
      const { texto, faltando } = substituir(c.texto, vars);
      return { numero: i + 1, texto, faltando };
    });
}

/** Todo `{{buraco}}` que sobrou no contrato inteiro. Vazio é o esperado. */
export function buracos(clausulas: Clausula[], d: DadosContrato): string[] {
  const todos = montarClausulas(clausulas, d).flatMap((c) => c.faltando);
  return [...new Set(todos)];
}

// ============================================================
//  Parcelas
// ============================================================

/**
 * Divide o total em n parcelas iguais, com os centavos que sobram indo
 * para as ÚLTIMAS — foi assim no contrato de 3 parcelas de R$ 3.800:
 * 1.266,00 / 1.267,00 / 1.267,00. O primeiro pagamento é o que a pessoa
 * faz na hora de fechar, e é o que menos deve surpreender.
 *
 * As datas ficam mensais a partir da primeira, e nunca passam do
 * check-in: a última parcela cai no dia da entrada se o prazo apertar.
 */
export function parcelasIguais(
  total: number,
  quantidade: number,
  primeiraData: string,
  checkin: string,
): Parcela[] {
  if (quantidade < 1 || total <= 0) return [];

  const centavos = Math.round(total * 100);
  const base = Math.floor(centavos / quantidade);
  const sobra = centavos - base * quantidade;

  const parcelas: Parcela[] = [];
  for (let i = 0; i < quantidade; i++) {
    // A sobra vai para as últimas parcelas, uma a uma.
    const extra = i >= quantidade - sobra ? 1 : 0;
    parcelas.push({
      valor: (base + extra) / 100,
      data: dataDaParcela(primeiraData, i, checkin),
    });
  }
  return parcelas;
}

/**
 * Sinal de X% agora, o restante no dia da entrada — o formato do último
 * contrato (20% de sinal, 80% no check-in).
 */
export function parcelasComSinal(
  total: number,
  percentualSinal: number,
  dataSinal: string,
  checkin: string,
): Parcela[] {
  if (total <= 0) return [];
  const sinal = Math.round(total * (percentualSinal / 100) * 100) / 100;
  const resto = Math.round((total - sinal) * 100) / 100;
  if (resto <= 0) return [{ valor: total, data: dataSinal }];
  return [
    { valor: sinal, data: dataSinal },
    { valor: resto, data: checkin },
  ];
}

function dataDaParcela(primeira: string, indice: number, checkin: string): string {
  if (!primeira) return "";
  if (indice === 0) return primeira;
  const [ano, mes, dia] = primeira.split("-").map(Number);
  // Mês a mês. `setMonth` já normaliza 31 de janeiro + 1 mês.
  const d = new Date(ano, mes - 1 + indice, dia);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  // Ninguém paga depois de já ter usado o sítio.
  return checkin && iso > checkin ? checkin : iso;
}

/** Soma das parcelas — o painel avisa quando não bate com o total. */
export function somaParcelas(parcelas: Parcela[]): number {
  return Math.round(parcelas.reduce((s, p) => s + p.valor, 0) * 100) / 100;
}

// ============================================================
//  Texto corrido
//
//  Para copiar e colar no WhatsApp quando o PDF é exagero, e para o
//  teste conseguir olhar o contrato inteiro de uma vez.
// ============================================================

export function textoDoContrato(clausulas: Clausula[], d: DadosContrato): string {
  const vars = variaveis(d);
  const linhas: string[] = [
    `CONTRATO DE LOCAÇÃO DO ${IMOVEL.nome.toUpperCase()}`,
    "",
    PREAMBULO,
    "",
    `IMÓVEL: ${IMOVEL.nome}, localizado na ${IMOVEL.endereco}, coordenadas geográficas Latitude ${IMOVEL.latitude}, Longitude ${IMOVEL.longitude}, município de ${IMOVEL.municipio}.`,
    "",
    "LOCADOR:",
    `Nome Empresarial: ${LOCADOR.nomeEmpresarial}`,
    `CNPJ: ${LOCADOR.cnpj}`,
    `Endereço: ${LOCADOR.endereco}`,
    `Telefone: ${LOCADOR.telefone}`,
    `Administrador: ${LOCADOR.administrador} (CPF: ${LOCADOR.cpf})`,
    "",
    "DADOS DO LOCATÁRIO:",
    `Nome: ${vars.locatario_nome}`,
    `CPF: ${vars.locatario_cpf}`,
    `Endereço: ${vars.locatario_endereco}`,
    `Telefone: ${vars.locatario_telefone}`,
    "",
    ABERTURA_CLAUSULAS,
    "",
  ];

  for (const c of montarClausulas(clausulas, d)) {
    linhas.push(`Cláusula ${c.numero}º`, c.texto, "");
  }

  linhas.push(
    `${IMOVEL.municipio}, ${dataPorExtenso(d.dataAssinatura)}`,
    "",
    "",
    "Administrador Locador: ________________________________________",
    `                       ${LOCADOR.administrador}`,
    "",
    "",
    "Locatário: ____________________________________________________",
    `           ${d.locatarioNome}`,
  );

  return linhas.join("\n");
}

// ============================================================
//  Da reserva para o contrato
//
//  Mora aqui, e não em `contratos.ts`, porque o formulário do painel
//  preenche no NAVEGADOR: importar de lá arrastaria o cliente do
//  Supabase (e a service role key) para dentro do bundle. Por isso o
//  parâmetro é um tipo estrutural, não o `Reserva` do banco — a forma
//  bate, e o módulo continua sem conhecer banco nenhum.
// ============================================================

export type ReservaResumo = {
  nome_cliente?: string | null;
  telefone?: string | null;
  data_checkin?: string | null;
  data_checkout?: string | null;
  qtd_pessoas?: number | null;
  valor_final?: string | number | null;
};

/**
 * Preenche o contrato com o que a reserva já sabe.
 *
 * O que a reserva NÃO sabe fica em branco de propósito: CPF e endereço
 * ninguém pergunta no WhatsApp, e chutar horário de check-in aqui seria
 * repetir o erro que tiramos dos avisos automáticos — o horário é
 * combinado caso a caso, e o padrão só vale até alguém combinar outro.
 */
export function dadosDaReserva(r: ReservaResumo): DadosContrato {
  const pessoas = Number(r.qtd_pessoas) || PADROES.pessoasEstadia;
  const valor = Number(r.valor_final) || 0;

  return {
    locatarioNome: r.nome_cliente ?? "",
    locatarioCpf: "",
    locatarioEndereco: "",
    locatarioTelefone: formatarTelefone(r.telefone ?? ""),

    checkin: (r.data_checkin ?? "").slice(0, 10),
    checkout: (r.data_checkout ?? "").slice(0, 10),
    horaCheckin: PADROES.horaCheckin,
    horaCheckout: PADROES.horaCheckout,

    // Mais gente do que cabe dormindo = tem evento, e o teto maior é o
    // do evento. É a leitura que a cláusula do limite de pessoas faz.
    pessoasEstadia: Math.min(pessoas, PADROES.pessoasEstadia),
    pessoasEvento: pessoas > PADROES.pessoasEstadia ? pessoas : 0,

    valorTotal: valor,
    parcelas: [],
    pixChave: PADROES.pixChave,
    pixTitular: PADROES.pixTitular,

    caucao: PADROES.caucao,
    hidromassagem: PADROES.hidromassagem,
    hidromassagemDiaria: PADROES.hidromassagemDiaria,
    valorPessoaExcedente: PADROES.valorPessoaExcedente,
    valorDiariaExcedente: PADROES.valorDiariaExcedente,
    multaAtrasoCheckin: PADROES.multaAtrasoCheckin,
    multaLimpeza: PADROES.multaLimpeza,

    cidadeForo: PADROES.cidadeForo,
    dataAssinatura: "",
  };
}

/** "5531983321065" → "(31) 98332-1065", como o contrato sempre escreveu. */
export function formatarTelefone(bruto: string): string {
  const so = bruto.replace(/\D/g, "");
  const semPais = so.startsWith("55") && so.length > 11 ? so.slice(2) : so;
  if (semPais.length === 11) {
    return `(${semPais.slice(0, 2)}) ${semPais.slice(2, 7)}-${semPais.slice(7)}`;
  }
  if (semPais.length === 10) {
    return `(${semPais.slice(0, 2)}) ${semPais.slice(2, 6)}-${semPais.slice(6)}`;
  }
  return bruto;
}

// ============================================================
//  O catálogo de variáveis
//
//  Existe para a tela de edição do modelo poder listar o que se pode
//  escrever entre chaves. Um teste confere que este catálogo e o que
//  `variaveis()` realmente produz são o mesmo conjunto — catálogo que
//  promete uma variável inexistente vira {{buraco}} no contrato.
// ============================================================

export const VARIAVEIS_DISPONIVEIS: { chave: string; descricao: string }[] = [
  { chave: "locatario_nome", descricao: "nome de quem aluga" },
  { chave: "locatario_cpf", descricao: "CPF de quem aluga" },
  { chave: "locatario_endereco", descricao: "endereço de quem aluga" },
  { chave: "locatario_telefone", descricao: "telefone de quem aluga" },
  { chave: "locador_nome", descricao: "razão social do locador" },
  { chave: "locador_cnpj", descricao: "CNPJ do locador" },
  { chave: "locador_endereco", descricao: "endereço do locador" },
  { chave: "locador_telefone", descricao: "telefone do locador" },
  { chave: "locador_admin", descricao: "nome do administrador" },
  { chave: "locador_cpf", descricao: "CPF do administrador" },
  { chave: "imovel_nome", descricao: "nome do sítio" },
  { chave: "imovel_endereco", descricao: "endereço do sítio" },
  { chave: "data_checkin", descricao: "data de entrada (11/09/2026)" },
  { chave: "data_checkout", descricao: "data de saída" },
  { chave: "hora_checkin", descricao: "hora de entrada (05:00)" },
  { chave: "hora_checkout", descricao: "hora de saída" },
  { chave: "noites", descricao: "número de noites (2)" },
  { chave: "noites_extenso", descricao: "noites por extenso (2 (duas))" },
  { chave: "pessoas_estadia", descricao: "teto de gente dormindo (30)" },
  { chave: "pessoas_estadia_extenso", descricao: "o mesmo por extenso" },
  { chave: "pessoas_evento", descricao: "teto de gente no evento (50)" },
  { chave: "pessoas_evento_extenso", descricao: "o mesmo por extenso" },
  { chave: "valor_total", descricao: "valor do aluguel (R$ 3.900,00)" },
  { chave: "valor_total_extenso", descricao: "valor + extenso entre parênteses" },
  { chave: "frase_pagamento", descricao: "a frase inteira das parcelas" },
  { chave: "qtd_parcelas", descricao: "quantas parcelas" },
  { chave: "pix_chave", descricao: "chave PIX" },
  { chave: "pix_titular", descricao: "titular da chave PIX" },
  { chave: "caucao", descricao: "valor da caução" },
  { chave: "caucao_extenso", descricao: "caução + extenso" },
  { chave: "hidro_diaria", descricao: "diária da hidromassagem" },
  { chave: "hidro_diaria_extenso", descricao: "diária da hidro + extenso" },
  { chave: "hidro_total_extenso", descricao: "hidro × noites + extenso" },
  { chave: "valor_pessoa_excedente", descricao: "cobrança por pessoa a mais" },
  { chave: "valor_pessoa_excedente_extenso", descricao: "o mesmo + extenso" },
  { chave: "diaria_excedente_extenso", descricao: "diária por atrasar a saída" },
  { chave: "multa_atraso_extenso", descricao: "multa por atrasar a entrada" },
  { chave: "multa_limpeza_extenso", descricao: "multa de limpeza" },
  { chave: "cidade_foro", descricao: "cidade do foro" },
  { chave: "data_assinatura", descricao: "data da assinatura por extenso" },
];
