import {
  GRID,
  GRID_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  TIER_CONFIG,
  TOTAL_PIXELS,
  UNREVEALED_ALPHA,
} from "./constants";
import { generateGalaxy } from "./galaxy-generator";
import { PixelStore } from "./pixel-store";
import type { DonorInfo } from "./types";

export interface HoverInfo {
  x: number;
  y: number;
  donor?: DonorInfo;
  /** posição do cursor em px CSS relativa ao canvas */
  sx: number;
  sy: number;
}

export interface EngineCallbacks {
  onHover?: (info: HoverInfo | null) => void;
  /** Clique simples (sem arrastar) em uma coordenada da grade. */
  onPick?: (x: number, y: number) => void;
  onZoom?: (zoom: number) => void;
}

interface Particle {
  x: number;
  y: number;
  /** offsets em px de tela (independentes do zoom) */
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}

interface Pulse {
  x: number;
  y: number;
  t0: number;
  dur: number;
  maxR: number;
  color: string;
}

interface Flash {
  cells: number[];
  t0: number;
  dur: number;
}

interface FlyState {
  t0: number;
  dur: number;
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
  dip: number;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Motor gráfico: 3 camadas
 *  1. galaxySourceCanvas  - galáxia procedural completa (offscreen)
 *  2. activeStateCanvas   - ImageData com pixels revelados/não revelados (offscreen)
 *  3. viewportCanvas      - tela com câmera, efeitos, grade e highlights
 */
export class GalaxyEngine {
  private readonly viewport: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly store: PixelStore;
  private readonly cb: EngineCallbacks;

  private galaxySourceCanvas!: HTMLCanvasElement;
  private sourceData!: Uint8ClampedArray;
  private activeStateCanvas!: HTMLCanvasElement;
  private activeCtx!: CanvasRenderingContext2D;
  private activeImage!: ImageData;

  private dpr = 1;
  private vw = 0;
  private vh = 0;
  private panX = 0;
  private panY = 0;
  private zoom = 1;
  private minZoom = MIN_ZOOM;

  // zoom suave
  private zoomTarget = 1;
  private zoomAnchor: { sx: number; sy: number; wx: number; wy: number } | null =
    null;
  private fly: FlyState | null = null;

