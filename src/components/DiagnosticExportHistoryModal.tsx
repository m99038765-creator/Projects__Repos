import React, { useState } from 'react';
import { X, FileText, Download, Share2, Trash2, Clock, Check, Search, AlertCircle, Database } from 'lucide-react';

export interface DiagnosticPdfHistoryItem {
  id: string;
  title: string;
  timestamp: number;
  timeFormatted: string;
  recordCount: number;
  executionTimeMs: number;
  fileSizeKB: number;
  summary: string;
}

interface DiagnosticExportHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  historyItems: DiagnosticPdfHistoryItem[];
  onReDownload: (item: DiagnosticPdfHistoryItem) => void;
  onClearHistory: () => void;
  onDeleteItem: (id: string) => void;
}

export const DiagnosticExportHistoryModal: React.FC<DiagnosticExportHistoryModalProps> = ({
  isOpen,
  onClose,
  historyItems,
  onReDownload,
  onClearHistory,
  onDeleteItem
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredItems = historyItems.filter((item) =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.timeFormatted.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleShareLink = (item: DiagnosticPdfHistoryItem) => {
    const shareText = `Diagnostic Report: ${item.title} (${item.timeFormatted}) - Latency: ${item.executionTimeMs.toFixed(1)}ms, Records: ${item.recordCount}`;
    navigator.clipboard.writeText(shareText);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      id="diagnostic-export-history-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-zinc-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="diagnostic-export-history-modal"
        className="bg-zinc-900 border border-zinc-700/80 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800 bg-zinc-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 rounded-2xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white tracking-wide">Diagnostic Export History</h2>
              <p className="text-xs text-zinc-400 font-mono">Previously generated PDF correlation and performance reports</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {historyItems.length > 0 && (
              <button
                type="button"
                onClick={onClearHistory}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-rose-950/60 text-zinc-300 hover:text-rose-300 border border-zinc-700 hover:border-rose-500/50 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                title="Clear export history"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear History</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="px-6 py-4 bg-zinc-950/50 border-b border-zinc-800 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search reports by title, summary, or timestamp..."
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-indigo-500 text-white placeholder-zinc-500 text-xs rounded-xl pl-10 pr-4 py-2.5 outline-none transition-all font-mono"
            />
          </div>
          <div className="text-xs font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-2.5 rounded-xl shrink-0">
            {filteredItems.length} {filteredItems.length === 1 ? 'report' : 'reports'} found
          </div>
        </div>

        {/* Content List */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {filteredItems.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 bg-zinc-800/60 rounded-2xl flex items-center justify-center mx-auto text-zinc-500">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="text-sm font-bold text-zinc-300">No diagnostic reports found</div>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto font-mono">
                {historyItems.length === 0
                  ? 'Generate a diagnostic PDF report from the metrics banner or header to store it in your export history.'
                  : 'No reports match your current search query.'}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className="bg-zinc-950/60 border border-zinc-800 hover:border-indigo-500/50 rounded-2xl p-4 sm:p-5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-sm font-extrabold text-white group-hover:text-indigo-300 transition-colors">
                      {item.title}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                      {item.fileSizeKB} KB PDF
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed font-mono">
                    {item.summary}
                  </p>
                  <div className="flex items-center gap-3 pt-1 text-[11px] font-mono text-zinc-500 flex-wrap">
                    <span className="flex items-center gap-1 text-zinc-400">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      {item.timeFormatted}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Database className="w-3.5 h-3.5 text-emerald-400" />
                      {item.recordCount.toLocaleString()} records
                    </span>
                    <span>•</span>
                    <span className="text-amber-300">
                      Latency: {item.executionTimeMs.toFixed(1)}ms
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleShareLink(item)}
                    className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/80 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                    title="Copy report summary link / share details"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Copied</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Share</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onReDownload(item)}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs rounded-xl shadow-lg cursor-pointer transition-all flex items-center gap-1.5 border border-indigo-400/30 hover:scale-105 active:scale-95"
                    title="Re-download PDF report instantly without re-generating"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Re-download</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteItem(item.id)}
                    className="p-2 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                    title="Delete from history"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-950/80 border-t border-zinc-800 flex items-center justify-between text-xs font-mono text-zinc-500">
          <div>Storage: {historyItems.length} reports archived in session state</div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
