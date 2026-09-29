import { env } from "cloudflare:workers";
import { createMcpAgent } from "@cloudflare/playwright-mcp";

const PlaywrightMCPBase = createMcpAgent(env.BROWSER);

export class PlaywrightMCP extends PlaywrightMCPBase {}

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
