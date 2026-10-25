"use client";

import { useState, useCallback, useRef } from "react";
import Header from "@/components/proofstack/Header";
import LoadingAnalysis from "@/components/proofstack/LoadingAnalysis";
import EvaluationResults from "@/components/proofstack/EvaluationResults";
import type {
  Criterion,
  EvidenceFile,
  AppPhase,
  EvaluationResult,
  LiveProofPreset,
} from "@/types/evaluation";

const PRESETS: LiveProofPreset[] = [
  {
    id: "dual-commerce",
    name: "Commerce Store (Demo + GitHub)",
    demoUrl: "https://demo.vercel.store",
    githubUrl: "https://github.com/vercel/commerce",
    projectDescription:
      "An open-source headless e-commerce store with real-time product filtering, dynamic cart management, and server-side rendering.",
    claim: "Production demo with responsive navigation, product cards, and modular Next.js architecture.",
    requirements: [
      {
        id: "req-1",
        requirement:
          "Verify product catalog displays responsive grid with product cards and price tags.",
        maxMarks: 20,
        guidance: "Expect visible product cards with price badges and responsive layout.",
      },
      {
        id: "req-2",
        requirement:
          "Verify navigation provides category filters (e.g. Apparel, Accessories) and search capability.",
        maxMarks: 15,
        guidance: "Look for search input and category filter buttons.",
      },
      {
        id: "req-3",
        requirement:
          "Verify repository architecture implements Next.js App Router and modular TypeScript components.",
        maxMarks: 15,
        guidance: "Examine components and app router structure in repository source files.",
      },
      {
        id: "req-4",
        requirement:
          "Verify page layout maintains accessibility and graceful responsive styling across viewport scroll.",
        maxMarks: 10,
        guidance: "Check scroll state screenshot and header positioning.",
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
    claim: "Portal is live and accessible globally.",
    requirements: [
      {
        id: "req-1",
        requirement:
          "Verify main page displays 'Today's featured article' with readable typography and lead paragraph.",
        maxMarks: 20,
        guidance: "Check for prominent lead section header and readable body text.",
      },
      {
        id: "req-2",
        requirement:
          "Verify navigation sidebar contains accessible language selection and community links.",
        maxMarks: 20,
        guidance: "Look for navigation list items and sidebar structure.",
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
    claim: "Comprehensive test suite and clean TypeScript declarations.",
    requirements: [
      {
        id: "req-1",
        requirement:
          "Verify repository README specifies installation instructions, API examples, and ecosystem documentation.",
        maxMarks: 25,
        guidance: "Inspect README.md for quickstart guides and code examples.",
      },
      {
        id: "req-2",
        requirement:
          "Verify package manifest exports modern ESM/CJS build targets and TypeScript declarations.",
        maxMarks: 25,
        guidance: "Inspect package.json exports field and tsconfig setup.",
      },
    ],
    description: "Source-code only: Inspects repository files, documentation, and architecture.",
  },
];

const INITIAL_CRITERIA: Criterion[] = [
  {
    id: "req-1",
    requirement: "User authentication flow works and handles invalid credentials gracefully.",
    maxMarks: 20,
    guidance: "Look for input validation, error alerts, and successful sign-in state.",
  },
  {
    id: "req-2",
    requirement: "Core business logic completes end-to-end with visual feedback.",
    maxMarks: 30,
    guidance: "Check primary user flow progression and final confirmed state.",
  },
];

function generateId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// Client-side video frame sampling for Gemma 4 image input
async function extractVideoFrames(videoFile: File): Promise<File[]> {
  return new Promise((resolve) => {
    try {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      const objectUrl = URL.createObjectURL(videoFile);
      video.src = objectUrl;

      video.onloadedmetadata = async () => {
        const duration = video.duration || 1;
        const targetTimes = [
          Math.min(0.5, duration * 0.15),
          duration * 0.5,
          Math.max(duration * 0.85, duration - 0.5),
        ];
        const frames: File[] = [];

        for (let i = 0; i < targetTimes.length; i++) {
          const t = targetTimes[i];
          await new Promise<void>((res) => {
            video.currentTime = t;
            video.onseeked = () => {
              const canvas = document.createElement("canvas");
              canvas.width = Math.min(video.videoWidth || 1280, 1280);
              canvas.height = Math.min(video.videoHeight || 720, 720);
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => {
                  if (blob) {
                    const frameFile = new File(
                      [blob],
                      `video-sample-${i + 1}-${Math.round(t)}s.png`,
                      { type: "image/png" }
                    );
                    frames.push(frameFile);
                  }
                  res();
                }, "image/png");
              } else {
                res();
              }
            };
          });
        }
        URL.revokeObjectURL(objectUrl);
        resolve(frames);
      };

      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve([]);
      };
    } catch {
      resolve([]);
    }
  });
}

function validateUrl(
  input: string,
  field: "Live Demo URL" | "GitHub Repository URL"
): { isValid: boolean; error?: string } {
  const trimmed = input.trim();
  if (!trimmed) return { isValid: true };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      isValid: false,
      error: `Invalid ${field}: Please include a fully qualified URL starting with http:// or https://`,
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      isValid: false,
      error: `${field} uses unsupported protocol "${parsed.protocol}". Only "http:" and "https:" URLs are permitted.`,
    };
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.startsWith("127.")
  ) {
    return {
      isValid: false,
      error: `${field}: Localhost and loopback domains are strictly blocked. Public URLs only.`,
    };
  }

  if (
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host.startsWith("169.254.")
  ) {
    return {
      isValid: false,
      error: `${field}: Private and cloud-metadata IP addresses are blocked for safety.`,
    };
  }

  if (field === "GitHub Repository URL") {
    if (host !== "github.com" && !host.endsWith(".github.com")) {
      return {
        isValid: false,
        error: `GitHub Repository URL should point to a repository on github.com (e.g. https://github.com/owner/repository).`,
      };
    }
  }

  return { isValid: true };
}

