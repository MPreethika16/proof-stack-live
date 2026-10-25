"use client";

import type { AppMode } from "@/types/evaluation";

interface ModeTabsProps {
  activeMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

export default function ModeTabs({ activeMode, onModeChange }: ModeTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Inspection mode"
      className="inline-flex items-center bg-zinc-900/90 border border-zinc-800 rounded-lg p-1 gap-1"
    >
      {/* Live Proof Tab */}
      <button
        id="tab-live-proof"
        type="button"
        role="tab"
        aria-selected={activeMode === "live-proof"}
        aria-controls="panel-live-proof"
        onClick={() => onModeChange("live-proof")}
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-mono font-medium transition-colors ${
          activeMode === "live-proof"
            ? "bg-zinc-800 text-zinc-100 border border-zinc-700/70 shadow-sm"
            : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent"
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            activeMode === "live-proof" ? "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)]" : "bg-zinc-600"
          }`}
          aria-hidden="true"
        />
        <span>Live Proof (URL)</span>
      </button>

      {/* Evidence Upload Tab */}
      <button
        id="tab-evidence-upload"
        type="button"
        role="tab"
        aria-selected={activeMode === "evidence-upload"}
        aria-controls="panel-evidence-upload"
        onClick={() => onModeChange("evidence-upload")}
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-mono font-medium transition-colors ${
          activeMode === "evidence-upload"
            ? "bg-zinc-800 text-zinc-100 border border-zinc-700/70 shadow-sm"
            : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent"
        }`}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="opacity-80" aria-hidden="true">
          <path d="M2 13h12M8 10V2M5 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Evidence Upload (Files)</span>
      </button>
    </div>
  );
}

