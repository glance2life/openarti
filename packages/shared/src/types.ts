// ---- Read ----
export interface ReadRequest {
  path: string;
  offset?: number;
  limit?: number;
  ref?: string;
}

export interface ReadResponse {
  path: string;
  content: string;
  lines: number;
  commit: string;
}

// ---- Write ----
export interface WriteRequest {
  path: string;
  content: string;
  message?: string;
}

export interface WriteResponse {
  path: string;
  commit: string;
  created: boolean;
}

// ---- Edit ----
export interface EditOp {
  old_string: string;
  new_string: string;
}

export interface EditRequest {
  path: string;
  old_string?: string;
  new_string?: string;
  replace_all?: boolean;
  edits?: EditOp[];
  message?: string;
}

export interface EditResponse {
  path: string;
  commit: string;
  replaced: number;
}

// ---- Ls ----
export interface LsRequest {
  path?: string;
}

export interface LsEntry {
  name: string;
  type: "file" | "dir";
}

export interface LsResponse {
  entries: LsEntry[];
}

// ---- Collection ----
export interface CreateCollectionRequest {
  name: string;
  description?: string;
  visibility?: "private" | "public";
}

export interface CollectionInfo {
  id: string;
  name: string;
  owner: string;
  description: string;
  visibility: "private" | "public";
  created_at: string;
}

export interface SharedCollectionInfo extends CollectionInfo {
  level: "read" | "edit";
}

export interface MyCollectionsResponse {
  own: CollectionInfo[];
  shared: SharedCollectionInfo[];
}

// ---- Rm ----
export interface RmResponse {
  path: string;
  commit: string;
}

// ---- Grep ----
export interface GrepLine {
  line: number;
  text: string;
  match?: boolean;
}

export interface GrepMatch {
  path: string;
  lines: GrepLine[];
}

export interface GrepResponse {
  matches: GrepMatch[];
  total_matches: number;
}

// ---- Glob ----
export interface GlobFile {
  path: string;
}

export interface GlobResponse {
  files: GlobFile[];
}

// ---- Log ----
export interface LogCommit {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
  files: string[];
}

export interface LogResponse {
  commits: LogCommit[];
}

// ---- Diff ----
export interface DiffResponse {
  path: string;
  diff: string;
  stats: { additions: number; deletions: number };
}

// ---- Blame ----
export interface BlameLine {
  line: number;
  text: string;
  author: string;
  commit: string;
  timestamp: string;
}

export interface BlameResponse {
  path: string;
  lines: BlameLine[];
}

// ---- API Error ----
export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
