import { env } from "cloudflare:workers";

import { createMcpAgent } from "@cloudflare/playwright-mcp";

const browser = (env as any).BROWSER;

export const PlaywrightMCP = createMcpAgent(browser);

export default {
  fetch(request: Request, env: any, ctx: ExecutionContext) {
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
