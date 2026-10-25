# ProofStack Live — Hackathon Implementation Plan

> **Mission**: Transform ProofStack into **ProofStack Live**, an AI-powered website verification and evidence review tool using Google's Gemma model family for automated, evidence-grounded review with a human reviewer in the loop.

---

## 🏗️ Architecture Overview

ProofStack Live builds directly on the clean Next.js 16 + React 19 + TypeScript architecture of ProofStack:
- **Client Workspace**: Next.js App Router with Tailwind CSS v4, providing an interactive rubric designer, live website URL input, browser session timeline, and human-in-the-loop review board.
- **Constrained Evidence Capture Engine**: Server-side automated browser session that visits the target URL, executes non-destructive interactions (navigation, click, scroll, form fill on permitted demos), and captures screenshots + interaction traces.
- **Evaluation Pipeline**: Google Gen AI SDK (`@google/genai`) querying Google's supported Gemma model with strict system instructions, grounded observation prompts, and Zod schema validation.
- **Reviewer Oversight Interface**: Human-in-the-loop verdict overrides, mark adjustments, uncertainty analysis, and audit trail export.

---

## 📋 Phased Roadmap

### Phase A: Product Identity & UI Refinement
- **Target**: Update product naming to **ProofStack Live** with a sleek verification dashboard aesthetic.
- **Components**:
  - Enhance `Header.tsx` to reflect "ProofStack Live — Autonomous Website Evidence Review".
  - Refine `ModeTabs.tsx` and main layout to feature the Live URL inspector prominently alongside manual evidence upload.
  - Add URL validation, verification pre-flight checks, and safety disclaimer (public demo sites only).

### Phase B: Gemma Integration
- **Target**: Ensure model configuration uses Google's supported Gemma model identifier via `@google/genai` with fallback support.
- **Requirements**:
  - Server-side credentials only (`GEMINI_API_KEY`).
  - Strict grounding: evaluate criteria *only* against captured browser screenshots and observed DOM text.
  - Explicit rule enforcement: absence of proof = `NOT_DEMONSTRATED`, not `FAIL`. `FAIL` is strictly reserved for contradictory evidence.

### Phase C: Structured Evaluation & Validation
- **Target**: Maintain 100% type-safe JSON schema enforcement via Zod.
- **Schema Contracts**:
  - Statuses: `PASS`, `PARTIAL`, `FAIL`, `UNCERTAIN`, `NOT_DEMONSTRATED`.
  - Evidence references: screenshot indices, interaction step, DOM element target, observed state.
  - Suggestion vs. Decision: AI marks are advisory recommendations with bounded ranges [0, maxMarks].

### Phase D: Browser Evidence Capture
- **Target**: Constrained, secure browser automation service.
- **Safeguards**:
  - Restrict to publicly accessible URLs.
  - Strict timeouts (15–30s) and interaction sandboxing.
  - No credential stuffing, CAPTCHA bypassing, or unauthorized access.
  - Capture sequence: initial viewport -> interaction step -> final viewport with DOM snapshot.

### Phase E: Human-in-the-Loop Review
- **Target**: Empower reviewers to inspect, verify, override, or request more evidence.
- **Features**:
  - Side-by-side evidence inspection (screenshot viewer with observation highlights).
  - Reviewer decision toggles: `ACCEPT`, `OVERRIDE`, `REQUEST_EVIDENCE`.
  - Exportable review summary report (JSON & formatted Markdown).

### Phase F: Testing & Demo Preparation
- **Target**: End-to-end demo flow for hackathon presentation.
- **Demo Scenarios**:
  - 1-click sample sites (e.g. open-source demo app, hackathon portfolio, landing page with auth flow).
  - Pre-seeded evaluation rubrics.
  - Instant offline demo fallback mode.

---

## 🛡️ Guiding Principles & Technical Guardrails

1. **Evidence Integrity**: Never fabricate screenshots, timestamps, test results, or observations.
2. **Accountability**: Keep the final mark and verdict in human hands.
3. **Safety First**: Non-destructive interactions only; strict origin verification.
