import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Layers,
  Image as ImageIcon,
  Trash2,
  Plus,
  Key,
  Info,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  RotateCcw,
  ChevronsUp,
  ChevronsDown,
  GripVertical,
  LayoutGrid,
  ListOrdered,
  Search,
  CheckCircle2,
  AlertTriangle,
  Hash,
} from 'lucide-react';
import { useProjectStore } from '../../stores/project.store';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { getImageBlob } from '../../services/storage/indexeddb';
import { formatBytes } from '../import/image-import.service';
import { SourceImage, Panel } from '../../types';
import {
  getOrderedPanels,
  validatePanelSequenceIntegrity,
  isPanelOrderModified,
} from './sequence-manager.service';
import { PanelAssetInspection } from '../review/asset-inspection.service';

interface PanelBrowserProps {
  onOpenImport?: () => void;
  selectedPanelId?: string;
  onSelectPanel?: (panel: Panel, image?: SourceImage) => void;
  assetInspectionMap?: Map<string, PanelAssetInspection>;
}

interface PanelCardProps {
  panel: Panel;
  sourceImage?: SourceImage;
  index: number;
  totalCount: number;
  isSelected: boolean;
  assetInspection?: PanelAssetInspection;
  isDragging: boolean;
  isDragOver: boolean;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent, panelId: string) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, targetIndex: number) => void;
  onPointerDragStart: (e: React.PointerEvent, panelId: string, index: number) => void;
  onMoveUp: (panelId: string) => void;
  onMoveDown: (panelId: string) => void;
  onMoveFirst: (panelId: string) => void;
  onMoveLast: (panelId: string) => void;
  onOpenJump: (panel: Panel, index: number) => void;
  onDelete: (imageId: string) => void;
  onInspect: (image: SourceImage, panel: Panel) => void;
}

/**
 * Grid Card representation for an individual manhwa panel
 */
