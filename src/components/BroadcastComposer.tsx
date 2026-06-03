"use client";

import { useState } from "react";
import type { Broadcast, Floor } from "@/lib/types";
import {
  CaretDown,
  Megaphone,
  PaperPlaneTilt,
} from "@phosphor-icons/react";

// F4 — Resident broadcast composer. Sends to /api/broadcasts, which mirrors the
// message into the incident feed.
export default function BroadcastComposer({
  floors,
  onSent,
}: {
  floors: Floor[];
  onSent: () => void;
}) {
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("all");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const residenceFloors = floors.filter((f) => f.need === "shelter");

  async function send() {
    if (!message.trim() || sending) return;
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), audience }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to send");
      const { broadcast } = (await res.json()) as { broadcast: Broadcast };
      setStatus(`Sent to ${broadcast.recipients} resident${broadcast.recipients === 1 ? "" : "s"}.`);
      setMessage("");
      onSent();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="panel panel-pad">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
        <Megaphone
          aria-hidden
          weight="duotone"
          className="h-4 w-4 text-slate-500"
        />
        Broadcast to residents
      </h2>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Compose a notification for residents…"
        rows={3}
        className="w-full resize-none rounded-lg border border-ink-600/60 bg-ink-800/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-signal-info focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Audience</span>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className="w-full appearance-none rounded-lg border border-ink-600/60 bg-ink-800/60 px-2 py-1.5 pr-8 text-sm text-slate-200 focus:border-signal-info focus:outline-none"
          >
            <option value="all">All residents</option>
            <option value="residences">All residences</option>
            {residenceFloors.map((f) => (
              <option key={f.key} value={`floor:${f.key}`}>
                {f.name}
              </option>
            ))}
          </select>
          <CaretDown
            aria-hidden
            weight="bold"
            className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
          />
        </label>
        <button
          type="button"
          onClick={send}
          disabled={sending || !message.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-signal-info px-3 py-1.5 text-sm font-semibold text-ink-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PaperPlaneTilt aria-hidden weight="duotone" className="h-4 w-4" />
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
      {status && <p className="mt-2 text-xs text-slate-400">{status}</p>}
    </div>
  );
}
