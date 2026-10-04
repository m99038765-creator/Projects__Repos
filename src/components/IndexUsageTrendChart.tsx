import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import {
  TrendingUp,
  Calendar,
  Activity,
  Layers,
  Sparkles,
  BarChart2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface IndexUsageTrendChartProps {
  tables?: any[];
  selectedIndexName?: string;
  onSelectIndex?: (indexName: string) => void;
}

export interface DayUsagePoint {
  day: string;
  dateStr: string;
  readHits: number;
  writeOps: number;
  totalOps: number;
  readPct: number;
  isWeekend: boolean;
}

const DEFAULT_INDEXES = [
  { name: 'idx_orders_status_category', table: 'orders', type: 'Composite B-Tree', baselineReads: 8400, baselineWrites: 2100, pattern: 'midweek_surge' },
  { name: 'idx_transactions_customer_created', table: 'transactions', type: 'B-Tree Index', baselineReads: 12200, baselineWrites: 4800, pattern: 'diurnal' },
  { name: 'idx_customers_email_unique', table: 'customers', type: 'Unique B-Tree', baselineReads: 4500, baselineWrites: 320, pattern: 'weekday_read_heavy' },
  { name: 'idx_audit_logs_timestamp', table: 'audit_logs', type: 'BRIN Index', baselineReads: 920, baselineWrites: 14500, pattern: 'weekend_batch' },
  { name: 'idx_order_items_product_id', table: 'order_items', type: 'B-Tree Covering', baselineReads: 6700, baselineWrites: 1950, pattern: 'midweek_surge' },
];

export const IndexUsageTrendChart: React.FC<IndexUsageTrendChartProps> = ({
  tables,
  selectedIndexName: propSelectedIndex,
  onSelectIndex
}) => {
  // Aggregate available index names from tables or fallback
  const availableIndexes = useMemo(() => {
    const list: { name: string; table: string; type: string }[] = [];
    if (tables && tables.length > 0) {
      tables.forEach((tbl) => {
        tbl.indexes?.forEach((idx: any) => {
          list.push({
            name: idx.name,
            table: tbl.name,
            type: idx.type || 'BTREE'
          });
        });
      });
    }
    if (list.length === 0) {
      return DEFAULT_INDEXES;
    }
    return list;
  }, [tables]);

  const [selectedIndex, setSelectedIndex] = useState<string>(
    propSelectedIndex || availableIndexes[0]?.name || 'idx_orders_status_category'
  );
  const [chartType, setChartType] = useState<'area' | 'line'>('area');
  const [metricView, setMetricView] = useState<'both' | 'reads_only' | 'writes_only'>('both');

  const handleSelect = (idxName: string) => {
    setSelectedIndex(idxName);
    if (onSelectIndex) {
      onSelectIndex(idxName);
    }
  };

  // Generate 7-day realistic timeseries data based on index characteristics
  const { trendData, seasonalPattern, metrics } = useMemo(() => {
    const matched = DEFAULT_INDEXES.find((i) => i.name === selectedIndex);
    const hash = selectedIndex.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const baseReads = matched ? matched.baselineReads : 2000 + (hash * 17) % 8000;
    const baseWrites = matched ? matched.baselineWrites : 600 + (hash * 7) % 3500;

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    // Seasonal multiplier variations (Weekday business peak vs weekend batch maintenance)
    const readMultipliers = [1.12, 1.28, 1.35, 1.25, 1.15, 0.45, 0.38];
    const writeMultipliers = [0.85, 0.95, 1.02, 1.08, 1.18, 1.65, 1.82];

    const data: DayUsagePoint[] = days.map((day, i) => {
      const isWeekend = i >= 5;
      const rNoise = 0.92 + ((hash + i * 3) % 17) * 0.01;
      const wNoise = 0.90 + ((hash + i * 5) % 19) * 0.01;

      const readHits = Math.round(baseReads * readMultipliers[i] * rNoise);
      const writeOps = Math.round(baseWrites * writeMultipliers[i] * wNoise);
      const totalOps = readHits + writeOps;
      const readPct = totalOps > 0 ? Math.round((readHits / totalOps) * 100) : 50;

      return {
        day,
        dateStr: `Day ${i + 1} (${day})`,
        readHits,
        writeOps,
        totalOps,
        readPct,
        isWeekend
      };
    });

    const total7DayReads = data.reduce((sum, d) => sum + d.readHits, 0);
    const total7DayWrites = data.reduce((sum, d) => sum + d.writeOps, 0);
    const peakReads = Math.max(...data.map((d) => d.readHits));
    const peakWrites = Math.max(...data.map((d) => d.writeOps));
    const weekdayAvgReads = Math.round(data.slice(0, 5).reduce((sum, d) => sum + d.readHits, 0) / 5);
    const weekendAvgReads = Math.round(data.slice(5).reduce((sum, d) => sum + d.readHits, 0) / 2);
    const weekendAvgWrites = Math.round(data.slice(5).reduce((sum, d) => sum + d.writeOps, 0) / 2);
    const weekdayAvgWrites = Math.round(data.slice(0, 5).reduce((sum, d) => sum + d.writeOps, 0) / 5);

    let patternTitle = 'Mid-Week Surge Pattern';
    let patternDesc = 'Peak read frequency occurs Wednesday through Thursday during high customer active hours.';
    let patternBadge = 'Mid-Week Surge';
    let patternColor = 'indigo';

    if (weekendAvgWrites > weekdayAvgWrites * 1.4) {
      patternTitle = 'Weekend Batch Maintenance Spike';
      patternDesc = 'Heavy DML write amplification observed during Saturday/Sunday bulk synchronization and ETL pipelines.';
      patternBadge = 'Weekend ETL Heavy';
      patternColor = 'purple';
    } else if (weekdayAvgReads > weekendAvgReads * 2.2) {
      patternTitle = 'Strict Business Diurnal Seasonality';
      patternDesc = '91% of index lookups concentrate during Monday–Friday work hours, with sharp weekend dormancy.';
      patternBadge = 'Weekday Diurnal';
      patternColor = 'emerald';
    }

    return {
      trendData: data,
      seasonalPattern: {
        title: patternTitle,
        description: patternDesc,
        badge: patternBadge,
        color: patternColor,
      },
      metrics: {
        total7DayReads,
        total7DayWrites,
        peakReads,
        peakWrites,
        ratio: (total7DayReads / (total7DayWrites || 1)).toFixed(1),
        weekdayAvgReads,
        weekendAvgReads,
      }
    };
  }, [selectedIndex]);

  return (
    <div className="p-4 space-y-4 bg-white rounded-2xl border border-zinc-200 shadow-xs">
      {/* Header with Title and Index Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-zinc-900 tracking-tight">Index Usage Trend</h4>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-indigo-100 text-indigo-800">
              7-Day Telemetry
            </span>
          </div>
          <p className="text-[11px] text-zinc-500">
            Plots 7-day read vs. write frequency to isolate seasonal query bursts and ETL maintenance spikes.
          </p>
        </div>

        {/* Index Selector Dropdown */}
        <div className="shrink-0">
          <select
            value={selectedIndex}
            onChange={(e) => handleSelect(e.target.value)}
            className="w-full sm:w-auto text-xs font-mono font-bold bg-zinc-50 hover:bg-zinc-100 border border-zinc-300 rounded-xl px-2.5 py-1.5 text-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
          >
            {availableIndexes.map((idx) => (
              <option key={idx.name} value={idx.name}>
                {idx.name} ({idx.table})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Telemetry Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2.5 rounded-xl bg-indigo-50/80 border border-indigo-100">
          <span className="text-[10px] uppercase font-bold text-indigo-900 block">7-Day Reads</span>
          <span className="font-mono text-sm font-extrabold text-indigo-700">
            {metrics.total7DayReads.toLocaleString()}
          </span>
          <span className="text-[9px] text-indigo-600 block">Peak: {metrics.peakReads.toLocaleString()}/d</span>
        </div>

        <div className="p-2.5 rounded-xl bg-purple-50/80 border border-purple-100">
          <span className="text-[10px] uppercase font-bold text-purple-900 block">7-Day Writes</span>
          <span className="font-mono text-sm font-extrabold text-purple-700">
            {metrics.total7DayWrites.toLocaleString()}
          </span>
          <span className="text-[9px] text-purple-600 block">Peak: {metrics.peakWrites.toLocaleString()}/d</span>
        </div>

        <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-100">
          <span className="text-[10px] uppercase font-bold text-emerald-900 block">Read/Write Ratio</span>
          <span className="font-mono text-sm font-extrabold text-emerald-700">
            {metrics.ratio}:1
          </span>
          <span className="text-[9px] text-emerald-600 block">
            {Number(metrics.ratio) > 3 ? 'Read Dominant' : 'Mixed Workload'}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-100">
          <span className="text-[10px] uppercase font-bold text-amber-900 block">Seasonal Pattern</span>
          <span className="text-xs font-bold text-amber-800 line-clamp-1">
            {seasonalPattern.badge}
          </span>
          <span className="text-[9px] text-amber-700 block">7-Day Cycle Detected</span>
        </div>
      </div>

      {/* Chart Control Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-zinc-500">Metric:</span>
          <div className="inline-flex rounded-lg border border-zinc-200 p-0.5 bg-zinc-50">
            <button
              type="button"
              onClick={() => setMetricView('both')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                metricView === 'both' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Both
            </button>
            <button
              type="button"
              onClick={() => setMetricView('reads_only')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                metricView === 'reads_only' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Reads
            </button>
            <button
              type="button"
              onClick={() => setMetricView('writes_only')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                metricView === 'writes_only' ? 'bg-purple-600 text-white shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Writes
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-zinc-500">Style:</span>
          <div className="inline-flex rounded-lg border border-zinc-200 p-0.5 bg-zinc-50">
            <button
              type="button"
              onClick={() => setChartType('area')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                chartType === 'area' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Area
            </button>
            <button
              type="button"
              onClick={() => setChartType('line')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                chartType === 'line' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Line
            </button>
          </div>
        </div>
      </div>

      {/* Recharts 7-Day Trend Chart */}
      <div className="w-full h-64 bg-zinc-950 rounded-xl p-3 border border-zinc-800 shadow-inner">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'area' ? (
            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="colorReadHits" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="colorWriteOps" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="day" stroke="#a1a1aa" fontSize={11} tickLine={false} />
              <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  borderColor: '#3f3f46',
                  borderRadius: '0.75rem',
                  color: '#fff',
                  fontSize: '11px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)'
                }}
                formatter={(value: any, name: any) => [
                  `${Number(value).toLocaleString()} ops`,
                  name === 'readHits' ? 'Read Frequency' : 'Write Overhead'
                ]}
                labelFormatter={(label) => `Day: ${label}`}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }}
                formatter={(value) => value === 'readHits' ? 'Read Hits' : 'Write Ops'}
              />
              {(metricView === 'both' || metricView === 'reads_only') && (
                <Area
                  type="monotone"
                  dataKey="readHits"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorReadHits)"
                />
              )}
              {(metricView === 'both' || metricView === 'writes_only') && (
                <Area
                  type="monotone"
                  dataKey="writeOps"
                  stroke="#a855f7"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorWriteOps)"
                />
              )}
            </AreaChart>
          ) : (
            <LineChart data={trendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="day" stroke="#a1a1aa" fontSize={11} tickLine={false} />
              <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  borderColor: '#3f3f46',
                  borderRadius: '0.75rem',
                  color: '#fff',
                  fontSize: '11px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)'
                }}
                formatter={(value: any, name: any) => [
                  `${Number(value).toLocaleString()} ops`,
                  name === 'readHits' ? 'Read Frequency' : 'Write Overhead'
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }}
                formatter={(value) => value === 'readHits' ? 'Read Hits' : 'Write Ops'}
              />
              {(metricView === 'both' || metricView === 'reads_only') && (
                <Line
                  type="monotone"
                  dataKey="readHits"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#6366f1' }}
                  activeDot={{ r: 5 }}
                />
              )}
              {(metricView === 'both' || metricView === 'writes_only') && (
                <Line
                  type="monotone"
                  dataKey="writeOps"
                  stroke="#a855f7"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#a855f7' }}
                  activeDot={{ r: 5 }}
                />
              )}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Seasonal Insights Card */}
      <div className="p-3 bg-gradient-to-r from-indigo-50/90 via-purple-50/70 to-indigo-50/90 rounded-xl border border-indigo-200 text-xs space-y-1.5 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-indigo-950 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Seasonal Workload Diagnosis: {seasonalPattern.title}</span>
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-200 text-indigo-900 border border-indigo-300">
            {seasonalPattern.badge}
          </span>
        </div>
        <p className="text-[11px] text-zinc-700 leading-relaxed">
          {seasonalPattern.description}
        </p>
      </div>
    </div>
  );
};
