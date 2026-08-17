import { create } from 'zustand';
import { Project, ProjectMetadata, ProjectSettings, SourceImage, Panel } from '../types';
import { createDefaultProject } from '../data/defaults/project.default';
import { validateProject } from '../data/schemas';
import * as storage from '../services/storage/indexeddb';
import {
  movePanelUp,
  movePanelDown,
  movePanelToFirst,
  movePanelToLast,
  movePanelToPosition as serviceMoveToPosition,
  reversePanelOrder as serviceReverseOrder,
  resetPanelOrderToImport as serviceResetToImport,
  normalizePanelSequence,
} from '../features/panels/sequence-manager.service';

export interface ProjectState {
  // Current active project
  currentProject: Project | null;
  
  // State flags
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  lastSavedAt: string | null;
  error: string | null;
  
  // Available project list cache for quick switching
  projectList: ProjectMetadata[];

  // Core Actions
  createProject: (options?: { title?: string; series_name?: string; chapter_number?: number }) => Promise<Project>;
  loadProject: (projectId: string) => Promise<boolean>;
  setProject: (project: Project) => void;
  updateProjectMetadata: (metadataUpdates: Partial<ProjectMetadata>) => void;
  updateProjectSettings: (settingsUpdates: Partial<ProjectSettings>) => void;
  addImportedImagesAndPanels: (newImages: SourceImage[], newPanels: Panel[]) => Promise<boolean>;
  deleteImageAndLinkedPanels: (imageId: string) => Promise<boolean>;
  
  // Sequence & Ordering Actions
  reorderPanels: (newOrderedPanels: Panel[]) => Promise<boolean>;
  movePanel: (panelId: string, direction: 'up' | 'down' | 'first' | 'last') => Promise<boolean>;
  movePanelToPosition: (panelId: string, targetIndex: number) => Promise<boolean>;
  reversePanels: () => Promise<boolean>;
  resetPanelsToImport: () => Promise<boolean>;

  // Panel Analysis & Preprocessing Updates (Part 2.2)
  updatePanelPreprocessing: (panelId: string, preprocessingInfo: import('../types').PreprocessingInfo) => Promise<boolean>;
  updatePanelVisualAnalysis: (panelId: string, visualAnalysis: Partial<import('../types').VisualAnalysis>) => Promise<boolean>;

  saveCurrentProject: () => Promise<boolean>;
  deleteProject: (projectId: string) => Promise<boolean>;
  refreshProjectList: () => Promise<void>;
  resetProject: () => void;
  clearError: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  isLoading: false,
  isSaving: false,
  isDirty: false,
  lastSavedAt: null,
  error: null,
  projectList: [],

