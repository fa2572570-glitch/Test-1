import React, { useEffect } from 'react';
import { FolderOpen, Trash2, Calendar, Plus, Layers } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useProjectStore } from '../../stores/project.store';

interface ProjectListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCreate: () => void;
}

export const ProjectListModal: React.FC<ProjectListModalProps> = ({
  isOpen,
  onClose,
  onOpenCreate,
}) => {
  const {
    projectList,
    currentProject,
    loadProject,
    deleteProject,
    refreshProjectList,
    isLoading,
  } = useProjectStore();

  useEffect(() => {
    if (isOpen) {
      refreshProjectList();
    }
  }, [isOpen, refreshProjectList]);

  const handleSelect = async (id: string) => {
    const success = await loadProject(id);
    if (success) {
      onClose();
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to permanently delete "${title}"?`)) {
      await deleteProject(id);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Saved Projects"
      description="Manage local manhwa projects saved in IndexedDB."
      maxWidth="lg"
    >
      <div className="flex flex-col gap-3 text-zinc-100">
        {projectList.length === 0 ? (
          <div className="text-center py-10 px-4 border border-dashed border-zinc-700 rounded-xl bg-zinc-800/40">
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400 mb-3">
              <FolderOpen className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-zinc-200">No saved projects found</p>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto mb-4">
              Get started by creating your first manhwa analysis project container.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenCreate}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Create New Project
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1">
            {projectList.map((meta) => {
              const isSelected = currentProject?.id === meta.id;
              const formattedDate = new Date(meta.updated_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={meta.id}
                  onClick={() => handleSelect(meta.id)}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-800 text-white border-zinc-600 shadow-xs'
                      : 'bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{meta.title}</span>
                        {isSelected && (
                          <Badge variant="purple" size="sm">
                            Active
                          </Badge>
                        )}
                      </div>
                      <div
                        className={`flex items-center gap-3 text-xs mt-0.5 ${
                          isSelected ? 'text-zinc-300' : 'text-zinc-400'
                        }`}
                      >
                        {meta.series_name && (
                          <span className="truncate">
                            {meta.series_name}
                            {meta.chapter_number !== undefined ? ` • Ch. ${meta.chapter_number}` : ''}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formattedDate}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => handleDelete(e, meta.id, meta.title)}
                      className={`p-2 rounded-lg transition-colors ${
                        isSelected
                          ? 'text-zinc-400 hover:text-rose-400 hover:bg-zinc-700'
                          : 'text-zinc-400 hover:text-rose-400 hover:bg-zinc-800'
                      }`}
                      title="Delete project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-zinc-800 mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenCreate}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create Another Project
          </Button>

          <Button variant="secondary" size="sm" onClick={onClose} disabled={isLoading}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
