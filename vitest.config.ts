import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    testTimeout: 30000, // integration tests hit real network
    fileParallelism: false, // tests share state via Convex
  },
});
