import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Layers,
  Image as ImageIcon,
  Database,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  HardDrive,
  Info,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useProjectStore } from '../../stores/project.store';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { validateProjectForAnalysis } from './project-validation.service';
import { ValidationReport, ValidationCheck, CheckCategory } from './types';

interface ValidationWorkspaceProps {
  onNavigateToPanel?: (panelId: string) => void;
  onNavigateToImport?: () => void;
}

export const ValidationWorkspace: React.FC<ValidationWorkspaceProps> = ({
  onNavigateToPanel,
  onNavigateToImport,
}) => {
  const { currentProject } = useProjectStore();
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'errors' | 'warnings' | 'passed'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedCheckIds, setExpandedCheckIds] = useState<Set<string>>(new Set());
  const [validationDurationMs, setValidationDurationMs] = useState<number | null>(null);

  const runValidation = useCallback(async () => {
    if (!currentProject) return;
    setIsValidating(true);
    const start = performance.now();
    try {
      const result = await validateProjectForAnalysis(currentProject, {
        checkBlobsInStorage: true,
        checkStorageConsistency: true,
      });
      setReport(result);
      setValidationDurationMs(Math.round(performance.now() - start));
    } catch (err) {
      console.error('Validation error:', err);
    } finally {
      setIsValidating(false);
    }
  }, [currentProject]);

  useEffect(() => {
    runValidation();
  }, [runValidation]);

  if (!currentProject) {
    return (
      <div className="p-8 text-center text-zinc-400">
        <p>No project loaded. Please select or create a project.</p>
      </div>
    );
  }

  const toggleExpand = (checkId: string) => {
    setExpandedCheckIds((prev) => {
      const next = new Set(prev);
      if (next.has(checkId)) {
        next.delete(checkId);
      } else {
        next.add(checkId);
      }
      return next;
    });
  };

  const filteredChecks = (report?.checks || []).filter((c) => {
    // 1. Status Filter
    if (activeFilter === 'errors' && c.status !== 'FAIL') return false;
    if (activeFilter === 'warnings' && c.status !== 'WARN') return false;
    if (activeFilter === 'passed' && c.status !== 'PASS') return false;

    // 2. Category Filter
    if (selectedCategory !== 'all' && c.category !== selectedCategory) return false;

    return true;
  });

  const readiness = report?.readiness || 'BLOCKED';
  const isReady = readiness === 'READY';
  const isReadyWithWarnings = readiness === 'READY_WITH_WARNINGS';
  const isBlocked = readiness === 'BLOCKED';

  const categories: { label: string; value: string }[] = [
    { label: 'All Categories', value: 'all' },
    { label: 'Schema', value: 'schema' },
    { label: 'Panel Identity', value: 'panel_identity' },
    { label: 'Source Image Identity', value: 'source_image_identity' },
    { label: 'Filename Integrity', value: 'filename_integrity' },
    { label: 'Binary Storage', value: 'binary_availability' },
    { label: 'Sequence Integrity', value: 'sequence_integrity' },
    { label: 'Relationships', value: 'relationships' },
    { label: 'Storage Consistency', value: 'storage_consistency' },
  ];

  return (
    <div className="flex flex-col gap-6 w-full text-zinc-100">
      {/* 1. HERO READINESS GATE BANNER */}
      <Card
        variant="default"
        padding="lg"
        className={`flex flex-col gap-4 border transition-all ${
          isReady
            ? 'border-emerald-500/40 bg-emerald-950/20'
            : isReadyWithWarnings
            ? 'border-amber-500/40 bg-amber-950/20'
            : 'border-rose-500/40 bg-rose-950/20'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            <div
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 border ${
                isReady
                  ? 'bg-emerald-900/60 border-emerald-500/50 text-emerald-300'
                  : isReadyWithWarnings
                  ? 'bg-amber-900/60 border-amber-500/50 text-amber-300'
                  : 'bg-rose-900/60 border-rose-500/50 text-rose-300'
              }`}
            >
              {isReady ? (
                <ShieldCheck className="w-7 h-7 sm:w-8 sm:h-8" />
              ) : isReadyWithWarnings ? (
                <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8" />
              ) : (
                <ShieldAlert className="w-7 h-7 sm:w-8 sm:h-8" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs uppercase tracking-wider font-mono font-bold text-zinc-400">
                  Pre-Analysis Validation Gate
                </span>
                <Badge
                  variant={isReady ? 'success' : isReadyWithWarnings ? 'warning' : 'error'}
                  size="md"
                  className="font-bold uppercase tracking-wide"
                >
                  {isReady
                    ? 'READY FOR ANALYSIS'
                    : isReadyWithWarnings
                    ? 'READY WITH WARNINGS'
                    : 'ANALYSIS BLOCKED'}
                </Badge>
              </div>

              <h2 className="text-lg sm:text-xl font-extrabold text-zinc-100 tracking-tight">
                {report?.readiness_reason || 'Evaluating dataset readiness...'}
              </h2>

              <p className="text-xs text-zinc-400 leading-relaxed max-w-3xl">
                Deterministic pre-analysis gate verifying schema validity, panel identity preservation,
                0-based contiguous order, image binary availability, and storage consistency.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={runValidation}
              isLoading={isValidating}
              leftIcon={<RefreshCw className={`w-4 h-4 ${isValidating ? 'animate-spin' : ''}`} />}
              className="min-h-[44px]"
            >
              Run Validation
            </Button>

            {currentProject.panels.length === 0 && onNavigateToImport && (
              <Button
                variant="primary"
                size="sm"
                onClick={onNavigateToImport}
                leftIcon={<ImageIcon className="w-4 h-4" />}
                className="min-h-[44px]"
              >
                Import Chapter Images
              </Button>
            )}
          </div>
        </div>

        {validationDurationMs !== null && (
          <div className="flex items-center justify-between text-[11px] text-zinc-400 border-t border-zinc-800/80 pt-3 mt-1">
            <span className="flex items-center gap-1.5 font-mono">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              Scan completed in {validationDurationMs}ms
            </span>
            <span className="font-mono text-zinc-400">
              Verified {report?.summary.total_checks_run || 0} checks across{' '}
              {report?.summary.total_panels || 0} panels
            </span>
          </div>
        )}
      </Card>

      {/* 2. SUMMARY KPI METRICS GRID */}
      {report && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <Card variant="subtle" padding="sm" className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" /> Total Panels
            </span>
            <span className="text-xl font-bold text-zinc-100 font-mono">
              {report.summary.total_panels}
            </span>
            <span className="text-[10px] text-zinc-400">Structured panels</span>
          </Card>

          <Card variant="subtle" padding="sm" className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-sky-400" /> Source Images
            </span>
            <span className="text-xl font-bold text-zinc-100 font-mono">
              {report.summary.total_images}
            </span>
            <span className="text-[10px] text-zinc-400">Original filenames</span>
          </Card>

          <Card variant="subtle" padding="sm" className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Valid Assets
            </span>
            <span className="text-xl font-bold text-emerald-400 font-mono">
              {report.summary.valid_assets}
            </span>
            <span className="text-[10px] text-zinc-400">Verified in IndexedDB</span>
          </Card>

          <Card variant="subtle" padding="sm" className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5 text-rose-400" /> Missing / Corrupted
            </span>
            <span
              className={`text-xl font-bold font-mono ${
                report.summary.missing_assets + report.summary.corrupted_assets > 0
                  ? 'text-rose-400'
                  : 'text-zinc-400'
              }`}
            >
              {report.summary.missing_assets + report.summary.corrupted_assets}
            </span>
            <span className="text-[10px] text-zinc-400">Unreadable binaries</span>
          </Card>

          <Card variant="subtle" padding="sm" className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> Blocking Errors
            </span>
            <span
              className={`text-xl font-bold font-mono ${
                report.summary.total_errors > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {report.summary.total_errors}
            </span>
            <span className="text-[10px] text-zinc-400">Must be resolved</span>
          </Card>

          <Card variant="subtle" padding="sm" className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Notices / Warns
            </span>
            <span
              className={`text-xl font-bold font-mono ${
                report.summary.total_warnings > 0 ? 'text-amber-400' : 'text-zinc-400'
              }`}
            >
              {report.summary.total_warnings}
            </span>
            <span className="text-[10px] text-zinc-400">Non-blocking warnings</span>
          </Card>
        </div>
      )}

      {/* 3. CHECKLIST & FILTER WORKSPACE */}
      <Card variant="default" padding="lg" className="flex flex-col gap-5">
        {/* Filter Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
          <div>
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-indigo-400" />
              Pre-Analysis Validation Checklist
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Detailed breakdown of all 16 integrity categories evaluated across the dataset.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter Pills */}
            <div className="flex items-center bg-zinc-850 p-1 rounded-xl border border-zinc-750">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeFilter === 'all'
                    ? 'bg-zinc-700 text-zinc-100 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                All ({report?.checks.length || 0})
              </button>

              <button
                onClick={() => setActiveFilter('errors')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeFilter === 'errors'
                    ? 'bg-rose-900/80 text-rose-200 shadow-xs'
                    : 'text-zinc-400 hover:text-rose-300'
                }`}
              >
                Errors ({report?.errors.length || 0})
              </button>

              <button
                onClick={() => setActiveFilter('warnings')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeFilter === 'warnings'
                    ? 'bg-amber-900/80 text-amber-200 shadow-xs'
                    : 'text-zinc-400 hover:text-amber-300'
                }`}
              >
                Warnings ({report?.warnings.length || 0})
              </button>

              <button
                onClick={() => setActiveFilter('passed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeFilter === 'passed'
                    ? 'bg-emerald-900/80 text-emerald-200 shadow-xs'
                    : 'text-zinc-400 hover:text-emerald-300'
                }`}
              >
                Passed ({(report?.checks.length || 0) - (report?.errors.length || 0) - (report?.warnings.length || 0)})
              </button>
            </div>

            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-zinc-850 border border-zinc-750 text-zinc-200 text-xs rounded-xl px-3 py-2 font-medium focus:outline-none focus:border-indigo-500 min-h-[40px] cursor-pointer"
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value} className="bg-zinc-900 text-zinc-200">
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Checks List */}
        {filteredChecks.length === 0 ? (
          <div className="py-12 text-center text-zinc-400 text-xs bg-zinc-900/50 rounded-xl border border-zinc-800/80">
            No validation checks match the selected filter criteria.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredChecks.map((check) => {
              const isExpanded = expandedCheckIds.has(check.check_id);
              const isFail = check.status === 'FAIL';
              const isWarn = check.status === 'WARN';
              const isPass = check.status === 'PASS';

              const hasDetails = (check.details && check.details.length > 0) ||
                (check.affected_panel_ids && check.affected_panel_ids.length > 0) ||
                (check.affected_image_ids && check.affected_image_ids.length > 0);

              const firstAffectedPanel = check.affected_panel_ids?.[0];

              return (
                <div
                  key={check.check_id}
                  className={`rounded-xl border transition-all ${
                    isFail
                      ? 'bg-rose-950/30 border-rose-900/60 text-zinc-100'
                      : isWarn
                      ? 'bg-amber-950/30 border-amber-900/60 text-zinc-100'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-300'
                  }`}
                >
                  <div
                    onClick={() => hasDetails && toggleExpand(check.check_id)}
                    className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      hasDetails ? 'cursor-pointer hover:bg-zinc-850/50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="mt-0.5 shrink-0">
                        {isPass && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                        {isWarn && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                        {isFail && <XCircle className="w-5 h-5 text-rose-400" />}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-zinc-100">
                            {check.name}
                          </span>
                          <Badge variant="neutral" size="sm" className="font-mono text-[10px]">
                            {check.category}
                          </Badge>
                          {isFail && (
                            <Badge variant="error" size="sm">
                              BLOCKING ERROR
                            </Badge>
                          )}
                          {isWarn && (
                            <Badge variant="warning" size="sm">
                              WARNING
                            </Badge>
                          )}
                        </div>

                        <p className="text-xs text-zinc-300 leading-relaxed">
                          {check.message}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {/* Navigation Link for Problematic Panels */}
                      {firstAffectedPanel && onNavigateToPanel && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToPanel(firstAffectedPanel);
                          }}
                          leftIcon={<ExternalLink className="w-3.5 h-3.5 text-indigo-400" />}
                          className="text-xs min-h-[36px]"
                        >
                          Inspect Panel
                        </Button>
                      )}

                      {hasDetails && (
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Diagnostics Details */}
                  {isExpanded && hasDetails && (
                    <div className="px-4 pb-4 pt-1 border-t border-zinc-800/60 bg-zinc-950/40 rounded-b-xl text-xs space-y-3">
                      {check.details && check.details.length > 0 && (
                        <div>
                          <span className="font-semibold text-zinc-400 block mb-1.5">
                            Diagnostic Logs:
                          </span>
                          <ul className="space-y-1 font-mono text-[11px] text-zinc-300 bg-zinc-900 p-2.5 rounded-lg border border-zinc-800 max-h-48 overflow-y-auto">
                            {check.details.map((d, idx) => (
                              <li key={idx} className="flex items-start gap-1.5">
                                <span className="text-zinc-500">•</span>
                                <span>{d}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {check.affected_panel_ids && check.affected_panel_ids.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          <span className="font-semibold text-zinc-400">
                            Affected Panels ({check.affected_panel_ids.length}):
                          </span>
                          {check.affected_panel_ids.slice(0, 8).map((pid) => (
                            <button
                              key={pid}
                              onClick={() => onNavigateToPanel?.(pid)}
                              className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-indigo-300 font-mono text-[11px] border border-zinc-700 transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <span>{pid}</span>
                              <ArrowRight className="w-2.5 h-2.5 opacity-70" />
                            </button>
                          ))}
                          {check.affected_panel_ids.length > 8 && (
                            <span className="text-zinc-500 text-[11px] font-mono">
                              +{check.affected_panel_ids.length - 8} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
