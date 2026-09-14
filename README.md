# Cadastro Bancário de Vendedores (demo)

Versão sanitizada de um sistema em produção, construído para substituir o cadastro manual (Excel/WhatsApp) de dados bancários de uma equipe de vendas por um fluxo público, autovalidado, com painel administrativo segregado por área.

> Nomes de empresa, banco e marca neste repositório são fictícios. O sistema real está em produção há vários meses.

## Problema original

Vendedores recebiam comissão via PIX, mas os dados bancários eram coletados manualmente (RH digitando, ou repasse por WhatsApp) — gerando erros de digitação que atrasavam ou impediam o pagamento. O pedido do financeiro foi simples: "um lugar pra guardar os dados bancários dos vendedores". O desenho de solução (evitar erro de digitação colocando o próprio vendedor como fonte do dado) partiu daí.

## O que o sistema faz

- **Formulário público, sem login** — o próprio vendedor preenche em um fluxo estilo "typeform" (uma pergunta por tela).
- **Classificação automática de chave PIX** — identifica CPF, CNPJ, e-mail, telefone ou chave aleatória por formato/dígito verificador, e só avança se a chave for válida.
- **Regra de negócio condicional** — funcionários CLT têm o banco pré-definido automaticamente (exigência da folha de pagamento); vendedores comissionados escolhem livremente, com um banco sugerido em destaque.
- **Upsert por CPF** — reenviar o formulário com o mesmo CPF atualiza o cadastro existente em vez de duplicar.
- **Painel administrativo autenticado** (Clerk) — lista, busca, filtros, exportação CSV, marcação de cadastro com problema (pagamento falhou).
- **Segregação de dados por área** — RH e Financeiro logam no mesmo painel, mas cada um só recebe (no servidor, não só na UI) as colunas relevantes à sua função. Financeiro não vê dado pessoal; RH não vê dado bancário.
- **Aprovação manual de acesso** — cadastro de conta no painel é livre, mas só libera visualização depois de aprovação manual via metadata do Clerk, sincronizada por webhook com o banco.

## Stack

Next.js (App Router) · Supabase (Postgres) · Clerk (auth) · Tailwind CSS

A validação/classificação de CPF, CNPJ e chave PIX foi extraída para uma lib própria, sem dependências: [pix-chave-validator](https://github.com/SrMesquitaa/pix-chave-validator).

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencher com suas próprias credenciais Supabase/Clerk
npm run dev
```

