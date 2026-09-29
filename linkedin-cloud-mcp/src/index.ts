import { createMcpAgent } from "@cloudflare/playwright-mcp";

interface Env {
  BROWSER: Fetcher;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const { pathname } = new URL(request.url);
    const PlaywrightMCP = createMcpAgent(env.BROWSER);

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
