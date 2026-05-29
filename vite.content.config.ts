import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, "src/content/content.ts"),
      name: "JudolDetectorContent",
      formats: ["iife"],
      fileName: () => "content.js"
    }
  }
});
