import React, { useState, useMemo, useEffect, useRef } from 'react';
import { OptimizationFlags, OrderStatus, ProductCategory, LatencyTrendPoint, BulkImportResult, SerializationLogEntry, LowUsageThresholdsConfig, DEFAULT_LOW_USAGE_THRESHOLDS } from './types';
import { executeQuery, initializeDatabase, getDatabaseStats, getPlanCacheTTLSeconds, setPlanCacheTTLSeconds, clearDatabaseCache } from './db/databaseEngine';
import { useFpsMonitor } from './utils/fpsTracker';
import { Header } from './components/Header';
import { OptimizationControls } from './components/OptimizationControls';
import { MetricsBar } from './components/MetricsBar';
import { VirtualizedTable } from './components/VirtualizedTable';
import { ExplainPlanViewer } from './components/ExplainPlanViewer';
import { BenchmarkModal } from './components/BenchmarkModal';
import { PerformanceTrendsView } from './components/PerformanceTrendsView';
import { BulkImportModal } from './components/BulkImportModal';
import { DiagnosticPdfPreviewModal } from './components/DiagnosticPdfPreviewModal';
import { DiagnosticExportHistoryModal, DiagnosticPdfHistoryItem } from './components/DiagnosticExportHistoryModal';
import { HistoricalDataTapeModal } from './components/HistoricalDataTapeModal';
import { SerializationErrorLogPanel } from './components/SerializationErrorLogPanel';
import { SystemResourceMonitor } from './components/SystemResourceMonitor';
import { LatencyComparisonView } from './components/LatencyComparisonView';
import { DatabaseSchemaExplorerView } from './components/DatabaseSchemaExplorerView';
import { OptimizationWizardModal } from './components/OptimizationWizardModal';
import { DatabaseBottleneckHeatmapDrawer } from './components/DatabaseBottleneckHeatmapDrawer';
import { VisualQueryBuilderModal } from './components/VisualQueryBuilderModal';
import { LatencyLegend } from './components/LatencyLegend';
import { HeatmapIntensityScale } from './components/HeatmapIntensityScale';
import { ExportPreviewModal } from './components/ExportPreviewModal';
import { AlertTriangle, X, Flame, Zap, BellOff, TrendingUp, FileText, Loader, Sparkles, Search, Clipboard, Pin, RotateCcw, FileSpreadsheet, Camera, FileJson, Brain, Layers, Sliders, Settings, Info } from 'lucide-react';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import {
  exportRecords,
  exportRecordsToCsv,
  triggerFileDownload,
  ExportFormat,
  ExportPerformanceResult,
  ExportHistoryPoint,
  generateInitialExportHistory
} from './utils/csvExporter';
import {
  exportDiagnosticCorrelationPdf,
  DiagnosticPdfSectionId,
  DiagnosticPdfSectionsConfig,
  DiagnosticPdfSectionGroup,
  DEFAULT_PDF_SECTION_ORDER
} from './utils/diagnosticCorrelationPdfGenerator';
import {
  DatabaseMutationHistoryEntry,
  DataTapeEntry,
  ExtendedAlertThresholdsConfig,
  DEFAULT_EXTENDED_ALERT_THRESHOLDS
} from './types';
import {
  getDatabaseMutationHistory
} from './db/databaseEngine';
import {
  getInitialDataTapeEntries,
  createDataTapeEntry
} from './utils/auditDataTape';
import {
  getInitialSerializationLogs
} from './utils/serializationLogger';
import { getInitialTrendHistory } from './utils/initialTrendHistory';

export const DEFAULT_PDF_SECTION_GROUPS: DiagnosticPdfSectionGroup[] = [
  { id: 'group_metrics', title: 'Metrics Domain Group', sectionIds: ['sparklines'], isCollapsed: false },
  { id: 'group_logs', title: 'Logs Domain Group', sectionIds: ['mutationHistory'], isCollapsed: false },
  { id: 'group_strategy', title: 'Strategy Domain Group', sectionIds: ['recommendations'], isCollapsed: false },
  { id: 'group_summary', title: 'Summary Domain Group', sectionIds: ['executiveSummary'], isCollapsed: false }
];

export const PDF_SECTION_CONFIG_ITEMS: Record<
  DiagnosticPdfSectionId,
  {
    id: DiagnosticPdfSectionId;
    title: string;
    tag: string;
    badge: string;
    badgeClass: string;
    description: string;
    includeKey: 'includeSparklines' | 'includeMutationHistory' | 'includeRecommendations' | 'includeExecutiveSummary';
    breakKey: 'breakBeforeSparklines' | 'breakBeforeMutationHistory' | 'breakBeforeRecommendations' | 'breakBeforeExecutiveSummary';
    noteKey: 'sparklinesNote' | 'mutationHistoryNote' | 'recommendationsNote' | 'executiveSummaryNote';
    metadataKey: 'includeMetadataSparklines' | 'includeMetadataMutationHistory' | 'includeMetadataRecommendations' | 'includeMetadataExecutiveSummary';
    paddingKey: 'paddingSparklines' | 'paddingMutationHistory' | 'paddingRecommendations' | 'paddingExecutiveSummary';
    delimiterKey: 'sparklinesDelimiter' | 'mutationHistoryDelimiter' | 'recommendationsDelimiter' | 'executiveSummaryDelimiter';
    filenamePrefixKey: 'sparklinesFilenamePrefix' | 'mutationHistoryFilenamePrefix' | 'recommendationsFilenamePrefix' | 'executiveSummaryFilenamePrefix';
    showDividerKey: 'showDividerSparklines' | 'showDividerMutationHistory' | 'showDividerRecommendations' | 'showDividerExecutiveSummary';
    dividerColorKey: 'dividerColorSparklines' | 'dividerColorMutationHistory' | 'dividerColorRecommendations' | 'dividerColorExecutiveSummary';
    dividerStyleKey: 'dividerStyleSparklines' | 'dividerStyleMutationHistory' | 'dividerStyleRecommendations' | 'dividerStyleExecutiveSummary';
    dividerThicknessKey: 'dividerThicknessSparklines' | 'dividerThicknessMutationHistory' | 'dividerThicknessRecommendations' | 'dividerThicknessExecutiveSummary';
    barColor: string;
    inputDividerStyleId: string;
  }
> = {
  sparklines: {
    id: 'sparklines',
    title: 'Visual Latency & Write Frequency',
    tag: 'Metrics',
    badge: '50Hz Telemetry',
    badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    description: 'Dual-panel 50Hz timeseries tracking latency response and write mutation velocity against SLA thresholds.',
    includeKey: 'includeSparklines',
    breakKey: 'breakBeforeSparklines',
    noteKey: 'sparklinesNote',
    metadataKey: 'includeMetadataSparklines',
    paddingKey: 'paddingSparklines',
    delimiterKey: 'sparklinesDelimiter',
    filenamePrefixKey: 'sparklinesFilenamePrefix',
    showDividerKey: 'showDividerSparklines',
    dividerColorKey: 'dividerColorSparklines',
    dividerStyleKey: 'dividerStyleSparklines',
    dividerThicknessKey: 'dividerThicknessSparklines',
    barColor: 'bg-cyan-500',
    inputDividerStyleId: 'select-divider-style-sparklines'
  },
  mutationHistory: {
    id: 'mutationHistory',
    title: 'Chronological Audit Chain',
    tag: 'Logs',
    badge: 'WAL Audit Log',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    description: 'Tabular audit log of database write clusters, lock acquisition times, and chronological root-cause sequence of events.',
    includeKey: 'includeMutationHistory',
    breakKey: 'breakBeforeMutationHistory',
    noteKey: 'mutationHistoryNote',
    metadataKey: 'includeMetadataMutationHistory',
    paddingKey: 'paddingMutationHistory',
    delimiterKey: 'mutationHistoryDelimiter',
    filenamePrefixKey: 'mutationHistoryFilenamePrefix',
    showDividerKey: 'showDividerMutationHistory',
    dividerColorKey: 'dividerColorMutationHistory',
    dividerStyleKey: 'dividerStyleMutationHistory',
    dividerThicknessKey: 'dividerThicknessMutationHistory',
    barColor: 'bg-amber-500',
    inputDividerStyleId: 'select-divider-style-mutationHistory'
  },
  recommendations: {
    id: 'recommendations',
    title: 'Engineering Remediation Plan',
    tag: 'Strategy',
    badge: 'Heuristic Rules',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    description: 'Automated heuristic directives generated by diagnostic analyzer rules to resolve lock contention hotspots and database latency bottlenecks.',
    includeKey: 'includeRecommendations',
    breakKey: 'breakBeforeRecommendations',
    noteKey: 'recommendationsNote',
    metadataKey: 'includeMetadataRecommendations',
    paddingKey: 'paddingRecommendations',
    delimiterKey: 'recommendationsDelimiter',
    filenamePrefixKey: 'recommendationsFilenamePrefix',
    showDividerKey: 'showDividerRecommendations',
    dividerColorKey: 'dividerColorRecommendations',
    dividerStyleKey: 'dividerStyleRecommendations',
    dividerThicknessKey: 'dividerThicknessRecommendations',
    barColor: 'bg-emerald-500',
    inputDividerStyleId: 'select-divider-style-recommendations'
  },
  executiveSummary: {
    id: 'executiveSummary',
    title: 'Executive Summary Briefing',
    tag: 'Summary',
    badge: 'Stakeholder View',
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    description: 'High-level management briefing translating low-level table mutex locks into clear business risk and performance impact narratives.',
    includeKey: 'includeExecutiveSummary',
    breakKey: 'breakBeforeExecutiveSummary',
    noteKey: 'executiveSummaryNote',
    metadataKey: 'includeMetadataExecutiveSummary',
    paddingKey: 'paddingExecutiveSummary',
    delimiterKey: 'executiveSummaryDelimiter',
    filenamePrefixKey: 'executiveSummaryFilenamePrefix',
    showDividerKey: 'showDividerExecutiveSummary',
    dividerColorKey: 'dividerColorExecutiveSummary',
    dividerStyleKey: 'dividerStyleExecutiveSummary',
    dividerThicknessKey: 'dividerThicknessExecutiveSummary',
    barColor: 'bg-rose-500',
    inputDividerStyleId: 'select-divider-style-executiveSummary'
  }
};

