"use client";

import Image from "next/image";
import Link from "next/link";
import { Show } from "@clerk/nextjs";
import { useEffect, useRef, useState, useTransition } from "react";
import { track } from "@vercel/analytics";
import { salvarDadosBancarios, cpfJaExiste } from "./actions";
import {
  cpfValido,
  limparDigitos,
  mascararCpf,
  classificarChavePix,
  mascararChavePix,
  normalizarChavePix,
} from "pix-chave-validator";
import { agenciaValida, contaValida } from "@/lib/conta-bancaria";
import { mascararTelefone, telefoneValido } from "@/lib/telefone";

const ETAPAS = [
  {
    campo: "tipo_contrato",
    pergunta: "Você é funcionário ou vendedor?",
    obrigatorio: true,
    selecaoContrato: true,
  },
  {
    campo: "nome_titular",
    pergunta: "Qual seu nome?",
    rotulo: "Nome completo",
    ajuda: "Nome e sobrenome.",
    placeholder: "Nome completo",
    obrigatorio: true,
  },
  {
    campo: "cpf_titular",
    pergunta: "Qual seu CPF?",
    rotulo: "CPF",
    placeholder: "Somente números",
    obrigatorio: true,
    inputMode: "numeric",
  },
  {
    campo: "data_nascimento",
    pergunta: "Qual sua data de nascimento?",
    rotulo: "Data de nascimento",
    obrigatorio: true,
    tipoInput: "date",
  },
  {
    campo: "sexo",
    pergunta: "Qual seu sexo?",
    obrigatorio: true,
    opcoes: [
      { valor: "masculino", rotulo: "Masculino" },
      { valor: "feminino", rotulo: "Feminino" },
      { valor: "prefiro_nao_informar", rotulo: "Prefiro não informar" },
    ],
  },
  {
    campo: "whatsapp",
    pergunta: "Qual seu número de WhatsApp?",
    rotulo: "WhatsApp",
    placeholder: "(DDD) 9XXXX-XXXX",
    obrigatorio: true,
    inputMode: "numeric",
  },
  {
    campo: "data_admissao",
    pergunta: "Qual sua data de admissão?",
    rotulo: "Data de admissão",
    obrigatorio: true,
    tipoInput: "date",
  },
  {
    campo: "banco",
    pergunta: "Em qual banco você quer receber sua comissão?",
    ajuda: "Dica: conta Banco Exemplo costuma ter melhor experiência e evita possíveis taxas de transferência de outros bancos.",
    placeholder: "Nome do banco",
    obrigatorio: true,
    selecaoBanco: true,
  },
  {
    campo: "agencia",
    pergunta: (valores) => `Qual a agência do seu banco ${valores.banco}?`,
    rotulo: "Agência",
    ajuda: "Geralmente 4 dígitos.",
    placeholder: "Número da agência",
    obrigatorio: true,
    inputMode: "numeric",
  },
  {
    campo: "conta",
    pergunta: (valores) => `Qual sua conta ${valores.banco}?`,
    rotulo: "Conta",
    ajuda: "Com o dígito verificador, se tiver.",
    placeholder: "Número da conta",
    obrigatorio: true,
    inputMode: "numeric",
  },
  {
    campo: "pix",
    pergunta: "Qual sua chave PIX?",
    ajuda: (valores) =>
      valores.tipo_contrato === "funcionario"
        ? "É por ela que seu salário vai ser pago — como você é funcionário, a chave PIX precisa ser obrigatoriamente de uma conta aberta no Banco Exemplo."
        : "É por ela que sua comissão vai ser paga — confira bem antes de continuar.",
    obrigatorio: true,
    camposPix: true,
  },
];

const BANCOS_RAPIDOS = [
  { nome: "Banco Exemplo", logo: "/banco-exemplo.svg" },
  { nome: "Nubank", logo: "/nubank.png" },
  { nome: "Bradesco", logo: "/bradesco.png" },
  { nome: "Banco do Brasil", logo: "/banco-do-brasil.png" },
  { nome: "Caixa", logo: "/caixa.png" },
  { nome: "Santander", logo: "/santander.png" },
  { nome: "Inter", logo: "/inter.png" },
];

