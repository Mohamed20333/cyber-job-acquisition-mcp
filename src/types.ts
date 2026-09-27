export type JobStatus =
  | "DISCOVERED"
  | "QUALIFIED"
  | "READY_TO_APPLY"
  | "APPLIED"
  | "CONTACTED"
  | "REPLIED"
  | "INTERVIEW"
  | "REJECTED"
  | "CLOSED"
  | "FOLLOW_UP";

export interface CandidateProfile {
  name: string;
  education: string;
  targetRoles: string[];
  targetMarkets: string[];
  skills: string[];
  tools: string[];
  experienceNotes: string[];
}

export interface JobOpportunity {
  id: string;
  dedupeKey: string;
  company: string;
  role: string;
  url: string;
  location?: string;
  source: string;
  remote: boolean;
  fitScore?: number;
  matchedSkills: string[];
  status: JobStatus;
  recruiter?: string;
  recruiterUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  name: string;
  company: string;
  role?: string;
  publicUrl?: string;
  source?: string;
  notes?: string;
}

export interface DiscoveryResult {
  opportunities: JobOpportunity[];
  source: string;
  fetchedAt: string;
}