  // ponteiros
  private pointers = new Map<number, { x: number; y: number }>();
  private dragStart: {
    sx: number;
    sy: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null = null;
  private pinchDist = 0;
  private pinchMid = { x: 0, y: 0 };
  private lastMouse: { x: number; y: number } | null = null;
  private hoverCell: { x: number; y: number } | null = null;

  // estado visual
  private selection: { x: number; y: number } | null = null;
  private preview: number[] | null = null;
  private previewColor = "#22d3ee";
  private particles: Particle[] = [];
  private pulses: Pulse[] = [];
  private flashes: Flash[] = [];

  private raf = 0;
  private last = 0;
  private dirty = true;
  private lastReportedZoom = -1;
  private observer: ResizeObserver | null = null;
  private initialized = false;
  private destroyed = false;

  constructor(
    canvas: HTMLCanvasElement,
    store: PixelStore,
    callbacks: EngineCallbacks = {},
  ) {
    this.viewport = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.store = store;
    this.cb = callbacks;
  }

  // ------------------------------------------------------------------ setup

  /** Gera a galáxia e inicia o loop. Pesado (~0.3s): chame após o primeiro paint. */
  init(): void {
    if (this.destroyed) return;

    const gen = generateGalaxy();
    this.galaxySourceCanvas = gen.canvas;
    this.sourceData = gen.image.data;

    this.activeStateCanvas = document.createElement("canvas");
    this.activeStateCanvas.width = GRID;
    this.activeStateCanvas.height = GRID;
    this.activeCtx = this.activeStateCanvas.getContext("2d")!;
    this.activeImage = this.activeCtx.createImageData(GRID, GRID);

    const d = this.activeImage.data;
    const s = this.sourceData;
    const mask = this.store.pixelMask;
    for (let i = 0, o = 0; i < TOTAL_PIXELS; i++, o += 4) {
      d[o] = s[o];
      d[o + 1] = s[o + 1];
      d[o + 2] = s[o + 2];
      d[o + 3] = mask[i] ? 255 : UNREVEALED_ALPHA;
    }
    this.activeCtx.putImageData(this.activeImage, 0, 0);

    this.attach();
    this.resize();
    this.fitView();
    this.initialized = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
    const c = this.viewport;
    c.removeEventListener("pointerdown", this.onPointerDown);
    c.removeEventListener("pointermove", this.onPointerMove);
    c.removeEventListener("pointerup", this.onPointerUp);
    c.removeEventListener("pointercancel", this.onPointerUp);
    c.removeEventListener("pointerleave", this.onPointerLeave);
    c.removeEventListener("wheel", this.onWheel);
  }

  private attach(): void {
    const c = this.viewport;
    c.style.touchAction = "none";
    c.addEventListener("pointerdown", this.onPointerDown);
    c.addEventListener("pointermove", this.onPointerMove);
    c.addEventListener("pointerup", this.onPointerUp);
    c.addEventListener("pointercancel", this.onPointerUp);
    c.addEventListener("pointerleave", this.onPointerLeave);
    c.addEventListener("wheel", this.onWheel, { passive: false });
    this.observer = new ResizeObserver(() => {
      this.resize();
    });
    this.observer.observe(c.parentElement ?? c);
  }

  private resize(): void {
    const parent = this.viewport.parentElement ?? this.viewport;
    const rect = parent.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.vw = Math.max(1, rect.width);
    this.vh = Math.max(1, rect.height);
    this.viewport.width = Math.round(this.vw * this.dpr);
    this.viewport.height = Math.round(this.vh * this.dpr);
    this.viewport.style.width = `${this.vw}px`;
    this.viewport.style.height = `${this.vh}px`;
    this.minZoom = Math.min(MIN_ZOOM, this.fitZoom());
    this.dirty = true;
  }

  private fitZoom(): number {
    return (Math.min(this.vw, this.vh) / GRID) * 0.92;
  }

  fitView(): void {
    this.fly = null;
    this.zoomAnchor = null;
    this.flyTo(GRID / 2 - 0.5, GRID / 2 - 0.5, this.fitZoom(), 0);
  }

  // ----------------------------------------------------------------- camera

  private clampZoom(z: number): number {
    return Math.min(MAX_ZOOM, Math.max(this.minZoom, z));
  }

  private screenToWorld(sx: number, sy: number) {
    return { x: (sx - this.panX) / this.zoom, y: (sy - this.panY) / this.zoom };
  }

  private clampCamera(): void {
    const cx = (this.vw / 2 - this.panX) / this.zoom;
    const cy = (this.vh / 2 - this.panY) / this.zoom;
    const ccx = Math.min(GRID, Math.max(0, cx));
    const ccy = Math.min(GRID, Math.max(0, cy));
    if (ccx !== cx) this.panX = this.vw / 2 - ccx * this.zoom;
    if (ccy !== cy) this.panY = this.vh / 2 - ccy * this.zoom;
  }

  /** Voa suavemente até a coordenada (x, y) da grade. */
  flyTo(x: number, y: number, targetZoom = 18, duration = 1400): void {
    const z1 = this.clampZoom(targetZoom);
    const x1 = x + 0.5;
    const y1 = y + 0.5;
    this.zoomAnchor = null;

    if (duration <= 0) {
      this.fly = null;
      this.zoom = this.zoomTarget = z1;
      this.panX = this.vw / 2 - x1 * z1;
      this.panY = this.vh / 2 - y1 * z1;
      this.dirty = true;
      return;
    }

    const x0 = (this.vw / 2 - this.panX) / this.zoom;
    const y0 = (this.vh / 2 - this.panY) / this.zoom;
    const dist = Math.hypot(x1 - x0, y1 - y0);
    this.fly = {
      t0: performance.now(),
      dur: duration,
      x0,
      y0,
      z0: this.zoom,
      x1,
      y1,
      z1,
      dip: Math.min(1.1, dist / 350),
    };
  }

  zoomBy(factor: number): void {
    this.fly = null;
    this.setZoomAround(
      this.vw / 2,
      this.vh / 2,
      (this.zoomAnchor ? this.zoomTarget : this.zoom) * factor,
    );
  }

  private setZoomAround(sx: number, sy: number, target: number): void {
    const w = this.screenToWorld(sx, sy);
    this.zoomAnchor = { sx, sy, wx: w.x, wy: w.y };
    this.zoomTarget = this.clampZoom(target);
    this.dirty = true;
  }

  getZoom(): number {
    return this.zoom;
  }

  // -------------------------------------------------------------- interação

  private local(e: { clientX: number; clientY: number }) {
    const r = this.viewport.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const p = this.local(e);
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;
    else if (e.deltaMode === 2) dy *= 400;
    this.fly = null;
    const base = this.zoomAnchor ? this.zoomTarget : this.zoom;
    this.setZoomAround(p.x, p.y, base * Math.exp(-dy * 0.0016));
  };

  private onPointerDown = (e: PointerEvent) => {
    this.viewport.setPointerCapture(e.pointerId);
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    this.fly = null;

    if (this.pointers.size === 1) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      this.dragStart = {
        sx: p.x,
        sy: p.y,
        panX: this.panX,
        panY: this.panY,
        moved: false,
      };
    } else if (this.pointers.size === 2) {
      if (this.dragStart) this.dragStart.moved = true;
      const [a, b] = [...this.pointers.values()];
      this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      this.pinchMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.zoomAnchor = null;
      this.setHover(null);
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    const p = this.local(e);
    this.lastMouse = p;

    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, p);

    if (this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const w = this.screenToWorld(this.pinchMid.x, this.pinchMid.y);
      this.zoom = this.zoomTarget = this.clampZoom(
        this.zoom * (dist / this.pinchDist),
      );
      this.panX = mid.x - w.x * this.zoom;
      this.panY = mid.y - w.y * this.zoom;
      this.pinchDist = dist;
      this.pinchMid = mid;
      this.clampCamera();
      this.dirty = true;
      return;
    }

    if (this.dragStart && this.pointers.has(e.pointerId)) {
      const dx = p.x - this.dragStart.sx;
      const dy = p.y - this.dragStart.sy;
      if (!this.dragStart.moved && Math.hypot(dx, dy) >= 5) {
        this.dragStart.moved = true;
        this.setHover(null);
        this.viewport.style.cursor = "grabbing";
      }
      if (this.dragStart.moved) {
        this.panX = this.dragStart.panX + dx;
        this.panY = this.dragStart.panY + dy;
        this.zoomAnchor = null;
        this.clampCamera();
        this.dirty = true;
      }
      return;
    }

    if (e.pointerType === "mouse") this.updateHover();
  };

