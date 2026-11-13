import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

/** Which commit this client was built from, shown in Settings → App version (so you can tell the Pi is up to date). */
function buildId(): string {
  try {
    return execSync('git log -1 --format="%h · %cs"', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

// Dev server proxies /api to the Express server so the client can run with
// hot reload while still talking to the real backend on port 3000.
export default defineConfig({
  plugins: [react()],
  define: { __APP_BUILD__: JSON.stringify(buildId()) },
  build: {
    // The whole app ships as one bundle (~500 kB minified, ~140 kB gzipped), just past Vite's
    // default 500 kB warning. That warning is aimed at sites loaded over slow mobile links; this
    // one is served from the Pi over the home LAN, so splitting it up isn't worth the complexity.
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
