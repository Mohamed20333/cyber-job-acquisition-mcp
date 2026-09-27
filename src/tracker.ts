import type { JobOpportunity, JobStatus } from "./types";

export interface D1DatabaseLike {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      all<T = unknown>(): Promise<{ results: T[] }>;
      first<T = unknown>(): Promise<T | null>;
    };
  };
}

const memory = new Map<string, JobOpportunity>();

export async function saveOpportunity(
  db: D1DatabaseLike | undefined,
  job: JobOpportunity,
): Promise<JobOpportunity> {
  if (!db) {
    memory.set(job.id, job);
    return job;
  }

  await db.prepare(`
    INSERT INTO opportunities
      (id, dedupe_key, company, role, url, location, source, remote,
       fit_score, matched_skills, status, recruiter, recruiter_url, notes,
       created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      fit_score=excluded.fit_score,
      matched_skills=excluded.matched_skills,
      status=excluded.status,
      recruiter=excluded.recruiter,
      recruiter_url=excluded.recruiter_url,
      notes=excluded.notes,
      updated_at=excluded.updated_at
  `).bind(
    job.id,
    job.dedupeKey,
    job.company,
    job.role,
    job.url,
    job.location ?? null,
    job.source,
    job.remote ? 1 : 0,
    job.fitScore ?? null,
    JSON.stringify(job.matchedSkills),
    job.status,
    job.recruiter ?? null,
    job.recruiterUrl ?? null,
    job.notes ?? null,
    job.createdAt,
    job.updatedAt,
  ).run();

  return job;
}

export async function listOpportunities(
  db: D1DatabaseLike | undefined,
  status?: JobStatus,
): Promise<JobOpportunity[]> {
  if (!db) {
    const values = [...memory.values()];
    return status ? values.filter((x) => x.status === status) : values;
  }

  const query = status
    ? "SELECT * FROM opportunities WHERE status = ? ORDER BY updated_at DESC"
    : "SELECT * FROM opportunities ORDER BY updated_at DESC";

  const result = status
    ? await db.prepare(query).bind(status).all<Record<string, unknown>>()
    : await db.prepare(query).all<Record<string, unknown>>();

  return result.results.map((row) => ({
    id: String(row.id),
    dedupeKey: String(row.dedupe_key),
    company: String(row.company),
    role: String(row.role),
    url: String(row.url),
    location: row.location ? String(row.location) : undefined,
    source: String(row.source),
    remote: Boolean(row.remote),
    fitScore: row.fit_score == null ? undefined : Number(row.fit_score),
    matchedSkills: JSON.parse(String(row.matched_skills || "[]")),
    status: String(row.status) as JobStatus,
    recruiter: row.recruiter ? String(row.recruiter) : undefined,
    recruiterUrl: row.recruiter_url ? String(row.recruiter_url) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
}

export async function updateOpportunity(
  db: D1DatabaseLike | undefined,
  id: string,
  status: JobStatus,
  notes?: string,
) {
  const current = db
    ? null
    : memory.get(id);

  if (!db && !current) throw new Error("Opportunity not found.");

  const updatedAt = new Date().toISOString();

  if (!db && current) {
    const updated = { ...current, status, notes: notes ?? current.notes, updatedAt };
    memory.set(id, updated);
    return updated;
  }

  await db!.prepare(
    "UPDATE opportunities SET status = ?, notes = COALESCE(?, notes), updated_at = ? WHERE id = ?",
  ).bind(status, notes ?? null, updatedAt, id).run();

  return { id, status, notes, updatedAt };
}
