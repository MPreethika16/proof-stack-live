"use client";

import { useState } from "react";
import type {
  CriterionEvaluation,
  EvaluationStatus,
  ReviewerDecision,
  CriterionOverride,
  EvidenceReference,
} from "@/types/evaluation";

const STATUS_META: Record<
  EvaluationStatus,
  { label: string; color: string; bg: string; border: string; desc: string }
> = {
  PASS: {
    label: "PASS",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/40",
    desc: "Verified by concrete evidence",
  },
  PARTIAL: {
    label: "PARTIAL",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/40",
    desc: "Partially demonstrated in evidence",
  },
  FAIL: {
    label: "FAIL",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/40",
    desc: "Contradicted by collected evidence",
  },
  UNCERTAIN: {
    label: "UNCERTAIN",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/40",
    desc: "Ambiguous or conflicting evidence",
  },
  NOT_DEMONSTRATED: {
    label: "NOT DEMONSTRATED",
    color: "text-zinc-400",
    bg: "bg-zinc-800/40",
    border: "border-zinc-700/60",
    desc: "Not shown (absence is not failure)",
  },
};

const ALL_STATUSES: EvaluationStatus[] = [
  "PASS",
  "PARTIAL",
  "NOT_DEMONSTRATED",
  "UNCERTAIN",
  "FAIL",
];

interface CriterionResultProps {
  result: CriterionEvaluation;
  index: number;
  override: CriterionOverride | undefined;
  onOverrideChange: (override: CriterionOverride) => void;
}

function getEvidenceBadge(source: string) {
  if (source.startsWith("screenshot-") || source.includes("viewport") || source.endsWith(".png") || source.endsWith(".jpg")) {
    return {
      label: "Live Screenshot",
      color: "text-cyan-400 border-cyan-800/60 bg-cyan-950/40",
      icon: "🌐",
    };
  }
  if (source.endsWith(".md") || source.endsWith(".json") || source.endsWith(".ts") || source.endsWith(".tsx") || source.endsWith(".js") || source.includes("/")) {
    return {
      label: "Repository Code",
      color: "text-violet-300 border-violet-800/60 bg-violet-950/40",
      icon: "📦",
    };
  }
  return {
    label: "Uploaded Proof",
    color: "text-zinc-300 border-zinc-700 bg-zinc-900/60",
    icon: "📁",
  };
}

