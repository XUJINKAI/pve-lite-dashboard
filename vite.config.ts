import vue from "@vitejs/plugin-vue";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ command, mode }) => {
  const env: Record<string, string> = command === "serve" ? loadEnv(mode, process.cwd(), "PVE_DASHBOARD_") : {};
  const target = env.PVE_DASHBOARD_URL;
  const token = env.PVE_DASHBOARD_TOKEN;

  if (Boolean(target) !== Boolean(token)) {
    throw new Error("PVE_DASHBOARD_URL and PVE_DASHBOARD_TOKEN must be set together");
  }

  return {
    plugins: [vue()],
    publicDir: false,
    base: "./",
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
    server: {
      host: "127.0.0.1",
      port: 4173,
      strictPort: true,
      proxy: target && token ? {
        "/api/": {
          target,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.slice("/api".length),
          configure: (proxy) => {
            proxy.on("proxyReq", (request) => {
              request.setHeader("Authorization", `PVEAPIToken=${token}`);
              request.removeHeader("cookie");
            });
          },
        },
      } : undefined,
    },
    preview: {
      host: "127.0.0.1",
      port: 4173,
      strictPort: true,
    },
  };
});
