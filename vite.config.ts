import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

export default defineConfig({
  base: "/assets/agentic-browser/",
  plugins: [tailwindcss(), solid()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __RIPPLE_PORT__: Number(process.env.PHARO_RIPPLE_PORT ?? 8080),
  },
  build: {
    outDir: "./assets/agentic-browser",
    emptyOutDir: true,
  },
});
