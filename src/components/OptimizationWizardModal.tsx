import React, { useState } from 'react';
import { Sparkles, CheckCircle2, AlertTriangle, ArrowRight, Layers, Database, Gauge, Eye, Cpu, X, Check, Zap, ArrowLeftRight } from 'lucide-react';
import { OptimizationFlags, QueryExecutionResult } from '../types';

interface OptimizationWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  flags: OptimizationFlags;
  queryResult: QueryExecutionResult;
  onApplyFlags: (newFlags: OptimizationFlags) => void;
}

export const OptimizationWizardModal: React.FC<OptimizationWizardModalProps> = ({
  isOpen,
  onClose,
  flags,
  queryResult,
  onApplyFlags
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [wizardFlags, setWizardFlags] = useState<OptimizationFlags>({ ...flags });
  const [activeTab, setActiveTab] = useState<'checklist' | 'simulation'>('checklist');

  if (!isOpen) return null;

  const avgLatency = queryResult.executionTimeMs || 468.4;

  const steps = [
    {
      id: 'btree',
      title: '1. Composite B-Tree Indexing',
      category: 'Database Query Optimizer',
      flagKey: 'btreeIndexing' as keyof OptimizationFlags,
      description: 'Eliminate full sequential table scans across 50,000+ records. Composite indexes on (status, category) reduce row lookups from O(n) to O(log n).',
      status: wizardFlags.btreeIndexing ? 'Optimized' : 'Bottleneck Detected',
      recommendation: 'Enable B-Tree Indexing to reduce latency by up to 1,200ms.'
    },
    {
      id: 'eager',
      title: '2. Batch Eager Loading (N+1 Fix)',
      category: 'Database Connection Pool',
      flagKey: 'batchEagerLoading' as keyof OptimizationFlags,
      description: 'Prevent N+1 subquery cascades that exhaust database connections (25+ connections timeout). Batched IN clauses reduce roundtrips from 100+ to 2.',
      status: wizardFlags.batchEagerLoading ? 'Optimized' : 'Critical Bottleneck',
      recommendation: 'Enable Batch Eager Loading to stabilize connection pools.'
    },
    {
      id: 'caching',
      title: '3. LRU In-Memory Query Cache',
      category: 'Memory Cache Layer',
      flagKey: 'queryCaching' as keyof OptimizationFlags,
      description: 'Cache repeated query result sets in memory. Repeat queries execute in under 0.15ms via instant cache hits.',
      status: wizardFlags.queryCaching ? 'Optimized' : 'Recommended',
      recommendation: 'Enable LRU Query Cache for repeat query acceleration.'
    },
    {
      id: 'virtualization',
      title: '4. DOM List Virtualization',
      category: 'Frontend UI Rendering',
      flagKey: 'virtualizedDOM' as keyof OptimizationFlags,
      description: 'Render only the ~14 visible viewport rows rather than 2,000+ DOM cards simultaneously, maintaining a locked 60 FPS frame rate.',
      status: wizardFlags.virtualizedDOM ? 'Optimized' : 'Lag Warning',
      recommendation: 'Enable DOM Virtualization to prevent browser freezing.'
    },
    {
      id: 'deferred',
      title: '5. Concurrent Deferred Transitions',
      category: 'UI Concurrency',
      flagKey: 'deferredRendering' as keyof OptimizationFlags,
      description: 'Leverage React 19 useDeferredValue to keep search input responsive during rapid typing with zero keyboard stutter.',
      status: wizardFlags.deferredRendering ? 'Optimized' : 'Recommended',
      recommendation: 'Enable Deferred Transitions for smooth UI interactivity.'
    }
  ];

  const activeStepData = steps[currentStep];

  const handleToggleCurrentFlag = () => {
    const key = activeStepData.flagKey;
    setWizardFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleEnableAll = () => {
    setWizardFlags({
      batchEagerLoading: true,
      btreeIndexing: true,
      queryCaching: true,
      virtualizedDOM: true,
      deferredRendering: true
    });
  };

  const handleCompleteWizard = () => {
    onApplyFlags(wizardFlags);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl relative text-zinc-900 flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-zinc-200 bg-gradient-to-r from-emerald-50 via-white to-zinc-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 tracking-tight flex items-center gap-2">
                <span>Global Optimization Wizard</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Enterprise Suite
                </span>
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Guided optimization flow &amp; side-by-side simulation view for resolving N+1 workload bottlenecks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleEnableAll}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              title="Instantly enable all recommended optimization flags"
            >
              <Zap className="w-3.5 h-3.5 fill-white text-white" />
              <span>Apply Recommended Fixes (All ON)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-700 p-2 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-200 bg-zinc-50 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('checklist')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl border-t border-x transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'checklist'
                ? 'bg-white border-zinc-200 text-emerald-700 shadow-xs'
                : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Guided Checklist Flow</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('simulation')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl border-t border-x transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'simulation'
                ? 'bg-white border-zinc-200 text-emerald-700 shadow-xs'
                : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Side-by-Side Simulation View</span>
          </button>
        </div>

        {/* Wizard Body */}
        <div className="p-6 space-y-6">
          {activeTab === 'checklist' ? (
            <>
              {/* Progress Bar */}
              <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                />
              </div>

              {/* Active Step Details */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md">
                    {activeStepData.category}
                  </span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                    wizardFlags[activeStepData.flagKey]
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}>
                    {wizardFlags[activeStepData.flagKey] ? '✅ Optimized (ON)' : '⚠️ Bottleneck (OFF)'}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-zinc-900 mb-1">
                    {activeStepData.title}
                  </h3>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    {activeStepData.description}
                  </p>
                </div>

                <div className="p-3 bg-white rounded-lg border border-zinc-200 text-xs flex items-center justify-between gap-4">
                  <div>
                    <span className="font-semibold text-zinc-700 block mb-0.5">Wizard Recommendation:</span>
                    <span className="text-zinc-600">{activeStepData.recommendation}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleCurrentFlag}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      wizardFlags[activeStepData.flagKey]
                        ? 'bg-zinc-200 hover:bg-zinc-300 text-zinc-800'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                    }`}
                  >
                    {wizardFlags[activeStepData.flagKey] ? 'Disable Feature' : 'Enable & Optimize'}
                  </button>
                </div>
              </div>

              {/* Checklist Step Pills */}
              <div className="grid grid-cols-5 gap-2">
                {steps.map((st, idx) => {
                  const isCurrent = idx === currentStep;
                  const isOpt = wizardFlags[st.flagKey];
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setCurrentStep(idx)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        isCurrent
                          ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-400/30'
                          : 'bg-white hover:bg-zinc-50 border-zinc-200'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isOpt ? 'bg-emerald-600 text-white' : 'bg-zinc-300 text-zinc-700'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="text-[10px] font-medium text-zinc-700 truncate w-full">
                        {st.title.split('. ')[1]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            /* Side-by-Side Comparison Simulation View */
            <div className="space-y-4">
              <div className="text-center pb-2">
                <h3 className="text-sm font-extrabold text-zinc-900">Before vs. After Optimization Simulation</h3>
                <p className="text-xs text-zinc-500">Live projection of workload metrics before applying wizard optimizations versus post-optimization.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Before Card */}
                <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 space-y-3 relative overflow-hidden">
                  <div className="absolute top-2 right-2 px-2 py-0.5 bg-rose-200 text-rose-900 text-[10px] font-mono font-bold rounded">
                    BEFORE (Unoptimized)
                  </div>
                  <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Current Workload Bottleneck</span>
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between bg-white/80 p-2 rounded border border-rose-200">
                      <span className="text-zinc-600">Execution Latency:</span>
                      <span className="font-bold text-rose-700">{avgLatency.toFixed(1)} ms</span>
                    </div>
                    <div className="flex justify-between bg-white/80 p-2 rounded border border-rose-200">
                      <span className="text-zinc-600">Query Roundtrips:</span>
                      <span className="font-bold text-rose-700">101 Queries (N+1 Cascade)</span>
                    </div>
                    <div className="flex justify-between bg-white/80 p-2 rounded border border-rose-200">
                      <span className="text-zinc-600">Connection Pool:</span>
                      <span className="font-bold text-rose-700">Exhausted (Timeouts)</span>
                    </div>
                    <div className="flex justify-between bg-white/80 p-2 rounded border border-rose-200">
                      <span className="text-zinc-600">UI Frame Rate:</span>
                      <span className="font-bold text-rose-700">14 FPS (Laggy)</span>
                    </div>
                  </div>
                </div>

                {/* After Card */}
                <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 space-y-3 relative overflow-hidden">
                  <div className="absolute top-2 right-2 px-2 py-0.5 bg-emerald-200 text-emerald-900 text-[10px] font-mono font-bold rounded">
                    AFTER (Wizard Optimized)
                  </div>
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Projected Optimized State</span>
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between bg-white/80 p-2 rounded border border-emerald-200">
                      <span className="text-zinc-600">Execution Latency:</span>
                      <span className="font-bold text-emerald-700">0.15 ms (-99.9%)</span>
                    </div>
                    <div className="flex justify-between bg-white/80 p-2 rounded border border-emerald-200">
                      <span className="text-zinc-600">Query Roundtrips:</span>
                      <span className="font-bold text-emerald-700">2 Queries (Batched)</span>
                    </div>
                    <div className="flex justify-between bg-white/80 p-2 rounded border border-emerald-200">
                      <span className="text-zinc-600">Connection Pool:</span>
                      <span className="font-bold text-emerald-700">Healthy &amp; Pooled</span>
                    </div>
                    <div className="flex justify-between bg-white/80 p-2 rounded border border-emerald-200">
                      <span className="text-zinc-600">UI Frame Rate:</span>
                      <span className="font-bold text-emerald-700">60 FPS (Locked)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-emerald-100 text-emerald-900 rounded-xl text-xs font-medium flex items-center justify-between">
                <span>⚡ Activating all 5 recommended flags guarantees immediate resolution of the N+1 cascade.</span>
                <button
                  type="button"
                  onClick={handleEnableAll}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs"
                >
                  Enable All Now
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between text-xs">
          {activeTab === 'checklist' ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
              disabled={currentStep === 0}
              className="px-4 py-2 bg-white hover:bg-zinc-100 disabled:opacity-40 border border-zinc-300 text-zinc-700 font-semibold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              Previous Step
            </button>
          ) : (
            <span className="text-zinc-500 font-mono">Side-by-side simulation mode active</span>
          )}

          <div className="flex items-center gap-2">
            {activeTab === 'checklist' && currentStep < steps.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1))}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                <span>Next Step</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCompleteWizard}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors cursor-pointer shadow-md"
              >
                <Check className="w-4 h-4" />
                <span>Apply All Optimizations &amp; Close</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