export default function CriterionResult({
  result,
  index,
  override,
  onOverrideChange,
}: CriterionResultProps) {
  const [expanded, setExpanded] = useState(true);
  const decision = override?.decision ?? "ACCEPT";

  const displayStatus =
    decision === "OVERRIDE" && override?.status
      ? override.status
      : result.status;

  const displayMarks =
    decision === "OVERRIDE" && override?.marks !== undefined
      ? override.marks
      : result.suggestedMarks;

  const meta = STATUS_META[displayStatus];

  const handleDecision = (d: ReviewerDecision) => {
    if (d === "ACCEPT") {
      onOverrideChange({ decision: "ACCEPT" });
    } else if (d === "OVERRIDE") {
      onOverrideChange({
        decision: "OVERRIDE",
        status: result.status,
        marks: result.suggestedMarks ?? 0,
      });
    } else {
      onOverrideChange({ decision: "REQUEST_EVIDENCE" });
    }
  };

  return (
    <div
      className={`rounded-xl border ${meta.border} bg-[#10131a] overflow-hidden transition-all`}
    >
      {/* ── Card Header ─────────────────────────────────────────── */}
      <div className="flex items-start gap-4 p-5">
        <span className="font-mono text-xs text-zinc-500 pt-0.5 w-6 flex-shrink-0">
          {String(index).padStart(2, "0")}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5 mb-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold tracking-wider font-mono ${meta.color} ${meta.bg} border ${meta.border}`}
            >
              {meta.label}
            </span>

            <span className="text-xs font-mono text-zinc-300 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
              {displayMarks !== null && displayMarks !== undefined
                ? `${displayMarks} / ${result.maxMarks} pts`
                : `— / ${result.maxMarks} pts`}
              {decision === "OVERRIDE" && (
                <span className="ml-1.5 text-cyan-400 text-[10px] font-bold">★ Judge Override</span>
              )}
            </span>

            <span className="text-[11px] text-zinc-500 font-mono ml-auto">
              Confidence {result.confidence}%
            </span>
          </div>

          <p className="text-sm text-zinc-100 font-medium leading-relaxed font-sans">
            {result.criterion}
          </p>
          <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
            {meta.desc}
          </p>
        </div>

        {/* Toggle */}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-zinc-500 hover:text-zinc-200 transition-colors flex-shrink-0 mt-0.5 p-1 rounded"
          aria-label={expanded ? "Collapse details" : "Expand details"}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          >
            <path
              d="M3 6l5 5 5-5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* ── Expanded Findings Body ───────────────────────────────── */}
      {expanded && (
        <div className="border-t border-zinc-800/80 divide-y divide-zinc-800/60">
          {/* Evidence Citations */}
          {result.evidence && result.evidence.length > 0 ? (
            <div className="px-5 py-4 flex flex-col gap-2.5">
              <span className="text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase">
                Supporting Evidence Citations ({result.evidence.length})
              </span>
              <div className="flex flex-col gap-2">
                {result.evidence.map((ev: EvidenceReference, i: number) => {
                  const badge = getEvidenceBadge(ev.source);
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-3 bg-zinc-950/70 rounded-lg p-3 border border-zinc-800/80"
                    >
                      <span className="text-sm mt-0.5">{badge.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span
                            className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded border ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                          <span className="text-xs font-mono text-zinc-200 font-semibold break-all">
                            {ev.source}
                          </span>
                          {ev.step && (
                            <span className="text-[10px] font-mono text-zinc-500">
                              step: {ev.step}
                            </span>
                          )}
                          {ev.timestamp && (
                            <span className="text-[10px] font-mono text-zinc-500">
                              @{ev.timestamp}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-300 leading-relaxed font-sans italic bg-zinc-900/40 p-2 rounded border border-zinc-800/40">
                          &ldquo;{ev.observation}&rdquo;
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="px-5 py-3 bg-zinc-950/40">
              <span className="text-[11px] font-mono text-zinc-500">
                No specific visual evidence was captured for this requirement (Absence of evidence is treated as NOT DEMONSTRATED).
              </span>
            </div>
          )}

          {/* Reasoning */}
          <div className="px-5 py-4">
            <span className="text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase block mb-1.5">
              Gemma 4 Analysis & Reasoning
            </span>
            <p className="text-xs text-zinc-300 leading-relaxed font-sans">
              {result.reasoning}
            </p>
          </div>

          {/* Missing Evidence / Ambiguity Alert */}
          {result.missingEvidence && (
            <div className="px-5 py-3.5 bg-amber-950/20 border-l-2 border-amber-500/60">
              <span className="text-[10px] font-mono font-bold tracking-widest text-amber-400 uppercase block mb-1">
                Missing Proof / Demonstration Gap
              </span>
              <p className="text-xs text-amber-200/80 leading-relaxed font-sans">
                {result.missingEvidence}
              </p>
            </div>
          )}

          {/* Human Review Authority Controls */}
          <div className="px-5 py-4 bg-zinc-950/60 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase">
                Human Judge Decision
              </span>
              <span className="text-[11px] font-mono text-zinc-500">
                Reviewer retains final authority
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleDecision("ACCEPT")}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-semibold tracking-wide border transition-all ${
                  decision === "ACCEPT"
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                ✓ Accept Recommendation ({result.suggestedMarks ?? 0} pts)
              </button>

              <button
                type="button"
                onClick={() => handleDecision("OVERRIDE")}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-semibold tracking-wide border transition-all ${
                  decision === "OVERRIDE"
                    ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-sm"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                ★ Override Verdict & Marks
              </button>

              <button
                type="button"
                onClick={() => handleDecision("REQUEST_EVIDENCE")}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-semibold tracking-wide border transition-all ${
                  decision === "REQUEST_EVIDENCE"
                    ? "bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                ? Request More Evidence
              </button>
            </div>

            {/* Override Controls Drawer */}
            {decision === "OVERRIDE" && (
              <div className="mt-2 p-3 rounded-lg bg-zinc-900/90 border border-cyan-500/30 flex flex-wrap gap-4 items-center">
                <div>
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                    Override Status
                  </label>
                  <select
                    value={override?.status ?? result.status}
                    onChange={(e) =>
                      onOverrideChange({
                        decision: "OVERRIDE",
                        status: e.target.value as EvaluationStatus,
                        marks: override?.marks ?? result.suggestedMarks ?? 0,
                      })
                    }
                    className="bg-zinc-950 border border-zinc-700 text-zinc-100 text-xs font-mono rounded px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
                  >
                    {ALL_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                    Override Marks (0 to {result.maxMarks})
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={result.maxMarks}
                    value={override?.marks ?? result.suggestedMarks ?? 0}
                    onChange={(e) =>
                      onOverrideChange({
                        decision: "OVERRIDE",
                        status: override?.status ?? result.status,
                        marks: Math.min(
                          result.maxMarks,
                          Math.max(0, parseInt(e.target.value, 10) || 0)
                        ),
                      })
                    }
                    className="w-20 bg-zinc-950 border border-zinc-700 text-zinc-100 text-xs font-mono rounded px-2.5 py-1.5 text-right focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <span className="text-[10px] font-mono text-cyan-400 mt-4">
                  Changes immediately update the Judge-Approved Final Score.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
