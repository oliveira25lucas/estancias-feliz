import test from "node:test";
import assert from "node:assert/strict";
import {
  CLAUSULAS_BASE,
  VARIAVEIS_DISPONIVEIS,
  buracos,
  dadosDaReserva,
  dataPorExtenso,
  formatarTelefone,
  frasePagamento,
  montarClausulas,
  noites,
  parcelasComSinal,
  parcelasIguais,
  porExtenso,
  quantidadePorExtenso,
  reaisPorExtenso,
  somaParcelas,
  temEvento,
  textoDoContrato,
  valorPorExtenso,
  variaveis,
  type Clausula,
  type DadosContrato,
} from "./contrato.ts";

/**
 * O contrato real assinado em 24/08/2026. Os testes abaixo reproduzem
 * frases dele palavra por palavra: se o gerador escrever diferente do
 * documento que já foi para o cliente, o teste cai.
 */
const ROBERTA: DadosContrato = {
  locatarioNome: "Roberta Tereza Antônia Rodrigues Correia",
  locatarioCpf: "160.762.116-95",
  locatarioEndereco:
    "Al. dos Coqueiros, 41 - 402 - Res. Masterville; Sarzedo - MG, 32450-000",
  locatarioTelefone: "(31) 98332-1065",
  checkin: "2026-09-11",
  checkout: "2026-09-13",
  horaCheckin: "05:00",
  horaCheckout: "16:00",
  pessoasEstadia: 30,
  pessoasEvento: 50,
  valorTotal: 3900,
  parcelas: [
    { valor: 780, data: "2026-08-25" },
    { valor: 3120, data: "2026-09-11" },
  ],
  pixChave: "estanciaseliane@gmail.com",
  pixTitular: "Maria Susana - Banco Nubank",
  caucao: 500,
  hidromassagem: false,
  hidromassagemDiaria: 150,
  valorPessoaExcedente: 150,
  valorDiariaExcedente: 1500,
  multaAtrasoCheckin: 100,
  multaLimpeza: 150,
  cidadeForo: "Belo Horizonte",
  dataAssinatura: "2026-08-24",
};

// ============================================================
//  Números por extenso
// ============================================================

test("os valores dos contratos reais saem escritos como nos contratos", () => {
  // Contrato da Roberta e do Diego, respectivamente.
  assert.equal(porExtenso(3900), "três mil e novecentos");
  assert.equal(porExtenso(3800), "três mil e oitocentos");
  // Aparecem nas cláusulas fixas.
  assert.equal(porExtenso(150), "cento e cinquenta");
  assert.equal(porExtenso(500), "quinhentos");
  assert.equal(porExtenso(1500), "mil e quinhentos");
  assert.equal(porExtenso(100), "cem");
  // Parcelas.
  assert.equal(porExtenso(780), "setecentos e oitenta");
  assert.equal(porExtenso(3120), "três mil cento e vinte");
});

test("cem é cem só quando é exatamente cem", () => {
  assert.equal(porExtenso(100), "cem");
  assert.equal(porExtenso(101), "cento e um");
  assert.equal(porExtenso(110), "cento e dez");
  assert.equal(porExtenso(199), "cento e noventa e nove");
});

test("mil é mil, nunca um mil", () => {
  assert.equal(porExtenso(1000), "mil");
  assert.equal(porExtenso(2000), "dois mil");
  assert.equal(porExtenso(1266), "mil duzentos e sessenta e seis");
});

test('o "e" entre grupos só entra quando a língua pede', () => {
  // Último grupo abaixo de cem, ou centena redonda: entra "e".
  assert.equal(porExtenso(2050), "dois mil e cinquenta");
  assert.equal(porExtenso(2300), "dois mil e trezentos");
  // Último grupo com centena quebrada: não entra.
  assert.equal(porExtenso(2350), "dois mil trezentos e cinquenta");
});

test("noites e pessoas saem no feminino", () => {
  assert.equal(porExtenso(1, "f"), "uma");
  assert.equal(porExtenso(2, "f"), "duas");
  assert.equal(porExtenso(2), "dois");
  assert.equal(quantidadePorExtenso(2, "f"), "2 (duas)");
  assert.equal(quantidadePorExtenso(30, "f"), "30 (trinta)");
  assert.equal(quantidadePorExtenso(50, "f"), "50 (cinquenta)");
});

test("reais e centavos", () => {
  assert.equal(reaisPorExtenso(3900), "três mil e novecentos reais");
  assert.equal(reaisPorExtenso(1), "um real");
  assert.equal(reaisPorExtenso(1266.5), "mil duzentos e sessenta e seis reais e cinquenta centavos");
  assert.equal(reaisPorExtenso(0.99), "noventa e nove centavos");
  assert.equal(reaisPorExtenso(0), "zero reais");
});

