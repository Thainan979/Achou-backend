import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const LOJAS = ["Mercado Livre", "Shopee", "SHEIN"];
const CATEGORIAS = ["Eletrônicos", "Casa", "Moda", "Beleza", "Games", "Esportes"];

function slugify(v: string) {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (!key || key !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const lojas = [];
  for (const nome of LOJAS) {
    lojas.push(
      await prisma.loja.upsert({
        where: { nome },
        update: {},
        create: { nome, slug: slugify(nome) },
      })
    );
  }

  const categorias = [];
  for (const nome of CATEGORIAS) {
    categorias.push(
      await prisma.categoria.upsert({
        where: { nome },
        update: {},
        create: { nome, slug: slugify(nome) },
      })
    );
  }

  return NextResponse.json({
    ok: true,
    lojas: lojas.length,
    categorias: categorias.length,
  });
}