  private onPointerUp = (e: PointerEvent) => {
    const wasSingle = this.pointers.size === 1;
    const p = this.local(e);
    this.pointers.delete(e.pointerId);
    try {
      this.viewport.releasePointerCapture(e.pointerId);
    } catch {
      /* já liberado */
    }
    this.viewport.style.cursor = "";

    if (
      e.type === "pointerup" &&
      wasSingle &&
      this.dragStart &&
      !this.dragStart.moved
    ) {
      const w = this.screenToWorld(p.x, p.y);
      const x = Math.floor(w.x);
      const y = Math.floor(w.y);
      if (x >= 0 && y >= 0 && x < GRID && y < GRID) this.cb.onPick?.(x, y);
    }
    if (this.pointers.size === 0) this.dragStart = null;
    else if (this.pointers.size === 1) {
      // fim da pinça: reinicia o pan com o dedo restante, sem disparar clique
      const rest = [...this.pointers.values()][0];
      this.dragStart = {
        sx: rest.x,
        sy: rest.y,
        panX: this.panX,
        panY: this.panY,
        moved: true,
      };
    }
  };

  private onPointerLeave = () => {
    this.lastMouse = null;
    this.setHover(null);
  };

  private updateHover(): void {
    if (!this.lastMouse) return;
    const { x: sx, y: sy } = this.lastMouse;
    const w = this.screenToWorld(sx, sy);
    const x = Math.floor(w.x);
    const y = Math.floor(w.y);
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) {
      this.setHover(null);
      return;
    }
    const changed =
      !this.hoverCell || this.hoverCell.x !== x || this.hoverCell.y !== y;
    if (!changed) return;
    this.hoverCell = { x, y };
    this.dirty = true;
    this.cb.onHover?.({ x, y, donor: this.store.donorAt(x, y), sx, sy });
  }

  private setHover(info: null): void {
    if (this.hoverCell) {
      this.hoverCell = null;
      this.dirty = true;
      this.cb.onHover?.(info);
    }
  }

  // ----------------------------------------------------------- estado visual

  setSelection(cell: { x: number; y: number } | null): void {
    this.selection = cell;
    this.dirty = true;
  }

  setPreview(indices: number[] | null, color = "#22d3ee"): void {
    this.preview = indices && indices.length ? indices : null;
    this.previewColor = color;
    this.dirty = true;
  }

