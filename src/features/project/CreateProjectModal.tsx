import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useProjectStore } from '../../stores/project.store';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose }) => {
  const { createProject, isLoading } = useProjectStore();
  const [title, setTitle] = useState('');
  const [seriesName, setSeriesName] = useState('');
  const [chapterNumber, setChapterNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Project title is required.');
      return;
    }

    try {
      setError(null);
      await createProject({
        title: title.trim(),
        series_name: seriesName.trim() || undefined,
        chapter_number: chapterNumber ? parseInt(chapterNumber, 10) : undefined,
      });
      setTitle('');
      setSeriesName('');
      setChapterNumber('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize project');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Manhwa Project"
      description="Initialize a new project container with canonical Schema v1.0.0."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Project Title *"
          placeholder="e.g. Solo Leveling - Episode 01 Breakdown"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={error || undefined}
          autoFocus
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Series Name (Optional)"
            placeholder="e.g. Solo Leveling"
            value={seriesName}
            onChange={(e) => setSeriesName(e.target.value)}
          />

          <Input
            label="Chapter / Episode (Optional)"
            placeholder="e.g. 1"
            type="number"
            min="0"
            value={chapterNumber}
            onChange={(e) => setChapterNumber(e.target.value)}
          />
        </div>

        <div className="bg-zinc-800/80 border border-zinc-700 rounded-lg p-3 text-xs text-zinc-300">
          <p className="font-medium text-zinc-100 mb-1">Architecture Note:</p>
          <p>
            Creates an isolated schema document in IndexedDB with separate binary blob stores for raw image preservation.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 mt-2">
          <Button variant="outline" type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={isLoading}>
            Create Project
          </Button>
        </div>
      </form>
    </Modal>
  );
};
