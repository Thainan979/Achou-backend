import { NextRequest, NextResponse } from "next/server";

function checkAuth(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  return key && key === process.env.ADMIN_API_KEY;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("image") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Nenhuma imagem enviada." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");

  const imgbbForm = new FormData();
  imgbbForm.append("key", process.env.IMGBB_API_KEY!);
  imgbbForm.append("image", base64);

  const response = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: imgbbForm,
  });
  const data = await response.json();

  if (!data.success) {
    return NextResponse.json({ error: "Falha ao enviar a imagem." }, { status: 500 });
  }

  return NextResponse.json({ url: data.data.url });
}
