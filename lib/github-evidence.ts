import { EvaluationServiceError } from "@/lib/errors";
import { assertPublicHttpUrl } from "@/lib/ssrf";

export interface GithubExcerpt {
  path: string;
  lineRange: string;
  text: string;
}

export interface GithubCapture {
  notes: string;
  excerpts: GithubExcerpt[];
}

const MAX_FILES = 6;
const MAX_FILE_CHARS = 8_000;
const MAX_TOTAL_CHARS = 32_000;
const REQUEST_TIMEOUT_MS = 8_000;
const ALLOWED_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".json",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".go",
  ".rs",
  ".yml",
  ".yaml",
  ".html",
  ".css",
]);

function parseGithubRepo(raw: string): { owner: string; repo: string } {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new EvaluationServiceError("The GitHub repository URL is not valid.", 400);
  }
  if (parsed.protocol !== "https:") {
    throw new EvaluationServiceError("GitHub repository URLs must use https.", 400);
  }
  if (parsed.hostname.toLowerCase() !== "github.com") {
    throw new EvaluationServiceError("Only github.com repository URLs are accepted.", 400);
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new EvaluationServiceError(
      "The GitHub URL must be https://github.com/{owner}/{repository}.",
      400
    );
  }
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, "");
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) {
    throw new EvaluationServiceError("The GitHub owner or repository name is invalid.", 400);
  }
  if (["settings", "login", "orgs", "marketplace", "topics"].includes(owner.toLowerCase())) {
    throw new EvaluationServiceError("That GitHub URL is not a public repository.", 400);
  }
  return { owner, repo };
}

async function githubGet(path: string): Promise<Response> {
  const url = `https://api.github.com${path}`;
  await assertPublicHttpUrl(url);
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "ProofStack-Live-Hackathon",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (response.status >= 300 && response.status < 400) {
    throw new EvaluationServiceError("Unexpected redirect while fetching repository metadata.", 422);
  }
  return response;
}

function decodeFileContent(payload: { encoding?: string; content?: string; download_url?: string }): string {
  if (payload.encoding === "base64" && payload.content) {
    return Buffer.from(payload.content.replace(/\n/g, ""), "base64").toString("utf8");
  }
  return "";
}

function isProbablyText(value: string): boolean {
  if (!value) return false;
  const sample = value.slice(0, 500);
  return !sample.includes("\u0000");
}

export async function captureGithubEvidence(rawUrl: string): Promise<GithubCapture> {
  const { owner, repo } = parseGithubRepo(rawUrl);
  await assertPublicHttpUrl(`https://github.com/${owner}/${repo}`);

  const repoResponse = await githubGet(`/repos/${owner}/${repo}`);
  if (repoResponse.status === 404) {
    throw new EvaluationServiceError("That GitHub repository was not found or is not public.", 400);
  }
  if (!repoResponse.ok) {
    throw new EvaluationServiceError("GitHub repository metadata could not be retrieved.", 422);
  }

  const repoJson = (await repoResponse.json()) as {
    private?: boolean;
    default_branch?: string;
    html_url?: string;
  };
  if (repoJson.private) {
    throw new EvaluationServiceError("Private GitHub repositories cannot be inspected.", 400);
  }

  const contentsResponse = await githubGet(`/repos/${owner}/${repo}/contents/`);
  if (!contentsResponse.ok) {
    throw new EvaluationServiceError("The repository file list could not be retrieved.", 422);
  }
  const listingJson = (await contentsResponse.json()) as unknown;
  if (!Array.isArray(listingJson)) {
    throw new EvaluationServiceError("The repository root listing was not usable.", 422);
  }
  const listing = listingJson as Array<{
    name: string;
    path: string;
    type: string;
    size: number;
  }>;

  const preferred = [
    "README.md",
    "README",
    "package.json",
    "pyproject.toml",
    "Cargo.toml",
    "go.mod",
    "app/page.tsx",
    "src/App.tsx",
    "src/index.ts",
  ];

  const files = listing.filter((item) => item.type === "file" && item.size > 0 && item.size < 200_000);
  const selected: typeof files = [];
  for (const name of preferred) {
    const match = files.find((item) => item.path === name || item.name === name);
    if (match && !selected.includes(match)) selected.push(match);
  }
  for (const item of files) {
    if (selected.length >= MAX_FILES) break;
    const ext = item.name.includes(".") ? item.name.slice(item.name.lastIndexOf(".")).toLowerCase() : "";
    if (ALLOWED_EXTENSIONS.has(ext) && !selected.includes(item)) selected.push(item);
  }

  const excerpts: GithubExcerpt[] = [];
  let totalChars = 0;

  for (const file of selected.slice(0, MAX_FILES)) {
    const fileResponse = await githubGet(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(file.path)}`
    );
    if (!fileResponse.ok) continue;
    const payload = (await fileResponse.json()) as {
      encoding?: string;
      content?: string;
      size?: number;
    };
    const decoded = decodeFileContent(payload);
    if (!isProbablyText(decoded)) continue;
    const clipped = decoded.slice(0, MAX_FILE_CHARS);
    if (totalChars + clipped.length > MAX_TOTAL_CHARS) break;
    totalChars += clipped.length;
    const lineCount = clipped.split(/\r?\n/).length;
    excerpts.push({
      path: file.path,
      lineRange: `1-${lineCount}`,
      text: clipped,
    });
  }

  if (excerpts.length === 0) {
    throw new EvaluationServiceError(
      "No readable documentation or source files could be retrieved from the repository.",
      422
    );
  }

  const notes = [
    "CODE EVIDENCE (repository). This is source/documentation, not runtime proof.",
    `repository=https://github.com/${owner}/${repo}`,
    ...excerpts.map(
      (excerpt) =>
        `id=${excerpt.path}; kind=repository-file; path=${excerpt.path}; lineRange=${excerpt.lineRange}\n${excerpt.text}`
    ),
  ].join("\n\n");

  return { notes, excerpts };
}
