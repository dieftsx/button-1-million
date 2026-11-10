"use client";

import { Crosshair, MapPin, QrCode, X } from "lucide-react";
import { TIER_CONFIG, TIERS } from "@/lib/constants";
import { formatBRL } from "@/lib/format";
import type { DonationDraft, DonorInfo, Tier } from "@/lib/types";
import { TIER_BORDER, TierIcon } from "./TierIcon";

interface Props {
  cell: { x: number; y: number };
  donor?: DonorInfo;
  tier: Tier;
  name: string;
  message: string;
  onTier: (t: Tier) => void;
  onName: (v: string) => void;
  onMessage: (v: string) => void;
  onClose: () => void;
  onGenerate: (draft: DonationDraft) => void;
  onFly: (x: number, y: number, tier: Tier) => void;
}

export function SelectionPanel(p: Props) {
  const { cell, donor } = p;
  const input =
    "w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none";

  return (
    <section className="glass pointer-events-auto absolute inset-x-3 bottom-3 z-20 max-h-[65vh] overflow-y-auto rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-4 md:inset-x-auto md:bottom-4 md:left-4 md:w-[22rem]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-sm text-cyan-400">
          <MapPin className="size-4" />({cell.x}, {cell.y})
        </div>
        <button
          onClick={p.onClose}
          aria-label="Fechar"
          className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" />
        </button>
      </div>

      {donor ? (
        <div>
          <div
            className={`rounded-xl border p-3 ${TIER_BORDER[donor.tier]}`}
          >
            <div className="flex items-center gap-2">
              <TierIcon tier={donor.tier} className="size-5" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-white">{donor.name}</div>
                <div className="text-xs text-slate-400">
                  {TIER_CONFIG[donor.tier].label} ·{" "}
                  <span className="text-amber-400">{formatBRL(donor.amount)}</span>
                </div>
              </div>
            </div>
            {donor.message && (
              <p className="mt-2 text-sm italic text-slate-200">“{donor.message}”</p>
            )}
            <p className="mt-2 font-mono text-[10px] text-slate-500">
              Centro ({donor.x}, {donor.y}) ·{" "}
              {donor.createdAt.toLocaleString("pt-BR")}
            </p>
          </div>
          <button
            onClick={() => p.onFly(donor.x, donor.y, donor.tier)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            <Crosshair className="size-4" /> Centralizar
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {TIERS.map((t) => {
              const cfg = TIER_CONFIG[t];
              const active = p.tier === t;
              return (
                <button
                  key={t}
                  onClick={() => p.onTier(t)}
                  className={`rounded-xl border p-2 text-center transition ${
                    active
                      ? TIER_BORDER[t]
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
                  }`}
                >
                  <TierIcon tier={t} className="mx-auto size-5" />
                  <div className="mt-1 text-xs font-medium text-white">{cfg.label}</div>
                  <div className="font-mono text-xs text-amber-400">
                    {formatBRL(cfg.amount)}
                  </div>
                  <div className="text-[10px] text-slate-500">{cfg.description}</div>
                </button>
              );
            })}
          </div>

          <input
            className={input}
            placeholder="Seu nome (opcional)"
            maxLength={24}
            value={p.name}
            onChange={(e) => p.onName(e.target.value)}
          />
          <textarea
            className={`${input} resize-none`}
            rows={2}
            placeholder="Deixe uma mensagem na galáxia…"
            maxLength={80}
            value={p.message}
            onChange={(e) => p.onMessage(e.target.value)}
          />

          <button
            onClick={() =>
              p.onGenerate({
                x: cell.x,
                y: cell.y,
                tier: p.tier,
                name: p.name,
                message: p.message,
              })
            }
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.35)] transition hover:brightness-110"
          >
            <QrCode className="size-4" />
            Pagar {formatBRL(TIER_CONFIG[p.tier].amount)} via Pix
          </button>
        </div>
      )}
    </section>
  );
}
