import { TIER_CONFIG } from "@/lib/constants";
import type { HoverInfo } from "@/lib/engine";
import { TierIcon } from "./TierIcon";

export function PixelTooltip({ hover }: { hover: HoverInfo | null }) {
  if (!hover) return null;
  const { x, y, donor, sx, sy } = hover;
  const flip = typeof window !== "undefined" && sx > window.innerWidth - 260;
  return (
    <div
      className="glass pointer-events-none absolute z-20 w-max max-w-[15rem] rounded-lg px-3 py-2 text-xs"
      style={{
        left: flip ? sx - 16 : sx + 16,
        top: sy + 16,
        transform: flip ? "translateX(-100%)" : undefined,
      }}
    >
      <div className="font-mono text-cyan-400">
        ({x}, {y})
      </div>
      {donor ? (
        <div className="mt-1">
          <div className="flex items-center gap-1.5 font-medium text-white">
            <TierIcon tier={donor.tier} className="size-3.5" />
            <span className="truncate">{donor.name}</span>
          </div>
          <div className="text-slate-400">{TIER_CONFIG[donor.tier].label}</div>
        </div>
      ) : (
        <div className="mt-0.5 text-slate-400">Apagado · clique para iluminar</div>
      )}
    </div>
  );
}
