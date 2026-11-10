"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Activity } from "lucide-react";
import { TIER_CONFIG } from "@/lib/constants";
import { formatBRL, timeAgo } from "@/lib/format";
import type { DonorInfo } from "@/lib/types";
import { TierIcon } from "./TierIcon";

interface Props {
  donors: DonorInfo[];
  open: boolean;
  onToggle: () => void;
  onSelect: (d: DonorInfo) => void;
}

export function LiveFeed({ donors, open, onToggle, onSelect }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(t);
  }, []);

  if (!open) {
    return (
      <button
        onClick={onToggle}
        className="glass pointer-events-auto absolute right-3 top-3 z-10 flex items-center gap-2 rounded-full px-3 py-2 text-xs text-slate-200 md:right-4 md:top-4"
      >
        <Activity className="size-4 text-cyan-400" /> Feed
      </button>
    );
  }

  return (
    <aside className="glass pointer-events-auto absolute right-3 top-3 z-10 flex max-h-[calc(100%-6.5rem)] w-[min(19rem,calc(100vw-1.5rem))] flex-col rounded-2xl md:right-4 md:top-4">
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-white">
          <Activity className="size-4 text-cyan-400" /> Doações recentes
        </h2>
        <button
          onClick={onToggle}
          aria-label="Fechar feed"
          className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <ul className="flex-1 space-y-1 overflow-y-auto px-2 pb-2">
        {donors.map((d) => (
          <li key={d.id} className="animate-in fade-in slide-in-from-right-4 duration-500">
            <button
              onClick={() => onSelect(d)}
              className="group w-full rounded-xl border border-transparent px-2.5 py-2 text-left transition hover:border-white/10 hover:bg-white/5"
            >
              <div className="flex items-center gap-2">
                <TierIcon tier={d.tier} className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">
                  {d.name}
                </span>
                <span className="font-mono text-xs text-amber-400">
                  {formatBRL(d.amount)}
                </span>
              </div>
              {d.message && (
                <p className="mt-0.5 truncate pl-6 text-xs text-slate-400">
                  “{d.message}”
                </p>
              )}
              <p className="mt-0.5 pl-6 font-mono text-[10px] text-slate-500">
                {TIER_CONFIG[d.tier].label} · ({d.x}, {d.y}) · {timeAgo(d.createdAt, now)}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
