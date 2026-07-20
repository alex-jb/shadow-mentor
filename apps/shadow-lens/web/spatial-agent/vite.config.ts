import { defineConfig } from "vite";
// Dev proxy so the browser client hits the hardened Shadow endpoints on the API server.
export default defineConfig({
  server: { port: 8127, proxy: { "/api": { target: "http://localhost:3000", changeOrigin: true } } },
});