const PanelGridCard: React.FC<PanelCardProps> = ({
  panel,
  sourceImage,
  index,
  totalCount,
  isSelected,
  assetInspection,
  isDragging,
  isDragOver,
  onSelect,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onPointerDragStart,
  onMoveUp,
  onMoveDown,
  onMoveFirst,
  onMoveLast,
  onOpenJump,
  onDelete,
  onInspect,
}) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let url: string | null = null;

    async function loadThumb() {
      if (!sourceImage) {
        setIsLoading(false);
        return;
      }
      try {
        const blob = await getImageBlob(sourceImage.image_id);
        if (blob && isMounted) {
          url = URL.createObjectURL(blob);
          setThumbUrl(url);
        }
      } catch (err) {
        console.error('Failed to load image blob:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadThumb();

    return () => {
      isMounted = false;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [sourceImage?.image_id]);

  const isFirst = index === 0;
  const isLast = index === totalCount - 1;

  return (
    <div
      data-panel-card
      data-panel-id={panel.id}
      data-panel-index={index}
      draggable
      onClick={onSelect}
      onDragStart={(e) => onDragStart(e, panel.id)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, index)}
      className={`rounded-2xl border transition-all flex flex-col overflow-hidden relative select-none cursor-pointer group ${
        isDragging
          ? 'opacity-30 border-dashed border-zinc-400 scale-95 bg-zinc-900'
          : isDragOver
          ? 'border-zinc-300 ring-2 ring-zinc-400/50 bg-zinc-800/90 shadow-lg'
          : isSelected
          ? 'border-zinc-400 ring-1 ring-zinc-400/40 bg-zinc-850 shadow-md'
          : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850/80'
      }`}
    >
      {/* Thumbnail & Header Area */}
      <div className="relative aspect-[3/4] bg-zinc-950 flex items-center justify-center overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center gap-1.5 text-zinc-500 text-xs">
            <ImageIcon className="w-6 h-6 animate-pulse" />
            <span>Loading...</span>
          </div>
        ) : thumbUrl ? (
          <img
            src={thumbUrl}
            alt={sourceImage?.original_filename || 'Manhwa panel'}
            className="w-full h-full object-contain group-hover:scale-[1.03] transition-transform duration-200 pointer-events-none"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-zinc-600 text-xs">
            <ImageIcon className="w-6 h-6" />
            <span>No Preview</span>
          </div>
        )}

        {/* Drag Handle & Sequence Badge */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => onPointerDragStart(e, panel.id, index)}
            className="p-1.5 rounded-lg bg-zinc-900/90 text-zinc-200 cursor-grab active:cursor-grabbing backdrop-blur-xs hover:bg-zinc-800 hover:text-white border border-zinc-700/60 shadow-xs touch-none transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
            title="Drag or touch-and-drag to reorder sequence"
          >
            <GripVertical className="w-4 h-4" />
          </div>
          <Badge
            variant="neutral"
            size="sm"
            className="font-mono bg-zinc-900/90 text-zinc-100 backdrop-blur-xs border border-zinc-700/60 font-bold px-2 py-0.5 shadow-xs"
          >
            #{panel.order + 1}
          </Badge>
          {isSelected && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-zinc-900 animate-pulse" />
          )}
        </div>

        {/* Action Overlay */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2.5 right-2.5 flex items-center gap-1 z-10 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <button
            onClick={() => onOpenJump(panel, index)}
            className="p-1.5 rounded-lg bg-zinc-900/90 text-zinc-300 hover:text-white hover:bg-zinc-800 border border-zinc-700/60 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center shadow-xs"
            title="Jump to specific sequence position"
          >
            <Hash className="w-3.5 h-3.5" />
          </button>
          {sourceImage && (
            <button
              onClick={() => onInspect(sourceImage, panel)}
              className="p-1.5 rounded-lg bg-zinc-900/90 text-zinc-300 hover:text-white hover:bg-zinc-800 border border-zinc-700/60 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center shadow-xs"
              title="Inspect Metadata & IDs"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          )}
          {sourceImage && (
            <button
              onClick={() => onDelete(sourceImage.image_id)}
              className="p-1.5 rounded-lg bg-rose-950/90 text-rose-300 hover:text-rose-100 hover:bg-rose-900 border border-rose-800/80 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center shadow-xs"
              title="Delete Image"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Health status indicator badge if error */}
        {assetInspection && assetInspection.status !== 'valid' && (
          <div className="absolute bottom-2 left-2 z-10">
            <Badge variant="warning" size="sm" className="text-[10px] bg-amber-950/90 text-amber-300 border border-amber-800/80 font-semibold">
              <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
              {assetInspection.statusLabel}
            </Badge>
          </div>
        )}
      </div>

      {/* Card Info Details */}
      <div className="p-3 flex flex-col gap-2 text-xs flex-1 justify-between bg-zinc-900 border-t border-zinc-800/80">
        <div>
          <p
            className="font-semibold text-zinc-100 truncate tracking-tight text-xs"
            title={sourceImage?.original_filename || 'Unknown image'}
          >
            {sourceImage?.original_filename || 'Unknown image'}
          </p>

          <div className="flex items-center justify-between text-zinc-400 text-[11px] mt-1 font-mono">
            <span>
              {sourceImage ? `${sourceImage.width} × ${sourceImage.height} px` : '—'}
            </span>
            <span>{sourceImage ? formatBytes(sourceImage.file_size) : '—'}</span>
          </div>
        </div>

        {/* Directional Reordering Touch Controls */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="pt-2.5 border-t border-zinc-800/80 flex items-center justify-between gap-1"
        >
          <div className="flex items-center gap-1">
            <button
              onClick={() => onMoveFirst(panel.id)}
              disabled={isFirst}
              className={`p-1.5 rounded-lg min-w-[34px] min-h-[34px] flex items-center justify-center transition-colors border ${
                isFirst
                  ? 'text-zinc-600 border-zinc-800/40 bg-zinc-900/40 cursor-not-allowed opacity-40'
                  : 'text-zinc-300 border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:text-white active:bg-zinc-600'
              }`}
              title="Move to First (top of chapter)"
            >
              <ChevronsUp className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onMoveUp(panel.id)}
              disabled={isFirst}
              className={`p-1.5 rounded-lg min-w-[34px] min-h-[34px] flex items-center justify-center transition-colors border ${
                isFirst
                  ? 'text-zinc-600 border-zinc-800/40 bg-zinc-900/40 cursor-not-allowed opacity-40'
                  : 'text-zinc-300 border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:text-white active:bg-zinc-600'
              }`}
              title="Move Up one position"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className="text-[11px] font-mono text-zinc-400 font-medium">
            {panel.order + 1}/{totalCount}
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onMoveDown(panel.id)}
              disabled={isLast}
              className={`p-1.5 rounded-lg min-w-[34px] min-h-[34px] flex items-center justify-center transition-colors border ${
                isLast
                  ? 'text-zinc-600 border-zinc-800/40 bg-zinc-900/40 cursor-not-allowed opacity-40'
                  : 'text-zinc-300 border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:text-white active:bg-zinc-600'
              }`}
              title="Move Down one position"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onMoveLast(panel.id)}
              disabled={isLast}
              className={`p-1.5 rounded-lg min-w-[34px] min-h-[34px] flex items-center justify-center transition-colors border ${
                isLast
                  ? 'text-zinc-600 border-zinc-800/40 bg-zinc-900/40 cursor-not-allowed opacity-40'
                  : 'text-zinc-300 border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:text-white active:bg-zinc-600'
              }`}
              title="Move to Last (bottom of chapter)"
            >
              <ChevronsDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * List Row representation for the Sequence Strip / Reorder List View
 */
