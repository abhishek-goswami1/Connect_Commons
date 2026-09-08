// ── Shared helpers for assignment display ──────────────────────────────────

/** File size limit for reference uploads: 20 MB */
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

/** Allowed MIME types for reference files */
export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
  "application/zip",
  "application/x-zip-compressed",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

export const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".zip", ".png", ".jpg", ".jpeg", ".webp"];

/** Validate a File object — returns error string or null */
export function validateFile(file) {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return `"${file.name}" is not a supported file type. Allowed: PDF, DOCX, PPTX, ZIP, images.`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `"${file.name}" exceeds the 20 MB size limit.`;
  }
  return null;
}

/** Format a date string for display */
export function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Format deadline with relative time hint */
export function formatDeadline(iso) {
  if (!iso) return "No deadline";
  const date = new Date(iso);
  const now  = new Date();
  const diff = date - now; // ms
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  const base = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  if (diff < 0)          return `${base} (overdue)`;
  if (days === 0)        return `${base} (today)`;
  if (days === 1)        return `${base} (tomorrow)`;
  if (days <= 7)         return `${base} (${days}d left)`;
  return base;
}

/** Check if an assignment is overdue based on deadline + status */
export function isOverdue(assignment) {
  if (!assignment.deadline) return false;
  if (["approved", "archived"].includes(assignment.status)) return false;
  return new Date(assignment.deadline) < new Date();
}

/** Priority badge variant mapping */
export const PRIORITY_VARIANT = {
  high:   "danger",
  medium: "warning",
  low:    "secondary",
};

export const PRIORITY_LABEL = {
  high:   "High",
  medium: "Medium",
  low:    "Low",
};

/** Status badge variant mapping */
export const STATUS_VARIANT = {
  in_progress:       "secondary",
  submitted:         "default",
  under_review:      "warning",
  revision_required: "danger",
  approved:          "success",
  overdue:           "danger",
};

export const STATUS_LABEL = {
  in_progress:       "In Progress",
  submitted:         "Submitted",
  under_review:      "Under Review",
  revision_required: "Revision Required",
  approved:          "Approved",
  overdue:           "Overdue",
};

/** Format file size in human-readable form */
export function formatFileSize(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024)              return `${bytes} B`;
  if (bytes < 1024 * 1024)       return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
