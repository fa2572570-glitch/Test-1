import React from 'react';
import { Layers, FolderOpen, Plus, Settings, CheckCircle2, AlertCircle } from 'lucide-react';
import { useProjectStore } from '../../stores/project.store';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface AppHeaderProps {
  onOpenCreate: () => void;
  onOpenProjectsList: () => void;
  onOpenSettings: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onOpenCreate,
  onOpenProjectsList,
  onOpenSettings,
}) => {
  const { currentProject, isSaving, isDirty, saveCurrentProject } = useProjectStore();

  return (
    <header className="sticky top-0 z-30 w-full bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand & App Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-100 shadow-xs">
            <Layers className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-100 text-base tracking-tight">Manhwa Panel Analyzer</span>
              <Badge variant="neutral" size="sm">
                v1.0.0 Core
              </Badge>
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block">
              Structured story & camera motion extractor for manhwa production
            </p>
          </div>
        </div>

        {/* Active Project Info & Top Controls */}
        <div className="flex items-center gap-2.5">
          {currentProject ? (
            <div className="flex items-center gap-2 mr-2">
              <div className="text-right hidden md:block">
                <p className="text-xs font-semibold text-zinc-200 max-w-[200px] truncate">
                  {currentProject.metadata.title}
                </p>
                <div className="flex items-center justify-end gap-1.5 text-[11px] text-zinc-400">
                  {isDirty ? (
                    <span className="flex items-center gap-1 text-amber-400 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      Unsaved changes
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />
                      Saved
                    </span>
                  )}
                </div>
              </div>

              <Button
                variant={isDirty ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => saveCurrentProject()}
                isLoading={isSaving}
              >
                Save
              </Button>

              <button
                onClick={onOpenSettings}
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                title="Project Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-400 mr-2">
              <AlertCircle className="w-4 h-4 text-zinc-500" />
              <span>No active project loaded</span>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenProjectsList}
            leftIcon={<FolderOpen className="w-4 h-4" />}
          >
            Projects
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={onOpenCreate}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New Project
          </Button>
        </div>
      </div>
    </header>
  );
};