  createProject: async (options) => {
    set({ isLoading: true, error: null });
    try {
      const newProject = createDefaultProject({
        title: options?.title,
        metadata: {
          series_name: options?.series_name,
          chapter_number: options?.chapter_number,
        },
      });

      // Validate schema
      const validation = validateProject(newProject);
      if (!validation.valid) {
        throw new Error(`Schema validation failed on creation: ${validation.errorSummary}`);
      }

      // Persist to IndexedDB
      await storage.saveProject(newProject);

      // Refresh list
      const list = await storage.listProjects();

      set({
        currentProject: newProject,
        isLoading: false,
        isDirty: false,
        lastSavedAt: new Date().toISOString(),
        projectList: list,
      });

      return newProject;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create new project';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  loadProject: async (projectId: string) => {
    if (!projectId) return false;
    set({ isLoading: true, error: null });
    try {
      const project = await storage.getProject(projectId);
      if (!project) {
        set({ error: `Project with ID ${projectId} not found`, isLoading: false });
        return false;
      }

      const list = await storage.listProjects();
      set({
        currentProject: project,
        isLoading: false,
        isDirty: false,
        lastSavedAt: project.metadata.updated_at,
        projectList: list,
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load project';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  setProject: (project: Project) => {
    const validation = validateProject(project);
    if (!validation.valid) {
      set({ error: `Cannot set invalid project: ${validation.errorSummary}` });
      return;
    }
    set({
      currentProject: validation.data || project,
      isDirty: true,
      error: null,
    });
  },

  updateProjectMetadata: (metadataUpdates: Partial<ProjectMetadata>) => {
    const { currentProject } = get();
    if (!currentProject) return;

    const now = new Date().toISOString();
    const updatedProject: Project = {
      ...currentProject,
      metadata: {
        ...currentProject.metadata,
        ...metadataUpdates,
        updated_at: now,
      },
    };

    set({
      currentProject: updatedProject,
      isDirty: true,
    });
  },

  updateProjectSettings: (settingsUpdates: Partial<ProjectSettings>) => {
    const { currentProject } = get();
    if (!currentProject) return;

    const now = new Date().toISOString();
    const updatedProject: Project = {
      ...currentProject,
      settings: {
        ...currentProject.settings,
        ...settingsUpdates,
      },
      metadata: {
        ...currentProject.metadata,
        updated_at: now,
      },
    };

    set({
      currentProject: updatedProject,
      isDirty: true,
    });
  },

  addImportedImagesAndPanels: async (newImages: SourceImage[], newPanels: Panel[]) => {
    const { currentProject } = get();
    if (!currentProject) return false;

    const now = new Date().toISOString();
    const updatedProject: Project = {
      ...currentProject,
      images: [...currentProject.images, ...newImages],
      panels: [...currentProject.panels, ...newPanels],
      metadata: {
        ...currentProject.metadata,
        updated_at: now,
      },
    };

    // Validate schema
    const validation = validateProject(updatedProject);
    if (!validation.valid) {
      set({ error: `Validation failed after import: ${validation.errorSummary}` });
      return false;
    }

    // Persist immediately to IndexedDB
    try {
      await storage.saveProject(updatedProject);
      const list = await storage.listProjects();

      set({
        currentProject: updatedProject,
        isDirty: false,
        lastSavedAt: now,
        projectList: list,
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to persist imported images';
      set({ error: message });
      return false;
    }
  },

  deleteImageAndLinkedPanels: async (imageId: string) => {
    const { currentProject } = get();
    if (!currentProject) return false;

    const now = new Date().toISOString();
    const updatedImages = currentProject.images.filter((img) => img.image_id !== imageId);
    const updatedPanels = currentProject.panels.filter((pnl) => pnl.image_id !== imageId);

    // Re-index remaining images source_order and panels order
    const reorderedImages = updatedImages.map((img, idx) => ({
      ...img,
      source_order: idx,
    }));
    const reorderedPanels = updatedPanels.map((pnl, idx) => ({
      ...pnl,
      order: idx,
    }));

    const updatedProject: Project = {
      ...currentProject,
      images: reorderedImages,
      panels: reorderedPanels,
      metadata: {
        ...currentProject.metadata,
        updated_at: now,
      },
    };

    try {
      // Delete image binary blob from IndexedDB
      await storage.deleteImageBlob(imageId);
      // Persist updated project document
      await storage.saveProject(updatedProject);
      const list = await storage.listProjects();

      set({
        currentProject: updatedProject,
        isDirty: false,
        lastSavedAt: now,
        projectList: list,
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete image';
      set({ error: message });
      return false;
    }
  },

  reorderPanels: async (newOrderedPanels: Panel[]) => {
    const { currentProject } = get();
    if (!currentProject) return false;

    const normalized = normalizePanelSequence(newOrderedPanels);
    const now = new Date().toISOString();

    const updatedProject: Project = {
      ...currentProject,
      panels: normalized,
      metadata: {
        ...currentProject.metadata,
        updated_at: now,
      },
    };

    // Validate
    const validation = validateProject(updatedProject);
    if (!validation.valid) {
      set({ error: `Reorder validation failed: ${validation.errorSummary}` });
      return false;
    }

    try {
      await storage.saveProject(updatedProject);
      const list = await storage.listProjects();

      set({
        currentProject: updatedProject,
        isDirty: false,
        lastSavedAt: now,
        projectList: list,
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save reordered panels';
      set({ error: message });
      return false;
    }
  },

  movePanel: async (panelId: string, direction: 'up' | 'down' | 'first' | 'last') => {
    const { currentProject, reorderPanels } = get();
    if (!currentProject) return false;

    let updatedPanels: Panel[];
    switch (direction) {
      case 'up':
        updatedPanels = movePanelUp(currentProject.panels, panelId);
        break;
      case 'down':
        updatedPanels = movePanelDown(currentProject.panels, panelId);
        break;
      case 'first':
        updatedPanels = movePanelToFirst(currentProject.panels, panelId);
        break;
      case 'last':
        updatedPanels = movePanelToLast(currentProject.panels, panelId);
        break;
    }

    return reorderPanels(updatedPanels);
  },

  movePanelToPosition: async (panelId: string, targetIndex: number) => {
    const { currentProject, reorderPanels } = get();
    if (!currentProject) return false;

    const updatedPanels = serviceMoveToPosition(currentProject.panels, panelId, targetIndex);
    return reorderPanels(updatedPanels);
  },

  reversePanels: async () => {
    const { currentProject, reorderPanels } = get();
    if (!currentProject) return false;

    const reversed = serviceReverseOrder(currentProject.panels);
    return reorderPanels(reversed);
  },

  resetPanelsToImport: async () => {
    const { currentProject, reorderPanels } = get();
    if (!currentProject) return false;

    const restored = serviceResetToImport(currentProject.panels, currentProject.images);
    return reorderPanels(restored);
  },

  updatePanelPreprocessing: async (panelId, preprocessingInfo) => {
    const { currentProject } = get();
    if (!currentProject) return false;

    const now = new Date().toISOString();
    const updatedPanels = currentProject.panels.map((p) => {
      if (p.id !== panelId) return p;
      const currentVA = (p.visual_analysis && 'analysis_version' in p.visual_analysis)
        ? p.visual_analysis
        : { analysis_version: '1.0.0' as const, status: 'NOT_ANALYZED' as const };

      return {
        ...p,
        visual_analysis: {
          ...currentVA,
          preprocessing: preprocessingInfo,
          updated_at: now,
        },
        updated_at: now,
      };
    });

    const updatedProject: Project = {
      ...currentProject,
      panels: updatedPanels,
      metadata: {
        ...currentProject.metadata,
        updated_at: now,
      },
    };

    try {
      await storage.saveProject(updatedProject);
      set({
        currentProject: updatedProject,
        isDirty: false,
        lastSavedAt: now,
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update panel preprocessing';
      set({ error: message });
      return false;
    }
  },

  updatePanelVisualAnalysis: async (panelId, updates) => {
    const { currentProject } = get();
    if (!currentProject) return false;

    const now = new Date().toISOString();
    const updatedPanels = currentProject.panels.map((p) => {
      if (p.id !== panelId && p.panel_id !== panelId) return p;
      const currentVA = (p.visual_analysis && 'analysis_version' in p.visual_analysis)
        ? p.visual_analysis
        : { analysis_version: '1.0.0' as const, status: 'NOT_ANALYZED' as const };

      return {
        ...p,
        visual_analysis: {
          ...currentVA,
          ...updates,
          stages: {
            ...currentVA.stages,
            ...updates.stages,
          },
        },
        updated_at: now,
      };
    });

    const updatedProject: Project = {
      ...currentProject,
      panels: updatedPanels,
      metadata: {
        ...currentProject.metadata,
        updated_at: now,
      },
    };

    try {
      await storage.saveProject(updatedProject);
      set({
        currentProject: updatedProject,
        isDirty: false,
        lastSavedAt: now,
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update panel visual analysis';
      set({ error: message });
      return false;
    }
  },

  saveCurrentProject: async () => {
    const { currentProject } = get();
    if (!currentProject) return false;

    set({ isSaving: true, error: null });
    try {
      const now = new Date().toISOString();
      const projectToSave: Project = {
        ...currentProject,
        metadata: {
          ...currentProject.metadata,
          updated_at: now,
        },
      };

      await storage.saveProject(projectToSave);
      const list = await storage.listProjects();

      set({
        currentProject: projectToSave,
        isSaving: false,
        isDirty: false,
        lastSavedAt: now,
        projectList: list,
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save project';
      set({ error: message, isSaving: false });
      return false;
    }
  },

  deleteProject: async (projectId: string) => {
    try {
      await storage.deleteProject(projectId);
      const list = await storage.listProjects();
      const { currentProject } = get();

      if (currentProject?.id === projectId) {
        set({
          currentProject: null,
          isDirty: false,
          lastSavedAt: null,
          projectList: list,
        });
      } else {
        set({ projectList: list });
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete project';
      set({ error: message });
      return false;
    }
  },

  refreshProjectList: async () => {
    try {
      const list = await storage.listProjects();
      set({ projectList: list });
    } catch (err) {
      console.error('Failed to refresh project list', err);
    }
  },

  resetProject: () => {
    set({
      currentProject: null,
      isDirty: false,
      lastSavedAt: null,
      error: null,
    });
  },

  clearError: () => {
    set({ error: null });
  },
}));
