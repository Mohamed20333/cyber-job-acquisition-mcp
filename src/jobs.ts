import type { JobOpportunity } from "./types";

const SOURCES = [
  {
    name: "Remotive",
    url: "https://remotive.com/api/remote-jobs?search=cybersecurity",
  },
  {
    name: "Remote OK",
    url: "https://remoteok.com/api",
  },
  {
    name: "Arbeitnow",
    url: "https://www.arbeitnow.com/api/job-board-api",
  },
];

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function makeId(source: string, url: string): string {
  const raw = `${source}:${url}`;
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 120);
}

function normalizeJob(source: string, raw: Record<string, unknown>): JobOpportunity | null {
  const title = text(raw.title || raw.position || raw.name);
  const company = text(raw.company_name || raw.company || raw.organization);
  const url = text(raw.url || raw.job_url || raw.apply_url || raw.link);

  if (!title || !company || !url) return null;

  const location = text(raw.candidate_required_location || raw.location || raw.locations);
  const description = text(raw.description || raw.job_description || raw.summary);
  const remote = Boolean(
    raw.remote === true ||
    text(raw.job_type).toLowerCase().includes("remote") ||
    location.toLowerCase().includes("remote") ||
    description.toLowerCase().includes("remote"),
  );

  const now = new Date().toISOString();

  return {
    id: makeId(source, url),
    dedupeKey: url.toLowerCase().trim(),
    company,
    role: title,
    url,
    location: location || undefined,
    source,
    remote,
    matchedSkills: [],
    status: "DISCOVERED",
    notes: description.slice(0, 2000),
    createdAt: now,
    updatedAt: now,
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "CyberJobAcquisitionEngine/2.0",
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}`);
  }

  return response.json();
}

export async function discoverJobs(): Promise<JobOpportunity[]> {
  const results: JobOpportunity[] = [];

  for (const source of SOURCES) {
    try {
      const data = await fetchJson(source.url);
      const rows =
        source.name === "Remote OK"
          ? Array.isArray(data) ? data : []
          : source.name === "Remotive"
            ? Array.isArray((data as { jobs?: unknown[] })?.jobs) ? (data as { jobs: unknown[] }).jobs : []
            : Array.isArray((data as { data?: unknown[] })?.data) ? (data as { data: unknown[] }).data : [];

      for (const item of rows) {
        if (item && typeof item === "object") {
          const job = normalizeJob(source.name, item as Record<string, unknown>);
          if (job) results.push(job);
        }
      }
    } catch {
      // One public source failing must not stop discovery from the other sources.
    }
  }

  const unique = new Map<string, JobOpportunity>();
  for (const job of results) unique.set(job.dedupeKey, job);
  return [...unique.values()];
}