test("o par número + extenso é o que vai no contrato", () => {
  assert.equal(
    valorPorExtenso(3900),
    "R$ 3.900,00 (três mil e novecentos reais)",
  );
});

test("a data de assinatura sai como sempre saiu", () => {
  assert.equal(dataPorExtenso("2026-08-24"), "24 de Agosto de 2026");
  assert.equal(dataPorExtenso("2026-12-01"), "1 de Dezembro de 2026");
});

// ============================================================
//  Pagamento
// ============================================================

test("a frase de pagamento reproduz o contrato de duas parcelas", () => {
  assert.equal(
    frasePagamento(ROBERTA.parcelas),
    "dividido em 2 pagamentos: o primeiro no valor de R$ 780,00 no dia 25/08/2026 e o segundo no valor de R$ 3.120,00 no dia 11/09/2026",
  );
});

test("três parcelas ligam as duas primeiras por vírgula e a última por e", () => {
  const frase = frasePagamento([
    { valor: 1266, data: "2026-08-15" },
    { valor: 1267, data: "2026-09-15" },
    { valor: 1267, data: "2026-10-15" },
  ]);
  assert.match(frase, /^dividido em 3 pagamentos: o primeiro/);
  assert.match(frase, /15\/08\/2026, o segundo/);
  assert.match(frase, / e o terceiro no valor de R\$ 1\.267,00 no dia 15\/10\/2026$/);
});

test("pagamento único não vira lista", () => {
  const frase = frasePagamento([{ valor: 2000, data: "2026-05-10" }]);
  assert.match(frase, /^em pagamento único/);
  assert.doesNotMatch(frase, /primeiro/);
});

test("parcela nenhuma não inventa valor", () => {
  assert.match(frasePagamento([]), /a ser combinado entre as partes/);
});

// ============================================================
//  Divisão em parcelas
// ============================================================

test("a sobra de centavos vai para as últimas parcelas", () => {
  // Foi exatamente assim no contrato de R$ 3.800 em 3 vezes.
  const p = parcelasIguais(3800, 3, "2026-08-15", "2026-10-23");
  assert.deepEqual(
    p.map((x) => x.valor),
    [1266.66, 1266.67, 1266.67],
  );
  assert.equal(somaParcelas(p), 3800);
});

test("dividir nunca perde nem cria centavo", () => {
  for (const total of [3900, 3800, 2350, 10, 0.03, 7777.77]) {
    for (const n of [1, 2, 3, 4, 5, 7, 12]) {
      const p = parcelasIguais(total, n, "2026-01-31", "2027-12-31");
      assert.equal(somaParcelas(p), total, `${total} em ${n}x`);
    }
  }
});

test("as datas das parcelas andam de mês em mês e param no check-in", () => {
  const p = parcelasIguais(3000, 3, "2026-08-15", "2026-10-23");
  assert.deepEqual(
    p.map((x) => x.data),
    ["2026-08-15", "2026-09-15", "2026-10-15"],
  );
  // Prazo apertado: a última cai no dia da entrada, não depois dela.
  const curto = parcelasIguais(3000, 3, "2026-08-15", "2026-09-20");
  assert.equal(curto[2].data, "2026-09-20");
});

test("o sinal de 20% reproduz o contrato da Roberta", () => {
  const p = parcelasComSinal(3900, 20, "2026-08-25", "2026-09-11");
  assert.deepEqual(p, [
    { valor: 780, data: "2026-08-25" },
    { valor: 3120, data: "2026-09-11" },
  ]);
});

// ============================================================
//  Montagem das cláusulas
// ============================================================

test("a cláusula do prazo reproduz o contrato assinado", () => {
  const c = montarClausulas(CLAUSULAS_BASE, ROBERTA);
  const prazo = c.find((x) => x.texto.startsWith("O prazo de locação"));
  assert.equal(
    prazo?.texto,
    "O prazo de locação será de 2 (duas) noites com entrada a partir das 05:00 horas do dia 11/09/2026 terminando às 16:00 horas do dia 13/09/2026, data em que o locatário se obriga a restituir o sítio locado, completamente desocupado e nas condições de entrada.",
  );
});

test("a cláusula do aluguel reproduz o contrato assinado", () => {
  const c = montarClausulas(CLAUSULAS_BASE, ROBERTA);
  const aluguel = c.find((x) => x.texto.startsWith("O aluguel base"));
  assert.match(
    aluguel?.texto ?? "",
    /^O aluguel base da temporada correspondente a 2 \(duas\) noites é no valor de R\$ 3\.900,00 \(três mil e novecentos reais\)/,
  );
  assert.match(
    aluguel?.texto ?? "",
    /chave: estanciaseliane@gmail\.com \(Maria Susana - Banco Nubank\), dividido em 2 pagamentos/,
  );
});

