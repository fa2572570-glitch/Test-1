import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Layers,
  ChevronLeft,
  ChevronRight,
  Eye,
  SlidersHorizontal,
  Info,
  Maximize2,
  X,
  FileSearch,
} from 'lucide-react';
import { useProjectStore } from '../../stores/project.store';
import { Panel, SourceImage } from '../../types';
import { getOrderedPanels } from '../panels/sequence-manager.service';
import { PanelBrowser } from '../panels/PanelBrowser';
import { ImagePreviewer } from './ImagePreviewer';
import { PanelInspector } from './PanelInspector';
import { ProjectHealthSummary } from './ProjectHealthSummary';
import { inspectProjectAssets, ProjectInspectionReport } from './asset-inspection.service';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

interface InspectionWorkspaceProps {
  onOpenImport?: () => void;
  initialSelectedPanelId?: string | null;
  onOpenValidation?: () => void;
}

export const InspectionWorkspace: React.FC<InspectionWorkspaceProps> = ({
  onOpenImport,
  initialSelectedPanelId,
  onOpenValidation,
}) => {
  const { currentProject } = useProjectStore();

  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(initialSelectedPanelId || null);
  const [inspectionReport, setInspectionReport] = useState<ProjectInspectionReport | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // If initialSelectedPanelId changes from navigation, apply it
  useEffect(() => {
    if (initialSelectedPanelId) {
      setSelectedPanelId(initialSelectedPanelId);
    }
  }, [initialSelectedPanelId]);

  // Canonical ordered panels
  const orderedPanels = useMemo(() => {
    if (!currentProject) return [];
    return getOrderedPanels(currentProject.panels);
  }, [currentProject]);

  // Image lookup map
  const imageMap = useMemo(() => {
    const map = new Map<string, SourceImage>();
    if (!currentProject) return map;
    for (const img of currentProject.images) {
      map.set(img.image_id, img);
    }
    return map;
  }, [currentProject]);

  // Auto-select first panel on initial load if none selected
  useEffect(() => {
    if (orderedPanels.length > 0 && !selectedPanelId) {
      setSelectedPanelId(orderedPanels[0].id);
    } else if (orderedPanels.length === 0) {
      setSelectedPanelId(null);
    } else if (selectedPanelId && !orderedPanels.some((p) => p.id === selectedPanelId)) {
      // Selected panel was deleted or removed
      setSelectedPanelId(orderedPanels[0].id);
    }
  }, [orderedPanels, selectedPanelId]);

  // Run comprehensive asset inspection whenever currentProject changes
  const runAssetInspection = useCallback(async () => {
    if (!currentProject) {
      setInspectionReport(null);
      return;
    }
    setIsVerifying(true);
    try {
      const report = await inspectProjectAssets(currentProject, true);
      setInspectionReport(report);
    } catch (err) {
      console.error('Asset inspection error:', err);
    } finally {
      setIsVerifying(false);
    }
  }, [currentProject]);

  useEffect(() => {
    runAssetInspection();
  }, [runAssetInspection]);

  // Current selected panel and image
  const selectedIndex = useMemo(() => {
    if (!selectedPanelId) return -1;
    return orderedPanels.findIndex((p) => p.id === selectedPanelId);
  }, [orderedPanels, selectedPanelId]);

  const selectedPanel = selectedIndex >= 0 ? orderedPanels[selectedIndex] : null;
  const selectedImage = selectedPanel ? imageMap.get(selectedPanel.image_id) : undefined;
  const selectedAssetReport = selectedPanel && inspectionReport ? inspectionReport.panelReportMap.get(selectedPanel.id) : undefined;

  // Previous & Next navigation following canonical panel order
  const handleNavigatePrevious = useCallback(() => {
    if (selectedIndex > 0) {
      const prevPanel = orderedPanels[selectedIndex - 1];
      setSelectedPanelId(prevPanel.id);
    }
  }, [selectedIndex, orderedPanels]);

  const handleNavigateNext = useCallback(() => {
    if (selectedIndex >= 0 && selectedIndex < orderedPanels.length - 1) {
      const nextPanel = orderedPanels[selectedIndex + 1];
      setSelectedPanelId(nextPanel.id);
    }
  }, [selectedIndex, orderedPanels]);

  // Keyboard navigation support: Left / Right arrows
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input or textarea
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNavigatePrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNavigateNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNavigatePrevious, handleNavigateNext]);

  const handleSelectPanel = (panel: Panel) => {
    setSelectedPanelId(panel.id);
  };

  if (!currentProject) {
    return (
      <Card variant="subtle" padding="lg" className="text-center py-12">
        <p className="text-zinc-400 font-medium">Please select or create a project first.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full pb-12 text-zinc-100">
      {/* Project Health & Asset Verification Summary */}
      <ProjectHealthSummary
        report={inspectionReport}
        isLoading={isVerifying}
        onRefresh={runAssetInspection}
      />

      {/* Main Workspace: Landscape-First Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Reused Panel Browser (List/Grid + Ordering Controls) */}
        <div className={selectedPanel ? 'lg:col-span-7 xl:col-span-7 flex flex-col gap-4' : 'lg:col-span-12 flex flex-col gap-4'}>
          <PanelBrowser
            onOpenImport={onOpenImport}
            selectedPanelId={selectedPanelId || undefined}
            onSelectPanel={handleSelectPanel}
            assetInspectionMap={inspectionReport?.panelReportMap}
          />
        </div>

        {/* Right Column: Selected Panel Previewer & Detailed Inspector */}
        {selectedPanel && (
          <div className="lg:col-span-5 xl:col-span-5 flex flex-col gap-4 sticky top-20">
            {/* Inspector Header & Canonical Navigation Controls */}
            <Card variant="default" padding="md" className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-zinc-300" />
                  <h3 className="font-bold text-zinc-100 text-sm tracking-tight">
                    Panel Inspector
                  </h3>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNavigatePrevious}
                    disabled={selectedIndex <= 0}
                    leftIcon={<ChevronLeft className="w-4 h-4" />}
                    className="min-h-[38px] px-2.5"
                    title="Previous Panel (Left Arrow)"
                  >
                    Prev
                  </Button>

                  <Badge variant="neutral" size="sm" className="font-mono font-bold px-2 py-1 bg-zinc-800 text-zinc-200 border-zinc-700">
                    {selectedIndex + 1} / {orderedPanels.length}
                  </Badge>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNavigateNext}
                    disabled={selectedIndex >= orderedPanels.length - 1}
                    rightIcon={<ChevronRight className="w-4 h-4" />}
                    className="min-h-[38px] px-2.5"
                    title="Next Panel (Right Arrow)"
                  >
                    Next
                  </Button>
                </div>
              </div>

              <div className="text-[11px] text-zinc-400 font-mono flex items-center justify-between border-t border-zinc-800 pt-2">
                <span className="truncate max-w-[200px]" title={selectedImage?.original_filename}>
                  {selectedImage?.original_filename || 'Unknown file'}
                </span>
                <span className="text-zinc-500">Keyboard: [←] [→]</span>
              </div>
            </Card>

            {/* High-Resolution On-Demand Previewer */}
            <ImagePreviewer
              panel={selectedPanel}
              sourceImage={selectedImage}
            />

            {/* Detailed Metadata Inspector */}
            <PanelInspector
              panel={selectedPanel}
              sourceImage={selectedImage}
              assetInspection={selectedAssetReport}
              totalPanelsCount={orderedPanels.length}
            />
          </div>
        )}
      </div>
    </div>
  );
};
