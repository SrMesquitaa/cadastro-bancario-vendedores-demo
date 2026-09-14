import { auth, clerkClient } from "@clerk/nextjs/server";
import { SignOutButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { usuarioAprovado, areaUsuario } from "@/lib/acesso-painel";
import LogoLink from "@/components/LogoLink";
import PainelClient from "./PainelClient";

export default async function PainelPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/painel/sign-in");
  }

  if (!(await usuarioAprovado(userId))) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#040464] text-white overflow-hidden relative">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#FC9704]/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-[#04ACEC]/20 blur-3xl" />

        <div className="relative mb-6">
          <LogoLink />
        </div>

        <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-[#FC9704] to-[#FCCC0C] flex items-center justify-center mb-6 animate-etapa shadow-lg shadow-[#FC9704]/30">
          <svg viewBox="0 0 24 24" className="w-10 h-10 text-[#040464]" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3.5 2" />
          </svg>
        </div>

        <div className="max-w-md text-center space-y-3 relative">
          <h1 className="text-3xl font-semibold text-[#FCCC0C]">Aguardando aprovação</h1>
          <p className="text-white/70">
            Sua conta foi criada, mas ainda não foi liberada pra ver o painel financeiro.
            Avise o responsável para liberar seu acesso.
          </p>
        </div>

        <SignOutButton redirectUrl="/painel/sign-in">
          <button className="relative mt-10 inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors cursor-pointer">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9" />
              <path d="M10 17l5-5-5-5" />
              <path d="M15 12H3" />
            </svg>
            Entrar com outra conta
          </button>
        </SignOutButton>
      </main>
    );
  }

  const ROTULOS_SETOR = {
    rh: "RH",
    financeiro: "Financeiro",
    ambos: "RH e Financeiro",
    outro: "Outro setor",
  };

  const client = await clerkClient();
  const usuario = await client.users.getUser(userId);
  const usuarioAtual = {
    nome: `${usuario.firstName || ""} ${usuario.lastName || ""}`.trim() || usuario.primaryEmailAddress?.emailAddress || "Usuário",
    cargo: usuario.publicMetadata?.cargo || null,
    setor: ROTULOS_SETOR[usuario.publicMetadata?.setor] || usuario.publicMetadata?.setor || null,
  };

  const area = await areaUsuario(userId);

  // Qualquer conta aprovada ve todas as colunas, independente do setor --
  // "area" so e usada pra exibir o setor real da pessoa no cabecalho do painel.
  const COLUNAS_COMUNS = "id, nome_titular, cpf_titular, tipo_contrato, criado_em, atualizado_em";
  const COLUNAS_FINANCEIRO =
    "banco, agencia, conta, chave_pix_pf, tipo_chave_pix_pf, chave_pix_pj, tipo_chave_pix_pj, status";
  const COLUNAS_RH = "data_nascimento, sexo, whatsapp, data_admissao";
  const colunas = `${COLUNAS_COMUNS}, ${COLUNAS_FINANCEIRO}, ${COLUNAS_RH}`;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema("financeiro")
    .from("vendedores_dados_bancarios")
    .select(colunas)
    .order("criado_em", { ascending: false });

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center bg-gradient-to-br from-[#040464] to-[#0A0A7A] p-6">
        <div className="flex justify-center pt-8 pb-6">
          <LogoLink />
        </div>
        <div className="max-w-sm w-full bg-white rounded-xl p-8 text-center shadow-2xl">
          <p className="text-red-600 text-sm">Erro ao carregar os dados: {error.message}</p>
        </div>
      </main>
    );
  }

  return <PainelClient dadosIniciais={data ?? []} usuarioAtual={usuarioAtual} area={area} />;
}
