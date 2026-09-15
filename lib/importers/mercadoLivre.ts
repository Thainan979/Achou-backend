export type ImportedOffer = {
  store: "Mercado Livre";
  title: string;
  price: number;
  image: string | null;
  originalUrl: string;
};

/**
 * Extrai o ID do anúncio (ex: "MLB1234567890") de uma URL de produto
 * do Mercado Livre. Cobre os formatos mais comuns de link.
 */
function extractItemId(url: string): string | null {
  const patterns = [
    /(MLB-?\d{8,})/i, // formato clássico: MLB-1234567890 ou MLB1234567890
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1].replace("-", "").toUpperCase();
    }
  }
  return null;
}

/**
 * Busca os dados reais do produto na API pública do Mercado Livre.
 * Documentação: https://api.mercadolibre.com/items/{ITEM_ID}
 */
export async function importFromMercadoLivre(url: string): Promise<ImportedOffer> {
  const itemId = extractItemId(url);
  if (!itemId) {
    throw new Error(
      "Não consegui identificar o código do anúncio nesse link do Mercado Livre. Confira se é o link direto do produto."
    );
  }

  const response = await fetch(`https://api.mercadolibre.com/items/${itemId}`);
  if (!response.ok) {
    throw new Error(
      "O Mercado Livre não retornou dados para esse anúncio (pode ter sido removido ou o link está incompleto)."
    );
  }

  const data = await response.json();

  return {
    store: "Mercado Livre",
    title: data.title,
    price: data.price,
    image: data.thumbnail ? data.thumbnail.replace("http://", "https://") : null,
    originalUrl: data.permalink || url,
  };
}
