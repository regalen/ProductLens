export function validatePassword(pw: string): string | null {
  if (!pw || pw.length < 8) return "Password must be at least 8 characters";
  return null;
}

export function validateRole(role: string): boolean {
  return ["user", "pipeline_editor", "admin"].includes(role);
}

export function validateWorkflowName(name: string): string | null {
  if (!name || name.trim().length === 0) return "Name is required";
  if (name.length > 200) return "Name too long";
  return null;
}

export const PIPELINE_DESCRIPTION_MAX = 500;

export function validatePipelineDescription(desc: unknown): string | null {
  if (desc === undefined || desc === null || desc === "") return null;
  if (typeof desc !== "string") return "Description must be a string";
  if (desc.length > PIPELINE_DESCRIPTION_MAX)
    return `Description must be ${PIPELINE_DESCRIPTION_MAX} characters or fewer`;
  return null;
}

export const SUPPORTED_COUNTRIES = ["AU", "NZ"] as const;
export type CountryCode = (typeof SUPPORTED_COUNTRIES)[number];

export function validateCountryCode(c: unknown): c is CountryCode {
  return typeof c === "string" && (SUPPORTED_COUNTRIES as readonly string[]).includes(c);
}

export const SUPPORTED_REPORT_TYPES = ["data_missing_webvisible"] as const;
export type ReportType = (typeof SUPPORTED_REPORT_TYPES)[number];

export function validateReportType(t: unknown): t is ReportType {
  return typeof t === "string" && (SUPPORTED_REPORT_TYPES as readonly string[]).includes(t);
}

export function validatePipelineSteps(steps: unknown): string | null {
  if (!Array.isArray(steps) || steps.length === 0)
    return "At least one step is required";
  const validTypes = [
    "resize_canvas",
    "crop_content",
    "convert",
    "scale_image",
    "rename",
  ];
  for (const step of steps) {
    if (
      !step ||
      typeof step !== "object" ||
      !("type" in step) ||
      !validTypes.includes((step as any).type)
    )
      return `Invalid step type`;
  }
  return null;
}
