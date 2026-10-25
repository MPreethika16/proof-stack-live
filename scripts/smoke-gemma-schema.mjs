/**
 * Checks whether Gemma 4 accepts responseJsonSchema on this API key.
 * Usage: node --env-file=.env.local scripts/smoke-gemma-schema.mjs
 */
import { GoogleGenAI } from "@google/genai";

function redact(value) {
  return String(value)
    .replace(/AIza[^\s]+/g, "[redacted]")
    .replace(/AQ\.[^\s]+/g, "[redacted]");
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.log("STATUS=NO_KEY");
  process.exit(2);
}

const schema = {
  type: "object",
  properties: {
    summary: {
      type: "object",
      properties: {
        suggestedScore: { type: "number" },
        maxScore: { type: "number" },
        evidenceCoverage: { type: "number" },
      },
      required: ["suggestedScore", "maxScore", "evidenceCoverage"],
    },
    criteria: {
      type: "array",
      items: {
        type: "object",
        properties: {
          criterionId: { type: "string" },
          criterion: { type: "string" },
          status: {
            type: "string",
            enum: ["PASS", "PARTIAL", "FAIL", "UNCERTAIN", "NOT_DEMONSTRATED"],
          },
          suggestedMarks: { type: ["number", "null"] },
          maxMarks: { type: "number" },
          confidence: { type: "number" },
          evidence: {
            type: "array",
            items: {
              type: "object",
              properties: {
                source: { type: "string" },
                timestamp: { type: ["string", "null"] },
                observation: { type: "string" },
              },
              required: ["source", "observation"],
            },
          },
          reasoning: { type: "string" },
          missingEvidence: { type: ["string", "null"] },
        },
        required: [
          "criterionId",
          "criterion",
          "status",
          "suggestedMarks",
          "maxMarks",
          "confidence",
          "evidence",
          "reasoning",
        ],
      },
    },
  },
  required: ["summary", "criteria"],
};

const ai = new GoogleGenAI({ apiKey });
const prompt = `Evaluate this rubric against the participant claim only. No files are attached.

Criterion 1 (id: "c1"): "User can sign in" — max 10 marks
PARTICIPANT CLAIM: "We have a login page but this request includes no screenshots."

Return JSON matching the schema. Absence of evidence is NOT_DEMONSTRATED, not FAIL.`;

try {
  const response = await ai.models.generateContent({
    model: "gemma-4-26b-a4b-it",
    contents: prompt,
    config: {
      temperature: 0.1,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      thinkingConfig: { thinkingLevel: "MINIMAL" },
    },
  });
  const text = response.text ?? "";
  console.log("STATUS=OK");
  JSON.parse(text);
  console.log("JSON=valid");
  console.log("PREVIEW=" + JSON.stringify(text.slice(0, 400)));
} catch (error) {
  console.log("STATUS=ERROR");
  console.log("MSG=" + redact(error?.message ?? error).slice(0, 800));
  process.exit(1);
}
