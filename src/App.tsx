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
import { AlertTriangle, X, Flame, Zap, BellOff, TrendingUp, FileText, Loader, Sparkles, Search, Clipboard } from 'lucide-react';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import {
  exportRecordsToCsv,
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

  const handleToggleAutoResolveSpike = (enabled: boolean) => {
    setIsAutoResolveOnSpikeEnabled(enabled);
    try {
      localStorage.setItem('enterprise_auto_resolve_spike', String(enabled));
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportPdfClick = () => {
    try {
      setIsGeneratingDiagnosticPdf(true);
      setShowPdfQueueToast(true);
      setShowPdfPreviewModal(true);
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
      setPdfErrorToast('Diagnostic report generation failed. Please try again.');
      setTimeout(() => {
        setPdfErrorToast(null);
      }, 3500);
    }
  };

  const handleCancelPdfGeneration = () => {
    setIsGeneratingDiagnosticPdf(false);
    setShowPdfQueueToast(false);
    setShowPdfPreviewModal(false);
    setPdfErrorToast('PDF diagnostic report generation cancelled.');
    setTimeout(() => setPdfErrorToast(null), 3000);
  };

  const handleQuickFixAll = () => {
    setFlags({
      batchEagerLoading: true,
      btreeIndexing: true,
      queryCaching: true,
      virtualizedDOM: true,
      deferredRendering: true
    });
    setIsBatchBannerDismissed(true);
    setProactiveToast({
      title: '⚡ Quick Fix All Applied',
      message: 'All optimization flags have been enabled simultaneously to resolve workload bottlenecks.',
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

  const handleCopyLogsToClipboard = () => {
    try {
      setIsCopyingLogs(true);
      const logData = JSON.stringify({
        timestamp: new Date().toISOString(),
        executionTimeMs: queryResult.executionTimeMs,
        flags,
        explainPlanSummary: queryResult.explainPlan?.summary || 'N+1 cascade detected',
        totalCount: queryResult.totalCount,
        queryType: queryResult.queryType || 'SELECT'
      }, null, 2);
      navigator.clipboard.writeText(logData);
      setShowCopyLogsToast(true);
      setTimeout(() => {
        setShowCopyLogsToast(false);
        setIsCopyingLogs(false);
      }, 1500);
    } catch (e) {
      setIsCopyingLogs(false);
      console.error(e);
    }
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

  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const interval = setInterval(() => {
      setRefreshKey((k) => k + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefreshEnabled]);

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

  const handleViewRelatedHistory = () => {
    setHistoryTapeFilterMode('latency-5min');
    setIsHistoricalDataTapeOpen(true);
  };
  const [isBatchBannerDismissed, setIsBatchBannerDismissed] = useState(false);
  const [showDismissConfirmation, setShowDismissConfirmation] = useState(false);
  const [batchBannerDismissedUntil, setBatchBannerDismissedUntil] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('enterprise_batch_banner_dismissed_until');
      return saved ? Number(saved) : 0;
    } catch {
      return 0;
    }
  });

  const handleConfirmDismiss5Min = () => {
    const until = Date.now() + 5 * 60 * 1000;
    setBatchBannerDismissedUntil(until);
    try {
      localStorage.setItem('enterprise_batch_banner_dismissed_until', String(until));
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
    if (!isBatchBannerDismissed && !flags.batchEagerLoading && queryResult.executionTimeMs > 200 && isAutoResolveOnSpikeEnabled) {
      handleToggleFlag('batchEagerLoading');
      setIsBatchBannerDismissed(true);
      setProactiveToast({
        title: '⚡ Auto-Resolved on Spike',
        message: 'Latency threshold breached while Auto-Resolve on Spike was active. batchEagerLoading was automatically enabled.',
        flagToEnable: 'batchEagerLoading',
        flagName: 'Batch Eager Loading'
      });
    }
  }, [queryResult.executionTimeMs, flags.batchEagerLoading, isBatchBannerDismissed, isAutoResolveOnSpikeEnabled]);

  const handleToggleFlag = (key: keyof OptimizationFlags) => {
    setFlags((prev) => {
      const nextState = !prev[key];
      const nextFlags = { ...prev, [key]: nextState };

      const now = Date.now();
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

    const windowSec = extendedAlertThresholds.anomalyTrendWindowSec || 15;
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
    const SLOPE_THRESHOLD_PER_SEC = 1.5;
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
  }, [trendHistory, flags, extendedAlertThresholds, notificationsMuted]);

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

  const handleExportCsv = () => {
    exportRecordsToCsv(queryResult.records);
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
          <div className="p-4 bg-gradient-to-r from-rose-950 via-amber-950 to-zinc-950 text-white rounded-2xl border-2 border-rose-500 shadow-2xl flex items-center justify-between gap-4 animate-fadeIn relative z-40 ring-4 ring-rose-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-md animate-bounce">
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
            <button
              type="button"
              onClick={() => setShowQueryIntensityOverlay(false)}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-colors"
            >
              Disable Overlay
            </button>
          </div>
        )}

        {/* Conditional Notification Banner: batchEagerLoading is false and latency exceeds 200ms */}
        {!isBatchBannerDismissed && Date.now() > batchBannerDismissedUntil && !flags.batchEagerLoading && queryResult.executionTimeMs > 200 && (
          <div
            id="banner-batch-eager-loading-latency"
            data-testid="banner-batch-eager-loading-latency"
            className="p-4 bg-gradient-to-r from-rose-900 via-rose-950 to-amber-950 text-white rounded-2xl border-2 border-rose-500 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fadeIn relative z-40 ring-4 ring-rose-500/20"
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
                    Latency: {queryResult.executionTimeMs.toFixed(1)} ms (&gt; 200ms threshold)
                  </span>
                  <span className="font-mono text-[10px] bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full font-semibold">
                    flag: batchEagerLoading = false
                  </span>
                  <div className="flex items-center gap-1.5 bg-rose-950/80 px-2 py-1 rounded-lg border border-rose-500/40 shrink-0" title="Recent latency trend leading up to breach">
                    <span className="text-[9px] font-mono text-rose-300">Trend:</span>
                    <svg width={50} height={18} className="overflow-visible">
                      {(() => {
                        const points = (trendHistory || []).slice(-6);
                        const lats = points.length >= 2 ? points.map(p => p.executionTimeMs) : [120, 150, 190, 240, 280, queryResult.executionTimeMs];
                        const min = Math.min(...lats);
                        const max = Math.max(...lats, min + 1);
                        const coords = lats.map((v, i) => {
                          const x = (i / (lats.length - 1)) * 44;
                          const y = 16 - ((v - min) / (max - min || 1)) * 12 - 2;
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        }).join(' ');
                        return (
                          <polyline
                            fill="none"
                            stroke="#f87171"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={coords}
                          />
                        );
                      })()}
                    </svg>
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
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-900 border border-emerald-500/60 text-emerald-300 px-3 py-1 rounded-xl text-[11px] font-mono font-bold shadow-2xl animate-bounce whitespace-nowrap z-50 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Logs copied to clipboard</span>
                  </div>
                )}
                <button
                  type="button"
                  id="btn-copy-logs-banner"
                  data-testid="btn-copy-logs-banner"
                  onClick={handleCopyLogsToClipboard}
                  className={`p-2 rounded-xl transition-all duration-300 cursor-pointer border ${
                    isCopyingLogs
                      ? 'bg-emerald-800/60 border-emerald-400 text-white scale-110 shadow-lg shadow-emerald-950/50'
                      : 'text-indigo-300 hover:text-white hover:bg-indigo-800/40 border-transparent hover:border-indigo-400/50'
                  }`}
                  title={`System Bottleneck State Preview:\n• Current Latency: ${queryResult.executionTimeMs.toFixed(1)}ms | N+1 Cascade: ${queryResult.activeQueries || 101} queries\n• Click to stringify diagnostics for external reporting`}
                >
                  <Clipboard className={`w-4 h-4 transition-transform duration-300 ${isCopyingLogs ? 'scale-125 text-emerald-300 animate-pulse' : ''}`} />
                </button>
              </div>
              <div className="relative">
                {showDismissConfirmation && (
                  <div className="absolute -top-28 right-0 bg-zinc-900 border border-rose-500/80 text-white p-3 rounded-xl text-xs shadow-2xl z-50 w-64 space-y-2 animate-fadeIn">
                    <div className="font-extrabold text-rose-300">Dismiss banner?</div>
                    <p className="text-[11px] text-zinc-300">Suppress this warning and do not show again for 5 minutes during troubleshooting.</p>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowDismissConfirmation(false)}
                        className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[11px] font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        id="btn-confirm-dismiss-5min"
                        data-testid="btn-confirm-dismiss-5min"
                        onClick={handleConfirmDismiss5Min}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-bold cursor-pointer shadow"
                      >
                        Confirm (5m)
                      </button>
                    </div>
                  </div>
                )}
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
