import { EvaluationServiceError } from "@/lib/errors";
import type { UploadedFile } from "@/lib/gemma";
import { assertPublicHttpUrl, assertRequestUrlPublic } from "@/lib/ssrf";

export interface BrowserCapture {
  files: UploadedFile[];
  notes: string;
}

const NAVIGATION_TIMEOUT_MS = 20_000;
const TOTAL_TIMEOUT_MS = 35_000;

export async function captureLiveDemoEvidence(rawUrl: string): Promise<BrowserCapture> {
  const target = await assertPublicHttpUrl(rawUrl);

  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch {
    throw new EvaluationServiceError(
      "Live website inspection is unavailable because the browser engine is not installed.",
      503
    );
  }

  const browser = await playwright.chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
  });

  const files: UploadedFile[] = [];
  const observations: string[] = [];

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      javaScriptEnabled: true,
      ignoreHTTPSErrors: false,
      bypassCSP: false,
    });

    await context.route("**/*", async (route) => {
      const requestUrl = route.request().url();
      if (requestUrl.startsWith("data:") || requestUrl.startsWith("blob:")) {
        await route.continue();
        return;
      }
      const allowed = await assertRequestUrlPublic(requestUrl);
      if (!allowed) {
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });

    const page = await context.newPage();
    page.setDefaultTimeout(NAVIGATION_TIMEOUT_MS);

    const response = await Promise.race([
      page.goto(target.href, { waitUntil: "domcontentloaded", timeout: NAVIGATION_TIMEOUT_MS }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("navigation-timeout")), TOTAL_TIMEOUT_MS)
      ),
    ]);

    if (!response) {
      throw new EvaluationServiceError("The live demo URL did not return a document.", 422);
    }
    const finalUrl = page.url();
    await assertPublicHttpUrl(finalUrl);

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const title = (await page.title()).slice(0, 200);
    const visibleText = (await page.locator("body").innerText().catch(() => "")).slice(0, 1200);

    const firstShot = await page.screenshot({ type: "png", fullPage: false });
    files.push({
      name: "screenshot-01-initial-viewport.png",
      mimeType: "image/png",
      base64Data: firstShot.toString("base64"),
    });
    observations.push(
      `id=screenshot-01-initial-viewport.png; kind=website-screenshot; url=${finalUrl}; step=initial-viewport; title=${title}`
    );

    await page.mouse.wheel(0, 900);
    await new Promise((resolve) => setTimeout(resolve, 800));

    const secondShot = await page.screenshot({ type: "png", fullPage: false });
    files.push({
      name: "screenshot-02-after-scroll.png",
      mimeType: "image/png",
      base64Data: secondShot.toString("base64"),
    });
    observations.push(
      `id=screenshot-02-after-scroll.png; kind=website-screenshot; url=${finalUrl}; step=scroll-down; observedText=${visibleText.replace(/\s+/g, " ")}`
    );

    await context.close();
  } catch (error) {
    if (error instanceof EvaluationServiceError) throw error;
    throw new EvaluationServiceError(
      "The live demo website could not be inspected safely.",
      422
    );
  } finally {
    await browser.close().catch(() => undefined);
  }

  return {
    files,
    notes: [
      "RUNTIME EVIDENCE (website). These screenshots are observed UI only.",
      "Untested flows (auth, payments, hidden pages) are NOT demonstrated.",
      ...observations,
    ].join("\n"),
  };
}