const PanelListRow: React.FC<PanelCardProps> = ({
  panel,
  sourceImage,
  index,
  totalCount,
  isSelected,
  assetInspection,
  isDragging,
  isDragOver,
  onSelect,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onPointerDragStart,
  onMoveUp,
  onMoveDown,
  onMoveFirst,
  onMoveLast,
  onOpenJump,
  onDelete,
  onInspect,
}) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let url: string | null = null;

    async function loadThumb() {
      if (!sourceImage) return;
      try {
        const blob = await getImageBlob(sourceImage.image_id);
        if (blob && isMounted) {
          url = URL.createObjectURL(blob);
          setThumbUrl(url);
        }
      } catch (err) {
        console.error('Failed to load image blob:', err);
      }
    }

    loadThumb();

    return () => {
      isMounted = false;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [sourceImage?.image_id]);

  const isFirst = index === 0;
  const isLast = index === totalCount - 1;

  return (
    <div
      data-panel-card
      data-panel-id={panel.id}
      data-panel-index={index}
      draggable
      onClick={onSelect}
      onDragStart={(e) => onDragStart(e, panel.id)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, index)}
      className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 select-none cursor-pointer group ${
        isDragging
          ? 'opacity-30 border-dashed border-zinc-400 bg-zinc-900'
          : isDragOver
          ? 'border-zinc-300 ring-2 ring-zinc-400/50 bg-zinc-800/90'
          : isSelected
          ? 'border-zinc-400 ring-1 ring-zinc-400/40 bg-zinc-850 shadow-xs'
          : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850/80'
      }`}
    >
      {/* Left: Drag Handle, Sequence Badge & Thumbnail */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => onPointerDragStart(e, panel.id, index)}
          className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white cursor-grab active:cursor-grabbing shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors border border-zinc-700 touch-none"
          title="Drag or touch-and-drag to reorder"
        >
          <GripVertical className="w-5 h-5" />
        </div>

        <div className="w-10 text-center shrink-0">
          <Badge
            variant="neutral"
            size="md"
            className="font-mono bg-zinc-800 text-zinc-100 border border-zinc-700 font-bold px-2 py-1"
          >
            #{panel.order + 1}
          </Badge>
        </div>

        <div className="w-12 h-16 rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center relative">
          {thumbUrl ? (
            <img
              src={thumbUrl}
              alt={sourceImage?.original_filename || 'Panel'}
              className="w-full h-full object-contain pointer-events-none"
              loading="lazy"
            />
          ) : (
            <ImageIcon className="w-4 h-4 text-zinc-600" />
          )}
          {isSelected && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-zinc-900" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p
              className="font-semibold text-zinc-100 text-sm truncate tracking-tight"
              title={sourceImage?.original_filename || 'Unknown image'}
            >
              {sourceImage?.original_filename || 'Unknown image'}
            </p>
            {assetInspection && assetInspection.status !== 'valid' && (
              <Badge variant="warning" size="sm" className="text-[10px] shrink-0">
                {assetInspection.statusLabel}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1 font-mono flex-wrap">
            <span>
              {sourceImage ? `${sourceImage.width} × ${sourceImage.height} px` : '—'}
            </span>
            <span>{sourceImage ? formatBytes(sourceImage.file_size) : '—'}</span>
            <span className="text-zinc-500">id: {panel.id.slice(0, 10)}...</span>
          </div>
        </div>
      </div>

      {/* Right: Reorder Touch Buttons */}
      <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onMoveFirst(panel.id)}
          disabled={isFirst}
          className="min-h-[44px] min-w-[44px] px-2"
          title="Move to First"
        >
          <ChevronsUp className="w-4 h-4" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onMoveUp(panel.id)}
          disabled={isFirst}
          className="min-h-[44px] min-w-[44px] px-2.5"
          title="Move Up"
        >
          <ArrowUp className="w-4 h-4" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onMoveDown(panel.id)}
          disabled={isLast}
          className="min-h-[44px] min-w-[44px] px-2.5"
          title="Move Down"
        >
          <ArrowDown className="w-4 h-4" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onMoveLast(panel.id)}
          disabled={isLast}
          className="min-h-[44px] min-w-[44px] px-2"
          title="Move to Last"
        >
          <ChevronsDown className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenJump(panel, index)}
          className="min-h-[44px] min-w-[44px] px-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
          title="Jump to Position"
        >
          <Hash className="w-4 h-4" />
        </Button>

        {sourceImage && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onInspect(sourceImage, panel)}
            className="min-h-[44px] min-w-[44px] px-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            title="Inspect Details"
          >
            <Info className="w-4 h-4" />
          </Button>
        )}

        {sourceImage && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(sourceImage.image_id)}
            className="min-h-[44px] min-w-[44px] px-2 text-rose-400 hover:text-rose-200 hover:bg-rose-950/60"
            title="Delete Image"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

export const PanelBrowser: React.FC<PanelBrowserProps> = ({
  onOpenImport,
  selectedPanelId,
  onSelectPanel,
  assetInspectionMap,
}) => {
  const {
    currentProject,
    movePanel,
    movePanelToPosition,
    reversePanels,
    resetPanelsToImport,
    deleteImageAndLinkedPanels,
  } = useProjectStore();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectTarget, setInspectTarget] = useState<{
    image: SourceImage;
    panel: Panel;
  } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // Jump to Position modal state
  const [jumpTarget, setJumpTarget] = useState<{
    panel: Panel;
    currentIndex: number;
  } | null>(null);
  const [jumpInputNumber, setJumpInputNumber] = useState<string>('1');

  // Drag & drop state (HTML5 + Pointer Events)
  const [draggingPanelId, setDraggingPanelId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Ref for active pointer tracking
  const pointerDragState = useRef<{
    panelId: string;
    startIndex: number;
    lastTargetIndex: number | null;
  } | null>(null);

  if (!currentProject) {
    return (
      <Card variant="subtle" padding="lg" className="text-center py-12">
        <p className="text-zinc-400 font-medium">Please select or create a project first.</p>
      </Card>
    );
  }

  // Canonical ordered panels
  const orderedPanels = useMemo(() => {
    return getOrderedPanels(currentProject.panels);
  }, [currentProject.panels]);

  // Image lookup map
  const imageMap = useMemo(() => {
    const map = new Map<string, SourceImage>();
    for (const img of currentProject.images) {
      map.set(img.image_id, img);
    }
    return map;
  }, [currentProject.images]);

  // Data Integrity Report
  const integrityReport = useMemo(() => {
    return validatePanelSequenceIntegrity(currentProject);
  }, [currentProject]);

  const isCustomizedOrder = useMemo(() => {
    return isPanelOrderModified(currentProject.panels, currentProject.images);
  }, [currentProject.panels, currentProject.images]);

  // Filtered panels based on search query
  const filteredPanels = useMemo(() => {
    if (!searchQuery.trim()) return orderedPanels;
    const q = searchQuery.toLowerCase().trim();
    return orderedPanels.filter((panel) => {
      const img = imageMap.get(panel.image_id);
      return (
        img?.original_filename.toLowerCase().includes(q) ||
        panel.id.toLowerCase().includes(q) ||
        panel.image_id.toLowerCase().includes(q) ||
        String(panel.order + 1).includes(q)
      );
    });
  }, [orderedPanels, searchQuery, imageMap]);

  // HTML5 Drag handlers for desktop mouse
  const handleDragStart = (e: React.DragEvent, panelId: string) => {
    setDraggingPanelId(panelId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', panelId);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    // Keep target clean
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const panelId = draggingPanelId || e.dataTransfer.getData('text/plain');
    setDraggingPanelId(null);
    setDragOverIndex(null);

    if (!panelId) return;
    await movePanelToPosition(panelId, targetIndex);
  };

  // Pointer-event drag handler for touchscreens & mobile tablets
  const handlePointerDragStart = (e: React.PointerEvent, panelId: string, startIndex: number) => {
    // Only handle primary pointer (touch, pen, left click)
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    pointerDragState.current = {
      panelId,
      startIndex,
      lastTargetIndex: startIndex,
    };
    setDraggingPanelId(panelId);
    setDragOverIndex(startIndex);

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!pointerDragState.current) return;
      const element = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      const card = element?.closest('[data-panel-card]');
      if (card) {
        const idxAttr = card.getAttribute('data-panel-index');
        if (idxAttr !== null) {
          const targetIdx = parseInt(idxAttr, 10);
          if (!isNaN(targetIdx)) {
            pointerDragState.current.lastTargetIndex = targetIdx;
            setDragOverIndex(targetIdx);
          }
        }
      }
    };

    const onPointerUp = async () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      const state = pointerDragState.current;
      pointerDragState.current = null;
      setDraggingPanelId(null);
      setDragOverIndex(null);

      if (state && state.lastTargetIndex !== null && state.lastTargetIndex !== state.startIndex) {
        await movePanelToPosition(state.panelId, state.lastTargetIndex);
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const handleMoveUp = async (panelId: string) => {
    await movePanel(panelId, 'up');
  };

  const handleMoveDown = async (panelId: string) => {
    await movePanel(panelId, 'down');
  };

  const handleMoveFirst = async (panelId: string) => {
    await movePanel(panelId, 'first');
  };

  const handleMoveLast = async (panelId: string) => {
    await movePanel(panelId, 'last');
  };

  const handleOpenJump = (panel: Panel, index: number) => {
    setJumpTarget({ panel, currentIndex: index });
    setJumpInputNumber(String(index + 1));
  };

  const handleConfirmJump = async () => {
    if (!jumpTarget) return;
    const target1Based = parseInt(jumpInputNumber, 10);
    if (isNaN(target1Based)) return;

    const target0Based = target1Based - 1;
    await movePanelToPosition(jumpTarget.panel.id, target0Based);
    setJumpTarget(null);
  };

  const handleReverse = async () => {
    await reversePanels();
  };

  const handleResetToImport = async () => {
    await resetPanelsToImport();
    setResetConfirmOpen(false);
  };

  const handleDelete = async (imageId: string) => {
    await deleteImageAndLinkedPanels(imageId);
    setDeleteConfirmId(null);
    if (inspectTarget?.image.image_id === imageId) {
      setInspectTarget(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full text-zinc-100">
      {/* Header Bar & Control Panel */}
      <Card variant="default" padding="lg" className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
                <Layers className="w-5 h-5 text-zinc-200" />
                Panel Sequence & Ordering Manager
              </h2>
              <Badge variant="neutral" size="sm">
                {orderedPanels.length} Panels in Sequence
              </Badge>
              {isCustomizedOrder && (
                <Badge variant="purple" size="sm">
                  Custom Order
                </Badge>
              )}
              {integrityReport.valid ? (
                <Badge variant="success" size="sm" className="hidden sm:inline-flex">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Sequence Valid (0..{Math.max(0, orderedPanels.length - 1)})
                </Badge>
              ) : (
                <Badge variant="warning" size="sm">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Sequence Discontinuity
                </Badge>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Deterministic manhwa reading sequence. Reorder panels via touch controls, drag-and-drop, or quick jump while preserving exact filenames and stable IDs.
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReverse}
              disabled={orderedPanels.length <= 1}
              leftIcon={<ArrowUpDown className="w-4 h-4" />}
              className="min-h-[44px]"
              title="Reverse overall chapter scroll sequence"
            >
              Reverse Order
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetConfirmOpen(true)}
              disabled={!isCustomizedOrder || orderedPanels.length <= 1}
              leftIcon={<RotateCcw className="w-4 h-4" />}
              className="min-h-[44px]"
              title="Reset sequence to original import order"
            >
              Reset to Import
            </Button>

            {onOpenImport && (
              <Button
                variant="primary"
                size="sm"
                onClick={onOpenImport}
                leftIcon={<Plus className="w-4 h-4" />}
                className="min-h-[44px]"
              >
                Import More Pages
              </Button>
            )}
          </div>
        </div>

        {/* Search & View Mode Switcher */}
        {orderedPanels.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search panels or filenames..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-100 placeholder:text-zinc-500 focus:bg-zinc-850 focus:border-zinc-400 focus:outline-hidden transition-all min-h-[40px]"
              />
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-xs text-zinc-400 font-medium mr-1">View:</span>
              <div className="flex items-center p-1 bg-zinc-900 rounded-xl border border-zinc-750">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all min-h-[36px] px-2.5 cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-xs font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Grid</span>
                </button>

                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all min-h-[36px] px-2.5 cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-xs font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Reorder List / Strip View"
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                  <span>Reorder List</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {orderedPanels.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 mb-4">
              <ImageIcon className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-zinc-100">No manhwa panels in project</h3>
            <p className="text-xs text-zinc-400 max-w-sm mt-1 mb-6 leading-relaxed">
              Import chapter page files (JPG, PNG, WEBP) to begin building the manhwa scroll sequence.
            </p>
            {onOpenImport && (
              <Button
                variant="primary"
                size="md"
                onClick={onOpenImport}
                leftIcon={<Plus className="w-4 h-4" />}
                className="min-h-[44px]"
              >
                Import Chapter Images
              </Button>
            )}
          </div>
        ) : filteredPanels.length === 0 ? (
          <div className="py-12 text-center text-zinc-400 text-xs">
            No panels match query "{searchQuery}".
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
            {filteredPanels.map((panel, idx) => {
              const matchedImg = imageMap.get(panel.image_id);
              const assetInspection = assetInspectionMap?.get(panel.id);
              return (
                <PanelGridCard
                  key={panel.id}
                  panel={panel}
                  sourceImage={matchedImg}
                  index={idx}
                  totalCount={filteredPanels.length}
                  isSelected={selectedPanelId === panel.id}
                  assetInspection={assetInspection}
                  isDragging={draggingPanelId === panel.id}
                  isDragOver={dragOverIndex === idx}
                  onSelect={() => onSelectPanel?.(panel, matchedImg)}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onPointerDragStart={handlePointerDragStart}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                  onMoveFirst={handleMoveFirst}
                  onMoveLast={handleMoveLast}
                  onOpenJump={handleOpenJump}
                  onDelete={(id) => setDeleteConfirmId(id)}
                  onInspect={(image, pnl) => setInspectTarget({ image, panel: pnl })}
                />
              );
            })}
          </div>
        ) : (
          /* Reorder List View */
          <div className="flex flex-col gap-2.5">
            {filteredPanels.map((panel, idx) => {
              const matchedImg = imageMap.get(panel.image_id);
              const assetInspection = assetInspectionMap?.get(panel.id);
              return (
                <PanelListRow
                  key={panel.id}
                  panel={panel}
                  sourceImage={matchedImg}
                  index={idx}
                  totalCount={filteredPanels.length}
                  isSelected={selectedPanelId === panel.id}
                  assetInspection={assetInspection}
                  isDragging={draggingPanelId === panel.id}
                  isDragOver={dragOverIndex === idx}
                  onSelect={() => onSelectPanel?.(panel, matchedImg)}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onPointerDragStart={handlePointerDragStart}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                  onMoveFirst={handleMoveFirst}
                  onMoveLast={handleMoveLast}
                  onOpenJump={handleOpenJump}
                  onDelete={(id) => setDeleteConfirmId(id)}
                  onInspect={(image, pnl) => setInspectTarget({ image, panel: pnl })}
                />
              );
            })}
          </div>
        )}
      </Card>

      {/* Jump to Position Modal */}
      {jumpTarget && (
        <Modal
          isOpen={Boolean(jumpTarget)}
          onClose={() => setJumpTarget(null)}
          title="Move Panel to Position"
          description={`Set the target 1-based sequence position for panel #${jumpTarget.currentIndex + 1}.`}
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs pt-2">
            <div className="p-3 bg-zinc-800 rounded-xl border border-zinc-700">
              <span className="text-zinc-400 block">Current Sequence:</span>
              <span className="font-bold text-zinc-100 text-sm font-mono">
                Position #{jumpTarget.currentIndex + 1} of {orderedPanels.length}
              </span>
            </div>

            <div>
              <label className="font-semibold text-zinc-200 block mb-1.5">
                New Target Position (1 – {orderedPanels.length}):
              </label>
              <input
                type="number"
                min="1"
                max={orderedPanels.length}
                value={jumpInputNumber}
                onChange={(e) => setJumpInputNumber(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-100 focus:border-zinc-400 focus:outline-hidden font-mono"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <Button variant="outline" size="sm" onClick={() => setJumpTarget(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleConfirmJump}>
                Move to Position
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Metadata & Stable ID Inspector Modal */}
      {inspectTarget && (
        <Modal
          isOpen={Boolean(inspectTarget)}
          onClose={() => setInspectTarget(null)}
          title="Source Image & Panel Identity Inspection"
          description="Detailed verification of exact filename preservation, canonical order, and separate internal IDs."
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            {/* Identity Separation Callout */}
            <div className="p-3.5 rounded-xl bg-sky-950/60 border border-sky-800/80 text-sky-200 flex items-start gap-2.5">
              <Key className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold block text-sky-100">Critical Identity Rule Verified</span>
                <p className="text-sky-300 leading-relaxed">
                  The original filename is preserved verbatim as immutable metadata. Sequence reordering operates strictly on Panel sequence indices, never renaming files or mutating image binaries.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-800/60 p-4 rounded-xl border border-zinc-700">
              <div>
                <span className="text-zinc-400 font-medium block">Original Filename (Verbatim)</span>
                <span className="font-bold text-zinc-100 font-mono break-all text-[13px]">
                  {inspectTarget.image.original_filename}
                </span>
              </div>

              <div>
                <span className="text-zinc-400 font-medium block">Current Sequence Order</span>
                <span className="font-bold text-zinc-100 font-mono">
                  #{inspectTarget.panel.order + 1} (order index: {inspectTarget.panel.order})
                </span>
              </div>

              <div>
                <span className="text-zinc-400 font-medium block">Original Import Order</span>
                <span className="font-bold text-zinc-300 font-mono">
                  Initial #{inspectTarget.panel.initial_order !== undefined ? inspectTarget.panel.initial_order + 1 : inspectTarget.image.source_order + 1}
                </span>
              </div>

              <div>
                <span className="text-zinc-400 font-medium block">Internal Image ID (`image_id`)</span>
                <code className="font-mono text-indigo-300 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800/80 break-all">
                  {inspectTarget.image.image_id}
                </code>
              </div>

              <div>
                <span className="text-zinc-400 font-medium block">Internal Panel ID (`id`)</span>
                <code className="font-mono text-purple-300 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/80 break-all">
                  {inspectTarget.panel.id}
                </code>
              </div>

              <div>
                <span className="text-zinc-400 font-medium block">Natural Resolution</span>
                <span className="font-semibold text-zinc-200 font-mono">
                  {inspectTarget.image.width} × {inspectTarget.image.height} px
                </span>
              </div>

              <div>
                <span className="text-zinc-400 font-medium block">Payload Size & MIME</span>
                <span className="font-semibold text-zinc-200 font-mono">
                  {formatBytes(inspectTarget.image.file_size)} • {inspectTarget.image.mime_type}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-800/80 border border-zinc-700 space-y-1">
              <span className="font-semibold text-zinc-200 block">Panel Normalized Boundary (0.0 to 1.0)</span>
              <pre className="font-mono text-[11px] text-zinc-300 bg-zinc-900 p-2.5 rounded-lg border border-zinc-750 overflow-x-auto">
                {JSON.stringify(inspectTarget.panel.boundary, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="primary" size="sm" onClick={() => setInspectTarget(null)}>
                Close Inspector
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reset to Import Order Confirmation Modal */}
      {resetConfirmOpen && (
        <Modal
          isOpen={resetConfirmOpen}
          onClose={() => setResetConfirmOpen(false)}
          title="Reset Sequence to Import Order?"
          description="This will restore all panels back to the original chronological order captured during file import. Filenames and IDs remain completely untouched."
          maxWidth="sm"
        >
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-800">
            <Button variant="outline" size="sm" onClick={() => setResetConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleResetToImport}
              leftIcon={<RotateCcw className="w-4 h-4" />}
            >
              Reset Sequence
            </Button>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <Modal
          isOpen={Boolean(deleteConfirmId)}
          onClose={() => setDeleteConfirmId(null)}
          title="Delete Imported Image & Panel?"
          description="This will remove the source image metadata, its linked panel record, and its binary blob from IndexedDB."
          maxWidth="sm"
        >
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-800">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleDelete(deleteConfirmId)}
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              Delete Image & Blob
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};
