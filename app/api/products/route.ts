import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function checkAuth(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  return key && key === process.env.ADMIN_API_KEY;
}

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const produtos = await prisma.produto.findMany({
    where: status ? { status: status as any } : undefined,
    include: { categoria: true, ofertas: { include: { loja: true } } },
    orderBy: { atualizadoEm: "desc" },
  });
  return NextResponse.json(produtos);
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.nome || !body?.categoriaId) {
    return NextResponse.json({ error: "'nome' e 'categoriaId' são obrigatórios." }, { status: 400 });
  }

  const slug = body.nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const produto = await prisma.produto.create({
    data: {
      nome: body.nome,
      slug: `${slug}-${Date.now().toString(36)}`,
            descricao: body.descricao || null,
      imagemPrincipal: body.imagemPrincipal || null,
      status: body.status || "PENDENTE",
      categoriaId: body.categoriaId,
      ofertas: body.ofertas
        ? {
            create: body.ofertas.map((o: any) => ({
              lojaId: o.lojaId,
              preco: o.preco,
              precoAnterior: o.precoAnterior || null,
              frete: o.frete || null,
              avaliacao: o.avaliacao || null,
              linkOriginal: o.linkOriginal,
              linkAfiliado: o.linkAfiliado || null,
            })),
          }
        : undefined,
    },
    include: { ofertas: true },
  });

  return NextResponse.json(produto, { status: 201 });
}
