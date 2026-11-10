"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, Rocket, X } from "lucide-react";
import { TIER_CONFIG } from "@/lib/constants";
import { formatBRL } from "@/lib/format";
import type { DonationDraft } from "@/lib/types";
import { TierIcon } from "./TierIcon";

interface PixData {
  copyPasteCode: string;
  expiresAt: string;
  transactionId: string;
}

interface Props {
  draft: DonationDraft;
  /** Chamado após o pagamento confirmado; o pai ilumina os pixels. */
  onPaid: (transactionId: string) => void;
  onClose: () => void;
}

type Step = "loading" | "waiting" | "confirming" | "done" | "error";

/** QR ilustrativo (determinístico) — NÃO é um QR Code Pix válido. */
function PlaceholderQr({ seed }: { seed: string }) {
  const cells = useMemo(() => {
    const N = 29;
    let h = 2166136261;
    for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    const rnd = () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
    const finder = (x: number, y: number) =>
      [
        [0, 0],
        [N - 7, 0],
        [0, N - 7],
      ].some(([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7);
    const out: Array<[number, number]> = [];
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) if (!finder(x, y) && rnd() > 0.52) out.push([x, y]);
    for (const [fx, fy] of [
      [0, 0],
      [N - 7, 0],
      [0, N - 7],
    ])
      for (let y = 0; y < 7; y++)
        for (let x = 0; x < 7; x++) {
          const edge = x === 0 || y === 0 || x === 6 || y === 6;
          const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
          if (edge || core) out.push([fx + x, fy + y]);
        }
    return { N, out };
  }, [seed]);

  return (
    <svg
      viewBox={`-2 -2 ${cells.N + 4} ${cells.N + 4}`}
      className="size-44 rounded-lg bg-white"
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR Code de demonstração"
    >
      {cells.out.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#020617" />
      ))}
    </svg>
  );
}

export function PixModal({ draft, onPaid, onClose }: Props) {
  const cfg = TIER_CONFIG[draft.tier];
  const [step, setStep] = useState<Step>("loading");
  const [pix, setPix] = useState<PixData | null>(null);
  const [copied, setCopied] = useState(false);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/generate-pix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: cfg.amount }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error("falha");
        const data = (await res.json()) as PixData;
        setPix(data);
        setStep("waiting");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setStep("error");
      }
    })();
    return () => ctrl.abort();
  }, [cfg.amount]);

  useEffect(() => {
    if (!pix) return;
    const tick = () =>
      setLeft(Math.max(0, Math.floor((new Date(pix.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [pix]);

  async function simulatePayment() {
    if (!pix) return;
    setStep("confirming");
    try {
      const res = await fetch("/api/register-donation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: pix.transactionId, amount: cfg.amount }),
      });
      if (!res.ok) throw new Error("falha");
      onPaid(pix.transactionId);
      setStep("done");
    } catch {
      setStep("error");
    }
  }

  async function copy() {
    if (!pix) return;
    try {
      await navigator.clipboard.writeText(pix.copyPasteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard indisponível */
    }
  }

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="glass w-full max-w-sm rounded-2xl p-5 animate-in zoom-in-95">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <TierIcon tier={draft.tier} className="size-5" />
            <span className="font-medium">
              {cfg.label} · {formatBRL(cfg.amount)}
            </span>
          </div>
          {step !== "confirming" && (
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {step === "loading" && (
          <div className="grid place-items-center gap-3 py-12 text-sm text-slate-400">
            <Loader2 className="size-8 animate-spin text-cyan-400" />
            Gerando cobrança Pix…
          </div>
        )}

        {step === "error" && (
          <div className="py-8 text-center text-sm text-rose-300">
            Não foi possível concluir a operação. Tente novamente.
            <button
              onClick={onClose}
              className="mx-auto mt-4 block rounded-lg bg-white/10 px-4 py-2 text-white"
            >
              Fechar
            </button>
          </div>
        )}

        {(step === "waiting" || step === "confirming") && pix && (
          <div className="flex flex-col items-center gap-3">
            <PlaceholderQr seed={pix.transactionId} />
            <p className="text-center text-xs text-slate-400">
              QR de demonstração · coordenada{" "}
              <span className="font-mono text-cyan-400">
                ({draft.x}, {draft.y})
              </span>
            </p>
            <div className="w-full rounded-lg border border-white/10 bg-slate-900/70 p-2">
              <p className="break-all font-mono text-[10px] leading-tight text-slate-400">
                {pix.copyPasteCode}
              </p>
            </div>
            <button
              onClick={copy}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2 text-sm text-slate-200 hover:bg-white/10"
            >
              {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
              {copied ? "Copiado!" : "Copiar código Pix"}
            </button>
            <p className="text-xs text-slate-500">
              Expira em <span className="font-mono text-amber-400">{mm}:{ss}</span>
            </p>
            <button
              onClick={simulatePayment}
              disabled={step === "confirming"}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-pink-400 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              {step === "confirming" && <Loader2 className="size-4 animate-spin" />}
              Simular pagamento (demo)
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="grid place-items-center gap-3 py-6 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
              <Check className="size-7" />
            </div>
            <p className="text-lg font-medium text-white">Pagamento confirmado!</p>
            <p className="text-sm text-slate-400">
              Sua {cfg.label.toLowerCase()} acabou de acender na galáxia.
            </p>
            <button
              onClick={onClose}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 py-2.5 text-sm font-semibold text-slate-950"
            >
              <Rocket className="size-4" /> Ver no mapa
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
