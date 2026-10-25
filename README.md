# ProofStack Live ⚖️
> **"Don't trust the claim. Inspect the proof."**

ProofStack Live is an **evidence-grounded project evaluation platform** designed to help hackathon judges, technical reviewers, and recruiters verify software projects with multimodal evidence, AI-assisted scoring, and human authority.

---

## 🎯 The Problem

Reviewers evaluating software submissions face significant challenges:
- **Unverified claims**: Participants claim complete authentication, payment integrations, or responsive designs that are broken or absent in reality.
- **Manual review is slow**: Scrubbing through screen recordings, testing live links, and inspecting code repositories takes enormous time.
- **AI autocracy is dangerous**: Blindly trusting generic LLM evaluations leads to hallucinations, false failures, and lack of human accountability.

---

## 💡 The ProofStack Live Solution

ProofStack Live provides an evidence-first, human-in-the-loop judging console:
1. **Judge Defines Rubric**: Define custom criteria, individual mark allocations, and scoring guidance. Total marks are calculated dynamically.
2. **Multi-Source Evidence Collection**:
   - **Live Website Runtime**: Headless Playwright browser automation captures viewport screenshots, scroll states, navigation timing, and console observations.
   - **GitHub Repository Analysis**: Bounded GitHub API reader inspects `package.json`, architecture, documentation, and source files.
   - **Supplementary Uploads**: Accepts UI screenshots and demo videos (automatically sampled into key visual frames via HTML5 canvas).
3. **Gemma 4 Evidence Assessment**: Google's **Gemma 4** (`gemma-4-26b-a4b-it`) evaluates every criterion strictly against labeled evidence.
   - Verdicts: `PASS`, `PARTIAL`, `FAIL`, `UNCERTAIN`, or `NOT_DEMONSTRATED`.
   - **Absence of evidence is never treated as failure** (produces `NOT_DEMONSTRATED`).
   - Every finding cites specific evidence artifacts (`🌐 Live Screenshot`, `📦 Repository Code`, `📁 Uploaded Proof`).
4. **Human Authority ("AI recommends. The human judge decides.")**:
   - The AI-suggested score is strictly advisory.
   - The human judge can **Accept**, **Override** verdicts/marks within the dynamic criterion bounds, or **Request More Evidence**.
   - Generates a tamper-evident, copyable Markdown audit report.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict mode, zero `any`)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **AI Model**: Google Gen AI SDK (`@google/genai`) running official **Gemma 4** (`gemma-4-26b-a4b-it`)
- **Browser Automation**: [Playwright](https://playwright.dev/) for headless website inspection and screenshot collection
- **Repository Integration**: GitHub REST API for source inspection
- **Validation & Schemas**: [Zod](https://zod.dev/) for structured JSON schema outputs and request validation
- **Security**: Strict server-side SSRF validation (blocking loopback, private subnets, and cloud metadata IPs)

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+ installed

### 2. Configure Environment
Create a `.env.local` file in the root directory:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

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

## ⚡ Instant Hackathon Demo Sequence

1. Click **"Try a Demo Evaluation →"** on the home screen.
2. The workspace will pre-populate:
   - **Live Demo URL**: `https://demo.vercel.store`
   - **GitHub Repo URL**: `https://github.com/vercel/commerce`
   - **Context**: Open-source headless commerce store
   - **Rubric**: 4 criteria (60 dynamic total points)
3. Click **"Run ProofStack Live Evaluation"**.
4. Inspect the side-by-side **Judge-Approved Final Score** vs. **AI-Suggested Score**.
5. Test the human-in-the-loop control: click **"★ Override Verdict & Marks"** on any criterion to adjust scores.
6. Click **"Copy Markdown Audit"** for an audit log.

---

## 🔒 Responsible AI & Design Principles

- **No Hallucinated Failures**: Missing demonstration results in `NOT_DEMONSTRATED`, not `FAIL`.
- **Grounded Citations**: Findings cite actual screenshot filenames, repository paths, and visual observations.
- **Human Authority**: The human judge always retains the final verdict.
