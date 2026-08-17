/**
 * Web Worker Infrastructure Stub
 * Reserved for heavy off-thread image processing / tensor workloads in future parts
 */
export interface WorkerTaskPayload<T = unknown> {
  taskId: string;
  type: string;
  payload: T;
}

export interface WorkerTaskResult<R = unknown> {
  taskId: string;
  success: boolean;
  result?: R;
  error?: string;
}
