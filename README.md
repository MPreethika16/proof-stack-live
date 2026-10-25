# ProofStack ⚖️
> **"Show the evidence. Keep the judgment human."**

ProofStack is a **human-in-the-loop multimodal evidence evaluator** designed for hackathons, code reviews, and software project assessments.

---

## 🎯 The Core Problem

Reviewers and judges evaluating software projects face a frustrating challenge: manually scrubbing through 3-minute screen recordings, scanning dozens of screenshots, and cross-referencing subjective participant claims against strict rubric requirements.

- **Automated judging fails** because LLMs lack context, hallucinate, and remove human accountability.
- **Generic chatbots fail** because they provide conversational chatter rather than structured, verifiable evidence findings.
- **Manual review is slow**, tiring, and inconsistent across judges.

---

## 💡 The ProofStack Solution

ProofStack provides an AI-assisted, reviewer-first workspace:
1. **Reviewer defines criteria**: Add custom criteria (e.g. *"JWT Auth with Refresh Tokens"*, *"Interactive Real-Time Dashboard"*, *"Export to CSV & PDF"*) and assign maximum marks.
2. **Participant supplies evidence**: Upload short screen recording demo videos, UI screenshots, and participant claims.
3. **Gemma analyzes evidence**: Evaluates every criterion against the supplied multimodal evidence, generating evidence-grounded findings:
   - **Status**: `PASS`, `PARTIAL`, `FAIL`, `UNCERTAIN`, or `NOT_DEMONSTRATED`
   - **Suggested Marks** with strict bounding to max score
   - **Reasoning** referencing specific timestamps, visual indicators, or code artifacts
   - **Confidence Score** (0-100%)
   - **Missing Evidence** clearly documented
4. **Human Reviewer makes the final decision**: The reviewer reviews the analysis, adjusts any score or notes, locks final judgments, and exports a tamper-evident audit report.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Turbopack)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict mode, zero `any`)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **AI Engine**: Google Gen AI SDK (`@google/genai`) running official **Gemma 4** (`gemma-4-26b-a4b-it`) for multimodal evidence evaluation
- **Validation**: [Zod](https://zod.dev/) for robust schema validation and JSON parsing
- **Icons**: Lucide React

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+ installed

### 2. Environment Variables
Create a `.env.local` file in the root directory:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
```
> ProofStack includes a built-in mock fallback engine that triggers automatically if no API key is provided, allowing full offline/demo capability.

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production
```bash
npm run build
npm start
```

---

## ⚡ Instant Hackathon Demo

To test ProofStack in seconds:
1. Click **"Load Hackathon Demo"** in the top navigation bar.
2. ProofStack will pre-populate:
   - 4 realistic criteria (Authentication, Analytics Dashboard, Stripe Billing, Realtime Sync)
   - Sample claims and visual evidence
3. Click **"Run Evidence Evaluation"**.
4. Inspect the breakdown, adjust human marks, override status, and click **"Export Review Summary"**.

---

## 🔒 Design Principles

- **No AI Autocracy**: AI never sets final marks without human sign-off.
- **Evidence-Grounded**: Every finding must cite visual proof or note missing demonstration.
- **Fast & Minimal**: Zero heavy databases, vector stores, or complex orchestration frameworks. Everything runs efficiently in Next.js.


