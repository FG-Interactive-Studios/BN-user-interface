import { defineConfig } from "vite";

export default defineConfig({
  // Development only. Production must serve /api from its own reverse proxy
  // or set VITE_API_URL and explicitly allow the origin in the API.
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
