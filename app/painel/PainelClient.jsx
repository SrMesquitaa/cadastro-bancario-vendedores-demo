"use client";

import { useMemo, useState, useTransition } from "react";
import { UserButton } from "@clerk/nextjs";
import LogoLink from "@/components/LogoLink";
import { mascararTelefone } from "@/lib/telefone";
import { alternarStatusProblema } from "./actions";

const ROTULOS_SEXO = {
  masculino: "Masculino",
  feminino: "Feminino",
  prefiro_nao_informar: "Prefiro não informar",
};

const ROTULOS_TIPO_CHAVE = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  telefone: "Telefone",
  aleatoria: "Aleatória",
};

// data_nascimento/data_admissao sao "YYYY-MM-DD" sem horario -- passar por
// new Date() aplicaria timezone e podia voltar um dia (meia-noite UTC vira
// dia anterior em America/Sao_Paulo). Formata direto da string.
function formatarDataSemFuso(valor) {
  if (!valor) return "";
  const [ano, mes, dia] = valor.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarData(valor) {
  return new Date(valor).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function formatarDataHora(valor) {
  return new Date(valor).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

const COLUNAS_EXPORT_COMUNS = [
  { rotulo: "Nome", valor: (l) => l.nome_titular },
  { rotulo: "CPF", valor: (l) => l.cpf_titular, forcarTexto: true },
  { rotulo: "Tipo de contrato", valor: (l) => l.tipo_contrato },
];

const COLUNAS_EXPORT_FINANCEIRO = [
  { rotulo: "Banco", valor: (l) => l.banco },
  { rotulo: "Agência", valor: (l) => l.agencia, forcarTexto: true },
  { rotulo: "Conta", valor: (l) => l.conta, forcarTexto: true },
  { rotulo: "Chave PIX PF", valor: (l) => l.chave_pix_pf, forcarTexto: true },
  { rotulo: "Tipo de chave PIX PF", valor: (l) => l.tipo_chave_pix_pf },
  { rotulo: "PIX Conta PJ", valor: (l) => l.chave_pix_pj, forcarTexto: true },
  { rotulo: "Tipo de chave PIX PJ", valor: (l) => l.tipo_chave_pix_pj },
  { rotulo: "Status", valor: (l) => l.status },
];

const COLUNAS_EXPORT_RH = [
  { rotulo: "Data de nascimento", valor: (l) => formatarDataSemFuso(l.data_nascimento) },
  { rotulo: "Sexo", valor: (l) => ROTULOS_SEXO[l.sexo] || l.sexo },
  { rotulo: "WhatsApp", valor: (l) => mascararTelefone(l.whatsapp), forcarTexto: true },
  { rotulo: "Data de admissão", valor: (l) => formatarDataSemFuso(l.data_admissao) },
];

const COLUNA_EXPORT_CRIADO_EM = {
  rotulo: "Criado em",
  valor: (l) => new Date(l.criado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
};

const COLUNAS_ORDENAVEIS_COMUNS = [
  { chave: "nome_titular", rotulo: "Nome" },
  { chave: "tipo_contrato", rotulo: "Contrato" },
  { chave: "criado_em", rotulo: "Criado em" },
];

const ROTULOS_AREA = {
  rh: "RH",
  financeiro: "Financeiro",
  ambos: "RH e Financeiro",
  outro: "Outro setor",
};

const ITENS_POR_PAGINA = 50;

export default function PainelClient({ dadosIniciais, usuarioAtual, area }) {
  // Acesso as colunas e sempre total -- "area" so identifica o setor real
  // da pessoa pro cabecalho do painel, nao restringe mais o que ela ve.
  const ehFinanceiro = true;
  const ehRh = true;

  const [dados, setDados] = useState(dadosIniciais);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroContrato, setFiltroContrato] = useState("");
  const [filtroBanco, setFiltroBanco] = useState("");
  const [filtroChavePix, setFiltroChavePix] = useState("");
  const [filtroChavePixPj, setFiltroChavePixPj] = useState("");
  const [filtroSexo, setFiltroSexo] = useState("");
  const [sortKey, setSortKey] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [detalhe, setDetalhe] = useState(null);
  const [pending, startTransition] = useTransition();
  const [idAtualizando, setIdAtualizando] = useState(null);
  const [erroDetalhe, setErroDetalhe] = useState(null);
  const [chaveCopiada, setChaveCopiada] = useState(null);
  const [exportando, setExportando] = useState(false);
  const [paginaAtual, setPaginaAtual] = useState(1);

  const COLUNAS_EXPORT = useMemo(
    () => [
      ...COLUNAS_EXPORT_COMUNS,
      ...(ehRh ? COLUNAS_EXPORT_RH : []),
      ...(ehFinanceiro ? COLUNAS_EXPORT_FINANCEIRO : []),
      COLUNA_EXPORT_CRIADO_EM,
    ],
    [ehRh, ehFinanceiro]
  );

  function copiarChavePix(e, id, chave) {
    e.stopPropagation();
    if (!chave) return;
    navigator.clipboard.writeText(chave).then(() => {
      setChaveCopiada(id);
      setTimeout(() => setChaveCopiada((atual) => (atual === id ? null : atual)), 1500);
    });
  }

  const bancosDisponiveis = useMemo(
    () => [...new Set(dados.map((l) => l.banco).filter(Boolean))].sort(),
    [dados]
  );

  const resumo = useMemo(
    () => ({
      total: dados.length,
      funcionario: dados.filter((l) => l.tipo_contrato === "funcionario").length,
      vendedor: dados.filter((l) => l.tipo_contrato === "vendedor").length,
      comProblema: dados.filter((l) => l.status === "invalido").length,
    }),
    [dados]
  );

  const filtrados = useMemo(() => {
    const buscaDigitos = busca.replace(/\D/g, "");
    const buscaTexto = busca.trim().toLowerCase();
    return dados.filter((linha) => {
      if (filtroStatus && linha.status !== filtroStatus) return false;
      if (filtroContrato && linha.tipo_contrato !== filtroContrato) return false;
      if (filtroBanco && linha.banco !== filtroBanco) return false;
      if (filtroChavePix && linha.tipo_chave_pix_pf !== filtroChavePix) return false;
      if (filtroSexo && linha.sexo !== filtroSexo) return false;
      if (filtroChavePixPj === "sem" && linha.chave_pix_pj) return false;
      if (
        filtroChavePixPj &&
        filtroChavePixPj !== "sem" &&
        linha.tipo_chave_pix_pj !== filtroChavePixPj
      )
        return false;
      if (buscaTexto) {
        const nomeMatch = (linha.nome_titular || "").toLowerCase().includes(buscaTexto);
        const cpfMatch = buscaDigitos && (linha.cpf_titular || "").includes(buscaDigitos);
        if (!nomeMatch && !cpfMatch) return false;
      }
      return true;
    });
  }, [
    dados,
    busca,
    filtroStatus,
    filtroContrato,
    filtroBanco,
    filtroChavePix,
    filtroChavePixPj,
    filtroSexo,
  ]);

  const filtrosAtivos = Boolean(
    busca ||
      filtroStatus ||
      filtroContrato ||
      filtroBanco ||
      filtroChavePix ||
      filtroChavePixPj ||
      filtroSexo
  );

  function limparFiltros() {
    setBusca("");
    setFiltroStatus("");
    setFiltroContrato("");
    setFiltroBanco("");
    setFiltroChavePix("");
    setFiltroChavePixPj("");
    setFiltroSexo("");
  }

  const ordenados = useMemo(() => {
    if (!sortKey) return filtrados;
    const copia = [...filtrados];
    copia.sort((a, b) => {
      const av = (a[sortKey] ?? "").toString();
      const bv = (b[sortKey] ?? "").toString();
      return av.localeCompare(bv, "pt-BR") * (sortAsc ? 1 : -1);
    });
    return copia;
  }, [filtrados, sortKey, sortAsc]);

  function alternarOrdenacao(chave) {
    if (sortKey === chave) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(chave);
      setSortAsc(true);
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / ITENS_POR_PAGINA));

  // Volta pra pagina 1 sempre que filtro/ordenacao mudam -- ajuste de estado
  // durante o render (nao em useEffect) pra nao disparar um segundo ciclo de
  // renderizacao a toa.
  const chavePaginacao = JSON.stringify([
    busca,
    filtroStatus,
    filtroContrato,
    filtroBanco,
    filtroChavePix,
    filtroChavePixPj,
    filtroSexo,
    sortKey,
    sortAsc,
  ]);
  const [paginacaoAnterior, setPaginacaoAnterior] = useState(chavePaginacao);
  if (chavePaginacao !== paginacaoAnterior) {
    setPaginacaoAnterior(chavePaginacao);
    setPaginaAtual(1);
  }

  const paginaValida = Math.min(paginaAtual, totalPaginas);

  const paginados = useMemo(
    () => ordenados.slice((paginaValida - 1) * ITENS_POR_PAGINA, paginaValida * ITENS_POR_PAGINA),
    [ordenados, paginaValida]
  );

  async function exportarPlanilha() {
    setExportando(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Cadastros");
      sheet.columns = COLUNAS_EXPORT.map((c) => ({ header: c.rotulo, width: 22 }));
      sheet.getRow(1).font = { bold: true };

      filtrados.forEach((linha) => {
        const row = sheet.addRow(COLUNAS_EXPORT.map((c) => c.valor(linha) ?? ""));
        COLUNAS_EXPORT.forEach((c, i) => {
          if (c.forcarTexto) {
            // Formato de texto de verdade na celula -- nao e formula, nao corta
            // zero a esquerda de CPF/agencia/chave PIX, sem gambiarra visivel.
            row.getCell(i + 1).numFmt = "@";
          }
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cadastros-${area}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportando(false);
    }
  }

  function alternarProblema(linha) {
    setIdAtualizando(linha.id);
    setErroDetalhe(null);
    startTransition(async () => {
      const resultado = await alternarStatusProblema(linha.id, linha.status);
      if (resultado.ok) {
        const atualizada = { ...linha, status: resultado.novoStatus };
        setDados((prev) => prev.map((l) => (l.id === linha.id ? atualizada : l)));
        setDetalhe((prev) => (prev && prev.id === linha.id ? atualizada : prev));
      } else {
        setErroDetalhe(resultado.error);
      }
      setIdAtualizando(null);
    });
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 p-6 sm:p-10">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="rounded-2xl p-6 bg-gradient-to-br from-[#040464] to-[#0A0A7A] text-white shadow-sm">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <LogoLink className="mb-3" />
              <h1 className="text-xl font-bold tracking-tight">
                Cadastros — {ROTULOS_AREA[area] || "RH & Financeiro"}
              </h1>
              <p className="text-xs text-white/55 mt-0.5">
                Dados pessoais, cadastrais e de pagamento dos vendedores/funcionários
              </p>
            </div>
            <div className="flex items-center gap-3">
              {usuarioAtual && (
                <div className="flex items-center gap-2 bg-white/8 border border-white/15 rounded-full pl-3 pr-1 py-1">
                  <div className="text-right leading-tight">
                    <p className="text-xs font-semibold">{usuarioAtual.nome}</p>
                    {(usuarioAtual.cargo || usuarioAtual.setor) && (
                      <p className="text-[10px] text-white/55">
                        {[usuarioAtual.cargo, usuarioAtual.setor].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <UserButton />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3.5 shadow-[0_1px_2px_rgba(4,4,100,0.04),0_1px_1px_rgba(4,4,100,0.03)]">
            <p className="text-[10.5px] uppercase tracking-wider text-slate-500 font-bold">
              Total de cadastros
            </p>
            <p className="text-2xl font-extrabold mt-1 tabular-nums text-[#040464]">
              {resumo.total}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3.5 shadow-[0_1px_2px_rgba(4,4,100,0.04),0_1px_1px_rgba(4,4,100,0.03)]">
            <p className="text-[10.5px] uppercase tracking-wider text-slate-500 font-bold">
              Funcionários
            </p>
            <p className="text-2xl font-extrabold mt-1 tabular-nums text-[#040464]">
              {resumo.funcionario}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3.5 shadow-[0_1px_2px_rgba(4,4,100,0.04),0_1px_1px_rgba(4,4,100,0.03)]">
            <p className="text-[10.5px] uppercase tracking-wider text-slate-500 font-bold">
              Vendedores
            </p>
            <p className="text-2xl font-extrabold mt-1 tabular-nums text-[#040464]">
              {resumo.vendedor}
            </p>
          </div>
          {ehFinanceiro && (
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3.5 shadow-[0_1px_2px_rgba(4,4,100,0.04),0_1px_1px_rgba(4,4,100,0.03)] border-l-[3px] border-l-[#FC9704]">
              <p className="text-[10.5px] uppercase tracking-wider text-slate-500 font-bold">
                Com problema
              </p>
              <p className="text-2xl font-extrabold mt-1 tabular-nums text-[#FC9704]">
                {resumo.comProblema}
              </p>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-[0_1px_2px_rgba(4,4,100,0.04),0_1px_1px_rgba(4,4,100,0.03)]">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#04ACEC]">
              Busca e Filtros
            </span>
            <div className="flex items-center gap-3.5">
              {filtrosAtivos && (
                <button
                  onClick={limparFiltros}
                  className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer whitespace-nowrap"
                >
                  Limpar tudo
                </button>
              )}
              {filtrados.length > 0 && (
                <button
                  onClick={exportarPlanilha}
                  disabled={exportando}
                  className="flex items-center gap-1.5 px-3.5 py-[7px] text-xs font-bold rounded-lg border-[1.5px] border-[#040464] bg-white text-[#040464] hover:bg-[#040464]/5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  {exportando ? "Exportando..." : "Exportar Excel"}
                </button>
              )}
            </div>
          </div>

          <div className="relative mb-3.5">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </span>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou CPF"
              className={`w-full h-10 rounded-lg border-[1.5px] border-slate-200 bg-slate-50 text-sm outline-none focus:border-[#04ACEC] pl-9 ${busca ? "pr-9" : "pr-3.5"}`}
            />
            {busca && (
              <button
                onClick={() => setBusca("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer text-base leading-none"
              >
                ✕
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Contrato
              </label>
              <select
                value={filtroContrato}
                onChange={(e) => setFiltroContrato(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#04ACEC]/30 focus:border-[#04ACEC]"
              >
                <option value="">Todos</option>
                <option value="funcionario">Funcionário</option>
                <option value="vendedor">Vendedor</option>
              </select>
            </div>

            {ehFinanceiro && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </label>
                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#04ACEC]/30 focus:border-[#04ACEC]"
                  >
                    <option value="">Todos</option>
                    <option value="nao_verificado">Normal</option>
                    <option value="invalido">Problema sinalizado</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Banco
                  </label>
                  <select
                    value={filtroBanco}
                    onChange={(e) => setFiltroBanco(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#04ACEC]/30 focus:border-[#04ACEC]"
                  >
                    <option value="">Todos</option>
                    {bancosDisponiveis.map((banco) => (
                      <option key={banco} value={banco}>
                        {banco}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Tipo de chave PIX PF
                  </label>
                  <select
                    value={filtroChavePix}
                    onChange={(e) => setFiltroChavePix(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#04ACEC]/30 focus:border-[#04ACEC]"
                  >
                    <option value="">Todos</option>
                    <option value="cpf">CPF</option>
                    <option value="cnpj">CNPJ</option>
                    <option value="email">E-mail</option>
                    <option value="telefone">Telefone</option>
                    <option value="aleatoria">Aleatória</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Tipo de chave PJ
                  </label>
                  <select
                    value={filtroChavePixPj}
                    onChange={(e) => setFiltroChavePixPj(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#04ACEC]/30 focus:border-[#04ACEC]"
                  >
                    <option value="">Todos</option>
                    <option value="sem">Sem conta PJ</option>
                    <option value="cpf">CPF</option>
                    <option value="cnpj">CNPJ</option>
                    <option value="email">E-mail</option>
                    <option value="telefone">Telefone</option>
                    <option value="aleatoria">Aleatória</option>
                  </select>
                </div>
              </>
            )}

            {ehRh && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Sexo
                </label>
                <select
                  value={filtroSexo}
                  onChange={(e) => setFiltroSexo(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#04ACEC]/30 focus:border-[#04ACEC]"
                >
                  <option value="">Todos</option>
                  <option value="masculino">Masculino</option>
                  <option value="feminino">Feminino</option>
                  <option value="prefiro_nao_informar">Prefiro não informar</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_1px_2px_rgba(4,4,100,0.04),0_1px_1px_rgba(4,4,100,0.03)]">
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#04ACEC] whitespace-nowrap">
              {ordenados.length} cadastro{ordenados.length === 1 ? "" : "s"} encontrado
              {ordenados.length === 1 ? "" : "s"}
            </span>
            <span className="flex-1 h-px bg-slate-200 min-w-[20px]" />
          </div>
          <div className="overflow-x-auto overflow-y-hidden scroll-visivel">
          <table className="w-full min-w-max text-sm">
            <thead className="text-left">
              <tr>
                {COLUNAS_ORDENAVEIS_COMUNS.map((coluna) => (
                  <th
                    key={coluna.chave}
                    onClick={() => alternarOrdenacao(coluna.chave)}
                    className="px-4 py-3 font-bold text-[11px] uppercase tracking-widest text-slate-500 border-b border-slate-200 cursor-pointer select-none whitespace-nowrap"
                  >
                    {coluna.rotulo}
                    <span
                      className={
                        sortKey === coluna.chave ? "ml-1 text-[#04ACEC]" : "ml-1 text-slate-300"
                      }
                    >
                      {sortKey === coluna.chave && !sortAsc ? "▲" : "▼"}
                    </span>
                  </th>
                ))}
                {ehRh && (
                  <>
                    <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-widest text-slate-500 border-b border-slate-200">
                      Nascimento
                    </th>
                    <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-widest text-slate-500 border-b border-slate-200">
                      Sexo
                    </th>
                    <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-widest text-slate-500 border-b border-slate-200">
                      WhatsApp
                    </th>
                    <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-widest text-slate-500 border-b border-slate-200">
                      Admissão
                    </th>
                  </>
                )}
                {ehFinanceiro && (
                  <>
                    <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-widest text-slate-500 border-b border-slate-200">
                      Banco
                    </th>
                    <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-widest text-slate-500 border-b border-slate-200">
                      Chave PIX PF
                    </th>
                    <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-widest text-slate-500 border-b border-slate-200">
                      PIX Conta PJ
                    </th>
                    <th className="px-4 py-3 font-bold text-[11px] uppercase tracking-widest text-slate-500 border-b border-slate-200">
                      Status
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {paginados.map((linha) => (
                <tr
                  key={linha.id}
                  onClick={() => setDetalhe(linha)}
                  className="border-b border-slate-100 last:border-none hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium">{linha.nome_titular}</span>
                      <span className="text-xs text-slate-400 tabular-nums">
                        {linha.cpf_titular}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        linha.tipo_contrato === "funcionario"
                          ? "inline-block bg-slate-50 text-slate-600 border border-slate-200 text-xs font-semibold px-2.5 py-1 rounded-full"
                          : "inline-block bg-[#04ACEC]/10 text-[#035577] border border-[#04ACEC]/25 text-xs font-semibold px-2.5 py-1 rounded-full"
                      }
                    >
                      {linha.tipo_contrato === "funcionario" ? "Funcionário" : "Vendedor"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    {formatarData(linha.criado_em)}
                  </td>
                  {ehRh && (
                    <>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                        {formatarDataSemFuso(linha.data_nascimento)}
                      </td>
                      <td className="px-4 py-3">{ROTULOS_SEXO[linha.sexo] || linha.sexo}</td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                        {mascararTelefone(linha.whatsapp)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                        {formatarDataSemFuso(linha.data_admissao)}
                      </td>
                    </>
                  )}
                  {ehFinanceiro && (
                    <>
                      <td className="px-4 py-3">{linha.banco}</td>
                      <td
                        className="px-4 py-3 cursor-pointer hover:bg-[#04ACEC]/5"
                        title="Clique para copiar"
                        onClick={(e) => copiarChavePix(e, `${linha.id}-pf`, linha.chave_pix_pf)}
                      >
                        {chaveCopiada === `${linha.id}-pf` ? (
                          <span className="text-emerald-600 font-semibold text-xs">Copiado!</span>
                        ) : (
                          <div className="flex flex-col">
                            <span>{linha.chave_pix_pf}</span>
                            <span className="text-xs text-slate-400 mt-0.5">
                              {ROTULOS_TIPO_CHAVE[linha.tipo_chave_pix_pf] || linha.tipo_chave_pix_pf}
                            </span>
                          </div>
                        )}
                      </td>
                      <td
                        className={`px-4 py-3 ${linha.chave_pix_pj ? "cursor-pointer hover:bg-[#04ACEC]/5" : ""}`}
                        title={linha.chave_pix_pj ? "Clique para copiar" : undefined}
                        onClick={(e) => copiarChavePix(e, `${linha.id}-pj`, linha.chave_pix_pj)}
                      >
                        {chaveCopiada === `${linha.id}-pj` ? (
                          <span className="text-emerald-600 font-semibold text-xs">Copiado!</span>
                        ) : linha.chave_pix_pj ? (
                          <div className="flex flex-col">
                            <span>{linha.chave_pix_pj}</span>
                            <span className="text-xs text-slate-400 mt-0.5">
                              {ROTULOS_TIPO_CHAVE[linha.tipo_chave_pix_pj] || linha.tipo_chave_pix_pj}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {linha.status === "invalido" ? (
                          <span className="inline-block bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold px-2.5 py-1 rounded-full">
                            Problema
                          </span>
                        ) : (
                          <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-1 rounded-full">
                            Normal
                          </span>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {ordenados.length === 0 && (
                <tr>
                  <td
                    colSpan={3 + (ehRh ? 4 : 0) + (ehFinanceiro ? 4 : 0)}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    Nenhum cadastro encontrado com esses filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
          {ordenados.length > 0 && (
            <div className="flex items-center justify-center gap-2 px-5 py-4 border-t border-slate-100 flex-wrap">
              <button
                onClick={() => setPaginaAtual(1)}
                disabled={paginaValida === 1}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                « Primeira
              </button>
              <button
                onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                disabled={paginaValida === 1}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                ‹ Anterior
              </button>
              <span className="text-sm font-bold text-[#040464] tabular-nums mx-2">
                Página {paginaValida} de {totalPaginas}
              </span>
              <button
                onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaValida === totalPaginas}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Próxima ›
              </button>
              <button
                onClick={() => setPaginaAtual(totalPaginas)}
                disabled={paginaValida === totalPaginas}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Última »
              </button>
            </div>
          )}
        </div>
      </div>

      {detalhe && (
        <>
          <div
            className="fixed inset-0 bg-[#0A0A1E]/40 z-40"
            onClick={() => setDetalhe(null)}
          />
          <div className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col">
            <div className="p-6 border-b border-slate-100">
              <button
                onClick={() => setDetalhe(null)}
                className="float-right text-slate-400 hover:text-slate-700 cursor-pointer text-lg leading-none"
                aria-label="Fechar"
              >
                ✕
              </button>
              <p className="text-lg font-bold text-[#040464]">{detalhe.nome_titular}</p>
              <p className="text-xs text-slate-400 tabular-nums mt-0.5">
                {detalhe.cpf_titular}
              </p>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">
                    Tipo de contrato
                  </p>
                  <p className="text-sm">
                    {detalhe.tipo_contrato === "funcionario" ? "Funcionário" : "Vendedor"}
                  </p>
                </div>
                {ehFinanceiro && (
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">
                      Status
                    </p>
                    {detalhe.status === "invalido" ? (
                      <span className="inline-block bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold px-2.5 py-1 rounded-full">
                        Problema
                      </span>
                    ) : (
                      <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-1 rounded-full">
                        Normal
                      </span>
                    )}
                  </div>
                )}
              </div>

              {ehRh && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">
                        Data de nascimento
                      </p>
                      <p className="text-sm tabular-nums">
                        {formatarDataSemFuso(detalhe.data_nascimento)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">
                        Sexo
                      </p>
                      <p className="text-sm">{ROTULOS_SEXO[detalhe.sexo] || detalhe.sexo}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">
                        WhatsApp
                      </p>
                      <p className="text-sm tabular-nums">{mascararTelefone(detalhe.whatsapp)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">
                        Data de admissão
                      </p>
                      <p className="text-sm tabular-nums">
                        {formatarDataSemFuso(detalhe.data_admissao)}
                      </p>
                    </div>
                  </div>
                </>
              )}

              {ehFinanceiro && (
                <>
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">
                      Banco
                    </p>
                    <p className="text-sm">{detalhe.banco}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">
                        Agência
                      </p>
                      <p className="text-sm tabular-nums">{detalhe.agencia}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">
                        Conta
                      </p>
                      <p className="text-sm tabular-nums">{detalhe.conta}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">
                      Chave PIX PF
                    </p>
                    <p className="text-sm">{detalhe.chave_pix_pf}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {ROTULOS_TIPO_CHAVE[detalhe.tipo_chave_pix_pf] || detalhe.tipo_chave_pix_pf}
                    </p>
                  </div>
                  {detalhe.chave_pix_pj && (
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">
                        PIX Conta PJ
                      </p>
                      <p className="text-sm">{detalhe.chave_pix_pj}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {ROTULOS_TIPO_CHAVE[detalhe.tipo_chave_pix_pj] || detalhe.tipo_chave_pix_pj}
                      </p>
                    </div>
                  )}
                </>
              )}

              <div>
                <p className="text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">
                  Criado em
                </p>
                <p className="text-sm tabular-nums">{formatarDataHora(detalhe.criado_em)}</p>
              </div>
            </div>
            {ehFinanceiro && (
              <div className="p-6 border-t border-slate-100">
                <button
                  onClick={() => alternarProblema(detalhe)}
                  disabled={pending && idAtualizando === detalhe.id}
                  className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 hover:bg-slate-50 disabled:opacity-50 cursor-pointer font-semibold"
                >
                  {detalhe.status === "invalido" ? "Desmarcar problema" : "Marcar problema"}
                </button>
                {erroDetalhe && (
                  <p className="text-red-600 text-xs mt-2">{erroDetalhe}</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
