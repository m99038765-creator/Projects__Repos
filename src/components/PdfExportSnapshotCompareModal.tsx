import React, { useState } from 'react';
import { DiagnosticPdfHistoryItem } from './DiagnosticExportHistoryModal';
import { OptimizationFlags } from '../types';
import {
  X,
  GitCompare,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Minus,
  CheckCircle2,
  XCircle,
  Sliders,
  Clock,
  Database,
  Layers,
  FileText,
  RefreshCw
} from 'lucide-react';

interface PdfExportSnapshotCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  historyItems: DiagnosticPdfHistoryItem[];
  currentFlags?: OptimizationFlags;
  currentLatency?: number;
  currentN1Count?: number;
}

export const PdfExportSnapshotCompareModal: React.FC<PdfExportSnapshotCompareModalProps> = ({
  isOpen,
  onClose,
  historyItems = [],
  currentFlags,
  currentLatency,
  currentN1Count
}) => {
  // Ensure we have items (fallback if empty)
  const safeItems = historyItems.length > 0 ? historyItems : [
    {
      id: 'fallback-1',
      title: 'Baseline Diagnostic Report',
      timestamp: Date.now() - 3600000,
      timeFormatted: new Date(Date.now() - 3600000).toLocaleTimeString(),
      recordCount: 50000,
      executionTimeMs: 295.0,
      fileSizeKB: 180,
      summary: 'Baseline performance audit with batchEagerLoading disabled.',
      flags: { btreeIndexing: false, batchEagerLoading: false, queryCaching: false, virtualizedDOM: true, deferredRendering: true },
      n1LogsCount: 12
    },
    {
      id: 'fallback-2',
      title: 'Optimized Diagnostic Report',
      timestamp: Date.now(),
      timeFormatted: new Date().toLocaleTimeString(),
      recordCount: 50000,
      executionTimeMs: 45.2,
      fileSizeKB: 160,
      summary: 'Post-optimization audit with batchEagerLoading enabled.',
      flags: { btreeIndexing: true, batchEagerLoading: true, queryCaching: true, virtualizedDOM: true, deferredRendering: true },
      n1LogsCount: 1
    }
  ];

  const [indexA, setIndexA] = useState<number>(0);
  const [indexB, setIndexB] = useState<number>(Math.min(safeItems.length - 1, 1));

  if (!isOpen) return null;

  const itemA = safeItems[indexA] || safeItems[0];
  const itemB = safeItems[indexB] || safeItems[safeItems.length - 1];

  // Metric diffs (B relative to A)
  const latencyDiff = itemB.executionTimeMs - itemA.executionTimeMs;
  const latencyPct = itemA.executionTimeMs > 0
    ? ((itemB.executionTimeMs - itemA.executionTimeMs) / itemA.executionTimeMs) * 100
    : 0;

  const recordDiff = itemB.recordCount - itemA.recordCount;
  
  const n1A = itemA.n1LogsCount ?? 5;
  const n1B = itemB.n1LogsCount ?? 1;
  const n1Diff = n1B - n1A;

  const speedup = itemB.executionTimeMs > 0
    ? (itemA.executionTimeMs / itemB.executionTimeMs).toFixed(1)
    : '1.0';

  const flagsA: OptimizationFlags = itemA.flags || {
    btreeIndexing: true,
    batchEagerLoading: false,
    queryCaching: false,
    virtualizedDOM: true,
    deferredRendering: true
  };

  const flagsB: OptimizationFlags = itemB.flags || {
    btreeIndexing: true,
    batchEagerLoading: true,
    queryCaching: true,
    virtualizedDOM: true,
    deferredRendering: true
  };

  const flagList: { key: keyof OptimizationFlags; label: string; desc: string }[] = [
    { key: 'batchEagerLoading', label: 'Batch Eager Join', desc: 'Eliminates N+1 child query cascade' },
    { key: 'btreeIndexing', label: 'B-Tree Indexing', desc: 'Avoids full table scans on status/date' },
    { key: 'queryCaching', label: 'LRU Query Cache', desc: 'In-memory result caching for repeat queries' },
    { key: 'virtualizedDOM', label: 'DOM Virtualization', desc: 'Windowed list rendering for large datasets' },
    { key: 'deferredRendering', label: 'Concurrent State', desc: 'Non-blocking keyboard and filter input' }
  ];

  return (
    <div
      id="pdf-snapshot-compare-modal-backdrop"
      className="fixed inset-0 z-50 bg-zinc-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="pdf-snapshot-compare-modal"
        className="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-zinc-100 animate-scaleUp"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Snapshot Comparison Diff Engine
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono text-[10px] border border-rose-500/30 font-semibold">
                  PDF Export History Diff
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Compare two diagnostic export snapshots side-by-side across latency, flag state changes, and N+1 cascade log counts.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Selector Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Snapshot A Selection */}
            <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  Baseline Snapshot (A)
                </label>
                <span className="text-[11px] font-mono text-zinc-400">
                  {itemA.timeFormatted} ({new Date(itemA.timestamp).toLocaleDateString()})
                </span>
              </div>
              <select
                id="select-snapshot-compare-a"
                value={indexA}
                onChange={(e) => setIndexA(Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-xl px-3 py-2 text-xs font-mono focus:border-rose-500 focus:outline-none cursor-pointer"
              >
                {safeItems.map((it, idx) => (
                  <option key={it.id} value={idx}>
                    #{idx + 1}: {it.title} ({it.timeFormatted} — {it.executionTimeMs.toFixed(1)}ms)
                  </option>
                ))}
              </select>
              <div className="text-xs text-zinc-400 bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800 space-y-1 font-mono">
                <div><strong className="text-zinc-300">Title:</strong> {itemA.title}</div>
                <div><strong className="text-zinc-300">Summary:</strong> {itemA.summary}</div>
              </div>
            </div>

            {/* Snapshot B Selection */}
            <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  Comparison Snapshot (B)
                </label>
                <span className="text-[11px] font-mono text-zinc-400">
                  {itemB.timeFormatted} ({new Date(itemB.timestamp).toLocaleDateString()})
                </span>
              </div>
              <select
                id="select-snapshot-compare-b"
                value={indexB}
                onChange={(e) => setIndexB(Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-xl px-3 py-2 text-xs font-mono focus:border-rose-500 focus:outline-none cursor-pointer"
              >
                {safeItems.map((it, idx) => (
                  <option key={it.id} value={idx}>
                    #{idx + 1}: {it.title} ({it.timeFormatted} — {it.executionTimeMs.toFixed(1)}ms)
                  </option>
                ))}
              </select>
              <div className="text-xs text-zinc-400 bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800 space-y-1 font-mono">
                <div><strong className="text-zinc-300">Title:</strong> {itemB.title}</div>
                <div><strong className="text-zinc-300">Summary:</strong> {itemB.summary}</div>
              </div>
            </div>
          </div>

          {/* Key Metrics Diff Summary Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Latency Diff Card */}
            <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex flex-col justify-between">
              <div className="text-xs font-mono text-zinc-400 flex items-center justify-between">
                <span>Execution Latency Diff</span>
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
              </div>
              <div className="my-2 flex items-baseline gap-2">
                <span className="text-lg font-extrabold font-mono text-white">
                  {itemA.executionTimeMs.toFixed(1)}ms
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-lg font-extrabold font-mono text-emerald-400">
                  {itemB.executionTimeMs.toFixed(1)}ms
                </span>
              </div>
              <div className={`text-xs font-mono font-bold flex items-center gap-1 ${latencyDiff <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {latencyDiff <= 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                <span>
                  {latencyDiff <= 0 ? `${Math.abs(latencyDiff).toFixed(1)}ms faster (${Math.abs(latencyPct).toFixed(1)}%)` : `+${latencyDiff.toFixed(1)}ms slower (+${latencyPct.toFixed(1)}%)`}
                </span>
                {latencyDiff < 0 && <span className="ml-1 px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded text-[10px]">({speedup}x Speedup)</span>}
              </div>
            </div>

            {/* N+1 Log Count Diff Card */}
            <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex flex-col justify-between">
              <div className="text-xs font-mono text-zinc-400 flex items-center justify-between">
                <span>Active N+1 Log Count</span>
                <Layers className="w-3.5 h-3.5 text-zinc-500" />
              </div>
              <div className="my-2 flex items-baseline gap-2">
                <span className="text-lg font-extrabold font-mono text-white">
                  {n1A} logs
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-lg font-extrabold font-mono text-rose-400">
                  {n1B} logs
                </span>
              </div>
              <div className={`text-xs font-mono font-bold flex items-center gap-1 ${n1Diff <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {n1Diff <= 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                <span>{n1Diff === 0 ? 'No change in log volume' : `${n1Diff > 0 ? '+' : ''}${n1Diff} log entries`}</span>
              </div>
            </div>

            {/* Record Count Diff Card */}
            <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex flex-col justify-between">
              <div className="text-xs font-mono text-zinc-400 flex items-center justify-between">
                <span>Total Record Count</span>
                <Database className="w-3.5 h-3.5 text-zinc-500" />
              </div>
              <div className="my-2 flex items-baseline gap-2">
                <span className="text-lg font-extrabold font-mono text-white">
                  {itemA.recordCount.toLocaleString()}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-lg font-extrabold font-mono text-blue-400">
                  {itemB.recordCount.toLocaleString()}
                </span>
              </div>
              <div className="text-xs font-mono text-zinc-400">
                {recordDiff === 0 ? 'Exact record set size' : `Delta: ${recordDiff > 0 ? '+' : ''}${recordDiff.toLocaleString()} records`}
              </div>
            </div>
          </div>

          {/* Architectural Flag State Diff Table */}
          <div className="bg-zinc-950/70 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <span>Architectural Optimization Flags Diff</span>
              </h3>
              <span className="text-[11px] font-mono text-zinc-400">Baseline (A) vs Comparison (B)</span>
            </div>
            <div className="divide-y divide-zinc-800/80">
              {flagList.map(({ key, label, desc }) => {
                const valA = flagsA[key];
                const valB = flagsB[key];
                const isChanged = valA !== valB;
                return (
                  <div key={key} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-zinc-900/40 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white font-mono">{label}</span>
                        {isChanged && (
                          <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded text-[10px] font-mono font-bold border border-amber-500/30">
                            State Changed
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400">{desc}</p>
                    </div>

                    <div className="flex items-center gap-6 font-mono text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500 text-[10px]">A:</span>
                        {valA ? (
                          <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> Enabled</span>
                        ) : (
                          <span className="flex items-center gap-1 text-rose-400"><XCircle className="w-3.5 h-3.5" /> Disabled</span>
                        )}
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-600" />
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500 text-[10px]">B:</span>
                        {valB ? (
                          <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> Enabled</span>
                        ) : (
                          <span className="flex items-center gap-1 text-rose-400"><XCircle className="w-3.5 h-3.5" /> Disabled</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/95 flex items-center justify-between">
          <div className="text-xs font-mono text-zinc-400">
            Comparing Snapshot <strong className="text-amber-400">#{indexA + 1}</strong> with Snapshot <strong className="text-emerald-400">#{indexB + 1}</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-mono text-xs font-bold rounded-xl transition-colors cursor-pointer shadow"
          >
            Close Diff View
          </button>
        </div>
      </div>
    </div>
  );
};
