import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Component markup tests only. These do not claim browser layout or interaction coverage.
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = { addEventListener() {} };
const server = await createServer({
  root: fileURLToPath(new URL("..", import.meta.url)),
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  ssr: { noExternal: ["react-router-dom", "react-router", "lucide-react", "recharts"] },
  plugins: [react()],
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const { checkRendering } = await server.ssrLoadModule("/tests/render-checks.tsx");
  checkRendering();
} finally {
  await server.close();
}
