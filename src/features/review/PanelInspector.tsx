import React, { useState } from 'react';
import {
  Key,
  FileText,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Copy,
  Check,
  HardDrive,
  Maximize,
  Sparkles,
  RefreshCw,
  FileImage,
  Gauge,
  Cpu,
  Compass,
  Layout,
  Sun,
  Eye,
  Users,
  User,
  Smile,
  Shield,
  Zap,
  MessageSquare,
  Type,
  Quote,
  Volume2,
  MapPin,
  Swords,
  Activity,
  CloudRain,
  Moon,
  SunMedium,
  MoveRight,
  Target,
  Flame,
  Crosshair,
  Maximize2,
  Scan,
  GitMerge,
  ArrowRight,
  Link,
  Split,
} from 'lucide-react';
import { Panel, SourceImage } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { formatBytes } from '../import/image-import.service';
import { PanelAssetInspection } from './asset-inspection.service';
import { getOrCreateProxy, invalidateProxy } from '../analysis/image-preprocessing.service';
import { analyzePanelComposition } from '../analysis/composition-analysis.service';
import { analyzePanelSubjects } from '../analysis/subject-analysis.service';
import { analyzePanelText } from '../analysis/text-analysis.service';
import { analyzePanelSceneAndAction } from '../analysis/scene-action-analysis.service';
import { analyzePanelFocus } from '../analysis/focus-analysis.service';
import { analyzePanelContinuity } from '../analysis/continuity-analysis.service';
import { useProjectStore } from '../../stores/project.store';

interface PanelInspectorProps {
  panel: Panel;
  sourceImage?: SourceImage;
  assetInspection?: PanelAssetInspection;
  totalPanelsCount: number;
}

