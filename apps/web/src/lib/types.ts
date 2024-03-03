import type { Ruleset } from '@rulekit/engine';

export interface Session {
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  workspaceId: string;
  workspaceName: string;
}

export interface Project {
  id: string;
  slug: string;
  name: string;
  activeVersion: number | null;
  mode: Ruleset['mode'];
  evaluations24h: number;
  lastPublished: string | null;
}

export interface DraftIssue {
  ruleId: string;
  message: string;
  code: string;
  severity: 'warning' | 'error';
}

export interface Draft {
  ruleset: Ruleset;
  sourceText: string | null;
  issues: DraftIssue[];
}

export interface Version {
  id: string;
  number: number;
  checksum: string;
  note: string | null;
  ruleset: Ruleset;
  createdAt: string;
}
