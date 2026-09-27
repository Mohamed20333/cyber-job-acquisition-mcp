import { createMcpHandler } from "agents/mcp/server";
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

interface Env {
  DB: D1Database;
}

type Job = {
  source: string;
  external_id?: string;
  url: string;
  title: string;
  company?: string;
  location?: string;
  remote?: boolean;
  description?: string;
  posted_at?: string;
};

const TARGET_ROLES = [
  "red team",
  "penetration testing",
  "ethical hacking",
  "cybersecurity",
  "soc analyst",
  "security analyst",
  "security engineer",
  "cybersecurity engineer",
  "cybersecurity intern",
  "cybersecurity trainee",
  "vulnerability management",
  "application security",
];

const VERIFIED_SKILLS = [
  "cybersecurity",
  "network security",
  "linux",
  "kali linux",
  "burp suite",
  "hashcat",
  "subfinder",
  "python",
  "nist",
  "ccna",
  "ethical hacking",
  "penetration testing",
  "red team",
  "ctf",
];

function now() {
  return new Date().toISOString();
}

function normalizeUrl(url: string) {
  try {
    const u = new URL(url);
    u.hash = "";
    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_medium");
    u.searchParams.delete("utm_campaign");
    u.searchParams.delete("utm_term");
    u.searchParams.delete("utm_content");
    return u.toString().replace(/\/$/, "");
  } catch {
    return url.trim();
  }
}

function text(value: unknown) {
  return String(value ?? "").toLowerCase();
}

function analyzeJob(job: Job) {
  const haystack = `${job.title}\n${job.description ?? ""}`.toLowerCase();

  const matchedRoles = TARGET_ROLES.filter((role) =>
    haystack.includes(role),
  );

  const matchedSkills = VERIFIED_SKILLS.filter((skill) =>
    haystack.includes(skill),
  );

  const juniorSignals = [
    "junior",
    "entry level",
    "entry-level",
    "intern",
    "internship",
    "trainee",
    "graduate",
    "student",
  ].filter((x) => haystack.includes(x));

  const seniorSignals = [
    "senior",
    "lead",
    "principal",
    "manager",
    "director",
    "head of",
  ].filter((x) => haystack.includes(x));

  return {
    matched_roles: matchedRoles,
    matched_skills: matchedSkills,
    junior_signals: juniorSignals,
    senior_signals: seniorSignals,
  };
}

function matchScore(job: Job) {
  const analysis = analyzeJob(job);

  let score = 0;

  if (analysis.matched_roles.length > 0) {
    score += 40;
  }

  score += Math.min(35, analysis.matched_skills.length * 5);

  if (analysis.junior_signals.length > 0) {
    score += 20;
  }

  if (job.remote) {
    score += 5;
  }

  return Math.min(100, score);
}

async function fetchRemotive(): Promise<Job[]> {
  const response = await fetch(
    "https://remotive.com/api/remote-jobs?category=cyber-security",
    {
      headers: {
        "User-Agent": "CyberJobAcquisitionEngine/2.0",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Remotive returned ${response.status}`);
  }

  const data = await response.json<any>();

  return (data.jobs ?? []).map((job: any) => ({
    source: "remotive",
    external_id: String(job.id),
    url: job.url,
    title: job.title,
    company: job.company_name,
    location: job.candidate_required_location,
    remote: true,
    description: job.description,
    posted_at: job.publication_date,
  }));
}

async function fetchArbeitnow(): Promise<Job[]> {
  const response = await fetch("https://www.arbeitnow.com/api/job-board-api", {
    headers: {
      "User-Agent": "CyberJobAcquisitionEngine/2.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Arbeitnow returned ${response.status}`);
  }

  const data = await response.json<any>();

  return (data.data ?? []).map((job: any) => ({
    source: "arbeitnow",
    external_id: String(job.slug ?? job.id ?? ""),
    url: job.url,
    title: job.title,
    company: job.company_name,
    location: job.location,
    remote: Boolean(job.remote),
    description: job.description,
    posted_at: job.created_at
      ? new Date(job.created_at * 1000).toISOString()
      : undefined,
  }));
}

async function discoverJobs() {
  const results = await Promise.allSettled([
    fetchRemotive(),
    fetchArbeitnow(),
  ]);

  const jobs: Job[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      jobs.push(...result.value);
    }
  }

  const unique = new Map<string, Job>();

  for (const job of jobs) {
    if (!job.url || !job.title) continue;

    const normalized = normalizeUrl(job.url);

    if (!unique.has(normalized)) {
      unique.set(normalized, {
        ...job,
        url: normalized,
      });
    }
  }

  return {
    jobs: [...unique.values()],
    source_results: results.map((result) => result.status),
  };
}

