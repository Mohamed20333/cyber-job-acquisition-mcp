# LinkedIn Profile Agent

Local MCP server for Claude Desktop and other MCP hosts.

It controls a dedicated persistent Chromium profile through Playwright. You log in to LinkedIn manually once; the agent reuses that local browser profile afterward.

## Features

- Check LinkedIn login state.
- Open the user's profile.
- Add a Project.
- Replace the About section.
- Add a Skill.
- Keep credentials and cookies local.

## Architecture

Claude Desktop -> local MCP -> Playwright Chromium -> LinkedIn

This must run locally because browser automation needs a real browser process. The existing Cloudflare job engine remains separate.

The dedicated profile is stored at:
- Linux/macOS: ~/.linkedin-profile-agent
- Windows: %USERPROFILE%\.linkedin-profile-agent

Do not point this at your normal Chrome profile.

## Requirements

- Node.js 20+
- Claude Desktop
- LinkedIn account
- Internet access

## Install

From linkedin-agent:

~~~bash
npm install
npm run install-browser
npm run build
~~~

## First login

Run:

~~~bash
npm start
~~~

A Chromium window opens. Log in to LinkedIn manually. After the session is established, close the process and let Claude Desktop launch the MCP server.

## Claude Desktop MCP configuration

Use the absolute path to dist/index.js.

Windows:

~~~json
{
  "mcpServers": {
    "linkedin-profile-agent": {
      "command": "node",
      "args": [
        "C:\\ABSOLUTE\\PATH\\TO\\cyber-job-acquisition-mcp\\linkedin-agent\\dist\\index.js"
      ],
      "env": {
        "LINKEDIN_AUTO_CONFIRM": "false"
      }
    }
  }
}
~~~

macOS/Linux:

~~~json
{
  "mcpServers": {
    "linkedin-profile-agent": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/TO/cyber-job-acquisition-mcp/linkedin-agent/dist/index.js"
      ],
      "env": {
        "LINKEDIN_AUTO_CONFIRM": "false"
      }
    }
  }
}
~~~

Restart Claude Desktop after changing the MCP configuration.

## Automation mode

Default is confirmation mode. The model must call a write tool with confirmed=true.

For fully automatic profile edits, set:

~~~text
LINKEDIN_AUTO_CONFIRM=true
~~~

Use automatic mode only if you accept unsupervised profile edits.

## Example commands

Ask Claude:

- Check my LinkedIn status.
- Open my LinkedIn profile.
- Add my GitHub project PhishGuard-ML to my LinkedIn Projects.
- Update my About section for cybersecurity internships.
- Add Burp Suite to my Skills.

## Security

- No LinkedIn password is stored in this repository.
- Cookies/session data stay in the ignored local profile directory.
- CAPTCHA, MFA, and security challenges remain manual.
- No CAPTCHA bypass, session theft, rate-limit evasion, or security-control bypass is implemented.

## Maintenance

LinkedIn can change its UI. If selectors stop working, update src/index.ts and run npm run build.

## GitHub-to-LinkedIn shortcut

The MCP includes a dedicated tool named `linkedin_add_github_project`. Claude can pass a public repository such as `Mohamed20333/PhishGuard-ML`; the server fetches public repository metadata and README text, prepares the project content, then writes it to LinkedIn through the local browser session.

Example:

> Add Mohamed20333/PhishGuard-ML to my LinkedIn Projects.

The default confirmation mode makes Claude first show the proposed project data. A second call with `confirmed=true` performs the browser write.
