import React from 'react';
import { Database, ShieldCheck, Cpu } from 'lucide-react';
import { useProjectStore } from '../../stores/project.store';

export const AppFooter: React.FC = () => {
  const { currentProject } = useProjectStore();

  return (
    <footer className="w-full bg-zinc-900/90 border-t border-zinc-800 py-3 px-4 sm:px-6 lg:px-8 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium text-zinc-300">
            <Database className="w-3.5 h-3.5 text-zinc-400" />
            IndexedDB Local Storage: Ready
          </span>
          <span className="flex items-center gap-1.5 text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Schema v1.0.0 Strictly Validated
          </span>
        </div>

        <div className="flex items-center gap-4">
          {currentProject && (
            <span className="flex items-center gap-1 text-zinc-400 font-mono text-[11px]">
              <Cpu className="w-3 h-3 text-zinc-500" />
              ID: {currentProject.id.slice(0, 16)}...
            </span>
          )}
          <span className="text-zinc-500">Foundation Ready for AI Story & Camera Pipeline</span>
        </div>
      </div>
    </footer>
  );
};
