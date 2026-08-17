/**
 * Service: Image Ingestion & Processing
 */
export interface ImageService {
  readImageMetadata(file: File): Promise<{ width: number; height: number; mimeType: string }>;
}
