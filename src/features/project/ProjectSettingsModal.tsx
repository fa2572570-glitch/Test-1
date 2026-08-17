import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useProjectStore } from '../../stores/project.store';
import { ReadingDirection } from '../../types';

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentProject, updateProjectMetadata, updateProjectSettings } = useProjectStore();

  const [title, setTitle] = useState('');
  const [seriesName, setSeriesName] = useState('');
  const [chapterNumber, setChapterNumber] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [readingDirection, setReadingDirection] = useState<ReadingDirection>('top-to-bottom');
  const [fps, setFps] = useState('30');

  useEffect(() => {
    if (currentProject) {
      setTitle(currentProject.metadata.title || '');
      setSeriesName(currentProject.metadata.series_name || '');
      setChapterNumber(currentProject.metadata.chapter_number?.toString() || '');
      setAuthor(currentProject.metadata.author || '');
      setDescription(currentProject.metadata.description || '');
      setAspectRatio(currentProject.settings.target_aspect_ratio || '9:16');
      setReadingDirection(currentProject.settings.reading_direction || 'top-to-bottom');
      setFps(currentProject.settings.export_target_fps?.toString() || '30');
    }
  }, [currentProject, isOpen]);

  if (!currentProject) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    updateProjectMetadata({
      title: title.trim() || currentProject.metadata.title,
      series_name: seriesName.trim() || undefined,
      chapter_number: chapterNumber ? parseInt(chapterNumber, 10) : undefined,
      author: author.trim() || undefined,
      description: description.trim() || undefined,
    });

    updateProjectSettings({
      target_aspect_ratio: aspectRatio,
      reading_direction: readingDirection,
      export_target_fps: parseInt(fps, 10) || 30,
    });

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Project Settings & Metadata"
      description="Configure canonical settings, aspect ratio, and metadata for downstream export."
      maxWidth="lg"
    >
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Project Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <Input
            label="Author / Creator"
            value={author}
            placeholder="e.g. Chugong, DUBU (REDICE STUDIO)"
            onChange={(e) => setAuthor(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Series Name"
            value={seriesName}
            onChange={(e) => setSeriesName(e.target.value)}
          />

          <Input
            label="Chapter / Episode Number"
            type="number"
            value={chapterNumber}
            onChange={(e) => setChapterNumber(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-zinc-300 tracking-wide">
            Project Description
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3.5 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            placeholder="Brief narrative arc notes or export workflow directives..."
          />
        </div>

        <div className="border-t border-zinc-800 pt-3">
          <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2.5">
            Workflow & Motion Target Settings
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">Target Aspect Ratio</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                <option value="9:16">9:16 (Vertical Shorts/Reels)</option>
                <option value="16:9">16:9 (Cinematic YouTube/Widescreen)</option>
                <option value="1:1">1:1 (Square)</option>
                <option value="4:5">4:5 (Portrait Feed)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">Reading Direction</label>
              <select
                value={readingDirection}
                onChange={(e) => setReadingDirection(e.target.value as ReadingDirection)}
                className="px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                <option value="top-to-bottom">Top-to-Bottom (Webtoon/Manhwa)</option>
                <option value="right-to-left">Right-to-Left (Manga)</option>
                <option value="left-to-right">Left-to-Right (Western Comic)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">Target Motion FPS</label>
              <select
                value={fps}
                onChange={(e) => setFps(e.target.value)}
                className="px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                <option value="24">24 FPS (Cinematic Film)</option>
                <option value="30">30 FPS (Standard Digital Video)</option>
                <option value="60">60 FPS (Ultra Fluid Motion)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            Apply Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
