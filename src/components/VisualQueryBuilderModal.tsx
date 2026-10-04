import React, { useState, useMemo } from 'react';
import {
  Wrench,
  Database,
  Code,
  Sliders,
  Play,
  X,
  Layers,
  Cpu,
  Copy,
  Sparkles,
  Filter,
  ArrowRight,
  Clock,
  Terminal,
  Activity,
  Check
} from 'lucide-react';
import { OptimizationFlags } from '../types';

interface VisualQueryBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  flags: OptimizationFlags;
  onExecuteBuiltQuery?: (sql: string) => void;
}

interface FilterRule {
  id: string;
  column: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN';
  value: string;
}

export const VisualQueryBuilderModal: React.FC<VisualQueryBuilderModalProps> = ({
  isOpen,
  onClose,
  flags,
  onExecuteBuiltQuery
}) => {
  const [selectedTable, setSelectedTable] = useState<string>('transactions');
  const [selectedColumns, setSelectedColumns] = useState<string[]>(['id', 'order_date', 'status', 'total_amount']);
  const [filters, setFilters] = useState<FilterRule[]>([
    { id: 'f-1', column: 'status', operator: '=', value: 'Completed' },
    { id: 'f-2', column: 'total_amount', operator: '>', value: '250' }
  ]);
  const [orderByColumn, setOrderByColumn] = useState<string>('order_date');
  const [orderDirection, setOrderDirection] = useState<'ASC' | 'DESC'>('DESC');
  const [limitCount, setLimitCount] = useState<number>(100);
  const [copied, setCopied] = useState<boolean>(false);

  const availableTables = [
    { name: 'transactions', label: 'transactions (Orders Ledger)', totalRows: 50000 },
    { name: 'line_items', label: 'line_items (Order Items)', totalRows: 150000 },
    { name: 'inventory_allocations', label: 'inventory_allocations (Stock)', totalRows: 25000 },
    { name: 'customers', label: 'customers (Profiles)', totalRows: 10000 }
  ];

  const tableColumns: Record<string, string[]> = {
    transactions: ['id', 'order_date', 'status', 'total_amount', 'customer_id', 'currency', 'payment_method'],
    line_items: ['id', 'order_id', 'product_sku', 'quantity', 'unit_price', 'discount'],
    inventory_allocations: ['id', 'warehouse_id', 'product_sku', 'quantity_reserved', 'reorder_level'],
    customers: ['id', 'email', 'country', 'loyalty_tier', 'created_at']
  };

  const columns = tableColumns[selectedTable] || tableColumns.transactions;

  const handleToggleColumn = (col: string) => {
    if (selectedColumns.includes(col)) {
      if (selectedColumns.length > 1) {
        setSelectedColumns(selectedColumns.filter((c) => c !== col));
      }
    } else {
      setSelectedColumns([...selectedColumns, col]);
    }
  };

  const handleAddFilter = () => {
    const newFilter: FilterRule = {
      id: `f-${Date.now()}`,
      column: columns[0] || 'id',
      operator: '=',
      value: '100'
    };
    setFilters([...filters, newFilter]);
  };

  const handleRemoveFilter = (id: string) => {
    setFilters(filters.filter((f) => f.id !== id));
  };

  const handleUpdateFilter = (id: string, updates: Partial<FilterRule>) => {
    setFilters(filters.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  // Translate user selections into optimized raw SQL query
  const generatedSql = useMemo(() => {
    const cols = selectedColumns.length > 0 ? selectedColumns.join(', ') : '*';
    let sql = `SELECT ${cols}\nFROM ${selectedTable}`;

    if (filters.length > 0) {
      const clauses = filters.map((f) => {
        const valNum = Number(f.value);
        const isNum = !isNaN(valNum) && f.value.trim() !== '';
        const formattedVal = isNum || f.operator === 'IN' ? f.value : `'${f.value}'`;
        return `${f.column} ${f.operator} ${formattedVal}`;
      });
      sql += `\nWHERE ${clauses.join(' AND ')}`;
    }

    if (orderByColumn) {
      sql += `\nORDER BY ${orderByColumn} ${orderDirection}`;
    }

    if (limitCount > 0) {
      sql += `\nLIMIT ${limitCount};`;
    } else {
      sql += ';';
    }

    return sql;
  }, [selectedTable, selectedColumns, filters, orderByColumn, orderDirection, limitCount]);

  // Dynamically calculate estimated execution plan cost and metrics
  const executionPlan = useMemo(() => {
    const tableInfo = availableTables.find((t) => t.name === selectedTable) || availableTables[0];
    const baseRows = tableInfo.totalRows;
    const filterSelectivity = Math.pow(0.25, Math.max(1, filters.length));
    const estimatedRows = Math.max(1, Math.round(baseRows * filterSelectivity));

    const isBtreeActive = flags.btreeIndexing;
    const isCacheActive = flags.queryCaching;

    // Cost model
    let startupCost = isCacheActive ? 0.12 : 2.4;
    let totalCost = isBtreeActive ? estimatedRows * 0.08 + 12 : baseRows * 0.45 + 150;
    if (isCacheActive) totalCost *= 0.15;

    const accessMethod = isBtreeActive ? 'Index Scan (B-Tree IX_Query_Filter)' : 'Sequential Table Scan (Seq Scan)';
    const estimatedLatencyMs = isCacheActive ? 0.2 + estimatedRows * 0.001 : isBtreeActive ? 1.5 + estimatedRows * 0.005 : 35.0 + (baseRows / 1000) * 0.8;

    return {
      startupCost: Number(startupCost.toFixed(2)),
      totalCost: Number(totalCost.toFixed(1)),
      estimatedRows,
      accessMethod,
      estimatedLatencyMs: Number(estimatedLatencyMs.toFixed(1)),
      buffersRead: isCacheActive ? 2 : Math.round(baseRows / 100),
      isSequentialScan: !isBtreeActive
    };
  }, [selectedTable, filters.length, flags]);

  const handleCopySql = () => {
    navigator.clipboard.writeText(generatedSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div
        id="modal-visual-query-builder"
        data-testid="modal-visual-query-builder"
        className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Visual SQL Query Builder &amp; Optimizer</span>
                <span className="font-mono text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold">
                  Cost Optimizer Active
                </span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Construct queries visually. The query engine dynamically translates selections into optimized SQL and computes execution plan costs.
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-query-builder"
            data-testid="btn-close-query-builder"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Builder Controls */}
            <div className="space-y-4">
              {/* 1. Table Selector */}
              <div className="bg-zinc-900/80 p-4 rounded-xl border border-zinc-800 space-y-2">
                <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Target Table</span>
                </label>
                <select
                  id="select-builder-table"
                  data-testid="select-builder-table"
                  value={selectedTable}
                  onChange={(e) => {
                    const tbl = e.target.value;
                    setSelectedTable(tbl);
                    setSelectedColumns(tableColumns[tbl] ? tableColumns[tbl].slice(0, 4) : ['id']);
                  }}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-xs font-mono text-white focus:outline-indigo-500"
                >
                  {availableTables.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.label} ({t.totalRows.toLocaleString()} rows)
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Column Selection */}
              <div className="bg-zinc-900/80 p-4 rounded-xl border border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Select Columns ({selectedColumns.length})</span>
                  </label>
                  <span className="text-[10px] text-zinc-400 font-mono">Click to toggle</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {columns.map((col) => {
                    const isSelected = selectedColumns.includes(col);
                    return (
                      <button
                        key={col}
                        type="button"
                        id={`btn-col-${col}`}
                        data-testid={`btn-col-${col}`}
                        onClick={() => handleToggleColumn(col)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer flex items-center gap-1 ${
                          isSelected
                            ? 'bg-indigo-600 text-white border border-indigo-500 font-bold shadow-xs'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                        <span>{col}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Filters Builder */}
              <div className="bg-zinc-900/80 p-4 rounded-xl border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-indigo-400" />
                    <span>WHERE Filters ({filters.length})</span>
                  </label>
                  <button
                    type="button"
                    id="btn-add-filter"
                    data-testid="btn-add-filter"
                    onClick={handleAddFilter}
                    className="px-2 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 rounded text-xs font-medium transition-colors cursor-pointer"
                  >
                    + Add Filter
                  </button>
                </div>

                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {filters.map((f, idx) => (
                    <div key={f.id} className="flex items-center gap-2 bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                      <select
                        value={f.column}
                        onChange={(e) => handleUpdateFilter(f.id, { column: e.target.value })}
                        className="bg-zinc-900 text-xs text-white font-mono px-2 py-1 rounded border border-zinc-700 focus:outline-indigo-500"
                      >
                        {columns.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <select
                        value={f.operator}
                        onChange={(e) => handleUpdateFilter(f.id, { operator: e.target.value as any })}
                        className="bg-zinc-900 text-xs text-indigo-300 font-mono px-2 py-1 rounded border border-zinc-700 focus:outline-indigo-500 w-16"
                      >
                        <option value="=">=</option>
                        <option value="!=">!=</option>
                        <option value=">">&gt;</option>
                        <option value="<">&lt;</option>
                        <option value=">=">&gt;=</option>
                        <option value="<=">&lt;=</option>
                        <option value="LIKE">LIKE</option>
                        <option value="IN">IN</option>
                      </select>
                      <input
                        type="text"
                        value={f.value}
                        onChange={(e) => handleUpdateFilter(f.id, { value: e.target.value })}
                        className="flex-1 bg-zinc-900 text-xs text-white font-mono px-2 py-1 rounded border border-zinc-700 focus:outline-indigo-500"
                        placeholder="Value"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveFilter(f.id)}
                        className="text-zinc-500 hover:text-rose-400 p-1 cursor-pointer transition-colors"
                        title="Remove filter"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {filters.length === 0 && (
                    <div className="text-center py-3 text-xs text-zinc-500 italic">
                      No filters applied. Query will scan full table.
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Sorting & Limit */}
              <div className="bg-zinc-900/80 p-4 rounded-xl border border-zinc-800 grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">ORDER BY</label>
                  <div className="flex gap-1.5">
                    <select
                      value={orderByColumn}
                      onChange={(e) => setOrderByColumn(e.target.value)}
                      className="flex-1 bg-zinc-950 text-xs font-mono text-white px-2 py-1.5 rounded border border-zinc-700 focus:outline-indigo-500"
                    >
                      {columns.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setOrderDirection(orderDirection === 'ASC' ? 'DESC' : 'ASC')}
                      className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-indigo-300 font-mono text-xs rounded border border-zinc-700 cursor-pointer"
                    >
                      {orderDirection}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">LIMIT</label>
                  <input
                    type="number"
                    min="1"
                    max="5000"
                    value={limitCount}
                    onChange={(e) => setLimitCount(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-zinc-950 text-xs font-mono text-white px-2 py-1.5 rounded border border-zinc-700 focus:outline-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Generated SQL & Dynamic Execution Plan Cost */}
            <div className="space-y-4 flex flex-col">
              {/* Generated SQL Preview */}
              <div className="bg-zinc-900/90 rounded-xl border border-zinc-800 flex flex-col flex-1 overflow-hidden shadow-md">
                <div className="px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Optimized Raw SQL</span>
                  </div>
                  <button
                    type="button"
                    id="btn-copy-builder-sql"
                    data-testid="btn-copy-builder-sql"
                    onClick={handleCopySql}
                    className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer border border-zinc-700"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copied ? 'Copied!' : 'Copy SQL'}</span>
                  </button>
                </div>
                <div className="p-4 bg-zinc-950 flex-1 font-mono text-xs text-indigo-200 whitespace-pre overflow-x-auto">
                  {generatedSql}
                </div>
              </div>

              {/* Dynamic Execution Plan Cost Card */}
              <div className="bg-gradient-to-br from-indigo-950/60 via-zinc-900 to-zinc-950 p-4 rounded-xl border border-indigo-500/30 shadow-lg space-y-3">
                <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Estimated Execution Plan Cost</h4>
                  </div>
                  <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                    executionPlan.isSequentialScan
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}>
                    {executionPlan.accessMethod}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-zinc-950/80 p-3 rounded-lg border border-zinc-800">
                    <span className="text-[10px] text-zinc-400 block font-mono">Estimated Total Cost</span>
                    <span className="font-mono text-base font-bold text-amber-300 mt-0.5 block">
                      {executionPlan.totalCost.toLocaleString()}
                    </span>
                  </div>

                  <div className="bg-zinc-950/80 p-3 rounded-lg border border-zinc-800">
                    <span className="text-[10px] text-zinc-400 block font-mono">Estimated Latency</span>
                    <span className="font-mono text-base font-bold text-indigo-300 mt-0.5 block">
                      {executionPlan.estimatedLatencyMs} ms
                    </span>
                  </div>

                  <div className="bg-zinc-950/80 p-3 rounded-lg border border-zinc-800">
                    <span className="text-[10px] text-zinc-400 block font-mono">Estimated Rows Scanned</span>
                    <span className="font-mono text-sm font-bold text-zinc-100 mt-0.5 block">
                      {executionPlan.estimatedRows.toLocaleString()}
                    </span>
                  </div>

                  <div className="bg-zinc-950/80 p-3 rounded-lg border border-zinc-800">
                    <span className="text-[10px] text-zinc-400 block font-mono">Buffer Pages Read</span>
                    <span className="font-mono text-sm font-bold text-zinc-100 mt-0.5 block">
                      {executionPlan.buffersRead.toLocaleString()} pages
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-400 pt-1">
                  Cost dynamically adjusts based on active database flags (B-Tree Indexing, Query Caching) and filter selectivity.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-zinc-400">
            Tip: Toggle optimization flags in the main dashboard to observe real-time cost impact.
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="btn-builder-cancel"
              data-testid="btn-builder-cancel"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
            {onExecuteBuiltQuery && (
              <button
                type="button"
                id="btn-execute-built-query"
                data-testid="btn-execute-built-query"
                onClick={() => {
                  onExecuteBuiltQuery(generatedSql);
                  onClose();
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Execute Built Query</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
