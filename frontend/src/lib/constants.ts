import type { Tier } from "./types";

export const GRID = 1000;
export const TOTAL_PIXELS = GRID * GRID;

export const MIN_ZOOM = 0.6;
export const MAX_ZOOM = 45;
/** Zoom a partir do qual a grade fina é desenhada. */
export const GRID_ZOOM = 14;

/** Alpha (0-255) dos pixels não revelados: ~7% de opacidade. */
export const UNREVEALED_ALPHA = 18;

/** Simula doações de outros usuários para demonstrar o "tempo real". */
export const SIMULATE_LIVE = true;

/** Cada R$ 1 ilumina 1 pixel. */
export const PRICE_PER_PIXEL = 1;

export interface TierConfig {
  label: string;
  amount: number;
  pixels: number;
  /** Cor usada no canvas (efeitos). */
  color: string;
  description: string;
  flyZoom: number;
}

export const TIER_CONFIG: Record<Tier, TierConfig> = {
  star: {
    label: "Estrela",
    amount: 1 * PRICE_PER_PIXEL,
    pixels: 1,
    color: "#22d3ee",
    description: "1 pixel",
    flyZoom: 28,
  },
  constellation: {
    label: "Constelação",
    amount: 25 * PRICE_PER_PIXEL,
    pixels: 25,
    color: "#818cf8",
    description: "25 pixels",
    flyZoom: 20,
  },
  supernova: {
    label: "Supernova",
    amount: 100 * PRICE_PER_PIXEL,
    pixels: 100,
    color: "#fbbf24",
    description: "100 pixels + pulso",
    flyZoom: 15,
  },
};

export const TIERS: Tier[] = ["star", "constellation", "supernova"];

export function tierFromAmount(amount: number): Tier {
  if (amount >= TIER_CONFIG.supernova.amount) return "supernova";
  if (amount >= TIER_CONFIG.constellation.amount) return "constellation";
  return "star";
}
