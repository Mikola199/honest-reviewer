# Honest Reviewer MCP Server — v0.3.0 starter

A TypeScript/Node.js, read-only MCP server starter for GitHub repository and pull-request inspection.

## Current scope

Implemented tools:
- `github_list_repositories`
- `github_get_repository`
- `github_get_tree`
- `github_get_file`
- `github_get_pull_request`
- `github_get_pull_request_files`
- `github_get_commit_checks`

The server has no write-capable GitHub operations and no generic proxy tool.

## Important implementation status

This is a development starter, **not a deployed production OAuth integration**.

For the first local smoke test it accepts `GITHUB_TOKEN` from the server environment. Do not use a personal token as a production multi-user authorization design. The production phase must replace this single-identity adapter with GitHub App user authorization/installation selection, encrypted server-side token storage, per-user repository authorization, disconnect/revocation, and a server-enforced read-only permission set.

Do not put tokens in source files, browser code, plugin manifests, chat messages, or logs.

## Requirements

- Node.js 20+
- A GitHub token configured locally with only the read permissions needed for testing.

## Run on Windows PowerShell

```powershell
# 1. Extract the ZIP and enter the project folder
Set-Location .\honest-reviewer-server-v0.3.0

# 2. Install dependencies
npm install

# 3. Create local environment file
Copy-Item .env.example .env
notepad .env

# 4. Put the test token only in the local .env file, then run
npm run dev
```

Check `http://localhost:3000/health`. The MCP endpoint is `http://localhost:3000/mcp`.

## Build

```powershell
npm run typecheck
npm run build
npm start
```

## Security notes before public deployment

1. Replace the development token with GitHub App authorization and per-user installation tokens.
2. Add durable encrypted token/session storage and CSRF/state/replay protection.
3. Enforce selected-repository allowlists server-side.
4. Add request rate limits, audit events without secrets, and bounded pagination.
5. Configure HTTPS, trusted host validation, and strict CORS for the final ChatGPT MCP client origin.
6. Add automated tests for OAuth state, cross-user isolation, repository allowlists, and denial of all write operations.
7. Do not claim OAuth is live until those acceptance tests pass.

## Current limitations

- Stateless MCP HTTP starter; production hosting/auth/session lifecycle still needs hardening.
- GitHub API pagination currently reads the first page only.
- File content limit: 256 KB.
- Dependency advisory scanning, secret scanning, local test execution, and UI screenshot analysis are not implemented yet.
- `github_get_commit_checks` requires the GitHub Checks read permission.

## Architecture

```text
ChatGPT / MCP client
        |
        | Streamable HTTP POST /mcp
        v
Node.js + TypeScript MCP server
        |
        | read-only GitHub REST GET
        v
GitHub API
```
