import { z } from "zod";
import type { Criterion, EvaluationResult } from "@/types/evaluation";

export const MAX_CRITERIA = 20;
export const MAX_CLAIM_CHARS = 4_000;
export const MAX_FILES = 8;
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 24 * 1024 * 1024;
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const EvaluationStatusSchema = z.enum([
  "PASS",
  "PARTIAL",
  "FAIL",
  "UNCERTAIN",
  "NOT_DEMONSTRATED",
]);

const optionalNullableString = z.string().nullish();
const optionalNullableNumber = z.number().nullish();

export const EvidenceReferenceSchema = z.object({
  source: z.string(),
  timestamp: optionalNullableString,
  observation: z.string(),
  screenshotIndex: optionalNullableNumber,
  step: optionalNullableString,
  target: optionalNullableString,
  kind: optionalNullableString,
  url: optionalNullableString,
  path: optionalNullableString,
  lineRange: optionalNullableString,
});

export const CriterionEvaluationSchema = z.object({
  criterionId: z.string(),
  criterion: z.string(),
  status: EvaluationStatusSchema,
  suggestedMarks: z.number().nullable(),
  maxMarks: z.number(),
  confidence: z.number().min(0).max(100),
  evidence: z.array(EvidenceReferenceSchema),
  reasoning: z.string(),
  missingEvidence: optionalNullableString,
});

export const EvaluationResultSchema = z.object({
  summary: z.object({
    suggestedScore: z.number(),
    maxScore: z.number(),
    evidenceCoverage: z.number().min(0).max(100),
  }),
  criteria: z.array(CriterionEvaluationSchema),
});

export type ParsedEvaluationResult = z.infer<typeof EvaluationResultSchema>;

export const CriterionInputSchema = z.object({
  id: z.string().trim().min(1).max(80),
  requirement: z.string().trim().min(1).max(1_000),
  maxMarks: z.number().finite().gt(0).max(1_000),
  guidance: z.string().max(1_000).optional(),
});

export const CriteriaPayloadSchema = z
  .array(CriterionInputSchema)
  .min(1, "Rubric must contain at least one criterion.")
  .max(MAX_CRITERIA, `Rubric cannot exceed ${MAX_CRITERIA} criteria.`);

export const ClaimSchema = z.string().max(MAX_CLAIM_CHARS);
export const ProjectDescriptionSchema = z.string().trim().max(MAX_CLAIM_CHARS);
export const OptionalUrlSchema = z.string().trim().max(2_000);

export function evaluationResponseJsonSchema(): Record<string, unknown> {
  const generated = z.toJSONSchema(EvaluationResultSchema, {
    target: "draft-07",
    io: "output",
    reused: "inline",
  }) as Record<string, unknown>;
  const rest = { ...generated };
  delete rest["~standard"];
  delete rest.$schema;
  return rest;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeConfidence(value: number): number {
  if (value >= 0 && value <= 1) return clamp(Math.round(value * 100), 0, 100);
  return clamp(value, 0, 100);
}

export function normalizeEvaluationResult(
  result: ParsedEvaluationResult,
  criteria: Criterion[]
): EvaluationResult {
  const byId = new Map(criteria.map((criterion) => [criterion.id, criterion]));

  const normalizedCriteria = result.criteria.map((item) => {
    const submitted = byId.get(item.criterionId);
    const maxMarks = submitted?.maxMarks ?? item.maxMarks;
    let suggestedMarks = item.suggestedMarks;
    if (suggestedMarks != null) {
      suggestedMarks = Number.isFinite(suggestedMarks)
        ? clamp(suggestedMarks, 0, maxMarks)
        : null;
    }

    return {
      ...item,
      maxMarks,
      suggestedMarks,
      confidence: normalizeConfidence(item.confidence),
      missingEvidence: item.missingEvidence ?? undefined,
      evidence: item.evidence.map((evidence) => ({
        source: evidence.source,
        observation: evidence.observation,
        timestamp: evidence.timestamp ?? undefined,
        screenshotIndex: evidence.screenshotIndex ?? undefined,
        step: evidence.step ?? undefined,
        target: evidence.target ?? undefined,
        kind: evidence.kind ?? undefined,
        url: evidence.url ?? undefined,
        path: evidence.path ?? undefined,
        lineRange: evidence.lineRange ?? undefined,
      })),
    };
  });

  const suggestedScore = normalizedCriteria.reduce(
    (sum, item) => sum + (item.suggestedMarks ?? 0),
    0
  );
  const maxScore = criteria.reduce((sum, item) => sum + item.maxMarks, 0);

  return {
    summary: {
      suggestedScore,
      maxScore,
      evidenceCoverage: clamp(result.summary.evidenceCoverage, 0, 100),
    },
    criteria: normalizedCriteria,
  };
}