test("a numeração é recontada, nunca deixa buraco", () => {
  const c = montarClausulas(CLAUSULAS_BASE, ROBERTA);
  assert.deepEqual(
    c.map((x) => x.numero),
    c.map((_, i) => i + 1),
  );
});

test("tirar uma cláusula não abre buraco na numeração", () => {
  const semPet: Clausula[] = CLAUSULAS_BASE.map((c) =>
    c.texto.startsWith("É permitido levar animais") ? { ...c, ativa: false } : c,
  );
  const completo = montarClausulas(CLAUSULAS_BASE, ROBERTA);
  const cortado = montarClausulas(semPet, ROBERTA);

  assert.equal(cortado.length, completo.length - 1);
  assert.deepEqual(
    cortado.map((x) => x.numero),
    cortado.map((_, i) => i + 1),
  );
  assert.ok(!cortado.some((x) => x.texto.startsWith("É permitido levar animais")));
});

test("as duas versões da hidromassagem nunca aparecem juntas", () => {
  const sem = montarClausulas(CLAUSULAS_BASE, ROBERTA);
  const com = montarClausulas(CLAUSULAS_BASE, { ...ROBERTA, hidromassagem: true });

  const hidro = (lista: { texto: string }[]) =>
    lista.filter((x) => x.texto.includes("A hidromassagem encontra-se"));

  assert.equal(hidro(sem).length, 1);
  assert.equal(hidro(com).length, 1);
  assert.match(hidro(sem)[0].texto, /não contratou o uso da hidromassagem/);
  assert.match(hidro(com)[0].texto, /foi CONTRATADO neste ato/);
  // 2 diárias a R$ 150 = R$ 300.
  assert.match(hidro(com)[0].texto, /R\$ 300,00 \(trezentos reais\)/);
});

test("sem evento, o teto de gente vira um número só", () => {
  const semEvento = { ...ROBERTA, pessoasEvento: 0 };
  assert.equal(temEvento(ROBERTA), true);
  assert.equal(temEvento(semEvento), false);

  const c = montarClausulas(CLAUSULAS_BASE, semEvento);
  const teto = c.filter((x) => x.texto.includes("O valor estabelecido neste contrato"));
  assert.equal(teto.length, 1);
  assert.doesNotMatch(teto[0].texto, /durante a realização do evento/);
  assert.match(teto[0].texto, /até 30 \(trinta\) pessoas/);
});

test("noites é a diferença entre as datas", () => {
  assert.equal(noites(ROBERTA), 2);
  assert.equal(noites({ checkin: "2026-10-23", checkout: "2026-10-25" }), 2);
  assert.equal(noites({ checkin: "", checkout: "" }), 0);
});

// ============================================================
//  Buracos
//
//  Um contrato com campo vazio não pode sair calado. O buraco fica
//  visível no documento E listado para o painel avisar antes de imprimir.
// ============================================================

test("contrato completo não deixa buraco", () => {
  assert.deepEqual(buracos(CLAUSULAS_BASE, ROBERTA), []);
  assert.ok(!textoDoContrato(CLAUSULAS_BASE, ROBERTA).includes("{{"));
});

test("campo vazio aparece como marca visível, não como espaço em branco", () => {
  const semPix = { ...ROBERTA, pixChave: "" };
  assert.deepEqual(buracos(CLAUSULAS_BASE, semPix), ["pix_chave"]);

  const aluguel = montarClausulas(CLAUSULAS_BASE, semPix).find((x) =>
    x.texto.startsWith("O aluguel base"),
  );
  assert.match(aluguel?.texto ?? "", /\{\{pix_chave\}\}/);
});

test("variável que ninguém conhece não some do texto", () => {
  const inventada: Clausula[] = [
    { ordem: 1, condicao: null, ativa: true, texto: "Vale {{coisa_que_nao_existe}}." },
  ];
  const c = montarClausulas(inventada, ROBERTA);
  assert.equal(c[0].texto, "Vale {{coisa_que_nao_existe}}.");
  assert.deepEqual(c[0].faltando, ["coisa_que_nao_existe"]);
});

test("condição desconhecida mantém a cláusula no contrato", () => {
  // Errar para o lado do excesso: cláusula a mais se discute, cláusula
  // que sumiu sozinha ninguém percebe.
  const estranha: Clausula[] = [
    { ordem: 1, condicao: "lua_cheia", ativa: true, texto: "Cláusula qualquer." },
  ];
  assert.equal(montarClausulas(estranha, ROBERTA).length, 1);
});

// ============================================================
//  Documento inteiro
// ============================================================

