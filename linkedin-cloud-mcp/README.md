# LinkedIn Cloud Browser MCP

Remote Playwright MCP running on Cloudflare Browser Run. This is the version intended for use directly from ChatGPT; Claude Desktop is not required.

## What it does

It gives an MCP client browser-control tools backed by a Cloudflare-hosted Chromium session. The browser can open LinkedIn, let you log in manually, and then perform profile edits through Playwright.

The browser session is managed by Cloudflare's Durable Object-backed MCP agent. Do not put a LinkedIn password, cookie, or session token in GitHub.

## Deploy

From this directory:

~~~bash
npm install
npm run build
npm run deploy
~~~

Cloudflare will create the Browser Run and Durable Object resources described in `wrangler.jsonc`.

The deployed endpoints are:

- MCP: `https://YOUR-WORKER.workers.dev/mcp`
- SSE: `https://YOUR-WORKER.workers.dev/sse`

## First LinkedIn login

After connecting this MCP server to ChatGPT, tell it:

> Open LinkedIn and let me log in manually.

The browser MCP can expose a live browser view while the session is active. Complete LinkedIn login yourself, including MFA/CAPTCHA if LinkedIn requests it. Never give the agent your password.

Then tell ChatGPT:

> Go to my LinkedIn profile and verify that I'm logged in.

## Profile editing

Once authenticated, ChatGPT can use the browser tools to:

- Add a GitHub project to Projects.
- Edit About.
- Add Skills.
- Edit other visible profile fields.
- Verify the resulting page after a change.

For example:

> Add my GitHub project https://github.com/Mohamed20333/PhishGuard-ML to my LinkedIn Projects. Use the repository README to write a concise professional description, then show me the proposed text before saving.

For safety, keep confirmation before consequential profile changes. Do not enable blind bulk actions.

## Important limitations

- LinkedIn can change its UI; browser automation is best-effort and may need selector/tool adaptation.
- LinkedIn may challenge automated browsers with login verification, CAPTCHA, or MFA. Complete those manually.
- This does not bypass LinkedIn security controls, CAPTCHA, rate limits, or access restrictions.
- Browser Run is headless cloud Chromium, not your physical Chrome window.
- Browser Run usage has account/plan limits.

## ChatGPT connection

In ChatGPT, add the deployed MCP endpoint as a custom connector/MCP server using:

`https://YOUR-WORKER.workers.dev/mcp`

If your ChatGPT MCP UI asks for SSE instead, use:

`https://YOUR-WORKER.workers.dev/sse`

After connecting, start a chat and ask for a read-only navigation test first, then perform profile edits.

## Security

Treat MCP access as access to the logged-in LinkedIn account. Keep the MCP endpoint private/authenticated if your deployment environment supports that. Do not publish session URLs or browser Live View URLs; Cloudflare documents that Live View URLs contain access tokens.
