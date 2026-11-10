import { Orbit, Radio } from "lucide-react";
import { TOTAL_PIXELS, SIMULATE_LIVE } from "@/lib/constants";
import { formatBRL, formatInt } from "@/lib/format";

interface Props {
  revealed: number;
  raised: number;
  donors: number;
}

export function HudHeader({ revealed, raised, donors }: Props) {
  const pct = (revealed / TOTAL_PIXELS) * 100;
  return (
    <header className="glass pointer-events-auto absolute left-3 top-3 z-10 w-[min(21rem,calc(100vw-1.5rem))] rounded-2xl p-4 md:left-4 md:top-4">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.5)]">
          <Orbit className="size-5 text-slate-950" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold leading-tight tracking-tight text-white">
            1 Million
          </h1>
          <p className="truncate text-xs text-slate-400">
            Acenda a galáxia, um pixel por vez
          </p>
        </div>
        <span
          title={SIMULATE_LIVE ? "Doações simuladas para demonstração" : undefined}
          className="flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-300"
        >
          <Radio className="size-3 animate-pulse" />
          Ao vivo
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-xl font-semibold text-cyan-400">
            {formatInt(revealed)}
          </span>
          <span className="font-mono text-xs text-slate-500">
            / {formatInt(TOTAL_PIXELS)}
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-amber-400 transition-[width] duration-700"
            style={{ width: `${Math.max(pct, 0.6)}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-slate-400">
          <span>{pct.toFixed(2)}% iluminado</span>
          <span>
            <span className="text-amber-400">{formatBRL(raised)}</span> ·{" "}
            {formatInt(donors)} doações
          </span>
        </div>
      </div>
    </header>
  );
}
