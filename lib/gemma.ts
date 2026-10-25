import {
  GoogleGenAI,
  ThinkingLevel,
  createUserContent,
} from "@google/genai";
import type { Criterion, EvaluationResult } from "@/types/evaluation";
import { EvaluationServiceError } from "@/lib/errors";
import {
  EvaluationResultSchema,
  evaluationResponseJsonSchema,
  normalizeEvaluationResult,
} from "@/lib/evaluation-schema";

/**
 * Official Gemma 4 identifier from @google/genai 2.27.0 Model union
 * and https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api
 *
 * Supported on Gemini API: gemma-4-26b-a4b-it, gemma-4-31b-it.
 * This model accepts text + image input. Do not send native video/audio.
 */
export const GEMMA_MODEL_ID = "gemma-4-26b-a4b-it";
export { EvaluationServiceError } from "@/lib/errors";

const SYSTEM_INSTRUCTION = `You are an evidence-review assistant for a software project evaluation system.

Your role is to evaluate each reviewer-defined criterion ONLY against the supplied labeled evidence. Evidence may include website screenshots (runtime), repository excerpts (code/docs), uploaded images, and the project description/claim.

CRITICAL RULES:
1. Do not assume functionality that is not demonstrated in the evidence.
2. ABSENCE OF EVIDENCE IS NOT EVIDENCE OF FAILURE. If something is simply not shown, return NOT_DEMONSTRATED — not FAIL.
3. Use FAIL only when the supplied evidence actually demonstrates behavior that contradicts the criterion.
4. Use UNCERTAIN when relevant evidence exists but does not conclusively establish the requirement.
5. Never fabricate UI states, actions, filenames, or observations.
6. Suggested marks must remain within the criterion's maximum marks (0 to maxMarks).
7. For PASS: suggest high/full marks where evidence justifies it.
8. For PARTIAL: suggest partial marks proportional to what is demonstrated.
9. For FAIL: suggest low/zero marks when evidence clearly contradicts criterion.
10. For NOT_DEMONSTRATED: suggest 0 marks (requirement was not shown).
11. For UNCERTAIN: use null for suggestedMarks when a defensible score cannot be determined.
12. For every conclusion, set evidence[].source to the exact labeled evidence id (filename or repository path). Include screenshotIndex, step, kind, url, path, and lineRange when those labels are present.
13. Source code and README text are NOT proof that a feature works at runtime. Website screenshots are NOT proof of implementation quality. If sources disagree, use UNCERTAIN and describe the discrepancy.
14. Clearly distinguish observed runtime behaviour from untested behaviour.
15. confidence is an integer from 0 to 100 (not 0-1).
16. Your evaluation is advisory only. A human reviewer makes the final decision.

Return ONLY valid JSON matching the provided schema.`;

export interface UploadedFile {
  name: string;
  mimeType: string;
  base64Data: string;
}

export interface GemmaEvaluationInput {
  criteria: Criterion[];
  projectDescription: string;
  claim: string;
  files: UploadedFile[];
  evidenceNotes: string;
}

function buildPrompt(input: GemmaEvaluationInput): string {
  const rubric = input.criteria
    .map(
      (criterion, index) =>
        `Criterion ${index + 1} (id: "${criterion.id}"): "${criterion.requirement}"${criterion.guidance ? ` [Scoring Guidance: ${criterion.guidance}]` : ""} — max ${criterion.maxMarks} marks`
    )
    .join("\n");

  const evidenceIndex =
    input.files.length === 0
      ? "(No image files attached.)"
      : input.files
          .map((file, index) => {
            const screenshotIndex = index + 1;
            return `- screenshotIndex ${screenshotIndex}: filename "${file.name}" (${file.mimeType})`;
          })
          .join("\n");

  return `PROJECT DESCRIPTION:
${input.projectDescription || "(No project description provided)"}

EVALUATION RUBRIC:
${rubric}

LABELED EVIDENCE IMAGES:
${evidenceIndex}

EVIDENCE PROVENANCE AND EXCERPTS:
${input.evidenceNotes || "(No additional provenance notes.)"}

PARTICIPANT CLAIM:
${input.claim || "(No participant claim provided)"}

TASK:
Evaluate every criterion against the labeled evidence only.
evidence[].source MUST copy a labeled filename or repository path exactly.
Do not treat repository text as runtime proof. Do not treat screenshots as proof of unseen code quality.
If a requirement was not shown, return NOT_DEMONSTRATED, not FAIL.`;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(unfenced.slice(start, end + 1));
    }
    throw new EvaluationServiceError(
      "The evaluation model returned a response that could not be parsed."
    );
  }
}

function logProviderError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    "[evaluate] provider error:",
    message.replace(/AIza[^\s]+/g, "[redacted]").replace(/AQ\.[^\s]+/g, "[redacted]")
  );
}

export async function runGemmaEvaluation(
  criteria: Criterion[],
  claim: string,
  files: UploadedFile[],
  extras?: { projectDescription?: string; evidenceNotes?: string }
): Promise<EvaluationResult> {
  return runGemmaEvaluationWithContext({
    criteria,
    claim,
    files,
    projectDescription: extras?.projectDescription ?? "",
    evidenceNotes: extras?.evidenceNotes ?? "",
  });
}

export async function runGemmaEvaluationWithContext(
  input: GemmaEvaluationInput
): Promise<EvaluationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new EvaluationServiceError(
      "The evaluation service is not configured.",
      500
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildPrompt(input);

  const contentParts: Array<{
    text?: string;
    inlineData?: { mimeType: string; data: string };
  }> = [];

  input.files.forEach((file, index) => {
    const screenshotIndex = index + 1;
    contentParts.push({
      inlineData: { mimeType: file.mimeType, data: file.base64Data },
    });
    contentParts.push({
      text: `[Evidence image | screenshotIndex ${screenshotIndex} | filename: ${file.name}]`,
    });
  });
  contentParts.push({ text: prompt });

  let response;
  try {
    response = await ai.models.generateContent({
      model: GEMMA_MODEL_ID,
      contents: createUserContent(contentParts),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        responseJsonSchema: evaluationResponseJsonSchema(),
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MINIMAL,
        },
      },
    });
  } catch (error) {
    logProviderError(error);
    throw new EvaluationServiceError(
      "The evaluation model could not complete this request."
    );
  }

  const text = response.text ?? "";
  if (!text.trim()) {
    throw new EvaluationServiceError(
      "The evaluation model returned an empty response."
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = extractJson(text);
  } catch (error) {
    if (error instanceof EvaluationServiceError) throw error;
    logProviderError(error);
    throw new EvaluationServiceError(
      "The evaluation model returned a response that could not be parsed."
    );
  }

  const parsed = EvaluationResultSchema.safeParse(parsedJson);
  if (!parsed.success) {
    console.error("[evaluate] schema mismatch:", parsed.error.issues.slice(0, 8));
    throw new EvaluationServiceError(
      "The evaluation model returned a malformed result."
    );
  }

  return normalizeEvaluationResult(parsed.data, input.criteria);
}