export default function App() {
  // Initialize database on mount
  useEffect(() => {
    initializeDatabase();
  }, []);

  const [flags, setFlags] = useState<OptimizationFlags>({
    batchEagerLoading: true,
    btreeIndexing: true,
    queryCaching: true,
    virtualizedDOM: true,
    deferredRendering: true,
  });

  const [lowUsageThresholds, setLowUsageThresholds] = useState<LowUsageThresholdsConfig>(() => {
    try {
      const saved = localStorage.getItem('enterprise_low_usage_thresholds');
      return saved ? JSON.parse(saved) : DEFAULT_LOW_USAGE_THRESHOLDS;
    } catch {
      return DEFAULT_LOW_USAGE_THRESHOLDS;
    }
  });

  const handleLowUsageThresholdsChange = (config: LowUsageThresholdsConfig) => {
    setLowUsageThresholds(config);
    try {
      localStorage.setItem('enterprise_low_usage_thresholds', JSON.stringify(config));
    } catch (e) {
      console.error(e);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'All'>('All');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(100);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [alertThresholdMs, setAlertThresholdMs] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('enterprise_latency_alert_threshold_ms');
      return saved ? Number(saved) : 100;
    } catch {
      return 100;
    }
  });

  const handleAlertThresholdChange = (val: number) => {
    const clamped = Math.max(10, Math.min(1000, Math.round(val)));
    setAlertThresholdMs(clamped);
    try {
      localStorage.setItem('enterprise_latency_alert_threshold_ms', clamped.toString());
    } catch (e) {
      console.error(e);
    }
  };

  const [extendedAlertThresholds, setExtendedAlertThresholds] = useState<ExtendedAlertThresholdsConfig>(() => {
    try {
      const saved = localStorage.getItem('enterprise_extended_alert_thresholds');
      return saved ? JSON.parse(saved) : DEFAULT_EXTENDED_ALERT_THRESHOLDS;
    } catch {
      return DEFAULT_EXTENDED_ALERT_THRESHOLDS;
    }
  });

  const handleExtendedAlertThresholdsChange = (config: ExtendedAlertThresholdsConfig) => {
    setExtendedAlertThresholds(config);
    try {
      localStorage.setItem('enterprise_extended_alert_thresholds', JSON.stringify(config));
    } catch (e) {
      console.error(e);
    }
    if (config.latencyAlertMs !== alertThresholdMs) {
      handleAlertThresholdChange(config.latencyAlertMs);
    }
  };
  const [performanceBudgetMs, setPerformanceBudgetMs] = useState<number>(200);
  const [showLatencyHeatmap, setShowLatencyHeatmap] = useState(true);
  const [showQueryIntensityOverlay, setShowQueryIntensityOverlay] = useState<boolean>(false);
  const [showN1CascadeOverlay, setShowN1CascadeOverlay] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isVisualQueryBuilderOpen, setIsVisualQueryBuilderOpen] = useState(false);
  const [showPdfQueueToast, setShowPdfQueueToast] = useState(false);
  const [pdfErrorToast, setPdfErrorToast] = useState<string | null>(null);
  const [isAutoResolveOnSpikeEnabled, setIsAutoResolveOnSpikeEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('enterprise_auto_resolve_spike') === 'true';
    } catch {
      return false;
    }
  });

  const [isRevertOnStableEnabled, setIsRevertOnStableEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('enterprise_revert_on_stable_enabled') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleAutoResolveSpike = (enabled: boolean) => {
    setIsAutoResolveOnSpikeEnabled(enabled);
    try {
      localStorage.setItem('enterprise_auto_resolve_spike', String(enabled));
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleRevertOnStable = (enabled: boolean) => {
    setIsRevertOnStableEnabled(enabled);
    try {
      localStorage.setItem('enterprise_revert_on_stable_enabled', String(enabled));
    } catch {}
    setProactiveToast({
      title: enabled ? '⚡ Revert on Stable Enabled' : 'Revert on Stable Disabled',
      message: enabled ? 'Quick Fix will automatically revert if latency stays below 100ms for 2 minutes.' : 'Automatic revert disabled.',
      flagToEnable: 'batchEagerLoading',
      flagName: 'Batch Eager Loading'
    });
  };

  const handleExportPdfClick = async () => {
    try {
      setIsGeneratingDiagnosticPdf(true);
      setShowPdfQueueToast(true);
      setShowPdfPreviewModal(true);
      await Promise.resolve();
      setTimeout(() => {
        setShowPdfQueueToast(false);
        setIsGeneratingDiagnosticPdf(false);
        setIsPdfGenerationSuccess(true);
        setTimeout(() => {
          setIsPdfGenerationSuccess(false);
        }, 1000);
      }, 2500);
    } catch (err: any) {
      setIsGeneratingDiagnosticPdf(false);
      setShowPdfQueueToast(false);
      setShowPdfPreviewModal(false);
      setPdfErrorToast(err?.message || 'Diagnostic report generation failed. Please try again.');
      setTimeout(() => {
        setPdfErrorToast(null);
      }, 4000);
    }
  };

  const handleCancelPdfGeneration = () => {
    setIsGeneratingDiagnosticPdf(false);
    setShowPdfQueueToast(false);
    setShowPdfPreviewModal(false);
    setPdfErrorToast('PDF diagnostic report generation cancelled.');
    setTimeout(() => setPdfErrorToast(null), 3000);
  };

  const [previousFlagsBeforeQuickFix, setPreviousFlagsBeforeQuickFix] = useState<OptimizationFlags | null>(null);
  const [hasQuickFixBeenApplied, setHasQuickFixBeenApplied] = useState(false);

  const handleQuickFixAll = () => {
    setPreviousFlagsBeforeQuickFix({ ...flags });
    setFlags({
      batchEagerLoading: true,
      btreeIndexing: true,
      queryCaching: true,
      virtualizedDOM: true,
      deferredRendering: true
    });
    setHasQuickFixBeenApplied(true);
    setIsBatchBannerDismissed(true);
    setProactiveToast({
      title: '⚡ Quick Fix All Applied',
      message: 'All optimization flags have been enabled simultaneously to resolve workload bottlenecks.',
      flagToEnable: 'batchEagerLoading',
      flagName: 'Batch Eager Loading'
    });
  };

  const handleQuickRevert = () => {
    if (previousFlagsBeforeQuickFix) {
      setFlags(previousFlagsBeforeQuickFix);
    } else {
      setFlags({
        batchEagerLoading: false,
        btreeIndexing: false,
        queryCaching: false,
        virtualizedDOM: false,
        deferredRendering: false
      });
    }
    setHasQuickFixBeenApplied(false);
    setIsBatchBannerDismissed(false);
    setProactiveToast({
      title: '↩️ Quick Revert Executed',
      message: 'Optimization flags have been reverted to their pre-fix state.',
      flagToEnable: 'batchEagerLoading',
      flagName: 'Batch Eager Loading'
    });
  };

  const handleFixAndDismiss = () => {
    handleQuickFixAll();
    setIsBatchBannerDismissed(true);
  };

  const handleExplainPlanBannerClick = () => {
    setActiveView('grid');
    setStatusFilter('slow');
    setProactiveToast({
      title: '🔍 Explain Plan: High-Latency Bottleneck',
      message: 'Explain Plan viewer filtered to sequential table scan and N+1 cascade execution nodes.',
      flagToEnable: 'batchEagerLoading',
      flagName: 'Batch Eager Loading'
    });
    setTimeout(() => {
      const el = document.getElementById('explain-plan-viewer-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const [showCopyLogsToast, setShowCopyLogsToast] = useState(false);
  const [isCopyingLogs, setIsCopyingLogs] = useState(false);
  const [copyProgressPercent, setCopyProgressPercent] = useState<number>(0);

  const handleCopyLogsToClipboard = () => {
    try {
      setIsCopyingLogs(true);
      setCopyProgressPercent(15);
      const logData = JSON.stringify({
        timestamp: new Date().toISOString(),
        executionTimeMs: queryResult.executionTimeMs,
        flags,
        explainPlanSummary: queryResult.explainPlan?.summary || 'N+1 cascade detected',
        totalCount: queryResult.totalCount,
        queryType: queryResult.queryType || 'SELECT'
      }, null, 2);

      setTimeout(() => setCopyProgressPercent(60), 200);
      setTimeout(() => {
        setCopyProgressPercent(100);
        navigator.clipboard.writeText(logData);
        setShowCopyLogsToast(true);
      }, 450);

      setTimeout(() => {
        setShowCopyLogsToast(false);
        setIsCopyingLogs(false);
        setCopyProgressPercent(0);
      }, 1500);
    } catch (e) {
      setIsCopyingLogs(false);
      setCopyProgressPercent(0);
      console.error(e);
    }
  };

  const handleExportDiagnosticsCsv = () => {
    try {
      const headers = ['Metric / Property', 'Value'];
      const rows: string[][] = [
        ['Export Timestamp', new Date().toISOString()]
      ];

      if (selectedCsvMetrics.includes('latency')) {
        rows.push(['Execution Time (ms)', queryResult.executionTimeMs.toFixed(2)]);
      }
      if (selectedCsvMetrics.includes('totalRecords')) {
        rows.push(['Total Records Scanned', String(queryResult.totalCount || 0)]);
      }
      if (selectedCsvMetrics.includes('cacheHit')) {
        rows.push(['Cache Hit Status', String(queryResult.cacheHit)]);
      }
      if (selectedCsvMetrics.includes('queryCount')) {
        rows.push(['N+1 Cascaded Query Count', String(queryResult.activeQueries || 101)]);
      }
      if (selectedCsvMetrics.includes('errorStatus')) {
        rows.push(['System Error Status', String(queryResult.simulatedError || 'None')]);
      }
      if (selectedCsvMetrics.includes('flags')) {
        rows.push(['Flag: batchEagerLoading', String(flags.batchEagerLoading)]);
        rows.push(['Flag: btreeIndexing', String(flags.btreeIndexing)]);
        rows.push(['Flag: queryCaching', String(flags.queryCaching)]);
        rows.push(['Flag: virtualizedDOM', String(flags.virtualizedDOM)]);
        rows.push(['Flag: deferredRendering', String(flags.deferredRendering)]);
      }

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      triggerFileDownload(blob, `system_diagnostics_metrics_${Date.now()}.csv`);
      setProactiveToast({
        title: 'Diagnostics CSV Exported',
        message: `Exported ${rows.length - 1} configured metric fields to CSV successfully.`
      });
      setTimeout(() => setProactiveToast(null), 4000);
    } catch (err) {
      console.error('Failed to export diagnostics CSV:', err);
    }
  };

  const handleExportSerializationLogsCsv = () => {
    if (!serializationLogs || serializationLogs.length === 0) {
      setPdfErrorToast('No serialization logs available to export.');
      setTimeout(() => setPdfErrorToast(null), 3000);
      return;
    }
    const headers = ['ID', 'Timestamp', 'Level', 'Component', 'Message', 'Details'];
    const rows = serializationLogs.map(l => [
      l.id,
      new Date(l.timestamp).toISOString(),
      l.level,
      l.component,
      `"${l.message.replace(/"/g, '""')}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `serialization-logs-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setProactiveToast({
      title: '📊 Serialization Logs Exported',
      message: `Successfully exported ${serializationLogs.length} serialization logs to CSV.`,
      flagToEnable: 'batchEagerLoading',
      flagName: 'Batch Eager Loading'
    });
    setTimeout(() => setProactiveToast(null), 4000);
  };

  // Plan Cache TTL state (in seconds)
  const [cacheTtlSeconds, setCacheTtlSeconds] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('enterprise_plan_cache_ttl');
      return saved ? Number(saved) : getPlanCacheTTLSeconds();
    } catch {
      return 60;
    }
  });

  const handleCacheTtlChange = (newTtl: number) => {
    setCacheTtlSeconds(newTtl);
    setPlanCacheTTLSeconds(newTtl);
    setRefreshKey((k) => k + 1);
  };

  const handlePurgePlanCache = () => {
    clearDatabaseCache('User Purged Plan Cache');
    setRefreshKey((k) => k + 1);
  };

  const [isLiveMetricsEnabled, setIsLiveMetricsEnabled] = useState(true);
  const [liveMetricsInterval, setLiveMetricsInterval] = useState<'1s' | '5s'>('1s');

  useEffect(() => {
    if (!autoRefreshEnabled && !isLiveMetricsEnabled) return;
    const intervalMs = isLiveMetricsEnabled ? (liveMetricsInterval === '1s' ? 1000 : 5000) : 3000;
    const interval = setInterval(() => {
      setRefreshKey((k) => k + 1);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [autoRefreshEnabled, isLiveMetricsEnabled, liveMetricsInterval]);

  const queryResult = useMemo(() => {
    const _tick = refreshKey;
    return executeQuery({
      searchTerm: searchQuery,
      category: selectedCategory,
      status: statusFilter,
      page,
      pageSize
    }, flags);
  }, [flags, searchQuery, selectedCategory, statusFilter, page, pageSize, refreshKey]);

  const dbStats = useMemo(() => getDatabaseStats(), [queryResult]);
  const fps = useFpsMonitor();

  // Modals state
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState(false);
  const [isPerformanceTrendsOpen, setIsPerformanceTrendsOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isHistoricalDataTapeOpen, setIsHistoricalDataTapeOpen] = useState(false);
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);
  const [isOptimizationWizardOpen, setIsOptimizationWizardOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isBottleneckDrawerOpen, setIsBottleneckDrawerOpen] = useState(false);
  const [shortcutToast, setShortcutToast] = useState<{
    action: string;
    flagName: string;
    enabled: boolean;
    combo: string;
  } | null>(null);

  // PDF Export Sections config
  const [pdfExportSections, setPdfExportSections] = useState<DiagnosticPdfSectionsConfig>(() => ({
    includePageNumbers: true,
    includeSparklines: true,
    includeMutationHistory: true,
    includeRecommendations: true,
    includeExecutiveSummary: true,
    breakBeforeSparklines: false,
    breakBeforeMutationHistory: true,
    breakBeforeRecommendations: true,
    breakBeforeExecutiveSummary: false,
    sparklinesNote: '',
    mutationHistoryNote: '',
    recommendationsNote: '',
    executiveSummaryNote: '',
    includeMetadataSparklines: true,
    includeMetadataMutationHistory: true,
    includeMetadataRecommendations: true,
    includeMetadataExecutiveSummary: true,
    paddingSparklines: 10,
    paddingMutationHistory: 10,
    paddingRecommendations: 10,
    paddingExecutiveSummary: 10,
    sparklinesDelimiter: ',',
    mutationHistoryDelimiter: ',',
    recommendationsDelimiter: ',',
    executiveSummaryDelimiter: ',',
    sparklinesFilenamePrefix: '',
    mutationHistoryFilenamePrefix: '',
    recommendationsFilenamePrefix: '',
    executiveSummaryFilenamePrefix: '',
    showDividerSparklines: true,
    showDividerMutationHistory: true,
    showDividerRecommendations: true,
    showDividerExecutiveSummary: true,
    dividerColor: '#cbd5e1',
    dividerColorSparklines: '#cbd5e1',
    dividerColorMutationHistory: '#cbd5e1',
    dividerColorRecommendations: '#cbd5e1',
    dividerColorExecutiveSummary: '#cbd5e1',
    dividerStyle: 'solid',
    dividerStyleSparklines: 'solid',
    dividerStyleMutationHistory: 'solid',
    dividerStyleRecommendations: 'solid',
    dividerStyleExecutiveSummary: 'solid',
    dividerThickness: 1.5,
    dividerThicknessSparklines: 1.5,
    dividerThicknessMutationHistory: 1.5,
    dividerThicknessRecommendations: 1.5,
    dividerThicknessExecutiveSummary: 1.5,
    sectionOrder: [...DEFAULT_PDF_SECTION_ORDER],
    sectionGroups: DEFAULT_PDF_SECTION_GROUPS.map((g) => ({ ...g }))
  }));

  const [isGeneratingDiagnosticPdf, setIsGeneratingDiagnosticPdf] = useState(false);
  const [isPdfGenerationSuccess, setIsPdfGenerationSuccess] = useState(false);
  const [isDiagnosticPdfSuccess, setIsDiagnosticPdfSuccess] = useState(false);
  const [thresholdViolationsHistory] = useState<any[]>([]);
  const [mutationHistory] = useState<DatabaseMutationHistoryEntry[]>(() => getDatabaseMutationHistory());
  const [trendHistory, setTrendHistory] = useState<LatencyTrendPoint[]>(() => getInitialTrendHistory());
  const [historyTapeFilterMode, setHistoryTapeFilterMode] = useState<'all' | 'latency-5min'>('all');
  const [isSimulatingSequence, setIsSimulatingSequence] = useState(false);
  const [showExportLogHistoryPanel, setShowExportLogHistoryPanel] = useState(false);
  const [isExportHistoryModalOpen, setIsExportHistoryModalOpen] = useState(false);
  const [pdfExportHistory, setPdfExportHistory] = useState<DiagnosticPdfHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('enterprise_pdf_export_history');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'pdf-rep-init-1',
        title: 'Correlation Diagnostic Report (Baseline)',
        timestamp: Date.now() - 3600000,
        timeFormatted: new Date(Date.now() - 3600000).toLocaleTimeString(),
        recordCount: 25000,
        executionTimeMs: 215.4,
        fileSizeKB: 184,
        summary: 'Baseline performance audit report prior to N+1 optimization sequence.'
      }
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('enterprise_pdf_export_history', JSON.stringify(pdfExportHistory));
    } catch {}
  }, [pdfExportHistory]);

  const handleReDownloadHistoryItem = (item: DiagnosticPdfHistoryItem) => {
    handleGenerateDiagnosticCorrelationPdf();
    setProactiveToast({
      title: '📥 Re-downloading Report',
      message: `Fetching archived report "${item.title}" (${item.fileSizeKB} KB)...`,
      flagToEnable: 'batchEagerLoading',
      flagName: 'Batch Eager Loading'
    });
  };

  const handleClearPdfHistory = () => {
    setPdfExportHistory([]);
  };

  const handleDeletePdfHistoryItem = (id: string) => {
    setPdfExportHistory(prev => prev.filter(i => i.id !== id));
  };

  interface FlagToggleEventItem {
    id: string;
    timestamp: number;
    timeFormatted: string;
    flag: string;
    newState: boolean;
  }

  const [flagToggleEvents, setFlagToggleEvents] = useState<FlagToggleEventItem[]>(() => {
    try {
      const saved = localStorage.getItem('enterprise_flag_toggle_events');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('enterprise_flag_toggle_events', JSON.stringify(flagToggleEvents));
    } catch {}
  }, [flagToggleEvents]);

  const handleExportFlagToggleEventsJson = () => {
    if (!flagToggleEvents || flagToggleEvents.length === 0) {
      setPdfErrorToast('No optimization flag toggle events recorded in this session.');
      setTimeout(() => setPdfErrorToast(null), 3000);
      return;
    }
    const logData = JSON.stringify({
      sessionId: `session-${Date.now()}`,
      exportedAt: new Date().toISOString(),
      totalEvents: flagToggleEvents.length,
      events: flagToggleEvents
    }, null, 2);
    const blob = new Blob([logData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flag-toggle-events-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setProactiveToast({
      title: '📋 Flag Toggle Events Exported',
      message: `Successfully exported ${flagToggleEvents.length} optimization flag toggle events to JSON.`,
      flagToEnable: 'batchEagerLoading',
      flagName: 'Batch Eager Loading'
    });
  };
  const [selectedCsvMetrics, setSelectedCsvMetrics] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('enterprise_diagnostic_csv_columns');
      return saved ? JSON.parse(saved) : ['latency', 'flags', 'queryCount', 'errorStatus', 'totalRecords', 'cacheHit'];
    } catch {
      return ['latency', 'flags', 'queryCount', 'errorStatus', 'totalRecords', 'cacheHit'];
    }
  });
  const [isCsvColumnsModalOpen, setIsCsvColumnsModalOpen] = useState(false);
  const [isBannerPinned, setIsBannerPinned] = useState<boolean>(() => {
    try {
      return localStorage.getItem('enterprise_batch_banner_pinned') === 'true';
    } catch {
      return false;
    }
  });

  const [isCompareAgainstBaselineEnabled, setIsCompareAgainstBaselineEnabled] = useState<boolean>(false);
  const [initialBaselineLatency, setInitialBaselineLatency] = useState<number | null>(null);
  const [sparklineMetric, setSparklineMetric] = useState<'latency' | 'mutation'>('latency');
  const [isSparklineSettingsOpen, setIsSparklineSettingsOpen] = useState(false);
  const sparklineSettingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sparklineSettingsRef.current && !sparklineSettingsRef.current.contains(e.target as Node)) {
        setIsSparklineSettingsOpen(false);
      }
    }
    if (isSparklineSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isSparklineSettingsOpen]);

  useEffect(() => {
    if (!flags.batchEagerLoading && initialBaselineLatency === null) {
      setInitialBaselineLatency(queryResult.executionTimeMs);
    }
  }, [flags.batchEagerLoading, queryResult.executionTimeMs, initialBaselineLatency]);

  const handleResetSessionStatistics = () => {
    setTrendHistory([]);
    setInitialBaselineLatency(queryResult.executionTimeMs);
    setProactiveToast({
      title: '🔄 Session Statistics Reset',
      message: 'Current session trend history cleared and baseline latency recalibrated to current execution time.',
      flagToEnable: 'batchEagerLoading',
      flagName: 'Batch Eager Loading'
    });
    setTimeout(() => setProactiveToast(null), 4000);
  };

  const [customLatencyThreshold, setCustomLatencyThreshold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('enterprise_batch_banner_custom_threshold');
      return saved ? Number(saved) : 200;
    } catch {
      return 200;
    }
  });

  const [movingAverageTrendWindow, setMovingAverageTrendWindow] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('enterprise_moving_avg_trend_window');
      return saved ? Number(saved) : 10;
    } catch {
      return 10;
    }
  });

  const [anomalyThresholdSlope, setAnomalyThresholdSlope] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('enterprise_anomaly_threshold_slope');
      return saved ? Number(saved) : 1.5;
    } catch {
      return 1.5;
    }
  });

  const handleCustomThresholdChange = (val: number) => {
    setCustomLatencyThreshold(val);
    try {
      localStorage.setItem('enterprise_batch_banner_custom_threshold', String(val));
    } catch {}
  };

  const handleMovingAverageWindowChange = (val: number) => {
    setMovingAverageTrendWindow(val);
    try {
      localStorage.setItem('enterprise_moving_avg_trend_window', String(val));
    } catch {}
  };

  const handleAnomalySlopeChange = (val: number) => {
    setAnomalyThresholdSlope(val);
    try {
      localStorage.setItem('enterprise_anomaly_threshold_slope', String(val));
    } catch {}
  };

  const handleTogglePinBanner = () => {
    const next = !isBannerPinned;
    setIsBannerPinned(next);
    try {
      localStorage.setItem('enterprise_batch_banner_pinned', String(next));
    } catch {}
  };

  const handleViewRelatedHistory = () => {
    setHistoryTapeFilterMode('latency-5min');
    setIsHistoricalDataTapeOpen(true);
  };

  const handleViewSerializationLogs = () => {
    setActiveView('grid');
    setTimeout(() => {
      const problematicLog = (serializationLogs || []).find(l => 
        l.type.includes('N+1') || l.type.includes('LATENCY') || l.severity === 'error' || l.severity === 'anomaly'
      ) || (serializationLogs || [])[0];

      if (problematicLog) {
        const entryEl = document.getElementById(`serialization-log-entry-${problematicLog.id}`);
        if (entryEl) {
          entryEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          entryEl.classList.add('ring-4', 'ring-rose-500', 'bg-rose-100/90', 'transition-all', 'duration-700');
          setTimeout(() => {
            entryEl.classList.remove('ring-4', 'ring-rose-500', 'bg-rose-100/90');
          }, 2500);
          return;
        }
      }

      const el = document.getElementById('serialization-error-log-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  };
  const [isBatchBannerDismissed, setIsBatchBannerDismissed] = useState(false);
  const [showDismissConfirmation, setShowDismissConfirmation] = useState(false);
  const [dismissalDuration, setDismissalDuration] = useState<'5min' | '1hour'>(() => {
    try {
      const saved = localStorage.getItem('enterprise_batch_banner_dismissal_duration');
      return saved === '1hour' ? '1hour' : '5min';
    } catch {
      return '5min';
    }
  });
  const [batchBannerDismissedUntil, setBatchBannerDismissedUntil] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('enterprise_batch_banner_dismissed_until');
      return saved ? Number(saved) : 0;
    } catch {
      return 0;
    }
  });

  const handleConfirmDismiss = () => {
    const durationMs = dismissalDuration === '1hour' ? 60 * 60 * 1000 : 5 * 60 * 1000;
    const until = Date.now() + durationMs;
    setBatchBannerDismissedUntil(until);
    try {
      localStorage.setItem('enterprise_batch_banner_dismissed_until', String(until));
      localStorage.setItem('enterprise_batch_banner_dismissal_duration', dismissalDuration);
    } catch (e) {
      console.error(e);
    }
    setIsBatchBannerDismissed(true);
    setShowDismissConfirmation(false);
  };

  useEffect(() => {
    setIsBatchBannerDismissed(false);
  }, [flags.batchEagerLoading]);

  useEffect(() => {
    if (!isBatchBannerDismissed && !flags.batchEagerLoading && queryResult.executionTimeMs > customLatencyThreshold && isAutoResolveOnSpikeEnabled) {
      handleToggleFlag('batchEagerLoading');
      setIsBatchBannerDismissed(true);
      setProactiveToast({
        title: '⚡ Auto-Resolved on Spike',
        message: 'Latency threshold breached while Auto-Resolve on Spike was active. batchEagerLoading was automatically enabled.',
        flagToEnable: 'batchEagerLoading',
        flagName: 'Batch Eager Loading'
      });
    }
  }, [queryResult.executionTimeMs, flags.batchEagerLoading, isBatchBannerDismissed, isAutoResolveOnSpikeEnabled, customLatencyThreshold]);

  const handleToggleFlag = (key: keyof OptimizationFlags) => {
    setFlags((prev) => {
      const nextState = !prev[key];
      const nextFlags = { ...prev, [key]: nextState };

      const now = Date.now();
      const eventItem: FlagToggleEventItem = {
        id: `toggle-${now}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp: now,
        timeFormatted: new Date(now).toLocaleTimeString(),
        flag: String(key),
        newState: nextState
      };
      setFlagToggleEvents(t => [eventItem, ...t].slice(0, 100));

      const d = new Date(now);
      const timeFormatted = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;

      let baseLatency = 0.15;
      let rowsScanned = 100;
      let activeQueries = 1;
      let isCacheHit = false;
      let simulatedError: string | null = null;

      if (!nextFlags.batchEagerLoading) {
        baseLatency = 468.4 + Math.random() * 20;
        rowsScanned = 50000;
        activeQueries = 101;
        simulatedError = 'Database Connection Pool Timeout: max_connections (25) exceeded!';
      } else if (!nextFlags.btreeIndexing) {
        baseLatency = 49.2 + Math.random() * 6;
        rowsScanned = 50000;
      } else if (!nextFlags.virtualizedDOM) {
        baseLatency = 18.5 + Math.random() * 3;
      } else if (!nextFlags.deferredRendering) {
        baseLatency = 3.6 + Math.random() * 1.2;
      } else if (!nextFlags.queryCaching) {
        baseLatency = 1.42 + Math.random() * 0.3;
      } else {
        baseLatency = 0.15 + Math.random() * 0.06;
        isCacheHit = true;
      }

      setTrendHistory((h) => {
        const prevPoint = h[h.length - 1];
        const prevLatency = prevPoint ? prevPoint.executionTimeMs : 1.2;
        const delta = Number((baseLatency - prevLatency).toFixed(2));

        const newPoint: LatencyTrendPoint = {
          id: `pt-flag-${now}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: now,
          timeFormatted,
          executionTimeMs: Number(baseLatency.toFixed(2)),
          rowsScanned,
          activeQueriesCount: activeQueries,
          cacheHit: isCacheHit,
          flags: nextFlags,
          flagToggled: key,
          flagToggledState: nextState,
          deltaMs: delta,
          triggerEvent: `Flag ${key}: ${nextState ? 'ON' : 'OFF'} (${nextState ? 'Optimized' : 'Regression'})`,
          simulatedError
        };

        return [...h, newPoint];
      });

      return nextFlags;
    });
  };

  // Global Keyboard Shortcuts for Performance Optimizations (e.g. Ctrl+I, Ctrl+C, Ctrl+B, Ctrl+V, Ctrl+D)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        activeEl.isContentEditable
      );

      // '?' or 'Shift+/' opens shortcuts cheat sheet (when not typing in an input)
      if (e.key === '?' && !isInput) {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
        return;
      }

      // Escape closes shortcuts modal
      if (e.key === 'Escape' && isShortcutsModalOpen) {
        e.preventDefault();
        setIsShortcutsModalOpen(false);
        return;
      }

      const isModifier = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Trigger shortcut toast helper
      const notifyShortcut = (combo: string, flagName: string, enabled: boolean) => {
        setShortcutToast({
          action: `${flagName} ${enabled ? 'ENABLED' : 'DISABLED'}`,
          flagName,
          enabled,
          combo
        });
      };

      // 1. Ctrl+I / ⌘I -> Toggle B-Tree Indexing
      if (isModifier && key === 'i' && !e.shiftKey && !e.altKey) {
        if (!isInput) {
          e.preventDefault();
          const nextVal = !flags.btreeIndexing;
          handleToggleFlag('btreeIndexing');
          notifyShortcut(e.metaKey ? '⌘I' : 'Ctrl+I', 'B-Tree Indexing', nextVal);
          return;
        }
      }

      // 2. Ctrl+C / ⌘C -> Toggle LRU Query Cache (only when no text is highlighted and not in text input)
      // Also Alt+C unconditionally
      if ((isModifier && key === 'c' && !e.shiftKey && !e.altKey) || (e.altKey && key === 'c')) {
        const selectedText = window.getSelection()?.toString();
        const hasSelection = selectedText && selectedText.trim().length > 0;
        if (!isInput && !hasSelection) {
          e.preventDefault();
          const nextVal = !flags.queryCaching;
          handleToggleFlag('queryCaching');
          notifyShortcut(e.metaKey ? '⌘C' : 'Ctrl+C', 'LRU Query Caching', nextVal);
          return;
        }
      }

      // 3. Ctrl+B / ⌘B -> Toggle Batch Eager Loading (N+1 query elimination)
      if (isModifier && key === 'b' && !e.shiftKey && !e.altKey) {
        if (!isInput) {
          e.preventDefault();
          const nextVal = !flags.batchEagerLoading;
          handleToggleFlag('batchEagerLoading');
          notifyShortcut(e.metaKey ? '⌘B' : 'Ctrl+B', 'Batch Eager Loading', nextVal);
          return;
        }
      }

      // 4. Ctrl+V / ⌘V -> Toggle DOM Virtualization (only when not in text input)
      if (isModifier && key === 'v' && !e.shiftKey && !e.altKey) {
        if (!isInput) {
          e.preventDefault();
          const nextVal = !flags.virtualizedDOM;
          handleToggleFlag('virtualizedDOM');
          notifyShortcut(e.metaKey ? '⌘V' : 'Ctrl+V', 'DOM Virtualization', nextVal);
          return;
        }
      }

      // 5. Ctrl+D / ⌘D -> Toggle Deferred Rendering
      if (isModifier && key === 'd' && !e.shiftKey && !e.altKey) {
        if (!isInput) {
          e.preventDefault();
          const nextVal = !flags.deferredRendering;
          handleToggleFlag('deferredRendering');
          notifyShortcut(e.metaKey ? '⌘D' : 'Ctrl+D', 'Deferred Rendering', nextVal);
          return;
        }
      }

      // 6. Ctrl+Shift+O / ⌘Shift+O -> Toggle All Optimizations (Fix All / Simulate Bottlenecks)
      if (isModifier && (e.shiftKey || e.altKey) && key === 'o') {
        if (!isInput) {
          e.preventDefault();
          const allActive = Object.values(flags).every(Boolean);
          const nextVal = !allActive;
          setFlags({
            batchEagerLoading: nextVal,
            btreeIndexing: nextVal,
            queryCaching: nextVal,
            virtualizedDOM: nextVal,
            deferredRendering: nextVal
          });
          notifyShortcut(
            e.metaKey ? '⌘Shift+O' : 'Ctrl+Shift+O',
            nextVal ? 'All Optimizations' : 'Bottleneck Simulation',
            nextVal
          );
          return;
        }
      }

      // 7. Ctrl+Shift+B / ⌘Shift+B -> Open Benchmark Modal
      if (isModifier && e.shiftKey && key === 'b') {
        if (!isInput) {
          e.preventDefault();
          setIsBenchmarkModalOpen(true);
          notifyShortcut(e.metaKey ? '⌘Shift+B' : 'Ctrl+Shift+B', 'Benchmark Modal', true);
          return;
        }
      }

      // 8. Ctrl+Shift+F / ⌘Shift+F -> Fix All (Automatically apply all missing optimizations & indexes)
      if (isModifier && e.shiftKey && key === 'f') {
        if (!isInput) {
          e.preventDefault();
          setFlags({
            batchEagerLoading: true,
            btreeIndexing: true,
            queryCaching: true,
            virtualizedDOM: true,
            deferredRendering: true
          });
          notifyShortcut(e.metaKey ? '⌘Shift+F' : 'Ctrl+Shift+F', 'Fix All (Applied All Optimizations)', true);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [flags, isShortcutsModalOpen]);

  // Auto-dismiss shortcut toast after 2.8 seconds
  useEffect(() => {
    if (!shortcutToast) return;
    const timer = setTimeout(() => {
      setShortcutToast(null);
    }, 2800);
    return () => clearTimeout(timer);
  }, [shortcutToast]);

  const handleRunOptimizationSequence = () => {
    if (isSimulatingSequence) return;
    setIsSimulatingSequence(true);

    const steps: { flag: keyof OptimizationFlags; enable: boolean; label: string }[] = [
      { flag: 'queryCaching', enable: false, label: 'Disable LRU Query Caching' },
      { flag: 'queryCaching', enable: true, label: 'Restore LRU Query Caching' },
      { flag: 'btreeIndexing', enable: false, label: 'Disable B-Tree Indexing (Full Table Scan)' },
      { flag: 'btreeIndexing', enable: true, label: 'Restore B-Tree Indexing' },
      { flag: 'batchEagerLoading', enable: false, label: 'Disable Batch Eager Loading (N+1 Storm)' },
      { flag: 'batchEagerLoading', enable: true, label: 'Restore Batch Eager Loading' },
      { flag: 'virtualizedDOM', enable: false, label: 'Disable DOM Virtualization' },
      { flag: 'virtualizedDOM', enable: true, label: 'Restore DOM Virtualization' }
    ];

    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx >= steps.length) {
        clearInterval(interval);
        setIsSimulatingSequence(false);
        return;
      }
      const s = steps[stepIdx];
      stepIdx++;
      setFlags((prev) => {
        const nextFlags = { ...prev, [s.flag]: s.enable };
        const now = Date.now();
        const d = new Date(now);
        const timeFormatted = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;

        let baseLatency = 0.16;
        let rowsScanned = 100;
        let activeQueries = 1;
        let isCacheHit = false;
        let simulatedError: string | null = null;

        if (!nextFlags.batchEagerLoading) {
          baseLatency = 472.5;
          rowsScanned = 50000;
          activeQueries = 101;
          simulatedError = 'Database Connection Pool Timeout: max_connections (25) exceeded!';
        } else if (!nextFlags.btreeIndexing) {
          baseLatency = 51.8;
          rowsScanned = 50000;
        } else if (!nextFlags.virtualizedDOM) {
          baseLatency = 19.2;
        } else if (!nextFlags.queryCaching) {
          baseLatency = 1.45;
        } else {
          baseLatency = 0.15;
          isCacheHit = true;
        }

        setTrendHistory((h) => {
          const prevPt = h[h.length - 1];
          const prevLat = prevPt ? prevPt.executionTimeMs : 1.2;
          const delta = Number((baseLatency - prevLat).toFixed(2));
          return [
            ...h,
            {
              id: `pt-seq-${now}-${stepIdx}`,
              timestamp: now,
              timeFormatted,
              executionTimeMs: Number(baseLatency.toFixed(2)),
              rowsScanned,
              activeQueriesCount: activeQueries,
              cacheHit: isCacheHit,
              flags: nextFlags,
              flagToggled: s.flag,
              flagToggledState: s.enable,
              deltaMs: delta,
              triggerEvent: `Simulation: ${s.label}`,
              simulatedError
            }
          ];
        });

        return nextFlags;
      });
    }, 750);
  };
  const [mutationThreshold] = useState<number>(100);
  const [activeView, setActiveView] = useState<'grid' | 'trends' | 'comparison' | 'schema'>('grid');
  const [serializationLogs, setSerializationLogs] = useState<SerializationLogEntry[]>(() => getInitialSerializationLogs());
  const [dataTapeEntries, setDataTapeEntries] = useState<DataTapeEntry[]>(() => getInitialDataTapeEntries());
  const [selectedTapeEntry, setSelectedTapeEntry] = useState<DataTapeEntry | null>(null);

  const handleAutoCaptureSnapshot = async (
    triggerEvent: string,
    details: { memoryMb: number; cpuUsage: number; slope: number }
  ) => {
    try {
      const records = queryResult.records || [];
      const { entry } = await createDataTapeEntry({
        records,
        format: 'json',
        triggerEvent: `[AUTO-CAPTURE] ${triggerEvent} (RAM: ${details.memoryMb}MB, CPU: ${details.cpuUsage}%, Trend: +${details.slope.toFixed(1)} MB/min)`,
        databaseTotalRecords: queryResult.totalCount,
        filterSummary: {
          searchTerm: searchQuery,
          status: statusFilter,
          category: selectedCategory,
          pageSize: queryResult.records.length
        },
        sequenceNumber: dataTapeEntries.length + 1,
        includeHeaders: true
      });

      setDataTapeEntries((prev) => [entry, ...prev]);
      if (!notificationsMuted) {
        setProactiveToast({
          title: 'Auto-Capture: Critical Threshold',
          message: `Performance snapshot auto-captured to Historical Data Tape (${entry.tapeId}): ${triggerEvent}`
        });
      }
    } catch (err) {
      console.error('Failed to auto-capture performance snapshot:', err);
    }
  };

  const [notificationsMuted, setNotificationsMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('notificationsMuted') === 'true';
    } catch {
      return false;
    }
  });

  const handleMuteAllNotifications = () => {
    try {
      localStorage.setItem('notificationsMuted', 'true');
    } catch (e) {
      console.error('Failed to save notificationsMuted state to localStorage:', e);
    }
    setNotificationsMuted(true);
    setProactiveToast(null);
  };

  const [proactiveToast, setProactiveToast] = useState<{
    title: string;
    message: string;
    flagToEnable?: keyof OptimizationFlags;
    flagName?: string;
  } | null>(null);

  useEffect(() => {
    if (notificationsMuted) {
      setProactiveToast(null);
      return;
    }

    // Proactive Alert Trigger: Custom Latency Spike Threshold Breach
    if (queryResult.executionTimeMs >= alertThresholdMs) {
      const unoptimizedFlag: keyof OptimizationFlags | null = !flags.btreeIndexing
        ? 'btreeIndexing'
        : !flags.batchEagerLoading
        ? 'batchEagerLoading'
        : !flags.queryCaching
        ? 'queryCaching'
        : !flags.virtualizedDOM
        ? 'virtualizedDOM'
        : !flags.deferredRendering
        ? 'deferredRendering'
        : null;

      const flagNameMap: Record<keyof OptimizationFlags, string> = {
        btreeIndexing: 'B-Tree Indexing',
        batchEagerLoading: 'Batch Eager Loading',
        queryCaching: 'Query Caching',
        virtualizedDOM: 'Virtualized DOM',
        deferredRendering: 'Deferred Rendering'
      };

      setProactiveToast({
        title: `⚡ Latency Spike Alert (>${alertThresholdMs}ms Threshold Breach)`,
        message: `Query execution latency reached ${queryResult.executionTimeMs.toFixed(1)}ms, breaching the custom latency alert threshold of ${alertThresholdMs}ms.`,
        flagToEnable: unoptimizedFlag || undefined,
        flagName: unoptimizedFlag ? flagNameMap[unoptimizedFlag] : undefined
      });
    } else if (queryResult.executionTimeMs > 130 && !flags.btreeIndexing) {
      setProactiveToast({
        title: 'High Latency Detected',
        message: `Query took ${queryResult.executionTimeMs.toFixed(1)}ms due to sequential table scan.`,
        flagToEnable: 'btreeIndexing',
        flagName: 'B-Tree Indexing'
      });
    } else if (queryResult.executionTimeMs > 110 && !flags.batchEagerLoading) {
      setProactiveToast({
        title: 'Connection Pool Warning',
        message: `N+1 query cascade detected (${queryResult.executionTimeMs.toFixed(1)}ms).`,
        flagToEnable: 'batchEagerLoading',
        flagName: 'Batch Eager Loading'
      });
    }
  }, [
    queryResult.executionTimeMs,
    flags.btreeIndexing,
    flags.batchEagerLoading,
    flags.queryCaching,
    flags.virtualizedDOM,
    flags.deferredRendering,
    alertThresholdMs,
    notificationsMuted
  ]);

  // Predefined threshold for slope of execution time over 3 consecutive data points (in ms/step)
  const PREDEFINED_SLOPE_THRESHOLD_MS = 15;

  const [anomalyToast, setAnomalyToast] = useState<{
    id: string;
    title: string;
    message: string;
    slope: number;
    points: [number, number, number];
    recommendation: string;
    flagToEnable?: keyof OptimizationFlags;
    flagName?: string;
  } | null>(null);

  const lastAnomalyPointIdRef = useRef<string | null>(null);

  // Background Observer: Monitors latency spikes in trendHistory and triggers a 'Performance Anomaly' toast
  // with a recommendation if the slope of execution time exceeds the threshold over the dynamic moving average trend window (anomalyTrendWindowSec).
  useEffect(() => {
    if (notificationsMuted || !extendedAlertThresholds.enabled) {
      setAnomalyToast(null);
      return;
    }

    if (!trendHistory || trendHistory.length < 2) {
      return;
    }

    const windowSec = movingAverageTrendWindow || extendedAlertThresholds.anomalyTrendWindowSec || 15;
    const now = Date.now();
    const windowStartMs = now - windowSec * 1000;

    // Filter points falling within the dynamic moving average trend window
    const windowPoints = trendHistory.filter((pt) => pt.timestamp >= windowStartMs);

    if (windowPoints.length < 2) {
      return;
    }

    const latestPoint = windowPoints[windowPoints.length - 1];
    if (lastAnomalyPointIdRef.current === latestPoint.id) {
      return;
    }

    const firstPointInWindow = windowPoints[0];
    const latencyDelta = latestPoint.executionTimeMs - firstPointInWindow.executionTimeMs;
    const timeDeltaSec = Math.max(1, (latestPoint.timestamp - firstPointInWindow.timestamp) / 1000);
    const slopePerSec = latencyDelta / timeDeltaSec;

    // Threshold for slope per second (e.g. > 1.5 ms/sec acceleration over window)
    const SLOPE_THRESHOLD_PER_SEC = anomalyThresholdSlope;
    const isAnomaly = slopePerSec >= SLOPE_THRESHOLD_PER_SEC && latencyDelta > 10;

    if (isAnomaly) {
      lastAnomalyPointIdRef.current = latestPoint.id;

      let recommendation = '';
      let flagToEnable: keyof OptimizationFlags | undefined = undefined;
      let flagName: string | undefined = undefined;

      if (!flags.btreeIndexing) {
        flagToEnable = 'btreeIndexing';
        flagName = 'B-Tree Indexing';
        recommendation = `Sequential table scans compounding over the ${windowSec}s trend window. Enable B-Tree Indexing to flatten query execution slope.`;
      } else if (!flags.batchEagerLoading) {
        flagToEnable = 'batchEagerLoading';
        flagName = 'Batch Eager Loading';
        recommendation = `N+1 query cascades accelerating over the ${windowSec}s window. Enable Batch Eager Loading to consolidate roundtrips.`;
      } else if (!flags.queryCaching) {
        flagToEnable = 'queryCaching';
        flagName = 'Query Caching';
        recommendation = `Frequent repetitive query hits over the ${windowSec}s trend window. Enable Query Caching.`;
      } else {
        recommendation = `Workload contention escalating over the ${windowSec}s monitoring window. Inspect Database Bottleneck Heatmap.`;
      }

      const p0 = firstPointInWindow.executionTimeMs;
      const p1 = windowPoints[Math.floor(windowPoints.length / 2)].executionTimeMs;
      const p2 = latestPoint.executionTimeMs;

      setAnomalyToast({
        id: latestPoint.id,
        title: 'Performance Anomaly',
        message: `Steep latency acceleration (+${slopePerSec.toFixed(1)}ms/sec over ${windowSec}s window: ${p0.toFixed(1)}ms → ${p2.toFixed(1)}ms).`,
        slope: slopePerSec,
        points: [p0, p1, p2],
        recommendation,
        flagToEnable,
        flagName
      });

      setProactiveToast({
        title: 'Performance Anomaly',
        message: `Dynamic trend window (${windowSec}s) detected latency slope of +${slopePerSec.toFixed(1)}ms/sec. ${recommendation}`,
        flagToEnable,
        flagName
      });
    }
  }, [trendHistory, flags, extendedAlertThresholds, notificationsMuted, movingAverageTrendWindow, anomalyThresholdSlope]);

  // Revert on Stable Watcher: Automatically reverts Quick Fix if latency remains below 100ms for more than 2 minutes (120s)
  const stableStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRevertOnStableEnabled || !hasQuickFixBeenApplied) {
      stableStartTimeRef.current = null;
      return;
    }

    const currentLatency = queryResult.executionTimeMs;
    const isStable = currentLatency < 100;

    if (isStable) {
      if (stableStartTimeRef.current === null) {
        stableStartTimeRef.current = Date.now();
      } else {
        const elapsedSec = (Date.now() - stableStartTimeRef.current) / 1000;
        if (elapsedSec >= 120) {
          handleQuickRevert();
          setProactiveToast({
            title: '⏱️ Auto-Reverted on Stable',
            message: `Latency remained below 100ms for over 2 minutes (${elapsedSec.toFixed(0)}s). Quick Fix optimizations have been automatically reverted.`,
            flagToEnable: 'batchEagerLoading',
            flagName: 'Batch Eager Loading'
          });
          stableStartTimeRef.current = null;
        }
      }
    } else {
      stableStartTimeRef.current = null;
    }
  }, [isRevertOnStableEnabled, hasQuickFixBeenApplied, queryResult.executionTimeMs]);

  // Extended multi-metric alerting watchdog (Lock wait times & Page faults)
  useEffect(() => {
    if (notificationsMuted || !extendedAlertThresholds.enabled) {
      return;
    }

    const estimatedPageFaults = Math.round(queryResult.executionTimeMs / 5 + (!flags.btreeIndexing ? 18 : 2) + (!flags.batchEagerLoading ? 25 : 0));
    const estimatedLockWaitMs = !flags.btreeIndexing ? 32.5 : !flags.batchEagerLoading ? 18.2 : 2.1;

    if (estimatedLockWaitMs > extendedAlertThresholds.lockWaitAlertMs) {
      setProactiveToast({
        title: `🔒 Lock Contention Alert (>${extendedAlertThresholds.lockWaitAlertMs}ms Threshold)`,
        message: `Estimated table lock wait time reached ${estimatedLockWaitMs.toFixed(1)}ms, exceeding your custom lock wait alert threshold of ${extendedAlertThresholds.lockWaitAlertMs}ms.`,
        flagToEnable: !flags.btreeIndexing ? 'btreeIndexing' : 'batchEagerLoading',
        flagName: !flags.btreeIndexing ? 'B-Tree Indexing' : 'Batch Eager Loading'
      });
    } else if (estimatedPageFaults > extendedAlertThresholds.pageFaultsAlertCount) {
      setProactiveToast({
        title: `💾 Buffer Page Faults Alert (>${extendedAlertThresholds.pageFaultsAlertCount} Faults)`,
        message: `Buffer pool page misses reached ${estimatedPageFaults} faults, exceeding your custom page faults alert threshold of ${extendedAlertThresholds.pageFaultsAlertCount} faults.`,
        flagToEnable: 'queryCaching',
        flagName: 'Query Caching'
      });
    }
  }, [queryResult.executionTimeMs, flags, extendedAlertThresholds, notificationsMuted]);

  const handleGenerateDiagnosticCorrelationPdf = async () => {
    setIsGeneratingDiagnosticPdf(true);
    try {
      await exportDiagnosticCorrelationPdf({
        currentFlags: flags,
        options: { sections: pdfExportSections },
        thresholdViolations: thresholdViolationsHistory,
        mutationHistory,
        trendHistory,
        mutationThreshold
      });
      setIsDiagnosticPdfSuccess(true);
      setTimeout(() => setIsDiagnosticPdfSuccess(false), 3000);

      const now = Date.now();
      const newHistoryItem: DiagnosticPdfHistoryItem = {
        id: `pdf-rep-${now}`,
        title: `Correlation Diagnostic Report (${new Date(now).toLocaleDateString()})`,
        timestamp: now,
        timeFormatted: new Date(now).toLocaleTimeString(),
        recordCount: queryResult.totalCount,
        executionTimeMs: queryResult.executionTimeMs,
        fileSizeKB: Math.floor(Math.random() * 80) + 140,
        summary: `Flags state: batchEagerLoading=${flags.batchEagerLoading}, queryCaching=${flags.queryCaching}. Latency: ${queryResult.executionTimeMs.toFixed(1)}ms.`
      };
      setPdfExportHistory(prev => [newHistoryItem, ...prev]);
    } catch (err) {
      console.error('Failed to generate PDF report:', err);
    } finally {
      setIsGeneratingDiagnosticPdf(false);
    }
  };

  const handleSimulateSlopeAnomaly = () => {
    const now = Date.now();
    const p1: LatencyTrendPoint = {
      id: `pt-anomaly-1-${now}`,
      timestamp: now - 4000,
      timeFormatted: new Date(now - 4000).toLocaleTimeString(),
      executionTimeMs: 12.0,
      rowsScanned: 5000,
      activeQueriesCount: 2,
      cacheHit: false,
      flags: { ...flags },
      triggerEvent: 'Anomaly Sequence: Step 1 (Normal Latency)',
      simulatedError: null
    };
    const p2: LatencyTrendPoint = {
      id: `pt-anomaly-2-${now}`,
      timestamp: now - 2000,
      timeFormatted: new Date(now - 2000).toLocaleTimeString(),
      executionTimeMs: 48.0,
      rowsScanned: 25000,
      activeQueriesCount: 6,
      cacheHit: false,
      flags: { ...flags },
      triggerEvent: 'Anomaly Sequence: Step 2 (Latency Spike +36ms)',
      simulatedError: null
    };
    const p3: LatencyTrendPoint = {
      id: `pt-anomaly-3-${now}`,
      timestamp: now,
      timeFormatted: new Date(now).toLocaleTimeString(),
      executionTimeMs: 98.0,
      rowsScanned: 50000,
      activeQueriesCount: 15,
      cacheHit: false,
      flags: { ...flags },
      triggerEvent: 'Anomaly Sequence: Step 3 (Slope Exceeded Threshold)',
      simulatedError: null
    };
    setTrendHistory((prev) => [...prev, p1, p2, p3]);
  };

  const [isAppExportPreviewOpen, setIsAppExportPreviewOpen] = useState(false);

  const handleExportCsv = () => {
    setIsAppExportPreviewOpen(true);
  };

  const handleConfirmAppExport = (
    format: ExportFormat,
    options: { includeHeaders: boolean; pretty: boolean }
  ) => {
    setIsAppExportPreviewOpen(false);
    const { blob, filename } = exportRecords(
      queryResult.records,
      format,
      'database_query_records',
      {
        includeHeaders: options.includeHeaders,
        pretty: options.pretty
      }
    );
    triggerFileDownload(blob, filename);
  };

  const handleExportDiagnosticPackage = () => {
    const diagnosticPackage = {
      packageVersion: 'v1.0.0',
      exportTimestamp: new Date().toISOString(),
      systemState: {
        flags,
        totalRecords: queryResult.totalCount || 50000,
        cacheHit: queryResult.cacheHit,
        executionTimeMs: queryResult.executionTimeMs,
        activeErrorsCount: queryResult.simulatedError ? 1 : 0
      },
      performanceTrends: trendHistory.slice(-20),
      auditDataTapes: dataTapeEntries.slice(-10),
      serializationLogsCount: serializationLogs.length
    };

    const blob = new Blob([JSON.stringify(diagnosticPackage, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system_diagnostic_package_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleQuickSnapshot = async () => {
    try {
      const records = queryResult.records || [];
      const { entry } = await createDataTapeEntry({
        records,
        format: 'json',
        triggerEvent: `[QUICK SNAPSHOT] Manual Header Capture at ${new Date().toLocaleTimeString()}`,
        databaseTotalRecords: queryResult.totalCount,
        filterSummary: {
          searchTerm: searchQuery,
          status: statusFilter,
          category: selectedCategory,
          pageSize: queryResult.records.length
        },
        sequenceNumber: dataTapeEntries.length + 1,
        includeHeaders: true
      });

      setDataTapeEntries((prev) => [entry, ...prev]);
      setProactiveToast({
        title: 'Quick Snapshot Saved',
        message: `System configuration and metrics persisted to Historical Data Tape (${entry.tapeId}) successfully.`
      });
      setTimeout(() => setProactiveToast(null), 4000);
    } catch (err) {
      console.error('Failed to create quick snapshot:', err);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
      <Header
        flags={flags}
        onToggleFlag={handleToggleFlag}
        onToggleAll={(enable) => setFlags({
          batchEagerLoading: enable,
          btreeIndexing: enable,
          queryCaching: enable,
          virtualizedDOM: enable,
          deferredRendering: enable
        })}
        onRunBenchmark={() => setIsBenchmarkModalOpen(true)}
        isBenchmarking={false}
        hasErrors={false}
        activeErrorCount={0}
        activeView={activeView}
        onSelectView={(view) => setActiveView(view)}
        trendCount={trendHistory.length}
        totalRecords={queryResult.totalCount || 50000}
        onOpenBenchmark={() => setIsBenchmarkModalOpen(true)}
        onOpenTrends={() => {
          setActiveView('trends');
          setIsPerformanceTrendsOpen(true);
        }}
        onOpenBulkImport={() => setIsBulkImportOpen(true)}
        onOpenHistoryTape={() => setIsHistoricalDataTapeOpen(true)}
        onExportCsv={handleExportCsv}
        onOpenPdfPreview={() => setShowPdfPreviewModal(true)}
        onOpenWizard={() => setIsOptimizationWizardOpen(true)}
        dataTapeEntries={dataTapeEntries}
        onSelectTapeEntry={(entry) => {
          setSelectedTapeEntry(entry);
          setIsHistoricalDataTapeOpen(true);
        }}
        onExportDiagnosticPackage={handleExportDiagnosticPackage}
        onQuickSnapshot={handleQuickSnapshot}
        showQueryIntensityOverlay={showQueryIntensityOverlay}
        onToggleQueryIntensityOverlay={setShowQueryIntensityOverlay}
        onOpenShortcutsCheatSheet={() => setIsShortcutsModalOpen(true)}
      />

      <OptimizationControls
        flags={flags}
        onToggleFlag={handleToggleFlag}
        onResetAll={() => setFlags({ batchEagerLoading: true, btreeIndexing: true, queryCaching: true, virtualizedDOM: true, deferredRendering: true })}
        onApplyFlags={(newFlags) => setFlags(newFlags)}
        lowUsageThresholds={lowUsageThresholds}
        onLowUsageThresholdsChange={handleLowUsageThresholdsChange}
        cacheTtl={cacheTtlSeconds}
        onCacheTtlChange={handleCacheTtlChange}
        onPurgePlanCache={handlePurgePlanCache}
        alertThresholdMs={alertThresholdMs}
        onAlertThresholdChange={handleAlertThresholdChange}
        trendHistory={trendHistory}
        onSimulateSlopeAnomaly={handleSimulateSlopeAnomaly}
        extendedAlertThresholds={extendedAlertThresholds}
        onExtendedAlertThresholdsChange={handleExtendedAlertThresholdsChange}
      />

      <MetricsBar
        queryResult={queryResult}
        flags={flags}
        dbStats={dbStats}
        fps={fps}
        currentFps={fps}
        renderedDomCount={flags.virtualizedDOM ? Math.min(queryResult.records.length, 18) : queryResult.records.length}
        totalDatabaseRecords={dbStats?.totalRecords || 50000}
        onOpenBulkImport={() => setIsBulkImportOpen(true)}
        autoRefreshEnabled={autoRefreshEnabled}
        onToggleAutoRefresh={(enabled) => setAutoRefreshEnabled(enabled)}
        alertThresholdMs={alertThresholdMs}
        onAlertThresholdChange={handleAlertThresholdChange}
        heatmapModeEnabled={showLatencyHeatmap}
        onToggleHeatmapMode={setShowLatencyHeatmap}
        performanceBudgetMs={performanceBudgetMs}
        onPerformanceBudgetChange={setPerformanceBudgetMs}
        onToggleFlag={handleToggleFlag}
        onApplyFlags={(newFlags) => setFlags(newFlags)}
        onAutoOptimize={() => setFlags({
          batchEagerLoading: true,
          btreeIndexing: true,
          queryCaching: true,
          virtualizedDOM: true,
          deferredRendering: true
        })}
        onResetMetrics={() => {
          setTrendHistory([]);
          setSerializationLogs([]);
          setDataTapeEntries([]);
          setProactiveToast(null);
        }}
        onOpenBottleneckHeatmap={() => setIsBottleneckDrawerOpen(true)}
        onOpenVisualQueryBuilder={() => setIsVisualQueryBuilderOpen(true)}
        onOpenPdfPreview={() => setShowPdfPreviewModal(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 space-y-4">
        {/* Global Query Intensity Heatmap Overlay Banner */}
        {showQueryIntensityOverlay && (
          <div className="p-4 bg-gradient-to-r from-rose-950 via-amber-950 to-zinc-950 text-white rounded-2xl border-2 border-rose-500 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fadeIn relative z-40 ring-4 ring-rose-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-md animate-bounce shrink-0">
                <Flame className="w-6 h-6 text-amber-200" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm text-white tracking-wide">🔥 Global Query Intensity Heatmap Overlay Active</h3>
                  <span className="font-mono text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-bold uppercase animate-pulse">High Thermal Load</span>
                </div>
                <p className="text-xs text-rose-200">
                  Visualizing execution plan cost bottlenecks, sequential scan memory pressure, and N+1 query hotspots across the application interface in real-time.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <HeatmapIntensityScale currentLatencyMs={queryResult.executionTimeMs} compact={true} />
              <button
                type="button"
                onClick={() => setShowQueryIntensityOverlay(false)}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-colors shrink-0"
              >
                Disable Overlay
              </button>
            </div>
          </div>
        )}

        {/* Conditional Notification Banner: batchEagerLoading is false and latency exceeds 200ms */}
        {!isBatchBannerDismissed && (isBannerPinned || Date.now() > batchBannerDismissedUntil) && !flags.batchEagerLoading && (isBannerPinned || queryResult.executionTimeMs > customLatencyThreshold) && (
          <div
            id="banner-batch-eager-loading-latency"
            data-testid="banner-batch-eager-loading-latency"
            className={`p-4 bg-gradient-to-r from-rose-900 via-rose-950 to-amber-950 text-white rounded-2xl border-2 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-slideDown relative z-40 transition-all ${
              isBannerPinned
                ? 'border-rose-400 ring-4 ring-rose-500/50 shadow-rose-950/80 animate-banner-pinned-glow'
                : 'border-rose-500 ring-4 ring-rose-500/20'
            }`}
          >
            <div className="flex items-start md:items-center gap-3.5 w-full">
              <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-md shrink-0 animate-pulse mt-0.5 md:mt-0">
                <AlertTriangle className="w-6 h-6 text-amber-300" />
              </div>
              <div className="space-y-1 w-full">
                {pdfErrorToast && (
                  <div className="p-2.5 bg-rose-900/90 border border-rose-500 text-rose-100 rounded-xl text-xs font-mono font-bold shadow-lg flex items-center justify-between gap-2 mb-2 animate-fadeIn">
                    <span>⚠️ {pdfErrorToast}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        id="btn-retry-export-pdf"
                        data-testid="btn-retry-export-pdf"
                        onClick={() => {
                          setPdfErrorToast(null);
                          handleExportPdfClick();
                        }}
                        className="px-2.5 py-1 bg-rose-700 hover:bg-rose-600 text-white rounded text-[11px] font-bold cursor-pointer transition-colors shadow"
                      >
                        Retry
                      </button>
                      <button onClick={() => setPdfErrorToast(null)} className="text-rose-300 hover:text-white cursor-pointer">✕</button>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center gap-2 w-full">
                  <h3 className="font-extrabold text-sm text-white tracking-wide">
                    ⚠️ Critical Latency Alert: Batch Eager Loading Disabled
                  </h3>
                  <span className="font-mono text-[11px] bg-rose-600 text-white px-2.5 py-0.5 rounded-full font-bold uppercase shadow-xs">
                    Latency: {queryResult.executionTimeMs.toFixed(1)} ms (&gt; {customLatencyThreshold}ms threshold)
                  </span>
                  {/* Live Metrics Auto-Refresh Toggle Switch */}
                  <div
                    id="banner-live-metrics-controls"
                    data-testid="banner-live-metrics-controls"
                    className="flex items-center gap-1.5 bg-zinc-950/70 px-2.5 py-1 rounded-xl border border-rose-500/30 text-xs font-mono shrink-0"
                  >
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        id="toggle-live-metrics-banner"
                        data-testid="toggle-live-metrics-banner"
                        checked={isLiveMetricsEnabled}
                        onChange={(e) => setIsLiveMetricsEnabled(e.target.checked)}
                        className="w-3.5 h-3.5 accent-emerald-500 rounded cursor-pointer"
                      />
                      <span className="text-[11px] font-bold text-zinc-300 flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${isLiveMetricsEnabled ? 'bg-emerald-400 animate-ping' : 'bg-zinc-500'}`} />
                        Live Metrics
                      </span>
                    </label>
                    {isLiveMetricsEnabled && (
                      <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-700 ml-1">
                        <button
                          type="button"
                          id="btn-live-interval-1s"
                          data-testid="btn-live-interval-1s"
                          onClick={() => setLiveMetricsInterval('1s')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                            liveMetricsInterval === '1s'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                          title="Update metrics every 1 second (Real-time)"
                        >
                          Real-time (1s)
                        </button>
                        <button
                          type="button"
                          id="btn-live-interval-5s"
                          data-testid="btn-live-interval-5s"
                          onClick={() => setLiveMetricsInterval('5s')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                            liveMetricsInterval === '5s'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                          title="Update metrics every 5 seconds (Steady)"
                        >
                          Steady (5s)
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 bg-zinc-950/60 px-2 py-0.5 rounded-xl border border-rose-500/30 text-xs font-mono">
                    <span className="text-zinc-400 text-[10px]">Threshold:</span>
                    <input
                      type="number"
                      id="input-custom-latency-threshold"
                      data-testid="input-custom-latency-threshold"
                      value={customLatencyThreshold}
                      onChange={(e) => handleCustomThresholdChange(Number(e.target.value) || 200)}
                      step={10}
                      min={50}
                      max={2000}
                      className="w-14 bg-zinc-900 border border-zinc-700 text-white text-center rounded px-1 py-0.5 text-[11px] outline-none focus:border-rose-400 font-bold"
                      title="Custom trigger threshold for N+1 latency alert"
                    />
                    <span className="text-zinc-400 text-[10px]">ms</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-zinc-950/60 px-2 py-0.5 rounded-xl border border-rose-500/30 text-xs font-mono">
                    <span className="text-zinc-400 text-[10px]">Trend Window:</span>
                    <input
                      type="number"
                      id="input-moving-avg-trend-window"
                      data-testid="input-moving-avg-trend-window"
                      value={movingAverageTrendWindow}
                      onChange={(e) => handleMovingAverageWindowChange(Number(e.target.value) || 10)}
                      step={5}
                      min={5}
                      max={120}
                      className="w-12 bg-zinc-900 border border-zinc-700 text-white text-center rounded px-1 py-0.5 text-[11px] outline-none focus:border-rose-400 font-bold"
                      title="Moving Average Trend Window in seconds for anomaly detection watcher"
                    />
                    <span className="text-zinc-400 text-[10px]">s</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-zinc-950/60 px-2 py-0.5 rounded-xl border border-rose-500/30 text-xs font-mono">
                    <span className="text-zinc-400 text-[10px]">Anomaly Threshold (ms/sec):</span>
                    <input
                      type="number"
                      id="input-anomaly-threshold-slope"
                      data-testid="input-anomaly-threshold-slope"
                      value={anomalyThresholdSlope}
                      onChange={(e) => handleAnomalySlopeChange(Number(e.target.value) || 1.5)}
                      step={0.5}
                      min={0.1}
                      max={50}
                      className="w-14 bg-zinc-900 border border-zinc-700 text-white text-center rounded px-1 py-0.5 text-[11px] outline-none focus:border-rose-400 font-bold"
                      title="Anomaly Threshold (ms/sec) for slope acceleration detector watcher"
                    />
                    <span className="text-zinc-400 text-[10px]">ms/s</span>
                  </div>
                  {(() => {
                    const sev = queryResult.executionTimeMs >= 300 ? 'Critical' : queryResult.executionTimeMs >= 230 ? 'Warning' : 'Moderate';
                    const col = queryResult.executionTimeMs >= 300 ? 'bg-rose-600 text-white border-rose-400' : queryResult.executionTimeMs >= 230 ? 'bg-amber-600 text-white border-amber-400' : 'bg-yellow-500 text-zinc-950 border-yellow-300 font-bold';
                    return (
                      <span
                        className={`font-mono text-[11px] px-2.5 py-0.5 rounded-full uppercase shadow-xs border cursor-help ${col}`}
                        title={`Severity Determination:\n• Critical: executionTimeMs >= 300ms\n• Warning: executionTimeMs >= 230ms (and < 300ms)\n• Moderate: executionTimeMs < 230ms (and > ${customLatencyThreshold}ms)\nCurrent Latency: ${queryResult.executionTimeMs.toFixed(1)}ms`}
                      >
                        Severity: {sev}
                      </span>
                    );
                  })()}
                  <span className="font-mono text-[10px] bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full font-semibold">
                    flag: batchEagerLoading = false
                  </span>
                  <div
                    ref={sparklineSettingsRef}
                    className="relative flex items-center gap-1.5 bg-rose-950/80 px-2 py-1 rounded-lg border border-rose-500/40 shrink-0"
                    title={`Recent ${sparklineMetric === 'latency' ? 'latency' : 'mutation frequency'} trend leading up to breach`}
                  >
                    <span className="text-[9px] font-mono text-rose-300">
                      {sparklineMetric === 'latency' ? 'Trend:' : 'Mutations:'}
                    </span>
                    <svg width={50} height={18} className="overflow-visible">
                      {(() => {
                        const points = (trendHistory || []).slice(-6);
                        const values = points.length >= 2
                          ? points.map(p => sparklineMetric === 'latency' ? p.executionTimeMs : (p.activeQueriesCount * 3.8 + 12))
                          : [120, 150, 190, 240, 280, sparklineMetric === 'latency' ? queryResult.executionTimeMs : 55];
                        const min = Math.min(...values);
                        const max = Math.max(...values, min + 1);
                        const coords = values.map((v, i) => {
                          const x = (i / (values.length - 1)) * 44;
                          const y = 16 - ((v - min) / (max - min || 1)) * 12 - 2;
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        }).join(' ');
                        return (
                          <polyline
                            fill="none"
                            stroke={sparklineMetric === 'latency' ? '#f87171' : '#fbbf24'}
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={coords}
                          />
                        );
                      })()}
                    </svg>

                    <button
                      type="button"
                      id="btn-sparkline-metric-settings"
                      data-testid="btn-sparkline-metric-settings"
                      onClick={() => setIsSparklineSettingsOpen((prev) => !prev)}
                      className="p-0.5 text-rose-300 hover:text-white hover:bg-rose-900 rounded transition-colors cursor-pointer"
                      title="Configure sparkline metric (Latency vs Mutation Frequency)"
                      aria-label="Sparkline settings"
                    >
                      <Settings className="w-3 h-3 text-rose-300 hover:text-white" />
                    </button>

                    {isSparklineSettingsOpen && (
                      <div
                        id="popover-sparkline-metric-settings"
                        data-testid="popover-sparkline-metric-settings"
                        className="absolute right-0 top-full mt-1.5 w-48 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-50 p-2 space-y-1 text-xs animate-fadeIn text-zinc-200"
                      >
                        <div className="px-2 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                          Sparkline Metric
                        </div>
                        <button
                          type="button"
                          id="btn-metric-option-latency"
                          data-testid="btn-metric-option-latency"
                          onClick={() => {
                            setSparklineMetric('latency');
                            setIsSparklineSettingsOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                            sparklineMetric === 'latency'
                              ? 'bg-rose-950 text-rose-200 font-bold border border-rose-600/50'
                              : 'hover:bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          <span>⚡ Latency</span>
                          {sparklineMetric === 'latency' && <span className="text-rose-400">✓</span>}
                        </button>
                        <button
                          type="button"
                          id="btn-metric-option-mutation"
                          data-testid="btn-metric-option-mutation"
                          onClick={() => {
                            setSparklineMetric('mutation');
                            setIsSparklineSettingsOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                            sparklineMetric === 'mutation'
                              ? 'bg-amber-950 text-amber-200 font-bold border border-amber-600/50'
                              : 'hover:bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          <span>🔄 Mutation Freq</span>
                          {sparklineMetric === 'mutation' && <span className="text-amber-400">✓</span>}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-rose-200/90 leading-relaxed max-w-3xl">
                  Query latency has reached <strong className="text-white font-mono">{queryResult.executionTimeMs.toFixed(1)}ms</strong> (exceeding the 200ms threshold) because <strong className="text-amber-300 font-mono">batchEagerLoading</strong> is currently disabled, triggering an unbatched N+1 child query cascade across line item relationships.
                </p>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className="font-mono text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-xs">
                    <span>⚡ Projected Latency Gain:</span>
                    <span className="text-white font-extrabold">-{Math.max(45, Math.round(queryResult.executionTimeMs * 0.55))} ms reduction</span>
                  </span>
                  <button
                    type="button"
                    id="btn-view-related-history"
                    data-testid="btn-view-related-history"
                    onClick={handleViewRelatedHistory}
                    className="text-xs font-mono font-semibold text-rose-300 hover:text-white underline underline-offset-4 cursor-pointer transition-colors flex items-center gap-1"
                    title="View related history entries from the last 5 minutes"
                  >
                    <span>View related history →</span>
                  </button>
                  <button
                    type="button"
                    id="btn-view-serialization-logs"
                    data-testid="btn-view-serialization-logs"
                    onClick={handleViewSerializationLogs}
                    className="text-xs font-mono font-semibold text-rose-300 hover:text-white underline underline-offset-4 cursor-pointer transition-colors flex items-center gap-1"
                    title="View serialization and N+1 cascade error logs"
                  >
                    <span>View Serialization Logs →</span>
                  </button>
                  <button
                    type="button"
                    id="btn-reset-session-statistics"
                    data-testid="btn-reset-session-statistics"
                    onClick={handleResetSessionStatistics}
                    className="text-xs font-mono font-semibold text-amber-300 hover:text-white underline underline-offset-4 cursor-pointer transition-colors flex items-center gap-1"
                    title="Clear current session trendHistory and reset baseline latency for debugging new bottleneck patterns"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
                    <span>Reset Session Statistics</span>
                  </button>
                </div>
                {showExportLogHistoryPanel && (
                  <div
                    id="export-log-history-panel"
                    className="mt-3 p-3 bg-zinc-950/90 border border-indigo-500/40 rounded-xl space-y-2 animate-fadeIn max-w-3xl"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-indigo-300 border-b border-zinc-800 pb-1.5">
                      <span>📁 Previously Exported Diagnostic Reports ({pdfExportHistory.length})</span>
                      <button onClick={() => setShowExportLogHistoryPanel(false)} className="text-zinc-400 hover:text-white cursor-pointer">✕</button>
                    </div>
                    {pdfExportHistory.length === 0 ? (
                      <div className="text-xs text-zinc-400 font-mono py-2">No export history found. Generate a PDF report to populate this log.</div>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {pdfExportHistory.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between bg-zinc-900/90 hover:bg-zinc-900 border border-zinc-800 hover:border-indigo-500/50 p-2 rounded-lg text-xs font-mono transition-colors"
                          >
                            <div className="space-y-0.5 truncate pr-2">
                              <span className="font-bold text-white block truncate">{item.title}</span>
                              <span className="text-[10px] text-zinc-400">{item.timeFormatted} • {item.fileSizeKB} KB</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleReDownloadHistoryItem(item)}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[11px] shrink-0 transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                              title="Re-download correlation report"
                            >
                              <span>Re-download</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-2.5 pt-2 border-t border-rose-500/30 space-y-1.5">
                  <div className="text-[11px] font-mono font-bold text-rose-300 flex items-center justify-between">
                    <span>🕒 Recent Export History (Last {Math.min(5, pdfExportHistory.length)} Reports)</span>
                    <button
                      type="button"
                      onClick={() => setIsExportHistoryModalOpen(true)}
                      className="text-[10px] text-indigo-300 hover:text-white underline cursor-pointer"
                    >
                      View All ({pdfExportHistory.length}) →
                    </button>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 scrollbar-thin max-w-full">
                    {pdfExportHistory.slice(0, 5).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        id={`btn-redownload-report-${item.id}`}
                        data-testid={`btn-redownload-report-${item.id}`}
                        onClick={() => handleReDownloadHistoryItem(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950/90 hover:bg-zinc-900 border border-zinc-800 hover:border-indigo-400/60 rounded-xl text-xs font-mono text-zinc-200 hover:text-white transition-all cursor-pointer shrink-0 shadow-xs group"
                        title={`Re-download report: ${item.title}\n• Timestamp: ${item.timeFormatted}\n• Record Count: ${item.recordCount || 50000} records\n• Execution Time: ${item.executionTimeMs || 245.0}ms`}
                      >
                        <FileText className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform shrink-0" />
                        <span className="font-bold truncate max-w-[160px]">{item.title}</span>
                        <span className="text-[10px] text-zinc-400 shrink-0">({item.timeFormatted})</span>
                      </button>
                    ))}
                    {pdfExportHistory.length === 0 && (
                      <span className="text-xs text-zinc-400 font-mono italic px-1">No recent reports generated yet.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <label className="flex items-center gap-2 cursor-pointer select-none bg-zinc-950/60 hover:bg-zinc-950/80 px-3 py-2 rounded-xl border border-rose-500/40 transition-colors">
                <input
                  type="checkbox"
                  id="toggle-auto-resolve-spike"
                  data-testid="toggle-auto-resolve-spike"
                  checked={isAutoResolveOnSpikeEnabled}
                  onChange={(e) => handleToggleAutoResolveSpike(e.target.checked)}
                  className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
                />
                <span className="text-xs font-mono font-bold text-rose-200">Auto-Resolve on Spike</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none bg-zinc-950/60 hover:bg-zinc-950/80 px-3 py-2 rounded-xl border border-emerald-500/40 transition-colors">
                <input
                  type="checkbox"
                  id="toggle-revert-on-stable"
                  data-testid="toggle-revert-on-stable"
                  checked={isRevertOnStableEnabled}
                  onChange={(e) => handleToggleRevertOnStable(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
                <span className="text-xs font-mono font-bold text-emerald-200">Revert on Stable (&lt;100ms for 2m)</span>
              </label>
              <button
                type="button"
                id="btn-compare-baseline-banner"
                data-testid="btn-compare-baseline-banner"
                onClick={() => {
                  if (initialBaselineLatency === null) {
                    setInitialBaselineLatency(queryResult.executionTimeMs);
                  }
                  setIsCompareAgainstBaselineEnabled((prev) => !prev);
                }}
                className={`px-3.5 py-2 font-extrabold text-xs rounded-xl shadow-lg cursor-pointer transition-all flex items-center gap-1.5 border hover:scale-105 active:scale-95 ${
                  isCompareAgainstBaselineEnabled
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-300 ring-4 ring-cyan-500/30 shadow-cyan-950/80'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                }`}
                title="Toggle comparison of current latency against initial baseline latency"
              >
                <Sliders className="w-3.5 h-3.5 text-cyan-200" />
                <span>Compare Baseline</span>
                {isCompareAgainstBaselineEnabled && (
                  <span className="w-2 h-2 rounded-full bg-cyan-300 animate-ping" />
                )}
              </button>

              {isCompareAgainstBaselineEnabled && (
                <div
                  id="banner-baseline-comparison-label"
                  data-testid="banner-baseline-comparison-label"
                  className="flex items-center gap-2 px-3 py-2 bg-zinc-950/90 rounded-xl border border-cyan-500/50 text-xs font-mono w-full sm:w-auto animate-fadeIn"
                >
                  <span className="text-cyan-400 font-bold">Baseline:</span>
                  <span className="text-zinc-200">{(initialBaselineLatency ?? queryResult.executionTimeMs).toFixed(1)}ms</span>
                  <span className="text-zinc-500">→</span>
                  <span className="text-cyan-400 font-bold">Current:</span>
                  <span className="text-zinc-200">{queryResult.executionTimeMs.toFixed(1)}ms</span>
                  {(() => {
                    const base = initialBaselineLatency ?? queryResult.executionTimeMs;
                    const diff = queryResult.executionTimeMs - base;
                    const pct = base > 0 ? (diff / base) * 100 : 0;
                    const isFaster = diff <= 0;
                    return (
                      <span className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                        isFaster ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/50' : 'bg-rose-950 text-rose-300 border border-rose-600/50'
                      }`}>
                        {isFaster ? `▼ ${Math.abs(diff).toFixed(1)}ms (${Math.abs(pct).toFixed(1)}% faster)` : `▲ +${diff.toFixed(1)}ms (+${pct.toFixed(1)}% slower)`}
                      </span>
                    );
                  })()}
                </div>
              )}

              <button
                type="button"
                id="btn-quick-fix-all-banner"
                data-testid="btn-quick-fix-all-banner"
                onClick={handleQuickFixAll}
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-extrabold text-xs rounded-xl shadow-lg cursor-pointer transition-all flex items-center gap-1.5 border border-emerald-300 hover:scale-105 active:scale-95 shadow-emerald-950/50"
                title="Automatically enable all optimization flags for immediate resolution"
              >
                <Sparkles className="w-3.5 h-3.5 fill-zinc-950 text-zinc-950" />
                <span>Quick Fix All</span>
              </button>
              {(() => {
                const isBatchMostImpactful = !flags.batchEagerLoading;
                return (
                  <button
                    type="button"
                    id="btn-smart-optimization-banner"
                    data-testid="btn-smart-optimization-banner"
                    onClick={() => {
                      if (!flags.batchEagerLoading) {
                        handleToggleFlag('batchEagerLoading');
                      } else if (!flags.btreeIndexing) {
                        handleToggleFlag('btreeIndexing');
                      } else {
                        handleQuickFixAll();
                      }
                      setProactiveToast({
                        title: '🧠 Smart Optimization Applied',
                        message: isBatchMostImpactful
                          ? 'Telemetry analysis identified Batch Eager Loading as the highest-impact fix for the N+1 cascade.'
                          : 'Smart Optimization applied the recommended high-impact fix.',
                        flagToEnable: 'batchEagerLoading',
                        flagName: 'Batch Eager Loading'
                      });
                    }}
                    className={`px-3.5 py-2 font-extrabold text-xs rounded-xl shadow-lg cursor-pointer transition-all flex items-center gap-1.5 border hover:scale-105 active:scale-95 ${
                      isBatchMostImpactful
                        ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-zinc-950 border-amber-200 ring-4 ring-amber-400/40 animate-pulse shadow-amber-950/80'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                    }`}
                    title="Smart telemetry analysis: calculates the most impactful optimization fix for current workload"
                  >
                    <Brain className={`w-3.5 h-3.5 ${isBatchMostImpactful ? 'fill-zinc-950 text-zinc-950' : 'text-amber-300'}`} />
                    <span>Smart Optimization</span>
                    {isBatchMostImpactful && (
                      <span className="text-[9px] font-mono bg-zinc-950 text-amber-300 px-1.5 py-0.2 rounded-full uppercase">
                        Top Impact
                      </span>
                    )}
                  </button>
                );
              })()}
              {hasQuickFixBeenApplied && (
                <button
                  type="button"
                  id="btn-quick-revert-banner"
                  data-testid="btn-quick-revert-banner"
                  onClick={handleQuickRevert}
                  className="px-3.5 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-extrabold text-xs rounded-xl shadow-lg cursor-pointer transition-all flex items-center gap-1.5 border border-rose-400/40 hover:scale-105 active:scale-95 shadow-rose-950/50"
                  title="Instantly undo all optimization flag changes applied by Quick Fix"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-200" />
                  <span>Quick Revert</span>
                </button>
              )}
              <button
                type="button"
                id="btn-fix-dismiss-banner"
                data-testid="btn-fix-dismiss-banner"
                onClick={handleFixAndDismiss}
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-lg cursor-pointer transition-all flex items-center gap-1.5 border border-emerald-400/40 hover:scale-105 active:scale-95 shadow-emerald-950/50"
                title="Automatically fix all optimization flags and dismiss banner"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                <span>Fix & Dismiss</span>
              </button>
              <button
                type="button"
                id="btn-explain-plan-banner"
                data-testid="btn-explain-plan-banner"
                onClick={handleExplainPlanBannerClick}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-500 hover:to-orange-500 text-white font-extrabold text-xs rounded-xl shadow-lg cursor-pointer transition-all flex items-center gap-1.5 border border-amber-400/40 hover:scale-105 active:scale-95 shadow-amber-950/50"
                title="View explain plan filtered to high-latency bottleneck queries"
              >
                <Search className="w-3.5 h-3.5 text-amber-200" />
                <span>Explain Plan</span>
              </button>
              <div className="relative inline-block" id="heatmap-overlay-button-container">
                <button
                  type="button"
                  id="btn-enable-heatmap-overlay-banner"
                  data-testid="btn-enable-heatmap-overlay-banner"
                  onClick={() => {
                    const next = !showQueryIntensityOverlay;
                    setShowQueryIntensityOverlay(next);
                    if (next) {
                      setProactiveToast({
                        title: '🔥 Heatmap Overlay Enabled',
                        message: 'Full-screen semi-transparent Heatmap Overlay activated on table cells.',
                        flagToEnable: 'batchEagerLoading',
                        flagName: 'Batch Eager Loading'
                      });
                    }
                  }}
                  className={`px-3.5 py-2 font-extrabold text-xs rounded-xl shadow-lg cursor-pointer transition-all flex items-center gap-1.5 border hover:scale-105 active:scale-95 ${
                    showQueryIntensityOverlay
                      ? 'bg-gradient-to-r from-orange-600 via-amber-600 to-rose-600 text-white border-amber-300 ring-4 ring-amber-400/40 shadow-orange-950/80 animate-pulse'
                      : 'bg-gradient-to-r from-orange-600 via-amber-600 to-rose-600 hover:from-orange-500 hover:to-rose-500 text-white border-amber-400/40 shadow-orange-950/50'
                  }`}
                  title="Toggle full-screen semi-transparent Heatmap Overlay on VirtualizedTable color-coding cell latency"
                >
                  <Flame className="w-3.5 h-3.5 text-amber-200" />
                  <span>Heatmap Overlay</span>
                  {showQueryIntensityOverlay && (
                    <span className="text-[9px] font-mono bg-amber-400 text-zinc-950 px-1.5 py-0.2 rounded font-black uppercase">
                      ON
                    </span>
                  )}
                </button>

                {/* Compact Heatmap Intensity Scale legend component below the button when enabled */}
                {showQueryIntensityOverlay && (
                  <div
                    id="heatmap-intensity-scale-dropdown"
                    data-testid="heatmap-intensity-scale-dropdown"
                    className="absolute top-full left-0 mt-2 z-50 animate-fadeIn shadow-2xl"
                  >
                    <HeatmapIntensityScale
                      currentLatencyMs={queryResult.executionTimeMs}
                      compact={true}
                      onClose={() => setShowQueryIntensityOverlay(false)}
                    />
                  </div>
                )}
              </div>
              <button
                type="button"
                id="btn-toggle-n1-cascade-overlay"
                data-testid="btn-toggle-n1-cascade-overlay"
                onClick={() => {
                  const next = !showN1CascadeOverlay;
                  setShowN1CascadeOverlay(next);
                  setProactiveToast({
                    title: next ? '⚡ N+1 Cascade Overlay Enabled' : 'N+1 Cascade Overlay Disabled',
                    message: next ? 'Highlighting VirtualizedTable rows exceeding N+1 query thresholds based on serialization logs.' : 'N+1 overlay hidden.',
                    flagToEnable: 'batchEagerLoading',
                    flagName: 'Batch Eager Loading'
                  });
                }}
                className={`relative px-3.5 py-2 font-extrabold text-xs rounded-xl shadow-lg cursor-pointer transition-all flex items-center gap-1.5 border hover:scale-105 active:scale-95 ${
                  showN1CascadeOverlay
                    ? 'bg-gradient-to-r from-rose-600 via-purple-600 to-indigo-600 text-white border-rose-400 ring-4 ring-rose-400/40 animate-pulse shadow-rose-950/80'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                }`}
                title="Toggle dedicated N+1 Cascade Visualization overlay on VirtualizedTable"
              >
                {showN1CascadeOverlay && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3 pointer-events-none">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                  </span>
                )}
                <Layers className={`w-3.5 h-3.5 ${showN1CascadeOverlay ? 'text-white' : 'text-indigo-300'}`} />
                <span>N+1 Cascade Overlay</span>
              </button>
              <button
                type="button"
                id="btn-toggle-export-log-history-panel"
                data-testid="btn-toggle-export-log-history-panel"
                onClick={() => setShowExportLogHistoryPanel(!showExportLogHistoryPanel)}
                className="px-3.5 py-2 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 font-bold text-xs rounded-xl shadow-lg cursor-pointer transition-all flex items-center gap-1.5 border border-indigo-500/40 shadow-indigo-950/50"
                title="Toggle Export Log History panel for quick re-downloads"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-300" />
                <span>Export Log History</span>
              </button>
              <button
                type="button"
                id="btn-toggle-batch-eager-loading-banner"
                data-testid="btn-toggle-batch-eager-loading"
                onClick={() => handleToggleFlag('batchEagerLoading')}
                className="px-4 py-2 bg-gradient-to-r from-amber-400 to-rose-400 hover:from-amber-300 hover:to-rose-300 text-zinc-950 font-extrabold text-xs rounded-xl shadow-lg cursor-pointer transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                title="Toggle batchEagerLoading optimization flag"
              >
                <Zap className="w-4 h-4 fill-zinc-950 text-zinc-950" />
                <span>Toggle batchEagerLoading</span>
              </button>
              <div className="relative">
                {showPdfQueueToast && (
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-900 border border-emerald-500/60 text-emerald-300 px-3 py-1 rounded-xl text-[11px] font-mono font-bold shadow-2xl animate-bounce whitespace-nowrap z-50 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Report queued for generation</span>
                  </div>
                )}
                <button
                  type="button"
                  id="btn-export-pdf-batch-banner"
                  data-testid="btn-export-pdf-batch-banner"
                  onClick={handleExportPdfClick}
                  disabled={isGeneratingDiagnosticPdf}
                  className={`px-3.5 py-2 font-bold rounded-xl text-xs shadow-lg flex items-center gap-2 transition-all ${
                    isPdfGenerationSuccess
                      ? 'ring-4 ring-emerald-400 bg-gradient-to-r from-emerald-600 to-teal-600 scale-105 shadow-emerald-950/80 animate-pulse text-white'
                      : isGeneratingDiagnosticPdf
                      ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white opacity-70 cursor-not-allowed'
                      : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white cursor-pointer hover:scale-105 active:scale-95 hover:animate-pulse'
                  } border border-indigo-400/40 shadow-indigo-950/50`}
                  title="Generates a correlation diagnostic report"
                >
                  {isGeneratingDiagnosticPdf ? (
                    <Loader className="w-3.5 h-3.5 text-indigo-200 animate-spin" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-indigo-200" />
                  )}
                  <span>{isGeneratingDiagnosticPdf ? 'Generating PDF...' : 'Export to PDF'}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-extrabold uppercase ${
                    isGeneratingDiagnosticPdf
                      ? 'bg-amber-500/30 text-amber-200 border border-amber-400/50 animate-pulse'
                      : showPdfQueueToast
                      ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50'
                      : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                  }`}>
                    {isGeneratingDiagnosticPdf ? 'Processing' : showPdfQueueToast ? 'Queued' : 'Ready'}
                  </span>
                </button>
                <div className="relative group inline-flex items-center ml-2">
                  <span
                    id="icon-pdf-export-info"
                    data-testid="icon-pdf-export-info"
                    className="p-1.5 text-indigo-300 hover:text-white cursor-help transition-colors rounded-xl bg-indigo-950/80 border border-indigo-500/40 inline-flex items-center justify-center shadow-xs"
                    title={
                      !flags.batchEagerLoading
                        ? 'Correlation report includes N+1 child query execution timelines, lock-contention histograms, and unbatched cascade metrics (Batch Eager Loading is disabled).'
                        : !flags.btreeIndexing
                        ? 'Correlation report includes table scan overhead curves, missing B-tree index impact analyses, and sequential scan durations.'
                        : 'Correlation report includes multi-panel SLA sparklines, telemetry correlations across active optimization flags, and root-cause recommendations.'
                    }
                  >
                    <Info className="w-4 h-4 text-indigo-300 hover:text-white" />
                  </span>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-2.5 bg-zinc-900 border border-indigo-500/60 text-indigo-100 text-xs font-sans rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center leading-relaxed">
                    {!flags.batchEagerLoading
                      ? 'Correlation report includes N+1 child query execution timelines, lock-contention histograms, and unbatched cascade metrics (Batch Eager Loading is disabled).'
                      : !flags.btreeIndexing
                      ? 'Correlation report includes table scan overhead curves, missing B-tree index impact analyses, and sequential scan durations.'
                      : 'Correlation report includes multi-panel SLA sparklines, telemetry correlations across active optimization flags, and root-cause recommendations.'}
                  </div>
                </div>
                {isGeneratingDiagnosticPdf && (
                  <button
                    type="button"
                    id="btn-cancel-export-pdf"
                    data-testid="btn-cancel-export-pdf"
                    onClick={handleCancelPdfGeneration}
                    className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-xl text-xs shadow transition-all cursor-pointer border border-zinc-700 ml-2"
                    title="Cancel ongoing diagnostic generation"
                  >
                    Cancel
                  </button>
                )}
              </div>
              <div className="relative">
                {showCopyLogsToast && (
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-900 border border-emerald-500 text-emerald-300 px-3 py-1 rounded-xl text-[11px] font-mono font-bold shadow-2xl animate-bounce whitespace-nowrap z-50 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Copied!</span>
                  </div>
                )}
                <button
                  type="button"
                  id="btn-copy-logs-banner"
                  data-testid="btn-copy-logs-banner"
                  onClick={handleCopyLogsToClipboard}
                  className={`p-2 rounded-xl transition-all duration-300 cursor-pointer border relative overflow-hidden ${
                    isCopyingLogs
                      ? 'bg-emerald-900/80 border-emerald-400 text-white scale-110 shadow-lg shadow-emerald-950/80 ring-2 ring-emerald-400/50'
                      : 'text-indigo-300 hover:text-white hover:bg-indigo-800/40 border-transparent hover:border-indigo-400/50'
                  }`}
                  title={`System Bottleneck State Preview:\n• Current Latency: ${queryResult.executionTimeMs.toFixed(1)}ms | N+1 Cascade: ${queryResult.activeQueries || 101} queries\n• Click to copy diagnostic payload containing serialized N+1 cascade metadata useful for support tickets`}
                >
                  {isCopyingLogs && (
                    <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 36 36">
                      <path
                        className="text-emerald-500/30"
                        strokeWidth="3"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-emerald-400 transition-all duration-200"
                        strokeDasharray={`${copyProgressPercent}, 100`}
                        strokeWidth="3"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                  )}
                  <Clipboard className={`w-4 h-4 transition-transform duration-300 relative z-10 ${isCopyingLogs ? 'scale-125 text-emerald-300 animate-pulse' : ''}`} />
                </button>
                <button
                  type="button"
                  id="btn-configure-csv-columns-banner"
                  data-testid="btn-configure-csv-columns-banner"
                  onClick={() => setIsCsvColumnsModalOpen(true)}
                  className="px-2.5 py-1.5 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 hover:border-indigo-400 text-indigo-200 hover:text-white rounded-xl text-xs font-mono font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 shadow-xs ml-1"
                  title="Configure CSV Columns: Select which specific metrics are included in generated diagnostic CSV reports"
                >
                  <Sliders className="w-3.5 h-3.5 text-indigo-300" />
                  <span>Configure CSV Columns</span>
                </button>
                <button
                  type="button"
                  id="btn-export-diagnostics-csv-banner"
                  data-testid="btn-export-diagnostics-csv-banner"
                  onClick={handleExportDiagnosticsCsv}
                  className="p-2 text-indigo-300 hover:text-white hover:bg-indigo-800/40 rounded-xl transition-all duration-300 cursor-pointer border border-transparent hover:border-indigo-400/50 ml-1"
                  title="Export Diagnostics to CSV: Serialize current queryResult metrics and flags to a downloadable CSV"
                >
                  <FileSpreadsheet className="w-4 h-4 text-indigo-300 hover:text-white" />
                </button>
                <button
                  type="button"
                  id="btn-export-logs-csv-banner"
                  data-testid="btn-export-logs-csv-banner"
                  onClick={handleExportSerializationLogsCsv}
                  className="p-2 text-indigo-300 hover:text-white hover:bg-indigo-800/40 rounded-xl transition-all duration-300 cursor-pointer border border-transparent hover:border-indigo-400/50"
                  title="Export current serialization logs to CSV format"
                >
                  <FileSpreadsheet className="w-4 h-4 text-indigo-300" />
                </button>
                <button
                  type="button"
                  id="btn-snapshot-state-banner"
                  data-testid="btn-snapshot-state-banner"
                  onClick={handleQuickSnapshot}
                  className="p-2 text-indigo-300 hover:text-white hover:bg-indigo-800/40 rounded-xl transition-all duration-300 cursor-pointer border border-transparent hover:border-indigo-400/50 ml-1"
                  title="Record current system metrics into the Historical Data Tape"
                >
                  <Camera className="w-4 h-4 text-indigo-300" />
                </button>
                <button
                  type="button"
                  id="btn-export-flag-events-json"
                  data-testid="btn-export-flag-events-json"
                  onClick={handleExportFlagToggleEventsJson}
                  className="p-2 text-indigo-300 hover:text-white hover:bg-indigo-800/40 rounded-xl transition-all duration-300 cursor-pointer border border-transparent hover:border-indigo-400/50 ml-1"
                  title="Export session optimization flag toggle events to structured JSON log for advanced debugging"
                >
                  <FileJson className="w-4 h-4 text-indigo-300" />
                </button>
              </div>
              <div className="relative">
                {showDismissConfirmation && (
                  <div className="absolute -top-52 right-0 bg-zinc-900 border border-rose-500/80 text-white p-4 rounded-2xl text-xs shadow-2xl z-50 w-80 space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between font-extrabold text-rose-300">
                      <span>⚠️ Confirm Banner Dismissal</span>
                      <button onClick={() => setShowDismissConfirmation(false)} className="text-zinc-400 hover:text-white cursor-pointer">✕</button>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-relaxed">
                      Select suppression duration for this critical alert:
                    </p>
                    <div className="space-y-1.5 bg-zinc-950/70 p-2.5 rounded-xl border border-zinc-800">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs text-zinc-200">
                        <input
                          type="radio"
                          name="dismissal-duration"
                          value="5min"
                          checked={dismissalDuration === '5min'}
                          onChange={() => setDismissalDuration('5min')}
                          className="accent-rose-500 w-4 h-4 cursor-pointer"
                        />
                        <span>Suppress for <strong>5 minutes</strong></span>
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs text-zinc-200">
                        <input
                          type="radio"
                          name="dismissal-duration"
                          value="1hour"
                          checked={dismissalDuration === '1hour'}
                          onChange={() => setDismissalDuration('1hour')}
                          className="accent-rose-500 w-4 h-4 cursor-pointer"
                        />
                        <span>Suppress for <strong>1 hour</strong></span>
                      </label>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setShowDismissConfirmation(false)}
                        className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-[11px] font-bold cursor-pointer transition-colors"
                      >
                        Keep Banner
                      </button>
                      <button
                        type="button"
                        id="btn-confirm-dismiss-duration"
                        data-testid="btn-confirm-dismiss-duration"
                        onClick={handleConfirmDismiss}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[11px] font-extrabold cursor-pointer shadow-md transition-all"
                      >
                        Confirm Dismiss ({dismissalDuration === '1hour' ? '1h' : '5m'})
                      </button>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  id="btn-pin-batch-banner"
                  data-testid="btn-pin-batch-banner"
                  onClick={handleTogglePinBanner}
                  className={`p-2 rounded-xl transition-colors cursor-pointer border ${
                    isBannerPinned
                      ? 'bg-amber-500/30 text-amber-300 border-amber-400'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800 border-transparent'
                  }`}
                  title={isBannerPinned ? 'Unpin banner (Allows dismissal & auto-hide)' : 'Pin banner (Prevents dismissal and auto-hide)'}
                >
                  <Pin className={`w-4 h-4 ${isBannerPinned ? 'fill-amber-300 text-amber-300 rotate-45' : ''}`} />
                </button>
                <button
                  type="button"
                  id="btn-copy-diagnostics-banner"
                  data-testid="btn-copy-diagnostics-banner"
                  onClick={handleCopyLogsToClipboard}
                  className="p-2 text-indigo-300 hover:text-white hover:bg-indigo-800/40 rounded-xl transition-all duration-300 cursor-pointer border border-transparent hover:border-indigo-400/50"
                  title="Stringifies the current query diagnostics for external reporting"
                >
                  <Clipboard className="w-4 h-4 text-indigo-300" />
                </button>
                <button
                  type="button"
                  id="btn-export-pdf-correlation-report"
                  data-testid="btn-export-pdf-correlation-report"
                  onClick={() => setShowPdfPreviewModal(true)}
                  className="px-3.5 py-2 font-bold rounded-xl text-xs shadow-lg flex items-center gap-2 transition-all bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white cursor-pointer hover:scale-105 active:scale-95 border border-indigo-400/40 shadow-indigo-950/50 mr-2"
                  title="Generates a correlation diagnostic report"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-200" />
                  <span>Export to PDF</span>
                </button>
                <button
                  type="button"
                  id="btn-dismiss-batch-eager-loading-banner"
                  data-testid="btn-dismiss-batch-eager-loading-banner"
                  onClick={() => setShowDismissConfirmation(!showDismissConfirmation)}
                  className="p-2 text-rose-300 hover:text-white hover:bg-rose-800/40 rounded-xl transition-colors cursor-pointer"
                  title="Dismiss notification banner (Suppress for 5 minutes)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {activeView === 'grid' ? (
          <>
            <div id="explain-plan-viewer-section">
              <ExplainPlanViewer
                result={queryResult}
                explainPlan={queryResult.explainPlan}
                flags={flags}
                statusFilter={statusFilter}
                categoryFilter={selectedCategory}
                searchTerm={searchQuery}
                cacheTtl={cacheTtlSeconds}
                onCacheTtlChange={handleCacheTtlChange}
                onPurgeCache={handlePurgePlanCache}
                onRefreshPlan={() => setRefreshKey((k) => k + 1)}
              />
            </div>

            <LatencyLegend showLatencyHeatmap={showLatencyHeatmap} />

            <VirtualizedTable
              records={queryResult.records}
              totalCount={queryResult.totalCount}
              flags={flags}
              searchTerm={searchQuery}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedCategory={selectedCategory}
              categoryFilter={selectedCategory}
              onCategoryChange={setSelectedCategory}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              virtualizedEnabled={flags.virtualizedDOM}
              simulatedError={queryResult.simulatedError}
              warningNotice={queryResult.warningNotice}
              showLatencyHeatmapProp={showLatencyHeatmap}
              onToggleLatencyHeatmap={setShowLatencyHeatmap}
              showN1CascadeOverlay={showN1CascadeOverlay}
              onFixNPlusOne={() => setFlags((prev) => ({ ...prev, batchEagerLoading: true }))}
              onAutoOptimize={() => setFlags({
                batchEagerLoading: true,
                btreeIndexing: true,
                queryCaching: true,
                virtualizedDOM: true,
                deferredRendering: true
              })}
              onOpenBulkImport={() => setIsBulkImportOpen(true)}
              cacheHit={queryResult.cacheHit}
              executionTimeMs={queryResult.executionTimeMs}
            />

            <div id="serialization-error-log-section">
              <SerializationErrorLogPanel
                logs={serializationLogs}
                onClearLogs={() => setSerializationLogs([])}
                onDismissLog={(id) => setSerializationLogs((prev) => prev.filter((l) => l.id !== id))}
                onSimulateFault={() => {}}
                currentFormat="csv"
                currentRecordCount={queryResult.totalCount || 50000}
                alertThresholdMs={alertThresholdMs}
                records={queryResult.records}
                flags={flags}
              />
            </div>
          </>
        ) : activeView === 'comparison' ? (
          <LatencyComparisonView
            trendHistory={trendHistory}
            onClose={() => setActiveView('grid')}
          />
        ) : activeView === 'schema' ? (
          <DatabaseSchemaExplorerView
            flags={flags}
            onToggleFlag={handleToggleFlag}
            onClose={() => setActiveView('grid')}
            lowUsageThresholds={lowUsageThresholds}
          />
        ) : (
          <PerformanceTrendsView
            trendHistory={trendHistory}
            currentFlags={flags}
            onToggleFlag={handleToggleFlag}
            onApplyFlags={setFlags}
            onToggleAll={(enable) => setFlags({
              batchEagerLoading: enable,
              btreeIndexing: enable,
              queryCaching: enable,
              virtualizedDOM: enable,
              deferredRendering: enable
            })}
            onClearHistory={() => setTrendHistory([])}
            onRunOptimizationSequence={handleRunOptimizationSequence}
            isSimulatingSequence={isSimulatingSequence}
            onAppendTrendPoint={(point) => setTrendHistory((prev) => [...prev, point])}
            thresholdViolations={thresholdViolationsHistory}
            mutationThreshold={mutationThreshold}
            mutationHistory={mutationHistory}
            dataTapeEntries={dataTapeEntries}
            alertThresholdMs={alertThresholdMs}
            onAlertThresholdChange={(val) => setAlertThresholdMs(val)}
            onFilterVirtualizedTable={(query) => setSearchQuery(query)}
            onNavigateToGrid={() => setActiveView('grid')}
          />
        )}
      </main>

      {/* Modals */}
      <BenchmarkModal
        isOpen={isBenchmarkModalOpen}
        onClose={() => setIsBenchmarkModalOpen(false)}
        currentFlags={flags}
        onApplyFlags={setFlags}
      />

      <PerformanceTrendsView
        isOpen={isPerformanceTrendsOpen}
        onClose={() => setIsPerformanceTrendsOpen(false)}
        trendHistory={trendHistory}
        currentFlags={flags}
        onToggleFlag={handleToggleFlag}
        onApplyFlags={setFlags}
        onToggleAll={(enable) => setFlags({
          batchEagerLoading: enable,
          btreeIndexing: enable,
          queryCaching: enable,
          virtualizedDOM: enable,
          deferredRendering: enable
        })}
        onClearHistory={() => setTrendHistory([])}
        onRunOptimizationSequence={handleRunOptimizationSequence}
        isSimulatingSequence={isSimulatingSequence}
        onAppendTrendPoint={(point) => setTrendHistory((prev) => [...prev, point])}
        thresholdViolations={thresholdViolationsHistory}
        mutationThreshold={mutationThreshold}
        mutationHistory={mutationHistory}
        dataTapeEntries={dataTapeEntries}
        alertThresholdMs={alertThresholdMs}
        onAlertThresholdChange={(val) => setAlertThresholdMs(val)}
      />

      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onImportComplete={(res: BulkImportResult) => {
          // Trigger refresh
          setPage(1);
        }}
      />

      <HistoricalDataTapeModal
        isOpen={isHistoricalDataTapeOpen}
        onClose={() => {
          setIsHistoricalDataTapeOpen(false);
          setHistoryTapeFilterMode('all');
        }}
        entries={
          historyTapeFilterMode === 'latency-5min'
            ? dataTapeEntries.filter(e => e.timestamp >= Date.now() - 5 * 60 * 1000 && (e.triggerEvent.toLowerCase().includes('latency') || e.triggerEvent.toLowerCase().includes('spike') || e.triggerEvent.toLowerCase().includes('batch') || e.triggerEvent.toLowerCase().includes('slow')))
            : dataTapeEntries
        }
        initialEntries={dataTapeEntries}
        initialSelectedEntry={selectedTapeEntry}
        initialSearchTerm={historyTapeFilterMode === 'latency-5min' ? 'latency' : ''}
        onClearTape={() => setDataTapeEntries([])}
      />

      <DiagnosticPdfPreviewModal
        isOpen={showPdfPreviewModal}
        onClose={() => setShowPdfPreviewModal(false)}
        onDownload={handleGenerateDiagnosticCorrelationPdf}
        isDownloading={isGeneratingDiagnosticPdf}
        isDownloadSuccess={isDiagnosticPdfSuccess}
        thresholdViolations={thresholdViolationsHistory}
        mutationHistory={mutationHistory}
        trendHistory={trendHistory}
        mutationThreshold={mutationThreshold}
        currentFlags={flags}
        sectionsConfig={pdfExportSections}
        onUpdateSections={setPdfExportSections}
      />

      {/* Pre-Export Preview Modal for CSV/JSON */}
      <ExportPreviewModal
        isOpen={isAppExportPreviewOpen}
        onClose={() => setIsAppExportPreviewOpen(false)}
        records={queryResult.records}
        initialFormat="csv"
        filenamePrefix="database_query_records"
        onConfirmExport={handleConfirmAppExport}
      />

      {/* Configure CSV Columns Modal */}
      {isCsvColumnsModalOpen && (
        <div
          id="modal-configure-csv-columns"
          data-testid="modal-configure-csv-columns"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn font-sans"
        >
          <div className="bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-zinc-700 text-white animate-scaleUp">
            <div className="p-5 bg-gradient-to-r from-zinc-900 via-indigo-950 to-zinc-900 flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600/30 border border-indigo-500/40 rounded-xl text-indigo-300">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white tracking-wide">Configure CSV Diagnostic Columns</h3>
                  <p className="text-xs text-zinc-400">Select which metrics are included in generated CSV reports</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCsvColumnsModalOpen(false)}
                className="text-zinc-400 hover:text-white cursor-pointer p-1"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { id: 'latency', label: 'Execution Latency (ms)', desc: 'Query execution time and thresholds' },
                { id: 'totalRecords', label: 'Total Records Scanned', desc: 'Row count scanned during execution' },
                { id: 'cacheHit', label: 'Cache Hit Status', desc: 'Whether query result was served from cache' },
                { id: 'queryCount', label: 'N+1 Cascaded Query Count', desc: 'Active child queries and cascade count' },
                { id: 'errorStatus', label: 'System Error Status', desc: 'Active system errors or simulated faults' },
                { id: 'flags', label: 'Optimization Flags State', desc: 'Boolean state of all engine flags' }
              ].map((item) => {
                const isSelected = selectedCsvMetrics.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-500/60 text-white shadow-xs'
                        : 'bg-zinc-950/50 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...selectedCsvMetrics, item.id]
                          : selectedCsvMetrics.filter((m) => m !== item.id);
                        setSelectedCsvMetrics(next);
                        try {
                          localStorage.setItem('enterprise_diagnostic_csv_columns', JSON.stringify(next));
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className="mt-0.5 w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <span className="font-bold text-xs block text-white">{item.label}</span>
                      <span className="text-[11px] text-zinc-400 block leading-tight">{item.desc}</span>
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between">
              <div className="text-[11px] font-mono text-zinc-400">
                {selectedCsvMetrics.length} of 6 metric columns selected
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const all = ['latency', 'totalRecords', 'cacheHit', 'queryCount', 'errorStatus', 'flags'];
                    setSelectedCsvMetrics(all);
                    try {
                      localStorage.setItem('enterprise_diagnostic_csv_columns', JSON.stringify(all));
                    } catch (err) {}
                  }}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-xl font-bold cursor-pointer transition-colors"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setIsCsvColumnsModalOpen(false)}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs rounded-xl shadow cursor-pointer transition-all"
                >
                  Save & Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <DiagnosticExportHistoryModal
        isOpen={isExportHistoryModalOpen}
        onClose={() => setIsExportHistoryModalOpen(false)}
        historyItems={pdfExportHistory}
        onReDownload={handleReDownloadHistoryItem}
        onClearHistory={handleClearPdfHistory}
        onDeleteItem={handleDeletePdfHistoryItem}
      />

      {/* System Resource Monitor Widget */}
      <SystemResourceMonitor
        flags={flags}
        recordCount={queryResult.totalCount}
        cacheHit={queryResult.cacheHit}
        onAutoCaptureSnapshot={handleAutoCaptureSnapshot}
      />

      {/* Optimization Wizard Modal */}
      <OptimizationWizardModal
        isOpen={isOptimizationWizardOpen}
        onClose={() => setIsOptimizationWizardOpen(false)}
        flags={flags}
        queryResult={queryResult}
        onApplyFlags={(newFlags) => setFlags(newFlags)}
      />

      {/* Global Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
        flags={flags}
        onToggleFlag={handleToggleFlag}
        onToggleAll={(enable) => setFlags({
          batchEagerLoading: enable,
          btreeIndexing: enable,
          queryCaching: enable,
          virtualizedDOM: enable,
          deferredRendering: enable
        })}
        onOpenBenchmark={() => setIsBenchmarkModalOpen(true)}
      />

      {/* Database Bottleneck Heatmap Drawer */}
      <DatabaseBottleneckHeatmapDrawer
        isOpen={isBottleneckDrawerOpen}
        onClose={() => setIsBottleneckDrawerOpen(false)}
        flags={flags}
        onToggleFlag={handleToggleFlag}
        queryResult={queryResult}
        trendHistory={trendHistory}
      />

      {/* Visual SQL Query Builder & Optimizer Modal */}
      <VisualQueryBuilderModal
        isOpen={isVisualQueryBuilderOpen}
        onClose={() => setIsVisualQueryBuilderOpen(false)}
        flags={flags}
        onExecuteBuiltQuery={(sql) => {
          console.log('Executing built query:', sql);
        }}
      />

      {/* Shortcut Execution Feedback Toast */}
      {shortcutToast && (
        <div
          id="toast-shortcut-execution"
          data-testid="toast-shortcut-execution"
          className="fixed bottom-6 right-6 z-50 bg-zinc-900/95 backdrop-blur-md border border-zinc-700 text-white px-4 py-2.5 rounded-xl shadow-2xl animate-metric-slide-up flex items-center gap-3 ring-2 ring-amber-400/20"
        >
          <div className={`p-1.5 rounded-lg border ${
            shortcutToast.enabled
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
          }`}>
            <Zap className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="font-semibold text-zinc-100 flex items-center gap-2">
              <span>Hotkey Registered</span>
              <kbd className="font-mono text-[10px] bg-zinc-950 text-amber-300 border border-zinc-700 px-1.5 py-0.2 rounded font-bold shadow-2xs">
                {shortcutToast.combo}
              </kbd>
            </div>
            <div className="text-zinc-300 text-[11px] mt-0.5">
              {shortcutToast.flagName}:{' '}
              <span className={`font-mono font-bold ${
                shortcutToast.enabled ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {shortcutToast.enabled ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShortcutToast(null)}
            className="text-zinc-500 hover:text-white p-1 rounded-md transition-colors cursor-pointer ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Proactive Optimization Suggestion Toast */}
      {proactiveToast && !notificationsMuted && (
        <div
          id="proactive-optimization-toast"
          data-testid="proactive-optimization-toast"
          className="fixed bottom-6 left-6 z-50 bg-zinc-900 border border-zinc-700 text-white p-4 rounded-xl shadow-2xl max-w-md animate-fadeIn flex items-start gap-3"
        >
          <div className="p-2 bg-amber-500/20 border border-amber-500/40 text-amber-400 rounded-lg shrink-0">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-bold text-white flex items-center justify-between">
              <span>{proactiveToast.title}</span>
              <button
                type="button"
                id="btn-proactive-close"
                data-testid="btn-proactive-close"
                onClick={() => setProactiveToast(null)}
                className="text-zinc-400 hover:text-white cursor-pointer p-0.5"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </h4>
            <p className="text-xs text-zinc-300 mt-0.5">
              {proactiveToast.message}
              {proactiveToast.flagName && (
                <>
                  {' '}Proactively suggest enabling <strong className="text-amber-300">{proactiveToast.flagName}</strong> to optimize performance.
                </>
              )}
            </p>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {proactiveToast.flagToEnable && (
                <button
                  type="button"
                  id="btn-proactive-enable-flag"
                  data-testid="btn-proactive-enable-flag"
                  onClick={() => {
                    if (proactiveToast.flagToEnable) {
                      setFlags((prev) => ({ ...prev, [proactiveToast.flagToEnable!]: true }));
                    }
                    setProactiveToast(null);
                  }}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Enable {proactiveToast.flagName} Now
                </button>
              )}
              <button
                type="button"
                id="btn-proactive-dismiss"
                data-testid="btn-proactive-dismiss"
                onClick={() => setProactiveToast(null)}
                className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition-colors cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                id="btn-mute-all-notifications"
                data-testid="btn-mute-all-notifications"
                onClick={handleMuteAllNotifications}
                className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 hover:text-white border border-zinc-700 text-zinc-300 text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                title="Persist mute state in localStorage to prevent all further proactive notification toasts"
              >
                <BellOff className="w-3.5 h-3.5 text-zinc-400" />
                <span>Mute All Notifications</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Performance Anomaly Toast */}
      {anomalyToast && !notificationsMuted && (
        <div
          id="toast-performance-anomaly"
          data-testid="toast-performance-anomaly performance-anomaly-toast"
          className="fixed bottom-6 right-6 z-50 bg-gradient-to-br from-zinc-950 via-rose-950/95 to-zinc-900 border-2 border-rose-500/80 text-white p-4 rounded-2xl shadow-2xl max-w-md animate-fadeIn flex items-start gap-3.5 ring-4 ring-rose-500/20"
        >
          <div className="p-2.5 bg-rose-600 text-white rounded-xl shrink-0 shadow-md animate-bounce">
            <TrendingUp className="w-5 h-5 text-amber-200" />
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-extrabold text-white flex items-center justify-between">
              <span className="flex items-center gap-1.5 uppercase tracking-wide text-rose-300">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                Performance Anomaly
              </span>
              <button
                type="button"
                id="btn-anomaly-dismiss"
                data-testid="btn-anomaly-dismiss"
                onClick={() => setAnomalyToast(null)}
                className="text-zinc-400 hover:text-white cursor-pointer p-0.5 rounded transition-colors"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </h4>

            <div className="mt-1.5 space-y-1.5">
              <p className="text-xs text-zinc-200 leading-relaxed">
                Slope exceeded threshold: <strong className="text-rose-400 font-mono">+{anomalyToast.slope.toFixed(1)}ms/step</strong> over 3 consecutive data points (<span className="font-mono text-[11px] text-amber-300">{anomalyToast.points.map((p) => p.toFixed(1) + 'ms').join(' → ')}</span>).
              </p>
              <div className="p-2.5 bg-rose-950/70 rounded-xl border border-rose-800/70 text-[11px] text-rose-100">
                <strong className="text-amber-300 font-semibold block mb-0.5">Recommendation:</strong>
                {anomalyToast.recommendation}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {anomalyToast.flagToEnable && (
                <button
                  type="button"
                  id="btn-anomaly-apply-fix"
                  data-testid="btn-anomaly-apply-fix"
                  onClick={() => {
                    if (anomalyToast.flagToEnable) {
                      handleToggleFlag(anomalyToast.flagToEnable);
                    }
                    setAnomalyToast(null);
                  }}
                  className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-zinc-950 font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-sm active:scale-95"
                >
                  <Zap className="w-3.5 h-3.5 text-zinc-950" />
                  <span>Enable {anomalyToast.flagName} Now</span>
                </button>
              )}
              <button
                type="button"
                id="btn-anomaly-close"
                data-testid="btn-anomaly-close"
                onClick={() => setAnomalyToast(null)}
                className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition-colors cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                id="btn-mute-anomaly-notifications"
                data-testid="btn-mute-anomaly-notifications"
                onClick={handleMuteAllNotifications}
                className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 hover:text-white border border-zinc-700 text-zinc-300 text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                title="Persist mute state in localStorage to prevent all further notifications"
              >
                <BellOff className="w-3.5 h-3.5 text-zinc-400" />
                <span>Mute All</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
