"use client";

import { useEffect, useMemo, useState } from "react";

import { detectDevice, isStandalone, type DeviceInfo } from "@/lib/device";

// The beforeinstallprompt event isn't in the standard lib DOM types yet.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type OtherGuide = { name: string; steps: string[] };

// Cross-device guidance shown under "Other devices" so the page is useful even
// when opened on a machine other than the one being installed to.
const OTHER_GUIDES: OtherGuide[] = [
  {
    name: "iPhone & iPad (Safari)",
    steps: [
      "Open atlas in Safari.",
      "Tap Share ▸ “Add to Home Screen”.",
      "Tap “Add”.",
    ],
  },
  {
    name: "Android (Chrome)",
    steps: [
      "Open the ⋮ menu.",
      "Tap “Install app”.",
      "Confirm “Install”.",
    ],
  },
  {
    name: "Windows / Chromebook (Chrome or Edge)",
    steps: [
      "Click the install icon in the address bar.",
      "Or menu ▸ “Install ATLAS OS”.",
      "Confirm “Install”.",
    ],
  },
  {
    name: "Mac (Safari)",
    steps: ["Menu bar ▸ File ▸ “Add to Dock…”.", "Click “Add”.", "Launch from the Dock."],
  },
];

export default function DownloadClient() {
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showOthers, setShowOthers] = useState(false);

  useEffect(() => {
    setDevice(detectDevice());
    setInstalled(isStandalone());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    const mq = window.matchMedia("(display-mode: standalone)");
    const onMq = () => setInstalled(isStandalone());
    mq.addEventListener?.("change", onMq);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      mq.removeEventListener?.("change", onMq);
    };
  }, []);

  const canPrompt = !!deferred;

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } finally {
      setDeferred(null);
    }
  };

  const detectedChip = useMemo(() => {
    if (!device) return "Detecting your device…";
    return `${device.deviceLabel} · ${device.browserLabel}`;
  }, [device]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8 lg:py-12">
      {/* Hero */}
      <header className="flex flex-col items-center gap-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-192.png"
          alt="ATLAS OS app icon"
          width={96}
          height={96}
          className="h-24 w-24 rounded-[22%] shadow-2xl ring-1 ring-white/10"
        />
        <div>
          <h1 className="display text-3xl text-white lg:text-4xl">
            Get ATLAS&nbsp;OS
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-400 lg:text-base">
            Install the habitat console as an app — full-screen, fast, and
            available straight from your home screen.{" "}
            <span className="important">No app store required.</span>
          </p>
        </div>

        {/* Detected-device chip */}
        <span className="inline-flex items-center gap-2 rounded-full border border-ink-600/70 bg-ink-900/70 px-3 py-1.5 text-xs font-medium text-slate-300">
          <span className="h-2 w-2 rounded-full bg-signal-ok pulse" aria-hidden />
          Detected: <span className="font-semibold text-white">{detectedChip}</span>
        </span>
      </header>

      {/* Primary install card, tailored to the detected device */}
      <section className="panel panel-pad flex flex-col gap-5">
        {installed ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-signal-ok/15 text-signal-ok">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
                <path d="m5 13 4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white">You&apos;re all set</h2>
            <p className="text-sm text-slate-400">
              ATLAS OS is already installed on this {device?.deviceLabel ?? "device"}.
              Launch it from your home screen or dock.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-white">
                Install on your {device?.deviceLabel ?? "device"}
              </h2>
              <p className="text-sm text-slate-400">
                {device?.method === "ios-share"
                  ? "Two taps from Safari’s Share menu."
                  : device?.method === "prompt"
                    ? "One tap — your browser supports direct install."
                    : "Follow the quick steps below for your browser."}
              </p>
            </div>

            {/* Direct install button when the browser exposes the prompt. */}
            <button
              type="button"
              onClick={handleInstall}
              disabled={!canPrompt}
              className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all duration-150 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info/70 ${
                canPrompt
                  ? "bg-white text-ink-950 hover:bg-slate-200 shadow-lg shadow-signal-info/10"
                  : "cursor-not-allowed border border-ink-600/70 bg-ink-900/60 text-slate-500"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                <path d="M12 3v12" />
                <path d="m7 11 5 5 5-5" />
                <path d="M5 19h14" />
              </svg>
              {canPrompt ? "Install ATLAS OS" : "Follow the steps below"}
            </button>

            {/* Tailored, numbered steps. */}
            <ol className="flex flex-col gap-2">
              {(device?.steps ?? []).map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink-700 text-[11px] font-bold text-slate-200">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      {/* Why install */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { t: "Home-screen launch", d: "Opens full-screen, no browser chrome." },
          { t: "Works offline", d: "Cached shell survives flaky links." },
          { t: "Always current", d: "Auto-updates — never a stale build." },
        ].map((f) => (
          <div key={f.t} className="panel panel-pad">
            <p className="text-sm font-semibold text-white">{f.t}</p>
            <p className="mt-1 text-xs text-slate-400">{f.d}</p>
          </div>
        ))}
      </section>

      {/* Other devices */}
      <section className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setShowOthers((v) => !v)}
          aria-expanded={showOthers}
          className="inline-flex items-center justify-center gap-2 self-center rounded-full border border-ink-600/70 bg-ink-900/60 px-4 py-2 text-xs font-semibold text-slate-300 transition-all duration-150 ease-out hover:bg-ink-800 hover:text-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info/70"
        >
          Installing on a different device?
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 transition-transform duration-200 ${showOthers ? "rotate-180" : ""}`} aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {showOthers && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {OTHER_GUIDES.map((g) => (
              <div key={g.name} className="panel panel-pad">
                <p className="text-sm font-semibold text-white">{g.name}</p>
                <ol className="mt-2 flex flex-col gap-1">
                  {g.steps.map((s, i) => (
                    <li key={i} className="flex gap-2 text-xs text-slate-400">
                      <span className="font-mono text-slate-500">{i + 1}.</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
