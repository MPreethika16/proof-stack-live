"use client";

import { useState } from "react";
import type { Criterion, LiveProofPreset } from "@/types/evaluation";

const PRESETS: LiveProofPreset[] = [
  {
    id: "dual-commerce",
    name: "Commerce Store (Demo + GitHub)",
    demoUrl: "https://demo.vercel.store",
    githubUrl: "https://github.com/vercel/commerce",
    projectDescription:
      "An open-source headless e-commerce store with real-time product filtering, dynamic cart management, and server-side rendering.",
    requirements: [
      {
        id: "req-1",
        requirement:
          "Verify product catalog renders responsive grid with price tags and search filtering.",
        maxMarks: 20,
      },
      {
        id: "req-2",
        requirement:
          "Verify repository architecture contains TypeScript route handlers and component modularity.",
        maxMarks: 20,
      },
    ],
    description: "Dual-source: Evaluates live website behavior and GitHub codebase.",
  },
  {
    id: "demo-wikipedia",
    name: "Wikipedia Portal (Live Demo Only)",
    demoUrl: "https://en.wikipedia.org/wiki/Main_Page",
    githubUrl: "",
    projectDescription:
      "High-traffic encyclopedic public portal showcasing daily featured content, global news items, and interactive multilingual search navigation.",
    requirements: [
      {
        id: "req-1",
        requirement:
          "Verify main page displays 'Today's featured article' with readable typography and lead paragraph.",
        maxMarks: 20,
      },
      {
        id: "req-2",
        requirement:
          "Verify left navigation sidebar contains accessible language selection and community links.",
        maxMarks: 20,
      },
    ],
    description: "Runtime-only: Captures browser screenshots and tests live UI elements.",
  },
  {
    id: "repo-zod",
    name: "Zod Schema Engine (GitHub Only)",
    demoUrl: "",
    githubUrl: "https://github.com/colinhacks/zod",
    projectDescription:
      "TypeScript-first schema validation library with static type inference, zero runtime dependencies, and comprehensive unit tests.",
    requirements: [
      {
        id: "req-1",
        requirement:
          "Verify repository README specifies installation instructions, API examples, and ecosystem documentation.",
        maxMarks: 20,
      },
      {
        id: "req-2",
        requirement:
          "Verify package manifest exports modern ESM/CJS build targets and TypeScript declarations.",
        maxMarks: 20,
      },
    ],
    description: "Source-code only: Inspects repository files, documentation, and architecture.",
  },
];

interface LiveProofPanelProps {
  onSwitchToUpload?: () => void;
}

interface ValidationResult {
  isValid: boolean;
  isEmpty?: boolean;
  error?: string;
}

function validateUrl(inputUrl: string, fieldName: "Live Demo URL" | "GitHub Repository URL"): ValidationResult {
  const trimmed = inputUrl.trim();
  if (!trimmed) {
    return { isValid: true, isEmpty: true };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      isValid: false,
      error: `Invalid ${fieldName}: Please enter a fully qualified URL starting with http:// or https://`,
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      isValid: false,
      error: `${fieldName} uses unsupported protocol "${parsed.protocol}". Only "http:" and "https:" URLs are allowed.`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Localhost & internal domain rejection
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return {
      isValid: false,
      error: `${fieldName}: Localhost or internal domain "${hostname}" is blocked. Only publicly accessible targets are permitted.`,
    };
  }

  // Loopback IPv4 & IPv6
  if (
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname.startsWith("127.")
  ) {
    return {
      isValid: false,
      error: `${fieldName}: Loopback and broadcast IP addresses (127.0.0.0/8, ::1, 0.0.0.0) are strictly rejected.`,
    };
  }

  // Private IPv4 ranges
  if (hostname.startsWith("10.")) {
    return { isValid: false, error: `${fieldName}: Private network IP (10.0.0.0/8) is blocked for safety.` };
  }
  if (hostname.startsWith("192.168.")) {
    return { isValid: false, error: `${fieldName}: Private network IP (192.168.0.0/16) is blocked for safety.` };
  }
  if (hostname.startsWith("169.254.")) {
    return { isValid: false, error: `${fieldName}: Link-local cloud metadata IP (169.254.0.0/16) is strictly rejected.` };
  }

  const ipParts = hostname.split(".");
  if (ipParts.length === 4 && ipParts.every((p) => /^\d+$/.test(p))) {
    const octet1 = parseInt(ipParts[0], 10);
    const octet2 = parseInt(ipParts[1], 10);
    if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) {
      return { isValid: false, error: `${fieldName}: Private network IP (172.16.0.0/12) is blocked for safety.` };
    }
  }

  // IPv6 unique local (fc00::/7) or link-local (fe80::/10)
  if (hostname.startsWith("[fc") || hostname.startsWith("[fd") || hostname.startsWith("[fe80")) {
    return { isValid: false, error: `${fieldName}: Private IPv6 unique-local/link-local address is blocked.` };
  }

  // GitHub URL specific checks
  if (fieldName === "GitHub Repository URL") {
    if (hostname !== "github.com" && !hostname.endsWith(".github.com")) {
      return {
        isValid: false,
        error: `GitHub Repository URL should point to a valid GitHub repository on github.com (e.g. https://github.com/owner/repository).`,
      };
    }
  }

  return { isValid: true, isEmpty: false };
}