export default function Home() {
  const [phase, setPhase] = useState<AppPhase>("setup");

  // Form State
  const [demoUrl, setDemoUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [claim, setClaim] = useState("");
  const [criteria, setCriteria] = useState<Criterion[]>(INITIAL_CRITERIA);
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [videoNotice, setVideoNotice] = useState<string | null>(null);
  const [demoNotice, setDemoNotice] = useState<string | null>(null);

  // Runtime State
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadDemo = () => {
    applyPreset(PRESETS[0]);
    setDemoNotice(
      "Demo loaded: 4 custom criteria (60 pts total), live website & GitHub repo configured. Click 'Run ProofStack Live Evaluation' to evaluate."
    );
    setTimeout(() => setDemoNotice(null), 10000);
  };

  // Auto-calculated total marks dynamically from custom rubric
  const totalMarks = criteria.reduce(
    (sum, c) => sum + (Number(c.maxMarks) > 0 ? Number(c.maxMarks) : 0),
    0
  );

  const hasDemo = demoUrl.trim().length > 0;
  const hasGithub = githubUrl.trim().length > 0;
  const hasFiles = files.length > 0;
  const hasEvidence = hasDemo || hasGithub || hasFiles;

  const applyPreset = (preset: LiveProofPreset) => {
    setDemoUrl(preset.demoUrl ?? "");
    setGithubUrl(preset.githubUrl ?? "");
    setProjectDescription(preset.projectDescription);
    setClaim(preset.claim ?? "");
    setCriteria(
      preset.requirements.map((r, i) => ({
        ...r,
        id: `preset-${preset.id}-${i + 1}`,
      }))
    );
    setError(null);
  };

  const handleAddCriterion = () => {
    setCriteria((prev) => [
      ...prev,
      {
        id: generateId(),
        requirement: "",
        maxMarks: 10,
        guidance: "",
      },
    ]);
  };

  const handleUpdateCriterion = (
    id: string,
    field: keyof Criterion,
    value: string | number
  ) => {
    setCriteria((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
    if (error) setError(null);
  };

  const handleRemoveCriterion = (id: string) => {
    if (criteria.length <= 1) {
      setError("Rubric must contain at least one evaluation criterion.");
      return;
    }
    setCriteria((prev) => prev.filter((c) => c.id !== id));
  };

  const handleAddFiles = useCallback(
    async (incoming: FileList | File[]) => {
      const arr = Array.from(incoming);
      const newEntries: EvidenceFile[] = [];

      for (const f of arr) {
        if (f.type.startsWith("video/")) {
          setVideoNotice("Extracting key visual frames from demo video for Gemma 4 analysis...");
          const extracted = await extractVideoFrames(f);
          for (const frame of extracted) {
            newEntries.push({
              id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              file: frame,
              type: "image",
            });
          }
          setVideoNotice(`Demo video loaded: ${extracted.length} visual frames sampled.`);
        } else {
          newEntries.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file: f,
            type: "image",
          });
        }
      }

      setFiles((prev) => [...prev, ...newEntries]);
      if (error) setError(null);
    },
    [error]
  );

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // 1. Evidence presence check
    if (!hasEvidence) {
      setError(
        "No usable evidence source was provided. Please supply a Live Demo URL, a GitHub Repository URL, or upload screenshot/video evidence."
      );
      return;
    }

    // 2. URL format validation
    const demoCheck = validateUrl(demoUrl, "Live Demo URL");
    if (!demoCheck.isValid) {
      setError(demoCheck.error ?? "Invalid Live Demo URL.");
      return;
    }

    const githubCheck = validateUrl(githubUrl, "GitHub Repository URL");
    if (!githubCheck.isValid) {
      setError(githubCheck.error ?? "Invalid GitHub Repository URL.");
      return;
    }

    // 3. Project description requirement
    if (!projectDescription.trim()) {
      setError("Project Description is required. Please explain what this project is supposed to do.");
      return;
    }

    // 4. Criteria validation
    if (criteria.length === 0) {
      setError("Please add at least one criterion to the rubric.");
      return;
    }

    for (let i = 0; i < criteria.length; i++) {
      const c = criteria[i];
      if (!c.requirement.trim()) {
        setError(`Criterion #${i + 1} has an empty requirement description.`);
        return;
      }
      if (c.maxMarks <= 0 || isNaN(c.maxMarks)) {
        setError(`Criterion #${i + 1} ("${c.requirement.slice(0, 30)}...") must have a positive maximum mark.`);
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);
    setPhase("loading");

    try {
      const formData = new FormData();
      formData.append(
        "criteria",
        JSON.stringify(
          criteria.map((c) => ({
            id: c.id,
            requirement: c.requirement.trim(),
            maxMarks: Number(c.maxMarks),
            guidance: c.guidance?.trim() || undefined,
          }))
        )
      );
      formData.append("projectDescription", projectDescription.trim());
      formData.append("claim", claim.trim());
      if (demoUrl.trim()) formData.append("liveDemoUrl", demoUrl.trim());
      if (githubUrl.trim()) formData.append("githubRepoUrl", githubUrl.trim());

      for (const ef of files) {
        formData.append("files", ef.file);
      }

      const res = await fetch("/api/evaluate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? `Evaluation error (${res.status})`);
      }

      setResult(data as EvaluationResult);
      setPhase("results");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected evaluation error occurred.";
      setError(message);
      setPhase("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetToWorkspace = () => {
    // Return to setup workspace with all entered inputs retained
    setPhase("setup");
    setResult(null);
    setError(null);
    setIsSubmitting(false);
  };

  return (
    <div
      className="min-h-screen bg-[#0c0e14] text-zinc-100"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
    >
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-8 pb-24">
        {/* ── Setup Phase (Unified Workspace) ───────────────────────── */}
        {(phase === "setup" || phase === "error") && (
          <form onSubmit={handleEvaluate} className="flex flex-col gap-6">
            {/* ── Try a Demo Evaluation Banner ───────────────────────── */}
            <div className="bg-gradient-to-r from-cyan-950/40 via-zinc-900 to-violet-950/40 border border-cyan-500/40 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap shadow-[0_0_24px_rgba(6,182,212,0.08)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-mono text-base flex-shrink-0">
                  ⚡
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-zinc-100 font-mono uppercase tracking-wide">
                      Instant Hackathon Showcase
                    </h3>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-1.5 py-0.2 rounded border border-cyan-800">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                    Pre-fill Vercel Commerce live demo + GitHub repo with 4 custom criteria (60 pts).
                  </p>
                </div>
              </div>

              <button
                id="try-demo-evaluation-button"
                type="button"
                onClick={handleLoadDemo}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-semibold bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/60 text-cyan-200 transition-all shadow-[0_0_12px_rgba(6,182,212,0.18)] active:translate-y-px"
              >
                <span>Try a Demo Evaluation →</span>
              </button>
            </div>

            {demoNotice && (
              <div
                role="status"
                className="bg-cyan-950/60 border border-cyan-700/80 rounded-lg px-4 py-3 text-xs font-mono text-cyan-200 flex items-center gap-2.5 shadow-sm"
              >
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span>{demoNotice}</span>
              </div>
            )}

            {/* Quick Presets Bar */}
            <div className="bg-[#10131a] border border-zinc-800/80 rounded-xl p-4 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  Quick Hackathon Presets (Click to Populate Workspace)
                </span>
                <span className="text-[10px] font-mono text-zinc-500">
                  Dual-Source · Demo Only · GitHub Only
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

            {/* Error Alert Banner */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 bg-red-950/40 border border-red-800/60 rounded-xl p-4"
              >
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
                <p className="text-xs text-red-300 font-mono leading-relaxed">{error}</p>
              </div>
            )}

            {/* ── Section 1: Target URLs (Dual Simultaneous Layout) ─── */}
            <section className="bg-[#10131a] border border-zinc-800/80 rounded-xl p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-400 bg-cyan-950/60 border border-cyan-800/50 rounded px-1.5 py-0.5 mt-0.5 flex-shrink-0">
                    01
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-100">
                      Target URLs (Simultaneous Evidence Inputs)
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Enter a deployed live website URL, a GitHub repository URL, or both. Both are independently optional.
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-mono text-zinc-500 uppercase px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900">
                  Unified Form
                </span>
              </div>

              {/* Responsive 2-Column URL Inputs */}
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
                      if (error) setError(null);
                    }}
                    placeholder="https://your-project.vercel.app"
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 font-mono focus:outline-none focus:border-cyan-500/70 focus:ring-1 focus:ring-cyan-500/40 transition-colors"
                  />
                  <span className="text-[10px] text-zinc-500 font-mono">
                    Runtime evidence: browser automation captures screenshots and live observations.
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
                      if (error) setError(null);
                    }}
                    placeholder="https://github.com/owner/repository"
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 font-mono focus:outline-none focus:border-violet-500/70 focus:ring-1 focus:ring-violet-500/40 transition-colors"
                  />
                  <span className="text-[10px] text-zinc-500 font-mono">
                    Codebase evidence: bounded inspection of source files, architecture, and docs.
                  </span>
                </div>
              </div>

              {/* Reactive Scope Status */}
              <div className="bg-zinc-950/60 border border-zinc-800 rounded-lg px-3.5 py-2 flex items-center justify-between text-[11px] font-mono text-zinc-400">
                <span className="text-zinc-500">Active Scope:</span>
                <span>
                  {hasDemo && hasGithub && (
                    <span className="text-cyan-300">
                      ⚡ Dual Source: Live Browser Capture + GitHub Source Analysis
                    </span>
                  )}
                  {hasDemo && !hasGithub && (
                    <span className="text-cyan-400">
                      🌐 Runtime: Live Browser Capture & Screenshots
                    </span>
                  )}
                  {!hasDemo && hasGithub && (
                    <span className="text-violet-300">
                      📦 Codebase: Repository Files & Documentation
                    </span>
                  )}
                  {!hasDemo && !hasGithub && (
                    <span className="text-zinc-500">
                      {hasFiles
                        ? "📁 Manual Evidence: Evaluating uploaded screenshots/video"
                        : "Enter a URL above or upload evidence files below"}
                    </span>
                  )}
                </span>
              </div>
            </section>

            {/* ── Section 2: Project Context & Description ──────────── */}
            <section className="bg-[#10131a] border border-zinc-800/80 rounded-xl p-6 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <span className="text-[10px] font-mono font-bold tracking-widest text-violet-400 bg-violet-950/60 border border-violet-800/50 rounded px-1.5 py-0.5 mt-0.5 flex-shrink-0">
                  02
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-100">
                    Project Context & Intent
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Define what the project is supposed to do so Gemma 4 can ground findings accurately.
                  </p>
                </div>
              </div>

              {/* Project Description (Required) */}
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
                    if (error) setError(null);
                  }}
                  placeholder="Describe what this project is supposed to do, intended user journeys, and key features..."
                  className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 font-sans focus:outline-none focus:border-cyan-500/70 focus:ring-1 focus:ring-cyan-500/40 transition-colors resize-none leading-relaxed"
                />
              </div>

              {/* Participant Claim / Notes (Optional) */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="participant-claim"
                  className="text-xs font-mono font-medium text-zinc-300 flex items-center justify-between"
                >
                  <span>Participant Claim / Reviewer Notes</span>
                  <span className="text-[10px] text-zinc-500 font-normal">Optional</span>
                </label>
                <textarea
                  id="participant-claim"
                  rows={2}
                  value={claim}
                  onChange={(e) => {
                    setClaim(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Optional participant explanation or notes for the judge..."
                  className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg px-3.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 font-sans focus:outline-none focus:border-zinc-700 transition-colors resize-none leading-relaxed"
                />
              </div>
            </section>

            {/* ── Section 3: Custom Evaluation Criteria & Rubric ────── */}
            <section className="bg-[#10131a] border border-zinc-800/80 rounded-xl p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-400 bg-cyan-950/60 border border-cyan-800/50 rounded px-1.5 py-0.5 mt-0.5 flex-shrink-0">
                    03
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-100">
                      Judge-Defined Evaluation Rubric
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Define custom criteria, scoring guidance, and maximum marks. Total score is dynamically calculated.
                    </p>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="text-2xl font-bold font-mono text-zinc-100 leading-none">
                    {totalMarks}
                  </div>
                  <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mt-0.5">
                    Dynamic Total Points
                  </div>
                </div>
              </div>

              {/* Criteria List */}
              <div className="flex flex-col gap-3">
                {criteria.map((c, index) => (
                  <div
                    key={c.id}
                    className="flex flex-col gap-2 bg-zinc-950/80 border border-zinc-800/80 rounded-lg p-3.5 focus-within:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-zinc-500 w-6 text-center">
                          #{index + 1}
                        </span>
                        <span className="text-xs font-mono font-semibold text-zinc-300">
                          Requirement
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1">
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={c.maxMarks}
                            onChange={(e) =>
                              handleUpdateCriterion(
                                c.id,
                                "maxMarks",
                                parseInt(e.target.value, 10) || 0
                              )
                            }
                            className="w-12 bg-transparent border-0 text-xs font-mono text-zinc-100 text-right focus:outline-none p-0"
                          />
                          <span className="text-[10px] font-mono text-zinc-500">max pts</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveCriterion(c.id)}
                          disabled={criteria.length <= 1}
                          title="Remove criterion"
                          className={`p-1.5 rounded transition-colors ${
                            criteria.length <= 1
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

                    <input
                      type="text"
                      value={c.requirement}
                      onChange={(e) =>
                        handleUpdateCriterion(c.id, "requirement", e.target.value)
                      }
                      placeholder={`Criterion #${index + 1}: e.g. User authentication flow works and handles invalid credentials`}
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/60 font-sans"
                    />

                    <input
                      type="text"
                      value={c.guidance ?? ""}
                      onChange={(e) =>
                        handleUpdateCriterion(c.id, "guidance", e.target.value)
                      }
                      placeholder="Optional scoring guidance (e.g. Expect visible error alert and successful redirect)"
                      className="w-full bg-transparent border-0 text-[11px] text-zinc-400 placeholder:text-zinc-700 focus:outline-none px-1 font-sans"
                    />
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddCriterion}
                  className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span>Add Criterion</span>
                </button>
              </div>
            </section>

            {/* ── Section 4: Supplementary Evidence (Screenshots / Video) ── */}
            <section className="bg-[#10131a] border border-zinc-800/80 rounded-xl p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-violet-400 bg-violet-950/60 border border-violet-800/50 rounded px-1.5 py-0.5 mt-0.5 flex-shrink-0">
                    04
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-100">
                      Supplementary Evidence (Screenshots & Demo Video)
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Upload screenshots or a demo video. Videos are sampled into key visual frames for Gemma 4 evaluation.
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-mono text-zinc-500">
                  {files.length} attached
                </span>
              </div>

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files) handleAddFiles(e.dataTransfer.files);
                }}
                className="border border-dashed border-zinc-800 hover:border-zinc-600 rounded-xl p-6 text-center cursor-pointer transition-colors bg-zinc-950/40 hover:bg-zinc-950/70"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
                  onChange={(e) => {
                    if (e.target.files) handleAddFiles(e.target.files);
                  }}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-xs text-zinc-300 font-mono">
                    Click to browse or drop screenshots (PNG, JPG, WebP) or demo video (MP4, WebM)
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    Video files are automatically converted to visual frame samples for Gemma 4.
                  </p>
                </div>
              </div>

              {videoNotice && (
                <div className="bg-cyan-950/40 border border-cyan-800/60 rounded-lg px-3.5 py-2 text-xs font-mono text-cyan-300 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span>{videoNotice}</span>
                </div>
              )}

              {/* Uploaded File Chips */}
              {files.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  {files.map((ef) => (
                    <div
                      key={ef.id}
                      className="flex items-center justify-between gap-2 bg-zinc-950/80 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono"
                    >
                      <span className="text-zinc-300 truncate" title={ef.file.name}>
                        {ef.file.name}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-zinc-500">
                          {(ef.file.size / 1024).toFixed(0)} KB
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(ef.id)}
                          className="text-zinc-500 hover:text-red-400 p-0.5"
                          title="Remove file"
                        >
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Action Section: Run Evaluation ─────────────────────── */}
            <section className="bg-[#10131a] border border-zinc-800/80 rounded-xl p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">
                    Ready to Evaluate with Gemma 4?
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                    {hasEvidence
                      ? "Evidence sources configured. Final judgment remains with human reviewer."
                      : "↑ Provide at least one URL or upload evidence files above."}
                  </p>
                </div>

                <button
                  id="run-proofstack-evaluation-button"
                  type="submit"
                  disabled={!hasEvidence || isSubmitting}
                  className={`inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-xs font-mono font-semibold transition-all ${
                    hasEvidence && !isSubmitting
                      ? "bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/60 text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.2)] active:translate-y-px"
                      : "bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                      <span>Evaluating Evidence...</span>
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
                        <path d="M6.5 5.5l4 2.5-4 2.5v-5z" fill="currentColor" />
                      </svg>
                      <span>Run ProofStack Live Evaluation</span>
                    </>
                  )}
                </button>
              </div>

              <div className="border-t border-zinc-800/60 pt-3 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span>Model: gemma-4-26b-a4b-it (Google Gen AI SDK)</span>
                <span>{criteria.length} custom criteria · {totalMarks} pts maximum</span>
              </div>
            </section>
          </form>
        )}

        {/* ── Loading Phase ─────────────────────────────────────────── */}
        {phase === "loading" && (
          <div className="bg-[#10131a] border border-zinc-800/80 rounded-xl p-8">
            <LoadingAnalysis />
          </div>
        )}

        {/* ── Results Phase ─────────────────────────────────────────── */}
        {phase === "results" && result && (
          <EvaluationResults result={result} onReset={handleResetToWorkspace} />
        )}
      </main>
    </div>
  );
}
