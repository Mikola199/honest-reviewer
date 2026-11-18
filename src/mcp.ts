import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import * as github from "./github.js";

export function createMcpServer() {
  const server = new McpServer({ name: "honest-reviewer", version: "0.3.0" });

  server.tool("github_list_repositories",
    "List repositories visible to the configured GitHub identity. Read-only.",
    {},
    async () => {
      const repos = await github.listRepositories();
      return { content: [{ type: "text", text: JSON.stringify(repos.map(r => ({
        full_name: r.full_name, private: r.private, default_branch: r.default_branch, html_url: r.html_url
      })), null, 2) }] };
    }
  );

  server.tool("github_get_repository",
    "Read metadata for one owner/name repository. Read-only.",
    { repo: z.string().min(3).max(201) },
    async ({ repo }) => ({ content: [{ type: "text", text: JSON.stringify(await github.getRepository(repo), null, 2) }] })
  );

  server.tool("github_get_tree",
    "List repository paths at a branch, tag, or commit ref. Read-only.",
    { repo: z.string().min(3).max(201), ref: z.string().min(1).max(200) },
    async ({ repo, ref }) => {
      const result = await github.getTree(repo, ref);
      return { content: [{ type: "text", text: JSON.stringify({
        sha: result.sha, truncated: result.truncated,
        tree: result.tree.map(item => ({ path: item.path, type: item.type, size: item.size, sha: item.sha }))
      }, null, 2) }] };
    }
  );

  server.tool("github_get_file",
    "Read one text file at a pinned branch, tag, or commit ref. Files above 256 KB are rejected. Read-only.",
    { repo: z.string().min(3).max(201), path: z.string().min(1).max(500), ref: z.string().min(1).max(200) },
    async ({ repo, path, ref }) => {
      const file = await github.getFile(repo, path, ref);
      return { content: [{ type: "text", text: JSON.stringify(file, null, 2) }] };
    }
  );

  server.tool("github_get_pull_request",
    "Read pull request metadata, including base and head commit SHAs. Read-only.",
    { repo: z.string().min(3).max(201), number: z.number().int().positive() },
    async ({ repo, number }) => ({ content: [{ type: "text", text: JSON.stringify(await github.getPullRequest(repo, number), null, 2) }] })
  );

  server.tool("github_get_pull_request_files",
    "Read changed-file metadata and patches for a pull request. Read-only.",
    { repo: z.string().min(3).max(201), number: z.number().int().positive() },
    async ({ repo, number }) => ({ content: [{ type: "text", text: JSON.stringify(await github.getPullRequestFiles(repo, number), null, 2) }] })
  );

  server.tool("github_get_commit_checks",
    "Read check-run results for a commit SHA. Read-only.",
    { repo: z.string().min(3).max(201), ref: z.string().min(7).max(64) },
    async ({ repo, ref }) => ({ content: [{ type: "text", text: JSON.stringify(await github.getCommitChecks(repo, ref), null, 2) }] })
  );

  return server;
}

export async function handleMcpRequest(req: import("express").Request, res: import("express").Response) {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    enableJsonResponse: true
  });
  res.on("close", () => { void transport.close(); void server.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
