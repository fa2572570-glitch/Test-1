import React, { useState } from 'react';
import { AppHeader } from './AppHeader';
import { AppFooter } from './AppFooter';
import { CreateProjectModal } from '../../features/project/CreateProjectModal';
import { ProjectListModal } from '../../features/project/ProjectListModal';
import { ProjectSettingsModal } from '../../features/project/ProjectSettingsModal';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isListOpen, setIsListOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans antialiased selection:bg-zinc-800 selection:text-zinc-100">
      <AppHeader
        onOpenCreate={() => setIsCreateOpen(true)}
        onOpenProjectsList={() => setIsListOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col">
        {children}
      </main>

      <AppFooter />

      {/* Modals */}
      <CreateProjectModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <ProjectListModal
        isOpen={isListOpen}
        onClose={() => setIsListOpen(false)}
        onOpenCreate={() => {
          setIsListOpen(false);
          setIsCreateOpen(true);
        }}
      />
      <ProjectSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};
