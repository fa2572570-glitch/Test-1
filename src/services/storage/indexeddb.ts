import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Project, ProjectMetadata, Panel } from '../../types';
import { validateProject } from '../../data/schemas';
import { migrateProject } from '../../data/migrations';

const DB_NAME = 'manhwa_panel_analyzer_db';
const DB_VERSION = 2;

export interface StoredImageBlob {
  image_id: string;
  project_id: string;
  blob: Blob;
  mime_type: string;
  created_at: string;
}

export interface StoredProxyBlob {
  image_id: string;
  cache_key: string;
  blob: Blob;
  mime_type: string;
  width: number;
  height: number;
  scale: number;
  byte_size: number;
  created_at: string;
}

interface ManhwaAnalyzerDBSchema extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: {
      'by-updated': string;
    };
  };
  images: {
    key: string;
    value: StoredImageBlob;
    indexes: {
      'by-project': string;
    };
  };
  panels: {
    key: string;
    value: Panel;
    indexes: {
      'by-image': string;
    };
  };
  analysis_proxies: {
    key: string;
    value: StoredProxyBlob;
    indexes: {
      'by-cache-key': string;
    };
  };
}

let dbInstance: IDBPDatabase<ManhwaAnalyzerDBSchema> | null = null;

/**
 * Initializes and retrieves the IndexedDB database instance.
 */
export async function getDatabase(): Promise<IDBPDatabase<ManhwaAnalyzerDBSchema>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<ManhwaAnalyzerDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create 'projects' store
      if (!db.objectStoreNames.contains('projects')) {
        const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
        projectStore.createIndex('by-updated', 'metadata.updated_at');
      }

      // Create 'images' binary blob store (keeps binary storage separate from project JSON)
      if (!db.objectStoreNames.contains('images')) {
        const imageStore = db.createObjectStore('images', { keyPath: 'image_id' });
        imageStore.createIndex('by-project', 'project_id');
      }

      // Create 'panels' store
      if (!db.objectStoreNames.contains('panels')) {
        const panelStore = db.createObjectStore('panels', { keyPath: 'id' });
        panelStore.createIndex('by-image', 'image_id');
      }

      // Create 'analysis_proxies' derived binary blob store (Part 2.2)
      if (!db.objectStoreNames.contains('analysis_proxies')) {
        const proxyStore = db.createObjectStore('analysis_proxies', { keyPath: 'image_id' });
        proxyStore.createIndex('by-cache-key', 'cache_key');
      }
    },
  });

  return dbInstance;
}

/**
 * Saves or updates a full Project document in IndexedDB after validating schema.
 */
export async function saveProject(project: Project): Promise<void> {
  const validation = validateProject(project);
  if (!validation.valid || !validation.data) {
    throw new Error(`Cannot save invalid project: ${validation.errorSummary}`);
  }

  const db = await getDatabase();
  const tx = db.transaction('projects', 'readwrite');
  await tx.store.put(validation.data);
  await tx.done;
}

/**
 * Retrieves a Project by its stable ID, automatically applying migrations if needed.
 */
export async function getProject(id: string): Promise<Project | null> {
  if (!id) return null;
  const db = await getDatabase();
  const raw = await db.get('projects', id);
  if (!raw) return null;

  // Run through migration & validation pipeline
  const { project, migrated } = migrateProject(raw);
  if (migrated) {
    // Persist migrated format back to storage
    await saveProject(project);
  }

  return project;
}

/**
 * Deletes a Project and associated stored images from IndexedDB.
 */
export async function deleteProject(id: string): Promise<void> {
  if (!id) return;
  const db = await getDatabase();
  
  // Clean up project
  const tx = db.transaction(['projects', 'images', 'analysis_proxies'], 'readwrite');
  await tx.objectStore('projects').delete(id);

  // Clean up any images associated with this project
  const imageIndex = tx.objectStore('images').index('by-project');
  let cursor = await imageIndex.openCursor(id);
  const proxyStore = tx.objectStore('analysis_proxies');
  while (cursor) {
    const imgId = cursor.value.image_id;
    await proxyStore.delete(imgId);
    await cursor.delete();
    cursor = await cursor.continue();
  }

  await tx.done;
}

/**
 * Lists metadata of all saved projects, sorted by most recently updated.
 */
