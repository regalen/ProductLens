export interface UserRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  role: string;
  must_change_password: number;
  created_at: string;
}

export interface WorkflowRow {
  id: string;
  name: string;
  status: string;
  user_id: string;
  pipeline_id: string | null;
  created_at: string;
}

export interface ImageRow {
  id: string;
  workflow_id: string;
  original_url: string | null;
  local_path: string | null;
  preview_path: string | null;
  processed_path: string | null;
  status: string;
  type: string | null;
  width: number | null;
  height: number | null;
  size: number | null;
  selected: number;
  error_message: string | null;
  created_at: string;
}

export interface PipelineRow {
  id: string;
  name: string;
  steps: string;
  user_id: string;
  is_shared: number;
  created_at: string;
}
