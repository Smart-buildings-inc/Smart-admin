# ATLAS OS — project notes for Claude

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS. Dark-first
ops-console aesthetic with an iOS / SF Pro feel (`--font-sf`).

## UI conventions

- **Interactive elements always get a hover state and a slight press state.**
  Every button, link, tab, or tappable control should:
  - have a clear `hover:` treatment (color/background shift), and
  - shrink slightly on press — `active:scale-[0.92]`–`active:scale-[0.97]`
    paired with `transition-transform duration-150 ease-out`.
  This is the house style for the whole console; keep it consistent.
- Navigation lives in one place: `src/lib/nav.ts` (`NAV_ITEMS` + `isActive`).
  The desktop top bar (`NavBar`) and the mobile bottom tab bar (`BottomNav`)
  both read from it — add new sections there, not in the components.
- Respect safe-area insets on anything pinned to a screen edge
  (`env(safe-area-inset-*)`); the layout already reserves space for the
  mobile bottom bar.
- Use the Tailwind palette in `tailwind.config.ts` (`ink`, `signal`, `need`)
  rather than ad-hoc hex values.

## Checks before pushing

```bash
npm run typecheck
npm run lint
```