test("o texto corrido traz as partes, as cláusulas e a assinatura", () => {
  const t = textoDoContrato(CLAUSULAS_BASE, ROBERTA);

  assert.match(t, /Nome: Roberta Tereza Antônia Rodrigues Correia/);
  assert.match(t, /CPF: 160\.762\.116-95/);
  assert.match(t, /CNPJ: 58\.659\.960\/0001-48/);
  assert.match(t, /^Cláusula 1º$/m);
  assert.match(t, /Sarzedo, 24 de Agosto de 2026/);
  assert.match(t, /Lucas Almeida Oliveira/);
});

test("o contrato-base não tem cláusula repetida nem ordem duplicada", () => {
  const ordens = CLAUSULAS_BASE.map((c) => c.ordem);
  assert.equal(new Set(ordens).size, ordens.length, "ordem duplicada");

  const textos = CLAUSULAS_BASE.map((c) => c.texto);
  assert.equal(new Set(textos).size, textos.length, "cláusula repetida");
});

test("nenhuma cláusula-base cita um número de cláusula fixo", () => {
  // A numeração é recontada a cada contrato: "conforme a Cláusula 5º"
  // vira mentira assim que alguém desliga uma cláusula acima dela.
  for (const c of CLAUSULAS_BASE) {
    assert.doesNotMatch(
      c.texto,
      /[Cc]láusula\s+\d/,
      `a cláusula ${c.ordem} aponta para outra pelo número`,
    );
  }
});

// ============================================================
//  Catálogo de variáveis
// ============================================================

test("o catálogo de variáveis bate com o que o contrato sabe preencher", () => {
  // Um catálogo que promete {{coisa}} inexistente vira buraco visível no
  // contrato; uma variável usada nas cláusulas e ausente do catálogo
  // some da tela de edição do modelo. Os dois lados têm que ser o mesmo
  // conjunto.
  const catalogo = new Set(VARIAVEIS_DISPONIVEIS.map((v) => v.chave));
  const reais = new Set(Object.keys(variaveis(ROBERTA)));

  assert.deepEqual(
    [...catalogo].filter((c) => !reais.has(c)),
    [],
    "o catálogo promete variável que não existe",
  );
  assert.deepEqual(
    [...reais].filter((c) => !catalogo.has(c)),
    [],
    "existe variável fora do catálogo",
  );
});

test("toda {{variavel}} usada nas cláusulas-base existe de verdade", () => {
  const conhecidas = new Set(Object.keys(variaveis(ROBERTA)));
  for (const c of CLAUSULAS_BASE) {
    for (const achado of c.texto.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)) {
      assert.ok(
        conhecidas.has(achado[1].toLowerCase()),
        `a cláusula ${c.ordem} usa {{${achado[1]}}}, que ninguém preenche`,
      );
    }
  }
});

// ============================================================
//  Da reserva para o contrato
// ============================================================

test("o telefone sai no formato que o contrato sempre usou", () => {
  assert.equal(formatarTelefone("5531983321065"), "(31) 98332-1065");
  assert.equal(formatarTelefone("31983321065"), "(31) 98332-1065");
  assert.equal(formatarTelefone("3133214455"), "(31) 3321-4455");
  // O que não reconhece, devolve como veio — melhor que estragar.
  assert.equal(formatarTelefone("12345"), "12345");
});

test("a reserva preenche o que sabe e deixa em branco o que não sabe", () => {
  const d = dadosDaReserva({
    nome_cliente: "Diego Dal Molin",
    telefone: "5531984949201",
    data_checkin: "2026-10-23",
    data_checkout: "2026-10-25",
    qtd_pessoas: 40,
    valor_final: "3800",
  });

  assert.equal(d.locatarioNome, "Diego Dal Molin");
  assert.equal(d.locatarioTelefone, "(31) 98494-9201");
  assert.equal(d.valorTotal, 3800);
  assert.equal(noites(d), 2);

  // 40 pessoas não cabem dormindo: vira evento de 40 com estadia de 30.
  assert.equal(d.pessoasEvento, 40);
  assert.equal(d.pessoasEstadia, 30);
  assert.equal(temEvento(d), true);

  // CPF e endereço ninguém pergunta no WhatsApp.
  assert.equal(d.locatarioCpf, "");
  assert.equal(d.locatarioEndereco, "");
  // E o horário não é chutado a partir da reserva — vem do padrão, para
  // ser confirmado à mão.
  assert.equal(d.horaCheckin, "08:00");
});

test("grupo pequeno não vira evento", () => {
  const d = dadosDaReserva({ qtd_pessoas: 20, valor_final: 2350 });
  assert.equal(d.pessoasEstadia, 20);
  assert.equal(d.pessoasEvento, 0);
  assert.equal(temEvento(d), false);
});
