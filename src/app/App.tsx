import React, { useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { ProjectDashboard } from '../features/project/ProjectDashboard';
import { CreateProjectModal } from '../features/project/CreateProjectModal';
import { ProjectListModal } from '../features/project/ProjectListModal';
import { ProjectSettingsModal } from '../features/project/ProjectSettingsModal';

export function App() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isListOpen, setIsListOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <AppShell>
      <ProjectDashboard
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenCreate={() => setIsCreateOpen(true)}
        onOpenList={() => setIsListOpen(true)}
      />

      <CreateProjectModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
      <ProjectListModal
        isOpen={isListOpen}
        onClose={() => setIsListOpen(false)}
        onOpenCreate={() => setIsCreateOpen(true)}
      />
      <ProjectSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </AppShell>
  );
}

export default App;
