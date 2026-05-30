import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, "src/ocr/ocrBackground.ts"),
      name: "JudolDetectorBackground",
      formats: ["iife"],
      fileName: () => "background.js"
    }
  }
});
