import { createMcpAgent } from "@cloudflare/playwright-mcp";

type Env = {
  BROWSER: Fetcher;
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const { pathname } = new URL(request.url);

    const browser = env.BROWSER;
    const PlaywrightMCP = createMcpAgent(browser);

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
