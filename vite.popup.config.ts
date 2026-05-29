import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, "src/popup/popup.ts"),
      name: "JudolDetectorPopup",
      formats: ["iife"],
      fileName: () => "popup.js"
    }
  }
});
