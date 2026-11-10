import { GRID, TIER_CONFIG } from "./constants";
import { PixelStore } from "./pixel-store";
import type { DonationDraft, DonorInfo, Tier } from "./types";

const RADIUS = 26;
let offsets: Array<[number, number]> | null = null;

function getOffsets(): Array<[number, number]> {
  if (!offsets) {
    const list: Array<[number, number]> = [];
    for (let dy = -RADIUS; dy <= RADIUS; dy++) {
      for (let dx = -RADIUS; dx <= RADIUS; dx++) list.push([dx, dy]);
    }
    list.sort((a, b) => {
      const da = a[0] * a[0] + a[1] * a[1];
      const db = b[0] * b[0] + b[1] * b[1];
      return da - db || a[1] - b[1] || a[0] - b[0];
    });
    offsets = list;
  }
  return offsets;
}

/**
 * Os `count` pixels livres mais próximos de (cx, cy), formando um "disco"
 * orgânico ao redor da coordenada escolhida.
 */
export function computeFootprint(
  store: PixelStore,
  cx: number,
  cy: number,
  count: number,
): number[] {
  const out: number[] = [];
  for (const [dx, dy] of getOffsets()) {
    const x = cx + dx;
    const y = cy + dy;
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue;
    const idx = PixelStore.index(x, y);
    if (store.pixelMask[idx] === 0) {
      out.push(idx);
      if (out.length >= count) break;
    }
  }
  return out;
}

export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  ).toUpperCase();
}

export function buildDonation(
  store: PixelStore,
  draft: DonationDraft,
  opts: { id?: string; createdAt?: Date } = {},
): { donor: DonorInfo; indices: number[] } | null {
  const cfg = TIER_CONFIG[draft.tier];
  const indices = computeFootprint(store, draft.x, draft.y, cfg.pixels);
  if (indices.length === 0) return null;
  const donor: DonorInfo = {
    id: opts.id ?? uid(),
    x: draft.x,
    y: draft.y,
    name: draft.name.trim() || "Anônimo",
    message: draft.message.trim(),
    amount: cfg.amount,
    tier: draft.tier,
    createdAt: opts.createdAt ?? new Date(),
  };
  return { donor, indices };
}

/** Encontra um pixel livre aleatório (distribuição gaussiana ao redor do centro). */
export function randomFreeCell(
  store: PixelStore,
  rand: () => number = Math.random,
  sigma = 220,
): { x: number; y: number } {
  for (let attempt = 0; attempt < 200; attempt++) {
    const g = () => {
      let s = 0;
      for (let i = 0; i < 4; i++) s += rand();
      return (s - 2) * 1.73; // ~N(0,1)
    };
    const x = Math.round(GRID / 2 + g() * sigma);
    const y = Math.round(GRID / 2 + g() * sigma);
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue;
    if (store.pixelMask[PixelStore.index(x, y)] === 0) return { x, y };
  }
  return { x: Math.floor(rand() * GRID), y: Math.floor(rand() * GRID) };
}

export function pickTier(rand: () => number): Tier {
  const r = rand();
  if (r < 0.7) return "star";
  if (r < 0.93) return "constellation";
  return "supernova";
}
