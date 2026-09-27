import { createMcpHandler } from "agents/mcp/server";
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { APP_VERSION } from "./config";
import { CANDIDATE_PROFILE } from "./candidate";
import { discoverJobs } from "./jobs";
import { matchJob } from "./matching";
import { researchCompany, researchPerson } from "./research";
import {
  listOpportunities,
  saveOpportunity,
  updateOpportunity,
  type D1DatabaseLike,
} from "./tracker";
import type { JobStatus } from "./types";

function createServer() {
  const server = new McpServer({
    name: "Cyber Job Acquisition Engine",
    version: APP_VERSION,
  });

  server.registerTool(
    "health",
    {
      description: "Check whether the Cyber Job Acquisition MCP server is online.",
      inputSchema: {},
    },
    async () => ({
      content: [{
        type: "text",
        text: JSON.stringify({
          status: "ok",
          service: "cyber-job-acquisition-engine",
          version: APP_VERSION,
          persistence: "memory-fallback",
          timestamp: new Date().toISOString(),
        }),
      }],
    }),
  );

  server.registerTool(
    "get_candidate_profile",
    {
      description: "Return the verified candidate profile used for job matching. Do not infer or add unverified experience.",
      inputSchema: {},
    },
    async () => ({
      content: [{ type: "text", text: JSON.stringify(CANDIDATE_PROFILE, null, 2) }],
    }),
  );

  server.registerTool(
    "search_jobs",
    {
      description: "Discover public cybersecurity job opportunities from supported public job APIs. Does not scrape logged-in sites.",
      inputSchema: {
        save: z.boolean().optional(),
      },
    },
    async ({ save = true }) => {
      const jobs = await discoverJobs();
      const enriched = jobs.map((job) => {
        const match = matchJob(job);
        return { ...job, fitScore: match.fitScore, matchedSkills: match.matchedSkills };
      });

      if (save) {
        for (const job of enriched) await saveOpportunity(undefined, job);
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            count: enriched.length,
            saved: save,
            jobs: enriched.slice(0, 50),
          }, null, 2),
        }],
      };
    },
  );

  server.registerTool(
    "run_discovery_cycle",
    {
      description: "Run discovery, evidence-based matching, and persistence as one cycle.",
      inputSchema: {},
    },
    async () => {
      const jobs = await discoverJobs();
      const processed = [];
      for (const job of jobs) {
        const match = matchJob(job);
        const enriched = {
          ...job,
          fitScore: match.fitScore,
          matchedSkills: match.matchedSkills,
        };
        await saveOpportunity(undefined, enriched);
        processed.push(enriched);
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            cycle: "completed",
            discovered: jobs.length,
            persisted: processed.length,
            generatedAt: new Date().toISOString(),
          }, null, 2),
        }],
      };
    },
  );

  server.registerTool(
    "analyze_job",
    {
      description: "Analyze a supplied job description and extract evidence-based role, skill, seniority, and remote signals.",
      inputSchema: {
        title: z.string(),
        description: z.string(),
      },
    },
    async ({ title, description }) => {
      const text = description.toLowerCase();
      const skills = [
        "penetration testing", "ethical hacking", "burp suite", "kali linux",
        "nmap", "metasploit", "web application security", "red team", "soc",
        "siem", "splunk", "sentinel", "incident response", "network security",
        "python", "linux", "active directory", "cloud security", "aws", "azure",
        "gcp", "wireshark", "tcp/ip", "nist", "iso 27001",
      ];
      const juniorSignals = [
        "junior", "entry level", "entry-level", "intern", "internship",
        "trainee", "graduate", "student",
      ];

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            title,
            detected_skills: skills.filter((x) => text.includes(x)),
            junior_or_entry_signals: juniorSignals.filter((x) => text.includes(x)),
            remote_signal:
              text.includes("remote") ||
              text.includes("work from home") ||
              text.includes("distributed"),
            note: "Extraction is based only on the supplied text.",
          }, null, 2),
        }],
      };
    },
  );

  server.registerTool(
    "match_candidate",
    {
      description: "Match a stored verified candidate profile against a supplied job description.",
      inputSchema: {
        job_description: z.string(),
      },
    },
    async ({ job_description }) => {
      const job = {
        id: "manual",
        dedupeKey: "manual",
        company: "Unknown",
        role: "Supplied job",
        url: "",
        source: "manual",
        remote: job_description.toLowerCase().includes("remote"),
        matchedSkills: [],
        status: "DISCOVERED" as const,
        notes: job_description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return {
        content: [{ type: "text", text: JSON.stringify(matchJob(job), null, 2) }],
      };
    },
  );

  server.registerTool(
    "save_opportunity",
    {
      description: "Persist a verified job opportunity in D1 when configured, otherwise use the temporary in-memory fallback.",
      inputSchema: {
        company: z.string(),
        role: z.string(),
        url: z.string(),
        source: z.string(),
        location: z.string().optional(),
        remote: z.boolean().optional(),
        fit_score: z.number().optional(),
        matched_skills: z.array(z.string()).optional(),
        notes: z.string().optional(),
      },
    },
    async (input) => {
      const now = new Date().toISOString();
      const job = {
        id: input.url.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 120),
        dedupeKey: input.url.toLowerCase().trim(),
        company: input.company,
        role: input.role,
        url: input.url,
        location: input.location,
        source: input.source,
        remote: input.remote ?? false,
        fitScore: input.fit_score,
        matchedSkills: input.matched_skills ?? [],
        status: "DISCOVERED" as const,
        notes: input.notes,
        createdAt: now,
        updatedAt: now,
      };
      await saveOpportunity(undefined, job);
      return { content: [{ type: "text", text: JSON.stringify(job, null, 2) }] };
    },
  );

  server.registerTool(
    "list_opportunities",
    {
      description: "List tracked opportunities, optionally filtered by status.",
      inputSchema: {
        status: z.string().optional(),
      },
    },
    async ({ status }) => ({
      content: [{
        type: "text",
        text: JSON.stringify(
          await listOpportunities(undefined, status as JobStatus | undefined),
          null,
          2,
        ),
      }],
    }),
  );

  server.registerTool(
    "update_opportunity",
    {
      description: "Update the tracked status and optional notes for an opportunity.",
      inputSchema: {
        id: z.string(),
        status: z.enum([
          "DISCOVERED", "QUALIFIED", "READY_TO_APPLY", "APPLIED",
          "CONTACTED", "REPLIED", "INTERVIEW", "REJECTED", "CLOSED", "FOLLOW_UP",
        ]),
        notes: z.string().optional(),
      },
    },
    async ({ id, status, notes }) => ({
      content: [{
        type: "text",
        text: JSON.stringify(await updateOpportunity(undefined, id, status, notes), null, 2),
      }],
    }),
  );

  server.registerTool(
    "research_company",
    {
      description: "Fetch and summarize visible public content from a supplied company URL.",
      inputSchema: { url: z.string().url() },
    },
    async ({ url }) => ({
      content: [{ type: "text", text: JSON.stringify(await researchCompany(url), null, 2) }],
    }),
  );

  server.registerTool(
    "research_person",
    {
      description: "Research a named professional using public search results when a search API key is configured. Never infer hiring authority without evidence.",
      inputSchema: {
        name: z.string(),
        company: z.string(),
      },
    },
    async ({ name, company }) => ({
      content: [{
        type: "text",
        text: JSON.stringify(
          await researchPerson(name, company),
          null,
          2,
        ),
      }],
    }),
  );

  server.registerTool(
    "draft_outreach",
    {
      description: "Draft concise personalized outreach without inventing experience or credentials.",
      inputSchema: {
        person_name: z.string(),
        company: z.string(),
        role: z.string(),
        why_relevant: z.string(),
        request: z.string().optional(),
      },
    },
    async ({ person_name, company, role, why_relevant, request }) => ({
      content: [{
        type: "text",
        text:
          `Hi ${person_name},

I came across your work at ${company} and the ${role} opportunity. ${why_relevant}

${request ?? "I’d appreciate the opportunity to learn more about the role and whether my background could be relevant."}

Best,
Mohamed Mosliem Elsharkawy`,
      }],
    }),
  );

  server.registerTool(
    "decide_cv_sharing",
    {
      description: "Assess whether a CV request is explicit in the supplied context.",
      inputSchema: { context: z.string() },
    },
    async ({ context }) => {
      const text = context.toLowerCase();
      const explicit = ["send your cv", "send me your cv", "attach your cv", "send your resume", "attach your resume"]
        .some((x) => text.includes(x));
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            explicit_cv_request: explicit,
            action: explicit
              ? "CV sharing is contextually appropriate."
              : "Do not automatically attach the CV without a clear request or relevant application context.",
          }, null, 2),
        }],
      };
    },
  );

  server.registerTool(
    "draft_follow_up",
    {
      description: "Create a concise professional follow-up message.",
      inputSchema: {
        person_name: z.string(),
        company: z.string(),
        original_context: z.string(),
      },
    },
    async ({ person_name, company, original_context }) => ({
      content: [{
        type: "text",
        text:
          `Hi ${person_name},

Just following up on my previous message regarding opportunities at ${company}. ${original_context}

Thanks for your time,
Mohamed`,
      }],
    }),
  );

  server.registerTool(
    "get_workflow",
    {
      description: "Return the complete ethical job-acquisition workflow and automation boundaries.",
      inputSchema: {},
    },
    async () => ({
      content: [{
        type: "text",
        text: JSON.stringify({
          workflow: [
            "Discover public legitimate opportunities",
            "Analyze job evidence",
            "Match against verified candidate data",
            "Persist and deduplicate opportunities",
            "Research company and public professional information",
            "Draft personalized outreach",
            "Decide CV sharing from explicit context",
            "Track application state",
            "Prepare follow-ups",
          ],
          prohibited: [
            "Bulk LinkedIn messaging",
            "Automated connection spam",
            "Logged-in LinkedIn scraping",
            "CAPTCHA bypass",
            "Cookie or session theft",
            "Rate-limit evasion",
            "Fabricated experience or certifications",
          ],
        }, null, 2),
      }],
    }),
  );

  return server;
}

export default {
  fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    return createMcpHandler(createServer)(request, env, ctx);
  },
};
