import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

interface Env {
  BROWSER: Fetcher;
  BROWSER_SESSION: DurableObjectNamespace;
}

const handler = createMcpHandler((_context) => {
  const server = new McpServer({
    name: "linkedin-profile-agent",
    version: "3.0.0",
  });

  server.registerTool("browser_status", {
    description: "Inspect the persistent LinkedIn Browser Run session without creating a new browser.",
    inputSchema: z.object({}),
  }, async (_args, context) => {
    const env = (context as any).env as Env;
    return callBrowser(env, "status");
  });

  server.registerTool("linkedin_check_login", {
    description: "Open linkedin.com and determine login state without changing the account.",
    inputSchema: z.object({}),
  }, async (_args, context) => {
    const env = (context as any).env as Env;
    return callBrowser(env, "linkedin_check");
  });

  server.registerTool("browser_open", {
    description: "Open a LinkedIn URL in the persistent cloud browser.",
    inputSchema: z.object({ url: z.string().url() }),
  }, async ({ url }, context) => {
    const env = (context as any).env as Env;
    return callBrowser(env, "open", { url });
  });

  server.registerTool("browser_snapshot", {
    description: "Read the current cloud browser URL, title, and visible text without changing the page.",
    inputSchema: z.object({}),
  }, async (_args, context) => {
    const env = (context as any).env as Env;
    return callBrowser(env, "snapshot");
  });

  server.registerTool("browser_click", {
    description: "Click a visible element using a CSS selector.",
    inputSchema: z.object({ selector: z.string() }),
  }, async ({ selector }, context) => {
    const env = (context as any).env as Env;
    return callBrowser(env, "click", { selector });
  });

  server.registerTool("browser_type", {
    description: "Fill a visible form element. Never use for passwords unless explicitly authorized.",
    inputSchema: z.object({ selector: z.string(), text: z.string() }),
  }, async ({ selector, text }, context) => {
    const env = (context as any).env as Env;
    return callBrowser(env, "type", { selector, text });
  });

  server.registerTool("browser_back", {
    description: "Navigate the persistent cloud browser one step backward.",
    inputSchema: z.object({}),
  }, async (_args, context) => {
    const env = (context as any).env as Env;
    return callBrowser(env, "back");
  });

  server.registerTool("browser_live_view", {
    description: "Return a temporary Cloudflare Live View URL for manual login, MFA, CAPTCHA, or verification. Never bypasses security controls.",
    inputSchema: z.object({}),
  }, async (_args, context) => {
    const env = (context as any).env as Env;
    return callBrowser(env, "live_view");
  });

  return server;
});

async function callBrowser(env: Env, action: string, payload: Record<string, unknown> = {}) {
  const id = env.BROWSER_SESSION.idFromName("linkedin-primary");
  const stub = env.BROWSER_SESSION.get(id);
  const response = await stub.fetch("https://browser-session/action", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const text = await response.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { ok: false, error: { code: "MCP_UNAVAILABLE", message: text } }; }
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    ...(response.ok ? {} : { isError: true }),
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const { pathname } = new URL(request.url);
    if (pathname === "/health") {
      return Response.json({
        ok: true,
        service: "linkedin-profile-agent",
        version: "3.0.0",
        browser: { configured: Boolean(env.BROWSER), session: "managed-by-durable-object" },
        mcp: { transport: "streamable-http", endpoint: "/mcp" },
      });
    }
    if (pathname === "/mcp") return handler(request, env, ctx);
    if (pathname === "/sse" || pathname === "/sse/message") {
      return Response.json({ error: "SSE_DEPRECATED", message: "Use Streamable HTTP at /mcp." }, { status: 410 });
    }
    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
