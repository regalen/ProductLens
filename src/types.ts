export type PipelineStepType = 'resize_canvas' | 'crop_content' | 'convert' | 'scale_image' | 'rename';

export interface PipelineStep {
  id: string;
  type: PipelineStepType;
  format?: 'png' | 'jpeg' | 'webp' | 'avif';
  quality?: number;
  threshold?: number;
  padding?: number;
  cropMode?: 'content' | 'aspect_ratio' | 'manual';
  aspectRatio?: string;
  manualRect?: { left: number; top: number; width: number; height: number };
}

export type UserRole = 'user' | 'pipeline_editor' | 'admin';

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  mustChangePassword?: boolean;
}

export interface Pipeline {
  id: string;
  name: string;
  steps: PipelineStep[];
  userId: string;
  isShared: boolean;
  createdAt: string;
}

export type WorkflowStatus = 'ingest' | 'configure' | 'preview' | 'processing' | 'completed';

export interface Workflow {
  id: string;
  name: string;
  status: WorkflowStatus;
  userId: string;
  pipelineId?: string;
  pipeline?: Pipeline;
  createdAt: string;
}

export interface WorkflowImage {
  id: string;
  workflowId: string;
  originalUrl?: string;
  localPath?: string;
  previewPath?: string;
  processedPath?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  type?: string;
  width?: number;
  height?: number;
  size?: number;
  selected: boolean;
  errorMessage?: string;
}

export const IMAGE_TYPES = [
  "Main", "Rear", "Front", "Right", "Left", "Top", "Bottom", 
  "Labeled-Images", "In-Package", "Out-of-Package", "Hero-Shot", "Zoom-Closeup",
  ...Array.from({ length: 20 }, (_, i) => `Alternate-Image${i + 1}`)
];
