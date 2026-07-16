### Task 3.5: PWA (Installable + Static Cache)

**Files:**
- Create: `public/icon-192.png`, `public/icon-512.png`
- Modify: `package.json` — add vite-plugin-pwa dep
- Modify: `vite.config.ts` — PWA plugin config
- Modify: `index.html` — meta tags

- [ ] **Step 1: Install vite-plugin-pwa**

```bash
npm install -D vite-plugin-pwa 2>&1
```

- [ ] **Step 2: Create placeholder PWA icons**

Create minimal valid 1x1 purple PNGs. In PowerShell:
```powershell
$pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg=="
$pngBytes = [Convert]::FromBase64String($pngBase64)
Set-Content -LiteralPath "public/icon-192.png" -Value $pngBytes -Encoding Byte
Copy-Item -LiteralPath "public/icon-192.png" -Destination "public/icon-512.png"
```

- [ ] **Step 3: Configure PWA in vite.config.ts**

Read the existing file first, then replace with (preserving existing test config):

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ACGen — Agile Artifact Workbench',
        short_name: 'ACGen',
        theme_color: '#7c3aed',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },
  },
})
```

- [ ] **Step 4: Add PWA meta tags to index.html**

Add inside `<head>` (before existing tags):
```html
<meta name="theme-color" content="#7c3aed">
<link rel="apple-touch-icon" href="/icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
```

- [ ] **Step 5: Verify build + tests**

```bash
npm run build 2>&1
```
Expected: builds successfully. `dist/` contains `sw.js` and `manifest.webmanifest`.

```bash
npm test 2>&1
```
Expected: all 90 tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(pwa): installable PWA — vite-plugin-pwa, manifest, icons, static precache"
```