function generateRequirementId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

const DEFAULT_REQUIREMENTS: Criterion[] = [
  {
    id: "req-1",
    requirement: "User authentication flow works and handles invalid credentials gracefully.",
    maxMarks: 20,
  },
  {
    id: "req-2",
    requirement: "Core business logic completes end-to-end with visual feedback.",
    maxMarks: 30,
  },
];

export default function LiveProofPanel({ onSwitchToUpload }: LiveProofPanelProps) {
  const [demoUrl, setDemoUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [requirements, setRequirements] = useState<Criterion[]>(DEFAULT_REQUIREMENTS);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Staged state keeps all entered values intact when editing
  const [stagedConfig, setStagedConfig] = useState<{
    demoUrl: string;
    githubUrl: string;
    projectDescription: string;
    requirements: Criterion[];
    totalMarks: number;
    evaluationScope: "DUAL" | "WEBSITE_ONLY" | "GITHUB_ONLY";
  } | null>(null);

  // Auto-calculated total marks
  const totalMarks = requirements.reduce(
    (sum, r) => sum + (Number(r.maxMarks) > 0 ? Number(r.maxMarks) : 0),
    0
  );

  const applyPreset = (preset: LiveProofPreset) => {
    setDemoUrl(preset.demoUrl ?? "");
    setGithubUrl(preset.githubUrl ?? "");
    setProjectDescription(preset.projectDescription);
    setRequirements(
      preset.requirements.map((r, i) => ({
        ...r,
        id: `preset-${preset.id}-${i + 1}`,
      }))
    );
    setValidationError(null);
    setStagedConfig(null);
  };

  const handleAddRequirement = () => {
    setRequirements((prev) => [
      ...prev,
      {
        id: generateRequirementId(),
        requirement: "",
        maxMarks: 10,
      },
    ]);
  };

  const handleUpdateRequirement = (
    id: string,
    field: "requirement" | "maxMarks",
    value: string | number
  ) => {
    setRequirements((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
    if (validationError) setValidationError(null);
  };

  const handleRemoveRequirement = (id: string) => {
    if (requirements.length <= 1) {
      setValidationError("At least one evaluation requirement is required.");
      return;
    }
    setRequirements((prev) => prev.filter((r) => r.id !== id));
  };

  const handleStageInspection = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const demoCheck = validateUrl(demoUrl, "Live Demo URL");
    if (!demoCheck.isValid) {
      setValidationError(demoCheck.error ?? "Invalid Live Demo URL.");
      return;
    }

    const githubCheck = validateUrl(githubUrl, "GitHub Repository URL");
    if (!githubCheck.isValid) {
      setValidationError(githubCheck.error ?? "Invalid GitHub Repository URL.");
      return;
    }

    const hasDemo = !demoCheck.isEmpty && demoUrl.trim().length > 0;
    const hasGithub = !githubCheck.isEmpty && githubUrl.trim().length > 0;

    // Both URLs are optional independently, but at least one must be provided for live evaluation
    if (!hasDemo && !hasGithub) {
      setValidationError(
        "Neither Live Demo URL nor GitHub Repository URL was provided. Please enter at least one target URL, or switch to Evidence Upload to evaluate manual files."
      );
      return;
    }

    if (!projectDescription.trim()) {
      setValidationError("Project Description is required. Please explain what this project is supposed to do.");
      return;
    }

    if (requirements.length === 0) {
      setValidationError("Please add at least one judge-defined evaluation requirement.");
      return;
    }

    for (let i = 0; i < requirements.length; i++) {
      const req = requirements[i];
      if (!req.requirement.trim()) {
        setValidationError(`Requirement #${i + 1} has an empty description.`);
        return;
      }
      if (req.maxMarks <= 0 || isNaN(req.maxMarks)) {
        setValidationError(`Requirement #${i + 1} ("${req.requirement.slice(0, 30)}...") must have a positive maximum mark.`);
        return;
      }
    }

    let evaluationScope: "DUAL" | "WEBSITE_ONLY" | "GITHUB_ONLY" = "DUAL";
    if (hasDemo && !hasGithub) evaluationScope = "WEBSITE_ONLY";
    if (!hasDemo && hasGithub) evaluationScope = "GITHUB_ONLY";

    // Stage configuration without claiming inspection has occurred
    setStagedConfig({
      demoUrl: demoUrl.trim(),
      githubUrl: githubUrl.trim(),
      projectDescription: projectDescription.trim(),
      requirements: requirements.map((r) => ({
        ...r,
        requirement: r.requirement.trim(),
        maxMarks: Number(r.maxMarks),
      })),
      totalMarks,
      evaluationScope,
    });
  };

  const handleEditConfiguration = () => {
    // Return to form with all entered values intact
    setStagedConfig(null);
  };

  const hasDemo = demoUrl.trim().length > 0;
  const hasGithub = githubUrl.trim().length > 0;

  return (
    <div
      id="panel-live-proof"
      role="tabpanel"
      aria-labelledby="tab-live-proof"
      className="flex flex-col gap-5"
    >
      {/* ── Preset selector ────────────────────────────────────────── */}
      <div className="bg-[#10131a] border border-zinc-800/80 rounded-xl p-4 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
            Quick Presets (Select to populate form)
          </span>
          <span className="text-[10px] font-mono text-zinc-500">
            Populates inputs without triggering inspection
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p)}
              className="flex flex-col items-start text-left p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 transition-colors group"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-semibold text-zinc-200 group-hover:text-cyan-400 transition-colors">
                  {p.name}
                </span>
                <span className="text-[10px] font-mono text-zinc-500">
                  {p.requirements.reduce((s, r) => s + r.maxMarks, 0)} pts
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                {p.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Staged Preview State ───────────────────────────────────── */}
      {stagedConfig ? (
        <div className="bg-[#10131a] border border-cyan-500/40 rounded-xl p-6 flex flex-col gap-5 shadow-[0_0_24px_rgba(6,182,212,0.06)]">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-100 font-mono">
                    Evaluation Configuration Staged
                  </h3>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-cyan-800 bg-cyan-950/60 text-cyan-300">
                    {stagedConfig.evaluationScope === "DUAL" && "Dual Source (Website + GitHub)"}
                    {stagedConfig.evaluationScope === "WEBSITE_ONLY" && "Website Runtime Only"}
                    {stagedConfig.evaluationScope === "GITHUB_ONLY" && "GitHub Codebase Only"}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Inputs validated. Parameters are ready for server-side evaluation execution.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleEditConfiguration}
              className="text-xs font-mono text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-md transition-colors shadow-sm"
            >
              Edit Configuration
            </button>
          </div>

          {/* Staged Parameters Summary */}
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-lg p-4 font-mono text-xs flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-zinc-500 uppercase tracking-wider text-[10px] block mb-1">
                  Live Demo URL
                </span>
                {stagedConfig.demoUrl ? (
                  <span className="text-cyan-300 font-medium break-all">
                    {stagedConfig.demoUrl}
                  </span>
                ) : (
                  <span className="text-zinc-600 italic">None provided (source code only)</span>
                )}
              </div>
              <div>
                <span className="text-zinc-500 uppercase tracking-wider text-[10px] block mb-1">
                  GitHub Repository URL
                </span>
                {stagedConfig.githubUrl ? (
                  <span className="text-violet-300 font-medium break-all">
                    {stagedConfig.githubUrl}
                  </span>
                ) : (
                  <span className="text-zinc-600 italic">None provided (runtime UI only)</span>
                )}
              </div>
            </div>

            <div className="border-t border-zinc-800/60 pt-3">
              <span className="text-zinc-500 uppercase tracking-wider text-[10px] block mb-1">
                Project Description
              </span>
              <p className="text-zinc-200 font-sans text-xs leading-relaxed">
                {stagedConfig.projectDescription}
              </p>
            </div>

            <div className="border-t border-zinc-800/60 pt-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 uppercase tracking-wider text-[10px]">
                  Judge-Defined Requirements ({stagedConfig.requirements.length})
                </span>
                <span className="text-zinc-200 font-bold">
                  {stagedConfig.totalMarks} Total Marks
                </span>
              </div>
              <ul className="flex flex-col gap-2 mt-1">
                {stagedConfig.requirements.map((r, i) => (
                  <li
                    key={r.id}
                    className="flex items-start justify-between gap-3 bg-zinc-900/60 border border-zinc-800/80 rounded px-3 py-2"
                  >
                    <span className="text-zinc-300 font-sans text-xs flex-1">
                      <strong className="font-mono text-zinc-500 mr-2">#{i + 1}</strong>
                      {r.requirement}
                    </span>
                    <span className="text-zinc-400 font-mono text-xs whitespace-nowrap">
                      {r.maxMarks} pts
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Execution Strategy Clarification */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3.5 flex items-start gap-3">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="flex-shrink-0 mt-0.5 text-cyan-400"
              aria-hidden="true"
            >
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2" />
              <path d="M8 5v3.5M8 11v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <div className="text-[11px] text-zinc-400 font-mono leading-relaxed flex flex-col gap-1">
              <p>
                <strong className="text-zinc-300">Phase Status:</strong> Staged in client state. No automated inspection, web scraping, or GitHub API queries have been executed yet.
              </p>
              <p className="text-zinc-500">
                {stagedConfig.evaluationScope === "DUAL" &&
                  "In the execution phase, the backend will gather browser screenshots from the live deployment and source-tree files from GitHub, combining both into a unified Gemma 4 evidence evaluation."}
                {stagedConfig.evaluationScope === "WEBSITE_ONLY" &&
                  "In the execution phase, the backend will capture live browser observations and screenshots. No claims about source code will be made."}
                {stagedConfig.evaluationScope === "GITHUB_ONLY" &&
                  "In the execution phase, the backend will inspect repository files and documentation without claiming runtime UI behavior has been verified."}
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* ── Main Evaluation Form ──────────────────────────────────── */
        <form
          onSubmit={handleStageInspection}
          className="bg-[#10131a] border border-zinc-800/80 rounded-xl p-6 flex flex-col gap-6"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-400 bg-cyan-950/60 border border-cyan-800/50 rounded px-1.5 py-0.5 mt-0.5 flex-shrink-0">
                SETUP
              </span>
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">
                  ProofStack Live Evaluation Setup
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Supply a live demo URL, GitHub repository URL, or both. Define what this project is supposed to prove.
                </p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-2xl font-bold font-mono text-zinc-100 leading-none">
                {totalMarks}
              </div>
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mt-0.5">
                Total Marks
              </div>
            </div>
          </div>

          {/* Validation Error Banner */}
          {validationError && (
            <div
              role="alert"
              className="flex items-start justify-between gap-3 bg-red-950/40 border border-red-800/60 rounded-lg p-4"
            >
              <div className="flex items-start gap-3">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="flex-shrink-0 mt-0.5 text-red-400"
                  aria-hidden="true"
                >
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                <div className="text-xs text-red-300 font-mono leading-relaxed">
                  <p>{validationError}</p>
                  {!hasDemo && !hasGithub && onSwitchToUpload && (
                    <p className="mt-1 text-zinc-400">
                      Have offline files instead? You can switch to manual file review.
                    </p>
                  )}
                </div>
              </div>
              {!hasDemo && !hasGithub && onSwitchToUpload && (
                <button
                  type="button"
                  onClick={onSwitchToUpload}
                  className="text-xs font-mono text-cyan-300 hover:text-cyan-200 border border-cyan-800/80 bg-cyan-950/40 px-3 py-1.5 rounded transition-colors whitespace-nowrap"
                >
                  Switch to Evidence Upload →
                </button>
              )}
            </div>
          )}

          {/* ── BOTH URL FIELDS (SIMULTANEOUS 2-COLUMN LAYOUT) ──────── */}
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Field 1: Live Demo URL */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="live-demo-url"
                  className="text-xs font-mono font-medium text-zinc-200 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span>Live Demo URL</span>
                  </span>
                  <span className="text-[10px] text-zinc-500 font-normal">Optional</span>
                </label>
                <input
                  id="live-demo-url"
                  type="text"
                  value={demoUrl}
                  onChange={(e) => {
                    setDemoUrl(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="https://your-project.vercel.app"
                  className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 font-mono focus:outline-none focus:border-cyan-500/70 focus:ring-1 focus:ring-cyan-500/40 transition-colors"
                />
                <span className="text-[10px] text-zinc-500 font-mono">
                  Runtime evidence: evaluated via browser screenshots & DOM observations.
                </span>
              </div>

              {/* Field 2: GitHub Repository URL */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="github-repo-url"
                  className="text-xs font-mono font-medium text-zinc-200 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                    <span>GitHub Repository URL</span>
                  </span>
                  <span className="text-[10px] text-zinc-500 font-normal">Optional</span>
                </label>
                <input
                  id="github-repo-url"
                  type="text"
                  value={githubUrl}
                  onChange={(e) => {
                    setGithubUrl(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="https://github.com/owner/repository"
                  className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 font-mono focus:outline-none focus:border-violet-500/70 focus:ring-1 focus:ring-violet-500/40 transition-colors"
                />
                <span className="text-[10px] text-zinc-500 font-mono">
                  Codebase evidence: evaluated via source files, architecture, and docs.
                </span>
              </div>
            </div>

            {/* Reactive Mode/Scope Indicator */}
            <div className="bg-zinc-950/50 border border-zinc-800/60 rounded-md px-3 py-2 flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span className="text-zinc-500">Evaluation Scope:</span>
              <span>
                {hasDemo && hasGithub && (
                  <span className="text-cyan-300">
                    ⚡ Combined: Live Website + GitHub Codebase
                  </span>
                )}
                {hasDemo && !hasGithub && (
                  <span className="text-cyan-400">
                    🌐 Website Only: Browser screenshots & runtime observations
                  </span>
                )}
                {!hasDemo && hasGithub && (
                  <span className="text-violet-300">
                    📦 Repository Only: Source files & documentation review
                  </span>
                )}
                {!hasDemo && !hasGithub && (
                  <span className="text-zinc-500">
                    Enter at least one URL above to configure live evaluation
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* ── FIELD 3: PROJECT DESCRIPTION (REQUIRED) ───────────────── */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="project-description"
              className="text-xs font-mono font-medium text-zinc-200 flex items-center justify-between"
            >
              <span>Project Description</span>
              <span className="text-[10px] text-cyan-400 font-semibold uppercase">
                Required
              </span>
            </label>
            <textarea
              id="project-description"
              rows={3}
              value={projectDescription}
              onChange={(e) => {
                setProjectDescription(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="Describe what this project is supposed to do, its intended user journeys, and core problem it solves..."
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 font-sans focus:outline-none focus:border-cyan-500/70 focus:ring-1 focus:ring-cyan-500/40 transition-colors resize-none leading-relaxed"
            />
            <span className="text-[10px] text-zinc-500 font-mono">
              Gemma 4 uses this description as context when evaluating evidence against requirements.
            </span>
          </div>

          {/* ── FIELD 4: JUDGE-DEFINED EVALUATION REQUIREMENTS ────────── */}
          <div className="flex flex-col gap-3 border-t border-zinc-800/80 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-mono font-medium text-zinc-200 block">
                  Judge-Defined Evaluation Requirements
                </label>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Define custom testable requirements and assign max marks per criterion.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddRequirement}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium bg-zinc-900 border border-zinc-700 text-zinc-200 hover:text-white hover:border-zinc-500 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span>Add Requirement</span>
              </button>
            </div>

            {/* List of requirements */}
            <div className="flex flex-col gap-2.5">
              {requirements.map((req, index) => (
                <div
                  key={req.id}
                  className="flex items-start gap-2.5 bg-zinc-950/80 border border-zinc-800/80 rounded-lg p-3 group focus-within:border-zinc-700 transition-colors"
                >
                  <span className="text-[10px] font-mono font-bold text-zinc-500 mt-2.5 w-6 text-center">
                    #{index + 1}
                  </span>

                  <div className="flex-1">
                    <input
                      type="text"
                      value={req.requirement}
                      onChange={(e) =>
                        handleUpdateRequirement(req.id, "requirement", e.target.value)
                      }
                      placeholder={`Requirement #${index + 1}: e.g. User can filter items and inspect updated counter`}
                      className="w-full bg-transparent border-0 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-0 leading-relaxed font-sans"
                    />
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={req.maxMarks}
                        onChange={(e) =>
                          handleUpdateRequirement(
                            req.id,
                            "maxMarks",
                            parseInt(e.target.value, 10) || 0
                          )
                        }
                        className="w-12 bg-transparent border-0 text-xs font-mono text-zinc-200 text-right focus:outline-none p-0"
                      />
                      <span className="text-[10px] font-mono text-zinc-500">pts</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveRequirement(req.id)}
                      disabled={requirements.length <= 1}
                      title="Remove requirement"
                      className={`p-1.5 rounded transition-colors ${
                        requirements.length <= 1
                          ? "text-zinc-700 cursor-not-allowed"
                          : "text-zinc-500 hover:text-red-400 hover:bg-red-950/30"
                      }`}
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-between gap-4 border-t border-zinc-800/80 pt-4 flex-wrap">
            <button
              id="start-live-inspection-button"
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-mono font-semibold bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25 hover:border-cyan-400 transition-all shadow-[0_0_12px_rgba(6,182,212,0.15)] active:translate-y-px"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
                <path d="M6.5 5.5l4 2.5-4 2.5v-5z" fill="currentColor" />
              </svg>
              <span>Stage Live Inspection</span>
            </button>

            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-zinc-400">
                {requirements.length} criterion{requirements.length !== 1 ? "s" : ""} · {totalMarks} pts total
              </span>
              {onSwitchToUpload && (
                <button
                  type="button"
                  onClick={onSwitchToUpload}
                  className="text-[11px] font-mono text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors"
                >
                  or use Evidence Upload
                </button>
              )}
            </div>
          </div>

          {/* Safety & SSRF Notes */}
          <div className="bg-zinc-950/50 border border-zinc-800/60 rounded-lg p-3 text-[10px] text-zinc-500 font-mono flex flex-col gap-1">
            <p>
              <strong className="text-zinc-400">Safety & Sandboxing:</strong> Public, authorized targets only. No authentication bypass or restricted system manipulation.
            </p>
            <p>
              <strong className="text-zinc-400">SSRF Guard Notice:</strong> Client-side validation is an initial UX guard. Strict server-side IP resolution and DNS allowlisting are enforced before browser automation runs.
            </p>
          </div>
        </form>
      )}
    </div>
  );
}
