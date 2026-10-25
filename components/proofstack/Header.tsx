"use client";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-[#0c0e14]/95 backdrop-blur-md">
      <div className="max-w-4xl mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700/60 flex items-center justify-center flex-shrink-0"
            aria-hidden="true"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="2" width="6" height="6" rx="1.5" className="fill-violet-500" />
              <rect x="10" y="2" width="6" height="6" rx="1.5" className="fill-cyan-400 opacity-80" />
              <rect x="2" y="10" width="6" height="6" rx="1.5" className="fill-zinc-600" />
              <path d="M11 13l1.5 1.5 3-3" stroke="#22d3ee" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight text-zinc-100 leading-none">
                ProofStack <span className="text-cyan-400 font-mono text-xs">Live</span>
              </h1>
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 border border-zinc-800 rounded px-1 py-0.2">
                Console
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
              Don&apos;t trust the claim. Inspect the proof.
            </p>
          </div>
        </div>

        {/* Verification Engine Badge */}
        <div
          className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 rounded-md px-2.5 py-1 flex-shrink-0"
          title="Gemma 4 model verification engine"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
          <span className="text-[11px] font-mono text-zinc-300">
            Gemma 4 Engine
          </span>
        </div>
      </div>
    </header>
  );
}