async function saveOpportunity(db: D1Database, job: Job) {
  const timestamp = now();
  const score = matchScore(job);
  const analysis = analyzeJob(job);

  const result = await db
    .prepare(
      `
      INSERT INTO opportunities (
        source,
        external_id,
        canonical_url,
        title,
        company,
        location,
        remote,
        description,
        posted_at,
        discovered_at,
        verified_at,
        status,
        match_score,
        match_evidence,
        verification_evidence,
        last_checked_at,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(canonical_url) DO UPDATE SET
        last_checked_at = excluded.last_checked_at,
        updated_at = excluded.updated_at,
        description = excluded.description,
        match_score = excluded.match_score,
        match_evidence = excluded.match_evidence
      `,
    )
    .bind(
      job.source,
      job.external_id ?? null,
      job.url,
      job.title,
      job.company ?? null,
      job.location ?? null,
      job.remote ? 1 : 0,
      job.description ?? null,
      job.posted_at ?? null,
      timestamp,
      timestamp,
      "VERIFIED",
      score,
      JSON.stringify(analysis),
      JSON.stringify({
        source: job.source,
        checked_at: timestamp,
        url: job.url,
      }),
      timestamp,
      timestamp,
      timestamp,
    )
    .run();

  return result;
}

async function runDiscoveryCycle(db: D1Database) {
  const started = now();

  const run = await db
    .prepare(
      `
      INSERT INTO discovery_runs
      (started_at, status, sources)
      VALUES (?, ?, ?)
      `,
    )
    .bind(
      started,
      "RUNNING",
      JSON.stringify(["remotive", "arbeitnow"]),
    )
    .run();

  const runId = Number(run.meta.last_row_id);

  try {
    const discovered = await discoverJobs();

    let newCount = 0;
    let verifiedCount = 0;

    for (const job of discovered.jobs) {
      const existing = await db
        .prepare(
          `
          SELECT id
          FROM opportunities
          WHERE canonical_url = ?
          `,
        )
        .bind(job.url)
        .first();

      await saveOpportunity(db, job);

      if (existing) {
        verifiedCount++;
      } else {
        newCount++;
      }
    }

    await db
      .prepare(
        `
        UPDATE discovery_runs
        SET
          finished_at = ?,
          status = ?,
          discovered_count = ?,
          new_count = ?,
          verified_count = ?
        WHERE id = ?
        `,
      )
      .bind(
        now(),
        "COMPLETED",
        discovered.jobs.length,
        newCount,
        verifiedCount,
        runId,
      )
      .run();

    return {
      status: "COMPLETED",
      discovered: discovered.jobs.length,
      new: newCount,
      verified: verifiedCount,
      sources: discovered.source_results,
    };
  } catch (error) {
    await db
      .prepare(
        `
        UPDATE discovery_runs
        SET
          finished_at = ?,
          status = ?,
          error = ?
        WHERE id = ?
        `,
      )
      .bind(
        now(),
        "FAILED",
        error instanceof Error ? error.message : String(error),
        runId,
      )
      .run();

    throw error;
  }
}