  /** Revela os pixels (atualiza o ImageData só na região afetada) e dispara efeitos. */
  applyDonation(donor: DonorInfo, indices: number[], animate = true): void {
    this.store.claim(donor, indices);
    if (!this.initialized) return;

    const d = this.activeImage.data;
    const s = this.sourceData;
    let minX = GRID,
      minY = GRID,
      maxX = 0,
      maxY = 0;
    for (const i of indices) {
      const o = i * 4;
      d[o] = s[o];
      d[o + 1] = s[o + 1];
      d[o + 2] = s[o + 2];
      d[o + 3] = 255;
      const x = i % GRID;
      const y = (i / GRID) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    this.activeCtx.putImageData(
      this.activeImage,
      0,
      0,
      minX,
      minY,
      maxX - minX + 1,
      maxY - minY + 1,
    );
    this.dirty = true;

    if (animate) this.spawnEffects(donor, indices);
  }

  private spawnEffects(donor: DonorInfo, indices: number[]): void {
    const now = performance.now();
    const color = TIER_CONFIG[donor.tier].color;
    const cx = donor.x + 0.5;
    const cy = donor.y + 0.5;

    const count = Math.min(90, 14 + indices.length);
    const power = donor.tier === "supernova" ? 2.2 : donor.tier === "constellation" ? 1.4 : 1;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (20 + Math.random() * 90) * power;
      this.particles.push({
        x: cx,
        y: cy,
        ox: 0,
        oy: 0,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0,
        max: 0.8 + Math.random() * 1.2,
        size: 1.5 + Math.random() * 2.5,
        color: Math.random() < 0.35 ? "#fffbeb" : color,
      });
    }

    this.flashes.push({ cells: indices, t0: now, dur: 1600 });

    const rings =
      donor.tier === "supernova" ? 3 : donor.tier === "constellation" ? 2 : 1;
    const maxR =
      donor.tier === "supernova" ? 240 : donor.tier === "constellation" ? 120 : 56;
    for (let i = 0; i < rings; i++) {
      this.pulses.push({
        x: cx,
        y: cy,
        t0: now + i * 260,
        dur: donor.tier === "supernova" ? 2200 : 1500,
        maxR: maxR * (1 - i * 0.15),
        color,
      });
    }
  }

