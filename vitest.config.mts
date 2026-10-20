import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

const alias = {
  "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
  "@domain": path.resolve(__dirname, "functions/src/domain"),
  "@fn": path.resolve(__dirname, "functions/src"),
  "@": path.resolve(__dirname, "src"),
};

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: [
            "functions/src/**/*.test.ts",
            "src/lib/**/*.test.ts",
            "tests/unit/**/*.test.ts",
          ],
        },
      },
      {
        extends: true,
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "web",
          environment: "jsdom",
          include: ["src/components/**/*.test.tsx", "src/app/**/*.test.tsx"],
          setupFiles: ["./tests/setup-web.ts"],
        },
      },
    ],
  },
});
