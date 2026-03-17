import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "esnext",
    minify: "esbuild",
    cssCodeSplit: false,
    rollupOptions: {
      input: "index.html",
      output: {
        entryFileNames: "index.js",
        assetFileNames: "index[extname]",
      },
    },
  },
});
