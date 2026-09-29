import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function checkAuth(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  return key && key === process.env.ADMIN_API_KEY;
}

function gerarSlug(nome: string) {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizarLinha(linha: any) {
  const limpo: any = {};
  for (const chave in linha) {
    const chaveLimpa = chave.replace(/^\uFEFF/, "").trim();
    const valor = typeof linha[chave] === "string" ? linha[chave].trim() : linha[chave];
    limpo[chaveLimpa] = valor;
  }
  return limpo;
}

const STATUS_VALIDOS = ["RASCUNHO", "PENDENTE", "PUBLICADO", "ERRO"];
const MAX_LINHAS = 500;

function isUrlValida(url: string) {
  try { new URL(url); return true; } catch { return false; }
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const linhasBrutas = body?.linhas;
  const confirmar = body?.confirmar === true;

  if (!Array.isArray(linhasBrutas)) {
    return NextResponse.json({ error: "Envie 'linhas' como um array." }, { status: 400 });
  }
  if (linhasBrutas.length === 0) {
    return NextResponse.json({ error: "O arquivo está vazio." }, { status: 400 });
  }
  if (linhasBrutas.length > MAX_LINHAS) {
    return NextResponse.json(
      { error: `Máximo de ${MAX_LINHAS} linhas por importação. Divida o arquivo em partes menores.` },
      { status: 400 }
    );
  }

  const linhas = linhasBrutas.map(normalizarLinha);

  const [categorias, lojas, produtosExistentes] = await Promise.all([
    prisma.categoria.findMany(),
    prisma.loja.findMany(),
    prisma.produto.findMany({ select: { nome: true, categoriaId: true } }),
  ]);

  const catPorChave = new Map<string, (typeof categorias)[number]>();
  categorias.forEach((c) => {
    catPorChave.set(c.nome.toLowerCase(), c);
    catPorChave.set(c.slug.toLowerCase(), c);
  });
  const lojaPorChave = new Map<string, (typeof lojas)[number]>();
  lojas.forEach((l) => {
    lojaPorChave.set(l.nome.toLowerCase(), l);
    lojaPorChave.set(l.slug.toLowerCase(), l);
  });
  const existentesChave = new Set(
    produtosExistentes.map((p) => `${p.nome.trim().toLowerCase()}::${p.categoriaId}`)
  );

  // Primeira passada: valida cada linha individualmente.
  const linhasValidadas = linhas.map((linha: any, i: number) => {
    const numero = i + 2; // +2: linha 1 do arquivo é o cabeçalho
    const nome = String(linha.nome || "").trim();
    const categoriaChave = String(linha.categoria || "").trim().toLowerCase();
    const lojaChave = String(linha.loja || "").trim().toLowerCase();
    const precoRaw = String(linha.preco ?? "").trim().replace(",", ".");
    const precoAnteriorRaw = String(linha.preco_anterior ?? "").trim().replace(",", ".");
    const linkOriginal = String(linha.link_original || "").trim();
    const status = String(linha.status || "PENDENTE").trim().toUpperCase();

    const erros: string[] = [];
    if (!nome) erros.push("nome é obrigatório");
    if (nome.length > 200) erros.push("nome muito longo (máx. 200 caracteres)");
    if (!categoriaChave) erros.push("categoria é obrigatória");
    const categoria = categoriaChave ? catPorChave.get(categoriaChave) : undefined;
    if (categoriaChave && !categoria) erros.push("categoria não encontrada");
    if (!lojaChave) erros.push("loja é obrigatória");
    const loja = lojaChave ? lojaPorChave.get(lojaChave) : undefined;
    if (lojaChave && !loja) erros.push("loja não encontrada");
    const preco = parseFloat(precoRaw);
    if (!precoRaw || isNaN(preco) || preco <= 0) erros.push("preço inválido");
    let precoAnterior: number | null = null;
    if (precoAnteriorRaw) {
      precoAnterior = parseFloat(precoAnteriorRaw);
      if (isNaN(precoAnterior)) erros.push("preço anterior inválido");
    }
    if (!linkOriginal) erros.push("link_original é obrigatório");
    else if (!isUrlValida(linkOriginal)) erros.push("link_original não é uma URL válida");
    if (linha.link_afiliado && !isUrlValida(String(linha.link_afiliado)))
      erros.push("link_afiliado não é uma URL válida");
    if (!STATUS_VALIDOS.includes(status))
      erros.push("status inválido (use RASCUNHO, PENDENTE, PUBLICADO ou ERRO)");

    return {
      linha: numero,
      nome,
      categoria,
      categoriaTexto: categoria?.nome || linha.categoria || "",
      loja,
      lojaTexto: loja?.nome || linha.loja || "",
      preco: isNaN(preco) ? null : preco,
      precoAnterior,
      descricao: linha.descricao || null,
      imagemPrincipal: linha.imagem || null,
      frete: linha.frete || null,
      avaliacao: linha.avaliacao || null,
      linkOriginal,
      linkAfiliado: linha.link_afiliado || null,
      status,
      erros,
      grupoChave: nome && categoria ? `${nome.toLowerCase()}::${categoria.id}` : null,
    };
  });

  // Segunda passada: agrupa linhas válidas por produto (nome + categoria) e
  // detecta duas ofertas da mesma loja dentro do mesmo grupo.
  const grupos = new Map<string, typeof linhasValidadas>();
  linhasValidadas.forEach((l) => {
    if (l.erros.length > 0 || !l.grupoChave) return;
    if (!grupos.has(l.grupoChave)) grupos.set(l.grupoChave, []);
    grupos.get(l.grupoChave)!.push(l);
  });

  const jaExisteNoBanco = new Set<string>();
  grupos.forEach((_, chave) => {
    if (existentesChave.has(chave)) jaExisteNoBanco.add(chave);
  });

  grupos.forEach((itens) => {
    const lojasVistas = new Set<string>();
    itens.forEach((item) => {
      const lojaId = item.loja!.id;
      if (lojasVistas.has(lojaId)) {
        item.erros.push(`loja "${item.lojaTexto}" repetida para o mesmo produto nesta importação`);
      }
      lojasVistas.add(lojaId);
    });
  });

  const resultado = linhasValidadas.map((l) => {
    const duplicado = l.grupoChave ? jaExisteNoBanco.has(l.grupoChave) : false;
    return {
      linha: l.linha,
      nome: l.nome,
      categoria: l.categoriaTexto,
      loja: l.lojaTexto,
      preco: l.preco,
      situacao: l.erros.length ? "ERRO" : duplicado ? "IGNORADO" : "OK",
      motivo: l.erros.length ? l.erros.join("; ") : duplicado ? "produto já cadastrado nessa categoria" : null,
    };
  });

  if (!confirmar) {
    return NextResponse.json({
      total: resultado.length,
      prontos: resultado.filter((r) => r.situacao === "OK").length,
      ignorados: resultado.filter((r) => r.situacao === "IGNORADO").length,
      comErro: resultado.filter((r) => r.situacao === "ERRO").length,
      linhas: resultado,
    });
  }

  let adicionados = 0;
  let falhasAoSalvar = 0;

  for (const [chave, itens] of grupos) {
    if (jaExisteNoBanco.has(chave)) continue;
    const valid = itens.filter((it) => it.erros.length === 0);
    if (valid.length === 0) continue;
    const base = valid[0];
    try {
      const slug = `${gerarSlug(base.nome)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      await prisma.produto.create({
        data: {
          nome: base.nome,
          slug,
          descricao: valid.find((v) => v.descricao)?.descricao || null,
          imagemPrincipal: valid.find((v) => v.imagemPrincipal)?.imagemPrincipal || null,
          status: base.status as any,
          categoriaId: base.categoria!.id,
          ofertas: {
            create: valid.map((v) => ({
              lojaId: v.loja!.id,
              preco: v.preco!,
              precoAnterior: v.precoAnterior,
              frete: v.frete,
              avaliacao: v.avaliacao,
              linkOriginal: v.linkOriginal,
              linkAfiliado: v.linkAfiliado,
            })),
          },
        },
      });
      adicionados += valid.length;
    } catch {
      falhasAoSalvar += valid.length;
    }
  }

  return NextResponse.json({
    adicionados,
    ignorados: resultado.filter((r) => r.situacao === "IGNORADO").length,
    comErro: resultado.filter((r) => r.situacao === "ERRO").length + falhasAoSalvar,
  });
}
