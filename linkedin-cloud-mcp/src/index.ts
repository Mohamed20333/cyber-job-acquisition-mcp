import { env } from "cloudflare:workers";
import { createMcpAgent } from "@cloudflare/playwright-mcp";
import { launch } from "@cloudflare/playwright";

type Env = {
  BROWSER: Fetcher;
  MCP_OBJECT: DurableObjectNamespace;
};

export const PlaywrightMCP = createMcpAgent(env.BROWSER);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const { pathname } = new URL(request.url);

    if (pathname === "/browser-test") {
      try {
        const browser = await launch(env.BROWSER);
        const page = await browser.newPage();
        await page.goto("https://demo.playwright.dev/todomvc", {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        const title = await page.title();
        const url = page.url();
        await browser.close();

        return Response.json({
          ok: true,
          browser: "cloudflare-browser-run",
          title,
          url,
        });
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
