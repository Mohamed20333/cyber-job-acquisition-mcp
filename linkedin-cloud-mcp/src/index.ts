import { env } from "cloudflare:workers";
import { createMcpAgent } from "@cloudflare/playwright-mcp";

type Env = {
  BROWSER: any;
  MCP_OBJECT: DurableObjectNamespace;
};

export const PlaywrightMCP = createMcpAgent(env.BROWSER);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const { pathname } = new URL(request.url);

    // Direct Browser Run health check. This intentionally bypasses MCP so we
    // can verify the Cloudflare browser binding independently of Playwright MCP.
    if (pathname === "/browser-test") {
      try {
        const response = await env.BROWSER.quickAction("content", {
          url: "https://demo.playwright.dev/todomvc",
          gotoOptions: {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          },
        });

        return new Response(
          JSON.stringify({
            ok: response.ok,
            browser: "cloudflare-browser-run",
            status: response.status,
            contentType: response.headers.get("content-type"),
            bodyPreview: (await response.text()).slice(0, 500),
          }),
          {
            status: response.ok ? 200 : 502,
            headers: { "content-type": "application/json; charset=utf-8" },
          },
        );
      } catch (error) {
        return Response.json(
          {
            ok: false,
            browser: "cloudflare-browser-run",
            error: error instanceof Error ? error.message : String(error),
          },
          { status: 502 },
        );
      }
    }

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