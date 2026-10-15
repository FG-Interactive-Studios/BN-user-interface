import { defineConfig } from "vite";

// Development only: prevent other websites from using the local websocket
// proxy as a cross-site tunnel. Backend tickets remain mandatory.
const localBrowserOrigin = /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i;

export default defineConfig({
  server: {
    proxy: {
      "/api": { target: "http://localhost:8080", changeOrigin: true },
      "/ws": {
        // Use HTTP as the proxy target so the Origin rewritten for the
        // Spring WebSocket handshake is http://localhost:8080, not ws://...
        target: "http://localhost:8080",
        ws: true,
        changeOrigin: true,
        rewriteWsOrigin: true,
        bypass(req) {
          // Vite's websocket origin rewrite removes the backend origin
          // safeguard; only allow browsers served from local loopback.
          if (typeof req.headers.origin !== "string" ||
              !localBrowserOrigin.test(req.headers.origin)) return false;
        },
      },
    },
  },
});
