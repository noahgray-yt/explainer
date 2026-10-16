import type { SourceKind } from "../../shared/schema";

export interface IngestResult {
  kind: SourceKind;
  /** Short name for the UI, e.g. "owner/repo" */
  label: string;
  /** Prepared content for the model */
  text: string;
  truncated: boolean;
  /** Number of files read (repo/folder) */
  fileCount?: number;
}
