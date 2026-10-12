// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import http from "node:http";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

let backendProcess: ReturnType<typeof spawn> | null = null;

function autoStartBackendPlugin() {
  return {
    name: "auto-start-backend",
    apply: "serve" as const,
    configureServer() {
      const lifecycle = process.env["npm_lifecycle_event"];
      const isManaged =
        lifecycle === "dev" ||
        lifecycle === "dev:all" ||
        lifecycle === "start" ||
        process.env["MEDISHELF_MANAGED_API"] === "1" ||
        process.env["CONCURRENTLY"] === "true";

      if (isManaged) {
        return;
      }

      // Check after a brief moment to allow backend to finish binding if starting concurrently
      setTimeout(() => {
        const checkReq = http.get("http://127.0.0.1:8000/api/health", () => {
          // Backend is already active
        });
        checkReq.on("error", () => {
          if (backendProcess) return;
          const isWin = process.platform === "win32";
          const venvPython = isWin
            ? path.resolve(process.cwd(), ".venv/Scripts/python.exe")
            : path.resolve(process.cwd(), ".venv/bin/python");
          const pythonCmd = fs.existsSync(venvPython) ? venvPython : "python";

          console.log(
            `[vite] Launching MediShelf Python API at http://127.0.0.1:8000 using ${pythonCmd}...`,
          );
          backendProcess = spawn(pythonCmd, ["tools/serve_api.py"], {
            stdio: "inherit",
            shell: true,
          });

          const cleanup = () => {
            if (backendProcess?.pid) {
              try {
                if (process.platform === "win32") {
                  spawn("taskkill", ["/pid", backendProcess.pid.toString(), "/f", "/t"]);
                } else {
                  backendProcess.kill();
                }
              } catch (error) {
                void error;
              }
              backendProcess = null;
            }
          };

          process.once("exit", cleanup);
          process.once("SIGINT", cleanup);
          process.once("SIGTERM", cleanup);
        });
      }, 1000);
    },
  };
}

export default defineConfig({
  nitro: { preset: "node-server" },
  vite: {
    plugins: [autoStartBackendPlugin()],
    server: {
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8000",
          changeOrigin: true,
        },
      },
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
