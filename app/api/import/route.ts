import { NextRequest, NextResponse } from "next/server";
import { importFromUrl } from "@/lib/importers";

function checkAuth(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  return key && key === process.env.ADMIN_API_KEY;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.url) {
    return NextResponse.json({ error: "Envie um 'url' no corpo da requisição." }, { status: 400 });
  }

  try {
    const result = await importFromUrl(body.url);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro ao importar." }, { status: 400 });
  }
}
