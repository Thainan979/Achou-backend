export type ImportedOffer = {
  store: "Mercado Livre";
  title: string;
  price: number;
  image: string | null;
  originalUrl: string;
};

function extractItemId(url: string): string | null {
  let match = url.match(/item_id[:=](MLB\d+)/i);
  if (match) return match[1].toUpperCase();

  match = url.match(/wid=(MLB\d+)/i);
  if (match) return match[1].toUpperCase();

  match = url.match(/(MLB-?\d{8,})/i);
  if (match) return match[1].replace("-", "").toUpperCase();

  return null;
}

export async function importFromMercadoLivre(url: string): Promise<ImportedOffer> {
  const itemId = extractItemId(url);
  if (!itemId) {
    throw new Error(
      "Não consegui identificar o código do anúncio nesse link do Mercado Livre. Confira se é o link direto do produto."
    );
  }

  const response = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; AchouBot/1.0)",
      "Accept": "application/json",
    },
  });

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
