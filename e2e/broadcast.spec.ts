import { test, expect } from "@playwright/test";

// P0 — F4 broadcast composer: sending notifies residents and mirrors into feed.
test("broadcast send shows success and mirrors into the incident feed", async ({
  page,
}) => {
  await page.goto("/");

  // The loading splash is a full-viewport z-[100] overlay that owns pointer
  // events for ~650ms after load; wait for it to detach before interacting so
  // the Send click can't be intercepted (was flaky on slower Mobile/Tablet).
  await page
    .getByTestId("app-splash")
    .waitFor({ state: "detached", timeout: 10_000 })
    .catch(() => {});

  // Unique marker so we can find this exact broadcast in the feed afterwards.
  const marker = `E2E broadcast ${Date.now()}`;

  const textarea = page.getByPlaceholder("Compose a notification for residents…");
  await expect(textarea).toBeVisible();
  await textarea.fill(marker);

  await page.getByRole("button", { name: "Send" }).click();

  // Status text: "Sent to N resident(s)."
  await expect(page.getByText(/Sent to \d+ resident/)).toBeVisible();

  // The broadcast is mirrored into the incident feed. The feed item title is
  // `Broadcast to <audience>: “<message>”`, so the message text appears there.
  await expect(page.getByText(marker)).toBeVisible();
});
