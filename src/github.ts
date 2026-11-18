const API = process.env.GITHUB_API_URL ?? "https://api.github.com";
const MAX_FILE_BYTES = 256_000;

export class GitHubApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "GitHubApiError";
  }
}

function token(): string {
  const value = process.env.GITHUB_TOKEN;
  if (!value) throw new Error("GitHub authorization is not configured on the server.");
  return value;
}

function validateRepo(repo: string): { owner: string; name: string } {
  const match = /^([A-Za-z0-9_.-]{1,100})\/([A-Za-z0-9_.-]{1,100})$/.exec(repo);
  if (!match) throw new Error("repo must use the owner/name format.");
  return { owner: match[1]!, name: match[2]! };
}

async function gh<T>(path: string): Promise<T> {
  // Only fixed GitHub API paths assembled from validated identifiers are accepted.
  const response = await fetch(`${API}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token()}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "honest-reviewer-mcp/0.3.0"
    },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) {
    const safeMessage = response.status === 401 ? "GitHub authorization failed."
      : response.status === 403 ? "GitHub denied access or rate limit was reached."
      : response.status === 404 ? "GitHub resource was not found or is not accessible."
      : `GitHub API request failed (${response.status}).`;
    throw new GitHubApiError(response.status, safeMessage);
  }
  return await response.json() as T;
}

export async function listRepositories() {
  return gh<Array<{ full_name: string; private: boolean; default_branch: string; html_url: string }>>(
    "/user/repos?per_page=100&sort=updated"
  );
}

export async function getRepository(repo: string) {
  const { owner, name } = validateRepo(repo);
  return gh<{ full_name: string; default_branch: string; private: boolean; html_url: string; pushed_at: string }>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
  );
}

export async function getTree(repo: string, ref: string) {
  const { owner, name } = validateRepo(repo);
  if (!/^[A-Za-z0-9._/-]{1,200}$/.test(ref) || ref.includes("..")) throw new Error("Invalid ref.");
  return gh<{ sha: string; truncated: boolean; tree: Array<{ path: string; type: string; size?: number; sha: string }> }>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/git/trees/${encodeURIComponent(ref)}?recursive=1`
  );
}

export async function getFile(repo: string, path: string, ref: string) {
  const { owner, name } = validateRepo(repo);
  if (!path || path.length > 500 || path.startsWith("/") || path.split("/").includes("..")) {
    throw new Error("Invalid repository file path.");
  }
  if (!/^[A-Za-z0-9._/-]{1,200}$/.test(ref) || ref.includes("..")) throw new Error("Invalid ref.");
  const data = await gh<{ type: string; encoding: string; size: number; content?: string; path: string; sha: string }>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`
  );
  if (data.type !== "file") throw new Error("The requested path is not a file.");
  if (data.size > MAX_FILE_BYTES) throw new Error("File exceeds the configured 256 KB review limit.");
  if (!data.content) throw new Error("GitHub did not return file content.");
  const content = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8");
  return { path: data.path, sha: data.sha, size: data.size, content };
}

export async function getPullRequest(repo: string, number: number) {
  const { owner, name } = validateRepo(repo);
  if (!Number.isInteger(number) || number < 1) throw new Error("PR number must be a positive integer.");
  return gh<Record<string, unknown>>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls/${number}`);
}

export async function getPullRequestFiles(repo: string, number: number) {
  const { owner, name } = validateRepo(repo);
  if (!Number.isInteger(number) || number < 1) throw new Error("PR number must be a positive integer.");
  return gh<Array<{ filename: string; status: string; additions: number; deletions: number; patch?: string }>>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls/${number}/files?per_page=100`
  );
}

export async function getCommitChecks(repo: string, ref: string) {
  const { owner, name } = validateRepo(repo);
  if (!/^[A-Fa-f0-9]{7,64}$/.test(ref)) throw new Error("Use a commit SHA for checks.");
  return gh<Record<string, unknown>>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/commits/${ref}/check-runs?per_page=100`
  );
}
