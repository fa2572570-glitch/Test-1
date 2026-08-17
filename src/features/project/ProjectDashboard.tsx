import React from 'react';
import {
  Layers,
  Image as ImageIcon,
  Users,
  Film,
  Camera,
  Compass,
  FileCode,
  Calendar,
  Settings2,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  ArrowRight,
} from 'lucide-react';
import { useProjectStore } from '../../stores/project.store';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ValidationDiagnostics } from './ValidationDiagnostics';
import { validateProject } from '../../data/schemas';

interface ProjectDashboardProps {
  onOpenSettings: () => void;
  onNavigateToImport?: () => void;
  onNavigateToPanels?: () => void;
  onNavigateToValidation?: () => void;
}

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({
  onOpenSettings,
  onNavigateToImport,
  onNavigateToPanels,
  onNavigateToValidation,
}) => {
  const { currentProject } = useProjectStore();

  if (!currentProject) {
    return null;
  }

  const validation = validateProject(currentProject);
  const isValid = validation.valid;

  const entityStats = [
    {
      label: 'Source Images',
      count: currentProject.images.length,
      icon: <ImageIcon className="w-4 h-4 text-sky-600" />,
      subtext: 'Preserving verbatim original_filenames',
    },
    {
      label: 'Extracted Panels',
      count: currentProject.panels.length,
      icon: <Layers className="w-4 h-4 text-indigo-600" />,
      subtext: 'Normalized 0.0 - 1.0 bounding boxes',
    },
    {
      label: 'Story Characters',
      count: currentProject.characters.length,
      icon: <Users className="w-4 h-4 text-emerald-600" />,
      subtext: 'Identities & character arcs',
    },
    {
      label: 'Structured Scenes',
      count: currentProject.scenes.length,
      icon: <Film className="w-4 h-4 text-purple-600" />,
      subtext: 'Pacing & timeline groupings',
    },
    {
      label: 'Camera Motions',
      count: currentProject.panels.filter((p) => p.camera_analysis).length,
      icon: <Camera className="w-4 h-4 text-amber-600" />,
      subtext: 'Cinematic keyframe trajectories',
    },
    {
      label: 'Story Events',
      count: currentProject.events.length,
      icon: <Compass className="w-4 h-4 text-rose-600" />,
      subtext: 'Narrative significance nodes',
    },
  ];

  return (
    <div className="flex flex-col gap-6 w-full text-zinc-100">
      {/* Project Overview Card */}
      <Card variant="default" padding="lg" className="flex flex-col gap-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
                {currentProject.metadata.title}
              </h2>
              <Badge variant="neutral" size="sm">
                Schema v{currentProject.schemaVersion}
              </Badge>
              {isValid ? (
                <Badge variant="success" size="sm">
                  <CheckCircle2 className="w-3 h-3" /> Validated
                </Badge>
              ) : (
                <Badge variant="error" size="sm">
                  <AlertTriangle className="w-3 h-3" /> Schema Error
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-zinc-400 mt-2 flex-wrap">
              {currentProject.metadata.series_name && (
                <span>
                  <strong className="text-zinc-300">Series:</strong> {currentProject.metadata.series_name}
                  {currentProject.metadata.chapter_number !== undefined && ` (Ch. ${currentProject.metadata.chapter_number})`}
                </span>
              )}
              {currentProject.metadata.author && (
                <span>
                  <strong className="text-zinc-300">Author:</strong> {currentProject.metadata.author}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                Created {new Date(currentProject.metadata.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {onNavigateToImport && (
              <Button
                variant="primary"
                size="sm"
                onClick={onNavigateToImport}
                leftIcon={<UploadCloud className="w-4 h-4" />}
              >
                Import Images
              </Button>
            )}

            {onNavigateToPanels && currentProject.images.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onNavigateToPanels}
                leftIcon={<ImageIcon className="w-4 h-4" />}
              >
                View Panels ({currentProject.images.length})
              </Button>
            )}

            {onNavigateToValidation && (
              <Button
                variant="outline"
                size="sm"
                onClick={onNavigateToValidation}
                leftIcon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              >
                Validation Gate
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onOpenSettings}
              leftIcon={<Settings2 className="w-4 h-4" />}
            >
              Settings
            </Button>
          </div>
        </div>

        {/* Configuration Snapshot */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 text-xs">
          <div>
            <span className="text-zinc-400 block">Target Aspect Ratio</span>
            <span className="font-semibold text-zinc-200">{currentProject.settings.target_aspect_ratio}</span>
          </div>
          <div>
            <span className="text-zinc-400 block">Reading Direction</span>
            <span className="font-semibold text-zinc-200 capitalize">
              {currentProject.settings.reading_direction.replace(/-/g, ' ')}
            </span>
          </div>
          <div>
            <span className="text-zinc-400 block">Export Frame Rate</span>
            <span className="font-semibold text-zinc-200">{currentProject.settings.export_target_fps} FPS</span>
          </div>
          <div>
            <span className="text-zinc-400 block">Canvas Resolution</span>
            <span className="font-semibold text-zinc-200">
              {currentProject.settings.preferred_resolution.width} x {currentProject.settings.preferred_resolution.height}
            </span>
          </div>
        </div>

        {/* Entity Metric Grid */}
        <div>
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-3">
            Core Schema Data Containers (Part 1.1 Foundation)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {entityStats.map((stat, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:border-zinc-700 transition-colors flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 shrink-0">
                  {stat.icon}
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-zinc-100">{stat.count}</span>
                    <span className="text-xs font-medium text-zinc-300">{stat.label}</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{stat.subtext}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Downstream Pipeline Readiness Notice */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
          <FileCode className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-zinc-100">
              Architecture Readiness: Fully Decoupled for Downstream AI & Motion Modules
            </p>
            <p className="text-zinc-400 leading-relaxed">
              All data structures, IndexedDB stores, normalized coordinate systems, and schema validation interfaces are initialized and ready for subsequent parts (multi-image import, OCR, character clustering, 2.5D camera motion trajectories, and final JSON storyboard export).
            </p>
          </div>
        </div>
      </Card>

      {/* Real-time Diagnostics and Verification */}
      <ValidationDiagnostics />
    </div>
  );
};
