"use client";

// Shared fullscreen toggle button for the 3D stages (twin + simulator).
// Pairs with `useFullscreen` — pass its `isFullscreen` + `toggle`.

export default function FullscreenButton({
  isFullscreen,
  onToggle,
}: {
  isFullscreen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      aria-pressed={isFullscreen}
      title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-600/70 bg-ink-900/80 text-slate-200 backdrop-blur transition-colors hover:bg-ink-800 hover:text-white"
    >
      {isFullscreen ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 9H4M9 9V4M9 9 4 4M15 9h5M15 9V4m0 5 5-5M9 15H4m5 0v5m0-5-5 5m11-5h5m-5 0v5m0-5 5 5" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 4H4v4M16 4h4v4M16 20h4v-4M8 20H4v-4" />
        </svg>
      )}
    </button>
  );
}
