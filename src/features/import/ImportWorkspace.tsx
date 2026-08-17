import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileImage,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Trash2,
  RotateCcw,
  Layers,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Plus,
  FolderOpen,
  Image as ImageIcon,
  Info,
} from 'lucide-react';
import { useProjectStore } from '../../stores/project.store';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import {
  PreviewItem,
  ImportProgressState,
  inspectSelectedFiles,
  executeBatchImport,
  cleanupPreviewUrls,
  formatBytes,
} from './image-import.service';

interface ImportWorkspaceProps {
  onNavigateToPanels?: () => void;
}

export const ImportWorkspace: React.FC<ImportWorkspaceProps> = ({ onNavigateToPanels }) => {
  const { currentProject, addImportedImagesAndPanels } = useProjectStore();

  const systemFileInputRef = useRef<HTMLInputElement>(null);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectProgress, setInspectProgress] = useState({ current: 0, total: 0 });
  const [progressState, setProgressState] = useState<ImportProgressState | null>(null);
  const [lastImportResult, setLastImportResult] = useState<{
    count: number;
    errors: Array<{ filename: string; reason: string }>;
  } | null>(null);

  // Clean up any preview object URLs on unmount or item list reset
  useEffect(() => {
    return () => {
      cleanupPreviewUrls(previewItems);
    };
  }, [previewItems]);

  if (!currentProject) {
    return (
      <Card variant="subtle" padding="lg" className="text-center py-12">
        <p className="text-zinc-600 font-medium">Please select or create a project first.</p>
      </Card>
    );
  }

  const handleFilesSelected = async (fileList: FileList | File[]) => {
    const rawFiles = Array.from(fileList);
    if (rawFiles.length === 0) return;

    setIsInspecting(true);
    setInspectProgress({ current: 0, total: rawFiles.length });
    setLastImportResult(null);

    try {
      const inspected = await inspectSelectedFiles(
        rawFiles,
        currentProject.images,
        (current, total) => setInspectProgress({ current, total })
      );
      setPreviewItems((prev) => [...prev, ...inspected]);
    } catch (err) {
      console.error('File inspection error:', err);
    } finally {
      setIsInspecting(false);
      if (systemFileInputRef.current) {
        systemFileInputRef.current.value = '';
      }
      if (mediaFileInputRef.current) {
        mediaFileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const handleRemoveItem = (id: string) => {
    setPreviewItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.thumbnailUrl && target.thumbnailUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(target.thumbnailUrl);
        } catch {
          // ignore
        }
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleToggleDuplicateAction = (id: string) => {
    setPreviewItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextAction = item.duplicateAction === 'skip' ? 'import_anyway' : 'skip';
          return { ...item, duplicateAction: nextAction };
        }
        return item;
      })
    );
  };

  const handleSetAllDuplicatesAction = (action: 'skip' | 'import_anyway') => {
    setPreviewItems((prev) =>
      prev.map((item) => (item.isDuplicate ? { ...item, duplicateAction: action } : item))
    );
  };

  const handleClearQueue = () => {
    cleanupPreviewUrls(previewItems);
    setPreviewItems([]);
    setLastImportResult(null);
  };

  const handleExecuteImport = async () => {
    if (!currentProject || previewItems.length === 0) return;

    const result = await executeBatchImport(
      currentProject.id,
      previewItems,
      currentProject.images.length,
      (progress) => setProgressState(progress)
    );

    if (result.successfulImages.length > 0) {
      await addImportedImagesAndPanels(result.successfulImages, result.successfulPanels);
    }

    setLastImportResult({
      count: result.successfulImages.length,
      errors: result.errors,
    });

    // Clear completed items from preview
    cleanupPreviewUrls(previewItems);
    setPreviewItems([]);
    setProgressState(null);
  };

  // Stats calculation for preview queue
  const validItems = previewItems.filter((i) => i.status === 'ready');
  const duplicateItems = previewItems.filter((i) => i.status === 'duplicate');
  const invalidItems = previewItems.filter((i) => i.status === 'invalid');
  const willImportCount = previewItems.filter(
    (i) => i.status === 'ready' || (i.status === 'duplicate' && i.duplicateAction === 'import_anyway')
  ).length;
  const totalImportBytes = previewItems
    .filter(
      (i) =>
        i.status === 'ready' || (i.status === 'duplicate' && i.duplicateAction === 'import_anyway')
    )
    .reduce((acc, curr) => acc + curr.file_size, 0);

  const openSystemFilesPicker = () => {
    // Unconstrained input triggers native Android Document / Files Manager & Desktop file browser
    if (systemFileInputRef.current) {
      systemFileInputRef.current.value = '';
      systemFileInputRef.current.click();
    }
  };

  const openMediaPicker = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    // Image-constrained input opens Photo Gallery / Media sheet
    if (mediaFileInputRef.current) {
      mediaFileInputRef.current.value = '';
      mediaFileInputRef.current.click();
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full text-zinc-100">
      {/* 1. Unconstrained input: Bypasses Android PhotoPicker and opens device System File Manager / Downloads */}
      <input
        ref={systemFileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFilesSelected(e.target.files);
        }}
      />

      {/* 2. Image constrained input: For users who want the Photo Gallery picker */}
      <input
        ref={mediaFileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFilesSelected(e.target.files);
        }}
      />

      {/* Main Ingestion Card / Drop Zone */}
      <Card variant="default" padding="lg" className="flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
          <div>
            <h2 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-indigo-400" />
              Batch Image Ingestion
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Select or drop manhwa chapter pages. Supported: JPG, JPEG, PNG, WEBP.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={openMediaPicker}
              leftIcon={<ImageIcon className="w-4 h-4 text-zinc-300" />}
              title="Open Photo Gallery"
            >
              Photo Gallery
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={openSystemFilesPicker}
              leftIcon={<FolderOpen className="w-4 h-4" />}
              title="Open Device System Files & Folders"
            >
              Browse System Files
            </Button>
          </div>
        </div>

        {/* Drag and drop touch area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={openSystemFilesPicker}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center flex flex-col items-center justify-center cursor-pointer transition-all ${
            isDragging
              ? 'border-indigo-400 bg-zinc-800/80 scale-[0.99]'
              : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/60 hover:bg-zinc-850'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 shadow-xs flex items-center justify-center text-zinc-200 mb-4">
            <FolderOpen className="w-7 h-7 text-indigo-400" />
          </div>

          <p className="text-base sm:text-lg font-bold text-zinc-100">
            Tap or click to browse system files & folders
          </p>
          <p className="text-xs text-zinc-400 mt-1.5 max-w-md leading-relaxed">
            Opens your device's System File Manager, Downloads, and internal storage. Desktop drag-and-drop also supported.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
            <Button
              variant="primary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                openSystemFilesPicker();
              }}
              leftIcon={<FolderOpen className="w-4 h-4" />}
              className="min-h-[44px] shadow-sm"
            >
              Browse System Files
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                openMediaPicker(e);
              }}
              leftIcon={<ImageIcon className="w-4 h-4 text-zinc-300" />}
              className="min-h-[44px]"
            >
              Photo Gallery
            </Button>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Badge variant="neutral" size="sm">
              JPG / JPEG
            </Badge>
            <Badge variant="neutral" size="sm">
              PNG
            </Badge>
            <Badge variant="neutral" size="sm">
              WEBP
            </Badge>
          </div>
        </div>

        {/* Android Device Tip Box */}
        <div className="p-3.5 rounded-xl bg-zinc-850 border border-zinc-750 text-xs text-zinc-300 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-zinc-200">
              Android Storage Navigation Tip:
            </p>
            <p className="text-zinc-400 leading-relaxed">
              Use <strong className="text-zinc-200">"Browse System Files"</strong> to open your internal storage, Downloads folder, and SD card. If Android opens the Google Photos sheet, you can also tap the <strong className="text-zinc-200">three dots menu (⋮)</strong> or <strong className="text-zinc-200">"Browse"</strong> in the top-right of that sheet to switch to System Files.
            </p>
          </div>
        </div>

        {/* Inspection In-Progress State */}
        {isInspecting && (
          <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-zinc-800/80 border border-zinc-700 text-xs text-zinc-200">
            <Loader2 className="w-4 h-4 animate-spin text-zinc-100" />
            <span>
              Inspecting dimensions and file signatures: {inspectProgress.current} /{' '}
              {inspectProgress.total} files...
            </span>
          </div>
        )}

        {/* Import In-Progress Modal / Bar */}
        {progressState && (
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 text-white shadow-lg flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                Importing {progressState.current} / {progressState.total}
              </span>
              <span className="text-zinc-400">
                {Math.round((progressState.current / Math.max(1, progressState.total)) * 100)}%
              </span>
            </div>

            <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all duration-150"
                style={{
                  width: `${(progressState.current / Math.max(1, progressState.total)) * 100}%`,
                }}
              />
            </div>

            {progressState.currentFilename && (
              <p className="text-xs text-zinc-300 truncate">
                Writing binary blob: <code className="text-sky-300">{progressState.currentFilename}</code>
              </p>
            )}

            <div className="flex items-center gap-4 text-xs text-zinc-400 mt-1">
              <span>Completed: <strong className="text-emerald-400">{progressState.completed}</strong></span>
              {progressState.failed > 0 && (
                <span>Failed: <strong className="text-rose-400">{progressState.failed}</strong></span>
              )}
            </div>
          </div>
        )}

        {/* Last Import Success Notice */}
        {lastImportResult && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800 text-xs flex flex-col gap-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>
                  Successfully imported {lastImportResult.count} images into project storage!
                </span>
              </div>
              {onNavigateToPanels && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onNavigateToPanels}
                  rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                >
                  View in Panel Browser
                </Button>
              )}
            </div>

            {lastImportResult.errors.length > 0 && (
              <div className="mt-2 pt-2 border-t border-emerald-800 text-rose-300">
                <p className="font-semibold mb-1">Encountered {lastImportResult.errors.length} errors:</p>
                <ul className="list-disc pl-5 space-y-1">
                  {lastImportResult.errors.map((err, idx) => (
                    <li key={idx}>
                      <code>{err.filename}</code>: {err.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Preview Confirmation Stage */}
      {previewItems.length > 0 && (
        <Card variant="default" padding="lg" className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-zinc-100">
                  Import Preview ({previewItems.length} items staged)
                </h3>
                <Badge variant="neutral" size="sm">
                  {formatBytes(totalImportBytes)} total
                </Badge>
                {duplicateItems.length > 0 && (
                  <Badge variant="warning" size="sm">
                    {duplicateItems.length} Duplicates
                  </Badge>
                )}
                {invalidItems.length > 0 && (
                  <Badge variant="error" size="sm">
                    {invalidItems.length} Invalid
                  </Badge>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Review image dimensions, duplicate policies, and filenames before confirming storage.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {duplicateItems.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetAllDuplicatesAction('skip')}
                  >
                    Skip All Duplicates
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetAllDuplicatesAction('import_anyway')}
                  >
                    Import All Anyway
                  </Button>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleClearQueue}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Clear
              </Button>

              <Button
                variant="primary"
                size="sm"
                disabled={willImportCount === 0 || isInspecting || Boolean(progressState)}
                onClick={handleExecuteImport}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                className="min-h-[44px]"
              >
                Confirm & Import ({willImportCount})
              </Button>
            </div>
          </div>

          {/* Staged Items List */}
          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
            {previewItems.map((item, index) => {
              const isInvalid = item.status === 'invalid';
              const isDup = item.status === 'duplicate';
              const willBeSkipped = isDup && item.duplicateAction === 'skip';

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors ${
                    isInvalid
                      ? 'bg-rose-950/40 border-rose-800 text-rose-200'
                      : willBeSkipped
                      ? 'bg-zinc-900/60 border-zinc-800 opacity-60'
                      : isDup
                      ? 'bg-amber-950/40 border-amber-800 text-amber-200'
                      : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {/* Left: Thumbnail & Filename info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[11px] font-mono text-zinc-400 shrink-0 w-6">
                      #{index + 1}
                    </span>

                    <div className="w-12 h-12 rounded-lg bg-zinc-800 border border-zinc-700 shrink-0 overflow-hidden flex items-center justify-center">
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.original_filename}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileImage className="w-5 h-5 text-zinc-500" />
                      )}
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <p className="font-semibold text-zinc-200 truncate" title={item.original_filename}>
                        {item.original_filename}
                      </p>
                      <div className="flex items-center gap-2 text-zinc-400 text-[11px] flex-wrap">
                        {item.width > 0 && item.height > 0 ? (
                          <span className="font-mono">
                            {item.width} × {item.height} px
                          </span>
                        ) : null}
                        <span>•</span>
                        <span>{formatBytes(item.file_size)}</span>
                        <span>•</span>
                        <span className="uppercase text-[10px] font-mono">{item.mime_type.replace('image/', '')}</span>
                      </div>

                      {item.errorMessage && (
                        <p className="text-rose-400 text-[11px] font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          {item.errorMessage}
                        </p>
                      )}

                      {item.duplicateReason && (
                        <p className="text-amber-400 text-[11px] flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 shrink-0" />
                          {item.duplicateReason}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions and Duplicate toggle */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {isDup && (
                      <button
                        onClick={() => handleToggleDuplicateAction(item.id)}
                        className={`px-2.5 py-1.5 rounded-lg font-medium text-xs border transition-colors min-h-[36px] ${
                          item.duplicateAction === 'skip'
                            ? 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                            : 'bg-amber-900/60 text-amber-200 border-amber-700 hover:bg-amber-800/80'
                        }`}
                      >
                        {item.duplicateAction === 'skip' ? 'Skipped (Click to Import)' : 'Will Import Anyway'}
                      </button>
                    )}

                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Remove from queue"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};
