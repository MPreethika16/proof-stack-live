/**
 * POST /api/evaluate — multipart contract for Antigravity / frontend
 *
 * Field names match the Live Proof form. There is no mutually exclusive
 * source selector. Live Demo URL and GitHub URL are independent optionals.
 *
 * Text fields
 * - criteria            required JSON array of { id, requirement, maxMarks }
 * - projectDescription  required for live/GitHub flows; optional on legacy
 *                       evidence-upload if `claim` is present
 * - claim               optional participant explanation
 * - liveDemoUrl         optional public http(s) website URL
 * - githubRepoUrl       optional public https://github.com/{owner}/{repo} URL
 *
 * File fields
 * - files               optional, repeatable PNG/JPEG/WebP screenshots
 *                       (legacy evidence-upload still works)
 *
 * Usable evidence: at least one of liveDemoUrl, githubRepoUrl, or files.
 *
 * Response: existing EvaluationResult JSON
 * {
 *   summary: { suggestedScore, maxScore, evidenceCoverage },
 *   criteria: [{
 *     criterionId, criterion, status, suggestedMarks, maxMarks, confidence,
 *     evidence: [{
 *       source, observation, timestamp?, screenshotIndex?, step?, target?,
 *       kind?, url?, path?, lineRange?
 *     }],
 *     reasoning, missingEvidence?
 *   }]
 * }
 *
 * status: PASS | PARTIAL | FAIL | UNCERTAIN | NOT_DEMONSTRATED
 *
 * Compatible with: EvidenceUploader, RubricBuilder, CriterionResult,
 * EvaluationResults, and human ACCEPT / OVERRIDE / REQUEST_EVIDENCE.
 *
 * This route is not authenticated. Limits reduce payload size; they do not
 * make the endpoint abuse-proof. Client URL checks are not SSRF protection.
 */

export const EVALUATE_FORM_FIELDS = {
  criteria: "criteria",
  projectDescription: "projectDescription",
  claim: "claim",
  liveDemoUrl: "liveDemoUrl",
  githubRepoUrl: "githubRepoUrl",
  files: "files",
} as const;
