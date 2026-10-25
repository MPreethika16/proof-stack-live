/**
 * Hits POST /api/evaluate with invalid JSON, then a 1x1 PNG + text rubric.
 * Usage: node --env-file=.env.local scripts/smoke-evaluate.mjs [baseUrl]
 */
const baseUrl = process.argv[2] || "http://127.0.0.1:3005";

function redact(value) {
  return String(value)
    .replace(/AIza[^\s]+/g, "[redacted]")
    .replace(/AQ\.[^\s]+/g, "[redacted]");
}

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const invalid = await fetch(`${baseUrl}/api/evaluate`, {
  method: "POST",
  body: (() => {
    const form = new FormData();
    form.set("criteria", "{not-json");
    form.set("claim", "n/a");
    form.set("files", new Blob([png], { type: "image/png" }), "screenshot-01-home.png");
    return form;
  })(),
});
const invalidBody = await invalid.json();
console.log(`INVALID_STATUS=${invalid.status}`);
console.log(`INVALID_ERROR=${redact(invalidBody.error || JSON.stringify(invalidBody)).slice(0, 200)}`);
if (invalid.status !== 400) {
  process.exit(1);
}

const form = new FormData();
form.set(
  "criteria",
  JSON.stringify([
    {
      id: "c1",
      requirement: "User can sign in",
      maxMarks: 10,
    },
  ])
);
form.set(
  "claim",
  "This request includes only a 1x1 placeholder screenshot, not a real login UI."
);
form.set("files", new Blob([png], { type: "image/png" }), "screenshot-01-home.png");

const response = await fetch(`${baseUrl}/api/evaluate`, {
  method: "POST",
  body: form,
});
const payload = await response.json();
console.log(`EVAL_STATUS=${response.status}`);
if (!response.ok) {
  console.log(`EVAL_ERROR=${redact(payload.error || JSON.stringify(payload)).slice(0, 400)}`);
  process.exit(1);
}

const first = payload.criteria?.[0];
console.log(`STATUS_VALUE=${first?.status ?? "missing"}`);
console.log(`SOURCE=${first?.evidence?.[0]?.source ?? "(none)"}`);
console.log(`MARKS=${first?.suggestedMarks}`);
console.log(`HAS_SUMMARY=${Boolean(payload.summary)}`);
