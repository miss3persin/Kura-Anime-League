export interface HypeMedia {
  averageScore?: number | null;
  average_score?: number | null;
  popularity?: number;
  status?: string;
  trending?: number | null;
}

export type RandomFn = () => number;

type CalcCostOptions = {
  previousCost?: number | null;
  previousHype?: number | null;
};

const MIN_PRICE = 1000;
const MAX_PRICE = 15000;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function calcCostKp(
  media: HypeMedia,
  rawHypeScore: number,
  randomFn: RandomFn = Math.random,
  options: CalcCostOptions = {}
) {
  const BASE = 2400;
  const previousCost = options.previousCost ?? null;
  const previousHype = options.previousHype ?? rawHypeScore;

  const scoreVal = media.average_score ?? media.averageScore ?? 0;
  const popVal = media.popularity ?? 0;
  const trendVal = media.trending ?? 0;

  const hypeTarget = Math.round((rawHypeScore / 1000) * 7200);
  const scoreBonus = scoreVal > 60 ? Math.round(((scoreVal - 60) / 40) * 2100) : 0;
  const popularityBonus = popVal > 0 ? Math.round(Math.log10(Math.max(popVal, 10)) * 520) : 0;
  const statusBonus =
    media.status === "NOT_YET_RELEASED"
      ? 950
      : media.status === "RELEASING"
        ? 650
        : media.status === "HIATUS"
          ? -350
          : 0;

  const targetPrice = BASE + hypeTarget + scoreBonus + popularityBonus + statusBonus;
  const hypeMomentum = rawHypeScore - previousHype;
  const popularityVolatility =
    popVal < 2_000 ? 1.35 :
      popVal < 10_000 ? 1.18 :
        popVal < 75_000 ? 1.0 :
          0.82;
  const statusVolatility =
    media.status === "NOT_YET_RELEASED"
      ? 1.32
      : media.status === "RELEASING"
        ? 1.14
        : media.status === "HIATUS"
          ? 1.18
          : 0.9;
  const trendVolatility = trendVal > 0 ? clamp(1 + trendVal / 4000, 1, 1.45) : 1;
  const volatility = popularityVolatility * statusVolatility * trendVolatility;

  const anchoredPrice = previousCost == null
    ? targetPrice
    : (previousCost * 0.44) + (targetPrice * 0.56);

  const momentumSwing = hypeMomentum * (7.5 * volatility);
  const randomSwing = (randomFn() - 0.5) * (420 + rawHypeScore * 1.6) * volatility;
  let cost = anchoredPrice + momentumSwing + randomSwing;

  const shockChance = clamp(0.06 * volatility, 0.04, 0.16);
  if (randomFn() < shockChance) {
    const shockMagnitude = (450 + rawHypeScore * 1.1) * volatility;
    cost += (randomFn() - 0.5) * shockMagnitude;
  }

  cost = clamp(cost, MIN_PRICE, MAX_PRICE);
  return Math.round(cost / 10) * 10;
}

export interface AnimeHypeHistoryEntry {
  timestamp?: string;
  scored_at?: string;
  price?: number;
  cost_kp?: number;
  hype?: number;
  delta?: number;
  percent?: number;
}

function getEntryTime(entry: AnimeHypeHistoryEntry) {
  return new Date(entry.timestamp ?? entry.scored_at ?? 0).getTime();
}

function getEntryPrice(entry: AnimeHypeHistoryEntry, fallbackPrice: number) {
  return entry.price ?? entry.cost_kp ?? fallbackPrice;
}

export function getHistoryChange(
  history: AnimeHypeHistoryEntry[] | undefined,
  rangeMs: number,
  currentPrice: number
) {
  if (!history || history.length === 0) {
    return { percent: 0, delta: 0 };
  }

  const sortedHistory = [...history].sort((a, b) => {
    const aTime = getEntryTime(a);
    const bTime = getEntryTime(b);
    return bTime - aTime;
  });

  const nowEntry = sortedHistory[0];
  const nowTime = isNaN(getEntryTime(nowEntry))
    ? Date.now()
    : getEntryTime(nowEntry);
  const targetTime = nowTime - rangeMs;

  const prevEntry =
    sortedHistory.find((entry) => {
      const entryTime = getEntryTime(entry);
      return !isNaN(entryTime) && entryTime <= targetTime;
    }) || sortedHistory[sortedHistory.length - 1];

  const prevPrice = getEntryPrice(prevEntry, currentPrice);
  const delta = currentPrice - prevPrice;
  const percent = prevPrice ? roundTo((delta / prevPrice) * 100, 2) : 0;

  return { percent, delta };
}

export function getLatestPriceChange(
  history: AnimeHypeHistoryEntry[] | undefined,
  currentPrice: number,
  fallbackPercent = 0
) {
  if (!history || history.length === 0) {
    return { percent: fallbackPercent, delta: 0 };
  }

  const sortedHistory = [...history].sort((a, b) => getEntryTime(b) - getEntryTime(a));
  const previousEntry = sortedHistory[1] ?? sortedHistory[0];
  const previousPrice = getEntryPrice(previousEntry, currentPrice);
  const delta = currentPrice - previousPrice;
  const percent = previousPrice ? roundTo((delta / previousPrice) * 100, 2) : fallbackPercent;

  return { percent, delta };
}

export function appendHypeHistory(
  history: AnimeHypeHistoryEntry[] | undefined,
  nextEntry: { timestamp: string; price: number; hype: number }
) {
  const currentHistory = Array.isArray(history) ? history : [];
  const previousPrice = currentHistory.length > 0
    ? getEntryPrice(currentHistory[0], nextEntry.price)
    : nextEntry.price;
  const delta = nextEntry.price - previousPrice;
  const percent = previousPrice ? roundTo((delta / previousPrice) * 100, 2) : 0;

  return [
    {
      timestamp: nextEntry.timestamp,
      price: nextEntry.price,
      cost_kp: nextEntry.price,
      hype: nextEntry.hype,
      delta,
      percent
    },
    ...currentHistory
  ].slice(0, 100);
}
