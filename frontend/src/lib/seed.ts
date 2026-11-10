import { buildDonation, pickTier, randomFreeCell } from "./donation";
import { PixelStore } from "./pixel-store";
import type { DonationDraft, DonorInfo } from "./types";

const NAMES = [
  "Ana Beatriz", "Lucas M.", "Carolina", "Rafael Souza", "Marina", "João Pedro",
  "Fernanda", "Gustavo", "Isabela", "Thiago", "Camila R.", "Bruno", "Larissa",
  "Diego", "Juliana", "Matheus", "Patrícia", "Vinícius", "Aline", "Eduardo",
  "Renata", "Felipe", "Bianca", "André", "Letícia", "Cosmonauta Anônimo",
];

const MESSAGES = [
  "Que projeto lindo! 🌌",
  "Meu pixel na galáxia!",
  "Pela ciência e pela diversão.",
  "Primeiro de muitos 🚀",
  "Para o meu filho olhar as estrelas.",
  "Brilha, estrelinha!",
  "Aqui tem muito amor ❤️",
  "Quero ver essa galáxia completa!",
  "",
  "Dedicado à minha avó ✨",
  "Rumo a 1 milhão!",
  "",
  "Que a força esteja com vocês.",
  "Feliz aniversário, Ju!",
];

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomDraft(
  store: PixelStore,
  rand: () => number = Math.random,
): DonationDraft {
  const { x, y } = randomFreeCell(store, rand);
  return {
    x,
    y,
    tier: pickTier(rand),
    name: NAMES[Math.floor(rand() * NAMES.length)],
    message: MESSAGES[Math.floor(rand() * MESSAGES.length)],
  };
}

/** Popula a store com doações iniciais (sem animação). Retorna os doadores, mais recentes primeiro. */
export function seedStore(store: PixelStore, count = 70): DonorInfo[] {
  const rand = mulberry32(2026);
  const now = Date.now();
  const donors: DonorInfo[] = [];
  for (let i = 0; i < count; i++) {
    const draft = randomDraft(store, rand);
    const minutesAgo = 1 + Math.floor(rand() * 900);
    const built = buildDonation(store, draft, {
      createdAt: new Date(now - minutesAgo * 60_000),
    });
    if (!built) continue;
    store.claim(built.donor, built.indices);
    donors.push(built.donor);
  }
  return donors.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
