import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

interface Env { BROWSER: Fetcher; BROWSER_SESSION: DurableObjectNamespace; }

function makeHandler(env: Env) {\n  const handler = createMcpHandler(() => {
  const server = new McpServer({ name: "linkedin-profile-agent", version: "3.0.0" });
  const call = async (env: Env, action: string, payload: Record<string, unknown> = {}) => {
    const id = env.BROWSER_SESSION.idFromName("linkedin-primary");
    const r = await env.BROWSER_SESSION.get(id).fetch("https://browser-session/action", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const text = await r.text();
    let data: any; try { data = JSON.parse(text); } catch { data = { ok: false, error: { code: "MCP_UNAVAILABLE", message: text } }; }
    return { content: [{ type: "text" as const, text: JSON.stringify(data) }], ...(r.ok ? {} : { isError: true }) };
  };
  server.registerTool("browser_status", { description: "Inspect the persistent browser session without creating a browser.", inputSchema: z.object({}) },
    async (_a, c) => call((c as any).env, "status"));
  server.registerTool("linkedin_check_login", { description: "Open LinkedIn and report LOGIN_REQUIRED, LOGGED_IN, or HUMAN_INTERVENTION_REQUIRED. No account changes.", inputSchema: z.object({}) },
    async (_a, c) => call((c as any).env, "linkedin_check"));
  server.registerTool("browser_open", { description: "Open a LinkedIn URL in the persistent cloud browser.", inputSchema: z.object({ url: z.string().url() }) },
    async ({ url }, c) => call((c as any).env, "open", { url }));
  server.registerTool("browser_snapshot", { description: "Read current browser URL, title and visible text.", inputSchema: z.object({}) },
    async (_a, c) => call((c as any).env, "snapshot"));
  server.registerTool("browser_click", { description: "Click a visible element by CSS selector.", inputSchema: z.object({ selector: z.string() }) },
    async ({ selector }, c) => call((c as any).env, "click", { selector }));
  server.registerTool("browser_type", { description: "Fill a visible element. Do not use for passwords unless explicitly authorized.", inputSchema: z.object({ selector: z.string(), text: z.string() }) },
    async ({ selector, text }, c) => call((c as any).env, "type", { selector, text }));
  server.registerTool("browser_back", { description: "Go back one page.", inputSchema: z.object({}) },
    async (_a, c) => call((c as any).env, "back"));
  server.registerTool("browser_live_view", { description: "Return a temporary Cloudflare Live View URL for manual login, MFA, CAPTCHA or verification. Never bypass security controls.", inputSchema: z.object({}) },
    async (_a, c) => call((c as any).env, "live_view"));
  return server;
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const path = new URL(request.url).pathname;
    if (path === "/health") return Response.json({
      ok: true, service: "linkedin-profile-agent", version: "3.0.0",
      browser: { configured: Boolean(env.BROWSER), session: "managed-by-durable-object" },
      mcp: { transport: "streamable-http", endpoint: "/mcp" },
    });
    if (path === "/mcp") return makeHandler(env)(request, env, ctx);
    if (path === "/sse" || path === "/sse/message") return Response.json({ error: "SSE_DEPRECATED", message: "Use /mcp Streamable HTTP." }, { status: 410 });
    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
