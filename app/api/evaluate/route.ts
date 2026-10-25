import { NextRequest, NextResponse } from "next/server";
import { captureLiveDemoEvidence } from "@/lib/browser-evidence";
import { EVALUATE_FORM_FIELDS } from "@/lib/evaluate-contract";
import { EvaluationServiceError } from "@/lib/errors";
import { captureGithubEvidence } from "@/lib/github-evidence";
import { runGemmaEvaluationWithContext, type UploadedFile } from "@/lib/gemma";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  ClaimSchema,
  CriteriaPayloadSchema,
  MAX_FILE_BYTES,
  MAX_FILES,
  MAX_TOTAL_BYTES,
  OptionalUrlSchema,
  ProjectDescriptionSchema,
} from "@/lib/evaluation-schema";

export const maxDuration = 180;

const IMAGE_MIME_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
};

function clientError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function sniffImageMime(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function extensionForMime(mime: string): string {
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  return ".jpg";
}

function stabilizeFilename(
  originalName: string,
  index: number,
  mime: string,
  used: Set<string>
): string {
  const basename = originalName.split(/[/\\]/).pop() || `screenshot-${index + 1}`;
  const sanitized = basename.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || `screenshot-${index + 1}`;
  const ext = extensionForMime(mime);
  const hasExt = /\.(png|jpe?g|webp)$/i.test(sanitized);
  let candidate = hasExt ? sanitized : `${sanitized}${ext}`;
  let suffix = 2;
  while (used.has(candidate.toLowerCase())) {
    const stem = candidate.replace(/\.(png|jpe?g|webp)$/i, "");
    candidate = `${stem}-${suffix}${ext}`;
    suffix += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function asTextField(value: FormDataEntryValue | null): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const clientKey =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "anonymous";
    if (!checkRateLimit(clientKey)) {
      return clientError("Too many evaluation requests. Please wait and try again.", 429);
    }

    if (!process.env.GEMINI_API_KEY) {
      return clientError("The evaluation service is not configured.", 500);
    }

    const formData = await req.formData();

    const criteriaRaw = asTextField(formData.get(EVALUATE_FORM_FIELDS.criteria));
    if (!criteriaRaw) {
      return clientError("No rubric criteria provided.");
    }

    let criteriaJson: unknown;
    try {
      criteriaJson = JSON.parse(criteriaRaw);
    } catch {
      return clientError("Rubric criteria must be valid JSON.");
    }

    const criteriaParsed = CriteriaPayloadSchema.safeParse(criteriaJson);
    if (!criteriaParsed.success) {
      return clientError("Rubric criteria are invalid.");
    }

    const claimParsed = ClaimSchema.safeParse(
      asTextField(formData.get(EVALUATE_FORM_FIELDS.claim)) ?? ""
    );
    if (!claimParsed.success) {
      return clientError("Claim is too long.");
    }

    const descriptionParsed = ProjectDescriptionSchema.safeParse(
      asTextField(formData.get(EVALUATE_FORM_FIELDS.projectDescription)) ?? ""
    );
    if (!descriptionParsed.success) {
      return clientError("Project description is too long.");
    }

    const liveDemoRaw = OptionalUrlSchema.safeParse(
      asTextField(formData.get(EVALUATE_FORM_FIELDS.liveDemoUrl)) ?? ""
    );
    const githubRaw = OptionalUrlSchema.safeParse(
      asTextField(formData.get(EVALUATE_FORM_FIELDS.githubRepoUrl)) ?? ""
    );
    if (!liveDemoRaw.success || !githubRaw.success) {
      return clientError("A supplied URL is too long.");
    }

    const liveDemoUrl = liveDemoRaw.data;
    const githubRepoUrl = githubRaw.data;
    const projectDescription = descriptionParsed.data || claimParsed.data;

    const fileEntries = formData
      .getAll(EVALUATE_FORM_FIELDS.files)
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (!liveDemoUrl && !githubRepoUrl && fileEntries.length === 0) {
      return clientError(
        "No usable evidence source was provided. Submit a live demo URL, a GitHub repository URL, or uploaded image evidence."
      );
    }

    if ((liveDemoUrl || githubRepoUrl) && !projectDescription) {
      return clientError("Project description is required when evaluating a live demo or GitHub repository.");
    }

    if (fileEntries.length > MAX_FILES) {
      return clientError(`At most ${MAX_FILES} evidence images can be submitted.`);
    }

    const usedNames = new Set<string>();
    const uploadedFiles: UploadedFile[] = [];
    let totalBytes = 0;

    for (const [index, file] of fileEntries.entries()) {
      if (file.size > MAX_FILE_BYTES) {
        return clientError("Each evidence image must be 8 MB or smaller.");
      }
      totalBytes += file.size;
      if (totalBytes > MAX_TOTAL_BYTES) {
        return clientError("Total evidence size exceeds the 24 MB limit.");
      }

      const declared = IMAGE_MIME_ALIASES[file.type] ?? file.type;
      if (declared.startsWith("video/") || declared.startsWith("audio/")) {
        return clientError(
          "This evaluation endpoint accepts image evidence only (PNG, JPEG, or WebP). The configured Gemma 4 model does not take native video or audio input."
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const sniffed = sniffImageMime(buffer);
      const mimeType = sniffed ?? declared;
      if (
        !ALLOWED_IMAGE_MIME_TYPES.includes(
          mimeType as (typeof ALLOWED_IMAGE_MIME_TYPES)[number]
        )
      ) {
        return clientError("Evidence files must be PNG, JPEG, or WebP images.");
      }

      uploadedFiles.push({
        name: stabilizeFilename(file.name, index, mimeType, usedNames),
        mimeType,
        base64Data: buffer.toString("base64"),
      });
    }

    const noteParts: string[] = [];
    if (uploadedFiles.length > 0) {
      noteParts.push(
        "UPLOADED EVIDENCE (judge-supplied images).\n" +
          uploadedFiles.map((file) => `id=${file.name}; kind=upload`).join("\n")
      );
    }

    if (liveDemoUrl) {
      const capture = await captureLiveDemoEvidence(liveDemoUrl);
      for (const file of capture.files) {
        uploadedFiles.push(file);
      }
      noteParts.push(capture.notes);
    }

    if (githubRepoUrl) {
      const capture = await captureGithubEvidence(githubRepoUrl);
      noteParts.push(capture.notes);
    }

    if (uploadedFiles.length === 0 && noteParts.length === 0) {
      return clientError("No usable evidence could be gathered from the supplied sources.");
    }

    const result = await runGemmaEvaluationWithContext({
      criteria: criteriaParsed.data,
      claim: claimParsed.data,
      files: uploadedFiles,
      projectDescription,
      evidenceNotes: noteParts.join("\n\n"),
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("Evaluation error:", err instanceof EvaluationServiceError ? err.message : err);

    if (err instanceof EvaluationServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    return NextResponse.json(
      { error: "An unexpected evaluation error occurred." },
      { status: 500 }
    );
  }
}
