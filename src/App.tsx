import { useEffect, useState } from 'react';
import { useProjectStore } from './stores/project.store';
import { AppShell } from './components/layout/AppShell';
import { ProjectDashboard } from './features/project/ProjectDashboard';
import { ImportWorkspace } from './features/import/ImportWorkspace';
import { InspectionWorkspace } from './features/review/InspectionWorkspace';
import { ValidationWorkspace } from './features/validation/ValidationWorkspace';
import { ProjectSettingsModal } from './features/project/ProjectSettingsModal';
import { CreateProjectModal } from './features/project/CreateProjectModal';
import { Card } from './components/ui/Card';
import { Button } from './components/ui/Button';
import { Badge } from './components/ui/Badge';
import {
  Layers,
  Plus,
  Database,
  Shield,
  Move,
  UploadCloud,
  LayoutDashboard,
  Image as ImageIcon,
  ShieldCheck,
} from 'lucide-react';
import * as storage from './services/storage/indexeddb';

export default function App() {
  const { currentProject, createProject, loadProject, refreshProjectList } =
    useProjectStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'import' | 'panels' | 'validation'>('dashboard');
  const [selectedPanelForInspection, setSelectedPanelForInspection] = useState<string | null>(null);

  const handleNavigateToPanel = (panelId: string) => {
    setSelectedPanelForInspection(panelId);
    setActiveTab('panels');
  };

  // Initialize store and database on first mount
  useEffect(() => {
    async function init() {
      try {
        await storage.getDatabase();
        await refreshProjectList();

        const list = await storage.listProjects();
        if (list.length > 0) {
          await loadProject(list[0].id);
        } else {
          // Create initial sample project container adhering to canonical schema v1.0.0
          await createProject({
            title: 'Manhwa Project Alpha',
            series_name: 'Solo Leveling',
            chapter_number: 1,
          });
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setIsInitializing(false);
      }
    }
    init();
  }, [createProject, loadProject, refreshProjectList]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 text-zinc-100">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-10 h-10 rounded-xl bg-zinc-850 border border-zinc-700 flex items-center justify-center text-indigo-400 animate-pulse shadow-xs">
            <Layers className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-semibold text-zinc-100">Initializing Manhwa Panel Analyzer</h2>
          <p className="text-xs text-zinc-400">Preparing IndexedDB schema stores and local database...</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      {currentProject ? (
        <div className="flex flex-col gap-6 w-full">
          {/* Workspace Navigation Bar */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-1">
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all min-h-[44px] cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/80 shadow-xs font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 border border-transparent'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 text-indigo-400" />
                <span>Overview & Health</span>
              </button>

              <button
                onClick={() => setActiveTab('import')}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all min-h-[44px] cursor-pointer ${
                  activeTab === 'import'
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/80 shadow-xs font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 border border-transparent'
                }`}
              >
                <UploadCloud className="w-4 h-4 text-indigo-400" />
                <span>Image Ingestion</span>
              </button>

              <button
                onClick={() => setActiveTab('panels')}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all min-h-[44px] cursor-pointer ${
                  activeTab === 'panels'
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/80 shadow-xs font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 border border-transparent'
                }`}
              >
                <ImageIcon className="w-4 h-4 text-indigo-400" />
                <span>Panel Inspection & Review</span>
                {currentProject.images.length > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                      activeTab === 'panels'
                        ? 'bg-zinc-700 text-zinc-100'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {currentProject.images.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('validation')}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all min-h-[44px] cursor-pointer ${
                  activeTab === 'validation'
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/80 shadow-xs font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 border border-transparent'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Pre-Analysis Validation Gate</span>
              </button>
            </div>
          </div>

          {/* Tab Views */}
          {activeTab === 'dashboard' && (
            <ProjectDashboard
              onOpenSettings={() => setIsSettingsOpen(true)}
              onNavigateToImport={() => setActiveTab('import')}
              onNavigateToPanels={() => setActiveTab('panels')}
              onNavigateToValidation={() => setActiveTab('validation')}
            />
          )}

          {activeTab === 'import' && (
            <ImportWorkspace onNavigateToPanels={() => setActiveTab('panels')} />
          )}

          {activeTab === 'panels' && (
            <InspectionWorkspace
              onOpenImport={() => setActiveTab('import')}
              initialSelectedPanelId={selectedPanelForInspection}
              onOpenValidation={() => setActiveTab('validation')}
            />
          )}

          {activeTab === 'validation' && (
            <ValidationWorkspace
              onNavigateToPanel={handleNavigateToPanel}
              onNavigateToImport={() => setActiveTab('import')}
            />
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 px-4 max-w-2xl mx-auto text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-900 shadow-md mb-6">
            <Layers className="w-7 h-7" />
          </div>

          <Badge variant="neutral" size="md" className="mb-3">
            Part 1.3 — Sequence & Review Foundation
          </Badge>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-100 tracking-tight">
            Manhwa Panel Analyzer
          </h1>

          <p className="text-sm text-zinc-400 mt-2 mb-8 leading-relaxed">
            A standalone architecture for importing manhwa panel images, ordering sequence arrays,
            calculating 2.5D camera trajectories, and inspecting storyboard pipelines.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full text-left mb-8">
            <Card variant="subtle" padding="sm" className="flex flex-col gap-1 text-xs">
              <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-sky-400" />
                IndexedDB Storage
              </span>
              <span className="text-zinc-400">
                Binary image separation prevents JSON bloat and memory leaks.
              </span>
            </Card>

            <Card variant="subtle" padding="sm" className="flex flex-col gap-1 text-xs">
              <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                Schema v1.0.0
              </span>
              <span className="text-zinc-400">
                Strict Zod validation with forward migration capabilities.
              </span>
            </Card>

            <Card variant="subtle" padding="sm" className="flex flex-col gap-1 text-xs">
              <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5 text-purple-400" />
                Normalized Math
              </span>
              <span className="text-zinc-400">
                0.0 to 1.0 fractional boundaries for responsive camera tracking.
              </span>
            </Card>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="lg"
              onClick={() => setIsCreateOpen(true)}
              leftIcon={<Plus className="w-5 h-5" />}
            >
              Create New Project
            </Button>
          </div>
        </div>
      )}

      {/* Modals */}
      <ProjectSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <CreateProjectModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </AppShell>
  );
}
