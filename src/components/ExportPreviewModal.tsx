import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  FileCode,
  Download,
  Copy,
  Check,
  CheckCircle2,
  Table as TableIcon,
  Code2,
  Sliders,
  Sparkles,
  Info
} from 'lucide-react';
import { TransactionRecord } from '../types';
import { ExportFormat, buildCsvString } from '../utils/csvExporter';

export interface ExportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: TransactionRecord[];
  initialFormat?: ExportFormat;
  includeHeaders?: boolean;
  onConfirmExport: (format: ExportFormat, options: { includeHeaders: boolean; pretty: boolean }) => void;
  isExporting?: boolean;
  filenamePrefix?: string;
}

export const ExportPreviewModal: React.FC<ExportPreviewModalProps> = ({
  isOpen,
  onClose,
  records,
  initialFormat = 'csv',
  includeHeaders = true,
  onConfirmExport,
  isExporting = false,
  filenamePrefix = 'filtered_transactions'
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(initialFormat);
  const [activeIncludeHeaders, setActiveIncludeHeaders] = useState<boolean>(includeHeaders);
  const [prettyJson, setPrettyJson] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'table' | 'raw'>('table');
  const [hasCopied, setHasCopied] = useState<boolean>(false);

  // Sync format when initialFormat changes
  useEffect(() => {
    setSelectedFormat(initialFormat);
  }, [initialFormat]);

  useEffect(() => {
    setActiveIncludeHeaders(includeHeaders);
  }, [includeHeaders]);

  // First 5 rows of data for preview
  const previewRows = useMemo(() => {
    return records.slice(0, 5);
  }, [records]);

  // Generate serialized preview text for first 5 rows
  const serializedPreview = useMemo(() => {
    if (previewRows.length === 0) return '';
    if (selectedFormat === 'csv') {
      const { csvString } = buildCsvString(previewRows, { includeHeaders: activeIncludeHeaders });
      return csvString.replace(/^\uFEFF/, ''); // strip BOM for display
    } else {
      return JSON.stringify(previewRows, null, prettyJson ? 2 : 0);
    }
  }, [previewRows, selectedFormat, activeIncludeHeaders, prettyJson]);

  // Estimated full file size calculations
  const estimatedSize = useMemo(() => {
    if (records.length === 0) return '0 B';
    const sampleBytes = new Blob([serializedPreview]).size;
    const bytesPerRow = previewRows.length > 0 ? sampleBytes / previewRows.length : 120;
    const totalBytes = bytesPerRow * records.length;
    if (totalBytes < 1024) return `${Math.round(totalBytes)} B`;
    if (totalBytes < 1024 * 1024) return `${(totalBytes / 1024).toFixed(1)} KB`;
    return `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
  }, [records.length, serializedPreview, previewRows.length]);

  // Copy serialized preview to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(serializedPreview);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy preview:', err);
    }
  };

  // Keyboard shortcut: Escape to close, Ctrl+Enter / Enter to confirm
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onConfirmExport(selectedFormat, {
          includeHeaders: activeIncludeHeaders,
          pretty: prettyJson
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onConfirmExport, selectedFormat, activeIncludeHeaders, prettyJson]);

  if (!isOpen) return null;

  return (
    <div
      id="modal-export-preview"
      data-testid="modal-export-preview"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-export-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn select-none"
    >
      <div
        className="w-full max-w-4xl bg-zinc-950 border border-zinc-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-zinc-100 ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${
              selectedFormat === 'csv'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}>
              {selectedFormat === 'csv' ? (
                <FileSpreadsheet className="w-5 h-5" />
              ) : (
                <FileCode className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="modal-export-preview-title" className="text-base font-bold text-white tracking-tight">
                  Pre-Export Data Preview
                </h2>
                <span className="font-mono text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded border border-zinc-700 font-semibold">
                  First 5 Rows
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Inspect sample data, column schemas, and formatting before committing to the full download.
              </p>
            </div>
          </div>

          <button
            type="button"
            id="btn-close-export-preview"
            data-testid="btn-close-export-preview"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 rounded-lg transition-colors cursor-pointer"
            title="Close preview (Esc)"
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="px-5 py-3 border-b border-zinc-800/80 bg-zinc-900/30 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* Format Selector Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-zinc-900 rounded-lg border border-zinc-800">
            <button
              type="button"
              id="btn-preview-format-csv"
              data-testid="btn-preview-format-csv"
              onClick={() => setSelectedFormat('csv')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-colors cursor-pointer ${
                selectedFormat === 'csv'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>CSV Format</span>
            </button>
            <button
              type="button"
              id="btn-preview-format-json"
              data-testid="btn-preview-format-json"
              onClick={() => setSelectedFormat('json')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-colors cursor-pointer ${
                selectedFormat === 'json'
                  ? 'bg-amber-600 text-white font-bold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>JSON Format</span>
            </button>
          </div>

          {/* Format-specific toggles */}
          <div className="flex items-center gap-4 text-xs text-zinc-300">
            {selectedFormat === 'csv' ? (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="checkbox-preview-include-headers"
                  data-testid="checkbox-preview-include-headers"
                  checked={activeIncludeHeaders}
                  onChange={(e) => setActiveIncludeHeaders(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-emerald-500 accent-emerald-600 cursor-pointer"
                />
                <span>Include Column Headers in Row 1</span>
              </label>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="checkbox-preview-pretty-json"
                  data-testid="checkbox-preview-pretty-json"
                  checked={prettyJson}
                  onChange={(e) => setPrettyJson(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-amber-500 accent-amber-600 cursor-pointer"
                />
                <span>Pretty-print (2-space indent)</span>
              </label>
            )}

            {/* View Mode Toggle: Table Grid vs Raw Serialized */}
            <div className="flex items-center gap-1 p-0.5 bg-zinc-900 rounded-md border border-zinc-800">
              <button
                type="button"
                id="btn-view-mode-table"
                data-testid="btn-view-mode-table"
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-zinc-800 text-zinc-100 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="View structured table grid"
              >
                <TableIcon className="w-3 h-3" />
                <span>Grid</span>
              </button>
              <button
                type="button"
                id="btn-view-mode-raw"
                data-testid="btn-view-mode-raw"
                onClick={() => setViewMode('raw')}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                  viewMode === 'raw'
                    ? 'bg-zinc-800 text-zinc-100 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="View raw serialized text"
              >
                <Code2 className="w-3 h-3" />
                <span>Raw</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body: Scrollable Preview Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-5 bg-zinc-950">
          {previewRows.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-sm">
              No records available to export.
            </div>
          ) : viewMode === 'table' ? (
            /* Tabular Grid View of First 5 Rows */
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-xl border border-zinc-800 shadow-sm">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-900/90 text-zinc-400 font-mono text-[11px] uppercase tracking-wider border-b border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold text-center w-10">#</th>
                      <th className="py-2.5 px-3 font-semibold">Order Number</th>
                      <th className="py-2.5 px-3 font-semibold">Customer</th>
                      <th className="py-2.5 px-3 font-semibold">Category</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Amount</th>
                      <th className="py-2.5 px-3 font-semibold">Created Date</th>
                      <th className="py-2.5 px-3 font-semibold">Items</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-sans">
                    {previewRows.map((r, idx) => (
                      <tr key={r.id || idx} className="hover:bg-zinc-900/50 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-zinc-500 text-center text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-zinc-200">
                          {r.orderNumber}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-zinc-200">{r.customerName}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">{r.customerEmail}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-zinc-300">{r.category}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase ${
                            r.status === 'Completed'
                              ? 'text-emerald-400'
                              : r.status === 'Pending'
                              ? 'text-amber-400'
                              : r.status === 'Processing'
                              ? 'text-indigo-400'
                              : 'text-rose-400'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-100">
                          ${r.amount.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-400 font-mono text-[11px] whitespace-nowrap">
                          {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-400 text-[11px] max-w-xs truncate" title={
                          r.items?.map(it => `${it.sku} (x${it.quantity})`).join(', ') || `${r.itemCount} items`
                        }>
                          {r.items && r.items.length > 0 ? (
                            <span>{r.items.map(it => `${it.sku} (x${it.quantity})`).join(', ')}</span>
                          ) : (
                            <span className="font-mono">{r.itemCount} item(s)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Informational row banner */}
              <div className="flex items-center justify-between text-xs text-zinc-400 px-1 pt-1">
                <span className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Showing rows 1 through 5 of <strong>{records.length.toLocaleString()}</strong> total filtered rows.</span>
                </span>
                <span className="font-mono text-[11px] text-zinc-500">
                  Schema: Flat 2D {selectedFormat.toUpperCase()}
                </span>
              </div>
            </div>
          ) : (
            /* Raw Serialized Text View of First 5 Rows */
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-mono text-[11px]">
                  Output Preview ({selectedFormat.toUpperCase()} stream):
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Copy preview lines to clipboard"
                >
                  {hasCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-medium">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Sample</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-3.5 bg-zinc-900/90 border border-zinc-800 rounded-xl font-mono text-[11px] leading-relaxed text-zinc-300 overflow-x-auto max-h-72 select-text shadow-inner">
                {serializedPreview}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer / Action Bar */}
        <div className="px-5 py-4 border-t border-zinc-800 bg-zinc-900/70 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* Metadata chips (clean unboxed text per anti-slop guidelines) */}
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>Total: <strong className="text-zinc-200 font-mono">{records.length.toLocaleString()}</strong> rows</span>
            <span aria-hidden="true" className="text-zinc-600">·</span>
            <span>Est. Size: <strong className="text-zinc-200 font-mono">{estimatedSize}</strong></span>
            <span aria-hidden="true" className="text-zinc-600">·</span>
            <span>File: <strong className="text-zinc-200 font-mono">{filenamePrefix}.{selectedFormat}</strong></span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-cancel-export-preview"
              data-testid="btn-cancel-export-preview"
              onClick={onClose}
              disabled={isExporting}
              className="px-3.5 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800 font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            {/* Commit Full Export Button */}
            <button
              type="button"
              id="btn-confirm-export-download"
              data-testid="btn-confirm-export-download"
              onClick={() => onConfirmExport(selectedFormat, {
                includeHeaders: activeIncludeHeaders,
                pretty: prettyJson
              })}
              disabled={isExporting || records.length === 0}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-extrabold text-xs shadow-lg transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                selectedFormat === 'csv'
                  ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/60 border border-emerald-400/40'
                  : 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-500 hover:to-orange-500 text-white shadow-amber-950/60 border border-amber-400/40'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Download className="w-4 h-4" />
              <span>
                {isExporting
                  ? 'Exporting Data...'
                  : `Download Full ${selectedFormat.toUpperCase()} (${records.length.toLocaleString()} rows)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ExportPreviewModal;
