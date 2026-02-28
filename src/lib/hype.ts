export interface HypeMedia {
  averageScore?: number;
  average_score?: number;
  popularity?: number;
  status?: string;
}

export type RandomFn = () => number;

export function calcCostKp(media: HypeMedia, rawHypeScore: number, randomFn: RandomFn = Math.random) {
  const BASE = 2500;

  const hypeBonus = Math.round((rawHypeScore / 1000) * 5000);

  const scoreVal = media.average_score ?? media.averageScore ?? 0;
  const scoreBonus = scoreVal > 65 ? Math.round(((scoreVal - 65) / 35) * 2500) : 0;

  const popVal = media.popularity ?? 0;
  const popBonus = popVal > 100 ? Math.round(Math.log10(popVal) * 500) : 0;

  const statusBonus = media.status === 'RELEASING' ? 800 : 0;

  const noise = (randomFn() - 0.5) * 150;

  let cost = BASE + hypeBonus + scoreBonus + popBonus + statusBonus + noise;
  cost = Math.max(1000, Math.min(12000, cost));
  return Math.round(cost / 50) * 50;
}
