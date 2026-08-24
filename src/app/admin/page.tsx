import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarCheck,
  FileSignature,
  LogOut,
  TrendingUp,
  Users,
} from "lucide-react";
import { sessaoAtual } from "@/lib/auth";
import {
  getSupabase,
  supabaseConfigurado,
  type Orcamento,
  type Reserva,
} from "@/lib/supabase";
import { formatarBRL } from "@/lib/pricing";
import { hojeISO } from "@/lib/ocupacao";
import { lerModelo, listarContratos } from "@/lib/contratos";
import { sair } from "./actions";
import { CRMLeads } from "./CRMLeads";
import { CalendarioAdmin, type Bloqueio } from "./CalendarioAdmin";
import { Contratos } from "./Contratos";
import { GerenciarReservas } from "./GerenciarReservas";
import { ModeloContrato } from "./ModeloContrato";
import { PainelAbas } from "./PainelAbas";

export const metadata: Metadata = {
  title: "Painel administrativo",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Vale para as server actions desta página. Os avisos de WhatsApp saem
 * dentro de `after()`, que roda depois da resposta mas ainda dentro do
 * tempo da invocação — dois envios de até 15s precisam de folga.
 */
export const maxDuration = 60;

export default async function PaginaAdmin() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/admin/login");

  if (!supabaseConfigurado()) {
    return <BancoNaoConfigurado />;
  }

  const supabase = getSupabase();

  const [resOrcamentos, resReservas, resBloqueios] = await Promise.all([
    supabase
      .from("orcamentos")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(200),
    supabase
      .from("reservas")
      .select("*")
      .order("data_checkin", { ascending: true })
      .limit(300),
    supabase
      .from("datas_bloqueadas")
      .select("*")
      .order("data_inicio", { ascending: true }),
  ]);

  // Contratos e modelo vêm em paralelo com o resto: a aba nasce pronta,
  // e tabela ainda não criada (falta rodar a 007) devolve lista vazia +
  // o modelo do código, sem derrubar o painel inteiro.
  const [contratos, modelo] = await Promise.all([
    listarContratos(),
    lerModelo(),
  ]);

  const orcamentos = (resOrcamentos.data ?? []) as Orcamento[];
  // A tabela `reservas` pertence ao workflow do n8n. Se ela ainda não
  // existir, o painel continua útil só com os orçamentos.
  const reservas = (resReservas.data ?? []) as Reserva[];
  const bloqueios = (resBloqueios.data ?? []) as Bloqueio[];

  const erros = [
    resOrcamentos.error && `orçamentos: ${resOrcamentos.error.message}`,
    resReservas.error && `reservas: ${resReservas.error.message}`,
    resBloqueios.error && `bloqueios: ${resBloqueios.error.message}`,
  ].filter(Boolean) as string[];

  const novos = orcamentos.filter((o) => o.status === "novo");
  const fechados = orcamentos.filter((o) => o.status === "fechado");
  const receitaFechada = fechados.reduce(
    (soma, o) => soma + Number(o.valor_calculado ?? 0),
    0,
  );

  const inicioDoMes = new Date();
  inicioDoMes.setDate(1);
  inicioDoMes.setHours(0, 0, 0, 0);
  const doMes = orcamentos.filter(
    (o) => new Date(o.criado_em) >= inicioDoMes,
  ).length;

  return (
    <div className="min-h-screen bg-areia-50">
      <header className="bg-mata-900 text-areia-50">
        <div className="container-sitio flex flex-wrap items-center justify-between gap-4 py-5">
          <div>
            <p className="font-display text-xl font-semibold">
              Painel · Estâncias Feliz
            </p>
            <p className="text-xs text-mata-400">
              Orçamentos do site e agenda do sítio · conectado como{" "}
              <span className="font-medium text-mata-300">
                {sessao.usuario}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-full border border-mata-600 px-4 py-2 text-sm transition hover:bg-mata-800"
            >
              Ver o site
            </Link>
            <form action={sair}>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-full bg-mata-700 px-4 py-2 text-sm transition hover:bg-mata-600"
              >
                <LogOut className="size-4" aria-hidden />
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="container-sitio space-y-10 py-10">
        {erros.length > 0 && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">
                Algumas informações não puderam ser carregadas
              </p>
              <ul className="mt-1.5 space-y-1">
                {erros.map((e) => (
                  <li key={e}>· {e}</li>
                ))}
              </ul>
              <p className="mt-2">
                Se a mensagem citar tabela inexistente, rode o arquivo{" "}
                <code className="rounded bg-amber-100 px-1.5 py-0.5">
                  supabase/migrations/001_orcamentos.sql
                </code>{" "}
                no SQL Editor do Supabase.
              </p>
            </div>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Cartao
            icone={<Users className="size-5" />}
            rotulo="Aguardando contato"
            valor={String(novos.length)}
            destaque={novos.length > 0}
          />
          <Cartao
            icone={<TrendingUp className="size-5" />}
            rotulo="Pedidos neste mês"
            valor={String(doMes)}
          />
          <Cartao
            icone={<CalendarCheck className="size-5" />}
            rotulo="Negócios fechados"
            valor={String(fechados.length)}
          />
          <Cartao
            icone={<TrendingUp className="size-5" />}
            rotulo="Valor fechado"
            valor={formatarBRL(receitaFechada)}
          />
        </section>

        <PainelAbas
          abas={[
            {
              id: "agenda",
              rotulo: "Agenda",
              icone: <CalendarCheck className="size-4" aria-hidden />,
              conteudo: (
                <section>
                  <h2 className="font-display text-2xl font-semibold text-mata-900">
                    Agenda
                  </h2>
                  <p className="mt-1 text-sm text-mata-600">
                    Reservas confirmadas pela Júlia no WhatsApp, pedidos de
                    orçamento e datas que você bloqueou à mão. É esta agenda
                    que o calendário público do site mostra.
                  </p>
                  <div className="mt-5">
                    <CalendarioAdmin
                      reservas={reservas}
                      orcamentos={orcamentos}
                      bloqueios={bloqueios}
                    />
                  </div>
                  <div className="mt-5">
                    <GerenciarReservas reservas={reservas} />
                  </div>
                </section>
              ),
            },
            {
              id: "contratos",
              rotulo: "Contratos",
              icone: <FileSignature className="size-4" aria-hidden />,
              contador: contratos.filter((c) => c.status === "RASCUNHO").length,
              conteudo: (
                <section className="space-y-6">
                  <div>
                    <h2 className="font-display text-2xl font-semibold text-mata-900">
                      Contratos
                    </h2>
                    <p className="mt-1 text-sm text-mata-600">
                      O contrato de locação sai daqui pronto: nome, CPF, datas,
                      horários, quantas pessoas, parcelas e hidromassagem entram
                      no texto sozinhos, e os valores saem escritos por extenso.
                      O modelo base é editável logo abaixo.
                    </p>
                  </div>
                  <Contratos contratos={contratos} reservas={reservas} />
                  <ModeloContrato modelo={modelo} />
                </section>
              ),
            },
            {
              id: "crm",
              rotulo: "Leads",
              icone: <Users className="size-4" aria-hidden />,
              contador: novos.length,
              conteudo: (
                <section>
                  <h2 className="font-display text-2xl font-semibold text-mata-900">
                    Leads
                  </h2>
                  <p className="mt-1 text-sm text-mata-600">
                    {orcamentos.length === 0
                      ? "Nenhum lead ainda."
                      : `${orcamentos.length} pessoa${orcamentos.length > 1 ? "s" : ""} que pediu orçamento no site.`}{" "}
                    O contato é gravado antes de a pessoa ver o valor, então
                    muita gente aqui nunca chegou a mandar mensagem.
                  </p>
                  <div className="mt-5">
                    <CRMLeads leads={orcamentos} hoje={hojeISO()} />
                  </div>
                </section>
              ),
            },
          ]}
        />
      </main>
    </div>
  );
}

function Cartao({
  icone,
  rotulo,
  valor,
  destaque,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        destaque
          ? "border-terra-500 bg-terra-500/10"
          : "border-mata-100 bg-white"
      }`}
    >
      <div className="flex items-center gap-2 text-mata-600">
        {icone}
        <span className="text-xs font-medium uppercase tracking-wide">
          {rotulo}
        </span>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold text-mata-900">
        {valor}
      </p>
    </div>
  );
}

function BancoNaoConfigurado() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-areia-50 px-5">
      <div className="max-w-lg rounded-3xl border border-amber-200 bg-white p-8 shadow-sm">
        <AlertTriangle className="size-8 text-amber-500" aria-hidden />
        <h1 className="mt-4 font-display text-2xl font-semibold text-mata-900">
          Falta conectar o banco
        </h1>
        <p className="mt-3 leading-relaxed text-mata-700">
          Defina <code className="rounded bg-areia-100 px-1.5 py-0.5">SUPABASE_URL</code>{" "}
          e{" "}
          <code className="rounded bg-areia-100 px-1.5 py-0.5">
            SUPABASE_SERVICE_ROLE_KEY
          </code>{" "}
          no arquivo{" "}
          <code className="rounded bg-areia-100 px-1.5 py-0.5">.env.local</code>{" "}
          e reinicie o servidor. O modelo está em{" "}
          <code className="rounded bg-areia-100 px-1.5 py-0.5">.env.example</code>.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-mata-700 px-6 py-3 text-sm font-semibold text-areia-50"
        >
          Voltar para o site
        </Link>
      </div>
    </main>
  );
}
