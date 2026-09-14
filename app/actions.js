"use server";

import { getSupabaseAdmin } from "@/lib/supabase-server";
import { cpfValido, limparDigitos, classificarChavePix, normalizarChavePix } from "pix-chave-validator";
import { agenciaValida, contaValida } from "@/lib/conta-bancaria";
import { telefoneValido } from "@/lib/telefone";

const SEXOS_VALIDOS = ["masculino", "feminino", "prefiro_nao_informar"];

export async function cpfJaExiste(cpfBruto) {
  const cpf_titular = limparDigitos(cpfBruto);
  if (!cpfValido(cpf_titular)) return false;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .schema("financeiro")
    .from("vendedores_dados_bancarios")
    .select("id")
    .eq("cpf_titular", cpf_titular)
    .maybeSingle();

  return Boolean(data);
}

export async function salvarDadosBancarios(_prevState, formData) {
  const nome_titular = (formData.get("nome_titular") || "").trim();
  const cpf_titular = limparDigitos(formData.get("cpf_titular"));
  const tipo_contrato = (formData.get("tipo_contrato") || "").trim();
  let banco = (formData.get("banco") || "").trim();
  const agencia = limparDigitos(formData.get("agencia"));
  const conta = limparDigitos(formData.get("conta"));
  const chave_pix_pf = (formData.get("chave_pix_pf") || "").trim();
  const chave_pix_pj = (formData.get("chave_pix_pj") || "").trim();
  const data_nascimento = (formData.get("data_nascimento") || "").trim();
  const sexo = (formData.get("sexo") || "").trim();
  const whatsapp = limparDigitos(formData.get("whatsapp"));
  const data_admissao = (formData.get("data_admissao") || "").trim();

  if (!nome_titular) {
    return { ok: false, error: "Informe o nome completo." };
  }
  if (nome_titular.split(/\s+/).filter(Boolean).length < 2) {
    return { ok: false, error: "Informe nome e sobrenome." };
  }
  if (!cpfValido(cpf_titular)) {
    return { ok: false, error: "CPF inválido — digite os 11 números." };
  }
  if (tipo_contrato !== "funcionario" && tipo_contrato !== "vendedor") {
    return { ok: false, error: "Informe se é funcionário ou vendedor." };
  }
  if (tipo_contrato === "funcionario") {
    banco = "Banco Exemplo";
  }
  if (!banco) {
    return { ok: false, error: "Informe o banco." };
  }
  if (!chave_pix_pf) {
    return { ok: false, error: "A chave PIX é obrigatória." };
  }
  const chavePixInfo = classificarChavePix(chave_pix_pf);
  if (!chavePixInfo.tipo || !chavePixInfo.valido) {
    return { ok: false, error: "Chave PIX inválida — confira o formato." };
  }
  if (chavePixInfo.tipo === "cnpj") {
    return { ok: false, error: "A chave PIX de pessoa física não pode ser um CNPJ." };
  }
  const chavePixNormalizada = normalizarChavePix(chave_pix_pf);

  let chavePixPjNormalizada = null;
  let tipoChavePixPj = null;
  if (chave_pix_pj) {
    const chavePixPjInfo = classificarChavePix(chave_pix_pj);
    if (!chavePixPjInfo.tipo || !chavePixPjInfo.valido) {
      return { ok: false, error: "Chave PIX de pessoa jurídica inválida — confira o formato." };
    }
    chavePixPjNormalizada = normalizarChavePix(chave_pix_pj);
    if (chavePixPjNormalizada === chavePixNormalizada) {
      return { ok: false, error: "A chave PIX de pessoa jurídica não pode ser igual à de pessoa física." };
    }
    tipoChavePixPj = chavePixPjInfo.tipo;
  }
  if (!agenciaValida(agencia)) {
    return { ok: false, error: "Agência inválida — confira o número." };
  }
  if (!contaValida(conta)) {
    return { ok: false, error: "Número de conta inválido — confira os dígitos." };
  }
  const hoje = new Date().toISOString().slice(0, 10);
  if (!data_nascimento || data_nascimento > hoje) {
    return { ok: false, error: "Data de nascimento inválida." };
  }
  if (!SEXOS_VALIDOS.includes(sexo)) {
    return { ok: false, error: "Informe o sexo." };
  }
  if (!telefoneValido(whatsapp)) {
    return { ok: false, error: "Número de WhatsApp inválido — confira o DDD e os dígitos." };
  }
  if (!data_admissao || data_admissao > hoje) {
    return { ok: false, error: "Data de admissão inválida." };
  }

  const supabase = getSupabaseAdmin();

  const { data: existente } = await supabase
    .schema("financeiro")
    .from("vendedores_dados_bancarios")
    .select("id")
    .eq("cpf_titular", cpf_titular)
    .maybeSingle();

  const { error } = await supabase
    .schema("financeiro")
    .from("vendedores_dados_bancarios")
    .upsert(
      {
        nome_titular,
        cpf_titular,
        tipo_contrato,
        banco,
        agencia,
        conta,
        chave_pix_pf: chavePixNormalizada,
        tipo_chave_pix_pf: chavePixInfo.tipo,
        chave_pix_pj: chavePixPjNormalizada,
        tipo_chave_pix_pj: tipoChavePixPj,
        data_nascimento,
        sexo,
        whatsapp,
        data_admissao,
        status: "nao_verificado",
      },
      { onConflict: "cpf_titular" }
    );

  if (error) {
    console.error("Erro ao salvar dados bancários:", error.message, error);
    return { ok: false, error: "Erro ao salvar. Tente novamente." };
  }

  return { ok: true, error: null, atualizado: Boolean(existente) };
}