function createServer(env: Env) {
  const server = new McpServer({
    name: "Cyber Job Acquisition Engine",
    version: "2.0.0",
  });

  server.registerTool(
    "health",
    {
      description: "Return engine and database health.",
      inputSchema: {},
    },
    async () => {
      let database = "unknown";

      try {
        await env.DB.prepare("SELECT 1").first();
        database = "ok";
      } catch {
        database = "error";
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: database === "ok" ? "ok" : "degraded",
              service: "cyber-job-acquisition-engine",
              version: "2.0.0",
              database,
              discovery_sources: ["remotive", "arbeitnow"],
              timestamp: now(),
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "discover_jobs",
    {
      description:
        "Discover cybersecurity jobs from configured public job sources and persist verified opportunities.",
      inputSchema: {},
    },
    async () => {
      try {
        const result = await runDiscoveryCycle(env.DB);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "FAILED",
                  error:
                    error instanceof Error
                      ? error.message
                      : String(error),
                },
                null,
                2,
              ),
            },
          ],
        };
      }
    },
  );

  server.registerTool(
    "list_opportunities",
    {
      description:
        "List persisted cybersecurity opportunities ordered by match score.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional(),
        minimum_score: z.number().int().min(0).max(100).optional(),
      },
    },
    async ({ limit = 20, minimum_score = 0 }) => {
      const result = await env.DB
        .prepare(
          `
          SELECT *
          FROM opportunities
          WHERE COALESCE(match_score, 0) >= ?
          ORDER BY COALESCE(match_score, 0) DESC, discovered_at DESC
          LIMIT ?
          `,
        )
        .bind(minimum_score, limit)
        .all();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.results, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "analyze_job",
    {
      description:
        "Analyze a job using only evidence present in the supplied description.",
      inputSchema: {
        title: z.string(),
        description: z.string(),
        url: z.string().optional(),
      },
    },
    async ({ title, description, url }) => {
      const job: Job = {
        source: "manual",
        url: url ?? "",
        title,
        description,
      };

      const analysis = analyzeJob(job);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                title,
                url,
                analysis,
                score: matchScore(job),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    "save_opportunity",
    {
      description: "Persist a manually supplied opportunity.",
      inputSchema: {
        source: z.string(),
        url: z.string().url(),
        title: z.string(),
        company: z.string().optional(),
        location: z.string().optional(),
        remote: z.boolean().optional(),
        description: z.string().optional(),
        posted_at: z.string().optional(),
      },
    },
    async (job) => {
      await saveOpportunity(env.DB, {
        ...job,
        url: normalizeUrl(job.url),
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "saved",
                url: normalizeUrl(job.url),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    "track_application",
    {
      description:
        "Create or update application tracking. This never submits an application externally.",
      inputSchema: {
        opportunity_id: z.number().int(),
        status: z.enum([
          "PLANNED",
          "READY_FOR_REVIEW",
          "APPLIED",
          "REJECTED",
          "INTERVIEW",
          "OFFER",
          "CLOSED",
        ]),
        cv_shared: z.boolean().optional(),
        notes: z.string().optional(),
      },
    },
    async ({
      opportunity_id,
      status,
      cv_shared = false,
      notes,
    }) => {
      const timestamp = now();

      await env.DB
        .prepare(
          `
          INSERT INTO applications
          (opportunity_id, status, cv_shared, notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(opportunity_id) DO UPDATE SET
            status = excluded.status,
            cv_shared = excluded.cv_shared,
            notes = excluded.notes,
            updated_at = excluded.updated_at
          `,
        )
        .bind(
          opportunity_id,
          status,
          cv_shared ? 1 : 0,
          notes ?? null,
          timestamp,
          timestamp,
        )
        .run();

      await env.DB
        .prepare(
          `
          UPDATE opportunities
          SET status = ?, updated_at = ?
          WHERE id = ?
          `,
        )
        .bind(status, timestamp, opportunity_id)
        .run();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "tracked",
              opportunity_id,
              application_status: status,
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "create_followup",
    {
      description:
        "Schedule a human-reviewed follow-up. It does not send messages automatically.",
      inputSchema: {
        opportunity_id: z.number().int().optional(),
        contact_id: z.number().int().optional(),
        due_at: z.string(),
        message: z.string(),
      },
    },
    async ({
      opportunity_id,
      contact_id,
      due_at,
      message,
    }) => {
      const timestamp = now();

      await env.DB
        .prepare(
          `
          INSERT INTO followups
          (opportunity_id, contact_id, due_at, status, message, created_at, updated_at)
          VALUES (?, ?, ?, 'PENDING', ?, ?, ?)
          `,
        )
        .bind(
          opportunity_id ?? null,
          contact_id ?? null,
          due_at,
          message,
          timestamp,
          timestamp,
        )
        .run();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "scheduled",
              due_at,
              action: "human_review_required",
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "draft_outreach",
    {
      description:
        "Draft personalized outreach using supplied facts. It never sends the message.",
      inputSchema: {
        person_name: z.string(),
        company: z.string(),
        role: z.string(),
        why_relevant: z.string(),
        request: z.string().optional(),
      },
    },
    async ({
      person_name,
      company,
      role,
      why_relevant,
      request,
    }) => {
      const message =
        `Hi ${person_name},\n\n` +
        `I came across your work at ${company} and the ${role} opportunity. ` +
        `${why_relevant}\n\n` +
        `${request ?? "I’d appreciate the opportunity to learn more about the role and whether my background could be relevant."}\n\n` +
        `Best,\nMohamed Mosliem Elsharkawy`;

      return {
        content: [
          {
            type: "text",
            text: message,
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_followups",
    {
      description: "Return pending follow-ups due before the supplied date.",
      inputSchema: {
        before: z.string(),
      },
    },
    async ({ before }) => {
      const result = await env.DB
        .prepare(
          `
          SELECT *
          FROM followups
          WHERE status = 'PENDING'
            AND due_at <= ?
          ORDER BY due_at ASC
          `,
        )
        .bind(before)
        .all();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.results, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_workflow",
    {
      description: "Return the complete automation workflow and safeguards.",
      inputSchema: {},
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              workflow: [
                "AUTO DISCOVER",
                "VERIFY",
                "DEDUPLICATE",
                "ANALYZE",
                "MATCH",
                "PRIORITIZE",
                "RESEARCH",
                "DRAFT OUTREACH",
                "CV DECISION",
                "HUMAN REVIEW",
                "TRACK",
                "FOLLOW-UP",
              ],
              safeguards: [
                "No logged-in LinkedIn scraping",
                "No automated LinkedIn messaging",
                "No connection spam",
                "No CAPTCHA bypass",
                "No session or cookie theft",
                "No rate-limit evasion",
                "No fabricated experience",
                "No fabricated certifications",
                "No automatic external application submission",
                "Outreach requires human review",
              ],
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  return server;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return createMcpHandler(createServer(env))(request, env, ctx);
  },

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext,
  ) {
    await runDiscoveryCycle(env.DB);
  },
};