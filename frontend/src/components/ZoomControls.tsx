import { Maximize, Minus, Plus } from "lucide-react";

interface Props {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export function ZoomControls({ zoom, onZoomIn, onZoomOut, onReset }: Props) {
  const btn =
    "grid size-9 place-items-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white";
  return (
    <div className="glass pointer-events-auto absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-xl p-1 md:bottom-4 md:right-4">
      <button className={btn} onClick={onZoomOut} aria-label="Diminuir zoom">
        <Minus className="size-4" />
      </button>
      <span className="w-14 text-center font-mono text-xs text-slate-300">
        {zoom.toFixed(zoom < 10 ? 1 : 0)}x
      </span>
      <button className={btn} onClick={onZoomIn} aria-label="Aumentar zoom">
        <Plus className="size-4" />
      </button>
      <button className={btn} onClick={onReset} aria-label="Ver galáxia inteira">
        <Maximize className="size-4" />
      </button>
    </div>
  );
}
