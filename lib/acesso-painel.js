import "server-only";
import { clerkClient } from "@clerk/nextjs/server";

export async function usuarioAprovado(userId) {
  if (!userId) return false;
  const client = await clerkClient();
  const usuario = await client.users.getUser(userId);
  const aprovado = usuario.publicMetadata?.aprovado;
  return aprovado === true || aprovado === "true";
}

// Le o setor cadastrado no Clerk (rh, financeiro, ambos ou outro) so pra
// identificar/exibir quem e quem no painel -- nao restringe mais o que cada
// setor enxerga, qualquer conta aprovada (ver usuarioAprovado) ve todas as
// colunas da tabela.
export async function areaUsuario(userId) {
  if (!userId) return null;
  const client = await clerkClient();
  const usuario = await client.users.getUser(userId);
  const setor = (usuario.publicMetadata?.setor || "").toString().toLowerCase().trim();
  return setor || null;
}
