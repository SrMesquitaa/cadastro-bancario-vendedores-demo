import { Webhook } from "svix";
import { clerkClient } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function POST(req) {
  const segredo = process.env.CLERK_WEBHOOK_SECRET;
  if (!segredo) {
    return new Response("Webhook não configurado.", { status: 500 });
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Cabeçalhos do webhook ausentes.", { status: 400 });
  }

  const corpoBruto = await req.text();

  let evento;
  try {
    const wh = new Webhook(segredo);
    evento = wh.verify(corpoBruto, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch {
    return new Response("Assinatura inválida.", { status: 400 });
  }

  if (evento.type !== "user.created" && evento.type !== "user.updated") {
    return new Response("ok", { status: 200 });
  }

  const usuario = evento.data;
  const email =
    usuario.email_addresses?.find((e) => e.id === usuario.primary_email_address_id)
      ?.email_address ?? usuario.email_addresses?.[0]?.email_address ?? "";

  if (evento.type === "user.created" && usuario.public_metadata?.aprovado === undefined) {
    // "setor" ja basta pra decidir a area do painel (ver lib/acesso-painel.js) --
    // so precisa estar no publicMetadata pra ficar visivel/editável no dashboard
    // do Clerk na hora de aprovar o acesso.
    const client = await clerkClient();
    await client.users.updateUserMetadata(usuario.id, {
      publicMetadata: {
        aprovado: false,
        cargo: usuario.unsafe_metadata?.cargo || null,
        setor: usuario.unsafe_metadata?.setor || null,
      },
    });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .schema("financeiro")
    .from("painel_usuarios")
    .upsert(
      {
        clerk_user_id: usuario.id,
        nome: usuario.first_name || "",
        sobrenome: usuario.last_name || "",
        email,
        cargo: usuario.unsafe_metadata?.cargo || null,
        setor: usuario.unsafe_metadata?.setor || null,
        aprovado:
          usuario.public_metadata?.aprovado === true ||
          usuario.public_metadata?.aprovado === "true",
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "clerk_user_id" }
    );

  if (error) {
    console.error("Erro ao sincronizar usuário do painel:", error.message, error);
    return new Response("Erro ao salvar.", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
