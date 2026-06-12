import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/assets/agentic-browser/",
  plugins: [tailwindcss(), solid()],
  build: {
    outDir: "./test-assets/agentic-browser",
    emptyOutDir: true,
  },
});
