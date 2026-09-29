import { env } from "cloudflare:workers";
import { createMcpAgent } from "@cloudflare/playwright-mcp";

type Env = {
  BROWSER: Fetcher;
  MCP_OBJECT: DurableObjectNamespace;
};

export const PlaywrightMCPV2 = createMcpAgent(env.BROWSER);

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const { pathname } = new URL(request.url);

    switch (pathname) {
      case "/sse":
      case "/sse/message":
        return PlaywrightMCPV2.serveSSE("/sse").fetch(request, env, ctx);

      case "/mcp":
        return PlaywrightMCPV2.serve("/mcp").fetch(request, env, ctx);

      default:
        return new Response("Not Found", { status: 404 });
    }
  },
};