export async function listProjects(): Promise<ProjectMetadata[]> {
  const db = await getDatabase();
  const allProjects = await db.getAll('projects');
  
  return allProjects
    .map((p) => p.metadata)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

/**
 * Saves binary image blob separately from project JSON.
 */
export async function saveImageBlob(
  projectId: string,
  imageId: string,
  blob: Blob,
  mimeType: string
): Promise<void> {
  const db = await getDatabase();
  const record: StoredImageBlob = {
    image_id: imageId,
    project_id: projectId,
    blob,
    mime_type: mimeType,
    created_at: new Date().toISOString(),
  };
  await db.put('images', record);
}

/**
 * Retrieves an image blob by its image_id.
 */
export async function getImageBlob(imageId: string): Promise<Blob | null> {
  if (!imageId) return null;
  const db = await getDatabase();
  const record = await db.get('images', imageId);
  return record ? record.blob : null;
}

/**
 * Deletes an image blob by its image_id.
 */
export async function deleteImageBlob(imageId: string): Promise<void> {
  if (!imageId) return;
  const db = await getDatabase();
  await db.delete('images', imageId);
}

/**
 * Checks storage health and returns summary count statistics.
 */
export async function getStorageStats(): Promise<{
  projectCount: number;
  imageBlobCount: number;
  dbReady: boolean;
}> {
  try {
    const db = await getDatabase();
    const projectCount = await db.count('projects');
    const imageBlobCount = await db.count('images');
    return {
      projectCount,
      imageBlobCount,
      dbReady: true,
    };
  } catch {
    return {
      projectCount: 0,
      imageBlobCount: 0,
      dbReady: false,
    };
  }
}

/**
 * Retrieves all stored image blob keys across the database.
 */
export async function getAllImageBlobKeys(): Promise<string[]> {
  try {
    const db = await getDatabase();
    return await db.getAllKeys('images');
  } catch {
    return [];
  }
}

/**
 * Retrieves all stored image blob records associated with a specific project.
 */
export async function getAllImageBlobsForProject(projectId: string): Promise<StoredImageBlob[]> {
  if (!projectId) return [];
  try {
    const db = await getDatabase();
    const index = db.transaction('images', 'readonly').store.index('by-project');
    return await index.getAll(projectId);
  } catch {
    return [];
  }
}

/**
 * Performs a storage consistency comparison between a Project document and IndexedDB binary blobs.
 */
export async function checkStorageConsistency(project: Project): Promise<{
  totalStoredBlobs: number;
  projectBlobCount: number;
  missingBlobImageIds: string[];
  orphanedBlobImageIds: string[];
  isConsistent: boolean;
}> {
  try {
    const db = await getDatabase();
    const allStoredKeys = new Set(await db.getAllKeys('images'));
    const projectImages = project.images;
    const projectImageIdSet = new Set(projectImages.map((img) => img.image_id));

    // Check which project images are missing blobs
    const missingBlobImageIds: string[] = [];
    for (const img of projectImages) {
      if (!allStoredKeys.has(img.image_id)) {
        missingBlobImageIds.push(img.image_id);
      }
    }

    // Check if there are blobs registered under this project ID that are not in project.images
    const projectStoredBlobs = await getAllImageBlobsForProject(project.id);
    const orphanedBlobImageIds: string[] = [];
    for (const stored of projectStoredBlobs) {
      if (!projectImageIdSet.has(stored.image_id)) {
        orphanedBlobImageIds.push(stored.image_id);
      }
    }

    const isConsistent = missingBlobImageIds.length === 0 && orphanedBlobImageIds.length === 0;

    return {
      totalStoredBlobs: allStoredKeys.size,
      projectBlobCount: projectStoredBlobs.length,
      missingBlobImageIds,
      orphanedBlobImageIds,
      isConsistent,
    };
  } catch {
    return {
      totalStoredBlobs: 0,
      projectBlobCount: 0,
      missingBlobImageIds: project.images.map((i) => i.image_id),
      orphanedBlobImageIds: [],
      isConsistent: false,
    };
  }
}

/**
 * Saves a derived analysis proxy blob to IndexedDB (Part 2.2).
 */
export async function saveProxyBlob(record: StoredProxyBlob): Promise<void> {
  const db = await getDatabase();
  await db.put('analysis_proxies', record);
}

/**
 * Retrieves a stored analysis proxy blob record by image_id (Part 2.2).
 */
export async function getProxyBlob(imageId: string): Promise<StoredProxyBlob | null> {
  if (!imageId) return null;
  const db = await getDatabase();
  const record = await db.get('analysis_proxies', imageId);
  return record || null;
}

/**
 * Deletes a stored analysis proxy blob by image_id (Part 2.2).
 */
export async function deleteProxyBlob(imageId: string): Promise<void> {
  if (!imageId) return;
  const db = await getDatabase();
  await db.delete('analysis_proxies', imageId);
}

/**
 * Retrieves all stored proxy keys across the database.
 */
export async function getAllProxyBlobKeys(): Promise<string[]> {
  try {
    const db = await getDatabase();
    return await db.getAllKeys('analysis_proxies');
  } catch {
    return [];
  }
}

/**
 * Clears all cached analysis proxies across IndexedDB.
 */
export async function clearAllProxies(): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction('analysis_proxies', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

