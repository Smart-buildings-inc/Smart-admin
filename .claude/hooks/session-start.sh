#!/bin/bash
# SessionStart hook — prepares the container so tests and linters work in
# Claude Code on the web. Installs JS dependencies and the Playwright browser
# used by the e2e suite. Idempotent and non-interactive.
set -euo pipefail

# Only run in Claude Code on the web (remote) sessions; locals already have deps.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# npm install (not ci) so the cached container layer is reused on resume.
npm install

# The e2e suite (playwright.config.ts) runs Chromium only.
npx playwright install chromium
