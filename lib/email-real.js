const DOMINIOS_DESCARTAVEIS = new Set([
  "mailinator.com",
  "tempmail.com",
  "temp-mail.org",
  "guerrillamail.com",
  "guerrillamail.info",
  "10minutemail.com",
  "yopmail.com",
  "throwawaymail.com",
  "trashmail.com",
  "fakeinbox.com",
  "getnada.com",
  "sharklasers.com",
  "dispostable.com",
  "mintemail.com",
  "maildrop.cc",
  "mohmal.com",
  "moakt.com",
  "emailondeck.com",
  "spamgourmet.com",
]);

const LOCAIS_OBVIAMENTE_FALSOS = new Set([
  "teste",
  "test",
  "fake",
  "falso",
  "asdf",
  "aaaa",
  "example",
  "exemplo",
  "xxxx",
  "abc",
  "123",
]);

export function emailPareceReal(emailBruto) {
  const email = (emailBruto || "").trim().toLowerCase();
  const arroba = email.lastIndexOf("@");
  if (arroba <= 0 || arroba === email.length - 1) {
    return { valido: false, motivo: "E-mail inválido." };
  }

  const local = email.slice(0, arroba);
  const dominio = email.slice(arroba + 1);

  if (DOMINIOS_DESCARTAVEIS.has(dominio)) {
    return { valido: false, motivo: "Esse é um domínio de e-mail temporário. Use um e-mail de verdade." };
  }
  if (LOCAIS_OBVIAMENTE_FALSOS.has(local)) {
    return { valido: false, motivo: "Esse e-mail parece de teste. Use seu e-mail real." };
  }
  if (/^(.)\1*$/.test(local)) {
    return { valido: false, motivo: "Esse e-mail parece de teste. Use seu e-mail real." };
  }

  return { valido: true, motivo: null };
}
