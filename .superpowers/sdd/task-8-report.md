# Task 3.5 Report: PWA (Installable + Static Cache)

**Status:** Complete

**Commit:** `e29526841169c70b1f11a23e8fcb406a0abb0f00`

**Date:** 2026-07-16

## Changes

| File | Action |
|---|---|
| `package.json` | Added `vite-plugin-pwa@0.17.5` as devDependency (0.17.x for Node 18 compat) |
| `vite.config.ts` | Added `VitePWA` plugin with manifest, autoUpdate SW, workbox glob patterns |
| `index.html` | Added `theme-color`, `apple-touch-icon`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` meta tags |
| `public/icon-192.png` | Placeholder 1x1 purple PNG |
| `public/icon-512.png` | Placeholder 1x1 purple PNG |

## Build

- `npm run build` — **succeeds**
- `dist/` contains `sw.js`, `workbox-5ffe50d4.js`, `manifest.webmanifest`, `registerSW.js`
- Precache: 14 entries (1287.46 KiB)

## Tests

- `npm test` — **90/90 passed** (7 test files)

## Notes

- Used `vite-plugin-pwa@0.17.5` instead of latest due to Node 18 incompatibility with `workbox-build@7.x` / `serialize-javascript@7.x` which require `globalThis.crypto` (Node 19+). Version 0.17.5 uses workbox v6 which is compatible with Node 18.
