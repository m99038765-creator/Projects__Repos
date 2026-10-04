import React, { useState, useMemo, useEffect } from 'react';
import {
  Flame,
  X,
  Lock,
  Unlock,
  Clock,
  AlertTriangle,
  Zap,
  CheckCircle2,
  Database,
  ArrowUpDown,
  Filter,
  Layers,
  Sparkles,
  Info,
  Shield,
  Activity,
  Table as TableIcon
} from 'lucide-react';
import { OptimizationFlags, QueryExecutionResult, LatencyTrendPoint } from '../types';

interface SparklinePoint {
  timestamp: number;
  timeFormatted: string;
  latency: number;
}

const InteractiveSparkline: React.FC<{ tableName: string; dataPoints: SparklinePoint[]; baseLatency: number }> = ({
  tableName,
  dataPoints,
  baseLatency
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const min = Math.min(...dataPoints.map(d => d.latency));
  const max = Math.max(...dataPoints.map(d => d.latency), min + 1);
  const width = 85;
  const height = 24;

  const coords = dataPoints.map((d, idx) => {
    const x = (idx / (dataPoints.length - 1)) * width;
    const y = height - ((d.latency - min) / (max - min || 1)) * (height - 8) - 4;
    return { x, y, ...d };
  });

  const polylinePoints = coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const strokeColor = baseLatency > 100 ? '#f43f5e' : baseLatency > 30 ? '#f59e0b' : '#10b981';

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    let closestIdx = 0;
    let minDist = Infinity;
    coords.forEach((c, idx) => {
      const dist = Math.abs(c.x - mouseX);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = idx;
      }
    });
    setHoverIndex(closestIdx);
  };

  const activePoint = hoverIndex !== null ? coords[hoverIndex] : coords[coords.length - 1];

  return (
    <div className="relative group flex flex-col items-center">
      {/* Hover tooltip with exact timestamp and latency value */}
      <div className="absolute -top-7 left-1/2 -translate-x-1/2 pointer-events-none z-30 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900 border border-zinc-700 text-white px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap shadow-2xl">
        <span className="text-amber-300 font-bold">{activePoint.latency}ms</span>
        <span className="text-zinc-400 mx-1">•</span>
        <span className="text-zinc-300">{activePoint.timeFormatted}</span>
      </div>

      <svg
        width={width}
        height={height}
        className="overflow-visible cursor-crosshair shrink-0"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polylinePoints}
        />
        {hoverIndex !== null && (
          <line
            x1={activePoint.x}
            y1={0}
            x2={activePoint.x}
            y2={height}
            stroke="#a1a1aa"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
        )}
        <circle
          cx={activePoint.x}
          cy={activePoint.y}
          r={hoverIndex !== null ? "4" : "2.5"}
          fill={strokeColor}
          stroke="#18181b"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
};

export interface TableBottleneckMetric {
  tableName: string;
  entityRole: string;
  rowCount: number;
  lockContentionScore: number; // 0 - 100
  lockWaitTimeMs: number;
  exclusiveLocksCount: number;
  sharedLocksCount: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  maxLatencyMs: number;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  blockingQuery: string;
  rootCause: string;
  recommendedFlag?: keyof OptimizationFlags;
  recommendedAction: string;
}

interface DatabaseBottleneckHeatmapDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  flags: OptimizationFlags;
  onToggleFlag: (flag: keyof OptimizationFlags) => void;
  queryResult?: QueryExecutionResult;
  trendHistory?: LatencyTrendPoint[];
}

