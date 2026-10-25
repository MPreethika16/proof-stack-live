/**
 * Minimal Gemma 4 availability check (text-only, no evidence files).
 * Usage: node --env-file=.env.local scripts/smoke-gemma.mjs
 * Does not print secrets.
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

const model = "gemma-4-26b-a4b-it";
const ai = new GoogleGenAI({ apiKey });

const attempts = [
  {
    name: "json-mime-thinking-minimal",
    config: {
      temperature: 0,
      maxOutputTokens: 128,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: "MINIMAL" },
    },
  },
  {
    name: "json-mime-only",
    config: {
      temperature: 0,
      maxOutputTokens: 128,
      responseMimeType: "application/json",
    },
  },
  {
    name: "plain-text",
    config: {
      temperature: 0,
      maxOutputTokens: 128,
    },
  },
];

const prompt =
  'Reply with exactly this JSON object and nothing else: {"ok":true,"model":"gemma-4"}';

for (const attempt of attempts) {
  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: attempt.config,
    });
    console.log(`STATUS=OK attempt=${attempt.name}`);
    console.log(`PREVIEW=${JSON.stringify((response.text ?? "").slice(0, 240))}`);
    process.exit(0);
  } catch (error) {
    console.log(`STATUS=ERROR attempt=${attempt.name}`);
    console.log(`MSG=${redact(error?.message ?? error).slice(0, 600)}`);
  }
}

console.log("STATUS=ALL_FAILED");
process.exit(1);
