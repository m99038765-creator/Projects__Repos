import React from 'react';
import { Flame, Info, Activity } from 'lucide-react';

export interface HeatmapIntensityScaleProps {
  /** Optional current average or peak latency in ms to position an active indicator needle */
  currentLatencyMs?: number;
  /** Optional callback if clicking on a segment to filter */
  onSelectTier?: (tier: 'low' | 'medium' | 'high') => void;
  /** Compact styling flag */
  compact?: boolean;
  /** Custom class name */
  className?: string;
  /** Optional onClose callback if used as a floating card */
  onClose?: () => void;
}

export const HeatmapIntensityScale: React.FC<HeatmapIntensityScaleProps> = ({
  currentLatencyMs,
  onSelectTier,
  compact = true,
  className = '',
  onClose
}) => {
  // Normalize current latency onto 0 - 250ms scale
  const maxScaleMs = 250;
  const clampedLatency = typeof currentLatencyMs === 'number'
    ? Math.max(0, Math.min(currentLatencyMs, maxScaleMs))
    : undefined;
  const needlePercent = clampedLatency !== undefined
    ? (clampedLatency / maxScaleMs) * 100
    : undefined;

  // Determine current tier description
  const currentTier = typeof currentLatencyMs === 'number'
    ? currentLatencyMs < 50
      ? { label: 'Low', color: 'text-emerald-400', desc: 'B-Tree Index Hit' }
      : currentLatencyMs <= 150
      ? { label: 'Medium', color: 'text-amber-400', desc: 'Uncached Read' }
      : { label: 'High', color: 'text-rose-400', desc: 'N+1 Cascade Hotspot' }
    : null;

  return (
    <div
      id="heatmap-intensity-scale"
      data-testid="heatmap-intensity-scale"
      role="region"
      aria-label="Heatmap Intensity Scale"
      className={`rounded-xl border border-zinc-700/80 bg-zinc-950/95 backdrop-blur-md shadow-2xl p-2.5 text-zinc-200 transition-all select-none animate-fadeIn ${
        compact ? 'w-72 max-w-full text-xs' : 'w-84 max-w-full text-xs'
      } ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-zinc-800/80">
        <div className="flex items-center gap-1.5">
          <span className="p-1 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <Flame className="w-3.5 h-3.5" />
          </span>
          <span className="font-extrabold text-[11px] tracking-wide text-zinc-100 uppercase">
            Heatmap Intensity Scale
          </span>
        </div>

        {currentLatencyMs !== undefined && currentTier && (
          <div className="flex items-center gap-1 font-mono text-[10px]">
            <Activity className="w-3 h-3 text-zinc-400" />
            <span className="text-zinc-400">Current:</span>
            <strong className={`${currentTier.color} font-bold`}>
              {currentLatencyMs.toFixed(0)}ms
            </strong>
          </div>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-xs px-1 cursor-pointer"
            title="Dismiss legend"
            aria-label="Close legend"
          >
            ✕
          </button>
        )}
      </div>

      {/* Latency Gradient Track */}
      <div className="relative pt-1 pb-1">
        {/* Needle Marker (if currentLatencyMs is provided) */}
        {needlePercent !== undefined && (
          <div
            className="absolute -top-1 -translate-x-1/2 z-10 flex flex-col items-center pointer-events-none transition-all duration-300 ease-out"
            style={{ left: `${needlePercent}%` }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-white ring-2 ring-zinc-950 shadow-md animate-pulse"></div>
            <div className="w-0.5 h-1 bg-white"></div>
          </div>
        )}

        {/* Continuous Color Gradient Bar */}
        <div
          className="h-2.5 w-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 via-orange-500 to-rose-600 shadow-inner ring-1 ring-white/10"
          title="Latency gradient: Green (Low <50ms) to Red (High >150ms)"
        />

        {/* Graduation Tick Marks */}
        <div className="relative flex justify-between items-center text-[9px] font-mono text-zinc-400 mt-1.5 px-0.5">
          <span className="flex flex-col items-start">
            <span>0ms</span>
            <span className="text-[8px] text-emerald-400 font-semibold uppercase">Low</span>
          </span>
          <span className="flex flex-col items-center">
            <span>50ms</span>
            <span className="text-[8px] text-emerald-300">Nominal</span>
          </span>
          <span className="flex flex-col items-center">
            <span>150ms</span>
            <span className="text-[8px] text-amber-300">Elevated</span>
          </span>
          <span className="flex flex-col items-end">
            <span>250ms+</span>
            <span className="text-[8px] text-rose-400 font-semibold uppercase">High</span>
          </span>
        </div>
      </div>

      {/* Latency Contribution Segment Tiers */}
      <div className="grid grid-cols-3 gap-1.5 mt-2.5 pt-2 border-t border-zinc-800/80 text-[10px]">
        {/* Low Tier */}
        <button
          type="button"
          onClick={() => onSelectTier?.('low')}
          className="flex flex-col items-start p-1.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-800/60 border border-emerald-500/20 text-left transition-colors cursor-pointer group"
          title="Low latency contribution (<50ms): Fast index scans & cache hits"
        >
          <div className="flex items-center gap-1 font-bold text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>&lt;50ms</span>
          </div>
          <span className="text-[9px] text-zinc-400 group-hover:text-zinc-300 mt-0.5 leading-tight">
            Minimal cost
          </span>
        </button>

        {/* Medium Tier */}
        <button
          type="button"
          onClick={() => onSelectTier?.('medium')}
          className="flex flex-col items-start p-1.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-800/60 border border-amber-500/20 text-left transition-colors cursor-pointer group"
          title="Medium latency contribution (50–150ms): Secondary filter overhead"
        >
          <div className="flex items-center gap-1 font-bold text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span>50–150ms</span>
          </div>
          <span className="text-[9px] text-zinc-400 group-hover:text-zinc-300 mt-0.5 leading-tight">
            Moderate cost
          </span>
        </button>

        {/* High Tier */}
        <button
          type="button"
          onClick={() => onSelectTier?.('high')}
          className="flex flex-col items-start p-1.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-800/60 border border-rose-500/20 text-left transition-colors cursor-pointer group"
          title="High latency contribution (>150ms): Unbatched N+1 subqueries & sequential scan bottlenecks"
        >
          <div className="flex items-center gap-1 font-bold text-rose-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
            <span>&gt;150ms</span>
          </div>
          <span className="text-[9px] text-zinc-400 group-hover:text-zinc-300 mt-0.5 leading-tight">
            N+1 Bottleneck
          </span>
        </button>
      </div>

      {/* Micro-label footer */}
      <div className="mt-2 flex items-center justify-between text-[9px] text-zinc-400">
        <span className="flex items-center gap-1">
          <Info className="w-2.5 h-2.5 text-zinc-400" />
          <span>Latency contribution per cell</span>
        </span>
        <span className="font-mono text-[9px] text-zinc-400">RGB Thermal</span>
      </div>
    </div>
  );
};
export default HeatmapIntensityScale;
