import { createMcpHandler } from "agents/mcp/server";
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

function createServer() {
  const server = new McpServer({
    name: "Cyber Job Acquisition Engine",
    version: "1.0.0",
  });

  // --------------------------------------------------
  // 1. HEALTH
  // --------------------------------------------------

  server.registerTool(
    "health",
    {
      description: "Check whether the Cyber Job Acquisition MCP server is online.",
      inputSchema: {},
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "ok",
            service: "cyber-job-acquisition-engine",
            version: "1.0.0",
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    }),
  );

  // --------------------------------------------------
  // 2. ANALYZE JOB
  // --------------------------------------------------

  server.registerTool(
    "analyze_job",
    {
      description:
        "Analyze a cybersecurity job description and extract role, skills, requirements, seniority, location, remote status, and possible fit signals.",
      inputSchema: {
        title: z.string(),
        description: z.string(),
      },
    },
    async ({ title, description }) => {
      const text = description.toLowerCase();

      const skills = [
        "penetration testing",
        "ethical hacking",
        "burp suite",
        "kali linux",
        "nmap",
        "metasploit",
        "web application security",
        "red team",
        "soc",
        "siem",
        "splunk",
        "sentinel",
        "incident response",
        "network security",
        "python",
        "linux",
        "active directory",
        "cloud security",
        "aws",
        "azure",
        "gcp",
        "wireshark",
        "tcp/ip",
        "nist",
        "iso 27001",
      ];

      const detectedSkills = skills.filter((skill) =>
        text.includes(skill),
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
      ];

      const senioritySignals = juniorSignals.filter((signal) =>
        text.includes(signal),
      );

      const remote =
        text.includes("remote") ||
        text.includes("work from home") ||
        text.includes("distributed");

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                title,
                detected_skills: detectedSkills,
                junior_or_entry_signals: senioritySignals,
                remote_signal: remote,
                analysis_note:
                  "This is an evidence-based extraction from the supplied job description. It does not invent requirements or candidate experience.",
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // --------------------------------------------------
  // 3. MATCH CANDIDATE
  // --------------------------------------------------

  server.registerTool(
    "match_candidate",
    {
      description:
        "Compare a candidate profile against a cybersecurity job description without inventing experience, certifications, or employment history.",
      inputSchema: {
        job_description: z.string(),
        candidate_profile: z.string(),
      },
    },
    async ({ job_description, candidate_profile }) => {
      const job = job_description.toLowerCase();
      const candidate = candidate_profile.toLowerCase();

      const keywords = [
        "penetration testing",
        "ethical hacking",
        "red team",
        "soc",
        "siem",
        "network security",
        "cybersecurity",
        "python",
        "linux",
        "kali linux",
        "burp suite",
        "nmap",
        "wireshark",
        "ctf",
        "incident response",
        "active directory",
        "cloud",
      ];

      const matches = keywords.filter(
        (keyword) =>
          job.includes(keyword) && candidate.includes(keyword),
      );

      const jobRequirements = keywords.filter((keyword) =>
        job.includes(keyword),
      );

      const missing = jobRequirements.filter(
        (keyword) => !candidate.includes(keyword),
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                matched_keywords: matches,
                potentially_missing_keywords: missing,
                job_keywords_detected: jobRequirements,
                methodology:
                  "Keyword overlap only. Human review is required for final qualification decisions.",
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // --------------------------------------------------
  // 4. SCORE JOB
  // --------------------------------------------------

  server.registerTool(
    "score_job",
    {
      description:
        "Produce a transparent job-fit score based only on supplied evidence.",
      inputSchema: {
        title: z.string(),
        description: z.string(),
        candidate_profile: z.string(),
      },
    },
    async ({ title, description, candidate_profile }) => {
      const job = description.toLowerCase();
      const candidate = candidate_profile.toLowerCase();

      const keywords = [
        "penetration testing",
        "ethical hacking",
        "red team",
        "soc",
        "siem",
        "network security",
        "cybersecurity",
        "python",
        "linux",
        "kali linux",
        "burp suite",
        "nmap",
        "wireshark",
      ];

      const requirements = keywords.filter((x) => job.includes(x));

      const matched = requirements.filter((x) =>
        candidate.includes(x),
      );

      const score =
        requirements.length === 0
          ? 0
          : Math.round((matched.length / requirements.length) * 100);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                title,
                score,
                matched,
                requirements,
                note:
                  "Score reflects keyword evidence only and is not an employment prediction or guarantee.",
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // --------------------------------------------------
  // 5. DRAFT OUTREACH
  // --------------------------------------------------

  server.registerTool(
    "draft_outreach",
    {
      description:
        "Draft a concise personalized professional outreach message. Never invent experience or achievements.",
      inputSchema: {
        person_name: z.string(),
        company: z.string(),
        role: z.string(),
        why_relevant: z.string(),
        request: z
          .string()
          .optional(),
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

  // --------------------------------------------------
  // 6. CV SHARING DECISION
  // --------------------------------------------------

  server.registerTool(
    "decide_cv_sharing",
    {
      description:
        "Assess whether sharing a CV is contextually appropriate based on the supplied situation.",
      inputSchema: {
        context: z.string(),
      },
    },
    async ({ context }) => {
      const text = context.toLowerCase();

      const explicitRequest =
        text.includes("send your cv") ||
        text.includes("send me your cv") ||
        text.includes("attach your cv") ||
        text.includes("resume");

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                explicit_cv_request: explicitRequest,
                recommendation:
                  explicitRequest
                    ? "CV sharing is contextually appropriate."
                    : "Do not automatically attach the CV; establish relevance or wait for a clear request.",
                principle:
                  "Avoid unsolicited document dumping and avoid claiming experience not present in the CV.",
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // --------------------------------------------------
  // 7. FOLLOW-UP
  // --------------------------------------------------

  server.registerTool(
    "draft_follow_up",
    {
      description:
        "Create a concise professional follow-up message.",
      inputSchema: {
        person_name: z.string(),
        company: z.string(),
        original_context: z.string(),
      },
    },
    async ({
      person_name,
      company,
      original_context,
    }) => {
      const message =
        `Hi ${person_name},\n\n` +
        `Just following up on my previous message regarding opportunities at ${company}. ` +
        `${original_context}\n\n` +
        `Thanks for your time,\nMohamed`;

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

  // --------------------------------------------------
  // 8. WORKFLOW
  // --------------------------------------------------

  server.registerTool(
    "get_workflow",
    {
      description:
        "Return the intended ethical cybersecurity job acquisition workflow.",
      inputSchema: {},
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              workflow: [
                "Discover legitimate remote cybersecurity opportunities",
                "Analyze job description",
                "Match requirements against verified candidate evidence",
                "Research company using public information",
                "Identify relevant public professional contact when appropriate",
                "Draft personalized outreach",
                "Decide whether CV sharing is appropriate",
                "Track application",
                "Prepare respectful follow-up",
              ],
              prohibited:
                [
                  "Bulk LinkedIn messaging",
                  "Automated connection spam",
                  "Logged-in LinkedIn scraping",
                  "CAPTCHA bypass",
                  "Cookie/session theft",
                  "Rate-limit evasion",
                  "Fabricated experience or certifications",
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
  fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    return createMcpHandler(createServer)(request, env, ctx);
  },
};