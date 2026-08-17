import React from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  FileCheck2,
  Image as ImageIcon,
  Layers,
  Database,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ProjectInspectionReport } from './asset-inspection.service';

interface ProjectHealthSummaryProps {
  report: ProjectInspectionReport | null;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const ProjectHealthSummary: React.FC<ProjectHealthSummaryProps> = ({
  report,
  isLoading = false,
  onRefresh,
}) => {
  if (!report) {
    return (
      <Card variant="subtle" padding="sm" className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">Checking project asset health...</span>
      </Card>
    );
  }

  const isAllHealthy =
    report.isSchemaValid &&
    report.isSequenceValid &&
    report.missingBinaryCount === 0 &&
    report.missingImageRefCount === 0 &&
    report.invalidMetadataCount === 0;

  return (
    <Card variant="default" padding="md" className="flex flex-col gap-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              isAllHealthy
                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/80'
                : 'bg-amber-950/70 text-amber-300 border border-amber-800/80'
            }`}
          >
            {isAllHealthy ? <ShieldCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-zinc-100 text-sm tracking-tight">
                Project Health & Inspection Summary
              </h3>
              <Badge variant={isAllHealthy ? 'success' : 'warning'} size="sm">
                {isAllHealthy ? 'All Systems Verified' : 'Inspection Alerts'}
              </Badge>
            </div>
            <p className="text-[11px] text-zinc-400">
              Schema v{report.schemaVersion} • Last modified: {new Date(report.lastModified).toLocaleTimeString()}
            </p>
          </div>
        </div>

        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            className="self-start sm:self-auto min-h-[36px] text-xs text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
          >
            Re-verify Assets
          </Button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5 text-xs">
        <div className="p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700/80 flex flex-col gap-0.5">
          <span className="text-zinc-400 text-[11px] flex items-center gap-1">
            <Layers className="w-3 h-3 text-zinc-400" />
            Total Panels
          </span>
          <span className="font-bold text-zinc-100 text-sm font-mono">{report.totalPanels}</span>
        </div>

        <div className="p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700/80 flex flex-col gap-0.5">
          <span className="text-zinc-400 text-[11px] flex items-center gap-1">
            <ImageIcon className="w-3 h-3 text-zinc-400" />
            Source Images
          </span>
          <span className="font-bold text-zinc-100 text-sm font-mono">{report.totalImages}</span>
        </div>

        <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex flex-col gap-0.5">
          <span className="text-emerald-300 text-[11px] flex items-center gap-1 font-medium">
            <FileCheck2 className="w-3 h-3 text-emerald-400" />
            Valid Assets
          </span>
          <span className="font-bold text-emerald-200 text-sm font-mono">
            {report.validPanelsCount} / {report.totalPanels}
          </span>
        </div>

        <div
          className={`p-2.5 rounded-xl border flex flex-col gap-0.5 ${
            report.missingBinaryCount > 0
              ? 'bg-amber-950/40 border-amber-700/80 text-amber-200'
              : 'bg-zinc-800/60 border-zinc-700/80'
          }`}
        >
          <span className="text-zinc-400 text-[11px] flex items-center gap-1">
            <Database className="w-3 h-3 text-zinc-400" />
            Missing Binaries
          </span>
          <span
            className={`font-bold text-sm font-mono ${
              report.missingBinaryCount > 0 ? 'text-amber-300 font-extrabold' : 'text-zinc-100'
            }`}
          >
            {report.missingBinaryCount}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700/80 flex flex-col gap-0.5 col-span-2 sm:col-span-1">
          <span className="text-zinc-400 text-[11px]">Sequence Status</span>
          <span
            className={`font-bold text-xs font-mono truncate ${
              report.isSequenceValid ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {report.isSequenceValid ? 'Contiguous (0..N-1)' : 'Sequence Issue'}
          </span>
        </div>
      </div>
    </Card>
  );
};
