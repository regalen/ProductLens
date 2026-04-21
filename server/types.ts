export interface UserRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  role: string;
  must_change_password: number;
  created_at: string;
  last_login_at: string | null;
  workflows_created_total: number;
  images_processed_total: number;
}

export interface WorkflowRow {
  id: string;
  name: string;
  status: string;
  user_id: string;
  pipeline_id: string | null;
  steps: string | null;
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
  preview_width: number | null;
  preview_height: number | null;
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
  description: string | null;
  created_at: string;
}

export interface ReportFileRow {
  id: string;
  report_type: string;
  country: string;
  slot: "current" | "previous";
  original_filename: string;
  original_path: string;
  cleansed_path: string | null;
  uploaded_by: string;
  uploaded_at: string;
  row_count: number | null;
}
