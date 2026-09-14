"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { usuarioAprovado, areaUsuario } from "@/lib/acesso-painel";

export async function alternarStatusProblema(id, statusAtual) {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, error: "Não autenticado." };
  }
  if (!(await usuarioAprovado(userId))) {
    return { ok: false, error: "Sua conta ainda não foi aprovada para acessar o painel." };
  }
  const area = await areaUsuario(userId);
  if (area !== "financeiro" && area !== "ambos") {
    return { ok: false, error: "Essa ação é exclusiva do financeiro." };
  }

  const novoStatus = statusAtual === "invalido" ? "nao_verificado" : "invalido";

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .schema("financeiro")
    .from("vendedores_dados_bancarios")
    .update({ status: novoStatus })
    .eq("id", id);

  if (error) {
    console.error("Erro ao alternar status:", error.message, error);
    return { ok: false, error: "Erro ao atualizar status." };
  }

  revalidatePath("/painel");
  return { ok: true, novoStatus };
}
