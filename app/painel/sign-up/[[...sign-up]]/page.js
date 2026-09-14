"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSignUp } from "@clerk/nextjs/legacy";
import { emailPareceReal } from "@/lib/email-real";
import { traduzErroClerk } from "@/lib/erros-clerk";
import LogoLink from "@/components/LogoLink";

export default function SignUpPage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();

  const [etapa, setEtapa] = useState("dados");
  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [cargo, setCargo] = useState("");
  const [setor, setSetor] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function enviarCadastro(e) {
    e.preventDefault();
    if (!isLoaded) return;
    setErro(null);

    const checagemEmail = emailPareceReal(email);
    if (!checagemEmail.valido) {
      setErro(checagemEmail.motivo);
      return;
    }

    setEnviando(true);
    try {
      const resultado = await signUp.create({
        firstName: nome,
        lastName: sobrenome,
        emailAddress: email,
        password: senha,
        unsafeMetadata: { cargo, setor },
      });

      if (resultado.status === "complete") {
        await setActive({ session: resultado.createdSessionId });
        router.push("/painel");
        return;
      }

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setEtapa("verificar");
    } catch (err) {
      setErro(traduzErroClerk(err, "Não foi possível criar a conta. Confira os dados."));
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarCodigo(e) {
    e.preventDefault();
    if (!isLoaded) return;
    setErro(null);
    setEnviando(true);
    try {
      const resultado = await signUp.attemptEmailAddressVerification({ code: codigo });
      if (resultado.status === "complete") {
        await setActive({ session: resultado.createdSessionId });
        router.push("/painel");
      } else {
        setErro("Código incorreto ou incompleto. Confira e tente de novo.");
      }
    } catch (err) {
      setErro(traduzErroClerk(err, "Código inválido."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center bg-gradient-to-br from-[#040464] to-[#0A0A7A] p-6">
      <div className="flex justify-center pt-8 pb-6">
        <LogoLink />
      </div>

      <div className="w-full max-w-sm bg-white rounded-xl p-8 shadow-2xl">
        {etapa === "dados" ? (
          <form onSubmit={enviarCadastro} className="space-y-4">
            <div>
              <h1 className="text-lg font-bold text-[#040464]">Criar acesso ao painel</h1>
              <p className="text-sm text-neutral-500 mt-1">
                Seu acesso fica pendente de aprovação até ser liberado pelo responsável.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Campo label="Nome" value={nome} onChange={setNome} required />
              <Campo label="Sobrenome" value={sobrenome} onChange={setSobrenome} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Cargo" value={cargo} onChange={setCargo} required />
              <label className="block">
                <span className="block text-xs font-semibold text-neutral-700 mb-1">
                  Setor
                  <span className="text-[#FC9704]"> *</span>
                </span>
                <select
                  value={setor}
                  onChange={(e) => setSetor(e.target.value)}
                  required
                  className="w-full border border-neutral-300 rounded px-3 py-2 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#04ACEC] focus:border-transparent"
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  <option value="rh">RH</option>
                  <option value="financeiro">Financeiro</option>
                  <option value="ambos">RH e Financeiro</option>
                  <option value="outro">Outro setor</option>
                </select>
              </label>
            </div>
            <Campo label="E-mail" type="email" value={email} onChange={setEmail} required />
            <Campo label="Senha" type="password" value={senha} onChange={setSenha} required />

            <div id="clerk-captcha" />

            {erro && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
                {erro}
              </p>
            )}

            <button
              type="submit"
              disabled={!isLoaded || enviando}
              className="w-full bg-gradient-to-r from-[#FC9704] to-[#FCCC0C] text-[#040464] rounded px-4 py-2.5 text-sm font-bold disabled:opacity-50 cursor-pointer"
            >
              {enviando ? "Enviando…" : "Criar conta"}
            </button>

            <p className="text-xs text-neutral-400 text-center">
              Já tem conta?{" "}
              <Link href="/painel/sign-in" className="text-[#040464] font-semibold">
                Entrar
              </Link>
            </p>
          </form>
        ) : (
          <form onSubmit={confirmarCodigo} className="space-y-4">
            <div>
              <h1 className="text-lg font-bold text-[#040464]">Confirme seu e-mail</h1>
              <p className="text-sm text-neutral-500 mt-1">
                Enviamos um código de 6 dígitos para {email}.
              </p>
            </div>

            <Campo
              label="Código"
              value={codigo}
              onChange={setCodigo}
              required
              inputMode="numeric"
            />

            {erro && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
                {erro}
              </p>
            )}

            <button
              type="submit"
              disabled={!isLoaded || enviando}
              className="w-full bg-gradient-to-r from-[#FC9704] to-[#FCCC0C] text-[#040464] rounded px-4 py-2.5 text-sm font-bold disabled:opacity-50 cursor-pointer"
            >
              {enviando ? "Confirmando…" : "Confirmar"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

function Campo({ label, value, onChange, type = "text", required, inputMode }) {
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const ehSenha = type === "password";
  const tipoInput = ehSenha && mostrarSenha ? "text" : type;

  return (
    <label className="block">
      <span className="block text-xs font-semibold text-neutral-700 mb-1">
        {label}
        {required && <span className="text-[#FC9704]"> *</span>}
      </span>
      <div className="relative">
        <input
          type={tipoInput}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          inputMode={inputMode}
          className={`w-full border border-neutral-300 rounded px-3 py-2 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#04ACEC] focus:border-transparent ${
            ehSenha ? "pr-10" : ""
          }`}
        />
        {ehSenha && (
          <button
            type="button"
            onMouseDown={() => setMostrarSenha(true)}
            onMouseUp={() => setMostrarSenha(false)}
            onMouseLeave={() => setMostrarSenha(false)}
            onTouchStart={() => setMostrarSenha(true)}
            onTouchEnd={() => setMostrarSenha(false)}
            aria-label="Segurar para mostrar a senha"
            className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-400 hover:text-neutral-700 cursor-pointer select-none"
          >
            {mostrarSenha ? (
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-6.06M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a20.3 20.3 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <path d="M1 1l22 22" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
      </div>
    </label>
  );
}