export default function Home() {
  const [passo, setPasso] = useState(0);
  const [valores, setValores] = useState({});
  const [erro, setErro] = useState(null);
  const [enviado, setEnviado] = useState(false);
  const [foiAtualizacao, setFoiAtualizacao] = useState(false);
  const [pending, startTransition] = useTransition();
  const [bancoOutro, setBancoOutro] = useState(false);
  const [statusCpf, setStatusCpf] = useState(null); // null | 'verificando' | 'existente' | 'novo'
  const [avisoBancoDiferente, setAvisoBancoDiferente] = useState(false);
  const [temContaPj, setTemContaPj] = useState(false);
  const inputRef = useRef(null);
  const pixFisicaRef = useRef(null);
  const pixJuridicaRef = useRef(null);
  const direcao = useRef("frente");
  const cursorPendente = useRef(null);

  const etapasAtivas = ETAPAS.filter(
    (e) => e.campo !== "banco" || valores.tipo_contrato !== "funcionario"
  );
  const etapa = etapasAtivas[passo];
  const ultimaEtapa = passo === etapasAtivas.length - 1;
  const campoMascarado = etapa.campo === "cpf_titular" || etapa.campo === "whatsapp";

  // No mobile o teclado nao redimensiona o layout automaticamente (principalmente
  // no Safari/iOS) -- sem isso o campo focado fica escondido atras do teclado.
  useEffect(() => {
    function aoFocar(e) {
      const alvo = e.target;
      if (alvo.tagName !== "INPUT" && alvo.tagName !== "TEXTAREA") return;
      setTimeout(() => {
        alvo.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
    document.addEventListener("focusin", aoFocar);
    return () => document.removeEventListener("focusin", aoFocar);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset legitimo ao trocar de etapa do wizard
    setStatusCpf(null);
    if (etapa.selecaoBanco) {
      const bancoAtual = valores.banco;
      const ehBancoRapido = BANCOS_RAPIDOS.some((b) => b.nome === bancoAtual);
      setBancoOutro(Boolean(bancoAtual) && !ehBancoRapido);
    } else {
      setBancoOutro(false);
    }
    if (etapa.camposPix) {
      pixFisicaRef.current?.focus();
    } else if (!etapa.selecaoBanco) {
      inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo]);

  function selecionarBanco(nome) {
    setValores((prev) => ({ ...prev, banco: nome }));
    setErro(null);
  }

  function selecionarContrato(valor) {
    setValores((prev) => ({
      ...prev,
      tipo_contrato: valor,
      banco: valor === "funcionario" ? "Banco Exemplo" : prev.banco,
    }));
    setErro(null);
  }

  useEffect(() => {
    if (
      (etapa.selecaoContrato && valores.tipo_contrato) ||
      (etapa.opcoes && valores[etapa.campo])
    ) {
      function aoTeclarGlobal(e) {
        if (e.key === "Enter") {
          e.preventDefault();
          avancar();
        }
      }
      window.addEventListener("keydown", aoTeclarGlobal);
      return () => window.removeEventListener("keydown", aoTeclarGlobal);
    }
    if (!etapa.selecaoBanco || bancoOutro) return;
    function aoTeclarGlobal(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        avancar();
      }
    }
    window.addEventListener("keydown", aoTeclarGlobal);
    return () => window.removeEventListener("keydown", aoTeclarGlobal);
  });

  useEffect(() => {
    if (cursorPendente.current == null || !inputRef.current) return;
    const alvo = cursorPendente.current;
    cursorPendente.current = null;
    const atual = valores[etapa.campo] || "";
    let restantes = alvo;
    let posicao = atual.length;
    for (let i = 0; i < atual.length; i++) {
      if (/\d/.test(atual[i])) restantes--;
      if (restantes <= 0) {
        posicao = i + 1;
        break;
      }
    }
    if (alvo === 0) posicao = 0;
    inputRef.current.setSelectionRange(posicao, posicao);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- so deve rodar quando o valor digitado muda, nao quando a etapa muda
  }, [valores]);

  function valorAtual() {
    return valores[etapa.campo] || "";
  }

  function atualizarValor(v, cursorBruto) {
    let valorFormatado = v;
    if (campoMascarado && cursorBruto != null) {
      const digitosAntes = limparDigitos(v.slice(0, cursorBruto)).length;
      cursorPendente.current = digitosAntes;
    }
    if (etapa.campo === "cpf_titular") {
      valorFormatado = mascararCpf(v);
      if (statusCpf) setStatusCpf(null);
    } else if (etapa.campo === "whatsapp") {
      valorFormatado = mascararTelefone(v);
    }
    setValores((prev) => ({ ...prev, [etapa.campo]: valorFormatado }));
    if (erro) setErro(null);
  }

  function atualizarPix(chave, v) {
    setValores((prev) => ({ ...prev, [chave]: mascararChavePix(v) }));
    if (erro) setErro(null);
  }

  function confirmarAtualizacaoCpf() {
    setStatusCpf(null);
    direcao.current = "frente";
    setPasso((p) => p + 1);
  }

  function corrigirCpf() {
    setStatusCpf(null);
    setValores((prev) => ({ ...prev, cpf_titular: "" }));
    inputRef.current?.focus();
  }

  function irProximoPasso() {
    track("etapa_concluida", { etapa: etapa.campo, passo: passo + 1 });
    direcao.current = "frente";
    setPasso((p) => p + 1);
  }

  async function avancar() {
    if (etapa.camposPix) {
      const chavePf = (valores.chave_pix_pf || "").trim();
      const chavePj = (valores.chave_pix_pj || "").trim();
      if (!chavePf) {
        setErro("A chave PIX de pessoa física é obrigatória.");
        return;
      }
      const pf = classificarChavePix(chavePf);
      if (!pf.tipo || !pf.valido) {
        setErro("Essa chave PIX de pessoa física parece inválida — confira os números.");
        return;
      }
      if (pf.tipo === "cnpj") {
        setErro("Essa é uma chave de CNPJ — use o campo de pessoa jurídica abaixo.");
        return;
      }
      if (chavePj) {
        const pj = classificarChavePix(chavePj);
        if (!pj.tipo || !pj.valido) {
          setErro("Essa chave PIX de pessoa jurídica parece inválida — confira os números.");
          return;
        }
        if (normalizarChavePix(chavePj) === normalizarChavePix(chavePf)) {
          setErro("A chave PIX de pessoa jurídica não pode ser igual à de pessoa física.");
          return;
        }
      }
      if (ultimaEtapa) {
        enviar();
        return;
      }
      irProximoPasso();
      return;
    }
    if (etapa.obrigatorio && !valorAtual().trim()) {
      setErro("Esse campo é obrigatório.");
      return;
    }
    if (etapa.campo === "nome_titular") {
      const palavras = valorAtual().trim().split(/\s+/).filter(Boolean);
      if (palavras.length < 2) {
        setErro("Preencha nome e sobrenome.");
        return;
      }
    }
    if (etapa.campo === "cpf_titular") {
      if (!cpfValido(limparDigitos(valorAtual()))) {
        setErro("Esse CPF não existe — confira os números.");
        return;
      }
      if (statusCpf === "verificando") return;
      setStatusCpf("verificando");
      const existe = await cpfJaExiste(valorAtual());
      setFoiAtualizacao(existe);
      if (existe) {
        setStatusCpf("existente");
        return;
      }
      setStatusCpf(null);
      irProximoPasso();
      return;
    }
    if (etapa.campo === "whatsapp" && !telefoneValido(valorAtual())) {
      setErro("Número de WhatsApp inválido — confira o DDD e os dígitos.");
      return;
    }
    if (
      (etapa.campo === "data_nascimento" || etapa.campo === "data_admissao") &&
      valorAtual() > new Date().toISOString().slice(0, 10)
    ) {
      setErro("Essa data não pode ser no futuro.");
      return;
    }
    if (etapa.campo === "agencia" && !agenciaValida(valorAtual())) {
      setErro("Agência inválida — confira o número (4 dígitos).");
      return;
    }
    if (etapa.campo === "conta" && !contaValida(valorAtual())) {
      setErro("Número de conta inválido — confira os dígitos.");
      return;
    }
    if (
      etapa.campo === "banco" &&
      valores.tipo_contrato === "vendedor" &&
      (valores.banco || "").trim() !== "Banco Exemplo"
    ) {
      setAvisoBancoDiferente(true);
      return;
    }
    if (ultimaEtapa) {
      enviar();
      return;
    }
    irProximoPasso();
  }

  function confirmarBancoDiferente() {
    setAvisoBancoDiferente(false);
    irProximoPasso();
  }

  function trocarParaBancoExemplo() {
    selecionarBanco("Banco Exemplo");
    setAvisoBancoDiferente(false);
  }

  function voltar() {
    if (passo === 0) return;
    direcao.current = "tras";
    setErro(null);
    setPasso((p) => p - 1);
  }

  function enviar() {
    const formData = new FormData();
    Object.entries(valores).forEach(([k, v]) => formData.set(k, v));
    formData.set("nome_titular", (valores.nome_titular || "").trim());
    startTransition(async () => {
      const resultado = await salvarDadosBancarios(null, formData);
      if (!resultado.ok) {
        track("formulario_erro", { erro: resultado.error });
        setErro(resultado.error);
        return;
      }
      track("formulario_enviado", {
        tipo_contrato: valores.tipo_contrato,
        atualizacao: Boolean(resultado.atualizado),
      });
      setFoiAtualizacao(Boolean(resultado.atualizado));
      setEnviado(true);
    });
  }

  function aoTeclar(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      avancar();
    }
  }

  // Já estamos na rota "/" na tela final, entao um <Link href="/"> nao
  // remonta o componente nem reseta o estado -- precisa resetar na mao.
  function reiniciar() {
    setEnviado(false);
    setFoiAtualizacao(false);
    setValores({});
    setErro(null);
    setBancoOutro(false);
    setStatusCpf(null);
    setAvisoBancoDiferente(false);
    setTemContaPj(false);
    direcao.current = "frente";
    setPasso(0);
  }

  if (enviado) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-6 bg-[#040464] text-white overflow-hidden relative">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#FC9704]/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-[#04ACEC]/20 blur-3xl" />

        <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-[#FC9704] to-[#FCCC0C] flex items-center justify-center mb-6 animate-etapa shadow-lg shadow-[#FC9704]/30">
          <svg viewBox="0 0 24 24" className="w-10 h-10 text-[#040464]" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <button
          type="button"
          onClick={reiniciar}
          className="relative mb-6 cursor-pointer"
        >
          <Image
            src="/logo-empresa.svg"
            alt="NovaVenda"
            width={180}
            height={76}
            className="opacity-90"
          />
        </button>

        <div className="max-w-md text-center space-y-3 relative">
          <h1 className="text-3xl font-semibold text-[#FCCC0C]">Tudo certo!</h1>
          {foiAtualizacao ? (
            <p className="text-white/70">
              Já existia um cadastro com esse CPF — atualizamos os dados com
              as informações novas que você preencheu agora.
            </p>
          ) : (
            <p className="text-white/70">
              Seus dados bancários foram registrados. Se precisar corrigir
              alguma informação depois, é só preencher de novo com o mesmo CPF.
            </p>
          )}
        </div>

        <div className="relative mt-12 text-center">
          <p className="text-white/50 text-sm mb-5">
            Enquanto isso, dá uma olhada nos nossos links e redes sociais
          </p>
          <div className="flex gap-6 justify-center">
            <a
              href="https://www.instagram.com/novavenda/"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center gap-2"
            >
              <span className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-tr from-[#FEDA75] via-[#D62976] to-[#4F5BD5] shadow-lg group-hover:scale-110 group-hover:-rotate-3 transition-transform">
                <svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="currentColor">
                  <path d="M12 2c-2.72 0-3.06.01-4.12.06-1.06.05-1.79.22-2.43.47-.66.26-1.22.6-1.77 1.16-.56.55-.9 1.11-1.16 1.77-.25.64-.42 1.37-.47 2.43C2 8.94 2 9.28 2 12s.01 3.06.06 4.12c.05 1.06.22 1.79.47 2.43.26.66.6 1.22 1.16 1.77.55.56 1.11.9 1.77 1.16.64.25 1.37.42 2.43.47C8.94 22 9.28 22 12 22s3.06-.01 4.12-.06c1.06-.05 1.79-.22 2.43-.47.66-.26 1.22-.6 1.77-1.16.56-.55.9-1.11 1.16-1.77.25-.64.42-1.37.47-2.43.05-1.06.06-1.4.06-4.12s-.01-3.06-.06-4.12c-.05-1.06-.22-1.79-.47-2.43-.26-.66-.6-1.22-1.16-1.77-.55-.56-1.11-.9-1.77-1.16-.64-.25-1.37-.42-2.43-.47C15.06 2.01 14.72 2 12 2zm0 1.8c2.67 0 2.99.01 4.04.06.98.04 1.5.21 1.86.34.47.18.8.4 1.15.75.35.35.57.68.75 1.15.13.36.29.88.34 1.86.05 1.05.06 1.37.06 4.04s-.01 2.99-.06 4.04c-.04.98-.21 1.5-.34 1.86-.18.47-.4.8-.75 1.15-.35.35-.68.57-1.15.75-.36.13-.88.29-1.86.34-1.05.05-1.37.06-4.04.06s-2.99-.01-4.04-.06c-.98-.04-1.5-.21-1.86-.34-.47-.18-.8-.4-1.15-.75-.35-.35-.57-.68-.75-1.15-.13-.36-.29-.88-.34-1.86C3.81 14.99 3.8 14.67 3.8 12s.01-2.99.06-4.04c.04-.98.21-1.5.34-1.86.18-.47.4-.8.75-1.15.35-.35.68-.57 1.15-.75.36-.13.88-.29 1.86-.34C9.01 3.81 9.33 3.8 12 3.8zm0 3.05a5.15 5.15 0 100 10.3 5.15 5.15 0 000-10.3zm0 8.5a3.35 3.35 0 110-6.7 3.35 3.35 0 010 6.7zm5.35-8.7a1.2 1.2 0 11-2.4 0 1.2 1.2 0 012.4 0z" />
                </svg>
              </span>
              <span className="text-xs text-white/60 group-hover:text-white transition-colors">Instagram</span>
            </a>

            <a
              href="https://contratarplanodesaude.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center gap-2"
            >
              <span className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-tr from-[#FC9704] to-[#FCCC0C] shadow-lg group-hover:scale-110 group-hover:-rotate-3 transition-transform">
                <svg viewBox="0 0 24 24" className="w-7 h-7 text-[#040464]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3c2.5 2.6 3.8 5.8 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.8-3.8-9s1.3-6.4 3.8-9z" />
                </svg>
              </span>
              <span className="text-xs text-white/60 group-hover:text-white transition-colors">Nosso site</span>
            </a>

            <a
              href="https://www.linkedin.com/company/novavenda/"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center gap-2"
            >
              <span className="w-14 h-14 rounded-2xl flex items-center justify-center bg-[#0A66C2] shadow-lg group-hover:scale-110 group-hover:-rotate-3 transition-transform">
                <svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="currentColor">
                  <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.03-1.85-3.03-1.85 0-2.14 1.45-2.14 2.94v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 110-4.12 2.06 2.06 0 010 4.12zM7.11 20.45H3.56V9h3.55v11.45z" />
                </svg>
              </span>
              <span className="text-xs text-white/60 group-hover:text-white transition-colors">LinkedIn</span>
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-[#040464] text-white overflow-y-auto relative">
      <div className="h-1 bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-[#FC9704] to-[#FCCC0C] transition-all duration-300"
          style={{ width: `${((passo + 1) / etapasAtivas.length) * 100}%` }}
        />
      </div>

      <Show when="signed-out">
        <Link
          href="/painel/sign-in"
          className="absolute top-4 right-4 flex items-center gap-1.5 text-xs text-white/60 border border-white/20 rounded-full px-3 py-1.5 hover:bg-white/10 hover:border-white/40 hover:text-white transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-[#FCCC0C]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l8 3v6c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10V5l8-3z" />
          </svg>
          Acesso Financeiro/RH
        </Link>
      </Show>
      <Show when="signed-in">
        <Link
          href="/painel"
          className="absolute top-4 right-4 flex items-center gap-1.5 text-xs text-white/60 border border-white/20 rounded-full px-3 py-1.5 hover:bg-white/10 hover:border-white/40 hover:text-white transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-[#FCCC0C]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l8 3v6c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10V5l8-3z" />
          </svg>
          Ir para o painel
        </Link>
      </Show>

      <div className="flex justify-center pt-16 sm:pt-8">
        <Link href="/">
          <Image
            src="/logo-empresa.svg"
            alt="NovaVenda"
            width={220}
            height={52}
            priority
            className="opacity-90"
          />
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div key={passo} className="w-full max-w-lg animate-etapa">
          <p className="text-sm text-[#04ACEC] mb-2 font-medium">
            {passo + 1} de {etapasAtivas.length}
          </p>
          <h1 className="text-2xl sm:text-3xl font-medium mb-2">
            {typeof etapa.pergunta === "function"
              ? etapa.pergunta(valores)
              : etapa.pergunta}
          </h1>
          {etapa.ajuda && (
            <p className="text-white/50 text-sm mb-6">
              {typeof etapa.ajuda === "function" ? etapa.ajuda(valores) : etapa.ajuda}
            </p>
          )}
          {!etapa.ajuda && <div className="mb-6" />}

          {etapa.selecaoContrato ? (
            <div className="flex gap-4">
              {[
                { valor: "funcionario", rotulo: "Funcionário" },
                { valor: "vendedor", rotulo: "Vendedor" },
              ].map((opcao) => {
                const selecionado = valores.tipo_contrato === opcao.valor;
                return (
                  <button
                    key={opcao.valor}
                    onClick={() => selecionarContrato(opcao.valor)}
                    className={`flex-1 py-6 rounded-xl border text-lg font-medium cursor-pointer transition-all ${
                      selecionado
                        ? "border-[#04ACEC] ring-2 ring-[#04ACEC] bg-[#04ACEC]/10 scale-105"
                        : "border-white/20 hover:bg-white/10 hover:border-white/40"
                    }`}
                  >
                    {opcao.rotulo}
                  </button>
                );
              })}
            </div>
          ) : etapa.opcoes ? (
            <div className="flex gap-4 flex-wrap">
              {etapa.opcoes.map((opcao) => {
                const selecionado = valores[etapa.campo] === opcao.valor;
                return (
                  <button
                    key={opcao.valor}
                    onClick={() => {
                      setValores((prev) => ({ ...prev, [etapa.campo]: opcao.valor }));
                      setErro(null);
                    }}
                    className={`flex-1 min-w-[140px] py-6 rounded-xl border text-lg font-medium cursor-pointer transition-all ${
                      selecionado
                        ? "border-[#04ACEC] ring-2 ring-[#04ACEC] bg-[#04ACEC]/10 scale-105"
                        : "border-white/20 hover:bg-white/10 hover:border-white/40"
                    }`}
                  >
                    {opcao.rotulo}
                  </button>
                );
              })}
            </div>
          ) : etapa.camposPix ? (
            <div className="flex flex-col gap-6">
              <div>
                <label className="block text-sm text-white/50 mb-2">
                  Chave PIX pessoa física <span className="text-[#FCCC0C]">*</span>
                </label>
                <input
                  ref={pixFisicaRef}
                  value={valores.chave_pix_pf || ""}
                  onChange={(e) => atualizarPix("chave_pix_pf", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    if (valores.tipo_contrato === "vendedor" && temContaPj) {
                      pixJuridicaRef.current?.focus();
                    } else {
                      avancar();
                    }
                  }}
                  placeholder="CPF, e-mail, telefone ou chave aleatória"
                  className="w-full bg-transparent border-b-2 border-white/30 focus:border-[#04ACEC] outline-none text-xl py-2 placeholder:text-white/30 transition-colors"
                />
              </div>

              {valores.tipo_contrato === "vendedor" && (
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      const novoValor = !temContaPj;
                      setTemContaPj(novoValor);
                      if (!novoValor) atualizarPix("chave_pix_pj", "");
                    }}
                    className="flex items-center gap-3 self-start cursor-pointer group"
                  >
                    <span
                      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                        temContaPj ? "bg-[#04ACEC]" : "bg-white/20 group-hover:bg-white/30"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          temContaPj ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </span>
                    <span className="text-sm text-white/80">Também recebo em conta PJ</span>
                  </button>
                </div>
              )}

              {valores.tipo_contrato === "vendedor" && temContaPj && (
                <div key="pix-pj" className="animate-etapa">
                  <label className="block text-sm text-white/50 mb-2">
                    Chave PIX pessoa jurídica
                  </label>
                  <input
                    ref={pixJuridicaRef}
                    value={valores.chave_pix_pj || ""}
                    onChange={(e) => atualizarPix("chave_pix_pj", e.target.value)}
                    onKeyDown={aoTeclar}
                    placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
                    autoFocus
                    className="w-full bg-transparent border-b-2 border-white/30 focus:border-[#04ACEC] outline-none text-xl py-2 placeholder:text-white/30 transition-colors"
                  />
                </div>
              )}

              <p className="text-white/40 text-xs">
                <span className="text-[#FCCC0C]">*</span> campo obrigatório
              </p>
            </div>
          ) : etapa.selecaoBanco ? (
            <div>
              <div className="flex flex-wrap gap-3">
                {BANCOS_RAPIDOS.map((banco) => {
                  const selecionado = !bancoOutro && valores.banco === banco.nome;
                  return (
                    <button
                      key={banco.nome}
                      onClick={() => {
                        setBancoOutro(false);
                        selecionarBanco(banco.nome);
                      }}
                      className={`relative flex flex-col items-center gap-2 w-24 py-3 rounded-xl border cursor-pointer transition-all ${
                        selecionado
                          ? "border-[#04ACEC] ring-2 ring-[#04ACEC] bg-[#04ACEC]/10 scale-105"
                          : "border-white/20 hover:bg-white/10 hover:border-white/40"
                      }`}
                    >
                      {selecionado && (
                        <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#04ACEC] flex items-center justify-center text-white text-sm font-bold shadow">
                          ✓
                        </span>
                      )}
                      <span className="w-12 h-12 rounded-full bg-white flex items-center justify-center shrink-0 overflow-hidden p-2">
                        <Image
                          src={banco.logo}
                          alt={banco.nome}
                          width={40}
                          height={40}
                          className="object-contain w-full h-full"
                        />
                      </span>
                      <span className="text-xs text-white/70 text-center leading-tight">
                        {banco.nome}
                      </span>
                      {banco.nome === "Banco Exemplo" && (
                        <span className="text-[#FCCC0C] text-[10px] font-semibold -mt-1">
                          ★ recomendado
                        </span>
                      )}
                    </button>
                  );
                })}
                <button
                  onClick={() => {
                    if (!bancoOutro) {
                      setBancoOutro(true);
                      setValores((prev) => ({ ...prev, banco: "" }));
                    }
                  }}
                  className={`relative flex flex-col items-center justify-center gap-2 w-24 py-3 rounded-xl border cursor-pointer transition-all ${
                    bancoOutro
                      ? "border-[#04ACEC] ring-2 ring-[#04ACEC] bg-[#04ACEC]/10 scale-105"
                      : "border-white/20 text-white/70 hover:bg-white/10 hover:border-white/40"
                  }`}
                >
                  <span className="w-12 h-12 rounded-full border border-white/30 flex items-center justify-center text-xl">
                    +
                  </span>
                  <span className="text-xs text-white/70">Outro</span>
                </button>
              </div>

              {bancoOutro && (
                <input
                  ref={inputRef}
                  value={valores.banco || ""}
                  onChange={(e) =>
                    setValores((prev) => ({ ...prev, banco: e.target.value }))
                  }
                  onKeyDown={aoTeclar}
                  placeholder="Digite o nome do banco"
                  autoFocus
                  className="w-full bg-transparent border-b-2 border-white/30 focus:border-[#04ACEC] outline-none text-xl py-2 mt-5 placeholder:text-white/30 transition-colors"
                />
              )}
            </div>
          ) : (
            <div>
              {etapa.rotulo && (
                <label className="block text-sm text-white/50 mb-2">
                  {etapa.rotulo} <span className="text-[#FCCC0C]">*</span>
                </label>
              )}
              <input
                ref={inputRef}
                type={etapa.tipoInput || "text"}
                value={valorAtual()}
                onChange={(e) => atualizarValor(e.target.value, e.target.selectionStart)}
                onKeyDown={aoTeclar}
                placeholder={etapa.placeholder}
                inputMode={etapa.inputMode}
                style={etapa.tipoInput === "date" ? { colorScheme: "dark" } : undefined}
                className="w-full bg-transparent border-b-2 border-white/30 focus:border-[#04ACEC] outline-none text-xl py-2 placeholder:text-white/30 transition-colors"
              />
              {etapa.rotulo && (
                <p className="text-white/40 text-xs mt-3">
                  <span className="text-[#FCCC0C]">*</span> campo obrigatório
                </p>
              )}
            </div>
          )}

          {erro && <p className="text-red-300 text-sm mt-3">{erro}</p>}

          <div className="flex items-center gap-4 mt-8">
            <button
              onClick={avancar}
              disabled={pending || statusCpf === "verificando"}
              className="bg-gradient-to-r from-[#FC9704] to-[#FCCC0C] text-[#040464] rounded px-5 py-2 font-semibold disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {statusCpf === "verificando"
                ? "Verificando..."
                : pending
                ? "Enviando..."
                : ultimaEtapa
                ? "Enviar"
                : "OK"}
            </button>
            <span className="text-white/40 text-sm">
              ou pressione <strong>Enter ↵</strong>
            </span>
            {passo > 0 && (
              <button
                onClick={voltar}
                className="ml-auto text-sm text-white/70 border border-white/20 rounded px-4 py-2 hover:bg-white/10 hover:border-white/40 hover:text-white transition-colors cursor-pointer"
              >
                ← voltar
              </button>
            )}
          </div>
        </div>
      </div>

      {statusCpf === "existente" && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <div className="bg-[#040464] border border-white/20 rounded-xl max-w-sm w-full p-6 text-center animate-etapa">
            <h2 className="text-xl font-semibold mb-2">Você já tem cadastro</h2>
            <p className="text-white/70 text-sm mb-6">
              Já existe um cadastro com esse CPF. Quer atualizar as
              informações com os dados que você está preenchendo agora?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={confirmarAtualizacaoCpf}
                className="bg-gradient-to-r from-[#FC9704] to-[#FCCC0C] text-[#040464] rounded px-5 py-2 font-semibold cursor-pointer"
              >
                Sim, atualizar meus dados
              </button>
              <button
                onClick={corrigirCpf}
                className="text-sm text-white/70 border border-white/20 rounded px-4 py-2 hover:bg-white/10 hover:border-white/40 hover:text-white transition-colors cursor-pointer"
              >
                Não, esse CPF está errado
              </button>
            </div>
          </div>
        </div>
      )}

      {avisoBancoDiferente && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <div className="bg-[#040464] border border-white/20 rounded-xl max-w-sm w-full p-6 text-center animate-etapa">
            <h2 className="text-xl font-semibold mb-2">Você escolheu outro banco</h2>
            <p className="text-white/70 text-sm mb-6">
              Como vendedor, você pode receber em qualquer banco — mas o
              Banco Exemplo evita possíveis taxas de transferência. Quer continuar com
              o banco que você escolheu mesmo assim?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={confirmarBancoDiferente}
                className="bg-gradient-to-r from-[#FC9704] to-[#FCCC0C] text-[#040464] rounded px-5 py-2 font-semibold cursor-pointer"
              >
                Sim, continuar com esse banco
              </button>
              <button
                onClick={trocarParaBancoExemplo}
                className="text-sm text-white/70 border border-white/20 rounded px-4 py-2 hover:bg-white/10 hover:border-white/40 hover:text-white transition-colors cursor-pointer"
              >
                Trocar para Banco Exemplo
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
