import { importFromMercadoLivre } from "./mercadoLivre";

export type ImportResult =
  | { supported: true; data: Awaited<ReturnType<typeof importFromMercadoLivre>> }
  | { supported: false; message: string };

export async function importFromUrl(url: string): Promise<ImportResult> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error("Isso não parece um link válido.");
  }

  if (hostname.includes("mercadolivre.com") || hostname.includes("mercadolibre.com")) {
    const data = await importFromMercadoLivre(url);
    return { supported: true, data };
  }

  if (hostname.includes("shopee.com")) {
    return {
      supported: false,
      message:
        "Importação automática da Shopee ainda não está disponível — depende do programa de afiliados deles. Por enquanto, cadastre esse produto manualmente.",
    };
  }

  if (hostname.includes("shein.com")) {
    return {
      supported: false,
      message:
        "Importação automática da SHEIN ainda não está disponível — depende do programa de afiliados deles. Por enquanto, cadastre esse produto manualmente.",
    };
  }

  return {
    supported: false,
    message: "Essa loja ainda não é suportada pela importação automática.",
  };
}
