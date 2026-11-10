import { Star, Sparkles, Sun, type LucideProps } from "lucide-react";
import type { Tier } from "@/lib/types";

export const TIER_TEXT: Record<Tier, string> = {
  star: "text-cyan-400",
  constellation: "text-indigo-400",
  supernova: "text-amber-400",
};

export const TIER_BORDER: Record<Tier, string> = {
  star: "border-cyan-400/60 bg-cyan-400/10",
  constellation: "border-indigo-500/70 bg-indigo-500/10",
  supernova: "border-amber-400/70 bg-amber-400/10",
};

export function TierIcon({ tier, ...props }: { tier: Tier } & LucideProps) {
  const Icon = tier === "star" ? Star : tier === "constellation" ? Sparkles : Sun;
  return <Icon {...props} className={`${TIER_TEXT[tier]} ${props.className ?? ""}`} />;
}
