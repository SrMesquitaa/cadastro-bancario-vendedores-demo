import { limparDigitos } from "pix-chave-validator";

function sequenciaRepetida(digitos) {
  return /^(\d)\1*$/.test(digitos);
}

// Não existe API pública pra confirmar que a conta existe de verdade — isso
// só valida formato plausível (tamanho comum de agência/conta no Brasil,
// não é tudo o mesmo dígito).
export function agenciaValida(valor) {
  const digitos = limparDigitos(valor);
  if (digitos.length !== 4) return false;
  if (sequenciaRepetida(digitos)) return false;
  if (digitos === "0000") return false;
  return true;
}

export function contaValida(valor) {
  const digitos = limparDigitos(valor);
  if (digitos.length < 5 || digitos.length > 9) return false;
  if (sequenciaRepetida(digitos)) return false;
  return true;
}
