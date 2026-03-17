import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    target: "esnext",
    minify: "esbuild",
    cssCodeSplit: false,
    rollupOptions: {
      input: "index.html",
      output: {
        // Single bundle — no code splitting.
        // LogSeq plugin iframes can't reliably load dynamic chunks.
        manualChunks: undefined,
        inlineDynamicImports: true,
        entryFileNames: "index.js",
        assetFileNames: "index[extname]",
      },
    },
  },
});
