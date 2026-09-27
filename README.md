# Cyber Job Acquisition Engine — Remote MCP

A small MCP server for Claude focused on remote cybersecurity job research, fit analysis, outreach drafting and application tracking.

## Local run
Python 3.10+:

    python -m venv .venv
    # Windows: .venv\\Scripts\\activate
    # macOS/Linux: source .venv/bin/activate
    pip install -r requirements.txt
    python server.py

The MCP endpoint is typically `http://localhost:8000/mcp`.

## Claude remote connector
A Claude custom remote connector needs a publicly reachable HTTPS endpoint. Localhost will not work from Anthropic's cloud. Deploy the server behind HTTPS, add authentication, then use the resulting `/mcp` URL in Claude → Connectors → Add custom connector.

## Production hardening
Add OAuth/token authentication, HTTPS, persistent DB, request logging, abuse protection, and environment-based secrets before public deployment.
