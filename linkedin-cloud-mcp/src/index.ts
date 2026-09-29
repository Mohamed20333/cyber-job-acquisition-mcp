import { env } from "cloudflare:workers";

import { createMcpAgent } from "@cloudflare/playwright-mcp";

interface Env {
  BROWSER: Fetcher;
  MCP_OBJECT: DurableObjectNamespace;
}

const browserEnv = env as unknown as Env;

export const PlaywrightMCP = createMcpAgent(browserEnv.BROWSER);

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const { pathname } = new URL(request.url);

    switch (pathname) {
      case "/sse":
      case "/sse/message":
        return PlaywrightMCP.serveSSE("/sse").fetch(request, env, ctx);
      case "/mcp":
        return PlaywrightMCP.serve("/mcp").fetch(request, env, ctx);
      default:
        return new Response("Not Found", { status: 404 });
    }
  },
};
