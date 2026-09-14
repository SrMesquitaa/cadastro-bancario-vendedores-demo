import { limparDigitos } from "pix-chave-validator";

export function mascararTelefone(valor) {
  const digitos = limparDigitos(valor).slice(0, 11);
  let resultado = digitos;
  if (digitos.length > 10) {
    resultado = digitos.replace(/^(\d{2})(\d{5})(\d{1,4})$/, "($1) $2-$3");
  } else if (digitos.length > 6) {
    resultado = digitos.replace(/^(\d{2})(\d{4})(\d{1,4})$/, "($1) $2-$3");
  } else if (digitos.length > 2) {
    resultado = digitos.replace(/^(\d{2})(\d{1,5})$/, "($1) $2");
  } else if (digitos.length > 0) {
    resultado = `(${digitos}`;
  }
  return resultado;
}

export function telefoneValido(digitosBrutos) {
  const digitos = limparDigitos(digitosBrutos);
  return /^\d{10,11}$/.test(digitos);
}
