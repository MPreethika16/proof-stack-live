"use client";

import { useState } from "react";
import type {
  EvaluationResult,
  CriterionOverride,
  EvaluationStatus,
} from "@/types/evaluation";
import CriterionResult from "./CriterionResult";

const STATUS_COUNTS = (
  statuses: EvaluationStatus[]
): Record<EvaluationStatus, number> => ({
  PASS: statuses.filter((s) => s === "PASS").length,
  PARTIAL: statuses.filter((s) => s === "PARTIAL").length,
  FAIL: statuses.filter((s) => s === "FAIL").length,
  UNCERTAIN: statuses.filter((s) => s === "UNCERTAIN").length,
  NOT_DEMONSTRATED: statuses.filter((s) => s === "NOT_DEMONSTRATED").length,
});

interface EvaluationResultsProps {
  result: EvaluationResult;
  onReset: () => void;
}

export default function EvaluationResults({
  result,
  onReset,
}: EvaluationResultsProps) {
  const [overrides, setOverrides] = useState<Record<string, CriterionOverride>>({});
  const [copiedAudit, setCopiedAudit] = useState(false);

  const handleOverride = (criterionId: string, override: CriterionOverride) => {
    setOverrides((prev) => ({ ...prev, [criterionId]: override }));
  };

  // Compute authoritative judge final score dynamically
  const reviewerScore = result.criteria.reduce((sum, c) => {
    const ov = overrides[c.criterionId];
    if (ov?.decision === "OVERRIDE" && ov.marks !== undefined) {
      return sum + ov.marks;
    }
    return sum + (c.suggestedMarks ?? 0);
  }, 0);

  const aiScore = result.summary.suggestedScore;
  const maxScore = result.summary.maxScore;

  const effectiveStatuses = result.criteria.map((c) => {
    const ov = overrides[c.criterionId];
    return ov?.decision === "OVERRIDE" && ov.status ? ov.status : c.status;
  });

  const counts = STATUS_COUNTS(effectiveStatuses as EvaluationStatus[]);

  const STAT_CHIPS: Array<{
    label: string;
    key: EvaluationStatus;
    color: string;
    description: string;
  }> = [
    {
      label: "PASS",
      key: "PASS",
      color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
      description: "Verified by evidence",
    },
    {
      label: "PARTIAL",
      key: "PARTIAL",
      color: "text-amber-400 border-amber-500/30 bg-amber-500/10",
      description: "Incomplete proof",
    },
    {
      label: "NOT DEMONSTRATED",
      key: "NOT_DEMONSTRATED",
      color: "text-zinc-400 border-zinc-600/30 bg-zinc-800/40",
      description: "Not shown (not failure)",
    },
    {
      label: "UNCERTAIN",
      key: "UNCERTAIN",
      color: "text-purple-400 border-purple-500/30 bg-purple-500/10",
      description: "Ambiguous / discrepancy",
    },
    {
      label: "FAIL",
      key: "FAIL",
      color: "text-red-400 border-red-500/30 bg-red-500/10",
      description: "Contradicted by proof",
    },
  ];

  const handleExportReport = () => {
    const lines = [
      `# ProofStack Live — Verified Evaluation Audit Report`,
      `> "Don't trust the claim. Inspect the proof."`,
      ``,
      `## Final Summary`,
      `- **Judge-Approved Final Score**: ${reviewerScore} / ${maxScore} pts`,
      `- **AI Suggested Score**: ${aiScore} / ${maxScore} pts`,
      `- **Evidence Coverage**: ${result.summary.evidenceCoverage}%`,
      `- **Status Distribution**: ${counts.PASS} PASS, ${counts.PARTIAL} PARTIAL, ${counts.NOT_DEMONSTRATED} NOT DEMONSTRATED, ${counts.UNCERTAIN} UNCERTAIN, ${counts.FAIL} FAIL`,
      ``,
      `## Detailed Criteria Findings`,
      ...result.criteria.map((c, i) => {
        const ov = overrides[c.criterionId];
        const status = ov?.decision === "OVERRIDE" && ov.status ? ov.status : c.status;
        const marks = ov?.decision === "OVERRIDE" && ov.marks !== undefined ? ov.marks : c.suggestedMarks;
        return [
          `### ${i + 1}. ${c.criterion}`,
          `- **Verdict**: ${status} (${marks ?? 0} / ${c.maxMarks} marks)`,
          `- **Decision**: ${ov?.decision ?? "ACCEPT"}`,
          `- **Reasoning**: ${c.reasoning}`,
          c.missingEvidence ? `- **Missing Proof**: ${c.missingEvidence}` : null,
          `- **Evidence Citations**:`,
          ...c.evidence.map((ev) => `  - [${ev.source}] "${ev.observation}"`),
          ``,
        ].filter(Boolean).join("\n");
      }),
      `---`,
      `*Evaluation model: Google Gemma 4 (gemma-4-26b-a4b-it) via @google/genai. AI recommends. The human judge decides.*`,
    ];

    const markdown = lines.join("\n");
    navigator.clipboard.writeText(markdown);
    setCopiedAudit(true);
    setTimeout(() => setCopiedAudit(false), 3000);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Console Header ────────────────────────────────────────── */}
      <div className="flex items-start sm:items-center justify-between gap-4 flex-wrap bg-[#10131a] border border-zinc-800/80 rounded-xl p-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 border border-cyan-800 bg-cyan-950/60 rounded px-1.5 py-0.5">
              Evidence Audit
            </span>
            <span className="text-xs font-mono text-zinc-400">
              Gemma 4 Verification Review
            </span>
          </div>
          <h2 className="text-sm font-semibold text-zinc-100">
            AI recommends. The human judge decides.
          </h2>
          <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
            Inspect supporting evidence, confirm or override suggested marks, and finalize the authoritative score.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportReport}
            className="text-xs font-mono text-zinc-200 hover:text-white bg-zinc-900 border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-md transition-colors shadow-sm"
          >
            {copiedAudit ? "✓ Audit Copied!" : "Copy Markdown Audit"}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-mono text-cyan-300 hover:text-cyan-200 border border-cyan-800/80 bg-cyan-950/40 px-3 py-1.5 rounded-md transition-colors"
          >
            ← Edit Inputs
          </button>
        </div>
      </div>

      {/* ── Score Cards (AI Suggested vs Judge-Approved Final) ────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Judge-Approved Final Score (Authoritative) */}
        <div className="bg-[#10131a] border border-cyan-500/40 rounded-xl p-5 relative overflow-hidden shadow-[0_0_24px_rgba(6,182,212,0.08)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-300 uppercase">
              Judge-Approved Final
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-400">
              Authoritative
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-bold font-mono text-white tracking-tight">
              {reviewerScore}
            </span>
            <span className="text-sm font-mono text-zinc-400">/ {maxScore} pts</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-2 font-mono">
            {Object.keys(overrides).length > 0
              ? `Includes ${Object.keys(overrides).length} judge modification${Object.keys(overrides).length > 1 ? "s" : ""}.`
              : "Reviewer confirmed recommendation."}
          </p>
        </div>

        {/* AI Suggested Score (Advisory) */}
        <div className="bg-[#10131a] border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase">
              AI Suggested Score
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
              Gemma 4 Advisory
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-bold font-mono text-zinc-200 tracking-tight">
              {aiScore}
            </span>
            <span className="text-sm font-mono text-zinc-500">/ {maxScore} pts</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-2 font-mono">
            Generated strictly from collected evidence parts.
          </p>
        </div>

        {/* Evidence Grounding Coverage */}
        <div className="bg-[#10131a] border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase">
              Evidence Coverage
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
              Metric
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-bold font-mono text-zinc-200 tracking-tight">
              {result.summary.evidenceCoverage}
            </span>
            <span className="text-sm font-mono text-zinc-500">% substantiated</span>
          </div>
          <div className="mt-3 h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
            <div
              className="h-full bg-cyan-400 rounded-full transition-all duration-500"
              style={{ width: `${result.summary.evidenceCoverage}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Status Distribution Chips ──────────────────────────────── */}
      <div className="bg-[#10131a] border border-zinc-800/80 rounded-xl p-4 flex flex-col gap-2.5">
        <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
          Findings Distribution
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {STAT_CHIPS.map(({ label, key, color, description }) => (
            <div
              key={key}
              className={`flex flex-col p-2.5 rounded-lg border font-mono ${color}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold leading-none">{counts[key]}</span>
                <span className="text-[10px] uppercase font-bold tracking-wider">{label}</span>
              </div>
              <span className="text-[10px] text-zinc-400 mt-1 line-clamp-1">
                {description}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Criteria Cards with Evidence Citations ────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
            Detailed Findings & Evidence Citations ({result.criteria.length})
          </span>
          <span className="text-[11px] font-mono text-zinc-500">
            Click card to toggle details · Select action to adjust score
          </span>
        </div>

        {result.criteria.map((c, i) => (
          <CriterionResult
            key={c.criterionId}
            result={c}
            index={i + 1}
            override={overrides[c.criterionId]}
            onOverrideChange={(ov) => handleOverride(c.criterionId, ov)}
          />
        ))}
      </div>
    </div>
  );
}
