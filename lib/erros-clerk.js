const MENSAGENS = {
  form_identifier_exists: "Esse e-mail já está cadastrado. Tente entrar em vez de criar conta.",
  form_password_pwned: "Essa senha apareceu em vazamentos de dados conhecidos. Escolha outra senha.",
  form_password_length_too_short: "A senha é muito curta.",
  form_password_not_strong_enough: "Essa senha é fraca demais. Tente uma senha mais forte.",
  form_param_format_invalid: "Formato inválido — confira o campo.",
  form_param_missing: "Preencha todos os campos obrigatórios.",
  form_code_incorrect: "Código incorreto. Confira e tente de novo.",
  form_identifier_not_found: "Não encontramos uma conta com esses dados.",
  session_exists: "Você já está logado.",
};

export function traduzErroClerk(err, mensagemPadrao = "Algo deu errado. Tente novamente.") {
  const codigo = err?.errors?.[0]?.code;
  return MENSAGENS[codigo] || mensagemPadrao;
}
