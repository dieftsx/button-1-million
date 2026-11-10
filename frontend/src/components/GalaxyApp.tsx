"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MousePointerClick, Sparkles } from "lucide-react";
import { SIMULATE_LIVE, TIER_CONFIG } from "@/lib/constants";
import { buildDonation, computeFootprint, randomFreeCell } from "@/lib/donation";
import { GalaxyEngine, type HoverInfo } from "@/lib/engine";
import { PixelStore } from "@/lib/pixel-store";
import { randomDraft, seedStore } from "@/lib/seed";
import type { DonationDraft, DonorInfo, Tier } from "@/lib/types";
import { HudHeader } from "./HudHeader";
import { LiveFeed } from "./LiveFeed";
import { PixModal } from "./PixModal";
import { PixelTooltip } from "./PixelTooltip";
import { SelectionPanel } from "./SelectionPanel";
import { ZoomControls } from "./ZoomControls";

const FEED_LIMIT = 60;

export default function GalaxyApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GalaxyEngine | null>(null);
  const storeRef = useRef<PixelStore | null>(null);

  const [ready, setReady] = useState(false);
  const [donors, setDonors] = useState<DonorInfo[]>([]);
  const [stats, setStats] = useState({ revealed: 0, raised: 0, count: 0 });
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null);
  const [tier, setTier] = useState<Tier>("star");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [pixDraft, setPixDraft] = useState<DonationDraft | null>(null);
  const [feedOpen, setFeedOpen] = useState(true);

  const syncStats = useCallback((countDelta = 0) => {
    const s = storeRef.current!;
    setStats((prev) => ({
      revealed: s.revealedCount,
      raised: s.totalRaised,
      count: prev.count + countDelta,
    }));
  }, []);

  // ------------------------------------------------------- engine lifecycle
  useEffect(() => {
    const canvas = canvasRef.current!;
    const store = new PixelStore();
    storeRef.current = store;

    const seeded = seedStore(store);
    setDonors(seeded);
    setStats({ revealed: store.revealedCount, raised: store.totalRaised, count: seeded.length });
    setFeedOpen(window.innerWidth >= 768);

    const engine = new GalaxyEngine(canvas, store, {
      onHover: setHover,
      onZoom: setZoom,
      onPick: (x, y) => {
        setSelected({ x, y });
        if (engine.getZoom() < 8) engine.flyTo(x, y, 16, 900);
      },
    });
    engineRef.current = engine;

    // deixa o loader pintar antes da geração procedural
    const t = setTimeout(() => {
      engine.init();
      setReady(true);
    }, 50);

    return () => {
      clearTimeout(t);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // ---------------------------------------------------- doações (comum)
  const commitDonation = useCallback(
    (donor: DonorInfo, indices: number[], fly: boolean) => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.applyDonation(donor, indices, true);
      setDonors((prev) => [donor, ...prev].slice(0, FEED_LIMIT));
      syncStats(1);
      if (fly) engine.flyTo(donor.x, donor.y, TIER_CONFIG[donor.tier].flyZoom);
    },
    [syncStats],
  );

  // doações simuladas de outros usuários (demo "ao vivo")
  useEffect(() => {
    if (!SIMULATE_LIVE || !ready) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        const store = storeRef.current!;
        const built = buildDonation(store, randomDraft(store));
        if (built) commitDonation(built.donor, built.indices, false);
        schedule();
      }, 3500 + Math.random() * 6000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [ready, commitDonation]);

  // ------------------------------------------------ seleção + preview
  const selectedDonor = selected
    ? storeRef.current?.donorAt(selected.x, selected.y)
    : undefined;

  useEffect(() => {
    const engine = engineRef.current;
    const store = storeRef.current;
    if (!engine || !store) return;
    engine.setSelection(selected);
    if (selected && store.isFree(selected.y * 1000 + selected.x)) {
      engine.setPreview(
        computeFootprint(store, selected.x, selected.y, TIER_CONFIG[tier].pixels),
        TIER_CONFIG[tier].color,
      );
    } else {
      engine.setPreview(null);
    }
  }, [selected, tier, stats.revealed, ready]);

  // -------------------------------------------------------------- handlers
  const flyToDonor = (d: DonorInfo) => {
    setSelected({ x: d.x, y: d.y });
    engineRef.current?.flyTo(d.x, d.y, TIER_CONFIG[d.tier].flyZoom);
  };

  const lightRandom = () => {
    const store = storeRef.current;
    const engine = engineRef.current;
    if (!store || !engine) return;
    const c = randomFreeCell(store);
    setSelected(c);
    engine.flyTo(c.x, c.y, 22);
  };

  const handlePaid = (txId: string) => {
    const store = storeRef.current;
    if (!store || !pixDraft) return;
    const built = buildDonation(store, pixDraft, { id: txId });
    if (!built) return;
    commitDonation(built.donor, built.indices, true);
    setSelected({ x: built.donor.x, y: built.donor.y });
  };

  return (
    <main className="relative h-dvh w-screen select-none overflow-hidden bg-slate-950">
      <div className="absolute inset-0">
        <canvas ref={canvasRef} className="block cursor-crosshair" />
      </div>

      <PixelTooltip hover={hover} />

      <div className="pointer-events-none absolute inset-0">
        <HudHeader revealed={stats.revealed} raised={stats.raised} donors={stats.count} />
        <LiveFeed
          donors={donors}
          open={feedOpen}
          onToggle={() => setFeedOpen((v) => !v)}
          onSelect={flyToDonor}
        />
        <ZoomControls
          zoom={zoom}
          onZoomIn={() => engineRef.current?.zoomBy(1.6)}
          onZoomOut={() => engineRef.current?.zoomBy(1 / 1.6)}
          onReset={() => engineRef.current?.fitView()}
        />

        {!selected && ready && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 md:bottom-4">
            <p className="glass hidden items-center gap-2 rounded-full px-3 py-1 text-xs text-slate-400 sm:flex">
              <MousePointerClick className="size-3.5 text-cyan-400" />
              Arraste para navegar · role para zoom · clique em um ponto escuro
            </p>
            <button
              onClick={lightRandom}
              className="pointer-events-auto flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_30px_rgba(99,102,241,0.55)] transition hover:scale-105"
            >
              <Sparkles className="size-4" /> Iluminar um pixel
            </button>
          </div>
        )}

        {selected && (
          <SelectionPanel
            key={`${selected.x}-${selected.y}-${selectedDonor?.id ?? "free"}`}
            cell={selected}
            donor={selectedDonor}
            tier={tier}
            name={name}
            message={message}
            onTier={setTier}
            onName={setName}
            onMessage={setMessage}
            onClose={() => setSelected(null)}
            onGenerate={setPixDraft}
            onFly={(x, y, t) => engineRef.current?.flyTo(x, y, TIER_CONFIG[t].flyZoom)}
          />
        )}
      </div>

      {pixDraft && (
        <PixModal
          draft={pixDraft}
          onPaid={handlePaid}
          onClose={() => setPixDraft(null)}
        />
      )}

      {!ready && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-slate-950">
          <div className="flex flex-col items-center gap-3 text-sm text-slate-400">
            <Loader2 className="size-8 animate-spin text-cyan-400" />
            Gerando galáxia…
          </div>
        </div>
      )}
    </main>
  );
}