export const DatabaseBottleneckHeatmapDrawer: React.FC<DatabaseBottleneckHeatmapDrawerProps> = ({
  isOpen,
  onClose,
  flags,
  onToggleFlag,
  queryResult,
  trendHistory
}) => {
  const [selectedTable, setSelectedTable] = useState<string>('transactions');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'high' | 'moderate' | 'low'>('all');
  const [sortBy, setSortBy] = useState<'contention' | 'latency' | 'rows' | 'name'>('contention');
  const [viewMode, setViewMode] = useState<'matrix' | 'cards'>('matrix');
  const [revealKey, setRevealKey] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      setRevealKey((k) => k + 1);
    }
  }, [isOpen, viewMode]);

  // Compute live bottleneck heatmap metrics based on active database flags and query performance
  const tableMetrics: TableBottleneckMetric[] = useMemo(() => {
    const isBatchOff = !flags.batchEagerLoading;
    const isBtreeOff = !flags.btreeIndexing;
    const isCacheOff = !flags.queryCaching;

    const list: TableBottleneckMetric[] = [
      {
        tableName: 'transactions',
        entityRole: 'Primary Ledger Anchor',
        rowCount: 50000,
        lockContentionScore: isBtreeOff ? 94 : isBatchOff ? 78 : 12,
        lockWaitTimeMs: isBtreeOff ? 46.2 : isBatchOff ? 28.5 : 0.8,
        exclusiveLocksCount: isBtreeOff ? 42 : isBatchOff ? 26 : 4,
        sharedLocksCount: isBtreeOff ? 820 : isBatchOff ? 460 : 64,
        avgLatencyMs: isBtreeOff ? 48.5 : isBatchOff ? 24.2 : 1.2,
        p95LatencyMs: isBtreeOff ? 112.0 : isBatchOff ? 65.0 : 3.4,
        maxLatencyMs: isBtreeOff ? 184.0 : isBatchOff ? 98.0 : 8.5,
        severity: isBtreeOff ? 'critical' : isBatchOff ? 'high' : 'low',
        blockingQuery: 'SELECT * FROM transactions WHERE status = ? AND category = ?',
        rootCause: isBtreeOff
          ? 'Full-table sequential scan holds shared read locks across all 50,000 heap pages, blocking write serialization.'
          : isBatchOff
          ? 'Unbatched child joins stall transaction completion, elongating lock holding time.'
          : 'Normal index lookups with isolated row-level concurrency.',
        recommendedFlag: isBtreeOff ? 'btreeIndexing' : isBatchOff ? 'batchEagerLoading' : undefined,
        recommendedAction: isBtreeOff
          ? 'Enable B-Tree Indexing to eliminate full-table shared locks and restrict scan to matching index leaf nodes.'
          : isBatchOff
          ? 'Enable Batch Eager Loading to compress 100+ roundtrips into a single atomic join.'
          : 'Operating at optimal throughput.'
      },
      {
        tableName: 'line_items',
        entityRole: 'Relational Child Items (1:N)',
        rowCount: 150000,
        lockContentionScore: isBatchOff ? 98 : isBtreeOff ? 62 : 8,
        lockWaitTimeMs: isBatchOff ? 186.4 : isBtreeOff ? 34.0 : 1.1,
        exclusiveLocksCount: isBatchOff ? 88 : isBtreeOff ? 22 : 2,
        sharedLocksCount: isBatchOff ? 1420 : isBtreeOff ? 380 : 85,
        avgLatencyMs: isBatchOff ? (queryResult?.executionTimeMs ? Math.max(queryResult.executionTimeMs, 140) : 214.2) : 2.1,
        p95LatencyMs: isBatchOff ? 260.0 : 5.8,
        maxLatencyMs: isBatchOff ? 340.0 : 12.0,
        severity: isBatchOff ? 'critical' : isBtreeOff ? 'high' : 'low',
        blockingQuery: 'SELECT * FROM line_items WHERE transaction_id = ? /* Unbatched N+1 */',
        rootCause: isBatchOff
          ? 'Unbatched N+1 query storm fires 100+ separate transactions in parallel, saturating Postgres connection pool and causing lock wait queuing.'
          : isBtreeOff
          ? 'Foreign key lookups delayed by parent transaction serialization bottleneck.'
          : 'Single batched hash join eliminates child connection queuing.',
        recommendedFlag: isBatchOff ? 'batchEagerLoading' : undefined,
        recommendedAction: isBatchOff
          ? 'Enable Batch Eager Loading immediately to replace 100+ synchronous child queries with a single batched hash join.'
          : 'Clean concurrency profile with batched reads.'
      },
      {
        tableName: 'inventory_allocations',
        entityRole: 'Warehouse Stock Reservation',
        rowCount: 25000,
        lockContentionScore: isBatchOff ? 68 : isBtreeOff ? 42 : 14,
        lockWaitTimeMs: isBatchOff ? 38.6 : 2.4,
        exclusiveLocksCount: isBatchOff ? 34 : 6,
        sharedLocksCount: isBatchOff ? 310 : 42,
        avgLatencyMs: isBatchOff ? 28.5 : 2.4,
        p95LatencyMs: isBatchOff ? 64.0 : 5.1,
        maxLatencyMs: isBatchOff ? 95.0 : 9.8,
        severity: isBatchOff ? 'high' : 'low',
        blockingQuery: 'UPDATE inventory_allocations SET reserved_qty = reserved_qty + ? WHERE sku = ?',
        rootCause: isBatchOff
          ? 'Cascading line-item joins delay stock reconciliation locks, leading to thread contention.'
          : 'Low lock wait latency with isolated row-level updates.',
        recommendedFlag: isBatchOff ? 'batchEagerLoading' : undefined,
        recommendedAction: isBatchOff
          ? 'Batch child relations to minimize reservation lock holding windows.'
          : 'No critical contention observed.'
      },
      {
        tableName: 'customers',
        entityRole: 'Master Dimension Registry',
        rowCount: 12500,
        lockContentionScore: isCacheOff ? 38 : 10,
        lockWaitTimeMs: isCacheOff ? 6.2 : 0.6,
        exclusiveLocksCount: 2,
        sharedLocksCount: isCacheOff ? 420 : 70,
        avgLatencyMs: isCacheOff ? 4.8 : 0.8,
        p95LatencyMs: isCacheOff ? 12.0 : 1.9,
        maxLatencyMs: isCacheOff ? 24.0 : 3.5,
        severity: isCacheOff ? 'moderate' : 'low',
        blockingQuery: 'SELECT * FROM customers WHERE id = ?',
        rootCause: isCacheOff
          ? 'Cache misses force repeated database reads, generating lightweight read-lock overhead.'
          : 'Cache hits bypass database engine entirely.',
        recommendedFlag: isCacheOff ? 'queryCaching' : undefined,
        recommendedAction: isCacheOff
          ? 'Enable LRU Query Caching to serve customer dimension records from memory with 0ms lock wait.'
          : 'Operating within sub-millisecond SLA.'
      },
      {
        tableName: 'payment_settlements',
        entityRole: 'Financial Ledger Settlements',
        rowCount: 45000,
        lockContentionScore: isBtreeOff ? 74 : 16,
        lockWaitTimeMs: isBtreeOff ? 29.4 : 1.5,
        exclusiveLocksCount: isBtreeOff ? 28 : 5,
        sharedLocksCount: isBtreeOff ? 390 : 55,
        avgLatencyMs: isBtreeOff ? 31.2 : 1.9,
        p95LatencyMs: isBtreeOff ? 72.0 : 4.2,
        maxLatencyMs: isBtreeOff ? 110.0 : 7.6,
        severity: isBtreeOff ? 'high' : 'low',
        blockingQuery: 'SELECT * FROM payment_settlements WHERE order_id = ? AND settlement_status = ?',
        rootCause: isBtreeOff
          ? 'Lack of composite covering index causes shared read lock waits during reconciliation runs.'
          : 'Optimized index coverage maintains non-blocking reads.',
        recommendedFlag: isBtreeOff ? 'btreeIndexing' : undefined,
        recommendedAction: isBtreeOff
          ? 'Enable B-Tree Indexing to avoid full settlement table locks.'
          : 'Settlement queue is healthy.'
      },
      {
        tableName: 'audit_logs',
        entityRole: 'Security & WAL Event Log',
        rowCount: 80000,
        lockContentionScore: isCacheOff ? 44 : 12,
        lockWaitTimeMs: isCacheOff ? 8.5 : 0.9,
        exclusiveLocksCount: 16,
        sharedLocksCount: isCacheOff ? 280 : 35,
        avgLatencyMs: isCacheOff ? 6.4 : 1.1,
        p95LatencyMs: isCacheOff ? 16.5 : 2.5,
        maxLatencyMs: isCacheOff ? 32.0 : 5.0,
        severity: isCacheOff ? 'moderate' : 'low',
        blockingQuery: 'INSERT INTO audit_logs (event_type, query_plan, created_at) VALUES (?, ?, NOW())',
        rootCause: isCacheOff
          ? 'Higher query volume triggers write-ahead lock contention during high throughput.'
          : 'Normal asynchronous append throughput.',
        recommendedFlag: undefined,
        recommendedAction: 'Partition historical logs by month to maintain minimal append lock contention.'
      }
    ];

    return list;
  }, [flags, queryResult?.executionTimeMs]);

  // Filtered & sorted table metrics
  const displayedTables = useMemo(() => {
    let result = [...tableMetrics];

    if (severityFilter !== 'all') {
      result = result.filter((t) => t.severity === severityFilter);
    }

    result.sort((a, b) => {
      if (sortBy === 'contention') return b.lockContentionScore - a.lockContentionScore;
      if (sortBy === 'latency') return b.avgLatencyMs - a.avgLatencyMs;
      if (sortBy === 'rows') return b.rowCount - a.rowCount;
      if (sortBy === 'name') return a.tableName.localeCompare(b.tableName);
      return 0;
    });

    return result;
  }, [tableMetrics, severityFilter, sortBy]);

  const activeTableData = useMemo(() => {
    return tableMetrics.find((t) => t.tableName === selectedTable) || tableMetrics[0];
  }, [tableMetrics, selectedTable]);

  // Helper to render a 5-minute trend-line sparkline for a specific table
  const renderTableSparkline = (tableName: string, baseLatency: number) => {
    const history = trendHistory || [];
    const now = Date.now();
    const windowStart = now - 5 * 60 * 1000;
    const recentPoints = history.filter((pt) => pt.timestamp >= windowStart);

    const pointsCount = 8;
    const dataPoints: SparklinePoint[] = [];
    const multiplier = tableName === 'line_items' ? 1.4 : tableName === 'transactions' ? 1.2 : tableName === 'inventory_allocations' ? 1.0 : 0.8;

    if (recentPoints.length >= 3) {
      const step = Math.max(1, Math.floor(recentPoints.length / pointsCount));
      for (let i = 0; i < pointsCount; i++) {
        const pt = recentPoints[Math.min(recentPoints.length - 1, i * step)];
        dataPoints.push({
          timestamp: pt.timestamp,
          timeFormatted: pt.timeFormatted || new Date(pt.timestamp).toLocaleTimeString(),
          latency: Number((pt.executionTimeMs * multiplier).toFixed(1))
        });
      }
    } else {
      for (let i = 0; i < pointsCount; i++) {
        const timeOffset = (pointsCount - 1 - i) * 35 * 1000;
        const ptTime = now - timeOffset;
        const jitter = Math.sin(i * 0.8 + tableName.length) * (baseLatency * 0.25);
        const lat = Math.max(0.1, Number((baseLatency * 0.7 + jitter).toFixed(1)));
        dataPoints.push({
          timestamp: ptTime,
          timeFormatted: new Date(ptTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          latency: lat
        });
      }
      dataPoints[dataPoints.length - 1].latency = baseLatency;
    }

    return <InteractiveSparkline tableName={tableName} dataPoints={dataPoints} baseLatency={baseLatency} />;
  };

  // Identify currently highest-latency query table from trendHistory / tableMetrics
  const highestLatencyTableName = useMemo(() => {
    const history = trendHistory || [];
    const peak = history.reduce((max, pt) => (pt.executionTimeMs > (max?.executionTimeMs || 0) ? pt : max), null as LatencyTrendPoint | null);

    if (peak) {
      const text = (peak.triggerEvent || '').toLowerCase();
      if (text.includes('line_items') || text.includes('n+1') || text.includes('cascade')) {
        return 'line_items';
      }
      if (text.includes('inventory') || text.includes('stock')) {
        return 'inventory_allocations';
      }
      if (text.includes('customer')) {
        return 'customers';
      }
    }

    const sortedTables = [...tableMetrics].sort((a, b) => b.maxLatencyMs - a.maxLatencyMs);
    return sortedTables[0]?.tableName || 'transactions';
  }, [trendHistory, tableMetrics]);

  const [highlightedTable, setHighlightedTable] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const targetTable = highestLatencyTableName;
      setSelectedTable(targetTable);
      setHighlightedTable(targetTable);

      const timer = setTimeout(() => {
        const el = document.getElementById(`matrix-cell-${targetTable}-avglatency`) ||
                   document.getElementById(`matrix-row-${targetTable}`) ||
                   document.getElementById(`bottleneck-card-${targetTable}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);

      const clearTimer = setTimeout(() => {
        setHighlightedTable(null);
      }, 4000);

      return () => {
        clearTimeout(timer);
        clearTimeout(clearTimer);
      };
    }
  }, [isOpen, highestLatencyTableName]);

  if (!isOpen) return null;

  // Severity color helpers
  const getSeverityBadge = (severity: TableBottleneckMetric['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-600 text-white border-rose-700 animate-pulse';
      case 'high':
        return 'bg-amber-600 text-white border-amber-700';
      case 'moderate':
        return 'bg-yellow-500 text-zinc-950 font-bold border-yellow-600';
      case 'low':
      default:
        return 'bg-emerald-600 text-white border-emerald-700';
    }
  };

  const getHeatmapCellBg = (score: number) => {
    if (score >= 80) return 'bg-rose-500 text-white font-bold';
    if (score >= 60) return 'bg-orange-500 text-white font-bold';
    if (score >= 40) return 'bg-amber-400 text-zinc-950 font-bold';
    if (score >= 20) return 'bg-yellow-300 text-zinc-900 font-semibold';
    return 'bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/40';
  };

  const getLatencyHeatCellBg = (latencyMs: number) => {
    if (latencyMs >= 150) return 'bg-rose-500 text-white font-bold';
    if (latencyMs >= 80) return 'bg-orange-500 text-white font-bold';
    if (latencyMs >= 30) return 'bg-amber-400 text-zinc-950 font-bold';
    if (latencyMs >= 10) return 'bg-yellow-300 text-zinc-900 font-semibold';
    return 'bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/40';
  };

  if (!isOpen) return null;

  return (
    <div
      id="database-bottleneck-heatmap-drawer-overlay"
      data-testid="database-bottleneck-heatmap-drawer-overlay"
      className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="database-bottleneck-heatmap-drawer-panel"
        data-testid="database-bottleneck-heatmap-drawer-panel"
        className="w-full max-w-4xl bg-zinc-900 text-white h-full shadow-2xl flex flex-col border-l border-zinc-700 overflow-hidden animate-slide-in relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:px-6 bg-gradient-to-r from-zinc-950 via-rose-950/80 to-zinc-950 border-b border-rose-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-600 to-amber-600 text-white shadow-lg animate-pulse">
              <Flame className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                  Database Bottleneck Heatmap
                </h2>
                <span className="font-mono text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-bold uppercase shadow-xs">
                  Matrix Telemetry
                </span>
                <span className="font-mono text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded border border-zinc-700">
                  {tableMetrics.length} Database Tables
                </span>
              </div>
              <p className="text-xs text-rose-200/90 mt-0.5">
                Visual matrix of database tables color-coded by lock contention severity and query latency.
              </p>
            </div>
          </div>

          <button
            type="button"
            id="btn-close-bottleneck-heatmap-drawer"
            data-testid="btn-close-bottleneck-heatmap-drawer"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
            title="Close Bottleneck Heatmap Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Bottleneck Alert Ribbon */}
        {tableMetrics.some((t) => t.severity === 'critical') && (
          <div className="px-5 py-2.5 bg-gradient-to-r from-rose-950 via-rose-900 to-amber-950 border-b border-rose-800 text-xs text-rose-200 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
              <span>
                <strong>Severe Lock Contention Detected:</strong> One or more tables are experiencing high lock wait time. Check unbatched loops or full table scans.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!flags.batchEagerLoading && (
                <button
                  type="button"
                  id="drawer-btn-fix-batch"
                  data-testid="drawer-btn-fix-batch"
                  onClick={() => onToggleFlag('batchEagerLoading')}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded font-bold text-[10px] shadow cursor-pointer transition-colors"
                >
                  Enable batchEagerLoading
                </button>
              )}
              {!flags.btreeIndexing && (
                <button
                  type="button"
                  id="drawer-btn-fix-btree"
                  data-testid="drawer-btn-fix-btree"
                  onClick={() => onToggleFlag('btreeIndexing')}
                  className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded font-bold text-[10px] shadow cursor-pointer transition-colors"
                >
                  Enable btreeIndexing
                </button>
              )}
            </div>
          </div>
        )}

        {/* Controls Bar: View Mode, Filter, Sort */}
        <div className="p-3.5 bg-zinc-950/70 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 font-medium flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-zinc-500" />
              <span>Severity:</span>
            </span>
            <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
              {(['all', 'critical', 'high', 'moderate', 'low'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  id={`filter-severity-${s}`}
                  data-testid={`filter-severity-${s}`}
                  onClick={() => setSeverityFilter(s)}
                  className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer capitalize transition-all ${
                    severityFilter === s
                      ? 'bg-rose-600 text-white font-bold shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-400 font-medium flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
                <span>Sort by:</span>
              </span>
              <select
                id="select-bottleneck-sort"
                data-testid="select-bottleneck-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-zinc-800 border border-zinc-700 text-zinc-200 font-mono text-xs rounded px-2 py-1 cursor-pointer focus:outline-hidden"
              >
                <option value="contention">Lock Contention (Desc)</option>
                <option value="latency">Query Latency (Desc)</option>
                <option value="rows">Row Count (Desc)</option>
                <option value="name">Table Name (A-Z)</option>
              </select>
            </div>

            <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
              <button
                type="button"
                id="btn-view-mode-matrix"
                data-testid="btn-view-mode-matrix"
                onClick={() => setViewMode('matrix')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer transition-all ${
                  viewMode === 'matrix' ? 'bg-zinc-800 text-white font-bold shadow-xs' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Matrix View
              </button>
              <button
                type="button"
                id="btn-view-mode-cards"
                data-testid="btn-view-mode-cards"
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer transition-all ${
                  viewMode === 'cards' ? 'bg-zinc-800 text-white font-bold shadow-xs' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Table Cards
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Body: Matrix & Details */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-zinc-900/90">
          {/* Visual Matrix View */}
          {viewMode === 'matrix' ? (
            <div className="bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden shadow-xl">
              <div className="p-3.5 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TableIcon className="w-4 h-4 text-rose-400" />
                  <span className="font-bold text-xs text-white">Database Tables Contention &amp; Latency Matrix</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-zinc-400 font-mono">
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" />
                    <span>Critical (&gt;80% / &gt;150ms)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-amber-400" />
                    <span>Moderate</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                    <span>Optimal (&lt;20%)</span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-sans">
                  <thead>
                    <tr className="bg-zinc-900/60 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
                      <th className="py-2.5 px-3 font-semibold">Table</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Contention Index</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Lock Wait Time</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Avg Latency</th>
                      <th className="py-2.5 px-3 font-semibold text-center">P95 Latency</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Active Locks (Excl / Shared)</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Severity</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {displayedTables.map((t, rowIdx) => {
                      const isHighlighted = highlightedTable === t.tableName;
                      const isSelected = selectedTable === t.tableName;
                      return (
                        <tr
                          key={`${t.tableName}-${revealKey}`}
                          id={`matrix-row-${t.tableName}`}
                          data-testid={`matrix-row-${t.tableName}`}
                          onClick={() => setSelectedTable(t.tableName)}
                          className={`cursor-pointer transition-all duration-300 ${
                            isHighlighted
                              ? 'bg-amber-500/20 ring-2 ring-amber-400 shadow-2xl scale-[1.01] z-20'
                              : isSelected
                              ? 'bg-rose-950/40 ring-1 ring-rose-500/50'
                              : 'hover:bg-zinc-800/50'
                          }`}
                        >
                          <td
                            id={`matrix-cell-${t.tableName}-table`}
                            data-testid={`matrix-cell-${t.tableName}-table`}
                            className="py-3 px-3 animate-matrix-cell-reveal"
                            style={{ animationDelay: `${rowIdx * 35 + 0}ms` }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{
                                backgroundColor: t.severity === 'critical' ? '#f43f5e' : t.severity === 'high' ? '#f59e0b' : t.severity === 'moderate' ? '#eab308' : '#10b981'
                              }} />
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono font-bold text-white text-xs block">
                                    {t.tableName}
                                  </span>
                                  {isHighlighted && (
                                    <span className="font-mono text-[9px] bg-amber-400 text-zinc-950 px-1.5 py-0.2 rounded font-extrabold animate-pulse shadow-xs">
                                      PEAK LATENCY QUERY
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-zinc-400 block font-sans">
                                  {t.entityRole} • {t.rowCount.toLocaleString()} rows
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Contention Cell */}
                          <td
                            id={`matrix-cell-${t.tableName}-contention`}
                            data-testid={`matrix-cell-${t.tableName}-contention`}
                            className="py-3 px-3 text-center animate-matrix-cell-reveal"
                            style={{ animationDelay: `${rowIdx * 35 + 20}ms` }}
                          >
                            <span
                              className={`inline-block px-2.5 py-1 rounded-md text-xs font-mono transition-transform hover:scale-105 shadow-2xs ${getHeatmapCellBg(
                                t.lockContentionScore
                              )}`}
                              title={`Lock Contention Score: ${t.lockContentionScore}%`}
                            >
                              {t.lockContentionScore}%
                            </span>
                          </td>

                          {/* Lock Wait Time Cell */}
                          <td
                            id={`matrix-cell-${t.tableName}-lockwait`}
                            data-testid={`matrix-cell-${t.tableName}-lockwait`}
                            className="py-3 px-3 text-center font-mono animate-matrix-cell-reveal"
                            style={{ animationDelay: `${rowIdx * 35 + 40}ms` }}
                          >
                            <span className={t.lockWaitTimeMs > 20 ? 'text-rose-400 font-bold' : 'text-zinc-300'}>
                              {t.lockWaitTimeMs.toFixed(1)} ms
                            </span>
                          </td>

                          {/* Avg Latency Cell */}
                          <td
                            id={`matrix-cell-${t.tableName}-avglatency`}
                            data-testid={`matrix-cell-${t.tableName}-avglatency`}
                            className="py-3 px-3 text-center font-mono animate-matrix-cell-reveal"
                            style={{ animationDelay: `${rowIdx * 35 + 60}ms` }}
                          >
                            <div className="flex flex-col items-center justify-center gap-1">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-xs ${getLatencyHeatCellBg(
                                  t.avgLatencyMs
                                )}`}
                              >
                                {t.avgLatencyMs.toFixed(1)} ms
                              </span>
                              {renderTableSparkline(t.tableName, t.avgLatencyMs)}
                            </div>
                          </td>

                          {/* P95 Latency Cell */}
                          <td
                            id={`matrix-cell-${t.tableName}-p95latency`}
                            data-testid={`matrix-cell-${t.tableName}-p95latency`}
                            className="py-3 px-3 text-center font-mono text-zinc-300 animate-matrix-cell-reveal"
                            style={{ animationDelay: `${rowIdx * 35 + 80}ms` }}
                          >
                            {t.p95LatencyMs.toFixed(1)} ms
                          </td>

                          {/* Active Locks Cell */}
                          <td
                            id={`matrix-cell-${t.tableName}-locks`}
                            data-testid={`matrix-cell-${t.tableName}-locks`}
                            className="py-3 px-3 text-center font-mono text-[11px] animate-matrix-cell-reveal"
                            style={{ animationDelay: `${rowIdx * 35 + 100}ms` }}
                          >
                            <span className="text-rose-400 font-bold">{t.exclusiveLocksCount} Excl</span>
                            <span className="text-zinc-500 mx-1">/</span>
                            <span className="text-indigo-300">{t.sharedLocksCount} Shared</span>
                          </td>

                          {/* Severity Badge */}
                          <td
                            id={`matrix-cell-${t.tableName}-severity`}
                            data-testid={`matrix-cell-${t.tableName}-severity`}
                            className="py-3 px-3 text-center animate-matrix-cell-reveal"
                            style={{ animationDelay: `${rowIdx * 35 + 120}ms` }}
                          >
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getSeverityBadge(t.severity)}`}>
                              {t.severity}
                            </span>
                          </td>

                          {/* Inspect / Fix Button */}
                          <td
                            id={`matrix-cell-${t.tableName}-action`}
                            data-testid={`matrix-cell-${t.tableName}-action`}
                            className="py-3 px-3 text-right animate-matrix-cell-reveal"
                            style={{ animationDelay: `${rowIdx * 35 + 140}ms` }}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTable(t.tableName);
                              }}
                              className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded text-[11px] font-semibold transition-colors cursor-pointer"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Cards View */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {displayedTables.map((t, cardIdx) => {
                const isSelected = selectedTable === t.tableName;
                return (
                  <div
                    key={`${t.tableName}-${revealKey}`}
                    id={`bottleneck-card-${t.tableName}`}
                    data-testid={`bottleneck-card-${t.tableName}`}
                    onClick={() => setSelectedTable(t.tableName)}
                    style={{ animationDelay: `${cardIdx * 50}ms` }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 animate-matrix-cell-reveal ${
                      isSelected
                        ? 'bg-rose-950/30 border-rose-500 ring-2 ring-rose-500/40 shadow-lg'
                        : 'bg-zinc-950/80 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div className={`p-2 rounded-lg shrink-0 ${
                          t.severity === 'critical' ? 'bg-rose-600 text-white' : t.severity === 'high' ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-300'
                        }`}>
                          <Lock className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm font-mono">{t.tableName}</div>
                          <div className="text-[11px] text-zinc-400">{t.entityRole}</div>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getSeverityBadge(t.severity)}`}>
                        {t.severity}
                      </span>
                    </div>

                    <div className="space-y-2 bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800">
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div>
                          <span className="text-zinc-500 text-[10px] block">Lock Contention</span>
                          <strong className="text-rose-400 text-sm">{t.lockContentionScore}%</strong>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-[10px] block">Avg Latency</span>
                          <strong className="text-amber-300 text-sm">{t.avgLatencyMs.toFixed(1)}ms</strong>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-[10px] block">Lock Wait Time</span>
                          <span className="text-zinc-300">{t.lockWaitTimeMs.toFixed(1)}ms</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-[10px] block">Table Rows</span>
                          <span className="text-zinc-300">{t.rowCount.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                        <span className="text-[10px] text-zinc-400 font-mono">5m Trend Sparkline</span>
                        {renderTableSparkline(t.tableName, t.avgLatencyMs)}
                      </div>
                    </div>

                    <div className="text-[11px] text-zinc-300 line-clamp-2">
                      {t.rootCause}
                    </div>

                    <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-xs">
                      <span className="text-zinc-400 text-[10px] font-mono">
                        {t.exclusiveLocksCount} Excl / {t.sharedLocksCount} Shared locks
                      </span>
                      <span className="text-indigo-400 font-semibold text-[11px] hover:underline">
                        View Inspector →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Deep-Dive Table Bottleneck Inspector Pane */}
          {activeTableData && (
            <div
              id="table-bottleneck-inspector-pane"
              data-testid="table-bottleneck-inspector-pane"
              className="p-5 bg-gradient-to-b from-zinc-950 to-zinc-900 rounded-2xl border-2 border-zinc-800 shadow-xl space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-rose-600/30 text-rose-400 border border-rose-500/40 rounded-xl">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-white font-mono">
                        Table Inspector: {activeTableData.tableName}
                      </h3>
                      <span className={`px-2 py-0.2 rounded text-[10px] font-bold uppercase border ${getSeverityBadge(activeTableData.severity)}`}>
                        {activeTableData.severity} Contention
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {activeTableData.entityRole} • {activeTableData.rowCount.toLocaleString()} records in database storage
                    </p>
                  </div>
                </div>

                {activeTableData.recommendedFlag && (
                  <button
                    type="button"
                    id={`btn-remediate-bottleneck-${activeTableData.tableName}`}
                    data-testid="btn-remediate-bottleneck"
                    onClick={() => {
                      if (activeTableData.recommendedFlag) {
                        onToggleFlag(activeTableData.recommendedFlag);
                      }
                    }}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer transition-all flex items-center gap-1.5 self-start sm:self-center"
                    title={`Toggle ${activeTableData.recommendedFlag} flag to resolve bottleneck`}
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                    <span>Fix: Toggle {activeTableData.recommendedFlag}</span>
                  </button>
                )}
              </div>

              {/* Metric Breakdown Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800">
                  <span className="text-zinc-500 text-[10px] block">Lock Contention Index</span>
                  <strong className="text-rose-400 text-lg">{activeTableData.lockContentionScore}%</strong>
                  <div className="w-full bg-zinc-800 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-rose-500 h-full" style={{ width: `${activeTableData.lockContentionScore}%` }} />
                  </div>
                </div>

                <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800">
                  <span className="text-zinc-500 text-[10px] block">Avg Lock Wait Time</span>
                  <strong className="text-amber-400 text-lg">{activeTableData.lockWaitTimeMs.toFixed(1)} ms</strong>
                  <div className="text-[10px] text-zinc-400 mt-1">P95: {activeTableData.p95LatencyMs.toFixed(1)}ms</div>
                </div>

                <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800">
                  <span className="text-zinc-500 text-[10px] block">Query Execution Latency</span>
                  <strong className="text-indigo-300 text-lg">{activeTableData.avgLatencyMs.toFixed(1)} ms</strong>
                  <div className="text-[10px] text-zinc-400 mt-1">Max: {activeTableData.maxLatencyMs.toFixed(1)}ms</div>
                </div>

                <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800">
                  <span className="text-zinc-500 text-[10px] block">Lock Concurrency</span>
                  <strong className="text-white text-lg">{activeTableData.exclusiveLocksCount + activeTableData.sharedLocksCount}</strong>
                  <div className="text-[10px] text-zinc-400 mt-1">
                    {activeTableData.exclusiveLocksCount} Excl / {activeTableData.sharedLocksCount} Shared
                  </div>
                </div>
              </div>

              {/* Diagnosis and Action */}
              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-1">
                  <div className="text-zinc-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Root Cause Analysis</span>
                  </div>
                  <p className="text-zinc-200 leading-relaxed">
                    {activeTableData.rootCause}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-1">
                  <div className="text-zinc-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Recommended Mitigation</span>
                  </div>
                  <p className="text-emerald-300 leading-relaxed">
                    {activeTableData.recommendedAction}
                  </p>
                </div>

                {/* Blocking Query Snippet */}
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1 font-mono text-[11px]">
                  <div className="text-zinc-500 text-[10px] uppercase font-sans font-bold">
                    Primary Contention Query Signature:
                  </div>
                  <div className="text-amber-200 p-2 bg-zinc-900/90 rounded border border-zinc-800 select-all overflow-x-auto">
                    {activeTableData.blockingQuery}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Heatmap sampling rate: Real-time telemetry synchronized with query logs</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
