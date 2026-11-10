import { GRID } from "./constants";

type RGB = [number, number, number];

function hex(c: string): RGB {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as RGB;
}

const WHITE = hex("#fffbeb");
const GOLD = hex("#fbbf24");
const ARM_COLORS: RGB[] = [
  hex("#22d3ee"), // ciano
  hex("#818cf8"), // azul/índigo
  hex("#c084fc"), // roxo
  hex("#f472b6"), // magenta
];
const STAR_TINTS: RGB[] = [
  [1, 1, 1],
  [0.75, 0.9, 1],
  [1, 0.95, 0.8],
  [0.85, 0.8, 1],
];

function hash2(x: number, y: number, seed: number): number {
  let h =
    Math.imul(x | 0, 374761393) ^
    Math.imul(y | 0, 668265263) ^
    Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, seed: number, octaves: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 17);
    freq *= 2;
    amp *= 0.5;
  }
  return sum;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export interface GeneratedGalaxy {
  canvas: HTMLCanvasElement;
  image: ImageData;
}

/**
 * Gera proceduralmente a galáxia espiral (1000x1000) em um canvas offscreen.
 * Espiral logarítmica θ = ln(r / a) / b com 4 braços, bojo dourado,
 * poeira estelar e estrelas esparsas. Determinístico (sem Math.random).
 */
export function generateGalaxy(): GeneratedGalaxy {
  const canvas = document.createElement("canvas");
  canvas.width = GRID;
  canvas.height = GRID;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(GRID, GRID);
  const data = image.data;

  const CENTER = GRID / 2; // (500, 500)
  const ARMS = 4;
  const PITCH = 0.3; // b = tan(ângulo de abertura)
  const TWO_PI = Math.PI * 2;
  const SEED = 1337;

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const dx = x + 0.5 - CENTER;
      const dy = y + 0.5 - CENTER;
      const r = Math.sqrt(dx * dx + dy * dy);
      const theta = Math.atan2(dy, dx);

      // --- Braços espirais ---------------------------------------------
      const phase = (theta - Math.log(r / 20) / PITCH) / TWO_PI;
      const a = phase - Math.floor(phase); // 0..1 dentro de uma volta
      const f = a * ARMS;
      const nearest = Math.round(f);
      let dd = f - nearest; // -0.5..0.5
      const armIndex = ((nearest % ARMS) + ARMS) % ARMS;

      // Distorção para quebrar a simetria perfeita
      const warp = fbm(x / 90, y / 90, SEED, 3) - 0.44;
      dd += warp * 0.22;

      const width = Math.max(0.07, 0.32 - r / 1700);
      const profile = Math.exp(-((dd / width) * (dd / width)));

      const radial =
        Math.exp(-r / 210) * (1 - smoothstep(330, 485, r)) + 0.0001;
      const mottle = 0.45 + 1.1 * fbm(x / 13, y / 13, SEED + 3, 3);
      const dust = 0.7 + 0.6 * fbm(x / 45, y / 45, SEED + 9, 2);
      const armI = profile * radial * mottle * dust;

      // Cor do braço (mistura suave com o braço vizinho)
      const neighbor = (((nearest + (dd > 0 ? 1 : -1)) % ARMS) + ARMS) % ARMS;
      const mix = Math.min(1, Math.abs(dd)) * 0.9;
      const ac = ARM_COLORS[armIndex];
      const nc = ARM_COLORS[neighbor];
      const cr = ac[0] + (nc[0] - ac[0]) * mix;
      const cg = ac[1] + (nc[1] - ac[1]) * mix;
      const cb = ac[2] + (nc[2] - ac[2]) * mix;

      // Disco difuso entre os braços
      const disc = 0.12 * radial * (0.6 + fbm(x / 30, y / 30, SEED + 5, 2));

      // --- Centro galáctico --------------------------------------------
      const bulge = Math.exp(-Math.pow(r / 48, 1.5));
      const coreWhite = Math.exp(-Math.pow(r / 15, 1.3));
      const coreR = GOLD[0] + (WHITE[0] - GOLD[0]) * coreWhite;
      const coreG = GOLD[1] + (WHITE[1] - GOLD[1]) * coreWhite;
      const coreB = GOLD[2] + (WHITE[2] - GOLD[2]) * coreWhite;

      let lr = cr * armI * 1.25 + 0.35 * disc + coreR * bulge * 1.7;
      let lg = cg * armI * 1.25 + 0.4 * disc + coreG * bulge * 1.7;
      let lb = cb * armI * 1.25 + 1.0 * disc + coreB * bulge * 1.7;

      // Tone map suave
      lr = 1 - Math.exp(-1.5 * lr);
      lg = 1 - Math.exp(-1.5 * lg);
      lb = 1 - Math.exp(-1.5 * lb);

      // --- Fundo espacial (azul-escuro com nebulosidade tênue) ----------
      const neb = fbm(x / 220, y / 220, SEED + 21, 3);
      let R = 6 + neb * 8 + lr * 255;
      let G = 10 + neb * 10 + lg * 255;
      let B = 30 + neb * 26 + lb * 255;

      // --- Poeira estelar ----------------------------------------------
      const h = hash2(x, y, SEED + 77);
      const p = 0.0022 + 0.02 * Math.min(1, armI * 1.5);
      if (h < p) {
        const k = hash2(x, y, SEED + 99);
        const bright = 0.35 + 0.65 * k * k;
        const tint = STAR_TINTS[Math.floor(hash2(x, y, SEED + 5) * 4)];
        R += tint[0] * bright * 255;
        G += tint[1] * bright * 255;
        B += tint[2] * bright * 255;
      }

      const o = (y * GRID + x) * 4;
      data[o] = R > 255 ? 255 : R;
      data[o + 1] = G > 255 ? 255 : G;
      data[o + 2] = B > 255 ? 255 : B;
      data[o + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  return { canvas, image };
}