  // ------------------------------------------------------------------- loop

  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.step(now, dt);
    if (this.dirty || this.isAnimating()) {
      this.render(now);
      this.dirty = false;
    }
  };

  private isAnimating(): boolean {
    return (
      !!this.fly ||
      !!this.zoomAnchor ||
      this.particles.length > 0 ||
      this.pulses.length > 0 ||
      this.flashes.length > 0 ||
      !!this.selection ||
      !!this.preview
    );
  }

  private step(now: number, dt: number): void {
    const prevZoom = this.zoom;
    const prevPanX = this.panX;
    const prevPanY = this.panY;

    if (this.fly) {
      const f = this.fly;
      const t = Math.min(1, (now - f.t0) / f.dur);
      const e = easeOutCubic(t);
      const lz =
        lerp(Math.log(f.z0), Math.log(f.z1), e) - f.dip * Math.sin(Math.PI * t);
      const z = this.clampZoom(Math.exp(lz));
      const cx = lerp(f.x0, f.x1, e);
      const cy = lerp(f.y0, f.y1, e);
      this.zoom = this.zoomTarget = z;
      this.panX = this.vw / 2 - cx * z;
      this.panY = this.vh / 2 - cy * z;
      if (t >= 1) this.fly = null;
    } else if (this.zoomAnchor) {
      const a = this.zoomAnchor;
      const k = 1 - Math.exp(-dt * 14);
      this.zoom += (this.zoomTarget - this.zoom) * k;
      if (Math.abs(this.zoomTarget - this.zoom) < this.zoomTarget * 0.001) {
        this.zoom = this.zoomTarget;
        this.zoomAnchor = null;
      }
      this.panX = a.sx - a.wx * this.zoom;
      this.panY = a.sy - a.wy * this.zoom;
      this.clampCamera();
    }

    if (
      this.zoom !== prevZoom ||
      this.panX !== prevPanX ||
      this.panY !== prevPanY
    ) {
      this.dirty = true;
      if (this.pointers.size === 0 || !this.dragStart?.moved) this.updateHover();
      const rounded = Math.round(this.zoom * 100) / 100;
      if (rounded !== this.lastReportedZoom) {
        this.lastReportedZoom = rounded;
        this.cb.onZoom?.(rounded);
      }
    }

    // partículas
    if (this.particles.length) {
      const drag = Math.exp(-dt * 2.2);
      this.particles = this.particles.filter((p) => {
        p.life += dt;
        if (p.life >= p.max) return false;
        p.vx *= drag;
        p.vy *= drag;
        p.ox += p.vx * dt;
        p.oy += p.vy * dt;
        return true;
      });
    }
    if (this.pulses.length)
      this.pulses = this.pulses.filter((p) => now - p.t0 < p.dur);
    if (this.flashes.length)
      this.flashes = this.flashes.filter((f) => now - f.t0 < f.dur);
  }

  // ----------------------------------------------------------------- render

  private render(now: number): void {
    const ctx = this.ctx;
    const z = this.zoom;
    const dpr = this.dpr;

    // fundo (espaço profundo, slate-950)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, this.viewport.width, this.viewport.height);

    // câmera
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(this.panX, this.panY);
    ctx.scale(z, z);

    // Pixels nítidos ao ampliar. Ao reduzir (<1x) o filtro evita que pixels
    // reveladores sumam por amostragem "nearest".
    ctx.imageSmoothingEnabled = z < 1;
    ctx.imageSmoothingQuality = "high";

    ctx.fillStyle = "#030712";
    ctx.fillRect(0, 0, GRID, GRID);
    ctx.drawImage(this.activeStateCanvas, 0, 0);

    // moldura
    ctx.strokeStyle = "rgba(129,140,248,0.35)";
    ctx.lineWidth = 1 / z;
    ctx.strokeRect(0, 0, GRID, GRID);

    // grade fina
    if (z >= GRID_ZOOM) this.drawGrid(z);

    // preview do bloco que será iluminado
    if (this.preview) {
      ctx.globalAlpha = 0.4 + 0.15 * Math.sin(now / 220);
      ctx.fillStyle = this.previewColor;
      for (const i of this.preview) {
        ctx.fillRect(i % GRID, (i / GRID) | 0, 1, 1);
      }
      ctx.globalAlpha = 1;
    }

    // efeitos aditivos
    ctx.globalCompositeOperation = "lighter";

    for (const f of this.flashes) {
      const t = (now - f.t0) / f.dur;
      ctx.globalAlpha = Math.max(0, (1 - t) * (1 - t)) * 0.9;
      ctx.fillStyle = "#ffffff";
      for (const i of f.cells) ctx.fillRect(i % GRID, (i / GRID) | 0, 1, 1);
    }

    for (const p of this.pulses) {
      const t = (now - p.t0) / p.dur;
      if (t < 0) continue;
      const e = easeOutCubic(t);
      const r = (p.maxR * e) / z;
      const alpha = Math.pow(1 - t, 1.5);
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = (2.5 * (1 - t) + 0.5) / z;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(r, 0.001), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.12;
      ctx.fillStyle = p.color;
      ctx.fill();
    }

    for (const p of this.particles) {
      const t = p.life / p.max;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = p.color;
      const s = (p.size * (1 - t * 0.5)) / z;
      ctx.fillRect(p.x + p.ox / z - s / 2, p.y + p.oy / z - s / 2, s, s);
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    // highlight sob o cursor
    if (this.hoverCell) {
      this.drawMarker(this.hoverCell.x, this.hoverCell.y, "#22d3ee", 0.95, 1.5);
    }

    // seleção atual
    if (this.selection) {
      const pulse = 0.65 + 0.35 * Math.sin(now / 260);
      this.drawMarker(this.selection.x, this.selection.y, "#fbbf24", pulse, 2);
    }

    ctx.globalAlpha = 1;
  }

  private drawGrid(z: number): void {
    const ctx = this.ctx;
    const x0 = Math.max(0, Math.floor(-this.panX / z));
    const x1 = Math.min(GRID, Math.ceil((this.vw - this.panX) / z));
    const y0 = Math.max(0, Math.floor(-this.panY / z));
    const y1 = Math.min(GRID, Math.ceil((this.vh - this.panY) / z));
    const a = Math.min(1, (z - GRID_ZOOM + 2) / 8) * 0.12;
    ctx.strokeStyle = `rgba(165,180,252,${a.toFixed(3)})`;
    ctx.lineWidth = 1 / z;
    ctx.beginPath();
    for (let x = x0; x <= x1; x++) {
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1);
    }
    for (let y = y0; y <= y1; y++) {
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
    }
    ctx.stroke();
  }

  private drawMarker(
    x: number,
    y: number,
    color: string,
    alpha: number,
    lineWidthPx: number,
  ): void {
    const ctx = this.ctx;
    const z = this.zoom;
    // em zooms baixos o pixel seria invisível: usa um marcador de ~12px de tela
    const s = Math.max(1, 12 / z);
    const cx = x + 0.5;
    const cy = y + 0.5;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidthPx / z;
    ctx.strokeRect(cx - s / 2, cy - s / 2, s, s);
  }
}
