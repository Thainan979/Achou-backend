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
  let match = url.match(/item_id[:=](MLB\d+)/i);
  if (match) return match[1].toUpperCase();

  match = url.match(/wid=(MLB\d+)/i);
  if (match) return match[1].toUpperCase();

  match = url.match(/(MLB-?\d{8,})/i);
  if (match) return match[1].replace("-", "").toUpperCase();

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
      `Código identificado: ${itemId}. O Mercado Livre respondeu com erro ${response.status}.`
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
