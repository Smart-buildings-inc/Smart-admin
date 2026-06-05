"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CopilotMessage } from "@/lib/copilot";
import {
  PaperPlaneTilt,
  Robot,
  ShieldWarning,
  Sparkle,
} from "@phosphor-icons/react";

// AI ops copilot (observe-and-advise). A drawer/panel that holds a grounded
// chat thread against /api/copilot. Local-first: the route falls back to a
// deterministic answer when no LLM key is configured.

type DisplayMessage = CopilotMessage & { id: string };

interface QuickAction {
  label: string;
  prompt: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Building status", prompt: "Summarize the building status." },
  { label: "Explain incidents", prompt: "Explain the top open incidents." },
  {
    label: "Draft broadcast",
    prompt: "Draft a resident broadcast for the most pressing incident.",
  },
  { label: "At-risk floors", prompt: "Which floors are at risk right now?" },
];

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function Copilot() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  // Keep the thread pinned to the latest message.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || busy) return;

      const userMsg: DisplayMessage = {
        id: newId(),
        role: "user",
        content,
      };
      const history = [...messages, userMsg];
      setMessages(history);
      setInput("");
      setError(null);
      setBusy(true);

      try {
        const res = await fetch("/api/copilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });
        if (!res.ok) {
          const { error: msg } = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(msg ?? "The copilot is unavailable.");
        }
        const { reply } = (await res.json()) as { reply: string };
        setMessages((prev) => [
          ...prev,
          { id: newId(), role: "assistant", content: reply },
        ]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "The copilot is unavailable.",
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, messages],
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter inserts a newline.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  return (
    <div className="panel flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-ink-600/60 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Robot
            aria-hidden
            weight="duotone"
            className="h-4 w-4 text-signal-info"
          />
          Ops copilot
        </h2>
        <span className="rounded-full bg-ink-700 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-300">
          Advisory
        </span>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-1.5 border-b border-ink-600/40 px-4 py-2.5">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => void send(a.prompt)}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-full border border-ink-600/60 bg-ink-800/60 px-2.5 py-1 text-xs text-slate-200 transition-colors hover:border-signal-info hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkle aria-hidden weight="duotone" className="h-3 w-3" />
            {a.label}
          </button>
        ))}
      </div>

      {/* Thread */}
      <div
        ref={threadRef}
        className="flex-1 space-y-3 overflow-y-auto scroll-thin px-4 py-3"
        aria-live="polite"
      >
        {messages.length === 0 && !busy && (
          <p className="px-1 py-6 text-center text-sm text-slate-400">
            Ask about building status, open incidents, at-risk floors, or draft
            a resident broadcast.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-signal-info text-ink-950"
                  : "bg-ink-800/70 text-slate-100"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-ink-800/70 px-3 py-2 text-sm text-slate-400">
              <span className="pulse">Thinking…</span>
            </div>
          </div>
        )}
        {error && (
          <p className="rounded-lg bg-signal-crit/15 px-3 py-2 text-xs text-signal-crit">
            {error}
          </p>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-ink-600/60 px-4 py-3">
        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Ask the ops copilot</span>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask the ops copilot…"
              rows={1}
              className="max-h-32 w-full resize-none rounded-lg border border-ink-600/60 bg-ink-800/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-signal-info focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => void send(input)}
            disabled={busy || !input.trim()}
            aria-label="Send message"
            className="inline-flex items-center gap-1.5 rounded-lg bg-signal-info px-3 py-2 text-sm font-semibold text-ink-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <PaperPlaneTilt aria-hidden weight="duotone" className="h-4 w-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
          <ShieldWarning aria-hidden weight="duotone" className="h-3.5 w-3.5" />
          Advisory only — never a life-safety control.
        </p>
      </div>
    </div>
  );
}
