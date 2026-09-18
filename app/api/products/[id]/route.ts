import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function checkAuth(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  return key && key === process.env.ADMIN_API_KEY;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const produto = await prisma.produto.update({
    where: { id: params.id },
    data: {
            nome: body.nome,
      descricao: body.descricao,
      imagemPrincipal: body.imagemPrincipal,
      status: body.status,
      categoriaId: body.categoriaId,
    },
  });

  if (Array.isArray(body.ofertas)) {
    for (const o of body.ofertas) {
      await prisma.oferta.upsert({
        where: { produtoId_lojaId: { produtoId: params.id, lojaId: o.lojaId } },
        update: {
          preco: o.preco,
          precoAnterior: o.precoAnterior || null,
          frete: o.frete || null,
          avaliacao: o.avaliacao || null,
          linkOriginal: o.linkOriginal,
          linkAfiliado: o.linkAfiliado || null,
        },
        create: {
          produtoId: params.id,
          lojaId: o.lojaId,
          preco: o.preco,
          precoAnterior: o.precoAnterior || null,
          frete: o.frete || null,
          avaliacao: o.avaliacao || null,
          linkOriginal: o.linkOriginal,
          linkAfiliado: o.linkAfiliado || null,
        },
      });
    }
    const lojaIdsEnviados = body.ofertas.map((o: any) => o.lojaId);
    await prisma.oferta.deleteMany({
      where: { produtoId: params.id, lojaId: { notIn: lojaIdsEnviados } },
    });
  }

  const produtoCompleto = await prisma.produto.findUnique({
    where: { id: params.id },
    include: { ofertas: { include: { loja: true } }, categoria: true },
  });

  return NextResponse.json(produtoCompleto);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  await prisma.produto.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