export const PanelInspector: React.FC<PanelInspectorProps> = ({
  panel,
  sourceImage,
  assetInspection,
  totalPanelsCount,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isGeneratingProxy, setIsGeneratingProxy] = useState(false);
  const [isAnalyzingComposition, setIsAnalyzingComposition] = useState(false);
  const [isAnalyzingSubjects, setIsAnalyzingSubjects] = useState(false);
  const [isAnalyzingText, setIsAnalyzingText] = useState(false);
  const [isAnalyzingSceneAction, setIsAnalyzingSceneAction] = useState(false);
  const [isAnalyzingFocus, setIsAnalyzingFocus] = useState(false);
  const [isAnalyzingContinuity, setIsAnalyzingContinuity] = useState(false);
  const [proxyError, setProxyError] = useState<string | null>(null);
  const [compositionError, setCompositionError] = useState<string | null>(null);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const [sceneActionError, setSceneActionError] = useState<string | null>(null);
  const [focusError, setFocusError] = useState<string | null>(null);
  const [continuityError, setContinuityError] = useState<string | null>(null);

  const updatePanelPreprocessing = useProjectStore((state) => state.updatePanelPreprocessing);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const isAssetValid = assetInspection ? assetInspection.status === 'valid' : Boolean(sourceImage);
  const importOrderDisplay =
    panel.initial_order !== undefined
      ? panel.initial_order + 1
      : sourceImage
      ? sourceImage.source_order + 1
      : '—';

  const visualAnalysis = (panel.visual_analysis && 'analysis_version' in panel.visual_analysis)
    ? panel.visual_analysis
    : null;
  const preprocessing = visualAnalysis?.preprocessing;

  const handleGenerateProxy = async (force: boolean = false) => {
    if (!panel.image_id) return;
    setIsGeneratingProxy(true);
    setProxyError(null);

    try {
      if (force) {
        await invalidateProxy(panel.image_id);
      }
      const result = await getOrCreateProxy(panel.image_id, { forceRegenerate: force });
      await updatePanelPreprocessing(panel.id, result.info);
    } catch (err) {
      console.error('Failed to generate analysis proxy:', err);
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as any).message)
        : 'Failed to generate proxy';
      setProxyError(msg);
    } finally {
      setIsGeneratingProxy(false);
    }
  };

  const composition = visualAnalysis?.composition;
  const compositionStageStatus = visualAnalysis?.stages?.composition || (composition ? 'COMPLETED' : 'NOT_ANALYZED');
  const subjects = visualAnalysis?.subjects;
  const characters = visualAnalysis?.characters;
  const subjectsStageStatus = visualAnalysis?.stages?.subjects || (subjects && subjects.length > 0 ? 'COMPLETED' : 'NOT_ANALYZED');
  const textElements = visualAnalysis?.text_elements;
  const textStageStatus = visualAnalysis?.stages?.text || (textElements && textElements.length > 0 ? 'COMPLETED' : 'NOT_ANALYZED');
  const scene = visualAnalysis?.scene;
  const sceneStageStatus = visualAnalysis?.stages?.scene || (scene ? 'COMPLETED' : 'NOT_ANALYZED');
  const actions = visualAnalysis?.action || [];
  const actionStageStatus = visualAnalysis?.stages?.action || (actions && actions.length > 0 ? 'COMPLETED' : 'NOT_ANALYZED');
  const visualFocus = visualAnalysis?.visual_focus;
  const focusStageStatus = visualAnalysis?.stages?.focus || (visualFocus ? 'COMPLETED' : 'NOT_ANALYZED');
  const cameraAnalysis = visualAnalysis?.camera;
  const cameraStageStatus = visualAnalysis?.stages?.camera || (cameraAnalysis ? 'COMPLETED' : 'NOT_ANALYZED');
  const continuity = visualAnalysis?.continuity;
  const continuityStageStatus = visualAnalysis?.stages?.continuity || (continuity ? 'COMPLETED' : 'NOT_ANALYZED');
  const stageError = visualAnalysis?.error;

  const handleAnalyzeComposition = async (force: boolean = false) => {
    setIsAnalyzingComposition(true);
    setCompositionError(null);

    try {
      const result = await analyzePanelComposition(panel.id || panel.panel_id, {
        forceReanalysis: force,
      });

      if (!result.success && result.error) {
        setCompositionError(result.error.message || 'Composition analysis failed');
      }
    } catch (err: any) {
      console.error('Failed to run composition analysis:', err);
      setCompositionError(err.message || 'Composition analysis failed');
    } finally {
      setIsAnalyzingComposition(false);
    }
  };

  const handleAnalyzeSubjects = async (force: boolean = false) => {
    setIsAnalyzingSubjects(true);
    setSubjectsError(null);

    try {
      const result = await analyzePanelSubjects(panel.id || panel.panel_id, {
        forceReanalysis: force,
      });

      if (!result.success && result.error) {
        setSubjectsError(result.error.message || 'Subject detection failed');
      }
    } catch (err: any) {
      console.error('Failed to run subject detection:', err);
      setSubjectsError(err.message || 'Subject detection failed');
    } finally {
      setIsAnalyzingSubjects(false);
    }
  };

  const handleAnalyzeText = async (force: boolean = false) => {
    setIsAnalyzingText(true);
    setTextError(null);

    try {
      const result = await analyzePanelText(panel.id || panel.panel_id, {
        forceReanalysis: force,
      });

      if (!result.success && result.error) {
        setTextError(result.error.message || 'Text analysis failed');
      }
    } catch (err: any) {
      console.error('Failed to run text analysis:', err);
      setTextError(err.message || 'Text analysis failed');
    } finally {
      setIsAnalyzingText(false);
    }
  };

  const handleAnalyzeSceneAction = async (force: boolean = false) => {
    setIsAnalyzingSceneAction(true);
    setSceneActionError(null);

    try {
      const result = await analyzePanelSceneAndAction(panel.id || panel.panel_id, {
        forceReanalysis: force,
      });

      if (!result.success && result.error) {
        setSceneActionError(result.error.message || 'Scene & action analysis failed');
      }
    } catch (err: any) {
      console.error('Failed to run scene & action analysis:', err);
      setSceneActionError(err.message || 'Scene & action analysis failed');
    } finally {
      setIsAnalyzingSceneAction(false);
    }
  };

  const handleAnalyzeFocus = async (force: boolean = false) => {
    setIsAnalyzingFocus(true);
    setFocusError(null);

    try {
      const result = await analyzePanelFocus(panel.id || panel.panel_id, {
        forceReanalysis: force,
      });

      if (!result.success && result.error) {
        setFocusError(result.error.message || 'Visual focus analysis failed');
      }
    } catch (err: any) {
      console.error('Failed to run visual focus analysis:', err);
      setFocusError(err.message || 'Visual focus analysis failed');
    } finally {
      setIsAnalyzingFocus(false);
    }
  };

  const handleAnalyzeContinuity = async (force: boolean = false) => {
    setIsAnalyzingContinuity(true);
    setContinuityError(null);

    try {
      const result = await analyzePanelContinuity(panel.id || panel.panel_id, {
        forceReanalysis: force,
      });

      if (!result.success && result.error) {
        setContinuityError(result.error.message || 'Visual continuity analysis failed');
      }
    } catch (err: any) {
      console.error('Failed to run visual continuity analysis:', err);
      setContinuityError(err.message || 'Visual continuity analysis failed');
    } finally {
      setIsAnalyzingContinuity(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 text-xs text-zinc-100">
      {/* Identity & Source Information */}
      <Card variant="default" padding="md" className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-zinc-300" />
            <h3 className="font-bold text-zinc-100 text-sm">Identity & Identifiers</h3>
          </div>
          <Badge variant="neutral" size="sm" className="font-mono">
            Read-Only Immutable
          </Badge>
        </div>

        <div className="flex flex-col gap-2.5">
          {/* Original Filename */}
          <div>
            <span className="text-zinc-400 font-medium block text-[11px] mb-0.5">
              Original Filename (Preserved Verbatim)
            </span>
            <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-800/60 border border-zinc-700">
              <span className="font-mono font-bold text-zinc-100 text-xs break-all">
                {sourceImage?.original_filename || 'Unknown'}
              </span>
              {sourceImage?.original_filename && (
                <button
                  onClick={() => copyToClipboard(sourceImage.original_filename, 'filename')}
                  className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors ml-2 shrink-0"
                  title="Copy filename"
                >
                  {copiedKey === 'filename' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Panel ID */}
          <div>
            <span className="text-zinc-400 font-medium block text-[11px] mb-0.5">
              Internal Panel ID (`panel_id`)
            </span>
            <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-800/60 border border-zinc-700">
              <code className="font-mono font-semibold text-purple-300 text-[11px] break-all">
                {panel.id}
              </code>
              <button
                onClick={() => copyToClipboard(panel.id, 'panel_id')}
                className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors ml-2 shrink-0"
                title="Copy Panel ID"
              >
                {copiedKey === 'panel_id' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Source Image ID */}
          <div>
            <span className="text-zinc-400 font-medium block text-[11px] mb-0.5">
              Source Image ID (`image_id`)
            </span>
            <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-800/60 border border-zinc-700">
              <code className="font-mono font-semibold text-indigo-300 text-[11px] break-all">
                {panel.image_id}
              </code>
              <button
                onClick={() => copyToClipboard(panel.image_id, 'image_id')}
                className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors ml-2 shrink-0"
                title="Copy Image ID"
              >
                {copiedKey === 'image_id' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Asset Specifications */}
      <Card variant="default" padding="md" className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-zinc-300" />
            <h3 className="font-bold text-zinc-100 text-sm">Asset Specifications</h3>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700">
            <span className="text-zinc-400 block text-[11px]">MIME Format</span>
            <span className="font-bold text-zinc-100 font-mono text-xs">
              {sourceImage?.mime_type || '—'}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700">
            <span className="text-zinc-400 block text-[11px]">Dimensions</span>
            <span className="font-bold text-zinc-100 font-mono text-xs">
              {sourceImage ? `${sourceImage.width} × ${sourceImage.height} px` : '—'}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700">
            <span className="text-zinc-400 block text-[11px]">Storage File Size</span>
            <span className="font-bold text-zinc-100 font-mono text-xs">
              {sourceImage ? formatBytes(sourceImage.file_size) : '—'}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700">
            <span className="text-zinc-400 block text-[11px]">Aspect Ratio</span>
            <span className="font-bold text-zinc-100 font-mono text-xs">
              {sourceImage && sourceImage.height > 0
                ? (sourceImage.width / sourceImage.height).toFixed(3)
                : '—'}
            </span>
          </div>
        </div>

        {sourceImage?.created_at && (
          <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] pt-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>Imported: {new Date(sourceImage.created_at).toLocaleString()}</span>
          </div>
        )}
      </Card>

      {/* Sequence & Ordering */}
      <Card variant="default" padding="md" className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-zinc-300" />
            <h3 className="font-bold text-zinc-100 text-sm">Sequence & Ordering</h3>
          </div>
          <Badge variant="neutral" size="sm" className="font-mono font-bold">
            Pos #{panel.order + 1}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700">
            <span className="text-zinc-400 block text-[11px]">Current Sequence</span>
            <span className="font-bold text-zinc-100 font-mono text-xs">
              #{panel.order + 1} of {totalPanelsCount}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700">
            <span className="text-zinc-400 block text-[11px]">Original Import Order</span>
            <span className="font-bold text-zinc-300 font-mono text-xs">
              Initial #{importOrderDisplay}
            </span>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700">
          <span className="text-zinc-400 block text-[11px] mb-1">
            Normalized Spatial Coordinates (0.0 – 1.0)
          </span>
          <div className="grid grid-cols-4 gap-1 text-[11px] font-mono text-zinc-200 text-center">
            <div className="bg-zinc-900 p-1 rounded border border-zinc-750">
              x: {panel.boundary.x.toFixed(2)}
            </div>
            <div className="bg-zinc-900 p-1 rounded border border-zinc-750">
              y: {panel.boundary.y.toFixed(2)}
            </div>
            <div className="bg-zinc-900 p-1 rounded border border-zinc-750">
              w: {panel.boundary.width.toFixed(2)}
            </div>
            <div className="bg-zinc-900 p-1 rounded border border-zinc-750">
              h: {panel.boundary.height.toFixed(2)}
            </div>
          </div>
        </div>
      </Card>

      {/* Analysis Proxy & Preprocessing (Part 2.2) */}
      <Card variant="default" padding="md" className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <h3 className="font-bold text-zinc-100 text-sm">Analysis Proxy</h3>
          </div>
          {preprocessing ? (
            <Badge variant="success" size="sm" className="font-mono">
              Ready ({preprocessing.format.split('/')[1] || 'jpeg'})
            </Badge>
          ) : (
            <Badge variant="neutral" size="sm" className="font-mono">
              Not Generated
            </Badge>
          )}
        </div>

        {preprocessing ? (
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-2 rounded-xl bg-zinc-800/60 border border-zinc-700">
              <span className="text-zinc-400 block text-[10px]">Proxy Dimensions</span>
              <span className="font-bold text-indigo-300 font-mono text-xs">
                {preprocessing.analysis_width} × {preprocessing.analysis_height} px
              </span>
            </div>

            <div className="p-2 rounded-xl bg-zinc-800/60 border border-zinc-700">
              <span className="text-zinc-400 block text-[10px]">Scale Factor</span>
              <span className="font-bold text-zinc-100 font-mono text-xs">
                {(preprocessing.scale * 100).toFixed(1)}% ({preprocessing.scale.toFixed(3)})
              </span>
            </div>

            <div className="p-2 rounded-xl bg-zinc-800/60 border border-zinc-700">
              <span className="text-zinc-400 block text-[10px]">Proxy Byte Size</span>
              <span className="font-bold text-zinc-100 font-mono text-xs">
                {preprocessing.proxy_byte_size ? formatBytes(preprocessing.proxy_byte_size) : '—'}
              </span>
            </div>

            <div className="p-2 rounded-xl bg-zinc-800/60 border border-zinc-700">
              <span className="text-zinc-400 block text-[10px]">Pipeline Version</span>
              <span className="font-bold text-zinc-300 font-mono text-xs">
                v{preprocessing.preprocessing_version || '1.0.0'}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-zinc-800/40 border border-dashed border-zinc-700 text-center space-y-1">
            <p className="text-[11px] text-zinc-400">
              Analysis proxy not yet generated. The original binary remains untouched.
            </p>
          </div>
        )}

        {proxyError && (
          <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-[11px] flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{proxyError}</span>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="primary"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => handleGenerateProxy(false)}
            disabled={isGeneratingProxy || !sourceImage}
          >
            {isGeneratingProxy ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Processing...
              </>
            ) : preprocessing ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1.5" />
                Proxy Ready
              </>
            ) : (
              <>
                <FileImage className="w-3.5 h-3.5 mr-1.5" />
                Generate Analysis Proxy
              </>
            )}
          </Button>

          {preprocessing && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => handleGenerateProxy(true)}
              disabled={isGeneratingProxy || !sourceImage}
              title="Force regenerate proxy"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingProxy ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </Card>

      {/* Part 2.3 — Panel Composition & Visual Structure */}
      <Card variant="default" padding="md" className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Layout className="w-4 h-4 text-sky-400" />
            <h3 className="font-bold text-zinc-100 text-sm">Composition & Visual Structure</h3>
          </div>
          {(() => {
            switch (compositionStageStatus) {
              case 'COMPLETED':
                return (
                  <Badge variant="success" size="sm">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Analyzed
                  </Badge>
                );
              case 'ANALYZING':
                return (
                  <Badge variant="info" size="sm" className="animate-pulse">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Analyzing
                  </Badge>
                );
              case 'FAILED':
                return (
                  <Badge variant="error" size="sm">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Failed
                  </Badge>
                );
              default:
                return (
                  <Badge variant="neutral" size="sm">
                    Not Analyzed
                  </Badge>
                );
            }
          })()}
        </div>

        {composition ? (
          <div className="flex flex-col gap-3">
            {/* Primary Framing & Density Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-xl bg-zinc-800/60 border border-zinc-700/80 flex flex-col gap-0.5">
                <span className="text-[11px] text-zinc-400 font-medium">Shot Scale</span>
                <span className="font-bold text-zinc-100 capitalize">
                  {composition.shot_scale?.replace(/-/g, ' ') || 'Unknown'}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-800/60 border border-zinc-700/80 flex flex-col gap-0.5">
                <span className="text-[11px] text-zinc-400 font-medium">Framing</span>
                <span className="font-bold text-zinc-100 capitalize">
                  {composition.framing?.replace(/_/g, ' ') || 'Unknown'}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-800/60 border border-zinc-700/80 flex flex-col gap-0.5">
                <span className="text-[11px] text-zinc-400 font-medium">Visual Density</span>
                <span className="font-bold text-zinc-100 capitalize">
                  {composition.visual_density?.replace(/_/g, ' ') || 'Balanced'}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-800/60 border border-zinc-700/80 flex flex-col gap-0.5">
                <span className="text-[11px] text-zinc-400 font-medium">Orientation</span>
                <span className="font-bold text-zinc-100 capitalize">
                  {composition.dominant_orientation || 'Mixed'}
                </span>
              </div>
            </div>

            {/* Depth & Visual Layering */}
            {(composition.foreground_importance !== undefined ||
              composition.middleground_importance !== undefined ||
              composition.background_importance !== undefined) && (
              <div className="p-2.5 rounded-xl bg-zinc-800/40 border border-zinc-700/60 flex flex-col gap-2">
                <span className="text-[11px] font-semibold text-zinc-300">Depth & Visual Layering</span>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">Foreground</span>
                    <span className="font-mono text-zinc-200">
                      {Math.round((composition.foreground_importance ?? 0) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-700/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-400 rounded-full"
                      style={{ width: `${(composition.foreground_importance ?? 0) * 100}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">Middleground</span>
                    <span className="font-mono text-zinc-200">
                      {Math.round((composition.middleground_importance ?? 0) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-700/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-400 rounded-full"
                      style={{ width: `${(composition.middleground_importance ?? 0) * 100}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">Background</span>
                    <span className="font-mono text-zinc-200">
                      {Math.round((composition.background_importance ?? 0) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-700/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-400 rounded-full"
                      style={{ width: `${(composition.background_importance ?? 0) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Visual Hierarchy & Dominant Regions */}
            {composition.dominant_regions && composition.dominant_regions.length > 0 && (
              <div className="p-2.5 rounded-xl bg-zinc-800/40 border border-zinc-700/60 flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-zinc-300">
                  Dominant Visual Regions ({composition.dominant_regions.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {composition.dominant_regions.map((r, i) => (
                    <div
                      key={r.region_id || i}
                      className="px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center gap-1.5 text-[10px]"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                      <span className="font-medium text-zinc-200">{r.label}</span>
                      <span className="font-mono text-zinc-400">
                        [{Math.round(r.box.x * 100)},{Math.round(r.box.y * 100)} {Math.round(r.box.width * 100)}×{Math.round(r.box.height * 100)}%]
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Atmosphere & Lighting */}
            {(composition.lighting_mood || composition.tonal_range || composition.negative_space) && (
              <div className="p-2.5 rounded-xl bg-zinc-800/40 border border-zinc-700/60 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400 font-medium">Negative Space</span>
                  <span className="font-semibold text-zinc-200 capitalize">
                    {composition.negative_space || 'Low'}
                  </span>
                </div>
                {composition.tonal_range && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400 font-medium">Tonal Range</span>
                    <span className="font-semibold text-zinc-200 capitalize">
                      {composition.tonal_range.replace(/_/g, ' ')}
                    </span>
                  </div>
                )}
                {composition.lighting_mood && (
                  <div className="text-[11px] text-zinc-300 bg-zinc-800/80 p-2 rounded-lg border border-zinc-700">
                    <span className="text-zinc-400 font-medium block text-[10px] mb-0.5">Lighting Mood</span>
                    {composition.lighting_mood}
                  </div>
                )}
              </div>
            )}

            {/* Summary */}
            {composition.summary && (
              <div className="p-2.5 rounded-xl bg-zinc-800/40 border border-zinc-700/60 text-[11px] text-zinc-300">
                <span className="text-zinc-400 font-semibold block text-[10px] mb-1">Composition Summary</span>
                <p className="leading-relaxed">{composition.summary}</p>
              </div>
            )}

            {/* Confidence & Provenance */}
            <div className="flex items-center justify-between pt-1 border-t border-zinc-800 text-[10px] text-zinc-400 font-mono">
              <span>Confidence: {Math.round((composition.confidence ?? 0.8) * 100)}%</span>
              {composition.source && (
                <span>
                  {composition.source.provider}/{composition.source.model || 'model'} (v{composition.source.prompt_version || '1.0'})
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-zinc-800/30 border border-zinc-800 text-center gap-2">
            <Compass className="w-6 h-6 text-zinc-500" />
            <div className="flex flex-col">
              <span className="text-zinc-300 font-medium text-xs">No Composition Analysis</span>
              <span className="text-zinc-500 text-[11px]">
                Run Part 2.3 analysis to extract shot framing, visual layers, spatial density, and lighting.
              </span>
            </div>
          </div>
        )}

        {/* Error notification if failed */}
        {(compositionError || (stageError && stageError.stage === 'composition')) && (
          <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 flex flex-col gap-1 text-[11px]">
            <div className="flex items-center gap-1.5 font-bold text-rose-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Composition Analysis Error</span>
            </div>
            <p className="leading-tight text-rose-200/90">
              {compositionError || stageError?.message}
            </p>
            {stageError?.code && (
              <span className="font-mono text-[10px] text-rose-400/80">Code: {stageError.code}</span>
            )}
          </div>
        )}

        {/* Analysis Action Controls */}
        <div className="flex items-center gap-2 pt-1 border-t border-zinc-800">
          <Button
            variant="primary"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => handleAnalyzeComposition(Boolean(composition))}
            disabled={isAnalyzingComposition || !sourceImage}
          >
            {isAnalyzingComposition ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Analyzing Composition...
              </>
            ) : composition ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Re-Analyze Composition
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Analyze Composition
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Part 2.4 — Subjects & Character Detection */}
      <Card variant="default" padding="md" className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-zinc-100 text-sm">Subjects & Characters</h3>
          </div>
          {(() => {
            switch (subjectsStageStatus) {
              case 'COMPLETED':
                return (
                  <Badge variant="success" size="sm">
                    <CheckCircle2 className="w-3 h-3 mr-0.5" />
                    Detected
                  </Badge>
                );
              case 'ANALYZING':
                return (
                  <Badge variant="info" size="sm" className="animate-pulse">
                    <Sparkles className="w-3 h-3 mr-0.5" />
                    Detecting
                  </Badge>
                );
              case 'FAILED':
                return (
                  <Badge variant="error" size="sm">
                    <AlertCircle className="w-3 h-3 mr-0.5" />
                    Failed
                  </Badge>
                );
              case 'NOT_ANALYZED':
              default:
                return (
                  <Badge variant="neutral" size="sm">
                    Not analyzed
                  </Badge>
                );
            }
          })()}
        </div>

        {/* Content if detected */}
        {((characters && characters.length > 0) || (subjects && subjects.length > 0)) ? (
          <div className="flex flex-col gap-3">
            {/* Quick Metrics Header */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-xl bg-zinc-800/60 border border-zinc-700/60 flex flex-col">
                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Human Characters</span>
                <span className="text-sm font-bold text-cyan-300">
                  {characters?.length || 0} {characters?.length === 1 ? 'figure' : 'figures'}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-800/60 border border-zinc-700/60 flex flex-col">
                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Total Subjects</span>
                <span className="text-sm font-bold text-zinc-200">
                  {subjects?.length || 0} {subjects?.length === 1 ? 'subject' : 'subjects'}
                </span>
              </div>
            </div>

            {/* Detected Characters List */}
            {characters && characters.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  Visible Characters ({characters.length})
                </span>
                <div className="flex flex-col gap-2">
                  {characters.map((char, i) => (
                    <div
                      key={char.detection_id || i}
                      className="p-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700/70 flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-zinc-100 text-[11px]">
                          {char.label || `Character ${i + 1}`}
                        </span>
                        <Badge variant="purple" size="sm" className="font-mono text-[9px]">
                          {Math.round((char.confidence ?? 0.9) * 100)}% conf
                        </Badge>
                      </div>

                      {/* Character Attributes Pills */}
                      <div className="flex flex-wrap items-center gap-1">
                        {char.visibility && (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-700/60 text-zinc-300 font-medium text-[9px] capitalize">
                            {char.visibility.replace(/_/g, ' ')}
                          </span>
                        )}
                        {char.screen_position && (
                          <span className="px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/50 text-[9px] capitalize font-medium">
                            {char.screen_position}
                          </span>
                        )}
                        {char.expression && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-950/50 text-amber-300 border border-amber-800/40 text-[9px] flex items-center gap-1 font-medium capitalize">
                            <Smile className="w-2.5 h-2.5" />
                            {char.expression}
                          </span>
                        )}
                        {char.pose && (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 text-[9px] capitalize">
                            {char.pose}
                          </span>
                        )}
                        {char.face_region && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-950/50 text-emerald-300 border border-emerald-800/40 text-[9px] font-medium">
                            Face Region
                          </span>
                        )}
                      </div>

                      {/* Action details if present */}
                      {char.action && (
                        <div className="text-[10px] text-zinc-400 bg-zinc-900/60 px-2 py-1 rounded border border-zinc-800">
                          <span className="text-zinc-500 font-medium mr-1">Action:</span>
                          {char.action}
                        </div>
                      )}

                      {/* Spatial Bounding Coordinates */}
                      <div className="flex items-center justify-between text-[9px] text-zinc-500 font-mono pt-0.5">
                        <span>Box: [{Math.round(char.bounding_box.x * 100)}%, {Math.round(char.bounding_box.y * 100)}% {Math.round(char.bounding_box.width * 100)}×{Math.round(char.bounding_box.height * 100)}%]</span>
                        {char.face_region && (
                          <span>Face: [{Math.round(char.face_region.x * 100)}%, {Math.round(char.face_region.y * 100)}%]</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Non-Human / Supporting Subjects List */}
            {subjects && subjects.filter((s) => s.type !== 'character').length > 0 && (
              <div className="flex flex-col gap-1.5 pt-1 border-t border-zinc-800">
                <span className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-400" />
                  Objects, Effects & Environment ({subjects.filter((s) => s.type !== 'character').length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {subjects
                    .filter((s) => s.type !== 'character')
                    .map((subj, i) => (
                      <div
                        key={subj.subject_id || i}
                        className="px-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 flex flex-col gap-1 text-[10px]"
                      >
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant={
                              subj.type === 'weapon'
                                ? 'warning'
                                : subj.type === 'effect'
                                ? 'purple'
                                : subj.type === 'creature'
                                ? 'error'
                                : 'neutral'
                            }
                            size="sm"
                            className="capitalize text-[9px] px-1 py-0"
                          >
                            {subj.type}
                          </Badge>
                          <span className="font-semibold text-zinc-200">{subj.label}</span>
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-zinc-400 font-mono">
                          <span className="capitalize">{subj.importance || 'secondary'}</span>
                          <span>{Math.round(subj.confidence * 100)}%</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-zinc-800/30 border border-zinc-800 text-center gap-2">
            <Users className="w-6 h-6 text-zinc-500" />
            <div className="flex flex-col">
              <span className="text-zinc-300 font-medium text-xs">No Subjects Detected</span>
              <span className="text-zinc-500 text-[11px]">
                Run Part 2.4 analysis to identify visible characters, faces, postures, weapons, effects, and spatial bounds.
              </span>
            </div>
          </div>
        )}

        {/* Error notification if failed */}
        {(subjectsError || (stageError && stageError.stage === 'subjects')) && (
          <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 flex flex-col gap-1 text-[11px]">
            <div className="flex items-center gap-1.5 font-bold text-rose-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Subject Detection Error</span>
            </div>
            <p className="leading-tight text-rose-200/90">
              {subjectsError || stageError?.message}
            </p>
            {stageError?.code && (
              <span className="font-mono text-[10px] text-rose-400/80">Code: {stageError.code}</span>
            )}
          </div>
        )}

        {/* Analysis Action Controls */}
        <div className="flex items-center gap-2 pt-1 border-t border-zinc-800">
          <Button
            variant="primary"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => handleAnalyzeSubjects(Boolean(subjects && subjects.length > 0))}
            disabled={isAnalyzingSubjects || !sourceImage}
          >
            {isAnalyzingSubjects ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Detecting Subjects & Characters...
              </>
            ) : (subjects && subjects.length > 0) || (characters && characters.length > 0) ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Re-Detect Subjects & Characters
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Detect Subjects & Characters
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Dialogue, Speech-Bubble, Text & SFX Analysis (Part 2.5) */}
      <Card variant="default" padding="md" className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-zinc-100 text-sm">Dialogue & Text (Part 2.5)</h3>
          </div>
          <div className="flex items-center gap-1.5">
            {textElements && textElements.length > 0 && (
              <Badge variant="success" size="sm">
                {textElements.length} {textElements.length === 1 ? 'element' : 'elements'}
              </Badge>
            )}
            <Badge variant="neutral" size="sm" className="font-mono">
              Stage 2.5
            </Badge>
          </div>
        </div>

        {/* Text Elements Content */}
        {textElements && textElements.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-zinc-400 text-[11px]">
              <span className="font-medium">Reading Order Sequence</span>
              <span className="font-mono text-[10px] text-zinc-500">Top-to-Bottom Flow</span>
            </div>

            <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1">
              {textElements.map((el, i) => {
                const isDialogue = el.type === 'dialogue';
                const isThought = el.type === 'thought';
                const isNarration = el.type === 'narration';
                const isSfx = el.type === 'sfx';
                const isSystem = el.type === 'system_ui';
                const isSign = el.type === 'sign';
                const isWhisper = el.type === 'whisper';
                const isShout = el.type === 'shout';

                let badgeVariant: 'success' | 'purple' | 'warning' | 'error' | 'info' | 'neutral' = 'success';
                if (isThought || isWhisper) badgeVariant = 'purple';
                else if (isNarration) badgeVariant = 'warning';
                else if (isSfx || isShout) badgeVariant = 'error';
                else if (isSystem) badgeVariant = 'info';
                else if (isSign) badgeVariant = 'neutral';

                const elementKey = el.text_id || `txt_${i}`;

                return (
                  <div
                    key={elementKey}
                    className="p-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700/80 flex flex-col gap-1.5 hover:border-zinc-600 transition-colors"
                  >
                    {/* Header Row: Order, Type, Speaker, Confidence */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-zinc-400 text-[10px] bg-zinc-900 px-1.5 py-0.5 rounded-md border border-zinc-800">
                          #{el.reading_order !== undefined ? el.reading_order + 1 : i + 1}
                        </span>
                        <Badge variant={badgeVariant} size="sm" className="capitalize text-[10px] px-1.5 py-0.2">
                          {el.type}
                        </Badge>
                        {el.speaker_reference && (
                          <span className="text-[10px] text-cyan-300 bg-cyan-950/70 border border-cyan-800/60 px-1.5 py-0.2 rounded-md font-mono">
                            {el.speaker_reference}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-400">
                        {el.ocr_confidence !== undefined && (
                          <span title="OCR Confidence">
                            OCR: {Math.round(el.ocr_confidence * 100)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Verbatim Text Content */}
                    <div className="relative group/copy">
                      <div className="p-2 rounded-lg bg-zinc-900/90 border border-zinc-800 font-sans text-xs text-zinc-100 leading-relaxed break-words pr-7 select-text">
                        {el.content ? (
                          <span>{el.content}</span>
                        ) : (
                          <span className="italic text-zinc-500">[empty or unreadable text]</span>
                        )}
                      </div>
                      {el.content && (
                        <button
                          onClick={() => copyToClipboard(el.content, elementKey)}
                          className="absolute top-1.5 right-1.5 p-1 rounded-md bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                          title="Copy verbatim text"
                        >
                          {copiedKey === elementKey ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Spatial Coordinates Footer */}
                    <div className="flex items-center justify-between text-[9px] text-zinc-500 font-mono pt-0.5">
                      <span>
                        Box: [{Math.round(el.bounding_box.x * 100)}%, {Math.round(el.bounding_box.y * 100)}% {Math.round(el.bounding_box.width * 100)}×{Math.round(el.bounding_box.height * 100)}%]
                      </span>
                      <span>Source: {el.source || 'ai'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-zinc-800/30 border border-zinc-800 text-center gap-2">
            <MessageSquare className="w-6 h-6 text-zinc-500" />
            <div className="flex flex-col">
              <span className="text-zinc-300 font-medium text-xs">No Dialogue or Text Analyzed</span>
              <span className="text-zinc-500 text-[11px]">
                Run Part 2.5 text analysis to detect speech bubbles, dialogue, narration, sound effects (SFX), and reading order.
              </span>
            </div>
          </div>
        )}

        {/* Error notification if failed */}
        {(textError || (stageError && stageError.stage === 'text')) && (
          <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 flex flex-col gap-1 text-[11px]">
            <div className="flex items-center gap-1.5 font-bold text-rose-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Text Analysis Error</span>
            </div>
            <p className="leading-tight text-rose-200/90">
              {textError || stageError?.message}
            </p>
            {stageError?.code && (
              <span className="font-mono text-[10px] text-rose-400/80">Code: {stageError.code}</span>
            )}
          </div>
        )}

        {/* Analysis Action Controls */}
        <div className="flex items-center gap-2 pt-1 border-t border-zinc-800">
          <Button
            variant="primary"
            size="sm"
            className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
            onClick={() => handleAnalyzeText(Boolean(textElements && textElements.length > 0))}
            disabled={isAnalyzingText || !sourceImage}
          >
            {isAnalyzingText ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Analyzing Text & Dialogue...
              </>
            ) : textElements && textElements.length > 0 ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Re-Analyze Text & Dialogue
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Analyze Text & Dialogue
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Part 2.6: Scene & Environment Context */}
      <Card variant="default" padding="md" className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-zinc-100 text-sm">Scene & Environment</h3>
          </div>
          {scene ? (
            <Badge variant="success" size="sm">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Environment Detected
            </Badge>
          ) : (
            <Badge variant="neutral" size="sm">
              Not analyzed
            </Badge>
          )}
        </div>

        {scene ? (
          <div className="flex flex-col gap-3">
            {/* Setting badges */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700/60">
                <span className="text-[11px] text-zinc-400 font-medium">Setting Type</span>
                <div className="flex items-center gap-1.5">
                  {scene.indoor_outdoor === 'indoor' ? (
                    <Badge variant="info" size="sm">
                      Indoor
                    </Badge>
                  ) : scene.indoor_outdoor === 'outdoor' ? (
                    <Badge variant="success" size="sm">
                      Outdoor
                    </Badge>
                  ) : scene.indoor_outdoor === 'abstract' ? (
                    <Badge variant="purple" size="sm">
                      Abstract / Effects
                    </Badge>
                  ) : (
                    <Badge variant="neutral" size="sm">
                      {scene.indoor_outdoor || 'Unclear'}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700/60">
                <span className="text-[11px] text-zinc-400 font-medium">Time Context</span>
                <div className="flex items-center gap-1.5">
                  {scene.time_context === 'day' ? (
                    <Badge variant="warning" size="sm">
                      <SunMedium className="w-3 h-3 mr-1 text-amber-400" />
                      Daytime
                    </Badge>
                  ) : scene.time_context === 'night' ? (
                    <Badge variant="purple" size="sm">
                      <Moon className="w-3 h-3 mr-1 text-indigo-400" />
                      Night
                    </Badge>
                  ) : scene.time_context === 'sunset' || scene.time_context === 'dusk' ? (
                    <Badge variant="warning" size="sm">
                      <SunMedium className="w-3 h-3 mr-1 text-orange-400" />
                      {scene.time_context}
                    </Badge>
                  ) : scene.time_context === 'dawn' ? (
                    <Badge variant="info" size="sm">
                      Dawn
                    </Badge>
                  ) : (
                    <Badge variant="neutral" size="sm">
                      {scene.time_context || 'Timeless'}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Location & Environment Details */}
            {(scene.location || scene.environment) && (
              <div className="p-2.5 rounded-xl bg-zinc-800/40 border border-zinc-700/50 flex flex-col gap-1.5">
                {scene.location && (
                  <div>
                    <span className="text-[11px] text-zinc-400 block font-medium">Location</span>
                    <span className="text-zinc-200 text-xs font-semibold">{scene.location}</span>
                  </div>
                )}
                {scene.environment && (
                  <div>
                    <span className="text-[11px] text-zinc-400 block font-medium">Environment Detail</span>
                    <span className="text-zinc-300 text-xs">{scene.environment}</span>
                  </div>
                )}
              </div>
            )}

            {/* Lighting, Weather & Atmosphere */}
            <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-zinc-800/30 border border-zinc-700/40">
              {scene.lighting && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Lighting</span>
                  <span className="text-zinc-200 font-medium text-right max-w-[65%] truncate">{scene.lighting}</span>
                </div>
              )}
              {scene.weather && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Weather</span>
                  <span className="text-zinc-200 font-medium text-right max-w-[65%] truncate">{scene.weather}</span>
                </div>
              )}
              {scene.atmosphere && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Atmosphere</span>
                  <span className="text-zinc-200 font-medium text-right max-w-[65%] truncate">{scene.atmosphere}</span>
                </div>
              )}
              {scene.confidence !== undefined && (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-800">
                  <span className="text-zinc-400">Confidence</span>
                  <span className="font-mono text-cyan-400">{Math.round(scene.confidence * 100)}%</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-zinc-800/30 border border-zinc-800 text-center gap-2">
            <MapPin className="w-6 h-6 text-zinc-500" />
            <div className="flex flex-col">
              <span className="text-zinc-300 font-medium text-xs">No Scene Context Analyzed</span>
              <span className="text-zinc-500 text-[11px]">
                Run Part 2.6 analysis to extract indoor/outdoor classification, time of day, environment, weather, and lighting.
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Part 2.6: Physical Actions & Dynamics */}
      <Card variant="default" padding="md" className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-orange-400" />
            <h3 className="font-bold text-zinc-100 text-sm">Physical Actions & Dynamics</h3>
          </div>
          {actions && actions.length > 0 ? (
            <Badge variant="warning" size="sm">
              <Activity className="w-3 h-3 mr-1" />
              {actions.length} Action{actions.length > 1 ? 's' : ''}
            </Badge>
          ) : (
            <Badge variant="neutral" size="sm">
              {actions ? '0 Actions' : 'Not analyzed'}
            </Badge>
          )}
        </div>

        {actions && actions.length > 0 ? (
          <div className="flex flex-col gap-2">
            {actions.map((act, idx) => {
              const intensityVariant =
                act.intensity === 'explosive'
                  ? 'error'
                  : act.intensity === 'high'
                  ? 'warning'
                  : act.intensity === 'moderate'
                  ? 'info'
                  : 'neutral';

              return (
                <div
                  key={act.action_id || idx}
                  className="flex flex-col gap-2 p-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700/60"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-zinc-100 text-xs uppercase tracking-wide">
                        {act.type}
                      </span>
                      {act.intensity && (
                        <Badge variant={intensityVariant as any} size="sm">
                          {act.intensity === 'explosive' && <Flame className="w-2.5 h-2.5 mr-0.5" />}
                          {act.intensity}
                        </Badge>
                      )}
                    </div>
                    {act.confidence !== undefined && (
                      <span className="text-[10px] font-mono text-zinc-400">
                        {Math.round(act.confidence * 100)}% conf
                      </span>
                    )}
                  </div>

                  {act.description && (
                    <p className="text-zinc-300 text-xs leading-relaxed">{act.description}</p>
                  )}

                  {/* Actor / Target / Trajectory metadata */}
                  <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-zinc-700/40 text-[11px]">
                    {act.actor_subject_id && (
                      <div className="flex items-center gap-1 bg-zinc-900/60 px-2 py-0.5 rounded border border-zinc-700/50">
                        <span className="text-zinc-400">Actor:</span>
                        <span className="font-mono text-zinc-200 font-medium">{act.actor_subject_id}</span>
                      </div>
                    )}

                    {act.target_subject_id && (
                      <div className="flex items-center gap-1 bg-zinc-900/60 px-2 py-0.5 rounded border border-zinc-700/50">
                        <MoveRight className="w-3 h-3 text-zinc-400" />
                        <span className="text-zinc-400">Target:</span>
                        <span className="font-mono text-zinc-200 font-medium">{act.target_subject_id}</span>
                      </div>
                    )}

                    {act.direction && (
                      <div className="flex items-center gap-1 text-zinc-400">
                        <Target className="w-3 h-3 text-zinc-500" />
                        <span>{act.direction}</span>
                      </div>
                    )}

                    {act.temporal_context && (
                      <div className="flex items-center gap-1 text-zinc-400 ml-auto">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase">{act.temporal_context}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-zinc-800/30 border border-zinc-800 text-center gap-2">
            <Swords className="w-6 h-6 text-zinc-500" />
            <div className="flex flex-col">
              <span className="text-zinc-300 font-medium text-xs">No Physical Actions Detected</span>
              <span className="text-zinc-500 text-[11px]">
                Run Part 2.6 analysis to detect combat strikes, defense, movement vectors, and subject interactions.
              </span>
            </div>
          </div>
        )}

        {/* Error notification if failed */}
        {(sceneActionError || (stageError && stageError.stage === 'scene_and_action')) && (
          <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 flex flex-col gap-1 text-[11px]">
            <div className="flex items-center gap-1.5 font-bold text-rose-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Scene & Action Analysis Error</span>
            </div>
            <p className="leading-tight text-rose-200/90">
              {sceneActionError || stageError?.message}
            </p>
            {stageError?.code && (
              <span className="font-mono text-[10px] text-rose-400/80">Code: {stageError.code}</span>
            )}
          </div>
        )}

        {/* Analysis Action Controls */}
        <div className="flex items-center gap-2 pt-1 border-t border-zinc-800">
          <Button
            variant="primary"
            size="sm"
            className="flex-1 text-xs bg-orange-600 hover:bg-orange-500 text-white"
            onClick={() => handleAnalyzeSceneAction(Boolean(scene || (actions && actions.length > 0)))}
            disabled={isAnalyzingSceneAction || !sourceImage}
          >
            {isAnalyzingSceneAction ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Analyzing Scene & Actions...
              </>
            ) : scene || (actions && actions.length > 0) ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Re-Analyze Scene & Actions
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Analyze Scene & Actions
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Part 2.7: Visual Focus & Salience Hierarchy */}
      <Card variant="default" padding="md" className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-zinc-100 text-sm">Visual Salience & Focus</h3>
          </div>
          {visualFocus ? (
            <Badge variant="warning" size="sm">
              <Target className="w-3 h-3 mr-1" />
              Focus Identified
            </Badge>
          ) : (
            <Badge variant="neutral" size="sm">
              Not analyzed
            </Badge>
          )}
        </div>

        {visualFocus ? (
          <div className="flex flex-col gap-3">
            {/* Primary Visual Focus Target */}
            <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/40 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-bold text-amber-400">
                  Primary Visual Focus
                </span>
                <div className="flex items-center gap-1.5">
                  {visualFocus.primary_target?.type && (
                    <Badge variant="warning" size="sm">
                      {visualFocus.primary_target.type.toUpperCase()}
                    </Badge>
                  )}
                  {visualFocus.importance !== undefined && (
                    <Badge variant="neutral" size="sm" className="font-mono">
                      {Math.round(visualFocus.importance * 100)}% salience
                    </Badge>
                  )}
                </div>
              </div>

              {/* Linked entity ID & Region */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {visualFocus.primary_target?.subject_id && (
                  <div className="flex items-center gap-1 bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-700">
                    <span className="text-zinc-400">Target Ref:</span>
                    <span className="font-mono text-amber-300 font-medium">
                      {visualFocus.primary_target.subject_id}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1 bg-zinc-900/60 px-2 py-0.5 rounded border border-zinc-800 font-mono text-[10px] text-zinc-400">
                  <span>Region:</span>
                  <span>
                    [{Math.round(visualFocus.focus_region.x * 100)}%, {Math.round(visualFocus.focus_region.y * 100)}%, {Math.round(visualFocus.focus_region.width * 100)}%w, {Math.round(visualFocus.focus_region.height * 100)}%h]
                  </span>
                </div>
              </div>

              {/* Observable Reason */}
              {visualFocus.reason && (
                <p className="text-zinc-300 text-xs leading-relaxed italic">
                  "{visualFocus.reason}"
                </p>
              )}
            </div>

            {/* Secondary Focus Targets */}
            {visualFocus.secondary_targets && visualFocus.secondary_targets.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">
                  Secondary Focal Points ({visualFocus.secondary_targets.length})
                </span>
                <div className="flex flex-col gap-1.5">
                  {visualFocus.secondary_targets.map((sec, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/40 border border-zinc-700/50 text-xs"
                    >
                      <div className="flex items-center gap-1.5">
                        <Badge variant="neutral" size="sm">
                          {sec.type}
                        </Badge>
                        {sec.subject_id && (
                          <span className="font-mono text-zinc-300 font-medium text-[11px]">
                            {sec.subject_id}
                          </span>
                        )}
                        {sec.description && (
                          <span className="text-zinc-400 text-[11px] truncate max-w-[200px]">
                            {sec.description}
                          </span>
                        )}
                      </div>
                      {sec.region && (
                        <span className="font-mono text-[10px] text-zinc-500 shrink-0">
                          {Math.round(sec.region.width * 100)}%×{Math.round(sec.region.height * 100)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Descriptive Camera Framing & Safe Regions */}
            {cameraAnalysis && (
              <div className="flex flex-col gap-1.5 pt-2 border-t border-zinc-800">
                <span className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">
                  Descriptive Spatial Bounds & Safe Interest Areas
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {cameraAnalysis.shot_type && (
                    <div className="p-2 rounded-lg bg-zinc-800/30 border border-zinc-700/40 flex flex-col gap-0.5">
                      <span className="text-[10px] text-zinc-500">Framing Scale</span>
                      <span className="text-zinc-200 font-medium capitalize">{cameraAnalysis.shot_type}</span>
                    </div>
                  )}
                  {cameraAnalysis.zoom_potential && (
                    <div className="p-2 rounded-lg bg-zinc-800/30 border border-zinc-700/40 flex flex-col gap-0.5">
                      <span className="text-[10px] text-zinc-500">Zoom Headroom</span>
                      <span className="text-zinc-200 font-medium capitalize">{cameraAnalysis.zoom_potential}</span>
                    </div>
                  )}
                  {cameraAnalysis.pan_potential && (
                    <div className="p-2 rounded-lg bg-zinc-800/30 border border-zinc-700/40 flex flex-col gap-0.5">
                      <span className="text-[10px] text-zinc-500">Pan Viability</span>
                      <span className="text-zinc-200 font-medium capitalize">{cameraAnalysis.pan_potential.replace('_', ' ')}</span>
                    </div>
                  )}
                  {cameraAnalysis.safe_regions && (
                    <div className="p-2 rounded-lg bg-zinc-800/30 border border-zinc-700/40 flex flex-col gap-0.5">
                      <span className="text-[10px] text-zinc-500">Safe Regions</span>
                      <span className="text-zinc-200 font-medium">{cameraAnalysis.safe_regions.length} Defined</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-zinc-800/30 border border-zinc-800 text-center gap-2">
            <Crosshair className="w-6 h-6 text-zinc-500" />
            <div className="flex flex-col">
              <span className="text-zinc-300 font-medium text-xs">No Visual Focus Analyzed</span>
              <span className="text-zinc-500 text-[11px]">
                Run Part 2.7 analysis to extract primary focal point, secondary interest regions, and descriptive camera-safe boundaries.
              </span>
            </div>
          </div>
        )}

        {/* Error notification if failed */}
        {(focusError || (stageError && stageError.stage === 'focus')) && (
          <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 flex flex-col gap-1 text-[11px]">
            <div className="flex items-center gap-1.5 font-bold text-rose-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Visual Focus Analysis Error</span>
            </div>
            <p className="leading-tight text-rose-200/90">
              {focusError || stageError?.message}
            </p>
            {stageError?.code && (
              <span className="font-mono text-[10px] text-rose-400/80">Code: {stageError.code}</span>
            )}
          </div>
        )}

        {/* Analysis Action Controls */}
        <div className="flex items-center gap-2 pt-1 border-t border-zinc-800">
          <Button
            variant="primary"
            size="sm"
            className="flex-1 text-xs bg-amber-600 hover:bg-amber-500 text-white"
            onClick={() => handleAnalyzeFocus(Boolean(visualFocus))}
            disabled={isAnalyzingFocus || !sourceImage}
          >
            {isAnalyzingFocus ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Analyzing Focus & Salience...
              </>
            ) : visualFocus ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Re-Analyze Focus & Salience
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Analyze Focus & Salience
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Visual Continuity & Cross-Panel Relationships (Part 2.8) */}
      <Card variant="default" padding="md" className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
          <div className="flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-fuchsia-400" />
            <h3 className="font-bold text-zinc-100 text-sm">Visual Continuity & Relationships</h3>
          </div>
          <div className="flex items-center gap-1.5">
            {(() => {
              switch (continuityStageStatus) {
                case 'COMPLETED':
                  return (
                    <Badge variant="purple" size="sm">
                      <CheckCircle2 className="w-3 h-3 mr-0.5" />
                      {continuity?.transition_type ? continuity.transition_type.replace(/_/g, ' ') : 'Verified'}
                    </Badge>
                  );
                case 'ANALYZING':
                  return (
                    <Badge variant="info" size="sm" className="animate-pulse">
                      <Sparkles className="w-3 h-3 mr-0.5" />
                      Tracking
                    </Badge>
                  );
                case 'FAILED':
                  return (
                    <Badge variant="error" size="sm">
                      <AlertCircle className="w-3 h-3 mr-0.5" />
                      Failed
                    </Badge>
                  );
                case 'NOT_ANALYZED':
                default:
                  return (
                    <Badge variant="neutral" size="sm">
                      Stage 2.8
                    </Badge>
                  );
              }
            })()}
          </div>
        </div>

        {continuity ? (
          <div className="flex flex-col gap-3">
            {/* Transition Type & Sequence Position */}
            <div className="p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-zinc-400">Transition Classification</span>
                <Badge variant="purple" size="sm" className="font-mono uppercase font-bold">
                  {continuity.transition_type}
                </Badge>
              </div>
              {continuity.confidence !== undefined && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400">Sequence Confidence</span>
                  <span className="font-mono font-bold text-fuchsia-300">
                    {Math.round(continuity.confidence * 100)}%
                  </span>
                </div>
              )}
              {continuity.summary && (
                <p className="text-[11px] text-zinc-300 bg-zinc-900/70 p-2 rounded-lg border border-zinc-800/80 leading-relaxed font-sans">
                  {continuity.summary}
                </p>
              )}
            </div>

            {/* Cross-Panel Subsystem Continuities (Scene, Action, Focus) */}
            <div className="grid grid-cols-1 gap-2">
              {/* Scene Continuity */}
              {continuity.scene_continuity && (
                <div className="p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-zinc-400" />
                      <span className="font-semibold text-zinc-200 text-xs">Scene Continuity</span>
                    </div>
                    <Badge
                      variant={continuity.scene_continuity.status === 'SCENE_CONTINUES' ? 'success' : 'neutral'}
                      size="sm"
                    >
                      {continuity.scene_continuity.status}
                    </Badge>
                  </div>
                  {continuity.scene_continuity.evidence && continuity.scene_continuity.evidence.length > 0 && (
                    <ul className="list-disc list-inside text-[10px] text-zinc-400 pl-1 mt-0.5 space-y-0.5">
                      {continuity.scene_continuity.evidence.map((ev, i) => (
                        <li key={i}>{ev}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Action Continuity */}
              {continuity.action_continuity && (
                <div className="p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Swords className="w-3.5 h-3.5 text-rose-400" />
                      <span className="font-semibold text-zinc-200 text-xs">Action Continuity</span>
                    </div>
                    <Badge
                      variant={continuity.action_continuity.status === 'ACTION_RESULT' ? 'warning' : 'info'}
                      size="sm"
                    >
                      {continuity.action_continuity.status}
                    </Badge>
                  </div>
                  {(continuity.action_continuity.source_action_id || continuity.action_continuity.target_action_id) && (
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
                      <span>{continuity.action_continuity.source_action_id || '—'}</span>
                      <ArrowRight className="w-3 h-3 text-zinc-500" />
                      <span className="text-rose-300 font-semibold">{continuity.action_continuity.target_action_id || '—'}</span>
                    </div>
                  )}
                  {continuity.action_continuity.evidence && continuity.action_continuity.evidence.length > 0 && (
                    <ul className="list-disc list-inside text-[10px] text-zinc-400 pl-1 mt-0.5 space-y-0.5">
                      {continuity.action_continuity.evidence.map((ev, i) => (
                        <li key={i}>{ev}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Focus Continuity */}
              {continuity.focus_continuity && (
                <div className="p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-semibold text-zinc-200 text-xs">Focus Continuity</span>
                    </div>
                    <Badge variant="purple" size="sm">
                      {continuity.focus_continuity.status}
                    </Badge>
                  </div>
                  {continuity.focus_continuity.shift_description && (
                    <p className="text-[10px] text-zinc-300 leading-normal mt-0.5">
                      {continuity.focus_continuity.shift_description}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Explicit Cross-Panel Entity Relationships */}
            {continuity.relationships && continuity.relationships.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-zinc-300 text-[11px] uppercase tracking-wide">
                    Cross-Panel Relationships ({continuity.relationships.length})
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {continuity.relationships.map((rel, idx) => (
                    <div
                      key={rel.relationship_id || idx}
                      className="p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700 flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span className="text-zinc-400">{rel.source_entity_ref}</span>
                          <ArrowRight className="w-3 h-3 text-fuchsia-400" />
                          <span className="text-fuchsia-300 font-bold">{rel.target_entity_ref}</span>
                        </div>
                        <Badge variant="purple" size="sm">
                          {rel.relationship_type}
                        </Badge>
                      </div>

                      {rel.description && (
                        <div className="text-[11px] text-zinc-200">
                          {rel.description}
                        </div>
                      )}

                      {rel.evidence && rel.evidence.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {rel.evidence.map((ev, i) => (
                            <span
                              key={i}
                              className="text-[9px] bg-zinc-900/90 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-800"
                            >
                              {ev}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Visual State Changes */}
            {continuity.state_changes && continuity.state_changes.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="font-bold text-zinc-300 text-[11px] uppercase tracking-wide">
                  State Changes ({continuity.state_changes.length})
                </span>
                <div className="flex flex-col gap-1.5">
                  {continuity.state_changes.map((sc, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-zinc-800/40 border border-zinc-700/80 flex items-start gap-2 text-[11px]"
                    >
                      <Badge variant="neutral" size="sm" className="font-mono text-[9px] shrink-0">
                        {sc.change_type}
                      </Badge>
                      <div className="flex-1 flex flex-col gap-0.5">
                        <span className="text-zinc-300">{sc.description}</span>
                        {sc.subject_ref && (
                          <span className="text-[9px] font-mono text-zinc-500">Ref: {sc.subject_ref}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-zinc-800/40 border border-dashed border-zinc-700 text-center flex flex-col items-center gap-2">
            <GitMerge className="w-6 h-6 text-zinc-600" />
            <p className="text-xs text-zinc-400">
              Cross-panel character continuity, object persistence, action continuation, and scene transitions have not been analyzed yet.
            </p>
          </div>
        )}

        {/* Error Feedback */}
        {continuityError && (
          <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Continuity Analysis Failed</p>
              <p className="text-[11px] text-rose-300/90">{continuityError}</p>
            </div>
          </div>
        )}

        {/* Analysis Action Controls */}
        <div className="flex items-center gap-2 pt-1 border-t border-zinc-800">
          <Button
            variant="primary"
            size="sm"
            className="flex-1 text-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white"
            onClick={() => handleAnalyzeContinuity(Boolean(continuity))}
            disabled={isAnalyzingContinuity || !sourceImage}
          >
            {isAnalyzingContinuity ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Analyzing Visual Continuity...
              </>
            ) : continuity ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Re-Analyze Continuity
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Analyze Visual Continuity
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Health & Pipeline Status */}
      <Card variant="default" padding="md" className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-zinc-300" />
            <h3 className="font-bold text-zinc-100 text-sm">Integrity & AI Status</h3>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {/* Asset Verification */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700">
            <span className="text-zinc-300 font-medium">Asset Verification</span>
            {isAssetValid ? (
              <Badge variant="success" size="sm">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Binary Verified
              </Badge>
            ) : assetInspection?.status === 'missing_binary' ? (
              <Badge variant="warning" size="sm">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Missing Binary
              </Badge>
            ) : (
              <Badge variant="error" size="sm">
                <AlertCircle className="w-3 h-3 mr-1" />
                Invalid Asset
              </Badge>
            )}
          </div>

          {/* Visual Analysis Status (Part 2.1) */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700">
            <div className="flex flex-col">
              <span className="text-zinc-300 font-medium">Visual Analysis</span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {('analysis_version' in (panel.visual_analysis || {}))
                  ? `v${(panel.visual_analysis as any).analysis_version || '1.0.0'}`
                  : 'Engine Contract v1.0.0'}
              </span>
            </div>
            {(() => {
              const va = panel.visual_analysis as any;
              const status = va?.status || 'NOT_ANALYZED';
              switch (status) {
                case 'COMPLETED':
                  return (
                    <Badge variant="success" size="sm">
                      <CheckCircle2 className="w-3 h-3 mr-0.5" />
                      Completed
                    </Badge>
                  );
                case 'ANALYZING':
                  return (
                    <Badge variant="info" size="sm" className="animate-pulse">
                      <Sparkles className="w-3 h-3 mr-0.5" />
                      Analyzing
                    </Badge>
                  );
                case 'QUEUED':
                  return (
                    <Badge variant="purple" size="sm">
                      Queued
                    </Badge>
                  );
                case 'FAILED':
                  return (
                    <Badge variant="error" size="sm">
                      <AlertCircle className="w-3 h-3 mr-0.5" />
                      Failed
                    </Badge>
                  );
                case 'STALE':
                  return (
                    <Badge variant="warning" size="sm">
                      <AlertTriangle className="w-3 h-3 mr-0.5" />
                      Stale
                    </Badge>
                  );
                case 'NOT_ANALYZED':
                default:
                  return (
                    <Badge variant="neutral" size="sm" className="font-medium">
                      Not analyzed
                    </Badge>
                  );
              }
            })()}
          </div>

          {/* Subjects & Character Detection Status (Part 2.4) */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700">
            <span className="text-zinc-300 font-medium">Subjects & Characters</span>
            {(() => {
              switch (subjectsStageStatus) {
                case 'COMPLETED':
                  return (
                    <Badge variant="success" size="sm">
                      <CheckCircle2 className="w-3 h-3 mr-0.5" />
                      Detected ({subjects?.length || 0})
                    </Badge>
                  );
                case 'ANALYZING':
                  return (
                    <Badge variant="info" size="sm" className="animate-pulse">
                      <Sparkles className="w-3 h-3 mr-0.5" />
                      Detecting
                    </Badge>
                  );
                case 'FAILED':
                  return (
                    <Badge variant="error" size="sm">
                      <AlertCircle className="w-3 h-3 mr-0.5" />
                      Failed
                    </Badge>
                  );
                case 'NOT_ANALYZED':
                default:
                  return (
                    <Badge variant="neutral" size="sm" className="font-medium">
                      Not analyzed
                    </Badge>
                  );
              }
            })()}
          </div>

          {/* Text, Dialogue & OCR Status (Part 2.5) */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700">
            <span className="text-zinc-300 font-medium">Speech & Dialogue (OCR)</span>
            {(() => {
              switch (textStageStatus) {
                case 'COMPLETED':
                  return (
                    <Badge variant="success" size="sm">
                      <CheckCircle2 className="w-3 h-3 mr-0.5" />
                      Extracted ({textElements?.length || 0})
                    </Badge>
                  );
                case 'ANALYZING':
                  return (
                    <Badge variant="info" size="sm" className="animate-pulse">
                      <Sparkles className="w-3 h-3 mr-0.5" />
                      Extracting
                    </Badge>
                  );
                case 'FAILED':
                  return (
                    <Badge variant="error" size="sm">
                      <AlertCircle className="w-3 h-3 mr-0.5" />
                      Failed
                    </Badge>
                  );
                case 'NOT_ANALYZED':
                default:
                  return (
                    <Badge variant="neutral" size="sm" className="font-medium">
                      Not analyzed
                    </Badge>
                  );
              }
            })()}
          </div>

          {/* Scene & Environment Context Status (Part 2.6) */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700">
            <span className="text-zinc-300 font-medium">Scene & Environment</span>
            {(() => {
              switch (sceneStageStatus) {
                case 'COMPLETED':
                  return (
                    <Badge variant="success" size="sm">
                      <CheckCircle2 className="w-3 h-3 mr-0.5" />
                      {scene?.indoor_outdoor || 'Detected'}
                    </Badge>
                  );
                case 'ANALYZING':
                  return (
                    <Badge variant="info" size="sm" className="animate-pulse">
                      <Sparkles className="w-3 h-3 mr-0.5" />
                      Analyzing
                    </Badge>
                  );
                case 'FAILED':
                  return (
                    <Badge variant="error" size="sm">
                      <AlertCircle className="w-3 h-3 mr-0.5" />
                      Failed
                    </Badge>
                  );
                case 'NOT_ANALYZED':
                default:
                  return (
                    <Badge variant="neutral" size="sm" className="font-medium">
                      Not analyzed
                    </Badge>
                  );
              }
            })()}
          </div>

          {/* Physical Actions Status (Part 2.6) */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700">
            <span className="text-zinc-300 font-medium">Physical Actions</span>
            {(() => {
              switch (actionStageStatus) {
                case 'COMPLETED':
                  return (
                    <Badge variant="success" size="sm">
                      <CheckCircle2 className="w-3 h-3 mr-0.5" />
                      Observed ({actions.length})
                    </Badge>
                  );
                case 'ANALYZING':
                  return (
                    <Badge variant="info" size="sm" className="animate-pulse">
                      <Sparkles className="w-3 h-3 mr-0.5" />
                      Analyzing
                    </Badge>
                  );
                case 'FAILED':
                  return (
                    <Badge variant="error" size="sm">
                      <AlertCircle className="w-3 h-3 mr-0.5" />
                      Failed
                    </Badge>
                  );
                case 'NOT_ANALYZED':
                default:
                  return (
                    <Badge variant="neutral" size="sm" className="font-medium">
                      Not analyzed
                    </Badge>
                  );
              }
            })()}
          </div>

          {/* Visual Salience & Focus Status (Part 2.7) */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700">
            <span className="text-zinc-300 font-medium">Visual Focus & Salience</span>
            {(() => {
              switch (focusStageStatus) {
                case 'COMPLETED':
                  return (
                    <Badge variant="success" size="sm">
                      <CheckCircle2 className="w-3 h-3 mr-0.5" />
                      {visualFocus?.primary_target?.type ? `${visualFocus.primary_target.type} focus` : 'Identified'}
                    </Badge>
                  );
                case 'ANALYZING':
                  return (
                    <Badge variant="info" size="sm" className="animate-pulse">
                      <Sparkles className="w-3 h-3 mr-0.5" />
                      Analyzing
                    </Badge>
                  );
                case 'FAILED':
                  return (
                    <Badge variant="error" size="sm">
                      <AlertCircle className="w-3 h-3 mr-0.5" />
                      Failed
                    </Badge>
                  );
                case 'NOT_ANALYZED':
                default:
                  return (
                    <Badge variant="neutral" size="sm" className="font-medium">
                      Not analyzed
                    </Badge>
                  );
              }
            })()}
          </div>

          {/* Descriptive Camera Regions Status (Part 2.7) */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700">
            <span className="text-zinc-300 font-medium">Descriptive Camera Regions</span>
            {(() => {
              switch (cameraStageStatus) {
                case 'COMPLETED':
                  return (
                    <Badge variant="success" size="sm">
                      <CheckCircle2 className="w-3 h-3 mr-0.5" />
                      {cameraAnalysis?.safe_regions ? `${cameraAnalysis.safe_regions.length} Safe Regions` : 'Defined'}
                    </Badge>
                  );
                case 'ANALYZING':
                  return (
                    <Badge variant="info" size="sm" className="animate-pulse">
                      <Sparkles className="w-3 h-3 mr-0.5" />
                      Analyzing
                    </Badge>
                  );
                case 'FAILED':
                  return (
                    <Badge variant="error" size="sm">
                      <AlertCircle className="w-3 h-3 mr-0.5" />
                      Failed
                    </Badge>
                  );
                case 'NOT_ANALYZED':
                default:
                  return (
                    <Badge variant="neutral" size="sm" className="font-medium">
                      Not analyzed
                    </Badge>
                  );
              }
            })()}
          </div>

          {/* Visual Continuity & Relationships Status (Part 2.8) */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700">
            <span className="text-zinc-300 font-medium">Visual Continuity</span>
            {(() => {
              switch (continuityStageStatus) {
                case 'COMPLETED':
                  return (
                    <Badge variant="purple" size="sm">
                      <CheckCircle2 className="w-3 h-3 mr-0.5" />
                      {continuity?.relationships ? `${continuity.relationships.length} Links` : 'Tracked'}
                    </Badge>
                  );
                case 'ANALYZING':
                  return (
                    <Badge variant="info" size="sm" className="animate-pulse">
                      <Sparkles className="w-3 h-3 mr-0.5" />
                      Analyzing
                    </Badge>
                  );
                case 'FAILED':
                  return (
                    <Badge variant="error" size="sm">
                      <AlertCircle className="w-3 h-3 mr-0.5" />
                      Failed
                    </Badge>
                  );
                case 'NOT_ANALYZED':
                default:
                  return (
                    <Badge variant="neutral" size="sm" className="font-medium">
                      Not analyzed
                    </Badge>
                  );
              }
            })()}
          </div>
        </div>
      </Card>
    </div>
  );
};
