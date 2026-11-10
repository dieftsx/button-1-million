import { GRID, TOTAL_PIXELS } from "./constants";
import type { DonorInfo } from "./types";

/** Estado em memória dos pixels: máscara + mapa de doadores. */
export class PixelStore {
  /** 0 = não revelado, 1 = revelado. Índice = y * 1000 + x. */
  readonly pixelMask = new Uint8Array(TOTAL_PIXELS);
  /** Índice do pixel -> doador (todos os pixels de um mesmo bloco apontam para o mesmo doador). */
  readonly donorMap = new Map<number, DonorInfo>();
  revealedCount = 0;
  totalRaised = 0;

  static index(x: number, y: number): number {
    return y * GRID + x;
  }

  isFree(index: number): boolean {
    return this.pixelMask[index] === 0;
  }

  donorAt(x: number, y: number): DonorInfo | undefined {
    return this.donorMap.get(PixelStore.index(x, y));
  }

  claim(donor: DonorInfo, indices: number[]): void {
    for (const i of indices) {
      if (this.pixelMask[i] === 0) {
        this.pixelMask[i] = 1;
        this.revealedCount++;
      }
      this.donorMap.set(i, donor);
    }
    this.totalRaised += donor.amount;
  }
}
