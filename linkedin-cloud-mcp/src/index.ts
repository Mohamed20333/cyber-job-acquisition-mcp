import { env } from "cloudflare:workers";
import { createMcpAgent } from "@cloudflare/playwright-mcp";

export const PlaywrightMCPV3 = createMcpAgent(env.BROWSER);

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const { pathname } = new URL(request.url);

    switch (pathname) {
      case "/sse":
      case "/sse/message":
        return PlaywrightMCPV3.serveSSE("/sse").fetch(request, env, ctx);
      case "/mcp":
        return PlaywrightMCPV3.serve("/mcp").fetch(request, env, ctx);
      default:
        return new Response("Not Found", { status: 404 });
    }
  },
};
