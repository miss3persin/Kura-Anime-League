export interface CharacterMarketInput {
  favorites: number;
  role?: string | null;
  gender?: string | null;
}

export interface CharacterPriceHistoryEntry {
  timestamp?: string;
  price?: number;
  delta?: number;
  percent?: number;
}

type RandomFn = () => number;

type CharacterPriceOptions = {
  previousPrice?: number | null;
  previousFavorites?: number | null;
};

const MIN_CHARACTER_PRICE = 800;
const MAX_CHARACTER_PRICE = 6500;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function getHistoryPrice(entry: CharacterPriceHistoryEntry, fallback: number) {
  return entry.price ?? fallback;
}

export function calcCharacterPrice(
  input: CharacterMarketInput,
  randomFn: RandomFn = Math.random,
  options: CharacterPriceOptions = {}
) {
  const previousPrice = options.previousPrice ?? null;
  const previousFavorites = options.previousFavorites ?? input.favorites;
  const favorites = Math.max(0, input.favorites);

  const basePrice = 900;
  const favoriteTarget = favorites > 0
    ? Math.round(Math.log10(favorites + 10) * 900 + favorites * 0.06)
    : 0;
  const roleBonus = input.role === "Waifu" || input.role === "Husbando" ? 280 : 120;
  const genderBonus = input.gender === "Female" || input.gender === "Male" ? 60 : 0;
  const targetPrice = basePrice + favoriteTarget + roleBonus + genderBonus;

  const volatility =
    favorites < 1_000 ? 1.45 :
      favorites < 5_000 ? 1.25 :
        favorites < 20_000 ? 1.08 :
          0.88;
  const favoriteMomentum = favorites - previousFavorites;
  const anchoredPrice = previousPrice == null
    ? targetPrice
    : (previousPrice * 0.48) + (targetPrice * 0.52);
  const momentumSwing = favoriteMomentum * 0.09 * volatility;
  const randomSwing = (randomFn() - 0.5) * (180 + Math.sqrt(favorites + 1) * 8) * volatility;

  let nextPrice = anchoredPrice + momentumSwing + randomSwing;

  const shockChance = clamp(0.05 * volatility, 0.04, 0.14);
  if (randomFn() < shockChance) {
    nextPrice += (randomFn() - 0.5) * (240 + Math.sqrt(favorites + 1) * 12) * volatility;
  }

  nextPrice = clamp(nextPrice, MIN_CHARACTER_PRICE, MAX_CHARACTER_PRICE);
  return Math.round(nextPrice / 10) * 10;
}

export function appendCharacterPriceHistory(
  history: CharacterPriceHistoryEntry[] | undefined,
  nextPrice: number,
  timestamp: string
) {
  const currentHistory = Array.isArray(history) ? history : [];
  const previousPrice = currentHistory.length > 0
    ? getHistoryPrice(currentHistory[0], nextPrice)
    : nextPrice;
  const delta = nextPrice - previousPrice;
  const percent = previousPrice ? roundTo((delta / previousPrice) * 100, 2) : 0;

  return [
    {
      timestamp,
      price: nextPrice,
      delta,
      percent
    },
    ...currentHistory
  ].slice(0, 50);
}

export function getCharacterPriceChange(
  history: CharacterPriceHistoryEntry[] | undefined,
  currentPrice: number
) {
  if (!history || history.length === 0) {
    return { delta: 0, percent: 0 };
  }

  const sortedHistory = [...history].sort((a, b) => {
    const aTime = new Date(a.timestamp ?? 0).getTime();
    const bTime = new Date(b.timestamp ?? 0).getTime();
    return bTime - aTime;
  });
  const previousPrice = getHistoryPrice(sortedHistory[1] ?? sortedHistory[0], currentPrice);
  const delta = currentPrice - previousPrice;
  const percent = previousPrice ? roundTo((delta / previousPrice) * 100, 2) : 0;
  return { delta, percent };
}
