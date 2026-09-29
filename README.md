.# Cyber Job Acquisition Engine V2

Evidence-first cybersecurity job acquisition automation engine.

## Architecture

Cloudflare Worker
→ MCP tools
→ Cloudflare D1
→ Public job sources
→ Persistent opportunity/application/follow-up tracking

## Workflow

AUTO DISCOVER
→ VERIFY
→ DEDUPLICATE
→ ANALYZE
→ MATCH
→ PRIORITIZE
→ RESEARCH
→ DRAFT OUTREACH
→ CV DECISION
→ HUMAN REVIEW
→ TRACK
→ FOLLOW-UP

## Current discovery sources

- Remotive
- Arbeitnow

The engine only uses public sources and does not require logged-in LinkedIn access.

## Safety

The engine does not:

- scrape logged-in LinkedIn
- send automated LinkedIn messages
- send connection spam
- bypass CAPTCHA
- steal sessions or cookies
- evade rate limits
- fabricate candidate experience
- fabricate certifications
- automatically submit external applications

External outreach and applications require human review.

## Cloudflare D1 setup

Create a D1 database:

```bash
npx wrangler d1 create cyber-job-acquisition-db

## ChatGPT LinkedIn browser agent

A remote ChatGPT-ready Playwright/Browser Run implementation is in `linkedin-cloud-mcp/`. It does not require Claude Desktop. Deploy it to Cloudflare Workers, then connect its `/mcp` endpoint to ChatGPT as a custom MCP server. The first login is manual; after that, the browser agent can navigate and edit the authenticated LinkedIn profile.

See `linkedin-cloud-mcp/README.md` for deployment and first-login steps.
