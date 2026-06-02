// Client-side device + browser sniffing for the install/download page. UA
// sniffing is imperfect by nature, so the page always offers a manual fallback —
// this only personalizes the *default* guidance to the visitor's device.

export type OS = "ios" | "android" | "macos" | "windows" | "chromeos" | "linux" | "unknown";
export type Browser = "safari" | "chrome" | "edge" | "firefox" | "samsung" | "opera" | "unknown";

export type InstallMethod = "prompt" | "ios-share" | "menu" | "unsupported";

export type DeviceInfo = {
  os: OS;
  osLabel: string;
  browser: Browser;
  browserLabel: string;
  /** Friendly device name, e.g. "iPhone", "Android phone", "Windows PC". */
  deviceLabel: string;
  /** How this device is expected to install the PWA. */
  method: InstallMethod;
  /** Ordered, human install steps tailored to os+browser. */
  steps: string[];
};

function detectOS(ua: string, touch: boolean): OS {
  if (/iphone|ipod/.test(ua)) return "ios";
  if (/ipad/.test(ua)) return "ios";
  // iPadOS 13+ masquerades as desktop Safari; a touch-capable "Mac" is an iPad.
  if (/macintosh/.test(ua) && touch) return "ios";
  if (/android/.test(ua)) return "android";
  if (/cros/.test(ua)) return "chromeos";
  if (/macintosh|mac os x/.test(ua)) return "macos";
  if (/windows/.test(ua)) return "windows";
  if (/linux/.test(ua)) return "linux";
  return "unknown";
}

function detectBrowser(ua: string): Browser {
  if (/edg\//.test(ua)) return "edge";
  if (/samsungbrowser/.test(ua)) return "samsung";
  if (/opr\/|opera/.test(ua)) return "opera";
  if (/firefox|fxios/.test(ua)) return "firefox";
  // CriOS = Chrome on iOS. Real Safari has "safari" but not "chrome"/"crios".
  if (/crios/.test(ua)) return "chrome";
  if (/chrome|chromium/.test(ua)) return "chrome";
  if (/safari/.test(ua)) return "safari";
  return "unknown";
}

const OS_LABEL: Record<OS, string> = {
  ios: "iOS / iPadOS",
  android: "Android",
  macos: "macOS",
  windows: "Windows",
  chromeos: "ChromeOS",
  linux: "Linux",
  unknown: "your device",
};

const BROWSER_LABEL: Record<Browser, string> = {
  safari: "Safari",
  chrome: "Chrome",
  edge: "Edge",
  firefox: "Firefox",
  samsung: "Samsung Internet",
  opera: "Opera",
  unknown: "your browser",
};

function deviceLabelFor(os: OS, ua: string): string {
  switch (os) {
    case "ios":
      if (/ipad/.test(ua) || (/macintosh/.test(ua))) return "iPad";
      return "iPhone";
    case "android":
      return /mobile/.test(ua) ? "Android phone" : "Android tablet";
    case "macos":
      return "Mac";
    case "windows":
      return "Windows PC";
    case "chromeos":
      return "Chromebook";
    case "linux":
      return "Linux PC";
    default:
      return "your device";
  }
}

function stepsFor(os: OS, browser: Browser): { method: InstallMethod; steps: string[] } {
  // iOS only supports install via Safari's Share sheet — even Chrome on iOS.
  if (os === "ios") {
    if (browser !== "safari") {
      return {
        method: "ios-share",
        steps: [
          "Open this page in Safari (other browsers can't install on iOS).",
          "Tap the Share button (the square with an upward arrow).",
          "Choose “Add to Home Screen”.",
          "Tap “Add” — ATLAS OS lands on your Home Screen.",
        ],
      };
    }
    return {
      method: "ios-share",
      steps: [
        "Tap the Share button (the square with an upward arrow) in the toolbar.",
        "Scroll down and choose “Add to Home Screen”.",
        "Tap “Add” in the top-right.",
        "Launch ATLAS OS from your Home Screen like a native app.",
      ],
    };
  }

  if (os === "android") {
    if (browser === "firefox") {
      return {
        method: "menu",
        steps: [
          "Open the ⋮ menu (top-right).",
          "Tap “Install” or “Add to Home screen”.",
          "Confirm — ATLAS OS appears in your app drawer.",
        ],
      };
    }
    return {
      method: "prompt",
      steps: [
        "Tap “Install ATLAS OS” above.",
        "Confirm “Install” in the browser dialog.",
        "ATLAS OS appears in your app drawer and Home screen.",
      ],
    };
  }

  // Desktop / Chromebook.
  if (browser === "chrome" || browser === "edge" || browser === "samsung" || browser === "opera") {
    return {
      method: "prompt",
      steps: [
        "Click “Install ATLAS OS” above.",
        "Confirm “Install” in the dialog (or use the install icon in the address bar).",
        "ATLAS OS opens in its own window and pins to your dock / taskbar.",
      ],
    };
  }

  if (browser === "safari" && os === "macos") {
    return {
      method: "menu",
      steps: [
        "In the menu bar, open File ▸ “Add to Dock…”.",
        "Confirm the name and click “Add”.",
        "Launch ATLAS OS from your Dock as its own app.",
      ],
    };
  }

  if (browser === "firefox") {
    return {
      method: "unsupported",
      steps: [
        "Firefox on desktop doesn’t install web apps directly.",
        "Open this page in Chrome or Edge to install, or just bookmark it.",
        "You can still add ATLAS OS to your Home screen on Android Firefox.",
      ],
    };
  }

  return {
    method: "menu",
    steps: [
      "Open your browser’s menu.",
      "Look for “Install app” or “Add to Home screen”.",
      "Confirm to add ATLAS OS to your device.",
    ],
  };
}

/** Build a full DeviceInfo from the current navigator. Call on the client only. */
export function detectDevice(): DeviceInfo {
  const ua = (typeof navigator !== "undefined" ? navigator.userAgent : "").toLowerCase();
  const touch =
    typeof navigator !== "undefined" && navigator.maxTouchPoints > 1;

  const os = detectOS(ua, touch);
  const browser = detectBrowser(ua);
  const { method, steps } = stepsFor(os, browser);

  return {
    os,
    osLabel: OS_LABEL[os],
    browser,
    browserLabel: BROWSER_LABEL[browser],
    deviceLabel: deviceLabelFor(os, ua),
    method,
    steps,
  };
}

/** True when the app is already running as an installed standalone PWA. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
